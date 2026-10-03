export { startCollector, type Collector } from './core/collector';
export { buildCoverageData } from './core/data';
export { buildInventoryBaseline, fillMissing, listInventoryFiles, readInstrumentGlobs } from './core/inventory';
export { mergeCoverageFile, rehome } from './core/merge';
export { diff, fileView, gaps, missedRanges, summary, changedLines } from './core/query';
export { renderReport, writeReport } from './core/report';
export type { CoverageData, Platform, Tab } from './core/types';