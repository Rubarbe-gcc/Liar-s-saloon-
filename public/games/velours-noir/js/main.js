/**
 * LE VELOURS NOIR — le hall, la caisse, la navigation entre les tables.
 *
 * Les tables (blackjack.js, roulette.js, poker.js) reçoivent `app` : la
 * caisse (débiter, créditer), les succès, les statistiques, et le retour
 * au hall.
 */

import * as K from '../../../shared/casino/banque.js';
import * as succes from '../../../shared/succes.js';
import { installerMusique } from '../../../shared/musique.js';
import * as sfx from './sfx.js';
import * as fx from './effets.js';
import { monterBlackjack } from './blackjack.js';
import { monterRoulette } from './roulette.js';
import { monterPoker } from './poker.js';

const $ = (id) => document.getElementById(id);
const CLE_MUSIQUE = 'velours.musique';
const CLE_NUAGE_MAJ = 'velours.nuage.maj';

succes.visiter('velours');

/* ------------------------------------------------------------------ */
/* La caisse                                                           */
/* ------------------------------------------------------------------ */

let banque = K.lire(localStorage);

function afficherSolde(anime = true) {
  for (const el of document.querySelectorAll('[data-solde]')) {
    if (anime && el.offsetParent) fx.compter(el, banque.solde);
    else { el.dataset.n = banque.solde; el.textContent = fx.nombre(banque.solde); }
  }
  majCaisse();
}

function sauver() {
  K.ecrire(localStorage, banque);
  try { localStorage.setItem(CLE_NUAGE_MAJ, String(Date.now())); } catch { /* ignore */ }
  planifierNuage();
}

const app = {
  solde: () => banque.solde,
  debiter(n) {
    n = Math.floor(n);
    if (!(n > 0) || n > banque.solde) return false;
    banque.solde -= n;
    sauver(); afficherSolde();
    return true;
  },
  crediter(n) {
    n = Math.floor(n);
    if (!(n > 0)) return;
    banque.solde += n;
    sauver(); afficherSolde();
  },
  /** Un gain net (pour le record du plus gros gain). */
  gainNet(n) {
    if (n > banque.records.gain) { banque.records.gain = n; sauver(); }
    if (banque.solde >= 10000) succes.debloquer('velours-flambeur');
  },
  stat(k, n = 1) { banque.stats[k] = (banque.stats[k] || 0) + n; sauver(); },
  succes: (id) => succes.debloquer(id),
  hall: () => aller('s-hall'),
};

function majCaisse() {
  const bonus = K.bonusDispo(banque);
  $('b-bonus').hidden = !bonus;
  $('b-secours').hidden = !K.secoursDispo(banque);
  const r = banque.records;
  $('h-records').textContent = r.solde > K.DEPART || r.gain ? `Record de caisse : ${fx.nombre(r.solde)} · Plus gros gain : ${fx.nombre(r.gain)}` : '';
}

$('b-bonus').addEventListener('click', (e) => {
  const n = K.prendreBonus(banque);
  if (!n) return;
  sauver(); afficherSolde();
  sfx.gain(true);
  fx.eclats(e.currentTarget, 36);
  fx.texte(`+${n}`, e.currentTarget, 'gros');
});
$('b-secours').addEventListener('click', (e) => {
  const n = K.prendreSecours(banque);
  if (!n) return;
  sauver(); afficherSolde();
  sfx.jetons(8);
  fx.texte(`+${n}`, e.currentTarget);
});

/* ------------------------------------------------------------------ */
/* La sauvegarde en ligne (le code de profil de l'arcade)              */
/* ------------------------------------------------------------------ */

let nuageT = 0, nuageEnCours = null;
function planifierNuage() { clearTimeout(nuageT); nuageT = setTimeout(synchroniserNuage, 2500); }
async function appeler(url, options) {
  try {
    const r = await fetch(url, { cache: 'no-store', ...options });
    let json = null;
    try { json = await r.json(); } catch { /* vide */ }
    return { ok: r.ok, statut: r.status, json };
  } catch { return { ok: false, statut: 0, json: null }; }
}
function synchroniserNuage() {
  if (nuageEnCours || !/^https?:$/.test(location.protocol)) return nuageEnCours;
  nuageEnCours = (async () => {
    const code = succes.codeProfil();
    const r = await appeler(`/api/sauvegarde?espace=velours&cle=${code}`);
    if (!r.ok && r.statut !== 404) return;
    let distant = null;
    if (r.ok && typeof r.json?.charge === 'string') { try { distant = JSON.parse(r.json.charge); } catch { /* illisible */ } }
    const tout = distant ? K.fusionner(banque, distant) : banque;
    if (!K.memes(tout, banque)) {
      banque = K.propre(tout);
      try { localStorage.setItem(K.CLE, JSON.stringify(banque)); } catch { /* ignore */ }
      afficherSolde(false);
    }
    if (!distant || !K.memes(tout, distant)) {
      const date = Math.max(Date.now(), (Number(r.json?.date) || 0) + 1);
      await appeler('/api/sauvegarde', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ espace: 'velours', cle: code, charge: JSON.stringify(banque), date }) });
    }
  })().finally(() => { nuageEnCours = null; });
  return nuageEnCours;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

const tables = {};
let courant = 's-hall';

async function aller(id) {
  if (id === courant) return;
  const r = $('rideau');
  r.classList.remove('ferme'); void r.offsetWidth; r.classList.add('ferme');
  await fx.attendre(260);
  tables[courant]?.sortir?.();
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id));
  courant = id;
  afficherSolde(false);
  sfx.ambiance(id !== 's-hall');
  tables[id]?.entrer?.();
}

document.querySelectorAll('.porte').forEach((p) => p.addEventListener('click', () => {
  sfx.clic();
  aller(`s-${p.dataset.jeu}`);
}));
document.querySelectorAll('[data-hall]').forEach((b) => b.addEventListener('click', () => aller('s-hall')));

/* fenêtres */
document.querySelectorAll('[data-ouvre]').forEach((b) => b.addEventListener('click', () => { $(b.dataset.ouvre).hidden = false; sfx.clic(); }));
document.querySelectorAll('.ov').forEach((ov) => {
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-ferme]')) ov.hidden = true; });
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.ov:not([hidden])').forEach((o) => { o.hidden = true; }); });
document.querySelectorAll('.onglet').forEach((o) => o.addEventListener('click', () => {
  document.querySelectorAll('.onglet').forEach((x) => x.classList.toggle('is-on', x === o));
  document.querySelectorAll('.texte-regles').forEach((t) => { t.hidden = t.id !== o.dataset.onglet; });
}));

/* réglages */
let musique = (() => { try { return localStorage.getItem(CLE_MUSIQUE) !== '0'; } catch { return true; } })();
$('r-son').checked = sfx.sonActif();
$('r-voix').checked = sfx.voixActive();
$('r-musique').checked = musique;
$('r-son').addEventListener('change', () => { sfx.basculerSon(); });
$('r-voix').addEventListener('change', () => { sfx.basculerVoix(); });
$('r-musique').addEventListener('change', (e) => { musique = e.target.checked; try { localStorage.setItem(CLE_MUSIQUE, musique ? '1' : '0'); } catch { /* ignore */ } });
$('r-nuage').textContent = `☁️ Vos jetons sont sauvegardés avec votre profil de l’arcade (code ${succes.joliCode(succes.codeProfil())}).`;
installerMusique('velours', { actif: () => sfx.sonActif() && musique });

/* ------------------------------------------------------------------ */
/* Les tables                                                          */
/* ------------------------------------------------------------------ */

tables['s-blackjack'] = monterBlackjack(app);
tables['s-roulette'] = monterRoulette(app);
tables['s-poker'] = monterPoker(app, aller);

afficherSolde(false);
synchroniserNuage();
addEventListener('storage', (e) => { if (e.key === K.CLE) { banque = K.lire(localStorage); afficherSolde(false); } });

/* outils de débogage */
window.__velours = { app, banque: () => banque, aller, tables };
