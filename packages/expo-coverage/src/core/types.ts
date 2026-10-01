export type Platform = 'ios' | 'android' | 'web';
export type Tab = Platform | 'all';
export const PLATFORMS: Platform[] = ['ios', 'android', 'web'];

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
export interface CoverageData {
  title: string;
  generated: string;
  platforms: Platform[];
  files: FileEntry[];
  sources: Record<string, Token[][]>;
  palette: [string, string][];
}
