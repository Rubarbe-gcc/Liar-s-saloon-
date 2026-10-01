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
  // À chaque retour sur l'application, et toutes les demi-heures tant qu'elle reste ouverte.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verifier(); });
  setInterval(verifier, 30 * 60 * 1000);
})();
