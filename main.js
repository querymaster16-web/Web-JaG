/* ================================================================
   JaG — Escena Hero 3D (Three.js) + interacciones de UI
   ----------------------------------------------------------------
   Estructura del archivo:
     1. CONFIG        → todas las variables editables por el equipo
     2. Escena base   → renderer, cámara, luces, entorno
     3. Logo central  → plano con textura "JaG" + destello de estrella
     4. Bloques       → cristal esmerilado con fragmentos de código
     5. Filamentos    → curvas doradas + pulsos de datos viajando
     6. Interacción   → ratón (parallax + arrastre) y resize
     7. Bucle render
     8. UI            → animaciones GSAP y menú móvil
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

  bgLogo: {                  // Logo real (assets/IMG_0516.PNG) de fondo
    maxOpacity   : 0.16,     // Opacidad máxima del sello de agua
    width        : 7.5,      // Ancho del logo en unidades de mundo
    depth        : 0.4,      // Grosor de la pieza 3D (extrusión)
    layers       : 1,        // Pieza única y limpia (sin apilado → sin sombra)
    metalness    : 0.9,      // Acabado metálico (reacciona a la luz)
    roughness    : 0.18,     // Rugosidad baja → material pulido y brillante
    tint         : 0xe8c877, // Tinte dorado sobre el metal gris del PNG
    glowBase     : 0.7,      // Brillo dorado propio (emissive) en reposo
    glowHover    : 1.7,      // Brillo al pasar el ratón por encima
    hoverOpacity : 0.6,      // Opacidad extra en hover (proporción sobre la base)
    zoomSpeed    : 0.006,    // Avance en Z por segundo (casi imperceptible)
    zoomMax      : 2.2,      // Tope del avance (nunca invade la cámara)
    tiltAmount   : 0.14,     // Inclinación máxima siguiendo al cursor (rad)
    shimmerRange : 5,        // Recorrido de la luz que sigue al ratón
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
   5B. FONDO — LOGO REAL "JG" EN 3D (assets/IMG_0516.PNG)
   ----------------------------------------------------------------
   Escena independiente en el canvas #logoScene (z-index -1, detrás
   de las secciones). La silueta del PNG se convierte en una PIEZA
   CON VOLUMEN: se apilan varias capas de la silueta en profundidad
   (las traseras más oscuras → lateral con sombra propia), de modo
   que al inclinarse con el ratón se lee como un sólido extruido
   de metal dorado pulido:
     · Oculto en el hero; fade-in suave al hacer scroll.
     · Zoom-in en Z constante y casi imperceptible.
     · Se ilumina gradualmente al pasar el cursor por encima.
     · Inclinación parallax + PointLight que sigue al ratón
       (reflejos cambiantes "shimmer" sobre el acabado dorado).
   ================================================================ */
const bgCanvas = document.getElementById('logoScene');
const bgRenderer = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: !isTouchDevice, alpha: true });
bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchDevice ? 1.5 : CONFIG.performance.maxPixelRatio));
bgRenderer.setSize(window.innerWidth, window.innerHeight);
bgRenderer.toneMapping = THREE.ACESFilmicToneMapping;
bgRenderer.toneMappingExposure = 1.15;

const bgScene = new THREE.Scene();
const bgCamera = new THREE.PerspectiveCamera(
  40, window.innerWidth / window.innerHeight, 0.1, 50
);
bgCamera.position.z = 10;

/* Luz ambiente tenue + luz puntual dorada que sigue al cursor:
   es la que genera los brillos móviles sobre el metal del logo */
bgScene.add(new THREE.AmbientLight(0xffffff, 0.5));
const shimmerLight = new THREE.PointLight(CONFIG.colors.goldBright, 90, 40, 1.6);
shimmerLight.position.set(0, 0, 5);
bgScene.add(shimmerLight);

/* Luz direccional cálida fija: destello constante sobre el metal
   pulido, independiente de dónde esté el cursor */
const sheenLight = new THREE.DirectionalLight(0xfff2d0, 1.3);
sheenLight.position.set(-4, 6, 8);
bgScene.add(sheenLight);

/* Entorno HDR procedural también en esta escena: los reflejos de
   "estudio" sobre el metal son los que dan el brillo de calidad al
   dorado (sin entorno, un metal pulido se ve plano y apagado) */
const bgPmrem = new THREE.PMREMGenerator(bgRenderer);
bgScene.environment = bgPmrem.fromScene(new RoomEnvironment(bgRenderer), 0.04).texture;

/* Material base metálico pulido: cada capa del volumen usa un clon
   con su propio sombreado. El tinte dorado multiplica el metal gris
   del PNG → acabado dorado coherente con la marca. */
const bgLogoBaseMaterial = new THREE.MeshStandardMaterial({
  color       : CONFIG.bgLogo.tint,
  transparent : true,
  opacity     : 0,                          // Oculto hasta hacer scroll
  metalness   : CONFIG.bgLogo.metalness,
  roughness   : CONFIG.bgLogo.roughness,
  /* Brillo dorado propio: el logo "emite" luz suave y no depende
     solo de las luces de la escena para verse sobre el negro */
  emissive         : CONFIG.bgLogo.tint,
  emissiveIntensity: CONFIG.bgLogo.glowBase,
  /* Reflejos del entorno HDR bien presentes sobre el oro */
  envMapIntensity  : 1.5,
  depthWrite  : false,
});

/* IMG_0516.PNG no tiene canal alfa: es el logo sobre un fondo gris
   muy claro. Lo procesamos en un canvas 2D para poder usarlo como
   sello de agua: el fondo claro pasa a transparente (alfa según
   luminosidad) y recortamos el lienzo al área real del monograma. */
function createBgLogoTexture(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const px = imgData.data;
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0;

  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
    /* Fondo claro (lum alta) → transparente; logo oscuro → opaco.
       La rampa de 60 niveles suaviza los bordes (antialiasing). */
    const alpha = Math.max(0, Math.min(1, (215 - lum) / 60));
    px[i + 3] = alpha * 255;

    if (alpha > 0.05) {
      const p = i / 4;
      const x = p % c.width;
      const y = (p / c.width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  /* Recorte al monograma con un pequeño margen de aire */
  const pad = 24;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(c.width, maxX + pad) - sx;
  const sh = Math.min(c.height, maxY + pad) - sy;

  /* Reescalado 3×: el monograma solo ocupa ~300 px en el PNG
     original; ampliamos con el suavizado de máxima calidad del
     navegador para que la textura aguante pantallas 4K/Retina */
  const SCALE = 3;
  const out = document.createElement('canvas');
  out.width = sw * SCALE;
  out.height = sh * SCALE;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);

  /* Afinado del contorno: reencuadra la rampa del alfa y le aplica
     una curva suave (smoothstep) → borde limpio y definido en alta
     densidad de píxeles, sin halos ni escalones */
  const od = octx.getImageData(0, 0, out.width, out.height);
  const opx = od.data;
  for (let i = 3; i < opx.length; i += 4) {
    const a = opx[i] / 255;
    const e = Math.min(1, Math.max(0, (a - 0.22) / 0.5));
    opx[i] = Math.round(e * e * (3 - 2 * e) * 255);
  }
  octx.putImageData(od, 0, 0);

  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = bgRenderer.capabilities.getMaxAnisotropy();
  return { tex, ratio: sh / sw };
}

/* Construcción del volumen: se apilan `layers` copias de la silueta
   a lo largo de `depth`. La capa frontal va a plena luz y las
   traseras se oscurecen progresivamente, de modo que al rotar la
   pieza el lateral escalonado se percibe como el canto sombreado
   de un sólido extruido. */
let bgLogoGroup = null;
const bgLogoMaterials = [];   // Materiales de todas las capas (fade/glow)

new THREE.ImageLoader().load('assets/IMG_0516.PNG', (img) => {
  const { tex, ratio } = createBgLogoTexture(img);
  const geometry = new THREE.PlaneGeometry(
    CONFIG.bgLogo.width, CONFIG.bgLogo.width * ratio
  );

  bgLogoGroup = new THREE.Group();
  const total = CONFIG.bgLogo.layers;

  for (let i = 0; i < total; i++) {
    /* Con una sola capa `back` = 0 → pieza plena, brillante y uniforme
       (sin capas traseras oscuras que asomen como sombra difusa) */
    const back = total > 1 ? i / (total - 1) : 0;
    const mat = bgLogoBaseMaterial.clone();
    mat.map = tex;
    /* La misma textura modula la emisión: solo brilla el monograma */
    mat.emissiveMap = tex;
    /* Sombreado del canto: cuanto más atrás, más oscura */
    mat.color.multiplyScalar(1 - back * 0.5);
    /* Atenuación del brillo/opacidad hacia el fondo de la pieza */
    mat.userData.shade = 1 - back * 0.55;

    const layer = new THREE.Mesh(geometry, mat);
    layer.position.z = -back * CONFIG.bgLogo.depth;
    bgLogoGroup.add(layer);
    bgLogoMaterials.push(mat);
  }

  bgScene.add(bgLogoGroup);
});

/* Opacidad objetivo según el scroll (el bucle de render interpola
   hacia ella → fade-in/out siempre limpio y suave) */
let bgLogoOpacityTarget = 0;

/* Hover: raycast del cursor contra el plano del logo. Cuando el
   ratón está encima, bgHover sube suavemente hacia 1 y el logo
   gana brillo y presencia; al salir, vuelve a su estado sutil. */
const bgRaycaster = new THREE.Raycaster();
const bgPointerNDC = new THREE.Vector2();
let bgHover = 0;

/* ================================================================
   6. INTERACCIÓN — ratón (parallax + arrastre) y resize
   ================================================================ */
const pointer = { x: 0, y: 0 };          // Posición normalizada del ratón
const drag = { active: false, lastX: 0, lastY: 0, velX: 0, velY: 0 };

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Opacidad de la escena 3D del hero (se desvanece al hacer scroll) */
let sceneOpacity = 1;

window.addEventListener('pointermove', (e) => {
  if (desktopIntro) revealScene();

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

  bgCamera.aspect = window.innerWidth / window.innerHeight;
  bgCamera.updateProjectionMatrix();
  bgRenderer.setSize(window.innerWidth, window.innerHeight);
});

/* ================================================================
   7. BUCLE DE RENDER
   ================================================================ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
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

  /* ---------- Logo real de fondo (pieza 3D dorada) ---------- */
  if (bgLogoGroup) {
    /* Zoom-in constante en Z, milimétrico y con tope de seguridad */
    bgLogoGroup.position.z = Math.min(t * CONFIG.bgLogo.zoomSpeed, CONFIG.bgLogo.zoomMax);

    /* ¿Está el cursor sobre el logo? → brillo e intensidad extra */
    bgPointerNDC.set(pointer.x, -pointer.y);
    bgRaycaster.setFromCamera(bgPointerNDC, bgCamera);
    const over = bgRaycaster.intersectObjects(bgLogoGroup.children).length > 0;
    bgHover += ((over && !prefersReducedMotion ? 1 : 0) - bgHover) * 0.06;

    /* Brillo y opacidad objetivo (con extra mientras hay hover) */
    const glow = CONFIG.bgLogo.glowBase +
      bgHover * (CONFIG.bgLogo.glowHover - CONFIG.bgLogo.glowBase);
    const bgOpacityGoal =
      bgLogoOpacityTarget * (1 + bgHover * CONFIG.bgLogo.hoverOpacity);

    /* El monograma se "enciende" gradualmente bajo el cursor.
       Cada capa aplica su sombreado propio (más tenue hacia atrás). */
    for (const m of bgLogoMaterials) {
      m.emissiveIntensity = glow * m.userData.shade;
      m.opacity += (bgOpacityGoal * m.userData.shade - m.opacity) * 0.05;
    }
    shimmerLight.intensity = 90 * (1 + bgHover * 0.9);

    if (!prefersReducedMotion) {
      /* Parallax: la pieza rota e inclina sutilmente hacia el cursor
         (al girar, el canto por capas revela el volumen) */
      bgLogoGroup.rotation.x += (-pointer.y * CONFIG.bgLogo.tiltAmount - bgLogoGroup.rotation.x) * 0.04;
      bgLogoGroup.rotation.y += ( pointer.x * CONFIG.bgLogo.tiltAmount * 1.4 - bgLogoGroup.rotation.y) * 0.04;

      /* La luz sigue al ratón → reflejos "shimmer" sobre el dorado */
      shimmerLight.position.x += (pointer.x * CONFIG.bgLogo.shimmerRange - shimmerLight.position.x) * 0.05;
      shimmerLight.position.y += (-pointer.y * CONFIG.bgLogo.shimmerRange * 0.7 - shimmerLight.position.y) * 0.05;
    }
  }

  /* Solo renderizamos cada escena si es visible: ahorro de GPU */
  if (sceneOpacity > 0) renderer.render(scene, camera);
  if (bgLogoMaterials.length && bgLogoMaterials[0].opacity > 0.001) {
    bgRenderer.render(bgScene, bgCamera);
  }
}
animate();

/* ================================================================
   8. UI — animaciones de entrada (GSAP) y menú móvil
   ================================================================ */

/* ---------- Al recargar, la página SIEMPRE empieza desde arriba ----------
   1) Guarda el #ancla original (una subpágina puede llegar con
      #presupuesto o #privacidad para abrir un modal, ver más abajo).
   2) Desactiva la restauración automática de scroll del navegador.
   3) Elimina el #ancla de la URL si quedó de una navegación anterior.
   4) Sube al inicio. */
const initialHash = location.hash;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash) history.replaceState(null, '', location.pathname);
window.scrollTo(0, 0);

/* Entrada escalonada de los textos del hero.
   En escritorio (con movimiento normal, no reducido) la entrada es en
   dos actos:
     1) Primer fotograma: pantalla en negro, sin escena 3D ni aurora
        — solo el eslogan, que "cae" desde arriba. Se queda así hasta
        que el usuario interactúa.
     2) En cuanto mueve el ratón (o hace scroll, por si entra con
        trackpad) se revela el entorno 3D con los "hilos" de fondo, y
        el eslogan encoge y sube arriba del todo para no solaparse con
        lo que aparece detrás — ver revealScene() más abajo.
   En móvil (sin ratón) o con movimiento reducido, se mantiene la
   entrada simple de siempre: todo visible desde el principio. */
const desktopIntro = !isTouchDevice && !prefersReducedMotion;

let revealed = false;
function revealScene() {
  if (revealed) return;
  revealed = true;
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .to(canvas,           { opacity: 1, duration: 1.8 }, 0)
    .to('.bg-brand',      { opacity: 1, duration: 1.8 }, 0)
    /* power2.out (en vez de poner in-out): arranca el movimiento
       enseguida, en cuanto el usuario mueve el ratón, en vez de tener
       un instante de arranque lento — se nota más fluido y reactivo. */
    .to('.hero-content',  { y: '-20vh', scale: 0.34, duration: 1.3, ease: 'power2.out' }, 0.1)
    .to('.hero-hint',     { opacity: 1, y: 0, duration: 0.8 }, 0.5);
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
} else {
  gsap.set(['.hero-tag', '.hero-title', '.hero-subtitle', '.hero-hint'], { opacity: 0, y: 28 });
  intro
    .to('.site-header',   { opacity: 1, duration: 1.0, delay: 0.3 })
    .to('.hero-tag',      { opacity: 1, y: 0, duration: 0.9 }, '-=0.6')
    .to('.hero-title',    { opacity: 1, y: 0, duration: 1.1 }, '-=0.6')
    .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.9 }, '-=0.7')
    .to('.hero-hint',     { opacity: 1, y: 0, duration: 0.9 }, '-=0.5');
}

/* El indicador inferior se desvanece al hacer scroll.
   La escena 3D del hero también: al bajar deja paso al logo real
   de fondo, que hace fade-in hasta su opacidad de sello de agua. */
window.addEventListener('scroll', () => {
  const hint = document.getElementById('heroHint');

  /* Si esto es lo que dispara la primera revelación (alguien que hace
     scroll con el trackpad sin haber movido antes el ratón), dejamos
     que sea la animación de revealScene() la que controle la opacidad
     esta vez — si la pisáramos aquí también, se pelearían las dos y
     el fade-in daría un salto en vez de verse suave. */
  const justRevealed = desktopIntro && !revealed;
  if (desktopIntro) revealScene();

  if (!justRevealed) {
    hint.style.opacity = Math.max(0, 1 - window.scrollY / 200);

    sceneOpacity = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.7));
    canvas.style.opacity = sceneOpacity;
  }

  /* Logo de fondo: opacidad 0 arriba del todo. Arranca su fade-in más
     tarde (tras ~60% de viewport) para NO solaparse con la animación
     de entrada del "JaG" del hero; luego sube gradualmente a maxOpacity */
  const progress = Math.min(1, Math.max(0,
    (window.scrollY - window.innerHeight * 1.1) / (window.innerHeight * 0.6)
  ));
  bgLogoOpacityTarget = CONFIG.bgLogo.maxOpacity * progress;
}, { passive: true });

/* Menú móvil (hamburguesa) */
const navToggle = document.getElementById('navToggle');
const mainNav = document.querySelector('.main-nav');

navToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(open));
});

/* Cierra el menú al pulsar cualquier enlace */
mainNav.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    mainNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  })
);

/* Scroll suave a las secciones SIN dejar el #ancla en la URL
   (así, al recargar, la página siempre arranca desde el principio) */
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  const id = link.getAttribute('href');
  if (id.length < 2) return;               // Ignora href="#" (modales)
  link.addEventListener('click', (e) => {
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();                     // Evita que el hash se escriba en la URL
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

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

/* ================================================================
   10. LUPA DE CÓDIGO — reveal mask (sección bajo el Hero). En
       escritorio sigue al ratón con un ligero lag orgánico (rAF +
       interpolación). En móvil, el gesto solo empieza si se pulsa el
       aviso "Pulsa aquí y desliza"; mientras se arrastra, la página
       se bloquea (overflow: hidden) para que el scroll nunca compita
       con el arrastre de revelar.
   ================================================================ */
(function initRevealLab() {
  const lab = document.getElementById('revealLab');
  if (!lab) return;

  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // px — tamaño de la lupa. En escritorio algo más grande (más cómodo con
  // el ratón); en móvil se mantiene pequeña a propósito para que haya que
  // explorar la sección poco a poco.
  const maxRadius = hasFinePointer ? 190 : 130;

  /* x/y en %, r en px. Los valores "t*" son el objetivo; el bucle
     rAF los persigue con lerp para el efecto de lag/suavizado. */
  const state = { x: 50, y: 50, r: 0, tx: 50, ty: 50, tr: 0 };
  let rafId = null;
  let inView = false;

  /* En móvil, cuando el rastro pintado en el <canvas> termina de
     taparse (ver .is-closing / resetCanvas más abajo), hay que
     limpiarlo justo en el frame en que el radio cae a 0 — ni antes
     (se vería el rastro "saltar" a tapado de golpe) ni después (se
     vería un parpadeo del rastro ya sin dedo encima). canvasNeedsReset
     lo arma scheduleClose(); resetCanvasFn solo existe en móvil. */
  let canvasNeedsReset = false;
  let resetCanvasFn = null;

  function applyVars() {
    lab.style.setProperty('--reveal-x', `${state.x}%`);
    lab.style.setProperty('--reveal-y', `${state.y}%`);
    lab.style.setProperty('--reveal-r', `${Math.max(0, state.r)}px`);
    /* Solo aplicamos la máscara (el "agujero") cuando hay radio real.
       En reposo la capa cubre todo → la sección arranca y vuelve a negro. */
    const revealing = state.r > 0.5;
    lab.classList.toggle('is-revealing', revealing);

    if (!revealing && canvasNeedsReset) {
      canvasNeedsReset = false;
      lab.classList.remove('is-closing', 'is-lit');
      if (resetCanvasFn) resetCanvasFn();
    }
  }

  function tick() {
    state.x += (state.tx - state.x) * 0.14;
    state.y += (state.ty - state.y) * 0.14;
    state.r += (state.tr - state.r) * 0.12;
    applyVars();

    const settled =
      Math.abs(state.tx - state.x) < 0.05 &&
      Math.abs(state.ty - state.y) < 0.05 &&
      Math.abs(state.tr - state.r) < 0.5;

    rafId = (!settled && inView) ? requestAnimationFrame(tick) : null;
  }

  function wake() {
    if (!rafId && inView) rafId = requestAnimationFrame(tick);
  }

  function setTarget(xPercent, yPercent, radius) {
    state.tx = xPercent;
    state.ty = yPercent;
    state.tr = radius;
    wake();
  }

  /* Solo animamos mientras la sección está en pantalla (ahorro de CPU/GPU) */
  new IntersectionObserver(
    (entries) => { inView = entries[0].isIntersecting; if (inView) wake(); },
    { threshold: 0 }
  ).observe(lab);

  /* Con movimiento reducido, la lupa se queda cerrada (--reveal-r
     arranca en 0 desde el CSS): la sección se ve limpia y estática. */
  if (prefersReducedMotion) return;

  if (hasFinePointer) {
    /* ---------- Escritorio: la lupa sigue al ratón, con lag ---------- */
    lab.addEventListener('pointermove', (e) => {
      const rect = lab.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setTarget(x, y, maxRadius);
    });
    lab.addEventListener('pointerleave', () => setTarget(state.tx, state.ty, 0));
  } else {
    /* ---------- Móvil: pulsa el aviso de la linterna ----------
       El gesto solo se "arma" si el toque empieza sobre el icono
       (.reveal-lab-hint); así el resto de la sección queda libre
       para el scroll normal y el descubrimiento es siempre
       intencional. En cuanto se arma, se bloquea el scroll de toda
       la página (ver lockPageScroll) para que el arrastre —en
       cualquier dirección— nunca se confunda con el gesto de hacer
       scroll; mientras se arrastra, el título/texto desaparecen y
       aparece el icono de linterna siguiendo al dedo (.reveal-lab-torch
       + .is-dragging en styles.css). Al soltar el dedo, lo revelado se
       queda iluminado (no se cierra al momento): la propia pista
       (.reveal-lab-hint) reaparece para poder volver a tocarla, pero
       el título/texto no vuelven hasta que pasan 30s sin tocar y el
       rastro se tapa del todo otra vez (ver scheduleClose). Tocar de
       nuevo antes de esos 30s cancela el apagado y retoma el rastro. */
    const hint = lab.querySelector('.reveal-lab-hint');
    const content = lab.querySelector('.reveal-lab-content');
    const canvas = lab.querySelector('.reveal-lab-canvas');
    const ctx = canvas && canvas.getContext('2d');

    /* La pista vive fuera de .reveal-lab-content (ver styles.css), así
       que no hereda su posición en el flujo de texto — hay que calcular
       a mano en qué "top" (px) cae justo debajo del título/texto. Como
       ese bloque cambia de tamaño según la pantalla (clamp() en las
       fuentes), un porcentaje fijo en CSS a veces se quedaba corto y
       la pista tapaba la última línea del texto.
       Se guarda en la variable --hint-rest-top (no en hint.style.top
       directamente) para que, con el código destapado, la regla CSS
       .is-lit pueda subirla a su propio sitio fijo sin pelearse con
       un estilo puesto inline — un selector con clase nunca gana a un
       inline style, pero si aquí solo hay una custom property, sí. */
    function positionHint() {
      if (!hint || !content) return;
      const labRect = lab.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const gap = 24; // separación bajo el texto, en px
      lab.style.setProperty('--hint-rest-top', `${contentRect.bottom - labRect.top + gap}px`);
    }

    /* Con el código destapado, la pista sube a la línea en blanco justo
       encima del comentario "es el pegamento de la web" (#pegamentoLine
       en index.html) — ahí no hay texto nunca, se elija la columna que
       se elija, así que no tapa nada ni tapado ni destapado. El código
       fluye en columnas (ver .reveal-lab-code pre { columns: … }), así
       que su posición real cambia según el ancho de pantalla y hay que
       recalcularla, no vale un valor fijo. */
    function positionHintLit() {
      if (!hint) return;
      const pegamento = document.getElementById('pegamentoLine');
      if (!pegamento) return;
      const labRect = lab.getBoundingClientRect();
      const pegamentoRect = pegamento.getBoundingClientRect();
      const hintHeight = hint.offsetHeight || 42;
      const gap = 10; // separación sobre la línea en blanco, en px
      const top = pegamentoRect.top - labRect.top - hintHeight - gap;
      lab.style.setProperty('--hint-lit-top', `${top}px`);
    }

    positionHint();
    positionHintLit();
    window.addEventListener('resize', positionHint);
    window.addEventListener('resize', positionHintLit);

    // ms — debe coincidir con la transición de opacidad de
    // .reveal-lab-recover en styles.css (el fundido que vuelve a tapar
    // el rastro una vez pasan los 30s).
    const RECOVER_MS = 600;
    const soft = 65; // igual que --reveal-soft, para el borde difuminado del rastro

    let bgColor = '#0b0b10';
    function readBgColor() {
      const val = getComputedStyle(lab).getPropertyValue('--bg').trim();
      if (val) bgColor = val;
    }

    function fillOpaque() {
      if (!ctx) return;
      const rect = lab.getBoundingClientRect();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    // Tamaño (en CSS px) con el que se dimensionó el canvas la última
    // vez, para poder ignorar los "resize" que no cambian nada real.
    let lastCanvasCssW = -1;
    let lastCanvasCssH = -1;

    function sizeCanvas() {
      if (!canvas) return;
      const rect = lab.getBoundingClientRect();

      /* En móvil, mostrar/ocultar la barra de direcciones al hacer
         scroll dispara un "resize" del window aunque la sección (su
         altura usa svh, estable) no cambie de tamaño real. Si no se
         filtra, cada scroll redimensionaba el canvas — lo que borra
         todo su contenido — y lo volvía a rellenar opaco, tapando de
         golpe el código ya iluminado. Solo redimensionamos si el
         tamaño de verdad cambió (p.ej. al girar el móvil). */
      if (Math.abs(rect.width - lastCanvasCssW) < 2 && Math.abs(rect.height - lastCanvasCssH) < 2) {
        return;
      }
      lastCanvasCssW = rect.width;
      lastCanvasCssH = rect.height;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readBgColor();
      fillOpaque();
    }

    function resetCanvas() {
      readBgColor();
      fillOpaque();
      lastPunch = null;
    }
    resetCanvasFn = resetCanvas;

    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);

    /* El "agujero" que revela el código, en móvil, lo pinta este
       canvas a base de círculos (destination-out): cada toque queda
       marcado ahí para siempre (hasta el reset), así que arrastrar el
       dedo va "pintando" un rastro acumulado en vez de mover un único
       agujero que se cierra detrás. */
    function punchHole(xPercent, yPercent) {
      if (!ctx) return;
      const rect = lab.getBoundingClientRect();
      const px = (xPercent / 100) * rect.width;
      const py = (yPercent / 100) * rect.height;
      const r = maxRadius;
      ctx.globalCompositeOperation = 'destination-out';
      const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
      const innerStop = Math.max(0, (r - soft) / r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(innerStop, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Último punto pintado (en %), para rellenar el trazo entre dos
    // touchmove seguidos con pasos intermedios y que no queden huecos
    // en arrastres rápidos. Se reinicia al soltar el dedo, para no
    // dibujar una línea "fantasma" entre dos toques sueltos.
    let lastPunch = null;

    function punchAlong(xPercent, yPercent) {
      if (lastPunch) {
        const dx = xPercent - lastPunch.x;
        const dy = yPercent - lastPunch.y;
        const rect = lab.getBoundingClientRect();
        const distPx = Math.hypot((dx / 100) * rect.width, (dy / 100) * rect.height);
        const stepPx = Math.max(8, maxRadius * 0.25);
        const steps = Math.max(1, Math.ceil(distPx / stepPx));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          punchHole(lastPunch.x + dx * t, lastPunch.y + dy * t);
        }
      } else {
        punchHole(xPercent, yPercent);
      }
      lastPunch = { x: xPercent, y: yPercent };
    }

    let armed = false;
    let closeTimer = null;

    function cancelScheduledClose() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      canvasNeedsReset = false;
      lab.classList.remove('is-closing');
    }

    function scheduleClose() {
      cancelScheduledClose();
      closeTimer = setTimeout(() => {
        closeTimer = null;
        // Arranca el fundido de la cortina opaca (.is-closing) y, a la
        // vez, encoge el agujero/brillo de escritorio-en-móvil; el
        // canvas en sí se limpia en applyVars() justo cuando el radio
        // llega a 0 (canvasNeedsReset), no antes.
        lab.classList.add('is-closing');
        canvasNeedsReset = true;
        setTarget(state.tx, state.ty, 0);
        setTimeout(() => {
          if (canvasNeedsReset) {
            canvasNeedsReset = false;
            lab.classList.remove('is-closing', 'is-lit');
            resetCanvas();
          }
        }, RECOVER_MS);
      }, 30000);
    }

    /* Antes esto fijaba el <body> con position: fixed (guardando el
       scroll y restaurándolo al soltar), pero ese cambio de layout
       provocaba un pequeño tirón visible justo al pulsar. Basta con
       "overflow: hidden" en <html> — la página no se mueve ni un
       píxel al bloquear/desbloquear— y el touchmove de abajo, con
       preventDefault, ya impide cualquier scroll mientras se arrastra. */
    function lockPageScroll() {
      document.documentElement.style.overflow = 'hidden';
    }

    function unlockPageScroll() {
      document.documentElement.style.overflow = '';
    }

    function revealAt(clientX, clientY) {
      const rect = lab.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      setTarget(x, y, maxRadius);
      punchAlong(x, y);
    }

    lab.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      armed = !!(hint && t.target.closest('.reveal-lab-hint'));
      if (!armed) return;
      cancelScheduledClose();
      lab.classList.add('is-dragging', 'is-lit');
      lockPageScroll();
      revealAt(t.clientX, t.clientY);
    }, { passive: true });

    /* passive: false — necesitamos poder cancelar el gesto (además
       del "overflow: hidden" de lockPageScroll) para que ni siquiera
       el rebote/inercia nativo del navegador se cuele durante el
       arrastre. */
    lab.addEventListener('touchmove', (e) => {
      if (!armed) return;
      e.preventDefault();
      const t = e.touches[0];
      revealAt(t.clientX, t.clientY);
    }, { passive: false });

    const closeReveal = () => {
      if (!armed) return;
      armed = false;
      lastPunch = null;
      lab.classList.remove('is-dragging');
      unlockPageScroll();
      scheduleClose();
    };
    lab.addEventListener('touchend', closeReveal);
    lab.addEventListener('touchcancel', closeReveal);
  }
})();

/* ================================================================
   11. MICROINTERACCIÓN — foco dorado que sigue al cursor en las
       tarjetas de cristal (variables CSS --mx / --my). Las tarjetas de
       precio tienen el mismo efecto, pero viven en precios.html, que
       no carga este script — ver el <script> propio de esa página. */
document.querySelectorAll('.glass-card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    card.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
});

/* ================================================================
   12. MODAL "CONTÁCTANOS" (id "budgetModal", sin tocar) + FORMULARIO
   ================================================================ */
const modal        = document.getElementById('budgetModal');
const modalPanel   = modal.querySelector('.modal-panel');
const backdrop     = modal.querySelector('.modal-backdrop');
const formView     = document.getElementById('modalFormView');
const successView  = document.getElementById('modalSuccessView');
const budgetForm   = document.getElementById('budgetForm');
const submitButton = document.getElementById('formSubmit');

/* ---------- Abrir modal con animación GSAP ---------- */
function openModal() {
  modal.hidden = false;
  document.body.style.overflow = 'hidden';   // Bloquea el scroll de fondo

  /* Si venimos de "SOLICITAR ESTE PLAN" en precios.html, esa página deja
     aquí un resumen del plan + extras elegidos antes de navegar — lo
     precargamos en "Detalles del proyecto" y lo consumimos una sola vez,
     el resto de campos (nombre, correo…) los sigue rellenando el usuario. */
  const pendingPlan = sessionStorage.getItem('jagPlanRequest');
  if (pendingPlan) {
    const detailsField = document.getElementById('fDetails');
    if (detailsField) detailsField.value = pendingPlan;
    sessionStorage.removeItem('jagPlanRequest');
  }

  gsap.timeline()
    .fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' })
    .fromTo(
      modalPanel,
      { opacity: 0, y: 46, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' },
      '-=0.15'
    );
}

/* ---------- Cerrar modal (y resetear a la vista de formulario) ---------- */
function closeModal() {
  gsap.timeline({
    onComplete: () => {
      modal.hidden = true;
      document.body.style.overflow = '';
      /* Reset para la próxima apertura */
      successView.hidden = true;
      formView.hidden = false;
      gsap.set(formView, { clearProps: 'all' });   // Limpia opacity/y del envío anterior
      budgetForm.reset();
      budgetForm.querySelectorAll('.has-error')
        .forEach((f) => f.classList.remove('has-error'));
    },
  })
    .to(modalPanel, { opacity: 0, y: 30, scale: 0.97, duration: 0.3, ease: 'power2.in' })
    .to(backdrop, { opacity: 0, duration: 0.25 }, '-=0.1');
}

/* Botones que abren el modal (nav + sección Nosotros) */
document.querySelectorAll('.js-open-modal').forEach((btn) =>
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  })
);

/* Elementos que cierran el modal (X, fondo, botón CERRAR) */
modal.querySelectorAll('[data-close-modal]').forEach((el) =>
  el.addEventListener('click', closeModal)
);

/* ---------- Modales legales (Privacidad, Aviso legal, Cookies, Términos) ----------
   Los cuatro comparten la misma animación y comportamiento, así que se
   generan con una única fábrica en vez de repetir el código cuatro veces. */
function createLegalModal(modalEl, closeAttr) {
  const panel    = modalEl.querySelector('.modal-panel');
  const backdrop = modalEl.querySelector('.modal-backdrop');

  function open() {
    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';

    gsap.timeline()
      .fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      .fromTo(
        panel,
        { opacity: 0, y: 40, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' },
        '-=0.12'
      );
  }

  function close() {
    gsap.timeline({
      onComplete: () => {
        modalEl.hidden = true;
        /* Solo desbloquea el scroll si el modal de presupuesto
           tampoco está abierto (estos modales pueden abrirse encima) */
        if (modal.hidden) document.body.style.overflow = '';
      },
    })
      .to(panel, { opacity: 0, y: 26, scale: 0.98, duration: 0.25, ease: 'power2.in' })
      .to(backdrop, { opacity: 0, duration: 0.2 }, '-=0.08');
  }

  modalEl.querySelectorAll(`[${closeAttr}]`).forEach((el) => el.addEventListener('click', close));

  return { modalEl, open, close };
}

const privacyModal = document.getElementById('privacyModal');
const legalModal    = document.getElementById('legalModal');
const cookiesModal  = document.getElementById('cookiesModal');
const termsModal    = document.getElementById('termsModal');

const privacy = createLegalModal(privacyModal, 'data-close-privacy');
const legal   = createLegalModal(legalModal, 'data-close-legal');
const cookies = createLegalModal(cookiesModal, 'data-close-cookies');
const terms   = createLegalModal(termsModal, 'data-close-terms');

/* Enlaces que abren cada modal legal (formulario, pie de página, entre modales…) */
document.querySelectorAll('.js-open-privacy').forEach((link) =>
  link.addEventListener('click', (e) => { e.preventDefault(); privacy.open(); })
);
document.querySelectorAll('.js-open-legal').forEach((link) =>
  link.addEventListener('click', (e) => { e.preventDefault(); legal.open(); })
);
document.querySelectorAll('.js-open-cookies').forEach((link) =>
  link.addEventListener('click', (e) => { e.preventDefault(); cookies.open(); })
);
document.querySelectorAll('.js-open-terms').forEach((link) =>
  link.addEventListener('click', (e) => { e.preventDefault(); terms.open(); })
);

/* Tecla Escape: cierra primero el modal superior (privacidad, aviso
   legal, cookies, términos, y por último el de contacto) */
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!privacyModal.hidden) privacy.close();
  else if (!legalModal.hidden) legal.close();
  else if (!cookiesModal.hidden) cookies.close();
  else if (!termsModal.hidden) terms.close();
  else if (!modal.hidden) closeModal();
});

/* ================================================================
   12b. APERTURA AUTOMÁTICA DE MODALES DESDE OTRA PÁGINA
   Las subpáginas de servicios/ enlazan de vuelta con anclas como
   index.html#presupuesto o index.html#privacidad para abrir el modal
   correspondiente nada más cargar (en vez de duplicar los modales en
   cada subpágina). "initialHash" se capturó al principio del archivo,
   antes de que se limpiara la URL. */
const HASH_MODAL_OPENERS = {
  '#presupuesto': openModal,
  '#privacidad': privacy.open,
  '#aviso-legal': legal.open,
  '#cookies': cookies.open,
  '#terminos': terms.open,
};
if (HASH_MODAL_OPENERS[initialHash]) HASH_MODAL_OPENERS[initialHash]();

/* ================================================================
   13. VALIDACIÓN + ENVÍO DEL FORMULARIO
   ================================================================ */

/* Valida un campo individual; devuelve true si es correcto */
function validateField(input) {
  const field = input.closest('.form-field');
  let ok;

  if (input.type === 'checkbox') {
    /* La política de privacidad DEBE estar marcada para poder enviar */
    ok = input.checked;
  } else {
    ok = input.value.trim() !== '';
    /* Comprobación extra de formato para el correo */
    if (ok && input.type === 'email') {
      ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
    }
  }

  field.classList.toggle('has-error', !ok);
  return ok;
}

/* Quita el error en cuanto el usuario corrige el campo */
budgetForm.querySelectorAll('input, select, textarea').forEach((input) => {
  input.addEventListener('input', () => validateField(input));
});

/* ----------------------------------------------------------------
   🔌 CONEXIÓN CON GOOGLE SHEETS (Apps Script) — EDITA AQUÍ
   ----------------------------------------------------------------
   Guía completa paso a paso en el archivo AUTOMATIZACION.md.
   Resumen: crea el Apps Script en tu hoja de cálculo, impleméntalo
   como "Aplicación web" y pega aquí la URL que te genera
   (termina en /exec).

   Mientras URL_GOOGLE_SHEETS esté vacía, la función funciona en
   "modo demo": simula el envío para poder probar la animación.
   ---------------------------------------------------------------- */
const URL_GOOGLE_SHEETS = 'https://script.google.com/macros/s/AKfycbz2yXaS2pgrYvq13M_qY4s67mSykzuW9Eihooi9csppKxDOtJlgiAVrlLByoJ1y2iOIQA/exec';   // ← PEGA AQUÍ LA URL DEL APPS SCRIPT (/exec)

async function enviarDatosAGoogleSheets(data) {
  /* Añadimos metadatos útiles para la hoja de cálculo */
  const payload = {
    ...data,
    privacidad: 'Aceptada',              // Consentimiento registrado
    origen: 'landing-jag',
    fecha: new Date().toISOString(),
  };

  console.log('[JaG] Datos listos para enviar a Google Sheets:', payload);

  if (!URL_GOOGLE_SHEETS) {
    /* MODO DEMO: simula 0,9 s de red. Se ignora al configurar la URL. */
    return new Promise((resolve) => setTimeout(resolve, 900));
  }

  /* Notas técnicas importantes (no cambiar sin motivo):
     - mode "no-cors": Apps Script no devuelve cabeceras CORS, así que
       el navegador solo permite un envío "opaco". Los datos LLEGAN
       igualmente; simplemente no podemos leer la respuesta.
     - Content-Type "text/plain": evita la petición previa de
       verificación (preflight) que Apps Script no soporta. El script
       del lado de Google parsea el JSON desde e.postData.contents. */
  await fetch(URL_GOOGLE_SHEETS, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
}

/* ---------- Envío del formulario ---------- */
budgetForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  /* Valida todos los campos; si alguno falla, no se envía */
  const inputs = [...budgetForm.querySelectorAll('input, select, textarea')];
  const allValid = inputs.map(validateField).every(Boolean);
  if (!allValid) {
    /* Sacudida sutil del panel para indicar el error */
    gsap.fromTo(modalPanel, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.35)' });
    return;
  }

  /* Estado "enviando…" */
  submitButton.disabled = true;
  submitButton.textContent = 'ENVIANDO…';

  try {
    const data = Object.fromEntries(new FormData(budgetForm));
    await enviarDatosAGoogleSheets(data);

    /* ---- Animación de éxito: formulario → check dorado ---- */
    gsap.timeline()
      .to(formView, {
        opacity: 0, y: -20, duration: 0.35, ease: 'power2.in',
        onComplete: () => {
          formView.hidden = true;
          successView.hidden = false;
        },
      })
      .fromTo(successView, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
      /* Dibujo progresivo del círculo y del check (stroke-dash) */
      .fromTo('.check-circle', { strokeDasharray: 277, strokeDashoffset: 277 },
        { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, '-=0.3')
      .fromTo('.check-mark', { strokeDasharray: 62, strokeDashoffset: 62 },
        { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, '-=0.35');
  } catch (err) {
    console.error('[JaG] Error al enviar el formulario:', err);
    submitButton.textContent = 'ERROR — INTÉNTALO DE NUEVO';
  } finally {
    submitButton.disabled = false;
    /* Restaura el texto del botón para futuros usos */
    setTimeout(() => { submitButton.textContent = 'ENVIAR SOLICITUD'; }, 2500);
  }
});
