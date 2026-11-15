# Zadání pro Gemini: převzít vzhled a animaci obrazovky Školního poháru

> Tento dokument je určený jako **vstup pro Gemini** (vlož ho celý). Cílem je, aby
> stávající aplikace postavená v Gemini dostala **stejnou grafiku a animace**, jaké má
> referenční stránka, ale **přišla jen o prezentaci, ne o mechaniky**. Nic z datového
> toku, formuláře, tabulky ani API se nemění.

## 0. Co zůstává a co se mění

**Zůstává beze změny:** Google Formulář pro zápis, tabulka, list `Skóre`, vzorec SUMIF,
Apps Script endpoint, veškerá logika sčítání i to, kdo smí zapisovat.

**Mění se pouze to, co vidí divák na televizi:** místo tabulky nebo textu se kreslí
čtyři skleněné přesýpací hodiny s drahokamy, animace padání/mizení a přetáčecí čísla.

## 1. Referenční implementace

Otevři a **přečti zdrojový kód** této stránky — je to hotový, funkční vzor, který už
čte data z našeho endpointu:

```
https://activity-gamma-beige.vercel.app/pohar/cizi-tv.html
```

Je to jediný soubor bez knihoven: HTML + CSS + canvas 2D v jednom `<script>`.
Převezmi z něj **kreslení hodin, drahokamů, erbů, oblohy a animace**; datovou část
nahraď svým stávajícím načítáním.

## 2. Datový kontrakt

`GET` na endpoint aplikace vrací JSON s názvy kolejí jako klíči:

```json
{ "Nebelvír": 120, "Zmijozel": 95, "Havraspár": 140, "Mrzimor": 80 }
```

- Dotazuj se **každých 5 sekund** (`setTimeout` po dokončení dotazu, ne `setInterval`).
- Apps Script odpovídá přes 302; běžný `fetch()` to zvládne sám.
- Hodnota může být i záporná nebo `null` — ošetři `Number(v) || 0`.

## 3. Pravidla zobrazení

1. **Kapacita nádoby (100 % výšky)** = `max(100, nejvyšší skóre × 1,25)`, zaokrouhleno
   nahoru na „hezké“ číslo (100, 125, 150, 200, 250, 300, 400, 500, 750, 1000…).
   Nikdy nesmí přetéct: kolej s nejvyšším skóre je vždy pod 100 %.
2. **Hodnota drahokamu** = 1, 2, 5, 10, 20, 25, 50, 100, 250, 500 — vyber takovou, aby se
   do baňky vešlo **~90 kamenů**. Popisek pod číslem je `1 drahokam = N b.` a je závazný:
   kreslí se přesně `skóre ÷ N` kamenů (zaokrouhleno na celé).
3. **Záporné skóre se nezobrazuje.** Aktuální stav koleje je `max(0, hodnota)`; do minusu
   se na obrazovce nikdy nejde (baňka je prázdná, číslo 0). Viz bod 6 — kde přesně to udělat.
4. **Prázdný stav:** při 0 bodech se v baňce nekreslí ani jeden kámen, žádný stín, žádná hladina.
5. Při **změně poměru** (jiné N) popisek u všech čtyř kolejí dvakrát blikne zlatě — všechny
   koleje mají vždy stejné měřítko, jinak obrázek lže o tom, kdo vede.

## 4. Vizuální specifikace

**Formát:** celá obrazovka, 16:9, 1920×1080, žádné scrollování, žádná lišta prohlížeče.
Všechny rozměry v `vh`/`vw`, aby to sedělo na každé televizi.

**Pozadí:** noční obloha — tmavě modročerný přechod `#1b2340 → #0d1020 → #06070f`,
přes něj ~120 blikajících hvězd (canvas, alfa 0,3–0,85, pomalé sinusové pulzování),
u každé koleje jemná barevná záře (radiální gradient, alfa 0,16) a zlatý rámeček obrazovky
s kosočtvercovými ozdobami.

**Záhlaví:** „ŠKOLNÍ POHÁR“ zlatým přechodem (`#fff3cc → #e8c66a → #9c7a2e`), prostrkané
písmo, po stranách ❖, pod tím tenká zlatá linka.

**Sloupec koleje (čtyři vedle sebe):**
1. **erb** — štít (path `M32 2 L60 9 V38 C60 55 47 66 32 73 C17 66 4 55 4 38 V9 Z`),
   výplň přechodem barvy koleje, zlatý obrys 2,4 px; uvnitř **zjednodušené heraldické
   zvíře** v barvě s kontrastem (lev / had / orel / jezevec) — žádné filmové erby.
2. **název koleje** velkým písmem (3,1 vh), prostrkaná kapitálka, zlatavá.
3. **druh drahokamu** malým písmem (1,4 vh, šedozlatá).
4. **přesýpací hodiny** (canvas, ~60 % výšky): dřevěné rámy s léty a mosaznými pásky,
   sklo jako obrys se světlým odleskem, v horní baňce jemná mlha v barvě koleje
   a 10–15 pomalých jisker, ve spodní baňce hromada drahokamů.
5. **skóre** — čtyři číslice v patkovém písmu se zaokrouhlenými číslicemi
   (`font-variant-numeric: lining-nums`), každá číslice roluje svisle (0,85 s).
6. **popisek** „1 drahokam = N b.“ (1,35 vh).

**Drahokam:** šestiboký kámen se špičkou dolů, tři odstíny barvy koleje (přechod),
bílé fazety, horní ploška světlejší, jemný obrys. Barva kamene může být jiná než barva
koleje (Mrzimor: žlutý štít, **bledé diamanty** `#F3F0E4`) — pak ji drž zvlášť.

**Barvy kolejí:** Nebelvír `#AE0001` (rubíny), Zmijozel `#1A7F37` (smaragdy),
Havraspár `#0E4D92` (safíry), Mrzimor `#D4A017` (diamanty).

**Animace při přičtení:** při každém kroku animace odletuje ze hrdla kámen, padá s gravitací,
dopadne na hladinu hromady, rozprskne 3 jiskry a hromada o kus povyroste. Délka animace
0,7–6 s podle velikosti dávky (`0,35 s na kámen`), počet padajících kamenů stejný.
Čísla se přetáčejí současně.

**Animace při odečtení:** symetricky, ale kameny se **drolí v prach** (šedé částice), nepadají.

**Zvuk (WebAudio, žádné soubory):** šum s pásmovou propustí = sypání; dva sinusové tóny
(1046 a 1568 Hz) = přičtení; nízký trojúhelník 146 Hz + krátký šum = odečtení;
čtyři stoupající tóny (523, 659, 784, 1046 Hz) = změna vedení. Tlačítko 🔇 v rohu,
volba se ukládá do `localStorage`.

**Zápatí:** vpravo drobný indikátor spojení („připojeno“ / červeně „čekám na spojení“).

## 5. Technické meze (běží na LG Smart TV)

- **Pouze canvas 2D** a CSS animace. Žádný WebGL, žádné knihovny, žádné externí fonty ani CDN.
- `devicePixelRatio` zastropuj na **1,5**; částic nejvýš **250**; sprites drahokamů
  předkresli jednou do offscreen canvasu a jen je `drawImage`.
- `requestAnimationFrame`; při skrytém tabu kreslení pauzuj.
- Mřížku míst pro kameny počítej **jen při změně velikosti**, ne v každém snímku.

## 6. Kde zaříznout mínus (důležité)

Jsou dvě nezávislá místa a vyplatí se obojí:

- **Zobrazení (nutné):** `stav = Math.max(0, hodnotaZApi)` — tím se nikdy nekreslí mínus,
  i když tabulka mínus má.
- **Tabulka (volitelné, ale čistší):** ve listu `Skóre` obal vzorec: `=MAX(0; SUMIF(...))`.
  Pozor na změnu významu: kolej, která měla 10 a dostala −30, bude mít 0; další +5 ji
  dostane na 5, ne na −15. Pokud chceš historii beze změny, nech součet syrový a zařízni
  jen zobrazení.

## 7. Akceptační kritéria

- [ ] Na 1920×1080 se nic nepřetéká, nikde není scrollbar, text není menší než 1,3 vh.
- [ ] Čtyři koleje v pořadí Nebelvír, Zmijozel, Havraspár, Mrzimor.
- [ ] 0 bodů = úplně prázdná baňka.
- [ ] Nejvyšší kolej je vždy pod 100 % výšky nádoby; nižší koleje úměrně.
- [ ] `1 drahokam = N b.` odpovídá skutečnému počtu kamenů v baňce.
- [ ] Záporná hodnota z API se zobrazí jako 0 a nikde není znaménko mínus.
- [ ] Při přičtení i odečtení se animuje a ozve zvuk; při změně vedení zahraje fanfára.
- [ ] Po 10 minutách běhu se paměť nezvyšuje (částice se uvolňují).

## 8. Co nedělat

- Nekopírovat filmové erby ani loga — jsou to cizí kresby; používej vlastní jednoduchou heraldiku.
- Nepřidávat knihovny (React, GSAP, three.js) — na televizi to zbytečně zatíží paměť.
- Neměnit formulář, tabulku ani endpoint; grafika je jen jiná prezentace stejných dat.
