import { defineConfig } from 'mobilewright';

export default defineConfig({
  testDir: '.',
  reporter: 'html',
  platform: 'android',
  timeout: 30_000, // global locator/RPC timeout — individual tests override via test.setTimeout()
  workers: 1, // run tests sequentially to avoid interference with shared test account and app state
  fullyParallel: true, // run tests in parallel at the test file level (instead of per test) to avoid interference with shared test account and app state
});
