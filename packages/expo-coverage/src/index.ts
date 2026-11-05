export { startCollector, type Collector } from './core/collector';
export { buildCoverageData } from './core/data';
export { mergeCoverageFile, rehome } from './core/merge';
export { diff, fileView, gaps, missedRanges, summary, changedLines } from './core/query';
export { renderReport, writeReport } from './core/report';
export { importCoverage, lcovToIstanbul, readExternalCoverage } from './core/import';
export { PLATFORMS, type CoverageData, type Platform, type Tab } from './core/types';
