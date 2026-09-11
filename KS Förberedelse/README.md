# Lokal KS-träning

Det här är en fristående övningsapp för Matematik KS2, Fysik KS1 och Kemi KS. Den behöver ingen installation, internetanslutning eller inloggning.

## Öppna appen

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

## Rätta och självbedöma

Välj `Rätta provet`. Appen varnar om uppgifter är obesvarade och låser svaren först efter din bekräftelse.

Säkert tolkade svar rättas automatiskt. För ritningar, längre resonemang och svar som appen inte kan tolka säkert visas `Bedöm själv`. Öppna `Visa lösning`, jämför med bedömningsanvisningen och välj uppnådda poäng. Resultatet är preliminärt tills alla sådana bedömningar är klara. En automatisk bedömning kan också ersättas manuellt; det markeras i resultatet.

## Formelblad i kemi

I kemiprovet öppnar `Formelblad` det lokala originalbladet. Använd `−`, `Anpassa` och `+` för 50–300 procents zoom. Vid inzoomning kan bladet flyttas i visningsytan; piltangenterna fungerar när visningsytan har fokus. Formelbladet kan öppnas både före och efter rättning.

## Skriva ut

- `Skriv ut prov` öppnar webbläsarens utskriftsdialog med samtliga uppgifter, figurer och tomt svarsutrymme utan svar eller lösningar.
- I kemins formelbladsfönster skriver `Skriv ut` ut formelbladet separat på en A4-sida.

## Rensa frågehistorik

`Rensa historik` tömmer köerna som används för att undvika upprepade frågor. Det pågående provet och dess svar ändras inte. Nästa nya prov börjar bygga upp en ny frågehistorik.

All information lagras lokalt i webbläsarens `localStorage`. Ingenting skickas till en server. Lagringen är separat för varje webbläsare och webbläsarprofil; om webbplatsdata rensas försvinner de sparade proven och frågehistoriken.
