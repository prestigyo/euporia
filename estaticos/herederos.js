/* =====================================================================
   Guía «Herederos sin acuerdo» (/familias/vivienda-heredada/herederos-sin-acuerdo/)
   - Cada .rama tiene botones (data-elige) y respuestas (data-respuesta):
     al pulsar, se ve solo la respuesta elegida; al cambiar de respuesta,
     se borran las preguntas que colgaban de la anterior.
   - Los enlaces #caso abren el caso y bajan hasta él (también desde la dirección).
   No envía ni guarda nada.
   ===================================================================== */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var contador = 0;
  document.querySelectorAll(".rama").forEach(function (rama) {
    var botones = rama.querySelectorAll(":scope > .rama-botones > button");
    var respuestas = rama.querySelectorAll(":scope > .rama-respuesta");
    botones.forEach(function (b) {
      var r = rama.querySelector(':scope > .rama-respuesta[data-respuesta="' + b.dataset.elige + '"]');
      if (r) {
        if (!r.id) r.id = "respuesta-" + (++contador);
        b.setAttribute("aria-controls", r.id);
      }
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        botones.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        respuestas.forEach(function (x) {
          var activa = x === r;
          x.classList.toggle("activa", activa);
          if (!activa) reiniciar(x);
        });
        if (r && r.getBoundingClientRect().bottom > window.innerHeight) {
          r.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    });
  });

  function reiniciar(contenedor) {
    contenedor.querySelectorAll(".rama-botones button").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    contenedor.querySelectorAll(".rama-respuesta").forEach(function (x) { x.classList.remove("activa"); });
  }

  function abrir(id, desplazar) {
    var caso = id && document.getElementById(id);
    if (!caso || !caso.classList.contains("caso")) return false;
    caso.open = true;
    if (desplazar) caso.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (abrir(id, true)) {
      ev.preventDefault();
      try { history.replaceState(null, "", "#" + id); } catch (e) { /* sin historial: no pasa nada */ }
    }
  });

  try { abrir(decodeURIComponent(location.hash.slice(1)), true); } catch (e) { /* dirección rara: se ignora */ }
  window.addEventListener("hashchange", function () { abrir(location.hash.slice(1), true); });
})();
