# Euporia · web

Portal estático de varias páginas: acompañamiento a familias y propiedades off-market (Valencia).

## Estructura

```
build.py               Generador: plantilla común, SEO, sitemap, robots. Toda la configuración está arriba (SITIO)
contenido/             Una página por archivo (bloque de datos entre --- y cuerpo HTML)
estaticos/             estilos.css, app.js, favicon.svg, og-euporia.png
docs/                  El sitio generado. Es lo que se publica. No se edita a mano
euporia-apps-script.gs Backend de formularios y fichas (Google Apps Script → Google Sheets)
```

## Páginas

| Dirección | Archivo |
|---|---|
| `/` | `contenido/inicio.html` |
| `/familias/` | `contenido/familias.html` |
| `/familias/vivienda-heredada/` | `contenido/familias-vivienda-heredada.html` |
| `/familias/vivienda-en-una-separacion/` | `contenido/familias-vivienda-en-una-separacion.html` |
| `/familias/cambiar-de-casa/` | `contenido/familias-cambiar-de-casa.html` |
| `/familias/vender-y-comprar-a-la-vez/` | `contenido/familias-vender-y-comprar-a-la-vez.html` |
| `/familias/hipoteca-inversa/` | `contenido/familias-hipoteca-inversa.html` (guía y calculadora, usa `estaticos/mayores.js`) |
| `/familias/nuda-propiedad/` | `contenido/familias-nuda-propiedad.html` (guía y calculadora, usa `estaticos/mayores.js`) |
| `/off-market/` | `contenido/off-market.html` |
| `/vender-sin-publicar/` | `contenido/vender-sin-publicar.html` |
| `/vender-sin-publicar/preparar-ficha/` | `contenido/vender-preparar-ficha.html` (asistente, usa `estaticos/ficha.js`) |
| `/valorar-visita/` | `contenido/valorar-visita.html` (calculadora para compradores, usa `estaticos/visita.js`) |
| `/quienes-somos/` | `contenido/quienes-somos.html` |
| `/aviso-legal/` | `contenido/aviso-legal.html` |

«Me cuesta pagar la hipoteca» enlaza al diagnóstico, que sigue en su propio repositorio.

## Cómo cambiar algo

1. Edita el archivo de `contenido/` (o `SITIO` / `SITUACIONES` en `build.py`).
2. Ejecuta `python3 build.py` (Python 3.8+, sin dependencias).
3. Sube los cambios, incluida la carpeta `docs/`.

Cada página genera sola: `<title>`, meta description, canonical, Open Graph, migas y Schema
(RealEstateAgent, WebSite, WebPage, BreadcrumbList, Service y FAQPage si tiene preguntas frecuentes).

Para añadir una página nueva: copia una guía de `contenido/`, cambia el bloque de datos
(`ruta`, `titulo`, `descripcion`, `padre`, `miga`, `servicio`) y añade la situación en `SITUACIONES`.

## Calculadora «Cuánto vale esta casa para ti»

Página `/valorar-visita/`, pensada para usar en el móvil durante una visita. Funciona sin servidor:
las visitas se guardan solo en el navegador (`localStorage`, claves `euporia_visita_*`) y no se envía nada al Apps Script.

- Lógica: `estaticos/visita.js`. Los ajustes del modelo están arriba, en `CONFIG` (ajuste máximo ±15 %, horquilla ±4 %,
  coste de obras en €/m² por nivel de reforma) y `PESO` (esencial ×3, importante ×2, secundario ×1).
- Estilos: bloque final de `estaticos/estilos.css` (usa los tokens del sitio, vale en tono claro y oscuro).
- Texto y preguntas frecuentes: `contenido/valorar-visita.html`. Si cambias el modelo, actualiza las FAQ: salen en el Schema.
- Precarga opcional desde un enlace: `/valorar-visita/?ref=Calle%20Colón%2012&precio=285000&m2=95`.
- El botón «Comentarlo con Euporia» abre WhatsApp con el resumen (usa `SITIO["whatsapp"]`); el comprador decide si lo envía.
- Está enlazada desde el pie, Off-market y dos guías de familias. No está en el menú principal.

## Calculadoras de hipoteca inversa y nuda propiedad

Hacen las cuentas en el navegador y no guardan ni envían nada. Se pueden precargar desde un enlace: `?edad=78&edad2=75&valor=250000`.

- Lógica y supuestos: `estaticos/mayores.js`. Todo lo que se puede ajustar está arriba, en `MODELO`, con su fuente.
- Si cambias un supuesto, actualiza «Cómo está hecha esta calculadora» en la guía correspondiente.
- Revisa cada cierto tiempo el interés de `MODELO.INVERSA` y las fichas de las entidades, y actualiza `SITIO["revision_mayores"]`.
- Años de vida: es una curva ajustada a una cifra de España y a la forma de las tablas de Murcia. Si consigues la tabla del INE por edades, cambia `MODELO.VIDA`.
- La tabla común de las dos guías es el hueco `{{comparativa}}` de `build.py`.
- `SITIO["acuerdo_inversa"]` y `SITIO["acuerdo_nuda"]`: con quién se trabaja y quién paga qué. Mientras estén vacíos, salen marcados como pendientes. No nombres a una entidad como colaboradora sin contrato firmado.
- Nunca se usa la salud ni la edad de nadie como argumento de venta.

## Off-market: cinco niveles de revelación

El vendedor prepara su ficha en `/vender-sin-publicar/preparar-ficha/` y decide qué se revela en cada nivel:
0 ficha ciega pública, 1 registro, 2 cualificación, 3 confidencialidad y dossier, 4 dirección y visita.
Al enviarla, el Apps Script guarda sus datos y elecciones en la hoja **Propuestas** y un borrador en **Fichas**
con `publicar = no` y `autorizacion_escrita = pendiente`. Para publicarla: revisar, confirmar por teléfono,
firmar la hoja de encargo y poner las dos columnas a «sí». Las fichas con `visibilidad = oculta` nunca salen en el portal.

## Publicar en GitHub Pages

1. Crea el repositorio (p. ej. `prestigyo/euporia`) y sube todo.
2. Settings → Pages → Deploy from a branch → `main` y carpeta `/docs`.
3. Sin dominio propio: en `build.py` pon `"base": "/euporia"` y `"dominio": "https://prestigyo.github.io"`. Genera y sube.
4. Con dominio propio: `"base": ""` y `"dominio": "https://tudominio.es"`. El generador crea `docs/CNAME`; configura el DNS según GitHub.

Con la dirección de GitHub (sin dominio propio), `robots.txt` y `sitemap.xml` no quedan en la raíz del dominio: envía el sitemap a mano en Google Search Console.

## Antes de lanzar

- [ ] Dominio definitivo en `SITIO["dominio"]` y `SITIO["base"]`.
- [ ] Rellenar `honorarios`, `titular_legal`, `responsable_tratamiento`, `conservacion`.
- [ ] Rellenar `acuerdo_inversa` y `acuerdo_nuda`, y revisar con un abogado si cobrar por presentar clientes a una entidad exige algún registro.
- [ ] Confirmar el texto sobre los especialistas (Quiénes somos) y el uso del nombre Huspy.
- [ ] Revisar el aviso legal con un asesor.
- [ ] Conectar Apps Script: `endpoint` y `fichas_url` en `SITIO`.
- [ ] Sustituir las fichas de ejemplo por fichas reales con autorización escrita.
- [ ] `SITIO["prototipo"] = False` (quita noindex, abre robots.txt y el aviso de prototipo).
- [ ] En el diagnóstico, poner la dirección del portal en `CONFIG.urlPortal` y cambiar su `noindex`.
- [ ] Dar de alta el sitio en Google Search Console y enviar el sitemap.
