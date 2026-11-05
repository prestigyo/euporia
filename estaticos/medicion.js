/* =====================================================================
   Euporia · medición con consentimiento

   Nada de esto se carga ni se envía hasta que la persona pulsa «Aceptar».
   Si rechaza, no hay cookies ni datos a terceros. Cloudflare Web Analytics
   (sin cookies, activado en el panel de Cloudflare) cuenta el tráfico total.

   Qué se mide tras aceptar (GA4 mide además visitas, rebote y tiempo):
     scroll_profundidad       25, 50, 75, 90 y 100 % de cada página
     tiempo_activo            15, 30, 60, 120 y 300 s con la pestaña en uso
     clic_contacto            WhatsApp, teléfono o correo
     clic_cta                 botones principales
     formulario_inicio        primer campo tocado de un formulario
     generate_lead            formulario guardado de verdad
     herramienta_inicio       primer dato en una calculadora
     herramienta_completada   resultado calculado (diagnóstico)
     carta_descargada         carta al banco (sin decir cuál)

   Cada evento lleva además content_group (la parte de la web), para separar los informes.

   Nunca se envía lo que alguien escribe: ni nombres, ni cifras, ni resultados.
   Publicidad personalizada desactivada: la web trata situaciones económicas
   difíciles y no se usa para remarketing.
   ===================================================================== */
(() => {
  "use strict";
  const C = window.EUPORIA || {};
  if (!C.ga4 && !C.clarity) return;

  const CLAVE = "euporia_consentimiento";
  const VIGENCIA = 365 * 24 * 60 * 60 * 1000; // se vuelve a preguntar al cabo de un año

  function leer() {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE));
      if (v && Date.now() - v.fecha < VIGENCIA) return v.decision;
    } catch { /* almacenamiento bloqueado: se pregunta de nuevo */ }
    return null;
  }
  function guardar(decision) {
    try { localStorage.setItem(CLAVE, JSON.stringify({ decision, fecha: Date.now() })); } catch { /* sin almacenamiento */ }
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  let activa = false;

  // API para el resto de scripts. Sin consentimiento, no hace nada.
  window.EuporiaMedir = (nombre, parametros) => {
    if (activa && C.ga4) gtag("event", nombre, parametros || {});
  };
  const medir = window.EuporiaMedir;

  function cargar(src) {
    const s = document.createElement("script");
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  // Las calculadoras se pueden abrir con datos en la dirección (?edad=, ?valor=, ?ref=…). Google lee la
  // dirección por su cuenta aunque se le indique otra, así que se quita de la barra antes de cargar nada.
  // Se espera al evento «load»: para entonces los scripts de la página ya han leído esos datos.
  function limpiarDireccion() {
    if (location.search) history.replaceState(history.state, "", location.pathname + location.hash);
  }

  function activar() {
    if (activa) return;
    activa = true;
    if (document.readyState !== "complete") { window.addEventListener("load", cargarMedicion, { once: true }); return; }
    cargarMedicion();
  }

  function cargarMedicion() {
    limpiarDireccion();
    if (C.ga4) {
      gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      gtag("js", new Date());
      // Sin parámetros en la dirección: las calculadoras admiten ?edad=, ?valor= o ?ref= y eso no debe llegar a Google
      const sinParametros = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return ""; } };
      // content_group: la parte de la web (Familias, Compradores, Vendedores, Documentos, General), para ver los informes por partes
      const pagina = { page_location: sinParametros(location.href), page_referrer: sinParametros(document.referrer),
        content_group: C.seccion || "General" };
      gtag("set", pagina);   // vale para todos los eventos, también los automáticos de Google
      // La vista de página la manda Google solo, ya con la dirección limpia (ver limpiarDireccion)
      gtag("config", C.ga4, Object.assign({ allow_google_signals: false, allow_ad_personalization_signals: false }, pagina));
      cargar("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(C.ga4));
    }
    // Clarity (mapas de calor y scroll): nunca en páginas con calculadora
    if (C.clarity && !C.herramienta) {
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      cargar("https://www.clarity.ms/tag/" + encodeURIComponent(C.clarity));
      window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    }
    iniciarEventos();
  }

  /* ---------- Eventos ---------- */
  function iniciarEventos() {
    // Profundidad de scroll
    const MARCAS = [25, 50, 75, 90, 100];
    const vistas = new Set();
    let pendiente = false;
    function revisarScroll() {
      pendiente = false;
      const alto = document.documentElement.scrollHeight;
      if (alto <= 0) return;
      const pct = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / alto) * 100));
      MARCAS.forEach((m) => {
        if (pct >= m && !vistas.has(m)) { vistas.add(m); medir("scroll_profundidad", { porcentaje: m }); }
      });
    }
    window.addEventListener("scroll", () => {
      if (!pendiente) { pendiente = true; requestAnimationFrame(revisarScroll); }
    }, { passive: true });

    // Tiempo con la pestaña visible y actividad reciente
    const TIEMPOS = [15, 30, 60, 120, 300];
    let segundos = 0, ultimaActividad = Date.now();
    ["pointerdown", "keydown", "scroll", "pointermove"].forEach((ev) =>
      window.addEventListener(ev, () => { ultimaActividad = Date.now(); }, { passive: true }));
    const reloj = setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - ultimaActividad > 30000) return;
      segundos += 1;
      if (TIEMPOS.includes(segundos)) medir("tiempo_activo", { segundos });
      if (segundos > TIEMPOS[TIEMPOS.length - 1]) clearInterval(reloj);
    }, 1000);

    // Clics de contacto y botones principales
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a, button");
      if (!a || a.closest(".aviso-cookies")) return;
      const href = a.getAttribute("href") || "";
      const canal = href.includes("wa.me") ? "whatsapp" : href.startsWith("tel:") ? "telefono" : href.startsWith("mailto:") ? "correo" : "";
      if (canal) medir("clic_contacto", { canal });
      else if (a.classList.contains("btn") && !a.closest("form")) medir("clic_cta", { texto: (a.textContent || "").trim().slice(0, 60) });
    });

    // Inicio de formulario y de herramienta (sin leer lo que se escribe)
    const empezados = new Set();
    document.addEventListener("focusin", (e) => {
      const f = e.target.closest && e.target.closest("form[data-form]");
      if (!f || !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const nombre = f.dataset.form;
      if (!empezados.has(nombre)) { empezados.add(nombre); medir("formulario_inicio", { formulario: nombre }); }
    });
    if (C.herramienta) {
      let usada = false;
      const marcar = (e) => {
        if (usada || !e.target.closest || !e.target.closest("main form") || e.target.closest("form[data-form]")) return;
        usada = true;
        medir("herramienta_inicio", { herramienta: C.herramienta });
      };
      document.addEventListener("input", marcar);
      document.addEventListener("change", marcar);
    }
    revisarScroll();
  }

  /* ---------- Retirar el consentimiento ---------- */
  function borrarCookies() {
    document.cookie.split(";").forEach((c) => {
      const n = c.split("=")[0].trim();
      if (/^(_ga|_gid|_gat|_cl|CLID|MUID)/.test(n)) {
        const partes = location.hostname.split(".");
        ["", location.hostname, "." + location.hostname, "." + partes.slice(-2).join(".")].forEach((d) => {
          document.cookie = `${n}=; Max-Age=0; path=/${d ? "; domain=" + d : ""}`;
        });
      }
    });
  }

  /* ---------- Aviso ---------- */
  let aviso = null;
  function cerrarAviso() { if (aviso) { aviso.remove(); aviso = null; } }

  function decidir(decision) {
    const anterior = leer();
    guardar(decision);
    cerrarAviso();
    if (decision === "aceptar") activar();
    else if (anterior === "aceptar") { borrarCookies(); location.reload(); }
  }

  function mostrarAviso() {
    if (aviso) return;
    aviso = document.createElement("section");
    aviso.className = "aviso-cookies";
    aviso.setAttribute("aria-label", "Aviso de cookies");
    const base = document.querySelector('footer a[href$="/aviso-legal/"]');
    const href = (base ? base.getAttribute("href") : "/aviso-legal/") + "#cookies";
    aviso.innerHTML =
      '<p>Usamos cookies de medición para saber qué páginas ayudan y mejorarlas. Solo si aceptas. ' +
      'Nunca recogen lo que escribes en formularios o calculadoras. <a class="link" href="' + href + '">Más información</a></p>' +
      '<div class="aviso-cookies-botones">' +
      '<button class="btn" type="button" data-decision="aceptar">Aceptar</button>' +
      '<button class="btn" type="button" data-decision="rechazar">Rechazar</button></div>';
    aviso.addEventListener("click", (e) => {
      const b = e.target.closest("[data-decision]");
      if (b) decidir(b.dataset.decision);
    });
    document.body.appendChild(aviso);
  }

  /* ---------- Arranque ---------- */
  function arrancar() {
    document.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest("[data-cookies]")) { e.preventDefault(); mostrarAviso(); }
    });
    const decision = leer();
    if (decision === "aceptar") activar();
    else if (!decision) mostrarAviso();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
