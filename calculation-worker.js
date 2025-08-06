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
    Solarmodul: 0, Endklemmen: 0, Mittelklemmen: 0,
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
  const clusters = findErdungsbandClusters(selection, rows, cols);
  if (clusters.length === 0) return 0;

  const isVertical = orientation === 'vertical';
  // Modulhöhe: horizontal = cellHeight, vertikal = cellWidth
  const moduleHeight = isVertical ? cellWidth : cellHeight;
  const gap = 2; // 2cm Lücke zwischen Modulen

  // Berechne Erdungsbandtotal (Summe aller Erdungsbandlengths)
  let erdungsbandtotal = 0;
  for (const cluster of clusters) {
    erdungsbandtotal += calculateErdungsbandLength(cluster, moduleHeight, gap);
  }

  // Berechne Anzahl benötigter Erdungsbänder
  return Math.ceil(erdungsbandtotal / 600);
}

// Finde alle Cluster für Erdungsband-Berechnung (echte Verbindungen)
function findErdungsbandClusters(selection, rows, cols) {
  const visited = Array.from({ length: rows }, () => 
    Array.from({ length: cols }, () => false)
  );
  const clusters = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (selection[y]?.[x] && !visited[y][x]) {
        const cluster = [];
        floodFillErdungsbandCluster(x, y, visited, cluster, selection, rows, cols);
        if (cluster.length > 0) {
          clusters.push(cluster);
        }
      }
    }
  }

  return clusters;
}

// Flood-fill für Erdungsband-Cluster (nur direkte Verbindungen)
function floodFillErdungsbandCluster(x, y, visited, cluster, selection, rows, cols) {
  if (y < 0 || y >= rows || x < 0 || x >= cols) return;
  if (visited[y][x] || !selection[y]?.[x]) return;

  visited[y][x] = true;
  cluster.push({ x, y });

  // Nur direkte Verbindungen (keine "Überbrückungen")
  // Prüfe alle 4 Richtungen
  const directions = [
    { dx: 1, dy: 0 },  // rechts
    { dx: -1, dy: 0 }, // links
    { dx: 0, dy: 1 },  // unten
    { dx: 0, dy: -1 }  // oben
  ];

  for (const dir of directions) {
    const newX = x + dir.dx;
    const newY = y + dir.dy;
    
    if (newY >= 0 && newY < rows && newX >= 0 && newX < cols) {
      if (!visited[newY][newX] && selection[newY]?.[newX]) {
        floodFillErdungsbandCluster(newX, newY, visited, cluster, selection, rows, cols);
      }
    }
  }
}

// Flood-fill Algorithmus für Cluster-Erkennung
function floodFillCluster(x, y, visited, cluster, selection, rows, cols) {
  if (y < 0 || y >= rows || x < 0 || x >= cols) return;
  if (visited[y][x] || !selection[y]?.[x]) return;

  visited[y][x] = true;
  cluster.push({ x, y });

  // Rekursiv alle 4 Richtungen prüfen (horizontal und vertikal verbunden)
  floodFillCluster(x + 1, y, visited, cluster, selection, rows, cols);
  floodFillCluster(x - 1, y, visited, cluster, selection, rows, cols);
  floodFillCluster(x, y + 1, visited, cluster, selection, rows, cols);
  floodFillCluster(x, y - 1, visited, cluster, selection, rows, cols);
}

// Berechne Erdungsbandlength für einen Cluster
function calculateErdungsbandLength(cluster, moduleHeight, gap) {
  if (cluster.length === 0) return 0;

  // Finde die Bounding Box des Clusters
  const minX = Math.min(...cluster.map(c => c.x));
  const maxX = Math.max(...cluster.map(c => c.x));
  const minY = Math.min(...cluster.map(c => c.y));
  const maxY = Math.max(...cluster.map(c => c.y));

  // Prüfe ob Cluster vertikal oder horizontal ist
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  // Vertikaler Cluster (Spalte)
  if (width === 1 && height > 1) {
    return height * moduleHeight + (height - 1) * gap;
  }

  // Horizontaler Cluster (Reihe)
  if (height === 1 && width > 1) {
    return moduleHeight; // Vertikale Länge für horizontale Reihe
  }

  // Komplexer Cluster (mehrere Reihen/Spalten)
  return calculateComplexClusterLength(cluster, moduleHeight, gap, minX, maxX, minY, maxY);
}

// Berechne Länge für komplexe Cluster
function calculateComplexClusterLength(cluster, moduleHeight, gap, minX, maxX, minY, maxY) {
  // Finde alle vertikalen Spalten im Cluster
  const columns = [];
  for (let x = minX; x <= maxX; x++) {
    const columnModules = cluster.filter(c => c.x === x);
    if (columnModules.length > 0) {
      const columnHeight = Math.max(...columnModules.map(c => c.y)) - Math.min(...columnModules.map(c => c.y)) + 1;
      columns.push({
        x: x,
        height: columnHeight,
        modules: columnModules
      });
    }
  }

  // Wenn nur eine Spalte, einfache Berechnung
  if (columns.length === 1) {
    return columns[0].height * moduleHeight + (columns[0].height - 1) * gap;
  }

  // Mehrere Spalten: Berechne minimale Anzahl Erdungsbänder
  let totalLength = 0;
  
  // Jede Spalte braucht mindestens ein Erdungsband
  for (const column of columns) {
    const columnLength = column.height * moduleHeight + (column.height - 1) * gap;
    totalLength += columnLength;
  }

  return totalLength;
}





// Worker bereit Signal
self.postMessage({
  type: 'ready',
  message: 'Calculation Worker bereit für Berechnungen'
});