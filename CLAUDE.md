# Levend Schilderij

## Visie
Een webapp die een schilderij laat leven. Het beweegt subtiel en het licht volgt de echte tijd van de dag in Gouda.
Eerste focus: één schilderij, De Sterrennacht (Van Gogh). Overdag moet dat er echt als dag uitzien, 's nachts als nacht.

## Over mij
Ik lees geen code. Leg uit in termen van architectuur (layers, modules, data flow) met de juiste Engelse vakterm.
Hou uitleg kort. Laat na elke feature zien hoe ik het in de browser test.

## Starten
- Dubbelklik `start.bat` → start `server.py` (Python, alleen standaardbibliotheek) en opent http://localhost:8000
- `?frame` achter de URL = lijst-modus; `tools/masks.html` = masks opnieuw genereren
- Sneltoetsen: M = masks tonen (debug), F = frame-modus

## Architectuur (data flow per frame)
`input` → `scene` → `time` → `motion` + `relight` → `render`, met `ui` eromheen; `js/main.js` verbindt ze.

- `js/input/image.js`: afbeelding laden (met retry), schalen naar max 2048 px, helderheid meten. Standaard `assets/sterrennacht.jpg`
- `js/scene/`
  - `autoMasks.js`: maakt masks uit kleur + helderheid + positie (grove contouren in de code, verfijnd op het beeld); vindt sterren en maan
  - `flowField.js`: streekrichting per pixel (structure tensor) → `flow.png`
  - `scene.js`: laadt `assets/masks/*.png` + `scene.json` en pakt ze in 2 RGBA-textures (A: lucht, sterren, maan, cipres · B: dorp, ramen, heuvels). Eigen upload → simpele lucht/land-verdeling
- `js/time/`: `sun.js` zonnestand Gouda (hoogte + kompasrichting) → `profile.js` lichtprofiel: dag, nacht, lampen, schemering, gouden uur, zonpositie, kleuren; vloeiend ge-eased
- `js/motion/motion.js`: slider → bewegingsklok (staat stil op 0) + sterkte, korrel, zoom
- `js/relight/relight.js`: profiel → shader-uniforms; de kleurregels per element staan in de shader (blok RELIGHT)
- `js/render/`: `renderer.js` (WebGL1, textures, uniforms), `quality.js` (adaptieve resolutie), `shaders/main.vert|frag` (MOTION-blok → RELIGHT-blok → debug-overlay)
- `js/ui/controls.js`: knoppen, sliders, sneltoetsen, frame-modus (fullscreen, wake lock, nachtelijke refresh)
- `assets/masks/`: grijswaarde-PNG per element (met de hand bij te werken), `flow.png`, `scene.json` (sterren, maan)
- `tools/masks.html`: genereert en bewaart masks via PUT naar `server.py` (alleen `assets/masks/` is schrijfbaar)
- `prototype.html`: oud prototype, alleen als referentie

## Afspraken
- Plain HTML/JS met ES modules, geen build-stap; lokaal draaien met `start.bat`
- Eén feature per sessie; begin in plan mode
- Na elke feature: git commit en ROADMAP.md bijwerken
- Shaderbestanden met de Edit-tool aanpassen (PowerShell `Set-Content` zet een BOM die de shader breekt)
- Git staat in `C:\Program Files\Git\cmd` (niet in PATH van oudere shells); pip heeft geen internet (SSL), dus beeldbewerking in de browser
