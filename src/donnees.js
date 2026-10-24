// ============================================================
//  Les données : des affiches choisies par des graphistes sur Are.na
//    Quatre chaînes publiques, lues sans clé avec l'API v3 d'Are.na
//    (30 appels par minute et par visiteur). Une première page de
//    chacune au départ, puis une page tirée au hasard toutes les
//    douze secondes : la collection grandit sans fin.
// ============================================================

const API = 'https://api.are.na/v3/channels';
const PAR_PAGE = 40;
const NOURRIR_TOUTES_LES = 12000; // ms entre deux nouvelles pages
const PATIENCE = 60000;           // ms d'attente quand Are.na demande de ralentir (erreur 429)

export const CHAINES = [
    { slug: 'swiss-international-typographic', nom: 'Style suisse' },
    { slug: 'typographic-posters', nom: 'Typographie' },
    { slug: 'prnt-poster-design', nom: 'Contemporain' },
    { slug: 'posters-1515988704', nom: 'Posters' },
];

export const affiches = [];   // toutes les affiches reçues, sans doublon
export const stats = { total: 0, arrivees: 0 };

const dejaRecues = new Set();
const abonnes = new Set();
let pioche = 0;

// Prévenir les autres parties du site quand de nouvelles affiches arrivent.
export function quandArrivent(fonction) {
    abonnes.add(fonction);
}

async function lire(url) {
    const reponse = await fetch(url);
    if (reponse.status === 429) throw new Error('Are.na est débordé, réessayez dans une minute');
    if (!reponse.ok) throw new Error(`Are.na répond ${reponse.status}`);
    return reponse.json();
}

// Les titres d'Are.na sont souvent vides, « image » ou un nom de fichier : on les écarte.
// DOMParser décode « &amp; » sans jamais exécuter de HTML.
function nettoyer(titre) {
    const texte = new DOMParser().parseFromString(titre ?? '', 'text/html').documentElement.textContent.trim();
    const brouillon = !texte || texte === 'image'
        || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(texte)  // un nom de fichier
        || /\d{6,}|^[0-9a-f]{16,}/i.test(texte)               // un long numéro
        || /^(\[image\]|img_|screen ?shot|capture d)/i.test(texte);
    if (brouillon) return null;
    return texte;
}

function versAffiche(bloc, chaine) {
    return {
        id: bloc.id,
        titre: nettoyer(bloc.title), // null quand il n'y a pas de vrai titre
        chaine,
        petite: bloc.image.small.src,  // 400 px de côté au plus
        grande: bloc.image.medium.src, // 1200 px
        lien: `https://www.are.na/block/${bloc.id}`,
    };
}

// Une page d'une chaîne. Sa réponse dit aussi combien la chaîne a de pages et de blocs (meta).
async function chargerPage(chaine, page) {
    const { data, meta } = await lire(`${API}/${chaine.slug}/contents?page=${page}&per=${PAR_PAGE}&sort=position_desc`);
    chaine.pages = Math.max(1, meta.total_pages);
    chaine.taille = meta.total_count;
    return data.filter(b => b.type === 'Image' && b.image).map(b => versAffiche(b, chaine));
}

function melanger(liste) {
    for (let i = liste.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return liste;
}

function ajouter(liste) {
    const nouvelles = liste.filter(a => !dejaRecues.has(a.id));
    nouvelles.forEach(a => dejaRecues.add(a.id));
    // Glissées juste devant la pioche : ce sont elles qui apparaîtront ensuite.
    affiches.splice(pioche, 0, ...melanger(nouvelles));
    stats.arrivees = affiches.length;
    abonnes.forEach(f => f(nouvelles));
}

export function suivante() {
    const affiche = affiches[pioche];
    pioche = (pioche + 1) % affiches.length;
    return affiche;
}

// Une page tirée au hasard dans une chaîne tirée au hasard.
async function nourrir() {
    const chaine = CHAINES[Math.floor(Math.random() * CHAINES.length)];
    let attente = NOURRIR_TOUTES_LES;
    try {
        ajouter(await chargerPage(chaine, 1 + Math.floor(Math.random() * chaine.pages)));
    } catch (erreur) {
        console.error('Affiches :', erreur); // pas grave : on réessaiera, en laissant souffler Are.na
        attente = PATIENCE;
    }
    setTimeout(nourrir, attente);
}

// La réserve : deux pages de chaque chaîne, copiées dans le site (npm run reserve, public/reserve.json).
// Lue seulement quand Are.na ne répond pas : le cabinet s'ouvre quand même.
async function chargerReserve() {
    const reponse = await fetch(`${import.meta.env.BASE_URL}reserve.json`);
    if (!reponse.ok) throw new Error(`réserve introuvable (${reponse.status})`);
    const { chaines } = await reponse.json();
    return CHAINES.map((chaine) => {
        const r = chaines[chaine.slug];
        chaine.pages = r.pages;
        chaine.taille = r.taille;
        return r.blocs.map(b => versAffiche({ id: b.id, title: b.title, image: { small: { src: b.petite }, medium: { src: b.grande } } }, chaine));
    });
}

// Le départ : la première page de chaque chaîne, qui donne aussi sa taille.
// progres(fraction, etape) est appelé après chacun des 4 appels, pour l'écran de chargement.
export async function charger(progres = () => {}) {
    let faits = 0;
    const suivre = (promesse, etape) => promesse.then((r) => { progres(++faits / CHAINES.length, etape); return r; });

    let premieres;
    try {
        premieres = await Promise.all(CHAINES.map(c => suivre(chargerPage(c, 1), c.nom)));
    } catch (erreur) {
        console.warn('Affiches : Are.na ne répond pas, le cabinet part de sa réserve.', erreur);
        // Si même la réserve manque, c'est l'erreur d'Are.na qu'on montre : c'est elle qui compte.
        premieres = await chargerReserve().catch(() => { throw erreur; });
        progres(1, 'Réserve du cabinet');
    }
    stats.total = CHAINES.reduce((somme, c) => somme + c.taille, 0);
    ajouter(premieres.flat());
    setTimeout(nourrir, NOURRIR_TOUTES_LES);
}

// Les images, chargées une seule fois. crossOrigin : sans lui, WebGL refuse de les lire.
const images = new Map();

export function imageDe(affiche, grande = false) {
    const url = grande ? affiche.grande : affiche.petite;
    let img = images.get(url);
    if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { img.prete = performance.now(); };
        img.src = url;
        images.set(url, img);
    }
    return img;
}
