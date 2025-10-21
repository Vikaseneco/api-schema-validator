const Ajv = require('ajv');
const path = require('path');
const generateSchema = require('generate-schema');
const fs = require('fs');
const fsPromises = require('fs').promises;

/**
 * SchemaValidator - A flexible JSON schema validation library
 */
class SchemaValidator {
  /**
   * Initialize the SchemaValidator with a base directory for storing schemas
   * @param {string} schemaBasePath - Base directory for schema files (required)
   *                                  Can be absolute or relative path
   * @example
   * // For Bruno: Use bru.cwd() to construct path to collection schemas
   * const collectionPath = bru.cwd();
   * const schemaPath = `${collectionPath}/api-schemas`;
   * const validator = new SchemaValidator(schemaPath);
   * 
   * // For absolute paths:
   * const validator = new SchemaValidator('C:/projects/my-api/api-schemas');
   * 
   * // For Node.js with relative paths:
   * const path = require('path');
   * const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));
   */
  constructor(schemaBasePath) {
    if (!schemaBasePath) {
      throw new Error(
        'SchemaValidator requires a schema path. Please provide the path to your schema directory.\n' +
        'Example for Bruno: new SchemaValidator(`${bru.cwd()}/api-schemas`)\n' +
        'Example for Node.js: new SchemaValidator("C:/projects/my-api/api-schemas")'
      );
    }
    
    // Store the path as provided (can be absolute or relative)
    this.schemaBasePath = schemaBasePath;
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

    // If the input is an array and all items have the same structure, use list validation
    if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object') {
      // Use the first item as the template for all items
      const item = json[0];
      schema.items = {
        type: "object",
        properties: {},
        required: []
      };
      
      for (const key of Object.keys(item)) {
        // Set property types
        let value = item[key];
        let type = typeof value;
        if (value === null) type = "null";
        if (Array.isArray(value)) type = "array";
        schema.items.properties[key] = { type: type };
      }
      
      // Set required fields
      schema.items.required = Object.keys(item);
    }

    // Remove extra fields if present
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
   * @param {boolean} options.verbose - Enable verbose error logging (default: true)
   * @param {boolean} options.throwOnError - Throw error instead of returning false (default: false)
   * @returns {boolean} The result of the validation
   */
  validateJsonSchemaSync(folderName, fileName, body, options = {}) {
    const { verbose = true, throwOnError = false } = options;
    const schemaFilePath = path.join(this.schemaBasePath, folderName, `${fileName}_schema.json`);
    
    try {
      const schemaFileContent = fs.readFileSync(schemaFilePath, 'utf8');
      const existingSchema = JSON.parse(schemaFileContent);
      
      const ajv = new Ajv({ allErrors: false });
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
