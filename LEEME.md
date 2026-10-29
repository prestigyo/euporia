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
| `/off-market/` | `contenido/off-market.html` |
| `/vender-sin-publicar/` | `contenido/vender-sin-publicar.html` |
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

## Publicar en GitHub Pages

1. Crea el repositorio (p. ej. `prestigyo/euporia`) y sube todo.
2. Settings → Pages → Deploy from a branch → `main` y carpeta `/docs`.
3. Sin dominio propio: en `build.py` pon `"base": "/euporia"` y `"dominio": "https://prestigyo.github.io"`. Genera y sube.
4. Con dominio propio: `"base": ""` y `"dominio": "https://tudominio.es"`. El generador crea `docs/CNAME`; configura el DNS según GitHub.

Con la dirección de GitHub (sin dominio propio), `robots.txt` y `sitemap.xml` no quedan en la raíz del dominio: envía el sitemap a mano en Google Search Console.

## Antes de lanzar

- [ ] Dominio definitivo en `SITIO["dominio"]` y `SITIO["base"]`.
- [ ] Rellenar `honorarios`, `titular_legal`, `responsable_tratamiento`, `conservacion`.
- [ ] Confirmar el texto sobre los especialistas (Quiénes somos) y el uso del nombre Huspy.
- [ ] Revisar el aviso legal con un asesor.
- [ ] Conectar Apps Script: `endpoint` y `fichas_url` en `SITIO`.
- [ ] Sustituir las fichas de ejemplo por fichas reales con autorización escrita.
- [ ] `SITIO["prototipo"] = False` (quita noindex, abre robots.txt y el aviso de prototipo).
- [ ] En el diagnóstico, poner la dirección del portal en `CONFIG.urlPortal` y cambiar su `noindex`.
- [ ] Dar de alta el sitio en Google Search Console y enviar el sitemap.
