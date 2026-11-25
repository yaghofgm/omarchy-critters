# Critters — ninja desktop pets for Omarchy

An [Omarchy](https://omarchy.org) shell plugin that puts a little ninja clan on your
desktop. They stand on top of your windows, leap between them, train, chat, prank each
other, and slowly build a multi-storey pagoda dojo. There's no pet care: nothing to
feed and nothing that dies. It's just something fun to watch while you work.

> Built for and tested on **Omarchy 4.0** (Quickshell-based shell). Later shell
> versions may need small fixes. This is shared as-is for browsing and tinkering.

## What they do

- **Dojo building:** 17 construction stages. New recruits arrive at milestones (max 6).
- **Personalities and traits:** 9 personalities with their own action weights and lines.
  Traits include driven, brawler, fragile, prodigy, clutch and streaky.
- **Belts and ninjutsu:** XP earns belts from White up to Golden and Divine. Each ninja
  has an elemental affinity, and higher belts unlock clones and ultimates.
- **Pair interactions:** chat, high-five, teach, meditate, flex-off, tag, prank. Ninjas
  form relationships with each other.
- **Endurance tournaments:** rounds of random pairings until health runs out. Underdogs
  win about a third of the time. Afterwards there's a sake party while everyone heals.
- **Demon raids:** rifts open and imps or oni attack. Click a demon to smite it. Losing a
  raid wrecks part of the dojo.
- **Optional LLM minds (`Mind.js`):** if a local [Ollama](https://ollama.com) is running
  on `127.0.0.1:11434`, ninjas can make decisions and write dialogue with a small model.
  It runs in short bursts and unloads the model in between to save power. Without
  Ollama they use the scripted brain.
- **Send home / pause:** the clan packs up into the dojo and the sim stops completely.

## Install

```bash
git clone https://github.com/yaghofgm/omarchy-critters \
  ~/.config/omarchy/plugins/yaghofgm.critters
omarchy restart shell
```

Then add `yaghofgm.critters` to your bar (it registers a bar widget) or enable it from
the shell's plugin settings. State is saved to `~/.local/state/omarchy/critters.json`.

## IPC

```bash
omarchy-shell critters list | where | dojo | thoughts | mind | tournament | raid | home | back
omarchy-shell critters say <name> <text>
omarchy-shell critters direct <name> <action> <target> <line>
omarchy-shell critters spawn | setStage <n> | addXp <id> <n>
```

## Files

| File | What's in it |
|---|---|
| `Service.qml` | Overlay per monitor, Hyprland window sync, input mask, IPC |
| `BarWidget.qml` | Bar button and menu |
| `Sim.js` | World simulation: dojo stages, events, duels, tournaments, raids |
| `Lines.js` | Personalities, dialogue lines, conversations |
| `Rig.js` | Skeletal poses |
| `Draw.js` | All the art (ninjas, garments, dojo, demons) |
| `Mind.js` | Optional local LLM decision-making |

## Hacking tips

- QML caches plugin files, so run `omarchy restart shell` after every edit.
- You can test the simulation headless with Node: load `Sim.js` in a `vm` context after
  stripping the `.pragma` and `.import` lines.
- Pacing knobs live at the top of `Sim.js` (`STAGES`, `XP_RATE`, build weights).
