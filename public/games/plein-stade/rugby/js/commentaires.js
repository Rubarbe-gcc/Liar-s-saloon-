/**
 * RAFFUT — ce que disent les commentateurs du rugby.
 *
 * Le moteur est commun à tous les sports (commun/commentateur.js) ; le rugby
 * n'a pas encore de voix enregistrées : ses phrases s'affichent en texte
 * seulement (texteSeul), jamais lues par la synthèse du navigateur.
 */

import { creerCommentateur as moteur } from '../../commun/commentateur.js';

/** Pas de voix pour le rugby (pour l'instant) : le texte, ou rien. Un réglage à lui. */
export const REGLAGES = [['texte', 'Commentaires : texte'], ['aucun', 'Sans commentaires']];
const CLE = 'raffut.commentaires';
export let reglage = 'texte';
try { reglage = localStorage.getItem(CLE) === 'aucun' ? 'aucun' : 'texte'; } catch { /* ignore */ }
export function regler(v) {
  reglage = v === 'aucun' ? 'aucun' : 'texte';
  try { localStorage.setItem(CLE, reglage); } catch { /* ignore */ }
}

const nomCourt = (n) => n.split(' ').slice(-1)[0];
const parfois = (p) => Math.random() < p;

/**
 * Le commentateur d'un match. ctx : { nom(id) → nom complet, equipe(e) → équipe, lieu, el }
 */
export function creerCommentateur(ctx) {
  const M = moteur({ el: ctx.el, noms: { comm: 'Commentaire', cons: 'Consultant' }, texteSeul: true });
  const C = { ...M, dire: (texte, o) => (reglage === 'aucun' ? null : M.dire(texte, o)) };
  const ch = (cle, l) => C.choisir(cle, l);
  const n = (id) => (id >= 0 ? `<b>${nomCourt(ctx.nom(id))}</b>` : '');
  const eq = (e) => ctx.equipe(e).court;
  let tCons = 0, dejaUneMinute = false, serie = { e: -1, n: 0 }, phases = 0;

  return {
    debut() {
      C.dire(`Bienvenue ${ctx.lieu || ''} pour ce choc entre ${ctx.equipe(0).nom} et ${ctx.equipe(1).nom} !`, { important: true, emotion: 0.5, apres: 'Sept contre sept : il va y avoir de l’espace, et ça va courir.' });
    },
    avancer(dt, m) {
      if (m.phase !== 'jeu' && m.phase !== 'ruck') return;
      if (m.enOr || m.entrainement) return;
      tCons += dt;
      if (m.periode === 2 && !dejaUneMinute && m.duree >= 90 * 60 && m.duree - m.chrono < 60 * 60) {
        dejaUneMinute = true;
        const ecart = m.score[0] - m.score[1];
        C.dire(ecart === 0 ? 'Plus qu’une minute, et tout le monde à égalité !' : Math.abs(ecart) <= 7 ? `Une minute à jouer ! ${eq(ecart > 0 ? 1 : 0)} est encore à portée d’essai !` : 'Plus qu’une minute à jouer !', { important: true, emotion: 0.6 });
      }
      if (tCons > 24 && C.libre(3000)) {
        tCons = 0;
        const st = m.stats;
        const e = st.plaquages[0] > st.plaquages[1] + 5 ? 0 : st.plaquages[1] > st.plaquages[0] + 5 ? 1 : -1;
        if (e >= 0) C.dire(`${eq(e)} plaque beaucoup : ${st.plaquages[e]} plaquages déjà. Ils défendent, défendent…`, { role: 'cons' });
        else if (st.grattages[0] + st.grattages[1] >= 3) C.dire('Les rucks sont très disputés : on gratte beaucoup de ballons aujourd’hui.', { role: 'cons' });
        else C.dire(ch('cons', ['À sept, un plaquage raté, c’est souvent un essai.', 'Il faut fixer le défenseur avant de donner le ballon.', 'Attention aux en-avant : le ballon est glissant dans les mains.', 'La conquête en touche va peser lourd.', 'Il faut faire vivre le ballon, chercher les intervalles.']), { role: 'cons' });
      }
    },
    evenement(ev, m) {
      switch (ev.type) {
        case 'envoi':
          return parfois(0.5) ? C.dire(ch('envoi', [`Le coup d’envoi de ${n(ev.joueur)}, bien haut…`, `${n(ev.joueur)} donne le coup d’envoi.`]), { frais: true }) : null;
        case 'reception':
          if (ev.pied && ev.adverse && parfois(0.5)) return C.dire(ch('recep', [`Bien réceptionné par ${n(ev.joueur)}.`, `${n(ev.joueur)} sous la chandelle… il capte !`]), { frais: true });
          return null;
        case 'essai': {
          if (ev.equipe === serie.e) serie.n += 1; else serie = { e: ev.equipe, n: 1 };
          const qui = n(ev.joueur);
          const passe = ev.passeur >= 0 ? ` Sur une passe de ${n(ev.passeur)}.` : '';
          if (ev.enOr) return C.dire(`${qui} ! L’essai en or ! ${ctx.equipe(ev.equipe).nom} l’emporte !`, { important: true, emotion: 1 });
          return C.dire(ch('essai', [`Essai ! ${qui} aplatit !`, `${qui} file dans l’en-but ! Essai !`, `Et c’est l’essai de ${qui} !`, `${qui} marque ! Quel essai !`]) + passe, { important: true, emotion: 1, apres: serie.n >= 2 ? `${serie.n} essais de suite pour ${eq(ev.equipe)} !` : parfois(0.5) ? ch('essai-cons', ['La défense a été prise de vitesse.', 'Superbe mouvement collectif.', 'Il fallait du souffle pour aller au bout.']) : null });
        }
        case 'transfo':
          if (ev.reussi) return C.dire(ch('transfo-ok', [`${n(ev.joueur)} transforme !`, `Entre les poteaux : deux points de plus.`, `La transformation est réussie.`]), { coupe: true, emotion: 0.5 });
          return C.dire(ch('transfo-ko', [`${n(ev.joueur)} manque la transformation.`, 'À côté ! La transformation est ratée.', 'Pas de transformation.']), { coupe: true, emotion: 0.4 });
        case 'drop':
          return C.dire(ch('drop', [`Le drop de ${n(ev.joueur)}… il passe ! Trois points !`, `${n(ev.joueur)} tente le drop… réussi !`]), { important: true, emotion: 0.9 });
        case 'poteau':
          return C.dire('Sur le poteau !', { important: true, emotion: 0.8 });
        case 'plaquage':
          phases += 1;
          if (parfois(0.18)) return C.dire(ch('plaq', [`Beau plaquage de ${n(ev.joueur)}.`, `${n(ev.joueur)} stoppe ${n(ev.victime)}.`, `${n(ev.victime)} est arrêté par ${n(ev.joueur)}.`]), { frais: true });
          if (phases >= 6 && parfois(0.4)) { phases = 0; return C.dire('Les temps de jeu s’enchaînent…', { frais: true }); }
          return null;
        case 'plaquage-rate':
          if (ev.franchi) return C.dire(ch('franchi', [`${n(ev.porteur)} casse le plaquage ! Il y a de l’espace !`, `${n(ev.porteur)} passe ! Plus personne devant lui !`]), { important: true, emotion: 0.9 });
          if (parfois(0.4)) return C.dire(ch('rate', [`${n(ev.porteur)} échappe au plaquage !`, `Plaquage manqué de ${n(ev.joueur)}.`]), { frais: true, coupe: true, emotion: 0.6 });
          return null;
        case 'geste':
          if (!ev.reussi || !parfois(0.6)) return null;
          if (ev.geste === 'crochet') return C.dire(ch('crochet', [`Le crochet de ${n(ev.joueur)} ! Son vis-à-vis plonge dans le vide !`, `Cadrage-débordement de ${n(ev.joueur)} !`, `${n(ev.joueur)} efface son défenseur d’un appui !`]), { frais: true, emotion: 0.7 });
          if (ev.geste === 'roulette') return C.dire(ch('roulette', [`${n(ev.joueur)} tourne sur lui-même et repart !`, `Quelle roulette de ${n(ev.joueur)} !`]), { frais: true, emotion: 0.7 });
          return C.dire(ch('feinte', [`La feinte de passe de ${n(ev.joueur)}… la défense a mordu !`, `${n(ev.joueur)} vend la passe… et la garde !`]), { frais: true, emotion: 0.6 });
        case 'raffut':
          if (ev.reussi && parfois(0.6)) return C.dire(ch('raffut', [`Quel raffut de ${n(ev.joueur)} !`, `${n(ev.joueur)} repousse son vis-à-vis d’une main !`]), { frais: true, emotion: 0.7 });
          return null;
        case 'grattage':
          phases = 0;
          return C.dire(ch('gratte', [`Ballon gratté par ${n(ev.joueur)} !`, `${n(ev.joueur)} vole le ballon au ruck !`, `Grattage de ${n(ev.joueur)} : ${eq(ev.equipe)} récupère !`]), { important: true, emotion: 0.7 });
        case 'interception':
          return C.dire(ch('inter', [`Interception de ${n(ev.joueur)} !`, `${n(ev.joueur)} coupe la passe !`]), { important: true, emotion: 0.8 });
        case 'en-avant':
          return C.dire(ch('ea', [`En-avant de ${n(ev.joueur)}.`, `Le ballon échappe à ${n(ev.joueur)} : en-avant.`, `${n(ev.joueur)} le laisse filer vers l’avant… en-avant !`]), { coupe: true, emotion: 0.4 });
        case 'passe-avant':
          return C.dire(`Passe en avant de ${n(ev.joueur)} : l’arbitre va siffler.`, { coupe: true, emotion: 0.4 });
        case 'melee':
          return parfois(0.6) ? C.dire(`Mêlée pour ${eq(ev.equipe)}.`, { frais: true }) : null;
        case 'melee-gagnee':
          if (ev.contre) return C.dire(`${eq(ev.equipe)} gagne la mêlée contre l’introduction !`, { important: true, emotion: 0.6 });
          return null;
        case 'touche':
          return parfois(0.6) ? C.dire(`Touche pour ${eq(ev.equipe)}.`, { frais: true }) : null;
        case 'touche-gagnee':
          if (ev.vol) return C.dire(`Ballon volé en touche par ${n(ev.joueur)} !`, { important: true, emotion: 0.6 });
          return null;
        case 'pied':
          if (!ev.transfo && parfois(0.35)) return C.dire(ch('pied', [`${n(ev.joueur)} tape au pied…`, `Coup de pied de ${n(ev.joueur)}.`, `${n(ev.joueur)} dégage.`]), { frais: true });
          return null;
        case 'mort':
          return C.dire('Le ballon est mort.', { frais: true });
        case 'sirene':
          return C.dire(m.periode === 1 ? 'La sirène retentit : dernière action avant la pause !' : 'La sirène ! Dernière action du match !', { important: true, emotion: 0.8 });
        case 'mitemps':
          return C.dire(`C’est la mi-temps : ${eq(0)} ${m.score[0]} – ${m.score[1]} ${eq(1)}.`, { important: true, emotion: 0.5, apres: m.score[0] === m.score[1] ? 'Rien n’est fait, tout reste à jouer.' : `${eq(m.score[0] > m.score[1] ? 0 : 1)} mène, mais à sept, tout peut aller très vite.` });
        case 'reprise':
          return C.dire(ch('reprise', ['C’est reparti pour la deuxième mi-temps !', 'Deuxième mi-temps : on change de côté !']), { important: true, emotion: 0.5 });
        case 'egalite':
          return C.dire(`Égalité, ${m.score[0]} partout ! Place au point en or : le premier qui marque gagne !`, { important: true, emotion: 0.9, apres: 'Les nerfs vont parler.' });
        case 'fin': {
          const v = ev.vainqueur;
          if (v < 0) return null;
          if (m.score[0] === m.score[1]) return C.dire(`C’est terminé ! Personne n’a marqué : ${ctx.equipe(v).nom} l’emporte au terrain gagné !`, { important: true, emotion: 0.8 });
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
