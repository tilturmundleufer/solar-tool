# 🌞 Solar-Tool - Vollständige Dokumentation

## 📋 Überblick

Das Solar-Tool ist eine Web-Anwendung zur einfachen Konfiguration und Bestellung von Solaranlagen-Komponenten. Es ermöglicht Nutzern, bereits geplante Solarkonfigurationen digital nachzubauen und die benötigten Teile direkt zu bestellen.

---

## 👥 Zielgruppe & Anwendungskontext

### **Hauptnutzer:**
- **Planer** - Professionelle Solarplaner
- **Endkunden** - Privatpersonen mit Solarprojekten  
- **Solarteure** - Installateure und Fachbetriebe

### **Nutzerprofil:**
- ✅ Fachkräfte mit technischem Verständnis
- ⚠️ Meist ältere Nutzer (potentiell weniger digital-affin)
- 📋 Haben bereits fertige Konfiguration auf Papier/Dokument

### **Typischer Workflow:**
1. **Vorbereitung:** Nutzer hat Solarkonfiguration bereits geplant (Zettel/Dokument)
2. **Digitalisierung:** Konfiguration im Solar-Tool nachbauen
3. **Optimierung:** Grid-Layout und Komponenten anpassen
4. **Bestellung:** Teile in Warenkorb legen und bestellen
5. **Installation:** Erhaltene Teile für Montage verwenden

---

## 🛠️ Hauptfunktionen

### **1. Grid-Konfiguration**
- **Zweck:** Nachbau der geplanten Modul-Anordnung
- **Standard:** 5×5 Grid (kann sich nach Datenauswertung ändern)
- **Flexibilität:** Beliebige Größen durch +/- Buttons
- **Orientierung:** Horizontal/Vertikal (beeinflusst Schienenlängen)

### **2. Smart Config Interface**
- **Funktion:** Schnelle Konfiguration durch Texteingabe
- **Beispiele:** 
  - `5x4 mit module, ohne mc4`
  - `20 module ohne kabel`
  - `3 reihen mit 6 modulen, ohne holz`
- **Unterstützt:** Leerzeichen und Bindestriche (`ohne kabel`, `ohne-kabel`)

### **3. Komponenten-Auswahl (Checkboxes)**
- **Module:** ✅ Standard aktiviert - Solarmodule
- **MC4-Stecker:** Steckverbinder für Module
- **Solarkabel:** Verkabelung der Anlage  
- **Holzunterleger:** Montagehilfen für Holzdächer

**Logik:** Checkbox aktiviert = Nutzer möchte Komponente dazukaufen
**Deaktiviert:** Nutzer hat Komponente bereits vorrätig

### **4. Multi-Konfiguration**
- **Zweck:** Mehrere separate Projekte verwalten
- **Nicht für:** Vergleiche, sondern getrennte Bestellungen
- **Speicherung:** Konfigurationen bleiben erhalten

---

## 🔧 Technische Architektur

### **Frontend:**
- **HTML/CSS/JavaScript** - Responsive Web-App
- **Grid-System** - Dynamische Modul-Anordnung
- **Smart Parser** - Intelligente Texteingabe-Verarbeitung
- **Web Worker** - Background-Berechnungen

### **Backend-Integration:**
- **Webflow E-Commerce** - Warenkorb-System
- **Webhook-Analytics** - Nutzungsauswertung für Optimierungen
- **Keine ERP-Anbindung** (noch nicht, geplant für Zukunft)

### **Datenfluss:**
```
Planung (Papier) → Solar-Tool → Warenkorb → Webflow Shop → Bestellung → Installation
                              ↓
                         Webhook Analytics → Optimierungen
```

---

## 📊 Geschäftslogik

### **Verpackungseinheiten (VE):**
```javascript
VE = {
  Endklemmen: 100,
  Schrauben: 100, 
  Dachhaken: 20,
  Mittelklemmen: 100,
  Endkappen: 50,
  Schienenverbinder: 50,
  Schiene_240_cm: 8,
  Schiene_360_cm: 8,
  Solarmodul: 1,
  MC4_Stecker: 1,
  Solarkabel: 1,
  Holzunterleger: 1
}
```

### **Preislogik:**
- Automatische VE-Berechnung
- Rundung auf nächste Verpackungseinheit
- Orientierungsabhängige Schienenlängen

### **Analytics-Nutzung:**
- **Zweck:** Tool-Optimierung basierend auf Nutzerverhalten
- **Beispiel:** Kleinere VEs wenn Nutzer häufig minimal über VE bestellen
- **Daten:** Konfigurationen, Bestellmengen, Nutzungsmuster

---

## 🎯 Entwicklungsrichtlinien

### **Benutzerfreundlichkeit:**
- **Einfache Bedienung** für weniger digital-affine Nutzer
- **Klare Visualisierung** des Grid-Layouts
- **Fehlertolerante Eingabe** (Smart Config)
- **Sofortiges Feedback** bei Änderungen

### **Code-Struktur:**
- **Dual-File-System:** `script.js` (Dev) + `script.min.js` (Prod)
- **Background-Worker:** Für Performance bei großen Berechnungen
- **Modulare Klassen:** SmartConfigParser, CalculationManager, etc.

### **Qualitätssicherung:**
- **Beide Dateien** müssen synchron gehalten werden
- **Umfassende Tests** für Smart Config Patterns
- **Responsive Design** für verschiedene Geräte

---

## 🚀 Aktuelle Features

### **Smart Config Patterns:**
- **Grid-Größen:** `5x4`, `6x3`, `8x2`
- **Modul-Anzahl:** `20 module`, `24 modulen`
- **Reihen-Konfiguration:** `3 reihen mit 5 modulen`
- **Orientierung:** `vertikal`, `horizontal`
- **Checkbox-Steuerung:** `mit/ohne module/mc4/kabel/holz`
- **Kombinationen:** `und`, `,` für mehrere Optionen

### **Interaktive Features:**
- **Drag & Drop** - Bereichsauswahl durch Ziehen
- **Shift+Click** - Rechteck-Selektion
- **Bulk-Modus** - Effiziente Mehrfachauswahl
- **Live-Preview** - Sofortige Kostenberechnung

---

## 📈 Zukünftige Entwicklung

### **Geplante Features:**
- **ERP-Integration** - Anbindung an Warenwirtschaftssysteme
- **Erweiterte Analytics** - Detailliertere Nutzungsauswertung
- **Mobile Optimierung** - Bessere Tablet/Smartphone-Unterstützung

### **Optimierungspotential:**
- **VE-Anpassungen** basierend auf Bestellverhalten
- **Standard-Grid-Größe** nach Datenauswertung
- **Neue Smart Config Patterns** je nach Nutzerfeedback

---

## 🔍 Debugging & Support

### **Häufige Probleme:**
- **Smart Config erkennt "ohne" nicht:** Prüfe Hyphen-Unterstützung (`ohne-kabel`)
- **Checkbox-Zustand inkorrekt:** Vergleiche parseCheckboxCombinations Logik
- **Performance-Issues:** Prüfe Web Worker Funktionalität

### **Entwickler-Tools:**
- **Console-Logging** für Smart Config Debugging
- **Test-Dateien** für isolierte Feature-Tests
- **Dual-File-Validation** für Code-Synchronisation

---

## 📝 Wichtige Code-Bereiche

### **Smart Config Parser** (`script.js:402-632`)
- Hauptlogik für Texteingabe-Verarbeitung
- Regex-Patterns für verschiedene Eingabeformate
- Checkbox-Kombinationen und Grid-Berechnungen

### **Grid Management** (`SolarGrid` Klasse)
- Dynamische Grid-Erstellung und -Manipulation
- Benutzerinteraktionen (Click, Drag, Keyboard)
- Auswahl-Logik und Visualisierung

### **Calculation Engine** (`CalculationManager`)
- Background-Berechnungen via Web Worker
- Fallback für synchrone Berechnungen
- Performance-Optimierung für große Grids

---

*Diese Dokumentation wird kontinuierlich aktualisiert basierend auf Nutzerfeedback und Entwicklungsfortschritt.*