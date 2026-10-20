/**
 * DOUBLE PAS — ce que disent les commentateurs du basket.
 *
 * Le moteur est commun à tous les sports (commun/commentateur.js) ; le basket
 * n'a pas encore de voix enregistrées : ses phrases s'affichent en texte
 * seulement (texteSeul), jamais lues par la synthèse du navigateur.
 */

import { creerCommentateur as moteur } from '../../commun/commentateur.js';

/** Pas de voix pour le basket (pour l'instant) : le texte, ou rien. Un réglage à lui (celui du foot n'est pas touché). */
export const REGLAGES = [['texte', 'Commentaires : texte'], ['aucun', 'Sans commentaires']];
const CLE = 'doublepas.commentaires';
export let reglage = 'texte';
try { reglage = localStorage.getItem(CLE) === 'aucun' ? 'aucun' : 'texte'; } catch { /* ignore */ }
export function regler(v) {
  reglage = v === 'aucun' ? 'aucun' : 'texte';
  try { localStorage.setItem(CLE, reglage); } catch { /* ignore */ }
}

const nomCourt = (n) => n.split(' ').slice(-1)[0];
const parfois = (p) => Math.random() < p;

/**
 * Le commentateur d'un match. ctx : { nom(id) → nom complet, equipe(e) → équipe, salle, el }
 */
export function creerCommentateur(ctx) {
  const M = moteur({ el: ctx.el, noms: { comm: 'Commentaire', cons: 'Consultant' }, texteSeul: true });
  const C = { ...M, dire: (texte, o) => (reglage === 'aucun' ? null : M.dire(texte, o)) };
  const ch = (cle, l) => C.choisir(cle, l);
  const n = (id) => (id >= 0 ? `<b>${nomCourt(ctx.nom(id))}</b>` : '');
  const eq = (e) => ctx.equipe(e).court;
  let dejaTrente = false, dejaDix = false, serie = { e: -1, n: 0 }, tCons = 0;

  return {
    debut(m) {
      C.dire(`Bienvenue ${ctx.salle || ''} pour ce choc entre ${ctx.equipe(0).nom} et ${ctx.equipe(1).nom} !`, { important: true, emotion: 0.5, apres: 'Trois contre trois, terrain entier : ça va courir.' });
    },
    avancer(dt, m) {
      if (m.phase !== 'jeu' || m.enOr) return;
      tCons += dt;
      if (m.periode === 2 && m.duree >= 60 * 60) {
        const reste = (m.duree - m.chrono) / 60;
        const ecart = m.score[0] - m.score[1];
        if (!dejaTrente && reste < 30) {
          dejaTrente = true;
          C.dire(ecart === 0 ? 'Trente secondes, et tout le monde à égalité !' : Math.abs(ecart) <= 3 ? `Trente secondes ! ${eq(ecart > 0 ? 1 : 0)} n’est qu’à un panier !` : 'Plus que trente secondes à jouer !', { important: true, emotion: 0.6 });
        } else if (!dejaDix && reste < 10) {
          dejaDix = true;
          C.dire(ch('10', ['Dix secondes !', 'Les dernières secondes !', 'Dernière possession !']), { important: true, emotion: 0.8 });
        }
      }
      // Le consultant, dans les temps calmes.
      if (tCons > 22 && C.libre(2500)) {
        tCons = 0;
        const st = m.stats;
        const e = st.rebonds[0] > st.rebonds[1] + 2 ? 0 : st.rebonds[1] > st.rebonds[0] + 2 ? 1 : -1;
        const t3 = st.troisReussis[0] + st.troisReussis[1];
        if (e >= 0) C.dire(`${eq(e)} domine au rebond : ${st.rebonds[e]} contre ${st.rebonds[1 - e]}.`, { role: 'cons' });
        else if (t3 >= 4) C.dire(`Déjà ${t3} paniers à trois points dans ce match : ça shoote de loin !`, { role: 'cons' });
        else C.dire(ch('cons', ['À trois contre trois, chaque ballon perdu se paie cash.', 'Il faut écarter le jeu pour ouvrir la route du cercle.', 'La défense doit rester serrée sur le porteur.', 'Le rythme est fou, les organismes vont souffrir.']), { role: 'cons' });
      }
    },
    evenement(ev, m) {
      switch (ev.type) {
        case 'tape':
          return C.dire(`${n(ev.joueur)} gagne l’entre-deux pour ${eq(ev.equipe)} !`, { emotion: 0.4 });
        case 'tir':
          if (ev.pts === 3 && parfois(0.45)) return C.dire(ch('tir3', [`${n(ev.joueur)} tente à trois points…`, `${n(ev.joueur)} de loin…`, `Le tir à trois points de ${n(ev.joueur)}…`]), { frais: true, emotion: 0.45 });
          return null;
        case 'envol':
          return C.dire(ch('envol', [`${n(ev.joueur)} s’envole…`, `${n(ev.joueur)} décolle !`]), { frais: true, coupe: true, emotion: 0.6 });
        case 'panier': {
          if (ev.equipe === serie.e) serie.n += 1; else serie = { e: ev.equipe, n: 1 };
          const qui = n(ev.joueur);
          const passe = ev.passeur >= 0 ? ` Sur une passe de ${n(ev.passeur)}.` : '';
          if (ev.enOr) return C.dire(`${qui} ! Le panier en or ! ${ctx.equipe(ev.equipe).nom} l’emporte !`, { important: true, emotion: 1 });
          if (ev.dunk) return C.dire(ch('dunk', [`Le dunk de ${qui} ! Le cercle tremble encore !`, `${qui} écrase le ballon dans le cercle !`, `Quel dunk de ${qui} !`]) + passe, { important: true, emotion: 1, apres: parfois(0.5) ? ch('dunk-cons', ['Personne n’a osé se mettre en travers.', 'Quelle détente !']) : null });
          if (ev.pts === 3) return C.dire(ch('trois', [`À trois points… dedans ! ${qui} !`, `${qui} fait mouche de loin !`, `Ficelle ! Trois points pour ${qui} !`]) + passe, { important: true, emotion: 0.9, apres: serie.n >= 3 ? `${serie.n} paniers de suite pour ${eq(ev.equipe)} !` : null });
          if (serie.n === 4) return C.dire(`Encore ${qui} ! ${eq(ev.equipe)} enchaîne un quatrième panier de suite !`, { important: true, emotion: 0.8 });
          return C.dire(ch('deux', [`${qui} marque !`, `Panier de ${qui}.`, `${qui} trouve le cercle.`, `Deux points pour ${qui}.`]) + passe, { coupe: true, emotion: 0.6 });
        }
        case 'contre':
          return C.dire(ch('contre', [`Contré par ${n(ev.joueur)} !`, `Énorme contre de ${n(ev.joueur)} !`, `${n(ev.joueur)} renvoie le ballon à l’envoyeur !`]), { important: true, emotion: 0.9 });
        case 'vol':
          return C.dire(ch('vol', [`${n(ev.joueur)} chipe le ballon !`, `Interception de ${n(ev.joueur)} sur ${n(ev.victime)} !`, `${n(ev.joueur)} vole le ballon !`]), { frais: true, coupe: true, emotion: 0.6 });
        case 'interception':
          return C.dire(ch('inter', [`${n(ev.joueur)} coupe la passe !`, `Passe interceptée par ${n(ev.joueur)} !`]), { frais: true, coupe: true, emotion: 0.6 });
        case 'rebond':
          if (ev.offensif && parfois(0.6)) return C.dire(ch('reb-off', [`Rebond offensif de ${n(ev.joueur)} !`, `${n(ev.joueur)} reprend son propre ballon… enfin, celui de son équipe !`]), { frais: true, emotion: 0.5 });
          if (parfois(0.25)) return C.dire(`Rebond pour ${n(ev.joueur)}.`, { frais: true });
          return null;
        case 'crochet':
          if (ev.reussi && parfois(0.5)) return C.dire(ch('crochet', [`Le crochet de ${n(ev.joueur)} ! Son défenseur est dans le vent.`, `${n(ev.joueur)} efface son vis-à-vis !`]), { frais: true, emotion: 0.6 });
          return null;
        case 'mitemps':
          return C.dire(`Fin de la première période : ${eq(0)} ${m.score[0]} – ${m.score[1]} ${eq(1)}.`, { important: true, emotion: 0.5, apres: m.score[0] === m.score[1] ? 'Impossible de les départager pour l’instant.' : `${eq(m.score[0] > m.score[1] ? 0 : 1)} a pris l’avantage, mais rien n’est fait.` });
        case 'reprise':
          return C.dire(ch('reprise', ['C’est reparti pour la deuxième période !', 'Deuxième période : tout reste à faire !']), { important: true, emotion: 0.5 });
        case 'egalite':
          return C.dire(`Égalité, ${m.score[0]} partout ! Place au panier en or : le premier qui marque gagne !`, { important: true, emotion: 0.9, apres: 'Les nerfs vont parler.' });
        case 'fin': {
          const v = ev.vainqueur;
          if (v < 0) return null;
          return C.dire(`C’est terminé ! Victoire de ${ctx.equipe(v).nom}, ${Math.max(...m.score)} à ${Math.min(...m.score)} !`, { important: true, emotion: 0.9, apres: ch('fin-cons', ['Une victoire méritée.', 'Ils ont su faire la différence au bon moment.', 'Quel match !']) });
        }
        default:
      }
      return null;
    },
    dire: (texte, o) => C.dire(texte, o),
    arreter() { C.arreter(); },
  };
}
