// js/aktivitaet-katalog.js
// ===========================================================================
// Sportarten und Alltagsaktivitaeten mit MET-Stufen — EINE Tabelle fuer das
// Blatt "Sport/Aktivitaet eintragen" (js/aktivitaet.js) und die MET-Liste
// des Kalorienrechners (js/nutrition-tool.js, AKTIVITAETEN) samt Webseite.
// Reine Daten, in Node ladbar.
//
// Quelle: 2024 Adult Compendium of Physical Activities (Herrmann et al.,
// pacompendium.com), am 14.11.2026 aus dem PDF gelesen; der Code steht je
// Stufe dabei. Watt-Stufen tragen zusaetzlich `watt` und `formel`: dort
// rechnet nutrition-calc.js (kcalAusLeistung) aus der Leistung, weil bei
// vorgegebener Leistung das Koerpergewicht kaum zaehlt (Pruefrunde 3,
// Befund 5); der MET-Wert bleibt nur zur Anzeige der Groessenordnung.
//
// schritte: Gehen — der Hinweis, dass Alltagsschritte im Tagesbedarf schon
// zaehlen (Pruefrunde 3: auch Wandern, Nordic Walking, Treppen, Einkaufen).
// ---------------------------------------------------------------------------
(function () {
  "use strict";
  /* s(label, met, code) — eine Stufe; w(...) eine Stufe mit Leistung. */
  const s = (label, met, code) => ({ label, met, code });
  const w = (label, met, code, watt, formel) => ({ label, met, code, watt, formel });

  /* ausdauer: Log bekommt den Tag "endurance" (Auszeichnungen in badges.js).
     schritte: Gehen — der Hinweis auf die Alltagsschritte im Tagesbedarf. */
  const KATALOG = [
    // ---- Sport ----
    { id: "kraft", art: "sport", name: "Krafttraining", suche: "gym hanteln bodybuilding fitnessstudio gewichte maschinen", oeffnet: "kraft" },
    { id: "laufen", art: "sport", name: "Laufen", suche: "joggen running", ausdauer: true, min: 30, std: 2, stufen: [
      s("locker joggen", 7.5, "12020"), s("8 km/h", 8.5, "12030"), s("10 km/h", 9.3, "12050"), s("11 km/h", 10.5, "12060"),
      s("12 km/h", 11.8, "12080"), s("13 km/h", 12.0, "12090"), s("14 km/h", 12.5, "12100"), s("16 km/h", 14.8, "12120")] },
    { id: "rad", art: "sport", name: "Radfahren (sportlich)", suche: "rennrad fahrrad bike cycling", ausdauer: true, min: 60, std: 1, stufen: [
      s("16–19 km/h", 6.8, "01020"), s("19–22 km/h", 8.0, "01030"), s("22–25 km/h", 10.0, "01040"), s("über 25 km/h", 12.0, "01050")] },
    { id: "mtb", art: "sport", name: "Mountainbike", suche: "mtb gelaende fahrrad", ausdauer: true, min: 60, std: 0, stufen: [
      s("allgemein", 8.5, "01009"), s("bergauf, hart", 14.0, "01003")] },
    { id: "ergo", art: "sport", name: "Ergometer (Rad)", suche: "heimtrainer bike assault echo watt", ausdauer: true, min: 30, std: 1, stufen: [
      w("50 W", 4.0, "01214", 50, "rad"), w("100 W", 6.0, "01220", 100, "rad"), w("150 W", 8.0, "01228", 150, "rad"),
      w("200 W", 10.8, "01236", 200, "rad"), w("250 W", 12.5, "01240", 250, "rad")] },
    { id: "spinning", art: "sport", name: "Spinning / Indoor-Cycling", suche: "kurs rpm", ausdauer: true, min: 45, std: 0, stufen: [s("Kurs", 9.0, "01270")] },
    { id: "rudern", art: "sport", name: "Rudern (Ergometer)", suche: "rower concept2 row", ausdauer: true, min: 30, std: 1, stufen: [
      w("unter 100 W", 5.0, "02071", 80, "rudern"), w("100–149 W", 7.5, "02072", 125, "rudern"),
      w("150–199 W", 11.0, "02073", 175, "rudern"), w("ab 200 W", 14.0, "02074", 225, "rudern")] },
    { id: "schwimmen", art: "sport", name: "Schwimmen", suche: "kraul brust bahnen swim", ausdauer: true, min: 45, std: 1, stufen: [
      s("Brust gemütlich", 5.3, "18265"), s("Kraul langsam", 5.8, "18292"), s("Kraul mittel", 8.0, "18290"),
      s("Kraul schnell", 10.5, "18280"), s("Brust Training", 10.3, "18260"), s("Rücken gemütlich", 4.8, "18255")] },
    { id: "crosstrainer", art: "sport", name: "Crosstrainer", suche: "elliptical", ausdauer: true, min: 30, std: 0, stufen: [
      s("mittel", 5.0, "02048"), s("intensiv", 9.0, "02049")] },
    { id: "stepper", art: "sport", name: "Stepper / Treppenmaschine", suche: "stairmaster", ausdauer: true, min: 20, std: 0, stufen: [s("allgemein", 9.3, "02065")] },
    { id: "seil", art: "sport", name: "Seilspringen", suche: "springseil rope", min: 15, std: 0, stufen: [s("allgemein", 11.0, "02068")] },
    { id: "zirkel", art: "sport", name: "Zirkeltraining", suche: "circuit bootcamp kettlebell functional", min: 30, std: 1, stufen: [
      s("locker", 3.5, "02034"), s("mittel", 5.0, "02035"), s("hart, kaum Pause", 7.5, "02040")] },
    { id: "hiit", art: "sport", name: "HIIT", suche: "intervall tabata burpees", min: 20, std: 1, stufen: [
      s("mittel", 7.0, "02210"), s("hart", 11.0, "02214")] },
    /* CrossFit und Hyrox (Benjamin 15.11.2026): kein eigener Code im
       Compendium 2024 — naechste Eintraege: Zirkel mit Kettlebells, kaum
       Pause (02040) und hartes HIIT (02214). Fuer die ganze Kursstunde mit
       Aufwaermen und Technik; wer das WOD selbst eintraegt, bekommt ueber
       den Workout-Text die genauere Zahl. */
    { id: "crossfit", art: "sport", name: "CrossFit", suche: "wod box functional fitness metcon", ausdauer: true, min: 60, std: 1,
      hinweis: "Für die ganze Stunde mit Aufwärmen und Technik. Genauer wird es, wenn du das WOD unter Training einträgst.", stufen: [
      s("locker, viel Technik", 5.0, "02035"), s("normale Stunde", 7.5, "02040"), s("hartes WOD", 11.0, "02214")] },
    { id: "hyrox", art: "sport", name: "Hyrox", suche: "fitness rennen wettkampf stationen sled wall balls", ausdauer: true, min: 60, std: 0,
      hinweis: "Laufen im Wechsel mit Stationen. Beim Rennen die Endzeit eintragen.", stufen: [
      s("Training / Kurs", 7.5, "02040"), s("Rennen / Simulation", 11.0, "02214")] },
    { id: "aerobic", art: "sport", name: "Aerobic / Step", suche: "kurs", min: 45, std: 0, stufen: [s("allgemein", 7.3, "02000")] },
    { id: "zumba", art: "sport", name: "Zumba", suche: "kurs tanzen", min: 45, std: 0, stufen: [s("Kurs", 6.5, "02310")] },
    { id: "yoga", art: "sport", name: "Yoga", suche: "hatha vinyasa power", min: 60, std: 0, stufen: [
      s("Hatha", 2.3, "02150"), s("Vinyasa", 2.7, "02185"), s("Hot Yoga", 3.0, "02155"), s("Power Yoga", 4.0, "02160")] },
    { id: "pilates", art: "sport", name: "Pilates", suche: "", min: 45, std: 0, stufen: [s("allgemein", 2.8, "02105")] },
    { id: "dehnen", art: "sport", name: "Dehnen / Mobility", suche: "stretching beweglichkeit", min: 20, std: 0, stufen: [s("ruhig", 2.3, "02101")] },
    { id: "wassergym", art: "sport", name: "Wassergymnastik", suche: "aqua", min: 45, std: 0, stufen: [s("allgemein", 5.3, "02120")] },
    { id: "fussball", art: "sport", name: "Fußball", suche: "soccer kicken", min: 90, std: 0, stufen: [
      s("locker", 7.0, "15610"), s("Spiel", 9.5, "15605")] },
    { id: "basketball", art: "sport", name: "Basketball", suche: "", min: 60, std: 0, stufen: [
      s("Körbe werfen", 6.0, "15050"), s("allgemein", 7.5, "15055"), s("Spiel", 8.0, "15040")] },
    { id: "volleyball", art: "sport", name: "Volleyball", suche: "beach", min: 60, std: 0, stufen: [
      s("Freizeit", 4.0, "15710"), s("Halle, Spiel", 6.0, "15711"), s("Beach", 8.0, "15725")] },
    { id: "hockey", art: "sport", name: "Feldhockey", suche: "", min: 60, std: 0, stufen: [s("allgemein", 7.8, "15350")] },
    { id: "tennis", art: "sport", name: "Tennis", suche: "", min: 60, std: 1, stufen: [
      s("Doppel", 4.5, "15685"), s("Einzel", 6.8, "15675"), s("Einzel, Wettkampf", 8.0, "15676")] },
    { id: "badminton", art: "sport", name: "Badminton", suche: "federball", min: 60, std: 0, stufen: [s("allgemein", 5.5, "15030")] },
    { id: "tischtennis", art: "sport", name: "Tischtennis", suche: "ping pong", min: 60, std: 0, stufen: [s("allgemein", 4.0, "15660")] },
    { id: "squash", art: "sport", name: "Squash", suche: "", min: 45, std: 0, stufen: [s("allgemein", 7.3, "15652")] },
    { id: "klettern", art: "sport", name: "Klettern / Bouldern", suche: "boulder halle", min: 90, std: 0, stufen: [
      s("Bouldern", 8.8, "15534"), s("Klettern leicht", 5.8, "15537"), s("Klettern schwer", 7.3, "15535")] },
    { id: "kampfsport", art: "sport", name: "Kampfsport", suche: "judo karate kickboxen muay thai bjj jiu jitsu taekwondo", min: 60, std: 1, stufen: [
      s("locker, Technik", 5.3, "15425"), s("Training", 10.3, "15430")] },
    { id: "boxsack", art: "sport", name: "Boxen am Sack", suche: "boxsack boxing", min: 30, std: 0, stufen: [
      s("allgemein", 5.8, "15110"), s("schnell", 8.5, "15115")] },
    { id: "ski", art: "sport", name: "Ski alpin / Snowboard", suche: "skifahren piste", min: 120, std: 1, hinweis: "Nur die Zeit auf der Piste zählen, nicht Lift und Hütte.", stufen: [
      s("gemütlich", 4.3, "19150"), s("mittel", 6.3, "19160"), s("sportlich", 8.0, "19170")] },
    { id: "langlauf", art: "sport", name: "Langlauf", suche: "skilanglauf loipe skating", ausdauer: true, min: 60, std: 1, stufen: [
      s("gemütlich", 6.8, "19080"), s("mittel", 8.5, "19090"), s("zügig", 11.3, "19100"), s("Skating", 13.3, "19135")] },
    { id: "inliner", art: "sport", name: "Inlineskaten", suche: "rollerblades skaten", min: 60, std: 0, stufen: [
      s("Freizeit", 7.5, "15591"), s("zügig", 9.8, "15592")] },
    { id: "eislaufen", art: "sport", name: "Eislaufen", suche: "schlittschuh", min: 60, std: 0, stufen: [s("allgemein", 7.0, "19030")] },
    { id: "sup", art: "sport", name: "Stand-up-Paddling", suche: "sup paddeln", min: 60, std: 1, stufen: [
      s("gemütlich", 3.8, "18226"), s("normal", 5.0, "18227"), s("sportlich", 9.8, "18228")] },
    { id: "kajak", art: "sport", name: "Kajak / Kanu", suche: "paddeln", min: 60, std: 0, stufen: [s("mittel", 5.0, "18100")] },
    { id: "golf", art: "sport", name: "Golf (zu Fuß)", suche: "", min: 180, std: 0, stufen: [s("Schläger tragen", 4.3, "15265")] },
    { id: "reiten", art: "sport", name: "Reiten", suche: "pferd", min: 60, std: 0, stufen: [s("allgemein", 5.5, "15370")] },

    // ---- Alltag ----
    { id: "spazieren", art: "alltag", name: "Spazierengehen", suche: "gehen laufen bummeln walk", schritte: true, min: 30, std: 1, stufen: [
      s("bummeln", 2.3, "17151"), s("gemütlich, ~3,5 km/h", 2.8, "17152"), s("normal, ~5 km/h", 3.8, "17190"),
      s("zügig, ~6 km/h", 4.8, "17200"), s("sehr zügig, ~6,5 km/h", 5.5, "17220")] },
    { id: "hund", art: "alltag", name: "Mit dem Hund gehen", suche: "gassi", schritte: true, min: 30, std: 0, stufen: [s("normal", 3.0, "17165")] },
    { id: "wandern", art: "alltag", name: "Wandern", suche: "berg hiking", schritte: true, min: 120, std: 1, stufen: [
      s("gemütlich", 3.8, "17081"), s("normal", 5.3, "17082"), s("querfeldein", 6.0, "17080"),
      s("mit Tagesrucksack", 7.8, "17012"), s("steil bergauf", 8.8, "17036")] },
    { id: "nordic", art: "alltag", name: "Nordic Walking", suche: "stoecke", schritte: true, min: 45, std: 0, stufen: [
      s("normal", 4.3, "17302"), s("zügig", 5.3, "17304"), s("bergauf", 8.8, "17310")] },
    { id: "radgemuetlich", art: "alltag", name: "Radfahren (gemütlich)", suche: "fahrrad pendeln radeln", min: 30, std: 1, stufen: [
      s("sehr gemütlich, ~9 km/h", 3.5, "01018"), s("gemütlich, unter 16 km/h", 4.0, "01010"), s("zur Arbeit, eigenes Tempo", 6.8, "01011")] },
    { id: "ebike", art: "alltag", name: "E-Bike", suche: "pedelec fahrrad", min: 30, std: 0, stufen: [
      s("viel Unterstützung", 4.0, "01088"), s("wenig Unterstützung", 6.0, "01084")] },
    { id: "treppen", art: "alltag", name: "Treppensteigen", suche: "stufen", schritte: true, min: 10, std: 1, stufen: [
      s("langsam", 4.5, "17133"), s("normal", 6.8, "17131"), s("zügig", 9.3, "17134")] },
    { id: "garten", art: "alltag", name: "Gartenarbeit", suche: "garten", min: 60, std: 1, stufen: [
      s("leicht", 2.0, "08066"), s("mittel", 3.8, "08245"), s("Rasen mähen", 5.5, "08095")] },
    { id: "haushalt", art: "alltag", name: "Hausarbeit", suche: "putzen aufraeumen staubsaugen haushalt", min: 60, std: 1, stufen: [
      s("leicht, aufräumen", 2.5, "05040"), s("putzen", 3.3, "05030"), s("Großputz, Auto waschen", 3.5, "05020")] },
    { id: "einkaufen", art: "alltag", name: "Einkaufen zu Fuß", suche: "einkauf tragen", schritte: true, min: 30, std: 0, stufen: [s("mit Tasche", 3.3, "05060")] },
    { id: "kinder", art: "alltag", name: "Mit Kindern spielen", suche: "spielplatz toben", min: 30, std: 1, stufen: [
      s("ruhig, im Stehen", 2.8, "05171"), s("laufen, aktiv", 3.5, "05175"), s("toben", 5.8, "05180")] },
    { id: "tanzen", art: "alltag", name: "Tanzen", suche: "party disco club", min: 60, std: 1, stufen: [
      s("langsam", 3.0, "03040"), s("Gesellschaftstanz", 6.0, "03042"), s("ausgelassen", 9.8, "03031")] },
  ];

  /* Fuer alles, was die Liste nicht kennt: frei benannt, drei Stufen nach dem
     Compendium-Raster leicht/mittel/hart (Zirkeltraining als Anhalt). */
  const EIGEN_STUFEN = [s("leicht", 3.5, "02034"), s("mittel", 5.0, "02035"), s("anstrengend", 7.5, "02040")];

  const finde = (id) => KATALOG.find((x) => x.id === id) || null;
  /* Eine Stufe ueber [id, index] — so verweist der Kalorienrechner auf
     dieselben Werte, statt eigene zu fuehren. */
  function stufe(id, i) {
    const e = finde(id);
    return e && e.stufen && e.stufen[i] ? e.stufen[i] : null;
  }

  window.AktivitaetKatalog = { KATALOG, EIGEN_STUFEN, finde, stufe };
})();
