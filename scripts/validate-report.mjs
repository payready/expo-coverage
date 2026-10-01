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
      const tab = (() => { let e = leaf('iOS') || leaf('Web'); while (e && e.getAttribute('role') !== 'tab') e = e.parentElement; return e; })();
      const solidBlackBars = [...document.querySelectorAll('div')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.height > 0 && r.height <= 12 && r.width > 20 && getComputedStyle(e).backgroundColor === 'rgb(0, 0, 0)';
      }).length;
      const tablist = document.querySelector('[role="tablist"]');
      const clipped = tablist ? [...tablist.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => e.textContent.trim()) : [];
      const tabsWide = tablist ? [...tablist.querySelectorAll('[role="tab"]')].reduce((w, e) => w + e.getBoundingClientRect().width, 0) : 0;
      return {
        clipped,
        tabsFit: tablist ? tablist.getBoundingClientRect().width + 1 >= tabsWide : true,
        tabHeight: tab ? tab.getBoundingClientRect().height : 0,
        solidBlackBars,
        cardRadius: radius(card),
        chipPadding: pad(chip),
        chipBorderIsDefaultBlack: chip ? getComputedStyle(chip).borderTopColor === 'rgb(0, 0, 0)' && getComputedStyle(chip).borderTopWidth !== '0px' : true,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        hasContent: Boolean(leaf('Biggest gaps')),
      };
    });
    const where = `${name}/${label}`;
    // Reanimated only runs on web when its worklets were compiled; otherwise the selection pill never appears.
    const pill = () => page.evaluate(() => {
      const d = [...document.querySelectorAll('[role="tablist"] div')].find((e) => getComputedStyle(e).position === 'absolute');
      return d ? { w: d.getBoundingClientRect().width, x: d.getBoundingClientRect().x, o: Number(getComputedStyle(d).opacity) } : null;
    });
    const before = await pill();
    const tabs = page.getByRole('tab');
    if ((await tabs.count()) > 1) {
      await tabs.first().click();
      await page.waitForTimeout(900);
      const first = await pill();
      await tabs.last().click();
      await page.waitForTimeout(900);
      const last = await pill();
      if (!first || first.w < 10 || first.o < 0.9) failures.push(`${where}: tab selection pill is invisible (animations are not running)`);
      else if (!last || Math.abs(last.x - first.x) < 20) failures.push(`${where}: tab selection pill does not move when you press a tab`);
    } else if (before && before.w === 0) failures.push(`${where}: tab selection pill has no width`);
    if (errors.length) failures.push(`${where}: page errors ${errors[0]}`);
    if (!result.hasContent) failures.push(`${where}: report did not render`);
    if (result.cardRadius < 8) failures.push(`${where}: cards are square (radius ${result.cardRadius}), PanelUI classes are missing`);
    if (result.chipPadding < 4) failures.push(`${where}: chip has no padding, PanelUI classes are missing`);
    if (result.chipBorderIsDefaultBlack) failures.push(`${where}: chip has the browser default border`);
    if (result.clipped.length) failures.push(`${where}: tab text is cut off (${result.clipped.join(', ')})`);
    if (!result.tabsFit) failures.push(`${where}: tabs do not fit their container`);
    if (result.tabHeight > 48) failures.push(`${where}: tab labels wrap onto two lines (${Math.round(result.tabHeight)}px tall)`);
    if (result.solidBlackBars) failures.push(`${where}: ${result.solidBlackBars} solid black bars (progress bars lost their color)`);
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
