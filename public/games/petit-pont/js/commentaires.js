/**
 * PETIT PONT — le commentateur.
 *
 * À partir des événements du match (moteur : shared/foot/match.js), une
 * phrase courte, au ton d'un commentaire télé, affichée en bas de l'écran
 * (et lue à voix haute si le joueur l'a choisi). Pas de bavardage : une
 * phrase banale (une frappe, un tacle) attend que la précédente ait eu le
 * temps d'être lue ; un but, un poteau ou un arrêt passent toujours.
 */

const CLE = 'petitpont.commentaires';
/** 'texte', 'voix' (texte et voix) ou 'aucun'. */
export let reglage = 'texte';
try { reglage = localStorage.getItem(CLE) || 'texte'; } catch { /* ignore */ }
export function regler(v) {
  reglage = v;
  try { localStorage.setItem(CLE, v); } catch { /* ignore */ }
  if (v !== 'voix') speechSynthesis?.cancel?.();
}

const choisir = (l) => l[Math.floor(Math.random() * l.length)];
const nomCourt = (n) => n.split(' ').slice(-1)[0];

/**
 * Le commentateur d'un match. ctx : { nom(id) → nom complet, equipe(e) → équipe, stade, el (l'élément où écrire) }
 */
export function creerCommentateur(ctx) {
  let dernier = -99, temps = 0, minuteur = 0, dejaTrente = false;
  const el = ctx.el;

  function dire(texte, important = false) {
    if (reglage === 'aucun' || !texte) return;
    if (!important && temps - dernier < 2.2) return;
    dernier = temps;
    el.innerHTML = `<span class="micro" aria-hidden="true">🎙️</span>${texte}`;
    el.classList.remove('montre');
    void el.offsetWidth;
    el.classList.add('montre');
    clearTimeout(minuteur);
    minuteur = setTimeout(() => el.classList.remove('montre'), important ? 4200 : 3000);
    if (reglage === 'voix' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(texte.replace(/<[^>]+>/g, ''));
      u.lang = 'fr-FR';
      u.rate = important ? 1.15 : 1.08;
      u.pitch = important ? 1.2 : 1;
      if (important) speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  }

  return {
    /** Le temps qui passe (pour ne pas parler trop souvent). */
    avancer(dt, m) {
      temps += dt;
      if (!dejaTrente && m.mi === 2 && m.phase === 'jeu' && m.duree - m.chrono < 30 * 60 && m.duree > 60 * 60) {
        dejaTrente = true;
        dire(m.score[0] === m.score[1] ? 'Plus que trente secondes, et tout est encore possible !' : 'Plus que trente secondes à jouer !', true);
      }
    },
    debut(m) {
      const [a, b] = [ctx.equipe(0), ctx.equipe(1)];
      dire(choisir([`Bienvenue ${ctx.stade} pour ce ${a.court} – ${b.court} !`, `C'est parti ${ctx.stade} : ${a.nom} contre ${b.nom} !`]), true);
      void m;
    },
    evenement(ev, m) {
      const n = (id) => (id >= 0 ? `<b>${nomCourt(ctx.nom(id))}</b>` : '');
      switch (ev.type) {
        case 'tir':
          if (m.phase === 'tab') return;
          if (ev.geste === 'volee') return dire(choisir([`Reprise de volée de ${n(ev.joueur)} !!`, `Quelle reprise de volée de ${n(ev.joueur)} !`, `${n(ev.joueur)} la reprend de volée !`]), true);
          if (ev.geste === 'premiere') return dire(choisir([`${n(ev.joueur)} frappe en une touche !`, `Du premier coup, ${n(ev.joueur)} !`]), true);
          if (ev.distance > 15) return dire(choisir([`${n(ev.joueur)} tente sa chance de loin…`, `Frappe lointaine de ${n(ev.joueur)} !`, `${n(ev.joueur)} déclenche de très loin !`]));
          if (ev.puissance > 0.85) return dire(choisir([`Une mine de ${n(ev.joueur)} !`, `${n(ev.joueur)} frappe fort !`, `Quelle frappe de ${n(ev.joueur)} !`]));
          return dire(choisir([`${n(ev.joueur)} frappe !`, `Tir de ${n(ev.joueur)}…`, `${n(ev.joueur)} tente le cadre !`]));
        case 'passe':
          if (ev.lob && Math.random() < 0.4) dire(choisir([`${n(ev.joueur)} cherche ${n(ev.cible)} par-dessus…`, `Ballon piqué de ${n(ev.joueur)}.`]));
          return;
        case 'arret':
          if (m.phase === 'tab') return dire(choisir([`${n(ev.joueur)} détourne la tentative !`, `Arrêté par ${n(ev.joueur)} !`]), true);
          if (ev.capte) return dire(choisir([`Bien capté par ${n(ev.joueur)}.`, `${n(ev.joueur)} s'interpose et bloque le ballon.`, `Pas de souci pour ${n(ev.joueur)}.`]), true);
          return dire(choisir([`Parade de ${n(ev.joueur)} !`, `Quel réflexe de ${n(ev.joueur)} !`, `${n(ev.joueur)} repousse !`]), true);
        case 'poteau':
          return dire(ev.barre ? choisir(['Sur la barre !!', 'La transversale tremble encore !']) : choisir(['Sur le poteau !!', 'Le poteau sauve le gardien !']), true);
        case 'tacle':
          if (ev.reussi) return dire(choisir([`Tacle parfait de ${n(ev.joueur)} !`, `${n(ev.joueur)} récupère proprement.`, `Superbe intervention de ${n(ev.joueur)}.`]));
          return dire(choisir([`${n(ev.joueur)} arrive trop tard…`, `${n(ev.joueur)} manque son tacle.`]));
        case 'vol':
          return dire(choisir([`${n(ev.joueur)} chipe le ballon à ${n(ev.victime)}.`, `Bien joué ${n(ev.joueur)}, ballon récupéré.`]));
        case 'but': {
          const eq = ctx.equipe(ev.equipe);
          const [s, t] = [m.score[ev.equipe], m.score[1 - ev.equipe]];
          const etat = s === t ? `${eq.court} égalise !` : s === t + 1 ? `${eq.court} passe devant !` : `${eq.court} creuse l'écart !`;
          if (ev.csc) return dire(`Contre son camp de ${n(ev.joueur)}… cruel ! ${etat}`, true);
          const passe = ev.passeur >= 0 ? ` Sur un service de ${n(ev.passeur)}.` : '';
          return dire(`BUT de ${n(ev.joueur)} !!! ${etat}${passe}`, true);
        }
        case 'mitemps':
          return dire(`C'est la pause. ${ctx.equipe(0).court} ${m.score[0]} – ${m.score[1]} ${ctx.equipe(1).court}.`, true);
        case 'reprise':
          return dire(choisir(['Les deux équipes reviennent pour la seconde période !', "C'est reparti pour la deuxième mi-temps !"]), true);
        case 'tab':
          return dire('Égalité ! Place à la loterie des tirs au but…', true);
        case 'tab-but':
          return dire(choisir([`${n(ev.joueur)} ne tremble pas !`, `Transformé par ${n(ev.joueur)} !`]), true);
        case 'tab-rate':
          return dire(choisir([`${n(ev.joueur)} manque le cadre !`, `À côté pour ${n(ev.joueur)}…`]), true);
        case 'fin': {
          const v = ev.vainqueur;
          if (v < 0) return dire(`C'est terminé : match nul, ${m.score[0]} partout.`, true);
          return dire(`C'est terminé ! Victoire de ${ctx.equipe(v).nom}${ev.tab ? ' aux tirs au but' : ''} !`, true);
        }
        default:
      }
    },
    arreter() { clearTimeout(minuteur); el.classList.remove('montre'); if (window.speechSynthesis) speechSynthesis.cancel(); },
  };
}
