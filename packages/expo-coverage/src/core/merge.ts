import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mergeInto, type RawCoverage } from './istanbul';

/** Fold `incoming` into the map stored at `file`. A JS reload restarts the in-app counters, so posts merge rather than overwrite. */
export function mergeCoverageFile(file: string, incoming: unknown): void {
  const map: RawCoverage = {};
  if (existsSync(file)) {
    try {
      mergeInto(map, JSON.parse(readFileSync(file, 'utf8')));
    } catch (error) {
      // A torn write should not block the new snapshot.
      console.error(`expo-coverage: dropped unreadable ${file}: ${error}`);
    }
  }
  mergeInto(map, incoming as RawCoverage);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(map));
}

/**
 * Metro's transform cache is shared by sibling git worktrees, so a map can name another checkout's paths.
 * Point those at `root`, and drop anything outside the project.
 */
export function rehome(root: string, data: Record<string, any>): Record<string, any> {
  const siblings = `${dirname(root)}/`;
  const out: Record<string, any> = {};
  for (const [path, fc] of Object.entries(data)) {
    let local = path;
    if (!path.startsWith(`${root}/`) && path.startsWith(siblings)) {
      local = join(root, path.slice(siblings.length).split('/').slice(1).join('/'));
    }
    // Virtual modules (e.g. react-native-web shims) have no file on disk and no place in a report.
    if (!local.startsWith(`${root}/`) || local.includes('\0')) continue;
    const entry = { ...fc, path: local };
    if (out[local]) {
      out[local] = mergeInto({ [local]: out[local] }, { [local]: entry })[local];
    } else out[local] = entry;
  }
  return out;
}
