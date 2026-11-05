/**
 * LÉGENDES — le gacha de l'arcade : l'accueil (le chef en grand, le bouton QUÊTE, le carrousel des
 * portails), les portails (et leur détecteur), la collection, les éveils par médailles, l'équipe, les
 * quêtes (histoire en trois difficultés, épreuves des fêtes, jeu de fin), le choix de l'allié et les
 * combats (le plateau de sphères où l'on trace un chemin, les super attaques).
 *
 * Les moteurs sont partagés et testés (shared/legendes/) ; ici, l'affichage. Tout est gardé sur l'appareil.
 * Pour essayer une autre date : ?jour=2027-12-24
 */

import { PERSOS, PERSO, ELEMENTS, CATEGORIES, LIENS, ROLES, RARETES, ORDRE, stats } from '../../../shared/legendes/persos.js';
import { texteChef } from '../../../shared/legendes/passifs.js';
import { jourDe, dateDe, portails, fetesDu, FETE, FETES, dansFete } from '../../../shared/legendes/calendrier.js';
import { nouvelEtat, invoquer, prixMulti, palierDe, connexion, cadeauFete, recupererCadeaux, PALIERS, PRIX, PITIE, TAUX } from '../../../shared/legendes/gacha.js';
import { creerCombat, jouerTour, rotation, kiPour, liens, voisines, KI_SUPER, KI_ULTIME, KI_MAX, COLS, NB_SPHERES } from '../../../shared/legendes/combat.js';
import { CHAPITRES, EPREUVES, DIFFICULTES, ennemisEn, DEFIS, ULTIME, etage, butin, coutAct } from '../../../shared/legendes/niveaux.js';
import { CHAINES, MEDAILLES, eveilDe, peutEveiller, eveiller, ajouterMedailles, nouveauJoueur, endurance, depenser, gagnerExp, actMax, expPour, prochainPoint } from '../../../shared/legendes/eveils.js';
import { portrait, ennemi } from './portrait.js';
import { illustration, rendreReactif } from './art.js';
import { invocation, superAttaque, superEnnemi, transformation, finCombat } from './animations.js';
import { creerParticules, secouer, arret } from './effets.js';
import * as son from './sons.js';

const $ = (id) => document.getElementById(id);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const fr = (n) => n.toLocaleString('fr-FR');

/* ---------------- La date (on peut la changer pour essayer : ?jour=2027-12-24) ---------------- */
const parametre = new URLSearchParams(location.search).get('jour');
const JOUR = parametre && /^\d{4}-\d{2}-\d{2}$/.test(parametre) ? jourDe(new Date(`${parametre}T12:00:00Z`)) : jourDe(new Date());

/* ---------------- La sauvegarde ---------------- */
const CLE = 'legendes.sauvegarde';
const DEPART = ['kael_r', 'mira_r', 'bram_r', 'lio_r', 'nami_r', 'tobi_r', 'suzu_r', 'fen_r', 'garde_n', 'forgeron_n'];
let S = null;
try { S = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { /* ignore */ }
if (!S || !S.gacha) {
  const g = nouvelEtat(Math.floor(Math.random() * 2 ** 31));
  for (const id of DEPART) g.collection[id] = { eveil: 0, n: 1 };
  S = { gacha: g, equipe: DEPART.slice(0, 6), histoire: {}, epreuves: {} };
}
S.fin ??= {};
S.tour ??= 0;
S.joueur ??= nouveauJoueur(Date.now());
S.gacha.medailles ??= {};
S.gacha.boite ??= [];
// Les anciennes sauvegardes : un personnage qui n'existe plus est retiré.
for (const id of Object.keys(S.gacha.collection)) if (!PERSO[id]) delete S.gacha.collection[id];
S.equipe = S.equipe.map((id) => (id && PERSO[id] && S.gacha.collection[id] ? id : null));
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch { /* ignore */ } };
const possede = (id) => !!S.gacha.collection[id];
const eveilDe2 = (id) => S.gacha.collection[id]?.eveil ?? 0;

/* ---------------- La navigation, la barre du haut ---------------- */
let ecran = 'accueil';
let finReactif = () => {};
function aller(nom) {
  if (nom === 'menu') { ouvrirMenu(); return; }
  finReactif();
  for (const s of document.querySelectorAll('.ecran')) s.classList.toggle('actif', s.id === `s-${nom}`);
  ecran = nom;
  for (const b of document.querySelectorAll('.nav button')) b.classList.toggle('oui', b.dataset.aller === nom);
  $('b-retour').style.visibility = nom === 'accueil' ? 'hidden' : 'visible';
  $('nav').classList.toggle('cache', nom === 'combat');
  majBarre();
}
function majBarre() {
  const j = S.joueur, maintenant = Date.now();
  endurance(j, maintenant);
  $('rang-n').textContent = j.rang;
  $('exp-barre').style.width = `${(j.exp / expPour(j.rang)) * 100}%`;
  $('exp-txt').textContent = `${fr(expPour(j.rang) - j.exp)} avant le rang ${j.rang + 1}`;
  $('act-barre').style.width = `${Math.min(100, (j.act / actMax(j.rang)) * 100)}%`;
  $('act-txt').textContent = `${j.act} / ${actMax(j.rang)}`;
  const t = prochainPoint(j, maintenant);
  $('act-prochain').textContent = t ? `+1 dans ${Math.floor(t / 60000)}:${String(Math.floor((t % 60000) / 1000)).padStart(2, '0')}` : 'Endurance pleine';
  $('jetons-n').textContent = fr(S.gacha.jetons);
}
setInterval(majBarre, 1000);
function bulle(texte) {
  const b = document.createElement('div');
  b.className = 'bulle';
  b.innerHTML = texte;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 3500);
}
function panneau(html) {
  $('fiche').innerHTML = `${html}<button class="fermer">Fermer</button>`;
  $('v-fiche').classList.remove('cache');
}
const jours = (n) => (n <= 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`);
const dateFin = (jour) => `${dateDe(jour).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} 23:59`;

/* ---------------- L'accueil ---------------- */
let diapo = 0, minuteurCarrousel = 0;
function rendreAccueil() {
  const f = fetesDu(JOUR)[0];
  const racine = document.documentElement.style;
  racine.setProperty('--fete1', f ? f.couleurs[0] : '#ffd23f');
  racine.setProperty('--fete2', f ? f.couleurs[1] : '#ff4dd8');
  $('b-fete').classList.toggle('cache', !f);
  // Le chef de l'équipe en grand (son illustration bouge avec le doigt).
  const chef = S.equipe.find(Boolean);
  $('vedette-accueil').innerHTML = chef ? illustration(PERSO[chef]) : '';
  finReactif();
  finReactif = rendreReactif($('vedette-accueil'));
  // Le carrousel : les portails ouverts et la fête.
  const ps = portails(JOUR).filter((p) => p.type !== 'permanent');
  const diapos = ps.map((p) => {
    const fete = p.fete && FETE[p.fete];
    const v = PERSO[p.vedettes[0] || 'kael_ssr'];
    return `<button class="diapo" data-portail="${p.id}" style="--a:${fete ? fete.couleurs[0] : '#ffd23f'};--b:${fete ? fete.couleurs[1] : v.couleurs.aura}">${portrait(v, { taille: 66, fond: false })}
      <span><b>${p.nom}</b><small>${p.nouveaux.length ? `Nouveau : ${PERSO[p.nouveaux[0]].nom} (${PERSO[p.nouveaux[0]].rarete})` : 'Le retour des légendes'} · jusqu’au ${dateFin(p.fin).slice(0, 5)}</small></span></button>`;
  });
  $('carrousel').innerHTML = diapos.join('');
  $('points-carrousel').innerHTML = diapos.map(() => '<i></i>').join('');
  clearInterval(minuteurCarrousel);
  const montrer = () => {
    const ds = $('carrousel').children, pts = $('points-carrousel').children;
    if (!ds.length) return;
    diapo = (diapo + 1) % ds.length;
    [...ds].forEach((d, k) => d.classList.toggle('vue', k === diapo));
    [...pts].forEach((d, k) => d.classList.toggle('vu', k === diapo));
  };
  diapo = -1;
  montrer();
  minuteurCarrousel = setInterval(montrer, 3500);
  // Les pastilles : les cadeaux qui attendent, les éveils possibles.
  const nC = S.gacha.boite.length;
  $('badge-cadeaux').classList.toggle('cache', !nC);
  $('badge-cadeaux').textContent = nC;
  const nE = Object.keys(S.gacha.collection).filter((id) => peutEveiller(S.gacha, id)).length;
  $('badge-eveils').classList.toggle('cache', !nE);
  $('badge-eveils').textContent = nE;
  majBarre();
}

function cadeauxDuJour() {
  const avant = S.gacha.boite.length;
  connexion(S.gacha, JOUR, { boite: true });
  for (const f of fetesDu(JOUR)) cadeauFete(S.gacha, f, { boite: true });
  if (S.gacha.boite.length > avant) { garder(); setTimeout(() => bulle('🎁 Des cadeaux t’attendent dans la boîte !'), 500); }
}

function ouvrirCadeaux() {
  const b = S.gacha.boite;
  panneau(`<h2 class="titre-ecran">🎁 Cadeaux</h2>${b.length ? b.map((c) => `<div class="cadeau"><span>${c.texte}</span><b>${c.jetons ? `+${c.jetons} 🪙` : ''}${Object.entries(c.medailles || {}).map(([k, n]) => ` +${n} ${MEDAILLES[k].glyphe}`).join('')}</b></div>`).join('') + '<button class="action" id="tout-recuperer">Tout récupérer</button>' : '<p class="consigne">La boîte est vide. Reviens demain !</p>'}`);
  $('tout-recuperer')?.addEventListener('click', () => {
    const t = recupererCadeaux(S.gacha);
    garder();
    son.victoire();
    bulle(`+${t.jetons} jetons${Object.entries(t.medailles).map(([k, n]) => ` · +${n} ${MEDAILLES[k].glyphe}`).join('')}`);
    $('v-fiche').classList.add('cache');
    rendreAccueil();
  });
}

function ouvrirInfos() {
  const ps = portails(JOUR);
  const aVenir = FETES.map((f) => {
    for (let d = 0; d < 400; d++) { const x = dansFete(f, JOUR + d); if (x) return { f, dans: d }; }
    return { f, dans: 999 };
  }).sort((a, b) => a.dans - b.dans);
  panneau(`<h2 class="titre-ecran">📅 Infos</h2>
    <div class="bloc"><b>Portails ouverts</b>${ps.map((p) => `<div class="cadeau"><span>${p.nom}</span><b>${p.fin !== undefined ? `fin ${jours(p.fin - JOUR)}` : 'toujours'}</b></div>`).join('')}</div>
    <div class="bloc"><b>Les fêtes</b>${aVenir.map(({ f, dans }) => `<div class="cadeau"><span>${f.glyphe} ${f.nom}</span><b>${dans === 0 ? 'en ce moment !' : jours(dans)}</b></div>`).join('')}</div>
    <div class="bloc">Un nouveau portail tous les 17 jours. Les vedettes rejoignent le portail permanent quand leur portail se termine.</div>`);
}

function ouvrirMenu() {
  panneau(`<h2 class="titre-ecran">☰ Menu</h2>
    <button class="tuile" data-m="collection"><b>📚 Collection</b><small>Tous tes personnages, leurs fiches</small></button>
    <button class="tuile" data-m="infos"><b>📅 Infos</b><small>Les portails, les fêtes à venir</small></button>
    <button class="tuile" data-m="son"><b>${son.estMuet() ? '🔇 Son coupé' : '🔊 Son'}</b><small>Toucher pour changer</small></button>
    <a class="tuile" href="/" style="text-decoration:none;color:inherit"><b>🕹️ Retour à l’arcade</b></a>`);
  $('fiche').querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.m;
    if (m === 'son') { son.basculer(); ouvrirMenu(); return; }
    $('v-fiche').classList.add('cache');
    if (m === 'collection') { rendreCollection(); aller('collection'); }
    if (m === 'infos') ouvrirInfos();
  }));
}

/* ---------------- Les portails ---------------- */
let portailChoisi = null;
const TYPES = {
  permanent: 'Portail permanent : tous les personnages de base, et les vedettes des portails passés.',
  garanti: 'À chaque multi-invocation, <b>un personnage de la bannière garanti</b> !',
  paliers: 'Portail à paliers : au <b>5e palier, le nouveau personnage garanti</b> !',
};
function rendrePortails() {
  const ps = portails(JOUR);
  if (!portailChoisi || !ps.some((p) => p.id === portailChoisi)) portailChoisi = (ps.find((p) => p.fete) || ps[1] || ps[0]).id;
  $('onglets-portails').innerHTML = ps.map((p) => `<button data-id="${p.id}" class="${p.id === portailChoisi ? 'oui' : ''}">${p.nom}</button>`).join('');
  const p = ps.find((x) => x.id === portailChoisi);
  const fete = p.fete && FETE[p.fete];
  const vedettes = (p.vedettes.length ? p.vedettes : ['kael_ssr', 'ryo_ssr', 'mira_ssr', 'hiro_ssr', 'sel_ssr']).slice(0, 5);
  const pal = palierDe(S.gacha, p);
  const prix = prixMulti(S.gacha, p);
  // La disposition des vedettes : la première au centre, en grand, les autres de part et d'autre.
  const places = [[50, 300], [18, 190], [82, 190], [6, 150], [94, 150]];
  const affiche = vedettes.map((id, k) => { const [x, t] = places[k]; return `<div class="v" style="left:${x}%;transform:translateX(-50%);z-index:${10 - k}">${portrait(PERSO[id], { taille: t, fond: false, anime: true })}</div>`; }).reverse().join('');
  $('portail').style.setProperty('--pc', fete ? fete.couleurs[1] : p.type === 'permanent' ? '#2b5a8a' : PERSO[vedettes[0]].couleurs.aura);
  $('portail').innerHTML = `<div class="eclair-fond"></div>
    <button class="detecteur-btn" id="b-detecteur">🔍 Détecteur</button>
    ${p.fin !== undefined ? `<div class="fin">Jusqu’au ${dateFin(p.fin)}</div>` : ''}
    <div class="badge-type ${p.type}">${p.type === 'permanent' ? 'Permanent' : p.type === 'garanti' ? 'Garanti' : 'Paliers'}</div>
    <div class="affiche">${affiche}</div>
    <div class="garantie">${TYPES[p.type]}${p.vedettes.length ? `<br><small>Une vedette garantie au plus tard dans <b>${PITIE - (S.gacha.pitie[p.id] || 0)}</b> invocations.</small>` : ''}</div>
    <div class="titre-portail">${(p.fete ? FETE[p.fete].nom : p.nom).toUpperCase()}</div>
    ${p.type === 'paliers' ? `<div class="paliers-ligne">${PALIERS.map((x, k) => `<span class="${k < pal ? 'fait' : k === pal ? 'ici' : ''}">${k + 1}<br>${x.prix} 🪙</span>`).join('')}</div>` : ''}
    <div class="boutons"><button id="b-simple" ${S.gacha.jetons < PRIX.simple ? 'disabled' : ''}>Invocation ×1<small>🪙 × ${PRIX.simple}</small></button><button id="b-multi" ${S.gacha.jetons < prix ? 'disabled' : ''}>Invocation ×10<small>🪙 × ${prix}</small></button></div>`;
  $('b-simple').onclick = () => tirer(p, 1);
  $('b-multi').onclick = () => tirer(p, 10);
  $('b-detecteur').onclick = () => detecteur(p);
}

/** Le détecteur : les taux de chaque rareté, de chaque vedette, la pitié, les paliers. */
function detecteur(p) {
  const pool = p.pool;
  const nb = (r) => pool.filter((id) => PERSO[id].rarete === r && !p.vedettes.includes(id)).length;
  const taux = { LR: TAUX.LR, SSR: TAUX.SSR, SR: TAUX.SR, R: 1 - TAUX.LR - TAUX.SSR - TAUX.SR };
  const partVedette = p.vedettes.length ? (TAUX.LR + TAUX.SSR) * 0.5 : 0;
  panneau(`<div class="detecteur"><h2>🔍 Détecteur · ${p.nom}</h2>
    <table>${Object.entries(taux).map(([r, t]) => `<tr><td>${r}</td><td>${(t * 100).toFixed(1)} %</td></tr>`).join('')}</table>
    ${p.vedettes.length ? `<div class="bloc"><b>Les vedettes</b> (la moitié des SSR et LR) : ${(partVedette * 100).toFixed(1)} % en tout
      ${p.vedettes.map((id) => `<div class="ligne-v">${portrait(PERSO[id], { cadre: true, taille: 44, nom: false })}<span>${PERSO[id].nom} · ${PERSO[id].titre}<br><small>${((partVedette / p.vedettes.length) * 100).toFixed(2)} %${p.nouveaux.includes(id) ? ' · nouveau' : ''}</small></span></div>`).join('')}</div>` : ''}
    <div class="bloc"><b>Garanties</b><br>Un SSR ou mieux à chaque multi-invocation.<br>${TYPES[p.type]}${p.vedettes.length ? `<br>Pitié : une vedette garantie au bout de ${PITIE} invocations sans vedette (déjà ${S.gacha.pitie[p.id] || 0}).` : ''}</div>
    <div class="bloc"><b>Dans ce portail</b> : ${nb('SSR')} SSR, ${nb('SR')} SR, ${nb('R')} R, ${nb('LR')} LR de base, et ${p.vedettes.length} vedette${p.vedettes.length > 1 ? 's' : ''}.</div></div>`);
}

async function tirer(p, n) {
  son.reveiller();
  const r = invoquer(S.gacha, p, n);
  if (!r.ok) { bulle('Pas assez de jetons : fais les quêtes et récupère tes cadeaux.'); return; }
  garder();
  majBarre();
  await invocation($('scene'), r.resultats, r.garanties);
  rendrePortails();
}

/* ---------------- La collection, la fiche ---------------- */
let filtre = 'tous';
function rendreCollection() {
  $('filtres').innerHTML = ['tous', 'LR', 'UR', 'SSR', 'SR', 'R', 'N'].map((f) => `<button data-f="${f}" class="${filtre === f ? 'oui' : ''}">${f === 'tous' ? 'Tous' : f}</button>`).join('');
  const sortis = new Set(portails(JOUR).flatMap((p) => p.pool));
  const liste = PERSOS.filter((x) => (possede(x.id) || sortis.has(x.id)) && (filtre === 'tous' || x.rarete === filtre))
    .sort((a, b) => ORDRE.indexOf(b.rarete) - ORDRE.indexOf(a.rarete) || (possede(b.id) - possede(a.id)));
  $('grille-collection').innerHTML = liste.map((x) => portrait(x, { cadre: true, taille: 100, data: true, eveil: possede(x.id) ? eveilDe2(x.id) : undefined, classe: possede(x.id) ? '' : 'non' })).join('');
}

function ouvrirFiche(id) {
  const x = PERSO[id], el = ELEMENTS[x.element], ev = eveilDe2(id), s = stats(id, ev);
  const e = eveilDe(id);
  panneau(`<div class="fiche-art">${illustration(x)}</div>
    <div class="fiche-haut"><div><h2>${x.nom}</h2><small>${x.titre}</small><br><small>${x.rarete} · ${el.glyphe} ${el.nom} · ${ROLES[x.role]}</small>
      <div class="categories">${x.categories.map((f) => `<span>${CATEGORIES[f]}</span>`).join('')}</div></div></div>
    <div class="stats"><div><b>${fr(s.pv)}</b>PV</div><div><b>${fr(s.atq)}</b>ATQ</div><div><b>${fr(s.def)}</b>DÉF</div></div>
    <div class="bloc"><b>👑 Chef :</b> ${texteChef(x.chef, CATEGORIES)}</div>
    <div class="bloc"><b>💥 Super attaque · ${x.super.nom} :</b> ${x.super.texte}${x.super.ultime ? `<br><b>🌟 Ultime (${KI_ULTIME} de ki) · ${x.super.ultime.nom} :</b> ${x.super.ultime.texte}` : ''}</div>
    <div class="bloc"><b>✨ Passif · ${x.passif.nom}</b><ul class="fiche-lignes">${x.passif.lignes.map((l) => `<li>${l}</li>`).join('')}</ul></div>
    <div class="bloc"><b>🔗 Liens :</b> ${x.liens.map((l) => `${LIENS[l].nom} (${LIENS[l].texte})`).join(' · ')}</div>
    <div class="bloc"><b>⭐ Doublons :</b> ${possede(id) ? `${'★'.repeat(ev)}${'☆'.repeat(RARETES[x.rarete].eveilMax - ev)} (chaque doublon : +8 %)` : 'Pas encore dans ta collection.'}</div>
    ${e ? `<div class="bloc"><b>🏅 Éveil :</b> devient ${PERSO[e.vers].nom} ${PERSO[e.vers].rarete} (${PERSO[e.vers].titre}) contre ${coutTexte(e.cout)}</div>` : ''}
    ${x.fete ? `<div class="bloc"><b>Personnage de fête :</b> ${FETE[x.fete].glyphe} ${FETE[x.fete].nom} seulement.</div>` : ''}`);
  finReactif();
  finReactif = rendreReactif($('fiche'));
}
const coutTexte = (cout) => Object.entries(cout).map(([k, n]) => `${n} ${MEDAILLES[k].glyphe}`).join(' + ');

/* ---------------- Les éveils ---------------- */
function rendreEveils() {
  const m = S.gacha.medailles;
  $('medailles').innerHTML = Object.entries(MEDAILLES).map(([k, x]) => `<span title="${x.nom}">${x.glyphe} ${m[k] || 0}</span>`).join('');
  // D'abord les chaînes où l'on a quelqu'un, puis les autres.
  const chaines = [...CHAINES].sort((a, b) => b.some(possede) - a.some(possede));
  $('liste-eveils').innerHTML = chaines.map((ch) => `<div class="rangee">${ch.map((id, k) => {
    const x = PERSO[id], e = eveilDe(id);
    const carte = `<div class="etape-eveil${possede(id) ? ' ici' : ''}">${portrait(x, { cadre: true, taille: 58, nom: false, classe: possede(id) ? '' : 'non', data: true })}</div>`;
    if (k === ch.length - 1 || !e) return carte;
    const ok = peutEveiller(S.gacha, id);
    return `${carte}<div class="fleche${possede(id) ? '' : ' non'}"><b>➜</b>${coutTexte(e.cout)}${ok ? `<button data-eveil="${id}">Éveiller</button>` : ''}</div>`;
  }).join('')}</div>`).join('');
}

async function faireEveil(id) {
  const vers = eveiller(S.gacha, id);
  if (!vers) return;
  S.equipe = S.equipe.map((x) => (x === id ? vers : x));
  garder();
  son.eclat(PERSO[vers].rarete === 'LR' ? 'LR' : 'SSR');
  await invocation($('scene'), [{ id: vers, rarete: PERSO[vers].rarete, nouveau: true, vedette: true, eveil: eveilDe2(vers) }], [`${PERSO[id].nom} s’éveille : ${PERSO[vers].rarete} !`]);
  rendreEveils();
}

/* ---------------- L'équipe ---------------- */
let place = 0;
function rendreEquipe() {
  $('places').innerHTML = [0, 1, 2, 3, 4, 5].map((k) => `<button class="place${k === place ? ' choisie' : ''}" data-k="${k}">${S.equipe[k] ? portrait(PERSO[S.equipe[k]], { cadre: true, taille: 80, nom: false, eveil: eveilDe2(S.equipe[k]) }) : '+'}</button>`).join('');
  const chef = PERSO[S.equipe[0]];
  $('chef-info').innerHTML = chef ? `👑 Chef : <b>${chef.nom}</b> · ${texteChef(chef.chef, CATEGORIES)}` : 'Mets un personnage à la première place : c’est ton chef.';
  const liste = PERSOS.filter((x) => possede(x.id)).sort((a, b) => ORDRE.indexOf(b.rarete) - ORDRE.indexOf(a.rarete));
  $('grille-equipe').innerHTML = liste.map((x) => portrait(x, { cadre: true, taille: 100, data: true, eveil: eveilDe2(x.id) })).join('');
}

/* ---------------- Les quêtes : l'histoire, les épreuves, le jeu de fin ---------------- */
let difficulte = 0;
const cleHistoire = (ch, d) => (d ? `${ch}:${d}` : ch);
const faitesDe = (ch, d) => S.histoire[cleHistoire(ch, d)] || 0;
const difficulteOuverte = (d) => d === 0 || CHAPITRES.every((c) => faitesDe(c.id, d - 1) >= c.etapes.length);
function rendreQuetes() {
  const faites = CHAPITRES.reduce((t, c) => t + faitesDe(c.id, 0), 0);
  $('info-histoire').textContent = `${faites} / ${CHAPITRES.length * 5} étapes · Normal, Difficile, Extrême`;
  const f = fetesDu(JOUR)[0], ep = f && EPREUVES[f.id];
  $('b-epreuve').classList.toggle('cache', !ep);
  if (ep) {
    $('epreuve-titre').textContent = `${f.glyphe} ${ep.nom}`;
    $('epreuve-info').textContent = S.epreuves[`${f.id}-${f.annee}`] ? 'Réussie ! (on peut la refaire, sans jetons)' : `L’épreuve de la fête : ${ep.jetons} jetons à gagner · ${coutAct(true, 0)} d’endurance`;
  }
}
function rendreHistoire() {
  const D = DIFFICULTES[difficulte];
  let ouvert = true;
  $('chapitres').innerHTML = `<div class="difficultes">${DIFFICULTES.map((x, i) => `<button data-d="${i}" class="${i === difficulte ? 'oui' : ''}" ${difficulteOuverte(i) ? '' : 'disabled'}>${x.nom}</button>`).join('')}</div>` + CHAPITRES.map((c) => {
    const faites = faitesDe(c.id, difficulte);
    const html = `<div class="chapitre"><h3>${c.nom}</h3>${c.etapes.map((e, k) => `<button class="etape${k < faites ? ' faite' : ''}${k === 4 ? ' boss' : ''}" data-ch="${c.id}" data-k="${k}" ${ouvert && k <= faites ? '' : 'disabled'}>
      <b>${k + 1}. ${e.nom}</b><small>⚡${coutAct(k === 4, difficulte)} · ${k < faites ? 'Rejouer' : `+${e.jetons * D.jetons} 🪙`}</small></button>`).join('')}</div>`;
    ouvert = ouvert && faites >= c.etapes.length;
    return html;
  }).join('');
}
function rendreFinJeu() {
  const equipe = S.equipe.filter(Boolean);
  const html = ['<p class="consigne">Des combats bien plus durs que l’histoire : il faut des LR et des UR éveillés, et une équipe montée autour d’une catégorie.</p>'];
  for (const d of DEFIS) {
    const ok = equipe.length >= 3 && equipe.every((id) => PERSO[id].categories.includes(d.categorie));
    html.push(`<button class="carte-defi" data-defi="${d.id}" ${ok ? '' : 'disabled'}><b>${d.nom}</b><small>${S.fin[d.id] ? '✓ Réussi · ' : `+${d.jetons} 🪙 · `}⚡${coutAct(true, 0, true)} · catégorie « ${CATEGORIES[d.categorie]} » seulement · ${d.ennemis.length} boss${ok ? '' : ' · ton équipe ne convient pas'}</small></button>`);
  }
  html.push(`<button class="carte-defi ultime" data-defi="ultime"><b>${ULTIME.nom}</b><small>${S.fin.ultime ? '✓ Vaincu · ' : `+${ULTIME.jetons} 🪙 · `}⚡${coutAct(true, 0, true)} · ${fr(ULTIME.ennemis[0].pv)} PV, trois formes</small></button>`);
  const n = (S.tour || 0) + 1;
  html.push(`<button class="carte-defi tour" data-defi="tour"><b>🗼 Tour infinie · étage ${n}</b><small>Record : étage ${S.tour || 0} · un boss tous les cinq étages · ⚡5 · +${etage(n).jetons} 🪙</small></button>`);
  $('fin-jeu').innerHTML = html.join('');
}

/* ---------------- L'allié ---------------- */
const PSEUDOS = ['Kaito_92', 'LunaÉclair', 'Ryoku', 'ZéphyrX', 'MaîtreDuKi', 'Nova', 'Shiro', 'Akane'];
function amisDuJour() {
  let g = (JOUR * 2654435761) >>> 0;
  const R = () => { g = (Math.imul(g ^ (g >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return g / 4294967296; };
  const sortis = [...new Set(portails(JOUR).flatMap((p) => p.pool))].filter((id) => ['SSR', 'LR'].includes(PERSO[id].rarete));
  const lr = sortis.filter((id) => PERSO[id].rarete === 'LR');
  const pris = new Set();
  return PSEUDOS.slice(0, 6).map((nom, k) => {
    let liste = (k < 3 && lr.length ? lr : sortis).filter((id) => !pris.has(id));
    if (!liste.length) liste = sortis.filter((id) => !pris.has(id));
    if (!liste.length) liste = sortis;
    const id = liste[Math.floor(R() * liste.length)];
    pris.add(id);
    return { nom, id, eveil: Math.floor(R() * (RARETES[PERSO[id].rarete].eveilMax + 1)), rang: 20 + Math.floor(R() * 480) };
  });
}
const couverture = (chefId) => S.equipe.filter(Boolean).filter((id) => PERSO[id].categories.some((k) => PERSO[chefId].chef.cats.includes(k))).length;

/* ---------------- Le combat ---------------- */
let C = null, occupe = false, P = null, chemin = [];

/** Lance un combat : l'endurance, puis le choix de l'allié (sauf pour « Réessayer », qui le garde). o : { ennemis, recompense, premiere, fini, retour, act, d, fin } */
function lancerCombat(o) {
  if (!S.equipe.some(Boolean)) { bulle('Ton équipe est vide : va dans Équipe.'); return; }
  if (o.ami) { demarrerCombat(o); return; }
  const amis = [{ nom: 'Ton propre chef', id: S.equipe.find(Boolean), eveil: eveilDe2(S.equipe.find(Boolean)), rang: '—', toi: true }, ...amisDuJour()];
  const n = S.equipe.filter(Boolean).length;
  $('liste-amis').innerHTML = amis.map((a, k) => {
    const x = PERSO[a.id], cov = couverture(a.id);
    return `<button class="ami${cov === n ? ' ideal' : ''}" data-k="${k}">${portrait(x, { cadre: true, taille: 74, nom: false, eveil: a.eveil })}
      <span><b>${a.nom}</b>${a.toi ? '' : `<small>Rang ${a.rang}</small>`}<em>${x.nom} · ${x.titre}</em><small>${texteChef(x.chef, CATEGORIES)}</small>
      <small class="couv">${cov === n ? '★ Toute ton équipe en profite' : `${cov} / ${n} de ton équipe dans sa catégorie`}</small></span></button>`;
  }).join('');
  $('liste-amis').onclick = (e) => {
    const b = e.target.closest('.ami');
    if (!b) return;
    son.bip();
    demarrerCombat({ ...o, ami: amis[+b.dataset.k].id });
  };
  aller('ami');
}

function demarrerCombat(o) {
  if (!o.paye) {
    if (!depenser(S.joueur, o.act || 0, Date.now())) { bulle(`Pas assez d’endurance (il en faut ${o.act}). Elle remonte toute seule, et d’un coup à chaque rang.`); return; }
    o.paye = true;
    garder();
  }
  const equipe = S.equipe.filter(Boolean).map((id) => ({ id, eveil: eveilDe2(id) }));
  C = { o, c: creerCombat({ equipe, ennemis: o.ennemis, graine: Math.floor(Math.random() * 2 ** 31), ami: o.ami }), ennemiPv: o.ennemis.map((e) => e.pv), pv: 0, cible: 0 };
  C.pv = C.c.pv;
  aller('combat');
  P?.detruire();
  P = creerParticules($('arene'));
  rendreEnnemi();
  rendreCombat();
}

function rendreEnnemi() {
  const e = C.c.ennemis[C.cible];
  if (!e) return;
  $('ennemi-mini').innerHTML = ennemi(e, 46);
  $('ennemi-nom').textContent = `${ELEMENTS[e.element].glyphe} ${e.nom}${e.boss ? ' · BOSS' : ''}`;
  $('ennemi-info').textContent = [C.c.ennemis.length > 1 ? `Ennemi ${C.cible + 1}/${C.c.ennemis.length}` : '', e.super ? `Super : ${e.super.nom}` : '', e.phases?.length > e.phase ? `${e.phases.length - e.phase} transformation(s) à venir` : ''].filter(Boolean).join(' · ');
  $('monstre').className = 'monstre';
  $('monstre').innerHTML = ennemi(e, 220);
  majPv();
}
function majPv() {
  const e = C.c.ennemis[C.cible];
  if (e) { const v = Math.max(0, C.ennemiPv[C.cible]); $('ennemi-pv').style.width = `${(v / e.pvMax) * 100}%`; $('ennemi-pv-txt').textContent = fr(v); }
  $('equipe-pv').style.width = `${(Math.max(0, C.pv) / C.c.pvMax) * 100}%`;
  $('equipe-pv-txt').textContent = `PV ${fr(Math.max(0, C.pv))} / ${fr(C.c.pvMax)}`;
  $('tour-n').textContent = `TOUR ${C.c.tour + 1}`;
}

/** La place d'une sphère sur le plateau (en %), décalée une ligne sur deux. */
const placeSphere = (p) => { const col = p % COLS, lig = Math.floor(p / COLS); return { x: 11 + col * 19.5 + (lig % 2 ? 4 : -4), y: 8 + lig * 21 }; };

function montrerHeros(id) {
  const x = PERSO[id];
  $('heros').style.setProperty('--aura', x.couleurs.aura);
  $('heros').innerHTML = portrait(x, { taille: 300, fond: false, anime: true });
}

function rendreCombat() {
  const c = C.c, rot = rotation(c), li = liens(c);
  montrerHeros(c.membres[rot[0]].id);
  $('trio').innerHTML = rot.map((i, k) => {
    const m = c.membres[i], x = PERSO[m.id];
    return `<div class="combattant" data-i="${i}" style="--el:${ELEMENTS[x.element].couleur};--rar:${RARETES[x.rarete].couleur}"><span class="rar-mini">${x.rarete}</span><div class="rond-perso">${portrait(x, { taille: 140, fond: false })}</div>
      <div class="ki${m.ki >= KI_SUPER ? ' plein' : ''}"><i style="width:${(m.ki / KI_MAX) * 100}%"></i></div><div class="ki-txt">Ki ${m.ki}${li[k] ? ` · 🔗${li[k]}` : ''}</div></div>`;
  }).join('');
  const pl = $('plateau');
  pl.querySelectorAll('.sphere-p').forEach((s) => s.remove());
  c.spheres.forEach((s, p) => {
    const { x, y } = placeSphere(p);
    pl.insertAdjacentHTML('beforeend', `<button class="sphere-p${s === 'arc' ? ' arc' : ''}" data-p="${p}" style="left:${x}%;top:${y}%;--c:${s === 'arc' ? '#fff' : ELEMENTS[s].couleur};animation-delay:${(p % 7) * 0.03}s" aria-label="${s === 'arc' ? 'Arc-en-ciel' : ELEMENTS[s].nom}"></button>`);
  });
  chemin = [];
  dessinerChemin();
  majPv();
}

function dessinerChemin() {
  const pl = $('plateau'), r = pl.getBoundingClientRect();
  $('trace-ligne').setAttribute('points', chemin.map((p) => { const { x, y } = placeSphere(p); return `${(x / 100) * r.width},${(y / 100) * r.height}`; }).join(' '));
  pl.querySelectorAll('.sphere-p').forEach((s) => s.classList.toggle('prise', chemin.includes(+s.dataset.p)));
  apercu();
}

/** Montre le ki que chacun gagnerait avec le chemin tracé. */
function apercu() {
  const g = chemin.length ? kiPour(C.c, chemin) : null;
  [...document.querySelectorAll('.combattant')].forEach((el, k) => {
    const m = C.c.membres[+el.dataset.i];
    const ki = Math.min(KI_MAX, m.ki + (g ? g[k] : 0));
    el.querySelector('.ki i').style.width = `${(ki / KI_MAX) * 100}%`;
    el.querySelector('.ki').classList.toggle('plein', ki >= KI_SUPER);
    el.querySelector('.ki-txt').textContent = g ? `Ki ${ki}${ki >= KI_ULTIME && PERSO[m.id].rarete === 'LR' ? ' · ULTIME' : ki >= KI_SUPER ? ' · SUPER' : ''}` : `Ki ${m.ki}`;
  });
}

function nombre(texte, x, y, o = {}) {
  const n = document.createElement('div');
  n.className = `nombre${o.gros ? ' gros' : ''}${o.avantage ? ' avantage' : ''}`;
  n.style.left = `${x}%`;
  n.style.top = `${y}%`;
  if (o.couleur) n.style.setProperty('--c', o.couleur);
  n.textContent = texte;
  $('nombres').appendChild(n);
  setTimeout(() => n.remove(), 1200);
}
function etiquette(texte, x, y, couleur) {
  const n = document.createElement('div');
  n.className = 'etiquette';
  n.style.left = `${x}%`;
  n.style.top = `${y}%`;
  n.style.transform = 'translateX(-50%)';
  n.style.setProperty('--c', couleur);
  n.textContent = texte;
  $('nombres').appendChild(n);
  setTimeout(() => n.remove(), 1100);
}

async function jouer() {
  if (occupe || !C || C.c.fin || !chemin.length) return;
  occupe = true;
  son.reveiller();
  const pris = [...chemin];
  pris.forEach((p, k) => { const s = $('plateau').querySelector(`.sphere-p[data-p="${p}"]`); if (s) { s.style.animationDelay = `${k * 0.04}s`; s.classList.add('part'); } });
  for (let k = 0; k < pris.length; k++) setTimeout(() => son.sphere(), k * 45);
  chemin = [];
  $('trace-ligne').setAttribute('points', '');
  await attendre(420 + pris.length * 30);
  const evs = jouerTour(C.c, pris);
  const toucher = () => { $('monstre').classList.remove('touche'); void $('monstre').offsetWidth; $('monstre').classList.add('touche'); };
  const sur = (i) => document.querySelector(`.combattant[data-i="${i}"]`);
  const auDessus = (el, texte, couleur) => {
    if (!el) return;
    const r = el.getBoundingClientRect(), a = $('arene').getBoundingClientRect();
    etiquette(texte, ((r.left + r.width / 2 - a.left) / a.width) * 100, 90, couleur);
  };
  for (const ev of evs) {
    if (!C) return;
    const e = C.c.ennemis[C.cible];
    if (ev.type === 'debut') {
      C.pv = Math.min(C.c.pvMax, C.pv + ev.soin);
      etiquette(`+${fr(ev.soin)} PV`, 50, 80, '#36d39a');
      majPv();
      await attendre(380);
    } else if (ev.type === 'attaque' || ev.type === 'super' || ev.type === 'ultime') {
      const el = sur(ev.qui);
      montrerHeros(ev.id);
      if (ev.add) { auDessus(el, ev.type === 'attaque' ? 'Attaque add. !' : 'Super add. !', '#ffd23f'); await attendre(220); }
      if (ev.type !== 'attaque') await superAttaque($('scene'), ev.id, { ultime: ev.type === 'ultime', ennemi: e, degats: ev.degats, crit: ev.crit });
      el?.classList.add('frappe');
      $('heros').classList.remove('frappe'); void $('heros').offsetWidth; $('heros').classList.add('frappe');
      son.coup();
      toucher();
      if (P) { const r = $('monstre').getBoundingClientRect(), a = $('arene').getBoundingClientRect(); P.gerbe(r.left - a.left + r.width / 2, r.top - a.top + r.height / 2, ELEMENTS[PERSO[ev.id].element].couleur, ev.type === 'attaque' ? 18 : 40, 500); }
      if (ev.crit) { await arret(60); secouer($('arene'), 8, 220); }
      C.ennemiPv[ev.cible] -= ev.degats;
      nombre(`${ev.crit ? '💥 ' : ''}${fr(ev.degats)}`, 70 + Math.random() * 10, 18 + Math.random() * 15, { gros: ev.type !== 'attaque' || ev.crit, avantage: ev.avantage > 1, couleur: ELEMENTS[PERSO[ev.id].element].couleur });
      majPv();
      await attendre(ev.type === 'attaque' ? 360 : 420);
      el?.classList.remove('frappe');
    } else if (ev.type === 'esquiveEnnemi') {
      etiquette('Esquivé !', 72, 30, '#ff8a8a');
      await attendre(330);
    } else if (ev.type === 'transformation') {
      C.ennemiPv[ev.cible] = ev.pv;
      await transformation($('scene'), C.c.ennemis[ev.cible], ev.nom, ev.texte);
      rendreEnnemi();
    } else if (ev.type === 'superEnnemi') {
      await superEnnemi($('scene'), e, ev.nom, ev.tous);
    } else if (ev.type === 'esquive') {
      const el = sur(ev.cible);
      auDessus(el, 'ESQUIVE !', '#36d39a');
      son.lame();
      await attendre(330);
    } else if (ev.type === 'contre') {
      const el = sur(ev.qui);
      auDessus(el, 'CONTRE !', '#ffd23f');
      montrerHeros(ev.id);
      $('heros').classList.remove('frappe'); void $('heros').offsetWidth; $('heros').classList.add('frappe');
      son.coup();
      toucher();
      C.ennemiPv[ev.cible] -= ev.degats;
      nombre(fr(ev.degats), 75, 28, { gros: true, couleur: '#ffd23f' });
      majPv();
      await attendre(400);
    } else if (ev.type === 'ko') {
      $('monstre').classList.add('ko');
      son.impact(true);
      if (P) P.gerbe(P.largeur * 0.75, P.hauteur * 0.25, '#ffd23f', 80, 900);
      await attendre(800);
      C.cible = ev.cible + 1;
      if (C.cible < C.c.ennemis.length) rendreEnnemi();
    } else if (ev.type === 'riposte') {
      const el = sur(ev.cible);
      el?.classList.remove('blesse'); void el?.offsetWidth; el?.classList.add('blesse');
      son.blesse();
      if (ev.garde) auDessus(el, 'GARDE', '#6ab8ff');
      if (ev.fort) secouer($('arene'), 10, 300);
      C.pv -= ev.degats;
      if (el) { const r = el.getBoundingClientRect(), a = $('arene').getBoundingClientRect(); nombre(`-${fr(ev.degats)}`, ((r.left + r.width / 2 - a.left) / a.width) * 100, 82, { couleur: '#ff2a3a' }); }
      majPv();
      await attendre(ev.fort ? 480 : 330);
    } else if (ev.type === 'victoire') {
      await attendre(300);
      await victoire();
      return;
    } else if (ev.type === 'defaite') {
      const o = C.o;
      C = null;
      occupe = false;
      const v = await finCombat($('scene'), { victoire: false, texte: 'Ton équipe est à terre. Change d’équipe ou d’allié, ou retente ta chance.' });
      if (v === 'rejouer') lancerCombat({ ...o, paye: false }); else o.retour();
      return;
    }
  }
  rendreCombat();
  occupe = false;
}

/** La victoire : les jetons (la première fois), le butin (médailles, EXP, parfois un personnage), les rangs gagnés. */
async function victoire() {
  const o = C.o;
  const gagne = o.premiere ? o.recompense : 0;
  if (gagne) S.gacha.jetons += gagne;
  const b = butin(o.ennemis, o.d || 0, Math.random, { fin: !!o.fin });
  ajouterMedailles(S.gacha, b.medailles);
  const rangs = gagnerExp(S.joueur, b.exp);
  if (rangs) S.gacha.jetons += 5 * rangs;
  let perso = '';
  if (b.perso) {
    const c = S.gacha.collection[b.perso];
    if (c) { c.n += 1; c.eveil = Math.min(RARETES[PERSO[b.perso].rarete].eveilMax, c.eveil + 1); } else S.gacha.collection[b.perso] = { eveil: 0, n: 1 };
    perso = `<br>🎁 ${PERSO[b.perso].nom} (${PERSO[b.perso].rarete}) rejoint ta collection !`;
  }
  o.fini?.();
  garder();
  C = null;
  occupe = false;
  const med = Object.entries(b.medailles).map(([k, n]) => `${MEDAILLES[k].glyphe}×${n}`).join(' ');
  await finCombat($('scene'), { victoire: true, texte: `${gagne ? `+${gagne} jetons 🪙<br>` : ''}+${b.exp} EXP · ${med}${perso}${rangs ? `<br>⬆️ Rang ${S.joueur.rang} ! Endurance remplie, +${5 * rangs} jetons` : ''}` });
  o.retour();
}

/* ---------------- Le branchement ---------------- */
function brancher() {
  $('b-retour').onclick = () => {
    if (ecran === 'combat') { if (occupe) return; if (!confirm('Abandonner le combat ? (l’endurance est perdue)')) return; C = null; }
    rendreAccueil();
    aller('accueil');
  };
  $('nav').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    son.reveiller();
    son.bip();
    const n = b.dataset.aller;
    if (n === 'accueil') rendreAccueil();
    if (n === 'equipe') rendreEquipe();
    if (n === 'portails') rendrePortails();
    if (n === 'eveils') rendreEveils();
    aller(n);
  };
  $('b-quete').onclick = () => { son.reveiller(); son.bip(); rendreQuetes(); aller('quetes'); };
  $('b-eveils2').onclick = () => { rendreEveils(); aller('eveils'); };
  $('b-finjeu').onclick = $('b-finjeu2').onclick = () => { rendreFinJeu(); aller('finjeu'); };
  $('b-fete').onclick = () => { rendreQuetes(); aller('quetes'); };
  $('b-infos').onclick = ouvrirInfos;
  $('b-cadeaux').onclick = ouvrirCadeaux;
  $('b-collection').onclick = () => { rendreCollection(); aller('collection'); };
  $('b-histoire').onclick = () => { rendreHistoire(); aller('histoire'); };
  $('carrousel').onclick = (e) => { const b = e.target.closest('.diapo'); if (b) { portailChoisi = b.dataset.portail; rendrePortails(); aller('portails'); } };
  $('b-epreuve').onclick = () => {
    const f = fetesDu(JOUR)[0], ep = f && EPREUVES[f.id];
    if (!ep) return;
    const cle = `${f.id}-${f.annee}`;
    lancerCombat({ ennemis: ep.ennemis, recompense: ep.jetons, premiere: !S.epreuves[cle], act: coutAct(true, 0), d: 1, fini: () => { S.epreuves[cle] = true; }, retour: () => { rendreQuetes(); aller('quetes'); } });
  };
  $('onglets-portails').onclick = (e) => { const b = e.target.closest('button'); if (b) { portailChoisi = b.dataset.id; son.bip(); rendrePortails(); } };
  $('filtres').onclick = (e) => { const b = e.target.closest('button'); if (b) { filtre = b.dataset.f; rendreCollection(); } };
  $('grille-collection').onclick = (e) => { const c = e.target.closest('.carte'); if (c) ouvrirFiche(c.dataset.id); };
  $('liste-eveils').onclick = (e) => {
    const b = e.target.closest('[data-eveil]');
    if (b) { faireEveil(b.dataset.eveil); return; }
    const c = e.target.closest('.carte');
    if (c) ouvrirFiche(c.dataset.id);
  };
  $('v-fiche').onclick = (e) => { if (e.target === $('v-fiche') || e.target.closest('.fermer')) { $('v-fiche').classList.add('cache'); finReactif(); if (ecran === 'accueil') rendreAccueil(); } };
  $('places').onclick = (e) => { const b = e.target.closest('.place'); if (b) { place = +b.dataset.k; son.bip(); rendreEquipe(); } };
  $('grille-equipe').onclick = (e) => {
    const c = e.target.closest('.carte');
    if (!c) return;
    const id = c.dataset.id, ici = S.equipe.indexOf(id);
    if (ici >= 0) S.equipe[ici] = S.equipe[place];
    S.equipe[place] = id;
    S.equipe = S.equipe.map((x) => x || null);
    place = Math.min(5, place + 1);
    garder();
    son.bip();
    rendreEquipe();
  };
  $('fin-jeu').onclick = (e) => {
    const b = e.target.closest('.carte-defi');
    if (!b || b.disabled) return;
    const id = b.dataset.defi, retour = () => { rendreFinJeu(); aller('finjeu'); };
    if (id === 'tour') { const n = (S.tour || 0) + 1, et = etage(n); lancerCombat({ ennemis: et.ennemis, recompense: et.jetons, premiere: true, act: 5, d: 1, fini: () => { S.tour = Math.max(S.tour || 0, n); }, retour }); return; }
    const d = id === 'ultime' ? ULTIME : DEFIS.find((x) => x.id === id);
    lancerCombat({ ennemis: d.ennemis.map((x) => ({ ...x, phases: x.phases?.map((p) => ({ ...p })) })), recompense: d.jetons, premiere: !S.fin[d.id], act: coutAct(true, 0, true), d: 2, fin: true, fini: () => { S.fin[d.id] = true; }, retour });
  };
  $('chapitres').onclick = (e) => {
    const t = e.target.closest('.difficultes button');
    if (t && !t.disabled) { difficulte = +t.dataset.d; son.bip(); rendreHistoire(); return; }
    const b = e.target.closest('.etape');
    if (!b || b.disabled) return;
    const ch = CHAPITRES.find((c) => c.id === b.dataset.ch), k = +b.dataset.k, et = ch.etapes[k];
    const d = difficulte, D = DIFFICULTES[d], faites = faitesDe(ch.id, d);
    lancerCombat({ ennemis: ennemisEn(et.ennemis, D), recompense: et.jetons * D.jetons, premiere: k >= faites, act: coutAct(k === 4, d), d, fini: () => { if (k >= faites) S.histoire[cleHistoire(ch.id, d)] = k + 1; }, retour: () => { rendreHistoire(); aller('histoire'); } });
  };
  // Le plateau : on trace un chemin du doigt (de voisine en voisine), on relâche pour jouer.
  const pl = $('plateau');
  const sous = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.sphere-p');
  pl.addEventListener('pointerdown', (e) => {
    if (occupe || !C) return;
    const s = sous(e);
    if (!s) return;
    pl.setPointerCapture(e.pointerId);
    chemin = [+s.dataset.p];
    son.bip();
    dessinerChemin();
  });
  pl.addEventListener('pointermove', (e) => {
    if (!chemin.length || occupe) return;
    const s = sous(e);
    if (!s) return;
    const p = +s.dataset.p, der = chemin[chemin.length - 1];
    if (p === der) return;
    if (chemin.length > 1 && p === chemin[chemin.length - 2]) { chemin.pop(); dessinerChemin(); return; }
    if (!chemin.includes(p) && voisines(der, p)) { chemin.push(p); son.sphere(); dessinerChemin(); }
  });
  pl.addEventListener('pointerup', () => { if (chemin.length) jouer(); });
  pl.addEventListener('pointercancel', () => { chemin = []; dessinerChemin(); });
}

brancher();
cadeauxDuJour();
rendreAccueil();
aller('accueil');

// Pour les essais : window.legendes
window.legendes = { S, JOUR, garder, lancerCombat, demarrerCombat, portails: () => portails(JOUR), jouerChemin: (ch) => { chemin = ch; return jouer(); } };
