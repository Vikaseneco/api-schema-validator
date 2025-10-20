# Migration Guide

## Migrating from Old validateSchema.js to @eneco/api-schema-validator NPM Package

This guide helps you migrate from the local `tools/validateSchema.js` to the NPM package.

### Before (Old Implementation)

```javascript
// In your .bru file
tests {
  var jsonData = res.getBody();
  const {validateJsonSchemaSync} = require('./tools/validateSchema.js');
  
  test("Valid response JSON schema", async function(){
    const result = await validateJsonSchemaSync("vpp/Asset Manager", "Automatic_RegisteredAssets", jsonData);
    expect(result).to.equal(true);
  });
}
```

**File structure:**
```
VPP-Core/
├── tools/
│   └── validateSchema.js
└── api-schema/
    └── vpp/
        └── Asset Manager/
            └── Automatic_RegisteredAssets_schema.json
```

### After (New NPM Package)

**Step 1: Install the package**
```bash
npm install @eneco/api-schema-validator
```

**Step 2: Update your tests**
```javascript
// In your .bru file
tests {
  var jsonData = res.getBody();
  const SchemaValidator = require('@eneco/api-schema-validator');
  const validator = new SchemaValidator('./api-schemas'); // Note: path changed
  
  test("Valid response JSON schema", function(){ // Note: no async needed
    const result = validator.validateJsonSchemaSync(
      "vpp/Asset Manager", 
      "Automatic_RegisteredAssets", 
      jsonData
    );
    expect(result).to.equal(true);
  });
}
```

**Step 3: Move your schemas**
```bash
# Move from old location to new location
mv VPP-Core/api-schema VPP-Core/api-schemas
```

**New file structure:**
```
VPP-Core/
├── node_modules/
│   └── @eneco/
│       └── api-schema-validator/
├── api-schemas/                     ← Renamed from api-schema
│   └── vpp/
│       └── Asset Manager/
│           └── Automatic_RegisteredAssets_schema.json
└── package.json
```

### Key Changes

| Aspect | Old | New |
|--------|-----|-----|
| Installation | Copy `validateSchema.js` | `npm install @eneco/api-schema-validator` |
| Import | `require('./tools/validateSchema.js')` | `require('@eneco/api-schema-validator')` |
| Usage | `validateJsonSchemaSync(...)` | `validator.validateJsonSchemaSync(...)` |
| Schema folder | `api-schema/` | `api-schemas/` (configurable) |
| Path resolution | Uses `__dirname` | Uses constructor parameter |
| Function type | Standalone function | Class method |

### Migration Checklist

- [ ] Install NPM package: `npm install @eneco/api-schema-validator`
- [ ] Rename schema folder: `api-schema` → `api-schemas`
- [ ] Update all `.bru` files to use new import
- [ ] Create validator instance in each test
- [ ] Remove old `tools/validateSchema.js` file
- [ ] Update `package.json` dependencies
- [ ] Test all endpoints to ensure validation still works
- [ ] Update documentation and team wiki
- [ ] Commit changes to version control

### Batch Migration Script

Create a file `migrate.js`:

```javascript
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all .bru files
const bruFiles = glob.sync('**/*.bru', { ignore: 'node_modules/**' });

bruFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace old import with new import
  content = content.replace(
    /const {validateJsonSchemaSync} = require\('\.\/tools\/validateSchema\.js'\);/g,
    `const SchemaValidator = require('@eneco/api-schema-validator');
  const validator = new SchemaValidator('./api-schemas');`
  );
  
  // Replace function calls
  content = content.replace(
    /validateJsonSchemaSync\(/g,
    'validator.validateJsonSchemaSync('
  );
  
  fs.writeFileSync(file, content);
  console.log(`✓ Updated: ${file}`);
});

console.log(`\n✓ Migration complete! Updated ${bruFiles.length} files.`);
```

Run it:
```bash
npm install glob
node migrate.js
```

### Testing After Migration

1. **Run all tests**:
   ```bash
   npm test
   ```

2. **Verify schema paths**:
   ```javascript
   const validator = new SchemaValidator('./api-schemas');
   console.log(validator.getSchemaPath('vpp/Asset Manager', 'RegisteredAssets'));
   ```

3. **Check schema files exist**:
   ```javascript
   const exists = validator.schemaExists('vpp/Asset Manager', 'RegisteredAssets');
   console.log('Schema exists:', exists);
   ```

### Rollback Plan

If you need to rollback:

1. Keep old `tools/validateSchema.js` in a backup location
2. Rename `api-schemas` back to `api-schema`
3. Revert `.bru` file changes from Git: `git checkout -- **/*.bru`
4. Uninstall package: `npm uninstall @eneco/api-schema-validator`

### Benefits of Migration

✅ **Versioned package** - Easier to update and maintain  
✅ **Centralized updates** - Fix bugs once, update everywhere  
✅ **Better documentation** - Comprehensive README and examples  
✅ **Reusable** - Use in multiple projects  
✅ **Tested** - Includes test suite  
✅ **Professional** - Published NPM package  

### Support

Need help with migration? Contact: vpp-testing-team@eneco.com
