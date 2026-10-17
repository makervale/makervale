"""Rooms and the Gallery, end to end, in three browsers through a local relay: a private room (everyone builds, the
owner stops one person, asks to build, undo their changes), a public room (listed while the owner is in it, guests
watch, it closes when the owner leaves) and the Gallery (publish, view, make a copy)."""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
URL = "http://localhost:8766/dist/test.html?relays=ws://localhost:7777&ice=none"
P = "window.__sandbox"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--disable-features=WebRtcHideLocalIpsWithMdns"]
results = []


def check(label, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + label, detail, flush=True)
    results.append(ok)
    return ok


def ev(pg, js):
    return pg.evaluate(f"() => {{ const S = {P}.session; return {js}; }}")


def wait(pg, js, ms=60000):
    pg.wait_for_function(f"() => {{ const S = {P}.session; return {js}; }}", timeout=ms)


def until(pg, js, ms=30000):
    """does `js` come true on this page within `ms`? Headless WebGL can stall a page for seconds, so a message's
    arrival is waited for, not timed"""
    try:
        pg.wait_for_function(f"() => {{ const S = {P}.session; return {js}; }}", timeout=ms)
        return True
    except Exception:
        return False


def shot(pg, name):
    """a picture for a person to look at, not a check: a page stalled past the timeout costs the picture only"""
    try:
        pg.screenshot(path=f"{OUT}/{name}.png", timeout=60000)
    except Exception as e:
        print(f"(no {name}.png: {type(e).__name__})", flush=True)


def online(pg):
    pg.click('[data-win="mp"]'); pg.wait_for_timeout(300)
    pg.check("#mp-adult"); pg.click("#mp-agree"); pg.wait_for_timeout(300)


def add_box(pg, name):
    pg.evaluate(f"""() => {{ const W = {P}; const o = structuredClone(W.store.world.objects[0]);
      o.id = 'o' + (W.store.world.seq++); o.name = '{name}'; o.pos = [3, 1, 3];
      W.commands.act('add', [o.id], () => W.store.world.objects.push(o)); }}""")


def private_room(A, B):
    A.fill("#mp-room-name", "Friends"); A.click("#mp-start")
    wait(A, "S.net.rules !== null")
    shot(A, "r_owner_alone")
    code = ev(A, "S.net.id")
    B.fill("#mp-code", code); B.click("#mp-join")
    wait(B, "S.net.synced")
    check("B joins by code and gets the scene", ev(B, f"{P}.store.world.objects.length") == ev(A, f"{P}.store.world.objects.length"))
    check("in a private room everyone builds", ev(B, "S.canIBuild()"))
    add_box(B, "Grief")
    check("B's box reaches A", until(A, f"!!{P}.store.world.objects.find(o => o.name === 'Grief')"))
    A.wait_for_timeout(500); shot(A, "r_owner_room")
    A.click(".mp-switch:has(#mp-everyone)"); wait(B, "!S.canIBuild()")
    check("owner turns 'Everyone builds' off: B watches", True)
    B.wait_for_timeout(300); shot(B, "r_guest_watching")
    B.click("#mp-ask")
    check("A is asked", until(A, "(document.querySelector('.toast')?.textContent ?? '').includes('asks to build')"))
    A.click(".toast button"); wait(B, "S.canIBuild()")
    check("…lets B build", True)
    who = ev(A, f"S.personOf(Object.keys(Object.fromEntries(S.net.peers))[0])")
    n = ev(A, f"S.undoPerson('{who}')")
    check("undo B's changes removes the box everywhere", n >= 1 and until(B, f"!{P}.store.world.objects.find(o => o.name === 'Grief')"), str(n))
    B.click("#mp-leave"); A.click("#mp-leave"); A.wait_for_timeout(800)
    return code


def public_room(A, B, C):
    A.click('[data-tab="rooms"]'); A.fill("#mp-room-name", "Open plaza")
    A.click(".mp-seg label:has(input[value=public])"); A.click("#mp-start")
    wait(A, "S.net.rules !== null && S.net.rules.kind === 'public'")
    C.click('[data-tab="public"]')
    C.wait_for_function("() => document.querySelector('[data-join-public]')", timeout=20000)
    shot(C, "r_public_list")
    check("listed under Public while the owner is in", True)
    C.click("[data-join-public]"); wait(C, "S.net.synced")
    check("guests watch in a public room", not ev(C, "S.canIBuild()"))
    C.wait_for_timeout(300); shot(C, "r_public_guest")
    A.click('[data-tab="rooms"]'); A.click("#mp-leave")
    wait(C, "!S.inRoom()", 30000)
    check("the room closes for guests when the owner leaves", True)
    C.wait_for_timeout(15000)
    C.click('[data-tab="public"]'); C.wait_for_timeout(500)
    check("and leaves the Public list", C.locator("[data-join-public]").count() == 0)


def gallery(A, B):
    A.click('[data-tab="gallery"]'); A.wait_for_timeout(500)
    A.click("#mp-publish-open"); A.fill("#mp-pub-title", "Little plaza"); A.fill("#mp-pub-about", "A square with a fountain")
    shot(A, "r_publish_form")
    A.click("#mp-publish")
    A.wait_for_function("() => document.querySelector('[data-unpublish]')", timeout=60000)
    check("A publishes v1", True)
    B.click('[data-tab="gallery"]'); B.click("#mp-gallery-refresh")
    B.wait_for_function("() => document.querySelector('[data-view]')", timeout=30000)
    shot(B, "r_gallery")
    B.click("[data-view]"); wait(B, "S.net.viewing !== null", 60000)
    check("B views it, and may not build", not ev(B, "S.canIBuild()") and not ev(B, "S.inOwnScene()"))
    B.wait_for_timeout(500); shot(B, "r_viewing")
    B.click('[data-viewbar="copy"]'); wait(B, "S.inRoom() && S.net.synced", 30000)
    check("make a copy: B's own private room", ev(B, "S.amOwner() && S.net.rules.kind === 'private'"))
    B.click('[data-tab="rooms"]'); B.wait_for_timeout(300); shot(B, "r_copy_room")


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    pages = []
    for i in range(3):
        pg = browser.new_context(viewport={"width": 1100, "height": 760}).new_page()
        pg.on("pageerror", lambda e, i=i: print(f"PAGEERROR {i}: {e}", flush=True))
        pg.goto(URL, wait_until="domcontentloaded", timeout=90000)
        pg.wait_for_function(f"{P} && {P}.store.world.objects.length > 0", timeout=60000)
        pg.check("#terms-adult"); pg.click("#terms-accept"); pg.wait_for_timeout(300)
        online(pg)
        pages.append(pg)
    A, B, C = pages
    shot(A, "r_lobby")
    private_room(A, B)
    public_room(A, B, C)
    gallery(A, B)
    A.click('[data-tab="settings"]'); A.wait_for_timeout(300); shot(A, "r_settings")
    browser.close()
print(f"{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
