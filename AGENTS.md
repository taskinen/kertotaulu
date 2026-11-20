# AGENTS.md

Ohjeet tässä repossa työskenteleville koodausagenteille ja kehittäjille.

**Pidä tämä tiedosto aina ajan tasalla.** Kun muutat rakennetta, komentoja, pelin sääntöjä tai julkaisutapaa, päivitä tämä tiedosto samassa muutoksessa.

## Mikä tämä on

Kertotassut on 2.-luokkalaisille tehty kertotaulupeli. Pelaaja luo hahmon, hoitaa kissoja ja koiria ja ansaitsee hoitoon tarvittavat tähdet laskemalla kertolaskuja. Alussa käytössä ovat 2, 5 ja 10 kertotaulut. Muut taulut avautuvat osaamisen myötä järjestyksessä 3, 4, 1, 6, 9, 8, 7.

- Single page app ilman backendiä, build-vaihetta tai riippuvuuksia.
- Toimii puhelimen selaimessa ja suoraan tiedostona (`file://`).
- Käyttöliittymän kieli on suomi. Kertomerkki on oletuksena `·` (suomalainen koulukäytäntö), ja asetuksista sen voi vaihtaa merkkiin `×`.
- Julkaistu GitHub Pagesissa: https://taskinen.github.io/kertotaulu/ (repo `taskinen/kertotaulu`, henkilökohtainen GitHub-tili).

## Rakenne

```
index.html             HTML-runko, #app, #overlay, #toast, #fx ja tassu-SVG-symboli
styles.css             kaikki tyylit (mobiili ensin)
js/logic.js            pelilogiikka ilman DOMia: laskut, osaaminen, avaukset, palkinnot, tarpeet, kauppa
js/storage.js          localStorage-tallennus, oletustila ja migraatio
js/art.js              SVG-grafiikka: kissa, koira, avatar, asusteet, sisustus
js/sound.js            Web Audio -äänet ja värinä
js/ui.js               näkymät, tapahtumat ja tarpeiden ajastin
js/main.js             käynnistys, manifestin lisäys ja service workerin rekisteröinti
sw.js                  service worker (offline-välimuisti)
manifest.webmanifest   PWA-manifesti
icons/                 icon.svg sekä siitä renderöidyt PNG-ikonit
tests/logic.test.js    yksikkötestit (node --test)
```

Skriptit ovat tavallisia `<script>`-tiedostoja yhteisen `window.KT`-nimiavaruuden alla, eivät ES-moduuleja, koska moduulit eivät toimi `file://`-osoitteesta. Skriptien järjestys `index.html`:ssä on merkitsevä: logic → storage → art → sound → ui → main.

`logic.js` ja `storage.js` toimivat sekä selaimessa että Nodessa (`module.exports`), jotta niitä voi testata.

## Käytännöt

- Näkymät renderöidään merkkijonoina. Napit käyttävät `data-action`-attribuuttia, ja yksi delegoitu käsittelijä ohjaa ne `ACTIONS`-taulun funktioille (`js/ui.js`).
- Käyttäjän syöte (nimet) lisätään HTML:ään aina `esc()`-funktion kautta.
- Älä käytä selaimen `alert`/`confirm`/`prompt`-dialogeja, vaan `confirmModal()`/`openOverlay()`-funktioita.
- Pelin säätöarvot (palkinnot, hinnat, tarpeiden laskunopeus, avausjärjestys ja -raja) ovat vakioina `js/logic.js`:n alussa.
- Tallennusmuodon muutokset: lisää oletusarvo `defaultState()`-funktioon ja tarvittaessa korjaus `migrate()`-funktioon, jotta vanhat tallennukset toimivat. Nosta `VERSION`, jos muoto muuttuu yhteensopimattomasti.
- Tallennus tehdään heti jokaisen muutoksen jälkeen. Älä lisää tallennusta `pagehide`-tapahtumaan, koska se voisi ylikirjoittaa toisen välilehden tilan.
- Eläinten tarpeet laskevat vain pelatessa: ajastin käy vain, kun välilehti on näkyvissä, eikä aloitus-, luonti- tai aikuisten näkymissä.
- Kotinäkymän lemmikit sijoitetaan pikseleinä JS:llä (`layoutRoom()`/`placePet()` tiedostossa `js/ui.js`), eivät CSS-ruudukolla, jotta ne voivat liikkua sisustuksen luo.
- Sisustusvierailut: noin 10–20 sekunnin välein yksi lemmikki käy omistetussa sisustuksessa (kissa kiipeää kiipeilypuuhun, koira leikkii sen juurella, peti = nukkuminen, matto = kieriminen, kukka = nuuskiminen tai tassuttelu). Vierailun vaiheet määritellään `visitPlan()`-funktiossa, ja valinta ja ilobonus ovat `js/logic.js`:ssä (`pickDecorVisit()`, `decorBonus()`, `DECOR_ACTIVITIES`). Peti ja kiipeilypuu antavat +10 iloa enintään kerran neljässä minuutissa lemmikkiä kohden. Napautus keskeyttää vierailun.
- `.room` on oma pinoamiskontekstinsa (`isolation: isolate`), jotta lemmikkien `z-index` ei nouse peitekerroksen päälle.
- Commit-viesteissä ja muissa teksteissä ei mainita tekoälytyökaluja.

## Ajaminen ja testit

```sh
python3 -m http.server 8000     # avaa http://localhost:8000/
node --test tests/              # yksikkötestit
```

Peliä voi myös kokeilla avaamalla `index.html`:n suoraan selaimessa. Service worker ja manifesti ovat silloin pois käytöstä.

Selaimen konsolissa `KT.ui.debug.state()` palauttaa pelitilan ja `KT.ui.debug.tick(sekunnit)` kuluttaa tarpeita testausta varten. `KT.ui.debug.visit('p1', 'bed')` käynnistää sisustusvierailun heti, ja `KT.ui.debug.autoVisits(false)` pysäyttää automaattiset vierailut.

## Julkaisu

GitHub Pages julkaisee `main`-haaran juuren automaattisesti jokaisen pushin jälkeen.

1. **Nosta `CACHE`-versiota `sw.js`:ssä** (esim. `kertotassut-v1` → `kertotassut-v2`) aina, kun jokin tiedosto muuttuu. Muuten pelaajien laitteet jatkavat vanhan välimuistin käyttöä.
2. Jos lisäät uuden tiedoston, lisää se myös `sw.js`:n `FILES`-listaan.
3. Aja testit ja pushaa `main`-haaraan. Varmista, että `gh` ja git käyttävät henkilökohtaista tiliä (`taskinen`), eivät työtiliä.

PNG-ikonit on renderöity `icons/icon.svg`:stä headless Chromella (täysi neliö ilman pyöristyksiä, jotta ne toimivat maskable- ja iOS-ikoneina). Jos ikoni muuttuu, renderöi PNG-tiedostot uudelleen.
