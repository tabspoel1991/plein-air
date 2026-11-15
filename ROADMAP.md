# Roadmap · Plein Air

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
- [x] Toets F, knop "Lijst" of `?frame` in de URL: geen knoppen, geen cursor, altijd de echte tijd, scherm blijft aan
- [x] Fullscreen: met F/knop direct; bij `?frame` blokkeert de browser dat tot de eerste tik op het scherm (browserregel)
- [x] Adaptieve resolutie: bij haperen (onder ~40 fps) omlaag tot 35%, daarna langzaam terug; in frame-modus max ~1,25 pixel per css-pixel
- [x] Robuust voor dagenlang draaien: shader valt terug op lagere precisie op oude GPU's, pagina ververst elke nacht om 04:00
- Nog niet getest op een echte oude tablet of tv

## 7. Echt weer in Gouda
- [x] Actueel weer van Open-Meteo, elke 15 minuten; zonder internet: laatst bekende weer, anders helder
- [x] Bewolking, regen (motregen/bui), sneeuw (blijft liggen), mist — als penseelstreken
- [x] Vloeiende overgangen tussen weertypen
- [x] Wind stuurt de beweging ("Auto (wind)"), zelf schuiven overschrijft
- [x] Testknop: `?weather=rain|snow|fog|cloudy|clear` (extra: `drizzle`, `storm`); `?time=13:00` = vaste tijd, `?cover=0.7` = sneeuwdek, `?clean` = zonder knoppen
- Sneeuwdek groeit in ~10 min echte sneeuw en smelt in een half uur (dooi) tot twee uur (vorst)


## 8. Echte maanfase
- [x] De maan toont de fase van vandaag (`js/time/moon.js`), geschilderd met de ronddraaiende streken van de eigen krans; de krans blijft
- [x] Testen: `?moon=0..1` (0 = nieuw, 0,25 = eerste kwartier, 0,5 = vol, 0,75 = laatste kwartier)
- Overdag staat de maan als bleke schijf in de lucht; in 16:9 valt de bovenkant van de maan net buiten beeld

## 9. Demo-modus (`?demo`)
- [x] Gescripte film van 60 s met eigen klok (`js/demo/timeline.js`), deterministisch; `?demo&t=14&pause` toont één exact frame, spatie = pauze, ←/→ = spoelen
- [x] Opening als museumprint (heel doek op donker, label), dan komt hij tot leven vanuit de centrale wervel
- [x] Dageraad (met ochtendnevel), regen, wind, gouden uur, sneeuwnacht met de echte maanfase (de originele sikkel blijft tot dan staan)
- [x] Bijschriften linksonder en titelkaart in Cormorant Garamond (lokaal, OFL)
- [x] Kamershot: naadloze uitzoom van het doek naar een tv-frame in een woonkamer met lamp en raam; buiten sneeuwt het synchroon
- Kamer is zelf geschilderd (shader) in plaats van een foto: Unsplash/Pexels blokkeerden downloads, geen geschikte vrije foto op Wikimedia (zie CREDITS.md)

## 10. Film renderen
- [x] Muziek: Satie, Gymnopédie No. 1, Robin Alciatore (Musopen, publiek domein); fade in 2 s, uit 3 s (CREDITS.md)
- [x] Frame voor frame: de browser stuurt elk frame naar `server.py`, die het direct aan ffmpeg geeft (`render-film.bat`)
- [x] Conceptversie bekeken en verbeterd (museumlabel in de marge, maan pas in de sneeuwnacht, kamer en uitzicht verfijnd)
- [x] `film/plein-air-demo-4k.mp4` (3840×2160, 30 fps, 404 MB), `film/plein-air-demo-1080p.mp4` (12,4 MB), 3 stills
- Eerste 4K-poging liep vast op frame 255: Chrome zonder venster crasht soms bij 4K. Opgelost met een waakhond die Chrome herstart en verdergaat bij het volgende frame (7 herstarts in de eindrender, geen gaten: 1800 frames, 60,0 s)
- Video's staan niet in git; `film/_master-*.mp4` zijn tussenbestanden (nodig voor `--mux`, mogen weg)

## Gepland (prompts in `PROMPTS.md`, één sessie per feature)
- [ ] 11. Verfreliëf + strijklicht: streken krijgen reliëf, zon/maan strijkt erover (sterkst bij laag licht)
- [ ] 12. Regen als penseelstreken in de kleuren van het schilderij
- [ ] 13. Sneeuw als verfstipjes, sneeuwdek als impasto
- [ ] 14. Mist en wolken als wervelende streken
- [ ] 15. GitHub-backup (online versiebeheer)
- [ ] 16. Datumkiezer: elke dag met echte zon, maan en historisch weer van Gouda (`?date=`)
- [ ] 17. Op de telefoon via GitHub Pages

## Later
- Seizoenen
- Andere schilderijen
