/* ================================================================
   JaG — UI de index.html (menú, modales, formulario) + carga de la
   escena 3D del hero
   ----------------------------------------------------------------
   Este archivo se ejecuta en TODAS las pantallas, móvil incluido —
   por eso no importa Three.js ni GSAP directamente. Solo carga
   hero-scene.js (Three.js + GSAP + ScrollTrigger) en escritorio,
   después del primer pintado, mediante el bootstrap de más abajo.
   ================================================================ */

/* ================================================================
   8. ARRANQUE — reset de scroll, carga de la escena 3D y menú móvil
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

/* Usado por la lupa de código (sección 10, más abajo) para desactivar
   su animación. hero-scene.js calcula la suya por separado — no hay
   variable compartida entre archivos, es un matchMedia barato. */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Escena 3D del hero: solo en escritorio, tras el primer
   pintado ----------
   En móvil (≤820px) el hero es CSS puro (ver .hero-mesh/.hero-aurora)
   y no se carga ni Three.js ni GSAP/ScrollTrigger — gsap.min.js SÍ se
   carga en toda pantalla porque este archivo lo necesita para los
   modales y el formulario, pero es una librería ligera y solo se
   ejecuta cuando el usuario interactúa, así que no pesa en el arranque
   como sí lo hacía la escena 3D completa. */
function loadHeroScene() {
  const scriptTrigger = document.createElement('script');
  scriptTrigger.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js';
  scriptTrigger.onload = () => import('./hero-scene.min.js');
  document.head.appendChild(scriptTrigger);
}
if (window.matchMedia('(min-width: 821px)').matches) {
  if ('requestIdleCallback' in window) requestIdleCallback(loadHeroScene, { timeout: 2000 });
  else window.addEventListener('load', () => setTimeout(loadHeroScene, 200));
}
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
       el título/texto no vuelven hasta que pasan 10s sin tocar y el
       rastro se tapa progresivamente otra vez (ver scheduleClose).
       Tocar de nuevo antes de esos 10s cancela el apagado y retoma
       el rastro. */
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
    // el rastro una vez pasan los 10s).
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
      }, 10000);
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
