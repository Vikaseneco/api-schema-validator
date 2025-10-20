/**
 * Example: Basic usage of @eneco/api-schema-validator
 * This example shows how to create and validate schemas
 */

const SchemaValidator = require('../lib/index');

// Create a validator instance with custom schema path
const validator = new SchemaValidator('./my-schemas');

// Sample API response (simulate API call)
const apiResponse = [
  {
    name: "Asset-001",
    id: "123e4567-e89b-12d3-a456-426614174000",
    fullName: "Solar Farm Asset 001",
    assetConfiguration: {
      capacity: 100,
      type: "solar"
    }
  },
  {
    name: "Asset-002",
    id: "223e4567-e89b-12d3-a456-426614174001",
    fullName: "Wind Farm Asset 002",
    assetConfiguration: {
      capacity: 150,
      type: "wind"
    }
  }
];

async function main() {
  console.log('=== @eneco/api-schema-validator - Basic Usage Example ===\n');

  // Step 1: Create a schema from the API response
  console.log('Step 1: Creating schema from API response...');
  await validator.createJsonSchema('vpp/Asset Manager', 'RegisteredAssets', apiResponse);
  console.log('');

  // Step 2: Validate the same response (should pass)
  console.log('Step 2: Validating response against schema...');
  const isValid = await validator.validateJsonSchema('vpp/Asset Manager', 'RegisteredAssets', apiResponse);
  console.log(`Validation result: ${isValid ? '✓ PASS' : '✗ FAIL'}`);
  console.log('');

  // Step 3: Test with invalid data (should fail)
  console.log('Step 3: Testing with invalid data...');
  const invalidResponse = [
    {
      name: "Asset-003",
      id: 12345, // ❌ Should be string, not number
      fullName: "Invalid Asset",
      assetConfiguration: null
    }
  ];
  
  const isInvalid = await validator.validateJsonSchema('vpp/Asset Manager', 'RegisteredAssets', invalidResponse);
  console.log(`Validation result: ${isInvalid ? '✓ PASS' : '✗ FAIL (expected)'}`);
  console.log('');

  // Step 4: Synchronous validation (for Bruno tests)
  console.log('Step 4: Synchronous validation (for Bruno/fast tests)...');
  const isSyncValid = validator.validateJsonSchemaSync('vpp/Asset Manager', 'RegisteredAssets', apiResponse);
  console.log(`Sync validation result: ${isSyncValid ? '✓ PASS' : '✗ FAIL'}`);
  console.log('');

  console.log('=== Example Complete ===');
}

main().catch(console.error);
