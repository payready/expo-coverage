// Opens a report in Chromium and WebKit and fails if the PanelUI/Uniwind styles did not make it into the page.
// A missing `@source` path silently drops Tailwind classes: cards go square, chips fall back to browser buttons.
// Usage: node scripts/validate-report.mjs <report.html>
import { chromium, webkit } from 'playwright';

const file = process.argv[2];
if (!file) throw new Error('usage: validate-report.mjs <report.html>');
const failures = [];

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser;
  try {
    browser = await engine.launch();
  } catch {
    console.log(`${name}: not installed, skipped`);
    continue;
  }
  for (const [width, label] of [[1440, 'desktop'], [390, 'phone']]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`file://${file}`);
    await page.waitForTimeout(1200);
    const result = await page.evaluate(() => {
      const leaf = (text) => [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim().startsWith(text));
      const up = (el, tag) => { for (let e = el; e; e = e.parentElement) if (e.tagName === tag) return e; return null; };
      const card = (() => { let e = leaf('Files'); while (e && !(parseFloat(getComputedStyle(e).borderTopWidth) > 0)) e = e.parentElement; return e; })();
      const chip = up(leaf('Only files with gaps'), 'BUTTON');
      const radius = (el) => (el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) : 0);
      const pad = (el) => (el ? parseFloat(getComputedStyle(el).paddingLeft) : 0);
      return {
        cardRadius: radius(card),
        chipPadding: pad(chip),
        chipBorderIsDefaultBlack: chip ? getComputedStyle(chip).borderTopColor === 'rgb(0, 0, 0)' && getComputedStyle(chip).borderTopWidth !== '0px' : true,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        hasContent: Boolean(leaf('Biggest gaps')),
      };
    });
    const where = `${name}/${label}`;
    if (errors.length) failures.push(`${where}: page errors ${errors[0]}`);
    if (!result.hasContent) failures.push(`${where}: report did not render`);
    if (result.cardRadius < 8) failures.push(`${where}: cards are square (radius ${result.cardRadius}), PanelUI classes are missing`);
    if (result.chipPadding < 4) failures.push(`${where}: chip has no padding, PanelUI classes are missing`);
    if (result.chipBorderIsDefaultBlack) failures.push(`${where}: chip has the browser default border`);
    if (result.overflowX > 1) failures.push(`${where}: page scrolls sideways by ${result.overflowX}px`);
    await page.close();
  }
  await browser.close();
}

if (failures.length) {
  console.error(failures.map((f) => `✗ ${f}`).join('\n'));
  process.exit(1);
}
console.log('✓ report styles look right in every installed engine');
