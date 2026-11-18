"""
Euporia · Valor tasado de la vivienda por municipio (datos públicos).

Genera estaticos/precios-vivienda.js a partir de la tabla 4 del Ministerio de
Vivienda y Agenda Urbana: «Valor tasado medio de vivienda libre de los
municipios mayores de 25.000 habitantes» (euros por m², trimestral).

Uso (una vez por trimestre, cuando el Ministerio publique la nueva hoja):
    pip install xlrd
    python datos/precios_vivienda.py
    python build.py        # para comprobar en local

No contiene datos personales: son medias oficiales por municipio.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

import xlrd

URL = "https://apps.fomento.gob.es/BoletinOnline2/sedal/35103500.XLS"
SALIDA = Path(__file__).resolve().parent.parent / "estaticos" / "precios-vivienda.js"
TRIMESTRES = {"1": "primer", "2": "segundo", "3": "tercer", "4": "cuarto"}

# Nombres en castellano y sin abreviaturas del Excel
PROVINCIAS = {"ASTURIAS": "Asturias", "ILLES BALEARS": "Illes Balears", "Araba/Alava": "Álava",
              "Valladodid": "Valladolid", "Cantabría": "Cantabria", "La Coruña": "A Coruña",
              "Castellón/Castelló": "Castellón", "Santa Cruz de": "Santa Cruz de Tenerife",
              "Tenerife": "Santa Cruz de Tenerife"}
MUNICIPIOS = {"Santa Cruz deTenerife": "Santa Cruz de Tenerife",
              "San Cristóbal Laguna": "San Cristóbal de La Laguna",
              "Arcos de la frontera": "Arcos de la Frontera", "Nijar": "Níjar",
              "Eivissa": "Ibiza", "Jávea/Xábia": "Jávea", "Vall d'Uixó (la)": "La Vall d'Uixó",
              "Villajoyosa/Vila Joiosa (La)": "Villajoyosa"}


def municipio(nombre):
    nombre = re.sub(r"\s+", " ", nombre).strip()
    if nombre in MUNICIPIOS:
        return MUNICIPIOS[nombre]
    nombre = nombre.split("/")[0].strip()          # Alicante/Alacant → Alicante
    m = re.match(r"^(.*) \((El|La|Los|Las|L'|A)\)$", nombre)   # Ejido (El) → El Ejido
    if m:
        art = m.group(2)
        return (art + m.group(1)) if art == "L'" else f"{art} {m.group(1)}"
    return nombre


def numero(v):
    return round(v) if isinstance(v, float) else None


def leer(hoja):
    filas, provincia = {}, ""
    for r in range(17, hoja.nrows):
        v = hoja.row_values(r)
        if str(v[1]).strip():
            bruto = str(v[1]).strip()
            # «Santa Cruz de» / «Tenerife» ocupan dos filas en el Excel
            provincia = PROVINCIAS.get(bruto, bruto)
        nombre = str(v[2]).strip()
        if not nombre:
            continue
        filas[(provincia, municipio(nombre))] = {
            "nueva": numero(v[3]), "usada": numero(v[4]), "total": numero(v[5]),
            "tasaciones": int(v[9]) if isinstance(v[9], float) else 0}
    return filas


def main():
    destino = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if destino is None:
        destino = Path(__file__).resolve().parent / "valor-tasado.xls"
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        destino.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    libro = xlrd.open_workbook(str(destino))
    nombres = [h.name.strip() for h in libro.sheets()]
    ultima = nombres[-1]                                   # p. ej. T2A2026
    m = re.match(r"T(\d)A(\d{4})", ultima)
    trim, anio = m.group(1), int(m.group(2))
    anterior = f"T{trim}A{anio - 1}"
    actual = leer(libro.sheet_by_index(-1))
    previo = leer(libro.sheet_by_index(nombres.index(anterior))) if anterior in nombres else {}

    municipios = []
    for (prov, mun), d in sorted(actual.items(), key=lambda x: (x[0][0], x[0][1])):
        if d["total"] is None:
            continue
        p = previo.get((prov, mun))
        variacion = round((d["total"] / p["total"] - 1) * 100, 1) if p and p["total"] else None
        municipios.append([prov, mun, d["nueva"], d["usada"], d["total"], d["tasaciones"], variacion])

    datos = {"fuente": "Ministerio de Vivienda y Agenda Urbana, estadística de valor tasado de vivienda libre",
             "url": URL, "periodo": f"{TRIMESTRES[trim]} trimestre de {anio}",
             "columnas": ["provincia", "municipio", "hasta 5 años", "más de 5 años", "total",
                          "tasaciones", "variación anual %"],
             "municipios": municipios}
    SALIDA.write_text("/* Generado por datos/precios_vivienda.py. No lo edites a mano. */\n"
                      "window.EUPORIA_PRECIOS = " + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n",
                      encoding="utf-8")
    print(f"{len(municipios)} municipios · {datos['periodo']} → {SALIDA}")


if __name__ == "__main__":
    main()
