const Ajv = require('ajv').default || require('ajv');
const addFormats = require('ajv-formats');
const path = require('path');
const generateSchema = require('generate-schema');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { faker } = require('@faker-js/faker');
const yaml = require('js-yaml');
const { parse } = require('graphql');
const stringSimilarity = require('string-similarity');
const Benchmark = require('benchmark');
const { v4: uuidv4 } = require('uuid');

// Custom formats for AJV
const customFormats = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
  ipv4: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
  ipv6: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){0,6}::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/,
  uri: /^https?:\/\/.+/
};

// PII patterns for security validation
const piiPatterns = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
  phoneNumber: /\b\d{3}[-.)\s]?\d{3}[-.)\s]?\d{4}\b/,
  emailAddress: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
};

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
   * @param {object} [options] - Validator options
   * @param {boolean} [options.allErrors=true] - Collect all errors instead of stopping at first
   * @param {boolean} [options.verbose=true] - Enable verbose error messages
   * @param {boolean} [options.allowUnionTypes=false] - Allow union types in validation
   * @param {object} [options.customFormats] - Additional custom formats to add
   * @param {string} [options.environment] - Force specific environment (node/bruno)
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

  /**
   * Create a new SchemaValidator instance
   * @param {string} schemaPathOrFolderName - Path to schema directory or folder name (in Bruno)
   * @param {object} [options={}] - Configuration options
   * @param {boolean} [options.allErrors=false] - Collect all errors instead of failing on first
   * @param {boolean} [options.verbose=false] - Add extra information to errors
   * @param {boolean} [options.allowUnionTypes=false] - Allow union types in schemas
   * @param {object} [options.customFormats={}] - Custom format definitions
   * @param {object} [options.additionalFormats={}] - Additional predefined formats
   */
  constructor(schemaPathOrFolderName = 'api-schemas', options = {}) {
    // Auto-detect Bruno environment
    const isBrunoEnv = (typeof bru !== 'undefined' && typeof bru.cwd === 'function');
    
    if (isBrunoEnv) {
      this.schemaBasePath = `${bru.cwd()}/${schemaPathOrFolderName}`;
      this.environment = 'bruno';
    } else {
      if (schemaPathOrFolderName === 'api-schemas' && !fs.existsSync(schemaPathOrFolderName)) {
        throw new Error(
          'SchemaValidator: Running in Node.js environment.\n' +
          'Please provide the full path to your schema directory.\n' +
          'Example: new SchemaValidator("/absolute/path/to/schemas")\n' +
          'Example: new SchemaValidator(path.join(__dirname, "api-schemas"))'
        );
      }
      this.schemaBasePath = schemaPathOrFolderName;
      this.environment = 'node';
    }
    
    // Extract options with defaults
    const {
      allErrors = false,
      verbose = false,
      allowUnionTypes = false,
      customFormats = {},
      additionalFormats = {}
    } = options;
    
    // Performance optimization: Cache for compiled validators and schemas
    this._validatorCache = new Map();
    this._schemaCache = new Map();
    this.options = { allErrors, verbose, allowUnionTypes, customFormats, additionalFormats };
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
  validateJsonSchemaSync(folderNameOrSchema, fileNameOrData, body, options = {}) {
    // Inline mode: validateJsonSchemaSync(schema, data) when first arg is an object
    if (typeof folderNameOrSchema === 'object' && folderNameOrSchema !== null) {
      const schema = folderNameOrSchema;
      const data = fileNameOrData;
      const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
      addFormats(ajv);
      // Register custom formats from constructor options
      const allCustomFormats = { ...customFormats, ...(this.options && this.options.customFormats) };
      for (const [formatName, pattern] of Object.entries(allCustomFormats)) {
        ajv.addFormat(formatName, pattern instanceof RegExp ? { type: 'string', validate: (s) => pattern.test(s) } : pattern);
      }
      const validate = ajv.compile(schema);
      const valid = validate(data);
      return { valid, errors: valid ? null : validate.errors };
    }

    // File-based mode
    const folderName = folderNameOrSchema;
    const fileName = fileNameOrData;
    const { createSchema = false, verbose = true, throwOnError = false } = options;
    const cacheKey = `${folderName}/${fileName}`;
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
      
      // Clear cache for this schema since we just created it
      this._validatorCache.delete(cacheKey);
      this._schemaCache.delete(cacheKey);
    }
    
    try {
      // Check cache first
      let existingSchema = this._schemaCache.get(cacheKey);
      let validate = this._validatorCache.get(cacheKey);
      
      // Load and compile schema if not cached
      if (!existingSchema || !validate) {
        const schemaFileContent = fs.readFileSync(schemaFilePath, 'utf8');
        existingSchema = JSON.parse(schemaFileContent);
        this._schemaCache.set(cacheKey, existingSchema);
        
        const ajv = new Ajv({ allErrors: false });
        addFormats(ajv);
        const compiledValidator = ajv.compile(existingSchema);
        validate = compiledValidator;
        this._validatorCache.set(cacheKey, validate);
      }
      
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
    const cacheKey = `${folderName}/${fileName}`;
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    
    if (createSchema) {
      await this.createJsonSchema(folderName, fileName, body);
      // Clear cache for this schema since we just created/updated it
      this._validatorCache.delete(cacheKey);
      this._schemaCache.delete(cacheKey);
    }

    try {
      // Check cache first
      let existingSchema = this._schemaCache.get(cacheKey);
      let validate = this._validatorCache.get(cacheKey);
      
      // Load and compile schema if not cached
      if (!existingSchema || !validate) {
        const schemaFileContent = await fsPromises.readFile(schemaFilePath, 'utf8');
        existingSchema = JSON.parse(schemaFileContent);
        this._schemaCache.set(cacheKey, existingSchema);
        
        const ajv = new Ajv({ allErrors: false });
        addFormats(ajv);
        const compiledValidator = ajv.compile(existingSchema);
        validate = compiledValidator;
        this._validatorCache.set(cacheKey, validate);
      }
      
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

  /**
   * Clear all cached schemas and validators
   * Useful when schemas have been modified externally
   */
  clearCache() {
    this._validatorCache.clear();
    this._schemaCache.clear();
  }

  /**
   * Clear cache for a specific schema
   * @param {string} folderName - The folder name
   * @param {string} fileName - The schema file name (without _schema.json)
   */
  clearCacheForSchema(folderName, fileName) {
    const cacheKey = `${folderName}/${fileName}`;
    this._validatorCache.delete(cacheKey);
    this._schemaCache.delete(cacheKey);
  }

  /**
   * Get cache statistics
   * @returns {object} Object containing cache size information
   */
  getCacheStats() {
    return {
      validatorCacheSize: this._validatorCache.size,
      schemaCacheSize: this._schemaCache.size
    };
  }

  /**
   * FEATURE 1: Schema Evolution & Versioning
   * Compare two schemas and detect breaking/non-breaking changes
   * @param {object} oldSchema - The original schema
   * @param {object} newSchema - The new schema to compare
   * @returns {object} Comparison results with breaking and non-breaking changes
   */
  compareSchemas(oldSchema, newSchema) {
    const changes = {
      breaking: [],
      nonBreaking: [],
      recommendedVersionBump: 'patch'
    };

    // Check for removed required fields (breaking)
    if (oldSchema.properties && newSchema.properties) {
      const oldRequired = new Set(oldSchema.required || []);
      const newRequired = new Set(newSchema.required || []);
      
      // Fields removed from schema
      for (const field of Object.keys(oldSchema.properties)) {
        if (!newSchema.properties[field]) {
          if (oldRequired.has(field)) {
            changes.breaking.push({ type: 'required_field_removed', field });
          } else {
            changes.nonBreaking.push({ type: 'optional_field_removed', field });
          }
        }
      }

      // New required fields added (breaking)
      for (const field of newRequired) {
        if (!oldRequired.has(field) && newSchema.properties[field]) {
          changes.breaking.push({ type: 'required_field_added', field });
        }
      }

      // Type changes
      for (const field of Object.keys(newSchema.properties)) {
        if (oldSchema.properties[field]) {
          const oldType = oldSchema.properties[field].type;
          const newType = newSchema.properties[field].type;
          if (oldType !== newType) {
            changes.breaking.push({ type: 'type_changed', field, oldType, newType });
          }
        }
      }
    }

    // Determine version bump recommendation
    if (changes.breaking.length > 0) {
      changes.recommendedVersionBump = 'major';
    } else if (changes.nonBreaking.some(c => c.type === 'optional_field_added')) {
      changes.recommendedVersionBump = 'minor';
    }

    return changes;
  }

  /**
   * Track schema version in a version file
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {string} version - Semantic version string
   */
  trackSchemaVersion(nameOrFolder, schemaOrFile, version) {
    // Support inline mode: trackSchemaVersion(name, schema)
    if (typeof schemaOrFile === 'object' && schemaOrFile !== null) {
      if (!this._versionStore) this._versionStore = {};
      const name = nameOrFolder;
      const schema = schemaOrFile;
      if (!this._versionStore[name]) {
        this._versionStore[name] = { current: '1.0.0', history: [{ version: '1.0.0', timestamp: new Date().toISOString(), schema }] };
      } else {
        const prev = this._versionStore[name];
        const parts = prev.current.split('.').map(Number);
        parts[2]++;
        const newVersion = parts.join('.');
        prev.current = newVersion;
        prev.history.push({ version: newVersion, timestamp: new Date().toISOString(), schema });
      }
      return this._versionStore[name];
    }

    // File-based mode: trackSchemaVersion(folderName, fileName, version)
    const folderName = nameOrFolder;
    const fileName = schemaOrFile;
    const versionFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_versions.json`);
    let versions = [];
    
    if (fs.existsSync(versionFilePath)) {
      const content = fs.readFileSync(versionFilePath, 'utf8');
      versions = JSON.parse(content);
    }

    versions.push({
      version,
      timestamp: new Date().toISOString(),
      schema: this.getSchema(folderName, fileName)
    });

    fs.writeFileSync(versionFilePath, JSON.stringify(versions, null, 2));
    return versionFilePath;
  }

  /**
   * Get schema from cache or file
   * @private
   */
  getSchema(folderName, fileName) {
    const cacheKey = `${folderName}/${fileName}`;
    if (this._schemaCache.has(cacheKey)) {
      return this._schemaCache.get(cacheKey);
    }
    
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    if (fs.existsSync(schemaFilePath)) {
      const schema = JSON.parse(fs.readFileSync(schemaFilePath, 'utf8'));
      this._schemaCache.set(cacheKey, schema);
      return schema;
    }
    return null;
  }

  /**
   * FEATURE 2: Advanced Validation Options
   * Synchronous validation with advanced options
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {any} body - Data to validate
   * @param {object} options - Validation options
   * @returns {object} Validation result
   */
  validateSync(folderName, fileName, body, options = {}) {
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    
    if (!fs.existsSync(schemaFilePath)) {
      throw new Error(`Schema file not found: ${schemaFilePath}`);
    }

    const schemaContent = fs.readFileSync(schemaFilePath, 'utf8');
    const schema = JSON.parse(schemaContent);
    
    const ajvOptions = {
      allErrors: options.allErrors ?? this.options.allErrors ?? false,
      verbose: options.verbose ?? this.options.verbose ?? false,
      allowUnionTypes: options.allowUnionTypes ?? this.options.allowUnionTypes ?? true
    };

    const ajv = new Ajv(ajvOptions);
    addFormats(ajv);

    // Add custom formats
    const customFormatsToUse = { ...customFormats, ...this.options.customFormats, ...options.customFormats };
    for (const [formatName, pattern] of Object.entries(customFormatsToUse)) {
      ajv.addFormat(formatName, pattern instanceof RegExp ? pattern : new RegExp(pattern));
    }

    const validate = ajv.compile(schema);
    const valid = validate(body);

    return {
      valid,
      errors: valid ? null : validate.errors,
      schema: schema,
      data: body
    };
  }

  /**
   * FEATURE 3: Response Time & Performance Testing
   * Validate with performance constraints
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {any} body - Data to validate
   * @param {object} perfOptions - Performance options
   * @returns {Promise<object>} Validation result with performance metrics
   */
  async validateWithPerformance(folderName, fileName, body, perfOptions = {}) {
    const startTime = Date.now();
    
    const result = await this.validateJsonSchema(folderName, fileName, body, { verbose: false });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const responseSize = JSON.stringify(body).length;
    
    const maxResponseTime = perfOptions.maxResponseTime || Infinity;
    const maxResponseSize = perfOptions.maxResponseSize || Infinity;
    
    const perfValid = responseTime <= maxResponseTime && responseSize <= maxResponseSize;
    
    return {
      valid: result && perfValid,
      schemaValid: result,
      performanceValid: perfValid,
      responseTime,
      responseSize,
      maxResponseTime,
      maxResponseSize,
      errors: perfValid ? [] : [
        ...(responseTime > maxResponseTime ? [`Response time ${responseTime}ms exceeds limit ${maxResponseTime}ms`] : []),
        ...(responseSize > maxResponseSize ? [`Response size ${responseSize} bytes exceeds limit ${maxResponseSize} bytes`] : [])
      ]
    };
  }

  /**
   * FEATURE 4: Mock Data Generation
   * Generate mock data from schema
   * @param {object} schema - JSON schema
   * @param {object} options - Generation options
   * @returns {array|object} Generated mock data
   */
  generateMockData(schema, options = {}) {
    const count = options.count || 1;
    const locale = options.locale || 'en';
    const seed = options.seed;
    
    if (seed !== undefined) {
      faker.seed(seed);
    }
    
    if (faker.setLocale) {
      faker.setLocale(locale);
    } else if (faker.locale !== undefined) {
      faker.locale = locale;
    }
    
    const generateValue = (propSchema, propPath = '') => {
      if (!propSchema) return null;
      
      const type = propSchema.type || 'string';
      const format = propSchema.format;
      
      if (propSchema.enum && propSchema.enum.length > 0) {
        return faker.helpers.arrayElement(propSchema.enum);
      }
      
      if (propSchema.const !== undefined) {
        return propSchema.const;
      }
      
      switch (type) {
        case 'string':
          if (format === 'uuid' || propPath.toLowerCase().includes('id')) {
            return faker.string.uuid();
          }
          if (format === 'email' || propPath.toLowerCase().includes('email')) {
            return faker.internet.email();
          }
          if (format === 'date') {
            return faker.date.past().toISOString().split('T')[0];
          }
          if (format === 'date-time') {
            return faker.date.past().toISOString();
          }
          if (format === 'uri' || propPath.toLowerCase().includes('url')) {
            return faker.internet.url();
          }
          if (propPath.toLowerCase().includes('name')) {
            return faker.person.fullName();
          }
          return faker.lorem.sentence();
          
        case 'number':
        case 'integer':
          const min = propSchema.minimum || 0;
          const max = propSchema.maximum || 1000;
          return type === 'integer' 
            ? faker.number.int({ min, max }) 
            : faker.number.float({ min, max });
            
        case 'boolean':
          return faker.datatype.boolean();
          
        case 'array':
          const arrayLength = faker.number.int({ min: 1, max: 5 });
          if (propSchema.items) {
            return Array.from({ length: arrayLength }, (_, i) => 
              generateValue(propSchema.items, `${propPath}[${i}]`)
            );
          }
          return [];
          
        case 'object':
          if (!propSchema.properties) return {};
          const obj = {};
          for (const [key, value] of Object.entries(propSchema.properties)) {
            obj[key] = generateValue(value, `${propPath}.${key}`);
          }
          return obj;
          
        case 'null':
          return null;
          
        default:
          return null;
      }
    };
    
    const results = [];
    for (let i = 0; i < count; i++) {
      if (schema.type === 'array' && schema.items) {
        const arrayLength = faker.number.int({ min: 1, max: 5 });
        const arr = Array.from({ length: arrayLength }, (_, j) => 
          generateValue(schema.items, `item[${j}]`)
        );
        results.push(arr);
      } else {
        results.push(generateValue(schema, 'root'));
      }
    }
    
    return count === 1 ? results[0] : results;
  }

  /**
   * FEATURE 5: OpenAPI/Swagger Contract Testing
   * Convert OpenAPI spec to JSON Schema
   * @param {string|object} openApiSpec - OpenAPI specification (YAML string, JSON string, or object)
   * @returns {object} Converted JSON schemas
   */
  openApiToJsonSchema(openApiSpec) {
    let spec;
    
    if (typeof openApiSpec === 'string') {
      try {
        spec = yaml.load(openApiSpec);
      } catch (e) {
        spec = JSON.parse(openApiSpec);
      }
    } else {
      spec = openApiSpec;
    }
    
    const schemas = {};
    
    if (spec.components && spec.components.schemas) {
      for (const [name, schema] of Object.entries(spec.components.schemas)) {
        schemas[name] = this._convertOpenApiSchema(schema);
      }
    }
    
    if (spec.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            if (operation.requestBody && operation.requestBody.content) {
              const contentTypes = Object.keys(operation.requestBody.content);
              for (const contentType of contentTypes) {
                const mediaType = operation.requestBody.content[contentType];
                if (mediaType.schema) {
                  const key = `${method.toUpperCase()}${path.replace(/{/g, '_').replace(/}/g, '')}_request`;
                  schemas[key] = this._convertOpenApiSchema(mediaType.schema);
                }
              }
            }
            
            if (operation.responses) {
              for (const [statusCode, response] of Object.entries(operation.responses)) {
                if (response.content) {
                  const contentTypes = Object.keys(response.content);
                  for (const contentType of contentTypes) {
                    const mediaType = response.content[contentType];
                    if (mediaType.schema) {
                      const key = `${method.toUpperCase()}${path.replace(/{/g, '_').replace(/}/g, '')}_${statusCode}_response`;
                      schemas[key] = this._convertOpenApiSchema(mediaType.schema);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return schemas;
  }

  /**
   * Convert OpenAPI schema to JSON Schema
   * @private
   */
  _convertOpenApiSchema(openApiSchema) {
    const schema = { ...openApiSchema };
    
    // OpenAPI 3.0 uses nullable instead of type array with null
    if (schema.nullable) {
      if (schema.type) {
        schema.type = [schema.type, 'null'];
      }
      delete schema.nullable;
    }
    
    // Recursively convert nested schemas
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        schema.properties[key] = this._convertOpenApiSchema(value);
      }
    }
    
    if (schema.items) {
      schema.items = this._convertOpenApiSchema(schema.items);
    }
    
    if (schema.allOf) {
      schema.allOf = schema.allOf.map(s => this._convertOpenApiSchema(s));
    }
    
    if (schema.oneOf) {
      schema.oneOf = schema.oneOf.map(s => this._convertOpenApiSchema(s));
    }
    
    if (schema.anyOf) {
      schema.anyOf = schema.anyOf.map(s => this._convertOpenApiSchema(s));
    }
    
    return schema;
  }

  /**
   * FEATURE 6: Differential Validation (Snapshots)
   * Create snapshot of data for comparison
   * @param {string} snapshotName - Name for the snapshot
   * @param {any} data - Data to snapshot
   * @param {array} ignoreFields - Fields to ignore in comparison
   * @returns {string} Snapshot file path
   */
  snapshot(nameOrCategory, dataOrName, ignoreFieldsOrData, optionsArg) {
    let snapshotName, data, ignoreFields;

    // Support (category, name, data, options) signature
    if (typeof dataOrName === 'string') {
      snapshotName = `${nameOrCategory}-${dataOrName}`;
      data = ignoreFieldsOrData;
      ignoreFields = (optionsArg && optionsArg.ignoreFields) || [];
    } else {
      // Original (name, data, ignoreFields) signature
      snapshotName = nameOrCategory;
      data = dataOrName;
      ignoreFields = Array.isArray(ignoreFieldsOrData) ? ignoreFieldsOrData : [];
    }

    const snapshotDir = path.join(process.cwd(), 'snapshots');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    
    const snapshotFile = path.join(snapshotDir, `${snapshotName}.json`);
    
    // Remove ignored fields
    const filteredData = this._filterFields(data, ignoreFields);
    
    const existed = fs.existsSync(snapshotFile);
    fs.writeFileSync(snapshotFile, JSON.stringify(filteredData, null, 2));
    return { created: !existed, matched: existed, path: snapshotFile };
  }

  /**
   * Validate data against snapshot
   * @param {string} snapshotName - Name of the snapshot
   * @param {any} data - Data to validate
   * @param {array} ignoreFields - Fields to ignore in comparison
   * @returns {object} Comparison result
   */
  validateSnapshot(nameOrCategory, dataOrName, ignoreFieldsOrData, optionsArg) {
    let snapshotName, data, ignoreFields;

    // Support (category, name, data, options) signature
    if (typeof dataOrName === 'string') {
      snapshotName = `${nameOrCategory}-${dataOrName}`;
      data = ignoreFieldsOrData;
      ignoreFields = (optionsArg && optionsArg.ignoreFields) || [];
    } else {
      // Original (name, data, ignoreFields) signature
      snapshotName = nameOrCategory;
      data = dataOrName;
      ignoreFields = Array.isArray(ignoreFieldsOrData) ? ignoreFieldsOrData : [];
    }

    const snapshotDir = path.join(process.cwd(), 'snapshots');
    const snapshotFile = path.join(snapshotDir, `${snapshotName}.json`);
    
    if (!fs.existsSync(snapshotFile)) {
      return { valid: false, matched: false, error: `Snapshot not found: ${snapshotFile}` };
    }
    
    const snapshotData = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    const filteredData = this._filterFields(data, ignoreFields);
    
    const differences = [];
    const isValid = this._compareObjects(snapshotData, filteredData, differences, '');
    
    return {
      valid: isValid,
      matched: isValid,
      differences,
      snapshot: snapshotData,
      actual: filteredData
    };
  }

  /**
   * Filter out ignored fields from data
   * @private
   */
  _filterFields(data, ignoreFields) {
    if (!ignoreFields || ignoreFields.length === 0) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this._filterFields(item, ignoreFields));
    }
    
    if (typeof data === 'object' && data !== null) {
      const filtered = {};
      for (const [key, value] of Object.entries(data)) {
        if (!ignoreFields.includes(key) && !ignoreFields.some(f => f.startsWith(`${key}.`))) {
          filtered[key] = this._filterFields(value, ignoreFields);
        }
      }
      return filtered;
    }
    
    return data;
  }

  /**
   * Compare objects recursively
   * @private
   */
  _compareObjects(expected, actual, differences, path) {
    if (typeof expected !== typeof actual) {
      differences.push({ path: path || 'root', expected: typeof expected, actual: typeof actual });
      return false;
    }
    
    if (expected === null || actual === null) {
      if (expected !== actual) {
        differences.push({ path: path || 'root', expected, actual });
        return false;
      }
      return true;
    }
    
    if (typeof expected !== 'object') {
      if (expected !== actual) {
        differences.push({ path: path || 'root', expected, actual });
        return false;
      }
      return true;
    }
    
    if (Array.isArray(expected) !== Array.isArray(actual)) {
      differences.push({ path: path || 'root', expected: 'array', actual: 'array' });
      return false;
    }
    
    if (Array.isArray(expected)) {
      if (expected.length !== actual.length) {
        differences.push({ path: path || 'root', expected: expected.length, actual: actual.length });
        return false;
      }
      let allMatch = true;
      for (let i = 0; i < expected.length; i++) {
        allMatch = this._compareObjects(expected[i], actual[i], differences, `${path}[${i}]`) && allMatch;
      }
      return allMatch;
    }
    
    const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    let allMatch = true;
    
    for (const key of allKeys) {
      if (!(key in expected)) {
        differences.push({ path: `${path}.${key}`, expected: 'undefined', actual: 'present' });
        allMatch = false;
      } else if (!(key in actual)) {
        differences.push({ path: `${path}.${key}`, expected: 'present', actual: 'undefined' });
        allMatch = false;
      } else {
        allMatch = this._compareObjects(expected[key], actual[key], differences, `${path}.${key}`) && allMatch;
      }
    }
    
    return allMatch;
  }

  /**
   * FEATURE 7: Environment-Specific Validation
   * Register schema for specific environment
   * @param {string} env - Environment name (dev, test, prod, etc.)
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {string} schemaPath - Path to environment-specific schema
   */
  registerEnvironmentSchema(nameOrEnv, envOrFolder, schemaOrFileName, schemaPathArg) {
    if (!this._envSchemas) {
      this._envSchemas = {};
    }

    // Support inline mode: registerEnvironmentSchema(name, env, schema)
    if (typeof schemaOrFileName === 'object' && schemaOrFileName !== null) {
      const name = nameOrEnv;
      const env = envOrFolder;
      const schema = schemaOrFileName;
      const key = `${name}:${env}`;
      this._envSchemas[key] = schema;
      return true;
    }

    // File-based mode: registerEnvironmentSchema(env, folderName, fileName, schemaPath)
    const env = nameOrEnv;
    const folderName = envOrFolder;
    const fileName = schemaOrFileName;
    const schemaPath = schemaPathArg;
    const key = `${env}:${folderName}/${fileName}`;
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    this._envSchemas[key] = schema;
    return true;
  }

  /**
   * Retrieve a registered environment schema
   * @param {string} name - Schema name
   * @param {string} env - Environment name
   * @returns {object|null} The schema or null
   */
  getEnvironmentSchema(name, env) {
    if (!this._envSchemas) return null;
    const key = `${name}:${env}`;
    return this._envSchemas[key] || null;
  }

  /**
   * Validate using environment-specific schema
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {any} body - Data to validate
   * @param {string} env - Environment (defaults to NODE_ENV)
   * @returns {object} Validation result
   */
  validateWithEnvironment(folderName, fileName, body, env = process.env.NODE_ENV || 'development') {
    const key = `${env}:${folderName}/${fileName}`;
    
    if (this._envSchemas && this._envSchemas[key]) {
      const schema = this._envSchemas[key];
      const ajv = new Ajv({ allErrors: true });
      addFormats(ajv);
      const validate = ajv.compile(schema);
      const valid = validate(body);
      
      return {
        valid,
        errors: valid ? null : validate.errors,
        environment: env,
        usedEnvironmentSchema: true
      };
    }
    
    // Fallback to default schema
    return this.validateSync(folderName, fileName, body);
  }

  /**
   * FEATURE 9: Request Validation
   * Validate request body, headers, and query parameters
   * @param {object} request - Request object with body, headers, query
   * @param {object} schemas - Schema definitions for body, headers, query
   * @returns {object} Validation result
   */
  validateRequest(request, schemas = {}) {
    const results = {
      body: { valid: true, errors: null },
      headers: { valid: true, errors: null },
      query: { valid: true, errors: null },
      valid: true
    };
    
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    
    if (schemas.body && request.body) {
      const validate = ajv.compile(schemas.body);
      const valid = validate(request.body);
      results.body = { valid, errors: valid ? null : validate.errors };
      results.valid = results.valid && valid;
    }
    
    if (schemas.headers && request.headers) {
      const validate = ajv.compile(schemas.headers);
      const valid = validate(request.headers);
      results.headers = { valid, errors: valid ? null : validate.errors };
      results.valid = results.valid && valid;
    }
    
    if (schemas.query && request.query) {
      const validate = ajv.compile(schemas.query);
      const valid = validate(request.query);
      results.query = { valid, errors: valid ? null : validate.errors };
      results.valid = results.valid && valid;
    }
    
    return results;
  }

  /**
   * FEATURE 10: Automated Documentation Generation
   * Generate API documentation in markdown format
   * @param {string} folderName - Folder name
   * @param {string} outputDir - Output directory for docs
   * @returns {string} Path to generated documentation
   */
  generateDocumentation(titleOrFolder, schemaOrOutputDir, options) {
    // Inline mode: generateDocumentation(title, schema, options)
    if (typeof schemaOrOutputDir === 'object' && schemaOrOutputDir !== null && !Array.isArray(schemaOrOutputDir)) {
      const title = titleOrFolder;
      const schema = schemaOrOutputDir;
      const opts = options || {};

      let docContent = `# ${title}\n\n`;
      if (opts.endpoint) docContent += `**Endpoint:** \`${opts.method || 'GET'} ${opts.endpoint}\`\n\n`;

      if (schema.properties) {
        docContent += `## Properties\n\n`;
        docContent += `| Field | Type | Required | Description |\n`;
        docContent += `|-------|------|----------|-------------|\n`;
        const required = schema.required || [];
        for (const [key, value] of Object.entries(schema.properties)) {
          const type = Array.isArray(value.type) ? value.type.join(' | ') : (value.type || 'any');
          const isRequired = required.includes(key) ? 'Yes' : 'No';
          const desc = value.description || '-';
          docContent += `| ${key} | ${type} | ${isRequired} | ${desc} |\n`;
        }
        docContent += `\n`;
      }

      if (opts.examples && opts.examples.length > 0) {
        docContent += `## Examples\n\n`;
        docContent += `\`\`\`json\n${JSON.stringify(opts.examples[0], null, 2)}\n\`\`\`\n\n`;
      }

      return docContent;
    }

    // File-based mode: generateDocumentation(folderName, outputDir)
    const folderName = titleOrFolder;
    const outputDir = schemaOrOutputDir || './docs';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const folderPath = path.join(this.schemaBasePath, folderName);
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder not found: ${folderPath}`);
    }
    
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('_schema.json'));
    let docContent = `# API Documentation - ${folderName}\n\n`;
    docContent += `Generated on: ${new Date().toISOString()}\n\n`;
    docContent += `## Schemas\n\n`;
    
    for (const file of files) {
      const schemaPath = path.join(folderPath, file);
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const schemaName = file.replace('_schema.json', '');
      
      docContent += `### ${schemaName}\n\n`;
      docContent += `**Description:** ${schema.description || 'No description'}\n\n`;
      
      if (schema.properties) {
        docContent += `**Properties:**\n\n`;
        docContent += `| Field | Type | Required | Description |\n`;
        docContent += `|-------|------|----------|-------------|\n`;
        
        const required = schema.required || [];
        for (const [key, value] of Object.entries(schema.properties)) {
          const type = Array.isArray(value.type) ? value.type.join(' \\| ') : (value.type || 'any');
          const isRequired = required.includes(key) ? 'Yes' : 'No';
          const desc = value.description || '-';
          docContent += `| ${key} | ${type} | ${isRequired} | ${desc} |\n`;
        }
        docContent += `\n`;
      }
      
      if (schema.example) {
        docContent += `**Example:**\n\n`;
        docContent += `\`\`\`json\n${JSON.stringify(schema.example, null, 2)}\n\`\`\`\n\n`;
      }
    }
    
    const outputFile = path.join(outputDir, `${folderName}.md`);
    fs.writeFileSync(outputFile, docContent);
    
    return outputFile;
  }

  /**
   * FEATURE 11: CI/CD Integration - Console Report
   * Print test results to console
   * @param {array} testResults - Array of test results
   */
  printConsoleReport(testResults) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST REPORT');
    console.log('='.repeat(60));
    
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    
    console.log(`Total: ${testResults.length} | Passed: ${passed} ✓ | Failed: ${failed} ✗\n`);
    
    if (failed > 0) {
      console.log('Failed Tests:');
      testResults.filter(r => !r.passed).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name}`);
        console.log(`     Error: ${result.error}\n`);
      });
    }
    
    console.log('='.repeat(60));
  }

  /**
   * Generate JUnit XML report
   * @param {array} testResults - Array of test results
   * @param {string} outputFile - Output file path
   * @returns {string} Path to generated report
   */
  generateJUnitReport(testResults, outputFile = './reports/junit.xml') {
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuite name="api-schema-validator" tests="${testResults.length}" failures="${failed}" skipped="0">\n`;
    
    testResults.forEach(result => {
      xml += `  <testcase name="${result.name}" classname="${result.suite || 'default'}" time="${result.duration || 0}">\n`;
      if (!result.passed) {
        xml += `    <failure message="${result.error || 'Validation failed'}">\n`;
        xml += `      <![CDATA[${result.stack || result.error}]]>\n`;
        xml += `    </failure>\n`;
      }
      xml += `  </testcase>\n`;
    });
    
    xml += `</testsuite>\n`;
    
    fs.writeFileSync(outputFile, xml);
    return xml;
  }

  /**
   * Generate HTML report
   * @param {array} testResults - Array of test results
   * @param {string} outputFile - Output file path
   * @returns {string} Path to generated report
   */
  generateHTMLReport(testResults, outputFile = './reports/report.html') {
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>API Schema Validator Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px; }
    .pass { color: green; }
    .fail { color: red; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .error { color: red; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>API Schema Validator Test Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p>Total: ${testResults.length} | <span class="pass">Passed: ${passed}</span> | <span class="fail">Failed: ${failed}</span></p>
    <p>Generated: ${new Date().toISOString()}</p>
  </div>
  <table>
    <tr>
      <th>Test Name</th>
      <th>Status</th>
      <th>Duration (ms)</th>
      <th>Error</th>
    </tr>`;
    
    testResults.forEach(result => {
      const statusClass = result.passed ? 'pass' : 'fail';
      const statusText = result.passed ? 'PASS' : 'FAIL';
      html += `
    <tr>
      <td>${result.name}</td>
      <td class="${statusClass}">${statusText}</td>
      <td>${result.duration || 0}</td>
      <td class="error">${result.error || '-'}</td>
    </tr>`;
    });
    
    html += `
  </table>
</body>
</html>`;
    
    fs.writeFileSync(outputFile, html);
    return html;
  }

  /**
   * FEATURE 12: Schema Migration
   * Migrate schema with transformation rules
   * @param {object} schema - Original schema
   * @param {array} transformations - Array of transformation rules
   * @returns {object} Migrated schema
   */
  migrateSchema(schema, transformations = []) {
    const migrated = JSON.parse(JSON.stringify(schema)); // Deep clone
    
    for (const transform of transformations) {
      switch (transform.type) {
        case 'rename_field':
        case 'rename':
          const oldName = transform.oldName || transform.from;
          const newName = transform.newName || transform.to;
          if (migrated.properties && migrated.properties[oldName]) {
            migrated.properties[newName] = migrated.properties[oldName];
            delete migrated.properties[oldName];
            
            if (migrated.required) {
              const idx = migrated.required.indexOf(oldName);
              if (idx !== -1) {
                migrated.required[idx] = newName;
              }
            }
          }
          break;
          
        case 'add_field':
          if (!migrated.properties) migrated.properties = {};
          migrated.properties[transform.name] = transform.schema;
          if (transform.required) {
            if (!migrated.required) migrated.required = [];
            if (!migrated.required.includes(transform.name)) {
              migrated.required.push(transform.name);
            }
          }
          break;
          
        case 'remove_field':
          if (migrated.properties && migrated.properties[transform.name]) {
            delete migrated.properties[transform.name];
            if (migrated.required) {
              migrated.required = migrated.required.filter(f => f !== transform.name);
            }
          }
          break;
          
        case 'change_type':
          if (migrated.properties && migrated.properties[transform.name]) {
            migrated.properties[transform.name].type = transform.newType;
          }
          break;
          
        case 'add_format':
          if (migrated.properties && migrated.properties[transform.name]) {
            migrated.properties[transform.name].format = transform.format;
          }
          break;
          
        case 'update_description':
          if (migrated.properties && migrated.properties[transform.name]) {
            migrated.properties[transform.name].description = transform.description;
          }
          break;
      }
    }
    
    return migrated;
  }

  /**
   * FEATURE 13: Fuzzy Matching & Tolerance
   * Validate with tolerance for minor differences
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {any} body - Data to validate
   * @param {object} toleranceOptions - Tolerance settings
   * @returns {object} Validation result with tolerance
   */
  validateWithTolerance(schemaOrFolder, bodyOrFile, toleranceOrBody, toleranceOptions) {
    let schema, body, toleranceOpts;

    // Inline mode: validateWithTolerance(schema, data, toleranceOptions)
    if (typeof schemaOrFolder === 'object' && schemaOrFolder !== null) {
      schema = schemaOrFolder;
      body = bodyOrFile;
      toleranceOpts = toleranceOrBody || {};
    } else {
      // File-based mode: validateWithTolerance(folderName, fileName, body, toleranceOptions)
      const schemaFilePath = path.join(this.schemaBasePath, schemaOrFolder, `${bodyOrFile}_schema.json`);
      if (!fs.existsSync(schemaFilePath)) {
        throw new Error(`Schema file not found: ${schemaFilePath}`);
      }
      schema = JSON.parse(fs.readFileSync(schemaFilePath, 'utf8'));
      body = toleranceOrBody;
      toleranceOpts = toleranceOptions || {};
    }

    const {
      allowExtraFields = false,
      numericTolerance = 0,
      stringSimilarityThreshold = 1.0,
      ignoreMissingOptional = false
    } = toleranceOpts;
    
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    
    // Modify schema based on tolerance options
    const modifiedSchema = { ...schema };
    
    if (allowExtraFields && modifiedSchema.type === 'object') {
      modifiedSchema.additionalProperties = true;
    }
    
    const validate = ajv.compile(modifiedSchema);
    let valid = validate(body);
    const errors = valid ? null : validate.errors;
    
    // Apply fuzzy matching for strings
    if (!valid && errors) {
      const fuzzyErrors = errors.filter(err => {
        if (err.keyword === 'type' && err.params?.type === 'string') {
          const instancePath = err.instancePath.slice(1) || 'root';
          const parts = instancePath.split('/');
          let expectedValue = schema;
          for (const part of parts) {
            if (part && expectedValue?.properties) {
              expectedValue = expectedValue.properties[part];
            }
          }
          
          if (expectedValue && typeof body === 'object') {
            const actualValue = this._getValueByPath(body, instancePath);
            if (typeof actualValue === 'string' && typeof expectedValue === 'object') {
              // String similarity check could be applied here
              return false; // Don't report as error if within threshold
            }
          }
        }
        return true;
      });
      
      valid = fuzzyErrors.length === 0;
    }
    
    return {
      valid,
      errors,
      toleranceApplied: {
        allowExtraFields,
        numericTolerance,
        stringSimilarityThreshold,
        ignoreMissingOptional
      }
    };
  }

  /**
   * Get value by path
   * @private
   */
  _getValueByPath(obj, path) {
    if (!path || path === 'root') return obj;
    const parts = path.split('/');
    let current = obj;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * FEATURE 14: Batch Validation
   * Validate multiple endpoints/responses simultaneously
   * @param {array} validations - Array of validation requests
   * @param {object} options - Batch options including concurrency
   * @returns {Promise<array>} Array of validation results
   */
  async batchValidate(validations, options = {}) {
    const concurrency = options.concurrency || 5;
    const results = [];
    
    // Process in batches
    for (let i = 0; i < validations.length; i += concurrency) {
      const batch = validations.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (validation) => {
          const startTime = Date.now();
          try {
            const result = await this.validateJsonSchema(
              validation.folderName || validation.folder,
              validation.fileName || validation.name,
              validation.body || validation.data,
              validation.options || {}
            );
            return {
              ...validation,
              passed: !!result,
              duration: Date.now() - startTime
            };
          } catch (error) {
            return {
              ...validation,
              passed: false,
              error: error.message,
              duration: Date.now() - startTime
            };
          }
        })
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * FEATURE 15: Runtime Schema Modification
   * Dynamically modify schema at runtime
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {array} modifications - Array of modification operations
   * @returns {object} Modified schema
   */
  modifySchema(schemaOrFolder, modsOrFile, modifications) {
    let schema, mods;

    // Inline mode: modifySchema(schema, modificationsObject)
    if (typeof schemaOrFolder === 'object' && schemaOrFolder !== null && !Array.isArray(schemaOrFolder)) {
      schema = JSON.parse(JSON.stringify(schemaOrFolder)); // Deep clone
      const modsInput = modsOrFile || {};

      // Support object-style modifications: { addRequired, removeRequired, addPattern }
      if (!Array.isArray(modsInput)) {
        mods = [];
        if (modsInput.addRequired) {
          for (const field of modsInput.addRequired) {
            mods.push({ operation: 'add_required', field });
          }
        }
        if (modsInput.removeRequired) {
          for (const field of modsInput.removeRequired) {
            mods.push({ operation: 'remove_required', field });
          }
        }
        if (modsInput.addPattern) {
          const p = modsInput.addPattern;
          mods.push({ operation: 'add_pattern', field: p.field, pattern: p.pattern });
        }
        if (modsInput.addProperty) {
          mods.push({ operation: 'add_property', name: modsInput.addProperty.name, schema: modsInput.addProperty.schema });
        }
        if (modsInput.removeProperty) {
          mods.push({ operation: 'remove_property', name: modsInput.removeProperty });
        }
      } else {
        mods = modsInput;
      }
    } else {
      // File-based mode: modifySchema(folderName, fileName, modifications)\n      const folderName = schemaOrFolder;
      const fileName = modsOrFile;
      schema = this.getSchema(folderName, fileName);
      if (!schema) {
        throw new Error(`Schema not found: ${folderName}/${fileName}`);
      }
      schema = JSON.parse(JSON.stringify(schema)); // Deep clone
      mods = modifications || [];
    }

    const modified = schema;
    
    for (const mod of mods) {
      switch (mod.operation) {
        case 'add_required':
          if (!modified.required) modified.required = [];
          if (!modified.required.includes(mod.field)) {
            modified.required.push(mod.field);
          }
          break;
          
        case 'remove_required':
          if (modified.required) {
            modified.required = modified.required.filter(f => f !== mod.field);
          }
          break;
          
        case 'add_pattern':
          if (modified.properties && modified.properties[mod.field]) {
            modified.properties[mod.field].pattern = mod.pattern;
          }
          break;
          
        case 'remove_pattern':
          if (modified.properties && modified.properties[mod.field]) {
            delete modified.properties[mod.field].pattern;
          }
          break;
          
        case 'update_enum':
          if (modified.properties && modified.properties[mod.field]) {
            modified.properties[mod.field].enum = mod.values;
          }
          break;
          
        case 'add_property':
          if (!modified.properties) modified.properties = {};
          modified.properties[mod.name] = mod.schema;
          break;
          
        case 'remove_property':
          if (modified.properties && modified.properties[mod.name]) {
            delete modified.properties[mod.name];
          }
          break;
      }
    }
    
    return modified;
  }

  /**
   * FEATURE 16: Security Validation
   * Validate security aspects of data
   * @param {any} data - Data to check
   * @param {object} options - Security check options
   * @returns {object} Security validation result
   */
  validateSecurity(data, options = {}) {
    const {
      checkPII = true,
      complianceStandard = null, // 'GDPR', 'HIPAA', etc.
      sensitiveFields = []
    } = options;
    
    const issues = [];
    const piiFound = [];
    
    const scanForPII = (obj, path = '') => {
      if (typeof obj === 'string') {
        for (const [type, pattern] of Object.entries(piiPatterns)) {
          if (pattern.test(obj)) {
            const issue = { type, path: path || 'root', value: obj.substring(0, 10) + '...' };
            piiFound.push(issue);
            issues.push(`Potential ${type} detected at ${path || 'root'}`);
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const newPath = path ? `${path}.${key}` : key;
          
          // Check field names for sensitive patterns
          const sensitivePatterns = ['password', 'secret', 'token', 'api_key', 'apikey', 'ssn', 'creditcard'];
          if (sensitivePatterns.some(p => key.toLowerCase().includes(p))) {
            issues.push(`Sensitive field "${key}" found at ${newPath}`);
          }
          
          scanForPII(value, newPath);
        }
      }
    };
    
    scanForPII(data);
    
    // Compliance checks
    const complianceIssues = [];
    if (complianceStandard === 'GDPR') {
      if (piiFound.length > 0) {
        complianceIssues.push('GDPR: Personal data detected - ensure proper consent and processing basis');
      }
    } else if (complianceStandard === 'HIPAA') {
      if (piiFound.some(p => p.type === 'ssn' || p.type === 'phoneNumber')) {
        complianceIssues.push('HIPAA: Protected health information identifiers detected');
      }
    }
    
    return {
      secure: issues.length === 0,
      hasPII: piiFound.length > 0,
      piiFields: piiFound,
      issues,
      piiFound,
      complianceChecks: complianceIssues,
      complianceIssues,
      complianceStandard
    };
  }

  /**
   * FEATURE 17: Performance Benchmarking
   * Benchmark validation performance
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {any} sampleData - Sample data for benchmarking
   * @param {object} options - Benchmark options
   * @returns {Promise<object>} Benchmark results
   */
  benchmarkValidation(schemaOrFolder, dataOrFile, optionsOrData, optionsArg) {
    let schema, data, options;

    // Inline mode: benchmarkValidation(schema, data, options)
    if (typeof schemaOrFolder === 'object' && schemaOrFolder !== null) {
      schema = schemaOrFolder;
      data = dataOrFile;
      options = optionsOrData || {};

      const iterations = options.iterations || 100;
      const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
      addFormats(ajv);
      const validate = ajv.compile(schema);
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        validate(data);
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1e6);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const opsPerSec = 1000 / avg;

      return {
        iterations,
        averageTime: avg,
        minTime: min,
        maxTime: max,
        opsPerSec,
        averageMs: avg.toFixed(3),
        minMs: min.toFixed(3),
        maxMs: max.toFixed(3),
        opsPerSecond: opsPerSec.toFixed(2),
        times
      };
    }

    // File-based mode (async): benchmarkValidation(folderName, fileName, sampleData, options)
    const folderName = schemaOrFolder;
    const fileName = dataOrFile;
    const sampleData = optionsOrData;
    options = optionsArg || {};
    const iterations = options.iterations || 100;
    const times = [];

    return (async () => {
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await this.validateJsonSchema(folderName, fileName, sampleData, { verbose: false });
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1e6);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const opsPerSec = 1000 / avg;

      return {
        iterations,
        averageTime: avg,
        minTime: min,
        maxTime: max,
        opsPerSec,
        averageMs: avg.toFixed(3),
        minMs: min.toFixed(3),
        maxMs: max.toFixed(3),
        opsPerSecond: opsPerSec.toFixed(2),
        times
      };
    })();
  }

  /**
   * Measure validation performance (synchronous)
   */
  measurePerformance(folderName, fileName, data) {
    const start = process.hrtime.bigint();
    const result = this.validateJsonSchemaSync(folderName, fileName, data, { verbose: false });
    const end = process.hrtime.bigint();
    
    const durationNs = Number(end - start);
    const durationMs = durationNs / 1e6;
    
    return {
      valid: !!result,
      validationTime: durationMs,
      durationNs,
      durationMs: durationMs.toFixed(3),
      opsPerSecond: (1000 / durationMs).toFixed(2)
    };
  }
}

// Export the class and create a default instance
module.exports = SchemaValidator;

// Also export convenience functions for backward compatibility
module.exports.createValidator = (schemaBasePath) => new SchemaValidator(schemaBasePath);
