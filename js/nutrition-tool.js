/* =========================================================================
   KALORIENRECHNER — Oberflaeche. Gerechnet wird in js/nutrition-calc.js.
   -------------------------------------------------------------------------
   Die Trennung ist Absicht: der Kern kennt kein DOM und ist darum in Node
   testbar (tests/nutrition-calc.test.mjs). Hier steht nur, was der Nutzer
   eingibt und wie das Ergebnis aussieht.

   ZWEI SACHEN MACHT DIESES WERKZEUG ANDERS als die Rechner im Netz:

   1. Der Trainingsanteil wird NICHT geschaetzt. TrainLogic kennt die
      absolvierten Einheiten samt Kalorienschaetzung — die letzten vier
      Wochen aus dem Log ergeben den Tagesdurchschnitt. Wer nichts geloggt
      hat, traegt eine Zahl von Hand ein; das ist der Rueckfall, nicht der
      Normalfall.

   2. Die Bildauswahl gilt ausdruecklich als SCHAETZUNG. Der Kern rechnet
      den Grundumsatz dann ohne sie (Mifflin-St Jeor statt Katch-McArdle).
      Wer es genauer will, nimmt das Massband.
   ========================================================================= */
(function () {
  "use strict";

  /* Die Baender der Bilderleiter. Der Wert ist die Mitte des Bandes und
     wandert als Schaetzung in die Rechnung. */
  const LEITER = {
    frau: [
      { band: "10-14 %", wert: 12 }, { band: "15-20 %", wert: 17.5 }, { band: "20-22 %", wert: 21 },
      { band: "23-29 %", wert: 26 }, { band: "30-34 %", wert: 32 },   { band: "35-39 %", wert: 37 },
      { band: "40-44 %", wert: 42 }, { band: "45-49 %", wert: 47 },   { band: "50 % +", wert: 52 }
    ],
    mann: [
      { band: "3-4 %", wert: 3.5 },  { band: "6-7 %", wert: 6.5 },  { band: "10-12 %", wert: 11 },
      { band: "15 %", wert: 15 },    { band: "20 %", wert: 20 },    { band: "25 %", wert: 25 },
      { band: "30 %", wert: 30 },    { band: "35 %", wert: 35 },    { band: "40 %", wert: 40 }
    ]
  };

  /* Aktivitaeten fuer alles, was NICHT in TrainLogic geloggt wird — der
     Dienstagabend-Fussball, die Radtour, das Schwimmbad.

     WARUM UEBERHAUPT: Vorher fragte dieser Weg nach "Trainingsverbrauch in
     kcal pro Woche". Das ist genau die Rateraufgabe, die dieser Rechner den
     Rechnern im Netz vorwirft — niemand weiss, was seine Radtour gekostet
     hat. Aktivitaet, Dauer und Haeufigkeit weiss dagegen jeder.

     NEBENBEI HEILT DAS EINEN ZWEITEN FEHLER: aus der Dauer laesst sich der
     Ruheanteil abziehen (siehe ruheanteilKcal im Kern). Eine reine
     Kalorienangabe ohne Dauer konnte das nicht — sie blieb brutto.

     DIE MET-WERTE stammen aus dem Compendium of Physical Activities; das ist
     die Sammlung, aus der alle diese Listen kommen. Ein MET ist der
     Ruheumsatz, 8 MET also der achtfache. Die Auswahl und die Beschriftungen
     sind unsere: sie decken ab, was TrainLogic-Nutzer neben ihrem Training
     tatsaechlich machen. */
  /* Seit Pruefrunde 3 (15.11.2026) verweisen die Zeilen auf js/aktivitaet-katalog.js
     (k: [Katalog-id, Stufe]) — vorher fuehrte der Rechner eigene Werte, die
     vom Blatt "Sport eintragen" abwichen (Rudern 150 W: 8,5 hier, 11 dort).
     Wo der Katalog keine passende Stufe hat, steht der Wert mit
     Compendium-Code direkt da. Rudern rechnet aus der Leistung (watt +
     formel, nutrition-calc.js kcalAusLeistung). NAMEN NICHT AENDERN: aus
     ihnen entstehen die gemerkten Schluessel (artSchluessel). */
  const KAT = window.AktivitaetKatalog;
  const z = (name, k) => { const st = KAT.stufe(k[0], k[1]); return { met: st.met, code: st.code, name }; };
  const zm = (name, met, code) => ({ met, code, name });
  const zw = (name, k, watt) => Object.assign(z(name, k), { watt, formel: "rudern" });
  const AKTIVITAETEN = [
    { gruppe: "Kraft und Fitness", eintraege: [
      zm("Krafttraining, locker", 3.5, "02054"),
      zm("Krafttraining, zügig", 5.0, "02052"),
      zm("Krafttraining, schwer", 6.0, "02050"),
      z("Zirkeltraining / Metcon", ["zirkel", 2]),
      z("Seilspringen", ["seil", 0]),
      z("Yoga", ["yoga", 0]),
      z("Pilates / Mobility", ["pilates", 0])
    ]},
    { gruppe: "Laufen", eintraege: [
      z("Laufen, 8 km/h", ["laufen", 1]),
      z("Laufen, 10 km/h", ["laufen", 2]),
      z("Laufen, 11 km/h", ["laufen", 3]),
      z("Laufen, 13 km/h", ["laufen", 5]),
      z("Laufen, 14,5 km/h", ["laufen", 6]),
      z("Laufen, 16 km/h", ["laufen", 7]),
      z("Wandern", ["wandern", 2]),
      z("Wandern mit Gepäck", ["wandern", 3])
    ]},
    { gruppe: "Rad und Ergometer", eintraege: [
      z("Radfahren, 16-19 km/h", ["rad", 0]),
      z("Radfahren, 19-22 km/h", ["rad", 1]),
      z("Radfahren, 22-25 km/h", ["rad", 2]),
      z("Rennrad, 25-30 km/h", ["rad", 3]),
      zm("Rennrad, über 32 km/h", 16.8, "01060"),
      zw("Rudern, locker (50 W)", ["rudern", 0], 50),
      zw("Rudern, moderat (100 W)", ["rudern", 1], 100),
      zw("Rudern, anstrengend (150 W)", ["rudern", 2], 150),
      zw("Rudern, hart (200 W)", ["rudern", 3], 200)
    ]},
    { gruppe: "Wasser", eintraege: [
      z("Schwimmen, locker", ["schwimmen", 1]),
      z("Schwimmen, zügig", ["schwimmen", 2]),
      z("Kraul, schnell", ["schwimmen", 3])
    ]},
    { gruppe: "Ballsport", eintraege: [
      z("Fußball, Freizeit", ["fussball", 0]),
      z("Fußball, Wettkampf", ["fussball", 1]),
      zm("Handball, Freizeit", 8.0, "15330"),
      // Kein eigener Wettkampfwert im Compendium; wie Fussball Wettkampf.
      zm("Handball, Wettkampf", 9.5, "15330"),
      z("Basketball, locker", ["basketball", 0]),
      z("Basketball, Wettkampf", ["basketball", 2]),
      z("Tennis, Einzel", ["tennis", 1]),
      z("Tennis, Doppel", ["tennis", 0]),
      z("Squash", ["squash", 0]),
      z("Badminton", ["badminton", 0]),
      z("Volleyball", ["volleyball", 0])
    ]},
    { gruppe: "Kampfsport", eintraege: [
      z("Boxen, Sandsack", ["boxsack", 0]),
      zm("Boxen, Sparring", 7.8, "15120"),
      zm("Boxen, Wettkampf", 12.8, "15110"),
      z("Judo / Karate / Kickboxen", ["kampfsport", 1]),
      zm("Ringen / Grappling", 6.0, "15730")
    ]},
    { gruppe: "Draußen und Sonstiges", eintraege: [
      z("Bouldern", ["klettern", 0]),
      z("Klettern am Fels", ["klettern", 2]),
      z("Skifahren", ["ski", 1]),
      z("Skilanglauf", ["langlauf", 1]),
      z("Reiten", ["reiten", 0]),
      z("Tanzen", ["tanzen", 1]),
      z("Golf, zu Fuß", ["golf", 0]),
      z("Zügig gehen", ["spazieren", 3])
    ]}
  ];

  /* Der Schluessel einer Aktivitaet.
     ------------------------------------------------------------------------
     WARUM ES IHN GIBT: bis zum 22.08.2026 trug das Auswahlfeld als `value`
     nur den MET-Wert. Der ist aber keine Kennung, sondern eine Eigenschaft —
     und 14 der Werte teilen sich mehrere Sportarten. Wer "Handball,
     Freizeit" waehlte, las beim naechsten Neuzeichnen "Basketball,
     Wettkampf": beide stehen bei MET 8, und gesucht wurde die erste Option
     mit passendem Wert. Gerechnet wurde richtig — gleicher MET, gleiche
     Kalorien —, aber wer Handball waehlt und Basketball liest, glaubt der
     App kein Wort mehr.

     Der Schluessel kommt aus dem NAMEN, nicht aus der Position: ein Index
     wuerde jede gemerkte Eingabe verschieben, sobald jemand eine Zeile in
     die Liste einfuegt. Die Namen sind eindeutig (ein Test sichert das),
     also sind es die Schluessel auch. Ein Test haelt ausserdem die fertige
     Schluesselliste fest — wer einen Namen aendert, sieht dann schwarz auf
     weiss, dass gemerkte Eingaben darauf zeigen. */
  function artSchluessel(name) {
    return String(name).toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  AKTIVITAETEN.forEach((g) => g.eintraege.forEach((e) => { e.art = artSchluessel(e.name); }));

  const ALLE_AKTIVITAETEN = AKTIVITAETEN.reduce((liste, g) => liste.concat(g.eintraege), []);

  function aktivitaetZuArt(art) {
    if (!art) return null;
    return ALLE_AKTIVITAETEN.find((e) => e.art === String(art)) || null;
  }

  /* Was vor dem 22.08.2026 gemerkt wurde, steht als `met: "8"` im Speicher.
     Diese Eintraege sollen nicht verlorengehen, also wird der Schluessel
     einmalig nachgetragen: die erste Aktivitaet mit diesem MET. Das ist
     genau das Raten, das oben der Fehler war — hier aber unvermeidbar, denn
     die Information, WELCHE der Sportarten gemeint war, wurde nie
     gespeichert. Es passiert einmal je Altbestand: `openNutritionOverlay`
     schreibt das Ergebnis sofort zurueck (siehe `schluesselFehlt`), danach
     steht ein eindeutiger Schluessel da. */
  function aktivitaetAusAltbestand(met) {
    const wert = Number(met);
    if (!(wert > 0)) return null;
    return ALLE_AKTIVITAETEN.find((e) => e.met === wert) || null;
  }

  /* Eine Zeile in die Form bringen, in der der Rest des Werkzeugs sie
     erwartet: `art` ist der Schluessel, `met` die daraus abgeleitete Zahl
     fuer den Kern. `met` wird NIE aus dem Speicher uebernommen, sondern immer
     aus der Liste geholt — sonst koennte eine korrigierte MET-Zahl in alten
     Eingaben stehenbleiben. */
  function aktivitaetZeile(a) {
    a = a || {};
    const treffer = aktivitaetZuArt(a.art) || aktivitaetAusAltbestand(a.met);
    return {
      art: treffer ? treffer.art : "",
      met: treffer ? treffer.met : "",
      ...(treffer && treffer.watt ? { watt: treffer.watt, formel: treffer.formel } : {}),
      minuten: a.minuten === undefined || a.minuten === null ? "" : a.minuten,
      proWoche: a.proWoche === undefined || a.proWoche === null ? "1" : a.proWoche
    };
  }

  const LEERE_AKTIVITAET = () => ({ art: "", met: "", minuten: "", proWoche: "1" });

  /* Steht im Speicher noch eine Zeile ohne gueltigen Schluessel, aber mit
     brauchbarem MET, dann hat `aktivitaetZeile` geraten. Das Ergebnis muss
     zurueckgeschrieben werden, sonst wird bei JEDEM Oeffnen neu geraten — und
     die Antwort haengt an der Reihenfolge der Liste. Heute stabil; sobald
     jemand eine Aktivitaet mit demselben MET weiter oben einfuegt, spraenge
     jeder Altbestand auf eine andere Sportart. Einmal gespeichert, friert die
     Zuordnung ein. */
  function schluesselFehlt(liste) {
    return (Array.isArray(liste) ? liste : []).some(
      (a) => a && !aktivitaetZuArt(a.art) && Number(a.met) > 0
    );
  }

  /* Zuegiges Gehen steckt bei fast jedem schon in der Schrittzahl. Wer es
     hier NOCH einmal eintraegt, zaehlt es doppelt — derselbe Fehler, den der
     Abzug bei den Uhrschritten verhindert. Der Hinweis haengt seit dem
     22.08.2026 am Schluessel statt am MET-Wert: 4,3 ist heute eindeutig, aber
     das ist Zufall und kein Schutz. Ein Test prueft, dass dieser Schluessel
     eine echte Aktivitaet trifft — sonst waere der Hinweis stiller toter
     Code. */
  const GEHEN_ART = "zuegig-gehen";

  /* WEBSEITE: derselbe Rechner laeuft auch auf fitnessdoneright.de
     (docs/website/kalorienrechner). Dort gibt es kein Profil, keine Logs und
     keinen Plan — die Seite setzt vor dem Laden `window.NutritionToolWeb`,
     und dann fragt der Rechner die Koerperdaten selbst ab, rechnet das
     Training nur ueber die Aktivitaetenliste und fragt beim Aufbauen nach
     dem Trainingsstand. In der App ist WEB immer false. */
  const WEB = !!window.NutritionToolWeb;

  const SPEICHER = "tl_nutrition_eingaben";
  /* Die Angaben, mit denen der Kalorienzaehler (js/ernaehrung.js) seine
     Tagesbilanz rechnet — getrennt von SPEICHER, der jede Eingabe im Rechner
     sofort mitschreibt. Benjamin 14.11.2026: "Wenn jemand den Kalorienrechner
     neu ausfuellt, soll er gefragt werden, ob die neuen Daten fuer die Bilanz
     uebernommen werden sollen." Also darf man im Rechner herumprobieren, ohne
     dass sich die Bilanz still mitaendert. { werte: {...}, stand: "JJJJ-MM-TT" } */
  const BILANZ = "tl_nutrition_bilanz";
  const BILANZ_FELDER = ["geschlecht", "gewichtKg", "groesseCm", "alterJahre", "trainingLevel",
    "kfaWeg", "kfaBild", "kfaEingabe", "halsCm", "bauchCm", "tailleCm", "huefteCm",
    "schritte", "unruhig", "trainingWeg", "aktivitaeten", "ziel"];
  const VERLAUF = "tl_gewicht_verlauf";

  let zustand = null;

  /* --- Daten aus der App ---------------------------------------------------- */

  function profil() {
    try { return JSON.parse(localStorage.getItem("profile") || "{}"); }
    catch (err) { return {}; }
  }

  function logs() {
    try {
      const roh = localStorage.getItem("tl_workout_logs") || localStorage.getItem("workoutLogs") || "[]";
      const liste = JSON.parse(roh);
      return Array.isArray(liste) ? liste : [];
    } catch (err) { return []; }
  }

  function plan() {
    try { return JSON.parse(localStorage.getItem("tl_plan_v1") || "null"); }
    catch (err) { return null; }
  }

  /* Der Trainingsanteil der GEPLANTEN Woche. Gerechnet wird er nicht hier,
     sondern in plan-tab.js — dort steht der Weg von einer geplanten Einheit
     zur Kalorienzahl schon (Zeitgeruest, Pausen, CalorieEstimator), und
     genau denselben Weg zeigt die App beim Loggen als Vorschau an. Was hier
     steht, ist also dieselbe Zahl, die der Nutzer an der Einheit sieht. */
  function ausPlan() {
    const p = window.TrainLogicPlanTab && window.TrainLogicPlanTab.geplanteWocheKcal;
    if (!p) return { vollstaendig: false, grund: "Plan-Reiter nicht geladen" };
    try { return p(plan(), 0); }
    catch (err) { return { vollstaendig: false, grund: "Schätzung fehlgeschlagen" }; }
  }

  /* Der Gewichtsverlauf. Ein Eintrag je Tag, der letzte gewinnt — wer sich
     morgens und abends wiegt, soll nicht zwei Punkte fuer denselben Tag
     erzeugen und damit die Ausgleichsgerade an einem Tag festnageln. */
  function verlauf() {
    // Die Webseite fuehrt keinen Verlauf (Benjamin, 29.09.2026): gespeichert
    // wird er nur in der App.
    if (WEB) return [];
    try {
      const liste = JSON.parse(localStorage.getItem(VERLAUF) || "[]");
      return Array.isArray(liste) ? liste : [];
    } catch (err) { return []; }
  }

  /* Der heutige Tag nach der Uhr des Nutzers, nicht nach UTC.
     ------------------------------------------------------------------------
     `new Date().toISOString().slice(0, 10)` liefert das UTC-Datum. In
     Mitteleuropa ist das zwischen Mitternacht und zwei Uhr der VORTAG — am
     22.08.2026 um 00:08 MESZ kam "2026-08-21" heraus. Wer sich nachts wiegt,
     haette damit nicht nur einen falschen Tag bekommen, sondern die Wiegung
     des Vortages UEBERSCHRIEBEN: es gilt ein Eintrag je Tag, der letzte
     gewinnt. Aufgefallen, weil waehrend eines Testlaufs Mitternacht war. */
  /* --- Uebernommene Anpassung aus dem Gewichtsverlauf (18.11.2026) ----------
     Benjamin: "die beste App in diesem Bereich". Der Abgleich mit der Waage
     (verlaufAuswerten) riet bisher nur — "nimm rund 120 kcal weniger" — und
     das Ziel blieb, wie es war. Jetzt laesst sich der Rat uebernehmen:
     { kcal: Summe aller Schritte, seit: Tag des letzten Schritts }.
     Die Summe ist auf 500 kcal begrenzt (mehr als das ist kein Formelfehler
     mehr, sondern falsches Eintragen). Nach einem Schritt zaehlen nur noch
     Wiegungen ab diesem Tag (datenAb), der naechste Rat kommt also
     fruehestens nach drei Wochen. Nur auf dem Geraet. */
  const KORREKTUR = "tl_bedarf_korrektur_v1";
  const KORREKTUR_MAX = 500;
  function korrekturGemerkt() {
    try {
      const k = JSON.parse(localStorage.getItem(KORREKTUR) || "null");
      if (k && typeof k === "object" && isFinite(k.kcal)) return { kcal: Math.max(-KORREKTUR_MAX, Math.min(KORREKTUR_MAX, Math.round(Number(k.kcal)))), seit: typeof k.seit === "string" ? k.seit : null };
    } catch (err) { /* kaputt: keine Anpassung */ }
    return { kcal: 0, seit: null };
  }
  function korrekturUebernehmen(kcal) {
    const alt = korrekturGemerkt();
    const neu = Math.max(-KORREKTUR_MAX, Math.min(KORREKTUR_MAX, alt.kcal + Math.round(Number(kcal) || 0)));
    try { localStorage.setItem(KORREKTUR, JSON.stringify({ kcal: neu, seit: heutigerTag() })); } catch (err) { /* voll */ }
    return neu;
  }
  function korrekturZuruecknehmen() {
    try { localStorage.removeItem(KORREKTUR); } catch (err) { /* egal */ }
  }
  /* --- Bedarf je Tag einfrieren (Benjamin 18.11.2026 "ja") -------------------
     Woche und Monat rechneten vergangene Tage mit den Angaben von HEUTE:
     nach einer neuen Wiegung oder einem Zielwechsel hiess es fuer dieselben
     Tage "0 von 6 im Zielbereich" statt "5 von 6" (Pruefung 18.11.2026).
     Gemerkt wird nicht jeder Tag, sondern jede AENDERUNG: eine Liste von
     { ab: Tag, werte: Angaben der Bilanz, korr: uebernommene Anpassung }.
     Fuer einen vergangenen Tag gilt der letzte Eintrag mit ab <= Tag; Tage
     vor dem ersten Eintrag nehmen den ersten (aelter weiss es niemand).
     Der Sport des Tages kommt weiter frisch aus den Logs. Nur auf dem Geraet. */
  const BEDARF_VERLAUF = "tl_bedarf_verlauf_v1";
  const BEDARF_VERLAUF_MAX = 120;
  function bedarfVerlauf() {
    try { const l = JSON.parse(localStorage.getItem(BEDARF_VERLAUF) || "[]"); return Array.isArray(l) ? l.filter((x) => x && typeof x.ab === "string" && x.werte) : []; }
    catch (err) { return []; }
  }
  // Haelt den Stand von heute fest, wenn er sich vom letzten Eintrag unterscheidet.
  function bedarfVerlaufFortschreiben(werte, korr) {
    const heute = heutigerTag();
    const l = bedarfVerlauf();
    const letzter = l[l.length - 1];
    if (letzter && bilanzGleich(letzter.werte, werte) && Number(letzter.korr || 0) === Number(korr || 0)) return;
    const neu = { ab: heute, werte: JSON.parse(JSON.stringify(werte)), korr: Number(korr || 0) };
    if (letzter && letzter.ab === heute) l[l.length - 1] = neu; else l.push(neu);
    try { localStorage.setItem(BEDARF_VERLAUF, JSON.stringify(l.slice(-BEDARF_VERLAUF_MAX))); } catch (err) { /* voll: dann eben ohne */ }
  }
  function bedarfAmTag(tag) {
    const l = bedarfVerlauf();
    if (!l.length) return null;
    let treffer = l[0];
    for (const x of l) { if (x.ab <= tag) treffer = x; else break; }
    return treffer;
  }

  /* Der Abgleich mit der Waage fuer ein Rechenergebnis r — eine Stelle fuer
     den Rechner ("Wie es wirklich laeuft") und den Kalorienzaehler. Das Ziel
     ist das GELTENDE, also mit der uebernommenen Anpassung. */
  function verlaufStandFuer(r) {
    let aufnahme = [];
    try { if (!WEB && window.TrainLogicErnaehrung?.freigegeben?.()) aufnahme = window.TrainLogicErnaehrung.aufnahmeTage?.() || []; } catch (err) { /* ohne Zaehler */ }
    const gemerkt = WEB ? null : bilanzGemerkt();
    const k = WEB ? { kcal: 0, seit: null } : korrekturGemerkt();
    const stand = window.NutritionCalc.verlaufAuswerten(verlauf(), {
      ziel: r.ziel, zielRateProWoche: r.rateProWoche, gewichtKg: zustand.gewichtKg,
      zielSeit: gemerkt && gemerkt.werte && gemerkt.werte.ziel === r.ziel ? gemerkt.zielSeit : null,
      datenAb: k.seit,
      aufnahme, zielKcal: r.zielKcal + k.kcal, abweichungKcal: r.abweichungKcal
    });
    // Mehr als die Grenze laesst sich nicht uebernehmen: den Rat darauf stutzen.
    if (stand.deutlich) {
      const moeglich = Math.max(-KORREKTUR_MAX, Math.min(KORREKTUR_MAX, k.kcal + stand.korrekturKcal)) - k.kcal;
      if (moeglich === 0) stand.deutlich = false;
      stand.korrekturKcal = moeglich;
    }
    stand.uebernommenKcal = k.kcal;
    stand.uebernommenSeit = k.seit;
    stand.zielKcal = r.zielKcal + k.kcal;
    return stand;
  }
  /* Fuer den Kalorienzaehler: derselbe Abgleich mit den uebernommenen
     Angaben der Bilanz. null, solange der Rechner nicht eingerichtet ist. */
  function verlaufStand() {
    const C = window.NutritionCalc;
    if (!C || WEB) return null;
    const vorher = zustand;
    try {
      zustand = zustandAufbauen();
      const b = bilanzGemerkt();
      if (!b) return null;
      zustand = Object.assign({}, zustand, b.werte);
      const r = C.berechnen(eingabeBauen());
      if (!r.vollstaendig) return null;
      return verlaufStandFuer(r);
    } catch (err) { return null; } finally { zustand = vorher; }
  }

  function bilanzWerte(z) {
    const w = {};
    for (const f of BILANZ_FELDER) w[f] = z[f] === undefined ? null : JSON.parse(JSON.stringify(z[f]));
    return w;
  }
  function bilanzGemerkt() {
    try { const b = JSON.parse(localStorage.getItem(BILANZ) || "null"); return b && b.werte ? b : null; }
    catch (err) { return null; }
  }
  /* zielSeit (Pruefrunde 3): seit wann das Ziel gilt. Die ersten 14 Tage
     danach wertet der Abgleich mit der Waage nicht — Glykogen und Wasser. Bei
     unveraendertem Ziel bleibt das alte Datum; Altbestand ohne Datum bleibt
     ohne Sperre. Das ERSTE Uebernehmen ist kein Zielwechsel (15.11.2026,
     mit der Freigabe fuer alle gefunden): wer schon wochenlang wiegt und den
     Zaehler zum ersten Mal einrichtet, sah die Rueckmeldung der Waage sonst
     14 Tage lang nicht mehr. */
  function bilanzMerken(werte) {
    const alt = bilanzGemerkt();
    const zielSeit = !alt ? null : alt.werte && alt.werte.ziel === werte.ziel ? (alt.zielSeit || null) : heutigerTag();
    try { localStorage.setItem(BILANZ, JSON.stringify({ werte, stand: heutigerTag(), zielSeit })); }
    catch (err) { /* voller Speicher: die Bilanz bleibt beim alten Stand */ }
  }
  // "83" und 83 sind dieselbe Angabe; Felder tippen Text, Knoepfe setzen Zahlen.
  function bilanzGleich(a, b) {
    const norm = (w) => JSON.stringify(w, (k, v) => (typeof v === "number" ? String(v) : v));
    return norm(a) === norm(b);
  }
  /* Rechnet mit fremden Angaben, ohne den Zustand des Formulars anzufassen. */
  function mitWerten(werte, fn) {
    const vorher = zustand;
    try { zustand = Object.assign({}, zustand, werte); return fn(); }
    finally { zustand = vorher; }
  }

  /* Nach "Berechnen": gilt das fuer die Bilanz? Nur wenn der Kalorienzaehler
     fuer dieses Konto freigeschaltet ist — sonst gibt es keine Bilanz. Beim
     ersten Mal wird ohne Frage uebernommen (das IST die Einrichtung). */
  function bilanzFrage(r) {
    if (WEB || !r.vollstaendig || !window.TrainLogicErnaehrung?.freigegeben?.()) return "";
    const neu = bilanzWerte(zustand);
    const alt = bilanzGemerkt();
    if (!alt) {
      bilanzMerken(neu);
      window.TrainLogicErnaehrung.profilKarteAktualisieren?.();
      return `<div class="nut-card nut-bilanz" id="nutBilanz"><div class="nut-hinweis"><b>Für deine Tagesbilanz übernommen.</b> Im Profil siehst du jetzt jeden Tag, was noch frei ist.</div></div>`;
    }
    if (bilanzGleich(alt.werte, neu)) return "";
    const altZiel = mitWerten(alt.werte, () => window.NutritionCalc.berechnen(eingabeBauen()));
    const vergleich = altZiel.vollstaendig && altZiel.zielKcal !== r.zielKcal
      ? ` Bisher rechnet sie mit <b>${altZiel.zielKcal} kcal</b>, neu wären es <b>${r.zielKcal} kcal</b> (bei durchschnittlichem Training).`
      : "";
    return `<div class="nut-card nut-bilanz" id="nutBilanz">
      <div class="nut-card-title">Für die Tagesbilanz übernehmen?</div>
      <div class="nut-hinweis">Deine Bilanz im Profil nutzt noch die Angaben vom <b>${kurzesDatum(alt.stand)}</b>.${vergleich}</div>
      <div class="nut-bilanz-knoepfe">
        <button type="button" class="secondary-btn" id="nutBilanzNein">Alte behalten</button>
        <button type="button" class="primary-btn" id="nutBilanzJa">Übernehmen</button>
      </div></div>`;
  }

  function bilanzGewicht(kg) {
    if (WEB || !window.TrainLogicErnaehrung?.freigegeben?.()) return;
    const b = bilanzGemerkt();
    if (!b) return;
    b.werte.gewichtKg = kg;
    try { localStorage.setItem(BILANZ, JSON.stringify(b)); } catch (err) { /* bleibt beim alten Stand */ }
    window.TrainLogicErnaehrung.profilKarteAktualisieren?.();
  }

  function heutigerTag() {
    const d = new Date();
    const zwei = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
  }

  function verlaufEintragen(kg) {
    const wert = Number(String(kg).replace(",", "."));
    if (!(wert > 20 && wert < 400)) return false;
    const heute = heutigerTag();
    const liste = verlauf().filter((p) => p && p.d !== heute);
    liste.push({ d: heute, kg: Math.round(wert * 10) / 10 });
    liste.sort((a, b) => String(a.d).localeCompare(String(b.d)));
    try { localStorage.setItem(VERLAUF, JSON.stringify(liste.slice(-400))); }
    catch (err) { return false; }
    return true;
  }

  function gemerkt() {
    try { return JSON.parse(localStorage.getItem(SPEICHER) || "{}"); }
    catch (err) { return {}; }
  }

  function merken() {
    try { localStorage.setItem(SPEICHER, JSON.stringify(zustand)); }
    catch (err) { /* voller Speicher darf den Rechner nicht anhalten */ }
  }

  function vorgabeTrainingWeg() {
    const ausLogs = window.NutritionCalc.trainingAusLogs(logs(), {});
    if (ausLogs.einheiten > 0) return "logs";
    return ausPlan().vollstaendig ? "plan" : "manuell";
  }

  function zustandAufbauen() {
    // Auf der Webseite steht das Profil in den gemerkten Eingaben selbst.
    const alt = gemerkt();
    const p = WEB ? {
      gender: alt.geschlecht === "frau" ? "female" : "male",
      weightKg: alt.gewichtKg, heightCm: alt.groesseCm, age: alt.alterJahre,
      trainingLevel: alt.trainingLevel
    } : profil();
    // Koerperdaten kommen IMMER frisch aus dem Profil: wer dort sein Gewicht
    // pflegt, will es hier nicht doppelt pflegen. Alles andere ist eine
    // Angabe, die es nur hier gibt, und wird gemerkt.
    /* Das Gewicht kommt aus der letzten Wiegung, wenn es eine gibt — der
       Rest der Koerperdaten weiter aus dem Profil. Benjamins Entscheidung
       vom 22.08.2026, aufgefallen am Geraet: Profil 83 kg, Wiegung vom
       Vortag 84 kg, gerechnet wurde mit 83. Die Regel selbst steht im Kern
       (`gewichtAusVerlauf`), damit sie in Node pruefbar ist. */
    const ausWiegung = window.NutritionCalc.gewichtAusVerlauf(verlauf(), {});

    return {
      geschlecht: String(p.gender || "male").toLowerCase().indexOf("f") === 0 ? "frau" : "mann",
      gewichtKg: ausWiegung ? ausWiegung.kg : (Number(p.weightKg || p.weight || 0) || ""),
      gewichtVonWiegung: ausWiegung ? ausWiegung.datum : "",
      groesseCm: Number(p.heightCm || p.height || 0) || "",
      // Ein Geburtstag schlaegt das gespeicherte Alter (js/geburtstag.js).
      alterJahre: (window.TLGeburtstag ? window.TLGeburtstag.alterAusProfil(p) : Number(p.age || p.ageYears || 0)) || "",
      geburtstag: WEB ? "" : (p.geburtstag || ""),
      trainingLevel: p.trainingLevel || "regular",

      kfaWeg: alt.kfaWeg || "bild",
      kfaBild: typeof alt.kfaBild === "number" ? alt.kfaBild : null,
      kfaEingabe: alt.kfaEingabe || "",
      halsCm: alt.halsCm || "", bauchCm: alt.bauchCm || "",
      tailleCm: alt.tailleCm || "", huefteCm: alt.huefteCm || "",

      schritte: alt.schritte || 7000,
      unruhig: alt.unruhig === true,

      // Voreinstellung nach dem, was wirklich da ist: geloggte Einheiten sind
      // die beste Grundlage, ein Plan die zweitbeste. Wer weder noch hat,
      // landet gleich bei der Handeingabe statt vor einer leeren Karte.
      trainingWeg: WEB ? "manuell" : (alt.trainingWeg || vorgabeTrainingWeg()),
      aktivitaeten: Array.isArray(alt.aktivitaeten) && alt.aktivitaeten.length
        ? alt.aktivitaeten.map(aktivitaetZeile)
        : [LEERE_AKTIVITAET()],

      ziel: alt.ziel || "halten",
      // Nicht gemerkt: eine Wiegung von gestern gehoert nicht in das Feld
      // fuer heute.
      gewichtHeute: ""
    };
  }

  /* --- Bausteine ------------------------------------------------------------ */

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function wahl(feld, optionen, aktiv) {
    return `<div class="nut-choice">` + optionen.map((o) =>
      `<button type="button" data-feld="${feld}" data-wert="${esc(o.wert)}" aria-pressed="${o.wert === aktiv}">${esc(o.text)}</button>`
    ).join("") + `</div>`;
  }

  /* ZAHLENFELDER SIND HIER type="text".
     Mit type="number" laesst sich auf einem deutschen Geraet KEIN Komma
     eingeben: die Zifferntastatur liefert "83,4", der Browser haelt das fuer
     ungueltig und gibt einen leeren Wert zurueck — die Eingabe verschwindet
     also spurlos. Dieselbe Falle wie beim Doppelpunkt in der Zeiteingabe des
     Plans. `inputmode="decimal"` holt trotzdem die Zifferntastatur, und
     zahl() im Rechenkern nimmt Komma wie Punkt. */
  function feld(name, beschriftung, wert, zusatz) {
    return `<div class="profile-field"><label for="nut-${name}">${esc(beschriftung)}</label>` +
      `<input id="nut-${name}" type="text" inputmode="decimal" autocomplete="off" data-feld="${name}" value="${esc(wert)}" ${zusatz || ""}></div>`;
  }

  /* Erklaerungen hinter einem Fragezeichen.
     ------------------------------------------------------------------------
     Die Karte "Alltag" hatte drei Hinweisabsaetze unter zwei Eingaben. Genau
     diese Textmenge hat am 22.08.2026 den 91.303-kcal-Fehler ausgeloest: bei
     so vielen Zeilen ist nicht mehr zu erkennen, welcher Absatz zu welchem
     Feld gehoert. Wer die Erklaerung will, tippt auf das Fragezeichen.

     Der Aufklappzustand liegt in einem Set und NICHT im gemerkten Zustand:
     `zeichnen()` baut die Karte bei jedem Haken neu auf, eine offene
     Erklaerung soll dabei offen bleiben — aber sie gehoert nicht in den
     localStorage, wo die Eingaben des Nutzers stehen. Gefuellt wird das Set
     in `zeichnen()` direkt aus dem DOM, siehe die Begruendung dort. */
  const offeneHilfen = new Set();

  /* Den Aufklappzustand aus dem DOM lesen, BEVOR er ueberschrieben wird.
     Frueher stand das in einem `toggle`-Zuhoerer — aber `toggle` feuert
     asynchron: am 22.08.2026 am iPhone gemessen war das Set beim Neuzeichnen
     noch leer, und die gerade geoeffnete Erklaerung klappte wieder zu. Der
     Browsertest hatte das nicht gesehen, weil dort 150 ms Wartezeit
     dazwischenlagen. */
  function hilfenMerken(behaelter) {
    if (!behaelter) return;
    behaelter.querySelectorAll("details[data-hilfe]").forEach((d) => {
      if (d.open) offeneHilfen.add(d.dataset.hilfe);
      else offeneHilfen.delete(d.dataset.hilfe);
    });
  }

  function hilfe(name, html) {
    return `<details class="nut-hilfe" data-hilfe="${name}"${offeneHilfen.has(name) ? " open" : ""}>` +
      `<summary title="Erklärung anzeigen">?</summary>` +
      `<div class="nut-hinweis">${html}</div></details>`;
  }

  /* Ein Haken statt einer Zahl. Die Verdrahtung dafuer lag schon im
     input-Handler und im CSS (.nut-check) — sie war bis hierhin nur nie
     benutzt worden. */
  // "21.8." — dasselbe Format wie an der Zeitachse des Verlaufs.
  function kurzesDatum(iso) {
    const d = new Date(iso + "T12:00:00Z");
    return isNaN(d) ? "" : `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  }

  function haken(name, beschriftung, an) {
    return `<label class="nut-check" for="nut-${name}">` +
      `<input id="nut-${name}" type="checkbox" data-feld="${name}"${an ? " checked" : ""}>` +
      `<span>${esc(beschriftung)}</span></label>`;
  }

  function kfaLeiter() {
    const reihe = LEITER[zustand.geschlecht];
    return `<div class="nut-kfa-grid">` + reihe.map((s, i) =>
      `<button type="button" data-feld="kfaBild" data-wert="${i}" aria-pressed="${zustand.kfaBild === i}">` +
      // Feste Masse: die Bilder laden verzoegert und hatten bis dahin die
      // Hoehe 0 — die Seite sprang beim Laden um gut 150 px (auf der
      // Webseite am 29.09.2026 gemessen, dort hat der Rahmen eine feste Hoehe).
      `<img src="img/kfa/${zustand.geschlecht}-${i + 1}.png" alt="Koerperfettanteil etwa ${esc(s.band)}" loading="lazy" width="300" height="${zustand.geschlecht === "frau" ? 336 : 307}">` +
      `<span>${esc(s.band)}</span></button>`
    ).join("") + `</div>`;
  }

  function kfaBereich() {
    if (zustand.kfaWeg === "bild") {
      return kfaLeiter() +
        `<div class="nut-hinweis">Such dir die Figur, die am ehesten passt. Das ist eine Schätzung — wir rechnen den Grundumsatz deshalb ohne sie. Mit dem Maßband wird es genauer.</div>` +
        `<div class="nut-quelle">Die Figuren sind mit KI erzeugte Zeichnungen, keine Fotos.</div>`;
    }
    if (zustand.kfaWeg === "massband") {
      const felder = zustand.geschlecht === "mann"
        ? feld("halsCm", "Hals (cm)", zustand.halsCm) + feld("bauchCm", "Bauch auf Nabelhöhe (cm)", zustand.bauchCm)
        : feld("halsCm", "Hals (cm)", zustand.halsCm) + feld("tailleCm", "Taille (cm)", zustand.tailleCm) +
          feld("huefteCm", "Hüfte (cm)", zustand.huefteCm);
      const wert = window.NutritionCalc.kfaNavy({
        geschlecht: zustand.geschlecht, groesseCm: zustand.groesseCm,
        halsCm: zustand.halsCm, bauchCm: zustand.bauchCm,
        tailleCm: zustand.tailleCm, huefteCm: zustand.huefteCm
      });
      // Die Navy-Formel braucht beim Mann drei Werte, bei der Frau vier — und
      // einer davon, die Groesse, steht schon oben. Ohne diesen Satz wirkt es
      // wie ein vergessenes Feld.
      const gebraucht = zustand.geschlecht === "mann"
        ? "Die Formel braucht Hals, Bauch und deine Größe."
        : "Die Formel braucht Hals, Taille, Hüfte und deine Größe.";
      return `<div class="nut-row">${felder}</div>` +
        `<div class="nut-hinweis">${gebraucht} Die Größe nehmen wir von oben (${zustand.groesseCm || "fehlt noch"}${zustand.groesseCm ? " cm" : ""}).</div>` +
        `<div class="nut-hinweis">${wert === null
          ? "Miss im Stehen, ohne einzuziehen: Hals unterhalb des Kehlkopfs, Bauch auf Nabelhöhe."
          : `Daraus ergeben sich rund <b>${String(wert).replace(".", ",")} %</b> Körperfett.`}</div>`;
    }
    return feld("kfaEingabe", "Körperfettanteil (%)", zustand.kfaEingabe) +
      `<div class="nut-hinweis">Nur eintragen, was gemessen ist — Waage mit Körperanalyse, Caliper oder DEXA.</div>`;
  }

  function aktivitaetenOptionen(gewaehlt) {
    return `<option value="">— Aktivität wählen —</option>` + AKTIVITAETEN.map((g) =>
      `<optgroup label="${esc(g.gruppe)}">` + g.eintraege.map((e) =>
        `<option value="${esc(e.art)}"${e.art === String(gewaehlt) ? " selected" : ""}>${esc(e.name)}</option>`
      ).join("") + `</optgroup>`
    ).join("");
  }

  function aktivitaetenBereich() {
    const zeilen = zustand.aktivitaeten.map((a, i) => `
      <div class="nut-aktivitaet">
        <div class="profile-field">
          <label for="nut-akt-${i}">Aktivität</label>
          <select id="nut-akt-${i}" data-akt="art" data-index="${i}">${aktivitaetenOptionen(a.art)}</select>
        </div>
        <div class="nut-row">
          <div class="profile-field">
            <label for="nut-aktmin-${i}">Minuten</label>
            <input id="nut-aktmin-${i}" type="text" inputmode="decimal" autocomplete="off"
                   data-akt="minuten" data-index="${i}" value="${esc(a.minuten)}">
          </div>
          <div class="profile-field">
            <label for="nut-aktwo-${i}">mal pro Woche</label>
            <input id="nut-aktwo-${i}" type="text" inputmode="decimal" autocomplete="off"
                   data-akt="proWoche" data-index="${i}" value="${esc(a.proWoche)}">
          </div>
        </div>
        ${zustand.aktivitaeten.length > 1
          ? `<button type="button" class="nut-weg" data-akt-weg="${i}">Zeile entfernen</button>`
          : ""}
      </div>`).join("");

    /* Der Hinweis haengt allein an der AUSWAHL, nicht zusaetzlich an
       eingetragenen Minuten: die Minutenfelder loesen bewusst kein
       Neuzeichnen aus (sonst verliert das Feld beim Tippen den Fokus), der
       Hinweis waere also erst viel spaeter aufgetaucht. */
    const gehtZuFuss = zustand.aktivitaeten.some((a) => a.art === GEHEN_ART);

    return zeilen +
      `<button type="button" id="nutAktPlus" class="secondary-btn" style="width:100%;margin-top:8px">Weitere Aktivität</button>` +
      (WEB
        ? `<div class="nut-hinweis">Trag alles ein, was du in einer normalen Woche trainierst. Kein Sport? Dann lass die Zeile leer.</div>`
        : `<div class="nut-hinweis">Nur eintragen, was NICHT in TrainLogic geloggt wird — sonst zählt es doppelt.</div>`) +
      (gehtZuFuss
        ? `<div class="nut-hinweis"><b>Achtung:</b> Gehen steckt bei den meisten schon in der Schrittzahl oben. Trag es hier nur ein, wenn deine Schrittzahl es NICHT enthält.</div>`
        : "");
  }

  function trainingBereich() {
    if (zustand.trainingWeg === "plan") {
      const p = ausPlan();
      if (!p.vollstaendig) {
        return `<div class="nut-gefunden">Aus dem Plan lässt sich gerade nichts rechnen (${esc(p.grund || "kein Plan")}). Nimm deine Logs oder trag den Umfang von Hand ein.</div>`;
      }
      const liste = p.teile.map((t) => `${esc(t.titel)}${t.kcal ? " " + t.kcal + " kcal" : " —"}`).join(" · ");
      return `<div class="nut-gefunden">Woche ${p.woche} deines Plans: <b>${p.einheiten}</b> Einheiten, zusammen <b>${p.kcalProWoche} kcal</b>.` +
        (p.ohneSchaetzung > 0 ? ` Für ${p.ohneSchaetzung} davon konnten wir nichts schätzen.` : "") +
        `<div style="margin-top:6px;opacity:.75">${liste}</div></div>` +
        `<div class="nut-hinweis">Das ist der Plan, nicht das Getane. Sobald du Einheiten loggst, ist der Weg über die Logs der genauere.</div>`;
    }

    const aus = window.NutritionCalc.trainingAusLogs(logs(), {});
    if (zustand.trainingWeg === "logs") {
      const text = aus.einheiten === 0
        ? "Wir finden keine Einheiten der letzten vier Wochen. Trag deinen Umfang von Hand ein oder logge ein paar Workouts."
        : `Gefunden: <b>${aus.einheiten}</b> Einheiten in ${aus.tageBeruecksichtigt} Tagen, im Schnitt <b>${String(aus.einheitenProWoche).replace(".", ",")}</b> pro Woche und <b>${aus.kcalProWoche} kcal</b> Trainingsverbrauch je Woche.` +
          (aus.belastbar ? "" : " Das sind noch wenige Einheiten — die Zahl schwankt entsprechend.");
      return `<div class="nut-gefunden">${text}</div>`;
    }
    return aktivitaetenBereich();
  }

  /* Der Verlauf als kleines SVG. Die Geometrie kommt fertig aus
     NutritionCalc.verlaufGraph — hier wird nur gezeichnet. Bewusst ohne
     Beschriftung an jedem Punkt: das Bild soll die Richtung zeigen, die
     Zahlen stehen im Text darunter. */
  function verlaufGraphik(liste) {
    const g = window.NutritionCalc.verlaufGraph(liste, { breite: 300, hoehe: 90 });
    if (!g.zeigen) return "";

    /* Die Messpunkte liegen NICHT im SVG, sondern als eigene Elemente darueber.
       Grund: das SVG streckt sich mit `preserveAspectRatio="none"` in die
       Kartenbreite, damit die Zeitachse den vorhandenen Platz nutzt — und
       dabei werden Kreise mit gestreckt. Am 22.08.2026 am iPhone gemessen:
       Skala 0,832 in der Breite gegen 1,0 in der Hoehe, die Punkte waren
       4,99 x 6,00 px statt rund. Ueber Prozentangaben positioniert sind sie
       von der Streckung unabhaengig und bleiben bei jeder Breite rund. */
    const punkte = g.punkte
      .map((p) => `<span class="nut-graph-punkt" style="left:${(p.x / g.breite * 100).toFixed(2)}%;top:${(p.y / g.hoehe * 100).toFixed(2)}%"></span>`)
      .join("");
    /* Die Linie zeichnet ALLE Messungen, auch wenn nicht jede einen Kreis
       bekommt (siehe verlaufGraph: ab 16 Messungen werden die Punkte
       ausgeduennt, sonst kleben sie aneinander). `alle` gibt es erst seit
       dem 26.08.2026 — aeltere Rueckgaben fallen auf `punkte` zurueck. */
    const linienPunkte = Array.isArray(g.alle) && g.alle.length ? g.alle : g.punkte;
    const pfad = linienPunkte.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
    /* Waagerechte Hilfslinien: unten, Mitte, oben. Ohne sie sagt ein Auf und
       Ab nur "es schwankt" — mit ihnen sieht man, um wie viel. */
    const raster = (g.raster || [])
      .map((r) => `<line x1="0" y1="${r.y}" x2="${g.breite}" y2="${r.y}" class="nut-graph-raster"/>`)
      .join("");
    const linie = g.linie
      ? `<line x1="${g.linie.x1}" y1="${g.linie.y1}" x2="${g.linie.x2}" y2="${g.linie.y2}" class="nut-graph-trend"/>`
      : "";

    const kg = (n) => String(n).replace(".", ",");
    // Kurzes Datum: "24.7." statt "24. Juli 2026". Unter einer 250 Pixel
    // breiten Flaeche stehen zwei Angaben, die sich nicht beruehren duerfen —
    // das Jahr traegt dabei nichts bei, der Verlauf umfasst hoechstens sechs
    // Wochen.
    const tag = kurzesDatum;
    return `<div class="nut-graph">
      <div class="nut-graph-spalte">
        <div class="nut-graph-flaeche">
          <svg viewBox="0 0 ${g.breite} ${g.hoehe}" preserveAspectRatio="none" role="img"
               aria-label="Gewichtsverlauf über ${g.tage} Tage, ${tag(g.von)} bis ${tag(g.bis)}, zwischen ${kg(g.minKg)} und ${kg(g.maxKg)} Kilogramm">
            ${raster}
            <path d="${pfad}" class="nut-graph-linie"/>
            ${linie}
          </svg>
          ${punkte}
        </div>
        <div class="nut-graph-zeit"><span>${tag(g.von)}</span><span>${tag(g.bis)}</span></div>
      </div>
      <div class="nut-graph-achse"><span>${kg(g.maxKg)} kg</span>${
        g.raster && g.raster.length === 3 ? `<span>${kg(g.raster[1].kg)} kg</span>` : ""
      }<span>${kg(g.minKg)} kg</span></div>
    </div>`;
  }

  function verlaufBereich() {
    const liste = verlauf();
    const stand = window.NutritionCalc.verlaufAuswerten(liste, {});
    const letzter = liste.length ? liste[liste.length - 1] : null;

    /* Der Knopf steht in einer Spalte mit demselben Aufbau wie das Feld
       daneben — Beschriftung oben, Bedienelement darunter. Die Beschriftung
       ist leer und fuer Screenreader ausgeblendet; sie ist nur da, damit
       beide Spalten gleich gebaut sind. So ERBT der Knopf die Hoehe des
       Eingabefeldes, statt sie zu kopieren. Eine gesetzte Hoehe traf daneben:
       am iPhone ist das Feld 36px hoch, in Playwright-WebKit 35. */
    const eintrag =
      `<div class="nut-row">` +
      feld("gewichtHeute", "Gewicht heute (kg)", zustand.gewichtHeute) +
      `<div class="profile-field nut-knopfspalte">` +
      `<label aria-hidden="true"></label>` +
      `<button id="nutVerlaufBtn" class="secondary-btn" type="button">Eintragen</button>` +
      `</div></div>`;

    /* Der Text sagt, was JETZT zu tun ist — nicht, was der Rechner intern
       noch nicht kann. Vorher stand hier "um wie viel die Schaetzung
       danebenlag": das klingt, als gestehe die App einen Fehler ein, und
       hilft niemandem weiter. Benjamins Vorgabe vom 22.08.2026:
       Erklaerungen so leicht wie moeglich, das Warum hinter das
       Fragezeichen. */
    let text;
    if (!liste.length) {
      text = "Trag deine erste Wiegung ein. Ab der zweiten zeichnen wir deinen Verlauf.";
    } else if (liste.length === 1) {
      text = `<b>1 Wiegung</b>, zuletzt ${String(letzter.kg).replace(".", ",")} kg. ` +
        "Noch eine, dann zeichnen wir deinen Verlauf.";
    } else if (!stand.belastbar) {
      // Pruefrunde 3: erst ab 8 Wiegungen ueber 3 Wochen — vorher misst die
      // Gerade vor allem die Tagesschwankung.
      text = `<b>${liste.length} Wiegungen</b>, zuletzt ${String(letzter.kg).replace(".", ",")} kg. ` +
        "Ab 8 Wiegungen über drei Wochen vergleichen wir die Vorgabe mit deiner Waage – am besten morgens, nüchtern.";
    } else {
      const richtung = stand.istProWoche < 0 ? "ab" : stand.istProWoche > 0 ? "zu" : "gleich";
      text = `<b>${stand.punkte}</b> Wiegungen über ${stand.tage} Tage, zuletzt ${String(stand.gewichtJetzt).replace(".", ",")} kg. ` +
        (richtung === "gleich"
          ? "Dein Gewicht steht."
          : `Du nimmst rund <b>${String(Math.abs(stand.istProWoche)).replace(".", ",")} kg pro Woche</b> ${richtung}.`);
    }

    return eintrag + verlaufGraphik(liste) +
      `<div class="nut-gefunden" style="margin-top:10px">${text}</div>` +
      `<div class="nut-hinweis">${WEB ? "Bleibt in deinem Browser auf diesem Gerät." : "Bleibt in dieser App und ändert dein Profil nicht."}</div>`;
  }

  /* Was das gewaehlte Ziel bedeutet — SCHON HIER, nicht erst im Ergebnis.
     Die Rate ist die Zahl, an der der Nutzer nach vier Wochen prueft, ob es
     funktioniert hat; sie gehoert an die Stelle, an der er sich entscheidet. */
  function zielErklaerung() {
    const kfa = window.NutritionCalc.kfaBestimmen(eingabeBauen());
    const r = window.NutritionCalc.zielRate({
      geschlecht: zustand.geschlecht,
      gewichtKg: zustand.gewichtKg,
      ziel: zustand.ziel,
      kfaProzent: kfa.prozent,
      kfaBelastbar: kfa.belastbar,
      kfaQuelle: kfa.quelle,
      trainingLevel: zustand.trainingLevel
    });

    if (r.ziel === "halten") {
      return `<div class="nut-gefunden">Dein Gewicht bleibt, wo es ist. Wir rechnen dir aus, was du dafür essen musst.</div>`;
    }
    if (!(Number(zustand.gewichtKg) > 0)) {
      return `<div class="nut-gefunden">Sobald dein Gewicht oben steht, sagen wir dir hier, wie schnell das gehen soll.</div>`;
    }

    const zahl = (n) => String(n).replace(".", ",");
    // "du legst ... kg zu" — das trennbare Verb braucht seine zweite Haelfte
    // am Satzende. Ohne sie stand da "du legst damit rund 0,2 kg je Woche".
    const verb = r.ziel === "abnehmen" ? "verlierst" : "legst";
    const nachsatz = r.ziel === "abnehmen" ? "" : " zu";
    const worauf = r.ziel === "abnehmen"
      ? (kfa.belastbar ? "Das richtet sich nach deinem Körperfettanteil: je magerer, desto langsamer, sonst geht Muskulatur mit."
                       : "Ohne gemessenen Körperfettanteil nehmen wir die mittlere Rate. Miss nach, dann wird es genauer.")
      : "Das richtet sich nach deinem Trainingsstand: beim Anfänger wird mehr davon Muskel.";

    return `<div class="nut-gefunden">Geplant: <b>${zahl(r.rateProWoche)} % Körpergewicht pro Woche</b> — du ${verb} damit rund <b>${zahl(r.kgProWoche)} kg</b> je Woche${nachsatz}, das sind <b>${r.kcalProTag > 0 ? "+" : ""}${r.kcalProTag} kcal</b> am Tag.</div>` +
      `<div class="nut-hinweis">${worauf}</div>`;
  }

  /* Abgleich mit dem Profil (14.11.2026, Benjamin): "Daten, die dort
     eingegeben werden, sollen auch im Profil landen und andersherum auch" —
     der Nutzer gibt Geschlecht, Gewicht, Groesse und Geburtstag nur einmal
     an. Gelesen wurde schon immer aus dem Profil; neu ist das Zurueck-
     schreiben. Nur in der App (die Webseite hat kein Profil) und bis zur
     Freigabe nur fuer Admin, zusammen mit dem Geburtstag. */
  function abgleich() {
    return !WEB && !!(window.TLGeburtstag && window.TLGeburtstag.aktiv());
  }

  function geburtstagFeld() {
    const G = window.TLGeburtstag;
    const text = zustand.geburtstag ? G.anzeigen(zustand.geburtstag) : "Eintragen";
    return `<div class="profile-field"><label for="nutGeburtstag">Geburtstag</label>` +
      // Schreibgeschuetztes Feld statt Knopf: sieht aus wie die Felder daneben.
      `<input type="text" readonly inputmode="none" id="nutGeburtstag" class="geb-feldknopf${zustand.geburtstag ? "" : " geb-leer"}" value="${esc(text)}"></div>`;
  }

  /* Schreibt einen Koerperwert ins Profil, ueber denselben Weg wie die
     Felder der Einstellungen (Cloud, Kraft-Score, "profileUpdated"). */
  function insProfil(feldName, wert) {
    if (!abgleich() || typeof window.updateSingleProfileField !== "function") return;
    const zahlWert = (v) => { const n = Number(String(v).replace(",", ".")); return n > 0 ? n : null; };
    if (feldName === "geschlecht") window.updateSingleProfileField("gender", wert === "frau" ? "female" : "male");
    else if (feldName === "gewichtKg") { const n = zahlWert(wert); if (n) window.updateSingleProfileField("weight", n); }
    else if (feldName === "groesseCm") { const n = zahlWert(wert); if (n) window.updateSingleProfileField("height", n); }
    else if (feldName === "alterJahre") { const n = zahlWert(wert); if (n) window.updateSingleProfileField("age", Math.round(n)); }
  }

  /* Nur der Gewichtsverlauf, geoeffnet ueber "Koerpergewicht eintragen" im
     Kalorienzaehler (Benjamin 14.11.2026). Dasselbe Overlay und dieselben
     Bausteine wie im Rechner — nur ohne den Rest des Formulars. */
  let nurGewicht = false;
  function gewichtBlattBauen() {
    return `<div class="nut-card">
        <div class="nut-mit-hilfe">
          <div class="nut-card-title">Gewichtsverlauf</div>
          ${hilfe("verlauf", "Dein Gewicht schwankt jeden Tag um bis zu einem Kilo — Wasser, Essen, Salz. Ab <b>8 Wiegungen über drei Wochen</b> legen wir eine Linie durch alle Punkte, und die zeigt, wohin es wirklich geht. Wieg dich am besten immer zur selben Zeit: morgens, nüchtern, nach dem Klo.")}
        </div>
        ${verlaufBereich()}
        ${abgleich() ? `<div class="nut-hinweis">Deine Wiegung gilt sofort für deine Tagesbilanz und dein Profil.</div>` : ""}
      </div>
      <button id="nutGewichtFertig" class="primary-btn overlay-full-btn" type="button">Fertig</button>`;
  }

  function formularBauen() {
    if (nurGewicht) return gewichtBlattBauen();
    return `
      <div class="nut-card">
        <div class="nut-card-title">Körperdaten</div>
        ${wahl("geschlecht", [{ wert: "frau", text: "Frau" }, { wert: "mann", text: "Mann" }], zustand.geschlecht)}
        <div class="nut-row" style="margin-top:10px">
          ${feld("gewichtKg", "Gewicht (kg)", zustand.gewichtKg)}
          ${feld("groesseCm", "Größe (cm)", zustand.groesseCm)}
          ${abgleich() ? geburtstagFeld() : feld("alterJahre", "Alter", zustand.alterJahre)}
        </div>
        <div class="nut-hinweis">${WEB
          ? (zustand.gewichtVonWiegung
            ? `Gewicht aus deiner Wiegung vom <b>${kurzesDatum(zustand.gewichtVonWiegung)}</b>. `
            : "") + "Deine Angaben bleiben in deinem Browser, wir speichern nichts."
          : (zustand.gewichtVonWiegung
            ? `Gewicht aus deiner Wiegung vom <b>${kurzesDatum(zustand.gewichtVonWiegung)}</b>, der Rest aus deinem Profil.`
            : "Aus deinem Profil übernommen.") + (abgleich()
              ? " Was du hier änderst, landet auch in deinem Profil."
              : " Änderungen hier gelten nur für diese Rechnung.")}</div>
      </div>

      <div class="nut-card">
        <div class="nut-card-title">Körperfettanteil</div>
        ${wahl("kfaWeg", [
          { wert: "bild", text: "Bild wählen" },
          { wert: "massband", text: "Maßband" },
          { wert: "eingabe", text: "Selbst eingeben" }
        ], zustand.kfaWeg)}
        <div style="margin-top:10px">${kfaBereich()}</div>
      </div>

      <div class="nut-card">
        <div class="nut-card-title">Alltag</div>
        <div class="nut-mit-hilfe">
          ${feld("schritte", "Schritte pro Tag, ohne Training", zustand.schritte)}
          ${hilfe("schritte", "Gemeint sind die Schritte neben dem Training — Weg zur Arbeit, Einkauf, Treppen. Die Zahl trägst du selbst ein" + (WEB ? "" : ", TrainLogic zählt keine Schritte") + ". Anhaltspunkte: rund <b>4000</b> an einem Schreibtischtag ohne Umwege, <b>7000</b> mit ein paar Wegen zu Fuß, ab <b>12000</b> bist du viel unterwegs. Liest du sie von der Uhr ab, zieh deine Laufeinheiten vorher ab.")}
        </div>
        <div class="nut-mit-hilfe" style="margin-top:14px">
          <div class="nut-feld-titel">Stehen statt Sitzen</div>
          ${haken("unruhig", "Ich sitze selten still — Stehschreibtisch, ständig auf den Beinen, zappelig", zustand.unruhig)}
          ${hilfe("unruhig", "Das sind pauschal <b>50 kcal am Tag</b> und bewusst wenig. Belegt ist nur die Rate: Stehen statt Sitzen kostet rund 9 kcal je Stunde (Metaanalyse über 46 Studien). Wie viele Stunden das bei dir sind, weiß niemand — zwischen zwei Menschen liegen hier bis zu 700 kcal. Eine zu großzügige Zahl schenkt dir Kalorien, die du nie verbrauchst.")}
        </div>
      </div>

      <div class="nut-card">
        <div class="nut-card-title">Training</div>
        ${WEB ? trainingBereich() : wahl("trainingWeg", [
          { wert: "logs", text: "Aus meinen Logs" },
          { wert: "plan", text: "Aus meinem Plan" },
          { wert: "manuell", text: "Anderer Sport" }
        ], zustand.trainingWeg) + `<div style="margin-top:10px">${trainingBereich()}</div>`}
      </div>

      <div class="nut-card">
        <div class="nut-card-title">Ziel</div>
        ${wahl("ziel", [
          { wert: "abnehmen", text: "Abnehmen" },
          { wert: "halten", text: "Halten" },
          { wert: "zunehmen", text: "Zunehmen" }
        ], zustand.ziel)}
        ${WEB && zustand.ziel === "zunehmen" ? `<div class="nut-feld-titel" style="margin-top:12px">Trainingsstand</div>` + wahl("trainingLevel", [
          { wert: "beginner", text: "Anfänger" },
          { wert: "regular", text: "Erfahren" },
          { wert: "competitive", text: "Wettkampf" }
        ], zustand.trainingLevel) : ""}
        <div style="margin-top:10px">${zielErklaerung()}</div>
      </div>

      ${WEB ? `<div class="nut-card">
        <div class="nut-card-title">Gewichtsverlauf</div>
        <div class="nut-gefunden">Hier im Browser wird dein Gewicht nicht gespeichert. In der TrainLogic-App trägst du jede Wiegung ein, siehst deinen Verlauf als Kurve, und der Rechner passt deine Kalorien daran an.</div>
      </div>` : `<div class="nut-card">
        <div class="nut-mit-hilfe">
          <div class="nut-card-title">Gewichtsverlauf</div>
          ${hilfe("verlauf", "Dein Gewicht schwankt jeden Tag um bis zu einem Kilo — Wasser, Essen, Salz. Aus zwei Werten lässt sich der echte Trend davon nicht trennen. Ab <b>8 Wiegungen über drei Wochen</b> legen wir eine Linie durch alle Punkte, und die zeigt, wohin es wirklich geht. Wieg dich dafür am besten immer zur selben Zeit: morgens, nüchtern, nach dem Klo.")}
        </div>
        ${verlaufBereich()}
      </div>`}

      <button id="nutRechnenBtn" class="primary-btn overlay-full-btn" type="button">Berechnen</button>
      <div id="nutErgebnis">${WEB ? webErgebnis(null) : ""}</div>
    `;
  }

  /* --- Rechnen und anzeigen -------------------------------------------------- */

  function eingabeBauen() {
    const e = {
      geschlecht: zustand.geschlecht,
      gewichtKg: zustand.gewichtKg,
      groesseCm: zustand.groesseCm,
      alterJahre: zustand.alterJahre,
      schritte: zustand.schritte,
      unruhig: zustand.unruhig,
      ziel: zustand.ziel,
      trainingLevel: zustand.trainingLevel
    };

    if (zustand.kfaWeg === "bild" && zustand.kfaBild !== null) {
      e.kfaProzent = LEITER[zustand.geschlecht][zustand.kfaBild].wert;
      e.kfaQuelle = "bild";
    } else if (zustand.kfaWeg === "massband") {
      e.halsCm = zustand.halsCm; e.bauchCm = zustand.bauchCm;
      e.tailleCm = zustand.tailleCm; e.huefteCm = zustand.huefteCm;
    } else if (zustand.kfaWeg === "eingabe") {
      e.kfaProzent = zustand.kfaEingabe;
    }

    e.trainingQuelle = zustand.trainingWeg;
    if (zustand.trainingWeg === "plan") {
      const p = ausPlan();
      // Die Dauer muss mit: der Kern zieht davon den Ruheanteil ab.
      e.einheiten = p.vollstaendig
        ? [{ kcal: p.kcalProWoche, minuten: p.minutenProWoche, proWoche: 1 }]
        : [];
    } else if (zustand.trainingWeg === "logs") {
      const aus = window.NutritionCalc.trainingAusLogs(logs(), {});
      // Der Wochenwert wird als EINE Einheit je Woche uebergeben; der Kern
      // teilt selbst auf den Tag.
      // ruheMinuten: nur die brutto geschaetzten Minuten — gemessene
      // Netto-Werte (Uhr, Puls %HRR) bekommen keinen Ruheabzug (Pruefrunde 3).
      e.einheiten = aus.kcalProWoche > 0
        ? [{ kcal: aus.kcalProWoche, minuten: aus.minutenProWoche, ruheMinuten: aus.ruheMinutenProWoche, proWoche: 1 }]
        : [];
    } else {
      // MET-Form: der Kern rechnet MET x kg x Stunden und bekommt die Dauer
      // gleich mit — daraus faellt spaeter der Ruheanteil.
      e.einheiten = zustand.aktivitaeten
        .map((a) => ({
          // watt/formel immer frisch aus der Liste (wie met), nie aus dem Speicher.
          ...(() => { const t = aktivitaetZuArt(a.art); return t && t.watt ? { watt: t.watt, formel: t.formel } : {}; })(),
          met: Number(a.met) || 0,
          minuten: Number(String(a.minuten).replace(",", ".")) || 0,
          proWoche: Number(String(a.proWoche).replace(",", ".")) || 1
        }))
        .filter((a) => a.met > 0 && a.minuten > 0);
    }

    return e;
  }

  /* Der Abgleich mit der Waage. Er erscheint NUR, wenn die Grundlage traegt —
     seit Pruefrunde 3 (15.11.2026) 8 Wiegungen ueber 21 Tage, ohne die
     ersten 14 Tage nach einem Zielwechsel. Geraten wird nur, wenn die
     Abweichung groesser ist als das Rauschen (2 Standardfehler), und dann
     die Haelfte, hoechstens 250 kcal. Kennt der Kalorienzaehler genug
     vollstaendige Tage, rechnet der Kern den Verbrauch aus Aufnahme und
     Gewichtsverlauf zurueck — dann faellt die Formel ganz heraus. */
  function verlaufKarte(r) {
    const stand = verlaufStandFuer(r);
    if (!stand.belastbar) return "";

    const kg = (n) => String(Math.abs(n)).replace(".", ",") + " kg";
    const soll = stand.sollProWoche === 0 ? "dein Gewicht halten"
      : (stand.sollProWoche < 0 ? "rund " + kg(stand.sollProWoche) + " pro Woche abnehmen"
                                : "rund " + kg(stand.sollProWoche) + " pro Woche zunehmen");
    const ist = stand.istProWoche === 0 ? "es steht"
      : (stand.istProWoche < 0 ? "du verlierst " + kg(stand.istProWoche) + " pro Woche"
                               : "du legst " + kg(stand.istProWoche) + " pro Woche zu");
    const rat = stand.deutlich
      ? `Nimm rund <b>${Math.abs(stand.korrekturKcal)} kcal ${stand.korrekturKcal < 0 ? "weniger" : "mehr"}</b> — also etwa ${stand.zielKcal + stand.korrekturKcal} statt ${stand.zielKcal} kcal.`
      : "Das liegt im Rahmen dessen, was die Waage von Tag zu Tag schwankt. Lass die Vorgabe, wie sie ist.";
    const woher = stand.methode === "aufnahme"
      ? `Aus ${stand.aufnahmeTage} vollständig eingetragenen Tagen und deinem Gewichtsverlauf liegt dein Verbrauch bei rund <b>${stand.verbrauchKcal} kcal</b> am Tag.`
      : "";

    return `
      <div class="nut-card">
        <div class="nut-card-title">Wie es wirklich läuft</div>
        <div class="nut-hinweis" style="margin-top:0">Aus ${stand.punkte} Wiegungen über ${stand.tage} Tage: geplant war, ${soll} — tatsächlich ${ist}.</div>
        ${woher ? `<div class="nut-hinweis">${woher}</div>` : ""}
        <div class="nut-gefunden" style="margin-top:8px">${rat}</div>
        <div class="nut-hinweis">${stand.deutlich ? "Wir ändern bewusst nur um die Hälfte: die Waage schwankt, und kleine Schritte treffen sicherer. Nach zwei, drei Wochen schaust du wieder hier." : "Wir raten erst zu einer Änderung, wenn die Abweichung größer ist als das Schwanken der Waage."}</div>
      </div>`;
  }

  /* WEBSEITE: das Ergebnis kompakt in EINER Karte. Der Rahmen auf der
     Wix-Seite hat eine feste Hoehe; was hier Platz braucht, steht vor dem
     Berechnen als leere Flaeche da (Benjamin, 29.09.2026: "am Handy muesste
     man sonst zu weit scrollen, das macht keiner"). Deshalb steht vorher
     dieselbe Karte mit Strichen statt Zahlen — gleich hoch, kein Sprung.
     Die Hinweise zur Schaetzung erklaert die FAQ unter dem Rechner. */
  function webErgebnis(r) {
    const leer = !r;
    const w = (v) => (leer ? "—" : v);
    const a = leer ? { grundumsatz: 0, neat: 0, training: 0, tef: 0 } : r.anteile;
    const zielText = leer ? "Dein Ergebnis, pro Tag"
      : (r.ziel === "abnehmen" ? "Zum Abnehmen" : r.ziel === "zunehmen" ? "Zum Aufbauen" : "Zum Halten") + ", pro Tag";
    let zeile = "Füll die Angaben oben aus und tipp auf „Berechnen“.";
    if (!leer) {
      const kg = String(r.kgProWoche).replace(".", ",");
      zeile = r.rateProWoche > 0
        ? `${r.abweichungKcal > 0 ? "+" : ""}${r.abweichungKcal} kcal am Tag — rund <b>${kg} kg je Woche</b> ${r.ziel === "abnehmen" ? "weniger" : "mehr"}.`
        : `Gesamtumsatz ${r.gesamtumsatzKcal} kcal am Tag.`;
    }
    return `
      <div class="nut-card nut-web-ergebnis${leer ? " nut-web-leer" : ""}">
        <div class="nut-ziel">
          <div class="nut-ziel-wert">${w(r && r.zielKcal)} kcal</div>
          <div class="nut-ziel-label">${zielText}</div>
        </div>
        <div class="nut-hinweis" style="text-align:center">${zeile}</div>
        <div class="nut-makros" style="margin-top:10px">
          <div class="nut-makro"><div class="nut-makro-wert">${w(r && r.eiweissG)} g</div><div class="nut-makro-name">Eiweiß</div></div>
          <div class="nut-makro"><div class="nut-makro-wert">${w(r && r.fettG)} g</div><div class="nut-makro-name">Fett</div></div>
          <div class="nut-makro"><div class="nut-makro-wert">${w(r && r.khG)} g</div><div class="nut-makro-name">Kohlenhydrate</div></div>
        </div>
        <div class="nut-balken" style="margin-top:12px">
          <span class="nut-gu" style="width:${a.grundumsatz}%"></span>
          <span class="nut-neat" style="width:${a.neat}%"></span>
          <span class="nut-training" style="width:${a.training}%"></span>
          <span class="nut-tef" style="width:${a.tef}%"></span>
        </div>
        <div class="nut-legende nut-legende-zwei">
          <div><i style="background:#042c4c"></i>Grundumsatz<b>${w(r && r.grundumsatzKcal)}</b></div>
          <div><i style="background:#2f6f9f"></i>Alltag<b>${w(r && r.neatKcal)}</b></div>
          <div><i style="background:#4fa3d1"></i>Training<b>${w(r && r.trainingKcal)}</b></div>
          <div><i style="background:#a9cde4"></i>Verdauung<b>${w(r && r.tefKcal)}</b></div>
        </div>
        <div class="nut-hinweis">${leer ? "Jede Formel liegt um rund 10 Prozent daneben — nimm die Zahl als Startwert."
          : "Startwert: Formeln liegen um rund 10 Prozent daneben. Nach zwei bis drei Wochen an deinem Gewicht nachjustieren."}</div>
      </div>`;
  }

  function ergebnisBauen(r) {
    if (WEB && r.vollstaendig) return webErgebnis(r);
    if (!r.vollstaendig) {
      return `<div class="nut-card"><div class="nut-card-title">Es fehlt etwas</div>
        <ul class="nut-notizen">${r.hinweise.map((h) => `<li>${esc(h)}</li>`).join("")}</ul></div>`;
    }

    const a = r.anteile;
    const zielText = r.ziel === "abnehmen" ? "Zum Abnehmen" : r.ziel === "zunehmen" ? "Zum Aufbauen" : "Zum Halten";
    // Prozent Koerpergewicht ist die Rechengroesse, Kilogramm ist das, was
    // jemand nachvollziehen kann. Beide, und die Kilogramm zuerst.
    const kg = String(r.kgProWoche).replace(".", ",");
    const prozent = String(r.rateProWoche).replace(".", ",");
    const bewegung = r.ziel === "abnehmen"
      ? `du nimmst damit rund <b>${kg} kg je Woche</b> ab`
      : `du legst damit rund <b>${kg} kg je Woche</b> zu`;
    const rate = r.rateProWoche > 0
      ? `<div class="nut-hinweis" style="text-align:center">Das sind ${r.abweichungKcal > 0 ? "+" : ""}${r.abweichungKcal} kcal am Tag — ${bewegung} (${prozent} % Körpergewicht).</div>`
      : "";

    return `
      <div class="nut-card">
        <div class="nut-ziel">
          <div class="nut-ziel-wert">${r.zielKcal} kcal</div>
          <div class="nut-ziel-label">${zielText}, pro Tag</div>
        </div>
        ${rate}
      </div>

      <div class="nut-card">
        <div class="nut-card-title">Woraus sich das zusammensetzt</div>
        <div class="nut-balken">
          <span class="nut-gu" style="width:${a.grundumsatz}%"></span>
          <span class="nut-neat" style="width:${a.neat}%"></span>
          <span class="nut-training" style="width:${a.training}%"></span>
          <span class="nut-tef" style="width:${a.tef}%"></span>
        </div>
        <div class="nut-legende">
          <div><i class="nut-gu" style="background:#042c4c"></i>Grundumsatz<b>${r.grundumsatzKcal}</b></div>
          <div><i style="background:#2f6f9f"></i>Alltag<b>${r.neatKcal}</b></div>
          <div><i style="background:#4fa3d1"></i>Training<b>${r.trainingKcal}</b></div>
          <div><i style="background:#a9cde4"></i>Verdauung<b>${r.tefKcal}</b></div>
        </div>
        <div class="nut-hinweis">Gesamtumsatz ${r.gesamtumsatzKcal} kcal. Grundumsatz gerechnet nach ${r.grundumsatzFormel === "katch-mcardle" ? "Katch-McArdle über deine fettfreie Masse" : "Mifflin-St Jeor"}${r.magermasseKg ? `, fettfreie Masse rund ${String(r.magermasseKg).replace(".", ",")} kg` : ""}.</div>
      </div>

      <div class="nut-card">
        <div class="nut-card-title">Makronährstoffe</div>
        <div class="nut-makros">
          <div class="nut-makro"><div class="nut-makro-wert">${r.eiweissG} g</div><div class="nut-makro-name">Eiweiß</div></div>
          <div class="nut-makro"><div class="nut-makro-wert">${r.fettG} g</div><div class="nut-makro-name">Fett</div></div>
          <div class="nut-makro"><div class="nut-makro-wert">${r.khG} g</div><div class="nut-makro-name">Kohlenhydrate</div></div>
        </div>
      </div>

      ${verlaufKarte(r)}

      <div class="nut-card">
        <div class="nut-mit-hilfe">
          <div class="nut-card-title">Was daran Schätzung ist</div>
          <div class="nut-gefunden">${esc(r.startwert)}</div>
          ${r.hinweise.length
            ? hilfe("schaetzung", `<ul class="nut-notizen">${r.hinweise.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`)
            : ""}
        </div>
      </div>
    `;
  }

  function rechnen() {
    const ziel = document.getElementById("nutErgebnis");
    if (!ziel) return;
    const r = window.NutritionCalc.berechnen(eingabeBauen());
    // Auch hier: wer die Erklaerung offen hat und neu rechnet, soll sie
    // offen behalten.
    hilfenMerken(ziel);
    ziel.innerHTML = bilanzFrage(r) + ergebnisBauen(r);
    ziel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* --- Aufbau und Ereignisse -------------------------------------------------- */

  function zeichnen() {
    const koerper = document.getElementById("nutritionBody");
    if (!koerper) return;
    // Den Aufklappzustand aus dem DOM lesen, BEVOR er ueberschrieben wird.
    // Frueher stand das in einem `toggle`-Zuhoerer — aber `toggle` feuert
    // asynchron: am 22.08.2026 am iPhone gemessen war `offeneHilfen` beim
    // Neuzeichnen noch leer, und die gerade geoeffnete Erklaerung klappte
    // wieder zu. Der Browsertest hatte das nicht gesehen, weil dort 150 ms
    // Wartezeit dazwischenlagen. Hier direkt abgelesen ist es synchron und
    // braucht keinen Zuhoerer.
    hilfenMerken(koerper);
    koerper.innerHTML = formularBauen();
  }

  function binden() {
    const koerper = document.getElementById("nutritionBody");
    if (!koerper || koerper.dataset.bound === "true") return;
    koerper.dataset.bound = "true";

    // Ein Zuhoerer fuer alles statt einer je Knopf: das Formular wird beim
    // Umschalten neu gezeichnet, einzeln gebundene Knoepfe waeren danach weg.
    koerper.addEventListener("click", (ev) => {
      const knopf = ev.target.closest("button[data-feld]");
      if (knopf) {
        const feldName = knopf.dataset.feld;
        zustand[feldName] = feldName === "kfaBild" ? Number(knopf.dataset.wert) : knopf.dataset.wert;
        // Wer das Geschlecht wechselt, hat eine andere Bilderleiter — die
        // alte Auswahl passt dann nicht mehr.
        if (feldName === "geschlecht") { zustand.kfaBild = null; insProfil("geschlecht", zustand.geschlecht); }
        merken();
        zeichnen();
        return;
      }
      if (ev.target.closest("#nutGeburtstag")) {
        window.TLGeburtstag.oeffnen({
          wert: zustand.geburtstag, alterAlt: zustand.alterJahre,
          fertig: (iso) => {
            zustand.geburtstag = iso;
            zustand.alterJahre = window.TLGeburtstag.alter(iso);
            window.TLGeburtstag.speichern(iso);
            zeichnen();
          }
        });
        return;
      }
      if (ev.target.id === "nutAktPlus") {
        zustand.aktivitaeten.push(LEERE_AKTIVITAET());
        merken();
        zeichnen();
        return;
      }
      const weg = ev.target.closest("button[data-akt-weg]");
      if (weg) {
        zustand.aktivitaeten.splice(Number(weg.dataset.aktWeg), 1);
        if (!zustand.aktivitaeten.length) zustand.aktivitaeten.push(LEERE_AKTIVITAET());
        merken();
        zeichnen();
        return;
      }
      if (ev.target.id === "nutVerlaufBtn") {
        const wert = zustand.gewichtHeute || zustand.gewichtKg;
        if (verlaufEintragen(wert)) {
          // Die frische Wiegung ist der bessere Wert fuer diese Rechnung als
          // das Gewicht aus dem Profil.
          zustand.gewichtKg = Number(String(wert).replace(",", "."));
          zustand.gewichtVonWiegung = heutigerTag();
          zustand.gewichtHeute = "";
          merken();
          /* Mit dem Abgleich (14.11.2026) landet die Wiegung auch im Profil —
             frueher blieb es unberuehrt, damit Kraftstufen nicht wackeln; jetzt
             will Benjamin jede Koerperangabe nur einmal machen. Und eine
             Wiegung gilt SOFORT fuer die Tagesbilanz: sie ist eine bewusste
             Angabe ("Koerpergewicht eintragen"), kein Herumprobieren — die
             Rueckfrage gilt nur fuer die uebrigen Angaben im Rechner. */
          insProfil("gewichtKg", zustand.gewichtKg);
          bilanzGewicht(zustand.gewichtKg);
        }
        zeichnen();
        return;
      }
      if (ev.target.id === "nutRechnenBtn") rechnen();
      // Ueber den Schliessen-Knopf, damit dessen Zuhoerer (Zaehler neu
      // zeichnen) mitlaufen.
      if (ev.target.id === "nutGewichtFertig") document.getElementById("closeNutritionOverlay")?.click();
      if (ev.target.id === "nutBilanzJa" || ev.target.id === "nutBilanzNein") {
        const karte = document.getElementById("nutBilanz");
        if (ev.target.id === "nutBilanzJa") {
          bilanzMerken(bilanzWerte(zustand));
          window.TrainLogicErnaehrung?.profilKarteAktualisieren?.();
          if (karte) karte.innerHTML = `<div class="nut-hinweis"><b>Übernommen.</b> Deine Tagesbilanz rechnet ab jetzt mit diesen Angaben.</div>`;
        } else if (karte) {
          const alt = bilanzGemerkt();
          karte.innerHTML = `<div class="nut-hinweis">Deine Tagesbilanz bleibt bei den Angaben vom <b>${kurzesDatum(alt ? alt.stand : heutigerTag())}</b>.</div>`;
        }
      }
    });

    // Zahlenfelder aendern den Zustand OHNE Neuzeichnen — sonst verliert das
    // Feld beim Tippen den Fokus.
    // Auswahlfelder melden sich ueber "change", nicht ueber "input".
    koerper.addEventListener("change", (ev) => {
      const el = ev.target;
      // Koerperwerte erst beim Verlassen des Felds ins Profil, nicht je
      // Tastendruck ("8" auf dem Weg zu "83" waere sonst kurz das Gewicht).
      if (el.dataset && ["gewichtKg", "groesseCm", "alterJahre"].includes(el.dataset.feld)) {
        insProfil(el.dataset.feld, el.value);
        return;
      }
      if (!el.dataset || el.dataset.akt !== "art") return;
      // Der MET wird nicht aus dem Feld gelesen, sondern aus der Liste
      // geholt: im Feld steht der Schluessel, und der Kern rechnet mit MET.
      const treffer = aktivitaetZuArt(el.value);
      const zeile = zustand.aktivitaeten[Number(el.dataset.index)];
      zeile.art = treffer ? treffer.art : "";
      zeile.met = treffer ? treffer.met : "";
      merken();
      // Neu zeichnen, damit der Gehen-Hinweis erscheint oder verschwindet.
      zeichnen();
    });

    koerper.addEventListener("input", (ev) => {
      const el = ev.target;
      if (el.dataset && el.dataset.akt && el.dataset.akt !== "art") {
        zustand.aktivitaeten[Number(el.dataset.index)][el.dataset.akt] = el.value;
        merken();
        return;
      }
      if (!el.dataset || !el.dataset.feld) return;
      if (el.type === "checkbox") {
        zustand[el.dataset.feld] = el.checked;
        merken();
        zeichnen();
        return;
      }
      zustand[el.dataset.feld] = el.value;
      merken();
    });
  }

  function titelSetzen(text) {
    const t = document.querySelector("#nutritionOverlay .video-overlay-title");
    if (t) t.textContent = text;
  }

  function openGewichtBlatt() {
    nurGewicht = true;
    zeigen();
    titelSetzen("Körpergewicht");
  }

  function openNutritionOverlay() {
    nurGewicht = false;
    zeigen();
    titelSetzen("Kalorienrechner");
  }

  function zeigen() {
    const overlay = document.getElementById("nutritionOverlay");
    if (!overlay || !window.NutritionCalc) return;
    const altbestand = schluesselFehlt(gemerkt().aktivitaeten);
    zustand = zustandAufbauen();
    // Der nachgetragene Schluessel gehoert sofort in den Speicher, nicht erst
    // wenn der Nutzer zufaellig etwas anfasst.
    if (altbestand) merken();
    zeichnen();
    binden();
    overlay.classList.add("active");
    document.body.classList.add("modal-open");
  }

  /* Die Webseite hat kein Overlay: dort steht #nutritionBody direkt auf der
     Seite. */
  function starten() {
    if (!document.getElementById("nutritionBody") || !window.NutritionCalc) return;
    zustand = zustandAufbauen();
    zeichnen();
    binden();
  }

  function closeNutritionOverlay() {
    const overlay = document.getElementById("nutritionOverlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    document.body.classList.remove("modal-open");
  }

  function init() {
    const zu = document.getElementById("closeNutritionOverlay");
    if (zu && zu.dataset.bound !== "true") {
      zu.dataset.bound = "true";
      zu.addEventListener("click", closeNutritionOverlay);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // AKTIVITAETEN steht mit drin, damit die Liste pruefbar ist: ein
  // vertippter MET-Wert faellt sonst niemandem auf.
  //
  // Die drei uebrigen sind die Naht fuer die Sportart-Auswahl. Sie liesse
  // sich nur ueber die Oberflaeche pruefen — und dort kostet jede der 51
  // Aktivitaeten einen Klick samt Neuzeichnen. Genau dieser Aufwand ist der
  // Grund, warum die Verwechslung so lange unbemerkt blieb: geprueft wurde
  // eine Sportart, und die war zufaellig eindeutig.
  /* Der Tagesbedarf fuer den Kalorienzaehler (js/ernaehrung.js, 13.11.2026).
     Dieselbe Rechnung wie im Overlay, aus denselben gemerkten Eingaben —
     mit EINEM Unterschied: statt des Trainingsdurchschnitts (28 Tage Logs,
     Plan oder Sportarten) steht hier der Sport DIESES Tages.

     Damit der Zaehler nicht still eine eigene Physiologie bekommt, laufen
     dieselben Funktionen des Rechners mit dem Tageswert (Befund 13.11.2026,
     Benjamin: "die Zahlen laufen auseinander"). Vorher fehlten drei Dinge:
       1. der Verdauungsanteil (TEF) auf den Sport: der Rechner teilt
          GU + Alltag + Training durch 0,9, der Zaehler nur GU + Alltag —
          an einem Durchschnittstag 40 kcal zu wenig;
       2. die Untergrenzen (Grundumsatz, Energieverfuegbarkeit) — sie
          haengen am Trainingsumfang und muessen fuer den Tag neu greifen,
          das Defizit des Rechners passt nur zu SEINEM Trainingsumfang;
       3. die Makros: sie gehoerten zum Ziel des Rechners, nicht zum Budget
          des Tages, und gingen an Ruhe- wie Trainingstagen nicht auf.
     An einem Tag mit genau dem Durchschnittstraining ist das Ergebnis jetzt
     auf die Kalorie das des Rechners (Test vorhanden).

     `sportNetto`: Zahl oder Funktion (grundumsatzKcal) -> kcal netto. Die
     Funktion, weil der Ruheanteil am Grundumsatz haengt, den erst diese
     Rechnung kennt.
     `grundbedarfKcal` = Tagesumsatz minus Sport, also mit dem GANZEN
     Verdauungsanteil; so gilt Grundbedarf + Sport = Verbrauch des Tages.
     `eingerichtet` ist false, solange der Rechner nie benutzt wurde: dann
     stammen Ziel und Schritte aus Voreinstellungen, und die Karte bittet
     erst um den Rechner, statt eine erfundene Bilanz zu zeigen. */
  /* `opt.alltag` (18.11.2026, Alltag aus Health): Funktion
     ({ grundumsatzKcal, geschaetztKcal, zuschlagKcal, gewichtKg }) -> kcal
     oder null. Liefert sie eine Zahl, ersetzt die den geschaetzten Alltag
     (eingetippte Schritte) fuer diesen Tag; null laesst die Schaetzung. */
  function tagesbedarf(sportNetto, opt) {
    const C = window.NutritionCalc;
    if (!C) return { vollstaendig: false, eingerichtet: false };
    const vorher = zustand;
    let eingerichtet = false;
    try {
      zustand = zustandAufbauen();
      /* Die Bilanz rechnet mit den UEBERNOMMENEN Angaben (BILANZ), nicht mit
         dem letzten Stand im Formular. Wer den Rechner vor dem 14.11.2026
         schon benutzt hatte, hat noch keinen solchen Stand: dann gilt der
         gemerkte Stand als uebernommen, damit sich an der Bilanz nichts
         aendert. Nur Ziel/Koerperdaten/Alltag kommen von dort — der Sport des
         Tages kommt weiter frisch aus den Logs (sportNetto). */
      let b = bilanzGemerkt();
      let gemerktVorhanden = false;
      try { gemerktVorhanden = localStorage.getItem(SPEICHER) !== null; } catch (err) { /* ohne Speicher */ }
      if (!b && gemerktVorhanden) { bilanzMerken(bilanzWerte(zustand)); b = bilanzGemerkt(); }
      eingerichtet = !!b;
      /* opt.tag: fuer einen VERGANGENEN Tag gelten die Angaben von damals
         (bedarfAmTag); heute wird der Stand fortgeschrieben. */
      let korrFest = null;
      if (b && !WEB) {
        const heute = heutigerTag();
        if (opt && typeof opt.tag === "string" && opt.tag < heute) {
          const damals = bedarfAmTag(opt.tag);
          if (damals) { b = { werte: damals.werte }; korrFest = Number(damals.korr || 0); }
        } else bedarfVerlaufFortschreiben(b.werte, korrekturGemerkt().kcal);
      }
      if (b) zustand = Object.assign({}, zustand, b.werte);
      const e = eingabeBauen();
      const r = C.berechnen(e);
      if (!r.vollstaendig) return { vollstaendig: false, eingerichtet };
      const roh = typeof sportNetto === "function" ? sportNetto(r.grundumsatzKcal) : sportNetto;
      const sport = Math.max(0, Math.round(Number(roh) || 0));
      let neatKcal = r.neatKcal;
      if (opt && typeof opt.alltag === "function") {
        const zuschlag = C.neat({ gewichtKg: e.gewichtKg, schritte: 0, unruhig: e.unruhig }).kcal;
        const gemessen = opt.alltag({ grundumsatzKcal: r.grundumsatzKcal, geschaetztKcal: r.neatKcal, zuschlagKcal: zuschlag, gewichtKg: e.gewichtKg });
        if (gemessen != null && isFinite(gemessen) && gemessen >= 0) neatKcal = Math.round(gemessen);
      }
      const tag = C.gesamtumsatz({ grundumsatzKcal: r.grundumsatzKcal, neatKcal: neatKcal, trainingKcal: sport });
      const mager = r.kfa && r.kfa.belastbar ? r.magermasseKg : 0;
      const z = C.zielKalorien({
        geschlecht: e.geschlecht,
        gesamtumsatzKcal: tag.kcal,
        grundumsatzKcal: r.grundumsatzKcal,
        gewichtKg: e.gewichtKg,
        ziel: e.ziel,
        kfaProzent: r.kfa ? r.kfa.prozent : null,
        kfaBelastbar: !!(r.kfa && r.kfa.belastbar),
        kfaQuelle: r.kfa ? r.kfa.quelle : null,
        trainingLevel: e.trainingLevel,
        magermasseKg: mager,
        trainingKcal: sport,
        trainingMinutenProWoche: r.trainingMinutenProWoche,
        /* Pruefrunde 3, Befund 6: das Defizit des Rechners (dort schon gegen
           den Grundumsatz im WOCHENschnitt geprueft) gilt unveraendert fuer
           jeden Tag. Je Tag greift nur noch die Energieverfuegbarkeit — vorher
           hob jeder Ruhetag eines Schweren auf den Grundumsatz an, und ueber
           die Woche blieb weniger Defizit als angesagt. */
        festeAbweichungKcal: r.abweichungKcal
      });
      /* Uebernommene Anpassung aus dem Gewichtsverlauf. Sie senkt nie unter
         den Grundumsatz und nie, wenn fuer den Tag schon eine Untergrenze
         greift (Energieverfuegbarkeit) — anheben darf sie immer. */
      const korr = WEB ? 0 : korrFest != null ? korrFest : korrekturGemerkt().kcal;
      let zielKcal = z.kcal;
      if (korr > 0) zielKcal = z.kcal + korr;
      else if (korr < 0 && !(z.untergrenzeAktiv || z.eaAngehoben)) zielKcal = Math.max(Math.min(z.kcal, r.grundumsatzKcal), z.kcal + korr);
      const m = C.makros({
        kcal: zielKcal, gewichtKg: e.gewichtKg, magermasseKg: mager, ziel: z.ziel,
        geschlecht: e.geschlecht, groesseCm: e.groesseCm, alterJahre: e.alterJahre,
        // Die KH-Stufen sind an Trainingsstunden je Woche geeicht, nicht am
        // einzelnen Tag — deshalb bleibt hier der Wochenwert des Rechners.
        trainingKcalProWoche: r.trainingKcalProWoche,
        trainingMinutenProWoche: r.trainingMinutenProWoche
      });
      return {
        vollstaendig: true,
        eingerichtet,
        grundumsatzKcal: r.grundumsatzKcal,
        alltagKcal: neatKcal,
        alltagGeschaetztKcal: r.neatKcal,
        grundbedarfKcal: tag.kcal - sport,
        sportKcal: sport,
        verbrauchtKcal: tag.kcal,
        zielKcal: zielKcal,
        abweichungKcal: zielKcal - tag.kcal,
        korrekturKcal: zielKcal - z.kcal,
        untergrenzeAktiv: !!(z.untergrenzeAktiv || z.eaAngehoben),
        ziel: z.ziel,
        eiweissG: m.eiweissG,
        khG: m.khG,
        fettG: m.fettG,
        // Zum Vergleich: das Ziel des Rechners mit Trainingsdurchschnitt.
        rechnerZielKcal: r.zielKcal,
        rechnerAbweichungKcal: r.abweichungKcal
      };
    } catch (err) {
      return { vollstaendig: false, eingerichtet };
    } finally {
      zustand = vorher;
    }
  }

  window.NutritionTool = {
    openNutritionOverlay, openGewichtBlatt, closeNutritionOverlay, starten, AKTIVITAETEN, tagesbedarf,
    verlaufStand, korrekturUebernehmen, korrekturZuruecknehmen, korrekturGemerkt,
    // Die Bilderleiter braucht auch der Koerperfett-Rechner der Webseite
    // (docs/website/rechner/koerperfett) — dort als Einordnung des Ergebnisses.
    LEITER,
    aktivitaetenOptionen, aktivitaetZeile, schluesselFehlt, GEHEN_ART
  };
})();
