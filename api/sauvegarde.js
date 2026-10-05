/**
 * Point d'entrée Vercel de la sauvegarde en ligne (RAID, profil de l'arcade).
 *
 * N'adapte que le transport : la logique vit dans `server/sauvegarde.js`,
 * partagée avec le serveur Node autonome.
 */

import { traiter } from '../server/sauvegarde.js';

async function lireCorps(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  const morceaux = [];
  for await (const m of req) morceaux.push(m);
  try { return JSON.parse(Buffer.concat(morceaux).toString('utf8')); } catch { return null; }
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const corps = req.method === 'GET' ? null : await lireCorps(req);
  const { statut, json } = await traiter({ methode: req.method, cle: url.searchParams.get('cle'), espace: url.searchParams.get('espace'), corps });
  res.statusCode = statut;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(json));
}
