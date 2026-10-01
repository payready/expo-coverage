import { join, resolve } from 'node:path';
import type { Platform } from './types';

export const DEFAULT_DIR = '.expo-coverage';
export const DEFAULT_PORT = 9082;

export const coverageDir = (root: string, dir = DEFAULT_DIR): string => resolve(root, dir);
export const coverageFile = (root: string, platform: Platform | string, dir = DEFAULT_DIR): string => join(coverageDir(root, dir), `coverage-${platform}.json`);
export const reportFile = (root: string, dir = DEFAULT_DIR): string => join(coverageDir(root, dir), 'report.html');
