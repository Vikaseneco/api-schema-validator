/**
 * Example: Using bruno-api-schema-validator in Bruno API tests
 * 
 * Recommended folder structure:
 * 
 * bruno-collections/                    ← Your Bruno collection (tracked in Git)
 * └── my-collection/
 *     ├── api-schemas/                  ← Schemas here (tracked with collection)
 *     │   └── jsonplaceholder/
 *     │       └── Users_schema.json
 *     └── GetUsers.bru                 ← Use bru.cwd() to find schemas
 */

// ========================================
// EXAMPLE 1: Basic Bruno Test Integration (RECOMMENDED)
// ========================================

/*
File: GetUsers.bru

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

docs {
  This request retrieves a list of users from the JSONPlaceholder API.
}

tests {
  const jsonData = res.getBody();
  
  // SUPER SIMPLE: Auto-detects Bruno environment!
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator();
  
  test("Valid response JSON schema - Users", function(){
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder', 
      'Users', 
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
  
  test("First user has required fields", function () {
    expect(jsonData[0]).to.have.property('id');
    expect(jsonData[0]).to.have.property('name');
    expect(jsonData[0]).to.have.property('email');
  });
}
*/

// ========================================
// EXAMPLE 2: First-time Schema Creation
// ========================================

/*
File: CreateUsersSchema.bru

meta {
  name: Get Users - Create Schema
  type: http
  seq: 2
}

get {
  url: https://jsonplaceholder.typicode.com/users
  body: none
  auth: none
}

docs {
  This request creates a JSON schema from the users API response.
  Schema will be saved in your Bruno collection's api-schemas folder.
}

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  
  // One line - automatic!
  const validator = new SchemaValidator();
  
  test("Create schema from response", async function(){
    // First time: create schema from the API response
    // This will save to: <collection>/api-schemas/jsonplaceholder/Users_schema.json
    const createdPath = await validator.createJsonSchema(
      'jsonplaceholder',
      'Users',
      jsonData
    );
    console.log('✓ Schema created at:', createdPath);
    console.log('✓ Remember to commit this schema to Git!');
  });
  
  // After creating schema, use the regular validation test from Example 1
}
*/

// ========================================
// EXAMPLE 3: Advanced Bruno Test with Options
// ========================================

/*
File: GetUsers_Advanced.bru

meta {
  name: Get Users - Advanced Validation
  type: http
  seq: 3
}

get {
  url: https://jsonplaceholder.typicode.com/users
  body: none
  auth: none
}

tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  
  // Simple initialization
  const validator = new SchemaValidator();
  
  test("Schema validation with custom options", function(){
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder', 
      'Users', 
      jsonData,
      {
        verbose: true,        // Show detailed errors
        throwOnError: false   // Return false instead of throwing
      }
    );
    expect(result).to.equal(true);
  });
  
  test("Check if schema exists before validation", function(){
    const exists = validator.schemaExists('jsonplaceholder', 'Users');
    expect(exists).to.equal(true);
  });
  
  test("Get schema file path", function(){
    const fullSchemaPath = validator.getSchemaPath('jsonplaceholder', 'Users');
    console.log('Schema location:', fullSchemaPath);
    expect(fullSchemaPath).to.include('Users_schema.json');
  });
}
*/

// ========================================
// EXAMPLE 4: Multiple Endpoints
// ========================================

/*
File: GetPosts.bru - Testing multiple JSONPlaceholder endpoints

meta {
  name: Get Posts
  type: http
  seq: 4
}

get {
  url: https://jsonplaceholder.typicode.com/posts
  body: none
  auth: none
}

tests {
  const SchemaValidator = require('bruno-api-schema-validator');
  
  // Auto-detected
  const validator = new SchemaValidator();
  
  // Test Posts endpoint
  test("Validate Posts schema", function(){
    const postsData = res.getBody();
    const result = validator.validateJsonSchemaSync(
      'jsonplaceholder',
      'Posts',
      postsData
    );
    expect(result).to.equal(true);
  });
  
  test("Posts array is not empty", function(){
    const postsData = res.getBody();
    expect(postsData).to.be.an('array');
    expect(postsData.length).to.be.greaterThan(0);
  });
}
*/

// ========================================
// EXAMPLE 5: Using in Node.js Test Scripts
// ========================================

const SchemaValidator = require('bruno-api-schema-validator');
const assert = require('assert');

async function testAPIWithSchemaValidation() {
  const validator = new SchemaValidator('./api-schemas');
  
  // Fetch users from JSONPlaceholder API
  const apiResponse = await fetch('https://jsonplaceholder.typicode.com/users')
    .then(r => r.json());
  
  // Validate response against schema
  const isValid = validator.validateJsonSchemaSync('jsonplaceholder', 'Users', apiResponse);
  
  assert.strictEqual(isValid, true, 'API response should match schema');
  console.log('✓ Users API response validated successfully');
  console.log(`✓ Validated ${apiResponse.length} users`);
}

// Uncomment to run the test
// testAPIWithSchemaValidation().catch(console.error);

console.log('Bruno integration examples loaded. Copy the examples above into your .bru files.');

