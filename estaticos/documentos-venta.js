/* =====================================================================
   Euporia · «Qué documentos necesitas para vender tu piso»
   La persona contesta unas preguntas sobre su caso (quién vende, hipoteca,
   herencia, alquiler…) y obtiene la lista de documentos que suele pedir el
   notario, agrupada, y marca los que ya tiene.
   No envía nada: respuestas y marcas se guardan solo en el navegador
   (localStorage, clave euporia_documentos_venta). «Pedir ayuda con lo que me
   falta» copia la lista de lo que falta en el formulario de la página y es la
   persona quien decide si lo envía. WhatsApp abre el texto ya escrito.
   Si cambias un documento, un aviso o una pregunta, revisa el texto, las
   preguntas frecuentes y las fuentes de contenido/documentos-para-vender.html.

   Casos de prueba (consola: EuporiaDocsVenta.lista({ ... }) devuelve los id):
   - lista({}) → dni, titulo, nota, ibi, cee, comunidad, cuenta, suministros, vref, ocupacion, planos
     (por defecto: particular, la compró, sin hipoteca, con comunidad; los tres últimos son opcionales)
   - lista({ hipoteca: "si" }) añade deuda · lista({ hipoteca: "pagada" }) añade cancelacion
   - lista({ casado: "separacion" }) añade conyuge y capitulaciones · lista({ casado: "gananciales" }) añade conyuge
   - lista({ quien: "sociedad", casado: "gananciales", origen: "herencia" }) no añade conyuge ni herencia;
     añade soc_constitucion, soc_cargo, soc_titular y soc_junta
   - lista({ comunidad: "no" }) quita comunidad · lista({ alquilada: "si" }) añade alquiler e inquilino
   - lista({ origen: "herencia_pendiente" }) añade herencia_hacer · lista({ vpo: "nose" }) añade vpo
   ===================================================================== */
(() => {
  "use strict";
  const form = document.getElementById("dv-form");
  const salida = document.getElementById("dv-resultado");

  /* ---------- Preguntas: id, texto, opciones [valor, texto], valor por defecto y resumen corto ---------- */
  const PREGUNTAS = [
    { id: "quien", t: "¿Quién vende?", c: "Vende", def: "persona",
      o: [["persona", "Una o varias personas"], ["sociedad", "Una sociedad"]] },
    { id: "casado", t: "¿Algún vendedor está casado?", c: "Matrimonio", def: "no", si: (r) => r.quien === "persona",
      o: [["no", "No"], ["gananciales", "Sí, en gananciales"], ["separacion", "Sí, en separación de bienes"], ["nose", "Sí, pero no sé en qué régimen"]] },
    { id: "origen", t: "¿Cómo llegó la vivienda al vendedor?", c: "Origen", def: "compra", si: (r) => r.quien === "persona",
      o: [["compra", "La compró"], ["herencia", "La heredó y la herencia ya está hecha"],
        ["herencia_pendiente", "Está a nombre de alguien que ha fallecido y la herencia no está hecha"],
        ["donacion", "Se la donaron"], ["divorcio", "Se la adjudicaron en un divorcio o al repartir bienes"]] },
    { id: "hipoteca", t: "¿Queda hipoteca?", c: "Hipoteca", def: "no",
      o: [["no", "No, o ya está cancelada"], ["si", "Sí, queda deuda por pagar"], ["pagada", "Está pagada, pero no sé si se canceló en el Registro"]] },
    { id: "comunidad", t: "¿Hay comunidad de propietarios?", c: "Comunidad", def: "si",
      o: [["si", "Sí, es un piso o está en una urbanización"], ["no", "No, es una casa independiente"]] },
    { id: "alquilada", t: "¿Hay inquilinos?", c: "Alquiler", def: "no",
      o: [["no", "No"], ["si", "Sí, está alquilada"]] },
    { id: "residente", t: "¿Algún vendedor tiene su residencia fiscal fuera de España?", c: "Residencia", def: "no",
      o: [["no", "No"], ["si", "Sí"]] },
    { id: "poder", t: "¿Firmaréis todos en persona?", c: "Firma", def: "si",
      o: [["si", "Sí"], ["no", "Alguien firmará con un poder"]] },
    { id: "vpo", t: "¿Es una vivienda de protección oficial?", c: "Protección oficial", def: "no",
      o: [["no", "No"], ["si", "Sí"], ["nose", "No lo sé"]] },
    { id: "arras", t: "¿Habéis firmado ya unas arras con el comprador?", c: "Arras", def: "no",
      o: [["no", "Todavía no"], ["si", "Sí"]] }
  ];
  const DEF = {};
  PREGUNTAS.forEach((q) => { DEF[q.id] = q.def; });
  const visible = (q, r) => !q.si || q.si(r);

  // Una sociedad no se casa ni hereda: esas respuestas no cuentan aunque estén guardadas
  function normalizar(r0) {
    const r = Object.assign({}, DEF, r0 || {});
    if (r.quien === "sociedad") { r.casado = "no"; r.origen = "compra"; }
    return r;
  }

  const L = (href, texto) => `<a class="link" href="${href}">${texto}</a>`;

  /* ---------- Grupos y documentos ---------- */
  const GRUPOS = [
    ["base", "Lo que te pedirá el notario", "En casi todas las ventas."],
    ["caso", "Por tu caso", "Según lo que has contestado."],
    ["firma", "Para cobrar y entregar la casa", ""],
    ["extra", "Conviene tenerlo", "No los pide el notario, pero ayudan a vender. No cuentan en el total."]
  ];

  const TITULO = {
    compra: "Escritura de compra",
    herencia: "Escritura de herencia (aceptación y adjudicación)",
    herencia_pendiente: "Escritura con la que la persona fallecida adquirió la vivienda",
    donacion: "Escritura de donación",
    divorcio: "Sentencia y convenio, o escritura, que te adjudicó la vivienda"
  };

  const DOCS = [
    { id: "dni", g: "base",
      t: (r) => r.quien === "sociedad" ? "DNI o NIE de quien firma por la sociedad" : "DNI o NIE de todos los propietarios",
      d: (r) => r.quien === "sociedad"
        ? "En vigor y en original: el del administrador o el apoderado que firma."
        : "En vigor y en original. Si alguno es extranjero, su NIE y su pasaporte o documento de identidad." },
    { id: "titulo", g: "base",
      t: (r) => r.quien === "sociedad" ? "Escritura con la que la sociedad adquirió la vivienda" : TITULO[r.origen],
      d: (r) => (r.origen === "divorcio"
        ? "La sentencia con el convenio regulador aprobado o la escritura de liquidación de bienes, inscrita en el Registro. "
        : "Es el documento que prueba de quién es la vivienda. ")
        + "Si no encuentras la copia, pídela a la notaría donde se firmó; si ya no existe, el Colegio Notarial te dice quién la guarda." },
    { id: "nota", g: "base", t: "Nota simple reciente del Registro",
      d: "Dice quién es el dueño y qué cargas tiene la vivienda. Pídela antes de anunciarla o de firmar unas arras. " + L("/documentos/nota-simple/", "Cómo pedirla y leerla") + "." },
    { id: "ibi", g: "base", t: "Último recibo del IBI",
      d: "Lleva la referencia catastral, que tiene que constar en la escritura. El notario te informará de si quedan deudas del impuesto: pasarían con la vivienda al comprador." },
    { id: "cee", g: "base", t: "Certificado energético registrado y su etiqueta",
      d: "Lo firma un técnico y se registra en la Generalitat. Vale diez años (cinco si la letra es G) y hace falta también para anunciar la vivienda. " + L("/documentos/certificado-energetico/", "Cómo conseguirlo") + "." },
    { id: "comunidad", g: "base", si: (r) => r.comunidad === "si", t: "Certificado de la comunidad de estar al corriente de pago",
      d: "Lo emite quien hace de secretario de la comunidad (a menudo, el administrador de fincas) con el visto bueno del presidente, en siete días naturales como máximo. Sin él, el notario no puede autorizar la venta, salvo que el comprador te exima expresamente. Pregunta también si hay derramas aprobadas y pactad por escrito quién las paga." },

    { id: "deuda", g: "caso", si: (r) => r.hipoteca === "si", t: "Certificado de deuda pendiente de la hipoteca",
      d: "Lo pide el titular a su banco con una fecha cercana a la firma: dice cuánto hay que pagar ese día para cancelarla. Lo habitual es pagarla con parte del precio en la misma firma y cancelarla después en el Registro. " + L("/familias/hipoteca/vender-casa-con-hipoteca/", "Vender tu casa con hipoteca") + "." },
    { id: "cancelacion", g: "caso", si: (r) => r.hipoteca === "pagada", t: "Certificado de deuda cero y cancelación en el Registro",
      d: "Si la hipoteca está pagada pero sigue en la nota simple, pide al banco el certificado de deuda cero y firma la escritura de cancelación. Conviene hacerlo antes de vender." },
    { id: "conyuge", g: "caso", si: (r) => r.quien === "persona" && r.casado !== "no", t: "Firma o consentimiento del cónyuge, y libro de familia",
      d: "Si la vivienda es ganancial (lo dice la nota simple), firmáis los dos. Si es solo de uno pero es la vivienda habitual de la familia, el otro también tiene que consentir la venta en la escritura. Lleva el libro de familia o el certificado de matrimonio." },
    { id: "capitulaciones", g: "caso", si: (r) => r.quien === "persona" && r.casado === "separacion", t: "Capitulaciones matrimoniales",
      d: "La escritura en la que pactasteis la separación de bienes, si la hicisteis. Si no la tenéis, coméntalo con el notario: él comprueba qué régimen os corresponde." },
    { id: "herencia", g: "caso", si: (r) => r.quien === "persona" && r.origen === "herencia", t: "Justificantes de los impuestos de la herencia",
      d: "El del impuesto de sucesiones y el de la plusvalía municipal de la herencia. Si la nota simple muestra una afección fiscal, con ellos se aclara. " + L("/familias/vivienda-heredada/", "Qué hacer con una vivienda heredada") + "." },
    { id: "herencia_hacer", g: "caso", si: (r) => r.quien === "persona" && r.origen === "herencia_pendiente", t: "Los documentos para hacer la herencia",
      d: "Certificado de defunción, certificado de últimas voluntades y testamento, o declaración de herederos si no lo hay. " + L("/familias/vivienda-heredada/casa-a-nombre-de-un-fallecido/", "Casa a nombre de un fallecido: los pasos") + "." },
    { id: "alquiler", g: "caso", si: (r) => r.alquilada === "si", t: "Contrato de alquiler",
      d: "El comprador tiene que saber en qué condiciones está alquilada. Mira también si el inquilino renunció en el contrato a su derecho a comprar antes que nadie." },
    { id: "inquilino", g: "caso", si: (r) => r.alquilada === "si", t: "Comunicación de la venta al inquilino",
      d: "Si no renunció, el inquilino puede comprar por el mismo precio y en las mismas condiciones: hay que comunicárselo de forma fehaciente (por ejemplo, por burofax o ante notario) y tiene 30 días naturales para decidir. Para inscribir la venta en el Registro hay que justificar que se le notificó." },
    { id: "poder", g: "caso", si: (r) => r.poder === "no", t: "Poder notarial de quien firme por otro",
      d: "Copia autorizada, en vigor y que permita vender esta vivienda. Enséñalo antes al notario para que compruebe que sirve. Si se firmó en el extranjero, puede necesitar apostilla y traducción." },
    { id: "soc_constitucion", g: "caso", si: (r) => r.quien === "sociedad", t: "Escritura de constitución y estatutos de la sociedad",
      d: "Con su NIF. El notario comprueba con ellos qué puede hacer la sociedad y quién la representa." },
    { id: "soc_cargo", g: "caso", si: (r) => r.quien === "sociedad", t: "Nombramiento del administrador o poder de quien firma",
      d: "Inscrito en el Registro Mercantil. Si la sociedad no ha depositado sus cuentas, el Registro cierra su hoja y no se pueden inscribir nombramientos ni poderes nuevos: compruébalo con tiempo." },
    { id: "soc_titular", g: "caso", si: (r) => r.quien === "sociedad", t: "Datos del titular real",
      d: "Quién controla de verdad la sociedad (por ejemplo, quien tiene más del 25 % del capital). El notario lo comprueba en su base de datos; si no coincide, se firma un acta de titularidad real." },
    { id: "soc_junta", g: "caso", si: (r) => r.quien === "sociedad", t: "Acuerdo de la junta, si la vivienda es un activo esencial",
      d: "Se presume que lo es si la venta supera el 25 % del valor de los activos del último balance aprobado. En ese caso, lleva el certificado del acuerdo de la junta; si no lo es, el administrador lo declara en la escritura." },
    { id: "vpo", g: "caso", si: (r) => r.vpo !== "no", t: "Calificación definitiva de la vivienda protegida",
      d: (r) => (r.vpo === "nose" ? "Mira primero la escritura o la nota simple: si es protegida, lo dicen. " : "")
        + "Mientras dura la protección, hay un precio máximo de venta y la Generalitat tiene derecho a comprarla antes que nadie: hay que comunicarle la venta. Consúltalo con la Conselleria de Vivienda antes de fijar el precio." },
    { id: "arras", g: "caso", si: (r) => r.arras === "si", t: "Contrato de arras y justificantes de lo cobrado",
      d: "Lo que ya te han pagado se descuenta del precio, y en la escritura tiene que constar cómo se pagó." },

    { id: "cuenta", g: "firma", t: "Certificado de titularidad de la cuenta donde cobrarás",
      d: "En la escritura tiene que constar cómo se paga el precio. Si cobras por transferencia, tu banco te da este certificado con la cuenta y sus titulares." },
    { id: "suministros", g: "firma", t: "Últimos recibos de luz, agua y gas",
      d: "Para cambiar los contratos de nombre y anotar la lectura de los contadores el día de la entrega." },

    { id: "vref", g: "extra", t: "Valor de referencia del Catastro",
      d: "El comprador pagará su impuesto como mínimo sobre esa cifra, así que conviene conocerla al fijar el precio. " + L("/documentos/valor-de-referencia/", "Cómo consultarlo") + "." },
    { id: "ocupacion", g: "extra", t: "Licencia o declaración de ocupación (la antigua cédula de habitabilidad)",
      d: "En la venta de una vivienda usada no suele ser un requisito de la escritura, pero el comprador puede pedirla. Si existe, consta en el ayuntamiento." },
    { id: "planos", g: "extra", t: "Planos o un croquis con medidas",
      d: "Ayudan a enseñar la casa y a resolver dudas de superficie. " + L("/documentos/planos-de-la-vivienda/", "Dónde están los planos") + " o " + L("/documentos/planos-de-la-vivienda/croquis/", "haz tu croquis") + "." }
  ];

  const AVISOS = [
    { si: (r) => r.quien === "persona" && r.origen === "herencia_pendiente",
      t: "<strong>Primero, la herencia.</strong> Para venderla, la vivienda tiene que estar a nombre de los herederos. Se puede preparar todo a la vez y firmar la herencia y la venta el mismo día, una detrás de otra." },
    { si: (r) => r.hipoteca === "si",
      t: "<strong>Si lo que debes se acerca a lo que vale la casa,</strong> revisa las cuentas antes de comprometerte con unas arras: " + L("/familias/hipoteca/vender-casa-con-hipoteca/", "las cuentas de vender con hipoteca") + "." },
    { si: (r) => r.alquilada === "si",
      t: "<strong>Vivienda alquilada:</strong> cuenta en el calendario con los 30 días naturales que tiene el inquilino para decidir, salvo que renunciara en el contrato." },
    { si: (r) => r.residente === "si",
      t: "<strong>Si vives fuera de España:</strong> el comprador retendrá el 3 % del precio y lo ingresará en Hacienda (modelo 211). Después declaras la venta (modelo 210) y, si te corresponde, recuperas la diferencia. Háblalo antes con un asesor fiscal." },
    { si: (r) => r.vpo === "si",
      t: "<strong>Vivienda protegida:</strong> no fijes el precio ni firmes arras sin comprobar el precio máximo y comunicar la venta a la Generalitat." }
  ];

  const NOTA = "Es una lista orientativa: el notario de la operación te confirmará la definitiva. Después de firmar quedan la plusvalía municipal, que normalmente paga quien vende, y declarar la venta en la renta. Guarda la escritura de compra y las facturas de mejoras, y pregunta a un asesor fiscal si tu caso tiene alguna exención.";

  const txt = (v, r) => (typeof v === "function" ? v(r) : v);
  const aplica = (d, r) => !d.si || d.si(r);
  function lista(r0) { const r = normalizar(r0); return DOCS.filter((d) => aplica(d, r)).map((d) => d.id); }
  window.EuporiaDocsVenta = { lista };
  if (!form || !salida) return;

  /* ---------- Utilidades y almacenamiento ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plano = (s) => String(s).replace(/<[^>]+>/g, "");
  const CLAVE = "euporia_documentos_venta";
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    del() { try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ } }
  };
  const guardado = store.get() || {};
  const estado = { r: normalizar(guardado.r), ok: guardado.ok && typeof guardado.ok === "object" ? guardado.ok : {} };
  const guardar = () => store.set({ r: estado.r, ok: estado.ok });

  /* ---------- Formulario ---------- */
  function montar() {
    const r = estado.r;
    form.innerHTML = `
      <h2>Tu caso</h2>
      <p>Contesta lo que sepas: la lista cambia con cada respuesta. Si dudas, deja la opción que viene marcada.</p>
      <p class="vc-guardado">Las respuestas se guardan solo en este dispositivo. No se envían a ningún sitio.</p>
      ${PREGUNTAS.map((q) => `<fieldset class="dv-q" data-q="${q.id}"${visible(q, r) ? "" : " hidden"}>
        <legend>${esc(q.t)}</legend>
        <div class="vc-op">${q.o.map(([v, t]) => `<label><input type="radio" name="${q.id}" value="${v}"${r[q.id] === v ? " checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>
      </fieldset>`).join("")}
      <button class="btn" type="submit">Ver mi lista</button>
      <div class="vc-fin"><button class="vc-borrar" type="button" data-borrar>Empezar de cero</button></div>`;
  }
  function leer() {
    const r = {};
    PREGUNTAS.forEach((q) => {
      const el = form.querySelector(`input[name="${q.id}"]:checked`);
      r[q.id] = el ? el.value : q.def;
    });
    return normalizar(r);
  }

  /* ---------- Resultado ---------- */
  let docs = [], medido = false;
  const necesarios = () => docs.filter((d) => d.g !== "extra");
  function cuenta() {
    const nec = necesarios();
    return { ok: nec.filter((d) => estado.ok[d.id]).length, total: nec.length };
  }
  function textoFalta(c) {
    const faltan = c.total - c.ok;
    if (!faltan) return "Lo tienes todo. Repasa los avisos y enséñale la lista al notario antes de la firma.";
    if (!c.ok) return "Marca los que ya tienes y verás lo que te falta.";
    return `Te ${faltan === 1 ? "falta 1" : "faltan " + faltan}. Márcalos cuando los consigas.`;
  }
  const item = (d, r) => `<li class="dv-doc${estado.ok[d.id] ? " ok" : ""}" data-doc="${d.id}">
      <label class="dv-t"><input type="checkbox" data-ok="${d.id}"${estado.ok[d.id] ? " checked" : ""}><span>${esc(txt(d.t, r))}</span></label>
      <p class="dv-d">${txt(d.d, r)}</p>
    </li>`;

  function pintar() {
    const r = leer();
    estado.r = r;
    PREGUNTAS.forEach((q) => { const fs = form.querySelector(`[data-q="${q.id}"]`); if (fs) fs.hidden = !visible(q, r); });
    guardar();
    docs = DOCS.filter((d) => aplica(d, r));
    const avisos = AVISOS.filter((a) => a.si(r));
    const c = cuenta();
    salida.innerHTML = `
      <div class="calc-hero">
        <p class="calc-lbl">Tu lista para el notario</p>
        <p class="calc-big"><span data-cuenta>${c.ok}</span> <small>de ${c.total} documentos listos</small></p>
        <p class="calc-sub" data-falta>${textoFalta(c)}</p>
        <div class="dv-barra" aria-hidden="true"><i data-barra style="width:${c.total ? Math.round(c.ok / c.total * 100) : 0}%"></i></div>
      </div>
      ${avisos.length ? `<ul class="calc-avisos">${avisos.map((a) => `<li>${a.t}</li>`).join("")}</ul>` : ""}
      ${GRUPOS.map(([g, titulo, sub]) => {
        const del = docs.filter((d) => d.g === g);
        if (!del.length) return "";
        return `<section class="dv-grupo"><h3>${titulo}${sub ? `<small>${sub}</small>` : ""}</h3>
          <ul class="dv-lista">${del.map((d) => item(d, r)).join("")}</ul></section>`;
      }).join("")}
      <div class="calc-claves"><p class="calc-nota">${NOTA}</p></div>`;
    const acciones = document.getElementById("dv-acciones");
    if (acciones) acciones.hidden = false;
  }

  // Al marcar un documento no se vuelve a pintar la lista: así no se pierde el foco
  const anuncio = document.getElementById("dv-anuncio");
  function actualizarCuenta() {
    const c = cuenta();
    const n = salida.querySelector("[data-cuenta]"), f = salida.querySelector("[data-falta]"), b = salida.querySelector("[data-barra]");
    if (n) n.textContent = c.ok;
    if (f) f.textContent = textoFalta(c);
    if (b) b.style.width = (c.total ? Math.round(c.ok / c.total * 100) : 0) + "%";
    if (anuncio) anuncio.textContent = `${c.ok} de ${c.total} documentos marcados.`;
    if (!medido && c.ok >= 3 && window.EuporiaMedir) {
      medido = true; window.EuporiaMedir("herramienta_completada", { herramienta: "documentos-venta" });
    }
  }
  salida.addEventListener("change", (e) => {
    const caja = e.target.closest && e.target.closest("[data-ok]");
    if (!caja) return;
    if (caja.checked) estado.ok[caja.dataset.ok] = true; else delete estado.ok[caja.dataset.ok];
    const li = caja.closest("[data-doc]");
    if (li) li.classList.toggle("ok", caja.checked);
    guardar();
    actualizarCuenta();
  });

  /* ---------- Textos para compartir, pedir ayuda e imprimir ---------- */
  function partes() {
    const r = estado.r, nec = necesarios();
    return { r, tengo: nec.filter((d) => estado.ok[d.id]), falta: nec.filter((d) => !estado.ok[d.id]) };
  }
  function texto() {
    const { r, tengo, falta } = partes();
    return ["*Documentos para vender mi vivienda*", "Lista hecha con la herramienta de Euporia",
      falta.length ? "*Me falta:*\n" + falta.map((d) => "- " + plano(txt(d.t, r))).join("\n") : "*Los tengo todos.*",
      tengo.length ? "*Ya tengo:*\n" + tengo.map((d) => "- " + plano(txt(d.t, r))).join("\n") : "",
      location.origin + location.pathname].filter(Boolean).join("\n\n");
  }

  function pedirAyuda() {
    const banda = document.getElementById("contacto");
    const f = banda && banda.querySelector('form[data-form="documento"]');
    if (!f) { if (banda) banda.scrollIntoView({ behavior: "smooth" }); return; }
    const { r, falta } = partes();
    const sel = f.querySelector('select[name="documento"]');
    if (sel && sel.querySelector('option[value="venta"]')) sel.value = "venta";
    const ta = f.querySelector('textarea[name="mensaje"]');
    if (ta && (!ta.value.trim() || ta.dataset.auto === "1")) {
      ta.value = falta.length
        ? "Para vender mi vivienda me falta:\n" + falta.map((d) => "- " + plano(txt(d.t, r))).join("\n")
        : "Tengo todos los documentos de la lista y quiero que los revisemos antes de la firma.";
      ta.dataset.auto = "1";
      if (!ta.dataset.escucha) { ta.dataset.escucha = "1"; ta.addEventListener("input", () => { ta.dataset.auto = "0"; }); }
    }
    banda.scrollIntoView({ behavior: "smooth", block: "start" });
    const nombre = f.querySelector('input[name="nombre"]');
    if (nombre) setTimeout(() => nombre.focus({ preventScroll: true }), 400);
  }

  function hoja() {
    const r = estado.r, c = cuenta();
    const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    const resumen = PREGUNTAS.filter((q) => visible(q, r)).map((q) => {
      const op = q.o.find((o) => o[0] === r[q.id]);
      return `${esc(q.c)}: ${esc(op ? op[1] : "")}`;
    }).join(" · ");
    const avisos = AVISOS.filter((a) => a.si(r));
    return `<header class="dv-h-cab"><p class="dv-h-marca">Euporia</p><h2>Documentos para vender la vivienda</h2>
        <p>${esc(fecha)} · ${c.ok} de ${c.total} documentos listos</p><p class="dv-h-caso">${resumen}</p></header>
      ${GRUPOS.map(([g, titulo]) => {
        const del = docs.filter((d) => d.g === g);
        if (!del.length) return "";
        return `<h3>${titulo}</h3><ul class="dv-h-lista">${del.map((d) => `<li><span class="dv-h-caja">${estado.ok[d.id] ? "✓" : ""}</span>
          <div><strong>${esc(plano(txt(d.t, r)))}</strong><small>${esc(plano(txt(d.d, r)))}</small></div></li>`).join("")}</ul>`;
      }).join("")}
      ${avisos.length ? `<h3>Avisos</h3><ul class="dv-h-avisos">${avisos.map((a) => `<li>${esc(plano(a.t))}</li>`).join("")}</ul>` : ""}
      <p class="dv-h-nota">${NOTA}</p>
      <p class="dv-h-nota">Hecho con la herramienta de Euporia: ${esc(location.origin + location.pathname)}</p>`;
  }

  /* ---------- Arranque y eventos ---------- */
  montar();
  form.addEventListener("change", pintar);
  form.addEventListener("submit", (e) => {
    e.preventDefault(); pintar(); salida.focus(); salida.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  form.addEventListener("click", (e) => {
    if (!e.target.closest("[data-borrar]")) return;
    if (!window.confirm("¿Borrar tus respuestas y lo que has marcado en este dispositivo?")) return;
    store.del(); estado.r = normalizar({}); estado.ok = {}; montar(); pintar();
  });

  // Impresión: la hoja es hija directa de <body> y, al imprimir, es lo único que sale
  const papel = document.createElement("div");
  papel.id = "dv-hoja";
  document.body.appendChild(papel);
  const preparar = () => { papel.innerHTML = hoja(); document.documentElement.classList.add("dv-imprimir"); };
  window.addEventListener("beforeprint", preparar);
  window.addEventListener("afterprint", () => document.documentElement.classList.remove("dv-imprimir"));

  const acciones = document.getElementById("dv-acciones");
  if (acciones) {
    acciones.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-imprimir")) { preparar(); window.print(); }
      if (b.hasAttribute("data-compartir")) window.open("https://wa.me/?text=" + encodeURIComponent(texto()), "_blank", "noopener");
      if (b.hasAttribute("data-ayuda")) pedirAyuda();
    });
  }
  pintar();
})();
