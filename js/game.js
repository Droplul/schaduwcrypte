(() => {
  "use strict";

  const TILE_W = 64;
  const TILE_H = 32;
  const WALL_H = 18;
  const SAVE_KEY = "schaduwcrypte-save-v2";
  const SPELL_CD = 6;
  const SPELL_MANA = 24;
  const SPELL_RADIUS = 3.1;
  const MAX_PARTICLES = 120;

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
    hpOrb: document.querySelector(".orb-hp"),
    mpOrb: document.querySelector(".orb-mp"),
    spellLabel: $("spell-label"),
    skill2: $("btn-skill2"),
    skill2Cd: $("skill2-cd"),
    skill2Label: $("skill2-label"),
    hudClass: $("hud-class"),
    classScreen: $("class-screen"),
    classRow: $("class-row"),
    skillScreen: $("skill-screen"),
    skillGrid: $("skill-grid"),
    skillPoints: $("skill-points"),
    muteBtn: $("btn-mute"),
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
  let actx = null, master = null, muted = localStorage.getItem("sc-muted") === "1", musicStarted = false;
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
    startMusic();
    applyMute();
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

  function applyMute() {
    if (master) master.gain.value = muted ? 0 : 0.2;
    if (ui && ui.muteBtn) ui.muteBtn.classList.toggle("muted", muted);
    try { localStorage.setItem("sc-muted", muted ? "1" : "0"); } catch (_) {}
  }
  function toggleMute() {
    muted = !muted;
    ensureAudio();
    applyMute();
  }
  function startMusic() {
    if (!actx || musicStarted) return;
    musicStarted = true;
    const filt = actx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 280;
    filt.Q.value = 0.7;
    filt.connect(master);
    const lfo = actx.createOscillator();
    const lfoG = actx.createGain();
    lfo.frequency.value = 0.07;
    lfoG.gain.value = 80;
    lfo.connect(lfoG);
    lfoG.connect(filt.frequency);
    lfo.start();
    function drone(freq, type, vol) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g);
      g.connect(filt);
      o.start();
    }
    drone(55, "sine", 0.18);
    drone(82.5, "triangle", 0.08);
    drone(110, "sine", 0.04);
    const notes = [110, 130.8, 146.8, 164.8, 196, 146.8, 130.8, 110];
    let step = 0;
    function motif() {
      if (!actx) return;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = "sine";
      o.frequency.value = notes[step % notes.length];
      const t = actx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g);
      g.connect(filt);
      o.start(t);
      o.stop(t + 1.5);
      step++;
    }
    motif();
    setInterval(motif, 1800);
    applyMute();
  }

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


  /* ---------------- Classes & skills ---------------- */
  const HERO_INDEX = { warrior: 0, mage: 1, hunter: 2 };
  const MONSTER_INDEX = { rat: 0, imp: 1, skel: 2, archer: 3, brute: 4, shaman: 5, boss: 6 };
  const ANIM = { idle: { col: 0, frames: 4, spd: 0.22 }, walk: { col: 4, frames: 6, spd: 0.1 }, attack: { col: 10, frames: 6, spd: 0.06 }, death: { col: 16, frames: 6, spd: 0.11 } };
  const FW = 48, FH = 64;
  const images = {};
  let assetsReady = false;

  const CLASSES = {
    warrior: {
      id: "warrior", name: "Strijder", role: "Melee",
      blurb: "Zwaardvechter met zwaar harnas. Sterk in het gedrang.",
      hp: 140, mp: 40, spd: 4.05,
      weapon: { name: "Krijgszwaard", dmg: 13, rarity: "common", kind: "weapon" },
      armor: { name: "Leren harnas", arm: 5, rarity: "common", kind: "armor" },
      potsHp: 2, potsMp: 1,
      basic: "slash", startSkill: "cleave",
    },
    mage: {
      id: "mage", name: "Tovenaar", role: "Spreuken",
      blurb: "Meester van Hellevuur. Blijf op afstand en verbrand alles.",
      hp: 85, mp: 110, spd: 4.0,
      weapon: { name: "Adeptstaf", dmg: 7, rarity: "common", kind: "weapon" },
      armor: { name: "Novicenmantel", arm: 2, rarity: "common", kind: "armor" },
      potsHp: 1, potsMp: 2,
      basic: "bolt", startSkill: "fireball",
    },
    hunter: {
      id: "hunter", name: "Jager", role: "Boog",
      blurb: "Snel en precies. Houd afstand en doorboor je prooi.",
      hp: 105, mp: 55, spd: 4.55,
      weapon: { name: "Jagersboog", dmg: 11, rarity: "common", kind: "weapon" },
      armor: { name: "Leren harnas", arm: 4, rarity: "common", kind: "armor" },
      potsHp: 2, potsMp: 1,
      basic: "bow", startSkill: "multishot",
    },
  };

  const SKILLS = {
    might:   { cls: "warrior", name: "Kracht", type: "passive", max: 3, mana: 0, cd: 0, desc: "+4 aanval per rang." },
    hide:    { cls: "warrior", name: "Pantserhuid", type: "passive", max: 3, mana: 0, cd: 0, desc: "+3 pantser per rang." },
    vigor:   { cls: "warrior", name: "Levenskracht", type: "passive", max: 3, mana: 0, cd: 0, desc: "+18 max. leven per rang." },
    cleave:  { cls: "warrior", name: "Klieving", type: "active", max: 3, mana: 12, cd: 5, slot: 1, desc: "Rondomhouw die alle nabije vijanden raakt." },
    shout:   { cls: "warrior", name: "Oorlogskreet", type: "active", max: 2, mana: 16, cd: 8, slot: 2, req: { cleave: 1 }, desc: "Schokgolf plus korte schadestoot." },
    berserk: { cls: "warrior", name: "Berserker", type: "passive", max: 2, mana: 0, cd: 0, req: { might: 2 }, desc: "Snellere basisaanvallen." },
    fireball:{ cls: "mage", name: "Hellevuur", type: "active", max: 3, mana: 22, cd: 5.5, slot: 1, desc: "Vuurbal met gloed en explosie." },
    frost:   { cls: "mage", name: "IJslans", type: "active", max: 3, mana: 16, cd: 4, slot: 2, req: { fireball: 1 }, desc: "Koude lans die vijanden vertraagt." },
    arcane:  { cls: "mage", name: "Arcane kracht", type: "passive", max: 3, mana: 0, cd: 0, desc: "+22% spreukschade per rang." },
    well:    { cls: "mage", name: "Manabron", type: "passive", max: 3, mana: 0, cd: 0, desc: "+15 max. mana per rang." },
    flash:   { cls: "mage", name: "Flits", type: "passive", max: 2, mana: 0, cd: 0, req: { well: 1 }, desc: "Kortere spreuk-afkoeling." },
    nova:    { cls: "mage", name: "Vlammennova", type: "passive", max: 1, mana: 0, cd: 0, req: { fireball: 2, arcane: 1 }, desc: "Hellevuur explodeert in een grotere cirkel." },
    multishot:{cls: "hunter", name: "Multischot", type: "active", max: 3, mana: 14, cd: 5, slot: 1, desc: "Drie pijlen in een waaier." },
    trap:    { cls: "hunter", name: "Valstrik", type: "active", max: 2, mana: 18, cd: 9, slot: 2, req: { multishot: 1 }, desc: "Zet een val die ontploft bij nabije vijanden." },
    sharp:   { cls: "hunter", name: "Scherpschutter", type: "passive", max: 3, mana: 0, cd: 0, desc: "+6% kans op kritiek per rang." },
    swift:   { cls: "hunter", name: "Wendbaarheid", type: "passive", max: 3, mana: 0, cd: 0, desc: "+8% loopsnelheid per rang." },
    mark:    { cls: "hunter", name: "Jagersmarkering", type: "passive", max: 2, mana: 0, cd: 0, req: { sharp: 1 }, desc: "+12% schade op aangeslagen vijanden per rang." },
    pierce:  { cls: "hunter", name: "Doorboring", type: "passive", max: 1, mana: 0, cd: 0, req: { multishot: 2 }, desc: "Pijlen gaan door een extra vijand." },
  };

  function skillRank(id) { return (player && player.skills && player.skills[id]) || 0; }
  function skillReady(id) {
    const s = SKILLS[id];
    if (!s || !s.req) return true;
    return Object.keys(s.req).every((k) => skillRank(k) >= s.req[k]);
  }
  function slotSkill(slot) {
    if (!player) return null;
    let found = null;
    for (const id of Object.keys(SKILLS)) {
      const s = SKILLS[id];
      if (s.cls === player.classId && s.type === "active" && s.slot === slot && skillRank(id) > 0) found = id;
    }
    return found;
  }

  function dirFromFace(ang) {
    const t = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.round(t / (Math.PI / 2)) % 4;
  }
  function tickAnim(ent, dt, moving) {
    if (!ent.anim) ent.anim = "idle";
    if (ent.anim === "death") {
      ent.animT = (ent.animT || 0) + dt;
      ent.animF = Math.min(5, Math.floor(ent.animT / ANIM.death.spd));
      return;
    }
    if (ent.anim === "attack") {
      ent.animT = (ent.animT || 0) + dt;
      ent.animF = Math.min(5, Math.floor(ent.animT / ANIM.attack.spd));
      if (ent.animT > ANIM.attack.spd * 6) {
        ent.anim = moving ? "walk" : "idle";
        ent.animT = 0;
        ent.animF = 0;
      }
      return;
    }
    const next = moving ? "walk" : "idle";
    if (ent.anim !== next) { ent.anim = next; ent.animT = 0; }
    ent.animT = (ent.animT || 0) + dt;
    const a = ANIM[ent.anim];
    ent.animF = Math.floor(ent.animT / a.spd) % a.frames;
  }
  function startAttackAnim(ent) {
    ent.anim = "attack";
    ent.animT = 0;
    ent.animF = 0;
    ent.attackT = 0.36;
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
  let cam = { x: 0, y: 0, shake: 0 };
  let traps = [];
  let lightCvs = null, lightCtx = null;
  let scale = 1;
  let dpr = 1;
  let cssW = 1, cssH = 1;
  let time = 0;
  let run = { floor: 1, seed: 1, kills: 0, deepest: 1, started: 0, time: 0 };
  let ignorePortrait = false;
  let deferredPrompt = null;
  let hudDirty = true;

  function defaultPlayer(classId) {
    const c = CLASSES[classId] || CLASSES.warrior;
    const skills = {};
    if (c.startSkill) skills[c.startSkill] = 1;
    return {
      classId: c.id,
      x: 2, y: 2, r: 0.34,
      hp: c.hp, maxHp: c.hp,
      mp: c.mp, maxMp: c.mp,
      xp: 0, next: 60, level: 1,
      gold: 0,
      potsHp: c.potsHp, potsMp: c.potsMp,
      weapon: { ...c.weapon },
      armor: { ...c.armor },
      atkCd: 0, spellCd: 0, skill2Cd: 0,
      face: 0, spd: c.spd,
      attackT: 0, hurt: 0, invuln: 0,
      path: null, pathI: 0,
      anim: "idle", animT: 0, animF: 0,
      skills, skillPoints: 0,
      buffT: 0, buffDmg: 0,
      moving: false,
    };
  }

  function playerDmg() {
    let d = player.weapon.dmg + 3 + player.level * 2 + skillRank("might") * 4;
    if (player.buffT > 0) d += player.buffDmg;
    return d;
  }
  function playerArm() {
    return player.armor.arm + Math.floor(player.level * 0.4) + skillRank("hide") * 3;
  }
  function playerSpd() {
    const base = (CLASSES[player.classId] || CLASSES.warrior).spd;
    return base * (1 + skillRank("swift") * 0.08);
  }
  function playerCrit() {
    return 0.08 + player.level * 0.004 + skillRank("sharp") * 0.06;
  }
  function spellPower() {
    return 1 + skillRank("arcane") * 0.22;
  }
  function cdFactor() {
    const bers = 1 - skillRank("berserk") * 0.12;
    const fl = 1 - skillRank("flash") * 0.12;
    return { atk: Math.max(0.6, bers), spell: Math.max(0.65, fl) };
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
      if (e.code === "KeyQ") { if (mode === "play") useSkill(1); e.preventDefault(); }
      if (e.code === "KeyE") { if (mode === "play") useSkill(2); e.preventDefault(); }
      if (e.code === "KeyT") { if (mode === "play" || mode === "pause") openSkills(); e.preventDefault(); }
      if (e.code === "KeyM") { toggleMute(); e.preventDefault(); }
      if (e.code === "Digit1" || e.code === "Numpad1") usePotion("hp");
      if (e.code === "Digit2" || e.code === "Numpad2") usePotion("mp");
      if (e.code === "Escape") {
        if (ui.skillScreen && !ui.skillScreen.hidden) closeSkills();
        else togglePause();
      }
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
    const cdf = cdFactor();
    const basic = (CLASSES[player.classId] || CLASSES.warrior).basic;
    player.atkCd = Math.max(0.28, 0.48 - player.level * 0.008) * cdf.atk;
    startAttackAnim(player);
    sfx.slash();
    if (basic === "slash") doSlash();
    else if (basic === "bow") shootArrow(player.face, playerDmg(), 1);
    else if (basic === "bolt") shootBolt(player.face, Math.round(playerDmg() * 0.85 + 2), "bolt");
  }

  function doSlash() {
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
      const crit = Math.random() < playerCrit();
      const dmg = Math.max(1, playerDmg() + ((Math.random() * 6) | 0) - 2);
      harmEnemy(e, crit ? Math.round(dmg * 1.6) : dmg, crit);
      hits++;
    }
    if (hits) { sfx.hit(); addShake(2); }
    const tipX = player.x + fx * 0.8, tipY = player.y + fy * 0.8;
    burst(tipX, tipY, "#f0e0c0", 6);
  }

  function aimDir() {
    const n = nearestEnemy(10);
    if (n) {
      player.face = Math.atan2(n.y - player.y, n.x - player.x);
    }
    return player.face;
  }

  function shootArrow(ang, dmg, count, spread) {
    const pierce = skillRank("pierce") > 0 ? 1 : 0;
    const n = count || 1;
    const sp = spread || 0.22;
    for (let i = 0; i < n; i++) {
      const a = ang + (n === 1 ? 0 : (i - (n - 1) / 2) * sp);
      projectiles.push({
        x: player.x, y: player.y,
        vx: Math.cos(a) * 8.2, vy: Math.sin(a) * 8.2,
        dmg, life: 1.4, from: "player", typ: "arrow",
        pierce, hits: 0, col: "#e8d0a0", r: 0.14,
      });
    }
  }
  function shootBolt(ang, dmg, typ) {
    const frost = typ === "frost";
    projectiles.push({
      x: player.x, y: player.y,
      vx: Math.cos(ang) * (frost ? 9 : 7.2), vy: Math.sin(ang) * (frost ? 9 : 7.2),
      dmg, life: 1.5, from: "player", typ: typ || "bolt",
      pierce: 0, hits: 0, slow: frost ? 0.45 : 0,
      col: frost ? "#a0e0ff" : "#c8a0ff", r: 0.16, glow: true,
    });
  }
  function shootFireball(ang, dmg) {
    const rad = 2.15 + skillRank("nova") * 1.1 + skillRank("fireball") * 0.15;
    projectiles.push({
      x: player.x, y: player.y,
      vx: Math.cos(ang) * 6.4, vy: Math.sin(ang) * 6.4,
      dmg, life: 1.6, from: "player", typ: "fireball",
      pierce: 0, hits: 0, radius: rad, col: "#ff6a20", r: 0.28, glow: true,
    });
  }
  function explode(x, y, dmg, radius, typ) {
    flameBurst(x, y, typ === "frost" ? 10 : 22);
    addShake(typ === "fireball" ? 6 : 3);
    sfx.spell();
    for (const e of enemies) {
      if (!e.alive) continue;
      if (dist(x, y, e.x, e.y) <= radius + e.r) {
        const fall = 1 - dist(x, y, e.x, e.y) / (radius + 1.2);
        harmEnemy(e, Math.max(1, Math.round(dmg * (0.65 + 0.35 * fall))), false, typ !== "frost");
        if (typ === "frost") e.slowT = 2.2;
      }
    }
  }

  function useSkill(slot) {
    if (mode !== "play") return;
    const id = slotSkill(slot);
    if (!id) return;
    const s = SKILLS[id];
    const cdProp = slot === 2 ? "skill2Cd" : "spellCd";
    if (player[cdProp] > 0 || player.mp < s.mana) return;
    const cdf = cdFactor();
    const rank = skillRank(id);
    player.mp -= s.mana;
    player[cdProp] = (s.cd * (1 - (rank - 1) * 0.08)) * cdf.spell;
    startAttackAnim(player);
    const ang = aimDir();
    const base = playerDmg();
    if (id === "cleave") {
      sfx.slash();
      addShake(3);
      const r = 2.3 + rank * 0.2;
      const dmg = Math.round((base * 0.95 + 8) * (1 + (rank - 1) * 0.25));
      for (const e of enemies) {
        if (!e.alive) continue;
        if (dist(player.x, player.y, e.x, e.y) <= r + e.r) harmEnemy(e, dmg + ((Math.random() * 5) | 0));
      }
      burst(player.x, player.y, "#f0e0c0", 16);
    } else if (id === "shout") {
      sfx.spell();
      addShake(5);
      player.buffT = 4;
      player.buffDmg = 6 + rank * 4;
      toast("Oorlogskreet!");
      explode(player.x, player.y, Math.round(base * 0.55), 2.6, "shout");
    } else if (id === "fireball") {
      sfx.spell();
      toast("Hellevuur!");
      shootFireball(ang, Math.round((18 + player.level * 6 + base * 0.5) * spellPower() * (1 + (rank - 1) * 0.2)));
    } else if (id === "frost") {
      sfx.spell();
      shootBolt(ang, Math.round((14 + player.level * 4 + base * 0.4) * spellPower() * (1 + (rank - 1) * 0.2)), "frost");
    } else if (id === "multishot") {
      sfx.slash();
      shootArrow(ang, Math.round(base * (0.75 + (rank - 1) * 0.12)), 3, 0.28);
    } else if (id === "trap") {
      sfx.open();
      traps.push({ x: player.x, y: player.y, r: 1.15 + rank * 0.2, dmg: Math.round(base * 1.15 + 10), life: 12, armed: 0.35 });
      toast("Val gezet");
    }
    hudDirty = true;
  }

  function castSpell() { useSkill(1); }

  function harmEnemy(e, amount, crit, fire) {
    if (skillRank("mark") && e.hurt > 0) amount = Math.round(amount * (1 + skillRank("mark") * 0.12));
    e.hp -= amount;
    e.hurt = 0.18;
    e.alert = true;
    floater(e.x, e.y - 0.2, (crit ? "!" : "") + amount, crit ? "#ffe07a" : fire ? "#ff8a40" : "#f0e6d4", crit);
    if (fire) flameBurst(e.x, e.y, 6);
    else bloodBurst(e.x, e.y, crit ? 10 : 5);
    if (crit) addShake(2);
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    e.anim = "death";
    e.animT = 0;
    e.animF = 0;
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
      player.skillPoints = (player.skillPoints || 0) + 1;
      toast("Niveau " + player.level + "! +1 vaardigheidspunt");
      floater(player.x, player.y - 0.4, "LEVEL UP", "#e8c547");
      sfx.level();
      burst(player.x, player.y, "#e8c547", 22);
      cam.shake = Math.max(cam.shake, 4);
      levelUpFx(player.x, player.y);
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
  function floater(x, y, text, col, crit) {
    floaters.push({ x, y, text, col, life: crit ? 1.05 : 0.9, crit: !!crit, scale: crit ? 1.35 : 1 });
  }
  function addShake(n) { cam.shake = Math.min(12, (cam.shake || 0) + n); }
  function levelUpFx(x, y) {
    for (let i = 0; i < 24 && particles.length < MAX_PARTICLES; i++) {
      const a = (i / 24) * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, life: 0.8, max: 0.8, col: "#e8c547", r: 0.12, typ: "glow", g: 1 });
    }
    for (let i = 0; i < 10 && particles.length < MAX_PARTICLES; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 0.4, vy: -1.6 - Math.random(), life: 0.9, max: 0.9, col: "#fff0a0", r: 0.08, typ: "glow", g: 1 });
    }
  }
  function bloodBurst(x, y, n) {
    for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.7 + Math.random() * 2.4;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.4, life: 0.35 + Math.random() * 0.3, max: 0.6, col: Math.random() < 0.3 ? "#6a1010" : "#a01818", r: 0.06 + Math.random() * 0.07, typ: "blood", g: 0.8 });
    }
  }
  function flameBurst(x, y, n) {
    for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 2.8;
      const col = Math.random() < 0.35 ? "#ffe08a" : (Math.random() < 0.5 ? "#ff8a20" : "#ff4020");
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: 0.35 + Math.random() * 0.35, max: 0.7, col, r: 0.1 + Math.random() * 0.1, typ: "flame", g: 1 });
    }
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
  function startRun(fresh, classId) {
    if (fresh || !player) {
      player = defaultPlayer(classId || "warrior");
      run = { floor: 1, seed: (Math.random() * 1e9) | 0, kills: 0, deepest: 1, started: Date.now(), time: 0 };
    } else if (!player.classId) {
      player = Object.assign(defaultPlayer("warrior"), player, { classId: "warrior", skills: player.skills || { cleave: 1 }, skillPoints: player.skillPoints || 0 });
    }
    loadFloor(run.floor, run.seed + run.floor * 9176);
    mode = "play";
    showPlayUI(true);
    ui.title.hidden = true;
    ui.install.hidden = true;
    ui.pause.hidden = true;
    ui.death.hidden = true;
    if (ui.classScreen) ui.classScreen.hidden = true;
    if (ui.skillScreen) ui.skillScreen.hidden = true;
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
    traps = [];
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
      ["Klasse", (CLASSES[player.classId] || CLASSES.warrior).name],
      ["Drankjes", player.potsHp + " leven · " + player.potsMp + " mana"],
      ["Skillpunten", player.skillPoints || 0],
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
      const cls = (data.player && data.player.classId) || "warrior";
      player = Object.assign(defaultPlayer(cls), data.player);
      if (!player.skills) player.skills = { [(CLASSES[cls] || CLASSES.warrior).startSkill]: 1 };
      if (player.skillPoints == null) player.skillPoints = 0;
      player.anim = player.anim || "idle";
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
      const step = playerSpd() * dir.m * dt;
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
      const step = playerSpd() * dt;
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
    if (player.dying != null) {
      player.dying -= dt;
      tickAnim(player, dt, false);
      if (player.dying <= 0) die();
      return;
    }
    player.atkCd = Math.max(0, player.atkCd - dt);
    player.spellCd = Math.max(0, player.spellCd - dt);
    player.skill2Cd = Math.max(0, (player.skill2Cd || 0) - dt);
    player.attackT = Math.max(0, player.attackT - dt);
    player.hurt = Math.max(0, player.hurt - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.buffT = Math.max(0, (player.buffT || 0) - dt);
    const was = player.x + "," + player.y;
    movePlayer(dt);

    const basic = (CLASSES[player.classId] || CLASSES.warrior).basic;
    const reach = basic === "slash" ? 1.5 : 7.5;
    if (input.atkTarget) {
      const t = enemies.find((e) => e.id === input.atkTarget && e.alive);
      if (!t) input.atkTarget = null;
      else if (dist(player.x, player.y, t.x, t.y) <= reach + t.r) {
        player.face = Math.atan2(t.y - player.y, t.x - player.x);
        if (basic !== "slash" || dist(player.x, player.y, t.x, t.y) <= 1.5 + t.r) slashAttack();
      }
    }

    if (input.attack || input.keys.has("Space")) {
      const n = nearestEnemy(reach);
      if (n) player.face = Math.atan2(n.y - player.y, n.x - player.x);
      slashAttack();
    }
    player.moving = (player.x + "," + player.y) !== was;
    tickAnim(player, dt, player.moving);

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
      if (!e.alive) {
        tickAnim(e, dt, false);
        continue;
      }
      e.atkCd = Math.max(0, e.atkCd - dt);
      e.hurt = Math.max(0, e.hurt - dt);
      e.slowT = Math.max(0, (e.slowT || 0) - dt);
      const spdMul = e.slowT > 0 ? 0.45 : 1;
      const d = dist(e.x, e.y, player.x, player.y);
      if (d < e.aggro) e.alert = true;
      if (!e.alert) continue;

      const ranged = e.kind === "ranged" || e.kind === "boss";
      const prefer = ranged ? 4.2 : 1.05 + e.r;
      if (d > prefer + 0.15) {
        const dx = (player.x - e.x) / d, dy = (player.y - e.y) / d;
        tryMove(e, dx * e.spd * spdMul * dt, dy * e.spd * spdMul * dt);
        e.face = Math.atan2(dy, dx);
      } else if (ranged && d < 3.0) {
        const dx = (e.x - player.x) / d, dy = (e.y - player.y) / d;
        tryMove(e, dx * e.spd * 0.7 * spdMul * dt, dy * e.spd * 0.7 * spdMul * dt);
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
      const movingE = e.alert;
      if (e.anim !== "attack" && e.atkCd > 0 && e.atkCd < 0.2) startAttackAnim(e);
      tickAnim(e, dt, movingE);
    }
    // traps
    for (let i = traps.length - 1; i >= 0; i--) {
      const t = traps[i];
      t.life -= dt;
      t.armed -= dt;
      if (t.life <= 0) { traps.splice(i, 1); continue; }
      if (t.armed > 0) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (dist(t.x, t.y, e.x, e.y) <= t.r + e.r) {
          explode(t.x, t.y, t.dmg, t.r + 0.4, "fireball");
          traps.splice(i, 1);
          break;
        }
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
    bloodBurst(player.x, player.y, 8);
    addShake(5);
    sfx.hurt();
    hudDirty = true;
    if (player.hp <= 0) {
      player.hp = 0;
      player.anim = "death";
      player.animT = 0;
      player.dying = 0.8;
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.typ === "fireball" && particles.length < MAX_PARTICLES) {
        particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, life: 0.25, max: 0.25, col: Math.random() < 0.4 ? "#ffe08a" : "#ff6a20", r: 0.1, typ: "flame", g: 1 });
      }
      const hitWall = !walkable(map, p.x, p.y);
      if (hitWall || p.life <= 0) {
        if (p.typ === "fireball") explode(p.x, p.y, p.dmg, p.radius || 2.2, "fireball");
        projectiles.splice(i, 1);
        continue;
      }
      if (p.from === "enemy" && dist(p.x, p.y, player.x, player.y) < player.r + 0.22) {
        harmPlayer(p.dmg);
        burst(p.x, p.y, p.col, 6);
        projectiles.splice(i, 1);
        continue;
      }
      if (p.from === "player") {
        let consumed = false;
        for (const e of enemies) {
          if (!e.alive) continue;
          if (dist(p.x, p.y, e.x, e.y) < e.r + 0.28) {
            if (p.typ === "fireball") {
              explode(p.x, p.y, p.dmg, p.radius || 2.2, "fireball");
              consumed = true;
              break;
            }
            const crit = Math.random() < playerCrit();
            harmEnemy(e, crit ? Math.round(p.dmg * 1.6) : p.dmg, crit, p.typ === "frost" ? false : p.glow);
            if (p.slow) e.slowT = 2.2;
            p.hits = (p.hits || 0) + 1;
            if ((p.pierce || 0) < p.hits) consumed = true;
            sfx.hit();
            break;
          }
        }
        if (consumed) projectiles.splice(i, 1);
      }
    }
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.typ === "blood") p.vy += 4.5 * dt;
      if (p.typ === "flame") p.vy -= 1.2 * dt;
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
    if (cam.shake > 0) {
      cam.x += (Math.random() - 0.5) * cam.shake * 2;
      cam.y += (Math.random() - 0.5) * cam.shake * 2;
      cam.shake = Math.max(0, cam.shake - dt * 18);
    }
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

  function tileVariant(ix, iy) {
    return (hashish(ix, iy) + (map.seed || 0)) % 16;
  }
  function hashish(x, y) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
  }

  function drawTile(ix, iy) {
    const t = map.tiles[iy * map.w + ix];
    const s = worldToScreen(ix, iy);
    const tw = TILE_W * scale, th = TILE_H * scale;
    const cx = s.x + tw / 2, cy = s.y + th / 2;
    const tiles = images.tiles;
    ctx.imageSmoothingEnabled = false;
    if (t === T_WALL) {
      const wh = WALL_H * scale;
      const vi = hashish(ix, iy) % 8;
      // left face
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - tw / 2, cy);
      ctx.lineTo(cx, cy + th / 2);
      ctx.lineTo(cx, cy + th / 2 - wh);
      ctx.lineTo(cx - tw / 2, cy - wh);
      ctx.closePath();
      ctx.clip();
      if (tiles) ctx.drawImage(tiles, vi * 64, 4 * 40 + 6, 36, 28, cx - tw / 2, cy - wh, tw / 2 + 2, th / 2 + wh);
      else { ctx.fillStyle = "#302018"; ctx.fill(); }
      ctx.restore();
      // right face
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx + tw / 2, cy);
      ctx.lineTo(cx, cy + th / 2);
      ctx.lineTo(cx, cy + th / 2 - wh);
      ctx.lineTo(cx + tw / 2, cy - wh);
      ctx.closePath();
      ctx.clip();
      if (tiles) ctx.drawImage(tiles, vi * 64 + 28, 5 * 40 + 6, 36, 28, cx, cy - wh, tw / 2 + 2, th / 2 + wh);
      else { ctx.fillStyle = "#1c1010"; ctx.fill(); }
      ctx.restore();
      // top
      if (tiles) ctx.drawImage(tiles, vi * 64, 2 * 40 + 4, 64, 32, cx - tw / 2, cy - wh - th / 2, tw + 1, th + 1);
      else drawDiamond(cx, cy - wh, tw, th, "#4a342c");
    } else if (t === T_STAIRS) {
      if (tiles) ctx.drawImage(tiles, 0, 3 * 40 + 4, 64, 32, cx - tw / 2, cy - th / 2, tw + 1, th + 1);
      else {
        drawDiamond(cx, cy, tw + 1, th + 1, "#5a4430");
        ctx.strokeStyle = "#c8aa50";
        ctx.stroke();
      }
    } else {
      const v = tileVariant(ix, iy);
      const col = v % 8, row = (v / 8) | 0;
      if (tiles) ctx.drawImage(tiles, col * 64, row * 40 + 4, 64, 32, cx - tw / 2, cy - th / 2, tw + 1, th + 1);
      else drawDiamond(cx, cy, tw + 1, th + 1, (ix + iy) & 1 ? "#3e302a" : "#362a26");
    }
  }

  function drawShadow(sx, sy, r) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4 * scale, r * TILE_W * 0.38 * scale, r * TILE_H * 0.32 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function blitChar(sheet, kindIndex, dir, anim, frame, sx, sy, size, flash) {
    if (!sheet) return false;
    const a = ANIM[anim] || ANIM.idle;
    const col = a.col + ((frame || 0) % a.frames);
    const row = kindIndex * 4 + (dir & 3);
    const dw = FW * size, dh = FH * size;
    ctx.imageSmoothingEnabled = false;
    if (flash) ctx.filter = "brightness(1.8)";
    ctx.drawImage(sheet, col * FW, row * FH, FW, FH, Math.round(sx - dw / 2), Math.round(sy - dh + 8 * scale), dw, dh);
    if (flash) ctx.filter = "none";
    return true;
  }

  function drawPlayer() {
    const s = worldToScreen(player.x, player.y);
    drawShadow(s.x, s.y, player.r + 0.12);
    if (player.hurt > 0) ctx.globalAlpha = 0.75;
    const idx = HERO_INDEX[player.classId] || 0;
    const ok = blitChar(images.heroes, idx, dirFromFace(player.face), player.anim || "idle", player.animF || 0, s.x, s.y, scale * 1.15, player.hurt > 0);
    if (!ok) {
      ctx.fillStyle = "#4a2018";
      ctx.beginPath();
      ctx.arc(s.x, s.y - 14 * scale, 8 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e) {
    if (!e.alive && (e.animF || 0) >= 5 && (e.animT || 0) > 0.7) return;
    const s = worldToScreen(e.x, e.y);
    const k = scale * (e.type === "boss" ? 1.45 : e.type === "brute" ? 1.25 : e.type === "rat" ? 0.9 : 1.05);
    drawShadow(s.x, s.y, e.r);
    if (e.hurt > 0) ctx.globalAlpha = 0.8;
    const idx = MONSTER_INDEX[e.type] != null ? MONSTER_INDEX[e.type] : 1;
    const ok = blitChar(images.monsters, idx, dirFromFace(e.face || 0), e.anim || "idle", e.animF || 0, s.x, s.y, k, e.hurt > 0);
    if (!ok) {
      ctx.fillStyle = e.color || "#a03020";
      ctx.beginPath();
      ctx.arc(s.x, s.y - 10 * scale, 7 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (e.alive && (e.hp < e.maxHp || e.alert)) {
      const bw = Math.max(16, 22 * scale + e.r * 10);
      const h = (20 + e.r * 16) * k;
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(s.x - bw / 2, s.y - h - 6 * scale, bw, 3.2 * scale);
      ctx.fillStyle = "#c42b2b";
      ctx.fillRect(s.x - bw / 2, s.y - h - 6 * scale, bw * clamp(e.hp / e.maxHp, 0, 1), 3.2 * scale);
    }
  }

  function drawChest(c) {
    const s = worldToScreen(c.x, c.y);
    const k = scale;
    drawShadow(s.x, s.y, 0.3);
    const tiles = images.tiles;
    if (tiles) {
      const sx = c.open ? 64 * 2 + 16 : 64 + 16;
      const sy = 3 * 40 + 8;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tiles, sx, sy, 32, 28, s.x - 14 * k, s.y - 22 * k, 28 * k, 24 * k);
    } else {
      ctx.fillStyle = c.open ? "#4a3020" : "#c9a227";
      ctx.fillRect(s.x - 7 * k, s.y - 8 * k, 14 * k, 10 * k);
    }
  }

  function drawTorch(t, i) {
    const s = worldToScreen(t.x, t.y);
    const tiles = images.tiles;
    const fr = Math.floor(time * 10 + i * 1.7) % 6;
    if (tiles) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tiles, fr * 28 + 4, 6 * 40 + 2, 24, 40, s.x - 12 * scale, s.y - 34 * scale, 24 * scale, 40 * scale);
    }
  }

  function drawDrop(d) {
    const s = worldToScreen(d.x, d.y);
    const k = scale;
    const bob = Math.sin((d.t + d.x) * 6) * 2 * k;
    const rarity = (d.item && d.item.rarity) || (d.kind === "gold" ? "rare" : "common");
    const glow = rarity === "legendary" ? "#ff8a2a" : rarity === "rare" ? "#f0d878" : rarity === "magic" ? "#6ea8ff" : "#c8c0b0";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(d.t * 8);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 8 * k + bob, (7 + (rarity === "legendary" ? 4 : 0)) * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 16 * k + bob);
      ctx.lineTo(s.x + 5 * k, s.y - 4 * k + bob);
      ctx.lineTo(s.x, s.y - 1 * k + bob);
      ctx.lineTo(s.x - 5 * k, s.y - 4 * k + bob);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawLightOverlay() {
    if (!map || !player) return;
    if (!lightCvs || lightCvs.width !== Math.ceil(cssW) || lightCvs.height !== Math.ceil(cssH)) {
      lightCvs = document.createElement("canvas");
      lightCvs.width = Math.max(1, Math.ceil(cssW));
      lightCvs.height = Math.max(1, Math.ceil(cssH));
      lightCtx = lightCvs.getContext("2d");
    }
    const lctx = lightCtx;
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, cssW, cssH);
    lctx.fillStyle = "rgba(4, 1, 8, 0.8)";
    lctx.fillRect(0, 0, cssW, cssH);
    lctx.globalCompositeOperation = "destination-out";
    const ps = worldToScreen(player.x, player.y);
    let g = lctx.createRadialGradient(ps.x, ps.y - 8 * scale, 18 * scale, ps.x, ps.y - 8 * scale, 170 * scale);
    g.addColorStop(0, "rgba(0,0,0,0.95)");
    g.addColorStop(0.4, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g;
    lctx.fillRect(0, 0, cssW, cssH);
    const torches = map.torches || [];
    for (let i = 0; i < torches.length; i++) {
      const t = torches[i];
      const s = worldToScreen(t.x, t.y);
      if (s.x < -80 || s.y < -80 || s.x > cssW + 80 || s.y > cssH + 80) continue;
      const flick = 1 + 0.12 * Math.sin(time * 9 + i * 2.1) + 0.06 * Math.sin(time * 17 + i);
      const rad = 90 * scale * flick;
      g = lctx.createRadialGradient(s.x, s.y - 16 * scale, 4 * scale, s.x, s.y - 16 * scale, rad);
      g.addColorStop(0, "rgba(0,0,0,0.7)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g;
      lctx.fillRect(s.x - rad, s.y - rad, rad * 2, rad * 2);
    }
    ctx.drawImage(lightCvs, 0, 0);
    // warm glow add
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < torches.length; i++) {
      const t = torches[i];
      const s = worldToScreen(t.x, t.y);
      if (s.x < -40 || s.x > cssW + 40) continue;
      const flick = 0.18 + 0.06 * Math.sin(time * 11 + i);
      const gg = ctx.createRadialGradient(s.x, s.y - 16 * scale, 0, s.x, s.y - 16 * scale, 48 * scale);
      gg.addColorStop(0, `rgba(255, 160, 40, ${flick})`);
      gg.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(s.x, s.y - 16 * scale, 48 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    const pg = ctx.createRadialGradient(ps.x, ps.y - 8 * scale, 0, ps.x, ps.y - 8 * scale, 70 * scale);
    pg.addColorStop(0, "rgba(255, 210, 140, 0.10)");
    pg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(ps.x, ps.y - 8 * scale, 70 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.25, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawMinimap() {
    if (!map) return;
    const mw = 96, mh = 96;
    const x = cssW - mw - 12 - 8;
    const y = 70;
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

    for (let iy = minY; iy <= maxY; iy++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (map.tiles[iy * map.w + ix] !== T_WALL) drawTile(ix, iy);
      }
    }
    const sprites = [];
    for (let iy = minY; iy <= maxY; iy++) {
      for (let ix = minX; ix <= maxX; ix++) {
        if (map.tiles[iy * map.w + ix] === T_WALL) sprites.push({ depth: ix + iy, wall: true, ix, iy });
      }
    }
    for (const c of map.chests) sprites.push({ depth: c.x + c.y, chest: c });
    for (const d of drops) sprites.push({ depth: d.x + d.y, drop: d });
    for (const e of enemies) sprites.push({ depth: e.x + e.y, enemy: e });
    sprites.push({ depth: player.x + player.y, player: true });
    for (const p of projectiles) sprites.push({ depth: p.x + p.y, proj: p });
    (map.torches || []).forEach((t, i) => sprites.push({ depth: t.x + t.y + 0.05, torch: t, ti: i }));
    for (const t of traps) sprites.push({ depth: t.x + t.y, trap: t });
    sprites.sort((a, b) => a.depth - b.depth);
    for (const s of sprites) {
      if (s.wall) drawTile(s.ix, s.iy);
      else if (s.chest) drawChest(s.chest);
      else if (s.drop) drawDrop(s.drop);
      else if (s.enemy) drawEnemy(s.enemy);
      else if (s.player) drawPlayer();
      else if (s.torch) drawTorch(s.torch, s.ti);
      else if (s.trap) {
        const p = worldToScreen(s.trap.x, s.trap.y);
        ctx.strokeStyle = "rgba(180,80,20,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 10 * scale, 6 * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.proj) {
        const p = worldToScreen(s.proj.x, s.proj.y);
        if (s.proj.glow || s.proj.typ === "fireball") {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const rad = (s.proj.typ === "fireball" ? 16 : 8) * scale;
          const gg = ctx.createRadialGradient(p.x, p.y - 8 * scale, 0, p.x, p.y - 8 * scale, rad);
          gg.addColorStop(0, s.proj.typ === "frost" ? "#e8ffff" : "#fff0c0");
          gg.addColorStop(0.4, s.proj.col);
          gg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 8 * scale, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = s.proj.col;
          ctx.beginPath();
          if (s.proj.typ === "arrow") {
            const ang = Math.atan2(s.proj.vy, s.proj.vx);
            const iso = Math.atan2(
              isoY(s.proj.x + Math.cos(ang), s.proj.y + Math.sin(ang)) - isoY(s.proj.x, s.proj.y),
              isoX(s.proj.x + Math.cos(ang), s.proj.y + Math.sin(ang)) - isoX(s.proj.x, s.proj.y)
            );
            ctx.save();
            ctx.translate(p.x, p.y - 8 * scale);
            ctx.rotate(Math.atan2(s.proj.vy + s.proj.vx, s.proj.vx - s.proj.vy));
            ctx.fillRect(-6 * scale, -1 * scale, 12 * scale, 2 * scale);
            ctx.restore();
          } else {
            ctx.arc(p.x, p.y - 8 * scale, 4 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    for (const p of particles) {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = clamp(p.life / (p.max || 0.5), 0, 1);
      if (p.g) ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(s.x, s.y - 8 * scale, Math.max(1.2, p.r * TILE_W * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
    drawLightOverlay();
    ctx.font = `bold ${Math.round(14 * scale + 3)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const f of floaters) {
      const s = worldToScreen(f.x, f.y);
      const sc = (f.scale || 1) * (0.85 + 0.15 * clamp(f.life, 0, 1));
      ctx.save();
      ctx.globalAlpha = clamp(f.life / 0.35, 0, 1);
      ctx.translate(s.x, s.y - 30 * scale);
      ctx.scale(sc, sc);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#000";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    drawVignette();
    drawMinimap();
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
    const hpPct = 100 * player.hp / Math.max(1, player.maxHp);
    const mpPct = 100 * player.mp / Math.max(1, player.maxMp);
    if (ui.hpOrb) ui.hpOrb.style.setProperty("--fill", hpPct + "%");
    if (ui.mpOrb) ui.mpOrb.style.setProperty("--fill", mpPct + "%");
    ui.xpFill.style.height = (100 * player.xp / player.next) + "%";
    ui.hpText.textContent = player.hp + "/" + player.maxHp;
    ui.mpText.textContent = player.mp + "/" + player.maxMp;
    ui.level.textContent = player.level;
    ui.floor.textContent = "Verdieping " + run.floor;
    ui.gold.textContent = player.gold;
    if (ui.hudClass) ui.hudClass.textContent = (CLASSES[player.classId] || CLASSES.warrior).name;
    ui.hpCount.textContent = player.potsHp;
    ui.mpCount.textContent = player.potsMp;
    ui.hpBtn.classList.toggle("empty", player.potsHp <= 0);
    ui.mpBtn.classList.toggle("empty", player.potsMp <= 0);
    const s1 = slotSkill(1);
    const s2 = slotSkill(2);
    const meta1 = s1 ? SKILLS[s1] : null;
    const meta2 = s2 ? SKILLS[s2] : null;
    if (ui.spellLabel) ui.spellLabel.textContent = meta1 ? meta1.name.toUpperCase() : "—";
    const cd1 = meta1 ? player.spellCd / (meta1.cd || 1) : 0;
    ui.spellCd.style.clipPath = cd1 > 0 ? `inset(${(1 - Math.min(1, cd1)) * 100}% 0 0 0)` : "inset(100% 0 0 0)";
    ui.spellBtn.classList.toggle("ready", !!(meta1 && player.spellCd <= 0 && player.mp >= meta1.mana));
    ui.spellBtn.disabled = !meta1 || player.spellCd > 0 || player.mp < meta1.mana;
    if (ui.skill2) {
      ui.skill2.hidden = !meta2;
      if (meta2) {
        ui.skill2Label.textContent = meta2.name.toUpperCase();
        const cd2 = player.skill2Cd / (meta2.cd || 1);
        ui.skill2Cd.style.clipPath = cd2 > 0 ? `inset(${(1 - Math.min(1, cd2)) * 100}% 0 0 0)` : "inset(100% 0 0 0)";
        ui.skill2.disabled = player.skill2Cd > 0 || player.mp < meta2.mana;
      }
    }
    if (ui.muteBtn) ui.muteBtn.classList.toggle("muted", muted);
    const skBtn = $("btn-skills");
    if (skBtn) skBtn.style.boxShadow = player.skillPoints > 0 ? "0 0 10px #e8c547" : "";
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

  function showClassSelect() {
    mode = "class";
    ui.title.hidden = true;
    ui.death.hidden = true;
    ui.pause.hidden = true;
    if (ui.install) ui.install.hidden = true;
    showPlayUI(false);
    ui.classScreen.hidden = false;
    ui.classRow.innerHTML = "";
    for (const id of ["warrior", "mage", "hunter"]) {
      const c = CLASSES[id];
      const card = document.createElement("div");
      card.className = "class-card";
      const cv = document.createElement("canvas");
      cv.width = 96; cv.height = 128;
      const gear = c.weapon.name + " · " + c.armor.name;
      card.innerHTML = `<h3></h3><div class="role"></div><p></p><div class="gear"></div>`;
      card.querySelector("h3").textContent = c.name;
      card.querySelector(".role").textContent = c.role;
      card.querySelector("p").textContent = c.blurb;
      card.querySelector(".gear").textContent = gear;
      card.insertBefore(cv, card.firstChild);
      const btn = document.createElement("button");
      btn.className = "btn primary";
      btn.type = "button";
      btn.textContent = "Kiezen";
      btn.addEventListener("click", () => { ensureAudio(); sfx.ui(); startRun(true, id); });
      card.appendChild(btn);
      ui.classRow.appendChild(card);
      paintClassPreview(cv, id);
    }
  }
  function paintClassPreview(cv, classId) {
    const c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    const idx = HERO_INDEX[classId] || 0;
    const draw = (t) => {
      c.clearRect(0, 0, 96, 128);
      if (!images.heroes) return;
      const a = ANIM.idle;
      const fr = Math.floor(t / 400) % a.frames;
      c.drawImage(images.heroes, (a.col + fr) * FW, idx * 4 * FH, FW, FH, 8, 8, 80, 112);
    };
    draw(0);
    const timer = setInterval(() => {
      if (ui.classScreen.hidden) { clearInterval(timer); return; }
      draw(performance.now());
    }, 200);
  }

  function openSkills() {
    if (!player) return;
    if (mode === "play") mode = "pause";
    ui.pause.hidden = true;
    ui.skillScreen.hidden = false;
    renderSkills();
    sfx.ui();
  }
  function closeSkills() {
    ui.skillScreen.hidden = true;
    if (mode === "pause") {
      // stay paused if pause screen was the origin; otherwise resume
      ui.pause.hidden = false;
    }
  }
  function renderSkills() {
    const pts = player.skillPoints || 0;
    ui.skillPoints.textContent = "Beschikbare punten: " + pts;
    ui.skillGrid.innerHTML = "";
    const ids = Object.keys(SKILLS).filter((id) => SKILLS[id].cls === player.classId);
    for (const id of ids) {
      const s = SKILLS[id];
      const rank = skillRank(id);
      const ready = skillReady(id);
      const card = document.createElement("div");
      card.className = "skill-card" + (ready ? "" : " locked");
      const h = document.createElement("h3");
      h.textContent = s.name;
      const r = document.createElement("div");
      r.className = "rank";
      r.textContent = "Rang " + rank + " / " + s.max + (s.type === "active" ? " · actief" : " · passief");
      const p = document.createElement("p");
      p.textContent = s.desc + (s.req && !ready ? " (eerst een voorgaande skill)" : "");
      card.appendChild(h); card.appendChild(r); card.appendChild(p);
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.type = "button";
      const can = pts > 0 && ready && rank < s.max;
      btn.textContent = rank >= s.max ? "Max" : (can ? "Leren" : "Niet nu");
      btn.disabled = !can;
      btn.addEventListener("click", () => learnSkill(id));
      card.appendChild(btn);
      ui.skillGrid.appendChild(card);
    }
  }
  function learnSkill(id) {
    const s = SKILLS[id];
    if (!s || !player.skillPoints || !skillReady(id)) return;
    const rank = skillRank(id);
    if (rank >= s.max) return;
    player.skills[id] = rank + 1;
    player.skillPoints--;
    if (id === "vigor") {
      player.maxHp += 18;
      player.hp = Math.min(player.maxHp, player.hp + 18);
    }
    if (id === "well") {
      player.maxMp += 15;
      player.mp = Math.min(player.maxMp, player.mp + 15);
    }
    sfx.level();
    toast(s.name + " rang " + player.skills[id]);
    renderSkills();
    hudDirty = true;
    save();
  }

  function bindUI() {
    $("btn-play").addEventListener("click", () => { ensureAudio(); sfx.ui(); showClassSelect(); });
    $("btn-continue").addEventListener("click", () => { ensureAudio(); sfx.ui(); startRun(false); });
    $("btn-pause").addEventListener("click", () => togglePause());
    $("btn-resume").addEventListener("click", () => togglePause());
    $("btn-restart").addEventListener("click", () => { ensureAudio(); ui.pause.hidden = true; showClassSelect(); });
    $("btn-again").addEventListener("click", () => { ensureAudio(); showClassSelect(); });
    $("btn-class-back").addEventListener("click", () => {
      ui.classScreen.hidden = true;
      ui.title.hidden = false;
      mode = "title";
      if (loadSave()) ui.btnContinue.hidden = false;
    });
    $("btn-skills").addEventListener("click", () => openSkills());
    $("btn-open-skills").addEventListener("click", () => openSkills());
    $("btn-skill-close").addEventListener("click", () => {
      ui.skillScreen.hidden = true;
      if (mode === "pause") { mode = "play"; ui.pause.hidden = true; }
    });
    $("btn-mute").addEventListener("click", () => toggleMute());
    if (ui.skill2) ui.skill2.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); ensureAudio(); useSkill(2); });
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
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(src));
      im.src = src;
    });
  }
  bindUI();
  setupPwa();
  resize();
  if (ui.muteBtn) ui.muteBtn.classList.toggle("muted", muted);
  if (loadSave()) ui.btnContinue.hidden = false;
  requestAnimationFrame(frame);
  Promise.all([
    loadImage("assets/heroes.png").then((i) => { images.heroes = i; }),
    loadImage("assets/monsters.png").then((i) => { images.monsters = i; }),
    loadImage("assets/tiles.png").then((i) => { images.tiles = i; }),
  ]).then(() => { assetsReady = true; }).catch((err) => {
    console.warn("Assets:", err);
    assetsReady = true;
  });
})();
