const FILTRE = "page=1&per=4&sort=position_asc";
let generique;

/* Le générique du Cabinet infini, avec l'API Are.na (v3, sans clé).
   FILTRE est appliqué à chacune des quatre chaînes : les 4 plus anciennes affiches de chaque style,
   soit 16 cartes. « position_asc » garde toujours les mêmes : la sélection ne change pas.
   minimum (position) : 1
   maximum (position) : 4
   compteur attendu   : 21062 (la largeur des 16 affiches, en pixels, additionnée)
   nombre de pages du filtre : 36 (Style suisse), 90 (Typographie), 218 (Contemporain), 822 (Posters)
*/

// ZONE RÉSEAU
// Les quatre chaînes d'Are.na : chaque style est une chaîne publique.
const API = "https://api.are.na/v3/channels";
const CHAINES = [
    { slug: "swiss-international-typographic", nom: "Style suisse" },
    { slug: "typographic-posters", nom: "Typographie" },
    { slug: "prnt-poster-design", nom: "Contemporain" },
    { slug: "posters-1515988704", nom: "Posters" },
];
const message = document.querySelector(".message");
const commandes = document.querySelector(".commandes");

// Une chaîne : fetch() avec FILTRE. reponse.ok est faux pour une erreur (404, 500…) : on lance une erreur lisible.
async function lireChaine(chaine) {
    const reponse = await fetch(`${API}/${chaine.slug}/contents?${FILTRE}`);
    if (!reponse.ok) throw new Error(`Are.na répond ${reponse.status} pour « ${chaine.nom} ».`);
    const json = await reponse.json();
    return json.data.map(bloc => ({ bloc, chaine }));
}

// Les quatre chaînes en même temps (Promise.all), puis les données, les cartes et le générique.
// Tout est dans try/catch : en cas de problème, un message en clair et aucune exception.
async function charger() {
    try {
        const listes = await Promise.all(CHAINES.map(lireChaine));
        const affiches = preparer(listes.flat());
        if (affiches.length === 0) throw new Error("Aucune affiche ne correspond à ce filtre.");
        afficherCartes(affiches);
        lancerGenerique(affiches);
    } catch (erreur) {
        montrerErreur(`Impossible de charger les affiches : ${erreur.message}`);
    }
}

// Le message remplace les commandes ; le titre reste affiché tel quel.
function montrerErreur(texte) {
    message.textContent = texte;
    message.hidden = false;
    commandes.hidden = true;
}

// ZONE DONNÉES
// Mes équivalents (voir EXPLICATIONS.md) :
//   premier épisode  → la position de l'affiche dans sa chaîne (connection.position)
//   nombre d'épisodes → la largeur de l'image en pixels (image.width)
//   statut            → l'orientation : portrait, paysage ou carré
//   espèce            → le format du fichier (png, jpeg…) ; origine → la personne qui l'a ajoutée

// Portrait, paysage ou carré : « carré » quand la largeur et la hauteur diffèrent de moins de 5 %.
function orientation(largeur, hauteur) {
    if (Math.abs(largeur - hauteur) / Math.max(largeur, hauteur) < 0.05) return "carré";
    return largeur > hauteur ? "paysage" : "portrait";
}

// Ce qu'on garde de chaque bloc : seulement les images, puis le tri croissant par position (réglage E).
// Le tri garde l'ordre des chaînes quand deux affiches ont la même position.
function preparer(liste) {
    return liste
        .filter(({ bloc }) => bloc.type === "Image" && bloc.image)
        .map(({ bloc, chaine }) => ({
            id: bloc.id,
            nom: `${chaine.nom} n° ${bloc.connection.position}`, // les titres d'Are.na sont des noms de fichiers
            image: bloc.image.medium.src,
            espece: bloc.image.content_type.replace("image/", ""),
            origine: bloc.user.name.trim(),
            position: Number(bloc.connection.position),
            largeur: Number(bloc.image.width),
            orientation: orientation(bloc.image.width, bloc.image.height),
        }))
        .sort((a, b) => a.position - b.position);
}

// Le minimum, le maximum (pour l'instant d'entrée des cartes) et la valeur du compteur (réglage C).
function bornes(affiches) {
    const positions = affiches.map(a => a.position);
    return {
        min: Math.min(...positions),
        max: Math.max(...positions),
        total: affiches.reduce((somme, a) => somme + a.largeur, 0),
    };
}

// ZONE RENDU
const galerie = document.querySelector(".galerie");

// Comme htmlspecialchars() en PHP : un texte reçu de l'API ne doit jamais être lu comme du HTML.
function echapper(texte) {
    return String(texte)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Les trois classes de pastille, écrites en entier (jamais pastille--${...}).
const PASTILLES = {
    portrait: "pastille--un",
    paysage: "pastille--deux",
    carré: "pastille--trois",
};

// Une carte : image, nom, espèce (format), origine, premier épisode (position), nombre d'épisodes (largeur).
function carte(a) {
    return `
        <article class="carte" data-id="${echapper(a.id)}">
            <div class="carte__cadre">
                <img class="carte__image" src="${echapper(a.image)}" alt="${echapper(a.nom)}">
            </div>
            <span class="pastille ${PASTILLES[a.orientation]}" title="${echapper(a.orientation)}"></span>
            <p class="carte__nom">${echapper(a.nom)}</p>
            <p class="carte__infos">
                ${echapper(a.espece)} · ajoutée par ${echapper(a.origine)}<br>
                position ${echapper(a.position)} · ${echapper(a.largeur)} px de large
            </p>
        </article>`;
}

function afficherCartes(affiches) {
    galerie.innerHTML = affiches.map(carte).join("");
}

// ZONE STYLE
// rien ici

// ZONE MOUVEMENT
gsap.registerPlugin(SplitText, ScrollTrigger);

const DUREE = 3; // la durée totale du générique, en secondes : le seul endroit à changer

// La timeline du générique. Elle est appelée dans gsap.matchMedia() (zone ACCESSIBILITÉ),
// seulement quand les animations sont permises, et une fois les cartes dans la page.
function construireGenerique(affiches) {
    const { min, max, total } = bornes(affiches);
    const decoupe = SplitText.create(".titre", { type: "chars" });

    generique = gsap.timeline();

    // T : les lettres du titre tombent depuis le haut, dans un ordre aléatoire.
    generique.from(decoupe.chars, {
        y: -30, opacity: 0, duration: 0.6, ease: "power3.out",
        stagger: { each: 0.03, from: "random" },
    }, 0);

    // C : le compteur monte de 0 au total des largeurs, en 3 s, à vitesse constante, sans décimales.
    generique.fromTo(".compteur", { textContent: 0 }, {
        textContent: total, duration: DUREE, ease: "none", snap: { textContent: 1 },
    }, 0);

    // J : le disque grandit de 0 à 1 pendant exactement 3 s.
    generique.fromTo(".jauge__disque", { scale: 0 }, { scale: 1, duration: DUREE, ease: "none" }, 0);

    // E : chaque carte entre depuis la droite, à un instant proportionnel à sa position.
    // Position la plus petite → 0 s, la plus grande → 3 s. Un nombre (position absolue), pas de stagger.
    gsap.utils.toArray(".carte").forEach((carte, i) => {
        const instant = max === min ? 0 : (affiches[i].position - min) / (max - min) * DUREE;
        generique.from(carte, { x: 60, opacity: 0, duration: 0.8, ease: "power2.out" }, instant);
        // La pastille apparaît en même temps que sa carte ("<" = au début du tween précédent).
        generique.from(carte.querySelector(".pastille"), { scale: 0, duration: 0.5, ease: "back.out(3)" }, "<");
    });

    // La vitesse choisie avant (curseur) s'applique aussi à cette timeline.
    generique.timeScale(Number(curseur.value));

    // Bonus : la section du bas se révèle au défilement (ScrollTrigger + scrub), créée après les cartes.
    gsap.from(".suite__contenu", {
        y: 120, opacity: 0, ease: "none",
        scrollTrigger: { trigger: ".suite", start: "top bottom", end: "center center", scrub: true },
    });

    return decoupe;
}

// S : au survol, l'image passe du gris à la couleur. Hors de la timeline :
// le survol ne touche que filter, que le générique n'anime pas, donc Rejouer reste complet.
function brancherSurvol() {
    gsap.utils.toArray(".carte").forEach((carte) => {
        const image = carte.querySelector(".carte__image");
        gsap.set(image, { filter: "grayscale(1)" });
        carte.addEventListener("mouseenter", () => {
            gsap.to(image, { filter: "grayscale(0)", duration: 0.4, ease: "power1.out", overwrite: "auto" });
        });
        carte.addEventListener("mouseleave", () => {
            gsap.to(image, { filter: "grayscale(1)", duration: 0.4, ease: "power1.out", overwrite: "auto" });
        });
    });
}

// ZONE ACCESSIBILITÉ
const mm = gsap.matchMedia();
const rejouer = document.querySelector(".rejouer");
const curseur = document.querySelector(".vitesse__curseur");
const valeur = document.querySelector(".vitesse__valeur");

// Une seule timeline, generique, construite dans gsap.matchMedia().
// Avec « réduire les animations », tout est affiché d'emblée dans son état final, compteur compris.
function lancerGenerique(affiches) {
    mm.add("(prefers-reduced-motion: no-preference)", () => {
        const decoupe = construireGenerique(affiches);
        return () => decoupe.revert(); // si la préférence change : le titre redevient du texte normal
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
        generique = gsap.timeline();
        generique.set(".compteur", { textContent: bornes(affiches).total }, 0);
        generique.set(".jauge__disque", { scale: 1 }, 0);
    });

    brancherSurvol(); // hors de gsap.matchMedia()
    ScrollTrigger.refresh(); // les cartes ont changé la hauteur de la page
}

// Rejouer : generique.restart(), et rien d'autre. La vitesse (timeScale) reste celle du curseur.
rejouer.addEventListener("click", () => generique?.restart());

// La vitesse, de 0,25 à 2 : elle pilote timeScale() et s'affiche à côté du curseur.
curseur.addEventListener("input", () => {
    const vitesse = Number(curseur.value);
    generique?.timeScale(vitesse);
    valeur.textContent = vitesse;
});

// Le départ : tout le script est lu, on peut charger.
charger();
