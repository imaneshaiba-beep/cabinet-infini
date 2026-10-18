# Cabinet infini : plan du projet

Une galerie infinie d'objets de design (chaises, affiches, timbres…), alimentée par une API de musée, animée avec GSAP et mise en ligne sur Netlify. Projet pour mon portfolio.

Pour démarrer vite : faire les étapes 1 à 6 d'abord, même avec un design simple. Une fois que la galerie fonctionne, revenir au design et à l'animation.

---

## 1. Choisir le sujet et tester l'API

- [ ] Choisir un thème : chaises, affiches, timbres, céramiques…
- [ ] Tester l'API **directement dans le navigateur**, avant d'écrire du code. Exemple avec l'Art Institute of Chicago :
  `https://api.artic.edu/api/v1/artworks/search?q=chair&page=1&limit=20&fields=id,title,artist_display,date_display,image_id`
- [ ] Regarder ce que la réponse contient : les noms des champs, la pagination, et comment construire l'adresse d'une image à partir de `image_id` (vérifier le format exact dans leur documentation).
- [ ] S'il n'y a pas assez d'images avec photo pour le thème, changer de thème ou d'API.

| API | Clé ? | Remarque |
|---|---|---|
| Art Institute of Chicago (`api.artic.edu`) | Non | 20 objets complets par appel : idéal pour le défilement infini |
| Metropolitan Museum (`collectionapi.metmuseum.org`) | Non | Renvoie une liste de numéros, puis demande un appel par objet : plus lent |
| Unsplash, Pexels… | Oui | À garder pour plus tard (voir le bonus) |

## 2. Le design d'abord (Figma)

- [ ] Moodboard et direction graphique : typo, couleurs, ambiance.
- [ ] Trois écrans : la galerie, une carte (au repos et au survol), la vue détail d'un objet.
- [ ] La version mobile.

C'est ce qui fera la différence avec les projets de développeurs.

## 3. Créer le projet

```bash
npm create vite@latest cabinet-infini
cd cabinet-infini
npm install
npm install tailwindcss @tailwindcss/vite
```

- [ ] Configurer Tailwind comme dans le projet NT-API-Monde (`vite.config.js`).
- [ ] `git init`, créer le dépôt `cabinet-infini` sur GitHub, premier push.

## 4. Premier appel API

- [ ] Un `fetch()` qui récupère 20 objets, puis un `console.log` pour regarder les données.
- [ ] Gérer les deux cas comme dans `pays.js` : « Chargement… » pendant l'attente, et un message clair si l'API ne répond pas.

## 5. La grille de cartes

- [ ] Une fonction `carte(objet)` qui renvoie le HTML d'une carte, comme `fiche(p)` dans `pays.js`.
- [ ] Reprendre `echapper()` pour tous les textes reçus de l'API.
- [ ] `loading="lazy"` sur les images, un `alt` avec le titre de l'objet, et des images à la bonne taille plutôt qu'en pleine résolution.

## 6. Le défilement infini

- [ ] Placer un élément vide (une « sentinelle ») en bas de la grille.
- [ ] Un `IntersectionObserver` détecte quand on arrive dessus : `page++`, `fetch()`, et **ajouter** les nouvelles cartes à la suite, sans remplacer les anciennes.
- [ ] Piège 1 : ne pas lancer un nouvel appel tant que le précédent n'est pas terminé.
- [ ] Piège 2 : s'arrêter à la dernière page.

## 7. L'animation (GSAP)

- [ ] Les nouvelles cartes arrivent en cascade (`stagger`), comme `cascade()` dans `pays.js`.
- [ ] Le survol avec `overwrite: "auto"`.
- [ ] `gsap.matchMedia()` pour respecter « réduire les animations ».
- [ ] Après la séance 11 : ScrollTrigger pour animer au défilement, et Flip pour animer les filtres.

## 8. Filtres et vue détail

- [ ] Filtres par décennie, matière ou designer, animés avec Flip.
- [ ] Un clic sur une carte ouvre une grande image avec les informations de l'objet.
- [ ] *En option :* un petit graphique, par exemple une frise du nombre d'objets par décennie, qui sert aussi de filtre.

## 9. Mise en ligne sur Netlify

- [ ] Sur netlify.com : **Add new site → Import from Git**, choisir le dépôt `cabinet-infini`.
- [ ] Réglage du build : commande `npm run build`, dossier `dist`. On peut aussi copier ce fichier `netlify.toml` :
  ```toml
  [build]
    command = "npm run build"
    publish = "dist"
  ```
- [ ] Personnaliser l'adresse, par exemple `cabinet-infini.netlify.app`.

Ensuite, chaque `git push` sur `main` met le site à jour tout seul.

## 10. Finitions

- [ ] Vérifier sur téléphone.
- [ ] Audit Lighthouse dans Chrome (onglet Lighthouse des outils de développement) : vitesse et accessibilité.
- [ ] Vérifier ce qui se passe si l'API est lente ou ne répond pas.

## 11. Le présenter dans le portfolio

- [ ] Le lien vers le site en ligne, le lien GitHub, et une capture ou un GIF.
- [ ] Trois lignes d'explication, par exemple : « Les images viennent de l'API de l'Art Institute of Chicago. Le défilement infini charge 20 objets à la fois. Les animations sont faites avec GSAP. »
- [ ] Un README propre sur GitHub.

## Plus tard (bonus)

Pour utiliser une API avec clé (Unsplash, Pexels…), cacher la clé dans une **Netlify Function** au lieu de la mettre dans le JavaScript. Sinon, n'importe qui peut la lire dans le code de la page.
