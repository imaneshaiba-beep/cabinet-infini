import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss()],
    // Des chemins relatifs : le site marche à la racine d'un domaine comme dans un sous-dossier
    // (shaibanova.techniques-graphiques.be/cabinet-infini/).
    base: './',
    build: {
        // Deux pages : le cabinet et les mentions légales
        rollupOptions: {
            input: {
                main: 'index.html',
                mentions: 'mentions-legales.html',
            },
        },
    },
});
