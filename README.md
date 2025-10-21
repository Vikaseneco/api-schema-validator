# bruno-api-schema-validator

> A flexible JSON schema validation library for API testing with automatic schema generation and synchronous/asynchronous validation support. Perfect for Bruno API client and automated testing.

[![npm version](https://img.shields.io/npm/v/bruno-api-schema-validator.svg)](https://www.npmjs.com/package/bruno-api-schema-validator)
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
npm install bruno-api-schema-validator
```

## 🎯 Quick Start

### Basic Usage

```javascript
const SchemaValidator = require('bruno-api-schema-validator');

// Create validator instance
const validator = new SchemaValidator('./api-schemas');

// Your API response from https://jsonplaceholder.typicode.com/users
const apiResponse = [
  {
    id: 1,
    name: "Leanne Graham",
    username: "Bret",
    email: "Sincere@april.biz",
    address: {
      street: "Kulas Light",
      suite: "Apt. 556",
      city: "Gwenborough",
      zipcode: "92998-3874"
    }
  }
];

// Step 1: Generate schema (one-time)
await validator.createJsonSchema('jsonplaceholder', 'Users', apiResponse);

// Step 2: Validate responses
const isValid = validator.validateJsonSchemaSync('jsonplaceholder', 'Users', apiResponse);
console.log(isValid); // true
```

### Bruno API Testing Integration

```javascript
// In your .bru file: GetUsers.bru
// GET https://jsonplaceholder.typicode.com/users

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  
  // RECOMMENDED: Use forBruno() - automatically resolves path to your collection
  const validator = SchemaValidator.forBruno(bru, 'api-schemas');
  
  test("Valid response JSON schema - Users", function(){
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder', 
      'Users', 
      jsonData,
      { verbose: true }
    );
    expect(result).to.equal(true);
  });
  
  test("Status code is 200", function () {
    expect(res.getStatus()).to.equal(200);
  });
  
  test("Response is an array", function () {
    expect(jsonData).to.be.an("array");
  });
}
```

> **💡 Pro Tip:** The `forBruno(bru, 'api-schemas')` method automatically resolves the schema path relative to your Bruno collection directory. This ensures schemas are loaded from your collection folder, not Bruno's installation folder.

## 📚 API Documentation

### Constructor

#### `new SchemaValidator(schemaBasePath)`

Creates a new validator instance.

**Parameters:**

- `schemaBasePath` (string, optional) - Base directory for schema files. Default: `'./api-schemas'`
  - Can be relative (resolved from `process.cwd()`) or absolute path

**Example:**

```javascript
const validator = new SchemaValidator('./my-schemas');
```

---

### Static Methods

#### `SchemaValidator.forBruno(bru, schemaFolder)`

Creates a validator instance specifically for Bruno API testing. This is the **recommended** way to use the package in Bruno.

**Parameters:**

- `bru` (object) - The Bruno context object (available in all `.bru` test files)
- `schemaFolder` (string, optional) - Name of the schema folder relative to collection root. Default: `'api-schemas'`

**Returns:** `SchemaValidator` - A new validator instance with the correct path

**Example:**

```javascript
// In your .bru test file
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  
  // Automatically finds schemas in: <collection-root>/api-schemas/
  const validator = SchemaValidator.forBruno(bru);
  
  // Or specify a custom folder
  const validator2 = SchemaValidator.forBruno(bru, 'my-schemas');
}
```

**Why use this?** Bruno runs from its installation directory, not your collection directory. The `forBruno()` method uses `bru.cwd()` to automatically resolve the correct path to your collection's schema folder.

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
  - `verbose` (boolean) - Show detailed errors. Default: `true`
  - `throwOnError` (boolean) - Throw exception on validation failure. Default: `false`

**Returns:** `boolean` - `true` if valid, `false` otherwise

**Example:**

```javascript
// Validate users data from JSONPlaceholder API
const isValid = validator.validateJsonSchemaSync(
  'jsonplaceholder',
  'Users',
  usersData,
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
// Validate users and create schema if missing
const response = await fetch('https://jsonplaceholder.typicode.com/users');
const users = await response.json();

const isValid = await validator.validateJsonSchema(
  'jsonplaceholder',
  'Users',
  users,
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
const validator = new SchemaValidator('./api-schemas');

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
const validator = new SchemaValidator('./api-schemas');

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
const validator = new SchemaValidator('./api-schemas');

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
  const validator = new SchemaValidator('./api-schemas');
  
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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Eneco VPP Testing Team

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

**Made with ❤️ by the Eneco VPP Core Team**

