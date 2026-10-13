/**
 * LE VELOURS NOIR — les tournois de poker, côté écran.
 *
 * Le serveur annonce un tournoi au hasard : une affiche s'ouvre (ou, en
 * pleine partie, un bandeau discret), avec le prix, le droit d'entrée et un
 * compte à rebours. L'inscription prend le droit d'entrée dans la caisse ;
 * il est rendu si le tournoi est annulé ou si l'on se désinscrit. Au
 * départ, la table de tournoi s'ouvre (poker.js) ; à l'élimination ou à la
 * victoire, l'écran des résultats crédite le prix.
 */

import * as EL from './enligne.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const $ = (id) => document.getElementById(id);
const CLE_INSCRIPTION = 'velours.tournoi.inscription';

export function monterTournois(app, { aller, ecranCourant, attendre = () => Promise.resolve() }) {
  let affiche = null;           // le tournoi annoncé
  let inscription = (() => { try { return JSON.parse(sessionStorage.getItem(CLE_INSCRIPTION)); } catch { return null; } })();
  let compteT = 0, finAffiche = 0;

  const noter = (x) => { inscription = x; try { if (x) sessionStorage.setItem(CLE_INSCRIPTION, JSON.stringify(x)); else sessionStorage.removeItem(CLE_INSCRIPTION); } catch { /* ignore */ } };
  const inscrit = () => !!affiche && inscription?.id === affiche.id;

  function rembourser(id) {
    if (!inscription || inscription.id !== id) return;
    app.crediter(inscription.entree);
    noter(null);
  }

  function dessiner() {
    if (!affiche) return;
    $('tn-nom').textContent = affiche.nom;
    $('tn-prix').textContent = fx.nombre(affiche.prix);
    $('tn-parts').textContent = `1er ${fx.nombre(affiche.parts[0])} · 2e ${fx.nombre(affiche.parts[1])} · 3e ${fx.nombre(affiche.parts[2])}`;
    $('tn-entree').textContent = `${fx.nombre(affiche.entree)} jetons`;
    $('tn-places').textContent = `${affiche.inscrits} / ${affiche.places} inscrits`;
    $('ov-tournoi').classList.toggle('grand', affiche.prix >= 100000);
    const b = $('tn-inscrire');
    b.textContent = inscrit() ? 'Se désinscrire' : `S’inscrire (${fx.nombre(affiche.entree)})`;
    b.classList.toggle('or', !inscrit());
    b.disabled = !inscrit() && affiche.inscrits >= affiche.places;
    $('tn-note').textContent = inscrit()
      ? 'Vous êtes inscrit ! La table s’ouvrira toute seule au début du tournoi.'
      : app.solde() < affiche.entree ? `Il vous faut ${fx.nombre(affiche.entree)} jetons : passez à la Boutique.` : 'Les places vides seront prises par les habitués du Velours.';
    $('b-tournoi').hidden = false;
    $('b-tournoi').classList.toggle('inscrit', inscrit());
    $('b-tournoi').querySelector('b').textContent = affiche.nom;
  }

  function compte() {
    clearInterval(compteT);
    const maj = () => {
      const s = Math.max(0, Math.ceil((finAffiche - Date.now()) / 1000));
      const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      $('tn-compte').textContent = txt;
      $('b-tournoi').querySelector('small').textContent = txt;
      $('toast-tournoi').querySelector('small').textContent = `début dans ${txt}`;
      if (!s) clearInterval(compteT);
    };
    maj();
    compteT = setInterval(maj, 500);
  }

  function ouvrir() {
    if (!affiche) return;
    dessiner();
    $('ov-tournoi').hidden = false;
    $('toast-tournoi').hidden = true;
  }

  function cacher() {
    affiche = null;
    clearInterval(compteT);
    $('ov-tournoi').hidden = true;
    $('b-tournoi').hidden = true;
    $('toast-tournoi').hidden = true;
  }

  $('b-tournoi').addEventListener('click', () => { sfx.clic(); ouvrir(); });
  $('toast-tournoi').addEventListener('click', () => { sfx.clic(); ouvrir(); });
  $('tn-inscrire').addEventListener('click', (e) => {
    if (!affiche) return;
    if (inscrit()) {
      EL.envoyer({ t: 'tournoi-desinscrire', id: affiche.id });
      return;
    }
    if (app.solde() < affiche.entree) { fx.secouer(e.currentTarget, 5); return dessiner(); }
    if (!app.debiter(affiche.entree)) return;
    noter({ id: affiche.id, entree: affiche.entree });
    EL.envoyer({ t: 'tournoi-inscrire', id: affiche.id, ...EL.identite(), jeton: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}` });
    sfx.jetons(6);
    fx.volerJetons(affiche.entree, document.querySelector('.ecran.is-active [data-solde]') || $('tn-inscrire'), $('tn-prix'));
    dessiner();
  });

  /* ---------- les résultats ---------- */
  async function resultat(m) {
    // la dernière main se finit d'abord à l'écran
    await Promise.race([attendre(), new Promise((r) => setTimeout(r, 15000))]);
    const gagne = m.prix > 0;
    $('tf-titre').textContent = m.vainqueur ? '🏆 Vainqueur !' : gagne ? 'Dans les places payées !' : 'Éliminé';
    $('tf-place').innerHTML = `Vous terminez <b>${m.place === 1 ? '1er' : `${m.place}e`}</b> sur ${m.sur} — ${m.nom}`;
    $('tf-prix').textContent = gagne ? `+${fx.nombre(m.prix)} jetons` : 'Pas de prix cette fois.';
    $('tf-prix').classList.toggle('gagne', gagne);
    $('ov-tournoi-fin').hidden = false;
    $('ov-tournoi-fin').classList.toggle('vainqueur', !!m.vainqueur);
    if (gagne) {
      app.crediter(m.prix);
      app.gainNet(m.prix);
      sfx.gain(true);
      fx.pluieDeJetons(m.vainqueur ? 100 : 50);
      if (m.vainqueur) { fx.flash(); fx.confettis(innerWidth / 2, innerHeight * 0.7, 120); }
    } else sfx.perte();
    if (m.vainqueur) app.succes('velours-tournoi');
    if (m.vainqueur && m.prix >= 50000) app.succes('velours-grandprix');
    app.noterTournoi({ nom: m.nom, place: m.place, sur: m.sur, prix: m.prix });
    noter(null);
  }
  $('ov-tournoi-fin').addEventListener('click', (e) => {
    if (!e.target.closest('[data-ferme]')) return;
    if (ecranCourant() === 's-poker') aller('s-hall');
  });

  EL.ecouter((m) => {
    switch (m.t) {
      case 'ouverte':
        EL.envoyer({ t: 'bonjour' });
        // une inscription d'avant le rechargement : sans nouvelles du tournoi, elle est rendue
        if (inscription) setTimeout(() => { if (inscription && (!affiche || affiche.id !== inscription.id)) rembourser(inscription.id); }, 6000);
        break;
      case 'tournoi-annonce': {
        const nouveau = !affiche || affiche.id !== m.tournoi.id;
        affiche = m.tournoi;
        finAffiche = Date.now() + m.tournoi.reste;
        if (inscription?.id === affiche.id && m.inscrit === false) rembourser(affiche.id);
        if (inscription && inscription.id !== affiche.id) rembourser(inscription.id);
        dessiner();
        compte();
        if (nouveau && m.inscrit === undefined) {
          sfx.gain(affiche.prix >= 100000);
          if (affiche.prix >= 100000) fx.pluieDeJetons(40);
          // au hall : l'affiche ; en pleine partie : un bandeau discret
          if (ecranCourant() === 's-hall' && document.querySelectorAll('.ov:not([hidden])').length === 0) ouvrir();
          else {
            $('toast-tournoi').querySelector('b').textContent = `🏆 ${affiche.nom} — ${fx.nombre(affiche.prix)} à gagner`;
            $('toast-tournoi').hidden = false;
            setTimeout(() => { $('toast-tournoi').hidden = true; }, 12000);
          }
        }
        break;
      }
      case 'tournoi-maj':
        if (!affiche || affiche.id !== m.tournoi.id) break;
        affiche = m.tournoi;
        dessiner();
        break;
      case 'tournoi-inscrit': dessiner(); fx.texte('Inscrit !', $('tn-inscrire')); break;
      case 'tournoi-refus': rembourser(m.id); $('tn-note').textContent = m.msg; dessiner(); break;
      case 'tournoi-rembourse': rembourser(m.id); dessiner(); break;
      case 'tournoi-annule':
        if (inscription?.id === m.id) { rembourser(m.id); fx.texte('Tournoi annulé : entrée rendue', $('b-tournoi')); }
        cacher();
        break;
      case 'tournoi-debut':
        if (affiche?.id === m.id) {
          const moi = inscrit();
          cacher();
          if (!moi) fx.texte('Le tournoi commence !', document.querySelector('.ecran.is-active .barre') || document.body);
        }
        break;
      case 'tournoi-fin': resultat(m); break;
    }
  });

  return { ouvrir };
}
