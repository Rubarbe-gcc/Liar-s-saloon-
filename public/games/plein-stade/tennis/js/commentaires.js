/**
 * REVERS — ce que disent les commentateurs du tennis.
 *
 * Le moteur est commun à tous les sports (commun/commentateur.js) ; le tennis n'a pas encore de voix
 * enregistrées : ses phrases s'affichent en texte seulement (texteSeul), avec un réglage à lui.
 */

import { creerCommentateur as moteur } from '../../commun/commentateur.js';
import { pointsTexte, enjeu } from '../../../../shared/tennis/match.js';

export const REGLAGES = [['texte', 'Commentaires : texte'], ['aucun', 'Sans commentaires']];
const CLE = 'revers.commentaires';
export let reglage = 'texte';
try { reglage = localStorage.getItem(CLE) === 'aucun' ? 'aucun' : 'texte'; } catch { /* ignore */ }
export function regler(v) {
  reglage = v === 'aucun' ? 'aucun' : 'texte';
  try { localStorage.setItem(CLE, reglage); } catch { /* ignore */ }
}

const parfois = (p) => Math.random() < p;

/** Le commentateur d'un match. ctx : { joueur(e) → le joueur, el } */
export function creerCommentateur(ctx) {
  const M = moteur({ el: ctx.el, noms: { comm: 'Commentaire', cons: 'Consultant' }, texteSeul: true });
  const C = { ...M, dire: (texte, o) => (reglage === 'aucun' ? null : M.dire(texte, o)) };
  const ch = (cle, l) => C.choisir(cle, l);
  const n = (e) => `<b>${ctx.joueur(e).nom.split(' ').slice(-1)[0]}</b>`;
  const surnom = (e) => `« ${ctx.joueur(e).surnom} »`;
  let tCons = 0, dernierCoup = null;

  return {
    debut() {
      C.dire(`Sur le court central : ${ctx.joueur(0).nom}, ${surnom(0)}, face à ${ctx.joueur(1).nom}, ${surnom(1)} !`, { important: true, emotion: 0.6, apres: 'Le public s’installe. Silence, on joue.' });
    },
    avancer(dt, m) {
      if (m.phase !== 'service') return;
      tCons += dt;
      if (tCons > 28 && C.libre(3000)) {
        tCons = 0;
        const st = m.stats;
        if (st.aces[0] + st.aces[1] >= 3) { const e = st.aces[0] >= st.aces[1] ? 0 : 1; C.dire(`Déjà ${st.aces[e]} aces pour ${n(e)} : ce service fait mal.`, { role: 'cons' }); }
        else if (st.plusLong > 14) C.dire(`On a vu un échange de ${st.plusLong} frappes : quel physique !`, { role: 'cons' });
        else C.dire(ch('cons', ['Il faut varier : un slice, une amortie, et l’autre ne sait plus où il habite.', 'Le premier service, c’est la moitié du point.', 'Celui qui prend le filet doit avoir un bon passing en face.', 'Patience : on construit le point, on n’envoie pas tout de suite.']), { role: 'cons' });
      }
    },
    evenement(ev, m) {
      switch (ev.type) {
        case 'frappe':
          dernierCoup = ev;
          if (ev.coup === 'service' && ev.vitesse >= 190 && parfois(0.5)) return C.dire(`${ev.vitesse} km/h ! Quel boulet de ${n(ev.e)} !`, { frais: true, emotion: 0.6 });
          if (ev.coup === 'amortie' && parfois(0.6)) return C.dire(ch('amortie', [`Amortie de ${n(ev.e)} !`, `Oh, la petite amortie de ${n(ev.e)}…`]), { frais: true, coupe: true, emotion: 0.6 });
          if (ev.coup === 'lob' && parfois(0.5)) return C.dire(ch('lob', [`Le lob de ${n(ev.e)}…`, `${n(ev.e)} tente le lob !`]), { frais: true, coupe: true, emotion: 0.55 });
          return null;
        case 'faute':
          if (ev.double) return C.dire(ch('df', [`Double faute de ${n(ev.e)}.`, `Oh non, la double faute pour ${n(ev.e)}…`]), { important: true, emotion: 0.5 });
          if (parfois(0.4)) return C.dire(ch('faute', ['Faute. Deuxième balle.', ev.raison === 'filet' ? 'Dans le filet. Seconde balle.' : 'Out ! Deuxième service.']), { frais: true });
          return null;
        case 'point': {
          const g = ev.gagnant, d = dernierCoup;
          if (ev.raison === 'ace') return C.dire(ch('ace', [`Ace ! ${n(g)} ne laisse aucune chance !`, `Service gagnant… non, un ace ! ${n(g)} !`, `Ace de ${n(g)}, la balle n’a même pas été touchée !`]), { important: true, emotion: 0.85 });
          if (ev.echange >= 15) return C.dire(`Quel échange ! ${ev.echange} frappes, et c’est ${n(g)} qui le gagne !`, { important: true, emotion: 1, apres: parfois(0.6) ? 'Le public est debout. Extraordinaire.' : null });
          if (ev.raison === 'gagnant' && d?.coup === 'smash') return C.dire(ch('smash', [`Smash ! ${n(g)} écrase la balle !`, `Le smash de ${n(g)}, imparable !`]), { coupe: true, emotion: 0.85 });
          if (ev.raison === 'gagnant' && d?.coup === 'volee') return C.dire(ch('volee', [`Volée gagnante de ${n(g)} !`, `${n(g)} conclut au filet !`]), { coupe: true, emotion: 0.75 });
          if (ev.raison === 'gagnant' && d?.coup === 'amortie') return C.dire(`L’amortie est parfaite, ${n(1 - g)} n’y arrive pas !`, { coupe: true, emotion: 0.8 });
          if (ev.raison === 'gagnant' && d?.coup === 'lob') return C.dire(`Le lob passe au-dessus de ${n(1 - g)} ! Magnifique !`, { coupe: true, emotion: 0.85 });
          if (ev.raison === 'gagnant' && parfois(0.6)) return C.dire(ch('gagnant', [`Coup gagnant de ${n(g)} !`, `${n(g)} trouve la ligne !`, `Superbe ${d?.cote === 'rv' ? 'revers' : 'coup droit'} de ${n(g)} !`, `Hors de portée ! Point ${n(g)}.`]), { frais: true, coupe: true, emotion: 0.7 });
          if (ev.raison === 'filet' && parfois(0.5)) return C.dire(ch('filet', [`Dans le filet pour ${n(1 - g)}.`, `La bande ! Point ${n(g)}.`]), { frais: true });
          if (ev.raison === 'dehors' && parfois(0.5)) return C.dire(ch('dehors', ['Out ! Elle sort de peu.', `Faute de ${n(1 - g)}, c’était long.`, `Dehors ! Point pour ${n(g)}.`]), { frais: true });
          // Le moment du match : balle de break, de set, de match.
          const x = enjeu(m);
          if (x && m.phase === 'point') {
            const [a, b] = pointsTexte(m);
            const s = `${a === '' ? '' : a}${a !== '' && b !== '' ? '-' : ''}${b}`;
            const quoi = { break: 'Balle de break', set: 'Balle de set', match: 'Balle de match' }[x.type];
            return C.dire(`${quoi} pour ${n(x.e)} !${s && s !== 'AV' ? ` (${s})` : ''}`, { important: true, emotion: x.type === 'match' ? 1 : 0.75 });
          }
          return null;
        }
        case 'jeu':
          if (ev.break) return C.dire(ch('break', [`Break ! ${n(ev.gagnant)} prend le service adverse !`, `Le break pour ${n(ev.gagnant)} ! ${ev.jeux[0]}-${ev.jeux[1]}.`]), { important: true, emotion: 0.85 });
          if (parfois(0.45)) return C.dire(`Jeu ${n(ev.gagnant)}. ${ev.jeux[0]}-${ev.jeux[1]}.`, { frais: true });
          return null;
        case 'tiebreak':
          return C.dire('Jeu décisif ! Tout va se jouer maintenant.', { important: true, emotion: 0.8 });
        case 'set':
          if (m.phase !== 'fin') return C.dire(`Set ${n(ev.gagnant)} ! ${ev.sets.map((s) => s.join('-')).join(', ')}.`, { important: true, emotion: 0.85 });
          return null;
        case 'fin':
          return C.dire(`Jeu, set et match ! ${n(ev.vainqueur)} l’emporte !`, { important: true, emotion: 1 });
        default:
      }
      return null;
    },
    dire: (texte, o) => C.dire(texte, o),
    arreter() { C.arreter(); },
  };
}
