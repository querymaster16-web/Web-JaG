/* ================================================================
   JaG — Escena Hero 3D (Three.js) + entrada GSAP + reveals de scroll
   ----------------------------------------------------------------
   Solo se carga en escritorio (>820px), tras el primer pintado —
   ver el bootstrap en main.js que hace el import() dinámico. En
   móvil el hero es CSS puro (ver .hero-mesh/.hero-aurora en
   styles.css e index.html) y este archivo nunca se descarga.

   Estructura del archivo:
     1. CONFIG        → todas las variables editables por el equipo
     2. Escena base   → renderer, cámara, luces, entorno
     3. Logo central  → plano con textura "JaG" + destello de estrella
     4. Bloques       → cristal esmerilado con fragmentos de código
     5. Filamentos    → curvas doradas + pulsos de datos viajando
     5B. Logo de fondo → pieza 3D "JG" dorada, sello de agua al hacer scroll
     6. Interacción   → ratón (parallax + arrastre) y resize
     7. Bucle render
     8. Entrada GSAP  → dos actos del hero + reveals de scroll (ScrollTrigger)
   ================================================================ */


import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* Dispositivo táctil (móvil/tablet): puntero "coarse" como principal.
   Se usa para aligerar la escena 3D (cristal + resolución) y para
   decidir cómo se gestiona el gesto de arrastre vs. scroll. */
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

/* ================================================================
   1. CONFIG — EDITA AQUÍ ✏️
   Todas las variables que el equipo puede querer tocar.
   ================================================================ */
const CONFIG = {
  colors: {
    background : 0x0a0a0a,   // Fondo de la escena
    gold       : 0xc9a24b,   // Dorado del logo (filamentos, luces, acentos)
    goldBright : 0xe8c877,   // Dorado claro (pulsos de datos, destello)
    offWhite   : 0xeae7e0,   // Blanco roto (letras J y G)
    glassTint  : 0xbfc6cf,   // Tinte frío sutil del cristal
  },

  camera: {
    fov: 42,
    distance: 11,            // Distancia de la cámara al centro
  },

  cluster: {
    blockCount   : isTouchDevice ? 8 : 12,  // Nº de bloques (menos en móvil: más fluido)
    /* En móvil, "ramas" (filamentos) más cortas: los bloques quedan
       más pegados al logo y el conjunto entra entero en pantallas
       estrechas, sin que ningún bloque se corte por los bordes. */
    radiusMin    : isTouchDevice ? 2.0  : 3.2,   // Radio mínimo de la órbita de los bloques
    radiusMax    : isTouchDevice ? 3.15 : 5.2,   // Radio máximo
    autoRotate   : 0.06,     // Velocidad de rotación automática (rad/s)
    mouseInfluence: 0.35,    // Cuánto reacciona el conjunto al ratón (0 = nada)
    floatAmplitude: 0.18,    // Amplitud del balanceo vertical de los bloques
    floatSpeed    : 0.6,     // Velocidad del balanceo
  },

  glass: {
    transmission: 1.0,       // 1 = cristal real (refracta lo que hay detrás)
    roughness   : 0.42,      // >0 = efecto esmerilado
    thickness   : 1.6,       // Grosor óptico del cristal
    ior         : 1.45,      // Índice de refracción
  },

  filaments: {
    opacity      : 0.32,     // Opacidad de las líneas doradas
    pulsesPerLine: 2,        // Pulsos de luz viajando por cada filamento
    pulseSpeed   : 0.35,     // Velocidad de los pulsos
    pulseSize    : 0.07,     // Tamaño de cada pulso
  },

  logo: {
    scale     : 2.6,         // Tamaño del logo central
    flareScale: 7.0,         // Tamaño del destello de estrella
  },

  performance: {
    maxPixelRatio: 2,        // Límite de DPR (sube a 3 en equipos potentes)
  },
};

/* Fragmentos de código estilizados que "flotan" junto a los bloques.
   Añade o cambia líneas libremente. */
const CODE_SNIPPETS = [
  '<header class="hero">',
  'display: grid;',
  'const web = build();',
  '</section>',
  '@media (min-width:…)',
  'fetch("/api/leads")',
  '<h1>A Coruña</h1>',
  'transition: .3s ease;',
  'export default JaG;',
  '<meta name="seo">',
  'gap: clamp(1rem,…);',
  'await deploy();',
];

/* ================================================================
   2. ESCENA BASE
   ================================================================ */
const canvas = document.getElementById('scene');

/* alpha:true → el canvas es transparente y deja ver la capa decorativa
   del fondo (aurora dorada + logo real en 3D, z-index -1). */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouchDevice, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchDevice ? 1.5 : CONFIG.performance.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // Look cinematográfico
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
/* Sin scene.background: el fondo lo pone el body (negro + logo real) */
/* Niebla: funde los bloques lejanos con el fondo (sensación de profundidad) */
scene.fog = new THREE.Fog(CONFIG.colors.background, 12, 22);

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0.2, CONFIG.camera.distance);

/* CONFIG.camera.fov es el FOV vertical, ajustado a ojo en horizontal
   (escritorio/tablet apaisada). En retrato (aspect < 1 — móviles) ese
   mismo FOV vertical deja un FOV horizontal mucho más estrecho → los
   bloques de los extremos quedan fuera de la pantalla. Solo por debajo
   de aspect 1 recalculamos el FOV vertical para mantener SIEMPRE el
   mismo ancho horizontal (el de un encuadre cuadrado) visible, así el
   conjunto nunca se recorta por los lados; en horizontal no se toca
   nada, para no alterar el encuadre ya ajustado de escritorio. */
const baseAspect = 1;
const halfHFovBase = Math.atan(
  Math.tan((CONFIG.camera.fov * Math.PI / 180) / 2) * baseAspect
);
function updateCameraFov() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < baseAspect
    ? (2 * Math.atan(Math.tan(halfHFovBase) / aspect)) * 180 / Math.PI
    : CONFIG.camera.fov;
  camera.updateProjectionMatrix();
}
updateCameraFov();

/* Entorno HDR procedural: imprescindible para que el cristal y el metal
   tengan reflejos realistas sin cargar ninguna imagen externa. */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

/* ---------- Luces ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

/* Luz dorada central: el logo "emite" luz hacia los bloques */
const goldLight = new THREE.PointLight(CONFIG.colors.gold, 60, 18, 2);
goldLight.position.set(0, 0, 0.5);
scene.add(goldLight);

/* Luz fría lateral para dar volumen a los cristales */
const rimLight = new THREE.DirectionalLight(0xdfe6ee, 1.2);
rimLight.position.set(-6, 4, 6);
scene.add(rimLight);

/* Grupo raíz: todo el conjunto rota junto (interacción con el ratón) */
const cluster = new THREE.Group();
scene.add(cluster);

/* ================================================================
   3. LOGO CENTRAL "JaG" — nodo principal de la red
   ----------------------------------------------------------------
   Se dibuja en un <canvas> 2D en alta resolución (el PNG original es
   muy pequeño) respetando los colores del logo: J y G en blanco roto
   metálico y la "a" en dorado. Luego se usa como textura de un plano.
   ================================================================ */
function createLogoTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 300px "Helvetica Neue", Arial, sans-serif';

  /* Degradado vertical metálico para las letras blancas */
  const silver = ctx.createLinearGradient(0, 100, 0, 412);
  silver.addColorStop(0, '#ffffff');
  silver.addColorStop(0.5, '#d8d5cd');
  silver.addColorStop(1, '#8f8c84');

  /* Degradado metálico dorado para la "a" */
  const gold = ctx.createLinearGradient(0, 100, 0, 412);
  gold.addColorStop(0, '#f0d48a');
  gold.addColorStop(0.5, '#c9a24b');
  gold.addColorStop(1, '#7d5f2a');

  /* Composición de las tres letras con espaciado manual */
  ctx.fillStyle = silver;
  ctx.fillText('J', 300, 276);
  ctx.fillStyle = gold;
  ctx.fillText('a', 512, 276);
  ctx.fillStyle = silver;
  ctx.fillText('G', 736, 276);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const logoMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 1),
  new THREE.MeshBasicMaterial({
    map: createLogoTexture(),
    transparent: true,
    depthWrite: false,
  })
);
logoMesh.scale.setScalar(CONFIG.logo.scale);
cluster.add(logoMesh);

/* ---------- Destello de estrella tras el logo ---------- */
function createFlareTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256;

  /* Halo radial suave */
  const halo = ctx.createRadialGradient(cx, cx, 0, cx, cx, 256);
  halo.addColorStop(0, 'rgba(232, 200, 119, 0.55)');
  halo.addColorStop(0.25, 'rgba(201, 162, 75, 0.18)');
  halo.addColorStop(1, 'rgba(201, 162, 75, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 512, 512);

  /* Rayos en cruz (destello de estrella) */
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[500, 5], [5, 380]]) {
    const ray = ctx.createRadialGradient(cx, cx, 0, cx, cx, Math.max(w, h) / 2);
    ray.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
    ray.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = ray;
    ctx.save();
    ctx.translate(cx, cx);
    ctx.scale(w / 512, h / 512);
    ctx.beginPath();
    ctx.arc(0, 0, 256, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return new THREE.CanvasTexture(c);
}

const flare = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: createFlareTexture(),
    blending: THREE.AdditiveBlending,  // Suma de luz: brilla de verdad
    depthWrite: false,
    transparent: true,
  })
);
flare.scale.setScalar(CONFIG.logo.flareScale);
flare.position.z = -0.3;               // Justo detrás del logo
cluster.add(flare);

/* ================================================================
   4. BLOQUES DE CRISTAL ESMERILADO + fragmentos de código
   ================================================================ */

/* Material de cristal compartido (transmission = refracción real) */
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color          : CONFIG.colors.glassTint,
  transmission   : CONFIG.glass.transmission,
  roughness      : CONFIG.glass.roughness,
  thickness      : CONFIG.glass.thickness,
  ior            : CONFIG.glass.ior,
  metalness      : 0,
  envMapIntensity: 1.2,
});

/* Textura de un fragmento de código (canvas 2D → plano flotante) */
function createCodeTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '500 44px "SF Mono", "Fira Code", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  /* Las etiquetas HTML en dorado, el resto en gris claro */
  ctx.fillStyle = text.trim().startsWith('<') ? '#c9a24b' : '#b9b5ac';
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/* Distribución de los bloques en una esfera irregular alrededor del logo */
const blocks = [];        // { mesh, code, basePos, floatPhase }
const blockAnchors = [];  // Puntos de anclaje de los filamentos

for (let i = 0; i < CONFIG.cluster.blockCount; i++) {
  /* Posición esférica pseudoaleatoria pero estable (determinista por índice) */
  const phi = Math.acos(1 - 2 * ((i + 0.5) / CONFIG.cluster.blockCount));
  const theta = i * 2.399963;   // Ángulo áureo → distribución uniforme
  const radius = CONFIG.cluster.radiusMin +
    (CONFIG.cluster.radiusMax - CONFIG.cluster.radiusMin) * ((i * 0.37) % 1);

  const pos = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
  /* Aplanamos ligeramente la nube en Y para componer con el texto del hero */
  pos.y *= 0.62;

  /* Bloque de cristal con proporciones variadas (arquitectura abstracta) */
  const w = 0.55 + ((i * 0.61) % 1) * 0.9;
  const h = 0.35 + ((i * 0.83) % 1) * 1.3;
  const d = 0.3 + ((i * 0.47) % 1) * 0.5;
  const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMaterial);
  block.position.copy(pos);
  block.rotation.set((i * 0.7) % 1 - 0.5, (i * 1.3) % 2, (i * 0.5) % 1 - 0.5);
  cluster.add(block);

  /* Fragmento de código flotando sobre el bloque */
  const code = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.4),
    new THREE.MeshBasicMaterial({
      map: createCodeTexture(CODE_SNIPPETS[i % CODE_SNIPPETS.length]),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  code.position.copy(pos);
  code.position.y += h * 0.5 + 0.3;
  cluster.add(code);

  blocks.push({ mesh: block, code, basePos: pos.clone(), floatPhase: i * 1.7 });
  blockAnchors.push(pos.clone());
}

/* ================================================================
   5. FILAMENTOS DE LUZ DORADOS — la red de datos
   ----------------------------------------------------------------
   Curvas Bézier del centro (logo) a cada bloque + pequeños pulsos
   luminosos que viajan por ellas como paquetes de datos.
   ================================================================ */
const pulses = [];   // { sprite, curve, offset }

/* Textura de un punto de luz para los pulsos */
function createDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 235, 180, 1)');
  g.addColorStop(0.4, 'rgba(232, 200, 119, 0.6)');
  g.addColorStop(1, 'rgba(232, 200, 119, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const dotTexture = createDotTexture();

const lineMaterial = new THREE.LineBasicMaterial({
  color: CONFIG.colors.gold,
  transparent: true,
  opacity: CONFIG.filaments.opacity,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

blockAnchors.forEach((anchor, i) => {
  /* Punto de control desplazado → la línea se curva con elegancia */
  const mid = anchor.clone().multiplyScalar(0.5);
  mid.y += (i % 2 === 0 ? 1 : -1) * (0.4 + (i * 0.29) % 0.6);

  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), mid, anchor);

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
    lineMaterial
  );
  cluster.add(line);

  /* Pulsos de datos repartidos a lo largo de la curva */
  for (let p = 0; p < CONFIG.filaments.pulsesPerLine; p++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }));
    sprite.scale.setScalar(CONFIG.filaments.pulseSize * 3);
    cluster.add(sprite);
    pulses.push({ sprite, curve, offset: (p / CONFIG.filaments.pulsesPerLine) + i * 0.13 });
  }
});

/* ================================================================
   6. INTERACCIÓN — ratón (parallax + arrastre) y resize
   ================================================================ */
const pointer = { x: 0, y: 0 };          // Posición normalizada del ratón
const drag = { active: false, lastX: 0, lastY: 0, velX: 0, velY: 0 };

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Opacidad de la escena 3D del hero (se desvanece al hacer scroll) */
let sceneOpacity = 1;

window.addEventListener('pointermove', (e) => {
  if (desktopIntro) requestReveal();

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;

  if (drag.active) {
    /* Arrastre: rotación directa con inercia al soltar */
    drag.velX = (e.clientX - drag.lastX) * 0.004;
    drag.velY = (e.clientY - drag.lastY) * 0.004;
    cluster.rotation.y += drag.velX;
    cluster.rotation.x += drag.velY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  }
});

canvas.addEventListener('pointerdown', (e) => {
  /* En móvil no hay arrastre manual: los bloques se mueven solos
     (ver animate()) y el dedo se reserva entero para el scroll. */
  if (isTouchDevice) return;
  drag.active = true;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  canvas.style.cursor = 'grabbing';
});
function endDrag() {
  drag.active = false;
  canvas.style.cursor = 'grab';
}
window.addEventListener('pointerup', endDrag);
/* pointercancel: el navegador reclama el gesto para hacer scroll nativo
   (ver touch-action: pan-y en #scene) — soltamos el arrastre sin más. */
window.addEventListener('pointercancel', endDrag);
canvas.style.cursor = 'grab';

window.addEventListener('resize', () => {
  updateCameraFov();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ================================================================
   7. BUCLE DE RENDER
   ================================================================ */
const clock = new THREE.Clock();

/* rafId permite pararlo del todo (no solo saltarse el render()) cuando
   la pestaña pasa a segundo plano (ver visibilitychange más abajo) o
   cuando sceneOpacity llega a 0 al hacer scroll (ver el listener de
   scroll): sin logo de fondo, no queda nada que animar ahí abajo. */
let rafId = null;
function animate() {
  rafId = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  if (isTouchDevice) {
    /* Móvil: sin ratón ni arrastre — el conjunto deriva solo, con un
       balanceo orgánico hecho de senos de frecuencias distintas (se
       nota vivo y aleatorio, pero nunca brusco ni repetitivo). */
    cluster.rotation.y += CONFIG.cluster.autoRotate * 0.016;
    const driftX = Math.sin(t * 0.17) * 0.16 + Math.sin(t * 0.053 + 2.1) * 0.09;
    const driftZ = Math.sin(t * 0.11 + 1.7) * 0.10 + Math.sin(t * 0.029 + 0.4) * 0.07;
    cluster.rotation.x += (driftX - cluster.rotation.x) * 0.02;
    cluster.rotation.z += (driftZ - cluster.rotation.z) * 0.02;
  } else {
    /* Rotación automática + inercia del arrastre */
    if (!drag.active) {
      cluster.rotation.y += CONFIG.cluster.autoRotate * 0.016 + drag.velX;
      cluster.rotation.x += drag.velY;
      drag.velX *= 0.95;   // Fricción de la inercia
      drag.velY *= 0.95;
    }

    /* Parallax suave: el conjunto se inclina hacia el cursor */
    const targetTiltX = pointer.y * CONFIG.cluster.mouseInfluence * 0.4;
    cluster.rotation.x += (targetTiltX - cluster.rotation.x) * 0.03;
    cluster.rotation.z += (0 - cluster.rotation.z) * 0.02;
  }

  /* Balanceo vertical de cada bloque (flotan en el espacio) */
  for (const b of blocks) {
    const y = Math.sin(t * CONFIG.cluster.floatSpeed + b.floatPhase) *
              CONFIG.cluster.floatAmplitude;
    b.mesh.position.y = b.basePos.y + y;
    b.code.position.y = b.basePos.y + y + 0.55;
    /* Los fragmentos de código siempre miran a la cámara (billboard) */
    b.code.quaternion.copy(cluster.quaternion).invert();
  }

  /* El logo siempre de frente; el destello "respira" */
  logoMesh.quaternion.copy(cluster.quaternion).invert();
  flare.material.opacity = 0.75 + Math.sin(t * 1.4) * 0.2;
  goldLight.intensity = 55 + Math.sin(t * 1.4) * 12;

  /* Pulsos de datos recorriendo los filamentos */
  for (const p of pulses) {
    const u = (t * CONFIG.filaments.pulseSpeed + p.offset) % 1;
    p.curve.getPoint(u, p.sprite.position);
    /* Se desvanecen al llegar a los extremos de la línea */
    p.sprite.material.opacity = Math.sin(u * Math.PI);
  }

  /* Solo renderizamos si la escena es visible: ahorro de GPU */
  if (sceneOpacity > 0) renderer.render(scene, camera);
}
function startLoop() { if (rafId === null) animate(); }
function stopLoop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }
startLoop();

/* Pestaña en segundo plano → nada que ganar animando: paramos del
   todo el bucle (y con él, todo el trabajo de CPU/GPU) mientras nadie
   lo ve, y lo retomamos en cuanto vuelve a primer plano. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLoop(); else startLoop();
});

/* ================================================================
   8. UI — animaciones de entrada (GSAP) y menú móvil
   ================================================================ */


/* Entrada escalonada de los textos del hero.
   En escritorio (con movimiento normal, no reducido) la entrada es en
   dos actos:
     1) Primer fotograma: pantalla en negro, sin escena 3D ni aurora
        — solo el eslogan, que "cae" desde arriba. Se queda así hasta
        que el usuario mueve el ratón.
     2) En cuanto lo mueve, se revela el entorno 3D con los "hilos" de
        fondo, y el eslogan encoge y sube arriba del todo para no
        solaparse con lo que aparece detrás — ver revealScene() y
        requestReveal() más abajo. (El scroll NO cuenta como
        interacción aquí a propósito: puede dispararse solo, sin que
        el usuario haya tocado nada — ver el listener de scroll.)
   En móvil (sin ratón) o con movimiento reducido, se mantiene la
   entrada simple de siempre: todo visible desde el principio. */
const desktopIntro = !isTouchDevice && !prefersReducedMotion;

let revealed = false;
function revealScene() {
  if (revealed) return;
  revealed = true;

  /* Si el usuario ya había bajado de la sección del hero antes de
     mover el ratón por primera vez (p. ej. hizo scroll con el
     teclado o la rueda sin llegar a mover el cursor), revelar a
     opacidad 1 a secas hacía que el cluster de bloques apareciera
     flotando sobre secciones muy por debajo del hero, como
     "Nuestra identidad" — el bug que se veía al recargar y bajar
     directo. En vez de un 1 fijo, apunta a la misma opacidad que ya
     le tocaría por la posición de scroll actual (0 si ya se bajó del
     todo), con la misma fórmula que usa el listener de scroll. */
  sceneOpacity = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.7));
  if (sceneOpacity > 0) startLoop(); else stopLoop();

  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .to(canvas,           { opacity: sceneOpacity, duration: 2.3 }, 0)
    .to('.bg-brand',      { opacity: sceneOpacity, duration: 2.3 }, 0)
    /* power2.out (en vez de poner in-out): arranca el movimiento
       enseguida, en cuanto el usuario mueve el ratón, en vez de tener
       un instante de arranque lento — se nota más fluido y reactivo.
       Duración larga (2.2s) para que el encogido se vea pausado, y
       el resto de piezas (canvas, bg-brand, hint) terminan todas a la
       vez en ~2.3s — si una acaba antes que las demás, la transición
       se ve "cortada" en vez de un único gesto limpio. */
    .to('.hero-content',  { y: '-20vh', scale: 0.34, duration: 2.2, ease: 'power2.out' }, 0.1)
    .to('.hero-hint',     { opacity: 1, y: 0, duration: 0.8 }, 1.5);
}

/* Si el usuario mueve el ratón (o hace scroll) MIENTRAS el eslogan
   todavía está cayendo, no revelamos a medias — eso es lo que se veía
   "raro": las dos animaciones (la caída y el encogido) peleándose por
   el mismo elemento a la vez. En vez de eso, lo dejamos apuntado
   (pendingReveal) y se revela solo en cuanto la caída termina de
   asentarse (ver intro.eventCallback('onComplete') más abajo) — así
   el primer acto (pantalla negra + eslogan) se ve siempre completo,
   sea cual sea el timing con el que el usuario interactúe. */
let pendingReveal = false;
function requestReveal() {
  if (revealed) return;
  if (intro.progress() < 1) { pendingReveal = true; return; }
  revealScene();
}

/* Sin "y" aquí (a diferencia del resto de la entrada) — un transform
   en .site-header, aunque solo dure la animación, convierte a la
   cabecera en el "containing block" de cualquier descendiente con
   position: fixed (spec de CSS). El menú móvil de pantalla completa
   (.main-nav, position: fixed) vive dentro de la cabecera, así que
   mientras esta animación no había terminado (y quitado el transform
   con clearProps) el menú se veía a medio tamaño un instante y luego
   "saltaba" a pantalla completa si se abría justo entonces. Animando
   solo opacity, la cabecera nunca lleva transform y el problema
   desaparece del todo, sin depender de ningún timing. */
gsap.set('.site-header', { opacity: 0 });

const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

if (desktopIntro) {
  gsap.set(canvas, { opacity: 0 });
  gsap.set('.bg-brand', { opacity: 0 });
  gsap.set('.hero-content', { opacity: 0, y: '-22vh', transformOrigin: 'top center' });
  gsap.set('.hero-hint', { opacity: 0, y: 28 });

  intro
    .to('.site-header',  { opacity: 1, duration: 1.0, delay: 0.3 })
    /* power2.out en vez de un "back" con rebote: cae y se asienta en
       un solo gesto continuo, sin el latigazo final — se ve más
       fluido y menos "juguetón". */
    .to('.hero-content', { opacity: 1, y: 0, duration: 1.4, ease: 'power2.out' }, '-=0.5');

  /* Si ya se pidió revelar mientras caía (pendingReveal), se dispara
     en cuanto termina de asentarse, sin esperar a un segundo gesto. */
  intro.eventCallback('onComplete', () => {
    if (pendingReveal) revealScene();
  });
} else {
  gsap.set(['.hero-tag', '.hero-title', '.hero-subtitle', '.hero-hint'], { opacity: 0, y: 28 });
  intro
    .to('.site-header',   { opacity: 1, duration: 1.0, delay: 0.3 })
    .to('.hero-tag',      { opacity: 1, y: 0, duration: 0.9 }, '-=0.6')
    .to('.hero-title',    { opacity: 1, y: 0, duration: 1.1 }, '-=0.6')
    .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.9 }, '-=0.7')
    .to('.hero-hint',     { opacity: 1, y: 0, duration: 0.9 }, '-=0.5');
}

/* El indicador inferior y la escena 3D del hero se desvanecen al
   hacer scroll. */
window.addEventListener('scroll', () => {
  const hint = document.getElementById('heroHint');

  /* El scroll NUNCA dispara la revelación por su cuenta (a diferencia
     de versiones anteriores): un scroll puede llegar sin que el
     usuario haya tocado nada — por ejemplo, el scrollTo(0,0) de más
     arriba, al recargar la página con un scroll restaurado, genera un
     evento "scroll" real sin intervención suya. Solo el ratón
     (pointermove, ver requestReveal()) cuenta como interacción. Hasta
     que eso pase, esto se queda tal y como lo deja la entrada. */
  if (!desktopIntro || revealed) {
    hint.style.opacity = Math.max(0, 1 - window.scrollY / 200);

    sceneOpacity = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.7));
    canvas.style.opacity = sceneOpacity;
    /* Nada que renderizar por debajo del hero: paramos el bucle del
       todo en vez de solo saltarnos el render() cada frame. */
    if (sceneOpacity > 0) startLoop(); else stopLoop();
  }
}, { passive: true });
/* ================================================================
   9. ANIMACIONES DE SCROLL (GSAP ScrollTrigger)
   ----------------------------------------------------------------
   Cada sección aparece con una animación fluida al bajar la página.
   El scroll suave de los enlaces del menú lo gestiona el CSS
   (scroll-behavior: smooth + scroll-margin-top en cada sección).
   ================================================================ */
gsap.registerPlugin(ScrollTrigger);

/* Cabeceras de sección: etiqueta, título y entradilla en cascada */
document.querySelectorAll('.section-head').forEach((head) => {
  gsap.from(head.children, {
    scrollTrigger: { trigger: head, start: 'top 82%' },
    y: 40,
    opacity: 0,
    duration: 0.9,
    stagger: 0.12,
    ease: 'power3.out',
  });
});

/* Pasos del método: entran desde la izquierda uno a uno */
gsap.from('.step', {
  scrollTrigger: { trigger: '.steps', start: 'top 78%' },
  x: -50,
  opacity: 0,
  duration: 0.9,
  stagger: 0.15,
  ease: 'power3.out',
});

/* Bloque "Nosotros": aparición suave del texto */
gsap.from('.about-block > *', {
  scrollTrigger: { trigger: '.about-block', start: 'top 80%' },
  y: 36,
  opacity: 0,
  duration: 0.9,
  stagger: 0.14,
  ease: 'power3.out',
});
