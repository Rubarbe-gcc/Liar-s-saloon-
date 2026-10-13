/**
 * LE VELOURS NOIR — la Boutique.
 *
 * Une mise en scène, rien de plus : des packs de jetons fictifs avec un prix
 * « pour le décor », une carte de démonstration déjà remplie (qu'on ne peut
 * pas modifier) et un terminal de paiement qui s'anime. Aucun champ ne
 * demande de vraie carte bancaire, et rien ne quitte la page.
 */

import * as succes from '../../../shared/succes.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const $ = (id) => document.getElementById(id);

export const PACKS = [
  { jetons: 1000, prix: '0,99 €', nom: 'Poignée de jetons' },
  { jetons: 5000, prix: '3,99 €', nom: 'Bourse de velours' },
  { jetons: 20000, prix: '9,99 €', nom: 'Coffret du salon', badge: 'Populaire' },
  { jetons: 100000, prix: '29,99 €', nom: 'Malle du grand flambeur', badge: 'Meilleure offre' },
];

export function monterBoutique(app) {
  let choisi = null, enCours = false;
  const packs = $('packs');

  PACKS.forEach((p, k) => {
    const b = document.createElement('button');
    b.className = 'pack';
    b.style.setProperty('--i', k);
    b.innerHTML = `${p.badge ? `<span class="pack-badge">${p.badge}</span>` : ''}
      <span class="pack-art" aria-hidden="true">${'<i></i>'.repeat(Math.min(5, k + 2))}</span>
      <b>${fx.nombre(p.jetons)}</b><small>jetons</small>
      <span class="pack-nom">${p.nom}</span>
      <em>${p.prix}</em>`;
    b.addEventListener('click', () => choisir(p, b));
    packs.appendChild(b);
  });

  function choisir(p, b) {
    if (enCours) return;
    choisi = p;
    for (const x of packs.children) x.classList.toggle('is-on', x === b);
    $('paiement').hidden = false;
    $('cb-nom').textContent = (succes.pseudo() || 'Joueur').toUpperCase();
    $('tpe-montant').textContent = p.prix;
    $('tpe-ecran').className = 'ecran-tpe';
    $('tpe-ecran').innerHTML = `Montant : <b>${p.prix}</b>`;
    $('b-payer').textContent = `Payer ${p.prix}`;
    $('b-payer').disabled = false;
    sfx.clic();
    $('paiement').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const bip = () => sfx.clic();

  $('b-payer').addEventListener('click', async () => {
    if (!choisi || enCours) return;
    enCours = true;
    $('b-payer').disabled = true;
    const ecran = $('tpe-ecran');
    const carte = document.querySelector('.carte-bancaire');
    carte.classList.add('inseree');
    const etapes = ['Lecture de la carte…', 'Connexion à la banque du casino…', 'Autorisation…'];
    for (const e of etapes) {
      ecran.textContent = e;
      bip();
      await fx.attendre(750);
    }
    ecran.className = 'ecran-tpe ok';
    ecran.innerHTML = 'Paiement accepté ✓';
    sfx.gain(true);
    carte.classList.remove('inseree');
    app.crediter(choisi.jetons);
    app.gainNet(0);
    fx.eclats($('terminal'), 40);
    fx.pluieDeJetons(choisi.jetons >= 20000 ? 90 : 45);
    fx.texte(`+${fx.nombre(choisi.jetons)}`, $('terminal'), 'gros');
    await fx.attendre(1200);
    $('b-payer').textContent = 'Merci !';
    enCours = false;
  });

  return {
    /** À chaque ouverture, on repart du choix des packs. */
    ouvrir() {
      choisi = null;
      for (const x of packs.children) x.classList.remove('is-on');
      $('paiement').hidden = true;
      $('ov-boutique').hidden = false;
    },
  };
}
