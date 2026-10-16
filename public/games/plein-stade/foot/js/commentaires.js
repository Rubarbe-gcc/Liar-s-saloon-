/**
 * PETIT PONT — ce que disent les commentateurs du foot.
 *
 * Le moteur des voix est commun à tous les sports (commun/commentateur.js) :
 * ici, seulement les phrases, choisies selon les événements du match
 * (shared/foot/match.js) et le contexte (le score, le temps qui reste, le
 * doublé d'un buteur…). Le commentateur suit l'action ; le consultant
 * ajoute parfois son analyse, juste après.
 */

import { creerCommentateur as moteur, reglage, regler, REGLAGES } from '../../commun/commentateur.js';

export { reglage, regler, REGLAGES };

const nomCourt = (n) => n.split(' ').slice(-1)[0];
const parfois = (p) => Math.random() < p;

/**
 * Le commentateur d'un match. ctx : { nom(id) → nom complet, equipe(e) → équipe, stade, el }
 */
export function creerCommentateur(ctx) {
  const C = moteur({ el: ctx.el, noms: { comm: 'Commentaire', cons: 'Consultant' } });
  const ch = (cle, l) => C.choisir(cle, l);
  let dejaTrente = false, dejaDix = false;
  const n = (id) => (id >= 0 ? `<b>${nomCourt(ctx.nom(id))}</b>` : '');
  const eq = (e) => ctx.equipe(e).court;

  /** Le nombre de buts d'un joueur dans ce match (contre son camp exclu). */
  const butsDe = (m, id) => m.buts.filter((b) => b.j === id && !b.csc).length;

  return {
    avancer(dt, m) {
      if (m.mi !== 2 || m.phase !== 'jeu' || m.duree < 60 * 60) return;
      const reste = (m.duree - m.chrono) / 60;
      const ecart = m.score[0] - m.score[1];
      if (!dejaTrente && reste < 30) {
        dejaTrente = true;
        C.dire(ecart === 0 ? ch('30nul', ['Plus que trente secondes, et tout est encore possible !', 'Trente secondes ! Qui va faire la différence ?'])
          : ch('30', [`Plus que trente secondes pour ${eq(ecart > 0 ? 1 : 0)} !`, 'Trente secondes à jouer, ça pousse !']), { important: true, emotion: 0.6, clip: 'trente_secondes' });
      } else if (!dejaDix && reste < 10) {
        dejaDix = true;
        C.dire(ch('10', ['Dix secondes !', 'Les dernières secondes !', 'C’est la dernière action !']), { important: true, emotion: 0.8 });
      }
    },
    debut() {
      const [a, b] = [ctx.equipe(0), ctx.equipe(1)];
      C.dire(ch('debut', [
        `Bonsoir et bienvenue ${ctx.stade} pour ce ${a.court} – ${b.court} !`,
        `C’est l’heure ${ctx.stade} : ${a.nom} face à ${b.nom} !`,
        `Ambiance des grands soirs ${ctx.stade} pour ${a.court} contre ${b.court} !`,
      ]), {
        important: true, emotion: 0.5, clip: 'bienvenue',
        apres: ch('debut-cons', [`${a.court} joue « ${a.devise} » : on va voir si c’est vrai ce soir.`, `Attention à ${b.court}, une équipe qui ne lâche jamais rien.`, 'Deux styles très différents, ça promet.']),
      });
    },
    evenement(ev, m) {
      switch (ev.type) {
        case 'tir':
          if (m.phase === 'tab') return;
          if (ev.geste === 'volee') return C.dire(ch('volee', [`Reprise de volée de ${n(ev.joueur)} !!`, `${n(ev.joueur)} la reprend de volée !`, `Quelle volée de ${n(ev.joueur)} !`]), { important: true, emotion: 0.9, clip: 'volee' });
          if (ev.geste === 'premiere') return C.dire(ch('premiere', [`${n(ev.joueur)} frappe en une touche !`, `Du premier coup, ${n(ev.joueur)} !`]), { important: true, emotion: 0.7 });
          if (ev.distance > 15) return C.dire(ch('loin', [`${n(ev.joueur)} tente sa chance de loin…`, `Frappe lointaine de ${n(ev.joueur)} !`, `${n(ev.joueur)} déclenche de très loin !`, `De loin, ${n(ev.joueur)}… pourquoi pas !`]), { emotion: 0.5, clip: 'frappe' });
          if (ev.puissance > 0.85) return C.dire(ch('fort', [`Une mine de ${n(ev.joueur)} !`, `${n(ev.joueur)} frappe fort !`, `Quelle frappe de ${n(ev.joueur)} !`, `${n(ev.joueur)} arme une frappe terrible !`]), { emotion: 0.6, clip: 'frappe' });
          return C.dire(ch('tir', [`${n(ev.joueur)} frappe !`, `Tir de ${n(ev.joueur)}…`, `${n(ev.joueur)} tente le cadre !`, `${n(ev.joueur)} essaie !`, `C’est ${n(ev.joueur)} qui frappe !`]), { emotion: 0.45 });
        case 'passe':
          if (ev.lob && parfois(0.35)) C.dire(ch('lob', [`${n(ev.joueur)} cherche ${n(ev.cible)} par-dessus…`, `Ballon piqué de ${n(ev.joueur)}.`, `${n(ev.joueur)} lève la tête et envoie loin devant.`]));
          return;
        case 'arret':
          if (m.phase === 'tab') return C.dire(ch('tab-arret', [`${n(ev.joueur)} détourne la tentative !`, `Arrêté par ${n(ev.joueur)} !`, `${n(ev.joueur)} a deviné !`]), { important: true, emotion: 0.85, clip: 'arret' });
          if (ev.capte) {
            return C.dire(ch('capte', [`Bien capté par ${n(ev.joueur)}.`, `${n(ev.joueur)} s’interpose et bloque le ballon.`, `Pas de souci pour ${n(ev.joueur)}.`, `${n(ev.joueur)} se couche bien.`]), {
              emotion: 0.4, apres: parfois(0.3) ? ch('capte-cons', ['Il fallait mieux la placer.', 'Pas assez appuyée, cette frappe.', 'Le gardien était bien placé.']) : null,
            });
          }
          return C.dire(ch('parade', [`Parade de ${n(ev.joueur)} !`, `Quel réflexe de ${n(ev.joueur)} !`, `${n(ev.joueur)} repousse !`, `Énorme ${n(ev.joueur)} !`]), {
            important: true, emotion: 0.85, clip: 'arret',
            apres: parfois(0.5) ? ch('parade-cons', ['Grosse parade, il a lu la trajectoire jusqu’au bout.', 'Il sauve son équipe, là.', 'Celle-là, elle valait un but.']) : null,
          });
        case 'poteau':
          return C.dire(ev.barre ? ch('barre', ['Sur la barre !!', 'La transversale tremble encore !', 'La barre ! Il n’y avait qu’un centimètre !']) : ch('poteau', ['Sur le poteau !!', 'Le poteau sauve le gardien !', 'Poteau ! Quelle malchance !']), {
            important: true, emotion: 0.9, clip: ev.barre ? 'barre' : 'poteau', apres: parfois(0.5) ? ch('poteau-cons', ['Le football, c’est une question de centimètres.', 'Il fallait la mettre au fond !', 'Il y avait la place de l’autre côté.']) : null,
          });
        case 'tacle':
          if (ev.reussi) return C.dire(ch('tacle', [`Tacle parfait de ${n(ev.joueur)} !`, `${n(ev.joueur)} récupère proprement.`, `Superbe intervention de ${n(ev.joueur)}.`, `${n(ev.joueur)} glisse et prend tout le ballon.`]), { clip: 'tacle' });
          return C.dire(ch('tacle-rate', [`${n(ev.joueur)} arrive trop tard…`, `${n(ev.joueur)} manque son tacle.`, `Raté pour ${n(ev.joueur)}, il est au sol.`]));
        case 'vol':
          return C.dire(ch('vol', [`${n(ev.joueur)} chipe le ballon à ${n(ev.victime)}.`, `Bien joué ${n(ev.joueur)}, ballon récupéré.`, `${n(ev.joueur)} gagne son duel.`]));
        case 'geste':
          if (ev.nom === 'arc-en-ciel') return C.dire(ch('arc', [`Un arc-en-ciel de ${n(ev.joueur)} !! Le public se lève !`, `Par-dessus la tête ! L’arc-en-ciel de ${n(ev.joueur)} !`, `Quelle audace, ${n(ev.joueur)} ! Un arc-en-ciel !`]), { important: true, emotion: 0.9, clip: 'arc_en_ciel', apres: parfois(0.5) ? 'Il faut oser faire ça en match !' : null });
          return C.dire(ch('roulette', [`Roulette de ${n(ev.joueur)} !`, `${n(ev.joueur)} tourne autour de son adversaire !`, `Superbe roulette de ${n(ev.joueur)}.`, `${n(ev.joueur)} efface son vis-à-vis d’une roulette !`]), { emotion: 0.6, clip: 'roulette' });
        case 'but': {
          const e = ev.equipe;
          const [s, t] = [m.score[e], m.score[1 - e]];
          const etat = s === t ? `${eq(e)} égalise !` : s === t + 1 ? `${eq(e)} passe devant !` : `${eq(e)} creuse l’écart !`;
          if (ev.csc) return C.dire(`Contre son camp de ${n(ev.joueur)}… cruel ! ${etat}`, { important: true, emotion: 0.8, clip: 'but', apres: 'Ça arrive, mais à ce moment-là, ça fait mal.' });
          const nb = butsDe(m, ev.joueur);
          const qui = nb === 2 ? `Et c’est le doublé pour ${n(ev.joueur)} !` : nb === 3 ? `TRIPLÉ !! ${n(ev.joueur)} entre dans l’histoire !` : nb > 3 ? `${n(ev.joueur)} est intenable, c’est son ${nb}e !` : ch('but', [`BUT de ${n(ev.joueur)} !!!`, `GOAAAL ! ${n(ev.joueur)} !`, `C’est au fond ! ${n(ev.joueur)} !`, `Il marque ! ${n(ev.joueur)} !`]);
          const passe = ev.passeur >= 0 ? ch('passe-dec', [` Sur un service de ${n(ev.passeur)}.`, ` Bien servi par ${n(ev.passeur)}.`, ` Quelle passe de ${n(ev.passeur)} !`]) : '';
          return C.dire(`${qui} ${etat}${passe}`, {
            important: true, emotion: 1, clip: 'but',
            apres: ch('but-cons', ['Quelle finition !', 'La défense a dormi sur ce coup-là.', 'Imparable pour le gardien.', 'Ça, c’est un but de grand joueur.', 'Tout est allé très vite, magnifique.']),
          });
        }
        case 'mitemps': {
          const st = m.stats;
          const p0 = Math.round((st.possession[0] / Math.max(1, st.possession[0] + st.possession[1])) * 100);
          const dom = p0 >= 55 ? 0 : p0 <= 45 ? 1 : -1;
          return C.dire(`C’est la pause. ${eq(0)} ${m.score[0]} – ${m.score[1]} ${eq(1)}.`, {
            important: true, emotion: 0.5, clip: 'mi_temps',
            apres: dom >= 0 ? `${eq(dom)} a eu le ballon plus souvent : ${dom === 0 ? p0 : 100 - p0} % de possession.` : 'Un match très équilibré pour l’instant.',
          });
        }
        case 'reprise':
          return C.dire(ch('reprise', ['Les deux équipes reviennent pour la seconde période !', 'C’est reparti pour la deuxième mi-temps !', 'Deuxième mi-temps ! Tout reste à faire.']), { important: true, emotion: 0.5, clip: 'reprise' });
        case 'tab':
          return C.dire('Égalité ! Place à la loterie des tirs au but…', { important: true, emotion: 0.7, clip: 'tirs_au_but', apres: 'Maintenant, c’est une question de nerfs.' });
        case 'tab-but':
          return C.dire(ch('tab-but', [`${n(ev.joueur)} ne tremble pas !`, `Transformé par ${n(ev.joueur)} !`, `Dans le coin, ${n(ev.joueur)} !`]), { important: true, emotion: 0.8, clip: 'tab_marque' });
        case 'tab-rate':
          return C.dire(ch('tab-rate', [`${n(ev.joueur)} manque le cadre !`, `À côté pour ${n(ev.joueur)}…`, `Oh non, ${n(ev.joueur)} !`]), { important: true, emotion: 0.8, clip: 'tab_rate' });
        case 'fin': {
          const v = ev.vainqueur;
          if (v < 0) return C.dire(`C’est terminé : match nul, ${m.score[0]} partout.`, { important: true, emotion: 0.6, clip: 'match_nul', apres: 'Un partage des points logique.' });
          return C.dire(`C’est terminé ! Victoire de ${ctx.equipe(v).nom}${ev.tab ? ' aux tirs au but' : ''} !`, { important: true, emotion: 0.9, clip: 'victoire', apres: ch('fin-cons', ['Une victoire méritée.', 'Ils ont su faire la différence au bon moment.', 'Quelle soirée pour eux !']) });
        }
        default:
      }
    },
    /** Pour les cinématiques : une phrase libre. */
    dire: (texte, o) => C.dire(texte, o),
    arreter() { C.arreter(); },
  };
}
