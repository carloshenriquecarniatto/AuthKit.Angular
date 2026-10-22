#!/usr/bin/env node
/**
 * Serves the demo build and proxies Supabase traffic through the same origin.
 *
 * Same-origin keeps the POC representative of a real deployment (no CORS shims) and lets the
 * browser storage checks apply to the exact page the user is testing.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const authUrl = process.env.AUTH_URL;
const restUrl = process.env.REST_URL;
const anonKey = process.env.ANON_KEY;
const demoDir = process.env.DEMO_DIR;
const port = Number(process.env.POC_PORT ?? 8088);

if (!authUrl || !restUrl || !anonKey || !demoDir) {
  console.error('AUTH_URL, REST_URL, ANON_KEY and DEMO_DIR are required.');
  process.exit(2);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');

  // Injected before any application code runs. Same origin, so no CORS is involved.
  if (url.pathname === '/config.js') {
    response.writeHead(200, { 'content-type': mime['.js'], 'cache-control': 'no-store' });
    // The app talks to this origin; the proxy forwards /auth/v1 and /rest/v1 upstream.
    response.end(
      `window.AUTHKIT_CONFIG = { url: window.location.origin, anonKey: ${JSON.stringify(anonKey)} };`,
    );
    return;
  }

  if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/')) {
    const isAuth = url.pathname.startsWith('/auth/v1/');
    const base = new URL(isAuth ? authUrl : restUrl);
    const path = url.pathname.replace(isAuth ? '/auth/v1' : '/rest/v1', '');
    const target = `${base.origin}${path}${url.search}`;

    const headers = { ...request.headers };
    delete headers.host;

    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request,
        duplex: 'half',
      });

      response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'upstream_unavailable', detail: String(error) }));
    }

    return;
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(demoDir, requested));

  if (!file.startsWith(normalize(demoDir))) {
    response.writeHead(403).end('forbidden');
    return;
  }

  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    // Single-page application: unknown routes fall back to the shell.
    try {
      response.writeHead(200, { 'content-type': mime['.html'] });
      response.end(await readFile(join(demoDir, 'index.html')));
    } catch {
      response.writeHead(404).end('not found');
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`poc: http://127.0.0.1:${port}`);
});
