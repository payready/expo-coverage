import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppMeta, GitMeta, Meta } from './types';

const json = (file: string): any => {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  } catch {
    return null;
  }
};

const git = (root: string, ...args: string[]): string | null => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

/** `git@github.com:o/r.git` and `https://github.com/o/r.git` -> `https://github.com/o/r`. */
export function webUrl(remote: string | null): string | null {
  if (!remote) return null;
  const m = /^(?:git@([^:]+):|https?:\/\/(?:[^@/]+@)?([^/]+)\/)(.+?)(?:\.git)?$/.exec(remote);
  return m ? `https://${m[1] ?? m[2]}/${m[3]}` : null;
}

export function readApp(root: string): AppMeta | null {
  const expo = json(join(root, 'app.json'))?.expo;
  const pkg = json(join(root, 'package.json'));
  if (!expo && !pkg) return null;
  return {
    name: expo?.name ?? pkg?.name ?? null,
    slug: expo?.slug ?? null,
    version: expo?.version ?? pkg?.version ?? null,
    ios: expo?.ios?.bundleIdentifier ?? null,
    android: expo?.android?.package ?? null,
    expoSdk: json(join(root, 'node_modules/expo/package.json'))?.version ?? null,
    reactNative: json(join(root, 'node_modules/react-native/package.json'))?.version ?? null,
  };
}

export function readGit(root: string): GitMeta | null {
  const env = process.env;
  const sha = env.GITHUB_SHA ?? git(root, 'rev-parse', 'HEAD');
  if (!sha) return null;
  const repo = webUrl(env.GITHUB_REPOSITORY ? `https://github.com/${env.GITHUB_REPOSITORY}` : git(root, 'remote', 'get-url', 'origin'));
  return {
    sha,
    short: sha.slice(0, 7),
    branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || git(root, 'rev-parse', '--abbrev-ref', 'HEAD'),
    subject: git(root, 'log', '-1', '--pretty=%s'),
    dirty: (git(root, 'status', '--porcelain', '--', '.') ?? '') !== '',
    url: repo ? `${repo}/commit/${sha}` : null,
  };
}

export const readMeta = (root: string): Meta => ({ app: readApp(root), git: readGit(root) });
