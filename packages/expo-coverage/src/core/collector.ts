import { createServer, type Server } from 'node:http';
import { coverageFile } from './paths';
import { mergeCoverageFile } from './merge';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export interface Collector {
  server: Server;
  port: number;
  /** Number of posts merged so far. */
  posts: () => number;
  close: () => Promise<void>;
}

/** Receives `POST /__coverage?platform=<ios|android|web>` (unit coverage arrives via `import`) from instrumented apps and merges it into `<dir>/coverage-<platform>.json`. */
export function startCollector(opts: { root: string; dir?: string; port: number; host?: string }): Promise<Collector> {
  let posts = 0;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS).end();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/__coverage/health') {
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, posts }));
      return;
    }
    if (req.method !== 'POST' || url.pathname !== '/__coverage') {
      res.writeHead(404, CORS).end();
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const platform = url.searchParams.get('platform') || 'unknown';
        mergeCoverageFile(coverageFile(opts.root, platform, opts.dir), JSON.parse(Buffer.concat(chunks).toString('utf8')));
        posts++;
        res.writeHead(204, CORS).end();
      } catch (error) {
        // A truncated post is harmless: the next interval sends the whole map again.
        console.error(`expo-coverage: ignored post (${Buffer.concat(chunks).length} bytes): ${error}`);
        res.writeHead(400, CORS).end();
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, opts.host ?? '0.0.0.0', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : opts.port;
      resolve({ server, port, posts: () => posts, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
