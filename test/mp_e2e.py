"""Two browsers in one room through a local relay: scene sync, script authority, forwarded touches, edits,
host controls (build rule, kick) and getting your own scene back after leaving."""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
URL = "http://localhost:8766/dist/test.html?relays=ws://localhost:7777&ice=none"
P = "window.__sandbox"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--disable-features=WebRtcHideLocalIpsWithMdns"]


def obj(name):
    return f'{P}.store.world.objects.find(o => o.name === "{name}")'


def check(label, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + label, detail, flush=True)
    return ok


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    pages = []
    for _ in range(2):
        pg = browser.new_context(viewport={"width": 1100, "height": 720}).new_page()
        logs = []
        pg.on("pageerror", lambda e, logs=logs: logs.append(f"PAGEERROR: {e}"))
        pg.on("websocket", lambda ws, logs=logs: logs.append(f"WS: {ws.url}"))
        pg.on("request", lambda r, logs=logs: logs.append(f"REQ: {r.url}") if "localhost" not in r.url else None)
        pg.goto(URL)
        pg.wait_for_function(f"{P} && {P}.store.world.objects.length > 0", timeout=60000)
        pg.check("#terms-adult"); pg.click("#terms-accept"); pg.wait_for_timeout(300)
        pages.append((pg, logs))
    (A, la), (B, lb) = pages
    own_b = B.evaluate(f"() => {P}.store.world.objects.length")
    # B's own scene: delete everything but three objects, so we can see it come back after leaving
    B.evaluate(f"() => {{ const P = {P}; const keep = P.store.world.objects.slice(0, 3); P.commands.replaceWorld({{ seq: P.store.world.seq, objects: keep }}, 'test', false); }}")
    # nothing is contacted before the privacy note is accepted: no sockets, no requests beyond the page itself
    A.wait_for_timeout(1500)
    check("offline until agreed", not [l for l in la if l.startswith(("WS:", "REQ:"))], str(la[-3:]))
    A.click('[data-win="mp"]'); A.wait_for_timeout(400)
    check("the privacy note comes first", A.locator("#mp-agree").count() == 1 and A.locator("#mp-start").count() == 0)
    A.check("#mp-adult"); A.click("#mp-agree"); A.wait_for_timeout(400)
    A.fill("#mp-room-name", "Test plaza"); A.click("#mp-start")
    A.wait_for_timeout(800)
    code = A.evaluate(f"() => {P}.session.net.id")
    B.click('[data-win="mp"]'); B.wait_for_timeout(400); B.check("#mp-adult"); B.click("#mp-agree"); B.wait_for_timeout(400)
    B.fill("#mp-code", code); B.click("#mp-join")
    B.wait_for_function(f"() => {P}.session.net.synced", timeout=90000)
    na, nb = A.evaluate(f"() => {P}.store.world.objects.length"), B.evaluate(f"() => {P}.store.world.objects.length")
    check("B got A's scene", na == nb, f"{na} {nb}")
    B.wait_for_timeout(1000)
    ra, rb = A.evaluate(f"() => {P}.scripts.runningCount"), B.evaluate(f"() => {P}.scripts.runningCount")
    check("exactly one browser runs scripts", (ra == 0) != (rb == 0), f"A {ra} B {rb}")

    q0 = B.evaluate(f"() => {obj('Door')}.quat")
    A.evaluate(f"() => {P}.bus.emit('object:touched', {{ id: {obj('Door')}.id }})"); B.wait_for_timeout(2500)
    check("A's touch swings B's door", B.evaluate(f"() => {obj('Door')}.quat") != q0)

    e0 = A.evaluate(f"() => JSON.stringify({obj('Lantern')}.materials)")
    B.evaluate(f"() => {P}.bus.emit('object:touched', {{ id: {obj('Lantern')}.id }})"); B.wait_for_timeout(2500)
    check("B's touch reaches the authority", A.evaluate(f"() => JSON.stringify({obj('Lantern')}.materials)") != e0)
    check("…and comes back to B", B.evaluate(f"() => JSON.stringify({obj('Lantern')}.materials)") == A.evaluate(f"() => JSON.stringify({obj('Lantern')}.materials)"))

    # physics: the authority's ball moves on both screens
    auth, other = (A, B) if A.evaluate(f"() => {P}.session.amAuthority()") else (B, A)
    ball = auth.evaluate(f"() => {obj('Ball')}.id")
    y0 = other.evaluate(f"() => {P}.store.byId('{ball}').pos[1]")
    auth.evaluate(f"() => {P}.bus.emit('physics:push', {{ id: '{ball}', vel: [0, 4, 0] }})")
    # headless WebGL runs a few frames a second, so the first body update can take a while to cross
    y1 = y0
    for _ in range(30):
        other.wait_for_timeout(500)
        y1 = other.evaluate(f"() => {P}.store.byId('{ball}').pos[1]")
        if y1 - y0 > 0.5: break
    check("a pushed ball rolls on the other screen too", y1 - y0 > 0.5, f"{y0:.2f} -> {y1:.2f}")
    # headless WebGL runs a few frames a second, so the ball takes a while to come to rest: wait until the
    # physics on both screens has put it to sleep
    asleep = f"() => !!{P}.physics.live.get('{ball}')?.asleep"
    for _ in range(60):
        if auth.evaluate(asleep) and other.evaluate(asleep):
            break
        auth.wait_for_timeout(1500)
    ya = auth.evaluate(f"() => {P}.store.byId('{ball}').pos[1]")
    yo = other.evaluate(f"() => {P}.store.byId('{ball}').pos[1]")
    check("…and both agree where it stopped", abs(ya - yo) < 0.05, f"{ya:.2f} vs {yo:.2f}")

    # music: a chime touched on one screen is heard on both
    for pg in (A, B):
        pg.evaluate(f"() => {{ window.__notes = []; {P}.bus.on('sound:play', (e) => window.__notes.push(e.note)); }}")
    B.evaluate(f"() => {P}.bus.emit('object:touched', {{ id: {obj('Chime 5')}.id }})"); A.wait_for_timeout(2000)
    na, nb = A.evaluate("() => window.__notes"), B.evaluate("() => window.__notes")
    check("a chime is heard by everyone", na == [7] and nb == [7], f"A {na} B {nb}")

    B.evaluate(f"() => {P}.session.say('hello from B')"); A.wait_for_timeout(1500)
    check("chat reaches A", A.evaluate(f"() => {P}.session.net.chat.some(l => l.text === 'hello from B')"))

    crate = B.evaluate(f"() => {{ const P = {P}; const o = {obj('Crate')}; P.commands.selectObject(o, false); P.useTool('delete'); return o.id; }}")
    try:
        A.wait_for_function(f"() => !{P}.store.byId('{crate}')", timeout=10000)
        gone = True
    except Exception:
        gone = False
    check("B's delete reaches A", gone)

    A.evaluate(f"() => {P}.session.setEveryoneBuilds(false)"); B.wait_for_timeout(1500)
    check("B may not build after the owner disallows", not B.evaluate(f"() => {P}.session.canIBuild()"))
    A.evaluate(f"() => {P}.session.setEveryoneBuilds(true)"); B.wait_for_timeout(1500)
    check("B may build again", B.evaluate(f"() => {P}.session.canIBuild()"))

    bid = B.evaluate(f"() => {P}.session.net.selfId")
    A.evaluate(f"() => {P}.session.kick('{bid}')"); B.wait_for_timeout(5000)
    check("kicked B is out of the room", not B.evaluate(f"() => {P}.session.inRoom()"))
    nb2 = B.evaluate(f"() => {P}.store.world.objects.length")
    check("B has its own scene back", nb2 == 3, str(nb2))
    A.screenshot(path=f"{OUT}/mp_A.png"); B.screenshot(path=f"{OUT}/mp_B.png")
    for line in la + lb:
        if line.startswith("PAGEERROR"): print(line)
    browser.close()
