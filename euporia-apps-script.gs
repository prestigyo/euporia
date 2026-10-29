/**
 * Euporia · backend de formularios y fichas (Google Apps Script)
 *
 * Qué hace
 *  - doPost: guarda los formularios del portal en la hoja que toca.
 *      familia            → hoja "Familias"
 *      propietario        → hoja "Propietarios"
 *      dossier / aviso / busqueda → hoja "Solicitudes"
 *  - doGet (?accion=fichas): devuelve las fichas publicables de la hoja "Fichas".
 *      Solo salen las filas con publicar = sí Y autorizacion_escrita = sí,
 *      solo las columnas públicas y nunca una ficha con términos vetados.
 *
 * Instalación
 *  1. Crea una hoja de cálculo nueva en Google Drive (p. ej. "Euporia · datos").
 *  2. Extensiones → Apps Script. Borra el código de ejemplo y pega este archivo.
 *  3. Ejecuta una vez la función `configurar` (crea las pestañas y cabeceras; pedirá permisos).
 *  4. Implementar → Nueva implementación → Tipo: Aplicación web.
 *       Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 *  5. Copia la URL que termina en /exec y pégala en el portal:
 *       CONFIG.endpoint  = "<URL>"
 *       CONFIG.fichasUrl = "<URL>?accion=fichas"
 *       CONFIG.modoPrototipo = false   (cuando ya no haya fichas de ejemplo)
 *  6. Cada vez que cambies este código: Implementar → Gestionar implementaciones → editar → Nueva versión.
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
  Solicitudes: ["fecha", "tipo", "ref", "nombre", "email", "telefono", "perfil", "compra", "busca", "zona", "presupuesto",
    "mensaje", "acepta_nda", "acepta_privacidad", "pagina", "nda_enviado", "nda_firmado", "dossier_enviado", "estado_interno"],
  Fichas: ["ref", "tipo", "titulo", "zona", "entorno", "superficie_m2", "parcela_m2", "dormitorios", "banos",
    "precio_desde", "precio_hasta", "rentabilidad", "estado", "destacados", "autorizacion_escrita", "fecha_autorizacion",
    "publicar", "notas_internas"]
};

const DESTINO = { familia: "Familias", propietario: "Propietarios", dossier: "Solicitudes", aviso: "Solicitudes", busqueda: "Solicitudes" };

/** Ejecutar una vez: crea las pestañas con sus cabeceras. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(CABECERAS).forEach(([nombre, cab]) => {
    const hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(cab);
      hoja.setFrozenRows(1);
      hoja.getRange(1, 1, 1, cab.length).setFontWeight("bold");
    }
  });
  const fichas = ss.getSheetByName("Fichas");
  fichas.getRange(1, 1).setNote("En 'destacados', separa cada punto con punto y coma. " +
    "Solo se publica una fila con publicar = sí y autorizacion_escrita = sí. " +
    "Nunca escribas dirección, motivo de venta ni situación del propietario.");
}

/** Recibe los formularios del portal. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (d.web) return json_({ ok: true });                        // trampa para bots
    const nombreHoja = DESTINO[String(d.tipo || "")];
    if (!nombreHoja) return json_({ ok: false, error: "tipo desconocido" });

    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
    const cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    hoja.appendRow(cab.map((c) => (c === "fecha" ? new Date() : limpiar_(d[c]))));

    if (AJUSTES.avisarA) {
      const cuerpo = cab.filter((c) => d[c]).map((c) => `${c}: ${limpiar_(d[c])}`).join("\n");
      MailApp.sendEmail(AJUSTES.avisarA, `Euporia · nuevo envío (${d.tipo}${d.ref ? " " + d.ref : ""})`, cuerpo);
    }
    return json_({ ok: true });
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
  const col = (fila, nombre) => fila[cab.indexOf(nombre)];
  const esSi = (v) => ["si", "sí", "true", "x"].includes(String(v).trim().toLowerCase());
  const numero = (v) => (v === "" || v == null || isNaN(Number(v)) ? undefined : Number(v));

  const fichas = filas
    .filter((f) => col(f, "ref") && esSi(col(f, "publicar")) && esSi(col(f, "autorizacion_escrita")))
    .map((f) => ({
      ref: String(col(f, "ref")),
      tipo: String(col(f, "tipo") || ""),
      titulo: String(col(f, "titulo") || ""),
      zona: String(col(f, "zona") || ""),
      entorno: String(col(f, "entorno") || ""),
      superficie: numero(col(f, "superficie_m2")),
      parcela: numero(col(f, "parcela_m2")),
      dormitorios: numero(col(f, "dormitorios")),
      banos: numero(col(f, "banos")),
      precioDesde: numero(col(f, "precio_desde")),
      precioHasta: numero(col(f, "precio_hasta")),
      rentabilidad: String(col(f, "rentabilidad") || ""),
      estado: String(col(f, "estado") || "Disponible"),
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Recorta y evita que un texto se interprete como fórmula en la hoja. */
function limpiar_(v) {
  let s = v == null ? "" : String(v).slice(0, AJUSTES.maxLongitud);
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
