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

## 11. Verfreliëf + strijklicht
- [x] Hoogtekaart + normal map uit het schilderij zelf (`js/scene/relief.js`): helderheid als verfdikte, langs de streekrichting uit `flow.png` uitgesmeerd tot ribbels; één keer berekend bij het laden
- [x] De zon strijkt erover vanuit zijn echte positie op het doek: sterk bij lage zon (ochtend, gouden uur), subtiel als hij hoog staat; bewolking en mist dempen het
- [x] 's Nachts strijkt de maan erover, zachter en koel, sterker bij volle maan
- [x] Testen: `?relief=0..1` (0 = uit, standaard 0,6); voor/na-beelden in `film/feature11/`
- Een eigen upload krijgt een zwakker, korrelig reliëf (geen flow field). Op een novembermiddag (zon ~17°) blijft het reliëf goed zichtbaar; in de zomer (~61°) is het echt subtiel

## 12. Regen als penseelstreken
- [x] Korte, taps toelopende streken met penseelharen (droger naar de staart), licht gebogen
- [x] Kleuren uit het schilderij: ultramarijn, kobalt, groenblauw en bleek cyaan, gemengd met de verf eronder; 's nachts lichter dan de lucht
- [x] Wind bepaalt de schuinte; in de lucht buigen de streken deels mee met de streekrichting (flow field)
- [x] Motregen fijn en schaars, regen dichter, storm een extra laag: langer, dichter en schuiner
- [x] Natte daken en straten glanzen op de verfribbels (normal map van feature 11): overdag koel luchtlicht, 's avonds warm lamplicht bij de ramen
- [x] Testen: `?weather=drizzle|rain|storm` (bijv. met `&time=13:00` of `&time=19:00`); voor/na-beelden in `film/feature12/`
- Het dorp valt in 16:9 deels onder de rand; de natte glans zie je het best in een smaller venster of op `?frame` op een 4:3-scherm

## 13. Sneeuw als verfstipjes + impasto-sneeuwdek
- [x] Vlokken zijn verfstipjes: korte ovale toetsen met een eigen hoek, penseelharen en een lichte/donkere kant; wit, lichtblauw en af en toe een vleugje oker; ze tuimelen traag
- [x] Sneeuwdek als dikke impasto: eigen "dikte" van gestreken klodders, met een eigen normal die samen met het verfreliëf (feature 11) wordt belicht vanuit de zon of de maan; dikkere sneeuw (`?cover=`) = meer reliëf
- [x] 's Nachts koel blauw maanlicht (sterker bij volle maan), warm lamplicht rond de ramen; overdag wit met een blauwe schaduwkant
- [x] Ook meer sneeuw op de lichte kant van de cipres
- [x] Testen: `?weather=snow&cover=0.7` met `&time=13:00`, `&time=16:15` of `&time=23:00&moon=.5`; voor/na-beelden in `film/feature13/`

## 14. Mist en wolken als wervelende streken
- [x] Eén gedeelde "wervel"-functie in de shader: ruis uitgesmeerd langs het flow field (in beide richtingen), zodat wolken dezelfde wervels volgen als Van Goghs lucht; drijft traag met de wind mee
- [x] Wolken zijn licht/donker-streken in plaats van een grijs vlak; 's nachts een zilveren rand bij de maan
- [x] Gaten in de wolken drijven voorbij: sterren, maan (ook de maanfase-schijf) en zon schijnen er af en toe doorheen
- [x] Mist in lange horizontale banen tussen heuvels en dorp, met dunne slierten in de lucht; sterren blijven op dunne plekken zichtbaar
- [x] Testen: `?weather=cloudy` of `?weather=fog`, met `&time=13:00` of `&time=23:00&moon=.5`; voor/na-beelden in `film/feature14/`
- In de sterkransen draait het flow field rond; daar zijn de wolkenstreken bewust zachter

## 16. Datumkiezer
- [x] Datumveld naast de tijdslider en `?date=2021-02-07`: elke dag vanaf 1940 met de echte zonnestand, maanfase en het weer in Gouda van die dag, per uur (de tijdslider loopt door de dag)
- [x] Weer: Open-Meteo forecast-API voor ±90 dagen terug t/m 15 dagen vooruit, anders het historical archive; zelfde weerregels als live; sneeuwdek uit de gemeten sneeuwhoogte; afgelopen dagen worden onthouden (localStorage)
- [x] Weerlabel toont dag + weer, bijv. "7 feb 2021 · Sneeuw · 28 km/u"; geen data (verre toekomst/offline) → helder met melding
- [x] Live zet alles terug naar nu; frame-modus is altijd live (F met een datum → live lijst); de demo is ongewijzigd
- [x] Beelden van opvallende dagen in `film/feature16/` (sneeuwstorm 7 feb 2021, hittegolf 25 jul 2019, 40 graden 19 jul 2022, storm Eunice 18 feb 2022, watersnoodnacht 1 feb 1953)
- Archiefweer is een modelreconstructie (ERA5, ~25 km): windpieken en mist zijn daarin zwakker dan ze echt waren

## Gepland (prompts in `PROMPTS.md`, één sessie per feature)
- [ ] 15. GitHub-backup (online versiebeheer)
- [ ] 17. Op de telefoon via GitHub Pages

## Later
- Seizoenen
- Andere schilderijen
