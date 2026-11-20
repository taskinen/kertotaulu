# Kertotassut

Kertotaulupeli 2.-luokkalaisille. Laske kertolaskuja, ansaitse tähtiä ja hoida omia kissoja ja koiria!

**Pelaa:** https://taskinen.github.io/kertotaulu/

## Miten peli toimii

- Aluksi teet oman hahmon ja valitset ensimmäisen lemmikin.
- Lemmikit tarvitsevat ruokaa, vettä, leikkiä ja pesua. Hoitaminen maksaa tähtiä.
- Tähtiä ansaitaan laskemalla kertolaskuja: oikeasta vastauksesta saa tähden, viiden putkesta bonuksen ja hyvästä kierroksesta lisää.
- Alussa käytössä ovat 2, 5 ja 10 kertotaulut. Kun ne ovat hallussa, uusia tauluja avautuu aina 10 kertotauluun asti.
- Tähdillä voi myös adoptoida lisää lemmikkejä ja ostaa asusteita ja sisustusta.
- Lemmikit käyttävät sisustusta itsestään: kissa kiipeää kiipeilypuuhun, lemmikit nukkuvat pedillä, kierivät matolla ja nuuskivat kukkaa. Peti ja kiipeilypuu myös piristävät niitä.

Eläinten tarpeet laskevat vain silloin, kun peli on auki. Eläimet eivät koskaan kuole tai karkaa.

## Aikuisille

Pelin alalaidassa on Aikuisille-linkki. Asetuksista voi valita harjoiteltavat kertotaulut, kierroksen pituuden ja kertomerkin (`·` tai `×`) sekä nähdä, mitkä laskut ovat tuottaneet eniten vaikeuksia.

Pelin voi lisätä puhelimen kotivalikkoon, jolloin se toimii myös ilman verkkoyhteyttä. Tallennus säilyy laitteen selaimessa.

## Kehitys

Peli on tavallista HTML:ää, CSS:ää ja JavaScriptiä ilman build-vaihetta tai riippuvuuksia.

```sh
python3 -m http.server 8000     # avaa http://localhost:8000/
node --test tests/              # testit
```

Tarkemmat ohjeet ovat tiedostossa [AGENTS.md](AGENTS.md).
