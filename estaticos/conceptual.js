/* =====================================================================
   Euporia · «Lo que vale tu casa, sin contar metros» (valorador conceptual)
   Para el propietario que piensa vender. Describe la vivienda con preguntas
   cerradas y comprobables, agrupadas en siete dimensiones, y devuelve:
     1. su perfil (cada dimensión de 0 a 100),
     2. sus argumentos de venta (las respuestas más altas, en frases de anuncio),
     3. sus frenos (las más bajas), separando lo que se arregla de lo que no,
     4. si el propietario aporta una cifra de partida, un valor orientativo.
   Nunca usa precios por zona ni €/m²: la cifra de partida la escribe siempre
   el propietario (casas parecidas, valor de referencia del Catastro, una
   tasación o el precio que piensa pedir). Supuestos del valor: VALOR.
   Las respuestas se guardan solo en el navegador (localStorage, clave
   euporia_conceptual) y no se envían a ningún sitio. Los botones de WhatsApp
   abren el resumen escrito y la persona decide si lo manda y a quién.
   Si cambias las dimensiones, las preguntas, UMBRAL o VALOR, revisa
   el texto y las preguntas frecuentes de contenido/valorar-mi-casa.html.

   Casos de prueba (se pueden repetir en la consola con
   EuporiaConceptual.calcular({...}) y EuporiaConceptual.valorar(perfil, partida)):
   - Todo con la primera opción → las 7 dimensiones a 100, 0 frenos.
   - Todo con la última opción (salvo «No lo sé»/«No hay») → dimensiones entre 14 y 25, 0 argumentos.
   - Solo luz: sol=0 (100), aire=2 (15) → Luz y aire 57,5 ≈ 58; 1 argumento (sol) y 1 freno (aire, «se mejora con obra»).
   - colegios_fama = «No lo sé» y eventos = «No hay» → contestadas pero no cuentan en la media.
   - Valor: todo a la primera opción + Catastro 200.000 € → índice 100, ajuste +15 % → 230.000 € (221.000–239.000 €).
   - Valor: índice 60 (casa corriente) → ajuste 0 %. Índice 80 → +7,5 %. Índice 20 o menos → −15 %.
   - Casas parecidas: 200.000 € «algo mejor» y 180.000 € «parecida» → 190.000 y 180.000 → central 185.000 €.
   ===================================================================== */
(() => {
  "use strict";
  const form = document.getElementById("vc-form");
  const salida = document.getElementById("vc-resultado");
  if (!form || !salida) return;
  const SITE = window.EUPORIA || {};

  const UMBRAL = { fuerte: 85, freno: 35, minimo: 8 };   // argumento ≥85, freno ≤35, respuestas para ver el perfil
  const NIVEL = [[80, "Punto fuerte"], [60, "Bien"], [40, "Normal"], [0, "A mejorar"]];
  const ARREGLO = {
    poco: ["Se mejora con poco", "Corrígelo antes de enseñar la casa: suele ser lo que más rinde."],
    obra: ["Se mejora con obra", "Pide un presupuesto: así decides si compensa hacerla o lo tienes en cuenta en el precio."],
    no: ["No tiene arreglo", "Cuéntalo con claridad desde el principio y busca al comprador al que no le importa."],
    depende: ["Depende de quién compre", "A unos compradores les atrae y a otros les frena: dilo con naturalidad."]
  };

  /* Cada opción: [texto, puntos (null = no cuenta), frase para el resumen].
     La frase de las opciones altas es un argumento de venta; la de las bajas, un freno. */
  const D = [
    { id: "luz", n: "Luz y aire", d: "Lo que entra por las ventanas", q: [
      { id: "sol", t: "Sol directo en el salón en invierno", a: "obra", o: [
        ["Más de 4 horas", 100, "Sol directo en el salón más de 4 horas en invierno"],
        ["Entre 2 y 4 horas", 70], ["Menos de 2 horas", 35, "Poco sol directo en invierno"],
        ["Casi nunca", 10, "El salón casi no recibe sol directo"]] },
      { id: "aire", t: "¿Corre el aire de una fachada a otra?", a: "obra", o: [
        ["Sí, ventilación cruzada", 100, "Ventilación cruzada: el aire corre de fachada a fachada"],
        ["Solo en parte de la casa", 55], ["No", 15, "Sin ventilación cruzada"]] },
      { id: "vista", t: "Lo que ves desde la ventana principal", a: "no", o: [
        ["Vista abierta: cielo, verde, mar o huerta", 100, "Vistas abiertas desde la ventana principal"],
        ["Una calle amplia", 65], ["Calle estrecha o patio con luz", 35, "Vistas a calle estrecha o patio"],
        ["Patio cerrado o una pared cerca", 10, "La ventana principal da a un patio cerrado o a una pared cercana"]] },
      { id: "altura", t: "Altura de techos y sensación de amplitud", a: "no", o: [
        ["Techos altos, se respira", 100, "Techos altos y sensación de amplitud"],
        ["Normal", 60], ["Techos bajos o sensación de agobio", 20, "Techos bajos"]] }
    ] },
    { id: "calma", n: "Calma", d: "Lo que se oye y lo que se ve desde fuera", q: [
      { id: "noche", t: "¿Se puede dormir con la ventana abierta?", a: "obra", o: [
        ["Sí, sin problema", 100, "Se duerme con la ventana abierta"],
        ["Algunas noches, o con ruido de fondo", 55], ["No, se oye la calle", 10, "Ruido de calle por la noche"]] },
      { id: "vecinos", t: "¿Se oye a los vecinos?", a: "obra", o: [
        ["No se oyen", 100, "No se oye a los vecinos"], ["A veces", 55], ["A menudo", 15, "Se oye a los vecinos a menudo"]] },
      { id: "intimidad", t: "¿Te ven desde los edificios de enfrente?", a: "poco", o: [
        ["No, hay intimidad", 100, "Intimidad: no hay vecinos enfrente que vean el interior"],
        ["Algo, se arregla con cortinas", 55], ["Sí, de cerca", 15, "Poca intimidad: los vecinos de enfrente ven el interior"]] },
      { id: "molestias", t: "Bares, terrazas, carga y descarga u olores junto al portal", a: "no", o: [
        ["Nada de eso", 100, "Sin bares ni actividad molesta junto al portal"],
        ["Algo ocasional", 55], ["Sí, a diario", 15, "Actividad molesta junto al portal a diario"]] }
    ] },
    { id: "vida", n: "La vida que cabe", d: "Lo que se puede hacer dentro, en vez de los metros", q: [
      { id: "teletrabajo", t: "¿Se puede teletrabajar en un cuarto con puerta?", a: "obra", o: [
        ["Sí, hay un cuarto para ello", 100, "Un cuarto con puerta para teletrabajar"],
        ["Hay un rincón tranquilo", 55], ["No", 15, "No hay sitio tranquilo para teletrabajar"]] },
      { id: "mesa", t: "¿Cuántas personas pueden comer sentadas a la vez?", a: "no", o: [
        ["Ocho o más", 100, "Comedor para ocho personas o más"], ["Seis", 75], ["Cuatro", 45],
        ["Menos de cuatro", 15, "Comedor para menos de cuatro personas"]] },
      { id: "exterior", t: "Espacio exterior propio", a: "no", o: [
        ["Terraza o patio donde comer", 100, "Terraza o patio donde comer al aire libre"],
        ["Balcón donde sentarse", 65], ["Balcón pequeño o tendedero", 35],
        ["No hay", 10, "Sin espacio exterior propio"]] },
      { id: "guardar", t: "Sitio para guardar: armarios, trastero, bicis, ropa de otra temporada", a: "obra", o: [
        ["De sobra", 100, "Mucho espacio para guardar"], ["Justo", 55], ["Falta", 15, "Poco espacio para guardar"]] },
      { id: "cambios", t: "¿Se adaptaría a un cambio de vida (un bebé, una persona mayor, otro uso para un cuarto)?", a: "obra", o: [
        ["Con facilidad", 100, "Se adapta con facilidad a cambios de vida"],
        ["Con algún cambio", 55], ["Difícilmente", 15, "Difícil de adaptar a otros usos"]] }
    ] },
    { id: "barrio", n: "Barrio y servicios", d: "Lo que tienes a mano al salir del portal", q: [
      { id: "comercio", t: "Panadería, mercado o supermercado andando", a: "no", o: [
        ["Menos de 5 minutos", 100, "Comercio del día a día a menos de 5 minutos andando"],
        ["De 5 a 10 minutos", 70], ["De 10 a 20 minutos", 35], ["Hace falta el coche", 10, "Para la compra diaria hace falta el coche"]] },
      { id: "transporte", t: "Metro, tranvía o autobús frecuente", a: "no", o: [
        ["A menos de 5 minutos", 100, "Metro, tranvía o autobús frecuente a menos de 5 minutos"],
        ["De 5 a 10 minutos", 65], ["Lejos o con poca frecuencia", 25, "Transporte público lejos o poco frecuente"]] },
      { id: "colegios", t: "Colegios cerca", a: "no", o: [
        ["Varios andando", 100, "Varios colegios a los que se va andando"],
        ["Alguno andando", 65], ["Hay que desplazarse", 25, "Los colegios quedan lejos"]] },
      { id: "colegios_fama", t: "Cómo valoran esos colegios las familias del barrio", a: "no", o: [
        ["Muy buscados", 100, "Colegios muy buscados por las familias de la zona"],
        ["Tienen buena opinión", 70], ["Opinión poco favorable", 30, "Los colegios cercanos tienen poca demanda"],
        ["No lo sé", null]] },
      { id: "verde", t: "Parque, jardín del Turia, playa o huerta andando", a: "no", o: [
        ["Menos de 5 minutos", 100, "Zona verde o playa a menos de 5 minutos andando"],
        ["De 5 a 15 minutos", 65], ["Más lejos", 25, "Zonas verdes lejos"]] },
      { id: "aparcar", t: "Aparcamiento", a: "no", o: [
        ["Plaza de garaje propia", 100, "Plaza de garaje propia"],
        ["Fácil en la calle", 65], ["Difícil", 20, "Difícil aparcar"]] }
    ] },
    { id: "vecindario", n: "Vida de barrio", d: "El ambiente, la imagen del barrio y lo que pasa a su alrededor", q: [
      { id: "ambiente", t: "Ambiente del vecindario", a: "no", o: [
        ["Vecinos que se conocen, vida de calle tranquila", 100, "Barrio con vida de calle y vecinos que se conocen"],
        ["Correcto", 60], ["Conflictivo o descuidado", 15, "Ambiente del entorno poco cuidado"]] },
      { id: "imagen", t: "Cómo se percibe el barrio cuando dices dónde vives", a: "no", o: [
        ["Muy buscado, con prestigio", 100, "Barrio muy buscado y con buena imagen"],
        ["Bien considerado", 70], ["Indiferente", 45], ["Con mala fama", 15, "El barrio tiene mala fama"]] },
      { id: "tendencia", t: "Hacia dónde va el barrio", a: "no", o: [
        ["A mejor: comercios nuevos, edificios rehabilitados", 100, "Barrio en mejora: comercios nuevos y edificios rehabilitados"],
        ["Estable", 65], ["A peor", 20, "Barrio que ha ido a menos"]] },
      { id: "eventos", t: "Eventos frecuentes cerca de casa (Fallas, fútbol, conciertos, fiestas)", a: "depende", eventos: true, o: [
        ["No hay o no se notan", null],
        ["Hay y son un atractivo: ambiente, todo a pie", 85, "Eventos cerca: {e}, a un paseo de casa"],
        ["Hay y se notan para bien y para mal", 55, "Eventos cerca ({e}): ambiente, pero también ruido y calles cortadas algunos días"],
        ["Hay y molestan: ruido, cortes, aparcamiento", 25, "Eventos cerca ({e}) que traen ruido y cortes de calle"]] }
    ] },
    { id: "cuerpo", n: "Cuerpo de la casa", d: "Estado, instalaciones y edificio", q: [
      { id: "estado", t: "Estado general", a: "obra", o: [
        ["Para entrar a vivir", 100, "Para entrar a vivir, sin obras"],
        ["Necesita retoques: pintura, suelos", 65], ["Reforma de cocina o baños", 35, "Cocina o baños para reformar"],
        ["Reforma integral", 10, "Necesita reforma integral"]] },
      { id: "instalaciones", t: "Instalaciones y ventanas", a: "obra", o: [
        ["Renovadas, buen aislamiento", 100, "Instalaciones renovadas y buen aislamiento"],
        ["Algo antiguas, pero funcionan", 55], ["Antiguas, con humedades o frío", 15, "Instalaciones antiguas, con humedades o frío"]] },
      { id: "energia", t: "Certificado energético", a: "obra", o: [
        ["A o B", 100, "Certificado energético A o B"], ["C o D", 65], ["De E a G", 30, "Certificado energético bajo (E, F o G)"],
        ["No lo tengo o no lo sé", null]] },
      { id: "acceso", t: "Acceso", a: "no", o: [
        ["Ascensor y sin escalones", 100, "Ascensor y acceso sin escalones"],
        ["Ascensor, con algún escalón", 70], ["Sin ascensor, en planta baja o primera", 55],
        ["Sin ascensor, en segunda planta o más", 15, "Sin ascensor, en segunda planta o más"]] },
      { id: "edificio", t: "Edificio y comunidad", a: "no", o: [
        ["Bien cuidado, sin obras pendientes", 100, "Edificio bien cuidado y sin obras pendientes"],
        ["Correcto", 60], ["Descuidado o con obras pendientes", 15, "Edificio descuidado o con obras pendientes"]] }
    ] },
    { id: "caracter", n: "Carácter", d: "Lo que la hace distinta", q: [
      { id: "rareza", t: "¿Cuántas casas como esta hay en tu calle?", a: "no", o: [
        ["Ninguna parecida", 100, "Una casa sin otra parecida en la calle"],
        ["Pocas", 70], ["Bastantes", 40], ["Es de las más comunes", 20]] },
      { id: "detalles", t: "Detalles con historia o diseño: suelos hidráulicos, molduras, balcones de forja, arquitectura cuidada", a: "no", o: [
        ["Varios", 100, "Detalles con carácter: suelos, molduras o arquitectura cuidada"],
        ["Alguno", 60], ["Es una casa correcta, sin rasgos especiales", 30]] },
      { id: "impresion", t: "Primera impresión al entrar, como la vería alguien que no la conoce", a: "poco", o: [
        ["Sorprende", 100, "Sorprende al entrar"], ["Agradable", 70], ["Neutra", 40],
        ["Fría o descuidada", 15, "La primera impresión es fría o descuidada"]] },
      { id: "hogar", t: "¿Qué suele decir quien entra por primera vez?", a: "poco", o: [
        ["Que se está muy bien aquí", 100, "Quien entra dice que se está muy bien"],
        ["Algo amable", 65], ["Nada en especial", 35]] }
    ] }
  ];
  const EVENTOS = ["Fallas", "Partidos de fútbol", "Conciertos o festivales", "Fiestas de barrio", "Ocio nocturno"];
  const PREGUNTAS = D.reduce((n, d) => n + d.q.length, 0);

  /* ---------- Valor en euros: supuestos visibles ----------
     Índice = media de las dimensiones contestadas. Una casa que contesta lo más
     habitual en cada pregunta queda cerca de 60: es el punto neutro (ajuste 0).
     Cada 40 puntos por encima o por debajo de 60 mueven la cifra el 15 %, con ese tope.
     Con casas parecidas no se aplica el índice: el propietario ya compara cada una con la suya. */
  const VALOR = {
    MAX: 0.15, NEUTRO: 60, RANGO: 40, BANDA: 0.04, REDONDEO: 1000,
    TESTIGO: [["Bastante mejor que la mía", -0.10], ["Algo mejor", -0.05], ["Parecida", 0], ["Algo peor", 0.05], ["Bastante peor que la mía", 0.10]]
  };
  const PARTIDAS = {
    testigos: "Casas parecidas de mi zona",
    catastro: "Valor de referencia del Catastro",
    tasacion: "Una tasación o valoración profesional",
    pedir: "El precio que pienso pedir"
  };

  /* ---------- Cálculo (sin DOM: se puede probar en la consola) ---------- */
  // r = { idPregunta: índiceOpción, ... , eventosCuales: ["Fallas", ...] }
  function calcular(r) {
    const cuales = (r.eventosCuales || []).filter((x) => EVENTOS.includes(x));
    const listaEv = cuales.length ? lista(cuales.map((x) => x.toLowerCase().replace("fallas", "Fallas"))) : "fiestas y eventos";
    const dims = [], fuertes = [], frenos = [], respuestas = [];
    let respondidas = 0;
    D.forEach((d, di) => {
      let suma = 0, cuenta = 0, vistas = 0;
      d.q.forEach((q) => {
        const i = r[q.id];
        if (i == null || !q.o[i]) return;
        respondidas++; vistas++;
        const [txt, pts, frase] = q.o[i];
        respuestas.push({ di, t: q.t, r: txt });
        if (pts == null) return;
        suma += pts; cuenta++;
        const texto = frase ? frase.replace("{e}", listaEv) : "";
        if (frase && pts >= UMBRAL.fuerte) fuertes.push({ dim: d.n, di, pts, texto });
        if (frase && pts <= UMBRAL.freno) frenos.push({ dim: d.n, di, pts, texto, a: q.a });
      });
      dims.push({ id: d.id, n: d.n, d: d.d, vistas, total: d.q.length, puntos: cuenta ? Math.round(suma / cuenta) : null });
    });
    fuertes.sort((a, b) => b.pts - a.pts || a.di - b.di);
    frenos.sort((a, b) => a.pts - b.pts || a.di - b.di);
    const con = dims.filter((d) => d.puntos != null);
    const indice = con.length ? Math.round(con.reduce((s, d) => s + d.puntos, 0) / con.length) : null;
    return { dims, respondidas, indice, respuestas, argumentos: variados(fuertes), frenos: variados(frenos) };
  }
  function variados(arr) {
    const usadas = new Set(), primero = [], resto = [];
    arr.forEach((x) => (usadas.has(x.di) ? resto : (usadas.add(x.di), primero)).push(x));
    return primero.concat(resto);
  }

  // p = { tipo: "testigos"|"catastro"|"tasacion"|"pedir", cifra, testigos: [{ precio, estado, comp }] }
  function valorar(c, p) {
    if (!p || !PARTIDAS[p.tipo]) return null;
    const red = (n) => Math.round(n / VALOR.REDONDEO) * VALOR.REDONDEO;
    if (p.tipo === "testigos") {
      const t = (p.testigos || []).filter((x) => x.precio > 0 && VALOR.TESTIGO[x.comp]);
      if (!t.length) return null;
      const aj = t.map((x) => Object.assign({}, x, { ajustado: x.precio * (1 + VALOR.TESTIGO[x.comp][1]) }));
      const central = aj.reduce((s, x) => s + x.ajustado, 0) / aj.length;
      const lo = Math.min(central * (1 - VALOR.BANDA), ...aj.map((x) => x.ajustado));
      const hi = Math.max(central * (1 + VALOR.BANDA), ...aj.map((x) => x.ajustado));
      return { tipo: p.tipo, central: red(central), lo: red(lo), hi: red(hi), testigos: aj, anunciadas: aj.some((x) => x.estado === "anunciada") };
    }
    if (!(p.cifra > 0) || c.indice == null || c.respondidas < UMBRAL.minimo) return null;
    const con = c.dims.filter((d) => d.puntos != null);
    const bruto = VALOR.MAX * (c.indice - VALOR.NEUTRO) / VALOR.RANGO;
    const ajuste = Math.max(-VALOR.MAX, Math.min(VALOR.MAX, bruto));
    const escala = bruto ? ajuste / bruto : 0;
    // Lo que aporta cada dimensión (entre todas suman el ajuste total)
    const aportes = con.map((d) => {
      const x = VALOR.MAX * (d.puntos - VALOR.NEUTRO) / (VALOR.RANGO * con.length) * escala;
      return { n: d.n, pct: x, eur: p.cifra * x };
    }).sort((a, b) => b.pct - a.pct);
    const central = p.cifra * (1 + ajuste);
    return { tipo: p.tipo, cifra: p.cifra, ajuste, indice: c.indice, aportes,
      central: red(central), lo: red(central * (1 - VALOR.BANDA)), hi: red(central * (1 + VALOR.BANDA)) };
  }
  function lista(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1]; }
  const nivel = (p) => NIVEL.find(([m]) => p >= m)[1];
  window.EuporiaConceptual = { calcular, valorar, D, VALOR };

  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => parseInt(String(v == null ? "" : v).split(",")[0].replace(/[^\d]/g, ""), 10) || 0;
  let fmt;
  try { fmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }); }
  catch (e) { fmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }); }
  const eur = (n) => fmt.format(Math.round(n)) + " €";
  const pct = (n) => (Math.abs(n) < 0.0005 ? "0" : (n > 0 ? "+" : "−") + (Math.abs(n) * 100).toFixed(1).replace(".", ",")) + " %";
  const seur = (n) => (Math.round(n / 100) === 0 ? "0 €" : (n > 0 ? "+" : "−") + fmt.format(Math.round(Math.abs(n) / 100) * 100) + " €");
  const rango = (v) => (v.lo === v.hi ? eur(v.central) : `${eur(v.lo)} – ${eur(v.hi)}`);
  const CLAVE = "euporia_conceptual";
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del() { try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ } }
  };
  const waEuporia = (texto) => (SITE.whatsapp ? `https://wa.me/${SITE.whatsapp}?text=` + encodeURIComponent(texto) : "");
  // Mensaje de solicitud con los datos que escriba la persona (no se guardan: solo van al texto de WhatsApp)
  function mensajeSolicitud(f) {
    const v = (n) => String(f[n].value || "").trim().replace(/\s+/g, " ").slice(0, 120);
    const refcat = v("s_refcat").toUpperCase().replace(/\s/g, "");
    const dir = [v("s_calle"), v("s_numero"), v("s_planta") && "planta " + v("s_planta"), v("s_puerta") && "puerta " + v("s_puerta"), v("s_municipio")].filter(Boolean).join(", ");
    if (!refcat && !(v("s_calle") && v("s_numero"))) return null;
    const que = f.s_que.value === "valoracion"
      ? "me gustaría una valoración profesional de mi vivienda"
      : "necesito el valor de referencia del Catastro de mi vivienda";
    return [`Hola, ${que}.`, refcat ? `Referencia catastral: ${refcat}` : "", dir ? `Dirección: ${dir}` : "",
      "Os escribo desde el valorador de Euporia."].filter(Boolean).join("\n");
  }

  /* ---------- Formulario ---------- */
  function montar() {
    const partes = D.map((d, di) => `
      <section class="vc-dim" aria-labelledby="vc-h-${d.id}">
        <h3 id="vc-h-${d.id}"><span class="vc-num">${di + 1}</span>${esc(d.n)}</h3>
        <p class="vc-dd">${esc(d.d)}</p>
        ${d.q.map((q) => `
          <fieldset class="vc-q">
            <legend>${esc(q.t)}</legend>
            <div class="vc-op">
              ${q.o.map((o, i) => `<label><input type="radio" name="${q.id}" value="${i}"><span>${esc(o[0])}</span></label>`).join("")}
            </div>
            ${q.eventos ? `<div class="vc-ev" data-ev hidden><p>¿Cuáles? <small>(opcional)</small></p>
              ${EVENTOS.map((e) => `<label class="check"><input type="checkbox" name="eventosCuales" value="${esc(e)}"><span>${esc(e)}</span></label>`).join("")}</div>` : ""}
          </fieldset>`).join("")}
      </section>`).join("");
    const testigo = (i) => `
      <fieldset class="vc-testigo">
        <legend>Casa parecida ${i + 1}${i ? " <small>(opcional)</small>" : ""}</legend>
        <div class="form-grid">
          <label class="campo"><span>Precio</span><input type="text" inputmode="numeric" name="t${i}_precio" placeholder="€" autocomplete="off"></label>
          <label class="campo"><span>Ese precio es</span><select name="t${i}_estado"><option value="vendida">De venta cerrada</option><option value="anunciada">De anuncio</option></select></label>
          <label class="campo"><span>Comparada con la tuya</span><select name="t${i}_comp"><option value="">Elige</option>${VALOR.TESTIGO.map((t, j) => `<option value="${j}">${esc(t[0])}</option>`).join("")}</select></label>
        </div>
      </fieldset>`;
    form.innerHTML = `
      <h2>Describe tu casa</h2>
      <p>Siete apartados y ${PREGUNTAS} preguntas. Contesta como la vería alguien que entra por primera vez: un resultado demasiado bueno no te ayuda a venderla. Si algo no lo sabes, déjalo en blanco.</p>
      <p class="vc-guardado">Tus respuestas se guardan solo en este dispositivo, para que puedas seguir otro día. No se envían a ningún sitio.</p>
      ${partes}
      <section class="vc-dim vc-partida" aria-labelledby="vc-h-valor">
        <h3 id="vc-h-valor"><span class="vc-num">€</span>Ponle cifra <small>(opcional)</small></h3>
        <p class="vc-dd">Para darte un valor orientativo hace falta una cifra de partida. No usamos precios por zona ni euros por metro: la pones tú.</p>
        <fieldset class="vc-q">
          <legend>¿De qué cifra partes?</legend>
          <div class="vc-op">
            ${Object.entries(PARTIDAS).map(([k, t]) => `<label><input type="radio" name="partida" value="${k}"><span>${esc(t)}</span></label>`).join("")}
            <label><input type="radio" name="partida" value=""><span>No tengo ninguna</span></label>
          </div>
        </fieldset>
        <div data-p="cifra" hidden>
          <label class="campo"><span data-p-lbl>Cifra</span><input type="text" inputmode="numeric" name="cifra" placeholder="€" autocomplete="off"></label>
          <p class="vc-ayuda" data-p-ayuda></p>
        </div>
        <div data-p="testigos" hidden>
          <p class="vc-ayuda">Casas de tu zona, del mismo tipo que la tuya, que se hayan vendido o estén anunciadas. Al compararlas, piensa en los siete apartados: luz, calma, la vida que cabe, barrio, estado y carácter.</p>
          ${[0, 1, 2].map(testigo).join("")}
        </div>
        <div class="vc-oferta" data-p="ninguna" hidden>
          <p><strong>¿No tienes ninguna cifra? Pídenosla.</strong> Te conseguimos el valor de referencia del Catastro de tu casa o te hacemos una valoración profesional. Rellena lo que sepas y te preparamos el mensaje de WhatsApp.</p>
          <div class="form-grid vc-solicitud">
            <label class="campo vc-ancho"><span>Qué necesitas</span><select name="s_que">
              <option value="referencia">El valor de referencia del Catastro</option>
              <option value="valoracion">Una valoración profesional</option></select></label>
            <label class="campo vc-ancho"><span>Referencia catastral <small>(si la tienes; viene en el recibo del IBI)</small></span><input type="text" name="s_refcat" autocomplete="off" spellcheck="false" placeholder="20 caracteres"></label>
            <p class="vc-o vc-ancho">o, si no la tienes, la dirección:</p>
            <label class="campo vc-ancho"><span>Calle</span><input type="text" name="s_calle" autocomplete="off"></label>
            <label class="campo"><span>Número</span><input type="text" name="s_numero" autocomplete="off"></label>
            <label class="campo"><span>Planta</span><input type="text" name="s_planta" autocomplete="off"></label>
            <label class="campo"><span>Puerta</span><input type="text" name="s_puerta" autocomplete="off"></label>
            <label class="campo"><span>Municipio</span><input type="text" name="s_municipio" autocomplete="off" placeholder="València"></label>
          </div>
          <p class="v-err vc-err" data-s-err role="alert"></p>
          <div class="btn-row">
            ${SITE.whatsapp ? `<button class="btn" type="button" data-solicitar>Pedírnoslo por WhatsApp</button>` : ""}
            <a class="link" href="/documentos/valor-de-referencia/#contacto">Prefiero el formulario</a>
          </div>
          <p class="vc-ayuda">Estos datos no se guardan ni se envían desde aquí: solo se escriben en el mensaje de WhatsApp, y tú decides si lo mandas.</p>
        </div>
      </section>
      <div class="vc-fin">
        <button class="btn" type="submit">Ver el informe de mi casa</button>
        <button class="link vc-borrar" type="button" data-borrar>Borrar mis respuestas</button>
      </div>`;
  }

  const AYUDA = {
    catastro: ["Valor de referencia del Catastro", 'Lo calcula el Catastro para cada inmueble a partir de compraventas ante notario, sin conocer el interior de tu casa. <a class="link" href="/documentos/valor-de-referencia/">Cómo consultarlo</a> (o pídenoslo).'],
    tasacion: ["Importe de la tasación o valoración", "Una tasación suele tener ya en cuenta parte de estos conceptos (estado, planta, ascensor). Toma el ajuste como lo que no recoge del todo."],
    pedir: ["Precio que piensas pedir", "Verás si los conceptos de tu casa respaldan ese precio o no."]
  };

  function leer() {
    const r = {};
    D.forEach((d) => d.q.forEach((q) => {
      const el = form.querySelector(`input[name="${q.id}"]:checked`);
      if (el) r[q.id] = parseInt(el.value, 10);
    }));
    r.eventosCuales = Array.from(form.querySelectorAll('input[name="eventosCuales"]:checked')).map((x) => x.value);
    const pEl = form.querySelector('input[name="partida"]:checked');
    const f = form.elements;
    r.partida = {
      tipo: pEl ? pEl.value : null,
      cifra: num(f.cifra.value),
      testigos: [0, 1, 2].map((i) => ({ precio: num(f[`t${i}_precio`].value), estado: f[`t${i}_estado`].value,
        comp: f[`t${i}_comp`].value === "" ? null : parseInt(f[`t${i}_comp`].value, 10) }))
    };
    return r;
  }

  function restaurar(r) {
    if (!r) return;
    Object.keys(r).forEach((k) => {
      if (k === "eventosCuales") {
        (r[k] || []).forEach((v) => { const el = form.querySelector(`input[name="eventosCuales"][value="${CSS.escape(v)}"]`); if (el) el.checked = true; });
      } else if (k === "partida") {
        const p = r.partida || {};
        if (p.tipo != null) { const el = form.querySelector(`input[name="partida"][value="${CSS.escape(p.tipo)}"]`); if (el) el.checked = true; }
        if (p.cifra) form.elements.cifra.value = fmt.format(p.cifra);
        (p.testigos || []).slice(0, 3).forEach((t, i) => {
          if (t.precio) form.elements[`t${i}_precio`].value = fmt.format(t.precio);
          if (t.estado) form.elements[`t${i}_estado`].value = t.estado;
          if (t.comp != null) form.elements[`t${i}_comp`].value = String(t.comp);
        });
      } else {
        const el = form.querySelector(`input[name="${CSS.escape(k)}"][value="${parseInt(r[k], 10)}"]`);
        if (el) el.checked = true;
      }
    });
  }

  function mostrarPartida(tipo) {
    form.querySelectorAll("[data-p]").forEach((el) => {
      const p = el.dataset.p;
      el.hidden = !(p === "testigos" ? tipo === "testigos" : p === "ninguna" ? tipo === "" : (p === "cifra" && !!AYUDA[tipo]));
    });
    if (AYUDA[tipo]) {
      form.querySelector("[data-p-lbl]").textContent = AYUDA[tipo][0];
      form.querySelector("[data-p-ayuda]").innerHTML = AYUDA[tipo][1];
    }
  }

  /* ---------- Textos del resultado (pantalla, informe y WhatsApp) ---------- */
  function lecturaValor(v) {
    if (v.tipo === "testigos") {
      return `Parte de ${v.testigos.length === 1 ? "una casa parecida" : v.testigos.length + " casas parecidas"} de tu zona, con cada precio ajustado según cómo la comparas con la tuya.` +
        (v.anunciadas ? " Ojo: los precios de anuncio no son precios de venta y la venta suele cerrarse por debajo; si son anuncios, fíjate sobre todo en la parte baja." : "");
    }
    const DESDE = { catastro: "del valor de referencia del Catastro", tasacion: "de una tasación o valoración profesional", pedir: "del precio que piensas pedir" };
    const base = `Parte ${DESDE[v.tipo]} (${eur(v.cifra)}). Los conceptos de tu casa dan un índice de ${v.indice} sobre 100; una casa corriente queda cerca de ${VALOR.NEUTRO}, así que el ajuste es de ${pct(v.ajuste)}.`;
    if (v.tipo !== "pedir") return base;
    const juicio = v.ajuste > 0.02 ? "Los conceptos respaldan tu precio e incluso le dan margen."
      : v.ajuste < -0.02 ? "Los conceptos no terminan de respaldar ese precio: revisa los frenos y prepara bien los argumentos."
      : "Los conceptos están en línea con tu precio.";
    return base + " " + juicio;
  }

  let ultimo = null, completada = false;
  function pintar() {
    const r = leer();
    const ev = form.querySelector("[data-ev]");
    if (ev) ev.hidden = !(r.eventos > 0);
    mostrarPartida(r.partida.tipo);
    store.set(r);
    const c = calcular(r);
    const v = valorar(c, r.partida);
    const acciones = document.getElementById("vc-acciones");
    if (c.respondidas < UMBRAL.minimo) {
      salida.innerHTML = `<div class="calc-vacio"><p>Responde al menos ${UMBRAL.minimo} preguntas para ver el perfil de tu casa. Llevas ${c.respondidas} de ${PREGUNTAS}.</p></div>`;
      if (acciones) acciones.hidden = true;
      ultimo = null;
      return;
    }
    ultimo = { c, v, partida: r.partida };
    const top = c.dims.filter((d) => d.puntos != null).sort((a, b) => b.puntos - a.puntos).filter((d) => d.puntos >= 60).slice(0, 2);
    const define = top.length
      ? `Lo que mejor define tu casa: <strong>${esc(lista(top.map((d) => "«" + d.n + "»")))}</strong>.`
      : "Con estas respuestas, ninguna dimensión destaca todavía. Mira abajo qué la frena y qué se puede mejorar.";
    const args = c.argumentos, fr = c.frenos;
    const li = (x) => `<li><span>${esc(x.texto)}</span><small>${esc(x.dim)}</small></li>`;
    const freno = (x) => `<li><span>${esc(x.texto)}</span><small><strong>${esc(ARREGLO[x.a][0])}.</strong> ${esc(ARREGLO[x.a][1])}</small></li>`;
    const bloqueValor = v ? `
      <div class="calc-hero">
        <p class="calc-lbl">Valor orientativo de tu casa</p>
        <p class="calc-big vc-big">${rango(v)}</p>
        <p class="calc-sub">${esc(lecturaValor(v))}</p>
        ${v.aportes ? `<details class="vc-mas"><summary>Qué suma y qué resta</summary><ul class="vc-aportes">${v.aportes.map((a) =>
          `<li><span>${esc(a.n)}</span><b class="${a.pct > 0.0005 ? "pos" : a.pct < -0.0005 ? "neg" : ""}">${pct(a.pct)} · ${seur(a.eur)}</b></li>`).join("")}</ul></details>` : ""}
        <p class="vc-aviso">Orientativo: no es una tasación. Para fijar el precio con fundamento, contrástalo con una valoración profesional.</p>
      </div>` : r.partida.tipo == null ? `
      <div class="vc-oferta vc-oferta-s"><p><strong>¿Quieres una cifra en euros?</strong> Al final del cuestionario, en «Ponle cifra», escribe un punto de partida: casas parecidas, el valor de referencia del Catastro, una tasación o el precio que piensas pedir. Si no tienes ninguno, te ayudamos a conseguirlo.</p></div>` : "";
    salida.innerHTML = `
      ${bloqueValor}
      <div class="${v ? "vc-perfil-cab" : "calc-hero"}">
        <p class="calc-lbl">El perfil de tu casa · ${c.respondidas} de ${PREGUNTAS} respuestas</p>
        <p class="vc-define">${define}</p>
      </div>
      <ul class="vc-perfil" aria-label="Perfil por dimensiones, de 0 a 100">
        ${c.dims.map((d) => d.puntos == null
          ? `<li class="vc-sin"><div class="vc-ph"><span>${esc(d.n)}</span><span class="vc-pv">Sin responder</span></div><div class="vc-barra"><i style="width:0"></i></div></li>`
          : `<li><div class="vc-ph"><span>${esc(d.n)}</span><span class="vc-pv"><b>${d.puntos}</b> · ${nivel(d.puntos)}</span></div>
              <div class="vc-barra" role="img" aria-label="${esc(d.n)}: ${d.puntos} de 100"><i style="width:${d.puntos}%"></i></div>
              ${d.vistas < d.total ? `<small>${d.vistas} de ${d.total} preguntas</small>` : ""}</li>`).join("")}
      </ul>
      <h3 class="calc-h">Tus argumentos de venta</h3>
      <p class="calc-p">Lo que un anuncio por metros no cuenta. Úsalos en la descripción y en la visita.</p>
      ${args.length ? `<ul class="vc-lista vc-pos">${args.slice(0, 3).map(li).join("")}</ul>
        ${args.length > 3 ? `<details class="vc-mas"><summary>Ver ${args.length - 3} más</summary><ul class="vc-lista vc-pos">${args.slice(3).map(li).join("")}</ul></details>` : ""}`
        : `<p class="calc-p">Todavía no hay ninguna respuesta en lo más alto de su escala. Revisa las que dudabas: a veces lo bueno de una casa se da por supuesto.</p>`}
      <h3 class="calc-h">Lo que la frena</h3>
      ${fr.length ? `<ul class="vc-lista vc-neg">${fr.slice(0, 3).map(freno).join("")}</ul>
        ${fr.length > 3 ? `<details class="vc-mas"><summary>Ver ${fr.length - 3} más</summary><ul class="vc-lista vc-neg">${fr.slice(3).map(freno).join("")}</ul></details>` : ""}`
        : `<p class="calc-p">Ninguna respuesta queda en lo más bajo de su escala.</p>`}
      ${v ? "" : `<div class="calc-claves"><p class="calc-nota">Es una descripción de tu casa, no una tasación.</p></div>`}`;
    if (acciones) acciones.hidden = false;
    if (!completada && c.respondidas >= Math.ceil(PREGUNTAS * 0.8) && window.EuporiaMedir) {
      completada = true; window.EuporiaMedir("herramienta_completada", { herramienta: "conceptual" });
    }
  }

  const enlacePagina = () => location.origin + location.pathname;
  function textoResumen(u) {
    const { c, v } = u;
    const out = ["*Mi casa, sin contar metros*", "Informe hecho con el valorador de Euporia"];
    if (v) out.push(`*Valor orientativo:* ${rango(v)}\n${lecturaValor(v)}\nNo es una tasación.`);
    out.push("*Perfil (de 0 a 100)*\n" + c.dims.filter((d) => d.puntos != null).map((d) => `- ${d.n}: ${d.puntos} (${nivel(d.puntos).toLowerCase()})`).join("\n"));
    if (c.argumentos.length) out.push("*Argumentos de venta*\n" + c.argumentos.slice(0, 6).map((x) => "- " + x.texto).join("\n"));
    if (c.frenos.length) out.push("*Lo que la frena*\n" + c.frenos.slice(0, 5).map((x) => `- ${x.texto}: ${ARREGLO[x.a][0].toLowerCase()}`).join("\n"));
    out.push("Hazlo con tu casa: " + enlacePagina());
    return out.join("\n\n");
  }

  /* Informe completo para imprimir o guardar en PDF (se coloca fuera del formulario, como hijo de <body>) */
  function informe(u) {
    const { c, v, partida } = u;
    const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    const li = (x) => `<li>${esc(x.texto)} <span>(${esc(x.dim)})</span></li>`;
    const tablaTestigos = v && v.testigos ? `<table class="vc-inf-tabla"><thead><tr><th>Casa parecida</th><th>Precio</th><th>Comparada con la tuya</th><th>Ajustado</th></tr></thead><tbody>${
      v.testigos.map((t, i) => `<tr><td>${i + 1} · ${t.estado === "anunciada" ? "anuncio" : "venta cerrada"}</td><td>${eur(t.precio)}</td><td>${esc(VALOR.TESTIGO[t.comp][0])} (${pct(VALOR.TESTIGO[t.comp][1])})</td><td>${eur(t.ajustado)}</td></tr>`).join("")}</tbody></table>` : "";
    const tablaAportes = v && v.aportes ? `<table class="vc-inf-tabla"><thead><tr><th>Apartado</th><th>Ajuste</th><th>En euros</th></tr></thead><tbody>${v.aportes.map((a) =>
      `<tr><td>${esc(a.n)}</td><td>${pct(a.pct)}</td><td>${seur(a.eur)}</td></tr>`).join("")}<tr><th>Total</th><th>${pct(v.ajuste)}</th><th>${seur(v.cifra * v.ajuste)}</th></tr></tbody></table>` : "";
    const metodoValor = !v ? "" : v.aportes
      ? ` Para el valor, el índice de la casa (media de los apartados) se compara con ${VALOR.NEUTRO}, que es lo que saca una casa corriente: cada ${VALOR.RANGO} puntos por encima o por debajo mueven la cifra de partida un ${VALOR.MAX * 100} %, con ese tope, y se da una horquilla de ±${VALOR.BANDA * 100} %.`
      : ` Para el valor, cada casa parecida se ajusta según cómo la comparas con la tuya (−10 % si es bastante mejor, +10 % si es bastante peor), se hace la media y se da una horquilla de al menos ±${VALOR.BANDA * 100} %.`;
    return `
      <header class="vc-inf-cab"><p class="vc-inf-marca">Euporia</p><h2>Informe de tu casa, sin contar metros</h2>
        <p>${esc(fecha)} · ${c.respondidas} de ${PREGUNTAS} preguntas contestadas</p></header>
      ${v ? `<section><h3>Valor orientativo</h3><p class="vc-inf-valor">${rango(v)}</p><p>${esc(lecturaValor(v))}</p>${tablaAportes}${tablaTestigos}
        <p class="vc-inf-nota">Orientativo: no es una tasación ni dice cuál es el precio de mercado. Para fijar el precio, contrástalo con una valoración profesional.</p></section>`
        : partida.tipo === "" ? `<section><h3>Valor orientativo</h3><p>No has indicado una cifra de partida. Si no la tienes, te conseguimos el valor de referencia del Catastro o te hacemos una valoración profesional.</p></section>` : ""}
      <section><h3>El perfil de tu casa</h3><p>Cada apartado es la media de tus respuestas, de 0 a 100. Por encima de 80 es un punto fuerte; por debajo de 40, algo a mejorar o a explicar bien.</p>
        <table class="vc-inf-tabla"><thead><tr><th>Apartado</th><th>Qué mide</th><th>Puntos</th></tr></thead><tbody>${c.dims.map((d) =>
          `<tr><td>${esc(d.n)}</td><td>${esc(d.d)}</td><td>${d.puntos == null ? "Sin responder" : `${d.puntos} · ${nivel(d.puntos)}`}</td></tr>`).join("")}</tbody></table></section>
      <section><h3>Tus argumentos de venta</h3><p>Tus respuestas más altas, en frases que puedes usar en el anuncio y en la visita.</p>
        ${c.argumentos.length ? `<ul>${c.argumentos.map(li).join("")}</ul>` : "<p>Ninguna respuesta queda en lo más alto de su escala.</p>"}</section>
      <section><h3>Lo que la frena y qué hacer</h3>
        ${c.frenos.length ? `<ul>${c.frenos.map((x) => `<li>${esc(x.texto)} <span>(${esc(x.dim)})</span><br><strong>${esc(ARREGLO[x.a][0])}.</strong> ${esc(ARREGLO[x.a][1])}</li>`).join("")}</ul>` : "<p>Ninguna respuesta queda en lo más bajo de su escala.</p>"}</section>
      <section><h3>Cómo se ha calculado</h3><p>Cada respuesta tiene una puntuación de 0 a 100 y cada apartado es la media de las preguntas contestadas; las que se dejan en blanco o se marcan como «No lo sé» no cuentan.${metodoValor} No se usan precios por zona ni euros por metro cuadrado.</p></section>
      <section class="vc-inf-resp"><h3>Tus respuestas</h3>${D.map((d, di) => {
        const rs = c.respuestas.filter((x) => x.di === di);
        return rs.length ? `<h4>${esc(d.n)}</h4><ul>${rs.map((x) => `<li>${esc(x.t)}: <strong>${esc(x.r)}</strong></li>`).join("")}</ul>` : "";
      }).join("")}</section>
      <footer class="vc-inf-pie"><p>Hecho con el valorador de Euporia: ${esc(enlacePagina())}. Es una descripción hecha por el propietario, no una tasación ni asesoramiento.</p></footer>`;
  }

  montar();
  restaurar(store.get());
  form.addEventListener("change", pintar);
  form.addEventListener("input", (e) => { if (e.target.type === "text" && !/^s_/.test(e.target.name)) pintar(); });
  form.addEventListener("submit", (e) => { e.preventDefault(); pintar(); salida.focus(); salida.scrollIntoView({ behavior: "smooth", block: "start" }); });
  form.addEventListener("click", (e) => {
    if (e.target.closest("[data-solicitar]")) {
      const texto = mensajeSolicitud(form.elements);
      const err = form.querySelector("[data-s-err]");
      err.textContent = texto ? "" : "Escribe la referencia catastral o, al menos, la calle y el número.";
      if (texto) window.open(waEuporia(texto), "_blank", "noopener");
      return;
    }
    if (!e.target.closest("[data-borrar]")) return;
    if (!window.confirm("¿Borrar todas tus respuestas de este dispositivo?")) return;
    form.reset(); store.del(); pintar();
  });

  // Impresión: el informe completo es hijo directo de <body> y, al imprimir, es lo único que sale
  const hoja = document.createElement("div");
  hoja.id = "vc-informe";
  hoja.className = "vc-informe";
  document.body.appendChild(hoja);
  const prepararInforme = () => { if (ultimo) { hoja.innerHTML = informe(ultimo); document.documentElement.classList.add("vc-imprimir"); } };
  window.addEventListener("beforeprint", prepararInforme);
  window.addEventListener("afterprint", () => document.documentElement.classList.remove("vc-imprimir"));

  const acciones = document.getElementById("vc-acciones");
  if (acciones) {
    const wa = acciones.querySelector("[data-euporia]");
    if (wa) wa.hidden = !SITE.whatsapp;
    acciones.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !ultimo) return;
      const texto = textoResumen(ultimo);
      if (b.hasAttribute("data-compartir")) window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener");
      if (b.hasAttribute("data-euporia") && SITE.whatsapp) {
        window.open(waEuporia("Hola, he hecho el informe de mi casa con el valorador de Euporia y me gustaría una valoración profesional:\n\n" + texto), "_blank", "noopener");
      }
      if (b.hasAttribute("data-copiar")) {
        const plano = texto.replace(/\*/g, "");
        const ok = () => { b.textContent = "Copiado"; setTimeout(() => { b.textContent = "Copiar el texto"; }, 2000); };
        if (navigator.clipboard) navigator.clipboard.writeText(plano).then(ok, () => window.prompt("Copia el texto:", plano));
        else window.prompt("Copia el texto:", plano);
      }
      if (b.hasAttribute("data-imprimir")) { prepararInforme(); window.print(); }
    });
  }
  pintar();
})();
