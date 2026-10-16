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


def wait(pg, js, ms=30000):
    pg.wait_for_function(f"() => {{ const S = {P}.session; return {js}; }}", timeout=ms)


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
    A.screenshot(path=f"{OUT}/r_owner_alone.png")
    code = ev(A, "S.net.id")
    B.fill("#mp-code", code); B.click("#mp-join")
    wait(B, "S.net.synced")
    check("B joins by code and gets the scene", ev(B, f"{P}.store.world.objects.length") == ev(A, f"{P}.store.world.objects.length"))
    check("in a private room everyone builds", ev(B, "S.canIBuild()"))
    add_box(B, "Grief"); A.wait_for_timeout(1500)
    check("B's box reaches A", A.evaluate(f"() => !!{P}.store.world.objects.find(o => o.name === 'Grief')"))
    A.wait_for_timeout(500); A.screenshot(path=f"{OUT}/r_owner_room.png")
    A.click(".mp-switch:has(#mp-everyone)"); wait(B, "!S.canIBuild()")
    check("owner turns 'Everyone builds' off: B watches", True)
    B.wait_for_timeout(300); B.screenshot(path=f"{OUT}/r_guest_watching.png")
    B.click("#mp-ask"); A.wait_for_timeout(1500)
    check("A is asked", "asks to build" in A.inner_text(".toast"))
    A.click(".toast button"); wait(B, "S.canIBuild()")
    check("…lets B build", True)
    who = ev(A, f"S.personOf(Object.keys(Object.fromEntries(S.net.peers))[0])")
    n = ev(A, f"S.undoPerson('{who}')"); A.wait_for_timeout(1500)
    check("undo B's changes removes the box everywhere", n >= 1 and not B.evaluate(f"() => !!{P}.store.world.objects.find(o => o.name === 'Grief')"), str(n))
    B.click("#mp-leave"); A.click("#mp-leave"); A.wait_for_timeout(800)
    return code


def public_room(A, B, C):
    A.click('[data-tab="rooms"]'); A.fill("#mp-room-name", "Open plaza")
    A.click(".mp-seg label:has(input[value=public])"); A.click("#mp-start")
    wait(A, "S.net.rules !== null && S.net.rules.kind === 'public'")
    C.click('[data-tab="public"]')
    C.wait_for_function("() => document.querySelector('[data-join-public]')", timeout=20000)
    C.screenshot(path=f"{OUT}/r_public_list.png")
    check("listed under Public while the owner is in", True)
    C.click("[data-join-public]"); wait(C, "S.net.synced")
    check("guests watch in a public room", not ev(C, "S.canIBuild()"))
    C.wait_for_timeout(300); C.screenshot(path=f"{OUT}/r_public_guest.png")
    A.click('[data-tab="rooms"]'); A.click("#mp-leave")
    wait(C, "!S.inRoom()", 30000)
    check("the room closes for guests when the owner leaves", True)
    C.wait_for_timeout(15000)
    C.click('[data-tab="public"]'); C.wait_for_timeout(500)
    check("and leaves the Public list", C.locator("[data-join-public]").count() == 0)


def gallery(A, B):
    A.click('[data-tab="gallery"]'); A.wait_for_timeout(500)
    A.click("#mp-publish-open"); A.fill("#mp-pub-title", "Little plaza"); A.fill("#mp-pub-about", "A square with a fountain")
    A.screenshot(path=f"{OUT}/r_publish_form.png")
    A.click("#mp-publish")
    A.wait_for_function("() => document.querySelector('[data-unpublish]')", timeout=60000)
    check("A publishes v1", True)
    B.click('[data-tab="gallery"]'); B.click("#mp-gallery-refresh")
    B.wait_for_function("() => document.querySelector('[data-view]')", timeout=30000)
    B.screenshot(path=f"{OUT}/r_gallery.png")
    B.click("[data-view]"); wait(B, "S.net.viewing !== null", 60000)
    check("B views it, and may not build", not ev(B, "S.canIBuild()") and not ev(B, "S.inOwnScene()"))
    B.wait_for_timeout(500); B.screenshot(path=f"{OUT}/r_viewing.png")
    B.click('[data-viewbar="copy"]'); wait(B, "S.inRoom() && S.net.synced", 30000)
    check("make a copy: B's own private room", ev(B, "S.amOwner() && S.net.rules.kind === 'private'"))
    B.click('[data-tab="rooms"]'); B.wait_for_timeout(300); B.screenshot(path=f"{OUT}/r_copy_room.png")


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
    A.screenshot(path=f"{OUT}/r_lobby.png")
    private_room(A, B)
    public_room(A, B, C)
    gallery(A, B)
    A.click('[data-tab="settings"]'); A.wait_for_timeout(300); A.screenshot(path=f"{OUT}/r_settings.png")
    browser.close()
print(f"{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
