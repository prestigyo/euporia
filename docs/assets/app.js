/* =====================================================================
   Euporia · comportamiento común a todas las páginas
   La configuración (endpoint, fichas, términos vetados…) llega desde
   build.py en window.EUPORIA. No edites aquí esos valores: cámbialos en
   build.py y vuelve a generar el sitio.
   ===================================================================== */
(() => {
  const C = window.EUPORIA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
  const eur = (n) => num.format(n) + " €";
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-");

  function el(tag, attrs = {}, ...hijos) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    hijos.flat().forEach((h) => h != null && n.append(h));
    return n;
  }

  /* ---------- Menú móvil ---------- */
  const menu = $("#menu"), menuBtn = $(".menu-btn");
  if (menu && menuBtn) {
    menuBtn.addEventListener("click", () => {
      const abierto = menu.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", abierto);
    });
  }

  /* ---------- Formulario de familias: situación elegida ---------- */
  const selSituacion = $("#sel-situacion");
  if (selSituacion) {
    const pedida = new URLSearchParams(location.search).get("situacion");
    if (pedida && [...selSituacion.options].some((o) => o.value === pedida)) selSituacion.value = pedida;
    $$("[data-situacion]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      selSituacion.value = a.dataset.situacion;
      $("#contacto").scrollIntoView();
      selSituacion.focus({ preventScroll: true });
    }));
  }

  /* ---------- Off-market: fichas ciegas ---------- */
  const FICHAS_EJEMPLO = [
    { ref: "EU-001", tipo: "Vivienda", titulo: "Piso de 3 dormitorios con terraza", zona: "L'Horta Nord",
      entorno: "Municipio con metro a València", superficie: 105, dormitorios: 3, banos: 2,
      precioDesde: 235000, precioHasta: 255000, estado: "Disponible",
      certificado: "E", nda: false, destacados: ["Terraza de 18 m²", "Plaza de garaje", "Para entrar a vivir"], ejemplo: true },
    { ref: "EU-002", tipo: "Vivienda", titulo: "Ático con terraza perimetral", zona: "València ciudad",
      entorno: "Zona este, junto a un gran parque", superficie: 140, dormitorios: 4, banos: 2,
      precioDesde: 560000, precioHasta: 610000, estado: "Disponible",
      certificado: "D", nda: false, destacados: ["Terraza de 60 m²", "Orientación sur", "Dos plazas de garaje"], ejemplo: true },
    { ref: "EU-003", tipo: "Local", titulo: "Local comercial alquilado", zona: "València ciudad",
      entorno: "Calle comercial de barrio", superficie: 180,
      precioDesde: 380000, precioHasta: 410000, rentabilidad: "6,1 % bruta con el alquiler actual", estado: "Disponible",
      certificado: "F", nda: true, cualificacion: "dossier", destacados: ["Inquilino con contrato en vigor", "Fachada a dos calles"], ejemplo: true },
    { ref: "EU-004", tipo: "Suelo", titulo: "Parcela urbana residencial", zona: "Camp de Túria",
      entorno: "Zona de chalets consolidada", parcela: 2400,
      precioDesde: 420000, precioHasta: 460000, estado: "En negociación",
      nda: true, destacados: ["Servicios a pie de parcela", "Proyecto básico disponible"], ejemplo: true },
    { ref: "EU-005", tipo: "Edificio", titulo: "Edificio de 6 viviendas para rehabilitar", zona: "València ciudad",
      entorno: "Barrio céntrico con mucha demanda de alquiler", superficie: 520,
      precioDesde: 980000, precioHasta: 1050000, estado: "Disponible",
      certificado: "G", nda: true, cualificacion: "dossier", destacados: ["Un solo propietario", "Sin inquilinos"], ejemplo: true },
    { ref: "EU-006", tipo: "Vivienda", titulo: "Chalet de 4 dormitorios con piscina", zona: "Camp de Túria",
      entorno: "Urbanización a 20 minutos de València", superficie: 220, parcela: 800, dormitorios: 4, banos: 3,
      precioDesde: 590000, precioHasta: 640000, estado: "Reservada",
      certificado: "E", nda: false, destacados: ["Piscina y jardín", "Todo en una planta"], ejemplo: true }
  ];

  const contenedorFichas = $("#fichas");
  let FICHAS = [];

  const terminoVetado = (f) => {
    const texto = norm([f.titulo, f.entorno, f.zona, f.rentabilidad, ...(f.destacados || [])].join(" "));
    return (C.terminosVetados || []).find((t) => texto.includes(norm(t)));
  };

  const precioTexto = (f) => {
    if (f.precioDesde && f.precioHasta) return `${num.format(f.precioDesde)}–${eur(f.precioHasta)}`;
    if (f.precioDesde) return "Desde " + eur(f.precioDesde);
    return "A consultar";
  };

  function tarjeta(f, opciones = {}) {
    const e = slug(f.estado || "Disponible");
    const reservada = e === "reservada";
    const datos = [
      f.superficie && ["Superficie", (f.superficieAprox ? "≈ " : "") + num.format(f.superficie) + " m²"],
      f.parcela && ["Parcela", (f.superficieAprox ? "≈ " : "") + num.format(f.parcela) + " m²"],
      f.dormitorios && ["Dormitorios", f.dormitorios],
      f.banos && ["Baños", f.banos],
      f.certificado && ["Certificado energético", f.certificado],
      f.rentabilidad && ["Rentabilidad orientativa", f.rentabilidad]
    ].filter(Boolean);
    const idTitulo = "t-" + f.ref;
    return el("article", { class: "ficha", "aria-labelledby": idTitulo },
      el("div", { class: "ficha-top" },
        el("span", { class: "ref", text: f.ref }),
        f.ejemplo ? el("span", { class: "ejemplo-tag", text: "Ejemplo" }) : null,
        el("span", { class: "estado", "data-e": e, text: f.estado || "Disponible" })),
      el("h3", { id: idTitulo, text: f.titulo }),
      el("p", { class: "entorno", text: [f.zona, f.entorno].filter(Boolean).join(". ") }),
      el("dl", { class: "datos" },
        el("div", { class: "precio" }, el("dt", { text: "Precio orientativo" }), el("dd", { text: precioTexto(f) })),
        datos.map(([k, v]) => el("div", k.startsWith("Rentabilidad") ? { class: "ancho" } : {},
          el("dt", { text: k }), el("dd", { text: String(v) })))),
      f.destacados?.length ? el("ul", { class: "destacados" }, f.destacados.map((d) => el("li", { text: d }))) : null,
      opciones.vista
        ? el("button", { class: "btn", type: "button", disabled: true, title: "Vista previa", text: "Pedir dossier" })
        : el("button", { class: reservada ? "btn ghost" : "btn", type: "button",
            text: reservada ? "Avisarme si queda libre" : "Pedir dossier",
            onclick: () => abrirDialogo(reservada ? "aviso" : "dossier", f) }));
  }

  function rellenarFiltro(sel, valores) {
    [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"))
      .forEach((v) => sel.append(el("option", { value: v, text: v })));
  }

  function pintar() {
    const tipo = $("#f-tipo").value, zona = $("#f-zona").value, max = Number($("#f-precio").value) || Infinity;
    const lista = FICHAS.filter((f) => (!tipo || f.tipo === tipo) && (!zona || f.zona === zona) && (!f.precioDesde || f.precioDesde <= max));
    contenedorFichas.replaceChildren(...lista.map(tarjeta));
    $("#cuenta").textContent = lista.length === 1 ? "1 propiedad" : `${lista.length} propiedades`;
    $("#vacio").hidden = lista.length > 0;
  }

  async function cargarFichas() {
    let lista = FICHAS_EJEMPLO;
    if (C.fichasUrl) {
      try {
        const r = await fetch(C.fichasUrl);
        const j = await r.json();
        if (!Array.isArray(j.fichas)) throw new Error("Respuesta sin fichas");
        lista = j.fichas;
      } catch (err) {
        console.warn("No se han podido cargar las fichas:", err);
        $("#error-fichas").hidden = false;
        return;
      }
    }
    FICHAS = lista.filter((f) => {
      const t = terminoVetado(f);
      if (t) console.warn(`Ficha ${f.ref} oculta: contiene «${t}». Revisa la regla de publicación.`);
      return !t;
    });
    rellenarFiltro($("#f-tipo"), FICHAS.map((f) => f.tipo));
    rellenarFiltro($("#f-zona"), FICHAS.map((f) => f.zona));
    pintar();
  }

  if (contenedorFichas) {
    ["#f-tipo", "#f-zona", "#f-precio"].forEach((s) => $(s).addEventListener("change", pintar));
    cargarFichas();
  }

  /* ---------- Diálogo: dossier, búsqueda o aviso ---------- */
  const dlg = $("#dlg");
  const dlgForm = dlg ? $("form", dlg) : null;
  const TEXTOS_DLG = {
    dossier: (f) => ({ titulo: `Pedir el dossier de ${f.ref}`, boton: "Pedir dossier",
      sub: `${f.titulo}. ${f.zona}. ` +
        (f.cualificacion === "dossier" ? "El propietario pide acreditar cómo vas a pagar (preaprobación hipotecaria o prueba de fondos) antes del dossier. " : "") +
        (f.nda !== false ? "Te enviaremos el acuerdo de confidencialidad y, cuando lo firmes, el dossier con tu nombre en cada página." : "Te enviaremos el dossier con tu nombre en cada página.") }),
    aviso: (f) => ({ titulo: `Avisarme si ${f.ref} queda libre`, sub: `${f.titulo}. ${f.zona}. Está reservada; si la operación no sigue adelante, te escribimos.`, boton: "Avisarme" }),
    busqueda: () => ({ titulo: "Dejar mi búsqueda", sub: "Te escribimos cuando entre una propiedad que encaje. No compartimos tu búsqueda con nadie.", boton: "Guardar mi búsqueda" })
  };

  function abrirDialogo(modo, f = {}) {
    if (!dlg) return;
    dlgForm.reset();
    $(".estado-envio", dlgForm).textContent = "";
    const t = TEXTOS_DLG[modo](f);
    $("#dlg-titulo").textContent = t.titulo;
    $("#dlg-sub").textContent = t.sub;
    $("#dlg-enviar").textContent = t.boton;
    dlgForm.elements.ref.value = f.ref || "";
    dlgForm.elements.tipo.value = modo;
    $$("fieldset[data-modo]", dlgForm).forEach((fs) => {
      const activo = fs.dataset.modo.split(" ").includes(modo) && (!fs.hasAttribute("data-nda") || f.nda !== false);
      fs.hidden = !activo; fs.disabled = !activo;
    });
    dlg.showModal();
  }

  if (dlg) {
    $$("[data-abrir]").forEach((b) => b.addEventListener("click", () => abrirDialogo(b.dataset.abrir)));
    $$("[data-cerrar]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  }

  /* ---------- Envío de formularios → Apps Script → Google Sheets ---------- */
  const MENSAJES = {
    familia: "Recibido. Te contactaremos como nos has indicado.",
    propietario: "Recibido. Te llamaremos o escribiremos para hablar de tu propiedad. Nada se publica sin tu autorización por escrito.",
    dossier: "Solicitud enviada. Te escribiremos con el acuerdo de confidencialidad; en cuanto lo firmes, te enviamos el dossier.",
    aviso: "Hecho. Te escribiremos si la propiedad vuelve a estar disponible.",
    busqueda: "Búsqueda guardada. Te escribiremos cuando entre algo que encaje."
  };

  // Envía un objeto al Apps Script. Devuelve "prototipo", "ok" o "error".
  async function enviar(datos) {
    if (!C.endpoint) return "prototipo";
    try {
      await fetch(C.endpoint, { method: "POST", mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(datos) });
      return "ok";
    } catch {
      return "error";
    }
  }
  const AVISO_PROTOTIPO = "Prototipo: no se ha guardado nada. Cuando conectemos la hoja de cálculo, este envío llegará allí.";
  const AVISO_ERROR = "No se ha podido enviar. Comprueba la conexión y vuelve a intentarlo, o escríbenos por WhatsApp.";

  // Piezas que usan otros scripts (p. ej. ficha.js)
  window.EuporiaComun = { tarjeta, terminoVetado, enviar, norm, num, AVISO_PROTOTIPO, AVISO_ERROR };

  $$("form[data-form]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const estado = $(".estado-envio", form), boton = $('button[type="submit"]', form);
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const datos = Object.fromEntries(new FormData(form));
      if (datos.web) return;                       // trampa para bots
      delete datos.web;
      datos.tipo = form.dataset.form === "dlg" ? datos.tipo : form.dataset.form;
      datos.pagina = location.href;

      const textoBoton = boton.textContent;
      boton.disabled = true; boton.textContent = "Enviando…";
      const resultado = await enviar(datos);
      boton.disabled = false; boton.textContent = textoBoton;
      if (resultado === "ok") { form.reset(); estado.textContent = MENSAJES[datos.tipo] || "Recibido."; }
      else estado.textContent = resultado === "prototipo" ? AVISO_PROTOTIPO : AVISO_ERROR;
    });
  });
})();
