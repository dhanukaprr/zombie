const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const ui = {
  objective: document.getElementById("objective"),
  area: document.getElementById("area"),
  status: document.getElementById("status"),
};

const WORLD = { width: 4200, height: 2400 };
const keys = new Set();
let worldTime = 0;
let gameState = "menu";
let menuNotice = "";
let uiButtons = [];
let cheatBuffer = "";
let hoveredButton = null;
let mousePos = { x: -1, y: -1 };

const settingsState = {
  difficulty: "normal",
  soundOn: true,
};

const difficultyConfig = {
  easy: { enemySpeed: 0.88, enemyDamage: 0.8, spawnScale: 0.85, heartRespawn: 440 },
  normal: { enemySpeed: 1, enemyDamage: 1, spawnScale: 1, heartRespawn: 520 },
  hard: { enemySpeed: 1.16, enemyDamage: 1.2, spawnScale: 1.2, heartRespawn: 620 },
};

const palette = {
  grass: "#74b83f",
  grassDark: "#4d8426",
  grassLight: "#8ccb5f",
  road: "#dcbf8e",
  roadEdge: "#af8755",
  lane: "#edd7a9",
  sidewalk: "#86ad4d",
  water: "#4fa0d7",
  waterDark: "#286f97",
  waterLight: "#8fe3ff",
  shadow: "rgba(0,0,0,0.18)",
  shadowDark: "rgba(0,0,0,0.34)",
  hud: "rgba(11, 18, 24, 0.82)",
  hudLine: "#74d6ff",
  hudGold: "#f5d36f",
  text: "#f4f1de",
  roofA: "#7b5534",
  roofB: "#9e8440",
  roofC: "#79808f",
  wallA: "#c0a36f",
  wallB: "#9fa97b",
  wallC: "#aaa7b2",
  tree: "#237132",
  treeDeep: "#164d22",
  trunk: "#6a452c",
  brush: "#2f7a2d",
  moss: "#a4cd5f",
  stone: "#adb0aa",
  flowerA: "#f6d4ff",
  flowerB: "#ffe27c",
  flowerC: "#9ce0ff",
  dirtSpeck: "#c9b18b",
  heart: "#dd5a68",
  heartDark: "#8f2639",
  mana: "#8dd6ff",
  manaGlow: "rgba(141,214,255,0.42)",
  arrow: "#e4d7bd",
  arrowTrail: "rgba(228,215,189,0.5)",
  fire: "#ff9d3c",
  fireGlow: "rgba(255,157,60,0.45)",
  acid: "#8fd64f",
  acidGlow: "rgba(143,214,79,0.45)",
  slash: "rgba(255, 240, 190, 0.72)",
  hitSpark: "#ffe7a8",
  hitEmber: "#ff9d5c",
  gore: "#732a34",
  goreDark: "#41131a",
  ultimateGold: "rgba(255, 220, 120, 0.48)",
  ultimateLeaf: "rgba(184, 245, 135, 0.42)",
  ultimateArcane: "rgba(165, 120, 255, 0.42)",
  bossBar: "#d85757",
  bossBarBg: "rgba(0,0,0,0.45)",
  flash: "rgba(255,248,215,0.18)",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleLerp(current, target, rate) {
  const diff = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return current + diff * rate;
}

function initAudio() {
  if (!settingsState.soundOn) return null;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(type, frequency, duration = 0.08, volume = 0.03) {
  const ctxx = initAudio();
  if (!ctxx) return;
  const oscillator = ctxx.createOscillator();
  const gain = ctxx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctxx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctxx.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(ctxx.destination);
  oscillator.start();
  oscillator.stop(ctxx.currentTime + duration);
}

function addDamageNumber(x, y, value, color = palette.text, size = 14) {
  damageNumbers.push({ x, y, value, color, size, life: 36, drift: 0 });
}

function dealPlayerDamage(amount, source = "hit") {
  if (player.shieldTimer > 0 && source !== "acidPool") {
    addDamageNumber(player.x, player.y - 22, "shield", palette.mana, 12);
    playTone("sine", 680, 0.05, 0.025);
    return false;
  }
  if (player.invuln > 0) return false;
  player.health = clamp(player.health - amount, 0, player.maxHealth);
  player.invuln = 24;
  addDamageNumber(player.x, player.y - 22, Math.round(amount), "#ffb4b4", 16);
  if (source === "boss") {
    screenShake = Math.max(screenShake, 12);
    playTone("sawtooth", 110, 0.12, 0.04);
  } else {
    playTone("square", 160, 0.07, 0.03);
  }
  return true;
}

function rectContains(rect, x, y, margin = 0) {
  return x > rect.x - margin && x < rect.x + rect.w + margin && y > rect.y - margin && y < rect.y + rect.h + margin;
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = dx * dx + dy * dy || 1;
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / len, 0, 1);
  const projX = start.x + dx * t;
  const projY = start.y + dy * t;
  return Math.hypot(point.x - projX, point.y - projY);
}

function routeHit(point) {
  let best = { route: null, distance: Infinity };
  for (const route of routes) {
    for (let i = 0; i < route.points.length - 1; i += 1) {
      const d = pointToSegmentDistance(point, route.points[i], route.points[i + 1]);
      if (d < best.distance) best = { route, distance: d };
    }
  }
  return best;
}

function isOnRoad(point, extra = 0) {
  const hit = routeHit(point);
  return hit.route && hit.distance <= hit.route.width / 2 + extra;
}

function collidesOnFoot(x, y) {
  if (x < 40 || y < 40 || x > WORLD.width - 40 || y > WORLD.height - 40) return true;
  if (waterZones.some((zone) => rectContains(zone, x, y, 8))) return true;
  if (buildings.some((b) => rectContains(b, x, y, 12))) return true;
  return false;
}

function makeHumanoidSprite(colors) {
  const poses = {
    down: [
      { legL: 3, legR: 8, armL: 2, armR: 9 },
      { legL: 2, legR: 9, armL: 3, armR: 8 },
      { legL: 4, legR: 7, armL: 2, armR: 9 },
    ],
    up: [
      { legL: 3, legR: 8, armL: 2, armR: 9 },
      { legL: 2, legR: 9, armL: 3, armR: 8 },
      { legL: 4, legR: 7, armL: 2, armR: 9 },
    ],
    side: [
      { legF: 6, legB: 4, armF: 7, armB: 3 },
      { legF: 7, legB: 3, armF: 6, armB: 4 },
      { legF: 6, legB: 4, armF: 7, armB: 3 },
    ],
  };

  function makeFrame(direction, step) {
    const sprite = document.createElement("canvas");
    sprite.width = 12;
    sprite.height = 16;
    const sctx = sprite.getContext("2d");
    sctx.imageSmoothingEnabled = false;

    const px = (x, y, w, h, color) => {
      sctx.fillStyle = color;
      sctx.fillRect(x, y, w, h);
    };

    if (direction === "down") {
      px(3, 1, 6, 2, colors.hair);
      px(2, 3, 8, 3, colors.skin);
      px(2, 6, 8, 4, colors.shirt);
      px(step.armL, 6, 2, 5, colors.skin);
      px(step.armR, 6, 2, 5, colors.skin);
      px(3, 10, 6, 3, colors.pants);
      px(step.legL, 13, 2, 3, colors.boots);
      px(step.legR, 13, 2, 3, colors.boots);
    }

    if (direction === "up") {
      px(3, 1, 6, 2, colors.hair);
      px(2, 3, 8, 3, colors.skin);
      px(2, 6, 8, 4, colors.shirtBack || colors.shirt);
      px(step.armL, 6, 2, 5, colors.skinDark || colors.skin);
      px(step.armR, 6, 2, 5, colors.skinDark || colors.skin);
      px(3, 10, 6, 3, colors.pants);
      px(step.legL, 13, 2, 3, colors.boots);
      px(step.legR, 13, 2, 3, colors.boots);
    }

    if (direction === "side") {
      px(4, 1, 4, 2, colors.hair);
      px(3, 3, 6, 3, colors.skin);
      px(3, 6, 6, 4, colors.shirt);
      px(step.armB, 7, 2, 4, colors.skinDark || colors.skin);
      px(step.armF, 7, 2, 4, colors.skin);
      px(4, 10, 4, 3, colors.pants);
      px(step.legB, 13, 2, 3, colors.boots);
      px(step.legF, 13, 2, 3, colors.boots);
      px(8, 4, 1, 1, "#1a1a1a");
    }

    return sprite;
  }

  return {
    down: poses.down.map((step) => makeFrame("down", step)),
    up: poses.up.map((step) => makeFrame("up", step)),
    right: poses.side.map((step) => makeFrame("side", step)),
  };
}

const sprites = {
  warrior: makeHumanoidSprite({
    skin: "#f0c6a3",
    skinDark: "#d39c7c",
    hair: "#51311c",
    shirt: "#9e4f3b",
    shirtBack: "#7d3d2f",
    pants: "#5c6b78",
    boots: "#4f3524",
  }),
  archer: makeHumanoidSprite({
    skin: "#efc29f",
    skinDark: "#c88f6e",
    hair: "#7b5d2f",
    shirt: "#3f7a41",
    shirtBack: "#2f5e31",
    pants: "#6f5334",
    boots: "#48311e",
  }),
  mage: makeHumanoidSprite({
    skin: "#ebc3a7",
    skinDark: "#c38f74",
    hair: "#34294d",
    shirt: "#4d63b7",
    shirtBack: "#394d94",
    pants: "#5c4a8a",
    boots: "#2a2344",
  }),
  zombieA: makeHumanoidSprite({
    skin: "#93b08e",
    skinDark: "#6f8b67",
    hair: "#40342b",
    shirt: "#7f4f59",
    shirtBack: "#6a3f48",
    pants: "#545d66",
    boots: "#3d3026",
  }),
  zombieB: makeHumanoidSprite({
    skin: "#7fa37a",
    skinDark: "#55785a",
    hair: "#262a22",
    shirt: "#b16b49",
    shirtBack: "#94573a",
    pants: "#405457",
    boots: "#35271d",
  }),
  zombieC: makeHumanoidSprite({
    skin: "#99b59f",
    skinDark: "#76917c",
    hair: "#4c4134",
    shirt: "#8c8b4d",
    shirtBack: "#6f6d3d",
    pants: "#5d5472",
    boots: "#463229",
  }),
  boss: makeHumanoidSprite({
    skin: "#72886f",
    skinDark: "#4e6049",
    hair: "#1b1b1b",
    shirt: "#5c2f2f",
    shirtBack: "#402020",
    pants: "#3a3a3a",
    boots: "#1d1d1d",
  }),
  mega: makeHumanoidSprite({
    skin: "#6c8f61",
    skinDark: "#466341",
    hair: "#1a2a13",
    shirt: "#516d3d",
    shirtBack: "#3d542c",
    pants: "#313c2b",
    boots: "#1a2317",
  }),
};

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

const classPortraits = {
  warrior: loadImage("Images/warrior.png"),
  archer: loadImage("Images/archer.png"),
  mage: loadImage("Images/mage.png"),
};

const routes = [
  { name: "Old Forest Trail", width: 104, points: [{ x: 0, y: 760 }, { x: 380, y: 770 }, { x: 860, y: 820 }, { x: 1500, y: 900 }, { x: 2200, y: 1020 }, { x: 2930, y: 1040 }, { x: 3560, y: 980 }, { x: 4200, y: 1080 }] },
  { name: "Creekside Path", width: 72, points: [{ x: 220, y: 540 }, { x: 620, y: 590 }, { x: 1110, y: 700 }, { x: 1710, y: 835 }] },
  { name: "Moss Run", width: 68, points: [{ x: 1310, y: 860 }, { x: 1260, y: 1160 }, { x: 1210, y: 1510 }, { x: 1180, y: 2100 }] },
  { name: "Sunfield Trail", width: 74, points: [{ x: 2160, y: 1020 }, { x: 2460, y: 720 }, { x: 3050, y: 550 }, { x: 3540, y: 470 }] },
  { name: "Hollow Route", width: 70, points: [{ x: 2180, y: 1030 }, { x: 2110, y: 1320 }, { x: 2060, y: 1840 }, { x: 2010, y: 2380 }] },
  { name: "North Ridge Trail", width: 86, points: [{ x: 3860, y: 0 }, { x: 3890, y: 380 }, { x: 3920, y: 980 }, { x: 4010, y: 1580 }, { x: 4200, y: 2400 }] },
  { name: "Lake Edge", width: 64, points: [{ x: 0, y: 1810 }, { x: 260, y: 1770 }, { x: 520, y: 1710 }, { x: 780, y: 1560 }, { x: 1030, y: 1410 }] },
  { name: "Birch Link", width: 58, points: [{ x: 700, y: 590 }, { x: 860, y: 430 }, { x: 1040, y: 280 }] },
  { name: "Forge Track", width: 58, points: [{ x: 2090, y: 1350 }, { x: 2160, y: 1500 }, { x: 2230, y: 1650 }] },
  { name: "Briar Spur", width: 60, points: [{ x: 3300, y: 640 }, { x: 3520, y: 630 }, { x: 3730, y: 680 }] },
];

const areas = {
  camp: { x: 520, y: 600, name: "South Camp" },
  pond: { x: 1040, y: 290, name: "Moon Pond" },
  glade: { x: 1400, y: 900, name: "Moss Glade" },
  birch: { x: 760, y: 1280, name: "Birch Rise" },
  crossroads: { x: 2180, y: 1020, name: "Hunter Crossroads" },
  forge: { x: 2230, y: 1650, name: "Hollow Forge" },
  briar: { x: 3530, y: 640, name: "Briar Hollow" },
  ruins: { x: 3490, y: 1060, name: "Stone Ruins" },
  marsh: { x: 3560, y: 2080, name: "Mist Marsh" },
};

const waterZones = [
  { x: 0, y: 1980, w: 820, h: 420 },
  { x: 770, y: 130, w: 380, h: 210 },
  { x: 3010, y: 0, w: 520, h: 250 },
  { x: 3390, y: 1760, w: 520, h: 330 },
  { x: 3940, y: 1450, w: 260, h: 420 },
];

const buildings = [
  { x: 220, y: 250, w: 230, h: 150, roof: palette.roofA, wall: palette.wallA, label: "Ranger Hut" },
  { x: 520, y: 210, w: 220, h: 120, roof: palette.roofC, wall: palette.wallC, label: "Stone Shrine" },
  { x: 830, y: 80, w: 230, h: 130, roof: palette.roofB, wall: palette.wallA, label: "Pond Watch" },
  { x: 610, y: 850, w: 340, h: 200, roof: palette.roofA, wall: palette.wallB, label: "Camp Barracks" },
  { x: 1010, y: 980, w: 260, h: 170, roof: palette.roofB, wall: palette.wallA, label: "Fallen Mill" },
  { x: 1560, y: 1120, w: 390, h: 230, roof: palette.roofC, wall: palette.wallB, label: "Moss Hall" },
  { x: 1980, y: 770, w: 280, h: 140, roof: palette.roofA, wall: palette.wallC, label: "Hunter Lodge" },
  { x: 2360, y: 710, w: 250, h: 180, roof: palette.roofB, wall: palette.wallA, label: "Sun Granary" },
  { x: 2400, y: 1280, w: 320, h: 200, roof: palette.roofC, wall: palette.wallB, label: "Forge Storehouse" },
  { x: 1870, y: 1660, w: 230, h: 280, roof: palette.roofA, wall: palette.wallA, label: "Root Chapel" },
  { x: 2860, y: 320, w: 250, h: 150, roof: palette.roofC, wall: palette.wallC, label: "Cliff Shelter" },
  { x: 3270, y: 860, w: 280, h: 170, roof: palette.roofA, wall: palette.wallA, label: "Ruin Gate" },
  { x: 3210, y: 430, w: 260, h: 120, roof: palette.roofB, wall: palette.wallA, label: "Briar Barn" },
  { x: 3480, y: 1350, w: 340, h: 190, roof: palette.roofC, wall: palette.wallB, label: "Grave Garden" },
  { x: 3310, y: 1780, w: 270, h: 160, roof: palette.roofB, wall: palette.wallA, label: "Marsh Outpost" },
  { x: 500, y: 1490, w: 280, h: 170, roof: palette.roofC, wall: palette.wallC, label: "Lake Shelter" },
];

const trees = Array.from({ length: 220 }, (_, i) => ({
  x: 70 + (i * 337) % 4040,
  y: 70 + (i * 223) % 2260,
  r: 15 + (i % 5) * 3,
  kind: ["oak", "pine", "birch", "dead"][i % 4],
  sway: (i % 11) * 0.23,
})).filter((tree) => !isOnRoad(tree, 26) && !waterZones.some((z) => rectContains(z, tree.x, tree.y, 12)) && !buildings.some((b) => rectContains(b, tree.x, tree.y, 26)));

const missionStops = [areas.camp, areas.glade, areas.crossroads, areas.forge, areas.ruins, areas.briar, areas.birch, areas.marsh];

const objectiveTypes = ["deliver", "activate", "defend", "recover"];

const randomEventTemplates = [
  { type: "cursedFog", title: "Cursed Fog", duration: 720 },
  { type: "healingGrove", title: "Healing Grove", duration: 720 },
  { type: "meteorRain", title: "Meteor Rain", duration: 540 },
  { type: "eliteHunt", title: "Elite Hunt", duration: 660 },
];

const classDefinitions = {
  warrior: {
    name: "Warrior",
    sprite: sprites.warrior,
    portrait: classPortraits.warrior,
    description: "Frontline blade fighter with sweeping melee ultimates.",
    weaponName: "Sword",
    color: "#c37055",
    renderScale: 0.08,
    footOffset: 2,
    role: { damage: 4, speed: 2, range: 2, difficulty: 2 },
    branches: ["wider cleave", "faster combo"],
    upgrades: [
      { name: "Rust Sword", cost: 0, damage: 2, cooldown: 16, range: 42, slashLife: 7 },
      { name: "Knight Blade", cost: 320, damage: 3, cooldown: 14, range: 46, slashLife: 8 },
      { name: "Runeblade", cost: 780, damage: 4, cooldown: 12, range: 50, slashLife: 9 },
      { name: "Kingslayer", cost: 1600, damage: 5, cooldown: 10, range: 54, slashLife: 10, ultimateName: "Whirlwind" },
    ],
  },
  archer: {
    name: "Archer",
    sprite: sprites.archer,
    portrait: classPortraits.archer,
    description: "Fast ranged fighter with piercing volleys.",
    weaponName: "Bow",
    color: "#4d8c50",
    renderScale: 0.08,
    footOffset: 2,
    role: { damage: 3, speed: 4, range: 5, difficulty: 3 },
    branches: ["piercing arrows", "multishot"],
    upgrades: [
      { name: "Short Bow", cost: 0, damage: 2, cooldown: 14, speed: 11, life: 42, size: 3 },
      { name: "Long Bow", cost: 340, damage: 3, cooldown: 11, speed: 12, life: 46, size: 3 },
      { name: "Hawkeye Bow", cost: 860, damage: 4, cooldown: 9, speed: 13, life: 50, size: 3 },
      { name: "Moon Bow", cost: 1700, damage: 5, cooldown: 7, speed: 14, life: 54, size: 4, ultimateName: "Volley Rain" },
    ],
  },
  mage: {
    name: "Mage",
    sprite: sprites.mage,
    portrait: classPortraits.mage,
    description: "Arcane caster firing energy orbs and explosive bursts.",
    weaponName: "Arcana",
    color: "#5678d2",
    renderScale: 0.08,
    footOffset: 2,
    role: { damage: 5, speed: 3, range: 4, difficulty: 4 },
    branches: ["chain lightning", "larger explosions"],
    upgrades: [
      { name: "Spark Orb", cost: 0, damage: 2, cooldown: 13, speed: 9, life: 38, size: 5 },
      { name: "Storm Orb", cost: 360, damage: 3, cooldown: 10, speed: 10, life: 42, size: 6 },
      { name: "Elder Orb", cost: 900, damage: 5, cooldown: 8, speed: 11, life: 46, size: 7 },
      { name: "Void Core", cost: 1750, damage: 6, cooldown: 6, speed: 12, life: 50, size: 8, ultimateName: "Arcane Nova" },
    ],
  },
};

const zombieSpawns = [
  { x: 520, y: 500, dir: 0.6, sprite: sprites.zombieA, boss: false, archetype: "runner" },
  { x: 1360, y: 880, dir: -0.2, sprite: sprites.zombieB, boss: false, archetype: "armored" },
  { x: 2110, y: 1035, dir: 1.0, sprite: sprites.zombieC, boss: false, archetype: "spitter" },
  { x: 2220, y: 1510, dir: 1.7, sprite: sprites.zombieA, boss: false, archetype: "runner" },
  { x: 3480, y: 1010, dir: 0.2, sprite: sprites.zombieB, boss: false, archetype: "summoner" },
  { x: 730, y: 1390, dir: 2.8, sprite: sprites.zombieC, boss: false, archetype: "spitter" },
  { x: 880, y: 360, dir: 1.3, sprite: sprites.zombieA, boss: false, archetype: "runner" },
  { x: 1210, y: 1560, dir: 2.2, sprite: sprites.zombieB, boss: false, archetype: "armored" },
  { x: 1690, y: 910, dir: -0.5, sprite: sprites.zombieC, boss: false, archetype: "spitter" },
  { x: 2450, y: 1180, dir: 0.9, sprite: sprites.zombieA, boss: false, archetype: "runner" },
  { x: 3320, y: 580, dir: 2.5, sprite: sprites.zombieB, boss: false, archetype: "summoner" },
  { x: 3640, y: 1880, dir: -1.2, sprite: sprites.zombieC, boss: false, archetype: "armored" },
  { x: 2180, y: 930, dir: 0.1, sprite: sprites.zombieB, boss: false, archetype: "spitter" },
  { x: 3460, y: 1040, dir: 0.08, sprite: sprites.zombieA, boss: false, archetype: "runner" },
  { x: 760, y: 1260, dir: 1.7, sprite: sprites.zombieC, boss: false, archetype: "armored" },
  { x: 2400, y: 1560, dir: -0.4, sprite: sprites.zombieB, boss: false, archetype: "summoner" },
  { x: 3020, y: 900, dir: 1.3, sprite: sprites.boss, boss: true, bossType: "ruin" },
  { x: 1180, y: 1860, dir: -0.7, sprite: sprites.boss, boss: true, bossType: "marsh" },
  { x: 3770, y: 1420, dir: 2.7, sprite: sprites.boss, boss: true, bossType: "grove" },
];

const heartSpawns = [
  { x: 650, y: 700 },
  { x: 980, y: 420 },
  { x: 1320, y: 980 },
  { x: 1870, y: 890 },
  { x: 2320, y: 1210 },
  { x: 2550, y: 710 },
  { x: 3340, y: 930 },
  { x: 3540, y: 1940 },
];

const PLAYER_SPAWN = { x: 560, y: 620, angle: 0 };
const upgradeStation = { x: areas.forge.x + 42, y: areas.forge.y - 28, name: "Forest Workbench" };

const player = {
  x: PLAYER_SPAWN.x,
  y: PLAYER_SPAWN.y,
  angle: PLAYER_SPAWN.angle,
  walkSpeed: 1.8,
  sprintSpeed: 2.8,
  health: 100,
  money: 0,
  anim: 0,
  classKey: null,
  branchIndex: 0,
  upgradeLevel: 0,
  attackCooldown: 0,
  ultimateCooldown: 0,
  specialCooldown: 0,
  actionAnim: 0,
  dragonTimer: 0,
  maxHealth: 100,
  invuln: 0,
  shieldTimer: 0,
  stats: {
    cooldownBonus: 0,
    speedBonus: 0,
    maxHealthBonus: 0,
    dragonBonus: 0,
  },
};

const mission = { activeIndex: 1, chain: 0, message: "Choose a class and survive the woods." };
const survival = { elapsed: 0, hordeLevel: 1, bossesAwake: 0, bossesKilled: 0, megaBossAwake: false };
const missionState = { type: "deliver", progress: 0, defendTimer: 0, relicArmed: false };
const worldEvent = { active: null, timer: 540, cooldown: 900, message: "" };

let zombies = [];
let projectiles = [];
let slashes = [];
let hearts = [];
let hitEffects = [];
let arrowTrails = [];
let spellExplosions = [];
let goreEffects = [];
let ultimateEffects = [];
let screenShake = 0;
let megaBoss = null;
let acidPools = [];
let damageNumbers = [];
let traps = [];
let ambientLeaves = Array.from({ length: 34 }, (_, i) => ({ x: (i * 121) % WORLD.width, y: (i * 83) % WORLD.height, drift: 0.3 + (i % 5) * 0.08, sway: i * 0.27 }));
let fireflies = Array.from({ length: 26 }, (_, i) => ({ x: (i * 173) % WORLD.width, y: 120 + (i * 149) % (WORLD.height - 240), pulse: i * 0.41 }));
let torchFlicker = 0;
let audioCtx = null;
let isPaused = false;

function currentTarget() {
  return missionStops[mission.activeIndex % missionStops.length];
}

function currentMissionType() {
  return objectiveTypes[mission.chain % objectiveTypes.length];
}

function currentClass() {
  return player.classKey ? classDefinitions[player.classKey] : null;
}

function buildScaledUpgrade(cls, level) {
  const upgrades = cls.upgrades;
  const cappedIndex = Math.min(level, upgrades.length - 1);
  const base = upgrades[cappedIndex];
  const extraLevels = Math.max(0, level - (upgrades.length - 1));
  if (extraLevels === 0) return { ...base };

  const scaled = { ...base };
  scaled.tier = level + 1;
  scaled.name = `${base.name} +${extraLevels}`;
  scaled.cost = Math.round((base.cost || 0) + 700 * extraLevels + 180 * extraLevels * extraLevels);

  if (cls.name === "Warrior") {
    scaled.damage = base.damage + extraLevels * 2;
    scaled.range = base.range + extraLevels * 4;
    scaled.slashLife = base.slashLife + Math.floor(extraLevels / 2);
    scaled.cooldown = Math.max(4, base.cooldown - Math.floor(extraLevels / 2));
  } else if (cls.name === "Archer") {
    scaled.damage = base.damage + extraLevels * 2;
    scaled.speed = base.speed + extraLevels * 1.2;
    scaled.life = base.life + extraLevels * 4;
    scaled.size = base.size + Math.floor(extraLevels / 2);
    scaled.cooldown = Math.max(3, base.cooldown - Math.floor(extraLevels / 2));
  } else {
    scaled.damage = base.damage + extraLevels * 2;
    scaled.speed = base.speed + extraLevels * 1.1;
    scaled.life = base.life + extraLevels * 5;
    scaled.size = base.size + extraLevels;
    scaled.cooldown = Math.max(3, base.cooldown - Math.floor(extraLevels / 2));
  }

  const branch = player.branchIndex || 0;
  if (cls.name === "Warrior") {
    if (branch === 0) scaled.range += 10 + level;
    else scaled.cooldown = Math.max(2, scaled.cooldown - 2);
  } else if (cls.name === "Archer") {
    if (branch === 0) scaled.pierce = 1 + Math.floor(level / 4);
    else scaled.multishot = 2 + Math.floor(level / 5);
  } else {
    if (branch === 0) scaled.chain = 1 + Math.floor(level / 4);
    else scaled.radiusBonus = 8 + level * 1.5;
  }

  scaled.cooldown = Math.max(2, scaled.cooldown - player.stats.cooldownBonus);

  return scaled;
}

function currentUpgrade() {
  const cls = currentClass();
  return cls ? buildScaledUpgrade(cls, player.upgradeLevel) : null;
}

function nextUpgrade() {
  const cls = currentClass();
  return cls ? buildScaledUpgrade(cls, player.upgradeLevel + 1) : null;
}

function branchName() {
  const cls = currentClass();
  return cls ? cls.branches[player.branchIndex] : "";
}

function branchCost() {
  return 220 + player.upgradeLevel * 25;
}

function sinkDefinitions() {
  return [
    { key: "1", name: "Vitality", cost: 180 + player.stats.maxHealthBonus * 6, apply: () => { player.stats.maxHealthBonus += 10; player.maxHealth += 10; player.health += 10; } },
    { key: "2", name: "Swiftness", cost: 220 + player.stats.speedBonus * 50, apply: () => { player.stats.speedBonus += 0.12; } },
    { key: "3", name: "Focus", cost: 260 + player.stats.cooldownBonus * 120, apply: () => { player.stats.cooldownBonus += 1; } },
    { key: "4", name: "Dragon Rite", cost: 320 + player.stats.dragonBonus * 100, apply: () => { player.stats.dragonBonus += 90; } },
  ];
}

function buySink(key) {
  if (gameState !== "playing") return;
  if (distance(player, upgradeStation) > 58) {
    mission.message = `Return to ${upgradeStation.name} to train passives.`;
    return;
  }
  const sink = sinkDefinitions().find((entry) => entry.key === key);
  if (!sink) return;
  if (player.money < sink.cost) {
    mission.message = `${sink.name} costs ${sink.cost} gold.`;
    return;
  }
  player.money -= sink.cost;
  sink.apply();
  mission.message = `${sink.name} improved.`;
}

function cycleBranch() {
  if (gameState !== "playing" || !currentClass()) return;
  if (distance(player, upgradeStation) > 58) {
    mission.message = `Return to ${upgradeStation.name} to change specialization.`;
    return;
  }
  player.branchIndex = (player.branchIndex + 1) % currentClass().branches.length;
  mission.message = `${currentClass().name} specialization set: ${branchName()}.`;
}

function nearestArea() {
  return Object.values(areas).reduce((best, area) => {
    const d = distance(player, area);
    return d < best.distance ? { area, distance: d } : best;
  }, { area: areas.camp, distance: Infinity }).area;
}

function createZombie(spawn) {
  const archetype = spawn.archetype || "walker";
  const bossType = spawn.bossType || null;
  const isBoss = spawn.boss;
  const stats = {
    walker: { maxHealth: 5, speed: 0.82, damage: 6 },
    runner: { maxHealth: 3, speed: 1.18, damage: 4 },
    spitter: { maxHealth: 4, speed: 0.72, damage: 5 },
    armored: { maxHealth: 9, speed: 0.58, damage: 7 },
    summoner: { maxHealth: 6, speed: 0.66, damage: 5 },
  }[archetype] || { maxHealth: 5, speed: 0.82, damage: 6 };

  return {
    x: spawn.x,
    y: spawn.y,
    homeX: spawn.x,
    homeY: spawn.y,
    dir: spawn.dir,
    sprite: spawn.sprite,
    boss: isBoss,
    archetype,
    bossType,
    maxHealth: isBoss ? 16 : stats.maxHealth,
    health: isBoss ? 16 : stats.maxHealth,
    speed: isBoss ? 0.48 : stats.speed,
    damage: isBoss ? 12 : stats.damage,
    anim: 0,
    cooldown: 0,
    specialCooldown: 0,
    downFor: 0,
    active: true,
    touchedBy: null,
  };
}

function createHeart(spawn) {
  return { x: spawn.x, y: spawn.y, active: true, cooldown: 0 };
}

function createMegaBoss() {
  return {
    x: areas.ruins.x,
    y: areas.ruins.y,
    homeX: areas.ruins.x,
    homeY: areas.ruins.y,
    dir: 0,
    sprite: sprites.mega,
    boss: true,
    mega: true,
    maxHealth: 84,
    health: 84,
    speed: 0.32,
    damage: 18,
    anim: 0,
    cooldown: 0,
    acidCooldown: 0,
    roarTimer: 90,
    stompTimer: 0,
    active: true,
  };
}

function spawnMegaBoss() {
  if (megaBoss) return;
  megaBoss = createMegaBoss();
  survival.megaBossAwake = true;
  mission.message = "The Mega Boss has emerged from the Stone Ruins.";
}

function resetWorldForRun(resetProgress) {
  player.x = PLAYER_SPAWN.x;
  player.y = PLAYER_SPAWN.y;
  player.angle = PLAYER_SPAWN.angle;
  player.maxHealth = 100 + player.stats.maxHealthBonus;
  player.health = player.maxHealth;
  player.anim = 0;
  player.attackCooldown = 0;
  player.ultimateCooldown = 0;
  player.specialCooldown = 0;
  player.actionAnim = 0;
  player.dragonTimer = 0;
  player.invuln = 0;
  player.shieldTimer = 0;
  if (resetProgress) {
    player.money = 0;
    player.upgradeLevel = 0;
    player.stats = { cooldownBonus: 0, speedBonus: 0, maxHealthBonus: 0, dragonBonus: 0 };
    player.maxHealth = 100;
    player.health = 100;
  }
  cheatBuffer = "";

  projectiles = [];
  slashes = [];
  hitEffects = [];
  arrowTrails = [];
  spellExplosions = [];
  goreEffects = [];
  ultimateEffects = [];
  screenShake = 0;
  acidPools = [];
  damageNumbers = [];
  traps = [];
  zombies = zombieSpawns.map(createZombie);
  hearts = heartSpawns.map(createHeart);
  survival.elapsed = 0;
  survival.hordeLevel = 1;
  survival.bossesAwake = 0;
  survival.bossesKilled = 0;
  survival.megaBossAwake = false;
  megaBoss = null;
  missionState.type = "deliver";
  missionState.progress = 0;
  missionState.defendTimer = 0;
  missionState.relicArmed = false;
  worldEvent.active = null;
  worldEvent.timer = 540;
  worldEvent.cooldown = 900;
  worldEvent.message = "";
  mission.activeIndex = 1;
  mission.chain = 0;
  mission.message = "Carry supply drops between forest shelters and survive the horde.";
}

function startNewRun(classKey) {
  player.classKey = classKey;
  resetWorldForRun(true);
  gameState = "playing";
}

function respawnPlayer() {
  resetWorldForRun(false);
  mission.message = "You fell in the woods and woke at South Camp. Keep moving.";
}

function activeEnemyTargets() {
  const config = difficultyConfig[settingsState.difficulty];
  const totalCap = clamp(Math.floor((5 + survival.elapsed / 18 + mission.chain / 2) * config.spawnScale), 5, zombies.length);
  const bossCap = clamp(Math.floor((survival.elapsed - 45) / 35), 0, 3);
  return { totalCap, bossCap };
}

function tryUpgradeWeapon() {
  if (gameState !== "playing") return;
  if (distance(player, upgradeStation) > 58) {
    mission.message = `Reach ${upgradeStation.name} near ${areas.forge.name} to train.`;
    return;
  }

  const upgrade = nextUpgrade();

  if (player.money < upgrade.cost) {
    mission.message = `${upgrade.name} costs ${upgrade.cost} gold. Finish more runs first.`;
    return;
  }

  player.money -= upgrade.cost;
  player.upgradeLevel += 1;
  mission.message = `${upgrade.name} unlocked.`;
  playTone("triangle", 460, 0.12, 0.035);
}

function movePlayer() {
  if (gameState !== "playing") return;

  let dx = 0;
  let dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  if (!dx && !dy) {
    player.anim = 0;
    return;
  }

  const length = Math.hypot(dx, dy) || 1;
  const walk = player.walkSpeed + player.stats.speedBonus;
  const sprint = player.sprintSpeed + player.stats.speedBonus * 1.3;
  const baseSpeed = player.dragonTimer > 0 ? 4.2 + player.stats.speedBonus : keys.has("shift") ? sprint : walk;
  const speed = player.dragonTimer > 0 && keys.has("shift") ? baseSpeed + 1 : baseSpeed;
  const nextX = player.x + (dx / length) * speed;
  const nextY = player.y + (dy / length) * speed;
  if (!collidesOnFoot(nextX, player.y)) player.x = nextX;
  if (!collidesOnFoot(player.x, nextY)) player.y = nextY;
  player.angle = Math.atan2(dy, dx);
  player.anim += keys.has("shift") ? 0.18 : 0.11;
}

function performAttack() {
  if (gameState !== "playing" || player.attackCooldown > 0 || !currentClass()) return;

  if (player.dragonTimer > 0) {
    player.attackCooldown = 4;
    player.actionAnim = 7;
    projectiles.push({
      x: player.x + Math.cos(player.angle) * 26,
      y: player.y + Math.sin(player.angle) * 26,
      angle: player.angle,
      speed: 12,
      life: 28,
      damage: 10 + Math.floor(player.upgradeLevel / 3),
      size: 10,
      kind: "fire",
    });
    return;
  }

  const cls = currentClass();
  const upgrade = currentUpgrade();
  player.attackCooldown = upgrade.cooldown;
  player.actionAnim = 7;

  if (cls.name === "Warrior") {
    hitEffects.push({
      x: player.x + Math.cos(player.angle) * (upgrade.range * 0.5),
      y: player.y + Math.sin(player.angle) * (upgrade.range * 0.5),
      radius: upgrade.range * 0.4,
      life: 8,
      kind: "meleeSwing",
    });
    slashes.push({
      x: player.x + Math.cos(player.angle) * (upgrade.range * 0.55),
      y: player.y + Math.sin(player.angle) * (upgrade.range * 0.55),
      angle: player.angle,
      radius: upgrade.range,
      damage: upgrade.damage,
      life: upgrade.slashLife,
      hit: new Set(),
    });
    return;
  }

  projectiles.push({
    x: player.x + Math.cos(player.angle) * 18,
    y: player.y + Math.sin(player.angle) * 18,
    angle: player.angle,
    speed: upgrade.speed,
    life: upgrade.life,
    damage: upgrade.damage,
    size: upgrade.size,
    kind: cls.name === "Archer" ? "arrow" : "magic",
    pierce: upgrade.pierce || 0,
    chain: upgrade.chain || 0,
    radiusBonus: upgrade.radiusBonus || 0,
  });

  if (cls.name === "Archer" && upgrade.multishot) {
    for (let i = 1; i < upgrade.multishot; i += 1) {
      const offset = (i - (upgrade.multishot - 1) / 2) * 0.12;
      if (offset === 0) continue;
      projectiles.push({
        x: player.x + Math.cos(player.angle) * 18,
        y: player.y + Math.sin(player.angle) * 18,
        angle: player.angle + offset,
        speed: upgrade.speed,
        life: upgrade.life,
        damage: Math.max(1, upgrade.damage - 1),
        size: upgrade.size,
        kind: "arrow",
        pierce: 0,
      });
    }
  }
}

function performSpecial() {
  const cls = currentClass();
  if (gameState !== "playing" || !cls || player.specialCooldown > 0) return;

  if (cls.name === "Warrior") {
    player.specialCooldown = 180;
    const dash = 44;
    const nx = player.x + Math.cos(player.angle) * dash;
    const ny = player.y + Math.sin(player.angle) * dash;
    if (!collidesOnFoot(nx, ny)) {
      player.x = nx;
      player.y = ny;
    }
    slashes.push({ x: player.x, y: player.y, angle: player.angle, radius: 72, damage: currentUpgrade().damage + 4, life: 12, hit: new Set() });
    mission.message = "Dash slash.";
    playTone("square", 260, 0.1, 0.04);
    return;
  }

  if (cls.name === "Archer") {
    player.specialCooldown = 220;
    traps.push({ x: player.x + Math.cos(player.angle) * 24, y: player.y + Math.sin(player.angle) * 24, life: 420, radius: 42, damage: currentUpgrade().damage + 3 });
    mission.message = "Trap placed.";
    playTone("triangle", 420, 0.08, 0.03);
    return;
  }

  player.specialCooldown = 200;
  const blink = 66;
  const nx = player.x + Math.cos(player.angle) * blink;
  const ny = player.y + Math.sin(player.angle) * blink;
  if (!collidesOnFoot(nx, ny)) {
    player.x = nx;
    player.y = ny;
  }
  player.shieldTimer = 150;
  mission.message = "Blink shield activated.";
  playTone("sine", 520, 0.1, 0.035);
}

function performUltimate() {
  const cls = currentClass();
  const upgrade = currentUpgrade();
  if (gameState !== "playing" || !cls || !upgrade.ultimateName || player.ultimateCooldown > 0) return;

  player.ultimateCooldown = 360;
  mission.message = `${upgrade.ultimateName} unleashed.`;

  if (cls.name === "Warrior") {
    ultimateEffects.push({ kind: "warrior", x: player.x, y: player.y, angle: player.angle, radius: 124, life: 20 });
    slashes.push({ x: player.x, y: player.y, angle: player.angle, radius: 96, damage: 8, life: 16, hit: new Set() });
    return;
  }

  if (cls.name === "Archer") {
    ultimateEffects.push({ kind: "archer", x: player.x, y: player.y, angle: player.angle, radius: 118, life: 22 });
    for (let i = -2; i <= 2; i += 1) {
      projectiles.push({ x: player.x, y: player.y, angle: player.angle + i * 0.18, speed: 14, life: 56, damage: 6, size: 4, kind: "arrow" });
    }
    return;
  }

  ultimateEffects.push({ kind: "mage", x: player.x, y: player.y, angle: player.angle, radius: 132, life: 24 });
  for (let i = 0; i < 8; i += 1) {
    projectiles.push({ x: player.x, y: player.y, angle: (Math.PI * 2 * i) / 8, speed: 11, life: 40, damage: 7, size: 8, kind: "magic" });
  }
}

function registerZombieKill(zombie) {
  zombie.downFor = zombie.boss ? 520 : 300;
  player.money += zombie.boss ? 120 : 20;
  goreEffects.push({ x: zombie.x, y: zombie.y, radius: zombie.boss ? 28 : 16, life: zombie.boss ? 26 : 18, boss: zombie.boss });
  if (zombie.boss) {
    survival.bossesKilled += 1;
    if (survival.bossesKilled >= 3) spawnMegaBoss();
  }
}

function registerMegaBossKill() {
  if (!megaBoss) return;
  player.money += 500;
  goreEffects.push({ x: megaBoss.x, y: megaBoss.y, radius: 44, life: 34, boss: true });
  acidPools.push({ x: megaBoss.x, y: megaBoss.y, radius: 40, life: 120 });
  megaBoss = null;
  survival.megaBossAwake = false;
  mission.message = "The Mega Boss has fallen.";
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i];
    if (projectile.kind === "arrow") {
      arrowTrails.push({ x: projectile.x, y: projectile.y, angle: projectile.angle, life: 8, size: projectile.size + 2 });
    }
    projectile.x += Math.cos(projectile.angle) * projectile.speed;
    projectile.y += Math.sin(projectile.angle) * projectile.speed;
    projectile.life -= 1;

    if (projectile.life <= 0 || projectile.x < 0 || projectile.y < 0 || projectile.x > WORLD.width || projectile.y > WORLD.height || collidesOnFoot(projectile.x, projectile.y)) {
      projectiles.splice(i, 1);
      continue;
    }

    if (projectile.kind === "acid") {
      if (distance(projectile, player) < 18 + projectile.size) {
        dealPlayerDamage(projectile.damage, "acid");
        spellExplosions.push({ x: projectile.x, y: projectile.y, radius: 24, life: 14, kind: "acid" });
        hitEffects.push({ x: projectile.x, y: projectile.y, radius: 14, life: 8, kind: "arrowHit" });
        acidPools.push({ x: projectile.x, y: projectile.y, radius: 22, life: 150 });
        projectiles.splice(i, 1);
      }
      continue;
    }

    let hit = false;
    for (const zombie of zombies) {
      if (zombie.downFor > 0 || !zombie.active) continue;
      if (Math.hypot(projectile.x - zombie.x, projectile.y - zombie.y) < (zombie.boss ? 18 : 14) + projectile.size) {
        zombie.health -= projectile.damage;
        addDamageNumber(zombie.x, zombie.y - 16, projectile.damage, projectile.kind === "magic" ? palette.mana : projectile.kind === "fire" ? palette.fire : palette.hitSpark);
        if (projectile.kind === "magic") {
          spellExplosions.push({ x: projectile.x, y: projectile.y, radius: (zombie.boss ? 22 : 16) + (projectile.radiusBonus || 0), life: 12, kind: "magic" });
          if (projectile.chain) {
            let chained = 0;
            for (const other of zombies) {
              if (other === zombie || other.downFor > 0 || !other.active) continue;
              if (distance(zombie, other) < 90 && chained < projectile.chain) {
                other.health -= Math.max(1, Math.floor(projectile.damage * 0.6));
                addDamageNumber(other.x, other.y - 16, Math.max(1, Math.floor(projectile.damage * 0.6)), palette.mana);
                hitEffects.push({ x: other.x, y: other.y, radius: 10, life: 7, kind: "meleeHit" });
                if (other.health <= 0) registerZombieKill(other);
                chained += 1;
              }
            }
          }
        } else if (projectile.kind === "fire") {
          spellExplosions.push({ x: projectile.x, y: projectile.y, radius: zombie.boss ? 28 : 20, life: 14, kind: "fire" });
          hitEffects.push({ x: projectile.x, y: projectile.y, radius: 16, life: 8, kind: "arrowHit" });
        } else {
          hitEffects.push({ x: projectile.x, y: projectile.y, radius: 12, life: 7, kind: "arrowHit" });
        }
        if (zombie.health <= 0) {
          registerZombieKill(zombie);
        }
        if (projectile.pierce && projectile.pierce > 0) {
          projectile.pierce -= 1;
          hit = false;
        } else {
          hit = true;
        }
        break;
      }
    }

    if (!hit && megaBoss && Math.hypot(projectile.x - megaBoss.x, projectile.y - megaBoss.y) < 26 + projectile.size) {
      megaBoss.health -= projectile.damage;
      addDamageNumber(megaBoss.x, megaBoss.y - 26, projectile.damage, projectile.kind === "magic" ? palette.mana : projectile.kind === "fire" ? palette.fire : palette.hitSpark, 18);
      if (projectile.kind === "magic") {
        spellExplosions.push({ x: projectile.x, y: projectile.y, radius: 24, life: 14, kind: "magic" });
      } else if (projectile.kind === "fire") {
        spellExplosions.push({ x: projectile.x, y: projectile.y, radius: 32, life: 16, kind: "fire" });
      } else {
        hitEffects.push({ x: projectile.x, y: projectile.y, radius: 16, life: 8, kind: "arrowHit" });
      }
      if (megaBoss.health <= 0) registerMegaBossKill();
      hit = true;
    }

    if (hit) projectiles.splice(i, 1);
  }
}

function updateTraps() {
  for (let i = traps.length - 1; i >= 0; i -= 1) {
    const trap = traps[i];
    trap.life -= 1;
    let triggered = false;
    for (const zombie of zombies) {
      if (zombie.downFor > 0 || !zombie.active) continue;
      if (distance(trap, zombie) < trap.radius) {
        zombie.health -= trap.damage;
        hitEffects.push({ x: zombie.x, y: zombie.y, radius: 16, life: 10, kind: "arrowHit" });
        addDamageNumber(zombie.x, zombie.y - 16, trap.damage, palette.arrow);
        if (zombie.health <= 0) registerZombieKill(zombie);
        triggered = true;
      }
    }
    if (!triggered && megaBoss && distance(trap, megaBoss) < trap.radius + 12) {
      megaBoss.health -= trap.damage;
      addDamageNumber(megaBoss.x, megaBoss.y - 26, trap.damage, palette.arrow, 18);
      if (megaBoss.health <= 0) registerMegaBossKill();
      triggered = true;
    }
    if (triggered || trap.life <= 0) traps.splice(i, 1);
  }
}

function updateSlashes() {
  for (let i = slashes.length - 1; i >= 0; i -= 1) {
    const slash = slashes[i];
    slash.life -= 1;
    for (const zombie of zombies) {
      if (zombie.downFor > 0 || !zombie.active || slash.hit.has(zombie)) continue;
      if (distance(slash, zombie) < slash.radius) {
        slash.hit.add(zombie);
        zombie.health -= slash.damage;
        hitEffects.push({ x: zombie.x, y: zombie.y, radius: zombie.boss ? 18 : 12, life: 8, kind: "meleeHit" });
        if (zombie.health <= 0) {
          registerZombieKill(zombie);
        }
      }
    }
    if (megaBoss && !slash.hit.has(megaBoss) && distance(slash, megaBoss) < slash.radius) {
      slash.hit.add(megaBoss);
      megaBoss.health -= slash.damage;
      hitEffects.push({ x: megaBoss.x, y: megaBoss.y, radius: 22, life: 8, kind: "meleeHit" });
      if (megaBoss.health <= 0) registerMegaBossKill();
    }
    if (slash.life <= 0) slashes.splice(i, 1);
  }
}

function updateCombatEffects() {
  for (let i = hitEffects.length - 1; i >= 0; i -= 1) {
    hitEffects[i].life -= 1;
    if (hitEffects[i].life <= 0) hitEffects.splice(i, 1);
  }

  for (let i = arrowTrails.length - 1; i >= 0; i -= 1) {
    arrowTrails[i].life -= 1;
    if (arrowTrails[i].life <= 0) arrowTrails.splice(i, 1);
  }

  for (let i = spellExplosions.length - 1; i >= 0; i -= 1) {
    spellExplosions[i].life -= 1;
    spellExplosions[i].radius += 1.6;
    if (spellExplosions[i].life <= 0) spellExplosions.splice(i, 1);
  }

  for (let i = acidPools.length - 1; i >= 0; i -= 1) {
    acidPools[i].life -= 1;
    if (acidPools[i].life <= 0) acidPools.splice(i, 1);
  }

  for (let i = damageNumbers.length - 1; i >= 0; i -= 1) {
    damageNumbers[i].life -= 1;
    damageNumbers[i].drift += 0.18;
    if (damageNumbers[i].life <= 0) damageNumbers.splice(i, 1);
  }

  for (let i = goreEffects.length - 1; i >= 0; i -= 1) {
    goreEffects[i].life -= 1;
    if (goreEffects[i].life <= 0) goreEffects.splice(i, 1);
  }

  for (let i = ultimateEffects.length - 1; i >= 0; i -= 1) {
    ultimateEffects[i].life -= 1;
    ultimateEffects[i].radius += ultimateEffects[i].kind === "mage" ? 2.8 : 1.8;
    if (ultimateEffects[i].life <= 0) ultimateEffects.splice(i, 1);
  }

  if (screenShake > 0) screenShake = Math.max(0, screenShake - 1);
  if (player.invuln > 0) player.invuln -= 1;
  if (player.shieldTimer > 0) player.shieldTimer -= 1;
}

function updateZombies() {
  const diff = difficultyConfig[settingsState.difficulty];
  const { totalCap, bossCap } = activeEnemyTargets();
  const normalCap = Math.max(0, totalCap - bossCap);
  const enemyScale = 1 + player.upgradeLevel * 0.02 + survival.elapsed / 900;
  survival.elapsed += 1 / 60;
  survival.hordeLevel = 1 + Math.floor(totalCap / 3);
  survival.bossesAwake = bossCap;

  let activeNormals = 0;
  let activeBosses = 0;

  for (const zombie of zombies) {
    if (zombie.boss) {
      zombie.active = activeBosses < bossCap;
      if (zombie.active) activeBosses += 1;
    } else {
      zombie.active = activeNormals < normalCap;
      if (zombie.active) activeNormals += 1;
    }
  }

  for (const zombie of zombies) {
    if (zombie.downFor > 0) {
      zombie.downFor -= 1;
      if (zombie.downFor <= 0) {
        zombie.x = zombie.homeX;
        zombie.y = zombie.homeY;
        zombie.health = zombie.maxHealth;
        zombie.cooldown = 0;
      }
      continue;
    }

    if (!zombie.active) {
      zombie.anim = 0;
      continue;
    }

    const desired = Math.atan2(player.y - zombie.y, player.x - zombie.x);
    const speed = zombie.speed * diff.enemySpeed * (zombie.boss ? 1 + enemyScale * 0.05 : 1 + enemyScale * 0.03);
    const idealRange = zombie.archetype === "spitter" ? 150 : zombie.bossType === "marsh" ? 170 : 0;
    const currentDistance = distance(zombie, player);
    const movingForward = idealRange === 0 || currentDistance > idealRange;
    const nextX = zombie.x + Math.cos(desired) * speed;
    const nextY = zombie.y + Math.sin(desired) * speed;
    if (movingForward && !collidesOnFoot(nextX, nextY)) {
      zombie.x = nextX;
      zombie.y = nextY;
      zombie.dir = desired;
      zombie.anim += zombie.boss ? 0.07 : 0.11;
    } else {
      zombie.dir = angleLerp(zombie.dir, desired + 0.4, 0.4);
      zombie.anim = 0;
    }

    if (zombie.cooldown > 0) zombie.cooldown -= 1;
    if (zombie.specialCooldown > 0) zombie.specialCooldown -= 1;

    if (zombie.archetype === "spitter" && currentDistance < 220 && zombie.specialCooldown <= 0) {
      projectiles.push({ x: zombie.x, y: zombie.y, angle: desired, speed: 6, life: 50, damage: 5, size: 6, kind: "acid" });
      zombie.specialCooldown = 90;
    }

    if (zombie.archetype === "summoner" && zombie.specialCooldown <= 0 && zombies.length < zombieSpawns.length + 8) {
      zombies.push(createZombie({ x: zombie.x + Math.cos(worldTime * 4 + zombie.x) * 26, y: zombie.y + Math.sin(worldTime * 3 + zombie.y) * 26, dir: zombie.dir, sprite: sprites.zombieA, boss: false, archetype: "runner" }));
      zombie.specialCooldown = 240;
      playTone("triangle", 180, 0.08, 0.02);
    }

    if (distance(zombie, player) < (zombie.boss ? 28 : 24) && zombie.cooldown <= 0) {
      const damage = zombie.archetype === "armored" ? zombie.damage * 1.2 : zombie.damage;
      dealPlayerDamage(damage * diff.enemyDamage * (zombie.boss ? 1.05 : 1), zombie.boss ? "boss" : "hit");
      if (zombie.boss) screenShake = Math.max(screenShake, 12);
      zombie.cooldown = zombie.boss ? 34 : 22;
    }
  }

  if (!megaBoss) return;

  if (megaBoss.roarTimer > 0) {
    megaBoss.roarTimer -= 1;
    megaBoss.anim = 0;
    if (megaBoss.roarTimer % 18 === 0) screenShake = Math.max(screenShake, 8);
  } else {
    const desired = Math.atan2(player.y - megaBoss.y, player.x - megaBoss.x);
    const speed = megaBoss.speed * diff.enemySpeed;
    const nextX = megaBoss.x + Math.cos(desired) * speed;
    const nextY = megaBoss.y + Math.sin(desired) * speed;
    if (!collidesOnFoot(nextX, nextY)) {
      megaBoss.x = nextX;
      megaBoss.y = nextY;
      megaBoss.dir = desired;
      megaBoss.anim += 0.05;
      megaBoss.stompTimer += 1;
      if (megaBoss.stompTimer >= 18) {
        screenShake = Math.max(screenShake, 6);
        megaBoss.stompTimer = 0;
      }
    } else {
      megaBoss.dir = angleLerp(megaBoss.dir, desired + 0.35, 0.35);
      megaBoss.anim = 0;
    }
  }

  if (megaBoss.cooldown > 0) megaBoss.cooldown -= 1;
  if (megaBoss.acidCooldown > 0) megaBoss.acidCooldown -= 1;

  for (const pool of acidPools) {
    if (distance(pool, player) < pool.radius * 0.55) {
      dealPlayerDamage(0.18 * diff.enemyDamage, "acidPool");
    }
  }

  if (distance(megaBoss, player) < 34 && megaBoss.cooldown <= 0) {
    dealPlayerDamage(megaBoss.damage * diff.enemyDamage, "boss");
    screenShake = Math.max(screenShake, 16);
    megaBoss.cooldown = 42;
  }

  if (megaBoss.roarTimer <= 0 && distance(megaBoss, player) < 320 && megaBoss.acidCooldown <= 0) {
    const desired = Math.atan2(player.y - megaBoss.y, player.x - megaBoss.x);
    projectiles.push({
      x: megaBoss.x + Math.cos(desired) * 22,
      y: megaBoss.y + Math.sin(desired) * 22,
      angle: desired,
      speed: 7,
      life: 52,
      damage: 12,
      size: 8,
      kind: "acid",
    });
    megaBoss.acidCooldown = 72;
  }
}

function updateHearts() {
  const respawnTime = difficultyConfig[settingsState.difficulty].heartRespawn;
  for (const heart of hearts) {
    if (!heart.active) {
      heart.cooldown -= 1;
      if (heart.cooldown <= 0) heart.active = true;
      continue;
    }

    if (distance(player, heart) < 20 && player.health < 100) {
      player.health = clamp(player.health + 24, 0, 100);
      heart.active = false;
      heart.cooldown = respawnTime;
      mission.message = "Heart collected.";
    }
  }
}

function handleMission() {
  const target = currentTarget();
  const missionType = currentMissionType();
  const nearTarget = distance(player, target) < 54;

  if (missionType === "deliver" && nearTarget) {
    mission.chain += 1;
    mission.activeIndex += 1;
    player.money += 90 + mission.chain * 26;
    mission.message = `Supply run finished at ${target.name}. Head to ${currentTarget().name}.`;
    survival.elapsed += 7;
    return;
  }

  if (missionType === "activate") {
    if (nearTarget) {
      missionState.progress += 1;
      if (missionState.progress >= 90) {
        mission.chain += 1;
        mission.activeIndex += 1;
        missionState.progress = 0;
        player.money += 120 + mission.chain * 20;
        mission.message = `Beacon lit at ${target.name}. Next signal at ${currentTarget().name}.`;
      } else {
        mission.message = `Activating beacon at ${target.name}...`;
      }
    } else {
      missionState.progress = 0;
    }
    return;
  }

  if (missionType === "defend") {
    if (nearTarget && missionState.defendTimer <= 0) missionState.defendTimer = 300;
    if (missionState.defendTimer > 0) {
      missionState.defendTimer -= 1;
      mission.message = `Defend ${target.name} for ${Math.ceil(missionState.defendTimer / 60)}s.`;
      if (!nearTarget) missionState.defendTimer = Math.max(0, missionState.defendTimer - 2);
      if (missionState.defendTimer <= 0) {
        mission.chain += 1;
        mission.activeIndex += 1;
        player.money += 150 + mission.chain * 22;
        mission.message = `Shrine defended. Travel to ${currentTarget().name}.`;
      }
    }
    return;
  }

  if (missionType === "recover") {
    if (!missionState.relicArmed && nearTarget) {
      missionState.relicArmed = true;
      mission.activeIndex += 1;
      mission.message = `Relic recovered. Escape to ${currentTarget().name}.`;
      return;
    }
    if (missionState.relicArmed && nearTarget) {
      missionState.relicArmed = false;
      mission.chain += 1;
      mission.activeIndex += 1;
      player.money += 180 + mission.chain * 24;
      mission.message = `Relic delivered. New lead at ${currentTarget().name}.`;
    }
  }
}

function updateWorldEvent() {
  if (worldEvent.active) {
    worldEvent.timer -= 1;
    if (worldEvent.active === "healingGrove" && distance(player, currentTarget()) < 88) {
      player.health = clamp(player.health + 0.08, 0, player.maxHealth);
    }
    if (worldEvent.active === "meteorRain" && Math.random() < 0.03) {
      const strike = { x: player.x + (Math.random() - 0.5) * 220, y: player.y + (Math.random() - 0.5) * 180, radius: 28 + Math.random() * 16, life: 18, kind: "fire" };
      spellExplosions.push(strike);
      if (distance(player, strike) < strike.radius) dealPlayerDamage(7, "boss");
    }
    if (worldEvent.timer <= 0) {
      worldEvent.active = null;
      worldEvent.cooldown = 900;
      worldEvent.message = "";
    }
    return;
  }

  worldEvent.cooldown -= 1;
  if (worldEvent.cooldown > 0) return;
  const event = randomEventTemplates[Math.floor(Math.random() * randomEventTemplates.length)];
  worldEvent.active = event.type;
  worldEvent.timer = event.duration;
  worldEvent.cooldown = 1200;
  worldEvent.message = event.title;
  mission.message = `${event.title} has begun.`;
}

function updateUI() {
  if (gameState !== "playing") {
    ui.objective.textContent = "Menu-driven medieval survival adventure.";
    ui.area.textContent = `Difficulty: ${settingsState.difficulty} | Sound: ${settingsState.soundOn ? "on" : "off"}`;
    ui.status.textContent = "Use the canvas menu to play, choose class, and change settings.";
    return;
  }

  const area = nearestArea();
  const upgrade = nextUpgrade();
  const sinkPreview = sinkDefinitions().map((sink) => `${sink.key}:${sink.name} ${sink.cost}`).join(" | ");
  ui.objective.textContent = `${mission.message} Current marker: ${currentTarget().name}. Next training: ${upgrade.name} for ${upgrade.cost} gold at ${upgradeStation.name}. Branch(Z): ${branchName()}. Passives: ${sinkPreview}.`;
  ui.area.textContent = `${area.name} | Gold: ${player.money} | Health: ${Math.round(player.health)}`;
  ui.status.textContent = `${currentClass().name} | ${currentUpgrade().name} | ${branchName()} | Objective ${currentMissionType()} | Event ${worldEvent.active || "calm"} | Bosses ${survival.bossesAwake}/${survival.bossesKilled} slain | ${survival.megaBossAwake ? "Mega Boss active" : "Mega Boss dormant"}`;
}

