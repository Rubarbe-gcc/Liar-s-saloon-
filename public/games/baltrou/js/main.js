/**
 * BALTROU — l'écran.
 *
 * La run vit dans `p` (shared/baltrou/partie.js) ; cet écran ne fait que la
 * montrer, et rejouer pas à pas le calcul de chaque main : les cartes qui
 * comptent sautent, les Jokers s'agitent, les chips et le Mult grimpent.
 * La run se range dans le navigateur après chaque geste : on la reprend avec
 * « Continuer ».
 */

import * as P from '../../../shared/baltrou/partie.js';
import { MAIN, MAINS, baseMain } from '../../../shared/baltrou/cartes.js';
import { JOKERS, OBJETS, VOUCHER, RARETES, EDITIONS } from '../../../shared/baltrou/jokers.js';
import { carteHtml, jokerHtml, offreHtml, consoHtml, texteCarte, compteurJoker, nb, esc } from './rendu.js';
import { infoConso, TAGS, MISES, PLANETES } from '../../../shared/baltrou/arcanes.js';
import { COULEURS, ORDRE_COULEURS } from '../../../shared/baltrou/cartes.js';
import { reglesHtml, livreHtml } from './regles.js';
import * as son from './son.js';
import * as succes from '../../../shared/succes.js';

const $ = (id) => document.getElementById(id);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const CLE_PARTIE = 'baltrou.partie';
const CLE_RECORDS = 'baltrou.records';

function lire(cle, defaut) { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } }
function ecrire(cle, v) { try { if (v == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)); } catch { /* plein */ } }

let p = null;
let choix = new Set();
let occupe = false;
let rapide = false;
let modeChoisi = 'classique';
let miseChoisie = 0;

/* ------------------------------------------------------------------ */
/* Petits outils d'écran                                               */
/* ------------------------------------------------------------------ */

function aller(id) {
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id));
}
const ouvrir = (id) => { $(id).hidden = false; };
const fermer = (id) => { $(id).hidden = true; };

let toastT = 0;
function toast(msg, ms = 2400) {
  const t = $('toast');
  t.innerHTML = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}

function pop(el) {
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

/** Un nombre qui s'envole d'un élément. */
function envol(el, texte, sorte = 'c') {
  if (!el || !texte || texte === '—') return;
  const r = el.getBoundingClientRect();
  const v = document.createElement('div');
  v.className = `vole ${sorte}`;
  v.textContent = texte;
  v.style.left = `${r.left + r.width / 2}px`;
  v.style.top = `${r.top - 6}px`;
  document.body.appendChild(v);
  setTimeout(() => v.remove(), 950);
}

const REFUS = {
  argent: 'Pas assez d’argent !',
  jokers: 'Plus de place pour un Joker : vendez-en un d’abord.',
  negatifs: 'Déjà 3 Jokers négatifs.',
  consommables: 'Inventaire plein : 2 consommables au plus.',
  mains: 'Plus de mains !',
  defausses: 'Plus de défausses !',
  vide: 'Sélectionnez des cartes.',
  trop: '5 cartes au plus — et le Poisson en fait partie.',
  poisson: '🐟 Le Poisson Dégueulasse ne se défausse pas : il doit être joué !',
  wild: 'La WILDCARD ne se défausse pas.',
  phase: 'Pas maintenant.',
  boss: 'On ne passe pas un boss !',
  'tarot-jeu': 'Ce tarot s’utilise pendant une manche, sur les cartes de votre main.',
  'tarot-special': 'Ce tarot ne touche ni le Poisson ni la WILDCARD.',
  'tarot-cibles': 'Sélectionnez le bon nombre de cartes dans votre main.',
};
const refuse = (r) => toast(r.message || REFUS[r.raison] || 'Impossible.');

/* ------------------------------------------------------------------ */
/* Records, sauvegarde, succès                                         */
/* ------------------------------------------------------------------ */

const records = () => ({ victoires: 0, meilleure: 0, meilleureNom: '', anteInfini: 0, miseGagnee: -1, historique: [], ...lire(CLE_RECORDS, {}) });
/** La plus haute mise jouable : une de plus que la plus haute déjà gagnée. */
const miseMax = () => Math.min(MISES.length - 1, records().miseGagnee + 1);

function sauver() {
  if (!p) return;
  if (p.phase === 'victoire' || p.phase === 'defaite') ecrire(CLE_PARTIE, null);
  else ecrire(CLE_PARTIE, p);
}

function verifierSucces() {
  if (p) for (const id of P.succesAtteints(p)) succes.debloquer(id);
}

/* ------------------------------------------------------------------ */
/* Menu, choix du deck                                                 */
/* ------------------------------------------------------------------ */

function majMenu() {
  const s = lire(CLE_PARTIE, null);
  const b = $('b-continuer');
  b.hidden = !s || !s.phase || ['victoire', 'defaite'].includes(s.phase);
  if (!b.hidden) {
    let bl = '';
    try { bl = s.antes[s.ante]?.[s.blindIdx]?.nom || ''; } catch { /* ancienne sauvegarde */ }
    $('continuer-info').textContent = `${s.mode === 'infini' ? 'Infini' : 'Classique'} · Ante ${s.ante + 1}${bl ? ` · ${bl}` : ''} · $${s.argent}`;
  }
  const r = records();
  const morceaux = [];
  if (r.victoires) morceaux.push(`🏆 ${r.victoires} victoire${r.victoires > 1 ? 's' : ''}`);
  if (r.anteInfini) morceaux.push(`♾️ Ante ${r.anteInfini}`);
  if (r.meilleure) morceaux.push(`💥 ${nb(r.meilleure)} en une main`);
  $('records').textContent = morceaux.join('  ·  ');
  $('b-son-menu').textContent = son.estMuet() ? '🔇' : '🔊';
  son.musique('tapis');
}

function ouvrirDecks(mode) {
  modeChoisi = mode;
  $('deck-mode').textContent = mode === 'infini' ? 'Mode Infini — des antes sans fin.' : 'Mode Classique — 4 antes jusqu’au ROI.';
  $('decks').innerHTML = Object.entries(P.DECKS).map(([id, d]) => `<button class="deck ${id}" data-deck="${id}">
    <span class="dos">${d.glyphe}</span><b>${d.nom}</b><span>${d.texte}</span></button>`).join('');
  $('in-graine').value = P.nouvelleGraine();
  miseChoisie = Math.min(miseChoisie, miseMax());
  rendreMises();
  aller('s-deck');
}

function rendreMises() {
  const max = miseMax();
  $('mises').innerHTML = MISES.map((m, i) => `<button class="mise${i === miseChoisie ? ' on' : ''}" data-mise="${i}" style="--mc:${m.couleur}"
    ${i > max ? 'disabled title="Gagnez la mise précédente pour la débloquer"' : ''}><i></i>${i > max ? '🔒 ' : ''}${m.nom}</button>`).join('');
  const cumul = MISES.slice(1, miseChoisie + 1).map((m) => m.texte.replace(/^Et /, '').replace(/\.$/, '')).join(' · ');
  $('mise-texte').textContent = miseChoisie ? cumul : MISES[0].texte;
}

function nouvellePartie(deck) {
  const graine = P.nettoyerGraine($('in-graine').value) || P.nouvelleGraine();
  p = P.creerPartie({ mode: modeChoisi, deck, graine, mise: miseChoisie });
  choix = new Set();
  suivre();
}

/* ------------------------------------------------------------------ */
/* Le chef d'orchestre : chaque phase a son écran                      */
/* ------------------------------------------------------------------ */

function suivre() {
  sauver();
  verifierSucces();
  const b = P.blindCourante(p);
  document.body.classList.toggle('boss', !!b.boss && ['intro', 'jeu'].includes(p.phase));
  switch (p.phase) {
    case 'intro':
      aller('s-jeu');
      rendreJeu();
      montrerIntro();
      son.musique(b.boss ? `boss_${b.boss}` : 'tapis');
      break;
    case 'jeu':
      aller('s-jeu');
      rendreJeu();
      son.musique(b.boss ? `boss_${b.boss}` : 'tapis');
      break;
    case 'gagne':
      if (!$('s-jeu').classList.contains('is-active')) { aller('s-jeu'); rendreJeu(); }
      montrerGains();
      break;
    case 'boutique':
      aller('s-boutique');
      rendreBoutique();
      son.musique('boutique');
      break;
    case 'victoire':
    case 'defaite':
      montrerFin();
      break;
    default: break;
  }
}

/* ------------------------------------------------------------------ */
/* La table de jeu                                                     */
/* ------------------------------------------------------------------ */

function rendreBlind() {
  const b = P.blindCourante(p);
  const glyphe = b.boss ? P.BOSS[b.boss].glyphe : ['🐜', '🪲'][p.blindIdx] || '🎯';
  $('blind').className = `blind${b.boss ? ' boss' : ''}`;
  $('blind').innerHTML = `<span class="jeton">${glyphe}</span>
    <span class="bt"><b>${esc(b.nom)}</b><span>${esc(b.sous)}</span><i>🎯 ${nb(b.objectif)} · 💰 $${b.recompense}${(p.tags || []).length
      ? `<span class="tags-attente" title="Tags en attente">${p.tags.map((t) => TAGS[t].glyphe).join('')}</span>` : ''}</i></span>`;
  $('score').textContent = nb(p.score);
  $('jauge').style.width = `${Math.min(100, (100 * p.score) / b.objectif)}%`;
}

function rendreCompteurs() {
  $('n-mains').textContent = p.mainsRestantes;
  $('n-defausses').textContent = p.defaussesRestantes;
  $('n-argent').textContent = `$${nb(p.argent)}`;
  $('n-ante').textContent = p.mode === 'infini' ? `${p.ante + 1}` : `${p.ante + 1}/${P.ANTES_CLASSIQUE}`;
  $('pioche').textContent = `🂠 ${p.pioche.length}/${p.paquet.length}`;
  $('b-livre').hidden = !p.saintLivre;
  $('b-son').textContent = son.estMuet() ? '🔇' : '🔊';
}

function rendreJokers(cible = $('jokers'), negCible = $('negatifs')) {
  const actifs = new Set(P.jokersActifs(p).map((j) => j.uid));
  const html = p.jokers.map((j) => jokerHtml(j, { cls: actifs.has(j.uid) ? '' : 'eteint' })).join('')
    + Array.from({ length: Math.max(0, p.maxJokers - p.jokers.length) }, () => '<span class="place-vide"></span>').join('');
  cible.innerHTML = html;
  negCible.innerHTML = p.negatifs.map((j) => jokerHtml(j, { cls: actifs.has(j.uid) ? '' : 'eteint' })).join('');
  $('consos').innerHTML = p.consommables.map((o, i) => consoHtml(o.id, { attrs: `data-conso="${i}"` })).join('');
}

/** La sélection, Poisson compris (il part de force). */
const selection = () => {
  const s = [...choix].filter((u) => p.main.includes(u));
  for (const u of P.forcees(p)) if (!s.includes(u)) s.push(u);
  return s;
};

function rendreMain(nouvelles = new Set(), liste = p.main) {
  const forcees = new Set(P.forcees(p));
  $('main').innerHTML = liste.map((u) => {
    const c = p.cartes[u];
    const cls = [choix.has(u) || forcees.has(u) ? 'choisie' : '', forcees.has(u) ? 'forcee' : '', nouvelles.has(u) ? 'nouvelle' : ''].join(' ');
    return carteHtml(c, { cls });
  }).join('');
  [...$('main').querySelectorAll('.carte.nouvelle')].forEach((el, k) => { el.style.animationDelay = `${k * 70}ms`; });
  serrerMain();
}

/** Plus il y a de cartes, plus elles se chevauchent : la main tient toujours dans la largeur. */
function serrerMain() {
  const h = $('main');
  const cartes = h.querySelectorAll('.carte');
  if (cartes.length < 2) return;
  const cw = cartes[0].offsetWidth;
  const place = h.clientWidth - 16;
  const chev = Math.min(-0.16 * cw, (place - cartes.length * cw) / (cartes.length - 1));
  h.style.setProperty('--chev', `${Math.round(chev)}px`);
}
addEventListener('resize', serrerMain);

function majApercu() {
  if (occupe) return;
  const sel = selection();
  const a = P.apercu(p, sel);
  if (!a) {
    $('calcul-main').innerHTML = '<small>Choisissez jusqu’à 5 cartes</small>';
    $('chips').textContent = '0';
    $('mult').textContent = '0';
    $('info-main').innerHTML = '';
  } else {
    $('calcul-main').innerHTML = `${MAIN[a.main].nom} <small>niv. ${a.niveau}</small>`;
    $('chips').textContent = nb(a.chips);
    $('mult').textContent = nb(a.mult);
    $('info-main').innerHTML = `<b>${MAIN[a.main].nom}</b> · niv. ${a.niveau} — <span class="c">${nb(a.chips)}</span> × <span class="m">${nb(a.mult)}</span>`;
  }
  $('calcul').classList.remove('feu');
  const peut = p.phase === 'jeu' && !occupe;
  $('b-jouer').disabled = !peut || !sel.length || p.mainsRestantes <= 0;
  $('b-defausser').disabled = !peut || !choix.size || p.defaussesRestantes <= 0;
}

function rendreJeu() {
  rendreBlind();
  rendreCompteurs();
  rendreJokers();
  rendreMain();
  majApercu();
  if (p.message) { toast(p.message, 3200); p.message = null; }
}

/* ------------------------------------------------------------------ */
/* Jouer une main : le calcul, pas à pas                               */
/* ------------------------------------------------------------------ */

function cibleEtape(e) {
  if (e.t === 'carte') return $('table').querySelector(`[data-uid="${e.uid}"]`);
  if (e.t === 'joker') return document.querySelector(`#jokers [data-uid="${e.uid}"], #negatifs [data-uid="${e.uid}"]`);
  if (e.t === 'acier') return $('main').querySelector(`[data-uid="${e.uid}"]`);
  if (e.t === 'boss') return $('blind');
  return $('table');
}

function sorteGain(e) {
  if (e.mauvais) return 'mauvais';
  if (e.or) return 'o';
  if (/×/.test(e.gain)) return 'x';
  if (/Mult/.test(e.gain)) return 'm';
  return 'c';
}

async function compterLeScore(res, avant) {
  const etapes = res.etapes;
  const b = P.blindCourante(p);
  // La main de départ : le nom, les chips et le Mult de base.
  $('calcul-main').innerHTML = esc(etapes[0].label);
  $('chips').textContent = nb(etapes[0].chips);
  $('mult').textContent = nb(etapes[0].mult);
  pop($('chips')); pop($('mult'));
  await attendre(rapide ? 60 : 420);

  let derniers = { chips: etapes[0].chips, mult: etapes[0].mult };
  for (let i = 1; i < etapes.length; i++) {
    const e = etapes[i];
    const el = cibleEtape(e);
    if (el) {
      const anim = e.t === 'joker' ? 'agit' : 'compte';
      el.classList.remove(anim); void el.offsetWidth; el.classList.add(anim);
      envol(el, e.gain, sorteGain(e));
    }
    if (e.chips !== derniers.chips) { $('chips').textContent = nb(e.chips); pop($('chips')); }
    if (e.mult !== derniers.mult) { $('mult').textContent = nb(e.mult); pop($('mult')); }
    derniers = e;
    await attendre(rapide ? 45 : Math.max(150, 430 - i * 22));
  }

  // Le total.
  const reste = Math.max(0, b.objectif - avant);
  if (res.points >= reste && res.points > 0) $('calcul').classList.add('feu');
  const etiquette = res.poisson === 'x4' ? '<span class="nom">🐟 POISSON ×4 !</span>'
    : res.poisson === 'maudit' ? '<span class="nom mauvais">🐟 POISSON MAUDIT ! Plus de défausses</span>' : '';
  $('annonce').innerHTML = `<div class="total">${nb(res.points)}</div>${etiquette}`;
  son.bruit(res.points >= reste ? 'gagne' : 'jouer', 0.5);
  // Le score de la manche grimpe.
  const fin = avant + res.points;
  const t0 = performance.now();
  const duree = rapide ? 150 : 700;
  // L'image suit l'horloge, mais l'horloge décide : un onglet caché ne dessine plus, il ne doit pas bloquer la partie.
  await new Promise((ok) => {
    let fini = false;
    const poser = (k) => {
      $('score').textContent = nb(Math.round(avant + (fin - avant) * (1 - (1 - k) ** 3)));
      $('jauge').style.width = `${Math.min(100, (100 * (avant + (fin - avant) * k)) / b.objectif)}%`;
    };
    const pas = (t) => {
      if (fini) return;
      const k = Math.min(1, (t - t0) / duree);
      poser(k);
      if (k < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
    setTimeout(() => { fini = true; poser(1); ok(); }, duree + 30);
  });
  pop($('score'));
  await attendre(rapide ? 200 : 700);
}

async function jouerMain() {
  if (occupe || !p || p.phase !== 'jeu') return;
  const sel = selection();
  const mainAvant = [...p.main];
  const avant = p.score;
  const blindAvant = P.blindCourante(p);
  const res = P.jouer(p, sel);
  if (!res.ok) { refuse(res); return; }
  occupe = true;
  rapide = false;
  choix = new Set();
  $('info-main').innerHTML = '';
  son.bruit('jouer');

  // Les cartes jouées passent sur la table ; la main attend ses nouvelles cartes.
  const r = res.resultat;
  $('table').innerHTML = `<div class="annonce" id="annonce"></div>${r.cartes.map((u) => carteHtml(p.cartes[u], { cls: r.compte.includes(u) ? '' : 'inerte' })).join('')}`;
  rendreMain(new Set(), mainAvant.filter((u) => !r.cartes.includes(u)));
  $('b-jouer').disabled = true;
  $('b-defausser').disabled = true;
  // Pendant le calcul, la blind affichée est encore celle qu'on vient de jouer.
  $('blind').querySelector('i').textContent = `🎯 ${nb(blindAvant.objectif)} · 💰 $${blindAvant.recompense}`;

  await compterLeScore(r, avant);

  $('table').querySelectorAll('.carte').forEach((el, k) => { el.style.animationDelay = `${k * 50}ms`; el.classList.add('partie'); });
  await attendre(rapide ? 150 : 480);
  $('table').innerHTML = '<div class="annonce" id="annonce"></div>';
  occupe = false;
  if (r.vole) toast(`🦹 Le Voleur vous a pris $${r.vole} !`);
  if (r.verres) toast(`💥 CRAC ! ${r.verres} carte${r.verres > 1 ? 's' : ''} de verre brisée${r.verres > 1 ? 's' : ''}.`);
  if (p.phase === 'jeu') {
    rendreBlind();
    rendreCompteurs();
    rendreJokers();
    rendreMain(new Set(p.main.filter((u) => !mainAvant.includes(u))));
    majApercu();
    if (p.message) { toast(p.message, 3200); p.message = null; }
    sauver();
    verifierSucces();
  } else {
    if (p.phase === 'defaite') son.bruit('perdu');
    suivre();
  }
}

async function defausser() {
  if (occupe || !p || p.phase !== 'jeu') return;
  const mainAvant = [...p.main];
  const sel = [...choix];
  const res = P.defausser(p, sel);
  if (!res.ok) { refuse(res); return; }
  occupe = true;
  son.bruit('defausse');
  for (const u of res.defaussees) $('main').querySelector(`[data-uid="${u}"]`)?.classList.add('jetee');
  await attendre(320);
  occupe = false;
  choix = new Set();
  rendreCompteurs();
  rendreMain(new Set(p.main.filter((u) => !mainAvant.includes(u))));
  majApercu();
  if (p.message) { toast(p.message, 3200); p.message = null; }
  sauver();
}

/* ------------------------------------------------------------------ */
/* Intro, butin, fin                                                   */
/* ------------------------------------------------------------------ */

/**
 * Le choix de la blind, comme à la vraie table : les trois blinds de l'ante
 * côte à côte, le boss visible d'avance. On joue celle du moment, ou on la
 * passe pour un tag.
 */
function montrerIntro() {
  P.blindCourante(p);
  const ante = p.antes[p.ante];
  const titre = `Ante ${p.ante + 1}${p.mode === 'classique' ? `/${P.ANTES_CLASSIQUE}` : ''}${p.mise ? ` · ${MISES[p.mise].nom}` : ''}`;
  const colonnes = ante.map((b, k) => {
    const etat = k < p.blindIdx ? 'finie' : k === p.blindIdx ? 'courante' : 'avenir';
    const glyphe = b.boss ? P.BOSS[b.boss].glyphe : ['🐜', '🪲'][k] || '🎯';
    const nomBlind = b.boss ? 'Boss' : ['Petite blind', 'Grande blind'][k];
    const tag = b.tag ? TAGS[b.tag] : null;
    let bas = '';
    if (etat === 'finie') bas = `<span class="statut-b">${b.passee ? '⏭️ Passée' : '✅ Vaincue'}</span>`;
    else if (etat === 'courante') {
      bas = `<button class="btn ${b.boss ? 'rouge' : 'vert'}" data-blind="jouer">${b.boss ? 'Affronter le boss' : 'Jouer'}</button>`;
      if (tag) bas += `<button class="btn petit" data-blind="passer">⏭️ Passer pour un tag</button>`;
    }
    const tagHtml = tag && etat !== 'finie' ? `<div class="tag-passer"><span class="tg">${tag.glyphe}</span><div><b>${esc(tag.nom)}</b><span>${esc(tag.texte)}</span></div></div>` : '';
    return `<div class="blind-c ${etat}${b.boss ? ' boss' : ''}">
      <span class="etape">${nomBlind}</span>
      <div class="jeton-grand">${glyphe}</div>
      <h3>${esc(b.nom)}</h3>
      <div class="ob">🎯 ${nb(b.objectif)}<small>Récompense : ${b.recompense ? `$${b.recompense}` : 'rien'}</small></div>
      ${b.boss ? `<p class="effet">${esc(P.BOSS[b.boss].texte)}</p>` : tagHtml}
      ${bas}
    </div>`;
  }).join('');
  const b = P.blindCourante(p);
  $('intro').className = `feuille intro choix-blinds${b.boss ? ' boss' : ''}`;
  $('intro').innerHTML = `<h2>${titre}</h2>
    <p class="sous">Jouez la blind, ou passez-la pour gagner son tag (le boss, lui, ne se passe pas).</p>
    <div class="blinds">${colonnes}</div>
    ${b.boss === 'silence' && p.silence !== null ? `<p class="sous">🤫 Le Silencieux éteint : <b>${esc(JOKERS[P.tousJokers(p)[p.silence].id].nom)}</b></p>` : ''}`;
  ouvrir('ov-intro');
}

function choixBlind(quoi) {
  if (quoi === 'jouer') {
    P.commencer(p);
    fermer('ov-intro');
    suivre();
    return;
  }
  const r = P.passer(p);
  if (!r.ok) { refuse(r); return; }
  son.bruit('caisse', 0.4);
  toast(`${TAGS[r.tag].glyphe} ${esc(TAGS[r.tag].nom)} : ${esc(TAGS[r.tag].texte)}`, 3400);
  suivre();
}

function montrerGains() {
  const g = p.gains;
  const lignes = [
    ['Récompense de la blind', g.recompense],
    ['Intérêts', g.interet],
    ['Bonus de victoires', g.victoires],
    g.boss ? ['Bonus de boss', g.boss] : null,
  ].filter(Boolean);
  const total = lignes.reduce((s, [, v]) => s + v, 0);
  $('gains').innerHTML = `<h2>Manche gagnée !</h2>
    <p class="sous">Score : <b>${nb(p.score)}</b></p>
    <div class="lignes">${lignes.map(([t, v], k) => `<div style="animation-delay:${k * 120}ms"><span>${t}</span><b>+$${v}</b></div>`).join('')}</div>
    <div class="total">+$${total}</div>
    ${g.voucher ? `<p class="sous">🎟️ Un bon vous attend en boutique : <b>${esc(VOUCHER[g.voucher].nom)}</b></p>` : ''}
    ${g.avare ? '<p class="sous">💰 L’Avare : la boutique coûte deux fois plus cher.</p>' : ''}
    <button class="btn or" id="b-boutique" style="width:100%">Aller à la boutique ›</button>`;
  ouvrir('ov-gains');
  son.bruit('caisse');
  $('b-boutique').onclick = () => {
    fermer('ov-gains');
    P.allerBoutique(p);
    suivre();
  };
}

function montrerFin() {
  const victoire = p.phase === 'victoire';
  const r = records();
  const nouveauRecord = p.stats.meilleure > r.meilleure || (p.mode === 'infini' && p.ante + 1 > r.anteInfini);
  if (!p.fini) {
    p.fini = true;
    if (victoire) r.victoires += 1;
    // Une mise gagnée pour la première fois débloque la suivante.
    p.debloque = victoire && p.mode === 'classique' && (p.mise || 0) > r.miseGagnee && (p.mise || 0) + 1 < MISES.length;
    if (victoire && p.mode === 'classique') r.miseGagnee = Math.max(r.miseGagnee, p.mise || 0);
    if (p.stats.meilleure > r.meilleure) { r.meilleure = p.stats.meilleure; r.meilleureNom = p.stats.meilleureNom; }
    if (p.mode === 'infini') r.anteInfini = Math.max(r.anteInfini, p.ante + 1);
    r.historique = [{ mode: p.mode, deck: p.deck, victoire, ante: p.ante + (victoire ? 0 : 1), blind: p.blindIdx + 1,
      meilleure: p.stats.meilleure, graine: p.graine, date: new Date().toISOString().slice(0, 10) }, ...r.historique].slice(0, 12);
    ecrire(CLE_RECORDS, r);
    son.bruit(victoire ? 'gagne' : 'perdu');
  }
  ecrire(CLE_PARTIE, null);
  const b = P.blindCourante(p);
  $('fin').className = `feuille fin ${victoire ? 'victoire' : 'defaite'}`;
  $('fin').innerHTML = `<h2>${victoire ? 'VICTOIRE !' : 'GAME OVER'}</h2>
    <p class="sous">${victoire ? 'Vous avez vaincu le ROI !' : `Battu par ${esc(b.nom)} — ${nb(p.score)} / ${nb(b.objectif)}`}</p>
    ${nouveauRecord ? '<p class="record">★ NOUVEAU RECORD ★</p>' : ''}
    <div class="stats">
      <div><span>Ante atteinte</span><b>${victoire ? P.ANTES_CLASSIQUE : p.ante + 1}${p.mode === 'classique' ? `/${P.ANTES_CLASSIQUE}` : ' (Infini)'}</b></div>
      <div><span>Meilleure main</span><b>${nb(p.stats.meilleure)}</b><small> ${esc(p.stats.meilleureNom || '')}</small></div>
      <div><span>Mains jouées</span><b>${p.stats.mainsJouees}</b></div>
      <div><span>Argent gagné</span><b>$${nb(p.stats.gainTotal)}</b></div>
      <div><span>Défausses</span><b>${p.stats.defausses}</b></div>
      <div><span>Graine</span><b>${esc(p.graine)}</b></div>
      <div><span>Mise</span><b style="color:${MISES[p.mise || 0].couleur}">${MISES[p.mise || 0].nom}</b></div>
      <div><span>Blinds passées</span><b>${p.stats.passees || 0}</b></div>
    </div>
    ${p.debloque ? `<p class="record">🔓 ${MISES[(p.mise || 0) + 1].nom} débloquée !</p>` : ''}
    <div class="ligne-boutons">
      <button class="btn" id="b-fin-menu">Menu</button>
      <button class="btn vert" id="b-fin-rejouer">Rejouer</button>
    </div>`;
  ouvrir('ov-fin');
  $('b-fin-menu').onclick = () => { fermer('ov-fin'); p = null; aller('s-menu'); majMenu(); };
  $('b-fin-rejouer').onclick = () => { fermer('ov-fin'); const m = p.mode; p = null; ouvrirDecks(m); };
}

/* ------------------------------------------------------------------ */
/* La boutique                                                          */
/* ------------------------------------------------------------------ */

function rendreBoutique() {
  const bq = p.boutique;
  $('bq-argent').textContent = `$${nb(p.argent)}`;
  $('bq-voucher').innerHTML = bq.voucher ? `<div class="voucher"><span class="v-art">🎟️</span>
    <div><b>Bon offert : ${esc(VOUCHER[bq.voucher].nom)}</b><p>${esc(VOUCHER[bq.voucher].texte)}</p></div>
    <button class="btn or" id="b-voucher">Prendre</button></div>` : '';
  $('bq-items').innerHTML = bq.items.length
    ? bq.items.map((it, i) => offreHtml(it, { prix: P.prix(p, it), possible: p.argent >= P.prix(p, it), attrs: `data-item="${i}"` })).join('')
    : '<p class="sous" style="grid-column:1/-1">La boutique est vide. Rafraîchissez-la, ou passez à la suite.</p>';
  const cout = P.coutRafraichir(p);
  $('b-rafraichir').textContent = bq.gratuits > 0 ? `🔄 Gratuit (${bq.gratuits})` : cout ? `🔄 Rafraîchir · $${cout}` : '🔄 Rafraîchir (gratuit)';
  $('b-rafraichir').disabled = bq.gratuits <= 0 && p.argent < cout;
  $('bq-places').textContent = `${p.jokers.length}/${p.maxJokers}${p.negatifs.length ? ` · ${p.negatifs.length} négatif${p.negatifs.length > 1 ? 's' : ''}` : ''}`;
  $('bq-jokers').innerHTML = [
    ...p.jokers.map((j, i) => `<div class="case">${jokerHtml(j)}<button class="btn petit rouge" data-vendre="${i}">Vendre $${P.prixVente(j)}</button></div>`),
    ...p.negatifs.map((j) => `<div class="case">${jokerHtml(j)}<small style="font-size:.6rem;color:#ff8ad8">invendable</small></div>`),
  ].join('') || '<p class="sous">Aucun Joker pour l’instant.</p>';
  $('bq-consos').innerHTML = p.consommables.length
    ? `<span class="sous" style="margin:0">Consommables :</span>${p.consommables.map((o, i) => consoHtml(o.id, { attrs: `data-conso="${i}"` })).join('')}` : '';
  if (bq.pack) montrerPack(); else fermer('ov-pack');
  if (bq.choix) montrerChoix(); else fermer('ov-choix');
}

function apresAchat() {
  pop($('bq-argent'));
  sauver();
  verifierSucces();
  rendreBoutique();
}

function montrerPack() {
  const pk = p.boutique.pack;
  const options = pk.type === 'joker' || pk.type === 'celeste' || pk.type === 'arcane'
    ? pk.options.map((o, i) => offreHtml(o, { prix: null, attrs: `data-pack="${i}"` })).join('')
    : pk.options.map((o, i) => {
      const c = { ...p.cartes[o.uid], enh: o.enh };
      return `<div class="offre r-rare" style="--rc:#5b8cff" data-pack="${i}"><span class="rar">Amélioration</span>
        <div class="mini" style="--cw:70px;padding:6px 0 10px">${carteHtml(c)}</div>
        <b>${esc(texteCarte(c).titre)}</b><p>${esc(({ bonus: '+30 chips', mult: '+4 Mult', verre: '×1,5 Mult (peut se briser)', acier: '×1,5 Mult en main', pierre: '+50 chips, compte toujours' })[o.enh])}</p></div>`;
    }).join('');
  const titres = { joker: '🎁 Pack Joker', carte: '🃏 Pack Carte', celeste: '🪐 Pack Céleste', arcane: '🔮 Pack Arcane' };
  const aide = { celeste: 'La planète choisie fait aussitôt monter sa main.', arcane: 'Le tarot choisi rejoint vos consommables.' };
  $('pack').innerHTML = `<h2>${titres[pk.type]}</h2>
    <p class="sous">Choisissez-en <b>un</b> : les autres sont perdus. ${aide[pk.type] || ''}</p>`;  $('pack').innerHTML += `<div class="pack-options">${options}</div>`;
  ouvrir('ov-pack');
}

function montrerChoix() {
  const ch = p.boutique.choix;
  const o = OBJETS[ch.id];
  const cartes = P.ameliorables(p).map((u) => p.cartes[u])
    .sort((a, b) => (a.s === b.s ? b.r - a.r : 'SHCD'.indexOf(a.s) - 'SHCD'.indexOf(b.s)));
  $('choix').innerHTML = `<h2>${o.glyphe} ${esc(o.nom)}</h2>
    <p class="sous">${esc(o.texte)} — encore <b>${ch.reste}</b> carte${ch.reste > 1 ? 's' : ''} à choisir.</p>
    <div class="paquet">${cartes.map((c) => carteHtml(c)).join('')}</div>
    <button class="btn" id="b-hasard">🎲 Au hasard</button>`;
  ouvrir('ov-choix');
}

/* ------------------------------------------------------------------ */
/* Les fiches (Joker, carte, consommable)                              */
/* ------------------------------------------------------------------ */

function ficheJoker(uid) {
  const tous = P.tousJokers(p);
  const j = tous.find((x) => x.uid === uid);
  if (!j) return;
  const d = JOKERS[j.id];
  const r = RARETES[d.rarete];
  const i = p.jokers.indexOf(j);
  const peutVendre = ['boutique', 'jeu', 'intro'].includes(p.phase) && !occupe;
  const peutBouger = i >= 0 && !occupe && ['jeu', 'intro', 'boutique'].includes(p.phase) && p.jokers.length > 1;
  const eteint = !P.jokersActifs(p).includes(j);
  $('detail').innerHTML = `<button class="rond fermer" data-ferme="ov-detail">✕</button>
    ${jokerHtml(j)}
    <h3>${esc(d.nom)}</h3>
    <span class="rar" style="color:${r.couleur}">${r.nom}${j.edition ? ` · ${EDITIONS[j.edition].nom}` : ''}</span>
    <p>${esc(d.texte)}${j.edition ? `<br><b>${EDITIONS[j.edition].nom}</b> : ${EDITIONS[j.edition].texte}` : ''}</p>
    ${compteurJoker(j) ? `<p class="compteur">${esc(compteurJoker(j))}</p>` : ''}
    ${eteint && ['jeu', 'intro'].includes(p.phase) ? '<p class="sous">🚫 Désactivé par le boss pour cette manche.</p>' : ''}
    ${peutBouger ? `<div class="ligne-boutons"><button class="btn petit" data-bouge="-1" ${i === 0 ? 'disabled' : ''}>◀ Gauche</button>
      <button class="btn petit" data-bouge="1" ${i === p.jokers.length - 1 ? 'disabled' : ''}>Droite ▶</button></div>` : ''}
    ${peutVendre && i >= 0 ? `<div class="ligne-boutons"><button class="btn rouge" data-vendre="${i}">Vendre · $${P.prixVente(j)}</button></div>` : ''}`;
  $('detail').dataset.joker = uid;
  ouvrir('ov-detail');
}

function ficheCarte(uid) {
  const c = p.cartes[uid];
  if (!c) return;
  const t = texteCarte(c);
  $('detail').innerHTML = `<button class="rond fermer" data-ferme="ov-detail">✕</button>${carteHtml(c)}<h3>${esc(t.titre)}</h3><p>${t.texte}</p>`;
  delete $('detail').dataset.joker;
  ouvrir('ov-detail');
}

function ficheConso(i) {
  const o = p.consommables[i];
  if (!o) return;
  const info = infoConso(o.id);
  let aide = '';
  if (info.cible) {
    const [a, b] = info.cible;
    const n = [...choix].filter((u) => p.main.includes(u)).length;
    aide = p.phase !== 'jeu'
      ? '<p class="utiliser-aide">À utiliser pendant une manche, sur les cartes de votre main.</p>'
      : `<p class="utiliser-aide">Sélectionnez ${a === b ? a : `de ${a} à ${b}`} carte${b > 1 ? 's' : ''} dans votre main (${n} sélectionnée${n > 1 ? 's' : ''}).</p>`;
  }
  const sorte = { planete: 'Planète', tarot: `Tarot ${info.num || ''}`, elixir: 'Consommable' }[info.sorte];
  $('detail').innerHTML = `<button class="rond fermer" data-ferme="ov-detail">✕</button>
    ${consoHtml(o.id)}<h3>${esc(info.nom)}</h3><span class="rar" style="color:#c9a6ff">${sorte}</span>
    <p>${esc(info.texte)}${info.sorte === 'planete' ? ` <br><small>Niveau actuel : ${p.niveaux[info.main]}</small>` : ''}</p>${aide}
    <div class="ligne-boutons"><button class="btn" data-vendre-conso="${i}">Vendre · $1</button>
    <button class="btn vert" data-utiliser="${i}">Utiliser</button></div>`;
  delete $('detail').dataset.joker;
  ouvrir('ov-detail');
}

function utiliserConso(i) {
  const r = P.utiliserConsommable(p, i, [...choix]);
  if (!r.ok) { refuse(r); return; }
  toast(`✨ ${esc(r.message || 'Fait !')}`, 3000);
  son.bruit('caisse', 0.35);
  fermer('ov-detail');
  sauver();
  verifierSucces();
  if (p.phase === 'boutique') { rendreBoutique(); return; }
  choix = new Set([...choix].filter((u) => p.main.includes(u)));
  rendreJokers();
  rendreCompteurs();
  rendreBlind();
  rendreMain(new Set(), p.main);
  // Les cartes touchées par le tarot sautent, pour qu'on les voie changer.
  for (const u of r.cartes || []) $('main').querySelector(`[data-uid="${u}"]`)?.classList.add('compte');
  majApercu();
}

/** Le paquet : ce qui reste à piocher, et ce qui est déjà sorti. */
function montrerPaquet() {
  if (!p) return;
  const reste = new Set(p.pioche);
  const parCouleur = ORDRE_COULEURS.map((s) => {
    const cartes = p.paquet.map((u) => p.cartes[u]).filter((c) => !c.special && c.s === s).sort((a, b) => b.r - a.r);
    return `<h3>${COULEURS[s].sym} ${COULEURS[s].noms} — ${cartes.filter((c) => reste.has(c.uid)).length} à piocher</h3>
      <div class="rang-c">${cartes.map((c) => carteHtml(c, { cls: reste.has(c.uid) ? '' : 'sortie' })).join('')}</div>`;
  }).join('');
  const speciales = p.paquet.map((u) => p.cartes[u]).filter((c) => c.special);
  $('paquet').innerHTML = `<p class="sous">${p.pioche.length} carte${p.pioche.length > 1 ? 's' : ''} à piocher sur ${p.paquet.length}. Les cartes grisées sont déjà sorties.</p>
    ${parCouleur}
    ${speciales.length ? `<h3>✨ Cartes spéciales</h3><div class="rang-c">${speciales.map((c) => carteHtml(c, { cls: reste.has(c.uid) ? '' : 'sortie' })).join('')}</div>` : ''}`;
  ouvrir('ov-paquet');
}

function montrerNiveaux() {
  $('niveaux').innerHTML = [...MAINS].reverse().map((m) => {
    const n = p ? p.niveaux[m.id] : 1;
    const b = baseMain(m.id, n);
    return `<div><span>${m.nom}</span><span class="niv">niv. ${n}</span>
      <span class="cm"><b class="chips">${nb(b.chips)}</b><b class="mult">${nb(b.mult)}</b></span></div>`;
  }).join('');
  ouvrir('ov-niveaux');
}

function montrerHistorique() {
  const r = records();
  $('historique').innerHTML = `<div class="records-grands">
      <div><span>Victoires (Classique)</span><b>${r.victoires}</b></div>
      <div><span>Record Infini</span><b>${r.anteInfini ? `Ante ${r.anteInfini}` : '—'}</b></div>
      <div style="grid-column:1/-1"><span>Meilleure main</span><b>${nb(r.meilleure)}</b> <small>${esc(r.meilleureNom || '')}</small></div>
    </div>
    <div class="histo">${r.historique.map((h) => `<div><span class="${h.victoire ? 'ok' : 'ko'}">${h.victoire ? '🏆' : '💀'} ${h.mode === 'infini' ? 'Infini' : 'Classique'} · Ante ${h.ante}</span>
      <span>${nb(h.meilleure)} · ${esc(h.graine)} · ${h.date.slice(5).split('-').reverse().join('/')}</span></div>`).join('')
      || '<p class="sous">Aucune partie terminée pour l’instant.</p>'}</div>`;
  ouvrir('ov-historique');
}

/* ------------------------------------------------------------------ */
/* Branchements                                                        */
/* ------------------------------------------------------------------ */

function brancher() {
  // Menu
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => ouvrirDecks(b.dataset.mode)));
  $('b-continuer').addEventListener('click', () => {
    const s = lire(CLE_PARTIE, null);
    if (!s) { majMenu(); return; }
    p = P.migrer(s);
    choix = new Set();
    suivre();
  });
  $('b-son-menu').addEventListener('click', () => { $('b-son-menu').textContent = son.basculer() ? '🔇' : '🔊'; });
  $('b-son').addEventListener('click', () => { $('b-son').textContent = son.basculer() ? '🔇' : '🔊'; });
  document.querySelectorAll('[data-va]').forEach((b) => b.addEventListener('click', () => { aller(b.dataset.va); majMenu(); }));
  $('decks').addEventListener('click', (e) => { const d = e.target.closest('[data-deck]'); if (d) nouvellePartie(d.dataset.deck); });
  $('mises').addEventListener('click', (e) => {
    const m = e.target.closest('[data-mise]');
    if (!m || m.disabled) return;
    miseChoisie = Number(m.dataset.mise);
    rendreMises();
  });
  $('intro').addEventListener('click', (e) => { const b = e.target.closest('[data-blind]'); if (b) choixBlind(b.dataset.blind); });
  $('pioche').addEventListener('click', montrerPaquet);
  $('b-graine').addEventListener('click', () => { $('in-graine').value = P.nouvelleGraine(); });
  $('in-graine').addEventListener('input', (e) => { e.target.value = P.nettoyerGraine(e.target.value); });

  // Superpositions
  document.querySelectorAll('[data-ouvre]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.ouvre === 'ov-regles') $('regles').innerHTML = reglesHtml();
    if (b.dataset.ouvre === 'ov-historique') { montrerHistorique(); return; }
    ouvrir(b.dataset.ouvre);
  }));
  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-ferme]');
    if (f) fermer(f.dataset.ferme);
  });
  ['ov-detail', 'ov-niveaux', 'ov-regles', 'ov-livre', 'ov-historique', 'ov-paquet'].forEach((id) => $(id).addEventListener('click', (e) => { if (e.target.id === id) fermer(id); }));

  // La main
  $('main').addEventListener('click', (e) => {
    const el = e.target.closest('.carte');
    if (!el || occupe || !p || p.phase !== 'jeu') return;
    const u = el.dataset.uid;
    if (P.forcees(p).includes(u)) { toast('🐟 Le Poisson Dégueulasse est joué de force !'); return; }
    if (choix.has(u)) choix.delete(u);
    else if (selection().length < P.MAX_SELECTION) choix.add(u);
    else { toast('5 cartes au plus.'); return; }
    el.classList.toggle('choisie', choix.has(u));
    majApercu();
  });
  // Un appui long sur une carte : sa fiche.
  let appui = 0;
  $('main').addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.carte');
    if (!el) return;
    appui = setTimeout(() => { appui = -1; ficheCarte(el.dataset.uid); }, 550);
  });
  const lacher = () => { if (appui > 0) clearTimeout(appui); };
  $('main').addEventListener('pointerup', lacher);
  $('main').addEventListener('pointerleave', lacher);
  $('main').addEventListener('contextmenu', (e) => { e.preventDefault(); const el = e.target.closest('.carte'); if (el) ficheCarte(el.dataset.uid); });

  $('b-jouer').addEventListener('click', jouerMain);
  $('b-defausser').addEventListener('click', defausser);
  $('b-tri-rang').addEventListener('click', () => { if (occupe) return; P.trierMain(p, 'rang'); rendreMain(); sauver(); });
  $('b-tri-couleur').addEventListener('click', () => { if (occupe) return; P.trierMain(p, 'couleur'); rendreMain(); sauver(); });
  $('b-niveaux').addEventListener('click', montrerNiveaux);
  $('b-livre').addEventListener('click', () => { $('livre').innerHTML = livreHtml(); ouvrir('ov-livre'); });
  $('b-menu').addEventListener('click', () => ouvrir('ov-quitter'));
  $('b-quitter').addEventListener('click', () => { fermer('ov-quitter'); sauver(); p = null; aller('s-menu'); majMenu(); });
  $('b-abandon').addEventListener('click', () => {
    if (!confirm('Abandonner cette partie ? Elle sera perdue.')) return;
    fermer('ov-quitter');
    ecrire(CLE_PARTIE, null);
    p = null;
    aller('s-menu');
    majMenu();
  });
  // Pendant le calcul, un toucher accélère.
  $('s-jeu').addEventListener('pointerdown', () => { if (occupe) rapide = true; });

  // Les Jokers et les consommables, en jeu comme en boutique
  document.addEventListener('click', (e) => {
    if (!p) return;
    const j = e.target.closest('#jokers .joker, #negatifs .joker, #bq-jokers .joker');
    if (j && !occupe) { ficheJoker(j.dataset.uid); return; }
    const c = e.target.closest('#consos [data-conso], #bq-consos [data-conso]');
    if (c) { ficheConso(Number(c.dataset.conso)); return; }
    const u = e.target.closest('[data-utiliser]');
    if (u) { utiliserConso(Number(u.dataset.utiliser)); return; }
    const vc = e.target.closest('[data-vendre-conso]');
    if (vc) {
      if (P.vendreConso(p, Number(vc.dataset.vendreConso)).ok) {
        son.bruit('caisse', 0.3);
        fermer('ov-detail');
        sauver();
        if (p.phase === 'boutique') rendreBoutique(); else { rendreJokers(); rendreCompteurs(); }
      }
      return;
    }
    const m = e.target.closest('#detail [data-bouge]');
    if (m) {
      const uid = $('detail').dataset.joker;
      const i = p.jokers.findIndex((x) => x.uid === uid);
      if (P.deplacerJoker(p, i, i + Number(m.dataset.bouge)).ok) {
        sauver();
        if (p.phase === 'boutique') rendreBoutique(); else rendreJokers();
        ficheJoker(uid);
      }
      return;
    }
    const v = e.target.closest('[data-vendre]');
    if (v && ['boutique', 'jeu', 'intro'].includes(p.phase) && !occupe) {
      const i = Number(v.dataset.vendre);
      const nom = JOKERS[p.jokers[i]?.id]?.nom;
      const r = P.vendre(p, i);
      if (!r.ok) { refuse(r); return; }
      son.bruit('caisse');
      toast(`${esc(nom)} vendu.`);
      fermer('ov-detail');
      if (p.phase === 'boutique') apresAchat();
      else { sauver(); rendreJokers(); rendreCompteurs(); majApercu(); }
    }
  });

  // La boutique
  $('bq-items').addEventListener('click', (e) => {
    const b = e.target.closest('[data-acheter]');
    if (!b) return;
    const i = Number(b.closest('[data-item]').dataset.item);
    const r = P.acheter(p, i);
    if (!r.ok) { refuse(r); return; }
    son.bruit('caisse');
    const nom = r.item.type === 'joker' ? JOKERS[r.item.id].nom
      : r.item.type === 'objet' ? OBJETS[r.item.id].nom : infoConso(`${r.item.type}:${r.item.id}`).nom;
    if (!p.boutique.pack && !p.boutique.choix) toast(`${esc(nom)} acheté !`);
    if (r.item.id === 'roulette') toast('🎡 Une WILDCARD a rejoint votre paquet… attention aux mutations !', 3200);
    if (r.item.id === 'saint-livre') toast('📖 Le Saint Livre est à vous : touchez 📖 pendant la partie.', 3200);
    apresAchat();
  });
  $('bq-voucher').addEventListener('click', (e) => {
    if (!e.target.closest('#b-voucher')) return;
    const r = P.prendreVoucher(p);
    if (r.ok) { toast(`🎟️ ${esc(r.voucher.nom)} : actif pour toute la run !`); son.bruit('caisse'); apresAchat(); }
  });
  $('b-rafraichir').addEventListener('click', () => {
    const r = P.rafraichir(p);
    if (!r.ok) { refuse(r); return; }
    son.bruit('caisse', 0.3);
    apresAchat();
  });
  $('b-sortir').addEventListener('click', () => {
    P.quitterBoutique(p);
    suivre();
  });
  $('pack').addEventListener('click', (e) => {
    const o = e.target.closest('[data-pack]');
    if (!o) return;
    const r = P.choisirPack(p, Number(o.dataset.pack));
    if (r.ok && r.revendu) toast('Plus de place : le Joker a été revendu.');
    son.bruit('caisse', 0.4);
    apresAchat();
  });
  $('choix').addEventListener('click', (e) => {
    if (e.target.closest('#b-hasard')) { P.auHasard(p); apresAchat(); return; }
    const c = e.target.closest('.carte');
    if (!c) return;
    if (P.choisirCarte(p, c.dataset.uid).ok) apresAchat();
  });

  // Au clavier : 1-8 pour choisir, Entrée pour jouer, D pour défausser
  document.addEventListener('keydown', (e) => {
    if (!p || p.phase !== 'jeu' || !$('s-jeu').classList.contains('is-active') || e.target.tagName === 'INPUT') return;
    if (/^[1-9]$/.test(e.key)) {
      const el = $('main').querySelectorAll('.carte')[Number(e.key) - 1];
      if (el) el.click();
    } else if (e.key === 'Enter') jouerMain();
    else if (e.key.toLowerCase() === 'd') defausser();
  });
}

brancher();
succes.visiter('baltrou');
majMenu();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
