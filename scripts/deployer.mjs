// ============================================================
//  La mise en ligne : npm run deployer
//    Construit le site (vite build), puis envoie le dossier dist
//    sur le serveur par FTP sécurisé, avec les accès du fichier .env
//    (jamais commité : voir .env.example).
//
//    Le script n'efface jamais ce qu'il n'a pas envoyé lui-même :
//    il garde la liste de ses fichiers dans .deploy-manifest.json et,
//    d'un envoi à l'autre, ne retire que ses anciens fichiers devenus
//    inutiles (les anciennes versions de assets/…). Les autres dossiers
//    du serveur ne sont jamais touchés.
// ============================================================

import { Client } from 'basic-ftp';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

const racine = new URL('..', import.meta.url).pathname;
const MANIFESTE = join(racine, '.deploy-manifest.json');

const manquantes = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'REMOTE_DIR'].filter(cle => !process.env[cle]);
if (manquantes.length) {
    console.error(`Il manque dans .env : ${manquantes.join(', ')} (modèle : .env.example).`);
    process.exit(1);
}

const local = join(racine, process.env.LOCAL_DIR?.trim() || 'dist');
const distant = process.env.REMOTE_DIR.replace(/\/+$/, '');
if (!existsSync(join(local, 'index.html'))) {
    console.error(`Pas de site construit dans ${local} : lancez d'abord npm run build.`);
    process.exit(1);
}

// Tous les fichiers à envoyer, en chemins relatifs avec des « / ».
function lister(dossier) {
    return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
        const chemin = join(dossier, entree.name);
        if (entree.name === '.DS_Store') return [];
        return entree.isDirectory() ? lister(chemin) : [relative(local, chemin).split(sep).join('/')];
    });
}
const fichiers = lister(local);
const precedents = existsSync(MANIFESTE) ? JSON.parse(readFileSync(MANIFESTE, 'utf8')) : [];

const client = new Client(30000);
try {
    await client.access({
        host: process.env.FTP_HOST,
        port: Number(process.env.FTP_PORT) || 21,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: process.env.FTP_SECURE !== 'false',
    });
    console.log(`Connecté à ${process.env.FTP_HOST}, envoi de ${fichiers.length} fichiers vers ${distant}/`);

    // index.html en dernier : les visiteurs ne voient la nouvelle version qu'une fois tout le reste arrivé.
    const ordre = [...fichiers.filter(f => !f.endsWith('.html')), ...fichiers.filter(f => f.endsWith('.html'))];
    for (const fichier of ordre) {
        await client.ensureDir(posix.join(distant, posix.dirname(fichier)));
        await client.uploadFrom(join(local, fichier), posix.join(distant, fichier));
        console.log(`  ↑ ${fichier}`);
    }

    // Les fichiers envoyés la fois d'avant et qui n'existent plus (anciennes versions des assets).
    const perimes = precedents.filter(f => !fichiers.includes(f));
    for (const fichier of perimes) {
        await client.remove(posix.join(distant, fichier)).then(() => console.log(`  − ${fichier}`), () => {});
    }

    writeFileSync(MANIFESTE, JSON.stringify(fichiers, null, 1));
    console.log(`En ligne : ${process.env.PUBLIC_URL ?? distant}`);
} catch (erreur) {
    console.error('Envoi interrompu :', erreur.message);
    process.exitCode = 1;
} finally {
    client.close();
}
