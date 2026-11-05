/* =====================================================================
   Euporia · «Cuánto vale esta casa para ti» (valoración en visita)
   Se monta en #visita-app. Las visitas se guardan en el navegador (localStorage).
   Al mostrar el resultado se envía a la hoja «Visitas» del Apps Script la dirección,
   el precio, las prioridades, las puntuaciones y el resultado, para hacer estadísticas.
   Nunca se envían el nombre, el contacto ni la nota del comprador: eso solo llega si
   la persona rellena el formulario «Negociadlo por mí» (hoja «Negociaciones»).
   Ajustes del modelo: CONFIG, justo debajo. Si cambias MAX_ADJ o las
   ponderaciones, actualiza también las preguntas frecuentes de
   contenido/valorar-visita.html.
   ===================================================================== */
(() => {
  const root = document.getElementById("visita-app");
  if (!root) return;
  const SITE = window.EUPORIA || {};

  /* ---------- Ajustes del modelo ---------- */
  const CONFIG = {
    MAX_ADJ: 0.15,   // ajuste máximo sobre el precio anunciado (±15 %)
    BAND: 0.04,      // horquilla alrededor del valor final (±4 %)
    REFORMA: { none: 0, cosm: 120, media: 400, integral: 800 }   // €/m² orientativos; ajústalos a Valencia
  };
  const PESO = { ess: 3, imp: 2, sec: 1 };
  const PRIO = { ess: "Esencial", imp: "Importante", sec: "Secundario" };

  /* ---------- Conceptos y preguntas (escala 1–5 frente a lo esperado por el precio) ---------- */
  const C = [
    { id: "luz", n: "Luz y orientación", d: "Lo que entra por las ventanas", q: [
      "Luz natural en salón y dormitorios", "Sol y orientación", "Vistas desde las ventanas", "Sensación de amplitud al recorrerla"] },
    { id: "dis", n: "Distribución", d: "Cómo se aprovechan los metros", q: [
      "Aprovechamiento: ¿se pierde espacio en pasillos?", "Tamaño y forma del salón-comedor",
      "Relación entre zona de día y de noche", "Facilidad para amueblarla a tu manera"] },
    { id: "coc", n: "Cocina", d: "Tamaño, luz y encaje", q: [
      "Tamaño y metros de bancada", "Luz natural y ventilación", "Encaje con tu forma de cocinar y comer"] },
    { id: "ban", n: "Baños", d: "Comodidad y cantidad", q: [
      "Tamaño y comodidad (ducha, lavabo)", "Número de baños para tu familia", "Ventilación y luz natural"] },
    { id: "dor", n: "Dormitorios y almacenaje", d: "Descanso y espacio para guardar", q: [
      "Tamaño de los dormitorios", "Armarios y espacio de almacenaje", "Tranquilidad para dormir"] },
    { id: "ent", n: "Entorno y ruido", d: "Lo que hay al salir y lo que se oye dentro", q: [
      "Ruido de la calle y del entorno", "Aspecto y ambiente del barrio",
      "Servicios a pie (comercio, colegios, transporte)", "Aparcamiento y acceso en coche"] },
    { id: "edi", n: "Edificio y comunidad", d: "Portal, escalera y vecinos", q: [
      "Portal, escalera y zonas comunes", "Ascensor y accesibilidad", "Vecinos y ambiente de la comunidad"] },
    { id: "est", n: "Solidez de la vivienda", d: "Lo difícil de arreglar (los acabados se estiman en «Obras»)", q: [
      "Humedades, instalaciones y ventanas", "Señales de problemas (grietas, olores, filtraciones)", "Sensación de «entrar a vivir»"] },
    { id: "ext", n: "Extras", d: "Si no hay alguno, márcalo como N/A", q: [
      "Terraza, balcón o patio", "Garaje", "Trastero", "Urbanización / zonas comunes con servicios"] },
    { id: "emo", n: "Sensación personal", d: "Lo que no cabe en una ficha", q: [
      "Primera impresión al entrar", "Me imagino viviendo aquí", "Me transmite sensación de hogar"] }
  ];
  const PASOS = 4 + C.length;   // inicio, inmueble, prioridades, visita (×10), obras, resultado

  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // «285.000» → 285000; «285.000,50» → 285000 (se ignoran los decimales)
  const num = (v) => parseInt(String(v == null ? "" : v).split(",")[0].replace(/[^\d]/g, ""), 10) || 0;
  let fmtNum;
  try { fmtNum = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }); }
  catch (e) { fmtNum = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }); }
  const r100 = (n) => Math.round(n / 100) * 100;
  const eur = (n) => fmtNum.format(r100(n)) + " €";
  const sg = (n) => (r100(n) === 0 ? "" : n > 0 ? "+" : "−") + eur(Math.abs(n));
  const pct = (n) => (Math.abs(n) < 0.0005 ? "0" : (n > 0 ? "+" : "−") + (Math.abs(n) * 100).toFixed(1).replace(".", ",")) + " %";
  const fdate = (d) => new Date(d || Date.now()).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const K_ESTADO = "euporia_visita_estado", K_LISTA = "euporia_visitas";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- Estado ---------- */
  const nuevo = () => ({ id: Date.now(), started: true, view: "setup", idx: 0,
    setup: { ref: "", precio: "", m2: "", comprador: "", contacto: "" },
    prio: {}, ans: {}, reforma: { nivel: "none", eur: "" }, intuicion: "", nota: "" });
  let S = store.get(K_ESTADO, null) || { started: false, view: "home" };
  let V = "home";
  const save = () => store.set(K_ESTADO, S);

  const ETIQUETA = { home: "Visitas", setup: "El inmueble", prio: "Tus prioridades", extra: "Obras y notas", result: "Tu valoración" };
  const stepIndex = () => V === "home" ? 0 : V === "setup" ? 1 : V === "prio" ? 2 : V === "visit" ? 3 + S.idx
    : V === "extra" ? 3 + C.length : PASOS;

  /* ---------- Render ---------- */
  function render(conservarScroll, primera) {
    const y = window.scrollY || 0;
    const vistas = { home, setup, prio, visit, extra, result };
    const barra = V === "home" ? "" :
      `<div class="v-prog" role="progressbar" aria-label="Avance de la visita" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${Math.round(stepIndex() / PASOS * 100)}"><i style="width:${stepIndex() / PASOS * 100}%"></i></div>`;
    root.innerHTML = barra + vistas[V]();
    if (conservarScroll) { window.scrollTo(0, y); return; }
    if (primera) return;
    const h = root.querySelector("h2");
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    root.scrollIntoView({ block: "start" });
  }
  function ir(v) { V = v; S.view = v; save(); render(false); }

  const nav = (atras, siguiente, etiqueta) =>
    `<div class="v-nav">${atras ? `<button class="btn ghost" type="button" ${atras} aria-label="Atrás">←</button>` : ""}` +
    `<button class="btn grow" type="button" ${siguiente}>${etiqueta}</button></div>`;

  /* ---------- Inicio ---------- */
  function home() {
    const lista = store.get(K_LISTA, []);
    const enCurso = S.started && S.view && S.view !== "home";
    const cont = enCurso
      ? `<button class="btn block" type="button" data-act="resume">Continuar visita en curso${S.setup && S.setup.ref ? " · " + esc(S.setup.ref) : ""}</button>` : "";
    const filas = lista.map((v, i) => {
      const cls = v.gap >= 0.03 ? "pos" : v.gap <= -0.03 ? "neg" : "neu";
      const nombre = v.ref || "Vivienda visitada";
      return `<li class="v-row"><button class="v-main" type="button" data-act="open" data-i="${i}">
        <span class="v-t">${esc(nombre)}</span>
        <span class="v-s">${esc(v.comprador ? v.comprador + " · " : "")}${fdate(v.date)} · encaje ${v.score}/100</span></button>
        <span class="v-chip ${cls}">${pct(v.gap)}</span>
        <button class="v-x" type="button" data-act="del" data-i="${i}" aria-label="Borrar la visita ${esc(nombre)}">×</button></li>`;
    }).join("");
    return `<h2>Valora una visita</h2>
      <p class="v-lead">Puntúa lo que ves frente a lo que esperabas por el precio. Al terminar tendrás el valor que esa vivienda tiene para ti.</p>
      <button class="btn block${cont ? " ghost" : ""}" type="button" data-act="new">Nueva visita</button>
      ${cont}
      ${lista.length ? `<h3 class="v-sec">Visitas guardadas</h3>
        <p class="v-sec-s">La etiqueta es la diferencia entre el valor para ti y el precio anunciado.</p>
        <ul class="v-list">${filas}</ul>` : ""}
      <p class="v-disc">Tus visitas se guardan en este dispositivo. Al ver el resultado nos llegan la dirección, el precio y tus puntuaciones, para saber qué valoran los compradores. Tu nombre, tu contacto y tus notas no salen de aquí.</p>`;
  }

  /* ---------- Inmueble ---------- */
  function setup() {
    const s = S.setup;
    return `<p class="v-eyebrow">Paso 1 · El inmueble</p>
      <h2>¿Qué vivienda estás visitando?</h2>
      <p class="v-lead">El precio anunciado es el punto de partida: puntuar «3» en todo equivale a que la vivienda vale justo lo que piden.</p>
      <div class="v-fields">
        <label class="v-card campo"><span>Inmueble (calle, número o referencia)</span>
          <input type="text" data-f="ref" value="${esc(s.ref)}" placeholder="Ej. Calle Colón 12, 4ª" autocomplete="off"></label>
        <div class="v-row2">
          <label class="v-card campo"><span>Precio anunciado (€) *</span>
            <input type="text" inputmode="numeric" data-f="precio" value="${esc(s.precio)}" placeholder="285.000" autocomplete="off" required></label>
          <label class="v-card campo"><span>m² útiles</span>
            <input type="text" inputmode="numeric" data-f="m2" value="${esc(s.m2)}" placeholder="95" autocomplete="off"></label>
        </div>
        <div class="v-row2">
          <label class="v-card campo"><span>Nombre del comprador <small>(opcional)</small></span>
            <input type="text" data-f="comprador" value="${esc(s.comprador)}" autocomplete="off"></label>
          <label class="v-card campo"><span>Teléfono o email <small>(opcional)</small></span>
            <input type="text" data-f="contacto" value="${esc(s.contacto)}" autocomplete="off"></label>
        </div>
      </div>
      <p class="v-disc">El nombre y el contacto son solo para ti: se quedan en este dispositivo. La dirección y el precio nos llegan con tus puntuaciones al ver el resultado.</p>
      <p class="v-err" id="v-err" role="alert"></p>
      ${nav('data-act="to" data-to="home"', 'data-act="setup-next"', "Siguiente: prioridades →")}`;
  }

  /* ---------- Prioridades ---------- */
  function prio() {
    const filas = C.map((c) => {
      const p = S.prio[c.id] || "imp";
      const b = (k) => `<button type="button" aria-pressed="${p === k}" class="${p === k ? "on" : ""}" data-act="prio" data-c="${c.id}" data-k="${k}">${PRIO[k]}</button>`;
      return `<div class="v-card v-prow" role="group" aria-label="Prioridad de ${esc(c.n)}">
        <div class="v-pn">${c.n}</div><div class="v-pd">${c.d}</div><div class="v-seg">${b("ess")}${b("imp")}${b("sec")}</div></div>`;
    }).join("");
    return `<p class="v-eyebrow">Paso 2 · Antes de entrar</p>
      <h2>¿Qué es lo que <em>más pesa</em> para ti?</h2>
      <p class="v-lead">Un concepto «Esencial» pesa el triple que uno «Secundario». Si algo no te importa, márcalo como secundario.</p>
      ${filas}
      ${nav('data-act="to" data-to="setup"', 'data-act="start"', "Empezar la visita →")}`;
  }

  /* ---------- Visita ---------- */
  function visit() {
    const c = C[S.idx], p = S.prio[c.id] || "imp", ultimo = S.idx === C.length - 1;
    const preguntas = c.q.map((q, i) => {
      const v = S.ans[c.id + i], idq = `q-${c.id}-${i}`;
      const botones = [1, 2, 3, 4, 5].map((n) =>
        `<button type="button" aria-pressed="${v === n}" class="${v === n ? "on" : ""}" data-act="rate" data-c="${c.id}" data-i="${i}" data-v="${n}">${n}</button>`).join("");
      return `<div class="v-q${v === "na" ? " na" : ""}" role="group" aria-labelledby="${idq}">
        <div class="v-qt" id="${idq}">${q}</div>
        <div class="v-scale">${botones}<button type="button" class="na-b${v === "na" ? " on" : ""}" aria-pressed="${v === "na"}" aria-label="No aplica" data-act="rate" data-c="${c.id}" data-i="${i}" data-v="na">N/A</button></div>
        <div class="v-sc-lbl" aria-hidden="true"><span>Peor</span><span>Como esperaba</span><span>Mejor</span></div></div>`;
    }).join("");
    return `<p class="v-cnt">${S.idx + 1} de ${C.length}</p>
      <h2>${c.n}<span class="v-tag">${PRIO[p]}</span></h2>
      <p class="v-lead v-lead-s">${c.d}</p>
      <div class="v-legend">Puntúa comparando con <strong>lo que esperabas por este precio</strong>: 3 = como esperaba, 1 = mucho peor, 5 = mucho mejor.</div>
      ${preguntas}
      <button class="v-link" type="button" data-act="skipc">Este apartado no aplica / no lo he visto</button>
      ${nav('data-act="prev"', 'data-act="next"', ultimo ? "Terminar visita →" : "Siguiente: " + esc(C[S.idx + 1].n) + " →")}`;
  }

  /* ---------- Obras y notas ---------- */
  const RCH = [["none", "Sin obras", "Entrar a vivir"], ["cosm", "Cosmética", "Pintura, suelos, pequeños arreglos"],
    ["media", "Reforma media", "Cocina o baños"], ["integral", "Reforma integral", "Todo"]];
  function extra() {
    const r = S.reforma, m2 = num(S.setup.m2);
    const chips = RCH.map(([k, t, d]) => {
      const tasa = CONFIG.REFORMA[k];
      return `<button type="button" class="v-rchip${r.nivel === k ? " on" : ""}" aria-pressed="${r.nivel === k}" data-act="reforma" data-k="${k}">
        <span>${t}<small>${d}</small></span><small>${tasa ? "≈ " + tasa + " €/m²" : "0 €"}</small></button>`;
    }).join("");
    return `<p class="v-eyebrow">Último paso</p>
      <h2>Obras que <em>harías</em></h2>
      <p class="v-lead">Su coste se resta aparte del valor percibido (por eso la cocina y los baños se puntúan por tamaño y encaje, no por su estado).${m2 ? "" : " Si no indicaste los m², escribe el importe a mano."}</p>
      <div class="v-chips">${chips}</div>
      <label class="v-card campo v-mt"><span>Importe estimado de obras (€)</span>
        <input type="text" inputmode="numeric" data-f="reforma" value="${esc(r.eur)}" placeholder="0" autocomplete="off"></label>
      <label class="v-card campo v-mt"><span>A ojo: ¿cuánto pagarías ahora mismo? <small>(opcional)</small></span>
        <input type="text" inputmode="numeric" data-f="intuicion" value="${esc(S.intuicion)}" placeholder="Tu intuición antes de ver el cálculo" autocomplete="off"></label>
      <label class="v-card campo v-mt"><span>En tus palabras <small>(opcional)</small></span>
        <textarea data-f="nota" placeholder="¿Qué te ha gustado? ¿Qué te ha frenado?">${esc(S.nota)}</textarea></label>
      ${nav('data-act="to-last"', 'data-act="to" data-to="result"', "Ver mi valoración →")}`;
  }

  /* ---------- Cálculo ---------- */
  function calcular() {
    const precio = num(S.setup.precio);
    let n = 0, d = 0, total = 0, atendidos = 0;
    const por = [];
    C.forEach((c) => {
      let suma = 0, cuenta = 0, unos = 0;
      c.q.forEach((_, i) => {
        const v = S.ans[c.id + i]; total++;
        if (v === "na") atendidos++;
        else if (v >= 1) { atendidos++; suma += v; cuenta++; if (v === 1) unos++; }
      });
      const w = PESO[S.prio[c.id] || "imp"];
      if (!cuenta) { por.push({ c, w, avg: null, unos: 0, x: 0, eur: 0 }); return; }
      const avg = suma / cuenta, x = w * (avg - 3) / 2;
      n += x; d += w;
      por.push({ c, w, avg, unos, x, eur: 0 });
    });
    const D = d ? n / d : 0;
    por.forEach((p) => { p.eur = d && p.avg !== null ? p.x / d * CONFIG.MAX_ADJ * precio : 0; });
    const valor = precio * (1 + D * CONFIG.MAX_ADJ), obras = num(S.reforma.eur), neto = valor - obras;
    return { precio, D, valor, obras, neto, bajo: neto * (1 - CONFIG.BAND), alto: neto * (1 + CONFIG.BAND),
      gap: precio ? (neto - precio) / precio : 0, score: Math.round(50 + D * 50),
      cobertura: total ? atendidos / total : 0, respondido: d > 0, por };
  }
  function veredicto(g) {
    if (g >= 0.03) return ["pos", "Para ti vale más de lo que piden", "Con lo que has visto y lo que buscas, el precio anunciado queda por debajo del valor que esta vivienda tiene para ti."];
    if (g > -0.03) return ["neu", "Para ti vale lo que piden", "Tus percepciones y el precio anunciado están alineados: no hay una brecha relevante entre lo que cuesta y lo que te aporta."];
    if (g > -0.10) return ["neg", "Piden algo más de lo que para ti vale", "Hay una diferencia moderada entre el precio y el valor que le das. Los conceptos que más restan te dicen dónde está."];
    return ["neg", "Hay una brecha importante con el precio", "La diferencia entre lo que piden y lo que esta vivienda te aporta es amplia. Conviene revisar qué conceptos pesan más en esa distancia."];
  }
  function historia(r) {
    const act = r.por.filter((p) => p.avg !== null);
    const suma = act.filter((p) => p.eur > 0).sort((a, b) => b.eur - a.eur).slice(0, 2).map((p) => p.c.n.toLowerCase());
    const resta = act.filter((p) => p.eur < 0).sort((a, b) => a.eur - b.eur).slice(0, 2).map((p) => p.c.n.toLowerCase());
    let t = "";
    if (suma.length) t += `Lo que más suma a tus ojos: ${suma.join(" y ")}. `;
    if (resta.length) t += `Lo que más resta: ${resta.join(" y ")}. `;
    return t.trim() || "Tus puntuaciones han sido muy parejas, sin conceptos que destaquen para bien o para mal.";
  }
  const alertas = (r) => r.por.filter((p) => p.w === 3 && p.avg !== null && (p.avg <= 2.2 || p.unos > 0))
    .map((p) => `<div class="v-alert"><strong>${p.c.n}</strong> es esencial para ti y la has valorado por debajo de lo que esperabas.</div>`).join("");

  /* ---------- Resultado ---------- */
  function result() {
    const r = calcular();
    if (!r.respondido) {
      return `<h2>Faltan respuestas</h2><p class="v-lead">Puntúa al menos un concepto para poder calcular el valor.</p>
        ${nav('data-act="edit"', 'data-act="edit"', "Volver a la visita →")}`;
    }
    persistir(r);
    enviarEstadistica(r);
    const [cls, titulo, texto] = veredicto(r.gap);
    const maxE = Math.max(1, ...r.por.map((p) => Math.abs(p.eur)));
    const barras = r.por.map((p) => {
      if (p.avg === null) return `<div class="v-dv"><div class="v-dv-h"><span>${p.c.n}</span><span class="v-dv-v mut">no valorado</span></div></div>`;
      const w = Math.round(Math.abs(p.eur) / maxE * 100);
      const vc = r100(p.eur) === 0 ? "mut" : p.eur > 0 ? "pos" : "neg";
      return `<div class="v-dv"><div class="v-dv-h"><span>${p.c.n}<span class="v-tag">${PRIO[S.prio[p.c.id] || "imp"]}</span></span>
        <span class="v-dv-v ${vc}">${sg(p.eur)}</span></div>
        <div class="v-dv-t"><div class="neg">${p.eur < 0 ? `<i style="width:${w}%"></i>` : ""}</div><div class="pos">${p.eur > 0 ? `<i style="width:${w}%"></i>` : ""}</div></div></div>`;
    }).join("");
    const intu = num(S.intuicion);
    const bloqueIntu = intu ? `<h3 class="v-sec">Tu intuición frente al cálculo</h3>
      <div class="v-card"><p class="v-p">A ojo pagarías <strong>${eur(intu)}</strong>; el cálculo sale en <strong>${eur(r.neto)}</strong> (${sg(r.neto - intu) || "0 €"} de diferencia).</p></div>` : "";
    const aviso = r.cobertura < 0.5 ? `<div class="v-warn">Has valorado menos de la mitad de los puntos. Con más respuestas el resultado será más fiable.
      <button class="v-link" type="button" data-act="edit">Completar respuestas</button></div>` : "";
    const m = S.setup;
    return `<div class="v-hero">
        <p class="v-ref">${esc(m.ref || "Vivienda visitada")}${m.comprador ? " · " + esc(m.comprador) : ""} · ${fdate(S.id)}</p>
        <p class="v-lbl">Valor para ti</p>
        <p class="v-big">${eur(r.neto)}</p>
        <p class="v-pill ${cls}">${titulo}</p>
        <p class="v-story">${esc(historia(r))}</p>
        <p class="v-nota-valor">Es tu valoración personal de esta visita: no es una tasación ni dice si el precio es el de mercado.</p>
      </div>
      ${aviso}
      <div class="v-boxes">
        <div class="v-box"><span class="bl">Precio anunciado</span><span class="bv">${eur(r.precio)}</span></div>
        <div class="v-box hl"><span class="bl">Valor para ti</span><span class="bv">${eur(r.neto)}</span></div>
        <div class="v-box"><span class="bl">Diferencia</span><span class="bv">${sg(r.neto - r.precio) || "0 €"}<small>${pct(r.gap)}</small></span></div>
      </div>
      <p class="v-note-s">Horquilla razonable: ${eur(r.bajo)} – ${eur(r.alto)}<br>
        Valor percibido ${eur(r.valor)}${r.obras ? " − obras " + eur(r.obras) : ""}. ${texto}</p>
      ${alertas(r)}
      <h3 class="v-sec">Encaje con lo que buscas</h3>
      <p class="v-sec-s">50 = la vivienda es justo lo que esperabas por su precio. Más es mejor de lo esperado; menos, peor.</p>
      <p class="v-score">${r.score}<small> / 100</small></p>
      <div class="v-scorebar" role="img" aria-label="Encaje ${r.score} sobre 100"><i style="width:${r.score}%"></i></div>
      <h3 class="v-sec">Qué mueve el valor</h3>
      <p class="v-sec-s">Cuánto suma o resta cada concepto sobre el precio anunciado, según tu puntuación y la prioridad que le diste.</p>
      ${barras}
      ${bloqueIntu}
      ${S.nota ? `<h3 class="v-sec">En tus palabras</h3><div class="v-card"><p class="v-quote">${esc(S.nota)}</p></div>` : ""}
      <p class="v-disc">¿Sabes cuánta hipoteca puedes pedir para esta vivienda? <a class="link" href="/off-market/cuanta-hipoteca-puedo-pedir/?precio=${num(m.precio) || ""}#calculadora">Calcúlalo aquí</a>.</p>
      ${negociacion()}
      <div class="v-acts">
        <button class="btn" type="button" data-act="wa-share">Compartir por WhatsApp</button>
        <button class="btn ghost" type="button" data-act="wa-euporia">Comentarlo con Euporia por WhatsApp</button>
        <button class="btn ghost" type="button" data-act="copy">Copiar resumen</button>
        <button class="btn ghost" type="button" data-act="print">Imprimir / guardar PDF</button>
        <button class="btn ghost" type="button" data-act="edit">Editar respuestas</button>
        <button class="btn ghost" type="button" data-act="finish">Cerrar y volver al inicio</button>
      </div>
      <p class="v-foot">Valoración orientativa basada en tu percepción durante la visita. No constituye tasación oficial homologada. Euporia · Valencia.</p>`;
  }
  /* ---------- Estadística (hoja «Visitas») ----------
     Sin nombre, contacto ni nota. Se reenvía solo si cambian las respuestas; el Apps Script
     sustituye la fila de la misma visita, así que cada visita es una fila. */
  const K_ENVIADAS = "euporia_visitas_enviadas";
  function datosEstadistica(r) {
    const d = { tipo: "visita", visita_id: String(S.id), direccion: S.setup.ref || "",
      precio_anunciado: r.precio, m2: num(S.setup.m2) || "", valor_para_ti: Math.round(r.neto),
      diferencia_pct: Math.round(r.gap * 1000) / 10, encaje: r.score, cobertura_pct: Math.round(r.cobertura * 100),
      obras_nivel: S.reforma.nivel || "", obras_eur: num(S.reforma.eur) || 0, intuicion: num(S.intuicion) || "",
      respuestas: JSON.stringify(S.ans) };
    r.por.forEach((p) => {
      d[p.c.id + "_prioridad"] = PRIO[S.prio[p.c.id] || "imp"];
      d[p.c.id + "_media"] = p.avg === null ? "" : Math.round(p.avg * 100) / 100;
    });
    return d;
  }
  function enviarEstadistica(r) {
    if (!SITE.endpoint) return;
    const d = datosEstadistica(r), huella = JSON.stringify(d);
    const enviadas = store.get(K_ENVIADAS, {});
    if (enviadas[d.visita_id] === huella) return;
    d.pagina = location.origin + location.pathname;
    fetch(SITE.endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(d) })
      .then((res) => res.json()).then((j) => {
        if (!j || !j.ok) return;
        enviadas[d.visita_id] = huella;
        store.set(K_ENVIADAS, Object.fromEntries(Object.entries(enviadas).slice(-30)));
        if (window.EuporiaMedir) window.EuporiaMedir("herramienta_completada", { herramienta: "visita" });
      }).catch(() => {});
  }

  /* ---------- «Negociadlo por mí» (hoja «Negociaciones») ----------
     Aquí sí van nombre, contacto, dirección, nota y resumen: los da la persona, con su consentimiento. */
  function negociacion() {
    if (!SITE.endpoint && !SITE.whatsapp) return "";
    const m = S.setup;
    return `<details class="v-card v-nego">
        <summary><strong>¿Quieres que negociemos el precio por ti?</strong><br>
          <span class="v-sec-s">Si no te atreves o prefieres que lo haga un profesional, te llamamos y lo vemos con tu valoración delante. Sin compromiso.</span></summary>
        <form class="v-nego-form" novalidate>
          <label class="campo"><span>Nombre</span><input type="text" name="nombre" value="${esc(m.comprador)}" autocomplete="name" required></label>
          <label class="campo"><span>Teléfono o email</span><input type="text" name="contacto" value="${esc(m.contacto)}" autocomplete="tel" required></label>
          <label class="campo"><span>¿Algo más que debamos saber? <small>(opcional)</small></span><textarea name="mensaje" placeholder="Plazos, financiación, hasta dónde llegarías…"></textarea></label>
          <label class="check"><input type="checkbox" name="acepta_privacidad" value="sí" required> <span>Acepto que uséis estos datos y mi valoración para contactarme sobre esta vivienda. <a class="link" href="/aviso-legal/">Privacidad</a></span></label>
          <div class="hp" aria-hidden="true"><label>Web <input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
          <button class="btn" type="submit">Quiero que lo negociéis</button>
          <p class="estado-envio" role="status" aria-live="polite"></p>
        </form>
      </details>`;
  }
  root.addEventListener("submit", async (ev) => {
    const form = ev.target.closest(".v-nego-form");
    if (!form) return;
    ev.preventDefault();
    const E = window.EuporiaComun, estado = form.querySelector(".estado-envio"), boton = form.querySelector('button[type="submit"]');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const f = Object.fromEntries(new FormData(form));
    if (f.web) return;
    const r = calcular();
    const datos = Object.assign(datosEstadistica(r), {
      tipo: "negociacion", nombre: f.nombre, contacto: f.contacto, mensaje: f.mensaje || "",
      nota: S.nota || "", resumen: resumen(), acepta_privacidad: f.acepta_privacidad, pagina: location.origin + location.pathname });
    boton.disabled = true; const txt = boton.textContent; boton.textContent = "Enviando…";
    const res = E ? await E.enviar(datos) : "error";
    boton.textContent = txt;
    if (res === "ok") {
      estado.textContent = "Recibido. Te llamaremos o escribiremos para preparar la negociación. No hace falta que decidas nada todavía.";
      form.querySelectorAll("input, textarea").forEach((i) => { i.disabled = true; });
    } else {
      boton.disabled = false;
      if (E) E.avisoNoEnviado(estado, res); else estado.textContent = "No se ha podido enviar. Vuelve a intentarlo.";
    }
  });

  function persistir(r) {
    const lista = store.get(K_LISTA, []);
    const it = { id: S.id, date: S.id, ref: S.setup.ref, comprador: S.setup.comprador, precio: r.precio,
      neto: Math.round(r.neto), gap: r.gap, score: r.score, snap: JSON.parse(JSON.stringify(S)) };
    const i = lista.findIndex((x) => x.id === S.id);
    if (i >= 0) lista[i] = it; else lista.unshift(it);
    store.set(K_LISTA, lista.slice(0, 30));
  }

  /* ---------- Compartir ---------- */
  function resumen() {
    const r = calcular(), m = S.setup, [, titulo] = veredicto(r.gap);
    return [`Valoración de visita · ${m.ref || "Vivienda visitada"}`,
      `Precio anunciado: ${eur(r.precio)}`,
      `Valor para mí: ${eur(r.neto)} (${pct(r.gap)})`,
      `Horquilla: ${eur(r.bajo)} – ${eur(r.alto)}`,
      `Encaje: ${r.score}/100 · ${titulo}`,
      historia(r), "— Euporia"].join("\n");
  }
  function toast(t) {
    let e = document.getElementById("v-toast");
    if (!e) { e = document.createElement("div"); e.id = "v-toast"; e.setAttribute("role", "status"); document.body.append(e); }
    e.textContent = t; e.classList.add("show");
    setTimeout(() => e.classList.remove("show"), 1800);
  }

  /* ---------- Acciones (delegación de eventos) ---------- */
  root.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b || !root.contains(b)) return;
    const d = b.dataset, a = d.act;
    switch (a) {
      case "new": S = nuevo(); save(); ir("setup"); break;
      case "resume": ir(S.view && S.view !== "home" ? S.view : "setup"); break;
      case "open": { const it = store.get(K_LISTA, [])[+d.i]; if (it) { S = JSON.parse(JSON.stringify(it.snap)); ir("result"); } break; }
      case "del": {
        const lista = store.get(K_LISTA, []);
        if (!window.confirm("¿Borrar esta visita? No se puede deshacer.")) break;
        lista.splice(+d.i, 1); store.set(K_LISTA, lista); render(true); break;
      }
      case "to": ir(d.to); break;
      case "to-last": S.idx = C.length - 1; ir("visit"); break;
      case "setup-next":
        if (!num(S.setup.precio)) { root.querySelector("#v-err").textContent = "Introduce el precio anunciado para poder calcular."; break; }
        ir("prio"); break;
      case "prio": S.prio[d.c] = d.k; save(); render(true); break;
      case "start": S.idx = 0; ir("visit"); break;
      case "rate": {
        const k = d.c + d.i, v = d.v === "na" ? "na" : +d.v;
        if (S.ans[k] === v) delete S.ans[k]; else S.ans[k] = v;
        save(); render(true); break;
      }
      case "skipc": C[S.idx].q.forEach((_, i) => { S.ans[C[S.idx].id + i] = "na"; }); save(); render(true); break;
      case "prev": if (S.idx > 0) { S.idx--; save(); render(false); } else ir("prio"); break;
      case "next": if (S.idx < C.length - 1) { S.idx++; save(); render(false); } else ir("extra"); break;
      case "reforma": {
        const m2 = num(S.setup.m2), tasa = CONFIG.REFORMA[d.k];
        S.reforma.nivel = d.k;
        S.reforma.eur = tasa === 0 ? "" : (m2 ? String(tasa * m2) : S.reforma.eur);
        save(); render(true); break;
      }
      case "edit": S.idx = 0; ir("visit"); break;
      case "finish": S = { started: false, view: "home" }; save(); ir("home"); break;
      case "wa-share": window.open("https://wa.me/?text=" + encodeURIComponent(resumen()), "_blank", "noopener"); break;
      case "wa-euporia":
        if (SITE.whatsapp) window.open(`https://wa.me/${SITE.whatsapp}?text=` + encodeURIComponent("Hola, he valorado una visita con la calculadora de Euporia y me gustaría comentarla.\n\n" + resumen()), "_blank", "noopener");
        break;
      case "copy":
        try { navigator.clipboard.writeText(resumen()).then(() => toast("Resumen copiado"), () => toast("No se pudo copiar")); }
        catch (e) { toast("No se pudo copiar"); }
        break;
      case "print": window.print(); break;
    }
  });

  // Campos de texto: se guardan al escribir, sin repintar (para no perder el foco)
  root.addEventListener("input", (ev) => {
    const f = ev.target.dataset && ev.target.dataset.f;
    if (!f) return;
    const v = ev.target.value;
    if (f === "reforma") {
      S.reforma.eur = v; S.reforma.nivel = "custom";
      root.querySelectorAll(".v-rchip").forEach((c) => { c.classList.remove("on"); c.setAttribute("aria-pressed", "false"); });
    } else if (f === "intuicion" || f === "nota") S[f] = v;
    else S.setup[f] = v;
    save();
  });

  /* ---------- Arranque ----------
     Precarga opcional: /valorar-visita/?ref=Calle%20Colón%2012&precio=285000&m2=95
     (se ignora si hay una visita en curso, para no pisarla) */
  try {
    const q = new URLSearchParams(location.search);
    const enCurso = S.started && S.view && S.view !== "home";
    if (!enCurso && (q.get("precio") || q.get("ref"))) {
      S = nuevo();
      S.setup.ref = q.get("ref") || ""; S.setup.precio = q.get("precio") || ""; S.setup.m2 = q.get("m2") || "";
      save(); V = "setup";
    }
  } catch (e) {}
  render(false, true);
})();
