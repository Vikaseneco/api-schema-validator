# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-10-20

### Added
- GitHub Actions CI/CD pipeline for automated publishing to Azure Artifacts
- `.npmrc.example` template for Azure Artifacts configuration
- `PUBLISHING.md` comprehensive guide for publishing to Azure Artifacts
- Automated build and test workflow on pull requests

### Fixed
- Corrected repository URL format in package.json
- Added `.npmrc` to `.gitignore` for security

### Changed
- Updated `.gitignore` to exclude npm authentication files

## [1.0.0] - 2025-10-20

### Added
- Initial release of @eneco/api-schema-validator
- `SchemaValidator` class for JSON schema validation
- Automatic schema generation from API responses
- Synchronous validation (`validateJsonSchemaSync`) for Bruno tests
- Asynchronous validation (`validateJsonSchema`) for Node.js scripts
- Schema existence checking (`schemaExists`)
- Schema path retrieval (`getSchemaPath`)
- Comprehensive documentation (README.md, SETUP_GUIDE.md, MIGRATION.md, ARCHITECTURE.md, INDEX.md)
- Working examples for basic usage, Bruno integration, and project integration
- Test suite with 9 automated tests
- Support for Draft-07 JSON Schema standard
- Array validation with uniform item validation
- Detailed error reporting
