// calculation-worker.js - Web Worker für Background-Berechnungen
// Dieser Worker führt komplexe Berechnungen im Hintergrund aus

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
  MC4_Stecker: 1,
  Solarkabel: 1,
  Holzunterleger: 50  // NEU: VE von 50
};

// Berechne Teile für eine gegebene Auswahl
function calculateParts(selection, rows, cols, cellWidth, cellHeight, orientation) {
  const parts = {
    Solarmodul: 0, Endklemmen: 0, Mittelklemmen: 0,
    Dachhaken: 0, Schrauben: 0, Endkappen: 0,
    Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0
  };

  for (let y = 0; y < rows; y++) {
    if (!Array.isArray(selection[y])) continue;
    let run = 0;

    for (let x = 0; x < cols; x++) {
      if (selection[y]?.[x]) run++;
      else if (run) { 
        processGroup(run, parts, cellWidth, cellHeight, orientation); 
        run = 0; 
      }
    }
    if (run) processGroup(run, parts, cellWidth, cellHeight, orientation);
  }

  return parts;
}

function processGroup(len, parts, cellWidth, cellHeight, orientation) {
  // Verwende die tatsächliche Zellbreite basierend auf Orientierung
  const isVertical = orientation === 'vertical';
  const actualCellWidth = isVertical ? cellHeight : cellWidth;
  
  const totalLen = len * actualCellWidth;
  const floor360 = Math.floor(totalLen / 360);
  const rem360 = totalLen - floor360 * 360;
  const floor240 = Math.ceil(rem360 / 240);
  const pure360 = Math.ceil(totalLen / 360);
  const pure240 = Math.ceil(totalLen / 240);
  
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
  parts.Schiene_360_cm     += cnt360 * 2;
  parts.Schiene_240_cm     += cnt240 * 2;
  parts.Schienenverbinder  += (cnt360 + cnt240 - 1) * 4;
  parts.Endklemmen         += 4;
  parts.Mittelklemmen      += len > 1 ? (len - 1) * 2 : 0;
  			parts.Dachhaken          += len > 1 ? len * 2 : 4;
  parts.Endkappen          += parts.Endklemmen;
  parts.Solarmodul         += len;
  parts.Schrauben          += parts.Dachhaken * 2;
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

// Worker bereit Signal
self.postMessage({
  type: 'ready',
  message: 'Calculation Worker bereit für Berechnungen'
});