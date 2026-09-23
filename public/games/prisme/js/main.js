/**
 * PRISME — navigation, composition d'équipe et conduite de l'expédition.
 *
 * Ce module tient les écrans et la sauvegarde ; il ne connaît rien des règles,
 * qu'il délègue entièrement aux modules partagés, ni des animations, qui vivent
 * dans `scene.js`.
 */

import {
  HEROS, PAR_ID, ROLES, PASSIFS, EFFETS, equipeAuHasard, equipeParDefaut, budgetOf,
} from '../../../shared/prisme/heros.js';
import { AFFINITES, CYCLE, roueSvg, domine, craint } from '../../../shared/prisme/affinites.js';
import { spriteSvg } from '../../../shared/prisme/sprites.js';
import { creerCombat, vieMaximale, PHASE } from '../../../shared/prisme/combat.js';
import {
  creerExpedition, composerRencontre, resoudre, choisirEveil, etiquette, secteurCourant,
  SECTEURS, RENCONTRES_PAR_SECTEUR, DIFFICULTES,
} from '../../../shared/prisme/expedition.js';
import { makeRng } from '../../../shared/hasard.js';
import * as scene from './scene.js';
import { rendrePage, PAGES } from './regles.js';
import { sfx, basculer as basculerSon, estActif as sonActif, debloquer } from './sfx.js';

const $ = (id) => document.getElementById(id);
const txt = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const teinte = (a) => (AFFINITES[a] || AFFINITES.vermeil).teinte;
const nb = (n) => Math.round(n).toLocaleString('fr-FR');

/* ------------------------------------------------------------------ */
/* Préférences et sauvegarde                                           */
/* ------------------------------------------------------------------ */

const prefs = { equipe: [], difficulte: 'guerrier', filtre: 'tous', regle: 0 };
let exp = null;            // expédition en cours
let rencontre = null;      // rencontre composée, en attente d'engagement

function chargerPrefs() {
  try {
    const brut = localStorage.getItem('prisme.prefs');
    if (brut) Object.assign(prefs, JSON.parse(brut));
  } catch { /* premier passage */ }
  if (!DIFFICULTES[prefs.difficulte]) prefs.difficulte = 'guerrier';
  // Une préférence peut désigner un héros retiré depuis.
  prefs.equipe = (prefs.equipe || []).filter((id) => PAR_ID[id]).slice(0, 6);
}
const sauverPrefs = () => {
  try { localStorage.setItem('prisme.prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
};

/** L'expédition tient dans une poignée de champs : on la range telle quelle. */
function sauverPartie() {
  if (!exp || exp.termine) { try { localStorage.removeItem('prisme.partie'); } catch { /* ignore */ } return; }
  const paquet = {
    seed: exp.seed, difficulte: exp.difficulte,
    equipe: exp.equipe.map((h) => h.id),
    eveils: exp.eveils, acquis: exp.acquis, vus: exp.vus,
    secteur: exp.secteur, rencontre: exp.rencontre,
    objets: exp.objets, vie: exp.vie, vieMax: exp.vieMax,
  };
  try { localStorage.setItem('prisme.partie', JSON.stringify(paquet)); } catch { /* ignore */ }
}

function chargerPartie() {
  try {
    const brut = localStorage.getItem('prisme.partie');
    if (!brut) return null;
    const p = JSON.parse(brut);
    const equipe = (p.equipe || []).map((id) => PAR_ID[id]);
    if (equipe.length !== 6 || equipe.some((h) => !h)) return null;

    const reprise = creerExpedition({ equipe, difficulte: p.difficulte, seed: p.seed });
    Object.assign(reprise, {
      eveils: { ...reprise.eveils, ...p.eveils },
      acquis: p.acquis || [], vus: p.vus || [],
      secteur: p.secteur || 0, rencontre: p.rencontre || 0,
      objets: p.objets ?? 2, vie: p.vie, vieMax: p.vieMax || vieMaximale(equipe, p.eveils),
    });
    // Le tirage ne se sauvegarde pas : on le relance sur une graine dérivée,
    // ce qui suffit à ne pas rejouer deux fois la même série de rencontres.
    reprise.rng = makeRng((p.seed ^ (p.secteur * 977 + p.rencontre * 31)) >>> 0);
    return reprise;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Écrans                                                              */
/* ------------------------------------------------------------------ */

function montrer(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === `s-${id}`));
  window.scrollTo(0, 0);
}

function allerMenu() {
  sauverPartie();
  majReprise();
  montrer('menu');
}

function majReprise() {
  const sauve = chargerPartie();
  const b = $('b-reprendre');
  b.hidden = !sauve;
  if (sauve) {
    $('reprendre-note').textContent =
      `${etiquette(sauve)} · ${Math.round(sauve.vie / sauve.vieMax * 100)} % de vie`;
  }
}

/* ------------------------------------------------------------------ */
/* Composition d'équipe                                                */
/* ------------------------------------------------------------------ */

const FILTRES = [
  { id: 'tous', nom: 'Tous' },
  ...Object.entries(ROLES).map(([id, r]) => ({ id, nom: `${r.glyphe} ${r.nom}` })),
  ...CYCLE.map((a) => ({ id: a, nom: `${AFFINITES[a].glyphe} ${AFFINITES[a].nom}` })),
];

function rendreEquipe() {
  // Les deux rotations, montrées telles qu'elles joueront.
  const groupes = [
    { titre: 'Rotation A · tours impairs', de: 0 },
    { titre: 'Rotation B · tours pairs', de: 3 },
  ];
  $('squad').innerHTML = groupes.map((g) => `
    <div class="groupe">
      <div class="groupe-titre">${g.titre}</div>
      <div class="groupe-slots">${[0, 1, 2].map((k) => slotHtml(g.de + k)).join('')}</div>
    </div>`).join('');

  $('squad').querySelectorAll('.slot').forEach((el) => {
    const n = +el.dataset.n;
    el.onclick = (ev) => {
      if (ev.target.closest('.slot-meneur')) { promouvoir(n); return; }
      retirer(n);
    };
  });

  const meneur = PAR_ID[prefs.equipe[0]];
  $('meneur-note').innerHTML = meneur
    ? `<b>${txt(meneur.nom)}</b> mène : ${txt(meneur.meneur.texte)}`
    : 'Le premier héros choisi devient le meneur — son bonus vaut pour toute l’équipe.';

  $('equipe-sub').textContent = prefs.equipe.length < 6
    ? `Encore ${6 - prefs.equipe.length} héros. Touchez ★ pour changer de meneur.`
    : 'Équipe complète. Touchez un héros pour le retirer, ★ pour le faire mener.';
  $('b-partir').disabled = prefs.equipe.length !== 6;

  rendreRoster();
}

function slotHtml(n) {
  const h = PAR_ID[prefs.equipe[n]];
  if (!h) {
    return `<div class="slot" data-n="${n}"><span class="slot-num">${n + 1}</span>`
      + `<span class="slot-vide">+</span></div>`;
  }
  return `<div class="slot is-plein${n === 0 ? ' is-meneur' : ''}" data-n="${n}"`
    + ` style="--aff:${teinte(h.affinite)}" title="${txt(h.nom)}">`
    + `<span class="slot-num">${n + 1}</span>`
    + spriteSvg(h, 'repos')
    + `<span class="slot-meneur">★</span></div>`;
}

function rendreRoster() {
  const liste = HEROS.filter((h) => prefs.filtre === 'tous'
    || h.role === prefs.filtre || h.affinite === prefs.filtre);
  $('roster').innerHTML = liste.map((h) => carteHeros(h, prefs.equipe.includes(h.id))).join('');
  $('roster').querySelectorAll('.carte-heros').forEach((el) => {
    const h = PAR_ID[el.dataset.id];
    el.onclick = (ev) => {
      if (ev.target.closest('.coin')) { ouvrirFiche(h); return; }
      ajouter(h.id);
    };
  });
}

function carteHeros(h, pris = false) {
  return `<button class="carte-heros${pris ? ' est-pris' : ''}" data-id="${h.id}"`
    + ` style="--aff:${teinte(h.affinite)}">`
    + `<span class="coin" title="Fiche">${AFFINITES[h.affinite].glyphe}</span>`
    + `<span class="role" title="${ROLES[h.role].nom}" style="--role:${ROLES[h.role].teinte}">`
    + `${ROLES[h.role].glyphe}</span>`
    + spriteSvg(h, 'repos')
    + `<b>${txt(h.nom)}</b><i>${txt(h.titre)}</i></button>`;
}

function ajouter(id) {
  if (prefs.equipe.includes(id)) { retirer(prefs.equipe.indexOf(id)); return; }
  if (prefs.equipe.length >= 6) { sfx.tap(); return; }
  prefs.equipe.push(id);
  sfx.clic();
  sauverPrefs();
  rendreEquipe();
}

function retirer(n) {
  if (!prefs.equipe[n]) return;
  prefs.equipe.splice(n, 1);
  sfx.tap();
  sauverPrefs();
  rendreEquipe();
}

function promouvoir(n) {
  if (!prefs.equipe[n] || n === 0) return;
  const [id] = prefs.equipe.splice(n, 1);
  prefs.equipe.unshift(id);
  sfx.clic();
  sauverPrefs();
  rendreEquipe();
}

/* ------------------------------------------------------------------ */
/* Fiche d'un héros                                                    */
/* ------------------------------------------------------------------ */

function ouvrirFiche(h) {
  const aff = AFFINITES[h.affinite];
  const coup = (c, quoi) => `<div class="ligne"><u>${quoi} · ${txt(c.nom)}</u> — ×${c.mult}`
    + (c.effet ? ` · ${EFFETS[c.effet.type].nom.toLowerCase()} : ${EFFETS[c.effet.type].texte(c.effet.valeur)}` : '')
    + `</div>`;

  $('fiche-corps').innerHTML =
    `<div class="tete">${spriteSvg(h, 'frappe')}<div>`
    + `<h3>${txt(h.nom)}</h3><div class="titre">${txt(h.titre)}</div>`
    + `<div class="etiquettes">`
    + `<span class="trait" style="color:${aff.teinte}">${aff.glyphe} ${aff.nom}</span>`
    + `<span class="trait">${ROLES[h.role].glyphe} ${ROLES[h.role].nom}</span>`
    + `</div></div></div>`
    + `<div class="stats">`
    + `<div class="stat"><b>${nb(h.pv)}</b><i>vie apportée</i></div>`
    + `<div class="stat"><b>${nb(h.atk)}</b><i>attaque</i></div>`
    + `<div class="stat"><b>${nb(h.def)}</b><i>défense</i></div>`
    + `</div>`
    + coup(h.special, 'Spéciale')
    + coup(h.ultime, 'Ultime')
    + `<div class="ligne"><u>Passif · ${PASSIFS[h.passif.type].nom}</u> — ${PASSIFS[h.passif.type].texte(h.passif.valeur)}</div>`
    + `<div class="ligne meneur"><u>Meneur</u> — ${txt(h.meneur.texte)}</div>`
    + `<div class="etiquettes">${h.liens.map((l) => `<span class="trait">⛓ ${txt(l)}</span>`).join('')}</div>`
    + roueSvg({ moi: h.affinite, cible: domine(h.affinite), taille: 160 })
    + `<div class="ligne" style="text-align:center;color:var(--doux)">`
    + `Domine ${AFFINITES[domine(h.affinite)].nom} · craint ${AFFINITES[craint(h.affinite)].nom}</div>`;

  const boite = $('fiche');
  boite.style.setProperty('--aff', aff.teinte);
  boite.hidden = false;
}

/* ------------------------------------------------------------------ */
/* Expédition                                                          */
/* ------------------------------------------------------------------ */

function partir() {
  const equipe = prefs.equipe.map((id) => PAR_ID[id]);
  if (equipe.length !== 6) return;
  exp = creerExpedition({ equipe, difficulte: prefs.difficulte });
  sauverPartie();
  allerCarte();
}

function reprendre() {
  const sauve = chargerPartie();
  if (!sauve) { majReprise(); return; }
  exp = sauve;
  allerCarte();
}

function allerCarte() {
  rencontre = composerRencontre(exp);
  const sect = secteurCourant(exp);

  $('carte-secteur').textContent = etiquette(exp);
  $('carte-titre').textContent = sect.nom;
  $('carte-texte').textContent = sect.texte;

  // La piste : un pas par rencontre, les boss en rond.
  let piste = '';
  for (let s = 0; s < SECTEURS.length; s++) {
    if (s) piste += '<i class="piste-sep"></i>';
    for (let r = 0; r < RENCONTRES_PAR_SECTEUR; r++) {
      const fait = s < exp.secteur || (s === exp.secteur && r < exp.rencontre);
      const ici = s === exp.secteur && r === exp.rencontre;
      const boss = r === RENCONTRES_PAR_SECTEUR - 1;
      piste += `<i class="piste-pas${fait ? ' est-fait' : ''}${ici ? ' est-ici' : ''}${boss ? ' est-boss' : ''}"></i>`;
    }
  }
  $('carte-piste').innerHTML = piste;

  const part = exp.vie / exp.vieMax;
  $('carte-vie-barre').style.width = `${Math.max(0, part) * 100}%`;
  $('carte-vie-barre').parentElement.classList.toggle('est-bas', part <= 0.5);
  $('carte-vie-barre').parentElement.classList.toggle('est-critique', part <= 0.22);
  $('carte-vie-texte').textContent = `${nb(exp.vie)} / ${nb(exp.vieMax)}`;
  $('carte-objets').textContent = `🧪 ×${exp.objets}`;

  $('carte-ennemis').innerHTML = rencontre.ennemis.map((e) => {
    const rang = e.rang === 'boss' ? '<span class="rang boss">boss</span>'
      : e.rang === 'elite' ? '<span class="rang elite">élite</span>' : '<span class="rang">commun</span>';
    return `<div class="fiche-ennemi" style="--aff:${teinte(e.affinite)}">`
      + spriteSvg(e, 'repos')
      + `<div><div class="nom">${txt(e.nom)} ${rang}</div>`
      + `<div class="detail">${AFFINITES[e.affinite].glyphe} ${AFFINITES[e.affinite].nom}`
      + ` · ${nb(e.pvMax)} vie · ${txt(e.charge.nom)} tous les ${e.charge.tours} tours</div>`
      + `<div class="detail">${e.traits.map((t) => `· ${t}`).join(' ')}</div>`
      + `</div></div>`;
  }).join('');

  $('b-engager').textContent = rencontre.finale ? 'Affronter Le Prisme Noir'
    : rencontre.boss ? 'Affronter le gardien' : 'Engager';
  sauverPartie();
  montrer('carte');
}

async function engager() {
  const combat = creerCombat({
    equipe: exp.equipe,
    ennemis: rencontre.ennemis,
    eveils: exp.eveils,
    objets: exp.objets,
  });
  // La barre de vie suit l'expédition, pas le combat : on la recale.
  combat.vie.max = exp.vieMax;
  combat.vie.actuel = Math.min(exp.vie, exp.vieMax);

  montrer('combat');
  debloquer();
  await scene.lancer(combat, {
    lieu: `${secteurCourant(exp).nom} · ${exp.rencontre + 1}/${RENCONTRES_PAR_SECTEUR}`,
    onQuitter: () => { if (confirm('Quitter ? L’expédition est sauvegardée à la rencontre en cours.')) allerMenu(); },
    onFini: (victoire) => terminerCombat(combat, victoire),
  });
}

function terminerCombat(combat, victoire) {
  const suite = resoudre(exp, {
    victoire,
    vie: combat.vie.actuel,
    objets: combat.objets,
  });
  sauverPartie();

  if (suite.suite === 'combat') { setTimeout(allerCarte, 500); return; }
  if (suite.suite === 'eveil') { setTimeout(() => allerEveil(suite.choix), 500); return; }
  setTimeout(() => allerFin(suite.suite === 'victoire'), 600);
}

function allerEveil(choix) {
  sfx.eveil();
  $('eveil-cartes').innerHTML = choix.map((e) =>
    `<button class="eveil-carte" data-id="${e.id}">`
    + `<span class="glyphe">${e.glyphe}</span>`
    + `<span><b>${txt(e.nom)}</b><i>${txt(e.texte)}</i></span></button>`).join('');
  $('eveil-cartes').querySelectorAll('.eveil-carte').forEach((el) => {
    el.onclick = () => {
      if (!choisirEveil(exp, el.dataset.id).ok) return;
      sfx.clic();
      sauverPartie();
      allerCarte();
    };
  });
  montrer('eveil');
}

function allerFin(victoire) {
  const sect = Math.min(exp.secteur + 1, SECTEURS.length);
  $('fin-sceau').textContent = victoire ? '✦' : '☠';
  $('fin-titre').textContent = victoire ? 'Le prisme est traversé' : 'L’expédition s’arrête';
  $('fin-texte').textContent = victoire
    ? 'Six héros, quinze rencontres, une seule barre de vie. Bien joué.'
    : `Vous êtes tombés dans ${secteurCourant(exp).nom}. Une autre équipe ferait peut-être mieux.`;
  $('fin-stats').innerHTML = [
    ['Difficulté', DIFFICULTES[exp.difficulte].nom],
    ['Secteurs franchis', `${victoire ? SECTEURS.length : exp.secteur} / ${SECTEURS.length}`],
    ['Éveils obtenus', exp.acquis.length],
    ['Potions restantes', exp.objets],
    ['Meneur', exp.equipe[0].nom],
  ].map(([k, v]) => `<li><span>${txt(k)}</span><b>${txt(v)}</b></li>`).join('');

  try { localStorage.removeItem('prisme.partie'); } catch { /* ignore */ }
  exp.termine = true;
  montrer('fin');
}

/* ------------------------------------------------------------------ */
/* Garnison et règles                                                  */
/* ------------------------------------------------------------------ */

function rendreGarnison() {
  $('garnison').innerHTML = HEROS.map((h) => carteHeros(h)).join('');
  $('garnison').querySelectorAll('.carte-heros').forEach((el) => {
    el.onclick = () => ouvrirFiche(PAR_ID[el.dataset.id]);
  });
}

function rendreRegles() {
  const p = rendrePage(prefs.regle);
  $('regles-titre').textContent = p.titre;
  $('regles-sous').textContent = p.sous;
  $('regles').innerHTML = p.html;
  $('b-regle-prec').disabled = prefs.regle === 0;
  $('b-regle-suiv').disabled = prefs.regle === PAGES.length - 1;
}

/* ------------------------------------------------------------------ */
/* Branchements                                                        */
/* ------------------------------------------------------------------ */

function brancher() {
  document.querySelectorAll('[data-go]').forEach((el) => {
    el.onclick = () => {
      const cible = el.dataset.go;
      sfx.tap();
      debloquer();
      if (cible === 'menu') return allerMenu();
      if (cible === 'nouvelle') { rendreEquipe(); return montrer('equipe'); }
      if (cible === 'garnison') { rendreGarnison(); return montrer('garnison'); }
      if (cible === 'regles') { rendreRegles(); return montrer('regles'); }
      return montrer(cible);
    };
  });

  $('b-reprendre').onclick = () => { debloquer(); reprendre(); };
  $('b-partir').onclick = partir;
  $('b-engager').onclick = engager;
  $('b-abandonner').onclick = () => {
    if (confirm('Abandonner l’expédition en cours ?')) { exp.termine = true; sauverPartie(); allerMenu(); }
  };
  $('b-rejouer').onclick = () => { rendreEquipe(); montrer('equipe'); };
  $('b-hasard').onclick = () => {
    prefs.equipe = equipeAuHasard(Math.random).map((h) => h.id);
    sfx.clic();
    sauverPrefs();
    rendreEquipe();
  };

  $('b-son').onclick = () => {
    const on = basculerSon();
    $('b-son').innerHTML = `<span class="bi">${on ? '🔊' : '🔇'}</span> Son`;
  };
  $('b-son').innerHTML = `<span class="bi">${sonActif() ? '🔊' : '🔇'}</span> Son`;

  $('b-regle-prec').onclick = () => { prefs.regle--; sauverPrefs(); rendreRegles(); };
  $('b-regle-suiv').onclick = () => { prefs.regle++; sauverPrefs(); rendreRegles(); };

  $('fiche-fermer').onclick = () => { $('fiche').hidden = true; };
  $('fiche').onclick = (ev) => { if (ev.target === $('fiche')) $('fiche').hidden = true; };
  addEventListener('keydown', (ev) => { if (ev.key === 'Escape') $('fiche').hidden = true; });

  $('opt-diff').innerHTML = Object.entries(DIFFICULTES).map(([id, d]) =>
    `<button class="chip${id === prefs.difficulte ? ' is-on' : ''}" data-val="${id}" role="radio"`
    + ` aria-checked="${id === prefs.difficulte}" title="${txt(d.texte)}">${txt(d.nom)}</button>`).join('');
  $('opt-diff').querySelectorAll('.chip').forEach((el) => {
    el.onclick = () => {
      prefs.difficulte = el.dataset.val;
      sauverPrefs();
      $('opt-diff').querySelectorAll('.chip').forEach((z) => {
        z.classList.toggle('is-on', z === el);
        z.setAttribute('aria-checked', String(z === el));
      });
    };
  });

  $('opt-filtre').innerHTML = FILTRES.map((f) =>
    `<button class="chip${f.id === prefs.filtre ? ' is-on' : ''}" data-val="${f.id}" role="radio"`
    + ` aria-checked="${f.id === prefs.filtre}">${txt(f.nom)}</button>`).join('');
  $('opt-filtre').querySelectorAll('.chip').forEach((el) => {
    el.onclick = () => {
      prefs.filtre = el.dataset.val;
      sauverPrefs();
      $('opt-filtre').querySelectorAll('.chip').forEach((z) => {
        z.classList.toggle('is-on', z === el);
        z.setAttribute('aria-checked', String(z === el));
      });
      rendreRoster();
    };
  });
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

chargerPrefs();
if (!prefs.equipe.length) prefs.equipe = equipeParDefaut().map((h) => h.id);
brancher();
majReprise();

/* Service worker : rend le jeu installable et jouable sans réseau.
   Un échec ici ne doit jamais empêcher de jouer. */
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[pwa] service worker non enregistré :', err));
  });
}
