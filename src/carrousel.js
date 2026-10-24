// ============================================================
//  Le carrousel d'ouverture
//    Plusieurs rangées infinies glissent en sens alternés,
//    vues à travers la lentille de verre liquide (lentille.js).
//    On les tire à la souris ou au doigt ; un clic agrandit une affiche.
// ============================================================

import { creerLentille } from './lentille.js';
import { affiches, suivante, imageDe } from './donnees.js';
import { creerBascule } from './bascule.js';

const RENOUVELER_TOUTES_LES = 2500; // ms entre deux affiches remplacées
const DUREE_FOCUS = 800;

const accueil = document.getElementById('accueil');
const ecran = document.getElementById('carrousel');
const scene = document.createElement('canvas'); // les rangées, avant la lentille
const ctx = scene.getContext('2d');
const lentille = creerLentille(ecran);
const ctxSecours = lentille ? null : ecran.getContext('2d'); // sans WebGL : la scène telle quelle

const cases = new Map();  // « rangée,panneau » → affiche : en revenant au même endroit, on la retrouve
const fondus = new Map(); // « rangée,panneau » → { ancienne, debut } pendant un remplacement
const reduire = matchMedia('(prefers-reduced-motion: reduce)');

let rangees = [];
let W, H, dpr, largeur, hauteur, ecart, pas, haut;
let visibles = [];   // les panneaux entièrement à l'écran, pour renouveler()
let entree = null;   // le moment où les premières affiches sont arrivées
let actif = true;    // faux quand le carrousel est sorti de l'écran : on ne dessine plus
let sortie = 0;      // 0 → 1 pendant qu'on fait défiler la page vers le bas (réglé par animations.js)
const ONDE_REPOS = 3; // px : le verre frémit toujours un peu
let onde = ONDE_REPOS;

// Une onde traverse le verre : elle monte d'un coup, puis retombe d'elle-même (dans boucle()).
function onduler(force) {
    if (!reduire.matches) onde = Math.max(onde, force);
}

export function reglerSortie(valeur) {
    sortie = valeur;
}

// Sans vrai titre, on montre seulement la chaîne d'où vient l'affiche.
function titreDe(affiche) {
    return affiche.titre ?? affiche.chaine.nom;
}

function legendeDe(affiche) {
    return affiche.titre ? `${affiche.chaine.nom} · Are.na` : 'Are.na';
}

// ------------------------------------------------------------
//  Les rangées
//    Panneau i de la rangée r : x = milieu de l'écran + i × pas + décalage.
//    Rien n'est stocké par panneau : on calcule seulement ceux qui sont à l'écran,
//    c'est ce qui rend les rangées infinies.
// ------------------------------------------------------------
function mesurer() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = ecran.clientWidth;
    H = ecran.clientHeight;
    const petit = W < 640;
    const nombre = petit ? 2 : 3;
    ecart = petit ? 8 : 12;
    const zone = H * (petit ? 0.6 : 0.66);
    hauteur = (zone - ecart * (nombre - 1)) / nombre;
    largeur = hauteur * 0.75;
    pas = largeur + ecart;
    haut = (H - zone) / 2;

    // 1re rangée vers la droite, 2e vers la gauche, 3e vers la droite (px par ms)
    const derives = [0.07, -0.06, 0.065];
    const facteurs = [1, 1.2, 0.85];
    rangees = Array.from({ length: nombre }, (_, r) => ({
        decalage: rangees[r]?.decalage ?? 0,
        vitesse: rangees[r]?.vitesse ?? derives[r],
        derive: derives[r],
        facteur: facteurs[r],
    }));

    for (const canvas of [scene, ecran]) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
    }
}

// La lentille du carrousel au repos : [demi-largeur, demi-hauteur], en px.
function demiCarrousel() {
    const petit = W < 640;
    return [W / 2 - (petit ? 6 : W * 0.02), H * (petit ? 0.6 : 0.66) / 2 + 36];
}

// La goutte : le rayon de la lentille refermée, quand on a quitté le carrousel.
function goutteDe(demi) {
    return Math.min(demi[0], demi[1]) * 0.75;
}

// Jusqu'où le canvas peut descendre pendant la parallaxe (animations.js) sans que la goutte
// touche le bas de la section : sinon la section la couperait net et son bas deviendrait plat.
export function descenteMax() {
    const marge = 48; // l'ondulation du bord, plus un peu d'air
    return Math.max(0, H / 2 - goutteDe(demiCarrousel()) - marge);
}

function afficheDe(cle) {
    if (!cases.has(cle) && affiches.length) cases.set(cle, suivante());
    return cases.get(cle);
}

// Le panneau d'une rangée le plus proche du milieu de l'écran
function centre(rangee) {
    return Math.round(-rangee.decalage / pas);
}

function adoucir(t) {
    return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
}

// Lent au départ, lent à l'arrivée
function glisser(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function melange(a, b, t) {
    return a + (b - a) * t;
}

// Comme object-fit: cover : l'image remplit le cadre, recadrée au centre.
function peindre(img, x, y, alpha, l = largeur, h = hauteur) {
    if (!img.prete || alpha <= 0) return;
    const echelle = Math.max(l / img.naturalWidth, h / img.naturalHeight);
    const sl = l / echelle;
    const sh = h / echelle;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (img.naturalWidth - sl) / 2, (img.naturalHeight - sh) / 2, sl, sh, x, y, l, h);
    ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
//  La mise au point : l'affiche cliquée grandit jusqu'au centre
//  et la lentille se resserre autour d'elle.
// ------------------------------------------------------------
let focus = null; // { r, i, affiche, debut, sens } ; sens 1 : s'ouvre, -1 : se referme

// 0 : dans sa rangée, 1 : grande au centre
function progresFocus(maintenant) {
    if (!focus) return 0;
    const t = reduire.matches ? 1 : Math.min((maintenant - focus.debut) / DUREE_FOCUS, 1);
    return focus.sens > 0 ? t : 1 - t;
}

// La place de l'affiche agrandie : entière, au centre, avec ses vraies proportions.
function cadreFocus() {
    const img = imageDe(focus.affiche);
    const ratio = img.prete ? img.naturalWidth / img.naturalHeight : 0.75;
    const petit = W < 640;
    const h = Math.min(H * (petit ? 0.62 : 0.7), (W * (petit ? 0.86 : 0.8)) / ratio);
    const l = h * ratio;
    return { x: (W - l) / 2, y: (H - h) / 2, l, h };
}

function dessiner(maintenant) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    visibles = [];
    const base = W / 2 - largeur / 2;
    const p = glisser(progresFocus(maintenant));
    const cleFocus = focus && `${focus.r},${focus.i}`;

    rangees.forEach((rangee, r) => {
        const y0 = haut + r * (hauteur + ecart);
        const premier = Math.ceil((-largeur - base - rangee.decalage) / pas);
        const dernier = Math.floor((W - base - rangee.decalage) / pas);
        const milieu = centre(rangee);

        for (let i = premier; i <= dernier; i++) {
            const x = base + i * pas + rangee.decalage;
            // L'entrée : les panneaux montent et apparaissent, du centre vers les bords.
            const e = reduire.matches || !entree ? 1 : adoucir((maintenant - entree - r * 120 - Math.abs(i - milieu) * 60) / 900);
            const y = y0 + (1 - e) * 60;
            // Pendant la mise au point, les rangées s'effacent derrière l'affiche agrandie.
            const presence = e * (1 - 0.8 * p);

            ctx.fillStyle = '#efefef';
            ctx.globalAlpha = presence;
            ctx.fillRect(x, y, largeur, hauteur);
            ctx.globalAlpha = 1;

            const cle = `${r},${i}`;
            const affiche = afficheDe(cle);
            if (!affiche || cle === cleFocus) continue;
            if (x >= 0 && x + largeur <= W) visibles.push(cle);

            const img = imageDe(affiche);
            const fondu = fondus.get(cle);
            if (fondu) {
                // La nouvelle affiche apparaît par-dessus l'ancienne, une fois chargée.
                peindre(imageDe(fondu.ancienne), x, y, presence);
                const t = img.prete ? (maintenant - Math.max(img.prete, fondu.debut)) / 700 : 0;
                peindre(img, x, y, Math.min(t, 1) * presence);
                if (t >= 1) fondus.delete(cle);
            } else {
                peindre(img, x, y, Math.min((maintenant - (img.prete ?? maintenant)) / 500, 1) * presence);
            }
        }
    });

    if (focus) {
        // L'affiche part de sa place dans la rangée et grandit jusqu'à son cadre au centre.
        const depuis = { x: base + focus.i * pas + rangees[focus.r].decalage, y: haut + focus.r * (hauteur + ecart), l: largeur, h: hauteur };
        const vers = cadreFocus();
        const grande = imageDe(focus.affiche, true);
        peindre(grande.prete ? grande : imageDe(focus.affiche),
            melange(depuis.x, vers.x, p), melange(depuis.y, vers.y, p), 1,
            melange(depuis.l, vers.l, p), melange(depuis.h, vers.h, p));
    }
}

// Les données se mettent à jour : un panneau visible reçoit la suivante de la pioche.
function renouveler() {
    if (document.hidden || !actif || focus || !affiches.length || !visibles.length) return;
    const cle = visibles[Math.floor(Math.random() * visibles.length)];
    fondus.set(cle, { ancienne: cases.get(cle), debut: performance.now() });
    cases.set(cle, suivante());
    onduler(9);
}

// ------------------------------------------------------------
//  Le mouvement
// ------------------------------------------------------------
let enMain = false;
let dernier = null;
let depart = null;
let poseJusqua = 0; // après un geste, les rangées se posent un moment avant de repartir

function avancer(dt, maintenant) {
    const pose = reduire.matches || focus || maintenant < poseJusqua;
    for (const rangee of rangees) {
        if (enMain) continue;
        if (pose && Math.abs(rangee.vitesse) < 0.05) {
            // L'aimant : la rangée se cale sur le panneau le plus proche du centre.
            rangee.vitesse = 0;
            const cible = -centre(rangee) * pas;
            rangee.decalage += (cible - rangee.decalage) * (1 - Math.exp(-dt / 160));
        } else {
            // L'élan retombe, puis la rangée reprend sa dérive.
            const cible = pose ? 0 : rangee.derive;
            rangee.vitesse += (cible - rangee.vitesse) * (1 - Math.exp(-dt / (pose ? 380 : 900)));
            rangee.decalage += rangee.vitesse * dt;
        }
    }
}

function deplacer(dx) {
    for (const rangee of rangees) rangee.decalage += dx * rangee.facteur;
}

const titre = creerBascule(document.getElementById('titre'), { aligner: 'center', duree: 0.35, decalage: 0.018 });
const legende = document.getElementById('legende');
let affichee = null;

// Une ligne seulement : les titres d'Are.na sont parfois des phrases entières.
function couper(texte, longueur = 46) {
    return texte.length > longueur ? `${texte.slice(0, longueur - 1).trimEnd()}…` : texte;
}

// En haut : l'affiche agrandie, sinon celle au centre de la rangée du milieu.
function annoncer() {
    const r = Math.floor(rangees.length / 2);
    const affiche = focus ? focus.affiche : cases.get(`${r},${centre(rangees[r])}`);
    if (!affiche || affiche === affichee) return;
    affichee = affiche;
    titre.afficher(couper(titreDe(affiche)));
    legende.textContent = legendeDe(affiche);
}

function boucle(maintenant) {
    requestAnimationFrame(boucle);
    const dt = Math.min(maintenant - (boucle.avant ?? maintenant), 50);
    boucle.avant = maintenant;
    if (!actif) return;

    // Fin de la fermeture : l'affiche est revenue dans sa rangée.
    if (focus && focus.sens < 0 && progresFocus(maintenant) <= 0) focus = null;

    avancer(dt, maintenant);
    dessiner(maintenant);
    annoncer();

    if (!lentille) {
        ctxSecours.drawImage(scene, 0, 0);
        return;
    }
    onde += ((reduire.matches ? 0 : ONDE_REPOS) - onde) * (1 - Math.exp(-dt / 700));
    const petit = W < 640;
    const vitesse = rangees.reduce((somme, r) => somme + Math.abs(r.vitesse), 0) / rangees.length;
    // La lentille du carrousel…
    let demi = demiCarrousel();
    let rayon = petit ? 48 : 120;
    let bande = petit ? 44 : 84;
    let flou = reduire.matches ? 0 : Math.min(vitesse * 8, 16);
    if (focus) {
        // …se resserre autour de l'affiche agrandie, et ondule plus fort pendant le trajet.
        const p = glisser(progresFocus(maintenant));
        const cadre = cadreFocus();
        demi = [melange(demi[0], cadre.l / 2 + 26, p), melange(demi[1], cadre.h / 2 + 26, p)];
        rayon = melange(rayon, 34, p);
        bande = melange(bande, 46, p);
        if (!reduire.matches) flou += Math.sin(p * Math.PI) * 10;
    }
    if (sortie > 0) {
        // …et quand on descend dans la page, elle se referme en goutte.
        const goutte = goutteDe(demiCarrousel());
        demi = [melange(demi[0], goutte, sortie), melange(demi[1], goutte, sortie)];
        rayon = melange(rayon, goutte, sortie);
        bande = melange(bande, goutte * 0.9, sortie);
        flou += sortie * 10;
    }
    lentille.rendre(scene, {
        demi: [demi[0] * dpr, demi[1] * dpr],
        rayon: rayon * dpr,
        bande: bande * dpr,
        flou: flou * dpr,
        onde: (onde + sortie * 10) * dpr,
        temps: reduire.matches ? 0 : maintenant / 1000,
    });
}

// Le panneau sous le pointeur, pour le clic
function panneauEn(px, py) {
    const base = W / 2 - largeur / 2;
    for (const [r, rangee] of rangees.entries()) {
        const y0 = haut + r * (hauteur + ecart);
        if (py < y0 || py > y0 + hauteur) continue;
        const i = Math.floor((px - base - rangee.decalage) / pas);
        const x = base + i * pas + rangee.decalage;
        const affiche = cases.get(`${r},${i}`);
        if (px - x <= largeur && affiche) return { r, i, affiche };
    }
    return null;
}

function position(e) {
    const cadre = ecran.getBoundingClientRect();
    return { x: e.clientX - cadre.left, y: e.clientY - cadre.top };
}

ecran.addEventListener('pointerdown', (e) => {
    // Clic droit (ou à deux doigts sur un trackpad) : le bouton n'est jamais « relâché » pour nous,
    // et le carrousel croirait qu'on le tient encore. On ne le saisit qu'au clic principal.
    if (e.button !== 0) return;
    if (focus) {
        fermer();
        return;
    }
    enMain = true;
    ecran.setPointerCapture(e.pointerId);
    dernier = { x: e.clientX, t: e.timeStamp };
    depart = { x: e.clientX, y: e.clientY };
    for (const rangee of rangees) rangee.vitesse = 0;
});
ecran.addEventListener('pointermove', (e) => {
    if (!enMain) return;
    const dx = e.clientX - dernier.x;
    const dt = Math.max(e.timeStamp - dernier.t, 1);
    deplacer(dx);
    // On garde la vitesse du geste : en lâchant, les rangées partent sur leur élan.
    for (const rangee of rangees) rangee.vitesse = Math.max(-3, Math.min(3, (dx / dt) * rangee.facteur));
    dernier = { x: e.clientX, t: e.timeStamp };
});
ecran.addEventListener('pointerup', (e) => {
    if (!enMain) return;
    enMain = false;
    poseJusqua = performance.now() + 1200;
    // On lâche : l'onde est proportionnelle à l'élan du geste.
    const elan = rangees.reduce((somme, r) => somme + Math.abs(r.vitesse), 0) / rangees.length;
    onduler(6 + Math.min(elan * 10, 16));
    // Presque pas bougé : c'était un clic.
    if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < 6) {
        const { x, y } = position(e);
        const cible = panneauEn(x, y);
        if (cible) ouvrir(cible);
    }
});
// Le geste peut aussi être interrompu (le navigateur fait défiler la page, par exemple) : on relâche.
ecran.addEventListener('pointercancel', () => { enMain = false; });
ecran.addEventListener('lostpointercapture', () => { enMain = false; });

// Seulement la molette horizontale (deux doigts de côté sur un trackpad) :
// la molette verticale fait défiler la page, comme partout.
ecran.addEventListener('wheel', (e) => {
    if (focus || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    deplacer(-e.deltaX);
    poseJusqua = performance.now() + 1200;
}, { passive: false });

ecran.addEventListener('keydown', (e) => {
    const sens = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
    if (!sens || focus) return;
    e.preventDefault();
    for (const rangee of rangees) rangee.decalage += sens * pas;
    poseJusqua = performance.now() + 1200;
});
addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fermer();
});

let attente;
addEventListener('resize', () => {
    clearTimeout(attente);
    attente = setTimeout(mesurer, 150);
});

// ------------------------------------------------------------
//  Ouvrir et fermer la mise au point
// ------------------------------------------------------------
const detail = document.getElementById('detail');
const detailLien = document.getElementById('detailLien');
const detailFermer = document.getElementById('detailFermer');
const pied = document.getElementById('piedContenu');

function ouvrir(cible) {
    focus = { ...cible, debut: performance.now(), sens: 1 };
    onduler(24);
    imageDe(cible.affiche, true); // la grande image commence à charger pendant que l'affiche grandit
    detailLien.href = cible.affiche.lien;
    detail.classList.add('ouvert');
    detail.inert = false;
    pied.classList.add('opacity-0');
    detailFermer.focus({ preventScroll: true });
}

function fermer() {
    if (!focus || focus.sens < 0) return;
    // On repart du point où en est l'ouverture : fermer en plein trajet ne fait pas de saut.
    const p = progresFocus(performance.now());
    focus.sens = -1;
    focus.debut = performance.now() - (1 - p) * DUREE_FOCUS;
    onduler(20);
    detail.classList.remove('ouvert');
    detail.inert = true;
    pied.classList.remove('opacity-0');
    ecran.focus({ preventScroll: true });
}

detailFermer.addEventListener('click', fermer);

// ------------------------------------------------------------
//  Le départ
// ------------------------------------------------------------
// Hors de l'écran, le carrousel ne dessine plus : la page reste fluide plus bas.
new IntersectionObserver(([vue]) => { actif = vue.isIntersecting; }).observe(accueil);

export function demarrerCarrousel() {
    mesurer();
    requestAnimationFrame(boucle);
}

// Appelé quand les premières affiches sont là : les rangées font leur entrée.
export function lancerEntree() {
    entree = performance.now();
    onduler(32);
    setInterval(renouveler, RENOUVELER_TOUTES_LES);
}
