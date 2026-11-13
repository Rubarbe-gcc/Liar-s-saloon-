// ORBITE NOIRE — serveur de relais « lockstep » (1c1 et 2c2). Il ne simule rien : il numérote des tours de 150 ms
// et diffuse les ordres de tous les joueurs à tous, dans le même ordre. Chaque client fait tourner le moteur déterministe.
// ⚠ Il faut un hébergement qui garde des WebSockets ouverts (VPS, Render, Fly, Railway…). Vercel (serverless) ne le permet pas :
//    le jeu (statique) peut rester sur Vercel, ce serveur doit tourner ailleurs. Lancer seul : `node server/orbite.js` (PORT, défaut 8787).
//    Ou le brancher sur un serveur HTTP existant : `import { attacher } from './orbite.js'; attacher(httpServer, '/orbite');`
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

export const TOUR_MS = 150;
const FACTIONS = ['fer', 'bosquet', 'echos'], ORDRES = ['move', 'att', 'am', 'rec', 'prod', 'bat', 'up', 'pouv', 'stop'];
const salles = new Map();
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const mot = v => (typeof v === 'string' && /^[a-z]{1,12}$/.test(v) ? v : undefined);

export function nettoyerOrdre(ids, c) {
  if (!Array.isArray(ids) || !c || typeof c !== 'object' || !ORDRES.includes(c.t)) return null;
  const i = ids.filter(v => Number.isInteger(v)).slice(0, 64);
  if (!i.length) return null;
  return { ids: i, c: { t: c.t, k: mot(c.k), x: num(c.x), y: num(c.y), c: num(c.c), m: num(c.m) } };
}
const envoyer = (j, m) => { try { if (j.ws.readyState === 1) j.ws.send(JSON.stringify(m)); } catch { /* client parti */ } };
const diffuser = (r, m) => r.joueurs.forEach(j => envoyer(j, m));
const vue = r => ({ t: 'salle', code: r.code, mode: r.mode, carte: r.carte, lance: r.lance, joueurs: r.joueurs.map((j, slot) => ({ slot, nom: j.nom, eq: j.eq, f: r.fac[j.eq] })) });
function code() { let c; do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); } while (salles.has(c)); return c; }
function fermer(r) { clearInterval(r.timer); salles.delete(r.code); }

function demarrer(r) {
  r.lance = true; r.graine = (Math.random() * 2 ** 31) | 0;
  r.joueurs.forEach((j, slot) => envoyer(j, { t: 'start', graine: r.graine, f: r.fac, carte: r.carte, niv: [2, 2], eq: j.eq, slot, mode: r.mode }));
  r.timer = setInterval(() => { diffuser(r, { t: 'tour', n: ++r.tour, ordres: r.ordres.splice(0, 200) }); }, TOUR_MS);
}

function message(ws, m) {
  const j = ws.joueur, r = j && j.salle;
  if (m.t === 'creer' && !r) {
    const mode = m.mode === '2v2' ? '2v2' : '1v1', c = code();
    const salle = { code: c, mode, max: mode === '2v2' ? 4 : 2, carte: Math.max(0, Math.min(5, m.carte | 0)), joueurs: [], fac: ['fer', 'fer'], ordres: [], tour: 0, lance: false, hashes: new Map() };
    salle.fac[0] = FACTIONS.includes(m.f) ? m.f : 'fer';
    ws.joueur = { ws, nom: String(m.nom || 'Joueur').slice(0, 16), eq: 0, salle }; salle.joueurs.push(ws.joueur); salles.set(c, salle);
    diffuser(salle, vue(salle));
  } else if (m.t === 'rejoindre' && !r) {
    const s = salles.get(String(m.code || '').toUpperCase());
    if (!s || s.lance || s.joueurs.length >= s.max) return envoyer({ ws }, { t: 'erreur', msg: 'Salle introuvable ou complète.' });
    const eq = s.joueurs.length % 2; // 0,1,0,1 : les équipiers partagent la base et l'armée
    if (s.joueurs.length === 1 && FACTIONS.includes(m.f)) s.fac[1] = m.f;
    ws.joueur = { ws, nom: String(m.nom || 'Joueur').slice(0, 16), eq, salle: s }; s.joueurs.push(ws.joueur);
    diffuser(s, vue(s));
  } else if (!r) return;
  else if (m.t === 'demarrer' && r.joueurs[0] === j && !r.lance && r.joueurs.length === r.max) demarrer(r);
  else if (m.t === 'ordre' && r.lance) {
    const now = Date.now(); j.cpt = (now - (j.t0 || 0) > 1000) ? (j.t0 = now, 0) : j.cpt; if (++j.cpt > 40) return; // anti-spam
    const o = nettoyerOrdre(m.ids, m.c); if (o) r.ordres.push({ eq: j.eq, ids: o.ids, c: o.c });
  } else if (m.t === 'hash' && r.lance && Number.isInteger(m.n)) {
    const k = r.hashes.get(m.n); if (k === undefined) { r.hashes.set(m.n, m.h); r.hashes.delete(m.n - 100); }
    else if (k !== m.h) diffuser(r, { t: 'desync', n: m.n });
  } else if (m.t === 'fin' && r.lance) { clearInterval(r.timer); diffuser(r, { t: 'fin' }); }
}

export function attacher(serveur, chemin = '/orbite') {
  // noServer : ne touche qu'à son chemin (avec l'option server, ws refuserait les /ws des autres jeux).
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  serveur.on('upgrade', (req, socket, tete) => {
    if ((req.url || '').split('?')[0] !== chemin) return;
    wss.handleUpgrade(req, socket, tete, ws => wss.emit('connection', ws, req));
  });
  wss.on('connection', ws => {
    ws.on('message', d => { let m; try { m = JSON.parse(d); } catch { return; } if (m && typeof m === 'object') try { message(ws, m); } catch (e) { console.error('orbite:', e.message); } });
    ws.on('close', () => {
      const j = ws.joueur, r = j && j.salle; if (!r) return;
      r.joueurs = r.joueurs.filter(x => x !== j);
      if (!r.joueurs.length) fermer(r); else if (r.lance) diffuser(r, { t: 'depart', nom: j.nom }); else diffuser(r, vue(r));
    });
  });
  return wss;
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const srv = http.createServer((q, p) => { p.writeHead(200); p.end('orbite ok'); });
  attacher(srv); srv.listen(process.env.PORT || 8787, () => console.log('Orbite Noire : serveur sur le port', process.env.PORT || 8787));
}
