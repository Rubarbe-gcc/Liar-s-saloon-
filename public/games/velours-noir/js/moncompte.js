/**
 * LE VELOURS NOIR — « Mon compte » : le compte en banque fictif du joueur.
 *
 * Le relevé (solde, RIB, courbe des 30 derniers jours, opérations jour par
 * jour), la date d'anniversaire, et le récapitulatif qui s'ouvre quand de
 * nouveaux jours ont été joués (« Aujourd'hui sur ton compte » ou
 * « Pendant ton absence… »).
 */

import * as C from '../../../shared/casino/compte.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const JOURS = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dateLongue = (j) => { const [a, m, d] = j.split('-').map(Number); const s = JOURS.format(new Date(a, m - 1, d, 12)); return s.charAt(0).toUpperCase() + s.slice(1); };

const ICONES = {
  salaire: '💼', loyer: '🏠', frais: '🏦', anniv: '🎂', carte: '💳', casino: '🎰', courses: '🛒', boulangerie: '🥐', essence: '⛽', resto: '🍕', kebab: '🌯',
  transport: '🚇', abonnement: '📺', electricite: '💡', internet: '📶', pharmacie: '💊', vetements: '👕', cinema: '🎬', 'cadeau-ami': '🎁', amende: '🚓',
  chat: '🐈', reparation: '🔧', remboursement: '🩺', vente: '📦', pourboire: '🪙', cashback: '💸', mamie: '👵', freelance: '🧰', trouve: '🍀', prime: '⭐',
  assurance: '🛡️', mobile: '📱', streaming: '📺', musique: '🎵', sport: '🏋️', jeu: '🎟️', loto: '🎰', heritage: '📜', impots: '🏛️', augmentation: '📈', velo: '🚲', chaudiere: '🔥', dentiste: '🦷',
};
const icone = (k) => ICONES[k] || '•';

export function monterCompte(app) {
  const c = () => app.compte();

  function majBouton() {
    const s = c().solde;
    const b = $('b-compte-solde');
    b.textContent = C.euros(s);
    b.classList.toggle('rouge', s < 0);
  }

  /** La courbe du solde, en SVG. */
  function courbe() {
    const pts = c().courbe;
    if (pts.length < 2) return '<p class="note">La courbe se dessinera au fil des jours.</p>';
    const W = 300, H = 90;
    const vals = pts.map((p) => p.s);
    const min = Math.min(0, ...vals), max = Math.max(...vals, 1);
    const x = (k) => (k / (pts.length - 1)) * W;
    const y = (v) => H - ((v - min) / (max - min || 1)) * (H - 8) - 4;
    const ligne = pts.map((p, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(p.s).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" class="courbe" role="img" aria-label="Solde sur ${pts.length} jours">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b45a" stop-opacity=".45"/><stop offset="1" stop-color="#d9b45a" stop-opacity="0"/></linearGradient></defs>
      ${min < 0 ? `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="zero"/>` : ''}
      <path d="${ligne} L${W} ${H} L0 ${H} Z" fill="url(#cg)"/>
      <path d="${ligne}" class="trait"/>
      <circle cx="${x(pts.length - 1)}" cy="${y(vals.at(-1))}" r="4" class="point"/>
    </svg>`;
  }

  function ligneOp(o, k = 0) {
    return `<li class="op${o.m > 0 ? ' plus' : o.m < 0 ? ' moins' : ''}${o.r ? ' rare' : ''}" style="--k:${k}">
      <span class="op-ic">${icone(o.k)}</span><span class="op-l">${esc(o.l)}</span><b>${o.m ? C.euros(o.m, true) : '—'}</b></li>`;
  }

  function dessiner() {
    const x = c();
    $('cpt-solde').textContent = C.euros(x.solde);
    $('cpt-solde').classList.toggle('rouge', x.solde < 0);
    $('cpt-rib').textContent = x.rib;
    $('cpt-salaire').innerHTML = `Salaire ${C.euros(x.salaire)} le 1er · loyer ${C.euros(x.loyer)} le 5 · découvert autorisé ${C.euros(C.DECOUVERT)}<br>Prélèvements du mois : ${C.prelevements(x).map((f) => `${icone(f.k)} ${esc(f.l.replace(/ \(.*\)/, ''))} le ${f.jour}`).join(' · ')}`;
    $('cpt-courbe').innerHTML = courbe();
    $('cpt-anniv').value = x.anniv ? `2000-${x.anniv}` : '';
    const parJour = new Map();
    for (const o of [...x.ops].reverse()) { if (!parJour.has(o.d)) parJour.set(o.d, []); parJour.get(o.d).push(o); }
    $('cpt-ops').innerHTML = [...parJour.entries()].slice(0, 30).map(([j, ops]) =>
      `<li class="jour"><h5>${dateLongue(j)}</h5><ul>${ops.map((o) => ligneOp(o)).join('')}</ul></li>`).join('') || '<li class="note">Aucune opération pour l’instant.</li>';
  }

  $('cpt-anniv').addEventListener('change', (e) => {
    const v = e.target.value;
    c().anniv = /^\d{4}-\d\d-\d\d$/.test(v) ? v.slice(5) : '';
    app.sauverCompte();
    fx.texte(c().anniv ? 'Anniversaire noté 🎂' : 'Anniversaire effacé', e.target);
  });

  /** Joue les jours en retard ; s'il s'est passé quelque chose, le récapitulatif s'ouvre. */
  function nouveauxJours({ montrer = true } = {}) {
    const jours = C.rattraper(c());
    if (!jours.length) return;
    app.sauverCompte();
    majBouton();
    if (montrer) recap(jours);
  }

  function recap(jours) {
    const ops = jours.flatMap((j) => j.ops);
    const total = ops.reduce((s, o) => s + o.m, 0);
    $('jr-titre').textContent = jours.length > 1 ? 'Pendant ton absence…' : 'Aujourd’hui sur ton compte';
    $('jr-sous').textContent = jours.length > 1 ? `${jours.length} jours se sont écoulés.` : dateLongue(jours[0].jour);
    let k = 0;
    $('jr-liste').innerHTML = jours.map((j) => `${jours.length > 1 ? `<li class="jour-sep">${dateLongue(j.jour)}</li>` : ''}${j.ops.map((o) => ligneOp(o, k++)).join('')}`).join('');
    $('jr-total').innerHTML = `Bilan : <b class="${total < 0 ? 'rouge' : 'vert'}">${C.euros(total, true)}</b> · Solde : <b class="${c().solde < 0 ? 'rouge' : ''}">${C.euros(c().solde)}</b>`;
    $('ov-journee').hidden = false;
    const rares = ops.filter((o) => o.r);
    setTimeout(() => {
      if (rares.some((o) => o.m > 0 || o.k === 'augmentation' || o.k === 'anniv')) { sfx.gain(true); fx.confettis(innerWidth / 2, innerHeight * 0.7, 80); }
      else if (rares.length) { sfx.perte(); fx.secouer($('ov-journee').querySelector('.panneau'), 6); }
      else sfx.clic();
    }, 250 + Math.min(k, 12) * 70);
  }

  // un nouveau jour peut commencer pendant qu'on joue (minuit passé)
  setInterval(() => { if (C.jour() > c().dernier) nouveauxJours(); }, 60 * 1000);

  majBouton();
  return {
    ouvrir() { dessiner(); $('ov-compte').hidden = false; },
    nouveauxJours,
    majBouton,
  };
}
