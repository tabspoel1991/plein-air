# Roadmap

## 0. Fundament
- [x] prototype.html opsplitsen in de modules uit CLAUDE.md (index.html is het startpunt, shaders in eigen bestanden)
- [x] Lokale dev server + git (`start.bat` start `server.py` en opent de browser)
- [x] De Sterrennacht standaard geladen uit `assets/sterrennacht.jpg` (Wikimedia Commons, 1920×1520; 4K-versie werd door Wikimedia geweigerd met "too many requests")
- Let op: een eigen upload wordt niet meer onthouden na herladen; de Sterrennacht is altijd het startbeeld

## 1. Motion v2
- [x] Slider 0 = volledig stil (ook geen zoom, korrel of twinkeling)
- [x] Slider max = duidelijk zichtbaar, constant in beweging
- [x] Slider stuurt snelheid én sterkte (eigen "bewegingsklok" die stilstaat op 0; vloeiend verloop)

## 2. Scene masks (Sterrennacht)
- [x] Mask-afbeelding per element: lucht, sterren, maan, cipres, dorp, ramen, heuvels (`assets/masks/*.png`, grijswaarden, met de hand bij te werken)
- [x] Automatisch gemaakt op kleur, helderheid en positie (`js/scene/autoMasks.js`); alle 11 sterren en de maan worden gevonden
- [x] Opnieuw genereren: open `http://localhost:8000/tools/masks.html` → Genereer → Opslaan (let op: overschrijft handwerk)
- [x] Debug-weergave: toets M toont de masks in kleur met legenda
- Later: AI-segmentatie; een eigen upload krijgt nu alleen een simpele lucht/land-verdeling

## 3. Beweging per element
- [x] Wervels in de lucht draaien mee met hun penseelrichting (flow field `assets/masks/flow.png`, gemeten uit de streken)
- [x] Sterren en maan pulseren: de krans ademt en licht zacht op, elk in een eigen ritme
- [x] Cipres wiegt (meer naar de top) met vlammende golfjes; dorp en heuvels staan bijna stil
- [x] Alles volgt de motion-slider

## 4. Dag ↔ nacht per element
- [x] Lucht: donkerblauw → daglucht, penseelstreken blijven zichtbaar (kleur verschuift, textuur blijft)
- [x] Sterren en maan vervagen overdag, zon verschijnt (geschilderd met de streken van de grootste ster, volgt de echte zonnestand)
- [x] Ramen: licht aan in avond en nacht met zachte gloed, uit overdag
- [x] Heuvels, cipres en dorp: helder daglicht met warme schaduwkant; 's nachts donker en koel
- [x] Overgangen vloeiend (alle waarden lopen geleidelijk mee met de zonshoogte)

## 5. Overgangen
- [x] Zonsopkomst en zonsondergang als kleurverloop over de horizon (ochtend rozer, avond oranjer, sterkst aan de zonkant)
- [x] Sterren verdwijnen/verschijnen één voor één (elke ster en elk twinkelsterretje heeft een eigen moment); zon kleurt roder bij de horizon
- [x] Gouden uur: warm strijklicht op de zonkant van de cipres en op de daken

## 6. Frame-modus
- [ ] Opent direct fullscreen, geen knoppen
- [ ] Draait stabiel op een oude tablet of tv

## Later
- Weer in Gouda (regen, bewolking)
- Seizoenen
- Andere schilderijen
