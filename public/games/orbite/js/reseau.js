// Client WebSocket pour le lockstep (voir server/orbite.js). Fonctions de rappel : onsalle, onstart, ontour, ondesync, ondepart, onfin, onerreur, onclose.
export class Reseau {
  constructor(url, h = {}) {
    this.h = h; this.ws = new WebSocket(url);
    this.ws.onopen = () => h.onopen && h.onopen();
    this.ws.onclose = () => h.onclose && h.onclose();
    this.ws.onerror = () => h.onerreur && h.onerreur('Connexion impossible au serveur.');
    this.ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      const f = { salle: 'onsalle', start: 'onstart', tour: 'ontour', desync: 'ondesync', depart: 'ondepart', fin: 'onfin', erreur: 'onerreur' }[m.t];
      if (f && h[f]) h[f](f === 'onerreur' ? m.msg : m);
    };
  }
  envoi(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  creer(mode, f, nom, carte) { this.envoi({ t: 'creer', mode, f, nom, carte }); }
  rejoindre(code, f, nom) { this.envoi({ t: 'rejoindre', code, f, nom }); }
  demarrer() { this.envoi({ t: 'demarrer' }); }
  ordre(ids, c) { this.envoi({ t: 'ordre', ids, c }); }
  hash(n, h) { this.envoi({ t: 'hash', n, h }); }
  fin() { this.envoi({ t: 'fin' }); }
  fermer() { this.ws.close(); }
}
