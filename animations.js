// ============================================================
//  Les animations au défilement (GSAP + ScrollTrigger + SplitText)
//    Tout ce qui bouge beaucoup est rangé dans gsap.matchMedia() :
//    avec « réduire les animations », le site reste complet mais calme.
// ============================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { stats } from './donnees.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const entier = new Intl.NumberFormat('fr-FR');
const media = gsap.matchMedia();
const MOUVEMENT = '(prefers-reduced-motion: no-preference)';
const CALME = '(prefers-reduced-motion: reduce)';

export function rafraichir() {
    ScrollTrigger.refresh();
}

// ------------------------------------------------------------
//  Les chiffres : ils comptent depuis zéro à leur arrivée,
//  puis suivent les données qui continuent d'arriver.
// ------------------------------------------------------------
const comptes = new Map(); // élément → { valeur, parti }

function ecrire(el, valeur) {
    el.textContent = entier.format(Math.round(valeur));
}

export function majChiffres() {
    for (const [el, compte] of comptes) {
        if (!compte.parti) continue;
        gsap.to(compte, { valeur: stats[el.dataset.cle], duration: 1.2, ease: 'power2.out', overwrite: true, onUpdate: () => ecrire(el, compte.valeur) });
    }
}

// ------------------------------------------------------------
//  Les cartes de la collection : elles basculent depuis le fond, par lots
// ------------------------------------------------------------
const enAttente = new Set(); // les déclencheurs des cartes qui ne sont pas encore apparues

export function reveler(cartes) {
    if (!cartes.length || matchMedia(CALME).matches) return;
    gsap.set(cartes, { opacity: 0 });
    const declencheurs = ScrollTrigger.batch(cartes, {
        start: 'top 92%',
        once: true,
        onEnter: lot => gsap.fromTo(lot,
            { y: 140, rotationX: -55, opacity: 0, transformPerspective: 1000, transformOrigin: '50% 0%' },
            { y: 0, rotationX: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.07, overwrite: true }),
    });
    declencheurs.forEach(d => enAttente.add(d));
}

// Avant un filtre : toutes les cartes s'affichent tout de suite, à leur place, et c'est Flip qui les anime.
// Sinon celles qui attendaient resteraient invisibles pendant le filtre, puis apparaîtraient après coup.
export function revelerTout() {
    enAttente.forEach(d => d.kill());
    enAttente.clear();
    gsap.killTweensOf('.carte-grille');
    gsap.set('.carte-grille', { opacity: 1, y: 0, rotationX: 0 });
}

// ------------------------------------------------------------
//  Le curseur en verre : il suit la souris avec du retard
//  et s'étire dans le sens du mouvement, comme une goutte.
// ------------------------------------------------------------
function curseur() {
    const enveloppe = document.getElementById('curseur');
    const bulle = document.getElementById('bulle');
    enveloppe.classList.remove('hidden');
    gsap.set(bulle, { xPercent: -50, yPercent: -50 });

    const allerX = gsap.quickTo(enveloppe, 'x', { duration: 0.5, ease: 'power3' });
    const allerY = gsap.quickTo(enveloppe, 'y', { duration: 0.5, ease: 'power3' });
    // survol : la taille (0 tant que la souris n'a pas bougé) ; etirement : la goutte qui s'allonge
    const forme = { survol: 0, etirement: 0 };
    let avant = null;

    const suivre = (e) => {
        allerX(e.clientX);
        allerY(e.clientY);
    };
    const entrer = () => gsap.to(forme, { survol: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
    // Un simple point sur les liens et les boutons (pour voir leurs mots basculer),
    // une grosse sur ce qu'on attrape ou ouvre
    const survoler = (e) => {
        const cible = e.target.closest('a, button, #carrousel');
        const taille = !cible ? 1 : cible.id === 'carrousel' ? 1.7 : cible.matches('.carte-grille') ? 2.2 : 0.2;
        gsap.to(forme, { survol: taille, duration: 0.7, ease: 'elastic.out(1, 0.45)', overwrite: true });
    };
    // À chaque image : la vitesse de la bulle donne son étirement et son angle.
    const etirer = () => {
        const x = gsap.getProperty(enveloppe, 'x');
        const y = gsap.getProperty(enveloppe, 'y');
        if (avant) {
            const dx = x - avant.x;
            const dy = y - avant.y;
            forme.etirement += (Math.min(Math.hypot(dx, dy) / 40, 0.55) - forme.etirement) * 0.25;
            if (Math.hypot(dx, dy) > 0.5) gsap.set(enveloppe, { rotation: Math.atan2(dy, dx) * 180 / Math.PI });
        }
        avant = { x, y };
        gsap.set(bulle, { scaleX: forme.survol * (1 + forme.etirement), scaleY: forme.survol * (1 - forme.etirement * 0.45) });
    };

    addEventListener('pointermove', suivre);
    addEventListener('pointermove', entrer, { once: true });
    document.addEventListener('pointerover', survoler);
    gsap.ticker.add(etirer);

    return () => {
        removeEventListener('pointermove', suivre);
        document.removeEventListener('pointerover', survoler);
        gsap.ticker.remove(etirer);
        enveloppe.classList.add('hidden');
    };
}

// ------------------------------------------------------------
//  La pastille de la navigation : elle glisse, avec un rebond liquide,
//  sous le lien de la section où l'on se trouve.
// ------------------------------------------------------------
function indicateur() {
    const pastille = document.getElementById('indicateur');
    const liens = [...document.querySelectorAll('.lien-nav')];
    const calme = matchMedia(CALME).matches;
    let actif = null;

    const aller = (lien) => {
        actif = lien;
        liens.forEach(l => l.classList.toggle('text-white', l === lien));
        if (!lien || !lien.offsetWidth) {
            gsap.to(pastille, { opacity: 0, scale: 0.6, duration: calme ? 0 : 0.4, overwrite: true });
            return;
        }
        gsap.to(pastille, {
            x: lien.offsetLeft, y: lien.offsetTop, width: lien.offsetWidth, height: lien.offsetHeight,
            opacity: 1, scale: 1, duration: calme ? 0 : 0.9, ease: 'elastic.out(1, 0.65)', overwrite: true,
        });
    };

    // Créés après les sections épinglées : leurs positions tiennent compte des épinglages.
    liens.forEach((lien) => {
        // Une section épinglée est enveloppée par GSAP (.pin-spacer) : c'est l'enveloppe
        // qui a la vraie hauteur, temps d'épinglage compris.
        const section = document.querySelector(lien.hash);
        const zone = section.parentElement.classList.contains('pin-spacer') ? section.parentElement : section;
        ScrollTrigger.create({
            trigger: zone, start: 'top center', end: 'bottom center',
            onToggle: (self) => {
                if (self.isActive) aller(lien);
                else if (actif === lien) aller(null);
            },
        });
    });
}

// ------------------------------------------------------------
//  Toutes les animations de la page, dans l'ordre où on les rencontre
// ------------------------------------------------------------
export function animer({ reglerSortie, descenteMax }) {
    // La barre de progression sous la navigation : discrète, toujours là.
    gsap.to('#progression', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    media.add(MOUVEMENT, () => {
        const decoupes = [];

        // 1. L'entrée : la navigation tombe en place, le texte du carrousel monte.
        gsap.timeline({ defaults: { ease: 'expo.out', duration: 1.4 } })
            .from('#nav', { y: -90, opacity: 0, scale: 0.8 })
            .from('#piedContenu > *', { y: 30, opacity: 0, stagger: 0.1 }, '-=1.1');
        gsap.to('#indice span', { y: 5, duration: 0.8, ease: 'sine.inOut', repeat: -1, yoyo: true });

        // 2. On quitte le carrousel : la lentille se referme en goutte, le canvas descend moins vite que la page.
        ScrollTrigger.create({
            trigger: '#accueil', start: 'top top', end: 'bottom top', scrub: true,
            onUpdate: (self) => reglerSortie(self.progress),
            onLeaveBack: () => reglerSortie(0),
        });
        // 28 % de la hauteur au plus, et jamais assez pour que la goutte sorte de la section par le bas.
        gsap.to('#carrousel', {
            y: () => Math.min(innerHeight * 0.28, descenteMax()), ease: 'none',
            scrollTrigger: { trigger: '#accueil', start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
        });
        gsap.to('#pied', { opacity: 0, y: -50, ease: 'none', scrollTrigger: { trigger: '#accueil', start: 'top top', end: '35% top', scrub: true } });

        // 3. Les étiquettes en verre gonflent comme des gouttes, les titres montent lettre par lettre.
        gsap.utils.toArray('.etiquette').forEach((etiquette) => {
            gsap.from(etiquette, { scale: 0.4, opacity: 0, duration: 1.1, ease: 'elastic.out(1, 0.5)', scrollTrigger: { trigger: etiquette, start: 'top 88%', toggleActions: 'play none none reverse' } });
        });
        gsap.utils.toArray('.titre-section').forEach((titre) => {
            const decoupe = SplitText.create(titre, { type: 'lines, chars', mask: 'lines', linesClass: 'ligne-masque' });
            decoupes.push(decoupe);
            gsap.from(decoupe.chars, {
                yPercent: 120, rotation: 8, duration: 1.2, ease: 'expo.out', stagger: 0.022,
                scrollTrigger: { trigger: titre, start: 'top 85%', toggleActions: 'play none none reverse' },
            });
        });

        // 4. Le manifeste reste en place et s'allume mot à mot, du flou vers le net.
        const mots = SplitText.create('#manifesteTexte', { type: 'words' });
        decoupes.push(mots);
        gsap.fromTo(mots.words,
            { opacity: 0.08, filter: 'blur(8px)', yPercent: 35 },
            { opacity: 1, filter: 'blur(0px)', yPercent: 0, ease: 'none', stagger: 0.12,
              scrollTrigger: { trigger: '#manifeste', start: 'top top', end: '+=140%', scrub: 0.6, pin: true } });

        // 5. La sélection : la section reste en place et la piste défile de côté.
        const piste = document.getElementById('piste');
        const distance = () => Math.max(piste.scrollWidth - innerWidth, 0);
        const penche = { valeur: 0 };
        const pencher = gsap.quickSetter('.carte-selection', 'skewX', 'deg');
        const defile = gsap.to(piste, {
            x: () => -distance(), ease: 'none',
            scrollTrigger: {
                trigger: '#selection', start: 'top top', end: () => `+=${distance()}`,
                pin: true, scrub: 0.8, invalidateOnRefresh: true,
                // Plus on défile vite, plus les affiches penchent ; elles se redressent à l'arrêt.
                onUpdate: (self) => {
                    const v = gsap.utils.clamp(-12, 12, self.getVelocity() / -250);
                    if (Math.abs(v) > Math.abs(penche.valeur)) {
                        penche.valeur = v;
                        gsap.to(penche, { valeur: 0, duration: 0.9, ease: 'power3', overwrite: true, onUpdate: () => pencher(penche.valeur) });
                    }
                },
            },
        });
        gsap.to('#selection .titre-section', { xPercent: -25, ease: 'none', scrollTrigger: { trigger: '#selection', start: 'top top', end: () => `+=${distance()}`, scrub: true, invalidateOnRefresh: true } });
        gsap.utils.toArray('.carte-selection').forEach((carte, n) => {
            // Chaque affiche s'ouvre comme un rideau arrondi…
            gsap.fromTo(carte,
                { clipPath: 'inset(24% 14% 24% 14% round 48px)', rotation: n % 2 ? 5 : -5 },
                { clipPath: 'inset(0% 0% 0% 0% round 0px)', rotation: 0, ease: 'none',
                  scrollTrigger: { trigger: carte, containerAnimation: defile, start: 'left 98%', end: 'left 40%', scrub: true } });
            // …et son image glisse dedans, moins vite que le cadre.
            gsap.fromTo(carte.querySelector('img'),
                { scale: 1.4, xPercent: -12 },
                { scale: 1.08, xPercent: 12, ease: 'none',
                  scrollTrigger: { trigger: carte, containerAnimation: defile, start: 'left right', end: 'right left', scrub: true } });
        });

        // 6. Les chiffres comptent, les traits se dessinent, l'infini tourne avec la page.
        gsap.from('.chiffre-bloc', { y: 90, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '#chiffres', start: 'top 80%' } });
        gsap.from('.trait', { scaleX: 0, duration: 1.6, ease: 'expo.inOut', stagger: 0.15, scrollTrigger: { trigger: '#chiffres', start: 'top 75%' } });
        gsap.to('#infini', { rotation: 360, ease: 'none', scrollTrigger: { trigger: '#chiffres', start: 'top bottom', end: 'bottom top', scrub: 1 } });
        document.querySelectorAll('.chiffre').forEach((el) => {
            const compte = { valeur: 0, parti: false };
            comptes.set(el, compte);
            ScrollTrigger.create({
                trigger: el, start: 'top 85%', once: true,
                onEnter: () => {
                    compte.parti = true;
                    gsap.to(compte, { valeur: stats[el.dataset.cle], duration: 2.4, ease: 'expo.out', onUpdate: () => ecrire(el, compte.valeur) });
                },
            });
        });

        // 7. Le bandeau de la fin tourne sans fin ; la vitesse du défilement l'accélère, le sens le retourne.
        const bandeau = gsap.to('#bandeau', { xPercent: -50, ease: 'none', duration: 24, repeat: -1 });
        bandeau.totalTime(bandeau.duration() * 100); // assez de marge pour pouvoir tourner à l'envers
        const elan = { v: 1 };
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
                const v = self.direction * (1 + Math.min(Math.abs(self.getVelocity()) / 180, 8));
                bandeau.timeScale(v);
                gsap.set('#bandeau', { skewX: gsap.utils.clamp(-10, 10, self.getVelocity() / -300) });
                gsap.fromTo(elan, { v }, { v: self.direction, duration: 1.2, ease: 'power3.out', overwrite: true,
                    onUpdate: () => bandeau.timeScale(elan.v),
                    onComplete: () => gsap.to('#bandeau', { skewX: 0, duration: 0.6, ease: 'power3' }) });
            },
        });

        // 8. Le curseur en verre, seulement avec une souris.
        const retirerCurseur = matchMedia('(pointer: fine)').matches ? curseur() : null;

        return () => {
            decoupes.forEach(d => d.revert());
            retirerCurseur?.();
            comptes.clear();
        };
    });

    media.add(CALME, () => {
        // Sans animation : la sélection se fait défiler à la main, les chiffres sont écrits tout de suite.
        document.getElementById('piste').classList.add('overflow-x-auto');
        document.querySelectorAll('.chiffre').forEach((el) => {
            const compte = { valeur: stats[el.dataset.cle], parti: true };
            comptes.set(el, compte);
            ecrire(el, compte.valeur);
        });
        return () => {
            document.getElementById('piste').classList.remove('overflow-x-auto');
            comptes.clear();
        };
    });

    indicateur();

    // Les polices changent la hauteur des titres : on recalcule les positions une fois chargées.
    document.fonts.ready.then(rafraichir);
}
