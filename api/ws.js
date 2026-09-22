/**
 * Point d'entrée WebSocket pour un déploiement Vercel.
 *
 * Il n'adapte que le transport : toute la logique de jeu vit dans
 * `server/saloon.js`, partagée avec le serveur Node autonome.
 *
 * Vercel attend ici un serveur HTTP exporté par défaut ; il se charge de lui
 * passer les requêtes reçues sur /api/ws, montée en WebSocket comprise.
 *
 * Limite à connaître : les Functions peuvent être servies par plusieurs
 * instances. Les salons vivant en mémoire, deux joueurs qui atterrissent sur
 * des instances différentes ne se verraient pas. Pour un usage entre amis
 * (trafic faible, instance gardée chaude) cela fonctionne ; pour une audience
 * large, il faut héberger `server/index.js` sur une machine unique, ou
 * déplacer les salons dans un stockage partagé.
 */

import http from 'node:http';
import { WebSocketServer } from 'ws';
import { handleOpen, handleMessage, handleClose, sweep, stats } from '../server/hub.js';

/**
 * Une requête HTTP ordinaire sur /api/ws répond par une sonde de santé.
 * C'est le seul moyen simple de vérifier depuis un navigateur que la
 * Function est bien déployée et vivante, sans ouvrir de WebSocket.
 */
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify({
    ok: true,
    service: "liar's saloon",
    transport: 'websocket',
    hint: 'Connectez-vous en WebSocket sur cette même adresse.',
    ...stats(),
  }));
});

const wss = new WebSocketServer({ server });

let seq = 0;

wss.on('connection', (socket) => {
  /** Adapte l'API de `ws` à celle qu'attend `saloon.js`. */
  const conn = {
    id: `v${(++seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    send(obj) {
      if (socket.readyState !== socket.OPEN) return false;
      try { socket.send(JSON.stringify(obj)); return true; }
      catch { return false; }
    },
    close() {
      try { socket.close(); } catch { /* déjà fermée */ }
    },
  };

  handleOpen(conn);

  socket.on('message', (data) => {
    let msg;
    // `ws` remet un Buffer : il faut le décoder avant de lire le JSON.
    try { msg = JSON.parse(data.toString('utf8')); }
    catch { return; } // message illisible : on l'ignore
    try { handleMessage(conn, msg); }
    catch (err) { console.error('[saloon] message', err); }
  });

  socket.on('close', () => {
    try { handleClose(conn); }
    catch (err) { console.error('[saloon] close', err); }
  });

  socket.on('error', () => {
    try { handleClose(conn); } catch { /* déjà nettoyé */ }
  });
});

// Entretien des salons abandonnés, armé une seule fois par instance.
const sweeper = setInterval(() => {
  try { sweep(); } catch (err) { console.error('[saloon] sweep', err); }
}, 60_000);
if (typeof sweeper.unref === 'function') sweeper.unref();

export default server;
