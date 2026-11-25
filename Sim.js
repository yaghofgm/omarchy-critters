.pragma library
.import "Rig.js" as Rig
.import "Lines.js" as Lines

// The ninjas' world: Hyprland windows as floors, physics, the pagoda dojo
// they build together, and the events (duels, tournaments, group kata) that
// choreograph several ninjas at once. Pure JS, no QML: the service owns
// timing and the overlay owns drawing.
//
// Coordinates are Hyprland's global logical layout pixels (what `hyprctl -j
// clients` reports). A ninja lives *inside* a window, standing on its bottom
// edge (or on an upper floor of the dojo); when that window is not on
// screen, neither is the ninja.

var H0 = 44            // figure height at size 1.0, logical px
var GRAVITY = 2600     // px/s^2

// ---------------------------------------------------------------- content

var NAMES = ["Kage", "Hayate", "Mochi", "Shinobu", "Kaze", "Tofu", "Yoru", "Sora", "Ren", "Hikari",
  "Daichi", "Kumo", "Natsu", "Yuki", "Raiden", "Momo", "Taro", "Akira", "Suzu", "Kiri", "Botan", "Jiro"]

var BANDS = ["#e0393e", "#3a86ff", "#2ec27e", "#9b5de5", "#ff8c42", "#00b4d8", "#f15bb5", "#8d99ae"]
var MASTER_BAND = "#f2c14e"

var BELTS = [
  { name: "White", xp: 0, color: "#f2f2f2" },
  { name: "Yellow", xp: 300, color: "#f4d03f" },
  { name: "Orange", xp: 900, color: "#f39c34" },
  { name: "Green", xp: 1800, color: "#3fae5a" },
  { name: "Blue", xp: 3200, color: "#3a7bd5" },
  { name: "Purple", xp: 5000, color: "#8e44ad" },
  { name: "Brown", xp: 7500, color: "#7a4a23" },
  { name: "Black", xp: 11000, color: "#121212" },
  { name: "Golden", xp: 16000, color: "#e0b030", noBelt: true },
  { name: "Divine", xp: 24000, color: "#fff4cf", noBelt: true }
]
var B_ORANGE = 2, B_GREEN = 3, B_BLACK = 7

// Dojo construction, in order. `work` is how many planks it takes.
var STAGES = [
  { name: "Clearing", work: 3 },
  { name: "Floor", work: 8 },
  { name: "Pillars", work: 12 },
  { name: "Beams", work: 14 },
  { name: "Roof", work: 24 },
  { name: "Sign", work: 10 },
  { name: "Lanterns", work: 14 },
  { name: "Dummy", work: 16 },
  { name: "Gong", work: 18 },
  { name: "Weapon rack", work: 20 },
  { name: "Cherry tree", work: 24 },
  { name: "Second floor", work: 36 },
  { name: "Second roof", work: 40 },
  { name: "Balcony", work: 24 },
  { name: "Third floor", work: 44 },
  { name: "Third roof", work: 48 },
  { name: "Spire", work: 24 }
]
var S_FLOOR = 1, S_PILLARS = 2, S_BEAMS = 3, S_ROOF = 4, S_SIGN = 5, S_LANTERNS = 6
var S_DUMMY = 7, S_GONG = 8, S_RACK = 9, S_TREE = 10
var S_FLOOR2 = 11, S_ROOF2 = 12, S_BALCONY = 13, S_FLOOR3 = 14, S_ROOF3 = 15, S_SPIRE = 16

// Floor levels of the pagoda, in figure units: height above the window
// floor and half-width of the walkable deck.
var TIERS = [{ y: 0, half: 3.2 }, { y: 2.95, half: 2.3 }, { y: 5.45, half: 1.5 }]

// Finishing these stages brings a new recruit (up to the population cap).
var RECRUIT_AFTER = { 1: true, 2: true, 4: true, 6: true, 8: true, 10: true, 12: true, 14: true, 16: true }

// ---------------------------------------------------------------- utils

function rand(a, b) { return a + Math.random() * (b - a) }
function irand(a, b) { return Math.floor(rand(a, b + 1)) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function chance(p) { return Math.random() < p }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v) }

function weighted(list) {
  var total = 0
  for (var i = 0; i < list.length; i++) total += list[i][0]
  var r = Math.random() * total
  for (var j = 0; j < list.length; j++) {
    r -= list[j][0]
    if (r <= 0 && list[j][0] > 0) return list[j][1]
  }
  for (var k = list.length - 1; k >= 0; k--) if (list[k][0] > 0) return list[k][1]
  return list[list.length - 1][1]
}

function shuffle(arr) {
  var a = arr.slice()
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

function dayOf(c) {
  return Math.max(1, Math.floor((Date.now() - (c.born || Date.now())) / 86400000) + 1)
}

function ageHours(c) { return Math.max(0, (Date.now() - (c.born || Date.now())) / 3600000) }

// ---------------------------------------------------------------- ninja stats

// How built a ninja is, 0 (scrawny) to 1 (mountain).
function physique(c) { return 1 - Math.exp(-(c.xp || 0) / 4000) }

function beltIndex(c) {
  var i = 0
  while (i + 1 < BELTS.length && (c.xp || 0) >= BELTS[i + 1].xp) i++
  return i
}
function belt(c) { return BELTS[beltIndex(c)] }

// Fighting strength. Training dominates: a full belt ahead wins most of the
// time. Age adds up to 25% (experience), and personal luck nudges by a few
// percent either way, so upsets happen but stay rare.
function power(c) {
  var age = 1 + 0.25 * (1 - Math.exp(-ageHours(c) / 48))
  var luck = 1 + ((c.luck || 1) - 1) * 0.35
  return Math.pow(50 + (c.xp || 0), 0.8) * age * luck * condition(c) * (1 + (c.form || 0))
}

// Odds for a fight right now: training, but also health, form, element,
// and nerves in big moments.
function winChance(a, b, title) {
  var adv = advantage(a, b)
  var ca = title && hasTrait(a, "clutch") ? 1.12 : 1, cb = title && hasTrait(b, "clutch") ? 1.12 : 1
  var pa = Math.pow(power(a) * adv * ca, 3), pb = Math.pow(power(b) * cb, 3)
  return pa / (pa + pb)
}

function isMaster(w, c) { return w.masterId === c.id }

// The sensei is simply the most experienced ninja. When someone overtakes
// them the title passes, with a bow from the old sensei if they're nearby.
function updateSensei(w) {
  var top = null
  for (var i = 0; i < w.critters.length; i++) if (!top || w.critters[i].xp > top.xp) top = w.critters[i]
  if (!top || w.masterId === top.id) return
  var prev = w.masterId ? find(w, w.masterId) : null
  w.masterId = top.id
  chronicle(w, top.name + " became sensei as the most experienced ninja" + (prev ? ", succeeding " + prev.name : "") + ".")
  for (var k = 0; k < w.critters.length; k++) {
    var o = w.critters[k]
    if (o === top) remember(w, o, "I'm the most experienced ninja now, so I became the sensei.", true)
    else if (o === prev) remember(w, o, top.name + " overtook me in experience and became sensei.", true)
    else remember(w, o, top.name + " is our new sensei.")
  }
  if (top.visible && top.mode === "ground" && !top.event && !top.injured) {
    floatText(top, "SENSEI " + top.name.toUpperCase(), top.fx, top.fy - top.H * 1.9, { size: 13, color: "#f2c14e", life: 3000, vy: -10 })
    sparkle(top.parts, top.fx, top.fy - top.H, 10, top.H, "#f2c14e")
    q2front(top, [A("victory", 2200, { start: function (w2, c2) { say(c2, pick(["I'll guide you all.", "The staff is mine to carry.", "Train hard. I'm watching."])) } })])
  }
  if (prev && prev.visible && prev.home === top.home && prev.mode === "ground" && !prev.event && !prev.injured) {
    q2front(prev, [face(top.rel > prev.rel ? 1 : -1), A("bow"), S(pick(["The title is yours.", "Well earned.", "Carry it well."]))])
  }
}
// A ninja's colour is theirs for life; the sensei is marked by regalia instead.
function bandColor(w, c) { return c.band }

// Experience comes slowly: a physique you can see changes over hours of
// screen time, a black belt takes days.
var XP_RATE = 0.25
// What a ninja remembers (feeds their mind, if they have one). Urgent
// memories make the mind reconsider soon.
function remember(w, c, text, urgent) {
  if (!c) return
  if (!c.memory) c.memory = []
  // The same thing again just bumps a counter, so repeats can't crowd out
  // everything else they remember.
  for (var i = 0; i < c.memory.length; i++) {
    if (c.memory[i].text === text) {
      var again = c.memory.splice(i, 1)[0]
      again.n = (again.n || 1) + 1
      again.t = Date.now()
      c.memory.push(again)
      if (urgent) c.mindUrgent = true
      return
    }
  }
  c.memory.push({ t: Date.now(), text: text })
  if (c.memory.length > 12) c.memory.shift()
  if (urgent) c.mindUrgent = true
}

// The dojo's shared history, for the storyteller.
function chronicle(w, text) {
  w.chronicle.push(text)
  if (w.chronicle.length > 15) w.chronicle.shift()
}

function gainXp(c, n) {
  c.xp = (c.xp || 0) + n * XP_RATE * (c.diligence || 1) * (hasTrait(c, "prodigy") ? 1.4 : 1)
  var b = beltIndex(c)
  if (c.beltSeen !== undefined && b > c.beltSeen) c.pendingBelt = b
  c.beltSeen = b
}

// Current sensei's name, for lines that mention them.
var MASTER_NAME = "Sensei"

function fmt(text, c, extra) {
  var s = String(text).split("{day}").join(String(dayOf(c)))
    .split("{name}").join(c.name)
    .split("{master}").join(MASTER_NAME)
  for (var k in (extra || {})) s = s.split("{" + k + "}").join(extra[k])
  return s.split("{other}").join("friend")
}

// A line in this ninja's own voice.
function LN(c, key, other) {
  return fmt(Lines.line(c, key), c, other ? { other: other.name } : null)
}

// ---------------------------------------------------------------- world

function createWorld() {
  return {
    t: 0, size: 1.0, hidden: false, nextId: 1,
    monitors: [], monitorByName: {}, windows: {}, activeAddr: "", focusedMon: "",
    critters: [], events: [], dojo: null, dojoParts: [], masterId: null, decor: [], decorVersion: 0, rel: {}, fightLog: [], raid: null, nextRaid: 45 * 60000,
    followFocus: true, activeSince: 0,
    chronicle: [], mindQueue: [], mindOn: false,
    activeMs: 0, nextTournament: 30 * 60000, cap: 6, recruitAt: 0,
    dirty: true
  }
}

// Rebuild the platform list from hyprctl JSON.
function setLayout(w, monitorsJson, clientsJson, activeAddr) {
  var mons = []
  var byName = {}
  var byId = {}
  for (var i = 0; i < monitorsJson.length; i++) {
    var m = monitorsJson[i]
    var sc = m.scale || 1
    var rotated = (m.transform || 0) % 2 === 1
    var lw = (rotated ? m.height : m.width) / sc
    var lh = (rotated ? m.width : m.height) / sc
    var mon = {
      name: m.name, id: m.id, x: m.x, y: m.y, w: Math.round(lw), h: Math.round(lh),
      ws: m.activeWorkspace ? m.activeWorkspace.id : null,
      special: m.specialWorkspace ? m.specialWorkspace.id : 0,
      focused: !!m.focused, fullscreen: false
    }
    mons.push(mon)
    byName[mon.name] = mon
    byId[m.id] = mon
    if (mon.focused) w.focusedMon = mon.name
  }

  var wins = {}
  for (var j = 0; j < clientsJson.length; j++) {
    var cl = clientsJson[j]
    var cm = byId[cl.monitor]
    if (!cm || !cl.mapped || cl.hidden) continue
    var wsId = cl.workspace ? cl.workspace.id : null
    var visible = wsId === cm.ws || (cm.special !== 0 && wsId === cm.special)
    var win = { addr: cl.address, x: cl.at[0], y: cl.at[1], w: cl.size[0], h: cl.size[1],
      mon: cm.name, visible: visible, fullscreen: cl.fullscreen || 0, floating: !!cl.floating, cls: cl.class || "" }
    if (visible && win.fullscreen >= 2) cm.fullscreen = true
    if (win.w < 60 || win.h < 60) win.visible = false
    wins[win.addr] = win
  }

  w.monitors = mons
  w.monitorByName = byName
  w.windows = wins
  if ((activeAddr || "") !== w.activeAddr) w.activeSince = w.t
  w.activeAddr = activeAddr || ""
  if (w.activeAddr && wins[w.activeAddr]) w.lastActiveAddr = w.activeAddr

  for (var k = 0; k < w.critters.length; k++) homeCheck(w, w.critters[k])
  if (w.dojo && w.dojo.home && !wins[w.dojo.home]) {
    w.dojo.home = null
    w.dojoParts = []
  }
  w.dirty = true
}

function windowOf(w, addr) { return addr ? (w.windows[addr] || null) : null }

function monitorOf(w, c) {
  var win = windowOf(w, c.home)
  var name = win ? win.mon : c.mon
  return w.monitorByName[name] || w.monitorByName[w.focusedMon] || w.monitors[0] || null
}

function visibleWindowsOn(w, monName) {
  var out = []
  for (var a in w.windows) {
    var win = w.windows[a]
    if (win.visible && win.mon === monName) out.push(win)
  }
  return out
}

function isVisible(w, c) {
  if (w.hidden) return false
  var mon = monitorOf(w, c)
  if (!mon || mon.fullscreen) return false
  if (c.mode === "drag" || c.mode === "air" || c.mode === "leap") return true
  if (!c.home) return true
  var win = windowOf(w, c.home)
  return !!(win && win.visible)
}

// Where the floor is for a home (window bottom inside, or the monitor's floor).
function floorOf(w, homeAddr, monName) {
  var win = windowOf(w, homeAddr)
  if (win) return { x0: win.x, x1: win.x + win.w, y: win.y + win.h - 2, top: win.y }
  var mon = w.monitorByName[monName] || w.monitors[0]
  if (!mon) return { x0: 0, x1: 800, y: 600, top: 0 }
  return { x0: mon.x, x1: mon.x + mon.w, y: mon.y + mon.h - 1, top: mon.y }
}

function halfWidth(c) { return c.H * 0.35 }

// Height of a dojo level above its window floor, in px.
function levelY(w, level) { return level > 0 ? TIERS[level].y * sizeFor(w) : 0 }

function levelOpen(w, level) {
  if (level === 0) return true
  var d = w.dojo
  if (!d || !d.home) return false
  return level === 1 ? d.stage > S_FLOOR2 : d.stage > S_FLOOR3
}

function topLevel(w) { return levelOpen(w, 2) ? 2 : (levelOpen(w, 1) ? 1 : 0) }

// ---------------------------------------------------------------- critters

function sizeFor(w) { return Math.round(H0 * w.size) }

function unusedName(w) {
  var used = {}
  for (var i = 0; i < w.critters.length; i++) used[w.critters[i].name] = true
  var free = NAMES.filter(function (n) { return !used[n] })
  return free.length ? pick(free) : pick(NAMES) + " " + irand(2, 9)
}

function unusedBand(w) {
  var used = {}
  for (var i = 0; i < w.critters.length; i++) used[w.critters[i].band] = true
  var free = BANDS.filter(function (b) { return !used[b] })
  return free.length ? pick(free) : pick(BANDS)
}

function newNinja(w, opts) {
  opts = opts || {}
  var H = sizeFor(w)
  return {
    id: opts.id || ("c" + (w.nextId++)), kind: "ninja", name: opts.name || unusedName(w),
    band: opts.band || unusedBand(w), luck: opts.luck || Math.round(rand(0.8, 1.25) * 100) / 100,
    diligence: opts.diligence || Math.round(rand(0.6, 1.5) * 100) / 100,
    personality: opts.personality || Lines.randomPersonality(),
    element: opts.element || null, pendingBelt: null, clones: null, hiddenUntil: 0,
    traits: opts.traits || null, hp: opts.hp, form: opts.form || 0, injured: !!opts.injured, injuredAt: opts.injuredAt || 0, injuries: opts.injuries || 0,
    memory: opts.memory || [], mood: opts.mood || "calm", thought: "", mindPlan: null, mindUrgent: false, nextMind: 0,
    xp: opts.xp || 0, born: opts.born || Date.now(),
    wins: opts.wins || 0, losses: opts.losses || 0, titles: opts.titles || 0, planks: opts.planks || 0,
    H: H, home: null, mon: w.focusedMon, rel: 0, level: 0, x: 0, y: 0, fx: 0, fy: 0,
    vx: 0, vy: 0, mode: "ground", facing: chance(0.5) ? 1 : -1,
    anim: "stand", animT0: w.t, expr: null, prop: null, carry: null,
    queue: [], cur: null, curT: 0, emitT: 0,
    bubble: null, parts: [], leap: null, event: null, eventIdle: null,
    nextChat: w.t + rand(15000, 40000), dummy: null, stuck: [],
    bbox: { x: 0, y: 0, w: 1, h: 1 }, hits: []
  }
}

// Choose where a newly arriving ninja lives.
function arrivalHome(w) {
  var active = windowOf(w, w.activeAddr)
  if (active && active.visible) return active
  var mons = visibleWindowsOn(w, w.focusedMon)
  if (mons.length) return pick(mons)
  return null
}

function spawn(w, kind, opts) {
  var c = newNinja(w, opts)
  if (!c.element) c.element = bornElement(c.personality)
  if (!c.traits) c.traits = rollTraits(c.personality, opts && opts.recruit)
  if (c.hp === undefined || c.hp === null) c.hp = maxHp(c)
  c.beltSeen = beltIndex(c)
  w.critters.push(c)
  enter(w, c, opts && opts.home ? windowOf(w, opts.home) : null)
  w.dirty = true
  return c
}

// Arrival: drop in from the top of the window with a puff.
function enter(w, c, win) {
  win = win || arrivalHome(w)
  var mon = win ? w.monitorByName[win.mon] : w.monitorByName[w.focusedMon]
  if (!mon) mon = w.monitors[0]
  c.mon = mon ? mon.name : ""
  var fl = floorOf(w, win ? win.addr : null, c.mon)
  var hw = halfWidth(c)
  var x = rand(fl.x0 + hw + 8, Math.max(fl.x0 + hw + 9, fl.x1 - hw - 8))
  c.home = null
  c.level = 0
  c.x = x
  c.y = fl.top + c.H * 1.2
  c.vx = 0
  c.vy = 0
  c.mode = "air"
  c.enterTarget = win ? win.addr : null
  c.entering = true
  interrupt(c)
  puff(c, x, c.y - c.H * 0.5, 6)
}

function remove(w, id) {
  for (var i = 0; i < w.critters.length; i++) {
    if (w.critters[i].id === id) {
      var c = w.critters[i]
      leaveEvent(w, c)
      w.critters.splice(i, 1)
      if (w.masterId === id) w.masterId = null
      w.dirty = true
      return true
    }
  }
  return false
}

function find(w, id) {
  for (var i = 0; i < w.critters.length; i++) if (w.critters[i].id === id) return w.critters[i]
  return null
}

function setSize(w, size) {
  w.size = clamp(size, 0.6, 2.0)
  for (var i = 0; i < w.critters.length; i++) w.critters[i].H = sizeFor(w)
  w.dirty = true
}

// Bring a ninja to the focused window.
function summon(w, id) {
  var c = find(w, id)
  if (!c) return
  var win = arrivalHome(w)
  if (!win) return
  if (c.event) { say(c, "Busy!", 1500); return }
  if (c.mode === "ground" && c.home === win.addr) {
    say(c, pick(["I'm right here.", "Yes?", "Present."]), 2000)
    return
  }
  interrupt(c)
  if (c.mode === "ground" && win.mon === monitorOf(w, c).name && isVisible(w, c)) {
    startLeap(w, c, win.addr, rand(0.25, 0.75) * win.w, null, 0)
  } else {
    puff(c, c.x, c.y - c.H / 2, 5)
    c.mon = win.mon
    c.home = null
    c.level = 0
    c.x = win.x + rand(0.25, 0.75) * win.w
    c.y = win.y + c.H
    c.mode = "air"
    c.enterTarget = win.addr
    c.entering = true
    c.vx = 0
    c.vy = 0
  }
}

// ---------------------------------------------------------------- speech + particles

function wrap(text, maxChars) {
  var words = String(text).split(" ")
  var lines = []
  var cur = ""
  for (var i = 0; i < words.length; i++) {
    var next = cur ? cur + " " + words[i] : words[i]
    if (next.length > maxChars && cur) {
      lines.push(cur)
      cur = words[i]
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

var BUBBLE_SEQ = 0

// How long a line needs to stay up to be read comfortably.
function readMs(text) { return 1500 + String(text).length * 90 }

function say(c, text, ms, extra) {
  text = fmt(text, c, extra)
  // Never shorter than it takes to read, whatever the caller asked for.
  ms = Math.max(ms || 0, readMs(text))
  var lines = wrap(text, 24)
  var longest = 0
  for (var i = 0; i < lines.length; i++) longest = Math.max(longest, lines[i].length)
  c.bubble = { lines: lines, until: -1, ms: ms,
    w: Math.round(longest * 6.4 + 16), h: lines.length * 13 + 10, born: ++BUBBLE_SEQ }
}

function addPart(list, p) {
  if (list.length > 90) list.shift()
  p.age = 0
  p.life = p.life || 1000
  p.vx = p.vx || 0
  p.vy = p.vy || 0
  p.g = p.g || 0
  p.rot = p.rot || 0
  p.vr = p.vr || 0
  list.push(p)
}

function puff(c, x, y, n) {
  for (var i = 0; i < n; i++) {
    addPart(c.parts, { type: "smoke", x: x + rand(-c.H * 0.3, c.H * 0.3), y: y + rand(-c.H * 0.3, c.H * 0.3),
      vx: rand(-40, 40), vy: rand(-50, -10), life: rand(500, 900), size: c.H * rand(0.18, 0.32) })
  }
}

function floatText(c, text, x, y, opts) {
  opts = opts || {}
  addPart(opts.list || c.parts, { type: "text", text: text, x: x, y: y, vx: opts.vx || rand(-8, 8), vy: opts.vy || -28,
    life: opts.life || 1400, size: opts.size || 11, color: opts.color || null })
}

function stars(c, x, y, n) {
  for (var i = 0; i < n; i++) {
    addPart(c.parts, { type: "star", x: x, y: y, vx: rand(-90, 90), vy: rand(-140, -40), g: 300,
      life: rand(600, 1000), size: c.H * 0.09, vr: rand(-8, 8) })
  }
}

function dust(c, x, y, n) {
  for (var i = 0; i < n; i++) {
    addPart(c.parts, { type: "dust", x: x + rand(-c.H * 0.3, c.H * 0.3), y: y - 2, vx: rand(-60, 60), vy: rand(-40, -5),
      life: rand(300, 600), size: c.H * rand(0.06, 0.12) })
  }
}

function sparkle(list, x, y, n, H, color) {
  for (var i = 0; i < n; i++) {
    addPart(list, { type: "star", x: x + rand(-H * 0.4, H * 0.4), y: y + rand(-H * 0.4, H * 0.2), vx: rand(-50, 50), vy: rand(-120, -30), g: 120,
      life: rand(800, 1400), size: H * 0.08, vr: rand(-6, 6), color: color })
  }
}

// Run `fn` after `ms` milliseconds (piggybacks on the particle clock).
function later(c, ms, fn) {
  c.parts.push({ type: "delay", age: 0, life: ms, x: c.fx, y: c.fy, vx: 0, vy: 0, g: 0, rot: 0, vr: 0,
    onDone: function (w2, c2) { fn(w2, c2) } })
}

// ---------------------------------------------------------------- step machine

function interrupt(c) {
  c.queue = []
  c.cur = null
  c.prop = null
  c.expr = null
  c.carry = null
}

function setAnim(w, c, name) {
  if (c.anim !== name) {
    c.anim = name
    c.animT0 = w.t
  }
}

function replay(w, c, name) {
  c.anim = name
  c.animT0 = w.t
}

function q(c, steps) {
  for (var i = 0; i < steps.length; i++) if (steps[i]) c.queue.push(steps[i])
}

function q2front(c, steps) {
  for (var i = steps.length - 1; i >= 0; i--) if (steps[i]) c.queue.unshift(steps[i])
}

// Step helpers.
function A(name, dur, extra) {
  var s = { a: "anim", name: name, dur: dur === undefined ? Rig.animLength(name) : dur }
  for (var k in (extra || {})) s[k] = extra[k]
  return s
}
function W(to, extra) {
  var s = { a: "walk", to: to, speed: 1.6 }
  for (var k in (extra || {})) s[k] = extra[k]
  return s
}
function S(text, ms) { return { a: "say", text: text, ms: ms } }
// Move to `to` (a rel, or a function of the critter) in exactly `dur` ms.
function SL(to, dur, anim) { return { a: "slide", to: to, dur: dur, anim: anim || "run" } }
function F(fn) { return { a: "fn", f: fn } }
function face(dir) { return { a: "face", dir: dir } }
// Leap to a window (and dojo level, default the ground).
function L(home, rel, extra) {
  var s = { a: "leap", home: home, rel: rel, level: 0 }
  for (var k in (extra || {})) s[k] = extra[k]
  return s
}
function XP(n) { return F(function (w, c) { gainXp(c, n) }) }

// Come down from an upper dojo floor first, if up there.
function down(c) {
  if (!c.level) return null
  return L(function (w2, c2) { return c2.home }, function (w2, c2) { return dojoRel(w2) + rand(-3.5, 3.5) * c2.H }, { level: 0 })
}

function walkRange(w, c) {
  var fl = floorOf(w, c.home, c.mon)
  var hw = halfWidth(c) + 4
  if (c.level > 0 && w.dojo && w.dojo.home === c.home) {
    var mid = dojoRel(w)
    var half = TIERS[c.level].half * sizeFor(w) - hw
    return [mid - half, mid + half]
  }
  return [hw, Math.max(hw + 1, fl.x1 - fl.x0 - hw)]
}

function isIdle(c) { return c.mode === "ground" && !c.cur && c.queue.length === 0 }

function runSteps(w, c, dt) {
  var guard = 0
  while (guard++ < 6) {
    if (!c.cur) {
      if (!c.queue.length) {
        if (c.event) { setAnim(w, c, c.eventIdle || "guard"); return }
        think(w, c)
      }
      if (!c.queue.length) return
      c.cur = c.queue.shift()
      c.curT = 0
      c.emitT = 0
      startStep(w, c, c.cur)
      if (!c.cur) continue
    }
    var s = c.cur
    var done = false
    if (s.a === "anim") {
      c.curT += dt
      if (s.emit && s.every) {
        c.emitT += dt
        while (c.emitT >= s.every) { c.emitT -= s.every; s.emit(w, c) }
      }
      done = c.curT >= s.dur
    } else if (s.a === "walk") {
      var r = walkRange(w, c)
      var target = clamp(typeof s.to === "function" ? s.to(w, c) : s.to, r[0], r[1])
      var step = s.speed * c.H * dt / 1000
      if (Math.abs(target - c.rel) <= step) { c.rel = target; done = true }
      else { c.facing = target > c.rel ? 1 : -1; c.rel += c.facing * step }
      if (s.dust && Math.random() < 0.08) dust(c, c.fx, c.fy, 1)
    } else if (s.a === "slide") {
      c.curT += dt
      var rs = walkRange(w, c)
      var goal = clamp(typeof s.to === "function" ? s.to(w, c) : s.to, rs[0], rs[1])
      if (s.from === undefined) s.from = c.rel
      var u = clamp(c.curT / s.dur, 0, 1)
      c.rel = s.from + (goal - s.from) * u
      done = c.curT >= s.dur
    } else if (s.a === "fn") {
      s.f(w, c)
      done = true
    } else if (s.a === "say") {
      say(c, s.text, s.ms)
      done = true
    } else if (s.a === "face") {
      c.facing = typeof s.dir === "function" ? s.dir(w, c) : s.dir
      done = true
    } else if (s.a === "leap") {
      done = c.mode === "ground" && c.curT > 0
      c.curT += dt
    } else done = true

    if (!done) return
    if (s.end) s.end(w, c)
    if (s.clearProp) c.prop = null
    c.expr = null
    c.cur = null
    dt = 0
  }
}

function startStep(w, c, s) {
  if (s.prop !== undefined) c.prop = s.prop
  if (s.expr !== undefined) c.expr = s.expr
  if (s.a === "anim") replay(w, c, s.name)
  else if (s.a === "walk") setAnim(w, c, s.anim || (s.speed > 2.5 ? "run" : "walk"))
  else if (s.a === "slide") { s.from = undefined; replay(w, c, s.anim) }
  else if (s.a === "leap") {
    var home = typeof s.home === "function" ? s.home(w, c) : s.home
    var rel = typeof s.rel === "function" ? s.rel(w, c) : s.rel
    var level = typeof s.level === "function" ? s.level(w, c) : (s.level || 0)
    if (!windowOf(w, home) || (home === c.home && level === c.level) || !levelOpen(w, level)) { c.cur = null; return }
    if (level > 0 && (!w.dojo || w.dojo.home !== home)) { c.cur = null; return }
    startLeap(w, c, home, rel, s.anim, level)
  }
  if (s.start) s.start(w, c)
}

// ---------------------------------------------------------------- movement

// Get to a window anywhere: leap if it's on the same monitor, otherwise
// vanish in smoke and drop in from the top of it.
function travel(w, c, addr, rel) {
  var win = windowOf(w, addr)
  if (!win || !win.visible) return null
  if (win.mon === monitorOf(w, c).name) return L(addr, rel)
  return F(function (w2, c2) { dropInto(w2, c2, addr, rel) })
}

// Vanish from wherever they are (any monitor, any workspace) and drop in
// from the top of the target window. Plans and events carry on after.
function dropInto(w, c, addr, rel) {
  var target = windowOf(w, addr)
  if (!target || !target.visible) return false
  if (c.visible) puff(c, c.fx, c.fy - c.H * 0.5, 8)
  c.mon = target.mon
  c.home = null
  c.level = 0
  var r = typeof rel === "function" ? rel(w, c) : rel
  c.x = target.x + clamp(r, c.H, target.w - c.H)
  c.y = target.y + c.H
  c.vx = 0
  c.vy = 0
  c.mode = "air"
  c.enterTarget = addr
  c.entering = true
  c.keepPlan = !!c.event
  puff(c, c.x, c.y, 6)
  return true
}

function startLeap(w, c, homeAddr, rel, anim, level) {
  var win = windowOf(w, homeAddr)
  if (!win) return
  level = level || 0
  c.leap = { sx: c.x, sy: c.y, home: homeAddr, rel: rel, level: level, t: 0, anim: anim || "tuck" }
  var fl = floorOf(w, homeAddr, win.mon)
  var ty = fl.y - levelY(w, level)
  var dist = Math.abs(fl.x0 + rel - c.x) + Math.abs(ty - c.y)
  c.leap.dur = clamp(dist * 1.4, 550, 1300)
  c.leap.apex = clamp(dist * 0.35, c.H * 1.5, c.H * 6) + Math.max(0, c.y - ty) * 0.5
  c.mode = "leap"
  c.facing = fl.x0 + rel > c.x ? 1 : -1
  replay(w, c, c.leap.anim)
  dust(c, c.x, c.y, 4)
}

function tickLeap(w, c, dt) {
  var Lp = c.leap
  var win = windowOf(w, Lp.home)
  if (!win || !levelOpen(w, Lp.level)) { c.mode = "air"; c.vx = 0; c.vy = 0; c.leap = null; c.level = 0; return }
  var fl = floorOf(w, Lp.home, win.mon)
  Lp.t += dt
  var u = clamp(Lp.t / Lp.dur, 0, 1)
  var tx = fl.x0 + Lp.rel
  var ty = fl.y - levelY(w, Lp.level)
  c.x = Lp.sx + (tx - Lp.sx) * u
  c.y = Lp.sy + (ty - Lp.sy) * u - Lp.apex * 4 * u * (1 - u)
  if (u >= 1) {
    c.leap = null
    c.level = Lp.level
    land(w, c, Lp.home, win.mon, 600, true)
  }
}

// Ballistic flight after a throw, a fall, or an arrival.
function tickAir(w, c, dt) {
  var s = dt / 1000
  var mon = w.monitorByName[c.mon] || monitorOf(w, c)
  var prevY = c.y
  c.level = 0
  c.vy += GRAVITY * s
  c.x += c.vx * s
  c.y += c.vy * s
  c.vx *= Math.pow(0.85, s)
  var hw = halfWidth(c)
  if (mon) {
    if (c.x < mon.x + hw) { c.x = mon.x + hw; c.vx = Math.abs(c.vx) * 0.5 }
    if (c.x > mon.x + mon.w - hw) { c.x = mon.x + mon.w - hw; c.vx = -Math.abs(c.vx) * 0.5 }
    if (c.y < mon.y + c.H) { c.y = mon.y + c.H; c.vy = Math.max(0, c.vy) }
  }
  if (c.vy <= 0) return

  // Arrival targets its window directly so it does not drop through gaps.
  if (c.enterTarget) {
    var tw = windowOf(w, c.enterTarget)
    if (tw) {
      var tf = floorOf(w, tw.addr, tw.mon)
      // Crossing the floor, or somehow already below it: land.
      if ((prevY <= tf.y && c.y >= tf.y) || prevY > tf.y) {
        c.x = clamp(c.x, tf.x0 + hw + 4, tf.x1 - hw - 4)
        c.enterTarget = null
        land(w, c, tw.addr, tw.mon, c.vy)
      }
      return
    }
    c.enterTarget = null
  }

  // Land on the first window floor crossed while falling.
  var best = null
  var wins = visibleWindowsOn(w, mon ? mon.name : c.mon)
  for (var i = 0; i < wins.length; i++) {
    var win = wins[i]
    var fl = floorOf(w, win.addr, win.mon)
    if (c.x < fl.x0 + 4 || c.x > fl.x1 - 4) continue
    if (prevY <= fl.y && c.y >= fl.y && (!best || fl.y < best.y)) best = { addr: win.addr, y: fl.y, mon: win.mon }
  }
  if (best) {
    var bf = floorOf(w, best.addr, best.mon)
    c.x = clamp(c.x, bf.x0 + hw + 4, Math.max(bf.x0 + hw + 5, bf.x1 - hw - 4))
    land(w, c, best.addr, best.mon, c.vy)
    return
  }
  if (mon && c.y >= mon.y + mon.h - 1) land(w, c, null, mon.name, c.vy)
}

function land(w, c, homeAddr, monName, speed, fromLeap) {
  var fl = floorOf(w, homeAddr, monName)
  c.home = homeAddr
  c.mon = monName
  c.mode = "ground"
  if (!fromLeap) c.level = 0
  c.y = fl.y - levelY(w, c.level)
  var r = walkRange(w, c)
  c.rel = clamp(c.x - fl.x0, r[0], r[1])
  c.vx = 0
  c.vy = 0
  var arriving = c.entering
  c.entering = false
  if (arriving && c.keepPlan) {
    // Summoned to an event: land and carry on with it.
    c.keepPlan = false
    dust(c, c.x, c.y, 3)
    return
  }
  if (fromLeap) {
    // A planned leap keeps the rest of the plan.
    dust(c, c.x, c.y, 3)
    if (!c.event && !c.level) greetArrival(w, c)
    return
  }
  interrupt(c)
  dust(c, c.x, c.y, speed > 900 ? 6 : 3)
  if (arriving) {
    greetArrival(w, c)
    q(c, [A("guard", 500)])
    if (c.arrivalLine) { q(c, [S(c.arrivalLine)]); c.arrivalLine = null }
    return
  }
  q(c, [A("superhero"), speed > 900 && chance(0.6) ? S(LN(c, "land")) : A("guard", 300)])
}

function fallOff(w, c, line) {
  c.mode = "air"
  c.level = 0
  c.vx = rand(-60, 60)
  c.vy = -200
  interrupt(c)
  leaveEvent(w, c)
  if (line) say(c, line, 1600)
}

// Home window vanished: fall out of it.
function homeCheck(w, c) {
  if (c.mode === "leap" && c.leap && !w.windows[c.leap.home]) {
    c.mode = "air"
    c.leap = null
    c.level = 0
  }
  if (c.mode !== "ground" || !c.home) return
  if (!w.windows[c.home]) {
    c.home = null
    remember(w, c, "My window vanished under me and I fell.", true)
    fallOff(w, c, pick(["Whoa!", "AAAA!", "Hey!", "Not again!"]))
  }
}

// ---------------------------------------------------------------- per-frame

function tick(w, dt) {
  dt = Math.min(dt, 100)
  w.t += dt
  if (Math.floor(w.t / 2000) !== Math.floor((w.t - dt) / 2000)) updateSensei(w)
  var m = w.masterId ? find(w, w.masterId) : null
  MASTER_NAME = m ? m.name : "Sensei"
  var anyVisible = false
  for (var i = 0; i < w.critters.length; i++) {
    tickCritter(w, w.critters[i], dt)
    if (w.critters[i].visible) anyVisible = true
  }
  layoutBubbles(w)
  for (var b = 0; b < w.critters.length; b++) computeBounds(w, w.critters[b])
  if (anyVisible) w.activeMs += dt
  tickEvents(w, dt)
  tickHome(w, dt)
  tickRaid(w, dt)
  tickDojo(w, dt)
  tickDecor(w)
  tickSchedule(w)
}

function tickCritter(w, c, dt) {
  regen(c, dt)
  var vis = isVisible(w, c)
  c.visible = vis
  if (!vis && c.mode === "ground") {
    wanderBack(w, c, dt)
    return
  }
  c.hiddenMs = 0

  if (c.mode === "ground") {
    // Standing on a dojo floor that is no longer there.
    if (c.level > 0 && !(w.dojo && w.dojo.home === c.home && levelOpen(w, c.level))) {
      fallOff(w, c, "Whoa!")
    } else {
      var fl = floorOf(w, c.home, c.mon)
      var r = walkRange(w, c)
      c.rel = clamp(c.rel, r[0], r[1])
      if (c.injured && !c.cur && !c.queue.length) tickInjured(w, c, dt)
      else runSteps(w, c, dt)
      // A step may have sent them flying (or teleporting); don't pin them back.
      if (c.mode === "ground") {
        c.x = fl.x0 + c.rel
        c.y = fl.y - levelY(w, c.level)
      }
    }
  }
  if (c.mode === "air") {
    setAnim(w, c, c.vy < 0 ? "tuck" : "jumpArms")
    tickAir(w, c, dt)
  } else if (c.mode === "leap") {
    if (c.anim !== c.leap.anim) replay(w, c, c.leap.anim)
    tickLeap(w, c, dt)
  } else if (c.mode === "drag") {
    setAnim(w, c, "dangle")
  }
  c.fx = c.x
  c.fy = c.y

  tickParts(w, c.parts, dt, c)
  if (c.dummy && c.dummy.wob) c.dummy.wob *= Math.pow(0.02, dt / 1000)

  if (c.bubble) {
    if (c.bubble.until < 0) c.bubble.until = w.t + c.bubble.ms
    if (w.t > c.bubble.until) c.bubble = null
  }
  if (c.pendingBelt !== null && c.pendingBelt !== undefined && c.mode === "ground" && !c.event && !c.level) promote(w, c)
  if (c.mode === "ground" && !c.event && !c.inside && w.t > c.nextChat) {
    c.nextChat = w.t + rand(45000, 110000)
    if (!c.bubble) say(c, isMaster(w, c) && chance(0.5) ? pick(Lines.COMMON.master) : LN(c, "idle"))
  }
}

// Left behind on a workspace you're not looking at: after a while, come
// and find you (or go home to the dojo).
function wanderBack(w, c, dt) {
  if (!w.followFocus || w.hidden || c.injured || c.event) return
  var win = windowOf(w, c.home)
  var mon = win ? w.monitorByName[win.mon] : null
  if (mon && mon.fullscreen) return
  c.hiddenMs = (c.hiddenMs || 0) + dt
  if (!c.hiddenLimit) c.hiddenLimit = rand(60000, 180000)
  if (c.hiddenMs < c.hiddenLimit) return
  c.hiddenMs = 0
  c.hiddenLimit = 0
  var active = windowOf(w, w.activeAddr)
  var dest = active && active.visible && active.w >= c.H * 3 ? active : (dojoVisible(w) ? dojoWindow(w) : null)
  if (!dest) return
  interrupt(c)
  if (dropInto(w, c, dest.addr, rand(0.2, 0.8) * dest.w)) c.arrivalLine = pick(["Found you!", "There you are.", "Wait for me!", "You left me back there!"])
}

function tickParts(w, list, dt, owner) {
  var s = dt / 1000
  var keep = []
  var n = list.length
  for (var i = 0; i < n; i++) {
    var p = list[i]
    p.age += dt
    if (p.age >= p.life) { if (p.onDone) p.onDone(w, owner, p); continue }
    if (p.type === "jutsu" && p.trail && Math.random() < 0.8) {
      var tr = p.el
      if (tr === "fire") list.push({ type: "flame", x: p.x, y: p.y, vx: -p.dir * rand(20, 60), vy: rand(-30, 10), g: -40, rot: 0, vr: 0, age: 0, life: rand(250, 450), size: p.size * rand(0.4, 0.7) })
      else if (tr === "water") list.push({ type: "drop", x: p.x, y: p.y, vx: rand(-40, 40), vy: rand(-40, 20), g: 900, rot: 0, vr: 0, age: 0, life: 500, size: p.size * 0.25, floor: p.ty + 400 })
      else if (tr === "wind") list.push({ type: "streak", x: p.x, y: p.y + rand(-4, 4), vx: -p.dir * 60, vy: 0, g: 0, rot: p.dir > 0 ? 0 : Math.PI, vr: 0, age: 0, life: 220, size: p.size * 1.2 })
      else list.push({ type: "dust", x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), g: 0, rot: 0, vr: 0, age: 0, life: 400, size: p.size * 0.35 })
    }
    if (p.type === "flyto" || p.type === "jutsu") {
      var u = clamp(p.age / p.life, 0, 1)
      p.x = p.sx + (p.tx - p.sx) * u
      p.y = p.sy + (p.ty - p.sy) * u - p.apex * 4 * u * (1 - u)
      p.rot += p.vr * s
      keep.push(p)
      continue
    }
    if (p.sway) p.vx = Math.sin((p.age + p.phase) / 400) * p.sway
    p.vy += p.g * s
    p.x += p.vx * s
    p.y += p.vy * s
    p.rot += p.vr * s
    if (p.floor !== undefined && p.y > p.floor) {
      p.y = p.floor
      if (Math.abs(p.vy) > 80) { p.vy = -p.vy * 0.35; p.vx *= 0.7; p.vr *= 0.6 }
      else { p.vy = 0; p.vx *= 0.8; p.vr = 0; p.sway = 0 }
    }
    keep.push(p)
  }
  // Callbacks may have added particles while we iterated.
  for (var j = n; j < list.length; j++) keep.push(list[j])
  list.length = 0
  for (var k = 0; k < keep.length; k++) list.push(keep[k])
}

function computeBounds(w, c) {
  var H = c.H * 1.15
  var x0 = c.fx - H * 1.1, x1 = c.fx + H * 1.1
  var y0 = c.fy - H * 2.0, y1 = c.fy + H * 0.25
  var hits = []
  if (c.visible && !c.inside) hits.push({ x: c.fx - H * 0.4, y: c.fy - H * 1.15, w: H * 0.8, h: H * 1.2, part: "body" })
  if (c.bubble && c.bubble.x !== undefined && c.visible) {
    x0 = Math.min(x0, c.bubble.x - 4); x1 = Math.max(x1, c.bubble.x + c.bubble.w + 4)
    y0 = Math.min(y0, c.bubble.y - 4)
  }
  if (c.dummy) {
    var dx = c.x + (c.dummy.rel - c.rel)
    x0 = Math.min(x0, dx - H * 0.6); x1 = Math.max(x1, dx + H * 0.6)
  }
  for (var i = 0; i < c.parts.length; i++) {
    var p = c.parts[i]
    if (p.type === "delay") continue
    var r = (p.size || 10) + (p.type === "text" ? 40 : 4)
    x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r)
    y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r)
  }
  c.bbox = quantize(x0, y0, x1, y1)
  c.hits = hits
}

// Place every speech bubble on a monitor so none overlap: older bubbles keep
// their spot above their speaker, newer ones stack above whatever they'd
// cover. Same order every frame, so nothing jitters.
function layoutBubbles(w) {
  var groups = {}
  var talkers = w.raid ? w.critters.concat(w.raid.demons) : w.critters
  for (var i = 0; i < talkers.length; i++) {
    var c = talkers[i]
    if (!c.bubble || !c.visible) continue
    var mon = monitorOf(w, c)
    if (!mon) continue
    var bw = c.bubble.w, bh = c.bubble.h
    var x = clamp(c.fx - bw / 2, mon.x + 4, mon.x + mon.w - bw - 4)
    var y = c.fy - c.H * 1.15 * (0.94 + 0.12 * physique(c)) - bh - 12
    if (!groups[mon.name]) groups[mon.name] = { mon: mon, list: [] }
    groups[mon.name].list.push({ c: c, x: x, y: y, w: bw, h: bh, born: c.bubble.born })
  }
  for (var g in groups) {
    var list = groups[g].list
    list.sort(function (a, b) { return a.born - b.born })
    var placed = []
    for (var k = 0; k < list.length; k++) {
      var b = list[k]
      for (var guard = 0; guard < 24; guard++) {
        var hit = null
        for (var j = 0; j < placed.length; j++) {
          var p = placed[j]
          if (b.x < p.x + p.w + 4 && b.x + b.w + 4 > p.x && b.y < p.y + p.h + 6 && b.y + b.h + 6 > p.y) { hit = p; break }
        }
        if (!hit) break
        b.y = hit.y - b.h - 6
      }
      b.y = Math.max(b.y, groups[g].mon.y + 2)
      placed.push(b)
      b.c.bubble.x = b.x
      b.c.bubble.y = b.y
    }
  }
}

function quantize(x0, y0, x1, y1) {
  var Q = 32
  x0 = Math.floor(x0 / Q) * Q; y0 = Math.floor(y0 / Q) * Q
  x1 = Math.ceil(x1 / Q) * Q; y1 = Math.ceil(y1 / Q) * Q
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// ---------------------------------------------------------------- input

function hitTest(w, gx, gy) {
  for (var i = w.critters.length - 1; i >= 0; i--) {
    var c = w.critters[i]
    for (var j = 0; j < c.hits.length; j++) {
      var h = c.hits[j]
      if (gx >= h.x && gx <= h.x + h.w && gy >= h.y && gy <= h.y + h.h) return { id: c.id, part: h.part }
    }
  }
  if (w.raid) {
    for (var r = 0; r < w.raid.demons.length; r++) {
      var dm = w.raid.demons[r]
      for (var rh = 0; rh < dm.hits.length; rh++) {
        var hh = dm.hits[rh]
        if (gx >= hh.x && gx <= hh.x + hh.w && gy >= hh.y && gy <= hh.y + hh.h) return { id: dm.id, part: "demon" }
      }
    }
  }
  if (w.dojo && w.dojo.hits) {
    for (var k = 0; k < w.dojo.hits.length; k++) {
      var d = w.dojo.hits[k]
      if (gx >= d.x && gx <= d.x + d.w && gy >= d.y && gy <= d.y + d.h) return { id: "dojo", part: d.part }
    }
  }
  return null
}

function click(w, id, part) {
  if (id === "dojo") { dojoClick(w, part); return }
  if (part === "demon") { smite(w, id); return }
  var c = find(w, id)
  if (!c || c.mode !== "ground") return
  if (c.event) {
    floatText(c, pick(["Not now!", "Focus!", "Shh!"]), c.fx, c.fy - c.H * 1.3)
    return
  }
  interrupt(c)
  if (chance(0.3)) remember(w, c, "The giant poked me.")
  if (chance(0.55)) {
    puff(c, c.fx, c.fy - c.H * 0.5, 8)
    var others = otherWindows(w, c)
    var dest = others.length && chance(0.3) ? pick(others) : null
    if (dest) {
      c.home = dest.addr
      c.level = 0
      c.rel = rand(0.2, 0.8) * dest.w
    } else {
      var r = walkRange(w, c)
      var cur = c.rel
      var tries = 0
      do { c.rel = rand(r[0], r[1]); tries++ } while (Math.abs(c.rel - cur) < c.H * 2 && tries < 8)
    }
    var fl = floorOf(w, c.home, c.mon)
    c.x = fl.x0 + c.rel
    c.y = fl.y - levelY(w, c.level)
    c.fx = c.x
    c.fy = c.y
    puff(c, c.x, c.y - c.H * 0.5, 8)
    q(c, [A("guard", 300), S(LN(c, "click")), A("guard", 1200), XP(1)])
  } else {
    q(c, [A("backflip"), S(LN(c, "click")), A("guard", 1000), XP(1)])
  }
}

// Right-click: a ninja introduces themself.
function inspect(w, id) {
  var c = find(w, id)
  if (!c) return
  var title = isMaster(w, c) ? "Sensei " : ""
  var bd = bonds(w, c)
  var extra = (bd.friend ? " Friend: " + bd.friend.name + "." : "") + (bd.rival ? " Rival: " + bd.rival.name + "." : "")
  var tl = traitLabels(c).join(", ").toLowerCase()
  say(c, title + c.name + ", the " + Lines.personality(c).label.toLowerCase() + (tl ? " (" + tl + ")" : "") + ". " + belt(c).name + " belt. "
    + c.wins + "W " + c.losses + "L. Health " + Math.round(c.hp) + "/" + maxHp(c) + "." + extra, 4200)
  // With a mind, a second bubble shows what they're thinking.
  if (c.thought) {
    var th = c.thought
    later(c, 4300, function (w2, c2) { say(c2, "(" + (c2.mood || "calm") + ") ~ " + th, lineDurMs(th) + 800) })
  }
}

function dragStart(w, id, gx, gy) {
  var c = find(w, id)
  if (!c || c.mode === "leap") return
  leaveEvent(w, c)
  interrupt(c)
  c.mode = "drag"
  c.level = 0
  c.dragOff = { x: 0, y: c.H * 1.15 }
  c.dragHist = []
  dragMove(w, id, gx, gy)
  say(c, LN(c, "grab"), 1800)
  remember(w, c, "The giant grabbed me with the cursor and threw me.", true)
}

function dragMove(w, id, gx, gy) {
  var c = find(w, id)
  if (!c || c.mode !== "drag") return
  var mon = w.monitorByName[c.mon] || monitorOf(w, c)
  var nx = gx + c.dragOff.x
  var ny = gy + c.dragOff.y
  if (mon) {
    nx = clamp(nx, mon.x + halfWidth(c), mon.x + mon.w - halfWidth(c))
    ny = clamp(ny, mon.y + c.H, mon.y + mon.h)
  }
  c.x = nx
  c.y = ny
  c.dragHist.push({ t: Date.now(), x: nx, y: ny })
  if (c.dragHist.length > 6) c.dragHist.shift()
}

function dragEnd(w, id) {
  var c = find(w, id)
  if (!c || c.mode !== "drag") return
  var h = c.dragHist
  var vx = 0, vy = 0
  if (h.length >= 2) {
    var a = h[0], b = h[h.length - 1]
    var dtm = Math.max(16, b.t - a.t)
    vx = (b.x - a.x) / dtm * 1000
    vy = (b.y - a.y) / dtm * 1000
  }
  c.vx = clamp(vx, -2200, 2200)
  c.vy = clamp(vy, -2200, 1500)
  c.mode = "air"
  c.home = null
  c.enterTarget = null
}

// ---------------------------------------------------------------- dojo

function dojoWindow(w) { return w.dojo ? windowOf(w, w.dojo.home) : null }

function dojoVisible(w) {
  var win = dojoWindow(w)
  if (!win || !win.visible || w.hidden) return false
  var mon = w.monitorByName[win.mon]
  return !!(mon && !mon.fullscreen)
}

// Half-width of the dojo footprint (the cherry tree adds room).
function dojoHalf(w) {
  var H = sizeFor(w)
  return H * (w.dojo && w.dojo.stage >= S_TREE ? 5.4 : 4.1)
}

// How tall the dojo currently stands, in px.
function dojoHeight(w) {
  var H = sizeFor(w)
  var s = w.dojo ? w.dojo.stage : 0
  if (s >= S_SPIRE) return H * 9.4
  if (s >= S_FLOOR3) return H * 8.4
  if (s >= S_FLOOR2) return H * 5.9
  return H * 3.7
}

// Global position of the dojo's centre on its window floor.
function dojoBase(w) {
  var win = dojoWindow(w)
  if (!win) return null
  var fl = floorOf(w, win.addr, win.mon)
  var half = Math.min(dojoHalf(w), (fl.x1 - fl.x0) / 2)
  var cx = clamp(fl.x0 + w.dojo.frac * (fl.x1 - fl.x0), fl.x0 + half, fl.x1 - half)
  return { x: cx, y: fl.y, mon: win.mon, x0: fl.x0, win: win }
}

// Dojo centre as a rel offset in the dojo window.
function dojoRel(w) {
  var b = dojoBase(w)
  return b ? b.x - b.x0 : 0
}

// Dojos hug the side of their window nearest the screen edge, out of the
// way of whatever is in the middle.
function sideFrac(w, win) {
  var mon = w.monitorByName[win.mon]
  if (!mon) return 1
  return win.x + win.w / 2 < mon.x + mon.w / 2 ? 0 : 1
}

function foundDojo(w, c) {
  var win = windowOf(w, c.home)
  if (!win) return
  w.dojo = { home: win.addr, frac: sideFrac(w, win), stage: 0, progress: 0, done: false, gong: 0, hits: [], bbox: null, dummyWob: 0 }
  w.dojoParts = []
  var b = dojoBase(w)
  if (b) sparkle(w.dojoParts, b.x, b.y - c.H, 8, c.H)
}

// The giant picks the dojo up and puts it in another window; everyone
// follows. Refused during a raid or tournament.
function moveDojo(w, addr) {
  var win = windowOf(w, addr || w.lastActiveAddr || w.activeAddr)
  if (!win || !win.visible || !w.dojo) return "no window to move to"
  if (raidActive(w)) return "not during a demon raid"
  for (var e = 0; e < w.events.length; e++) if (w.events[e].type === "tournament") return "not during a tournament"
  var H = sizeFor(w)
  var old = dojoBase(w)
  if (old) for (var i = 0; i < 12; i++) addPart(w.dojoParts, { type: "smoke", x: old.x + rand(-3, 3) * H, y: old.y - rand(0, 2.5) * H,
    vx: rand(-40, 40), vy: rand(-60, -10), life: rand(600, 1100), size: H * rand(0.3, 0.6) })
  w.dojo.home = win.addr
  w.dojo.frac = sideFrac(w, win)
  w.dojoParts = []
  var b = dojoBase(w)
  if (b) {
    for (var j = 0; j < 14; j++) addPart(w.dojoParts, { type: "smoke", x: b.x + rand(-3, 3) * H, y: b.y - rand(0, 2.5) * H,
      vx: rand(-40, 40), vy: rand(-60, -10), life: rand(700, 1300), size: H * rand(0.3, 0.6) })
    sparkle(w.dojoParts, b.x, b.y - H * 1.5, 12, H)
  }
  for (var k = 0; k < w.critters.length; k++) {
    var c = w.critters[k]
    if (c.event) leaveEvent(w, c)
    interrupt(c)
    var rel = function (w2, c2) { return dojoRel(w2) + rand(-3.5, 3.5) * c2.H }
    if (c.home === win.addr && c.mode === "ground" && !c.level) q(c, [W(rel, { speed: 2.2 })])
    else dropInto(w, c, win.addr, rel)
    if (!c.injured && chance(0.35)) c.arrivalLine = pick(["Whoa, moving day!", "The giant moved the dojo!", "New neighbourhood.", "Did the dojo just... fly?"])
    remember(w, c, "The giant picked up our whole dojo and moved it to another window.")
  }
  chronicle(w, "The giant moved the dojo to a new window.")
  return "ok"
}

function relocateDojo(w, c) {
  var win = windowOf(w, c.home)
  if (!win || !w.dojo) return
  w.dojo.home = win.addr
  w.dojo.frac = sideFrac(w, win)
  w.dojoParts = []
  var b = dojoBase(w)
  if (b) for (var i = 0; i < 10; i++) addPart(w.dojoParts, { type: "smoke", x: b.x + rand(-3, 3) * c.H, y: b.y - rand(0, 2) * c.H,
    vx: rand(-40, 40), vy: rand(-50, -10), life: rand(600, 1100), size: c.H * rand(0.3, 0.6) })
}

// One plank delivered.
function addDojoWork(w, c) {
  var d = w.dojo
  if (!d || d.done) return
  d.progress++
  c.planks = (c.planks || 0) + 1
  gainXp(c, 4)
  addPart(w.dojoParts, { type: "text", text: "+1", x: c.fx, y: c.fy - c.H * 1.3, vy: -30, life: 900, size: 10 })
  if (d.progress < STAGES[d.stage].work) return
  var finished = d.stage
  d.progress = 0
  d.stage++
  var b = dojoBase(w)
  if (b) sparkle(w.dojoParts, b.x, b.y - c.H * 1.5, 12, c.H)
  chronicle(w, "Finished the dojo's " + STAGES[finished].name.toLowerCase() + ".")
  if (d.stage >= STAGES.length) {
    d.done = true
    d.stage = STAGES.length
    celebrateDojo(w, Lines.COMMON.open)
  } else {
    celebrateDojo(w, Lines.COMMON.stageDone.map(function (s) { return s.replace("{stage}", STAGES[finished].name.toLowerCase()) }))
  }
  if (RECRUIT_AFTER[finished] && w.critters.length < w.cap && !w.recruitAt) w.recruitAt = w.t + rand(15000, 40000)
}

// Everyone in the dojo window cheers.
function celebrateDojo(w, lines) {
  var d = w.dojo
  var first = true
  for (var i = 0; i < w.critters.length; i++) {
    var c = w.critters[i]
    if (c.home !== d.home || c.event || c.mode !== "ground") continue
    var line = first ? pick(lines) : null
    first = false
    q2front(c, [A("celebrate", 1800, { start: line ? (function (txt) { return function (w2, c2) { say(c2, txt) } })(line) : undefined })])
  }
}

function tickDojo(w, dt) {
  var d = w.dojo
  tickParts(w, w.dojoParts, dt, null)
  if (!d) return
  if (d.gong > 0) d.gong = Math.max(0, d.gong - dt / 1500)
  // Fade the building while you're working in its window.
  var want = w.activeAddr && w.activeAddr === d.home ? 0.25 : 0.55
  var cur = d.alpha === undefined ? 1 : d.alpha
  d.alpha = cur + (want - cur) * Math.min(1, dt / 250)
  if (d.dummyWob) d.dummyWob *= Math.pow(0.03, dt / 1000)
  var b = dojoBase(w)
  var vis = dojoVisible(w)
  d.visible = vis
  if (!b || !vis) { d.hits = []; d.bbox = null; return }
  var H = sizeFor(w)
  // Blossom petals drift down from the cherry tree.
  if (d.stage > S_TREE && Math.random() < dt / 700) {
    var tx = b.x + H * 4.5
    addPart(w.dojoParts, { type: "petal", x: tx + rand(-H, H), y: b.y - H * rand(1.6, 2.6), vy: rand(10, 25), sway: 25,
      phase: rand(0, 2000), life: 5000, size: H * 0.05, vr: rand(-3, 3), floor: b.y - 1 })
  }
  var half = dojoHalf(w)
  var x0 = b.x - half - H * 0.3, x1 = b.x + half + H * 0.3, y0 = b.y - dojoHeight(w), y1 = b.y + 4
  for (var i = 0; i < w.dojoParts.length; i++) {
    var p = w.dojoParts[i]
    x0 = Math.min(x0, p.x - 50); x1 = Math.max(x1, p.x + 50)
    y0 = Math.min(y0, p.y - 20); y1 = Math.max(y1, p.y + 10)
  }
  d.bbox = quantize(x0, y0, x1, y1)
  d.hits = []
  if (d.stage > S_GONG) {
    var g = gongPos(w)
    d.hits.push({ x: g.x - H * 0.42, y: g.y - H * 0.45, w: H * 0.84, h: H * 0.9, part: "gong" })
  }
}

// Things left lying around (shurikens stuck in window edges). They change
// rarely, so the overlay repaints them only when decorVersion moves.
function tickDecor(w) {
  var keep = []
  for (var i = 0; i < w.decor.length; i++) {
    var dc = w.decor[i]
    if (dc.until > w.t && w.windows[dc.home]) keep.push(dc)
  }
  if (keep.length !== w.decor.length) { w.decor = keep; w.decorVersion++ }
}

function decorOn(w, monName) {
  var out = []
  for (var i = 0; i < w.decor.length; i++) {
    var win = w.windows[w.decor[i].home]
    if (win && win.visible && win.mon === monName && !w.hidden) out.push(w.decor[i])
  }
  return out
}

function decorBounds(w, monName) {
  var list = decorOn(w, monName)
  if (!list.length) return null
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (var i = 0; i < list.length; i++) {
    x0 = Math.min(x0, list[i].x - 12); x1 = Math.max(x1, list[i].x + 12)
    y0 = Math.min(y0, list[i].y - 12); y1 = Math.max(y1, list[i].y + 12)
  }
  return quantize(x0, y0, x1, y1)
}

function gongPos(w) {
  var b = dojoBase(w)
  var H = sizeFor(w)
  return { x: b.x + H * 2.0, y: b.y - H * 1.05 }
}

function dummyRel(w) { return dojoRel(w) - sizeFor(w) * 1.9 }

function dojoClick(w, part) {
  if (part !== "gong" || !w.dojo) return
  w.dojo.gong = 1
  var g = gongPos(w)
  floatText(null, "BONG", g.x, g.y - sizeFor(w) * 0.7, { list: w.dojoParts, size: 14, vy: -20 })
  if (startTournament(w)) return
  var told = false
  for (var i = 0; i < w.critters.length; i++) {
    var c = w.critters[i]
    if (c.home !== w.dojo.home || c.event || c.mode !== "ground") continue
    interrupt(c)
    q(c, [face(c.rel < dojoRel(w) ? 1 : -1), A("shock", 700)])
    if (!told) {
      told = true
      q(c, [S(w.critters.length < 2 ? "A tournament needs two of us." : "We're not all here for a tournament.")])
    }
  }
}

// ---------------------------------------------------------------- events

function claim(ev, list) {
  ev.members = list.slice()
  for (var i = 0; i < list.length; i++) {
    list[i].event = ev
    list[i].eventIdle = null
  }
}

function release(ev, c) {
  if (c.event !== ev) return
  c.event = ev.parent || null
  c.eventIdle = ev.parent ? "seiza" : null
}

function endEvent(w, ev) {
  if (ev.over) return
  ev.over = true
  for (var i = 0; i < ev.members.length; i++) release(ev, ev.members[i])
  var idx = w.events.indexOf(ev)
  if (idx >= 0) w.events.splice(idx, 1)
  if (ev.onEnd) ev.onEnd(w, ev)
}

// A ninja walks out of whatever event they were in (dragged, fell, removed).
function leaveEvent(w, c) {
  var ev = c.event
  if (!ev) return
  if (ev.type === "duel") {
    ev.forfeit = c
    endEvent(w, ev)
    ev = c.event
  }
  if (ev && ev.type === "tournament") {
    if (ev.phase === "next" || ev.phase === "gather" || ev.phase === "seat") knockOut(w, ev, c)
    ev.alive = ev.alive.filter(function (x) { return x !== c })
    ev.members = ev.members.filter(function (x) { return x !== c })
    ev.pairs = ev.pairs.map(function (p) { return p.filter(function (x) { return x !== c }) }).filter(function (p) { return p.length })
  } else if (ev && ev.type === "raid") {
    ev.members = ev.members.filter(function (x) { return x !== c })
  } else if (ev && ev.type === "pair") {
    ev.members = ev.members.filter(function (x) { return x !== c })
    c.event = null
    endEvent(w, ev)
  } else if (ev && ev.type === "kata") {
    ev.members = ev.members.filter(function (x) { return x !== c })
  }
  c.event = null
  c.eventIdle = null
}

function tickEvents(w, dt) {
  var list = w.events.slice()
  for (var i = 0; i < list.length; i++) {
    var ev = list[i]
    if (ev.over) continue
    ev.t += dt
    ev.phaseT = (ev.phaseT || 0) + dt
    if (ev.type === "duel") tickDuel(w, ev)
    else if (ev.type === "tournament") tickTournament(w, ev)
    else if (ev.type === "kata") tickKata(w, ev)
    else if (ev.type === "pair") tickPair(w, ev)
    else if (ev.type === "raid" && (!ev.raid || ev.raid.over)) endEvent(w, ev)
  }
}

function phase(ev, name) { ev.phase = name; ev.phaseT = 0 }

function allIdle(list) {
  for (var i = 0; i < list.length; i++) if (!isIdle(list[i])) return false
  return true
}

function alive(w, c) { return w.critters.indexOf(c) >= 0 }

// Pad step lists to the same total duration so two ninjas stay in sync.
function stepsDur(steps) {
  var t = 0
  for (var i = 0; i < steps.length; i++) if (steps[i].a === "anim" || steps[i].a === "slide") t += steps[i].dur
  return t
}
function sync(sa, sb) {
  var da = stepsDur(sa), db = stepsDur(sb)
  if (da < db) sa.push(A("guard", db - da))
  else if (db < da) sb.push(A("guard", da - db))
}

// --- duel

function startDuel(w, a, b, opts) {
  opts = opts || {}
  var p = winChance(a, b, !!opts.title)
  var winner = Math.random() < p ? a : b
  var ev = { type: "duel", t: 0, a: a, b: b, title: !!opts.title, parent: opts.parent || null,
    winner: winner, loser: winner === a ? b : a, odds: p, onEnd: opts.onEnd }
  phase(ev, "gather")
  claim(ev, [a, b])
  q(a, [down(a)])
  q(b, [down(b)])
  w.events.push(ev)
  return ev
}

function tickDuel(w, ev) {
  var a = ev.a, b = ev.b
  if (!alive(w, a) || !alive(w, b)) { ev.forfeit = !alive(w, a) ? a : b; endEvent(w, ev); return }
  if (ev.phase === "gather") {
    var arena = windowOf(w, a.home)
    if (!arena || !arena.visible) { endEvent(w, ev); return }
    if (b.home !== a.home && isIdle(b) && !ev.leaping) {
      ev.leaping = true
      q(b, [L(a.home, function (w2, c2) { return a.rel + (a.rel > c2.H * 2 ? -1.2 : 1.2) * c2.H })])
    }
    if (a.home === b.home && !a.level && !b.level && allIdle([a, b])) phase(ev, "place")
    else if (ev.phaseT > 15000) endEvent(w, ev)
    return
  }
  if (ev.phase === "place") {
    var r = walkRange(w, a)
    var X = ev.parent ? ev.parent.arena : (a.rel + b.rel) / 2
    X = clamp(X, r[0] + a.H * 0.6, r[1] - a.H * 0.6)
    var left = a.rel <= b.rel ? a : b, right = left === a ? b : a
    var gap = a.H * 0.36
    q(left, [W(X - gap, { speed: 1.8 }), face(1)])
    q(right, [W(X + gap, { speed: 1.8 }), face(-1)])
    phase(ev, "bow")
    return
  }
  if (ev.phase === "bow") {
    if (!allIdle([a, b])) return
    q(a, [A("bow"), A("guard", 500)])
    q(b, [A("bow"), A("guard", 500)])
    phase(ev, "fight")
    return
  }
  if (ev.phase === "fight") {
    if (!allIdle([a, b])) return
    choreograph(w, ev)
    phase(ev, "fighting")
    return
  }
  if (ev.phase === "fighting") {
    if (!allIdle([a, b])) return
    ev.winner.wins++
    ev.loser.losses++
    // Odds the winner had going in; long shots get called out.
    var wOdds = ev.winner === ev.a ? ev.odds : 1 - ev.odds
    w.fightLog.push({ winner: ev.winner.name, loser: ev.loser.name, odds: Math.round(wOdds * 100) / 100, title: ev.title })
    if (w.fightLog.length > 8) w.fightLog.shift()
    if (wOdds < 0.3) {
      floatText(ev.winner, "UPSET! (" + Math.round(wOdds * 100) + "%)", ev.winner.fx, ev.winner.fy - ev.winner.H * 1.9, { size: 13, color: "#ff8c42", life: 2600, vy: -12 })
      remember(w, ev.winner, "I pulled off an upset against " + ev.loser.name + " (" + Math.round(wOdds * 100) + "% odds).")
      chronicle(w, ev.winner.name + " upset " + ev.loser.name + " at " + Math.round(wOdds * 100) + "% odds.")
    }
    if (!ev.title) {
      shiftForm(ev.winner, 0.06)
      shiftForm(ev.loser, -0.06)
    }
    var hurtK = (ev.title ? 1.2 : 0.65) * (ev.jutsu ? 1.3 : 1)
    var lsr = ev.loser, wnr = ev.winner
    // A lopsided win barely scratches the winner; a hard-fought one hurts.
    var closeness = clamp((1 - wOdds) * 2, 0.2, 1.3)
    later(lsr, 300, function (w2) { damage(w2, lsr, rand(24, 40) * hurtK, "lost a " + (ev.title ? "tournament duel" : "spar") + " to " + wnr.name) })
    later(wnr, 300, function (w2) { damage(w2, wnr, rand(6, 16) * hurtK * closeness, "a hard-won fight against " + lsr.name) })
    addRel(w, ev.winner, ev.loser, ev.loser.personality === "hothead" ? -0.8 : -0.2)
    var kindTxt = ev.title ? "a tournament duel" : "a spar"
    remember(w, ev.winner, "I beat " + ev.loser.name + " in " + kindTxt + ".")
    remember(w, ev.loser, "I lost to " + ev.winner.name + " in " + kindTxt + ".", true)
    if (!ev.title) chronicle(w, ev.winner.name + " beat " + ev.loser.name + " in a spar.")
    if (!ev.parent) koReaction(w, ev)
    gainXp(ev.winner, ev.title ? 12 : 16)
    gainXp(ev.loser, ev.title ? 3 : 4)
    endEvent(w, ev)
  }
}

function impact(kind) {
  return function (w, att) {
    later(att, 170, function (w2, c2) {
      var x = c2.fx + c2.facing * c2.H * 0.45, y = c2.fy - c2.H * (kind === "kick" ? 0.55 : 0.72)
      if (kind === "block") floatText(c2, pick(["tak", "tok", "blk"]), x, y, { size: 9, life: 600 })
      else {
        stars(c2, x, y, 2)
        floatText(c2, pick(["POW", "WHAP", "THUD", "SMACK"]), x, y - 6, { size: 11, life: 700, color: "#ffd84a" })
      }
    })
  }
}

function choreograph(w, ev) {
  var Wn = ev.winner, Ls = ev.loser
  var sw = [], sl = []
  var n = irand(3, 6)
  var jutsuDuel = elementKnown(Wn) && elementKnown(Ls)
  ev.jutsu = jutsuDuel
  for (var i = 0; i < n; i++) {
    var att = chance(0.62) ? Wn : Ls
    if (elementKnown(att) && chance(jutsuDuel ? 0.45 : 0.25)) {
      var ja = [], jd = []
      jutsuExchange(w, att, att === Wn ? Ls : Wn, ja, jd, false)
      ja.push(A("guard", 400)); jd.push(A("guard", 400))
      if (att === Wn) { sw = sw.concat(ja); sl = sl.concat(jd) } else { sl = sl.concat(ja); sw = sw.concat(jd) }
      continue
    }
    var move = pick(["punch", "punch2", "kick", "punch"])
    var d = Rig.animLength(move)
    var resp = weighted([[50, "block"], [32, "hit"], [18, "dodge"]])
    var atkSteps = [], defSteps = []
    if (resp === "dodge") {
      atkSteps.push(A(move, d))
      defSteps.push(A("backflip"))
    } else {
      atkSteps.push(A(move, d, { start: impact(resp === "block" ? "block" : move) }))
      defSteps.push(A(resp === "block" ? "block" : "hit", d))
    }
    sync(atkSteps, defSteps)
    var pause = rand(200, 600)
    atkSteps.push(A("guard", pause))
    defSteps.push(A("guard", pause))
    if (att === Wn) { sw = sw.concat(atkSteps); sl = sl.concat(defSteps) } else { sl = sl.concat(atkSteps); sw = sw.concat(defSteps) }
  }
  // Finishing blow: a jutsu when the winner knows one and it matters.
  if (elementKnown(Wn) && (ev.title || chance(0.35))) {
    var fa = [], fdl = []
    jutsuExchange(w, Wn, Ls, fa, fdl, true)
    sw = sw.concat(fa); sl = sl.concat(fdl)
  } else {
    var fin = pick(["kick", "punch", "uppercut", "spinKick", "flyingKick"])
    var fd = Rig.animLength(fin)
    sw.push(A(fin, fd, { start: impact("kick") }))
    sl.push(A("hit", fd))
  }
  sw.push(A("victory", 1900, { start: function (w2, c2) { if (chance(0.75)) say(c2, LN(c2, "win"), 1800) } }))
  sl.push(A("fallen", 1900, { start: function (w2, c2) {
    stars(c2, c2.fx, c2.fy - c2.H * 0.4, 4)
    floatText(c2, "KO", c2.fx, c2.fy - c2.H * 0.9, { size: 13, color: "#ff6b6b" })
  } }))
  sw.push(A("victory", 500))
  sl.push(A("dizzy", 500, { start: function (w2, c2) { if (chance(0.6)) say(c2, LN(c2, "lose"), 1800) } }))
  sw.push(A("bow"))
  sl.push(A("bow"))
  q(Wn, sw)
  q(Ls, sl)
}

// Friendly sparring between two ninjas in the same window.
function startSpar(w, a, b) {
  if (avoidsFights(b)) {
    q(a, [S(LN(a, "challenge", b), 1600)])
    later(b, 1500, function (w2, c2) { say(c2, pick(["Not now, I'm hurt.", "Give me a minute.", "Later. My ribs.", "Can't. Healing."])) })
    return
  }
  interrupt(b)
  q(a, [S(LN(a, "challenge", b), 1600)])
  startDuel(w, a, b, {})
}

// --- tournament

function startTournament(w) {
  var win = dojoWindow(w)
  if (!win || !dojoVisible(w) || w.dojo.stage < S_SIGN || raidActive(w) || w.homeState) return false
  for (var e = 0; e < w.events.length; e++) if (w.events[e].type === "tournament") return false
  var ps = []
  for (var i = 0; i < w.critters.length; i++) {
    var c = w.critters[i]
    if (c.injured || c.mode === "drag") continue
    ps.push(c)
  }
  if (ps.length < 2) return false
  // Pull everyone out of smaller events first.
  for (var j = 0; j < ps.length; j++) {
    if (ps[j].event) leaveEvent(w, ps[j])
    interrupt(ps[j])
  }
  var ev = { type: "tournament", t: 0, alive: ps.slice(), participants: ps.slice(), pairs: [], duel: null, round: 0,
    arena: dojoRel(w), outRound: {}, history: [], lastWinner: null }
  phase(ev, "gather")
  claim(ev, ps)
  w.events.push(ev)
  w.dojo.gong = 1
  var g = gongPos(w)
  floatText(null, "ENDURANCE TOURNAMENT!", g.x - sizeFor(w) * 2, g.y - sizeFor(w) * 1.6, { list: w.dojoParts, size: 15, vy: -12, life: 2800, color: "#f2c14e" })
  for (var k = 0; k < ps.length; k++) {
    var p = ps[k]
    var spot = function (w2, c2) { return dojoRel(w2) + rand(-3, 3) * c2.H }
    // Out of view (another workspace) or mid-air: come straight in.
    if (!p.visible || p.mode !== "ground") dropInto(w, p, win.addr, spot)
    else if (p.home !== win.addr) q(p, [travel(w, p, win.addr, spot)])
    else q(p, [down(p)])
  }
  w.nextTournament = w.activeMs + rand(35, 55) * 60000
  return true
}

// Spectator and party seats, alternating either side of the middle.
function seatRel(w, ev, c, spacing) {
  var i = ev.members.indexOf(c)
  var side = i % 2 ? 1 : -1
  var k = Math.floor(i / 2)
  var r = walkRange(w, c)
  return clamp(ev.arena + side * c.H * ((spacing || 1.5) + k * 0.7), r[0], r[1])
}

function seat(w, ev, c) {
  c.eventIdle = "seiza"
  q(c, [W(seatRel(w, ev, c), { speed: 1.8 }), face(function (w2, c2) { return c2.rel < ev.arena ? 1 : -1 })])
}

// Out of the tournament: health too low to go on.
function standing(c) { return !c.injured && hpRatio(c) >= 0.25 }

function knockOut(w, ev, c) {
  if (ev.outRound[c.id] !== undefined) return
  ev.outRound[c.id] = ev.round
  floatText(c, "OUT", c.fx, c.fy - c.H * 1.4, { size: 12, color: "#ff6b6b", life: 1600 })
  remember(w, c, "I lasted " + ev.round + " round" + (ev.round === 1 ? "" : "s") + " in the endurance tournament before running out of strength.")
}

function tickTournament(w, ev) {
  var win = dojoWindow(w)
  if (!win || !win.visible) { endTournament(w, ev); return }
  ev.alive = ev.alive.filter(function (c) { return alive(w, c) })
  ev.members = ev.members.filter(function (c) { return alive(w, c) })
  ev.participants = ev.participants.filter(function (c) { return alive(w, c) })

  if (ev.phase === "gather") {
    var stragglers = ev.members.filter(function (c) { return c.home !== win.addr || c.level || c.mode !== "ground" })
    if (ev.phaseT > 15000) {
      for (var s = 0; s < stragglers.length; s++) leaveEvent(w, stragglers[s])
      stragglers = []
    }
    if (!stragglers.length && allIdle(ev.members)) {
      if (ev.alive.length < 2) { endTournament(w, ev); return }
      for (var i = 0; i < ev.members.length; i++) seat(w, ev, ev.members[i])
      phase(ev, "seat")
    }
    return
  }
  if (ev.phase === "seat") {
    if (allIdle(ev.members)) phase(ev, "next")
    return
  }
  if (ev.phase === "next") {
    if (ev.duel) {
      if (Math.random() < 0.02) cheer(w, ev)
      return
    }
    // Whoever can't go on is out; the rest fight again.
    var still = []
    for (var a0 = 0; a0 < ev.alive.length; a0++) {
      var f0 = ev.alive[a0]
      if (standing(f0) && f0.event === ev) still.push(f0)
      else knockOut(w, ev, f0)
    }
    ev.alive = still
    if (ev.alive.length <= 1 || ev.round > 14) { crown(w, ev); return }
    if (!ev.pairs.length) {
      ev.round++
      if (!ev.fought) ev.fought = {}
      var order = shuffle(ev.alive)
      // With an odd number, the one who has fought most sits this round out.
      if (order.length % 2) {
        var most = order[0]
        for (var oi = 1; oi < order.length; oi++) if ((ev.fought[order[oi].id] || 0) > (ev.fought[most.id] || 0)) most = order[oi]
        order.splice(order.indexOf(most), 1)
        order.push(most)
        floatText(most, "bye", most.fx, most.fy - most.H * 1.3, { size: 10 })
      }
      ev.pairs = []
      for (var p = 0; p + 1 < order.length; p += 2) ev.pairs.push(order.slice(p, p + 2))
    }
    var pair = ev.pairs.shift()
    var a = pair[0], b = pair[1]
    if (ev.alive.indexOf(a) < 0 || ev.alive.indexOf(b) < 0) return
    for (var k = 0; k < ev.members.length; k++) {
      var m = ev.members[k]
      if (m !== a && m !== b) m.eventIdle = "seiza"
    }
    if (!ev.fought) ev.fought = {}
    ev.fought[a.id] = (ev.fought[a.id] || 0) + 1
    ev.fought[b.id] = (ev.fought[b.id] || 0) + 1
    ev.duel = startDuel(w, a, b, { title: true, parent: ev, onEnd: function (w2, duel) {
      ev.duel = null
      if (!duel.forfeit) {
        ev.lastWinner = duel.winner
        ev.history.push({ w: duel.winner.name, l: duel.loser.name, r: ev.round })
      }
      for (var j = 0; j < duel.members.length; j++) {
        var f = duel.members[j]
        if (alive(w2, f) && f.event === ev) seat(w2, ev, f)
      }
    } })
    return
  }
  if (ev.phase === "crowning") {
    if (ev.phaseT > 4800) startParty(w, ev)
    return
  }
  if (ev.phase === "party") tickParty(w, ev)
  if (ev.phase === "toast" && allIdle(ev.members)) endTournament(w, ev)
}

// Spectators cheer during a tournament.
function cheer(w, ev) {
  var fans = ev.members.filter(function (c) { return (!ev.duel || ev.duel.members.indexOf(c) < 0) && !c.injured })
  if (!fans.length) return
  var f = pick(fans)
  floatText(f, pick(Lines.COMMON.cheer), f.fx, f.fy - f.H * 1.0, { size: 10, life: 900 })
}

// Last one standing is the tournament champion. The rewards are
// experience for how long each ninja lasted and a fixed bonus for the
// champion. (The sensei is whoever has the most experience; see
// updateSensei.)
function crown(w, ev) {
  var champ = ev.alive[0] || (ev.lastWinner && alive(w, ev.lastWinner) ? ev.lastWinner : null)
  if (!champ) {
    var best = null
    for (var b = 0; b < ev.participants.length; b++) if (!best || hpRatio(ev.participants[b]) > hpRatio(best)) best = ev.participants[b]
    champ = best
  }
  if (!champ) { endTournament(w, ev); return }
  ev.champ = champ
  for (var x = 0; x < ev.participants.length; x++) {
    var p = ev.participants[x]
    var lasted = ev.outRound[p.id] !== undefined ? ev.outRound[p.id] : ev.round
    gainXp(p, lasted * 12 + (p === champ ? 40 : 0))
  }
  chronicle(w, champ.name + " was the last one standing after " + ev.round + " rounds and won the tournament.")
  for (var mi = 0; mi < w.critters.length; mi++) {
    var o = w.critters[mi]
    if (o === champ) remember(w, o, "I won the endurance tournament: last one standing after " + ev.round + " rounds.", true)
    else remember(w, o, champ.name + " won the endurance tournament.")
  }
  champ.titles = (champ.titles || 0) + 1
  sparkle(champ.parts, champ.fx, champ.fy - champ.H, 14, champ.H, "#f2c14e")
  if (!champ.injured) {
    interrupt(champ)
    champ.eventIdle = "victory"
    q(champ, [A("victory", 3600, { start: function (w2, c2) {
      say(c2, pick(["Still standing!", "Champion!", "Who's next?!", "That's how it's done."]), 3200)
    } })])
  }
  floatText(champ, "CHAMPION: " + champ.name.toUpperCase() + "!", champ.fx, champ.fy - champ.H * 2.1, { size: 13, vy: -10, life: 3400, color: "#f2c14e" })
  for (var i = 0; i < ev.members.length; i++) {
    var c = ev.members[i]
    if (c === champ || c.mode !== "ground" || c.injured) continue
    interrupt(c)
    c.eventIdle = "guard"
    q(c, [face(c.rel < champ.rel ? 1 : -1), A("stand", 600), A("bow"), A("stand", 400)])
  }
  phase(ev, "crowning")
}

// ---------------------------------------------------------------- sake party

// After the fights: everyone sits together with sake and talks it over
// until all of them have healed, even the ones who had to lie down first.
function startParty(w, ev) {
  phase(ev, "party")
  ev.nextTalk = w.t + 2500
  var b = dojoBase(w)
  if (b) addPart(w.dojoParts, { type: "sake", x: b.x - b.x0 + b.x0, y: b.y, life: 15 * 60000, size: sizeFor(w) })
  ev.sake = w.dojoParts[w.dojoParts.length - 1]
  for (var pi = 0; pi < ev.participants.length; pi++) ev.participants[pi].partyOf = ev
  for (var i = 0; i < ev.members.length; i++) partySeat(w, ev, ev.members[i])
  chronicle(w, "Everyone shared sake after the tournament.")
}

function partySeat(w, ev, c) {
  c.eventIdle = "drink"
  c.prop = "sake"
  q(c, [W(seatRel(w, ev, c, 0.8), { speed: 1.4 }), face(function (w2, c2) { return c2.rel < ev.arena ? 1 : -1 }),
    F(function (w2, c2) { c2.prop = "sake" })])
}

function partyLine(w, ev, c) {
  // Talk about fights you watched, and toast the champion unless it's you.
  var others = ev.history.filter(function (h) { return h.w !== c.name && h.l !== c.name })
  var h = others.length ? pick(others) : null
  var champ = ev.champ && ev.champ !== c
  var pool = Lines.COMMON.party.filter(function (t) {
    return (h || (t.indexOf("{w}") < 0 && t.indexOf("{l}") < 0)) && (champ || t.indexOf("{champ}") < 0)
  })
  h = h || { w: "", l: "", r: ev.round }
  var t = pick(pool.length ? pool : ["Kanpai!"])
  return t.split("{w}").join(h.w).split("{l}").join(h.l).split("{r}").join(String(h.r))
    .split("{champ}").join(ev.champ ? ev.champ.name : "the champ")
}

function tickParty(w, ev) {
  // The injured join once they're back on their feet.
  for (var i = 0; i < ev.participants.length; i++) {
    var p = ev.participants[i]
    if (p.event || p.injured || p.mode !== "ground" || p.home !== w.dojo.home || p.level) continue
    if (p.cur && p.cur.recovery) continue
    interrupt(p)
    p.event = ev
    ev.members.push(p)
    partySeat(w, ev, p)
    say(p, pick(["Save me some sake!", "I'm back. Mostly.", "Did I miss the toast?"]))
  }
  var seated = ev.members.filter(function (c) { return isIdle(c) && !c.injured })
  if (w.t > ev.nextTalk && seated.length) {
    ev.nextTalk = w.t + rand(5000, 9000)
    if (seated.length >= 2 && w.mindOn && w.mindDialogue && chance(0.5)) {
      var a = pick(seated), others = seated.filter(function (o) { return o !== a })
      w.mindQueue.push({ type: "party", ev: ev, a: a, b: pick(others) })
      ev.nextTalk += 8000
    } else if (chance(0.15)) {
      for (var k = 0; k < seated.length; k++) floatText(seated[k], "Kanpai!", seated[k].fx, seated[k].fy - seated[k].H * 0.9, { size: 10 })
    } else {
      var sp = pick(seated)
      say(sp, partyLine(w, ev, sp))
    }
  }
  // Done when everyone has healed (or it has gone on long enough).
  var everyone = ev.participants.every(function (c) { return !c.injured && hpRatio(c) >= 0.85 && c.event === ev })
  if (everyone || ev.phaseT > 8 * 60000) {
    phase(ev, "toast")
    for (var m = 0; m < ev.members.length; m++) {
      var c = ev.members[m]
      if (c.injured) continue
      interrupt(c)
      c.prop = "sake"
      q(c, [A("toast", 1800, { prop: "sake", start: function (w2, c2) {
        floatText(c2, "KANPAI!", c2.fx, c2.fy - c2.H * 1.4, { size: 12, color: "#f2c14e" })
      } }), F(function (w2, c2) { c2.prop = null }), A("bow")])
    }
  }
}

function endTournament(w, ev) {
  if (ev.sake) ev.sake.age = ev.sake.life
  for (var pi = 0; pi < (ev.participants || []).length; pi++) if (ev.participants[pi].partyOf === ev) ev.participants[pi].partyOf = null
  for (var i = 0; i < ev.members.length; i++) ev.members[i].prop = null
  endEvent(w, ev)
}

// --- group kata

function startKata(w, leader) {
  if (leader.level) return false
  var mates = w.critters.filter(function (c) {
    return c !== leader && c.home === leader.home && !c.level && !c.event && c.mode === "ground" && c.visible && !c.carry && !c.injured
  }).slice(0, 4)
  for (var m = 0; m < mates.length; m++) interrupt(mates[m])
  if (!mates.length) return false
  var ev = { type: "kata", t: 0, leader: leader }
  phase(ev, "line")
  claim(ev, [leader].concat(mates))
  w.events.push(ev)
  interrupt(leader)
  var r = walkRange(w, leader)
  var dir = leader.rel < (r[0] + r[1]) / 2 ? 1 : -1
  var span = leader.H * 0.85 * mates.length
  var front = dir > 0 ? clamp(leader.rel, r[0] + span, r[1] - leader.H * 0.5)
    : clamp(leader.rel, r[0] + leader.H * 0.5, r[1] - span)
  q(leader, [S(pick(Lines.COMMON.kata), 1400), W(front), face(dir)])
  for (var i = 0; i < mates.length; i++) {
    q(mates[i], [W(front - dir * leader.H * 0.85 * (i + 1), { speed: 2 }), face(dir)])
  }
  return true
}

function tickKata(w, ev) {
  ev.members = ev.members.filter(function (c) { return alive(w, c) })
  if (ev.members.length < 2) { endEvent(w, ev); return }
  if (ev.phase === "line") {
    if (allIdle(ev.members)) {
      var seq = [A("guard", 600)]
      var moves = ["punch", "punch2", "kick", "punch", "kick", "backflip", "crane"]
      var n = irand(5, 8)
      for (var i = 0; i < n; i++) {
        var m = pick(moves)
        seq.push(m === "crane" ? A("crane", 1400) : A(m))
        if (chance(0.35)) seq.push(A("guard", 300))
      }
      for (var k = 0; k < ev.members.length; k++) {
        var mine = seq.map(function (s) {
          var copy = {}
          for (var key in s) copy[key] = s[key]
          return copy
        })
        mine[1].start = function (w2, c2) { floatText(c2, "Hai!", c2.fx, c2.fy - c2.H * 1.25, { size: 10 }) }
        mine.push(A("guard", 400), A("bow"), XP(10))
        q(ev.members[k], mine)
      }
      phase(ev, "perform")
    } else if (ev.phaseT > 12000) endEvent(w, ev)
    return
  }
  if (ev.phase === "perform" && allIdle(ev.members)) endEvent(w, ev)
}

// ---------------------------------------------------------------- schedule

function tickSchedule(w) {
  // Scheduled tournaments once the dojo has its sign up.
  if (w.dojo && w.dojo.stage > S_SIGN && w.critters.length >= 2 && w.activeMs >= w.nextTournament) {
    if (!startTournament(w)) w.nextTournament = w.activeMs + 5 * 60000
  }
  // Demons, now and then, once there's a dojo worth tormenting.
  if (w.dojo && w.dojo.stage >= S_ROOF && w.critters.length >= 2 && w.activeMs >= w.nextRaid && !raidActive(w)) {
    if (!startRaid(w)) w.nextRaid = w.activeMs + 5 * 60000
  }
  // Recruits arrive at the dojo.
  if (w.recruitAt && w.t >= w.recruitAt) {
    if (dojoVisible(w) && w.critters.length < w.cap) {
      w.recruitAt = 0
      recruit(w)
    } else w.recruitAt = w.t + 20000
  }
}

function recruit(w) {
  var win = dojoWindow(w)
  if (!win) return null
  var c = spawn(w, "ninja", { home: win.addr, recruit: true })
  remember(w, c, "I just arrived at the dojo to train.", true)
  chronicle(w, c.name + " (" + Lines.personality(c).label + ") joined the dojo.")
  c.arrivalLine = chance(0.5) ? pick(Lines.COMMON.arrive) : LN(c, "idle")
  var master = w.masterId ? find(w, w.masterId) : null
  var greeter = master && master.home === win.addr && !master.event ? master : null
  if (!greeter) {
    for (var i = 0; i < w.critters.length; i++) {
      var o = w.critters[i]
      if (o !== c && o.home === win.addr && !o.event && o.mode === "ground" && !o.level) { greeter = o; break }
    }
  }
  if (greeter) later(greeter, 2600, function (w2, g) {
    if (g.event || !alive(w2, c) || g.level) return
    interrupt(g)
    q(g, [face(c.rel > g.rel ? 1 : -1), A("bow"), S(fmt(pick(Lines.COMMON.welcome), g, { other: c.name }))])
  })
  return c
}

// ---------------------------------------------------------------- brains

function otherWindows(w, c) {
  var mon = monitorOf(w, c)
  if (!mon) return []
  var out = []
  var wins = visibleWindowsOn(w, mon.name)
  for (var i = 0; i < wins.length; i++) if (wins[i].addr !== c.home) out.push(wins[i])
  return out
}

// Others in the same window who could be pulled into something.
function idleMates(w, c) {
  return w.critters.filter(function (o) {
    return o !== c && o.home === c.home && !o.level && !o.event && o.mode === "ground" && o.visible && !o.carry && !o.injured
  })
}

// Up on a pagoda floor: enjoy the view, then come back down.
function thinkUpstairs(w, c) {
  var r = walkRange(w, c)
  var choice = weighted([[30, "meditate"], [14, "crane"], [16, "view"], [10, "kata"], [30, "down"]])
  if (choice === "meditate") {
    q(c, [W(rand(r[0], r[1]), { speed: 1 }), A("meditate", rand(8000, 16000), { every: 2200, emit: function (w2, c2) {
      floatText(c2, "om", c2.fx + rand(-6, 6), c2.fy - c2.H * 1.3, { life: 1800, vy: -18 })
    } }), A("stand", 500), XP(5)])
  } else if (choice === "crane") {
    q(c, [A("crane", rand(3000, 6000)), A("guard", 400), XP(3)])
  } else if (choice === "view") {
    q(c, [face(chance(0.5) ? 1 : -1), A("stand", 1200), S(pick(Lines.COMMON.view)), A("stand", 2500)])
  } else if (choice === "kata") {
    q(c, [A("guard", 400), A("punch"), A("punch2"), A("kick"), A("guard", 600), XP(3)])
  } else {
    q(c, [A("guard", 400), down(c)])
  }
}

function think(w, c) {
  // Homeless on the monitor floor: hop into a window.
  if (!c.home) {
    var wins = visibleWindowsOn(w, c.mon)
    if (wins.length) {
      var t = pick(wins)
      q(c, [A("guard", rand(1500, 3500)), L(t.addr, rand(0.2, 0.8) * t.w)])
      return
    }
  }
  if (c.level > 0) { thinkUpstairs(w, c); return }
  var H = c.H
  var win = windowOf(w, c.home)
  var d = w.dojo
  var dWin = dojoWindow(w)
  var inDojo = !!(d && c.home && d.home === c.home)
  var dojoReachable = !!(dWin && dWin.visible)
  var active = windowOf(w, w.activeAddr)
  // Drift towards the window you're working in, a few at a time.
  var followYou = !!(w.followFocus && active && active.visible && active.addr !== c.home && w.t - (w.activeSince || 0) > 15000
    && active.w >= H * 3 && !c.level)

  // Found the dojo, or set it up again after its window closed.
  if (!d && win && w.t > 12000 && win.w >= H * 7.5 && !w.founding) {
    w.founding = true
    q(c, [W(win.w / 2), S(pick(Lines.COMMON.found)), A("bow"), F(function (w2, c2) { w2.founding = false; if (!w2.dojo) foundDojo(w2, c2) }), A("celebrate", 1400)])
    return
  }
  if (d && !d.home && win && win.w >= H * 7.5 && chance(0.5)) {
    q(c, [S(pick(Lines.COMMON.relocate)), A("guard", 600), F(relocateDojo), A("celebrate", 1200)])
    return
  }

  var mates = idleMates(w, c)
  var master = w.masterId ? find(w, w.masterId) : null
  var r = walkRange(w, c)
  var building = inDojo && !d.done && dojoVisible(w)
  var up = inDojo && dojoVisible(w) ? topLevel(w) : 0
  var P = function (action) { return Lines.weight(c, action) * moodBoost(c.mood, action) }

  // A mind's plan comes first, when it still makes sense.
  var forced = null
  if (c.mindPlan) {
    var plan = c.mindPlan
    c.mindPlan = null
    if (w.t - plan.at < 120000) {
      var res = runPlan(w, c, plan, mates)
      if (res === true) return
      forced = res
    }
  }
  var options = [
    [building ? 8 : 0, "build"],
    [!inDojo && dojoReachable ? (d.done ? 6 : 12) * (dWin.mon === monitorOf(w, c).name ? 1 : 0.5) : 0, "goDojo"],
    [followYou ? 14 * (c.personality === "stoic" ? 0.5 : 1) * (c.personality === "goofball" || c.personality === "showoff" ? 1.5 : 1) : 0, "follow"],
    [up ? 7 * P("meditate") : 0, "climb"],
    [12 * P("kata"), "kata"], [7 * P("flip"), "flip"], [6 * P("pushups"), "pushups"], [6 * P("meditate"), "meditate"],
    [6 * P("shuriken"), "shuriken"], [6 * P("dummy"), "dummy"], [5 * P("sprint"), "sprint"], [4 * P("crane"), "crane"],
    [9 * P("combo"), "combo"],
    [jutsuLevel(c) >= 1 ? 7 * P("jutsu") : 0, "jutsu"], [jutsuLevel(c) >= 3 ? 3 * P("clones") : 0, "clones"], [5 * P("weapons"), "weapons"], [5 * P("acrobatics"), "acrobatics"],
    [2 * P("flex"), "flex"], [2 * P("dance"), "dance"], [2 * P("nap"), "nap"], [1.5 * P("yawn"), "yawn"], [2 * P("snack"), "snack"],
    [otherWindows(w, c).length ? 5 * P("explore") : 0, "explore"],
    [mates.length ? 5 * P("social") : 0, "social"],
    [mates.length && (isMaster(w, c) || !master) ? 1.2 : 0, "groupKata"],
    [master && master !== c && master.home === c.home && !master.event && !master.level ? 3 : 0, "bow"],
    [c.mood === "sad" || c.mood === "grumpy" ? 3 : 0.3, "sulk"],
    [Math.max(0.5, restUrge(w, c)), "rest"],
    [(hpRatio(c) > 0.55 || hasTrait(c, "reckless") || (hasTrait(c, "driven") && hpRatio(c) > 0.35)) && !(tournamentSoon(w) && !hasTrait(c, "reckless")) ? 2 * (hasTrait(c, "driven") ? 6 : 1) * (hasTrait(c, "lazy") ? 0.15 : 1) * P("hard") : 0, "hard"],
    [9, "idle"]
  ]
  // A friend lying hurt nearby comes first for kind souls.
  for (var ii = 0; ii < w.critters.length && !forced; ii++) {
    var pt = w.critters[ii]
    if (pt === c || !pt.injured || pt.home !== c.home || pt.level || relOf(w, c, pt) < 0.3) continue
    if (c.tendedAt && c.tendedAt[pt.id] && w.t - c.tendedAt[pt.id] < 90000) continue
    if (chance(0.35 + relOf(w, c, pt) * 0.1)) { tend(w, c, pt); return }
  }
  // Brawlers go looking for a fight, wherever it is.
  if (!forced && hasTrait(c, "brawler") && !hurtish(c) && chance(0.08)) {
    var foes = w.critters.filter(function (o) { return o !== c && !o.injured && !o.event && o.visible && o.mode === "ground" && monitorOf(w, o).name === monitorOf(w, c).name })
    if (foes.length) {
      var foe = pick(foes)
      c.mindPlan = { action: "challenge", target: foe, say: LN(c, "challenge", foe), at: w.t }
      runPlan(w, c, c.mindPlan, mates)
      c.mindPlan = c.mindPlan && c.mindPlan.tries ? c.mindPlan : null
      return
    }
  }
  // Sensible ninjas stop and heal when they're badly hurt.
  if (shouldRestNow(w, c) && chance(0.75) && forced !== "rest" && forced !== "meditate" && forced !== "nap" && forced !== "snack") {
    if (forced) q(c, [S(pick(["...actually, I should rest.", "Ow. Later.", "Healing first."]), 1800)])
    forced = "rest"
  }
  var choice = null
  if (forced) for (var oi = 0; oi < options.length; oi++) if (options[oi][1] === forced && options[oi][0] > 0) choice = forced
  if (!choice) choice = weighted(options)

  if (choice === "build") {
    var side = chance(0.5) ? -1 : 1
    var supply = side < 0 ? r[0] : r[1]
    var plank = { w: H * rand(0.7, 0.95), h: H * 0.12, color: pick(["#a5703f", "#b98a54", "#8b5a2b", "#c49a6c"]) }
    q(c, [
      W(supply, { speed: 2.2 }),
      A("bend", 600),
      F(function (w2, c2) { c2.carry = plank }),
      W(function (w2) { return dojoRel(w2) + rand(-3, 3) * H }, { anim: "carry", speed: 1.5 }),
      F(function (w2, c2) { c2.carry = null }),
      A("hammer", rand(1200, 2200), { prop: "hammer", clearProp: true, every: 330, emit: function (w2, c2) {
        floatText(c2, "tok", c2.fx + c2.facing * c2.H * 0.5, c2.fy - c2.H * 0.3, { size: 9, life: 700 })
      } }),
      F(addDojoWork),
      chance(0.15) ? S(LN(c, "build")) : null,
      A("guard", 500)
    ])
  } else if (choice === "goDojo") {
    q(c, [A("guard", 400), travel(w, c, dWin.addr, function (w2) { return dojoRel(w2) + rand(-3, 3) * H })])
  } else if (choice === "follow") {
    q(c, [A("guard", 300), chance(0.25) ? S(pick(["What are you working on?", "Mind if I train here?", "Ooh, this window.", "Following the giant.", "New dojo spot?"])) : null,
      travel(w, c, active.addr, rand(0.2, 0.8) * active.w)])
  } else if (choice === "climb") {
    var lvl = irand(1, up)
    q(c, [A("guard", 400), L(function () { return c.home }, function (w2) { return dojoRel(w2) + rand(-0.8, 0.8) * TIERS[lvl].half * H }, { level: lvl })])
  } else if (choice === "kata") {
    var moves = ["punch", "punch2", "kick", "punch", "punch2"]
    var steps = [A("guard", rand(400, 900))]
    var n = irand(2, 5)
    for (var i = 0; i < n; i++) steps.push(A(pick(moves)))
    if (chance(0.4)) steps.push(F(function (w2, c2) { floatText(c2, pick(["Hyah!", "Hai!", "Hup!"]), c2.fx, c2.fy - c2.H * 1.2) }))
    steps.push(A("guard", rand(600, 1400)), XP(n))
    q(c, steps)
  } else if (choice === "combo") {
    var adv = ["uppercut", "palm", "sweep", "flyingKick", "spinKick", "kick", "punch", "punch2"]
    var cs = [A("guard", rand(300, 700))]
    var cn = irand(3, 5)
    for (var ci = 0; ci < cn; ci++) cs.push(A(pick(adv)))
    cs.push(F(function (w2, c2) { if (chance(0.5)) floatText(c2, pick(["Hyah!", "Kiai!", "Hah!", "Seiya!"]), c2.fx, c2.fy - c2.H * 1.25) }))
    cs.push(A("guard", rand(500, 1100)), XP(cn + 2))
    q(c, cs)
  } else if (choice === "weapons") {
    if (chance(0.5)) {
      q(c, [A("guard", 400), A("sword", Rig.animLength("sword") * irand(2, 3), { prop: "katana", clearProp: true, every: 700, emit: function (w2, c2) {
        floatText(c2, "shing", c2.fx + c2.facing * c2.H * 0.6, c2.fy - c2.H * 0.9, { size: 9, life: 600 })
      } }), A("bow"), XP(5)])
    } else {
      q(c, [A("staff", rand(2500, 4500), { prop: "bo", clearProp: true, every: 600, emit: function (w2, c2) {
        floatText(c2, "whoosh", c2.fx, c2.fy - c2.H * 1.1, { size: 9, life: 600 })
      } }), A("guard", 500), XP(4)])
    }
  } else if (choice === "acrobatics") {
    var acro = weighted([[4, "handstand"], [4, "cartwheel"], [3, "split"]])
    if (acro === "handstand") q(c, [A("guard", 300), A("handstand", rand(2500, 5000)), A("stand", 400), XP(3)])
    else if (acro === "split") q(c, [A("split", rand(2000, 4000)), A("stand", 400), XP(2)])
    else q(c, [W(c.rel < (r[0] + r[1]) / 2 ? r[1] - H : r[0] + H, { anim: "cartwheel", speed: 2.6 }), A("celebrate", 900), XP(3)])
  } else if (choice === "flex") {
    q(c, [A("flex", rand(1800, 3000)), chance(0.5) ? S(pick(Lines.COMMON.flexoff)) : null, A("stand", 300)])
  } else if (choice === "dance") {
    q(c, [A("dance", rand(2500, 5000), { every: 600, emit: function (w2, c2) {
      floatText(c2, pick(["♪", "♫"]), c2.fx + rand(-8, 8), c2.fy - c2.H * 1.2)
    } }), A("stand", 300)])
  } else if (choice === "nap") {
    q(c, [A("yawn", 1500), A("sit", 1000), A("sleep", rand(8000, 20000), { every: 1300, emit: function (w2, c2) {
      floatText(c2, "z", c2.fx, c2.fy - c2.H * 0.4, { vx: 12, vy: -24, life: 1600 })
    } }), A("sit", 800), A("stand", 400)])
  } else if (choice === "yawn") {
    q(c, [A("yawn", 1800, { start: function (w2, c2) { floatText(c2, "*yawn*", c2.fx, c2.fy - c2.H * 1.3, { size: 10 }) } }), A("stand", 400)])
  } else if (choice === "snack") {
    q(c, [A("sit", 600), A("coffee", rand(3000, 6000), { prop: "onigiri", clearProp: true, every: 1100, emit: function (w2, c2) {
      floatText(c2, "munch", c2.fx + c2.facing * c2.H * 0.3, c2.fy - c2.H * 0.9, { size: 9, life: 800 })
    } }), A("stand", 400)])
  } else if (choice === "flip") {
    q(c, [A("backflip")])
    if (chance(0.3)) q(c, [A("backflip")])
    q(c, [A("guard", 900), XP(2)])
  } else if (choice === "pushups") {
    var count = irand(4, 9)
    var base = irand(10, 90)
    q(c, [A("pushup", count * 760, { every: 760, emit: function (w2, c2) {
      base++
      floatText(c2, String(base), c2.fx, c2.fy - c2.H * 0.7, { size: 10 })
    } }), A("stand", 400), A("guard", 600), XP(count)])
  } else if (choice === "meditate") {
    var spotM = inDojo && dojoVisible(w) ? W(function (w2) { return dojoRel(w2) + rand(-1, 1) * H }) : null
    q(c, [spotM, A("meditate", rand(6000, 14000), { every: 2200, emit: function (w2, c2) {
      floatText(c2, "om", c2.fx + rand(-6, 6), c2.fy - c2.H * 1.3, { life: 1800, vy: -18 })
    } }), A("stand", 500), XP(4)])
  } else if (choice === "shuriken") {
    var fl = floorOf(w, c.home, c.mon)
    var dir = c.x - fl.x0 > fl.x1 - c.x ? -1 : 1
    q(c, [face(dir), A("guard", 300), A("throw", undefined, { start: function (w2, c2) { throwShuriken(w2, c2, dir) } })])
    if (chance(0.5)) q(c, [A("throw", undefined, { start: function (w2, c2) { throwShuriken(w2, c2, dir) } })])
    q(c, [A("guard", 900), XP(2)])
  } else if (choice === "dummy") {
    var useDojo = inDojo && d.stage > S_DUMMY && dojoVisible(w)
    var hitsN = irand(3, 6)
    var hitMoves = ["punch", "punch2", "kick", "palm", "uppercut"]
    var steps2 = []
    if (useDojo) {
      steps2.push(W(function (w2) { return dummyRel(w2) + H * 0.55 }), face(-1), A("guard", 400))
      for (var h1 = 0; h1 < hitsN; h1++) steps2.push(A(pick(hitMoves), undefined, { end: function (w2) { if (w2.dojo) w2.dojo.dummyWob = 1 } }))
    } else {
      var dr = clamp(c.rel + c.facing * H * 0.85, r[0] + H * 0.3, r[1] - H * 0.3)
      if (Math.abs(dr - c.rel) < H * 0.5) { c.facing = -c.facing; dr = clamp(c.rel + c.facing * H * 0.85, r[0], r[1]) }
      steps2.push(F(function (w2, c2) {
        c2.dummy = { rel: dr, wob: 0, hp: hitsN }
        puff(c2, c2.x + (dr - c2.rel), c2.y - c2.H * 0.4, 5)
      }), face(function (w2, c2) { return c2.dummy && c2.dummy.rel > c2.rel ? 1 : -1 }), A("guard", 700))
      for (var h2 = 0; h2 < hitsN; h2++) steps2.push(A(pick(hitMoves), undefined, { end: hitDummy }))
    }
    steps2.push(A("guard", 700), XP(hitsN + 1))
    q(c, steps2)
  } else if (choice === "sprint") {
    var target = c.rel < (r[0] + r[1]) / 2 ? r[1] : r[0]
    q(c, [A("guard", 300), W(target, { speed: 4.2, dust: true }), A("backflip"), A("guard", 600), XP(2)])
  } else if (choice === "crane") {
    q(c, [A("crane", rand(2500, 5000)), chance(0.4) ? S("...balance.") : null, A("guard", 400), XP(2)])
  } else if (choice === "explore") {
    var t2 = pick(otherWindows(w, c))
    q(c, [A("guard", 500), L(t2.addr, rand(0.2, 0.8) * t2.w)])
  } else if (choice === "social") {
    socialize(w, c, mates)
  } else if (choice === "rest") {
    if (chance(0.3)) q(c, [S(tournamentSoon(w) ? pick(["Tournament soon. Better heal up.", "Saving my strength."]) : pick(["Need to heal.", "Ow. Resting.", "Just a short rest."]))])
    q(c, [A("sit", 800), A(chance(0.5) ? "meditate" : "sleep", rand(10000, 16000) * (hpRatio(c) < 0.5 ? 1.6 : 1), { every: 2000, emit: function (w2, c2) {
      floatText(c2, chance(0.5) ? "z" : "+", c2.fx, c2.fy - c2.H * 0.6, { size: 10, color: "#7ee08a" })
    } }), A("stand", 400)])
  } else if (choice === "hard") {
    hardTraining(w, c)
  } else if (choice === "jutsu") {
    practiceJutsu(w, c)
  } else if (choice === "clones") {
    shadowClones(w, c)
  } else if (choice === "sulk") {
    q(c, [A("slump", rand(2500, 5000)), chance(0.4) ? S(pick(["Hmph.", "*sigh*", "Leave me alone.", "Nobody understands me."])) : null, A("stand", 400)])
  } else if (choice === "groupKata") {
    if (!startKata(w, c)) q(c, [A("guard", 800)])
  } else if (choice === "bow") {
    q(c, [face(master.rel > c.rel ? 1 : -1), A("bow"), S(pick(Lines.COMMON.sensei), 1400), A("guard", 500)])
  } else {
    if (chance(0.5)) q(c, [W(rand(r[0], r[1]), { speed: 1.3 })])
    q(c, [A("guard", rand(1200, 3000))])
  }
}

// How a mood tilts the choice of what to do next.
var MOOD_BOOST = {
  sleepy: { nap: 4, yawn: 3, meditate: 1.5, sprint: 0.3 },
  hungry: { snack: 5, share: 2 },
  vengeful: { challenge: 3, spar: 2, prank: 2, combo: 1.5 },
  playful: { prank: 2, tag: 2.5, dance: 2, mirror: 2 },
  proud: { flex: 3, flexoff: 2, acrobatics: 1.5 },
  bored: { explore: 3, prank: 1.5, dance: 1.5 },
  inspired: { kata: 1.5, combo: 2, weapons: 2, build: 1.5 },
  nervous: { meditate: 1.5, explore: 1.5, spar: 0.4 },
  sad: { social: 1.5, meditate: 1.5 },
  happy: { social: 1.4, highfive: 2, dance: 1.5 }
}
function moodBoost(mood, action) {
  var m = MOOD_BOOST[mood]
  return m && m[action] !== undefined ? m[action] : 1
}

var PLAN_SOLO = {
  train_kata: "kata", train_combo: "combo", train_weapons: "weapons", acrobatics: "acrobatics",
  meditate: "meditate", pushups: "pushups", nap: "nap", snack: "snack", dance: "dance", flex: "flex",
  throw_shuriken: "shuriken", hit_dummy: "dummy", sprint: "sprint", build_dojo: "build",
  explore_other_window: "explore", go_to_dojo: "goDojo", climb_dojo: "climb", sulk: "sulk", rest: "idle",
  practice_jutsu: "jutsu", shadow_clones: "clones", hard_training: "hard", rest_and_heal: "rest", go_to_the_giant: "follow"
}
var PLAN_SOCIAL = {
  chat: "chat", highfive: "highfive", share_food: "share", teach: "teach", meditate_with: "meditate",
  flex_off: "flexoff", copycat: "mirror", tag: "tag", prank: "prank", spar: "spar", challenge: "challenge", bow_to: "bow"
}

// Carry out a mind's plan. Returns true when handled, or the name of a
// solo choice for the regular brain to run (if it's possible right now).
function runPlan(w, c, plan, mates) {
  if (plan.say) q(c, [S(plan.say, lineDurMs(plan.say))])
  var kind = PLAN_SOCIAL[plan.action]
  if (!kind) return PLAN_SOLO[plan.action] || null
  var t = plan.target
  if (!t || !alive(w, t) || t.event || t.mode !== "ground" || !t.visible) return null
  if (t.home !== c.home || t.level) {
    // Go and find them first, then try again.
    var tw = windowOf(w, t.home)
    if (!tw || !tw.visible || (plan.tries || 0) > 0 || t.level) return null
    plan.tries = 1
    c.mindPlan = plan
    plan.say = ""
    q(c, [A("guard", 300), travel(w, c, t.home, function () { return t.rel + (t.rel > t.H * 2 ? -1 : 1) * t.H })])
    return true
  }
  if (kind === "spar") { startSpar(w, c, t); return true }
  if (kind === "challenge") {
    q(c, [face(t.rel > c.rel ? 1 : -1), A("beckon", 1200),
      F(function (w2, c2) { if (!t.event && isIdle(t) && t.home === c2.home && !t.level) startDuel(w2, c2, t, {}) })])
    return true
  }
  if (kind === "bow") {
    q(c, [face(t.rel > c.rel ? 1 : -1), A("bow"), A("guard", 400)])
    addRel(w, c, t, 0.2)
    return true
  }
  if (kind === "teach" && beltIndex(c) < beltIndex(t)) kind = "chat"
  startPair(w, c, t, kind)
  return true
}

function lineDurMs(text) { return readMs(text) }

// A world event chosen by the storyteller mind.
function directorEvent(w, d) {
  if (!d || !d.event || d.event === "none") return false
  var named = (d.ninjas || []).map(function (n) {
    for (var i = 0; i < w.critters.length; i++) if (w.critters[i].name === n) return w.critters[i]
    return null
  }).filter(function (c) { return c && c.visible && c.mode === "ground" })
  var free = w.critters.filter(function (c) { return c.visible && c.mode === "ground" && !c.event })
  var text = String(d.announcement || "").slice(0, 120)
  var speaker = named[0] || (w.masterId ? find(w, w.masterId) : null) || free[0]
  var announce = function () { if (speaker && text) { say(speaker, text, lineDurMs(text) + 600); floatText(speaker, "!", speaker.fx, speaker.fy - speaker.H * 1.4, { size: 14 }) } }
  if (d.event === "demon_raid") {
    if (!startRaid(w)) return false
  } else if (d.event === "tournament") {
    if (!startTournament(w)) return false
    announce()
  } else if (d.event === "group_kata") {
    var leader = speaker && !speaker.event ? speaker : free[0]
    if (!leader || !startKata(w, leader)) return false
    announce()
  } else if (d.event === "festival" || d.event === "feast") {
    if (!free.length) return false
    announce()
    for (var i = 0; i < free.length; i++) {
      var c = free[i]
      if (c === speaker) continue
      interrupt(c)
      if (d.event === "festival") q(c, [A("guard", rand(300, 900)), A("dance", rand(5000, 8000), { every: 700, emit: function (w2, c2) {
        floatText(c2, pick(["♪", "♫"]), c2.fx + rand(-8, 8), c2.fy - c2.H * 1.2)
      } }), A("celebrate", 900)])
      else q(c, [A("sit", 600), A("coffee", rand(5000, 8000), { prop: "onigiri", clearProp: true, every: 1200, emit: function (w2, c2) {
        floatText(c2, "munch", c2.fx, c2.fy - c2.H * 0.9, { size: 9, life: 700 })
      } }), A("stand", 400)])
      remember(w, c, d.event === "festival" ? "We had a dance festival." : "We had a feast together.")
    }
    if (speaker && !speaker.event) { interrupt(speaker); q(speaker, [A("talk", lineDurMs(text)), A(d.event === "festival" ? "dance" : "coffee", 5000, d.event === "feast" ? { prop: "onigiri", clearProp: true } : undefined)]) }
  } else if (d.event === "rivalry" || d.event === "friendship") {
    if (named.length < 2) return false
    var a = named[0], b = named[1]
    addRel(w, a, b, d.event === "rivalry" ? -1.5 : 1.5)
    a.mindPlan = { action: d.event === "rivalry" ? "challenge" : "highfive", target: b, say: text, at: w.t }
    remember(w, a, d.event === "rivalry" ? "I decided " + b.name + " is my rival." : "I made up with " + b.name + ".", true)
    remember(w, b, d.event === "rivalry" ? a.name + " declared me their rival!" : a.name + " and I are friends now.", true)
  } else if (d.event === "storytime") {
    if (!speaker || speaker.event) return false
    interrupt(speaker)
    var dur = lineDurMs(text) + 1500
    q(speaker, [A("talk", dur, { start: function (w2, c2) { say(c2, text, dur) } }), A("bow")])
    for (var k = 0; k < free.length; k++) {
      var l = free[k]
      if (l === speaker || l.home !== speaker.home || l.level) continue
      interrupt(l)
      q(l, [face(speaker.rel > l.rel ? 1 : -1), A("seiza", dur + 800)])
      remember(w, l, speaker.name + " told a story: \"" + text + "\"")
    }
  } else if (d.event === "announcement") {
    if (!speaker) return false
    say(speaker, text, lineDurMs(text))
  } else return false
  chronicle(w, "Event: " + d.event + (text ? " — " + text : ""))
  return true
}

// ---------------------------------------------------------------- relationships

function relKey(a, b) { return a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id }
// Pairs start from a first impression: some click, some don't.
function relOf(w, a, b) {
  var k = relKey(a, b)
  if (w.rel[k] === undefined) w.rel[k] = Math.round(rand(-2.4, 2.4) * 10) / 10
  return w.rel[k]
}
function addRel(w, a, b, d) { w.rel[relKey(a, b)] = clamp(relOf(w, a, b) + d, -5, 5) }

// Best friend and biggest rival, for introductions and the roster.
function bonds(w, c) {
  var best = null, worst = null, bv = 1, wv = -1
  for (var i = 0; i < w.critters.length; i++) {
    var o = w.critters[i]
    if (o === c) continue
    var v = relOf(w, c, o)
    if (v > bv) { bv = v; best = o }
    if (v < wv) { wv = v; worst = o }
  }
  return { friend: best, rival: worst }
}

// ---------------------------------------------------------------- pair interactions

// Pick something to do with another ninja in the same window.
function socialize(w, c, mates) {
  // Prefer friends and rivals over strangers.
  var b = pick(mates)
  for (var i = 0; i < mates.length; i++) if (Math.abs(relOf(w, c, mates[i])) > Math.abs(relOf(w, c, b)) && chance(0.6)) b = mates[i]
  var rel = relOf(w, c, b)
  var friend = rel > 1.5, rival = rel < -1.5
  var P = function (k) { return Lines.weight(c, k) }
  var kind = weighted([
    [10 * P("chat"), "chat"],
    [(friend ? 8 : 2) * P("highfive"), "highfive"],
    [3 * P("share") * (friend ? 2 : 1) * P("snack"), "share"],
    [beltIndex(c) > beltIndex(b) ? 6 * P("teach") : 0, "teach"],
    [3 * P("meditate"), "meditate"],
    [2 * P("flexoff") * (rival ? 2 : 1) * P("flex"), "flexoff"],
    [2 * P("mirror"), "mirror"],
    [2 * P("prank") * (rival ? 2 : 1), "prank"],
    [3 * P("tag") * (friend ? 1.5 : 1), "tag"],
    [4 * P("spar") * (rival ? 2.5 : 1) * fightUrge(c), "spar"],
    [2 * P("challenge") * (rival ? 2.5 : 1) * fightUrge(c), "challenge"]
  ])
  if (kind === "spar") { startSpar(w, c, b); return }
  if (kind === "challenge") {
    q(c, [face(b.rel > c.rel ? 1 : -1), A("beckon", 1200, { start: function (w2, c2) { say(c2, LN(c2, "challenge", b), 1800) } }),
      F(function (w2, c2) {
        if (avoidsFights(b)) { say(b, pick(["Not now, I'm hurt.", "Pick on someone healthy.", "Later!"])); return }
        if (!b.event && isIdle(b) && b.home === c2.home && !b.level) startDuel(w2, c2, b, {})
      })])
    return
  }
  startPair(w, c, b, kind)
}

// How badly a ninja wants to rest: grows with missing health, more so
// before a tournament, unless they're reckless.
function restUrge(w, c) {
  var missing = 1 - hpRatio(c)
  var k = 60 * missing * missing
  if (hasTrait(c, "cautious")) k *= 2
  if (hasTrait(c, "reckless")) k *= 0.15
  if (tournamentSoon(w) && missing > 0.1) k *= 3
  return k
}

function tournamentSoon(w) { return !!(w.dojo && w.dojo.stage > S_SIGN && w.nextTournament - w.activeMs < 5 * 60000) }

// Badly hurt and sensible: rest instead of anything strenuous.
function shouldRestNow(w, c) {
  if (hasTrait(c, "reckless")) return false
  var r = hpRatio(c)
  return r < 0.35 || (tournamentSoon(w) && r < 0.7)
}

// How keen on fighting they are right now.
function fightUrge(c) {
  var k = hasTrait(c, "brawler") ? 3.5 : 1
  if (hurtish(c) && !hasTrait(c, "reckless") && !hasTrait(c, "brawler")) k *= 0.15
  if (hpRatio(c) < 0.35 && !hasTrait(c, "reckless")) k *= 0.1
  return k
}

function startPair(w, a, b, kind) {
  interrupt(b)
  var ev = { type: "pair", t: 0, kind: kind, a: a, b: b, round: 0 }
  if (kind === "chat" && w.mindOn && w.mindDialogue) {
    ev.awaitLlm = true
    w.mindQueue.push({ type: "dialogue", ev: ev })
  }
  phase(ev, "gather")
  claim(ev, [a, b])
  w.events.push(ev)
  return ev
}

var PAIR_GAP = { chat: 0.5, highfive: 0.3, share: 0.42, teach: 0.6, meditate: 0.45, flexoff: 0.55, mirror: 0.7, tag: 0.6 }

function tickPair(w, ev) {
  var a = ev.a, b = ev.b
  if (!alive(w, a) || !alive(w, b) || a.event !== ev || b.event !== ev) { endEvent(w, ev); return }
  if (ev.phase === "gather") {
    if (a.home !== b.home || a.level || b.level) { endEvent(w, ev); return }
    if (allIdle([a, b])) {
      if (ev.kind === "prank") placePrank(w, ev)
      else {
        var r = walkRange(w, a)
        var gap = (PAIR_GAP[ev.kind] || 0.5) * a.H
        var X = clamp((a.rel + b.rel) / 2, r[0] + gap, r[1] - gap)
        var left = a.rel <= b.rel ? a : b, right = left === a ? b : a
        q(left, [W(X - gap, { speed: 1.6 }), face(1)])
        q(right, [W(X + gap, { speed: 1.6 }), face(-1)])
      }
      phase(ev, "perform")
    } else if (ev.phaseT > 8000) endEvent(w, ev)
    return
  }
  if (ev.phase === "perform") {
    if (!allIdle([a, b])) {
      if (ev.phaseT > 30000) endEvent(w, ev)
      return
    }
    ev.phaseT = 0
    if (!PAIRS[ev.kind](w, ev, ev.round++)) {
      pairMemory(w, ev)
      endEvent(w, ev)
    }
  }
}

function lineDur(text) { return readMs(text) }

// Each pair script queues one round of steps for both and returns true, or
// returns false when the interaction is over.
var PAIRS = {
  chat: function (w, ev, round) {
    if (round > 0) { addRel(w, ev.a, ev.b, 0.4); return false }
    var a = ev.a, b = ev.b
    // Wait a little for a mind-written conversation; fall back to the book.
    if (ev.awaitLlm && !ev.llmLines && (ev.llmWait || 0) < 9000) {
      ev.llmWait = (ev.llmWait || 0) + 500
      ev.round--
      q(a, [A("think", 500)]); q(b, [A("listen2", 500)])
      return true
    }
    var convo = ev.llmLines || Lines.conversation(a, b)
    ev.firstLine = fmt(convo[0][1], a, { other: b.name })
    var sa = [], sb = []
    for (var i = 0; i < convo.length; i++) {
      var sp = convo[i][0] === 0 ? a : b
      var other = sp === a ? b : a
      var text = fmt(convo[i][1], sp, { other: other.name })
      var d = lineDur(text)
      var talk = A("talk", d, { start: (function (t, dd) { return function (w2, c2) { say(c2, t, dd - 150) } })(text, d) })
      var listen = A("listen2", d)
      if (sp === a) { sa.push(talk); sb.push(listen) } else { sb.push(talk); sa.push(listen) }
    }
    var funny = Lines.personality(a) === Lines.PERSONALITIES.goofball || Lines.personality(b) === Lines.PERSONALITIES.goofball
    var end = funny && chance(0.6) ? "laugh" : (chance(0.5) ? "bow" : "stand")
    sa.push(A(end, end === "bow" ? undefined : 900))
    sb.push(A(end, end === "bow" ? undefined : 900))
    q(a, sa); q(b, sb)
    return true
  },
  highfive: function (w, ev, round) {
    if (round > 0) { addRel(w, ev.a, ev.b, 0.7); return false }
    var line = pick(Lines.COMMON.highfive)
    q(ev.a, [A("highfive", undefined, { start: function (w2, c2) {
      say(c2, line, 1200)
      later(c2, 260, function (w3, c3) { stars(c3, c3.fx + c3.facing * c3.H * 0.3, c3.fy - c3.H * 1.15, 3); floatText(c3, "*clap*", c3.fx + c3.facing * c3.H * 0.3, c3.fy - c3.H * 1.4, { size: 10 }) })
    } }), A("celebrate", 900)])
    q(ev.b, [A("highfive"), A("celebrate", 900)])
    return true
  },
  share: function (w, ev, round) {
    if (round > 0) { addRel(w, ev.a, ev.b, 0.8); return false }
    var a = ev.a, b = ev.b
    var give = LN(a, "shareGive", b), get = fmt(pick(Lines.COMMON.shareGet), b, { other: a.name })
    q(a, [A("talk", lineDur(give), { prop: "onigiri", start: function (w2, c2) { say(c2, give) } }), F(function (w2, c2) { c2.prop = null }),
      A("sit", 500), A("coffee", 4000, { prop: "onigiri", clearProp: true })])
    q(b, [A("listen2", lineDur(give)), A("talk", 1500, { start: function (w2, c2) { say(c2, get, 1400) } }),
      A("coffee", 3000, { prop: "onigiri", clearProp: true, every: 1000, emit: function (w2, c2) { floatText(c2, "munch", c2.fx, c2.fy - c2.H * 0.9, { size: 9, life: 700 }) } })])
    return true
  },
  teach: function (w, ev, round) {
    var a = ev.a, b = ev.b
    if (round > 1) {
      addRel(w, a, b, 0.5)
      gainXp(b, 8)
      gainXp(a, 3)
      return false
    }
    var move = ev.move || (ev.move = pick(["uppercut", "palm", "sweep", "spinKick", "flyingKick", "kick"]))
    var d = Rig.animLength(move)
    if (round === 0) {
      var tl = pick(Lines.COMMON.teach)
      q(a, [A("talk", lineDur(tl), { start: function (w2, c2) { say(c2, tl) } }), A(move), A("guard", 500)])
      q(b, [A("listen2", lineDur(tl) + d + 500)])
    } else {
      var ll = pick(Lines.COMMON.learn)
      q(b, [A(move), A("talk", lineDur(ll), { start: function (w2, c2) { say(c2, ll) } }), A("bow")])
      q(a, [A("guard", d), chance(0.6) ? A("thumbsup", lineDur(ll)) : A("facepalm", lineDur(ll)), A("bow")])
    }
    return true
  },
  meditate: function (w, ev, round) {
    if (round > 0) { addRel(w, ev.a, ev.b, 0.5); gainXp(ev.a, 3); gainXp(ev.b, 3); return false }
    var dur = rand(8000, 15000)
    var om = function (w2, c2) { if (chance(0.6)) floatText(c2, "om", c2.fx, c2.fy - c2.H * 1.3, { life: 1800, vy: -18 }) }
    q(ev.a, [A("meditate", dur, { every: 2400, emit: om }), A("stand", 400), A("bow")])
    q(ev.b, [A("meditate", dur, { every: 2600, emit: om }), A("stand", 400), A("bow")])
    return true
  },
  flexoff: function (w, ev, round) {
    var a = ev.a, b = ev.b
    if (round > 0) { addRel(w, a, b, -0.1); return false }
    var loser = physique(a) >= physique(b) ? b : a
    var l1 = pick(Lines.COMMON.flexoff)
    q(a, [A("flex", 1800, { start: function (w2, c2) { say(c2, l1, 1600) } }), A("listen2", 1800), loser === a ? A("shrug", 1500) : A("victory", 1500)])
    q(b, [A("listen2", 1800), A("flex", 1800, { start: function (w2, c2) { say(c2, LN(c2, "tease", a), 1600) } }),
      loser === b ? A("shrug", 1500, { start: function (w2, c2) { say(c2, "...fine. You win.", 1400) } }) : A("victory", 1500)])
    return true
  },
  mirror: function (w, ev, round) {
    var a = ev.a, b = ev.b
    if (round > 0) { addRel(w, a, b, Lines.personality(a) === Lines.PERSONALITIES.goofball ? 0.3 : -0.3); return false }
    var moves = ["punch", "kick", "flex", "backflip", "dance", "crane", "uppercut"]
    var seq = []
    for (var i = 0; i < irand(3, 5); i++) {
      var m = pick(moves)
      seq.push(m === "flex" || m === "dance" || m === "crane" ? A(m, 1200) : A(m))
    }
    var copy = function () { return seq.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; return o }) }
    var sa = copy(), sb = [A("listen2", 350)].concat(copy())
    sa.push(A("guard", 350))
    var end = pick(Lines.COMMON.mirrorEnd)
    sa.push(A("point", 1600, { start: function (w2, c2) { say(c2, end, 1500) } }))
    sb.push(A("laugh", 1600))
    q(a, sa); q(b, sb)
    return true
  },
  tag: function (w, ev, round) {
    var a = ev.a, b = ev.b
    if (round > 3) { addRel(w, a, b, 0.4); return false }
    if (round === 3) {
      q(a, [A("laugh", 1400)]); q(b, [A("laugh", 1400)])
      return true
    }
    // Even rounds a is "it" and tags b; odd rounds the other way round.
    var it = round % 2 ? b : a, run = it === a ? b : a
    var r = walkRange(w, run)
    var far = run.rel < (r[0] + r[1]) / 2 ? r[1] - run.H * 0.3 : r[0] + run.H * 0.3
    var tagLine = pick(Lines.COMMON.tagIt)
    q(it, [face(run.rel > it.rel ? 1 : -1), A("punch2", undefined, { start: function (w2, c2) { say(c2, tagLine, 1200) } }),
      A("guard", 250), W(far - (far > run.rel ? 1 : -1) * run.H * 0.55, { speed: 3.4 })])
    q(run, [A("shock", Rig.animLength("punch2")), W(far, { speed: 3.9, dust: true }), face(far > run.rel ? -1 : 1)])
    return true
  },
  prank: function (w, ev, round) {
    var a = ev.a, b = ev.b
    if (round > 0) {
      var likes = Lines.personality(b) === Lines.PERSONALITIES.goofball
      addRel(w, a, b, likes ? 0.3 : -0.6)
      return false
    }
    var vl = fmt(Lines.line(b, "click"), b, { other: a.name })
    var victimLine = chance(0.5) ? fmt(pick(Lines.COMMON.prankVictim), b, { other: a.name }) : vl
    var boo = Rig.animLength("boo")
    q(a, [face(b.rel > a.rel ? 1 : -1), A("boo", boo, { start: function (w2, c2) {
      floatText(c2, "BOO!", c2.fx + c2.facing * c2.H * 0.3, c2.fy - c2.H * 1.3, { size: 15, vy: -14, color: "#ffd84a" })
    } }), A("laugh", 1800, { start: function (w2, c2) { say(c2, pick(Lines.COMMON.prankDone), 1600) } })])
    q(b, [A("stand", 150), A("shock", boo + 200, { start: function (w2, c2) {
      c2.facing = -c2.facing
      floatText(c2, "!", c2.fx, c2.fy - c2.H * 1.4, { size: 16, vy: -10 })
    } }), A(chance(0.5) ? "facepalm" : "point", 1600, { start: function (w2, c2) { say(c2, victimLine, 1500) } })])
    return true
  }
}

var PAIR_MEMORY = {
  chat: ["I chatted with {b}{quote}.", "{a} chatted with me{quote}."],
  highfive: ["I high-fived {b}.", "{a} high-fived me."],
  share: ["I shared a rice ball with {b}.", "{a} shared a rice ball with me."],
  teach: ["I taught {b} a {move}.", "{a} taught me the {move}."],
  meditate: ["I meditated next to {b}.", "{a} meditated with me."],
  flexoff: ["I had a flex-off with {b}.", "{a} challenged me to a flex-off."],
  mirror: ["I copied everything {b} did, to annoy them.", "{a} copied all my moves. Annoying."],
  tag: ["I played tag with {b}.", "{a} played tag with me."],
  prank: ["I pranked {b} with a BOO. Hehe.", "{a} snuck up and scared me with a BOO!"]
}

function pairMemory(w, ev) {
  var m = PAIR_MEMORY[ev.kind]
  if (!m) return
  var quote = ev.firstLine ? ": \"" + ev.firstLine + "\"" : ""
  var f = function (t) {
    return t.split("{a}").join(ev.a.name).split("{b}").join(ev.b.name).split("{move}").join(ev.move || "move").split("{quote}").join(quote)
  }
  remember(w, ev.a, f(m[0]))
  remember(w, ev.b, f(m[1]), ev.kind === "prank" || ev.kind === "mirror")
  if (ev.kind === "prank" || ev.kind === "teach") chronicle(w, f(m[0]).replace(/^I /, ev.a.name + " ").replace(/ me/, " " + ev.b.name))
}

// Sneak up behind the victim, who looks the other way.
function placePrank(w, ev) {
  var a = ev.a, b = ev.b
  var r = walkRange(w, b)
  var away = a.rel < b.rel ? 1 : -1
  b.facing = away
  b.eventIdle = "stand"
  var behind = clamp(b.rel - away * b.H * 0.42, r[0], r[1])
  q(a, [W(behind, { anim: "sneak", speed: 0.8 })])
}

// ---------------------------------------------------------------- reactions

// Someone just arrived in a window: the locals may say hello (or jump).
function greetArrival(w, c) {
  for (var i = 0; i < w.critters.length; i++) {
    var o = w.critters[i]
    if (o === c || o.home !== c.home || o.level || o.event || !isIdle(o) || !o.visible) continue
    var near = Math.abs(o.rel - c.rel) < o.H * 1.2
    if (o.personality === "nervous" && near) {
      q(o, [A("shock", 800, { start: function (w2, c2) { say(c2, Lines.line(c2, "click"), 1200) } })])
      continue
    }
    if (!chance(0.45)) continue
    var line = fmt(Lines.line(o, "greet"), o, { other: c.name })
    q(o, [face(c.rel > o.rel ? 1 : -1), A(chance(0.5) ? "bow" : "wave", 1300, { start: function (t) { return function (w2, c2) { say(c2, t, 1600) } }(line) })])
    addRel(w, o, c, 0.1)
    return
  }
}

// Onlookers react to a knockout.
function koReaction(w, duel) {
  for (var i = 0; i < w.critters.length; i++) {
    var o = w.critters[i]
    if (o === duel.a || o === duel.b || o.home !== duel.loser.home || o.event || o.level || !isIdle(o) || !chance(0.5)) continue
    var laugh = o.personality === "goofball" || relOf(w, o, duel.loser) < -1.5
    var t = laugh ? pick(Lines.COMMON.laughAt) : pick(Lines.COMMON.koReact)
    q(o, [face(duel.loser.rel > o.rel ? 1 : -1), A(laugh ? "laugh" : "shock", 1300, { start: function (tt) { return function (w2, c2) { say(c2, tt, 1300) } }(t) })])
  }
}

function hitDummy(w, c) {
  var d = c.dummy
  if (!d) return
  d.hp--
  d.wob = c.facing * 1.0
  var dx = c.x + (d.rel - c.rel)
  stars(c, dx, c.y - c.H * 0.7, 1)
  if (d.hp <= 0) {
    for (var i = 0; i < 6; i++) {
      addPart(c.parts, { type: "plank", x: dx + rand(-6, 6), y: c.y - c.H * rand(0.2, 0.9), vx: c.facing * rand(60, 260) + rand(-40, 40),
        vy: rand(-420, -160), g: GRAVITY * 0.7, vr: rand(-12, 12), life: 2200, size: c.H * rand(0.2, 0.35), floor: c.y - 2 })
    }
    c.dummy = null
    if (chance(0.6)) say(c, pick(Lines.COMMON.dummy))
  }
}

function throwShuriken(w, c, dir) {
  var fl = floorOf(w, c.home, c.mon)
  var sx = c.fx + dir * c.H * 0.3
  var sy = c.fy - c.H * 0.75
  var tx = dir > 0 ? fl.x1 - 3 : fl.x0 + 3
  var ty = sy - rand(0, c.H * 1.8)
  var dist = Math.abs(tx - sx)
  var home = c.home
  addPart(c.parts, { type: "flyto", kind: "shuriken", sx: sx, sy: sy, x: sx, y: sy, tx: tx, ty: ty, apex: rand(-10, 10),
    life: clamp(dist * 0.9, 120, 700), size: c.H * 0.13, vr: 30,
    onDone: function (w2, c2) {
      if (c2.home !== home) return
      w2.decor.push({ x: tx, y: ty, until: w2.t + 15000, rot: rand(0, 6), home: home, size: c2.H * 0.13 })
      w2.decorVersion++
      if (chance(0.25)) say(c2, pick(Lines.COMMON.shuriken))
    } })
}

// ---------------------------------------------------------------- traits & health

var TRAITS = {
  driven: { label: "Driven", blurb: "trains brutally hard" },
  brawler: { label: "Brawler", blurb: "challenges everyone" },
  tough: { label: "Tough", blurb: "takes a beating" },
  fragile: { label: "Fragile", blurb: "bruises easily" },
  quickHealer: { label: "Quick healer", blurb: "heals fast" },
  lazy: { label: "Lazy", blurb: "avoids hard work" },
  cautious: { label: "Cautious", blurb: "rests when hurt" },
  reckless: { label: "Reckless", blurb: "fights when hurt" },
  prodigy: { label: "Prodigy", blurb: "learns fast" },
  clutch: { label: "Clutch", blurb: "rises to big moments" },
  streaky: { label: "Streaky", blurb: "runs hot and cold" }
}
var TRAIT_CLASH = { driven: "lazy", lazy: "driven", tough: "fragile", fragile: "tough", cautious: "reckless", reckless: "cautious" }
var TRAIT_AFFINITY = {
  hothead: ["brawler", "reckless", "driven", "streaky"], stoic: ["tough", "cautious", "clutch"], goofball: ["streaky", "lazy", "reckless"],
  philosopher: ["cautious", "prodigy", "clutch"], showoff: ["driven", "clutch", "streaky"], sleepy: ["lazy", "quickHealer", "tough"],
  foodie: ["tough", "lazy", "quickHealer"], nervous: ["cautious", "fragile", "prodigy"], poet: ["prodigy", "fragile", "clutch"]
}

// One or two traits, leaning on personality. Recruits are sometimes
// fired-up prodigies who came to make a name for themselves.
function rollTraits(personality, recruit) {
  var out = []
  if (recruit && chance(0.35)) out = ["driven", chance(0.5) ? "prodigy" : "brawler"]
  var pool = (TRAIT_AFFINITY[personality] || []).concat(Object.keys(TRAITS))
  var n = out.length ? 0 : (chance(0.55) ? 2 : 1)
  while (n > 0) {
    var t = pick(pool)
    if (out.indexOf(t) >= 0 || (TRAIT_CLASH[t] && out.indexOf(TRAIT_CLASH[t]) >= 0)) continue
    out.push(t)
    n--
  }
  return out
}

function hasTrait(c, t) { return !!(c.traits && c.traits.indexOf(t) >= 0) }
function traitLabels(c) { return (c.traits || []).map(function (t) { return TRAITS[t] ? TRAITS[t].label : t }) }

function maxHp(c) { return hasTrait(c, "tough") ? 130 : (hasTrait(c, "fragile") ? 80 : 100) }
function hpRatio(c) { return clamp((c.hp === undefined ? maxHp(c) : c.hp) / maxHp(c), 0, 1) }
// How much of their strength a ninja can bring right now.
function condition(c) { return 0.62 + 0.38 * hpRatio(c) }
function hurtish(c) { return hpRatio(c) < 0.5 }
// Would they rather not fight?
function avoidsFights(c) { return !c.injured && hurtish(c) && !hasTrait(c, "reckless") && !hasTrait(c, "brawler") }

function heal(c, n) { c.hp = Math.min(maxHp(c), (c.hp || 0) + n) }

function damage(w, c, n, cause) {
  if (!alive(w, c) || c.injured) return
  var k = hasTrait(c, "tough") ? 0.75 : (hasTrait(c, "fragile") ? 1.3 : 1)
  c.hp = Math.max(0, (c.hp === undefined ? maxHp(c) : c.hp) - n * k)
  if (c.hp <= 0) injure(w, c, cause)
}

function injure(w, c, cause) {
  c.injured = true
  c.injuredAt = Date.now()
  c.hp = 0
  c.injuries = (c.injuries || 0) + 1
  leaveEvent(w, c)
  interrupt(c)
  floatText(c, "INJURED", c.fx, c.fy - c.H * 1.3, { size: 12, color: "#ff6b6b", life: 2000 })
  stars(c, c.fx, c.fy - c.H * 0.4, 5)
  say(c, pick(["Ow ow ow.", "I'll just... lie here.", "Worth it.", "Medic!", "Too much...", "Need... a minute."]))
  remember(w, c, "I got injured (" + cause + ") and had to lie down to recover.", true)
  chronicle(w, c.name + " got injured: " + cause + ".")
}

// Lying hurt: heal up, groan now and then, get back up when ready.
function tickInjured(w, c, dt) {
  setAnim(w, c, "hurt")
  if (Math.random() < dt / 9000) floatText(c, pick(["ow", "*groan*", "ugh", "zz"]), c.fx, c.fy - c.H * 0.5, { size: 9, life: 1200 })
  if (hpRatio(c) >= 0.5 && Date.now() - (c.injuredAt || 0) > 60000) {
    c.injured = false
    q(c, [A("fallen", 900, { recovery: true }), A("dizzy", 900, { recovery: true }), S(pick(["I'm okay!", "Back on my feet.", "That was a nap. Totally.", "Lesson learned. Probably."])), A("stand", 400, { recovery: true })])
    remember(w, c, "I recovered from my injury.")
  }
}

// Health returns over time: slowly while active, faster when resting,
// slowest while injured. Runs even off screen, so injuries heal while
// you're away.
var RESTING = { sleep: 1, meditate: 1, coffee: 1, seiza: 1, sit: 1, hurt: 1, drink: 1 }
var LIGHT_REST = { stand: 1, guard: 1, listen2: 1, think: 1, admire: 1 }
function regen(c, dt) {
  var rate = c.injured ? 0.12 : (RESTING[c.anim] ? 0.5 : (LIGHT_REST[c.anim] ? 0.12 : 0.05))
  // No catching your breath between rounds: endurance is the point.
  var ev = c.event && c.event.parent ? c.event.parent : c.event
  if (ev && ev.type === "tournament" && ev.phase !== "party" && ev.phase !== "toast" && !c.injured) rate = 0.05
  // Sake and good company: everyone mends quickly at the party.
  if (c.partyOf && !c.partyOf.over && c.partyOf.phase === "party") rate = c.injured ? 0.45 : 0.8
  if (hasTrait(c, "quickHealer")) rate *= 2
  heal(c, rate * dt / 1000)
  // Form drifts: good days and bad days.
  var swing = hasTrait(c, "streaky") ? 2 : 1
  c.form = clamp((c.form || 0) * (1 - 0.004 * dt / 1000) + (Math.random() - 0.5) * 0.004 * swing * dt / 1000, -0.15 * swing, 0.15 * swing)
}

function shiftForm(c, d) {
  var swing = hasTrait(c, "streaky") ? 2 : 1
  c.form = clamp((c.form || 0) + d * swing, -0.15 * swing, 0.15 * swing)
}

// Brutal training: much more experience, at a cost.
function hardTraining(w, c) {
  var H = c.H
  var r = walkRange(w, c)
  var kind = weighted([[3, "boulder"], [3, "kicks"], [2, "run"], [2, "pushups"]])
  var sweat = function (w2, c2) {
    addPart(c2.parts, { type: "drop", x: c2.fx + rand(-6, 6), y: c2.fy - c2.H * 0.95, vx: rand(-60, 60), vy: rand(-90, -40), g: 900, life: 600, size: c2.H * 0.03, floor: c2.fy - 1 })
  }
  var rock = { w: H * 0.75, h: H * 0.5, color: "#7d756b" }
  var steps = [F(function (w2, c2) { floatText(c2, pick(["HARD MODE", "NO LIMITS", "BEYOND!", "AGAIN!"]), c2.fx, c2.fy - c2.H * 1.5, { size: 11, color: "#ff8c42" }) })]
  if (kind === "boulder") {
    steps.push(A("bend", 600), F(function (w2, c2) { c2.carry = rock }), A("strain", rand(3500, 5500), { every: 250, emit: sweat }), F(function (w2, c2) { c2.carry = null; dust(c2, c2.fx + c2.facing * c2.H * 0.4, c2.fy, 6) }))
  } else if (kind === "kicks") {
    var count = 0
    for (var i = 0; i < 9; i++) steps.push(A(pick(["kick", "spinKick", "kick"]), undefined, { start: function (w2, c2) {
      count += 125
      floatText(c2, String(Math.min(count, 1000)), c2.fx, c2.fy - c2.H * 1.25, { size: 10 })
      sweat(w2, c2)
    } }))
  } else if (kind === "run") {
    steps.push(A("bend", 500), F(function (w2, c2) { c2.carry = rock }))
    for (var l = 0; l < 4; l++) steps.push(W(l % 2 ? r[0] + H : r[1] - H, { anim: "carry", speed: 2.3, dust: true }))
    steps.push(F(function (w2, c2) { c2.carry = null }))
  } else {
    steps.push(A("pushup", 6000, { every: 380, emit: function (w2, c2) { sweat(w2, c2); if (chance(0.4)) floatText(c2, pick(["ONE ARM", "+1", "GRR"]), c2.fx, c2.fy - c2.H * 0.7, { size: 9 }) } }))
  }
  steps.push(A("brow", 1200), F(function (w2, c2) {
    gainXp(c2, rand(18, 28))
    damage(w2, c2, rand(12, 22), "overtraining")
    if (alive(w2, c2) && !c2.injured && hpRatio(c2) < 0.15 && chance(0.35)) injure(w2, c2, "pulled a muscle during hard training")
  }))
  q(c, steps)
}

// Kneel by an injured friend and help them heal.
function tend(w, c, patient) {
  if (!c.tendedAt) c.tendedAt = {}
  c.tendedAt[patient.id] = w.t
  var food = chance(0.6)
  q(c, [W(function () { return patient.rel + (patient.rel > c.rel ? -1 : 1) * c.H * 0.55 }, { speed: 2.2 }),
    face(function () { return patient.rel > c.rel ? 1 : -1 }),
    A("tend", 3500, { prop: food ? "onigiri" : null, clearProp: true, start: function (w2, c2) {
      say(c2, pick(["You okay?", "Here, eat something.", "Easy. Don't get up.", "I'll keep watch.", "Breathe. You're fine."]))
    }, every: 900, emit: function (w2, c2) { floatText(c2, "+", patient.fx, patient.fy - c2.H * 0.5, { size: 12, color: "#7ee08a" }) } }),
    F(function (w2, c2) {
      if (!alive(w2, patient)) return
      heal(patient, 25)
      addRel(w2, c2, patient, 1)
      remember(w2, patient, c2.name + " looked after me while I was injured.", true)
      remember(w2, c2, "I looked after " + patient.name + " while they were injured.")
      if (patient.injured) say(patient, pick(["Thanks...", "You're a real friend.", "I owe you one.", "Ow. Thanks."]))
    }), A("stand", 400)])
}

// ---------------------------------------------------------------- demon raids

// Now and then a rift opens in the dojo's window and demons pour out to
// torment the ninjas. Everyone defends; if they all fall, the demons wreck
// part of the dojo before slipping back through the rift.

var DEMON_TAUNTS = {
  imp: ["Hehehe!", "Tiny ninjas!", "Your dojo smells like rice!", "We came for the sake!", "Boo! Hehe.", "Nice headband. Mine now!",
    "Is that a dojo or a birdhouse?", "Catch me if you can!", "Snack time!"],
  oni: ["WHO DARES TRAIN HERE?", "I EAT DOJOS FOR BREAKFAST.", "PUNY WINDOW DWELLERS.", "THIS PAGODA IS MINE.", "BRING ME YOUR SENSEI!"]
}
var DEFENDER_LINES = ["DEMONS!", "Protect the dojo!", "Not the cherry tree!", "Everyone, form up!", "Back to the rift with you!", "Hai!"]

function raidActive(w) { return !!(w.raid && !w.raid.over) }

function demonOf(w, id) {
  if (!w.raid) return null
  for (var i = 0; i < w.raid.demons.length; i++) if (w.raid.demons[i].id === id) return w.raid.demons[i]
  return null
}

// Begin a raid in the dojo's window (or, with no dojo yet, where most ninjas are).
function startRaid(w, opts) {
  opts = opts || {}
  if (raidActive(w) || w.homeState) return false
  for (var e = 0; e < w.events.length; e++) if (w.events[e].type === "tournament") return false
  var win = dojoVisible(w) ? dojoWindow(w) : null
  if (!win) {
    var counts = {}
    for (var i = 0; i < w.critters.length; i++) {
      var c0 = w.critters[i]
      if (c0.visible && c0.home && c0.mode === "ground") counts[c0.home] = (counts[c0.home] || 0) + 1
    }
    var bestAddr = null
    for (var a in counts) if (!bestAddr || counts[a] > counts[bestAddr]) bestAddr = a
    win = windowOf(w, bestAddr)
  }
  if (!win || !win.visible) return false
  var defenders = w.critters.filter(function (c) { return !c.injured && c.mode !== "drag" })
  if (defenders.length < 1) return false
  var H = sizeFor(w)
  var fl = floorOf(w, win.addr, win.mon)
  var width = fl.x1 - fl.x0
  var dr = w.dojo && w.dojo.home === win.addr ? dojoRel(w) : -1e9
  var avgBelt = 0
  for (var d0 = 0; d0 < defenders.length; d0++) avgBelt += beltIndex(defenders[d0])
  avgBelt /= defenders.length
  var imps = opts.imps || clamp(Math.round(defenders.length * rand(0.8, 1.4)), 2, 8)
  var oni = opts.oni !== undefined ? opts.oni : ((w.dojo && w.dojo.stage >= S_GONG) || avgBelt >= 2) && chance(0.5)
  // An oni is worth a couple of imps.
  if (oni && !opts.imps) imps = Math.max(1, imps - 1)
  var raid = { id: ++w.nextId, over: false, home: win.addr, mon: win.mon, t: 0, spawned: 0,
    toSpawn: [], demons: [], parts: [], kills: {}, scale: 0.7 + avgBelt * 0.22, bbox: null, outcome: null, endAt: 0,
    portals: placePortals(w, win, imps + (oni ? 1 : 0), dr) }
  for (var k = 0; k < imps; k++) raid.toSpawn.push("imp")
  // The oni comes out last, through the middle rift, for a proper entrance.
  if (oni) raid.toSpawn.push("oni")
  w.raid = raid
  // Every ninja on that screen comes to help.
  var ev = { type: "raid", t: 0, raid: raid }
  phase(ev, "fight")
  claim(ev, defenders)
  ev.allDefenders = defenders.slice()
  w.events.push(ev)
  raid.ev = ev
  for (var j = 0; j < defenders.length; j++) {
    var dfd = defenders[j]
    interrupt(dfd)
    dfd.eventIdle = "guard"
    // Each defender takes a rift, so every rift gets its own battle.
    var post = raid.portals[j % raid.portals.length]
    var side = j % 2 ? 1 : -1
    var spot = (function (pt, sd) { return function (w2, c2) { return pt.rel + sd * c2.H * 1.4 } })(post, side)
    if (!dfd.visible || dfd.mode !== "ground") dropInto(w, dfd, post.home, spot)
    else if (post.home !== dfd.home || dfd.level) q(dfd, [travel(w, dfd, post.home, spot)])
    else q(dfd, [W(spot, { speed: 2.6 })])
    if (j === 0 || chance(0.3)) q(dfd, [S(pick(dfd.personality === "nervous" ? ["AAAA DEMONS!", "Nope nope nope."] : DEFENDER_LINES))])
    remember(w, dfd, "Demons came through a rift to attack the dojo.", true)
  }
  chronicle(w, "A rift opened and demons attacked" + (oni ? ", led by an oni" : "") + ".")
  return true
}

// Spread rifts across the raid window (clear of the dojo), plus sometimes
// one in another open window, so the fight breaks into separate scenes.
function placePortals(w, win, demons, dojoAt) {
  var H = sizeFor(w)
  var fl = floorOf(w, win.addr, win.mon)
  var width = fl.x1 - fl.x0
  var n = clamp(Math.ceil(demons / 2.5), 1, 3)
  while (n > 1 && width / (n + 1) < H * 4) n--
  var half = w.dojo && dojoAt > -1e8 ? dojoHalf(w) * 0.8 : 0
  var out = []
  for (var k = 0; k < n; k++) {
    var rel = width * (k + 1) / (n + 1)
    // Keep rifts out of the dojo itself.
    if (half && Math.abs(rel - dojoAt) < half) rel = rel < dojoAt ? dojoAt - half : dojoAt + half
    out.push({ home: win.addr, mon: win.mon, rel: clamp(rel, H * 1.2, width - H * 1.2) })
  }
  var others = []
  for (var a in w.windows) {
    var o = w.windows[a]
    if (o.addr !== win.addr && o.visible && o.w >= H * 6) others.push(o)
  }
  if (others.length && demons >= 3 && chance(0.6)) {
    var ow = pick(others)
    out.push({ home: ow.addr, mon: ow.mon, rel: ow.w * rand(0.3, 0.7) })
  }
  return out
}

function newDemon(w, raid, kind) {
  var H = sizeFor(w)
  var big = kind === "oni"
  var hp = Math.round((big ? 420 : 95) * raid.scale)
  return {
    id: "d" + (++w.nextId), kind: kind, name: big ? "Oni" : "Imp", band: big ? "#c0392b" : "#9b30ff", born: Date.now(), stats: {},
    H: Math.round(H * (big ? 1.55 : 0.72)), home: raid.home, mon: raid.mon, rel: 0, level: 0, portal: null,
    x: 0, y: 0, fx: 0, fy: 0, facing: 1, hp: hp, maxHp: hp, anim: "emerge", animT0: w.t, state: "emerge", stateT: 0,
    cd: rand(600, 1400), target: null, parts: [], bubble: null, bbox: null, hits: [], visible: true, mode: "ground",
    speed: big ? 1.0 : 1.9, xp: 0, flash: 0
  }
}

function tickRaid(w, dt) {
  var raid = w.raid
  if (!raid) return
  var win = windowOf(w, raid.home)
  raid.t += dt
  tickParts(w, raid.parts, dt, null)
  if (!win) { endRaid(w, "vanished"); return }
  var fl = floorOf(w, raid.home, raid.mon)
  var H = sizeFor(w)
  var ev = raid.ev
  var defenders = ev && !ev.over ? ev.members.filter(function (c) { return alive(w, c) && c.event === ev }) : []

  // Rifts swirl, and demons climb out of them, taking turns.
  if (!raid.over) {
    for (var pi = 0; pi < raid.portals.length; pi++) {
      var pt = raid.portals[pi]
      if (!pt.parts) pt.parts = []
      tickParts(w, pt.parts, dt, null)
      var pf = floorOf(w, pt.home, pt.mon)
      if (windowOf(w, pt.home) && Math.random() < dt / 160) addPart(pt.parts, { type: "riftspark", x: pf.x0 + pt.rel + rand(-0.5, 0.5) * H, y: pf.y - rand(0, 1.6) * H,
        vx: rand(-30, 30), vy: rand(-60, -10), life: rand(400, 800), size: H * rand(0.04, 0.08) })
    }
    if (raid.toSpawn.length && raid.t > 1200 + raid.spawned * 1100) {
      var kind = raid.toSpawn.shift()
      var dm = newDemon(w, raid, kind)
      var live = raid.portals.filter(function (q0) { return windowOf(w, q0.home) })
      var portal = kind === "oni" ? live[Math.floor((live.length - 1) / 2)] || live[0] : live[raid.spawned % live.length]
      if (portal) {
        dm.portal = portal
        dm.home = portal.home
        dm.mon = portal.mon
        dm.rel = portal.rel + rand(-0.2, 0.2) * H
        raid.demons.push(dm)
      }
      raid.spawned++
      if (chance(dm.kind === "oni" ? 1 : 0.4)) say(dm, pick(DEMON_TAUNTS[dm.kind]))
    }
  }

  for (var i = 0; i < raid.demons.length; i++) tickDemon(w, raid, raid.demons[i], defenders, floorOf(w, raid.demons[i].home, raid.demons[i].mon), dt)
  raid.demons = raid.demons.filter(function (d) { return !d.gone })

  if (raid.over) {
    for (var qi = 0; qi < raid.portals.length; qi++) if (raid.portals[qi].parts) tickParts(w, raid.portals[qi].parts, dt, null)
    if (w.t > raid.endAt && !raid.demons.length) w.raid = null
    return
  }

  // Defenders: close in, strike, fall back when spent.
  for (var j = 0; j < defenders.length; j++) defend(w, raid, defenders[j])

  var standingDefenders = defenders.filter(function (c) { return !c.injured && hpRatio(c) >= 0.2 })
  var liveDemons = raid.demons.filter(function (d) { return d.state !== "dying" })
  if (!raid.toSpawn.length && !liveDemons.length && raid.spawned > 0) endRaid(w, "won")
  else if (raid.spawned > 0 && !standingDefenders.length) endRaid(w, "lost")
  else if (raid.t > 4 * 60000) endRaid(w, "timeout")
}

// Demon brain: pick the nearest standing ninja, chase, claw or smash.
function tickDemon(w, raid, d, defenders, fl, dt) {
  d.stateT += dt
  d.cd -= dt
  if (d.flash > 0) d.flash = Math.max(0, d.flash - dt / 200)
  tickParts(w, d.parts, dt, d)
  if (d.bubble) {
    if (d.bubble.until < 0) d.bubble.until = w.t + d.bubble.ms
    if (w.t > d.bubble.until) d.bubble = null
  }
  var setA = function (name) { if (d.anim !== name) { d.anim = name; d.animT0 = w.t } }
  if (d.state === "emerge") {
    if (d.stateT > Rig.animLength("emerge")) { d.state = "fight"; d.stateT = 0 }
  } else if (d.state === "dying") {
    setA("fallen")
    if (d.stateT > 900 && !d.poofed) {
      d.poofed = true
      for (var p = 0; p < 10; p++) addPart(raid.parts, { type: "smoke", x: d.fx + rand(-0.4, 0.4) * d.H, y: d.fy - rand(0, 0.8) * d.H,
        vx: rand(-50, 50), vy: rand(-80, -20), life: rand(600, 1000), size: d.H * rand(0.15, 0.3), tint: "purple" })
      floatText({ parts: raid.parts }, "BANISHED", d.fx, d.fy - d.H, { list: raid.parts, size: 12, color: "#c9a0ff" })
    }
    if (d.stateT > 1100) d.gone = true
  } else if (d.state === "leaving") {
    setA("prowl")
    var home = d.portal ? d.portal.rel : d.rel
    var dirL = home > d.rel ? 1 : -1
    d.facing = dirL
    d.rel += dirL * d.speed * 1.5 * d.H * dt / 1000
    if (Math.abs(d.rel - home) < d.H * 0.3) {
      d.gone = true
      addPart(raid.parts, { type: "smoke", x: d.fx, y: d.fy - d.H * 0.5, vx: 0, vy: -30, life: 700, size: d.H * 0.4, tint: "purple" })
    }
  } else {
    // Busy with an attack animation?
    if (d.busyUntil && w.t < d.busyUntil) {
    } else {
      var targets = defenders.filter(function (c) { return !c.injured && c.mode === "ground" && c.home === d.home && !c.level })
      // Prefer a ninja nobody else is mauling, so fights spread out.
      var t = null, best = Infinity
      for (var i = 0; i < targets.length; i++) {
        var crowd = 0
        for (var o = 0; o < raid.demons.length; o++) if (raid.demons[o] !== d && raid.demons[o].target === targets[i]) crowd++
        var score = Math.abs(targets[i].rel - d.rel) + crowd * d.H * 4 + (d.target === targets[i] ? -d.H : 0)
        if (score < best) { best = score; t = targets[i] }
      }
      d.target = t
      if (!t) {
        setA("hunch")
        if (Math.random() < dt / 2500) say(d, pick(DEMON_TAUNTS[d.kind]))
      } else {
        var reach = (d.kind === "oni" ? 0.7 : 0.45) * d.H + t.H * 0.2
        var gap = t.rel - d.rel
        d.facing = gap > 0 ? 1 : -1
        if (Math.abs(gap) > reach) {
          setA("prowl")
          d.rel += d.facing * d.speed * d.H * dt / 1000
        } else if (d.cd <= 0) {
          var move = d.kind === "oni" ? "smash" : "claw"
          d.anim = move
          d.animT0 = w.t
          var len = Rig.animLength(move)
          d.busyUntil = w.t + len
          d.cd = (d.kind === "oni" ? rand(1600, 2400) : rand(900, 1600)) + len
          var strikeAt = d.kind === "oni" ? 560 : 300
          var victim = t
          later(d, strikeAt, function (w2, d2) {
            if (d2.state !== "fight" || !alive(w2, victim) || victim.injured) return
            if (Math.abs(victim.rel - d2.rel) > reach * 1.3) { floatText(d2, "miss", d2.fx + d2.facing * d2.H * 0.4, d2.fy - d2.H * 0.6, { size: 9 }); return }
            var dmg = (d2.kind === "oni" ? rand(7, 12) : rand(4, 7)) * (0.85 + raid.scale * 0.15)
            if (d2.kind === "oni") {
              dust(d2, victim.fx, victim.fy, 8)
              floatText(d2, "THOOM", victim.fx, victim.fy - victim.H * 0.9, { size: 13, color: "#ff6b6b" })
            } else {
              floatText(d2, pick(["SCRITCH", "SWIPE", "CHOMP"]), victim.fx, victim.fy - victim.H * 0.9, { size: 10, color: "#d58bff" })
            }
            stars(victim, victim.fx, victim.fy - victim.H * 0.7, 2)
            if (!victim.cur || victim.cur.name !== "hit") q2front(victim, [A("hit")])
            damage(w2, victim, dmg, "mauled by " + (d2.kind === "oni" ? "an oni" : "an imp") + " during a demon raid")
          })
        } else {
          setA("hunch")
        }
      }
    }
  }
  // Position on the floor.
  var r0 = d.H * 0.4, r1 = fl.x1 - fl.x0 - d.H * 0.4
  d.rel = clamp(d.rel, r0, r1)
  d.x = fl.x0 + d.rel
  d.y = fl.y
  d.fx = d.x
  d.fy = d.y
  demonBounds(w, d)
}

function demonBounds(w, d) {
  var H = d.H
  var x0 = d.fx - H * 1.2, x1 = d.fx + H * 1.2, y0 = d.fy - H * 1.9, y1 = d.fy + H * 0.25
  if (d.bubble && d.bubble.x !== undefined) {
    x0 = Math.min(x0, d.bubble.x - 4); x1 = Math.max(x1, d.bubble.x + d.bubble.w + 4)
    y0 = Math.min(y0, d.bubble.y - 4)
  }
  for (var i = 0; i < d.parts.length; i++) {
    var p = d.parts[i]
    if (p.type === "delay") continue
    var r = (p.size || 10) + (p.type === "text" ? 40 : 4)
    x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r)
    y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r)
  }
  d.bbox = quantize(x0, y0, x1, y1)
  d.hits = d.state === "fight" || d.state === "emerge" ? [{ x: d.fx - H * 0.4, y: d.fy - H * 1.1, w: H * 0.8, h: H * 1.1, part: "demon" }] : []
}

// Loose effects (banishments, smites) that aren't tied to a rift.
function raidBounds(w) {
  var raid = w.raid
  if (!raid || !raid.parts.length) return null
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (var i = 0; i < raid.parts.length; i++) {
    var p = raid.parts[i]
    var r = (p.size || 10) + (p.type === "text" ? 50 : 6)
    x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r)
    y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r)
  }
  return quantize(x0, y0, x1, y1)
}

function portalBounds(w, i) {
  var raid = w.raid
  var pt = raid && raid.portals[i]
  if (!pt || !windowOf(w, pt.home) || !windowOf(w, pt.home).visible) return null
  var fl = floorOf(w, pt.home, pt.mon)
  var H = sizeFor(w)
  var px = fl.x0 + pt.rel
  var x0 = px - H * 1.2, x1 = px + H * 1.2, y0 = fl.y - H * 2.4, y1 = fl.y + 4
  var parts = pt.parts || []
  for (var k = 0; k < parts.length; k++) {
    x0 = Math.min(x0, parts[k].x - 8); x1 = Math.max(x1, parts[k].x + 8)
    y0 = Math.min(y0, parts[k].y - 8)
  }
  return quantize(x0, y0, x1, y1)
}

// One defender's turn: go to the nearest demon, hit it, or step back
// when worn out.
function defend(w, raid, c) {
  if (!isIdle(c) || c.injured) return
  if (hpRatio(c) < 0.2 && !hasTrait(c, "reckless")) {
    if (c.eventIdle !== "seiza") {
      c.eventIdle = "seiza"
      var near = null
      for (var pp = 0; pp < raid.portals.length; pp++) if (raid.portals[pp].home === c.home && (!near || Math.abs(raid.portals[pp].rel - c.rel) < Math.abs(near.rel - c.rel))) near = raid.portals[pp]
      var away = !near || near.rel < c.rel ? 1 : -1
      q(c, [W(function (w2, c2) { return c2.rel + away * c2.H * 2.5 }, { speed: 2 }), S(pick(["I'm spent...", "Can't... go on.", "Someone take over!"]))])
    }
    return
  }
  var foes = raid.demons.filter(function (d) { return (d.state === "fight" || d.state === "emerge") && d.home === c.home })
  if (!foes.length) {
    // The fight is in another window: go there.
    var elsewhere = raid.demons.filter(function (d) { return (d.state === "fight" || d.state === "emerge") && windowOf(w, d.home) && windowOf(w, d.home).visible })
    if (elsewhere.length && w.t > (c.raidTravelAt || 0)) {
      c.raidTravelAt = w.t + 6000
      var dest = pick(elsewhere)
      q(c, [S(pick(["Over there!", "I've got this one!", "Another rift!"]), 1400), travel(w, c, dest.home, function () { return dest.rel + rand(-2, 2) * c.H })])
      return
    }
    c.eventIdle = "guard"
    return
  }
  // Prefer a demon nobody else is fighting, so each gets a proper duel.
  var t = null, best = Infinity
  for (var i = 0; i < foes.length; i++) {
    var crowd = 0
    for (var j = 0; j < w.critters.length; j++) if (w.critters[j] !== c && w.critters[j].raidTarget === foes[i]) crowd++
    // Spread out over imps, but gang up on an oni.
    var score = Math.abs(foes[i].rel - c.rel) + crowd * c.H * (foes[i].kind === "oni" ? -1 : 4) + (c.raidTarget === foes[i] ? -c.H : 0)
    if (score < best) { best = score; t = foes[i] }
  }
  c.raidTarget = t
  var gap = t.rel - c.rel
  var dir = gap > 0 ? 1 : -1
  var reach = c.H * 0.5 + t.H * 0.3
  var lvl = jutsuLevel(c)
  // Jutsu from range for those who know it.
  if (elementKnown(c) && Math.abs(gap) > reach && Math.abs(gap) < c.H * 5 && chance(0.35)) {
    q(c, [face(dir), A("seals", 450), A(castAnim(c) === "swirl" ? "cast" : castAnim(c), 650, { start: function (w2, c2) {
      later(c2, 150, function (w3, c3) {
        if (t.state !== "fight" && t.state !== "emerge") return
        castProjectile(w3, c3, t.fx, t.fy - t.H * 0.55, { onHit: function (w4, c4) { hurtDemon(w4, raid, t, c4, (12 + lvl * 6) * 0.6) } })
      })
    } })])
    return
  }
  if (Math.abs(gap) > reach) {
    q(c, [W(function () { return t.rel - dir * reach * 0.85 }, { speed: 2.6 }), face(dir)])
    return
  }
  var move = pick(lvl >= 1 ? ["punch", "punch2", "kick", "uppercut", "spinKick", "palm", "flyingKick"] : ["punch", "punch2", "kick"])
  q(c, [face(dir), A(move, undefined, { start: function (w2, c2) {
    later(c2, 180, function (w3, c3) {
      if (Math.abs(t.rel - c3.rel) > reach * 1.4 || (t.state !== "fight" && t.state !== "emerge")) return
      var dmg = (6 + 3.5 * beltIndex(c3) + rand(0, 6)) * 0.55 * condition(c3) * (move === "flyingKick" || move === "spinKick" || move === "uppercut" ? 1.3 : 1)
      hurtDemon(w3, raid, t, c3, dmg)
      stars(c3, t.fx, t.fy - t.H * 0.6, 2)
      floatText(c3, pick(["POW", "WHAM", "KRAK", "HYAH"]), t.fx, t.fy - t.H * 0.9, { size: 10, color: "#ffd84a" })
    })
  } }), A("guard", rand(150, 450))])
}

function hurtDemon(w, raid, d, by, dmg) {
  if (d.state !== "fight" && d.state !== "emerge") return
  d.hp -= dmg
  d.flash = 1
  if (by) gainXp(by, 1)
  if (d.hp > 0) {
    if (chance(0.15)) say(d, d.kind === "oni" ? pick(["GRRR!", "YOU DARE?!", "THAT TICKLED."]) : pick(["Ow!", "Hey!", "Rude!", "Eek!"]))
    return
  }
  d.state = "dying"
  d.stateT = 0
  d.bubble = null
  if (by) {
    raid.kills[by.id] = (raid.kills[by.id] || 0) + 1
    say(by, d.kind === "oni" ? pick(["The oni falls!", "Back to the underworld!", "And stay there!"]) : pick(["Begone!", "One down!", "Shoo!", "Banished!"]))
  }
}

// The giant helps: click a demon to strike it with lightning.
function smite(w, id) {
  var raid = w.raid
  var d = demonOf(w, id)
  if (!raid || !d) return
  var top = d.fy - d.H * 3
  for (var i = 0; i < 6; i++) addPart(raid.parts, { type: "bolt", x: d.fx, y: d.fy - d.H * 0.6, life: 260, size: d.H * 2.4, seed: Math.random() })
  addPart(raid.parts, { type: "flash", x: d.fx, y: d.fy - d.H * 0.5, life: 240, size: d.H * 1.4 })
  floatText({ parts: raid.parts }, "SMITE!", d.fx, top + d.H, { list: raid.parts, size: 13, color: "#fff6a0" })
  hurtDemon(w, raid, d, null, 22)
}

function endRaid(w, outcome) {
  var raid = w.raid
  if (!raid || raid.over) return
  raid.over = true
  raid.outcome = outcome
  raid.endAt = w.t + 2500
  var ev = raid.ev
  var defenders = ev ? ev.participants || ev.members : []
  // Everyone who stepped up, injured or not.
  var all = (raid.ev ? raid.ev.allDefenders : null) || defenders
  if (outcome === "won") {
    chronicle(w, "The ninjas drove the demons back into the rift.")
    for (var i = 0; i < all.length; i++) {
      var c = all[i]
      if (!alive(w, c)) continue
      var k = raid.kills[c.id] || 0
      gainXp(c, 20 + k * 8)
      remember(w, c, "We beat back a demon raid" + (k ? " and I banished " + k + " demon" + (k > 1 ? "s" : "") : "") + ".", true)
      if (!c.injured && c.event === ev) {
        interrupt(c)
        q(c, [A("celebrate", 1800, { start: function (w2, c2) { if (chance(0.5)) say(c2, pick(["Victory!", "And stay out!", "The dojo stands!", "Who's next?!"])) } })])
      }
    }
  } else {
    // The demons get their way with the dojo.
    var wreck = ""
    if (w.dojo && w.dojo.home === raid.home && outcome === "lost") {
      var d = w.dojo
      var lost = Math.ceil(STAGES[Math.min(d.stage, STAGES.length - 1)].work * 0.5)
      if (d.done) { d.done = false; d.stage = STAGES.length - 1; d.progress = Math.max(0, STAGES[d.stage].work - lost) }
      else if (d.progress >= lost) d.progress -= lost
      else if (d.stage > 0) { d.stage--; d.progress = Math.max(0, STAGES[d.stage].work - (lost - d.progress)) }
      else d.progress = 0
      wreck = STAGES[d.stage].name.toLowerCase()
      var b = dojoBase(w)
      if (b) for (var j = 0; j < 14; j++) addPart(w.dojoParts, { type: "plank", x: b.x + rand(-3, 3) * sizeFor(w), y: b.y - rand(0.5, 3) * sizeFor(w),
        vx: rand(-200, 200), vy: rand(-300, -80), g: 1800, vr: rand(-10, 10), life: 2200, size: sizeFor(w) * rand(0.3, 0.6), floor: b.y - 2 })
    }
    chronicle(w, outcome === "lost" ? "The demons beat every defender" + (wreck ? " and wrecked part of the dojo's " + wreck : "") + "." : "The demons slipped back into the rift.")
    for (var m = 0; m < all.length; m++) if (alive(w, all[m])) remember(w, all[m], outcome === "lost" ? "The demons beat us" + (wreck ? " and smashed part of the dojo's " + wreck : "") + "." : "The demons retreated before we could finish them.", true)
    for (var n = 0; n < raid.demons.length; n++) {
      var dm = raid.demons[n]
      if (dm.state === "dying") continue
      dm.state = "leaving"
      if (n === 0) say(dm, dm.kind === "oni" ? "HAHAHA. WE WILL RETURN." : pick(["Hehehe! Bye bye!", "Thanks for the planks!", "See you next time!"]))
    }
  }
  if (ev && !ev.over) endEvent(w, ev)
  w.nextRaid = w.activeMs + rand(40, 90) * 60000
}

// ---------------------------------------------------------------- going home

// Everyone files into the dojo, the dojo folds into the ground, and the
// world pauses. Calling them back reverses it. Nothing is forgotten.
var PACK_MS = 1800

function sendHome(w) {
  if (w.homeState) return false
  if (raidActive(w)) endRaid(w, "vanished")
  for (var e = w.events.length - 1; e >= 0; e--) {
    var ev0 = w.events[e]
    if (ev0.type === "tournament") endTournament(w, ev0)
    else endEvent(w, ev0)
  }
  var H = sizeFor(w)
  // Make sure the dojo is somewhere you can see it walk in.
  if (w.dojo && !dojoVisible(w)) {
    var target = windowOf(w, w.lastActiveAddr || w.activeAddr)
    if (target && target.visible) { w.dojo.home = target.addr; w.dojo.frac = sideFrac(w, target) }
  }
  if (!w.dojo || !dojoVisible(w)) {
    // No dojo to go into: they just vanish in smoke.
    for (var i = 0; i < w.critters.length; i++) {
      var c0 = w.critters[i]
      if (c0.visible) puff(c0, c0.fx, c0.fy - c0.H * 0.5, 8)
      interrupt(c0)
      c0.inside = true
    }
    w.homeState = "packed"
    w.justPacked = true
    return true
  }
  var win = dojoWindow(w)
  var ev = { type: "home", t: 0 }
  phase(ev, "gather")
  claim(ev, w.critters.slice())
  w.events.push(ev)
  w.homeEv = ev
  w.homeState = "gathering"
  w.homeT = 0
  for (var k = 0; k < w.critters.length; k++) {
    var c = w.critters[k]
    interrupt(c)
    c.eventIdle = "stand"
    var door = (function (j) { return function (w2) { return dojoRel(w2) + (j % 2 ? 1 : -1) * H * 0.3 * Math.floor(j / 2) * 0.3 } })(k)
    if (c.injured) {
      // The hurt get carried in, so to speak.
      if (c.visible) puff(c, c.fx, c.fy - c.H * 0.4, 6)
      c.inside = true
      continue
    }
    if (c.visible && c.mode === "ground" && c.home === win.addr && !c.level) q(c, [W(door, { speed: 3.6 }), F(enterDojo)])
    else {
      dropInto(w, c, win.addr, function (w2, c2) { return dojoRel(w2) + rand(-3, 3) * c2.H })
      q(c, [W(door, { speed: 3.6 }), F(enterDojo)])
    }
    if (chance(0.3)) c.arrivalLine = null
  }
  chronicle(w, "Everyone went home into the dojo.")
  for (var m = 0; m < w.critters.length; m++) remember(w, w.critters[m], "The giant called us all home into the dojo for a rest.")
  return true
}

// Changed your mind halfway: everyone comes back out.
function cancelHome(w) {
  if (w.homeState === "packing") {
    w.homeState = "unpacking"
    w.homeT = (1 - (w.dojo.pack || 0)) * PACK_MS
    return true
  }
  if (w.homeState === "gathering") {
    for (var i = 0; i < w.critters.length; i++) if (!w.critters[i].inside) {
      var c = w.critters[i]
      interrupt(c)
      if (c.event === w.homeEv) c.event = null
      c.eventIdle = null
    }
    w.homeState = "emerging"
    w.homeT = 0
    w.nextOut = 0
    return true
  }
  return false
}

function enterDojo(w, c) {
  puff(c, c.fx, c.fy - c.H * 0.5, 4)
  if (chance(0.3)) floatText(c, pick(["*slide*", "*creak*", "zzz", "home!"]), c.fx, c.fy - c.H * 1.1, { size: 9 })
  c.inside = true
}

function callBack(w) {
  if (w.homeState !== "packed") return false
  var H = sizeFor(w)
  // Raise the dojo where you can see it.
  var target = windowOf(w, w.lastActiveAddr || w.activeAddr)
  if (!target || !target.visible) {
    for (var a in w.windows) if (w.windows[a].visible && (!target || w.windows[a].w > target.w)) target = w.windows[a]
  }
  if (!target) return false
  if (!w.dojo) {
    // No dojo yet: they simply drop back in.
    for (var i = 0; i < w.critters.length; i++) {
      w.critters[i].inside = false
      dropInto(w, w.critters[i], target.addr, rand(0.2, 0.8) * target.w)
    }
    w.homeState = null
    return true
  }
  if (!dojoVisible(w)) { w.dojo.home = target.addr; w.dojo.frac = sideFrac(w, target) }
  var ev = { type: "home", t: 0 }
  phase(ev, "rise")
  claim(ev, w.critters.slice())
  w.events.push(ev)
  w.homeEv = ev
  w.dojo.pack = 1
  w.homeState = "unpacking"
  w.homeT = 0
  var win = dojoWindow(w)
  var fl = floorOf(w, win.addr, win.mon)
  for (var k = 0; k < w.critters.length; k++) {
    var c = w.critters[k]
    interrupt(c)
    c.inside = true
    c.home = win.addr
    c.mon = win.mon
    c.mode = "ground"
    c.level = 0
    c.rel = dojoRel(w)
    c.x = fl.x0 + c.rel
    c.y = fl.y
    c.eventIdle = "stand"
  }
  var b = dojoBase(w)
  if (b) for (var j = 0; j < 14; j++) addPart(w.dojoParts, { type: "dust", x: b.x + rand(-3.5, 3.5) * H, y: b.y - 2, vx: rand(-80, 80), vy: rand(-60, -10), life: rand(500, 1000), size: H * rand(0.1, 0.25) })
  return true
}

function tickHome(w, dt) {
  if (!w.homeState || w.homeState === "packed") return
  w.homeT += dt
  var H = sizeFor(w)
  var d = w.dojo
  if (w.homeState === "gathering") {
    var all = w.critters.every(function (c) { return c.inside })
    if (all || w.homeT > 25000) {
      for (var i = 0; i < w.critters.length; i++) {
        var c = w.critters[i]
        if (!c.inside) { if (c.visible) puff(c, c.fx, c.fy - c.H * 0.5, 6); c.inside = true }
      }
      w.homeState = "packing"
      w.homeT = 0
    }
  } else if (w.homeState === "packing") {
    d.pack = clamp(w.homeT / PACK_MS, 0, 1)
    var b = dojoBase(w)
    if (b && Math.random() < dt / 40) addPart(w.dojoParts, { type: "smoke", x: b.x + rand(-3.5, 3.5) * H, y: b.y - rand(0, 1) * H,
      vx: rand(-40, 40), vy: rand(-70, -20), life: rand(600, 1100), size: H * rand(0.3, 0.6) })
    if (d.pack >= 1) {
      w.homeState = "packed"
      if (w.homeEv) { endEvent(w, w.homeEv); w.homeEv = null }
      w.justPacked = true
    }
  } else if (w.homeState === "unpacking") {
    d.pack = clamp(1 - w.homeT / PACK_MS, 0, 1)
    if (d.pack <= 0) { w.homeState = "emerging"; w.homeT = 0; w.nextOut = 0 }
  } else if (w.homeState === "emerging") {
    var waiting = w.critters.filter(function (c) { return c.inside })
    if (!waiting.length) {
      w.homeState = null
      if (w.homeEv) { endEvent(w, w.homeEv); w.homeEv = null }
      chronicle(w, "Everyone came back out of the dojo.")
      return
    }
    if (w.homeT >= w.nextOut) {
      w.nextOut = w.homeT + 550
      var o = waiting[0]
      o.inside = false
      puff(o, o.fx, o.fy - o.H * 0.5, 5)
      var r = walkRange(w, o)
      if (o.event === w.homeEv) o.event = null
      o.eventIdle = null
      q(o, [W(rand(r[0], r[1]), { speed: 2 }), chance(0.5) ? S(pick(["Fresh air!", "Back to training!", "Did I miss anything?", "Good nap.", "*stretches*", "We're back!"])) : null])
    }
  }
}

// ---------------------------------------------------------------- ninjutsu

// Element advantage, as in the stories: water quenches fire, fire burns
// wind, wind erodes earth, earth dams water.
var ELEMENTS = {
  fire: { label: "Fire", color: "#ff7a1a", beats: "wind", sound: ["FWOOSH", "KA-BOOM", "SIZZLE"] },
  water: { label: "Water", color: "#3aa0ff", beats: "fire", sound: ["SPLASH", "SPLOOSH", "GLUG"] },
  wind: { label: "Wind", color: "#9ff0d4", beats: "earth", sound: ["WHOOSH", "SHHHK", "VWOOM"] },
  earth: { label: "Earth", color: "#a0703c", beats: "water", sound: ["CRACK", "THOOM", "RUMBLE"] }
}
var AFFINITY = {
  hothead: ["fire", "fire", "wind"], stoic: ["earth", "earth", "water"], philosopher: ["wind", "wind", "water"],
  poet: ["water", "water", "wind"], showoff: ["fire", "wind"], sleepy: ["water", "earth"],
  foodie: ["fire", "earth"], nervous: ["wind", "water"], goofball: ["fire", "water", "wind", "earth"]
}

function bornElement(personality) {
  return pick(AFFINITY[personality] || ["fire", "water", "wind", "earth"])
}

// 0 white (nothing), 1 yellow (seals that fizzle), 2 orange (element
// awakened, substitution), 3 green (projectiles, one clone) ... 6 black.
function jutsuLevel(c) { return beltIndex(c) }
function elementKnown(c) { return jutsuLevel(c) >= 2 }

function advantage(a, b) {
  if (!elementKnown(a) || !elementKnown(b)) return 1
  if (ELEMENTS[a.element].beats === b.element) return 1.1
  if (ELEMENTS[b.element].beats === a.element) return 1 / 1.1
  return 1
}

function mouth(c) { return { x: c.fx + c.facing * c.H * 0.3, y: c.fy - c.H * 0.86 } }
function hands(c) { return { x: c.fx + c.facing * c.H * 0.45, y: c.fy - c.H * 0.7 } }

function jutsuScale(c) { return 0.6 + 0.13 * Math.max(0, Math.min(jutsuLevel(c), 9) - 2) }

// Burst of element particles at (x, y), e.g. where a jutsu lands.
function elementBurst(list, el, x, y, H, scale, floor) {
  var n = Math.round(12 * scale)
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2, v = rand(80, 260) * scale
    if (el === "fire") addPart(list, { type: "flame", x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: -60, life: rand(350, 700), size: H * rand(0.12, 0.22) * scale })
    else if (el === "water") addPart(list, { type: "drop", x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 1400, life: rand(500, 900), size: H * rand(0.04, 0.08) * scale, floor: floor })
    else if (el === "wind") addPart(list, { type: "streak", x: x, y: y, vx: Math.cos(a) * v * 1.6, vy: Math.sin(a) * v * 0.6, life: rand(250, 500), size: H * rand(0.25, 0.45) * scale, rot: a })
    else addPart(list, { type: "rock", x: x, y: y, vx: Math.cos(a) * v * 0.8, vy: -rand(150, 380) * scale, g: 1800, vr: rand(-10, 10), life: rand(900, 1500), size: H * rand(0.08, 0.16) * scale, floor: floor })
  }
  floatText({ parts: list }, pick(ELEMENTS[el].sound), x, y - H * 0.4, { list: list, size: Math.round(11 + 3 * scale), vy: -26, color: ELEMENTS[el].color, life: 1000 })
}

// Throw a jutsu projectile from c towards (tx, ty); `onHit` runs on arrival.
function castProjectile(w, c, tx, ty, opts) {
  opts = opts || {}
  var el = c.element
  var s = opts.scale || jutsuScale(c)
  var from = el === "fire" ? mouth(c) : hands(c)
  var dist = Math.abs(tx - from.x) + Math.abs(ty - from.y)
  var speed = { fire: 520, water: 460, wind: 900, earth: 420 }[el]
  var floor = c.fy - 1
  addPart(c.parts, { type: "jutsu", el: el, sx: from.x, sy: from.y, x: from.x, y: from.y, tx: tx, ty: ty,
    apex: el === "earth" ? c.H * 1.3 : (el === "water" ? c.H * 0.2 : 0), life: clamp(dist / speed * 1000, 200, 1400),
    size: c.H * 0.22 * s, vr: el === "wind" ? 18 : 4, trail: true, dir: tx > from.x ? 1 : -1,
    onDone: function (w2, c2) {
      if (!opts.silent) elementBurst(c2.parts, el, tx, ty, c2.H, s, floor)
      if (opts.onHit) opts.onHit(w2, c2)
    } })
}

// A breath or stream from the mouth (fire breath, water jet, wind gust).
function streamJutsu(c, dur) {
  var el = c.element
  var s = jutsuScale(c)
  return function (w2, c2) {
    var m = mouth(c2)
    var dir = c2.facing
    if (el === "fire") addPart(c2.parts, { type: "flame", x: m.x, y: m.y, vx: dir * rand(260, 420) * s, vy: rand(-40, 30), g: -80, life: rand(400, 650) * s, size: c2.H * rand(0.08, 0.14) * s, grow: 2.2 })
    else if (el === "water") addPart(c2.parts, { type: "drop", x: m.x, y: m.y, vx: dir * rand(300, 450) * s, vy: rand(-80, 0), g: 700, life: 700, size: c2.H * 0.07 * s, floor: c2.fy - 1 })
    else if (el === "wind") addPart(c2.parts, { type: "streak", x: m.x, y: m.y + rand(-8, 8), vx: dir * rand(500, 800) * s, vy: 0, life: 380, size: c2.H * 0.4 * s, rot: dir > 0 ? 0 : Math.PI })
    else addPart(c2.parts, { type: "rock", x: c2.fx + dir * c2.H * rand(0.5, 1.4) * s, y: c2.fy - 2, vx: dir * 30, vy: -rand(200, 380), g: 1800, vr: rand(-8, 8), life: 1000, size: c2.H * rand(0.06, 0.12) * s, floor: c2.fy - 1 })
  }
}

// An earth wall that rises, holds, then crumbles.
function earthWall(c, x, hold) {
  addPart(c.parts, { type: "wall", x: x, y: c.fy, life: hold, size: c.H * 1.1 * jutsuScale(c), floor: c.fy, vx: 0, vy: 0,
    onDone: function (w2, c2, p) {
      for (var i = 0; i < 7; i++) addPart(c2.parts, { type: "rock", x: p.x + rand(-p.size * 0.25, p.size * 0.25), y: p.y - rand(0, p.size),
        vx: rand(-90, 90), vy: -rand(50, 200), g: 1800, vr: rand(-8, 8), life: 1200, size: c2.H * rand(0.07, 0.14), floor: c2.fy - 1 })
    } })
}

// Element-specific anim and timing for casting.
function castAnim(c) { return c.element === "fire" ? "breathe" : (c.element === "earth" ? "stomp" : (c.element === "wind" ? "swirl" : "cast")) }

// Solo jutsu practice, by level.
function practiceJutsu(w, c) {
  var lvl = jutsuLevel(c)
  var H = c.H
  if (lvl <= 1) {
    q(c, [A("seals", rand(900, 1500)), A("fizzle", undefined, { start: function (w2, c2) {
      later(c2, 420, function (w3, c3) { addPart(c3.parts, { type: "smoke", x: hands(c3).x, y: hands(c3).y, vx: 0, vy: -20, life: 600, size: c3.H * 0.12 }); floatText(c3, "fwip", hands(c3).x, hands(c3).y - 8, { size: 9 }) })
    } }), chance(0.4) ? S(pick(["Almost!", "One day...", "That was... a jutsu. Technically.", "Hm. Needs work."])) : null, XP(2)])
    return
  }
  var r = walkRange(w, c)
  var room = c.facing > 0 ? r[1] - c.rel : c.rel - r[0]
  if (room < H * 3) c.facing = -c.facing
  var tx = c.fx + c.facing * H * rand(2.5, 4.5)
  var steps = [A("seals", 600 + lvl * 120)]
  var el = c.element
  var style = weighted([[3, "stream"], [lvl >= 3 ? 4 : 0, "projectile"], [el === "earth" ? 3 : 0, "wall"]])
  if (style === "stream") {
    steps.push(A(castAnim(c), el === "fire" ? undefined : 1300, { every: 45, emit: streamJutsu(c), start: function (w2, c2) {
      floatText(c2, ELEMENTS[el].label.toUpperCase() + " STYLE!", c2.fx, c2.fy - c2.H * 1.5, { size: 11, color: ELEMENTS[el].color })
    } }))
  } else if (style === "projectile") {
    steps.push(A(castAnim(c), el === "fire" ? undefined : 900, { start: function (w2, c2) {
      later(c2, 250, function (w3, c3) { castProjectile(w3, c3, c3.fx + c3.facing * c3.H * 4, c3.fy - c3.H * 0.6) })
    } }))
  } else {
    steps.push(A("stomp", undefined, { start: function (w2, c2) { later(c2, 400, function (w3, c3) { earthWall(c3, c3.fx + c3.facing * c3.H * 0.9, 2500) }) } }))
  }
  steps.push(A("guard", 700), XP(4 + lvl))
  q(c, steps)
}

// Shadow clones that copy the original's every move, then vanish.
function shadowClones(w, c) {
  var n = Math.min(3, Math.max(1, jutsuLevel(c) - 2))
  var steps = [A("seals", 700), F(function (w2, c2) {
    c2.clones = []
    for (var i = 0; i < n; i++) {
      var dx = (i % 2 ? 1 : -1) * c2.H * 0.75 * (Math.floor(i / 2) + 1)
      c2.clones.push({ dx: dx })
      puff(c2, c2.fx + dx, c2.fy - c2.H * 0.5, 4)
    }
    floatText(c2, "SHADOW CLONE JUTSU!", c2.fx, c2.fy - c2.H * 1.6, { size: 11, color: "#c9b6ff", life: 1600 })
  })]
  for (var k = 0; k < irand(3, 5); k++) steps.push(A(pick(["punch", "kick", "uppercut", "spinKick", "palm"])))
  steps.push(A("guard", 500), F(function (w2, c2) {
    for (var j = 0; j < (c2.clones || []).length; j++) puff(c2, c2.fx + c2.clones[j].dx, c2.fy - c2.H * 0.5, 5)
    c2.clones = null
  }), XP(6))
  q(c, steps)
}

// What each rank adds to the outfit.
var GARMENTS = { 2: "arm & shin wraps", 4: "shoulder guard", 5: "scarf", 6: "armoured sleeves", 7: "haori coat",
  8: "golden gi (no more belt)", 9: "divine robe & halo" }

// Belt promotions get a moment of their own.
function promote(w, c) {
  var b = BELTS[c.pendingBelt]
  c.pendingBelt = null
  var steps = [A("celebrate", 1800, { start: function (w2, c2) {
    floatText(c2, b.name.toUpperCase() + (b.noBelt ? "!" : " BELT!"), c2.fx, c2.fy - c2.H * 1.6, { size: 13, color: b.color === "#121212" ? "#f2c14e" : b.color, life: 2400, vy: -12 })
    var garment = GARMENTS[BELTS.indexOf(b)]
    if (garment) floatText(c2, "NEW GARMENT: " + garment, c2.fx, c2.fy - c2.H * 2.05, { size: 10, color: "#c9b6ff", life: 2600, vy: -10 })
    sparkle(c2.parts, c2.fx, c2.fy - c2.H * 0.8, 10, c2.H, b.color === "#f2f2f2" ? "#ffffff" : b.color)
  } })]
  var idx = BELTS.indexOf(b)
  if (idx === 2) {
    var el = ELEMENTS[c.element]
    steps.push(A("summon", 1800, { every: 70, emit: streamJutsu(c), start: function (w2, c2) {
      say(c2, "My element... is " + el.label.toLowerCase() + "!", 2200)
    } }))
    remember(w, c, "I reached orange belt and awakened my element: " + el.label.toLowerCase() + ".", true)
    chronicle(w, c.name + " awakened the " + el.label.toLowerCase() + " element.")
  } else {
    remember(w, c, b.noBelt ? "I ascended to the " + b.name.toLowerCase() + " rank." : "I earned my " + b.name.toLowerCase() + " belt.", true)
    chronicle(w, b.noBelt ? c.name + " ascended to the " + b.name.toLowerCase() + " rank!" : c.name + " earned a " + b.name.toLowerCase() + " belt.")
    if (idx === 3) steps.push(S("Now I can make shadow clones!"))
    if (idx === 7) steps.push(S("Black belt. The ultimate arts are mine."))
    if (idx === 8) steps.push(S("The belt is gone. Only gold remains."))
    if (idx === 9) steps.push(A("summon", 2500, { every: 120, emit: function (w2, c2) { sparkle(c2.parts, c2.fx, c2.fy - c2.H * 0.8, 2, c2.H, "#fff4cf") } }), S("...I see everything now."))
  }
  q2front(c, steps)
}

// One jutsu exchange in a duel. Pushes synced steps for attacker/defender.
function jutsuExchange(w, att, def, atkSteps, defSteps, finisher) {
  var el = att.element
  var seal = 500 + jutsuLevel(att) * 60
  var big = finisher && jutsuLevel(att) >= B_BLACK
  var s = jutsuScale(att) * (big ? 1.6 : 1)
  var resp = finisher ? "hit" : weighted([
    [elementKnown(def) ? 4 : 0, "clash"], [3, "hit"], [jutsuLevel(def) >= 2 ? 2 : 0, "substitute"],
    [def.element === "earth" && elementKnown(def) ? 2 : 0, "wall"], [2, "dodge"]])
  var castDur = Rig.animLength(castAnim(att) === "swirl" ? "cast" : castAnim(att))
  // Hop apart so the jutsu has room to fly.
  var hop = Rig.animLength("hop")
  var spread = function (who, other) {
    return function (w2, c2) { return (c2.rel + other.rel) / 2 + (c2.rel < other.rel ? -1 : 1) * c2.H * 1.8 }
  }
  atkSteps.push(SL(spread(att, def), hop, "hop"), face(function (w2, c2) { return def.rel > c2.rel ? 1 : -1 }))
  defSteps.push(SL(spread(def, att), hop, "hop"), face(function (w2, c2) { return att.rel > c2.rel ? 1 : -1 }))
  var name = big ? { fire: "GREAT FIREBALL", water: "WATER DRAGON", wind: "TORNADO", earth: "BOULDER RAIN" }[el] : ELEMENTS[el].label.toUpperCase() + " STYLE"
  atkSteps.push(A("seals", seal))
  defSteps.push(A(resp === "clash" ? "seals" : "guard", seal))
  var impactAt = function (w2, a) { return { x: def.fx, y: def.fy - def.H * 0.6 } }
  atkSteps.push(A(castAnim(att) === "swirl" ? "cast" : castAnim(att), castDur, { start: function (w2, a) {
    floatText(a, name + "!", a.fx, a.fy - a.H * 1.55, { size: big ? 14 : 11, color: ELEMENTS[el].color, life: 1500 })
    later(a, 180, function (w3, a3) {
      var t = impactAt(w3, a3)
      if (resp === "clash") {
        var mid = (a3.fx + def.fx) / 2
        castProjectile(w3, a3, mid, t.y, { scale: s, silent: true, onHit: function (w4, a4) {
          elementBurst(a4.parts, el, mid, t.y, a4.H, s * 1.3, a4.fy - 1)
          if (elementKnown(def)) elementBurst(a4.parts, def.element, mid, t.y, a4.H, s, a4.fy - 1)
          floatText(a4, "KABOOM", mid, t.y - a4.H * 0.7, { size: 16, color: "#ffffff", vy: -18 })
        } })
        if (elementKnown(def)) castProjectile(w3, def, mid, t.y, { silent: true })
      } else if (big && el === "earth") {
        for (var i = 0; i < 5; i++) {
          (function (k) {
            later(a3, k * 140, function (w4, a4) {
              addPart(a4.parts, { type: "jutsu", el: "earth", sx: def.fx + rand(-0.6, 0.6) * a4.H, sy: def.fy - a4.H * 3.2, x: def.fx, y: def.fy - a4.H * 3, tx: def.fx + rand(-0.4, 0.4) * a4.H, ty: def.fy - a4.H * 0.3,
                apex: 0, life: 420, size: a4.H * 0.3, vr: 6, trail: true, onDone: function (w5, a5, p) { elementBurst(a5.parts, "earth", p.tx, p.ty, a5.H, 0.9, a5.fy - 1) } })
            })
          })(i)
        }
      } else if (big && el === "wind") {
        addPart(a3.parts, { type: "tornado", x: def.fx, y: def.fy, life: 1600, size: a3.H * 1.6 })
        floatText(a3, "WHOOOOSH", def.fx, def.fy - a3.H * 1.8, { size: 14, color: ELEMENTS.wind.color })
      } else {
        castProjectile(w3, a3, t.x, t.y, { scale: s })
      }
    })
  } }))
  if (resp === "clash") {
    defSteps.push(A(castAnim(def) === "swirl" ? "cast" : castAnim(def), castDur))
  } else if (resp === "wall") {
    defSteps.push(A("stomp", castDur, { start: function (w2, d) { later(d, 120, function (w3, d3) { earthWall(d3, d3.fx + d3.facing * d3.H * 0.55, 1500) }) } }))
  } else if (resp === "substitute") {
    defSteps.push(A("guard", castDur, { start: function (w2, d) {
      later(d, 420, function (w3, d3) {
        puff(d3, d3.fx, d3.fy - d3.H * 0.5, 7)
        d3.hiddenUntil = w3.t + 650
        addPart(d3.parts, { type: "log", x: d3.fx, y: d3.fy - d3.H * 0.45, vx: -d3.facing * 160, vy: -260, g: 1600, vr: -d3.facing * 6, life: 1400, size: d3.H * 0.5, floor: d3.fy - d3.H * 0.12 })
        floatText(d3, "SUBSTITUTION!", d3.fx, d3.fy - d3.H * 1.5, { size: 10, color: "#c9b6ff" })
      })
    } }))
  } else if (resp === "dodge") {
    defSteps.push(A("backflip"))
  } else {
    defSteps.push(A("guard", 300), A("hit", castDur - 300))
  }
  sync(atkSteps, defSteps)
  // Close the gap again for the next exchange.
  var close = function (other) {
    return function (w2, c2) { return (c2.rel + other.rel) / 2 + (c2.rel < other.rel ? -1 : 1) * c2.H * 0.36 }
  }
  atkSteps.push(SL(close(def), 450), face(function (w2, c2) { return def.rel > c2.rel ? 1 : -1 }))
  defSteps.push(SL(close(att), 450), face(function (w2, c2) { return att.rel > c2.rel ? 1 : -1 }))
  return resp
}

// ---------------------------------------------------------------- persistence

function serialize(w) {
  var out = { version: 2, homeState: w.homeState === "packed" || w.homeState === "packing" || w.homeState === "gathering" ? "packed" : null, mindBudget: w.mindBudget || "low", rel: w.rel, fightLog: w.fightLog, nextRaid: Math.round(w.nextRaid), followFocus: w.followFocus, chronicle: w.chronicle, mindEnabled: w.mindEnabled !== false, mindAllowCpu: !!w.mindAllowCpu, size: w.size, hidden: w.hidden, cap: w.cap, masterId: w.masterId,
    activeMs: Math.round(w.activeMs), nextTournament: Math.round(w.nextTournament), critters: [],
    dojo: w.dojo ? { stage: w.dojo.stage, progress: w.dojo.progress, done: w.dojo.done } : null }
  for (var i = 0; i < w.critters.length; i++) {
    var c = w.critters[i]
    out.critters.push({ id: c.id, name: c.name, band: c.band, luck: c.luck, diligence: c.diligence, personality: c.personality, element: c.element, traits: c.traits, hp: Math.round(c.hp), form: Math.round((c.form || 0) * 1000) / 1000,
      injured: c.injured, injuredAt: c.injuredAt, injuries: c.injuries, memory: (c.memory || []).slice(-12), mood: c.mood, xp: Math.round(c.xp), born: c.born,
      wins: c.wins, losses: c.losses, titles: c.titles, planks: c.planks })
  }
  return out
}

function restore(w, data) {
  if (!data || !Array.isArray(data.critters)) return
  if (typeof data.size === "number") w.size = clamp(data.size, 0.6, 2.0)
  w.hidden = !!data.hidden
  if (data.rel) w.rel = data.rel
  if (data.fightLog) w.fightLog = data.fightLog
  w.mindBudget = data.mindBudget || "low"
  if (data.homeState === "packed") w.homeState = "packed"
  if (data.nextRaid) w.nextRaid = data.nextRaid
  if (data.followFocus !== undefined) w.followFocus = !!data.followFocus
  if (data.chronicle) w.chronicle = data.chronicle
  w.mindEnabled = data.mindEnabled !== false
  w.mindAllowCpu = !!data.mindAllowCpu
  if (data.cap) w.cap = data.cap
  w.activeMs = data.activeMs || 0
  if (data.nextTournament) w.nextTournament = data.nextTournament
  var maxId = 0
  for (var i = 0; i < data.critters.length; i++) {
    var d = data.critters[i]
    if (d.kind && d.kind !== "ninja") continue
    var m = /^c(\d+)$/.exec(d.id || "")
    if (m) maxId = Math.max(maxId, parseInt(m[1], 10))
    var stats = d.stats || {}
    // Older saves could hold the same memory many times over: collapse them.
    if (d.memory) {
      var merged = []
      for (var mi = 0; mi < d.memory.length; mi++) {
        var mm = d.memory[mi], dup = null
        for (var mj = 0; mj < merged.length; mj++) if (merged[mj].text === mm.text) dup = merged[mj]
        if (dup) { dup.n = (dup.n || 1) + (mm.n || 1); dup.t = mm.t; merged.splice(merged.indexOf(dup), 1); merged.push(dup) }
        else merged.push(mm)
      }
      d.memory = merged
    }
    spawn(w, "ninja", { id: d.id, name: d.name, band: d.band, luck: d.luck, diligence: d.diligence, personality: d.personality, element: d.element, traits: d.traits, hp: d.hp, form: d.form, injured: d.injured, injuredAt: d.injuredAt, injuries: d.injuries, memory: d.memory, mood: d.mood, born: d.born,
      xp: d.xp || ((stats.flips || 0) * 2 + (stats.dummies || 0) * 5),
      wins: d.wins, losses: d.losses, titles: d.titles, planks: d.planks })
  }
  w.nextId = Math.max(w.nextId, maxId + 1)
  // Home in the dojo: they stay inside until called back.
  if (w.homeState === "packed") for (var hi = 0; hi < w.critters.length; hi++) { w.critters[hi].inside = true; w.critters[hi].bubble = null }
  if (data.masterId && find(w, data.masterId)) w.masterId = data.masterId
  // The dojo's window is gone after a restart: the next ninja to think
  // with room for it sets it up again, at the same stage.
  if (data.dojo) w.dojo = { home: null, frac: 0.5, stage: data.dojo.stage || 0, progress: data.dojo.progress || 0,
    done: !!data.dojo.done, gong: 0, hits: [], bbox: null, dummyWob: 0 }
}
