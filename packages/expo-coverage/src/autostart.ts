import { startCoverage } from './runtime';

// Runs before the app's entry (Metro `getModulesRunBeforeMainModule`), so no code changes are needed in the app.
startCoverage();
