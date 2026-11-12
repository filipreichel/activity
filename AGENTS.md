# AGENTS.md — Aktivita pro Ypsilon (webová hra)

> Tenhle soubor čte každý agent, který v repu pracuje. Platí pro notebook
> (`~/AI/projects/hermes/school/activity`) i pro cloud (`/root/AI/projects/school/activity`).

## Co to je

Hra „Aktivity pro Ypsilon" pro školu: týmy hádají **výrazy** ve třech disciplínách
(Popis / Kreslení / Pantomima). Děti mohou přes modul „Společný slovník výrazů"
přidávat vlastní výrazy do společné databáze; hra losuje v pořadí
**cizí výrazy → vlastní výrazy → zabudovaný slovník**.

## Soubory

| Soubor | Co je uvnitř |
|---|---|
| `index.html` | hra — styly, rozhraní, herní logika i volání API (jeden soubor, žádný build) |
| `pridat.html` | samostatná stránka pro vkládání výrazů (jména, výraz, disciplíny, obtížnost) + seznam vlastních výrazů s úpravou |
| `prehled-7c4a91.html` | **dashboard pro učitele** — záložka Hra (živý stav na TV) + záložka Slovník (žebříček a tabulka); **neveřejná adresa, nikam na ni neodkazovat** (`robots.txt` + `noindex`) |
| `api/slovnik.js` | Vercel Serverless Function: `GET` seznam, `POST` nový výraz, `PATCH` úprava vlastního |
| `api/stav.js` | živý stav rozehrané hry (`POST` snapshot z tabletu, `GET` pro dashboard, TTL 6 h) |
| `package.json` | jen `engines` + skripty, **žádné závislosti** (Redis se volá přes REST) |
| `vercel.json` | `outputDirectory: "."` (statický web v kořeni) + `maxDuration` pro funkci |
| `perlicky/` | druhá hra na stejné doméně: **Perličky češtiny** (týmový kvíz, `/perlicky/`) — viz níže |

## Datový model výrazu

```js
{ id, text, names, tasks: ['desc','draw'], points: { desc: 1, draw: 3 },
  deviceId, createdAt, updatedAt }
```

- **Obtížnost je pro každou disciplínu zvlášť** (`points`), nikdy jedno číslo pro všechny.
- V UI není nic předvybrané: bodová pilulka disciplínu zapne, klik na stejnou pilulku ji zase odznačí; platí aspoň jedna disciplína s body.
- Starší záznamy s jedním `pts` se čtou dál (`normalizeWord` je srovná na `points`).

## Perličky češtiny (`/perlicky/`)

Týmový kvíz o českém jazyce převedený z prezentace `PERLIČKY ČEŠTINY.ppsx`
(5 kategorií × 5 otázek, 2–8 týmů, střídání hráčů). Čistě statické, bez API
a bez databáze, stav hry v `localStorage`, druhé okno se synchronizuje přes
`BroadcastChannel`.

**Pravidla:** hodnota otázky 1 000–5 000 · tým na tahu neví → nic neztrácí, ale
další tým v pořadí dostane **dialog s nabídkou krádeže** za polovinu (500–2 500)
a s **polovičním časem, nejméně 10 s** · kdo krade a netrefí, o polovinu **přichází**
(skóre může jít do minusu) · krádež jde jen jednou za otázku, nebere hráči jeho
vlastní kolo a lze ji odmítnout · odpovídá tým jako celek, hráči se needdají.

**Průběh otázky:** 1. klik na dlaždici ji jen **označí** (děti na projekci vidí
„Vybraná otázka“), 2. klik (tlačítko „Zobrazit otázku“ nebo dlaždice znovu) otázku
**ukáže** a spustí odpočet. Konec hry = **stupně vítězů** (2–1–3) a zbytek týmů
pod nimi.

**Zvuk:** tik odpočtu, **posledních 5 s jiný (ostřejší) tón a zároveň červený odpočet**,
gong na nule, jiný tón pro správnou a pro špatnou odpověď. Přepínač 🔇/🔉/🔊.
Změna hlasitosti ani přepnutí odpovědí **nesmí zastavit odpočet** (render ošetřen
předáním zbývajícího času do `startTimerFrom`).

**Odpovědi u učitele:** přepínač „👁 Odpovědi“ v liště zapíná/vypíná správnou odpověď
pro **všechny** otázky (`S.showAnswers`, ukládá se); oko u otázky (`S.peekQid`) ji
ukáže **jen pro právě zobrazenou** otázku. Panel s odpovědí je v řídicím okně
sticky u spodního okraje, aby byl vidět i když se otázka nevejde.

**Vejít se na obrazovku:** `fitView()` po každém vykreslení zmenšuje `--fit`
(projekce od 1,2 dolů, řídicí okno od 1,0, minimum 0,72), dokud se obsah nevejde;
všechny velikosti písma v CSS jsou `calc(clamp(…) * var(--fit, 1))`.

**Dvě okna:** `?role=display` je projekce pro děti (bez odpovědí a bez ovládání),
výchozí okno je řídicí panel učitele (vidí správnou odpověď a vysvětlení).
Otevírá se tlačítkem „🖥️ Projekce“; obě okna musí být ve stejném prohlížeči.

| Soubor | Co je uvnitř |
|---|---|
| `perlicky/index.html` | kostra stránky |
| `perlicky/styles.css` | vzhled (navazuje na původní prezentaci — světlý podklad, ploché barvy) |
| `perlicky/data.js` | všech 25 otázek, varianty, správné odpovědi a vysvětlení |
| `perlicky/app.js` | herní logika, časomíra se zvukem, dvě okna, ukládání |
| `perlicky/img/` | ilustrace vytáhnuté z prezentace |
| `perlicky/__test.html` | regresní test řídicího okna (39 kontrol) a projekce (28) |
| `perlicky/__test-sound.html` | test zvuků, gongu a tónů odpovědí přes stub WebAudio (13 kontrol) |
| `perlicky/__demo.html` | náhled stavů pro screenshoty (`?v=board|picked|question|offer|reveal|results&role=display&m=1`) |

Testy se pouští v prohlížeči proti lokálnímu serveru (nevydávají se, hlídá je `.vercelignore`):

```bash
cd perlicky && python3 -m http.server 8765 --bind 127.0.0.1 &
for u in "__test.html" "__test.html?role=display" "__test-sound.html"; do
  google-chrome --headless=new --virtual-time-budget=15000 --dump-dom \
    "http://127.0.0.1:8765/$u" | grep -o '<title>[^<]*</title>'
done   # → PASS-30, PASS-19, PASS-11
```

Skutečné propojení dvou oken (řídicí → projekce) se ověřuje přes CDP: otevřít
`?role=display` tlačítkem, pak v projekci zkontrolovat, že nemá `.teacher` ani
`.options li.right` a že jí chodí odpočet.

## Nasazení

- `git push` do `main` → Vercel sám postaví **produkci**.
- Push do jiné větve → **preview** deployment (za Vercel Authentication).
- Veřejná adresa: <https://activity-gamma-beige.vercel.app> (projektová doména, proto veřejná).
- Vercel projekt: `activity`, tým `filip-scio`, projekt id `prj_hWxlRBeJ7Ao3sA8IjuhKi3xBNQAw`.

## Data

- Upstash Redis, hash `slovnik:vyrazy` (field = id výrazu, value = JSON).
- Proměnné prostředí ve Vercelu: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  (funkce bere i `KV_REST_API_URL` / `KV_REST_API_TOKEN`).
- **Bez databáze musí hra fungovat dál** — `api/slovnik` vrátí 503, UI to napíše
  a losuje ze zabudovaného slovníku. Tuhle pojistku nemaž.

## Pravidla práce

1. **Před úpravou vždy `git pull --rebase`** — na repu pracuje víc strojů (notebook i cloud).
2. **Nikdy `git push --force`** na `main`; nikdy nepřepisuj cizí commit.
3. Jeden commit = jedna změna, zpráva česky a konkrétní.
4. **Terminologie v UI je „výraz"**, pole pro tvůrce „Vaše jména". Nepoužívej „slovo".
5. Vlastní výraz pozná **ID zařízení** (`yp_device_id` v `localStorage`), ne jméno týmu.
6. Po úpravě ověř, že web opravdu běží: `curl -s -o /dev/null -w "%{http_code}" <adresa>`
   → `200`, a že nová verze je venku (Vercel deployment `READY` na commitu, který jsi pushnul).
7. Když build spadne, oprav ho nebo změnu vrať (`git revert`) — škola na tom může zrovna hrát.
8. Klíče a tokeny nikdy do repa; patří do Vercel env proměnných.

## Rychlá kontrola po nasazení

```bash
curl -s -o /dev/null -w "web: %{http_code}\n" "https://activity-gamma-beige.vercel.app/?cb=$RANDOM"
curl -s "https://activity-gamma-beige.vercel.app/api/slovnik" | head -c 200
```

První musí vrátit `web: 200`; druhý buď `{"ok":true,"counts":{...}}` (databáze připojená),
nebo `{"ok":false,"error":"Společný slovník není připojený…"}` (hra jede ze zabudovaného slovníku).

## Živý stav hry

Hra po každé změně (start kola, odhalení, konec kola, tik časomíry) posílá snapshot na
`POST /api/stav` — pole `teams`, `currentTeamIdx`, `taskName`, `timeLeft`, `revealed`,
`word` (jen po odhalení, aby ho neviděla celá třída), `points`, `authors`, `paused`.
Dashboard ho čte každé 2 s. Když je stav starší než 20 s, hlásí, že hra neběží.

## Obrazovka hry

- Výsledková tlačítka (Uhádnuto / Neuhádnuto) jsou **zamčená, dokud se výraz neodhalí**.
- Klik na logo (jen na úvodní obrazovce) otevírá přes celou obrazovku **QR kód** ke hře;
  ve hře klik na logo nic nedělá.
