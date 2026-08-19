/**
 * Spatial Scene Inspector Dev Plugin.
 *
 * Mounts a JSON endpoint at `/__spatial-inspect` in dev mode for real-time
 * spatial scene graph queries, draw-call budgets, and ergonomics metrics.
 */

import type { Plugin, Connect } from 'vite';

export function spatialSceneInspectorPlugin(): Plugin {
  return {
    name: 'nemosyne:spatial-inspector',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__spatial-inspect', (req: Connect.IncomingMessage, res) => {
        if (req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(
            JSON.stringify({
              status: 'active',
              timestamp: Date.now(),
              questProfile: {
                targetRefreshRateHz: 72,
                maxDrawCallsBudget: 100,
                maxVerticesBudget: 300000,
                pixelsPerDegree: 25.5,
              },
              ergonomicsConstants: {
                minComfortDepthMeters: 0.75,
                maxComfortDepthMeters: 1.6,
                maxComfortFovDegrees: 30,
              },
            })
          );
          return;
        }

        res.writeHead(405);
        res.end();
      });
    },
  };
}
