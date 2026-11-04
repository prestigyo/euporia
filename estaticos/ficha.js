/* =====================================================================
   Euporia · asistente «Prepara tu ficha ciega»
   El vendedor decide qué se revela en cada uno de los cinco niveles:
     0 Ficha ciega pública · 1 Registro · 2 Cualificación
     3 Confidencialidad y dossier · 4 Dirección y visita
   Depende de app.js (window.EuporiaComun). Solo se carga en
   /vender-sin-publicar/preparar-ficha/.
   La ficha NO se publica al enviar: llega al Apps Script como propuesta,
   con publicar = no y autorización pendiente de confirmar y firmar.
   ===================================================================== */
(() => {
  const E = window.EuporiaComun;
  const form = document.getElementById("form-ficha");
  if (!form || !E) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pasos = $$("fieldset[data-paso]", form);
  const marcas = $$("#wizard-pasos li");
  const btnAtras = $("#wz-atras"), btnSig = $("#wz-siguiente"), btnEnviar = $("#wz-enviar");
  const estado = $("#wz-estado");
  const SIGUIENTE = ["nivel 0, ficha ciega", "nivel 1, registro", "nivel 2, cualificación",
                     "nivel 3, dossier", "nivel 4, visita", "revisa y autoriza"];
  let actual = 0, alcanzado = 0, ndaElegido = false;

  /* ---------- Lectura del formulario ---------- */
  const lista = (v) => (v == null ? [] : [].concat(v));
  const entero = (v) => {
    const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  function leer() {
    const d = {};
    for (const [k, v] of new FormData(form).entries()) {
      const valor = typeof v === "string" ? v.trim() : v;
      d[k] = k in d ? [].concat(d[k], valor) : valor;
    }
    return d;
  }
  const marcar = (nombre, valor) => {
    const r = form.querySelector(`input[name="${nombre}"][value="${valor}"]`);
    if (r) r.checked = true;
  };

  /* ---------- Textos libres: nada que identifique ni que delate la situación ---------- */
  const LOCALIZA = /(\bc\/|\bcalle\b|\bcarrer\b|\bavda\b|\bavenida\b|\bav\.|\bplaza\b|\bpla[çc]a\b|\bpaseo\b|\bcamino\b|\bcam[íi]\b|\bportal\b|\bescalera\b|\bpuerta\b|\bn[ºo°]\s*\d|\bn[úu]mero\s*\d|\b46\d{3}\b|\b\d{9}\b|@)/i;
  const URBANIZACION = /\burbanizaci[óo]n\s+[A-ZÁÉÍÓÚÑ]/;

  function problemaTexto(v) {
    if (!v) return "";
    const vetado = E.terminoVetado({ titulo: v });
    if (vetado) return `Quita «${vetado}»: la ficha no puede decir nada sobre la situación del propietario ni el motivo de la venta.`;
    if (LOCALIZA.test(v) || URBANIZACION.test(v)) return "No pongas calles, números, teléfonos ni nombres que permitan localizar la casa.";
    return "";
  }
  function revisarCampo(input) {
    const msg = problemaTexto(input.value.trim());
    input.setCustomValidity(msg);
    const err = input.closest("label")?.querySelector(".error-campo");
    if (err) err.textContent = msg;
    return !msg;
  }
  const limpio = (v) => (v && !problemaTexto(v) ? v : "");

  /* ---------- Configuración propuesta según el motivo (tabla «Qué ocultar según el motivo») ---------- */
  const PRESETS = {
    "Privacidad o seguridad": {
      valores: { visibilidad: "portal", mostrar_zona: "comarca", mostrar_superficie: "redondeada", aprobar_envios: "si", direccion: "visita" },
      texto: "Hemos preparado los niveles para proteger tu identidad, la dirección y las fotos. Puedes cambiar cualquier opción." },
    "No quiero que lo sepan vecinos o conocidos": {
      valores: { visibilidad: "portal", mostrar_zona: "comarca", mostrar_superficie: "redondeada", aprobar_envios: "si", direccion: "visita" },
      texto: "Hemos preparado los niveles para que la ficha no sea reconocible en tu zona. Si hay alguien concreto que no deba recibirla, dínoslo en el nivel 1." },
    "Está alquilado o con un negocio abierto": {
      valores: { visibilidad: "portal", cualificacion: "visita", aprobar_envios: "si", direccion: "visita" },
      texto: "Sin fotos libres ni visitas improvisadas: solo visitas programadas con compradores cualificados. Si es un negocio, te recomendamos la confidencialidad." },
    "Situación legal pendiente (herencia sin aceptar, proindiviso, cargas)": {
      valores: { visibilidad: "portal", mostrar_precio: "rango", cualificacion: "visita", aprobar_envios: "si" },
      texto: "Mientras se resuelve, podemos ir captando compradores interesados, aunque la venta todavía no se pueda firmar. La ficha nunca dirá por qué." },
    "Tantear el precio sin quemar el inmueble": {
      valores: { visibilidad: "oculta", mostrar_precio: "rango", aprobar_envios: "si" },
      texto: "La ficha no se verá en público: solo la enviamos a compradores seleccionados, sin dejar rastro de precio en ningún portal." }
  };

  function aplicarMotivo(motivo) {
    const aviso = $("#aviso-motivo");
    const p = PRESETS[motivo];
    if (!p) { aviso.hidden = true; return; }
    Object.entries(p.valores).forEach(([k, v]) => marcar(k, v));
    aviso.textContent = p.texto;
    aviso.hidden = false;
  }

  /* ---------- La fricción escala con el precio ---------- */
  function recomiendaNda(d) {
    const precio = entero(d.precio_esperado) || 0;
    return precio >= 600000 || ["Edificio", "Suelo"].includes(d.tipo_inmueble)
      || (d.tipo_inmueble === "Local" && d.ocupacion === "Alquilado")
      || d.motivo === "Está alquilado o con un negocio abierto" && d.tipo_inmueble !== "Vivienda"
      || d.motivo === "Privacidad o seguridad";
  }

  /* ---------- Ficha pública (nivel 0) a partir de las elecciones ---------- */
  const CON = { Terraza: "terraza", Garaje: "garaje", Trastero: "trastero", Ascensor: "ascensor", Piscina: "piscina", "Jardín": "jardín" };
  const SUBTIPO = { "Casa o chalet": "Casa" };

  function titulo(d) {
    const tipo = d.tipo_inmueble || "";
    const verHab = d.mostrar_habitaciones !== "no";
    let base;
    if (tipo === "Vivienda") {
      const sub = SUBTIPO[d.subtipo] || d.subtipo || "Vivienda";
      const n = verHab && sub !== "Estudio" ? entero(d.dormitorios) : undefined;
      base = n ? `${sub} de ${n} ${n === 1 ? "dormitorio" : "dormitorios"}` : sub;
    } else if (tipo === "Local") base = d.ocupacion === "Alquilado" ? "Local comercial alquilado" : "Local comercial";
    else if (tipo === "Suelo") base = "Parcela";
    else if (tipo === "Edificio") base = "Edificio";
    else base = tipo ? "Inmueble" : "Tu propiedad";
    const extra = lista(d.destacados).map((x) => CON[x]).find(Boolean);
    if (extra && tipo !== "Local") base += ` con ${extra}`;
    return base;
  }

  function fichaPublica(d) {
    const tipo = d.tipo_inmueble || "";
    const vivienda = tipo === "Vivienda";
    const aprox = d.mostrar_superficie !== "exacta";
    const redondear = (n) => (n && aprox ? Math.max(10, Math.round(n / 10) * 10) : n);
    const fuera = d.comarca === "Fuera de la provincia de Valencia";
    const verHab = vivienda && d.mostrar_habitaciones !== "no";
    const precio = entero(d.precio_esperado);
    const cert = d.certificado_energetico;
    const f = {
      ref: "EU-···",
      tipo: tipo || "Inmueble",
      titulo: titulo(d),
      zona: (d.mostrar_zona === "municipio" || fuera) && d.municipio ? d.municipio : (d.comarca || "Zona por definir"),
      entorno: limpio(d.entorno),
      superficie: redondear(entero(d.superficie)),
      parcela: redondear(entero(d.parcela)),
      superficieAprox: aprox,
      dormitorios: verHab ? entero(d.dormitorios) : undefined,
      banos: verHab ? entero(d.banos) : undefined,
      certificado: tipo === "Suelo" ? undefined : (cert === "No lo tengo" || !cert ? "Pendiente" : cert),
      estado: "Disponible",
      nda: d.nda !== "no",
      cualificacion: d.cualificacion || "visita",
      destacados: [...lista(d.destacados), limpio(d.destacado_libre)].filter(Boolean)
    };
    if (d.mostrar_precio !== "consultar" && precio) {
      f.precioDesde = Math.floor((precio * 0.97) / 5000) * 5000;
      f.precioHasta = Math.ceil((precio * 1.03) / 5000) * 5000;
    }
    return f;
  }

  function pintarVista() {
    $("#vista-previa").replaceChildren(E.tarjeta(fichaPublica(leer()), { vista: true }));
  }

  /* ---------- Resumen por niveles (paso final) ---------- */
  function pintarResumen() {
    const d = leer(), f = fichaPublica(d);
    const quien = lista(d.compradores).map((x) => x.toLowerCase()).join(", ");
    const CUAL = { dossier: "antes de recibir el dossier", visita: "antes de la visita", no: "no se pide" };
    const lineas = [
      [`Nivel 0 · Ficha ciega: `, d.visibilidad === "oculta"
        ? `no aparece en público; solo la enviamos a compradores seleccionados. Zona: ${f.zona}.`
        : `visible en el portal. Zona: ${f.zona}; superficie ${d.mostrar_superficie === "exacta" ? "exacta" : "redondeada"}; precio ${f.precioDesde ? "en rango orientativo" : "a consultar"}.`],
      [`Nivel 1 · Registro: `, `pueden registrarse ${quien || "nadie todavía"}${d.excluir ? "; con las exclusiones que nos has indicado" : ""}.`],
      [`Nivel 2 · Cualificación: `, `preaprobación o prueba de fondos ${CUAL[d.cualificacion] || CUAL.visita}.`],
      [`Nivel 3 · Dossier: `, `${f.nda ? "solo tras firmar la confidencialidad" : "sin acuerdo de confidencialidad"}, con el nombre del comprador en cada página${d.aprobar_envios === "no" ? "" : "; tú apruebas cada envío"}.`],
      [`Nivel 4 · Visita: `, `${d.direccion === "dossier" ? "la dirección va en el dossier" : "la dirección solo con la visita confirmada"}; ${lista(d.visitas_cuando).join(", ").toLowerCase() || "horario por concretar"}, con ${d.visitas_aviso || "48 horas"} de aviso y siempre acompañados.`],
      ["Nunca: ", "tu nombre, fotos reconocibles, la dirección en la ficha, por qué vendes ni con qué plazo."]
    ];
    $("#resumen-privacidad").replaceChildren(...lineas.map(([t, r]) => {
      const li = document.createElement("li");
      const b = document.createElement("strong");
      b.textContent = t;
      li.append(b, r);
      return li;
    }));
  }

  /* ---------- Campos que dependen de otros ---------- */
  function mostrarBloque(n, ver) {
    n.hidden = !ver;
    $$("input, select, textarea", n).forEach((c) => { c.disabled = !ver; });
  }
  function condicionales() {
    const d = leer();
    const tipo = form.elements.tipo_inmueble.value;
    $$("[data-si-tipo]", form).forEach((n) => mostrarBloque(n, n.dataset.siTipo === tipo));
    $$("[data-no-tipo]", form).forEach((n) => mostrarBloque(n, n.dataset.noTipo !== tipo));
    $$("[data-si-ocupacion]", form).forEach((n) => { n.hidden = n.dataset.siOcupacion !== d.ocupacion; });
    $$("[data-si-certificado]", form).forEach((n) => { n.hidden = n.dataset.siCertificado !== d.certificado_energetico; });
    form.elements.superficie.required = tipo !== "" && tipo !== "Suelo";
    form.elements.parcela.required = tipo === "Suelo";
    form.elements.certificado_energetico.required = tipo !== "" && tipo !== "Suelo";
    const nda = recomiendaNda(d) ? "si" : "no";
    if (!ndaElegido) marcar("nda", nda);
    $$("[data-recomendado]", form).forEach((n) => { n.hidden = n.dataset.recomendado !== nda; });
  }

  /* ---------- Validación de cada paso ---------- */
  function validarPaso(i) {
    const paso = pasos[i];
    $$("[data-revisar]", paso).forEach(revisarCampo);
    for (const c of $$("input, select, textarea", paso)) {
      if (c.disabled || c.closest("[hidden]") || c.type === "hidden") continue;
      if (!c.checkValidity()) { c.reportValidity(); return false; }
    }
    for (const g of $$("[data-min]", paso)) {
      if (g.closest("[hidden]")) continue;
      const err = g.parentElement.querySelector(".error-campo");
      if ($$("input:checked", g).length < Number(g.dataset.min)) {
        err.textContent = "Elige al menos una opción.";
        $("input", g).focus();
        return false;
      }
      err.textContent = "";
    }
    return true;
  }

  /* ---------- Navegación ---------- */
  const botonesPaso = marcas.map((li, j) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "paso-btn";
    b.append(...li.childNodes);
    b.addEventListener("click", () => { if (j <= alcanzado && (j < actual || validarPaso(actual))) ir(j); });
    li.append(b);
    return b;
  });

  function ir(i, enfocar = true) {
    actual = i;
    alcanzado = Math.max(alcanzado, i);
    pasos.forEach((p, j) => { p.hidden = j !== i; });
    marcas.forEach((m, j) => {
      if (j === i) m.setAttribute("aria-current", "step"); else m.removeAttribute("aria-current");
      m.classList.toggle("hecho", j < i);
      botonesPaso[j].disabled = j > alcanzado;
    });
    const ultimo = i === pasos.length - 1;
    $("#paso-actual").textContent = `Paso ${i + 1} de ${pasos.length}: ${marcas[i].textContent.trim()}`;
    btnAtras.hidden = i === 0;
    btnSig.hidden = ultimo;
    btnEnviar.hidden = !ultimo;
    if (!ultimo) btnSig.textContent = "Siguiente: " + SIGUIENTE[i];
    if (ultimo) pintarResumen();
    estado.textContent = "";
    if (enfocar) {
      $("#wizard-pasos").scrollIntoView({ block: "start" });
      $("legend", pasos[i]).focus({ preventScroll: true });
    }
  }

  btnSig.addEventListener("click", () => { if (validarPaso(actual)) ir(actual + 1); });
  btnAtras.addEventListener("click", () => ir(actual - 1));

  form.addEventListener("input", (e) => {
    if (e.target.matches("[data-revisar]")) revisarCampo(e.target);
    condicionales();
    pintarVista();
  });
  form.addEventListener("change", (e) => {
    if (e.target.name === "motivo") aplicarMotivo(e.target.value);
    if (e.target.name === "nda") ndaElegido = true;
    const grupo = e.target.closest("[data-max]");
    if (grupo) {
      const err = grupo.parentElement.querySelector(".error-campo");
      const max = Number(grupo.dataset.max);
      if ($$("input:checked", grupo).length > max) {
        e.target.checked = false;
        err.textContent = `Elige como mucho ${max}.`;
      } else err.textContent = "";
    }
    const grupoMin = e.target.closest("[data-min]");
    if (grupoMin && $$("input:checked", grupoMin).length) grupoMin.parentElement.querySelector(".error-campo").textContent = "";
    condicionales();
    pintarVista();
    if (actual === pasos.length - 1) pintarResumen();
  });

  /* ---------- Envío ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validarPaso(actual)) return;
    const d = leer();
    if (d.web) return;                                   // trampa para bots
    const ficha = fichaPublica(d);
    delete ficha.ref;                                    // la referencia la pone el Apps Script
    const unir = (v) => lista(v).join(", ");
    const propuesta = {
      tipo: "ficha_propuesta",
      pagina: location.href,
      nombre: d.nombre, telefono: d.telefono, email: d.email || "", relacion: d.relacion, motivo: d.motivo || "",
      tipo_inmueble: d.tipo_inmueble, subtipo: d.tipo_inmueble === "Vivienda" ? d.subtipo : "",
      comarca: d.comarca, municipio: d.municipio, barrio: d.barrio || "",
      superficie_real: d.superficie || "", parcela_real: d.parcela || "",
      dormitorios: d.dormitorios || "", banos: d.banos || "",
      precio_esperado: d.precio_esperado || "", ocupacion: d.ocupacion,
      certificado_energetico: d.certificado_energetico || (d.tipo_inmueble === "Suelo" ? "No aplica" : ""),
      visibilidad: d.visibilidad, mostrar_zona: d.mostrar_zona, mostrar_superficie: d.mostrar_superficie,
      mostrar_habitaciones: d.mostrar_habitaciones || "no", mostrar_precio: d.mostrar_precio,
      entorno: ficha.entorno, destacados: unir(d.destacados), destacado_libre: limpio(d.destacado_libre || ""),
      compradores: unir(d.compradores), excluir: d.excluir || "",
      cualificacion: d.cualificacion, nda: d.nda, aprobar_envios: d.aprobar_envios,
      direccion: d.direccion, visitas_cuando: unir(d.visitas_cuando), visitas_aviso: d.visitas_aviso,
      acepta_autorizacion: d.acepta_autorizacion, acepta_privacidad: d.acepta_privacidad,
      ficha
    };
    const textoBoton = btnEnviar.textContent;
    btnEnviar.disabled = true; btnEnviar.textContent = "Enviando…";
    const r = await E.enviar(propuesta);
    btnEnviar.textContent = textoBoton;
    if (r === "ok") {
      estado.textContent = "Recibido. Revisaremos la ficha y te llamaremos para confirmarla y firmar la hoja de encargo. No se publica nada hasta entonces.";
      btnAtras.hidden = true;
    } else {
      btnEnviar.disabled = false;
      E.avisoNoEnviado(estado, r);
    }
  });

  /* ---------- Arranque ---------- */
  condicionales();
  ir(0, false);
  pintarVista();
})();
