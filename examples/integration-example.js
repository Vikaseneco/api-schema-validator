/**
 * Example: Integration in existing projects
 * Shows folder structure and how schemas are stored
 */

const SchemaValidator = require('../lib/index');
const path = require('path');

console.log('=== bruno-api-schema-validator - Integration Example ===\n');

console.log('📁 FOLDER STRUCTURE AFTER INSTALLATION:\n');

console.log(`your-project/
├── package.json
├── node_modules/
│   └── @eneco/
│       └── api-schema-validator/
├── api-schemas/                    ← Your schemas stored here
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
`);

console.log('\n📝 USAGE IN YOUR PROJECT:\n');

console.log('1. Install the package:');
console.log('   npm install bruno-api-schema-validator\n');

console.log('2. Use in your tests:');
console.log(`
const SchemaValidator = require('bruno-api-schema-validator');
const validator = new SchemaValidator('./api-schemas');

// In Bruno tests
test("Schema validation", function(){
  const result = validator.validateJsonSchemaSync('vpp/Asset Manager', 'RegisteredAssets', jsonData);
  expect(result).to.equal(true);
});

// In Jest/Mocha tests
it('should validate API response', () => {
  const response = { /* API response */ };
  const isValid = validator.validateJsonSchemaSync('api/v1', 'Users', response);
  expect(isValid).toBe(true);
});
`);

console.log('\n🗂️  HOW SCHEMAS ARE STORED:\n');

console.log('When you call:');
console.log('  validator.createJsonSchema("vpp/Asset Manager", "RegisteredAssets", jsonData)\n');

console.log('Schema is saved to:');
console.log('  ./api-schemas/vpp/Asset Manager/RegisteredAssets_schema.json\n');

console.log('Example schema file content:');
console.log(JSON.stringify({
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "id": { "type": "string" },
      "fullName": { "type": "string" },
      "assetConfiguration": { "type": "object" }
    },
    "required": ["name", "id", "fullName", "assetConfiguration"]
  }
}, null, 2));

console.log('\n\n🔄 COMPARISON WORKFLOW:\n');

console.log(`
Step 1: First API call - Generate schema
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

Step 2: Subsequent API calls - Validate against schema
┌─────────────────┐          ┌─────────────────────────┐
│   API Response  │          │ Stored Schema File      │
│   (JSON data)   │          │ RegisteredAssets_schema │
└────────┬────────┘          └───────────┬─────────────┘
         │                               │
         └──────────┬────────────────────┘
                    ▼
          validateJsonSchemaSync()
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    ✓ PASS                ✗ FAIL
  (Structure              (Shows exactly
   matches)                what's wrong)
`);

console.log('\n🎯 PRACTICAL EXAMPLE:\n');

// Demonstrate actual usage
const validator = new SchemaValidator('./example-schemas');

const sampleData = [
  { name: "Test Asset", id: "abc123", fullName: "Test Asset Full Name", assetConfiguration: {} }
];

console.log('Creating schema...');
validator.createJsonSchema('demo', 'SampleAsset', sampleData)
  .then(schemaPath => {
    console.log(`\n✓ Schema created at: ${schemaPath}`);
    console.log('\nValidating same data...');
    
    const isValid = validator.validateJsonSchemaSync('demo', 'SampleAsset', sampleData);
    console.log(`Result: ${isValid ? '✓ VALID' : '✗ INVALID'}`);
    
    console.log('\n\n📚 For more examples, see:');
    console.log('  - examples/basic-usage.js');
    console.log('  - examples/bruno-integration.js');
    console.log('  - README.md');
  })
  .catch(console.error);

