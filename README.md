# bruno-api-schema-validator

> Lightweight JSON schema validation library for API testing with Bruno CLI. Automatic schema generation, smart format detection, OpenAPI support, security scanning, and powerful assertion helpers — all CommonJS-compatible.

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
  - [Schema Comparison](#schema-comparison)
  - [OpenAPI / Swagger Support](#openapi--swagger-support)
  - [Request Validation](#request-validation)
  - [Security Validation](#security-validation)
- [Standalone Helpers (No Instance Required)](#-standalone-helpers-no-instance-required)
  - [validate](#validatenschema-data-opts)
  - [assertSchema](#assertschemaschema-data-message)
  - [assertStatus](#assertstatusres-expectedstatus-message)
  - [assertFields](#assertfieldsbody-fields)
  - [assertType](#asserttypevalue-expectedtype-message)
  - [schemaFrom](#schemafromsample)
  - [checkPII](#checkpiidata)
  - [assertArrayOf](#assertarrayofdata-itemschema-message)
  - [assertEnum](#assertenumvalue-allowedvalues-message)
  - [assertMatch](#assertmatchvalue-regex-message)
  - [assertRange](#assertrangevalue-min-max-message)
  - [assertNonEmpty](#assertnonemptyvalue-message)
  - [assertResponseTime](#assertresponsetimeres-maxms-message)
  - [assertDateBetween](#assertdatebetweenvalue-start-end-message)
- [Bruno Examples (Copy-Paste Ready)](#-bruno-examples-copy-paste-ready)
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
- ✅ **Schema Caching** — In-memory caching for fast repeated validations

### Advanced Features
- 🔥 **Schema Comparison** — Detect breaking vs non-breaking changes between schema versions
- 🔥 **OpenAPI/Swagger Support** — Import OpenAPI 3.0 specs as JSON Schema
- 🔥 **Request Validation** — Validate body, headers, and query parameters
- 🔥 **Security / PII Detection** — Scan responses for SSN, credit cards, emails, GDPR/HIPAA compliance

### Standalone Assertion Helpers (no instance needed)
- ⚡ `validate` — Validate data against an inline JSON schema
- ⚡ `assertSchema` — Assert data matches schema (throws on failure)
- ⚡ `assertStatus` — Assert HTTP status code
- ⚡ `assertFields` — Assert required fields exist (dot-notation)
- ⚡ `assertType` — Assert value type
- ⚡ `schemaFrom` — Generate schema from sample data
- ⚡ `checkPII` — Quick PII scan
- ⚡ `assertArrayOf` — Assert every array item matches a schema
- ⚡ `assertEnum` — Assert value is one of allowed set
- ⚡ `assertMatch` — Assert string matches regex pattern
- ⚡ `assertRange` — Assert number is within range
- ⚡ `assertNonEmpty` — Assert value is not null/empty
- ⚡ `assertResponseTime` — Assert response time within limit
- ⚡ `assertDateBetween` — Assert date falls within range

---

## 📦 Installation

```bash
npm install bruno-api-schema-validator
```

**Optional dependencies** (only needed for specific features):
```bash
npm install generate-schema   # Required for schemaFrom() and createJsonSchema()
npm install js-yaml            # Required for OpenAPI YAML parsing
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

#### `createValidator(schemaBasePath, opts)` — Factory

```javascript
const { createValidator } = require('bruno-api-schema-validator');
const validator = createValidator('api-schemas', { allErrors: true });
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

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Create Users schema", async function(){
    const schemaPath = await validator.createJsonSchema('jsonplaceholder', 'Users', jsonData);
    console.log('Schema saved to:', schemaPath);
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

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  // File-based validation
  test("Validate Users response", function(){
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder', 'Users', jsonData,
      { createSchema: true, verbose: true }
    );
    expect(result).to.equal(true);
  });

  // Inline schema validation (no file needed)
  test("Validate against inline schema", function(){
    const mySchema = {
      type: "object",
      properties: { id: { type: "number" }, name: { type: "string" } },
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

Check if a schema file exists. **Returns:** `boolean`

```javascript
expect(validator.schemaExists('jsonplaceholder', 'Users')).to.equal(true);
```

---

#### `getSchemaPath(folderName, fileName)`

Get the full path to a schema file. **Returns:** `string`

```javascript
const fullPath = validator.getSchemaPath('jsonplaceholder', 'Users');
// → <collection>/api-schemas/jsonplaceholder/Users_schema.json
```

---

#### `getSchema(folderName, fileName)`

Load and return a schema object (uses cache). **Returns:** `object | null`

```javascript
const schema = validator.getSchema('jsonplaceholder', 'Users');
```

---

#### `clearCache()` / `clearCacheForSchema(folderName, fileName)`

Clear cached validators and schemas.

```javascript
validator.clearCache();                                    // Clear all
validator.clearCacheForSchema('jsonplaceholder', 'Users'); // Clear one
```

---

#### `getCacheStats()`

**Returns:** `{ validatorCacheSize: number, schemaCacheSize: number }`

```javascript
const stats = validator.getCacheStats();
console.log(stats); // { validatorCacheSize: 3, schemaCacheSize: 3 }
```

---

### Schema Comparison

#### `compareSchemas(oldSchema, newSchema)`

Detect breaking vs non-breaking changes between two schema versions.

| Parameter | Type | Description |
|---|---|---|
| `oldSchema` | object | The original schema |
| `newSchema` | object | The new schema to compare |

**Returns:** `{ breaking: [], nonBreaking: [], recommendedVersionBump: 'patch'|'minor'|'major' }`

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

    expect(changes.breaking.length).to.be.greaterThan(0);
  });
}
```

---

### OpenAPI / Swagger Support

#### `openApiToJsonSchema(openApiSpec)`

Converts an OpenAPI 3.0 specification into JSON Schema objects.

| Parameter | Type | Description |
|---|---|---|
| `openApiSpec` | string/object | OpenAPI spec as YAML string, JSON string, or JS object |

**Returns:** `object` — map of schema names to JSON Schema objects

> Requires `js-yaml` for YAML input: `npm install js-yaml`

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Validate against OpenAPI contract", function(){
    const openApiSpec = {
      openapi: "3.0.0",
      info: { title: "My API", version: "1.0.0" },
      components: {
        schemas: {
          User: {
            type: "object",
            properties: {
              id:   { type: "integer" },
              name: { type: "string" },
              email: { type: "string", nullable: true }
            },
            required: ["id", "name"]
          }
        }
      }
    };

    const schemas = validator.openApiToJsonSchema(openApiSpec);
    // nullable gets converted to ["string", "null"]
    expect(schemas.User.properties.email.type).to.include('null');

    // Validate response against contract
    const result = validator.validateJsonSchemaSync(schemas.User, jsonData[0]);
    expect(result.valid).to.equal(true);
  });
}
```

---

### Request Validation

#### `validateRequest(request, schemas)`

Validate request body, headers, and query parameters against separate schemas.

| Parameter | Type | Description |
|---|---|---|
| `request` | object | Object with `body`, `headers`, `query` properties |
| `schemas.body` | object | JSON schema for request body |
| `schemas.headers` | object | JSON schema for headers |
| `schemas.query` | object | JSON schema for query parameters |

**Returns:** `{ valid, body: { valid, errors }, headers: { valid, errors }, query: { valid, errors } }`

```javascript
tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Validate request structure", function(){
    const request = {
      body: { name: "John Doe", email: "john@example.com", age: 30 },
      headers: { "content-type": "application/json", "authorization": "Bearer eyJhbGci..." },
      query: { page: "1", limit: "10" }
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
      }
    });

    expect(result.valid).to.equal(true);
  });
}
```

---

### Security Validation

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

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("No PII in response", function(){
    const result = validator.validateSecurity(jsonData);
    expect(result.secure).to.equal(true);
  });

  test("GDPR compliance check", function(){
    const result = validator.validateSecurity(jsonData, { complianceStandard: 'GDPR' });
    if (result.hasPII) {
      console.warn('⚠️ GDPR: Personal data detected');
    }
  });
}
```

---

## ⚡ Standalone Helpers (No Instance Required)

These functions are designed for quick use in Bruno CLI test scripts. Import them directly — no `new SchemaValidator()` needed.

```javascript
const {
  validate, assertSchema, assertStatus, assertFields, assertType,
  schemaFrom, checkPII, assertArrayOf, assertEnum, assertMatch,
  assertRange, assertNonEmpty, assertResponseTime, assertDateBetween
} = require('bruno-api-schema-validator');
```

---

#### `validate(schema, data, opts)`

Validate data against an inline JSON schema. Returns a result object (does not throw).

**Returns:** `{ valid: boolean, errors: object[]|null }`

```javascript
const { validate } = require('bruno-api-schema-validator');

const result = validate(
  { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
  { id: 42 }
);
console.log(result.valid); // true
```

---

#### `assertSchema(schema, data, message)`

Assert that data matches a schema — **throws on failure**.

```javascript
const { assertSchema } = require('bruno-api-schema-validator');

assertSchema(
  { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  jsonData[0]
);
```

---

#### `assertStatus(res, expectedStatus, message)`

Assert HTTP response status code. Works with Bruno's `res` object or any `{ status }` / `{ statusCode }` object.

```javascript
const { assertStatus } = require('bruno-api-schema-validator');

assertStatus(res, 200);
assertStatus(res, 201, 'User should be created');
```

---

#### `assertFields(body, fields)`

Assert that the body contains specific fields. Supports **dot-notation** for nested paths.

```javascript
const { assertFields } = require('bruno-api-schema-validator');

assertFields(jsonData[0], ['id', 'name', 'address.city', 'company.name']);
```

---

#### `assertType(value, expectedType, message)`

Assert that a value matches the expected type: `'string'`, `'number'`, `'boolean'`, `'object'`, `'array'`, `'null'`.

```javascript
const { assertType } = require('bruno-api-schema-validator');

assertType(jsonData[0].id, 'number');
assertType(jsonData, 'array');
assertType(jsonData[0].name, 'string');
```

---

#### `schemaFrom(sample)`

Quick schema builder — creates a JSON Schema from a sample value.

> Requires `generate-schema`: `npm install generate-schema`

```javascript
const { schemaFrom } = require('bruno-api-schema-validator');

const schema = schemaFrom(jsonData);
console.log(JSON.stringify(schema, null, 2));
// Use it to validate future responses
```

---

#### `checkPII(data)`

Check if data contains potential PII (standalone, no instance needed).

**Returns:** `{ hasPII: boolean, findings: Array<{type: string, path: string}> }`

```javascript
const { checkPII } = require('bruno-api-schema-validator');

const result = checkPII(jsonData);
if (result.hasPII) {
  console.warn('PII detected:', result.findings);
}
```

---

#### `assertArrayOf(data, itemSchema, message)`

Assert that **every item** in an array matches a schema. Common for `GET /users` list endpoints.

```javascript
const { assertArrayOf } = require('bruno-api-schema-validator');

assertArrayOf(jsonData, {
  type: "object",
  properties: {
    id:    { type: "number" },
    name:  { type: "string" }
  },
  required: ["id", "name"]
});
```

---

#### `assertEnum(value, allowedValues, message)`

Assert a value is one of an allowed set. Useful for status fields, roles, etc.

```javascript
const { assertEnum } = require('bruno-api-schema-validator');

assertEnum(jsonData[0].status, ['active', 'inactive', 'pending']);
```

---

#### `assertMatch(value, regex, message)`

Assert a string matches a regex pattern. Useful for format checks (UUID, date patterns, etc).

```javascript
const { assertMatch } = require('bruno-api-schema-validator');

assertMatch(jsonData[0].email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
assertMatch(jsonData[0].id, /^[0-9a-f-]{36}$/i, 'ID should be UUID format');
```

---

#### `assertRange(value, min, max, message)`

Assert a number falls within a range (inclusive). Common for pagination, counts, scores.

```javascript
const { assertRange } = require('bruno-api-schema-validator');

assertRange(jsonData.length, 1, 100, 'Should return between 1 and 100 items');
assertRange(jsonData[0].age, 0, 150);
```

---

#### `assertNonEmpty(value, message)`

Assert value is not null, undefined, empty string, empty array, or empty object.

```javascript
const { assertNonEmpty } = require('bruno-api-schema-validator');

assertNonEmpty(jsonData);
assertNonEmpty(jsonData[0].name);
```

---

#### `assertResponseTime(res, maxMs, message)`

Assert response time is within acceptable limits. Works with Bruno's `res.getResponseTime()`.

```javascript
const { assertResponseTime } = require('bruno-api-schema-validator');

assertResponseTime(res, 2000);  // Must respond within 2 seconds
assertResponseTime(res, 500, 'API too slow for SLA');
```

---

#### `assertDateBetween(value, start, end, message)`

Assert that a date string falls between two dates. Useful for `createdAt`, `updatedAt`, `expiry` fields.

```javascript
const { assertDateBetween } = require('bruno-api-schema-validator');

assertDateBetween(jsonData[0].createdAt, '2024-01-01', '2026-12-31');
assertDateBetween(jsonData[0].expiresAt, new Date(), new Date('2027-01-01'), 'Token should not be expired');
```

---

## 🎨 Bruno Examples (Copy-Paste Ready)

### Example 1: Minimal — One-liner Validation

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Schema valid", function(){
    expect(validator.validateJsonSchemaSync('api', 'Users', jsonData, { createSchema: true })).to.equal(true);
  });
}
```

### Example 2: Standalone Helpers Only (No Instance)

```javascript
tests {
  const jsonData = res.getBody();
  const { assertStatus, assertFields, assertType, assertNonEmpty, assertArrayOf, assertResponseTime, checkPII } = require('bruno-api-schema-validator');

  test("Status is 200", function(){
    assertStatus(res, 200);
  });

  test("Response time < 2s", function(){
    assertResponseTime(res, 2000);
  });

  test("Response is non-empty array", function(){
    assertNonEmpty(jsonData);
    assertType(jsonData, 'array');
  });

  test("Each user has required fields", function(){
    assertArrayOf(jsonData, {
      type: "object",
      properties: {
        id:    { type: "number" },
        name:  { type: "string" },
        email: { type: "string", format: "email" }
      },
      required: ["id", "name", "email"]
    });
  });

  test("First user has nested fields", function(){
    assertFields(jsonData[0], ['id', 'name', 'email', 'address.city']);
  });

  test("No PII leakage", function(){
    const pii = checkPII(jsonData);
    expect(pii.hasPII).to.equal(false);
  });
}
```

### Example 3: Complete Bruno .bru File

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
  const { assertStatus, assertResponseTime, checkPII } = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Status code is 200", function(){
    assertStatus(res, 200);
  });

  test("Response time acceptable", function(){
    assertResponseTime(res, 2000);
  });

  test("Valid response JSON schema", function(){
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder', 'Users', jsonData,
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

### Example 4: POST Request with Request + Response Validation

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const { assertStatus, assertFields } = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Status 201 Created", function(){
    assertStatus(res, 201);
  });

  test("Validate request body", function(){
    const requestBody = JSON.parse(req.getBody());
    const result = validator.validateRequest(
      { body: requestBody },
      {
        body: {
          type: "object",
          properties: {
            name:  { type: "string" },
            email: { type: "string", format: "email" }
          },
          required: ["name", "email"]
        }
      }
    );
    expect(result.valid).to.equal(true);
  });

  test("Response has expected fields", function(){
    assertFields(jsonData, ['id', 'name', 'email']);
  });
}
```

### Example 5: Schema Evolution Workflow

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();

  test("Check for breaking changes", function(){
    const existingSchema = validator.getSchema('jsonplaceholder', 'Users');

    if (existingSchema) {
      const { schemaFrom } = require('bruno-api-schema-validator');
      const newSchema = schemaFrom(jsonData);

      const changes = validator.compareSchemas(
        existingSchema.items || existingSchema,
        newSchema.items || newSchema
      );

      console.log('Breaking:', changes.breaking.length);
      console.log('Non-breaking:', changes.nonBreaking.length);
      console.log('Bump:', changes.recommendedVersionBump);

      expect(changes.breaking.length).to.equal(0);
    }
  });
}
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

**Fix:** Regenerate the schema with a response that includes null values:

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

### ESM Error: "Unexpected token 'export'"

This library is fully CommonJS — no ESM dependencies. If you see this error, make sure you're using the latest version:

```bash
npm install bruno-api-schema-validator@latest
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
8. **Security Checks** — Add `validateSecurity()` or `checkPII()` to catch PII leakage
9. **Use Standalone Helpers** — Prefer `assertStatus`, `assertFields`, etc. for quick checks that don't need a schema file
10. **Response Time SLAs** — Use `assertResponseTime()` to enforce performance budgets

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
