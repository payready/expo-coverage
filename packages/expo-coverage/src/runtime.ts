import { AppState, NativeModules, Platform } from 'react-native';

declare const process: { env: Record<string, string | undefined> };
type CoverageGlobal = typeof globalThis & { __coverage__?: unknown; __expoCoverageFlush?: () => Promise<void> };

const g = globalThis as CoverageGlobal;

/**
 * Where to post. In order:
 *  1. EXPO_PUBLIC_COVERAGE_URL, baked in at build time: prebuilt apps talking to `expo-coverage serve`.
 *  2. The Metro server that served the bundle (dev builds, Expo Go): Metro answers `/__coverage` itself.
 *  3. The page's own origin on web.
 */
export function coverageUrl(): string | null {
  const baked = process.env.EXPO_PUBLIC_COVERAGE_URL;
  if (baked) return baked.replace(/\/$/, '');
  if (Platform.OS === 'web') return typeof location !== 'undefined' ? location.origin : null;
  const script: string | undefined = NativeModules?.SourceCode?.scriptURL;
  const match = script && /^(https?:\/\/[^/]+)/.exec(script);
  return match ? (match[1] ?? null) : null;
}

/** Posts the in-memory Istanbul map. Resolves either way: coverage must never break the app under test. */
export async function flushCoverage(): Promise<void> {
  const coverage = g.__coverage__;
  const base = coverageUrl();
  if (!coverage || !base) return;
  try {
    await fetch(`${base}/__coverage?platform=${Platform.OS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coverage),
    });
  } catch {
    // Collector not up yet or already gone; the next flush sends the whole map again.
  }
}

let started = false;

/** Flush every `interval` ms, when the app backgrounds, and (web) when the page hides. Safe to call twice. */
export function startCoverage(options: { interval?: number } = {}): void {
  if (started) return;
  started = true;
  g.__expoCoverageFlush = flushCoverage;
  const flush = () => void flushCoverage();
  setInterval(flush, options.interval ?? 2000);
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
    }
  } else {
    AppState.addEventListener('change', (state) => state !== 'active' && flush());
  }
}
