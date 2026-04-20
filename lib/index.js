const Ajv = require('ajv').default || require('ajv');
const addFormats = require('ajv-formats');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

// Lazy-load optional heavy dependencies — keeps the module working in Bruno's
// CJS sandbox even when these packages are not installed.
let _generateSchema = null;
function getGenerateSchema() {
  if (!_generateSchema) {
    try { _generateSchema = require('generate-schema'); }
    catch (e) { throw new Error('generate-schema is required for schema creation. Install it: npm i generate-schema'); }
  }
  return _generateSchema;
}

let _yaml = null;
function getYaml() {
  if (!_yaml) {
    try { _yaml = require('js-yaml'); }
    catch (e) { throw new Error('js-yaml is required for OpenAPI YAML parsing. Install it: npm i js-yaml'); }
  }
  return _yaml;
}

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
 */
const FORMAT_PATTERNS = [
  {
    format: 'date-time',
    test: (v) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i.test(v),
  },
  {
    format: 'date',
    test: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
  },
  {
    format: 'time',
    test: (v) => /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i.test(v),
  },
  {
    format: 'duration',
    test: (v) => /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?!$)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/.test(v),
  },
  {
    format: 'uuid',
    test: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
  },
  {
    format: 'email',
    test: (v) => /^[^\s@"()<>\[\]\\,;:]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254,
  },
  {
    format: 'uri',
    test: (v) => /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/\S+$/.test(v),
  },
  {
    format: 'ipv4',
    test: (v) => /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/.test(v),
  },
  {
    format: 'ipv6',
    test: (v) => {
      if (/^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i.test(v)) return true;
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
    test: (v) =>
      v.length <= 253 &&
      v.includes('.') &&
      /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.((?!-)[a-zA-Z0-9-]{1,63}(?<!-)))+$/.test(v),
  },
];

/**
 * SchemaValidator — A lean JSON schema validation library for API contract testing.
 *
 * KEPT features (genuinely useful for API testing with Bruno):
 *   ✅ Core validation (validateJsonSchema, validateJsonSchemaSync, createJsonSchema)
 *   ✅ Schema Evolution (compareSchemas) — detect breaking contract changes
 *   ✅ OpenAPI/Swagger (openApiToJsonSchema) — import specs as JSON Schema
 *   ✅ Request Validation (validateRequest) — validate body, headers, query
 *   ✅ Security/PII (validateSecurity) — catch leaked PII in responses
 *
 * REMOVED features (bloat, anti-patterns, or incompatible with Bruno sandbox):
 *   ❌ Performance Testing (validateWithPerformance) — measures validator, not API
 *   ❌ Performance Benchmarking (benchmarkValidation, measurePerformance) — micro-benchmarks AJV
 *   ❌ Mock Data Generation (generateMockData) — belongs in separate package
 *   ❌ Snapshot Testing (snapshot, validateSnapshot) — unit-test pattern, not contract testing
 *   ❌ Environment-Specific Schemas — Bruno already has environment variables
 *   ❌ Automated Documentation (generateDocumentation) — not a testing concern
 *   ❌ CI/CD Reports (JUnit, HTML, Console) — Bruno CLI has its own reporters
 *   ❌ Schema Migration (migrateSchema) — build-time tooling, not runtime testing
 *   ❌ Fuzzy Matching (validateWithTolerance) — undermines contract testing
 *   ❌ Batch Validation (batchValidate) — Bruno runs one request at a time
 *   ❌ Runtime Modification (modifySchema) — mutating schemas is an anti-pattern
 *   ❌ Schema version tracking (trackSchemaVersion) — file I/O bloat
 */
class SchemaValidator {
  // ─── Format / type detection helpers ────────────────────────────────────────

  /**
   * Detect a JSON Schema `format` keyword for a string value.
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
   * Scan ALL items in an array to build a type-descriptor map.
   * @param {object[]} items
   * @returns {{ [key: string]: object }}
   */
  _mergeTypeInfo(items) {
    const allKeys = new Set(items.flatMap((item) => Object.keys(item)));
    const fieldMeta = {};

    for (const key of allKeys) {
      fieldMeta[key] = { types: new Set(), formats: new Set(), hasNull: false };
    }

    for (const item of items) {
      for (const key of allKeys) {
        const meta = fieldMeta[key];
        if (!Object.prototype.hasOwnProperty.call(item, key)) {
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

    const result = {};
    for (const [key, meta] of Object.entries(fieldMeta)) {
      const typeList = [...meta.types];
      if (meta.hasNull) typeList.push('null');

      const descriptor = typeList.length === 1
        ? { type: typeList[0] }
        : { type: typeList };

      if (meta.formats.size === 1) {
        descriptor.format = [...meta.formats][0];
      }

      result[key] = descriptor;
    }
    return result;
  }

  /**
   * Determine which fields are required (present and non-null in EVERY item).
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
   * Walk a schema node alongside sample data and stamp `format` keywords.
   * @param {object} schema
   * @param {*} sample
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
   * Generate and enrich a JSON schema from sample data.
   * @param {*} json
   * @returns {object}
   * @private
   */
  _generateSchemaFromData(json) {
    const schema = getGenerateSchema().json(json);
    schema['$schema'] = 'http://json-schema.org/draft-07/schema#';

    if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object') {
      const objectItems = json.filter((i) => i && typeof i === 'object' && !Array.isArray(i));
      schema.items = {
        type: 'object',
        properties: this._mergeTypeInfo(objectItems),
        required: this._getRequiredFields(objectItems),
      };
    } else if (!Array.isArray(json) && json && typeof json === 'object') {
      this._enrichSchemaFormats(schema, json);
    }

    delete schema.uniqueItems;
    delete schema.description;
    if (schema.items && schema.items.description) delete schema.items.description;

    return schema;
  }

  /**
   * Log validation errors to console in a human-friendly format.
   * @private
   */
  _logValidationErrors(errors, body, folderName, fileName, schemaFilePath) {
    console.error('\n✗ SCHEMA VALIDATION ERRORS:');
    console.error(`  Schema: ${folderName}/${fileName}`);
    console.error(`  File: ${schemaFilePath}`);
    console.error('');

    if (errors && Array.isArray(errors)) {
      errors.forEach((err, index) => {
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
    } else {
      console.error('  ', JSON.stringify(errors));
    }

    if (typeof body === 'object') {
      console.error('  Response sample (first 500 chars):');
      console.error('  ', JSON.stringify(body, null, 2).substring(0, 500) + '...');
    }
  }

  /**
   * Create a new SchemaValidator instance
   * @param {string} schemaPathOrFolderName - Path to schema directory or folder name (in Bruno)
   * @param {object} [options={}] - Configuration options
   */
  constructor(schemaPathOrFolderName = 'api-schemas', options = {}) {
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
    
    const {
      allErrors = false,
      verbose = false,
      allowUnionTypes = false,
      customFormats: userFormats = {},
      additionalFormats = {}
    } = options;
    
    this._validatorCache = new Map();
    this._schemaCache = new Map();
    this.options = { allErrors, verbose, allowUnionTypes, customFormats: userFormats, additionalFormats };
  }

  /**
   * Creates a JSON schema file from the provided JSON object.
   * @param {string} folderName - Folder path for the schema file
   * @param {string} fileName - Schema file name (without extension)
   * @param {object} json - Sample JSON data
   * @returns {Promise<string>} Path to the generated schema file
   */
  async createJsonSchema(folderName, fileName, json) {
    const schema = this._generateSchemaFromData(json);
    const schemaString = JSON.stringify(schema, null, 2);
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);

    try {
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
   * Supports two calling modes:
   * - Inline: validateJsonSchemaSync(schema, data)
   * - File-based: validateJsonSchemaSync(folderName, fileName, body, options)
   */
  validateJsonSchemaSync(folderNameOrSchema, fileNameOrData, body, options = {}) {
    // Inline mode
    if (typeof folderNameOrSchema === 'object' && folderNameOrSchema !== null) {
      const schema = folderNameOrSchema;
      const data = fileNameOrData;
      const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
      addFormats(ajv);
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
    
    if (createSchema && !fs.existsSync(schemaFilePath)) {
      if (verbose) console.log(`Creating new schema: ${folderName}/${fileName}`);

      const schema = this._generateSchemaFromData(body);
      const schemaString = JSON.stringify(schema, null, 2);
      const schemaDir = path.dirname(schemaFilePath);
      if (!fs.existsSync(schemaDir)) fs.mkdirSync(schemaDir, { recursive: true });
      fs.writeFileSync(schemaFilePath, schemaString);
      
      if (verbose) {
        console.log(`✓ JSON schema successfully created and saved.`);
        console.log(`  Location: ${schemaFilePath}`);
      }
      
      this._validatorCache.delete(cacheKey);
      this._schemaCache.delete(cacheKey);
    }
    
    let existingSchema, validate;
    try {
      existingSchema = this._schemaCache.get(cacheKey);
      validate = this._validatorCache.get(cacheKey);

      if (!existingSchema || !validate) {
        const schemaFileContent = fs.readFileSync(schemaFilePath, 'utf8');
        existingSchema = JSON.parse(schemaFileContent);
        this._schemaCache.set(cacheKey, existingSchema);
        
        const ajv = new Ajv({ allErrors: false });
        addFormats(ajv);
        validate = ajv.compile(existingSchema);
        this._validatorCache.set(cacheKey, validate);
      }
    } catch (error) {
      if (verbose) {
        console.error('\n✗ Error loading or validating schema file:', error.message);
        console.error(`  Path: ${schemaFilePath}`);
      }
      if (throwOnError) throw error;
      return false;
    }

    const validRes = validate(body);

    if (!validRes) {
      if (verbose) this._logValidationErrors(validate.errors, body, folderName, fileName, schemaFilePath);
    } else {
      if (verbose) console.log(`✓ Schema validation passed: ${folderName}/${fileName}`);
    }

    if (!validRes && throwOnError) {
      const validationError = new Error(`Schema validation failed for ${folderName}/${fileName}`);
      validationError.validationErrors = validate.errors;
      throw validationError;
    }

    return validRes;
  }

  /**
   * Validates an object against a JSON schema (Asynchronous version).
   */
  async validateJsonSchema(folderName, fileName, body, options = {}) {
    const { createSchema = false, verbose = true, throwOnError = false } = options;
    const cacheKey = `${folderName}/${fileName}`;
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    
    if (createSchema) {
      await this.createJsonSchema(folderName, fileName, body);
      this._validatorCache.delete(cacheKey);
      this._schemaCache.delete(cacheKey);
    }

    let existingSchema, validate;
    try {
      existingSchema = this._schemaCache.get(cacheKey);
      validate = this._validatorCache.get(cacheKey);

      if (!existingSchema || !validate) {
        const schemaFileContent = await fsPromises.readFile(schemaFilePath, 'utf8');
        existingSchema = JSON.parse(schemaFileContent);
        this._schemaCache.set(cacheKey, existingSchema);
        
        const ajv = new Ajv({ allErrors: false });
        addFormats(ajv);
        validate = ajv.compile(existingSchema);
        this._validatorCache.set(cacheKey, validate);
      }
    } catch (error) {
      if (verbose) {
        console.error('\n✗ Error loading or validating schema file:', error.message);
        console.error(`  Path: ${schemaFilePath}`);
      }
      if (throwOnError) throw error;
      return false;
    }

    const validRes = validate(body);

    if (!validRes) {
      if (verbose) this._logValidationErrors(validate.errors, body, folderName, fileName, schemaFilePath);
    } else {
      if (verbose) console.log(`✓ Schema validation passed: ${folderName}/${fileName}`);
    }

    if (!validRes && throwOnError) {
      const validationError = new Error(`Schema validation failed for ${folderName}/${fileName}`);
      validationError.validationErrors = validate.errors;
      throw validationError;
    }

    return validRes;
  }

  /** Check if a schema file exists */
  schemaExists(folderName, fileName) {
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    return fs.existsSync(schemaFilePath);
  }

  /** Get the full path to a schema file */
  getSchemaPath(folderName, fileName) {
    return path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
  }

  /** Clear all cached schemas and validators */
  clearCache() {
    this._validatorCache.clear();
    this._schemaCache.clear();
  }

  /** Clear cache for a specific schema */
  clearCacheForSchema(folderName, fileName) {
    const cacheKey = `${folderName}/${fileName}`;
    this._validatorCache.delete(cacheKey);
    this._schemaCache.delete(cacheKey);
  }

  /** Get cache statistics */
  getCacheStats() {
    return {
      validatorCacheSize: this._validatorCache.size,
      schemaCacheSize: this._schemaCache.size
    };
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

  // ─── Schema Evolution ───────────────────────────────────────────────────────

  /**
   * Compare two schemas and detect breaking/non-breaking changes.
   * Useful in CI pipelines to catch contract-breaking API changes.
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

    if (oldSchema.properties && newSchema.properties) {
      const oldRequired = new Set(oldSchema.required || []);
      const newRequired = new Set(newSchema.required || []);
      
      for (const field of Object.keys(oldSchema.properties)) {
        if (!newSchema.properties[field]) {
          if (oldRequired.has(field)) {
            changes.breaking.push({ type: 'required_field_removed', field });
          } else {
            changes.nonBreaking.push({ type: 'optional_field_removed', field });
          }
        }
      }

      for (const field of newRequired) {
        if (!oldRequired.has(field) && newSchema.properties[field]) {
          changes.breaking.push({ type: 'required_field_added', field });
        }
      }

      for (const field of Object.keys(newSchema.properties)) {
        if (oldSchema.properties[field]) {
          const oldType = oldSchema.properties[field].type;
          const newType = newSchema.properties[field].type;
          if (oldType !== newType) {
            changes.breaking.push({ type: 'type_changed', field, oldType, newType });
          }
        }
      }

      for (const field of Object.keys(newSchema.properties)) {
        if (!oldSchema.properties[field] && !newRequired.has(field)) {
          changes.nonBreaking.push({ type: 'optional_field_added', field });
        }
      }
    }

    if (changes.breaking.length > 0) {
      changes.recommendedVersionBump = 'major';
    } else if (changes.nonBreaking.some(c => c.type === 'optional_field_added')) {
      changes.recommendedVersionBump = 'minor';
    }

    return changes;
  }

  // ─── OpenAPI/Swagger Support ────────────────────────────────────────────────

  /**
   * Convert OpenAPI specification to JSON Schema objects.
   * @param {string|object} openApiSpec - OpenAPI spec (YAML string, JSON string, or object)
   * @returns {object} Map of schema name → JSON Schema
   */
  openApiToJsonSchema(openApiSpec) {
    let spec;
    
    if (typeof openApiSpec === 'string') {
      try {
        spec = getYaml().load(openApiSpec);
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
      for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            if (operation.requestBody && operation.requestBody.content) {
              for (const contentType of Object.keys(operation.requestBody.content)) {
                const mediaType = operation.requestBody.content[contentType];
                if (mediaType.schema) {
                  const key = `${method.toUpperCase()}${pathStr.replace(/{/g, '_').replace(/}/g, '')}_request`;
                  schemas[key] = this._convertOpenApiSchema(mediaType.schema);
                }
              }
            }
            
            if (operation.responses) {
              for (const [statusCode, response] of Object.entries(operation.responses)) {
                if (response.content) {
                  for (const contentType of Object.keys(response.content)) {
                    const mediaType = response.content[contentType];
                    if (mediaType.schema) {
                      const key = `${method.toUpperCase()}${pathStr.replace(/{/g, '_').replace(/}/g, '')}_${statusCode}_response`;
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

  /** @private */
  _convertOpenApiSchema(openApiSchema) {
    const schema = { ...openApiSchema };
    
    if (schema.nullable) {
      if (schema.type) schema.type = [schema.type, 'null'];
      delete schema.nullable;
    }
    
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        schema.properties[key] = this._convertOpenApiSchema(value);
      }
    }
    if (schema.items) schema.items = this._convertOpenApiSchema(schema.items);
    if (schema.allOf) schema.allOf = schema.allOf.map(s => this._convertOpenApiSchema(s));
    if (schema.oneOf) schema.oneOf = schema.oneOf.map(s => this._convertOpenApiSchema(s));
    if (schema.anyOf) schema.anyOf = schema.anyOf.map(s => this._convertOpenApiSchema(s));

    return schema;
  }

  // ─── Request Validation ─────────────────────────────────────────────────────

  /**
   * Validate request body, headers, and query parameters against schemas.
   * @param {object} request - Request object with body, headers, query
   * @param {object} schemas - Schema definitions for body, headers, query
   * @returns {object} Validation result per part + overall
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

  // ─── Security Validation ────────────────────────────────────────────────────

  /**
   * Validate security aspects of API response data.
   * Detects PII (SSN, credit cards, phone numbers, emails) and sensitive field names.
   * @param {*} data - Data to check
   * @param {object} options - { complianceStandard: 'GDPR' | 'HIPAA' }
   * @returns {object} Security validation result
   */
  validateSecurity(data, options = {}) {
    const complianceStandard = options.complianceStandard || null;
    const issues = [];
    const piiFound = [];
    
    const scanForPII = (obj, scanPath = '') => {
      if (typeof obj === 'string') {
        for (const [type, pattern] of Object.entries(piiPatterns)) {
          if (pattern.test(obj)) {
            const issue = { type, path: scanPath || 'root', value: obj.substring(0, 10) + '...' };
            piiFound.push(issue);
            issues.push(`Potential ${type} detected at ${scanPath || 'root'}`);
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const newPath = scanPath ? `${scanPath}.${key}` : key;

          const sensitivePatterns = ['password', 'secret', 'token', 'api_key', 'apikey', 'ssn', 'creditcard'];
          if (sensitivePatterns.some(p => key.toLowerCase().includes(p))) {
            issues.push(`Sensitive field "${key}" found at ${newPath}`);
          }
          
          scanForPII(value, newPath);
        }
      }
    };
    
    scanForPII(data);
    
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
}

// ─── Standalone helpers (no instance needed) ────────────────────────────────
// Designed for quick use inside Bruno CLI test scripts.

/**
 * Validate data against an inline JSON schema (no files needed).
 * @param {object} schema - JSON Schema object
 * @param {*} data - Data to validate
 * @param {object} [opts] - { allErrors, allowUnionTypes }
 * @returns {{ valid: boolean, errors: object[]|null }}
 */
function validate(schema, data, opts = {}) {
  const ajv = new Ajv({ allErrors: opts.allErrors !== false, allowUnionTypes: true });
  addFormats(ajv);
  for (const [name, pattern] of Object.entries(customFormats)) {
    ajv.addFormat(name, pattern instanceof RegExp ? { type: 'string', validate: (s) => pattern.test(s) } : pattern);
  }
  const fn = ajv.compile(schema);
  const valid = fn(data);
  return { valid, errors: valid ? null : fn.errors };
}

/**
 * Assert that data matches a schema — throws on failure.
 * @param {object} schema - JSON Schema object
 * @param {*} data - Data to validate
 * @param {string} [message] - Custom error message prefix
 */
function assertSchema(schema, data, message) {
  const result = validate(schema, data);
  if (!result.valid) {
    const details = result.errors.map(e => `${e.instancePath || '/'}: ${e.message}`).join('; ');
    throw new Error(`${message || 'Schema validation failed'}: ${details}`);
  }
}

/**
 * Assert HTTP response status code.
 * Works with Bruno's `res` object or any { status } / { statusCode } object.
 * @param {object} res - Response object
 * @param {number} expectedStatus - Expected HTTP status code
 * @param {string} [message] - Custom error message
 */
function assertStatus(res, expectedStatus, message) {
  const actual = res.status || res.statusCode;
  if (actual !== expectedStatus) {
    throw new Error(message || `Expected status ${expectedStatus} but got ${actual}`);
  }
}

/**
 * Assert that the body contains specific fields (supports dot-notation paths).
 * @param {object} body - Response body
 * @param {string[]} fields - Array of field names or dot-paths
 */
function assertFields(body, fields) {
  const missing = [];
  for (const field of fields) {
    const parts = field.split('.');
    let current = body;
    let found = true;
    for (const part of parts) {
      if (current == null || typeof current !== 'object' || !(part in current)) {
        found = false;
        break;
      }
      current = current[part];
    }
    if (!found) missing.push(field);
  }
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Assert that a value matches the expected type.
 * @param {*} value
 * @param {string} expectedType - 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
 * @param {string} [message]
 */
function assertType(value, expectedType, message) {
  let actual;
  if (value === null) actual = 'null';
  else if (Array.isArray(value)) actual = 'array';
  else actual = typeof value;
  if (actual !== expectedType) {
    throw new Error(message || `Expected type "${expectedType}" but got "${actual}"`);
  }
}

/**
 * Quick schema builder — creates a JSON Schema from a sample value.
 * @param {*} sample - A sample response value
 * @returns {object} JSON Schema object
 */
function schemaFrom(sample) {
  const schema = getGenerateSchema().json(sample);
  schema['$schema'] = 'http://json-schema.org/draft-07/schema#';
  return schema;
}

/**
 * Check if data contains potential PII (standalone, no instance needed).
 * @param {*} data
 * @returns {{ hasPII: boolean, findings: Array<{type: string, path: string}> }}
 */
function checkPII(data) {
  const findings = [];
  const scan = (obj, p = '') => {
    if (typeof obj === 'string') {
      for (const [type, pattern] of Object.entries(piiPatterns)) {
        if (pattern.test(obj)) findings.push({ type, path: p || 'root' });
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        scan(value, p ? `${p}.${key}` : key);
      }
    }
  };
  scan(data);
  return { hasPII: findings.length > 0, findings };
}

// ─── NEW: Additional assertion helpers for API testing ──────────────────────

/**
 * Assert that every item in an array matches a schema.
 * Common pattern: GET /users returns a list — validate each item.
 * @param {Array} data - Array of items
 * @param {object} itemSchema - JSON Schema for each item
 * @param {string} [message] - Custom error message
 */
function assertArrayOf(data, itemSchema, message) {
  if (!Array.isArray(data)) {
    throw new Error(message || `Expected an array but got ${typeof data}`);
  }
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const fn = ajv.compile(itemSchema);
  const failures = [];
  data.forEach((item, index) => {
    if (!fn(item)) {
      const details = fn.errors.map(e => `${e.instancePath || '/'}: ${e.message}`).join('; ');
      failures.push(`[${index}]: ${details}`);
    }
  });
  if (failures.length > 0) {
    throw new Error(`${message || 'Array item validation failed'}:\n  ${failures.join('\n  ')}`);
  }
}

/**
 * Assert a value is one of an allowed set.
 * Useful for status fields, role fields, enum-like values.
 * @param {*} value - The value to check
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} [message] - Custom error message
 */
function assertEnum(value, allowedValues, message) {
  if (!allowedValues.includes(value)) {
    throw new Error(message || `Expected one of [${allowedValues.join(', ')}] but got "${value}"`);
  }
}

/**
 * Assert a string matches a regex pattern.
 * Useful for format checks without full schema (UUID, date patterns, etc).
 * @param {string} value - The string to check
 * @param {RegExp} regex - Regular expression pattern
 * @param {string} [message] - Custom error message
 */
function assertMatch(value, regex, message) {
  if (typeof value !== 'string') {
    throw new Error(message || `Expected a string but got ${typeof value}`);
  }
  if (!regex.test(value)) {
    throw new Error(message || `"${value}" does not match pattern ${regex}`);
  }
}

/**
 * Assert a number falls within a range (inclusive).
 * Common for pagination (page >= 1), counts, scores, etc.
 * @param {number} value - The number to check
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} [message] - Custom error message
 */
function assertRange(value, min, max, message) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(message || `Expected a number but got ${typeof value}`);
  }
  if (value < min || value > max) {
    throw new Error(message || `Expected ${value} to be between ${min} and ${max}`);
  }
}

/**
 * Assert value is not null, undefined, empty string, or empty array.
 * The most common API response check.
 * @param {*} value - Value to check
 * @param {string} [message] - Custom error message
 */
function assertNonEmpty(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || `Expected a non-empty value but got ${value}`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(message || 'Expected a non-empty string but got ""');
  }
  if (Array.isArray(value) && value.length === 0) {
    throw new Error(message || 'Expected a non-empty array but got []');
  }
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    throw new Error(message || 'Expected a non-empty object but got {}');
  }
}

/**
 * Assert response time is within acceptable limits.
 * Thin wrapper around Bruno's res.getResponseTime() that throws on failure.
 * @param {object} res - Bruno response object (or any object with getResponseTime())
 * @param {number} maxMs - Maximum allowed response time in milliseconds
 * @param {string} [message] - Custom error message
 */
function assertResponseTime(res, maxMs, message) {
  let responseTime;
  if (typeof res.getResponseTime === 'function') {
    responseTime = res.getResponseTime();
  } else if (typeof res.responseTime === 'number') {
    responseTime = res.responseTime;
  } else {
    throw new Error('Response object does not have getResponseTime() or responseTime property');
  }
  if (responseTime > maxMs) {
    throw new Error(message || `Response time ${responseTime}ms exceeds limit of ${maxMs}ms`);
  }
}

/**
 * Assert that a date string falls between two dates.
 * Useful for checking createdAt, updatedAt, expiry fields.
 * @param {string|Date} value - Date to check
 * @param {string|Date} start - Start of range
 * @param {string|Date} end - End of range
 * @param {string} [message] - Custom error message
 */
function assertDateBetween(value, start, end, message) {
  const d = new Date(value);
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(d.getTime())) throw new Error(message || `Invalid date: "${value}"`);
  if (d < s || d > e) {
    throw new Error(message || `Date ${d.toISOString()} is not between ${s.toISOString()} and ${e.toISOString()}`);
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────
// Primary export: the class (backward compatible)
module.exports = SchemaValidator;

// Factory
module.exports.createValidator = (schemaBasePath, opts) => new SchemaValidator(schemaBasePath, opts);

// Standalone helpers for Bruno CLI tests (no instance required)
module.exports.validate = validate;
module.exports.assertSchema = assertSchema;
module.exports.assertStatus = assertStatus;
module.exports.assertFields = assertFields;
module.exports.assertType = assertType;
module.exports.schemaFrom = schemaFrom;
module.exports.checkPII = checkPII;

// NEW: Additional assertion helpers for API testing
module.exports.assertArrayOf = assertArrayOf;
module.exports.assertEnum = assertEnum;
module.exports.assertMatch = assertMatch;
module.exports.assertRange = assertRange;
module.exports.assertNonEmpty = assertNonEmpty;
module.exports.assertResponseTime = assertResponseTime;
module.exports.assertDateBetween = assertDateBetween;

