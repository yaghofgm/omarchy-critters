.pragma library
.import "Sim.js" as Sim
.import "Lines.js" as Lines

// Optional LLM minds for the ninjas, served by a local Ollama.
//
// The model never drives movement. It fills in a small JSON form (Ollama
// enforces the schema), and Sim turns that into moves it already knows.
// Three kinds of request:
//   decision  - one ninja picks its next action, mood and line
//   dialogue  - a short conversation between two ninjas
//   director  - a world event for the whole dojo
// This file only builds request bodies and applies replies; the service
// does the networking.

var SOLO = {
  train_kata: "kata", train_combo: "combo", train_weapons: "weapons", acrobatics: "acrobatics",
  meditate: "meditate", pushups: "pushups", nap: "nap", snack: "snack", dance: "dance", flex: "flex",
  throw_shuriken: "shuriken", hit_dummy: "dummy", sprint: "sprint", build_dojo: "build",
  explore_other_window: "explore", go_to_dojo: "goDojo", climb_dojo: "climb", sulk: "sulk", rest: "idle",
  practice_jutsu: "jutsu", shadow_clones: "clones", hard_training: "hard", rest_and_heal: "rest", go_to_the_giant: "follow"
}
var SOCIAL = {
  chat: "chat", highfive: "highfive", share_food: "share", teach: "teach", meditate_with: "meditate",
  flex_off: "flexoff", copycat: "mirror", tag: "tag", prank: "prank", spar: "spar", challenge: "challenge",
  bow_to: "bow"
}
var ACTION_HELP = {
  train_kata: "practice punches and kicks", train_combo: "advanced combo (uppercut, sweep, flying kick)",
  train_weapons: "sword or bo staff kata", acrobatics: "handstand, cartwheels or splits", meditate: "meditate alone",
  pushups: "push-ups", nap: "take a nap", snack: "eat a rice ball", dance: "dance", flex: "flex muscles",
  throw_shuriken: "throw shurikens at the window edge", hit_dummy: "beat a training dummy", sprint: "sprint and flip",
  build_dojo: "carry a plank and build the dojo", explore_other_window: "leap into another window", go_to_the_giant: "go to the window the human is working in",
  go_to_dojo: "leap to the dojo's window", climb_dojo: "jump up to an upper floor of the dojo", sulk: "sulk",
  rest: "stand around", hard_training: "brutal training: triple experience but costs a lot of health; risky when already hurt",
  rest_and_heal: "sit down and recover health", practice_jutsu: "practice your ninjutsu (yellow belts mostly fizzle)", shadow_clones: "make shadow clones and train with them", chat: "talk with target", highfive: "high-five target", share_food: "share a rice ball with target",
  teach: "teach target a move (you need a higher belt)", meditate_with: "meditate next to target", flex_off: "flex contest with target",
  copycat: "copy target's moves to annoy or amuse them", tag: "play tag with target", prank: "sneak up and scare target",
  spar: "friendly spar with target", challenge: "challenge target to a serious duel", bow_to: "bow respectfully to target"
}
var MOODS = ["calm", "happy", "proud", "grumpy", "vengeful", "sleepy", "hungry", "nervous", "bored", "inspired", "playful", "sad"]
var EVENTS = ["none", "demon_raid", "tournament", "group_kata", "festival", "feast", "rivalry", "friendship", "storytime", "announcement"]

function feel(v) {
  if (v >= 3) return "best friends"
  if (v >= 1.5) return "friends"
  if (v > 0.5) return "friendly"
  if (v > -0.5) return "neutral"
  if (v > -1.5) return "annoyed"
  if (v > -3) return "rivals"
  return "bitter rivals"
}

function card(w, c) {
  var p = Lines.personality(c)
  var bt = Sim.belt(c)
  return c.name + " (" + p.label + ", " + bt.name + (bt.noBelt ? " rank" : " belt") + " (" + (Sim.beltIndex(c) + 1) + " of " + Sim.BELTS.length + ")" + (Sim.elementKnown(c) ? ", " + Sim.ELEMENTS[c.element].label.toLowerCase() + " element" : "")
    + (Sim.isMaster(w, c) ? ", the dojo's SENSEI" : "") + ")"
}

function sample(arr, n) {
  var a = arr.slice(), out = []
  while (a.length && out.length < n) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0])
  return out
}

function voice(c) {
  var p = Lines.personality(c)
  return sample(p.idle.concat(p.reply), 3).map(function (s) { return "\"" + s + "\"" }).join(" ")
}

function dojoText(w) {
  var d = w.dojo
  if (!d) return "No dojo yet."
  if (d.done) return "The dojo (a three-storey pagoda) is complete."
  var st = Sim.STAGES[d.stage]
  return "The dojo is being built: working on the " + st.name.toLowerCase() + " (" + d.progress + "/" + st.work + "), stage " + (d.stage + 1) + " of " + Sim.STAGES.length + "."
}

function memories(c) {
  var m = c.memory || []
  if (!m.length) return "- (nothing much yet; you're new here)"
  // Only the two latest conversations: gossip fades instead of echoing.
  var chats = 0
  var kept = []
  for (var i = m.length - 1; i >= 0 && kept.length < 8; i--) {
    var isChat = / chatted with /.test(m[i].text)
    if (isChat && ++chats > 2) continue
    kept.unshift(m[i])
  }
  return kept.map(function (e) { return "- " + e.text + (e.n > 1 ? " (" + e.n + " times)" : "") }).join("\n")
}

var SYSTEM_DECIDE = "You are the inner mind of one tiny stick-figure ninja. Ninjas live at the bottom of windows on a human's computer screen " +
  "(the human is 'the giant' with the cursor). They train, build a dojo together, and have friendships and rivalries.\n" +
  "Stay in character for your personality. Pick ONE next action. Social actions need a target from the people listed as here with you; " +
  "for anything else set target to \"\". React to your memories and feelings: hold grudges, return favours, show off to friends.\n" +
  "'say' is spoken out loud: short (under 12 words), funny, in your voice. Say something most of the time. 'thought' is private, one sentence. " +
  "Choose a mood that fits. Reply with the JSON object only."

function decision(w, c) {
  var here = Sim.idleMates(w, c)
  var elsewhere = w.critters.filter(function (o) { return o !== c && here.indexOf(o) < 0 })
  var win = Sim.windowOf(w, c.home)
  var lvl = Sim.jutsuLevel(c)
  var actions = Object.keys(SOLO).filter(function (a) {
    return !(a === "practice_jutsu" && lvl < 1) && !(a === "shadow_clones" && lvl < 3)
  }).concat(here.length ? Object.keys(SOCIAL) : [])
  var lines = []
  lines.push("You: " + card(w, c) + ". " + Lines.personality(c).blurb)
  lines.push("Your voice, for flavour: " + voice(c))
  lines.push("Day " + Sim.dayOf(c) + " of training, " + Math.round(c.xp) + " xp, record " + c.wins + "W-" + c.losses + "L. Current mood: " + (c.mood || "calm") + ".")
  var tr = Sim.traitLabels(c)
  if (tr.length) lines.push("Your traits: " + c.traits.map(function (t) { return Sim.TRAITS[t].label + " (" + Sim.TRAITS[t].blurb + ")" }).join(", ") + ".")
  var hr = Sim.hpRatio(c)
  lines.push("Health: " + Math.round(c.hp) + "/" + Sim.maxHp(c) + (hr < 0.3 ? " (badly hurt: another fight or hard training could injure you)" : (hr < 0.6 ? " (bruised)" : " (fit)"))
    + ". Form: " + ((c.form || 0) > 0.05 ? "on a hot streak" : ((c.form || 0) < -0.05 ? "in a slump" : "steady")) + ".")
  lines.push("You are in " + (win ? "a " + (win.cls || "app") + " window" + (w.dojo && w.dojo.home === c.home ? " (the dojo is here)" : "") : "no window (on the bare screen floor)") + ".")
  lines.push("Your memories (newest last):\n" + memories(c))
  if (here.length) lines.push("Here with you: " + here.map(function (o) {
    return card(w, o) + ", health " + Math.round(Sim.hpRatio(o) * 100) + "%, you feel: " + feel(Sim.relOf(w, c, o))
  }).join("; ") + ".")
  var hurt = w.critters.filter(function (o) { return o !== c && o.injured })
  if (hurt.length) lines.push("Injured and lying down: " + hurt.map(function (o) { return o.name }).join(", ") + ".")
  else lines.push("Nobody else is in your window right now.")
  if (elsewhere.length) lines.push("Elsewhere: " + elsewhere.map(function (o) { return o.name + " (" + feel(Sim.relOf(w, c, o)) + ")" }).join(", ") + ".")
  lines.push(dojoText(w) + " Master: " + (w.masterId ? Sim.find(w, w.masterId).name : "none yet") + ".")
  if (w.dojo && w.dojo.stage > Sim.S_SIGN) {
    var mins = Math.max(0, Math.round((w.nextTournament - w.activeMs) / 60000))
    lines.push("Next endurance tournament in about " + mins + " minutes (fighters keep their current health going in, so arriving hurt is a big disadvantage).")
  }
  lines.push("Actions: " + actions.map(function (a) { return a + " (" + ACTION_HELP[a] + ")" }).join("; "))
  var targets = [""].concat(here.map(function (o) { return o.name }))
  var schema = { type: "object", required: ["thought", "mood", "action", "target", "say"], properties: {
    thought: { type: "string", maxLength: 140 },
    mood: { type: "string", enum: MOODS },
    action: { type: "string", enum: actions },
    target: { type: "string", enum: targets },
    say: { type: "string", maxLength: 80 }
  } }
  return { system: SYSTEM_DECIDE, user: lines.join("\n"), schema: schema, predict: 170 }
}

// Turn a reply into a plan the brain can carry out.
function applyDecision(w, c, d) {
  if (!d || typeof d !== "object") return false
  if (MOODS.indexOf(d.mood) >= 0) c.mood = d.mood
  c.thought = String(d.thought || "").slice(0, 160)
  var target = null
  if (d.target) for (var i = 0; i < w.critters.length; i++) if (w.critters[i].name === d.target) target = w.critters[i]
  c.mindPlan = { action: String(d.action || ""), target: target, say: String(d.say || "").slice(0, 90), at: w.t }
  return true
}

var SYSTEM_DIALOGUE = "You write very short, funny exchanges between two tiny ninjas who live in windows on someone's computer screen. " +
  "Each speaks in their own personality's voice and they react to their shared history. 2 to 4 lines, each under 14 words. JSON only."

function dialogue(w, a, b, situation) {
  var lines = []
  if (situation) lines.push("Situation: " + situation)
  lines.push("A is " + card(w, a) + ": " + Lines.personality(a).blurb + " Voice: " + voice(a))
  lines.push("B is " + card(w, b) + ": " + Lines.personality(b).blurb + " Voice: " + voice(b))
  lines.push("A feels " + feel(Sim.relOf(w, a, b)) + " towards B. A's mood: " + (a.mood || "calm") + ". B's mood: " + (b.mood || "calm") + ".")
  lines.push("A remembers:\n" + memories(a))
  lines.push("B remembers:\n" + memories(b))
  lines.push(dojoText(w))
  lines.push("A starts the conversation.")
  var schema = { type: "object", required: ["lines"], properties: { lines: { type: "array", minItems: 2, maxItems: 4,
    items: { type: "object", required: ["speaker", "text"], properties: {
      speaker: { type: "string", enum: ["A", "B"] }, text: { type: "string", maxLength: 90 } } } } } }
  return { system: SYSTEM_DIALOGUE, user: lines.join("\n"), schema: schema, predict: 220 }
}

function applyDialogue(w, ev, d) {
  if (!d || !d.lines || !d.lines.length) return false
  var out = []
  for (var i = 0; i < d.lines.length && i < 4; i++) {
    var l = d.lines[i]
    if (!l || !l.text) continue
    out.push([l.speaker === "B" ? 1 : 0, String(l.text).slice(0, 100)])
  }
  if (out.length < 2) return false
  ev.llmLines = out
  return true
}

var SYSTEM_DIRECTOR = "You are the playful storyteller of a tiny ninja dojo that lives on someone's computer screen. " +
  "Every so often you start a small event to make their lives more interesting, using what has been happening. " +
  "Keep the announcement short (under 16 words), in-world and funny. Use 'none' if nothing fits. JSON only."

function director(w) {
  var lines = []
  lines.push("Ninjas: " + w.critters.map(function (c) {
    return card(w, c) + " mood " + (c.mood || "calm") + ", " + c.wins + "W-" + c.losses + "L"
  }).join("; ") + ".")
  var rels = []
  for (var i = 0; i < w.critters.length; i++) for (var j = i + 1; j < w.critters.length; j++) {
    var v = Sim.relOf(w, w.critters[i], w.critters[j])
    if (Math.abs(v) >= 1.5) rels.push(w.critters[i].name + " & " + w.critters[j].name + ": " + feel(v))
  }
  if (rels.length) lines.push("Relationships: " + rels.join("; ") + ".")
  lines.push(dojoText(w) + " Master: " + (w.masterId ? Sim.find(w, w.masterId).name : "none yet") + ".")
  lines.push("Recent happenings:\n" + ((w.chronicle || []).slice(-8).map(function (e) { return "- " + e }).join("\n") || "- (quiet so far)"))
  if (w.lastDirectorEvent) lines.push("Last time you chose '" + w.lastDirectorEvent + "'; pick something different.")
  lines.push("demon_raid: a rift opens and demons attack the dojo; use it rarely, for drama.")
  lines.push("Events: tournament (endurance tournament: everyone fights until their health runs out, last one standing is champion; needs the dojo sign built), group_kata (synchronized training), " +
    "festival (everyone dances), feast (everyone eats together), rivalry (ninjas[0] challenges ninjas[1]), " +
    "friendship (ninjas[0] and ninjas[1] make up / bond), storytime (ninjas[0] tells a story, given as the announcement), announcement (ninjas[0] says it).")
  var names = w.critters.map(function (c) { return c.name })
  var schema = { type: "object", required: ["event", "ninjas", "announcement"], properties: {
    event: { type: "string", enum: EVENTS.filter(function (e) { return e !== w.lastDirectorEvent }) },
    ninjas: { type: "array", maxItems: 2, items: { type: "string", enum: names } },
    announcement: { type: "string", maxLength: 110 } } }
  return { system: SYSTEM_DIRECTOR, user: lines.join("\n"), schema: schema, predict: 160 }
}

// Ollama /api/chat request body.
function body(model, req, numCtx) {
  return JSON.stringify({
    model: model, stream: false, think: false, format: req.schema, keep_alive: "2m",
    options: { temperature: 0.95, num_ctx: numCtx || 4096, num_predict: req.predict || 200 },
    messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }]
  })
}

function parse(text) {
  try {
    var r = JSON.parse(text)
    return JSON.parse(r.message.content)
  } catch (e) {
    return null
  }
}
