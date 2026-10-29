/**
 * Euporia · backend de formularios y fichas (Google Apps Script)
 *
 * Qué hace
 *  - doPost: guarda los formularios del portal en la hoja que toca.
 *      familia                     → hoja "Familias"
 *      propietario                 → hoja "Propietarios"
 *      dossier / aviso / busqueda  → hoja "Solicitudes"
 *      ficha_propuesta             → hoja "Propuestas" (datos privados y niveles elegidos)
 *                                    + borrador en "Fichas" con publicar = no
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
 * Privacidad: la hoja guarda datos personales. Compártela solo con quien gestione los casos.
 */

const AJUSTES = {
  avisarA: "",   // email que recibe un aviso por cada envío. Vacío = sin aviso.
  maxLongitud: 2000,
  terminosVetados: ["subasta", "urgente", "urgencia", "embargo", "ejecucion", "deuda", "impago", "desahucio",
    "lanzamiento", "herencia", "heredero", "divorcio", "separacion", "necesita vender", "chollo", "ganga",
    "liquidacion", "por debajo de mercado", "bajo mercado", "precio de derribo"]
};

const CABECERAS = {
  Familias: ["fecha", "nombre", "contacto", "situacion", "cuando", "mensaje", "acepta_privacidad", "pagina", "estado_interno"],
  Propietarios: ["fecha", "nombre", "contacto", "tipo_inmueble", "zona", "superficie", "precio_esperado", "motivo",
    "mensaje", "acepta_privacidad", "pagina", "estado_interno"],
  Solicitudes: ["fecha", "tipo", "ref", "nombre", "email", "telefono", "perfil", "presupuesto", "plazo", "compra", "busca",
    "zona", "mensaje", "acepta_nda", "acepta_privacidad", "pagina", "cualificado", "nda_enviado", "nda_firmado",
    "dossier_enviado", "estado_interno"],
  Propuestas: ["fecha", "ref", "nombre", "telefono", "email", "relacion", "motivo", "tipo_inmueble", "subtipo", "comarca",
    "municipio", "barrio", "superficie_real", "parcela_real", "dormitorios", "banos", "precio_esperado", "ocupacion",
    "certificado_energetico", "visibilidad", "mostrar_zona", "mostrar_superficie", "mostrar_habitaciones", "mostrar_precio",
    "entorno", "destacados", "destacado_libre", "compradores", "excluir", "cualificacion", "nda", "aprobar_envios",
    "direccion", "visitas_cuando", "visitas_aviso", "acepta_autorizacion", "acepta_privacidad", "pagina",
    "hoja_encargo_firmada", "estado_interno"],
  Fichas: ["ref", "tipo", "titulo", "zona", "entorno", "superficie_m2", "parcela_m2", "superficie_aprox", "dormitorios",
    "banos", "precio_desde", "precio_hasta", "rentabilidad", "certificado_energetico", "estado", "destacados",
    "nda", "cualificacion", "visibilidad", "autorizacion_escrita", "fecha_autorizacion", "publicar", "notas_internas"]
};

const DESTINO = { familia: "Familias", propietario: "Propietarios", dossier: "Solicitudes", aviso: "Solicitudes",
  busqueda: "Solicitudes", ficha_propuesta: "Propuestas" };

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
    "ni situación del propietario.");
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
    anadirFila_(ss.getSheetByName(nombreHoja), d);

    if (AJUSTES.avisarA) {
      const cab = CABECERAS[nombreHoja];
      const cuerpo = cab.filter((c) => d[c]).map((c) => `${c}: ${limpiar_(d[c])}`).join("\n");
      MailApp.sendEmail(AJUSTES.avisarA, `Euporia · nuevo envío (${tipo}${d.ref ? " " + d.ref : ""})`, cuerpo);
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
