# bruno-api-schema-validator

A flexible JSON schema validation library for API testing.

## Quick Reference

### Installation

```bash
npm install bruno-api-schema-validator
```

### Basic Usage

```javascript
const SchemaValidator = require('bruno-api-schema-validator');
const validator = new SchemaValidator('./api-schemas');

// Create schema (one-time)
await validator.createJsonSchema('api/v1', 'Users', apiResponse);

// Validate (in tests)
const isValid = validator.validateJsonSchemaSync('api/v1', 'Users', apiResponse);
```

### Bruno Integration

```javascript
tests {
  const jsonData = res.getBody();
  const SchemaValidator = require('bruno-api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');
  
  test("Schema validation", function(){
    const result = validator.validateJsonSchemaSync('api/v1', 'Endpoint', jsonData);
    expect(result).to.equal(true);
  });
}
```

## Documentation

- **[README.md](./README.md)** - Complete documentation with API reference
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Step-by-step setup instructions
- **[MIGRATION.md](./MIGRATION.md)** - Migrate from old validateSchema.js
- **[examples/](./examples/)** - Working code examples

## API Methods

| Method | Type | Use Case |
|--------|------|----------|
| `createJsonSchema()` | Async | Generate schema from response |
| `validateJsonSchema()` | Async | Validate with options |
| `validateJsonSchemaSync()` | Sync | **Use in Bruno tests** |
| `schemaExists()` | Sync | Check if schema file exists |
| `getSchemaPath()` | Sync | Get full path to schema |

## Examples

Run examples:

```bash
npm run example                           # Basic usage
node examples/integration-example.js      # Integration guide
node examples/bruno-integration.js        # Bruno examples
```

## Testing

```bash
npm test
```

## License

MIT © Eneco VPP Testing Team

