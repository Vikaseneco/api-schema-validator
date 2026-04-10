# bruno-api-schema-validator

> Advanced JSON schema validation library for API testing with 17 powerful features including automatic schema generation, performance testing, mock data generation, and CI/CD integration. Built for **Bruno API client** and Node.js.

[![npm version](https://img.shields.io/npm/v/bruno-api-schema-validator.svg)](https://www.npmjs.com/package/bruno-api-schema-validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Table of Contents

- [Key Features](#-key-features)
- [Installation](#-installation)
- [Quick Start (Bruno)](#-quick-start-bruno)
- [Folder Structure](#-folder-structure)
- [How It Works](#-how-it-works)
- [Smart Format & Type Detection](#-smart-format--type-detection)
- [Complete API Reference](#-complete-api-reference)
  - [Constructor](#constructor)
  - [Core Methods](#core-methods)
  - [Feature 1: Schema Evolution & Versioning](#feature-1-schema-evolution--versioning)
  - [Feature 2: Advanced Validation Options](#feature-2-advanced-validation-options)
  - [Feature 3: Response Time & Performance Testing](#feature-3-response-time--performance-testing)
  - [Feature 4: Mock Data Generation](#feature-4-mock-data-generation)
  - [Feature 5: OpenAPI/Swagger Contract Testing](#feature-5-openapiswagger-contract-testing)
  - [Feature 6: Snapshot Testing (Differential Validation)](#feature-6-snapshot-testing-differential-validation)
  - [Feature 7: Environment-Specific Validation](#feature-7-environment-specific-validation)
  - [Feature 9: Request Validation](#feature-9-request-validation)
  - [Feature 10: Automated Documentation Generation](#feature-10-automated-documentation-generation)
  - [Feature 11: CI/CD Integration & Reports](#feature-11-cicd-integration--reports)
  - [Feature 12: Schema Migration](#feature-12-schema-migration)
  - [Feature 13: Fuzzy Matching & Tolerance](#feature-13-fuzzy-matching--tolerance)
  - [Feature 14: Batch Validation](#feature-14-batch-validation)
  - [Feature 15: Runtime Schema Modification](#feature-15-runtime-schema-modification)
  - [Feature 16: Security Validation](#feature-16-security-validation)
  - [Feature 17: Performance Benchmarking](#feature-17-performance-benchmarking)
- [Bruno Examples (Copy-Paste Ready)](#-bruno-examples-copy-paste-ready)
- [Node.js / CI Examples](#-nodejs--ci-examples)
- [Troubleshooting](#-troubleshooting)
- [Best Practices](#-best-practices)

---

## 🚀 Key Features

### Core Validation
- ✅ **Auto-Detection** — Automatically detects Bruno environment via `bru.cwd()`
- ✅ **Automatic Schema Generation** — Generate JSON schemas from API responses
- ✅ **Synchronous & Asynchronous Validation** — Sync for Bruno, async for Node.js
- ✅ **Smart Format Detection** — Auto-detects 10 string formats (UUID, email, date-time, etc.)
- ✅ **Advanced AJV Options** — allErrors, verbose, custom formats, union types

### Advanced Features
- 🔥 **Schema Evolution** — Track versions, detect breaking changes automatically
- 🔥 **Performance Testing** — Validate response time and size limits
- 🔥 **Mock Data Generation** — Generate test data from schemas using Faker
- 🔥 **OpenAPI/Swagger Support** — Import OpenAPI specifications as JSON Schema
- 🔥 **Snapshot Testing** — Differential validation with field ignoring
- 🔥 **Environment-Specific Schemas** — Different schemas per environment (dev, test, prod)
- 🔥 **Request Validation** — Validate body, headers, and query parameters
- 🔥 **Automated Documentation** — Generate markdown docs from schemas
- 🔥 **CI/CD Reports** — JUnit XML, HTML, Console reporters
- 🔥 **Schema Migration** — Transform schemas between versions
- 🔥 **Fuzzy Matching** — Tolerance-based validation for flexible testing
- 🔥 **Batch Validation** — Parallel validation of multiple endpoints
- 🔥 **Runtime Modification** — Dynamically modify schemas
- 🔥 **Security Validation** — PII detection, GDPR/HIPAA compliance
- 🔥 **Performance Benchmarking** — Measure validation speed

---

## 📦 Installation

```bash
npm install bruno-api-schema-validator
```

---

## 🎯 Quick Start (Bruno)

### Step 1: Install the package in your Bruno collection

```bash
cd your-bruno-collection
npm install bruno-api-schema-validator
```

### Step 2: Generate a schema from your first API response

Add this to any `.bru` file's `tests {}` block:

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();  // Auto-detects Bruno!

  test("Create schema from response", async function(){
    await validator.createJsonSchema('api', 'Users', jsonData);
    // Saves to: <collection>/api-schemas/api/Users_schema.json
  });
}
```

### Step 3: Validate every future response

```javascript
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

### One-liner: Auto-create + validate

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Schema validation", function(){
    // First run → creates schema; subsequent runs → validates against it
    const result = validator.validateJsonSchemaSync('api', 'Users', jsonData, { createSchema: true });
    expect(result).to.equal(true);
  });
}
```

> **💡 Pro Tip:** The validator automatically detects Bruno environment and uses `bru.cwd()` internally. No manual path construction needed — just call `new SchemaValidator()` and you're done!

---

## 📁 Folder Structure

### Bruno Collection

```
bruno-collection/
├── node_modules/
│   └── bruno-api-schema-validator/
├── package.json
├── api-schemas/                        ← Default schema folder (auto-detected)
│   ├── jsonplaceholder/
│   │   ├── Users_schema.json
│   │   ├── Posts_schema.json
│   │   └── Comments_schema.json
│   └── vpp/
│       └── Asset Manager/
│           └── RegisteredAssets_schema.json
├── GetUsers.bru
├── GetPosts.bru
└── GetComments.bru
```

### Node.js Project

```
my-project/
├── package.json
├── node_modules/
├── api-schemas/
│   └── api/
│       └── v1/
│           ├── Products_schema.json
│           └── Orders_schema.json
└── tests/
    └── api/
        └── users.test.js
```

---

## 🔄 How It Works

```
Step 1: First API Call — Generate Schema
┌─────────────────┐
│   API Response   │
│   (JSON data)    │
└────────┬─────────┘
         │
         ▼
   createJsonSchema()
   or { createSchema: true }
         │
         ▼
┌─────────────────────────────────┐
│ Users_schema.json               │
│ (Stored in api-schemas/)        │
└─────────────────────────────────┘

Step 2: Subsequent Calls — Validate
┌─────────────────┐          ┌─────────────────────────┐
│   API Response   │          │ Stored Schema File      │
└────────┬─────────┘          └───────────┬─────────────┘
         │                                │
         └──────────┬─────────────────────┘
                    ▼
          validateJsonSchemaSync()
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    ✓ PASS                ✗ FAIL
                    (Shows exactly
                     what's wrong)
```

---

## 🔍 Smart Format & Type Detection

The schema generator automatically detects **10 industry-standard JSON Schema formats** during schema creation. No configuration required.

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

### Example: Generated Schema

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

The scanner reads **all items in the array**, not just the first one:

| Scenario | Generated type |
|---|---|
| Field is always a timestamp | `{ "type": "string", "format": "date-time" }` |
| Field is sometimes `null` | `{ "type": ["string", "null"], "format": "date-time" }` |
| Field absent in some items | `{ "type": ["string", "null"] }` + excluded from `required` |
| Field has mixed types | `{ "type": ["string", "number"] }` (no format) |
| Plain word like `"active"` | `{ "type": "string" }` (no false format match) |

---

## 📚 Complete API Reference

### Constructor

#### `new SchemaValidator([schemaPathOrFolderName], [options])`

Creates a new validator instance with automatic environment detection.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `schemaPathOrFolderName` | string | `'api-schemas'` | Folder name (Bruno) or full path (Node.js) |
| `options.allErrors` | boolean | `false` | Collect all errors instead of stopping at first |
| `options.verbose` | boolean | `false` | Enable verbose error messages |
| `options.allowUnionTypes` | boolean | `false` | Allow union types in validation |
| `options.customFormats` | object | `{}` | Additional custom format definitions |

```javascript
// ── Bruno (auto-detects bru.cwd()) ──
const validator = new SchemaValidator();                       // uses 'api-schemas'
const validator = new SchemaValidator('my-custom-schemas');     // uses 'my-custom-schemas'

// ── Node.js ──
const validator = new SchemaValidator('/absolute/path/to/schemas');
const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));
```

---

### Core Methods

#### `createJsonSchema(folderName, fileName, json)` — async

Generates a JSON schema from a response and saves it to disk.

| Parameter | Type | Description |
|---|---|---|
| `folderName` | string | Subdirectory path (e.g. `'api'`, `'vpp/Asset Manager'`) |
| `fileName` | string | Schema base name (e.g. `'Users'`) |
| `json` | object/array | JSON data to generate schema from |

**Returns:** `Promise<string>` — path to the created schema file

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Create Users schema", async function(){
    const schemaPath = await validator.createJsonSchema('jsonplaceholder', 'Users', jsonData);
    console.log('Schema saved to:', schemaPath);
    // → <collection>/api-schemas/jsonplaceholder/Users_schema.json
  });
}
```

---

#### `validateJsonSchemaSync(folderName, fileName, body, options)` — sync ⭐

Synchronously validates data against a schema. **Use this in Bruno tests.**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `folderName` | string | — | Subdirectory path |
| `fileName` | string | — | Schema base name |
| `body` | object/array | — | Data to validate |
| `options.createSchema` | boolean | `false` | Auto-create schema if missing |
| `options.verbose` | boolean | `true` | Show detailed errors |
| `options.throwOnError` | boolean | `false` | Throw instead of returning `false` |

**Returns:** `boolean` — `true` if valid

**Also supports inline mode:** `validateJsonSchemaSync(schemaObject, data)` → returns `{ valid, errors }`

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Validate Users response", function(){
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder',
      'Users',
      jsonData,
      { createSchema: true, verbose: true }
    );
    expect(result).to.equal(true);
  });
}
```

**Bruno example — inline schema (no file needed):**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Validate against inline schema", function(){
    const mySchema = {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" }
      },
      required: ["id", "name"]
    };
    const result = validator.validateJsonSchemaSync(mySchema, jsonData[0]);
    expect(result.valid).to.equal(true);
  });
}
```

---

#### `validateJsonSchema(folderName, fileName, body, options)` — async

Same as sync version but returns `Promise<boolean>`. **Use this in Node.js test frameworks (Jest, Mocha, Vitest).**

> ⚠️ Bruno doesn't support async/await in tests. Use `validateJsonSchemaSync()` for Bruno.

---

#### `schemaExists(folderName, fileName)`

Check if a schema file exists.

**Returns:** `boolean`

```javascript
// Bruno
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Schema file exists", function(){
    expect(validator.schemaExists('jsonplaceholder', 'Users')).to.equal(true);
  });
}
```

---

#### `getSchemaPath(folderName, fileName)`

Get the full path to a schema file.

**Returns:** `string`

```javascript
const fullPath = validator.getSchemaPath('jsonplaceholder', 'Users');
// → <collection>/api-schemas/jsonplaceholder/Users_schema.json
```

---

#### `clearCache()` / `clearCacheForSchema(folderName, fileName)`

Clear cached validators and schemas. Useful when schemas have been modified externally.

```javascript
validator.clearCache();                                    // Clear all
validator.clearCacheForSchema('jsonplaceholder', 'Users'); // Clear one
```

---

#### `getCacheStats()`

Get cache statistics.

**Returns:** `{ validatorCacheSize: number, schemaCacheSize: number }`

```javascript
const stats = validator.getCacheStats();
console.log(stats); // { validatorCacheSize: 3, schemaCacheSize: 3 }
```

---

### Feature 1: Schema Evolution & Versioning

Detect breaking changes between schema versions and track version history.

#### `compareSchemas(oldSchema, newSchema)`

| Parameter | Type | Description |
|---|---|---|
| `oldSchema` | object | The original schema |
| `newSchema` | object | The new schema to compare |

**Returns:** `{ breaking: [], nonBreaking: [], recommendedVersionBump: 'patch'|'minor'|'major' }`

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Detect schema changes", function(){
    const oldSchema = {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
        email: { type: "string" }
      },
      required: ["id", "name", "email"]
    };

    const newSchema = {
      type: "object",
      properties: {
        id: { type: "string" },      // type changed → breaking
        name: { type: "string" },
        phone: { type: "string" }     // email removed, phone added
      },
      required: ["id", "name"]
    };

    const changes = validator.compareSchemas(oldSchema, newSchema);
    console.log('Breaking changes:', changes.breaking);
    console.log('Non-breaking changes:', changes.nonBreaking);
    console.log('Recommended bump:', changes.recommendedVersionBump);
    // → 'major' because of breaking changes

    expect(changes.breaking.length).to.be.greaterThan(0);
  });
}
```

#### `trackSchemaVersion(folderName, fileName, version)` — file-based

Saves a versioned snapshot of the current schema to a `_versions.json` file.

```javascript
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Track schema version", function(){
    validator.trackSchemaVersion('jsonplaceholder', 'Users', '1.0.0');
    // Saves to: api-schemas/jsonplaceholder/Users_versions.json
  });
}
```

#### `trackSchemaVersion(name, schemaObject)` — inline

Track versions in memory without files.

```javascript
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Track inline schema version", function(){
    const schema = { type: "object", properties: { id: { type: "number" } } };
    const versionInfo = validator.trackSchemaVersion('UserSchema', schema);
    console.log(versionInfo.current); // '1.0.0'

    // Track again → auto-increments
    const updated = validator.trackSchemaVersion('UserSchema', schema);
    console.log(updated.current); // '1.0.1'
  });
}
```

---

### Feature 2: Advanced Validation Options

#### `validateSync(folderName, fileName, body, options)`

Returns a detailed validation result object instead of just `boolean`.

| Parameter | Type | Description |
|---|---|---|
| `options.allErrors` | boolean | Collect all errors |
| `options.verbose` | boolean | Add extra error info |
| `options.allowUnionTypes` | boolean | Allow union types |
| `options.customFormats` | object | Custom format definitions |

**Returns:** `{ valid: boolean, errors: array|null, schema: object, data: any }`

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Advanced validation with full result", function(){
    const result = validator.validateSync('jsonplaceholder', 'Users', jsonData, {
      allErrors: true,
      verbose: true
    });

    console.log('Valid:', result.valid);
    console.log('Errors:', result.errors);
    console.log('Schema used:', JSON.stringify(result.schema).substring(0, 200));
    expect(result.valid).to.equal(true);
  });
}
```

---

### Feature 3: Response Time & Performance Testing

#### `validateWithPerformance(folderName, fileName, body, perfOptions)` — async

Validates schema AND enforces performance constraints (response time, response size).

| Parameter | Type | Description |
|---|---|---|
| `perfOptions.maxResponseTime` | number | Max allowed time in ms |
| `perfOptions.maxResponseSize` | number | Max allowed size in bytes |

**Returns:** `Promise<{ valid, schemaValid, performanceValid, responseTime, responseSize, errors }>`

**Node.js example** (async — not suitable for Bruno's sync tests):

```javascript
const SchemaValidator = require('bruno-api-schema-validator');
const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));

const result = await validator.validateWithPerformance('api', 'Users', responseData, {
  maxResponseTime: 500,     // Must complete within 500ms
  maxResponseSize: 102400   // Max 100KB
});

console.log('Schema valid:', result.schemaValid);
console.log('Performance valid:', result.performanceValid);
console.log('Response time:', result.responseTime, 'ms');
console.log('Response size:', result.responseSize, 'bytes');
```

**Bruno example — manual perf check (sync):**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Schema + performance check", function(){
    const result = validator.measurePerformance('jsonplaceholder', 'Users', jsonData);
    console.log('Validation time:', result.durationMs, 'ms');
    console.log('Ops/sec:', result.opsPerSecond);
    expect(result.valid).to.equal(true);
  });
}
```

---

### Feature 4: Mock Data Generation

#### `generateMockData(schema, options)`

Generate realistic test data from a JSON schema using Faker.

| Parameter | Type | Description |
|---|---|---|
| `schema` | object | JSON schema to generate data from |
| `options.count` | number | Number of records to generate (default: 1) |
| `options.locale` | string | Faker locale (default: `'en'`) |
| `options.seed` | number | Seed for reproducible data |

**Returns:** `object | array` — single item or array (if count > 1)

**Bruno example:**

```javascript
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Generate mock data from schema", function(){
    const schema = {
      type: "object",
      properties: {
        id:    { type: "string", format: "uuid" },
        name:  { type: "string" },
        email: { type: "string", format: "email" },
        age:   { type: "integer", minimum: 18, maximum: 65 },
        role:  { type: "string", enum: ["admin", "user", "guest"] },
        active: { type: "boolean" }
      },
      required: ["id", "name", "email"]
    };

    // Generate 5 mock users
    const mockUsers = validator.generateMockData(schema, { count: 5 });
    console.log('Generated users:', JSON.stringify(mockUsers, null, 2));

    expect(mockUsers).to.be.an("array");
    expect(mockUsers.length).to.equal(5);
    expect(mockUsers[0]).to.have.property('id');
    expect(mockUsers[0]).to.have.property('email');
  });

  test("Generate mock with nested objects", function(){
    const schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            address: {
              type: "object",
              properties: {
                street: { type: "string" },
                city: { type: "string" }
              }
            }
          }
        },
        tags: {
          type: "array",
          items: { type: "string" }
        }
      }
    };

    const mock = validator.generateMockData(schema);
    console.log('Nested mock:', JSON.stringify(mock, null, 2));
    expect(mock).to.have.property('user');
    expect(mock.user).to.have.property('address');
  });

  test("Reproducible mock data with seed", function(){
    const schema = { type: "object", properties: { name: { type: "string" } } };
    const mock1 = validator.generateMockData(schema, { seed: 42 });
    const mock2 = validator.generateMockData(schema, { seed: 42 });
    expect(mock1.name).to.equal(mock2.name);
  });
}
```

---

### Feature 5: OpenAPI/Swagger Contract Testing

#### `openApiToJsonSchema(openApiSpec)`

Converts an OpenAPI 3.0 specification into JSON Schema objects.

| Parameter | Type | Description |
|---|---|---|
| `openApiSpec` | string/object | OpenAPI spec as YAML string, JSON string, or JS object |

**Returns:** `object` — map of schema names to JSON Schema objects

**Bruno example:**

```javascript
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Convert OpenAPI spec to JSON schemas", function(){
    const openApiSpec = {
      openapi: "3.0.0",
      info: { title: "My API", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id:   { type: "integer" },
                          name: { type: "string" },
                          email: { type: "string", format: "email" }
                        },
                        required: ["id", "name"]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          User: {
            type: "object",
            properties: {
              id:   { type: "integer" },
              name: { type: "string" },
              email: { type: "string", nullable: true }
            }
          }
        }
      }
    };

    const schemas = validator.openApiToJsonSchema(openApiSpec);

    // Component schemas
    console.log('User schema:', JSON.stringify(schemas.User, null, 2));
    expect(schemas.User).to.have.property('properties');
    // nullable gets converted to ["string", "null"]
    expect(schemas.User.properties.email.type).to.include('null');

    // Path-based schemas
    console.log('Available schemas:', Object.keys(schemas));
    expect(schemas).to.have.property('GET/users_200_response');
  });
}
```

**Bruno example — validate response against OpenAPI contract:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Validate against OpenAPI contract", function(){
    const openApiSpec = `
      openapi: "3.0.0"
      info:
        title: Users API
        version: "1.0"
      components:
        schemas:
          User:
            type: object
            properties:
              id:
                type: integer
              name:
                type: string
              email:
                type: string
                format: email
            required: [id, name, email]
    `;

    const schemas = validator.openApiToJsonSchema(openApiSpec);
    const userSchema = schemas.User;

    // Validate each item in response against the OpenAPI schema
    const result = validator.validateJsonSchemaSync(userSchema, jsonData[0]);
    expect(result.valid).to.equal(true);
  });
}
```

---

### Feature 6: Snapshot Testing (Differential Validation)

#### `snapshot(snapshotName, data, [ignoreFields])`

Create a snapshot of data for later comparison.

#### `validateSnapshot(snapshotName, data, [ignoreFields])`

Compare current data against a previously saved snapshot.

| Parameter | Type | Description |
|---|---|---|
| `snapshotName` | string | Unique name for the snapshot |
| `data` | any | Data to snapshot or validate |
| `ignoreFields` | array | Field names to ignore during comparison |

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Create response snapshot", function(){
    // Save a snapshot (first run creates it)
    const result = validator.snapshot('users-response', jsonData, ['timestamp', 'updatedAt']);
    console.log('Snapshot created:', result.created);
    console.log('Snapshot path:', result.path);
  });

  test("Validate response against snapshot", function(){
    // Compare current response with saved snapshot
    const result = validator.validateSnapshot('users-response', jsonData, ['timestamp', 'updatedAt']);

    if (!result.valid) {
      console.log('Differences found:', JSON.stringify(result.differences, null, 2));
    }
    expect(result.valid).to.equal(true);
  });
}
```

**Bruno example — category-based snapshots:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Snapshot with category", function(){
    // Saves as: snapshots/users-list.json
    validator.snapshot('users', 'list', jsonData, { ignoreFields: ['timestamp'] });

    const result = validator.validateSnapshot('users', 'list', jsonData, { ignoreFields: ['timestamp'] });
    expect(result.valid).to.equal(true);
  });
}
```

---

### Feature 7: Environment-Specific Validation

#### `registerEnvironmentSchema(name, env, schema)` — inline
#### `registerEnvironmentSchema(env, folderName, fileName, schemaPath)` — file-based

Register different schemas for different environments (dev, test, prod).

#### `validateWithEnvironment(folderName, fileName, body, env)`

Validate using the schema registered for a specific environment.

#### `getEnvironmentSchema(name, env)`

Retrieve a registered environment schema.

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Environment-specific validation", function(){
    // Register different schemas per environment
    const devSchema = {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
        debug_info: { type: "string" }    // Only in dev
      },
      required: ["id", "name"]
    };

    const prodSchema = {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" }
        // No debug_info in production
      },
      required: ["id", "name"]
    };

    validator.registerEnvironmentSchema('UserSchema', 'development', devSchema);
    validator.registerEnvironmentSchema('UserSchema', 'production', prodSchema);

    // Retrieve and validate
    const schema = validator.getEnvironmentSchema('UserSchema', 'production');
    expect(schema).to.not.be.null;

    const result = validator.validateJsonSchemaSync(schema, jsonData[0]);
    expect(result.valid).to.equal(true);
  });
}
```

**Bruno example — file-based environment schemas:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Validate with environment fallback", function(){
    // Uses NODE_ENV or defaults to 'development'
    // If an env-specific schema is registered, uses it; otherwise falls back to default
    const result = validator.validateWithEnvironment('jsonplaceholder', 'Users', jsonData, 'production');
    console.log('Environment used:', result.environment || 'default');
    expect(result.valid).to.equal(true);
  });
}
```

---

### Feature 9: Request Validation

#### `validateRequest(request, schemas)`

Validate request body, headers, and query parameters against separate schemas.

| Parameter | Type | Description |
|---|---|---|
| `request` | object | Object with `body`, `headers`, `query` properties |
| `schemas.body` | object | JSON schema for request body |
| `schemas.headers` | object | JSON schema for headers |
| `schemas.query` | object | JSON schema for query parameters |

**Returns:** `{ valid, body: { valid, errors }, headers: { valid, errors }, query: { valid, errors } }`

**Bruno example:**

```javascript
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Validate request structure", function(){
    const request = {
      body: {
        name: "John Doe",
        email: "john@example.com",
        age: 30
      },
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer eyJhbGci..."
      },
      query: {
        page: "1",
        limit: "10"
      }
    };

    const result = validator.validateRequest(request, {
      body: {
        type: "object",
        properties: {
          name:  { type: "string" },
          email: { type: "string", format: "email" },
          age:   { type: "integer", minimum: 0 }
        },
        required: ["name", "email"]
      },
      headers: {
        type: "object",
        properties: {
          "content-type":  { type: "string" },
          "authorization": { type: "string" }
        },
        required: ["content-type", "authorization"]
      },
      query: {
        type: "object",
        properties: {
          page:  { type: "string" },
          limit: { type: "string" }
        }
      }
    });

    console.log('Body valid:', result.body.valid);
    console.log('Headers valid:', result.headers.valid);
    console.log('Query valid:', result.query.valid);
    expect(result.valid).to.equal(true);
  });
}
```

---

### Feature 10: Automated Documentation Generation

#### `generateDocumentation(folderName, outputDir)` — file-based

Scans all schemas in a folder and generates a markdown documentation file.

#### `generateDocumentation(title, schema, options)` — inline

Generate markdown documentation string from a single schema.

| Parameter | Type | Description |
|---|---|---|
| `title` | string | Document title |
| `schema` | object | JSON schema |
| `options.endpoint` | string | API endpoint path |
| `options.method` | string | HTTP method |
| `options.examples` | array | Example data |

**Bruno example — inline docs:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Generate API documentation", function(){
    const schema = {
      type: "object",
      properties: {
        id:    { type: "number", description: "Unique identifier" },
        name:  { type: "string", description: "Full name" },
        email: { type: "string", format: "email", description: "Email address" }
      },
      required: ["id", "name", "email"]
    };

    const docs = validator.generateDocumentation('Users API', schema, {
      endpoint: '/api/v1/users',
      method: 'GET',
      examples: [jsonData[0]]
    });

    console.log(docs);
    // Outputs markdown with properties table, endpoint info, and example
    expect(docs).to.include('Users API');
    expect(docs).to.include('GET');
  });
}
```

**Node.js example — generate docs for all schemas:**

```javascript
const SchemaValidator = require('bruno-api-schema-validator');
const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));

// Generates: ./docs/jsonplaceholder.md with all schemas documented
const outputFile = validator.generateDocumentation('jsonplaceholder', './docs');
console.log('Docs generated at:', outputFile);
```

---

### Feature 11: CI/CD Integration & Reports

#### `printConsoleReport(testResults)`

Print formatted test results to console.

#### `generateJUnitReport(testResults, outputFile)`

Generate JUnit XML report for CI/CD pipelines (Jenkins, GitHub Actions, etc.).

#### `generateHTMLReport(testResults, outputFile)`

Generate a visual HTML report.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `testResults` | array | — | Array of `{ name, passed, error, duration, suite, stack }` |
| `outputFile` | string | `'./reports/junit.xml'` or `'./reports/report.html'` | Output path |

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  // Collect test results
  const testResults = [];

  test("Users schema valid", function(){
    const startTime = Date.now();
    const result = validator.validateJsonSchemaSync('jsonplaceholder', 'Users', jsonData);
    testResults.push({
      name: 'Users schema validation',
      passed: result,
      duration: Date.now() - startTime,
      suite: 'jsonplaceholder',
      error: result ? null : 'Schema validation failed'
    });
    expect(result).to.equal(true);
  });

  test("Print console report", function(){
    validator.printConsoleReport(testResults);
    // Prints:
    // ============================================================
    // TEST REPORT
    // ============================================================
    // Total: 1 | Passed: 1 ✓ | Failed: 0 ✗
    // ============================================================
  });
}
```

**Node.js CI/CD example:**

```javascript
const SchemaValidator = require('bruno-api-schema-validator');
const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));

const testResults = [
  { name: 'GET /users', passed: true, duration: 12, suite: 'users' },
  { name: 'GET /posts', passed: false, error: 'Type mismatch at /0/id', duration: 8, suite: 'posts' }
];

// Console output
validator.printConsoleReport(testResults);

// JUnit XML for Jenkins/GitHub Actions
validator.generateJUnitReport(testResults, './reports/junit.xml');

// HTML report for visual review
validator.generateHTMLReport(testResults, './reports/report.html');
```

---

### Feature 12: Schema Migration

#### `migrateSchema(schema, transformations)`

Apply transformation rules to evolve a schema to a new version.

| Transformation type | Parameters | Description |
|---|---|---|
| `rename` / `rename_field` | `from`/`oldName`, `to`/`newName` | Rename a field |
| `add_field` | `name`, `schema`, `required` | Add a new field |
| `remove_field` | `name` | Remove a field |
| `change_type` | `name`, `newType` | Change a field's type |
| `add_format` | `name`, `format` | Add a format constraint |
| `update_description` | `name`, `description` | Update field description |

**Returns:** `object` — the migrated schema (deep-cloned, original untouched)

**Bruno example:**

```javascript
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Migrate schema v1 → v2", function(){
    const schemaV1 = {
      type: "object",
      properties: {
        user_name: { type: "string" },
        mail: { type: "string" },
        age: { type: "string" }
      },
      required: ["user_name", "mail"]
    };

    const schemaV2 = validator.migrateSchema(schemaV1, [
      { type: 'rename', from: 'user_name', to: 'username' },
      { type: 'rename', from: 'mail', to: 'email' },
      { type: 'change_type', name: 'age', newType: 'integer' },
      { type: 'add_format', name: 'email', format: 'email' },
      { type: 'add_field', name: 'role', schema: { type: 'string', enum: ['admin', 'user'] }, required: false },
      { type: 'remove_field', name: 'age' }
    ]);

    console.log('Migrated schema:', JSON.stringify(schemaV2, null, 2));
    expect(schemaV2.properties).to.have.property('username');
    expect(schemaV2.properties).to.have.property('email');
    expect(schemaV2.properties.email.format).to.equal('email');
    expect(schemaV2.properties).to.not.have.property('user_name');
    expect(schemaV2.properties).to.not.have.property('age');
  });
}
```

---

### Feature 13: Fuzzy Matching & Tolerance

#### `validateWithTolerance(folderName, fileName, body, toleranceOptions)` — file-based
#### `validateWithTolerance(schema, body, toleranceOptions)` — inline

Validate with relaxed rules for flexible testing.

| Option | Type | Default | Description |
|---|---|---|---|
| `allowExtraFields` | boolean | `false` | Allow extra properties not in schema |
| `numericTolerance` | number | `0` | Allowed numeric difference |
| `stringSimilarityThreshold` | number | `1.0` | 0.0–1.0 string similarity threshold |
| `ignoreMissingOptional` | boolean | `false` | Ignore missing optional fields |

**Returns:** `{ valid, errors, toleranceApplied }`

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Flexible validation with tolerance", function(){
    const schema = {
      type: "object",
      properties: {
        id:    { type: "number" },
        name:  { type: "string" },
        email: { type: "string" }
      },
      required: ["id", "name"]
    };

    // Data has extra fields not in schema — normally fails with additionalProperties: false
    const data = {
      id: 1,
      name: "John",
      email: "john@example.com",
      extraField: "this is extra"
    };

    const result = validator.validateWithTolerance(schema, data, {
      allowExtraFields: true,
      ignoreMissingOptional: true
    });

    console.log('Valid:', result.valid);
    console.log('Tolerance applied:', result.toleranceApplied);
    expect(result.valid).to.equal(true);
  });
}
```

---

### Feature 14: Batch Validation

#### `batchValidate(validations, options)` — async

Validate multiple endpoints/responses in parallel.

| Parameter | Type | Description |
|---|---|---|
| `validations` | array | Array of `{ folderName, fileName, body, options }` |
| `options.concurrency` | number | Max parallel validations (default: 5) |

**Returns:** `Promise<array>` — array of `{ passed, duration, error, ... }`

**Node.js example:**

```javascript
const SchemaValidator = require('bruno-api-schema-validator');
const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));

const results = await validator.batchValidate([
  { folderName: 'api', fileName: 'Users',    body: usersData },
  { folderName: 'api', fileName: 'Posts',     body: postsData },
  { folderName: 'api', fileName: 'Comments',  body: commentsData }
], { concurrency: 3 });

results.forEach(r => {
  console.log(`${r.fileName}: ${r.passed ? '✓' : '✗'} (${r.duration}ms)`);
});
```

---

### Feature 15: Runtime Schema Modification

#### `modifySchema(folderName, fileName, modifications)` — file-based
#### `modifySchema(schema, modifications)` — inline

Dynamically modify a schema at runtime without changing files.

| Operation | Parameters | Description |
|---|---|---|
| `add_required` | `field` | Make a field required |
| `remove_required` | `field` | Make a field optional |
| `add_pattern` | `field`, `pattern` | Add regex pattern to a field |
| `remove_pattern` | `field` | Remove pattern from a field |
| `update_enum` | `field`, `values` | Set allowed enum values |
| `add_property` | `name`, `schema` | Add a new property |
| `remove_property` | `name` | Remove a property |

**Returns:** `object` — the modified schema (deep-cloned)

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Modify schema at runtime", function(){
    const baseSchema = {
      type: "object",
      properties: {
        id:     { type: "number" },
        name:   { type: "string" },
        status: { type: "string" }
      },
      required: ["id", "name"]
    };

    // Make status required and add enum constraint
    const strictSchema = validator.modifySchema(baseSchema, [
      { operation: 'add_required', field: 'status' },
      { operation: 'update_enum', field: 'status', values: ['active', 'inactive', 'pending'] },
      { operation: 'add_pattern', field: 'name', pattern: '^[A-Z]' },
      { operation: 'add_property', name: 'email', schema: { type: 'string', format: 'email' } }
    ]);

    console.log('Modified schema:', JSON.stringify(strictSchema, null, 2));
    expect(strictSchema.required).to.include('status');
    expect(strictSchema.properties.status.enum).to.include('active');
    expect(strictSchema.properties).to.have.property('email');
  });

  test("Modify schema with shorthand", function(){
    const schema = {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" }
      },
      required: ["id", "name"]
    };

    // Object-style modifications
    const modified = validator.modifySchema(schema, {
      addRequired: ['email'],
      removeRequired: ['name'],
      addProperty: { name: 'email', schema: { type: 'string', format: 'email' } }
    });

    expect(modified.required).to.include('email');
    expect(modified.required).to.not.include('name');
  });
}
```

---

### Feature 16: Security Validation

#### `validateSecurity(data, options)`

Scan data for PII (Personally Identifiable Information) and check compliance.

| Option | Type | Default | Description |
|---|---|---|---|
| `checkPII` | boolean | `true` | Scan for PII patterns |
| `complianceStandard` | string | `null` | `'GDPR'`, `'HIPAA'`, or `null` |
| `sensitiveFields` | array | `[]` | Additional field names to flag |

**Detected PII patterns:** SSN, credit card numbers, phone numbers, email addresses.  
**Sensitive field names:** password, secret, token, api_key, apikey, ssn, creditcard.

**Returns:** `{ secure, hasPII, piiFields, issues, complianceIssues, complianceStandard }`

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Security check - No PII in response", function(){
    const result = validator.validateSecurity(jsonData);

    console.log('Secure:', result.secure);
    console.log('Has PII:', result.hasPII);
    if (result.issues.length > 0) {
      console.log('Security issues:', result.issues);
    }
    expect(result.secure).to.equal(true);
  });

  test("GDPR compliance check", function(){
    const result = validator.validateSecurity(jsonData, {
      complianceStandard: 'GDPR'
    });

    console.log('GDPR issues:', result.complianceIssues);
    // If PII is found, GDPR warning is raised
    if (result.hasPII) {
      console.warn('⚠️ GDPR: Personal data detected - ensure proper consent');
    }
  });

  test("HIPAA compliance check", function(){
    const result = validator.validateSecurity(jsonData, {
      complianceStandard: 'HIPAA'
    });
    console.log('HIPAA issues:', result.complianceIssues);
  });

  test("Detect sensitive data patterns", function(){
    // Example: check that API response doesn't leak sensitive info
    const suspiciousResponse = {
      user: "John",
      ssn: "123-45-6789",
      credit_card: "4111-1111-1111-1111",
      password: "secret123"
    };

    const result = validator.validateSecurity(suspiciousResponse);
    console.log('PII found:', result.piiFields);
    console.log('Issues:', result.issues);
    expect(result.secure).to.equal(false);
    expect(result.hasPII).to.equal(true);
  });
}
```

---

### Feature 17: Performance Benchmarking

#### `benchmarkValidation(schema, data, options)` — inline (sync)
#### `benchmarkValidation(folderName, fileName, sampleData, options)` — file-based (async)

Run a validation multiple times and report performance statistics.

| Option | Type | Default | Description |
|---|---|---|---|
| `iterations` | number | `100` | Number of validation runs |

**Returns:** `{ iterations, averageMs, minMs, maxMs, opsPerSecond, times }`

#### `measurePerformance(folderName, fileName, data)` — sync

Measure a single validation's performance.

**Returns:** `{ valid, durationMs, opsPerSecond }`

**Bruno example:**

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Benchmark schema validation", function(){
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          id:   { type: "number" },
          name: { type: "string" }
        }
      }
    };

    const result = validator.benchmarkValidation(schema, jsonData, { iterations: 100 });
    console.log('Benchmark results:');
    console.log('  Iterations:', result.iterations);
    console.log('  Average:', result.averageMs, 'ms');
    console.log('  Min:', result.minMs, 'ms');
    console.log('  Max:', result.maxMs, 'ms');
    console.log('  Ops/sec:', result.opsPerSecond);

    // Ensure validation is fast enough
    expect(parseFloat(result.averageMs)).to.be.below(10);
  });

  test("Quick performance measurement", function(){
    const result = validator.measurePerformance('jsonplaceholder', 'Users', jsonData);
    console.log('Validation time:', result.durationMs, 'ms');
    console.log('Valid:', result.valid);
    console.log('Ops/sec:', result.opsPerSecond);
    expect(result.valid).to.equal(true);
  });
}
```

---

## 🎨 Bruno Examples (Copy-Paste Ready)

### Example 1: Minimal — One-liner Validation

```
// In any .bru file's tests {} block
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Schema valid", function(){
    expect(validator.validateJsonSchemaSync('api', 'Users', jsonData, { createSchema: true })).to.equal(true);
  });
}
```

### Example 2: Complete Bruno .bru File

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

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Status code is 200", function () {
    expect(res.getStatus()).to.equal(200);
  });

  test("Response is an array", function () {
    expect(jsonData).to.be.an("array");
  });

  test("Valid response JSON schema", function(){
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder',
      'Users',
      jsonData,
      { createSchema: true, verbose: true }
    );
    expect(result).to.equal(true);
  });

  test("No PII leakage", function(){
    const security = validator.validateSecurity(jsonData);
    expect(security.secure).to.equal(true);
  });
}
```

### Example 3: POST Request with Request + Response Validation

```javascript
// File: CreateUser.bru

meta {
  name: Create User
  type: http
  seq: 2
}

post {
  url: https://jsonplaceholder.typicode.com/users
  body: json
  auth: bearer
}

body:json {
  {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1-770-736-8031"
  }
}

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Validate request body structure", function(){
    const requestBody = JSON.parse(req.getBody());
    const result = validator.validateRequest(
      { body: requestBody },
      {
        body: {
          type: "object",
          properties: {
            name:  { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" }
          },
          required: ["name", "email"]
        }
      }
    );
    expect(result.valid).to.equal(true);
  });

  test("Validate response schema", function(){
    const result = validator.validateJsonSchemaSync('jsonplaceholder', 'CreateUser', jsonData, { createSchema: true });
    expect(result).to.equal(true);
  });
}
```

### Example 4: Multiple Endpoints in One Collection

```javascript
// File: GetPosts.bru
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Posts schema", function(){
    expect(validator.validateJsonSchemaSync('jsonplaceholder', 'Posts', jsonData, { createSchema: true })).to.equal(true);
  });
}

// File: GetComments.bru
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Comments schema", function(){
    expect(validator.validateJsonSchemaSync('jsonplaceholder', 'Comments', jsonData, { createSchema: true })).to.equal(true);
  });
}

// File: GetTodos.bru
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Todos schema", function(){
    expect(validator.validateJsonSchemaSync('jsonplaceholder', 'Todos', jsonData, { createSchema: true })).to.equal(true);
  });
}
```

### Example 5: Schema Evolution Workflow in Bruno

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Check for breaking changes before updating schema", function(){
    // Load existing schema
    const existingSchema = validator.getSchema('jsonplaceholder', 'Users');

    if (existingSchema) {
      // Generate schema from current response
      const newSchema = require('generate-schema').json(jsonData);

      // Compare
      const changes = validator.compareSchemas(
        existingSchema.items || existingSchema,
        newSchema.items || newSchema
      );

      console.log('Breaking changes:', changes.breaking.length);
      console.log('Non-breaking changes:', changes.nonBreaking.length);
      console.log('Recommended version bump:', changes.recommendedVersionBump);

      if (changes.breaking.length > 0) {
        console.warn('⚠️ BREAKING CHANGES DETECTED:');
        changes.breaking.forEach(c => console.warn('  -', c.type, c.field));
      }

      // Fail test if there are breaking changes
      expect(changes.breaking.length).to.equal(0);
    }
  });
}
```

### Example 6: Full-Featured Validation Suite

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();
  const testResults = [];

  // 1. Schema validation
  test("Schema validation", function(){
    const start = Date.now();
    const result = validator.validateJsonSchemaSync('api', 'Assets', jsonData, { createSchema: true });
    testResults.push({ name: 'Schema validation', passed: result, duration: Date.now() - start });
    expect(result).to.equal(true);
  });

  // 2. Security check
  test("Security - No PII leaked", function(){
    const start = Date.now();
    const security = validator.validateSecurity(jsonData, { complianceStandard: 'GDPR' });
    testResults.push({ name: 'Security check', passed: security.secure, duration: Date.now() - start });
    expect(security.secure).to.equal(true);
  });

  // 3. Snapshot comparison
  test("Response matches snapshot", function(){
    const start = Date.now();
    validator.snapshot('assets-response', jsonData, ['timestamp', 'updatedAt']);
    const snap = validator.validateSnapshot('assets-response', jsonData, ['timestamp', 'updatedAt']);
    testResults.push({ name: 'Snapshot match', passed: snap.valid, duration: Date.now() - start });
    expect(snap.valid).to.equal(true);
  });

  // 4. Performance measurement
  test("Validation performance", function(){
    const perf = validator.measurePerformance('api', 'Assets', jsonData);
    console.log('Validation took:', perf.durationMs, 'ms');
    testResults.push({ name: 'Performance', passed: true, duration: parseFloat(perf.durationMs) });
  });

  // 5. Print report
  test("Print test report", function(){
    validator.printConsoleReport(testResults);
  });
}
```

---

## 🖥️ Node.js / CI Examples

### Jest Test Suite

```javascript
const path = require('path');
const SchemaValidator = require('bruno-api-schema-validator');

const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));

describe('API Schema Validation', () => {
  it('should validate users endpoint', async () => {
    const response = await fetch('https://jsonplaceholder.typicode.com/users');
    const users = await response.json();

    const isValid = await validator.validateJsonSchema('jsonplaceholder', 'Users', users, {
      createSchema: true,
      verbose: true
    });

    expect(isValid).toBe(true);
  });

  it('should batch validate multiple endpoints', async () => {
    const [users, posts] = await Promise.all([
      fetch('https://jsonplaceholder.typicode.com/users').then(r => r.json()),
      fetch('https://jsonplaceholder.typicode.com/posts').then(r => r.json())
    ]);

    const results = await validator.batchValidate([
      { folderName: 'jsonplaceholder', fileName: 'Users', body: users, options: { createSchema: true } },
      { folderName: 'jsonplaceholder', fileName: 'Posts', body: posts, options: { createSchema: true } }
    ]);

    results.forEach(r => expect(r.passed).toBe(true));
  });
});
```

### CI/CD Script with Reports

```javascript
const path = require('path');
const SchemaValidator = require('bruno-api-schema-validator');

async function runContractTests() {
  const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));
  const results = [];

  const endpoints = [
    { folder: 'api', name: 'Users',    url: 'https://api.example.com/users' },
    { folder: 'api', name: 'Products', url: 'https://api.example.com/products' },
    { folder: 'api', name: 'Orders',   url: 'https://api.example.com/orders' }
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const data = await fetch(ep.url).then(r => r.json());
      const valid = await validator.validateJsonSchema(ep.folder, ep.name, data, { throwOnError: true });
      results.push({ name: `${ep.name}`, passed: true, duration: Date.now() - start, suite: ep.folder });
    } catch (err) {
      results.push({ name: `${ep.name}`, passed: false, error: err.message, duration: Date.now() - start, suite: ep.folder });
    }
  }

  // Generate reports
  validator.printConsoleReport(results);
  validator.generateJUnitReport(results, './reports/junit.xml');
  validator.generateHTMLReport(results, './reports/report.html');

  // Exit with error code if any test failed
  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.error(`${failed.length} test(s) failed`);
    process.exit(1);
  }
}

runContractTests();
```

---

## 🐛 Troubleshooting

### Schema file not found (ENOENT)

```
Error loading or validating schema file: ENOENT: no such file or directory
```

**Fix:** Create the schema first, or use `{ createSchema: true }`:

```javascript
// Option 1: Create explicitly
await validator.createJsonSchema('api', 'Users', sampleResponse);

// Option 2: Auto-create on validate
validator.validateJsonSchemaSync('api', 'Users', data, { createSchema: true });

// Option 3: Check path
console.log(validator.getSchemaPath('api', 'Users'));
```

### Validation fails unexpectedly

Check the console output (verbose is on by default):

```
✗ SCHEMA VALIDATION ERRORS:
  Schema: api/Users
  File: ./api-schemas/api/Users_schema.json

  1. At /0/id: must be string
     Expected type: string
     Actual value: 12345
```

**Fix:** Either fix your data or update the schema if the API changed legitimately.

### Null values or optional fields rejected

**Problem:** API returns `null` for a field, but schema has `{ "type": "string" }`.

**Fix (v1.3.0+):** Regenerate the schema with a response that includes null values:

```javascript
await validator.createJsonSchema('api', 'Users', responseWithNulls);
```

Or manually edit the schema:

```json
{ "lastModifiedDate": { "type": ["string", "null"], "format": "date-time" } }
```

### Node.js: "Please provide the full path to your schema directory"

In Node.js, provide the absolute path:

```javascript
const validator = new SchemaValidator(path.join(__dirname, 'api-schemas'));
```

---

## 📝 Best Practices

1. **Version Control** — Commit schema files to Git alongside your Bruno collection
2. **Schema Organization** — Use meaningful folder structures (`api/v1`, `vpp/Asset Manager`)
3. **One Schema Per Endpoint** — Don't reuse schemas unless endpoints return identical structures
4. **Auto-Create on First Run** — Use `{ createSchema: true }` for new endpoints
5. **Multi-Item Samples** — Generate schemas from responses with **multiple items** including records where optional fields are `null`
6. **Review Before Committing** — Always review generated schemas before committing
7. **Regenerate After API Changes** — Delete old schema and regenerate from a fresh response
8. **Security Checks** — Add `validateSecurity()` to catch PII leakage in API responses
9. **CI/CD Integration** — Use `generateJUnitReport()` for automated pipeline gates
10. **Performance Monitoring** — Use `measurePerformance()` to track validation speed over time

---

## 📊 Before vs After

### Before (Traditional Testing)

```javascript
test("Check all properties", () => {
  for (let i = 0; i < jsonData.length; i++) {
    expect(jsonData[i]).to.have.keys('name', 'id', 'fullName');
    expect(jsonData[i].name).to.be.a("string");
    expect(jsonData[i].id).to.be.a("string");
    // ... 20+ more assertions
  }
});
```

### After (Schema Validation)

```javascript
test("Schema validation", function(){
  expect(validator.validateJsonSchemaSync('api', 'Assets', jsonData, { createSchema: true })).to.equal(true);
});
```

One line. Catches all structural changes. Easy to maintain. ✅

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Happy Testing!!

## 🔗 Links

- [GitHub Repository](https://github.com/Vikaseneco/api-schema-validator)
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
