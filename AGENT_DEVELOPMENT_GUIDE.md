# 🤖 Agent Development Guide - Solar Tool

## 📋 Critical Development Rules

### ⚠️ **MANDATORY: Dual File Management**

**ALWAYS** update both files when making JavaScript changes:
- `script.js` (Development version - readable, commented)
- `script.min.js` (Production version - minified, optimized)

### 🔄 Development Workflow

#### When Making JavaScript Changes:

1. **Primary Edit**: Make changes to `script.js` first
2. **Minification**: Generate updated `script.min.js` 
3. **Verification**: Ensure both files are functionally identical

#### File Relationship:
```
script.js (~7k lines) ──minify──> script.min.js (1 line)
     ↓                                  ↓
Development Environment          Production Environment
```

### 🛠️ Required Actions for Every JS Modification:

#### Step 1: Edit script.js
- Make all changes to the readable `script.js` file
- Maintain proper formatting and comments
- Test functionality in development

#### Step 2: Update script.min.js
After editing `script.js`, you MUST:

```bash
# Option A: Use online minifier or build tool
# Copy content from script.js to minifier tool
# Paste result into script.min.js

# Option B: Use Node.js/npm tools (if available)
npx terser script.js -o script.min.js -c -m

# Option C: Manual replacement
# Replace entire content of script.min.js with minified version
```

#### Step 3: Verify Both Files
- ✅ `script.js` enthält lesbaren, strukturierten Code
- ✅ `script.min.js` ist minifiziert (eine Zeile) und funktional identisch
- ✅ Beide Dateien sind synchron (Funktionsparität)
- ✅ Größe grob im Rahmen (minifizierte Datei ist deutlich kleiner)

### 🎯 Key Components in Both Files:

The following major components must exist in both files:

1. **Constants & Configuration**
   - `VE` object (Verpackungseinheiten)
   - `PRICE_MAP` object
   - Product mappings (`PRODUCT_MAP`)

2. **Core Classes**
   - `CalculationManager` - Background calculations
   - `PriceCache` - Price management
   - `SmartConfigParser` - Configuration parsing
   - `BulkSelector` - Bulk selection functionality
   - `SolarGrid` - Main grid management

3. **Key Functions**
   - Grid manipulation (add/remove rows/columns)
   - Part calculations
   - Cart management
   - Configuration save/load

### 🚨 Common Mistakes to Avoid:

❌ **DON'T:**
- Edit only `script.js` without updating `script.min.js`
- Edit only `script.min.js` without updating `script.js`
- Leave files out of sync
- Forget to test both versions

✅ **DO:**
- Always update both files
- Maintain functional parity
- Test in both dev and prod contexts
- Keep backups before major changes

### 🔍 Verification Checklist:

Before completing any JavaScript modification:

- [ ] `script.js` has been updated with changes
- [ ] `script.min.js` has been regenerated from `script.js`
- [ ] Both files contain the same functionality
- [ ] File sizes are appropriate (script.js ~96KB, script.min.js ~48KB)
- [ ] No syntax errors in either file
- [ ] All major classes and functions are present in both files

### 📁 Project Structure:

```
solar-tool/
├── script.js           ← Development version (EDIT THIS)
├── script.min.js       ← Production version (REGENERATE FROM script.js)
├── calculation-worker.js
├── index.html
├── style.css           ← Enthält auch Smart-Config-Styles (zusammengeführt)
└── README.md
```

### 🎯 Environment Usage:

- **Development/Testing**: nutzt `script.js`
- **Production**: nutzt `script.min.js`
- **Beide müssen identisch funktionieren**

### 🔧 Minification Tools:

Recommended tools for generating `script.min.js`:
1. **Online**: jscompress.com, minifier.org
2. **CLI**: terser, uglify-js
3. **IDE**: VSCode extensions, WebStorm built-in
4. **Build Tools**: webpack, rollup, gulp

### 📝 Change Log Template:

When making changes, document:
```markdown
## Changes Made - [Date]
- Modified: [specific functions/classes]
- Files Updated: script.js ✅, script.min.js ✅
- Testing: [brief description]
- Doc Update: README.md ✅, SOLAR_TOOL_DOCUMENTATION.md ✅, SMART_CONFIG_EXAMPLES.md ✅ (falls betroffen)
```

---

## 🧭 Cursor-Workflow (verbindlich)

1) Kontextaufnahme (parallel lesen): `SOLAR_TOOL_DOCUMENTATION.md`, `SMART_CONFIG_EXAMPLES.md`, `script.js`, `index.html`.

2) TODOs in Cursor anlegen: Analyse → Implementierung → Minify → Doku → Git.

3) Implementierungsregeln:
- Änderungen ausschließlich in `script.js`; niemals direkt nur `script.min.js` editieren.
- Webflow-Produktformulare: Alle `form[data-node-type="commerce-add-to-cart-form"]` global unsichtbar setzen (auch nicht gemappte), Queue/Mapping unverändert lassen.
- Logging: In Produktion `console.log`, `console.info`, `console.debug` global zu No-Ops machen; `console.warn/error` behalten.

4) Minify strikt mit terser: `npx terser script.js -o script.min.js -c -m`.

5) Git-Regeln (kein Kombinieren von add+commit; Dateien getrennt committen):
```bash
git add script.js
git commit -m "<Änderungsbeschreibung>"
git add script.min.js
git commit -m "Regenerate script.min.js"
git add <.md-Dateien>
git commit -m "Docs: <Hinweis>"
git push origin main
```

6) Vor-Abschluss-Checks:
- [ ] Smart-Config-Patterns weiter funktionsfähig (Leerzeichen/Bindestrich-Varianten)
- [ ] Warenkorb-Queue/Observer arbeiten, Webflow-Forms unsichtbar
- [ ] Keine neuen Linterfehler
- [ ] Doku aktualisiert (`README`, `SOLAR_TOOL_DOCUMENTATION`, ggf. `SMART_CONFIG_EXAMPLES`)
- [ ] Webhook-Payload kompakt (keine `gridImage`-Base64, nur essenzielle Felder)

## 🚀 Quick Reference Commands:

```bash
# Check file sizes
ls -lh script.js script.min.js

# Minify with terser (if available)
npx terser script.js -o script.min.js -c -m

# Verify syntax
node -c script.js
node -c script.min.js
```

---

**Remember: Der Dev/Prod-Prozess funktioniert nur, wenn BEIDE Dateien synchron sind!**

---

## 📚 Dokumentationspflege (Pflicht für Agents)

- Aktualisiere bei jeder Code-Änderung die relevanten `.md`-Dateien.
- Prüfe und pflege insbesondere:
  - Smart-Config-Befehle (z. B. `gleichmäßig`, `zufällig`, `kompakt`, `mit lücken`, `1 reihe abstand`, `alles außer holz`, `ohne zubehör`)
  - Zusatzprodukte/Checkboxen (z. B. `quetschkabelschuhe`, `erdungsband`, `ulica-module`)
  - UI-Texte/Placeholders in `index.html` vs. `PLACEHOLDER_EXAMPLES.md`
  - Berechnungslogiken (z. B. Erdungsband-Länge und VE-Anzeige)
- Halte `AGENT_PROMPT_TEMPLATE.md` auf Stand, damit neue Regeln/Kommandos sofort bekannt sind.

## Changes Made - [Heute]
- Modified: `init()`, added `maybeShowIntroOverlay()` for desktop-only first-use intro
- Files Updated: script.js ✅, script.min.js ✅
- Testing: Desktop shows intro when kein Cache/URL; mobile still shows mobile-warning; outside click and × close work
- Doc Update: SOLAR_TOOL_DOCUMENTATION.md ✅ (Hinweis zur Intro-Overlay-Anzeige), README.md ✅ (Kurzbeschreibung)

## Changes Made - [2025-08-25]
- Modified: `getConfigData`, `sendConfigToWebhook` (kompakte Webhook-Payload, ohne Bilddaten)
- Files Updated: script.js ✅, script.min.js ✅
- Testing: Verifiziert, dass nur Produkte > 0 übertragen werden, `gridImage` entfällt
- Doc Update: SOLAR_TOOL_DOCUMENTATION.md ✅ (Payload-Spezifikation und Empfehlungen zur externen Bildgenerierung)

### Preisberechnung

- Verwende `getPackPriceForQuantity(productKey, requiredPieces)` statt direktem `getPriceFromCache` für alle positionsbezogenen Preisberechnungen.
- Staffeldefinitionen stehen in `TIER_PRICING`. `pricePerPiece` × `VE` ergibt dynamischen VE-Preis; alternativ `packPrice` nutzen.

## Reasoning-Level für diese Änderung
- Level: medium – Parser/Worker unangetastet; lokale Preis- und Warenkorb-Logik erweitert; neue Popup-Dateien hinzugefügt.

## Git-Flow Ergänzung
1) `script.js` commit
2) `script.min.js` commit (gleiche Message + `[minified]`)
3) `.md`-Änderungen commit (Changelog + Doku)
4) Popup-Dateien (`customer-type-popup.*`) commit (statisches Asset; kann zusammen mit Doku committet werden, wenn gewünscht)

## Tests (Kundentyp)
- LocalStorage leeren → Seite lädt → Popup erscheint
- Auswahl „Privatkunde“ → Preise = Bruttopreise (×1,19), Brutto-SKUs werden bevorzugt
- Auswahl „Firmenkunde“ → Preise = Netto; Standard-SKUs
- Nach 48h → Popup erscheint erneut