/**
 * MAXI MENU — les cartes du fast-food.
 *
 * Huit enseignes inventées (des clins d'œil, jamais les vraies marques ni
 * leurs logos), douze cartes chacune : 5 communes, 3 rares, 2 épiques,
 * 1 légendaire, 1 mythique. Les chiffres des fiches sont pour rire.
 */

export const RARETES = {
  commune:    { nom: 'Commune',    poids: 620, recyclage: 5,   couleur: '#9aa3ad', rang: 0 },
  rare:       { nom: 'Rare',       poids: 250, recyclage: 15,  couleur: '#3a9bff', rang: 1 },
  epique:     { nom: 'Épique',     poids: 90,  recyclage: 50,  couleur: '#b45cff', rang: 2 },
  legendaire: { nom: 'Légendaire', poids: 33,  recyclage: 200, couleur: '#ffb52e', rang: 3 },
  mythique:   { nom: 'Mythique',   poids: 7,   recyclage: 800, couleur: '#ff4f9a', rang: 4 },
};
export const ORDRE_RARETES = ['commune', 'rare', 'epique', 'legendaire', 'mythique'];

/**
 * Les enseignes : couleurs, emblème (dessin du badge) et mascotte.
 * `chapeau` donne le couvre-chef de la mascotte dessinée.
 */
export const ENSEIGNES = {
  arches:   { nom: 'Les Arches d’Or',        court: 'Arches d’Or',   couleurs: ['#e3262f', '#ffc72c'], embleme: 'soleil',   devise: 'Toujours ouvert, toujours doré.' },
  roi:      { nom: 'Le Roi du Grill',        court: 'Roi du Grill',  couleurs: ['#1d4fa8', '#ff8a1e'], embleme: 'couronne', devise: 'Ici, c’est le grill qui commande.' },
  capitaine:{ nom: 'Le Poulet du Capitaine', court: 'Capitaine',     couleurs: ['#c8102e', '#f4efe6'], embleme: 'ancre',    devise: 'Croustillant à bâbord, croustillant à tribord.' },
  metro:    { nom: 'Métro Sandwich',         court: 'Métro',         couleurs: ['#0e8a3e', '#ffd41f'], embleme: 'rail',     devise: 'Prochain arrêt : votre sandwich.' },
  domino:   { nom: 'Pizza Double-Six',       court: 'Double-Six',    couleurs: ['#11519c', '#e8303a'], embleme: 'de',       devise: 'Livrée avant que les dés ne roulent.' },
  taco:     { nom: 'Taco Cloche',            court: 'Taco Cloche',   couleurs: ['#6a2c91', '#ffcf2a'], embleme: 'cloche',   devise: 'Ça sonne, c’est l’heure du taco.' },
  rapido:   { nom: 'Rapido Burger',          court: 'Rapido',        couleurs: ['#e2001a', '#ffffff'], embleme: 'eclair',   devise: 'Plus vite que votre faim.' },
  cousins:  { nom: 'Les Six Cousins',        court: 'Six Cousins',   couleurs: ['#c8102e', '#f2e6d0'], embleme: 'six',      devise: 'Une recette de famille, six fois meilleure.' },
};
export const ORDRE_ENSEIGNES = ['arches', 'roi', 'capitaine', 'metro', 'domino', 'taco', 'rapido', 'cousins'];

/*
 * Une carte : [id, nom, dessin, rareté, description, calories, prix (€), croustillance 1-5, gourmandise 1-5]
 * `dessin` choisit l'illustration (voir games/maxi-menu/js/dessins.js).
 */
const L = (enseigne, lignes) => lignes.map(([id, nom, dessin, rarete, desc, kcal, prix, crous, gour]) => ({
  id: `${enseigne}-${id}`, enseigne, nom, dessin, rarete, desc, kcal, prix, crous, gour,
}));

export const CARTES = [
  ...L('arches', [
    ['cheese', 'Cheese Doré', 'burger', 'commune', 'Un steak, une tranche de fromage, et la promesse d’en reprendre un.', 300, 1.9, 1, 3],
    ['frites', 'Frites Dorées', 'frites', 'commune', 'Fines, salées, et toujours trop chaudes pour la première.', 330, 2.5, 4, 4],
    ['nuggets', 'Nuggets ×9', 'nuggets', 'commune', 'Neuf morceaux, zéro partage.', 420, 5.2, 4, 3],
    ['soda', 'Soda Géant', 'soda', 'commune', 'Un gobelet si grand qu’il a son propre code postal.', 280, 2.9, 1, 2],
    ['chausson', 'Chausson à la Pomme', 'chausson', 'commune', 'Dehors croustillant, dedans plus chaud que le soleil.', 250, 1.8, 4, 4],
    ['grand', 'Le Grand Arche', 'burger-double', 'rare', 'Deux étages, trois pains, une sauce dont personne ne connaît la recette.', 510, 5.4, 2, 5],
    ['glace', 'Glace Tourbillon', 'glace', 'rare', 'La machine marchait ce jour-là. Un miracle.', 340, 3.5, 2, 5],
    ['muffin', 'Muffin du Matin', 'muffin', 'rare', 'Œuf, fromage, bacon : servi avant 10 h 30, jamais après.', 310, 3.9, 2, 4],
    ['joyeux', 'Le Menu Joyeux', 'boite', 'epique', 'Un burger, des frites… et un jouet qui finira sous le canapé.', 520, 4.9, 3, 4],
    ['royal', 'Le Royal Doré', 'burger-luxe', 'epique', 'Le burger des grandes occasions. Ou d’un mardi soir.', 560, 6.2, 2, 5],
    ['clown', 'Le Clown Ketchup', 'mascotte-clown', 'legendaire', 'La mascotte des Arches. Personne ne l’a jamais vu sans son nez rouge.', 0, 0, 1, 5],
    ['sauce', 'La Sauce Secrète', 'sauce', 'mythique', 'Gardée dans un coffre. Le chef lui-même n’a que la moitié de la combinaison.', 90, 0.5, 1, 5],
  ]),
  ...L('roi', [
    ['frites', 'Frites du Roi', 'frites', 'commune', 'Plus épaisses, parce qu’un roi ne fait rien à moitié.', 380, 2.7, 3, 4],
    ['onion', 'Rondelles d’Oignon', 'rondelles', 'commune', 'Des anneaux dignes d’une couronne.', 410, 3.1, 5, 3],
    ['chicken', 'Poulet Croustillant', 'burger-poulet', 'commune', 'Un poulet pané qui a fait allégeance au roi.', 470, 4.6, 4, 3],
    ['soda', 'Soda Royal', 'soda', 'commune', 'Recharge à volonté, comme le veut la loi du royaume.', 260, 2.6, 1, 2],
    ['sundae', 'Coupe Glacée', 'glace', 'commune', 'Caramel ou chocolat : le roi vous laisse choisir.', 330, 2.9, 1, 4],
    ['grand', 'Le Grand Grill', 'burger-luxe', 'rare', 'Grillé à la flamme, couronné de salade et d’oignons.', 660, 6.4, 2, 5],
    ['fume', 'Le Steakhouse Fumé', 'burger-double', 'rare', 'Bacon, sauce barbecue et un soupçon de feu de camp.', 740, 7.1, 3, 5],
    ['nuggets', 'Nuggets du Roi', 'nuggets', 'rare', 'Taillés en forme de couronne. Enfin presque.', 390, 4.8, 4, 3],
    ['double', 'Le Double Royal', 'burger-double', 'epique', 'Deux steaks grillés à la flamme pour un appétit de souverain.', 900, 8.2, 2, 5],
    ['feu', 'Le Grill Feu de Bois', 'flamme', 'epique', 'Le grill qui ne s’éteint jamais, au cœur de chaque restaurant.', 0, 0, 3, 4],
    ['roi', 'Le Roi en Personne', 'mascotte-roi', 'legendaire', 'Un sourire figé, une couronne en or, et il est toujours là quand on ne s’y attend pas.', 0, 0, 1, 5],
    ['couronne', 'La Couronne en Carton', 'couronne', 'mythique', 'Offerte aux enfants, portée par les adultes. La plus rare de toutes : la première jamais pliée.', 0, 0, 1, 5],
  ]),
  ...L('capitaine', [
    ['pilons', 'Pilons Croustillants', 'pilon', 'commune', 'Panés selon la recette du bord.', 360, 4.2, 5, 4],
    ['ailes', 'Ailes Épicées', 'ailes', 'commune', 'Elles piquent, mais on y revient toujours.', 420, 4.5, 4, 4],
    ['tenders', 'Tenders Dorés', 'nuggets', 'commune', 'Des filets tendres, idéals pour tremper partout.', 380, 4.9, 4, 3],
    ['puree', 'Purée Sauce Brune', 'puree', 'commune', 'Le seul plat qu’on mange à la cuillère sur le bateau.', 210, 2.4, 1, 4],
    ['mais', 'Épi de Maïs', 'mais', 'commune', 'Beurré, salé, et coincé entre les dents.', 140, 1.9, 2, 2],
    ['seau', 'Le Seau Familial', 'seau', 'rare', 'Huit morceaux, une famille, une seule bagarre pour le dernier.', 1800, 16.9, 5, 5],
    ['burger', 'Burger Croquant', 'burger-poulet', 'rare', 'Un filet entier dans un pain brioché.', 560, 5.6, 5, 4],
    ['salade', 'Salade du Matelot', 'salade', 'rare', 'Pour ceux qui ont promis de faire attention. Avec du poulet pané dessus.', 390, 6.1, 3, 2],
    ['mega', 'Le Méga Seau', 'seau', 'epique', 'Seize morceaux. Prévoyez un équipage.', 3600, 29.9, 5, 5],
    ['epices', 'La Recette aux 12 Épices', 'parchemin', 'epique', 'Une de plus que chez les autres. Le Capitaine insiste.', 0, 0, 1, 5],
    ['capitaine', 'Le Capitaine', 'mascotte-capitaine', 'legendaire', 'Barbe blanche, casquette marine, et une poigne de fer sur la friteuse.', 0, 0, 1, 5],
    ['secret', 'Le Coffre du Capitaine', 'coffre', 'mythique', 'On dit que la vraie recette y repose, au fond de la cale.', 0, 0, 1, 5],
  ]),
  ...L('metro', [
    ['thon', 'Sandwich Thon Mayo', 'sandwich', 'commune', 'Le grand classique de la pause de midi.', 480, 5.2, 2, 3],
    ['teriyaki', 'Poulet Teriyaki', 'sandwich', 'commune', 'Sucré, salé, et toujours un peu de sauce sur les doigts.', 370, 5.9, 2, 4],
    ['vege', 'Le Végé du Quai', 'sandwich', 'commune', 'Tout le potager, sans quitter la station.', 230, 4.9, 3, 2],
    ['cookie', 'Cookie Géant', 'cookie', 'commune', 'Encore tiède, toujours trop petit.', 220, 1.2, 2, 5],
    ['chips', 'Chips de la Ligne 6', 'chips', 'commune', 'Le croquant qui accompagne tous les trajets.', 150, 1.3, 5, 2],
    ['trente', 'Le Trente Centimètres', 'sandwich-long', 'rare', 'Une règle de 30 cm, mais en pain.', 820, 8.9, 2, 4],
    ['club', 'Le Club Express', 'sandwich', 'rare', 'Dinde, jambon, bacon : trois étages comme un métro aérien.', 520, 7.2, 2, 4],
    ['bol', 'Le Bol Salade', 'salade', 'rare', 'Tout le sandwich, sans le pain. Pourquoi pas.', 210, 6.5, 3, 2],
    ['mois', 'Le Sandwich du Mois', 'sandwich-long', 'epique', 'Il change tous les mois. Celui-ci, on le regrettera.', 640, 6.0, 2, 5],
    ['tresse', 'Le Pain Tressé', 'pain', 'epique', 'Cuit sur place à l’aube, parfumé jusqu’au fond du couloir.', 210, 0, 3, 4],
    ['chef', 'Le Chef du Métro', 'mascotte-chef', 'legendaire', 'Il garnit plus vite que son ombre et ne se trompe jamais de sauce.', 0, 0, 1, 5],
    ['infini', 'Le Sandwich Infini', 'sandwich-long', 'mythique', 'Il commence à la station Nord et finit on ne sait où.', 99999, 0, 2, 5],
  ]),
  ...L('domino', [
    ['marg', 'Pizza Margherita', 'pizza', 'commune', 'Tomate, mozzarella, basilic : la base de tout.', 800, 9.0, 2, 4],
    ['pepperoni', 'Pizza Pepperoni', 'pizza', 'commune', 'Des rondelles qui se recourbent en petites tasses à huile.', 950, 11.0, 3, 5],
    ['reine', 'Pizza Reine', 'pizza', 'commune', 'Jambon, champignons : la reine des commandes.', 880, 10.5, 2, 4],
    ['ail', 'Pain à l’Ail', 'pain', 'commune', 'Prévoyez des chewing-gums.', 300, 3.5, 3, 4],
    ['brownie', 'Brownie Fondant', 'brownie', 'commune', 'Le dessert qu’on rajoute toujours à la dernière seconde.', 380, 3.0, 1, 5],
    ['fromages', 'Quatre Fromages', 'pizza', 'rare', 'Quatre fromages qui se disputent chaque part.', 1100, 12.5, 2, 5],
    ['hawai', 'L’Hawaïenne', 'pizza', 'rare', 'Avec de l’ananas. Le grand débat de la famille.', 900, 11.5, 2, 3],
    ['ailes', 'Ailes Barbecue', 'ailes', 'rare', 'Livrées avec la pizza, dévorées avant elle.', 470, 6.0, 4, 4],
    ['geante', 'La Pizza Géante', 'pizza', 'epique', 'Elle ne rentre pas dans le four de la maison.', 2200, 18.9, 2, 5],
    ['bord', 'Le Bord Fourré', 'pizza', 'epique', 'Du fromage jusque dans la croûte. Plus aucun bord ne reste dans la boîte.', 1300, 14.0, 3, 5],
    ['livreur', 'Le Livreur Éclair', 'mascotte-casque', 'legendaire', 'Casque rouge, scooter fumant : il arrive avant que vous ayez raccroché.', 0, 0, 1, 5],
    ['six', 'La Double-Six', 'pizza', 'mythique', 'Douze garnitures, une par point des deux dés. Une seule a été cuite.', 3000, 26.0, 3, 5],
  ]),
  ...L('taco', [
    ['croustillant', 'Taco Croustillant', 'taco', 'commune', 'Il casse à la première bouchée. Toujours.', 170, 1.9, 5, 3],
    ['quesa', 'Quesadilla', 'quesadilla', 'commune', 'Fromage fondu entre deux galettes dorées.', 470, 4.5, 3, 4],
    ['nachos', 'Nachos Fromage', 'nachos', 'commune', 'Une montagne de chips et une rivière de fromage.', 560, 3.9, 5, 4],
    ['churros', 'Churros Sucrés', 'churros', 'commune', 'Cannelle et sucre jusqu’aux coudes.', 230, 2.5, 4, 5],
    ['soda', 'Soda Lagon', 'soda', 'commune', 'Une couleur qui n’existe pas dans la nature.', 280, 2.7, 1, 3],
    ['burrito', 'Burrito', 'burrito', 'rare', 'Tout le repas, roulé dans une seule galette.', 590, 5.8, 2, 4],
    ['dore', 'Taco Doré', 'taco', 'rare', 'Une coque en chips de maïs nacho. Un sacrilège délicieux.', 190, 2.6, 5, 4],
    ['roule', 'Le Roulé Croustillant', 'wrap', 'rare', 'Une galette repliée en hexagone, croustillante au centre.', 530, 5.2, 4, 4],
    ['geant', 'Le Burrito Géant', 'burrito', 'epique', 'Il pèse autant qu’un petit chat.', 1200, 9.9, 2, 5],
    ['lave', 'La Sauce Lave', 'sauce', 'epique', 'Testée sur des volontaires. Ils parlent encore de cette nuit.', 30, 0.3, 1, 3],
    ['cloche', 'La Cloche Dorée', 'cloche', 'legendaire', 'Elle sonne à chaque taco servi. Elle n’a jamais dormi.', 0, 0, 1, 5],
    ['minuit', 'Le Taco de Minuit', 'taco', 'mythique', 'Servi une seule fois, à minuit pile, au dernier client de la nuit.', 666, 0, 5, 5],
  ]),
  ...L('rapido', [
    ['frites', 'Frites Rapido', 'frites', 'commune', 'Servies en 30 secondes, chrono en main.', 340, 2.6, 4, 4],
    ['cheese', 'Cheese Rapido', 'burger', 'commune', 'Le burger qu’on mange au feu rouge.', 310, 2.2, 1, 3],
    ['nuggets', 'Nuggets Turbo', 'nuggets', 'commune', 'Six nuggets, zéro temps d’attente.', 300, 4.2, 4, 3],
    ['shake', 'Milkshake Vanille', 'milkshake', 'commune', 'Trop épais pour la paille, parfait pour la cuillère.', 420, 3.4, 1, 4],
    ['sauce', 'Sauce Andalouse', 'sauce', 'commune', 'La sauce qui va avec tout, surtout avec les frites.', 120, 0.4, 1, 4],
    ['colosse', 'Le Colosse', 'burger-double', 'rare', 'Le burger qui ne tient pas dans une seule main.', 700, 6.9, 2, 5],
    ['long', 'Le Long Fumé', 'sandwich-long', 'rare', 'Long comme une piste, garni de bacon fumé.', 650, 6.5, 2, 5],
    ['wrap', 'Wrap Rapido', 'wrap', 'rare', 'Roulé à la vitesse de l’éclair.', 450, 5.4, 2, 3],
    ['belge', 'Le Burger Belge', 'burger-luxe', 'epique', 'Avec des frites dedans. Oui, dedans.', 880, 8.4, 4, 5],
    ['fondant', 'Le Fondant', 'burger-luxe', 'epique', 'Le fromage coule avant même d’ouvrir la boîte.', 760, 7.6, 2, 5],
    ['pilote', 'Le Pilote Rapido', 'mascotte-casque', 'legendaire', 'Combinaison rouge, casque vissé : il livre en dérapage contrôlé.', 0, 0, 1, 5],
    ['turbo', 'Le Burger Turbo', 'eclair', 'mythique', 'Préparé en une seconde. Personne n’a jamais réussi à le filmer.', 1000, 0, 3, 5],
  ]),
  ...L('cousins', [
    ['cheese', 'Cheeseburger Double', 'burger-double', 'commune', 'Deux steaks écrasés à la plancha, comme à la maison.', 840, 9.5, 2, 5],
    ['cajun', 'Frites Cajun', 'frites', 'commune', 'Épicées, et servies en quantité déraisonnable.', 950, 4.9, 4, 5],
    ['hotdog', 'Hot-Dog Maison', 'hotdog', 'commune', 'Coupé en deux, grillé, garni à volonté.', 520, 6.0, 2, 4],
    ['cacahuetes', 'Cacahuètes Offertes', 'cacahuetes', 'commune', 'Un sac entier en attendant la commande.', 600, 0, 4, 3],
    ['soda', 'Soda à Volonté', 'soda', 'commune', 'La machine propose 120 parfums. Vous prendrez le même que d’habitude.', 250, 3.5, 1, 3],
    ['maison', 'Le Burger Maison', 'burger-luxe', 'rare', 'Le burger qui a fait la réputation de la famille.', 700, 10.5, 2, 5],
    ['grille', 'Sandwich Fromage Grillé', 'sandwich', 'rare', 'Doré à la plancha, filant à souhait.', 470, 6.9, 3, 4],
    ['shake', 'Milkshake Garni', 'milkshake', 'rare', 'Avec des morceaux de tout ce qu’il y a dans la cuisine.', 900, 6.5, 1, 5],
    ['garni', 'Le Tout-Garni', 'burger-luxe', 'epique', 'Toutes les garnitures, sans exception. Prévoyez des serviettes.', 1100, 12.0, 3, 5],
    ['seau', 'Le Sac de Frites Débordant', 'frites', 'epique', 'On commande une portion, on en reçoit trois au fond du sac.', 1500, 6.9, 4, 5],
    ['cousin', 'Le Grand Cousin', 'mascotte-casquette', 'legendaire', 'L’aîné des six : c’est lui qui a écrit la recette sur un coin de nappe.', 0, 0, 1, 5],
    ['quinze', 'Le Burger aux 15 Garnitures', 'burger-luxe', 'mythique', 'Quinze garnitures, et la nappe d’origine encadrée au-dessus du grill.', 1600, 15.0, 3, 5],
  ]),
];

export const PAR_ID = new Map(CARTES.map(c => [c.id, c]));
export const cartesDe = enseigne => CARTES.filter(c => c.enseigne === enseigne);
