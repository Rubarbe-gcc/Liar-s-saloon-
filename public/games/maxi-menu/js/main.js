/**
 * MAXI MENU — l'application : accueil, ouverture des boosters, albums,
 * boutique, tirages et fiches des cartes. Tout est gardé dans le navigateur.
 */

import { CARTES, RARETES, ORDRE_RARETES, ENSEIGNES, ORDRE_ENSEIGNES, PAR_ID } from '../../../shared/maximenu/cartes.js';
import * as J from '../../../shared/maximenu/jeu.js';
import { makeRng } from '../../../shared/hasard.js';
import { dessinCarte, emblemeEnseigne } from './dessins.js';
import * as son from './sons.js';
import * as B from '../../../shared/casino/banque.js';
import * as C from '../../../shared/casino/compte.js';
import * as succes from '../../../shared/succes.js';

/*
 * Photos des produits et logos des enseignes (Wikimedia Commons) : ../photos/credits.json
 * donne, pour chaque carte (ou `logo-<enseigne>`), le fichier, l'auteur, la licence et la source.
 * Sans photo, la carte garde son dessin.
 */
const CREDITS = await fetch(new URL('../photos/credits.json', import.meta.url)).then(r => r.json()).catch(() => ({}));
for (const [id, v] of Object.entries(CREDITS)) {
  const url = new URL(`../photos/${v.fichier}`, import.meta.url).href;
  if (id.startsWith('logo-')) { if (ENSEIGNES[id.slice(5)]) ENSEIGNES[id.slice(5)].logo = url; }
  else if (PAR_ID.has(id)) PAR_ID.get(id).image = url;
}
const echapper = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const credit = id => {
  const v = CREDITS[id];
  return v ? `Photo : ${echapper(v.auteur || 'auteur inconnu')} · ${echapper(v.licence || '')} · <a href="${echapper(v.source)}" target="_blank" rel="noopener">${echapper(new URL(v.source).hostname.replace(/^www./, ""))}</a>` : '';
};

const $ = s => document.querySelector(s);
const CLE = 'maximenu.sauvegarde';
const maintenant = () => Date.now();
const nouveauRng = () => makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);

/* ------------------------------------------------------------ sauvegarde */
let etat;
try { etat = JSON.parse(localStorage.getItem(CLE)); } catch { etat = null; }
if (!etat || etat.version !== 1) etat = J.creerEtat(maintenant());
etat.cadeaux = etat.cadeaux || 0;
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* rien */ } };

J.recharger(etat, maintenant());
if (J.noterVisite(etat, maintenant()).cadeau) { etat.cadeaux++; setTimeout(() => toast('🎁 7 jours d’affilée ! Un booster prestige vous attend.'), 600); }
sauver();

/* ------------------------------------------------------------ outils d'affichage */
const fmtFrites = n => n.toLocaleString('fr-FR');
function duree(ms) {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
const finDuJour = t => { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); };

/** L'emblème d'une enseigne : son logo s'il y en a un (version perso), sinon le dessin du jeu. */
function embleme(e, taille) {
  return e.logo ? `<img class="logo-img" src="${e.logo}" width="${taille}" height="${taille}" alt="">` : emblemeEnseigne(e, taille);
}

function carteHTML(c, { compte = 0, nouveau = false, manquante = false, id = true } = {}) {
  const e = ENSEIGNES[c.enseigne];
  if (manquante) {
    return `<div class="carte manquante ${c.rarete}" ${id ? `data-carte="${c.id}"` : ''}><span class="rarete">${RARETES[c.rarete].nom}</span><div class="interieur">?</div></div>`;
  }
  return `<div class="carte ${c.rarete}" ${id ? `data-carte="${c.id}"` : ''} style="--e1:${e.couleurs[0]}33;--e1b:${e.couleurs[0]}88">
    <div class="interieur">
      <div class="art">${c.image ? `<img class="photo" src="${c.image}" alt="" loading="lazy">` : dessinCarte(c, e.couleurs)}<span class="badge">${embleme(e, 34)}</span><span class="rarete">${RARETES[c.rarete].nom}</span></div>
      <div class="bas"><div class="nom">${c.nom}</div><div class="enseigne">${e.court}</div></div>
    </div>
    ${compte > 1 ? `<span class="compte">×${compte}</span>` : ''}${nouveau ? '<span class="nouveau">NOUVEAU</span>' : ''}
  </div>`;
}

function paquetHTML(titre, sous, [p1, p2], embleme = '') {
  return `<div class="paquet" style="--p1:${p1};--p2:${p2}"><div class="dents"></div>${embleme ? `<div class="emb">${embleme}</div>` : ''}<div class="titre-paquet">${titre}<small>${sous}</small></div></div>`;
}

let minuteurToast = 0;
function toast(texte) {
  const t = $('#toast');
  t.textContent = texte;
  t.hidden = false;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { t.hidden = true; }, 3200);
}

function majCompteurs() {
  $('#c-frites').textContent = fmtFrites(etat.frites);
  const p = J.progression(etat);
  $('#c-collec').textContent = `${p.possedees}/${p.total}`;
  $('#b-son').textContent = son.sonActif() ? '🔊' : '🔇';
}

/* ------------------------------------------------------------ vues */
let vue = 'accueil', albumOuvert = null;

function afficher(v = vue) {
  vue = v;
  for (const b of document.querySelectorAll('.onglets button')) b.classList.toggle('actif', b.dataset.vue === vue);
  const ecran = $('#ecran');
  ecran.innerHTML = VUES[vue]();
  majCompteurs();
  if (vue === 'accueil') majMinuteurs();
}

const VUES = {
  accueil() {
    const t = maintenant();
    J.recharger(etat, t);
    const jour = J.jourDe(t), ens = ENSEIGNES[J.enseigneDuJour(jour)];
    const dispo = J.packDuJourDispo(etat, t);
    const p = J.progression(etat), d = J.valeurDoublons(etat);
    const s = etat.serie.compte;
    return `<div class="tuiles">
      <section class="tuile jour" style="--c1:${ens.couleurs[0]}">
        <span class="etiquette">PACK DU JOUR · GRATUIT</span>
        <div style="display:flex;gap:12px;align-items:center">${embleme(ens, 52)}<div><h3>${ens.nom}</h3><p>${ens.devise}</p></div></div>
        <p>Cinq cartes de l’enseigne du jour, avec une <b>Épique ou mieux garantie</b>.</p>
        ${dispo ? '<button class="btn jaune" id="b-jour">🎁 Ouvrir le pack du jour</button>'
          : `<button class="btn" disabled>Déjà ouvert · prochain dans <span data-minuteur="jour"></span></button>`}
      </section>
      <section class="tuile">
        <h3>🍔 Boosters gratuits</h3>
        <div class="grand">${etat.stock}<small style="font-size:1rem;color:var(--pale)"> / ${J.REGLES.stockMax}</small></div>
        <div class="jauge"><i style="width:${etat.stock / J.REGLES.stockMax * 100}%"></i></div>
        <p>${etat.stock >= J.REGLES.stockMax ? 'Réserve pleine : ouvrez-en un !' : 'Prochain booster gratuit dans <b data-minuteur="recharge"></b>'}</p>
        <div class="lot-btns"><button class="btn rouge" id="b-gratuit" data-n="1" ${etat.stock ? '' : 'disabled'}>Ouvrir un booster</button>
          ${[5, 10].filter(n => (n === 5 ? etat.stock >= 2 : etat.stock > 5)).map(n => `<button class="btn rouge" id="b-gratuit" data-n="${n}">×${Math.min(n, etat.stock)}</button>`).join('')}</div>
      </section>
      <section class="tuile">
        <h3>📅 Série de visites</h3>
        <div class="serie">${Array.from({ length: J.REGLES.serie }, (_, i) => `<span class="${i < s ? 'ok' : i === J.REGLES.serie - 1 ? 'cadeau' : ''}">${i === J.REGLES.serie - 1 ? '🎁' : `J${i + 1}`}</span>`).join('')}</div>
        <p>Revenez chaque jour : au 7ᵉ jour d’affilée, un <b>booster prestige</b> (Légendaire garantie) est offert.</p>
        ${etat.cadeaux ? `<button class="btn jaune" id="b-cadeau">🎁 Ouvrir le cadeau de la série${etat.cadeaux > 1 ? ` (×${etat.cadeaux})` : ''}</button>` : ''}
      </section>
      <section class="tuile">
        <h3>📒 Ma collection</h3>
        <div class="grand">${p.possedees}<small style="font-size:1rem;color:var(--pale)"> / ${p.total} cartes</small></div>
        <div class="jauge"><i style="width:${p.possedees / p.total * 100}%"></i></div>
        <p>${d.n ? `${d.n} doublon${d.n > 1 ? 's' : ''} à recycler pour <b>${fmtFrites(d.gain)} 🍟</b>.` : 'Aucun doublon pour l’instant.'}</p>
        <button class="btn" id="b-recycler" ${d.n ? '' : 'disabled'}>♻️ Recycler les doublons</button>
      </section>
      ${tuileMissions(t)}
    </div>
    <div class="etapes">
      <div class="etape"><b>1</b><p><strong>Ouvrez des boosters.</strong> Des gratuits se rechargent toute la journée, et la boutique en vend contre des frites d’or.</p></div>
      <div class="etape"><b>2</b><p><strong>Complétez les albums.</strong> Une enseigne, trente cartes, de la Commune à la Mythique. Un album complet rapporte 1 000 🍟.</p></div>
      <div class="etape"><b>3</b><p><strong>Recyclez les doublons</strong> en frites d’or, et découvrez la fiche de chaque carte obtenue.</p></div>
    </div>
    <p class="mentions">Jeu de fan gratuit et non officiel, sans lien avec les enseignes citées. Les marques et logos appartiennent à leurs propriétaires.
      Photos : sites des enseignes et Wikimedia Commons, la source de chaque photo est dans la fiche de la carte. Argent et carte bancaire fictifs. Calories et prix indicatifs.</p>`;
  },
  albums() {
    if (albumOuvert) {
      const e = ENSEIGNES[albumOuvert], a = J.album(etat, albumOuvert);
      return `<div class="entete-album"><button class="btn" id="b-albums">←</button>${embleme(e, 46)}<div><h2>${e.nom}</h2><p class="sous" style="margin:0">${a.possedees} / ${a.total} cartes · « ${e.devise} »</p></div></div>
        ${a.complet && !a.recompensePrise ? `<p style="margin:12px 0"><button class="btn jaune" id="b-recompense" data-ens="${albumOuvert}">🏆 Album complet : prendre ${J.REGLES.albumComplet} 🍟</button></p>` : ''}
        ${a.recompensePrise ? '<p class="sous" style="margin:10px 0">🏆 Album complété : récompense déjà prise.</p>' : ''}
        <div class="grille" style="margin-top:14px">${a.cartes.map(c => carteHTML(c, { compte: etat.collection[c.id] || 0, manquante: !etat.collection[c.id] })).join('')}</div>`;
    }
    return `<h2>Les albums</h2><p class="sous">Une enseigne par album. Touchez une carte pour voir sa fiche.</p>
      <div class="albums">${ORDRE_ENSEIGNES.map(k => {
        const e = ENSEIGNES[k], a = J.album(etat, k);
        return `<button class="album" data-album="${k}" style="--c1:${e.couleurs[0]}">${embleme(e, 48)}
          <span class="infos"><b>${e.nom}</b><small>${a.possedees} / ${a.total}${a.recompensePrise ? ' · 🏆' : a.complet ? ' · récompense à prendre !' : ''}</small><span class="jauge"><i style="width:${a.possedees / a.total * 100}%"></i></span></span></button>`;
      }).join('')}</div>`;
  },
  boutique() {
    const d = J.valeurDoublons(etat);
    const o = J.BOUTIQUE;
    // Un, cinq ou dix boosters d'un coup.
    const achats = (sorte, classe) => `<div class="lot-btns">${[1, 5, 10].map(n => {
      const prix = o[sorte].prix * n;
      return `<button class="btn ${classe}" data-acheter="${sorte}" data-n="${n}" ${etat.frites < prix ? 'disabled' : ''}>${n > 1 ? `×${n} · ` : ''}${fmtFrites(prix)} 🍟</button>`;
    }).join('')}</div>`;
    return `<h2>La boutique</h2><p class="sous">Vos frites d’or : <b>${fmtFrites(etat.frites)} 🍟</b>. Gagnez-en en recyclant vos doublons et en complétant des albums.</p>
      <div class="offres">
        <div class="offre">${paquetHTML('MAXI', 'classique', ['#e3262f', '#ffc72c'])}<b>${o.classique.nom}</b><p>${o.classique.desc}</p>
          ${achats('classique', 'rouge')}</div>
        <div class="offre">${paquetHTML('MAXI', 'enseigne', ['#11519c', '#ffc72c'])}<b>${o.enseigne.nom}</b><p>${o.enseigne.desc}</p>
          <select id="choix-enseigne" aria-label="Enseigne">${ORDRE_ENSEIGNES.map(k => `<option value="${k}">${ENSEIGNES[k].nom}</option>`).join('')}</select>
          ${achats('enseigne', 'rouge')}</div>
        <div class="offre">${paquetHTML('MAXI', 'prestige', ['#ff4f9a', '#ffb52e'])}<b>${o.prestige.nom}</b><p>${o.prestige.desc}</p>
          ${achats('prestige', 'jaune')}</div>
      </div>
      ${tuileCaisse()}
      <div class="tuile doublons"><h3>♻️ Recyclage</h3>
        <p>On garde toujours un exemplaire de chaque carte. Chaque doublon rapporte : Commune ${RARETES.commune.recyclage} · Rare ${RARETES.rare.recyclage} · Épique ${RARETES.epique.recyclage} · Légendaire ${RARETES.legendaire.recyclage} · Mythique ${RARETES.mythique.recyclage} 🍟.</p>
        <button class="btn" id="b-recycler" ${d.n ? '' : 'disabled'}>Recycler ${d.n} doublon${d.n > 1 ? 's' : ''} : +${fmtFrites(d.gain)} 🍟</button></div>`;
  },
  tirages() {
    const s = etat.stats;
    const lignes = etat.gros.map(g => {
      const c = PAR_ID.get(g.id);
      if (!c) return '';
      return `<div class="ligne" data-carte="${c.id}"><span class="mini">${carteHTML(c, { id: false })}</span><span><b>${c.nom}</b><br><small style="color:${RARETES[c.rarete].couleur}">${RARETES[c.rarete].nom}</small> <small>· ${ENSEIGNES[c.enseigne].court} · ${new Date(g.quand).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small></span></div>`;
    }).join('');
    return `<h2>Mes plus beaux tirages</h2><p class="sous">${s.boosters} booster${s.boosters > 1 ? 's' : ''} ouvert${s.boosters > 1 ? 's' : ''} · ${s.cartes} cartes tirées · ${s.recyclees} recyclées</p>
      <div class="liste">${lignes || '<p class="vide">Vos cartes Épiques, Légendaires et Mythiques apparaîtront ici.</p>'}</div>`;
  },
};

/*
 * La caisse : des frites d'or payées avec la carte de la Banque du Velours, c'est-à-dire
 * le même compte fictif que le casino (shared/casino : clé velours.banque). La carte est
 * déjà remplie et ne se modifie pas : aucun champ de vraie carte, rien ne quitte la page.
 * Les prix sont en centimes d'euros fictifs.
 */
const PACKS_FRITES = [
  { frites: 500, prix: 999, nom: 'Petit cornet' },
  { frites: 1500, prix: 2499, nom: 'Moyen cornet' },
  { frites: 5000, prix: 6999, nom: 'Grand cornet', badge: 'Populaire' },
  { frites: 15000, prix: 17999, nom: 'Seau de frites', badge: 'Meilleure offre' },
];
let packChoisi = null, paiementEnCours = false;
const banque = () => B.lire(localStorage);

function tuileCaisse() {
  const solde = banque().compte.solde;
  return `<div class="tuile caisse"><h3>💳 Acheter des frites d’or</h3>
    <p class="fictif">🎭 Banque et argent fictifs : c’est ton compte de la Banque du Velours, le même qu’au casino. Aucun vrai paiement.</p>
    <p>Ton compte : <b id="mm-solde" class="${solde < 0 ? 'rouge' : ''}">${C.euros(solde)}</b></p>
    <div class="packs-frites">${PACKS_FRITES.map((p, k) => `<button class="pack-frites${packChoisi === k ? ' is-on' : ''}" data-frites="${k}">
      ${p.badge ? `<span class="pack-badge">${p.badge}</span>` : ''}<b>${fmtFrites(p.frites)} 🍟</b><span>${p.nom}</span><em>${C.euros(p.prix)}</em></button>`).join('')}</div>
    <div class="paiement" id="mm-paiement" ${packChoisi === null ? 'hidden' : ''}>
      <div class="carte-bancaire" aria-label="Carte de démonstration du casino">
        <span class="cb-puce"></span><span class="cb-logo">VN</span>
        <span class="cb-numero">4970 •••• •••• 1926</span>
        <span class="cb-nom">${echapper((succes.pseudo?.() || 'Joueur').toUpperCase())}</span>
        <span class="cb-exp">12/99</span><span class="cb-demo">CARTE DE DÉMONSTRATION</span>
      </div>
      <div class="terminal" id="mm-terminal">
        <div class="ecran-tpe" id="mm-ecran">${packChoisi === null ? '' : `Montant : <b>${C.euros(PACKS_FRITES[packChoisi].prix)}</b>`}</div>
        <div class="touches-tpe" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i class="v"></i><i></i><i class="r"></i></div>
      </div>
      <button class="btn jaune" id="mm-payer">${packChoisi === null ? 'Payer' : `Payer ${C.euros(PACKS_FRITES[packChoisi].prix)}`}</button>
    </div>
  </div>`;
}

function choisirPackFrites(k) {
  if (paiementEnCours) return;
  packChoisi = k;
  son.jouer('clic');
  afficher();
  $('#mm-paiement')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const attendre = ms => new Promise(r => setTimeout(r, ms));
async function payerFrites() {
  if (packChoisi === null || paiementEnCours) return;
  const p = PACKS_FRITES[packChoisi];
  paiementEnCours = true;
  const bouton = $('#mm-payer'), ecran = $('#mm-ecran'), carte = document.querySelector('.carte-bancaire');
  bouton.disabled = true;
  carte.classList.add('inseree');
  for (const e of ['Lecture de la carte…', 'Connexion à la Banque du Velours…', 'Autorisation…']) {
    ecran.textContent = e;
    son.jouer('clic');
    await attendre(750);
  }
  carte.classList.remove('inseree');
  const b = banque(); // relu au dernier moment : le casino a pu le changer
  if (!C.payer(b.compte, p.prix, `Maxi Menu – ${fmtFrites(p.frites)} frites d’or`)) {
    ecran.className = 'ecran-tpe refuse';
    ecran.innerHTML = 'Paiement refusé<br>Solde insuffisant';
    son.jouer('refus');
    $('#mm-terminal').classList.add('secoue');
    bouton.textContent = 'Paiement refusé';
    paiementEnCours = false;
    return;
  }
  B.ecrire(localStorage, b);
  etat.frites += p.frites;
  sauver();
  ecran.className = 'ecran-tpe ok';
  ecran.innerHTML = 'Paiement accepté ✓';
  son.jouer('pieces');
  toast(`+${fmtFrites(p.frites)} 🍟 de frites d’or !`);
  majCompteurs();
  $('#mm-solde').textContent = C.euros(b.compte.solde);
  $('#mm-solde').classList.toggle('rouge', b.compte.solde < 0);
  bouton.textContent = 'Merci !';
  await attendre(1400);
  paiementEnCours = false;
  packChoisi = null;
  if (vue === 'boutique' && $('#ouverture').hidden) afficher();
}

/** Les missions du jour : de quoi gagner des frites d'or en jouant. */
function tuileMissions(t) {
  const { liste, bonusDispo, bonusPris } = J.missions(etat, t);
  return `<section class="tuile missions">
    <h3>🎯 Missions du jour</h3>
    <ul>${liste.map(m => `<li class="${m.prise ? 'prise' : m.finie ? 'finie' : ''}">
      <span class="m-texte">${m.texte}<small>${m.fait} / ${m.but}</small></span>
      <span class="jauge"><i style="width:${m.fait / m.but * 100}%"></i></span>
      ${m.prise ? '<span class="m-ok">✓</span>' : `<button class="btn ${m.finie ? 'jaune' : ''}" data-mission="${m.id}" ${m.finie ? '' : 'disabled'}>+${m.gain} 🍟</button>`}
    </li>`).join('')}</ul>
    <p>${bonusPris ? 'Toutes les missions sont faites : à demain pour de nouvelles !' : `Toutes faites : <b>+${J.BONUS_MISSIONS} 🍟</b> en bonus. Nouvelles missions chaque jour.`}</p>
    ${bonusDispo ? `<button class="btn jaune" id="b-bonus-missions">🏆 Prendre le bonus : +${J.BONUS_MISSIONS} 🍟</button>` : ''}
  </section>`;
}

function majMinuteurs() {
  const t = maintenant();
  for (const el of document.querySelectorAll('[data-minuteur]')) {
    el.textContent = duree(el.dataset.minuteur === 'jour' ? finDuJour(t) - t : J.attenteRecharge(etat, t));
  }
}
setInterval(() => {
  const avant = etat.stock;
  if (J.recharger(etat, maintenant()) > 0) sauver();
  if (vue === 'accueil' && $('#ouverture').hidden) {
    if (etat.stock !== avant || (!J.packDuJourDispo(etat, maintenant()) && !document.querySelector('[data-minuteur="jour"]'))) afficher();
    majMinuteurs();
  }
}, 1000);

/* ------------------------------------------------------------ ouverture d'un booster */
const SONS_RARETE = { commune: 'commune', rare: 'rare', epique: 'epique', legendaire: 'legendaire', mythique: 'mythique' };

/*
 * Une ouverture = un ou plusieurs boosters. Chaque paquet fermé brille de la couleur de la
 * meilleure carte qu'il contient. Avec plusieurs boosters, on les voit tous d'un coup, chacun
 * avec sa lumière : on les ouvre un par un, ou bien « Aller jusqu'à la Légendaire / l'Épique »
 * rassemble toutes les cartes et les dévoile rangées par rareté, jusqu'à la plus belle.
 */
let session = null;
const rangMax = tirage => Math.max(...tirage.map(t => RARETES[t.carte.rarete].rang));
const rareteDuRang = rang => Object.keys(RARETES).find(r => RARETES[r].rang === rang);
const rangDe = t => RARETES[t.carte.rarete].rang;

function ouvrir(paquets, { titre = 'MAXI', sous = 'booster', couleurs = ['#e3262f', '#ffc72c'], embleme = '' } = {}) {
  if (!Array.isArray(paquets[0])) paquets = [paquets]; // un seul booster
  sauver();
  majCompteurs();
  session = { paquets, style: { titre, sous, couleurs, embleme }, ouverts: new Set(), jeton: 0 };
  $('#ouverture').hidden = false;
  if (paquets.length > 1) montrerLot(); else montrerPaquet(0);
}

/** Un paquet qui brille de la couleur de sa meilleure carte. */
function paquetLumineux(k, petit = false) {
  const { paquets, style } = session;
  const r = rareteDuRang(rangMax(paquets[k]));
  const html = paquetHTML(style.titre, style.sous, style.couleurs, style.embleme)
    .replace('<div class="paquet" style="', `<div class="paquet tremble lumiere lum-${r}${petit ? ' petit' : ''}" data-paquet="${k}" style="--lum:${RARETES[r].couleur};`);
  return { html, r };
}

/** Les boutons « aller jusqu'à » : seulement si l'ouverture contient cette rareté. */
function raccourcis() {
  const toutes = session.paquets.flat();
  const max = Math.max(...toutes.map(rangDe));
  const btns = [];
  if (max >= 3) btns.push(`<button class="btn jaune" data-jusqua="3">⭐ Aller jusqu’à la ${max === 4 ? 'Mythique' : 'Légendaire'}</button>`);
  if (toutes.some(t => rangDe(t) === 2)) btns.push('<button class="btn" data-jusqua="2">💜 Aller jusqu’à l’Épique</button>');
  btns.push('<button class="btn" id="b-tout">Tout révéler</button>');
  return `<div class="lot-btns raccourcis">${btns.join('')}</div>`;
}
function brancherRaccourcis() {
  for (const b of document.querySelectorAll('#ouv-actions [data-jusqua]')) b.onclick = () => { son.jouer('clic'); rangement(+b.dataset.jusqua); };
  const tout = $('#b-tout');
  if (tout) tout.onclick = () => { son.jouer('clic'); resume(); };
}

/** Plusieurs boosters : tous à l'écran, chacun avec sa lumière. */
function montrerLot() {
  session.jeton++;
  const { paquets, ouverts } = session;
  const scene = $('#ouv-scene'), actions = $('#ouv-actions');
  scene.innerHTML = `<div class="lot-paquets">${paquets.map((p, k) => ouverts.has(k)
    ? `<div class="paquet-ouvert">✓<small>ouvert</small></div>`
    : paquetLumineux(k, true).html).join('')}</div>`;
  actions.innerHTML = `<p class="sous" style="margin:0;width:100%;text-align:center">${paquets.length} boosters · la lumière de chaque paquet annonce sa meilleure carte. Touchez-en un pour l’ouvrir.</p>${raccourcis()}`;
  brancherRaccourcis();
  for (const el of scene.querySelectorAll('[data-paquet]')) el.onclick = () => {
    son.jouer('dechirer');
    el.classList.remove('tremble', 'lumiere', ...[...el.classList].filter(x => x.startsWith('lum-')));
    el.classList.add('dechire');
    setTimeout(() => montrerPaquet(+el.dataset.paquet, true), 350);
  };
}

/** Un booster : le paquet, puis la pile de cartes à retourner. */
function montrerPaquet(k, dejaDechire = false) {
  session.jeton++;
  const { paquets } = session;
  const scene = $('#ouv-scene'), actions = $('#ouv-actions');
  // Du moins rare au plus rare : la meilleure carte arrive en dernier.
  const ordre = paquets[k].slice().sort((a, b) => rangDe(a) - rangDe(b));
  if (dejaDechire) { pile(ordre, k); return; }
  const { html, r } = paquetLumineux(k);
  scene.innerHTML = html;
  const paquet = scene.querySelector('.paquet');
  actions.innerHTML = `<p class="sous" style="margin:0;width:100%;text-align:center">Touchez le paquet pour l’ouvrir · sa lumière annonce la meilleure carte : <b style="color:${RARETES[r].couleur}">${RARETES[r].nom}</b></p>`;
  paquet.addEventListener('click', () => {
    son.jouer('dechirer');
    paquet.classList.remove('tremble', 'lumiere', `lum-${r}`);
    paquet.classList.add('dechire');
    setTimeout(() => pile(ordre, k), 450);
  }, { once: true });
}

/** Fin d'un paquet : retour aux autres boosters, ou le résumé. */
function finPaquet(k) {
  session.ouverts.add(k);
  if (session.paquets.length > 1 && session.ouverts.size < session.paquets.length) montrerLot(); else resume();
}

/** Ouvre jusqu'à `n` boosters avec `un()` (qui rend { ok, tirage }) ; rend la liste des boosters. */
function plusieurs(n, un) {
  const paquets = [];
  while (paquets.length < n) {
    const r = un();
    if (!r.ok) break;
    paquets.push(r.tirage);
  }
  return paquets;
}

function pile(ordre, k) {
  const scene = $('#ouv-scene'), actions = $('#ouv-actions');
  let i = 0;
  scene.innerHTML = `<div class="pile">${ordre.map((t, j) => `<div class="volante" style="z-index:${10 - j};transform:translate(${j * 3}px,${j * 3}px)">
      <div class="dos"><div class="dos-carte"><span>MAXI<br>MENU</span></div></div>
      <div class="face">${carteHTML(t.carte, { nouveau: t.nouvelle, id: false })}</div>
      <div class="halo" style="background:radial-gradient(circle,${RARETES[t.carte.rarete].couleur}aa,transparent 60%)"></div>
    </div>`).join('')}<div class="compteur-pile" id="compteur-pile">1 / ${ordre.length}</div></div>`;
  const multi = session.paquets.length > 1;
  actions.innerHTML = multi
    ? `<div class="lot-btns"><button class="btn" id="b-paquet">Révéler ce booster</button><button class="btn" id="b-retour">↩ Retour aux boosters</button></div>${raccourcis()}`
    : '<button class="btn" id="b-tout">Tout révéler</button>';
  brancherRaccourcis();
  const cartes = [...scene.querySelectorAll('.volante')];
  let revelee = false;
  const suivant = () => {
    const el = cartes[i];
    if (!el) return;
    if (!revelee) {
      el.classList.add('revelee');
      const r = ordre[i].carte.rarete;
      son.jouer('carte');
      setTimeout(() => son.jouer(SONS_RARETE[r]), 150);
      if (RARETES[r].rang >= 2) {
        el.querySelector('.halo').classList.add('on');
        el.insertAdjacentHTML('beforeend', `<div class="annonce-rare" style="--c:${RARETES[r].couleur}">${RARETES[r].nom.toUpperCase()} !</div>`);
      }
      revelee = true;
      return;
    }
    el.classList.add('partie');
    revelee = false;
    i++;
    if (i >= cartes.length) { setTimeout(() => finPaquet(k), 300); return; }
    $('#compteur-pile').textContent = `${i + 1} / ${ordre.length}`;
  };
  scene.querySelector('.pile').addEventListener('click', suivant);
  const bp = $('#b-paquet');
  if (bp) bp.onclick = () => { son.jouer('clic'); resume([ordre], k); };
  const br = $('#b-retour');
  if (br) br.onclick = () => { son.jouer('clic'); session.ouverts.add(k); montrerLot(); };
}

/*
 * « Aller jusqu'à » : toutes les cartes de tous les boosters, rassemblées et rangées par
 * rareté. Les plus courantes défilent vite, groupe par groupe ; à partir de la rareté visée,
 * chaque carte arrive seule, avec son halo et son annonce.
 */
async function rangement(cible) {
  const jeton = ++session.jeton;
  const scene = $('#ouv-scene'), actions = $('#ouv-actions');
  const toutes = session.paquets.flat().sort((a, b) => rangDe(a) - rangDe(b));
  for (let k = 0; k < session.paquets.length; k++) session.ouverts.add(k);
  const groupes = ORDRE_RARETES.map(r => ({ r, cartes: toutes.filter(t => t.carte.rarete === r) })).filter(g => g.cartes.length);
  scene.innerHTML = `<div class="rangement">${groupes.map(g => `<section class="groupe" data-groupe="${g.r}" hidden>
    <h4 style="color:${RARETES[g.r].couleur}">${RARETES[g.r].nom}${g.cartes.length > 1 ? 's' : ''} <small>×${g.cartes.length}</small></h4><div class="grille"></div></section>`).join('')}</div>`;
  actions.innerHTML = '<div class="lot-btns"><button class="btn" id="b-vite">Passer ⏩</button></div>';
  let vite = false;
  $('#b-vite').onclick = () => { vite = true; };
  const pause = ms => new Promise(r => setTimeout(r, vite ? 0 : ms));
  for (const g of groupes) {
    if (jeton !== session.jeton) return;
    const sec = scene.querySelector(`[data-groupe="${g.r}"]`);
    sec.hidden = false;
    const grille = sec.querySelector('.grille');
    const grande = RARETES[g.r].rang >= cible;
    for (const t of g.cartes) {
      if (jeton !== session.jeton) return;
      grille.insertAdjacentHTML('beforeend', `<div class="${grande ? 'arrivee grande' : 'arrivee'}" style="--lum:${RARETES[g.r].couleur}">${carteHTML(t.carte, { nouveau: t.nouvelle, compte: etat.collection[t.carte.id] })}${grande ? `<div class="annonce-rare" style="--c:${RARETES[g.r].couleur}">${RARETES[g.r].nom.toUpperCase()} !</div>` : ''}</div>`);
      if (!vite) grille.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (grande) { son.jouer('carte'); setTimeout(() => son.jouer(SONS_RARETE[g.r]), 120); await pause(900); }
      else { if (!vite) son.jouer('carte'); await pause(60); }
    }
    await pause(grande ? 300 : 250);
  }
  if (jeton !== session.jeton) return;
  for (const el of scene.querySelectorAll('[data-carte]')) el.onclick = () => montrerFiche(el.dataset.carte);
  actionsFin(toutes);
}

/** Le résumé : les cartes données (par défaut toutes), les plus rares d'abord s'il y en a beaucoup. */
function resume(paquets = session.paquets, k = null) {
  session.jeton++;
  if (k !== null) session.ouverts.add(k);
  const scene = $('#ouv-scene');
  const ordre = paquets.flat();
  const multi = paquets.length > 1;
  if (multi) ordre.sort((a, b) => rangDe(b) - rangDe(a));
  const meilleure = ordre.reduce((a, b) => (rangDe(b) > rangDe(a) ? b : a));
  if (rangDe(meilleure) >= (multi ? 2 : 3)) son.jouer(SONS_RARETE[meilleure.carte.rarete]);
  const pas = multi ? 0.03 : 0.08;
  scene.innerHTML = `<div class="resume${multi ? ' multi' : ''}">${ordre.map((t, j) => `<div style="animation-delay:${Math.min(j * pas, 1.2)}s">${carteHTML(t.carte, { nouveau: t.nouvelle, compte: etat.collection[t.carte.id] })}</div>`).join('')}</div>`;
  for (const el of scene.querySelectorAll('[data-carte]')) el.onclick = () => montrerFiche(el.dataset.carte);
  // Un booster d'un lot révélé seul : on revient ensuite aux autres.
  if (k !== null && session.paquets.length > 1 && session.ouverts.size < session.paquets.length) {
    $('#ouv-actions').innerHTML = '<div class="lot-btns"><button class="btn rouge" id="b-retour">↩ Retour aux boosters</button></div>';
    $('#b-retour').onclick = () => { son.jouer('clic'); montrerLot(); };
    return;
  }
  actionsFin(session.paquets.flat());
}

/** Fin de l'ouverture : nouvelles cartes, continuer, encore. */
function actionsFin(toutes) {
  const lots = session.paquets.length;
  const nouvelles = toutes.filter(t => t.nouvelle).length;
  const encore = Math.min(dernierLot, etat.stock);
  $('#ouv-actions').innerHTML = `<p class="sous" style="margin:0;width:100%;text-align:center">${lots > 1 ? `${lots} boosters · ` : ''}${nouvelles ? `${nouvelles} nouvelle${nouvelles > 1 ? 's' : ''} carte${nouvelles > 1 ? 's' : ''} !` : 'Que des doublons… à recycler en frites d’or.'}</p>
    <button class="btn" id="b-fermer-ouv">Continuer</button>
    ${encore ? `<button class="btn rouge" id="b-encore">Encore ${encore > 1 ? `×${encore}` : 'un'} (${etat.stock} en réserve)</button>` : ''}`;
  $('#b-fermer-ouv').onclick = () => { son.jouer('clic'); fermerOuverture(); };
  if (encore) $('#b-encore').onclick = () => ouvrirGratuit(dernierLot);
}

function fermerOuverture() {
  $('#ouverture').hidden = true;
  afficher();
}

let dernierLot = 1;
function ouvrirGratuit(n = 1) {
  son.debloquer();
  dernierLot = n;
  const rng = nouveauRng(), t = maintenant();
  const paquets = plusieurs(n, () => J.ouvrirGratuit(etat, rng, t));
  if (!paquets.length) { son.jouer('refus'); toast('Plus de booster gratuit : patience, il se recharge !'); return; }
  ouvrir(paquets);
}

/* ------------------------------------------------------------ fiche d'une carte */
function montrerFiche(id) {
  const c = PAR_ID.get(id);
  if (!c) return;
  const e = ENSEIGNES[c.enseigne], n = etat.collection[id] || 0;
  const m = $('#fiche');
  const etoiles = k => '★'.repeat(k) + '☆'.repeat(5 - k);
  m.innerHTML = `<div class="fiche">
    <button class="fermer" aria-label="Fermer">✕</button>
    ${n ? carteHTML(c, { compte: n, id: false }) : carteHTML(c, { manquante: true, id: false })}
    <div>
      <h3>${n ? c.nom : 'Carte inconnue'}</h3>
      <p class="meta"><span style="color:${RARETES[c.rarete].couleur};font-weight:800">${RARETES[c.rarete].nom}</span> · ${e.nom}</p>
      ${n ? `<p class="desc">« ${c.desc} »</p>
      <table>
        <tr><td>Calories (environ)</td><td>${c.kcal ? `${c.kcal.toLocaleString('fr-FR')} kcal` : '—'}</td></tr>
        <tr><td>Prix au comptoir</td><td>${c.prix ? `${c.prix.toFixed(2).replace('.', ',')} €` : 'pas à vendre'}</td></tr>
        <tr><td>Croustillance</td><td class="etoiles">${etoiles(c.crous)}</td></tr>
        <tr><td>Gourmandise</td><td class="etoiles">${etoiles(c.gour)}</td></tr>
        <tr><td>Exemplaires</td><td>${n}</td></tr>
        <tr><td>Obtenue le</td><td>${etat.obtenue[id] ? new Date(etat.obtenue[id]).toLocaleDateString('fr-FR') : '—'}</td></tr>
      </table>
      <div class="actions">${n > 1 ? `<button class="btn" id="b-recycler-carte">♻️ Recycler ${n - 1} doublon${n > 2 ? 's' : ''} : +${(n - 1) * RARETES[c.rarete].recyclage} 🍟</button>` : ''}</div>`
        : '<p class="desc">Vous n’avez pas encore cette carte. Sa fiche s’ouvrira quand elle sortira d’un booster.</p>'}
      <p class="meta" style="margin-top:12px">« ${e.devise} »</p>
      ${n && c.image ? `<p class="credit">${credit(id)}</p>` : ''}
    </div>
  </div>`;
  m.hidden = false;
  m.querySelector('.fermer').onclick = () => { m.hidden = true; };
  m.onclick = ev => { if (ev.target === m) m.hidden = true; };
  const rc = $('#b-recycler-carte');
  if (rc) rc.onclick = () => {
    const r = J.recycler(etat, id, maintenant());
    sauver();
    son.jouer('pieces');
    toast(`+${r.gain} 🍟`);
    montrerFiche(id);
    if ($('#ouverture').hidden) afficher();
  };
}

/* ------------------------------------------------------------ clics */
document.addEventListener('click', ev => {
  const el = ev.target.closest('button, [data-carte], [data-album]');
  if (!el || el.closest('#ouverture') || el.closest('#fiche')) return;
  son.debloquer();
  if (el.dataset.vue) { son.jouer('clic'); albumOuvert = null; afficher(el.dataset.vue); window.scrollTo(0, 0); return; }
  if (el.dataset.album) { son.jouer('clic'); albumOuvert = el.dataset.album; afficher('albums'); window.scrollTo(0, 0); return; }
  if (el.dataset.carte && !el.closest('.mini')) { son.jouer('clic'); montrerFiche(el.dataset.carte); return; }
  if (el.closest('.ligne')) { montrerFiche(el.closest('.ligne').dataset.carte); return; }
  if (el.dataset.mission || el.id === 'b-bonus-missions') {
    const r = el.dataset.mission ? J.prendreMission(etat, el.dataset.mission, maintenant()) : J.prendreBonusMissions(etat, maintenant());
    if (!r.ok) return;
    sauver();
    son.jouer('pieces');
    toast(`+${fmtFrites(r.gain)} 🍟 de frites d’or !`);
    afficher();
    return;
  }
  if (el.dataset.frites) { choisirPackFrites(+el.dataset.frites); return; }
  if (el.dataset.acheter) {
    const sorte = el.dataset.acheter, n = +(el.dataset.n || 1);
    const ens = sorte === 'enseigne' ? $('#choix-enseigne').value : null;
    if (etat.frites < J.BOUTIQUE[sorte].prix * n) { son.jouer('refus'); toast('Pas assez de frites d’or.'); return; }
    const rng = nouveauRng(), t = maintenant();
    const paquets = plusieurs(n, () => J.acheter(etat, rng, t, sorte, ens));
    if (!paquets.length) { son.jouer('refus'); toast('Pas assez de frites d’or.'); return; }
    son.jouer('achat');
    const e = ens ? ENSEIGNES[ens] : null;
    const style = sorte === 'prestige' ? { sous: 'prestige', couleurs: ['#ff4f9a', '#ffb52e'] } : e ? { titre: e.court, sous: 'booster d’enseigne', couleurs: e.couleurs, embleme: embleme(e, 64) } : {};
    ouvrir(paquets, style);
    return;
  }
  switch (el.id) {
    case 'b-gratuit': ouvrirGratuit(+(el.dataset.n || 1)); break;
    case 'b-jour': {
      const r = J.ouvrirPackDuJour(etat, nouveauRng(), maintenant());
      if (r.ok) { const e = ENSEIGNES[r.enseigne]; ouvrir(r.tirage, { titre: e.court, sous: 'pack du jour', couleurs: e.couleurs, embleme: embleme(e, 64) }); }
      break;
    }
    case 'b-cadeau': {
      if (etat.cadeaux <= 0) break;
      etat.cadeaux--;
      ouvrir(J.ouvrirCadeauSerie(etat, nouveauRng(), maintenant()).tirage, { sous: 'cadeau de la série', couleurs: ['#ff4f9a', '#ffb52e'] });
      break;
    }
    case 'b-recycler': {
      const r = J.recycler(etat, null, maintenant());
      sauver();
      son.jouer('pieces');
      toast(`♻️ ${r.n} doublon${r.n > 1 ? 's' : ''} recyclé${r.n > 1 ? 's' : ''} : +${fmtFrites(r.gain)} 🍟`);
      afficher();
      break;
    }
    case 'b-albums': son.jouer('clic'); albumOuvert = null; afficher('albums'); break;
    case 'b-recompense': {
      const r = J.recompenseAlbum(etat, el.dataset.ens);
      if (r.ok) { sauver(); son.jouer('legendaire'); toast(`🏆 Album complet : +${fmtFrites(r.gain)} 🍟`); afficher(); }
      break;
    }
    case 'b-son': son.basculerSon(); majCompteurs(); break;
    case 'mm-payer': payerFrites(); break;
  }
});

addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#fiche').hidden = true; }
});

afficher('accueil');
