export type Platform = 'ios' | 'android' | 'web' | 'unit';
export type Tab = Platform | 'all';
export const PLATFORMS: Platform[] = ['ios', 'android', 'web', 'unit'];
export const TABS: Tab[] = [...PLATFORMS, 'all'];
export const PLATFORM_LABEL: Record<Tab, string> = { ios: 'iOS', android: 'Android', web: 'Web', unit: 'Unit', all: 'All' };

export type Ratio = readonly [covered: number, total: number];
export interface Sums {
  l: Ratio;
  s: Ratio;
  f: Ratio;
  b: Ratio;
}
export interface FileEntry {
  p: string;
  lc: Record<string, (number | null)[]>;
  sums: Partial<Record<Tab, Sums>>;
}
export type Token = [text: string, color: number];
export interface AppMeta {
  name: string | null;
  slug: string | null;
  version: string | null;
  ios: string | null;
  android: string | null;
  expoSdk: string | null;
  reactNative: string | null;
}
export interface GitMeta {
  sha: string;
  short: string;
  branch: string | null;
  subject: string | null;
  dirty: boolean;
  url: string | null;
}
export interface Meta {
  app: AppMeta | null;
  git: GitMeta | null;
}
export interface CoverageData {
  meta?: Meta;
  title: string;
  generated: string;
  platforms: Platform[];
  files: FileEntry[];
  sources: Record<string, Token[][]>;
  palette: [string, string][];
  /** True when built with `--all` (inventory denominator includes unloaded files). */
  inventory?: boolean;
}
