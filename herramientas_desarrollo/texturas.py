"""Genera texturas procedurales de madera, tileables, y las empaqueta en texturas.js
La veta va siempre en horizontal (eje u). Cada imagen representa TAM_CM x TAM_CM reales."""
import numpy as np, base64, io, json, os, sys
from PIL import Image
from scipy.ndimage import zoom, gaussian_filter

S = 1024
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

def noise(nu, nv, rng):
    g = rng.random((nv, nu))
    return zoom(g, (S / nv, S / nu), order=3, mode='grid-wrap', grid_mode=True)

def fbm(nu, nv, rng, oct=4):
    r = 0; a = .5; t = 0
    for k in range(oct):
        r = r + a * noise(nu * 2**k, nv * 2**k, rng); t += a; a *= .5
    return r / t

def lerp(a, b, t): return a + (b - a) * t
def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def madera(seed, claro, oscuro, anillos=14, warp=1.6, cat=0.0, poros=.35, rayos=0.0,
           contraste=1.0, var_tono=.12, tardia=.55):
    rng = np.random.default_rng(seed)
    v = np.linspace(0, 1, S, endpoint=False)[:, None] * np.ones((1, S))
    # deformación de la veta (periódica)
    w = (noise(1, 2, rng) - .5) * cat * 2.2 + (noise(2, 3, rng) - .5) * warp * .9 + (noise(5, 9, rng) - .5) * .12
    g = v * anillos + w * anillos * .12
    g2 = v * anillos * 3 + w * anillos * .36 + (noise(6, 40, rng) - .5) * .3
    t = g - np.floor(g)
    # madera de verano (tardía) más oscura
    late = sstep(max(tardia, .62) + .18, .95, t) * (1 - sstep(.97, 1.0, t)) * .8 + sstep(tardia, .95, t) * .35
    t2 = g2 - np.floor(g2)
    late = late + sstep(.8, .95, t2) * (1 - sstep(.96, 1, t2)) * .22
    # poros/fibras alargadas a lo largo de u
    fib = noise(8, 380, rng)
    fib2 = noise(16, 700, rng)
    pores = np.clip((fib - .62) * 4, 0, 1) * poros + np.clip((fib2 - .7) * 4, 0, 1) * poros * .6
    tono = (fbm(2, 2, rng) - .5) * var_tono
    m = np.clip(late * .55 * contraste + pores + tono + (fbm(4, 30, rng) - .5) * .25, 0, 1)
    c = lerp(np.array(claro)[None, None], np.array(oscuro)[None, None], m[..., None])
    if rayos > 0:  # radios medulares (roble): motas claras alargadas
        r = noise(40, 160, rng)
        mask = np.clip((r - .78) * 9, 0, 1) * rayos
        c = lerp(c, np.array(claro)[None, None] * 1.08, mask[..., None])
    # brillo sutil de fibra
    c *= (1 + (noise(6, 260, rng) - .5) * .06)[..., None]
    return np.clip(c, 0, 1)

def guarda(nombre, arr):
    im = Image.fromarray((arr * 255).astype(np.uint8))
    im.save(os.path.join(OUT, nombre + '.jpg'), quality=88)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=82)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

def hx(h): return [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]

maderas = {
    'roble':   dict(seed=1, claro=hx('#d2ab78'), oscuro=hx('#8c6236'), anillos=11, warp=1.8, cat=1.4, poros=.45, rayos=.3),
    'nogal':   dict(seed=2, claro=hx('#8a6043'), oscuro=hx('#3e2619'), anillos=9, warp=2.4, cat=2.0, poros=.3, contraste=1.1),
    'haya':    dict(seed=3, claro=hx('#e3bd93'), oscuro=hx('#b88760'), anillos=16, warp=1.0, cat=.6, poros=.2, rayos=.5, contraste=.6),
    'pino':    dict(seed=4, claro=hx('#ecd09a'), oscuro=hx('#b9804a'), anillos=8, warp=1.4, cat=2.4, poros=.08, contraste=1.4, tardia=.68),
    'cerezo':  dict(seed=5, claro=hx('#c98a5c'), oscuro=hx('#7d4327'), anillos=12, warp=1.6, cat=1.0, poros=.18, contraste=.8),
    'fresno':  dict(seed=6, claro=hx('#e8d4b2'), oscuro=hx('#a7865c'), anillos=7, warp=1.6, cat=1.8, poros=.5, contraste=1.2),
    'wengue':  dict(seed=7, claro=hx('#5a4130'), oscuro=hx('#1c120c'), anillos=30, warp=.7, cat=.3, poros=.4, contraste=1.0),
    'teca':    dict(seed=8, claro=hx('#b88350'), oscuro=hx('#6f4a28'), anillos=13, warp=1.4, cat=1.2, poros=.25, contraste=.9),
}
data = {}
for k, p in maderas.items():
    data[k] = guarda(k, madera(**p))
    print(k, len(data[k]) // 1024, 'KB')

# Parquet: tablas de 20 cm x 128 cm (la imagen representa 160 x 160 cm => 8 tablas de alto)
rng = np.random.default_rng(20)
base = madera(seed=21, claro=hx('#c9a274'), oscuro=hx('#86603c'), anillos=10, warp=1.6, cat=1.6, poros=.35, rayos=.4)
par = np.zeros_like(base)
filas = 8; fh = S // filas
for f in range(filas):
    desp = int(rng.integers(0, S))
    fila = np.roll(base, desp + f * 97, axis=1)[f * fh:(f + 1) * fh]
    fila = np.roll(np.vstack([fila, fila]), int(rng.integers(0, fh)), axis=0)[:fh]
    tono = 1 + rng.normal(0, .07)
    fila = fila * tono
    # juntas: tablas de S*0.8 de largo con corte desplazado
    corte = (int(rng.integers(0, S)))
    fila[:, corte:corte + 2] *= .55
    par[f * fh:(f + 1) * fh] = fila
    par[f * fh:f * fh + 2] *= .55
data['parquet'] = guarda('parquet', np.clip(par, 0, 1))

# Pared: yeso pintado
rng = np.random.default_rng(30)
pared = np.ones((S, S, 3)) * hx('#e9e5de')
pared *= (1 + (fbm(16, 16, rng) - .5) * .05 + (noise(200, 200, rng) - .5) * .03)[..., None]
data['pared'] = guarda('pared', np.clip(pared, 0, 1))

# ---------- Almas de tablero (se ven en los cantos sin canto) ----------
def alma_aglomerado():
    rng = np.random.default_rng(40)
    base = np.ones((S, S, 3)) * hx('#c8a879')
    im = Image.fromarray((base * 255).astype(np.uint8)); from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    cols = [hx('#b08d5e'), hx('#d9bf93'), hx('#9c7a4c'), hx('#e2cfa6'), hx('#bf9f6f'), hx('#8a6a40')]
    for _ in range(26000):
        x, y = rng.integers(0, S, 2); L = rng.integers(3, 22); a = rng.normal(0, .5); w = rng.integers(2, 6)
        c = cols[rng.integers(0, len(cols))]
        d.line([(x, y), (x + L * np.cos(a), y + L * np.sin(a))], fill=tuple(int(v * 255) for v in c), width=int(w))
    arr = np.asarray(im).astype(float) / 255
    # tileable: mezcla con copia desplazada
    sh = np.roll(np.roll(arr, S // 2, 0), S // 2, 1)
    t = np.linspace(0, 1, S); w1 = np.clip(np.minimum(t, 1 - t) / .2, 0, 1); m = np.outer(w1, w1)[..., None]
    return np.clip(arr * m + sh * (1 - m), 0, 1)
def alma_mdf():
    rng = np.random.default_rng(41)
    c = np.ones((S, S, 3)) * hx('#a9845c')
    c *= (1 + (noise(60, 60, rng) - .5) * .08 + (noise(300, 300, rng) - .5) * .1)[..., None]
    return np.clip(c, 0, 1)
def alma_contrachapado():
    # 32 chapas de 1,5 mm en 4,8 cm: alternan veta larga (clara) y testa (algo más oscura)
    rng = np.random.default_rng(42)
    v = np.linspace(0, 32, S, endpoint=False)[:, None] * np.ones((1, S))
    capa = np.floor(v).astype(int); f = v - capa
    claro, osc = np.array(hx('#e6cfa4')), np.array(hx('#c9a874'))
    c = np.where((capa % 2 == 0)[..., None], claro, osc)
    c = c * (1 + (noise(40, 30, rng) - .5) * .12)[..., None]
    linea = (f < .07) | (f > .95)
    c[linea] *= .72
    return np.clip(c, 0, 1)
data['alma_aglomerado'] = guarda('alma_aglomerado', alma_aglomerado())
data['alma_mdf'] = guarda('alma_mdf', alma_mdf())
data['alma_contrachapado'] = guarda('alma_contrachapado', alma_contrachapado())

js = '/* Texturas de la biblioteca (generadas). Maderas: 80 x 80 cm; parquet: 160 x 160 cm; almas: aglomerado y MDF 20 x 20 cm, contrachapado 4,8 x 4,8 cm.\n   Se guardan embebidas en JS para que funcionen al abrir el HTML con doble clic (file://). */\n'
js += 'window.TEXTURAS = ' + json.dumps(data) + ';\n'
open(os.path.join(OUT, 'texturas.js'), 'w').write(js)
print('total', len(js) // 1024, 'KB')
