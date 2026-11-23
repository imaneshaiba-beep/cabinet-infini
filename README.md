# Cabinet infini

Un cabinet d'affiches sans fond : des milliers d'affiches choisies par des graphistes sur [Are.na](https://www.are.na), vues à travers une lentille de verre liquide. Projet de portfolio.

**En ligne :** https://shaibanova.techniques-graphiques.be/cabinet-infini/

- Un carrousel en WebGL, trois rangées infinies sous une lentille qui sépare le rouge et le bleu.
- Des animations au défilement avec GSAP (ScrollTrigger, SplitText, Flip) : manifeste mot à mot, sélection qui défile de côté, chiffres en direct, collection filtrable.
- Des typographies qui basculent lettre par lettre, un curseur « ∞ » de verre liquide.
- Aucun cookie, aucune mesure d'audience, polices hébergées dans le site.
- Tout reste lisible et calme avec « réduire les animations ».

## Lancer le projet

```bash
npm install
npm run dev        # le site en local, sur http://localhost:5173
npm run build      # le site final dans dist/
npm run preview    # regarder dist/ en local
```

## Les fichiers

```
index.html              le cabinet
mentions-legales.html   mentions légales et vie privée
src/
  main.js               le départ : chargement, puis tout le reste
  donnees.js            les affiches, lues sur Are.na (API v3)
  carrousel.js          le carrousel et sa lentille (lentille.js : le WebGL)
  sections.js           la sélection et la collection
  animations.js         les animations au défilement
  bascule.js, typo.js   les mots qui basculent lettre par lettre
  curseur.js            le curseur ∞
  mentions.js           le JavaScript de la page mentions légales
  style.css             Tailwind, les polices, le verre
public/
  fonts/                Inter et Instrument Serif (licence OFL)
  reserve.json          la réserve d'affiches (voir plus bas)
  apercu.jpg            l'image d'aperçu des partages
scripts/
  reserve.mjs           npm run reserve
  deployer.mjs          npm run deployer
docs/
  PLAN-cabinet-infini.md  le plan du projet, étape par étape
```

## La réserve d'affiches

Si Are.na ne répond pas (panne, trop de visiteurs), le site part de `public/reserve.json`, une copie de 300 affiches environ. Pour la rafraîchir :

```bash
npm run reserve
```

## Mettre en ligne

1. Copier `.env.example` en `.env` et le remplir avec les accès FTP. Ce fichier n'est jamais commité.
2. Lancer :

```bash
npm run deployer
```

Le script construit le site, l'envoie par FTP chiffré dans `REMOTE_DIR`, et ne retire du serveur que ses propres anciens fichiers (liste dans `.deploy-manifest.json`). Le reste du serveur n'est jamais touché.
