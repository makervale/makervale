# Makervale

A small 3D world with a built-in editor, running entirely in the browser. Walk around as an avatar, model
objects with mesh tools, give them scripts, and build together with friends over peer-to-peer multiplayer.
No server, no accounts.

**Play it in the browser: https://makervale.github.io/makervale/** (a computer with a mouse works best).

This is a hobby project, vibe-coded (written mostly with an AI assistant), and inspired by Second Life. It
exists to promote one idea: virtual worlds are more fun when the tools to build them are part of the world.

**Status:** experimental prototype. Expect bugs. For adults (18+), see [PRIVACY.md](PRIVACY.md) for what
multiplayer shares and what it risks.

## Run it

```sh
npm install
npm run build                      # dist/index.html, a single page plus avatars
python3 -m http.server -d dist     # then open http://localhost:8000
```

- `npm run check`: typecheck, lint and unit tests
- Every push to `main` is built and published on GitHub Pages (`.github/workflows/pages.yml`; enable it once
  under Settings › Pages › Source: GitHub Actions).

How the code is organised: [ARCHITECTURE.md](ARCHITECTURE.md).

## Licence

MIT, see [LICENSE](LICENSE). Bundled libraries, avatars (CC0) and animations (Apache 2.0, from Overte):
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Second Life is a trademark of Linden Research, Inc. This project is not affiliated with or endorsed by it.
