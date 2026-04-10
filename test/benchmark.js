/**
 * Performance benchmark test for SchemaValidator
 * Demonstrates the performance improvement from caching
 */

const SchemaValidator = require('../lib/index');
const path = require('path');
const fs = require('fs');

console.log('Running performance benchmark for SchemaValidator...\n');

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

const testSchemaPath = './benchmark-schemas';
const validator = new SchemaValidator(testSchemaPath);

// Cleanup function
function cleanup() {
  if (fs.existsSync(testSchemaPath)) {
    fs.rmSync(testSchemaPath, { recursive: true, force: true });
  }
}

// Benchmark function
function benchmark(name, fn, iterations = 1000) {
  const start = Date.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = Date.now();
  const duration = end - start;
  console.log(`${name}: ${duration}ms (${(duration / iterations).toFixed(3)}ms per iteration)`);
  return duration;
}

// Run benchmarks
async function runBenchmarks() {
  try {
    // Cleanup before tests
    cleanup();

    // Create schema first
    console.log('Setting up: Creating schema...');
    await validator.createJsonSchema('benchmark', 'TestAssets', testData);
    console.log('Setup complete.\n');

    console.log('='.repeat(60));
    console.log('PERFORMANCE BENCHMARK');
    console.log('='.repeat(60));
    console.log(`Running 1000 validation iterations...\n`);

    // Benchmark WITHOUT cache (clear cache before each validation)
    console.log('Test 1: Validation WITHOUT caching (baseline)');
    const withoutCacheTime = benchmark('  No Cache', () => {
      validator.clearCache();
      validator.validateJsonSchemaSync('benchmark', 'TestAssets', testData, { verbose: false });
    }, 100);

    // Benchmark WITH cache
    console.log('\nTest 2: Validation WITH caching (optimized)');
    const withCacheTime = benchmark('  With Cache', () => {
      validator.validateJsonSchemaSync('benchmark', 'TestAssets', testData, { verbose: false });
    }, 1000);

    // Calculate improvement
    const improvement = ((withoutCacheTime / 10 - withCacheTime) / (withoutCacheTime / 10) * 100).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`Without cache (100 iterations): ${withoutCacheTime}ms`);
    console.log(`With cache (1000 iterations):   ${withCacheTime}ms`);
    console.log(`Performance improvement:        ${improvement}% faster`);
    console.log('='.repeat(60));
    
    // Show cache stats
    const stats = validator.getCacheStats();
    console.log(`\nCache statistics:`);
    console.log(`  Validator cache size: ${stats.validatorCacheSize}`);
    console.log(`  Schema cache size:    ${stats.schemaCacheSize}`);
    
    console.log('\n✓ Benchmark completed successfully!\n');

  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  } finally {
    // Cleanup after tests
    cleanup();
  }
}

runBenchmarks().catch(error => {
  console.error('Benchmark suite failed:', error);
  cleanup();
  process.exit(1);
});
