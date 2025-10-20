/**
 * Example: Using @eneco/api-schema-validator in Bruno API tests
 * 
 * This shows how to integrate the package in your Bruno .bru files
 */

// ========================================
// EXAMPLE 1: Basic Bruno Test Integration
// ========================================

/*
File: GetRegisteredAssets.bru

meta {
  name: GetRegisteredAssets
  type: http
  seq: 1
}

get {
  url: {{API_URL}}/v1/assets
  body: none
  auth: inherit
}

tests {
  const jsonData = res.getBody();
  
  // Import the validator
  const SchemaValidator = require('@eneco/api-schema-validator');
  
  // Create validator instance pointing to your schema directory
  const validator = new SchemaValidator('./api-schemas');
  
  test("Valid response JSON schema - Assets", function(){
    const result = validator.validateJsonSchemaSync(
      'vpp/Asset Manager', 
      'RegisteredAssets', 
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
*/

// ========================================
// EXAMPLE 2: First-time Schema Creation
// ========================================

/*
File: CreateSchema_FirstTime.bru

meta {
  name: Create Schema - First Time Setup
  type: http
  seq: 1
}

get {
  url: {{API_URL}}/v1/assets
  body: none
  auth: inherit
}

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('@eneco/api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  test("Create schema from response", async function(){
    // First time: create schema
    const schemaPath = await validator.createJsonSchema(
      'vpp/Asset Manager',
      'RegisteredAssets',
      jsonData
    );
    console.log('Schema created at:', schemaPath);
  });
  
  // After creating schema, use the regular validation test from Example 1
}
*/

// ========================================
// EXAMPLE 3: Advanced Bruno Test with Options
// ========================================

/*
File: GetAssets_Advanced.bru

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('@eneco/api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  test("Schema validation with custom options", function(){
    const result = validator.validateJsonSchemaSync(
      'vpp/Asset Manager', 
      'RegisteredAssets', 
      jsonData,
      {
        verbose: true,        // Show detailed errors
        throwOnError: false   // Return false instead of throwing
      }
    );
    expect(result).to.equal(true);
  });
  
  test("Check if schema exists before validation", function(){
    const exists = validator.schemaExists('vpp/Asset Manager', 'RegisteredAssets');
    expect(exists).to.equal(true);
  });
  
  test("Get schema file path", function(){
    const schemaPath = validator.getSchemaPath('vpp/Asset Manager', 'RegisteredAssets');
    console.log('Schema location:', schemaPath);
    expect(schemaPath).to.include('RegisteredAssets_schema.json');
  });
}
*/

// ========================================
// EXAMPLE 4: Multiple Endpoints
// ========================================

/*
File: MultipleEndpoints.bru

tests {
  const SchemaValidator = require('@eneco/api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  // Test Assets endpoint
  test("Validate Assets schema", function(){
    const assetsData = res.getBody();
    const result = validator.validateJsonSchemaSync(
      'vpp/Asset Manager',
      'RegisteredAssets',
      assetsData
    );
    expect(result).to.equal(true);
  });
}
*/

// ========================================
// EXAMPLE 5: Using in Node.js Test Scripts
// ========================================

const SchemaValidator = require('@eneco/api-schema-validator');
const assert = require('assert');

async function testAPIWithSchemaValidation() {
  const validator = new SchemaValidator('./api-schemas');
  
  // Simulate API call
  const apiResponse = await fetch('https://api.example.com/assets').then(r => r.json());
  
  // Validate response
  const isValid = validator.validateJsonSchemaSync('api/v1', 'Assets', apiResponse);
  
  assert.strictEqual(isValid, true, 'API response should match schema');
  console.log('✓ API response validated successfully');
}

// testAPIWithSchemaValidation().catch(console.error);

console.log('Bruno integration examples loaded. Copy the examples above into your .bru files.');
