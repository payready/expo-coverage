import { expect, test as base, type Page } from '@playwright/test';

/** Ask the page to post its coverage now. Call after the last assertion of a test. */
export async function flushCoverage(page: Page): Promise<void> {
  await page
    .evaluate(async () => {
      await (window as unknown as { __expoCoverageFlush?: () => Promise<void> }).__expoCoverageFlush?.();
    })
    .catch(() => {});
}

/** Playwright's `test`, flushing coverage after every test automatically. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);
    await flushCoverage(page);
  },
});

export { expect };
