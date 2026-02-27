const Ajv = require('ajv').default || require('ajv');
const addFormats = require('ajv-formats');
const path = require('path');
const generateSchema = require('generate-schema');
const fs = require('fs');
const fsPromises = require('fs').promises;

/**
 * Ordered list of JSON Schema format detectors.
 * Evaluated top-to-bottom; first match wins.
 * Each entry: { format: string, test: (value: string) => boolean }
 *
 * Supported formats (industry-standard JSON Schema / ajv-formats):
 *   date-time  – ISO 8601 full timestamp  e.g. 2024-07-25T13:36:08.365Z
 *   date       – ISO 8601 date only       e.g. 2024-07-25
 *   time       – ISO 8601 time only       e.g. 13:36:08.365Z
 *   duration   – ISO 8601 duration        e.g. P1Y2M3DT4H5M6S
 *   uuid       – RFC 4122 UUID (v1–v5)    e.g. 550e8400-e29b-41d4-a716-446655440000
 *   email      – RFC 5321 e-mail address  e.g. user@example.com
 *   uri        – Absolute URI / URL        e.g. https://api.example.com/v1
 *   ipv4       – IPv4 dotted-quad          e.g. 192.168.1.1
 *   ipv6       – IPv6 (full / compressed)  e.g. 2001:db8::1
 *   hostname   – RFC 1123 hostname         e.g. api.example.com
 */
const FORMAT_PATTERNS = [
  {
    format: 'date-time',
    // Full ISO 8601 datetime; subsecond digits and offset are optional
    test: (v) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i.test(v),
  },
  {
    format: 'date',
    // ISO 8601 calendar date only; must NOT contain a time component
    test: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
  },
  {
    format: 'time',
    // ISO 8601 time only (HH:MM:SS with optional subseconds / offset)
    test: (v) => /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i.test(v),
  },
  {
    format: 'duration',
    // ISO 8601 duration: starts with P, at least one designator must follow
    test: (v) => /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?!$)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/.test(v),
  },
  {
    format: 'uuid',
    // RFC 4122 – all versions (1-5) and nil UUID
    test: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
  },
  {
    format: 'email',
    // Basic RFC 5321 structure check (local@domain); full validation is mail-library territory
    test: (v) => /^[^\s@"()<>\[\]\\,;:]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254,
  },
  {
    format: 'uri',
    // Absolute URI with a recognised scheme (http, https, ftp, urn, …)
    test: (v) => /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^\s]+$/.test(v),
  },
  {
    format: 'ipv4',
    // Dotted-quad, each octet 0-255
    test: (v) => /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/.test(v),
  },
  {
    format: 'ipv6',
    // Full or compressed IPv6 (including loopback ::1)
    test: (v) => {
      // Expanded 8-group form
      if (/^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i.test(v)) return true;
      // Compressed form containing '::'
      if (v.includes('::')) {
        const sides = v.split('::');
        if (sides.length !== 2) return false;
        const left = sides[0] ? sides[0].split(':') : [];
        const right = sides[1] ? sides[1].split(':') : [];
        return left.length + right.length <= 7 &&
          [...left, ...right].every((g) => /^[0-9a-f]{1,4}$/i.test(g));
      }
      return false;
    },
  },
  {
    format: 'hostname',
    // RFC 1123 FQDN: requires at least one dot so plain words (e.g. "active") are not matched.
    // Labels: 1-63 chars, no leading/trailing hyphen; total length ≤ 253 chars.
    test: (v) =>
      v.length <= 253 &&
      v.includes('.') &&
      /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.((?!-)[a-zA-Z0-9-]{1,63}(?<!-)))+$/.test(v),
  },
];

/**
 * SchemaValidator - A flexible JSON schema validation library
 */
class SchemaValidator {
  /**
   * Initialize the SchemaValidator with schema directory
   * 
   * @param {string} [schemaPathOrFolderName='api-schemas'] - Schema directory path or folder name
   * 
   * **Bruno Environment (Auto-detected):**
   * - If running in Bruno, this is treated as a folder name within your collection
   * - Automatically uses `bru.cwd()` to construct the full path
   * - Defaults to 'api-schemas' if not provided
   * 
   * **Node.js Environment:**
   * - Provide the absolute or relative path to your schema directory
   * 
   * @example
   * // Bruno: Simple - uses default 'api-schemas' folder
   * const validator = new SchemaValidator();
   * 
   * // Bruno: Custom folder name
   * const validator = new SchemaValidator('my-schemas');
   * 
   * // Node.js: Absolute path
   * const validator = new SchemaValidator('C:/projects/my-api/api-schemas');
   * 
   * // Node.js: Relative path
   * const path = require('path');
   * const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));
   */
  // ─── Format / type detection helpers ────────────────────────────────────────

  /**
   * Detect a JSON Schema `format` keyword for a string value.
   * Returns the format name (e.g. 'date-time', 'uuid') or `null` if none matches.
   * @param {string} value
   * @returns {string|null}
   */
  _detectFormat(value) {
    if (typeof value !== 'string' || value.trim() === '') return null;
    for (const { format, test } of FORMAT_PATTERNS) {
      if (test(value)) return format;
    }
    return null;
  }

  /**
   * Build a JSON Schema type fragment for a single value.
   * - null            → { type: 'null' }
   * - Array           → { type: 'array' }
   * - object          → { type: 'object' }
   * - string w/format → { type: 'string', format: '<detected>' }
   * - other           → { type: typeof value }
   * @param {*} value
   * @returns {object}
   */
  _getTypeDescriptor(value) {
    if (value === null) return { type: 'null' };
    if (Array.isArray(value)) return { type: 'array' };
    if (typeof value === 'object') return { type: 'object' };
    if (typeof value === 'string') {
      const fmt = this._detectFormat(value);
      return fmt ? { type: 'string', format: fmt } : { type: 'string' };
    }
    return { type: typeof value };
  }

  /**
   * Scan ALL items in an array to build a type-descriptor map that correctly
   * handles nullable fields and consistent format detection across the dataset.
   *
   * Strategy per field:
   *   1. Collect the set of non-null base types seen across all items.
   *   2. If any item has null (or is missing the field), mark nullable.
   *   3. If every non-null value agrees on a single format, record it.
   *
   * Edge-cases handled:
   *   - Field present in some items but absent in others → nullable
   *   - Field is sometimes null, sometimes a timestamp   → { type: ["string", "null"], format: "date-time" }
   *   - Field has mixed non-null types (e.g. number + string) → union type, no format
   *
   * @param {object[]} items - Array of sample objects
   * @returns {{ [key: string]: object }} Map of field name → JSON Schema type fragment
   */
  _mergeTypeInfo(items) {
    // Gather info: field → { types: Set<string>, formats: Set<string>, hasNull: boolean }
    const allKeys = new Set(items.flatMap((item) => Object.keys(item)));
    const fieldMeta = {};

    for (const key of allKeys) {
      fieldMeta[key] = { types: new Set(), formats: new Set(), hasNull: false };
    }

    for (const item of items) {
      for (const key of allKeys) {
        const meta = fieldMeta[key];
        if (!Object.prototype.hasOwnProperty.call(item, key)) {
          // Field missing from this item → treat as nullable
          meta.hasNull = true;
          continue;
        }
        const value = item[key];
        if (value === null) {
          meta.hasNull = true;
        } else {
          const descriptor = this._getTypeDescriptor(value);
          meta.types.add(descriptor.type);
          if (descriptor.format) meta.formats.add(descriptor.format);
        }
      }
    }

    // Build final descriptors
    const result = {};
    for (const [key, meta] of Object.entries(fieldMeta)) {
      const typeList = [...meta.types];
      if (meta.hasNull) typeList.push('null');

      const descriptor = typeList.length === 1
        ? { type: typeList[0] }
        : { type: typeList };

      // Only attach format when all non-null values agree on one format
      if (meta.formats.size === 1) {
        descriptor.format = [...meta.formats][0];
      }

      result[key] = descriptor;
    }
    return result;
  }

  /**
   * Determine which fields are required (present and non-null in EVERY item).
   * A field is optional if it is absent or null in at least one item.
   * @param {object[]} items
   * @returns {string[]}
   */
  _getRequiredFields(items) {
    if (!items || items.length === 0) return [];
    const allKeys = new Set(items.flatMap((item) => Object.keys(item)));
    return [...allKeys].filter((key) =>
      items.every(
        (item) =>
          Object.prototype.hasOwnProperty.call(item, key) && item[key] !== null
      )
    );
  }

  /**
   * Walk a schema node alongside sample data and stamp `format` keywords wherever
   * a string value matches a known format.  Handles union types (e.g. ["string","null"]).
   *
   * This is the fallback enrichment path for non-array / plain-object inputs where
   * `_mergeTypeInfo` is not used.  For array inputs, `_mergeTypeInfo` is already called
   * during schema construction so this method is a no-op for those paths.
   *
   * @param {object} schema - Schema node (mutated in place)
   * @param {*}      sample - Corresponding sample value
   */
  _enrichSchemaFormats(schema, sample) {
    if (!schema || sample === undefined || sample === null) return;

    const types = Array.isArray(schema.type) ? schema.type : [schema.type];

    if (types.includes('string') && typeof sample === 'string') {
      const fmt = this._detectFormat(sample);
      if (fmt && !schema.format) schema.format = fmt;
    } else if (types.includes('object') && schema.properties && typeof sample === 'object' && !Array.isArray(sample)) {
      for (const key of Object.keys(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(sample, key)) {
          this._enrichSchemaFormats(schema.properties[key], sample[key]);
        }
      }
    } else if (types.includes('array') && schema.items && Array.isArray(sample) && sample.length > 0) {
      // For arrays, use all items if items schema is an object schema
      if (schema.items.type === 'object' && schema.items.properties && sample.length > 0) {
        const merged = this._mergeTypeInfo(sample.filter((i) => i && typeof i === 'object'));
        for (const [key, descriptor] of Object.entries(merged)) {
          if (schema.items.properties[key]) {
            Object.assign(schema.items.properties[key], descriptor);
          }
        }
      } else {
        this._enrichSchemaFormats(schema.items, sample[0]);
      }
    }
  }

  constructor(schemaPathOrFolderName = 'api-schemas') {
    // Auto-detect Bruno environment
    const isBrunoEnv = typeof bru !== 'undefined' && typeof bru.cwd === 'function';
    
    if (isBrunoEnv) {
      // In Bruno: Treat parameter as folder name and construct full path
      this.schemaBasePath = `${bru.cwd()}/${schemaPathOrFolderName}`;
    } else {
      // In Node.js: Treat parameter as full path
      // Check if it's a valid path (not just 'api-schemas' default)
      if (schemaPathOrFolderName === 'api-schemas' && !fs.existsSync(schemaPathOrFolderName)) {
        throw new Error(
          'SchemaValidator: Running in Node.js environment.\n' +
          'Please provide the full path to your schema directory.\n' +
          'Example: new SchemaValidator("/absolute/path/to/schemas")\n' +
          'Example: new SchemaValidator(path.join(__dirname, "api-schemas"))'
        );
      }
      this.schemaBasePath = schemaPathOrFolderName;
    }
  }

  /**
   * Creates a JSON schema file from the provided JSON object and saves it to the specified folder and file name.
   * @param {string} folderName - The name of the folder where the schema file will be saved (e.g., 'vpp/Asset Manager')
   * @param {string} fileName - The name of the schema file (without the file extension)
   * @param {object} json - The JSON object used to generate the schema
   * @returns {Promise<string>} A Promise that resolves with the generated schema file path
   */
  async createJsonSchema(folderName, fileName, json) {
    // Generate base schema
    let schema = generateSchema.json(json);

    // Force schema to draft-07 and set structure for array of objects (list validation)
    schema['$schema'] = 'http://json-schema.org/draft-07/schema#';

    // If the input is an array of objects, scan ALL items for accurate nullable / format detection
    if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object') {
      const objectItems = json.filter((i) => i && typeof i === 'object' && !Array.isArray(i));
      const typeMap = this._mergeTypeInfo(objectItems);
      const requiredFields = this._getRequiredFields(objectItems);

      schema.items = {
        type: 'object',
        properties: typeMap,
        required: requiredFields,
      };
    } else if (!Array.isArray(json) && json && typeof json === 'object') {
      // Single object: enrich top-level properties with format detection
      this._enrichSchemaFormats(schema, json);
    }

    // Remove extra fields added by generate-schema that we don't need
    delete schema.uniqueItems;
    delete schema.description;
    if (schema.items && schema.items.description) delete schema.items.description;

    const schemaString = JSON.stringify(schema, null, 2);
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);

    try {
      // Create directory if it doesn't exist
      await fsPromises.mkdir(path.dirname(schemaFilePath), { recursive: true });
      await fsPromises.writeFile(schemaFilePath, schemaString);
      
      console.log(`✓ JSON schema successfully created and saved.`);
      console.log(`  Location: ${schemaFilePath}`);
      console.log(`  Folder: ${folderName}`);
      console.log(`  File: ${fileName}_schema.json`);
      
      return schemaFilePath;
    } catch (err) {
      console.error('✗ Error creating schema file:', err);
      throw err;
    }
  }

  /**
   * Validates an object against a JSON schema (Synchronous version).
   * @param {string} folderName - The path to the directory containing the JSON schema file
   * @param {string} fileName - The name of the JSON schema file (without _schema.json)
   * @param {object} body - The object to validate against the JSON schema
   * @param {object} options - Validation options
   * @param {boolean} options.createSchema - Whether to create the JSON schema if it doesn't exist (default: false)
   * @param {boolean} options.verbose - Enable verbose error logging (default: true)
   * @param {boolean} options.throwOnError - Throw error instead of returning false (default: false)
   * @returns {boolean} The result of the validation
   */
  validateJsonSchemaSync(folderName, fileName, body, options = {}) {
    const { createSchema = false, verbose = true, throwOnError = false } = options;
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    
    // Create schema if requested and doesn't exist
    if (createSchema && !fs.existsSync(schemaFilePath)) {
      if (verbose) {
        console.log(`Creating new schema: ${folderName}/${fileName}`);
      }
      
      // Generate schema synchronously
      let schema = generateSchema.json(body);
      schema['$schema'] = 'http://json-schema.org/draft-07/schema#';

      // If the input is an array of objects, scan ALL items for accurate nullable / format detection
      if (Array.isArray(body) && body.length > 0 && typeof body[0] === 'object') {
        const objectItems = body.filter((i) => i && typeof i === 'object' && !Array.isArray(i));
        const typeMap = this._mergeTypeInfo(objectItems);
        const requiredFields = this._getRequiredFields(objectItems);

        schema.items = {
          type: 'object',
          properties: typeMap,
          required: requiredFields,
        };
      } else if (!Array.isArray(body) && body && typeof body === 'object') {
        // Single object: enrich top-level properties with format detection
        this._enrichSchemaFormats(schema, body);
      }

      // Remove extra fields added by generate-schema that we don't need
      delete schema.uniqueItems;
      delete schema.description;
      if (schema.items && schema.items.description) delete schema.items.description;

      const schemaString = JSON.stringify(schema, null, 2);
      
      // Create directory if it doesn't exist
      const schemaDir = path.dirname(schemaFilePath);
      if (!fs.existsSync(schemaDir)) {
        fs.mkdirSync(schemaDir, { recursive: true });
      }
      
      // Write schema file synchronously
      fs.writeFileSync(schemaFilePath, schemaString);
      
      if (verbose) {
        console.log(`✓ JSON schema successfully created and saved.`);
        console.log(`  Location: ${schemaFilePath}`);
      }
    }
    
    try {
      const schemaFileContent = fs.readFileSync(schemaFilePath, 'utf8');
      const existingSchema = JSON.parse(schemaFileContent);
      
      const ajv = new Ajv({ allErrors: false });
      addFormats(ajv);
      const validate = ajv.compile(existingSchema);
      const validRes = validate(body);

      if (!validRes) {
        if (verbose) {
          console.error('\n✗ SCHEMA VALIDATION ERRORS:');
          console.error(`  Schema: ${folderName}/${fileName}`);
          console.error(`  File: ${schemaFilePath}`);
          console.error('');
          
          if (validate.errors && Array.isArray(validate.errors)) {
            validate.errors.forEach((err, index) => {
              // Build a more human-friendly message
              let errorPath = err.instancePath || '/';
              let expected = err.params && err.params.type ? err.params.type : '';
              let actual = '';
              
              if (errorPath && body) {
                // Try to get the actual value from the response
                const pathParts = errorPath.replace(/^\//, '').split('/');
                let val = body;
                for (const part of pathParts) {
                  if (part && val && typeof val === 'object') val = val[part];
                }
                actual = typeof val === 'undefined' ? 'undefined' : JSON.stringify(val);
              }
              
              console.error(`  ${index + 1}. At ${errorPath}: ${err.message}`);
              if (expected) console.error(`     Expected type: ${expected}`);
              if (actual) console.error(`     Actual value: ${actual}`);
              console.error('');
            });
          } else {
            console.error('  ', JSON.stringify(validate.errors));
          }
          
          // Optionally log the response body
          if (verbose && typeof body === 'object') {
            console.error('  Response sample (first 500 chars):');
            console.error('  ', JSON.stringify(body, null, 2).substring(0, 500) + '...');
          }
        }
        
        if (throwOnError) {
          throw new Error(`Schema validation failed for ${folderName}/${fileName}`);
        }
      } else {
        if (verbose) {
          console.log(`✓ Schema validation passed: ${folderName}/${fileName}`);
        }
      }
      
      return validRes;
    } catch (error) {
      if (verbose) {
        console.error('\n✗ Error loading or validating schema file:', error.message);
        console.error(`  Path: ${schemaFilePath}`);
      }
      
      if (throwOnError) {
        throw error;
      }
      
      return false;
    }
  }

  /**
   * Validates an object against a JSON schema (Asynchronous version).
   * @param {string} folderName - The path to the directory containing the JSON schema file
   * @param {string} fileName - The name of the JSON schema file (without _schema.json)
   * @param {object} body - The object to validate against the JSON schema
   * @param {object} options - Validation options
   * @param {boolean} options.createSchema - Whether to create the JSON schema if it doesn't exist
   * @param {boolean} options.verbose - Enable verbose error logging (default: true)
   * @param {boolean} options.throwOnError - Throw error instead of returning false (default: false)
   * @returns {Promise<boolean>} The result of the validation
   */
  async validateJsonSchema(folderName, fileName, body, options = {}) {
    const { createSchema = false, verbose = true, throwOnError = false } = options;
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    
    if (createSchema) {
      await this.createJsonSchema(folderName, fileName, body);
    }

    try {
      const schemaFileContent = await fsPromises.readFile(schemaFilePath, 'utf8');
      const existingSchema = JSON.parse(schemaFileContent);
      
      const ajv = new Ajv({ allErrors: false });
      addFormats(ajv);
      const validate = ajv.compile(existingSchema);
      const validRes = validate(body);

      if (!validRes) {
        if (verbose) {
          console.error('\n✗ SCHEMA VALIDATION ERRORS:');
          console.error(`  Schema: ${folderName}/${fileName}`);
          console.error(`  File: ${schemaFilePath}`);
          console.error('');
          
          if (validate.errors && Array.isArray(validate.errors)) {
            validate.errors.forEach((err, index) => {
              let errorPath = err.instancePath || '/';
              let expected = err.params && err.params.type ? err.params.type : '';
              let actual = '';
              
              if (errorPath && body) {
                const pathParts = errorPath.replace(/^\//, '').split('/');
                let val = body;
                for (const part of pathParts) {
                  if (part && val && typeof val === 'object') val = val[part];
                }
                actual = typeof val === 'undefined' ? 'undefined' : JSON.stringify(val);
              }
              
              console.error(`  ${index + 1}. At ${errorPath}: ${err.message}`);
              if (expected) console.error(`     Expected type: ${expected}`);
              if (actual) console.error(`     Actual value: ${actual}`);
              console.error('');
            });
          }
        }
        
        if (throwOnError) {
          throw new Error(`Schema validation failed for ${folderName}/${fileName}`);
        }
      } else {
        if (verbose) {
          console.log(`✓ Schema validation passed: ${folderName}/${fileName}`);
        }
      }
      
      return validRes;
    } catch (error) {
      if (verbose) {
        console.error('\n✗ Error loading or validating schema file:', error.message);
        console.error(`  Path: ${schemaFilePath}`);
      }
      
      if (throwOnError) {
        throw error;
      }
      
      return false;
    }
  }

  /**
   * Check if a schema file exists
   * @param {string} folderName - The folder name
   * @param {string} fileName - The schema file name (without _schema.json)
   * @returns {boolean} True if schema exists
   */
  schemaExists(folderName, fileName) {
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    return fs.existsSync(schemaFilePath);
  }

  /**
   * Get the full path to a schema file
   * @param {string} folderName - The folder name
   * @param {string} fileName - The schema file name (without _schema.json)
   * @returns {string} Full path to schema file
   */
  getSchemaPath(folderName, fileName) {
    return path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
  }
}

// Export the class and create a default instance
module.exports = SchemaValidator;

// Also export convenience functions for backward compatibility
module.exports.createValidator = (schemaBasePath) => new SchemaValidator(schemaBasePath);
