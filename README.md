# Higgsfield Studio

Web aplikacija inspirirana Higgsfieldom, na hrvatskom jeziku, sa stvarnom integracijom **Pika API Club**. React + TypeScript + Vite frontend i Express backend.

## Pokretanje

Potreban je Node.js 24.

```sh
npm install
npm run dev
```

Otvori **http://localhost:5173**. Klikni **Poveži API**, unesi ključ sa [Pika API Club](https://dev.pika.art), zatim otvori **Studio**. Odaberi model, unesi opis / učitaj referencu, provjeri cijenu pa pokreni generiranje.

Za produkcijsko pokretanje prvo postavi stabilan `SESSION_SECRET` u serversko okruženje (format je opisan niže), zatim:

```sh
npm run build
npm start
```

Produkcijska aplikacija dostupna je na portu `3001` (ili `PORT`). HTTPS reverse proxy treba sačuvati javni Host; po potrebi postavi `APP_ORIGIN=https://tvoja-domena.hr`.

## Vercel

Repozitorij sadrži `vercel.json` i Node ulaznu točku `api/index.js`. Vercel gradi Vite frontend u `dist/`, poslužuje statičke datoteke preko CDN-a i usmjerava `/api/*` prema Express funkciji. Odaberi Node.js 24 i postavi `SESSION_SECRET` kao osjetljivu serversku varijablu za Production i Preview prije prve objave. Korisnikov Pika ključ unosi se u aplikaciji; nije varijabla projekta.

`vercel.json` i Express poslužitelj šalju ista sigurnosna zaglavlja (CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`); test provjerava da su usklađena. Datoteke u `dist/assets/` imaju hash u nazivu pa se trajno spremaju u predmemoriju, a nepostojeći chunk vraća 404 umjesto HTML-a. Otvorena kartica nakon nove objave jednom se automatski osvježi ako zatraži stari chunk.

Prijenos referentnih datoteka koristi mali autorizirani zahtjev za potpis, a zatim preglednik izravno šalje datoteku na Pika spremište. Tako datoteke do 20 MB za slike/audio i 50 MB za video ne prolaze kroz Vercelovo ograničenje veličine zahtjeva. Ako spremište ne dopušta CORS za domenu aplikacije, korisnik može unijeti javni URL reference; stvarni upload treba provjeriti s važećim Pika ključem.

## Implementirano

- Responzivno filmsko sučelje, izravni unos ideje s početne stranice, galerija s kategorijama, pretraga, spremljeni predlošci i kopiranje opisa.
- Navigacija s podrškom za Back/Forward; studio ostaje sačuvan pri promjeni stranice. Nacrti postavki po modelu čuvaju se u sesiji preglednika.
- Brza pretraga (`Ctrl/⌘ K`) za modele, ideje, pokrete kamere i alate; pokreti kamere dodaju tekstualne upute u opis i ne pokreću automatsko generiranje.
- Pretraživ odabir modela s lokalnim favoritima; imenovani predlošci potpunih postavki s primjenom, preimenovanjem i uklanjanjem.
- Ponovna uporaba rezultata vraća izvorni model, opis i sve podržane ulazne postavke. Model koji je uklonjen iz kataloga prikazuje jasnu poruku i zahtijeva novi odabir.
- Biblioteka podržava kartice/popise, sortiranje po datumu i čitljiv pregled prethodnih postavki.
- Pregled referentnih slika, videozapisa i audija, pomoć pri pisanju opisa i jasni koraci priprema → cijena → generiranje.
- Aktualni katalog asinkronih medijskih operacija iz službenog API-ja, bez tvrdo kodiranih cijena.
- Generiranje videa, slika, audija i drugih podržanih medijskih zadataka prema shemi odabranog modela.
- Učitavanje referentnih datoteka, postavke modela, procjena cijene prije generiranja, provjera stanja računa.
- Slanje zahtjeva sa zaštitom od dvostruke naplate pri ponavljanju istog zahtjeva, praćenje statusa, prikaz i preuzimanje stvarnih rezultata.
- Biblioteka rezultata s medijskim karticama, pretragom, filtrima statusa, automatskim osvježavanjem aktivnih zahtjeva, ponovnim korištenjem opisa i potvrđenim lokalnim uklanjanjem.
- Lokalno posluženi DM Sans i Manrope fontovi, bez zahtjeva prema Google Fonts. Licence su u `public/fonts/`.
- API ključ zaštićen je AES-256-GCM šifriranjem u HttpOnly session cookieju, uz serverski `SESSION_SECRET`; nije dostupan JavaScriptu. Sesija vrijedi 12 sati i radi nakon restarta ili na više instanci. Odspajanje briše cookie iz preglednika.
- Prihvaćen aktivan zahtjev nastavlja provjeru statusa nakon osvježavanja stranice, bez ponovnog slanja generiranja. Neizvjestan zahtjev ima zasebnu radnju oporavka s istim ID-jem i istim postavkama.
- Povlačenje i ispuštanje referentnih datoteka uz provjeru formata, veličine i broja datoteka prije prijenosa.
- Jasan prikaz nedostupne veze i pokušaj ponovne provjere sesije; oporavak prikaza nakon neočekivane greške ne briše lokalne podatke.
- Oštećen ili istekao pregled rezultata ima radnju osvježavanja istog zahtjeva; detalji podržavaju veći pregled i kopiranje ID-ja za podršku.
- Početne cijene iz kataloga (npr. „od $0.04 / s”) prikazuju se na karticama modela, u brzoj pretrazi i pri odabiru modela; točna cijena i dalje se provjerava prije generiranja.
- Uz procijenjenu cijenu studio prikazuje stanje računa (uključujući postpaid razdoblje) i iznos nakon generiranja. Ako sredstva nisu dovoljna, generiranje je onemogućeno uz poveznicu za nadoplatu i osvježavanje stanja.
- Generiranja se prate u pozadini na svakoj stranici. Tijekom čekanja studio se može osloboditi za novu ideju, a po završetku stiže obavijest s izravnim otvaranjem rezultata. Naslov kartice pokazuje aktivne i dovršene zahtjeve; obavijesti preglednika su opcionalne.
- `Ctrl/⌘ + Enter` provjerava cijenu, a ponovni namjerni pritisak pokreće generiranje. Sliku je moguće zalijepiti (`Ctrl/⌘ + V`) izravno u referentno polje odabranog modela.
- Povijest kreacija može se izvesti u JSON sigurnosnu kopiju i uvesti na drugom uređaju; uvoz preskače duplikate i nikad ne sadrži API ključ.
- Studio i biblioteka učitavaju se na zahtjev (manji početni JavaScript), a sličice pokreta kamere koriste male verzije fotografija.

Galerijske fotografije služe kao inspiracija, nisu generirani rezultati. Izvori su u `public/images/sources.json`. Ovo je neovisna aplikacija; ne koristi Higgsfield račun ili njihove interne API-je. Dostupne mogućnosti ovise o Pika API Club katalogu, ključu, sredstvima i uvjetima pružatelja. Složena ugniježđena polja pojedinih modela uređuju se kao JSON.

## Provjere

```sh
npm test
npm run build
```

Backend testovi koriste mock odgovore i ne troše sredstva. Testovi u `tests/` pokrivaju čiste pomoćne module iz `src/lib/` (mediji, cijene, katalog, povijest, reference) i pokreću se izravno u Node.js-u bez dodatnih alata. Stvarni javni katalog, sheme i izračun cijene provjereni su preko Pika API-ja. Plaćeno generiranje nije testirano stvarnim ključem. Browser smoke testovi nalaze se u `scratch/` i pokreću se uz aktivan dev server i instalirani Playwright Chromium (`npx playwright install chromium`).

Produkcija zahtijeva serversku varijablu `SESSION_SECRET`: 64 heksadecimalna znaka dobivena iz 32 kriptografski nasumična bajta. Sve instance moraju koristiti isti secret; nikad ga ne postavljati kao `VITE_` varijablu niti spremati u Git. Promjena secreta završava postojeće sesije. Razvoj bez te varijable koristi privremeni ključ za taj proces.

Predmemorija zahtjeva i ograničenje učestalosti vrijede po instanci; Pika provodi idempotentnost po izvornom ID-u zahtjeva. Nakon neizvjesne predaje i hladnog starta provjera salda može zaustaviti oporavak već naplaćenog zahtjeva; aplikacija zadržava izvorni ID i ne stvara automatski novi zahtjev. Trenutna globalna opozivost sesija i zajamčen oporavak između instanci zahtijevaju trajno dijeljeno spremište. Povijest pripada ovom pregledniku; nije sinkronizirana između uređaja. Detalji integracije i izvori: [server/README.md](server/README.md).
