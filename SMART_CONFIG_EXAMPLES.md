# 🧠 Smart Config Examples - Solar Tool

## ✨ Neue Funktionalität: "ohne" Optionen

Die Smart Config unterstützt jetzt das Abwählen von Checkboxen mit "ohne":

### 📋 Checkbox-Steuerung

#### ✅ Aktivieren (mit):
```
5x4 mit modulen
6x3 mit mc4
4x5 mit kabel
3x6 mit holz
```

#### ❌ Deaktivieren (ohne):
```
5x4 ohne module
6x3 ohne mc4
4x5 ohne kabel
3x6 ohne holz
```

### 🔄 Kombinationen

#### Mit mehreren Optionen:
```
5x4 mit module und mc4
6x3 mit kabel und holz
4x5 ohne module aber mit mc4
```

#### Gemischte Kombinationen:
```
5x4 mit module, ohne mc4
6x3 ohne kabel, mit holz
4x5 ohne module und ohne mc4
```

### 📝 Vollständige Beispiele

#### Beispiel 1: Basis-Setup ohne Extras
```
Eingabe: "5x4 ohne module, ohne mc4, ohne kabel"
Ergebnis: 
- Grid: 5×4
- Module: ❌ (deaktiviert)
- MC4: ❌ (deaktiviert) 
- Kabel: ❌ (deaktiviert)
- Holz: unverändert
```

#### Beispiel 2: Nur bestimmte Optionen
```
Eingabe: "6x3 mit module, ohne mc4"
Ergebnis:
- Grid: 6×3
- Module: ✅ (aktiviert)
- MC4: ❌ (deaktiviert)
- Kabel: unverändert
- Holz: unverändert
```

#### Beispiel 3: Reihen-Konfiguration ohne Extras
```
Eingabe: "3 reihen mit 5 modulen ohne mc4 und ohne kabel"
Ergebnis:
- Grid: 5×3 (3 Reihen à 5 Module)
- Module: automatisch gesetzt
- MC4: ❌ (deaktiviert)
- Kabel: ❌ (deaktiviert)
- Holz: unverändert
```

### 🎯 Unterstützte Varianten

#### Module:
- `ohne module`
- `ohne modulen`
- `mit modulen`
- `mit module`

#### MC4 Stecker:
- `ohne mc4`
- `mit mc4`

#### Solarkabel:
- `ohne kabel`
- `ohne solarkabel`
- `mit kabel`
- `mit solarkabel`

#### Holzunterleger:
- `ohne holz`
- `ohne holzunterleger`
- `mit holz`
- `mit holzunterleger`

### 💡 Tipps

1. **Reihenfolge egal**: "ohne mc4 und 5x4" funktioniert genauso wie "5x4 ohne mc4"

2. **Mehrere Optionen**: Verwende "und" oder "," um mehrere Optionen zu kombinieren

3. **Gemischte Befehle**: Du kannst "mit" und "ohne" in derselben Eingabe verwenden

4. **Unveränderte Werte**: Nicht erwähnte Checkboxen bleiben unverändert

### 🚀 Erweiterte Beispiele

```
20 module ohne mc4 und ohne kabel
→ Optimales Grid für 20 Module, MC4 und Kabel deaktiviert

4 reihen mit 6 modulen, ohne holz
→ 6×4 Grid in Reihen, Holzunterleger deaktiviert

5x3 vertikal ohne module aber mit mc4
→ 5×3 Grid vertikal, Module aus, MC4 an

ohne module, ohne mc4, ohne kabel, ohne holz
→ Alle Checkboxen deaktivieren (Grid bleibt unverändert)
```

---

**Hinweis**: Diese Funktionalität ist in beiden Dateien verfügbar:
- `script.js` (Development)
- `script.min.js` (Production)