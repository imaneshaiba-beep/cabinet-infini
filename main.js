// ============================================================
//  Cabinet infini — le point de départ
//    L'écran de chargement, puis les données (donnees.js), le carrousel
//    en verre liquide (carrousel.js), le contenu des sections (sections.js),
//    les animations (animations.js) et les jeux de typographie (typo.js).
// ============================================================

import { gsap } from 'gsap';
import { charger, quandArrivent, affiches } from './donnees.js';
import { demarrerCarrousel, lancerEntree, reglerSortie, descenteMax } from './carrousel.js';
import { remplirSelection, ajouterCartes, preparerFiltres } from './sections.js';
import { animer, reveler, revelerTout, majChiffres, rafraichir } from './animations.js';
import { creerBascule } from './bascule.js';
import { navigationTypo, preparerTypo } from './typo.js';

const MOTS_CHARGEMENT = ['Cabinet', 'infini', 'Affiches', 'Typographie', 'Style suisse', 'Contemporain'];
const DUREE_MINIMUM = 3200; // ms : le temps de voir au moins quelques mots basculer
const MOT_TOUTES_LES = 1100; // ms : un mot a le temps de se poser avant le suivant

const entier = new Intl.NumberFormat('fr-FR');
const reduire = matchMedia('(prefers-reduced-motion: reduce)');
const compteur = document.getElementById('compteur');
const chargeur = document.getElementById('chargeur');
const chargeurEtape = document.getElementById('chargeurEtape');
const reessayer = document.getElementById('reessayer');
// La frange fine de la typo liquide (style.css) : les lettres y reviennent une fois posées.
const FRANGE_REPOS = '-0.03em 0 0 rgb(255 45 85 / 0.4), 0.03em 0 0 rgb(30 107 255 / 0.45)';
const chargeurMot = creerBascule(document.getElementById('chargeurMot'), { aligner: 'center', repos: FRANGE_REPOS });
// Une bascule par chiffre : seuls les chiffres qui changent basculent (000 → 025 → 050…).
const chiffres = [...document.getElementById('chargeurPourcent').children]
    .map(el => creerBascule(el, { aligner: 'center', duree: 0.35, decalage: 0 }));
let pourcent = '000';

const attendre = ms => new Promise(r => setTimeout(r, ms));

// Toujours repartir du haut, page bloquée tant que l'écran de chargement est là.
history.scrollRestoration = 'manual';
scrollTo(0, 0);
document.documentElement.classList.add('overflow-hidden');

// Chaque nouvelle page d'affiches fait monter les compteurs.
quandArrivent(() => {
    compteur.textContent = entier.format(affiches.length);
    majChiffres();
});

navigationTypo();
const typo = preparerTypo();

// ------------------------------------------------------------
//  L'écran de chargement
// ------------------------------------------------------------
function afficherPourcent(texte, immediat = false) {
    [...texte].forEach((chiffre, i) => {
        if (immediat || chiffre !== pourcent[i]) chiffres[i].afficher(chiffre, '', { immediat });
    });
    pourcent = texte;
}

// À chaque nouveau mot, une onde traverse la typo : la déformation monte d'un coup puis retombe,
// et le mot s'écrase un peu avant de rebondir, comme une goutte qui se pose.
function onduler() {
    if (reduire.matches) return;
    gsap.fromTo('#typoDeformation', { attr: { scale: 26 } }, { attr: { scale: 3 }, duration: 1.2, ease: 'power3.out', overwrite: true });
    gsap.fromTo('#chargeurTypo', { scaleX: 1.04, scaleY: 0.93 }, { scaleX: 1, scaleY: 1, duration: 1.1, ease: 'elastic.out(1, 0.4)', overwrite: true });
}

let tour = 0;
let minuterie = null;
function motSuivant() {
    chargeurMot.afficher(MOTS_CHARGEMENT[tour++ % MOTS_CHARGEMENT.length]);
    onduler();
}

// Au repos aussi, le bruit du filtre ondule lentement : les lettres ne sont jamais tout à fait immobiles.
function animerTypoLiquide() {
    if (reduire.matches) {
        document.getElementById('typoDeformation').setAttribute('scale', '0');
        return;
    }
    gsap.to('#typoBruit', { attr: { baseFrequency: '0.017 0.03' }, duration: 2.8, ease: 'sine.inOut', repeat: -1, yoyo: true });
}

// La typo d'abord : sans ça, les premiers mots s'affichent un instant dans la police de secours.
function polices() {
    const chargees = Promise.all([
        document.fonts.load('400 1em "Instrument Serif"'),
        document.fonts.load('italic 400 1em "Instrument Serif"'),
        document.fonts.load('500 1em Inter'),
    ]);
    return Promise.race([chargees, attendre(2500)]);
}

function apparaitre() {
    if (reduire.matches) {
        gsap.set('#chargeurContenu', { opacity: 1 });
        return;
    }
    gsap.to('#chargeurContenu', { opacity: 1, duration: 0.6 });
}

async function demarrer() {
    reessayer.hidden = true;
    chargeurEtape.textContent = 'Connexion à Are.na';
    afficherPourcent('000', true);
    const debut = performance.now();

    // Le réseau part tout de suite, pendant qu'on attend les polices. L'erreur éventuelle est gardée pour plus bas.
    const chargement = charger((fraction, etape) => {
        afficherPourcent(String(Math.round(fraction * 100)).padStart(3, '0'));
        chargeurEtape.textContent = etape;
    }).then(() => null, erreur => erreur);

    await polices();
    apparaitre();
    motSuivant();
    minuterie = setInterval(motSuivant, MOT_TOUTES_LES);

    const erreur = await chargement;
    if (erreur) {
        console.error('Affiches :', erreur);
        clearInterval(minuterie);
        chargeurMot.afficher('Oups');
        onduler();
        chargeurEtape.textContent = `Impossible de charger les affiches : ${erreur.message}`;
        reessayer.hidden = false;
        return;
    }

    // Les sections se remplissent derrière l'écran de chargement.
    remplirSelection();
    preparerFiltres({ avant: revelerTout, apres: rafraichir, choix: typo.choisirChaine });
    const premieres = ajouterCartes(24);

    await attendre(Math.max(0, DUREE_MINIMUM - (performance.now() - debut)));
    clearInterval(minuterie);
    chargeurMot.afficher('Cabinet infini', 'italic');
    onduler();
    await attendre(reduire.matches ? 0 : 1300);
    sortir(premieres);
}

// Le carrousel et les animations démarrent au moment où l'écran de chargement se retire.
function lancer(premieres) {
    document.documentElement.classList.remove('overflow-hidden');
    lancerEntree();
    animer({ reglerSortie, descenteMax });
    typo.brancher();
    reveler(premieres);
}

function sortir(premieres) {
    if (reduire.matches) {
        chargeur.hidden = true;
        lancer(premieres);
        return;
    }
    // La typo se liquéfie (la déformation s'emballe) et s'envole, puis l'écran blanc remonte comme un rideau.
    gsap.timeline({ onComplete: () => { chargeur.hidden = true; gsap.killTweensOf('#typoBruit'); } })
        .to('#typoDeformation', { attr: { scale: 70 }, duration: 0.7, ease: 'power2.in' })
        .to('#chargeurContenu', { yPercent: -60, opacity: 0, filter: 'blur(6px)', duration: 0.6, ease: 'power3.in' }, '<0.15')
        .add(() => lancer(premieres), '-=0.2')
        .to(chargeur, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'expo.inOut' }, '<');
}

// « Encore des affiches » : la suite de la galerie, prise dans la liste qui grandit.
document.getElementById('encore').addEventListener('click', () => {
    reveler(ajouterCartes(12));
    rafraichir();
});
reessayer.addEventListener('click', demarrer);

animerTypoLiquide();
demarrerCarrousel();
demarrer();
