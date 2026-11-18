Shaiba Imane — AMM 11 : le long défilement (Cabinet infini, API Are.na)

## Les cinq réponses

**1. Quelle ligne décide quand, lesquelles décident quoi ? Combien de lignes ont changé ?**
Pour les cartes de la collection, le « quand » est `start: START_CARTES` ([animations.js:65](src/animations.js), qui vaut `'top 85%'` ligne 53). Le « quoi », ce sont les tweens de `onEnter` et `onLeaveBack` (lignes 66-67). Pour la séquence épinglée du manifeste, une seule valeur a changé par rapport à la version publiée : `scrub: 0.6` devient `scrub: 1` (ligne 185). Les tweens `.fromTo()` n'ont pas bougé.

**2. Que fait `pin: true`, et quelle hauteur fait le `.pin-spacer` ?**
`pin: true` bloque le manifeste à l'écran pendant que la page continue de défiler. GSAP l'enveloppe dans un `div.pin-spacer` qui ajoute la longueur d'épinglage, pour que la suite de la page ne remonte pas. Mesuré avec une fenêtre de 1262 px de haut : 3029 px, soit la section (1262 px) plus `end: '+=140%'` (1767 px).

**3. `scrub: true` ou `scrub: 1` : qu'est-ce que l'autre change ?**
La barre de progression utilise `scrub: true` (ligne 143) : elle suit le défilement exactement, sans retard. Le manifeste utilise `scrub: 1` (ligne 185) : les mots rattrapent le défilement en une seconde, ce qui lisse les à-coups de la molette.

**4. Pourquoi `ScrollTrigger.refresh()` après `fetch()`, et que voit-on sans ?**
Les cartes n'existent qu'une fois les données d'Are.na arrivées. Ajouter des cartes ou filtrer change la hauteur de la page, donc tous les traits start et end doivent être remesurés : c'est `rafraichir()` dans `lancer()` (main.js), juste après les premières cartes, puis après « Encore des affiches » et `apresFiltre()` après un filtre. Sans ça, les traits restent à leur ancienne place : les cartes entrent trop tôt ou trop tard, et la barre de progression n'est plus juste. L'ordre de mesure compte aussi : la barre est créée avant les sections épinglées, donc `refreshPriority: -1` (ligne 143) la fait remesurer en dernier, une fois le temps d'épinglage compté.

**5. Quelle ligne note l'état d'avant dans Flip, et laquelle anime vers l'après ?**
`const etat = Flip.getState(cartes);` ([sections.js:105](src/sections.js)) note la place de chaque carte avant le filtre. `Flip.from(etat, {...})` (ligne 151) anime chaque carte de cette place vers la nouvelle.

## Les sept points du cahier

1. **Séquence épinglée** : le manifeste, avec `scrub: 1` et `pin: true`.
2. **Cartes au défilement** : `ScrollTrigger.batch()`, `start: 'top 85%'`. Elles repartent quand on remonte (`onLeaveBack`).
3. **Barre de progression** : `scaleX` de 0 à 1, `ease: 'none'`, `scrub: true`.
4. **Filtre Flip sur une catégorie de l'API** : la chaîne Are.na de chaque affiche (`data-chaine`). Les classes de l'état actif sont écrites en entier (`aria-pressed:bg-encre`). `refresh()` est appelé après le filtre.
5. **Un effet du tour** : ScrollToPlugin sur le menu d'ancres de la navigation, justifié par `// Pourquoi ici :`.
6. **`gsap.matchMedia()`** : toutes les animations au défilement sont dans `media.add(MOUVEMENT)`. Avec « réduire les animations », pas de pin ni de scrub, les cartes sont visibles d'emblée et le filtre s'applique sans animation (variable `enMouvement`). La barre de progression n'apparaît pas dans ce mode.
7. **`ScrollTrigger.refresh()` après l'arrivée des données** et après chaque changement de hauteur.

## Les écarts avec la consigne, et pourquoi

- **La séquence épinglée** : le Cabinet n'a pas l'ouverture de la séance 10. C'est le manifeste qui sert de séquence épinglée, d'où la réponse 1 adaptée (comparaison avec la version publiée).
- **Les zones** : le projet est en modules Vite et non en un seul `script.js`. Les sept zones sont donc un repérage posé dans les fichiers : RÉSEAU et DONNÉES dans `donnees.js`, RENDU et STYLE dans `sections.js`, MOUVEMENT, DÉCLENCHEURS et ACCESSIBILITÉ dans `animations.js`. La correspondance est en tête de `main.js`. Dans `animer()`, chaque tween garde son `scrollTrigger` à côté de lui : MOUVEMENT et DÉCLENCHEURS n'y sont pas séparés ligne à ligne.
- **`matchMedia` simple** : quelques endroits hors des animations au défilement testent encore `matchMedia('(prefers-reduced-motion: reduce)')` directement, sans `gsap.matchMedia()` : l'écran de chargement (`main.js`), les jeux de typographie (`typo.js`) et la pastille de la navigation (`indicateur()`, durée 0). Ils ne bougent pas en mode calme, mais ne réagissent qu'au rechargement de la page.
- **`absolute`** : il ne vaut pas `true` mais la liste des cartes qui partent. Avec `true` pour toutes les cartes, la grille perd sa hauteur pendant l'animation et le pied de page saute.
- **La variable du filtre sans animation** s'appelle `enMouvement`, parce que `animer` est déjà le nom de la fonction qui lance les animations.
