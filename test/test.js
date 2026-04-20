/**
 * Comprehensive test file for @eneco/api-schema-validator
 * Tests all KEPT features: core validation, schema evolution, OpenAPI,
 * request validation, security, and new standalone assertion helpers.
 */

const SchemaValidator = require('../lib/index');
const {
  validate, assertSchema, assertStatus, assertFields, assertType,
  schemaFrom, checkPII,
  assertArrayOf, assertEnum, assertMatch, assertRange, assertNonEmpty,
  assertResponseTime, assertDateBetween
} = require('../lib/index');
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
    assetConfiguration: { capacity: 100, type: "solar" }
  },
  {
    name: "Test Asset 2",
    id: "223e4567-e89b-12d3-a456-426614174001",
    email: "user@domain.org",
    fullName: "Another Test Asset",
    assetConfiguration: { capacity: 150, type: "wind" }
  }
];

const invalidTestData = [
  {
    name: "Invalid Asset",
    id: 12345,
    email: "invalid-email",
    fullName: "Invalid Asset",
    assetConfiguration: null
  }
];

const testSchemaPath = path.join(__dirname, 'test-schemas');
let passedTests = 0;
let failedTests = 0;
const pendingTests = [];

function test(name, fn) {
  const testPromise = Promise.resolve()
    .then(() => fn())
    .then(() => { console.log(`✓ PASS: ${name}`); passedTests++; })
    .catch((error) => { console.error(`✗ FAIL: ${name}\n  Error: ${error.message}`); failedTests++; });
  pendingTests.push(testPromise);
  return testPromise;
}

async function cleanup() {
  await Promise.allSettled(pendingTests);
}

async function runTests() {
  // ==================== CORE FUNCTIONALITY ====================
  console.log('='.repeat(60));
  console.log('CORE FUNCTIONALITY TESTS');
  console.log('='.repeat(60));

  await test('Create JSON schema', async () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schemaPath = await validator.createJsonSchema('test/api', 'TestAssets', testData);
    assert.ok(fs.existsSync(schemaPath), 'Schema file should exist');
  });

  await test('Check if schema exists', () => {
    const validator = new SchemaValidator(testSchemaPath);
    assert.strictEqual(validator.schemaExists('test/api', 'TestAssets'), true);
  });

  await test('Synchronous validation with valid data', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const isValid = validator.validateJsonSchemaSync('test/api', 'TestAssets', testData, { verbose: false });
    assert.strictEqual(isValid, true);
  });

  await test('Synchronous validation with invalid data', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const isValid = validator.validateJsonSchemaSync('test/api', 'TestAssets', invalidTestData, { verbose: false });
    assert.strictEqual(isValid, false);
  });

  await test('Asynchronous validation with valid data', async () => {
    const validator = new SchemaValidator(testSchemaPath);
    const isValid = await validator.validateJsonSchema('test/api', 'TestAssets', testData, { verbose: false });
    assert.strictEqual(isValid, true);
  });

  await test('Inline schema validation (sync)', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const schema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
    const result = validator.validateJsonSchemaSync(schema, { name: 'test' });
    assert.strictEqual(result.valid, true);
  });

  await test('Custom formats validation', () => {
    const validator = new SchemaValidator(testSchemaPath, {
      customFormats: { phone: /^\d{3}-\d{3}-\d{4}$/ }
    });
    const schema = { type: 'object', properties: { phone: { type: 'string', format: 'phone' } } };
    const result = validator.validateJsonSchemaSync(schema, { phone: '123-456-7890' });
    assert.strictEqual(result.valid, true);
  });

  // ==================== SCHEMA EVOLUTION ====================
  console.log('\n' + '='.repeat(60));
  console.log('SCHEMA EVOLUTION');
  console.log('='.repeat(60));

  await test('Compare schemas - detect breaking changes', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const oldSchema = {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } },
      required: ['id', 'name', 'email']
    };
    const newSchema = {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' } },
      required: ['id', 'name']
    };
    const changes = validator.compareSchemas(oldSchema, newSchema);
    assert.ok(changes.breaking.length > 0, 'Should detect breaking changes');
    assert.ok(changes.breaking.some(c => c.type === 'required_field_removed'));
    assert.strictEqual(changes.recommendedVersionBump, 'major');
  });

  await test('Compare schemas - detect type changes', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const oldSchema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
    const newSchema = { type: 'object', properties: { name: { type: 'number' } }, required: ['name'] };
    const changes = validator.compareSchemas(oldSchema, newSchema);
    assert.ok(changes.breaking.some(c => c.type === 'type_changed'));
  });

  await test('Compare schemas - non-breaking optional field added', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const oldSchema = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] };
    const newSchema = { type: 'object', properties: { id: { type: 'string' }, age: { type: 'number' } }, required: ['id'] };
    const changes = validator.compareSchemas(oldSchema, newSchema);
    assert.strictEqual(changes.breaking.length, 0);
    assert.ok(changes.nonBreaking.some(c => c.type === 'optional_field_added'));
    assert.strictEqual(changes.recommendedVersionBump, 'minor');
  });

  // ==================== OPENAPI/SWAGGER ====================
  console.log('\n' + '='.repeat(60));
  console.log('OPENAPI/SWAGGER');
  console.log('='.repeat(60));

  await test('Convert OpenAPI spec to JSON Schema', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const openApiSpec = {
      openapi: '3.0.0',
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } }
        }
      }
    };
    const jsonSchema = validator.openApiToJsonSchema(openApiSpec);
    assert.ok(jsonSchema.User);
    assert.strictEqual(jsonSchema.User.type, 'object');
  });

  await test('Convert OpenAPI with nullable fields', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const spec = {
      components: {
        schemas: {
          Item: { type: 'object', properties: { note: { type: 'string', nullable: true } } }
        }
      }
    };
    const schemas = validator.openApiToJsonSchema(spec);
    assert.deepStrictEqual(schemas.Item.properties.note.type, ['string', 'null']);
  });

  // ==================== REQUEST VALIDATION ====================
  console.log('\n' + '='.repeat(60));
  console.log('REQUEST VALIDATION');
  console.log('='.repeat(60));

  await test('Validate request body, headers, and query params', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const request = {
      body: { name: 'John', email: 'john@example.com' },
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      query: { page: 1, limit: 10 }
    };
    const result = validator.validateRequest(request, {
      body: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      headers: { type: 'object', properties: { authorization: { type: 'string' } }, required: ['authorization'] },
      query: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' } } }
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.body.valid, true);
    assert.strictEqual(result.headers.valid, true);
    assert.strictEqual(result.query.valid, true);
  });

  // ==================== SECURITY VALIDATION ====================
  console.log('\n' + '='.repeat(60));
  console.log('SECURITY VALIDATION');
  console.log('='.repeat(60));

  await test('Detect PII in data (instance method)', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const data = { name: 'John', ssn: '123-45-6789', creditCard: '4111-1111-1111-1111' };
    const result = validator.validateSecurity(data);
    assert.ok(result.hasPII);
    assert.ok(result.piiFields.length > 0);
  });

  await test('Detect PII (standalone checkPII)', () => {
    const result = checkPII({ ssn: '123-45-6789' });
    assert.ok(result.hasPII);
    assert.ok(result.findings.some(f => f.type === 'ssn'));
  });

  await test('GDPR compliance check', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const result = validator.validateSecurity({ email: 'user@example.com' }, { complianceStandard: 'GDPR' });
    assert.ok(result.complianceChecks);
  });

  await test('Detect sensitive field names', () => {
    const validator = new SchemaValidator(testSchemaPath);
    const result = validator.validateSecurity({ password: 'secret123', api_key: 'abc' });
    assert.ok(result.issues.some(i => i.includes('password')));
    assert.ok(result.issues.some(i => i.includes('api_key')));
  });

  // ==================== STANDALONE HELPERS ====================
  console.log('\n' + '='.repeat(60));
  console.log('STANDALONE HELPERS');
  console.log('='.repeat(60));

  await test('validate() inline schema', () => {
    const result = validate({ type: 'object', properties: { x: { type: 'number' } } }, { x: 42 });
    assert.strictEqual(result.valid, true);
  });

  await test('assertSchema() throws on invalid', () => {
    assert.throws(() => assertSchema({ type: 'object', properties: { x: { type: 'number' } } }, { x: 'not a number' }));
  });

  await test('assertStatus() checks status code', () => {
    assertStatus({ status: 200 }, 200);
    assert.throws(() => assertStatus({ status: 404 }, 200));
  });

  await test('assertFields() checks field presence', () => {
    assertFields({ user: { name: 'John', age: 30 } }, ['user.name', 'user.age']);
    assert.throws(() => assertFields({ user: { name: 'John' } }, ['user.email']));
  });

  await test('assertType() checks value type', () => {
    assertType('hello', 'string');
    assertType(42, 'number');
    assertType(null, 'null');
    assertType([1, 2], 'array');
    assert.throws(() => assertType('hello', 'number'));
  });

  await test('schemaFrom() generates schema from sample', () => {
    const schema = schemaFrom({ id: 1, name: 'test' });
    assert.strictEqual(schema.type, 'object');
    assert.ok(schema.properties.id);
    assert.ok(schema.properties.name);
  });

  // ==================== NEW ASSERTION HELPERS ====================
  console.log('\n' + '='.repeat(60));
  console.log('NEW ASSERTION HELPERS');
  console.log('='.repeat(60));

  await test('assertArrayOf() validates each item in array', () => {
    const itemSchema = { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] };
    assertArrayOf([{ id: 1 }, { id: 2 }, { id: 3 }], itemSchema);
    assert.throws(() => assertArrayOf([{ id: 1 }, { id: 'bad' }], itemSchema));
    assert.throws(() => assertArrayOf('not an array', itemSchema));
  });

  await test('assertEnum() checks allowed values', () => {
    assertEnum('active', ['active', 'inactive', 'pending']);
    assert.throws(() => assertEnum('deleted', ['active', 'inactive', 'pending']));
  });

  await test('assertMatch() checks regex pattern', () => {
    assertMatch('550e8400-e29b-41d4-a716-446655440000', /^[0-9a-f-]{36}$/);
    assert.throws(() => assertMatch('not-a-uuid', /^[0-9a-f]{8}-/));
    assert.throws(() => assertMatch(123, /\d+/));
  });

  await test('assertRange() checks numeric range', () => {
    assertRange(5, 1, 10);
    assertRange(1, 1, 10);
    assertRange(10, 1, 10);
    assert.throws(() => assertRange(11, 1, 10));
    assert.throws(() => assertRange(0, 1, 10));
    assert.throws(() => assertRange('five', 1, 10));
  });

  await test('assertNonEmpty() checks for non-empty values', () => {
    assertNonEmpty('hello');
    assertNonEmpty([1, 2]);
    assertNonEmpty({ a: 1 });
    assertNonEmpty(42);
    assert.throws(() => assertNonEmpty(null));
    assert.throws(() => assertNonEmpty(undefined));
    assert.throws(() => assertNonEmpty(''));
    assert.throws(() => assertNonEmpty([]));
    assert.throws(() => assertNonEmpty({}));
  });

  await test('assertResponseTime() checks response time', () => {
    assertResponseTime({ getResponseTime: () => 100 }, 500);
    assertResponseTime({ responseTime: 100 }, 500);
    assert.throws(() => assertResponseTime({ getResponseTime: () => 600 }, 500));
    assert.throws(() => assertResponseTime({}, 500));
  });

  await test('assertDateBetween() checks date range', () => {
    assertDateBetween('2024-06-15', '2024-01-01', '2024-12-31');
    assert.throws(() => assertDateBetween('2023-06-15', '2024-01-01', '2024-12-31'));
    assert.throws(() => assertDateBetween('not-a-date', '2024-01-01', '2024-12-31'));
  });

  // Wait for all tests
  await Promise.allSettled(pendingTests);
  await cleanup();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests} ✓`);
  console.log(`Failed: ${failedTests} ✗`);
  console.log('='.repeat(60));

  if (failedTests > 0) process.exit(1);
}

runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
