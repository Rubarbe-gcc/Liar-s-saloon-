/**
 * Tir à la Corde (2 contre 2) : le curseur va et vient, on tire quand il
 * passe dans le vert. Pile au centre, c'est le grand coup ; dans le rouge,
 * on glisse et on perd un instant. La force des deux coéquipiers s'additionne.
 */
import { el, decompte, minuterie, son, envol } from './outils.js';

const DUREE = 10;
/** Les zones de la jauge, du centre vers les bords : écart maximal, force, nom. */
const ZONES = [[0.06, 3, 'PARFAIT !'], [0.16, 2, 'Bien !'], [0.28, 1, 'Ouf']];
const GLISSADE = 600;
const REPOS = 140;

export function demarrer(zone, { fin, ctx, joueurs }) {
  let vivant = true;
  let pret = false;
  let force = 0;
  let bloqueJusqua = 0;
  let dernier = 0;
  let t0 = 0;
  const equipe = ctx?.equipe || [];
  const nous = equipe.map((i) => joueurs[i]?.avatar || '🙂').join('');
  const eux = joueurs.filter((j, i) => j && !equipe.includes(i)).map((j) => j.avatar).join('') || '🤖🤖';

  const scene = el('div', 'corde', `
    <div class="corde-camps"><span>${nous || '🙂🙂'}</span><span class="eux">${eux}</span></div>
    <div class="corde-piste"><div class="corde-fil"></div><span class="noeud">🎀</span><i class="ligne-milieu"></i></div>
    <div class="jauge"><i class="j-rouge"></i><i class="j-jaune"></i><i class="j-vert"></i><i class="j-or"></i><b class="curseur"></b></div>
    <div class="corde-force">0</div>
    <button class="gros-bouton petit-bouton" type="button" disabled>TIREZ ! 💪</button>`);
  zone.appendChild(scene);
  const curseur = scene.querySelector('.curseur');
  const noeud = scene.querySelector('.noeud');
  const affiche = scene.querySelector('.corde-force');
  const bouton = scene.querySelector('button');

  /** La position du curseur (0 à 1) : il accélère au fil des secondes. */
  const position = (t) => {
    const periode = 1.2 - 0.35 * Math.min(1, t / (DUREE * 1000));
    return (Math.sin((t / 1000) * ((2 * Math.PI) / periode)) + 1) / 2;
  };

  const anim = setInterval(() => {
    if (!vivant || !t0) return;
    const t = performance.now() - t0;
    curseur.style.left = `${position(t) * 100}%`;
    // Les autres tirent régulièrement : le nœud penche du côté le plus fort.
    const ecart = force - 2.5 * (t / 1000);
    noeud.style.left = `${Math.max(8, Math.min(92, 50 - ecart * 1.6))}%`;
  }, 16);

  const tirer = (e) => {
    e?.preventDefault?.();
    if (!pret) return;
    const now = performance.now();
    if (now < bloqueJusqua || now - dernier < REPOS) return;
    dernier = now;
    const ecart = Math.abs(position(now - t0) - 0.5);
    const z = ZONES.find(([max]) => ecart <= max);
    const r = scene.getBoundingClientRect();
    const b = bouton.getBoundingClientRect();
    if (z) {
      force += z[1];
      affiche.textContent = force;
      envol(scene, b.left - r.left + b.width / 2, b.top - r.top - 10, `+${z[1]} ${z[2]}`, 'bon');
      if (z[1] === 3) son.bon(); else son.tape();
      scene.classList.remove('tire'); void scene.offsetWidth; scene.classList.add('tire');
    } else {
      bloqueJusqua = now + GLISSADE;
      envol(scene, b.left - r.left + b.width / 2, b.top - r.top - 10, 'Glissade !', 'mauvais');
      son.mauvais();
      scene.classList.remove('glisse'); void scene.offsetWidth; scene.classList.add('glisse');
    }
  };
  scene.addEventListener('pointerdown', tirer);
  const clavier = (e) => { if (e.key === ' ' || e.key === 'Enter') tirer(e); };
  addEventListener('keydown', clavier);

  (async () => {
    await decompte(zone, () => vivant);
    if (!vivant) return;
    pret = true;
    bouton.disabled = false;
    t0 = performance.now();
    minuterie(zone, DUREE, () => {
      pret = false;
      bouton.disabled = true;
      clearInterval(anim);
      removeEventListener('keydown', clavier);
      if (vivant) fin(force);
    });
  })();
  return () => { vivant = false; clearInterval(anim); removeEventListener('keydown', clavier); };
}
