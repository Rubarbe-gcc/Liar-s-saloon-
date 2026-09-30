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
  AILES, RENCONTRES_PAR_AILE, DIFFICULTES, RARETES, BUTIN_PAR_ID,
  butinCombat, prochaineEtape, choisirDon, evenementCourant, choisirEvenement, menacesDuBoss,
} from '../../../shared/raid/donjon.js';
import {
  NIVEAU_MAX, DONS_PAR_ID, puissance, progressionNiveau, texteDon, critiqueDe,
} from '../../../shared/raid/aventure.js';
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
    // L'aventure : ce qui a été gagné, et ce qui attend encore une décision.
    niveau: exp.niveau, xp: exp.xp, chance: exp.chance, dons: exp.dons,
    menaces: exp.menaces, evenementsVus: exp.evenementsVus, file: exp.file,
    choixDon: (exp.choixDon || []).map((d) => d.id), donsEnAttente: exp.donsEnAttente,
    choixButin: (exp.choixButin || []).map((b) => b.id), evenement: exp.evenement,
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
      objets: p.objets ?? 2,
      // Une sauvegarde d'avant l'aventure reprend au niveau 1 : c'est le
      // niveau qui, désormais, fait la force du raid.
      niveau: p.niveau || 1, xp: p.xp || 0, chance: p.chance ?? reprise.chance,
      dons: p.dons || [], menaces: p.menaces || [], evenementsVus: p.evenementsVus || [],
      file: (p.file || []).filter((x) => ['don', 'butin', 'evenement'].includes(x)),
      choixDon: (p.choixDon || []).map((id) => DONS_PAR_ID[id]).filter(Boolean),
      donsEnAttente: p.donsEnAttente || 0,
      choixButin: (p.choixButin || []).map((id) => BUTIN_PAR_ID[id]).filter(Boolean),
      evenement: p.evenement || null,
    });
    reprise.vieMax = vieMaximale(groupe, butinCombat(reprise));
    const part = p.vieMax ? Math.min(1, (p.vie ?? p.vieMax) / p.vieMax) : 1;
    reprise.vie = Math.round(reprise.vieMax * part);
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
  suivre();
}

/** L'étape suivante du donjon : une décision en attente, ou la carte. */
function suivre() {
  sauverPartie();
  switch (prochaineEtape(exp)) {
    case 'don': return allerDon();
    case 'butin': return allerButin(exp.choixButin);
    case 'evenement': return allerEvenement();
    case 'victoire': return allerFin(true);
    case 'wipe': return allerFin(false);
    default: return allerCarte();
  }
}

/** La fiche du raid : niveau, expérience, chance et dons. */
function ficheRaid() {
  const dons = exp.dons.map((id) => DONS_PAR_ID[id]).filter(Boolean);
  return `<span class="niv">Niveau ${exp.niveau}${exp.niveau >= NIVEAU_MAX ? ' · max' : ''}</span>`
    + `<span class="xp" title="Expérience"><i style="width:${Math.round(progressionNiveau(exp.xp) * 100)}%"></i></span>`
    + `<span class="chance" title="Chance : ${Math.round(critiqueDe(exp.chance) * 100)} % de coups critiques">🍀 ${exp.chance}</span>`
    + `<span class="dons">${dons.length ? dons.map((d) => `${d.glyphe} ${txt(d.nom)}`).join(' · ') : 'Aucun don pour l’instant — le premier au niveau 3.'}</span>`;
}

/** Ce que les choix du raid ont fait au boss de cette aile (et au Dragon). */
function rendreMenaces() {
  const el = $('carte-menaces');
  const finale = exp.aile === AILES.length - 1;
  const m = menacesDuBoss(exp, finale);
  const futures = exp.menaces.filter((x) => x.cible === 'final' && !finale);
  const lignes = [...m.sources, ...futures].map((x) => {
    const qui = x.cible === 'final' ? 'Dragon Cendré' : 'Boss de l’aile';
    const parts = [];
    if (x.pv) parts.push(`${x.pv > 0 ? '+' : '−'}${Math.round(Math.abs(x.pv) * 100)} % de vie`);
    if (x.atk) parts.push(`${x.atk > 0 ? '+' : '−'}${Math.round(Math.abs(x.atk) * 100)} % d’attaque`);
    if (x.retire) parts.push('une capacité en moins');
    const bon = x.pv < 0 || x.atk < 0 || x.retire;
    return `<li class="${bon ? 'bon' : ''}">${qui} : ${parts.join(', ')} <i>(${txt(x.source)})</i></li>`;
  });
  el.hidden = !lignes.length;
  el.innerHTML = lignes.length ? `<b>Menaces et faveurs</b><ul>${lignes.join('')}</ul>` : '';
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
  $('fiche-raid').innerHTML = ficheRaid();
  rendreMenaces();

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
    butin: butinCombat(exp),
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

  if (suite.suite === 'wipe' || suite.suite === 'victoire') {
    setTimeout(() => allerFin(suite.suite === 'victoire'), 600);
    return;
  }
  setTimeout(() => allerProgres(suite.xp), 500);
}

/** Après une victoire : l'expérience gagnée, et le niveau s'il monte. */
function allerProgres(xp) {
  const monte = xp.niveauApres > xp.niveauAvant;
  $('progres-kicker').textContent = monte ? 'niveau supérieur !' : 'victoire';
  $('progres-titre').textContent = `+${xp.gain} XP`;
  $('progres-texte').textContent = monte
    ? `Le raid passe au niveau ${xp.niveauApres} : toute l’équipe frappe, encaisse et tient à ${Math.round(puissance(xp.niveauApres) * 100)} % de sa fiche.`
    : 'Le raid gagne en expérience.';
  $('progres-niveau').innerHTML = `<div class="chiffre${monte ? ' monte' : ''}">${exp.niveau}</div>`
    + `<div class="xp"><i style="width:0%"></i></div>`
    + `<small>${exp.niveau >= NIVEAU_MAX ? 'Niveau maximal atteint' : `${Math.round(progressionNiveau(exp.xp) * 100)} % vers le niveau ${exp.niveau + 1}`}</small>`;
  if (monte) sfx.butin(); else sfx.clic();
  montrer('progres');
  // La jauge se remplit sous les yeux : c'est la progression qu'on doit voir.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const barre = $('progres-niveau').querySelector('.xp i');
    if (barre) barre.style.width = `${Math.round(progressionNiveau(exp.xp) * 100)}%`;
  }));
}

function allerDon() {
  sfx.butin();
  $('don-kicker').textContent = `niveau ${exp.niveau} atteint`;
  $('don-cartes').innerHTML = (exp.choixDon || []).map((d) =>
    `<button class="eveil-carte" data-id="${d.id}" style="--aff:var(--or)">`
    + `<span class="glyphe">${d.glyphe}</span>`
    + `<span><b>${txt(d.nom)}</b><i>${txt(texteDon(d))}</i></span></button>`).join('');
  $('don-cartes').querySelectorAll('.eveil-carte').forEach((el) => {
    el.onclick = () => {
      if (!choisirDon(exp, el.dataset.id).ok) return;
      sfx.clic();
      suivre();
    };
  });
  montrer('don');
}

function allerEvenement() {
  const ev = evenementCourant(exp);
  if (!ev) { exp.file = exp.file.filter((x) => x !== 'evenement'); suivre(); return; }
  $('evenement-glyphe').textContent = ev.glyphe;
  $('evenement-titre').textContent = ev.titre;
  $('evenement-texte').textContent = ev.texte;
  $('evenement-chance').textContent = `🍀 Chance du raid : ${exp.chance} · ${Math.round(exp.vie / exp.vieMax * 100)} % de vie · 🧪 ×${exp.objets}`;
  $('evenement-issue').hidden = true;
  $('evenement-choix').hidden = false;
  $('evenement-choix').innerHTML = ev.choix.map((c) =>
    `<button class="eveil-carte" data-id="${c.id}" style="--aff:${c.chance !== null ? 'var(--vif)' : 'var(--or)'}" ${c.possible ? '' : 'disabled'}>`
    + `<span><b>${txt(c.label)}${c.chance !== null ? `<em class="risque">${Math.round(c.chance * 100)} %</em>` : ''}</b>`
    + `<i>${txt(c.possible ? c.annonce : 'Il vous faudrait une potion.')}</i></span></button>`).join('');
  $('evenement-choix').querySelectorAll('.eveil-carte').forEach((el) => {
    el.onclick = () => {
      const r = choisirEvenement(exp, el.dataset.id);
      if (!r.ok) return;
      sauverPartie();
      if (r.reussi === false) sfx.subi?.(); else sfx.clic();
      $('evenement-choix').hidden = true;
      const dit = $('issue-dit');
      dit.textContent = r.dit;
      dit.className = `issue-dit${r.reussi === true ? ' reussi' : r.reussi === false ? ' rate' : ''}`;
      $('issue-effet').textContent = r.piece ? `${r.effet} : ${r.piece.glyphe} ${r.piece.nom}` : (r.effet === 'aucun effet' ? '' : r.effet);
      $('evenement-issue').hidden = false;
    };
  });
  montrer('evenement');
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
      suivre();
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
    ['Niveau atteint', exp.niveau],
    ['Dons', exp.dons.length ? exp.dons.map((id) => DONS_PAR_ID[id]?.glyphe || '').join(' ') : '—'],
    ['Chance', exp.chance],
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
  $('b-progres').onclick = suivre;
  $('b-issue').onclick = suivre;
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
