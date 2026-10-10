"""A phone: the joystick walks, a held finger opens the pie, windows drag by touch, Build explains it's desktop only."""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
URL = "http://localhost:8766/dist/test.html?relays=ws://localhost:7777&ice=none"
P = "window.__sandbox"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
failed = []


def check(label, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + label, detail, flush=True)
    if not ok:
        failed.append(label)


def touch(cdp, kind, x, y):
    points = [] if kind == "touchEnd" else [{"x": x, "y": y, "id": 1}]
    cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": points})


def drag(pg, cdp, start, end, steps=8, hold_ms=0):
    touch(cdp, "touchStart", *start)
    for i in range(1, steps + 1):
        x = start[0] + (end[0] - start[0]) * i / steps
        y = start[1] + (end[1] - start[1]) * i / steps
        touch(cdp, "touchMove", x, y)
        pg.wait_for_timeout(30)
    if hold_ms:
        pg.wait_for_timeout(hold_ms)
    touch(cdp, "touchEnd", 0, 0)


def centre(pg, selector):
    b = pg.locator(selector).bounding_box()
    return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function(f"{P} && {P}.store.world.objects.length > 0", timeout=60000)
    pg.locator("#terms-adult").tap(); pg.locator("#terms-accept").tap(); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1500)
    cdp = ctx.new_cdp_session(pg)
    check("phone layout is on", pg.evaluate("() => document.documentElement.classList.contains('phone')"))
    check("a card says the phone version is limited", pg.locator("#phone-notice").is_visible())
    pg.screenshot(path=f"{OUT}/phone_notice.png")
    check("no sound before the first tap", pg.evaluate(f"() => {P}.sound.state()") == "locked")
    pg.locator("#phone-ok").tap(); pg.wait_for_timeout(300)
    check("the first tap turns the sound on", pg.evaluate(f"() => {P}.sound.state()") == "running",
          pg.evaluate(f"() => {P}.sound.state()"))
    check("…and goes away when dismissed", pg.locator("#phone-notice").count() == 0)
    pg.reload(); pg.wait_for_function(f"{P} && {P}.store.world.objects.length > 0", timeout=60000)
    check("…and stays away for this visit", pg.locator("#phone-notice").count() == 0)
    cdp = ctx.new_cdp_session(pg)
    check("joystick is shown", pg.locator("#stick").is_visible())

    pos0 = pg.evaluate(f"() => {P}.avatar.state.pos.toArray()")
    sx, sy = centre(pg, "#stick")
    drag(pg, cdp, (sx, sy), (sx, sy - 60), hold_ms=2500)
    pos1 = pg.evaluate(f"() => {P}.avatar.state.pos.toArray()")
    moved = sum((a - b) ** 2 for a, b in zip(pos0, pos1)) ** 0.5
    check("pushing the joystick up walks the avatar", moved > 0.5, f"{moved:.2f} m")
    pg.wait_for_timeout(1500)
    pos2 = pg.evaluate(f"() => {P}.avatar.state.pos.toArray()")
    check("letting go stops it", sum((a - b) ** 2 for a, b in zip(pos1, pos2)) ** 0.5 < 0.3)

    touch(cdp, "touchStart", 195, 300); pg.wait_for_timeout(900); touch(cdp, "touchEnd", 0, 0)
    pg.wait_for_timeout(300)
    check("a held finger opens the pie", pg.evaluate("() => !document.getElementById('pie').hidden"))
    labels = pg.evaluate("() => document.getElementById('pie').textContent")
    check("…without building items", "Build" not in labels and "Edit" not in labels, labels)
    pg.screenshot(path=f"{OUT}/phone_pie.png")
    pg.evaluate("() => document.getElementById('pie').hidden = true")

    pg.locator('[data-win="build"]').tap(); pg.wait_for_timeout(400)
    check("Build stays closed on a phone", pg.evaluate("() => document.getElementById('build').hidden"))
    check("…and says why", "computer" in (pg.evaluate("() => document.querySelector('.toast')?.textContent") or ""))
    pg.evaluate(f"() => {P}.bus.emit('tool:use', {{ id: 'cube' }})"); pg.wait_for_timeout(300)
    check("tools can't open it either", pg.evaluate("() => document.getElementById('build').hidden"))

    pg.locator('[data-win="camfl"]').tap(); pg.wait_for_timeout(300)
    check("Camera window stays closed on a phone", pg.evaluate("() => document.getElementById('camfl').hidden"))
    pg.evaluate(f"() => {P}.bus.emit('search:open', {{}})"); pg.wait_for_timeout(300)
    check("quick search stays closed on a phone", pg.locator(".qs").count() == 0)
    check("building menus are hidden", not pg.locator(".desktop-only-menu").first.is_visible())

    pg.locator('[data-win="mp"]').tap(); pg.wait_for_timeout(500)
    x0 = pg.locator("#mp").bounding_box()["y"]
    hx, hy = centre(pg, "#mp .fhead .ft")
    drag(pg, cdp, (hx, hy), (hx, hy - 150))
    pg.wait_for_timeout(300)
    x1 = pg.locator("#mp").bounding_box()["y"]
    check("a window drags by touch", x0 - x1 > 100, f"{x0:.0f} -> {x1:.0f}")
    pg.screenshot(path=f"{OUT}/phone_mp.png")
    pg.locator('[data-close="mp"]').tap()

    pg.evaluate(f"() => {P}.avatar.setFlying(true)"); pg.wait_for_timeout(300)
    check("up/down buttons while flying", pg.locator("#climb").is_visible())
    z0 = pg.evaluate(f"() => {P}.avatar.state.pos.z")
    ux, uy = centre(pg, '[data-climb="1"]')
    touch(cdp, "touchStart", ux, uy); pg.wait_for_timeout(1500); touch(cdp, "touchEnd", 0, 0)
    check("holding up climbs", pg.evaluate(f"() => {P}.avatar.state.pos.z") - z0 > 0.5)
    pg.screenshot(path=f"{OUT}/phone_fly.png")
    for e in errors:
        print("PAGEERROR", e)
    print("FAILED:", failed if failed else "none")
    browser.close()
