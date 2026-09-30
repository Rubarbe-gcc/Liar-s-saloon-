/**
 * BRASIER — la rediffusion du combat.
 *
 * Le combat a déjà eu lieu, sur le serveur. Ce module le rejoue, événement
 * par événement, au rythme de la table TEMPO que le serveur a lui aussi
 * utilisée pour savoir quand relancer le recrutement.
 *
 * Le joueur est toujours en bas : si le moteur l'a placé dans le camp 1, on
 * retourne simplement l'arène.
 */

import { getHeros } from '../../../shared/brasier/heros.js';
import { TEMPO } from '../../../shared/brasier/combat.js';
import { medaillon, portrait, esc, sleep, compter } from './ui.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);

let jeton = 0;          // chaque rediffusion a le sien ; une plus récente annule la précédente
export const annuler = () => { jeton++; };

/** Durée de l'élan d'un attaquant jusqu'à l'impact. */
const IMPACT = 300;

/**
 * @param {object} v   la vue, en phase de combat
 * @returns {Promise<void>}
 */
export async function rejouer(v) {
  const moi = ++jeton;
  const vivant = () => moi === jeton;
  const c = v.combat;
  if (!c) return;

  const monCamp = c.camp;
  const rangee = (camp) => (camp === monCamp ? $('c-moi') : $('c-adv'));
  const el = (uid) => document.querySelector(`#e-combat .srv[data-uid="${CSS.escape(uid)}"]`);
  const pvMax = new Map();

  // Les PV des héros, tels qu'ils étaient avant la sanction de ce combat.
  const gagne = c.gagnant === monCamp;
  const perdu = c.gagnant !== null && !gagne;
  const moiJ = v.joueurs.find((j) => j.id === v.moi.id);
  const adv = c.adversaire.id ? v.joueurs.find((j) => j.id === c.adversaire.id) : null;
  const pvMoi = moiJ.pv + (perdu ? c.degats : 0);
  const pvAdv = adv ? adv.pv + (gagne ? c.degats : 0) : undefined;

  $('c-tour').textContent = `Tour ${v.tour}`;
  const h = getHeros(c.adversaire.heros);
  $('c-heros-adv').innerHTML = `${portrait(c.adversaire.heros, pvAdv)}
    <div><div class="nom">${esc(c.adversaire.name)}</div><div class="sous">${h ? esc(h.nom) : ''}</div></div>`;
  $('c-heros-moi').innerHTML = `${portrait(v.moi.heros, pvMoi)}
    <div><div class="nom">Vous</div><div class="sous">${esc(getHeros(v.moi.heros)?.nom || '')}</div></div>`;
  $('c-milieu').innerHTML = '';
  $('c-adv').innerHTML = '';
  $('c-moi').innerHTML = '';

  let resteAttaque = 0;

  for (const e of c.events) {
    if (!vivant()) return;

    // Le retour de l'attaquant précédent se termine avant la suite.
    if ((e.t === 'attaque' || e.t === 'fin') && resteAttaque) {
      await sleep(resteAttaque);
      resteAttaque = 0;
      if (!vivant()) return;
    }

    switch (e.t) {
      case 'debut':
        e.camps.forEach((liste, camp) => {
          for (const u of liste) pvMax.set(u.uid, u.pv);
          rangee(camp).innerHTML = liste.map((u) => medaillon(u, { cls: 'nouveau' })).join('');
          compter(rangee(camp));
        });
        if (!e.camps[monCamp].length && !e.camps[1 - monCamp].length) {
          $('c-milieu').textContent = 'Deux plateaux vides : on se regarde en chiens de faïence.';
        }
        await sleep(TEMPO.debut);
        break;

      case 'premier':
        $('c-milieu').textContent = e.camp === monCamp ? 'Vous frappez en premier' : `${c.adversaire.name} frappe en premier`;
        await sleep(TEMPO.premier);
        break;

      case 'attaque': {
        const a = el(e.a), b = el(e.c);
        if (a && b) elan(a, b);
        sfx.attaque();
        await sleep(IMPACT);
        resteAttaque = Math.max(0, TEMPO.attaque - IMPACT);
        break;
      }

      case 'coup': {
        const x = el(e.uid);
        if (x) {
          majStats(x, null, e.pv, pvMax.get(e.uid));
          x.classList.remove('frappe'); void x.offsetWidth; x.classList.add('frappe');
          const d = document.createElement('span');
          d.className = `degat${e.venin ? ' venin' : ''}`;
          d.textContent = `-${e.n}`;
          x.appendChild(d);
          setTimeout(() => d.remove(), 800);
        }
        sfx.coup();
        break;
      }

      case 'bouclier': {
        const x = el(e.uid);
        if (x) { x.classList.remove('bouclier'); x.classList.add('eclat'); }
        sfx.bouclier();
        await sleep(TEMPO.bouclier);
        break;
      }

      case 'mort': {
        const x = el(e.uid);
        if (x) x.classList.add('meurt');
        sfx.mort();
        await sleep(TEMPO.mort);
        if (x) { const r = x.parentElement; x.remove(); if (r) compter(r); }
        break;
      }

      case 'invoque': {
        const r = rangee(e.camp);
        pvMax.set(e.u.uid, e.u.pv);
        const tmp = document.createElement('div');
        tmp.innerHTML = medaillon(e.u, { cls: 'nouveau' });
        const nouveau = tmp.firstElementChild;
        const vivants = [...r.children].filter((x) => !x.classList.contains('meurt'));
        r.insertBefore(nouveau, vivants[e.pos] || null);
        compter(r);
        sfx.invoque();
        await sleep(TEMPO.invoque);
        break;
      }

      case 'buff': {
        const x = el(e.uid);
        if (x) {
          pvMax.set(e.uid, Math.max(pvMax.get(e.uid) || 0, e.pv));
          majStats(x, e.atk, e.pv, pvMax.get(e.uid));
          x.classList.remove('eclat'); void x.offsetWidth; x.classList.add('eclat');
        }
        await sleep(TEMPO.buff);
        break;
      }

      case 'mot': {
        const x = el(e.uid);
        if (x) x.classList.add(e.mot);
        await sleep(TEMPO.mot);
        break;
      }

      case 'fin': {
        const res = e.gagnant === null ? 'nul' : (e.gagnant === monCamp ? 'victoire' : 'defaite');
        const titre = { victoire: 'Victoire !', defaite: 'Défaite', nul: 'Égalité' }[res];
        const sous = res === 'nul' ? 'Personne ne saigne.'
          : res === 'victoire' ? `${esc(c.adversaire.name)} perd ${c.degats} PV.`
            : `Vous perdez ${c.degats} PV.`;
        $('c-milieu').innerHTML = `<div><span class="resultat ${res}">${titre}</span><small>${sous}</small></div>`;
        if (res === 'victoire') {
          sfx.victoire();
          toucher($('c-heros-adv'), pvAdv !== undefined ? pvAdv - c.degats : undefined);
        } else if (res === 'defaite') {
          sfx.defaite();
          toucher($('c-heros-moi'), pvMoi - c.degats);
        }
        await sleep(TEMPO.fin);
        break;
      }

      default:
        await sleep(TEMPO[e.t] || 0);
    }
  }
}

/** L'attaquant bondit vers sa cible et revient. */
function elan(a, b) {
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  const dx = (rb.left + rb.width / 2 - (ra.left + ra.width / 2)) * 0.82;
  const dy = (rb.top + rb.height / 2 - (ra.top + ra.height / 2)) * 0.82;
  a.style.zIndex = 10;
  const anim = a.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: 'translate(0,0) scale(1.1)', offset: 0.15 },
    { transform: `translate(${dx}px,${dy}px) scale(1.1)`, offset: 0.5, easing: 'ease-out' },
    { transform: 'translate(0,0) scale(1)' },
  ], { duration: 580, easing: 'cubic-bezier(.5,0,.3,1)' });
  anim.onfinish = () => { a.style.zIndex = ''; };
}

function majStats(x, atk, pv, max) {
  if (atk !== null) {
    const e = x.querySelector('.srv-atk');
    if (e) e.textContent = atk;
  }
  const p = x.querySelector('.srv-pv');
  if (p) {
    p.textContent = pv;
    p.classList.toggle('blesse', max !== undefined && pv < max);
  }
}

function toucher(cadre, pv) {
  const p = cadre.querySelector('.portrait');
  if (!p) return;
  p.classList.remove('touche'); void p.offsetWidth; p.classList.add('touche');
  const b = p.querySelector('.portrait-pv');
  if (b && pv !== undefined) b.textContent = pv;
}

