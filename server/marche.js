/**
 * MAXI MENU — le marché : vendre ses cartes aux autres joueurs.
 *
 * Une annonce = une carte et son prix en frites d'or (borné autour de la valeur
 * de la carte : shared/maximenu/marche.js). La carte quitte la collection du
 * vendeur quand il la met en vente ; l'acheteur paie et la reçoit ; le vendeur
 * touche ses frites à sa prochaine visite (`compte`). Une annonce non vendue
 * au bout de DUREE_ANNONCE revient au vendeur.
 *
 * Le vendeur est reconnu par un secret tiré au hasard et gardé dans son
 * navigateur ; le serveur ne garde que son empreinte (`v`).
 *
 * Rangement : la même base Redis que la sauvegarde en ligne (server/sauvegarde.js),
 * ou une simple mémoire sur un poste de développement.
 *   mm:annonces          hash  id → annonce (JSON)
 *   mm:mes:<v>           set   ids des annonces du vendeur
 *   mm:gains:<v>         frites à toucher
 *   mm:ventes:<v>        list  ventes à annoncer au vendeur
 *
 * Requêtes : GET → { annonces } ; POST { a: 'vendre' | 'retirer' | 'acheter' | 'compte', secret, … }.
 */

import crypto from 'node:crypto';
import { base, redis } from './sauvegarde.js';
import { PAR_ID } from '../public/shared/maximenu/cartes.js';
import { prixValide, ANNONCES_MAX, DUREE_ANNONCE } from '../public/shared/maximenu/marche.js';

const TOTAL_MAX = 3000;
const GARDE_S = 180 * 24 * 3600;

/* ------------------------------------------------------------ rangement */
const mem = new Map();
const local = () => !base();
const kv = {
  async hgetall(k) { if (local()) return Object.fromEntries(mem.get(k) || []); const r = await redis(['HGETALL', k]) || []; const o = {}; for (let i = 0; i < r.length; i += 2) o[r[i]] = r[i + 1]; return o; },
  async hget(k, f) { if (local()) return (mem.get(k) || new Map()).get(f) ?? null; return redis(['HGET', k, f]); },
  async hset(k, f, v) { if (local()) { if (!mem.has(k)) mem.set(k, new Map()); mem.get(k).set(f, v); return 1; } return redis(['HSET', k, f, v]); },
  async hdel(k, f) { if (local()) { const m = mem.get(k); return m && m.delete(f) ? 1 : 0; } return redis(['HDEL', k, f]); },
  async hlen(k) { if (local()) return (mem.get(k) || new Map()).size; return redis(['HLEN', k]); },
  async sadd(k, v) { if (local()) { if (!mem.has(k)) mem.set(k, new Set()); mem.get(k).add(v); return 1; } await redis(['SADD', k, v]); return redis(['EXPIRE', k, String(GARDE_S)]); },
  async srem(k, v) { if (local()) { mem.get(k)?.delete(v); return 1; } return redis(['SREM', k, v]); },
  async smembers(k) { if (local()) return [...(mem.get(k) || [])]; return await redis(['SMEMBERS', k]) || []; },
  async incrby(k, n) { if (local()) { mem.set(k, (mem.get(k) || 0) + n); return mem.get(k); } const r = await redis(['INCRBY', k, String(n)]); await redis(['EXPIRE', k, String(GARDE_S)]); return r; },
  async getdel(k) { if (local()) { const v = mem.get(k) ?? null; mem.delete(k); return v; } return redis(['GETDEL', k]); },
  async lpush(k, v) { if (local()) { if (!mem.has(k)) mem.set(k, []); mem.get(k).unshift(v); mem.get(k).length = Math.min(mem.get(k).length, 20); return 1; } await redis(['LPUSH', k, v]); await redis(['LTRIM', k, '0', '19']); return redis(['EXPIRE', k, String(GARDE_S)]); },
  async lprendre(k) { if (local()) { const v = mem.get(k) || []; mem.delete(k); return v; } const v = await redis(['LRANGE', k, '0', '19']) || []; await redis(['DEL', k]); return v; },
};

/* ------------------------------------------------------------ règles */
const empreinte = secret => crypto.createHash('sha256').update(String(secret)).digest('hex').slice(0, 20);
const secretValide = s => typeof s === 'string' && /^[A-Za-z0-9]{24,64}$/.test(s);
const nomPropre = n => String(n || '').replace(/[<>&"]/g, '').trim().slice(0, 20) || 'Joueur';
const lireAnnonce = brut => { try { return brut ? JSON.parse(brut) : null; } catch { return null; } };
const expiree = (a, t) => t - a.quand > DUREE_ANNONCE;
const publique = a => ({ id: a.id, carte: a.carte, prix: a.prix, nom: a.nom, quand: a.quand, v: a.v });

export async function traiter({ methode, corps, maintenant = Date.now() }) {
  if (process.env.VERCEL && !base()) return { statut: 503, json: { erreur: 'stockage', msg: 'Le marché n’est pas encore ouvert sur ce site.' } };
  try {
    if (methode === 'GET') {
      const tout = await kv.hgetall('mm:annonces');
      const annonces = Object.values(tout).map(lireAnnonce).filter(a => a && !expiree(a, maintenant)).sort((a, b) => b.quand - a.quand).map(publique);
      return { statut: 200, json: { annonces } };
    }
    if (methode !== 'POST') return { statut: 405, json: { erreur: 'methode' } };
    const c = corps || {};
    if (!secretValide(c.secret)) return { statut: 400, json: { erreur: 'secret', msg: 'Identité de vendeur invalide.' } };
    const v = empreinte(c.secret);

    if (c.a === 'vendre') {
      const prix = Number(c.prix);
      if (!PAR_ID.has(c.carte) || !prixValide(c.carte, prix)) return { statut: 400, json: { erreur: 'prix', msg: 'Prix hors des limites pour cette carte.' } };
      const mes = await kv.smembers(`mm:mes:${v}`);
      if (mes.length >= ANNONCES_MAX) return { statut: 409, json: { erreur: 'trop', msg: `${ANNONCES_MAX} annonces au plus en même temps.` } };
      if (await kv.hlen('mm:annonces') >= TOTAL_MAX) return { statut: 409, json: { erreur: 'plein', msg: 'Le marché est plein, réessayez plus tard.' } };
      const a = { id: crypto.randomBytes(6).toString('hex'), carte: c.carte, prix, nom: nomPropre(c.nom), quand: maintenant, v };
      await kv.hset('mm:annonces', a.id, JSON.stringify(a));
      await kv.sadd(`mm:mes:${v}`, a.id);
      return { statut: 200, json: { ok: true, annonce: publique(a) } };
    }

    if (c.a === 'retirer') {
      const a = lireAnnonce(await kv.hget('mm:annonces', String(c.id)));
      if (!a || a.v !== v) return { statut: 404, json: { erreur: 'inconnue', msg: 'Annonce introuvable (déjà vendue ?).' } };
      if (!await kv.hdel('mm:annonces', a.id)) return { statut: 409, json: { erreur: 'vendue', msg: 'Trop tard : la carte vient d’être vendue.' } };
      await kv.srem(`mm:mes:${v}`, a.id);
      return { statut: 200, json: { ok: true, carte: a.carte } };
    }

    if (c.a === 'acheter') {
      const a = lireAnnonce(await kv.hget('mm:annonces', String(c.id)));
      if (!a || expiree(a, maintenant)) return { statut: 404, json: { erreur: 'inconnue', msg: 'Cette carte n’est plus en vente.' } };
      if (a.v === v) return { statut: 400, json: { erreur: 'soi', msg: 'C’est votre propre annonce.' } };
      // HDEL est atomique : un seul acheteur l'emporte.
      if (!await kv.hdel('mm:annonces', a.id)) return { statut: 409, json: { erreur: 'vendue', msg: 'Quelqu’un a été plus rapide : carte déjà vendue.' } };
      await kv.srem(`mm:mes:${a.v}`, a.id);
      await kv.incrby(`mm:gains:${a.v}`, a.prix);
      await kv.lpush(`mm:ventes:${a.v}`, JSON.stringify({ carte: a.carte, prix: a.prix, acheteur: nomPropre(c.nom), quand: maintenant }));
      return { statut: 200, json: { ok: true, carte: a.carte, prix: a.prix } };
    }

    if (c.a === 'compte') {
      const annonces = [], retours = [];
      for (const id of await kv.smembers(`mm:mes:${v}`)) {
        const a = lireAnnonce(await kv.hget('mm:annonces', id));
        if (!a) { await kv.srem(`mm:mes:${v}`, id); continue; }
        if (expiree(a, maintenant)) { if (await kv.hdel('mm:annonces', id)) retours.push(a.carte); await kv.srem(`mm:mes:${v}`, id); continue; }
        annonces.push(publique(a));
      }
      const gains = Number(await kv.getdel(`mm:gains:${v}`)) || 0;
      const ventes = (await kv.lprendre(`mm:ventes:${v}`)).map(lireAnnonce).filter(Boolean);
      return { statut: 200, json: { ok: true, v, annonces, retours, gains, ventes } };
    }
    return { statut: 400, json: { erreur: 'action' } };
  } catch (err) {
    console.error('[marche]', err);
    return { statut: 502, json: { erreur: 'base', msg: 'Le marché ne répond pas. Réessayez dans un instant.' } };
  }
}

/** Pour les tests : repart d'un marché vide. */
export function vider() { mem.clear(); }
