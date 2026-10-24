// ============================================================
//  La réserve d'affiches : npm run reserve
//    Copie les deux premières pages de chaque chaîne dans
//    public/reserve.json. Le site ne la lit que si Are.na ne répond
//    pas (panne, trop de visiteurs) : il s'affiche quand même.
//    À relancer de temps en temps pour la rafraîchir.
// ============================================================

import { writeFileSync } from 'node:fs';

const API = 'https://api.are.na/v3/channels';
const PAR_PAGE = 40;
const PAGES = 2;
// Les mêmes chaînes que src/donnees.js
const SLUGS = ['swiss-international-typographic', 'typographic-posters', 'prnt-poster-design', 'posters-1515988704'];

const reserve = { creee: new Date().toISOString().slice(0, 10), chaines: {} };

for (const slug of SLUGS) {
    const blocs = [];
    let meta;
    for (let page = 1; page <= PAGES; page++) {
        const reponse = await fetch(`${API}/${slug}/contents?page=${page}&per=${PAR_PAGE}&sort=position_desc`);
        if (!reponse.ok) throw new Error(`${slug}, page ${page} : Are.na répond ${reponse.status}`);
        const donnees = await reponse.json();
        meta = donnees.meta;
        // Seulement ce dont le site a besoin : le titre brut (src/donnees.js le nettoie) et les deux tailles d'image.
        blocs.push(...donnees.data
            .filter(b => b.type === 'Image' && b.image)
            .map(b => ({ id: b.id, title: b.title, petite: b.image.small.src, grande: b.image.medium.src })));
    }
    reserve.chaines[slug] = { pages: meta.total_pages, taille: meta.total_count, blocs };
    console.log(`${slug} : ${blocs.length} affiches`);
}

writeFileSync(new URL('../public/reserve.json', import.meta.url), JSON.stringify(reserve));
console.log('public/reserve.json écrit.');
