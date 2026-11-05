# CLAUDE.md · Euporia (euporia.es)

> Este archivo manda sobre el `CLAUDE.md` de la carpeta superior (`mequedocontuhipoteca.com/`), que describe el prototipo
> antiguo («un solo archivo HTML», nombre provisional, sin datos reales). Donde se contradigan, vale este.
> Antes de cambiar nada, **lee `LEEME.md`**: tiene la estructura, cada calculadora y cómo se publica.

## 1. Qué es

Portal estático en Valencia con **dos partes que no se mezclan**:

- **Familias:** acompañamiento inmobiliario (no puedo pagar la hipoteca, herencia, separación, cambiar de casa,
  hipoteca inversa, nuda propiedad). Por defecto defendemos a la familia.
- **Off-market:** venta discreta para propietarios y compradores (vender sin publicar, ficha ciega, calculadoras de compra).

Titular: PROA Y POPA EUROPEA S.L. Responsable: Ramón J. Giménez. Él no es programador: explícale los cambios en pocas palabras y sin tecnicismos.

## 2. Cómo está hecha y cómo se publica

- `build.py` genera la web desde `contenido/` (una página por archivo, con bloque de datos) y `estaticos/` (CSS y JS sin frameworks).
  Toda la configuración está arriba, en `SITIO`. Python 3.8+, sin dependencias.
- **Cloudflare Pages publica la rama `main`** en euporia.es: subir a `main` es publicar. Cada cambio a producción, solo con el visto bueno de Ramón.
- **No toques ni subas `docs/`.** Para probar, genera en una carpeta temporal (copia `build.py`, `contenido/` y `estaticos/` y ejecuta
  `CF_PAGES=1 python3 build.py` allí).
- La compilación falla si queda un marcador (`[CONFIRMAR]`, `[PENDIENTE]`…) en una página pública.
- Formularios: patrón `form[data-form]` de `estaticos/app.js` → `euporia-apps-script.gs` (Google Sheets). Si añades un tipo o una pestaña,
  avisa a Ramón de que tiene que pegar el script nuevo, ejecutar `configurar` y publicar una nueva versión.

**Página nueva:** archivo en `contenido/` con `ruta`, `titulo` (≤55 caracteres), `descripcion` (≤160), `padre`, `miga` y `actualizado:`.
Si es una herramienta: `aplicacion: si` y `js:` con el nombre del script (eso además impide que se cargue Clarity).
Explicación indexable en `<details class="mas-info">` y preguntas frecuentes en `<div class="faq">…</div><!-- /faq -->` (salen en el Schema).
Enlázala desde el pie (`pie()` en `build.py`) o desde las páginas relacionadas, y añádela a la tabla de `LEEME.md`.

**Antes de entregar:** un solo H1 por página, títulos y descripciones únicos, sin enlaces rotos, sin errores de JavaScript
y sin desbordes a 375 px de ancho. Commits pequeños y revisables; no reestructures sin que se pida.

## 3. Calculadoras

Todas hacen las cuentas en el navegador. Estilos con las clases `.calc*` de `estaticos/estilos.css` y los tokens de color de `:root`
(funcionan en tono claro y oscuro). **Si cambias un supuesto o un umbral, actualiza el texto y las FAQ de su página**: salen en el Schema.

| Página | Archivo de contenido | Script | Notas |
|---|---|---|---|
| `/familias/hipoteca/diagnostico/` | `familias-hipoteca-diagnostico.html` | `diagnostico.js` + `.css` | Diagnóstico de hipoteca y cartas al banco |
| `/familias/vivienda-heredada/` | `familias-vivienda-heredada.html` | `herencia.js` | Cuatro caminos para herederos; no calcula impuestos |
| `/familias/hipoteca-inversa/` y `/familias/nuda-propiedad/` | `familias-hipoteca-inversa.html`, `familias-nuda-propiedad.html` | `mayores.js` | Supuestos en `MODELO`, con fuente |
| `/off-market/cuanta-hipoteca-puedo-pedir/` | `off-market-hipoteca.html` | `hipoteca.js` | Contacto a intermediario con consentimiento |
| `/valorar-visita/` | `valorar-visita.html` | `visita.js` | Para compradores, durante la visita; ajuste máx. ±15 % |
| `/valorar-mi-casa/` | `valorar-mi-casa.html` | `conceptual.js` | Para propietarios: valor sin metros (ver abajo) |
| `/vender-sin-publicar/preparar-ficha/` | `vender-preparar-ficha.html` | `ficha.js` | Ficha ciega off-market, cinco niveles |

**Valorador conceptual (`conceptual.js`):** ocho dimensiones (luz y aire, calma, la vida que cabe, distribución, barrio y servicios, vida de barrio,
cuerpo de la casa, carácter) con preguntas cerradas → perfil 0–100, argumentos de venta y frenos. El valor en euros **solo** parte de una
cifra que pone el propietario (casas parecidas, valor de referencia del Catastro, tasación o precio que piensa pedir); ajuste máx. ±15 %,
supuestos en `VALOR` y casos de prueba en la cabecera del archivo. No envía nada; los datos de la solicitud (referencia catastral o dirección)
solo van al mensaje de WhatsApp y no se guardan. Es complementario de la calculadora de visitas: no las dupliques y mantenlas enlazadas.

## 4. Reglas de contenido que no se rompen

- **Sin urgencia artificial** (cuentas atrás, «últimas plazas», colores de alarma) y **sin promesas** («garantizado», «sin riesgo», «100 %», «te salvamos»).
- **No prometer que algo es gratis** («gratis», «sin coste») salvo que Ramón lo decida expresamente.
- **Nada inventado:** ni casos, ni cifras, ni testimonios, ni teléfonos o direcciones de organismos. **Nunca precios por zona ni €/m² inventados.**
- Datos que caducan (euríbor, requisitos legales y fiscales, plazos): con fecha y fuente oficial. Si no hay un valor verificado, pregunta.
- **No es asesoramiento jurídico, fiscal ni financiero:** ante ejecución, herencia, fiscalidad o segunda oportunidad, remitir a abogado o asesor.
- **No mencionar a Huspy.** La web no capta inversores en la parte de familias ni deriva operaciones a terceros sin decirlo.
- Si una operación cobra de alguien, se dice por escrito quién paga a quién (`SITIO["honorarios"]`, `acuerdo_inversa`, `acuerdo_nuda`).
- Español claro y cercano, sin culpabilizar; un tecnicismo se explica en la misma frase.

## 5. Datos personales y medición

- Google Analytics y Clarity solo con consentimiento (`estaticos/medicion.js`). **Nunca datos personales en eventos de Analytics.**
  Clarity no se carga en las páginas con `js:` (calculadoras).
- Si una página envía datos, di en ella exactamente qué se envía y pide consentimiento cuando sean personales.
  Nunca DNI ni números de cuenta.
- Sin remarketing en la parte de familias.

## 6. Si no está claro

Si una tarea toca negocio, textos legales, cifras sin verificar o cómo se cobra, pregunta a Ramón antes de suponer.
