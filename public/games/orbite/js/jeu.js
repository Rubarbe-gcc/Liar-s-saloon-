import { W, H, UN, BA, FA, UPG, creer, step, cmd, ia, jouerTour, hash } from '../../../shared/orbite/moteur.js';
import { MISSIONS, etat } from '../../../shared/orbite/campagne.js';
import { Reseau } from './reseau.js';
import { creerRendu } from './rendu3d.js';
import { SERVEUR_JEUX } from '../../../shared/serveur.js';
// En local : le serveur de dev ; en ligne : le serveur de jeux de l'arcade (Render), chemin /orbite.
const adresseEnLigne = () => (['localhost', '127.0.0.1'].includes(location.hostname) || !SERVEUR_JEUX)
  ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/orbite'
  : SERVEUR_JEUX.replace(/^http/, 'ws').replace(/\/+$/, '') + '/orbite';
const THREE = globalThis.THREE || await import('../../../vendor/three/three.module.min.js');

const $ = id => document.getElementById(id);
const rendu = creerRendu(THREE, $('vue3d'), { W, H, UN, BA }), cv = rendu.canvas, mini2 = $('mini'), gm = mini2.getContext('2d');
const COL = ['#4cc9f0', '#f25c54', '#d6a84a'], NOMF = { fer: 'Ligue de Fer', bosquet: 'Bosquet', echos: 'Échos' };
const lire = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch { return d; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein ou refusé */ } };

let s = null, ME = 0, mode = '', cfg = null, mission = null, log = [], pause = false, vit = 1, net = null, tours = [], rejeu = null, termine = false;
let obj = '', msg = '', msgT = 0, sel = [], place = null, drag = null, mp = { x: -1, y: -1 }, K = {}, sigC = '', groupes = {}, snap = new Map(), salleMax = 2, hote = false, ciblage = false, cartes = [];
const MS = 180; // taille de la minicarte

// ---------- son ----------
let ac = null, muet = lire('orbite.muet', false); const dernier = {};
function son(t) {
  if (muet) return; const n = performance.now(); if (dernier[t] && n - dernier[t] < 120) return; dernier[t] = n;
  const P = { clic: [520, .05, 'sine'], ordre: [380, .06, 'triangle'], pret: [880, .14, 'sine'], alerte: [260, .2, 'square'], mort: [110, .18, 'sawtooth'], fin: [660, .5, 'triangle'] }[t]; if (!P) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), v = ac.createGain();
    o.type = P[2]; o.frequency.value = P[0]; v.gain.setValueAtTime(.08, ac.currentTime); v.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + P[1]);
    o.connect(v); v.connect(ac.destination); o.start(); o.stop(ac.currentTime + P[1]);
  } catch { /* pas d'audio */ }
}
function majSon() { $('m-son').textContent = 'Son : ' + (muet ? 'non' : 'oui'); $('b-son').textContent = muet ? '🔇' : '🔊'; ecrire('orbite.muet', muet); }

// ---------- écrans ----------
const ECR = ['principal', 'escarmouche', 'campagne', 'ligne', 'brief', 'fin'];
function ecran(n) { for (const e of ECR) $('e-' + e).style.display = e === n ? 'flex' : 'none'; $('menu').style.display = n ? 'flex' : 'none'; $('jeu').style.display = 'block'; $('jeu').classList.toggle('demo', !!n && !s); rs(); }
function menuCampagne() {
  const fait = lire('orbite.camp', 0); $('camp-liste').innerHTML = MISSIONS.map(m =>
    `<button data-a="mission:${m.id}" ${m.id > fait + 1 ? 'disabled' : ''}>${m.id}. ${m.titre} — ${NOMF[m.f]} ${m.id <= fait ? '✔' : ''}</button>`).join('');
  ecran('campagne');
}
const graineAlea = () => (Math.random() * 2 ** 31) | 0;
function lancer(c) {
  cfg = c; mode = c.mode; mission = c.mission || null; ME = c.eq || 0; log = []; tours = []; pause = false; vit = 1; termine = false; sel = []; place = null; groupes = {}; snap = new Map(); msg = ''; obj = '';
  s = creer(c.graine, c.f0, c.f1, c.carte, c.n0 || 2, c.n1 || 2, c.opt || {}); rejeu = c.rejeu ? { ...c.rejeu, i: 0 } : null;
  demo = null; rendu.menu(false); ecran(null); $('b-vit').textContent = '×1'; $('b-pause').textContent = '⏸'; ciblage = false; sigC = '';
  rendu.init(s); document.body.dataset.fac = s.fac[ME]; const q = s.ent.find(e => BA[e.k] && BA[e.k].qg && e.eq === ME); rendu.centrer(q.x / 1000, q.y / 1000);
}
function config() { return { graine: cfg.graine, f0: cfg.f0, f1: cfg.f1, carte: cfg.carte, n0: cfg.n0, n1: cfg.n1, opt: cfg.opt }; }
function finir(res) {
  termine = true; son('fin');
  const gagne = res === 'gagne', camp = mode === 'camp';
  if (mode !== 'ligne') ecrire('orbite.rejeu', { cfg: config(), ordres: log, ticks: s.tick });
  if (camp && gagne) ecrire('orbite.camp', Math.max(lire('orbite.camp', 0), mission.id));
  if (mode === 'ligne' && net) net.fin();
  $('fin-t').textContent = gagne ? 'VICTOIRE' : 'DÉFAITE'; $('fin-t').style.color = gagne ? '#7f7' : '#f66';
  $('fin-x').textContent = camp ? `Mission ${mission.id} — ${mission.titre}` : `Durée : ${Math.floor(s.tick / 1200)} min ${Math.floor(s.tick / 20) % 60} s`;
  const B = []; if (mode !== 'ligne') B.push(['rejouer', 'Rejouer']);
  if (camp && gagne && mission.id < MISSIONS.length) B.push(['suivante', 'Mission suivante']);
  if (mode !== 'ligne') B.push(['rejeu', 'Revoir'], ['dl', 'Télécharger le rejeu']); B.push(['menu', 'Menu']);
  $('fin-b').innerHTML = B.map(([a, t]) => `<button data-a="${a}">${t}</button>`).join(''); ecran('fin'); $('jeu').style.display = 'block';
}
function quitter() { if (net) { net.fermer(); net = null; } s = null; ecran('principal'); }
function telecharger() {
  const d = lire('orbite.rejeu', null); if (!d) return;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = 'orbite-rejeu.json'; a.click();
}
function stat(t) { $('lstat').textContent = t; }
function connecter(apres) {
  if (net) net.fermer(); const url = $('lw').value.trim(); ecrire('orbite.ws', url); stat('Connexion…');
  net = new Reseau(url, {
    onopen: apres,
    onsalle: m => { salleMax = m.mode === '2v2' ? 4 : 2; stat(`Salle ${m.code} (${m.mode}) — ${m.joueurs.map(j => `${j.nom} [équipe ${j.eq + 1}, ${NOMF[j.f]}]`).join(' · ')} — ${m.joueurs.length}/${salleMax}`); $('l-go').disabled = !(hote && m.joueurs.length === salleMax); },
    onstart: m => lancer({ mode: 'ligne', graine: m.graine, f0: m.f[0], f1: m.f[1], carte: m.carte, eq: m.eq }),
    ontour: m => tours.push(m),
    ondesync: m => { msg = `⚠ Désynchronisation au tour ${m.n}`; msgT = performance.now() + 10000; },
    ondepart: m => { msg = `${m.nom} a quitté la partie`; msgT = performance.now() + 6000; },
    onerreur: t => stat(t), onclose: () => { if (mode === 'ligne' && s && !termine) { msg = 'Connexion perdue'; msgT = performance.now() + 9999999; } },
  });
}

document.getElementById('menu').addEventListener('click', ev => {
  const a = ev.target.dataset && ev.target.dataset.a; if (!a) return; const [t, v] = a.split(':');
  if (t === 'go') { if (v === 'campagne') menuCampagne(); else { if (v === 'ligne') $('lw').value = lire('orbite.ws', adresseEnLigne()); ecran(v); } }
  else if (t === 'jouer') lancer({ mode: 'solo', graine: graineAlea(), f0: $('sf').value, f1: $('se').value, carte: +$('sc').value, n0: 2, n1: +$('sn').value });
  else if (t === 'mission') { const m = MISSIONS[+v - 1]; mission = m; $('brief-t').textContent = `${m.id}. ${m.titre}`; $('brief-x').textContent = m.texte; $('brief-o').textContent = `${NOMF[m.f]} contre ${NOMF[m.e]} — IA niveau ${m.niv}`; ecran('brief'); }
  else if (t === 'commencer') lancer({ mode: 'camp', graine: graineAlea(), f0: mission.f, f1: mission.e, carte: mission.carte, n0: 2, n1: mission.niv, opt: mission.opt, mission });
  else if (t === 'suivante') { mission = MISSIONS[mission.id]; $('brief-t').textContent = `${mission.id}. ${mission.titre}`; $('brief-x').textContent = mission.texte; $('brief-o').textContent = `${NOMF[mission.f]} contre ${NOMF[mission.e]} — IA niveau ${mission.niv}`; ecran('brief'); }
  else if (t === 'rejouer') lancer({ ...cfg, graine: graineAlea() });
  else if (t === 'rejeu') { const d = lire('orbite.rejeu', null); if (d) lancer({ ...d.cfg, mode: 'rejeu', mission: null, rejeu: { ordres: d.ordres, ticks: d.ticks, ia: true } }); }
  else if (t === 'dl') telecharger();
  else if (t === 'menu') quitter();
  else if (t === 'muet') { muet = !muet; majSon(); }
  else if (t === 'creer') { hote = true; connecter(() => net.creer($('lm').value, $('lf').value, $('ln').value, +$('lc').value)); }
  else if (t === 'rejoindre') { hote = false; connecter(() => net.rejoindre($('lcode').value, $('lf').value, $('ln').value)); }
  else if (t === 'demarrer' && net) net.demarrer();
  else if (t === 'quitter-ligne') { if (net) { net.fermer(); net = null; } ecran('principal'); }
});

// ---------- ordres ----------
function ordre(ids, c) {
  if (!ids.length || !s || mode === 'rejeu' || termine) return;
  if (mode === 'ligne') net.ordre(ids, c); else { cmd(s, ME, ids, c); log.push([s.tick, ME, ids, c]); }
  son('ordre');
}
const rs = () => { rendu.resize(); };
onresize = rs;
const VOIR = location.hostname === 'localhost' && new URLSearchParams(location.search).has('voir'); // ?voir : tout voir (essais en local)
const tout = () => mode === 'rejeu' || VOIR;
const vis = (x, y) => tout() ? 2 : s.vis[ME][Math.min(H - 1, Math.max(0, (y / 1000) | 0)) * W + Math.min(W - 1, Math.max(0, (x / 1000) | 0))];
const mine = () => sel.map(i => s.ent.find(e => e.id === i && e.pv > 0)).filter(Boolean);
const estOuv = e => UN[e.k] && UN[e.k].ouv;
const proj = e => rendu.proj(e.x, e.y, BA[e.k] ? 1 : .6);

// ---------- interface (panneaux façon STR) ----------
const ICO = { ouvrier: '🔧', fantassin: '🪖', tireur: '🎯', blinde: '🚜', marechal: '⭐', semeur: '🌱', rejeton: '🐛', epine: '🌵', colosse: '🦣', ancien: '🌳', tisseur: '🕸️', eclat: '💎', pulse: '🔮', sentinelle: '🗿', oracle: '👁️', gardien: '👾',
  noyau: '🏭', caserne: '🏛️', atelier: '⚙️', tour: '🗼', coeur: '🌿', ruche: '🐝', serre: '🏡', ronce: '🌹', nexus: '🔷', foyer: '🔥', forge: '🔨', phare: '💡', att: '⚔️', arm: '🛡️', rec: '⛏️' };
const NOM = { ouvrier: 'Ouvrier', fantassin: 'Fantassin', tireur: 'Tireur', blinde: 'Blindé', marechal: 'Maréchal', semeur: 'Semeur', rejeton: 'Rejeton', epine: 'Épine', colosse: 'Colosse', ancien: 'Ancien', tisseur: 'Tisseur', eclat: 'Éclat', pulse: 'Pulse', sentinelle: 'Sentinelle', oracle: 'Oracle', gardien: 'Gardien',
  noyau: 'Noyau', caserne: 'Caserne', atelier: 'Atelier', tour: 'Tour', coeur: 'Cœur', ruche: 'Ruche', serre: 'Serre', ronce: 'Ronce', nexus: 'Nexus', foyer: 'Foyer', forge: 'Forge', phare: 'Phare' };
const CSSC = ['#4cc9f0', '#f25c54', '#d6a84a'], KEYS = 'qweasdzxc';
const img = (k, eq = ME) => { try { return `<img src="${rendu.portrait(k, eq)}" alt="">`; } catch (err) { return ICO[k] || '?'; } }; // portrait 3D (repli : emoji)
function fabriquerCartes() {
  const o = mine(), L = []; if (!o.length) return L;
  const ouv = o.some(estOuv), b0 = o.find(e => BA[e.k] && BA[e.k].prod && !e.cons), qg = o.find(e => BA[e.k] && BA[e.k].qg), ch = o.find(e => UN[e.k] && UN[e.k].ch), unites = o.filter(e => !BA[e.k]);
  if (ouv) for (const b of FA[s.fac[ME]].bat) L.push({ ic: img(b), lb: NOM[b], co: BA[b].cout, ok: s.pr[ME] >= BA[b].cout, act: () => { place = b; ciblage = false; } });
  if (b0) for (const u of BA[b0.k].prod) L.push({ ic: img(u), lb: NOM[u], co: UN[u].cout + (UN[u].en ? '+' + UN[u].en + '⚡' : ''), ok: s.pr[ME] >= UN[u].cout && (!UN[u].en || s.en[ME] >= UN[u].en) && !(UN[u].ch && s.ent.some(x => x.eq === ME && (x.k === u || x.file.includes(u)))), act: () => ordre(o.filter(e => BA[e.k] && BA[e.k].prod && !e.cons).map(e => e.id), { t: 'prod', k: u }) });
  if (qg) for (const u of Object.keys(UPG)) { const l = s.up[ME][u]; L.push({ ic: ICO[u], lb: `${UPG[u].nom} ${l}/3`, co: l < 3 ? `${UPG[u].pr * (l + 1)}+${UPG[u].en * (l + 1)}⚡` : 'max', ok: l < 3 && s.pr[ME] >= UPG[u].pr * (l + 1) && s.en[ME] >= UPG[u].en * (l + 1), act: () => ordre([qg.id], { t: 'up', k: u }) }); }
  if (unites.length && !ouv) L.push({ ic: '⚔️', lb: 'Attaquer', co: 'clic', ok: true, act: () => { ciblage = true; place = null; } });
  if (unites.length) L.push({ ic: '⏹', lb: 'Stop', co: '', ok: true, act: () => ordre(unites.map(e => e.id), { t: 'stop' }) });
  if (ch) L.push({ ic: '✨', lb: ch.pc ? Math.ceil(ch.pc / 20) + ' s' : 'Pouvoir', co: '', ok: !ch.pc, act: () => pouvoirUI() });
  return L.slice(0, 9);
}
const pouvoirUI = () => ordre(mine().filter(e => UN[e.k] && UN[e.k].ch).map(e => e.id), { t: 'pouv' });
function majCartes() {
  cartes = fabriquerCartes(); const k = sel.join(',') + '|' + cartes.map(c => c.lb + c.ok).join(',') + '|' + (ciblage ? 1 : 0) + (place || '');
  if (k === sigC) return; sigC = k;
  $('cmd').innerHTML = Array.from({ length: 9 }, (_, i) => { const c = cartes[i]; return c ? `<button data-i="${i}" ${c.ok ? '' : 'disabled'}><span class="ic">${c.ic}</span><span class="lb">${c.lb}</span><span class="co">${c.co}</span><span class="ky">${KEYS[i].toUpperCase()}</span></button>` : '<button class="vide" disabled></button>'; }).join('');
}
$('cmd').onclick = ev => { const b = ev.target.closest('button'); if (b && b.dataset.i !== undefined && cartes[+b.dataset.i] && cartes[+b.dataset.i].ok) cartes[+b.dataset.i].act(); };
const barre = (p, c, t) => `<div class="barre"><i style="width:${Math.max(0, Math.min(100, p))}%;background:${c}"></i><span>${t}</span></div>`;
let fi = 0, derInfo = '';
function majInfo() {
  const o = mine(); let h = '';
  if (o.length === 1) {
    const e = o[0], d = UN[e.k] || BA[e.k], isB = !!BA[e.k];
    h = `<div class="portrait" style="border-color:${CSSC[e.eq]}">${img(e.k, e.eq)}</div><div class="fiche"><b>${NOM[e.k] || e.k}</b> <small>${NOMF[s.fac[e.eq]] || ''}</small>` + barre(e.pv / e.max * 100, e.pv / e.max > .5 ? '#3fe06a' : e.pv / e.max > .25 ? '#e6c23a' : '#e84a3a', `${Math.ceil(e.pv)} / ${e.max}`) + (e.bm ? barre(e.bc / e.bm * 100, '#58d8ff', `Bouclier ${e.bc} / ${e.bm}`) : '')
      + `<div class="stats">${d.deg ? `⚔ ${Math.floor(d.deg * (10 + s.up[ME].att) / 10)}` : ''} ${d.pt ? `🎯 ${(d.pt / 1000).toFixed(1)}` : ''} ${d.v ? `👟 ${(d.v / 20 / 1000 * 1000 / 1000).toFixed(1)}` : ''}</div>`;
    if (e.cons) h += barre(100 - e.cons / BA[e.k].tc * 100, '#4cc9f0', 'Construction');
    else if (isB && e.file.length) h += `<div class="file">${e.file.map((k, i) => `<span>${img(k)}</span>`).join('')}</div>` + barre(e.prog / UN[e.file[0]].tp * 100, '#c9a24a', 'Production');
    h += '</div>';
  } else if (o.length > 1) h = '<div class="grille">' + o.slice(0, 24).map(e => `<div class="cel" style="border-color:${CSSC[e.eq]}"><span>${img(e.k, e.eq)}</span><i style="width:${e.pv / e.max * 100}%"></i></div>`).join('') + '</div>' + (o.length > 24 ? `<small>+${o.length - 24}</small>` : '');
  else h = '<div class="vide2">Clic gauche : sélectionner (cadre possible)<br>Clic droit : ordre · Molette : zoom · Flèches : caméra<br>Touches QWE/ASD/ZXC : commandes</div>';
  if (h !== derInfo) { $('info').innerHTML = h; derInfo = h; }
}
function majHud() {
  const nu = s.ent.filter(e => e.eq === ME && !BA[e.k]).length;
  $('r-pr').textContent = '💎 ' + s.pr[ME]; $('r-en').textContent = '⚡ ' + s.en[ME]; $('r-un').textContent = '👤 ' + nu;
  $('obj').textContent = obj ? (mission ? `Mission ${mission.id} — ` : '') + obj : '';
  let m = ''; if (pause) m = 'PAUSE'; else if (mode === 'rejeu') m = 'REJEU — vision totale'; else if (mode === 'ligne') m = `En ligne — équipe ${ME + 1} (${NOMF[s.fac[ME]]})`;
  if (msg && performance.now() < msgT) m = msg; $('msg').textContent = m; $('msg').style.display = m ? 'block' : 'none';
  rendu.canvas.style.cursor = place || ciblage ? 'crosshair' : 'default';
}

// ---------- souris / clavier ----------
cv.onmousedown = e => {
  if (!s || termine) return;
  if (e.button === 2) { ciblage = false; place = null; return; }
  if (e.button !== 0) return;
  if (place) { const p = rendu.sol(e.offsetX, e.offsetY); if (p) ordre(sel, { t: 'bat', k: place, x: Math.round(p.x / 1000) * 1000, y: Math.round(p.y / 1000) * 1000 }); place = null; return; }
  if (ciblage) { const p = rendu.sol(e.offsetX, e.offsetY); if (p) ordre(sel, { t: 'am', x: p.x, y: p.y }); ciblage = false; return; }
  drag = { x: e.offsetX, y: e.offsetY };
};
cv.onmouseup = e => {
  if (!s || e.button !== 0 || !drag) return;
  const a = drag, b = { x: e.offsetX, y: e.offsetY }; drag = null; $('cadre').style.display = 'none';
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), small = x1 - x0 < 6 && y1 - y0 < 6;
  const mes = s.ent.filter(en => en.eq === ME && en.pv > 0); let r;
  if (small) { let best = null, bd = 1e9; for (const en of mes) { const p = proj(en), d = Math.hypot(p.x - b.x, p.y - b.y), rad = BA[en.k] ? 70 : 28; if (d < rad && d < bd) { bd = d; best = en; } } r = best ? [best] : []; }
  else r = mes.filter(en => { const p = proj(en); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; });
  const u = r.filter(en => !BA[en.k]); sel = (u.length ? u : r.slice(0, 1)).map(en => en.id); if (sel.length) son('clic');
};
cv.oncontextmenu = e => {
  e.preventDefault(); if (!s || !mine().length || termine) return;
  const p = rendu.sol(e.offsetX, e.offsetY); if (!p) return; const X = p.x, Y = p.y;
  const en = s.ent.find(o => o.eq !== ME && o.pv > 0 && vis(o.x, o.y) === 2 && Math.hypot(o.x - X, o.y - Y) < (BA[o.k] ? 1500 : 700));
  if (en) return ordre(sel, { t: 'att', c: en.id });
  const mi = s.mines.findIndex(m => vis(m.x, m.y) > 0 && Math.hypot(m.x - X, m.y - Y) < 1300);
  if (mi >= 0) return ordre(mine().filter(estOuv).map(o => o.id), { t: 'rec', m: mi });
  ordre(sel, { t: 'move', x: Math.max(500, Math.min(W * 1000 - 500, X)), y: Math.max(500, Math.min(H * 1000 - 500, Y)) });
};
cv.onmousemove = e => { mp = { x: e.offsetX, y: e.offsetY }; if (drag) { const c = $('cadre'); c.style.display = 'block'; const r = cv.getBoundingClientRect(); c.style.left = r.left + Math.min(drag.x, mp.x) + 'px'; c.style.top = r.top + Math.min(drag.y, mp.y) + 'px'; c.style.width = Math.abs(mp.x - drag.x) + 'px'; c.style.height = Math.abs(mp.y - drag.y) + 'px'; } };
cv.onmouseleave = () => { mp = { x: -1, y: -1 }; };
cv.onwheel = e => { e.preventDefault(); rendu.zoom(e.deltaY > 0 ? 1.08 : .92); };
const centreMini = e => { const x = e.offsetX / MS * W, y = e.offsetY / MS * H; rendu.centrer(x, y); };
mini2.onmousedown = e => { if (!s) return; if (e.button === 0) { centreMini(e); mini2.dragging = true; } };
mini2.onmousemove = e => { if (mini2.dragging && s) centreMini(e); };
mini2.onmouseup = mini2.onmouseleave = () => { mini2.dragging = false; };
mini2.oncontextmenu = e => { e.preventDefault(); if (s) ordre(sel, { t: 'move', x: e.offsetX / MS * W * 1000, y: e.offsetY / MS * H * 1000 }); };
function basculePause() { if (!s || termine) return; pause = !pause; $('b-pause').textContent = pause ? '▶' : '⏸'; }
function basculeVit() { if (mode === 'ligne') return; vit = vit === 1 ? 2 : vit === 2 ? 4 : 1; $('b-vit').textContent = '×' + vit; }
$('b-pause').onclick = () => { if (mode !== 'ligne') basculePause(); };
$('b-vit').onclick = basculeVit;
$('b-son').onclick = () => { muet = !muet; majSon(); };
$('b-menu').onclick = () => { if (!s) return; if (termine || confirm('Quitter la partie ?')) quitter(); };
onkeydown = e => {
  const k = e.key.toLowerCase(); K[k] = 1; if (!s || e.target.tagName === 'INPUT') return;
  if (k.startsWith('arrow')) e.preventDefault();
  if (k === 'escape') { place = null; ciblage = false; }
  else if (k === 'p' && mode !== 'ligne') basculePause();
  else if (k === 'f') basculeVit();
  else if (k === 'm') { muet = !muet; majSon(); }
  else if (k === 'h') { const q = s.ent.find(en => en.eq === ME && BA[en.k] && BA[en.k].qg); if (q) rendu.centrer(q.x / 1000, q.y / 1000); }
  else if (/^[1-9]$/.test(k)) { if (e.ctrlKey) { e.preventDefault(); groupes[k] = [...sel]; } else if (groupes[k]) { sel = [...groupes[k]]; son('clic'); } }
  else if (KEYS.includes(k) && !e.ctrlKey && !e.metaKey) { const c = cartes[KEYS.indexOf(k)]; if (c && c.ok) c.act(); }
};
onkeyup = e => { K[e.key.toLowerCase()] = 0; };

// ---------- affichage ----------
function sons() {
  const cur = new Map(); let pret = 0, alerte = 0, mort = 0;
  for (const e of s.ent) if (e.eq === ME) { cur.set(e.id, e.pv); const p = snap.get(e.id); if (p === undefined) { if (snap.size) pret++; } else if (e.pv < p) alerte++; }
  for (const id of snap.keys()) if (!cur.has(id)) mort++;
  snap = cur; if (alerte) son('alerte'); if (mort) son('mort'); else if (pret) son('pret');
}
function mini() {
  const c = MS / W, v = s.vis[ME], fond = rendu.carteMini(); gm.fillStyle = '#000'; gm.fillRect(0, 0, MS, MS); gm.imageSmoothingEnabled = true; if (fond) gm.drawImage(fond, 0, 0, MS, MS);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const t = tout() ? 2 : v[j * W + i]; if (t < 2) { gm.fillStyle = t ? 'rgba(0,0,0,.5)' : '#000'; gm.fillRect(i * c, j * c, c + .5, c + .5); } }
  for (const m of s.mines) if (vis(m.x, m.y) > 0 && m.q > 0) { gm.fillStyle = '#5fd0ff'; gm.fillRect(m.x / 1000 * c - 2, m.y / 1000 * c - 2, 4, 4); }
  for (const r of s.relais) if (vis(r.x, r.y) > 0) { gm.strokeStyle = r.own < 0 ? '#aaa' : CSSC[r.own]; gm.lineWidth = 2; gm.beginPath(); gm.arc(r.x / 1000 * c, r.y / 1000 * c, 4, 0, 7); gm.stroke(); }
  for (const e of s.ent) if (e.eq === ME || vis(e.x, e.y) === 2) { gm.fillStyle = CSSC[e.eq]; const z = BA[e.k] ? 5 : 3; gm.fillRect(e.x / 1000 * c - z / 2, e.y / 1000 * c - z / 2, z, z); }
  const P = rendu.coins(); gm.strokeStyle = '#fff'; gm.lineWidth = 1; gm.beginPath(); P.forEach(([x, y], i) => { const X = Math.max(0, Math.min(MS, x * c)), Y = Math.max(0, Math.min(MS, y * c)); i ? gm.lineTo(X, Y) : gm.moveTo(X, Y); }); gm.closePath(); gm.stroke();
}
function verif() {
  if (termine) return;
  if (mode === 'rejeu') { if (s.fin >= 0 || s.tick >= rejeu.ticks) { termine = true; $('fin-t').textContent = 'FIN DU REJEU'; $('fin-t').style.color = '#fff'; $('fin-x').textContent = ''; $('fin-b').innerHTML = '<button data-a="rejeu">Revoir</button><button data-a="menu">Menu</button>'; ecran('fin'); $('jeu').style.display = 'block'; } return; }
  const r = mission ? etat(s, mission) : { etat: s.fin === ME ? 'gagne' : s.fin >= 0 ? 'perdu' : 'cours', texte: 'Détruis la base ennemie' };
  obj = r.texte; if (r.etat !== 'cours') finir(r.etat);
}
function avancer() {
  if (mode === 'rejeu') { const o = rejeu.ordres; while (rejeu.i < o.length && o[rejeu.i][0] <= s.tick) { const [, eq, ids, c] = o[rejeu.i++]; cmd(s, eq, ids, c); } }
  ia(s, 1); step(s);
}
let demo = null, accD = 0;
function demoFrame(dt) { // fond de menu : bataille IA contre IA, caméra orbitale
  if (!demo || demo.fin >= 0) {
    const F = ['fer', 'bosquet', 'echos'], a = F[Math.random() * 3 | 0], b = F[Math.random() * 3 | 0];
    demo = creer(graineAlea(), a, b, 2, 3, 3, { pr: [2500, 2500], depart: [0, 1].flatMap(eq => [{ eq, role: 0, n: 6 }, { eq, role: 1, n: 4 }, { eq, role: 2, n: 3 }]) });
    rendu.init(demo); rendu.menu(true);
  }
  accD += Math.min(dt, 100); while (accD >= 50) { ia(demo, 0); ia(demo, 1); step(demo); accD -= 50; }
  const A = demo.ent.filter(e => !BA[e.k] && e.eq < 2 && UN[e.k].deg), n = A.length || 1, cx = A.reduce((a, e) => a + e.x, 0) / n / 1000 || 24, cz = A.reduce((a, e) => a + e.y, 0) / n / 1000 || 24;
  rendu.suivre(cx, cz); rendu.maj(demo, { ME: 0, sel: [], tout: true });
}
let last = performance.now(), acc = 0;
function boucle(t) {
  const dt = Math.min(t - last, 200); last = t;
  if (s && ($('menu').style.display !== 'flex' || termine)) {
    if (!pause && !termine) {
      if (mode === 'ligne') { for (let n = 0; n < 4 && tours.length; n++) { const tr = tours.shift(); jouerTour(s, tr.ordres); if (tr.n % 20 === 0) net.hash(tr.n, hash(s)); } }
      else { acc += dt * vit; while (acc >= 50 && !termine) { avancer(); acc -= 50; if (s.fin >= 0 || (mission && s.tick % 20 === 0)) verif(); } }
      verif(); sons();
    }
    const sp = 24 * dt / 1000 * (K.shift ? 2 : 1), w = cv.clientWidth, h = cv.clientHeight; let dx = 0, dz = 0;
    if (K.arrowleft || (mp.x >= 0 && mp.x < 6)) dx -= sp; if (K.arrowright || (mp.x > w - 6)) dx += sp;
    if (K.arrowup || (mp.y >= 0 && mp.y < 6)) dz -= sp; if (K.arrowdown || (mp.y > h - 6)) dz += sp;
    if (dx || dz) rendu.deplacer(dx, dz);
    sel = mine().map(e => e.id); majCartes(); if ((fi++ & 3) === 0) { majInfo(); mini(); } majHud();
    rendu.maj(s, { ME, sel, place, tout: tout(), souris: place ? mp : null });
  } else if (!s) demoFrame(dt);
  requestAnimationFrame(boucle);
}
majSon(); ecran('principal'); requestAnimationFrame(boucle);
{ const q = new URLSearchParams(location.search).get('q'); if (q === 'bas') rendu.qualite(1); } // ?q=bas : qualité réduite (machines lentes, tests)
globalThis.orbite = { lancer, boucle, MISSIONS, etat: () => ({ s, mode, termine, sel }), rendu, ordre, cmd }; // accès console / tests
