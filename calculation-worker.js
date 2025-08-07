// calculation-worker.js - Web Worker für Background-Berechnungen
// Dieser Worker führt komplexe Berechnungen im Hintergrund aus

// Worker-Logs an Haupt-Console weiterleiten
function workerLog(...args) {
  postMessage({ type: 'debug', data: args });
}

// Worker-Message-Handler hinzufügen
self.onmessage = function(e) {
  const { type, data, id } = e.data;
  
  if (type === 'calculateParts') {
    workerLog('WORKER DEBUG: calculateParts called with data:', data);
    const result = calculateParts(data.selection, data.rows, data.cols, data.cellWidth, data.cellHeight, data.orientation);
    workerLog('WORKER DEBUG: calculateParts returning:', result);
    self.postMessage({ type: 'result', id, data: result });
  }
};

// VE-Werte für Berechnungen
const VE_VALUES = {
  Endklemmen: 100,
  Schrauben: 100,
  Dachhaken: 20,
  Mittelklemmen: 100,
  Endkappen: 50,
  Schienenverbinder: 50,
  Schiene_240_cm: 8,
  Schiene_360_cm: 8,
  Solarmodul: 1,
  UlicaSolarBlackJadeFlow: 1,
  MC4_Stecker: 1,
  Solarkabel: 1,
  Holzunterleger: 50,  // NEU: VE von 50
  // NEUE PRODUKTE (aus Berechnung raus, später hinzufügen)
  Erdungsklemme: 1,
  Quetschkabelschuhe: 100,
  Erdungsband: 1,
  Tellerkopfschraube: 100
};

// Berechne Teile für eine gegebene Auswahl
function calculateParts(selection, rows, cols, cellWidth, cellHeight, orientation) {
  workerLog('WORKER DEBUG: calculateParts input:', {selection, rows, cols, cellWidth, cellHeight, orientation});
  
  const parts = {
    Solarmodul: 0, UlicaSolarBlackJadeFlow: 0, Endklemmen: 0, Mittelklemmen: 0,
    Dachhaken: 0, Schrauben: 0, Endkappen: 0,
    Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0, Erdungsband: 0
  };

  for (let y = 0; y < rows; y++) {
    if (!Array.isArray(selection[y])) continue;
    let run = 0;

    for (let x = 0; x < cols; x++) {
      if (selection[y]?.[x]) {
        run++;
        workerLog(`WORKER DEBUG: Found selected cell at [${y}][${x}], run=${run}`);
      }
      else if (run) { 
        workerLog(`WORKER DEBUG: Processing group with run=${run} at row ${y}`);
        processGroup(run, parts, cellWidth, cellHeight, orientation); 
        run = 0; 
      }
    }
    if (run) {
      workerLog(`WORKER DEBUG: Processing final group with run=${run} at row ${y}`);
      processGroup(run, parts, cellWidth, cellHeight, orientation);
    }
  }

  // Erdungsband-Berechnung
  parts.Erdungsband = calculateErdungsband(selection, rows, cols, cellWidth, cellHeight, orientation);

  workerLog('WORKER DEBUG: calculateParts result:', parts);
  return parts;
}

function processGroup(len, parts, cellWidth, cellHeight, orientation) {
  workerLog(`WORKER DEBUG: processGroup called with len=${len}, cellWidth=${cellWidth}, cellHeight=${cellHeight}, orientation=${orientation}`);
  
  // Verwende die tatsächliche Zellbreite basierend auf Orientierung
  const isVertical = orientation === 'vertical';
  const actualCellWidth = isVertical ? cellHeight : cellWidth;
  
  const totalLen = len * actualCellWidth;
  const floor360 = Math.floor(totalLen / 360);
  const rem360 = totalLen - floor360 * 360;
  const floor240 = Math.ceil(rem360 / 240);
  const pure360 = Math.ceil(totalLen / 360);
  const pure240 = Math.ceil(totalLen / 240);
  
  workerLog(`WORKER DEBUG: Rail calculation - totalLen=${totalLen}, floor360=${floor360}, floor240=${floor240}`);
  
  const variants = [
    {cnt360: floor360, cnt240: floor240},
    {cnt360: pure360,  cnt240: 0},
    {cnt360: 0,        cnt240: pure240}
  ].map(v => ({
    ...v,
    rails: v.cnt360 + v.cnt240,
    waste: v.cnt360 * 360 + v.cnt240 * 240 - totalLen
  }));
  
  const minRails = Math.min(...variants.map(v => v.rails));
  const best = variants
    .filter(v => v.rails === minRails)
    .reduce((a, b) => a.waste <= b.waste ? a : b);
  
  const {cnt360, cnt240} = best;
  workerLog(`WORKER DEBUG: Best variant - cnt360=${cnt360}, cnt240=${cnt240}`);
  
  parts.Schiene_360_cm     += cnt360 * 2;
  parts.Schiene_240_cm     += cnt240 * 2;
  parts.Schienenverbinder  += (cnt360 + cnt240 - 1) * 4;
  parts.Endklemmen         += 4;
  parts.Mittelklemmen      += len > 1 ? (len - 1) * 2 : 0;
  parts.Dachhaken          += len > 1 ? len * 3 : 4;
  parts.Endkappen          += 4;  // Fix: Direkt 4 statt parts.Endklemmen
  parts.Solarmodul         += len;
  parts.UlicaSolarBlackJadeFlow += len;
  // Schrauben basierend auf Dachhaken für diese Gruppe berechnen
  const dachhakenForGroup = len > 1 ? len * 3 : 4;
  parts.Schrauben          += dachhakenForGroup * 1; // M10x25: 1 pro Dachhaken (vorher 3)
  parts.Tellerkopfschraube += dachhakenForGroup * 2; // Tellerkopfschraube: 2 pro Dachhaken (neu)
        
  workerLog(`WORKER DEBUG: Parts after processing - Solarmodul=${parts.Solarmodul}, Dachhaken=${parts.Dachhaken}, Schrauben=${parts.Schrauben}`);
}

// Berechne erweiterte Teile mit zusätzlichen Optionen
function calculateExtendedParts(selection, rows, cols, cellWidth, cellHeight, orientation, options) {
  let parts = calculateParts(selection, rows, cols, cellWidth, cellHeight, orientation);
  
  // Module entfernen wenn nicht gewünscht
  if (!options.includeModules) {
    delete parts.Solarmodul;
  }
  
  // MC4 Stecker hinzufügen
  if (options.mc4Connectors) {
    const panelCount = selection.flat().filter(v => v).length;
    parts.MC4_Stecker = Math.ceil(panelCount / 30); // 1 Packung pro 30 Panele
  }
  
  // Solarkabel hinzufügen
  if (options.solarkabel) {
    parts.Solarkabel = 1;
  }
  
  // Holzunterleger hinzufügen
  if (options.woodUnderlay) {
    parts.Holzunterleger = (parts['Schiene_240_cm'] || 0) + (parts['Schiene_360_cm'] || 0);
  }
  
  return parts;
}

// Berechne Gesamtkosten basierend auf Teilen und Preisen
function calculateTotalCost(parts, prices) {
  let totalCost = 0;
  const packDetails = {};
  
  Object.entries(parts).forEach(([key, quantity]) => {
    if (quantity > 0) {
      const packs = Math.ceil(quantity / VE_VALUES[key]);
      const pricePerPack = prices[key] || 0;
      const itemTotal = packs * pricePerPack;
      
      totalCost += itemTotal;
      packDetails[key] = {
        quantity,
        packs,
        pricePerPack,
        itemTotal
      };
    }
  });
  
  return {
    totalCost,
    packDetails
  };
}

// Batch-Berechnung für mehrere Konfigurationen
function calculateMultipleConfigs(configs, prices) {
  const results = [];
  let grandTotal = 0;
  const combinedParts = {};
  
  configs.forEach((config, index) => {
    const parts = calculateExtendedParts(
      config.selection,
      config.rows,
      config.cols,
      config.cellWidth,
      config.cellHeight,
      config.orientation,
      config.options
    );
    
    const costCalculation = calculateTotalCost(parts, prices);
    
    // Kombiniere Teile für Gesamtsumme
    Object.entries(parts).forEach(([key, quantity]) => {
      combinedParts[key] = (combinedParts[key] || 0) + quantity;
    });
    
    grandTotal += costCalculation.totalCost;
    
    results.push({
      configIndex: index,
      configName: config.name,
      parts,
      ...costCalculation
    });
  });
  
  const combinedCostCalculation = calculateTotalCost(combinedParts, prices);
  
  return {
    individualResults: results,
    combined: {
      parts: combinedParts,
      ...combinedCostCalculation
    },
    grandTotal
  };
}

// Optimierungs-Funktion: Finde beste Schienen-Kombination
function optimizeRailCombination(totalLength) {
  const variants = [];
  
  // Alle möglichen Kombinationen testen
  for (let cnt360 = 0; cnt360 <= Math.ceil(totalLength / 360) + 1; cnt360++) {
    const remaining = totalLength - (cnt360 * 360);
    if (remaining <= 0) {
      variants.push({
        cnt360,
        cnt240: 0,
        totalLength: cnt360 * 360,
        waste: cnt360 * 360 - totalLength,
        cost360: cnt360,
        cost240: 0
      });
    } else {
      const cnt240 = Math.ceil(remaining / 240);
      variants.push({
        cnt360,
        cnt240,
        totalLength: cnt360 * 360 + cnt240 * 240,
        waste: cnt360 * 360 + cnt240 * 240 - totalLength,
        cost360: cnt360,
        cost240: cnt240
      });
    }
  }
  
  // Sortiere nach Gesamtkosten (Anzahl Schienen), dann nach geringstem Verschnitt
  variants.sort((a, b) => {
    const totalA = a.cost360 + a.cost240;
    const totalB = b.cost360 + b.cost240;
    
    if (totalA !== totalB) return totalA - totalB;
    return a.waste - b.waste;
  });
  
  return variants[0];
}

// Worker Message Handler
self.addEventListener('message', function(e) {
  const { type, data, id } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'calculateParts':
        result = calculateParts(
          data.selection,
          data.rows,
          data.cols,
          data.cellWidth,
          data.cellHeight,
          data.orientation
        );
        break;
        
      case 'calculateExtendedParts':
        result = calculateExtendedParts(
          data.selection,
          data.rows,
          data.cols,
          data.cellWidth,
          data.cellHeight,
          data.orientation,
          data.options
        );
        break;
        
      case 'calculateTotalCost':
        result = calculateTotalCost(data.parts, data.prices);
        break;
        
      case 'calculateMultipleConfigs':
        result = calculateMultipleConfigs(data.configs, data.prices);
        break;
        
      case 'optimizeRailCombination':
        result = optimizeRailCombination(data.totalLength);
        break;
        
      default:
        throw new Error(`Unknown calculation type: ${type}`);
    }
    
    // Sende Ergebnis zurück
    self.postMessage({
      type: 'result',
      id,
      data: result
    });
    
  } catch (error) {
    // Sende Fehler zurück
    self.postMessage({
      type: 'error',
      id,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// Erdungsband-Berechnung für Worker
function calculateErdungsband(selection, rows, cols, cellWidth, cellHeight, orientation) {
  const isVertical = orientation === 'vertical';
  const moduleHeight = isVertical ? cellWidth : cellHeight;
  const gap = 2; // 2cm Lücke zwischen Modulen
  
  // Kopiere selection Matrix für Erdungsbandlength-Tracking
  const erdungsbandMatrix = selection.map(row => [...row]);
  
  let erdungsbandtotal = 0;
  
  // Analysiere Grid von oben nach unten, links nach rechts
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const result = analyzeFieldForErdungsband(x, y, erdungsbandMatrix, selection, rows, cols, moduleHeight, gap);
      erdungsbandtotal += result;
    }
  }
  
  // Berechne Anzahl benötigter Erdungsbänder
  return Math.ceil(erdungsbandtotal / 600);
}

// Analysiere ein Feld für Erdungsband
function analyzeFieldForErdungsband(x, y, erdungsbandMatrix, selection, rows, cols, moduleHeight, gap) {
  // Schritt 1: Hat das Feld ein Modul?
  if (!erdungsbandMatrix[y]?.[x]) {
    return 0; // Kein Modul, nächstes Feld
  }
  
  // Schritt 2: Hat das Modul ein weiteres Modul direkt darunter?
  if (y + 1 >= rows || !erdungsbandMatrix[y + 1]?.[x]) {
    return 0; // Kein Modul darunter, nächstes Feld
  }
  
  // Schritt 3: Ist links vom aktuellen Feld ein weiteres Feld mit Modul?
  if (x === 0 || !erdungsbandMatrix[y]?.[x - 1]) {
    // Kein Modul links → Erdungsbandlength für aktuelles Feld + Feld darunter
    return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
  }
  
  // Schritt 4: Hat das linke Feld ein Modul darunter?
  if (y + 1 >= rows || !erdungsbandMatrix[y + 1]?.[x - 1]) {
    // Kein Modul unter dem linken Feld → Erdungsbandlength für aktuelles Feld + Feld darunter
    return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
  }
  
  // Schritt 5: Haben die beiden linken Felder bereits Erdungsbandlength?
  return checkLeftFieldsErdungsband(x, y, erdungsbandMatrix, selection, rows, cols, moduleHeight, gap);
}

// Prüfe linke Felder auf Erdungsbandlength
function checkLeftFieldsErdungsband(x, y, erdungsbandMatrix, selection, rows, cols, moduleHeight, gap) {
  const leftUpper = erdungsbandMatrix[y]?.[x - 1];
  const leftLower = erdungsbandMatrix[y + 1]?.[x - 1];
  
  if (leftUpper && leftLower) {
    // Beide haben Module → Prüfe ob sie bereits Erdungsbandlength haben
    if (leftUpper === 'erdungsband' && leftLower === 'erdungsband') {
      // Beide haben Erdungsbandlength → Nichts tun
      return 0;
    } else if (leftUpper === 'erdungsband' && leftLower !== 'erdungsband') {
      // Nur das obere hat Erdungsbandlength → Erdungsbandlength für aktuelles Feld + Feld darunter
      return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
    } else {
      // Keine Erdungsbandlength links → Rekursiv weiter links prüfen
      return checkLeftFieldsRecursive(x, y, erdungsbandMatrix, selection, rows, cols, moduleHeight, gap);
    }
  } else if (leftUpper && !leftLower) {
    // Nur oberes Feld hat Modul → Erdungsbandlength für aktuelles Feld + Feld darunter
    return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
  } else {
    // Keine Module links → Erdungsbandlength für aktuelles Feld + Feld darunter
    return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
  }
}

// Rekursiv weiter links prüfen
function checkLeftFieldsRecursive(x, y, erdungsbandMatrix, selection, rows, cols, moduleHeight, gap) {
  let checkX = x - 2; // Ein Feld weiter links
  
  while (checkX >= 0) {
    // Schritt 3: Hat das Feld links ein Modul?
    if (!erdungsbandMatrix[y]?.[checkX]) {
      // Kein Modul links → Erdungsbandlength für aktuelles Feld + Feld darunter
      return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
    }
    
    // Schritt 4: Hat das linke Feld ein Modul darunter?
    if (y + 1 >= rows || !erdungsbandMatrix[y + 1]?.[checkX]) {
      // Kein Modul unter dem linken Feld → Erdungsbandlength für aktuelles Feld + Feld darunter
      return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
    }
    
    // Schritt 5: Haben die beiden linken Felder bereits Erdungsbandlength?
    const leftUpper = erdungsbandMatrix[y]?.[checkX];
    const leftLower = erdungsbandMatrix[y + 1]?.[checkX];
    
    if (leftUpper === 'erdungsband' && leftLower === 'erdungsband') {
      // Beide haben Erdungsbandlength → Nichts tun
      return 0;
    } else if (leftUpper === 'erdungsband' && leftLower !== 'erdungsband') {
      // Nur das obere hat Erdungsbandlength → Erdungsbandlength für aktuelles Feld + Feld darunter
      return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
    } else {
      // Keine Erdungsbandlength → Weiter nach links
      checkX--;
      continue;
    }
  }
  
  // Keine Module mehr links → Erdungsbandlength für aktuelles Feld + Feld darunter
  return assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
}

// Weise Erdungsbandlength zu
function assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap) {
  // Prüfe ob aktuelles Feld bereits Erdungsbandlength hat
  const currentFieldHasErdungsband = erdungsbandMatrix[y][x] === 'erdungsband';
  
  if (currentFieldHasErdungsband) {
    // Nur das Feld darunter markieren
    erdungsbandMatrix[y + 1][x] = 'erdungsband';
    // Berechne Erdungsbandlength: 1 × Modul-Höhe + Gap
    return moduleHeight + gap;
  } else {
    // Beide Felder markieren
    erdungsbandMatrix[y][x] = 'erdungsband';
    erdungsbandMatrix[y + 1][x] = 'erdungsband';
    // Berechne Erdungsbandlength: 2 × Modul-Höhe + Gap
    return 2 * moduleHeight + gap;
  }
}

// Finde alle Cluster für Erdungsband-Berechnung (echte Verbindungen)








// Worker bereit Signal
self.postMessage({
  type: 'ready',
  message: 'Calculation Worker bereit für Berechnungen'
});