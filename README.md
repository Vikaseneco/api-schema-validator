# bruno-api-schema-validator

> Advanced JSON schema validation library for API testing with 17 powerful features including automatic schema generation, performance testing, mock data generation, and CI/CD integration.

[![npm version](https://img.shields.io/npm/v/bruno-api-schema-validator.svg)](https://www.npmjs.com/package/bruno-api-schema-validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Key Features

### Core Validation
- ✅ **Auto-Detection** - Automatically detects Bruno environment
- ✅ **Automatic Schema Generation** - Generate JSON schemas from API responses  
- ✅ **Synchronous & Asynchronous Validation** - Choose the right method
- ✅ **Smart Format Detection** - Auto-detects 10+ string formats (UUID, email, date-time, etc.)
- ✅ **Advanced AJV Options** - allErrors, verbose, custom formats, union types

### Advanced Features (NEW!)
- 🔥 **Schema Evolution** - Track versions, detect breaking changes automatically
- 🔥 **Performance Testing** - Validate response time and size limits
- 🔥 **Mock Data Generation** - Generate test data from schemas using Faker
- 🔥 **OpenAPI/Swagger Support** - Import/export OpenAPI specifications
- 🔥 **Snapshot Testing** - Differential validation with field ignoring
- 🔥 **Environment-Specific Schemas** - Different schemas per environment
- 🔥 **Request Validation** - Validate body, headers, and query parameters
- 🔥 **Automated Documentation** - Generate markdown docs from schemas
- 🔥 **CI/CD Reports** - JUnit XML, HTML, JSON, Console reporters
- 🔥 **Schema Migration** - Transform schemas between versions
- 🔥 **Fuzzy Matching** - Tolerance-based validation for flexible testing
- 🔥 **Batch Validation** - Parallel validation of multiple endpoints
- 🔥 **Runtime Modification** - Dynamically modify schemas
- 🔥 **Security Validation** - PII detection, GDPR/HIPAA compliance
- 🔥 **Performance Benchmarking** - Measure validation speed

## 📦 Installation

```bash
npm install bruno-api-schema-validator
```

## 🎯 Quick Start

### Basic Usage

```javascript
const SchemaValidator = require('bruno-api-schema-validator');

// For Bruno: Auto-detects environment!
const validator = new SchemaValidator();

// Your API response
const apiResponse = [
  {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Asset",
    email: "test@example.com"
  }
];

// Generate schema (one-time)
await validator.createJsonSchema('api', 'Users', apiResponse);

// Validate responses
const isValid = validator.validateJsonSchemaSync('api', 'Users', apiResponse);
console.log(isValid); // true
```

### Bruno API Testing

```javascript
// In your .bru file
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();
  
  test("Valid response schema", function(){
    const result = validator.validateJsonSchemaSync('api', 'Users', jsonData);
    expect(result).to.equal(true);
  });
}
```

```
bruno-collection/
├── api-schemas/           ← Default folder (auto-detected)
│   └── jsonplaceholder/
│       └── Users_schema.json
└── GetUsers.bru          ← Your test file
```

> **💡 Pro Tip:** The validator automatically detects Bruno environment and uses `bru.cwd()` internally! No manual path construction needed. Just call `new SchemaValidator()` and you're done!

---

## 🔍 Smart Format & Type Detection (New in v1.3.0!)

The schema generator now automatically detects **10 industry-standard JSON Schema formats** during schema creation and enforces them during validation. No configuration required — it just works.

### Supported Formats

| Format | JSON Schema keyword | Example value |
|---|---|---|
| ISO 8601 timestamp | `date-time` | `2024-07-25T13:36:08.365Z` |
| ISO 8601 date | `date` | `2024-07-25` |
| ISO 8601 time | `time` | `13:36:08.365Z` |
| ISO 8601 duration | `duration` | `P1Y2M3DT4H5M6S` |
| UUID (RFC 4122) | `uuid` | `550e8400-e29b-41d4-a716-446655440000` |
| E-mail address | `email` | `user@example.com` |
| Absolute URI / URL | `uri` | `https://api.example.com/v1` |
| IPv4 address | `ipv4` | `192.168.1.100` |
| IPv6 address | `ipv6` | `2001:db8::1` |
| Hostname (FQDN) | `hostname` | `api.example.com` |

### What the Generated Schema Looks Like

Given this API response:

```json
[
  {
    "assetId": "550e8400-e29b-41d4-a716-446655440000",
    "ownerEmail": "user@example.com",
    "createdDate": "2024-07-25T13:36:08.3658245Z",
    "reportDate": "2024-07-25",
    "apiEndpoint": "https://api.example.com/v1/assets",
    "serverIp": "192.168.1.100",
    "status": "active",
    "count": 42,
    "lastModifiedDate": null
  }
]
```

The generated schema will be:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "assetId":          { "type": "string", "format": "uuid" },
      "ownerEmail":       { "type": "string", "format": "email" },
      "createdDate":      { "type": "string", "format": "date-time" },
      "reportDate":       { "type": "string", "format": "date" },
      "apiEndpoint":      { "type": "string", "format": "uri" },
      "serverIp":         { "type": "string", "format": "ipv4" },
      "status":           { "type": "string" },
      "count":            { "type": "number" },
      "lastModifiedDate": { "type": ["string", "null"], "format": "date-time" }
    },
    "required": ["assetId", "ownerEmail", "createdDate", "reportDate", "apiEndpoint", "serverIp", "status", "count"]
  }
}
```

> **Note:** `lastModifiedDate` is `null` in the sample, so it automatically becomes `["string", "null"]` and is excluded from `required`.

### Nullable & Required Field Detection

The scanner reads **all items in the array**, not just the first one. This means:

| Scenario | Generated type |
|---|---|
| Field is always a timestamp | `{ "type": "string", "format": "date-time" }` |
| Field is sometimes `null` | `{ "type": ["string", "null"], "format": "date-time" }` |
| Field absent in some items | `{ "type": ["string", "null"] }` + excluded from `required` |
| Field has mixed types | `{ "type": ["string", "number"] }` (no format) |
| Plain word like `"active"` | `{ "type": "string" }` (no false format match) |

---

### 🆕 Auto-Create Schemas (New in v1.1.0!)

No schema file yet? No problem! Use `createSchema: true` to automatically generate schemas on first run:

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();
  
  test("Auto-create and validate schema", function(){
    // First run: Creates schema automatically
    // Subsequent runs: Validates against existing schema
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder',
      'Users',
      jsonData,
      { createSchema: true }  // 🎉 Magic happens here!
    );
    expect(result).to.equal(true);
  });
}
```

**Benefits:**
- ✅ No manual schema creation needed
- ✅ Automatically creates folder structure
- ✅ Perfect for new tests - just add `createSchema: true`
- ✅ Works in both Bruno and Node.js environments

## 📚 API Documentation

### Constructor

#### `new SchemaValidator([schemaPathOrFolderName])`

Creates a new validator instance with automatic environment detection.

**Parameters:**

- `schemaPathOrFolderName` (string, optional) - Default: `'api-schemas'`
  - **In Bruno:** Folder name within your collection (e.g., `'api-schemas'`, `'my-schemas'`)
  - **In Node.js:** Full path to schema directory (absolute or relative)

**Behavior:**

- **Bruno Environment:** Automatically detects `bru.cwd()` and constructs path
- **Node.js Environment:** Treats parameter as full directory path

**Examples:**

```javascript
// ========================================
// BRUNO USAGE (Automatic Detection!)
// ========================================

// Default: Uses 'api-schemas' folder in your Bruno collection
const validator = new SchemaValidator();

// Custom folder name in your Bruno collection
const validator = new SchemaValidator('my-custom-schemas');

// ========================================
// NODE.JS USAGE
// ========================================

// Absolute path
const validator = new SchemaValidator('C:/projects/my-api/api-schemas');

// Relative path with __dirname
const path = require('path');
const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));
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
// Fetch data from JSONPlaceholder API
const response = await fetch('https://jsonplaceholder.typicode.com/users');
const users = await response.json();

await validator.createJsonSchema('jsonplaceholder', 'Users', users);
// Creates: ./api-schemas/jsonplaceholder/Users_schema.json
```

---

#### `validateJsonSchemaSync(folderName, fileName, body, options)`

Synchronously validates data against a schema. **Use this in Bruno tests.**

**Parameters:**

- `folderName` (string) - Subdirectory path
- `fileName` (string) - Schema file base name
- `body` (object/array) - Data to validate
- `options` (object, optional):
  - `createSchema` (boolean) - Auto-create schema if it doesn't exist. Default: `false`
  - `verbose` (boolean) - Show detailed errors. Default: `true`
  - `throwOnError` (boolean) - Throw exception on validation failure. Default: `false`

**Returns:** `boolean` - `true` if valid, `false` otherwise

**Examples:**

```javascript
// Standard validation
const isValid = validator.validateJsonSchemaSync(
  'jsonplaceholder',
  'Users',
  usersData,
  { verbose: true, throwOnError: false }
);

// Auto-create schema on first run (perfect for new tests!)
const isValid = validator.validateJsonSchemaSync(
  'jsonplaceholder',
  'Users',
  usersData,
  { createSchema: true }  // Creates schema if missing
);
```

---

#### `validateJsonSchema(folderName, fileName, body, options)`

Asynchronously validates data against a schema. **Use this in Node.js test frameworks (Jest, Mocha, Vitest) and automation scripts.**

> ⚠️ **Note:** Bruno doesn't support async/await in tests. Use `validateJsonSchemaSync()` for Bruno instead.

**Parameters:**

- `folderName` (string) - Subdirectory path
- `fileName` (string) - Schema file base name
- `body` (object/array) - Data to validate
- `options` (object, optional):
  - `createSchema` (boolean) - Create schema if it doesn't exist. Default: `false`
  - `verbose` (boolean) - Show detailed errors. Default: `true`
  - `throwOnError` (boolean) - Throw exception on validation failure. Default: `false`

**Returns:** `Promise<boolean>` - `true` if valid, `false` otherwise

**Use Cases:**
- ✅ Jest/Mocha/Vitest test suites
- ✅ CI/CD validation scripts
- ✅ Node.js automation scripts
- ✅ Integration test frameworks
- ❌ Bruno API tests (use sync version)

**Example:**

```javascript
// Jest/Mocha test example
describe('API Schema Validation', () => {
  it('should validate users endpoint', async () => {
    const validator = new SchemaValidator('./api-schemas');
    const response = await fetch('https://jsonplaceholder.typicode.com/users');
    const users = await response.json();

    const isValid = await validator.validateJsonSchema(
      'jsonplaceholder',
      'Users',
      users,
      { createSchema: true, verbose: true }
    );
    
    expect(isValid).toBe(true);
  });
});

// CI/CD script example
async function validateContract() {
  const validator = new SchemaValidator('./schemas');
  const data = await fetchApiData();
  
  await validator.validateJsonSchema('api/v1', 'Users', data, {
    throwOnError: true  // Fail CI if validation fails
  });
}
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
│   └── bruno-api-schema-validator/
├── api-schemas/                        ← Your schemas here
│   ├── jsonplaceholder/
│   │   ├── Users_schema.json
│   │   ├── Posts_schema.json
│   │   └── Comments_schema.json
│   └── api/
│       └── v1/
│           ├── Products_schema.json
│           └── Orders_schema.json
└── tests/
    └── api/
        └── users.test.js
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
const SchemaValidator = require('bruno-api-schema-validator');

// Super clean - no path construction needed!
const validator = new SchemaValidator();

// First time: Create schema from JSONPlaceholder API response
const response = await fetch('https://jsonplaceholder.typicode.com/users');
const users = await response.json();

await validator.createJsonSchema('jsonplaceholder', 'Users', users);
console.log('✓ Schema created successfully');

// Now use it in tests
const isValid = validator.validateJsonSchemaSync('jsonplaceholder', 'Users', users);
console.log('Validation:', isValid); // true
```

### Example 2: Multiple Endpoints

```javascript
// Auto-detected environment
const validator = new SchemaValidator();

// Test multiple JSONPlaceholder endpoints with separate schemas
test("Users endpoint schema", async () => {
  const users = await fetch('https://jsonplaceholder.typicode.com/users').then(r => r.json());
  expect(validator.validateJsonSchemaSync('jsonplaceholder', 'Users', users)).toBe(true);
});

test("Posts endpoint schema", async () => {
  const posts = await fetch('https://jsonplaceholder.typicode.com/posts').then(r => r.json());
  expect(validator.validateJsonSchemaSync('jsonplaceholder', 'Posts', posts)).toBe(true);
});

test("Comments endpoint schema", async () => {
  const comments = await fetch('https://jsonplaceholder.typicode.com/comments').then(r => r.json());
  expect(validator.validateJsonSchemaSync('jsonplaceholder', 'Comments', comments)).toBe(true);
});
```

### Example 3: Custom Error Handling

```javascript
// One line initialization
const validator = new SchemaValidator();

const response = await fetch('https://jsonplaceholder.typicode.com/users');
const users = await response.json();

try {
  const isValid = validator.validateJsonSchemaSync(
    'jsonplaceholder',
    'Users',
    users,
    { verbose: true, throwOnError: true }
  );
  console.log('✓ Validation passed');
} catch (error) {
  console.error('Validation failed:', error.message);
  // Send alert, log to monitoring system, etc.
  sendAlert('API schema validation failed');
}
```

### Example 4: Conditional Schema Creation

```javascript
// Clean and simple
const validator = new SchemaValidator();

// Fetch users from JSONPlaceholder
const response = await fetch('https://jsonplaceholder.typicode.com/users');
const users = await response.json();

// Create schema only if it doesn't exist
if (!validator.schemaExists('jsonplaceholder', 'Users')) {
  await validator.createJsonSchema('jsonplaceholder', 'Users', users);
  console.log('✓ New schema created for Users endpoint');
} else {
  console.log('Schema already exists, validating...');
  const isValid = validator.validateJsonSchemaSync('jsonplaceholder', 'Users', users);
  console.log('Valid:', isValid);
}
```

### Example 5: Bruno - Complete Integration

```javascript
// File: GetUsers.bru

meta {
  name: Get Users
  type: http
  seq: 1
}

get {
  url: https://jsonplaceholder.typicode.com/users
  body: none
  auth: none
}

docs {
  This request retrieves a list of users from the JSONPlaceholder API.
}

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  
  // One line - that's it!
  const validator = new SchemaValidator();
  
  // Schema validation test
  test("Valid response JSON schema - Users", function(){
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder',
      'Users',
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
  
  test("At least one user returned", function () {
    expect(jsonData.length).to.be.greaterThan(0);
  });
  
  test("First user has required fields", function () {
    expect(jsonData[0]).to.have.property('id');
    expect(jsonData[0]).to.have.property('name');
    expect(jsonData[0]).to.have.property('email');
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

### Issue: Schema too strict — `null` values or optional fields rejected

**Problem:** API sometimes returns `null` for a field, but the schema has `{ "type": "string" }`.

**Solution (v1.3.0+):** This is now handled **automatically** when generating schemas.
The generator scans all sample items: if any item has `null` for a field, the type
becomes `["string", "null"]` and the field is excluded from `required`.

If you have an **older schema** that was generated before v1.3.0, regenerate it:

```javascript
// Delete the old schema file and recreate it from a response that includes null values
await validator.createJsonSchema('api/v1', 'Users', responseWithSomeNulls);
```

Or manually edit the schema file:

```json
{
  "properties": {
    "lastModifiedDate": {
      "type": ["string", "null"],
      "format": "date-time"
    }
  }
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

- [ ] Install package: `npm install bruno-api-schema-validator`
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
7. **Multi-Item Samples:** When generating schemas, pass a response with **multiple items** and include records where optional fields are `null` — this gives the generator the full picture for nullable and required field detection
8. **Regenerate After API Changes:** If an API field changes its type or becomes nullable, delete the old schema file and regenerate it from a fresh response

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Happy Testing!!

## 🔗 Links

- [GitHub Repository](https://github.com/eneco/api-schema-validator)
- [NPM Package](https://www.npmjs.com/package/bruno-api-schema-validator)
- [JSON Schema Specification](https://json-schema.org/)
- [AJV Validator](https://ajv.js.org/)
- [Bruno API Client](https://www.usebruno.com/)

## 📞 Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Contact: <vikas.yadav@eneco.com>

---

**Made with ❤️ by Vikas**
