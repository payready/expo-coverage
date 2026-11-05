export type Platform = 'ios' | 'android' | 'web' | 'unit';
export type Tab = Platform | 'all';

/** [covered, total] */
export type Ratio = readonly [number, number];

export interface Sums {
  l: Ratio; // lines
  s: Ratio; // statements
  f: Ratio; // functions
  b: Ratio; // branches
}

export interface FileEntry {
  /** Path relative to the project root. */
  p: string;
  /** Executable line -> hit count per platform (same order as `platforms`); null when that line is not executable there (or it never loaded the file). */
  lc: Record<string, (number | null)[]>;
  sums: Partial<Record<Tab, Sums>>;
}

/** One highlighted token: its text and an index into `palette`. */
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
  /** Highlighted source: file -> line -> tokens. */
  sources: Record<string, Token[][]>;
  /** [light, dark] token colors. */
  palette: [string, string][];
  /** True when built with `--all` (inventory includes unloaded files at 0%). */
  inventory?: boolean;
}

export type SumKey = keyof Sums;
