export type Platform = 'ios' | 'android' | 'web';
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
  /** Executable line -> hit count per platform (same order as `platforms`); null when that platform never loaded the file. */
  lc: Record<string, (number | null)[]>;
  sums: Partial<Record<Tab, Sums>>;
}

/** One highlighted token: its text and an index into `palette`. */
export type Token = [text: string, color: number];

export interface CoverageData {
  title: string;
  generated: string;
  platforms: Platform[];
  files: FileEntry[];
  /** Highlighted source: file -> line -> tokens. */
  sources: Record<string, Token[][]>;
  /** [light, dark] token colors. */
  palette: [string, string][];
}

export type SumKey = keyof Sums;
