/**
 * MAXI MENU — l'application : accueil, ouverture des boosters, albums,
 * boutique, tirages et fiches des cartes. Tout est gardé dans le navigateur.
 */

import { CARTES, RARETES, ENSEIGNES, ORDRE_ENSEIGNES, PAR_ID } from '../../../shared/maximenu/cartes.js';
import * as J from '../../../shared/maximenu/jeu.js';
import { makeRng } from '../../../shared/hasard.js';
import { dessinCarte, emblemeEnseigne } from './dessins.js';
import * as son from './sons.js';

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

function carteHTML(c, { compte = 0, nouveau = false, manquante = false, id = true } = {}) {
  const e = ENSEIGNES[c.enseigne];
  if (manquante) {
    return `<div class="carte manquante ${c.rarete}" ${id ? `data-carte="${c.id}"` : ''}><span class="rarete">${RARETES[c.rarete].nom}</span><div class="interieur">?</div></div>`;
  }
  return `<div class="carte ${c.rarete}" ${id ? `data-carte="${c.id}"` : ''} style="--e1:${e.couleurs[0]}33;--e1b:${e.couleurs[0]}88">
    <div class="interieur">
      <div class="art">${dessinCarte(c, e.couleurs)}<span class="badge">${emblemeEnseigne(e, 34)}</span><span class="rarete">${RARETES[c.rarete].nom}</span></div>
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
        <div style="display:flex;gap:12px;align-items:center">${emblemeEnseigne(ens, 52)}<div><h3>${ens.nom}</h3><p>${ens.devise}</p></div></div>
        <p>Cinq cartes de l’enseigne du jour, avec une <b>Épique ou mieux garantie</b>.</p>
        ${dispo ? '<button class="btn jaune" id="b-jour">🎁 Ouvrir le pack du jour</button>'
          : `<button class="btn" disabled>Déjà ouvert · prochain dans <span data-minuteur="jour"></span></button>`}
      </section>
      <section class="tuile">
        <h3>🍔 Boosters gratuits</h3>
        <div class="grand">${etat.stock}<small style="font-size:1rem;color:var(--pale)"> / ${J.REGLES.stockMax}</small></div>
        <div class="jauge"><i style="width:${etat.stock / J.REGLES.stockMax * 100}%"></i></div>
        <p>${etat.stock >= J.REGLES.stockMax ? 'Réserve pleine : ouvrez-en un !' : 'Prochain booster gratuit dans <b data-minuteur="recharge"></b>'}</p>
        <button class="btn rouge" id="b-gratuit" ${etat.stock ? '' : 'disabled'}>Ouvrir un booster</button>
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
    </div>
    <div class="etapes">
      <div class="etape"><b>1</b><p><strong>Ouvrez des boosters.</strong> Des gratuits se rechargent toute la journée, et la boutique en vend contre des frites d’or.</p></div>
      <div class="etape"><b>2</b><p><strong>Complétez les albums.</strong> Une enseigne, douze cartes, de la Commune à la Mythique. Un album complet rapporte 1 000 🍟.</p></div>
      <div class="etape"><b>3</b><p><strong>Recyclez les doublons</strong> en frites d’or, et découvrez la fiche de chaque carte obtenue.</p></div>
    </div>`;
  },
  albums() {
    if (albumOuvert) {
      const e = ENSEIGNES[albumOuvert], a = J.album(etat, albumOuvert);
      return `<div class="entete-album"><button class="btn" id="b-albums">←</button>${emblemeEnseigne(e, 46)}<div><h2>${e.nom}</h2><p class="sous" style="margin:0">${a.possedees} / ${a.total} cartes · « ${e.devise} »</p></div></div>
        ${a.complet && !a.recompensePrise ? `<p style="margin:12px 0"><button class="btn jaune" id="b-recompense" data-ens="${albumOuvert}">🏆 Album complet : prendre ${J.REGLES.albumComplet} 🍟</button></p>` : ''}
        ${a.recompensePrise ? '<p class="sous" style="margin:10px 0">🏆 Album complété : récompense déjà prise.</p>' : ''}
        <div class="grille" style="margin-top:14px">${a.cartes.map(c => carteHTML(c, { compte: etat.collection[c.id] || 0, manquante: !etat.collection[c.id] })).join('')}</div>`;
    }
    return `<h2>Les albums</h2><p class="sous">Une enseigne par album. Touchez une carte pour voir sa fiche.</p>
      <div class="albums">${ORDRE_ENSEIGNES.map(k => {
        const e = ENSEIGNES[k], a = J.album(etat, k);
        return `<button class="album" data-album="${k}" style="--c1:${e.couleurs[0]}">${emblemeEnseigne(e, 48)}
          <span class="infos"><b>${e.nom}</b><small>${a.possedees} / ${a.total}${a.recompensePrise ? ' · 🏆' : a.complet ? ' · récompense à prendre !' : ''}</small><span class="jauge"><i style="width:${a.possedees / a.total * 100}%"></i></span></span></button>`;
      }).join('')}</div>`;
  },
  boutique() {
    const d = J.valeurDoublons(etat);
    const o = J.BOUTIQUE;
    return `<h2>La boutique</h2><p class="sous">Vos frites d’or : <b>${fmtFrites(etat.frites)} 🍟</b>. Gagnez-en en recyclant vos doublons et en complétant des albums.</p>
      <div class="offres">
        <div class="offre">${paquetHTML('MAXI', 'classique', ['#e3262f', '#ffc72c'])}<b>${o.classique.nom}</b><p>${o.classique.desc}</p>
          <button class="btn rouge" data-acheter="classique" ${etat.frites < o.classique.prix ? 'disabled' : ''}>${o.classique.prix} 🍟</button></div>
        <div class="offre">${paquetHTML('MAXI', 'enseigne', ['#11519c', '#ffc72c'])}<b>${o.enseigne.nom}</b><p>${o.enseigne.desc}</p>
          <select id="choix-enseigne" aria-label="Enseigne">${ORDRE_ENSEIGNES.map(k => `<option value="${k}">${ENSEIGNES[k].nom}</option>`).join('')}</select>
          <button class="btn rouge" data-acheter="enseigne" ${etat.frites < o.enseigne.prix ? 'disabled' : ''}>${o.enseigne.prix} 🍟</button></div>
        <div class="offre">${paquetHTML('MAXI', 'prestige', ['#ff4f9a', '#ffb52e'])}<b>${o.prestige.nom}</b><p>${o.prestige.desc}</p>
          <button class="btn jaune" data-acheter="prestige" ${etat.frites < o.prestige.prix ? 'disabled' : ''}>${fmtFrites(o.prestige.prix)} 🍟</button></div>
      </div>
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

function ouvrir(tirage, { titre = 'MAXI', sous = 'booster', couleurs = ['#e3262f', '#ffc72c'], embleme = '' } = {}) {
  sauver();
  majCompteurs();
  const ouv = $('#ouverture'), scene = $('#ouv-scene'), actions = $('#ouv-actions');
  ouv.hidden = false;
  scene.innerHTML = paquetHTML(titre, sous, couleurs, embleme);
  const paquet = scene.querySelector('.paquet');
  paquet.classList.add('tremble');
  actions.innerHTML = '<p class="sous" style="margin:0">Touchez le paquet pour l’ouvrir</p>';
  // Du moins rare au plus rare : la meilleure carte arrive en dernier.
  const ordre = tirage.slice().sort((a, b) => RARETES[a.carte.rarete].rang - RARETES[b.carte.rarete].rang);
  paquet.addEventListener('click', () => {
    son.jouer('dechirer');
    paquet.classList.remove('tremble');
    paquet.classList.add('dechire');
    setTimeout(() => pile(ordre), 450);
  }, { once: true });
}

function pile(ordre) {
  const scene = $('#ouv-scene'), actions = $('#ouv-actions');
  let i = 0;
  scene.innerHTML = `<div class="pile">${ordre.map((t, k) => `<div class="volante" style="z-index:${10 - k};transform:translate(${k * 3}px,${k * 3}px)">
      <div class="dos"><div class="dos-carte"><span>MAXI<br>MENU</span></div></div>
      <div class="face">${carteHTML(t.carte, { nouveau: t.nouveau, id: false })}</div>
      <div class="halo" style="background:radial-gradient(circle,${RARETES[t.carte.rarete].couleur}aa,transparent 60%)"></div>
    </div>`).join('')}<div class="compteur-pile" id="compteur-pile">1 / ${ordre.length}</div></div>`;
  actions.innerHTML = '<button class="btn" id="b-tout">Tout révéler</button>';
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
    if (i >= cartes.length) { setTimeout(() => resume(ordre), 300); return; }
    $('#compteur-pile').textContent = `${i + 1} / ${ordre.length}`;
  };
  scene.querySelector('.pile').addEventListener('click', suivant);
  $('#b-tout').onclick = () => { son.jouer('clic'); resume(ordre); };
}

function resume(ordre) {
  const scene = $('#ouv-scene'), actions = $('#ouv-actions');
  const meilleure = ordre.reduce((a, b) => (RARETES[b.carte.rarete].rang > RARETES[a.carte.rarete].rang ? b : a));
  if (RARETES[meilleure.carte.rarete].rang >= 3) son.jouer(SONS_RARETE[meilleure.carte.rarete]);
  scene.innerHTML = `<div class="resume">${ordre.map((t, k) => `<div style="animation-delay:${k * 0.08}s">${carteHTML(t.carte, { nouveau: t.nouveau, compte: etat.collection[t.carte.id] })}</div>`).join('')}</div>`;
  const nouvelles = ordre.filter(t => t.nouveau).length;
  actions.innerHTML = `<p class="sous" style="margin:0;width:100%;text-align:center">${nouvelles ? `${nouvelles} nouvelle${nouvelles > 1 ? 's' : ''} carte${nouvelles > 1 ? 's' : ''} !` : 'Que des doublons… à recycler en frites d’or.'}</p>
    <button class="btn" id="b-fermer-ouv">Continuer</button>
    ${etat.stock ? `<button class="btn rouge" id="b-encore">Encore un (${etat.stock})</button>` : ''}`;
  $('#b-fermer-ouv').onclick = () => { son.jouer('clic'); fermerOuverture(); };
  const encore = $('#b-encore');
  if (encore) encore.onclick = () => ouvrirGratuit();
  for (const el of scene.querySelectorAll('[data-carte]')) el.onclick = () => montrerFiche(el.dataset.carte);
}

function fermerOuverture() {
  $('#ouverture').hidden = true;
  afficher();
}

function ouvrirGratuit() {
  son.debloquer();
  const r = J.ouvrirGratuit(etat, nouveauRng(), maintenant());
  if (!r.ok) { son.jouer('refus'); toast('Plus de booster gratuit : patience, il se recharge !'); return; }
  ouvrir(r.tirage);
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
    </div>
  </div>`;
  m.hidden = false;
  m.querySelector('.fermer').onclick = () => { m.hidden = true; };
  m.onclick = ev => { if (ev.target === m) m.hidden = true; };
  const rc = $('#b-recycler-carte');
  if (rc) rc.onclick = () => {
    const r = J.recycler(etat, id);
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
  if (el.dataset.acheter) {
    const sorte = el.dataset.acheter;
    const ens = sorte === 'enseigne' ? $('#choix-enseigne').value : null;
    const r = J.acheter(etat, nouveauRng(), maintenant(), sorte, ens);
    if (!r.ok) { son.jouer('refus'); toast('Pas assez de frites d’or.'); return; }
    son.jouer('achat');
    const e = ens ? ENSEIGNES[ens] : null;
    ouvrir(r.tirage, sorte === 'prestige' ? { sous: 'prestige', couleurs: ['#ff4f9a', '#ffb52e'] } : e ? { titre: e.court, sous: 'booster d’enseigne', couleurs: e.couleurs, embleme: emblemeEnseigne(e, 64) } : {});
    return;
  }
  switch (el.id) {
    case 'b-gratuit': ouvrirGratuit(); break;
    case 'b-jour': {
      const r = J.ouvrirPackDuJour(etat, nouveauRng(), maintenant());
      if (r.ok) { const e = ENSEIGNES[r.enseigne]; ouvrir(r.tirage, { titre: e.court, sous: 'pack du jour', couleurs: e.couleurs, embleme: emblemeEnseigne(e, 64) }); }
      break;
    }
    case 'b-cadeau': {
      if (etat.cadeaux <= 0) break;
      etat.cadeaux--;
      ouvrir(J.ouvrirCadeauSerie(etat, nouveauRng(), maintenant()).tirage, { sous: 'cadeau de la série', couleurs: ['#ff4f9a', '#ffb52e'] });
      break;
    }
    case 'b-recycler': {
      const r = J.recycler(etat);
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
  }
});

addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#fiche').hidden = true; }
});

afficher('accueil');
