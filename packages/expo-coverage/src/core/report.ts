import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CoverageData } from './types';

const PLACEHOLDER = '/*__DATA__*/ null';

/** The prebuilt report app (packages/report) ships inside this package at assets/report.html. */
export function reportTemplatePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [resolve(here, '../assets/report.html'), resolve(here, '../../assets/report.html')]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('report.html template missing. Run `bun run build` in packages/expo-coverage.');
}

/** Inject the data into the single-file report app. A function replacer: `$&`-style sequences in source must stay literal. */
export function renderReport(data: CoverageData, template = readFileSync(reportTemplatePath(), 'utf8')): string {
  if (!template.includes(PLACEHOLDER)) throw new Error('report template has no data placeholder');
  return template.replace(PLACEHOLDER, () => JSON.stringify(data).replace(/</g, '\\u003c'));
}

export function writeReport(data: CoverageData, outFile: string): void {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, renderReport(data));
}
