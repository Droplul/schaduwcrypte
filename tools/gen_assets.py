#!/usr/bin/env python3
"""Procedurele pixel-art voor Schaduwcrypte. Origineel werk, vrij te gebruiken in dit project."""
from __future__ import annotations
from PIL import Image, ImageDraw
import math, json, os, random

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)

FW, FH = 48, 64  # character frame
# anim columns
ANIMS = [("idle", 4), ("walk", 6), ("attack", 6), ("death", 6)]
COLS = sum(n for _, n in ANIMS)  # 22
DIRS = ("se", "sw", "nw", "ne")  # 0..3
HERO_CLASSES = ("warrior", "mage", "hunter")
MONSTERS = ("rat", "imp", "skel", "archer", "brute", "shaman", "boss")


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def px(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height and c[3] > 0:
        img.putpixel((int(x), int(y)), c)


def rect(img, x, y, w, h, c):
    for iy in range(int(h)):
        for ix in range(int(w)):
            px(img, x + ix, y + iy, c)


def disk(img, cx, cy, r, c):
    r = int(r)
    for iy in range(-r, r + 1):
        for ix in range(-r, r + 1):
            if ix * ix + iy * iy <= r * r + r * 0.2:
                px(img, cx + ix, cy + iy, c)


def line(img, x0, y0, x1, y1, c, t=1):
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        y = y0 + (y1 - y0) * i / n
        if t <= 1:
            px(img, round(x), round(y), c)
        else:
            disk(img, round(x), round(y), max(1, t // 2), c)


def outline(img, col=(12, 8, 8, 255)):
    w, h = img.size
    src = img.copy()
    for y in range(h):
        for x in range(w):
            a = src.getpixel((x, y))[3]
            if a > 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src.getpixel((nx, ny))[3] > 0:
                    px(img, x, y, col)
                    break


def rgba(hexcol, a=255):
    hexcol = hexcol.lstrip("#")
    r = int(hexcol[0:2], 16)
    g = int(hexcol[2:4], 16)
    b = int(hexcol[4:6], 16)
    return (r, g, b, a)


# ---------- palettes ----------
PAL = {
    "warrior": {
        "armor": rgba("#6a3a28"),
        "armor2": rgba("#3a1e14"),
        "armor3": rgba("#8a5640"),
        "metal": rgba("#c8c4bc"),
        "metal2": rgba("#8a8490"),
        "cloth": rgba("#2a1010"),
        "skin": rgba("#c4a07a"),
        "skin2": rgba("#8a6848"),
        "eye": rgba("#e8c547"),
        "hair": rgba("#1a0c0c"),
        "weapon": rgba("#d8dee8"),
        "guard": rgba("#c9a227"),
        "hilt": rgba("#5a3a20"),
    },
    "mage": {
        "armor": rgba("#3a2460"),
        "armor2": rgba("#1a1030"),
        "armor3": rgba("#5a3a8a"),
        "metal": rgba("#d0c878"),
        "metal2": rgba("#8a7020"),
        "cloth": rgba("#24143a"),
        "skin": rgba("#c4a07a"),
        "skin2": rgba("#8a6848"),
        "eye": rgba("#80e0ff"),
        "hair": rgba("#d8d0e8"),
        "weapon": rgba("#6a4428"),
        "guard": rgba("#80d0ff"),
        "hilt": rgba("#4a3018"),
    },
    "hunter": {
        "armor": rgba("#3a4a28"),
        "armor2": rgba("#243018"),
        "armor3": rgba("#6a7a40"),
        "metal": rgba("#c8b898"),
        "metal2": rgba("#6a5a40"),
        "cloth": rgba("#1a2410"),
        "skin": rgba("#c4a07a"),
        "skin2": rgba("#8a6848"),
        "eye": rgba("#b8e070"),
        "hair": rgba("#3a2410"),
        "weapon": rgba("#6a4428"),
        "guard": rgba("#d0d0c0"),
        "hilt": rgba("#4a3018"),
    },
    "rat": {
        "armor": rgba("#6a4a3a"), "armor2": rgba("#3a2818"), "armor3": rgba("#8a6a50"),
        "metal": rgba("#4a3020"), "metal2": rgba("#2a1810"), "cloth": rgba("#3a2818"),
        "skin": rgba("#7a5a40"), "skin2": rgba("#4a3020"), "eye": rgba("#ff4040"),
        "hair": rgba("#2a1810"), "weapon": rgba("#3a2818"), "guard": rgba("#1a1010"), "hilt": rgba("#2a1810"),
    },
    "imp": {
        "armor": rgba("#c43a20"), "armor2": rgba("#7a1810"), "armor3": rgba("#e06030"),
        "metal": rgba("#2a1010"), "metal2": rgba("#1a0808"), "cloth": rgba("#5a1010"),
        "skin": rgba("#c43a20"), "skin2": rgba("#8a2010"), "eye": rgba("#ffe060"),
        "hair": rgba("#4a1010"), "weapon": rgba("#e8d0a0"), "guard": rgba("#8a2010"), "hilt": rgba("#4a2010"),
    },
    "skel": {
        "armor": rgba("#d8d0c0"), "armor2": rgba("#8a8070"), "armor3": rgba("#f0ece0"),
        "metal": rgba("#8a8490"), "metal2": rgba("#4a4040"), "cloth": rgba("#2a2018"),
        "skin": rgba("#e8e0d0"), "skin2": rgba("#a09888"), "eye": rgba("#1a0808"),
        "hair": rgba("#f0ece0"), "weapon": rgba("#a0a8b0"), "guard": rgba("#6a5a40"), "hilt": rgba("#4a3020"),
    },
    "archer": {
        "armor": rgba("#d0c8b8"), "armor2": rgba("#7a7060"), "armor3": rgba("#e8e0d0"),
        "metal": rgba("#8a7060"), "metal2": rgba("#4a3828"), "cloth": rgba("#3a3020"),
        "skin": rgba("#e0d8c8"), "skin2": rgba("#988870"), "eye": rgba("#4a1010"),
        "hair": rgba("#e8e0d0"), "weapon": rgba("#6a4428"), "guard": rgba("#d0d0c0"), "hilt": rgba("#4a3018"),
    },
    "brute": {
        "armor": rgba("#6a3030"), "armor2": rgba("#3a1818"), "armor3": rgba("#8a4840"),
        "metal": rgba("#6a6a70"), "metal2": rgba("#3a3a40"), "cloth": rgba("#3a1010"),
        "skin": rgba("#8a5040"), "skin2": rgba("#5a3020"), "eye": rgba("#ff3030"),
        "hair": rgba("#1a0808"), "weapon": rgba("#6a5a48"), "guard": rgba("#4a3a28"), "hilt": rgba("#3a2818"),
    },
    "shaman": {
        "armor": rgba("#4a2a6a"), "armor2": rgba("#241438"), "armor3": rgba("#6a3a8a"),
        "metal": rgba("#c0a040"), "metal2": rgba("#6a5018"), "cloth": rgba("#1a1028"),
        "skin": rgba("#8a6a90"), "skin2": rgba("#4a3058"), "eye": rgba("#c080ff"),
        "hair": rgba("#e8e0f0"), "weapon": rgba("#4a3020"), "guard": rgba("#c080ff"), "hilt": rgba("#2a1810"),
    },
    "boss": {
        "armor": rgba("#8a1020"), "armor2": rgba("#3a0810"), "armor3": rgba("#c02028"),
        "metal": rgba("#2a0808"), "metal2": rgba("#1a0404"), "cloth": rgba("#1a0408"),
        "skin": rgba("#6a1818"), "skin2": rgba("#3a0808"), "eye": rgba("#ff2020"),
        "hair": rgba("#1a0000"), "weapon": rgba("#e8d0a0"), "guard": rgba("#ff4020"), "hilt": rgba("#4a1010"),
    },
}


def anim_params(anim, fi, n):
    """Return pose offsets for a given animation frame."""
    t = fi / max(n, 1)
    p = {
        "bob": 0, "legL": 0, "legR": 0, "armL": 0, "armR": 0,
        "lean": 0, "weapon": 0, "dead": 0, "squash": 0, "blink": 0,
    }
    if anim == "idle":
        p["bob"] = math.sin(t * math.pi * 2) * 0.7
        p["armL"] = math.sin(t * math.pi * 2) * 0.5
        p["armR"] = -math.sin(t * math.pi * 2) * 0.5
        p["blink"] = 1 if fi == 2 else 0
    elif anim == "walk":
        ph = t * math.pi * 2
        p["bob"] = abs(math.sin(ph)) * 2.2
        p["legL"] = math.sin(ph) * 6.0
        p["legR"] = math.sin(ph + math.pi) * 6.0
        p["armL"] = math.sin(ph + math.pi) * 4.5
        p["armR"] = math.sin(ph) * 4.5
    elif anim == "attack":
        # 0-1 windup, 2-3 strike, 4-5 recover
        if fi <= 1:
            p["weapon"] = -25 - fi * 20
            p["armR"] = -6
            p["lean"] = -1
            p["bob"] = 0
        elif fi <= 3:
            p["weapon"] = 20 + (fi - 2) * 35
            p["armR"] = 8
            p["lean"] = 2
            p["bob"] = 1
        else:
            p["weapon"] = 50 - (fi - 4) * 20
            p["armR"] = 3
            p["lean"] = 1
    elif anim == "death":
        p["dead"] = t
        p["lean"] = t * 8
        p["bob"] = t * 6
        p["squash"] = t
        p["armL"] = -t * 6
        p["armR"] = t * 8
        p["legL"] = t * 4
        p["legR"] = -t * 2
    return p


def draw_humanoid(img, pal, kind, dirc, anim, fi, n, scale=1.0):
    """Draw a humanoid-ish character into a 48x64 frame. dir: 0 se, 1 sw, 2 nw, 3 ne."""
    p = anim_params(anim, fi, n)
    # facing: 0 and 3 are more "rightish", 1 and 2 leftish? 
    # se=front-rightish, sw=front-leftish, nw=back-left, ne=back-right
    front = dirc in (0, 1)
    face_x = 1 if dirc in (0, 3) else -1  # lean details to the right for se/ne
    cx, feet = 24, 58
    bob = p["bob"]
    lean = p["lean"] * face_x
    dead = p["dead"]
    if dead > 0:
        # rotate/collapse toward the side
        feet = int(58 - dead * 4)
        cx = int(24 + dead * 8 * face_x)

    s = scale
    # sizes
    is_boss = kind == "boss"
    is_rat = kind == "rat"
    is_imp = kind == "imp"
    is_brute = kind == "brute" or is_boss
    thick = 1.35 if is_brute else (0.75 if is_imp or is_rat else 1.0)
    if is_boss:
        thick = 1.55

    head_r = int(6 * s * (1.15 if is_boss else 1) * (0.85 if is_imp else 1))
    body_w = int(10 * s * thick)
    body_h = int(16 * s * (0.7 if is_rat else 1) * (1.15 if is_boss else 1))
    hy = int(18 + bob - (4 if is_boss else 0))
    if is_rat:
        hy = int(36 + bob)

    # collapse: shift everything down
    if dead > 0.4:
        hy = int(hy + (dead - 0.4) * 22)

    # legs — start high enough that the cloak/torso overlaps the hips
    if not is_rat:
        ly = feet - 16
        lw, lh = int(4 * thick + 1), int(16 * s)
        if dead > 0.55:
            rect(img, cx - 12, feet - 5, 10, 4, pal["armor2"])
            rect(img, cx + 2, feet - 4, 10, 4, pal["armor2"])
            rect(img, cx - 12, feet - 3, 5, 3, pal["cloth"])
            rect(img, cx + 7, feet - 2, 5, 3, pal["cloth"])
        else:
            l_off = int(p["legL"])
            r_off = int(p["legR"])
            # left leg
            rect(img, cx - 5 - int(thick), ly + max(0, l_off // 3), lw, lh - max(-2, l_off // 2), pal["armor2"])
            rect(img, cx - 4 - int(thick), ly + 2 + max(0, l_off // 3), 2, lh - 6, pal["armor"])
            rect(img, cx - 6, ly + lh - 4 + max(0, l_off // 3), lw + 2, 4, pal["cloth"])
            # right leg
            rect(img, cx + 1, ly + max(0, r_off // 3), lw, lh - max(-2, r_off // 2), pal["armor2"])
            rect(img, cx + 2, ly + 2 + max(0, r_off // 3), 2, lh - 6, pal["armor"])
            rect(img, cx + 1, ly + lh - 4 + max(0, r_off // 3), lw + 2, 4, pal["cloth"])
    else:
        # rat body low + legs
        disk(img, cx - 2, feet - 2, 2, pal["armor2"])
        disk(img, cx + 6, feet - 2, 2, pal["armor2"])

    # torso / cloak
    by = hy + head_r + 1
    body_h = int(body_h * 1.25) + 4
    if is_rat:
        # long body
        disk(img, cx, feet - 8, 8, pal["armor"])
        disk(img, cx + 6, feet - 10, 6, pal["armor3"])
        # head
        disk(img, cx - 8, feet - 12, 5, pal["skin"])
        disk(img, cx - 12, feet - 11, 2, pal["skin2"])  # snout
        if p["blink"]:
            rect(img, cx - 10, feet - 13, 3, 1, pal["eye"])
        else:
            px(img, cx - 9, feet - 13, pal["eye"])
            px(img, cx - 7, feet - 13, pal["eye"])
        # ear
        rect(img, cx - 8, feet - 18, 2, 4, pal["armor2"])
        rect(img, cx - 5, feet - 17, 2, 3, pal["armor2"])
        # tail
        line(img, cx + 10, feet - 8, cx + 18, feet - 14 + int(math.sin(fi) * 2), pal["armor2"], 2)
        outline(img)
        return

    # cloak / body polygon-ish via stacked rects
    if kind in ("mage", "shaman", "hunter", "warrior", "boss"):
        for i in range(body_h):
            w = body_w + (i * 2) // max(body_h, 1)
            x = cx - w // 2 + int(lean * i / body_h)
            col = pal["armor"] if i < body_h * 0.7 else pal["armor2"]
            if kind == "mage" and i % 5 == 0:
                col = pal["metal"]
            rect(img, x, by + i, w, 1, col)
        # belt
        rect(img, cx - body_w // 2, by + body_h // 2, body_w, 2, pal["metal2"])
    else:
        rect(img, cx - body_w // 2, by, body_w, body_h, pal["armor"])
        rect(img, cx - body_w // 2 + 1, by + 2, body_w - 2, body_h - 4, pal["armor3"])

    # arms
    ay = by + 3
    arm_l = 9 if not is_imp else 7
    if dead < 0.7:
        # back arm
        if front or dirc in (1, 2):
            line(img, cx - 6, ay, cx - 7, ay + arm_l + int(p["armL"]), pal["skin2"], 2)
        # weapon arm
        wx = cx + 6 * face_x
        wy = ay + int(p["armR"] * 0.3)
        ang = math.radians(p["weapon"] if anim == "attack" else (p["armR"] * 8))
        if kind in ("hunter", "archer"):
            # bow
            bx = wx + face_x * 3
            by2 = wy + 2
            line(img, bx, by2 - 8, bx, by2 + 9, pal["weapon"], 2)
            line(img, bx, by2 - 8, bx - 4 * face_x, by2, pal["guard"], 1)
            line(img, bx, by2 + 9, bx - 4 * face_x, by2, pal["guard"], 1)
            if anim == "attack" and 1 <= fi <= 3:
                # arrow
                line(img, bx - 6 * face_x, by2, bx + 8 * face_x, by2, pal["metal"], 1)
        elif kind in ("mage", "shaman"):
            # staff
            sx = wx + face_x * 2
            sy0 = wy - 14
            sy1 = wy + 16
            if anim == "attack":
                sx += int(math.sin(math.radians(p["weapon"])) * 4)
            line(img, sx, sy0, sx, sy1, pal["weapon"], 2)
            disk(img, sx, sy0 - 1, 3, pal["guard"])
            disk(img, sx, sy0 - 1, 1, rgba("#ffffff"))
        else:
            # sword / club / claws
            length = 16 if kind != "brute" else 14
            if kind == "boss":
                length = 20
            wa = math.radians(-50 + p["weapon"]) if front else math.radians(50 - p["weapon"])
            if dirc in (1, 2):
                wa = math.pi - wa
            ex = wx + math.cos(wa) * length
            ey = wy + math.sin(wa) * length
            col = pal["weapon"]
            thickw = 2 if kind != "brute" else 3
            line(img, wx, wy, ex, ey, col, thickw)
            # guard
            gx, gy = wx + math.cos(wa) * 4, wy + math.sin(wa) * 4
            line(img, gx - 3, gy, gx + 3, gy, pal["guard"], 2)

        line(img, cx + 5 * face_x, ay, wx, wy + 6, pal["skin"], 2)

    # head / hood
    hx = cx + int(lean * 0.4)
    if kind in ("warrior", "hunter", "mage", "shaman", "boss"):
        # hood
        disk(img, hx, hy, head_r + 2, pal["cloth"])
        disk(img, hx, hy - 1, head_r + 1, pal["hair"] if kind != "mage" else pal["cloth"])
        # hood drape
        rect(img, hx - head_r, hy + 2, head_r * 2 + 1, 5, pal["cloth"])
        if front:
            disk(img, hx, hy + 2, head_r - 2, pal["skin"])
            disk(img, hx - 2, hy + 1, 2, pal["skin2"])  # shade
            # eyes
            if not p["blink"] and dead < 0.5:
                px(img, hx - 2, hy, pal["eye"])
                px(img, hx + 2, hy, pal["eye"])
                if kind == "boss":
                    disk(img, hx - 3, hy, 2, pal["eye"])
                    disk(img, hx + 3, hy, 2, pal["eye"])
            else:
                rect(img, hx - 3, hy, 2, 1, pal["skin2"])
                rect(img, hx + 1, hy, 2, 1, pal["skin2"])
            # mouth / beard
            if kind == "warrior":
                rect(img, hx - 1, hy + 3, 3, 1, pal["hair"])
        else:
            # back of hood
            disk(img, hx, hy, head_r + 1, pal["cloth"])
            rect(img, hx - 3, hy + 3, 6, 4, pal["cloth"])
        # horns for boss / imp later
        if kind == "boss":
            rect(img, hx - 8, hy - 6, 3, 8, pal["metal"])
            rect(img, hx + 5, hy - 6, 3, 8, pal["metal"])
            line(img, hx - 7, hy - 6, hx - 10, hy - 12, pal["metal"], 2)
            line(img, hx + 7, hy - 6, hx + 10, hy - 12, pal["metal"], 2)
    elif kind in ("skel", "archer"):
        disk(img, hx, hy, head_r - 1, pal["skin"])
        if front and dead < 0.5:
            # sockets
            px(img, hx - 2, hy, pal["eye"])
            px(img, hx + 2, hy, pal["eye"])
            rect(img, hx - 1, hy + 3, 3, 1, pal["skin2"])
    elif kind == "imp":
        disk(img, hx, hy, head_r, pal["skin"])
        # horns
        line(img, hx - 3, hy - 4, hx - 6, hy - 10, pal["hair"], 2)
        line(img, hx + 3, hy - 4, hx + 6, hy - 10, pal["hair"], 2)
        if front and not p["blink"]:
            px(img, hx - 2, hy, pal["eye"])
            px(img, hx + 2, hy, pal["eye"])
    elif kind == "brute":
        disk(img, hx, hy, head_r + 1, pal["skin"])
        if front:
            disk(img, hx - 3, hy, 1, pal["eye"])
            disk(img, hx + 3, hy, 1, pal["eye"])
            rect(img, hx - 2, hy + 3, 5, 2, pal["skin2"])

    # hair tuft
    if kind == "mage" and front:
        rect(img, hx - 4, hy - head_r, 8, 2, pal["hair"])

    outline(img)


def build_character_sheet(kinds, name):
    rows = len(kinds) * 4
    sheet = new(COLS * FW, rows * FH)
    meta = {"frameW": FW, "frameH": FH, "cols": COLS, "anims": {}, "kinds": list(kinds), "dirs": list(DIRS)}
    col = 0
    for anim, n in ANIMS:
        meta["anims"][anim] = {"col": col, "frames": n}
        col += n
    for ki, kind in enumerate(kinds):
        pal = PAL[kind]
        sc = 1.15 if kind == "boss" else (0.9 if kind in ("imp",) else 1.0)
        for di, dirc in enumerate(range(4)):
            col = 0
            for anim, n in ANIMS:
                for fi in range(n):
                    fr = new(FW, FH)
                    draw_humanoid(fr, pal, kind, di, anim, fi, n, sc)
                    sheet.paste(fr, (col * FW, (ki * 4 + di) * FH), fr)
                    col += 1
    path = os.path.join(OUT, name + ".png")
    sheet.save(path, optimize=True)
    print("wrote", path, sheet.size)
    return meta


# ---------- tiles ----------
def hashish(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177
    return (n ^ (n >> 16)) & 0xFFFFFFFF


def diamond_mask(w=64, h=32):
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(w // 2, 0), (w - 1, h // 2), (w // 2, h - 1), (0, h // 2)], fill=255)
    return m


def make_floor_variant(idx):
    w, h = 64, 32
    img = new(w, h)
    rng = random.Random(1000 + idx)
    # base tone sets
    bases = [
        ((58, 44, 38), (70, 54, 46), (48, 36, 32)),  # stone
        ((64, 50, 42), (52, 40, 36), (76, 58, 50)),  # light stone
        ((50, 38, 36), (62, 42, 40), (40, 28, 26)),  # dark
        ((60, 46, 36), (48, 40, 30), (70, 52, 40)),
    ]
    a, b, c = bases[idx % 4]
    for y in range(h):
        for x in range(w):
            n = hashish(x, y, idx)
            t = (n % 100) / 100
            col = a if t < 0.45 else (b if t < 0.8 else c)
            # noise flecks
            if n % 17 == 0:
                col = tuple(min(255, k + 14) for k in col)
            if n % 23 == 0:
                col = tuple(max(0, k - 16) for k in col)
            px(img, x, y, (*col, 255))
    # cracks
    if idx % 3 != 0:
        x0, y0 = rng.randint(16, 48), rng.randint(8, 24)
        for _ in range(rng.randint(8, 18)):
            x0 += rng.randint(-2, 2)
            y0 += rng.randint(-1, 1)
            px(img, x0, y0, (30, 22, 20, 200))
            px(img, x0, y0 + 1, (30, 22, 20, 120))
    # pebbles
    for _ in range(5 + idx % 4):
        sx, sy = rng.randint(8, 54), rng.randint(6, 24)
        disk(img, sx, sy, rng.randint(1, 2), (40 + rng.randint(0, 20), 30, 26, 255))
    # blood
    if idx in (3, 7, 11):
        for _ in range(8):
            bx, by = rng.randint(12, 50), rng.randint(8, 24)
            disk(img, bx, by, rng.randint(1, 3), (90, 16, 16, rng.randint(80, 160)))
    # bones
    if idx in (4, 8, 12):
        x0, y0 = rng.randint(16, 40), rng.randint(10, 20)
        line(img, x0, y0, x0 + 8, y0 + 2, (210, 200, 180, 220), 1)
        disk(img, x0, y0, 1, (220, 210, 190, 255))
        disk(img, x0 + 8, y0 + 2, 1, (220, 210, 190, 255))
    # moss
    if idx in (5, 9, 13):
        for _ in range(6):
            disk(img, rng.randint(10, 54), rng.randint(6, 24), rng.randint(1, 2), (36, 60, 32, 140))
    mask = diamond_mask(w, h)
    out = new(w, h)
    out.paste(img, (0, 0))
    out.putalpha(mask)
    return out


def make_wall_top(idx):
    w, h = 64, 32
    img = new(w, h)
    rng = random.Random(2000 + idx)
    for y in range(h):
        for x in range(w):
            n = hashish(x, y, 40 + idx)
            col = (78, 56, 48) if n % 3 else (64, 46, 40)
            if n % 11 == 0:
                col = (92, 68, 58)
            px(img, x, y, (*col, 255))
    # mortar lines
    for i in range(3):
        y = 6 + i * 8
        for x in range(w):
            if hashish(x, y, idx) % 5:
                px(img, x, y, (40, 28, 24, 200))
    if idx % 2:
        # moss edge
        for x in range(8, 56):
            if rng.random() > 0.6:
                px(img, x, 4 + rng.randint(0, 3), (40, 70, 36, 180))
    mask = diamond_mask(w, h)
    out = new(w, h)
    out.paste(img, (0, 0))
    out.putalpha(mask)
    return out


def make_wall_side(idx, side):
    # left or right parallelogram-ish face, 32x26
    w, h = 36, 28
    img = new(w, h)
    dark = side == "right"
    base = (28, 18, 18) if dark else (48, 32, 30)
    hi = (38, 24, 24) if dark else (62, 42, 38)
    for y in range(h):
        for x in range(w):
            # slant: left face wider at top-left
            n = hashish(x, y, 80 + idx + (10 if dark else 0))
            col = hi if n % 4 == 0 else base
            if n % 13 == 0:
                col = tuple(max(0, c - 10) for c in col)
            px(img, x, y, (*col, 255))
    # brick lines
    for y in range(4, h, 7):
        for x in range(w):
            px(img, x, y, (20, 12, 12, 180))
    for x in range(4, w, 9):
        for y in range(h):
            if (y // 7) % 2:
                px(img, x + 4, y, (20, 12, 12, 140))
            else:
                px(img, x, y, (20, 12, 12, 140))
    # cracks / blood
    rng = random.Random(3000 + idx)
    if idx % 3 == 0:
        x0, y0 = 8, 6
        for _ in range(10):
            x0 += rng.randint(-1, 1)
            y0 += 1
            px(img, x0, y0, (18, 10, 10, 220))
    if idx % 4 == 0:
        disk(img, 12, 16, 3, (80, 16, 16, 120))
    return img


def make_stairs():
    img = make_floor_variant(0)
    d = ImageDraw.Draw(img)
    # concentric diamonds
    for k, col in ((20, (200, 170, 80, 255)), (14, (40, 24, 16, 255)), (8, (200, 170, 80, 200))):
        d.polygon([(32, 16 - k // 2), (32 + k, 16), (32, 16 + k // 2), (32 - k, 16)], outline=col)
    return img


def make_torch_frames():
    frames = []
    for i in range(6):
        img = new(24, 40)
        # bracket
        rect(img, 9, 22, 6, 4, rgba("#6a5a40"))
        rect(img, 10, 18, 4, 8, rgba("#4a3a28"))
        disk(img, 12, 18, 3, rgba("#8a6a30"))
        # flame
        rng = random.Random(50 + i)
        for k in range(14):
            yy = 16 - k
            spread = 1 + int((1 - k / 14) * (3 + (i % 3)))
            for dx in range(-spread, spread + 1):
                if rng.random() > 0.25 + k * 0.04:
                    if k < 4:
                        col = rgba("#ffe08a")
                    elif k < 8:
                        col = rgba("#ff9a30")
                    else:
                        col = rgba("#ff5020")
                    px(img, 12 + dx + rng.randint(-1, 1), yy, col)
        # glow core
        disk(img, 12, 14, 2, rgba("#fff4c0"))
        frames.append(img)
    return frames


def make_chest(open_):
    img = new(32, 28)
    body = rgba("#8a5a20") if not open_ else rgba("#5a3a18")
    lid = rgba("#c9a227") if not open_ else rgba("#4a3020")
    rect(img, 6, 12, 20, 12, body)
    rect(img, 6, 12, 20, 3, (40, 24, 12, 255))
    if open_:
        rect(img, 6, 2, 20, 10, lid)
        rect(img, 7, 12, 18, 6, (20, 12, 8, 255))
        # gold glow
        disk(img, 16, 16, 3, rgba("#e8c547"))
    else:
        rect(img, 6, 6, 20, 8, lid)
        rect(img, 14, 10, 4, 6, rgba("#e8c547"))
        disk(img, 16, 14, 1, rgba("#fff0a0"))
    outline(img, (20, 12, 6, 255))
    return img


def build_tiles():
    # layout:
    # row 0-1: 16 floor tiles (8 per row) each 64x32
    # row 2: 8 wall tops
    # row 3: stairs (0), chest closed (1), chest open (2) packed
    # then wall sides and torches in a compact strip
    FLOORS = 16
    cellw, cellh = 64, 40
    cols = 8
    rows = 8
    sheet = new(cols * cellw, rows * cellh)
    meta = {"cellW": cellw, "cellH": cellh, "cols": cols}
    # floors
    for i in range(FLOORS):
        t = make_floor_variant(i)
        r, c = divmod(i, cols)
        sheet.paste(t, (c * cellw, r * cellh + 4), t)
    # wall tops row 2
    for i in range(8):
        t = make_wall_top(i)
        sheet.paste(t, (i * cellw, 2 * cellh + 4), t)
    # stairs
    st = make_stairs()
    sheet.paste(st, (0, 3 * cellh + 4), st)
    # chests
    cc = make_chest(False)
    co = make_chest(True)
    sheet.paste(cc, (cellw + 16, 3 * cellh + 8), cc)
    sheet.paste(co, (cellw * 2 + 16, 3 * cellh + 8), co)
    # wall sides row 4-5
    for i in range(8):
        L = make_wall_side(i, "left")
        R = make_wall_side(i, "right")
        sheet.paste(L, (i * cellw, 4 * cellh + 6), L)
        sheet.paste(R, (i * cellw + 28, 5 * cellh + 6), R)
    # torches row 6
    frames = make_torch_frames()
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * 28 + 4, 6 * cellh + 2), fr)
    path = os.path.join(OUT, "tiles.png")
    sheet.save(path, optimize=True)
    print("wrote", path, sheet.size)
    meta["floors"] = FLOORS
    return meta


def main():
    heroes = build_character_sheet(HERO_CLASSES, "heroes")
    monsters = build_character_sheet(MONSTERS, "monsters")
    tiles = build_tiles()
    meta = {"heroes": heroes, "monsters": monsters, "tiles": tiles, "FW": FW, "FH": FH}
    with open(os.path.join(OUT, "atlas.json"), "w") as f:
        json.dump(meta, f, indent=2)
    # preview strip: one idle frame of each
    prev = new(48 * (len(HERO_CLASSES) + len(MONSTERS)), 64)
    hs = Image.open(os.path.join(OUT, "heroes.png"))
    ms = Image.open(os.path.join(OUT, "monsters.png"))
    x = 0
    for i in range(len(HERO_CLASSES)):
        fr = hs.crop((0, i * 4 * FH, FW, i * 4 * FH + FH))
        prev.paste(fr, (x, 0), fr)
        x += 48
    for i in range(len(MONSTERS)):
        fr = ms.crop((0, i * 4 * FH, FW, i * 4 * FH + FH))
        prev.paste(fr, (x, 0), fr)
        x += 48
    prev = prev.resize((prev.width * 3, prev.height * 3), Image.Resampling.NEAREST)
    prev.save(os.path.join(OUT, "_preview.png"))
    print("preview written")


if __name__ == "__main__":
    main()
