/**
 * PETIT PONT — le lissage des corrections en ligne.
 *
 * En ligne, on joue sans attendre les touches de l'adversaire : on les
 * prédit, et quand les vraies arrivent et diffèrent, le moteur rejoue les
 * dernières images (shared/rollback.js). Le match est alors juste, mais à
 * l'écran un joueur (et ses coéquipiers, et le ballon) « saute » d'un coup à
 * sa nouvelle place. Ici, on ne montre pas ce saut : on garde un petit
 * décalage entre la place affichée et la vraie, qui fond en une fraction de
 * seconde. Le jeu reste exact, seul l'affichage glisse.
 *
 * Module sans DOM (testé dans test/foot.test.js).
 */

/** Au-delà de ce saut (m), c'est une remise en place (coup d'envoi…) : on ne lisse pas. */
const TELEPORT = 4;
/** En deçà (m), c'est le mouvement normal (accélération, contact) : rien à lisser. */
const SEUIL_JOUEUR = 0.12;
const SEUIL_BALLON = 0.35;
/** La vitesse à laquelle le décalage fond (par seconde). */
const FONTE = 11;

export function creerLissage(n = 10) {
  const j = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  const b = { x: 0, y: 0, z: 0 };
  return {
    decalages: { j, b },
    /**
     * Une image du moteur vient d'être jouée. prec, cour : les instantanés avant et après
     * (positions et vitesses) ; dt : la durée d'une image.
     */
    apres(prec, cour, dt) {
      if (!prec || !cour) return;
      cour.joueurs.forEach((p, i) => {
        const q = prec.joueurs[i];
        const ex = p.x - (q.x + q.vx * dt), ey = p.y - (q.y + q.vy * dt);
        const d = Math.hypot(ex, ey);
        if (d > TELEPORT) { j[i].x = 0; j[i].y = 0; } else if (d > SEUIL_JOUEUR) { j[i].x -= ex; j[i].y -= ey; }
      });
      const q = prec.ballon, p = cour.ballon;
      const ex = p.x - (q.x + q.vx * dt), ey = p.y - (q.y + q.vy * dt), ez = p.z - (q.z + q.vz * dt);
      const d = Math.hypot(ex, ey, ez);
      if (d > TELEPORT) { b.x = 0; b.y = 0; b.z = 0; } else if (d > SEUIL_BALLON) { b.x -= ex; b.y -= ey; b.z -= ez; }
    },
    /** La vue à montrer : les vraies places, plus ce qui reste des décalages (qui fondent avec le temps). */
    appliquer(vue, dt) {
      const k = Math.exp(-FONTE * dt);
      for (const o of [...j, b]) { o.x *= k; o.y *= k; if ('z' in o) o.z *= k; }
      return {
        ...vue,
        joueurs: vue.joueurs.map((p, i) => ({ ...p, x: p.x + j[i].x, y: p.y + j[i].y })),
        ballon: { ...vue.ballon, x: vue.ballon.x + b.x, y: vue.ballon.y + b.y, z: Math.max(0, vue.ballon.z + b.z) },
      };
    },
    remettre() { for (const o of [...j, b]) { o.x = 0; o.y = 0; if ('z' in o) o.z = 0; } },
  };
}
