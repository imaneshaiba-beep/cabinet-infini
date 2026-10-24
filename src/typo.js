// ============================================================
//  Les jeux de typographie, avec la bascule de bascule.js
//    Les liens de la navigation basculent en italique au survol,
//    le mot « affiche » change de langue tout seul,
//    et le titre de la collection prend le nom du filtre choisi.
// ============================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { creerBascule } from './bascule.js';

gsap.registerPlugin(ScrollTrigger);

const reduire = matchMedia('(prefers-reduced-motion: reduce)');

// [le mot, la langue, son style] : on passe d'une serif italique à une linéale serrée, comme sur une affiche.
const LANGUES = [
    ['Affiche', 'en français', 'font-display italic'],
    ['Poster', 'en anglais', 'font-medium uppercase tracking-[-0.06em]'],
    ['Plakat', 'en allemand', 'font-display'],
    ['Cartel', 'en espagnol', 'font-medium tracking-[-0.06em]'],
    ['Manifesto', 'en italien', 'font-display italic'],
    ['Affisch', 'en suédois', 'font-medium uppercase tracking-[-0.06em]'],
    ['Αφίσα', 'en grec', 'font-display'],
    ['ポスター', 'en japonais', 'font-medium tracking-[-0.02em]'],
    ['Juliste', 'en finnois', 'font-display italic'],
    ['Plakát', 'en tchèque', 'font-medium uppercase tracking-[-0.06em]'],
];

// La largeur d'un mot avec ses classes, mesurée dans le lien sans être vue.
function largeurDe(lien, texte, classe) {
    const essai = document.createElement('span');
    essai.className = `invisible absolute whitespace-pre ${classe}`;
    essai.textContent = texte;
    lien.append(essai);
    const largeur = essai.getBoundingClientRect().width;
    essai.remove();
    return largeur;
}

// La navigation : au survol (ou au clavier), chaque lien bascule vers sa version italique.
// La bascule va dans un span : sur le lien lui-même, elle écraserait « hidden sm:block ».
export function navigationTypo() {
    for (const lien of document.querySelectorAll('#nav a')) {
        const texte = lien.textContent.trim();
        const marque = lien.getAttribute('href') === '#accueil';
        const repos = texte;
        const survol = marque ? 'Cabinet ∞' : texte;
        const classeSurvol = marque ? '' : 'font-display italic text-[1.15em] leading-none';

        lien.textContent = '';
        // « Cabinet » reste calé à gauche : seul « infini » devient « ∞ ».
        const span = lien.appendChild(document.createElement('span'));
        const bascule = creerBascule(span, { aligner: marque ? 'start' : 'center', duree: 0.3, decalage: 0.025 });
        bascule.afficher(repos, '', { immediat: true });

        // Le lien garde la largeur du plus long de ses deux mots : sinon la barre, centrée,
        // se resserre ou s'élargit à chaque survol. Mesuré une fois les polices chargées, et à chaque
        // redimensionnement (un lien caché sur téléphone mesure 0 et réapparaît sur un grand écran).
        const reserver = () => {
            const style = getComputedStyle(span);
            const marges = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
            span.style.minWidth = `${Math.ceil(Math.max(largeurDe(lien, repos, ''), largeurDe(lien, survol, classeSurvol)) + marges)}px`;
        };
        document.fonts.ready.then(reserver);
        addEventListener('resize', reserver);

        const entrer = () => bascule.afficher(survol, classeSurvol);
        const sortir = () => bascule.afficher(repos, '');
        lien.addEventListener('pointerenter', entrer);
        lien.addEventListener('pointerleave', sortir);
        lien.addEventListener('focus', entrer);
        lien.addEventListener('blur', sortir);
    }
}

// Les deux autres jeux. Leurs ScrollTrigger sont créés par brancher(), après les sections
// épinglées (animations.js) : sinon leurs positions ne compteraient pas le temps d'épinglage.
export function preparerTypo() {
    // « Une affiche se dit… »
    const mot = creerBascule(document.getElementById('langueMot'), { aligner: 'center', duree: 0.55, decalage: 0.06 });
    const langue = creerBascule(document.getElementById('langueNom'), { aligner: 'center', duree: 0.35, decalage: 0.02 });
    let n = 0;
    const montrer = (immediat = false) => {
        const [texte, nom, classe] = LANGUES[n];
        mot.afficher(texte, classe, { immediat });
        langue.afficher(nom, '', { immediat });
    };
    montrer(true);

    // Le titre de la collection
    const titre = document.getElementById('collectionTitre');
    const repos = titre.textContent.trim();
    const bascule = creerBascule(titre, { duree: 0.5, decalage: 0.035 });
    if (reduire.matches) bascule.afficher(repos, '', { immediat: true });

    function brancher() {
        if (reduire.matches) return;
        // Les langues ne défilent que lorsque la section est à l'écran.
        let minuterie = null;
        ScrollTrigger.create({
            trigger: '#langues', start: 'top 70%', end: 'bottom 30%',
            onToggle: (self) => {
                clearInterval(minuterie);
                if (!self.isActive) return;
                const avancer = () => { n = (n + 1) % LANGUES.length; montrer(); };
                avancer();
                minuterie = setInterval(avancer, 1700);
            },
        });
        // Le titre de la collection se déplie depuis le vide quand on arrive dessus.
        ScrollTrigger.create({ trigger: titre, start: 'top 85%', once: true, onEnter: () => bascule.afficher(repos) });
    }

    // Un filtre choisi : le titre bascule vers le nom de la chaîne, en italique.
    function choisirChaine(nom) {
        bascule.afficher(nom ?? repos, nom ? 'italic' : '');
    }

    return { brancher, choisirChaine };
}
