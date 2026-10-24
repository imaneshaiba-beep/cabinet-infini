// ============================================================
//  La page mentions légales : l'adresse e-mail protégée,
//    le curseur et le bandeau de la fin, les mêmes que
//    sur le cabinet. Avec « réduire les animations », rien ne bouge.
// ============================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { curseur } from './curseur.js';

gsap.registerPlugin(ScrollTrigger);

const media = gsap.matchMedia();
const MOUVEMENT = '(prefers-reduced-motion: no-preference)';

// ------------------------------------------------------------
//  L'adresse e-mail, protégée des robots qui fouillent le code
//  des pages pour envoyer du spam ou du phishing : dans le HTML,
//  elle est écrite à l'envers et en deux morceaux, sans « @ » ni
//  « mailto: ». On la remet à l'endroit, en lien cliquable.
// ------------------------------------------------------------
const envers = (texte) => [...texte].reverse().join('');
document.querySelectorAll('.courriel').forEach((element) => {
    const adresse = `${envers(element.dataset.nom)}@${envers(element.dataset.domaine)}`;
    const lien = document.createElement('a');
    lien.href = `mailto:${adresse}`;
    lien.textContent = adresse;
    lien.className = element.dataset.classe ?? '';
    element.replaceWith(lien);
});

media.add(MOUVEMENT, () => {
    // Le bandeau de la fin tourne sans fin ; la vitesse du défilement l'accélère, le sens le retourne.
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

    // Le même curseur que sur le cabinet, seulement avec une souris.
    return matchMedia('(pointer: fine)').matches ? curseur() : undefined;
});
