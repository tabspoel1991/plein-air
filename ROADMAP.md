# Roadmap

## 0. Fundament
- [x] prototype.html opsplitsen in de modules uit CLAUDE.md (index.html is het startpunt, shaders in eigen bestanden)
- [x] Lokale dev server + git (`start.bat` start `server.py` en opent de browser)
- [x] De Sterrennacht standaard geladen uit `assets/sterrennacht.jpg` (Wikimedia Commons, 1920×1520; 4K-versie werd door Wikimedia geweigerd met "too many requests")
- Let op: een eigen upload wordt niet meer onthouden na herladen; de Sterrennacht is altijd het startbeeld

## 1. Motion v2
- [ ] Slider 0 = volledig stil (ook geen zoom, korrel of twinkeling)
- [ ] Slider max = duidelijk zichtbaar, constant in beweging
- [ ] Slider stuurt snelheid én sterkte

## 2. Scene masks (Sterrennacht)
- [ ] Mask-afbeelding per element: lucht, sterren, maan, cipres, dorp, ramen, heuvels
- [ ] Eerst handgemaakt (ingekleurde PNG), later automatisch met AI-segmentatie

## 3. Beweging per element
- [ ] Wervels in de lucht draaien mee met hun penseelrichting
- [ ] Sterren en maan pulseren
- [ ] Cipres wiegt, dorp staat stil

## 4. Dag ↔ nacht per element
- [ ] Lucht: donkerblauw → daglucht, penseelstreken blijven zichtbaar
- [ ] Sterren en maan vervagen overdag, zon verschijnt
- [ ] Ramen: licht aan 's nachts, uit overdag
- [ ] Heuvels, cipres en dorp: daglicht met schaduw

## 5. Overgangen
- [ ] Zonsopkomst en zonsondergang als kleurverloop over de horizon
- [ ] Gouden uur op cipres en daken

## 6. Frame-modus
- [ ] Opent direct fullscreen, geen knoppen
- [ ] Draait stabiel op een oude tablet of tv

## Later
- Weer in Gouda (regen, bewolking)
- Seizoenen
- Andere schilderijen
