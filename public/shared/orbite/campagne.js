// ORBITE NOIRE — campagne (15 missions) : données + évaluation des objectifs. Aucun DOM.
// m = { id, titre, texte, carte, f (faction du joueur), e (ennemi), niv (IA ennemie), obj, opt (options du moteur) }
const M = (id, titre, texte, carte, f, e, niv, obj, opt = {}) => ({ id, titre, texte, carte, f, e, niv, obj, opt });
export const MISSIONS = [
  M(1, 'Premiers Prismes', "Envoie tes ouvriers sur une mine (clic droit sur le losange violet). Récolte 600 Prismes, puis bâtis une Caserne.", 2, 'fer', 'fer', 1, { t: 'eco', v: 600 }),
  M(2, 'Poste avancé', "Les Relais donnent de l'Énergie. Tue les Gardiens qui les protègent, puis garde tes unités dessus pour prendre 2 Relais.", 0, 'fer', 'bosquet', 1, { t: 'relais', v: 2 }),
  M(3, 'Cœur de la Racine', "Monte une armée de fantassins et de tireurs, puis détruis le Cœur ennemi.", 2, 'fer', 'bosquet', 1, { t: 'detruire' }, { pr: [500, 300] }),
  M(4, 'Tenir la Ligne', "Des renforts ennemis arrivent sans fin. Bâtis des Tours et tiens 4 minutes.", 3, 'fer', 'bosquet', 2, { t: 'survivre', v: 240 }, { pr: [500, 300], renfort: { eq: 1, periode: 200, role: 0, n: 2, debut: 600 } }),
  M(5, 'Chute du Noyau', "Les Blindés de l'atelier font la différence. Écrase la défense du Bosquet.", 4, 'fer', 'bosquet', 2, { t: 'detruire' }),
  M(6, 'Racines', "Le Bosquet se régénère près de ses bâtiments : joue la patience. Récolte 1200 Prismes.", 5, 'bosquet', 'fer', 1, { t: 'eco', v: 1200 }),
  M(7, "Le Bosquet s'étend", "Étends-toi sur la carte : prends 3 Relais face aux Échos.", 0, 'bosquet', 'echos', 2, { t: 'relais', v: 3 }),
  M(8, 'Marée de ronces', "La Ligue de Fer déferle. Les Ronces et les Colosses doivent tenir 5 minutes.", 1, 'bosquet', 'fer', 2, { t: 'survivre', v: 300 }, { pr: [500, 300], renfort: { eq: 1, periode: 160, role: 0, n: 2, debut: 400 } }),
  M(9, 'Chasse aux Échos', "Leurs boucliers se rechargent hors combat : ne les laisse pas souffler. Élimine 40 unités.", 3, 'bosquet', 'echos', 2, { t: 'tuer', v: 40 }, { renfort: { eq: 1, periode: 120, role: 0, n: 1 } }),
  M(10, 'La Grande Prairie', "Un Expert t'attend. Utilise ton Champion (l'Ancien soigne tout autour de lui) et brise la Ligue.", 2, 'bosquet', 'fer', 3, { t: 'detruire' }),
  M(11, 'Éveil', "Les Échos démarrent faibles. Récolte 1500 Prismes à l'abri.", 4, 'echos', 'fer', 1, { t: 'eco', v: 1500 }),
  M(12, 'Résonance', "Tes unités frappent plus fort en groupe. Prends les 4 Relais de la Croisée.", 0, 'echos', 'bosquet', 2, { t: 'relais', v: 4 }),
  M(13, 'Le Dernier Rempart', "Des Blindés arrivent par vagues. Tiens 6 minutes.", 5, 'echos', 'fer', 3, { t: 'survivre', v: 360 }, { pr: [600, 300], renfort: { eq: 1, periode: 200, role: 2, n: 1, debut: 1200 } }),
  M(14, 'Éclat contre Fer', "Un Expert de la Ligue. Les boucliers et l'Oracle sont tes meilleurs atouts.", 1, 'echos', 'fer', 3, { t: 'detruire' }),
  M(15, 'Orbite Noire', "Dernière bataille : le Bosquet est renforcé et récolte 40 % de plus. Détruis son Cœur.", 3, 'echos', 'bosquet', 4, { t: 'detruire' }, { pr: [800, 300], bonus: [1, 1.4], depart: [{ eq: 1, role: 0, n: 6 }] }),
];
// état d'une mission : { etat: 'cours' | 'gagne' | 'perdu', texte }
export function etat(s, m) {
  if (s.fin === 1) return { etat: 'perdu', texte: 'Ton noyau est détruit.' };
  if (s.fin === 0) return { etat: 'gagne', texte: 'Base ennemie détruite.' };
  const o = m.obj, tiens = s.relais.filter(r => r.own === 0).length, sec = Math.floor(s.tick / 20);
  const R = {
    detruire: [false, 'Détruis la base ennemie'],
    eco:      [s.tot[0] >= o.v, `Prismes récoltés : ${s.tot[0]} / ${o.v}`],
    relais:   [tiens >= o.v, `Relais tenus : ${tiens} / ${o.v}`],
    survivre: [sec >= o.v, `Tiens : ${Math.max(0, o.v - sec)} s`],
    tuer:     [s.kills[0] >= o.v, `Ennemis éliminés : ${s.kills[0]} / ${o.v}`],
  }[o.t];
  return { etat: R[0] ? 'gagne' : 'cours', texte: R[1] };
}
