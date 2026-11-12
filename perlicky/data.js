/* PERLIČKY ČEŠTINY — obsah hry
   Přepsáno z prezentace PERLIČKY ČEŠTINY.ppsx (81 slidů → 25 otázek).
   value = násobek tisíce (10 → 10 000 bodů). */

const CATEGORIES = [
  { id: 'cisla',    name: 'Čeština v číslech',      color: '#E04116' },
  { id: 'prislovi', name: 'Přísloví a rčení',       color: '#F3960F' },
  { id: 'nareci',   name: 'Nářečí',                 color: '#9D4DE7' },
  { id: 'slova',    name: 'Zajímavosti o slovech',  color: '#449EF3' },
  { id: 'cestina',  name: 'Zajímavosti o češtině',  color: '#2FB3AB' }
];

/* options: pole odpovědí (A, B, C…) nebo null = otevřená odpověď
   correct: index správné odpovědi (u otevřených null)
   answer:  text správné odpovědi (u otevřených ho ukáže až odhalení)
   img:     obrázek k otázce, imgs: obrázky k odpovědi (galerie) */

const QUESTIONS = [
  /* ---------- Čeština v číslech ---------- */
  {
    cat: 'cisla', value: 10,
    q: 'Kolik slov má čeština?',
    options: ['Přes 100 000', 'Přes 400 000', 'Přes 250 000'],
    correct: 2,
    answer: 'C) Přes 250 000 slov',
    explain: 'Pro běžnou domluvu používá člověk zhruba 5 000 – 10 000 slov.'
  },
  {
    cat: 'cisla', value: 20,
    q: 'Přibližně kolik lidí mluví po celém světě česky?',
    options: ['Přes 15 milionů', 'Přes 12 milionů', 'Přes 10 milionů'],
    correct: 1,
    answer: 'B) Přes 12 milionů',
    explain: 'Nejvíce Čechů v zahraničí žije v USA, Argentině, Chorvatsku a Rumunsku.',
    imgs: ['img/image2.jpg']
  },
  {
    cat: 'cisla', value: 30,
    q: 'Kolik slov začínajících na jedinečnou českou hlásku Ř obsahuje Slovník spisovné češtiny?',
    options: ['Přes 100', 'Přes 250', 'Přes 400'],
    correct: 0,
    answer: 'A) Přes 100',
    explain: 'Zkuste si jazykolamy na Ř: „Tři sta třicet tři stříbrných stříkaček stříkalo přes tři sta třicet tři stříbrných střech.“ Nebo: „Kmotře Petře, nepřepepřete mi toho vepře…“'
  },
  {
    cat: 'cisla', value: 40,
    q: 'Na kolikátém místě v pořadí nejpoužívanějších slov se pohybuje podstatné jméno „rok“?',
    options: ['Na 22. místě', 'Na 44. místě', 'Na 66. místě'],
    correct: 0,
    answer: 'A) Na 22. místě',
    explain: 'Pořadí pěti nejpoužívanějších českých slov: spojka „a“, předložka „v/ve“, předložka nebo zájmeno „se“, sloveso „být“, předložka „na“.'
  },
  {
    cat: 'cisla', value: 50,
    q: 'Kolik knih ročně přečte žák 2. stupně ZŠ?',
    options: ['2 knihy', '7 knih', '16 knih'],
    correct: 1,
    answer: 'B) 7 knih',
    explain: 'Podle výzkumu Národní knihovny z roku 2021 se nejoblíbenějším titulem starších dětí stal Deník malého poseroutky, Harry Potter a nově zabodovala Prašina. U dospívajících 15–19 let vedou Harry Potter, Zaklínač a 1984 (G. Orwell).',
    imgs: ['img/image4.jpg', 'img/image5.jpg', 'img/image6.jpg']
  },

  /* ---------- Přísloví a rčení ---------- */
  {
    cat: 'prislovi', value: 10,
    q: 'Jak zní klasické přísloví, které dostalo nový, moderní kabát?\n„Co na srdci, to na Facebooku.“',
    options: null,
    correct: null,
    answer: 'Co na srdci, to na jazyku.',
    explain: '',
    imgs: ['img/image7.jpg']
  },
  {
    cat: 'prislovi', value: 20,
    q: 'Co znamená slovo PIKLE, o němž se také zpívá v písničce z pohádky Šíleně smutná princezna?\n„Kujme pikle, kujme pikle, obvyklé i neobvyklé…“',
    options: ['Malá husitská zbraň', 'Železná nádoba na mince', 'Hrací karta (piklový král)'],
    correct: 0,
    answer: 'A) Malá husitská zbraň',
    explain: '„Kout pikle“ znamená připravovat proti někomu spiknutí, chystat zradu.',
    imgs: ['img/image8.jpg']
  },
  {
    cat: 'prislovi', value: 30,
    q: 'Co znamená slovo BELA v přirovnání „Stojí to za starou belu“?',
    options: ['Stará veverčí kůže', 'Stará bačkora', 'Ošklivá žena'],
    correct: 0,
    answer: 'A) Stará veverčí kůže',
    explain: 'Původně takto byly označeny kůže veverek zvaných bělky, bely (měly bílou srst), které sloužily jako platidlo. Pokud byla kůže zpuchřelá nebo plesnivá, nestála za nic – stála za starou belu.',
    imgs: ['img/image9.jpg']
  },
  {
    cat: 'prislovi', value: 40,
    q: 'Co znamená slovo LUNT v přirovnání „hubený jako lunt“?',
    options: ['Lusk, který v sobě nemá plody', 'Bič na dobytek', 'Knot, kterým se zapalovala děla'],
    correct: 2,
    answer: 'C) Knot, kterým se zapalovala děla',
    explain: 'Podobný význam mají přirovnání: hubený jak za groš kudla, hubený jako chroust, koza, žížala, hubený jak vyžle (druh loveckého psa).',
    imgs: ['img/image10.jpg', 'img/image11.jpg']
  },
  {
    cat: 'prislovi', value: 50,
    q: 'Copak znamená slovo BRDO ve rčení „Stojí to za jedno brdo“?',
    options: ['Nekvalitní nápoj', 'Pohoří v západních Čechách', 'Kus tkalcovského stroje'],
    correct: 2,
    answer: 'C) Kus tkalcovského stroje',
    explain: 'Rčení znamená, že je něco pořád na stejný způsob, stereotypní, to samé.',
    imgs: ['img/image12.jpg']
  },

  /* ---------- Nářečí ---------- */
  {
    cat: 'nareci', value: 10,
    q: 'Po čem jezdí v Brně šalina?',
    options: ['Po vodě', 'Po silnici', 'Po kolejích'],
    correct: 2,
    answer: 'C) Po kolejích',
    explain: 'Šalina je tramvaj. A brněnským nářečím, tzv. hantecem, se kolejím řekne glajze. Brněnský hantec je směsí hanáckých nářečí, němčiny, romštiny i jazyka jidiš. Na rozdíl od starých dialektů ale neskomírá – vychází v něm dokonce knihy.',
    imgs: ['img/image13.jpg']
  },
  {
    cat: 'nareci', value: 20,
    q: 'Co si pořídíte v Českých Budějovicích, když si koupíte PIKADOR?',
    options: ['Párek v rohlíku', 'Malý kapesní nožík', 'Pneumatiku'],
    correct: 0,
    answer: 'A) Párek v rohlíku',
    explain: 'V Česku se párek v rohlíku začal prodávat údajně od roku 1972, kdy českobudějovický řezník Václav Masopust viděl tento rychlý pokrm na své letní dovolené ve španělském Madridu. Po návratu ho začal prodávat v Českých Budějovicích a označil jej jako pikador – podle zápasníků s býky, kteří jsou vybaveni kopím (píkou).',
    imgs: ['img/image14.jpg']
  },
  {
    cat: 'nareci', value: 30,
    q: 'Když vám někdo na Plzeňsku řekne, že mu máte přinést TRHAČKU – o co vás žádá?',
    options: ['O košík na nákup', 'O papírový blok', 'O zahradnický nástroj na trhání ovoce'],
    correct: 1,
    answer: 'B) O papírový blok',
    explain: 'Plzeňské nářečí je známé svým „tutáním“ – místo zájmen toto, tato, tento používají univerzální „tuto“. Nářečí bylo zpracováno v Plzeňsko-českém slovníku.',
    imgs: ['img/image15.jpg']
  },
  {
    cat: 'nareci', value: 40,
    q: 'Na nákupním seznamu babičky z jižní Moravy se objevilo: turkyně, erteple a oharky. Pro co vás babička poslala?',
    options: ['Krůtu, brambory a sirky', 'Kukuřici, brambory a okurky', 'Turecký med, brambory a cigarety'],
    correct: 1,
    answer: 'B) Kukuřici, brambory a okurky',
    explain: 'Tato původem americká rostlina se k nám dostala prostřednictvím kočovníků, kteří ji na Moravu přivezli z Turecka někdy během 17. století – a proto se jí zde říká „turkyně“.',
    imgs: ['img/image16.jpg', 'img/image17.jpg']
  },
  {
    cat: 'nareci', value: 50,
    q: 'K čemu na Třeboňsku slouží KOPRVADLO?',
    options: ['K vaření', 'K práci na zahradě', 'Ke hraní'],
    correct: 0,
    answer: 'A) K vaření',
    explain: '',
    imgs: ['img/image18.jpg']
  },

  /* ---------- Zajímavosti o slovech ---------- */
  {
    cat: 'slova', value: 10,
    q: 'Ryze český pozdrav je:',
    options: ['Ahoj', 'Čau', 'Nazdar'],
    correct: 2,
    answer: 'C) Nazdar',
    explain: 'Jde o složeninu prvních dvou slov, která se objevovala na kasičkách, do kterých lidé přispívali na stavbu Národního divadla. Celá věta zněla: „Na zdar důstojného Národního divadla.“ Historie vzniku tohoto pozdravu se datuje k 14. dubnu 1851. AHOJ je starý námořnický pozdrav, původně „Ahoe“, převzali jsme ho z angličtiny. ČAU pochází z italského Ciao.',
    imgs: ['img/image19.jpg']
  },
  {
    cat: 'slova', value: 20,
    q: 'Odkud se vzal název pro PEXESO?',
    options: ['Z neznámého mexického slova', 'Zkratka ze soutěže „Pekelně se soustřeď“', 'Z anglického slova pixel'],
    correct: 1,
    answer: 'B) Zkratka ze soutěže „Pekelně se soustřeď“',
    explain: 'Vymyslel ho v roce 1965 pan Princ pro podnik Pressfoto. Navrhl obrázkovou mozaiku složenou z 32 obrázkových dvojic a jméno použil ze sousloví PEKelně SE SOustřeď. Přesně pod tímhle titulem vysílala Československá televize populární soutěžní hru.',
    imgs: ['img/image22.jpg']
  },
  {
    cat: 'slova', value: 30,
    q: 'V češtině existují pouze 3 slova, která začínají na hlásky TCH. Vyjmenujte alespoň dvě.',
    options: null,
    correct: null,
    answer: 'Tchán, tchyně a tchoř',
    explain: 'Spisovná čeština připouští pouze podobu s krátkým y, tedy tchyně. V mluvené řeči se ale častěji objevuje tchýně.',
    imgs: ['img/image20.jpg', 'img/image21.jpg']
  },
  {
    cat: 'slova', value: 40,
    q: 'Na obrázku vidíte bylinku, která má ve svém názvu všechny samohlásky v řadě za sebou tak, jak se je učíme vyjmenovávat. Jak se jmenuje?\nNápověda: objevuje se i v básni Kytice od K. J. Erbena.',
    options: null,
    correct: null,
    answer: 'Mateřídouška',
    explain: 'Stejné pořadí samohlásek má ještě slovo dvacetikoruna. Z Kytice: „I zželelo se matce milých dítek; duše její se vrátila a vtělila se v drobnolistí kvítek, jím mohylu svou pokryla. Poznaly dítky matičku po dechu, poznaly ji a plesaly; a prostý kvítek, v něm majíc útěchu, mateřídouškou nazvaly.“',
    img: 'img/image23.jpg',
    imgs: ['img/image24.jpg']
  },
  {
    cat: 'slova', value: 50,
    q: 'Které z uvedených českých měst není v ženském rodě?',
    options: ['Olomouc', 'Přelouč', 'Suchdol', 'Okoř', 'Telč'],
    correct: 2,
    answer: 'Suchdol',
    explain: 'Olomouc – 7. pád olomoucí, Přelouč – přeloučí, Okoř – okoří, Telč – telčí. Ale Suchdol – 7. pád suchdolem.',
    imgs: ['img/image25.jpg']
  },

  /* ---------- Zajímavosti o češtině ---------- */
  {
    cat: 'cestina', value: 10,
    q: 'Které příjmení v češtině neexistuje?',
    options: ['Ontověděl', 'Zabilpivo', 'Nejezhouska'],
    correct: 2,
    answer: 'C) Nejezhouska',
    explain: 'Další kuriózní příjmení: Rádsetoulal, Zabiljelito, SnědlDítětiKaši. Naopak nejběžnější česká příjmení jsou Novák, Svoboda, Novotný, Dvořák.'
  },
  {
    cat: 'cestina', value: 20,
    q: 'Kde v zahraničí můžete studovat bohemistiku?\n(nauka o českém jazyce, literatuře a kultuře)',
    options: ['Ve Finsku', 'V Egyptě', 'V Indii'],
    correct: 2,
    answer: 'C) V Indii',
    explain: 'Bohemistiku lze studovat také v Číně, Dánsku, Itálii, Japonsku, Jižní Koreji, Kanadě, Německu, Nizozemsku, Norsku, Polsku, Rakousku, Rusku, na Slovensku, ve Švédsku, Švýcarsku, na Ukrajině, v USA, na Tchaj-wanu a ve Velké Británii.',
    imgs: ['img/image26.jpg']
  },
  {
    cat: 'cestina', value: 30,
    q: 'Víte, které podstatné jméno je nejoblíbenější v českých básních?',
    options: ['Den', 'Národ', 'Duše'],
    correct: 0,
    answer: 'A) Den',
    explain: 'V první desítce jsou tato podstatná jména: 1. den, 2. oko, 3. člověk, 4. noc, 5. svět, 6. láska, 7. čas, 8. život, 9. srdce, 10. ruka.',
    imgs: ['img/image27.jpg']
  },
  {
    cat: 'cestina', value: 40,
    q: 'Které české slovo se nejvíce proslavilo ve světě a přijaly ho do svých slovníků i cizí jazyky?',
    options: ['Pivo', 'Robot', 'Puk'],
    correct: 1,
    answer: 'B) Robot',
    explain: 'Poprvé se termín objevil ve hře Karla Čapka R. U. R. z roku 1920. Vymyslel ho ale bratr Josef Čapek a pochází ze slova „robota“, čili nevolnická práce.',
    imgs: ['img/image28.jpg']
  },
  {
    cat: 'cestina', value: 50,
    q: 'V době národního obrození došlo k pojmenování měsíců v roce. Zvláštnost máme u 5. měsíce – května, který je znám i pod názvem máj. Pátý měsíc v roce se však mohl jmenovat jinak. Tipněte si jak.',
    options: ['Traven', 'Bouřník', 'Šeřen'],
    correct: 0,
    answer: 'A) Traven',
    explain: 'Odvozený od slova tráva – v tomto měsíci se začíná s pastvou dobytka na zelené trávě. Název se ale neujal. Zajímavostí je, že květen mají i Poláci, ale označuje náš duben.',
    imgs: ['img/image29.jpg']
  }
];

QUESTIONS.forEach((q, i) => { q.id = 'q' + i; });
