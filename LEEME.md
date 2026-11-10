# Euporia · web

Portal estático de varias páginas: acompañamiento a familias y propiedades off-market (Valencia).

## Estructura

```
build.py               Generador: plantilla común, SEO, sitemap, robots. Toda la configuración está arriba (SITIO)
contenido/             Una página por archivo (bloque de datos entre --- y cuerpo HTML)
estaticos/             estilos.css, app.js, favicon.svg, og-euporia.png y fuentes/ (tipografías alojadas aquí, no en Google)
docs/                  Copia antigua de GitHub Pages, en noindex. No se regenera ni se sube: Cloudflare genera la web al publicar
euporia-apps-script.gs Backend de formularios y fichas (Google Apps Script → Google Sheets)
```

## Páginas

| Dirección | Archivo |
|---|---|
| `/` | `contenido/inicio.html` |
| `/familias/` | `contenido/familias.html` |
| `/familias/hipoteca/` y ocho páginas más (entre ellas `evitar-la-subasta/`) | `contenido/familias-hipoteca*.html` |
| `/familias/vivienda-heredada/` | `contenido/familias-vivienda-heredada.html` |
| `/familias/vivienda-heredada/herederos-sin-acuerdo/` | `contenido/familias-herederos-sin-acuerdo.html` (nueve casos desplegables con ramas de preguntas, usa `estaticos/herederos.js` y `.css`) |
| `/familias/vivienda-heredada/casa-a-nombre-de-un-fallecido/` | `contenido/familias-casa-a-nombre-de-un-fallecido.html` (herencia sin hacer: recargos, prescripción, pasos y gastos) |
| `/familias/si-fallece-tu-pareja/` | `contenido/familias-fallece-pareja.html` |
| `/familias/vivienda-en-una-separacion/` | `contenido/familias-vivienda-en-una-separacion.html` |
| `/familias/cambiar-de-casa/` | `contenido/familias-cambiar-de-casa.html` |
| `/familias/vender-y-comprar-a-la-vez/` | `contenido/familias-vender-y-comprar-a-la-vez.html` |
| `/familias/hipoteca-inversa/` | `contenido/familias-hipoteca-inversa.html` (guía y calculadora, usa `estaticos/mayores.js`) |
| `/familias/nuda-propiedad/` | `contenido/familias-nuda-propiedad.html` (guía y calculadora, usa `estaticos/mayores.js`) |
| `/off-market/` | `contenido/off-market.html` |
| `/vender-sin-publicar/` | `contenido/vender-sin-publicar.html` |
| `/vender-sin-publicar/preparar-ficha/` | `contenido/vender-preparar-ficha.html` (asistente, usa `estaticos/ficha.js`) |
| `/vender-sin-publicar/inmueble-con-leasing/` | `contenido/vender-inmueble-con-leasing.html` |
| `/valorar-mi-casa/` | `contenido/valorar-mi-casa.html` (valorador conceptual para propietarios, usa `estaticos/conceptual.js`) |
| `/valorar-visita/` | `contenido/valorar-visita.html` (calculadora para compradores, usa `estaticos/visita.js`) |
| `/documentos/` y sus cuatro guías | `contenido/documentos*.html` (nota simple, valor de referencia, certificado energético, planos; formulario `{{form_documento:clave}}` → hoja «Documentos») |
| `/quienes-somos/` | `contenido/quienes-somos.html` |
| `/aviso-legal/` | `contenido/aviso-legal.html` |

El diagnóstico está en `/familias/hipoteca/diagnostico/` (`estaticos/diagnostico.js` y `.css`). Sustituye al repositorio `Diagnostico-hipoteca`.

Cuando cambies una guía, actualiza `actualizado:` en su bloque de datos: es la fecha que ven el lector y Google. No la cambies si solo corriges una errata.

## Cómo cambiar algo

1. Edita el archivo de `contenido/` (o `SITIO` / `SITUACIONES` en `build.py`).
2. Si quieres verla antes, ejecuta `python3 build.py` (Python 3.8+, sin dependencias). Para verla como en Cloudflare: `CF_PAGES=1 python3 build.py`.
3. Sube solo `contenido/`, `estaticos/`, `build.py` y lo que hayas cambiado. **No subas la carpeta `docs/`** que genera tu ordenador: deshaz sus cambios (`git checkout -- docs && git clean -fd docs`). Cloudflare genera la web al publicar.

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

## Valorador «Lo que vale tu casa, sin contar metros»

Página `/valorar-mi-casa/`, para propietarios que piensan vender. Describe la vivienda en ocho dimensiones
(luz y aire, calma, la vida que cabe, distribución, barrio y servicios, vida de barrio, cuerpo de la casa y carácter) con preguntas cerradas.
Devuelve el perfil (0–100 por dimensión), los argumentos de venta, los frenos y, si el propietario pone una cifra de partida
(casas parecidas, valor de referencia, tasación o precio que piensa pedir), un valor orientativo con ajuste máximo de ±15 %.
Nunca usa precios por zona ni €/m². Supuestos en `VALOR`. Si no tiene cifra, se le ofrece conseguirle el valor de referencia o una valoración.
- Imprimir saca un informe completo (`#vc-informe`, se monta al imprimir); WhatsApp comparte con cualquiera o con Euporia.

- Lógica, preguntas y puntuaciones: `estaticos/conceptual.js` (`D`, `UMBRAL`, `ARREGLO`). Casos de prueba en su cabecera.
- No envía nada: las respuestas se guardan en el navegador (`localStorage`, clave `euporia_conceptual`). WhatsApp abre el resumen y la persona decide si lo manda.
- Si cambias preguntas o umbrales, revisa el texto y las FAQ de `contenido/valorar-mi-casa.html`.

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

## Publicar en Cloudflare Pages

El mismo repositorio sirve para los dos sitios. Cloudflare define `CF_PAGES=1` al compilar y `build.py` lo detecta:
genera la web en la raíz y añade `docs/_headers`. La carpeta `docs/` del repositorio sigue siendo la versión de GitHub Pages.

**Crear el proyecto**

1. Cloudflare → Workers & Pages → Create application → Pages → Connect to Git → GitHub.
2. Elige `prestigyo/euporia` y pulsa Begin setup.
3. Rama de producción: `main`. Framework preset: None. Build command: `python3 build.py`. Build output directory: `docs`.
4. Save and Deploy. La web queda en `https://<proyecto>.pages.dev`, siempre sin indexar.

Cada cambio subido a `main` vuelve a publicar la web. Otra rama genera su propia dirección de prueba.

**Cuando haya dominio**

1. Añade el dominio en Cloudflare y cambia en IONOS los nameservers por los que te indique.
2. En el proyecto: Custom domains → añade el dominio y `www`.
3. En `build.py`, pon `SITIO["dominio_final"] = "https://tudominio.es"`.
4. Cuando todo funcione, desactiva GitHub Pages y haz privado el repositorio.

Los registros del correo (MX, SPF, DKIM, DMARC) se añaden en el DNS de Cloudflare. Si son de correo, déjalos en «DNS only».
Las redirecciones 301 irán en un archivo `_redirects`, que se generará igual que `_headers` cuando haga falta.

## Publicar en GitHub Pages (versión antigua, ya no se usa)

Se deja por si hiciera falta. Mientras exista, `docs/` debe seguir en noindex: no la regeneres para euporia.es.


1. Crea el repositorio (p. ej. `prestigyo/euporia`) y sube todo.
2. Settings → Pages → Deploy from a branch → `main` y carpeta `/docs`.
3. Sin dominio propio: en `build.py` pon `"base": "/euporia"` y `"dominio": "https://prestigyo.github.io"`. Genera y sube.
4. Con dominio propio: `"base": ""` y `"dominio": "https://tudominio.es"`. El generador crea `docs/CNAME`; configura el DNS según GitHub.

Con la dirección de GitHub (sin dominio propio), `robots.txt` y `sitemap.xml` no quedan en la raíz del dominio: envía el sitemap a mano en Google Search Console.

## Buscador de las guías

En la portada y en la página de error. `build.py` escribe `docs/buscador.json` (título visible, sección,
descripción y palabras de cada página: títulos de apartados y preguntas frecuentes) y `estaticos/app.js`
busca en el navegador, con algunos sinónimos («divorcio» → separación, «desahucio» → subasta…).
Si `SITIO["buscador_log"]` tiene la URL de `euporia-buscador.gs` (hoja propia, separada de la de
formularios), se guarda de forma anónima qué se busca y cuántas guías encontró, sumado por día;
nada de la persona. En la hoja, el menú «Búsquedas → Sin resultados» da la lista de guías que faltan.

## Indexación y medición

- En Cloudflare el sitio se genera siempre indexable, con `robots.txt` abierto y `sitemap.xml`. `docs/` (GitHub Pages) sigue en `noindex`, y las direcciones `*.pages.dev` también.
- La compilación falla si queda un marcador (`[CONFIRMAR]`, `[PENDIENTE]`…) en una página pública: sigue activa la versión anterior.
- `SITIO["ga4"]` y `SITIO["clarity"]`: al rellenarlos, aparece el aviso de cookies y se carga `estaticos/medicion.js`. Sus eventos están descritos al principio de ese archivo.
- Cada evento de Analytics lleva el parámetro `seccion` (Familias, Compradores, Vendedores, Documentos o General), según la ruta de la página; se puede forzar con `seccion:` en el bloque de datos. En Analytics es la dimensión personalizada «Parte de la web». (`content_group` no sirve: Google lo descarta en la vista de página.)
- Google Analytics: registra `porcentaje`, `segundos`, `formulario`, `canal` y `herramienta` como dimensiones personalizadas, y marca `generate_lead` como evento clave.
- Publicidad: sin remarketing en la parte de familias. Google prohíbe usar audiencias propias en anuncios sobre dificultades económicas.

## Pendientes legales

**Desde el primer contacto real:**

- [ ] NIF y domicilio en `SITIO["nif"]` y `SITIO["domicilio"]` (LSSI, art. 10), y el titular definitivo si no eres tú.
- [ ] Revisar el aviso legal, la política de cookies y la conservación de datos con un asesor.
- [ ] Google Workspace (contrato de encargado) antes de guardar datos de familias en Sheets.
- [ ] Inscripción en el Registro de Agentes de Intermediación Inmobiliaria de la Comunitat Valenciana, si te corresponde, y su número en `SITIO["registro_agente"]`.
- [ ] Registro de actividades de tratamiento y análisis de riesgos: los datos económicos de familias son delicados.

**Con más notoriedad o más negocio:**

- [ ] Hoja de encargo y contratos revisados por un abogado; autorización escrita por cada ficha.
- [ ] Certificado energético en la publicidad de cada inmueble (RD 390/2021).
- [ ] Prevención de blanqueo de capitales: las inmobiliarias son sujeto obligado (Ley 10/2010).
- [ ] Publicidad y comisiones de entidades: declararlas, enlaces con `rel="sponsored"` y revisar si exige registro como intermediario.
- [ ] Marca «Euporia» en la OEPM o la EUIPO.
- [ ] Fuentes de Google alojadas en el propio sitio, para no enviar la IP de cada visita a Google.
