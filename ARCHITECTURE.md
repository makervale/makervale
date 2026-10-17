# Makervale — architecture

Rules that keep the code readable, then the layout, then how the layers talk.

## Rules

1. **One file, one idea.** A file does one thing its name says. Aim under 150 lines; split at 200.
2. **Small functions.** One screen, one level of abstraction, usually under 25 lines. No one-liners
   that do five things.
3. **Lines under 120 characters.** Prettier enforces it, ESLint enforces the rest. The build fails
   on violations, so the style can't drift back.
4. **Names carry the meaning; comments carry the why.** A comment explains a decision, a trap, or
   a non-obvious reason. Never what the code already says.
5. **Explicit inputs.** A module gets what it needs through its parameters or a `deps` object.
   No reaching into another layer's globals.
6. **Data flows one way.** State → change through a command → event → views update. Views never
   mutate state directly.
7. **Pure before impure.** Algorithms and data (mesh, script language, rules) have no DOM, no
   three.js, no network. They are the easiest to test and the safest to change.
8. **Every feature folder looks the same**, so there is nothing new to learn when opening one.
9. **Tests sit next to the code** they test (`foo.ts` + `foo.test.ts`).

## Layout

```
src/
  main.ts                 calls boot()
  boot/                   puts the app together; the only place that knows every part
    core.ts               store, bus, commands, tool registry + runner
    bodies.ts             your avatar, other people's bodies, the script runtime, the room session
    features.ts           mounts every feature (order notes inside)
    start-world.ts        autosave + the scene you start with
    scene-requests.ts     sky and "frame the selection" requests
    loop.ts               the frame loop and the stats line
    test-hooks.ts         window.__sandbox for the end-to-end tests
  app/                    the spine
    store.ts              world, selection, settings: the single state object + typed getters
    bus.ts                typed events, "noun:verb"; also the requests features send each other
    commands.ts           the only writer: act (undoable), apply (remote/script), replaceWorld, selection
    space.ts              the laws of space applied to the scene: what may stand, checked before an edit stands
    tools.ts, tool-runner.ts, tool-needs.ts   what a tool is, running one, "can it run now?"
    settings.ts, storage.ts
  lib/                    pure code, no DOM, no network
    mesh/                 mesh data, topology, ops/, generators/, boolean, bevel, decimate, uv, io/
    script/               the scripting language: lexer, parser, interpreter, builtins, templates
    physics/              a ball's step: gravity, contacts, bounce, roll, people pushing it
    rules/                signed room rules: private or public, who builds, who was removed, keep online
    weight/               the laws of space: an object's weight, the sand ledger (density per place), the room's
                          ceiling, and the sand map's shells
    vec.ts, text.ts
  world/                  the scene as data
    model.ts              Obj, Material, World
    history.ts            undo / redo
    migrate.ts            loading older saves and project files
    sample/               the start scene, one file per structure (cottage, fountain, lift…)
  render/                 three.js only
    renderer.ts           composition root: scene, views, camera, picking, highlights, sky, bubbles
    objects.ts            Obj ↔ three.js mesh ("views")
    camera/               orbit, follow, framing (clear-view.ts keeps walls out of the shot)
    lod/                  drawing far things simpler by pixel error, with a cross-fade; a worker simplifies meshes
    preview/              the little turning illustrations of tools
    bubbles/, picking.ts, pick-element.ts, highlights.ts, sky.ts, …
  avatar/                 bodies and motion
    controller.ts         your avatar: keys, walking, flying, sitting, camera follow
    peer-bodies.ts        other people's bodies (implements net's PeerBodies)
    animator.ts, clips.*, gestures.ts, figure/, vrm/, collision.ts, movement.ts
  net/                    everything that leaves the browser (nothing does until net/online.ts is switched on)
    session.ts            createSession(): the one object the UI talks to (+ owner-api.ts, gallery-api.ts)
    sync/                 one file per message family: hello, snapshot, objects, outbox, drag, avatars, chat, scripts, files
    rooms.ts, room-actions.ts, own-scene.ts, saved-rooms.ts, copies.ts   open / join / reopen / leave / copy
    tab-lease.ts          one room at a time per browser (tabs of one browser are one person)
    rules.ts, owner-tools.ts, person.ts   what the signed rules mean, the owner's changes, who someone is
    moderation/           the owner's edit log: undo one person's changes, rewind the room
    public-rooms.ts, announcer.ts         the list of public rooms, while their owners are in them
    room-code.ts, room-keys.ts, seal.ts   codes, keys derived from them, encryption
    transport.ts, direct.ts, channel/     WebRTC, or the room's encrypted channel on the relays when that fails
    pieces/               a scene as content-addressed pieces on the relays, for vault/ and gallery/
    vault/                Keep online: a private room's encrypted copy on the relays
    gallery/              published, versioned, signed worlds; viewing.ts shows one in place of your scene
    relays.ts, relay-query.ts, nostr.ts, ice.ts, check.ts
    sanitize.ts           everything that arrives from a peer goes through here
  features/               user-facing slices; each exports mount(deps) from index.ts
    build-window/         Object / Material / Script / Scene tabs, status line, last-operation panel
    tools-panel/          the Tools sidebar and quick search
    tools/                every tool definition, one file per group
    live-tool/            tools that run in the viewport; handles "tool:use"
    manipulators/         move / rotate / scale handles
    viewport-input/       pointer and keyboard in the 3D view
    pie-menu/, menubar/, files/, camera-window/
    chat/, multiplayer-window/, avatar-window/, gestures/
    limits-window/        how close the scene is to the limits of space and script time
    touch-controls/       joystick and fly up / down buttons on touch screens
    phone-mode/           the limited phone preview: html.phone, desktop-only windows, the first-visit card
    scripts/              the script runtime (runs on the authority peer); gas.ts: each script's share of a second
    physics/              bodies (balls): BVH contacts with the scene, sleeping, sync through net
    sound/                Web Audio: effects, footsteps, wind and birds, instruments for `play`
  ui/                     dumb widgets: dom.ts, window.ts, spinner.ts, toast.ts; device.ts (isPhone)
  styles/                 base.css first, one css file per feature, mobile.css last (phone and touch overrides)
  index.html              the page skeleton; features add their own windows
test/                     end-to-end Playwright scripts (unit tests live next to the code)
build.mjs                 bundles everything into one HTML page
```

### Ports

A feature that needs something owned by another area (the room session, your avatar, the script runtime)
declares a small interface for it in its own `deps.ts` / `port.ts`, with exactly the methods it uses.
`boot/` passes the real object. So a feature can be read, and tested, without the rest of the app.

## How layers talk

```
   features ──► commands ──► store ──► bus ──► render / features (update)
       │                                  ▲
       └──► net (send)        net (receive) ──► commands (as a peer) ──┘
```

- `features` read the store and call `commands`. They never write state.
- `commands` are the only writers. One command = one history entry = one net message.
- A drag or the knife is one *held* action: `commands.startHeld` … `finishHeld` (or `cancelHeld` on Esc). ESLint stops
  features from touching `history` directly.
- `net` receives messages, sanitises them, and applies them as commands marked `remote`
  (no history entry, no re-send).
- `render` listens to the bus and keeps three.js in step with the store.
- Scripts run inside `features/scripts` on the authority peer and also go through commands,
  tagged `script` (not undoable, but synced).
- Physics runs on every peer; the authority's result is the truth and is sent as body states a few times a
  second (`net/physics-bridge.ts`), so balls move smoothly everywhere and react at once when kicked.
- The laws of space (`lib/weight`, `app/space.ts`) are one law for everyone, the owner included: an object weighs its
  triangles plus half its vertices, spread over the 4 m cells it covers; no 20 m window may hold more than a set
  amount, and the scene not more than a ceiling. A person's edit that breaks them is undone with a word why; a peer's
  is judged by the room's authority alone (the owner whenever they are here, otherwise the builder with the smallest
  id, `net/authority.ts`),
  which sends its copy back as a verdict if it refuses (`net/sync/verdict.ts`):
  everyone takes it, so every screen ends up with the same scene, and the person whose edit it was hears why; a scripted move doesn't happen (`on blocked`); a ball bounces off.
  The authority has no more power than building gives: its verdicts are logged under it for the owner's
  "who changed what", a script edit may only move, recolour or change the state of a scripted object, and a newcomer
  takes the scene from the authority alone. What remains: while the owner is away, a peer posing as the authority
  can show a newcomer a scene of its own; only that newcomer sees it, until they enter again.
  A whole scene opened in your own scene, or a room's scene as you enter it, is taken as it is; inside a room nobody,
  its owner included, brings in one over the law. Scripts don't weigh: they pay in gas, per second.
- Saves (autosave, project files, saved rooms) keep scripted objects at rest (`world/resting.ts`): a reload
  starts every script fresh, so the lift is down and the door shut.

Dependency direction, top to bottom only:

```
features → net, avatar, render, app, world, lib, ui
net      → avatar, render, app, world, lib
avatar   → render, app, world, lib
render   → app, world, lib
app      → world, lib
world    → lib
lib, ui  → nothing of ours
```

ESLint's import rules enforce the arrows; a feature importing from another feature is an error
(it goes through the bus instead).

## Rooms and the Gallery

Three things, which never turn into one another:

- **Private room**: a live meeting of people with its link. Everyone builds unless the owner says otherwise, and
  it carries on when the owner leaves: every browser keeps a copy, and the copy of whoever is in it is the room.
  With **Keep online** its encrypted copy also waits on the relays, so it opens when nobody is in it.
- **Public room**: a live meeting anyone can join from the list, only while its owner is in it. It runs on the
  owner's computer (the owner is the script authority), guests watch until the owner lets them build, and it
  closes when the owner leaves. Its code was listed, so it never becomes private again; a copy can.
- **Gallery**: worlds frozen into versions by their author and signed with the author key. Anyone can view one
  (alone, offline) or copy it; nobody can join it.

"Make a copy" (of a room, or of a world you view) is the one bridge: always a new private room of yours, with a
new link. Nothing is published unless its owner does so explicitly.

The owner's rules are signed; people are named in them by a key of their own per room (`net/person.ts`), so a
rule about someone survives a reload. The owner's browser keeps a log of others' edits for half an hour
(`net/moderation/`): "undo their changes" and "rewind" are ordinary, undoable edits of the owner's.

No server holds a room: deleting one removes your copy and asks the relays to drop the online one; the copies of
people who were in it stay theirs.

## Conventions

- Files: `kebab-case.ts`. Types: `PascalCase`. Everything else: `camelCase`.
- A feature exports one function: `mount(deps)`; it returns an object only when boot needs to drive it per frame.
- Events are named `noun:verb`: `world:changed`, `selection:changed`, `room:joined`.
- Messages from peers are typed in `net/messages.ts` and validated in `net/sanitize.ts` before use.
- No `any` outside `sanitize.ts` and third-party glue.
- Early returns over nesting. No ternary chains longer than one `?`.
- Magic numbers get a named constant with its unit: `STEP_HEIGHT_M = 0.5`.

## Working on it

- `npm run check`: typecheck, ESLint (size, complexity and layer rules), Prettier, unit tests. Must stay green.
- `npm run build`: writes `dist/piaskownica.html` (the page as one file), `dist/index.html` and `dist/test.html`
  (the same page as a full document, for hosting and for the tests), and copies the avatars next to them.
- `npm run site`: the build plus PRIVACY.md (generated from `src/app/privacy.ts` by `npm run privacy`) and the
  licences, in `site/`: what `.github/workflows/pages.yml` publishes on GitHub Pages.
- End to end: serve the project root (`python3 -m http.server 8766`), start the local Nostr relay
  (`node test/relay.mjs 7777`), then `python3 test/solo_e2e.py`, `python3 test/mp_e2e.py`, `python3 test/rooms_e2e.py`
  and `python3 test/phone_e2e.py`.
