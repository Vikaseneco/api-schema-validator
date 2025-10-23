# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-10-23

### Added

- **`createSchema` option for `validateJsonSchemaSync`**: Now supports automatic schema creation in synchronous validation
- Automatic directory creation when `createSchema: true` is used - no more "ENOENT" errors!
- Synchronous schema generation logic matching the async version

### Fixed

- Fixed issue where `validateJsonSchemaSync` with `createSchema: true` would fail with "no such file or directory" error
- Schema folders and files are now automatically created when missing during sync validation

### Changed

- Enhanced `validateJsonSchemaSync` to match feature parity with async `validateJsonSchema`
- Updated README.md with `createSchema` examples for synchronous validation
- **Clarified method usage**: Added clear documentation on when to use sync vs async methods
  - `validateJsonSchemaSync()` - **For Bruno API tests** (Bruno doesn't support async/await)
  - `validateJsonSchema()` - **For Node.js test frameworks** (Jest, Mocha, Vitest, CI/CD scripts)

### Documentation

- Added comprehensive guidance on async vs sync method selection
- Included Node.js test framework examples (Jest, Mocha) for async method
- Added CI/CD pipeline integration examples
- Clarified that Bruno users should use synchronous methods only
- Added use case matrix showing which method to use in different environments

### Developer Experience

- **One-line schema creation**: Just add `{ createSchema: true }` to your first test run
- Perfect for new Bruno tests - no need to manually create schema files first
- Schemas are automatically stored in your collection folder structure
- **Dual-purpose package**: Serves both Bruno users and Node.js test automation engineers

## [1.0.0] - 2025-10-21

### Added

- Initial public release as `bruno-api-schema-validator` (unscoped package on npm)
- Smart constructor with **automatic Bruno environment detection**
- Zero-configuration setup for Bruno API Client - just `new SchemaValidator()`
- `SchemaValidator` class for JSON schema validation
- Automatic schema generation from API responses using `generate-schema`
- Synchronous validation (`validateJsonSchemaSync`) optimized for Bruno tests
- Asynchronous validation (`validateJsonSchema`) for Node.js scripts
- Schema existence checking (`schemaExists`)
- Schema path retrieval (`getSchemaPath`)
- Support for Draft-07 JSON Schema standard
- Array validation with uniform item validation
- Detailed error reporting with verbose mode
- GitHub Actions CI/CD pipeline for automated npm publishing
- Support for alpha, beta, and release version tags

### Features

- **Auto-detection**: Automatically detects Bruno environment using `bru.cwd()`
- **Default folder**: Uses `api-schemas` folder by default in Bruno collections
- **Flexible paths**: Supports absolute and relative paths for Node.js environments
- **Public package**: Available on npm registry for community use
- **JSONPlaceholder examples**: Updated all examples to use public REST API

### Documentation

- Comprehensive README.md with Quick Start guide
- API documentation for all methods
- 5 advanced usage examples
- Bruno integration examples with `.bru` file snippets
- Clear folder structure recommendations
- Migration guide and architecture documentation

### Development

- Test suite with automated tests
- Examples for Bruno integration and Node.js usage
- Proper `.gitignore` for npm projects
