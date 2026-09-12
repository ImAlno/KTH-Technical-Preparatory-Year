# Lokal KS-träning

Det här är en fristående övningsapp för Matematik KS2, Fysik KS1 och Kemi KS. Den behöver ingen installation, internetanslutning eller inloggning.

## Starta KS-träningen online

Klicka på länken nedan för att öppna KS-träningen direkt i webbläsaren:

### [Öppna KS-träningen](https://imalno.github.io/KTH-Technical-Preparatory-Year/KS%20F%C3%B6rberedelse/)

Välj sedan matematik, fysik eller kemi på startsidan. Du behöver inte ladda ner eller installera något.

## Öppna appen lokalt

1. Öppna `index.html` i mappen `KS Förberedelse` direkt i en webbläsare.
2. Välj ämne på startsidan. Ett nytt prov skapas automatiskt första gången.

Låt mapparna och filerna ligga kvar tillsammans. Appen laddar bara lokala filer.

## Arbeta med ett prov

- Byt uppgift med knapparna `1`–`5` eller `1`–`6`, eller med `Föregående` och `Nästa`.
- Skriv svar i valfri ordning. Decimalpunkt och decimalkomma fungerar för tal. Om en enhet visas efter ett talfält är det enheten som svaret ska anges i; appen godtar även dokumenterade likvärdiga enheter.
- `Markera` flaggar en uppgift för senare kontroll. Navigeringen visar om en uppgift är obesvarad (`○`), påbörjad (`◐`) eller besvarad (`●`).
- Alla svar, markeringar och den aktuella uppgiften sparas löpande.

När sidan öppnas igen och ett sparat prov finns väljer du `Fortsätt provet` för att återuppta det. Välj `Starta nytt` och bekräfta `Ersätt med nytt prov` för att nollställa provet och skapa en ny frågekombination. Det sparade provet ersätts då permanent.

## Timer

Timern är valfri och avstängd från början.

- `Starta` börjar räkna ned.
- `Pausa` stoppar nedräkningen tillfälligt.
- `Återställ` återställer bara tiden; svaren påverkas inte.

Tiden fortsätter att beräknas korrekt efter en omladdning. När tiden tar slut lämnas provet inte in automatiskt.

## Rätta provet

Välj `Rätta provet`. Appen varnar om uppgifter är obesvarade och låser svaren först efter din bekräftelse.

Skriv bara in uppgiftens slutsvar i datorn. Uträkningar, bevis, motiveringar och ritningar — till exempel kraftfigurer — gör du i ditt räknehäfte enligt instruktionen i uppgiften. Den digitala poängen bygger enbart på de slutsvar som appen rättar.

Den fullständiga lösningsmetoden och jämförelsepunkterna för arbetet i räknehäftet visas först efter att provet har rättats och du uttryckligen väljer `Visa lösning`. Jämför då din egen metod och figur med lösningen.

Använd bara den manuella poängkorrigeringen när ditt slutsvar faktiskt är korrekt men appens tolkning inte kände igen ett likvärdigt skrivsätt. Den är inte avsedd för att självbedöma uträkningar, resonemang eller ritningar.

## Formelblad i kemi

I kemiprovet öppnar `Formelblad` det lokala originalbladet. Använd `Zooma ut`, `Anpassa` och `Zooma in` för 50–300 procents zoom. Vid inzoomning kan bladet flyttas i visningsytan; piltangenterna fungerar när visningsytan har fokus. Formelbladet kan öppnas både före och efter rättning.

## Skriva ut

- `Skriv ut prov` öppnar webbläsarens utskriftsdialog med samtliga uppgifter, figurer och tomt svarsutrymme utan svar eller lösningar.
- I kemins formelbladsfönster skriver `Skriv ut` ut formelbladet separat på en A4-sida.

## Rensa frågehistorik

`Rensa historik` tömmer köerna som används för att undvika upprepade frågor. Det pågående provet och dess svar ändras inte. Nästa nya prov börjar bygga upp en ny frågehistorik.

All information lagras lokalt i webbläsarens `localStorage`. Ingenting skickas till en server. Lagringen är separat för varje webbläsare och webbläsarprofil; om webbplatsdata rensas försvinner de sparade proven och frågehistoriken.
