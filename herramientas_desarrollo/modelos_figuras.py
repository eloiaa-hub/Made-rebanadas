"""Modelos 3D de ejemplo para las figuras apiladas (planos seriados): conejo sentado y cabeza de moái.
Uso:  python3 modelos_figuras.py   (necesita numpy y scikit-image)
Genera conejo.stl y moai.stl en assets/modelos y los añade (o los cambia) en assets/modelos/modelos.js,
sin tocar los demás modelos. Ejes: Y hacia arriba, Z hacia el que mira, en mm. Sin restricciones de uso."""
import numpy as np, struct, base64, json, os
from skimage.measure import marching_cubes

AQUI = os.path.dirname(os.path.abspath(__file__)); DEST = os.path.join(AQUI, '..', 'assets', 'modelos')

def elip(p, c, r):
    q = [(p[i] - c[i]) / r[i] for i in range(3)]
    return (np.sqrt(q[0]**2 + q[1]**2 + q[2]**2) - 1) * min(r)
def caja(p, c, h, r):   # caja con las aristas redondeadas (medio lado h, radio r)
    q = [np.abs(p[i] - c[i]) - (h[i] - r) for i in range(3)]
    fuera = np.sqrt(sum(np.maximum(qi, 0)**2 for qi in q))
    return fuera + np.minimum(np.maximum(q[0], np.maximum(q[1], q[2])), 0) - r
def suma(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)
def resta(a, b, k):
    h = np.clip(0.5 - 0.5 * (a + b) / k, 0, 1); return a * (1 - h) + (-b) * h + k * h * (1 - h)

def malla_sdf(f, lo, hi, paso):
    xs = [np.arange(lo[i], hi[i] + paso, paso) for i in range(3)]
    X, Y, Z = np.meshgrid(*xs, indexing='ij')
    v, caras, _, _ = marching_cubes(f((X, Y, Z)), 0, spacing=(paso,) * 3)
    return v + np.array(lo), caras[:, ::-1]

def conejo(p):
    x, y, z = p
    d = elip(p, (0, 55, -8), (46, 56, 50))                       # cuerpo
    for s in (-1, 1):
        d = suma(d, elip(p, (s * 31, 34, -14), (22, 32, 40)), 10)  # muslos
        d = suma(d, elip(p, (s * 25, 9, 18), (13, 9, 24)), 6)      # patas de atrás
        d = suma(d, elip(p, (s * 12, 16, 33), (9, 16, 10)), 6)     # patas de delante
    d = suma(d, elip(p, (0, 88, 14), (30, 36, 30)), 14)            # pecho
    cabeza = elip(p, (0, 133, 18), (26, 25, 29))
    cabeza = suma(cabeza, elip(p, (0, 126, 41), (15, 13, 12)), 8)   # hocico
    for s in (-1, 1): cabeza = resta(cabeza, elip(p, (s * 15, 138, 38), (4, 4, 3)), 1.5)   # ojos
    d = suma(d, cabeza, 12)
    for s in (-1, 1):                                              # orejas: altas y separadas
        o = elip(p, (s * 13, 186, 4), (10, 42, 6.5))
        o = resta(o, elip(p, (s * 13, 188, 9), (5.5, 34, 3)), 2)
        d = suma(d, o, 7)
    d = suma(d, elip(p, (0, 34, -58), (13, 13, 12)), 6)            # cola
    return np.maximum(d, -y)                                       # apoyado en el suelo

def moai(p):
    x, y, z = p
    d = caja(p, (0, 16, -8), (58, 18, 38), 14)                     # hombros y pecho (pequeños, como en Rapa Nui)
    d = suma(d, caja(p, (0, 56, -8), (38, 26, 32), 12), 16)        # cuello
    d = suma(d, caja(p, (0, 140, -8), (42, 70, 36), 18), 12)       # cabeza alargada
    d = np.maximum(d, (y - 206) + 0.45 * (z + 10))                 # coronilla que cae hacia atrás
    d = suma(d, elip(p, (0, 190, 27), (44, 11, 15)), 7)            # ceja
    for s in (-1, 1):
        d = resta(d, elip(p, (s * 20, 176, 35), (14, 8, 10)), 4)   # cuencas
        d = suma(d, elip(p, (s * 44, 142, -10), (7, 44, 14)), 5)   # orejas largas
        d = suma(d, elip(p, (s * 20, 128, 30), (14, 16, 8)), 8)    # pómulos
    nariz = elip(p, (0, 158, 40), (11, 30, 17))
    nariz = suma(nariz, elip(p, (0, 130, 50), (17, 11, 12)), 7)
    d = suma(d, nariz, 6)
    d = suma(d, elip(p, (0, 106, 38), (24, 8, 10)), 4)             # labio de arriba (morro)
    d = suma(d, elip(p, (0, 94, 37), (20, 6, 9)), 4)
    d = suma(d, caja(p, (0, 79, 22), (30, 12, 14), 8), 8)          # barbilla cuadrada
    return np.maximum(d, -y)

def guardar(nombre, V, F, titulo, desc):
    F = F.astype(np.int64)
    tri = V[F]; n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= (np.linalg.norm(n, axis=1)[:, None] + 1e-12)
    with open(os.path.join(DEST, nombre + '.stl'), 'wb') as f:
        f.write(('Made-rebanadas - ' + titulo).encode('ascii', 'replace')[:80].ljust(80, b' ')); f.write(struct.pack('<I', len(F)))
        for k in range(len(F)): f.write(struct.pack('<12fH', *n[k], *tri[k, 0], *tri[k, 1], *tri[k, 2], 0))
    q = np.round(V * 10).astype('<i2'); ix = F.astype('<u4')
    return {'id': nombre, 'nombre': titulo, 'desc': desc, 'vista': 'frente', 'giro': 0, 'archivo': nombre + '.stl', 'triangulos': int(len(F)),
            'ancho': None, 'alto': None, 'figura': True,
            'v': base64.b64encode(q.tobytes()).decode(), 'f': base64.b64encode(ix.tobytes()).decode()}

nuevos = []
V, F = malla_sdf(conejo, (-64, -2, -76), (64, 236, 62), 2.0)
nuevos.append(guardar('conejo', V, F, 'Conejo sentado', 'Un conejo sentado con las orejas tiesas: para una figura apilada pequeña (láser).'))
V, F = malla_sdf(moai, (-90, -2, -60), (90, 226, 62), 2.4)
nuevos.append(guardar('moai', V, F, 'Cabeza de moái', 'Cabeza y hombros de moái, de formas grandes: para una figura apilada en porex.'))

ruta = os.path.join(DEST, 'modelos.js'); txt = open(ruta, encoding='utf-8').read()
cab, datos = txt.split('window.MADE_MODELOS = ', 1)
M = [m for m in json.loads(datos.rstrip().rstrip(';')) if m['id'] not in [n['id'] for n in nuevos]] + nuevos
with open(ruta, 'w', encoding='utf-8') as f: f.write(cab + 'window.MADE_MODELOS = ' + json.dumps(M, ensure_ascii=False) + ';\n')
for m in nuevos: print(m['id'], m['triangulos'], os.path.getsize(os.path.join(DEST, m['archivo'])))
print('modelos.js', os.path.getsize(ruta))
