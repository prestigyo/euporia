/**
 * Euporia · backend de formularios y fichas (Google Apps Script)
 *
 * Qué hace
 *  - doPost: guarda los formularios del portal en la hoja que toca.
 *      familia                     → hoja "Familias"
 *      valoracion                  → hoja "Valoraciones"
 *      propietario                 → hoja "Propietarios"
 *      dossier / aviso / busqueda  → hoja "Solicitudes"
 *      ficha_propuesta             → hoja "Propuestas" (datos privados y niveles elegidos)
 *                                    + borrador en "Fichas" con publicar = no
 *      visita                      → hoja "Visitas" (calculadora de visitas: dirección, precio,
 *                                    puntuaciones y resultado; sin nombre ni contacto). Una fila por
 *                                    visita: si la persona edita sus respuestas, se sustituye.
 *      negociacion                 → hoja "Negociaciones" (quiere que negociemos por él/ella)
 *      documento                   → hoja "Documentos" (valor de referencia, certificado energético, planos)
 *      hipoteca                    → hoja "Hipotecas" (quiere que un intermediario estudie su caso; con consentimiento de cesión)
 *  - doGet (?accion=fichas): devuelve las fichas publicables de la hoja "Fichas".
 *      Solo salen las filas con publicar = sí Y autorizacion_escrita = sí,
 *      que no sean ocultas, solo con columnas públicas y nunca con términos vetados.
 *
 * Para publicar una propuesta: revisa la fila en "Fichas", confirma con el propietario,
 * firma la hoja de encargo y cambia autorizacion_escrita y publicar a «sí».
 *
 * Instalación
 *  1. Crea una hoja de cálculo nueva en Google Drive (p. ej. "Euporia · datos").
 *  2. Extensiones → Apps Script. Borra el código de ejemplo y pega este archivo.
 *  3. Ejecuta una vez la función `configurar` (crea las pestañas y cabeceras; pedirá permisos).
 *  4. Implementar → Nueva implementación → Tipo: Aplicación web.
 *       Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 *  5. Copia la URL que termina en /exec y ponla en build.py:
 *       SITIO["endpoint"]   = "<URL>"
 *       SITIO["fichas_url"] = "<URL>?accion=fichas"
 *     y vuelve a generar el sitio.
 *  6. Cada vez que cambies este código: Implementar → Gestionar implementaciones → editar → Nueva versión.
 *  Si ya habías ejecutado `configurar` antes, vuelve a ejecutarlo: añade las columnas nuevas que falten.
 *
 * Correos
 *  - avisarA: te avisa de cada envío con un enlace a la hoja. No copia los datos en el correo.
 *  - acuse: si la persona deja un email, recibe una confirmación en HTML que no repite lo que ha contado.
 *    Para que salga desde el correo del dominio, ejecuta este script con la cuenta de ese correo.
 *
 * Privacidad: la hoja guarda datos personales. Compártela solo con quien gestione los casos.
 */

const AJUSTES = {
  avisarA: "",   // email que recibe un aviso por cada envío. Vacío = sin aviso.
  acuse: true,   // envía una confirmación a quien deja un email
  responderA: "hola@euporia.es",
  maxLongitud: 2000,
  terminosVetados: ["subasta", "urgente", "urgencia", "embargo", "ejecucion", "deuda", "impago", "desahucio",
    "lanzamiento", "herencia", "heredero", "divorcio", "separacion", "necesita vender", "chollo", "ganga",
    "liquidacion", "por debajo de mercado", "bajo mercado", "precio de derribo"]
};

const CABECERAS = {
  Familias: ["fecha", "nombre", "contacto", "situacion", "cuando", "mensaje", "resumen", "acepta_privacidad", "pagina", "estado_interno"],
  Valoraciones: ["fecha", "nombre", "contacto", "municipio_barrio", "superficie", "habitaciones", "banos", "planta", "ascensor",
    "estado", "anio_reforma", "extras", "ubicacion", "disponibilidad", "resumen", "acepta_privacidad", "pagina", "estado_interno"],
  Propietarios: ["fecha", "nombre", "contacto", "tipo_inmueble", "zona", "superficie", "precio_esperado", "motivo",
    "mensaje", "acepta_privacidad", "pagina", "estado_interno"],
  Solicitudes: ["fecha", "tipo", "ref", "nombre", "email", "telefono", "perfil", "presupuesto", "plazo", "compra", "busca",
    "zona", "mensaje", "acepta_nda", "acepta_privacidad", "pagina", "cualificado", "nda_enviado", "nda_firmado",
    "dossier_enviado", "estado_interno"],
  Propuestas: ["fecha", "ref", "nombre", "telefono", "email", "relacion", "motivo", "tipo_inmueble", "subtipo", "comarca",
    "municipio", "barrio", "superficie_real", "parcela_real", "dormitorios", "banos", "salones", "precio_esperado", "ocupacion",
    "certificado_energetico", "visibilidad", "mostrar_zona", "mostrar_superficie", "mostrar_habitaciones", "mostrar_precio",
    "entorno", "destacados", "destacado_libre", "compradores", "excluir", "cualificacion", "nda", "aprobar_envios",
    "detalles_extraordinarios", "direccion", "visitas_cuando", "visitas_aviso", "acepta_autorizacion", "acepta_privacidad", "pagina",
    "hoja_encargo_firmada", "estado_interno"],
  Visitas: ["fecha", "visita_id", "direccion", "precio_anunciado", "m2", "valor_para_ti", "diferencia_pct", "encaje",
    "cobertura_pct", "obras_nivel", "obras_eur", "intuicion",
    "luz_prioridad", "luz_media", "dis_prioridad", "dis_media", "coc_prioridad", "coc_media", "ban_prioridad", "ban_media", "dor_prioridad", "dor_media", "ent_prioridad", "ent_media", "edi_prioridad", "edi_media", "est_prioridad", "est_media", "ext_prioridad", "ext_media", "emo_prioridad", "emo_media",
    "respuestas", "pagina"],
  Negociaciones: ["fecha", "nombre", "contacto", "mensaje", "visita_id", "direccion", "precio_anunciado", "valor_para_ti",
    "diferencia_pct", "encaje", "obras_eur", "intuicion", "nota", "resumen", "acepta_privacidad", "pagina", "estado_interno"],
  Hipotecas: ["fecha", "nombre", "contacto", "mensaje", "resumen", "acepta_cesion", "acepta_privacidad", "pagina", "intermediario", "enlace_enviado", "estado_interno"],
  Documentos: ["fecha", "nombre", "contacto", "documento", "direccion", "mensaje", "acepta_privacidad", "pagina", "estado_interno"],
  Fichas: ["ref", "tipo", "titulo", "zona", "entorno", "superficie_m2", "parcela_m2", "superficie_aprox", "dormitorios",
    "banos", "precio_desde", "precio_hasta", "rentabilidad", "certificado_energetico", "estado", "destacados",
    "nda", "cualificacion", "visibilidad", "autorizacion_escrita", "fecha_autorizacion", "publicar", "notas_internas"]
};

const DESTINO = { familia: "Familias", valoracion: "Valoraciones", propietario: "Propietarios", dossier: "Solicitudes", aviso: "Solicitudes",
  busqueda: "Solicitudes", ficha_propuesta: "Propuestas", visita: "Visitas", negociacion: "Negociaciones", documento: "Documentos", hipoteca: "Hipotecas" };

/** Ejecutar una vez (o de nuevo tras actualizar): crea pestañas y añade las columnas que falten. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(CABECERAS).forEach(([nombre, cab]) => {
    const hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(cab);
    } else {
      const actuales = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
      const faltan = cab.filter((c) => !actuales.includes(c));
      if (faltan.length) hoja.getRange(1, actuales.length + 1, 1, faltan.length).setValues([faltan]);
    }
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, hoja.getLastColumn()).setFontWeight("bold");
  });
  ss.getSheetByName("Fichas").getRange(1, 1).setNote(
    "En 'destacados', separa cada punto con punto y coma. Solo se publica una fila con publicar = sí, " +
    "autorizacion_escrita = sí y visibilidad distinta de «oculta». Nunca escribas dirección, motivo de venta " +
    "ni situación del propietario. Para publicar, usa el menú Euporia → Publicar la ficha seleccionada. " +
    "Columnas rojas: deciden si se publica. Amarillas: revísalas antes. Filas verdes: en la web; amarillas: sin publicar.");
  darFormato_(ss);
  // El menú solo se puede crear con la hoja abierta: desde el editor falla, y no pasa nada (sale al recargar la hoja)
  try { onOpen(); } catch (e) { console.log("Menú Euporia: aparecerá al recargar la hoja."); }
}

/* =====================================================================
   Ayudas para no equivocarse: colores, desplegables y menú «Euporia»
   ===================================================================== */
const COLOR = { rojo: "#f4c7c3", amarillo: "#fce8b2", gris: "#eeeeee", verdeFila: "#d9ead3", amarilloFila: "#fff8e1" };
const SI_NO = ["sí", "no"];
const ESTADO_CONTACTO = ["Nueva", "Contactado", "En curso", "Cerrado", "Descartado"];
const FORMATO = {
  Fichas: {
    rojo: ["publicar", "autorizacion_escrita"],
    amarillo: ["titulo", "zona", "entorno", "destacados", "precio_desde", "precio_hasta", "certificado_energetico", "estado", "visibilidad", "nda"],
    listas: { publicar: SI_NO, autorizacion_escrita: ["sí", "no", "pendiente"], estado: ["Disponible", "En negociación", "Reservada"],
      visibilidad: ["portal", "oculta"], nda: SI_NO, superficie_aprox: SI_NO,
      certificado_energetico: ["A", "B", "C", "D", "E", "F", "G", "Pendiente", "No aplica"] }
  },
  Propuestas: {
    rojo: ["hoja_encargo_firmada"], amarillo: ["estado_interno"],
    listas: { hoja_encargo_firmada: SI_NO,
      estado_interno: ["Nueva", "En revisión", "En comercialización", "Oferta recibida", "Arras firmadas", "Vendida", "Retirada"] }
  },
  Solicitudes: {
    amarillo: ["cualificado", "nda_enviado", "nda_firmado", "dossier_enviado", "estado_interno"],
    listas: { cualificado: SI_NO, nda_enviado: SI_NO, nda_firmado: SI_NO, dossier_enviado: SI_NO,
      estado_interno: ["Nueva", "Contactado", "Visita", "Oferta", "Descartado", "Cerrado"] }
  },
  Hipotecas: { amarillo: ["intermediario", "enlace_enviado", "estado_interno"], listas: { enlace_enviado: SI_NO, estado_interno: ESTADO_CONTACTO } },
  Familias: { amarillo: ["estado_interno"], listas: { estado_interno: ESTADO_CONTACTO } },
  Propietarios: { amarillo: ["estado_interno"], listas: { estado_interno: ESTADO_CONTACTO } },
  Valoraciones: { amarillo: ["estado_interno"], listas: { estado_interno: ESTADO_CONTACTO } },
  Negociaciones: { amarillo: ["estado_interno"], listas: { estado_interno: ESTADO_CONTACTO } },
  Documentos: { amarillo: ["estado_interno"], listas: { estado_interno: ESTADO_CONTACTO } }
};

function letra_(n) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Colores de cabecera, desplegables y filas de color. Se vuelve a aplicar cada vez que se ejecuta configurar. */
function darFormato_(ss) {
  Object.entries(FORMATO).forEach(([nombre, f]) => {
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) return;
    const cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    const filas = Math.max(hoja.getMaxRows() - 1, 1);
    hoja.getRange(1, 1, 1, cab.length).setBackground(COLOR.gris);
    (f.amarillo || []).forEach((c) => { const i = cab.indexOf(c); if (i >= 0) hoja.getRange(1, i + 1).setBackground(COLOR.amarillo); });
    (f.rojo || []).forEach((c) => { const i = cab.indexOf(c); if (i >= 0) hoja.getRange(1, i + 1).setBackground(COLOR.rojo); });
    Object.entries(f.listas || {}).forEach(([c, valores]) => {
      const i = cab.indexOf(c);
      if (i < 0) return;
      const regla = SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(true).build();
      hoja.getRange(2, i + 1, filas, 1).setDataValidation(regla);
    });
    const reglas = [];
    const todo = hoja.getRange(2, 1, filas, cab.length);
    const ref = (c) => "$" + letra_(cab.indexOf(c) + 1) + "2";
    const si = (c) => "OR(LOWER(" + ref(c) + ")=\"sí\",LOWER(" + ref(c) + ")=\"si\")";
    if (nombre === "Fichas") {
      reglas.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=AND(" + ref("ref") + "<>\"\"," + si("publicar") + "," + si("autorizacion_escrita") + ",LOWER(" + ref("visibilidad") + ")<>\"oculta\")")
        .setBackground(COLOR.verdeFila).setRanges([todo]).build());
      reglas.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=AND(" + ref("ref") + "<>\"\",NOT(" + si("publicar") + "))")
        .setBackground(COLOR.amarilloFila).setRanges([todo]).build());
    }
    if (nombre === "Solicitudes") {
      reglas.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied("=" + si("dossier_enviado")).setBackground(COLOR.verdeFila).setRanges([todo]).build());
    }
    if (reglas.length) hoja.setConditionalFormatRules(reglas);
  });
}

/** Menú «Euporia» en la hoja (aparece al abrirla). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Euporia")
    .addItem("Revisar las fichas", "revisarFichas")
    .addItem("Publicar la ficha seleccionada", "publicarSeleccionada")
    .addItem("Retirar la ficha seleccionada", "retirarSeleccionada")
    .addToUi();
}

function tabla_(hoja) {
  const datos = hoja.getDataRange().getValues();
  const cab = datos.shift() || [];
  return { cab: cab, filas: datos, col: (n) => cab.indexOf(n) };
}

/** Qué impide publicar una ficha (bloqueos) y qué conviene revisar (avisos). */
function comprobarFicha_(fila, t, propuestas) {
  const v = (n) => (t.col(n) < 0 ? "" : String(fila[t.col(n)]).trim());
  const bloqueos = [], avisos = [];
  const ref = v("ref");
  if (!v("titulo")) bloqueos.push("falta el título");
  if (!v("zona")) bloqueos.push("falta la zona");
  const cert = v("certificado_energetico").toLowerCase();
  if (v("tipo") !== "Suelo" && (!cert || cert === "pendiente")) bloqueos.push("falta la letra del certificado energético (es obligatoria en el anuncio)");
  const vetado = terminoVetado_({ titulo: v("titulo"), entorno: v("entorno"), zona: v("zona"), rentabilidad: v("rentabilidad"),
    destacados: v("destacados").split(";") });
  if (vetado) bloqueos.push("el texto contiene «" + vetado + "»: cámbialo, la web no la mostraría");
  const p = propuestas.filas.find((f) => String(f[propuestas.col("ref")]) === ref);
  if (!p) avisos.push("no hay propuesta con esta referencia: confirma tú que la hoja de encargo está firmada");
  else if (!esSi_(p[propuestas.col("hoja_encargo_firmada")])) bloqueos.push("la hoja de encargo no está firmada (pestaña Propuestas, columna hoja_encargo_firmada)");
  if (!v("precio_desde") && !v("precio_hasta")) avisos.push("sin precio: saldrá «a consultar»");
  if (v("visibilidad").toLowerCase() === "oculta") avisos.push("visibilidad «oculta»: no saldrá en la web aunque la publiques");
  return { ref: ref, bloqueos: bloqueos, avisos: avisos,
    enWeb: esSi_(v("publicar")) && esSi_(v("autorizacion_escrita")) && v("visibilidad").toLowerCase() !== "oculta" };
}

function revisarFichas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  const t = tabla_(ss.getSheetByName("Fichas")), props = tabla_(ss.getSheetByName("Propuestas"));
  const lineas = t.filas.filter((f) => f[t.col("ref")]).map((f) => {
    const r = comprobarFicha_(f, t, props);
    const estado = r.enWeb ? "EN LA WEB" : r.bloqueos.length ? "NO SE PUEDE PUBLICAR" : "LISTA PARA PUBLICAR";
    return r.ref + " · " + estado + r.bloqueos.map((b) => "\n   ✗ " + b).join("") + r.avisos.map((a) => "\n   · " + a).join("");
  });
  ui.alert("Revisión de fichas", lineas.length ? lineas.join("\n\n") : "Todavía no hay fichas.", ui.ButtonSet.OK);
}

function filaSeleccionada_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  const hoja = ss.getActiveSheet();
  const n = hoja.getActiveRange() ? hoja.getActiveRange().getRow() : 0;
  if (hoja.getName() !== "Fichas" || n < 2) { ui.alert("Ve a la pestaña Fichas y haz clic en cualquier celda de la ficha que quieras."); return null; }
  return { ss: ss, ui: ui, hoja: hoja, n: n };
}

function publicarSeleccionada() {
  const s = filaSeleccionada_();
  if (!s) return;
  const t = tabla_(s.hoja), fila = t.filas[s.n - 2];
  if (!fila || !fila[t.col("ref")]) { s.ui.alert("Esa fila está vacía."); return; }
  const r = comprobarFicha_(fila, t, tabla_(s.ss.getSheetByName("Propuestas")));
  if (r.bloqueos.length) {
    s.ui.alert("No se puede publicar " + r.ref, "Antes hay que arreglar:\n\n✗ " + r.bloqueos.join("\n✗ "), s.ui.ButtonSet.OK);
    return;
  }
  const extra = r.avisos.length ? "\n\nTen en cuenta:\n· " + r.avisos.join("\n· ") : "";
  const ok = s.ui.alert("¿Publicar " + r.ref + " en euporia.es?", "Se verá en la página de off-market en cuanto alguien la recargue." + extra, s.ui.ButtonSet.YES_NO);
  if (ok !== s.ui.Button.YES) return;
  const poner = (c, valor) => { if (t.col(c) >= 0) s.hoja.getRange(s.n, t.col(c) + 1).setValue(valor); };
  poner("autorizacion_escrita", "sí");
  poner("publicar", "sí");
  if (t.col("fecha_autorizacion") >= 0 && !fila[t.col("fecha_autorizacion")]) poner("fecha_autorizacion", new Date().toISOString());
  if (t.col("estado") >= 0 && !fila[t.col("estado")]) poner("estado", "Disponible");
  marcarPropuesta_(s.ss, r.ref, "En comercialización");
  s.ui.alert(r.ref + " publicada", "Compruébala en https://euporia.es/off-market/ . Para quitarla: menú Euporia → Retirar la ficha seleccionada.", s.ui.ButtonSet.OK);
}

function retirarSeleccionada() {
  const s = filaSeleccionada_();
  if (!s) return;
  const t = tabla_(s.hoja), ref = String((t.filas[s.n - 2] || [])[t.col("ref")] || "");
  if (!ref) { s.ui.alert("Esa fila está vacía."); return; }
  const ok = s.ui.alert("¿Retirar " + ref + " de la web?", "Dejará de verse en euporia.es. La fila se queda en la hoja.", s.ui.ButtonSet.YES_NO);
  if (ok !== s.ui.Button.YES) return;
  s.hoja.getRange(s.n, t.col("publicar") + 1).setValue("no");
  s.ui.alert(ref + " retirada", "Si se ha vendido, cambia el estado de la propuesta a «Vendida».", s.ui.ButtonSet.OK);
}

function marcarPropuesta_(ss, ref, estado) {
  const hoja = ss.getSheetByName("Propuestas");
  if (!hoja) return;
  const t = tabla_(hoja), i = t.filas.findIndex((f) => String(f[t.col("ref")]) === ref);
  if (i >= 0 && t.col("estado_interno") >= 0) hoja.getRange(i + 2, t.col("estado_interno") + 1).setValue(estado);
}

/** Recibe los formularios del portal. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (d.web) return json_({ ok: true });                        // trampa para bots
    const tipo = String(d.tipo || "");
    const nombreHoja = DESTINO[tipo];
    if (!nombreHoja) return json_({ ok: false, error: "tipo desconocido" });
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (tipo === "ficha_propuesta") {
      if (!d.ficha || String(d.acepta_autorizacion) !== "sí") return json_({ ok: false, error: "sin autorización" });
      d.ref = siguienteRef_(ss.getSheetByName("Fichas"));
      anadirFila_(ss.getSheetByName("Fichas"), filaFicha_(d.ficha, d.ref, d.visibilidad));
    }
    if (tipo === "visita") {
      if (!d.visita_id) return json_({ ok: false, error: "sin visita_id" });
      guardarPorClave_(ss.getSheetByName(nombreHoja), d, "visita_id");
      return json_({ ok: true });                                   // estadística: sin avisos ni acuses
    }
    if (tipo === "negociacion" && String(d.acepta_privacidad) !== "sí") return json_({ ok: false, error: "sin consentimiento" });
    if (tipo === "hipoteca" && String(d.acepta_cesion) !== "sí") return json_({ ok: false, error: "sin consentimiento de cesión" });
    anadirFila_(ss.getSheetByName(nombreHoja), d);

    // Los correos nunca deben hacer fallar un envío que ya está guardado
    try {
      if (AJUSTES.avisarA) {
        MailApp.sendEmail({
          to: AJUSTES.avisarA,
          subject: `Euporia · nuevo envío (${tipo}${d.ref ? " " + d.ref : ""})`,
          body: `Hay un envío nuevo en la pestaña ${nombreHoja}:\n${ss.getUrl()}`,
          htmlBody: plantilla_("Hay un envío nuevo", `<p>Tienes un envío nuevo en la pestaña <strong>${nombreHoja}</strong>.</p>` +
            `<p><a href="${ss.getUrl()}" style="color:#2f5d7c">Abrir la hoja</a></p>`)
        });
      }
      acuse_(tipo, d);
    } catch (errCorreo) {
      console.error(errCorreo);
    }
    return json_({ ok: true, ref: d.ref || "" });
  } catch (err) {
    console.error(err);
    return json_({ ok: false });
  } finally {
    lock.releaseLock();
  }
}

/** Sirve las fichas publicables: ?accion=fichas */
function doGet(e) {
  if (!e || !e.parameter || e.parameter.accion !== "fichas") return json_({ ok: true });
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fichas");
  const filas = hoja.getDataRange().getValues();
  const cab = filas.shift();
  const col = (fila, nombre) => (cab.indexOf(nombre) < 0 ? "" : fila[cab.indexOf(nombre)]);
  const numero = (v) => (v === "" || v == null || isNaN(Number(v)) ? undefined : Number(v));

  const fichas = filas
    .filter((f) => col(f, "ref") && esSi_(col(f, "publicar")) && esSi_(col(f, "autorizacion_escrita"))
      && String(col(f, "visibilidad")).trim().toLowerCase() !== "oculta")
    .map((f) => ({
      ref: String(col(f, "ref")),
      tipo: String(col(f, "tipo") || ""),
      titulo: String(col(f, "titulo") || ""),
      zona: String(col(f, "zona") || ""),
      entorno: String(col(f, "entorno") || ""),
      superficie: numero(col(f, "superficie_m2")),
      parcela: numero(col(f, "parcela_m2")),
      superficieAprox: esSi_(col(f, "superficie_aprox")),
      dormitorios: numero(col(f, "dormitorios")),
      banos: numero(col(f, "banos")),
      precioDesde: numero(col(f, "precio_desde")),
      precioHasta: numero(col(f, "precio_hasta")),
      rentabilidad: String(col(f, "rentabilidad") || ""),
      certificado: String(col(f, "certificado_energetico") || ""),
      estado: String(col(f, "estado") || "Disponible"),
      nda: col(f, "nda") === "" ? true : esSi_(col(f, "nda")),
      cualificacion: String(col(f, "cualificacion") || "visita"),
      destacados: String(col(f, "destacados") || "").split(";").map((s) => s.trim()).filter(Boolean)
    }))
    .filter((f) => {
      const vetado = terminoVetado_(f);
      if (vetado) console.warn(`Ficha ${f.ref} no publicada: contiene «${vetado}»`);
      return !vetado;
    });

  return json_({ fichas });
}

/* ---------- utilidades ---------- */

/** Añade una fila respetando el orden de las columnas de la hoja. */
function anadirFila_(hoja, datos) {
  const cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  hoja.appendRow(cab.map((c) => (c === "fecha" ? new Date() : limpiar_(datos[c]))));
}

/** Añade la fila o, si ya hay una con el mismo valor en la columna `clave`, la sustituye. */
function guardarPorClave_(hoja, datos, clave) {
  const cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const col = cab.indexOf(clave);
  const fila = cab.map((c) => (c === "fecha" ? new Date() : limpiar_(datos[c])));
  if (col >= 0 && hoja.getLastRow() > 1) {
    const valores = hoja.getRange(2, col + 1, hoja.getLastRow() - 1, 1).getValues().flat().map(String);
    const i = valores.indexOf(String(datos[clave]));
    if (i >= 0) { hoja.getRange(i + 2, 1, 1, cab.length).setValues([fila]); return; }
  }
  hoja.appendRow(fila);
}

/** Convierte la ficha propuesta por el vendedor en una fila de "Fichas", sin publicar. */
function filaFicha_(f, ref, visibilidad) {
  return {
    ref: ref,
    tipo: f.tipo, titulo: f.titulo, zona: f.zona, entorno: f.entorno,
    superficie_m2: f.superficie, parcela_m2: f.parcela, superficie_aprox: f.superficieAprox ? "sí" : "no",
    dormitorios: f.dormitorios, banos: f.banos, precio_desde: f.precioDesde, precio_hasta: f.precioHasta,
    rentabilidad: "", certificado_energetico: f.certificado, estado: "Disponible",
    destacados: (f.destacados || []).join("; "),
    nda: f.nda ? "sí" : "no", cualificacion: f.cualificacion,
    visibilidad: visibilidad === "oculta" ? "oculta" : "portal",
    autorizacion_escrita: "pendiente", fecha_autorizacion: new Date().toISOString(), publicar: "no",
    notas_internas: "Propuesta web: revisar, confirmar por teléfono y firmar la hoja de encargo antes de publicar."
  };
}

/** Siguiente referencia EU-### a partir de la más alta que haya en "Fichas". */
function siguienteRef_(hoja) {
  const refs = hoja.getLastRow() > 1 ? hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues().flat() : [];
  const max = refs.reduce((m, r) => {
    const n = parseInt(String(r).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return "EU-" + String(max + 1).padStart(3, "0");
}

function esSi_(v) {
  return ["si", "sí", "true", "x"].includes(String(v).trim().toLowerCase());
}

/** Confirmación a quien deja un email. No repite lo que ha contado. */
function acuse_(tipo, d) {
  if (!AJUSTES.acuse || tipo === "aviso") return;
  const destino = [d.email, d.contacto].map((v) => String(v || "").trim()).find((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
  if (!destino) return;
  const nombre = String(d.nombre || "").split(" ")[0].replace(/[<>&"]/g, "");
  const saludo = nombre ? `Hola, ${nombre}:` : "Hola:";
  const texto = "Hemos recibido tu mensaje. Te contactaremos como nos has indicado. No tienes que decidir nada en esa primera conversación.";
  MailApp.sendEmail({
    to: destino,
    subject: "Hemos recibido tu mensaje · Euporia",
    name: "Euporia",
    replyTo: AJUSTES.responderA,
    body: `${saludo}\n\n${texto}\n\nSi lo prefieres, responde a este correo.\n\nEuporia\nhttps://euporia.es`,
    htmlBody: plantilla_(saludo, `<p>${texto}</p><p>Si lo prefieres, responde a este correo.</p>`)
  });
}

/** Diseño común de los correos: una columna y estilos en línea, que es lo que respetan los programas de correo. */
function plantilla_(titulo, contenido) {
  return `<div style="background:#f6f5f2;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;color:#1f2328">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d6d3cc;padding:28px">
      <div style="font-size:24px;margin-bottom:18px">Euporia</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55">
        <p style="margin-top:0"><strong>${titulo}</strong></p>${contenido}
      </div>
    </div>
    <p style="max-width:560px;margin:14px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#57606a">
      Euporia · <a href="https://euporia.es" style="color:#57606a">euporia.es</a> ·
      <a href="https://euporia.es/aviso-legal/" style="color:#57606a">Privacidad</a></p>
  </div>`;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Recorta y evita que un texto se interprete como fórmula en la hoja. */
function limpiar_(v) {
  if (v == null) return "";
  if (typeof v === "number") return v;
  let s = String(v).slice(0, AJUSTES.maxLongitud);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function norm_(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function terminoVetado_(f) {
  const texto = norm_([f.titulo, f.entorno, f.zona, f.rentabilidad].concat(f.destacados || []).join(" "));
  return AJUSTES.terminosVetados.find((t) => texto.includes(norm_(t)));
}
