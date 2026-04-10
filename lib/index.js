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
    this._snapshotCache = new Map();
    
    // AJV configuration
    this.ajvOptions = {
      allErrors,
      verbose,
      allowUnionTypes,
      strict: false
    };
    
    // Initialize AJV instance
    this.ajv = new Ajv(this.ajvOptions);
    
    // Register custom formats
    this._registerCustomFormats({ ...customFormats, ...additionalFormats });
    
    // Schema versioning
    this._schemaVersions = new Map();
    
    // Environment-specific schemas
    this._environmentSchemas = {};
  }
  
  /**
   * Register custom formats with AJV
   * @private
   */
  _registerCustomFormats(formats) {
    Object.entries(formats).forEach(([name, pattern]) => {
      if (pattern instanceof RegExp) {
        this.ajv.addFormat(name, pattern);
      } else if (typeof pattern === 'function') {
        this.ajv.addFormat(name, pattern);
      }
    });
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

  // ==================== FEATURE 1: Schema Evolution & Versioning ====================
  
  /**
   * Compare two schemas and detect breaking/non-breaking changes
   * @param {object} oldSchema - The original schema
   * @param {object} newSchema - The new schema to compare
   * @returns {object} Comparison result with breaking and non-breaking changes
   */
  compareSchemas(oldSchema, newSchema) {
    const breakingChanges = [];
    const nonBreakingChanges = [];
    
    const oldProps = oldSchema.properties || {};
    const newProps = newSchema.properties || {};
    const oldRequired = oldSchema.required || [];
    const newRequired = newSchema.required || [];
    
    // Check for removed required fields (breaking)
    oldRequired.forEach(field => {
      if (!newRequired.includes(field) && !newProps[field]) {
        breakingChanges.push({
          type: 'REQUIRED_FIELD_REMOVED',
          field,
          message: `Required field '${field}' was removed`
        });
      }
    });
    
    // Check for newly required fields (breaking)
    newRequired.forEach(field => {
      if (!oldRequired.includes(field) && oldProps[field]) {
        breakingChanges.push({
          type: 'FIELD_NOW_REQUIRED',
          field,
          message: `Field '${field}' is now required (was optional)`
        });
      }
    });
    
    // Check for removed properties (breaking if was required)
    Object.keys(oldProps).forEach(prop => {
      if (!newProps[prop]) {
        if (oldRequired.includes(prop)) {
          breakingChanges.push({
            type: 'REQUIRED_PROPERTY_REMOVED',
            field: prop,
            message: `Required property '${prop}' was removed`
          });
        } else {
          nonBreakingChanges.push({
            type: 'OPTIONAL_PROPERTY_REMOVED',
            field: prop,
            message: `Optional property '${prop}' was removed`
          });
        }
      }
    });
    
    // Check for new properties
    Object.keys(newProps).forEach(prop => {
      if (!oldProps[prop]) {
        if (newRequired.includes(prop)) {
          breakingChanges.push({
            type: 'NEW_REQUIRED_PROPERTY',
            field: prop,
            message: `New required property '${prop}' added`
          });
        } else {
          nonBreakingChanges.push({
            type: 'NEW_OPTIONAL_PROPERTY',
            field: prop,
            message: `New optional property '${prop}' added`
          });
        }
      }
    });
    
    // Check for type changes (breaking)
    Object.keys(oldProps).forEach(prop => {
      if (newProps[prop] && oldProps[prop].type !== newProps[prop].type) {
        breakingChanges.push({
          type: 'TYPE_CHANGED',
          field: prop,
          message: `Type of '${prop}' changed from ${oldProps[prop].type} to ${newProps[prop].type}`,
          oldType: oldProps[prop].type,
          newType: newProps[prop].type
        });
      }
    });
    
    // Calculate semantic version recommendation
    let versionBump = 'patch';
    if (breakingChanges.length > 0) {
      versionBump = 'major';
    } else if (nonBreakingChanges.some(c => c.type === 'NEW_OPTIONAL_PROPERTY')) {
      versionBump = 'minor';
    }
    
    return {
      breakingChanges,
      nonBreakingChanges,
      recommendedVersionBump: versionBump,
      summary: {
        totalBreaking: breakingChanges.length,
        totalNonBreaking: nonBreakingChanges.length,
        isBreaking: breakingChanges.length > 0
      }
    };
  }
  
  /**
   * Track schema version
   * @param {string} version - Semantic version string
   * @param {object} schema - Schema object
   */
  trackSchemaVersion(version, schema) {
    this._schemaVersions.set(version, {
      schema,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get schema by version
   * @param {string} version - Version to retrieve
   * @returns {object|null} Schema or null if not found
   */
  getSchemaByVersion(version) {
    const versionInfo = this._schemaVersions.get(version);
    return versionInfo ? versionInfo.schema : null;
  }

  // ==================== FEATURE 3: Response Time & Performance Testing ====================
  
  /**
   * Validate response with performance constraints
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {object} body - Response body
   * @param {object} options - Performance options
   * @param {number} options.maxResponseTime - Maximum allowed response time in ms
   * @param {number} options.maxResponseSize - Maximum allowed response size in bytes
   * @param {number} options.startTime - Start time for response time calculation
   * @returns {object} Validation result with performance metrics
   */
  async validateWithPerformance(folderName, fileName, body, options = {}) {
    const { maxResponseTime = 1000, maxResponseSize = 1048576, startTime = Date.now() } = options;
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const responseSize = JSON.stringify(body).length;
    
    const validationResult = await this.validateJsonSchema(folderName, fileName, body, { verbose: false });
    
    const performanceIssues = [];
    
    if (responseTime > maxResponseTime) {
      performanceIssues.push({
        type: 'RESPONSE_TIME_EXCEEDED',
        actual: responseTime,
        limit: maxResponseTime,
        message: `Response time ${responseTime}ms exceeds limit ${maxResponseTime}ms`
      });
    }
    
    if (responseSize > maxResponseSize) {
      performanceIssues.push({
        type: 'RESPONSE_SIZE_EXCEEDED',
        actual: responseSize,
        limit: maxResponseSize,
        message: `Response size ${responseSize} bytes exceeds limit ${maxResponseSize} bytes`
      });
    }
    
    return {
      valid: validationResult,
      performanceValid: performanceIssues.length === 0,
      metrics: {
        responseTime,
        responseSize,
        maxResponseTime,
        maxResponseSize
      },
      performanceIssues,
      overall: validationResult && performanceIssues.length === 0
    };
  }

  // ==================== FEATURE 4: Mock Data Generation ====================
  
  /**
   * Generate mock data from schema
   * @param {object} schema - JSON schema
   * @param {object} options - Generation options
   * @param {number} options.count - Number of items to generate (for arrays)
   * @param {string} options.locale - Faker locale
   * @param {number} options.seed - Seed for reproducible generation
   * @returns {object|Array} Generated mock data
   */
  generateMockData(schema, options = {}) {
    const { count = 1, locale = 'en', seed = null } = options;
    
    if (seed !== null) {
      faker.seed(seed);
    }
    
    // Set locale using the correct API for newer faker versions
    if (faker[locale]) {
      faker.locale = locale;
    }
    
    const generateValue = (propSchema, depth = 0) => {
      if (depth > 5) return null; // Prevent infinite recursion
      
      const type = propSchema.type;
      
      if (type === 'string') {
        if (propSchema.format === 'email') return faker.internet.email();
        if (propSchema.format === 'uuid') return uuidv4();
        if (propSchema.format === 'date') return faker.date.past().toISOString().split('T')[0];
        if (propSchema.format === 'date-time') return faker.date.past().toISOString();
        if (propSchema.format === 'uri') return faker.internet.url();
        if (propSchema.enum) return faker.helpers.arrayElement(propSchema.enum);
        return faker.lorem.words(3);
      }
      
      if (type === 'number' || type === 'integer') {
        if (propSchema.minimum !== undefined && propSchema.maximum !== undefined) {
          return faker.number.int({ min: propSchema.minimum, max: propSchema.maximum });
        }
        return type === 'integer' ? faker.number.int() : faker.number.float();
      }
      
      if (type === 'boolean') {
        return faker.datatype.boolean();
      }
      
      if (type === 'array') {
        const itemCount = propSchema.minItems || propSchema.maxItems || count;
        const itemSchema = propSchema.items || { type: 'string' };
        return Array.from({ length: itemCount }, () => generateValue(itemSchema, depth + 1));
      }
      
      if (type === 'object') {
        const obj = {};
        const props = propSchema.properties || {};
        const required = propSchema.required || [];
        
        Object.entries(props).forEach(([key, value]) => {
          if (required.includes(key) || faker.datatype.boolean()) {
            obj[key] = generateValue(value, depth + 1);
          }
        });
        
        return obj;
      }
      
      if (type === 'null') {
        return null;
      }
      
      return null;
    };
    
    if (schema.type === 'array') {
      return Array.from({ length: count }, () => generateValue(schema.items || { type: 'object' }));
    }
    
    return generateValue(schema);
  }

  // ==================== FEATURE 5: Contract Testing with OpenAPI/Swagger ====================
  
  /**
   * Convert OpenAPI spec to JSON Schema
   * @param {object} openApiSpec - OpenAPI specification
   * @param {string} endpoint - Endpoint path
   * @param {string} method - HTTP method
   * @returns {object} JSON Schema for the endpoint response
   */
  openApiToJsonSchema(openApiSpec, endpoint, method) {
    const paths = openApiSpec.paths || {};
    const operation = paths[endpoint]?.[method.toLowerCase()];
    
    if (!operation) {
      throw new Error(`Operation ${method.toUpperCase()} ${endpoint} not found in OpenAPI spec`);
    }
    
    const responses = operation.responses || {};
    const successResponse = responses['200'] || responses['201'] || responses.default;
    
    if (!successResponse?.content?.['application/json']?.schema) {
      throw new Error(`No JSON schema found for ${method.toUpperCase()} ${endpoint}`);
    }
    
    const schema = successResponse.content['application/json'].schema;
    
    // Convert OpenAPI schema to JSON Schema
    const jsonSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: schema.type,
      properties: {},
      required: schema.required || []
    };
    
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]) => {
        jsonSchema.properties[key] = this._convertOpenApiProperty(prop);
      });
    }
    
    return jsonSchema;
  }
  
  /**
   * Convert OpenAPI property to JSON Schema property
   * @private
   */
  _convertOpenApiProperty(prop) {
    const result = { type: prop.type };
    
    if (prop.format) result.format = prop.format;
    if (prop.description) result.description = prop.description;
    if (prop.enum) result.enum = prop.enum;
    if (prop.minimum !== undefined) result.minimum = prop.minimum;
    if (prop.maximum !== undefined) result.maximum = prop.maximum;
    if (prop.pattern) result.pattern = prop.pattern;
    
    if (prop.type === 'array' && prop.items) {
      result.items = this._convertOpenApiProperty(prop.items);
    }
    
    if (prop.type === 'object' && prop.properties) {
      result.properties = {};
      Object.entries(prop.properties).forEach(([key, value]) => {
        result.properties[key] = this._convertOpenApiProperty(value);
      });
      result.required = prop.required || [];
    }
    
    return result;
  }
  
  /**
   * Export schema to OpenAPI format
   * @param {object} schema - JSON Schema
   * @param {string} endpoint - Endpoint path
   * @param {string} method - HTTP method
   * @returns {object} OpenAPI operation object
   */
  jsonSchemaToOpenApi(schema, endpoint, method) {
    return {
      [method.toLowerCase()]: {
        summary: `Operation on ${endpoint}`,
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: this._convertSchemaToOpenApi(schema)
              }
            }
          }
        }
      }
    };
  }
  
  /**
   * Convert JSON Schema to OpenAPI schema format
   * @private
   */
  _convertSchemaToOpenApi(schema) {
    const result = { type: schema.type };
    
    if (schema.format) result.format = schema.format;
    if (schema.description) result.description = schema.description;
    if (schema.enum) result.enum = schema.enum;
    if (schema.minimum !== undefined) result.minimum = schema.minimum;
    if (schema.maximum !== undefined) result.maximum = schema.maximum;
    if (schema.pattern) result.pattern = schema.pattern;
    
    if (schema.type === 'array' && schema.items) {
      result.items = this._convertSchemaToOpenApi(schema.items);
    }
    
    if (schema.type === 'object' && schema.properties) {
      result.properties = {};
      Object.entries(schema.properties).forEach(([key, value]) => {
        result.properties[key] = this._convertSchemaToOpenApi(value);
      });
      if (schema.required && schema.required.length > 0) {
        result.required = schema.required;
      }
    }
    
    return result;
  }
  
  /**
   * Import OpenAPI spec from YAML file
   * @param {string} filePath - Path to OpenAPI YAML file
   * @returns {Promise<object>} Parsed OpenAPI spec
   */
  async importOpenApiSpec(filePath) {
    const content = await fsPromises.readFile(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content);
    } else if (ext === '.json') {
      return JSON.parse(content);
    }
    
    throw new Error('Unsupported OpenAPI file format. Use YAML or JSON.');
  }
  
  /**
   * Export OpenAPI spec to file
   * @param {object} openApiSpec - OpenAPI specification
   * @param {string} filePath - Output file path
   * @param {string} format - Output format (yaml or json)
   */
  async exportOpenApiSpec(openApiSpec, filePath, format = 'yaml') {
    let content;
    
    if (format === 'yaml' || format === 'yml') {
      content = yaml.dump(openApiSpec);
    } else if (format === 'json') {
      content = JSON.stringify(openApiSpec, null, 2);
    } else {
      throw new Error('Unsupported format. Use yaml or json.');
    }
    
    await fsPromises.writeFile(filePath, content);
  }

  // ==================== FEATURE 6: Differential Validation (Snapshot Testing) ====================
  
  /**
   * Create/update snapshot for differential validation
   * @param {string} snapshotName - Name of the snapshot
   * @param {object} data - Data to snapshot
   * @param {Array<string>} ignoreFields - Fields to ignore in comparison
   */
  async snapshot(snapshotName, data, ignoreFields = []) {
    const snapshotPath = path.join(this.schemaBasePath, '__snapshots__', `${snapshotName}.json`);
    
    // Remove ignored fields
    const cleanedData = this._removeFields(JSON.parse(JSON.stringify(data)), ignoreFields);
    
    await fsPromises.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fsPromises.writeFile(snapshotPath, JSON.stringify(cleanedData, null, 2));
    
    this._snapshotCache.set(snapshotName, cleanedData);
    
    return {
      created: true,
      path: snapshotPath,
      ignoredFields: ignoreFields
    };
  }
  
  /**
   * Validate data against snapshot
   * @param {string} snapshotName - Name of the snapshot
   * @param {object} data - Data to validate
   * @param {Array<string>} ignoreFields - Fields to ignore in comparison
   * @returns {object} Comparison result
   */
  async validateSnapshot(snapshotName, data, ignoreFields = []) {
    const snapshotPath = path.join(this.schemaBasePath, '__snapshots__', `${snapshotName}.json`);
    
    let expected;
    if (this._snapshotCache.has(snapshotName)) {
      expected = this._snapshotCache.get(snapshotName);
    } else if (fs.existsSync(snapshotPath)) {
      const content = await fsPromises.readFile(snapshotPath, 'utf8');
      expected = JSON.parse(content);
      this._snapshotCache.set(snapshotName, expected);
    } else {
      throw new Error(`Snapshot '${snapshotName}' not found. Create it first using snapshot()`);
    }
    
    const actualCleaned = this._removeFields(JSON.parse(JSON.stringify(data)), ignoreFields);
    const expectedCleaned = this._removeFields(JSON.parse(JSON.stringify(expected)), ignoreFields);
    
    const differences = this._findDifferences(expectedCleaned, actualCleaned, '');
    
    return {
      matches: differences.length === 0,
      differences,
      snapshotPath,
      ignoredFields: ignoreFields
    };
  }
  
  /**
   * Remove specified fields from object
   * @private
   */
  _removeFields(obj, fields) {
    if (!fields.length) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._removeFields(item, fields));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      Object.entries(obj).forEach(([key, value]) => {
        if (!fields.includes(key)) {
          result[key] = this._removeFields(value, fields);
        }
      });
      return result;
    }
    
    return obj;
  }
  
  /**
   * Find differences between two objects
   * @private
   */
  _findDifferences(expected, actual, path) {
    const differences = [];
    
    if (typeof expected !== typeof actual) {
      differences.push({
        path: path || '/',
        type: 'TYPE_MISMATCH',
        expected: typeof expected,
        actual: typeof actual
      });
      return differences;
    }
    
    if (expected === null && actual === null) return differences;
    
    if (Array.isArray(expected) && Array.isArray(actual)) {
      if (expected.length !== actual.length) {
        differences.push({
          path: path || '/',
          type: 'ARRAY_LENGTH_MISMATCH',
          expectedLength: expected.length,
          actualLength: actual.length
        });
      }
      const minLength = Math.min(expected.length, actual.length);
      for (let i = 0; i < minLength; i++) {
        differences.push(...this._findDifferences(expected[i], actual[i], `${path}[${i}]`));
      }
      return differences;
    }
    
    if (typeof expected === 'object') {
      const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
      
      allKeys.forEach(key => {
        const newPath = path ? `${path}.${key}` : key;
        
        if (!(key in expected)) {
          differences.push({
            path: newPath,
            type: 'UNEXPECTED_FIELD',
            value: actual[key]
          });
        } else if (!(key in actual)) {
          differences.push({
            path: newPath,
            type: 'MISSING_FIELD',
            expectedValue: expected[key]
          });
        } else {
          differences.push(...this._findDifferences(expected[key], actual[key], newPath));
        }
      });
    } else if (expected !== actual) {
      differences.push({
        path: path || '/',
        type: 'VALUE_MISMATCH',
        expected,
        actual
      });
    }
    
    return differences;
  }

  // ==================== FEATURE 7: Environment-Specific Validation ====================
  
  /**
   * Register environment-specific schema
   * @param {string} environment - Environment name (dev, staging, prod, etc.)
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {object} schema - Schema object
   */
  registerEnvironmentSchema(environment, folderName, fileName, schema) {
    const key = `${environment}:${folderName}/${fileName}`;
    this._environmentSchemas[key] = schema;
    
    // Cache the validator
    const cacheKey = `${folderName}/${fileName}`;
    const validate = this.ajv.compile(schema);
    this._validatorCache.set(cacheKey, validate);
    this._schemaCache.set(cacheKey, schema);
  }
  
  /**
   * Set current environment
   * @param {string} environment - Environment name
   */
  setEnvironment(environment) {
    this.currentEnvironment = environment;
  }
  
  /**
   * Get schema for current environment with fallback
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @returns {object} Schema for environment or default
   */
  getSchemaForEnvironment(folderName, fileName) {
    if (this.currentEnvironment) {
      const envKey = `${this.currentEnvironment}:${folderName}/${fileName}`;
      if (this._environmentSchemas[envKey]) {
        return this._environmentSchemas[envKey];
      }
    }
    
    // Fallback to default schema file
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
    
    throw new Error(`No schema found for ${folderName}/${fileName}`);
  }

  // ==================== FEATURE 8: GraphQL Schema Validation ====================
  
  /**
   * Validate GraphQL response
   * @param {object} response - GraphQL response
   * @param {object} schema - Expected response schema
   * @param {object} options - Validation options
   * @param {boolean} options.checkNullability - Check for null values in non-nullable fields
   * @returns {object} Validation result
   */
  validateGraphQLResponse(response, schema, options = {}) {
    const { checkNullability = true } = options;
    
    const errors = [];
    
    // Check for GraphQL errors
    if (response.errors && Array.isArray(response.errors)) {
      errors.push({
        type: 'GRAPHQL_ERRORS',
        count: response.errors.length,
        details: response.errors
      });
    }
    
    // Check data structure
    if (!response.data) {
      errors.push({
        type: 'NO_DATA',
        message: 'GraphQL response missing data field'
      });
      return { valid: false, errors };
    }
    
    // Validate data against schema
    if (schema) {
      const validate = this.ajv.compile(schema);
      const valid = validate(response.data);
      
      if (!valid) {
        errors.push({
          type: 'SCHEMA_VALIDATION',
          details: validate.errors
        });
      }
      
      // Check nullability
      if (checkNullability && schema.properties) {
        const nullabilityErrors = this._checkNullability(response.data, schema, '');
        if (nullabilityErrors.length > 0) {
          errors.push({
            type: 'NULLABILITY_VIOLATION',
            details: nullabilityErrors
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      hasData: !!response.data,
      hasErrors: !!response.errors
    };
  }
  
  /**
   * Check nullability in GraphQL response
   * @private
   */
  _checkNullability(data, schema, path) {
    const errors = [];
    
    if (!data || !schema.properties) return errors;
    
    const required = schema.required || [];
    
    Object.entries(schema.properties).forEach(([key, propSchema]) => {
      const currentPath = path ? `${path}.${key}` : key;
      const value = data[key];
      
      if (required.includes(key) && value === null) {
        errors.push({
          path: currentPath,
          message: `Non-nullable field '${currentPath}' is null`
        });
      }
      
      if (value && propSchema.type === 'object' && propSchema.properties) {
        errors.push(...this._checkNullability(value, propSchema, currentPath));
      }
    });
    
    return errors;
  }

  // ==================== FEATURE 9: Request Validation ====================
  
  /**
   * Validate request (body, headers, query params)
   * @param {object} request - Request object
   * @param {object} schemas - Schema definitions
   * @param {object} schemas.body - Body schema
   * @param {object} schemas.headers - Headers schema
   * @param {object} schemas.query - Query parameters schema
   * @returns {object} Validation result
   */
  validateRequest(request, schemas = {}) {
    const { body, headers, query } = schemas;
    const results = {
      body: { valid: true, errors: [] },
      headers: { valid: true, errors: [] },
      query: { valid: true, errors: [] },
      overall: true
    };
    
    if (body) {
      const validate = this.ajv.compile(body);
      const valid = validate(request.body);
      results.body.valid = valid;
      results.body.errors = validate.errors || [];
      if (!valid) results.overall = false;
    }
    
    if (headers) {
      const validate = this.ajv.compile(headers);
      const valid = validate(request.headers);
      results.headers.valid = valid;
      results.headers.errors = validate.errors || [];
      if (!valid) results.overall = false;
    }
    
    if (query) {
      const validate = this.ajv.compile(query);
      const valid = validate(request.query);
      results.query.valid = valid;
      results.query.errors = validate.errors || [];
      if (!valid) results.overall = false;
    }
    
    return results;
  }

  // ==================== FEATURE 10: Automated Documentation Generation ====================
  
  /**
   * Generate API documentation from schema
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {object} options - Generation options
   * @param {string} options.outputPath - Output file path
   * @param {string} options.format - Output format (markdown, html)
   * @returns {Promise<string>} Generated documentation
   */
  async generateDocumentation(folderName, fileName, options = {}) {
    const { outputPath = null, format = 'markdown' } = options;
    
    const schema = this.getSchemaForEnvironment(folderName, fileName);
    
    let doc = '';
    
    if (format === 'markdown') {
      doc = `# API Documentation: ${fileName}\n\n`;
      doc += `**Schema Version:** draft-07\n`;
      doc += `**Generated:** ${new Date().toISOString()}\n\n`;
      
      if (schema.description) {
        doc += `## Description\n\n${schema.description}\n\n`;
      }
      
      doc += `## Schema Definition\n\n`;
      doc += `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n`;
      
      if (schema.properties) {
        doc += `## Properties\n\n`;
        doc += `| Field | Type | Required | Description |\n`;
        doc += `|-------|------|----------|-------------|\n`;
        
        const required = schema.required || [];
        
        Object.entries(schema.properties).forEach(([key, prop]) => {
          const isRequired = required.includes(key);
          const type = prop.type || 'any';
          const desc = prop.description || '-';
          doc += `| ${key} | ${type} | ${isRequired ? 'Yes' : 'No'} | ${desc} |\n`;
        });
        
        doc += '\n';
      }
      
      if (schema.example) {
        doc += `## Example\n\n`;
        doc += `\`\`\`json\n${JSON.stringify(schema.example, null, 2)}\n\`\`\`\n\n`;
      }
    }
    
    if (outputPath) {
      await fsPromises.writeFile(outputPath, doc);
    }
    
    return doc;
  }

  // ==================== FEATURE 11: CI/CD Integration Helpers ====================
  
  /**
   * Generate JUnit XML report
   * @param {Array<object>} testResults - Array of test results
   * @param {string} outputPath - Output file path
   * @returns {string} JUnit XML content
   */
  generateJUnitReport(testResults, outputPath = null) {
    const total = testResults.length;
    const failures = testResults.filter(r => !r.success).length;
    const skipped = testResults.filter(r => r.skipped).length;
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuite name="API Schema Validation" tests="${total}" failures="${failures}" skipped="${skipped}" timestamp="${new Date().toISOString()}">\n`;
    
    testResults.forEach((result, index) => {
      xml += `  <testcase name="${result.name || `Test ${index + 1}`}" classname="${result.endpoint || 'unknown'}" time="${result.duration || 0}">\n`;
      
      if (result.skipped) {
        xml += `    <skipped/>\n`;
      } else if (!result.success) {
        xml += `    <failure message="${result.message || 'Validation failed'}">\n`;
        xml += `      ${result.details || ''}\n`;
        xml += `    </failure>\n`;
      }
      
      xml += `  </testcase>\n`;
    });
    
    xml += '</testsuite>\n';
    
    if (outputPath) {
      fs.writeFileSync(outputPath, xml);
    }
    
    return xml;
  }
  
  /**
   * Generate HTML report
   * @param {Array<object>} testResults - Array of test results
   * @param {string} outputPath - Output file path
   * @returns {string} HTML content
   */
  generateHTMLReport(testResults, outputPath = null) {
    const total = testResults.length;
    const passed = testResults.filter(r => r.success).length;
    const failed = testResults.filter(r => !r.success && !r.skipped).length;
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>API Validation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px; }
    .pass { color: green; }
    .fail { color: red; }
    .skip { color: orange; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f8f8; }
  </style>
</head>
<body>
  <h1>API Schema Validation Report</h1>
  <div class="summary">
    <strong>Total:</strong> ${total} | 
    <span class="pass"><strong>Passed:</strong> ${passed}</span> | 
    <span class="fail"><strong>Failed:</strong> ${failed}</span> |
    <span class="skip"><strong>Skipped:</strong> ${testResults.filter(r => r.skipped).length}</span>
  </div>
  <table>
    <tr><th>Test</th><th>Endpoint</th><th>Status</th><th>Duration</th><th>Details</th></tr>`;
    
    testResults.forEach(result => {
      const status = result.skipped ? 'SKIPPED' : (result.success ? 'PASS' : 'FAIL');
      const statusClass = result.skipped ? 'skip' : (result.success ? 'pass' : 'fail');
      html += `
    <tr>
      <td>${result.name || 'Unnamed'}</td>
      <td>${result.endpoint || '-'}</td>
      <td class="${statusClass}">${status}</td>
      <td>${result.duration || 0}ms</td>
      <td>${result.message || '-'}</td>
    </tr>`;
    });
    
    html += `
  </table>
</body>
</html>`;
    
    if (outputPath) {
      fs.writeFileSync(outputPath, html);
    }
    
    return html;
  }
  
  /**
   * Generate JSON report
   * @param {Array<object>} testResults - Array of test results
   * @param {string} outputPath - Output file path
   * @returns {object} JSON report
   */
  generateJSONReport(testResults, outputPath = null) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.success).length,
        failed: testResults.filter(r => !r.success && !r.skipped).length,
        skipped: testResults.filter(r => r.skipped).length
      },
      results: testResults
    };
    
    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    }
    
    return report;
  }
  
  /**
   * Generate console report
   * @param {Array<object>} testResults - Array of test results
   */
  printConsoleReport(testResults) {
    console.log('\n========================================');
    console.log('       API VALIDATION REPORT');
    console.log('========================================\n');
    
    const total = testResults.length;
    const passed = testResults.filter(r => r.success).length;
    const failed = testResults.filter(r => !r.success && !r.skipped).length;
    const skipped = testResults.filter(r => r.skipped).length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`⊘ Skipped: ${skipped}`);
    console.log('');
    
    testResults.forEach((result, index) => {
      const icon = result.skipped ? '⊘' : (result.success ? '✓' : '✗');
      const status = result.skipped ? 'SKIP' : (result.success ? 'PASS' : 'FAIL');
      console.log(`${icon} [${status}] ${result.name || `Test ${index + 1}`} (${result.duration || 0}ms)`);
      if (result.message && !result.success) {
        console.log(`   Error: ${result.message}`);
      }
    });
    
    console.log('\n========================================\n');
  }

  // ==================== FEATURE 12: Schema Migration Tools ====================
  
  /**
   * Migrate schema from one version to another
   * @param {object} data - Data to migrate
   * @param {Array<object>} rules - Migration rules
   * @returns {object} Migrated data
   */
  migrateSchema(data, rules) {
    let migrated = JSON.parse(JSON.stringify(data));
    
    rules.forEach(rule => {
      switch (rule.type) {
        case 'RENAME_FIELD':
          migrated = this._renameField(migrated, rule.oldName, rule.newName);
          break;
        case 'REMOVE_FIELD':
          migrated = this._removeField(migrated, rule.field);
          break;
        case 'ADD_FIELD':
          migrated = this._addField(migrated, rule.field, rule.defaultValue);
          break;
        case 'CHANGE_TYPE':
          migrated = this._changeFieldType(migrated, rule.field, rule.converter);
          break;
        case 'TRANSFORM_VALUE':
          migrated = this._transformValue(migrated, rule.field, rule.transformer);
          break;
      }
    });
    
    return migrated;
  }
  
  _renameField(obj, oldName, newName, path = '') {
    if (Array.isArray(obj)) {
      return obj.map(item => this._renameField(item, oldName, newName, path));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        if (key === oldName || currentPath === oldName) {
          result[newName] = value;
        } else {
          result[key] = this._renameField(value, oldName, newName, currentPath);
        }
      });
      return result;
    }
    
    return obj;
  }
  
  _removeField(obj, field, path = '') {
    if (Array.isArray(obj)) {
      return obj.map(item => this._removeField(item, field, path));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        if (key !== field && currentPath !== field) {
          result[key] = this._removeField(value, field, currentPath);
        }
      });
      return result;
    }
    
    return obj;
  }
  
  _addField(obj, field, defaultValue, path = '') {
    if (Array.isArray(obj)) {
      return obj.map(item => this._addField(item, field, defaultValue, path));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = { ...obj };
      if (!(field in result)) {
        result[field] = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
      }
      Object.entries(result).forEach(([key, value]) => {
        result[key] = this._addField(value, field, defaultValue, path ? `${path}.${key}` : key);
      });
      return result;
    }
    
    return obj;
  }
  
  _changeFieldType(obj, field, converter, path = '') {
    if (Array.isArray(obj)) {
      return obj.map(item => this._changeFieldType(item, field, converter, path));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        if (key === field || currentPath === field) {
          result[key] = converter(value);
        } else {
          result[key] = this._changeFieldType(value, field, converter, currentPath);
        }
      });
      return result;
    }
    
    return obj;
  }
  
  _transformValue(obj, field, transformer, path = '') {
    if (Array.isArray(obj)) {
      return obj.map(item => this._transformValue(item, field, transformer, path));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        if (key === field || currentPath === field) {
          result[key] = transformer(value, obj);
        } else {
          result[key] = this._transformValue(value, field, transformer, currentPath);
        }
      });
      return result;
    }
    
    return obj;
  }

  // ==================== FEATURE 13: Fuzzy Matching & Tolerance ====================
  
  /**
   * Validate with fuzzy matching and tolerance
   * @param {object} expected - Expected data
   * @param {object} actual - Actual data
   * @param {object} options - Tolerance options
   * @param {boolean} options.allowExtraFields - Allow extra fields in actual
   * @param {boolean} options.allowMissingOptional - Allow missing optional fields
   * @param {number} options.numericTolerance - Tolerance for numeric comparisons
   * @param {number} options.stringSimilarityThreshold - Minimum string similarity (0-1)
   * @returns {object} Validation result with tolerance
   */
  validateWithTolerance(expected, actual, options = {}) {
    const {
      allowExtraFields = true,
      allowMissingOptional = true,
      numericTolerance = 0.01,
      stringSimilarityThreshold = 0.8
    } = options;
    
    const issues = [];
    
    const compare = (exp, act, path = '') => {
      if (exp === null && act === null) return;
      
      if (typeof exp !== typeof act) {
        issues.push({
          path: path || '/',
          type: 'TYPE_MISMATCH',
          expected: typeof exp,
          actual: typeof act
        });
        return;
      }
      
      if (typeof exp === 'number' && typeof act === 'number') {
        if (Math.abs(exp - act) > numericTolerance) {
          issues.push({
            path: path || '/',
            type: 'NUMERIC_TOLERANCE_EXCEEDED',
            expected: exp,
            actual: act,
            difference: Math.abs(exp - act),
            tolerance: numericTolerance
          });
        }
        return;
      }
      
      if (typeof exp === 'string' && typeof act === 'string') {
        const similarity = stringSimilarity.compareTwoStrings(exp, act);
        if (similarity < stringSimilarityThreshold && exp !== act) {
          issues.push({
            path: path || '/',
            type: 'STRING_SIMILARITY_LOW',
            expected: exp,
            actual: act,
            similarity
          });
        }
        return;
      }
      
      if (Array.isArray(exp) && Array.isArray(act)) {
        const minLength = Math.min(exp.length, act.length);
        for (let i = 0; i < minLength; i++) {
          compare(exp[i], act[i], `${path}[${i}]`);
        }
        return;
      }
      
      if (typeof exp === 'object') {
        const expKeys = Object.keys(exp);
        const actKeys = Object.keys(act);
        
        expKeys.forEach(key => {
          const newPath = path ? `${path}.${key}` : key;
          if (!(key in act)) {
            if (!allowMissingOptional) {
              issues.push({
                path: newPath,
                type: 'MISSING_FIELD',
                expectedValue: exp[key]
              });
            }
          } else {
            compare(exp[key], act[key], newPath);
          }
        });
        
        if (!allowExtraFields) {
          actKeys.forEach(key => {
            if (!(key in exp)) {
              const newPath = path ? `${path}.${key}` : key;
              issues.push({
                path: newPath,
                type: 'EXTRA_FIELD',
                actualValue: act[key]
              });
            }
          });
        }
      }
    };
    
    compare(expected, actual);
    
    return {
      valid: issues.length === 0,
      issues,
      toleranceSettings: options
    };
  }

  // ==================== FEATURE 14: Batch Validation ====================
  
  /**
   * Validate multiple endpoints/responses in parallel
   * @param {Array<object>} validations - Array of validation requests
   * @param {object} options - Batch options
   * @param {number} options.concurrency - Maximum concurrent validations
   * @returns {Promise<Array<object>>} Array of validation results
   */
  async batchValidate(validations, options = {}) {
    const { concurrency = 10 } = options;
    
    const results = [];
    const executing = [];
    
    for (const validation of validations) {
      const promise = Promise.resolve().then(async () => {
        const startTime = Date.now();
        try {
          const valid = await this.validateJsonSchema(
            validation.folderName,
            validation.fileName,
            validation.body,
            { verbose: false }
          );
          return {
            success: valid,
            name: validation.name || `${validation.folderName}/${validation.fileName}`,
            endpoint: validation.endpoint,
            duration: Date.now() - startTime,
            message: valid ? 'Validation passed' : 'Validation failed'
          };
        } catch (error) {
          return {
            success: false,
            name: validation.name || `${validation.folderName}/${validation.fileName}`,
            endpoint: validation.endpoint,
            duration: Date.now() - startTime,
            message: error.message,
            error
          };
        }
      });
      
      results.push(promise);
      
      const execution = promise.then(() => {
        executing.splice(executing.indexOf(execution), 1);
      });
      
      executing.push(execution);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
    
    return Promise.all(results);
  }

  // ==================== FEATURE 15: Runtime Schema Modification ====================
  
  /**
   * Dynamically modify schema at runtime
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {object} modifications - Modifications to apply
   * @returns {object} Modified schema
   */
  modifySchema(folderName, fileName, modifications) {
    const schema = this.getSchemaForEnvironment(folderName, fileName);
    const modified = JSON.parse(JSON.stringify(schema));
    
    if (modifications.addRequired) {
      modified.required = modified.required || [];
      modifications.addRequired.forEach(field => {
        if (!modified.required.includes(field)) {
          modified.required.push(field);
        }
      });
    }
    
    if (modifications.removeRequired) {
      modified.required = (modified.required || []).filter(
        field => !modifications.removeRequired.includes(field)
      );
    }
    
    if (modifications.addProperties) {
      modified.properties = modified.properties || {};
      Object.assign(modified.properties, modifications.addProperties);
    }
    
    if (modifications.removeProperties) {
      modifications.removeProperties.forEach(field => {
        if (modified.properties) {
          delete modified.properties[field];
        }
      });
    }
    
    if (modifications.addPattern) {
      const { field, pattern } = modifications.addPattern;
      if (modified.properties && modified.properties[field]) {
        modified.properties[field].pattern = pattern;
      }
    }
    
    // Update cache
    const cacheKey = `${folderName}/${fileName}`;
    this._schemaCache.set(cacheKey, modified);
    const validate = this.ajv.compile(modified);
    this._validatorCache.set(cacheKey, validate);
    
    return modified;
  }

  // ==================== FEATURE 16: Security Validation ====================
  
  /**
   * Validate for security issues and PII
   * @param {object} data - Data to validate
   * @param {object} options - Security options
   * @param {boolean} options.checkPII - Check for personally identifiable information
   * @param {boolean} options.checkSensitiveFields - Check for sensitive field exposure
   * @param {Array<string>} options.sensitiveFieldNames - List of sensitive field names
   * @param {string} options.complianceStandard - Compliance standard (GDPR, HIPAA)
   * @returns {object} Security validation result
   */
  validateSecurity(data, options = {}) {
    const {
      checkPII = true,
      checkSensitiveFields = true,
      sensitiveFieldNames = ['password', 'secret', 'token', 'apiKey', 'creditCard', 'ssn'],
      complianceStandard = null
    } = options;
    
    const issues = [];
    
    const scan = (obj, path = '') => {
      if (typeof obj === 'string') {
        // Check for PII patterns
        if (checkPII) {
          Object.entries(piiPatterns).forEach(([type, pattern]) => {
            if (pattern.test(obj)) {
              issues.push({
                type: 'PII_DETECTED',
                piiType: type,
                path: path || '/',
                severity: 'high',
                message: `Potential ${type} detected`
              });
            }
          });
        }
      }
      
      if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          const currentPath = path ? `${path}.${key}` : key;
          
          // Check for sensitive field names
          if (checkSensitiveFields && sensitiveFieldNames.some(name => 
            key.toLowerCase().includes(name.toLowerCase())
          )) {
            issues.push({
              type: 'SENSITIVE_FIELD_EXPOSED',
              fieldName: key,
              path: currentPath,
              severity: 'high',
              message: `Sensitive field '${key}' exposed in response`
            });
          }
          
          scan(value, currentPath);
        });
      }
    };
    
    scan(data);
    
    // Add compliance-specific checks
    if (complianceStandard === 'GDPR') {
      const gdprIssues = issues.filter(i => 
        i.type === 'PII_DETECTED' && ['emailAddress', 'phoneNumber', 'ssn'].includes(i.piiType)
      );
      if (gdprIssues.length > 0) {
        issues.push({
          type: 'GDPR_COMPLIANCE',
          severity: 'critical',
          message: `Found ${gdprIssues.length} potential GDPR violations`,
          details: gdprIssues
        });
      }
    }
    
    if (complianceStandard === 'HIPAA') {
      const hipaaIssues = issues.filter(i => 
        i.type === 'PII_DETECTED' && ['ssn', 'phoneNumber', 'emailAddress'].includes(i.piiType)
      );
      if (hipaaIssues.length > 0) {
        issues.push({
          type: 'HIPAA_COMPLIANCE',
          severity: 'critical',
          message: `Found ${hipaaIssues.length} potential HIPAA violations`,
          details: hipaaIssues
        });
      }
    }
    
    return {
      secure: issues.length === 0,
      issues,
      summary: {
        totalIssues: issues.length,
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length
      }
    };
  }

  // ==================== FEATURE 17: Performance Benchmarking ====================
  
  /**
   * Benchmark validation performance
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {object} testData - Test data for benchmarking
   * @param {object} options - Benchmark options
   * @param {number} options.iterations - Number of iterations
   * @returns {Promise<object>} Benchmark results
   */
  async benchmarkValidation(folderName, fileName, testData, options = {}) {
    const { iterations = 1000 } = options;
    
    const suite = new Benchmark.Suite();
    const results = {
      validations: [],
      stats: {}
    };
    
    return new Promise((resolve) => {
      suite
        .add('Validation', {
          defer: true,
          fn: async (deferred) => {
            const startTime = Date.now();
            const valid = await this.validateJsonSchema(folderName, fileName, testData, { verbose: false });
            results.validations.push({
              valid,
              duration: Date.now() - startTime
            });
            deferred.resolve();
          }
        })
        .on('cycle', (event) => {
          const durations = results.validations.map(v => v.duration);
          results.stats = {
            average: durations.reduce((a, b) => a + b, 0) / durations.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            opsPerSecond: event.target.hz.toFixed(2),
            margin: event.target.stats.rme.toFixed(2),
            iterations: durations.length
          };
        })
        .on('complete', () => {
          resolve({
            success: true,
            stats: results.stats,
            sampleSize: results.validations.length
          });
        })
        .run({ async: true });
    });
  }
  
  /**
   * Simple performance measurement without benchmark library
   * @param {string} folderName - Folder name
   * @param {string} fileName - Schema file name
   * @param {object} testData - Test data
   * @param {number} iterations - Number of iterations
   * @returns {Promise<object>} Performance metrics
   */
  async measurePerformance(folderName, fileName, testData, iterations = 100) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.validateJsonSchema(folderName, fileName, testData, { verbose: false });
      times.push(Date.now() - start);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    return {
      averageMs: avg.toFixed(2),
      minMs: min,
      maxMs: max,
      totalMs: times.reduce((a, b) => a + b, 0),
      iterations,
      opsPerSecond: (1000 / avg).toFixed(2)
    };
  }
}

// Export the class and create a default instance
module.exports = SchemaValidator;

// Also export convenience functions for backward compatibility
module.exports.createValidator = (schemaBasePath) => new SchemaValidator(schemaBasePath);
