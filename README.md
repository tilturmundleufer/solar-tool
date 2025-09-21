# 🌞 Solar-Tool

Eine Web-Anwendung zur einfachen Konfiguration und Bestellung von Solaranlagen-Komponenten.

## 📚 Dokumentation

### **Für Entwickler & Agents:**
- **[📖 Vollständige Dokumentation](SOLAR_TOOL_DOCUMENTATION.md)** - Alles über das Tool, Zielgruppe, Features & Architektur
- **[🤖 Agent Prompt Template](AGENT_PROMPT_TEMPLATE.md)** - Universal-Prompt für zukünftige AI-Entwicklung
- **[⚙️ Development Guide](AGENT_DEVELOPMENT_GUIDE.md)** - Kritische Entwicklungsregeln (Dual-File-System!)

### ⚠️ Dokumentationspflege (für alle Agents)
- Halte bei jeder Code-Änderung die relevanten `.md`-Dateien aktuell: `README.md`, `SOLAR_TOOL_DOCUMENTATION.md`, `ARCHITECTURE_GUIDELINES.md`, `AGENT_DEVELOPMENT_GUIDE.md`, `SMART_CONFIG_EXAMPLES.md`, `PLACEHOLDER_EXAMPLES.md`, `AGENT_PROMPT_TEMPLATE.md`.
- Prüfe insbesondere: neue/umbenannte Checkboxen, zusätzliche Produkte, Smart-Config-Kommandos, UI-Verhalten, Größen/Begriffe.
- Füge Beispiele/Erklärungen hinzu oder aktualisiere sie, wenn sich das Verhalten ändert.

### **Feature-Details:**
- **[🧠 Smart Config Examples](SMART_CONFIG_EXAMPLES.md)** - Alle unterstützten Eingabeformate
- **[💬 Placeholder Examples](PLACEHOLDER_EXAMPLES.md)** - UI-Beispiele und Varianten

## 🚀 Quick Start für Agents

```bash
# 1. Lies die Dokumentation
cat SOLAR_TOOL_DOCUMENTATION.md

# 2. Verwende den Universal-Prompt
cp AGENT_PROMPT_TEMPLATE.md your-prompt.md
# Ersetze [HIER SPEZIFISCHE ÄNDERUNGSWÜNSCHE EINFÜGEN] mit deiner Aufgabe

# 3. Bei Code-Änderungen IMMER beide Dateien aktualisieren:
# - Bearbeite script.js
# - Generiere script.min.js: terser script.js -o script.min.js -c -m
```

## ✅ Arbeitsweise in Cursor (verbindlicher Workflow)

1) Kontext lesen (parallel): `SOLAR_TOOL_DOCUMENTATION.md`, `AGENT_DEVELOPMENT_GUIDE.md`, `SMART_CONFIG_EXAMPLES.md`, relevante Dateien (`script.js`, `index.html`).

2) Aufgaben strukturieren: In Cursor eine TODO-Liste anlegen (Analyse, Implementierung, Minify, Doku, Git).

3) Änderungen implementieren:
- Änderungen ausschließlich in `script.js` vornehmen.
- Webflow-Produktforms: Immer alle `form[data-node-type="commerce-add-to-cart-form"]` global verstecken (UI-Konflikte vermeiden).
- Logging: In Produktion `console.log/info/debug` stummschalten, `warn/error` beibehalten.

4) Minifizierung:
```bash
npx terser script.js -o script.min.js -c -m
```

5) Git-Konventionen (separat, kein Kombi-Commit):
```bash
git add script.js
git commit -m "<präzise Änderung in script.js>"
git add script.min.js
git commit -m "Regenerate script.min.js"
git add <.md-Dateien>
git commit -m "Docs: <kurzer Hinweis>"
git push origin main
```

6) Checkliste vor Push:
- [ ] `script.js` bearbeitet, keine linter errors
- [ ] `script.min.js` via terser regeneriert
- [ ] Doku-Updates in `.md` gepflegt
- [ ] Smart-Config-Patterns unverändert/erweitert getestet
- [ ] Webflow-Forms unsichtbar, Queue/Observer funktionsfähig

## 🎯 Hauptfunktionen

- **Grid-Konfiguration** - Visuelle Modul-Anordnung
- **Smart Config** - Intelligente Texteingabe (u. a. `5x4 ohne kabel`, `gleichmäßig`, `zufällig`, `kompakt`, `mit lücken`, `1 reihe abstand`, `alles außer holz`)
- **Multi-Projekte** - Mehrere Konfigurationen parallel
- **Webflow Integration** - Direkter Warenkorb-Export
- **Analytics** - Nutzungsauswertung für Optimierungen
- **Zusatzprodukte** - Quetschkabelschuhe, Erdungsband (inkl. Längenlogik/VE)
- **Desktop-Intro** - Kurzes Schnellstart-Popup erscheint nur beim ersten Desktop-Start ohne Cache/URL; schließbar per × und Klick außerhalb; auf Mobile nicht sichtbar
- **Fullpage‑Warenkorb** – Spiegelung des Webflow‑Carts auf eigener Seite (`fullpage-cart.html/.css/.js`); das native Webflow‑Cart bleibt unsichtbar und dient als technischer Motor.

---

**Zielgruppe:** Planer, Endkunden, Solarteure  
**Zweck:** Geplante Solarkonfigurationen → digitaler Nachbau → Bestellung  
**Status:** In Entwicklung (noch nicht live)

## 🧾 PDF-Ausgabe – Kundendaten-Sektion

- In der `pdf-projekt`-Sektion befindet sich nun eine zweispaltige Kundendaten-Fläche:
  - Links: Linienfelder für Name, Firma, Adresse, Telefon, E‑Mail
  - Rechts: "Weitere Informationen:" mit mehreren Zeilen (Linien) für längere Texte
- Dynamische Erzeugung in `script.js` (Klasse `SolarPDFGenerator`), statische Vorlage in `index.html`
- Bei JS-Änderungen immer minifizieren: `terser script.js -o script.min.js -c -m`