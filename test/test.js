/**
 * Comprehensive test file for @eneco/api-schema-validator
 * Tests all 17 new features including schema evolution, validation options, 
 * performance testing, mock data generation, and more.
 */

const SchemaValidator = require('../lib/index');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Running comprehensive tests for @eneco/api-schema-validator...\n');

// Test data
const testData = [
  {
    name: "Test Asset 1",
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "test@example.com",
    fullName: "Test Asset Full Name",
    assetConfiguration: {
      capacity: 100,
      type: "solar"
    }
  },
  {
    name: "Test Asset 2",
    id: "223e4567-e89b-12d3-a456-426614174001",
    email: "user@domain.org",
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
    email: "invalid-email",
    fullName: "Invalid Asset",
    assetConfiguration: null
  }
];

// Test configuration
const testSchemaPath = './test-schemas';
let passedTests = 0;
let failedTests = 0;
const pendingTests = [];

// Helper to track test results
function test(name, fn) {
  const testPromise = Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`✓ PASS: ${name}\n`);
      passedTests++;
    })
    .catch((error) => {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  Error: ${error.message}\n`);
      failedTests++;
    });

  pendingTests.push(testPromise);
  return testPromise;
}

// Cleanup function
async function cleanup() {
  await Promise.allSettled(pendingTests);
  if (fs.existsSync(testSchemaPath)) {
    fs.rmSync(testSchemaPath, { recursive: true, force: true });
  }
  if (fs.existsSync('./snapshots')) {
    fs.rmSync('./snapshots', { recursive: true, force: true });
  }
  if (fs.existsSync('./reports')) {
    fs.rmSync('./reports', { recursive: true, force: true });
  }
  if (fs.existsSync('./docs')) {
    fs.rmSync('./docs', { recursive: true, force: true });
  }
}

// Run all tests
async function runTests() {
  cleanup();

  console.log('='.repeat(60));
  console.log('CORE FUNCTIONALITY TESTS');
  console.log('='.repeat(60));

  // Test 1: Basic schema creation
  test('Create JSON schema', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schemaPath = validator.createJsonSchema('test/api', 'TestAssets', testData);
    assert.ok(fs.existsSync(schemaPath), 'Schema file should exist');
  });

  // Test 2: Schema exists check
  test('Check if schema exists', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const exists = validator.schemaExists('test/api', 'TestAssets');
    assert.strictEqual(exists, true, 'Schema should exist');
  });

  // Test 3: Sync validation with valid data
  test('Synchronous validation with valid data', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const isValid = validator.validateJsonSchemaSync('test/api', 'TestAssets', testData, { verbose: false });
    assert.strictEqual(isValid, true, 'Validation should pass with valid data');
  });

  // Test 4: Sync validation with invalid data
  test('Synchronous validation with invalid data', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const isValid = validator.validateJsonSchemaSync('test/api', 'TestAssets', invalidTestData, { verbose: false });
    assert.strictEqual(isValid, false, 'Validation should fail with invalid data');
  });

  // Test 5: Async validation
  test('Asynchronous validation with valid data', async () => {
    const validator = new SchemaValidator(testSchemaPath);
    const isValid = await validator.validateJsonSchema('test/api', 'TestAssets', testData, { verbose: false });
    assert.strictEqual(isValid, true, 'Async validation should pass');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 1: SCHEMA EVOLUTION & VERSIONING');
  console.log('='.repeat(60));

  // Test 6: Compare schemas for breaking changes
  test('Compare schemas - detect breaking changes', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const oldSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'name', 'email']
    };
    const newSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
        // email removed - breaking change
      },
      required: ['id', 'name']
    };
    const changes = validator.compareSchemas(oldSchema, newSchema);
    assert.ok(changes.breakingChanges.length > 0, 'Should detect breaking changes');
    assert.ok(['major', 'minor', 'patch'].includes(changes.recommendedVersionBump), 'Should recommend version bump');
  });

  // Test 7: Track schema version
  test('Track schema version', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schema = { type: 'object', properties: { id: { type: 'string' } } };
    const version = validator.trackSchemaVersion('test-schema', schema);
    assert.ok(version.current, 'Should have current version');
    assert.strictEqual(version.current, '1.0.0', 'Initial version should be 1.0.0');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 2: ADVANCED VALIDATION OPTIONS');
  console.log('='.repeat(60));

  // Test 8: Custom formats validation
  test('Advanced validation with custom formats', () => {
    const validator = new SchemaValidator(testSchemaPath, {
      allErrors: true,
      verbose: true,
      customFormats: {
        phone: /^\d{3}-\d{3}-\d{4}$/
      }
    });
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', format: 'phone' }
      }
    };
    const validData = { email: 'test@example.com', phone: '123-456-7890' };
    const result = validator.validateSync(schema, validData);
    assert.strictEqual(result.valid, true, 'Should validate with custom formats');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 3: RESPONSE TIME & PERFORMANCE TESTING');
  console.log('='.repeat(60));

  // Test 9: Validate with performance constraints
  test('Validate with performance constraints', async () => {
    const validator = new SchemaValidator(testSchemaPath);
    const startTime = Date.now();
    const result = await validator.validateWithPerformance(
      'test/api', 'TestAssets', testData,
      { maxResponseTime: 1000, maxResponseSize: 10240 }
    );
    const endTime = Date.now();
    assert.strictEqual(result.valid, true, 'Should validate successfully');
    assert.ok(endTime - startTime < 1000, 'Should complete within time limit');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 4: MOCK DATA GENERATION');
  console.log('='.repeat(60));

  // Test 10: Generate mock data
  test('Generate mock data from schema', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        age: { type: 'integer' }
      },
      required: ['id', 'name', 'email']
    };
    const mockData = validator.generateMockData(schema, { count: 3, seed: 123 });
    assert.ok(Array.isArray(mockData), 'Should return array');
    assert.strictEqual(mockData.length, 3, 'Should generate specified count');
    assert.ok(mockData[0].id, 'Should have id field');
    assert.ok(mockData[0].name, 'Should have name field');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 5: OPENAPI/SWAGGER CONTRACT TESTING');
  console.log('='.repeat(60));

  // Test 11: Convert OpenAPI to JSON Schema
  test('Convert OpenAPI spec to JSON Schema', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const openApiSpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' }
            }
          }
        }
      }
    };
    const jsonSchema = validator.openApiToJsonSchema(openApiSpec);
    assert.ok(jsonSchema.User, 'Should convert User schema');
    assert.strictEqual(jsonSchema.User.type, 'object', 'Should preserve type');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 6: DIFFERENTIAL VALIDATION (SNAPSHOTS)');
  console.log('='.repeat(60));

  // Test 12: Snapshot testing
  test('Snapshot testing - create and validate', async () => {
    const validator = new SchemaValidator(testSchemaPath);
    const data = { id: '123', name: 'Test', timestamp: Date.now() };
    
    // Create snapshot
    const snapshotResult = await validator.snapshot('api-test', 'user-response', data, { ignoreFields: ['timestamp'] });
    assert.ok(snapshotResult.created || snapshotResult.matched, 'Should create or match snapshot');
    
    // Validate against snapshot
    const validationResult = await validator.validateSnapshot('api-test', 'user-response', data, { ignoreFields: ['timestamp'] });
    assert.ok(validationResult.matched || validationResult.valid, 'Should validate against snapshot');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 7: ENVIRONMENT-SPECIFIC VALIDATION');
  console.log('='.repeat(60));

  // Test 13: Environment-specific schemas
  test('Register and use environment-specific schemas', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const devSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        debug: { type: 'boolean' }
      },
      required: ['id', 'debug']
    };
    validator.registerEnvironmentSchema('test-env', 'dev', devSchema);
    const retrieved = validator.getEnvironmentSchema('test-env', 'dev');
    assert.ok(retrieved, 'Should retrieve environment schema');
    assert.strictEqual(retrieved.properties.debug.type, 'boolean', 'Should have debug field');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 9: REQUEST VALIDATION');
  console.log('='.repeat(60));

  // Test 14: Request validation
  test('Validate request body, headers, and query params', () => {
    const validator = new SchemaValidator(testSchemaPath);
    
    const bodySchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
      },
      required: ['name']
    };
    
    const headersSchema = {
      type: 'object',
      properties: {
        authorization: { type: 'string' },
        'content-type': { type: 'string' }
      },
      required: ['authorization']
    };
    
    const querySchema = {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' }
      }
    };
    
    const request = {
      body: { name: 'John', email: 'john@example.com' },
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      query: { page: 1, limit: 10 }
    };
    
    const result = validator.validateRequest(request, {
      bodySchema,
      headersSchema,
      querySchema
    });
    
    assert.strictEqual(result.valid, true, 'Should validate request successfully');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 10: AUTOMATED DOCUMENTATION');
  console.log('='.repeat(60));

  // Test 15: Generate documentation
  test('Generate API documentation in markdown', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique identifier' },
        name: { type: 'string', description: 'User name' },
        email: { type: 'string', format: 'email', description: 'Email address' }
      },
      required: ['id', 'name']
    };
    const docs = validator.generateDocumentation('User API', schema, {
      endpoint: '/api/users',
      method: 'POST',
      examples: [{ id: '1', name: 'John', email: 'john@example.com' }]
    });
    assert.ok(docs.includes('# User API'), 'Should include title');
    assert.ok(docs.includes('/api/users'), 'Should include endpoint');
    assert.ok(docs.includes('Properties'), 'Should include properties section');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 11: CI/CD INTEGRATION');
  console.log('='.repeat(60));

  // Test 16: Generate CI/CD reports
  test('Generate JUnit XML report', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const testResults = [
      { name: 'test-validation-1', passed: true, duration: 10 },
      { name: 'test-validation-2', passed: false, duration: 15, error: 'Schema mismatch' }
    ];
    const xml = validator.generateJUnitReport(testResults, './reports/junit.xml');
    assert.ok(xml.includes('<?xml'), 'Should be valid XML');
    assert.ok(xml.includes('<testsuite'), 'Should contain testsuite');
    assert.ok(fs.existsSync('./reports/junit.xml'), 'Should write file');
  });

  // Test 17: Generate HTML report
  test('Generate HTML report', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const testResults = [
      { name: 'test-1', passed: true, duration: 10 },
      { name: 'test-2', passed: false, duration: 15, error: 'Error message' }
    ];
    const html = validator.generateHTMLReport(testResults, './reports/report.html');
    assert.ok(html.includes('<!DOCTYPE html>'), 'Should be valid HTML');
    assert.ok(html.includes('test-1'), 'Should include test names');
    assert.ok(fs.existsSync('./reports/report.html'), 'Should write file');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 12: SCHEMA MIGRATION');
  console.log('='.repeat(60));

  // Test 18: Migrate schema
  test('Migrate schema with transformations', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const oldSchema = {
      type: 'object',
      properties: {
        userName: { type: 'string' },
        userAge: { type: 'integer' }
      }
    };
    const rules = [
      { type: 'rename', from: 'userName', to: 'name' },
      { type: 'rename', from: 'userAge', to: 'age' }
    ];
    const migrated = validator.migrateSchema(oldSchema, rules);
    assert.ok(migrated.properties.name, 'Should rename userName to name');
    assert.ok(migrated.properties.age, 'Should rename userAge to age');
    assert.ok(!migrated.properties.userName, 'Old field should be removed');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 13: FUZZY MATCHING & TOLERANCE');
  console.log('='.repeat(60));

  // Test 19: Validate with tolerance
  test('Validate with fuzzy matching tolerance', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        score: { type: 'number' }
      },
      required: ['name', 'score']
    };
    const data = { name: 'John Doe', score: 95.5, extraField: 'ignored' };
    const result = validator.validateWithTolerance(schema, data, {
      allowExtraFields: true,
      numericTolerance: 0.1,
      stringSimilarityThreshold: 0.8
    });
    assert.strictEqual(result.valid, true, 'Should validate with tolerance');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 14: BATCH VALIDATION');
  console.log('='.repeat(60));

  // Test 20: Batch validation
  test('Batch validate multiple endpoints', async () => {
    const validator = new SchemaValidator(testSchemaPath);
    const validations = [
      { folder: 'test/api', name: 'TestAssets', data: testData[0] },
      { folder: 'test/api', name: 'TestAssets', data: testData[1] }
    ];
    const results = await validator.batchValidate(validations, { concurrency: 2 });
    assert.ok(Array.isArray(results), 'Should return array of results');
    assert.strictEqual(results.length, 2, 'Should have results for all validations');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 15: RUNTIME SCHEMA MODIFICATION');
  console.log('='.repeat(60));

  // Test 21: Modify schema at runtime
  test('Modify schema at runtime', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['id']
    };
    const modified = validator.modifySchema(schema, {
      addRequired: ['name'],
      removeRequired: ['id'],
      addPattern: { field: 'id', pattern: '^[0-9a-f-]+$' }
    });
    assert.ok(modified.required.includes('name'), 'Should add name to required');
    assert.ok(!modified.required.includes('id'), 'Should remove id from required');
    assert.strictEqual(modified.properties.id.pattern, '^[0-9a-f-]+$', 'Should add pattern');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 16: SECURITY VALIDATION');
  console.log('='.repeat(60));

  // Test 22: Security validation - PII detection
  test('Detect PII in data', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      ssn: '123-45-6789',
      creditCard: '4111-1111-1111-1111'
    };
    const result = validator.validateSecurity(data, { checkPII: true });
    assert.ok(result.hasPII, 'Should detect PII');
    assert.ok(result.piiFields.length > 0, 'Should identify PII fields');
  });

  // Test 23: GDPR compliance check
  test('Check GDPR compliance', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const data = {
      userId: '123',
      email: 'user@example.com',
      consent: true
    };
    const result = validator.validateSecurity(data, { 
      checkPII: true, 
      complianceStandard: 'GDPR' 
    });
    assert.ok(result.complianceChecks, 'Should perform compliance checks');
  });

  console.log('\n' + '='.repeat(60));
  console.log('FEATURE 17: PERFORMANCE BENCHMARKING');
  console.log('='.repeat(60));

  // Test 24: Benchmark validation performance
  test('Benchmark validation performance', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        value: { type: 'number' }
      }
    };
    const data = { id: '123', name: 'Test', value: 42 };
    const benchmark = validator.benchmarkValidation(schema, data, { iterations: 100 });
    assert.ok(benchmark.averageTime > 0, 'Should measure average time');
    assert.ok(benchmark.minTime > 0, 'Should measure min time');
    assert.ok(benchmark.maxTime > 0, 'Should measure max time');
    assert.ok(benchmark.opsPerSec > 0, 'Should calculate ops/sec');
  });

  // Test 25: Measure performance
  test('Measure validation performance', async () => {
    const validator = new SchemaValidator(testSchemaPath);
    const measurements = await validator.measurePerformance('test/api', 'TestAssets', testData);
    assert.ok(measurements.validationTime >= 0, 'Should measure validation time');
  });

  // Cleanup
  cleanup();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests} ✓`);
  console.log(`Failed: ${failedTests} ✗`);
  console.log('='.repeat(60));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test suite failed:', error);
  cleanup();
  process.exit(1);
});
