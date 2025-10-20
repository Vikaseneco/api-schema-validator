# @eneco/api-schema-validator

> A flexible JSON schema validation library for API testing with automatic schema generation and synchronous/asynchronous validation support.

[![npm version](https://img.shields.io/npm/v/@eneco/api-schema-validator.svg)](https://www.npmjs.com/package/@eneco/api-schema-validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- ✅ **Automatic Schema Generation** - Generate JSON schemas from API responses
- ✅ **Synchronous & Asynchronous Validation** - Choose the right method for your use case
- ✅ **Bruno API Testing Integration** - Perfect for Bruno .bru test files
- ✅ **Detailed Error Reporting** - Know exactly what failed and where
- ✅ **Array Validation** - Validates all array items uniformly
- ✅ **Flexible Schema Storage** - Organize schemas by endpoint/version
- ✅ **Draft-07 JSON Schema** - Standards-compliant validation
- ✅ **Zero Configuration** - Works out of the box

## 📦 Installation

```bash
npm install @eneco/api-schema-validator
```

## 🎯 Quick Start

### Basic Usage

```javascript
const SchemaValidator = require('@eneco/api-schema-validator');

// Create validator instance
const validator = new SchemaValidator('./api-schemas');

// Your API response
const apiResponse = [
  { name: "Asset-001", id: "123", fullName: "Solar Farm" }
];

// Step 1: Generate schema (one-time)
await validator.createJsonSchema('vpp/Asset Manager', 'RegisteredAssets', apiResponse);

// Step 2: Validate responses
const isValid = validator.validateJsonSchemaSync('vpp/Asset Manager', 'RegisteredAssets', apiResponse);
console.log(isValid); // true
```

### Bruno API Testing Integration

```javascript
// In your .bru file
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('@eneco/api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  test("Valid response JSON schema", function(){
    const result = validator.validateJsonSchemaSync(
      'vpp/Asset Manager', 
      'RegisteredAssets', 
      jsonData
    );
    expect(result).to.equal(true);
  });
  
  test("Status code is 200", function () {
    expect(res.getStatus()).to.equal(200);
  });
}
```

## 📚 API Documentation

### Constructor

#### `new SchemaValidator(schemaBasePath)`

Creates a new validator instance.

**Parameters:**
- `schemaBasePath` (string, optional) - Base directory for schema files. Default: `'./api-schemas'`

**Example:**
```javascript
const validator = new SchemaValidator('./my-schemas');
```

---

### Methods

#### `createJsonSchema(folderName, fileName, json)`

Generates a JSON schema from a response and saves it to disk.

**Parameters:**
- `folderName` (string) - Subdirectory path (e.g., `'vpp/Asset Manager'`)
- `fileName` (string) - Schema file base name (e.g., `'RegisteredAssets'`)
- `json` (object/array) - JSON data to generate schema from

**Returns:** `Promise<string>` - Path to created schema file

**Example:**
```javascript
await validator.createJsonSchema('api/v1', 'Users', userApiResponse);
// Creates: ./api-schemas/api/v1/Users_schema.json
```

---

#### `validateJsonSchemaSync(folderName, fileName, body, options)`

Synchronously validates data against a schema. **Use this in Bruno tests.**

**Parameters:**
- `folderName` (string) - Subdirectory path
- `fileName` (string) - Schema file base name
- `body` (object/array) - Data to validate
- `options` (object, optional):
  - `verbose` (boolean) - Show detailed errors. Default: `true`
  - `throwOnError` (boolean) - Throw exception on validation failure. Default: `false`

**Returns:** `boolean` - `true` if valid, `false` otherwise

**Example:**
```javascript
const isValid = validator.validateJsonSchemaSync(
  'vpp/Asset Manager',
  'RegisteredAssets',
  apiResponse,
  { verbose: true, throwOnError: false }
);
```

---

#### `validateJsonSchema(folderName, fileName, body, options)`

Asynchronously validates data against a schema.

**Parameters:**
- `folderName` (string) - Subdirectory path
- `fileName` (string) - Schema file base name
- `body` (object/array) - Data to validate
- `options` (object, optional):
  - `createSchema` (boolean) - Create schema if it doesn't exist. Default: `false`
  - `verbose` (boolean) - Show detailed errors. Default: `true`
  - `throwOnError` (boolean) - Throw exception on validation failure. Default: `false`

**Returns:** `Promise<boolean>` - `true` if valid, `false` otherwise

**Example:**
```javascript
// Validate and create schema if missing
const isValid = await validator.validateJsonSchema(
  'api/v1',
  'Products',
  productsResponse,
  { createSchema: true, verbose: true }
);
```

---

#### `schemaExists(folderName, fileName)`

Check if a schema file exists.

**Parameters:**
- `folderName` (string) - Subdirectory path
- `fileName` (string) - Schema file base name

**Returns:** `boolean` - `true` if schema exists

**Example:**
```javascript
if (validator.schemaExists('api/v1', 'Users')) {
  console.log('Schema exists!');
}
```

---

#### `getSchemaPath(folderName, fileName)`

Get the full path to a schema file.

**Parameters:**
- `folderName` (string) - Subdirectory path
- `fileName` (string) - Schema file base name

**Returns:** `string` - Full path to schema file

**Example:**
```javascript
const path = validator.getSchemaPath('api/v1', 'Users');
console.log(path); // ./api-schemas/api/v1/Users_schema.json
```

---

## 📁 Folder Structure

When you use this package, schemas are organized like this:

```
your-project/
├── package.json
├── node_modules/
│   └── @eneco/
│       └── api-schema-validator/
├── api-schemas/                        ← Your schemas here
│   ├── vpp/
│   │   ├── Asset Manager/
│   │   │   ├── RegisteredAssets_schema.json
│   │   │   ├── AssetDetails_schema.json
│   │   │   └── OperationalConfig_schema.json
│   │   ├── Asset Schedule/
│   │   │   ├── Timeseries_schema.json
│   │   │   └── StrikePrice_schema.json
│   │   └── TSO/
│   │       └── Setpoints_schema.json
│   └── api/
│       └── v1/
│           ├── Users_schema.json
│           └── Products_schema.json
└── tests/
    └── api/
        └── assets.test.js
```

## 🔄 How It Works

### Schema Generation & Validation Flow

```
Step 1: First API Call - Generate Schema
┌─────────────────┐
│   API Response  │
│   (JSON data)   │
└────────┬────────┘
         │
         ▼
   createJsonSchema()
         │
         ▼
┌─────────────────────────────────┐
│ RegisteredAssets_schema.json    │
│ (Stored in api-schemas/)        │
└─────────────────────────────────┘

Step 2: Subsequent Calls - Validate
┌─────────────────┐          ┌─────────────────────────┐
│   API Response  │          │ Stored Schema File      │
└────────┬────────┘          └───────────┬─────────────┘
         │                               │
         └──────────┬────────────────────┘
                    ▼
          validateJsonSchemaSync()
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    ✓ PASS                ✗ FAIL
                    (Shows exactly
                     what's wrong)
```

## 💡 Use Cases

### 1. API Contract Testing

Ensure your API maintains its contract across deployments.

```javascript
test("API contract validation", function(){
  const result = validator.validateJsonSchemaSync('api/v1', 'Users', jsonData);
  expect(result).to.equal(true);
});
```

### 2. Regression Detection

Catch breaking changes before they reach production.

```javascript
// If API structure changes, test fails immediately
const isValid = validator.validateJsonSchemaSync('api/v1', 'Products', response);
if (!isValid) {
  console.error('Breaking change detected in Products API!');
}
```

### 3. Multi-Environment Testing

Same schema validates DEV, TEST, ACC, and PROD.

```javascript
// Works across all environments
test("Schema consistent across environments", function(){
  const result = validator.validateJsonSchemaSync('vpp/Asset Manager', 'Assets', jsonData);
  expect(result).to.equal(true);
});
```

### 4. Documentation as Code

Schema files serve as living API documentation.

```bash
# Your schema files document the API structure
cat api-schemas/api/v1/Users_schema.json
```

## 🎨 Advanced Examples

### Example 1: First-Time Schema Creation

```javascript
const SchemaValidator = require('@eneco/api-schema-validator');
const validator = new SchemaValidator('./api-schemas');

// First time: Create schema from a good API response
const goodResponse = await fetch('https://api.example.com/assets').then(r => r.json());

await validator.createJsonSchema('api/v1', 'Assets', goodResponse);
console.log('✓ Schema created successfully');

// Now use it in tests
const isValid = validator.validateJsonSchemaSync('api/v1', 'Assets', goodResponse);
console.log('Validation:', isValid); // true
```

### Example 2: Multiple Endpoints

```javascript
const validator = new SchemaValidator('./api-schemas');

// Test multiple related endpoints with separate schemas
test("Assets endpoint schema", () => {
  expect(validator.validateJsonSchemaSync('api/v1', 'Assets', assetsData)).toBe(true);
});

test("Users endpoint schema", () => {
  expect(validator.validateJsonSchemaSync('api/v1', 'Users', usersData)).toBe(true);
});

test("Orders endpoint schema", () => {
  expect(validator.validateJsonSchemaSync('api/v1', 'Orders', ordersData)).toBe(true);
});
```

### Example 3: Custom Error Handling

```javascript
try {
  const isValid = validator.validateJsonSchemaSync(
    'api/v1',
    'Users',
    userData,
    { verbose: true, throwOnError: true }
  );
} catch (error) {
  console.error('Validation failed:', error.message);
  // Send alert, log to monitoring system, etc.
  sendAlert('API schema validation failed');
}
```

### Example 4: Conditional Schema Creation

```javascript
const validator = new SchemaValidator('./api-schemas');

// Create schema only if it doesn't exist
if (!validator.schemaExists('api/v1', 'NewEndpoint')) {
  await validator.createJsonSchema('api/v1', 'NewEndpoint', apiResponse);
  console.log('New schema created');
} else {
  console.log('Schema already exists, validating...');
  const isValid = validator.validateJsonSchemaSync('api/v1', 'NewEndpoint', apiResponse);
  console.log('Valid:', isValid);
}
```

### Example 5: Bruno - Complete Integration

```javascript
// File: GetRegisteredAssets.bru

meta {
  name: GetRegisteredAssets_Automatic
  type: http
  seq: 1
}

get {
  url: {{AssetURL}}/v1/Asset/GetRegisteredAssets?steeringMode=Automatic
  body: none
  auth: inherit
}

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('@eneco/api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  // Schema validation test
  test("Valid response JSON schema - Asset Registered", function(){
    const result = validator.validateJsonSchemaSync(
      'vpp/Asset Manager',
      'Automatic_RegisteredAssets',
      jsonData,
      { verbose: true }
    );
    expect(result).to.equal(true);
  });
  
  // Traditional tests
  test("Status code is 200", function () {
    expect(res.getStatus()).to.equal(200);
  });
  
  test("Response is an array", function () {
    expect(jsonData).to.be.an("array");
  });
  
  test("At least one asset returned", function () {
    expect(jsonData.length).to.be.greaterThan(0);
  });
}
```

## 🐛 Troubleshooting

### Issue: Schema file not found (ENOENT)

**Error:**
```
Error loading or validating schema file: ENOENT: no such file or directory
```

**Solution:**
1. Ensure schema was created first:
   ```javascript
   await validator.createJsonSchema('api/v1', 'Users', sampleResponse);
   ```
2. Verify the schema path:
   ```javascript
   console.log(validator.getSchemaPath('api/v1', 'Users'));
   ```

### Issue: Validation fails unexpectedly

**Check the console output for detailed errors:**
```
✗ SCHEMA VALIDATION ERRORS:
  Schema: api/v1/Users
  File: ./api-schemas/api/v1/Users_schema.json

  1. At /0/id: must be string
     Expected type: string
     Actual value: 12345
```

**Solution:** Fix the data type or update the schema if API changed legitimately.

### Issue: Schema too strict

**Problem:** Schema doesn't allow `null` values or optional fields.

**Solution:** Manually edit the schema file:
```json
{
  "properties": {
    "optionalField": {
      "type": ["string", "null"]
    }
  },
  "required": ["name", "id"]
}
```

## 📊 Comparison: Before vs After

### Before (Traditional Testing)

```javascript
test("Check all properties", () => {
  for (let i = 0; i < jsonData.length; i++) {
    expect(jsonData[i]).to.have.keys('name', 'id', 'fullName', 'assetConfiguration');
    expect(jsonData[i].name).to.be.a("string");
    expect(jsonData[i].id).to.be.a("string");
    expect(jsonData[i].fullName).to.be.a("string");
    // ... 20+ more assertions
  }
});
```

**Issues:**
- 🔴 Verbose and repetitive
- 🔴 Doesn't catch unexpected fields
- 🔴 Hard to maintain
- 🔴 Manual effort for every field

### After (Schema Validation)

```javascript
test("Schema validation", function(){
  const result = validator.validateJsonSchemaSync('api/v1', 'Assets', jsonData);
  expect(result).to.equal(true);
});
```

**Benefits:**
- ✅ One line of code
- ✅ Comprehensive validation
- ✅ Catches all structural changes
- ✅ Easy to maintain

## 🚀 Getting Started Checklist

- [ ] Install package: `npm install @eneco/api-schema-validator`
- [ ] Create validator instance in your tests
- [ ] Generate schemas from good API responses
- [ ] Add schema validation tests to critical endpoints
- [ ] Run tests and verify they pass
- [ ] Commit schema files to version control
- [ ] Document schema organization in team wiki
- [ ] Set up CI/CD to run schema validation tests

## 📝 Best Practices

1. **Version Control:** Commit schema files to Git
2. **Schema Organization:** Use meaningful folder structures (e.g., `api/v1`, `api/v2`)
3. **One Schema Per Endpoint:** Don't reuse schemas unless endpoints are truly identical
4. **Update Schemas Carefully:** Review changes before updating schemas
5. **Test First:** Generate schemas from known-good responses
6. **Document Changes:** Add comments to schema files when needed

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Eneco VPP Testing Team

## 🔗 Links

- [GitHub Repository](https://github.com/eneco/api-schema-validator)
- [NPM Package](https://www.npmjs.com/package/@eneco/api-schema-validator)
- [JSON Schema Specification](https://json-schema.org/)
- [AJV Validator](https://ajv.js.org/)
- [Bruno API Client](https://www.usebruno.com/)

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: vpp-testing-team@eneco.com

---

**Made with ❤️ by the Eneco VPP Testing Team**
