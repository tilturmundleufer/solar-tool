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

## 🎯 Hauptfunktionen

- **Grid-Konfiguration** - Visuelle Modul-Anordnung
- **Smart Config** - Intelligente Texteingabe (u. a. `5x4 ohne kabel`, `gleichmäßig`, `zufällig`, `kompakt`, `mit lücken`, `1 reihe abstand`, `alles außer holz`)
- **Multi-Projekte** - Mehrere Konfigurationen parallel
- **Webflow Integration** - Direkter Warenkorb-Export
- **Analytics** - Nutzungsauswertung für Optimierungen
- **Zusatzprodukte** - Quetschkabelschuhe, Erdungsband (inkl. Längenlogik/VE)

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