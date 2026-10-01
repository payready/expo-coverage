'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Wraps a Metro config. When EXPO_COVERAGE=1 it
 *  - answers `POST /__coverage` on the dev server and merges maps into <projectRoot>/.expo-coverage,
 *  - keys Metro's cache on the flag so instrumented and plain bundles never mix.
 * Otherwise it returns the config untouched.
 *
 *   module.exports = withCoverage(getDefaultConfig(__dirname));
 */
function withCoverage(config, options = {}) {
  if (process.env.EXPO_COVERAGE !== '1') return config;
  const root = config.projectRoot || process.cwd();
  const dir = path.resolve(root, options.dir || '.expo-coverage');
  const previousEnhance = config.server && config.server.enhanceMiddleware;

  return {
    ...config,
    cacheVersion: `${config.cacheVersion || '1'}+expo-coverage`,
    server: {
      ...config.server,
      enhanceMiddleware: (middleware, server) => {
        const base = previousEnhance ? previousEnhance(middleware, server) : middleware;
        return (req, res, next) => {
          if (req.method === 'POST' && req.url && req.url.startsWith('/__coverage')) return collect(req, res, dir);
          return base(req, res, next);
        };
      },
    },
  };
}

function mergeFile(a, b) {
  const sum = (x = {}, y = {}) => {
    const out = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = (out[k] || 0) + v;
    return out;
  };
  const branches = { ...a.b };
  for (const [k, v] of Object.entries(b.b || {})) branches[k] = branches[k] ? v.map((n, i) => n + (branches[k][i] || 0)) : v;
  return { ...a, s: sum(a.s, b.s), f: sum(a.f, b.f), b: branches };
}

function collect(req, res, dir) {
  const platform = new URL(req.url, 'http://localhost').searchParams.get('platform') || 'unknown';
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try {
      const file = path.join(dir, `coverage-${platform}.json`);
      const map = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      const incoming = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      for (const [name, fc] of Object.entries(incoming)) map[name] = map[name] ? mergeFile(map[name], fc) : fc;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(map));
      res.statusCode = 204;
    } catch (error) {
      console.error('expo-coverage: ignored post:', error.message);
      res.statusCode = 400;
    }
    res.end();
  });
}

module.exports = { withCoverage };
