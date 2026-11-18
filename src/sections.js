// ============================================================
//  Le contenu des sections sous le carrousel
//    La sélection (défilement de côté), la grille de la collection
//    et ses filtres par chaîne, animés avec Flip.
// ============================================================

import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { affiches, CHAINES } from './donnees.js';
import { enMouvement } from './animations.js';

gsap.registerPlugin(Flip);

// ===== RENDU =====
// Les cartes fabriquées en JavaScript à partir des données ; toute valeur d'Are.na passe par echapper().

// Comme htmlspecialchars() en PHP : un texte reçu ne doit jamais être lu comme du HTML.
function echapper(texte) {
    return String(texte)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// ------------------------------------------------------------
//  La sélection : dix affiches de la chaîne « Style suisse »
// ------------------------------------------------------------
export function remplirSelection() {
    const choix = affiches.filter(a => a.chaine === CHAINES[0]).slice(0, 10);
    document.getElementById('piste').innerHTML = choix.map((a, n) => {
        const numero = String(n + 1).padStart(2, '0');
        const legende = a.titre ? `${numero} — ${echapper(a.titre)}` : numero;
        return `
            <figure class="carte-selection relative aspect-3/4 h-[52vh] shrink-0 overflow-hidden bg-neutral-100 sm:h-[64vh]">
                <img src="${echapper(a.grande)}" alt="${echapper(a.titre ?? 'Affiche sans titre')}" class="absolute inset-0 size-full object-cover">
                <figcaption class="verre absolute bottom-3 left-3 max-w-[85%] truncate rounded-full px-3 py-1 text-xs">${legende}</figcaption>
            </figure>`;
    }).join('');
}

// ------------------------------------------------------------
//  La collection
// ------------------------------------------------------------
const grille = document.getElementById('grille');
let montrees = 0;   // combien d'affiches de la liste sont déjà dans la grille
let filtre = null;  // le slug de la chaîne choisie, ou null pour tout montrer

function carte(a) {
    return `
        <a href="${echapper(a.lien)}" target="_blank" rel="noopener" class="carte-grille group block" data-chaine="${echapper(a.chaine.slug)}">
            <div class="aspect-3/4 overflow-hidden bg-neutral-100">
                <img src="${echapper(a.petite)}" alt="${echapper(a.titre ?? 'Affiche sans titre')}" loading="lazy" class="size-full object-cover opacity-0 transition-[opacity,scale] duration-700 ease-verre group-hover:scale-105 data-charge:opacity-100">
            </div>
            <p class="mt-3 text-[0.65rem] tracking-[0.2em] text-gris uppercase">${echapper(a.chaine.nom)}</p>
            ${a.titre ? `<p class="mt-1 line-clamp-1 text-sm">${echapper(a.titre)}</p>` : ''}
        </a>`;
}

// Ajoute les affiches suivantes à la grille et renvoie les nouvelles cartes.
// La liste grandit toute seule (donnees.js) : il y en a toujours d'autres.
export function ajouterCartes(nombre) {
    const lot = affiches.slice(montrees, montrees + nombre);
    if (!lot.length) return [];
    montrees += lot.length;
    grille.insertAdjacentHTML('beforeend', lot.map(carte).join(''));
    const nouvelles = [...grille.children].slice(-lot.length);
    nouvelles.forEach((c) => {
        c.hidden = Boolean(filtre) && c.dataset.chaine !== filtre;
        if (!c.hidden) c.dataset.vue = '';
        // L'image apparaît en fondu une fois chargée, au lieu de surgir d'un coup.
        const img = c.querySelector('img');
        const montrer = () => { img.dataset.charge = ''; };
        if (img.complete && img.naturalWidth) montrer();
        else img.addEventListener('load', montrer, { once: true });
    });
    return nouvelles;
}

// Les filtres : Flip note la place de chaque carte, on cache ou montre,
// puis Flip anime chaque carte de son ancienne place vers la nouvelle.
//   avant() : juste avant (animations.js révèle les cartes qui attendaient encore)
//   apres() : une fois fini (recalculer les positions des animations au défilement)
//   choix(nom) : prévenir le titre de la section (typo.js), qui bascule vers le nom choisi
export function preparerFiltres({ avant = () => {}, apres = () => {}, choix = () => {} } = {}) {
    const filtres = document.getElementById('filtres');
    const options = [{ slug: '', nom: 'Tout' }, ...CHAINES];
    filtres.innerHTML = options.map(o => `
        <button type="button" data-slug="${echapper(o.slug)}" aria-pressed="${o.slug === ''}"
                class="shrink-0 rounded-full px-3.5 py-1.5 whitespace-nowrap transition-colors hover:bg-white/70 aria-pressed:bg-encre aria-pressed:text-white">${echapper(o.nom)}</button>`).join('');

    let tour = 0; // le numéro du dernier filtre : seul le dernier Flip lance apres()

    filtres.addEventListener('click', (e) => {
        const bouton = e.target.closest('button');
        if (!bouton) return;
        const ce = ++tour;
        filtre = bouton.dataset.slug || null;
        filtres.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === bouton)));
        choix(filtre ? bouton.textContent.trim() : null);
        avant();

        const cartes = [...grille.children];
        const etat = Flip.getState(cartes);
        // La hauteur affichée (même en plein milieu d'un filtre précédent), puis la grille redevient libre.
        const hauteurAvant = grille.offsetHeight;
        gsap.killTweensOf(grille);
        gsap.set(grille, { clearProps: 'height' });
        const placesAvant = new Map(cartes.map(c => [c, c.getBoundingClientRect().top]));
        const visiblesAvant = new Set(cartes.filter(c => !c.hidden));
        cartes.forEach(c => { c.hidden = Boolean(filtre) && c.dataset.chaine !== filtre; });
        // Seules les cartes qui s'en vont sortent du flux pendant l'animation ;
        // les autres restent à leur place finale et glissent avec une simple transformation.
        const partantes = cartes.filter(c => c.hidden && visiblesAvant.has(c));
        const hauteurApres = grille.offsetHeight;
        const duree = 0.9;

        // Avec « réduire les animations » (enMouvement est faux) : le filtre s'applique sans aucune animation.
        if (!enMouvement) {
            cartes.forEach((c) => { if (c.hidden) delete c.dataset.vue; else c.dataset.vue = ''; });
            apres();
            return;
        }

        // Une carte qui remonte de très loin passerait toute l'animation hors de l'écran :
        // elle apparaît plutôt sur place, avec la même bascule que les cartes au défilement.
        const loin = cartes.filter(c => !c.hidden && c.dataset.vue !== undefined
            && Math.abs(c.getBoundingClientRect().top - placesAvant.get(c)) > innerHeight * 0.6);
        cartes.forEach((c) => { if (c.hidden) delete c.dataset.vue; else c.dataset.vue = ''; });

        // Quand la grille rétrécit, elle glisse vers sa nouvelle hauteur au rythme des cartes :
        // le pied de page remonte en douceur au lieu de sauter. Quand elle grandit, elle prend
        // tout de suite sa place, pour que le pied de page ne passe jamais par-dessus les cartes.
        if (hauteurApres < hauteurAvant) {
            gsap.fromTo(grille, { height: hauteurAvant }, {
                height: hauteurApres, duration: duree, ease: 'expo.inOut',
                onComplete: () => gsap.set(grille, { clearProps: 'height' }),
            });
        }

        if (loin.length) {
            gsap.fromTo(loin,
                { opacity: 0, y: 90, rotationX: -50, transformPerspective: 900, transformOrigin: '50% 0%' },
                { opacity: 1, y: 0, rotationX: 0, duration: 1, ease: 'expo.out', stagger: 0.06, delay: 0.2, overwrite: true });
        }

        // Flip.from() anime de l'état noté plus haut (Flip.getState) vers la nouvelle place.
        // absolute : seulement les cartes qui partent (pas true pour toutes), pour que la grille
        // garde sa hauteur pendant l'animation et que le pied de page ne saute pas.
        Flip.from(etat, {
            targets: cartes.filter(c => !loin.includes(c)),
            duration: duree,
            ease: 'expo.inOut',
            absolute: partantes,
            scale: true,
            stagger: 0.012,
            onEnter: els => gsap.fromTo(els, { opacity: 0, scale: 0.6, rotationX: -50, transformPerspective: 900 }, { opacity: 1, scale: 1, rotationX: 0, duration: 0.9, ease: 'expo.out', stagger: 0.02 }),
            onLeave: els => gsap.to(els, { opacity: 0, scale: 0.6, duration: 0.45, ease: 'power2.in' }),
            onComplete: () => { if (ce === tour) apres(); },
        });
    });
}

// ===== STYLE =====
// rien ici : les classes Tailwind sont écrites en entier dans le HTML, le reste est dans style.css.
