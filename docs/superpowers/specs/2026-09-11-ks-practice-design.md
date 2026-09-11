# Design för interaktiva KS övningsprov

## Syfte och avgränsning

Projektet ska ge studenten realistisk träning inför Matematik 1 KS2, Fysik 1 KS1 och Kemi 1 KS. Varje övningsprov ska följa samma omfattning, poängfördelning, tidsram och ämnesmässiga struktur som de aktuella KTH skrivningarna, men samtliga träningsuppgifter ska vara nyskrivna. Gamla kontrollskrivningar används som analysunderlag och får inte kopieras till frågebankerna.

Lösningen ska bestå av statiska HTML, CSS och JavaScript filer under `KS Förberedelse`. Den ska fungera direkt från filsystemet utan byggsteg, server, konto eller internetanslutning. Inga svar, resultat eller användningsdata ska lämna webbläsaren.

## Analyserat underlag

Designen bygger på följande lokala original under `KS Förberedelse/Underlag`:

- sex Matematik 1 KS2 från 2023 till 2026;
- sex unika Fysik 1 KS1 från 2023 till 2026;
- fem Kemi 1 KS från 2024 till 2026, inklusive lösningar och formelblad.

De senaste skrivningarna styr provens fasta omfattning. Äldre skrivningar används för att identifiera återkommande uppgiftstyper och skapa variation utan att lämna kursens mål.

## Vald lösning

Frågebankerna använder en hybridmodell. Varje ämne får flera handskrivna uppgiftsfamiljer med kontrollerade parameteruppsättningar. Beräkningsuppgifter kan därmed varieras systematiskt, medan resonemang, figurer, elektronformler och tillämpningar författas som särskilda uppgifter. Varje färdig variant får ett stabilt ID och ett verifierat facit.

Denna modell ger stor variation utan att förlita sig på helt fri slumpgenerering. Den gör också varje lösning reproducerbar och testbar.

## Filstruktur

Den planerade strukturen är:

```text
KS Förberedelse/
├── index.html
├── assets/
│   ├── app.css
│   └── js/
│       ├── app.js
│       ├── exam-engine.js
│       ├── grading.js
│       ├── expression-parser.js
│       ├── units.js
│       ├── chemistry-parser.js
│       ├── storage.js
│       └── timer.js
├── Matematik KS2/
│   ├── index.html
│   └── questions.js
├── Fysik KS1/
│   ├── index.html
│   └── questions.js
├── Kemi KS/
│   ├── index.html
│   ├── questions.js
│   └── assets/
│       └── formelblad-ks.png
└── tests/
    ├── generators.test.js
    ├── grading.test.js
    ├── units.test.js
    ├── chemistry.test.js
    └── exam-engine.test.js
```

Vanliga klassiska skript används i en bestämd ordning i stället för ES moduler. Därmed fungerar sidorna även när `index.html` öppnas via `file://` i en vanlig webbläsare.

## Provstruktur

### Matematik 1 KS2

Varje prov har fem uppgifter om två poäng, totalt tio poäng. Godkänt resultat kräver sex poäng. Den valfria timern är förinställd på 105 minuter.

Varje prov innehåller fyra algebrauppgifter och en tillämpad geometriuppgift. Algebraurvalet täcker rot- och absolutbeloppsekvationer, polynomekvationer, faktorisering, rationella ekvationer och förenkling av rationella uttryck. Geometrin täcker trigonometri, likformighet, area och geometrisk modellering. Urvalet säkerställer att ett prov inte får flera nästan identiska algebrauppgifter.

Det finns minst 25 färdiga varianter för var och en av de fem provpositionerna, sammanlagt minst 125 unika huvuduppgifter.

### Fysik 1 KS1

Varje prov har fem uppgifter om två poäng, totalt tio poäng. Godkänt resultat kräver sex poäng. Den valfria timern är förinställd på 105 minuter.

Varje prov täcker fem kompletterande färdigheter:

1. mätning, densitet och geometriska kroppar eller rörelsediagram;
2. densitet, enhetsomvandling eller grundläggande rörelse;
3. likformigt accelererad rörelse och vertikalt kast;
4. kraftjämvikt, kraftkomposanter och vektorer;
5. Newtons andra lag med friktion eller sammankopplade kroppar.

När två närliggande områden kan förekomma i samma position används regler som hindrar dubblerad färdighet inom samma prov. Kraftfigurer och längre fysikaliska resonemang redovisas på papper och självbedöms mot en lösning och bedömningsmall.

Det finns minst 25 färdiga varianter per provposition, sammanlagt minst 125 unika huvuduppgifter.

### Kemi 1 KS

Varje prov har sex huvuduppgifter med delmoment och totalt 20 poäng. Godkänt resultat kräver tio poäng. Den valfria timern är förinställd på 120 minuter.

De sex huvudpositionerna täcker:

1. atomstruktur, isotoper, valenselektroner samt enkel substansmängd eller koncentration;
2. reaktionsformler, balansering, salter, kristallvatten, fällning och stökiometri;
3. elektronformler, molekylgeometri, dipoler och intermolekylära krafter;
4. bindningstyper och vilka bindningar som bryts vid fasövergång eller reaktion;
5. stökiometri tillsammans med gaslagen;
6. empirisk formel, molmassa, koncentration eller massprocent.

Poängen mellan delmomenten får variera, men varje genererat prov måste summera till exakt 20 poäng och behålla samma ämnesmässiga balans. Det finns minst 20 färdiga varianter per huvudposition, sammanlagt minst 120 unika huvuduppgifter och fler än 120 deluppgifter.

## Frågemodell

Varje fråga innehåller följande data:

- stabilt fråge-ID och ämnesposition;
- rubrik, uppgiftstext och poäng;
- prövade kursmål och uppgiftstyp;
- noll eller flera svarsfält med tydlig svarstyp;
- efterfrågad enhet, tolerans och avrundningsregel när det behövs;
- automatisk bedömare eller självbedömningsmall;
- fullständig stegvis lösning;
- vanliga fel och poänganvisningar;
- eventuell SVG-figur med tillgänglig textbeskrivning.

Parameterbaserade varianter lagras som färdiga, deterministiska fall. Samma fråge-ID ger alltid samma text, data, figur, svar och lösning.

## Provurval och repetitionsskydd

Varje provposition har en egen blandad kö av ännu oanvända fråge-ID:n. När ett nytt prov skapas hämtas nästa ID ur varje positions kö. En fråga kan inte återkomma förrän hela kön för den positionen är förbrukad. När kön fylls på igen får den första frågan inte vara samma som den senast visade.

Köerna och tidigare använda ID:n sparas i `localStorage` separat för varje ämne. Studenten kan återställa frågehistoriken med en uttrycklig kontroll i inställningarna. Återställning av historik påverkar inte ett pågående prov.

## Svar och rättning

### Rättningsflöde

Studenten kan besvara uppgifter i valfri ordning. Svaren sparas kontinuerligt. När `Rätta provet` väljs visas hur många uppgifter som är obesvarade. Studenten kan gå tillbaka eller välja att rätta ändå. Efter bekräftad rättning låses provets svar.

Automatiskt bedömbara fält rättas direkt. Ritningar, längre resonemang och andra osäkra svar markeras `Bedöm själv`. Studenten öppnar då bedömningsanvisningen och den individuella lösningen och väljer uppnådda poäng enligt en konkret checklista. Totalresultatet visas som preliminärt tills alla självbedömningar är klara.

En lösning är aldrig synlig före rättning. Efter rättning öppnas den endast när studenten väljer `Visa lösning` på den aktuella uppgiften.

### Numeriska svar och enheter

Varje tillämpad fråga säger uttryckligen vilken enhet och avrundning som önskas, exempelvis `Svara i m/s med tre värdesiffror`. Det normala numeriska svarsfältet visar den efterfrågade enheten som en fast suffixdel av svaret. Studenten behöver då endast skriva talet och kan inte råka utelämna den enhet som gränssnittet redan anger.

När en fråga tillåter flera enheter används ett separat enhetsfält. Bedömaren hanterar decimalcomma och decimalpunkt, extra blanksteg, minustecken, procent, bråk och vetenskaplig notation som `1,2·10^3`, `1.2e3` och `1,2*10^3`. Enhetsomvandling sker endast mellan storheter med samma dimension.

Ett svar i en ekvivalent men inte efterfrågad enhet kan identifieras och visas som `Rätt värde i annan enhet`. Uppgiftens bedömningsregel avgör om detta ger full eller reducerad poäng. Systemet visar alltid den efterfrågade enheten i facit.

Numeriska toleranser anges per fråga. De ska spegla rimlig avrundning och värdesiffror, inte en global godtycklig procentgräns.

### Matematiska svar

Mängder av lösningar jämförs oberoende av ordning. Inmatning som `x=1; x=6`, `1 eller 6` och motsvarande tydliga skrivsätt tolkas som samma lösningsmängd. Frågetypen avgör om komma betyder decimaltecken eller avskiljare, och upprepade variabelnamn samt semikolon används för att lösa tvetydighet.

Algebraiska uttryck behandlas av en begränsad, säker uttrycksparser utan `eval`. Normaliserade användaruttryck och facit jämförs symboliskt där reglerna räcker och annars numeriskt i flera deterministiskt valda punkter inom den gemensamma definitionsmängden. Förbjudna värden och angivna definitionsvillkor bevaras. Faktorer, termordning och ekvivalenta bråkformer får skilja sig.

Om bedömaren inte säkert kan avgöra ekvivalens markeras svaret `Bedöm själv` i stället för fel.

### Kemiska svar

Kemiska formler normaliserar blanksteg, Unicode-index och vanliga siffror, men bevarar versaler och gemener eftersom de har kemisk betydelse. Jonladdningar och aggregationstillstånd normaliseras till en intern representation.

Balanserade reaktionsformler jämförs som reaktant- och produktmängder. Ordningen inom respektive sida saknar betydelse och alla koefficienter får vara multiplicerade med samma faktor. Om aggregationstillstånd uttryckligen efterfrågas ingår de i bedömningen. Elektronformler, strukturformler och förklarande resonemang självbedöms.

Efter rättning visar gränssnittet hur svaret tolkades. Studenten kan ersätta en automatisk bedömning med en manuell bedömning; ändringen markeras i resultatsammanställningen.

## Kemins exakta formelblad

Kemisidan ska använda den verkliga formelbladssidan från `KS_VT26_260305_med_lösn.pdf` i underlaget. Sidan extraheras i hög upplösning utan omritning, beskärning av innehåll eller typografiska ändringar. Den innehåller periodiska systemet, allmänna gaslagen, gaskonstanten, Avogadros konstant och den elektrokemiska spänningsserien i originalets utformning.

Formelbladet finns tillgängligt under hela kemiprovet via en diskret kontroll i sidhuvudet. Det öppnas i en fokuserad visning med zoom, panorering och utskrift. En dold textbeskrivning återger innehållet för hjälpmedelsteknik, men den visuella källan för studenten är originalbladet.

## Navigation och tillstånd

Studenten kan när som helst:

- öppna valfri uppgift från uppgiftsnavigeringen;
- gå till föregående eller nästa uppgift utan att ha svarat;
- markera en uppgift för senare återbesök;
- se om en uppgift är obesvarad, påbörjad, besvarad eller markerad;
- återgå till provöversikten.

Svar, markeringar, aktuell uppgift, fråge-ID:n, timerläge och förbrukad tid sparas automatiskt i `localStorage`. Ett avbrutet prov kan återupptas. Ett nytt prov får inte skriva över ett pågående prov utan ett tydligt val från studenten.

## Timer

Timern är avstängd när ett prov skapas. Studenten kan starta, pausa och återställa den utan att påverka svaren. Den utgår från en absolut tidsstämpel när den går, så omladdning eller en inaktiv flik får inte göra tiden felaktig. Vid noll visas tydligt att tiden har gått ut, men övningsprovet lämnas inte in automatiskt.

## Visuell design

Gränssnittet ska vara minimalistiskt och rent med Apples produktsidor och systemgränssnitt som kvalitetsreferens, utan att kopiera varumärkeselement.

Designen använder systemtypsnitt, vit huvudyta, ljusgrå bakgrund, svart text och tunna neutrala avdelare. Blå accent används endast för primära handlingar, aktiv uppgift och framsteg. Grönt och rött används sparsamt och endast för bedömningsstatus.

Det ska inte finnas dekorativa logotyper, färgade toppfält, anteckningslinjer, gradienter, onödiga kort, stora skuggor, etiketter med versalspärrning eller annan visuell utsmyckning. En enda sammanhängande arbetsyta dominerar sidan. Radlängd, tomrum och tydlig typografisk hierarki skapar lugn och fokus.

På bred skärm ligger en smal uppgiftsnavigation till vänster och uppgiften till höger. På mobil flyttas uppgiftsnumren till en horisontell rad ovanför uppgiften. Alla tryckytor är tillräckligt stora och hela flödet fungerar med tangentbord.

SVG-figurer använder tunna svarta linjer, neutrala etiketter och endast nödvändig information. Figurer får inte innehålla mått som kan avläsas för att kringgå beräkningen.

## Utskrift

Utskriftsläget visar provrubrik, uppgifter, figurer, poäng och tillräckligt svarsutrymme. Navigation, timerkontroller, statusmarkeringar, lösningar och facit döljs. Kemins formelblad kan skrivas ut separat i originalets sidformat.

## Felhantering

Om `localStorage` inte är tillgängligt fungerar det aktuella provet fortfarande i minnet och sidan visar att återupptagning och repetitionshistorik inte kan sparas. Skadad sparad data isoleras per ämne och ersätts först efter att studenten informerats.

En ogiltig frågevariant får aldrig visas. Provskaparen validerar poängsumma, svar, lösning, enhet och nödvändiga data innan provet startar. Om en position inte kan fyllas visas ett tydligt fel och inget ofullständigt prov skapas.

Rättningsfel ska hellre leda till `Bedöm själv` än till ett säkert påstående om att ett korrekt svar är fel.

## Teststrategi

Utvecklingen ska vara testdriven. Tester skrivs med en lokal, beroendefri JavaScript testmiljö och omfattar:

- provens antal huvuduppgifter, fasta poängsummor och godkäntgränser;
- minst 125 matematik-, 125 fysik- och 120 kemivariant-ID:n;
- unikhetsköer, tömning, återfyllning och skydd mot omedelbar upprepning;
- återupptagning av prov, autosparande och ämnesseparerad historik;
- timer vid start, paus, återställning, omladdning och utgången tid;
- decimalcomma, decimalpunkt, vetenskaplig notation, toleranser och värdesiffror;
- dimensionssäker enhetsomvandling och efterfrågad målenhet;
- oordnade lösningsmängder, definitionsmängder och algebraisk ekvivalens;
- kemiska index, laddningar, aggregationstillstånd och balanserade reaktionsformler;
- manuell bedömning och omprövning av automatiskt resultat;
- att lösningar förblir otillgängliga före rättning;
- tangentbordsnavigation och responsiv layout.

Varje parameterbaserad uppgiftsfamilj körs genom alla avsedda parameterfall. Därutöver genereras stora provmängder för att kontrollera att inga ekvationer saknar avsedda lösningar, fysikdata blir orimliga, kemiuppgifter motsäger sina reaktionsformler eller poängsummor avviker.

Slutlig verifiering sker visuellt vid bred datorvy, surfplatta och smal mobilvy. Varje ämne provkörs från nytt prov till rättning, individuell lösningsvisning, självbedömning, utskrift och återupptagning efter omladdning. Kemins formelblad jämförs sida vid sida med originalbladet.

## Godkännandekriterier

Lösningen är färdig när:

1. alla tre ämnessidor kan öppnas lokalt utan server eller internet;
2. varje prov följer rätt antal uppgifter, poäng, godkäntgräns och timer;
3. varje ämne innehåller fler än 100 unika huvuduppgifter med fullständiga lösningar;
4. en användare kan navigera fritt och återuppta ett prov utan dataförlust;
5. använda frågor inte återkommer förrän respektive positionsbank är förbrukad;
6. automatisk rättning accepterar dokumenterade ekvivalenta svar och faller tillbaka på självbedömning vid osäkerhet;
7. lösningar visas endast efter rättning och efter ett separat val per uppgift;
8. kemins formelblad visuellt motsvarar originalbladet exakt;
9. automatiska tester passerar och inga fel visas i webbläsarkonsolen;
10. dator-, mobil- och utskriftsvyer är rena, läsbara och fria från överlappningar.
