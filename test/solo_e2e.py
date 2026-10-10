"""One browser: clicks touch scripts while the Build window is closed and select while it is open, the pie menu,
a tool with undo, avatar flying and sitting, time of day, and the autosave surviving a reload."""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
URL = "http://localhost:8766/dist/test.html?relays=ws://localhost:7777&ice=none"
P = "window.__sandbox"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
failed = []


def obj(name):
    return f'{P}.store.world.objects.find(o => o.name === "{name}")'


def check(label, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + label, detail, flush=True)
    if not ok:
        failed.append(label)


SCAN = f"""(id) => {{ const P = {P}; const r = document.getElementById('view').getBoundingClientRect();
  for (let y = r.top + 20; y < r.bottom - 20; y += 12) for (let x = r.left + 20; x < r.right - 20; x += 12) {{
    const h = P.renderer.picker.pickWorld(x, y); if (h && h.id === id) return [x, y]; }} return null; }}"""


def screen_of(pg, name):
    """a screen point where the object is the first thing under the cursor, once the camera framed it and settled
    (headless WebGL runs at a few frames per second, so the camera eases slowly)"""
    oid = pg.evaluate(f"() => {{ const o = {obj(name)}; {P}.renderer.framing.frame([o]); return o.id; }}")
    last = None
    for _ in range(20):
        pg.wait_for_timeout(700)
        at = pg.evaluate(SCAN, oid)
        if at and at == last:
            return at
        last = at
    return last or [0, 0]


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    pg = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.evaluate("() => { localStorage.clear(); indexedDB.deleteDatabase('piaskownica'); }")
    pg.reload()
    pg.wait_for_function(f"{P} && {P}.store.world.objects.length > 0", timeout=60000)
    # the terms come first, once: accepted here, remembered across the reloads below
    check("the terms screen comes first", pg.locator("#terms-accept").is_visible())
    check("…and can't be accepted without confirming the age", pg.locator("#terms-accept").is_disabled())
    pg.check("#terms-adult"); pg.click("#terms-accept"); pg.wait_for_timeout(300)
    check("…and is gone once accepted", pg.locator("#terms").count() == 0)
    pg.wait_for_timeout(1500)
    check("Build window starts closed", pg.evaluate("() => document.getElementById('build').hidden"))

    lantern = pg.evaluate(f"() => {obj('Lantern')}.id")
    m0 = pg.evaluate(f"() => JSON.stringify({P}.store.byId('{lantern}').materials)")
    x, y = screen_of(pg, "Lantern")
    pg.mouse.move(x, y); pg.wait_for_timeout(200)
    check("cursor turns into a hand over a touchable object", pg.evaluate("() => getComputedStyle(document.getElementById('view')).cursor") == "pointer")
    pg.mouse.click(x, y); pg.wait_for_timeout(2000)
    check("click with Build closed touches the lantern", pg.evaluate(f"() => JSON.stringify({P}.store.byId('{lantern}').materials)") != m0)
    check("…and selects nothing", pg.evaluate(f"() => {P}.store.selection.objects.size") == 0)

    pg.click('[data-win="build"]'); pg.wait_for_timeout(400)
    x, y = screen_of(pg, "Bench"); pg.mouse.click(x, y); pg.wait_for_timeout(500)
    sel = pg.evaluate(f"() => [...{P}.store.selection.objects].map(id => {P}.store.byId(id).name)")
    check("click with Build open selects", "Bench" in sel, str(sel))

    handle = pg.evaluate(f"""() => {{ const P = {P}; const r = document.getElementById('view').getBoundingClientRect();
      for (let y = r.top + 10; y < r.bottom - 10; y += 4) for (let x = r.left + 10; x < r.right - 10; x += 4) {{
        const h = P.pickHandle(x, y); if (h && h.userData.kind === 'axis') return [x, y]; }} return null; }}""")
    check("the move arrows are under the selection", handle is not None)
    if handle:
        pos0 = pg.evaluate(f"() => {P}.store.byId([...{P}.store.selection.objects][0]).pos")
        pg.mouse.move(*handle); pg.mouse.down()
        for i in range(1, 9):
            pg.mouse.move(handle[0] + i * 8, handle[1] - i * 4); pg.wait_for_timeout(40)
        pg.mouse.up(); pg.wait_for_timeout(400)
        pos1 = pg.evaluate(f"() => {P}.store.byId([...{P}.store.selection.objects][0]).pos")
        check("dragging an arrow moves the object", pos1 != pos0, f"{pos0} -> {pos1}")
        pg.evaluate(f"() => {P}.commands.undo()"); pg.wait_for_timeout(300)
        pos2 = pg.evaluate(f"() => {P}.store.byId([...{P}.store.selection.objects][0]).pos")
        check("one undo puts it back", pos2 == pos0, f"{pos2}")

    pg.mouse.click(x, y, button="right"); pg.wait_for_timeout(500)
    check("right click opens the pie", pg.evaluate("() => !document.getElementById('pie').hidden"))
    pg.screenshot(path=f"{OUT}/solo_pie.png")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Esc closes the pie", pg.evaluate("() => document.getElementById('pie').hidden"))

    n0 = pg.evaluate(f"() => {P}.store.world.objects.length")
    pg.evaluate(f"() => {P}.useTool('duplicate')"); pg.wait_for_timeout(500)
    pg.keyboard.press("Escape")
    n1 = pg.evaluate(f"() => {P}.store.world.objects.length")
    check("duplicate adds objects", n1 > n0, f"{n0} -> {n1}")
    pg.evaluate(f"() => {P}.commands.undo()"); pg.wait_for_timeout(300)
    check("undo removes them", pg.evaluate(f"() => {P}.store.world.objects.length") == n0)

    pg.evaluate(f"() => {P}.bus.emit('sky:set', {{ mode: 'night' }})"); pg.wait_for_timeout(2500)
    pg.screenshot(path=f"{OUT}/solo_night.png")
    check("night sets a dark sky", pg.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--sky-top')") != "")

    pg.click('[data-close="build"]'); pg.wait_for_timeout(300)
    pg.evaluate(f"() => {P}.avatar.setFlying(true)"); pg.wait_for_timeout(300)
    check("Fly button says Land while flying", pg.evaluate("() => document.querySelector('#av-btn span').textContent") == "Land")
    pg.evaluate(f"() => {P}.avatar.setFlying(false)")
    pg.evaluate(f"() => {{ const b = {obj('Bench')}; {P}.sitAt(b.pos[0], b.pos[1], b.pos[2] + 0.3); }}"); pg.wait_for_timeout(800)
    check("sitting on the bench", pg.evaluate(f"() => {P}.avatar.sitting"))
    pg.evaluate(f"() => {P}.gesture('wave')"); pg.wait_for_timeout(600)
    pg.screenshot(path=f"{OUT}/solo_sit.png")

    bench = pg.evaluate(f"() => {{ const P = {P}; const o = {obj('Bench')}; P.commands.selectObject(o, false); P.useTool('delete'); return o.id; }}")
    pg.wait_for_timeout(1200)
    check("bench deleted before reload", pg.evaluate(f"() => !{P}.store.byId('{bench}')"))
    check("autosave written without it", pg.evaluate(f"() => !(localStorage.getItem('pias.world.v9') || '').includes('\"{bench}\"')"))
    pg.reload(); pg.wait_for_function(f"{P} && {P}.store.world.objects.length > 0", timeout=60000)
    check("autosave keeps the edit after reload", pg.evaluate(f"() => !{P}.store.byId('{bench}')"))
    # the playground: the trampoline throws you up, walking into the ball kicks it
    pg.evaluate(f"() => {P}.avatar.teleportTo({{ x: 6.1, y: 3.4, z: 1.5 }})")
    top = 0
    for _ in range(12):
        pg.wait_for_timeout(500)
        top = max(top, pg.evaluate(f"() => {P}.avatar.state.pos.z"))
    check("the trampoline throws you up", top > 3, f"{top:.1f} m")
    ball = pg.evaluate(f"() => {obj('Ball')}.id")
    y0 = pg.evaluate(f"() => {P}.store.byId('{ball}').pos[1]")
    pg.evaluate(f"() => {{ const a = {P}.avatar; a.teleportTo({{ x: 0, y: 25.6, z: 0.1 }}); a.state.yaw = 0; }}")
    pg.wait_for_timeout(800)
    pg.click("#view", position={"x": 600, "y": 120})
    # walk until you touch it, then stop: the ball must roll on by itself, not only move while your foot is on it
    pg.keyboard.down("KeyW")
    pg.wait_for_function(f"() => {P}.store.byId('{ball}').pos[1] > {y0} + 0.05", timeout=30000)
    pg.keyboard.up("KeyW")
    me = pg.evaluate(f"() => {P}.avatar.state.pos.y")
    pg.wait_for_timeout(8000)
    y1 = pg.evaluate(f"() => {P}.store.byId('{ball}').pos[1]")
    check("a touch knocks the ball on, and it rolls by itself", y1 - me > 1.5, f"ball {y0:.2f} -> {y1:.2f}, you at {me:.2f}")

    # a script's own changes are not saved: the lift comes back down after a reload, and still works
    lift = pg.evaluate(f"() => {obj('Lift')}.id")
    z0 = pg.evaluate(f"() => {P}.store.byId('{lift}').pos[2]")
    pg.evaluate(f"() => {P}.bus.emit('object:touched', {{ id: '{lift}' }})"); pg.wait_for_timeout(4000)
    check("touching the lift raises it", pg.evaluate(f"() => {P}.store.byId('{lift}').pos[2]") > z0 + 1)
    pg.wait_for_timeout(1000)
    pg.reload(); pg.wait_for_function(f"{P} && {P}.store.world.objects.length > 0", timeout=60000)
    check("after a reload the lift is down again", abs(pg.evaluate(f"() => {P}.store.byId('{lift}').pos[2]") - z0) < 0.01)
    pg.evaluate(f"() => {P}.bus.emit('object:touched', {{ id: '{lift}' }})"); pg.wait_for_timeout(4000)
    check("…and its script still works", pg.evaluate(f"() => {P}.store.byId('{lift}').pos[2]") > z0 + 1)
    for e in errors:
        print("PAGEERROR", e)
    print("FAILED:", failed if failed else "none")
    browser.close()
