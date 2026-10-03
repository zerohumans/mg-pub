# APEX DRIVE

A complete, playable 3D arcade racing game for desktop and mobile browsers. Built with Three.js, JavaScript, and Vite. All cars, tracks, scenery, and engine sounds are generated in code. Fonts are bundled locally; the game does not require a backend or runtime CDN.

## Play

GitHub Pages address after Pages is enabled and deployment completes: **https://zerohumans.github.io/mg-pub/**

Three circuits: **Sunset Canyon**, **Alpine Rush**, and **Midnight Run**.

- **Quick Race:** three laps against five AI drivers, with three difficulty levels.
- **Time Trial:** three laps against the clock with device-local personal records.
- **Free Drive:** unlimited laps, no finishing requirement.
- Four car colors, three cameras, rechargeable nitro, collision response, off-road slowdown, and valid sequential checkpoints.
- Pause, restart, track recovery, lap splits, results, synthesized engine audio, live standings, and minimap.
- Touch controls on phones and tablets, performance graphics setting, and persistent preferences.

## Controls

| Action | Keyboard |
| --- | --- |
| Accelerate | W / Up arrow |
| Brake, then reverse | S / Down arrow |
| Steer | A / D or Left / Right arrows |
| Nitro | Shift |
| Handbrake | Space |
| Change camera | C |
| Reset to last checkpoint | R |
| Pause / resume | P / Escape |
| Toggle sound | M |

Mobile players use the on-screen steering, brake, throttle, and nitro buttons. Brake before sharp corners. Driving off the asphalt slows the car; cutting the circuit cannot count a lap. Nitro recharges while not being used. Changing tabs pauses the race automatically.

## Local development

Requires Node.js 22.12+ (Node.js 24 recommended) and npm.

```bash
npm ci
npm run dev
```

Open the local URL shown by Vite.

```bash
npm test          # deterministic physics, all tracks, full three-lap races
npm run build    # self-contained production files in dist/
npm run preview  # serve the production build locally
```

Browser integration tests:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Tests cover rendering, accelerator/brakes, nitro, pause/resume, restart, recovery, camera switching, results, settings persistence, track selection, and mobile controls. Developer test hooks exist only in Vite development mode and are excluded from production.

## GitHub Pages deployment

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Run **Actions → Test and deploy APEX DRIVE → Run workflow**, or push to `main`.
4. Wait for the build and deploy jobs to succeed, then open the Pages URL above.

The included workflow installs the lockfile dependencies, runs simulation tests, builds the game, uploads the `dist/` artifact, and deploys it to Pages. The relative asset base supports the `/mg-pub/` project path. A repository administrator must enable Pages the first time; the default workflow token cannot enable a new Pages site.

## Source layout

- `src/track.js` — circuit generation, arc-length lookup, and closest-road projection.
- `src/simulation.js` — deterministic racing physics, AI, collisions, checkpoints, laps, and timing.
- `src/world.js` — Three.js rendering, procedural vehicles/scenery, lighting, and cameras.
- `src/audio.js` — Web Audio engine synthesis and UI tones.
- `src/main.js` — menus, input, HUD, results, persistence, and fixed-step game loop.
- `src/style.css` — responsive garage and race interfaces.
- `tests/` — simulation and browser integration tests.

## Compatibility and scope

Requires WebGL 2 and a modern browser with hardware acceleration. Performance mode reduces shadows and rendering resolution. Sound begins only after user interaction. Records/settings stay in this browser's local storage; there is no online leaderboard or multiplayer. Physics are arcade-style on flat circuits, rather than a real-world vehicle simulator.

The original repository's `.mergify.yml` is preserved. Third-party code and font licenses remain with their respective packages (Three.js/Vite: MIT; Barlow fonts: SIL Open Font License).
