/* =====================================================================
   Euporia · diagnóstico de hipoteca
   Todos los cálculos se hacen en el navegador. Solo se envía algo si la persona
   rellena un formulario y lo decide; el resumen va solo si marca la casilla.
   Los envíos los gestiona app.js (form[data-form]).
   ===================================================================== */
(() => {
"use strict";
/* CONFIG · todo lo que puede cambiar vive aquí. Datos revisados: 08/11/2026 */
const CONFIG = {
  // Media mensual del euríbor a un año (tipo oficial). Actualizar cada mes con la nota del Banco de España
  // (sale hacia el día 2-4). Octubre de 2026: 3,239 % (nota de 3/11/2026, presbe2026-104). Sin valor verificado → null.
  euribor: { valor: 3.239, fecha: "octubre de 2026", fuente: "Banco de España" },
  iprem: { anual14Pagas: 8400, fecha: "2026" },   // 600 €/mes; sin cambios desde 2023 por la prórroga de presupuestos
  cbp: {
    fecha: "noviembre de 2026",               // Banco de España, requisitos económicos
    ingresosVecesIPREM: 3,                    // límite general
    ingresosVecesIPREMAmpliado: 4,            // discapacidad > 33 %, dependencia o enfermedad que impida trabajar (5 en algunos casos)
    esfuerzoMinimo: 0.50,                     // cuota hipotecaria / ingresos netos
    esfuerzoMinimoAmpliado: 0.40              // en los casos del límite ampliado
  },
  // Supuestos del cálculo (no son datos legales; se muestran al usuario)
  umbrales: {
    esfuerzoTension: 0.30,     // por encima: en tensión
    esfuerzoRiesgo: 0.40,      // por encima: en riesgo
    mesesRiesgo: 6,            // si el ahorro cubre menos meses de déficit: en riesgo
    colchonMeses: 3,           // ahorro que conviene no tocar antes de amortizar
    colchonPct: 0.10           // parte de los ingresos que se reserva al calcular la cuota asumible
  },
  rangos: { indice: [-1, 10], diferencial: [0, 6], tipoFijo: [0, 10], anios: [1, 40], capital: [1000, 2000000] },
  gastosVenta: { porcentaje: 0.03, fijos: 1500 },  // supuesto: comisión + notaría/registro/cancelación
  ampliacionAnios: 5,          // ampliación de plazo que se simula al negociar
  cartas: { revisadas: false } // true cuando un abogado haya revisado el texto fijo
};

/* =====================================================================
   CÁLCULOS · sistema francés, tipo = índice + diferencial, plazo restante
   ---------------------------------------------------------------------
   Casos de prueba (se ejecutan abriendo la página con #test; ver consola)
     cuotaFrancesa(150000, 4,    300) = 791,76 €
     cuotaFrancesa(150000, 0,    300) = 500,00 €   (tipo 0 → reparto lineal)
     cuotaFrancesa(120000, 3.5,  240) = 695,95 €
     cuotaFrancesa(180000, 4.25, 360) = 885,49 €
     mesesParaCuota(150000, 4, 700)   = 377 meses
     mesesParaCuota(150000, 4, 500)   = Infinity (la cuota no cubre ni los intereses)
     umbralEquilibrio(180000)         = 187.113,40 € (3 % + 1.500 € de gastos de venta)
     cuotaAsumible(2100, 1000, 150)   = 740 €      (2100 − 1000 − 150 − 10 % de 2100)
     cuotaAsumible(1500, 1200, 200)   = −50 €      (≤ 0: sin margen para ninguna cuota)
     tramoVenta(200000, 151300, 157526) = "deja"   (≥ umbral)
     tramoVenta(155000, 151300, 157526) = "cerca"  (entre deuda total y umbral)
     tramoVenta(140000, 151300, 157526) = "quita"  (< deuda total)
     parseNum("150.000") = 150000 · parseNum("0,99", true) = 0,99
     parseNum("3.5", true) = 3,5  · parseNum("1.500", true) = 1,5 (en tipos el punto es decimal)
     validar({capital: 500, cuota: 50, ...}) → 1 aviso (capital fuera de rango)
     validar({cuota ≥ capital})       → 1 aviso
     cbpResultado(800, 1500, sí) = "encaja"   (53 % de esfuerzo; 18.000 €/año ≤ 3 × IPREM)
     cbpResultado(700, 1500, sí) = "ampliado" (47 %: supera el 40 %, no el 50 %)
     cbpResultado(700, 2500, sí) = "no"       (28 %)
     cbpResultado(800, 1500, no) = "noHabitual"
   ===================================================================== */
function cuotaFrancesa(capital, tipoAnualPct, meses) {
  const r = tipoAnualPct / 1200;
  if (r === 0) return capital / meses;
  return capital * r / (1 - Math.pow(1 + r, -meses));
}
function mesesParaCuota(capital, tipoAnualPct, cuota) {
  const r = tipoAnualPct / 1200;
  if (r === 0) return Math.ceil(capital / cuota);
  if (cuota <= capital * r) return Infinity;
  return Math.ceil(-Math.log(1 - capital * r / cuota) / Math.log(1 + r));
}
function umbralEquilibrio(deudaTotal) {
  return (deudaTotal + CONFIG.gastosVenta.fijos) / (1 - CONFIG.gastosVenta.porcentaje);
}
// Lo que el presupuesto permite pagar dejando un colchón del colchonPct de los ingresos
function cuotaAsumible(ingresos, gastos, deudas) {
  return ingresos - gastos - deudas - ingresos * CONFIG.umbrales.colchonPct;
}
// "deja": vender deja dinero · "cerca": cubre la deuda, no todos los gastos · "quita": no cubre la deuda
function tramoVenta(valor, deudaTotal, umbral) {
  if (valor >= umbral) return "deja";
  if (valor >= deudaTotal) return "cerca";
  return "quita";
}
// decimalPunto: en tipos de interés el punto siempre es decimal ("3.5" = 3,5)
function parseNum(texto, decimalPunto) {
  let v = String(texto).trim().replace(/\s|€|%/g, "");
  if (v === "") return null;
  if (decimalPunto) v = v.replace(",", ".");
  else if (/,/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
// Código de Buenas Prácticas: esfuerzo = cuota hipotecaria / ingresos netos (sin otras deudas)
// "encaja" · "ampliado" (solo con discapacidad, dependencia o enfermedad) · "no" · "noHabitual"
function cbpResultado(cuota, ingresosMes, habitual) {
  if (!habitual) return "noHabitual";
  const C = CONFIG.cbp, esf = cuota / ingresosMes, anual = ingresosMes * 12, iprem = CONFIG.iprem.anual14Pagas;
  if (esf > C.esfuerzoMinimo && anual <= C.ingresosVecesIPREM * iprem) return "encaja";
  if (esf > C.esfuerzoMinimoAmpliado && anual <= C.ingresosVecesIPREMAmpliado * iprem) return "ampliado";
  return "no";
}
function validar(d) {
  const R = CONFIG.rangos, fuera = (v, [a, b]) => v != null && (v < a || v > b);
  const avisos = [];
  if (fuera(d.capital, R.capital)) avisos.push("El capital pendiente debería estar entre 1.000 y 2.000.000 €. ¿Puede que sobre o falte un cero?");
  if (fuera(d.anios, R.anios)) avisos.push("Los años que quedan suelen estar entre 1 y 40.");
  if (d.cuota != null && d.capital != null && d.cuota >= d.capital) avisos.push("La cuota mensual debería ser bastante menor que lo que queda por pagar. Revisa las dos cifras.");
  if (d.tipo === "fijo") {
    if (fuera(d.diferencial, R.tipoFijo)) avisos.push("Un tipo fijo suele estar entre 0 y 10 %. Revisa la cifra.");
  } else {
    if (fuera(d.diferencial, R.diferencial)) avisos.push("El diferencial suele estar entre 0 y 6 %. Míralo en tu contrato o recibo.");
    if (fuera(d.indice, R.indice)) avisos.push("El euríbor debería estar entre −1 y 10 %. Revisa la cifra de tu carta de revisión.");
  }
  return avisos;
}
function runTests() {
  const base = { tipo: "variable", capital: 150000, anios: 25, cuota: 650, diferencial: 0.99, indice: 3 };
  const casos = [
    ["asumible con margen", cuotaAsumible(2100, 1000, 150), 740],
    ["asumible sin margen", cuotaAsumible(1500, 1200, 200), -50],
    ["tramo deja", tramoVenta(200000, 151300, 157526), "deja"],
    ["tramo cerca", tramoVenta(155000, 151300, 157526), "cerca"],
    ["tramo quita", tramoVenta(140000, 151300, 157526), "quita"],
    ["parse miles", parseNum("150.000"), 150000],
    ["parse coma tipo", parseNum("0,99", true), 0.99],
    ["parse punto tipo", parseNum("3.5", true), 3.5],
    ["parse 1.500 tipo", parseNum("1.500", true), 1.5],
    ["validar correcto", validar(base).length, 0],
    ["validar capital bajo", validar({ ...base, capital: 500, cuota: 50 }).length, 1],
    ["validar cuota ≥ capital", validar({ ...base, capital: 5000, cuota: 6000 }).length, 1],
    ["validar euríbor 12", validar({ ...base, indice: 12 }).length, 1],
    ["validar fijo 8 %", validar({ ...base, tipo: "fijo", diferencial: 8 }).length, 0],
    ["CBP encaja", cbpResultado(800, 1500, true), "encaja"],
    ["CBP ampliado", cbpResultado(700, 1500, true), "ampliado"],
    ["CBP no llega", cbpResultado(700, 2500, true), "no"],
    ["CBP no habitual", cbpResultado(800, 1500, false), "noHabitual"],
    ["cuota 150k 4% 25a", cuotaFrancesa(150000, 4, 300), 791.76],
    ["cuota tipo 0", cuotaFrancesa(150000, 0, 300), 500],
    ["cuota 120k 3,5% 20a", cuotaFrancesa(120000, 3.5, 240), 695.95],
    ["cuota 180k 4,25% 30a", cuotaFrancesa(180000, 4.25, 360), 885.49],
    ["meses para 700€", mesesParaCuota(150000, 4, 700), 377],
    ["meses para 500€", mesesParaCuota(150000, 4, 500), Infinity],
    ["umbral 180k", umbralEquilibrio(180000), 187113.40]
  ];
  casos.forEach(([n, got, exp]) => {
    const ok = typeof exp === "string" || exp === Infinity ? got === exp : Math.abs(got - exp) < 0.01;
    console[ok ? "log" : "error"]((ok ? "OK  " : "FALLO ") + n, got, exp);
  });
}

const $ = (s) => document.querySelector(s);
const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (n) => new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 0 }).format(n);
// admite "150.000", "150000", "0,99" y "0.99"; en diferencial e índice el punto es decimal
function num(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  return parseNum(el.value, id === "diferencial" || id === "indice");
}
const radio = (name) => (document.querySelector(`input[name=${name}]:checked`) || {}).value;

$("#indice-hint").textContent = CONFIG.euribor.valor != null
  ? `Dato a fecha ${CONFIG.euribor.fecha} (${CONFIG.euribor.fuente}). Si tu carta de revisión dice otro, cámbialo.`
  : "Míralo en la carta de revisión del banco. Si no lo sabes, déjalo en blanco y calculamos con tu cuota actual.";
if (CONFIG.euribor.valor != null) $("#indice").value = String(CONFIG.euribor.valor).replace(".", ",");
$("#cartas-aviso").textContent = CONFIG.cartas.revisadas ? "" : "Modelo orientativo: el texto de estas cartas no lo ha revisado un abogado.";

function syncTipo() {
  const fijo = radio("tipo") === "fijo";
  $("#campo-indice").hidden = fijo;
}
document.querySelectorAll("input[name=tipo]").forEach((r) => r.addEventListener("change", syncTipo));
syncTipo();

/* =====================================================================
   Diagnóstico
   ===================================================================== */
const FASES = {
  aldia:         { prioridad: 6, texto: "al día" },
  dificultades:  { prioridad: 5, texto: "al día, con dificultades" },
  impagos:       { prioridad: 4, texto: "con impagos" },
  requerimiento: { prioridad: 3, texto: "con requerimiento del banco" },
  demanda:       { prioridad: 2, texto: "con demanda judicial" },
  subasta:       { prioridad: 1, texto: "con subasta señalada" }
};
let caso = null;

function calcular() {
  const d = {
    fase: radio("fase"), tipo: radio("tipo"),
    capital: num("capital"), anios: num("anios"), cuota: num("cuota"),
    diferencial: num("diferencial"), indice: num("indice"),
    ingresos: num("ingresos"), gastos: num("gastos"),
    deudas: num("deudas") || 0, ahorro: num("ahorro") || 0,
    impagadas: num("impagadas") || 0, demora: num("demora") || 0,
    estimacion: num("estimacion"), habitual: $("#habitual").value,
    fechaSubasta: $("#fecha-subasta").value
  };
  const faltan = [];
  if (!d.capital) faltan.push("lo que te queda por pagar");
  if (!d.anios) faltan.push("los años que te quedan");
  if (!d.cuota) faltan.push("la cuota actual");
  if (!d.ingresos) faltan.push("los ingresos");
  if (d.gastos == null) faltan.push("los gastos básicos");
  if (d.tipo !== "variable" && d.tipo !== "mixto" && d.diferencial == null) faltan.push("tu tipo de interés");
  if (faltan.length) return { error: "Para calcular nos falta: " + faltan.join(", ") + "." };
  const avisos = validar(d);
  if (avisos.length) return { error: avisos.join(" ") };

  const meses = Math.round(d.anios * 12);
  const supuestos = [`Sistema francés (cuota constante), ${meses} meses restantes y capital de ${eur(d.capital)}.`];

  // Cuota tras la revisión
  let cuotaNueva = d.cuota, tipoNuevo = null;
  if (d.tipo === "fijo") {
    supuestos.push("Hipoteca fija: la cuota no cambia con el euríbor.");
  } else if (d.indice != null && d.diferencial != null) {
    tipoNuevo = d.indice + d.diferencial;
    cuotaNueva = cuotaFrancesa(d.capital, tipoNuevo, meses);
    supuestos.push(`Tipo tras la revisión = euríbor ${d.indice.toLocaleString("es-ES")} % + diferencial ${d.diferencial.toLocaleString("es-ES")} % = ${tipoNuevo.toLocaleString("es-ES", { maximumFractionDigits: 3 })} %.`);
    if (d.tipo === "mixto") supuestos.push("Hipoteca mixta: este cálculo vale para cuando acabe el tramo fijo.");
  } else {
    supuestos.push("Sin euríbor o diferencial: usamos tu cuota actual como cuota tras la revisión.");
  }

  const pagos = cuotaNueva + d.deudas;
  const esfuerzo = pagos / d.ingresos;
  const margen = d.ingresos - d.gastos - pagos;
  const aguante = margen >= 0 ? Infinity : d.ahorro / -margen;
  const deudaTotal = d.capital + d.impagadas * d.cuota + d.demora;
  const umbral = umbralEquilibrio(deudaTotal);
  supuestos.push(`Tasa de esfuerzo = (cuota + otras deudas) / ingresos netos. Referencias usadas: tensión por encima del ${pct(CONFIG.umbrales.esfuerzoTension)}, riesgo por encima del ${pct(CONFIG.umbrales.esfuerzoRiesgo)}.`);
  supuestos.push(`Deuda total estimada = capital + cuotas impagadas + demora y costas = ${eur(deudaTotal)}. La cifra real está en el certificado de deuda del banco.`);
  supuestos.push("Código de Buenas Prácticas: el Código calcula los ingresos a su manera; aquí comparamos con tus ingresos netos de 12 meses, así que el resultado es orientativo.");
  supuestos.push(`Gastos de venta supuestos: ${pct(CONFIG.gastosVenta.porcentaje)} del precio + ${eur(CONFIG.gastosVenta.fijos)}.`);

  // Semáforo
  const fp = FASES[d.fase].prioridad;
  let estado;
  if (fp <= 3) estado = "urgente";
  else if (fp === 4 || esfuerzo > CONFIG.umbrales.esfuerzoRiesgo || aguante < CONFIG.umbrales.mesesRiesgo) estado = "riesgo";
  else if (esfuerzo > CONFIG.umbrales.esfuerzoTension || margen < 0) estado = "tension";
  else estado = "estable";

  // Cuota asumible (para negociar) y plazo necesario
  const asumible = cuotaAsumible(d.ingresos, d.gastos, d.deudas);
  supuestos.push(`Cuota asumible = ingresos − gastos básicos − otras deudas − un colchón del ${pct(CONFIG.umbrales.colchonPct)} de los ingresos = ${eur(asumible)}.`);
  const tipoCalc = tipoNuevo != null ? tipoNuevo : (d.tipo === "fijo" && d.diferencial != null ? d.diferencial : null);
  const cuotaAmpliada = tipoCalc != null ? cuotaFrancesa(d.capital, tipoCalc, meses + CONFIG.ampliacionAnios * 12) : null;

  return { d, meses, cuotaNueva, tipoNuevo, esfuerzo, margen, aguante, deudaTotal, umbral, estado, cuotaAsumible: asumible, cuotaAmpliada, supuestos };
}

const ESTADOS = {
  estable: ["Estable", "Con estos números llegas a fin de mes. Vigila la próxima revisión y guarda un colchón."],
  tension: ["En tensión", "La hipoteca pesa más de lo recomendable. Hay margen para ajustar y negociar antes de que vaya a más."],
  riesgo:  ["En riesgo", "Si nada cambia, te va a costar sostener los pagos. Es buen momento para mover ficha: cuanto antes, más opciones."],
  urgente: ["Hay que actuar ya", "Tu caso tiene plazos en marcha. Siguen existiendo salidas: contacta con nosotros cuanto antes y te acompañamos a un abogado especialista."]
};

function pintar(c) {
  const { d } = c;
  const [tit, txt] = ESTADOS[c.estado];
  const st = $("#res-estado");
  st.className = "status st-" + c.estado;
  st.querySelector("strong").textContent = tit;
  st.querySelector("p").textContent = txt;

  $("#r-cuota").textContent = eur(c.cuotaNueva) + "/mes";
  const dif = c.cuotaNueva - d.cuota;
  $("#r-cuota-txt").textContent = d.tipo === "fijo" ? "Tu cuota es fija." :
    Math.abs(dif) < 1 ? "Similar a la actual." : (dif > 0 ? `${eur(dif)} más que ahora.` : `${eur(-dif)} menos que ahora.`);

  if (c.aguante === Infinity) {
    $("#r-aguante").textContent = "Cubres los gastos";
    $("#r-aguante-txt").textContent = `Te sobran unos ${eur(c.margen)} al mes tras gastos y deudas.`;
  } else {
    const m = Math.floor(c.aguante);
    $("#r-aguante").textContent = m < 1 ? "Menos de 1 mes" : `${m} ${m === 1 ? "mes" : "meses"}`;
    $("#r-aguante-txt").textContent = `Te faltan unos ${eur(-c.margen)} al mes; tu ahorro lo cubriría ese tiempo.`;
  }

  $("#r-esfuerzo").textContent = pct(c.esfuerzo);
  $("#r-esfuerzo-txt").textContent = "De tus ingresos se va en la hipoteca y otras deudas.";

  $("#r-umbral").textContent = eur(c.umbral);
  $("#r-umbral-txt").textContent = d.estimacion
    ? `Si tu vivienda vale más, una venta ordenada te dejaría dinero; si vale menos, hay otras salidas. Tu estimación: ${eur(d.estimacion)}.`
    : "Si tu vivienda vale más, una venta ordenada te dejaría dinero; si vale menos, hay otras salidas. Valor: pendiente de valoración.";

  $("#r-supuestos").innerHTML = "";
  c.supuestos.forEach((s) => { const li = document.createElement("li"); li.textContent = s; $("#r-supuestos").appendChild(li); });

  pintarEscalera(c);
  pintarComparador(c);
  $("#campo-fecha-subasta").hidden = d.fase !== "subasta";
  $("#m-valoracion").classList.toggle("highlight", c.estado === "riesgo" || c.estado === "urgente");
}

function pintarEscalera(c) {
  const { d } = c;
  const fp = FASES[d.fase].prioridad;
  const conImpagos = fp <= 4;
  const valor = d.estimacion;
  const tramo = valor == null ? null : tramoVenta(valor, c.deudaTotal, c.umbral);
  const cbp = cbpResultado(c.cuotaNueva, d.ingresos, d.habitual === "si");
  const pasos = [
    ["Diagnóstico", "Hecho", true, "Lo tienes arriba. Para afinar la deuda total, pide el certificado de deuda con la carta A."],
    ["Ajustes propios",
      c.margen >= 0 ? "Encaja" : "A valorar",
      c.margen >= 0 || -c.margen < d.ingresos * 0.1,
      c.margen >= 0 ? "Llegas a fin de mes; revisar gastos te da colchón." :
        (-c.margen < d.ingresos * 0.1 ? `El desfase (${eur(-c.margen)}/mes) es pequeño: ajustar gastos puede bastar.` :
          `El desfase (${eur(-c.margen)}/mes) es grande para cubrirlo solo recortando gastos.`) +
        (d.ahorro > (d.gastos + c.cuotaNueva) * CONFIG.umbrales.colchonMeses ? " Tienes ahorro por encima de un colchón razonable: amortizar una parte podría compensar." : "")],
    ["Negociar con el banco", c.cuotaAsumible <= 0 ? "A valorar" : "Encaja", c.cuotaAsumible > 0,
      (c.cuotaAsumible <= 0
        ? "Con estos números no queda margen para ninguna cuota tras los gastos básicos. Puedes pedir carencia y ampliación de plazo con la carta B, pero conviene mirar ya las salidas 6 a 9 y hablar con nosotros (más abajo, en «Hablar con nosotros»)."
        : c.cuotaAsumible >= c.cuotaNueva
          ? `Tu presupuesto permite asumir la cuota tras la revisión (te quedaría margen para unos ${eur(c.cuotaAsumible)}/mes). Ahora conviene pedir la documentación con la carta A, no negociar con la B.`
          : (c.cuotaAmpliada ? `Ampliando el plazo ${CONFIG.ampliacionAnios} años, la cuota quedaría en unos ${eur(c.cuotaAmpliada)}/mes. ` : "") +
            `Una cuota que podrías asumir rondaría los ${eur(c.cuotaAsumible)}/mes. La carta B sirve para pedirlo por escrito.`) +
      (fp <= 2 ? " Con el procedimiento en marcha, hazlo junto a tu abogado." : "")],
    ["Medidas públicas (Código de Buenas Prácticas)",
      cbp === "encaja" ? "Puede encajar" : cbp === "noHabitual" ? "No parece encajar" : "A valorar",
      cbp === "encaja" || cbp === "ampliado",
      cbp === "noHabitual" ? "Está pensado para la vivienda habitual." :
        cbp === "encaja" ? "Puede encajar. Pregunta a tu banco si está adherido (carta A)." :
        cbp === "ampliado" ? "Puede encajar si en tu familia hay discapacidad, dependencia o una enfermedad que impida trabajar. Pregunta a tu banco si está adherido (carta A)." :
        "Por tus datos, parece que no llegas a los requisitos. Si tu situación ha cambiado, pregúntalo igualmente."],
    ["Cambiar de banco",
      conImpagos || c.esfuerzo > CONFIG.umbrales.esfuerzoRiesgo ? "No parece encajar" : "A valorar",
      !(conImpagos || c.esfuerzo > CONFIG.umbrales.esfuerzoRiesgo),
      conImpagos ? "Con impagos, otra entidad difícilmente aceptará la hipoteca." :
        c.esfuerzo > CONFIG.umbrales.esfuerzoRiesgo ? "Con esta tasa de esfuerzo es difícil que otro banco la acepte." :
        "Compara ofertas: solo compensa si mejoran las condiciones después de gastos."],
    ["Vender a tiempo",
      tramo === "deja" ? "Encaja" : "A valorar",
      tramo == null || tramo === "deja",
      tramo == null ? `Por encima de ${eur(c.umbral)}, vender te dejaría dinero. Valor: pendiente de valoración.` :
        tramo === "deja" ? `Con tu estimación, una venta ordenada te dejaría unos ${eur(valor * (1 - CONFIG.gastosVenta.porcentaje) - CONFIG.gastosVenta.fijos - c.deudaTotal)}.` :
        tramo === "cerca" ? "Con tu estimación, la venta cubre la deuda, pero no todos los gastos de venta: el resultado quedaría cerca de cero." :
        "Con tu estimación no se cubre la deuda: solo habría operación si el banco acepta una quita y perdona el resto por escrito."],
    ["Fórmulas para seguir en la vivienda", "A valorar", false, "Alquiler posterior u opción de recompra: solo con el contrato revisado por un abogado."],
    ["Dación en pago o acuerdo de cancelación",
      valor != null && valor < c.deudaTotal ? "A valorar" : "Después de lo anterior",
      valor != null && valor < c.deudaTotal,
      "Entregas la vivienda y el banco cancela la deuda, si lo acepta. Pide siempre por escrito que la deuda queda saldada."],
    ["Segunda oportunidad", "Después de lo anterior", false, "Si las deudas no se pueden pagar ni con la venta, existe este procedimiento judicial. Necesitas abogado; podemos acompañarte a uno especialista."]
  ];
  const ol = $("#r-escalera");
  ol.innerHTML = "";
  pasos.forEach(([t, tag, si, txt]) => {
    const li = document.createElement("li");
    const s = document.createElement("strong"); s.textContent = t;
    const g = document.createElement("span"); g.className = "tag" + (si ? " si" : ""); g.textContent = tag;
    const p = document.createElement("p"); p.className = "small"; p.style.margin = "4px 0 0"; p.textContent = txt;
    li.append(s, g, p); ol.appendChild(li);
  });
}

function pintarComparador(c) {
  const v = c.d.estimacion;
  const pend = "Pendiente de valoración";
  const neto = v != null ? v * (1 - CONFIG.gastosVenta.porcentaje) - CONFIG.gastosVenta.fijos - c.deudaTotal : null;
  const tramo = v == null ? null : tramoVenta(v, c.deudaTotal, c.umbral);
  const filas = [
    ["Seguir pagando (renegociado)", "La conservas", `Sigue: ${eur(c.deudaTotal)}`, c.cuotaAmpliada ? `Cuota de unos ${eur(c.cuotaAmpliada)}/mes si amplías ${CONFIG.ampliacionAnios} años` : "Depende de lo que acepte el banco"],
    ["Venta ordenada", "La vendes", "Se cancela en la firma si el precio la cubre",
      tramo == null ? pend :
      tramo === "deja" ? `Unos ${eur(neto)} (tu estimación)` :
      tramo === "cerca" ? "Cubre la deuda, pero no todos los gastos de venta: el resultado quedaría cerca de cero" :
      `Faltarían unos ${eur(-neto)}: solo con quita y condonación por escrito`],
    ["Compra con cancelación de deuda", "La vendes", "Se cancela en la firma",
      "Precio de la oferta menos la deuda total. Suele ser menos que en una venta ordenada, porque el comprador busca un beneficio; a cambio, es más rápida y con plazos seguros. Compara siempre las dos cifras por escrito."],
    ["Dación en pago", "Pasa al banco", "Se cancela si el banco la acepta como pago total", "Sin vivienda y sin deuda; normalmente sin dinero"],
    ["Subasta (si no se actúa)", "Se adjudica, a menudo por debajo de su valor", "Puede quedar deuda pendiente", "Riesgo de embargos y ficheros de morosidad"]
  ];
  const tb = $("#t-comparador tbody");
  const cabeceras = ["Salida", "Vivienda", "Deuda", "Con qué te quedas"];
  tb.innerHTML = "";
  filas.forEach((f) => {
    const tr = document.createElement("tr");
    f.forEach((x, i) => { const td = document.createElement(i === 0 ? "th" : "td"); if (i === 0) td.scope = "row"; td.dataset.label = cabeceras[i]; td.textContent = x; tr.appendChild(td); });
    tb.appendChild(tr);
  });
  $("#comparador-nota").textContent = v == null
    ? "Añade «tu estimación» en «Tu vivienda» para ver cifras, o pide nuestra valoración. Antes de firmar puedes pedir una tasación independiente."
    : "Cifras con tu estimación del valor, no con una valoración. Antes de firmar puedes pedir una tasación independiente. Puede haber impuestos (plusvalía municipal, IRPF): consúltalo con un asesor fiscal.";
}

$("#f-diag").addEventListener("submit", (e) => {
  e.preventDefault();
  const c = calcular();
  if (c.error) { $("#diag-error").textContent = c.error; $("#diag-error").hidden = false; return; }
  $("#diag-error").hidden = true;
  caso = c;
  pintar(c);
  $("#resultados").hidden = false;
  $("#res-titulo").focus();
  if (window.EuporiaMedir) window.EuporiaMedir("herramienta_completada", { herramienta: "diagnostico" });
  $("#resultados").scrollIntoView({ behavior: "smooth" });
});
// Los módulos recalculan al cambiar
["impagadas", "demora", "estimacion", "habitual", "fecha-subasta"].forEach((id) =>
  document.getElementById(id).addEventListener("change", () => { if (caso) { caso = calcular(); if (!caso.error) pintar(caso); } }));

$("#v-consent").addEventListener("change", (e) => { $("#v-ubicacion").hidden = !e.target.checked; if (!e.target.checked) $("#v-ref").value = ""; });

/* =====================================================================
   Cartas al banco · plantillas cerradas: solo se rellenan variables
   ===================================================================== */
function hoy() { return new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }); }
const PLANTILLAS = {
  A: (v) => `${v.localidad}, a ${v.fecha}

A la atención de ${v.entidad}

Asunto: Solicitud de documentación sobre mi préstamo hipotecario

Yo, ${v.nombre}, con DNI ________________, titular del préstamo hipotecario n.º ________________, solicito que me faciliten la siguiente documentación:

1. Certificado de deuda actualizado, con el desglose de capital pendiente, cuotas vencidas y no pagadas, intereses ordinarios y de demora, comisiones y gastos.
2. Cuadro de amortización vigente.
3. Fecha de la próxima revisión del tipo de interés y cálculo de la cuota resultante.
4. Indicación de si la entidad está adherida al Código de Buenas Prácticas para la reestructuración viable de las deudas con garantía hipotecaria sobre la vivienda habitual.

Ruego que me la remitan por escrito a la dirección o correo indicados abajo.

Atentamente,

Firma: ________________
Dirección o correo de contacto: ________________
`,
  B: (v) => `${v.localidad}, a ${v.fecha}

A la atención de ${v.entidad}

Asunto: Solicitud de estudio de nuevas condiciones de mi préstamo hipotecario

Yo, ${v.nombre}, con DNI ________________, titular del préstamo hipotecario n.º ________________, ${v.variante === "asumible"
  ? "les solicito que estudien las opciones disponibles para adaptar las condiciones de mi préstamo a la situación de mi unidad familiar."
  : `les comunico que la cuota ${v.cuotaFrase} supera lo que mi unidad familiar puede asumir con sus ingresos actuales.`}
${v.variante === "normal" ? `
Según mis cálculos, podemos asumir una cuota de aproximadamente ${v.cuotaAsumible} al mes.
` : ""}
Solicito que estudien ${v.variante === "sinMargen" ? `estas medidas:

1. Un periodo de carencia.
2. Ampliación del plazo del préstamo.` : `alguna de estas medidas:

1. Ampliación del plazo del préstamo.
2. Un periodo de carencia.
3. Novación de las condiciones, incluido el paso a tipo fijo o mixto.`}

Quedo a su disposición para aportar la documentación que necesiten y les ruego que me respondan por escrito.

Atentamente,

Firma: ________________
Dirección o correo de contacto: ________________
`
};
let cartaActual = null;
document.querySelectorAll("[data-carta]").forEach((b) => b.addEventListener("click", () => {
  const v = {
    localidad: $("#c-localidad").value.trim() || "________________",
    fecha: hoy(),
    entidad: $("#c-entidad").value.trim() || "________________",
    nombre: $("#c-nombre").value.trim() || "________________",
    cuotaFrase: caso ? (caso.d.tipo !== "fijo" && Math.round(caso.cuotaNueva) !== Math.round(caso.d.cuota)
      ? `prevista tras la próxima revisión, de ${eur(caso.cuotaNueva)} al mes,` : `actual, de ${eur(caso.d.cuota)} al mes,`) : "actual",
    cuotaAsumible: caso ? eur(caso.cuotaAsumible) : "________ €",
    // "asumible": el presupuesto cubre la cuota · "sinMargen": no queda margen · "normal": cuota con cifra
    variante: !caso ? "normal" : caso.cuotaAsumible <= 0 ? "sinMargen" : caso.cuotaAsumible >= caso.cuotaNueva ? "asumible" : "normal"
  };
  cartaActual = b.dataset.carta;
  const aviso = $("#carta-aviso-caso");
  aviso.hidden = !(cartaActual === "B" && v.variante !== "normal");
  aviso.textContent = v.variante === "asumible"
    ? "Con tus números puedes asumir la cuota tras la revisión. Ahora conviene la carta A (pedir documentación), no la B."
    : "Con tus números no queda margen para ninguna cuota. La carta B pide carencia y ampliación de plazo, sin cifra; conviene mirar también las salidas 6 a 9 y hablar con nosotros.";
  $("#carta-texto").textContent = PLANTILLAS[cartaActual](v);
  $("#carta-out").hidden = false;
}));
$("#carta-descargar").addEventListener("click", () => {
  const blob = new Blob([$("#carta-texto").textContent], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `carta-${cartaActual}-banco.txt`;
  a.click();
  if (window.EuporiaMedir) window.EuporiaMedir("carta_descargada");
  URL.revokeObjectURL(a.href);
});

/* =====================================================================
   Resumen opcional: solo si la persona marca la casilla «Adjuntar»
   ===================================================================== */
function resumenCaso() {
  if (!caso || caso.error) return "";
  return [
    "Fase: " + FASES[caso.d.fase].texto,
    caso.d.fechaSubasta ? "Fecha de subasta: " + caso.d.fechaSubasta : "",
    "Cuota actual: " + Math.round(caso.d.cuota) + " €",
    "Cuota tras revisión: " + Math.round(caso.cuotaNueva) + " €",
    "Esfuerzo: " + Math.round(caso.esfuerzo * 100) + " %",
    "Deuda estimada: " + Math.round(caso.deudaTotal) + " €",
    "Umbral de venta: " + Math.round(caso.umbral) + " €"
  ].filter(Boolean).join(" · ");
}
// En fase de captura: rellena el resumen antes de que app.js lea el formulario
document.addEventListener("submit", (e) => {
  const oculto = e.target.querySelector && e.target.querySelector('input[name="resumen"]');
  if (!oculto) return;
  const marca = e.target.querySelector("[data-adjuntar]");
  oculto.value = marca && marca.checked ? resumenCaso() : "";
}, true);

if (location.hash === "#test") runTests();
})();
