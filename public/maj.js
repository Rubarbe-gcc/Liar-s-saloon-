/**
 * Insert Coin — les mises à jour, sans y penser.
 *
 * Le site s'installe comme une application. À chaque ouverture, il charge
 * déjà la dernière version (le service worker sert le réseau d'abord). Reste
 * le cas d'une application laissée ouverte pendant qu'une mise à jour sort :
 * ce script vérifie régulièrement, et propose de recharger quand une nouvelle
 * version est prête. Il ne recharge jamais tout seul en pleine partie.
 *
 * Chargé par toutes les pages, sans dépendance.
 */
(() => {
  if (!('serviceWorker' in navigator)) return;

  const debut = Date.now();
  // Sans service worker déjà aux commandes, c'est une première visite : il
  // n'y a rien à mettre à jour.
  const dejaInstalle = !!navigator.serviceWorker.controller;
  let annonce = false;

  function annoncer() {
    if (annonce) return;
    annonce = true;
    const b = document.createElement('div');
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9999;'
      + 'display:flex;align-items:center;gap:10px;max-width:92vw;padding:10px 12px 10px 16px;border-radius:14px;'
      + 'background:#1c150c;color:#f3e7d1;border:1px solid rgba(232,192,96,.5);box-shadow:0 10px 30px rgba(0,0,0,.6);'
      + 'font:14px/1.3 ui-rounded,"Segoe UI",system-ui,sans-serif';
    b.innerHTML = '<span>Nouvelle version disponible</span>';
    const ok = document.createElement('button');
    ok.textContent = 'Mettre à jour';
    ok.style.cssText = 'font:inherit;font-weight:800;color:#1a1206;background:#e8c060;border:0;border-radius:10px;padding:8px 12px;cursor:pointer';
    ok.addEventListener('click', () => location.reload());
    const non = document.createElement('button');
    non.textContent = '×';
    non.setAttribute('aria-label', 'Plus tard');
    non.style.cssText = 'font:inherit;font-size:18px;color:#b5a382;background:none;border:0;cursor:pointer;padding:4px 6px';
    non.addEventListener('click', () => b.remove());
    b.append(ok, non);
    document.body.appendChild(b);
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!dejaInstalle) return;
    // Dans les premières secondes, la page vient d'être chargée depuis le
    // réseau : elle est déjà à jour, inutile de déranger.
    if (Date.now() - debut < 5000) return;
    annoncer();
  });

  const verifier = () => navigator.serviceWorker.getRegistration()
    .then((r) => r && r.update())
    .catch(() => { /* hors connexion : on réessaiera */ });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(verifier).catch(() => { /* le site marche sans */ });
  });
  /* Le numéro de version, en bas à droite du menu de chaque jeu : un repère
     pour savoir d'un coup d'œil si deux appareils sont sur la même. Il se lit
     dans le nom du cache que le service worker tient à jour. */
  async function versionCourante() {
    try {
      const noms = (await caches.keys()).filter((n) => n.startsWith('insert-coin-v'));
      const n = Math.max(...noms.map((x) => Number(x.slice('insert-coin-v'.length)) || 0));
      return n > 0 ? `v${n}` : '';
    } catch { return ''; }
  }

  function afficherVersion() {
    if (!location.pathname.startsWith('/games/')) return;
    const e = document.createElement('div');
    e.id = 'version-appli';
    e.setAttribute('aria-label', 'Version de l’application');
    e.style.cssText = 'position:fixed;right:calc(8px + env(safe-area-inset-right,0px));bottom:calc(6px + env(safe-area-inset-bottom,0px));z-index:30;'
      + 'font:11px/1 ui-monospace,Consolas,monospace;letter-spacing:.06em;color:rgba(255,255,255,.42);pointer-events:none;user-select:none';
    document.body.appendChild(e);
    // Seulement sur le menu du jeu : en partie, le coin est occupé.
    const surMenu = () => !!document.querySelector('#s-menu.is-active, #screen-menu.is-active, #e-menu.actif');
    const rafraichir = async () => {
      e.hidden = !surMenu();
      if (!e.hidden) e.textContent = await versionCourante();
    };
    new MutationObserver(rafraichir).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    navigator.serviceWorker.addEventListener('controllerchange', rafraichir);
    rafraichir();
    // Au tout premier lancement, le cache se remplit quelques secondes après.
    setTimeout(rafraichir, 4000);
  }
  if (document.body) afficherVersion(); else addEventListener('DOMContentLoaded', afficherVersion);

  // À chaque retour sur l'application, et toutes les demi-heures tant qu'elle reste ouverte.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verifier(); });
  setInterval(verifier, 30 * 60 * 1000);
})();
