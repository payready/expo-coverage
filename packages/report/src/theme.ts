import type { Health } from './lib/stats';
import type { Platform } from './lib/types';

/** Coverage colors. Fixed hues so red/amber/green read the same in every PanelUI theme. */
export const HEALTH: Record<Health, string> = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444' };
/** Unit is pink-500: ≥3:1 on white and on every PanelUI dark surface, and clear of the health hues. */
export const PLATFORM: Record<Platform, string> = { ios: '#3b82f6', android: '#10b981', web: '#f97316', unit: '#ec4899' };
export const OVERLAP = { some: '#8b5cf6' } as const;
export const HIT_BG = 'rgba(34,197,94,0.10)';
export const MISS_BG = 'rgba(239,68,68,0.14)';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** PanelUI Progress/Chip color per health band. */
export const PROGRESS_COLOR = { good: 'success', warn: 'warning', bad: 'destructive' } as const;
