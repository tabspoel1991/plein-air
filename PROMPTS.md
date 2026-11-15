# Prompts voor de volgende features

Gebruik: open per feature een **nieuwe** Claude Code-sessie in deze map en plak de prompt erin. Doe ze op volgorde (11 → 17); 12 en 13 bouwen voort op 11.

---

## 11 · Verfreliëf + strijklicht

```
Begin in plan mode. Lees eerst CLAUDE.md en ROADMAP.md. Dit gaat alleen over De Sterrennacht; de fallback voor eigen uploads mag niet stuk gaan.

Feature 11: verfreliëf + strijklicht. Geef de verf reliëf: leid uit de helderheid en het flow field (assets/masks/flow.png) een hoogtekaart / normal map af, en laat het licht van de zon (overdag, echte zonnestand) of de maan ('s nachts) erover strijken. Bij laag licht (ochtend, gouden uur) moeten de streken het sterkst zichtbaar zijn, rond 12 uur subtiel. Sterkte instelbaar met een URL-optie ?relief=0..1 om te vergelijken. Let op: geen kleuren boven 1 vóór pow().

Na afloop: voor/na-screenshots (headless), commit, ROADMAP.md bijwerken, en vertel me hoe ik het in de browser test.
```

## 12 · Regen als penseelstreken

```
Begin in plan mode. Lees eerst CLAUDE.md en ROADMAP.md. Dit gaat alleen over De Sterrennacht; de fallback voor eigen uploads mag niet stuk gaan.

Feature 12: regen als penseelstreken. De regen in main.frag (WEATHER neerslag) oogt nu als realistische druppels over het schilderij. Maak er korte, schuine Van Gogh-streken van, in kleuren uit het schilderij zelf (blauwen, groenen), die meebuigen met de wind en deels de richting van de streken volgen. Motregen = fijne, schaarse streepjes; bui/storm = dichter en schuiner. Natte daken en straten mogen glanzen (gebruik het verfreliëf van feature 11). Testen: ?weather=drizzle|rain|storm.

Na afloop: voor/na-screenshots (headless), commit, ROADMAP.md bijwerken, en vertel me hoe ik het in de browser test.
```

## 13 · Sneeuw als verfstipjes

```
Begin in plan mode. Lees eerst CLAUDE.md en ROADMAP.md. Dit gaat alleen over De Sterrennacht; de fallback voor eigen uploads mag niet stuk gaan.

Feature 13: sneeuw als verfstipjes. Vervang de vlokken door klodders/stipjes verf (wit, lichtblauw, een vleugje oker), alsof ze met de penseelpunt zijn gezet. Het sneeuwdek (?cover=) moet als dikke impasto-verf op daken, heuvels en cipres liggen en het verfreliëf van feature 11 gebruiken. 's Nachts koel maanlicht, bij de ramen warm. Testen: ?weather=snow&cover=0.7, overdag en 's nachts.

Na afloop: voor/na-screenshots (headless), commit, ROADMAP.md bijwerken, en vertel me hoe ik het in de browser test.
```

## 14 · Mist en wolken als wervelende streken

```
Begin in plan mode. Lees eerst CLAUDE.md en ROADMAP.md. Dit gaat alleen over De Sterrennacht; de fallback voor eigen uploads mag niet stuk gaan.

Feature 14: mist en wolken als wervelende streken. Bewolking en mist zijn nu vooral een vlak/waas. Schilder ze als trage, wervelende streken in de stijl van de grote wervels in de lucht (volg het flow field), die met de wind meedrijven. Mist ligt in horizontale banen tussen de heuvels en het dorp. Sterren en maan schijnen er af en toe doorheen. Testen: ?weather=cloudy|fog, dag en nacht.

Na afloop: voor/na-screenshots (headless), commit, ROADMAP.md bijwerken, en vertel me hoe ik het in de browser test.
```

## 15 · GitHub-backup

```
Begin in plan mode. Lees eerst CLAUDE.md en ROADMAP.md.

Feature 15: zet dit project op GitHub als online backup (nieuwe repository, remote origin, alle bestaande commits pushen; film/ blijft buiten git). Leg me stap voor stap uit wat ik zelf moet doen (account, inloggen); doe de rest. Leg kort uit hoe ik later een versie terugzet en wat een branch is. Let op: voor feature 17 (GitHub Pages) moet de repository publiek kunnen. Het schilderij en de muziek zijn publiek domein; controleer dat er niets privé in de repo staat.

Na afloop: ROADMAP.md en CLAUDE.md bijwerken, commit en push.
```

## 16 · Datumkiezer

```
Begin in plan mode. Lees eerst CLAUDE.md en ROADMAP.md. Dit gaat alleen over De Sterrennacht; de fallback voor eigen uploads mag niet stuk gaan.

Feature 16: datumkiezer. Ik wil een willekeurige dag kunnen kiezen en die zien met de echte zonnestand, maanfase én het echte weer in Gouda van die dag. Weer: Open-Meteo historical archive (per uur, vanaf 1940; voor de laatste dagen de forecast-API met past_days). In de app: een datumveld naast de tijdslider, plus URL-optie ?date=2025-01-09. Zonder datum blijft alles live zoals nu; frame-modus blijft altijd live; de demo verandert niet. Laat in het weerlabel zien welke dag en welk weer actief is.

Na afloop: screenshots (headless) van een paar opvallende dagen, commit, ROADMAP.md en CLAUDE.md (URL-opties) bijwerken, en vertel me hoe ik het in de browser test.
```

## 17 · Op mijn telefoon (GitHub Pages)

```
Begin in plan mode. Lees eerst CLAUDE.md en ROADMAP.md.

Feature 17: publiceer de app via GitHub Pages zodat ik hem overal op mijn telefoon kan openen, zonder dat mijn pc aanstaat. Controleer dat alles werkt zonder server.py (geen PUT, geen render-routes nodig) en op een telefoonscherm (portret en landschap, touch, prestaties). Voeg een "toevoegen aan beginscherm"-icoon toe (web app manifest).

Na afloop: commit en push, ROADMAP.md bijwerken, zet de link in CLAUDE.md, en vertel me hoe ik hem op mijn telefoon open en op het beginscherm zet.
```

---

## Alles in één: 12–17

```
Begin in plan mode. Lees eerst CLAUDE.md, ROADMAP.md en PROMPTS.md. Feature 11 (verfreliëf, js/scene/relief.js, ?relief=) is klaar.

Ik wil in deze sessie features 12 t/m 17 bouwen. De details per feature staan in PROMPTS.md. Maak één plan voor alles; na mijn akkoord werk je ze achter elkaar af zonder per feature opnieuw goedkeuring te vragen.

Volgorde (eerst alles wat zonder mij kan):
1. Feature 12 · Regen als penseelstreken
2. Feature 13 · Sneeuw als verfstipjes (impasto-sneeuwdek met het verfreliëf)
3. Feature 14 · Mist en wolken als wervelende streken
4. Feature 16 · Datumkiezer (echte zon, maan en historisch weer van Gouda, ?date=)
5. Feature 15 · GitHub-backup (hier stop je en vertel je me stap voor stap wat ik zelf moet doen, zoals inloggen)
6. Feature 17 · Op mijn telefoon via GitHub Pages

Regels:
- Het gaat om De Sterrennacht; de fallback voor eigen uploads mag niet stuk gaan.
- Na elke feature: voor/na-screenshots (headless, in film/feature<nr>/), een eigen git commit en ROADMAP.md bijwerken. Zo kan ik elke stap apart terugdraaien.
- Breekt een feature iets wat al werkte (dag/nacht, maan, demo, film-render), herstel dat eerst voordat je verdergaat.
- Houd je aan de afspraken in CLAUDE.md (shaders met de Edit-tool, geen kleuren boven 1 vóór pow()).
- Werk CLAUDE.md bij met nieuwe URL-opties en de link van GitHub Pages.

Eindrapport: per feature in 2-3 zinnen wat er veranderd is (architectuur, geen code) en hoe ik het in de browser test (URL's), plus de link voor op mijn telefoon.
```
