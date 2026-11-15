# Plein Air
(mapnaam: "Levend schilderij")

## Visie
Een webapp die een schilderij laat leven. Het beweegt subtiel, het licht volgt de echte tijd van de dag in Gouda, en het echte weer (en de maanfase) komt mee naar binnen.
Eerste focus: één schilderij, De Sterrennacht (Van Gogh). Overdag moet dat er echt als dag uitzien, 's nachts als nacht.

## Over mij
Ik lees geen code. Leg uit in termen van architectuur (layers, modules, data flow) met de juiste Engelse vakterm.
Hou uitleg kort. Laat na elke feature zien hoe ik het in de browser test.

## Starten
- Dubbelklik `start.bat` → start `server.py` (Python, alleen standaardbibliotheek) en opent http://localhost:8000
- URL-opties: `?frame` = lijst-modus · `?weather=clear|cloudy|drizzle|rain|storm|snow|fog` = weer forceren · `?time=13:00` = vaste tijd · `?date=2021-02-07` = een dag kiezen (echte zon, maan en weer van Gouda die dag, vanaf 1940; ook via het datumveld; Live = terug naar nu; niet in frame-modus of demo) · `?moon=0..1` = maanfase (0 nieuw, .5 vol) · `?cover=0.7` = sneeuwdek · `?relief=0..1` = verfreliëf (0 uit, standaard 0,6) · `?clean` = zonder knoppen
- Demo: `?demo` speelt de film af (spatie = pauze, ←/→ = 2 s spoelen); `?demo&t=14&pause` = één exact frame
- Sneltoetsen: M = masks tonen (debug), F = frame-modus; `tools/masks.html` = masks opnieuw genereren

## Online
- **Op de telefoon (GitHub Pages): https://tabspoel1991.github.io/plein-air/** (toont wat op `main` staat, ~1 min na een push)
- Backup: https://github.com/tabspoel1991/plein-air (branch `main`); na elke commit `git push`
- Zonder `server.py` werkt alles behalve masks opslaan (`tools/masks.html`) en de film renderen; die blijven op de pc

## Film opnieuw maken
- `render-film.bat` (eindversie, ~10-20 min) of `render-film.bat concept` (960×540, ~1 min)
- Dat draait `tools/render_film.py`: start een eigen server op poort 8765 + Chrome zonder venster op `?demo&render=final`; de pagina stuurt elk frame als ruwe RGBA naar `server.py`, die het direct aan ffmpeg geeft (`film/_master-*.mp4`). Daarna: muziek (fade in 2 s / uit 3 s), `film/plein-air-demo-4k.mp4`, `-1080p.mp4` (2-pass, < 16 MB) en 3 stills
- Alleen opnieuw muxen (bijv. andere muziek): `python tools/render_film.py final --mux`
- Storyboard/timing aanpassen: `js/demo/timeline.js` (keyframes per scène, bijschriften, titel)

## Architectuur (data flow per frame)
`input` → `scene` → `time` + `weather` → `motion` + `relight` → `render`, met `ui` eromheen; `js/main.js` verbindt ze. Bij `?demo` neemt `js/demo/` de klok over.

- `js/input/image.js`: afbeelding laden (met retry), schalen naar max 2048 px, helderheid meten. Standaard `assets/sterrennacht.jpg`
- `js/scene/`
  - `autoMasks.js`: maakt masks uit kleur + helderheid + positie; vindt sterren en maan
  - `flowField.js`: streekrichting per pixel (structure tensor) → `flow.png`
  - `relief.js`: hoogtekaart + normal map van de verf (helderheid, uitgesmeerd langs het flow field) → texture `u_relief`, één keer bij het laden
  - `scene.js`: laadt `assets/masks/*.png` + `scene.json` en pakt ze in 2 RGBA-textures (A: lucht, sterren, maan, cipres · B: dorp, ramen, heuvels). Eigen upload → simpele lucht/land-verdeling
- `js/time/`: `day.js` de gekozen dag (`?date=`) · `sun.js` zonnestand Gouda → `profile.js` lichtprofiel (dag, nacht, lampen, schemering, gouden uur, zonpositie, kleuren; vloeiend ge-eased) · `moon.js` maanfase (synodische maand)
- `js/weather/`: `weather.js` haalt elke 15 min Open-Meteo op (cache in localStorage, anders helder), zet het om in een weather state (cloud, rain, snow, fog, wind 0..1), `applyWeather` dempt het lichtprofiel, `windToMotion` wind → beweging · `history.js` het weer van één gekozen dag, per uur (Open-Meteo forecast ±90 dagen, anders archief vanaf 1940; zelfde `classify`, sneeuwdek uit gemeten sneeuwhoogte, cache per dag) · `state.js` laat de state vloeiend naar het doel lopen en houdt het sneeuwdek bij
- `js/motion/motion.js`: bewegingswaarde (slider, of "Auto (wind)") → bewegingsklok (staat stil op 0) + sterkte, korrel, zoom; plus de weerklok voor regen/sneeuw
- `js/relight/relight.js`: profiel → shader-uniforms (incl. maanschijf + fase, strijklicht van zon/maan × `?relief`); de kleurregels staan in de shader
- `js/render/`: `renderer.js` (WebGL1, meerdere programs, render targets, vaste resolutie voor de film), `quality.js` (adaptieve resolutie), `shaders/main.frag` (MOTION → maanfase → RELIGHT met wervelende wolken (`swirl`: ruis langs het flow field) → RELIEF strijklicht → WEATHER land: natte glans, impasto-sneeuwdek, mistbanen → ramen/zon/sterren → WEATHER neerslag: regen als penseelstreken, sneeuw als verfstipjes → demo-print/museumwand → debug), `shaders/room.frag` (de demokamer: tv-frame, lamp, raam met Goudse grachtenpanden en sneeuw)
- `js/demo/`: `timeline.js` storyboard als pure functie `state(t)` (deterministisch) · `demo.js` eigen klok, kamer-pass, frame-voor-frame renderen · `captions.js` compositor (beeld + zwart + bijschriften + titel op een 2D-canvas)
- `js/ui/controls.js`: knoppen, sliders, Auto (wind), weerlabel, sneltoetsen, URL-opties, frame-modus
- `manifest.webmanifest` + `assets/icons/`: beginscherm-icoon (telefoon); `.nojekyll` voor GitHub Pages
- `assets/`: `masks/` (grijswaarde-PNG per element, `flow.png`, `scene.json`), `fonts/` (Cormorant Garamond, OFL), `music/` (Gymnopédie No. 1, publiek domein) — bronnen in `CREDITS.md`
- `server.py`: statische server zonder cache; PUT voor `assets/masks/`; `/render/start|frame|end|status` voor de film
- `tools/masks.html`, `tools/render_film.py`; `prototype.html`: oud prototype, alleen als referentie

## Afspraken
- Plain HTML/JS met ES modules, geen build-stap; lokaal draaien met `start.bat`
- Eén feature per sessie; begin in plan mode
- Na elke feature: git commit + `git push` en ROADMAP.md bijwerken; video's in `film/` staan niet in git
- Shaderbestanden met de Edit-tool aanpassen (PowerShell `Set-Content` zet een BOM die de shader breekt)
- Kleuren in de shader nooit boven 1 laten komen vóór `pow()` (gaf NaN → zwarte spikkels)
- Git staat in `C:\Program Files\Git\cmd`; pip heeft geen internet (SSL), dus beeldbewerking in de browser; ffmpeg via winget
- Testen zonder zichtbaar browservenster: headless Chrome-screenshot van `?clean&...` of `?demo&t=..&pause`
