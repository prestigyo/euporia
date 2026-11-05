/* =====================================================================
   Euporia · calculadora «Qué hacer con la vivienda heredada»
   Compara cuatro caminos para los herederos: vender y repartir, que uno
   se la quede y compense a los demás, alquilarla y repartir la renta, o
   mantenerla entre todos. Las cuentas se hacen en el navegador; no se
   envía ni se guarda nada. No calcula impuestos: solo los menciona,
   porque dependen de cada heredero (ver la guía, con fuentes).
   Supuestos ajustables: SUPUESTOS, justo debajo. Si los cambias,
   actualiza «Cómo está hecha esta calculadora» en la guía.
   ===================================================================== */
(() => {
  "use strict";
  const form = document.getElementById("calc-herencia");
  const salida = document.getElementById("calc-herencia-resultado");
  if (!form || !salida) return;
  const SITE = window.EUPORIA || {};

  const SUPUESTOS = {
    gastosVentaPct: 0.03,   // comisión, notaría y registro de la venta, aproximado
    gastosVentaFijos: 1500, // cancelación de hipoteca, certificados, gestiones
    vacioAnual: 0.006       // si no se indican gastos: IBI, comunidad, seguro y suministros ≈ 0,6 % del valor al año
  };

  const num = (v) => parseInt(String(v == null ? "" : v).split(",")[0].replace(/[^\d]/g, ""), 10) || 0;
  let fmt;
  try { fmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }); }
  catch (e) { fmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }); }
  const eur = (n, r = 100) => fmt.format(Math.round(n / r) * r) + " €";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function leer() {
    const d = Object.fromEntries(new FormData(form));
    return { valor: num(d.valor), herederos: Math.min(20, Math.max(1, num(d.herederos) || 2)), hipoteca: num(d.hipoteca),
      cuota: num(d.cuota), renta: num(d.renta), gastos: num(d.gastos) };
  }

  function calcular(d) {
    const n = d.herederos, gastosAnuales = d.gastos || d.valor * SUPUESTOS.vacioAnual;
    const gastosVenta = d.valor * SUPUESTOS.gastosVentaPct + SUPUESTOS.gastosVentaFijos;
    const netoVenta = d.valor - d.hipoteca - gastosVenta;
    const patrimonio = d.valor - d.hipoteca;                 // lo que vale la casa descontada la hipoteca
    const parte = patrimonio / n;
    const rentaAnual = d.renta * 12, cuotaAnual = d.cuota * 12;
    const netoAlquiler = rentaAnual - gastosAnuales - cuotaAnual;
    const costeMantener = gastosAnuales + cuotaAnual;
    return { n, gastosVenta, netoVenta, porHeredero: netoVenta / n, parte, compensacion: parte * (n - 1),
      gastosAnuales, rentaAnual, netoAlquiler, alquilerPorHeredero: netoAlquiler / n,
      costeMantener, costePorHeredero: costeMantener / n };
  }

  function pintar() {
    const d = leer();
    if (!d.valor) {
      salida.innerHTML = '<div class="calc-vacio"><p>Escribe el valor aproximado de la vivienda y cuántos herederos sois para ver los cuatro caminos.</p></div>';
      return;
    }
    const r = calcular(d), uno = r.n === 1;
    const avisos = [];
    if (r.netoVenta <= 0) avisos.push("<strong>Con estos números, vender no deja dinero:</strong> la hipoteca y los gastos se comen el valor. Antes de aceptar la herencia, mirad la opción de aceptarla «a beneficio de inventario» con un abogado.");
    if (d.renta && r.netoAlquiler < 0) avisos.push("<strong>Alquilada, la casa cuesta más de lo que da:</strong> la renta no cubre la hipoteca y los gastos.");
    const cajaAlquiler = d.renta
      ? `<div class="calc-caja"><span class="bl">3. Alquilarla y repartir la renta</span><span class="bv">${eur(r.alquilerPorHeredero, 10)}<small> / año${uno ? "" : " cada uno"}</small></span>
          <small>Renta de ${eur(r.rentaAnual, 10)} al año, menos ${eur(r.gastosAnuales, 10)} de gastos${d.cuota ? " y la hipoteca" : ""}. Antes del IRPF, que paga cada uno por su parte.</small></div>`
      : `<div class="calc-caja"><span class="bl">3. Alquilarla y repartir la renta</span><span class="bv">—</span>
          <small>Escribe una renta mensual aproximada para ver cuánto le tocaría a cada uno.</small></div>`;
    salida.innerHTML = `
      <div class="calc-hero">
        <p class="calc-lbl">Si vendéis y repartís, a ${uno ? "ti te queda" : "cada uno le toca"}</p>
        <p class="calc-big">${eur(Math.max(0, r.porHeredero))}</p>
        <p class="calc-sub">Valor de ${eur(d.valor)}${d.hipoteca ? `, menos ${eur(d.hipoteca)} de hipoteca` : ""} y unos ${eur(r.gastosVenta)} de gastos de venta${uno ? "" : `, entre ${r.n} herederos a partes iguales`}. Antes de impuestos.</p>
      </div>
      ${avisos.length ? `<ul class="calc-avisos">${avisos.map((a) => `<li>${a}</li>`).join("")}</ul>` : ""}
      <h3 class="calc-h">Los cuatro caminos</h3>
      <div class="calc-cajas">
        <div class="calc-caja"><span class="bl">1. Vender y repartir</span><span class="bv">${eur(Math.max(0, r.porHeredero))}${uno ? "" : "<small> cada uno</small>"}</span>
          <small>Lo más sencillo si nadie quiere la casa. Necesita el acuerdo de todos.</small></div>
        ${uno ? "" : `<div class="calc-caja"><span class="bl">2. Que uno se la quede</span><span class="bv">${eur(r.compensacion)}</span>
          <small>Es lo que tendría que pagar a los demás (${eur(r.parte)} a cada uno)${d.hipoteca ? ", además de quedarse con la hipoteca" : ""}. Si necesita financiación, conviene mirarla antes de firmar.</small></div>`}
        ${cajaAlquiler}
        <div class="calc-caja"><span class="bl">4. Mantenerla entre todos</span><span class="bv">${eur(r.costePorHeredero, 10)}<small> / año${uno ? "" : " cada uno"}</small></span>
          <small>Lo que cuesta tenerla vacía: ${eur(r.costeMantener, 10)} al año entre gastos${d.cuota ? " e hipoteca" : ""}.${uno ? "" : " Si alguien quiere salir, puede pedir la división."}</small></div>
      </div>
      <div class="calc-claves">
        <p><strong>Impuestos:</strong> la herencia paga el impuesto de sucesiones sobre, como mínimo, el <a class="link" href="/documentos/valor-de-referencia/">valor de referencia del Catastro</a>, y la plusvalía municipal. Vender después puede tener IRPF. Más abajo te explicamos qué bonificaciones hay en la Comunitat Valenciana.</p>
        <p class="calc-nota">Son cuentas orientativas, antes de impuestos y con supuestos de gastos. No sustituyen a un asesor ni a una tasación.</p>
      </div>`;
    const acciones = document.getElementById("calc-herencia-acciones");
    if (acciones) acciones.hidden = false;
    resumenActual = [`Herencia de una vivienda · ${eur(d.valor)} · ${r.n} heredero${uno ? "" : "s"}`,
      `1. Vender y repartir: ${eur(Math.max(0, r.porHeredero))}${uno ? "" : " cada uno"}`,
      uno ? null : `2. Que uno se la quede: pagaría ${eur(r.compensacion)} a los demás`,
      d.renta ? `3. Alquilarla: ${eur(r.alquilerPorHeredero, 10)} al año${uno ? "" : " cada uno"}` : null,
      `4. Mantenerla: ${eur(r.costePorHeredero, 10)} al año${uno ? "" : " cada uno"}`, "— Euporia"].filter(Boolean).join("\n");
    if (!usada && window.EuporiaMedir) { usada = true; window.EuporiaMedir("herramienta_completada", { herramienta: "herencia" }); }
  }
  let resumenActual = "", usada = false;

  form.addEventListener("input", pintar);
  form.addEventListener("submit", (e) => { e.preventDefault(); pintar(); salida.focus(); });
  const acciones = document.getElementById("calc-herencia-acciones");
  if (acciones) {
    acciones.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-whatsapp") && SITE.whatsapp) {
        window.open(`https://wa.me/${SITE.whatsapp}?text=` + encodeURIComponent("Hola, he hecho los números de una herencia con la calculadora de Euporia:\n\n" + resumenActual), "_blank", "noopener");
      }
      if (b.hasAttribute("data-imprimir")) window.print();
    });
    const wa = acciones.querySelector("[data-whatsapp]");
    if (wa) wa.hidden = !SITE.whatsapp;
  }
  // Precarga opcional: ?valor=250000&herederos=3
  try {
    const q = new URLSearchParams(location.search);
    ["valor", "herederos", "hipoteca", "renta"].forEach((k) => { if (q.get(k) && form.elements[k]) form.elements[k].value = q.get(k); });
  } catch (e) { /* sin parámetros */ }
  pintar();
})();
