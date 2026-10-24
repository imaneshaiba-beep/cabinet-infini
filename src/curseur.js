// ============================================================
//  Le curseur : un « ∞ » de verre liquide
//    Le signe du cabinet, en Instrument Serif italique, suit la souris.
//    Plus il va vite, plus il se sépare en rouge et bleu (la frange de
//    la lentille), ondule (la typo liquide) et penche dans le sens du geste.
//    Sur ce qu'on peut faire, il bascule lettre par lettre vers le geste :
//    « Glisser », « Voir », « ↗ », « → ». En mélange « différence »,
//    il est noir sur le blanc et passe en négatif sur les affiches.
//    Seulement avec une souris ; la flèche revient quand il s'en va.
// ============================================================

import { gsap } from 'gsap';
import { creerBascule } from './bascule.js';

// Le mélange « différence » inverse les couleurs : pour obtenir du rouge et du bleu
// sur le blanc, la frange est écrite dans leurs complémentaires (cyan et orangé).
const ROUGE_INVERSE = 'rgb(0 210 170 / 0.9)';
const BLEU_INVERSE = 'rgb(225 148 0 / 0.9)';

const ETATS = {
    repos: { texte: '∞', classe: 'text-[2.6rem]' },
    lien: { texte: '→', classe: 'text-[1.9rem]' },
    externe: { texte: '↗', classe: 'text-[1.9rem]' },
    glisser: { texte: 'Glisser', classe: 'text-[1.35rem]' },
    voir: { texte: 'Voir', classe: 'text-[1.35rem]' },
};

export function curseur() {
    // Son propre filtre liquide : on règle la déformation selon la vitesse, sans toucher à celui du chargement.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'absolute size-0');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
        <filter id="curseur-liquide" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="bruit"/>
            <feDisplacementMap in="SourceGraphic" in2="bruit" scale="1" xChannelSelector="R" yChannelSelector="G"/>
        </filter>`;
    const deformation = svg.querySelector('feDisplacementMap');

    const racine = document.createElement('div');
    racine.className = 'pointer-events-none fixed top-0 left-0 z-50 opacity-0 mix-blend-difference transition-opacity duration-300';
    racine.setAttribute('aria-hidden', 'true');
    const signe = document.createElement('div');
    signe.className = 'font-display leading-none whitespace-nowrap text-white italic [filter:url(#curseur-liquide)]';
    racine.append(signe);
    document.body.append(svg, racine);
    document.documentElement.classList.add('sans-fleche');

    const volet = signe.appendChild(document.createElement('span'));
    const mot = creerBascule(volet, { aligner: 'center', duree: 0.32, decalage: 0.03 });
    // Le masque de la bascule, élargi : la frange s'écarte jusqu'à 7 px et ne doit pas être coupée.
    Object.assign(volet.style, { padding: '0.35em 0.4em', margin: '-0.35em -0.4em' });
    gsap.set(signe, { xPercent: -50, yPercent: -50 });

    const allerX = gsap.quickTo(racine, 'x', { duration: 0.35, ease: 'power3' });
    const allerY = gsap.quickTo(racine, 'y', { duration: 0.35, ease: 'power3' });
    let actuel = null;

    function changer(nom) {
        if (nom === actuel) return;
        actuel = nom;
        mot.afficher(ETATS[nom].texte, ETATS[nom].classe, { immediat: !racine.style.opacity });
    }

    const suivre = (e) => {
        allerX(e.clientX);
        allerY(e.clientY);
        racine.style.opacity = 1;
    };
    // Au premier mouvement, le signe apparaît sous la souris au lieu de traverser l'écran depuis le coin.
    const placer = (e) => gsap.set(racine, { x: e.clientX, y: e.clientY });

    const survoler = (e) => {
        const cible = e.target.closest('a, button, #carrousel');
        if (!cible) changer('repos');
        else if (cible.id === 'carrousel') changer('glisser');
        else if (cible.matches('.carte-grille')) changer('voir');
        else if (cible.target === '_blank') changer('externe');
        else changer('lien');
    };

    // À chaque image : la vitesse (lissée) écarte la frange, fait onduler et pencher le signe.
    const vitesse = { x: 0, y: 0 };
    let avant = null;
    const reagir = () => {
        const x = gsap.getProperty(racine, 'x');
        const y = gsap.getProperty(racine, 'y');
        if (avant) {
            vitesse.x += (x - avant.x - vitesse.x) * 0.3;
            vitesse.y += (y - avant.y - vitesse.y) * 0.3;
        }
        avant = { x, y };
        const ecart = (v) => gsap.utils.clamp(-7, 7, v * 0.35);
        const dx = ecart(vitesse.x) || 0.6; // au repos, une frange fine, comme la typo liquide
        const dy = ecart(vitesse.y);
        signe.style.textShadow = `${-dx}px ${-dy}px 0 ${ROUGE_INVERSE}, ${dx}px ${dy}px 0 ${BLEU_INVERSE}`;
        deformation.setAttribute('scale', Math.min(1 + Math.hypot(vitesse.x, vitesse.y) * 0.6, 16).toFixed(1));
        gsap.set(signe, { rotation: gsap.utils.clamp(-18, 18, vitesse.x * 0.6) });
    };

    // Un clic : le signe se resserre un instant, comme une pression sur du verre.
    const appuyer = () => gsap.to(signe, { scale: 0.75, duration: 0.18, ease: 'power3.out' });
    const relacher = () => gsap.to(signe, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    const cacher = () => { racine.style.opacity = 0; };

    changer('repos');
    addEventListener('pointermove', placer, { once: true });
    addEventListener('pointermove', suivre);
    document.addEventListener('pointerover', survoler);
    addEventListener('pointerdown', appuyer);
    addEventListener('pointerup', relacher);
    document.documentElement.addEventListener('pointerleave', cacher);
    gsap.ticker.add(reagir);

    return () => {
        removeEventListener('pointermove', placer);
        removeEventListener('pointermove', suivre);
        document.removeEventListener('pointerover', survoler);
        removeEventListener('pointerdown', appuyer);
        removeEventListener('pointerup', relacher);
        document.documentElement.removeEventListener('pointerleave', cacher);
        gsap.ticker.remove(reagir);
        document.documentElement.classList.remove('sans-fleche');
        racine.remove();
        svg.remove();
    };
}
