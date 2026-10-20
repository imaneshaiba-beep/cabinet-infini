// ============================================================
//  Cabinet infini — un mur d'affiches du Victoria and Albert Museum
//    Le mur glisse tout seul et ne s'arrête jamais ; on peut le tirer
//    à la souris, au doigt, à la molette ou aux flèches.
//    Pendant ce temps, de nouvelles affiches arrivent de l'API
//    et remplacent les anciennes, une par une.
// ============================================================

const API = 'https://api.vam.ac.uk/v2/objects/search';
const PAR_PAGE = 50;
const NOURRIR_TOUTES_LES = 6000;     // ms entre deux nouvelles pages d'affiches
const RENOUVELER_TOUTES_LES = 2500;  // ms entre deux affiches remplacées sur le mur

const entier = new Intl.NumberFormat('fr-FR');

// Une page d'affiches : { affiches, pages, total }.
// kw_object_type=Poster garde seulement les affiches (q=poster ramènerait aussi des lits « four-poster »).
// fields_populated en premier : les fiches les plus complètes, donc souvent les plus belles.
async function chargerAffiches(page) {
    const parametres = new URLSearchParams({
        kw_object_type: 'Poster',
        images_exist: 1,
        order_by: 'fields_populated',
        order_sort: 'desc',
        page,
        page_size: PAR_PAGE,
    });

    const reponse = await fetch(`${API}?${parametres}`);
    if (!reponse.ok) throw new Error(`l'API répond ${reponse.status}`);
    const donnees = await reponse.json();

    // pages : l'API ne va pas plus loin que 10 000 résultats, même si record_count est plus grand.
    const { record_count: total, pages } = donnees.info;
    return { affiches: donnees.records.filter(o => o._images._iiif_image_base_url), pages, total };
}

// L'adresse IIIF d'une image à la largeur voulue ; la base se termine déjà par « / ».
function image(o, largeur) {
    return `${o._images._iiif_image_base_url}full/${largeur},/0/default.jpg`;
}

function titreDe(o) {
    return o._primaryTitle || o.objectType;
}

function legendeDe(o) {
    const nom = o._primaryMaker?.name;
    const auteur = nom && nom !== 'unknown' ? nom : 'Auteur inconnu';
    return [auteur, o._primaryDate].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------
//  Les affiches reçues
// ------------------------------------------------------------
const affiches = [];          // toutes les affiches reçues, sans doublon
const dejaRecues = new Set(); // leurs systemNumber
let pioche = 0;               // la prochaine affiche à accrocher
let pages = 1;                // le vrai nombre arrive avec le premier appel

const compteur = document.getElementById('compteur');
const totalAffiches = document.getElementById('total');
const arrivee = document.getElementById('arrivee');

function melanger(liste) {
    for (let i = liste.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return liste;
}

function suivante() {
    const affiche = affiches[pioche];
    pioche = (pioche + 1) % affiches.length;
    return affiche;
}

async function ajouterPage(page) {
    const resultat = await chargerAffiches(page);
    pages = resultat.pages;
    totalAffiches.textContent = entier.format(resultat.total);

    const nouvelles = resultat.affiches.filter(o => !dejaRecues.has(o.systemNumber));
    nouvelles.forEach(o => dejaRecues.add(o.systemNumber));
    // Glissées juste devant la pioche : ce sont elles qui apparaîtront ensuite sur le mur.
    affiches.splice(pioche, 0, ...melanger(nouvelles));
    compteur.textContent = entier.format(affiches.length);
}

// Une page tirée au hasard toutes les quelques secondes : le mur se renouvelle sans fin.
async function nourrir() {
    try {
        await ajouterPage(1 + Math.floor(Math.random() * pages));
    } catch (erreur) {
        console.error('Affiches :', erreur); // pas grave : on réessaiera au prochain tour
    }
    setTimeout(nourrir, NOURRIR_TOUTES_LES);
}

// ------------------------------------------------------------
//  Le mur : une grille de tuiles un peu plus grande que l'écran.
//  Quand une tuile sort d'un côté, elle revient de l'autre
//  et reçoit l'affiche de sa nouvelle case.
// ------------------------------------------------------------
const mur = document.getElementById('mur');
const modele = document.getElementById('modeleTuile');
const cases = new Map(); // « colonne,ligne » → affiche : en revenant au même endroit, on la retrouve

let tuiles = [];
let largeur, pasX, pasY, colonnes, lignes;
let camX = 0;
let camY = 0;

// Le reste d'une division, toujours positif (en JavaScript, -1 % 5 vaut -1).
function modulo(n, m) {
    return ((n % m) + m) % m;
}

function construire() {
    const petit = innerWidth < 640;
    largeur = petit ? 140 : 210;
    const ecart = petit ? 14 : 24;
    pasX = largeur + ecart;
    pasY = Math.round(largeur * 4 / 3) + ecart;
    colonnes = Math.ceil(innerWidth / pasX) + 2;
    lignes = Math.ceil(innerHeight / pasY) + 2;

    tuiles = [];
    mur.replaceChildren();
    for (let l = 0; l < lignes; l++) {
        for (let c = 0; c < colonnes; c++) {
            const el = modele.content.firstElementChild.cloneNode(true);
            el.style.width = `${largeur}px`;
            el.style.height = `${pasY - ecart}px`;
            tuiles.push({
                el,
                img: el.querySelector('img'),
                titre: el.querySelector('.tuile__titre'),
                legende: el.querySelector('.tuile__legende'),
                c0: c, l0: l, cle: null, x: 0, y: 0,
            });
            mur.append(el);
        }
    }
}

// textContent et alt ne lisent jamais le texte comme du HTML : pas besoin d'echapper() ici.
function accrocher(tuile, affiche) {
    tuile.img.style.opacity = 0;
    if (!affiche) {
        tuile.img.removeAttribute('src');
        return;
    }
    tuile.img.onload = () => { tuile.img.style.opacity = 1; };
    tuile.img.src = image(affiche, 400);
    tuile.img.alt = titreDe(affiche);
    tuile.titre.textContent = titreDe(affiche);
    tuile.legende.textContent = legendeDe(affiche);
}

function afficheDe(cle) {
    if (!cases.has(cle) && affiches.length) cases.set(cle, suivante());
    return cases.get(cle);
}

function placer() {
    const debutC = Math.floor(camX / pasX) - 1;
    for (const t of tuiles) {
        const c = debutC + modulo(t.c0 - debutC, colonnes);
        // Une colonne sur deux descend d'une demi-affiche : le mur ressemble moins à un tableur.
        const decalage = modulo(c, 2) ? pasY / 2 : 0;
        const debutL = Math.floor((camY - decalage) / pasY) - 1;
        const l = debutL + modulo(t.l0 - debutL, lignes);

        t.x = c * pasX - camX;
        t.y = l * pasY + decalage - camY;
        t.el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;

        const cle = `${c},${l}`;
        if (cle !== t.cle) {
            t.cle = cle;
            accrocher(t, afficheDe(cle));
        }
    }
}

// Les données se mettent à jour : une affiche visible est remplacée par la suivante de la pioche.
function renouveler() {
    if (document.hidden || !affiches.length) return;
    const visibles = tuiles.filter(t => t.x > 0 && t.y > 0 && t.x + largeur < innerWidth && t.y + pasY < innerHeight);
    if (!visibles.length) return;
    const tuile = visibles[Math.floor(Math.random() * visibles.length)];
    const affiche = suivante();
    cases.set(tuile.cle, affiche);
    accrocher(tuile, affiche);
    arrivee.textContent = `${titreDe(affiche)} — ${legendeDe(affiche)}`;
}

// ------------------------------------------------------------
//  Le mouvement
// ------------------------------------------------------------
const DERIVE = { x: 0.025, y: 0.018 }; // px par milliseconde : le mur glisse tout seul, en diagonale
const ARRET = { x: 0, y: 0 };
const reduire = matchMedia('(prefers-reduced-motion: reduce)');

let vitesse = { ...DERIVE };
let enMain = false;
let dernier = null;

function boucle(maintenant) {
    const dt = Math.min(maintenant - (boucle.avant ?? maintenant), 50);
    boucle.avant = maintenant;

    if (!enMain) {
        // Après un lancer, la vitesse revient doucement vers la dérive (ou vers l'arrêt si « réduire les animations »).
        const cible = reduire.matches ? ARRET : DERIVE;
        const retour = 1 - Math.exp(-dt / 600);
        vitesse.x += (cible.x - vitesse.x) * retour;
        vitesse.y += (cible.y - vitesse.y) * retour;
        camX += vitesse.x * dt;
        camY += vitesse.y * dt;
    }
    placer();
    requestAnimationFrame(boucle);
}

function limiter(v) {
    return Math.max(-3, Math.min(3, v));
}

mur.addEventListener('pointerdown', (e) => {
    enMain = true;
    mur.setPointerCapture(e.pointerId);
    dernier = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    vitesse = { x: 0, y: 0 };
});
mur.addEventListener('pointermove', (e) => {
    if (!enMain) return;
    const dx = e.clientX - dernier.x;
    const dy = e.clientY - dernier.y;
    const dt = Math.max(e.timeStamp - dernier.t, 1);
    camX -= dx;
    camY -= dy;
    // On garde la vitesse du geste : en lâchant, le mur part sur son élan.
    vitesse = { x: limiter(-dx / dt), y: limiter(-dy / dt) };
    dernier = { x: e.clientX, y: e.clientY, t: e.timeStamp };
});
for (const fin of ['pointerup', 'pointercancel']) {
    mur.addEventListener(fin, () => { enMain = false; });
}

addEventListener('wheel', (e) => {
    e.preventDefault();
    camX += e.deltaX;
    camY += e.deltaY;
}, { passive: false });

const FLECHES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
addEventListener('keydown', (e) => {
    const sens = FLECHES[e.key];
    if (!sens) return;
    e.preventDefault();
    camX += sens[0] * pasX;
    camY += sens[1] * pasY;
});

let attente;
addEventListener('resize', () => {
    clearTimeout(attente);
    attente = setTimeout(construire, 200);
});

// ------------------------------------------------------------
//  Le départ
// ------------------------------------------------------------
const etat = document.getElementById('etat');
const etatTexte = document.getElementById('etatTexte');
const reessayer = document.getElementById('reessayer');

async function demarrer() {
    etatTexte.textContent = 'Chargement…';
    reessayer.hidden = true;
    try {
        await ajouterPage(1); // la première page : les fiches les plus complètes
    } catch (erreur) {
        console.error('Affiches :', erreur);
        etatTexte.textContent = `Impossible de charger les affiches : ${erreur.message}`;
        reessayer.hidden = false;
        return;
    }
    etat.hidden = true;
    tuiles.forEach(t => { t.cle = null; }); // les cases encore vides reçoivent leur affiche
    setTimeout(nourrir, NOURRIR_TOUTES_LES);
    setInterval(renouveler, RENOUVELER_TOUTES_LES);
}

reessayer.addEventListener('click', demarrer);

construire();
requestAnimationFrame(boucle);
demarrer();
