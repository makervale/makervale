import sys, asyncio
from playwright.async_api import async_playwright
async def main(url, out=None):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page()
        pg.on('console', lambda m: print('console:', m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: print('pageerror:', e))
        await pg.goto(url)
        await pg.wait_for_function('window.RESULT !== undefined', timeout=300000)
        r = await pg.evaluate('window.RESULT')
        if out: open(out,'w').write(r); print('wrote', out, len(r))
        else: print(r)
        await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2] if len(sys.argv)>2 else None))
