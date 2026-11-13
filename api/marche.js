/**
 * Point d'entrée Vercel du marché de MAXI MENU.
 * La logique vit dans `server/marche.js`, partagée avec le serveur Node autonome.
 */

import { traiter } from '../server/marche.js';

async function lireCorps(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  const morceaux = [];
  for await (const m of req) morceaux.push(m);
  try { return JSON.parse(Buffer.concat(morceaux).toString('utf8')); } catch { return null; }
}

export default async function handler(req, res) {
  const corps = req.method === 'GET' ? null : await lireCorps(req);
  const { statut, json } = await traiter({ methode: req.method, corps });
  res.statusCode = statut;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(json));
}
