(() => {
  "use strict";

  const TILE_W = 64;
  const TILE_H = 32;
  const WALL_H = 18;
  const SAVE_KEY = "schaduwcrypte-save-v1";
  const SPELL_CD = 6;
  const SPELL_MANA = 24;
  const SPELL_RADIUS = 3.1;
  const MAX_PARTICLES = 90;

  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

  const ui = {
    hud: $("hud"),
    controls: $("controls"),
    title: $("title-screen"),
    pause: $("pause-screen"),
    death: $("death-screen"),
    rotate: $("rotate-hint"),
    install: $("install-banner"),
    hpFill: $("hp-fill"),
    mpFill: $("mp-fill"),
    xpFill: $("xp-fill"),
    hpText: $("hp-text"),
    mpText: $("mp-text"),
    level: $("hud-level"),
    floor: $("hud-floor"),
    gold: $("hud-gold"),
    hpCount: $("hp-count"),
    mpCount: $("mp-count"),
    spellCd: $("spell-cd"),
    spellBtn: $("btn-spell"),
    atkBtn: $("btn-attack"),
    hpBtn: $("btn-hp"),
    mpBtn: $("btn-mp"),
    joy: $("joystick"),
    knob: $("joy-knob"),
    toasts: $("toasts"),
    loot: $("loot-feed"),
    pauseStats: $("pause-stats"),
    deathSummary: $("death-summary"),
    btnContinue: $("btn-continue"),
    installText: $("install-text"),
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Audio ---------------- */
  let actx = null, master = null, muted = false;
  function ensureAudio() {
    if (actx) {
      if (actx.state === "suspended") actx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0.2;
    master.connect(actx.destination);
    const amb = actx.createGain();
    amb.gain.value = 0.1;
    amb.connect(master);
    const o1 = actx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 54;
    const o2 = actx.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = 81;
    const g2 = actx.createGain();
    g2.gain.value = 0.28;
    o1.connect(amb);
    o2.connect(g2);
    g2.connect(amb);
    o1.start();
    o2.start();
  }
  function tone(freq, dur, type, vol, freq2) {
    if (muted || !actx) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  const sfx = {
    slash: () => tone(220, 0.09, "sawtooth", 0.22, 90),
    hit: () => tone(140, 0.08, "square", 0.2, 70),
    hurt: () => tone(180, 0.16, "sawtooth", 0.25, 70),
    spell: () => { tone(160, 0.28, "sawtooth", 0.28, 70); tone(420, 0.2, "triangle", 0.16, 180); },
    pickup: () => tone(520, 0.12, "square", 0.18, 880),
    potion: () => tone(300, 0.16, "triangle", 0.2, 600),
    death: () => tone(120, 0.5, "sawtooth", 0.3, 40),
    stair: () => tone(240, 0.3, "triangle", 0.2, 480),
    level: () => { tone(440, 0.15, "square", 0.2, 660); setTimeout(() => tone(660, 0.2, "square", 0.18, 880), 90); },
    ui: () => tone(380, 0.05, "square", 0.08),
    open: () => tone(200, 0.14, "triangle", 0.16, 340),
  };

  /* ---------------- Items ---------------- */
  const RARITY = { common: 0, magic: 1, rare: 2, legendary: 3 };
  const WEAPONS = [
    { name: "Roestig zwaard", dmg: 8, rarity: "common" },
    { name: "IJzeren bijl", dmg: 12, rarity: "common" },
    { name: "Kerkermes", dmg: 11, rarity: "common" },
    { name: "Runenkling", dmg: 16, rarity: "magic" },
    { name: "Schaduwbijl", dmg: 20, rarity: "magic" },
    { name: "Grafhouw", dmg: 26, rarity: "rare" },
    { name: "Hellevlam-sabel", dmg: 34, rarity: "rare" },
    { name: "Zielvreter", dmg: 46, rarity: "legendary" },
  ];
  const ARMORS = [
    { name: "Versleten mantel", arm: 2, rarity: "common" },
    { name: "Leren harnas", arm: 5, rarity: "common" },
    { name: "Ketenhemd", arm: 8, rarity: "magic" },
    { name: "Crypteplaat", arm: 12, rarity: "magic" },
    { name: "Schaduwmaliën", arm: 16, rarity: "rare" },
    { name: "Hellevaardersharnas", arm: 22, rarity: "legendary" },
  ];

  function pickLoot(floor, rng) {
    const roll = rng();
    let rarity = "common";
    if (roll > 0.97 - floor * 0.004) rarity = "legendary";
    else if (roll > 0.86 - floor * 0.01) rarity = "rare";
    else if (roll > 0.58) rarity = "magic";
    const pool = rng() < 0.55 ? WEAPONS : ARMORS;
    const options = pool.filter((i) => i.rarity === rarity);
    const src = (options.length ? options : pool)[(rng() * (options.length ? options.length : pool.length)) | 0];
    return { ...src, kind: src.dmg != null ? "weapon" : "armor" };
  }

  /* ---------------- Bestiary ---------------- */
  const BESTIARY = {
    rat: { name: "Crypterat", hp: 16, dmg: 4, spd: 3.3, xp: 7, r: 0.28, aggro: 7, color: "#6a4a3a", kind: "melee" },
    imp: { name: "Imp", hp: 28, dmg: 7, spd: 3.5, xp: 13, r: 0.32, aggro: 8, color: "#c43a20", kind: "melee" },
    skel: { name: "Skelet", hp: 48, dmg: 10, spd: 2.35, xp: 22, r: 0.36, aggro: 9, color: "#d8d0c0", kind: "melee" },
    archer: { name: "Botboogschutter", hp: 36, dmg: 9, spd: 2.15, xp: 26, r: 0.34, aggro: 11, color: "#c8b898", kind: "ranged" },
    brute: { name: "Cryptebeul", hp: 120, dmg: 16, spd: 1.65, xp: 44, r: 0.52, aggro: 8, color: "#6a3030", kind: "melee" },
    shaman: { name: "Schaduwshamaan", hp: 70, dmg: 13, spd: 2.0, xp: 36, r: 0.38, aggro: 10, color: "#5a3a8a", kind: "ranged" },
    boss: { name: "Schaduwheer", hp: 420, dmg: 22, spd: 2.05, xp: 220, r: 0.72, aggro: 18, color: "#8a1020", kind: "boss" },
  };

  function scaled(type, floor) {
    const b = BESTIARY[type];
    const f = Math.max(0, floor - 1);
    return {
      ...b,
      type,
      maxHp: Math.round(b.hp * (1 + 0.22 * f)),
      dmg: Math.round(b.dmg * (1 + 0.14 * f)),
      xp: Math.round(b.xp * (1 + 0.12 * f)),
    };
  }

  function packForFloor(floor) {
    if (floor % 5 === 0) return ["boss"];
    if (floor === 1) return ["rat", "rat", "imp"];
    if (floor === 2) return ["imp", "imp", "skel"];
    if (floor === 3) return ["skel", "imp", "archer"];
    if (floor === 4) return ["skel", "archer", "brute"];
    const bag = ["imp", "skel", "archer", "brute", "shaman"];
    if (floor >= 7) bag.push("brute", "shaman");
    return bag;
  }

  /* ---------------- Dungeon ---------------- */
  const T_WALL = 0, T_FLOOR = 1, T_STAIRS = 2;

  function carveRect(tiles, w, x, y, rw, rh) {
    for (let iy = y; iy < y + rh; iy++) {
      for (let ix = x; ix < x + rw; ix++) tiles[iy * w + ix] = T_FLOOR;
    }
  }
  function carveH(tiles, w, x0, x1, y) {
    const a = Math.min(x0, x1) | 0, b = Math.max(x0, x1) | 0;
    for (let x = a; x <= b; x++) {
      tiles[y * w + x] = T_FLOOR;
      if (y > 0) tiles[(y - 1) * w + x] = T_FLOOR;
    }
  }
  function carveV(tiles, w, x, y0, y1) {
    const a = Math.min(y0, y1) | 0, b = Math.max(y0, y1) | 0;
    for (let y = a; y <= b; y++) {
      tiles[y * w + x] = T_FLOOR;
      if (x > 0) tiles[y * w + x - 1] = T_FLOOR;
    }
  }

  function generateFloor(floor, seed) {
    const rng = mulberry32(seed);
    const w = Math.min(50, 34 + floor * 2);
    const h = Math.min(50, 34 + floor * 2);
    const tiles = new Uint8Array(w * h);
    const rooms = [];
    const nRooms = 6 + ((floor + 1) % 3) + ((rng() * 3) | 0);
    for (let tries = 0; tries < nRooms * 10 && rooms.length < nRooms; tries++) {
      const rw = 5 + ((rng() * 6) | 0);
      const rh = 5 + ((rng() * 6) | 0);
      const rx = 1 + ((rng() * (w - rw - 2)) | 0);
      const ry = 1 + ((rng() * (h - rh - 2)) | 0);
      const pad = 1;
      if (rooms.some((r) => rx < r.x + r.w + pad && rx + rw + pad > r.x && ry < r.y + r.h + pad && ry + rh + pad > r.y)) continue;
      rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + rw / 2, cy: ry + rh / 2 });
      carveRect(tiles, w, rx, ry, rw, rh);
    }
    if (rooms.length < 2) {
      carveRect(tiles, w, 2, 2, w - 4, h - 4);
      rooms.push({ x: 2, y: 2, w: w - 4, h: h - 4, cx: w / 2, cy: h / 2 });
    }
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      if (rng() < 0.5) {
        carveH(tiles, w, a.cx | 0, b.cx | 0, a.cy | 0);
        carveV(tiles, w, b.cx | 0, a.cy | 0, b.cy | 0);
      } else {
        carveV(tiles, w, a.cx | 0, a.cy | 0, b.cy | 0);
        carveH(tiles, w, a.cx | 0, b.cx | 0, b.cy | 0);
      }
    }
    if (rooms.length > 3) {
      const a = rooms[0], b = rooms[rooms.length - 1];
      carveH(tiles, w, a.cx | 0, b.cx | 0, ((a.cy + b.cy) / 2) | 0);
    }
    const start = rooms[0];
    const end = rooms[rooms.length - 1];
    const spawn = { x: start.cx, y: start.cy };
    const stairs = { x: (end.cx | 0) + 0.5, y: (end.cy | 0) + 0.5 };
    tiles[(stairs.y | 0) * w + (stairs.x | 0)] = T_STAIRS;

    const torches = [];
    for (const r of rooms) {
      torches.push({ x: r.x + 1.3, y: r.y + 1.3 });
      if (rng() > 0.4) torches.push({ x: r.x + r.w - 1.3, y: r.y + r.h - 1.3 });
    }

    const chests = [];
    const nChests = 1 + ((rng() * 2) | 0) + (floor > 3 ? 1 : 0);
    for (let i = 0; i < nChests; i++) {
      const r = rooms[1 + ((rng() * Math.max(1, rooms.length - 1)) | 0)];
      const cx = r.x + 1 + ((rng() * (r.w - 2)) | 0) + 0.5;
      const cy = r.y + 1 + ((rng() * (r.h - 2)) | 0) + 0.5;
      if (dist(cx, cy, spawn.x, spawn.y) < 4) continue;
      chests.push({ x: cx, y: cy, open: false });
    }

    const enemies = [];
    const types = packForFloor(floor);
    const isBoss = types[0] === "boss";
    const nEn = isBoss ? 1 + Math.min(4, 1 + (floor / 5 | 0)) : 7 + Math.min(10, floor * 2);
    if (isBoss) {
      enemies.push(makeEnemy("boss", end.cx, end.cy, floor, rng));
      for (let i = 0; i < nEn - 1; i++) {
        const t = rng() < 0.5 ? "shaman" : "skel";
        enemies.push(makeEnemy(t, end.cx + (rng() - 0.5) * 4, end.cy + (rng() - 0.5) * 4, floor, rng));
      }
    } else {
      for (let i = 0; i < nEn; i++) {
        const r = rooms[1 + ((rng() * Math.max(1, rooms.length - 1)) | 0)];
        const ex = r.x + 1.2 + rng() * (r.w - 2.4);
        const ey = r.y + 1.2 + rng() * (r.h - 2.4);
        if (dist(ex, ey, spawn.x, spawn.y) < 6) continue;
        const t = types[(rng() * types.length) | 0];
        enemies.push(makeEnemy(t, ex, ey, floor, rng));
      }
      let guard = 0;
      while (enemies.length < Math.min(5, nEn) && guard++ < 40) {
        const r = rooms[rooms.length - 1];
        const ex = r.x + 1.2 + rng() * Math.max(0.4, r.w - 2.4);
        const ey = r.y + 1.2 + rng() * Math.max(0.4, r.h - 2.4);
        if (dist(ex, ey, spawn.x, spawn.y) < 5) continue;
        const t = types[(rng() * types.length) | 0];
        if (t === "boss") continue;
        enemies.push(makeEnemy(t, ex, ey, floor, rng));
      }
    }
    return { w, h, tiles, rooms, spawn, stairs, torches, chests, enemies, seed, floor };
  }

  let _eid = 1;
  function makeEnemy(type, x, y, floor, rng) {
    const s = scaled(type, floor);
    return {
      id: _eid++,
      type,
      name: s.name,
      x, y,
      r: s.r,
      hp: s.maxHp,
      maxHp: s.maxHp,
      dmg: s.dmg,
      spd: s.spd,
      xp: s.xp,
      aggro: s.aggro,
      color: s.color,
      kind: s.kind,
      face: 0,
      atkCd: 0.4 + rng() * 0.6,
      alive: true,
      hurt: 0,
      alert: false,
    };
  }

  function tileAt(map, x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= map.w || iy >= map.h) return T_WALL;
    return map.tiles[iy * map.w + ix];
  }
  function walkable(map, x, y) {
    return tileAt(map, x, y) !== T_WALL;
  }
  function canStand(map, x, y, r) {
    const s = r * 0.72;
    return (
      walkable(map, x - s, y - s) &&
      walkable(map, x + s, y - s) &&
      walkable(map, x - s, y + s) &&
      walkable(map, x + s, y + s)
    );
  }

  function pathfind(map, ax, ay, bx, by) {
    const sx = ax | 0, sy = ay | 0, tx = bx | 0, ty = by | 0;
    if (!walkable(map, tx + 0.5, ty + 0.5)) return null;
    const w = map.w, h = map.h;
    const key = (x, y) => y * w + x;
    const open = [[sx, sy, 0]];
    const came = new Int32Array(w * h).fill(-1);
    const g = new Float32Array(w * h).fill(1e9);
    const seen = new Uint8Array(w * h);
    g[key(sx, sy)] = 0;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let found = false;
    let guard = 0;
    while (open.length && guard++ < 1400) {
      let bi = 0, bv = 1e12;
      for (let i = 0; i < open.length; i++) {
        const n = open[i];
        const f = n[2] + Math.abs(n[0] - tx) + Math.abs(n[1] - ty);
        if (f < bv) { bv = f; bi = i; }
      }
      const [x, y] = open.splice(bi, 1)[0];
      if (x === tx && y === ty) { found = true; break; }
      const ki = key(x, y);
      if (seen[ki]) continue;
      seen[ki] = 1;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (map.tiles[ny * w + nx] === T_WALL) continue;
        if (dx && dy && (map.tiles[y * w + nx] === T_WALL || map.tiles[ny * w + x] === T_WALL)) continue;
        const nk = key(nx, ny);
        const ng = g[ki] + (dx && dy ? 1.41 : 1);
        if (ng < g[nk]) {
          g[nk] = ng;
          came[nk] = ki;
          open.push([nx, ny, ng]);
        }
      }
    }
    if (!found) return null;
    const path = [];
    let c = key(tx, ty);
    while (c !== -1 && c !== key(sx, sy)) {
      path.push({ x: (c % w) + 0.5, y: ((c / w) | 0) + 0.5 });
      c = came[c];
    }
    path.reverse();
    return path;
  }

  /* ---------------- State ---------------- */
  let mode = "title";
  let map = null;
  let player = null;
  let enemies = [];
  let drops = [];
  let particles = [];
  let projectiles = [];
  let floaters = [];
  let cam = { x: 0, y: 0 };
  let scale = 1;
  let dpr = 1;
  let cssW = 1, cssH = 1;
  let time = 0;
  let run = { floor: 1, seed: 1, kills: 0, deepest: 1, started: 0, time: 0 };
  let ignorePortrait = false;
  let deferredPrompt = null;
  let hudDirty = true;

  function defaultPlayer() {
    return {
      x: 2, y: 2, r: 0.34,
      hp: 120, maxHp: 120,
      mp: 60, maxMp: 60,
      xp: 0, next: 60, level: 1,
      gold: 0,
      potsHp: 2, potsMp: 1,
      weapon: { ...WEAPONS[0], kind: "weapon" },
      armor: { ...ARMORS[0], kind: "armor" },
      atkCd: 0, spellCd: 0,
      face: 0, spd: 4.15,
      attackT: 0, hurt: 0, invuln: 0,
      path: null, pathI: 0,
    };
  }

  function playerDmg() {
    return player.weapon.dmg + 3 + player.level * 2;
  }
  function playerArm() {
    return player.armor.arm + Math.floor(player.level * 0.4);
  }
  function xpTo(lv) { return Math.round(50 * Math.pow(1.35, lv - 1)); }

  /* ---------------- Input ---------------- */
  const input = {
    joyX: 0, joyY: 0, joyId: null,
    attack: false, attackId: null,
    keys: new Set(),
    moveTarget: null,
    atkTarget: null,
  };

  function joyToWorld(jx, jy) {
    // joystick in screen space → isometric world
    let wx = jx / (TILE_W / 2) + jy / (TILE_H / 2);
    let wy = -jx / (TILE_W / 2) + jy / (TILE_H / 2);
    const l = Math.hypot(wx, wy) || 1;
    return { x: wx / l, y: wy / l, m: clamp(Math.hypot(jx, jy), 0, 1) };
  }

  function setKnob(dx, dy, radius) {
    const l = Math.hypot(dx, dy) || 1;
    const m = Math.min(l, radius);
    const kx = (dx / l) * m;
    const ky = (dy / l) * m;
    ui.knob.style.transform = `translate(${kx}px, ${ky}px)`;
  }
  function resetKnob() {
    ui.knob.style.transform = "translate(0,0)";
    input.joyX = 0;
    input.joyY = 0;
    input.joyId = null;
  }

  function bindJoystick() {
    const el = ui.joy;
    const onStart = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      if (input.joyId != null && e.pointerId != null && input.joyId !== t.identifier && input.joyId !== e.pointerId) return;
      input.joyId = t.identifier != null ? t.identifier : e.pointerId;
      moveJoy(t, el);
      e.preventDefault();
    };
    const onMove = (e) => {
      const list = e.changedTouches ? e.changedTouches : [e];
      for (const t of list) {
        const id = t.identifier != null ? t.identifier : e.pointerId;
        if (id === input.joyId) moveJoy(t, el);
      }
      if (input.joyId != null) e.preventDefault();
    };
    const onEnd = (e) => {
      const list = e.changedTouches ? e.changedTouches : [e];
      for (const t of list) {
        const id = t.identifier != null ? t.identifier : e.pointerId;
        if (id === input.joyId) resetKnob();
      }
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      el.setPointerCapture(e.pointerId);
      onStart(e);
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      onMove(e);
    });
    el.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") return;
      onEnd(e);
    });
    el.addEventListener("pointercancel", onEnd);
  }
  function moveJoy(t, el) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = t.clientX - cx;
    const dy = t.clientY - cy;
    const radius = rect.width / 2 - 4;
    const l = Math.hypot(dx, dy) || 1;
    const nx = dx / l, ny = dy / l;
    const m = clamp(l / radius, 0, 1);
    input.joyX = nx * m;
    input.joyY = ny * m;
    setKnob(dx, dy, radius * 0.62);
  }

  function holdButton(el, on, off) {
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      on();
      el.classList.add("active");
    };
    const up = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      off();
      el.classList.remove("active");
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", (e) => { if (e.buttons) up(e); });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) * (cssW / rect.width);
    const sy = (clientY - rect.top) * (cssH / rect.height);
    const ix = (sx - cam.x) / scale;
    const iy = (sy - cam.y) / scale;
    const x = ix / TILE_W + iy / TILE_H;
    const y = iy / TILE_H - ix / TILE_W;
    return { x, y };
  }

  function handleWorldTap(clientX, clientY) {
    if (mode !== "play") return;
    const p = screenToWorld(clientX, clientY);
    let best = null, bd = 1.35;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      input.atkTarget = best.id;
      input.moveTarget = { x: best.x, y: best.y };
      player.path = pathfind(map, player.x, player.y, best.x, best.y) || [{ x: best.x, y: best.y }];
      player.pathI = 0;
    } else if (walkable(map, p.x, p.y)) {
      input.atkTarget = null;
      input.moveTarget = { x: p.x, y: p.y };
      player.path = pathfind(map, player.x, player.y, p.x, p.y) || [{ x: p.x, y: p.y }];
      player.pathI = 0;
    }
  }

  function bindWorldPointer() {
    let startX = 0, startY = 0, startId = null, moved = false;
    canvas.addEventListener("pointerdown", (e) => {
      if (mode !== "play") return;
      if (e.target !== canvas) return;
      startX = e.clientX; startY = e.clientY; startId = e.pointerId; moved = false;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== startId) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 18) moved = true;
    });
    canvas.addEventListener("pointerup", (e) => {
      if (e.pointerId !== startId) return;
      startId = null;
      if (!moved) handleWorldTap(e.clientX, e.clientY);
    });
  }

  function bindKeys() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat && (e.code === "Space" || e.code === "KeyQ")) e.preventDefault();
      input.keys.add(e.code);
      if (e.code === "Space") { input.attack = true; e.preventDefault(); }
      if (e.code === "KeyQ") { if (mode === "play") castSpell(); e.preventDefault(); }
      if (e.code === "Digit1" || e.code === "Numpad1") usePotion("hp");
      if (e.code === "Digit2" || e.code === "Numpad2") usePotion("mp");
      if (e.code === "Escape") togglePause();
    });
    window.addEventListener("keyup", (e) => {
      input.keys.delete(e.code);
      if (e.code === "Space") input.attack = false;
    });
  }

  /* ---------------- Combat & items ---------------- */
  function usePotion(kind) {
    if (mode !== "play") return;
    if (kind === "hp") {
      if (player.potsHp <= 0 || player.hp >= player.maxHp) return;
      player.potsHp--;
      const heal = Math.round(player.maxHp * 0.45);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      floater(player.x, player.y, `+${heal}`, "#7ae07a");
      burst(player.x, player.y, "#7ae07a", 8);
      sfx.potion();
    } else {
      if (player.potsMp <= 0 || player.mp >= player.maxMp) return;
      player.potsMp--;
      const rec = Math.round(player.maxMp * 0.5);
      player.mp = Math.min(player.maxMp, player.mp + rec);
      floater(player.x, player.y, `+${rec}`, "#7ab0ff");
      burst(player.x, player.y, "#7ab0ff", 8);
      sfx.potion();
    }
    hudDirty = true;
  }

  function slashAttack() {
    if (player.atkCd > 0) return;
    player.atkCd = Math.max(0.32, 0.48 - player.level * 0.008);
    player.attackT = 0.18;
    sfx.slash();
    const range = 1.55;
    const cone = 1.15;
    const fx = Math.cos(player.face), fy = Math.sin(player.face);
    let hits = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > range + e.r) continue;
      const dot = d < 0.01 ? 1 : (dx / d) * fx + (dy / d) * fy;
      if (dot < Math.cos(cone) && d > 0.7) continue;
      const dmg = Math.max(1, playerDmg() + ((Math.random() * 6) | 0) - 2);
      const crit = Math.random() < 0.08 + player.level * 0.004;
      const dealt = crit ? Math.round(dmg * 1.6) : dmg;
      harmEnemy(e, dealt, crit);
      hits++;
    }
    if (hits) sfx.hit();
    const tipX = player.x + fx * 0.8, tipY = player.y + fy * 0.8;
    burst(tipX, tipY, "#f0e0c0", 6);
  }

  function castSpell() {
    if (mode !== "play") return;
    if (player.spellCd > 0 || player.mp < SPELL_MANA) return;
    player.mp -= SPELL_MANA;
    player.spellCd = SPELL_CD;
    sfx.spell();
    toast("Hellevuur!");
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      particles.push({
        x: player.x, y: player.y,
        vx: Math.cos(a) * (2.2 + Math.random()),
        vy: Math.sin(a) * (2.2 + Math.random()),
        life: 0.45 + Math.random() * 0.2,
        max: 0.6, col: Math.random() < 0.4 ? "#ffe08a" : "#ff5a20", r: 0.12,
      });
    }
    const dmg = Math.round(18 + player.level * 6 + player.weapon.dmg * 0.45);
    for (const e of enemies) {
      if (!e.alive) continue;
      if (dist(player.x, player.y, e.x, e.y) <= SPELL_RADIUS + e.r) {
        harmEnemy(e, dmg + ((Math.random() * 8) | 0), false, true);
      }
    }
    hudDirty = true;
  }

  function harmEnemy(e, amount, crit, fire) {
    e.hp -= amount;
    e.hurt = 0.15;
    e.alert = true;
    floater(e.x, e.y - 0.2, (crit ? "!" : "") + amount, crit ? "#ffe07a" : fire ? "#ff8a40" : "#f0e6d4");
    burst(e.x, e.y, fire ? "#ff6a20" : "#a02020", 5);
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.alive = false;
    e.hp = 0;
    run.kills++;
    grantXp(e.xp);
    const gold = 2 + ((Math.random() * (6 + run.floor * 2)) | 0);
    player.gold += gold;
    const rng = Math.random();
    if (rng < 0.22) drops.push({ kind: "gold", n: gold, x: e.x, y: e.y, vy: -1.2, t: 0 });
    if (rng < 0.16) drops.push({ kind: "hp", n: 1, x: e.x + 0.15, y: e.y, vy: -1, t: 0 });
    else if (rng < 0.26) drops.push({ kind: "mp", n: 1, x: e.x - 0.15, y: e.y, vy: -1, t: 0 });
    else if (rng < 0.40) drops.push({ kind: "item", item: pickLoot(run.floor, Math.random), x: e.x, y: e.y + 0.15, vy: -1.1, t: 0 });
    burst(e.x, e.y, e.color, 14);
    sfx.hit();
    hudDirty = true;
  }

  function grantXp(n) {
    player.xp += n;
    while (player.xp >= player.next) {
      player.xp -= player.next;
      player.level++;
      player.next = xpTo(player.level);
      player.maxHp += 16;
      player.maxMp += 6;
      player.hp = player.maxHp;
      player.mp = Math.min(player.maxMp, player.mp + 20);
      toast("Niveau " + player.level + "!");
      floater(player.x, player.y - 0.4, "LEVEL UP", "#e8c547");
      sfx.level();
    }
    hudDirty = true;
  }

  function tryEquip(item) {
    if (item.kind === "weapon") {
      if (item.dmg >= player.weapon.dmg) {
        player.weapon = item;
        lootLine("Nieuw wapen: " + item.name, item.rarity);
        return true;
      }
      lootLine(item.name + " (zwakker, weggelegd)", item.rarity);
      return false;
    }
    if (item.arm >= player.armor.arm) {
      player.armor = item;
      lootLine("Nieuw harnas: " + item.name, item.rarity);
      return true;
    }
    lootLine(item.name + " (zwakker, weggelegd)", item.rarity);
    return false;
  }

  function openChest(c) {
    if (c.open) return;
    c.open = true;
    sfx.open();
    const rng = mulberry32((c.x * 1000 + c.y * 13 + run.seed) | 0);
    const gold = 8 + ((rng() * (12 + run.floor * 4)) | 0);
    player.gold += gold;
    lootLine("Kist: " + gold + " goud", "common");
    if (rng() < 0.7) drops.push({ kind: "item", item: pickLoot(run.floor + 1, rng), x: c.x, y: c.y, vy: -1.4, t: 0 });
    if (rng() < 0.5) drops.push({ kind: "hp", n: 1, x: c.x + 0.3, y: c.y, vy: -1, t: 0 });
    if (rng() < 0.5) drops.push({ kind: "mp", n: 1, x: c.x - 0.3, y: c.y, vy: -1, t: 0 });
    burst(c.x, c.y, "#e8c547", 12);
    hudDirty = true;
  }

  /* ---------------- FX / UI text ---------------- */
  function burst(x, y, col, n) {
    for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 2.2;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.3, max: 0.5, col, r: 0.08 + Math.random() * 0.06 });
    }
  }
  function floater(x, y, text, col) {
    floaters.push({ x, y, text, col, life: 0.85 });
  }
  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }
  function lootLine(msg, rarity) {
    const el = document.createElement("div");
    el.className = "loot-line " + (rarity || "common");
    el.textContent = msg;
    ui.loot.appendChild(el);
    setTimeout(() => el.remove(), 2400);
    sfx.pickup();
  }

  /* ---------------- Game flow ---------------- */
  function startRun(fresh) {
    if (fresh || !player) {
      player = defaultPlayer();
      run = { floor: 1, seed: (Math.random() * 1e9) | 0, kills: 0, deepest: 1, started: Date.now(), time: 0 };
    }
    loadFloor(run.floor, run.seed + run.floor * 9176);
    mode = "play";
    showPlayUI(true);
    ui.title.hidden = true;
    ui.install.hidden = true;
    ui.pause.hidden = true;
    ui.death.hidden = true;
    toast("Verdieping " + run.floor);
    if (run.floor === 1 && player.level === 1) {
      setTimeout(() => toast("Joystick links · Aanval & spreuk rechts"), 700);
    }
    updatePortraitHint();
    save();
  }

  function loadFloor(floor, seed) {
    map = generateFloor(floor, seed);
    enemies = map.enemies;
    drops = [];
    particles = [];
    projectiles = [];
    floaters = [];
    player.x = map.spawn.x;
    player.y = map.spawn.y;
    player.path = null;
    input.moveTarget = null;
    input.atkTarget = null;
    camSnap();
    hudDirty = true;
  }

  function nextFloor() {
    sfx.stair();
    run.floor++;
    run.deepest = Math.max(run.deepest, run.floor);
    player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * 0.15));
    player.mp = Math.min(player.maxMp, player.mp + 10);
    loadFloor(run.floor, run.seed + run.floor * 9176);
    toast("Verdieping " + run.floor);
    save();
  }

  function die() {
    if (mode !== "play") return;
    mode = "death";
    sfx.death();
    showPlayUI(false);
    ui.death.hidden = false;
    const mins = Math.floor(run.time / 60);
    const secs = Math.floor(run.time % 60);
    ui.deathSummary.textContent =
      "Je bereikte verdieping " + run.deepest +
      ", versloeg " + run.kills + " vijanden en verzamelde " + player.gold +
      " goud in " + mins + ":" + String(secs).padStart(2, "0") + ".";
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  }

  function togglePause() {
    if (mode === "play") {
      mode = "pause";
      ui.pause.hidden = false;
      renderPauseStats();
      sfx.ui();
    } else if (mode === "pause") {
      mode = "play";
      ui.pause.hidden = true;
    }
  }

  function renderPauseStats() {
    const rows = [
      ["Niveau", player.level],
      ["Verdieping", run.floor],
      ["Leven", player.hp + " / " + player.maxHp],
      ["Mana", player.mp + " / " + player.maxMp],
      ["Wapen", player.weapon.name + " (" + player.weapon.dmg + ")"],
      ["Harnas", player.armor.name + " (" + player.armor.arm + ")"],
      ["Aanval", playerDmg()],
      ["Pantser", playerArm()],
      ["Goud", player.gold],
      ["Kills", run.kills],
      ["Drankjes", player.potsHp + " leven · " + player.potsMp + " mana"],
    ];
    ui.pauseStats.innerHTML = rows.map(([k, v]) => `<div>${k}</div><div><b>${v}</b></div>`).join("");
  }

  function showPlayUI(on) {
    ui.hud.hidden = !on;
    ui.controls.hidden = !on;
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ player, run }));
    } catch (_) {}
    ui.btnContinue.hidden = false;
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.player || !data.run) return false;
      player = Object.assign(defaultPlayer(), data.player);
      run = data.run;
      return true;
    } catch (_) { return false; }
  }

  /* ---------------- Update ---------------- */
  function keyDir() {
    let sx = 0, sy = 0;
    if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) sx -= 1;
    if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) sx += 1;
    if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) sy -= 1;
    if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) sy += 1;
    if (!sx && !sy) return null;
    return joyToWorld(sx, sy);
  }

  function movePlayer(dt) {
    let dir = null;
    if (Math.hypot(input.joyX, input.joyY) > 0.12) {
      dir = joyToWorld(input.joyX, input.joyY);
      player.path = null;
      input.moveTarget = null;
    } else {
      const k = keyDir();
      if (k) {
        dir = k;
        player.path = null;
        input.moveTarget = null;
      }
    }
    if (dir) {
      const step = player.spd * dir.m * dt;
      tryMove(player, dir.x * step, dir.y * step);
      player.face = Math.atan2(dir.y, dir.x);
      return;
    }
    if (player.path && player.path.length) {
      const node = player.path[player.pathI] || player.path[player.path.length - 1];
      const d = dist(player.x, player.y, node.x, node.y);
      if (d < 0.18) {
        player.pathI++;
        if (player.pathI >= player.path.length) {
          player.path = null;
          input.moveTarget = null;
        }
        return;
      }
      const dx = (node.x - player.x) / d, dy = (node.y - player.y) / d;
      const step = player.spd * dt;
      tryMove(player, dx * step, dy * step);
      player.face = Math.atan2(dy, dx);
    }
  }

  function tryMove(ent, dx, dy) {
    const nx = ent.x + dx, ny = ent.y + dy;
    if (canStand(map, nx, ny, ent.r)) { ent.x = nx; ent.y = ny; return; }
    if (canStand(map, nx, ent.y, ent.r)) { ent.x = nx; return; }
    if (canStand(map, ent.x, ny, ent.r)) { ent.y = ny; }
  }

  function nearestEnemy(range) {
    let best = null, bd = range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function updatePlayer(dt) {
    player.atkCd = Math.max(0, player.atkCd - dt);
    player.spellCd = Math.max(0, player.spellCd - dt);
    player.attackT = Math.max(0, player.attackT - dt);
    player.hurt = Math.max(0, player.hurt - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    movePlayer(dt);

    if (input.atkTarget) {
      const t = enemies.find((e) => e.id === input.atkTarget && e.alive);
      if (!t) input.atkTarget = null;
      else if (dist(player.x, player.y, t.x, t.y) <= 1.45 + t.r) {
        player.face = Math.atan2(t.y - player.y, t.x - player.x);
        slashAttack();
      }
    }

    if (input.attack || input.keys.has("Space")) {
      const n = nearestEnemy(1.7);
      if (n) player.face = Math.atan2(n.y - player.y, n.x - player.x);
      slashAttack();
    }

    for (const c of map.chests) {
      if (!c.open && dist(player.x, player.y, c.x, c.y) < 0.7) openChest(c);
    }
    if (dist(player.x, player.y, map.stairs.x, map.stairs.y) < 0.65) nextFloor();

    // pickups
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.t += dt;
      d.vy += 6 * dt;
      if (d.t < 0.35) d.y += d.vy * dt * 0.15;
      if (d.t > 0.2 && dist(player.x, player.y, d.x, d.y) < 0.85) {
        if (d.kind === "gold") { /* already added */ lootLine("+" + d.n + " goud", "common"); }
        else if (d.kind === "hp") { player.potsHp++; lootLine("Levensdrank", "common"); }
        else if (d.kind === "mp") { player.potsMp++; lootLine("Manadrank", "common"); }
        else if (d.kind === "item") tryEquip(d.item);
        drops.splice(i, 1);
        hudDirty = true;
      } else if (d.t > 20) drops.splice(i, 1);
    }
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (!e.alive) continue;
      e.atkCd = Math.max(0, e.atkCd - dt);
      e.hurt = Math.max(0, e.hurt - dt);
      const d = dist(e.x, e.y, player.x, player.y);
      if (d < e.aggro) e.alert = true;
      if (!e.alert) continue;

      const ranged = e.kind === "ranged" || e.kind === "boss";
      const prefer = ranged ? 4.2 : 1.05 + e.r;
      if (d > prefer + 0.15) {
        const dx = (player.x - e.x) / d, dy = (player.y - e.y) / d;
        tryMove(e, dx * e.spd * dt, dy * e.spd * dt);
        e.face = Math.atan2(dy, dx);
      } else if (ranged && d < 3.0) {
        const dx = (e.x - player.x) / d, dy = (e.y - player.y) / d;
        tryMove(e, dx * e.spd * 0.7 * dt, dy * e.spd * 0.7 * dt);
      }
      // simple separation
      for (const o of enemies) {
        if (o === e || !o.alive) continue;
        const dd = dist(e.x, e.y, o.x, o.y);
        const min = e.r + o.r + 0.05;
        if (dd > 0 && dd < min) {
          const p = (min - dd) * 0.5;
          const ux = (e.x - o.x) / dd, uy = (e.y - o.y) / dd;
          tryMove(e, ux * p, uy * p);
        }
      }

      if (e.kind === "ranged" || e.kind === "boss") {
        if (d < 8 && e.atkCd <= 0) {
          e.atkCd = e.kind === "boss" ? 1.5 : 1.7;
          e.face = Math.atan2(player.y - e.y, player.x - e.x);
          const sp = e.kind === "boss" ? 6.2 : 5.4;
          projectiles.push({
            x: e.x, y: e.y,
            vx: Math.cos(e.face) * sp,
            vy: Math.sin(e.face) * sp,
            dmg: e.dmg,
            life: 2.2,
            from: "enemy",
            col: e.kind === "boss" ? "#ff4020" : "#c8a0ff",
          });
          if (e.kind === "boss" && d < 3.4 && Math.random() < 0.45) {
            // close nova
            harmPlayer(Math.round(e.dmg * 0.7));
            burst(e.x, e.y, "#ff4020", 16);
          }
        }
      } else if (d < 0.95 + e.r && e.atkCd <= 0) {
        e.atkCd = 0.9 + Math.random() * 0.3;
        e.face = Math.atan2(player.y - e.y, player.x - e.x);
        harmPlayer(e.dmg);
      }
    }
  }

  function harmPlayer(raw) {
    if (player.invuln > 0) return;
    const reduced = Math.max(1, raw - playerArm() * 0.35);
    const dmg = Math.round(reduced);
    player.hp -= dmg;
    player.hurt = 0.2;
    player.invuln = 0.35;
    floater(player.x, player.y - 0.25, dmg, "#ff6a6a");
    burst(player.x, player.y, "#a01010", 7);
    sfx.hurt();
    hudDirty = true;
    if (player.hp <= 0) {
      player.hp = 0;
      die();
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (!walkable(map, p.x, p.y) || p.life <= 0) {
        projectiles.splice(i, 1);
        continue;
      }
      if (p.from === "enemy" && dist(p.x, p.y, player.x, player.y) < player.r + 0.2) {
        harmPlayer(p.dmg);
        burst(p.x, p.y, p.col, 6);
        projectiles.splice(i, 1);
      }
    }
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      floaters[i].y -= dt * 0.7;
      floaters[i].life -= dt;
      if (floaters[i].life <= 0) floaters.splice(i, 1);
    }
  }

  /* ---------------- Render ---------------- */
  function isoX(x, y) { return (x - y) * (TILE_W / 2); }
  function isoY(x, y) { return (x + y) * (TILE_H / 2); }
  function worldToScreen(x, y) {
    return { x: isoX(x, y) * scale + cam.x, y: isoY(x, y) * scale + cam.y };
  }

  function camSnap() {
    const p = { x: isoX(player.x, player.y) * scale, y: isoY(player.x, player.y) * scale };
    cam.x = cssW / 2 - p.x;
    cam.y = cssH / 2 - p.y + 10;
  }
  function camFollow(dt) {
    const p = { x: isoX(player.x, player.y) * scale, y: isoY(player.x, player.y) * scale };
    const tx = cssW / 2 - p.x;
    const ty = cssH / 2 - p.y + 10;
    const k = 1 - Math.pow(0.0002, dt);
    cam.x = lerp(cam.x, tx, k);
    cam.y = lerp(cam.y, ty, k);
  }

  function resize() {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    let r = Math.min(2, window.devicePixelRatio || 1);
    const px = cssW * cssH * r * r;
    if (px > 2.2e6) r = 1.25;
    if (cssW * cssH * r * r > 2.6e6) r = 1;
    dpr = r;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = clamp(cssW / (14 * TILE_W), 0.72, 1.35);
    if (cssH < 400) scale *= 0.92;
    if (player) camSnap();
    updatePortraitHint();
  }

  function lightAt(x, y) {
    let l = 0.13;
    const pd = dist(x, y, player.x, player.y);
    l += Math.max(0, 1 - pd / 8.5) * 0.85;
    const torches = map.torches;
    for (let i = 0; i < torches.length; i++) {
      const t = torches[i];
      const d = dist(x, y, t.x, t.y);
      if (d < 5) l += Math.max(0, 1 - d / 5) * (0.28 + 0.06 * Math.sin(time * 6 + i));
    }
    return clamp(l, 0.07, 1);
  }

  function shade(rgb, l) {
    return `rgb(${(rgb[0] * l) | 0},${(rgb[1] * l) | 0},${(rgb[2] * l) | 0})`;
  }

  function drawDiamond(x, y, w, h, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x, y + h / 2);
    ctx.lineTo(x - w / 2, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawTile(ix, iy) {
    const t = map.tiles[iy * map.w + ix];
    const s = worldToScreen(ix, iy);
    const tw = TILE_W * scale, th = TILE_H * scale;
    const cx = s.x + tw / 2, cy = s.y + th / 2;
    const l = lightAt(ix + 0.5, iy + 0.5);
    if (t === T_WALL) {
      const wh = WALL_H * scale;
      const left = shade([48, 32, 30], l * 0.7);
      const right = shade([28, 18, 18], l * 0.55);
      const top = shade([72, 52, 46], l);
      ctx.fillStyle = left;
      ctx.beginPath();
      ctx.moveTo(cx - tw / 2, cy);
      ctx.lineTo(cx, cy + th / 2);
      ctx.lineTo(cx, cy + th / 2 - wh);
      ctx.lineTo(cx - tw / 2, cy - wh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = right;
      ctx.beginPath();
      ctx.moveTo(cx + tw / 2, cy);
      ctx.lineTo(cx, cy + th / 2);
      ctx.lineTo(cx, cy + th / 2 - wh);
      ctx.lineTo(cx + tw / 2, cy - wh);
      ctx.closePath();
      ctx.fill();
      drawDiamond(cx, cy - wh, tw, th, top);
    } else {
      const base = t === T_STAIRS ? [90, 70, 48] : ((ix + iy) & 1) ? [62, 48, 42] : [54, 42, 38];
      drawDiamond(cx, cy, tw + 1, th + 1, shade(base, l));
      if (t === T_STAIRS) {
        ctx.strokeStyle = shade([200, 170, 80], l);
        ctx.lineWidth = 1.2;
        drawDiamond(cx, cy, tw * 0.55, th * 0.55, shade([40, 24, 16], l));
        ctx.beginPath();
        ctx.moveTo(cx - 6 * scale, cy);
        ctx.lineTo(cx + 6 * scale, cy);
        ctx.stroke();
      }
    }
  }

  function drawShadow(sx, sy, r) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + 6 * scale, r * TILE_W * 0.35 * scale, r * TILE_H * 0.35 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    const s = worldToScreen(player.x, player.y);
    const k = scale;
    drawShadow(s.x, s.y, player.r + 0.1);
    if (player.hurt > 0) ctx.globalAlpha = 0.7;
    // legs
    ctx.fillStyle = "#2a1a14";
    ctx.fillRect(s.x - 5 * k, s.y - 2 * k, 3.5 * k, 8 * k);
    ctx.fillRect(s.x + 1.5 * k, s.y - 2 * k, 3.5 * k, 8 * k);
    // body / cloak
    ctx.fillStyle = "#4a2018";
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 22 * k);
    ctx.lineTo(s.x + 10 * k, s.y - 4 * k);
    ctx.lineTo(s.x, s.y + 4 * k);
    ctx.lineTo(s.x - 10 * k, s.y - 4 * k);
    ctx.closePath();
    ctx.fill();
    // hood
    ctx.fillStyle = "#1a0c0c";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 20 * k, 7 * k, 8 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a1810";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 18 * k, 4.2 * k, 4.5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#e8c547";
    ctx.beginPath();
    ctx.arc(s.x - 2 * k, s.y - 18 * k, 1.1 * k, 0, Math.PI * 2);
    ctx.arc(s.x + 2 * k, s.y - 18 * k, 1.1 * k, 0, Math.PI * 2);
    ctx.fill();
    // sword
    const swing = player.attackT > 0 ? (0.18 - player.attackT) / 0.18 : 0;
    const ang = player.face;
    // convert face to a loose screen swing
    const sc = worldToScreen(player.x + Math.cos(ang) * 0.15, player.y + Math.sin(ang) * 0.15);
    const dirx = sc.x - s.x, diry = sc.y - s.y;
    const baseA = Math.atan2(diry, dirx) - 0.7 + swing * 1.8;
    const len = 22 * k;
    const hx = s.x + Math.cos(baseA) * 4 * k;
    const hy = s.y - 8 * k + Math.sin(baseA) * 4 * k;
    ctx.strokeStyle = "#d8d0c0";
    ctx.lineWidth = 2.2 * k;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(baseA) * len, hy + Math.sin(baseA) * len);
    ctx.stroke();
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 2.4 * k;
    ctx.beginPath();
    ctx.moveTo(hx - Math.cos(baseA + 1.2) * 4 * k, hy - Math.sin(baseA + 1.2) * 4 * k);
    ctx.lineTo(hx + Math.cos(baseA + 1.2) * 4 * k, hy + Math.sin(baseA + 1.2) * 4 * k);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e) {
    const s = worldToScreen(e.x, e.y);
    const k = scale;
    drawShadow(s.x, s.y, e.r);
    const flash = e.hurt > 0;
    const col = flash ? "#fff0e0" : e.color;
    const h = (18 + e.r * 18) * k;
    const w = (10 + e.r * 14) * k;
    ctx.fillStyle = col;
    ctx.beginPath();
    if (e.kind === "boss") {
      // wide horned body
      ctx.moveTo(s.x, s.y - h - 4 * k);
      ctx.lineTo(s.x + w, s.y - 4 * k);
      ctx.lineTo(s.x + w * 0.4, s.y + 6 * k);
      ctx.lineTo(s.x - w * 0.4, s.y + 6 * k);
      ctx.lineTo(s.x - w, s.y - 4 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1a0808";
      ctx.fillRect(s.x - 10 * k, s.y - h - 2 * k, 6 * k, 10 * k);
      ctx.fillRect(s.x + 4 * k, s.y - h - 2 * k, 6 * k, 10 * k);
      ctx.fillStyle = "#ff3030";
      ctx.beginPath();
      ctx.arc(s.x - 4 * k, s.y - h * 0.55, 2.2 * k, 0, Math.PI * 2);
      ctx.arc(s.x + 4 * k, s.y - h * 0.55, 2.2 * k, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "rat") {
      ctx.ellipse(s.x, s.y - 4 * k, w * 0.7, h * 0.28, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(s.x, s.y - h);
      ctx.lineTo(s.x + w * 0.7, s.y - 2 * k);
      ctx.lineTo(s.x, s.y + 5 * k);
      ctx.lineTo(s.x - w * 0.7, s.y - 2 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = e.type === "skel" || e.type === "archer" ? "#1a1010" : "#ffd0a0";
      if (e.type === "skel" || e.type === "archer") ctx.fillStyle = "#f0e8d8";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - h + 4 * k, 4.2 * k, 4.6 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.type === "imp" ? "#ffee55" : "#801010";
      ctx.beginPath();
      ctx.arc(s.x - 1.8 * k, s.y - h + 4 * k, 1.1 * k, 0, Math.PI * 2);
      ctx.arc(s.x + 1.8 * k, s.y - h + 4 * k, 1.1 * k, 0, Math.PI * 2);
      ctx.fill();
      if (e.type === "archer" || e.type === "shaman") {
        ctx.strokeStyle = e.type === "shaman" ? "#c8a0ff" : "#8a6a40";
        ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.arc(s.x + 8 * k, s.y - 8 * k, 6 * k, -1, 1);
        ctx.stroke();
      }
    }
    // hp bar if damaged or alert
    if (e.hp < e.maxHp || e.alert) {
      const bw = Math.max(16, 22 * k + e.r * 10);
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(s.x - bw / 2, s.y - h - 8 * k, bw, 3.2 * k);
      ctx.fillStyle = "#c42b2b";
      ctx.fillRect(s.x - bw / 2, s.y - h - 8 * k, bw * clamp(e.hp / e.maxHp, 0, 1), 3.2 * k);
    }
  }

  function drawChest(c) {
    const s = worldToScreen(c.x, c.y);
    const k = scale;
    drawShadow(s.x, s.y, 0.3);
    ctx.fillStyle = c.open ? "#4a3020" : "#c9a227";
    ctx.fillRect(s.x - 7 * k, s.y - 8 * k, 14 * k, 10 * k);
    ctx.fillStyle = c.open ? "#2a1810" : "#8a6020";
    ctx.fillRect(s.x - 7 * k, s.y - 12 * k, 14 * k, 5 * k);
    if (!c.open) {
      ctx.fillStyle = "#e8c547";
      ctx.fillRect(s.x - 1.2 * k, s.y - 8 * k, 2.4 * k, 5 * k);
    }
  }

  function drawDrop(d) {
    const s = worldToScreen(d.x, d.y);
    const k = scale;
    const bob = Math.sin((d.t + d.x) * 6) * 2 * k;
    if (d.kind === "gold") {
      ctx.fillStyle = "#e8c547";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y - 6 * k + bob, 4 * k, 3 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.kind === "hp" || d.kind === "mp") {
      ctx.fillStyle = d.kind === "hp" ? "#c42b2b" : "#3a7ad9";
      ctx.fillRect(s.x - 3.5 * k, s.y - 12 * k + bob, 7 * k, 9 * k);
      ctx.fillStyle = "#f0e6d4";
      ctx.fillRect(s.x - 1 * k, s.y - 10 * k + bob, 2 * k, 5 * k);
    } else {
      const col = d.item.rarity === "legendary" ? "#ff8a2a" : d.item.rarity === "rare" ? "#f0d878" : d.item.rarity === "magic" ? "#6ea8ff" : "#c8c0b0";
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 16 * k + bob);
      ctx.lineTo(s.x + 5 * k, s.y - 4 * k + bob);
      ctx.lineTo(s.x, s.y - 1 * k + bob);
      ctx.lineTo(s.x - 5 * k, s.y - 4 * k + bob);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMinimap() {
    const mw = 96, mh = 96;
    const x = cssW - mw - 12 - 8;
    const y = 58;
    ctx.fillStyle = "rgba(8,4,4,0.7)";
    ctx.fillRect(x - 2, y - 2, mw + 4, mh + 4);
    const sx = mw / map.w, sy = mh / map.h;
    for (let iy = 0; iy < map.h; iy++) {
      for (let ix = 0; ix < map.w; ix++) {
        const t = map.tiles[iy * map.w + ix];
        if (t === T_WALL) continue;
        ctx.fillStyle = t === T_STAIRS ? "#e8c547" : "#4a3830";
        ctx.fillRect(x + ix * sx, y + iy * sy, sx + 0.5, sy + 0.5);
      }
    }
    ctx.fillStyle = "#6ae06a";
    ctx.fillRect(x + player.x * sx - 1.5, y + player.y * sy - 1.5, 3, 3);
    ctx.fillStyle = "#e05050";
    for (const e of enemies) {
      if (!e.alive) continue;
      ctx.fillRect(x + e.x * sx - 1, y + e.y * sy - 1, 2, 2);
    }
  }

  function draw() {
    ctx.fillStyle = "#0b0708";
    ctx.fillRect(0, 0, cssW, cssH);
    if (!map || !player) return;

    const margin = 2;
    // visible tile bounds from screen corners
    const corners = [
      screenToWorld(0, 0),
      screenToWorld(cssW, 0),
      screenToWorld(0, cssH),
      screenToWorld(cssW, cssH),
    ];
    // screenToWorld uses client coords; use canvas local via cam
    function s2w(sx, sy) {
      const ix = (sx - cam.x) / scale;
      const iy = (sy - cam.y) / scale;
      return { x: ix / TILE_W + iy / TILE_H, y: iy / TILE_H - ix / TILE_W };
    }
    const c0 = s2w(-40, -40), c1 = s2w(cssW + 40, -40), c2 = s2w(-40, cssH + 80), c3 = s2w(cssW + 40, cssH + 80);
    const minX = clamp(Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x)) - 1, 0, map.w - 1);
    const maxX = clamp(Math.ceil(Math.max(c0.x, c1.x, c2.x, c3.x)) + 1, 0, map.w - 1);
    const minY = clamp(Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y)) - 1, 0, map.h - 1);
    const maxY = clamp(Math.ceil(Math.max(c0.y, c1.y, c2.y, c3.y)) + 1, 0, map.h - 1);

    // floors first (all visible), then walls by depth, entities interleave
    const walls = [];
    for (let iy = minY; iy <= maxY; iy++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (map.tiles[iy * map.w + ix] === T_WALL) walls.push(ix + iy);
        else drawTile(ix, iy);
      }
    }
    // collect depth-sorted sprites + remaining walls
    const sprites = [];
    for (let iy = minY; iy <= maxY; iy++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (map.tiles[iy * map.w + ix] === T_WALL) sprites.push({ depth: ix + iy, wall: true, ix, iy });
      }
    }
    for (const c of map.chests) sprites.push({ depth: c.x + c.y, chest: c });
    for (const d of drops) sprites.push({ depth: d.x + d.y, drop: d });
    for (const e of enemies) if (e.alive) sprites.push({ depth: e.x + e.y, enemy: e });
    sprites.push({ depth: player.x + player.y, player: true });
    for (const p of projectiles) sprites.push({ depth: p.x + p.y, proj: p });
    sprites.sort((a, b) => a.depth - b.depth);
    for (const s of sprites) {
      if (s.wall) drawTile(s.ix, s.iy);
      else if (s.chest) drawChest(s.chest);
      else if (s.drop) drawDrop(s.drop);
      else if (s.enemy) drawEnemy(s.enemy);
      else if (s.player) drawPlayer();
      else if (s.proj) {
        const p = worldToScreen(s.proj.x, s.proj.y);
        ctx.fillStyle = s.proj.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 8 * scale, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // particles + floaters on top
    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = clamp(p.life / (p.max || 0.5), 0, 1);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(s.x, s.y - 8 * scale, Math.max(1.2, p.r * TILE_W * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = `bold ${Math.round(13 * scale + 2)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floaters) {
      const s = worldToScreen(f.x, f.y);
      ctx.globalAlpha = clamp(f.life / 0.4, 0, 1);
      ctx.fillStyle = "#000";
      ctx.fillText(f.text, s.x + 1, s.y - 28 * scale + 1);
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, s.x, s.y - 28 * scale);
    }
    ctx.globalAlpha = 1;
    drawMinimap();

    // title-screen backdrop dungeon hint (idle)
  }

  function drawTitleBg(dt) {
    if (!map) {
      // lightweight smoke
      ctx.fillStyle = "#0b0708";
      ctx.fillRect(0, 0, cssW, cssH);
      const g = ctx.createRadialGradient(cssW * 0.5, cssH * 0.85, 10, cssW * 0.5, cssH * 0.7, cssW * 0.6);
      g.addColorStop(0, "rgba(120,20,16,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
      return;
    }
    camFollow(dt);
    draw();
  }

  function refreshHud() {
    if (!player) return;
    ui.hpFill.style.width = (100 * player.hp / player.maxHp) + "%";
    ui.mpFill.style.width = (100 * player.mp / player.maxMp) + "%";
    ui.xpFill.style.width = (100 * player.xp / player.next) + "%";
    ui.hpText.textContent = player.hp + "/" + player.maxHp;
    ui.mpText.textContent = player.mp + "/" + player.maxMp;
    ui.level.textContent = player.level;
    ui.floor.textContent = "Verdieping " + run.floor;
    ui.gold.textContent = player.gold;
    ui.hpCount.textContent = player.potsHp;
    ui.mpCount.textContent = player.potsMp;
    ui.hpBtn.classList.toggle("empty", player.potsHp <= 0);
    ui.mpBtn.classList.toggle("empty", player.potsMp <= 0);
    const cd = player.spellCd / SPELL_CD;
    ui.spellCd.style.clipPath = cd > 0 ? `inset(${(1 - cd) * 100}% 0 0 0)` : "inset(100% 0 0 0)";
    ui.spellBtn.classList.toggle("ready", player.spellCd <= 0 && player.mp >= SPELL_MANA);
    ui.spellBtn.disabled = player.spellCd > 0 || player.mp < SPELL_MANA;
    hudDirty = false;
  }

  /* ---------------- Loop ---------------- */
  let last = performance.now();
  let saveAcc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === "play") {
      time += dt;
      run.time += dt;
      updatePlayer(dt);
      updateEnemies(dt);
      updateProjectiles(dt);
      updateFx(dt);
      camFollow(dt);
      draw();
      saveAcc += dt;
      if (saveAcc > 5) { saveAcc = 0; save(); }
      if (hudDirty || (now / 100 | 0) % 3 === 0) refreshHud();
    } else if (mode === "pause" || mode === "death") {
      draw();
    } else {
      time += dt;
      drawTitleBg(dt);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- Portrait / PWA ---------------- */
  function isTouchPreferred() {
    return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  }
  function updatePortraitHint() {
    const portrait = window.innerHeight > window.innerWidth * 1.12;
    const show = portrait && isTouchPreferred() && !ignorePortrait && (mode === "play" || mode === "pause");
    ui.rotate.hidden = !show;
  }

  function setupPwa() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    function maybeShowInstall() {
      if (standalone || sessionStorage.getItem("sc-hide-install")) return;
      if (mode !== "title") return;
      if (deferredPrompt) {
        ui.install.hidden = false;
        $("btn-install").hidden = false;
        ui.installText.textContent = "Installeer Schaduwcrypte op je startscherm.";
      }
    }
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      maybeShowInstall();
    });
    $("btn-install").addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => {});
        deferredPrompt = null;
        ui.install.hidden = true;
      }
    });
    $("btn-install-dismiss").addEventListener("click", () => {
      ui.install.hidden = true;
      sessionStorage.setItem("sc-hide-install", "1");
    });
    // Manual hint on Android Chrome if no event arrives
    setTimeout(() => {
      if (standalone || deferredPrompt || sessionStorage.getItem("sc-hide-install")) return;
      const ua = navigator.userAgent || "";
      if (/Android/i.test(ua) && /Chrome/i.test(ua) && mode === "title") {
        ui.install.hidden = false;
        ui.installText.textContent = "In Chrome: menu ⋮ → Toevoegen aan startscherm.";
        $("btn-install").hidden = true;
      }
    }, 2500);
  }

  /* ---------------- Bind UI ---------------- */
  function bindUI() {
    $("btn-play").addEventListener("click", () => { ensureAudio(); sfx.ui(); startRun(true); });
    $("btn-continue").addEventListener("click", () => { ensureAudio(); sfx.ui(); startRun(false); });
    $("btn-pause").addEventListener("click", () => togglePause());
    $("btn-resume").addEventListener("click", () => togglePause());
    $("btn-restart").addEventListener("click", () => { ensureAudio(); startRun(true); });
    $("btn-again").addEventListener("click", () => { ensureAudio(); startRun(true); });
    $("btn-title").addEventListener("click", () => {
      mode = "title";
      ui.death.hidden = true;
      ui.title.hidden = false;
      showPlayUI(false);
      ui.btnContinue.hidden = true;
      if (!sessionStorage.getItem("sc-hide-install") && (deferredPrompt || /Android/i.test(navigator.userAgent))) {
        ui.install.hidden = false;
      }
    });
    $("btn-anyway").addEventListener("click", () => { ignorePortrait = true; updatePortraitHint(); });
    holdButton(ui.atkBtn, () => { input.attack = true; ensureAudio(); }, () => { input.attack = false; });
    ui.spellBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); ensureAudio(); castSpell(); });
    ui.hpBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); usePotion("hp"); });
    ui.mpBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); usePotion("mp"); });
    bindJoystick();
    bindWorldPointer();
    bindKeys();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 80));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && mode === "play") togglePause();
    });
    window.addEventListener("pointerdown", () => ensureAudio(), { once: true });
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ---------------- Boot ---------------- */
  bindUI();
  setupPwa();
  resize();
  if (loadSave()) ui.btnContinue.hidden = false;
  requestAnimationFrame(frame);
})();
