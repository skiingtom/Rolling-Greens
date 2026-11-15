# Rolling Greens

Build a golf resort that looks like a **painting come to life** — a high aerial view of the grounds rendered as oil on canvas (Kuwahara brushwork, linen weave, raking low-sun shadows through dark spruce): claim raw land, terraform it, and construct each hole by hand — while golfers walk, drive carts, and actually play the holes around you.

## Play

```bash
npm install
npm run dev
```

## How to play

1. Arrive at the **clubhouse** on County Rd 7 with a starter **driving range** already hosting live practice swings.
2. **Collect range fees**, then **claim land** — new plots start as **raw meadow**.
3. **Build right in the 3D view** — click any plot and the camera swoops in: drag on the land to **terraform** hills and hollows, dig water, and **lay surfaces** (fairway, green, bunkers, paths); click to place tee and cup. Right-drag orbits, scroll zooms, Esc finishes.
4. **Dig sand traps** — the Bunker surface sinks into a real bowl (set *Trap depth*, then reshape with Land sculpt).
5. **Decorate the grounds** — benches, flower beds, oaks and birches, lamp posts, a gazebo, fountain, statue or clock tower. Grounds appeal adds to weekly fees.
6. **Open the hole** for play — guests tee off, walk or cart to their ball, and putt out in the 3D park.
7. Playtest any hole in a full 3D green view with pull-back aiming.
8. Grow **9 → 18 → second 18 (36 holes)** and expand the range.

Drag to pan, right-drag to orbit, scroll to zoom.

## Windows desktop app

```bash
npm run dist:win            # → release/Rolling-Greens-<version>-Portable.exe (+ a zip)
npm run dist:win-installer  # → release/Rolling-Greens-Setup-<version>.exe (needs Windows, or Wine)
npm run desktop             # run the desktop shell locally
```

The **Windows build** GitHub Action builds both the installer and the portable
`.exe` on a Windows runner — run it from the Actions tab, or push a `v*` tag to
attach them to a release. The app is unsigned, so Windows SmartScreen will warn
on first launch (*More info → Run anyway*). F11 toggles fullscreen; saves live
in the app's own profile. Progress saves in the browser.
