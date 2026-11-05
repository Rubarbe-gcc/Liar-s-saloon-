/**
 * LÉGENDES — le gacha de l'arcade : l'accueil (la fête du moment, la connexion du jour), les portails
 * (permanent, en rotation, des fêtes), la collection, l'équipe, l'histoire, les épreuves des fêtes et les
 * combats (les sphères de ki, les super attaques).
 *
 * Les moteurs sont partagés et testés (shared/legendes/) ; ici, l'affichage. Tout est gardé sur l'appareil.
 * Pour essayer une autre date : ?jour=2027-12-24
 */

import { PERSOS, PERSO, ELEMENTS, CATEGORIES, LIENS, ROLES, RARETES, stats } from '../../../shared/legendes/persos.js';
import { texteChef } from '../../../shared/legendes/passifs.js';
import { jourDe, portails, fetesDu, FETE } from '../../../shared/legendes/calendrier.js';
import { nouvelEtat, invoquer, prixMulti, palierDe, connexion, cadeauFete, PALIERS, PRIX, PITIE } from '../../../shared/legendes/gacha.js';
import { creerCombat, jouerTour, rotation, kiPour, liens, bonusChef, KI_SUPER, KI_ULTIME, KI_MAX } from '../../../shared/legendes/combat.js';
import { CHAPITRES, EPREUVES, DIFFICULTES, ennemisEn, DEFIS, ULTIME, etage } from '../../../shared/legendes/niveaux.js';
import { portrait, ennemi } from './portrait.js';
import { invocation, superAttaque, superEnnemi, transformation, finCombat } from './animations.js';
import { creerParticules, secouer, arret } from './effets.js';
import * as son from './sons.js';

const $ = (id) => document.getElementById(id);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- La date (on peut la changer pour essayer : ?jour=2027-12-24) ---------------- */
const parametre = new URLSearchParams(location.search).get('jour');
const JOUR = parametre && /^\d{4}-\d{2}-\d{2}$/.test(parametre) ? jourDe(new Date(`${parametre}T12:00:00Z`)) : jourDe(new Date());

/* ---------------- La sauvegarde ---------------- */
const CLE = 'legendes.sauvegarde';
const DEPART = ['kael_r', 'mira_r', 'bram_r', 'lio_r', 'nami_r', 'tobi_r', 'suzu_r', 'fen_r'];
let S = null;
try { S = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { /* ignore */ }
if (!S || !S.gacha) {
  const g = nouvelEtat(Math.floor(Math.random() * 2 ** 31));
  for (const id of DEPART) g.collection[id] = { eveil: 0, n: 1 };
  S = { gacha: g, equipe: DEPART.slice(0, 6), histoire: {}, epreuves: {} };
}
S.fin ??= {};
S.tour ??= 0;
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch { /* ignore */ } };
const possede = (id) => !!S.gacha.collection[id];
const eveilDe = (id) => S.gacha.collection[id]?.eveil ?? 0;

/* ---------------- La navigation ---------------- */
let ecran = 'accueil';
function aller(nom) {
  for (const s of document.querySelectorAll('.ecran')) s.classList.toggle('actif', s.id === `s-${nom}`);
  ecran = nom;
  $('b-retour').style.visibility = nom === 'accueil' ? 'hidden' : 'visible';
  majJetons();
  window.scrollTo(0, 0);
}
const majJetons = () => { $('jetons-n').textContent = S.gacha.jetons; };
function bulle(texte) {
  const b = document.createElement('div');
  b.className = 'bulle';
  b.innerHTML = texte;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 3500);
}
const jours = (n) => (n <= 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`);

/* ---------------- L'accueil ---------------- */
function rendreAccueil() {
  const fetes = fetesDu(JOUR);
  const f = fetes[0];
  const racine = document.documentElement.style;
  racine.setProperty('--fete1', f ? f.couleurs[0] : '#ffd23f');
  racine.setProperty('--fete2', f ? f.couleurs[1] : '#6b2fb3');
  $('fete-bandeau').classList.toggle('cache', !f);
  if (f) $('fete-bandeau').innerHTML = `<b>${f.glyphe} ${f.nom}</b><small>${f.texte}</small><small>Jusqu’au ${new Date(f.fin * 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</small>`;
  // La vitrine : les vedettes du moment (la fête d'abord).
  const ps = portails(JOUR);
  const ids = [...new Set([...ps.filter((p) => p.fete).flatMap((p) => p.vedettes), ...ps.filter((p) => p.id.startsWith('rotation')).flatMap((p) => p.vedettes), 'kael_ssr', 'ryo_ssr', 'mira_ssr'])].slice(0, 3);
  const ordre = ids.length === 3 ? [ids[1], ids[0], ids[2]] : ids;
  $('vitrine').innerHTML = ordre.map((id) => `<span class="${id === ids[0] ? 'centre' : ''}">${portrait(PERSO[id], { taille: 120, anime: true })}</span>`).join('');
  const rot = ps.find((p) => p.id.startsWith('rotation'));
  $('info-portails').textContent = `${ps.length} portails ouverts · le prochain dans ${Math.max(0, rot.fin - JOUR + 1)} jours`;
  const faites = CHAPITRES.reduce((t, c) => t + (S.histoire[c.id] || 0), 0);
  $('info-histoire').textContent = `${faites} / ${CHAPITRES.length * 5} étapes`;
  $('info-collection').textContent = `${Object.keys(S.gacha.collection).length} personnages`;
  // L'épreuve de la fête.
  const ep = f && EPREUVES[f.id];
  $('b-epreuve').classList.toggle('cache', !ep);
  if (ep) {
    const cle = `${f.id}-${f.annee}`;
    $('epreuve-titre').textContent = `${f.glyphe} ${ep.nom}`;
    $('epreuve-info').textContent = S.epreuves[cle] ? 'Réussie ! (on peut la refaire, sans récompense)' : `L’épreuve de la fête : ${ep.jetons} jetons à gagner`;
  }
  majJetons();
}

function cadeauxDuJour() {
  const gain = connexion(S.gacha, JOUR);
  const textes = [];
  if (gain) textes.push(`Connexion du jour : +${gain} jetons${S.gacha.serie > 1 ? ` (${S.gacha.serie} jours d’affilée)` : ''}`);
  for (const f of fetesDu(JOUR)) { const c = cadeauFete(S.gacha, f); if (c) textes.push(`${f.glyphe} Cadeau de la fête : +${c} jetons !`); }
  if (textes.length) { garder(); setTimeout(() => bulle(textes.join('<br>')), 400); }
}

/* ---------------- Les portails ---------------- */
let portailChoisi = null;
function rendrePortails() {
  const ps = portails(JOUR);
  if (!portailChoisi || !ps.some((p) => p.id === portailChoisi)) portailChoisi = (ps.find((p) => p.fete) || ps[1] || ps[0]).id;
  $('onglets-portails').innerHTML = ps.map((p) => `<button data-id="${p.id}" class="${p.id === portailChoisi ? 'oui' : ''}">${p.nom}</button>`).join('');
  const p = ps.find((x) => x.id === portailChoisi);
  const fete = p.fete && FETE[p.fete];
  $('portail').style.setProperty('--pc', fete ? fete.couleurs[1] : p.type === 'permanent' ? '#3a3a6a' : '#6b2fb3');
  const vedettes = p.vedettes.length ? p.vedettes : ['kael_ssr', 'ryo_ssr', 'mira_ssr', 'hiro_ssr'];
  const type = { permanent: 'Portail permanent', garanti: 'Un personnage de la bannière garanti à chaque multi', paliers: 'À paliers : le nouveau garanti au 5e' }[p.type];
  const pal = palierDe(S.gacha, p);
  const pitie = S.gacha.pitie[p.id] || 0;
  const prix = prixMulti(S.gacha, p);
  $('portail').innerHTML = `<div class="affiche">${vedettes.slice(0, 3).map((id, i) => portrait(PERSO[id], { taille: i === 0 ? 170 : 120, anime: true })).join('')}</div>
    <div class="titre">${p.nom}</div><span class="type ${p.type}">${type}</span>
    <div class="details">${p.nouveaux.length ? `Nouveaux : <b>${p.nouveaux.map((id) => `${PERSO[id].nom} (${PERSO[id].rarete}) · ${PERSO[id].titre}`).join(', ')}</b><br>` : ''}
      ${p.fin !== undefined ? `Se termine ${jours(p.fin - JOUR)}. ` : ''}${p.vedettes.length ? `Une vedette garantie au plus tard dans ${PITIE - pitie} tirages.` : 'Tous les personnages de base, et les vedettes des portails passés.'}
      <br>Taux : LR 1 % · SSR 6 % · SR 28 %. Un SSR garanti à chaque multi.</div>
    ${p.type === 'paliers' ? `<div class="paliers-ligne">${PALIERS.map((x, k) => `<span class="${k < pal ? 'fait' : k === pal ? 'ici' : ''}">${k + 1}<br>${x.prix} 🪙</span>`).join('')}</div><div class="details">${pal < PALIERS.length ? `Palier ${pal + 1} : ${PALIERS[pal].texte}` : 'Paliers terminés : multis à 50 jetons.'}</div>` : ''}
    <div class="boutons"><button id="b-simple" ${S.gacha.jetons < PRIX.simple ? 'disabled' : ''}>Invoquer ×1<small>${PRIX.simple} 🪙</small></button><button class="multi" id="b-multi" ${S.gacha.jetons < prix ? 'disabled' : ''}>Invoquer ×10<small>${prix} 🪙</small></button></div>`;
  $('b-simple').onclick = () => tirer(p, 1);
  $('b-multi').onclick = () => tirer(p, 10);
}

async function tirer(p, n) {
  son.reveiller();
  const r = invoquer(S.gacha, p, n);
  if (!r.ok) { bulle('Pas assez de jetons : joue l’histoire et les épreuves pour en gagner.'); return; }
  garder();
  majJetons();
  await invocation($('scene'), r.resultats, r.garanties);
  rendrePortails();
}

/* ---------------- La collection, la fiche ---------------- */
let filtre = 'tous';
function rendreCollection() {
  $('filtres').innerHTML = ['tous', 'LR', 'SSR', 'SR', 'R'].map((f) => `<button data-f="${f}" class="${filtre === f ? 'oui' : ''}">${f === 'tous' ? 'Tous' : f}</button>`).join('');
  // Tous ceux qui existent déjà (sortis ou de fête) ; ceux qu'on n'a pas, en ombre.
  const sortis = new Set(portails(JOUR).flatMap((p) => p.pool));
  const liste = PERSOS.filter((x) => (possede(x.id) || sortis.has(x.id)) && (filtre === 'tous' || x.rarete === filtre))
    .sort((a, b) => ['LR', 'SSR', 'SR', 'R'].indexOf(a.rarete) - ['LR', 'SSR', 'SR', 'R'].indexOf(b.rarete) || (possede(b.id) - possede(a.id)));
  $('grille-collection').innerHTML = liste.map((x) => portrait(x, { cadre: true, taille: 100, data: true, eveil: possede(x.id) ? eveilDe(x.id) : undefined, classe: possede(x.id) ? '' : 'non' })).join('');
}

function ouvrirFiche(id) {
  const x = PERSO[id], el = ELEMENTS[x.element], ev = eveilDe(id), s = stats(id, ev);
  $('fiche').innerHTML = `<div class="fiche-haut">${portrait(x, { cadre: true, taille: 130, nom: false, eveil: possede(id) ? ev : undefined })}<div><h2>${x.nom}</h2><small>${x.titre}</small><br><small>${x.rarete} · ${el.glyphe} ${el.nom} · ${ROLES[x.role]}</small>
      <div class="categories">${x.categories.map((f) => `<span>${CATEGORIES[f]}</span>`).join('')}</div></div></div>
    <div class="stats"><div><b>${s.pv.toLocaleString('fr-FR')}</b>PV</div><div><b>${s.atq.toLocaleString('fr-FR')}</b>ATQ</div><div><b>${s.def.toLocaleString('fr-FR')}</b>DÉF</div></div>
    <div class="bloc"><b>👑 Chef :</b> ${texteChef(x.chef, CATEGORIES)}</div>
    <div class="bloc"><b>💥 Super attaque · ${x.super.nom} :</b> ${x.super.texte}${x.super.ultime ? `<br><b>🌟 Ultime (${KI_ULTIME} de ki) · ${x.super.ultime.nom} :</b> ${x.super.ultime.texte}` : ''}</div>
    <div class="bloc"><b>✨ Passif · ${x.passif.nom}</b><ul class="fiche-lignes">${x.passif.lignes.map((l) => `<li>${l}</li>`).join('')}</ul></div>
    <div class="bloc"><b>🔗 Liens :</b> ${x.liens.map((l) => `${LIENS[l].nom} (${LIENS[l].texte})`).join(' · ')}</div>
    <div class="bloc"><b>Éveil :</b> ${possede(id) ? `${'★'.repeat(ev)}${'☆'.repeat(RARETES[x.rarete].eveilMax - ev)} (chaque doublon : +8 %)` : 'Pas encore dans ta collection.'}</div>
    ${x.fete ? `<div class="bloc"><b>Personnage de fête :</b> ${FETE[x.fete].glyphe} ${FETE[x.fete].nom} seulement.</div>` : ''}
    <button class="fermer">Fermer</button>`;
  $('v-fiche').classList.remove('cache');
}

/* ---------------- L'équipe ---------------- */
let place = 0;
function rendreEquipe() {
  $('places').innerHTML = [0, 1, 2, 3, 4, 5].map((k) => `<button class="place${k === place ? ' choisie' : ''}" data-k="${k}">${S.equipe[k] ? portrait(PERSO[S.equipe[k]], { cadre: true, taille: 80, nom: false, eveil: eveilDe(S.equipe[k]) }) : '+'}</button>`).join('');
  const chef = PERSO[S.equipe[0]];
  $('chef-info').innerHTML = chef ? `👑 Chef : <b>${chef.nom}</b> · ${texteChef(chef.chef, CATEGORIES)}<br><small>L’ami (le même chef) double ce bonus. Les liens se forment entre voisins de rotation.</small>` : '';
  const liste = PERSOS.filter((x) => possede(x.id)).sort((a, b) => ['LR', 'SSR', 'SR', 'R'].indexOf(a.rarete) - ['LR', 'SSR', 'SR', 'R'].indexOf(b.rarete));
  $('grille-equipe').innerHTML = liste.map((x) => portrait(x, { cadre: true, taille: 100, data: true, eveil: eveilDe(x.id), classe: S.equipe.includes(x.id) ? 'dans' : '' })).join('');
}

/* ---------------- L'histoire ---------------- */
let difficulte = 0;
/** La progression d'un chapitre dans une difficulté (le nombre d'étapes réussies). */
const cleHistoire = (ch, d) => (d ? `${ch}:${d}` : ch);
const faitesDe = (ch, d) => S.histoire[cleHistoire(ch, d)] || 0;
/** Une difficulté s'ouvre quand toute l'histoire est finie dans la précédente. */
const difficulteOuverte = (d) => d === 0 || CHAPITRES.every((c) => faitesDe(c.id, d - 1) >= c.etapes.length);
function rendreHistoire() {
  const D = DIFFICULTES[difficulte];
  let ouvert = true;
  $('chapitres').innerHTML = `<div class="difficultes">${DIFFICULTES.map((x, i) => `<button data-d="${i}" class="${i === difficulte ? 'oui' : ''}" ${difficulteOuverte(i) ? '' : 'disabled'}>${x.nom}</button>`).join('')}</div>` + CHAPITRES.map((c) => {
    const faites = faitesDe(c.id, difficulte);
    const html = `<div class="chapitre"><h3>${c.nom}</h3>${c.etapes.map((e, k) => `<button class="etape${k < faites ? ' faite' : ''}${k === 4 ? ' boss' : ''}" data-ch="${c.id}" data-k="${k}" ${ouvert && k <= faites ? '' : 'disabled'}>
      <b>${k + 1}. ${e.nom}</b><small>${k < faites ? 'Rejouer' : `+${e.jetons * D.jetons} 🪙`}</small></button>`).join('')}</div>`;
    ouvert = ouvert && faites >= c.etapes.length;
    return html;
  }).join('');
}

/* ---------------- Le jeu de fin : défis suprêmes, combat ultime, tour infinie ---------------- */
function rendreFinJeu() {
  const cats = (id) => PERSO[id].categories;
  const equipe = S.equipe.filter(Boolean);
  const html = [];
  html.push('<p class="consigne">Le jeu de fin : des combats bien plus durs que l’histoire. Il faut des LR éveillés, et une équipe montée autour d’une catégorie.</p>');
  for (const d of DEFIS) {
    const ok = equipe.length >= 3 && equipe.every((id) => cats(id).includes(d.categorie));
    html.push(`<button class="carte-defi" data-defi="${d.id}" ${ok ? '' : 'disabled'}><b>${d.nom}</b><small>${S.fin[d.id] ? '✓ Réussi · ' : `+${d.jetons} 🪙 · `}Équipe de la catégorie « ${CATEGORIES[d.categorie]} » seulement · ${d.ennemis.length} boss à la suite${ok ? '' : ' · ton équipe ne convient pas'}</small></button>`);
  }
  html.push(`<button class="carte-defi ultime" data-defi="ultime"><b>${ULTIME.nom}</b><small>${S.fin.ultime ? '✓ Vaincu · ' : `+${ULTIME.jetons} 🪙 · `}${(ULTIME.ennemis[0].pv).toLocaleString('fr-FR')} PV, trois formes</small></button>`);
  const n = (S.tour || 0) + 1;
  html.push(`<button class="carte-defi tour" data-defi="tour"><b>🗼 Tour infinie · étage ${n}</b><small>Record : étage ${S.tour || 0} · un boss tous les cinq étages · +${etage(n).jetons} 🪙</small></button>`);
  $('fin-jeu').innerHTML = html.join('');
}

/* ---------------- Le combat ---------------- */
let C = null;
let occupe = false;
/** Les particules de l'arène (les étincelles des coups). */
let P = null;
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

/* ---------------- L'allié : le chef d'un ami, choisi avant chaque combat ---------------- */
const PSEUDOS = ['Kaito_92', 'LunaÉclair', 'Ryoku', 'ZéphyrX', 'MaîtreDuKi', 'Nova', 'Shiro', 'Akane', 'TempêteRouge', 'Hikari'];
/** Les amis du jour (les mêmes toute la journée) : un pseudo, son chef (un SSR ou un LR déjà sorti), son éveil. */
function amisDuJour() {
  let g = (JOUR * 2654435761) >>> 0;
  const R = () => { g = (Math.imul(g ^ (g >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return g / 4294967296; };
  const sortis = [...new Set(portails(JOUR).flatMap((p) => p.pool))].filter((id) => ['SSR', 'LR'].includes(PERSO[id].rarete));
  const lr = sortis.filter((id) => PERSO[id].rarete === 'LR');
  const pris = new Set();
  return PSEUDOS.slice(0, 6).map((nom, k) => {
    // Des LR d'abord, et jamais deux fois le même chef (tant qu'il en reste).
    let liste = (k < 3 && lr.length ? lr : sortis).filter((id) => !pris.has(id));
    if (!liste.length) liste = sortis.filter((id) => !pris.has(id));
    if (!liste.length) liste = sortis;
    const id = liste[Math.floor(R() * liste.length)];
    pris.add(id);
    return { nom, id, eveil: Math.floor(R() * (RARETES[PERSO[id].rarete].eveilMax + 1)), rang: 20 + Math.floor(R() * 480) };
  });
}
/** Combien de membres de l'équipe profitent pleinement de ce chef (ils sont dans sa catégorie). */
const couverture = (chefId) => S.equipe.filter(Boolean).filter((id) => PERSO[id].categories.some((k) => PERSO[chefId].chef.cats.includes(k))).length;

/** Lance un combat : d'abord le choix de l'allié (sauf si o.ami est déjà là, pour « Réessayer »). */
function lancerCombat(o) {
  if (o.ami) { demarrerCombat(o); return; }
  const amis = [{ nom: 'Ton propre chef', id: S.equipe.find(Boolean), eveil: eveilDe(S.equipe.find(Boolean)), rang: '—', toi: true }, ...amisDuJour()];
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
  const equipe = S.equipe.filter(Boolean).map((id) => ({ id, eveil: eveilDe(id) }));
  C = { o, c: creerCombat({ equipe, ennemis: o.ennemis, graine: Math.floor(Math.random() * 2 ** 31), ami: o.ami }), ennemiPv: o.ennemis.map((e) => e.pv), pv: 0, cible: 0 };
  C.pv = C.c.pv;
  P?.detruire();
  P = creerParticules($('arene'));
  aller('combat');
  rendreEnnemi();
  rendreCombat();
}

function rendreEnnemi() {
  const e = C.c.ennemis[C.cible];
  if (!e) return;
  $('arene').style.setProperty('--ec', ELEMENTS[e.element].couleur);
  $('ennemi-nom').innerHTML = `${ELEMENTS[e.element].glyphe} ${e.nom}${e.boss ? ' · BOSS' : ''}${e.super ? `<span class="ennemi-phase">Super : ${e.super.nom}${e.phases?.length ? ` · ${e.phases.length - e.phase} transformation${e.phases.length - e.phase > 1 ? 's' : ''} à venir` : ''}</span>` : ''}`;
  $('monstre').className = 'monstre';
  $('monstre').innerHTML = ennemi(e, 200);
  $('vague').textContent = C.c.ennemis.length > 1 ? `Ennemi ${C.cible + 1}/${C.c.ennemis.length}` : '';
  majPv();
}
function majPv() {
  const e = C.c.ennemis[C.cible];
  if (e) { const v = Math.max(0, C.ennemiPv[C.cible]); $('ennemi-pv').style.width = `${(v / e.pvMax) * 100}%`; $('ennemi-pv-txt').textContent = `${v.toLocaleString('fr-FR')} PV`; }
  $('equipe-pv').style.width = `${(Math.max(0, C.pv) / C.c.pvMax) * 100}%`;
  $('equipe-pv-txt').textContent = `Équipe : ${Math.max(0, C.pv).toLocaleString('fr-FR')} / ${C.c.pvMax.toLocaleString('fr-FR')}`;
}

function rendreCombat() {
  const c = C.c, rot = rotation(c), li = liens(c);
  $('trio').innerHTML = rot.map((i, k) => {
    const m = c.membres[i], x = PERSO[m.id];
    return `<div class="combattant" data-i="${i}">${portrait(x, { cadre: true, taille: 110, eveil: eveilDe(m.id) })}
      <div class="ki${m.ki >= KI_SUPER ? ' plein' : ''}"><i style="width:${(m.ki / KI_MAX) * 100}%"></i></div><div class="ki-txt">Ki ${m.ki}${li[k] ? ` · 🔗${li[k]}` : ''}</div></div>`;
  }).join('');
  $('spheres').innerHTML = c.spheres.map((s, k) => `<button class="sphere" data-c="${s}" data-k="${k}" style="--c:${ELEMENTS[s].couleur}" aria-label="${ELEMENTS[s].nom}"></button>`).join('');
  majPv();
}

/** Montre le ki que chacun gagnerait (au survol d'une couleur). */
function apercu(couleur) {
  const g = couleur ? kiPour(C.c, couleur) : null;
  for (const s of document.querySelectorAll('.sphere')) s.classList.toggle('meme', !!couleur && s.dataset.c === couleur);
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
  (o.hote || $('nombres')).appendChild(n);
  setTimeout(() => n.remove(), 1200);
}

async function choisirCouleur(couleur) {
  if (occupe || !C || C.c.fin) return;
  occupe = true;
  son.reveiller();
  apercu(couleur);
  for (const s of document.querySelectorAll(`.sphere[data-c="${couleur}"]`)) s.classList.add('part');
  son.sphere();
  await attendre(450);
  const evs = jouerTour(C.c, couleur);
  const toucher = () => { $('monstre').classList.remove('touche'); void $('monstre').offsetWidth; $('monstre').classList.add('touche'); };
  const sur = (i) => document.querySelector(`.combattant[data-i="${i}"]`);
  const auDessus = (el, texte, couleur) => {
    if (!el) return;
    const r = el.getBoundingClientRect(), a = $('arene').getBoundingClientRect();
    etiquette(texte, ((r.left + r.width / 2 - a.left) / a.width) * 100, 70, couleur);
  };
  for (const ev of evs) {
    if (!C) return;
    const e = C.c.ennemis[C.cible];
    if (ev.type === 'debut') {
      C.pv = Math.min(C.c.pvMax, C.pv + ev.soin);
      etiquette(`+${ev.soin.toLocaleString('fr-FR')} PV`, 50, 82, '#36d39a');
      majPv();
      await attendre(400);
    } else if (ev.type === 'attaque' || ev.type === 'super' || ev.type === 'ultime') {
      const el = sur(ev.qui);
      if (ev.add) { auDessus(el, ev.type === 'attaque' ? 'Attaque add. !' : 'Super add. !', '#ffd23f'); await attendre(250); }
      if (ev.type !== 'attaque') await superAttaque($('scene'), ev.id, { ultime: ev.type === 'ultime', ennemi: e, degats: ev.degats, crit: ev.crit });
      el?.classList.add('frappe');
      son.coup();
      toucher();
      if (P) { const r = $('monstre').getBoundingClientRect(), a = $('arene').getBoundingClientRect(); P.gerbe(r.left - a.left + r.width / 2, r.top - a.top + r.height / 2, ELEMENTS[PERSO[ev.id].element].couleur, ev.type === 'attaque' ? 18 : 40, 500); }
      if (ev.crit) { await arret(60); secouer($('arene'), 8, 220); }
      C.ennemiPv[ev.cible] -= ev.degats;
      nombre(`${ev.crit ? '💥 ' : ''}${ev.degats.toLocaleString('fr-FR')}`, 40 + Math.random() * 20, 30 + Math.random() * 25, { gros: ev.type !== 'attaque' || ev.crit, avantage: ev.avantage > 1, couleur: ELEMENTS[PERSO[ev.id].element].couleur });
      majPv();
      await attendre(ev.type === 'attaque' ? 380 : 450);
      el?.classList.remove('frappe');
    } else if (ev.type === 'esquiveEnnemi') {
      etiquette('Esquivé !', 50, 30, '#ff8a8a');
      await attendre(350);
    } else if (ev.type === 'transformation') {
      C.ennemiPv[ev.cible] = ev.pv;
      await transformation($('scene'), C.c.ennemis[ev.cible], ev.nom, ev.texte);
      rendreEnnemi();
    } else if (ev.type === 'superEnnemi') {
      await superEnnemi($('scene'), e, ev.nom, ev.tous);
    } else if (ev.type === 'esquive') {
      const el = sur(ev.cible);
      auDessus(el, 'ESQUIVE !', '#36d39a');
      el?.classList.add('frappe');
      son.lame();
      await attendre(380);
      el?.classList.remove('frappe');
    } else if (ev.type === 'contre') {
      const el = sur(ev.qui);
      auDessus(el, 'CONTRE !', '#ffd23f');
      el?.classList.add('frappe');
      son.coup();
      toucher();
      C.ennemiPv[ev.cible] -= ev.degats;
      nombre(ev.degats.toLocaleString('fr-FR'), 45 + Math.random() * 10, 35, { gros: true, couleur: '#ffd23f' });
      majPv();
      await attendre(420);
      el?.classList.remove('frappe');
    } else if (ev.type === 'ko') {
      $('monstre').classList.add('ko');
      son.impact(true);
      await attendre(800);
      C.cible = ev.cible + 1;
      if (C.cible < C.c.ennemis.length) rendreEnnemi();
    } else if (ev.type === 'riposte') {
      const el = document.querySelector(`.combattant[data-i="${ev.cible}"]`);
      $('arene').classList.remove('secoue'); void $('arene').offsetWidth; if (ev.fort) $('arene').classList.add('secoue');
      el?.classList.remove('blesse'); void el?.offsetWidth; el?.classList.add('blesse');
      son.blesse();
      if (ev.garde) auDessus(el, 'GARDE', '#6ab8ff');
      if (ev.fort) secouer($('arene'), 10, 300);
      C.pv -= ev.degats;
      if (el) { const r = el.getBoundingClientRect(), a = $('arene').getBoundingClientRect(); nombre(`-${ev.degats.toLocaleString('fr-FR')}`, ((r.left + r.width / 2 - a.left) / a.width) * 100, 88, { couleur: '#ff2a3a' }); }
      majPv();
      await attendre(ev.fort ? 520 : 360);
    } else if (ev.type === 'victoire') {
      await attendre(300);
      const o = C.o;
      const gagne = o.premiere ? o.recompense : 0;
      if (gagne) S.gacha.jetons += gagne;
      o.fini?.();
      garder();
      C = null;
      occupe = false;
      await finCombat($('scene'), { victoire: true, texte: gagne ? `+${gagne} jetons 🪙` : 'Déjà réussie : pas de jetons cette fois.' });
      o.retour();
      return;
    } else if (ev.type === 'defaite') {
      const o = C.o;
      C = null;
      occupe = false;
      const v = await finCombat($('scene'), { victoire: false, texte: 'Ton équipe est à terre. Change d’équipe, ou retente ta chance.' });
      if (v === 'rejouer') lancerCombat(o); else o.retour();
      return;
    }
  }
  rendreCombat();
  occupe = false;
}

/* ---------------- Le branchement ---------------- */
function brancher() {
  $('b-retour').onclick = () => { if (ecran === 'combat') { if (occupe) return; if (!confirm('Abandonner le combat ?')) return; C = null; } aller('accueil'); rendreAccueil(); };
  $('b-invoquer').onclick = () => { son.reveiller(); rendrePortails(); aller('portails'); };
  $('b-histoire').onclick = () => { rendreHistoire(); aller('histoire'); };
  $('b-equipe').onclick = () => { rendreEquipe(); aller('equipe'); };
  $('b-collection').onclick = () => { rendreCollection(); aller('collection'); };
  $('b-epreuve').onclick = () => {
    const f = fetesDu(JOUR)[0], ep = f && EPREUVES[f.id];
    if (!ep) return;
    const cle = `${f.id}-${f.annee}`;
    lancerCombat({ ennemis: ep.ennemis, recompense: ep.jetons, premiere: !S.epreuves[cle], fini: () => { S.epreuves[cle] = true; }, retour: () => { aller('accueil'); rendreAccueil(); } });
  };
  $('onglets-portails').onclick = (e) => { const b = e.target.closest('button'); if (b) { portailChoisi = b.dataset.id; son.bip(); rendrePortails(); } };
  $('filtres').onclick = (e) => { const b = e.target.closest('button'); if (b) { filtre = b.dataset.f; rendreCollection(); } };
  $('grille-collection').onclick = (e) => { const c = e.target.closest('.carte'); if (c) ouvrirFiche(c.dataset.id); };
  $('v-fiche').onclick = (e) => { if (e.target === $('v-fiche') || e.target.closest('.fermer')) $('v-fiche').classList.add('cache'); };
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
  $('b-finjeu').onclick = () => { rendreFinJeu(); aller('finjeu'); };
  $('fin-jeu').onclick = (e) => {
    const b = e.target.closest('.carte-defi');
    if (!b || b.disabled) return;
    const id = b.dataset.defi, retour = () => { rendreFinJeu(); aller('finjeu'); };
    if (id === 'tour') { const n = (S.tour || 0) + 1, et = etage(n); lancerCombat({ ennemis: et.ennemis, recompense: et.jetons, premiere: true, fini: () => { S.tour = Math.max(S.tour || 0, n); }, retour }); return; }
    const d = id === 'ultime' ? ULTIME : DEFIS.find((x) => x.id === id);
    lancerCombat({ ennemis: d.ennemis.map((x) => ({ ...x, phases: x.phases?.map((p) => ({ ...p })) })), recompense: d.jetons, premiere: !S.fin[d.id], fini: () => { S.fin[d.id] = true; }, retour });
  };
  $('chapitres').onclick = (e) => {
    const t = e.target.closest('.difficultes button');
    if (t && !t.disabled) { difficulte = +t.dataset.d; son.bip(); rendreHistoire(); return; }
    const b = e.target.closest('.etape');
    if (!b || b.disabled) return;
    const ch = CHAPITRES.find((c) => c.id === b.dataset.ch), k = +b.dataset.k, et = ch.etapes[k];
    const d = difficulte, D = DIFFICULTES[d], faites = faitesDe(ch.id, d);
    lancerCombat({ ennemis: ennemisEn(et.ennemis, D), recompense: et.jetons * D.jetons, premiere: k >= faites, fini: () => { if (k >= faites) S.histoire[cleHistoire(ch.id, d)] = k + 1; }, retour: () => { rendreHistoire(); aller('histoire'); } });
  };
  const sph = $('spheres');
  sph.onclick = (e) => { const b = e.target.closest('.sphere'); if (b) choisirCouleur(b.dataset.c); };
  sph.onpointerover = (e) => { const b = e.target.closest('.sphere'); if (b && !occupe) apercu(b.dataset.c); };
  sph.onpointerleave = () => { if (!occupe) apercu(null); };
}

brancher();
cadeauxDuJour();
rendreAccueil();
aller('accueil');

// Pour les essais : window.legendes
window.legendes = { S, JOUR, garder, lancerCombat, portails: () => portails(JOUR) };
