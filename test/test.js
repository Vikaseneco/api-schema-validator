/**
 * Simple test file to verify the package works
 */

const SchemaValidator = require('../lib/index');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Running tests for @eneco/api-schema-validator...\n');

// Test data
const testData = [
  {
    name: "Test Asset 1",
    id: "123e4567-e89b-12d3-a456-426614174000",
    fullName: "Test Asset Full Name",
    assetConfiguration: {
      capacity: 100,
      type: "solar"
    }
  },
  {
    name: "Test Asset 2",
    id: "223e4567-e89b-12d3-a456-426614174001",
    fullName: "Another Test Asset",
    assetConfiguration: {
      capacity: 150,
      type: "wind"
    }
  }
];

const invalidTestData = [
  {
    name: "Invalid Asset",
    id: 12345, // Wrong type - should be string
    fullName: "Invalid Asset",
    assetConfiguration: null
  }
];

// Test configuration
const testSchemaPath = './test-schemas';
const validator = new SchemaValidator(testSchemaPath);

// Cleanup function
function cleanup() {
  if (fs.existsSync(testSchemaPath)) {
    fs.rmSync(testSchemaPath, { recursive: true, force: true });
  }
}

// Run tests
async function runTests() {
  let passedTests = 0;
  let failedTests = 0;

  try {
    // Cleanup before tests
    cleanup();

    // Test 1: Create schema
    console.log('Test 1: Create JSON schema');
    try {
      const schemaPath = await validator.createJsonSchema('test/api', 'TestAssets', testData);
      assert.ok(fs.existsSync(schemaPath), 'Schema file should exist');
      console.log('✓ PASS: Schema created successfully\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

    // Test 2: Schema exists check
    console.log('Test 2: Check if schema exists');
    try {
      const exists = validator.schemaExists('test/api', 'TestAssets');
      assert.strictEqual(exists, true, 'Schema should exist');
      console.log('✓ PASS: Schema exists check works\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

    // Test 3: Get schema path
    console.log('Test 3: Get schema path');
    try {
      const schemaPath = validator.getSchemaPath('test/api', 'TestAssets');
      assert.ok(schemaPath.includes('TestAssets_schema.json'), 'Path should include schema filename');
      console.log('✓ PASS: Schema path retrieved correctly\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

    // Test 4: Sync validation with valid data
    console.log('Test 4: Synchronous validation with valid data');
    try {
      const isValid = validator.validateJsonSchemaSync('test/api', 'TestAssets', testData, { verbose: false });
      assert.strictEqual(isValid, true, 'Validation should pass with valid data');
      console.log('✓ PASS: Valid data passes validation\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

    // Test 5: Sync validation with invalid data
    console.log('Test 5: Synchronous validation with invalid data');
    try {
      const isValid = validator.validateJsonSchemaSync('test/api', 'TestAssets', invalidTestData, { verbose: false });
      assert.strictEqual(isValid, false, 'Validation should fail with invalid data');
      console.log('✓ PASS: Invalid data fails validation as expected\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

    // Test 6: Async validation with valid data
    console.log('Test 6: Asynchronous validation with valid data');
    try {
      const isValid = await validator.validateJsonSchema('test/api', 'TestAssets', testData, { verbose: false });
      assert.strictEqual(isValid, true, 'Async validation should pass with valid data');
      console.log('✓ PASS: Async validation works with valid data\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

    // Test 7: Async validation with invalid data
    console.log('Test 7: Asynchronous validation with invalid data');
    try {
      const isValid = await validator.validateJsonSchema('test/api', 'TestAssets', invalidTestData, { verbose: false });
      assert.strictEqual(isValid, false, 'Async validation should fail with invalid data');
      console.log('✓ PASS: Async validation fails with invalid data as expected\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

    // Test 8: Non-existent schema
    console.log('Test 8: Validation with non-existent schema');
    try {
      const isValid = validator.validateJsonSchemaSync('test/api', 'NonExistent', testData, { verbose: false });
      assert.strictEqual(isValid, false, 'Validation should fail when schema does not exist');
      console.log('✓ PASS: Correctly handles non-existent schema\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

    // Test 9: Create schema with auto-validation
    console.log('Test 9: Create schema and validate in one call');
    try {
      const newData = [{ name: "New Asset", id: "999", value: 42 }];
      const isValid = await validator.validateJsonSchema('test/api', 'NewAssets', newData, { 
        createSchema: true, 
        verbose: false 
      });
      assert.strictEqual(isValid, true, 'Should create schema and validate successfully');
      assert.ok(validator.schemaExists('test/api', 'NewAssets'), 'Schema should be created');
      console.log('✓ PASS: Schema creation and validation in one call works\n');
      passedTests++;
    } catch (error) {
      console.error('✗ FAIL:', error.message, '\n');
      failedTests++;
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    // Cleanup after tests
    cleanup();
  }

  // Print summary
  console.log('='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests} ✓`);
  console.log(`Failed: ${failedTests} ✗`);
  console.log('='.repeat(50));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test suite failed:', error);
  cleanup();
  process.exit(1);
});
