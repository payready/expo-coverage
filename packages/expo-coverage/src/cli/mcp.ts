import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as query from '../core/query';
import { TABS } from '../core/types';
import type { Tab } from '../core/types';
import type { Ctx } from './commands';
import { load } from './commands';

const tab = z.enum(TABS as [Tab, ...Tab[]]).default('all');
const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });

/** Coverage as tools an agent can call: where are the gaps, what exactly is uncovered, did my change get tested. */
export async function mcp(ctx: Ctx): Promise<void> {
  const server = new McpServer({ name: 'expo-coverage', version: '0.2.0' });

  server.tool('coverage_summary', 'Overall line coverage, per platform (ios, android, web e2e and unit tests).', { tab }, async ({ tab }) => text(query.summary(await load(ctx), tab)));

  server.tool(
    'coverage_gaps',
    'Files ranked by uncovered lines, with the line ranges. Start here to decide what to exercise next.',
    { tab, top: z.number().int().min(1).max(100).default(10), under: z.string().optional().describe('Only files under this path prefix') },
    async ({ tab, top, under }) => text(query.gaps(await load(ctx), { tab, top, under })),
  );

  server.tool(
    'coverage_file',
    'Uncovered line ranges of one file, with the source of each range.',
    { path: z.string().describe('Path relative to the project root'), tab },
    async ({ path, tab }) => text(query.fileView(await load(ctx), ctx.root, path, tab) ?? `No coverage recorded for ${path}`),
  );

  server.tool(
    'coverage_diff',
    'Of the lines changed against a git base, which were never run by a test.',
    { base: z.string().default('origin/main'), tab },
    async ({ base, tab }) => text(query.diff(await load(ctx), query.changedLines(ctx.root, base), base, tab)),
  );

  await server.connect(new StdioServerTransport());
}
