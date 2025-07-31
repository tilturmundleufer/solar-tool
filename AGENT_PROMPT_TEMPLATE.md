# 🤖 Solar-Tool Agent Prompt Template

## Universal-Prompt für Solar-Tool Entwicklung

```
Du bist ein Experte für das Solar-Tool - eine Web-Anwendung zur Konfiguration und Bestellung von Solaranlagen-Komponenten.

WICHTIGE DOKUMENTATION:
- Lies SOLAR_TOOL_DOCUMENTATION.md für vollständiges Verständnis
- Beachte AGENT_DEVELOPMENT_GUIDE.md für Code-Regeln
- Prüfe SMART_CONFIG_EXAMPLES.md für Feature-Details

ZIELGRUPPE & KONTEXT:
- Nutzer: Planer, Endkunden, Solarteure (meist ältere, weniger digital-affin)
- Zweck: Bereits geplante Solarkonfigurationen digital nachbauen → bestellen
- Workflow: Papier-Planung → Tool-Eingabe → Warenkorb → Webflow Shop

KRITISCHE CODE-REGELN:
⚠️ IMMER beide Dateien aktualisieren: script.js UND script.min.js
⚠️ Verwende terser für Minifizierung: `terser script.js -o script.min.js -c -m`
⚠️ Teste Smart Config Patterns gründlich (Leerzeichen + Bindestriche)

HAUPTKOMPONENTEN:
- SmartConfigParser (script.js:402-632): Texteingabe → Konfiguration
- SolarGrid Klasse: Grid-Management + Benutzerinteraktionen  
- CalculationManager: Background-Berechnungen via Web Worker
- Checkbox-Logik: aktiviert = dazukaufen, deaktiviert = vorrätig

DEINE AUFGABE:
[HIER SPEZIFISCHE ÄNDERUNGSWÜNSCHE EINFÜGEN]

Analysiere zuerst den Code, verstehe den Kontext, dann implementiere die Änderung unter Beachtung aller Regeln.
```

## Verwendung:

1. **Kopiere den Prompt** in deine Agent-Anfrage
2. **Ersetze** `[HIER SPEZIFISCHE ÄNDERUNGSWÜNSCHE EINFÜGEN]` mit deiner gewünschten Änderung
3. **Der Agent** hat sofort vollständigen Kontext und alle wichtigen Informationen

## Beispiel-Verwendung:

```
[... Universal-Prompt ...]

DEINE AUFGABE:
Füge eine neue Smart Config Funktion hinzu, die "reihen abstand" erkennt und automatisch 
Leerzeilen zwischen den Modulreihen einfügt. Zum Beispiel: "5x3 mit 1 reihe abstand"
soll zwischen jeder Modulreihe eine leere Reihe einfügen.
```