# Redesign av KS-träningen: slutsvar, diagram och akademisk tidskriftsstil

## Status och auktoritet

Denna specifikation beskriver en godkänd redesign av den befintliga lokala KS-träningen på grenen `codex/ks-practice`. Den kompletterar den ursprungliga designen i `2026-09-11-ks-practice-design.md` och ersätter dess regler om självbedömningsfält och visuell Apple-inspiration där de två dokumenten skiljer sig.

Följande användarbeslut är bindande:

- endast korta slutsvar ska skrivas och bedömas digitalt;
- uträkningar, bevis, kraftfigurer, Bohrmodeller, elektronformler och längre resonemang ska göras i studentens räknehäfte;
- efter rättning ska studenten jämföra sitt arbete i räknehäftet med den fullständiga lösningen, utan att rapportera metodpoäng till sidan;
- samtliga diagram, inte bara ett representativt exempel, ska vara både geometriskt/fysikaliskt korrekta och fria från överlappningar;
- den visuella riktningen är ”Akademisk tidskrift”: varm papperskänsla, serifrubriker, mörkt vinrött bläck och gröna arbetsmarkörer, inspirerad av Anthropics redaktionella rytm men utan kopierade varumärkeselement.

## Befintlig baslinje

Redesignen utgår från en fungerande offlineapplikation med:

- 125 matematikfrågor för Matematik KS2;
- 125 fysikfrågor för Fysik KS1;
- 120 kemifrågor för Kemi KS;
- exakt 370 unika huvudfråge-ID:n och 600 svarsfält;
- fem frågor och tio poäng i matematik respektive fysik;
- sex frågor och tjugo poäng i kemi;
- fria hopp mellan uppgifter, autosparning, återupptagning, timer, repetitionsskydd, utskrift och lösningsvisning efter rättning;
- det exakta kemiformelbladet från den fysiska sidan 6 i originalunderlaget.

Frågeantal, stabila huvud-ID:n, provstruktur, poängsummor, timer, repetitionsskydd och det exakta formelbladet får inte försämras eller ersättas av redesignen.

## Omfattning

Arbetet består av tre sammanhängande delar:

1. ersätta digital redovisning av metod med enbart maskinrättade slutsvar;
2. bygga om och kvalitetsgranska samtliga 150 SVG-diagram i matematik och fysik;
3. applicera den valda akademiska tidskriftsstilen på hubb, prov, dialoger, rättning, lösningar och utskrift.

Kemi har inget eget prompt-SVG-bestånd, men dess formelblad, dialog och lösningsvyer omfattas av UI-redesignen. Originalet under `KS Förberedelse/Underlag` är fortsatt skrivskyddat arbetsmaterial och får aldrig laddas av studentsidor eller läggas till i Git.

## Digital svarmodell

### Grundregel

Det digitala provet bedömer endast slutsvar. Ett slutsvar ska kunna rättas objektivt och med låg risk för feltolkning. Tillåtna digitala format är:

- numeriskt värde med tydligt angiven målenhet;
- lösningsmängd eller algebraisk slutform;
- kemisk formel eller balanserad reaktionsformel;
- ett kort begrepp med uttryckliga accepterade alias;
- ett eller flera tydliga val från en ändlig lista;
- ja/nej eller annan entydig klassificering.

Inga levererade frågor får visa ett fritextfält för uträkning, bevis, ritning, metod eller längre förklaring före rättning. Fälttypen `self` får finnas kvar internt för bakåtkompatibilitet om det underlättar motorn, men ingen av de 370 levererade frågorna får använda den.

### Arbete i räknehäftet

En fråga som kräver mellanled, figur eller resonemang får metadata för pappersarbete, exempelvis:

```js
workOnPaper: {
  title: "Arbeta i räknehäftet",
  instruction: "Rita en fullständig kraftfigur och visa din beräkning där.",
  comparison: "Jämför kraftfigur, teckenval och beräkningsgång med lösningen efter rättning."
}
```

Gränssnittet visar instruktionen före slutsvarsfälten. Standardavslutningen är: `Här skriver du endast slutsvaret.` Den får anpassas grammatiskt, men innebörden ska vara densamma.

Pappersarbetet påverkar inte frågans status som besvarad eller obesvarad. Endast de digitala slutsvarsfälten räknas.

### Poäng

Varje huvudfråga behåller sin nuvarande totalpoäng. Poängen fördelas på dess automatiskt bedömbara slutsvar:

- fysikfrågor med en tidigare kraftfigursdel flyttar hela huvudfrågans poäng till det numeriska eller korta fysikaliska slutsvaret;
- kemifrågor med ritnings- eller resonemangsdelar ersätter dessa med enkla digitala slutsvar som testar samma mål;
- matematikfrågornas befintliga automatiska slutsvar behålls, men alla uppmaningar att redovisa metod i ett digitalt svar tas bort;
- inga digitala metodpoäng, självpoängsknappar eller preliminära poäng krävs.

En korrekt slutsvarskombination ger huvudfrågans fulla digitala poäng. Studentens jämförelse med lösningen är pedagogisk återkoppling och ändrar inte poängen.

### Ämnesspecifik omformning

#### Matematik

Alla matematikfrågor fortsätter använda numeriska svar, lösningsmängder, uteslutna värden och förenklade algebraiska slutformer. När en uppgift kräver beräkning eller bevis visar den en räknehäftesinstruktion. Det får inte finnas en textruta där studenten förväntas skriva sina steg.

Lösningen efter rättning visar fullständig algebraisk kontroll, definitionsvillkor och eventuella förkastade rötter. En separat ruta med rubriken `Jämför med dina anteckningar` anger vad studenten ska kontrollera i sin egen lösning.

#### Fysik

Samtliga 65 nuvarande `self`-fält för kraftfigur och resonemang tas bort ur frågebankerna. Kraftfiguren och härledningen görs i räknehäftet. Det numeriska slutsvaret eller den korta fysikaliska slutsatsen får hela huvudfrågans två poäng.

Frågan ska fortfarande uttryckligen kräva den relevanta figuren eller härledningen, eftersom övningsmålet inte tas bort. Skillnaden är endast var arbetet utförs och vad datorn rättar.

#### Kemi

Samtliga 70 nuvarande `self`-fält ersätts av objektivt bedömbara slutsvar eller av pappersinstruktioner kopplade till ett redan bedömbart slutsvar.

- Bohrmodell ritas i räknehäftet. Digitalt anges en entydig skalfördelning, exempelvis `2,8,1`, eller annan kort slutsats som testar samma elektronfördelning.
- Elektronformel ritas i räknehäftet. Digitalt anges molekylgeometri och dipolstatus som separata val eller korta aliasfält.
- Bindnings- och ämnesklassificering delas upp i tydliga slutsvar, exempelvis ämnestyp, dominerande växelverkan och relevant intramolekylär bindning.
- Motiveringen skrivs i räknehäftet och jämförs med lösningen efter rättning.

Kemisk versalisering, grupperingar, jonladdningar, aggregationstillstånd och ekvivalenta reaktionskoefficienter fortsätter rättas enligt befintliga säkra regler.

### Fälttyper och gränssnitt

En ny strukturerad fälttyp får införas för ändliga val, exempelvis `choice`. Den ska använda semantiska radioknappar eller motsvarande tangentbordsstyrda standardkontroller. Ett val ska alltid lagras med ett stabilt värde och visas med en svensk etikett.

Fritext används endast när ett kort slutvärde behöver flexibel notation. Alla sådana fält behåller normalisering, tolkad-visning och manuell korrigering efter rättning för det sällsynta fall där ett korrekt svar inte känns igen.

### Lösningsläge

Lösningar förblir helt dolda före rättning. Efter rättning och ett uttryckligt `Visa lösning` visas:

1. det korrekta slutsvaret;
2. den fullständiga beräkningen, figuren eller motiveringen;
3. en ämnesspecifik ruta `Jämför med dina anteckningar`;
4. en kort kontrollista över de avgörande stegen.

Kontrollistan har inga inmatningsfält och ändrar inte poängresultatet.

## Diagramarkitektur

### Vald teknisk strategi

Diagrammen byggs med ett gemensamt, lokalt SVG-bibliotek, exempelvis `assets/js/diagram-kit.js`, som fungerar som både CommonJS-modul och klassiskt webbläsarskript. Frågefilerna använder bibliotekets geometri- och etikettprimitiver i stället för att sammanfoga stora ostrukturerade SVG-strängar.

Två alternativ är uttryckligen bortvalda:

- individuella koordinatlappningar i nuvarande SVG-strängar är snabbare men för sköra och svåra att bevisa korrekta över 150 varianter;
- 150 rasterbilder ger stabila pixlar men sämre skalning, tillgänglighet, filstorlek och underhåll.

### Lager och primitives

Varje diagram byggs i denna ordning:

1. `geometry`: axlar, stödytor, plan, kroppskonturer och grundformer;
2. `connections`: rep, leder, trissor, stöd och kontaktpunkter;
3. `information`: kraftpilar, rörelsepilar, måttlinjer, vinkelbågar och markörer;
4. `labels`: tal, symboler, enheter och förklarande text.

Biblioteket ska minst ha primitives för:

- koordinattransformation och skalning;
- punkt, linje, stråle, polygon, cirkel, båge och pil;
- kropp placerad tangent mot en linje eller kurva;
- rep som tangerar en trissa och följer en definierad bana;
- dimension mellan två förankrade punkter;
- vinkelbåge vid en uttrycklig vertex;
- grafaxlar, rutnät, skalvärden och datapunkter;
- etikett med beräknad säkerhetsmarginal och valfri opak bakgrund.

### Semantiska invariants

Varje diagramfamilj deklarerar matematiska regler som tester kan kontrollera.

#### Kontakt och stöd

- En låda på ett plan har hela avsedda nederkanten på planets linje; lådans centrum får aldrig användas som kontaktpunkt.
- En balk vilar på de angivna stödpunkterna.
- En kropp vid en vägg eller ett golv ska visuellt nå den avsedda kontaktytan utan att skära igenom den.

#### Rep, trissor och länkar

- Raka repsegment ska vara tangenter till trissans omkrets.
- Rep får inte gå genom trissans centrum, genom en kropp eller hoppa mellan felaktiga fästpunkter.
- Sammankopplade kroppar ska ha en sammanhängande, fysikaliskt begriplig repbana.

#### Vinklar och mått

- En vinkelbåge ska ha rätt vertex och spänna mellan rätt strålar.
- Vinkelvärdet ska ligga i en egen sektor utanför båge, strålar och kroppar.
- Måttlinjer ska ligga utanför objektet och vara förankrade i de punkter som faktiskt mäts.
- Ett värde eller en enhet får inte täckas av en linje, pilspets, markör eller annan etikett.

#### Grafer

- Alla datapunkters skärmkoordinater ska beräknas från deklarerad axelskala.
- Brytpunkter ska ligga exakt på polylinjen.
- Axeltitlar, skalvärden och dataetiketter ska ha separata marginalzoner.
- En figur som är exakt skalenlig ska förbli det efter responsiv skalning.

#### Kraft- och rörelseinformation

- Pilar ska börja på den kropp eller punkt de beskriver och peka i fysikaliskt avsedd riktning.
- Pilar som endast visar rörelseriktning får inte kunna misstolkas som en kraft; typografi och färg ska särskilja rollerna.
- Kraftfigurer som studenten själv ska rita får inte avslöjas i promptdiagrammet. Full kraftfigur visas först i lösningen.

### Etikett- och kollisionsregler

Alla etiketter får ett faktiskt begränsningsområde från SVG:s `getBBox()` transformerat till gemensamma koordinater. Följande är otillåtet:

- etikett mot etikett;
- etikett mot kropp;
- etikett mot icke-ankrad linje, pilspets, måttlinje eller vinkelbåge;
- etikett utanför `viewBox`;
- klippt text eller text mindre än den fastställda läsbarhetsgränsen.

En etikett får endast ligga nära sin egen ankarelement enligt familjens uttryckliga regel. En opak etikettbakgrund får inte användas för att dölja en semantiskt viktig linje; placeringen ska i första hand vara kollisionsfri.

### Diagraminventering och revision

Alla 150 promptdiagram omfattas:

- 25 matematikdiagram;
- 125 fysikdiagram.

Varje unik frågevariant renderas individuellt i följande fyra lägen:

- 1440 × 900;
- 768 × 1024;
- 390 × 844;
- A4-utskrift.

Det ger minst 600 variantvisningar. Ett revisionsverktyg skapar kontaktkartor per ämne, slot och diagramfamilj. Varje variant måste både:

1. klara automatiska struktur-, invariant-, inneslutnings- och kollisionskontroller;
2. granskas visuellt i kontaktkartan.

En representativ mall räcker inte som godkännande för familjens övriga parameterfall. Slutrapporten ska ange exakt antal granskade varianter och eventuella familjespecifika rättningar.

## Visuellt system: Akademisk tidskrift

### Färgpalett

- `--paper: #FBF8EF` — huvudsaklig provyta;
- `--ground: #E8E1D3` — omgivande bakgrund;
- `--ink: #34202A` — primär text och mörka kontroller;
- `--muted: #74676C` — sekundär information;
- `--rule: #C9BEB8` — tunna avdelare;
- `--work: #356B59` — räknehäftesinstruktioner, framsteg och positiva tillstånd;
- `--attention: #A94F3B` — markeringar och fel som kräver uppmärksamhet.

Färger används semantiskt och aldrig som enda informationsbärare. Kontrast ska uppfylla WCAG AA för relevant text och kontroller.

### Typografi

Applikationen förblir helt offline och laddar inga webbfonter.

- uppgiftstext, lösningar och större rubriker: `Georgia`, `Times New Roman`, serif;
- navigation, svarsfält, status, timer och kontroller: `Helvetica Neue`, `Arial`, sans-serif.

Seriftext får generös radavstånd och en läsrad på högst cirka 72 tecken. Sans-serif används som ett funktionellt gränssnittslager, inte som dekoration. Rubriker skrivs i normal meningsform utan versalspärrning.

### Layout och komponenter

På bred skärm visas en varm, sammanhängande provyta med en smal uppgiftsnavigation till vänster och uppgiften till höger. På mobil blir uppgiftsnavigationen horisontell ovanför uppgiften.

Den minnesvärda komponenten är räknehäftesinstruktionen: en stillsam grön, linjeavgränsad yta med pennsymbol och konkret text. Övriga komponenter hålls lugna.

- Huvudpappret får en låg, bred skugga mot den mörkare bakgrunden.
- Kort används bara när innehållet verkligen är en separat enhet, exempelvis resultat eller dialog.
- Kontroller får små radier omkring 4–6 px; stora mjuka SaaS-kort undviks.
- Primära handlingar använder mörkt bläck på papperston.
- Fokusmarkeringar är tydliga och använder grön eller rostfärgad kontrast.
- Rörelse används endast vid användarinitierade öppningar eller statusförändringar och respekterar `prefers-reduced-motion`.

Hubbens tre ämnesingångar använder samma redaktionella system med tydlig ämnesrubrik, provstruktur och en rak startlänk. Ingen stor marknadsföringshero, logotypimitation eller dekorativ animation kopieras från referenssajten.

### Rättning och lösning

Efter rättning visas digital poäng och slutsvarsstatus tydligt. Den fullständiga lösningen får en grön överkant och typografisk hierarki för samband, insättning och slutsats. `Jämför med dina anteckningar` är en separat, icke-interaktiv del av lösningen.

Manuell poängkorrigering av ett automatiskt feltolkat slutsvar behålls som en sekundär kontroll. Den ska vara hopfälld som standard och återställa tangentbordsfokus efter omrendering.

### Utskrift

Vid utskrift blir bakgrunden vit och texten svart för tydlighet och bläckekonomi. Navigering, timer, status, svar, facit och lösningar döljs. Pappersinstruktionen ska kunna skrivas ut som en kort uppmaning, men får inte ersätta användbart tomt arbetsutrymme.

Kemins exakta formelblad fortsätter skrivas ut som en separat A4-sida utan omritning eller färgfilter.

## Tillstånd och kompatibilitet

Ändrade fält-ID:n eller fälttyper kan göra ett redan sparat prov inkompatibelt. Återställningen ska därför validera frågornas aktuella fältstruktur. Ett oförenligt pågående prov ska isoleras och ge ett tydligt svenskt besked, exempelvis:

`Provets svarstyp har uppdaterats. Starta ett nytt prov för att fortsätta.`

Ett nytt prov skapas först efter uttrycklig bekräftelse. Frågehistorik och repetitionsköer ska bevaras eftersom huvudfråge-ID:n inte ändras.

Alla nya moduler måste fungera både via CommonJS i tester och som ordnade klassiska skript från `file://`. Inga externa förfrågningar, byggsteg eller serverkrav får införas.

## Felhantering

- En fråga med ett öppet `self`-fält eller annat icke-godkänt svarsfält ska stoppas av bankvalideringen innan ett prov skapas.
- Ett `choice`-fält med tomma, dubblerade eller okända val ska stoppas innan renderingen.
- Ett diagram som innehåller `NaN`, oändliga koordinater, saknad tillgänglig beskrivning eller brutna invariants ska få testerna att misslyckas och får inte levereras.
- Ett diagram får inte döljas eller ersättas tyst när layouten misslyckas; applikationen ska visa ett kontrollerat fel och bevara provets sparade data.
- Osäker automatisk tolkning av ett kort slutsvar fortsätter ge möjlighet till efterhandskorrigering, inte ett säkert felaktigt underkännande.

## Teststrategi

Utvecklingen är testdriven. Minsta obligatoriska täckning är följande.

### Svar och poäng

- noll levererade `self`-fält och noll metodbegärande textytor;
- samtliga 370 frågor har minst ett objektivt bedömbart slutsvar;
- alla kanoniska slutsvar ger exakt full huvudfrågepoäng;
- felaktiga och tvetydiga svar ger inte falsk fullpoäng;
- provsummorna förblir 10, 10 och 20;
- status, obesvarat-varning och autosparning använder bara slutsvarsfälten;
- pappersinstruktionen syns före rättning men jämförelserutan och lösningen först efter rättning;
- ingen pappersjämförelse innehåller inmatnings- eller poängkontroller;
- manuell korrigering av automatisk bedömning fortsätter fungera med tangentbord.

### Diagram

- exakt 25 matematik- och 125 fysikdiagram;
- giltig, unik `role="img"`, titel och beskrivning per SVG;
- inga ogiltiga koordinater, klippningar eller dubbla SVG-ID:n;
- familjespecifika kontakter, tangenter, fästpunkter, vinklar, skalor och riktningar;
- noll otillåtna etikettkollisioner och noll etiketter utanför `viewBox`;
- full variantmatris vid 1440 × 900, 768 × 1024, 390 × 844 och A4;
- visuellt granskade kontaktkartor för alla 600 variantvisningar;
- promptdiagram avslöjar inte en kraftfigur som studenten själv ska konstruera.

### Visuell och funktionell integration

- hubb, matematik, fysik och kemi använder samma tokens och typografiska roller;
- ingen horisontell sidöversvämning;
- tryckytor minst 44 px på mobil;
- full tangentbordsordning och synlig fokusmarkering;
- läsbarhet och kontrast enligt WCAG AA;
- formelbladets dialog, zoom, panorering och utskrift fungerar efter redesignen;
- provutskrifter har korrekt sidantal, läsbara diagram och användbart arbetsutrymme;
- noll externa eller saknade resurser, konsolfel eller varningar från applikationen.

### Bevarande

- 125/125/120 frågor och 370 stabila huvud-ID:n;
- fulla repetitionscykler och skyddad återfyllnadsgräns;
- oförändrat `Underlag`-manifest;
- kemiformelbladet är fortsatt byte-identiskt med originalets fysiska sida 6, SHA-256 `e1ca7f9914fa4920e6a5f3a80281e82ad5003c8d86cfc85c487f8cf94e4dafee`.

## Godkännandekriterier

Redesignen är färdig först när:

1. studenten endast matar in korta, automatiskt bedömbara slutsvar;
2. allt metodarbete uttryckligen hänvisas till räknehäftet;
3. fullständiga lösningar och jämförelsepunkter visas endast efter rättning och uttryckligt val;
4. den digitala poängen enbart bygger på slutsvar och fortfarande summerar till 10/10/20;
5. samtliga 150 diagram klarar sina geometriska och fysikaliska invariants;
6. inga diagrametiketter, tal eller vinklar överlappar annan information i någon av de 600 granskade variantvisningarna;
7. varje diagramvariant har granskats visuellt, inte bara representativa familjemallar;
8. hela gränssnittet följer den godkända akademiska tidskriftsstilen på desktop, mobil och utskrift;
9. offline-, tillgänglighets-, lagrings-, timer-, rättnings- och repetitionsfunktionerna är bevarade;
10. alla automatiska tester, verkliga `file://`-flöden, utskriftskontroller och slutliga visuella revisioner passerar utan öppna kritiska eller viktiga fynd.
