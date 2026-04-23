# Whisperwood Outbreak

Browser-based pixel-art zombie survival game inspired by classic top-down action games, with a handcrafted forest world driven by pixel-art trails, water, ruins, and dense tree cover.

## Files

- `index.html` - page shell
- `styles.css` - UI and responsive layout
- `game.js` - canvas rendering, controls, mission loop, cops, vehicles, map

## Run

Open `index.html` in a browser.

For the best local experience, you can also run a simple static server from the folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- `WASD` or arrow keys: move / steer
- `Shift`: sprint on foot
- `E`: enter or exit vehicle
- `Space`: brake / handbrake

## Notes

- The game does not render `map.png` directly.
- Instead, it builds a stylized pixel-art city from the road structure and area relationships in the reference map.
- The current world includes winding forest trails, clearings, ruins, marshland, cabins, water bodies, upgrade points, and mission stops.
