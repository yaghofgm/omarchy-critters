.pragma library
.import "Rig.js" as Rig
.import "Sim.js" as Sim

// Canvas painting: one ninja's scene (figure, props, particles, bubble) or
// the dojo. Everything is drawn in global layout coordinates; the caller
// translates the context first.

var SKIN = "#f1c29b"
var OUTLINE = "rgba(236,238,244,0.92)"
var CLOTH = "#262833"
var CLOTH_FAR = "#16171e"

function seg(ctx, a, b) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function dot(ctx, p, r) {
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
}

function lerpPt(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } }

// ---------------------------------------------------------------- figure

// Draw a ninja at its feet. The skeleton is in figure units, so the context
// is scaled by the drawn height and line widths are in figure units too.
// Training shows: thicker limbs and torso, bigger fists, a little taller.
function drawFigure(ctx, w, c, sk) {
  var b = Sim.physique(c)
  var Hs = c.H * (0.94 + 0.12 * b)
  var lw = 0.068 + 0.05 * b
  var tw = 0.1 + 0.09 * b
  var fist = 0.042 + 0.022 * b
  var band = Sim.bandColor(w, c)
  var tier = Sim.beltIndex(c)
  var golden = tier === 8, divine = tier >= 9
  var CLOTH = golden ? "#c9971c" : (divine ? "#f7f4ea" : "#262833")
  var CLOTH_FAR = golden ? "#9c7414" : (divine ? "#d9d2bd" : "#16171e")
  var OUTLINE = golden ? "rgba(255,226,140,0.95)" : (divine ? "rgba(255,246,200,0.95)" : "rgba(236,238,244,0.92)")
  var t = w.t / 1000
  ctx.save()
  ctx.translate(c.fx, c.fy)
  ctx.scale(c.facing * Hs, Hs)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  // The divine float a little above the ground.
  if (divine) ctx.translate(0, -0.06 - Math.sin(t * 1.6) * 0.02)
  if (divine) drawAura(ctx, w, c, sk, t)
  if (tier >= Sim.B_BLACK) drawCape(ctx, c, sk, t, golden ? "#b8860b" : (divine ? "#efe9d6" : "#1d1f28"), divine || golden ? "#f2c14e" : band)

  var chest = lerpPt(sk.neck, sk.hip, 0.3)
  var tA = sk.torsoA
  chest = { x: chest.x + Math.cos(tA) * 0.03 * b, y: chest.y + Math.sin(tA) * 0.03 * b }

  for (var pass = 0; pass < 2; pass++) {
    var o = pass === 0
    var ow = o ? 0.06 : 0
    var col = function (name) { return o ? OUTLINE : name }

    // Far leg and arm.
    ctx.strokeStyle = col(CLOTH_FAR)
    ctx.lineWidth = lw * (1 + 0.45 * b) + ow
    seg(ctx, sk.hip, sk.lknee)
    ctx.lineWidth = lw + ow
    seg(ctx, sk.lknee, sk.lfoot)
    ctx.lineWidth = lw * (1 + 0.6 * b) + ow
    seg(ctx, sk.sh, sk.lelbow)
    ctx.lineWidth = lw * 0.95 + ow
    seg(ctx, sk.lelbow, sk.lhand)
    ctx.fillStyle = col(CLOTH_FAR)
    dot(ctx, sk.lhand, fist + ow / 2)

    // Near leg, feet.
    ctx.strokeStyle = col(CLOTH)
    ctx.lineWidth = lw * (1 + 0.45 * b) + ow
    seg(ctx, sk.hip, sk.rknee)
    ctx.lineWidth = lw + ow
    seg(ctx, sk.rknee, sk.rfoot)
    ctx.fillStyle = col(CLOTH)
    dot(ctx, sk.lfoot, 0.042 + ow / 2)
    dot(ctx, sk.rfoot, 0.042 + ow / 2)

    // Torso, with a chest that fills out over time.
    ctx.strokeStyle = col(CLOTH)
    ctx.lineWidth = tw + ow
    seg(ctx, sk.hip, sk.neck)
    if (b > 0.15) dot(ctx, chest, tw * (0.45 + 0.25 * b) + ow / 2)

    // Head.
    ctx.fillStyle = col(CLOTH)
    dot(ctx, sk.head, sk.headR + ow / 2)

    // Near arm on top.
    if (!o) drawHeldProp(ctx, w, c, sk)
    ctx.strokeStyle = col(CLOTH)
    ctx.lineWidth = lw * (1 + 0.6 * b) + ow
    seg(ctx, sk.sh, sk.relbow)
    ctx.lineWidth = lw * 0.95 + ow
    seg(ctx, sk.relbow, sk.rhand)
    ctx.fillStyle = col(CLOTH)
    dot(ctx, sk.rhand, fist + ow / 2)
  }

  drawGarments(ctx, w, c, sk, tier, lw, tw, band, t)
  if (Sim.isMaster(w, c)) drawSensei(ctx, c, sk, tw)
  if (!Sim.belt(c).noBelt) drawBelt(ctx, c, sk, tw)
  else drawSash(ctx, sk, tw, divine ? "#f2c14e" : "#8e1b1b")
  if (divine) drawHalo(ctx, sk, t)
  drawNinjaHead(ctx, w, c, sk, band, divine ? "#fbe7b0" : null)
  ctx.restore()
}

function drawBelt(ctx, c, sk, tw) {
  var bt = Sim.belt(c)
  var at = lerpPt(sk.neck, sk.hip, 0.82)
  var tA = sk.torsoA
  var nx = Math.cos(tA) * (tw / 2 + 0.012), ny = Math.sin(tA) * (tw / 2 + 0.012)
  ctx.strokeStyle = "rgba(10,10,14,0.6)"
  ctx.lineWidth = 0.05
  seg(ctx, { x: at.x - nx, y: at.y - ny }, { x: at.x + nx, y: at.y + ny })
  ctx.strokeStyle = bt.color
  ctx.lineWidth = 0.034
  seg(ctx, { x: at.x - nx, y: at.y - ny }, { x: at.x + nx, y: at.y + ny })
  if (bt.stripe) {
    // Red and white: alternating panels.
    ctx.strokeStyle = bt.stripe
    seg(ctx, { x: at.x - nx * 0.33, y: at.y - ny * 0.33 }, { x: at.x + nx * 0.33, y: at.y + ny * 0.33 })
  }
  // Knot tails hanging off the back.
  var back = { x: at.x - nx, y: at.y - ny }
  ctx.lineWidth = 0.022
  seg(ctx, back, { x: back.x - 0.05, y: back.y + 0.08 })
  seg(ctx, back, { x: back.x - 0.015, y: back.y + 0.09 })
}

function headFrame(ctx, sk) {
  ctx.translate(sk.head.x, sk.head.y)
  ctx.rotate(sk.headA)
}

function faceExpr(c, sk) { return c.expr || sk.face || "normal" }

function drawEyes(ctx, expr, ex, ey, color) {
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 0.022
  if (expr === "closed" || expr === "focus") {
    ctx.beginPath()
    ctx.moveTo(ex - 0.025, ey)
    ctx.lineTo(ex + 0.025, ey + (expr === "focus" ? -0.008 : 0.006))
    ctx.stroke()
  } else if (expr === "happy") {
    ctx.beginPath()
    ctx.arc(ex, ey + 0.012, 0.022, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
  } else if (expr === "dizzy") {
    ctx.beginPath()
    ctx.moveTo(ex - 0.02, ey - 0.02); ctx.lineTo(ex + 0.02, ey + 0.02)
    ctx.moveTo(ex + 0.02, ey - 0.02); ctx.lineTo(ex - 0.02, ey + 0.02)
    ctx.stroke()
  } else if (expr === "surprised") {
    ctx.beginPath()
    ctx.arc(ex, ey, 0.024, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(ex, ey, 0.017, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawNinjaHead(ctx, w, c, sk, band, hood) {
  var days = Sim.dayOf(c) - 1
  ctx.save()
  headFrame(ctx, sk)
  // Eye slit.
  ctx.fillStyle = SKIN
  ctx.beginPath()
  ctx.moveTo(0.02, -0.045)
  ctx.lineTo(sk.headR * 0.98, -0.04)
  ctx.lineTo(sk.headR * 0.98, 0.02)
  ctx.lineTo(0.02, 0.015)
  ctx.closePath()
  ctx.fill()
  drawEyes(ctx, faceExpr(c, sk), 0.07, -0.013, "#1c1c22")
  // Elders grow a beard below the mask: grey at first, then long and white.
  if (days >= 3) {
    var long = days >= 10
    ctx.fillStyle = long ? "#f2f2f2" : "#a7a9b0"
    ctx.beginPath()
    ctx.moveTo(0.02, 0.06)
    ctx.quadraticCurveTo(0.13, 0.07, 0.12, 0.02)
    ctx.lineTo(0.09 + (long ? 0.02 : 0), long ? 0.24 : 0.14)
    ctx.closePath()
    ctx.fill()
  }
  // Bandage when badly hurt.
  if (c.injured || Sim.hpRatio(c) < 0.35) {
    ctx.strokeStyle = "#f4f1ea"
    ctx.lineWidth = 0.04
    ctx.beginPath()
    ctx.arc(0, 0, sk.headR * 0.99, Math.PI * 1.65, Math.PI * 2.15)
    ctx.stroke()
    ctx.strokeStyle = "#e0393e"
    ctx.lineWidth = 0.012
    seg(ctx, { x: 0.055, y: -0.085 }, { x: 0.085, y: -0.085 })
    seg(ctx, { x: 0.07, y: -0.1 }, { x: 0.07, y: -0.07 })
  }
  // Headband with two tails streaming behind.
  ctx.strokeStyle = band
  ctx.lineWidth = 0.035
  ctx.beginPath()
  ctx.arc(0, 0, sk.headR * 0.98, Math.PI * 1.12, Math.PI * 1.62)
  ctx.stroke()
  var t = w.t / 1000
  var moving = c.mode !== "ground" || c.anim === "run" || c.anim === "walk" || c.anim === "carry"
  var len = moving ? 0.26 : 0.18
  ctx.lineWidth = 0.028
  var sensei = Sim.isMaster(w, c)
  for (var i = 0; i < 2; i++) {
    var ph = t * (moving ? 14 : 5) + i * 1.7 + (c.id.length + c.id.charCodeAt(c.id.length - 1))
    var ox = -sk.headR * 0.9, oy = -0.05
    var ex = ox - len, ey = oy + Math.sin(ph + 1.3) * 0.06 + 0.05 + 0.04 * i
    ctx.strokeStyle = band
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.quadraticCurveTo(ox - len * 0.5, oy + Math.sin(ph) * 0.04 + 0.02 * i, ex, ey)
    ctx.stroke()
    if (sensei) {
      ctx.fillStyle = "#f2c14e"
      dot(ctx, { x: ex, y: ey }, 0.022)
    }
  }
  ctx.restore()
}


// ---------------------------------------------------------------- garments

// Clothes that come with rank. Drawn in figure units over the body.
function drawGarments(ctx, w, c, sk, tier, lw, tw, band, t) {
  var golden = tier === 8, divine = tier >= 9
  // Orange and up: white arm and shin wraps.
  if (tier >= 2 && !divine) {
    ctx.strokeStyle = golden ? "#fff3c4" : "#ecebe4"
    ctx.lineWidth = 0.012
    var wraps = [[sk.relbow, sk.rhand], [sk.rknee, sk.rfoot]]
    for (var i = 0; i < wraps.length; i++) {
      var a = wraps[i][0], b = wraps[i][1]
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1
      var nx = -dy / len * lw * 0.6, ny = dx / len * lw * 0.6
      for (var k = 0; k < 4; k++) {
        var u = 0.35 + k * 0.15
        var m = { x: a.x + dx * u, y: a.y + dy * u }
        seg(ctx, { x: m.x - nx, y: m.y - ny }, { x: m.x + nx + dx * 0.04, y: m.y + ny + dy * 0.04 })
      }
    }
  }
  // Brown and up: armoured sleeves on the upper arm.
  if (tier >= 6 && !divine) {
    ctx.strokeStyle = golden ? "#e8c45a" : "#3c4250"
    ctx.lineWidth = lw * 0.9
    var mid = lerpPt(sk.sh, sk.relbow, 0.55)
    seg(ctx, lerpPt(sk.sh, sk.relbow, 0.3), mid)
    ctx.strokeStyle = "rgba(255,255,255,0.25)"
    ctx.lineWidth = 0.012
    seg(ctx, lerpPt(sk.sh, sk.relbow, 0.32), lerpPt(sk.sh, sk.relbow, 0.52))
  }
  // Blue and up: a shoulder guard.
  if (tier >= 4) {
    ctx.save()
    ctx.translate(sk.sh.x, sk.sh.y)
    ctx.rotate(sk.torsoA)
    ctx.fillStyle = divine ? "#f2c14e" : (golden ? "#f0cf62" : "#4a5160")
    ctx.strokeStyle = divine || golden ? "#8a6414" : "#1a1c22"
    ctx.lineWidth = 0.012
    ctx.beginPath()
    ctx.ellipse(-tw * 0.55, -0.02, tw * 1.25, 0.075)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  // Purple and up: a long scarf streaming behind.
  if (tier >= 5) {
    var moving = c.mode !== "ground" || c.anim === "run" || c.anim === "walk" || c.anim === "carry"
    var len2 = moving ? 0.42 : 0.3
    ctx.strokeStyle = divine ? "#f6efd8" : (golden ? "#8e1b1b" : band)
    ctx.lineWidth = 0.04
    var nk = lerpPt(sk.neck, sk.sh, 0.5)
    ctx.beginPath()
    ctx.moveTo(nk.x, nk.y)
    ctx.quadraticCurveTo(nk.x - len2 * 0.5, nk.y + Math.sin(t * (moving ? 12 : 4)) * 0.05,
      nk.x - len2, nk.y + 0.08 + Math.sin(t * (moving ? 12 : 4) + 1.4) * 0.07)
    ctx.stroke()
  }
  // Golden: little glints now and then.
  if (golden && Math.random() < 0.03) {
    var g = [sk.head, sk.sh, sk.hip, sk.rhand][Math.floor(Math.random() * 4)]
    ctx.fillStyle = "rgba(255,250,210,0.95)"
    star(ctx, 0.03, 4, 0.3)
    ctx.save()
    ctx.translate(g.x + (Math.random() - 0.5) * 0.1, g.y + (Math.random() - 0.5) * 0.1)
    star(ctx, 0.035, 4, 0.3)
    ctx.fill()
    ctx.restore()
  }
}

// The sensei's regalia: a gold sash across the chest and, when calm, a
// wooden staff. Their own colours stay as they are.
var STAFF_ANIMS = { stand: 1, guard: 1, walk: 1, talk: 1, listen2: 1, admire: 1, victory: 1, thumbsup: 1, think: 1, bow: 1, wave: 1, pace: 1 }
function drawSensei(ctx, c, sk, tw) {
  var top = lerpPt(sk.sh, sk.neck, 0.3)
  var bot = lerpPt(sk.neck, sk.hip, 0.95)
  var tA = sk.torsoA
  var off = { x: Math.cos(tA) * tw * 0.5, y: Math.sin(tA) * tw * 0.5 }
  ctx.strokeStyle = "#7a1414"
  ctx.lineWidth = 0.05
  seg(ctx, { x: top.x + off.x, y: top.y + off.y }, { x: bot.x - off.x, y: bot.y - off.y })
  ctx.strokeStyle = "#f2c14e"
  ctx.lineWidth = 0.032
  seg(ctx, { x: top.x + off.x, y: top.y + off.y }, { x: bot.x - off.x, y: bot.y - off.y })
  if (STAFF_ANIMS[c.anim] && !c.prop && !c.carry) {
    var h = sk.lhand
    ctx.strokeStyle = "#17181d"
    ctx.lineWidth = 0.055
    seg(ctx, { x: h.x + 0.03, y: 0 }, { x: h.x - 0.01, y: h.y - 0.42 })
    ctx.strokeStyle = "#8a5a2b"
    ctx.lineWidth = 0.035
    seg(ctx, { x: h.x + 0.03, y: 0 }, { x: h.x - 0.01, y: h.y - 0.42 })
    ctx.fillStyle = "#f2c14e"
    dot(ctx, { x: h.x - 0.01, y: h.y - 0.44 }, 0.03)
  }
}

// Black and up: a half-coat whose tails swing behind.
function drawCape(ctx, c, sk, t, color, trim) {
  var moving = c.mode !== "ground" || c.anim === "run" || c.anim === "walk"
  var sway = Math.sin(t * (moving ? 10 : 2.5)) * (moving ? 0.06 : 0.025)
  var back = moving ? 0.22 : 0.1
  var top = lerpPt(sk.neck, sk.hip, 0.08)
  var bottom = lerpPt(sk.neck, sk.hip, 1.0)
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = trim
  ctx.lineWidth = 0.02
  ctx.beginPath()
  ctx.moveTo(top.x + 0.05, top.y)
  ctx.lineTo(top.x - 0.07, top.y + 0.01)
  ctx.quadraticCurveTo(bottom.x - back * 0.6, bottom.y - 0.05, bottom.x - back + sway, bottom.y + 0.17)
  ctx.lineTo(bottom.x + 0.02 + sway * 0.5, bottom.y + 0.13)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

// Golden and divine wear a sash in place of a belt.
function drawSash(ctx, sk, tw, color) {
  var at = lerpPt(sk.neck, sk.hip, 0.8)
  var tA = sk.torsoA
  var nx = Math.cos(tA) * (tw / 2 + 0.015), ny = Math.sin(tA) * (tw / 2 + 0.015)
  ctx.strokeStyle = color
  ctx.lineWidth = 0.05
  seg(ctx, { x: at.x - nx, y: at.y - ny }, { x: at.x + nx, y: at.y + ny })
  // A broad tail hanging down the side.
  ctx.lineWidth = 0.035
  seg(ctx, { x: at.x - nx * 0.6, y: at.y - ny * 0.6 }, { x: at.x - nx - 0.03, y: at.y - ny + 0.16 })
}

function drawHalo(ctx, sk, t) {
  ctx.save()
  ctx.translate(sk.head.x, sk.head.y)
  ctx.rotate(sk.headA)
  ctx.globalCompositeOperation = "lighter"
  ctx.strokeStyle = "rgba(255,215,90,0.95)"
  ctx.lineWidth = 0.022
  ctx.beginPath()
  ctx.ellipse(-0.13 - 0.02, -0.25 + Math.sin(t * 2) * 0.008, 0.26, 0.07)
  ctx.stroke()
  ctx.restore()
}

// A soft glow and motes of light rising around the divine.
function drawAura(ctx, w, c, sk, t) {
  ctx.save()
  ctx.globalCompositeOperation = "lighter"
  var mid = lerpPt(sk.neck, sk.hip, 0.4)
  for (var i = 3; i >= 1; i--) {
    ctx.fillStyle = "rgba(255,210,110," + (0.035 * (4 - i)) + ")"
    dot(ctx, mid, 0.12 + i * 0.09 + Math.sin(t * 2 + i) * 0.015)
  }
  ctx.fillStyle = "rgba(255,250,215,0.85)"
  for (var k = 0; k < 6; k++) {
    var ph = (t * 0.35 + k / 6) % 1
    var ang = k * 1.7
    dot(ctx, { x: Math.cos(ang) * 0.32, y: -ph * 1.0 }, 0.012 * (1 - ph) + 0.004)
  }
  ctx.restore()
}

// ---------------------------------------------------------------- props

function drawHeldProp(ctx, w, c, sk) {
  if (c.carry) {
    var b = c.carry
    var Hs = c.H * (0.94 + 0.12 * Sim.physique(c))
    var mid = lerpPt(sk.lhand, sk.rhand, 0.5)
    ctx.save()
    ctx.translate(mid.x, mid.y - b.h / Hs / 2)
    plank(ctx, b.w / Hs, b.h / Hs, b.color, 0.015)
    ctx.restore()
  }
  if (!c.prop) return
  var hand = sk.rhand
  ctx.save()
  ctx.translate(hand.x, hand.y)
  ctx.lineCap = "round"
  if (c.prop === "hammer") {
    ctx.rotate(0.3)
    ctx.strokeStyle = "#8a5a2b"
    ctx.lineWidth = 0.03
    seg(ctx, { x: 0, y: 0.04 }, { x: 0, y: -0.2 })
    ctx.fillStyle = "#808894"
    ctx.fillRect(-0.06, -0.24, 0.12, 0.05)
  } else if (c.prop === "katana") {
    // Blade continues the forearm's line.
    var a = Math.atan2(sk.rhand.y - sk.relbow.y, sk.rhand.x - sk.relbow.x)
    ctx.rotate(a)
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.05
    seg(ctx, { x: -0.06, y: 0 }, { x: 0.05, y: 0 })
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 0.035
    seg(ctx, { x: 0.05, y: -0.035 }, { x: 0.05, y: 0.035 })
    ctx.strokeStyle = "#d9dde6"
    ctx.lineWidth = 0.028
    ctx.beginPath()
    ctx.moveTo(0.06, 0)
    ctx.quadraticCurveTo(0.3, -0.015, 0.5, -0.05)
    ctx.stroke()
  } else if (c.prop === "bo") {
    ctx.rotate(w.t / 1000 * 9)
    ctx.strokeStyle = "#a5703f"
    ctx.lineWidth = 0.035
    seg(ctx, { x: -0.42, y: 0 }, { x: 0.42, y: 0 })
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.04
    seg(ctx, { x: -0.43, y: 0 }, { x: -0.36, y: 0 })
    seg(ctx, { x: 0.36, y: 0 }, { x: 0.43, y: 0 })
  } else if (c.prop === "sake") {
    ctx.fillStyle = "#f4f1ea"
    ctx.strokeStyle = "#3a3a46"
    ctx.lineWidth = 0.01
    ctx.beginPath()
    ctx.moveTo(-0.045, -0.06); ctx.lineTo(0.045, -0.06); ctx.lineTo(0.03, 0.0); ctx.lineTo(-0.03, 0.0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (c.prop === "onigiri") {
    ctx.fillStyle = "#fbfbf6"
    ctx.beginPath()
    ctx.moveTo(0, -0.1)
    ctx.quadraticCurveTo(0.08, -0.02, 0.06, 0.03)
    ctx.lineTo(-0.06, 0.03)
    ctx.quadraticCurveTo(-0.08, -0.02, 0, -0.1)
    ctx.fill()
    ctx.fillStyle = "#1f3a26"
    ctx.fillRect(-0.03, -0.01, 0.06, 0.04)
  }
  ctx.restore()
}

function plank(ctx, bw, bh, color, lw) {
  ctx.fillStyle = color
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh)
  ctx.strokeStyle = "rgba(20,20,26,0.85)"
  ctx.lineWidth = lw
  ctx.strokeRect(-bw / 2, -bh / 2, bw, bh)
}

function star(ctx, r, points, inner) {
  ctx.beginPath()
  for (var i = 0; i < points * 2; i++) {
    var a = i * Math.PI / points
    var rr = i % 2 ? r * inner : r
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
}

function drawShuriken(ctx, x, y, r, rot) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillStyle = "#9aa3b2"
  ctx.strokeStyle = "#2a2d36"
  ctx.lineWidth = 1
  star(ctx, r, 4, 0.35)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#2a2d36"
  dot(ctx, { x: 0, y: 0 }, r * 0.18)
  ctx.restore()
}

function drawPortableDummy(ctx, w, c) {
  if (!c.dummy) return
  var x = c.x + (c.dummy.rel - c.rel)
  woodenDummy(ctx, x, c.y, c.H, c.dummy.wob * Math.sin(w.t / 1000 * 22) * 0.35)
}

function woodenDummy(ctx, x, y, H, ang) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  ctx.lineCap = "round"
  ctx.strokeStyle = "#17181d"
  ctx.lineWidth = H * 0.13
  seg(ctx, { x: 0, y: 0 }, { x: 0, y: -H * 0.8 })
  ctx.strokeStyle = "#b98a54"
  ctx.lineWidth = H * 0.09
  seg(ctx, { x: 0, y: 0 }, { x: 0, y: -H * 0.8 })
  ctx.strokeStyle = "#8b6034"
  ctx.lineWidth = H * 0.05
  seg(ctx, { x: -H * 0.2, y: -H * 0.55 }, { x: H * 0.2, y: -H * 0.6 })
  seg(ctx, { x: -H * 0.16, y: -H * 0.35 }, { x: H * 0.18, y: -H * 0.32 })
  ctx.fillStyle = "#c9a06b"
  ctx.strokeStyle = "#17181d"
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(0, -H * 0.88, H * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------- particles

function drawParts(ctx, w, list, H) {
  for (var i = 0; i < list.length; i++) {
    var p = list[i]
    if (p.type === "delay") continue
    var k = p.age / p.life
    var fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    if (p.type === "smoke") {
      ctx.fillStyle = p.tint === "purple" ? "rgba(150,80,210,0.7)" : "rgba(200,204,212,0.75)"
      ctx.globalAlpha = Math.max(0, 1 - k)
      dot(ctx, p, p.size * (0.6 + k))
    } else if (p.type === "dust") {
      ctx.fillStyle = "rgba(170,160,145,0.8)"
      ctx.globalAlpha = Math.max(0, 1 - k)
      dot(ctx, p, p.size * (1 + k))
    } else if (p.type === "star") {
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color || "#ffd84a"
      ctx.strokeStyle = "#5c4400"
      ctx.lineWidth = 0.8
      star(ctx, Math.max(3, p.size), 5, 0.45)
      ctx.fill()
      ctx.stroke()
    } else if (p.type === "petal") {
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = "#f7b6c8"
      ctx.beginPath()
      ctx.ellipse(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2)
      ctx.fill()
    } else if (p.type === "text") {
      ctx.font = "bold " + p.size + "px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.lineWidth = 3
      ctx.strokeStyle = "rgba(20,20,26,0.85)"
      ctx.strokeText(p.text, p.x, p.y)
      ctx.fillStyle = p.color || "#fbfbf6"
      ctx.fillText(p.text, p.x, p.y)
    } else if (p.type === "plank") {
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = "#b98a54"
      ctx.strokeStyle = "#17181d"
      ctx.lineWidth = 1
      ctx.fillRect(-p.size / 2, -p.size * 0.12, p.size, p.size * 0.24)
      ctx.strokeRect(-p.size / 2, -p.size * 0.12, p.size, p.size * 0.24)
    } else if (p.type === "flyto" && p.kind === "shuriken") {
      drawShuriken(ctx, p.x, p.y, p.size, p.rot)
    } else if (p.type === "flame") {
      var fs = p.size * (1 + (p.grow || 0.6) * k)
      ctx.globalCompositeOperation = "lighter"
      ctx.globalAlpha = Math.max(0, 1 - k)
      ctx.fillStyle = k < 0.3 ? "rgba(255,240,170,0.9)" : (k < 0.6 ? "rgba(255,150,40,0.85)" : "rgba(200,60,20,0.7)")
      dot(ctx, p, fs)
    } else if (p.type === "drop") {
      ctx.fillStyle = "rgba(90,175,255,0.9)"
      ctx.beginPath()
      ctx.ellipse(p.x - p.size, p.y - p.size * 1.3, p.size * 2, p.size * 2.6)
      ctx.fill()
    } else if (p.type === "streak") {
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.strokeStyle = "rgba(200,255,235," + (0.85 * (1 - k)) + ")"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-p.size / 2, 0)
      ctx.quadraticCurveTo(0, -p.size * 0.18, p.size / 2, 0)
      ctx.stroke()
    } else if (p.type === "rock") {
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = "#8a6a48"
      ctx.strokeStyle = "#3a2a1c"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-p.size, -p.size * 0.3); ctx.lineTo(-p.size * 0.2, -p.size); ctx.lineTo(p.size, -p.size * 0.4)
      ctx.lineTo(p.size * 0.7, p.size * 0.8); ctx.lineTo(-p.size * 0.6, p.size * 0.7)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (p.type === "wall") {
      var rise = Math.min(1, p.age / 260), crumble = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1
      var wh = p.size * rise, ww = p.size * 0.5
      ctx.globalAlpha = crumble
      ctx.fillStyle = "#8a6a48"
      ctx.strokeStyle = "#3a2a1c"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(p.x - ww / 2, p.y)
      ctx.lineTo(p.x - ww / 2 + 2, p.y - wh)
      ctx.lineTo(p.x, p.y - wh - 4)
      ctx.lineTo(p.x + ww / 2 - 2, p.y - wh + 2)
      ctx.lineTo(p.x + ww / 2, p.y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = "rgba(40,25,10,0.5)"
      seg(ctx, { x: p.x - ww * 0.3, y: p.y - wh * 0.3 }, { x: p.x + ww * 0.1, y: p.y - wh * 0.55 })
      seg(ctx, { x: p.x + ww * 0.2, y: p.y - wh * 0.75 }, { x: p.x - ww * 0.05, y: p.y - wh * 0.9 })
    } else if (p.type === "log") {
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      box(ctx, -p.size * 0.18, -p.size / 2, p.size * 0.36, p.size, "#9a6a3c", INK, 1.2)
      ctx.fillStyle = "#d9b27c"
      ctx.beginPath()
      ctx.ellipse(-p.size * 0.18, -p.size / 2 - p.size * 0.06, p.size * 0.36, p.size * 0.12)
      ctx.fill()
    } else if (p.type === "tornado") {
      ctx.strokeStyle = "rgba(200,255,235,0.8)"
      ctx.lineWidth = 2
      var spin = p.age / 60
      for (var ti = 0; ti < 7; ti++) {
        var ty = p.y - ti * p.size * 0.16
        var rw = p.size * (0.15 + ti * 0.07)
        ctx.beginPath()
        ctx.ellipse(p.x - rw + Math.sin(spin + ti) * 3, ty - rw * 0.15, rw * 2, rw * 0.3)
        ctx.stroke()
      }
    } else if (p.type === "sake") {
      // A sake bottle on a little tray in the middle of the party.
      var sH = p.size
      box(ctx, p.x - sH * 0.35, p.y - sH * 0.06, sH * 0.7, sH * 0.06, "#5e3b1c", INK, 1)
      ctx.fillStyle = "#f4f1ea"
      ctx.strokeStyle = "#3a3a46"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(p.x - sH * 0.04, p.y - sH * 0.5)
      ctx.lineTo(p.x + sH * 0.04, p.y - sH * 0.5)
      ctx.quadraticCurveTo(p.x + sH * 0.04, p.y - sH * 0.32, p.x + sH * 0.13, p.y - sH * 0.22)
      ctx.lineTo(p.x + sH * 0.1, p.y - sH * 0.06)
      ctx.lineTo(p.x - sH * 0.1, p.y - sH * 0.06)
      ctx.lineTo(p.x - sH * 0.13, p.y - sH * 0.22)
      ctx.quadraticCurveTo(p.x - sH * 0.04, p.y - sH * 0.32, p.x - sH * 0.04, p.y - sH * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = "#3a6fb0"
      ctx.fillRect(p.x - sH * 0.08, p.y - sH * 0.2, sH * 0.16, sH * 0.06)
      box(ctx, p.x - sH * 0.27, p.y - sH * 0.12, sH * 0.07, sH * 0.06, "#f4f1ea", "#3a3a46", 1)
      box(ctx, p.x + sH * 0.2, p.y - sH * 0.12, sH * 0.07, sH * 0.06, "#f4f1ea", "#3a3a46", 1)
    } else if (p.type === "jutsu") {
      drawJutsu(ctx, w, p)
    } else if (p.type === "riftspark") {
      ctx.globalCompositeOperation = "lighter"
      ctx.fillStyle = "rgba(190,90,255,0.8)"
      dot(ctx, p, p.size * (1 - k * 0.5))
    } else if (p.type === "bolt") {
      // Jagged lightning from the sky.
      ctx.globalCompositeOperation = "lighter"
      ctx.strokeStyle = "rgba(255,250,200," + (1 - k) + ")"
      ctx.lineWidth = 2.5
      ctx.beginPath()
      var bx = p.x, by = p.y - p.size
      ctx.moveTo(bx, by)
      var steps = 7
      for (var bi = 1; bi <= steps; bi++) {
        var jitter = Math.sin((p.seed + bi) * 12.9898) * 43758.5453
        jitter = (jitter - Math.floor(jitter) - 0.5) * p.size * 0.18
        ctx.lineTo(p.x + (bi < steps ? jitter : 0), by + p.size * bi / steps)
      }
      ctx.stroke()
    } else if (p.type === "flash") {
      ctx.globalCompositeOperation = "lighter"
      ctx.fillStyle = "rgba(255,255,220," + (0.8 * (1 - k)) + ")"
      dot(ctx, p, p.size * (0.6 + k))
    }
    ctx.restore()
  }
}

// A flying jutsu: fireball, water ball, wind blade or boulder.
function drawJutsu(ctx, w, p) {
  var r = p.size
  if (p.el === "fire") {
    ctx.globalCompositeOperation = "lighter"
    ctx.fillStyle = "rgba(255,120,30,0.55)"
    dot(ctx, p, r * 1.5)
    ctx.fillStyle = "rgba(255,200,80,0.9)"
    dot(ctx, p, r)
    ctx.fillStyle = "rgba(255,250,210,0.95)"
    dot(ctx, p, r * 0.5)
  } else if (p.el === "water") {
    var wob = Math.sin(p.age / 50) * 0.15
    ctx.fillStyle = "rgba(60,150,255,0.85)"
    ctx.beginPath()
    ctx.ellipse(p.x - r * (1 + wob), p.y - r * (1 - wob), r * 2 * (1 + wob), r * 2 * (1 - wob))
    ctx.fill()
    ctx.fillStyle = "rgba(220,240,255,0.8)"
    dot(ctx, { x: p.x - r * 0.35, y: p.y - r * 0.35 }, r * 0.3)
  } else if (p.el === "wind") {
    ctx.translate(p.x, p.y)
    if (p.dir < 0) ctx.scale(-1, 1)
    ctx.strokeStyle = "rgba(210,255,240,0.95)"
    ctx.lineWidth = Math.max(2, r * 0.3)
    ctx.beginPath()
    ctx.arc(-r * 0.6, 0, r * 1.4, -1.0, 1.0)
    ctx.stroke()
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(-r * 1.0, 0, r * 1.4, -0.8, 0.8)
    ctx.stroke()
  } else {
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = "#8a6a48"
    ctx.strokeStyle = "#3a2a1c"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-r, -r * 0.2); ctx.lineTo(-r * 0.3, -r); ctx.lineTo(r * 0.8, -r * 0.6)
    ctx.lineTo(r, r * 0.5); ctx.lineTo(-r * 0.4, r)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

// ---------------------------------------------------------------- bubble

// Mix a #rrggbb colour towards white.
function tint(hex, k) {
  var n = parseInt(String(hex).slice(1), 16)
  var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return "rgb(" + Math.round(r + (255 - r) * k) + "," + Math.round(g + (255 - g) * k) + "," + Math.round(b + (255 - b) * k) + ")"
}

// Speech bubble in the speaker's headband colour. When it had to stack
// above other bubbles, a thin line leads back down to its speaker.
function drawBubble(ctx, w, c) {
  var b = c.bubble
  if (!b || b.x === undefined) return
  var band = Sim.bandColor(w, c)
  var x = b.x, y = b.y, bw = b.w, bh = b.h, r = 6
  var head = c.fy - c.H * 1.15 * (0.94 + 0.12 * Sim.physique(c))
  var tipX = Math.max(x + 10, Math.min(x + bw - 10, c.fx))
  var gap = head - (y + bh)
  ctx.save()
  if (gap > 16) {
    ctx.strokeStyle = band
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    seg(ctx, { x: tipX, y: y + bh + 6 }, { x: c.fx, y: head - 2 })
    ctx.setLineDash([])
  }
  ctx.fillStyle = tint(band, 0.86)
  ctx.strokeStyle = band
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + bw - r, y)
  ctx.quadraticCurveTo(x + bw, y, x + bw, y + r)
  ctx.lineTo(x + bw, y + bh - r)
  ctx.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh)
  ctx.lineTo(tipX + 5, y + bh)
  ctx.lineTo(tipX, y + bh + 7)
  ctx.lineTo(tipX - 4, y + bh)
  ctx.lineTo(x + r, y + bh)
  ctx.quadraticCurveTo(x, y + bh, x, y + bh - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#1c1c22"
  ctx.font = "bold 11px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  for (var i = 0; i < b.lines.length; i++) ctx.fillText(b.lines[i], x + bw / 2, y + 5 + i * 13)
  ctx.restore()
}

// A small health bar over the head, only when they're not at full health.
function drawHealth(ctx, w, c) {
  var r = Sim.hpRatio(c)
  if (r > 0.97 && !c.injured) return
  var bw = c.H * 0.6, bh = 3
  var x = c.fx - bw / 2
  var y = c.injured ? c.fy - c.H * 0.55 : c.fy - c.H * 1.3 * (0.94 + 0.12 * Sim.physique(c))
  ctx.fillStyle = "rgba(20,20,26,0.75)"
  ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2)
  ctx.fillStyle = r > 0.6 ? "#5cd16a" : (r > 0.3 ? "#f2c14e" : "#ff5a5a")
  ctx.fillRect(x, y, bw * r, bh)
}

// ---------------------------------------------------------------- demons

// Loose raid effects (banishments, smites).
function drawRaid(ctx, w) {
  if (w.raid) drawParts(ctx, w, w.raid.parts, Sim.sizeFor(w))
}

// One rift: a swirling purple tear standing on a window's floor.
function drawPortal(ctx, w, i) {
  var raid = w.raid
  var pt = raid && raid.portals[i]
  if (!pt) return
  var fl = Sim.floorOf(w, pt.home, pt.mon)
  var H = Sim.sizeFor(w)
  var px = fl.x0 + pt.rel, py = fl.y - H * 0.9
  var open = raid.over ? Math.max(0, 1 - (w.t - (raid.endAt - 2500)) / 2500) : Math.min(1, (raid.t - i * 300) / 900)
  if (open > 0) {
    var t = w.t / 1000
    ctx.save()
    ctx.globalAlpha = open
    ctx.fillStyle = "rgba(40,0,60,0.85)"
    ctx.beginPath()
    ctx.ellipse(px - H * 0.45 * open, py - H * 0.9, H * 0.9 * open, H * 1.8)
    ctx.fill()
    ctx.globalCompositeOperation = "lighter"
    for (var k = 0; k < 4; k++) {
      ctx.strokeStyle = "rgba(" + (170 + k * 20) + ",80,255," + (0.5 - k * 0.08) + ")"
      ctx.lineWidth = 2
      var wob = Math.sin(t * 3 + k + i) * H * 0.05
      ctx.beginPath()
      ctx.ellipse(px - (H * 0.45 + k * 4 + wob) * open, py - H * 0.9 - k * 3, (H * 0.9 + k * 8 + wob * 2) * open, H * 1.8 + k * 6)
      ctx.stroke()
    }
    ctx.restore()
  }
  drawParts(ctx, w, pt.parts || [], H)
}

// Imps are small, purple and horned with a spade tail; the oni is big,
// red, with wild white hair, a tiger-skin loincloth and an iron club.
function drawDemon(ctx, w, d) {
  var oni = d.kind === "oni"
  var sk = Rig.solve(Rig.poseAt(d.anim, w.t - d.animT0))
  var skin = oni ? "#c0392b" : "#6c2b8f", far = oni ? "#8e2a20" : "#4b1d63"
  var lw = oni ? 0.12 : 0.08, tw = oni ? 0.2 : 0.11
  ctx.save()
  ctx.translate(d.fx, d.fy)
  ctx.scale(d.facing * d.H, d.H)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  var glow = d.flash > 0 ? "rgba(255,255,255," + (0.6 + 0.4 * d.flash) + ")" : "rgba(20,10,30,0.9)"
  for (var pass = 0; pass < 2; pass++) {
    var o = pass === 0
    var ow = o ? 0.06 : 0
    var col = function (c) { return o ? glow : c }
    // Tail.
    if (!oni) {
      ctx.strokeStyle = col(far)
      ctx.lineWidth = 0.04 + ow
      ctx.beginPath()
      ctx.moveTo(sk.hip.x, sk.hip.y)
      ctx.quadraticCurveTo(sk.hip.x - 0.35, sk.hip.y + 0.05 + Math.sin(w.t / 200) * 0.05, sk.hip.x - 0.42, sk.hip.y - 0.2)
      ctx.stroke()
      if (!o) {
        ctx.fillStyle = far
        ctx.beginPath()
        ctx.moveTo(sk.hip.x - 0.42, sk.hip.y - 0.3); ctx.lineTo(sk.hip.x - 0.48, sk.hip.y - 0.18); ctx.lineTo(sk.hip.x - 0.36, sk.hip.y - 0.18)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.strokeStyle = col(far)
    ctx.lineWidth = lw + ow
    seg(ctx, sk.hip, sk.lknee); seg(ctx, sk.lknee, sk.lfoot)
    seg(ctx, sk.sh, sk.lelbow); seg(ctx, sk.lelbow, sk.lhand)
    ctx.strokeStyle = col(skin)
    seg(ctx, sk.hip, sk.rknee); seg(ctx, sk.rknee, sk.rfoot)
    ctx.lineWidth = tw + ow
    seg(ctx, sk.hip, sk.neck)
    ctx.fillStyle = col(skin)
    dot(ctx, sk.head, sk.headR * (oni ? 1.2 : 1) + ow / 2)
    // Horns.
    ctx.save()
    ctx.translate(sk.head.x, sk.head.y)
    ctx.rotate(sk.headA)
    ctx.fillStyle = col(oni ? "#f2e6c8" : "#e8d9ff")
    for (var hside = -1; hside <= 1; hside += 2) {
      ctx.beginPath()
      ctx.moveTo(hside * 0.05 - 0.02, -0.1)
      ctx.lineTo(hside * 0.09 - 0.02 + 0.03, -0.24 - (oni ? 0.04 : 0))
      ctx.lineTo(hside * 0.09 + 0.03, -0.09)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
    // Club (oni) in the near hand.
    if (oni && !o) {
      var ang = Math.atan2(sk.rhand.y - sk.relbow.y, sk.rhand.x - sk.relbow.x)
      ctx.save()
      ctx.translate(sk.rhand.x, sk.rhand.y)
      ctx.rotate(ang)
      ctx.strokeStyle = "#4a4f5c"
      ctx.lineWidth = 0.09
      seg(ctx, { x: -0.05, y: 0 }, { x: 0.5, y: 0 })
      ctx.fillStyle = "#9aa3b2"
      for (var st = 0; st < 4; st++) dot(ctx, { x: 0.18 + st * 0.1, y: (st % 2 ? 0.05 : -0.05) }, 0.02)
      ctx.restore()
    }
    ctx.strokeStyle = col(skin)
    ctx.lineWidth = lw + ow
    seg(ctx, sk.sh, sk.relbow); seg(ctx, sk.relbow, sk.rhand)
  }
  // Loincloth, hair, eyes.
  if (oni) {
    var hipMid = lerpPt(sk.neck, sk.hip, 0.9)
    ctx.fillStyle = "#f2b33d"
    ctx.fillRect(hipMid.x - 0.1, hipMid.y - 0.02, 0.2, 0.12)
    ctx.strokeStyle = "#1c1c22"
    ctx.lineWidth = 0.015
    seg(ctx, { x: hipMid.x - 0.06, y: hipMid.y - 0.02 }, { x: hipMid.x - 0.03, y: hipMid.y + 0.1 })
    seg(ctx, { x: hipMid.x + 0.04, y: hipMid.y - 0.02 }, { x: hipMid.x + 0.07, y: hipMid.y + 0.1 })
    ctx.save()
    ctx.translate(sk.head.x, sk.head.y)
    ctx.rotate(sk.headA)
    ctx.fillStyle = "#f4f1ea"
    for (var hh = 0; hh < 5; hh++) dot(ctx, { x: -0.1 + hh * 0.025 - 0.04, y: -0.1 + Math.abs(hh - 2) * 0.02 }, 0.05)
    ctx.restore()
  }
  ctx.save()
  ctx.translate(sk.head.x, sk.head.y)
  ctx.rotate(sk.headA)
  ctx.fillStyle = oni ? "#fff6a0" : "#ffe14a"
  dot(ctx, { x: 0.06, y: -0.02 }, oni ? 0.03 : 0.025)
  ctx.strokeStyle = "#1c1c22"
  ctx.lineWidth = 0.015
  ctx.beginPath()
  ctx.moveTo(0.02, 0.05); ctx.lineTo(0.05, 0.07); ctx.lineTo(0.08, 0.05); ctx.lineTo(0.11, 0.07)
  ctx.stroke()
  ctx.restore()
  ctx.restore()
  // Health bar.
  if (d.state === "fight" || d.state === "emerge") {
    var r = Math.max(0, d.hp / d.maxHp)
    var bw = d.H * 0.6
    var y = d.fy - d.H * 1.25
    ctx.fillStyle = "rgba(20,10,30,0.8)"
    ctx.fillRect(d.fx - bw / 2 - 1, y - 1, bw + 2, 5)
    ctx.fillStyle = "#b44dff"
    ctx.fillRect(d.fx - bw / 2, y, bw * r, 3)
  }
}

function drawDemonScene(ctx, w, d) {
  if (d.state === "dying") {
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - d.stateT / 1100)
    drawDemon(ctx, w, d)
    ctx.restore()
  } else drawDemon(ctx, w, d)
  drawParts(ctx, w, d.parts, d.H)
  drawBubble(ctx, w, d)
}

// ---------------------------------------------------------------- ninja scene

function drawScene(ctx, w, c) {
  if (c.visible && !c.inside) {
    drawPortableDummy(ctx, w, c)
    var sk = Rig.solve(Rig.poseAt(c.anim, w.t - c.animT0))
    if (c.clones) {
      for (var ci = 0; ci < c.clones.length; ci++) {
        ctx.save()
        ctx.globalAlpha = 0.55
        ctx.translate(c.clones[ci].dx, 0)
        drawFigure(ctx, w, c, sk)
        ctx.restore()
      }
    }
    if (!(c.hiddenUntil && w.t < c.hiddenUntil)) drawFigure(ctx, w, c, sk)
    drawHealth(ctx, w, c)
  }
  drawParts(ctx, w, c.parts, c.H)
  if (c.visible && !c.inside) drawBubble(ctx, w, c)
}

function drawDecor(ctx, w, monName) {
  var list = Sim.decorOn(w, monName)
  for (var i = 0; i < list.length; i++) drawShuriken(ctx, list[i].x, list[i].y, list[i].size, list[i].rot)
}

// ---------------------------------------------------------------- dojo

var WOOD = "#8b5a2b", WOOD_DARK = "#5e3b1c", TATAMI = "#cfc58e"
var PILLAR = "#b8322a", PILLAR_BACK = "#7f221c", ROOF = "#3b4252", ROOF_EDGE = "#1f232b"
var GOLD = "#e8b84a", INK = "#17181d", PAPER = "rgba(246,240,222,0.92)"

// How far along stage k is: 0 not started, 1 finished.
function part(d, k) {
  if (d.stage > k) return 1
  if (d.stage < k) return 0
  return d.progress / Sim.STAGES[k].work
}

function box(ctx, x, y, w, h, fill, stroke, lw) {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw || 1.2
    ctx.strokeRect(x, y, w, h)
  }
}

// A curved pagoda roof. Grows outward from the centre with `p`.
function roof(ctx, cx, yb, halfEave, halfTop, h, curl, H, p, ridge) {
  if (p <= 0) return
  ctx.save()
  var reveal = (halfEave + curl + 2) * p
  ctx.beginPath()
  ctx.rect(cx - reveal, yb - h - H, reveal * 2, h + H * 1.2)
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(cx - halfEave - curl, yb - curl * 0.9)
  ctx.quadraticCurveTo(cx - halfEave + H * 0.1, yb + H * 0.03, cx - halfEave + H * 0.5, yb)
  ctx.lineTo(cx + halfEave - H * 0.5, yb)
  ctx.quadraticCurveTo(cx + halfEave - H * 0.1, yb + H * 0.03, cx + halfEave + curl, yb - curl * 0.9)
  ctx.quadraticCurveTo(cx + halfTop + H * 0.7, yb - h * 0.35, cx + halfTop, yb - h)
  ctx.lineTo(cx - halfTop, yb - h)
  ctx.quadraticCurveTo(cx - halfTop - H * 0.7, yb - h * 0.35, cx - halfEave - curl, yb - curl * 0.9)
  ctx.closePath()
  ctx.fillStyle = ROOF
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = "rgba(255,255,255,0.09)"
  ctx.lineWidth = 1
  for (var x = cx - halfEave - curl; x < cx + halfEave + curl; x += H * 0.22) seg(ctx, { x: x, y: yb + 2 }, { x: x + (x - cx) * 0.25, y: yb - h - 2 })
  ctx.strokeStyle = "rgba(0,0,0,0.25)"
  seg(ctx, { x: cx - halfEave - curl, y: yb - h * 0.45 }, { x: cx + halfEave + curl, y: yb - h * 0.45 })
  ctx.restore()
  ctx.strokeStyle = ROOF_EDGE
  ctx.lineWidth = 1.6
  ctx.stroke()
  // Eave fascia.
  ctx.strokeStyle = WOOD_DARK
  ctx.lineWidth = Math.max(2, H * 0.06)
  seg(ctx, { x: cx - halfEave + H * 0.5, y: yb + H * 0.02 }, { x: cx + halfEave - H * 0.5, y: yb + H * 0.02 })
  if (ridge) {
    box(ctx, cx - halfTop - H * 0.15, yb - h - H * 0.12, (halfTop + H * 0.15) * 2, H * 0.12, ROOF_EDGE)
    ctx.fillStyle = GOLD
    dot(ctx, { x: cx - halfTop - H * 0.15, y: yb - h - H * 0.06 }, H * 0.06)
    dot(ctx, { x: cx + halfTop + H * 0.15, y: yb - h - H * 0.06 }, H * 0.06)
  }
  ctx.restore()
}

function pillar(ctx, x, yTop, yBot, wd, color, p) {
  if (p <= 0) return
  var top = yBot - (yBot - yTop) * p
  box(ctx, x - wd / 2, top, wd, yBot - top, color, INK, 1)
  ctx.fillStyle = "rgba(255,255,255,0.12)"
  ctx.fillRect(x - wd / 2 + 1, top, wd * 0.25, yBot - top)
}

// Paper sliding screens between two pillars.
function shoji(ctx, x0, x1, yTop, yBot, H, alpha) {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  box(ctx, x0, yTop, x1 - x0, yBot - yTop, PAPER, WOOD_DARK, 1)
  ctx.strokeStyle = "rgba(94,59,28,0.55)"
  ctx.lineWidth = 1
  for (var x = x0 + H * 0.3; x < x1 - 2; x += H * 0.3) seg(ctx, { x: x, y: yTop }, { x: x, y: yBot })
  for (var y = yTop + H * 0.35; y < yBot - 2; y += H * 0.35) seg(ctx, { x: x0, y: y }, { x: x1, y: y })
  ctx.restore()
}

function floorDeck(ctx, cx, y, half, thick, H, p) {
  if (p <= 0) return
  var hw = half * p
  box(ctx, cx - hw, y - thick, hw * 2, thick, WOOD, INK, 1.2)
  box(ctx, cx - hw, y - thick, hw * 2, thick * 0.32, TATAMI)
  ctx.strokeStyle = "rgba(60,50,20,0.35)"
  ctx.lineWidth = 1
  for (var x = cx - hw + H * 0.8; x < cx + hw; x += H * 0.8) seg(ctx, { x: x, y: y - thick }, { x: x, y: y - thick * 0.68 })
}

function lantern(ctx, x, y, H, t) {
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  seg(ctx, { x: x, y: y }, { x: x, y: y + H * 0.22 })
  var glow = 0.25 + 0.1 * Math.sin(t * 2.3 + x)
  ctx.fillStyle = "rgba(255,170,80," + glow + ")"
  dot(ctx, { x: x, y: y + H * 0.4 }, H * 0.32)
  ctx.fillStyle = "#e0392f"
  ctx.beginPath()
  ctx.ellipse(x - H * 0.13, y + H * 0.22, H * 0.26, H * 0.34)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.stroke()
  box(ctx, x - H * 0.07, y + H * 0.2, H * 0.14, H * 0.03, INK)
  box(ctx, x - H * 0.07, y + H * 0.54, H * 0.14, H * 0.03, INK)
}

function gong(ctx, x, gy, H, p, swing) {
  if (p <= 0) return
  var fp = Math.min(1, p * 2)
  ctx.lineCap = "butt"
  // Stand.
  ctx.strokeStyle = WOOD_DARK
  ctx.lineWidth = H * 0.08
  seg(ctx, { x: x - H * 0.5, y: gy }, { x: x - H * 0.5, y: gy - H * 1.65 * fp })
  seg(ctx, { x: x + H * 0.5, y: gy }, { x: x + H * 0.5, y: gy - H * 1.65 * fp })
  if (fp >= 1) seg(ctx, { x: x - H * 0.6, y: gy - H * 1.6 }, { x: x + H * 0.6, y: gy - H * 1.6 })
  if (p < 0.5) return
  var cy = gy - H * 1.05
  var dx = Math.sin(swing * 30) * swing * H * 0.08
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  seg(ctx, { x: x, y: gy - H * 1.6 }, { x: x + dx, y: cy - H * 0.36 })
  ctx.fillStyle = GOLD
  dot(ctx, { x: x + dx, y: cy }, H * 0.38)
  ctx.strokeStyle = "#8a6414"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x + dx, cy, H * 0.38, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + dx, cy, H * 0.18, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  dot(ctx, { x: x + dx - H * 0.13, y: cy - H * 0.13 }, H * 0.07)
  if (swing > 0) {
    ctx.strokeStyle = "rgba(242,193,78," + swing + ")"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x + dx, cy, H * (0.5 + (1 - swing) * 0.6), 0, Math.PI * 2)
    ctx.stroke()
  }
}

function rack(ctx, x, gy, H, p) {
  if (p <= 0) return
  ctx.strokeStyle = WOOD_DARK
  ctx.lineWidth = H * 0.06
  seg(ctx, { x: x - H * 0.6, y: gy }, { x: x - H * 0.6, y: gy - H * 1.1 })
  seg(ctx, { x: x + H * 0.6, y: gy }, { x: x + H * 0.6, y: gy - H * 1.1 })
  seg(ctx, { x: x - H * 0.7, y: gy - H * 0.95 }, { x: x + H * 0.7, y: gy - H * 0.95 })
  seg(ctx, { x: x - H * 0.7, y: gy - H * 0.35 }, { x: x + H * 0.7, y: gy - H * 0.35 })
  var n = Math.floor(p * 5)
  for (var i = 0; i < n; i++) {
    var sx = x - H * 0.45 + i * H * 0.22
    if (i % 2) {
      // Katana.
      ctx.strokeStyle = "#c8ccd4"
      ctx.lineWidth = H * 0.035
      seg(ctx, { x: sx, y: gy - H * 0.2 }, { x: sx + H * 0.06, y: gy - H * 1.25 })
      ctx.strokeStyle = INK
      ctx.lineWidth = H * 0.05
      seg(ctx, { x: sx, y: gy - H * 0.2 }, { x: sx + H * 0.015, y: gy - H * 0.45 })
    } else {
      // Bo staff.
      ctx.strokeStyle = "#a5703f"
      ctx.lineWidth = H * 0.045
      seg(ctx, { x: sx, y: gy - H * 0.05 }, { x: sx + H * 0.1, y: gy - H * 1.45 })
    }
  }
}

function tree(ctx, x, gy, H, p, t) {
  if (p <= 0) return
  var tp = Math.min(1, p * 2.2)
  ctx.lineCap = "round"
  ctx.strokeStyle = "#5a3a26"
  ctx.lineWidth = H * 0.16
  ctx.beginPath()
  ctx.moveTo(x, gy)
  ctx.quadraticCurveTo(x - H * 0.3, gy - H * 1.1 * tp, x + H * 0.1, gy - H * 2.0 * tp)
  ctx.stroke()
  if (tp >= 1) {
    ctx.lineWidth = H * 0.07
    seg(ctx, { x: x - H * 0.1, y: gy - H * 1.4 }, { x: x - H * 0.75, y: gy - H * 1.9 })
    seg(ctx, { x: x, y: gy - H * 1.6 }, { x: x + H * 0.7, y: gy - H * 2.05 })
  }
  var blossoms = [[-0.8, -2.0, 0.42], [0.1, -2.25, 0.55], [0.75, -2.1, 0.45], [-0.35, -2.45, 0.4], [0.45, -2.55, 0.38],
    [-1.0, -2.3, 0.3], [1.05, -2.35, 0.3], [0.0, -1.85, 0.35]]
  var n = Math.round(Math.max(0, (p - 0.4) / 0.6) * blossoms.length)
  for (var i = 0; i < n; i++) {
    var bl = blossoms[i]
    ctx.fillStyle = i % 2 ? "#f7b6c8" : "#f390ad"
    dot(ctx, { x: x + bl[0] * H, y: gy + bl[1] * H + Math.sin(t + i) * 1.2 }, bl[2] * H)
  }
}

function sign(ctx, cx, y, H, alpha) {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  seg(ctx, { x: cx - H * 0.4, y: y - H * 0.05 }, { x: cx - H * 0.4, y: y + H * 0.04 })
  seg(ctx, { x: cx + H * 0.4, y: y - H * 0.05 }, { x: cx + H * 0.4, y: y + H * 0.04 })
  box(ctx, cx - H * 0.75, y + H * 0.04, H * 1.5, H * 0.42, "#2b1d12", GOLD, 1.5)
  ctx.fillStyle = GOLD
  ctx.font = "bold " + Math.round(H * 0.28) + "px serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("道場", cx, y + H * 0.255)
  ctx.restore()
}

function railing(ctx, cx, y, half, H, p) {
  if (p <= 0) return
  ctx.strokeStyle = PILLAR
  ctx.lineWidth = Math.max(1.5, H * 0.045)
  var n = Math.round(p * 8)
  var span = half * 2
  for (var i = 0; i <= 8; i++) {
    if (i > n) break
    var x = cx - half + span * i / 8
    seg(ctx, { x: x, y: y }, { x: x, y: y - H * 0.38 })
  }
  var reach = cx - half + span * Math.min(1, n / 8)
  seg(ctx, { x: cx - half, y: y - H * 0.38 }, { x: reach, y: y - H * 0.38 })
  seg(ctx, { x: cx - half, y: y - H * 0.2 }, { x: reach, y: y - H * 0.2 })
}

function stakes(ctx, cx, gy, H, p) {
  var xs = [-3.2, -1.1, 1.1, 3.2]
  var n = Math.ceil(p * xs.length)
  ctx.strokeStyle = "#7a5230"
  ctx.lineWidth = Math.max(2, H * 0.06)
  for (var i = 0; i < n; i++) seg(ctx, { x: cx + xs[i] * H, y: gy }, { x: cx + xs[i] * H, y: gy - H * 0.5 })
  ctx.strokeStyle = "#d9c9a0"
  ctx.lineWidth = 1.2
  for (var j = 0; j + 1 < n; j++) {
    var a = cx + xs[j] * H, b = cx + xs[j + 1] * H
    ctx.beginPath()
    ctx.moveTo(a, gy - H * 0.45)
    ctx.quadraticCurveTo((a + b) / 2, gy - H * 0.3, b, gy - H * 0.45)
    ctx.stroke()
  }
}

function drawDojo(ctx, w) {
  var d = w.dojo
  if (!d || !d.visible) return
  var b = Sim.dojoBase(w)
  if (!b) return
  var H = Sim.sizeFor(w)
  var cx = b.x, gy = b.y
  var t = w.t / 1000
  var s = d.stage
  var T = Sim.TIERS
  var pack = d.pack || 0
  if (pack >= 1) { drawParts(ctx, w, w.dojoParts, H); return }
  ctx.save()
  if (pack > 0) {
    // Fold down into the floor.
    ctx.translate(cx, gy)
    ctx.scale(1 - pack * 0.35, 1 - pack)
    ctx.translate(-cx, -gy)
  }
  ctx.globalAlpha = (d.alpha === undefined ? 1 : d.alpha) * (1 - pack * 0.6)

  tree(ctx, cx + H * 4.5, gy, H, part(d, Sim.S_TREE), t)
  if (s <= Sim.S_PILLARS) stakes(ctx, cx, gy, H, part(d, 0))

  // Ground floor.
  var pP = part(d, Sim.S_PILLARS)
  pillar(ctx, cx - H * 1.0, gy - H * 2.3, gy, H * 0.18, PILLAR_BACK, Math.max(0, Math.min(1, pP * 4 - 2)))
  pillar(ctx, cx + H * 1.0, gy - H * 2.3, gy, H * 0.18, PILLAR_BACK, Math.max(0, Math.min(1, pP * 4 - 3)))
  rack(ctx, cx + H * 0.1, gy - H * 0.18, H, part(d, Sim.S_RACK))
  floorDeck(ctx, cx, gy, T[0].half * H + H * 0.1, H * 0.18, H, part(d, Sim.S_FLOOR))
  pillar(ctx, cx - H * 2.9, gy - H * 2.3, gy, H * 0.24, PILLAR, Math.min(1, pP * 4))
  pillar(ctx, cx + H * 2.9, gy - H * 2.3, gy, H * 0.24, PILLAR, Math.max(0, Math.min(1, pP * 4 - 1)))
  var pB = part(d, Sim.S_BEAMS)
  if (pB > 0) {
    var bw = H * 3.15 * pB
    box(ctx, cx - bw, gy - H * 2.46, bw * 2, H * 0.16, WOOD_DARK, INK, 1)
    box(ctx, cx - bw * 0.92, gy - H * 1.95, bw * 1.84, H * 0.08, WOOD, INK, 1)
  }

  // Upper tiers sit on top of the roof below them.
  var y2 = gy - T[1].y * H, y3 = gy - T[2].y * H
  roof(ctx, cx, gy - H * 2.46, H * 3.75, H * 2.0, H * 0.5, H * 0.32, H, part(d, Sim.S_ROOF), s < Sim.S_FLOOR2)
  sign(ctx, cx, gy - H * 2.3, H, part(d, Sim.S_SIGN))
  var pL = part(d, Sim.S_LANTERNS)
  if (pL > 0) lantern(ctx, cx - H * 3.45, gy - H * 2.42, H, t)
  if (pL >= 0.5) lantern(ctx, cx + H * 3.45, gy - H * 2.42, H, t)

  var pF2 = part(d, Sim.S_FLOOR2)
  if (pF2 > 0) {
    floorDeck(ctx, cx, y2, T[1].half * H + H * 0.1, H * 0.14, H, Math.min(1, pF2 * 2.5))
    var pp2 = Math.max(0, Math.min(1, pF2 * 2 - 0.6))
    shoji(ctx, cx - H * 1.95, cx + H * 1.95, y2 - H * 1.9, y2 - H * 0.14, H, Math.max(0, pF2 * 2 - 1.2))
    pillar(ctx, cx - H * 2.1, y2 - H * 1.95, y2 - H * 0.14, H * 0.2, PILLAR, pp2)
    pillar(ctx, cx + H * 2.1, y2 - H * 1.95, y2 - H * 0.14, H * 0.2, PILLAR, pp2)
    pillar(ctx, cx, y2 - H * 1.95, y2 - H * 0.14, H * 0.16, PILLAR, pp2)
  }
  railing(ctx, cx, y2 - H * 0.14, T[1].half * H + H * 0.05, H, part(d, Sim.S_BALCONY))
  roof(ctx, cx, y2 - H * 2.0, H * 2.9, H * 1.45, H * 0.5, H * 0.28, H, part(d, Sim.S_ROOF2), s < Sim.S_FLOOR3)

  var pF3 = part(d, Sim.S_FLOOR3)
  if (pF3 > 0) {
    floorDeck(ctx, cx, y3, T[2].half * H + H * 0.1, H * 0.12, H, Math.min(1, pF3 * 2.5))
    var pp3 = Math.max(0, Math.min(1, pF3 * 2 - 0.6))
    shoji(ctx, cx - H * 1.25, cx + H * 1.25, y3 - H * 1.55, y3 - H * 0.12, H, Math.max(0, pF3 * 2 - 1.2))
    pillar(ctx, cx - H * 1.4, y3 - H * 1.6, y3 - H * 0.12, H * 0.18, PILLAR, pp3)
    pillar(ctx, cx + H * 1.4, y3 - H * 1.6, y3 - H * 0.12, H * 0.18, PILLAR, pp3)
  }
  roof(ctx, cx, y3 - H * 1.65, H * 2.15, H * 0.35, H * 0.75, H * 0.26, H, part(d, Sim.S_ROOF3), s >= Sim.S_ROOF3 && s < Sim.S_SPIRE)

  var pS = part(d, Sim.S_SPIRE)
  if (pS > 0) {
    var top = y3 - H * 1.65 - H * 0.75
    var len = H * 1.2 * pS
    ctx.strokeStyle = GOLD
    ctx.lineWidth = Math.max(2, H * 0.06)
    seg(ctx, { x: cx, y: top }, { x: cx, y: top - len })
    ctx.fillStyle = GOLD
    for (var r = 0; r < 4; r++) {
      var ry = top - H * 0.2 - r * H * 0.2
      if (ry < top - len) break
      ctx.beginPath()
      ctx.ellipse(cx - H * (0.18 - r * 0.02), ry - H * 0.03, H * (0.36 - r * 0.04), H * 0.06)
      ctx.fill()
    }
    if (pS >= 1) dot(ctx, { x: cx, y: top - len - H * 0.08 }, H * 0.1)
  }

  // Training gear in front.
  var pD = part(d, Sim.S_DUMMY)
  if (pD > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, pD * 1.5)
    woodenDummy(ctx, cx - H * 1.9, gy - H * 0.18, H * 1.3, (d.dummyWob || 0) * Math.sin(t * 22) * 0.25)
    ctx.restore()
  }
  gong(ctx, cx + H * 2.0, gy - H * 0.18, H, part(d, Sim.S_GONG), d.gong || 0)

  // Progress marker while building.
  if (!d.done) {
    var st = Sim.STAGES[s]
    var label = st.name + " " + d.progress + "/" + st.work
    ctx.font = "bold 10px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineWidth = 3
    ctx.strokeStyle = "rgba(20,20,26,0.8)"
    var ly = gy - H * 0.55
    ctx.strokeText(label, cx, ly)
    ctx.fillStyle = "#f3efe0"
    ctx.fillText(label, cx, ly)
  }

  ctx.restore()
  ctx.globalAlpha = 1
  drawParts(ctx, w, w.dojoParts, H)
}
