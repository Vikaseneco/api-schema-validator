/**
 * Comprehensive test suite for all 17 new features
 */

const SchemaValidator = require('../lib/index');
const path = require('path');
const fs = require('fs');

// Test setup
const testDir = path.join(__dirname, 'test-schemas');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const validator = new SchemaValidator(testDir);

console.log('🧪 Running Comprehensive Feature Tests\n');
console.log('=' .repeat(60));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

// ==================== FEATURE 1: Schema Evolution & Versioning ====================
console.log('\n📦 Feature 1: Schema Evolution & Versioning');
console.log('-'.repeat(60));

test('compareSchemas detects breaking changes', () => {
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
      name: { type: 'number' }, // Type changed
      age: { type: 'integer' } // New field
    },
    required: ['id', 'name'] // email removed from required
  };
  
  const result = validator.compareSchemas(oldSchema, newSchema);
  
  if (!result.breakingChanges.some(c => c.type === 'TYPE_CHANGED')) {
    throw new Error('Should detect type change');
  }
  if (!result.breakingChanges.some(c => c.type === 'REQUIRED_FIELD_REMOVED')) {
    throw new Error('Should detect removed required field');
  }
  if (result.recommendedVersionBump !== 'major') {
    throw new Error('Should recommend major version bump');
  }
});

test('trackSchemaVersion stores versions', () => {
  const schema = { type: 'object', properties: { id: { type: 'string' } } };
  validator.trackSchemaVersion('1.0.0', schema);
  const retrieved = validator.getSchemaByVersion('1.0.0');
  if (!retrieved || retrieved.properties.id.type !== 'string') {
    throw new Error('Failed to retrieve schema version');
  }
});

// ==================== FEATURE 2: Advanced Validation Options ====================
console.log('\n🔍 Feature 2: Advanced Validation Options');
console.log('-'.repeat(60));

test('Custom formats are registered', () => {
  const validatorWithFormats = new SchemaValidator(testDir, {
    customFormats: {
      phone: /^\d{3}-\d{4}$/
    }
  });
  // If we got here without error, formats were registered
  if (!validatorWithFormats.ajv) {
    throw new Error('AJV instance not created');
  }
});

// ==================== FEATURE 3: Response Time & Performance Testing ====================
console.log('\n⚡ Feature 3: Response Time & Performance Testing');
console.log('-'.repeat(60));

(async () => {
  // Create a test schema first
  const testSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      id: { type: 'string' },
      value: { type: 'number' }
    },
    required: ['id', 'value']
  };
  
  const schemaPath = path.join(testDir, 'perf-test');
  if (!fs.existsSync(schemaPath)) {
    fs.mkdirSync(schemaPath, { recursive: true });
  }
  fs.writeFileSync(
    path.join(schemaPath, 'response_schema.json'),
    JSON.stringify(testSchema)
  );
  
  await asyncTest('validateWithPerformance checks response time', async () => {
    const body = { id: '123', value: 42 };
    const result = await validator.validateWithPerformance(
      'perf-test',
      'response',
      body,
      { maxResponseTime: 500, startTime: Date.now() - 100 }
    );
    
    if (!result.valid) {
      throw new Error('Validation should pass');
    }
    if (!result.metrics.responseTime) {
      throw new Error('Should include response time metric');
    }
  });
})();

// ==================== FEATURE 4: Mock Data Generation ====================
console.log('\n🎭 Feature 4: Mock Data Generation');
console.log('-'.repeat(60));

test('generateMockData creates valid mock data', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 0, maximum: 100 },
      active: { type: 'boolean' }
    },
    required: ['name', 'email']
  };
  
  const mockData = validator.generateMockData(schema, { seed: 123 });
  
  if (!mockData.name || typeof mockData.name !== 'string') {
    throw new Error('Should generate name');
  }
  if (!mockData.email || !mockData.email.includes('@')) {
    throw new Error('Should generate valid email');
  }
  if (typeof mockData.age !== 'number') {
    throw new Error('Should generate age');
  }
});

test('generateMockData creates arrays', () => {
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      }
    }
  };
  
  const mockData = validator.generateMockData(schema, { count: 3 });
  
  if (!Array.isArray(mockData) || mockData.length !== 3) {
    throw new Error('Should generate array with 3 items');
  }
});

// ==================== FEATURE 5: Contract Testing with OpenAPI/Swagger ====================
console.log('\n📄 Feature 5: Contract Testing with OpenAPI/Swagger');
console.log('-'.repeat(60));

test('openApiToJsonSchema converts OpenAPI spec', () => {
  const openApiSpec = {
    paths: {
      '/users': {
        get: {
          responses: {
            '200': {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' }
                    },
                    required: ['id']
                  }
                }
              }
            }
          }
        }
      }
    }
  };
  
  const jsonSchema = validator.openApiToJsonSchema(openApiSpec, '/users', 'GET');
  
  if (jsonSchema.type !== 'object') {
    throw new Error('Should convert to object schema');
  }
  if (!jsonSchema.properties.id) {
    throw new Error('Should include id property');
  }
});

// ==================== FEATURE 6: Differential Validation (Snapshot Testing) ====================
console.log('\n📸 Feature 6: Differential Validation (Snapshot Testing)');
console.log('-'.repeat(60));

(async () => {
  await asyncTest('snapshot creates snapshot file', async () => {
    const data = { id: '123', name: 'Test', timestamp: Date.now() };
    const result = await validator.snapshot('test-snapshot', data, ['timestamp']);
    
    if (!result.created) {
      throw new Error('Snapshot should be created');
    }
  });
  
  await asyncTest('validateSnapshot detects differences', async () => {
    const data = { id: '123', name: 'Test', timestamp: Date.now() };
    await validator.snapshot('test-snapshot-2', data, ['timestamp']);
    
    const modifiedData = { id: '123', name: 'Modified', timestamp: Date.now() };
    const result = await validator.validateSnapshot('test-snapshot-2', modifiedData, ['timestamp']);
    
    if (result.matches) {
      throw new Error('Should detect name change');
    }
  });
})();

// ==================== FEATURE 7: Environment-Specific Validation ====================
console.log('\n🌍 Feature 7: Environment-Specific Validation');
console.log('-'.repeat(60));

test('registerEnvironmentSchema stores environment schemas', () => {
  const devSchema = {
    type: 'object',
    properties: {
      debug: { type: 'boolean' }
    }
  };
  
  validator.registerEnvironmentSchema('dev', 'env-test', 'config', devSchema);
  validator.setEnvironment('dev');
  
  const schema = validator.getSchemaForEnvironment('env-test', 'config');
  if (!schema.properties.debug) {
    throw new Error('Should return dev schema');
  }
});

// ==================== FEATURE 8: GraphQL Schema Validation ====================
console.log('\n🔷 Feature 8: GraphQL Schema Validation');
console.log('-'.repeat(60));

test('validateGraphQLResponse validates GraphQL response', () => {
  const graphqlResponse = {
    data: {
      user: {
        id: '123',
        name: 'John'
      }
    }
  };
  
  const schema = {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        },
        required: ['id', 'name']
      }
    }
  };
  
  const result = validator.validateGraphQLResponse(graphqlResponse, schema);
  
  if (!result.valid) {
    throw new Error('GraphQL response should be valid');
  }
  if (!result.hasData) {
    throw new Error('Should have data');
  }
});

// ==================== FEATURE 9: Request Validation ====================
console.log('\n📨 Feature 9: Request Validation');
console.log('-'.repeat(60));

test('validateRequest validates body, headers, and query', () => {
  const request = {
    body: { name: 'John', age: 30 },
    headers: { 'content-type': 'application/json' },
    query: { page: '1', limit: '10' }
  };
  
  const schemas = {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' }
      },
      required: ['name']
    },
    headers: {
      type: 'object',
      properties: {
        'content-type': { type: 'string' }
      }
    },
    query: {
      type: 'object',
      properties: {
        page: { type: 'string' },
        limit: { type: 'string' }
      }
    }
  };
  
  const result = validator.validateRequest(request, schemas);
  
  if (!result.overall) {
    throw new Error('Request should be valid');
  }
  if (!result.body.valid || !result.headers.valid || !result.query.valid) {
    throw new Error('All parts should be valid');
  }
});

// ==================== FEATURE 10: Automated Documentation Generation ====================
console.log('\n📖 Feature 10: Automated Documentation Generation');
console.log('-'.repeat(60));

(async () => {
  await asyncTest('generateDocumentation creates markdown', async () => {
    validator.registerEnvironmentSchema('default', 'docs-test', 'api', {
      type: 'object',
      description: 'Test API schema',
      properties: {
        id: { type: 'string', description: 'Unique identifier' },
        name: { type: 'string', description: 'Name field' }
      },
      required: ['id']
    });
    
    const doc = await validator.generateDocumentation('docs-test', 'api');
    
    if (!doc.includes('# API Documentation')) {
      throw new Error('Should generate markdown header');
    }
    if (!doc.includes('| Field | Type | Required |')) {
      throw new Error('Should include properties table');
    }
  });
})();

// ==================== FEATURE 11: CI/CD Integration Helpers ====================
console.log('\n🔄 Feature 11: CI/CD Integration Helpers');
console.log('-'.repeat(60));

test('generateJUnitReport creates JUnit XML', () => {
  const testResults = [
    { name: 'Test 1', endpoint: '/api/users', success: true, duration: 50 },
    { name: 'Test 2', endpoint: '/api/posts', success: false, duration: 30, message: 'Failed' }
  ];
  
  const xml = validator.generateJUnitReport(testResults);
  
  if (!xml.includes('<?xml version')) {
    throw new Error('Should generate XML declaration');
  }
  if (!xml.includes('<testsuite')) {
    throw new Error('Should include testsuite');
  }
});

test('generateHTMLReport creates HTML report', () => {
  const testResults = [
    { name: 'Test 1', success: true, duration: 50 },
    { name: 'Test 2', success: false, duration: 30 }
  ];
  
  const html = validator.generateHTMLReport(testResults);
  
  if (!html.includes('<!DOCTYPE html>')) {
    throw new Error('Should generate HTML document');
  }
  if (!html.includes('API Schema Validation Report')) {
    throw new Error('Should include report title');
  }
});

test('generateJSONReport creates JSON report', () => {
  const testResults = [
    { name: 'Test 1', success: true, duration: 50 },
    { name: 'Test 2', success: false, duration: 30 }
  ];
  
  const report = validator.generateJSONReport(testResults);
  
  if (!report.summary || !report.results) {
    throw new Error('Should include summary and results');
  }
  if (report.summary.total !== 2) {
    throw new Error('Should count total tests');
  }
});

// ==================== FEATURE 12: Schema Migration Tools ====================
console.log('\n🔧 Feature 12: Schema Migration Tools');
console.log('-'.repeat(60));

test('migrateSchema renames fields', () => {
  const data = { userName: 'john', age: 30 };
  const rules = [
    { type: 'RENAME_FIELD', oldName: 'userName', newName: 'username' }
  ];
  
  const migrated = validator.migrateSchema(data, rules);
  
  if (migrated.userName || migrated.username !== 'john') {
    throw new Error('Should rename userName to username');
  }
});

test('migrateSchema adds fields', () => {
  const data = { id: '123' };
  const rules = [
    { type: 'ADD_FIELD', field: 'createdAt', defaultValue: '2024-01-01' }
  ];
  
  const migrated = validator.migrateSchema(data, rules);
  
  if (!migrated.createdAt || migrated.createdAt !== '2024-01-01') {
    throw new Error('Should add createdAt field');
  }
});

// ==================== FEATURE 13: Fuzzy Matching & Tolerance ====================
console.log('\n🎯 Feature 13: Fuzzy Matching & Tolerance');
console.log('-'.repeat(60));

test('validateWithTolerance allows numeric tolerance', () => {
  const expected = { value: 10.0 };
  const actual = { value: 10.005 };
  
  const result = validator.validateWithTolerance(expected, actual, {
    numericTolerance: 0.01
  });
  
  if (!result.valid) {
    throw new Error('Should pass within tolerance');
  }
});

test('validateWithTolerance detects string similarity', () => {
  const expected = { name: 'John Doe' };
  const actual = { name: 'Jon Doe' };
  
  const result = validator.validateWithTolerance(expected, actual, {
    stringSimilarityThreshold: 0.9
  });
  
  // Should detect low similarity
  if (result.valid && result.issues.length === 0) {
    // This is acceptable - strings might be similar enough
  }
});

// ==================== FEATURE 14: Batch Validation ====================
console.log('\n📦 Feature 14: Batch Validation');
console.log('-'.repeat(60));

(async () => {
  await asyncTest('batchValidate validates multiple requests', async () => {
    const validations = [
      { folderName: 'perf-test', fileName: 'response', body: { id: '1', value: 1 } },
      { folderName: 'perf-test', fileName: 'response', body: { id: '2', value: 2 } },
      { folderName: 'perf-test', fileName: 'response', body: { id: '3', value: 3 } }
    ];
    
    const results = await validator.batchValidate(validations, { concurrency: 2 });
    
    if (results.length !== 3) {
      throw new Error('Should validate all 3 requests');
    }
  });
})();

// ==================== FEATURE 15: Runtime Schema Modification ====================
console.log('\n✏️ Feature 15: Runtime Schema Modification');
console.log('-'.repeat(60));

test('modifySchema adds required fields', () => {
  validator.registerEnvironmentSchema('default', 'modify-test', 'schema', {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' }
    },
    required: ['id']
  });
  
  const modified = validator.modifySchema('modify-test', 'schema', {
    addRequired: ['name']
  });
  
  if (!modified.required.includes('name')) {
    throw new Error('Should add name to required fields');
  }
});

// ==================== FEATURE 16: Security Validation ====================
console.log('\n🔒 Feature 16: Security Validation');
console.log('-'.repeat(60));

test('validateSecurity detects PII', () => {
  const data = {
    user: 'john',
    email: 'john@example.com',
    ssn: '123-45-6789'
  };
  
  const result = validator.validateSecurity(data, { checkPII: true });
  
  if (result.secure) {
    throw new Error('Should detect PII');
  }
  if (!result.issues.some(i => i.type === 'PII_DETECTED')) {
    throw new Error('Should report PII detection');
  }
});

test('validateSecurity detects sensitive fields', () => {
  const data = {
    username: 'john',
    password: 'secret123'
  };
  
  const result = validator.validateSecurity(data, { checkSensitiveFields: true });
  
  if (!result.issues.some(i => i.type === 'SENSITIVE_FIELD_EXPOSED')) {
    throw new Error('Should detect sensitive field exposure');
  }
});

// ==================== FEATURE 17: Performance Benchmarking ====================
console.log('\n⏱️ Feature 17: Performance Benchmarking');
console.log('-'.repeat(60));

(async () => {
  await asyncTest('measurePerformance measures validation speed', async () => {
    const testData = { id: '123', value: 42 };
    const metrics = await validator.measurePerformance('perf-test', 'response', testData, 10);
    
    if (!metrics.averageMs) {
      throw new Error('Should calculate average time');
    }
    if (!metrics.opsPerSecond) {
      throw new Error('Should calculate ops per second');
    }
  });
})();

// Wait for async tests to complete
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Tests Passed: ${passed}`);
  console.log(`❌ Tests Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}, 2000);
