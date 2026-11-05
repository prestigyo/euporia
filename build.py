#!/usr/bin/env python3
"""
Euporia · generador del sitio estático

    python3 build.py

Lee las páginas de contenido/, les pone la plantilla común (cabecera, pie,
metaetiquetas, Open Graph y datos estructurados) y escribe el sitio listo para
publicar en docs/, junto con sitemap.xml, robots.txt y 404.html.

Sin dependencias: solo Python 3.8 o superior.

Cada archivo de contenido/ empieza con un bloque de datos entre líneas "---":
    ruta:        dirección de la página, p. ej. /familias/vivienda-heredada/
    titulo:      <title> y título para redes (sin la marca; se añade sola)
    descripcion: meta description (unos 150-160 caracteres)
    tono:        claro | oscuro
    nav:         familias | off-market | vender | quienes (pestaña marcada en el menú)
    padre:       ruta de la página madre, para las migas
    miga:        nombre corto de la página en las migas
    servicio:    (opcional) nombre del servicio para el Schema Service
    bienestar:   si (opcional) muestra el teléfono 024 en el pie
    js:          (opcional) script extra de estaticos/, sin extensión (p. ej. ficha)
    aplicacion:  si (opcional) añade el Schema WebApplication (páginas que son una herramienta)
Después va el cuerpo en HTML. Huecos disponibles:
    {{situaciones}} {{situaciones_mini}} {{form_familia}} {{form_familia:herencia}}
    {{form_propietario}} {{dialogo_offmarket}} {{comparativa}} {{cfg:clave}} {{revision}}
    {{hipoteca_nav}} {{datos_titular}} {{boton_cookies}}
Las preguntas frecuentes escritas como
    <details><summary>Pregunta</summary><div class="inner"><p>Respuesta</p></div></details>
dentro de <div class="faq"> se convierten solas en Schema FAQPage.
"""
from __future__ import annotations

import datetime
import hashlib
import html
import json
import os
import re
import shutil
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
CONTENIDO = RAIZ / "contenido"
ESTATICOS = RAIZ / "estaticos"
SALIDA = RAIZ / "docs"

# =============================================================================
# CONFIGURACIÓN · todo lo que puede cambiar vive aquí
# =============================================================================
SITIO = {
    # Dominio sin barra final. Mientras sea [DOMINIO], las URL absolutas quedan marcadas.
    "dominio": "https://prestigyo.github.io",
    # "" con dominio propio. "/euporia" si se publica en prestigyo.github.io/euporia
    "base": "/euporia",
    # Solo para Cloudflare Pages: dominio propio, sin barra final.
    # Vacío = usa la dirección *.pages.dev
    "dominio_final": "https://euporia.es",
    # True: noindex, robots.txt cerrado y aviso de prototipo. En Cloudflare se pone False (ver abajo),
    # así la copia antigua de GitHub Pages nunca compite con euporia.es.
    "prototipo": True,
    # Fecha por defecto de «actualizado» en cada página (AAAA-MM-DD)
    "publicacion": "2026-11-04",

    "nombre": "Euporia",
    "url_diagnostico": "/familias/hipoteca/diagnostico/",
    "email": "hola@euporia.es",
    "whatsapp": "34607818890",
    "telefono": "+34607818890",
    "responsable": "Ramón J. Giménez",
    "relacion": "consultor inmobiliario",
    # Perfiles públicos del responsable (LinkedIn, etc.): refuerzan la autoría ante Google
    "perfiles": ["https://es.linkedin.com/in/ramonjg"],

    "honorarios": ("Las calculadoras son de uso libre y no te comprometen a nada. Si nos encargas un servicio, antes de "
                   "empezar te decimos por escrito qué cobramos, quién lo paga y a quién representamos. Si en una operación "
                   "cobráramos de las dos partes, te lo diríamos también por escrito. Además, te damos las plantillas, "
                   "los textos y las herramientas para que lo hagas tú si te ves capaz; y si prefieres que te acompañemos, "
                   "aquí estamos."),
    # Titular de la web y responsable del tratamiento (LSSI art. 10 y RGPD)
    "titular_legal": "PROA Y POPA EUROPEA S.L.",
    "responsable_tratamiento": "PROA Y POPA EUROPEA S.L.",
    # Obligatorios por la LSSI (art. 10). Mientras estén vacíos, el generador avisa.
    "nif": "B20890521",
    "domicilio": "Avenida de Aragón, 26, 5º, 9ª, 46021 Valencia",
    "registro_agente": "",   # Registro de Agentes de Intermediación Inmobiliaria de la Comunitat Valenciana, si procede
    "conservacion": ("mientras atendemos tu consulta y, como máximo, 12 meses desde el último contacto, "
                     "salvo que la ley obligue a conservarlos más tiempo"),

    # Texto público de las guías de hipoteca inversa y nuda propiedad: con qué entidades
    # se trabaja y quién paga qué. No nombrar a ninguna como colaboradora sin contrato firmado.
    "acuerdo_inversa": ("De momento no tenemos acuerdos comerciales con ninguna entidad. Si llegáramos a tenerlos, "
                        "lo diríamos aquí y antes de cualquier oferta, con lo que cobramos y quién lo paga."),
    "acuerdo_nuda": ("De momento no tenemos acuerdos comerciales con ninguna empresa o comprador. Si llegáramos a tenerlos, "
                     "lo diríamos aquí y antes de cualquier oferta, con lo que cobramos y quién lo paga."),

    # Medición. Vacíos = sin aviso de cookies y sin ningún script de terceros
    "ga4": "G-9NWF1Z44Q8",       # ID de Google Analytics 4 (propiedad Euporia, flujo euporia.es)
    "clarity": "",   # ID de proyecto de Microsoft Clarity (mapas de calor y scroll)

    # Fecha de la última revisión de datos fiscales y legales de las guías
    "revision": "octubre de 2026",
    "revision_mayores": "noviembre de 2026",   # guías de hipoteca inversa y nuda propiedad

    # Apps Script (euporia-apps-script.gs). Vacíos = prototipo, no se guarda nada
    "endpoint": "https://script.google.com/macros/s/AKfycbxH-qVrialuxizbYnKtXx3Rbd7pGVlac881VReBr1Y29InWbI-vIAfwiJkmU0_Fg01U/exec",
    "fichas_url": "https://script.google.com/macros/s/AKfycbxH-qVrialuxizbYnKtXx3Rbd7pGVlac881VReBr1Y29InWbI-vIAfwiJkmU0_Fg01U/exec?accion=fichas",

    # Una ficha off-market con cualquiera de estos términos no se muestra
    "terminos_vetados": ["subasta", "urgente", "urgencia", "embargo", "ejecucion", "deuda", "impago",
                         "desahucio", "lanzamiento", "herencia", "heredero", "divorcio", "separacion",
                         "necesita vender", "chollo", "ganga", "liquidacion", "por debajo de mercado",
                         "bajo mercado", "precio de derribo"],
}

# Cloudflare Pages define CF_PAGES=1 y CF_PAGES_URL al compilar. Así, el mismo repositorio
# genera bien la web allí (en la raíz) y en GitHub Pages (en /euporia), sin tocar nada.
EN_CLOUDFLARE = os.environ.get("CF_PAGES") == "1"
if EN_CLOUDFLARE:
    SITIO["base"] = ""
    SITIO["dominio"] = SITIO["dominio_final"] or os.environ.get("CF_PAGES_URL", "").rstrip("/")
    SITIO["prototipo"] = False

# Atajos cortos con redirección permanente (docs/_redirects, solo en Cloudflare)
REDIRECCIONES = """\
/hipoteca /familias/hipoteca/ 301
/diagnostico /familias/hipoteca/diagnostico/ 301
"""

# Cabeceras de Cloudflare Pages (docs/_headers). Las direcciones *.pages.dev nunca se indexan,
# aunque el sitio ya no sea prototipo: solo debe posicionar el dominio propio.
CABECERAS_CLOUDFLARE = """\
https://:project.pages.dev/*
\tX-Robots-Tag: noindex

https://:version.:project.pages.dev/*
\tX-Robots-Tag: noindex

/*
\tX-Content-Type-Options: nosniff
\tX-Frame-Options: SAMEORIGIN
\tReferrer-Policy: strict-origin-when-cross-origin
\tPermissions-Policy: camera=(), microphone=(), geolocation=()
"""

# Situaciones de la puerta de familias. "url" externa (http) o ruta interna.
SITUACIONES = [
    {"id": "hipoteca", "titulo": "Me cuesta pagar la hipoteca", "principal": True,
     "url": "/familias/hipoteca/", "accion": "Ver qué puedo hacer", "nota": "Diagnóstico en 3 minutos",
     "texto": "Calcula cuánto pagarás tras la próxima revisión, qué margen te queda y qué salidas tienes, en orden, antes de que llegue una subasta. Sin dejar tus datos."},
    {"id": "herencia", "titulo": "He heredado una vivienda", "url": "/familias/vivienda-heredada/",
     "accion": "Qué hacer con una vivienda heredada",
     "texto": "Qué supone aceptarla, qué hacer si sois varios herederos y si conviene vender, alquilar o que alguien se la quede. Para el reparto y los impuestos, te acompañamos a un abogado o asesor especialista."},
    {"id": "separacion", "titulo": "Nos separamos y compartimos casa", "url": "/familias/vivienda-en-una-separacion/",
     "accion": "Qué hacer con la casa en una separación",
     "texto": "Opciones para la vivienda común: que uno se la quede, venderla o alquilarla, y qué pasa con la hipoteca que firmasteis juntos. Si hace falta, te acompañamos a un abogado de familia."},
    {"id": "tamano", "titulo": "La casa se nos ha quedado grande o pequeña", "url": "/familias/cambiar-de-casa/",
     "accion": "Cómo cambiar de casa",
     "texto": "Cambiar a una vivienda más grande o más pequeña, adaptada o más cerca de la familia, comparando números y sin prisas."},
    {"id": "mudanza", "titulo": "Tenemos que mudarnos", "url": "/familias/vender-y-comprar-a-la-vez/",
     "accion": "Cómo vender y comprar a la vez",
     "texto": "Vender y comprar a la vez sin pagar dos casas: en qué orden hacerlo, plazos y cómo encajar la financiación."},
    {"id": "inversa", "titulo": "Quiero más ingresos sin vender mi casa", "url": "/familias/hipoteca-inversa/",
     "accion": "Hipoteca inversa: cómo funciona y calculadora", "nota": "Con calculadora",
     "texto": "Para mayores de 65 años con casa propia: cobrar cada mes o de una vez y seguir siendo el dueño. La deuda crece cada año y la resuelven los herederos; la calculadora te enseña cuánto."},
    {"id": "nuda", "titulo": "Quiero vender mi casa y seguir viviendo en ella", "url": "/familias/nuda-propiedad/",
     "accion": "Nuda propiedad: cómo funciona y calculadora", "nota": "Con calculadora",
     "texto": "Vendes la casa, te quedas en ella de por vida y cobras hoy. Te pagan bastante menos que vendiéndola entera: la calculadora te da una horquilla orientativa y el cálculo de Hacienda."},
    {"id": "otra","titulo": "Otra situación", "url": None, "accion": "Contarnos tu caso",
     "texto": "Si tu caso no encaja aquí pero tiene que ver con tu casa, cuéntanoslo y te decimos con franqueza si podemos ayudar."},
]

# Páginas de la sección de hipoteca, para el índice común
GUIAS_HIPOTECA = [
    ("/familias/hipoteca/diagnostico/", "Tu diagnóstico", "Cuánto pagarás tras la revisión, tu margen y tus salidas. Sin dejar tus datos."),
    ("/familias/hipoteca/salidas/", "Las 9 salidas, en orden", "Qué es cada una, cuándo encaja y qué hacer."),
    ("/familias/hipoteca/que-pasa-si-dejo-de-pagar/", "Qué pasa si dejo de pagar", "Las fases, una a una, y lo que todavía puedes hacer en cada una."),
    ("/familias/hipoteca/vender-casa-con-hipoteca/", "Vender tu casa con hipoteca", "Las cuentas, los caminos posibles y cómo debe ser una oferta justa."),
    ("/familias/hipoteca/reunificar-deudas-y-otras-trampas/", "Cuidado con estas «soluciones»", "Las ofertas que parecen una salida y empeoran el problema."),
    ("/familias/hipoteca/ayuda-publica-valencia/", "Ayuda pública en Valencia", "Servicios públicos que orientan o median con tu banco."),
    ("/familias/hipoteca/preguntas-frecuentes/", "Preguntas frecuentes", "Las dudas más habituales, respondidas en pocas líneas."),
]

NAV = [
    ("familias", "Familias", "/familias/"),
    ("off-market", "Off-market", "/off-market/"),
    ("vender", "Vender sin publicar", "/vender-sin-publicar/"),
    ("quienes", "Quiénes somos", "/quienes-somos/"),
]

# Fuentes alojadas en estaticos/fuentes/ (ver estilos.css). Se precargan las dos que se ven primero.
FUENTES = ('<link rel="preload" href="/assets/fuentes/jost.woff2" as="font" type="font/woff2" crossorigin>\n'
           '<link rel="preload" href="/assets/fuentes/cormorant-garamond.woff2" as="font" type="font/woff2" crossorigin>')

e = html.escape


# =============================================================================
# Utilidades
# =============================================================================
def version(archivo: str) -> str:
    """Huella corta del archivo, para que el navegador no use una copia vieja tras un cambio."""
    return hashlib.md5((ESTATICOS / archivo).read_bytes()).hexdigest()[:8]


def url_absoluta(ruta: str) -> str:
    return SITIO["dominio"] + SITIO["base"] + ruta


def cfg(clave: str) -> str:
    valor = SITIO.get(clave, "")
    if valor:
        return e(str(valor))
    if not SITIO["prototipo"]:
        raise SystemExit(f"Falta un dato obligatorio para publicar: SITIO['{clave}']")
    return '<span class="pendiente">[Pendiente de definir antes de publicar]</span>'


def fecha_larga(iso: str) -> str:
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
             "septiembre", "octubre", "noviembre", "diciembre"]
    d = datetime.date.fromisoformat(iso)
    return f"{d.day} de {meses[d.month - 1]} de {d.year}"


def actualizado(p: dict) -> str:
    return p.get("actualizado") or SITIO["publicacion"]


def analitica_activa() -> bool:
    return bool(SITIO["ga4"] or SITIO["clarity"])


def datos_titular() -> str:
    """Identificación del titular (LSSI, art. 10). Solo muestra lo que esté rellenado."""
    partes = [e(SITIO["titular_legal"])]
    if SITIO["nif"]:
        partes.append("NIF " + e(SITIO["nif"]))
    if SITIO["domicilio"]:
        partes.append("domicilio en " + e(SITIO["domicilio"]))
    texto = ", ".join(partes) + f'. Correo: <a class="link" href="mailto:{e(SITIO["email"])}">{e(SITIO["email"])}</a>.'
    if SITIO["registro_agente"]:
        texto += " " + e(SITIO["registro_agente"]) + "."
    return texto


def hipoteca_nav(ruta_actual: str) -> str:
    tarjetas = [f'<a class="card-link" href="{r}"><strong>{e(t)}</strong>{e(d)}</a>'
                for r, t, d in GUIAS_HIPOTECA if r != ruta_actual]
    if ruta_actual != "/familias/hipoteca/":
        tarjetas.insert(0, '<a class="card-link" href="/familias/hipoteca/"><strong>No puedo pagar la hipoteca: por dónde empezar</strong>'
                           'Los primeros pasos y qué podemos hacer por ti.</a>')
    return '<nav class="cards" aria-label="Guías sobre la hipoteca">\n' + "\n".join(tarjetas) + "\n</nav>"


def leer_pagina(archivo: Path) -> dict:
    texto = archivo.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)", texto, re.S)
    if not m:
        raise SystemExit(f"{archivo.name}: falta el bloque de datos entre ---")
    meta = {}
    for linea in m.group(1).splitlines():
        if linea.strip() and not linea.lstrip().startswith("#"):
            k, _, v = linea.partition(":")
            meta[k.strip()] = v.strip()
    for obligatoria in ("ruta", "titulo", "descripcion"):
        if obligatoria not in meta:
            raise SystemExit(f"{archivo.name}: falta «{obligatoria}»")
    meta["cuerpo"] = m.group(2)
    meta["archivo"] = archivo.name
    return meta


def texto_plano(fragmento: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", fragmento))).strip()


# =============================================================================
# Piezas reutilizables
# =============================================================================
def situaciones_lista() -> str:
    filas = []
    for s in SITUACIONES:
        if s["url"] and s.get("principal"):
            accion = f'<a class="btn" href="{e(s["url"])}">{e(s["accion"])}</a>'
        elif s["url"]:
            accion = f'<a class="link" href="{s["url"]}">{e(s["accion"])}</a>'
        else:
            accion = f'<a class="link" href="/familias/?situacion={s["id"]}#contacto" data-situacion="{s["id"]}">{e(s["accion"])}</a>'
        clase = "situacion principal" if s.get("principal") else "situacion"
        filas.append(f'<li class="{clase}" id="situacion-{s["id"]}"><h2>{e(s["titulo"])}</h2>'
                     f'<div><p>{e(s["texto"])}</p>{accion}</div></li>')
    return '<ul class="situaciones">\n' + "\n".join(filas) + "\n</ul>"


def situaciones_mini() -> str:
    items = []
    for s in SITUACIONES:
        href = s["url"] or f'/familias/?situacion={s["id"]}#contacto'
        nota = f'<small>{e(s["nota"])}</small>' if s.get("nota") else ""
        items.append(f'<li><a href="{e(href)}"><span>{e(s["titulo"])}</span>{nota}</a></li>')
    return ('<ul class="situ-mini" aria-label="Situaciones en las que ayudamos">\n'
            + "\n".join(items) + "\n</ul>")


def form_familia(seleccion: str = "") -> str:
    opciones = ['<option value="">Elige la que más se parezca</option>']
    for s in SITUACIONES:
        sel = " selected" if s["id"] == seleccion else ""
        opciones.append(f'<option value="{s["id"]}"{sel}>{e(s["titulo"])}</option>')
    return f'''<form class="form-card" data-form="familia" novalidate>
  <div class="form-grid">
    <label class="campo"><span>Nombre</span><input type="text" name="nombre" autocomplete="given-name" required></label>
    <label class="campo"><span>Teléfono o email</span><input type="text" name="contacto" autocomplete="tel" required></label>
    <label class="campo full"><span>¿Qué está pasando?</span>
      <select name="situacion" id="sel-situacion" required>{"".join(opciones)}</select>
    </label>
    <label class="campo full"><span>¿Cuándo te viene bien que te llamemos?</span>
      <select name="cuando"><option>Me da igual</option><option>Por la mañana</option><option>Por la tarde</option><option>Prefiero que me escribáis</option></select>
    </label>
    <label class="campo full"><span>Cuéntanos lo que quieras <small>(opcional)</small></span><textarea name="mensaje"></textarea></label>
    <label class="check full"><input type="checkbox" name="acepta_privacidad" value="sí" required> <span>Acepto que uséis estos datos para contactarme sobre mi situación. <a class="link" href="/aviso-legal/">Privacidad</a></span></label>
    <div class="hp" aria-hidden="true"><label>Web <input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
    <div class="full"><button class="btn" type="submit">Enviar</button><p class="estado-envio" role="status" aria-live="polite"></p></div>
  </div>
</form>'''


def form_propietario() -> str:
    return '''<form class="form-card" id="formulario" data-form="propietario" novalidate>
  <h2>Prefiero que me llaméis</h2>
  <p>Déjanos tus datos y lo hablamos por teléfono. No pongas la dirección exacta.</p>
  <div class="form-grid">
    <label class="campo"><span>Nombre</span><input type="text" name="nombre" autocomplete="given-name" required></label>
    <label class="campo"><span>Teléfono o email</span><input type="text" name="contacto" autocomplete="tel" required></label>
    <label class="campo"><span>Tipo de inmueble</span>
      <select name="tipo_inmueble" required><option value="">Elige uno</option><option>Vivienda</option><option>Local</option><option>Suelo</option><option>Edificio</option><option>Otro</option></select>
    </label>
    <label class="campo"><span>Municipio o barrio</span><input type="text" name="zona" required></label>
    <label class="campo"><span>Superficie aproximada <small>(opcional)</small></span><input type="text" name="superficie" inputmode="numeric" placeholder="m²"></label>
    <label class="campo"><span>Precio que esperas <small>(opcional)</small></span><input type="text" name="precio_esperado" inputmode="numeric" placeholder="€"></label>
    <label class="campo full"><span>¿Por qué prefieres no publicarla? <small>(opcional; solo para nosotros, nunca aparece en la ficha)</small></span>
      <select name="motivo"><option value="">Prefiero no decirlo</option><option>Privacidad</option><option>No quiero visitas continuas</option><option>Está alquilada o con un negocio abierto</option><option>Somos varios propietarios</option><option>Otro motivo</option></select>
    </label>
    <label class="campo full"><span>Algo más que debamos saber <small>(opcional)</small></span><textarea name="mensaje"></textarea></label>
    <label class="check full"><input type="checkbox" name="acepta_privacidad" value="sí" required> <span>Acepto que uséis estos datos para contactarme sobre mi propiedad. <a class="link" href="/aviso-legal/">Privacidad</a></span></label>
    <div class="hp" aria-hidden="true"><label>Web <input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
    <div class="full"><button class="btn" type="submit">Enviar</button><p class="estado-envio" role="status" aria-live="polite"></p></div>
  </div>
</form>'''


def dialogo_offmarket() -> str:
    return '''<dialog id="dlg" class="tone-dark" aria-labelledby="dlg-titulo">
  <form class="dlg-body" data-form="dlg" novalidate>
    <div class="dlg-head"><h2 id="dlg-titulo">Pedir el dossier</h2><button class="cerrar" type="button" data-cerrar>Cerrar</button></div>
    <p id="dlg-sub" style="color:var(--fg-soft)"></p>
    <input type="hidden" name="ref"><input type="hidden" name="tipo">
    <div class="form-grid">
      <label class="campo"><span>Nombre</span><input type="text" name="nombre" autocomplete="name" required></label>
      <label class="campo"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>
      <label class="campo"><span>Teléfono <small>(opcional)</small></span><input type="tel" name="telefono" autocomplete="tel"></label>
      <label class="campo"><span>Eres</span>
        <select name="perfil" required><option value="">Elige uno</option><option>Comprador particular</option><option>Inversor</option><option>Profesional que busca para un cliente</option></select>
      </label>
      <fieldset class="full form-grid" data-modo="dossier busqueda">
        <label class="campo"><span>Presupuesto máximo</span><input type="text" name="presupuesto" inputmode="numeric" placeholder="€" required></label>
        <label class="campo"><span>¿Cuándo quieres comprar?</span>
          <select name="plazo" required><option value="">Elige una opción</option><option>Ya</option><option>En los próximos 3 meses</option><option>En 6 meses</option><option>Más adelante</option></select>
        </label>
        <label class="campo full"><span>¿Cómo comprarías?</span>
          <select name="compra" required><option value="">Elige una opción</option><option>Con fondos propios</option><option>Con financiación</option><option>Aún no lo sé</option></select>
        </label>
      </fieldset>
      <fieldset class="full form-grid" data-modo="busqueda">
        <label class="campo full"><span>¿Qué buscas?</span><textarea name="busca" required placeholder="Tipo de inmueble, tamaño, uso…"></textarea></label>
        <label class="campo full"><span>Zona</span><input type="text" name="zona"></label>
      </fieldset>
      <label class="campo full"><span>Mensaje <small>(opcional)</small></span><textarea name="mensaje" style="min-height:5rem"></textarea></label>
      <fieldset class="full" data-modo="dossier" data-nda>
        <label class="check"><input type="checkbox" name="acepta_nda" value="sí" required> <span>Entiendo que el dossier se envía después de firmar un acuerdo de confidencialidad.</span></label>
      </fieldset>
      <label class="check full"><input type="checkbox" name="acepta_privacidad" value="sí" required> <span>Acepto que uséis estos datos para responder a mi solicitud. <a class="link" href="/aviso-legal/">Privacidad</a></span></label>
      <div class="hp" aria-hidden="true"><label>Web <input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
      <div class="full"><button class="btn" type="submit" id="dlg-enviar">Pedir dossier</button><p class="estado-envio" role="status" aria-live="polite"></p></div>
    </div>
  </form>
</dialog>'''


def comparativa() -> str:
    """Tabla común a las guías de hipoteca inversa y nuda propiedad. En móvil se apila (ver estilos.css)."""
    columnas = ["Hipoteca inversa", "Nuda propiedad", "Vender y mudarte a una más pequeña"]
    filas = [
        ("¿Sigues en tu casa?", "Sí, mientras vivas", "Sí, mientras vivas", "No"),
        ("¿Sigues siendo el dueño?", "Sí", "No, pero conservas el derecho a vivir en ella", "De esta no; de la nueva, si la compras"),
        ("¿Cuánto recibes?", "Una parte del valor, cada mes o de una vez", "Bastante menos que el valor de mercado", "El valor de mercado, menos gastos y lo que cueste la nueva"),
        ("¿Hay deuda?", "Sí, y crece cada año", "No", "No"),
        ("¿Qué queda para tus herederos?", "La casa con su deuda: pagan o venden", "Lo que quede del dinero; la casa, no", "La casa nueva y el dinero que quede"),
        ("¿Paga IRPF?", "Lo que cobras, no, porque es un préstamo", "No, con 65 años o más y si es tu vivienda habitual", "No, con 65 años o más y si es tu vivienda habitual"),
        ("¿Se puede deshacer?", "Sí, pagando lo que debas", "No, salvo acuerdo con el comprador", "No"),
    ]
    cab = "".join(f'<th scope="col">{e(c)}</th>' for c in columnas)
    cuerpo = ""
    for fila in filas:
        celdas = "".join(f'<td data-etiqueta="{e(columnas[i])}">{e(t)}</td>' for i, t in enumerate(fila[1:]))
        cuerpo += f'<tr><th scope="row">{e(fila[0])}</th>{celdas}</tr>\n'
    return (f'<table class="comparativa"><thead><tr><td></td>{cab}</tr></thead>\n<tbody>\n{cuerpo}</tbody></table>')


def rellenar_huecos(cuerpo: str, ruta: str = "") -> str:
    def sustituir(m):
        nombre, arg = m.group(1), m.group(2)
        if nombre == "hipoteca_nav":
            return hipoteca_nav(ruta)
        if nombre == "datos_titular":
            return datos_titular()
        if nombre == "boton_cookies":
            return ('<button type="button" class="link enlace-boton" data-cookies>Cambiar mis preferencias de cookies</button>'
                    if analitica_activa() else "")
        if nombre == "comparativa":
            return comparativa()
        if nombre == "situaciones":
            return situaciones_lista()
        if nombre == "situaciones_mini":
            return situaciones_mini()
        if nombre == "form_familia":
            return form_familia(arg or "")
        if nombre == "form_propietario":
            return form_propietario()
        if nombre == "dialogo_offmarket":
            return dialogo_offmarket()
        if nombre == "cfg":
            return cfg(arg)
        if nombre == "revision":
            return e(SITIO["revision"])
        raise SystemExit(f"Hueco desconocido: {m.group(0)}")
    return re.sub(r"\{\{(\w+)(?::([\w.\-]+))?\}\}", sustituir, cuerpo)


# =============================================================================
# Datos estructurados
# =============================================================================
def organizacion() -> dict:
    org = {
        "@type": "RealEstateAgent",
        "@id": url_absoluta("/#organizacion"),
        "name": SITIO["nombre"],
        "url": url_absoluta("/"),
        "logo": url_absoluta("/og-euporia.png"),
        "image": url_absoluta("/og-euporia.png"),
        "description": ("Acompañamiento inmobiliario a familias (problemas con la hipoteca, herencias, "
                        "separaciones, cambios de vivienda, hipoteca inversa y nuda propiedad) "
                        "y venta discreta de propiedades off-market en Valencia."),
        "email": SITIO["email"],
        "telephone": SITIO["telefono"],
        "address": {"@type": "PostalAddress", "addressLocality": "València",
                    "addressRegion": "Comunitat Valenciana", "addressCountry": "ES"},
        "areaServed": [{"@type": "City", "name": "València"},
                       {"@type": "AdministrativeArea", "name": "Provincia de Valencia"}],
        "founder": {"@id": url_absoluta("/quienes-somos/#ramon")},
        "knowsLanguage": ["es", "ca"],
    }
    if SITIO["titular_legal"]:
        org["legalName"] = SITIO["titular_legal"]
    if SITIO["nif"]:
        org["taxID"] = SITIO["nif"]
    return org


def persona() -> dict:
    nodo = {"@type": "Person", "@id": url_absoluta("/quienes-somos/#ramon"), "name": SITIO["responsable"],
            "jobTitle": "Consultor inmobiliario", "url": url_absoluta("/quienes-somos/"),
            "worksFor": {"@id": url_absoluta("/#organizacion")},
            "knowsAbout": ["Hipotecas", "Ejecución hipotecaria", "Compraventa de vivienda", "Herencias de vivienda",
                           "Hipoteca inversa", "Nuda propiedad", "Mercado inmobiliario de Valencia"]}
    if SITIO["perfiles"]:
        nodo["sameAs"] = SITIO["perfiles"]
    return nodo


def schema(p: dict, paginas_por_ruta: dict, faqs: list) -> str:
    url = url_absoluta(p["ruta"])
    grafo = [
        organizacion(),
        {"@type": "WebSite", "@id": url_absoluta("/#web"), "url": url_absoluta("/"),
         "name": SITIO["nombre"], "inLanguage": "es-ES", "publisher": {"@id": url_absoluta("/#organizacion")}},
        persona(),
    ]
    pagina = {"@type": "WebPage", "@id": url + "#pagina", "url": url, "name": p["titulo"],
              "description": p["descripcion"], "inLanguage": "es-ES",
              "isPartOf": {"@id": url_absoluta("/#web")}, "about": {"@id": url_absoluta("/#organizacion")}}
    migas = cadena_migas(p, paginas_por_ruta)
    if len(migas) > 1:
        pagina["breadcrumb"] = {"@id": url + "#migas"}
        grafo.append({"@type": "BreadcrumbList", "@id": url + "#migas", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": nombre, "item": url_absoluta(ruta)}
            for i, (nombre, ruta) in enumerate(migas)]})
    pagina["dateModified"] = actualizado(p)
    grafo.append(pagina)
    if p.get("articulo") == "si":
        grafo.append({"@type": "Article", "@id": url + "#articulo", "headline": p["titulo"][:110],
                      "description": p["descripcion"], "inLanguage": "es-ES", "url": url,
                      "mainEntityOfPage": {"@id": url + "#pagina"},
                      "datePublished": p.get("publicado") or SITIO["publicacion"], "dateModified": actualizado(p),
                      "author": {"@id": url_absoluta("/quienes-somos/#ramon")},
                      "publisher": {"@id": url_absoluta("/#organizacion")},
                      "image": url_absoluta("/og-euporia.png")})
    if p.get("servicio"):
        grafo.append({"@type": "Service", "@id": url + "#servicio", "name": p["servicio"],
                      "serviceType": p["servicio"], "url": url,
                      "provider": {"@id": url_absoluta("/#organizacion")},
                      "areaServed": {"@type": "AdministrativeArea", "name": "Provincia de Valencia"}})
    if p.get("aplicacion") == "si":
        grafo.append({"@type": "WebApplication", "@id": url + "#aplicacion", "name": p["titulo"], "url": url,
                      "description": p["descripcion"], "applicationCategory": "LifestyleApplication",
                      "operatingSystem": "Web", "inLanguage": "es-ES",
                      "provider": {"@id": url_absoluta("/#organizacion")}})
    if faqs:
        grafo.append({"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})
    datos = json.dumps({"@context": "https://schema.org", "@graph": grafo}, ensure_ascii=False, indent=1)
    return f'<script type="application/ld+json">\n{datos}\n</script>'


def extraer_faqs(cuerpo: str) -> list:
    bloque = re.search(r'<div class="faq">(.*?)</div>\s*<!-- /faq -->', cuerpo, re.S)
    if not bloque:
        return []
    pares = re.findall(r"<summary>(.*?)</summary>\s*<div class=\"inner\">(.*?)</div>", bloque.group(1), re.S)
    return [(texto_plano(q), texto_plano(a)) for q, a in pares]


def cadena_migas(p: dict, paginas_por_ruta: dict) -> list:
    cadena = []
    actual = p
    while actual:
        cadena.append((actual.get("miga") or actual["titulo"], actual["ruta"]))
        padre = actual.get("padre")
        actual = paginas_por_ruta.get(padre) if padre else None
    if p["ruta"] != "/" and (not cadena or cadena[-1][1] != "/"):
        cadena.append(("Inicio", "/"))
    return list(reversed(cadena))


# =============================================================================
# Plantilla
# =============================================================================
def cabecera(p: dict) -> str:
    items = []
    for clave, texto, ruta in NAV:
        if p["ruta"] == ruta:
            items.append(f'<li><a href="{ruta}" aria-current="page">{e(texto)}</a></li>')
        elif p.get("nav") == clave:
            items.append(f'<li><a href="{ruta}" class="nav-actual">{e(texto)}</a></li>')
        else:
            items.append(f'<li><a href="{ruta}">{e(texto)}</a></li>')
    proto = ('<div class="proto" role="note"><div class="wrap">Prototipo en pruebas. Las propiedades son '
             'ejemplos y los formularios todavía no guardan datos.</div></div>\n') if SITIO["prototipo"] else ""
    return f'''<a class="skip" href="#contenido">Ir al contenido</a>
{proto}<header class="site">
  <div class="wrap">
    <a class="brand" href="/">{e(SITIO["nombre"])}</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu">Menú</button>
    <nav aria-label="Principal"><ul id="menu">
      {"".join(items)}
    </ul></nav>
  </div>
</header>'''


def migas_html(p: dict, paginas_por_ruta: dict) -> str:
    migas = cadena_migas(p, paginas_por_ruta)
    if len(migas) < 2:
        return ""
    partes = []
    for nombre, ruta in migas[:-1]:
        partes.append(f'<li><a href="{ruta}">{e(nombre)}</a></li>')
    partes.append(f'<li aria-current="page">{e(migas[-1][0])}</li>')
    return f'<nav class="migas wrap" aria-label="Estás en"><ol>{"".join(partes)}</ol></nav>'


def pie(p: dict) -> str:
    bienestar = ('<p class="bienestar">Si sientes que no puedes más, llama al 024 (gratuito, 24 horas). '
                 'En una emergencia, 112.</p>') if p.get("bienestar") == "si" else ""
    anio = datetime.date.today().year
    return f'''<footer class="site">
  <div class="wrap">
    <div>
      <a class="brand" href="/">{e(SITIO["nombre"])}</a>
      <p>Orientación y acompañamiento inmobiliario en València. No es asesoramiento jurídico, fiscal ni financiero: ante una ejecución, una herencia o temas fiscales hace falta un abogado o asesor, y te acompañamos a especialistas.</p>
      {bienestar}
      <p>© {anio} {e(SITIO["nombre"])}. <a href="https://wa.me/{SITIO["whatsapp"]}">WhatsApp</a>. <a href="mailto:{e(SITIO["email"])}">{e(SITIO["email"])}</a></p>
    </div>
    <ul>
      <li><a href="/familias/">Familias</a></li>
      <li><a href="/familias/hipoteca/">No puedo pagar la hipoteca</a></li>
      <li><a href="/familias/hipoteca/diagnostico/">Diagnóstico de hipoteca</a></li>
      <li><a href="/off-market/">Off-market</a></li>
      <li><a href="/vender-sin-publicar/">Vender sin publicar</a></li>
      <li><a href="/valorar-visita/">Valorar una visita</a></li>
      <li><a href="/familias/hipoteca-inversa/#calculadora">Calculadora de hipoteca inversa</a></li>
      <li><a href="/familias/nuda-propiedad/#calculadora">Calculadora de nuda propiedad</a></li>
      <li><a href="/quienes-somos/">Quiénes somos</a></li>
      <li><a href="/aviso-legal/">Aviso legal y privacidad</a></li>
      {'<li><button type="button" class="enlace-boton" data-cookies>Cookies</button></li>' if analitica_activa() else ''}
    </ul>
  </div>
</footer>'''


def renderizar(p: dict, paginas_por_ruta: dict) -> str:
    es_inicio = p["ruta"] == "/"
    es_404 = p["ruta"] == "/404.html"
    titulo = p["titulo"] if es_inicio else f'{p["titulo"]} · {SITIO["nombre"]}'
    url = url_absoluta(p["ruta"])
    robots = "noindex, nofollow" if (SITIO["prototipo"] or es_404) else "index, follow"
    tono = "tone-dark" if p.get("tono") == "oscuro" else "tone-light"
    color = "#141210" if tono == "tone-dark" else "#f6f5f2"
    cuerpo = rellenar_huecos(p["cuerpo"], p["ruta"])
    faqs = extraer_faqs(cuerpo)
    if p.get("articulo") == "si":
        firma = (f'<p class="firma">Por <a href="/quienes-somos/#ramon">{e(SITIO["responsable"])}</a>, consultor inmobiliario '
                 f'en València · Actualizado el {fecha_larga(actualizado(p))}</p>')
        cuerpo = re.sub(r"(<article class=\"guia\">)", lambda m: m.group(1) + "\n    " + firma, cuerpo, count=1)
    script_extra = (f'<script src="/assets/{p["js"]}.js?v={version(p["js"] + ".js")}" defer></script>\n'
                    if p.get("js") else "")
    css_extra = (f'<link rel="stylesheet" href="/assets/{p["css"]}.css?v={version(p["css"] + ".css")}">\n'
                 if p.get("css") else "")
    medicion = (f'<script src="/assets/medicion.js?v={version("medicion.js")}" defer></script>\n'
                if analitica_activa() else "")
    tipo_og = "article" if p.get("articulo") == "si" else "website"
    config_js = json.dumps({"endpoint": SITIO["endpoint"], "fichasUrl": SITIO["fichas_url"],
                            "terminosVetados": SITIO["terminos_vetados"],
                            "whatsapp": SITIO["whatsapp"], "prototipo": SITIO["prototipo"],
                            "ga4": SITIO["ga4"], "clarity": SITIO["clarity"], "herramienta": p.get("js", "")},
                           ensure_ascii=False)
    canonical = "" if es_404 else f'<link rel="canonical" href="{e(url)}">\n'
    datos = "" if es_404 else schema(p, paginas_por_ruta, faqs) + "\n"

    pagina = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)}</title>
<meta name="description" content="{e(p["descripcion"])}">
<meta name="robots" content="{robots}">
{canonical}<meta name="theme-color" content="{color}">
<meta name="author" content="{e(SITIO["responsable"])}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="{tipo_og}">
<meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="{e(SITIO["nombre"])}">
<meta property="og:title" content="{e(p["titulo"])}">
<meta property="og:description" content="{e(p["descripcion"])}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(url_absoluta("/og-euporia.png"))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Euporia: acompañamiento a familias y propiedades off-market en Valencia">
<meta name="twitter:card" content="summary_large_image">
{FUENTES}
<link rel="stylesheet" href="/assets/estilos.css?v={version("estilos.css")}">
{css_extra}{datos}<script>window.EUPORIA = {config_js};</script>
<script src="/assets/app.js?v={version("app.js")}" defer></script>
{medicion}{script_extra}</head>
<body class="{tono}">
{cabecera(p)}
<main id="contenido">
{migas_html(p, paginas_por_ruta)}
{cuerpo.strip()}
</main>
{pie(p)}
</body>
</html>
'''
    if SITIO["base"]:
        pagina = re.sub(r'(href|src)="/(?!/)', rf'\1="{SITIO["base"]}/', pagina)
    return pagina


# =============================================================================
# Generación
# =============================================================================
def destino(ruta: str) -> Path:
    if ruta.endswith(".html"):
        return SALIDA / ruta.lstrip("/")
    return SALIDA / ruta.strip("/") / "index.html" if ruta != "/" else SALIDA / "index.html"


def main() -> None:
    paginas = [leer_pagina(f) for f in sorted(CONTENIDO.glob("*.html"))]
    por_ruta = {p["ruta"]: p for p in paginas}
    if len(por_ruta) != len(paginas):
        raise SystemExit("Hay dos páginas con la misma ruta")

    if SALIDA.exists():
        shutil.rmtree(SALIDA)
    (SALIDA / "assets").mkdir(parents=True)
    for recurso in sorted(ESTATICOS.glob("*.css")) + sorted(ESTATICOS.glob("*.js")):
        shutil.copy(recurso, SALIDA / "assets" / recurso.name)
    shutil.copytree(ESTATICOS / "fuentes", SALIDA / "assets" / "fuentes")
    shutil.copy(ESTATICOS / "favicon.svg", SALIDA / "favicon.svg")
    shutil.copy(ESTATICOS / "og-euporia.png", SALIDA / "og-euporia.png")
    (SALIDA / ".nojekyll").write_text("")

    for p in paginas:
        archivo = destino(p["ruta"])
        archivo.parent.mkdir(parents=True, exist_ok=True)
        archivo.write_text(renderizar(p, por_ruta), encoding="utf-8")

    urls = "\n".join(f"  <url><loc>{e(url_absoluta(p['ruta']))}</loc><lastmod>{actualizado(p)}</lastmod></url>"
                     for p in paginas if p["ruta"] != "/404.html")
    (SALIDA / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n',
        encoding="utf-8")

    if SITIO["prototipo"]:
        robots = "# Prototipo: no indexar\nUser-agent: *\nDisallow: /\n"
    else:
        robots = f"User-agent: *\nAllow: /\n\nSitemap: {url_absoluta('/sitemap.xml')}\n"
    (SALIDA / "robots.txt").write_text(robots, encoding="utf-8")

    dominio = SITIO["dominio"].replace("https://", "").replace("http://", "")
    if EN_CLOUDFLARE:
        (SALIDA / "_headers").write_text(CABECERAS_CLOUDFLARE, encoding="utf-8")
        (SALIDA / "_redirects").write_text(REDIRECCIONES, encoding="utf-8")
    elif "[" not in dominio and not SITIO["base"]:
        (SALIDA / "CNAME").write_text(dominio + "\n")

    print(f"{len(paginas)} páginas generadas en {SALIDA.name}/ ({SITIO['dominio'] + SITIO['base']})")
    if "[DOMINIO]" in SITIO["dominio"]:
        print("Aviso: el dominio sigue sin definir ([DOMINIO]) en SITIO['dominio'].")
    if SITIO["prototipo"]:
        print("Aviso: modo prototipo (noindex). La versión indexable se genera en Cloudflare.")
    else:
        comprobar_publicacion()


def comprobar_publicacion() -> None:
    """Si queda un marcador en una página pública, la compilación falla y sigue activa la versión anterior."""
    marcadores = re.compile(r'\[(?:CONFIRMAR|PENDIENTE|VERIFICAR|DECIDIR|ELEGIR|OPCIONAL)|class="(?:pendiente|marca)"|data-config=|data-calc=')
    errores = []
    for html_ in SALIDA.rglob("*.html"):
        for m in marcadores.finditer(html_.read_text(encoding="utf-8")):
            errores.append(f"{html_.relative_to(SALIDA)}: {m.group(0)}")
    if errores:
        raise SystemExit("No se publica: hay textos pendientes en páginas públicas:\n" + "\n".join(errores))
    faltan = [c for c in ("nif", "domicilio") if not SITIO[c]]
    if faltan:
        print(f"Aviso legal incompleto: falta {', '.join(faltan)} (LSSI, art. 10).")
    if not SITIO["endpoint"]:
        print("Aviso: formularios sin conectar (SITIO['endpoint'] vacío): no se guarda ningún contacto.")
    if not analitica_activa():
        print("Aviso: sin Google Analytics ni Clarity (SITIO['ga4'], SITIO['clarity']).")


if __name__ == "__main__":
    main()
