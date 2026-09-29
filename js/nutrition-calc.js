/* =========================================================================
   NUTRITION-CALC — Kalorienbedarf und Makronaehrstoffe.
   -------------------------------------------------------------------------
   Reine Rechnung, keine DOM-/Speicher-Abhaengigkeit -> im Browser
   (window.NutritionCalc) und in Node (module.exports) nutzbar und testbar.
   Der Gegenpol zu calorie-estimator.js: der schaetzt, was eine Einheit
   VERBRAUCHT; hier steht, was der Nutzer ESSEN soll.

   WOZU DAS NOETIG WAR: Die verbreiteten Rechner im Netz (nachgesehen am
   Beispiel morenutrition.de) haben drei Schwaechen, die wir nicht erben
   wollen:

   1. SIE SCHAETZEN DEN KOERPERFETTANTEIL UND RECHNEN DANN SO WEITER, ALS
      WAERE ER GEMESSEN. Ohne Angabe wird dort ueber Deurenberg geschaetzt
      (kennt nur BMI, Alter, Geschlecht) und das Ergebnis in eine Formel
      gesteckt, die auf der Magermasse aufbaut. Bei einem Trainierten faellt
      der geschaetzte Fettanteil zu hoch aus, die Magermasse damit zu klein
      und der Grundumsatz zu niedrig — der Athlet bekommt zu wenig zu essen.
      HIER: eine Formel auf der Magermasse (Katch-McArdle) NUR, wenn der
      Fettanteil wirklich gemessen ist (Eingabe oder Massband). Sonst
      Mifflin-St Jeor, die ohne Koerperzusammensetzung auskommt. Wir
      erfinden keinen Korrekturfaktor, wir wechseln die Formel.

   2. SIE ZAEHLEN DAS TRAINING DOPPELT. Wer seine Schritte von der Uhr
      abliest, hat den Lauf schon in den Schritten drin und traegt ihn danach
      nochmal als Einheit ein. HIER ist die Schrittzahl per DEFINITION die
      Bewegung NEBEN dem Training — die Oberfléche sagt das an der Eingabe,
      und das Training kommt ausschliesslich ueber `einheiten` herein.
      (Eine frueherer Fassung rechnete die geplanten Laufmeter in Schritte
      zurueck und zog sie ab. Das war eine Rechnung fuer ein Problem, das
      eine klare Definition gar nicht erst entstehen laesst.)

   3. IHR TRAININGSBLOCK IST GERATEN. Der Nutzer sucht sich einen MET-Wert
      aus einer Liste und schaetzt Dauer und Haeufigkeit. TrainLogic KENNT
      die Woche. trainingProTag() nimmt darum wahlweise fertige kcal je
      Einheit (aus dem Plan ueber CalorieEstimator) ODER die MET-Form als
      Rueckfall fuer alles, was ausserhalb der App passiert.

   Bewusst NICHT uebernommen: der feste Fettdeckel (85 g) — bei einem
   schweren Athleten sind das unter 0,8 g je kg Koerpergewicht, also weniger
   als die uebliche Untergrenze. Fett ist hier ein MINDESTWERT, kein Deckel.
   Ebenso nicht uebernommen: 4,1 und 9,3 kcal je Gramm. Wir rechnen mit
   4/9/4, sonst trifft die Summe der Makros die Zielkalorien nicht.

   WAS HIER SCHAETZUNG BLEIBT — und im Ergebnis als `hinweise` steht:
   Jede Bedarfsformel hat eine Streuung von rund 10 Prozent nach oben und
   unten, auch die gute. Die Zahl ist ein Startwert, den der Gewichtsverlauf
   korrigiert — nicht ein Messwert.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NutritionCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* --- Konstanten, alle an einer Stelle ------------------------------------ */

  var KCAL_JE_G = { eiweiss: 4, fett: 9, kh: 4 };

  // Energiegehalt eines Kilogramms Koerperfettgewebe. 7700 ist der gaengige
  // Wert (Fettgewebe, nicht reines Fett); manche Rechner nehmen 7000 und
  // kommen dadurch auf groessere Defizite bei gleicher Wochenrate.
  var KCAL_JE_KG_FETT = 7700;

  // Thermischer Effekt der Nahrung, Anteil an der AUFNAHME (nicht am
  // Verbrauch). Darum wird unten geteilt und nicht multipliziert: bei
  // Erhaltung ist Aufnahme = Verbrauch, also gilt
  // Aufnahme = (GU + NEAT + Training) / (1 - TEF_ANTEIL).
  var TEF_ANTEIL = 0.10;

  /* Alltagsbewegung: kcal je Schritt und je kg Koerpergewicht — NETTO.

     Der Wert stand zuerst auf 0,00051. Zurueckgerechnet mit der Schrittlaenge,
     die diese Datei selbst ansetzt (0,75 m beim Gehen), sind das 0,68 kcal je
     kg und Kilometer — und das ist der BRUTTOwert des Gehens. Brutto heisst:
     der Ruheumsatz der Gehzeit ist darin enthalten. Der steckt aber schon im
     Grundumsatz, auf den diese Zahl addiert wird. Bei 10.000 Schritten und
     80 kg waren das rund 108 kcal am Tag zu viel, bei jedem Nutzer.

     0,000375 * 1333 Schritte je km = 0,5 kcal je kg und Kilometer, der
     Nettoaufwand des Gehens. 10.000 Schritte bei 80 kg ergeben damit 300
     statt 408 kcal. */
  var KCAL_JE_SCHRITT_JE_KG = 0.000375;

  /* Aufschlag fuer "ich sitze selten still" — ein Haken, keine Stundenzahl.
     ------------------------------------------------------------------------
     Vorher stand hier eine Stundenangabe mal 20 kcal. Beide Teile waren
     falsch. Die 20 kcal waren eine Setzung ohne Quelle, und bei den ueblichen
     Eingaben von sechs bis acht Stunden kamen 120 bis 160 kcal am Tag heraus
     — rund sieben Prozent des Ziels, aus einer geratenen Zahl. Und das Feld
     selbst war eine Falle: am 22.08.2026 stand auf Benjamins iPhone eine 4000
     darin, weil der Anhaltspunkt zu den SCHRITTEN direkt darunter stand. Der
     Rechner gab daraufhin 91.303 kcal aus.

     Die einzige Zahl in diesem Bereich mit einem Konfidenzintervall ist
     Saeidifard u. a. 2018 (Eur J Prev Cardiol, systematische Uebersicht mit
     Metaanalyse, 46 Studien, n = 1184): Stehen gegen Sitzen kostet
     0,15 kcal je Minute (95 % KI 0,12 bis 0,17), also rund 9 kcal je Stunde.
     Sechs Stunden stehen statt sitzen ergeben 54 kcal — aufgerundet 50.
     Evidenzgrad B fuer die Rate, C fuer die Tagessumme: die sechs Stunden
     bleiben eine Setzung.

     Bewusst KLEIN gewaehlt, aus zwei Gruenden. Erstens ist die Angabe
     selbstberichtet und hebt den Bedarf — dieselbe einseitige Gefahr wie bei
     der geschaetzten Magermasse, die diese Datei sonst ueberall ausschliesst;
     ein falsches Ja schenkt Kalorien, die niemand verbraucht. Zweitens
     ueberschneidet sie sich mit den Schritten: wer nicht stillsitzt, geht in
     aller Regel auch mehr, und das steht schon im Feld darueber.

     Levine u. a. 1999 (Science) misst zwischen Menschen eine Spannweite von
     -98 bis +692 kcal am Tag. Diese Groesse ist mit KEINER einzelnen Zahl zu
     treffen; 50 ist die vertretbare, nicht die richtige. */
  var KCAL_UNRUHE_PAUSCHALE = 50;

  /* Obergrenzen fuer die Alltagsangaben. Sie sind kein Feinschliff, sondern
     der Ersatz fuer eine Pruefung, die es hier sonst nirgends gibt: beide
     Zahlen tippt der Nutzer selbst ab, und ein Vertipper faellt in der Summe
     nicht auf. Am 22.08.2026 stand auf dem iPhone eine 4000 im Unruhefeld —
     der Rechner gab daraufhin 91.303 kcal am Tag und 16.986 g Kohlenhydrate
     aus, ohne zu zucken. Der Fettanteil war die einzige Angabe mit Deckel.
     50.000 Schritte sind rund 35 km und mehr, als neben dem Training jemand
     geht. (Das Unruhefeld, das den Fehler ausgeloest hat, ist inzwischen ein
     Haken — siehe KCAL_UNRUHE_PAUSCHALE. Der Deckel bleibt trotzdem: die
     Schritte tippt der Nutzer weiterhin selbst ab.) */
  var SCHRITTE_MAX = 50000;

  /* Wie weit zurueck eine Wiegung noch zaehlt. Dieselbe Spanne fuer die
     Ausgleichsgerade, fuer das Bild und fuer die Frage "was wiegt der Nutzer
     eigentlich" — es gibt keinen Grund, warum ein Punkt fuer das eine gelten
     sollte und fuer das andere nicht. Steht hier oben bei den uebrigen
     Konstanten, weil die erste Verwendung (verlaufAuswerten) weiter oben
     steht als die Verlaufsfunktionen selbst. */
  var VERLAUF_FENSTER_TAGE = 42;

  /* Abnehmrate in Prozent Koerpergewicht je Woche, abhaengig vom Fettanteil.
     Je magerer, desto langsamer — sonst geht Magermasse mit.

     ZUR OBERSTEN STUFE (0,7): sie stand lange als offene Frage im Raum. Die
     Zahl stammt aus Garthe 2011, war dort aber die LANGSAME Bedingung des
     Versuchs und nicht die Obergrenze; das ISSN-Papier nennt 0,5 bis 1,0 und
     ausdruecklich: je hoeher der Ausgangsfettanteil, desto aggressiver darf
     es sein. Die Literatur spricht also eher fuer eine Anhebung.

     AM 22.08.2026 NACHGERECHNET — und die Anhebung waere folgenlos. Mit der
     Stufe auf 0,9 und sogar auf 1,2 kommt bei ZEHN durchgerechneten Profilen
     exakt dasselbe heraus wie mit 0,7:

       Mann 130 kg (KFA 36,8, gemessen)   0,7 -> 0,51 %   0,9 -> 0,51 %
       Frau  95 kg (KFA 49,3, gemessen)   0,7 -> 0,63 %   0,9 -> 0,63 %
       Mann  72 kg (KFA 27,8, gemessen)   0,7 -> 0,60 %   0,9 -> 0,60 %
       Frau  68 kg (KFA 40,4, gemessen)   0,7 -> 0,56 %   0,9 -> 0,56 %

     Der Grund: eine der beiden Untergrenzen greift IMMER vorher. Bei
     Trainierenden die Energieverfuegbarkeit, bei den uebrigen der
     Grundumsatz selbst. 0,7 % von 130 kg sind 1001 kcal Defizit am Tag — das
     unterschreitet seinen Grundumsatz, also hebt `zielKalorien` wieder an.
     Bei 0,9 % waeren es 1287 kcal, und die Korrektur landet an derselben
     Stelle. **Diese Stufe erreicht keinen Nutzer.**

     Sie bleibt trotzdem stehen, anders als die 20-Prozent-Fettschranke und
     `min-width: 0`, die aus demselben Grund entfernt wurden: die 0,7 ist der
     obere Anker der Staffelung und wird gebraucht, damit `abnehmRate` fuer
     hohe Fettanteile ueberhaupt etwas zurueckgeben kann.

     EINE ANHEBUNG WAERE SOGAR SCHAEDLICH. `zielRate` liefert die GEPLANTE
     Rate ohne Untergrenzen, und die Zielkarte im Formular zeigt sie an. Beim
     130-kg-Mann verspricht sie heute 0,91 kg je Woche, geliefert werden
     0,66 — eine Luecke von 0,25 kg. Mit 0,9 verspraeche sie 1,17 kg bei
     unveraenderten 0,66, also 0,51 kg Luecke. Das Ergebnis bliebe gleich,
     nur die Enttaeuschung waere groesser. Ein Test sichert die Luecke. */
  var ABNEHM_RATEN = {
    mann: [{ bisKfa: 15, rate: 0.3 }, { bisKfa: 25, rate: 0.5 }, { bisKfa: 100, rate: 0.7 }],
    frau: [{ bisKfa: 25, rate: 0.3 }, { bisKfa: 35, rate: 0.5 }, { bisKfa: 100, rate: 0.7 }]
  };
  var ABNEHM_RATE_UNBEKANNT = 0.5;

  // Aufbaurate in Prozent Koerpergewicht je Woche. Der Anfaenger darf
  // schneller zunehmen, weil bei ihm mehr davon Muskel wird.
  var AUFBAU_RATEN = { beginner: 0.40, regular: 0.25, competitive: 0.15 };

  // Eiweiss je kg Magermasse. Im Defizit hoeher, weil dort Magermasse
  // geschuetzt werden muss.
  var EIWEISS_JE_KG_LBM = { abnehmen: 2.4, halten: 2.0, zunehmen: 2.0 };
  // Ohne belastbare Magermasse: je kg Koerpergewicht.
  var EIWEISS_JE_KG_KG = { abnehmen: 2.0, halten: 1.6, zunehmen: 1.6 };

  /* Einseitiger Deckel fuer Schwere OHNE Messung.
     ------------------------------------------------------------------------
     Die Werte je kg Koerpergewicht sind an einem Nutzer mit rund 20 Prozent
     Koerperfett geeicht: 2,0 g/kg Magermasse mal 0,80 ergibt genau die 1,6
     g/kg Koerpergewicht darueber. Bei jemandem mit 40 Prozent stimmt diese
     Eichung nicht mehr — nachgerechnet bekommt ein Mann mit 130 kg im Defizit
     260 g Eiweiss, und das sind 3,39 g je kg geschaetzter fettfreier Masse.
     Eine Frau mit 95 kg landet bei 3,65. Beides liegt UEBER dem oberen Ende
     jedes publizierten Bandes (ISSN, Helms, Murphy: 2,3 bis 3,1 g/kg FFM),
     und die Kohlenhydrate fallen dabei auf 1,16 bzw. 1,31 g je kg.

     Der Deckel benutzt die Deurenberg-Schaetzung — also ausgerechnet die
     Zahl, die diese Datei sonst nirgends in eine Formel laesst. Das ist hier
     erlaubt, weil er nur SENKEN kann und weil er selbstbegrenzend ist:
     3,1 * FFM_Deurenberg unterschreitet 2,0 * Gewicht erst ab einem
     geschaetzten Fettanteil von 35,5 Prozent. Deurenberg muesste einem
     Trainierten also ueber 35,5 Prozent zuschreiben, damit der Deckel ihn
     ueberhaupt beruehrt — das tut sie nicht. Eine geschaetzte Groesse darf
     unter genau diesen zwei Bedingungen eingreifen: sie senkt nur, und sie
     erreicht nur den Fall, fuer den sie gedacht ist.

     Quelle fuer den FFM-Bezug bei hohem Koerperfett: Clinical Nutrition
     ESPEN 2022 — bei 78 bis 100 Prozent der Uebergewichtigen ergeben
     koerpergewichts- und magermassebasierte Vorgaben klinisch verschiedene
     Werte. Evidenzgrad B fuer den Bezug, C fuer die 3,1 als Zahl: sie ist
     die Oberkante eines Positionspapierbandes, keine gemessene Schwelle.
     Fuer sehr Adipoese gibt es KEINE Trainingsstudie — Refalo 2025 schliesst
     sie aus (Maenner bis 27,8, Frauen bis 39,7 Prozent). */
  var EIWEISS_MAX_JE_KG_LBM_GESCHAETZT = 3.1;

  /* Fett: der Zielwert ist ein ENERGIEANTEIL, und die Untergrenze auch.

     Zuerst stand hier eine Grammschranke von 0,8 g je kg Koerpergewicht. Fuer
     eine solche Schranke gibt es keinen Beleg — die kursierenden 0,5/0,8/1,0
     sind Konvention. Belegt ist der Anteil an der Energie: 20 bis 35 Prozent,
     und eine dauerhafte Unterschreitung von 20 Prozent ist nicht ratsam.

     Der Unterschied ist nicht theoretisch: eine Grammschranke am
     Koerpergewicht bindet ausgerechnet dort, wo das Budget am kleinsten ist.
     Mann mit 110 kg im Defizit, Ziel 1986 kcal — 0,8 g/kg waren 88 g Fett,
     also 40 Prozent der Zielkalorien, und danach blieben 1,08 g
     Kohlenhydrate je kg uebrig. Der Rechner loeste damit seine eigene
     Kohlenhydratwarnung aus.

     Die Grammzahl bleibt als absolute Untergrenze stehen, aber bei 0,5 statt
     0,8 g je kg. NACHGERECHNET AM 22.08.2026: sie greift, sobald die
     Zielkalorien unter rund 18 kcal je kg Koerpergewicht fallen — und das
     ist nicht der Randfall, sondern der Normalfall "schwerer Nutzer im
     Defizit" (drei von neun durchgerechneten Profilen). Die Wirkung bleibt
     mit drei Gramm belanglos, aber die fruehere Formulierung "nur bei sehr
     kleinen Vorgaben" war zu beruhigend: die Zeile ist NICHT tot, sie ist
     nur leise.

     UND EINE UNTERGRENZE VON 20 PROZENT DER ENERGIE STEHT HIER BEWUSST NICHT.
     Sie waere toter Code: der Zielanteil betraegt 25 Prozent und liegt damit
     immer darueber. Eine Zeile, die nie greifen kann, sieht aus wie ein
     Schutz und ist keiner. Gesichert wird die Untergrenze stattdessen dort,
     wo sie hingehoert — als Bedingung im Test ("Fett liegt nie unter 20
     Prozent der Kalorien"). Wer den Zielanteil eines Tages senkt, faellt
     dort auf. */
  var FETT_ANTEIL_KCAL = 0.25;          // Zielanteil an den Kalorien
  var FETT_MIN_JE_KG = 0.5;             // absolute Untergrenze je kg Koerpergewicht
  /* Kohlenhydrate: die Warnschwelle haengt am TRAININGSUMFANG, nicht an einer
     festen Zahl je Kilogramm.

     Zuerst stand hier eine feste Grenze von 3 g je kg. Die ist fuer genau
     einen Umfang richtig — den kleinsten. Die belegten Zielwerte steigen mit
     der Belastung: rund 3-5 g/kg bei leichtem Training, 5-7 bei etwa einer
     Stunde taeglich, 6-10 bei ein bis drei Stunden moderat bis intensiv.

     Mit der festen Grenze schwieg der Rechner ausgerechnet dort, wo wirklich
     Treibstoff fehlt: 3000 kcal Training je Woche und 3,70 g/kg ergaben
     KEINE Warnung, obwohl der Zielwert dieser Kategorie bei 6 bis 10 liegt.
     Gleichzeitig meldete er sich bei jemandem mit drei Einheiten und 2,81
     g/kg, der seinem Umfang nach fast im Band lag.

     EHRLICH DAZU: Die Stufen von Burke sind belegt, die Umrechnung von
     Wochen-Trainingskalorien auf seine Stundenkategorien ist eine Setzung.
     Sie ist grob und soll es sein — sie steuert einen Hinweis, keine
     Vorgabe. */
  /* Energieverfuegbarkeit: was nach dem Training fuer alles andere uebrig
     bleibt, je Kilogramm fettfreier Masse.

     WARUM ALS ZWEITE UNTERGRENZE: Der Grundumsatz ist eine Rechengroesse, keine
     Gesundheitsschwelle — und er kennt den Trainingsumfang nicht. Wer hart
     trainiert, kann deutlich ueber seinem Grundumsatz essen und trotzdem zu
     wenig haben, weil das Training den groesseren Teil davon schon
     aufgebraucht hat. Genau diese Luecke schliesst die Energieverfuegbarkeit:
     (Zielkalorien - Trainingsverbrauch) / kg fettfreier Masse.

     Gerechnet wird mit dem NETTO-Trainingsverbrauch (siehe ruheanteilKcal) —
     die Definition meint den Aufwand ueber den Ruheumsatz hinaus.

     EHRLICH ZU DEN ZAHLEN: Dass zu niedrige Energieverfuegbarkeit Gesundheit
     und Leistung schaedigt, ist gut belegt. Die Marke von 30 stammt aber aus
     Laborarbeiten an nicht-athletischen Frauen aus den fruehen 2000er Jahren,
     und das IOC-Konsenspapier von 2023 ist von der einen Schwelle abgerueckt
     und beschreibt einen Uebergang. Deshalb: bei 30 nur ein HINWEIS, kein
     Eingriff. Angehoben wird erst bei 25, wo auch die vorsichtigsten Quellen
     nicht mehr von "anpassbar" sprechen.

     NUR BEI GEMESSENEM FETTANTEIL. Ohne ihn waere die fettfreie Masse
     geraten, und eine geratene Zahl darf hier so wenig eingreifen wie beim
     Grundumsatz. */
  var EA_HINWEIS = 30;        // kcal je kg fettfreier Masse
  var EA_UNTERGRENZE = 25;

  var KH_STUFEN = [
    { bisKcalWoche: 1000, jeKg: 3 },
    { bisKcalWoche: 2500, jeKg: 4 },
    { bisKcalWoche: 4500, jeKg: 5 },
    { bisKcalWoche: Infinity, jeKg: 6 }
  ];

  /* --- Kleinkram ----------------------------------------------------------- */

  function zahl(v) {
    var n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
    return isFinite(n) ? n : 0;
  }

  /* Ein gespeicherter Punkt traegt nur ein DATUM ("2026-08-22"), und
     `Date.parse` legt es auf Mitternacht UTC. Verglichen mit einem Zeitpunkt
     liegt der heutige Eintrag damit in der ZUKUNFT, solange es beim Nutzer
     noch frueher Morgen ist — er waere aus dem Fenster gefallen und im Bild
     verschwunden. Deshalb wird die Obergrenze auf denselben Kalendertag
     gebracht, nach der Uhr des Nutzers. */
  function tagesGrenze(zeit) {
    var d = new Date(zeit);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function runde(n, stellen) {
    var f = Math.pow(10, stellen || 0);
    return Math.round(n * f) / f;
  }

  // "male", "m", "mann" -> "mann"; alles Weibliche -> "frau".
  // Voreinstellung ist "mann", weil die Formeln sonst still das kleinere
  // Ergebnis liefern und ein fehlendes Feld wie eine Angabe aussaehe.
  function geschlecht(v) {
    var s = String(v || "").toLowerCase();
    if (s === "w" || s === "f" || s.indexOf("frau") === 0 || s.indexOf("female") === 0 || s.indexOf("woman") === 0) {
      return "frau";
    }
    return "mann";
  }

  function log10(x) { return Math.log(x) / Math.LN10; }

  /* --- Koerperfettanteil ---------------------------------------------------
     Zwei Wege mit sehr verschiedener Guete. Der Unterschied wird im
     Ergebnis mitgefuehrt (`belastbar`), weil er darueber entscheidet,
     welche Grundumsatzformel ueberhaupt zulaessig ist.
     ------------------------------------------------------------------------ */

  /* US-Navy (Hodgdon/Beckett), Divisionsform. Verlangt Umfaenge in cm.
     Mann:  Bauch (auf Nabelhoehe) und Hals.
     Frau:  Taille, Huefte und Hals.
     Streuung gegen DEXA rund 3 bis 4 Prozentpunkte — deutlich besser als
     jede Schaetzung aus dem BMI, aber keine Messung. */
  function kfaNavy(e) {
    e = e || {};
    var g = geschlecht(e.geschlecht);
    var groesse = zahl(e.groesseCm);
    var hals = zahl(e.halsCm);
    if (!(groesse > 0) || !(hals > 0)) return null;

    var wert;
    if (g === "mann") {
      var bauch = zahl(e.bauchCm);
      if (!(bauch > hals)) return null;
      wert = 495 / (1.0324 - 0.19077 * log10(bauch - hals) + 0.15456 * log10(groesse)) - 450;
    } else {
      var taille = zahl(e.tailleCm);
      var huefte = zahl(e.huefteCm);
      if (!(taille > 0) || !(huefte > 0) || !(taille + huefte > hals)) return null;
      wert = 495 / (1.29579 - 0.35004 * log10(taille + huefte - hals) + 0.22100 * log10(groesse)) - 450;
    }
    if (!isFinite(wert)) return null;
    return Math.max(3, Math.min(60, runde(wert, 1)));
  }

  /* Deurenberg (1991) aus BMI, Alter, Geschlecht. Absichtlich nur der
     Notnagel: die Formel kennt keine Koerperzusammensetzung und liegt bei
     Trainierten regelmaessig zu hoch. Ihr Ergebnis wird NICHT in die
     Magermasse-Formel weitergereicht, es dient nur der Einordnung. */
  function kfaDeurenberg(e) {
    e = e || {};
    var g = geschlecht(e.geschlecht);
    var gewicht = zahl(e.gewichtKg);
    var groesse = zahl(e.groesseCm);
    var alter = zahl(e.alterJahre);
    if (!(gewicht > 0) || !(groesse > 0) || !(alter > 0)) return null;

    var bmi = gewicht / Math.pow(groesse / 100, 2);
    var wert = 1.20 * bmi + 0.23 * alter - (g === "mann" ? 16.2 : 5.4);
    return Math.max(3, Math.min(60, runde(wert, 1)));
  }

  /* Welcher Fettanteil gilt — und wie sehr darf man ihm trauen?

     Drei Stufen, und der Unterschied ist nicht kosmetisch: nur ein
     BELASTBARER Wert darf in die Magermasse-Formel. Die Bildauswahl gehoert
     ausdruecklich NICHT dazu. Wer sich in einer Reihe von neun Zeichnungen
     wiedererkennt, liegt typisch fuenf bis acht Prozentpunkte daneben —
     dieser Fehler ginge sonst mal eins zu eins in den Grundumsatz ein. Die
     Bildauswahl steuert darum nur die Abnehmrate und die Anzeige. */
  function kfaBestimmen(e) {
    e = e || {};

    var angegeben = zahl(e.kfaProzent);
    if (angegeben > 0) {
      var ausBild = e.kfaQuelle === "bild";
      return {
        prozent: Math.max(3, Math.min(60, runde(angegeben, 1))),
        quelle: ausBild ? "bild" : "eingabe",
        belastbar: !ausBild
      };
    }

    var navy = kfaNavy(e);
    if (navy !== null) {
      return { prozent: navy, quelle: "massband", belastbar: true };
    }

    var deurenberg = kfaDeurenberg(e);
    if (deurenberg !== null) {
      return { prozent: deurenberg, quelle: "schaetzung", belastbar: false };
    }

    return { prozent: null, quelle: "unbekannt", belastbar: false };
  }

  /* --- Grundumsatz ---------------------------------------------------------
     Zwei Formeln, und die Wahl haengt allein daran, ob der Fettanteil
     belastbar ist. Genau das machen die ueblichen Rechner nicht.
     ------------------------------------------------------------------------ */

  function grundumsatz(e) {
    e = e || {};
    var g = geschlecht(e.geschlecht);
    var gewicht = zahl(e.gewichtKg);
    var groesse = zahl(e.groesseCm);
    var alter = zahl(e.alterJahre);
    var kfa = kfaBestimmen(e);

    if (!(gewicht > 0)) {
      return { kcal: 0, formel: "keine", magermasseKg: null, kfa: kfa };
    }

    if (kfa.belastbar && kfa.prozent !== null) {
      // Katch-McArdle: 370 + 21,6 * Magermasse. Braucht keine Angabe zu
      // Alter, Groesse oder Geschlecht — die stecken alle in der
      // Koerperzusammensetzung.
      var lbm = gewicht * (100 - kfa.prozent) / 100;
      return {
        kcal: Math.round(370 + 21.6 * lbm),
        formel: "katch-mcardle",
        magermasseKg: runde(lbm, 1),
        kfa: kfa
      };
    }

    if (!(groesse > 0) || !(alter > 0)) {
      return { kcal: 0, formel: "keine", magermasseKg: null, kfa: kfa };
    }

    // Mifflin-St Jeor: braucht keine Koerperzusammensetzung und ist damit
    // ehrlicher als eine Magermasse-Formel auf geschaetzter Magermasse.
    var kcal = 10 * gewicht + 6.25 * groesse - 5 * alter + (g === "mann" ? 5 : -161);
    return {
      kcal: Math.round(kcal),
      formel: "mifflin-st-jeor",
      // Nur zur Anzeige. Bewusst NICHT fuer die Makros verwendet.
      magermasseKg: kfa.prozent !== null ? runde(gewicht * (100 - kfa.prozent) / 100, 1) : null,
      kfa: kfa
    };
  }

  /* Ten-Haaf, eine an Freizeitathleten entwickelte Grundumsatzformel.

     SIE RECHNET HIER NICHTS AUS. Sie dient allein dazu, den bekannten Fehler
     von Mifflin-St Jeor zu BEZIFFERN, wenn der Fettanteil nicht gemessen ist
     — ein Hinweis mit einer Zahl wiegt schwerer als einer ohne.

     Warum sie nicht selbst rechnet: In der Metaanalyse an 1430 Athleten war
     sie die einzige Gleichung ohne Verzerrung und traf 80 Prozent innerhalb
     von zehn Prozent, waehrend Mifflin systematisch unterschaetzt. Aber sie
     wurde an 90 Freizeitathleten von 18 bis 35 Jahren entwickelt, die rund
     neun Stunden je Woche trainierten — fuer Untrainierte und Aeltere ist sie
     eine Extrapolation, und dort ist Mifflin die besser belegte Formel.
     Zwischen beiden umzuschalten haette den Grundumsatz um rund 200 kcal
     springen lassen, sobald jemand seinen Trainingsstand aendert. Der
     eigentliche Fehler ist ohnehin nicht die Formel, sondern die fehlende
     Messung: zwei Minuten Massband loesen ihn ganz. Also nennen wir die
     Groesse des Fehlers und den Weg heraus. */
  function tenHaaf(e) {
    e = e || {};
    var gewicht = zahl(e.gewichtKg);
    var groesse = zahl(e.groesseCm);
    var alter = zahl(e.alterJahre);
    if (!(gewicht > 0) || !(groesse > 0) || !(alter > 0)) return 0;
    var mann = geschlecht(e.geschlecht) === "mann" ? 1 : 0;
    return Math.round(11.94 * gewicht + 587.7 * (groesse / 100) + 191 * mann - 8.13 * alter + 29.3);
  }

  /* --- Alltagsbewegung ----------------------------------------------------- */

  /* Die Schrittzahl meint die Bewegung NEBEN dem Training. Das Training
     kommt ueber `einheiten` herein und hat hier nichts verloren — sonst
     zaehlt ein Lauf zweimal. */
  function neat(e) {
    e = e || {};
    var gewicht = zahl(e.gewichtKg);
    var schritteRoh = Math.max(0, zahl(e.schritte));
    var schritte = Math.min(schritteRoh, SCHRITTE_MAX);
    // Stillschweigend deckeln waere die halbe Loesung: der Nutzer saehe seine
    // Zahl weiter im Feld stehen und ein Ergebnis, das nicht dazu passt.
    var gedeckelt = schritte < schritteRoh;

    var kcal = schritte * KCAL_JE_SCHRITT_JE_KG * gewicht;
    if (e.unruhig === true) kcal += KCAL_UNRUHE_PAUSCHALE;

    return {
      kcal: Math.round(Math.max(0, kcal)),
      schritteGezaehlt: Math.round(schritte),
      gedeckelt: gedeckelt
    };
  }

  /* --- Aktives Training ----------------------------------------------------
     Zwei Formen je Einheit, und die erste ist der Grund, warum dieser
     Rechner besser sein kann als die im Netz:

       { kcal: 620, proWoche: 3 }                 <- aus dem Plan, gemessen
       { met: 8, minuten: 45, proWoche: 2 }       <- Rueckfall, geschaetzt

     `proWoche` fehlt = einmal. Ergebnis ist der Tagesdurchschnitt.
     ------------------------------------------------------------------------ */

  function trainingProTag(einheiten, gewichtKg) {
    var liste = Array.isArray(einheiten) ? einheiten : [];
    var gewicht = zahl(gewichtKg);
    var kcalWoche = 0;
    var minutenWoche = 0;
    var ausPlan = 0;
    var geschaetzt = 0;

    for (var i = 0; i < liste.length; i++) {
      var e = liste[i] || {};
      var haeufigkeit = zahl(e.proWoche) > 0 ? zahl(e.proWoche) : 1;

      if (zahl(e.kcal) > 0) {
        kcalWoche += zahl(e.kcal) * haeufigkeit;
        minutenWoche += zahl(e.minuten) * haeufigkeit;
        ausPlan++;
        continue;
      }

      var met = zahl(e.met);
      var minuten = zahl(e.minuten);
      if (met > 0 && minuten > 0 && gewicht > 0) {
        // MET * kg * Stunden = kcal. Der MET-Wert ist ein Vielfaches des
        // Ruheumsatzes, die Rechnung ist also bruttoseitig.
        kcalWoche += met * gewicht * (minuten / 60) * haeufigkeit;
        minutenWoche += minuten * haeufigkeit;
        geschaetzt++;
      }
    }

    return {
      kcalProWoche: Math.round(kcalWoche),
      kcal: Math.round(kcalWoche / 7),
      // Fuer den Abzug des Ruheanteils (siehe ruheanteilKcal): ohne die Dauer
      // laesst er sich nicht rechnen.
      minutenProTag: Math.round(minutenWoche / 7),
      einheitenAusPlan: ausPlan,
      einheitenGeschaetzt: geschaetzt
    };
  }

  /* Trainingsanteil aus den WIRKLICH absolvierten Einheiten.

     Das ist der Grund, warum dieser Rechner besser sein kann als die im
     Netz: dort schaetzt der Nutzer MET-Wert, Dauer und Haeufigkeit; hier
     steht die Zahl schon im Log, geschaetzt vom CalorieEstimator aus dem
     tatsaechlichen Workout.

     Es zaehlen die letzten `tage` Tage, nicht die geplante Woche: was
     jemand sich VORNIMMT und was er tut, geht auseinander, und der Bedarf
     richtet sich nach dem Getanen. Wer die geplante Woche will, uebergibt
     sie ueber `einheiten`. */
  function trainingAusLogs(logs, e) {
    e = e || {};
    var tage = zahl(e.tage) > 0 ? zahl(e.tage) : 28;
    var jetzt = e.jetzt ? new Date(e.jetzt).getTime() : Date.now();
    var grenze = jetzt - tage * 24 * 60 * 60 * 1000;

    var liste = Array.isArray(logs) ? logs : [];
    var kcal = 0, minuten = 0, einheiten = 0, aeltestes = null;

    for (var i = 0; i < liste.length; i++) {
      var log = liste[i] || {};
      var zeit = Date.parse(log.loggedAt || log.date || "");
      if (!isFinite(zeit) || zeit < grenze || zeit > jetzt) continue;
      var k = zahl(log.calorieEstimate && log.calorieEstimate.calories);
      if (!(k > 0)) continue;
      kcal += k;
      minuten += zahl(
        (log.calorieEstimate && log.calorieEstimate.durationMinutes) ||
        (log.result && log.result.durationMinutes)
      );
      einheiten++;
      if (aeltestes === null || zeit < aeltestes) aeltestes = zeit;
    }

    // Auf wie viele Tage wird verteilt? Wer erst seit zehn Tagen loggt, darf
    // seine Kalorien nicht auf 28 Tage strecken — sonst faellt der
    // Trainingsanteil zu niedrig aus. Untergrenze sieben Tage, damit ein
    // einzelnes hartes Workout am Vortag nicht den ganzen Bedarf traegt.
    var spanne = aeltestes === null ? tage
      : Math.max(7, Math.min(tage, Math.ceil((jetzt - aeltestes) / (24 * 60 * 60 * 1000)) + 1));

    return {
      kcal: Math.round(kcal / spanne),
      kcalProWoche: Math.round(kcal / spanne * 7),
      minutenProTag: Math.round(minuten / spanne),
      minutenProWoche: Math.round(minuten / spanne * 7),
      einheiten: einheiten,
      einheitenProWoche: spanne > 0 ? runde(einheiten / spanne * 7, 1) : 0,
      tageBeruecksichtigt: spanne,
      belastbar: einheiten >= 3
    };
  }

  /* --- Gesamtumsatz --------------------------------------------------------
     TEF ist ein Anteil der AUFNAHME. Bei Erhaltung ist die Aufnahme gleich
     dem Verbrauch, also wird geteilt. Wer stattdessen 10 Prozent auf die
     Summe aufschlaegt, landet rund 1 Prozent zu niedrig — klein, aber
     falsch herum gerechnet.
     ------------------------------------------------------------------------ */

  function gesamtumsatz(e) {
    e = e || {};
    var gu = zahl(e.grundumsatzKcal);
    var ab = zahl(e.neatKcal);
    var at = zahl(e.trainingKcal);
    var anteil = zahl(e.tefAnteil) > 0 ? zahl(e.tefAnteil) : TEF_ANTEIL;

    var ohneTef = gu + ab + at;
    if (!(ohneTef > 0)) return { kcal: 0, tefKcal: 0, ohneTefKcal: 0 };

    var gesamt = ohneTef / (1 - anteil);
    return {
      kcal: Math.round(gesamt),
      tefKcal: Math.round(gesamt - ohneTef),
      ohneTefKcal: Math.round(ohneTef)
    };
  }

  /* --- Zielkalorien --------------------------------------------------------
     Die Rate haengt am Fettanteil, nicht an einem festen Prozentsatz fuer
     alle. Ein Athlet bei 10 Prozent verliert bei 0,7 Prozent je Woche
     Muskulatur mit; bei 32 Prozent waeren 0,3 Prozent unnoetig zaeh.
     ------------------------------------------------------------------------ */

  function abnehmRate(g, kfaProzent, belastbar) {
    if (!belastbar || kfaProzent === null) return ABNEHM_RATE_UNBEKANNT;
    var stufen = ABNEHM_RATEN[g] || ABNEHM_RATEN.mann;
    for (var i = 0; i < stufen.length; i++) {
      if (kfaProzent < stufen[i].bisKfa) return stufen[i].rate;
    }
    return stufen[stufen.length - 1].rate;
  }

  /* Die GEPLANTE Rate zu einem Ziel — ohne Umsatz, ohne Untergrenzen.

     Wozu getrennt: die Oberflaeche soll schon bei der Zielwahl sagen koennen,
     was das Ziel bedeutet. Bisher stand die Rate erst im Ergebnis, also nach
     der Entscheidung. Was am Ende herauskommt, kann davon abweichen — beide
     Untergrenzen koennen anheben —, deshalb heisst es dort "geplant". */
  function zielRate(e) {
    e = e || {};
    var g = geschlecht(e.geschlecht);
    var ziel = e.ziel === "abnehmen" || e.ziel === "zunehmen" ? e.ziel : "halten";
    if (ziel === "halten") return { ziel: ziel, rateProWoche: 0, kgProWoche: 0, kcalProTag: 0 };

    var gewicht = zahl(e.gewichtKg);
    var rate;
    if (ziel === "abnehmen") {
      rate = abnehmRate(
        g,
        e.kfaProzent === null || e.kfaProzent === undefined ? null : zahl(e.kfaProzent),
        !!e.kfaBelastbar
      );
    } else {
      rate = AUFBAU_RATEN[e.trainingLevel] !== undefined ? AUFBAU_RATEN[e.trainingLevel] : AUFBAU_RATEN.regular;
    }

    var kg = gewicht * rate / 100;
    var kcal = Math.round(kg * KCAL_JE_KG_FETT / 7) * (ziel === "abnehmen" ? -1 : 1);
    return { ziel: ziel, rateProWoche: rate, kgProWoche: runde(kg, 2), kcalProTag: gewicht > 0 ? kcal : 0 };
  }

  function zielKalorien(e) {
    e = e || {};
    var g = geschlecht(e.geschlecht);
    var tdee = zahl(e.gesamtumsatzKcal);
    var gu = zahl(e.grundumsatzKcal);
    var gewicht = zahl(e.gewichtKg);
    var ziel = e.ziel === "abnehmen" || e.ziel === "zunehmen" ? e.ziel : "halten";
    var hinweise = [];

    if (!(tdee > 0) || !(gewicht > 0)) {
      return { kcal: 0, ziel: ziel, abweichungKcal: 0, rateProWoche: 0, kgProWoche: 0, untergrenzeAktiv: false, hinweise: hinweise };
    }

    var rate = 0;
    var abweichung = 0;

    if (ziel === "abnehmen") {
      rate = abnehmRate(g, e.kfaProzent === null || e.kfaProzent === undefined ? null : zahl(e.kfaProzent), !!e.kfaBelastbar);
      if (!e.kfaBelastbar) {
        hinweise.push("Ohne gemessenen Körperfettanteil rechnen wir mit der mittleren Abnehmrate. Miss nach, dann wird sie genauer.");
      }
      abweichung = -Math.round(gewicht * rate / 100 * KCAL_JE_KG_FETT / 7);
    } else if (ziel === "zunehmen") {
      var stufe = AUFBAU_RATEN[e.trainingLevel] !== undefined ? AUFBAU_RATEN[e.trainingLevel] : AUFBAU_RATEN.regular;
      rate = stufe;
      abweichung = Math.round(gewicht * rate / 100 * KCAL_JE_KG_FETT / 7);
    }

    var kcal = tdee + abweichung;

    // Untergrenze ist der Grundumsatz selbst, nicht eine feste Zahl:
    // dauerhaft unter dem eigenen Ruheumsatz zu essen ist keine Diät mehr.
    var untergrenze = gu > 0 ? gu : 0;
    var untergrenzeAktiv = false;
    if (untergrenze > 0 && kcal < untergrenze) {
      hinweise.push("Das errechnete Defizit läge unter deinem Grundumsatz. Wir heben die Vorgabe auf den Grundumsatz an — abnehmen wirst du dann langsamer.");
      kcal = untergrenze;
      untergrenzeAktiv = true;
      abweichung = kcal - tdee;
      /* DIE RATE MUSS MIT. Sie wird angezeigt ("geplant fuer rund 0,7 %
         Koerpergewicht pro Woche") und ist die einzige Zahl, an der der
         Nutzer nach vier Wochen prueft, ob es funktioniert hat. Ohne diese
         Zeile stand ueber einem gedeckelten Defizit von 334 kcal weiterhin
         0,7 Prozent — tatsaechlich folgen daraus 0,32. Wer das nachrechnet,
         haelt den Rechner fuer kaputt. */
      rate = gewicht > 0
        ? runde(Math.abs(abweichung) * 7 / KCAL_JE_KG_FETT / gewicht * 100, 2)
        : 0;
    }

    /* Zweite Untergrenze: die Energieverfuegbarkeit. Sie kommt NACH dem
       Grundumsatz, weil sie nur anheben kann — und weil sie den
       Trainingsumfang kennt, den der Grundumsatz nicht kennt. */
    var magermasse = zahl(e.magermasseKg);
    var trainingKcal = zahl(e.trainingKcal);
    var ea = null;
    var eaAngehoben = false;

    if (magermasse > 0) {
      ea = (kcal - trainingKcal) / magermasse;
      if (ea < EA_UNTERGRENZE) {
        var noetig = Math.round(EA_UNTERGRENZE * magermasse + trainingKcal);
        hinweise.push("Nach deinem Training bleiben nur " + Math.round(ea) + " kcal je kg fettfreier Masse übrig — zu wenig für alles, was dein Körper sonst noch tut. Wir heben die Vorgabe an. Wer dauerhaft darunter bleibt, verliert Hormonlage, Knochendichte und am Ende auch Leistung.");
        kcal = noetig;
        eaAngehoben = true;
        abweichung = kcal - tdee;
        rate = gewicht > 0
          ? runde(Math.abs(abweichung) * 7 / KCAL_JE_KG_FETT / gewicht * 100, 2)
          : 0;
        ea = (kcal - trainingKcal) / magermasse;
      } else if (ea < EA_HINWEIS) {
        /* DER TEXT HAENGT AM ZIEL, aus demselben Grund wie bei den
           Kohlenhydraten: ein Defizit SENKT die Energieverfuegbarkeit, das
           ist keine Nebenwirkung, sondern seine Funktionsweise. Wer abnimmt,
           landet fast immer unter 30 — ein Alarm waere dort keine
           Information. Wer dagegen HAELT und trotzdem darunter liegt, isst
           schlicht zu wenig fuer sein Training, ohne es zu wollen. */
        var eaText = Math.round(ea);
        if (ziel === "abnehmen") {
          hinweise.push("Nach dem Training bleiben " + eaText + " kcal je kg fettfreier Masse übrig. Unter 30 ist beim Abnehmen normal. Auf die Dauer kommt es an: ein paar Wochen sind in Ordnung, ein halbes Jahr nicht.");
        } else {
          hinweise.push("Nach dem Training bleiben nur " + eaText + " kcal je kg fettfreier Masse übrig, obwohl du gar nicht abnehmen willst. Für so viel Training isst du zu wenig — iss mehr oder trainiere weniger.");
        }
      }
    }

    return {
      kcal: Math.round(kcal),
      ziel: ziel,
      abweichungKcal: Math.round(abweichung),
      rateProWoche: rate,
      // Dieselbe Rate in Kilogramm. Sie wird HIER gerechnet und nicht in der
      // Anzeige, weil `rate` an dieser Stelle schon zurueckgerechnet ist:
      // greift eine Untergrenze, ist die tatsaechliche Rate kleiner als die
      // geplante. Wer in der Oberflaeche selbst multipliziert, zeigt die
      // geplante Zahl und meint die erreichte.
      kgProWoche: runde(gewicht * rate / 100, 2),
      untergrenzeAktiv: untergrenzeAktiv,
      energieverfuegbarkeit: ea === null ? null : runde(ea, 1),
      eaAngehoben: eaAngehoben,
      hinweise: hinweise
    };
  }

  function khWarngrenze(trainingKcalProWoche) {
    var w = zahl(trainingKcalProWoche);
    for (var i = 0; i < KH_STUFEN.length; i++) {
      if (w < KH_STUFEN[i].bisKcalWoche) return KH_STUFEN[i].jeKg;
    }
    return KH_STUFEN[KH_STUFEN.length - 1].jeKg;
  }

  /* --- Makronaehrstoffe ----------------------------------------------------
     Reihenfolge: Eiweiss zuerst (es hat die harte Begruendung), dann Fett
     bis zur Untergrenze, der Rest sind Kohlenhydrate. Fett ist hier eine
     UNTERGRENZE je kg Koerpergewicht und kein Deckel — der uebliche Deckel
     von 85 g trifft schwere Athleten unter 0,8 g/kg.
     ------------------------------------------------------------------------ */

  function makros(e) {
    e = e || {};
    var kcal = zahl(e.kcal);
    var gewicht = zahl(e.gewichtKg);
    var lbm = zahl(e.magermasseKg);
    var ziel = e.ziel === "abnehmen" || e.ziel === "zunehmen" ? e.ziel : "halten";
    var hinweise = [];

    if (!(kcal > 0) || !(gewicht > 0)) {
      return { eiweissG: 0, fettG: 0, khG: 0, kcalGeprueft: 0, hinweise: hinweise };
    }

    var eiweissG;
    var gedeckeltAufFfm = false;
    if (lbm > 0) {
      eiweissG = EIWEISS_JE_KG_LBM[ziel] * lbm;
    } else {
      eiweissG = EIWEISS_JE_KG_KG[ziel] * gewicht;

      // Der Deckel aus der Deurenberg-Schaetzung. Er darf nur senken, und
      // nie unter 1,6 g je kg Koerpergewicht: sonst fiele er ab einem
      // geschaetzten Fettanteil von 48,4 Prozent unter die Untergrenze, die
      // diese Funktion weiter unten ohnehin verteidigt.
      var kfaSchaetzung = kfaDeurenberg({
        geschlecht: e.geschlecht, gewichtKg: gewicht,
        groesseCm: e.groesseCm, alterJahre: e.alterJahre
      });
      if (kfaSchaetzung > 0) {
        var ffmGeschaetzt = gewicht * (1 - kfaSchaetzung / 100);
        var deckel = Math.max(
          EIWEISS_MAX_JE_KG_LBM_GESCHAETZT * ffmGeschaetzt,
          1.6 * gewicht
        );
        if (deckel < eiweissG) {
          eiweissG = deckel;
          gedeckeltAufFfm = true;
        }
      }

      hinweise.push("Das Eiweiß rechnet auf dein Körpergewicht. Mit dem Maßband rechnen wir auf die fettfreie Masse — das trifft besser.");
    }
    eiweissG = Math.round(eiweissG);

    if (gedeckeltAufFfm) {
      hinweise.push("Eiweiß nach Körpergewicht wäre bei dir zu viel — mehr, als selbst für reine Muskelmasse angesetzt wird. Wir haben es auf deine geschätzte fettfreie Masse begrenzt. Mit dem Maßband wird daraus eine echte Zahl.");
    }

    var fettMin = FETT_MIN_JE_KG * gewicht;
    var fettG = Math.max(kcal * FETT_ANTEIL_KCAL / KCAL_JE_G.fett, fettMin);

    var restKcal = kcal - eiweissG * KCAL_JE_G.eiweiss - fettG * KCAL_JE_G.fett;

    // Passt der Rest nicht mehr, gibt zuerst das Fett nach — bis zur
    // Untergrenze, nicht darunter.
    if (restKcal < 0) {
      fettG = fettMin;
      restKcal = kcal - eiweissG * KCAL_JE_G.eiweiss - fettG * KCAL_JE_G.fett;
    }
    // Reicht es immer noch nicht, ist die Vorgabe zu klein fuer diese
    // Eiweissmenge. Dann gibt das Eiweiss nach, aber nicht unter 1,6 g/kg.
    if (restKcal < 0) {
      var eiweissMin = Math.round(1.6 * gewicht);
      if (eiweissG > eiweissMin) {
        eiweissG = eiweissMin;
        restKcal = kcal - eiweissG * KCAL_JE_G.eiweiss - fettG * KCAL_JE_G.fett;
      }
    }
    if (restKcal < 0) {
      restKcal = 0;
      hinweise.push("Die Zielkalorien reichen für Eiweiß und Fett gerade eben. Für Kohlenhydrate bleibt nichts übrig — das ist auf Dauer kein tragfähiger Plan.");
    }

    fettG = Math.round(fettG);
    var khG = Math.round(restKcal / KCAL_JE_G.kh);

    /* DER TEXT UNTERSCHEIDET DEFIZIT UND ERHALTUNG, und das ist der halbe
       Befund. Wer abnimmt, erreicht die Zielwerte fast nie — das ist der
       Preis des Defizits und kein Fehler. Ein Hinweis, der bei jedem
       Abnehmenden als Mangel erscheint, wird ueberlesen, und dann ueberliest
       man auch den Fall, in dem wirklich Treibstoff fehlt. */
    var grenze = khWarngrenze(e.trainingKcalProWoche);
    if (khG < grenze * gewicht) {
      var jeKg = Math.round(khG / gewicht * 10) / 10;
      var text = String(jeKg).replace(".", ",");
      if (ziel === "abnehmen") {
        hinweise.push("Mit " + text + " g Kohlenhydraten je kg liegst du unter dem, was dein Training sonst verlangt (rund " + grenze + " g). Das ist der Preis des Defizits — die letzten harten Sätze fühlen sich zäh an.");
      } else {
        hinweise.push("Für dein Training wären rund " + grenze + " g Kohlenhydrate je kg gut, hier sind es " + text + "." +
          (fettG > fettMin ? " Nimm sie vom Fett, das liegt noch über seiner Untergrenze." : " Mehr geht nur über mehr Kalorien insgesamt."));
      }
    }

    return {
      eiweissG: eiweissG,
      fettG: fettG,
      khG: khG,
      // Zur Gegenprobe: die Makros wieder in Kalorien zurueckgerechnet.
      kcalGeprueft: eiweissG * KCAL_JE_G.eiweiss + fettG * KCAL_JE_G.fett + khG * KCAL_JE_G.kh,
      hinweise: hinweise
    };
  }

  /* Der Ruheanteil der Trainingszeit.

     WOZU: calorie-estimator.js rechnet BRUTTO — der Ruheumsatz der
     Trainingszeit steckt in seiner Zahl (nachgemessen: eine Satzpause zaehlt
     mit 3,0 METs, und ein MET davon ist Ruhe; die Belege stehen im Kopf
     jener Datei). Derselbe Ruheumsatz steckt aber schon im Grundumsatz, auf
     den hier addiert wird. Ohne diesen Abzug zaehlt eine Stunde Training den
     Ruheumsatz einer Stunde zweimal.

     GERECHNET WIRD MIT DEM ECHTEN GRUNDUMSATZ des Nutzers, nicht mit dem
     einen MET der MET-Definition. Ein MET ist ein Mittelwert (1 kcal je kg
     und Stunde) und liegt bei den meisten Erwachsenen ueber dem gemessenen
     Ruheumsatz — wir kennen hier den besseren Wert und nehmen ihn.

     Groessenordnung: 45 Minuten bei einem Grundumsatz von 1750 kcal sind 55
     kcal je Einheit, bei fuenf Einheiten je Woche rund 39 kcal am Tag. */
  function ruheanteilKcal(minutenProTag, grundumsatzKcal) {
    var min = zahl(minutenProTag);
    var gu = zahl(grundumsatzKcal);
    if (!(min > 0) || !(gu > 0)) return 0;
    return Math.round(min * gu / 1440);
  }

  /* --- Rueckkopplung: was die Waage sagt --------------------------------------

     DAS IST DER EIGENTLICHE VORSPRUNG gegenueber jedem Rechner im Netz. Jede
     Bedarfsformel streut um rund zehn Prozent — bei 2800 kcal sind das 280
     kcal am Tag, also der Unterschied zwischen Abnehmen und Zunehmen. Diese
     Streuung ist NICHT wegzurechnen, aber sie ist MESSBAR: nach zwei bis drei
     Wochen sagt der Gewichtsverlauf, um wie viel die Schaetzung danebenlag.

     Gerechnet wird ueber eine Ausgleichsgerade, nicht ueber "erster gegen
     letzter Wert". Koerpergewicht schwankt taeglich um ein Kilo und mehr —
     Wasser, Darminhalt, Salz, Zyklus. Zwei Einzelwerte zu vergleichen misst
     davon mehr als vom Trend. Die Gerade nimmt alle Punkte mit.

     UND SIE HAELT DEN MUND, wenn die Grundlage zu duenn ist: unter drei
     Wiegungen oder unter vierzehn Tagen kommt `belastbar: false` zurueck.
     Eine Korrektur aus fuenf Tagen waere Rauschen mit Nachkommastelle. */

  function verlaufAuswerten(punkte, e) {
    e = e || {};
    var jetzt = e.jetzt ? new Date(e.jetzt).getTime() : Date.now();
    var fenster = zahl(e.tage) > 0 ? zahl(e.tage) : VERLAUF_FENSTER_TAGE;
    var grenze = jetzt - fenster * 24 * 60 * 60 * 1000;

    var liste = (Array.isArray(punkte) ? punkte : [])
      .map(function (p) {
        return { zeit: Date.parse((p && (p.d || p.datum)) || ""), kg: zahl(p && p.kg) };
      })
      .filter(function (p) { return isFinite(p.zeit) && p.zeit >= grenze && p.zeit <= tagesGrenze(jetzt) && p.kg > 0; })
      .sort(function (a, b) { return a.zeit - b.zeit; });

    var leer = {
      punkte: liste.length, tage: 0, belastbar: false,
      istProWoche: 0, sollProWoche: 0, korrekturKcal: 0, gewichtJetzt: 0
    };
    if (liste.length < 2) return leer;

    var spanneTage = (liste[liste.length - 1].zeit - liste[0].zeit) / (24 * 60 * 60 * 1000);
    leer.tage = Math.round(spanneTage);
    leer.gewichtJetzt = liste[liste.length - 1].kg;
    if (liste.length < 3 || spanneTage < 14) return leer;

    // Ausgleichsgerade ueber (Tage seit dem ersten Punkt, Kilogramm).
    var n = liste.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) {
      var x = (liste[i].zeit - liste[0].zeit) / (24 * 60 * 60 * 1000);
      var y = liste[i].kg;
      sx += x; sy += y; sxy += x * y; sxx += x * x;
    }
    var nenner = n * sxx - sx * sx;
    if (!(Math.abs(nenner) > 0)) return leer;
    var steigung = (n * sxy - sx * sy) / nenner;      // kg je Tag
    var istProWoche = steigung * 7;

    // Soll: die Rate, die zum gewaehlten Ziel gehoert, in Kilogramm je Woche.
    var gewicht = zahl(e.gewichtKg) > 0 ? zahl(e.gewichtKg) : liste[liste.length - 1].kg;
    var rate = zahl(e.zielRateProWoche);
    var richtung = e.ziel === "abnehmen" ? -1 : e.ziel === "zunehmen" ? 1 : 0;
    var sollProWoche = richtung * gewicht * rate / 100;

    // Abweichung in Kilogramm je Woche -> Kalorien je Tag. Wer zu langsam
    // abnimmt, isst zu viel; das Vorzeichen dreht darum um.
    var abweichung = istProWoche - sollProWoche;
    var korrektur = -Math.round(abweichung * KCAL_JE_KG_FETT / 7);

    return {
      punkte: n,
      tage: Math.round(spanneTage),
      belastbar: true,
      istProWoche: runde(istProWoche, 2),
      sollProWoche: runde(sollProWoche, 2),
      korrekturKcal: korrektur,
      gewichtJetzt: liste[liste.length - 1].kg
    };
  }

  /* Der Verlauf als Bild.
     ------------------------------------------------------------------------
     Hier wird NICHT neu gerechnet, sondern nur umgerechnet: dieselben Punkte,
     dasselbe Fenster und dieselbe Ausgleichsgerade wie in `verlaufAuswerten`,
     nur in Bildkoordinaten. Die Geometrie steht trotzdem hier und nicht in
     der Oberflaeche, weil sie eine Rechnung ist und sich in Node pruefen
     laesst.

     DIE WICHTIGE ENTSCHEIDUNG IST DIE SKALA. Koerpergewicht schwankt taeglich
     um ein Kilo — Wasser, Darminhalt, Salz. Eine Achse, die sich eng um die
     Messwerte legt, macht aus 300 Gramm Rauschen einen Absturz quer durchs
     Bild. Wer das sieht, aendert seine Ernaehrung wegen nichts. Deshalb ist
     die Achse mindestens SPANNE_MIN_KG hoch: ein flacher Verlauf sieht dann
     flach aus, und das ist die ehrliche Darstellung.

     Die Gerade wird nur gezeichnet, wenn `verlaufAuswerten` sie auch
     rechnet — unter drei Wiegungen oder vierzehn Tagen bleiben nur die
     Punkte. Eine Trendlinie durch zwei Werte behauptet einen Trend, den
     niemand kennt. */

  var SPANNE_MIN_KG = 2;

  function verlaufGraph(punkte, e) {
    e = e || {};
    var breite = zahl(e.breite) > 0 ? zahl(e.breite) : 300;
    var hoehe = zahl(e.hoehe) > 0 ? zahl(e.hoehe) : 90;
    // NICHT `zahl(e.rand) >= 0 ? ... : 6` — `zahl` liefert fuer eine fehlende
    // Angabe 0, und 0 >= 0 ist wahr. Die Voreinstellung 6 war damit toter
    // Code und der Rand immer 0. Am 22.08.2026 am iPhone aufgefallen: der
    // erste Messpunkt sass exakt auf der Ecke des Bildes.
    var rand = e.rand === undefined || e.rand === null ? 6 : Math.max(0, zahl(e.rand));

    var jetzt = e.jetzt ? new Date(e.jetzt).getTime() : Date.now();
    var fenster = zahl(e.tage) > 0 ? zahl(e.tage) : VERLAUF_FENSTER_TAGE;
    var grenze = jetzt - fenster * 24 * 60 * 60 * 1000;
    var TAG = 24 * 60 * 60 * 1000;

    var liste = (Array.isArray(punkte) ? punkte : [])
      .map(function (p) {
        return { zeit: Date.parse((p && (p.d || p.datum)) || ""), kg: zahl(p && p.kg) };
      })
      .filter(function (p) { return isFinite(p.zeit) && p.zeit >= grenze && p.zeit <= tagesGrenze(jetzt) && p.kg > 0; })
      .sort(function (a, b) { return a.zeit - b.zeit; });

    var leer = { zeigen: false, punkte: [], linie: null, minKg: 0, maxKg: 0, von: "", bis: "", tage: 0 };
    if (liste.length < 2) return leer;

    var kgWerte = liste.map(function (p) { return p.kg; });
    var min = Math.min.apply(null, kgWerte);
    var max = Math.max.apply(null, kgWerte);
    var mitte = (min + max) / 2;
    var spanne = Math.max(max - min, SPANNE_MIN_KG);
    var unten = mitte - spanne / 2;
    var oben = mitte + spanne / 2;

    var vonZeit = liste[0].zeit;
    var bisZeit = liste[liste.length - 1].zeit;
    var dauer = Math.max(bisZeit - vonZeit, TAG);

    var innenB = breite - 2 * rand;
    var innenH = hoehe - 2 * rand;
    var xVon = function (zeit) { return rand + (zeit - vonZeit) / dauer * innenB; };
    // Y ist gedreht: mehr Kilogramm heisst weiter oben im Bild.
    var yVon = function (kg) { return rand + (oben - kg) / spanne * innenH; };

    // Das Datum bleibt am Punkt haengen. Es kostet nichts und ist die
    // Grundlage fuer die Zeitachse — die Oberflaeche soll es nicht aus
    // Bildkoordinaten zurueckrechnen muessen.
    var alsTag = function (zeit) { return new Date(zeit).toISOString().slice(0, 10); };
    var bild = liste.map(function (p) {
      return { x: runde(xVon(p.zeit), 1), y: runde(yVon(p.kg), 1), kg: p.kg, d: alsTag(p.zeit) };
    });

    // Dieselbe Ausgleichsgerade wie in verlaufAuswerten — und dieselbe
    // Schwelle, ab der sie ueberhaupt etwas aussagt.
    var linie = null;
    var spanneTage = (bisZeit - vonZeit) / TAG;
    if (liste.length >= 3 && spanneTage >= 14) {
      var n = liste.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (var i = 0; i < n; i++) {
        var x = (liste[i].zeit - vonZeit) / TAG;
        var y = liste[i].kg;
        sx += x; sy += y; sxy += x * y; sxx += x * x;
      }
      var nenner = n * sxx - sx * sx;
      if (Math.abs(nenner) > 0) {
        var steigung = (n * sxy - sx * sy) / nenner;
        var achse = (sy - steigung * sx) / n;
        linie = {
          x1: runde(xVon(vonZeit), 1), y1: runde(yVon(achse), 1),
          x2: runde(xVon(bisZeit), 1), y2: runde(yVon(achse + steigung * spanneTage), 1)
        };
      }
    }

    /* WAAGERECHTE HILFSLINIEN (Benjamins Wunsch 26.08.2026). Drei Niveaus —
       unten, Mitte, oben —, damit sich eine Kurve gegen etwas lesen laesst:
       ohne sie sagt ein Auf und Ab nur "es schwankt", mit ihnen sieht man,
       um wie viel. Die kg-Werte kommen mit, damit die Oberflaeche sie
       beschriften kann, ohne aus Bildkoordinaten zurueckzurechnen. */
    var raster = [unten, mitte, oben].map(function (kgWert) {
      return { y: runde(yVon(kgWert), 1), kg: runde(kgWert, 1) };
    });

    /* WIE VIELE PUNKTE GEZEICHNET WERDEN.
       ------------------------------------------------------------------
       Wer sich taeglich wiegt, hat nach sechs Wochen 42 Messungen. Bei 300
       Bildpunkten Breite liegen die dann 7 px auseinander — bei 6 px grossen
       Punkten eine geschlossene Perlenkette, in der man nichts mehr erkennt
       (nachgemessen 26.08.2026, Benjamins Frage "passt so viel in das
       Feld?"). Die LINIE bleibt vollstaendig, nur die Punkte werden
       ausgeduennt: hoechstens 16, gleichmaessig verteilt, und der erste und
       letzte sind immer dabei — sie tragen die Beschriftung der Zeitachse.
       Unter 16 Messungen aendert sich nichts. */
    var MAX_PUNKTE = 16;
    var schritt = Math.ceil(bild.length / MAX_PUNKTE);
    var sichtbar = schritt <= 1 ? bild : bild.filter(function (p, i) {
      return i % schritt === 0 || i === bild.length - 1;
    });

    return {
      zeigen: true,
      breite: breite, hoehe: hoehe,
      punkte: sichtbar,
      /* Alle Messungen — daraus zeichnet die Oberflaeche die LINIE. Getrennt
         von `punkte`, weil die Linie jede Messung kennen soll, auch wenn
         nicht jede einen Kreis bekommt. */
      alle: bild,
      ausgeduennt: schritt > 1,
      raster: raster,
      linie: linie,
      minKg: runde(unten, 1),
      maxKg: runde(oben, 1),
      von: alsTag(vonZeit),
      bis: alsTag(bisZeit),
      tage: Math.round(spanneTage)
    };
  }

  /* Das Gewicht, mit dem gerechnet wird.
     ------------------------------------------------------------------------
     Benjamins Entscheidung vom 22.08.2026: die letzte Wiegung speist die
     Rechnung. Aufgefallen war es am Geraet — sein Profil stand auf 83 kg,
     seine Wiegung vom Vortag auf 84, und der Rechner nahm die 83. Zwei
     Quellen fuer dieselbe Zahl, und die aeltere gewann.

     Die Wiegung gewinnt, WEIL sie ein Datum hat. Das Profilgewicht hat
     keines — niemand weiss, ob es von gestern oder aus dem letzten Jahr
     stammt. Deshalb gilt die Wiegung nur innerhalb des Fensters: danach ist
     auch sie nur noch eine alte Zahl, und dann ist das Profil die ehrlichere
     Angabe, weil der Nutzer es wenigstens absichtlich pflegt.

     Das Profil wird NICHT geaendert. Daran haengen Kraftstufen und Plaene,
     und die Verlaufskarte verspricht ausdruecklich "bleibt in dieser App". */
  function gewichtAusVerlauf(punkte, e) {
    e = e || {};
    var jetzt = e.jetzt ? new Date(e.jetzt).getTime() : Date.now();
    var fenster = zahl(e.tage) > 0 ? zahl(e.tage) : VERLAUF_FENSTER_TAGE;
    var grenze = jetzt - fenster * 24 * 60 * 60 * 1000;

    var liste = (Array.isArray(punkte) ? punkte : [])
      .map(function (p) {
        return { zeit: Date.parse((p && (p.d || p.datum)) || ""), kg: zahl(p && p.kg), d: (p && (p.d || p.datum)) || "" };
      })
      .filter(function (p) { return isFinite(p.zeit) && p.zeit >= grenze && p.zeit <= tagesGrenze(jetzt) && p.kg > 0; })
      .sort(function (a, b) { return a.zeit - b.zeit; });

    if (!liste.length) return null;
    var letzte = liste[liste.length - 1];
    return { kg: letzte.kg, datum: letzte.d };
  }

  /* --- Alles zusammen ------------------------------------------------------
     Eingabe:
       geschlecht, gewichtKg, groesseCm, alterJahre
       kfaProzent           (optional, direkte Angabe)
       halsCm/bauchCm/tailleCm/huefteCm (optional, Massband)
       schritte             (je Tag, OHNE das Training)
       unruhig              (optional, true/false)
       einheiten            [{kcal, minuten, proWoche} | {met, minuten, proWoche}]
       trainingQuelle       "plan" | "logs" | "manuell" (nur fuer den Hinweis)
       ziel                 "abnehmen" | "halten" | "zunehmen"
       trainingLevel        "beginner" | "regular" | "competitive"
     ------------------------------------------------------------------------ */

  function berechnen(e) {
    e = e || {};
    var gewicht = zahl(e.gewichtKg);
    var hinweise = [];

    var gu = grundumsatz(e);
    if (gu.kcal <= 0) {
      return {
        vollstaendig: false,
        hinweise: ["Für die Rechnung fehlen Angaben: Gewicht, und dazu entweder der Körperfettanteil oder Größe und Alter."]
      };
    }

    if (gu.kfa.quelle === "bild") {
      hinweise.push("Dein Körperfettanteil aus der Bilderreihe ist geschätzt — ein paar Prozentpunkte daneben sind normal. Er beeinflusst nur deine Abnehmrate, nicht den Grundumsatz.");
    } else if (gu.kfa.quelle === "schaetzung") {
      hinweise.push("Dein Körperfettanteil ist nur aus BMI und Alter geschätzt und liegt bei Trainierten meist zu hoch. Er geht deshalb nicht in den Grundumsatz ein.");
    }

    /* DIE GROESSE DES BEKANNTEN FEHLERS, beziffert statt nur benannt. */
    if (gu.formel === "mifflin-st-jeor") {
      var vergleich = tenHaaf(e);
      var abstand = vergleich > 0 ? vergleich - gu.kcal : 0;
      hinweise.push(
        "Ohne gemessenen Körperfettanteil rechnen wir nach Mifflin-St Jeor. Bei Trainierten schätzt sie zu niedrig — an 1430 Athleten gemessen" +
        (abstand > 0 ? ", bei dir um rund " + abstand + " kcal" : "") +
        ". Zwei Minuten Maßband lösen das."
      );
    }

    var ab = neat({
      gewichtKg: gewicht,
      schritte: e.schritte,
      unruhig: e.unruhig
    });

    if (ab.gedeckelt) {
      hinweise.push("Deine Schrittzahl lag über dem, was in einen Tag passt. Gerechnet haben wir mit höchstens " +
        SCHRITTE_MAX.toLocaleString("de-DE") + " Schritten.");
    }

    var at = trainingProTag(e.einheiten, gewicht);
    if (at.einheitenGeschaetzt > 0 && at.einheitenAusPlan === 0) {
      hinweise.push("Der Trainingsanteil ist geschätzt. Sobald du Einheiten loggst, rechnen wir mit dem, was du wirklich gemacht hast.");
    }
    // Woher der Trainingsanteil kommt, entscheidet ueber seine Guete — und das
    // gehoert dem Nutzer gesagt. Ein Plan sagt, was vorgesehen ist; ein Log
    // sagt, was passiert ist. Zwischen beidem liegt bei den meisten Menschen
    // eine Luecke.
    if (e.trainingQuelle === "plan" && at.kcal > 0) {
      hinweise.push("Der Trainingsanteil kommt aus deinem Plan, nicht aus absolvierten Einheiten. Er gilt, solange du den Plan auch durchziehst — sonst isst du für ein Training, das nicht stattgefunden hat.");
    }

    // Brutto minus Ruheanteil: was das Training UEBER den Grundumsatz hinaus
    // gekostet hat. Ohne Dauerangabe (Handeingabe) bleibt es beim Bruttowert
    // — dann fehlt schlicht die Grundlage fuer den Abzug.
    var ruhe = ruheanteilKcal(at.minutenProTag, gu.kcal);
    var trainingNetto = Math.max(0, at.kcal - ruhe);

    var ges = gesamtumsatz({
      grundumsatzKcal: gu.kcal,
      neatKcal: ab.kcal,
      trainingKcal: trainingNetto
    });

    var ziel = zielKalorien({
      geschlecht: e.geschlecht,
      gesamtumsatzKcal: ges.kcal,
      grundumsatzKcal: gu.kcal,
      gewichtKg: gewicht,
      ziel: e.ziel,
      kfaProzent: gu.kfa.prozent,
      kfaBelastbar: gu.kfa.belastbar,
      trainingLevel: e.trainingLevel,
      // Nur mit gemessenem Fettanteil: sonst waere die fettfreie Masse
      // geraten, und eine geratene Zahl darf die Vorgabe nicht anheben.
      magermasseKg: gu.kfa.belastbar ? gu.magermasseKg : 0,
      trainingKcal: trainingNetto
    });

    // Makros duerfen nur dann auf der Magermasse rechnen, wenn die auch
    // gemessen ist — sonst gilt dieselbe Falle wie beim Grundumsatz.
    var m = makros({
      kcal: ziel.kcal,
      gewichtKg: gewicht,
      magermasseKg: gu.kfa.belastbar ? gu.magermasseKg : 0,
      ziel: ziel.ziel,
      // Fuer den Eiweiss-Deckel ohne Messung: er braucht die
      // Deurenberg-Schaetzung und dafuer diese drei Angaben.
      geschlecht: e.geschlecht,
      groesseCm: e.groesseCm,
      alterJahre: e.alterJahre,
      // Der Kohlenhydratbedarf haengt am Trainingsumfang. Uebergeben wird der
      // BRUTTOwert der Woche: die Stufen sind an Trainingsstunden geeicht,
      // nicht am Nettozuwachs.
      trainingKcalProWoche: at.kcalProWoche
    });

    hinweise = hinweise.concat(ziel.hinweise, m.hinweise);

    /* Dieser eine Satz gilt IMMER und steht deshalb nicht in der Liste,
       sondern daneben: die Oberflaeche klappt die Liste seit dem 22.08.2026
       hinter ein Fragezeichen, und wer sie nie oeffnet, soll trotzdem
       wissen, dass die Zahl ein Startwert ist. Ihn mit den uebrigen
       Hinweisen wegzuklappen waere genau der Fehler, den das Fragezeichen
       verhindern soll. */
    var startwert = "Jede Bedarfsformel streut um rund 10 Prozent. Nimm die Zahl als Startwert und korrigiere sie nach zwei bis drei Wochen an deinem Gewichtsverlauf.";

    return {
      vollstaendig: true,
      grundumsatzKcal: gu.kcal,
      grundumsatzFormel: gu.formel,
      magermasseKg: gu.magermasseKg,
      kfa: gu.kfa,
      neatKcal: ab.kcal,
      trainingKcal: trainingNetto,
      trainingBruttoKcal: at.kcal,
      trainingRuheanteilKcal: ruhe,
      trainingKcalProWoche: at.kcalProWoche,
      tefKcal: ges.tefKcal,
      gesamtumsatzKcal: ges.kcal,
      zielKcal: ziel.kcal,
      // Das Ziel gehoert MIT ins Ergebnis: die Anzeige beschriftet die Zahl
      // danach ("Zum Abnehmen"), und die Rueckmeldung von der Waage rechnet
      // damit die Sollrichtung aus. Fehlte es, stuende ueber einem Defizit
      // stillschweigend "Zum Halten".
      ziel: ziel.ziel,
      abweichungKcal: ziel.abweichungKcal,
      rateProWoche: ziel.rateProWoche,
      kgProWoche: ziel.kgProWoche,
      untergrenzeAktiv: ziel.untergrenzeAktiv,
      energieverfuegbarkeit: ziel.energieverfuegbarkeit,
      eaAngehoben: ziel.eaAngehoben,
      eiweissG: m.eiweissG,
      fettG: m.fettG,
      khG: m.khG,
      startwert: startwert,
      anteile: {
        grundumsatz: Math.round(gu.kcal / ges.kcal * 100),
        neat: Math.round(ab.kcal / ges.kcal * 100),
        training: Math.round(trainingNetto / ges.kcal * 100),
        tef: Math.round(ges.tefKcal / ges.kcal * 100)
      },
      hinweise: hinweise
    };
  }

  return {
    kfaNavy: kfaNavy,
    kfaDeurenberg: kfaDeurenberg,
    kfaBestimmen: kfaBestimmen,
    grundumsatz: grundumsatz,
    tenHaaf: tenHaaf,
    neat: neat,
    trainingProTag: trainingProTag,
    trainingAusLogs: trainingAusLogs,
    ruheanteilKcal: ruheanteilKcal,
    gesamtumsatz: gesamtumsatz,
    zielKalorien: zielKalorien,
    zielRate: zielRate,
    makros: makros,
    khWarngrenze: khWarngrenze,
    verlaufAuswerten: verlaufAuswerten,
    verlaufGraph: verlaufGraph,
    gewichtAusVerlauf: gewichtAusVerlauf,
    VERLAUF_FENSTER_TAGE: VERLAUF_FENSTER_TAGE,
    SPANNE_MIN_KG: SPANNE_MIN_KG,
    KCAL_UNRUHE_PAUSCHALE: KCAL_UNRUHE_PAUSCHALE,
    berechnen: berechnen,
    KCAL_JE_G: KCAL_JE_G,
    KCAL_JE_KG_FETT: KCAL_JE_KG_FETT,
    TEF_ANTEIL: TEF_ANTEIL,
    EA_HINWEIS: EA_HINWEIS,
    EA_UNTERGRENZE: EA_UNTERGRENZE,
    ABNEHM_RATEN: ABNEHM_RATEN,
    AUFBAU_RATEN: AUFBAU_RATEN,
    EIWEISS_JE_KG_LBM: EIWEISS_JE_KG_LBM,
    EIWEISS_MAX_JE_KG_LBM_GESCHAETZT: EIWEISS_MAX_JE_KG_LBM_GESCHAETZT,
    FETT_MIN_JE_KG: FETT_MIN_JE_KG,
    KCAL_JE_SCHRITT_JE_KG: KCAL_JE_SCHRITT_JE_KG
  };
});
