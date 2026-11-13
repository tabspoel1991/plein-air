# Levend Schilderij

## Visie
Een webapp die een schilderij laat leven. Het beweegt subtiel en het licht volgt de echte tijd van de dag in Gouda.
Eerste focus: één schilderij, De Sterrennacht (Van Gogh). Overdag moet dat er echt als dag uitzien, 's nachts als nacht.

## Over mij
Ik lees geen code. Leg uit in termen van architectuur (layers, modules, data flow) met de juiste Engelse vakterm.
Hou uitleg kort. Laat na elke feature zien hoe ik het in de browser test.

## Architectuur (modules)
- `input/`: afbeelding laden, helderheid meten
- `scene/`: masks per element (lucht, sterren, maan, cipres, dorp, ramen, heuvels)
- `time/`: zonnestand Gouda → lichtprofiel (nacht, blauw uur, gouden uur, dag)
- `motion/`: beweging per element, aangestuurd door de motion-slider
- `relight/`: kleur en licht per element op basis van het lichtprofiel
- `render/`: WebGL shader pipeline die elk frame tekent
- `ui/`: knoppen, sliders, frame-modus

## Afspraken
- Plain HTML/JS met ES modules, geen build-stap; lokaal draaien met een simpele dev server
- Eén feature per sessie; begin in plan mode
- Na elke feature: git commit en ROADMAP.md bijwerken
- Startpunt: `prototype.html` (werkend prototype, nog één bestand)
