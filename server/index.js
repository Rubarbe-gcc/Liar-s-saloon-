#!/usr/bin/env node
/**
 * Serveur autonome : sert le site statique et heberge les parties en ligne.
 *
 * Aucune dependance externe — `node server/index.js` suffit.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWebSocketUpgrade, upgrade } from './wsproto.js';
import { handleOpen, handleMessage, handleClose, sweep, stats } from './saloon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/* ------------------------------------------------------------------ */
/* Fichiers statiques                                                  */
/* ------------------------------------------------------------------ */

/**
 * Resout une URL vers un fichier de `public/`, en refusant toute tentative
 * de sortir de ce dossier.
 */
function resolveFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (rel.endsWith('/')) rel += 'index.html';

  const full = path.normalize(path.join(ROOT, rel));
  // path.normalize a deja resolu les « .. » : il suffit de verifier le prefixe.
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;

  try {
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      const idx = path.join(full, 'index.html');
      return fs.existsSync(idx) ? idx : null;
    }
    return full;
  } catch {
    // Permet /games/liars-saloon comme raccourci vers son index.html.
    const asDir = path.join(full, 'index.html');
    return fs.existsSync(asDir) ? asDir : null;
  }
}

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain' });
    return res.end('Méthode non autorisée');
  }

  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, ...stats() }));
  }

  const file = resolveFile(req.url === '/' ? '/index.html' : req.url);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>404</title>'
      + '<body style="background:#0d0705;color:#e8b75c;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0">'
      + '<div style="text-align:center"><h1 style="font-size:3rem;margin:0">404</h1>'
      + '<p style="opacity:.6">Cette porte ne mène nulle part.</p>'
      + '<a href="/" style="color:#ffd98a">Retour au comptoir</a></div>');
  }

  const ext = path.extname(file).toLowerCase();
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': body.length,
    // Les fichiers du jeu evoluent : on revalide plutot que de figer le cache.
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=0, must-revalidate',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

/* ------------------------------------------------------------------ */
/* Serveur                                                             */
/* ------------------------------------------------------------------ */

const server = http.createServer(serveStatic);

server.on('upgrade', (req, socket) => {
  const url = (req.url || '').split('?')[0];
  if (url !== '/ws' && url !== '/api/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    return socket.destroy();
  }
  if (!isWebSocketUpgrade(req)) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    return socket.destroy();
  }

  const conn = upgrade(req, socket);
  handleOpen(conn);
  conn.on('message', (msg) => handleMessage(conn, msg));
  conn.on('close', () => handleClose(conn));
});

setInterval(() => sweep(), 60_000).unref();

server.listen(PORT, HOST, () => {
  const where = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`\n  🎴  Liar's Saloon`);
  console.log(`      http://${where}:${PORT}`);
  console.log(`      jeu   http://${where}:${PORT}/games/liars-saloon/`);
  console.log(`      ws    ws://${where}:${PORT}/ws\n`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\nFermeture du saloon…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
