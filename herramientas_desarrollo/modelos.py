"""Genera los modelos 3D de ejemplo (STL) y assets/modelos/modelos.js.
Uso:  python3 modelos.py   (necesita numpy y scikit-image)
Ejes: Y hacia arriba, Z hacia el que mira (vista «de frente»), en mm."""
import numpy as np, struct, base64, json, os
from skimage.measure import marching_cubes

AQUI = os.path.dirname(os.path.abspath(__file__)); DEST = os.path.join(AQUI, '..', 'assets', 'modelos')

def elip(p, c, r):
    q = [(p[i] - c[i]) / r[i] for i in range(3)]
    k = np.sqrt(q[0]**2 + q[1]**2 + q[2]**2)
    return (k - 1) * min(r)
def suma(a, b, k):   # unión suave
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)
def resta(a, b, k):  # a menos b, suave
    h = np.clip(0.5 - 0.5 * (a + b) / k, 0, 1); return a * (1 - h) + (-b) * h + k * h * (1 - h)

def malla_sdf(f, lo, hi, paso):
    xs = [np.arange(lo[i], hi[i] + paso, paso) for i in range(3)]
    X, Y, Z = np.meshgrid(*xs, indexing='ij')
    v, caras, _, _ = marching_cubes(f((X, Y, Z)), 0, spacing=(paso,) * 3)
    v += np.array(lo)
    return v, caras[:, ::-1]   # hacia fuera

def cara(p):
    x, y, z = p
    d = elip(p, (0, 8, -4), (52, 78, 60))                                   # cráneo
    d = suma(d, elip(p, (0, -40, 10), (40, 42, 50)), 14)                  # mandíbula
    d = suma(d, elip(p, (0, 27, 50), (40, 8, 12)), 7)                     # cejas
    for s in (-1, 1):
        d = suma(d, elip(p, (s * 28, -14, 36), (20, 18, 22)), 10)        # pómulos
        d = suma(d, elip(p, (s * 53, 0, -6), (7, 19, 12)), 5)            # orejas
        d = resta(d, elip(p, (s * 21, 14, 54), (14, 9, 13)), 5)          # cuencas
        d = suma(d, elip(p, (s * 21, 12, 47), (11, 7, 10)), 3)           # párpados
        d = resta(d, elip(p, (s * 12, -27, 66), (4, 3, 6)), 2)           # aletas de la nariz
    nariz = elip(p, (0, 2, 58), (7, 24, 12))
    nariz = suma(nariz, elip(p, (0, -20, 70), (12, 9, 11)), 7)
    d = suma(d, nariz, 6)
    d = suma(d, elip(p, (0, -40, 57), (18, 6, 9)), 4)                    # labio de arriba
    d = suma(d, elip(p, (0, -50, 55), (16, 7, 10)), 4)                   # labio de abajo
    d = resta(d, elip(p, (0, -45, 64), (20, 1.6, 10)), 1.5)             # boca
    d = suma(d, elip(p, (0, -66, 44), (15, 10, 10)), 8)                  # barbilla
    cuello = np.maximum(np.sqrt(x**2 + (z + 12)**2) - 30, np.maximum(y + 45, -140 - y))
    d = suma(d, cuello, 12)
    return d

def labios(X, Y):   # mapa de alturas: X de -75 a 75 mm, Y de -40 a 40 mm
    u, v = X / 66, Y / 66
    c = np.clip(1 - u**2, 0, 1)
    arriba = 0.40 * c**0.75 - 0.07 * np.exp(-(u / 0.10)**2) + 0.05 * np.exp(-((np.abs(u) - 0.20) / 0.12)**2)   # arco de Cupido
    medio = 0.035 * c - 0.02 * np.exp(-(u / 0.25)**2)
    abajo = -0.46 * c**0.6
    t1 = np.clip((v - medio) / np.maximum(arriba - medio, 1e-3), 0, 1)
    t2 = np.clip((medio - v) / np.maximum(medio - abajo, 1e-3), 0, 1)
    z1 = np.where((v >= medio) & (v <= arriba), np.sin(np.pi * t1**0.8)**0.55 * (0.75 + 0.25 * c), 0)
    z2 = np.where((v < medio) & (v >= abajo), np.sin(np.pi * t2**1.1)**0.5 * (0.8 + 0.2 * c) * 1.15, 0)
    z = 18 * np.maximum(z1, z2) * c**0.25
    return z + 2

def malla_altura(fz, ancho, alto, paso, grueso=6):
    nx, ny = int(ancho / paso) + 1, int(alto / paso) + 1
    xs, ys = np.linspace(-ancho / 2, ancho / 2, nx), np.linspace(-alto / 2, alto / 2, ny)
    X, Y = np.meshgrid(xs, ys, indexing='ij'); Z = fz(X, Y)
    top = np.stack([X, Y, Z], -1).reshape(-1, 3); bot = np.stack([X, Y, np.full_like(X, -grueso)], -1).reshape(-1, 3)
    V = np.vstack([top, bot]); N = nx * ny; id_ = lambda i, j: i * ny + j; F = []
    for i in range(nx - 1):
        for j in range(ny - 1):
            a, b, c, d = id_(i, j), id_(i + 1, j), id_(i + 1, j + 1), id_(i, j + 1)
            F += [(a, b, c), (a, c, d), (a + N, c + N, b + N), (a + N, d + N, c + N)]
    borde = [id_(i, 0) for i in range(nx)] + [id_(nx - 1, j) for j in range(1, ny)] + [id_(i, ny - 1) for i in range(nx - 2, -1, -1)] + [id_(0, j) for j in range(ny - 2, 0, -1)]
    for k in range(len(borde)):
        a, b = borde[k], borde[(k + 1) % len(borde)]
        F += [(a, a + N, b + N), (a, b + N, b)]
    return V, np.array(F)

def ondas(X, Y):
    r1 = np.hypot(X + 40, Y - 30); r2 = np.hypot(X - 90, Y + 80)
    return 6 + 14 * np.cos(r1 / 11) * np.exp(-r1 / 140) + 8 * np.cos(r2 / 9) * np.exp(-r2 / 90)

def burbuja(X, Y):   # «anomalía»: una burbuja que empuja la superficie y la deforma
    r = np.hypot(X - 20, Y + 10)
    z = 70 * np.exp(-(r / 62)**2.2)
    z += 10 * np.sin(X / 38 + Y / 70) * (1 - np.exp(-(r / 120)**2))
    z -= 14 * np.exp(-((r - 95) / 22)**2)
    return z + 20

def guardar(nombre, V, F, titulo, desc, vista='frente', giro=0, ancho=None, alto=None):
    F = F.astype(np.int64)
    # STL binario
    tri = V[F]; n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= (np.linalg.norm(n, axis=1)[:, None] + 1e-12)
    with open(os.path.join(DEST, nombre + '.stl'), 'wb') as f:
        f.write(('Made-rebanadas - ' + titulo).encode('ascii', 'replace')[:80].ljust(80, b' ')); f.write(struct.pack('<I', len(F)))
        for k in range(len(F)): f.write(struct.pack('<12fH', *n[k], *tri[k, 0], *tri[k, 1], *tri[k, 2], 0))
    # formato compacto para el programa: vértices en décimas de mm (int16) y caras (uint16/uint32)
    q = np.round(V * 10).astype('<i2'); ix = F.astype('<u4')
    return {'id': nombre, 'nombre': titulo, 'desc': desc, 'vista': vista, 'giro': giro, 'archivo': nombre + '.stl', 'triangulos': int(len(F)),
            'ancho': ancho, 'alto': alto,
            'v': base64.b64encode(q.tobytes()).decode(), 'f': base64.b64encode(ix.tobytes()).decode()}

os.makedirs(DEST, exist_ok=True); M = []
V, F = malla_sdf(cara, (-80, -155, -80), (80, 100, 95), 3.2)
M.append(guardar('cara', V, F, 'Cara', 'Busto con ojos cerrados: de frente, retrato; de lado, perfil.', ancho=600, alto=900))
V, F = malla_altura(labios, 150, 80, 1.6)
M.append(guardar('labios', V, F, 'Labios', 'Unos labios carnosos, para un panel apaisado.', ancho=1200, alto=560))
V, F = malla_altura(ondas, 320, 320, 5.5)
M.append(guardar('ondas', V, F, 'Ondas en el agua', 'Dos gotas que hacen ondas concéntricas que se cruzan.', ancho=900, alto=900))
V, F = malla_altura(burbuja, 320, 320, 5.5)
M.append(guardar('burbuja', V, F, 'Anomalía (burbuja)', 'Una burbuja que empuja la superficie, con un surco alrededor.', ancho=900, alto=900))
with open(os.path.join(DEST, 'modelos.js'), 'w') as f:
    f.write('/* Modelos 3D de ejemplo de Made-rebanadas (generados con herramientas_desarrollo/modelos.py).\n   Los mismos modelos están en esta carpeta como .stl. */\nwindow.MADE_MODELOS = ' + json.dumps(M, ensure_ascii=False) + ';\n')
for m in M: print(m['id'], m['triangulos'], os.path.getsize(os.path.join(DEST, m['archivo'])))
print('modelos.js', os.path.getsize(os.path.join(DEST, 'modelos.js')))
