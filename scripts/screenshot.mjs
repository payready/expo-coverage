// Renders a report in headless Chromium: node scripts/screenshot.mjs <report.html> <out-prefix>
import { chromium } from 'playwright';

const [file, out] = process.argv.slice(2);
const browser = await chromium.launch();
const errors = [];
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, colorScheme: scheme });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`file://${file}`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}-${scheme}.png`, fullPage: true });
  if (scheme === 'light') {
    await page.getByText('App.tsx').first().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}-source.png` });
  }
  await page.close();
}
await browser.close();
console.log(errors.length ? errors : 'no console errors');
