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
    {{form_propietario}} {{dialogo_offmarket}} {{cfg:clave}} {{revision}}
Las preguntas frecuentes escritas como
    <details><summary>Pregunta</summary><div class="inner"><p>Respuesta</p></div></details>
dentro de <div class="faq"> se convierten solas en Schema FAQPage.
"""
from __future__ import annotations

import datetime
import html
import json
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
    # True: noindex en todas las páginas, robots.txt cerrado y aviso de prototipo
    "prototipo": True,

    "nombre": "Euporia",
    "url_diagnostico": "https://prestigyo.github.io/Diagnostico-hipoteca/",
    "email": "ramon.gimenez@colaborador.huspy.io",
    "whatsapp": "34607818890",
    "telefono": "+34607818890",
    "responsable": "Ramón J. Giménez",
    "relacion": "consultor inmobiliario y colaborador comercial de Huspy España",  # [CONFIRMAR] uso del nombre Huspy

    # [DECIDIR] Vacíos = se muestran marcados como pendientes en la página
    "honorarios": "",
    "titular_legal": "",
    "responsable_tratamiento": "",
    "conservacion": "",

    # Fecha de la última revisión de datos fiscales y legales de las guías
    "revision": "octubre de 2026",

    # Apps Script (euporia-apps-script.gs). Vacíos = prototipo, no se guarda nada
    "endpoint": "",
    "fichas_url": "",   # misma URL + "?accion=fichas"

    # Una ficha off-market con cualquiera de estos términos no se muestra
    "terminos_vetados": ["subasta", "urgente", "urgencia", "embargo", "ejecucion", "deuda", "impago",
                         "desahucio", "lanzamiento", "herencia", "heredero", "divorcio", "separacion",
                         "necesita vender", "chollo", "ganga", "liquidacion", "por debajo de mercado",
                         "bajo mercado", "precio de derribo"],
}

# Situaciones de la puerta de familias. "url" externa (http) o ruta interna.
SITUACIONES = [
    {"id": "hipoteca", "titulo": "Me cuesta pagar la hipoteca", "principal": True,
     "url": SITIO["url_diagnostico"], "accion": "Hacer el diagnóstico", "nota": "Diagnóstico en 3 minutos",
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
    {"id": "otra", "titulo": "Otra situación", "url": None, "accion": "Contarnos tu caso",
     "texto": "Si tu caso no encaja aquí pero tiene que ver con tu casa, cuéntanoslo y te decimos con franqueza si podemos ayudar."},
]

NAV = [
    ("familias", "Familias", "/familias/"),
    ("off-market", "Off-market", "/off-market/"),
    ("vender", "Vender sin publicar", "/vender-sin-publicar/"),
    ("quienes", "Quiénes somos", "/quienes-somos/"),
]

FUENTES = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
           '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
           '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500'
           '&amp;family=Jost:wght@400;500&amp;display=swap" rel="stylesheet">')

e = html.escape


# =============================================================================
# Utilidades
# =============================================================================
def url_absoluta(ruta: str) -> str:
    return SITIO["dominio"] + SITIO["base"] + ruta


def cfg(clave: str) -> str:
    valor = SITIO.get(clave, "")
    if valor:
        return e(str(valor))
    return '<span class="pendiente">[Pendiente de definir antes de publicar]</span>'


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
        if s["url"] and s["url"].startswith("http"):
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


def rellenar_huecos(cuerpo: str) -> str:
    def sustituir(m):
        nombre, arg = m.group(1), m.group(2)
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
                        "separaciones, cambios de vivienda) y venta discreta de propiedades off-market en Valencia."),
        "email": SITIO["email"],
        "telephone": SITIO["telefono"],
        "address": {"@type": "PostalAddress", "addressLocality": "València",
                    "addressRegion": "Comunitat Valenciana", "addressCountry": "ES"},
        "areaServed": [{"@type": "City", "name": "València"},
                       {"@type": "AdministrativeArea", "name": "Provincia de Valencia"}],
        "founder": {"@type": "Person", "name": SITIO["responsable"], "jobTitle": "Consultor inmobiliario"},
        "knowsLanguage": ["es", "ca"],
    }
    return org


def schema(p: dict, paginas_por_ruta: dict, faqs: list) -> str:
    url = url_absoluta(p["ruta"])
    grafo = [
        organizacion(),
        {"@type": "WebSite", "@id": url_absoluta("/#web"), "url": url_absoluta("/"),
         "name": SITIO["nombre"], "inLanguage": "es-ES", "publisher": {"@id": url_absoluta("/#organizacion")}},
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
    grafo.append(pagina)
    if p.get("servicio"):
        grafo.append({"@type": "Service", "@id": url + "#servicio", "name": p["servicio"],
                      "serviceType": p["servicio"], "url": url,
                      "provider": {"@id": url_absoluta("/#organizacion")},
                      "areaServed": {"@type": "AdministrativeArea", "name": "Provincia de Valencia"}})
    if p.get("aplicacion") == "si":
        grafo.append({"@type": "WebApplication", "@id": url + "#aplicacion", "name": p["titulo"], "url": url,
                      "description": p["descripcion"], "applicationCategory": "LifestyleApplication",
                      "operatingSystem": "Web", "inLanguage": "es-ES", "isAccessibleForFree": True,
                      "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
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
      <li><a href="/off-market/">Off-market</a></li>
      <li><a href="/vender-sin-publicar/">Vender sin publicar</a></li>
      <li><a href="/valorar-visita/">Valorar una visita</a></li>
      <li><a href="/quienes-somos/">Quiénes somos</a></li>
      <li><a href="/aviso-legal/">Aviso legal y privacidad</a></li>
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
    cuerpo = rellenar_huecos(p["cuerpo"])
    faqs = extraer_faqs(cuerpo)
    script_extra = f'<script src="/assets/{p["js"]}.js" defer></script>\n' if p.get("js") else ""
    config_js = json.dumps({"endpoint": SITIO["endpoint"], "fichasUrl": SITIO["fichas_url"],
                            "terminosVetados": SITIO["terminos_vetados"],
                            "whatsapp": SITIO["whatsapp"]}, ensure_ascii=False)
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
<meta property="og:type" content="website">
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
<link rel="stylesheet" href="/assets/estilos.css">
{datos}<script>window.EUPORIA = {config_js};</script>
<script src="/assets/app.js" defer></script>
{script_extra}</head>
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
    shutil.copy(ESTATICOS / "favicon.svg", SALIDA / "favicon.svg")
    shutil.copy(ESTATICOS / "og-euporia.png", SALIDA / "og-euporia.png")
    (SALIDA / ".nojekyll").write_text("")

    for p in paginas:
        archivo = destino(p["ruta"])
        archivo.parent.mkdir(parents=True, exist_ok=True)
        archivo.write_text(renderizar(p, por_ruta), encoding="utf-8")

    hoy = datetime.date.today().isoformat()
    urls = "\n".join(f"  <url><loc>{e(url_absoluta(p['ruta']))}</loc><lastmod>{hoy}</lastmod></url>"
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
    if "[" not in dominio and not SITIO["base"]:
        (SALIDA / "CNAME").write_text(dominio + "\n")

    print(f"{len(paginas)} páginas generadas en {SALIDA.name}/")
    if "[DOMINIO]" in SITIO["dominio"]:
        print("Aviso: el dominio sigue sin definir ([DOMINIO]) en SITIO['dominio'].")
    if SITIO["prototipo"]:
        print("Aviso: modo prototipo (noindex). Pon SITIO['prototipo'] = False al lanzar.")


if __name__ == "__main__":
    main()
