import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import Quickshell.Hyprland
import "Sim.js" as Sim
import "Lines.js" as Lines
import "Mind.js" as Mind
import "Draw.js" as Draw

// Ninjas that live in your windows and build a dojo together. This service
// owns the world (Sim.js), keeps it in sync with Hyprland, ticks it, and
// paints it into one click-through overlay per monitor. Only the ninjas
// themselves (and the dojo's gong) take mouse input.
Item {
  id: root

  property var shell: null
  property var manifest: null

  property var world: Sim.createWorld()
  // Bumped whenever the roster or its settings change, for the bar popup.
  property int rosterVersion: 0
  property bool layoutReady: false
  property bool stateLoaded: false
  property bool restored: false
  property var pendingState: null
  property var layers: []
  property double lastTick: 0
  property string persistKey: ""

  readonly property string statePath: Quickshell.env("HOME") + "/.local/state/omarchy/critters.json"
  readonly property bool hasCritters: rosterVersion >= 0 && world.critters.length > 0

  // ---------------------------------------------------------------- API

  // Anything drawn in the overlay, by id: the dojo, a demon, or a ninja.
  function entity(id) {
    if (id === "dojo") return world.dojo
    if (String(id).charAt(0) === "d" && world.raid) return Sim.demonOf(world, id)
    return Sim.find(world, id)
  }

  function byName(name) {
    var n = String(name).toLowerCase()
    for (var i = 0; i < world.critters.length; i++) if (world.critters[i].name.toLowerCase() === n) return world.critters[i]
    return null
  }

  function critterList() {
    var out = []
    for (var i = 0; i < world.critters.length; i++) {
      var c = world.critters[i]
      var bt = Sim.belt(c)
      out.push({ id: c.id, name: c.name, band: Sim.bandColor(world, c), belt: bt.name, beltColor: bt.color, beltStripe: bt.stripe || "",
        master: Sim.isMaster(world, c), xp: Math.round(c.xp), wins: c.wins, losses: c.losses,
        traits: Sim.traitLabels(c).join(", "), hp: Math.round(Sim.hpRatio(c) * 100), injured: c.injured,
        detail: (c.injured ? "INJURED · " : "") + Lines.personality(c).label + (Sim.traitLabels(c).length ? " (" + Sim.traitLabels(c).join(", ") + ")" : "")
          + (Sim.elementKnown(c) ? " · " + Sim.ELEMENTS[c.element].label : "") + " · ♥" + Math.round(Sim.hpRatio(c) * 100) + "% · " + bt.name + (bt.noBelt ? "" : " belt") + " · " + Math.round(c.xp) + " xp · " + c.wins + "W " + c.losses + "L · day " + Sim.dayOf(c)
          + " · luck " + Math.round(c.luck * 100) + "%" })
    }
    out.sort(function (a, b) { return (b.master - a.master) || (b.xp - a.xp) })
    return out
  }

  function dojoInfo() {
    var d = world.dojo
    if (!d) return { exists: false, text: "No dojo yet. A ninja will found one in a wide window." }
    var where = d.home ? (d.visible ? "" : " (its window is on another workspace)") : " (looking for a new window)"
    if (d.done) return { exists: true, done: true, stage: Sim.STAGES.length, total: Sim.STAGES.length, text: "Complete" + where }
    var st = Sim.STAGES[d.stage]
    return { exists: true, done: false, stage: d.stage, total: Sim.STAGES.length,
      text: "Building: " + st.name + " " + d.progress + "/" + st.work + where }
  }

  function fightLog() {
    return (world.fightLog || []).slice(-5).reverse().map(function (f) {
      var pct = Math.round(f.odds * 100)
      return (f.title ? "🏆 " : "") + f.winner + " beat " + f.loser + " (" + pct + "%" + (pct < 30 ? ", upset!" : "") + ")"
    })
  }

  function tournamentInfo() {
    for (var i = 0; i < world.events.length; i++) if (world.events[i].type === "tournament") return "Tournament in progress!"
    if (!world.dojo || world.dojo.stage <= Sim.S_SIGN) return "Tournaments begin once the dojo has its sign."
    var mins = Math.max(0, Math.round((world.nextTournament - world.activeMs) / 60000))
    return "Next tournament in about " + mins + " min (or strike the gong)."
  }

  function changed() {
    rosterVersion++
    saveSoon.restart()
    tickTimer.running = root.shouldTick()
  }

  function spawn(kind) {
    if (world.critters.length >= 12) return ""
    var c = Sim.spawn(world, "ninja")
    changed()
    return c.id
  }

  function remove(id) {
    if (!Sim.remove(world, id)) return false
    changed()
    return true
  }

  function summon(id) {
    Sim.summon(world, id)
    changed()
  }

  function moveDojoHere() {
    var r = Sim.moveDojo(world)
    changed()
    return r
  }

  function raid() {
    var ok = Sim.startRaid(world)
    changed()
    return ok
  }

  function tournament() {
    var ok = Sim.startTournament(world)
    changed()
    return ok
  }

  function clearAll() {
    world.critters = []
    world.events = []
    world.masterId = null
    changed()
  }

  function resetDojo() {
    world.dojo = null
    world.dojoParts = []
    changed()
  }

  function setFollow(value) {
    world.followFocus = !!value
    changed()
  }

  // Everyone files into the dojo, it folds away, then everything pauses.
  function sendHome() {
    // Pressing it again on the way home calls everyone back out.
    if (world.homeState === "gathering" || world.homeState === "packing") { Sim.cancelHome(world); changed(); return true }
    if (world.hidden || world.homeState) return false
    var ok = Sim.sendHome(world)
    changed()
    return ok
  }

  // Pause stops everything: animation, minds, polling, and frees the GPU.
  // Resuming after "send home" raises the dojo and lets everyone out.
  function setHidden(value) {
    var wasHome = world.homeState === "packed"
    if (!value && (world.homeState === "gathering" || world.homeState === "packing")) { Sim.cancelHome(world); changed(); return }
    world.hidden = !!value
    if (!world.hidden && wasHome) Sim.callBack(world)
    if (world.hidden) {
      world.mindQueue = []
      world.mindOn = false
      if (mindXhr) mindXhr.abort()
      if (mindUrl && mindModel) request("POST", mindUrl + "/api/generate", JSON.stringify({ model: mindModel, keep_alive: 0 }), function () { })
    }
    syncOllama()
    changed()
  }

  function setSize(value) {
    Sim.setSize(world, value)
    changed()
  }

  function shouldTick() {
    return layoutReady && world.critters.length > 0 && !world.hidden
  }

  // ---------------------------------------------------------------- IPC

  IpcHandler {
    target: "critters"

    function spawn(kind: string): string { return root.spawn("ninja") || "too many ninjas" }
    function remove(id: string): string { return root.remove(id) ? "removed" : "no such ninja" }
    function clear(): void { root.clearAll() }
    function toggle(): void { root.setHidden(!root.world.hidden) }
    function pause(): void { root.setHidden(true) }
    function home(): string { return root.sendHome() ? "everyone is heading home" : "can't right now" }
    function back(): void { root.setHidden(false) }
    function resume(): void { root.setHidden(false) }
    function summon(id: string): void { root.summon(id) }
    function size(value: real): void { root.setSize(value) }
    function tournament(): string { return root.tournament() ? "started" : "not possible right now" }
    function raid(): string { return root.raid() ? "the rift opens..." : "not possible right now" }
    function moveDojo(): string { return root.moveDojoHere() }
    function list(): string { return JSON.stringify(root.critterList()) }
    function mind(): string {
      var i = root.mindInfo()
      i.endpoints = root.endpointInfo
      i.gpu = root.gpuPresent
      i.url = root.mindUrl
      i.failures = root.mindFailures
      return JSON.stringify(i)
    }
    function mindEnable(on: bool): void { root.setMindEnabled(on) }
    // Directing: make a ninja (by name) say something, or do something.
    // Actions are the same ones minds use (see Mind.js ACTION_HELP).
    function say(name: string, text: string): string {
      var c = root.byName(name)
      if (!c) return "no ninja called " + name
      Sim.say(c, text, Sim.lineDurMs(text))
      return "ok"
    }
    function direct(name: string, action: string, target: string, line: string): string {
      var c = root.byName(name)
      if (!c) return "no ninja called " + name
      var t = target ? root.byName(target) : null
      if (target && !t) return "no ninja called " + target
      if (c.event) Sim.leaveEvent(root.world, c)
      Sim.interrupt(c)
      c.mindPlan = { action: action, target: t, say: line, at: root.world.t }
      return "ok"
    }
    function event(kind: string, a: string, b: string, text: string): string {
      var names = [a, b].filter(function (n) { return n })
      return Sim.directorEvent(root.world, { event: kind, ninjas: names, announcement: text }) ? "ok" : "couldn't start that now"
    }
    function thoughts(): string {
      return JSON.stringify(root.world.critters.map(function (c) { return { name: c.name, mood: c.mood, thought: c.thought } }))
    }
    function dojo(): string { return JSON.stringify(root.dojoInfo()) }
    // Debug helpers.
    function setStage(stage: int): void {
      if (!root.world.dojo) return
      root.world.dojo.stage = Math.max(0, Math.min(stage, Sim.STAGES.length))
      root.world.dojo.progress = 0
      root.world.dojo.done = root.world.dojo.stage >= Sim.STAGES.length
      root.changed()
    }
    function addXp(id: string, xp: int): void { var c = Sim.find(root.world, id); if (c) { c.xp += xp; root.changed() } }
    function where(): string {
      var out = []
      for (var i = 0; i < root.world.critters.length; i++) {
        var c = root.world.critters[i]
        out.push({ id: c.id, mode: c.mode, level: c.level, home: c.home, x: Math.round(c.fx), y: Math.round(c.fy),
          anim: c.anim, event: c.event ? c.event.type + ":" + c.event.phase : null, visible: c.visible, bbox: c.bbox })
      }
      var d = root.world.dojo
      return JSON.stringify({ ninjas: out, dojo: d ? { home: d.home, stage: d.stage, progress: d.progress, bbox: d.bbox } : null,
        events: root.world.events.map(function (e) { return e.type + ":" + e.phase }) })
    }
    function act(id: string, anim: string, ms: int): void {
      var c = Sim.find(root.world, id)
      if (!c || c.mode !== "ground") return
      Sim.interrupt(c)
      Sim.q(c, [Sim.A(anim, ms)])
    }
  }

  // ---------------------------------------------------------------- Hyprland

  function refresh() {
    if (!layoutProbe.running) layoutProbe.running = true
    else refreshAgain = true
  }
  property bool refreshAgain: false

  Process {
    id: layoutProbe
    command: ["sh", "-c", "hyprctl -j monitors; echo '@@CRITTERS@@'; hyprctl -j clients; echo '@@CRITTERS@@'; hyprctl -j activewindow"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var parts = text.split("@@CRITTERS@@")
        try {
          var mons = JSON.parse(parts[0])
          var clients = JSON.parse(parts[1])
          var active = {}
          try { active = JSON.parse(parts[2] || "{}") } catch (e2) { active = {} }
          Sim.setLayout(root.world, mons, clients, active && active.address ? active.address : "")
          root.layoutReady = true
          root.maybeRestore()
          tickTimer.running = root.shouldTick()
        } catch (e) {
          console.warn("critters: could not read hyprctl output: " + e)
        }
      }
    }
    onExited: {
      if (root.refreshAgain) {
        root.refreshAgain = false
        root.refresh()
      }
    }
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (root.world.critters.length > 0 || !root.layoutReady) refreshDebounce.restart()
    }
  }

  Timer {
    id: refreshDebounce
    interval: 45
    onTriggered: root.refresh()
  }

  // Window resizes emit no event, so poll gently while anyone is around.
  Timer {
    interval: 1500
    repeat: true
    running: root.world.critters.length > 0 && !root.world.hidden && root.rosterVersion >= 0
    onTriggered: root.refresh()
  }

  // ---------------------------------------------------------------- minds
  //
  // Optional LLM minds (Mind.js) from a local Ollama. Probed every 30s:
  // minds switch on only when the model actually runs on the GPU (the eGPU
  // Ollama). A CPU-only Ollama is ignored unless allowed, since a small
  // model there costs ~9s of full CPU per thought. Without a mind every
  // ninja keeps the scripted brain, so nothing ever waits on the network.

  readonly property var mindEndpoints: ["http://127.0.0.1:11434", "http://127.0.0.1:11435"]
  property bool gpuPresent: false
  property var endpointInfo: ({})
  property string mindUrl: ""
  property string mindModel: ""
  property string mindMode: "off"
  property string mindReason: "Looking for Ollama…"
  property bool mindBusy: false
  property double mindStarted: 0
  property var mindXhr: null
  property int mindCalls: 0
  property int mindFailures: 0
  property double mindAvgMs: 0
  property double nextDirector: 120000
  property int probePending: 0

  function mindInfo() {
    var on = mindActive()
    var text
    if (world.hidden && world.homeState === "packed") text = "Everyone is home in the dojo. Nothing running, GPU released."
    else if (world.hidden) text = "Paused: nothing running, GPU released."
    else if (world.mindEnabled === false) text = "Minds: switched off (scripted brains)."
    else if (on) text = "Minds: on, " + mindModel + " on " + (mindMode === "cpu" ? "CPU" : "GPU")
      + (mindCalls ? " · " + mindCalls + " thoughts · ~" + (mindAvgMs / 1000).toFixed(1) + "s each" : "")
      + " · thinking " + (world.mindBudget || "low")
      + ((world.mindBudget || "low") !== "high" ? (burstOn ? " (thinking now)" : " (next in " + Math.max(0, Math.round((nextBurst - Date.now()) / 60000)) + " min)") : "") + "."
    else text = "Minds: off. " + mindReason
    return { on: on, enabled: world.mindEnabled !== false, allowCpu: !!world.mindAllowCpu, text: text, mode: mindMode, budget: world.mindBudget || "low" }
  }

  function mindActive() {
    return world.mindEnabled !== false && (mindMode === "gpu" || mindMode === "probing" || (mindMode === "cpu" && world.mindAllowCpu))
  }

  function setMindEnabled(v) {
    world.mindEnabled = !!v
    if (!v && mindUrl && mindModel) request("POST", mindUrl + "/api/generate", JSON.stringify({ model: mindModel, keep_alive: 0 }), function () { })
    syncOllama()
    changed()
  }

  // How often the minds think. Keeping the model loaded costs ~50 W on the
  // eGPU even when idle, and loading it takes ~9 s, so low and normal think
  // in bursts: load, let everyone decide, unload. High keeps it loaded.
  readonly property var burstEvery: ({ low: 300000, normal: 90000 })
  property bool burstOn: false
  property double burstStarted: 0
  property double nextBurst: 0
  property var burstDone: ({})
  property var mindStamps: []

  function unloadModel() {
    if (mindUrl && mindModel) request("POST", mindUrl + "/api/generate", JSON.stringify({ model: mindModel, keep_alive: 0 }), function () { })
  }
  function cycleMindBudget() {
    var order = ["low", "normal", "high"]
    world.mindBudget = order[(order.indexOf(world.mindBudget || "low") + 1) % order.length]
    // Start the new rhythm with a burst right away; leaving "high" frees the GPU.
    nextBurst = 0
    burstOn = false
    if (world.mindBudget !== "high") unloadModel()
    changed()
  }
  function setMindAllowCpu(v) { world.mindAllowCpu = !!v; chooseEndpoint(); changed() }

  function request(method, url, body, cb) {
    var x = new XMLHttpRequest()
    var finished = false
    x.onreadystatechange = function () {
      if (x.readyState !== XMLHttpRequest.DONE || finished) return
      finished = true
      cb(x.status === 200 ? x.responseText : null)
    }
    x.open(method, url)
    if (body) x.setRequestHeader("Content-Type", "application/json")
    x.send(body || null)
    return x
  }

  Process {
    id: gpuProbe
    command: ["sh", "-c", "nvidia-smi -L 2>/dev/null | head -1"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var present = text.indexOf("GPU") >= 0
        // A GPU that came or went changes what each endpoint can do.
        if (present !== root.gpuPresent) root.endpointInfo = ({})
        root.gpuPresent = present
        root.syncOllama()
        root.probeEndpoints()
      }
    }
  }

  // The minds' Ollama is live translate's container (:11435). While the
  // ninjas are out with minds on and the eGPU is present, keep it running on
  // the GPU (ollama.sh recreates it with GPU access if it was CPU-only);
  // otherwise stop it, which ollama.sh skips while live translate uses it.
  readonly property string ollamaCtl: "$HOME/Work/live-translate/ollama.sh"
  readonly property string mindWantFile: "${XDG_RUNTIME_DIR:-/tmp}/critters-mind.want"
  readonly property string ollamaDown: "rm -f " + mindWantFile + "; [ -x " + ollamaCtl + " ] && " + ollamaCtl + " down"

  function syncOllama() {
    if (!world.hidden && world.mindEnabled !== false && gpuPresent) {
      if (!ollamaUp.running) ollamaUp.running = true
    } else {
      Quickshell.execDetached(["sh", "-c", ollamaDown])
    }
  }

  Process {
    id: ollamaUp
    command: ["sh", "-c", "touch " + root.mindWantFile + "; [ -x " + root.ollamaCtl + " ] && " + root.ollamaCtl + " up --gpu"]
    // The container may have just been recreated on the GPU: forget what each endpoint was.
    onExited: { root.endpointInfo = ({}); root.probeEndpoints() }
  }

  // Shell quit or plugin turned off.
  Component.onDestruction: Quickshell.execDetached(["sh", "-c", ollamaDown])

  Timer {
    interval: 30000
    repeat: true
    running: true
    triggeredOnStart: true
    onTriggered: if (!gpuProbe.running && !root.world.hidden) gpuProbe.running = true
  }

  function probeEndpoints() {
    if (probePending > 0) return
    probePending = mindEndpoints.length
    mindEndpoints.forEach(function (url) {
      request("GET", url + "/api/tags", null, function (tags) {
        var info = endpointInfo[url] || { kind: "" }
        info.up = !!tags
        info.models = []
        if (tags) {
          try { info.models = JSON.parse(tags).models || [] } catch (e) { info.models = [] }
        }
        info.model = pickModel(info.models)
        if (!tags) { info.kind = ""; finishProbe(url, info); return }
        request("GET", url + "/api/ps", null, function (ps) {
          info.ctx = 0
          try {
            var loaded = JSON.parse(ps).models || []
            for (var i = 0; i < loaded.length; i++) {
              if (loaded[i].name !== info.model) continue
              info.kind = loaded[i].size_vram > 0 ? "gpu" : "cpu"
              info.ctx = loaded[i].context_length || 0
            }
          } catch (e2) { }
          finishProbe(url, info)
        })
      })
    })
  }

  function finishProbe(url, info) {
    var next = {}
    for (var k in endpointInfo) next[k] = endpointInfo[k]
    next[url] = info
    endpointInfo = next
    probePending--
    if (probePending <= 0) { probePending = 0; chooseEndpoint() }
  }

  // Largest model that fits comfortably on a 12GB card.
  function pickModel(models) {
    var best = null
    for (var i = 0; i < models.length; i++) {
      var m = models[i]
      if (m.size > 11e9 || /embed/i.test(m.name)) continue
      if (!best || m.size > best.size) best = m
    }
    return best ? best.name : ""
  }

  function chooseEndpoint() {
    var urls = mindEndpoints
    var mode = "off", url = "", model = ""
    for (var i = 0; i < urls.length && mode === "off"; i++) {
      var e = endpointInfo[urls[i]]
      if (e && e.up && e.model && e.kind === "gpu" && gpuPresent) { mode = "gpu"; url = urls[i]; model = e.model }
    }
    // Not sure yet which endpoint has the GPU: one thought will tell.
    for (var j = 0; j < urls.length && mode === "off"; j++) {
      var f = endpointInfo[urls[j]]
      if (f && f.up && f.model && f.kind === "" && gpuPresent) { mode = "probing"; url = urls[j]; model = f.model }
    }
    for (var k = 0; k < urls.length && mode === "off"; k++) {
      var g = endpointInfo[urls[k]]
      if (g && g.up && g.model && g.kind === "cpu" && world.mindAllowCpu) { mode = "cpu"; url = urls[k]; model = g.model }
    }
    if (mode === "off") {
      var anyUp = urls.some(function (u) { return endpointInfo[u] && endpointInfo[u].up && endpointInfo[u].model })
      mindReason = !gpuPresent ? "The eGPU isn't connected, so they use their scripted brains."
        : (anyUp ? "Ollama is only running on the CPU (allow CPU to use it anyway: ~9s per thought)."
          : "No Ollama is running. Start the GPU one to wake their minds.")
    }
    if (mode !== mindMode || url !== mindUrl || model !== mindModel) {
      mindMode = mode
      mindUrl = url
      mindModel = model
      rosterVersion++
    }
  }

  // Send one request; `apply` gets the parsed JSON reply (or null).
  function think(req, apply) {
    mindStamps = mindStamps.concat([Date.now()])
    var info = endpointInfo[mindUrl] || {}
    var ctx = info.ctx && info.ctx > 4096 ? info.ctx : 4096
    var probing = mindMode === "probing"
    var url = mindUrl
    mindBusy = true
    mindStarted = Date.now()
    mindXhr = request("POST", url + "/api/chat", Mind.body(mindModel, req, ctx), function (text) {
      mindBusy = false
      mindXhr = null
      var ms = Date.now() - mindStarted
      var d = text ? Mind.parse(text) : null
      if (d) {
        mindCalls++
        mindAvgMs = mindCalls === 1 ? ms : mindAvgMs * 0.85 + ms * 0.15
        try { apply(d) } catch (e) { console.warn("critters mind: " + e) }
      } else mindFailures++
      // After the first thought we know whether the model sits on the GPU.
      if (probing) { var info2 = endpointInfo[url]; if (info2) info2.kind = ""; probeEndpoints() }
    })
  }

  Timer {
    id: mindTimer
    interval: 500
    repeat: true
    running: true
    onTriggered: {
      var w = root.world
      if (w.hidden) { w.mindOn = false; w.mindQueue = []; return }
      var on = root.mindActive()
      w.mindOn = on
      w.mindDialogue = on && root.mindMode !== "cpu"
      if (!on) { w.mindQueue = []; return }
      if (root.mindBusy) {
        if (Date.now() - root.mindStarted > 90000 && root.mindXhr) root.mindXhr.abort()
        return
      }
      var slow = root.mindMode === "cpu" ? 4 : 1
      var now = Date.now()
      var budget = w.mindBudget || "low"
      var bursty = budget !== "high"
      if (bursty) {
        if (!root.burstOn) {
          w.mindDialogue = false
          w.mindQueue = []
          if (now < root.nextBurst) return
          root.burstOn = true
          root.burstStarted = now
          root.burstDone = ({})
          // Everyone gets a fresh decision this burst.
          for (var b0 = 0; b0 < w.critters.length; b0++) w.critters[b0].nextMind = 0
        }
        var everyoneDone = w.critters.every(function (c) { return root.burstDone[c.id] || !Sim.isVisible(w, c) || c.injured || c.mode !== "ground" })
        if ((everyoneDone && !w.mindQueue.length && now - root.burstStarted > 3000) || now - root.burstStarted > 60000) {
          root.burstOn = false
          root.nextBurst = now + root.burstEvery[budget]
          w.mindDialogue = false
          root.unloadModel()
          return
        }
      }
      // 1. Conversations someone is waiting for.
      while (w.mindQueue.length) {
        var it = w.mindQueue.shift()
        if (it.type === "party" && !it.ev.over && it.ev.phase === "party") {
          var pev = it.ev, pa = it.a, pb = it.b
          var fights = pev.history.map(function (h) { return h.w + " beat " + h.l + " in round " + h.r }).join("; ")
          root.think(Mind.dialogue(w, pa, pb, "They sit together drinking sake after the endurance tournament, still sore, talking about the fights ("
            + fights + "). " + (pev.champ ? pev.champ.name + " was the last one standing." : "")), function (d) {
            if (pev.over || !d || !d.lines) return
            var at = 0
            d.lines.slice(0, 4).forEach(function (l) {
              var sp = l.speaker === "B" ? pb : pa
              var text = String(l.text || "").slice(0, 100)
              if (!text) return
              Sim.later(sp, at + 10, function (w2, c2) { if (!pev.over) Sim.say(c2, text) })
              at += Sim.readMs(text)
            })
          })
          return
        }
        if (it.type === "dialogue" && !it.ev.over && !it.ev.llmLines) {
          var ev = it.ev
          root.think(Mind.dialogue(w, ev.a, ev.b), function (d) { if (!ev.over) Mind.applyDialogue(w, ev, d) })
          return
        }
      }
      var free = w.critters.filter(function (c) { return c.visible && c.mode === "ground" && !c.event && !c.injured })
      // 2. Something just happened to someone.
      for (var i = 0; i < free.length; i++) {
        if (free[i].mindUrgent) { root.decide(free[i], slow); return }
      }
      // 3. Now and then, the storyteller.
      if (w.critters.length >= 2 && free.length >= 2 && w.t > root.nextDirector) {
        root.nextDirector = w.t + (6 + Math.random() * 6) * 60000 * slow * (bursty ? 1.5 : 1)
        root.think(Mind.director(w), function (d) {
          if (Sim.directorEvent(w, d)) { w.lastDirectorEvent = d.event; root.changed() }
        })
        return
      }
      // 4. Routine: each ninja reconsiders every minute or two.
      for (var j = 0; j < free.length; j++) {
        if (bursty ? !root.burstDone[free[j].id] : w.t >= (free[j].nextMind || 0)) { root.decide(free[j], slow); return }
      }
    }
  }

  function decide(c, slow) {
    var bd = {}
    for (var k in burstDone) bd[k] = burstDone[k]
    bd[c.id] = true
    burstDone = bd
    c.mindUrgent = false
    c.nextMind = world.t + (60000 + Math.random() * 90000) * slow
    root.think(Mind.decision(world, c), function (d) { Mind.applyDecision(world, c, d) })
  }

  // ---------------------------------------------------------------- state

  FileView {
    id: stateFile
    path: root.statePath
    blockLoading: false
    printErrors: false
    onLoaded: {
      try { root.pendingState = JSON.parse(text()) } catch (e) { root.pendingState = null }
      root.stateLoaded = true
      root.maybeRestore()
    }
    onLoadFailed: function(error) {
      root.stateLoaded = true
      root.maybeRestore()
    }
  }

  function maybeRestore() {
    if (restored || !stateLoaded || !layoutReady) return
    restored = true
    if (pendingState) Sim.restore(world, pendingState)
    pendingState = null
    rosterVersion++
    tickTimer.running = shouldTick()
  }

  function save() {
    if (!restored) return
    stateFile.setText(JSON.stringify(Sim.serialize(world), null, 2) + "\n")
  }

  Timer {
    id: saveSoon
    interval: 800
    onTriggered: root.save()
  }

  Timer {
    interval: 60000
    repeat: true
    running: root.world.critters.length > 0 && root.rosterVersion >= 0
    onTriggered: { root.save(); root.rosterVersion++ }
  }

  // ---------------------------------------------------------------- tick

  Timer {
    id: tickTimer
    interval: 33
    repeat: true
    running: false
    onRunningChanged: root.lastTick = Date.now()
    onTriggered: {
      var now = Date.now()
      var dt = root.lastTick ? now - root.lastTick : 33
      root.lastTick = now
      Sim.tick(root.world, dt)
      for (var i = 0; i < root.layers.length; i++) root.layers[i].update()
      if (root.world.justPacked) {
        root.world.justPacked = false
        root.setHidden(true)
      }
      // Save and refresh the popup when anything that persists moves.
      var d = root.world.dojo
      var key = (d ? d.stage + "/" + d.progress + "/" + d.home : "-") + "|" + root.world.masterId + "|" + root.world.critters.length
      if (key !== root.persistKey) { root.persistKey = key; root.changed() }
    }
  }

  onRosterVersionChanged: {
    for (var i = 0; i < layers.length; i++) layers[i].update()
  }

  Component.onCompleted: refresh()

  // ---------------------------------------------------------------- overlay

  Component {
    id: regionComponent
    Region { }
  }

  Variants {
    model: Quickshell.screens

    PanelWindow {
      id: overlay
      required property var modelData

      screen: modelData
      // rosterVersion bumps on every pause/resume, so this re-evaluates.
      visible: root.rosterVersion >= 0 && root.world.critters.length > 0 && !root.world.hidden
      color: "transparent"
      anchors { top: true; bottom: true; left: true; right: true }
      exclusionMode: ExclusionMode.Ignore
      WlrLayershell.layer: WlrLayer.Top
      WlrLayershell.namespace: "omarchy-critters"
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.None

      property var ids: []
      property var regionPool: []
      property string dragId: ""
      property string pressId: ""
      property string pressPart: ""
      property real pressX: 0
      property real pressY: 0

      mask: Region { id: inputMask }

      function mon() { return root.world.monitorByName[modelData.name] || null }

      function update() {
        var m = mon()
        if (!m) {
          if (ids.length) ids = []
          setRegions([])
          return
        }
        var next = []
        var d = root.world.dojo
        if (d && d.visible && d.bbox) {
          var db = Sim.dojoBase(root.world)
          if (db && db.mon === m.name) next.push("dojo")
        }
        if (Sim.decorBounds(root.world, m.name)) next.push("decor")
        var rd = root.world.raid
        if (rd) {
          for (var pi = 0; pi < rd.portals.length; pi++) if (rd.portals[pi].mon === m.name) next.push("portal:" + pi)
          for (var di = 0; di < rd.demons.length; di++) if (rd.demons[di].mon === m.name) next.push(rd.demons[di].id)
          var rb0 = Sim.raidBounds(root.world)
          if (rb0 && rb0.x + rb0.w > m.x && rb0.x < m.x + m.w) next.push("raid")
        }
        for (var i = 0; i < root.world.critters.length; i++) {
          var c = root.world.critters[i]
          var owner = Sim.monitorOf(root.world, c)
          if (owner && owner.name === m.name) next.push(c.id)
        }
        if (next.join(",") !== ids.join(",")) ids = next

        var rects = []
        if (dragId !== "") rects.push({ x: 0, y: 0, w: overlay.width, h: overlay.height })
        for (var k = 0; k < canvases.count; k++) {
          var item = canvases.itemAt(k)
          if (item) item.sync(m)
        }
        if (dragId === "") {
          for (var j = 0; j < next.length; j++) {
            if (next[j] === "decor" || next[j] === "raid" || String(next[j]).indexOf("portal:") === 0) continue
            var cc = root.entity(next[j])
            if (!cc) continue
            for (var h = 0; h < cc.hits.length; h++) {
              var r = cc.hits[h]
              rects.push({ x: r.x - m.x, y: r.y - m.y, w: r.w, h: r.h })
            }
          }
        }
        setRegions(rects)
      }

      function setRegions(rects) {
        while (regionPool.length < rects.length) regionPool.push(regionComponent.createObject(overlay))
        var used = []
        for (var i = 0; i < rects.length; i++) {
          var reg = regionPool[i]
          reg.x = Math.round(rects[i].x)
          reg.y = Math.round(rects[i].y)
          reg.width = Math.max(1, Math.round(rects[i].w))
          reg.height = Math.max(1, Math.round(rects[i].h))
          used.push(reg)
        }
        // Reassign every frame: the input region must follow the critters
        // exactly, or a stale rectangle would swallow clicks meant for windows.
        inputMask.regions = used
      }

      Component.onCompleted: {
        var next = root.layers.slice()
        next.push(overlay)
        root.layers = next
      }
      Component.onDestruction: {
        var next = []
        for (var i = 0; i < root.layers.length; i++) if (root.layers[i] !== overlay) next.push(root.layers[i])
        root.layers = next
      }

      Repeater {
        id: canvases
        model: overlay.ids

        Canvas {
          id: canvas
          required property var modelData
          property var critter: null
          property string paintedKey: ""

          function sync(m) {
            if (modelData === "decor") {
              var db = Sim.decorBounds(root.world, m.name)
              if (!db) { visible = false; return }
              x = db.x - m.x
              y = db.y - m.y
              if (width !== db.w) width = db.w
              if (height !== db.h) height = db.h
              visible = true
              // Static: repaint only when something changed.
              var key = root.world.decorVersion + ":" + db.x + "," + db.y + "," + db.w + "," + db.h
              if (key !== paintedKey) { paintedKey = key; requestPaint() }
              return
            }
            if (String(modelData).indexOf("portal:") === 0 || modelData === "raid") {
              var rb = modelData === "raid" ? Sim.raidBounds(root.world) : Sim.portalBounds(root.world, parseInt(String(modelData).slice(7)))
              critter = root.world.raid
              if (!rb || !critter) { visible = false; return }
              x = rb.x - m.x; y = rb.y - m.y
              if (width !== rb.w) width = rb.w
              if (height !== rb.h) height = rb.h
              visible = true
              requestPaint()
              return
            }
            critter = root.entity(modelData)
            if (!critter) { visible = false; return }
            var b = critter.bbox
            if (!b) { visible = false; return }
            x = b.x - m.x
            y = b.y - m.y
            if (width !== b.w) width = b.w
            if (height !== b.h) height = b.h
            visible = true
            requestPaint()
          }

          onPaint: {
            var ctx = getContext("2d")
            ctx.reset()
            ctx.clearRect(0, 0, width, height)
            if (!critter && modelData !== "decor") return
            var m = overlay.mon()
            if (!m) return
            ctx.save()
            ctx.translate(-(x + m.x), -(y + m.y))
            if (modelData === "decor") Draw.drawDecor(ctx, root.world, m.name)
            else if (modelData === "raid") Draw.drawRaid(ctx, root.world)
            else if (String(modelData).indexOf("portal:") === 0) Draw.drawPortal(ctx, root.world, parseInt(String(modelData).slice(7)))
            else if (critter.kind === "imp" || critter.kind === "oni") Draw.drawDemonScene(ctx, root.world, critter)
            else if (modelData === "dojo") Draw.drawDojo(ctx, root.world)
            else Draw.drawScene(ctx, root.world, critter)
            ctx.restore()
          }
        }
      }

      MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: overlay.dragId !== "" ? Qt.ClosedHandCursor : Qt.PointingHandCursor

        onPressed: function(mouse) {
          var m = overlay.mon()
          if (!m) return
          var hit = Sim.hitTest(root.world, mouse.x + m.x, mouse.y + m.y)
          overlay.pressId = hit ? hit.id : ""
          overlay.pressPart = hit ? hit.part : ""
          overlay.pressX = mouse.x
          overlay.pressY = mouse.y
        }

        onPositionChanged: function(mouse) {
          var m = overlay.mon()
          if (!m || overlay.pressId === "") return
          if (overlay.dragId === "" && overlay.pressId !== "dojo" && overlay.pressPart !== "demon"
              && Math.abs(mouse.x - overlay.pressX) + Math.abs(mouse.y - overlay.pressY) > 6) {
            overlay.dragId = overlay.pressId
            Sim.dragStart(root.world, overlay.dragId, mouse.x + m.x, mouse.y + m.y)
          }
          if (overlay.dragId !== "") Sim.dragMove(root.world, overlay.dragId, mouse.x + m.x, mouse.y + m.y)
        }

        onReleased: function(mouse) {
          if (overlay.dragId !== "") {
            Sim.dragEnd(root.world, overlay.dragId)
            overlay.dragId = ""
          } else if (overlay.pressId !== "") {
            if (mouse.button === Qt.RightButton) Sim.inspect(root.world, overlay.pressId)
            else if (mouse.button === Qt.LeftButton) Sim.click(root.world, overlay.pressId, overlay.pressPart)
          }
          overlay.pressId = ""
          root.rosterVersion++
        }
      }
    }
  }
}
