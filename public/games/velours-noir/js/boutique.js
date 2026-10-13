/**
 * LE VELOURS NOIR — la Boutique.
 *
 * Des packs de jetons payés avec la carte de la Banque du Velours, liée au
 * compte fictif du joueur (compte.js) : si le compte ne suffit pas (au-delà
 * du découvert autorisé), le terminal refuse. La carte est déjà remplie et
 * ne se modifie pas : aucun champ ne demande de vraie carte bancaire, rien
 * ne quitte la page. On peut aussi encaisser des jetons contre des euros.
 */

import * as C from '../../../shared/casino/compte.js';
import * as succes from '../../../shared/succes.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const $ = (id) => document.getElementById(id);

/** Les prix sont en centimes (d'euros fictifs). */
export const PACKS = [
  { jetons: 1000, prix: 999, nom: 'Poignée de jetons' },
  { jetons: 5000, prix: 3999, nom: 'Bourse de velours' },
  { jetons: 20000, prix: 12999, nom: 'Coffret du salon', badge: 'Populaire' },
  { jetons: 100000, prix: 49999, nom: 'Malle du grand flambeur', badge: 'Meilleure offre' },
];
/** Ce que la caisse rend pour 1 000 jetons (en centimes). */
export const RACHAT = 500;

export function monterBoutique(app, moncompte) {
  let choisi = null, enCours = false;
  const packs = $('packs');
  const compte = () => app.compte();

  PACKS.forEach((p, k) => {
    const b = document.createElement('button');
    b.className = 'pack';
    b.style.setProperty('--i', k);
    b.innerHTML = `${p.badge ? `<span class="pack-badge">${p.badge}</span>` : ''}
      <span class="pack-art" aria-hidden="true">${'<i></i>'.repeat(Math.min(5, k + 2))}</span>
      <b>${fx.nombre(p.jetons)}</b><small>jetons</small>
      <span class="pack-nom">${p.nom}</span>
      <em>${C.euros(p.prix)}</em>`;
    b.addEventListener('click', () => choisir(p, b));
    packs.appendChild(b);
  });

  function majSoldes() {
    $('bq-solde').textContent = C.euros(compte().solde);
    $('bq-solde').classList.toggle('rouge', compte().solde < 0);
    moncompte.majBouton();
    const r = $('enc-curseur');
    const max = Math.floor(app.solde() / 1000) * 1000;
    r.max = max;
    if (Number(r.value) > max) r.value = max;
    majEncaisser();
  }

  function choisir(p, b) {
    if (enCours) return;
    choisi = p;
    for (const x of packs.children) x.classList.toggle('is-on', x === b);
    $('paiement').hidden = false;
    $('cb-nom').textContent = (succes.pseudo() || 'Joueur').toUpperCase();
    $('tpe-ecran').className = 'ecran-tpe';
    $('tpe-ecran').innerHTML = `Montant : <b>${C.euros(p.prix)}</b>`;
    $('b-payer').textContent = `Payer ${C.euros(p.prix)}`;
    $('b-payer').disabled = false;
    sfx.clic();
    $('paiement').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('b-payer').addEventListener('click', async () => {
    if (!choisi || enCours) return;
    enCours = true;
    $('b-payer').disabled = true;
    const ecran = $('tpe-ecran');
    const carte = document.querySelector('.carte-bancaire');
    carte.classList.add('inseree');
    for (const e of ['Lecture de la carte…', 'Connexion à la Banque du Velours…', 'Autorisation…']) {
      ecran.textContent = e;
      sfx.clic();
      await fx.attendre(750);
    }
    carte.classList.remove('inseree');
    if (!C.payer(compte(), choisi.prix, `Velours Noir – achat de ${fx.nombre(choisi.jetons)} jetons`)) {
      ecran.className = 'ecran-tpe refuse';
      ecran.innerHTML = 'Paiement refusé<br>Solde insuffisant';
      sfx.perte();
      fx.secouer($('terminal'), 6);
      $('b-payer').textContent = 'Paiement refusé';
      enCours = false;
      return;
    }
    app.sauverCompte();
    ecran.className = 'ecran-tpe ok';
    ecran.innerHTML = 'Paiement accepté ✓';
    sfx.gain(true);
    app.crediter(choisi.jetons);
    app.gainNet(0);
    majSoldes();
    fx.eclats($('terminal'), 40);
    fx.pluieDeJetons(choisi.jetons >= 20000 ? 90 : 45);
    fx.texte(`+${fx.nombre(choisi.jetons)}`, $('terminal'), 'gros');
    await fx.attendre(1200);
    $('b-payer').textContent = 'Merci !';
    enCours = false;
  });

  /* encaisser des jetons */
  function majEncaisser() {
    const n = Number($('enc-curseur').value) || 0;
    $('enc-val').textContent = `${fx.nombre(n)} jetons → ${C.euros((n / 1000) * RACHAT)}`;
    $('b-encaisser').disabled = n <= 0;
  }
  $('enc-curseur').addEventListener('input', majEncaisser);
  $('b-encaisser').addEventListener('click', (e) => {
    const n = Number($('enc-curseur').value) || 0;
    if (n <= 0 || n > app.solde() || !app.debiter(n)) return;
    C.encaisser(compte(), (n / 1000) * RACHAT, `Velours Noir – ${fx.nombre(n)} jetons encaissés`);
    app.sauverCompte();
    sfx.jetons(8);
    fx.texte(`+${C.euros((n / 1000) * RACHAT)}`, e.currentTarget);
    $('enc-curseur').value = 0;
    majSoldes();
  });

  return {
    /** À chaque ouverture, on repart du choix des packs. */
    ouvrir() {
      choisi = null;
      for (const x of packs.children) x.classList.remove('is-on');
      $('paiement').hidden = true;
      $('enc-curseur').value = 0;
      majSoldes();
      $('ov-boutique').hidden = false;
    },
  };
}
