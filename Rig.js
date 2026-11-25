.pragma library

// Stick-figure skeleton and pose library for the critters.
//
// A pose is a bag of joint angles in degrees. The skeleton is solved in
// figure units (1.0 = full standing height), with x pointing the way the
// critter faces and y pointing down, then auto-grounded so the lowest body
// point touches the floor unless the pose says it is airborne (`free`).
//
// Angles:
//   torso, head   lean from vertical, + forward
//   lh/rh         thigh angle from straight down, + forward
//   lk/rk         knee bend, + folds the shin backward
//   ls/rs         upper arm from straight down (relative to the torso), + forward
//   le/re         elbow bend, + folds the forearm forward/up
//   rot           whole-body rotation around the hip, + tips forward
//   lift          height above the ground, in figure units
//   sx            forward shift, in figure units
// "l" limbs are the far side (drawn behind), "r" limbs the near side.

var DEG = Math.PI / 180

var BASE = {
  torso: 0, head: 0,
  lh: 0, lk: 0, rh: 0, rk: 0,
  ls: -8, le: 12, rs: 8, re: 12,
  rot: 0, lift: 0, sx: 0,
  face: "normal", free: false
}

function P(o) {
  var p = {}
  for (var k in BASE) p[k] = BASE[k]
  for (var k2 in o) p[k2] = o[k2]
  return p
}

// Shared building blocks.
var GUARD_A = P({ torso: 10, lh: 28, lk: 45, rh: -18, rk: 25, ls: 75, le: 85, rs: 45, re: 110 })
var GUARD_B = P({ torso: 12, lh: 30, lk: 52, rh: -18, rk: 32, ls: 72, le: 88, rs: 42, re: 112, head: 3 })
var CROUCH = P({ torso: 25, lh: 60, lk: 110, rh: 55, rk: 105, ls: 30, le: 30, rs: 40, re: 30 })
var TUCK = P({ free: true, lift: 0.55, torso: 30, lh: 100, lk: 150, rh: 95, rk: 150, ls: 60, le: 90, rs: 70, re: 90 })

function walkFrames(o) {
  o = o || {}
  var lean = o.lean || 4
  var sw = o.swing || 24
  var arm = o.arm === undefined ? sw * 0.8 : o.arm
  var armsUp = o.armsUp
  function arms(phase) {
    if (armsUp) return { ls: 168, le: 20, rs: 172, re: 18 }
    return { ls: -arm * phase, le: 18, rs: arm * phase, re: 18 }
  }
  function f(a, b, phase, bob) {
    var p = { torso: lean, lh: a, lk: a < 0 ? sw * 0.9 : 8, rh: b, rk: b < 0 ? sw * 0.9 : 8, lift: bob }
    var ar = arms(phase)
    for (var k in ar) p[k] = ar[k]
    for (var k2 in (o.extra || {})) p[k2] = o.extra[k2]
    return P(p)
  }
  return [f(sw, -sw, 1, 0), f(0, 0, 0, 0.02), f(-sw, sw, -1, 0), f(0, 0, 0, 0.02)]
}

var ANIMS = {
  stand: { seg: 1100, loop: true, frames: [P({}), P({ torso: 2, ls: -10, rs: 10, le: 16, re: 16 })] },
  walk: { seg: 140, loop: true, ease: "linear", frames: walkFrames() },
  run: { seg: 95, loop: true, ease: "linear", frames: walkFrames({ lean: 16, swing: 40, arm: 50 }) },
  pace: { seg: 190, loop: true, ease: "linear", frames: walkFrames({ swing: 16, extra: { ls: -35, le: 80, rs: -40, re: 80, torso: 8, head: 8 } }) },
  carry: { seg: 160, loop: true, ease: "linear", frames: walkFrames({ swing: 18, armsUp: true, lean: 0 }) },

  guard: { seg: 420, loop: true, frames: [GUARD_A, GUARD_B] },
  punch: { segs: [90, 140, 160], frames: [GUARD_A,
    P({ torso: 18, lh: 32, lk: 30, rh: -30, rk: 10, ls: 60, le: 100, rs: 95, re: 0, sx: 0.06 }),
    P({ torso: 18, lh: 32, lk: 30, rh: -30, rk: 10, ls: 60, le: 100, rs: 95, re: 0, sx: 0.06 }),
    GUARD_A] },
  punch2: { segs: [90, 140, 160], frames: [GUARD_B,
    P({ torso: 20, lh: 30, lk: 35, rh: -28, rk: 10, ls: 95, le: 0, rs: 50, re: 110, sx: 0.06 }),
    P({ torso: 20, lh: 30, lk: 35, rh: -28, rk: 10, ls: 95, le: 0, rs: 50, re: 110, sx: 0.06 }),
    GUARD_A] },
  kick: { segs: [130, 120, 220, 200], frames: [GUARD_A,
    P({ torso: -5, lh: -5, lk: 10, rh: 70, rk: 100, ls: 70, le: 90, rs: 40, re: 100 }),
    P({ torso: -25, lh: -8, lk: 5, rh: 105, rk: 0, ls: 60, le: 80, rs: -40, re: 30 }),
    P({ torso: -25, lh: -8, lk: 5, rh: 105, rk: 0, ls: 60, le: 80, rs: -40, re: 30 }),
    GUARD_A] },
  backflip: { segs: [160, 170, 170, 170, 200], frames: [CROUCH,
    P({ free: true, lift: 0.35, torso: -10, lh: 10, lk: 20, rh: 5, rk: 20, ls: 200, le: 10, rs: 160, re: 10, rot: 0 }),
    P({ free: true, lift: 0.75, torso: 30, lh: 100, lk: 150, rh: 95, rk: 150, ls: 60, le: 90, rs: 70, re: 90, rot: -180 }),
    P({ free: true, lift: 0.35, torso: 10, lh: 20, lk: 30, rh: 15, rk: 30, ls: 120, le: 20, rs: 130, re: 20, rot: -330 }),
    P({ torso: 25, lh: 60, lk: 110, rh: 55, rk: 105, ls: 30, le: 30, rs: 40, re: 30, rot: -360 }),
    P({ torso: 10, lh: 28, lk: 45, rh: -18, rk: 25, ls: 75, le: 85, rs: 45, re: 110, rot: -360 })] },
  tuck: { seg: 110, loop: true, ease: "linear", frames: [
    P({ free: true, torso: 30, lh: 100, lk: 150, rh: 95, rk: 150, ls: 60, le: 90, rs: 70, re: 90, rot: 0 }),
    P({ free: true, torso: 30, lh: 100, lk: 150, rh: 95, rk: 150, ls: 60, le: 90, rs: 70, re: 90, rot: 120 }),
    P({ free: true, torso: 30, lh: 100, lk: 150, rh: 95, rk: 150, ls: 60, le: 90, rs: 70, re: 90, rot: 240 }),
    P({ free: true, torso: 30, lh: 100, lk: 150, rh: 95, rk: 150, ls: 60, le: 90, rs: 70, re: 90, rot: 360 })] },
  jumpArms: { seg: 260, loop: true, frames: [
    P({ free: true, torso: -8, lh: 30, lk: 60, rh: -20, rk: 50, ls: 205, le: 20, rs: 148, re: 15 }),
    P({ free: true, torso: -8, lh: 20, lk: 50, rh: -10, rk: 40, ls: 198, le: 15, rs: 155, re: 20 })] },
  superhero: { segs: [180, 700, 350], frames: [
    P({ torso: 45, lh: 75, lk: 140, rh: -50, rk: 100, ls: 20, le: 20, rs: -55, re: 0, face: "happy" }),
    P({ torso: 40, lh: 75, lk: 140, rh: -50, rk: 100, ls: 20, le: 20, rs: -55, re: 0, head: -15, face: "happy" }),
    P({ torso: 40, lh: 75, lk: 140, rh: -50, rk: 100, ls: 20, le: 20, rs: -55, re: 0, head: -15, face: "happy" }),
    GUARD_A] },
  pushup: { seg: 380, loop: true, frames: [
    P({ rot: 76, torso: 0, lh: 0, lk: 0, rh: 0, rk: 0, ls: 76, le: 0, rs: 76, re: 0, face: "focus" }),
    P({ rot: 84, torso: 0, lh: 0, lk: 0, rh: 0, rk: 0, ls: -55, le: 138, rs: -55, re: 138, face: "focus" })] },
  meditate: { seg: 1600, loop: true, frames: [
    P({ free: true, lift: 0.08, torso: 0, lh: 85, lk: 165, rh: 80, rk: 160, ls: 25, le: 60, rs: 22, re: 65, face: "closed" }),
    P({ free: true, lift: 0.2, torso: -2, lh: 85, lk: 165, rh: 80, rk: 160, ls: 28, le: 62, rs: 25, re: 66, face: "closed" })] },
  crane: { seg: 700, loop: true, frames: [
    P({ torso: 0, lh: 0, lk: 0, rh: 75, rk: 120, ls: 120, le: 10, rs: 95, re: 60, face: "focus" }),
    P({ torso: 3, lh: 0, lk: 3, rh: 78, rk: 120, ls: 125, le: 12, rs: 92, re: 64, face: "focus" })] },
  throw: { segs: [200, 120, 260], frames: [
    P({ torso: -12, lh: 20, lk: 20, rh: -25, rk: 10, ls: 50, le: 30, rs: 150, re: 60 }),
    P({ torso: 22, lh: 25, lk: 25, rh: -30, rk: 10, ls: -20, le: 20, rs: 85, re: 0, sx: 0.05 }),
    P({ torso: 22, lh: 25, lk: 25, rh: -30, rk: 10, ls: -20, le: 20, rs: 85, re: 0, sx: 0.05 }),
    GUARD_A] },

  bend: { seg: 900, loop: true, frames: [
    P({ torso: 70, lh: 15, lk: 30, rh: 10, rk: 25, ls: -40, le: 20, rs: -50, re: 25 }),
    P({ torso: 74, lh: 15, lk: 32, rh: 10, rk: 27, ls: -38, le: 22, rs: -46, re: 30, head: -10 })] },
  place: { segs: [260, 260, 240], frames: [
    P({ ls: 168, le: 20, rs: 172, re: 18 }),
    P({ torso: 6, ls: 120, le: 10, rs: 125, re: 10, sx: 0.04 }),
    P({ torso: 4, ls: 95, le: 20, rs: 100, re: 20 }),
    P({})] },
  toss: { segs: [180, 140, 300], frames: [
    P({ torso: 8, lh: 15, lk: 40, rh: 10, rk: 40, ls: 195, le: 40, rs: 158, re: 40 }),
    P({ free: true, lift: 0.12, torso: -6, lh: 0, lk: 0, rh: 0, rk: 0, ls: 200, le: 0, rs: 155, re: 0 }),
    P({ torso: -4, ls: 195, le: 10, rs: 160, re: 10 }),
    P({})] },
  hammer: { seg: 170, loop: true, frames: [
    P({ torso: 40, lh: 40, lk: 70, rh: 10, rk: 30, ls: 20, le: 30, rs: 150, re: 30 }),
    P({ torso: 46, lh: 40, lk: 72, rh: 10, rk: 32, ls: 20, le: 30, rs: 40, re: 10 })] },
  wave: { seg: 240, loop: true, frames: [
    P({ face: "happy", rs: 140, re: 25, ls: -8 }),
    P({ face: "happy", rs: 128, re: -15, ls: -8, head: 4 })] },
  celebrate: { seg: 240, loop: true, frames: [
    P({ face: "happy", ls: 205, le: 10, rs: 150, re: 10 }),
    P({ face: "happy", free: true, lift: 0.18, ls: 215, le: 20, rs: 140, re: 5, lh: 15, lk: 40, rh: -10, rk: 40 })] },
  slump: { seg: 1400, loop: true, frames: [
    P({ face: "sad", torso: 22, head: 22, ls: -2, le: 0, rs: 2, re: 0, lh: 4, lk: 10, rh: 2, rk: 8 }),
    P({ face: "sad", torso: 25, head: 25, ls: -2, le: 0, rs: 2, re: 0, lh: 4, lk: 12, rh: 2, rk: 10 })] },
  shock: { seg: 300, loop: true, frames: [
    P({ face: "surprised", torso: -12, head: -8, ls: 120, le: 60, rs: 110, re: 60, lift: 0.04 }),
    P({ face: "surprised", torso: -10, head: -6, ls: 125, le: 55, rs: 115, re: 55 })] },
  sit: { seg: 1500, loop: true, frames: [
    P({ torso: -6, lh: 85, lk: 80, rh: 90, rk: 95, ls: 30, le: 40, rs: 35, re: 45 }),
    P({ torso: -4, lh: 85, lk: 80, rh: 90, rk: 95, ls: 30, le: 42, rs: 35, re: 47, head: 3 })] },
  coffee: { seg: 1300, loop: true, frames: [
    P({ torso: -6, lh: 85, lk: 80, rh: 90, rk: 95, ls: 30, le: 40, rs: 40, re: 70 }),
    P({ torso: -10, head: -14, lh: 85, lk: 80, rh: 90, rk: 95, ls: 30, le: 40, rs: 60, re: 115, face: "closed" })] },
  sleep: { seg: 1800, loop: true, frames: [
    P({ face: "closed", rot: -88, torso: 0, ls: 150, le: 60, rs: 10, re: 20, lh: 10, lk: 30, rh: 0, rk: 5 }),
    P({ face: "closed", rot: -86, torso: 2, ls: 150, le: 62, rs: 10, re: 22, lh: 10, lk: 30, rh: 0, rk: 5 })] },
  fallen: { seg: 500, loop: true, frames: [
    P({ face: "dizzy", rot: -84, torso: 4, ls: 110, le: 20, rs: 70, re: 30, lh: 25, lk: 40, rh: -5, rk: 10 }),
    P({ face: "dizzy", rot: -86, torso: 6, ls: 115, le: 25, rs: 65, re: 35, lh: 25, lk: 40, rh: -5, rk: 10, head: 8 })] },
  dizzy: { seg: 300, loop: true, frames: [
    P({ face: "dizzy", torso: 6, head: 12, ls: -20, rs: 25, lh: 5, rh: -5 }),
    P({ face: "dizzy", torso: -6, head: -12, ls: -25, rs: 20, lh: -5, rh: 5 })] },
  stretch: { seg: 700, loop: true, frames: [
    P({ face: "closed", torso: -10, head: -10, ls: 200, le: 5, rs: 155, re: 5 }),
    P({ face: "closed", torso: -14, head: -14, ls: 206, le: 0, rs: 150, re: 0, lift: 0.02 })] },
  brow: { seg: 400, loop: true, frames: [
    P({ face: "closed", rs: 120, re: 110, ls: -10 }),
    P({ face: "closed", rs: 128, re: 100, ls: -10, head: 4 })] },
  admire: { seg: 900, loop: true, frames: [
    P({ face: "happy", torso: -6, head: -18, ls: -30, le: 90, rs: -35, re: 95 }),
    P({ face: "happy", torso: -8, head: -22, ls: -30, le: 92, rs: -35, re: 97 })] },
  thumbsup: { seg: 600, loop: true, frames: [
    P({ face: "happy", rs: 80, re: 80, ls: -10 }),
    P({ face: "happy", rs: 84, re: 84, ls: -10, head: 4 })] },

  think: { seg: 900, loop: true, frames: [
    P({ head: 8, rs: 35, re: 140, ls: 15, le: 100 }),
    P({ head: 12, rs: 38, re: 142, ls: 15, le: 100, torso: 3 })] },
  write: { seg: 160, loop: true, frames: [
    P({ head: 14, torso: 4, ls: 45, le: 70, rs: 40, re: 75 }),
    P({ head: 14, torso: 4, ls: 45, le: 70, rs: 46, re: 66 })] },
  knock: { seg: 140, loop: true, frames: [
    P({ torso: 6, rs: 75, re: 60, ls: -10 }),
    P({ torso: 8, rs: 80, re: 15, ls: -10, sx: 0.02 })] },
  listen: { seg: 900, loop: true, frames: [
    P({ torso: 15, head: -25, rs: 90, re: 80, ls: -10, face: "closed" }),
    P({ torso: 16, head: -28, rs: 92, re: 80, ls: -10, face: "closed" })] },
  push: { seg: 260, loop: true, frames: [
    P({ face: "focus", torso: 35, lh: -10, lk: 10, rh: -40, rk: 5, ls: 60, le: 20, rs: 65, re: 15 }),
    P({ face: "focus", torso: 38, lh: -40, lk: 5, rh: -10, rk: 10, ls: 58, le: 22, rs: 62, re: 18 })] },
  measure: { seg: 700, loop: true, frames: [
    P({ torso: 4, ls: 80, le: 5, rs: 82, re: 5 }),
    P({ torso: 6, ls: 82, le: 5, rs: 84, re: 5, head: 5 })] },
  magnify: { seg: 900, loop: true, frames: [
    P({ torso: 60, lh: 20, lk: 40, rh: 15, rk: 35, ls: -30, le: 60, rs: 20, re: 30, head: -10 }),
    P({ torso: 64, lh: 20, lk: 42, rh: 15, rk: 37, ls: -30, le: 60, rs: 26, re: 30, head: -14 })] },
  reach: { segs: [140, 160, 160, 220], frames: [
    P({ torso: 8, lh: 40, lk: 80, rh: 35, rk: 75, ls: 20, le: 20, rs: 30, re: 20 }),
    P({ free: true, lift: 0.5, ls: 196, le: 0, rs: 160, re: 0, lh: 0, lk: 10, rh: -5, rk: 10, face: "surprised" }),
    P({ free: true, lift: 0.3, ls: 192, le: 10, rs: 165, re: 10, lh: 5, lk: 20, rh: 0, rk: 20, face: "dizzy" }),
    P({ torso: 8, lh: 30, lk: 60, rh: 25, rk: 55, ls: 20, le: 20, rs: 30, re: 20, face: "dizzy" }),
    P({ face: "dizzy" })] },
  idea: { seg: 260, loop: true, frames: [
    P({ face: "surprised", torso: -8, rs: 140, re: 30, ls: -15 }),
    P({ face: "surprised", torso: -8, rs: 146, re: 20, ls: -15, lift: 0.03 })] },

  bow: { segs: [280, 650, 300], frames: [
    P({}),
    P({ torso: 48, head: 12, ls: -45, le: 5, rs: -45, re: 5, face: "closed" }),
    P({ torso: 48, head: 12, ls: -45, le: 5, rs: -45, re: 5, face: "closed" }),
    P({})] },
  block: { segs: [90, 200, 150], frames: [GUARD_A,
    P({ torso: -10, head: -6, lh: 20, lk: 40, rh: -30, rk: 30, ls: 115, le: 95, rs: 125, re: 100, sx: -0.04 }),
    P({ torso: -10, head: -6, lh: 20, lk: 40, rh: -30, rk: 30, ls: 115, le: 95, rs: 125, re: 100, sx: -0.04 }),
    GUARD_A] },
  hit: { segs: [90, 230, 160], frames: [GUARD_A,
    P({ face: "dizzy", torso: -28, head: -22, lh: 25, lk: 30, rh: -35, rk: 15, ls: -50, le: 30, rs: -70, re: 20, sx: -0.12 }),
    P({ face: "dizzy", torso: -20, head: -12, lh: 20, lk: 35, rh: -25, rk: 20, ls: -30, le: 40, rs: -40, re: 40, sx: -0.08 }),
    GUARD_A] },
  victory: { seg: 900, loop: true, frames: [
    P({ face: "happy", torso: -4, head: -10, ls: 55, le: 115, rs: 50, re: 120 }),
    P({ face: "happy", torso: -6, head: -13, ls: 57, le: 115, rs: 52, re: 120, lift: 0.01 })] },
  seiza: { seg: 1600, loop: true, frames: [
    P({ torso: 2, lh: 85, lk: 165, rh: 80, rk: 160, ls: 20, le: 50, rs: 18, re: 55 }),
    P({ torso: 4, head: 4, lh: 85, lk: 165, rh: 80, rk: 160, ls: 20, le: 52, rs: 18, re: 57 })] },

  uppercut: { segs: [160, 110, 200, 180], frames: [GUARD_A,
    P({ torso: 25, lh: 50, lk: 90, rh: 30, rk: 70, ls: 60, le: 100, rs: 20, re: 120 }),
    P({ torso: -12, lh: 10, lk: 15, rh: -20, rk: 10, ls: 60, le: 100, rs: 165, re: 10, lift: 0.06, sx: 0.05 }),
    P({ torso: -12, lh: 10, lk: 15, rh: -20, rk: 10, ls: 60, le: 100, rs: 165, re: 10, lift: 0.06, sx: 0.05 }),
    GUARD_A] },
  palm: { segs: [180, 100, 260, 200], frames: [GUARD_A,
    P({ torso: -6, lh: 25, lk: 40, rh: -25, rk: 20, ls: 40, le: 120, rs: 40, re: 120 }),
    P({ torso: 18, lh: 30, lk: 25, rh: -35, rk: 5, ls: 88, le: 0, rs: 92, re: 0, sx: 0.1 }),
    P({ torso: 18, lh: 30, lk: 25, rh: -35, rk: 5, ls: 88, le: 0, rs: 92, re: 0, sx: 0.1 }),
    GUARD_A] },
  sweep: { segs: [180, 260, 200, 220], frames: [GUARD_A,
    P({ torso: 30, lh: 75, lk: 145, rh: -40, rk: 20, ls: 40, le: 40, rs: -30, re: 20 }),
    P({ torso: 30, lh: 75, lk: 145, rh: 85, rk: 0, ls: 40, le: 40, rs: -30, re: 20 }),
    P({ torso: 26, lh: 75, lk: 145, rh: 90, rk: 0, ls: 50, le: 30, rs: -40, re: 20 }),
    GUARD_A] },
  flyingKick: { segs: [180, 200, 230, 200, 200], frames: [CROUCH,
    P({ free: true, lift: 0.35, torso: -5, lh: 60, lk: 110, rh: 40, rk: 80, ls: 120, le: 30, rs: 60, re: 40 }),
    P({ free: true, lift: 0.55, torso: -20, lh: 40, lk: 120, rh: 95, rk: 0, ls: -40, le: 20, rs: 150, re: 20, sx: 0.15 }),
    P({ free: true, lift: 0.25, torso: -10, lh: 30, lk: 60, rh: 60, rk: 40, ls: 60, le: 40, rs: 90, re: 40, sx: 0.2 }),
    P({ torso: 25, lh: 60, lk: 110, rh: 55, rk: 105, ls: 30, le: 30, rs: 40, re: 30, sx: 0.2 }),
    GUARD_A] },
  spinKick: { segs: [150, 140, 160, 220, 200], frames: [GUARD_A,
    P({ torso: 20, lh: 10, lk: 15, rh: -40, rk: 50, ls: 120, le: 60, rs: -60, re: 30, head: 20 }),
    P({ torso: -30, lh: -5, lk: 5, rh: 90, rk: 60, ls: -40, le: 30, rs: 150, re: 40 }),
    P({ torso: -38, lh: -10, lk: 5, rh: 125, rk: 0, ls: -60, le: 20, rs: 160, re: 30 }),
    P({ torso: -20, lh: -5, lk: 10, rh: 80, rk: 60, ls: 30, le: 60, rs: 90, re: 60 }),
    GUARD_A] },
  handstand: { seg: 600, loop: true, frames: [
    P({ face: "focus", rot: 180, torso: 0, lh: 6, lk: 0, rh: -6, rk: 0, ls: 180, le: 0, rs: 180, re: 0 }),
    P({ face: "focus", rot: 184, torso: 2, lh: 10, lk: 8, rh: -2, rk: 0, ls: 182, le: 0, rs: 178, re: 0 }),
    P({ face: "focus", rot: 176, torso: -2, lh: 2, lk: 0, rh: -10, rk: 8, ls: 178, le: 0, rs: 182, re: 0 })] },
  cartwheel: { seg: 120, loop: true, ease: "linear", frames: [
    P({ rot: 0, lh: 30, lk: 0, rh: -30, rk: 0, ls: 150, le: 0, rs: 210, re: 0 }),
    P({ rot: 90, lh: 30, lk: 0, rh: -30, rk: 0, ls: 150, le: 0, rs: 210, re: 0 }),
    P({ rot: 180, lh: 30, lk: 0, rh: -30, rk: 0, ls: 150, le: 0, rs: 210, re: 0 }),
    P({ rot: 270, lh: 30, lk: 0, rh: -30, rk: 0, ls: 150, le: 0, rs: 210, re: 0 }),
    P({ rot: 360, lh: 30, lk: 0, rh: -30, rk: 0, ls: 150, le: 0, rs: 210, re: 0 })] },
  split: { seg: 900, loop: true, frames: [
    P({ face: "focus", torso: 0, lh: 90, lk: 0, rh: -90, rk: 0, ls: 100, le: 0, rs: 80, re: 0 }),
    P({ face: "focus", torso: 4, lh: 90, lk: 0, rh: -90, rk: 0, ls: 105, le: 0, rs: 75, re: 0, head: 5 })] },
  sword: { segs: [300, 160, 260, 160, 300, 200], frames: [
    P({ torso: 0, lh: 25, lk: 30, rh: -25, rk: 20, ls: 150, le: 20, rs: 160, re: 20 }),
    P({ torso: 18, lh: 30, lk: 30, rh: -30, rk: 15, ls: 70, le: 10, rs: 75, re: 5, sx: 0.06 }),
    P({ torso: 18, lh: 30, lk: 30, rh: -30, rk: 15, ls: 70, le: 10, rs: 75, re: 5, sx: 0.06 }),
    P({ torso: 10, lh: 40, lk: 50, rh: -35, rk: 20, ls: 85, le: 0, rs: 90, re: 0, sx: 0.12 }),
    P({ torso: 10, lh: 40, lk: 50, rh: -35, rk: 20, ls: 85, le: 0, rs: 90, re: 0, sx: 0.12 }),
    P({ torso: 0, lh: 25, lk: 30, rh: -25, rk: 20, ls: 40, le: 60, rs: 30, re: 70 }),
    P({ torso: 0, lh: 25, lk: 30, rh: -25, rk: 20, ls: 150, le: 20, rs: 160, re: 20 })] },
  staff: { seg: 400, loop: true, frames: [
    P({ torso: 5, lh: 25, lk: 35, rh: -20, rk: 20, ls: 80, le: 30, rs: 70, re: 40 }),
    P({ torso: 8, lh: 28, lk: 40, rh: -22, rk: 22, ls: 90, le: 20, rs: 60, re: 50, head: 4 })] },
  flex: { seg: 450, loop: true, frames: [
    P({ face: "happy", torso: -4, head: -6, ls: 95, le: 120, rs: 100, re: 125 }),
    P({ face: "happy", torso: -6, head: -8, ls: 100, le: 130, rs: 105, re: 132, lift: 0.01 })] },
  dance: { seg: 260, loop: true, frames: [
    P({ face: "happy", torso: 8, lh: 20, lk: 30, rh: -5, rk: 5, ls: 150, le: 40, rs: -20, re: 60, head: 10 }),
    P({ face: "happy", torso: -8, lh: -5, lk: 5, rh: 20, rk: 30, ls: -20, le: 60, rs: 150, re: 40, head: -10, lift: 0.04 })] },
  laugh: { seg: 220, loop: true, frames: [
    P({ face: "happy", torso: -14, head: -16, ls: 30, le: 100, rs: 35, re: 105 }),
    P({ face: "happy", torso: -8, head: -8, ls: 28, le: 100, rs: 33, re: 105, lift: 0.02 })] },
  yawn: { seg: 900, loop: true, frames: [
    P({ face: "closed", torso: -10, head: -20, ls: 195, le: 30, rs: 160, re: 40 }),
    P({ face: "closed", torso: -12, head: -24, ls: 200, le: 20, rs: 155, re: 30 })] },
  talk: { seg: 380, loop: true, frames: [
    P({ rs: 45, re: 70, ls: -10, head: 3 }),
    P({ rs: 30, re: 95, ls: -6, head: -2 })] },
  listen2: { seg: 1200, loop: true, frames: [
    P({ head: 6, ls: -10, rs: 10 }),
    P({ head: 10, ls: -10, rs: 10, torso: 2 })] },
  highfive: { segs: [200, 140, 300], frames: [
    P({ rs: 120, re: 40, ls: -10 }),
    P({ free: true, lift: 0.12, rs: 160, re: 0, ls: -20, lh: 10, lk: 30, rh: -5, rk: 20, face: "happy" }),
    P({ face: "happy", rs: 150, re: 10, ls: -10 }),
    P({ face: "happy" })] },
  sneak: { seg: 210, loop: true, ease: "linear", frames: walkFrames({ lean: 14, swing: 14, extra: { ls: 70, le: 100, rs: 80, re: 100, head: 6 } }) },
  boo: { segs: [120, 600, 200], frames: [
    P({ torso: -6, ls: 30, le: 60, rs: 40, re: 60 }),
    P({ face: "surprised", torso: 15, ls: 130, le: 40, rs: 140, re: 40, sx: 0.06 }),
    P({ face: "surprised", torso: 15, ls: 130, le: 40, rs: 140, re: 40, sx: 0.06 }),
    P({ face: "happy" })] },
  beckon: { seg: 260, loop: true, frames: [
    P({ rs: 80, re: 90, ls: -10, torso: -4 }),
    P({ rs: 80, re: 30, ls: -10, torso: -4 })] },
  shrug: { seg: 700, loop: true, frames: [
    P({ ls: 20, le: 120, rs: 25, re: 120, head: 10 }),
    P({ ls: 25, le: 125, rs: 30, re: 125, head: 14, lift: 0.01 })] },
  facepalm: { seg: 1000, loop: true, frames: [
    P({ face: "closed", torso: 10, head: 18, rs: 125, re: 150, ls: -10 }),
    P({ face: "closed", torso: 12, head: 20, rs: 127, re: 150, ls: -10 })] },
  point: { seg: 800, loop: true, frames: [
    P({ face: "happy", rs: 90, re: 0, ls: -10, torso: -4 }),
    P({ face: "happy", rs: 95, re: 0, ls: -10, torso: -6 })] },

  hop: { segs: [110, 200, 190], frames: [
    P({ torso: 20, lh: 50, lk: 90, rh: 40, rk: 80, ls: 30, le: 60, rs: 40, re: 60 }),
    P({ free: true, lift: 0.28, torso: -12, lh: 30, lk: 60, rh: -10, rk: 50, ls: 120, le: 40, rs: 60, re: 50 }),
    P({ torso: 20, lh: 50, lk: 90, rh: 40, rk: 80, ls: 30, le: 60, rs: 40, re: 60 }),
    GUARD_A] },
  // Injured: flat on the back, a hand on the forehead.
  hurt: { seg: 1600, loop: true, frames: [
    P({ face: "closed", rot: -88, torso: 0, ls: 165, le: 120, rs: 20, re: 10, lh: 15, lk: 35, rh: 0, rk: 5 }),
    P({ face: "sad", rot: -87, torso: 2, ls: 168, le: 125, rs: 22, re: 12, lh: 17, lk: 38, rh: 0, rk: 5, head: 6 })] },
  // Kneeling to look after a hurt friend.
  tend: { seg: 900, loop: true, frames: [
    P({ torso: 30, head: 18, lh: 85, lk: 165, rh: 80, rk: 160, ls: 70, le: 40, rs: 60, re: 50 }),
    P({ torso: 34, head: 22, lh: 85, lk: 165, rh: 80, rk: 160, ls: 75, le: 35, rs: 65, re: 45 })] },
  // Straining under a heavy load.
  strain: { seg: 300, loop: true, frames: [
    P({ face: "focus", torso: 14, lh: 35, lk: 60, rh: -15, rk: 40, ls: 168, le: 30, rs: 172, re: 28 }),
    P({ face: "focus", torso: 18, lh: 38, lk: 66, rh: -12, rk: 44, ls: 165, le: 34, rs: 170, re: 32, lift: -0.01 })] },
  drink: { seg: 1500, loop: true, frames: [
    P({ torso: -4, lh: 85, lk: 165, rh: 80, rk: 160, ls: 20, le: 50, rs: 40, re: 75 }),
    P({ torso: -10, head: -16, lh: 85, lk: 165, rh: 80, rk: 160, ls: 20, le: 50, rs: 62, re: 118, face: "closed" }),
    P({ torso: -4, head: 3, lh: 85, lk: 165, rh: 80, rk: 160, ls: 22, le: 52, rs: 38, re: 72, face: "happy" })] },
  toast: { seg: 450, loop: true, frames: [
    P({ face: "happy", torso: -4, rs: 150, re: 30, ls: -10 }),
    P({ face: "happy", torso: -6, rs: 160, re: 20, ls: -10, lift: 0.03 })] },
  // Demons.
  claw: { segs: [160, 110, 220], frames: [
    P({ torso: -8, lh: 25, lk: 40, rh: -20, rk: 30, ls: 140, le: 60, rs: 150, re: 50, face: "surprised" }),
    P({ torso: 25, lh: 30, lk: 35, rh: -30, rk: 15, ls: 60, le: 10, rs: 75, re: 5, sx: 0.12, face: "surprised" }),
    P({ torso: 25, lh: 30, lk: 35, rh: -30, rk: 15, ls: 55, le: 20, rs: 70, re: 10, sx: 0.12 }),
    P({ torso: 10, lh: 25, lk: 45, rh: -20, rk: 35, ls: 80, le: 70, rs: 90, re: 60 })] },
  smash: { segs: [380, 140, 380, 260], frames: [
    P({ torso: 6, lh: 25, lk: 40, rh: -20, rk: 30, ls: 60, le: 60, rs: 70, re: 60 }),
    P({ torso: -18, head: -10, lh: 20, lk: 30, rh: -25, rk: 25, ls: 190, le: 10, rs: 185, re: 10 }),
    P({ torso: 38, head: 12, lh: 45, lk: 70, rh: -30, rk: 30, ls: 95, le: 0, rs: 100, re: 0, sx: 0.1 }),
    P({ torso: 38, head: 12, lh: 45, lk: 70, rh: -30, rk: 30, ls: 95, le: 0, rs: 100, re: 0, sx: 0.1 }),
    P({ torso: 6, lh: 25, lk: 40, rh: -20, rk: 30, ls: 60, le: 60, rs: 70, re: 60 })] },
  prowl: { seg: 170, loop: true, ease: "linear", frames: walkFrames({ lean: 22, swing: 26, extra: { ls: 100, le: 70, rs: 110, re: 60 } }) },
  hunch: { seg: 500, loop: true, frames: [
    P({ torso: 20, head: -12, lh: 30, lk: 55, rh: -15, rk: 40, ls: 90, le: 70, rs: 100, re: 60 }),
    P({ torso: 24, head: -16, lh: 32, lk: 60, rh: -15, rk: 42, ls: 95, le: 75, rs: 105, re: 65, lift: 0.01 })] },
  emerge: { segs: [500, 400], frames: [
    P({ free: true, lift: -0.9, torso: 10, ls: 175, le: 10, rs: 170, re: 10 }),
    P({ free: true, lift: -0.3, torso: 0, ls: 150, le: 30, rs: 140, re: 30 }),
    P({ torso: 18, lh: 30, lk: 55, rh: -15, rk: 40, ls: 90, le: 70, rs: 100, re: 60 })] },
  // Ninjutsu.
  seals: { seg: 95, loop: true, ease: "linear", frames: [
    P({ face: "focus", torso: 4, lh: 20, lk: 30, rh: -15, rk: 20, ls: 35, le: 120, rs: 40, re: 115 }),
    P({ face: "focus", torso: 4, lh: 20, lk: 30, rh: -15, rk: 20, ls: 50, le: 100, rs: 30, re: 130 }),
    P({ face: "focus", torso: 4, lh: 20, lk: 30, rh: -15, rk: 20, ls: 25, le: 135, rs: 55, re: 95 }),
    P({ face: "focus", torso: 4, lh: 20, lk: 30, rh: -15, rk: 20, ls: 45, le: 110, rs: 45, re: 110, head: 4 })] },
  cast: { segs: [140, 500, 200], frames: [
    P({ face: "focus", torso: -6, lh: 25, lk: 35, rh: -30, rk: 20, ls: 40, le: 110, rs: 45, re: 105 }),
    P({ face: "focus", torso: 16, lh: 35, lk: 40, rh: -35, rk: 10, ls: 88, le: 0, rs: 92, re: 0, sx: 0.08 }),
    P({ face: "focus", torso: 16, lh: 35, lk: 40, rh: -35, rk: 10, ls: 88, le: 0, rs: 92, re: 0, sx: 0.08 }),
    GUARD_A] },
  breathe: { segs: [260, 900, 260], frames: [
    P({ face: "focus", torso: -22, head: -20, lh: 20, lk: 25, rh: -25, rk: 15, ls: 30, le: 140, rs: 35, re: 145 }),
    P({ face: "surprised", torso: 18, head: 6, lh: 30, lk: 35, rh: -30, rk: 15, ls: 55, le: 120, rs: 60, re: 125, sx: 0.05 }),
    P({ face: "surprised", torso: 20, head: 8, lh: 30, lk: 35, rh: -30, rk: 15, ls: 55, le: 120, rs: 60, re: 125, sx: 0.05 }),
    GUARD_A] },
  stomp: { segs: [260, 140, 400, 220], frames: [
    P({ face: "focus", torso: 0, lh: 0, lk: 5, rh: 85, rk: 100, ls: 60, le: 90, rs: 70, re: 90 }),
    P({ face: "focus", torso: 15, lh: 35, lk: 50, rh: -10, rk: 20, ls: -40, le: 20, rs: -50, re: 20 }),
    P({ face: "focus", torso: 30, lh: 45, lk: 80, rh: -20, rk: 30, ls: -60, le: 10, rs: -65, re: 10 }),
    P({ face: "focus", torso: 30, lh: 45, lk: 80, rh: -20, rk: 30, ls: -60, le: 10, rs: -65, re: 10 }),
    GUARD_A] },
  swirl: { seg: 150, loop: true, frames: [
    P({ face: "focus", torso: 5, lh: 25, lk: 30, rh: -20, rk: 20, ls: 150, le: 30, rs: 60, re: 40 }),
    P({ face: "focus", torso: 5, lh: 25, lk: 30, rh: -20, rk: 20, ls: 60, le: 40, rs: 150, re: 30 }),
    P({ face: "focus", torso: 5, lh: 25, lk: 30, rh: -20, rk: 20, ls: -20, le: 30, rs: 100, re: 40 }),
    P({ face: "focus", torso: 5, lh: 25, lk: 30, rh: -20, rk: 20, ls: 100, le: 40, rs: -20, re: 30 })] },
  summon: { seg: 500, loop: true, frames: [
    P({ face: "focus", torso: -10, head: -12, lh: 25, lk: 35, rh: -25, rk: 25, ls: 200, le: 20, rs: 155, re: 20 }),
    P({ face: "focus", torso: -12, head: -16, lh: 25, lk: 35, rh: -25, rk: 25, ls: 205, le: 10, rs: 150, re: 10, lift: 0.03 })] },
  fizzle: { segs: [400, 300, 700], frames: [
    P({ face: "focus", torso: 4, ls: 45, le: 110, rs: 45, re: 110 }),
    P({ face: "surprised", torso: -8, ls: 80, le: 30, rs: 85, re: 30, sx: 0.04 }),
    P({ face: "sad", torso: 10, head: 14, ls: -5, le: 10, rs: 0, re: 10 }),
    P({ face: "sad", torso: 10, head: 14, ls: -5, le: 10, rs: 0, re: 10 })] },

  flail: { seg: 140, loop: true, frames: [
    P({ free: true, face: "surprised", ls: 210, le: 30, rs: 120, re: 40, lh: 20, lk: 40, rh: -10, rk: 20 }),
    P({ free: true, face: "surprised", ls: 140, le: 40, rs: 205, re: 30, lh: -10, lk: 20, rh: 20, rk: 40 })] },
  dangle: { seg: 420, loop: true, frames: [
    P({ free: true, face: "surprised", head: 12, ls: -30, le: 25, rs: 40, re: 30, lh: 12, lk: 15, rh: -8, rk: 10, torso: 5 }),
    P({ free: true, face: "surprised", head: 8, ls: -15, le: 30, rs: 25, re: 20, lh: -8, lk: 10, rh: 12, rk: 15, torso: -5 })] }
}

function animLength(name) {
  var a = ANIMS[name]
  if (!a) return 0
  if (a.segs) {
    var s = 0
    for (var i = 0; i < a.segs.length; i++) s += a.segs[i]
    return s
  }
  return a.seg * (a.loop ? a.frames.length : a.frames.length - 1)
}

function ease(t, kind) {
  if (kind === "linear") return t
  return t * t * (3 - 2 * t)
}

function lerpPose(a, b, t) {
  var p = {}
  for (var k in a) {
    if (typeof a[k] === "number") p[k] = a[k] + (b[k] - a[k]) * t
    else p[k] = t < 0.5 ? a[k] : b[k]
  }
  return p
}

// Pose of `name` after `ms` milliseconds of playback.
function poseAt(name, ms) {
  var a = ANIMS[name] || ANIMS.stand
  var n = a.frames.length
  if (n === 1) return a.frames[0]
  var segs = a.segs
  var count = a.loop ? n : n - 1
  var total = animLength(name)
  var t = ms
  if (a.loop) t = ((t % total) + total) % total
  else if (t >= total) return a.frames[n - 1]
  if (t < 0) t = 0
  var i = 0
  var start = 0
  for (; i < count; i++) {
    var d = segs ? segs[i] : a.seg
    if (t < start + d) {
      var f = (t - start) / d
      return lerpPose(a.frames[i], a.frames[(i + 1) % n], ease(f, a.ease))
    }
    start += d
  }
  return a.frames[a.loop ? 0 : n - 1]
}

// Proportions, in figure units.
var THIGH = 0.22, SHIN = 0.22, TORSO = 0.30, NECK = 0.03, HEAD_R = 0.12
var UPPER_ARM = 0.16, FOREARM = 0.15

function limb(o, a1, a2, l1, l2) {
  var j = { x: o.x + Math.sin(a1) * l1, y: o.y + Math.cos(a1) * l1 }
  var e = { x: j.x + Math.sin(a2) * l2, y: j.y + Math.cos(a2) * l2 }
  return [j, e]
}

function rotate(pt, c, s) {
  return { x: pt.x * c - pt.y * s, y: pt.x * s + pt.y * c }
}

// Solve a pose into joint positions. Origin: ground point under the hip.
function solve(p) {
  var torsoA = p.torso * DEG
  var hip = { x: 0, y: 0 }
  var neck = { x: Math.sin(torsoA) * TORSO, y: -Math.cos(torsoA) * TORSO }
  var headA = (p.torso + p.head) * DEG
  var headC = { x: neck.x + Math.sin(headA) * (NECK + HEAD_R), y: neck.y - Math.cos(headA) * (NECK + HEAD_R) }
  var sh = { x: neck.x * 0.9, y: neck.y * 0.9 }
  var ll = limb(hip, p.lh * DEG, (p.lh - p.lk) * DEG, THIGH, SHIN)
  var rl = limb(hip, p.rh * DEG, (p.rh - p.rk) * DEG, THIGH, SHIN)
  var la = limb(sh, (p.torso + p.ls) * DEG, (p.torso + p.ls + p.le) * DEG, UPPER_ARM, FOREARM)
  var ra = limb(sh, (p.torso + p.rs) * DEG, (p.torso + p.rs + p.re) * DEG, UPPER_ARM, FOREARM)

  var pts = { hip: hip, neck: neck, head: headC, sh: sh,
    lknee: ll[0], lfoot: ll[1], rknee: rl[0], rfoot: rl[1],
    lelbow: la[0], lhand: la[1], relbow: ra[0], rhand: ra[1] }

  var r = p.rot * DEG
  var c = Math.cos(r), s = Math.sin(r)
  for (var k in pts) pts[k] = rotate(pts[k], c, s)

  var dy
  if (p.free) {
    dy = THIGH + SHIN
  } else {
    var maxY = pts.head.y + HEAD_R
    var keys = ["hip", "lknee", "lfoot", "rknee", "rfoot", "lhand", "rhand", "neck"]
    for (var i = 0; i < keys.length; i++) maxY = Math.max(maxY, pts[keys[i]].y)
    dy = maxY
  }
  for (var k2 in pts) {
    pts[k2].y = pts[k2].y - dy - p.lift
    pts[k2].x = pts[k2].x + p.sx
  }
  pts.headR = HEAD_R
  pts.headA = headA + r
  pts.torsoA = torsoA + r
  pts.face = p.face
  return pts
}
