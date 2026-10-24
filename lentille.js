// ============================================================
//  La lentille de verre liquide (WebGL)
//    La scène (les rangées d'affiches) est dessinée dans un canvas 2D ;
//    ici, un shader la relit à travers une lentille aux bords arrondis :
//    près du bord, l'image s'étire et les couleurs se séparent.
// ============================================================

const SOMMETS = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const PIXELS = `
precision highp float;
uniform sampler2D uScene;
uniform vec2 uRes;      // taille de l'écran, en pixels réels
uniform vec2 uDemi;     // demi-taille de la lentille
uniform float uRayon;   // arrondi des coins
uniform float uBande;   // épaisseur du bord qui déforme
uniform float uFlou;    // traînée horizontale pendant qu'on tire
uniform float uOnde;    // force de l'ondulation, en pixels (monte d'un coup à chaque événement)
uniform float uTemps;
varying vec2 vUv;

// Un bruit doux : le même principe que le filtre SVG de l'écran de chargement (feTurbulence).
float hasard(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float bruit(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hasard(i), hasard(i + vec2(1.0, 0.0)), u.x),
               mix(hasard(i + vec2(0.0, 1.0)), hasard(i + vec2(1.0, 1.0)), u.x), u.y);
}
float turbulence(vec2 p) {
    return 0.62 * bruit(p) + 0.38 * bruit(p * 2.03 + 3.1);
}
// Le bruit qui avance lentement, à l'échelle de l'écran
vec2 courant(vec2 p) {
    vec2 q = p / uRes.y * 3.0 + vec2(uTemps * 0.13, uTemps * 0.09);
    return vec2(turbulence(q), turbulence(q + 17.3)) - 0.5;
}

// Distance au bord d'un rectangle arrondi : négative dedans, positive dehors.
float boite(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Le bord ondule comme du liquide : un bruit qui évolue sans cesse, plus fort pendant une onde.
float forme(vec2 p) {
    float vague = turbulence(p / uRes.y * 2.2 + vec2(uTemps * 0.1, -uTemps * 0.07)) - 0.5;
    return boite(p, uDemi, uRayon) + vague * (14.0 + uFlou * 1.2 + uOnde * 1.6);
}

vec4 lire(vec2 px) {
    return texture2D(uScene, clamp(px / uRes, 0.0, 1.0));
}

void main() {
    vec2 px = vUv * uRes;
    vec2 p = px - uRes * 0.5;
    float d = forme(p);
    if (d > 1.5) {
        gl_FragColor = vec4(1.0);
        return;
    }

    vec2 e = vec2(1.0, 0.0);
    vec2 n = normalize(vec2(forme(p + e.xy) - forme(p - e.xy), forme(p + e.yx) - forme(p - e.yx)) + 1e-5);

    // 0 au centre de la lentille, 1 sur son bord
    float bord = smoothstep(-uBande, 0.0, d);
    // On lit plus loin vers l'intérieur : l'image s'étire jusqu'au bord.
    vec2 decalage = -n * pow(bord, 2.6) * uBande * 1.5;
    // Et partout dans le verre, le courant déforme un peu les affiches, davantage près du bord.
    decalage += courant(px) * 2.0 * uOnde * (0.45 + 0.55 * bord);
    // Le rouge et le bleu ne sont pas déviés pareil : la frange colorée.
    float prisme = 0.22 * bord;

    vec3 couleur = vec3(0.0);
    for (int i = -3; i <= 3; i++) {
        vec2 trainee = vec2(float(i) / 3.0 * uFlou, 0.0);
        couleur.r += lire(px + decalage * (1.0 + prisme) + trainee).r;
        couleur.g += lire(px + decalage + trainee).g;
        couleur.b += lire(px + decalage * (1.0 - prisme) + trainee).b;
    }
    couleur /= 7.0;

    // Un fin reflet sur le bord, plus fort en haut.
    couleur += vec3(0.35) * smoothstep(-5.0, 0.0, d) * (0.4 + 0.6 * max(n.y, 0.0));

    // Bord sans crénelage, sur le fond blanc
    float dedans = smoothstep(1.5, -1.5, d);
    gl_FragColor = vec4(mix(vec3(1.0), couleur, dedans), 1.0);
}`;

function compiler(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
}

// Renvoie { rendre(scene, reglages) }, ou null si le navigateur n'a pas WebGL.
export function creerLentille(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return null;

    const programme = gl.createProgram();
    gl.attachShader(programme, compiler(gl, gl.VERTEX_SHADER, SOMMETS));
    gl.attachShader(programme, compiler(gl, gl.FRAGMENT_SHADER, PIXELS));
    gl.linkProgram(programme);
    if (!gl.getProgramParameter(programme, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(programme));
    gl.useProgram(programme);

    // Deux triangles qui couvrent tout l'écran
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(programme, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    const u = {};
    for (const nom of ['uRes', 'uDemi', 'uRayon', 'uBande', 'uFlou', 'uOnde', 'uTemps']) {
        u[nom] = gl.getUniformLocation(programme, nom);
    }

    return {
        rendre(scene, { demi, rayon, bande, flou, onde, temps }) {
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
            gl.uniform2f(u.uRes, canvas.width, canvas.height);
            gl.uniform2f(u.uDemi, demi[0], demi[1]);
            gl.uniform1f(u.uRayon, rayon);
            gl.uniform1f(u.uBande, bande);
            gl.uniform1f(u.uFlou, flou);
            gl.uniform1f(u.uOnde, onde);
            gl.uniform1f(u.uTemps, temps);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        },
    };
}
