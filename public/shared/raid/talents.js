/**
 * RAID — les arbres de talents.
 *
 * Chaque niveau gagné donne un point. Chaque rôle a deux branches de trois
 * talents, à trois rangs chacun : on ne peut pas tout prendre, il faut
 * choisir ce que le personnage devient. Un palier s'ouvre quand le palier
 * précédent de sa branche a reçu deux points.
 *
 * Les effets parlent deux vocabulaires :
 *   • statistiques, lues par `personnages.statsDe` :
 *       atk, def, pv (parts) · pm, vit, crit (points) ;
 *   • combat, lus par `bataille.js` :
 *       sorts    part de dégâts en plus sur les sorts ;
 *       soins    part de soins en plus sur les sorts de soin ;
 *       pmTour   PM rendus au début de chacun de ses tours ;
 *       vampire  part des dégâts d'une attaque simple rendue en vie ;
 *       reduc    part des dégâts subis en moins ;
 *       epines   part des dégâts subis renvoyée à l'attaquant.
 *
 * Module ISO : ni DOM ni Node.
 */

export const RANG_MAX = 3;
/** Points qu'il faut dans un palier pour ouvrir le suivant de la branche. */
export const SEUIL_PALIER = 2;

const t = (id, nom, glyphe, effet) => ({ id, nom, glyphe, effet });

export const ARBRES = {
  tank: [
    { nom: 'Rempart', glyphe: '🛡', talents: [
      t('peau', 'Peau de fer', '❤️', { pv: 0.06 }),
      t('bastion', 'Bastion', '🧱', { def: 0.08 }),
      t('inebranlable', 'Inébranlable', '⛰', { reduc: 0.04 }),
    ] },
    { nom: 'Fureur', glyphe: '🪓', talents: [
      t('poigne', 'Poigne', '✊', { atk: 0.06 }),
      t('souffle', 'Second souffle', '🌬', { pmTour: 1 }),
      t('represailles', 'Représailles', '🌵', { epines: 0.08 }),
    ] },
  ],
  dps: [
    { nom: 'Lame', glyphe: '🗡', talents: [
      t('affutage', 'Affûtage', '⚔', { atk: 0.05 }),
      t('oeil', 'Œil vif', '🎯', { crit: 3 }),
      t('execution', 'Exécution', '💥', { sorts: 0.08 }),
    ] },
    { nom: 'Ombre', glyphe: '🌑', talents: [
      t('celerite', 'Célérité', '💨', { vit: 1 }),
      t('soif', 'Soif de sang', '🩸', { vampire: 0.07 }),
      t('concentration', 'Concentration', '🔷', { pmTour: 1 }),
    ] },
  ],
  soigneur: [
    { nom: 'Grâce', glyphe: '✚', talents: [
      t('main', 'Main douce', '🤲', { soins: 0.1 }),
      t('source', 'Source', '💧', { pm: 4 }),
      t('meditation', 'Méditation', '🧘', { pmTour: 1 }),
    ] },
    { nom: 'Châtiment', glyphe: '⚡', talents: [
      t('chatiment', 'Châtiment', '⚡', { atk: 0.07 }),
      t('vitalite', 'Vitalité', '❤️', { pv: 0.06 }),
      t('ferveur', 'Ferveur', '🎯', { crit: 3 }),
    ] },
  ],
};

const TOUS = Object.values(ARBRES).flat().flatMap((b) => b.talents);
export const TALENTS_PAR_ID = Object.fromEntries(TOUS.map((x) => [x.id, x]));

export const rangDe = (p, id) => (p.talents && p.talents[id]) || 0;
export const pointsDepenses = (p) => Object.values(p.talents || {}).reduce((s, n) => s + n, 0);
/** Points à dépenser : un par niveau gagné. */
export const pointsLibres = (p) => Math.max(0, p.niveau - 1 - pointsDepenses(p));

/** Où se trouve un talent dans l'arbre de son rôle. */
function place(role, id) {
  for (const branche of ARBRES[role] || []) {
    const palier = branche.talents.findIndex((x) => x.id === id);
    if (palier >= 0) return { branche, palier };
  }
  return null;
}

/** Peut-on mettre un point de plus dans ce talent ? Renvoie la raison sinon. */
export function peutApprendre(p, id) {
  const ou = place(p.role, id);
  if (!ou) return { ok: false, raison: 'pas un talent de ce rôle' };
  if (pointsLibres(p) <= 0) return { ok: false, raison: 'aucun point à dépenser' };
  if (rangDe(p, id) >= RANG_MAX) return { ok: false, raison: 'rang maximum' };
  if (ou.palier > 0 && rangDe(p, ou.branche.talents[ou.palier - 1].id) < SEUIL_PALIER) {
    return { ok: false, raison: `il faut ${SEUIL_PALIER} points dans ${ou.branche.talents[ou.palier - 1].nom}` };
  }
  return { ok: true };
}

export function apprendre(p, id) {
  const r = peutApprendre(p, id);
  if (!r.ok) return r;
  p.talents = { ...(p.talents || {}), [id]: rangDe(p, id) + 1 };
  return { ok: true, rang: p.talents[id] };
}

/** La somme des effets de tous les talents appris. */
export function effetsTalents(p) {
  const out = {};
  for (const [id, rang] of Object.entries(p.talents || {})) {
    const tal = TALENTS_PAR_ID[id];
    if (!tal) continue;
    for (const [k, v] of Object.entries(tal.effet)) out[k] = (out[k] || 0) + v * rang;
  }
  return out;
}

const pc = (v) => `${Math.round(v * 100)} %`;
const TEXTES = {
  atk: (v) => `+${pc(v)} d’attaque`,
  def: (v) => `+${pc(v)} d’armure`,
  pv: (v) => `+${pc(v)} de vie`,
  pm: (v) => `+${v} PM max`,
  vit: (v) => `+${v} de vitesse`,
  crit: (v) => `+${v} % de critique`,
  sorts: (v) => `+${pc(v)} de dégâts des sorts`,
  soins: (v) => `+${pc(v)} aux soins lancés`,
  pmTour: (v) => `+${v} PM à chaque tour`,
  vampire: (v) => `une attaque simple rend ${pc(v)} des dégâts en vie`,
  reduc: (v) => `−${pc(v)} de dégâts subis`,
  epines: (v) => `renvoie ${pc(v)} des dégâts subis`,
};

/** Ce que donne un talent à un rang donné (un rang par défaut), en clair. */
export function texteTalent(tal, rang = 1) {
  return Object.entries(tal.effet).map(([k, v]) => (TEXTES[k] ? TEXTES[k](+(v * rang).toFixed(2)) : k)).join(', ');
}

/** Dépense les points d'un personnage tout seul (pour le joueur automatique). */
export function repartir(p) {
  let fait = 0;
  for (let garde = 0; garde < 40 && pointsLibres(p) > 0; garde++) {
    const dispo = (ARBRES[p.role] || []).flatMap((b) => b.talents).find((x) => peutApprendre(p, x.id).ok);
    if (!dispo) break;
    apprendre(p, dispo.id);
    fait++;
  }
  return fait;
}
