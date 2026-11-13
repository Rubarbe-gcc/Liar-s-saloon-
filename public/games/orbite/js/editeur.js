// ORBITE NOIRE — l'éditeur de cartes. Une carte = { nom, base, mines, centre, relais, rc } (comme MAPS dans le moteur) :
// on place la base, les Prismes et les Relais d'UN camp ; le camp d'en face est le miroir (47 - x, 47 - y).
// Les éléments « du centre » ne sont pas mis en miroir. Cartes gardées dans localStorage (orbite.cartes).
import { carteValide } from '../../../shared/orbite/moteur.js';

const N = 48, CASE = 10;
const OUTILS = [['base', '🏰 Base'], ['mines', '💎 Prismes'], ['centre', '💎 Prismes au centre'], ['relais', '⚡ Relais'], ['rc', '⚡ Relais au centre'], ['gomme', '🧽 Gomme']];
const MAX = { mines: 6, centre: 3, relais: 4, rc: 2 };
const mir = ([x, y]) => [47 - x, 47 - y];

export function creerEditeur({ $, lire, ecrire, jouer }) {
  let def = vierge(), outil = 'mines', courant = -1;
  function vierge() { return { nom: 'Ma carte', base: [6, 6], mines: [[10, 6], [6, 10]], centre: [[24, 24]], relais: [[14, 34]], rc: [] }; }
  const cartes = () => lire('orbite.cartes', []).filter(carteValide);

  function dessiner() {
    const cv = $('ed-cv'), c = cv.getContext('2d');
    c.fillStyle = '#5b5145'; c.fillRect(0, 0, N * CASE, N * CASE);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if ((i * 7 + j * 13) % 11 === 0) { c.fillStyle = '#665b4e'; c.fillRect(i * CASE, j * CASE, CASE, CASE); }
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let k = 0; k <= N; k += 4) { c.beginPath(); c.moveTo(k * CASE, 0); c.lineTo(k * CASE, N * CASE); c.moveTo(0, k * CASE); c.lineTo(N * CASE, k * CASE); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(N * CASE, 0); c.lineTo(0, N * CASE); c.stroke(); c.setLineDash([]);
    const rond = ([x, y], couleur, r, plein = true, faible = false) => { c.globalAlpha = faible ? .45 : 1; c.beginPath(); c.arc((x + .5) * CASE, (y + .5) * CASE, r, 0, 7); if (plein) { c.fillStyle = couleur; c.fill(); } else { c.strokeStyle = couleur; c.lineWidth = 3; c.stroke(); } c.globalAlpha = 1; };
    for (const [p, coul, faible] of [[def.base, '#4cc9f0', false], [mir(def.base), '#f25c54', true]]) { c.globalAlpha = faible ? .5 : 1; c.fillStyle = coul; c.fillRect((p[0] - 1.5) * CASE, (p[1] - 1.5) * CASE, 3 * CASE, 3 * CASE); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect((p[0] - 1.5) * CASE, (p[1] - 1.5) * CASE, 3 * CASE, 3 * CASE); c.globalAlpha = 1; c.beginPath(); c.arc((p[0] + .5) * CASE, (p[1] + .5) * CASE, 9 * CASE, 0, 7); c.strokeStyle = faible ? 'rgba(242,92,84,.25)' : 'rgba(76,201,240,.3)'; c.stroke(); }
    for (const p of def.mines) { rond(p, '#5fd0ff', 6); rond(mir(p), '#5fd0ff', 6, true, true); }
    for (const p of def.centre) rond(p, '#b79cff', 7);
    for (const p of def.relais) { rond(p, '#ffe36e', 7, false); rond(mir(p), '#ffe36e', 7, false, true); }
    for (const p of def.rc) rond(p, '#ffb060', 8, false);
    const ok = carteValide(def);
    $('ed-etat').innerHTML = `${def.mines.length * 2 + def.centre.length} mines de Prismes · ${def.relais.length * 2 + def.rc.length} Relais · ${ok ? '<b style="color:#7f7">carte jouable</b>' : '<b style="color:#f88">base trop près du centre, des bords, ou mine/Relais collé à la base</b>'}`;
    $('ed-jouer').disabled = $('ed-garder').disabled = !ok;
    for (const b of document.querySelectorAll('[data-a^="ed-outil:"]')) b.classList.toggle('actif', b.dataset.a === 'ed-outil:' + outil);
  }

  function liste() {
    const l = cartes();
    $('ed-liste').innerHTML = l.length ? l.map((d, i) => `<div class="ed-l"><span>${d.nom.replace(/[<>&]/g, '')}</span><button data-a="ed-ouvrir:${i}">Ouvrir</button><button data-a="ed-suppr:${i}">✕</button></div>`).join('') : '<small>Aucune carte enregistrée.</small>';
  }

  function clic(ev) {
    const r = ev.target.getBoundingClientRect(), x = Math.max(2, Math.min(45, Math.floor((ev.clientX - r.left) / r.width * N))), y = Math.max(2, Math.min(45, Math.floor((ev.clientY - r.top) / r.height * N)));
    if (outil === 'base') { // la base emmène ses Prismes et ses Relais
      const nb = [Math.max(3, Math.min(44, x)), Math.max(3, Math.min(44, y))], dx = nb[0] - def.base[0], dy = nb[1] - def.base[1], b = v => Math.max(2, Math.min(45, v));
      for (const k of ['mines', 'relais']) def[k] = def[k].map(([px, py]) => [b(px + dx), b(py + dy)]);
      def.base = nb;
    }
    else if (outil === 'gomme') {
      let best = null, bd = 2.5;
      for (const k of ['mines', 'centre', 'relais', 'rc']) def[k].forEach((p, i) => { for (const q of (k === 'mines' || k === 'relais') ? [p, mir(p)] : [p]) { const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = [k, i]; } } });
      if (best) def[best[0]].splice(best[1], 1);
    } else { if (def[outil].length >= MAX[outil]) def[outil].shift(); def[outil].push([x, y]); }
    dessiner();
  }

  function ouvrir() { $('ed-nom').value = def.nom; liste(); dessiner(); }
  function action(t, v) {
    if (t === 'ed-outil') { outil = v; dessiner(); }
    else if (t === 'ed-neuf') { def = vierge(); courant = -1; ouvrir(); }
    else if (t === 'ed-garder') { def.nom = ($('ed-nom').value || 'Ma carte').slice(0, 30); const l = cartes(); if (courant >= 0 && courant < l.length) l[courant] = def; else { l.push(def); courant = l.length - 1; } ecrire('orbite.cartes', l); liste(); }
    else if (t === 'ed-ouvrir') { def = JSON.parse(JSON.stringify(cartes()[+v])); courant = +v; ouvrir(); }
    else if (t === 'ed-suppr') { const l = cartes(); l.splice(+v, 1); ecrire('orbite.cartes', l); if (courant === +v) courant = -1; liste(); }
    else if (t === 'ed-code') { def.nom = ($('ed-nom').value || 'Ma carte').slice(0, 30); const code = btoa(unescape(encodeURIComponent(JSON.stringify(def)))); navigator.clipboard?.writeText(code).catch(() => {}); prompt('Code de la carte (copié) :', code); }
    else if (t === 'ed-coller') { const code = prompt('Collez le code d’une carte :'); if (!code) return; try { const d = JSON.parse(decodeURIComponent(escape(atob(code.trim())))); if (!carteValide(d)) throw 0; def = { nom: String(d.nom || 'Carte').slice(0, 30), base: d.base, mines: d.mines, centre: d.centre || [], relais: d.relais || [], rc: d.rc || [] }; courant = -1; ouvrir(); } catch { alert('Code invalide.'); } }
    else if (t === 'ed-jouer') { def.nom = ($('ed-nom').value || 'Ma carte').slice(0, 30); jouer(JSON.parse(JSON.stringify(def))); }
    else return false;
    return true;
  }

  $('ed-cv').addEventListener('click', clic);
  return { ouvrir, action, cartes };
}
