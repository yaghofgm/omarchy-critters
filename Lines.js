.pragma library

// What the ninjas are like and what they say. Pure data plus a couple of
// helpers; Sim.js decides when to use it.
//
// Placeholders: {name} the speaker, {other} who they're talking to,
// {master} the current sensei, {day} the speaker's day of training.

// Action weight multipliers per personality (1 when not listed).
var PERSONALITIES = {
  stoic: {
    label: "Stoic", blurb: "Says little. Means all of it.",
    weights: { meditate: 2.2, crane: 2, kata: 1.3, dance: 0.2, prank: 0.2, chat: 0.6, social: 0.7, nap: 0.5 },
    idle: ["...", "Hm.", "The wind changes.", "Still water.", "Day {day}. Same as day one. Good.",
      "I have nothing to add.", "Breathe.", "Patience is a blade that doesn't dull.", "Hm. Yes.",
      "A ninja is a quiet thing.", "The mountain does not hurry.", "Focus."],
    greet: ["*nods*", "{other}.", "Hm."],
    click: ["...", "No.", "*doesn't flinch*", "Again, if you must."],
    grab: ["...", "Put me down.", "This changes nothing."],
    win: ["...", "Expected.", "*bows*", "The path is long."],
    lose: ["...a lesson.", "Hm.", "Well struck."],
    build: ["Plank.", "Level.", "*hammers silently*"],
    challenge: ["Spar.", "Now.", "Show me your form."],
    reply: ["Hm.", "...", "Indeed.", "Perhaps.", "No.", "*nods*", "That is one view."],
    topics: ["Your stance is wide today.", "The wind is from the east.", "Have you trained?", "Silence is a skill too."],
    praise: ["Good.", "Acceptable.", "*nods once*"],
    tease: ["Your guard drops.", "Slow."]
  },
  hothead: {
    label: "Hothead", blurb: "Picks fights. Loses some of them.",
    weights: { spar: 2.5, challenge: 3, kata: 1.4, combo: 1.8, meditate: 0.4, crane: 0.5, nap: 0.5, flex: 1.5 },
    idle: ["Who wants some?!", "I could take {master}. Easy.", "WHO TOUCHED MY HEADBAND", "Day {day}. Still undefeated. Mostly.",
      "I'm not angry. I'm INTENSE.", "Hiyaaaa!", "Somebody fight me.", "This window looks at me funny.",
      "I punched a cloud once. It left.", "Rest is for the weak. And sleepy.", "Hit me. Go on.", "I'm warmed up!"],
    greet: ["Oh, it's YOU.", "Fight me, {other}.", "Hey! You! Spar later!"],
    click: ["HEY!", "Watch it!", "You wanna go?!", "Do that again. I dare you."],
    grab: ["PUT ME DOWN AND FIGHT", "Coward! Using hands!", "I'll remember this!"],
    win: ["HA! Who's next?!", "Too easy!", "Did you SEE that?!", "Bring me another one!"],
    lose: ["REMATCH!", "I slipped!", "That doesn't count!", "I was going easy!"],
    build: ["BUILD! FASTER!", "This plank is weak.", "I punched it into place."],
    challenge: ["You. Me. Now.", "Fight me, {other}!", "Think you're tough?", "Let's settle this!"],
    reply: ["Whatever.", "Fight me.", "That's dumb.", "Yeah? So?", "I'd punch that.", "Hmph!"],
    topics: ["I bet I could beat you.", "I did 400 push-ups. Before breakfast.", "{master} isn't so tough.", "You looking at my headband?"],
    praise: ["Not bad. For you.", "Okay that was cool.", "Fine. Respect."],
    tease: ["Weak!", "My grandma kicks harder.", "Is that all?!"]
  },
  goofball: {
    label: "Goofball", blurb: "Trained hard. Mostly at being silly.",
    weights: { prank: 3, dance: 3, chat: 1.4, flip: 1.3, meditate: 0.5, mirror: 2.5, tag: 2, acrobatics: 1.4 },
    idle: ["Boop.", "I'm a ninja. Can you see me? No? Exactly.", "What if the window is the real ninja?", "Hehe.",
      "Day {day}! Still haven't found the bathroom.", "I once hid in a tab for a week.", "Ninja vanish! ...still here.",
      "Do a flip! No, YOU do a flip.", "Wanna see a trick? It's just me falling.", "I'm basically a cat.",
      "Hi! Hi. Hello.", "My shuriken is a cookie.", "Shhh. I'm being stealthy.", "I sneezed in the dojo."],
    greet: ["HI {other}!", "Ooh, a friend!", "*waves with both arms*", "Boo! ...too early?"],
    click: ["Hehe, that tickles!", "Again! Again!", "Boop yourself!", "Wheee!"],
    grab: ["Wheee!", "I can fly!", "Higher!", "This is the best day."],
    win: ["I won?! I WON!", "Wait, I won?", "*victory dance*", "Lucky socks!"],
    lose: ["I meant to do that.", "Ow, but fun!", "Again!", "Nailed it. Wait."],
    build: ["Is this plank or a snack?", "Hammer time!", "Oops. Wrong side. It's fine."],
    challenge: ["Tickle fight! I mean spar.", "Battle! Pew pew!", "En garde! Wrong sport."],
    reply: ["Hehe!", "Wait, what?", "Banana.", "That's what the duck said.", "Cool cool cool.", "Same!", "Ha! What?"],
    topics: ["Wanna see me eat a plank?", "What if we're all just pixels?", "I named a shuriken Steve.", "Did you hear about the ninja who got lost? Me. It was me."],
    praise: ["WOW!", "You're so cool!", "Teach me teach me!"],
    tease: ["Slowpoke!", "Nyeh!", "Can't catch me!"]
  },
  philosopher: {
    label: "Philosopher", blurb: "Thinks about the strike before, during and long after.",
    weights: { meditate: 1.8, chat: 2.2, crane: 1.3, spar: 0.6, prank: 0.3, teach: 1.6, sprint: 0.6 },
    idle: ["If a ninja vanishes and no one sees, did they vanish?", "What is a window, really?", "Day {day}. Or is it?",
      "The strike you don't throw is also a strike.", "Are we in the dojo, or is the dojo in us?",
      "Who watches the watcher? You, apparently.", "A plank is a tree that changed its mind.",
      "To kick is human. To land is divine.", "Every cursor points somewhere.", "I think, therefore I train.",
      "The tab you never open is the most mysterious.", "What does the gong dream of?"],
    greet: ["Ah, {other}. A fellow wanderer.", "Greetings, traveler of windows.", "We meet again. Or for the first time."],
    click: ["Was that fate, or you?", "Interesting.", "A poke. Profound.", "Why do you do this?"],
    grab: ["So this is what clouds feel.", "Gravity was merely a suggestion.", "I am being... curated."],
    win: ["Victory is a teacher with a short lesson.", "We both won something.", "Interesting."],
    lose: ["Defeat is a longer lesson.", "I have learned much. Ow.", "Hm. Noted."],
    build: ["Each plank, a thought.", "We build the dojo. The dojo builds us.", "Is a dojo ever finished?"],
    challenge: ["Shall we test a theory?", "Spar with me. For science.", "Let us discuss. With fists."],
    reply: ["But why?", "Fascinating.", "Is that true, though?", "Hm. Define 'is'.", "I hadn't considered that.", "Profound."],
    topics: ["Do you think the cursor is alive?", "If we finish the dojo, what then?", "Who decides the master, really?", "Is a sword just a long thought?"],
    praise: ["Elegant.", "There is truth in that move.", "You have grown, {other}."],
    tease: ["Your form asks questions it can't answer.", "Hm. Unexamined kick."]
  },
  showoff: {
    label: "Show-off", blurb: "Every move is a performance. You're the audience.",
    weights: { flip: 2.5, acrobatics: 2.8, flex: 3, weapons: 1.6, combo: 1.4, meditate: 0.5, nap: 0.4, flexoff: 2.5 },
    idle: ["Are you watching? Watch this.", "Day {day}. Looking good, honestly.", "Flawless. As usual.",
      "Did you see that?! No? I'll do it again.", "My fan club meets on Tuesdays.", "I don't sweat. I sparkle.",
      "Ten out of ten. Every time.", "Is the light hitting me right?", "Sign here for autographs.",
      "Some ninjas hide. I prefer to be seen.", "Just another perfect landing.", "Check out these arms."],
    greet: ["You may watch me train, {other}.", "Ah, an audience!", "Hey {other}, saw my backflip?"],
    click: ["Autographs later!", "Easy, fan.", "Yes, yes, I'm amazing."],
    grab: ["Careful with the merchandise!", "Get my good side!", "Whee — I mean, as planned."],
    win: ["Was there ever any doubt?", "Encore!", "*poses*", "Too beautiful to lose."],
    lose: ["The lighting was off.", "I let you have that one.", "My hair got in my eyes."],
    build: ["I make carpentry look good.", "Behold: plank.", "Best plank yet. Mine."],
    challenge: ["Let's give them a show, {other}.", "Spar? I'll go easy. Maybe.", "Ready to lose stylishly?"],
    reply: ["Obviously.", "Did you see my flip, though?", "Cool. Anyway, me.", "Sure, sure.", "Not as cool as me."],
    topics: ["Rate my backflip. Out of ten. It's ten.", "I've been working on my abs.", "Do you think {master} is jealous of me?", "I should have a statue."],
    praise: ["Nice! Almost as good as me.", "Ooh, stylish.", "Okay, that was cool."],
    tease: ["Cute move.", "Amateur hour!"]
  },
  sleepy: {
    label: "Sleepy", blurb: "Elite at napping. Fair at everything else.",
    weights: { nap: 4, meditate: 1.5, sprint: 0.3, kata: 0.6, spar: 0.5, chat: 0.8, yawn: 3, snack: 1.3 },
    idle: ["*yawn*", "Five more minutes...", "Day {day}. Tired.", "Is it nap time? It's nap time.",
      "I trained in my dreams. Counts.", "Zzz... huh? I'm up.", "Naps are a martial art.", "Comfy floor.",
      "Wake me for the tournament.", "The best defense is being asleep.", "Mm.", "Who turned on the day?"],
    greet: ["Mm... hi {other}.", "*waves sleepily*", "Oh. Hi. *yawn*"],
    click: ["Huh? Wha?", "I'm awake! I'm awake.", "Mmf.", "Five more minutes..."],
    grab: ["Am I dreaming?", "Wheee... zzz.", "Is this a bed?"],
    win: ["Oh. I won? Nice. Nap now.", "Wake me for the next one.", "Mm, okay."],
    lose: ["Fair. Nap.", "I was asleep. Technically.", "Zzz... rematch later."],
    build: ["Plank... comfy plank...", "*hammers slowly*", "Could nap on this floor."],
    challenge: ["Spar? ...short one?", "Quick fight, then nap."],
    reply: ["Mm.", "Sure... *yawn*", "Zzz... what?", "Is that... a nap thing?", "Sounds tiring."],
    topics: ["Do you dream about windows?", "Want to nap? Group nap?", "Is it lunch yet?"],
    praise: ["Nice... *yawn*", "Cool. Very awake of you."],
    tease: ["You look tired. Join me."]
  },
  foodie: {
    label: "Foodie", blurb: "Trains for the snacks. Snacks for the training.",
    weights: { snack: 4, share: 3, chat: 1.3, sprint: 0.8, meditate: 0.7 },
    idle: ["Rice ball time?", "Day {day}. Ate 3 onigiri. Personal best.", "I can smell lunch.", "Trained hard. Now: snack.",
      "Is that window a menu?", "A ninja moves silently. Except their stomach.", "Mochi is a lifestyle.",
      "My shuriken is shaped like a cracker. Coincidence.", "Hungry.", "What's for dinner?", "Snack-fu!", "Mmm, noodles."],
    greet: ["{other}! Snack?", "Hi! Have you eaten?", "Want an onigiri, {other}?"],
    click: ["Was that a snack? No?", "Hungry!", "Hey! I'm eating!", "Do you have food?"],
    grab: ["Is this a snack run?", "Take me to the fridge!", "Don't drop my rice ball!"],
    win: ["Victory snack!", "That's earned me a meal.", "I fight better fed."],
    lose: ["I was hungry.", "Snack break. Then rematch.", "Needed more rice."],
    build: ["This plank smells like toast.", "Build now, snack later.", "Kitchen goes here. Trust me."],
    challenge: ["Spar for the last rice ball?", "Winner gets dessert!"],
    reply: ["Is there food?", "Sounds delicious.", "Mm, hungry now.", "Can we talk over snacks?", "Yum."],
    topics: ["Have you tried the onigiri?", "What's your favorite snack?", "We should build a kitchen floor.", "Do you think {master} shares snacks?"],
    praise: ["Tasty move!", "Delicious form!", "Chef's kiss."],
    tease: ["You fight like soggy rice."]
  },
  nervous: {
    label: "Nervous", blurb: "Very talented. Very jumpy.",
    weights: { kata: 1.4, sprint: 1.3, spar: 0.4, prank: 0.1, chat: 0.8, crane: 1.2, explore: 1.4 },
    idle: ["Is someone behind me?", "Day {day}. Nobody has noticed me. Good.", "Sorry. Sorry. Was I in the way?",
      "I'm fine! Totally fine!", "What was that noise?!", "Is the gong going to go off? Is it?", "Deep breaths...",
      "I practiced my bow 400 times.", "Okay. Okay. Kata time.", "Don't look at me. Okay, look a little.",
      "I hope the tournament gets cancelled.", "Did I leave the stove on? We don't have a stove."],
    greet: ["Oh! H-hi, {other}!", "Sorry! Hi!", "*jumps* Oh, it's you."],
    click: ["Eep!", "Sorry!", "Ah! Don't do that!", "My heart!"],
    grab: ["AAAA!", "Please don't drop me!", "I'm sorry for whatever I did!"],
    win: ["I... won? Sorry!", "Oh no, are you okay?", "Was that allowed?"],
    lose: ["That's fair. Totally fair.", "I knew it. Ow.", "Sorry for losing!"],
    build: ["Is this right? Is this plank right?", "Sorry, plank.", "I measured it four times."],
    challenge: ["Um... spar? Gently?", "Only if you want to..."],
    reply: ["Oh! Um. Yes?", "Sorry, what?", "Is that safe?", "Okay! Okay.", "Eep. Sure."],
    topics: ["Do you think {master} likes me?", "Is it normal to be this nervous?", "What if the window closes?"],
    praise: ["W-wow!", "That was amazing!", "You're so brave."],
    tease: ["Um... your headband's crooked. Sorry!"]
  },
  poet: {
    label: "Poet", blurb: "Speaks mostly in haiku. Counts syllables on their fingers.",
    weights: { meditate: 1.6, chat: 1.8, crane: 1.4, weapons: 1.3, nap: 0.6 },
    idle: ["Silent window glows / a cursor drifts like moonlight / my kick finds nothing",
      "Plank upon a plank / the dojo rises slowly / so does my hunger",
      "Day {day}, cherry bloom / a ninja counts syllables / five seven and five",
      "Shuriken in flight / the edge of a browser tab / bullseye, says the wind",
      "Old gong, silent now / one click and the whole dojo / gathers in its sound",
      "Headband in the wind / I am small but I am fierce / mostly I am small",
      "The tab you closed / took my favorite floor with it / we will build again",
      "Morning stretch, slow breath / the screen wakes and so do I / push-up number one"],
    greet: ["{other} arrives / like a leaf on a clear stream / hello, friend, hello", "Greetings, {other}."],
    click: ["A finger descends / the poet dodges, mostly / how rude, how rude, how", "Ah, the giant's touch."],
    grab: ["Lifted by the sky / my feet forget the floor now / please put me back down"],
    win: ["The duel is done / two shadows bow in silence / one of them is me"],
    lose: ["I fall like blossoms / gracefully, at least I hope / ow ow ow ow ow"],
    build: ["Hammer sings to wood.", "A plank, a poem.", "Nail by nail, a verse."],
    challenge: ["Spar with me, {other} / let our fists write a haiku / five, seven, and ow"],
    reply: ["Hm. A haiku waits there.", "Beautiful.", "That has rhythm.", "Five, seven, five... no.", "Mm, poetic."],
    topics: ["Can you hear the window hum?", "What rhymes with dojo?", "The cherry tree speaks."],
    praise: ["Your kick: a poem.", "Lovely form.", "That move had meter."],
    tease: ["Your form lacks rhythm."]
  }
}

var PERSONALITY_KEYS = Object.keys(PERSONALITIES)

// Lines any ninja can say, when their personality has nothing for the moment.
var COMMON = {
  idle: ["Day {day} of training.", "The wind is my sensei.", "Your cursor moves like a cat.", "One more set.",
    "I sense... a deadline.", "Hydrate.", "Your window is my dojo.", "Breathe in. Breathe out. Compile.",
    "I am one with the pixels.", "A true ninja never sleeps. Except at night.", "The dojo grows.",
    "Is it tournament time yet?", "I should practice my bow.", "Somewhere, a tab is open just for me."],
  arrive: ["I seek training!", "Is this the dojo?", "I heard there was a dojo here.", "Teach me!", "Reporting for training!"],
  welcome: ["Welcome.", "Train hard.", "Grab a plank.", "Another student. Good.", "Welcome to the dojo, {other}."],
  sensei: ["Sensei.", "Master {master}.", "*bows*", "Good day, Sensei."],
  master: ["Again. Slower.", "Good. Now with feeling.", "Patience, grasshoppers.", "Discipline is a quiet thing.",
    "When I was a white belt, we had no windows.", "The student becomes... still a student.", "Show me your kata.",
    "A sensei is just a student with more bruises.", "Sweep the dojo. Then sweep it again."],
  cheer: ["Go!", "Hai!", "Ooh!", "Again!", "Yes!", "Ha!", "Kick!", "Block!", "Whoa!"],
  view: ["What a view.", "I can see your whole desktop from here.", "Peaceful up here.", "The wind is stronger up here."],
  found: ["This window... will be our dojo.", "Here. We build here.", "A fine place for a dojo."],
  relocate: ["The dojo lives on. Here.", "We rebuild!", "A dojo is not a place. But also, here."],
  stageDone: ["The {stage} is done!", "Behold: the {stage}!", "{stage}: complete."],
  open: ["The dojo is complete!", "Grand opening!", "Welcome to our dojo!"],
  shuriken: ["Bullseye.", "Right where I wanted it.", "That window had it coming."],
  dummy: ["Hyah!", "Another one.", "The dummy has been defeated.", "Rest well, Kevin."],
  kata: ["Together!", "Follow me.", "Line up!", "Kata, everyone!"],
  land: ["...nailed it.", "Ten out of ten.", "As planned.", "Gravity is my friend."],
  prankVictim: ["AAAH!", "WHO— oh. {other}.", "Not funny!", "My soul left my body.", "I'm going to get you!"],
  prankDone: ["Hehehe!", "Gotcha!", "Your face!", "Classic."],
  highfive: ["Up top!", "Yeah!", "Nice!", "*slap*"],
  tagIt: ["Tag! You're it!", "Can't catch me!", "Tag!"],
  teach: ["Watch closely.", "Like this. See?", "Elbow in. Now strike.", "Again. From the hips."],
  learn: ["Like this?", "Ooh. Got it!", "Hai, sensei!", "I think I get it."],
  shareGive: ["Want half?", "Here, have a rice ball.", "I brought two."],
  shareGet: ["Thank you!", "Ooh, onigiri!", "You're the best, {other}.", "*munch*"],
  flexoff: ["Check these out.", "Gun show.", "Behold."],
  mirrorEnd: ["Stop copying me!", "Hey!", "Copycat!", "Hehe."],
  koReact: ["Ooh!", "That looked like it hurt.", "Oof.", "Hahaha!", "Get up!"],
  laughAt: ["Hahaha!", "Pfft!", "Nice landing!", "*snort*"],
  party: ["{w}, that finishing blow on {l} in round {r}!", "To {champ}, last one standing!", "Kanpai!", "My ribs still remember round {r}.",
    "{l}, you fought well. Mostly.", "Next time I'm outlasting {champ}.", "Pass the sake.", "I saw {w} hesitate. Just once.",
    "Best tournament yet.", "Who taught {w} that move?", "Hic.", "{champ} isn't even tired. Suspicious.",
    "I'm not drunk. I'm meditating.", "Round {r} was brutal.", "{l} almost had {w}. Almost.", "Another round? Of sake. Not fighting.",
    "I'll feel this tomorrow.", "Respect to everyone who got back up.", "{w} hits like a falling roof.", "To the dojo!"]
}

// Full conversations: speaker 0 starts, 1 replies.
var CONVOS = [
  [[0, "Do you ever think about the cursor?"], [1, "Every day."], [0, "It moves like a god."], [1, "A god with one button."]],
  [[0, "{other}, what's your favorite window?"], [1, "The one with the dojo."], [0, "Good answer."]],
  [[0, "I heard {master} once kicked a tab closed."], [1, "With their foot?"], [0, "With their aura."]],
  [[0, "Why do we live at the bottom of windows?"], [1, "Gravity, I think."], [0, "Gravity is so rude."]],
  [[0, "Did you hear that hum?"], [1, "The fan?"], [0, "...the fan. Yes. Of course."]],
  [[0, "Bet you can't do a handstand for ten seconds."], [1, "Bet you can't count to ten."], [0, "Hey!"]],
  [[0, "What's the gong for, anyway?"], [1, "Fights. And dramatic moments."], [0, "So, fights."]],
  [[0, "I think the giant is watching us."], [1, "The one with the cursor?"], [0, "Wave. Act natural."]],
  [[0, "If you could live in any window, which one?"], [1, "A big one. With snacks."], [0, "Same."]],
  [[0, "My form is getting better."], [1, "Your form is getting... bigger."], [0, "That's muscle!"]],
  [[0, "Who do you think wins the next tournament?"], [1, "Me."], [0, "Bold."], [1, "Ninja are bold."]],
  [[0, "I dreamt the dojo had a fourth floor."], [1, "Don't tell the builders."], [0, "We ARE the builders."]],
  [[0, "Do you remember your first day?"], [1, "I fell off a window."], [0, "Classic."]],
  [[0, "The cherry tree smells nice today."], [1, "It always smells nice."], [0, "Today it smells nicer."]],
  [[0, "Want to hear a secret?"], [1, "Sure."], [0, "I'm scared of the gong."], [1, "...me too."]],
  [[0, "Is it true a ninja never sleeps?"], [1, "Shh. Don't wake anyone."]],
  [[0, "Teach me your spin kick?"], [1, "Spin first. Then kick."], [0, "Genius."]],
  [[0, "I think I saw another dojo in a different window."], [1, "Impossible."], [0, "It was a spreadsheet."]],
  [[0, "Why is it called a 'tab'?"], [1, "Because you pay later."], [0, "...hm."]],
  [[0, "I'm going to be master one day."], [1, "Today?"], [0, "...one day."]],
  [[0, "Psst. {other}."], [1, "What?"], [0, "Nothing. Just practicing my 'psst'."]],
  [[0, "Did the window just move?"], [1, "The giant does that."], [0, "Warn me next time, giant!"]],
  [[0, "How many push-ups today?"], [1, "Forty-two."], [0, "I did forty-three."], [1, "...forty-four."]],
  [[0, "Do you think shurikens have feelings?"], [1, "Only the stuck ones."]],
  [[0, "Nice headband, {other}."], [1, "Thanks. It's from the gift shop."], [0, "We have a gift shop?"]],
  [[0, "Race you to the edge!"], [1, "You always cheat."], [0, "Ninjas cheat. It's tradition."]],
  [[0, "The dojo creaks at night."], [1, "That's the third floor settling."], [0, "Or ghosts."], [1, "Ninja ghosts."]],
  [[0, "Will you be my sparring partner?"], [1, "Only if you stop crying when you lose."], [0, "Deal. Mostly."]]
]

// ---------------------------------------------------------------- helpers

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function personality(c) { return PERSONALITIES[c.personality] || PERSONALITIES.stoic }

// A line for `key`, preferring the ninja's own voice.
function line(c, key) {
  var own = personality(c)[key]
  var common = COMMON[key]
  if (own && own.length && (!common || Math.random() < 0.75)) return pick(own)
  if (common && common.length) return pick(common)
  return "..."
}

// Weight multiplier for an action, given personality.
function weight(c, action) {
  var w = personality(c).weights[action]
  return w === undefined ? 1 : w
}

function randomPersonality() { return pick(PERSONALITY_KEYS) }

// A chat between a and b: a written conversation, or one stitched from
// their personalities.
function conversation(a, b) {
  if (Math.random() < 0.45) return pick(CONVOS)
  var pa = personality(a), pb = personality(b)
  var out = [[0, pick(pa.topics)], [1, pick(pb.reply)]]
  if (Math.random() < 0.5) out.push([0, pick(pa.reply)])
  if (Math.random() < 0.3) out.push([1, pick(pb.idle)])
  return out
}
