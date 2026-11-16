/* =====================================================================
   Euporia · «Croquis de tu casa por estancias»
   La persona escribe cada estancia con su largo y su ancho. La herramienta
   dibuja cada una a la misma escala (un rectángulo con sus medidas), calcula
   la superficie de cada estancia y la suma, y prepara una hoja para imprimir.
   NO es un plano: no coloca las estancias en su sitio ni dibuja puertas,
   ventanas o tabiques. Para eso está el paso «Pedir un plano a escala».
   Las medidas se guardan solo en el navegador (localStorage, clave
   euporia_croquis) y no se envían. Los botones de WhatsApp abren el texto
   escrito y la persona decide si lo manda.
   Si cambias cómo se calcula (LIMITE_CM, EXTERIOR), revisa el texto y las
   preguntas frecuentes de contenido/documentos-planos-croquis.html.

   Casos de prueba (consola: EuporiaCroquis.calcular([...]) y EuporiaCroquis.medida("3,45")):
   - medida("3,45") = 3.45 · medida("3.45") = 3.45 · medida("345") = 3.45 (más de 30 se toma como centímetros) · medida("") = 0
   - Salón 5 × 4 → 20,00 m². Baño 2,10 × 1,65 → 3,47 m² (3,465 redondeado).
   - Salón 5×4, Cocina 3×2,5 y Terraza 4×1,5 → interior 27,50 m², exterior 6,00 m², total 33,50 m².
   - Una fila sin largo o sin ancho no cuenta.
   ===================================================================== */
(() => {
  "use strict";
  const form = document.getElementById("cq-form");
  const salida = document.getElementById("cq-resultado");
  const SITE = window.EUPORIA || {};

  const LIMITE_CM = 30;                                   // un número mayor se entiende como centímetros
  const EXTERIOR = /terraza|balc[oó]n|patio|jard[ií]n|porche|galer[ií]a/i;   // se suman aparte
  const SUGERIDAS = ["Salón", "Comedor", "Cocina", "Dormitorio 1", "Dormitorio 2", "Dormitorio 3", "Baño", "Aseo",
    "Recibidor", "Pasillo", "Despacho", "Lavadero", "Terraza", "Balcón", "Trastero"];
  const INICIALES = ["Salón", "Cocina", "Dormitorio 1", "Baño"];

  /* ---------- Cálculo (sin DOM) ---------- */
  function medida(v) {
    const n = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", "."));
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round((n > LIMITE_CM ? n / 100 : n) * 100) / 100;
  }
  // filas = [{ nombre, largo, ancho }] con largo y ancho ya en metros
  function calcular(filas) {
    const est = filas.filter((f) => f.largo > 0 && f.ancho > 0).map((f, i) => ({
      nombre: (f.nombre || "").trim() || "Estancia " + (i + 1), largo: f.largo, ancho: f.ancho,
      area: Math.round(f.largo * f.ancho * 100) / 100, exterior: EXTERIOR.test(f.nombre || "")
    }));
    const suma = (a) => Math.round(a.reduce((s, x) => s + x.area, 0) * 100) / 100;
    return { est, interior: suma(est.filter((x) => !x.exterior)), exterior: suma(est.filter((x) => x.exterior)), total: suma(est) };
  }
  window.EuporiaCroquis = { calcular, medida };
  if (!form || !salida) return;

  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dec = (n) => n.toFixed(2).replace(".", ",");
  const m2 = (n) => dec(n) + " m²";
  const CLAVE = "euporia_croquis";
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del() { try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- Formulario ---------- */
  let serie = 0;
  function fila(d) {
    const i = ++serie, f = d || {};
    return `<fieldset class="cq-fila" data-fila>
      <legend class="sr-only">Estancia</legend>
      <label class="campo cq-nombre"><span>Estancia</span><input type="text" name="nombre" list="cq-sugeridas" autocomplete="off" value="${esc(f.nombre || "")}" placeholder="Salón" id="cq-n-${i}"></label>
      <label class="campo"><span>Largo <small>(m)</small></span><input type="text" inputmode="decimal" name="largo" autocomplete="off" value="${esc(f.largo || "")}" placeholder="4,20"></label>
      <label class="campo"><span>Ancho <small>(m)</small></span><input type="text" inputmode="decimal" name="ancho" autocomplete="off" value="${esc(f.ancho || "")}" placeholder="3,10"></label>
      <button class="cq-quitar" type="button" data-quitar aria-label="Quitar esta estancia" title="Quitar">×</button>
    </fieldset>`;
  }
  function montar(guardadas) {
    const filas = guardadas && guardadas.length ? guardadas : INICIALES.map((n) => ({ nombre: n }));
    form.innerHTML = `
      <h2>Tus estancias</h2>
      <p>Mide cada estancia de pared a pared y escribe su largo y su ancho en metros (por ejemplo, 3,45). Si te resulta más cómodo, escríbelo en centímetros (345).</p>
      <p class="vc-guardado">Las medidas se guardan solo en este dispositivo. No se envían a ningún sitio.</p>
      <datalist id="cq-sugeridas">${SUGERIDAS.map((s) => `<option value="${esc(s)}">`).join("")}</datalist>
      <div data-filas>${filas.map(fila).join("")}</div>
      <div class="cq-fin">
        <button class="btn ghost" type="button" data-anadir>Añadir estancia</button>
        <button class="btn" type="submit">Ver el croquis</button>
        <button class="link cq-enlace" type="button" data-borrar>Empezar de cero</button>
      </div>`;
  }
  function leer() {
    return Array.from(form.querySelectorAll("[data-fila]")).map((el) => ({
      nombre: el.querySelector('[name="nombre"]').value, largoTxt: el.querySelector('[name="largo"]').value,
      anchoTxt: el.querySelector('[name="ancho"]').value
    }));
  }

  /* ---------- Dibujo: cada estancia a la misma escala, en filas (no es la distribución real) ---------- */
  function dibujo(est) {
    const maxL = Math.max.apply(null, est.map((e) => e.largo));
    const ANCHO = Math.max(9, maxL + 1);          // ancho del lienzo en metros
    const fs = ANCHO * 0.044, hueco = ANCHO * 0.04, pie = fs * 3.4;
    let x = 0, y = fs, altoFila = 0, piezas = "";
    est.forEach((e) => {
      const caja = Math.max(e.largo, fs * 10.5);     // sitio mínimo para que quepa el texto
      if (x > 0 && x + caja > ANCHO) { x = 0; y += altoFila + pie + hueco; altoFila = 0; }
      const cx = x + caja / 2;
      piezas += `<g><rect x="${(cx - e.largo / 2).toFixed(3)}" y="${y.toFixed(3)}" width="${e.largo}" height="${e.ancho}" class="cq-r${e.exterior ? " ext" : ""}"/>
        <text x="${cx.toFixed(3)}" y="${(y + e.ancho + fs * 1.3).toFixed(3)}" class="cq-tn">${esc(e.nombre)}</text>
        <text x="${cx.toFixed(3)}" y="${(y + e.ancho + fs * 2.5).toFixed(3)}" class="cq-tm">${dec(e.largo)} × ${dec(e.ancho)} m · ${m2(e.area)}</text></g>`;
      altoFila = Math.max(altoFila, e.ancho);
      x += caja + hueco;
    });
    const alto = y + altoFila + pie;
    // Barra de escala de 1 metro
    const escala = `<g class="cq-esc"><line x1="0" y1="${(alto + fs).toFixed(3)}" x2="1" y2="${(alto + fs).toFixed(3)}"/><text x="1.2" y="${(alto + fs * 1.35).toFixed(3)}" class="cq-tm" style="text-anchor:start">1 metro</text></g>`;
    return `<svg class="cq-svg" viewBox="${-fs} 0 ${(ANCHO + fs * 2).toFixed(3)} ${(alto + fs * 2.4).toFixed(3)}" role="img" aria-label="Croquis: cada estancia dibujada a la misma escala" style="font-size:${fs.toFixed(3)}px">${piezas}${escala}</svg>`;
  }
  const tabla = (c) => `<table class="calc-tabla cq-tabla"><thead><tr><th>Estancia</th><th>Largo</th><th>Ancho</th><th>Superficie</th></tr></thead><tbody>${
    c.est.map((e) => `<tr><th>${esc(e.nombre)}${e.exterior ? " <small>(exterior)</small>" : ""}</th><td>${dec(e.largo)} m</td><td>${dec(e.ancho)} m</td><td>${m2(e.area)}</td></tr>`).join("")}
    ${c.exterior ? `<tr><th>Interior</th><td></td><td></td><td>${m2(c.interior)}</td></tr><tr><th>Exterior</th><td></td><td></td><td>${m2(c.exterior)}</td></tr>` : ""}
    <tr class="cq-total"><th>Total medido</th><td></td><td></td><td>${m2(c.total)}</td></tr></tbody></table>`;
  const AVISO = "Es un croquis de medidas, no un plano: cada estancia está dibujada a la misma escala, pero no en su sitio, y no aparecen puertas, ventanas ni tabiques. La suma es la superficie que has medido: no coincide con los metros construidos de la escritura o del Catastro, que incluyen muros y, a veces, zonas comunes.";

  /* ---------- Resultado ---------- */
  let ultimo = null, completada = false;
  function pintar() {
    const crudo = leer();
    store.set(crudo.map((f) => ({ nombre: f.nombre, largo: f.largoTxt, ancho: f.anchoTxt })));
    const c = calcular(crudo.map((f) => ({ nombre: f.nombre, largo: medida(f.largoTxt), ancho: medida(f.anchoTxt) })));
    const acciones = document.getElementById("cq-acciones");
    if (!c.est.length) {
      salida.innerHTML = '<div class="calc-vacio"><p>Escribe el largo y el ancho de una estancia para ver su dibujo y su superficie.</p></div>';
      if (acciones) acciones.hidden = true;
      ultimo = null;
      return;
    }
    ultimo = c;
    salida.innerHTML = `
      <div class="calc-hero">
        <p class="calc-lbl">Superficie medida · ${c.est.length} ${c.est.length === 1 ? "estancia" : "estancias"}</p>
        <p class="calc-big">${dec(c.total)} <small>m²</small></p>
        ${c.exterior ? `<p class="calc-sub">${m2(c.interior)} de interior y ${m2(c.exterior)} de exterior (terrazas, balcones, patios).</p>` : ""}
      </div>
      <div class="cq-lienzo">${dibujo(c.est)}</div>
      <div class="calc-tabla-marco">${tabla(c)}</div>
      <div class="calc-claves"><p class="calc-nota">${AVISO}</p></div>`;
    if (acciones) acciones.hidden = false;
    if (!completada && c.est.length >= 3 && window.EuporiaMedir) {
      completada = true; window.EuporiaMedir("herramienta_completada", { herramienta: "croquis" });
    }
  }

  const texto = (c) => ["*Croquis de mi casa*", "Hecho con la herramienta de Euporia",
    c.est.map((e) => `- ${e.nombre}: ${dec(e.largo)} × ${dec(e.ancho)} m = ${m2(e.area)}`).join("\n"),
    (c.exterior ? `Interior: ${m2(c.interior)}\nExterior: ${m2(c.exterior)}\n` : "") + `*Total medido: ${m2(c.total)}*`,
    "Es un croquis de medidas, no un plano."].join("\n\n");

  function hoja(c) {
    const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    return `<header class="cq-h-cab"><p class="cq-h-marca">Euporia</p><h2>Croquis de la vivienda por estancias</h2><p>${esc(fecha)} · ${c.est.length} ${c.est.length === 1 ? "estancia" : "estancias"} · ${m2(c.total)} medidos</p></header>
      ${dibujo(c.est)}
      ${tabla(c)}
      <p class="cq-h-nota">${AVISO}</p>
      <p class="cq-h-nota">Hecho con la herramienta de croquis de Euporia: ${esc(location.origin + location.pathname)}</p>`;
  }

  montar(store.get());
  form.addEventListener("input", pintar);
  form.addEventListener("submit", (e) => { e.preventDefault(); pintar(); salida.focus(); salida.scrollIntoView({ behavior: "smooth", block: "start" }); });
  form.addEventListener("click", (e) => {
    const filas = form.querySelector("[data-filas]");
    if (e.target.closest("[data-anadir]")) {
      filas.insertAdjacentHTML("beforeend", fila());
      filas.lastElementChild.querySelector("input").focus();
    } else if (e.target.closest("[data-quitar]")) {
      e.target.closest("[data-fila]").remove();
      if (!filas.children.length) filas.insertAdjacentHTML("beforeend", fila());
      pintar();
    } else if (e.target.closest("[data-borrar]")) {
      if (!window.confirm("¿Borrar todas las medidas de este dispositivo?")) return;
      store.del(); montar(null); pintar();
    }
  });

  // Impresión: la hoja del croquis es hija directa de <body> y, al imprimir, es lo único que sale
  const papel = document.createElement("div");
  papel.id = "cq-hoja";
  document.body.appendChild(papel);
  const preparar = () => { if (ultimo) { papel.innerHTML = hoja(ultimo); document.documentElement.classList.add("cq-imprimir"); } };
  window.addEventListener("beforeprint", preparar);
  window.addEventListener("afterprint", () => document.documentElement.classList.remove("cq-imprimir"));

  const acciones = document.getElementById("cq-acciones");
  if (acciones) {
    const eu = acciones.querySelector("[data-euporia]");
    if (eu) eu.hidden = !SITE.whatsapp;
    acciones.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !ultimo) return;
      const t = texto(ultimo);
      if (b.hasAttribute("data-imprimir")) { preparar(); window.print(); }
      if (b.hasAttribute("data-compartir")) window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank", "noopener");
      if (b.hasAttribute("data-euporia") && SITE.whatsapp) {
        window.open(`https://wa.me/${SITE.whatsapp}?text=` + encodeURIComponent("Hola, he hecho el croquis de mi casa con la herramienta de Euporia y necesito un plano a escala:\n\n" + t), "_blank", "noopener");
      }
    });
  }
  pintar();
})();
