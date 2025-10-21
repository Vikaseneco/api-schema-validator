# bruno-api-schema-validator - Complete Setup Guide

## 📦 Package Structure

```
api-schema-validator/
├── package.json                    # NPM package configuration
├── README.md                       # Main documentation
├── MIGRATION.md                    # Migration guide from old version
├── .gitignore                      # Git ignore rules
├── lib/
│   └── index.js                   # Main validation library
├── examples/
│   ├── basic-usage.js             # Basic usage example
│   ├── bruno-integration.js       # Bruno integration examples
│   └── integration-example.js     # How to integrate in projects
└── test/
    └── test.js                    # Test suite
```

## 🚀 Quick Start Guide

### 1. Install the Package

```bash
cd your-project
npm install bruno-api-schema-validator
```

### 2. Folder Structure After Installation

```
your-project/
├── package.json
├── node_modules/
│   └── @eneco/
│       └── api-schema-validator/
├── api-schemas/                    ← Schemas stored here
│   └── (will be created automatically)
└── tests/
    └── your-tests.bru
```

### 3. First-Time Usage: Create a Schema

```javascript
const SchemaValidator = require('bruno-api-schema-validator');
const validator = new SchemaValidator('./api-schemas');

// Your API response
const apiResponse = [
  { 
    name: "Asset-001", 
    id: "123e4567-e89b-12d3-a456-426614174000",
    fullName: "Solar Farm Asset"
  }
];

// Create schema (one-time setup)
await validator.createJsonSchema('vpp/Asset Manager', 'RegisteredAssets', apiResponse);
```

**This creates:**
```
api-schemas/
└── vpp/
    └── Asset Manager/
        └── RegisteredAssets_schema.json
```

### 4. Use in Bruno Tests

```javascript
// In your .bru file
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  test("Valid response JSON schema", function(){
    const result = validator.validateJsonSchemaSync(
      'vpp/Asset Manager', 
      'RegisteredAssets', 
      jsonData
    );
    expect(result).to.equal(true);
  });
}
```

## 📋 Step-by-Step Integration

### For Bruno API Testing Project

#### Step 1: Install Package
```bash
cd VPP-Core
npm init -y  # If package.json doesn't exist
npm install bruno-api-schema-validator
```

#### Step 2: Create Schema Directory
```bash
mkdir api-schemas
```

#### Step 3: Generate Schemas

Create a one-time script `generate-schemas.js`:

```javascript
const SchemaValidator = require('bruno-api-schema-validator');
const validator = new SchemaValidator('./api-schemas');

// Sample responses (copy from actual API calls)
const registeredAssetsResponse = [
  { name: "Asset-001", id: "abc123", fullName: "Asset 1", assetConfiguration: {} }
];

const assetDetailsResponse = {
  id: "abc123",
  name: "Asset-001",
  details: { /* ... */ }
};

async function generateAllSchemas() {
  // Generate schemas
  await validator.createJsonSchema('vpp/Asset Manager', 'RegisteredAssets', registeredAssetsResponse);
  await validator.createJsonSchema('vpp/Asset Manager', 'AssetDetails', assetDetailsResponse);
  
  console.log('✓ All schemas generated!');
}

generateAllSchemas().catch(console.error);
```

Run it:
```bash
node generate-schemas.js
```

#### Step 4: Update Your Bruno Tests

**Before:**
```javascript
tests {
  var jsonData = res.getBody();
  const {validateJsonSchemaSync} = require('./tools/validateSchema.js');
  
  test("Valid response JSON schema", function(){
    const result = validateJsonSchemaSync("vpp/Asset Manager", "RegisteredAssets", jsonData);
    expect(result).to.equal(true);
  });
}
```

**After:**
```javascript
tests {
  var jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  test("Valid response JSON schema", function(){
    const result = validator.validateJsonSchemaSync(
      "vpp/Asset Manager", 
      "RegisteredAssets", 
      jsonData
    );
    expect(result).to.equal(true);
  });
}
```

#### Step 5: Test Everything
```bash
# Run Bruno tests to verify everything works
bruno run your-collection.bru
```

## 🎯 Real-World Example

### Complete Bruno Test File

```javascript
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

params:query {
  steeringMode: Automatic
}

headers {
  Content-Type: application/json
}

script:pre-request {
  var vppCountry = bru.getEnvVar("VPPCountry");
  if (vppCountry === "TennetDE") {
      req.setHeader("x-tenant-id", "TENNETDE");
  }
}

tests {
  var jsonData = res.getBody();
  
  // Import schema validator
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  // 1. Schema validation (replaces dozens of manual checks)
  test("Valid response JSON schema - Asset Registered-Automatic", function(){
    const result = validator.validateJsonSchemaSync(
      'vpp/Asset Manager',
      'Automatic_RegisteredAssets',
      jsonData,
      { verbose: true }
    );
    expect(result).to.equal(true);
  });
  
  // 2. HTTP status check
  test("Status code is 200", function () {
    expect(res.getStatus()).to.equal(200);
  });
  
  // 3. Content type check
  test("Content-Type is application/json", function () {
    expect(res.getHeader('content-type')).to.include('application/json');
  });
  
  // 4. Business logic checks
  test("At least one asset returned", function () {
    expect(jsonData.length).to.be.greaterThan(0);
  });
  
  test("All asset IDs are unique", function () {
    const ids = jsonData.map(a => a.id);
    const uniqueIds = Array.from(new Set(ids));
    expect(ids.length).to.equal(uniqueIds.length);
  });
}
```

## 📁 Final Folder Structure

```
VPP-Core/
├── package.json                           # Contains bruno-api-schema-validator
├── node_modules/
│   └── @eneco/
│       └── api-schema-validator/
├── api-schemas/                           # Your schemas
│   └── vpp/
│       ├── Asset Manager/
│       │   ├── Automatic_RegisteredAssets_schema.json
│       │   ├── Manual_RegisteredAssets_schema.json
│       │   ├── AssetDetails_schema.json
│       │   └── OperationalConfig_schema.json
│       ├── Asset Schedule/
│       │   ├── Timeseries_schema.json
│       │   └── StrikePrice_schema.json
│       └── TSO/
│           └── Setpoints_schema.json
├── 01_PreCondition/
│   └── 00_Get_Asset_Details/
│       ├── GetRegisteredAssets_Automatic.bru
│       ├── GetRegisteredAssets_Manual.bru
│       ├── GetAssetID_via_Identifier.bru
│       └── GetOperationalConfig.bru
├── 02_IngestTimeSeriesData/
│   └── ... more .bru files
└── generate-schemas.js                    # One-time schema generation
```

## 🔄 Workflow

### Schema Generation (One-Time)
```
1. Make API call and get good response
2. Copy response JSON
3. Run: validator.createJsonSchema('path', 'name', response)
4. Schema saved to: api-schemas/path/name_schema.json
5. Commit schema to Git
```

### Daily Testing
```
1. Bruno runs your .bru file
2. API returns response
3. validator.validateJsonSchemaSync() checks against schema
4. Test passes ✓ or fails ✗ with detailed errors
5. If fails, either fix API or update schema
```

## 🛠️ Testing the Package

### Run Package Tests
```bash
cd api-schema-validator
npm install
npm test
```

### Run Examples
```bash
# Basic usage example
npm run example

# Integration example
node examples/integration-example.js

# Bruno integration (shows code examples)
node examples/bruno-integration.js
```

## 📤 Publishing to NPM (For Package Maintainers)

### First-Time Setup
```bash
cd api-schema-validator
npm login
```

### Publish Package
```bash
# Update version in package.json first
npm version patch  # or minor, or major
npm publish --access public
```

### Install in Other Projects
```bash
npm install bruno-api-schema-validator
```

## 🎓 Learning Path

1. **Read README.md** - Understand what the package does
2. **Run examples/basic-usage.js** - See it in action
3. **Run examples/integration-example.js** - Understand folder structure
4. **Read examples/bruno-integration.js** - Copy patterns for your tests
5. **Try in one .bru file** - Test with one endpoint first
6. **Roll out to all tests** - Migrate all endpoints gradually
7. **Read MIGRATION.md** - If migrating from old validateSchema.js

## 💡 Tips & Best Practices

1. **Commit schemas to Git** - They're part of your API contract
2. **Review schema changes** - Like code reviews
3. **One schema per endpoint** - Don't share unless truly identical
4. **Use verbose mode** - Helpful for debugging: `{ verbose: true }`
5. **Organize by API version** - e.g., `api/v1/`, `api/v2/`
6. **Document breaking changes** - When schemas change

## 🐛 Common Issues

### Issue: "Cannot find module 'bruno-api-schema-validator'"
**Solution:** Install the package: `npm install bruno-api-schema-validator`

### Issue: "Schema file not found"
**Solution:** Generate the schema first using `createJsonSchema()`

### Issue: "Validation fails but response looks correct"
**Solution:** Check console output for exact mismatch details

### Issue: "Test doesn't appear in Bruno"
**Solution:** Make sure you're using `validateJsonSchemaSync()` (sync, not async)

## 📞 Support

- **GitHub Issues**: [Report bugs or request features]
- **Email**: vpp-testing-team@eneco.com
- **Documentation**: See README.md and MIGRATION.md

## ✅ Checklist for Success

- [ ] Package installed: `npm install bruno-api-schema-validator`
- [ ] Schema directory created: `./api-schemas/`
- [ ] Generated schemas for key endpoints
- [ ] Updated at least one .bru file to use package
- [ ] Ran tests and verified they pass
- [ ] Committed schemas to Git
- [ ] Updated team documentation
- [ ] Shared with team members

---

**Happy Testing! 🎉**

