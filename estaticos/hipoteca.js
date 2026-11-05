/* =====================================================================
   Euporia · «¿Cuánta hipoteca puedo pedir?» (compradores)
   Horquilla orientativa de cuota, hipoteca y precio máximo de vivienda.
   Las cuentas se hacen en el navegador. Solo se envía algo si la persona
   rellena el formulario de contacto (hoja «Hipotecas»): entonces el
   resumen del cálculo viaja con su consentimiento.
   Supuestos: SUPUESTOS, justo debajo, con su fuente. Si los cambias,
   actualiza «Cómo está hecha esta calculadora» en la guía.
   ===================================================================== */
(() => {
  "use strict";
  const form = document.getElementById("calc-hipoteca");
  const salida = document.getElementById("calc-hipoteca-resultado");
  if (!form || !salida) return;

  const SUPUESTOS = {
    endeudamiento: [0.30, 0.35], // Banco de España: las entidades suelen considerar razonable un endeudamiento total del 30-35 % de los ingresos
    financiacion: 0.80,          // Banco de España: en vivienda habitual se suele financiar como máximo el 80 % del valor de tasación
    gastosCompra: 0.015,         // supuesto: notaría, registro, gestoría y tasación de la compra, ≈ 1,5 % del precio
    // Impuestos de la compra en la Comunitat Valenciana (Ley 13/1997, art. 13 y 14, texto consolidado de agosto de 2026)
    impuestos: { usada: 0.09, joven: 0.06, nueva: 0.101 }   // nueva: IVA 10 % + AJD 0,1 % (vivienda habitual)
  };

  const num = (v) => {
    const s = String(v == null ? "" : v).trim();
    if (!s) return 0;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    return parseFloat(s.replace(/[^\d,.]/g, "").replace(",", ".")) || 0;
  };
  let fmt;
  try { fmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }); }
  catch (e) { fmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }); }
  const eur = (n, r = 100) => fmt.format(Math.round(n / r) * r) + " €";

  // Capital que se puede devolver con una cuota mensual dada (sistema francés)
  function capital(cuota, tipoAnual, anios) {
    const i = tipoAnual / 100 / 12, n = anios * 12;
    if (cuota <= 0 || n <= 0) return 0;
    return i === 0 ? cuota * n : cuota * (1 - Math.pow(1 + i, -n)) / i;
  }
  function cuotaDe(cap, tipoAnual, anios) {
    const i = tipoAnual / 100 / 12, n = anios * 12;
    if (cap <= 0 || n <= 0) return 0;
    return i === 0 ? cap / n : cap * i / (1 - Math.pow(1 + i, -n));
  }

  function leer() {
    const d = Object.fromEntries(new FormData(form));
    return { ingresos: num(d.ingresos), deudas: num(d.deudas), ahorro: num(d.ahorro),
      tipo: num(d.tipo) || 0, plazo: Math.min(40, Math.max(5, num(d.plazo) || 30)),
      precio: num(d.precio), impuesto: d.impuesto in SUPUESTOS.impuestos ? d.impuesto : "usada" };
  }

  function calcular(d) {
    const t = SUPUESTOS.impuestos[d.impuesto], g = SUPUESTOS.gastosCompra, f = SUPUESTOS.financiacion;
    const [eBajo, eAlto] = SUPUESTOS.endeudamiento;
    const cuotaBaja = Math.max(0, d.ingresos * eBajo - d.deudas), cuotaAlta = Math.max(0, d.ingresos * eAlto - d.deudas);
    const hipBaja = capital(cuotaBaja, d.tipo, d.plazo), hipAlta = capital(cuotaAlta, d.tipo, d.plazo);
    // Precio máximo: el menor entre lo que permiten los ingresos (hipoteca = 80 % del precio)
    // y lo que permite el ahorro (20 % de entrada + impuestos + gastos)
    const porIngresosBajo = hipBaja / f, porIngresosAlto = hipAlta / f;
    const porAhorro = d.ahorro / ((1 - f) + t + g);
    const precioBajo = Math.min(porIngresosBajo, porAhorro), precioAlto = Math.min(porIngresosAlto, porAhorro);
    const limita = porAhorro < porIngresosAlto ? "ahorro" : "ingresos";
    let objetivo = null;
    if (d.precio) {
      const costes = d.precio * (t + g), necesita = Math.max(0, d.precio + costes - d.ahorro);
      const maxBanco = d.precio * f;
      objetivo = { costes, necesita, maxBanco, cuota: cuotaDe(necesita, d.tipo, d.plazo),
        faltaAhorro: Math.max(0, necesita - maxBanco), cabe: necesita <= maxBanco && necesita <= hipAlta };
    }
    return { t, cuotaBaja, cuotaAlta, hipBaja, hipAlta, precioBajo, precioAlto, porAhorro, limita, objetivo };
  }

  let resumenActual = "", usada = false;
  function pintar() {
    const d = leer();
    if (!d.ingresos || !d.tipo) {
      salida.innerHTML = '<div class="calc-vacio"><p>Escribe tus ingresos netos al mes y un tipo de interés para ver la horquilla.</p></div>';
      return;
    }
    const r = calcular(d);
    const avisos = [];
    if (r.cuotaAlta <= 0) avisos.push("<strong>Con tus deudas actuales no queda margen para una cuota.</strong> Reducirlas o cancelar alguna es el primer paso antes de pedir hipoteca.");
    if (r.limita === "ahorro" && r.cuotaAlta > 0) avisos.push("<strong>Lo que te limita es el ahorro, no los ingresos.</strong> Los bancos suelen financiar hasta el 80 %: la entrada, los impuestos y los gastos salen de tu bolsillo.");
    let bloqueObjetivo = "";
    if (r.objetivo) {
      const o = r.objetivo;
      bloqueObjetivo = `<h3 class="calc-h">Para una vivienda de ${eur(d.precio, 1000)}</h3>
        <div class="calc-cajas">
          <div class="calc-caja"><span class="bl">Impuestos y gastos de la compra</span><span class="bv">${eur(o.costes)}</span><small>Aproximado. Se pagan con ahorro.</small></div>
          <div class="calc-caja"><span class="bl">Hipoteca que necesitarías</span><span class="bv">${eur(o.necesita, 1000)}</span><small>Cuota de unos ${eur(o.cuota, 10)} al mes.</small></div>
          <div class="calc-caja"><span class="bl">${o.cabe ? "Encaja con tus números" : "No encaja todavía"}</span><span class="bv">${o.cabe ? "Sí" : "No"}</span>
            <small>${o.faltaAhorro > 0 ? `Te faltarían unos ${eur(o.faltaAhorro, 1000)} de ahorro para quedarte en el 80 %.` : o.necesita > r.hipAlta ? "La cuota pasaría del 35 % de tus ingresos." : "Dentro del 80 % y del 35 % de tus ingresos."}</small></div>
        </div>`;
    }
    salida.innerHTML = `
      <div class="calc-hero">
        <p class="calc-lbl">Precio máximo de vivienda, orientativo</p>
        <p class="calc-big">${eur(r.precioBajo, 1000)} – ${eur(r.precioAlto, 1000)}</p>
        <p class="calc-sub">Con una hipoteca de hasta ${eur(r.hipAlta, 1000)} a ${d.plazo} años y un ${String(d.tipo).replace(".", ",")} % de interés, y tu ahorro para la entrada, los impuestos y los gastos.</p>
      </div>
      ${avisos.length ? `<ul class="calc-avisos">${avisos.map((a) => `<li>${a}</li>`).join("")}</ul>` : ""}
      <div class="calc-cajas">
        <div class="calc-caja"><span class="bl">Cuota que podrías asumir</span><span class="bv">${eur(r.cuotaBaja, 10)} – ${eur(r.cuotaAlta, 10)}</span><small>Entre el 30 % y el 35 % de tus ingresos, menos tus otras deudas.</small></div>
        <div class="calc-caja"><span class="bl">Hipoteca máxima</span><span class="bv">${eur(r.hipBaja, 1000)} – ${eur(r.hipAlta, 1000)}</span><small>Lo que se devuelve con esa cuota.</small></div>
        <div class="calc-caja"><span class="bl">Lo que permite tu ahorro</span><span class="bv">${eur(r.porAhorro, 1000)}</span><small>Precio con el que tu ahorro cubre el 20 %, los impuestos (${String(Math.round(r.t * 1000) / 10).replace(".", ",")} %) y los gastos.</small></div>
      </div>
      ${bloqueObjetivo}
      <p class="calc-nota">Es una estimación con criterios generales, no una oferta ni un estudio de tu caso: cada banco aplica los suyos (estabilidad del empleo, edad al terminar el préstamo, historial, tasación).</p>`;
    resumenActual = [`Ingresos netos ${eur(d.ingresos, 10)}/mes · deudas ${eur(d.deudas, 10)}/mes · ahorro ${eur(d.ahorro, 1000)}`,
      `Interés ${d.tipo} % a ${d.plazo} años · impuesto ${d.impuesto}`,
      `Cuota asumible ${eur(r.cuotaBaja, 10)} – ${eur(r.cuotaAlta, 10)} · hipoteca ${eur(r.hipBaja, 1000)} – ${eur(r.hipAlta, 1000)}`,
      `Precio máximo ${eur(r.precioBajo, 1000)} – ${eur(r.precioAlto, 1000)} (limita el ${r.limita})`,
      d.precio ? `Vivienda de ${eur(d.precio, 1000)}: necesita ${eur(r.objetivo.necesita, 1000)} de hipoteca, ${r.objetivo.cabe ? "encaja" : "no encaja"}` : null
    ].filter(Boolean).join("\n");
    const campo = document.querySelector('form[data-form="hipoteca"] input[name="resumen"]');
    if (campo) campo.value = resumenActual;
    if (!usada && window.EuporiaMedir) { usada = true; window.EuporiaMedir("herramienta_completada", { herramienta: "hipoteca" }); }
  }

  form.addEventListener("input", pintar);
  form.addEventListener("change", pintar);
  form.addEventListener("submit", (e) => { e.preventDefault(); pintar(); salida.focus(); });
  // Precarga opcional desde la calculadora de visitas: ?precio=280000
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("precio") && form.elements.precio) form.elements.precio.value = q.get("precio");
  } catch (e) { /* sin parámetros */ }
  pintar();
})();
