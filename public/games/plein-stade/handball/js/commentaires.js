/**
 * ROUCOULETTE — ce que disent les commentateurs du handball.
 *
 * Le moteur est commun à tous les sports (commun/commentateur.js) ; le
 * handball n'a pas encore de voix enregistrées : ses phrases s'affichent en
 * texte seulement (texteSeul), jamais lues par la synthèse du navigateur.
 */

import { creerCommentateur as moteur } from '../../commun/commentateur.js';

/** Pas de voix pour le handball (pour l'instant) : le texte, ou rien. Un réglage à lui. */
export const REGLAGES = [['texte', 'Commentaires : texte'], ['aucun', 'Sans commentaires']];
const CLE = 'roucoulette.commentaires';
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
    debut() {
      C.dire(`Bienvenue ${ctx.salle || ''} pour ce choc entre ${ctx.equipe(0).nom} et ${ctx.equipe(1).nom} !`, { important: true, emotion: 0.5, apres: 'Sept contre sept, et ça va aller très vite.' });
    },
    avancer(dt, m) {
      if (m.phase !== 'jeu' || m.enOr) return;
      tCons += dt;
      if (m.periode === 2 && m.duree >= 60 * 60) {
        const reste = (m.duree - m.chrono) / 60;
        const ecart = m.score[0] - m.score[1];
        if (!dejaTrente && reste < 30) {
          dejaTrente = true;
          C.dire(ecart === 0 ? 'Trente secondes, et tout le monde à égalité !' : Math.abs(ecart) === 1 ? `Trente secondes ! ${eq(ecart > 0 ? 1 : 0)} n’est qu’à un but !` : 'Plus que trente secondes à jouer !', { important: true, emotion: 0.6 });
        } else if (!dejaDix && reste < 10) {
          dejaDix = true;
          C.dire(ch('10', ['Dix secondes !', 'Les dernières secondes !', 'Dernière attaque !']), { important: true, emotion: 0.8 });
        }
      }
      // Le consultant, dans les temps calmes.
      if (tCons > 22 && C.libre(2500)) {
        tCons = 0;
        const st = m.stats;
        const e = st.arrets[0] > st.arrets[1] + 2 ? 0 : st.arrets[1] > st.arrets[0] + 2 ? 1 : -1;
        const ca = st.contreAttaques[0] + st.contreAttaques[1];
        if (e >= 0) C.dire(`Le gardien de ${eq(e)} fait la différence : déjà ${st.arrets[e]} arrêts.`, { role: 'cons' });
        else if (ca >= 3) C.dire(`Déjà ${ca} buts en contre-attaque : il faut se replier plus vite !`, { role: 'cons' });
        else C.dire(ch('cons', ['Il faut faire tourner le ballon pour ouvrir un espace.', 'Le pivot fait un travail énorme au milieu des défenseurs.', 'Attention aux ailes : c’est là que ça s’ouvre.', 'Une défense bien serrée sur ses six mètres, c’est la clé.', 'Le tir en suspension, ça se travaille à l’entraînement !']), { role: 'cons' });
      }
    },
    evenement(ev, m) {
      switch (ev.type) {
        case 'tir':
          if (ev.d > 9.5 && parfois(0.45)) return C.dire(ch('loin', [`${n(ev.joueur)} arme de loin…`, `La frappe de ${n(ev.joueur)} au-dessus de la défense…`]), { frais: true, emotion: 0.45 });
          if (ev.aile && parfois(0.45)) return C.dire(ch('aile', [`${n(ev.joueur)} s’envole sur son aile…`, `${n(ev.joueur)} plonge dans la zone…`]), { frais: true, emotion: 0.45 });
          return null;
        case 'but': {
          if (ev.equipe === serie.e) serie.n += 1; else serie = { e: ev.equipe, n: 1 };
          const qui = ev.joueur >= 0 ? n(ev.joueur) : 'Quelle confusion';
          const passe = ev.passeur >= 0 ? ` Sur une passe de ${n(ev.passeur)}.` : '';
          if (ev.enOr) return C.dire(`${qui} ! Le but en or ! ${ctx.equipe(ev.equipe).nom} l’emporte !`, { important: true, emotion: 1 });
          if (ev.contre) return C.dire(ch('ca', [`Contre-attaque éclair, et ${qui} conclut !`, `${qui} file seul au but… et marque !`, `Trop rapide pour tout le monde : but de ${qui} !`]) + passe, { important: true, emotion: 0.9 });
          if (ev.lucarne) return C.dire(ch('lucarne', [`En pleine lucarne ! ${qui} !`, `${qui} sous la barre ! Imparable !`]) + passe, { important: true, emotion: 1, apres: parfois(0.5) ? 'Le gardien n’a rien vu.' : null });
          if (ev.d > 9.5) return C.dire(ch('loin-but', [`Quelle frappe de ${qui} !`, `${qui} de loin… et ça rentre !`]) + passe, { important: true, emotion: 0.9, apres: serie.n >= 3 ? `${serie.n} buts de suite pour ${eq(ev.equipe)} !` : null });
          if (serie.n === 4) return C.dire(`Encore ${qui} ! ${eq(ev.equipe)} enchaîne un quatrième but de suite !`, { important: true, emotion: 0.8 });
          return C.dire(ch('but', [`But de ${qui} !`, `${qui} trouve le filet.`, `${qui} ne tremble pas.`, `Et c’est ${qui} qui marque.`]) + passe, { coupe: true, emotion: 0.6 });
        }
        case 'arret':
          if (ev.capte || parfois(0.6)) return C.dire(ch('arret', [`Quel arrêt de ${n(ev.joueur)} !`, `${n(ev.joueur)} dit non !`, `Parade de ${n(ev.joueur)} !`, `${n(ev.joueur)} sort le grand jeu !`]), { important: true, emotion: 0.8 });
          return null;
        case 'poteau':
          return C.dire(ev.barre ? ch('barre', ['Sur la barre !', 'La barre transversale tremble encore !']) : ch('poteau', ['Sur le poteau !', 'Le poteau sauve le gardien !']), { important: true, emotion: 0.8 });
        case 'contre':
          return C.dire(ch('contre', [`Contré par ${n(ev.joueur)} !`, `${n(ev.joueur)} lève les bras et renvoie le ballon !`]), { important: true, emotion: 0.8 });
        case 'vol':
          return C.dire(ch('vol', [`${n(ev.joueur)} chipe le ballon !`, `${n(ev.joueur)} récupère le ballon dans les mains de ${n(ev.victime)} !`]), { frais: true, coupe: true, emotion: 0.6 });
        case 'interception':
          return C.dire(ch('inter', [`${n(ev.joueur)} coupe la passe !`, `Passe interceptée par ${n(ev.joueur)} !`]), { frais: true, coupe: true, emotion: 0.6 });
        case 'zone':
          return C.dire(ch('zone', [`${n(ev.joueur)} a mis le pied dans la zone : le ballon change de camp.`, 'Pied dans la zone ! Le gardien récupère le ballon.']), { frais: true, emotion: 0.4 });
        case 'feinte':
          if (ev.reussi && parfois(0.5)) return C.dire(ch('feinte', [`La feinte de ${n(ev.joueur)} ! Son défenseur est dans le vent.`, `${n(ev.joueur)} efface son vis-à-vis !`]), { frais: true, emotion: 0.6 });
          return null;
        case 'mitemps':
          return C.dire(`C’est la mi-temps : ${eq(0)} ${m.score[0]} – ${m.score[1]} ${eq(1)}.`, { important: true, emotion: 0.5, apres: m.score[0] === m.score[1] ? 'Impossible de les départager pour l’instant.' : `${eq(m.score[0] > m.score[1] ? 0 : 1)} mène, mais rien n’est fait.` });
        case 'reprise':
          return C.dire(ch('reprise', ['C’est reparti pour la deuxième mi-temps !', 'Deuxième mi-temps : tout reste à faire !']), { important: true, emotion: 0.5 });
        case 'egalite':
          return C.dire(`Égalité, ${m.score[0]} partout ! Place au but en or : le premier qui marque gagne !`, { important: true, emotion: 0.9, apres: 'Les nerfs vont parler.' });
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
