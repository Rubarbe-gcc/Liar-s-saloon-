/**
 * RAID — liaison avec le relais.
 *
 * Deux gestes, chacun sur sa propre connexion : déposer une partie contre un
 * code court, ou retirer une partie avec ce code. Voir `server/relais.js`.
 */

const adresse = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;
const DELAI = 12000;

function ouvrir() {
  return new Promise((ok, ko) => {
    let ws;
    try { ws = new WebSocket(adresse()); } catch { ko(new Error('Connexion impossible.')); return; }
    const minuteur = setTimeout(() => { try { ws.close(); } catch { /* déjà fermée */ } ko(new Error('Le serveur ne répond pas. Vérifiez votre connexion.')); }, DELAI);
    ws.addEventListener('open', () => { clearTimeout(minuteur); ok(ws); });
    ws.addEventListener('error', () => { clearTimeout(minuteur); ko(new Error('Connexion impossible. Vérifiez votre connexion.')); });
  });
}

const lire = (ev) => { try { return JSON.parse(ev.data); } catch { return null; } };

/**
 * Dépose une partie. `surCode(code, dureeMs)` est appelé dès que le code est
 * prêt, `surPris()` quand l'autre appareil l'a retirée, `surErreur(message)`
 * en cas de pépin. Renvoie une fonction qui annule le dépôt.
 */
export async function deposer(charge, { surCode, surPris, surErreur }) {
  let ws;
  try { ws = await ouvrir(); } catch (e) { surErreur(e.message); return () => {}; }
  let fini = false;
  // L'hébergement ferme les connexions muettes : on donne signe de vie.
  const battement = setInterval(() => { try { ws.send(JSON.stringify({ g: 'relais', t: 'ping' })); } catch { /* fermée */ } }, 20000);
  const fermer = () => { fini = true; clearInterval(battement); try { ws.close(); } catch { /* déjà fermée */ } };
  ws.addEventListener('message', (ev) => {
    const m = lire(ev);
    if (!m) return;
    if (m.t === 'r:code') surCode(m.code, m.duree);
    else if (m.t === 'r:pris') { surPris(); fermer(); }
    else if (m.t === 'r:erreur') { surErreur(m.msg); fermer(); }
  });
  ws.send(JSON.stringify({ g: 'relais', t: 'r:deposer', charge }));
  return () => {
    if (fini) return;
    try { ws.send(JSON.stringify({ g: 'relais', t: 'r:annuler' })); } catch { /* fermée */ }
    fermer();
  };
}

/** Retire la partie déposée sous ce code. La promesse échoue avec un message lisible. */
export async function retirer(code) {
  const ws = await ouvrir();
  return new Promise((ok, ko) => {
    const minuteur = setTimeout(() => { try { ws.close(); } catch { /* fermée */ } ko(new Error('Le serveur ne répond pas.')); }, DELAI);
    const finir = (f, v) => { clearTimeout(minuteur); try { ws.close(); } catch { /* fermée */ } f(v); };
    ws.addEventListener('message', (ev) => {
      const m = lire(ev);
      if (!m) return;
      if (m.t === 'r:charge') finir(ok, m.charge);
      else if (m.t === 'r:erreur') finir(ko, new Error(m.msg));
    });
    ws.addEventListener('close', () => { clearTimeout(minuteur); ko(new Error('Connexion coupée. Réessayez.')); });
    ws.send(JSON.stringify({ g: 'relais', t: 'r:retirer', code }));
  });
}
