/* =====================================================================
   Euporia · calculadoras de hipoteca inversa y nuda propiedad
   Se montan en #calc-inversa y #calc-nuda (contenido/familias-*.html).
   Hacen las cuentas en el navegador: no envían ni guardan nada.

   Todos los supuestos están en MODELO, justo debajo. Si cambias alguno,
   actualiza «Cómo está hecha esta calculadora» en la página correspondiente.
   ===================================================================== */
(() => {
  const SITE = window.EUPORIA || {};

  const MODELO = {
    /* Años de vida esperados (ambos sexos). Curva de Gompertz: riesgo a la edad x = a · e^(b·(x−65)).
       Nivel: 22,0 años a los 65 (Ministerio de Sanidad con datos del INE, 2024).
       Forma: tablas de vida 2024 del CREM de Murcia, por edades de 5 en 5.
       Da 17,7 años a los 70, 13,8 a los 75, 10,3 a los 80, 7,3 a los 85 y 4,9 a los 90. */
    VIDA: { a: 0.00525, b: 0.125 },

    /* Nuda propiedad: precio = valor × e^(−descuento anual × años esperados), con un tope.
       A los 70 años, el 5 % da un 41 %: algo por debajo de la mejor oferta de la prueba de la OCU (46 %, hombre, con menos años de media).
       Con el 2,5 %, las edades de 75 a 85 quedan en el 71 % y el 83 %, cerca del tramo alto del «20-50 % menos» de Consumer. */
    NUDA: { DESCUENTO_BAJO: 0.05, DESCUENTO_ALTO: 0.025, TOPE: 0.90 },

    /* Regla fiscal del usufructo vitalicio: (89 − edad) %, entre el 10 % y el 70 % */
    FISCAL: { BASE: 89, MIN: 0.10, MAX: 0.70 },

    /* Hipoteca inversa */
    INVERSA: {
      INTERES: 6,            // % anual. Santander Mapfre: 5,99 % de media en 2025. Caja de Ingenieros: 4,50 % (ficha de enero de 2025)
      DEUDA_BAJA: 0.50,      // deuda final sobre el valor. Ejemplo publicado de Santander Mapfre sin renta vitalicia
      DEUDA_ALTA: 0.60,      // máximo de la ficha de Caja de Ingenieros (la cartera de Santander Mapfre está en el 57,47 %)
      EDAD_FIN: 94,          // edad hasta la que Santander Mapfre calculó su ejemplo; se usa para la renta vitalicia y el pago único
      PLAZO_MIN: 5,          // años mínimos de cálculo en edades muy altas
      FACTOR_VITALICIA: 5 / 7, // mismo ejemplo: a igual renta, deuda del 50 % sin seguro y del 70 % con seguro
      SUBIDA: 1,             // % anual de subida del valor de la casa, por defecto
      VALOR_MINIMO: 150000   // valor mínimo que pide Santander Mapfre
    }
  };

  /* Años de cobro de la renta temporal según la edad. De 70 en adelante, ficha de Caja de Ingenieros.
     Por debajo de 70 no hay referencia publicada: es una extrapolación. */
  const plazoPorEdad = (edad) => (edad < 70 ? 20 : edad < 75 ? 18 : edad < 80 ? 15 : edad < 85 ? 12 : 10);

  /* ---------- Utilidades ---------- */
  let fmtNum;
  try { fmtNum = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }); }
  catch (e) { fmtNum = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }); }
  const NB = "\u00a0";
  const eur = (n, paso = 100) => fmtNum.format(Math.round(n / paso) * paso) + NB + "€";
  const rango = (a, b, paso = 100) => {
    const x = eur(a, paso), y = eur(b, paso);
    return x === y ? x : `${fmtNum.format(Math.round(a / paso) * paso)} – ${y}`;
  };
  const pc = (p) => Math.round(p * 100) + NB + "%";
  const entero = (v) => {
    const n = parseInt(String(v == null ? "" : v).split(",")[0].replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };
  const decimal = (v) => {
    const n = parseFloat(String(v == null ? "" : v).replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- Modelo ---------- */
  const supervivencia = (x, t) => {
    const { a, b } = MODELO.VIDA;
    return Math.exp(-(a / b) * Math.exp(b * (x - 65)) * (Math.exp(b * t) - 1));
  };
  // Años esperados hasta que falte la última de las personas (una o dos)
  function anosEsperados(x, y) {
    const dt = 0.25;
    let total = 0;
    for (let t = 0; t < 70; t += dt) {
      const sa = (u) => {
        const s1 = supervivencia(x, u);
        if (y == null) return s1;
        const s2 = supervivencia(y, u);
        return s1 + s2 - s1 * s2;
      };
      total += ((sa(t) + sa(t + dt)) / 2) * dt;
    }
    return total;
  }

  function usufructoFiscal(edad) {
    const { BASE, MIN, MAX } = MODELO.FISCAL;
    return clamp((BASE - edad) / 100, MIN, MAX);
  }

  function calcNuda({ edad, edad2, valor, deuda }) {
    const { DESCUENTO_BAJO, DESCUENTO_ALTO, TOPE } = MODELO.NUDA;
    const joven = edad2 == null ? edad : Math.min(edad, edad2);
    const anos = anosEsperados(edad, edad2);
    const pBaja = Math.min(TOPE, Math.exp(-DESCUENTO_BAJO * anos));
    const pAlta = Math.min(TOPE, Math.exp(-DESCUENTO_ALTO * anos));
    const pFiscal = 1 - usufructoFiscal(joven);
    const precioMedio = valor * (pBaja + pAlta) / 2;
    return {
      joven, anos, pBaja, pAlta, pFiscal,
      precioBajo: valor * pBaja, precioAlto: valor * pAlta, precioFiscal: valor * pFiscal,
      precioMedio, diferencia: valor - precioMedio,
      costeMes: (valor - precioMedio) / (12 * anos),
      netoBajo: valor * pBaja - (deuda || 0), netoAlto: valor * pAlta - (deuda || 0)
    };
  }

  // Renta constante que deja una deuda «objetivo» tras n meses
  const rentaPara = (objetivo, i, n) => objetivo * i / (Math.pow(1 + i, n) - 1);
  // Deuda tras m meses con una renta que se cobra durante n meses
  const deudaEn = (renta, i, n, m) => {
    const k = Math.min(m, n);
    return renta * (Math.pow(1 + i, k) - 1) / i * Math.pow(1 + i, m - k);
  };

  function calcInversa({ edad, edad2, valor, plazo, renta, interes, subida }) {
    const M = MODELO.INVERSA;
    const joven = edad2 == null ? edad : Math.min(edad, edad2);
    const i = interes / 100 / 12;
    const anos = plazo || plazoPorEdad(joven);
    const n = anos * 12;
    const rentaBaja = rentaPara(valor * M.DEUDA_BAJA, i, n);
    const rentaAlta = rentaPara(valor * M.DEUDA_ALTA, i, n);
    // Renta vitalicia y pago único: la entidad calcula hasta una edad alta, no hasta un plazo elegido
    const anosLargo = Math.max(M.EDAD_FIN - joven, M.PLAZO_MIN);
    const nLargo = anosLargo * 12;
    const vitBaja = rentaPara(valor * M.DEUDA_BAJA, i, nLargo) * M.FACTOR_VITALICIA;
    const vitAlta = rentaPara(valor * M.DEUDA_ALTA, i, nLargo) * M.FACTOR_VITALICIA;
    const unicoBajo = valor * M.DEUDA_BAJA / Math.pow(1 + i, nLargo);
    const unicoAlto = valor * M.DEUDA_ALTA / Math.pow(1 + i, nLargo);

    const rentaUsada = renta || (rentaBaja + rentaAlta) / 2;
    const edadFinRenta = joven + anos;
    const edadFin = Math.max(100, joven + 10);
    const valorEn = (t) => valor * Math.pow(1 + subida / 100, t);
    const serie = [];
    for (let e = joven; e <= edadFin; e++) {
      const t = e - joven;
      serie.push({ edad: e, deuda: deudaEn(rentaUsada, i, n, t * 12), valor: valorEn(t), cobrado: rentaUsada * Math.min(t * 12, n) });
    }
    const puntos = new Set();
    for (let t = 5; joven + t <= edadFin; t += 5) puntos.add(joven + t);
    puntos.add(edadFinRenta);
    puntos.add(edadFin);
    const filas = [...puntos].filter((e) => e <= edadFin).sort((a, b) => a - b).map((e) => serie[e - joven]);
    const cruce = serie.find((p) => p.edad > joven && p.deuda > p.valor);
    const finRenta = serie[Math.min(anos, serie.length - 1)];
    return {
      joven, anos, n, i, rentaBaja, rentaAlta, vitBaja, vitAlta, unicoBajo, unicoAlto, rentaUsada,
      edadFinRenta, edadFin, serie, filas, cruce, finRenta,
      deudaFinalSobreValor: deudaEn(rentaUsada, i, n, n) / valor,
      interesAnualAlFin: finRenta.deuda * interes / 100
    };
  }

  // Para comprobar el modelo desde la consola del navegador
  window.EuporiaCalculadoras = { MODELO, anosEsperados, usufructoFiscal, calcNuda, calcInversa, plazoPorEdad };

  /* ---------- Piezas comunes de la interfaz ---------- */
  const q = new URLSearchParams(location.search);

  function precargar(form) {
    ["edad", "edad2", "valor"].forEach((k) => {
      const v = q.get(k);
      if (v && form.elements[k]) form.elements[k].value = entero(v) ? fmtNum.format(entero(v)) : "";
    });
  }

  // Mantiene el separador de miles en los campos de euros, sin mover el cursor al escribir
  function formatearAlSalir(form, nombres) {
    nombres.forEach((k) => {
      const c = form.elements[k];
      if (!c) return;
      c.addEventListener("blur", () => { const n = entero(c.value); c.value = n ? fmtNum.format(n) : ""; });
    });
  }

  function acciones(form, resumen, otraParams) {
    const caja = document.getElementById(form.id + "-acciones");
    if (!caja) return;
    caja.hidden = false;
    const wa = caja.querySelector("[data-whatsapp]");
    if (wa) {
      wa.hidden = !SITE.whatsapp;
      wa.onclick = () => window.open(`https://wa.me/${SITE.whatsapp}?text=` + encodeURIComponent(resumen), "_blank", "noopener");
    }
    const imp = caja.querySelector("[data-imprimir]");
    if (imp) imp.onclick = () => {
      document.body.classList.add("calc-imprimir");
      window.print();
    };
    const otra = caja.querySelector("[data-otra]");
    if (otra) {
      const u = new URL(otra.href, location.href);
      Object.entries(otraParams).forEach(([k, v]) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k)));
      u.hash = "calculadora";
      otra.href = u.toString();
    }
  }
  window.addEventListener("afterprint", () => document.body.classList.remove("calc-imprimir"));

  function ocultarAcciones(form) {
    const caja = document.getElementById(form.id + "-acciones");
    if (caja) caja.hidden = true;
  }

  const avisos = (lista) => (lista.length
    ? `<ul class="calc-avisos">${lista.map((t) => `<li>${t}</li>`).join("")}</ul>` : "");

  function montar(form, pintar) {
    const res = document.getElementById(form.id + "-resultado");
    precargar(form);
    formatearAlSalir(form, ["valor", "deuda", "renta"]);
    form.addEventListener("input", pintar);
    form.addEventListener("change", pintar);
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      pintar();
      res.scrollIntoView({ behavior: "smooth", block: "start" });
      res.focus({ preventScroll: true });
    });
    pintar();
  }

  /* ---------- Gráfico: deuda frente a valor de la casa ---------- */
  const COLOR_DEUDA = "#b5541c", COLOR_VALOR = "#1f6aa5";

  function pasoEje(max) {
    for (const c of [10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000, 1000000, 2000000]) {
      if (max / c <= 5) return c;
    }
    return 5000000;
  }

  function dibujarGrafico(cont, c) {
    const W = Math.max(280, cont.clientWidth || 640);
    const estrecho = W < 480;
    const H = estrecho ? 270 : 330;
    const m = { t: 26, r: 12, b: 34, l: estrecho ? 76 : 80 };
    const s = c.serie;
    const e0 = s[0].edad, e1 = s[s.length - 1].edad;
    const maxBruto = Math.max(...s.map((p) => Math.max(p.deuda, p.valor)));
    const paso = pasoEje(maxBruto);
    const maxY = Math.ceil(maxBruto * 1.12 / paso) * paso;   // deja aire arriba para las etiquetas
    const x = (e) => m.l + (e - e0) / (e1 - e0) * (W - m.l - m.r);
    const y = (v) => H - m.b - v / maxY * (H - m.t - m.b);
    const linea = (k) => s.map((p, i) => `${i ? "L" : "M"}${x(p.edad).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(" ");

    let rejilla = "";
    for (let v = 0; v <= maxY + 1; v += paso) {
      rejilla += `<line class="g-rej" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>` +
        `<text class="g-eje" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${eur(v, 1000)}</text>`;
    }
    let ejeX = "";
    const inicioTicks = Math.ceil(e0 / 5) * 5;
    for (let e = inicioTicks; e <= e1; e += 5) {
      ejeX += `<text class="g-eje" x="${x(e)}" y="${H - m.b + 20}" text-anchor="middle">${e}</text>`;
    }
    const fin = s[s.length - 1];
    const yD = y(fin.deuda), yV = y(fin.valor);
    const etiquetas = Math.abs(yD - yV) >= 34;
    const etiqueta = (nombre, val, yy) => {
      const arriba = yy - 8 > m.t + 4;
      return `<text class="g-etq" x="${W - m.r - 6}" y="${arriba ? yy - 9 : yy + 20}" text-anchor="end">${nombre}: ${eur(val, 1000)}</text>`;
    };
    let marca = "";
    if (c.edadFinRenta < e1) {
      const xf = x(c.edadFinRenta);
      const derecha = xf > W * 0.6;
      marca = `<line class="g-marca" x1="${xf}" x2="${xf}" y1="${m.t - 6}" y2="${H - m.b}"/>` +
        `<text class="g-etq-s" x="${derecha ? xf - 6 : xf + 6}" y="${m.t + 4}" text-anchor="${derecha ? "end" : "start"}">Termina la renta (${c.edadFinRenta} años)</text>`;
    }
    const resumen = `Gráfico: la deuda pasa de 0 a ${eur(fin.deuda, 1000)} a los ${fin.edad} años; la casa valdría ${eur(fin.valor, 1000)}. Los datos están en la tabla siguiente.`;

    cont.innerHTML = `
      <div class="calc-leyenda" aria-hidden="true">
        <span><i style="background:${COLOR_DEUDA}"></i>Lo que deberías</span>
        <span><i style="background:${COLOR_VALOR}"></i>Lo que valdría la casa</span>
      </div>
      <div class="calc-grafico-lienzo">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${resumen}" tabindex="0">
          ${rejilla}${ejeX}${marca}
          <path d="${linea("valor")}" fill="none" stroke="${COLOR_VALOR}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          <path d="${linea("deuda")}" fill="none" stroke="${COLOR_DEUDA}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="${x(fin.edad)}" cy="${yV}" r="4" fill="${COLOR_VALOR}" class="g-punto"/>
          <circle cx="${x(fin.edad)}" cy="${yD}" r="4" fill="${COLOR_DEUDA}" class="g-punto"/>
          ${etiquetas ? etiqueta("Casa", fin.valor, yV) + etiqueta("Deuda", fin.deuda, yD) : ""}
          <g class="g-mira" style="display:none">
            <line class="g-cruz" y1="${m.t - 6}" y2="${H - m.b}"/>
            <circle class="g-mira-v g-punto" r="4" fill="${COLOR_VALOR}"/>
            <circle class="g-mira-d g-punto" r="4" fill="${COLOR_DEUDA}"/>
          </g>
          <rect class="g-capa" x="${m.l}" y="${m.t - 6}" width="${W - m.l - m.r}" height="${H - m.t - m.b + 6}" fill="transparent"/>
        </svg>
        <div class="calc-tip" hidden></div>
      </div>`;

    const svg = cont.querySelector("svg"), capa = cont.querySelector(".g-capa");
    const mira = cont.querySelector(".g-mira"), tip = cont.querySelector(".calc-tip");
    let actual = null;
    const mostrar = (edad) => {
      const p = s[clamp(edad, e0, e1) - e0];
      actual = p.edad;
      mira.style.display = "";
      const cx = x(p.edad);
      const cruz = mira.querySelector(".g-cruz");
      cruz.setAttribute("x1", cx); cruz.setAttribute("x2", cx);
      const mv = mira.querySelector(".g-mira-v"), md = mira.querySelector(".g-mira-d");
      mv.setAttribute("cx", cx); mv.setAttribute("cy", y(p.valor));
      md.setAttribute("cx", cx); md.setAttribute("cy", y(p.deuda));
      tip.hidden = false;
      tip.innerHTML = `<b>A los ${p.edad} años</b>
        <span><i style="background:${COLOR_DEUDA}"></i><strong>${eur(p.deuda)}</strong> de deuda</span>
        <span><i style="background:${COLOR_VALOR}"></i><strong>${eur(p.valor)}</strong> vale la casa</span>
        <span class="t-s">Has cobrado ${eur(p.cobrado)}</span>`;
      const anchoTip = tip.offsetWidth || 170;
      tip.style.left = clamp(cx - anchoTip / 2, 0, W - anchoTip) + "px";
      tip.style.top = Math.max(0, Math.min(y(p.deuda), y(p.valor)) - (tip.offsetHeight || 92) - 12) + "px";
    };
    const ocultar = () => { mira.style.display = "none"; tip.hidden = true; actual = null; };
    const edadDesde = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      return Math.round(e0 + (px - m.l) / (W - m.l - m.r) * (e1 - e0));
    };
    capa.addEventListener("pointermove", (ev) => mostrar(edadDesde(ev)));
    capa.addEventListener("pointerdown", (ev) => mostrar(edadDesde(ev)));
    capa.addEventListener("pointerleave", ocultar);
    svg.addEventListener("focus", () => mostrar(c.edadFinRenta <= e1 ? c.edadFinRenta : e1));
    svg.addEventListener("blur", ocultar);
    svg.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        ev.preventDefault();
        mostrar((actual == null ? e0 : actual) + (ev.key === "ArrowLeft" ? -1 : 1));
      }
    });
  }

  /* ---------- Hipoteca inversa ---------- */
  const formInversa = document.getElementById("calc-inversa");
  if (formInversa) {
    const res = document.getElementById("calc-inversa-resultado");
    const f = formInversa.elements;
    let ultimo = null;
    if (!f.interes.value) f.interes.value = String(MODELO.INVERSA.INTERES).replace(".", ",");
    if (!f.subida.value) f.subida.value = String(MODELO.INVERSA.SUBIDA).replace(".", ",");

    const pintar = () => {
      const edad = entero(f.edad.value), edad2 = entero(f.edad2.value), valor = entero(f.valor.value);
      const dosValida = edad2 != null && edad2 >= 55 && edad2 <= 105;
      if (!edad || edad < 55 || edad > 105 || !valor || valor < 20000) {
        ultimo = null;
        ocultarAcciones(formInversa);
        res.innerHTML = `<div class="calc-vacio"><p>Escribe tu edad y el valor aproximado de la casa. Aquí verás cuánto podrías cobrar y, sobre todo, cómo crecería la deuda año a año.</p></div>`;
        return;
      }
      const datos = {
        edad, edad2: dosValida ? edad2 : null, valor,
        plazo: entero(f.plazo.value) || null,
        renta: entero(f.renta.value) || null,
        interes: clamp(decimal(f.interes.value) || MODELO.INVERSA.INTERES, 0.5, 15),
        subida: clamp(decimal(f.subida.value) == null ? MODELO.INVERSA.SUBIDA : decimal(f.subida.value), 0, 10)
      };
      const c = calcInversa(datos);
      ultimo = c;
      const M = MODELO.INVERSA;
      const lista = [];
      if (c.joven < 65) lista.push("<strong>La ley pide 65 años o más</strong>, salvo dependencia o discapacidad reconocida de al menos el 33 %. Estas cifras solo te sirven si estás en alguno de esos casos.");
      else if (c.joven < 70) lista.push("Alguna entidad solo trabaja a partir de 70 años. Con menos edad la renta es más baja y hay menos opciones.");
      if (valor < M.VALOR_MINIMO) lista.push(`Alguna entidad pide que la vivienda valga más de ${eur(M.VALOR_MINIMO)} y esté en una zona con precios estables. Por debajo de ese valor hay menos opciones.`);
      if (datos.renta && datos.renta > c.rentaAlta * 1.02) lista.push(`Los ${eur(datos.renta, 10)} al mes que has escrito quedan por encima de lo que calculamos: al terminar la renta deberías el ${pc(c.deudaFinalSobreValor)} del valor de hoy, y las entidades no suelen pasar del 60 ${"%"}.`);

      const textoRenta = datos.renta ? `con la renta de ${eur(datos.renta, 10)} al mes que has escrito` : `con una renta de ${eur(c.rentaUsada, 10)} al mes, el punto medio`;
      const filas = c.filas.map((p) => {
        const queda = p.valor - p.deuda;
        const fin = p.edad === c.edadFinRenta ? ` class="calc-fila-fin"` : "";
        return `<tr${fin}><th scope="row">${p.edad}${p.edad === c.edadFinRenta ? " <small>fin de la renta</small>" : ""}</th><td>${eur(p.cobrado)}</td><td><strong>${eur(p.deuda)}</strong></td><td>${eur(p.valor)}</td><td>${queda > 0 ? eur(queda) : "Nada"}</td></tr>`;
      }).join("");

      const cruceTxt = c.cruce
        ? `<p>A partir de los <strong>${c.cruce.edad} años</strong> la deuda superaría lo que vale la casa. Tus herederos no tendrían que poner dinero de su bolsillo: la entidad solo puede cobrar hasta donde lleguen los bienes de la herencia.</p>`
        : "";

      res.innerHTML = `
        <div class="calc-hero">
          <p class="calc-lbl">Podrías cobrar, de forma orientativa</p>
          <p class="calc-big">${rango(c.rentaBaja, c.rentaAlta, 10)} <small>al mes</small></p>
          <p class="calc-sub">Durante ${c.anos} años, hasta los ${c.edadFinRenta}${datos.edad2 != null ? " (tomamos la edad de la persona más joven)" : ""}. No es una oferta: cada entidad decide con su tasación y sus tablas.</p>
        </div>
        ${avisos(lista)}
        <div class="calc-cajas">
          <div class="calc-caja"><span class="bl">Renta durante ${c.anos} años</span><span class="bv">${rango(c.rentaBaja, c.rentaAlta, 10)}</span><small>al mes; al terminar dejas de cobrar</small></div>
          <div class="calc-caja"><span class="bl">Renta de por vida, con seguro</span><span class="bv">≈ ${rango(c.vitBaja, c.vitAlta, 10)}</span><small>al mes; más baja, pero no se acaba</small></div>
          <div class="calc-caja"><span class="bl">Todo de una vez</span><span class="bv">≈ ${rango(c.unicoBajo, c.unicoAlto, 1000)}</span><small>es lo que más intereses acumula</small></div>
        </div>

        <h3 class="calc-h">Cómo crecería la deuda</h3>
        <p class="calc-p">Esto es lo que hay que mirar antes de decidir. Lo calculamos ${textoRenta}, al ${String(datos.interes).replace(".", ",")} % de interés.</p>
        <div class="calc-grafico" id="calc-inversa-grafico"></div>
        <div class="calc-tabla-marco">
          <table class="calc-tabla">
            <thead><tr><th scope="col">Edad</th><th scope="col">Has cobrado</th><th scope="col">Debes</th><th scope="col">Vale la casa</th><th scope="col">Queda tras pagar</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
        <div class="calc-claves">
          <p>A los ${c.edadFinRenta} años habrías cobrado <strong>${eur(c.finRenta.cobrado)}</strong> y deberías <strong>${eur(c.finRenta.deuda)}</strong>. La diferencia son intereses, que a su vez generan más intereses.</p>
          <p>Después dejas de cobrar y sigues en tu casa, pero la deuda sigue creciendo: unos <strong>${eur(c.interesAnualAlFin)} más al año</strong> al principio.</p>
          ${cruceTxt}
        </div>`;

      dibujarGrafico(document.getElementById("calc-inversa-grafico"), c);

      const resumen = "Hola, he usado la calculadora de hipoteca inversa de Euporia y me gustaría comentarla.\n\n" +
        `Edad: ${edad}${datos.edad2 != null ? " y " + datos.edad2 : ""}\nValor aproximado de la casa: ${eur(valor)}\n` +
        `Renta orientativa: ${rango(c.rentaBaja, c.rentaAlta, 10)} al mes durante ${c.anos} años\n` +
        `Deuda al terminar la renta: ${eur(c.finRenta.deuda)}`;
      acciones(formInversa, resumen, { edad, edad2: datos.edad2, valor });
    };
    montar(formInversa, pintar);

    let anchoPrevio = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === anchoPrevio) return;
      anchoPrevio = window.innerWidth;
      const g = document.getElementById("calc-inversa-grafico");
      if (g && ultimo) dibujarGrafico(g, ultimo);
    });
  }

  /* ---------- Nuda propiedad ---------- */
  const formNuda = document.getElementById("calc-nuda");
  if (formNuda) {
    const res = document.getElementById("calc-nuda-resultado");
    const f = formNuda.elements;

    const pintar = () => {
      const edad = entero(f.edad.value), edad2 = entero(f.edad2.value), valor = entero(f.valor.value);
      const deuda = entero(f.deuda.value) || 0, habitual = f.habitual.value === "si";
      const dosValida = edad2 != null && edad2 >= 55 && edad2 <= 105;
      if (!edad || edad < 55 || edad > 105 || !valor || valor < 20000) {
        ocultarAcciones(formNuda);
        res.innerHTML = `<div class="calc-vacio"><p>Escribe tu edad y el valor aproximado de la casa. Aquí verás una horquilla de lo que suele ofrecer el mercado y lo que calcula Hacienda, que son dos cifras muy distintas.</p></div>`;
        return;
      }
      const datos = { edad, edad2: dosValida ? edad2 : null, valor, deuda };
      const c = calcNuda(datos);
      const lista = [];
      if (c.joven < 65) lista.push("Por debajo de 65 años hay pocos compradores y la ganancia de la venta puede pagar IRPF. Si te falta poco para cumplirlos, puede compensar esperar.");
      if (deuda && c.netoAlto <= 0) lista.push("Lo que debes es más de lo que te pagarían por la nuda propiedad. Esta salida no resuelve la deuda: mira antes <a class=\"link\" href=\"#opciones\">las otras opciones</a>.");

      let irpf;
      const unoSin = datos.edad2 != null && Math.min(edad, datos.edad2) < 65 && Math.max(edad, datos.edad2) >= 65;
      if (!habitual) irpf = "<strong>IRPF:</strong> si no es tu vivienda habitual, la ganancia paga impuestos. Pide el cálculo a un asesor antes de aceptar un precio.";
      else if (c.joven >= 65) irpf = "<strong>IRPF:</strong> teniendo 65 años o más, la ganancia no paga, siempre que sea tu vivienda habitual y te reserves el usufructo de por vida.";
      else if (unoSin) irpf = "<strong>IRPF:</strong> si solo uno de los dos tiene 65 años, la exención puede no cubrir la parte del otro. Pregúntaselo a un asesor antes de firmar.";
      else irpf = "<strong>IRPF:</strong> por debajo de 65 años la ganancia paga impuestos, salvo dependencia severa o gran dependencia. Pide el cálculo a un asesor.";

      res.innerHTML = `
        <div class="calc-hero">
          <p class="calc-lbl">El mercado podría ofrecerte, de forma orientativa</p>
          <p class="calc-big">${rango(c.precioBajo, c.precioAlto, 1000)}</p>
          <p class="calc-sub">Entre el ${pc(c.pBaja)} y el ${pc(c.pAlta)} de lo que vale la casa hoy. No es una oferta: las diferencias entre compradores son grandes, así que conviene pedir más de una.</p>
        </div>
        ${avisos(lista)}
        <div class="calc-cajas">
          <div class="calc-caja"><span class="bl">Vendiendo la casa entera</span><span class="bv">${eur(valor, 1000)}</span><small>pero tendrías que irte</small></div>
          <div class="calc-caja"><span class="bl">Lo que calcula Hacienda</span><span class="bv">${eur(c.precioFiscal, 1000)}</span><small>el ${pc(c.pFiscal)}; no es lo que suelen pagar</small></div>
          ${deuda ? `<div class="calc-caja"><span class="bl">Te quedaría tras cancelar la deuda</span><span class="bv">${c.netoAlto > 0 ? rango(Math.max(c.netoBajo, 0), c.netoAlto, 1000) : "Nada"}</span><small>con ${eur(deuda, 1000)} pendientes</small></div>` : ""}
        </div>
        <h3 class="calc-h">Lo que te cuesta quedarte en casa</h3>
        <div class="calc-claves">
          <p>Comparado con vender la casa entera, dejarías de ingresar unos <strong>${eur(c.diferencia, 1000)}</strong>. Repartidos en ${String(c.anos.toFixed(1)).replace(".", ",")} años, es como pagar por adelantado unos <strong>${eur(c.costeMes, 10)} al mes</strong> por seguir en tu casa. Compáralo con lo que costaría alquilar algo parecido en tu zona.</p>
          <p class="calc-nota">Esos años son una media estadística para ${datos.edad2 != null ? "dos personas de vuestra edad" : "una persona de tu edad"}, la que usan estos cálculos. No dicen nada de ti ni de tu salud.</p>
          <p>${irpf} La plusvalía municipal sí se paga en cualquier caso.</p>
        </div>`;

      const resumen = "Hola, he usado la calculadora de nuda propiedad de Euporia y me gustaría comentarla.\n\n" +
        `Edad: ${edad}${datos.edad2 != null ? " y " + datos.edad2 : ""}\nValor aproximado de la casa: ${eur(valor)}\n` +
        `Horquilla orientativa: ${rango(c.precioBajo, c.precioAlto, 1000)}`;
      acciones(formNuda, resumen, { edad, edad2: datos.edad2, valor });
    };
    montar(formNuda, pintar);
  }

  /* ---------- Tabla «según la edad» de la guía de nuda propiedad ---------- */
  const porEdad = document.getElementById("nuda-por-edad");
  if (porEdad) {
    const filas = [65, 70, 75, 80, 85, 90].map((e) => {
      const c = calcNuda({ edad: e, edad2: null, valor: 100000, deuda: 0 });
      return `<tr><th scope="row">${e} años</th><td>${pc(c.pBaja)} – ${pc(c.pAlta)}</td><td>${pc(c.pFiscal)}</td></tr>`;
    }).join("");
    porEdad.innerHTML = `<div class="calc-tabla-marco"><table class="calc-tabla calc-tabla-3">
      <thead><tr><th scope="col">Una persona de</th><th scope="col">Horquilla de mercado</th><th scope="col">Cálculo de Hacienda</th></tr></thead>
      <tbody>${filas}</tbody></table></div>`;
  }
})();
