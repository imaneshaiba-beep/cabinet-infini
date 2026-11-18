Shaiba Imane

# Le générique · Cabinet infini (API Are.na)

## Mes équivalents Are.na

L'API est libre : j'utilise Are.na à la place de Rick and Morty. Voici ce qui remplace chaque donnée de ma fiche :

| Ma fiche (Rick and Morty) | Mon équivalent Are.na | Pourquoi |
|---|---|---|
| Filtre `species=Poopybutthole` | `page=1&per=4&sort=position_asc` sur mes 4 chaînes (Style suisse, Typographie, Contemporain, Posters) | Les 4 plus anciennes affiches de chaque style : 16 cartes, et une sélection qui ne change plus |
| Nom | « Style suisse n° 1 »… (chaîne + position) | Les titres d'Are.na sont des noms de fichiers (« poster.jpg ») |
| Espèce | Le format du fichier (`image.content_type` : png, jpeg…) | |
| Origine | La personne qui a ajouté l'affiche (`user.name`) | Toujours présent, contrairement à `source` |
| Numéro du premier épisode (tri, instant d'entrée) | La position dans la chaîne (`connection.position`, de 1 à 4) | Un numéro par affiche dans sa chaîne, comme un numéro d'épisode |
| Nombre d'épisodes (compteur : leur total) | La largeur de l'image en pixels (`image.width`) | Total : 21062 px |
| Statut à trois couleurs (pastille) | L'orientation : portrait, paysage, carré | Toujours exactement trois valeurs |
| Personnage désigné : Noob-Noob (id 252) | « Contemporain n° 3 » (id 16807585) | |

## Les six réponses (une à trois lignes, avec mes mots)

**1. Quel réglage fixe le nombre de cartes et de pages ?**
C'est `FILTRE`, à la ligne 1 de `script.js`. `per=4` prend 4 affiches par chaîne, donc 4 × 4 = 16 cartes, et `page=1` choisit la page. Avec ce filtre, il y a 36 pages (Style suisse), 90 (Typographie), 218 (Contemporain) et 822 (Posters).

**2. `generique.pause(s + 0.2)` après l'entrée de mon élément désigné : quel attribut `style` obtient-il ?**
« Contemporain n° 3 » entre à 2 s, donc je tape `generique.pause(2.2)`. Sa carte a alors `translate: none; rotate: none; scale: none; opacity: 0.5781; transform: translate3d(25.3125px, 0px, 0px);`. Après 0,2 s, elle a fait un peu plus de la moitié du chemin : elle est encore à 25 px à droite et son opacité est de 0,58.

**3. Où changer la durée totale, et combien d'endroits faut-il toucher ?**
Dans la constante `DUREE`, à la ligne 141. Il n'y a qu'un seul endroit à changer. Le compteur (ligne 159), le disque (ligne 163) et l'instant des cartes (ligne 168) utilisent tous `DUREE`.

**4. À quelle seconde entre mon élément désigné ? Le calcul, avec le minimum et le maximum :**
Il entre à 2 s. Le calcul est à la ligne 168 : `(position − min) / (max − min) × DUREE`, avec `DUREE` = 3. Avec min = 1, max = 4 et position = 3, ça donne (3 − 1) / (4 − 1) × 3 = 2 s.

**5. Pourquoi la timeline ne peut-elle pas être construite avant la réponse de `fetch()` ?**
Avant la réponse, les cartes n'existent pas, donc GSAP n'aurait rien à animer. Les instants dépendent du min et du max, et le compteur dépend du total : ces valeurs viennent des données. C'est pour ça que dans `charger()`, `afficherCartes()` crée d'abord les cartes (ligne 40). Ensuite, `lancerGenerique()` (ligne 41) appelle `construireGenerique()`.

**6. Le test d'échappement avec `<img src=x onerror=alert(1)>`, en console : que se passe-t-il avec et sans la fonction d'échappement ?**
Avec `echapper()`, `<img src=x onerror=alert(1)>` s'affiche tel quel, comme du texte, et il ne se passe rien. Sans `echapper()` autour de `a.nom`, le navigateur crée une vraie image cassée, et `onerror` lance `alert(1)`. Un texte venu de l'API pourrait donc exécuter du code.
