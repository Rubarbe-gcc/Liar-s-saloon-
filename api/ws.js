/**
 * Point d'entree WebSocket pour un deploiement Vercel.
 *
 * Il ne fait qu'adapter le transport : toute la logique de jeu vit dans
 * `server/saloon.js`, partagee avec le serveur Node autonome.
 *
 * Limite a connaitre : les Functions Vercel peuvent etre servies par
 * plusieurs instances. Les salons vivant en memoire, deux joueurs qui
 * atterrissent sur des instances differentes ne se verront pas. Pour un
 * usage entre amis (trafic faible, instance gardee chaude) cela fonctionne ;
 * pour une audience large, il faut heberger `server/index.js` sur une
 * machine unique, ou passer les salons dans un stockage partage.
 */

import { experimental_upgradeWebSocket } from '@vercel/functions';
import { handleOpen, handleMessage, handleClose, sweep } from '../server/saloon.js';

let seq = 0;
let sweeper = null;

export async function GET() {
  // Entretien periodique des salons abandonnes, arme une seule fois par instance.
  if (!sweeper) {
    sweeper = setInterval(() => {
      try { sweep(); } catch (err) { console.error('[saloon] sweep', err); }
    }, 60_000);
    if (typeof sweeper.unref === 'function') sweeper.unref();
  }

  return experimental_upgradeWebSocket((socket) => {
    /** Adapte l'API Vercel a celle attendue par `saloon.js`. */
    const conn = {
      id: `v${(++seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      send(obj) {
        try { socket.send(JSON.stringify(obj)); return true; }
        catch { return false; }
      },
      close() {
        try { socket.close(); } catch { /* deja ferme */ }
      },
    };

    handleOpen(conn);

    socket.on('message', (data) => {
      let msg;
      try {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        msg = JSON.parse(text);
      } catch {
        return; // message illisible : on l'ignore
      }
      try { handleMessage(conn, msg); }
      catch (err) { console.error('[saloon] message', err); }
    });

    socket.on('close', () => {
      try { handleClose(conn); }
      catch (err) { console.error('[saloon] close', err); }
    });

    socket.on('error', () => {
      try { handleClose(conn); } catch { /* deja nettoye */ }
    });
  }, { maxPayload: 64 * 1024 });
}
