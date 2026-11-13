/**
 * MAXI MENU — l'onglet Marché : acheter et vendre des cartes aux autres joueurs
 * (/api/marche), et échanger en direct avec un ami (serveur de jeux, g: 'maximenu').
 * Les règles (valeurs, équité, bornes de prix) : shared/maximenu/marche.js.
 */

import { CARTES, RARETES, ORDRE_RARETES, ENSEIGNES, ORDRE_ENSEIGNES, PAR_ID } from '../../../shared/maximenu/cartes.js';
import * as M from '../../../shared/maximenu/marche.js';
import { adresseWS, reveillerServeur } from '../../../shared/serveur.js';

const CLE_ID = 'maximenu.marche';
const echapper = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function identite() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(CLE_ID)); } catch { o = null; }
  if (!o || typeof o.secret !== 'string' || o.secret.length < 24) {
    const a = new Uint8Array(24); crypto.getRandomValues(a);
    o = { secret: [...a].map(x => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[x % 62]).join(''), v: null };
    try { localStorage.setItem(CLE_ID, JSON.stringify(o)); } catch { /* rien */ }
  }
  return o;
}
const garderId = o => { try { localStorage.setItem(CLE_ID, JSON.stringify(o)); } catch { /* rien */ } };

async function api(corps) {
  const r = await fetch('/api/marche', corps ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) } : { cache: 'no-store' });
  let j = {}; try { j = await r.json(); } catch { j = {}; }
  if (!r.ok) throw new Error(j.msg || 'Le marché ne répond pas.');
  return j;
}

/** ctx : { etat(), sauver, toast, carteHTML, fmt, afficher, maintenant, pseudo, son } */
export function creerMarche(ctx) {
  const id = identite();
  let seg = 'acheter', annonces = null, erreur = '', charge = false;
  const filtre = { ens: '', rar: '', tri: 'recent' };
  let mes = [];               // mes annonces en cours
  let troc = null;            // l'échange en direct
  let choix = false;          // le sélecteur de cartes de l'échange est ouvert

  const etat = () => ctx.etat();
  const nom = () => (ctx.pseudo() || 'Joueur').slice(0, 20);
  const carte = cid => PAR_ID.get(cid);

  /* ------------------------------------------------ compte : gains, retours, mes annonces */
  async function compte(silence = false) {
    try {
      const r = await api({ a: 'compte', secret: id.secret });
      if (r.v && r.v !== id.v) { id.v = r.v; garderId(id); }
      mes = r.annonces || [];
      const e = etat(), t = ctx.maintenant();
      for (const cid of r.retours || []) M.ajouterCarte(e, cid, t);
      if (r.gains > 0) e.frites += r.gains;
      if ((r.ventes || []).length) e.ventesMarche = [...r.ventes, ...(e.ventesMarche || [])].slice(0, 20);
      if (r.gains || (r.retours || []).length) {
        ctx.sauver();
        if (r.gains) { ctx.son('pieces'); ctx.toast(`💰 ${r.ventes.length || 'Des'} carte${r.ventes.length > 1 ? 's' : ''} vendue${r.ventes.length > 1 ? 's' : ''} au marché : +${ctx.fmt(r.gains)} 🍟`); }
        else if (r.retours.length) ctx.toast(`${r.retours.length} annonce${r.retours.length > 1 ? 's' : ''} expirée${r.retours.length > 1 ? 's' : ''} : carte${r.retours.length > 1 ? 's' : ''} rendue${r.retours.length > 1 ? 's' : ''}.`);
      }
      return true;
    } catch (err) { if (!silence) erreur = err.message; return false; }
  }

  async function charger() {
    if (charge) return; charge = true; erreur = '';
    try { annonces = (await api()).annonces || []; await compte(true); } catch (err) { erreur = err.message; annonces = annonces || []; }
    charge = false; ctx.afficher();
  }

  /* ------------------------------------------------ affichage */
  const filtres = (avecTri = true) => `<div class="mm-filtres">
    <select data-mf="ens"><option value="">Toutes les enseignes</option>${ORDRE_ENSEIGNES.map(k => `<option value="${k}" ${filtre.ens === k ? 'selected' : ''}>${ENSEIGNES[k].nom}</option>`).join('')}</select>
    <select data-mf="rar"><option value="">Toutes les raretés</option>${ORDRE_RARETES.map(r => `<option value="${r}" ${filtre.rar === r ? 'selected' : ''}>${RARETES[r].nom}</option>`).join('')}</select>
    ${avecTri ? `<select data-mf="tri"><option value="recent" ${filtre.tri === 'recent' ? 'selected' : ''}>Plus récentes</option><option value="prix" ${filtre.tri === 'prix' ? 'selected' : ''}>Moins chères</option><option value="affaire" ${filtre.tri === 'affaire' ? 'selected' : ''}>Bonnes affaires</option><option value="rarete" ${filtre.tri === 'rarete' ? 'selected' : ''}>Plus rares</option></select>` : ''}
  </div>`;
  const passe = c => c && (!filtre.ens || c.enseigne === filtre.ens) && (!filtre.rar || c.rarete === filtre.rar);
  const prixTxt = n => `${ctx.fmt(n)} 🍟`;

  function vueAcheter() {
    if (annonces === null) { charger(); return '<p class="vide">Ouverture du marché…</p>'; }
    let l = annonces.filter(a => passe(carte(a.carte)));
    if (filtre.tri === 'prix') l = [...l].sort((a, b) => a.prix - b.prix);
    if (filtre.tri === 'affaire') l = [...l].sort((a, b) => a.prix / M.valeurCarte(a.carte) - b.prix / M.valeurCarte(b.carte));
    if (filtre.tri === 'rarete') l = [...l].sort((a, b) => RARETES[carte(b.carte).rarete].rang - RARETES[carte(a.carte).rarete].rang);
    const e = etat();
    return `${filtres()}<p class="sous">${annonces.length} carte${annonces.length > 1 ? 's' : ''} en vente · <button class="lien" data-m="recharger">↻ Actualiser</button></p>
      <div class="mm-annonces">${l.map(a => {
        const c = carte(a.carte), moi = a.v && a.v === id.v, eu = e.collection[a.carte] || 0;
        return `<div class="mm-annonce">${ctx.carteHTML(c, { id: false })}
          <div class="mm-prix">${prixTxt(a.prix)}<small>repère ${M.valeurCarte(a.carte)}</small></div>
          <small class="mm-vendeur">par ${echapper(a.nom)}${eu ? ` · vous l’avez ×${eu}` : ' · <b>nouvelle pour vous</b>'}</small>
          ${moi ? '<button class="btn" disabled>Votre annonce</button>' : `<button class="btn ${e.frites >= a.prix ? 'jaune' : ''}" data-m="acheter" data-id="${a.id}" ${e.frites >= a.prix ? '' : 'disabled'}>Acheter</button>`}
        </div>`;
      }).join('') || '<p class="vide">Aucune carte en vente avec ces filtres.</p>'}</div>`;
  }

  const mesCartes = () => CARTES.filter(c => etat().collection[c.id] && passe(c)).sort((a, b) => RARETES[b.rarete].rang - RARETES[a.rarete].rang || (etat().collection[b.id] - etat().collection[a.id]));

  function vueVendre() {
    const l = mesCartes();
    return `<p class="sous">Touchez une carte pour la mettre en vente (${M.ANNONCES_MAX} annonces au plus). Le prix reste entre la moitié et quatre fois sa valeur de repère. Une carte invendue vous revient au bout de 7 jours.</p>
      ${filtres(false)}<div class="grille mm-choix">${l.map(c => `<button class="mm-case" data-m="vendre" data-id="${c.id}">${ctx.carteHTML(c, { compte: etat().collection[c.id], id: false })}<small>repère ${M.valeurCarte(c.id)} 🍟</small></button>`).join('') || '<p class="vide">Aucune carte avec ces filtres.</p>'}</div>`;
  }

  function vueMes() {
    const v = etat().ventesMarche || [];
    return `<h3>Mes annonces (${mes.length}/${M.ANNONCES_MAX})</h3>
      <div class="liste">${mes.map(a => { const c = carte(a.carte); return `<div class="ligne mm-ligne"><span class="mini">${ctx.carteHTML(c, { id: false })}</span><span><b>${c.nom}</b><br><small>${prixTxt(a.prix)} · depuis le ${new Date(a.quand).toLocaleDateString('fr-FR')}</small></span><button class="btn" data-m="retirer" data-id="${a.id}">Retirer</button></div>`; }).join('') || '<p class="vide">Aucune carte en vente.</p>'}</div>
      <h3 style="margin-top:18px">Dernières ventes</h3>
      <div class="liste">${v.map(x => { const c = carte(x.carte); return c ? `<div class="ligne mm-ligne"><span class="mini">${ctx.carteHTML(c, { id: false })}</span><span><b>${c.nom}</b><br><small>vendue ${prixTxt(x.prix)} à ${echapper(x.acheteur)} · ${new Date(x.quand).toLocaleDateString('fr-FR')}</small></span></div>` : ''; }).join('') || '<p class="vide">Pas encore de vente.</p>'}</div>`;
  }

  /* ------------------------------------------------ échange en direct */
  function connecter(premier) {
    reveillerServeur();
    const ws = new WebSocket(adresseWS());
    troc = { ws, code: null, moi: 0, noms: ['', ''], offres: [{}, {}], ok: [false, false], eq: null, statut: 'Connexion au serveur… (jusqu’à une minute s’il dormait)' };
    ws.onopen = () => ws.send(JSON.stringify({ g: 'maximenu', ...premier }));
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } recevoir(m); };
    ws.onclose = () => { if (troc && troc.ws === ws) { if (troc.code) ctx.toast('Échange interrompu.'); troc = null; choix = false; if (seg === 'ami') ctx.afficher(); } };
    ctx.afficher();
  }
  const envoyer = m => { if (troc && troc.ws.readyState === 1) troc.ws.send(JSON.stringify({ g: 'maximenu', ...m })); };
  function quitter() { if (troc) { envoyer({ t: 'quitter' }); const w = troc.ws; troc = null; try { w.close(); } catch { /* déjà */ } } choix = false; }

  function recevoir(m) {
    if (!troc || m.g !== 'maximenu') return;
    if (m.t === 'salle') { troc.code = m.code; troc.moi = m.moi; troc.statut = ''; }
    else if (m.t === 'etat') Object.assign(troc, { moi: m.moi, noms: m.noms, offres: m.offres, ok: m.ok, eq: m.equite });
    else if (m.t === 'erreur') { ctx.son('refus'); ctx.toast(m.msg); if (!troc.code) { quitter(); } }
    else if (m.t === 'parti') { ctx.toast('Votre partenaire a quitté l’échange.'); quitter(); }
    else if (m.t === 'conclu') {
      const e = etat(), r = M.echanger(e, m.donne, m.recoit, ctx.maintenant());
      if (r.ok) { ctx.sauver(); ctx.son('legendaire'); ctx.toast(`🤝 Échange conclu avec ${m.avec} : ${M.tailleLot(m.recoit)} carte${M.tailleLot(m.recoit) > 1 ? 's' : ''} reçue${M.tailleLot(m.recoit) > 1 ? 's' : ''}${r.nouvelles.length ? ` dont ${r.nouvelles.length} nouvelle${r.nouvelles.length > 1 ? 's' : ''}` : ''} !`); }
      else ctx.toast('Échange annulé : il vous manque des cartes.');
      quitter();
    }
    if (seg === 'ami') ctx.afficher();
  }

  const lotHTML = (lot, retirable) => {
    const l = Object.entries(lot || {});
    return l.length ? `<div class="mm-lot">${l.map(([cid, n]) => { const c = carte(cid); return `<${retirable ? `button data-m="troc-retire" data-id="${cid}"` : 'div'} class="mm-case">${ctx.carteHTML(c, { compte: n, id: false })}<small>${M.valeurCarte(cid) * n} 🍟</small></${retirable ? 'button' : 'div'}>`; }).join('')}</div>` : '<p class="vide">Rien pour l’instant.</p>';
  };

  function vueAmi() {
    if (!troc) return `<p class="sous">Échangez des cartes avec un ami, en direct : l’un crée l’échange et donne le code à l’autre. L’échange doit être à peu près équitable (valeurs de repère proches) et validé des deux côtés.</p>
      <div class="tuiles"><section class="tuile"><h3>🤝 Nouvel échange</h3><p>Vous recevrez un code à quatre lettres.</p><button class="btn jaune" data-m="troc-creer">Créer un échange</button></section>
      <section class="tuile"><h3>🔑 Rejoindre</h3><p>Entrez le code de votre ami.</p><div class="mm-code"><input id="mm-code" maxlength="4" placeholder="ABCD" autocomplete="off"><button class="btn rouge" data-m="troc-rejoindre">Rejoindre</button></div></section></div>
      <p class="sous">Valeurs de repère : ${ORDRE_RARETES.map(r => `${RARETES[r].nom} ${M.VALEUR[r]} 🍟`).join(' · ')}.</p>`;
    if (!troc.code) return `<p class="vide">${troc.statut}</p><button class="btn" data-m="troc-quitter">Annuler</button>`;
    const moi = troc.moi, lui = 1 - moi, eq = troc.eq || M.equite(troc.offres[0], troc.offres[1]);
    const vMoi = moi ? eq.vb : eq.va, vLui = moi ? eq.va : eq.vb, haut = Math.max(vMoi, vLui, 1);
    if (!troc.noms[lui]) return `<div class="tuile mm-attente"><h3>Code de l’échange</h3><div class="mm-gros-code">${troc.code}</div><p>Donnez ce code à votre ami. En attente de son arrivée…</p><button class="btn" data-m="troc-quitter">Annuler</button></div>`;
    const jauge = `<div class="mm-equite ${eq.ok ? 'ok' : 'non'}"><div class="mm-barres"><span style="width:${vMoi / haut * 100}%"></span><span style="width:${vLui / haut * 100}%"></span></div>
      <b>${eq.ok ? '✓ Échange équitable' : vMoi === 0 || vLui === 0 ? 'Chacun doit proposer au moins une carte' : `Déséquilibré : il manque environ ${eq.manque} 🍟 de valeur au plus petit lot`}</b></div>`;
    const sel = choix ? `<div class="tuile mm-selecteur"><h3>Ajouter à mon lot</h3>${filtres(false)}<div class="grille mm-choix">${mesCartes().map(c => { const reste = (etat().collection[c.id] || 0) - ((troc.offres[moi] || {})[c.id] || 0); return `<button class="mm-case" data-m="troc-ajout" data-id="${c.id}" ${reste > 0 ? '' : 'disabled'}>${ctx.carteHTML(c, { compte: reste, id: false })}<small>${M.valeurCarte(c.id)} 🍟</small></button>`; }).join('')}</div><button class="btn" data-m="troc-fermer">Fermer</button></div>` : '';
    return `<div class="mm-troc">
      <p class="sous">Échange <b>${troc.code}</b> avec <b>${echapper(troc.noms[lui])}</b> · <button class="lien" data-m="troc-quitter">Quitter</button></p>
      <div class="mm-cotes">
        <section class="tuile"><h3>Je donne · ${vMoi} 🍟 ${troc.ok[moi] ? '<span class="mm-ok">✓ validé</span>' : ''}</h3>${lotHTML(troc.offres[moi], true)}<button class="btn" data-m="troc-choix">+ Ajouter des cartes</button></section>
        <section class="tuile"><h3>Je reçois · ${vLui} 🍟 ${troc.ok[lui] ? '<span class="mm-ok">✓ validé</span>' : ''}</h3>${lotHTML(troc.offres[lui], false)}</section>
      </div>${jauge}
      <button class="btn jaune mm-valider" data-m="troc-valider" ${eq.ok && !troc.ok[moi] ? '' : 'disabled'}>${troc.ok[moi] ? `En attente de ${echapper(troc.noms[lui])}…` : 'Valider l’échange'}</button>
      ${sel}</div>`;
  }

  /* ------------------------------------------------ vente : choix du prix */
  function fenetreVente(cid) {
    const c = carte(cid), n = etat().collection[cid] || 0, f = document.querySelector('#fiche');
    const v = M.valeurCarte(cid), mi = M.prixMin(cid), ma = M.prixMax(cid);
    f.innerHTML = `<div class="fiche mm-vente"><button class="fermer" aria-label="Fermer">✕</button>${ctx.carteHTML(c, { compte: n, id: false })}
      <div><h3>Vendre ${c.nom}</h3><p class="meta"><span style="color:${RARETES[c.rarete].couleur};font-weight:800">${RARETES[c.rarete].nom}</span> · valeur de repère ${v} 🍟</p>
      ${n === 1 ? '<p class="desc">⚠️ C’est votre seul exemplaire : il quittera votre album.</p>' : ''}
      <label class="mm-prix-choix">Prix : <input type="number" id="mm-prix" min="${mi}" max="${ma}" step="1" value="${v}"> 🍟</label>
      <input type="range" id="mm-prix-r" min="${mi}" max="${ma}" value="${v}">
      <p class="meta">Entre ${mi} et ${ma} 🍟.</p>
      <div class="actions"><button class="btn jaune" id="mm-mettre">Mettre en vente</button></div></div></div>`;
    f.hidden = false;
    const ip = f.querySelector('#mm-prix'), ir = f.querySelector('#mm-prix-r');
    ip.oninput = () => { ir.value = ip.value; }; ir.oninput = () => { ip.value = ir.value; };
    f.querySelector('.fermer').onclick = () => { f.hidden = true; };
    f.onclick = ev => { if (ev.target === f) f.hidden = true; };
    f.querySelector('#mm-mettre').onclick = async ev => {
      const prix = Math.round(+ip.value);
      if (!M.prixValide(cid, prix)) { ctx.toast(`Prix entre ${mi} et ${ma} 🍟.`); return; }
      if (!M.possede(etat(), { [cid]: 1 })) { f.hidden = true; return; }
      ev.target.disabled = true;
      try {
        const r = await api({ a: 'vendre', secret: id.secret, nom: nom(), carte: cid, prix });
        M.retirerCarte(etat(), cid); ctx.sauver(); mes.push(r.annonce); if (annonces) annonces.unshift(r.annonce);
        if (r.annonce.v && !id.v) { id.v = r.annonce.v; garderId(id); }
        ctx.son('achat'); ctx.toast(`🏷️ ${c.nom} en vente pour ${prix} 🍟.`); f.hidden = true; ctx.afficher();
      } catch (err) { ev.target.disabled = false; ctx.son('refus'); ctx.toast(err.message); }
    };
  }

  /* ------------------------------------------------ clics */
  async function clic(el) {
    const a = el.dataset.m, cid = el.dataset.id;
    ctx.son('clic');
    switch (a) {
      case 'seg': seg = el.dataset.seg; choix = false; if (seg === 'mes') compte(true).then(() => ctx.afficher()); break;
      case 'recharger': annonces = null; break;
      case 'acheter': {
        const an = (annonces || []).find(x => x.id === cid); if (!an) return;
        if (etat().frites < an.prix) { ctx.son('refus'); ctx.toast('Pas assez de frites d’or.'); return; }
        el.disabled = true;
        try {
          const r = await api({ a: 'acheter', secret: id.secret, nom: nom(), id: cid });
          const e = etat(); e.frites -= r.prix; const neuve = M.ajouterCarte(e, r.carte, ctx.maintenant()); ctx.sauver();
          annonces = annonces.filter(x => x.id !== cid);
          ctx.son(neuve ? 'legendaire' : 'achat'); ctx.toast(`🛍️ ${carte(r.carte).nom} achetée pour ${r.prix} 🍟${neuve ? ' : nouvelle carte !' : '.'}`);
        } catch (err) { ctx.son('refus'); ctx.toast(err.message); annonces = null; }
        break;
      }
      case 'vendre': fenetreVente(cid); return;
      case 'retirer': {
        el.disabled = true;
        try { const r = await api({ a: 'retirer', secret: id.secret, id: cid }); M.ajouterCarte(etat(), r.carte, ctx.maintenant()); ctx.sauver(); mes = mes.filter(x => x.id !== cid); if (annonces) annonces = annonces.filter(x => x.id !== cid); ctx.toast('Annonce retirée : la carte revient dans votre album.'); }
        catch (err) { ctx.toast(err.message); await compte(true); }
        break;
      }
      case 'troc-creer': connecter({ t: 'creer', nom: nom() }); return;
      case 'troc-rejoindre': {
        const code = (document.querySelector('#mm-code')?.value || '').toUpperCase().trim();
        if (!/^[A-Z]{4}$/.test(code)) { ctx.toast('Le code a quatre lettres.'); return; }
        connecter({ t: 'rejoindre', code, nom: nom() }); return;
      }
      case 'troc-quitter': quitter(); break;
      case 'troc-choix': choix = true; break;
      case 'troc-fermer': choix = false; break;
      case 'troc-ajout': case 'troc-retire': {
        if (!troc) return;
        const lot = { ...(troc.offres[troc.moi] || {}) };
        if (a === 'troc-ajout') { if ((lot[cid] || 0) >= (etat().collection[cid] || 0) || M.tailleLot(lot) >= M.LOT_MAX) { ctx.toast(`${M.LOT_MAX} cartes au plus.`); return; } lot[cid] = (lot[cid] || 0) + 1; }
        else { lot[cid]--; if (!lot[cid]) delete lot[cid]; }
        troc.offres[troc.moi] = lot; troc.ok = [false, false]; troc.eq = null;
        envoyer({ t: 'offre', lot });
        break;
      }
      case 'troc-valider': {
        if (!troc || !M.possede(etat(), troc.offres[troc.moi])) { ctx.toast('Il vous manque des cartes de votre lot.'); return; }
        envoyer({ t: 'valider' }); return;
      }
      default: return;
    }
    ctx.afficher();
  }

  function changerFiltre(el) { filtre[el.dataset.mf] = el.value; ctx.afficher(); }

  function vue() {
    const segs = [['acheter', '🛍️ Acheter'], ['vendre', '🏷️ Vendre'], ['mes', `📋 Mes annonces${mes.length ? ` (${mes.length})` : ''}`], ['ami', '🤝 Échanger avec un ami']];
    const corps = seg === 'acheter' ? vueAcheter() : seg === 'vendre' ? vueVendre() : seg === 'mes' ? vueMes() : vueAmi();
    return `<h2>Le marché</h2><p class="sous">Vos frites d’or : <b>${ctx.fmt(etat().frites)} 🍟</b>. Achetez et vendez des cartes aux autres joueurs, ou échangez avec un ami.</p>
      ${erreur && seg !== 'ami' ? `<p class="mm-erreur">${echapper(erreur)}</p>` : ''}
      <div class="mm-segments">${segs.map(([k, t]) => `<button class="${seg === k ? 'actif' : ''}" data-m="seg" data-seg="${k}">${t}</button>`).join('')}</div>${corps}`;
  }

  // À l'ouverture du jeu : toucher l'argent des ventes faites pendant l'absence (si on a déjà vendu).
  try { if (localStorage.getItem(CLE_ID) && id.v) compte(true).then(() => ctx.afficher()); } catch { /* rien */ }

  return { vue, clic, changerFiltre };
}
