/**
 * RAID — navigation, composition d'équipe et conduite du donjon.
 *
 * Ce module tient les écrans et la sauvegarde ; il ne connaît rien des règles,
 * qu'il délègue entièrement aux modules partagés, ni des animations, qui vivent
 * dans `scene.js`.
 */

import {
  HEROS, PAR_ID, ROLES, PEUPLES, TALENTS, EFFETS, groupeAuHasard, groupeParDefaut,
} from '../../../shared/raid/heros.js';
import { ECOLES, CYCLE, roueSvg, domine, craint } from '../../../shared/raid/ecoles.js';
import { spriteSvg } from '../../../shared/raid/sprites.js';
import { creerCombat, vieMaximale, PHASE } from '../../../shared/raid/combat.js';
import {
  creerDonjon, composerRencontre, resoudre, choisirButin, etiquette, aileCourante,
  AILES, RENCONTRES_PAR_AILE, DIFFICULTES, RARETES,
} from '../../../shared/raid/donjon.js';
import { makeRng } from '../../../shared/hasard.js';
import * as scene from './scene.js';
import { rendrePage, PAGES } from './regles.js';
import { sfx, basculer as basculerSon, estActif as sonActif, debloquer } from './sfx.js';

const $ = (id) => document.getElementById(id);
const txt = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const teinte = (a) => (ECOLES[a] || ECOLES.vermeil).teinte;
const nb = (n) => Math.round(n).toLocaleString('fr-FR');

/* ------------------------------------------------------------------ */
/* Préférences et sauvegarde                                           */
/* ------------------------------------------------------------------ */

const prefs = { equipe: [], difficulte: 'heroique', filtre: 'tous', regle: 0 };
let exp = null;            // donjon en cours
let rencontre = null;      // rencontre composée, en attente d'engagement

function chargerPrefs() {
  try {
    const brut = localStorage.getItem('raid.prefs');
    if (brut) Object.assign(prefs, JSON.parse(brut));
  } catch { /* premier passage */ }
  if (!DIFFICULTES[prefs.difficulte]) prefs.difficulte = 'heroique';
  // Une préférence peut désigner un héros retiré depuis.
  prefs.equipe = (prefs.equipe || []).filter((id) => PAR_ID[id]).slice(0, 6);
}
const sauverPrefs = () => {
  try { localStorage.setItem('raid.prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
};

/** L'donjon tient dans une poignée de champs : on la range telle quelle. */
function sauverPartie() {
  if (!exp || exp.termine) { try { localStorage.removeItem('raid.partie'); } catch { /* ignore */ } return; }
  const paquet = {
    seed: exp.seed, difficulte: exp.difficulte,
    equipe: exp.equipe.map((h) => h.id),
    butin: exp.butin, acquis: exp.acquis, vus: exp.vus,
    aile: exp.aile, rencontre: exp.rencontre,
    objets: exp.objets, vie: exp.vie, vieMax: exp.vieMax,
  };
  try { localStorage.setItem('raid.partie', JSON.stringify(paquet)); } catch { /* ignore */ }
}

function chargerPartie() {
  try {
    const brut = localStorage.getItem('raid.partie');
    if (!brut) return null;
    const p = JSON.parse(brut);
    const groupe = (p.equipe || []).map((id) => PAR_ID[id]);
    if (groupe.length !== 6 || groupe.some((h) => !h)) return null;

    const reprise = creerDonjon({ groupe, difficulte: p.difficulte, seed: p.seed });
    Object.assign(reprise, {
      butin: { ...reprise.butin, ...p.butin },
      acquis: p.acquis || [], vus: p.vus || [],
      aile: p.aile || 0, rencontre: p.rencontre || 0,
      objets: p.objets ?? 2, vie: p.vie, vieMax: p.vieMax || vieMaximale(groupe, p.butin),
    });
    // Le tirage ne se sauvegarde pas : on le relance sur une graine dérivée,
    // ce qui suffit à ne pas rejouer deux fois la même série de rencontres.
    reprise.rng = makeRng((p.seed ^ (p.aile * 977 + p.rencontre * 31)) >>> 0);
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
  ...CYCLE.map((a) => ({ id: a, nom: `${ECOLES[a].glyphe} ${ECOLES[a].nom}` })),
];

function rendreEquipe() {
  // Les deux lignes, montrées telles qu'elles monteront au front.
  const groupes = [
    { titre: 'Groupe 1 · tours impairs', de: 0 },
    { titre: 'Groupe 2 · tours pairs', de: 3 },
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

  const chef = PAR_ID[prefs.equipe[0]];
  $('meneur-note').innerHTML = chef
    ? `<b>${txt(chef.nom)}</b> mène le raid — <u>${txt(chef.meneur.nom)}</u> : ${txt(chef.meneur.texte)}`
    : 'Le premier choisi devient chef de raid : son buff vaut pour tout le monde.';

  $('equipe-sub').textContent = prefs.equipe.length < 6
    ? `Encore ${6 - prefs.equipe.length} personnage${prefs.equipe.length < 5 ? 's' : ''}. Touchez ★ pour changer de chef de raid.`
    : 'Raid complet. Touchez un personnage pour le sortir, ★ pour lui donner le raid.';
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
    + ` style="--aff:${teinte(h.ecole)}" title="${txt(h.nom)}">`
    + `<span class="slot-num">${n + 1}</span>`
    + spriteSvg(h, 'repos')
    + `<span class="slot-meneur">★</span></div>`;
}

function rendreRoster() {
  const liste = HEROS.filter((h) => prefs.filtre === 'tous'
    || h.role === prefs.filtre || h.ecole === prefs.filtre);
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
    + ` style="--aff:${teinte(h.ecole)}">`
    + `<span class="coin" title="Fiche">${ECOLES[h.ecole].glyphe}</span>`
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
  const aff = ECOLES[h.ecole];
  const sort = (c, quoi) => `<div class="ligne"><u>${quoi} · ${txt(c.nom)}</u> — ${c.mana} mana, ×${c.mult}`
    + (c.effet ? ` · ${EFFETS[c.effet.type].nom.toLowerCase()} : ${EFFETS[c.effet.type].texte(c.effet.valeur)}` : '')
    + `</div>`;

  $('fiche-corps').innerHTML =
    `<div class="tete">${spriteSvg(h, 'frappe')}<div>`
    + `<h3>${txt(h.nom)}</h3><div class="titre">${txt(h.titre)}</div>`
    + `<div class="etiquettes">`
    + `<span class="trait" style="color:${aff.teinte}">${aff.glyphe} ${aff.nom}</span>`
    + `<span class="trait">${ROLES[h.role].glyphe} ${ROLES[h.role].nom}</span>`
    + `<span class="trait">${txt(PEUPLES[h.peuple].nom)} · ${txt(h.classe)}</span>`
    + `</div></div></div>`
    + `<div class="stats">`
    + `<div class="stat"><b>${nb(h.pv)}</b><i>vie apportée</i></div>`
    + `<div class="stat"><b>${nb(h.atk)}</b><i>attaque</i></div>`
    + `<div class="stat"><b>${nb(h.def)}</b><i>armure</i></div>`
    + `</div>`
    + sort(h.special, 'Sort')
    + sort(h.ultime, 'Sort ultime')
    + `<div class="ligne"><u>Talent · ${TALENTS[h.talent.type].nom}</u> — ${TALENTS[h.talent.type].texte(h.talent.valeur)}</div>`
    + `<div class="ligne meneur"><u>Chef de raid · ${txt(h.meneur.nom)}</u> — ${txt(h.meneur.texte)}</div>`
    + `<div class="etiquettes">${h.liens.map((l) => `<span class="trait">⛓ ${txt(l)}</span>`).join('')}</div>`
    + roueSvg({ moi: h.ecole, cible: domine(h.ecole), taille: 160 })
    + `<div class="ligne" style="text-align:center;color:var(--doux)">`
    + `Perce ${ECOLES[domine(h.ecole)].nom} · craint ${ECOLES[craint(h.ecole)].nom}</div>`;

  const boite = $('fiche');
  boite.style.setProperty('--aff', aff.teinte);
  boite.hidden = false;
}

/* ------------------------------------------------------------------ */
/* Donjon                                                              */
/* ------------------------------------------------------------------ */

function partir() {
  const groupe = prefs.equipe.map((id) => PAR_ID[id]);
  if (groupe.length !== 6) return;
  exp = creerDonjon({ groupe, difficulte: prefs.difficulte });
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
  const sect = aileCourante(exp);

  $('carte-aile').textContent = etiquette(exp);
  $('carte-titre').textContent = sect.nom;
  $('carte-texte').textContent = sect.texte;

  // La piste : un pas par rencontre, les boss en rond.
  let piste = '';
  for (let s = 0; s < AILES.length; s++) {
    if (s) piste += '<i class="piste-sep"></i>';
    for (let r = 0; r < RENCONTRES_PAR_AILE; r++) {
      const fait = s < exp.aile || (s === exp.aile && r < exp.rencontre);
      const ici = s === exp.aile && r === exp.rencontre;
      const boss = r === RENCONTRES_PAR_AILE - 1;
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
      : e.rang === 'elite' ? '<span class="rang elite">élite</span>' : '<span class="rang">trash</span>';
    return `<div class="fiche-ennemi" style="--aff:${teinte(e.ecole)}">`
      + spriteSvg(e, 'repos')
      + `<div><div class="nom">${txt(e.nom)} ${rang}</div>`
      + `<div class="detail">${ECOLES[e.ecole].glyphe} ${ECOLES[e.ecole].nom}`
      + ` · ${nb(e.pvMax)} vie · incante ${txt(e.charge.nom)} tous les ${e.charge.tours} tours</div>`
      + `<div class="detail">${e.traits.map((t) => `· ${t}`).join(' ')}</div>`
      + `</div></div>`;
  }).join('');

  $('b-engager').textContent = rencontre.finale ? 'Affronter le Dragon Cendré'
    : rencontre.boss ? 'Pull du boss' : 'Pull';
  sauverPartie();
  montrer('carte');
}

async function engager() {
  const combat = creerCombat({
    equipe: exp.equipe,
    ennemis: rencontre.ennemis,
    butin: exp.butin,
    objets: exp.objets,
  });
  // La barre de vie suit le donjon, pas le combat : on la recale.
  combat.vie.max = exp.vieMax;
  combat.vie.actuel = Math.min(exp.vie, exp.vieMax);

  montrer('combat');
  debloquer();
  await scene.lancer(combat, {
    lieu: `${aileCourante(exp).nom} · ${exp.rencontre + 1}/${RENCONTRES_PAR_AILE}`,
    onQuitter: () => { if (confirm('Quitter ? Le donjon est sauvegardé à la rencontre en cours.')) allerMenu(); },
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
  if (suite.suite === 'butin') { setTimeout(() => allerButin(suite.choix), 500); return; }
  setTimeout(() => allerFin(suite.suite === 'victoire'), 600);
}

function allerButin(choix) {
  sfx.butin();
  $('butin-cartes').innerHTML = choix.map((piece) => {
    const r = RARETES[piece.rarete] || RARETES.commun;
    return `<button class="eveil-carte" data-id="${piece.id}" style="--aff:${r.teinte}">`
      + `<span class="glyphe">${piece.glyphe}</span>`
      + `<span><b>${txt(piece.nom)}</b>`
      + `<u class="rarete">${txt(r.nom)}</u>`
      + `<i>${txt(piece.texte)}</i></span></button>`;
  }).join('');
  $('butin-cartes').querySelectorAll('.eveil-carte').forEach((el) => {
    el.onclick = () => {
      if (!choisirButin(exp, el.dataset.id).ok) return;
      sfx.clic();
      sauverPartie();
      allerCarte();
    };
  });
  montrer('butin');
}

function allerFin(victoire) {
  $('fin-sceau').textContent = victoire ? '🐉' : '💀';
  $('fin-titre').textContent = victoire ? 'Donjon bouclé' : 'Wipe.';
  $('fin-texte').textContent = victoire
    ? 'Le Dragon Cendré est tombé. Six héros, quinze pulls, une seule barre de vie.'
    : `Le raid est tombé dans ${aileCourante(exp).nom}. Une autre composition ferait peut-être mieux.`;
  $('fin-stats').innerHTML = [
    ['Difficulté', DIFFICULTES[exp.difficulte].nom],
    ['Ailes nettoyées', `${victoire ? AILES.length : exp.aile} / ${AILES.length}`],
    ['Butin ramassé', exp.acquis.length],
    ['Potions restantes', exp.objets],
    ['Chef de raid', exp.equipe[0].nom],
  ].map(([k, v]) => `<li><span>${txt(k)}</span><b>${txt(v)}</b></li>`).join('');

  try { localStorage.removeItem('raid.partie'); } catch { /* ignore */ }
  exp.termine = true;
  montrer('fin');
}

/* ------------------------------------------------------------------ */
/* Guilde et règles                                                    */
/* ------------------------------------------------------------------ */

function rendreGuilde() {
  $('guilde').innerHTML = HEROS.map((h) => carteHeros(h)).join('');
  $('guilde').querySelectorAll('.carte-heros').forEach((el) => {
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
      if (cible === 'guilde') { rendreGuilde(); return montrer('guilde'); }
      if (cible === 'regles') { rendreRegles(); return montrer('regles'); }
      return montrer(cible);
    };
  });

  $('b-reprendre').onclick = () => { debloquer(); reprendre(); };
  $('b-partir').onclick = partir;
  $('b-engager').onclick = engager;
  $('b-abandonner').onclick = () => {
    if (confirm('Quitter le donjon en cours ?')) { exp.termine = true; sauverPartie(); allerMenu(); }
  };
  $('b-rejouer').onclick = () => { rendreEquipe(); montrer('equipe'); };
  $('b-hasard').onclick = () => {
    prefs.equipe = groupeAuHasard(Math.random).map((h) => h.id);
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
if (!prefs.equipe.length) prefs.equipe = groupeParDefaut().map((h) => h.id);
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
