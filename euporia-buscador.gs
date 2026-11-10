/**
 * Euporia · registro anónimo del buscador de la web
 * ---------------------------------------------------------------------------
 * Va en una hoja de cálculo PROPIA, separada de la de los formularios: aquí no
 * hay datos de nadie y así se queda.
 *
 * Despliegue (una sola vez):
 *   1. Crea una hoja de cálculo nueva: «Euporia · búsquedas».
 *   2. Extensiones → Apps Script. Borra lo que haya, pega este archivo y guarda.
 *   3. Implementar → Nueva implementación → tipo «Aplicación web».
 *      Ejecutar como: «Yo». Quién tiene acceso: «Cualquier usuario».
 *   4. Copia la URL que termina en /exec y pásala para ponerla en build.py
 *      (SITIO["buscador_log"]). Hasta entonces el buscador funciona, pero no guarda nada.
 *
 * QUÉ SE GUARDA, y por qué solo esto
 * ---------------------------------------------------------------------------
 * Fecha (el día, SIN hora), lo que se buscó, cuántas guías encontró, en qué
 * página está el buscador (portada o página de error) y cuántas veces se buscó
 * lo mismo ese día. Las repeticiones se suman en la misma fila.
 *
 * No llega hasta aquí —ni se guarda— IP, cookie, identificador de sesión o de
 * usuario, navegador, hora exacta ni ubicación. Sin esos datos NO se puede saber
 * que dos búsquedas son de la misma persona: esto mide qué se busca, no quién.
 *
 * Lo más útil es el menú «Búsquedas → Sin resultados»: lo que la gente busca y
 * la web todavía no explica. Es la lista de guías que faltan.
 */

var HOJA = "busquedas";

// Por debajo no informa; por encima suele ser un texto pegado por error.
var MIN_LARGO = 2;
var MAX_LARGO = 80;

// Aunque no guardemos identificadores, la gente escribe cosas en un buscador.
// Lo que parezca un dato personal se descarta antes de escribir nada.
var PERSONALES = [
  /[\w.+-]+@[\w-]+\.[\w.]+/,             // correo
  /\b(?:\+?\d[ .-]?){9,}\b/,             // teléfono o número largo (cuenta, tarjeta)
  /\b\d{8}[ -]?[a-z]\b/i,                // DNI
  /\b[xyz][ -]?\d{7}[ -]?[a-z]\b/i,      // NIE
  /\bes\d{2}[ ]?\d{4}/i                  // IBAN
];

var ORIGENES = ["inicio", "404"];

function doPost(e) {
  var out;
  try {
    out = registrar_(JSON.parse((e && e.postData && e.postData.contents) || "{}"));
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function registrar_(p) {
  var q = String(p.q == null ? "" : p.q).trim().toLowerCase().replace(/\s+/g, " ");
  if (q.length < MIN_LARGO || q.length > MAX_LARGO) return { ok: false, error: "largo" };
  for (var i = 0; i < PERSONALES.length; i++) {
    if (PERSONALES[i].test(q)) return { ok: false, error: "descartada" };
  }
  var n = parseInt(p.n, 10);
  if (isNaN(n) || n < 0) n = 0;
  var origen = ORIGENES.indexOf(p.o) >= 0 ? p.o : "inicio";

  // El día basta para ver tendencias; la hora permitiría reconstruir visitas.
  var hoy = Utilities.formatDate(new Date(), "Europe/Madrid", "yyyy-MM-dd");

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var hoja = hoja_();
    var datos = hoja.getDataRange().getValues();
    for (var f = 1; f < datos.length; f++) {
      var fecha = datos[f][0] instanceof Date ? Utilities.formatDate(datos[f][0], "Europe/Madrid", "yyyy-MM-dd") : String(datos[f][0]);
      if (fecha === hoy && datos[f][1] === q && datos[f][3] === origen) {
        hoja.getRange(f + 1, 3).setValue(n);
        hoja.getRange(f + 1, 5).setValue((Number(datos[f][4]) || 1) + 1);
        return { ok: true, agregada: true };
      }
    }
    hoja.appendRow([hoy, q, n, origen, 1]);
    return { ok: true, agregada: false };
  } finally {
    lock.releaseLock();
  }
}

function hoja_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(HOJA);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA);
    hoja.appendRow(["fecha", "consulta", "resultados", "origen", "veces"]);
    hoja.setFrozenRows(1);
    hoja.getRange("A:A").setNumberFormat("@");
  }
  return hoja;
}

/** Menú «Búsquedas» en la hoja. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Búsquedas")
    .addItem("Sin resultados (lo que falta en la web)", "informeSinResultados")
    .addItem("Más buscadas", "informeMasBuscadas")
    .addToUi();
}

function informeSinResultados() { informe_(true); }
function informeMasBuscadas() { informe_(false); }

function informe_(soloVacias) {
  var datos = hoja_().getDataRange().getValues().slice(1);
  var acc = {};
  datos.forEach(function (r) {
    if (soloVacias && Number(r[2]) !== 0) return;
    acc[r[1]] = (acc[r[1]] || 0) + (Number(r[4]) || 1);
  });
  var filas = Object.keys(acc).map(function (k) { return [k, acc[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; });
  var nombre = soloVacias ? "sin resultados" : "más buscadas";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  hoja.clear();
  hoja.appendRow(["consulta", "veces"]);
  if (filas.length) hoja.getRange(2, 1, filas.length, 2).setValues(filas);
  hoja.setFrozenRows(1);
  ss.setActiveSheet(hoja);
}
