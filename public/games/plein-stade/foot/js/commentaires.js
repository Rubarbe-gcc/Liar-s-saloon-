/**
 * PETIT PONT — ce que disent les commentateurs du foot.
 *
 * Le moteur des voix est commun à tous les sports (commun/commentateur.js) :
 * ici, seulement les phrases, choisies selon les événements du match
 * (shared/foot/match.js) et le contexte (le score, le temps qui reste, le
 * doublé d'un buteur…). Le commentateur suit l'action en direct, comme à la
 * télé : chaque passe, chaque duel, où en est le porteur du ballon ; le
 * consultant ajoute son analyse dans les temps calmes.
 */

import { creerCommentateur as moteur, reglage, regler, REGLAGES } from '../../commun/commentateur.js';
import { DEMI_L } from '../../../../shared/foot/terrain.js';

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
  // Le direct : qui a le ballon depuis quand, ce qu'on en a déjà dit.
  let equipePoss = -1, debutPoss = 0, ditPoss = false, dernierEtat = '', tEtat = 0, tCons = 0, tPressing = -1e9, tirEnVol = -1e9;
  /** Une phrase du direct : elle ne vaut que sur le moment. */
  const direct = (texte, clip, o = {}) => C.dire(texte, { frais: true, emotion: 0.35, clip, ...o });
  /** Où est le joueur : -1 dans son camp, 0 au milieu, 1 près du but adverse. */
  const zone = (m, p) => { const x = (p.x * m.equipes[p.e].sens) / DEMI_L; return x > 0.45 ? 1 : x < -0.35 ? -1 : 0; };
  const n = (id) => (id >= 0 ? `<b>${nomCourt(ctx.nom(id))}</b>` : '');
  const eq = (e) => ctx.equipe(e).court;

  /** Le nombre de buts d'un joueur dans ce match (contre son camp exclu). */
  const butsDe = (m, id) => m.buts.filter((b) => b.j === id && !b.csc).length;

  return {
    avancer(dt, m) {
      if (m.phase !== 'jeu') return;
      this.direct(m);
      if (m.mi !== 2 || m.duree < 60 * 60) return;
      const reste = (m.duree - m.chrono) / 60;
      const ecart = m.score[0] - m.score[1];
      if (!dejaTrente && reste < 30) {
        dejaTrente = true;
        C.dire(ecart === 0 ? ch('30nul', ['Plus que trente secondes, et tout est encore possible !', 'Trente secondes ! Qui va faire la différence ?'])
          : ch('30', [`Plus que trente secondes pour ${eq(ecart > 0 ? 1 : 0)} !`, 'Trente secondes à jouer, ça pousse !']), { important: true, emotion: 0.6, clip: 'trente_secondes' });
      } else if (!dejaDix && reste < 10) {
        dejaDix = true;
        C.dire(ch('10', ['Dix secondes !', 'Les dernières secondes !', 'C’est la dernière action !']), { important: true, emotion: 0.8, clip: 'dix_secondes' });
      }
    },
    /** Dans les blancs : où en est l'action, et de temps en temps l'avis du consultant. */
    direct(m) {
      const b = m.ballon, p = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
      if (p && p.e !== equipePoss) { equipePoss = p.e; debutPoss = m.chrono; ditPoss = false; }
      if (!C.libre(600)) return;
      // Le consultant, toutes les quinze secondes de jeu environ, quand c'est calme.
      if (m.chrono - tCons > 15 * 60 && C.libre(1200) && (!p || zone(m, p) < 1)) {
        tCons = m.chrono;
        const [texte, clip] = this.analyse(m);
        return C.dire(texte, { role: 'cons', emotion: 0.3, clip });
      }
      if (!p) return;
      const z = zone(m, p), cle = `${p.id}:${p.i === 0 ? 'g' : z}`;
      if (cle === dernierEtat && m.chrono - tEtat < 4 * 60) return;
      dernierEtat = cle; tEtat = m.chrono;
      const qui = n(p.id);
      if (p.i === 0) return p.etat === 'tient' ? direct(ch('g-tient', [`${qui} a le ballon en main.`, `${qui} temporise.`, `${qui} observe.`]), 'gardien_tient') : undefined;
      if (!ditPoss && m.chrono - debutPoss > 9 * 60) { ditPoss = true; return direct(ch('poss', [`${eq(p.e)} fait tourner.`, `${eq(p.e)} garde bien le ballon.`, `${eq(p.e)} confisque le ballon !`]), 'possession'); }
      if (z === 1) return direct(ch('att', [`Attention, ${qui} devient dangereux !`, `${qui} arrive aux abords de la surface !`, `${qui} peut frapper !`, `Gros danger avec ${qui} !`]), 'attaque', { emotion: 0.6 });
      if (z === -1) return direct(ch('constr', [`${eq(p.e)} repart de derrière.`, `${qui} prend son temps.`, `${eq(p.e)} construit patiemment.`]), 'construction', { emotion: 0.2 });
      return direct(ch('cond', [`${qui} avance avec le ballon.`, `${qui} prend le couloir.`, `${qui} remonte le terrain.`, `${qui} accélère !`, `${qui} cherche une solution.`]), 'conduite');
    },
    /** Ce que pense le consultant du match, là, maintenant : [texte, famille de répliques]. */
    analyse(m) {
      const st = m.stats, p0 = st.possession[0] / Math.max(1, st.possession[0] + st.possession[1]);
      const ecart = m.score[0] - m.score[1], tard = m.mi === 2 && m.duree - m.chrono < 60 * 60;
      if (tard && ecart === 0) return [ch('a-serre', ['Ça se joue sur un détail.', 'Personne ne veut perdre.']), 'cons_serre'];
      if (m.mi === 2 && ecart !== 0 && parfois(0.5)) {
        const e = ecart > 0 ? 1 : 0;
        return [ch('a-mene', [`${eq(e)} doit réagir, maintenant.`, `Il va falloir prendre des risques pour ${eq(e)}.`, `Le temps joue contre ${eq(e)}.`]), 'cons_mene'];
      }
      if ((p0 > 0.6 || p0 < 0.4) && parfois(0.5)) {
        const d = p0 > 0.5 ? 0 : 1;
        return [ch('a-dom', [`${eq(d)} a la main sur ce match.`, `${eq(d)} domine, mais il faut concrétiser.`, `${eq(1 - d)} subit.`]), 'cons_domine'];
      }
      return [ch('a', ['Ils cherchent la faille.', 'C’est très tactique.', 'Il faut plus de mouvement devant.', 'La défense est bien en place.', 'Il manque de la vitesse dans les transmissions.', 'On sent qu’il peut se passer quelque chose.', 'Le milieu de terrain est très disputé.', 'Il faut tenter sa chance, maintenant.', 'Ils jouent juste, c’est propre.', 'Attention aux contres.']), 'cons_analyse'];
    },
    debut() {
      const [a, b] = [ctx.equipe(0), ctx.equipe(1)];
      C.dire(ch('debut', [
        `Bonsoir et bienvenue ${ctx.stade} pour ce ${a.court} – ${b.court} !`,
        `C’est l’heure ${ctx.stade} : ${a.nom} face à ${b.nom} !`,
        `Ambiance des grands soirs ${ctx.stade} pour ${a.court} contre ${b.court} !`,
      ]), {
        important: true, emotion: 0.5, clip: 'bienvenue',
        apresClip: 'cons_debut', apres: ch('debut-cons', [`${a.court} joue « ${a.devise} » : on va voir si c’est vrai ce soir.`, `Attention à ${b.court}, une équipe qui ne lâche jamais rien.`, 'Deux styles très différents, ça promet.']),
      });
    },
    evenement(ev, m) {
      switch (ev.type) {
        case 'tir':
          if (m.phase === 'tab') return;
          tirEnVol = performance.now();
          if (ev.geste === 'volee') return C.dire(ch('volee', [`Reprise de volée de ${n(ev.joueur)} !!`, `${n(ev.joueur)} la reprend de volée !`, `Quelle volée de ${n(ev.joueur)} !`]), { important: true, emotion: 0.9, clip: 'volee' });
          if (ev.geste === 'premiere') return C.dire(ch('premiere', [`${n(ev.joueur)} frappe en une touche !`, `Du premier coup, ${n(ev.joueur)} !`]), { important: true, emotion: 0.7, clip: 'premiere' });
          if (ev.distance > 15) return C.dire(ch('loin', [`${n(ev.joueur)} tente sa chance de loin…`, `Frappe lointaine de ${n(ev.joueur)} !`, `${n(ev.joueur)} déclenche de très loin !`, `De loin, ${n(ev.joueur)}… pourquoi pas !`]), { emotion: 0.5, clip: 'frappe', coupe: true });
          if (ev.puissance > 0.85) return C.dire(ch('fort', [`Une mine de ${n(ev.joueur)} !`, `${n(ev.joueur)} frappe fort !`, `Quelle frappe de ${n(ev.joueur)} !`, `${n(ev.joueur)} arme une frappe terrible !`]), { emotion: 0.6, clip: 'frappe', coupe: true });
          return C.dire(ch('tir', [`${n(ev.joueur)} frappe !`, `Tir de ${n(ev.joueur)}…`, `${n(ev.joueur)} tente le cadre !`, `${n(ev.joueur)} essaie !`, `C’est ${n(ev.joueur)} qui frappe !`]), { emotion: 0.5, clip: 'tir', coupe: true });
        case 'passe': {
          const p = m.joueurs[ev.joueur], c = ev.cible >= 0 ? m.joueurs[ev.cible] : null;
          if (p.i === 0) return direct(ch('relance', [`${n(ev.joueur)} relance.`, `Relance rapide de ${n(ev.joueur)} !`, `${n(ev.joueur)} joue court.`]), 'gardien_relance');
          if (ev.lob && c && zone(m, c) === 1) return direct(ch('centre', [`Le centre de ${n(ev.joueur)} !`, `${n(ev.joueur)} cherche ${n(ev.cible)} dans la surface !`, 'Ballon dans la surface !']), 'centre', { emotion: 0.6 });
          if (ev.lob) return direct(ch('lob', [`${n(ev.joueur)} cherche ${n(ev.cible)} par-dessus…`, `Ballon long de ${n(ev.joueur)} !`, `${n(ev.joueur)} change le jeu !`]), 'passe_longue', { emotion: 0.5 });
          return direct(ch('passe', [`${n(ev.joueur)} pour ${n(ev.cible)}.`, `${n(ev.joueur)} donne à ${n(ev.cible)}.`, `${n(ev.joueur)} trouve ${n(ev.cible)}.`, `${n(ev.cible)}…`]), 'passe', { emotion: 0.3 });
        }
        case 'controle':
          if (!ev.recupere) return;
          return direct(ch('recup', [`Ballon récupéré par ${n(ev.joueur)} !`, `Interception de ${n(ev.joueur)} !`, `${n(ev.joueur)} coupe la trajectoire !`, `${n(ev.joueur)} lit bien le jeu !`]), 'recupere', {
            emotion: 0.55, apresClip: 'cons_recup', apres: parfois(0.15) ? ch('recup-cons', ['Belle lecture du jeu.', 'Défensivement, c’est solide.', 'Il a bien senti le coup.']) : null,
          });
        case 'contre':
          return direct(ch('contre', [`Contré par ${n(ev.joueur)} !`, `${n(ev.joueur)} s’interpose !`, `Bloqué par ${n(ev.joueur)} !`]), 'contre', { emotion: 0.6, coupe: true });
        case 'frole':
          return direct(ch('frole', [`${n(ev.joueur)} la touche du bout des doigts !`, `${n(ev.joueur)} l’effleure !`]), 'frole', { emotion: 0.7, coupe: true });
        case 'bande':
          // Juste après un tir, la bande du fond : c'est à côté.
          if (performance.now() - tirEnVol < 1500 && Math.abs(m.ballon.x) > DEMI_L - 1) {
            tirEnVol = -1e9;
            return direct(ch('a-cote', ['À côté !', 'C’est à côté !', 'Ça passe tout près !', 'Pas cadré !']), 'a_cote', {
              emotion: 0.7, coupe: true, apresClip: 'cons_rate', apres: parfois(0.4) ? ch('rate-cons', ['Il fallait cadrer.', 'Il a manqué de précision.', 'Il avait mieux à faire.']) : null,
            });
          }
          if (ev.force > 8 && parfois(0.3)) return direct(ch('bande', ['Sur la bande !', 'Ça claque contre la bande !']), 'bande', { emotion: 0.4 });
          return;
        case 'pressing': {
          const t = performance.now();
          if (t - tPressing < 12000) return;
          tPressing = t;
          return direct(ch('press', [`${eq(ev.equipe)} presse haut !`, `Gros pressing de ${eq(ev.equipe)} !`, `${eq(ev.equipe)} monte tous ensemble !`]), 'pressing', {
            emotion: 0.5, apresClip: 'cons_pressing', apres: parfois(0.3) ? ch('press-cons', ['Ce pressing, c’est épuisant pour l’adversaire.', 'Ils récupèrent haut, c’est leur force.', 'Il faut savoir sortir de ce pressing.']) : null,
          });
        }
        case 'engagement':
          return direct(ch('engagement', ['Engagement !', 'On reprend !', 'Ça repart !']), 'engagement', { emotion: 0.4 });
        case 'arret':
          if (m.phase === 'tab') return C.dire(ch('tab-arret', [`${n(ev.joueur)} détourne la tentative !`, `Arrêté par ${n(ev.joueur)} !`, `${n(ev.joueur)} a deviné !`]), { important: true, emotion: 0.85, clip: 'arret' });
          if (ev.capte) {
            return C.dire(ch('capte', [`Bien capté par ${n(ev.joueur)}.`, `${n(ev.joueur)} s’interpose et bloque le ballon.`, `Pas de souci pour ${n(ev.joueur)}.`, `${n(ev.joueur)} se couche bien.`]), {
              emotion: 0.4, apresClip: 'cons_capte', apres: parfois(0.3) ? ch('capte-cons', ['Il fallait mieux la placer.', 'Pas assez appuyée, cette frappe.', 'Le gardien était bien placé.']) : null,
            });
          }
          return C.dire(ch('parade', [`Parade de ${n(ev.joueur)} !`, `Quel réflexe de ${n(ev.joueur)} !`, `${n(ev.joueur)} repousse !`, `Énorme ${n(ev.joueur)} !`]), {
            important: true, emotion: 0.85, clip: 'arret',
            apresClip: 'cons_parade', apres: parfois(0.5) ? ch('parade-cons', ['Grosse parade, il a lu la trajectoire jusqu’au bout.', 'Il sauve son équipe, là.', 'Celle-là, elle valait un but.']) : null,
          });
        case 'poteau':
          return C.dire(ev.barre ? ch('barre', ['Sur la barre !!', 'La transversale tremble encore !', 'La barre ! Il n’y avait qu’un centimètre !']) : ch('poteau', ['Sur le poteau !!', 'Le poteau sauve le gardien !', 'Poteau ! Quelle malchance !']), {
            important: true, emotion: 0.9, clip: ev.barre ? 'barre' : 'poteau', apresClip: 'cons_poteau', apres: parfois(0.5) ? ch('poteau-cons', ['Le football, c’est une question de centimètres.', 'Il fallait la mettre au fond !', 'Il y avait la place de l’autre côté.']) : null,
          });
        case 'tacle':
          if (ev.reussi) return C.dire(ch('tacle', [`Tacle parfait de ${n(ev.joueur)} !`, `${n(ev.joueur)} récupère proprement.`, `Superbe intervention de ${n(ev.joueur)}.`, `${n(ev.joueur)} glisse et prend tout le ballon.`]), { clip: 'tacle', frais: true, coupe: true, emotion: 0.6 });
          return C.dire(ch('tacle-rate', [`${n(ev.joueur)} arrive trop tard…`, `${n(ev.joueur)} manque son tacle.`, `Raté pour ${n(ev.joueur)}, il est au sol.`]), { frais: true, clip: 'tacle_rate', emotion: 0.5 });
        case 'vol':
          return C.dire(ch('vol', [`${n(ev.joueur)} chipe le ballon à ${n(ev.victime)}.`, `Bien joué ${n(ev.joueur)}, ballon récupéré.`, `${n(ev.joueur)} gagne son duel.`]), { frais: true, clip: 'vol', emotion: 0.55 });
        case 'geste':
          if (ev.nom === 'arc-en-ciel') return C.dire(ch('arc', [`Un arc-en-ciel de ${n(ev.joueur)} !! Le public se lève !`, `Par-dessus la tête ! L’arc-en-ciel de ${n(ev.joueur)} !`, `Quelle audace, ${n(ev.joueur)} ! Un arc-en-ciel !`]), { important: true, emotion: 0.9, clip: 'arc_en_ciel', apresClip: 'cons_arc', apres: parfois(0.5) ? 'Il faut oser faire ça en match !' : null });
          return C.dire(ch('roulette', [`Roulette de ${n(ev.joueur)} !`, `${n(ev.joueur)} tourne autour de son adversaire !`, `Superbe roulette de ${n(ev.joueur)}.`, `${n(ev.joueur)} efface son vis-à-vis d’une roulette !`]), { emotion: 0.6, clip: 'roulette' });
        case 'but': {
          const e = ev.equipe;
          const [s, t] = [m.score[e], m.score[1 - e]];
          const etat = s === t ? `${eq(e)} égalise !` : s === t + 1 ? `${eq(e)} passe devant !` : `${eq(e)} creuse l’écart !`;
          if (ev.csc) return C.dire(`Contre son camp de ${n(ev.joueur)}… cruel ! ${etat}`, { important: true, emotion: 0.8, clip: 'but', apresClip: 'cons_csc', apres: 'Ça arrive, mais à ce moment-là, ça fait mal.' });
          const nb = butsDe(m, ev.joueur);
          const qui = nb === 2 ? `Et c’est le doublé pour ${n(ev.joueur)} !` : nb === 3 ? `TRIPLÉ !! ${n(ev.joueur)} entre dans l’histoire !` : nb > 3 ? `${n(ev.joueur)} est intenable, c’est son ${nb}e !` : ch('but', [`BUT de ${n(ev.joueur)} !!!`, `GOAAAL ! ${n(ev.joueur)} !`, `C’est au fond ! ${n(ev.joueur)} !`, `Il marque ! ${n(ev.joueur)} !`]);
          const passe = ev.passeur >= 0 ? ch('passe-dec', [` Sur un service de ${n(ev.passeur)}.`, ` Bien servi par ${n(ev.passeur)}.`, ` Quelle passe de ${n(ev.passeur)} !`]) : '';
          return C.dire(`${qui} ${etat}${passe}`, {
            important: true, emotion: 1, clip: 'but',
            apresClip: 'cons_but', apres: ch('but-cons', ['Quelle finition !', 'La défense a dormi sur ce coup-là.', 'Imparable pour le gardien.', 'Ça, c’est un but de grand joueur.', 'Tout est allé très vite, magnifique.']),
          });
        }
        case 'mitemps': {
          const st = m.stats;
          const p0 = Math.round((st.possession[0] / Math.max(1, st.possession[0] + st.possession[1])) * 100);
          const dom = p0 >= 55 ? 0 : p0 <= 45 ? 1 : -1;
          return C.dire(`C’est la pause. ${eq(0)} ${m.score[0]} – ${m.score[1]} ${eq(1)}.`, {
            important: true, emotion: 0.5, clip: 'mi_temps',
            apresClip: dom >= 0 ? null : 'cons_mitemps', apres: dom >= 0 ? `${eq(dom)} a eu le ballon plus souvent : ${dom === 0 ? p0 : 100 - p0} % de possession.` : 'Un match très équilibré pour l’instant.',
          });
        }
        case 'reprise':
          return C.dire(ch('reprise', ['Les deux équipes reviennent pour la seconde période !', 'C’est reparti pour la deuxième mi-temps !', 'Deuxième mi-temps ! Tout reste à faire.']), { important: true, emotion: 0.5, clip: 'reprise' });
        case 'tab':
          return C.dire('Égalité ! Place à la loterie des tirs au but…', { important: true, emotion: 0.7, clip: 'tirs_au_but', apresClip: 'cons_tab', apres: 'Maintenant, c’est une question de nerfs.' });
        case 'tab-but':
          return C.dire(ch('tab-but', [`${n(ev.joueur)} ne tremble pas !`, `Transformé par ${n(ev.joueur)} !`, `Dans le coin, ${n(ev.joueur)} !`]), { important: true, emotion: 0.8, clip: 'tab_marque' });
        case 'tab-rate':
          return C.dire(ch('tab-rate', [`${n(ev.joueur)} manque le cadre !`, `À côté pour ${n(ev.joueur)}…`, `Oh non, ${n(ev.joueur)} !`]), { important: true, emotion: 0.8, clip: 'tab_rate' });
        case 'fin': {
          const v = ev.vainqueur;
          if (v < 0) return C.dire(`C’est terminé : match nul, ${m.score[0]} partout.`, { important: true, emotion: 0.6, clip: 'match_nul', apresClip: 'cons_nul', apres: 'Un partage des points logique.' });
          return C.dire(`C’est terminé ! Victoire de ${ctx.equipe(v).nom}${ev.tab ? ' aux tirs au but' : ''} !`, { important: true, emotion: 0.9, clip: 'victoire', apresClip: 'cons_fin', apres: ch('fin-cons', ['Une victoire méritée.', 'Ils ont su faire la différence au bon moment.', 'Quelle soirée pour eux !']) });
        }
        default:
      }
    },
    /** Pour les cinématiques : une phrase libre. */
    dire: (texte, o) => C.dire(texte, o),
    arreter() { C.arreter(); },
  };
}
