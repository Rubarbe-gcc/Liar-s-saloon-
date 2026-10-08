/**
 * RAID — la sauvegarde en ligne, pour jouer la même partie sur plusieurs
 * appareils.
 *
 * Chaque joueur a un « code de synchro » : une clé tirée au hasard, qu'il
 * saisit une fois sur chacun de ses appareils. Sous cette clé, le serveur
 * garde la dernière sauvegarde reçue et sa date ; les appareils la déposent
 * quand ils jouent et la reprennent quand ils s'ouvrent. Le serveur ne lit
 * pas ce qu'il garde.
 *
 * Le même service garde aussi le PROFIL de l'arcade (pseudo, avatar,
 * succès), dans un autre espace : `espace=profil` ; et la progression de
 * STREET COMBAT (`espace=street`), sous le même code. Sans espace, c'est RAID.
 *
 * Il faut un endroit où ranger : une base Redis (Upstash, depuis l'onglet
 * Storage de Vercel), annoncée par ses variables d'environnement. Sans elle,
 * le service répond qu'il n'est pas disponible — sauf sur un poste de
 * développement, où une simple mémoire suffit.
 */

export const LONGUEUR_CLE = 10;
export const CHARGE_MAX = 200 * 1024;
/** Une sauvegarde qu'aucun appareil n'a touchée depuis six mois est oubliée. */
const DUREE_S = 180 * 24 * 3600;

const CLE_VALIDE = /^[A-HJ-NP-Z2-9]{10}$/;
/** Les espaces de rangement : la partie de RAID, le profil de l'arcade, la progression de STREET COMBAT. */
const ESPACES = ['raid', 'profil', 'street'];
const espaceDe = (e) => (ESPACES.includes(e) ? e : 'raid');
export const normaliser = (cle) => String(cle || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const memoire = new Map();

function base() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const jeton = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && jeton) return { url: url.replace(/\/+$/, ''), jeton };
  return null;
}

/** Vrai si une sauvegarde déposée ici sera encore là à la prochaine requête. */
export function disponible() {
  // Sur Vercel, la mémoire d'une Function ne dure pas : sans base, on refuse.
  return !!base() || !process.env.VERCEL;
}

async function redis(commande) {
  const b = base();
  const r = await fetch(b.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${b.jeton}`, 'content-type': 'application/json' },
    body: JSON.stringify(commande),
  });
  if (!r.ok) throw new Error(`base ${r.status}`);
  return (await r.json()).result;
}

async function lire(espace, cle) {
  if (base()) {
    const brut = await redis(['GET', `${espace}:sauvegarde:${cle}`]);
    return brut ? JSON.parse(brut) : null;
  }
  return memoire.get(`${espace}:${cle}`) || null;
}

async function ecrire(espace, cle, valeur) {
  if (base()) await redis(['SET', `${espace}:sauvegarde:${cle}`, JSON.stringify(valeur), 'EX', String(DUREE_S)]);
  else memoire.set(`${espace}:${cle}`, valeur);
}

/**
 * Traite une requête. `corps` est l'objet JSON reçu (pour un dépôt).
 * Renvoie `{ statut, json }`.
 *   GET  ?cle=…&espace=…              → { charge, date } ou 404
 *   PUT  { cle, espace, charge, date } → { ok, date }
 */
export async function traiter({ methode, cle, corps = null, espace = null }) {
  const ici = espaceDe((corps && corps.espace) || espace);
  if (!disponible()) return { statut: 503, json: { erreur: 'stockage', msg: 'La synchronisation n’est pas encore activée sur ce site.' } };
  try {
    if (methode === 'GET') {
      const k = normaliser(cle);
      if (!CLE_VALIDE.test(k)) return { statut: 400, json: { erreur: 'cle', msg: 'Code de synchro invalide.' } };
      const v = await lire(ici, k);
      if (!v) return { statut: 404, json: { erreur: 'inconnu', msg: ici === 'profil' ? 'Aucun profil sous ce code.' : 'Aucune partie sous ce code de synchro.' } };
      return { statut: 200, json: v };
    }
    if (methode === 'PUT' || methode === 'POST') {
      const k = normaliser(corps && corps.cle);
      if (!CLE_VALIDE.test(k)) return { statut: 400, json: { erreur: 'cle', msg: 'Code de synchro invalide.' } };
      const { charge } = corps;
      const date = Number(corps.date);
      if (typeof charge !== 'string' || !charge.length || charge.length > CHARGE_MAX || !Number.isFinite(date)) {
        return { statut: 400, json: { erreur: 'charge', msg: 'Sauvegarde illisible ou trop lourde.' } };
      }
      // La plus récente gagne : un appareil en retard n'écrase pas l'autre.
      const actuelle = await lire(ici, k);
      if (actuelle && actuelle.date > date) return { statut: 409, json: { erreur: 'ancien', ...actuelle } };
      await ecrire(ici, k, { charge, date });
      return { statut: 200, json: { ok: true, date } };
    }
    return { statut: 405, json: { erreur: 'methode' } };
  } catch (err) {
    console.error('[sauvegarde]', err);
    return { statut: 502, json: { erreur: 'base', msg: 'Le stockage ne répond pas. Réessayez dans un instant.' } };
  }
}

/** Pour les tests : repart d'une mémoire vide. */
export function vider() { memoire.clear(); }
