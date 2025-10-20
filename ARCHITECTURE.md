# Package Overview & Architecture

## 📦 NPM Package Structure

```
@eneco/api-schema-validator/
│
├── 📄 package.json                 # NPM package metadata
├── 📄 README.md                    # Main documentation (350+ lines)
├── 📄 SETUP_GUIDE.md              # Complete setup instructions
├── 📄 MIGRATION.md                # Migration from old version
├── 📄 INDEX.md                    # Quick reference
├── 📄 .gitignore                  # Git ignore rules
│
├── 📁 lib/
│   └── 📄 index.js                # Main library (300+ lines)
│       ├── class SchemaValidator
│       ├── createJsonSchema()
│       ├── validateJsonSchemaSync()
│       ├── validateJsonSchema()
│       ├── schemaExists()
│       └── getSchemaPath()
│
├── 📁 examples/
│   ├── 📄 basic-usage.js          # Basic usage example
│   ├── 📄 bruno-integration.js    # Bruno .bru file examples
│   └── 📄 integration-example.js  # Folder structure & workflow
│
└── 📁 test/
    └── 📄 test.js                 # Test suite (9 tests)
```

## 🔄 How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│              @eneco/api-schema-validator                  │
│                    (NPM Package)                          │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │         SchemaValidator Class                     │   │
│  │                                                    │   │
│  │  • Constructor(schemaBasePath)                    │   │
│  │  • createJsonSchema()        [Async]              │   │
│  │  • validateJsonSchema()      [Async]              │   │
│  │  • validateJsonSchemaSync()  [Sync] ⭐ Bruno     │   │
│  │  • schemaExists()            [Sync]               │   │
│  │  • getSchemaPath()           [Sync]               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  Dependencies:                                            │
│  • ajv (JSON Schema validator)                           │
│  • generate-schema (Schema generator)                    │
│  • node:fs (File system)                                 │
│  • node:path (Path utilities)                            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
1️⃣ SCHEMA CREATION (One-Time Setup)
═══════════════════════════════════════════════════════

┌─────────────────┐
│   API Response  │
│   {data: [...]} │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ validator.createJsonSchema()     │
│ ('vpp/Asset', 'Assets', data)   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Generate JSON Schema (Draft-07)│
│  - Analyze data structure        │
│  - Define types & required fields│
│  - Create validation rules       │
└────────┬────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────┐
│  Save to Disk                              │
│  api-schemas/vpp/Asset/Assets_schema.json │
└───────────────────────────────────────────┘


2️⃣ SCHEMA VALIDATION (Every Test Run)
═══════════════════════════════════════════════════════

┌─────────────────┐          ┌─────────────────────────┐
│  New API        │          │  Stored Schema File     │
│  Response       │          │  Assets_schema.json     │
└────────┬────────┘          └───────────┬─────────────┘
         │                               │
         └───────────┬───────────────────┘
                     ▼
         ┌────────────────────────────┐
         │ validateJsonSchemaSync()    │
         │ ('vpp/Asset', 'Assets', data)│
         └────────┬───────────────────┘
                  │
     ┌────────────┴────────────┐
     ▼                         ▼
┌─────────┐              ┌──────────┐
│ ✓ PASS  │              │ ✗ FAIL   │
│         │              │          │
│ Structure│              │ Detailed │
│ matches  │              │ error    │
│ schema   │              │ report   │
└─────────┘              └──────────┘
```

### Integration in Your Project

```
YOUR PROJECT
═══════════════════════════════════════════════════

├── package.json
│   └── dependencies: { "@eneco/api-schema-validator": "^1.0.0" }
│
├── node_modules/
│   └── @eneco/
│       └── api-schema-validator/    ← Installed package
│
├── api-schemas/                      ← Your schemas
│   ├── vpp/
│   │   └── Asset Manager/
│   │       ├── RegisteredAssets_schema.json
│   │       └── AssetDetails_schema.json
│   └── api/
│       └── v1/
│           └── Users_schema.json
│
└── tests/
    └── api/
        └── assets.test.bru

    In assets.test.bru:
    ┌──────────────────────────────────────────────┐
    │ tests {                                       │
    │   const SchemaValidator = require(           │
    │     '@eneco/api-schema-validator'            │
    │   );                                          │
    │   const validator = new SchemaValidator(     │
    │     './api-schemas'                          │
    │   );                                          │
    │                                               │
    │   test("Schema validation", function() {      │
    │     const result = validator                  │
    │       .validateJsonSchemaSync(               │
    │         'vpp/Asset Manager',                 │
    │         'RegisteredAssets',                  │
    │         jsonData                             │
    │       );                                      │
    │     expect(result).to.equal(true);           │
    │   });                                         │
    │ }                                             │
    └──────────────────────────────────────────────┘
```

## 🎯 Usage Patterns

### Pattern 1: Bruno API Testing (Most Common)

```javascript
// In GetAssets.bru
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('@eneco/api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  test("Schema validation", function(){
    const result = validator.validateJsonSchemaSync(
      'api/v1',
      'Assets',
      jsonData
    );
    expect(result).to.equal(true);
  });
}
```

### Pattern 2: First-Time Schema Generation

```javascript
// generate-schemas.js
const SchemaValidator = require('@eneco/api-schema-validator');
const validator = new SchemaValidator('./api-schemas');

async function generateSchemas() {
  const assetsResponse = await fetchAssets();
  const usersResponse = await fetchUsers();
  
  await validator.createJsonSchema('api/v1', 'Assets', assetsResponse);
  await validator.createJsonSchema('api/v1', 'Users', usersResponse);
  
  console.log('✓ Schemas generated');
}

generateSchemas();
```

### Pattern 3: Jest/Mocha Unit Tests

```javascript
const SchemaValidator = require('@eneco/api-schema-validator');
const validator = new SchemaValidator('./api-schemas');

describe('API Schema Validation', () => {
  it('should validate assets response', () => {
    const response = { /* API response */ };
    const isValid = validator.validateJsonSchemaSync('api/v1', 'Assets', response);
    expect(isValid).toBe(true);
  });
});
```

### Pattern 4: CI/CD Pipeline

```javascript
// validate-all-endpoints.js
const SchemaValidator = require('@eneco/api-schema-validator');
const validator = new SchemaValidator('./api-schemas');

const endpoints = [
  { path: 'api/v1', name: 'Assets', url: '/api/assets' },
  { path: 'api/v1', name: 'Users', url: '/api/users' },
];

async function validateAll() {
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint.url).then(r => r.json());
    const isValid = validator.validateJsonSchemaSync(
      endpoint.path,
      endpoint.name,
      response
    );
    
    if (!isValid) {
      console.error(`❌ ${endpoint.name} schema validation failed`);
      process.exit(1);
    }
    console.log(`✓ ${endpoint.name}`);
  }
}

validateAll();
```

## 📊 Comparison Matrix

| Feature | Old (validateSchema.js) | New (NPM Package) |
|---------|-------------------------|-------------------|
| **Installation** | Copy file manually | `npm install` |
| **Updates** | Manual copy | `npm update` |
| **Versioning** | No versioning | Semantic versioning |
| **Reusability** | Single project | Any project |
| **Documentation** | Comments only | Full docs + examples |
| **Testing** | No tests | 9 automated tests |
| **Maintenance** | Per-project | Centralized |
| **Path handling** | `__dirname` hack | Configurable base path |
| **API** | Function exports | Class-based OOP |
| **Distribution** | Git copy | NPM registry |

## 🚀 Getting Started Steps

```
Step 1: Install Package
═══════════════════════
$ npm install @eneco/api-schema-validator


Step 2: Create Schema Directory
═══════════════════════════════════
$ mkdir api-schemas


Step 3: Generate First Schema
═══════════════════════════════════
const validator = new SchemaValidator('./api-schemas');
await validator.createJsonSchema('api/v1', 'Assets', goodResponse);


Step 4: Add to Tests
═══════════════════════════════════
test("Schema validation", function(){
  const result = validator.validateJsonSchemaSync('api/v1', 'Assets', data);
  expect(result).to.equal(true);
});


Step 5: Run Tests
═══════════════════════════════════
$ bruno run your-collection.bru
✓ Schema validation PASS
```

## 📚 Documentation Files

1. **INDEX.md** (this file) - Overview & architecture
2. **README.md** - Complete API documentation
3. **SETUP_GUIDE.md** - Step-by-step setup
4. **MIGRATION.md** - Migrate from old version
5. **examples/** - Working code examples

## 🎓 Learning Path

```
1. Read INDEX.md (you are here) ─────────────┐
                                              │
2. Read README.md                             │
   • Installation                             │
   • Quick start                              │
   • API reference                            │
                                              │
3. Run examples/basic-usage.js                │
   $ npm run example                          │
                                              │
4. Read SETUP_GUIDE.md                        │
   • Complete integration                     │
   • Real-world examples                      │
                                              │
5. Read examples/bruno-integration.js         │
   • Copy patterns to your .bru files         │
                                              │
6. Test in your project                       │
   • Start with one endpoint                  │
   • Validate it works                        │
                                              │
7. Roll out to all endpoints ────────────────┘
   • Generate schemas for all
   • Update all tests
   • Commit schemas to Git
```

## 💡 Key Concepts

### Schema File
A JSON file defining the expected structure of an API response.

**Example:** `api-schemas/api/v1/Assets_schema.json`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" }
    },
    "required": ["id", "name"]
  }
}
```

### Validator Instance
Object that knows where to find schemas and how to validate.

```javascript
const validator = new SchemaValidator('./api-schemas');
```

### Sync vs Async
- **Sync** (`validateJsonSchemaSync`): Use in Bruno tests (required)
- **Async** (`validateJsonSchema`): Use in Node.js scripts

### Folder Organization
```
api-schemas/
├── {api-name}/          # e.g., "api/v1" or "vpp/Asset Manager"
    └── {endpoint}_schema.json
```

## 🎯 Success Criteria

✅ Package installed successfully  
✅ Schema directory created  
✅ At least one schema generated  
✅ Schema validation working in Bruno  
✅ Tests passing  
✅ Schemas committed to Git  
✅ Team members trained  

## 📞 Support

- **Issues**: GitHub Issues
- **Email**: vpp-testing-team@eneco.com
- **Docs**: See documentation files

---

**Ready to get started? See [SETUP_GUIDE.md](./SETUP_GUIDE.md)**
