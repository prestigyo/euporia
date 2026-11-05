/* =====================================================================
   Euporia · «Lo que vale tu casa, sin contar metros» (valorador conceptual)
   Para el propietario que piensa vender. Describe la vivienda con preguntas
   cerradas y comprobables, agrupadas en siete dimensiones, y devuelve:
     1. su perfil (cada dimensión de 0 a 100),
     2. sus argumentos de venta (las respuestas más altas, en frases de anuncio),
     3. sus frenos (las más bajas), separando lo que se arregla de lo que no.
   No da ninguna cifra en euros ni usa precios por zona ni €/m².
   Las respuestas se guardan solo en el navegador (localStorage, clave
   euporia_conceptual) y no se envían a ningún sitio. El botón de WhatsApp
   abre el resumen escrito y la persona decide si lo manda.
   Si cambias las dimensiones, las preguntas o los umbrales (UMBRAL), revisa
   el texto y las preguntas frecuentes de contenido/valorar-mi-casa.html.

   Casos de prueba (se pueden repetir en la consola con
   EuporiaConceptual.calcular({...})):
   - Todo con la primera opción → las 7 dimensiones a 100, 0 frenos.
   - Todo con la última opción (salvo «No lo sé»/«No hay») → dimensiones entre 10 y 25, 0 argumentos.
   - Solo luz: sol=0 (100), aire=2 (15) → Luz y aire 57,5 ≈ 58; 1 argumento (sol) y 1 freno (aire, «se arregla con obra»).
   - colegios_fama = «No lo sé» y eventos = «No hay» → contestadas pero no cuentan en la media.
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

  /* ---------- Cálculo (sin DOM: se puede probar en la consola) ---------- */
  // r = { idPregunta: índiceOpción, ... , eventosCuales: ["Fallas", ...] }
  function calcular(r) {
    const cuales = (r.eventosCuales || []).filter((x) => EVENTOS.includes(x));
    const listaEv = cuales.length ? lista(cuales.map((x) => x.toLowerCase().replace("fallas", "Fallas"))) : "fiestas y eventos";
    const dims = [], fuertes = [], frenos = [];
    let respondidas = 0;
    D.forEach((d, di) => {
      let suma = 0, cuenta = 0, vistas = 0;
      d.q.forEach((q) => {
        const i = r[q.id];
        if (i == null || !q.o[i]) return;
        respondidas++; vistas++;
        const [, pts, frase] = q.o[i];
        if (pts == null) return;
        suma += pts; cuenta++;
        const texto = frase ? frase.replace("{e}", listaEv) : "";
        if (frase && pts >= UMBRAL.fuerte) fuertes.push({ dim: d.n, di, pts, texto });
        if (frase && pts <= UMBRAL.freno) frenos.push({ dim: d.n, di, pts, texto, a: q.a });
      });
      dims.push({ id: d.id, n: d.n, vistas, total: d.q.length, puntos: cuenta ? Math.round(suma / cuenta) : null });
    });
    // Argumentos: primero uno por dimensión (de la más fuerte a la menos), luego el resto
    fuertes.sort((a, b) => b.pts - a.pts || a.di - b.di);
    frenos.sort((a, b) => a.pts - b.pts || a.di - b.di);
    return { dims, respondidas, argumentos: variados(fuertes), frenos: variados(frenos) };
  }
  function variados(arr) {
    const usadas = new Set(), primero = [], resto = [];
    arr.forEach((x) => (usadas.has(x.di) ? resto : (usadas.add(x.di), primero)).push(x));
    return primero.concat(resto);
  }
  function lista(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1]; }
  const nivel = (p) => NIVEL.find(([m]) => p >= m)[1];
  window.EuporiaConceptual = { calcular, D };

  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CLAVE = "euporia_conceptual";
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del() { try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ } }
  };

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
    form.innerHTML = `
      <h2>Describe tu casa</h2>
      <p>Siete apartados y ${PREGUNTAS} preguntas. Contesta como la vería alguien que entra por primera vez: un resultado demasiado bueno no te ayuda a venderla. Si algo no lo sabes, déjalo en blanco.</p>
      <p class="vc-guardado">Tus respuestas se guardan solo en este dispositivo, para que puedas seguir otro día. No se envían a ningún sitio.</p>
      ${partes}
      <div class="vc-fin">
        <button class="btn" type="submit">Ver el perfil de mi casa</button>
        <button class="link vc-borrar" type="button" data-borrar>Borrar mis respuestas</button>
      </div>`;
  }

  function leer() {
    const r = {};
    D.forEach((d) => d.q.forEach((q) => {
      const el = form.querySelector(`input[name="${q.id}"]:checked`);
      if (el) r[q.id] = parseInt(el.value, 10);
    }));
    r.eventosCuales = Array.from(form.querySelectorAll('input[name="eventosCuales"]:checked')).map((x) => x.value);
    return r;
  }

  function restaurar(r) {
    if (!r) return;
    Object.keys(r).forEach((k) => {
      if (k === "eventosCuales") {
        (r[k] || []).forEach((v) => { const el = form.querySelector(`input[name="eventosCuales"][value="${CSS.escape(v)}"]`); if (el) el.checked = true; });
      } else {
        const el = form.querySelector(`input[name="${CSS.escape(k)}"][value="${parseInt(r[k], 10)}"]`);
        if (el) el.checked = true;
      }
    });
  }

  /* ---------- Resultado ---------- */
  let resumen = "", completada = false;
  function pintar() {
    const r = leer();
    const ev = form.querySelector("[data-ev]");
    if (ev) ev.hidden = !(r.eventos > 0);
    store.set(r);
    const c = calcular(r);
    const acciones = document.getElementById("vc-acciones");
    if (c.respondidas < UMBRAL.minimo) {
      salida.innerHTML = `<div class="calc-vacio"><p>Responde al menos ${UMBRAL.minimo} preguntas para ver el perfil de tu casa. Llevas ${c.respondidas} de ${PREGUNTAS}.</p></div>`;
      if (acciones) acciones.hidden = true;
      resumen = "";
      return;
    }
    const conPuntos = c.dims.filter((d) => d.puntos != null);
    const top = conPuntos.slice().sort((a, b) => b.puntos - a.puntos).filter((d) => d.puntos >= 60).slice(0, 2);
    const define = top.length
      ? `Lo que mejor define tu casa: <strong>${esc(lista(top.map((d) => "«" + d.n + "»")))}</strong>.`
      : "Con estas respuestas, ninguna dimensión destaca todavía. Mira abajo qué la frena y qué se puede mejorar.";
    const args = c.argumentos, fr = c.frenos;
    const li = (x) => `<li><span>${esc(x.texto)}</span><small>${esc(x.dim)}</small></li>`;
    const freno = (x) => `<li><span>${esc(x.texto)}</span><small><strong>${esc(ARREGLO[x.a][0])}.</strong> ${esc(ARREGLO[x.a][1])}</small></li>`;
    salida.innerHTML = `
      <div class="calc-hero">
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
      <div class="calc-claves">
        <p class="calc-nota">Es una descripción de tu casa, no una tasación: no da un precio ni dice cuál es el de mercado. Para fijar el precio, compáralo con ventas reales cercanas o pide una valoración profesional.</p>
      </div>`;
    if (acciones) acciones.hidden = false;
    resumen = ["Mi casa, sin contar metros (valorador de Euporia)",
      "Perfil: " + c.dims.filter((d) => d.puntos != null).map((d) => `${d.n} ${d.puntos}`).join(" · "),
      args.length ? "Argumentos:\n" + args.slice(0, 5).map((x) => "- " + x.texto).join("\n") : null,
      fr.length ? "Frenos:\n" + fr.slice(0, 5).map((x) => `- ${x.texto} (${ARREGLO[x.a][0].toLowerCase()})`).join("\n") : null
    ].filter(Boolean).join("\n\n");
    if (!completada && c.respondidas >= Math.ceil(PREGUNTAS * 0.8) && window.EuporiaMedir) {
      completada = true; window.EuporiaMedir("herramienta_completada", { herramienta: "conceptual" });
    }
  }

  montar();
  restaurar(store.get());
  form.addEventListener("change", pintar);
  form.addEventListener("submit", (e) => { e.preventDefault(); pintar(); salida.focus(); salida.scrollIntoView({ behavior: "smooth", block: "start" }); });
  form.addEventListener("click", (e) => {
    if (!e.target.closest("[data-borrar]")) return;
    if (!window.confirm("¿Borrar todas tus respuestas de este dispositivo?")) return;
    form.reset(); store.del(); pintar();
  });

  const acciones = document.getElementById("vc-acciones");
  if (acciones) {
    const wa = acciones.querySelector("[data-whatsapp]");
    if (wa) wa.hidden = !SITE.whatsapp;
    acciones.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !resumen) return;
      if (b.hasAttribute("data-copiar")) {
        const ok = () => { b.textContent = "Copiado"; setTimeout(() => { b.textContent = "Copiar el resumen"; }, 2000); };
        if (navigator.clipboard) navigator.clipboard.writeText(resumen).then(ok, () => window.prompt("Copia el resumen:", resumen));
        else window.prompt("Copia el resumen:", resumen);
      }
      if (b.hasAttribute("data-whatsapp") && SITE.whatsapp) {
        window.open(`https://wa.me/${SITE.whatsapp}?text=` + encodeURIComponent("Hola, he descrito mi casa con el valorador de Euporia y me gustaría que la valorase un profesional:\n\n" + resumen), "_blank", "noopener");
      }
      if (b.hasAttribute("data-imprimir")) window.print();
    });
  }
  pintar();
})();
