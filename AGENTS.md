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
| `index.html` | celá aplikace — styly, rozhraní, herní logika i volání API (jeden soubor, žádný build) |
| `api/slovnik.js` | Vercel Serverless Function: `GET` = seznam výrazů + počty, `POST` = zápis nového výrazu |
| `package.json` | jen `engines` + skripty, **žádné závislosti** (Redis se volá přes REST) |
| `vercel.json` | `outputDirectory: "."` (statický web v kořeni) + `maxDuration` pro funkci |

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
