// ============================================================
//  La bascule : un mot remplace l'autre lettre par lettre
//    Chaque lettre de l'ancien mot pivote sur son bord du haut et disparaît,
//    pendant que la lettre du nouveau mot pivote depuis son bord du bas,
//    de gauche à droite (400 ms par lettre, 44 ms entre deux lettres).
//    Le tout dans un masque : les lettres basculent sur place, comme des volets.
//    Pendant le trajet, chaque lettre se sépare en rouge et bleu,
//    comme sous la lentille du carrousel, puis redevient nette.
// ============================================================

import { gsap } from 'gsap';

const reduire = matchMedia('(prefers-reduced-motion: reduce)');

// La frange du verre liquide : rouge d'un côté, bleu de l'autre (en em, pour suivre la taille du texte)
const FRANGE = '-0.06em 0 0 rgb(255 45 85 / 0.75), 0.06em 0 0 rgb(30 107 255 / 0.75)';
const NETTE = '0em 0 0 rgb(255 45 85 / 0), 0em 0 0 rgb(30 107 255 / 0)';

// Transforme un élément en bascule ; renvoie { afficher(texte, classe) }.
// classe : des classes pour ce mot seulement (une autre police, l'italique…).
// fluide : la largeur de l'élément glisse d'un mot à l'autre (pour une capsule autour du mot).
// repos : l'ombre des lettres une fois posées (par défaut aucune ; la typo liquide garde sa frange fine).
export function creerBascule(el, { duree = 0.4, decalage = 0.044, aligner = 'start', fluide = false, repos = NETTE } = {}) {
    el.classList.add('bascule');
    el.style.justifyItems = aligner;
    // Quand la capsule rétrécit plus vite que l'ancien mot ne part, le contenu déborde :
    // il reste aligné pareil (centré pour une capsule) au lieu de partir vers la droite.
    el.style.justifyContent = aligner;
    el.textContent = '';

    // Les lecteurs d'écran lisent ce texte-là, pas les lettres une par une.
    const lu = document.createElement('span');
    lu.className = 'sr-only';
    el.append(lu);

    let courante = null; // la couche du mot affiché

    function couche(texte, classe) {
        const c = document.createElement('span');
        c.className = `bascule__couche ${classe}`;
        c.setAttribute('aria-hidden', 'true');
        for (const lettre of Array.from(texte)) {
            const l = document.createElement('span');
            l.className = 'bascule__lettre';
            l.textContent = lettre;
            c.append(l);
        }
        el.append(c);
        return c;
    }

    function afficher(texte, classe = '', { immediat = false } = {}) {
        lu.textContent = texte;
        // Les couches plus anciennes encore en train de partir : on les retire tout de suite.
        el.querySelectorAll('.bascule__couche').forEach(c => { if (c !== courante) c.remove(); });

        const largeurAvant = el.getBoundingClientRect().width;
        const ancienne = courante;
        courante = couche(texte, classe);

        if (immediat || reduire.matches) {
            ancienne?.remove();
            return;
        }
        const total = duree + decalage * Math.max(courante.children.length, ancienne?.children.length ?? 0);

        if (ancienne) {
            gsap.to(ancienne.children, {
                rotationX: 90, opacity: 0, textShadow: FRANGE, transformOrigin: '50% 0%',
                duration: duree * 0.7, ease: 'power2.in', stagger: decalage, overwrite: true,
                onComplete: () => ancienne.remove(),
            });
        }
        // La première fois, il n'y a pas d'ancien mot : les lettres se déplient depuis le vide.
        gsap.fromTo(courante.children,
            { rotationX: -90, opacity: 0, textShadow: FRANGE, transformOrigin: '50% 100%' },
            { rotationX: 0, opacity: 1, textShadow: repos, duration: duree, ease: 'power3.out', stagger: decalage, delay: duree * 0.25,
              onComplete() { gsap.set(this.targets(), { clearProps: 'textShadow' }); } });

        if (fluide && ancienne) {
            // La capsule passe en douceur de la largeur de l'ancien mot à celle du nouveau.
            // (la différence entre l'élément et son ancien mot : son propre espacement intérieur)
            const marge = largeurAvant - ancienne.getBoundingClientRect().width;
            const largeurApres = courante.getBoundingClientRect().width + marge;
            // Un mot plus long : elle s'ouvre tout de suite, pour que les lettres aient la place d'arriver.
            // Un mot plus court : elle attend que l'ancien soit parti pour se resserrer.
            const grandit = largeurApres > largeurAvant;
            gsap.fromTo(el, { width: largeurAvant }, {
                width: largeurApres, overwrite: true,
                duration: grandit ? duree : total, ease: grandit ? 'power3.out' : 'power3.inOut',
                onComplete: () => gsap.set(el, { clearProps: 'width' }),
            });
        }
    }

    return { afficher };
}
