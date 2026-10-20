/**
 * CROCHET — ce que disent les commentateurs de la boxe.
 *
 * Le moteur est commun à tous les sports (commun/commentateur.js) ; la boxe
 * n'a pas encore de voix enregistrées : ses phrases s'affichent en texte
 * seulement (texteSeul), avec un réglage à elle.
 */

import { creerCommentateur as moteur } from '../../commun/commentateur.js';

export const REGLAGES = [['texte', 'Commentaires : texte'], ['aucun', 'Sans commentaires']];
const CLE = 'crochet.commentaires';
export let reglage = 'texte';
try { reglage = localStorage.getItem(CLE) === 'aucun' ? 'aucun' : 'texte'; } catch { /* ignore */ }
export function regler(v) {
  reglage = v === 'aucun' ? 'aucun' : 'texte';
  try { localStorage.setItem(CLE, reglage); } catch { /* ignore */ }
}

const parfois = (p) => Math.random() < p;

/** Le commentateur d'un combat. ctx : { boxeur(e) → le boxeur, el } */
export function creerCommentateur(ctx) {
  const M = moteur({ el: ctx.el, noms: { comm: 'Commentaire', cons: 'Consultant' }, texteSeul: true });
  const C = { ...M, dire: (texte, o) => (reglage === 'aucun' ? null : M.dire(texte, o)) };
  const ch = (cle, l) => C.choisir(cle, l);
  const n = (e) => `<b>${ctx.boxeur(e).nom.split(' ').slice(-1)[0]}</b>`;
  const surnom = (e) => `« ${ctx.boxeur(e).surnom} »`;
  let serie = { e: -1, n: 0 }, tCons = 0;

  return {
    debut() {
      C.dire(`Ce soir : ${ctx.boxeur(0).nom}, ${surnom(0)}, face à ${ctx.boxeur(1).nom}, ${surnom(1)} !`, { important: true, emotion: 0.6, apres: 'Trois rounds. Que le meilleur gagne.' });
    },
    avancer(dt, m) {
      if (m.phase !== 'combat') return;
      tCons += dt;
      if (tCons > 20 && C.libre(2500)) {
        tCons = 0;
        const [a, b] = m.boxeurs;
        const fatigue = a.endu < 30 ? 0 : b.endu < 30 ? 1 : -1;
        if (fatigue >= 0) C.dire(`${n(fatigue)} a les bras lourds, il souffle.`, { role: 'cons' });
        else if (Math.abs(m.stats.touches[0] - m.stats.touches[1]) > 6) { const e = m.stats.touches[0] > m.stats.touches[1] ? 0 : 1; C.dire(`${n(e)} touche bien plus souvent : ${m.stats.touches[e]} coups portés contre ${m.stats.touches[1 - e]}.`, { role: 'cons' }); }
        else C.dire(ch('cons', ['Il faut travailler derrière le jab.', 'La garde haute, toujours, sinon ça finit mal.', 'Le corps, puis la tête : la vieille recette.', 'Celui qui frappe dans le vide se découvre.']), { role: 'cons' });
      }
    },
    evenement(ev, m) {
      switch (ev.type) {
        case 'cloche':
          if (ev.debut) return C.dire(ev.round === 1 ? 'Ding ! C’est parti pour le premier round !' : `Round ${ev.round} !`, { important: true, emotion: 0.5 });
          return null;
        case 'touche': {
          if (ev.boxeur === serie.e) serie.n += 1; else serie = { e: ev.boxeur, n: 1 };
          if (ev.contre && ev.degats > 5) return C.dire(ch('contre', [`Quel contre de ${n(ev.boxeur)} !`, `${n(ev.boxeur)} le cueille en contre !`]), { coupe: true, emotion: 0.8 });
          if (ev.coup === 'upper' && ev.degats > 6) return C.dire(ch('upper', [`Uppercut de ${n(ev.boxeur)} ! La tête part en arrière !`, `${n(ev.boxeur)} remonte un uppercut terrible !`]), { coupe: true, emotion: 0.85 });
          if (ev.coup === 'crochet' && ev.degats > 6) return C.dire(ch('crochet', [`Le crochet de ${n(ev.boxeur)} fait mouche !`, `Gros crochet de ${n(ev.boxeur)} !`]), { frais: true, coupe: true, emotion: 0.7 });
          if (ev.corps && parfois(0.3)) return C.dire(ch('corps', [`${n(ev.boxeur)} travaille au corps.`, `Dans les côtes, signé ${n(ev.boxeur)}.`]), { frais: true });
          if (serie.n === 4) return C.dire(`${n(ev.boxeur)} enchaîne, ${n(ev.cible)} est acculé !`, { frais: true, emotion: 0.7 });
          return null;
        }
        case 'esquive-reussie':
          if (parfois(0.4)) return C.dire(ch('esq', [`${n(ev.boxeur)} esquive, le coup ne trouve que le vide !`, `Superbe esquive de ${n(ev.boxeur)}.`]), { frais: true, emotion: 0.5 });
          return null;
        case 'kd':
          return C.dire(ch('kd', [`${n(ev.boxeur)} est au tapis !`, `Il tombe ! ${n(ev.boxeur)} est au tapis !`, `Knock-down ! ${n(ev.attaquant)} envoie ${n(ev.boxeur)} au sol !`]), { important: true, emotion: 1 });
        case 'debout':
          return C.dire(`${n(ev.boxeur)} se relève à ${ev.compte} ! Le combat continue !`, { important: true, emotion: 0.8 });
        case 'repos':
          return C.dire(`Fin du round ${ev.round}. Chacun retourne dans son coin.`, { important: true, emotion: 0.4, apres: m.stats.touches[0] === m.stats.touches[1] ? 'Très serré pour l’instant.' : `${n(m.stats.touches[0] > m.stats.touches[1] ? 0 : 1)} semble avoir pris l’avantage.` });
        case 'fin': {
          const v = ev.vainqueur;
          if (ev.issue === 'ko') return C.dire(`K.-O. ! ${ctx.boxeur(v).nom} gagne par K.-O. au round ${ev.round} !`, { important: true, emotion: 1 });
          if (ev.issue === 'arret') return C.dire(`L’arbitre arrête le combat ! Victoire de ${ctx.boxeur(v).nom} !`, { important: true, emotion: 1 });
          const type = { unanime: 'à l’unanimité des juges', majorite: 'à la majorité des juges', partagee: 'sur décision partagée', arbitre: 'sur décision de l’arbitre' }[ev.decision.type];
          return C.dire(`Les juges ont rendu leur verdict : ${ctx.boxeur(v).nom} l’emporte ${type} !`, { important: true, emotion: 0.9 });
        }
        default:
      }
      return null;
    },
    dire: (texte, o) => C.dire(texte, o),
    arreter() { C.arreter(); },
  };
}
