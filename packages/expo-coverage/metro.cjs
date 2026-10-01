'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Wraps a Metro config. When EXPO_COVERAGE=1 it
 *  - starts the coverage runtime before your entry file, so the app needs no code changes,
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
  const previousRunBefore = config.serializer && config.serializer.getModulesRunBeforeMainModule;
  const previousEnhance = config.server && config.server.enhanceMiddleware;

  return {
    ...config,
    cacheVersion: `${config.cacheVersion || '1'}+expo-coverage`,
    serializer: {
      ...config.serializer,
      getModulesRunBeforeMainModule: (entry) => [...(previousRunBefore ? previousRunBefore(entry) : []), require('path').join(__dirname, 'dist', 'autostart.js')],
    },
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

function collect(req, res, dir) {
  const platform = new URL(req.url, 'http://localhost').searchParams.get('platform') || 'unknown';
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try {
      const { createCoverageMap } = require('istanbul-lib-coverage');
      const file = path.join(dir, `coverage-${platform}.json`);
      const map = createCoverageMap({});
      if (fs.existsSync(file)) map.merge(JSON.parse(fs.readFileSync(file, 'utf8')));
      map.merge(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(map.toJSON()));
      res.statusCode = 204;
    } catch (error) {
      console.error('expo-coverage: ignored post:', error.message);
      res.statusCode = 400;
    }
    res.end();
  });
}

module.exports = { withCoverage };
