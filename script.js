(function() {
  const ADD_TO_CART_DELAY = 400;
  const VE = {
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
  };
  
  const PRICE_MAP = {
  	Solarmodul: 120,
  	Endklemmen: 20,
  	Schrauben: 5,
  	Dachhaken: 15,
  	Mittelklemmen: 18,
  	Endkappen: 12,
  	Schienenverbinder: 10,
  	Schiene_240_cm: 30,
  	Schiene_360_cm: 40,
  	MC4_Stecker: 1,
  	Solarkabel: 29.99,
  	Holzunterleger: 0.5
	};

  // ===== BACKGROUND CALCULATION MANAGER =====
  class CalculationManager {
    constructor() {
      this.worker = null;
      this.pendingCalculations = new Map();
      this.calculationId = 0;
      this.isWorkerReady = false;
      
      this.initWorker();
    }

    initWorker() {
      try {
        this.worker = new Worker('./calculation-worker.js');
        
        this.worker.onmessage = (e) => {
          const { type, id, data, error } = e.data;
          
          if (type === 'ready') {
            this.isWorkerReady = true;
            return;
          }
          
          if (type === 'result' && this.pendingCalculations.has(id)) {
            const { resolve } = this.pendingCalculations.get(id);
            this.pendingCalculations.delete(id);
            resolve(data);
          }
          
          if (type === 'error' && this.pendingCalculations.has(id)) {
            const { reject } = this.pendingCalculations.get(id);
            this.pendingCalculations.delete(id);
            reject(new Error(error.message));
          }
        };
        
        this.worker.onerror = (error) => {
          this.isWorkerReady = false;
        };
        
      } catch (error) {
        this.isWorkerReady = false;
      }
    }

    async calculate(type, data) {
      if (!this.isWorkerReady || !this.worker) {
        // Fallback: Synchrone Berechnung im Main Thread
        return this.calculateSync(type, data);
      }

      return new Promise((resolve, reject) => {
        const id = ++this.calculationId;
        this.pendingCalculations.set(id, { resolve, reject });
        
        // Timeout für Berechnungen
        setTimeout(() => {
          if (this.pendingCalculations.has(id)) {
            this.pendingCalculations.delete(id);
            reject(new Error('Calculation timeout'));
          }
        }, 10000); // 10 Sekunden Timeout
        
        this.worker.postMessage({ type, data, id });
      });
    }

    // Fallback-Berechnungen für den Fall, dass Web Worker nicht verfügbar ist
    calculateSync(type, data) {
      switch (type) {
        case 'calculateParts':
          return this.calculatePartsSync(data);
        case 'calculateExtendedParts':
          return this.calculateExtendedPartsSync(data);
        default:
          throw new Error(`Unsupported sync calculation: ${type}`);
      }
    }

    calculatePartsSync(data) {
      // Korrekte Berechnung mit Schienenlogik (wie in der ursprünglichen processGroup Methode)
      const { selection, rows, cols, cellWidth, cellHeight, orientation } = data;
      const parts = {
        Solarmodul: 0, Endklemmen: 0, Mittelklemmen: 0,
        Dachhaken: 0, Schrauben: 0, Endkappen: 0,
        Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0
      };

      // Verwende die korrekte Schienenlogik
      for (let y = 0; y < rows; y++) {
        if (!Array.isArray(selection[y])) continue;
        let run = 0;

        for (let x = 0; x < cols; x++) {
          if (selection[y]?.[x]) run++;
          else if (run) { 
            this.processGroupSync(run, parts, cellWidth, cellHeight, orientation); 
            run = 0; 
          }
        }
        if (run) this.processGroupSync(run, parts, cellWidth, cellHeight, orientation);
      }

      return parts;
    }

    processGroupSync(len, parts, cellWidth, cellHeight, orientation) {
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
      parts.Dachhaken          += len > 1 ? len * 3 : 4;
      parts.Endkappen          += parts.Endklemmen;
      parts.Solarmodul         += len;
      parts.Schrauben          += parts.Dachhaken * 2;
    }

    calculateExtendedPartsSync(data) {
      let parts = this.calculatePartsSync(data);
      const { options } = data;
      
      if (!options.includeModules) {
        delete parts.Solarmodul;
      }
      
      if (options.mc4Connectors) {
        const panelCount = data.selection.flat().filter(v => v).length;
        parts.MC4_Stecker = Math.ceil(panelCount / 30);
      }
      
      if (options.solarkabel) {
        parts.Solarkabel = 1;
      }
      
      if (options.woodUnderlay) {
        parts.Holzunterleger = (parts['Schiene_240_cm'] || 0) + (parts['Schiene_360_cm'] || 0);
      }
      
      return parts;
    }

    destroy() {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      this.pendingCalculations.clear();
      this.isWorkerReady = false;
    }
  }

  // Globale Calculation Manager Instanz
  const calculationManager = new CalculationManager();

  // ===== PRICE CACHING SYSTEM =====
  class PriceCache {
    constructor() {
      this.cache = new Map();
      this.lastUpdate = null;
      this.cacheKey = 'solarTool_priceCache';
      this.timestampKey = 'solarTool_priceTimestamp';
      this.cacheDuration = 24 * 60 * 60 * 1000; // 24 Stunden in Millisekunden
      this.isUpdating = false;
      
      this.loadFromStorage();
      this.scheduleNextUpdate();
    }

    loadFromStorage() {
      try {
        const cachedData = localStorage.getItem(this.cacheKey);
        const timestamp = localStorage.getItem(this.timestampKey);
        
        if (cachedData && timestamp) {
          const parsedData = JSON.parse(cachedData);
          this.lastUpdate = parseInt(timestamp, 10);
          
          // Prüfe ob Cache noch gültig ist
          if (Date.now() - this.lastUpdate < this.cacheDuration) {
            this.cache = new Map(Object.entries(parsedData));
            return;
          }
        }
      } catch (error) {
      }
      
      // Cache ist ungültig oder nicht vorhanden - lade Preise neu
      this.updatePricesFromHTML();
    }

    saveToStorage() {
      try {
        const cacheObject = Object.fromEntries(this.cache);
        localStorage.setItem(this.cacheKey, JSON.stringify(cacheObject));
        localStorage.setItem(this.timestampKey, this.lastUpdate.toString());
      } catch (error) {
      }
    }

    async updatePricesFromHTML() {
      if (this.isUpdating) return;
      
      this.isUpdating = true;
      
      const promises = Object.keys(PRODUCT_MAP).map(async (productKey) => {
        const price = await this.getPriceFromHTMLAsync(productKey);
        this.cache.set(productKey, price);
        return { productKey, price };
      });

      try {
        const results = await Promise.all(promises);
        this.lastUpdate = Date.now();
        this.saveToStorage();
        
        results.forEach(({ productKey, price }) => {
        });
      } catch (error) {
      } finally {
        this.isUpdating = false;
      }
    }

    async getPriceFromHTMLAsync(productKey) {
      return new Promise((resolve) => {
        // Verwende setTimeout um DOM-Zugriffe nicht zu blockieren
        setTimeout(() => {
          const price = this.extractPriceFromHTML(productKey);
          resolve(price);
        }, 0);
      });
    }

    extractPriceFromHTML(productKey) {
      try {
        const productInfo = PRODUCT_MAP[productKey];
        if (!productInfo) return PRICE_MAP[productKey] || 0;
        
        const productId = productInfo.productId;
        const variantId = productInfo.variantId;
        
        const productForm = document.querySelector(`[data-commerce-product-id="${productId}"]`) ||
                           document.querySelector(`[data-commerce-sku-id="${variantId}"]`);
        
        if (productForm) {
          const priceElement = productForm.querySelector('[data-wf-sku-bindings*="f_price_"]');
          
          if (priceElement) {
            let priceText = priceElement.textContent || priceElement.innerHTML;
            priceText = priceText.replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€');
            const priceMatch = priceText.match(/(\d+(?:[.,]\d{1,2})?)/);
            
            if (priceMatch) {
              const price = parseFloat(priceMatch[1].replace(',', '.'));
              return price;
            }
          }
        }
      } catch (error) {
      }
      
      return PRICE_MAP[productKey] || 0;
    }

    getPrice(productKey) {
      if (this.cache.has(productKey)) {
        return this.cache.get(productKey);
      }
      
      // Fallback auf hardcoded Preis wenn nicht im Cache
      const fallbackPrice = PRICE_MAP[productKey] || 0;
      return fallbackPrice;
    }

    scheduleNextUpdate() {
      // Berechne Zeit bis zum nächsten Update
      const nextUpdate = this.lastUpdate ? 
        this.lastUpdate + this.cacheDuration : 
        Date.now() + this.cacheDuration;
      
      const timeUntilUpdate = Math.max(0, nextUpdate - Date.now());
      
      setTimeout(() => {
        this.updatePricesFromHTML();
        this.scheduleNextUpdate(); // Plane nächstes Update
      }, timeUntilUpdate);
      
    }

    // Manuelle Aktualisierung für Debugging
    forceUpdate() {
      return this.updatePricesFromHTML();
    }
  }

  const PRODUCT_MAP = {
    Solarmodul:        { productId:'685003af0e41d945fb0198d8', variantId:'685003af4a8e88cb58c89d46' },
    Endklemmen:        { productId:'6853c34fe99f6e3d878db38b', variantId:'6853c350edab8f13fc18c1b9' },
    Schrauben:         { productId:'6853c2782b14f4486dd26f52', variantId:'6853c2798bf6755ddde26a8e' },
    Dachhaken:         { productId:'6853c1d0f350bf620389664c', variantId:'6853c1d04d7c01769211b8d6' },
    Mittelklemmen:     { productId:'68531088654d1468dca962c', variantId:'6853c1084c04541622ba3e26' },
    Endkappen:         { productId:'6853be0895a5a578324f9682', variantId:'6853be0805e96b5a16c705cd' },
    Schienenverbinder: { productId:'6853c2018bf6755ddde216a8', variantId:'6853c202c488ee61eb51a3dc' },
    Schiene_240_cm:    { productId:'6853bd882f00db0c9a42d653', variantId:'6853bd88c4173dbe72bab10f' },
    Schiene_360_cm:    { productId:'6853bc8f3f6abf360c605142', variantId:'6853bc902f00db0c9a423d97' },
    MC4_Stecker:       { productId:'687fcc9f66078f7098826ccc', variantId:'687fcca02c6537b9a9493fa7' },
    Solarkabel:        { productId:'687fd60dc599f5e95d783f99', variantId:'687fd60dd3a8ae1f00a6d6d1' },
    Holzunterleger:    { productId:'xxx-holz', variantId:'xxx-holz-v' }
  };

  // Globale Price Cache Instanz (nach PRODUCT_MAP Definition)
  const priceCache = new PriceCache();

  // Debug-Funktionen für Price Cache (nur für Entwicklung)
  window.debugPriceCache = {
    forceUpdate: () => priceCache.forceUpdate(),
    getCache: () => Object.fromEntries(priceCache.cache),
    getCacheAge: () => {
      if (!priceCache.lastUpdate) return 'Nie aktualisiert';
      const ageMs = Date.now() - priceCache.lastUpdate;
      const ageHours = Math.round(ageMs / (1000 * 60 * 60));
      return `${ageHours} Stunden alt`;
    },
    clearCache: () => {
      localStorage.removeItem(priceCache.cacheKey);
      localStorage.removeItem(priceCache.timestampKey);
      priceCache.cache.clear();
      priceCache.lastUpdate = null;
    }
  };

  // Funktion um Preise aus Cache zu lesen (ersetzt getPriceFromHTML)
  function getPriceFromCache(productKey) {
    return priceCache.getPrice(productKey);
  }

  // Legacy-Funktion für Rückwärtskompatibilität
  function getPriceFromHTML(productKey) {
    return getPriceFromCache(productKey);
  }

  // ===== SMART CONFIGURATION PARSER =====
  class SmartConfigParser {
    constructor(solarGrid) {
      this.solarGrid = solarGrid;
      this.patterns = {
        // "5x4" oder "5 x 4" → Grid-Größe
        gridSize: /(\d+)\s*[x×]\s*(\d+)/i,
        // "20 module" → Anzahl Module
        moduleCount: /(\d+)\s*modul[e]?[n]?/i,
        // "mit modulen" oder "ohne module" → Module-Checkbox
        moduleCheckbox: /(?:mit|ohne)[\s-]*modul[e]?[n]?(?!\s*\d)/i,
        // "horizontal" oder "vertikal"
        orientation: /(?:horizontal|vertikal|vertical)/i,
        // "mit mc4" oder "ohne mc4"
        mc4: /(?:mit|ohne)[\s-]*mc4/i,
        // "mit kabel" oder "ohne kabel"  
        cable: /(?:mit|ohne)[\s-]*(?:kabel|solarkabel)/i,
        // "mit holz" oder "ohne holz"
        wood: /(?:mit|ohne)[\s-]*holz(?:unterleger)?/i,
        // "3 reihen mit 5 modulen" oder "drei reihen 5 module"
        rowPattern: /(?:(\d+|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*(?:reihen?|zeilen?)\s*(?:mit|à|a)?\s*(\d+)\s*modul[e]?[n]?)|(?:(\d+)\s*modul[e]?[n]?\s*(?:in|auf)?\s*(\d+|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*(?:reihen?|zeilen?))/i,
        // "mit abstand" oder "ohne abstand" oder "1 reihe abstand"
        spacing: /(?:(?:mit|ohne)\s*(?:abstand|lücke))|(?:(\d+)\s*(?:reihen?|zeilen?)\s*(?:abstand|lücke))/i,
        // Kombinierte Checkbox-Logik mit "und" Verknüpfungen
        checkboxCombination: /(?:^|\s)(?:mit|und)\s+(.+?)(?:\s+und\s+(.+?))*(?:\s*$)/i
      };
    }

    // Hilfsfunktion: Wandelt Wortzahlen in Nummern um
    parseWordNumber(word) {
      const wordNumbers = {
        'ein': 1, 'eine': 1, 'zwei': 2, 'drei': 3, 'vier': 4, 'fünf': 5,
        'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9, 'zehn': 10
      };
      
      if (typeof word === 'string' && wordNumbers[word.toLowerCase()]) {
        return wordNumbers[word.toLowerCase()];
      }
      
      return parseInt(word) || 0;
    }

    // Hilfsfunktion: Parst Checkbox-Kombinationen mit "und" Verknüpfungen
    parseCheckboxCombinations(input) {
      const checkboxes = {
        modules: null,  // null = nicht erkannt, true = mit, false = ohne
        mc4: null,
        cable: null,
        wood: null
      };

      // Normalisiere Input für bessere Erkennung
      const normalizedInput = input.toLowerCase()
        .replace(/modulen?/g, 'module')
        .replace(/solarkabeln?/g, 'solarkabel')
        .replace(/holzunterlegern?/g, 'holzunterleger');

      // Teile Input bei "und" oder "," auf und analysiere jeden Teil
      let parts = normalizedInput.split(/\s*(?:und|,)\s*/);
      
      // Bereinige den ersten Teil, falls er mit "mit" oder "ohne" beginnt
      if (parts[0] && (parts[0].includes('mit ') || parts[0].includes('ohne '))) {
        parts[0] = parts[0].replace(/.*(?:mit|ohne)\s+/, '');
      }
      
      // Entferne leere Teile
      parts = parts.filter(part => part.trim().length > 0);

      for (const part of parts) {
        const trimmedPart = part.trim();
        
        // Prüfe auf Module (aber nicht wenn es Teil einer Reihen-Konfiguration ist)
        if (/\bmodul[e]?[n]?\b/.test(trimmedPart) && !/\d+\s*modul/.test(trimmedPart) && !/reihen/.test(trimmedPart)) {
          // Prüfe ob "ohne" davor steht (auch im ursprünglichen Input)
          if (/\bohne[\s-]+modul[e]?[n]?\b/.test(trimmedPart) || /\bohne[\s-]+modul[e]?[n]?\b/.test(input.toLowerCase())) {
            checkboxes.modules = false;
          } else {
            checkboxes.modules = true;
          }
        }
        
        // Prüfe auf MC4
        if (/\bmc4\b/.test(trimmedPart)) {
          if (/\bohne[\s-]+mc4\b/.test(trimmedPart) || /\bohne[\s-]+mc4\b/.test(input.toLowerCase())) {
            checkboxes.mc4 = false;
          } else {
            checkboxes.mc4 = true;
          }
        }
        
        // Prüfe auf Kabel
        if (/\b(?:kabel|solarkabel)\b/.test(trimmedPart)) {
          if (/\bohne[\s-]+(?:kabel|solarkabel)\b/.test(trimmedPart) || /\bohne[\s-]+(?:kabel|solarkabel)\b/.test(input.toLowerCase())) {
            checkboxes.cable = false;
          } else {
            checkboxes.cable = true;
          }
        }
        
        // Prüfe auf Holzunterleger
        if (/\b(?:holz|holzunterleger)\b/.test(trimmedPart)) {
          if (/\bohne[\s-]+(?:holz|holzunterleger)\b/.test(trimmedPart) || /\bohne[\s-]+(?:holz|holzunterleger)\b/.test(input.toLowerCase())) {
            checkboxes.wood = false;
          } else {
            checkboxes.wood = true;
          }
        }
      }

      return checkboxes;
    }

    parseInput(input) {
      const config = {};

      // Grid-Größe parsen
      const gridMatch = input.match(this.patterns.gridSize);
      if (gridMatch) {
        config.cols = parseInt(gridMatch[1]);
        config.rows = parseInt(gridMatch[2]);
      }

      // Reihen-Pattern parsen (hat Priorität vor einfacher moduleCount)
      const rowMatch = input.match(this.patterns.rowPattern);
      if (rowMatch) {
        let numRows, modulesPerRow;
        
        if (rowMatch[1] && rowMatch[2]) {
          // "3 reihen mit 5 modulen" Format
          numRows = this.parseWordNumber(rowMatch[1]);
          modulesPerRow = parseInt(rowMatch[2]);
        } else if (rowMatch[3] && rowMatch[4]) {
          // "20 module in 6 reihen" Format
          const totalModules = parseInt(rowMatch[3]);
          numRows = this.parseWordNumber(rowMatch[4]);
          // Berechne minimale Spalten für gleichmäßige Verteilung
          modulesPerRow = Math.ceil(totalModules / numRows);
          
          // Speichere zusätzliche Info für intelligente Verteilung
          config.intelligentDistribution = {
            totalModules: totalModules,
            numRows: numRows,
            baseModulesPerRow: Math.floor(totalModules / numRows),
            extraModules: totalModules % numRows
          };
        }
        
        if (numRows && modulesPerRow) {
          // Prüfe auf Abstand-Spezifikation
          const spacingMatch = input.match(this.patterns.spacing);
          let spacingRows = 0;
          
          if (spacingMatch) {
            if (spacingMatch[0].toLowerCase().includes('mit') && !spacingMatch[1]) {
              spacingRows = 1; // Standard-Abstand
            } else if (spacingMatch[1]) {
              spacingRows = parseInt(spacingMatch[1]);
            }
          }
          
          config.rowConfig = {
            rows: numRows,
            modulesPerRow: modulesPerRow,
            spacing: spacingRows,
            totalModules: numRows * modulesPerRow
          };
          
          // Berechne benötigte Grid-Größe
          const neededRows = numRows + (numRows - 1) * spacingRows;
          config.cols = modulesPerRow;
          config.rows = neededRows;
          
        }
      }
      // Module-Anzahl parsen (nur wenn keine Reihen-Konfiguration)
      else {
        const moduleMatch = input.match(this.patterns.moduleCount);
        if (moduleMatch && !gridMatch) {
          config.moduleCount = parseInt(moduleMatch[1]);
          // Automatisch optimale Grid-Größe berechnen
          const gridSize = this.calculateOptimalGrid(config.moduleCount);
          config.cols = gridSize.cols;
          config.rows = gridSize.rows;
        }
      }

      // Orientierung parsen (nur wenn explizit erwähnt)
      const orientationMatch = input.match(this.patterns.orientation);
      if (orientationMatch) {
        config.orientation = orientationMatch[0].toLowerCase().includes('vertikal') || 
                            orientationMatch[0].toLowerCase().includes('vertical') ? 'vertical' : 'horizontal';
      }

      // Checkbox-Kombinationen parsen (hat Priorität vor einzelnen Patterns)
      const checkboxCombinations = this.parseCheckboxCombinations(input);
      let hasCheckboxCombinations = Object.values(checkboxCombinations).some(value => value !== null);

      if (hasCheckboxCombinations) {
        // Setze nur die Werte, die explizit erkannt wurden (nicht null)
        if (checkboxCombinations.modules !== null) config.includeModules = checkboxCombinations.modules;
        if (checkboxCombinations.mc4 !== null) config.mc4 = checkboxCombinations.mc4;
        if (checkboxCombinations.cable !== null) config.cable = checkboxCombinations.cable;
        if (checkboxCombinations.wood !== null) config.wood = checkboxCombinations.wood;
      } else {
        // Fallback: Einzelne Checkbox-Patterns parsen
        
        // Module-Checkbox parsen (getrennt von moduleCount)
        const moduleCheckboxMatch = input.match(this.patterns.moduleCheckbox);
        if (moduleCheckboxMatch) {
          config.includeModules = moduleCheckboxMatch[0].toLowerCase().includes('mit');
        }

        // Optionen parsen (nur wenn explizit erwähnt)
        const mc4Match = input.match(this.patterns.mc4);
        if (mc4Match) {
          config.mc4 = mc4Match[0].toLowerCase().includes('mit');
        }

        const cableMatch = input.match(this.patterns.cable);
        if (cableMatch) {
          config.cable = cableMatch[0].toLowerCase().includes('mit');
        }

        const woodMatch = input.match(this.patterns.wood);
        if (woodMatch) {
          config.wood = woodMatch[0].toLowerCase().includes('mit');
        }
      }

      return config;
    }

    calculateOptimalGrid(moduleCount) {
      // Finde beste Rechteck-Aufteilung
      const factors = [];
      for (let i = 1; i <= Math.sqrt(moduleCount); i++) {
        if (moduleCount % i === 0) {
          factors.push([i, moduleCount / i]);
        }
      }
      
      // Bevorzuge quadratische oder leicht rechteckige Formen
      const best = factors.reduce((a, b) => {
        const ratioA = Math.max(a[0], a[1]) / Math.min(a[0], a[1]);
        const ratioB = Math.max(b[0], b[1]) / Math.min(b[0], b[1]);
        return ratioA <= ratioB ? a : b;
      });

      return { cols: Math.max(best[0], best[1]), rows: Math.min(best[0], best[1]) };
    }

    applyConfiguration(config) {
      
      // Speichere bestehende Auswahl
      const oldSelection = this.solarGrid.selection ? 
        this.solarGrid.selection.map(row => [...row]) : null;
      const oldCols = this.solarGrid.cols;
      const oldRows = this.solarGrid.rows;
      
      // Grid-Größe setzen (nur wenn angegeben)
      if (config.cols && config.rows) {
        this.solarGrid.cols = config.cols;
        this.solarGrid.rows = config.rows;
      }

      // Orientierung setzen (nur wenn angegeben)
      if (config.orientation) {
        this.solarGrid.orV.checked = config.orientation === 'vertical';
        this.solarGrid.orH.checked = config.orientation === 'horizontal';
      }

      // Optionen setzen (nur die angegebenen)
      if (config.hasOwnProperty('includeModules')) {
        this.solarGrid.incM.checked = config.includeModules;
      }
      if (config.hasOwnProperty('mc4')) {
        this.solarGrid.mc4.checked = config.mc4;
      }
      if (config.hasOwnProperty('cable')) {
        this.solarGrid.solarkabel.checked = config.cable;
      }
      if (config.hasOwnProperty('wood')) {
        this.solarGrid.holz.checked = config.wood;
      }

      // Erstelle neue Auswahl-Matrix mit angepasster Größe
      const newSelection = Array.from({ length: this.solarGrid.rows }, (_, y) =>
        Array.from({ length: this.solarGrid.cols }, (_, x) => {
          // Behalte bestehende Auswahl bei, falls sie existiert und im neuen Grid passt
          if (oldSelection && y < oldSelection.length && x < oldSelection[y].length) {
            return oldSelection[y][x];
          }
          return false;
        })
      );
      
      this.solarGrid.selection = newSelection;

      // Grid mit neuen Dimensionen neu aufbauen
      this.solarGrid.updateSize();
      this.solarGrid.buildGrid();
      this.solarGrid.buildList();
      this.solarGrid.updateSummaryOnChange();

      // Wenn Reihen-Konfiguration angegeben, verwende spezielle Selektion
      if (config.rowConfig) {
        this.applyRowConfiguration(config.rowConfig, config.intelligentDistribution);
      }
      // Wenn Module-Anzahl angegeben, automatisch auswählen (nur bei neuen Grids)
      else if (config.moduleCount && (!oldSelection || oldSelection.flat().every(cell => !cell))) {
        this.autoSelectModules(config.moduleCount);
      }
      
      // Verstecke Tipps nach erster Nutzung
      this.hideHelpAfterFirstUse();
    }
    
    hideHelpAfterFirstUse() {
      const helpSection = document.querySelector('.bulk-selection-help');
      if (helpSection) {
        helpSection.style.display = 'none';
        // Speichere in localStorage, dass Tipps versteckt werden sollen
        localStorage.setItem('solarTool_hideHelp', 'true');
      }
    }

    autoSelectModules(count) {
      
      // Prüfe ob das aktuelle Grid groß genug ist
      const currentCapacity = this.solarGrid.cols * this.solarGrid.rows;
      
      if (currentCapacity < count) {
        this.expandGridForModules(count);
      }
      
      // Selektiere Module von links nach rechts, oben nach unten
      let selected = 0;
      for (let y = 0; y < this.solarGrid.rows && selected < count; y++) {
        for (let x = 0; x < this.solarGrid.cols && selected < count; x++) {
          if (!this.solarGrid.selection[y]) this.solarGrid.selection[y] = [];
          this.solarGrid.selection[y][x] = true;
          selected++;
        }
      }
      
      this.solarGrid.buildGrid();
      this.solarGrid.buildList();
      this.solarGrid.updateSummaryOnChange();
    }
    
    expandGridForModules(targetCount) {
      const currentCapacity = this.solarGrid.cols * this.solarGrid.rows;
      
      if (currentCapacity >= targetCount) return;
      
      // Berechne optimale neue Grid-Größe
      const optimalGrid = this.calculateOptimalGrid(targetCount);
      
      // Erweitere das Grid intelligent
      let newCols = this.solarGrid.cols;
      let newRows = this.solarGrid.rows;
      
      // Bevorzuge Spalten-Erweiterung (horizontal wachsen)
      while (newCols * newRows < targetCount) {
        if (newCols <= newRows) {
          newCols++;
        } else {
          newRows++;
        }
      }
      
      
      // Aktualisiere Grid-Dimensionen
      this.solarGrid.cols = newCols;
      this.solarGrid.rows = newRows;
      
      // Erweitere bestehende Auswahl-Matrix
      const oldSelection = this.solarGrid.selection || [];
      this.solarGrid.selection = Array.from({ length: newRows }, (_, y) =>
        Array.from({ length: newCols }, (_, x) => {
          // Behalte bestehende Auswahl bei
          if (y < oldSelection.length && x < oldSelection[y].length) {
            return oldSelection[y][x];
          }
          return false;
        })
      );
      
      // Grid neu aufbauen
      this.solarGrid.updateSize();
    }
    
    applyRowConfiguration(rowConfig, intelligentDistribution = null) {
      if (intelligentDistribution) {
      }
      
      const { rows, modulesPerRow, spacing, totalModules } = rowConfig;
      
      // Stelle sicher, dass das Grid die richtige Größe hat
      const neededRows = rows + (rows - 1) * spacing;
      const neededCols = modulesPerRow;
      
      if (this.solarGrid.rows < neededRows || this.solarGrid.cols < neededCols) {
        this.expandGridForRowConfig(neededCols, neededRows);
      }
      
      // Lösche bestehende Auswahl
      for (let y = 0; y < this.solarGrid.rows; y++) {
        for (let x = 0; x < this.solarGrid.cols; x++) {
          if (!this.solarGrid.selection[y]) this.solarGrid.selection[y] = [];
          this.solarGrid.selection[y][x] = false;
        }
      }
      
      // Selektiere Module in Reihen mit intelligenter Verteilung
      let currentRow = 0;
      let modulesPlaced = 0;
      
      for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
        let modulesInThisRow;
        
        if (intelligentDistribution) {
          // Intelligente Verteilung: Gleichmäßig verteilen + Reste von oben
          const { baseModulesPerRow, extraModules } = intelligentDistribution;
          modulesInThisRow = baseModulesPerRow + (rowIndex < extraModules ? 1 : 0);
        } else {
          // Standard: Alle Reihen gleich voll
          modulesInThisRow = Math.min(modulesPerRow, totalModules - modulesPlaced);
        }
        
        // Selektiere Module in dieser Reihe
        for (let x = 0; x < modulesInThisRow && x < this.solarGrid.cols; x++) {
          if (currentRow < this.solarGrid.rows) {
            this.solarGrid.selection[currentRow][x] = true;
            modulesPlaced++;
          }
        }
        
        
        // Springe über Abstand-Reihen
        currentRow += 1 + spacing;
      }
      
      
      // Grid neu aufbauen
      this.solarGrid.buildGrid();
      this.solarGrid.buildList();
      this.solarGrid.updateSummaryOnChange();
    }
    
    expandGridForRowConfig(neededCols, neededRows) {
      const oldSelection = this.solarGrid.selection || [];
      
      // Aktualisiere Grid-Dimensionen
      this.solarGrid.cols = Math.max(this.solarGrid.cols, neededCols);
      this.solarGrid.rows = Math.max(this.solarGrid.rows, neededRows);
      
      // Erweitere Auswahl-Matrix
      this.solarGrid.selection = Array.from({ length: this.solarGrid.rows }, (_, y) =>
        Array.from({ length: this.solarGrid.cols }, (_, x) => {
          // Behalte bestehende Auswahl bei
          if (y < oldSelection.length && x < oldSelection[y].length) {
            return oldSelection[y][x];
          }
          return false;
        })
      );
      
      // Grid neu aufbauen
      this.solarGrid.updateSize();
    }
  }

  // ===== BULK SELECTOR =====
  class BulkSelector {
    constructor(solarGrid) {
      this.solarGrid = solarGrid;
      this.firstClick = null;
      this.isSelecting = false;
      this.bulkMode = false; // Neuer Toggle-Modus für Shift
      this.setupKeyListener();
    }

    setupKeyListener() {
      // Globaler Keyboard-Listener für Shift-Toggle
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift' && !e.repeat) {
          this.toggleBulkMode();
        }
      });
    }

    toggleBulkMode() {
      this.bulkMode = !this.bulkMode;
      
      if (this.bulkMode) {
        this.showBulkModeIndicator(true);
        this.firstClick = null; // Reset bei Aktivierung
      } else {
        this.showBulkModeIndicator(false);
        this.firstClick = null;
        this.clearHighlight();
      }
    }

    showBulkModeIndicator(active) {
      // Entferne bestehende Indikatoren
      document.querySelectorAll('.bulk-mode-indicator').forEach(el => el.remove());
      
      if (active) {
        const indicator = document.createElement('div');
        indicator.className = 'bulk-mode-indicator';
        indicator.innerHTML = '🔄 Bulk-Modus aktiv - Klicke auf zwei Zellen um einen Bereich auszuwählen';
        indicator.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #f5a623;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(245, 166, 35, 0.3);
          animation: slideIn 0.3s ease;
        `;
        
        // Animation hinzufügen
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(indicator);
      }
    }

    initializeBulkSelection() {
      // Erweitere die bestehende Grid-Erstellung
      const originalBuildGrid = this.solarGrid.buildGrid.bind(this.solarGrid);
      
      this.solarGrid.buildGrid = () => {
        originalBuildGrid();
        // Warte kurz bis DOM aktualisiert ist, dann füge Bulk Selection hinzu
        setTimeout(() => {
          this.addBulkSelectionToGrid();
        }, 10);
      };
      
      // Initialisiere Bulk Selection auch für das bestehende Grid
      setTimeout(() => {
        this.addBulkSelectionToGrid();
      }, 100);
    }

    addBulkSelectionToGrid() {
      const cells = this.solarGrid.gridEl.querySelectorAll('.grid-cell');
      
      cells.forEach((cell, index) => {
        const x = index % this.solarGrid.cols;
        const y = Math.floor(index / this.solarGrid.cols);
        
        // Entferne alte Event Listener
        const newCell = cell.cloneNode(true);
        cell.parentNode.replaceChild(newCell, cell);
        
        // Füge neue Event Listener hinzu
        newCell.addEventListener('click', (e) => {
          if (this.bulkMode) {
            // Bulk-Modus aktiv
            if (!this.firstClick) {
              // Erste Zelle markieren und ihren aktuellen Zustand speichern
              const isCurrentlySelected = this.solarGrid.selection[y]?.[x] || false;
              this.firstClick = { x, y, wasSelected: isCurrentlySelected };
              newCell.classList.add('first-click-marker');
            } else {
              // Zweite Zelle: Bereich auswählen
              this.selectRange(this.firstClick, { x, y });
              
              // Bulk-Modus deaktivieren nach Auswahl
              this.bulkMode = false;
              this.showBulkModeIndicator(false);
              this.firstClick = null;
              this.clearFirstClickMarker();
            }
          } else {
            // Normaler Click-Modus
            if (!this.solarGrid.selection[y]) this.solarGrid.selection[y] = [];
            
            if (e.ctrlKey || e.metaKey) {
              // Ctrl+Click: Toggle ohne firstClick zu ändern
              this.solarGrid.selection[y][x] = !this.solarGrid.selection[y][x];
            } else {
              // Normaler Click: Toggle
              this.solarGrid.selection[y][x] = !this.solarGrid.selection[y][x];
            }
            
            newCell.classList.toggle('selected');
            this.solarGrid.trackInteraction();
            this.solarGrid.buildList();
            this.solarGrid.updateSummaryOnChange();
          }
        });

        // Visuelle Feedback für Bereich-Auswahl
        newCell.addEventListener('mouseenter', (e) => {
          if (this.bulkMode && this.firstClick) {
            this.highlightRange(this.firstClick, { x, y });
          }
        });

        newCell.addEventListener('mouseleave', () => {
          this.clearHighlight();
        });
      });
    }

    selectRange(start, end) {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      // Wenn die erste Zelle ausgewählt war, deselektiere den gesamten Bereich
      // Wenn die erste Zelle leer war, wähle den gesamten Bereich aus
      const shouldSelect = !start.wasSelected;
      

      for (let y = minY; y <= maxY; y++) {
        if (!this.solarGrid.selection[y]) this.solarGrid.selection[y] = [];
        for (let x = minX; x <= maxX; x++) {
          this.solarGrid.selection[y][x] = shouldSelect;
        }
      }

      this.solarGrid.buildGrid();
      this.solarGrid.buildList();
      this.solarGrid.updateSummaryOnChange();
    }

    highlightRange(start, end) {
      this.clearHighlight();
      
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      const cells = this.solarGrid.gridEl.querySelectorAll('.grid-cell');
      
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const index = y * this.solarGrid.cols + x;
          if (cells[index]) {
            cells[index].classList.add('bulk-highlight');
          }
        }
      }
    }

    clearHighlight() {
      const highlighted = this.solarGrid.gridEl.querySelectorAll('.bulk-highlight');
      highlighted.forEach(cell => cell.classList.remove('bulk-highlight'));
    }

    clearFirstClickMarker() {
      const cells = this.solarGrid.gridEl.querySelectorAll('.grid-cell');
      cells.forEach(cell => cell.classList.remove('first-click-marker'));
    }
  }

  class SolarGrid {
    constructor() {
      this.gridEl        = document.getElementById('grid');
      this.wrapper       = document.querySelector('.grid-wrapper');
      this.wIn           = document.getElementById('width-input');
      this.hIn           = document.getElementById('height-input');
      this.orH           = document.getElementById('orient-h');
      this.orV           = document.getElementById('orient-v');
      this.incM          = document.getElementById('include-modules');
      this.mc4           = document.getElementById('mc4');
      this.solarkabel    = document.getElementById('solarkabel');
      this.holz          = document.getElementById('holz');
      this.listHolder    = document.querySelector('.produktliste-holder');
      this.prodList      = document.getElementById('produktliste');
      this.summaryHolder = document.getElementById('summary-list-holder');
      this.summaryList   = document.getElementById('summary-list');
      this.saveBtn       = document.getElementById('save-config-btn');
      this.addBtn        = document.getElementById('add-to-cart-btn');
      this.summaryBtn    = document.getElementById('summary-add-cart-btn');
      this.configListEl  = document.getElementById('config-list');
      this.resetBtn 		 = document.getElementById('reset-btn');
      this.continueLaterBtn = document.getElementById('continue-later-btn');

      this.selection     = [];
      this.configs       = [];
      this.currentConfig = null;
      this.default       = { cols:5, rows:5, width:176, height:113 };
      
      // Tracking für Session-Daten
      this.sessionId = this.generateSessionId();
      this.sessionStartTime = Date.now();
      this.firstInteractionTime = null;
      this.lastInteractionTime = Date.now();
      this.interactionCount = 0;
      this.webhookUrl = 'https://hook.eu2.make.com/c7lkudk1v2a2xsr291xbvfs2cb25b84k';

      this.init();
    }

    // ===== WEBHOOK FUNKTIONEN =====
    
    generateSessionId() {
      // Generiere eine einzigartige Session-ID basierend auf Timestamp und Zufallszahl
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substr(2, 9);
      return `session_${timestamp}_${randomPart}`;
    }
    
    trackInteraction() {
      if (!this.firstInteractionTime) {
        this.firstInteractionTime = Date.now();
      }
      this.lastInteractionTime = Date.now();
      this.interactionCount++;
    }

    formatDuration(milliseconds) {
      if (!milliseconds || milliseconds < 0) return "00:00:00";
      
      const totalSeconds = Math.floor(milliseconds / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    getSessionData() {
      const now = Date.now();
      const sessionDurationMs = now - this.sessionStartTime;
      const timeToFirstInteractionMs = this.firstInteractionTime ? this.firstInteractionTime - this.sessionStartTime : 0;
      const timeSinceLastInteractionMs = now - this.lastInteractionTime;
      
      return {
        sessionDuration: this.formatDuration(sessionDurationMs),
        timeToFirstInteraction: this.formatDuration(timeToFirstInteractionMs),
        timeSinceLastInteraction: this.formatDuration(timeSinceLastInteractionMs),
        interactionCount: this.interactionCount,
        sessionStartTime: this.sessionStartTime,
        firstInteractionTime: this.firstInteractionTime,
        lastInteractionTime: this.lastInteractionTime
      };
    }

    getProductSummary() {
      const parts = this.calculateParts();
      if (!this.incM.checked) delete parts.Solarmodul;
      if (this.mc4.checked)   parts.MC4_Stecker   = this.selection.flat().filter(v => v).length;
      if (this.solarkabel.checked) parts.Solarkabel = 1; // 1x wenn ausgewählt
      if (this.holz.checked)  parts.Holzunterleger = (parts['Schiene_240_cm'] || 0) + (parts['Schiene_360_cm'] || 0);

      const entries = Object.entries(parts).filter(([,v]) => v > 0);
      let totalPrice = 0;
      const productQuantities = {};
      
      // Berechne Preise und sammle Quantities
      entries.forEach(([k,v]) => {
        const packs = Math.ceil(v / VE[k]);
        const price = getPriceFromCache(k);
        const itemTotal = packs * price;
        totalPrice += itemTotal;
        
        // Verwende den Produktnamen ohne Unterstriche als Key
        const productKey = k.replace(/_/g, '');
        productQuantities[productKey] = v;
      });

      return { 
        productQuantities,
        totalPrice 
      };
    }

    generateGridVisualization(selection, cols, rows, cellWidth, cellHeight) {
      // Generate HTML for the grid
      let html = `<div class="grid" style="--cols: ${cols}; --rows: ${rows}; --cell-size: ${cellWidth}px; --cell-height: ${cellHeight}px; --cell-gap: 2px;">`;
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const isSelected = selection[y] && selection[y][x];
          const cellClass = isSelected ? 'cell selected' : 'cell';
          html += `<div class="${cellClass}"></div>`;
        }
      }
      
      html += '</div>';
      
      // Generate CSS for the grid
      const css = `.grid { 
        display: grid; 
        gap: var(--cell-gap); 
        grid-template-columns: repeat(var(--cols), var(--cell-size)); 
        grid-template-rows: repeat(var(--rows), var(--cell-height)); 
        margin: auto; 
        background: transparent; 
      } 
      .cell { 
        background: #000000; 
        border-radius: 6px; 
        width: var(--cell-size); 
        height: var(--cell-height); 
        transition: all 0.15s ease; 
      } 
      .cell.selected { 
        background: #7f7f7f; 
      }`;
      
      return { html, css };
    }

    getConfigData(config = null) {
      const targetConfig = config || {
        cols: this.cols,
        rows: this.rows,
        cellWidth: parseInt(this.wIn.value, 10),
        cellHeight: parseInt(this.hIn.value, 10),
        orientation: this.orV.checked ? 'vertical' : 'horizontal',
        selection: this.selection,
        incM: this.incM.checked,
        mc4: this.mc4.checked,
        solarkabel: this.solarkabel.checked,
        holz: this.holz.checked
      };

      const summary = this.getProductSummary();
      const gridVisualization = this.generateGridVisualization(
        targetConfig.selection, 
        targetConfig.cols, 
        targetConfig.rows, 
        targetConfig.cellWidth, 
        targetConfig.cellHeight
      );
      
      return {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        sessionData: this.getSessionData(),
        config: {
          cols: targetConfig.cols,
          rows: targetConfig.rows,
          cellWidth: targetConfig.cellWidth,
          cellHeight: targetConfig.cellHeight,
          orientation: targetConfig.orientation,
          gridVisualization: gridVisualization,
          options: {
            includeModules: targetConfig.incM,
            mc4Connectors: targetConfig.mc4,
            solarkabel: targetConfig.solarkabel,
            woodUnderlay: targetConfig.holz
          }
        },
        summary: summary,
        analytics: {
          totalCells: targetConfig.cols * targetConfig.rows,
          selectedCells: targetConfig.selection.flat().filter(v => v).length,
          selectionPercentage: ((targetConfig.selection.flat().filter(v => v).length / (targetConfig.cols * targetConfig.rows)) * 100).toFixed(2),
          gridArea: targetConfig.cols * targetConfig.rows,
          averageCellSize: ((targetConfig.cellWidth + targetConfig.cellHeight) / 2).toFixed(2)
        }
      };
    }

    async sendConfigToWebhook(configData) {
      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(configData)
        });

        if (response.ok) {
          return true;
        } else {
          return false;
        }
      } catch (error) {
        return false;
      }
    }

    async sendCurrentConfigToWebhook() {
      const configData = this.getConfigData();
      return await this.sendConfigToWebhook(configData);
    }

    async sendAllConfigsToWebhook() {
      const results = [];
      let successCount = 0;

      // Sende jede Konfiguration einzeln
      for (let idx = 0; idx < this.configs.length; idx++) {
        const cfg = this.configs[idx];
        
        // Für die aktuell bearbeitete Konfiguration: Verwende aktuelle Werte
        let currentConfig;
        if (idx === this.currentConfig) {
          currentConfig = {
            cols: this.cols,
            rows: this.rows,
            cellWidth: parseInt(this.wIn.value, 10),
            cellHeight: parseInt(this.hIn.value, 10),
            orientation: this.orV.checked ? 'vertical' : 'horizontal',
            selection: this.selection,
            incM: this.incM.checked,
            mc4: this.mc4.checked,
            solarkabel: this.solarkabel.checked,
            holz: this.holz.checked
          };
        } else {
          currentConfig = {
            cols: cfg.cols,
            rows: cfg.rows,
            cellWidth: cfg.cellWidth,
            cellHeight: cfg.cellHeight,
            orientation: cfg.orientation,
            selection: cfg.selection,
            incM: cfg.incM,
            mc4: cfg.mc4,
            solarkabel: cfg.solarkabel,
            holz: cfg.holz
          };
        }

        // Temporär setzen für Berechnung
        const originalSelection = this.selection;
        const originalOrientation = this.orV.checked;
        const originalSolarkabel = this.solarkabel.checked;
        const originalIncM = this.incM.checked;
        const originalMc4 = this.mc4.checked;
        const originalHolz = this.holz.checked;
        
        this.selection = currentConfig.selection;
        this.orV.checked = currentConfig.orientation === 'vertical';
        this.orH.checked = !this.orV.checked;
        this.solarkabel.checked = currentConfig.solarkabel;
        this.incM.checked = currentConfig.incM;
        this.mc4.checked = currentConfig.mc4;
        this.holz.checked = currentConfig.holz;

        // Erstelle individuelle Konfigurationsdaten mit getConfigData
        const configData = this.getConfigData(currentConfig);
        
        // Füge zusätzliche Metadaten hinzu
        configData.configIndex = idx;
        configData.configName = cfg.name;
        configData.totalConfigsInSession = this.configs.length;

        // Ursprüngliche Werte wiederherstellen
        this.selection = originalSelection;
        this.orV.checked = originalOrientation;
        this.orH.checked = !originalOrientation;
        this.solarkabel.checked = originalSolarkabel;
        this.incM.checked = originalIncM;
        this.mc4.checked = originalMc4;
        this.holz.checked = originalHolz;

        // Sende einzelne Konfiguration
        try {
          const success = await this.sendConfigToWebhook(configData);
          if (success) {
            successCount++;
          } else {
          }
          results.push(success);
          
          // Kurze Pause zwischen Requests um Server nicht zu überlasten
          if (idx < this.configs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          results.push(false);
        }
      }

      return successCount === this.configs.length;
    }

    checkMobileDevice() {
      // Mobile Device Detection
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                       window.innerWidth <= 768 ||
                       ('ontouchstart' in window && window.innerWidth <= 1024);
      
      if (isMobile) {
        this.showMobileWarning();
      }
    }

    showMobileWarning() {
      const mobileWarning = document.getElementById('mobile-warning');
      const continueBtn = document.getElementById('mobile-continue');
      const closeBtn = document.getElementById('mobile-close');
      
      if (mobileWarning) {
        // Check if user has already dismissed the warning in this session
        const hasSeenWarning = sessionStorage.getItem('mobile-warning-seen');
        
        if (!hasSeenWarning) {
          mobileWarning.classList.remove('hidden');
          
          // Event Listeners für Buttons
          continueBtn?.addEventListener('click', () => {
            mobileWarning.classList.add('hidden');
            sessionStorage.setItem('mobile-warning-seen', 'true');
          });
          
          closeBtn?.addEventListener('click', () => {
            mobileWarning.classList.add('hidden');
            sessionStorage.setItem('mobile-warning-seen', 'true');
          });
          
          // Schließen bei Klick außerhalb des Modals
          mobileWarning.addEventListener('click', (e) => {
            if (e.target === mobileWarning) {
              mobileWarning.classList.add('hidden');
              sessionStorage.setItem('mobile-warning-seen', 'true');
            }
          });
        }
      }
    }

    init() {
      // Mobile Detection und Warning
      this.checkMobileDevice();
      
      const params = new URLSearchParams(window.location.search);
  		const rawData = params.get('configData');
  		if (rawData) {
    		try {
      		const json = decodeURIComponent(atob(rawData));
      		const configs = JSON.parse(json);
      		// Lade alle Konfigurationen aus der URL
      		if (Array.isArray(configs)) {
      			this.configs = configs;
      			this.loadConfig(0); // Lade die erste Konfiguration
      		} else {
      			// Einzelne Konfiguration (alte URL-Format)
      			this.configs.push(configs);
      			this.loadConfig(0);
      		}
      		return;
    		} catch (e) {
    		}
  		}

  		[this.wIn, this.hIn].forEach(el =>
    		el.addEventListener('change', () => {
      		this.trackInteraction();
      		this.updateSize();
      		this.buildList();
      		this.updateSummaryOnChange();
    		})
  		);
      
      let lastOrientation = this.orH.checked ? 'horizontal' : 'vertical';

			[this.orH, this.orV].forEach(el =>
  			el.addEventListener('change', () => {

    			if (!el.checked) return;

    			const currentOrientation = el === this.orH ? 'horizontal' : 'vertical';

    			if (currentOrientation === lastOrientation) return;

    			// KEINE Input-Werte mehr tauschen - sie bleiben wie sie sind
    			// Nur das Grid und die Liste aktualisieren
    			this.trackInteraction();
    			this.updateSize();
    			this.buildList();
    			this.updateSummaryOnChange();

    			lastOrientation = currentOrientation;
  			})
			);

  		[this.incM, this.mc4, this.solarkabel, this.holz].forEach(el =>
    		el.addEventListener('change', () => {
      		this.trackInteraction();
      		this.buildList();
      		this.updateSummaryOnChange();
      		this.renderProductSummary(); // Aktualisiere auch die Summary aller Konfigurationen
    		})
  		);
      
      // Event-Listener für die Grid-Expansion-Buttons
			// Spalten-Buttons - rechts (fügt am Ende hinzu)
			document.querySelectorAll('.btn-add-col-right').forEach(btn => {
				btn.addEventListener('click', () => {
					this.trackInteraction();
					this.addColumnRight();
				});
			});
			document.querySelectorAll('.btn-remove-col-right').forEach(btn => {
				btn.addEventListener('click', () => {
					this.trackInteraction();
					this.removeColumnRight();
				});
			});
			
			// Spalten-Buttons - links (fügt am Anfang hinzu)
			document.querySelectorAll('.btn-add-col-left').forEach(btn => {
				btn.addEventListener('click', () => {
					this.trackInteraction();
					this.addColumnLeft();
				});
			});
			document.querySelectorAll('.btn-remove-col-left').forEach(btn => {
				btn.addEventListener('click', () => {
					this.trackInteraction();
					this.removeColumnLeft();
				});
			});
			
			// Zeilen-Buttons - unten (fügt am Ende hinzu)
			document.querySelectorAll('.btn-add-row-bottom').forEach(btn => {
				btn.addEventListener('click', () => {
					this.trackInteraction();
					this.addRowBottom();
				});
			});
			document.querySelectorAll('.btn-remove-row-bottom').forEach(btn => {
				btn.addEventListener('click', () => {
					this.trackInteraction();
					this.removeRowBottom();
				});
			});
			
			// Zeilen-Buttons - oben (fügt am Anfang hinzu)
			document.querySelectorAll('.btn-add-row-top').forEach(btn => {
				btn.addEventListener('click', () => {
					this.trackInteraction();
					this.addRowTop();
				});
			});
			document.querySelectorAll('.btn-remove-row-top').forEach(btn => {
				btn.addEventListener('click', () => {
					this.trackInteraction();
					this.removeRowTop();
				});
			});

  		this.saveBtn.addEventListener('click', () => {
  			this.trackInteraction();
  			this.saveNewConfig();
  		});
  		this.addBtn.addEventListener('click', () => {
  			this.trackInteraction();
  			this.addCurrentToCart();
  		});
  		this.summaryBtn.addEventListener('click', () => {
  			this.trackInteraction();
  			this.addAllToCart();
  		});
  		this.resetBtn.addEventListener('click', () => {
  			this.trackInteraction();
  			this.resetGridToDefault();
  		});
  		this.continueLaterBtn.addEventListener('click', () => {
  			this.trackInteraction();
  			this.generateContinueLink();
  		});

  		window.addEventListener('resize', () => {
    		this.updateSize();
    		this.buildGrid();
    		this.buildList();
    		this.updateSummaryOnChange();
  		});
      
        		// Wenn keine Konfigurationen aus URL geladen wurden, erstelle eine Standard-Konfiguration
  		if (this.configs.length === 0) {
  			this.cols = this.default.cols;
  			this.rows = this.default.rows;
  			this.setup();

  			const defaultConfig = this._makeConfigObject();
  			this.configs.push(defaultConfig);
  			this.loadConfig(0);
			}
			
			// Initialisiere Smart Config Features
			this.initSmartConfigFeatures();
		}
		
		initSmartConfigFeatures() {
			this.smartParser = new SmartConfigParser(this);
			this.bulkSelector = new BulkSelector(this);
			this.bulkSelector.initializeBulkSelection();
			
			// Quick Config Event Listeners
			this.initQuickConfigInterface();
			
			// Stelle sicher, dass Smart Config und Tipps permanent sichtbar sind
			this.ensurePermanentVisibility();
			
			// Initialisiere zusätzliche Features (aber deaktiviert für permanente Sichtbarkeit)
			this.checkAndHideHelp();
			this.initSmartConfigCloseButton();
		}
		
		ensurePermanentVisibility() {
			// Stelle sicher, dass Tipps permanent sichtbar sind
			setTimeout(() => {
				const usageTips = document.querySelector('.usage-tips');
				if (usageTips) {
					usageTips.style.display = 'block';
					usageTips.classList.remove('hidden');
				}
				
				// Stelle sicher, dass Smart Config Container permanent sichtbar sind
				const smartConfigContainers = document.querySelectorAll('.smart-config-container');
				smartConfigContainers.forEach(container => {
					container.style.display = 'block';
					container.classList.remove('hidden');
				});
				
				// Entferne localStorage-Einstellungen, die das Verstecken verursachen
				localStorage.removeItem('solarTool_hideHelp');
				localStorage.removeItem('solarTool_hideSmartConfig');
				
			}, 100);
		}
		
		checkAndHideHelp() {
			// Tipps sollen permanent sichtbar bleiben - diese Funktion wird deaktiviert
			// const shouldHideHelp = localStorage.getItem('solarTool_hideHelp');
			// if (shouldHideHelp === 'true') {
			// 	setTimeout(() => {
			// 		const helpSection = document.querySelector('.bulk-selection-help');
			// 		if (helpSection) {
			// 			helpSection.style.display = 'none';
			// 		}
			// 	}, 600);
			// }
		}
		
		initSmartConfigCloseButton() {
			setTimeout(() => {
				const closeButton = document.getElementById('smart-config-close');
				const container = document.querySelector('.smart-config-container');
				if (closeButton && container) {
					closeButton.addEventListener('click', () => {
						// Smart Config Container soll permanent sichtbar bleiben - Close-Button deaktiviert
						// container.style.display = 'none';
						// localStorage.setItem('solarTool_hideSmartConfig', 'true');
					});
				}
			}, 600);
		}

		initQuickConfigInterface() {
			// Warte kurz, damit das DOM vollständig geladen ist
			setTimeout(() => {
				const quickInput = document.getElementById('quick-config-input');
				const applyButton = document.getElementById('apply-quick-config');
				
				if (quickInput && applyButton) {
					applyButton.addEventListener('click', () => {
						const input = quickInput.value.trim();
						if (input) {
							try {
								const config = this.smartParser.parseInput(input);
								this.smartParser.applyConfiguration(config);
								this.showToast(`Konfiguration "${input}" angewendet ✅`, 2000);
								quickInput.value = ''; // Input leeren
							} catch (error) {
								this.showToast(`Fehler: Konfiguration konnte nicht angewendet werden ❌`, 2000);
							}
						}
					});
					
					// Enter-Taste Support
					quickInput.addEventListener('keypress', (e) => {
						if (e.key === 'Enter') {
							applyButton.click();
						}
					});
					
					// Live-Vorschau beim Tippen (optional)
					quickInput.addEventListener('input', (e) => {
						const input = e.target.value.trim();
						if (input.length > 3) {
							try {
								const config = this.smartParser.parseInput(input);
								this.showConfigPreview(config);
							} catch (error) {
								// Ignoriere Parsing-Fehler während des Tippens
							}
						}
					});
					
				} else {
				}
			}, 500);
		}
		
		showConfigPreview(config) {
			// Optional: Zeige eine kleine Vorschau der erkannten Konfiguration
			const preview = document.getElementById('config-preview');
			if (preview && (config.cols || config.moduleCount)) {
				let previewText = '';
				if (config.cols && config.rows) {
					previewText += `${config.cols}×${config.rows} Grid`;
				}
				if (config.moduleCount) {
					previewText += ` (${config.moduleCount} Module)`;
				}
				if (config.orientation !== 'horizontal') {
					previewText += `, ${config.orientation}`;
				}
				if (config.mc4 || config.cable || config.wood) {
					const extras = [];
					if (config.mc4) extras.push('MC4');
					if (config.cable) extras.push('Kabel');
					if (config.wood) extras.push('Holz');
					previewText += ` + ${extras.join(', ')}`;
				}
				preview.textContent = previewText;
				preview.style.display = previewText ? 'block' : 'none';
			}
		}

		initQuickConfigInterface() {
			// Warte kurz, damit das DOM vollständig geladen ist
			setTimeout(() => {
				const quickInput = document.getElementById('quick-config-input');
				const applyButton = document.getElementById('apply-quick-config');
				
				if (quickInput && applyButton) {
					applyButton.addEventListener('click', () => {
						const input = quickInput.value.trim();
						if (input) {
							try {
								const config = this.smartParser.parseInput(input);
								this.smartParser.applyConfiguration(config);
								this.showToast(`Konfiguration "${input}" angewendet ✅`, 2000);
								quickInput.value = ''; // Input leeren
							} catch (error) {
								this.showToast(`Fehler: Konfiguration konnte nicht angewendet werden ❌`, 2000);
							}
						}
					});
					
					// Enter-Taste Support
					quickInput.addEventListener('keypress', (e) => {
						if (e.key === 'Enter') {
							applyButton.click();
						}
					});
					
					// Live-Vorschau beim Tippen (optional)
					quickInput.addEventListener('input', (e) => {
						const input = e.target.value.trim();
						if (input.length > 3) {
							try {
								const config = this.smartParser.parseInput(input);
								this.showConfigPreview(config);
							} catch (error) {
								// Ignoriere Parsing-Fehler während des Tippens
							}
						}
					});
					
				} else {
				}
			}, 500);
		}
		
		showConfigPreview(config) {
			// Optional: Zeige eine kleine Vorschau der erkannten Konfiguration
			const preview = document.getElementById('config-preview');
			if (preview && (config.cols || config.moduleCount)) {
				let previewText = '';
				if (config.cols && config.rows) {
					previewText += `${config.cols}×${config.rows} Grid`;
				}
				if (config.moduleCount) {
					previewText += ` (${config.moduleCount} Module)`;
				}
				if (config.orientation !== 'horizontal') {
					previewText += `, ${config.orientation}`;
				}
				if (config.mc4 || config.cable || config.wood) {
					const extras = [];
					if (config.mc4) extras.push('MC4');
					if (config.cable) extras.push('Kabel');
					if (config.wood) extras.push('Holz');
					previewText += ` + ${extras.join(', ')}`;
				}
				preview.textContent = previewText;
				preview.style.display = previewText ? 'block' : 'none';
			}
		}
    
    setup() {
  		// Verwende Standard-Werte falls nicht bereits gesetzt
  		if (!this.cols || !this.rows) {
  			this.cols = this.default.cols;
  			this.rows = this.default.rows;
  		}
  		if (!this.cols || !this.rows) {
    		alert('Spalten und Zeilen müssen > 0 sein');
    		return;
  		}

  		// Nur dann eine neue leere Auswahl erstellen, wenn noch keine existiert oder die Dimensionen nicht stimmen
    	if (
    		!Array.isArray(this.selection) ||
    		this.selection.length !== this.rows ||
    		this.selection[0]?.length !== this.cols
  		) {
    		const oldSel = this.selection;
    		this.selection = Array.from({ length: this.rows }, (_, y) =>
      		Array.from({ length: this.cols }, (_, x) => oldSel?.[y]?.[x] || false)
    		);
  		}

  		this.listHolder.style.display = 'block';
  		this.updateSize();
  		this.buildGrid();
  		this.buildList();
  		this.renderProductSummary();
  		this.updateSaveButtons();
		}

    updateSaveButtons() {
  		// Immer den "Neue Konfiguration speichern" Button anzeigen
  		this.saveBtn.style.display = 'inline-block';
		}
    

    
    // Spalten-Methoden - Rechts (am Ende)
    addColumnRight() {
  		this.cols += 1;
  		for (let row of this.selection) {
    		row.push(false);
  		}
  		this.updateGridAfterStructureChange();
		}

		removeColumnRight() {
  		if (this.cols <= 1) return;
  		this.cols -= 1;
  		for (let row of this.selection) {
    		row.pop();
  		}
  		this.updateGridAfterStructureChange();
		}

		// Spalten-Methoden - Links (am Anfang)
		addColumnLeft() {
  		this.cols += 1;
  		for (let row of this.selection) {
    		row.unshift(false);
  		}
  		this.updateGridAfterStructureChange();
		}

		removeColumnLeft() {
  		if (this.cols <= 1) return;
  		this.cols -= 1;
  		for (let row of this.selection) {
    		row.shift();
  		}
  		this.updateGridAfterStructureChange();
		}

		// Zeilen-Methoden - Unten (am Ende)
		addRowBottom() {
  		this.rows += 1;
  		this.selection.push(Array(this.cols).fill(false));
  		this.updateGridAfterStructureChange();
		}

		removeRowBottom() {
  		if (this.rows <= 1) return;
  		this.rows -= 1;
  		this.selection.pop();
  		this.updateGridAfterStructureChange();
		}

		// Zeilen-Methoden - Oben (am Anfang)
		addRowTop() {
  		this.rows += 1;
  		this.selection.unshift(Array(this.cols).fill(false));
  		this.updateGridAfterStructureChange();
		}

		removeRowTop() {
  		if (this.rows <= 1) return;
  		this.rows -= 1;
  		this.selection.shift();
  		this.updateGridAfterStructureChange();
				}

    updateGridAfterStructureChange() {
  		this.updateSize();
  		this.buildGrid();
  		this.buildList();
  		this.updateSummaryOnChange();
		}
    

    

    updateSize() {
  		const RAIL_GAP = 2; // Immer 2cm für Schienen-Berechnungen
  		const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);

  		// Original Zellengrößen aus Input - bei Orientierung entsprechend anwenden
  		const inputW = parseInt(this.wIn.value, 10) || 179;
  		const inputH = parseInt(this.hIn.value, 10) || 113;
  		
  		// Bei vertikaler Orientierung: Breite und Höhe der Zellen tauschen
  		const isVertical = this.orV.checked;
  		const originalCellW = isVertical ? inputH : inputW;
  		const originalCellH = isVertical ? inputW : inputH;
  		
  		// Maximale verfügbare Größe
  		// 50px Abstand auf allen Seiten: links, rechts, oben, unten
  		// Insgesamt 100px für Breite (50px links + 50px rechts) und 100px für Höhe (50px oben + 50px unten)
  		const maxWidth = this.wrapper.clientWidth - 100; // grid-wrapper Breite - 100px (50px links + 50px rechts)
  		const maxHeight = this.wrapper.clientHeight - 100; // grid-wrapper Höhe - 100px (50px oben + 50px unten)
  		
  		// Berechne benötigte Gesamtgröße mit Original-Zellgrößen (inklusive Gaps für Schienen)
  		const totalWidthWithRailGaps = this.cols * originalCellW + (this.cols - 1) * RAIL_GAP;
  		const totalHeightWithRailGaps = this.rows * originalCellH + (this.rows - 1) * RAIL_GAP;
  		
  		// Berechne Skalierungsfaktoren für beide Dimensionen
  		const scaleX = maxWidth / totalWidthWithRailGaps;
  		const scaleY = maxHeight / totalHeightWithRailGaps;
  		
  		// Verwende den kleineren Skalierungsfaktor, um Proportionen zu erhalten
  		// und sicherzustellen, dass das Grid nie die Grenzen überschreitet
  		const scale = Math.min(scaleX, scaleY, 1);
  		
  		// Berechne finale Zellgrößen
  		const w = originalCellW * scale;
  		const h = originalCellH * scale;

  		// Bestimme visuelle Gap: 0 wenn viele Spalten/Zeilen, sonst RAIL_GAP * scale
  		// Gap verschwindet horizontal ab 15 Spalten, vertikal ab 10 Zeilen
  		const shouldHideGap = this.cols >= 15 || this.rows >= 10;
  		const visualGap = shouldHideGap ? 0 : RAIL_GAP * scale;

  		// CSS Variablen setzen
  		document.documentElement.style.setProperty('--cell-size', w + 'px');
  		document.documentElement.style.setProperty('--cell-width',  w + 'px');
  		document.documentElement.style.setProperty('--cell-height', h + 'px');
  		document.documentElement.style.setProperty('--cell-gap', visualGap + 'px');

  		// Grid-Größe direkt setzen - niemals größer als die maximalen Grenzen
  		const finalWidth = Math.min(this.cols * w + (this.cols - 1) * visualGap, maxWidth);
  		const finalHeight = Math.min(this.rows * h + (this.rows - 1) * visualGap, maxHeight);
  		
  		this.gridEl.style.width = finalWidth + 'px';
  		this.gridEl.style.height = finalHeight + 'px';
		}

    buildGrid() {
  		if (!Array.isArray(this.selection)) return;
  		this.gridEl.innerHTML = '';
  		document.documentElement.style.setProperty('--cols', this.cols);
  		document.documentElement.style.setProperty('--rows', this.rows);

  		const centerX = (this.cols - 1) / 2;
  		const centerY = (this.rows - 1) / 2;
  		const delayPerUnit = 60; // ms

  		for (let y = 0; y < this.rows; y++) {
    		if (!Array.isArray(this.selection[y])) continue;

    		for (let x = 0; x < this.cols; x++) {
      		const cell = document.createElement('div');
      		cell.className = 'grid-cell animate-in';
      		if (this.selection[y]?.[x]) cell.classList.add('selected');

      		cell.addEventListener('click', () => {
        		if (!this.selection[y]) this.selection[y] = [];
        		this.selection[y][x] = !this.selection[y][x];
        		cell.classList.toggle('selected');
        		this.trackInteraction();
        		this.buildList();
        		this.updateSummaryOnChange();
      		});

      		const dx = x - centerX;
      		const dy = y - centerY;
      		const distance = Math.sqrt(dx * dx + dy * dy);
      		const delay = distance * delayPerUnit;
      		cell.style.animationDelay = `${delay}ms`;

      		setTimeout(() => cell.classList.remove('animate-in'), 400);
      		this.gridEl.appendChild(cell);
    		}
  		}
		}
    
    async buildList() {
      try {
        const parts = await this.calculateParts();
        if (!this.incM.checked) delete parts.Solarmodul;
        if (this.mc4.checked) {
          const panelCount = this.selection.flat().filter(v => v).length;
          parts.MC4_Stecker = Math.ceil(panelCount / 30); // 1 Packung pro 30 Panele
        }
        if (this.solarkabel.checked) parts.Solarkabel = 1; // 1x wenn ausgewählt
        if (this.holz.checked)  parts.Holzunterleger = (parts['Schiene_240_cm'] || 0) + (parts['Schiene_360_cm'] || 0);

        const entries = Object.entries(parts).filter(([,v]) => v > 0);
        if (!entries.length) {
          this.listHolder.style.display = 'none';
          return;
        }
        this.listHolder.style.display = 'block';
        this.prodList.innerHTML = entries.map(([k,v]) => {
          const packs = Math.ceil(v / VE[k]);
          return `<div class="produkt-item">
            <span>${packs}×</span>
            <img src="${this.mapImage(k)}" alt="${k}" onerror="this.src='https://via.placeholder.com/32?text=${encodeURIComponent(k)}'">
            <span>${k.replace(/_/g,' ')} (${v})</span>
          </div>`;
        }).join('');
        this.prodList.style.display = 'block';
      } catch (error) {
        // Fallback: Verstecke Liste bei Fehler
        this.listHolder.style.display = 'none';
      }
    }
    
    resetGridToDefault() {
  		const { cols, rows, width, height } = this.default;

  		// Trimme bestehende Auswahl
  		const trimmed = [];
  		for (let y = 0; y < rows; y++) {
    		trimmed[y] = [];
    		for (let x = 0; x < cols; x++) {
      		trimmed[y][x] = this.selection?.[y]?.[x] || false;
    		}
  		}

  		// Setze Inputs und interne Werte
  		this.wIn.value = width;
  		this.hIn.value = height;
  		
  				// Setze Orientierung auf Standard (vertikal wenn im HTML so gesetzt)
		const defaultVertical = document.getElementById('orient-v').hasAttribute('checked');
		this.orH.checked = !defaultVertical;
		this.orV.checked = defaultVertical;

		// Setze alle Checkboxen zurück für neue Konfiguration
		this.incM.checked = false;
		this.mc4.checked = false;
		this.solarkabel.checked = false;
		this.holz.checked = false;

		this.cols = cols;
		this.rows = rows;

  		// Aktualisiere alles ohne Checkboxen zu ändern
  		this.setup();
  		this.selection = trimmed;
  		this.buildGrid();
  		this.buildList();
  		this.updateSummaryOnChange();
		}
    
    resetToDefaultGrid() {
  		this.colsIn.value = this.default.cols;
  		this.rowsIn.value = this.default.rows;
  		this.wIn.value    = this.default.width;
  		this.hIn.value    = this.default.height;
  		this.orH.checked  = true;
  		this.orV.checked  = false;

  		// Setze cols/rows synchron
  		this.cols = this.default.cols;
  		this.rows = this.default.rows;

  		// Leere Auswahl
  		this.selection = Array.from({ length: this.rows }, () =>
    		Array.from({ length: this.cols }, () => false)
  		);

  		this.setup(); // jetzt stimmt alles beim Rebuild
		}
    


    async calculateParts() {
      try {
        const calculationData = {
          selection: this.selection,
          rows: this.rows,
          cols: this.cols,
          cellWidth: parseInt(this.wIn.value, 10) || 179,
          cellHeight: parseInt(this.hIn.value, 10) || 113,
          orientation: this.orV.checked ? 'vertical' : 'horizontal'
        };

        const parts = await calculationManager.calculate('calculateParts', calculationData);
        return parts;
      } catch (error) {
        return this.calculatePartsSync();
      }
    }

    // Fallback synchrone Berechnung (ursprüngliche Methode)
    calculatePartsSync() {
  		const p = {
    		Solarmodul: 0, Endklemmen: 0, Mittelklemmen: 0,
    		Dachhaken: 0, Schrauben: 0, Endkappen: 0,
    		Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0
  		};

  		for (let y = 0; y < this.rows; y++) {
    		if (!Array.isArray(this.selection[y])) continue;
    		let run = 0;

    		for (let x = 0; x < this.cols; x++) {
      		if (this.selection[y]?.[x]) run++;
      		else if (run) { this.processGroup(run, p); run = 0; }
    		}
    		if (run) this.processGroup(run, p);
  		}

  		return p;
		}

    processGroup(len, p) {
      // Verwende die tatsächliche Zellbreite basierend auf Orientierung
      const isVertical = this.orV.checked;
      const cellWidth = isVertical ? 
        parseInt(this.hIn.value, 10) || 113 : 
        parseInt(this.wIn.value, 10) || 179;
      
      const totalLen = len * cellWidth;
      const floor360 = Math.floor(totalLen / 360),
            rem360   = totalLen - floor360 * 360,
            floor240 = Math.ceil(rem360 / 240),
            pure360  = Math.ceil(totalLen / 360),
            pure240  = Math.ceil(totalLen / 240);
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
      p.Schiene_360_cm     += cnt360 * 2;
      p.Schiene_240_cm     += cnt240 * 2;
      p.Schienenverbinder  += (cnt360 + cnt240 - 1) * 4;
      p.Endklemmen         += 4;
      p.Mittelklemmen      += len > 1 ? (len - 1) * 2 : 0;
      p.Dachhaken          += len > 1 ? len * 3 : 4;
      p.Endkappen          += p.Endklemmen;
      p.Solarmodul         += len;
      p.Schrauben         += p.Dachhaken * 2;  // FIX: += statt =
    }

    mapImage(key) {
      const imgs = {
        Solarmodul:        'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
        Endklemmen:        'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c316b21cb7d04ba2ed22_DSC04815-min.jpg',
        Schrauben:         'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c2704f5147533229ccde_DSC04796-min.jpg',
        Dachhaken:         'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c1c8a2835b7879f46811_DSC04760-min.jpg',
        Mittelklemmen:     'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c0d0c2d922d926976bd4_DSC04810-min.jpg',
        Endkappen:         'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bdfbe7cffc653f6a4605_DSC04788-min.jpg',
        Schienenverbinder: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c21f0c39e927fce0db3b_DSC04780-min.jpg',
        Schiene_240_cm:    'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bce018164af4b4a187f1_DSC04825-min.jpg',
        Schiene_360_cm:    'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bcd5726d1d33d4b86ba4_DSC04824-min.jpg',
        MC4_Stecker:       'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/687fcdab153f840ea15b5e7b_iStock-2186771695.jpg',
        Solarkabel:        'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/687fd566bdbb6de2e5f362f0_DSC04851.jpg',
        Holzunterleger:    'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png'
      };
      return imgs[key] || '';
    }
    
    loadConfig(idx) {
  		const cfg = this.configs[idx];
  		this.currentConfig = idx;

  		// Input-Werte setzen
  		this.wIn.value    = cfg.cellWidth;
  		this.hIn.value    = cfg.cellHeight;
  		this.orV.checked  = cfg.orientation === 'vertical';
  		this.orH.checked  = !this.orV.checked;
  		this.incM.checked = cfg.incM;
  		this.mc4.checked  = cfg.mc4;
  		this.solarkabel.checked = cfg.solarkabel || false; // Fallback für alte Konfigurationen
  		this.holz.checked = cfg.holz;

  		// STATE Werte setzen - WICHTIG: Vor setup() setzen
  		this.cols = cfg.cols;
  		this.rows = cfg.rows;
  		this.selection = cfg.selection.map(r => [...r]);

  		// Setup aufrufen (baut Grid mit korrekter Auswahl auf)
  		this.setup();

  		this.renderConfigList();
  		this.updateSaveButtons();
		}
    
    showToast(message = 'Gespeichert ✅', duration = 1500) {
  		const toast = document.getElementById('toast');
  		if (!toast) return;
  		toast.textContent = message;
  		toast.classList.remove('hidden');

  		clearTimeout(this.toastTimeout);
  		this.toastTimeout = setTimeout(() => {
    		toast.classList.add('hidden');
  		}, duration);
		}

    saveNewConfig() {
  		// 1. Aktuelle Auswahl in der vorherigen Konfiguration speichern
  		if (this.currentConfig !== null) {
  			this.updateConfig(); // Speichere aktuelle Änderungen in vorheriger Config
  		}
  		
  		// 2. Temporär currentConfig auf null setzen für neue Konfiguration
  		this.currentConfig = null;
  		
  		// 3. Neue Konfiguration mit leerem Grid erstellen
  		const emptySelection = Array.from({ length: this.rows }, () =>
  			Array.from({ length: this.cols }, () => false)
  		);
  		
  		// 4. Aktuelle Auswahl temporär speichern und durch leere ersetzen
  		const originalSelection = this.selection;
  		this.selection = emptySelection;
  		
  		const cfg = this._makeConfigObject();
  		this.configs.push(cfg);
  		
  		// 5. Neue Konfiguration auswählen und Grid neu aufbauen
  		this.currentConfig = this.configs.length - 1;
  		this.setup(); // Baut Grid mit leerer Auswahl neu auf
  		
  		this.renderConfigList();
  		this.updateSaveButtons();
  		this.showToast(`Neue Konfiguration "${cfg.name}" erstellt ✅`);
		}

    updateConfig() {
      const idx = this.currentConfig;
      this.configs[idx] = this._makeConfigObject();
      this.renderConfigList();
      this.updateSaveButtons();
    }
    
    deleteConfig(configIndex) {
  		const configName = this.configs[configIndex].name;
  		if (!confirm(`Willst du "${configName}" wirklich löschen?`)) return;

  		this.configs.splice(configIndex, 1);
  		
  		// Nach dem Löschen: Wähle die nächste Konfiguration oder erstelle eine neue
  		if (this.configs.length > 0) {
  			// Wenn die gelöschte Konfiguration die aktuelle war
  			if (configIndex === this.currentConfig) {
  				// Wähle die nächste Konfiguration (oder die vorherige wenn es die letzte war)
  				const newIndex = Math.min(configIndex, this.configs.length - 1);
  				this.loadConfig(newIndex);
  			} else if (configIndex < this.currentConfig) {
  				// Eine Konfiguration vor der aktuellen wurde gelöscht, Index anpassen
  				this.currentConfig--;
  				this.renderConfigList();
  			} else {
  				// Eine Konfiguration nach der aktuellen wurde gelöscht, nur Liste neu rendern
  				this.renderConfigList();
  			}
  		} else {
  			// Keine Konfigurationen mehr - erstelle eine neue
  			this.createNewConfig();
  		}

  		this.updateSaveButtons();
		}

    createNewConfig() {
  		// Erstelle eine neue Standard-Konfiguration
  		this.currentConfig = null;
  		this.resetGridToDefault();
  		this.renderConfigList();
  		this.updateSaveButtons();
		}

    _makeConfigObject() {
      // Für neue Konfigurationen: Finde die nächste verfügbare Nummer
      let configName;
      if (this.currentConfig !== null) {
        // Bestehende Konfiguration: Behalte den Namen
        configName = this.configs[this.currentConfig].name;
      } else {
        // Neue Konfiguration: Finde nächste Nummer
        let nextNumber = 1;
        while (this.configs.some(cfg => cfg.name === `Konfiguration ${nextNumber}`)) {
          nextNumber++;
        }
        configName = `Konfiguration ${nextNumber}`;
      }
      
      return {
        name:        configName,
        selection:   this.selection.map(r => [...r]),
        orientation: this.orV.checked ? 'vertical' : 'horizontal',
        incM:        this.incM.checked,
        mc4:         this.mc4.checked,
        solarkabel:  this.solarkabel.checked,
        holz:        this.holz.checked,
        cols:        this.cols,
        rows:        this.rows,
        cellWidth:   parseInt(this.wIn.value, 10),
        cellHeight:  parseInt(this.hIn.value, 10)
      };
    }

    renderConfigList() {
  		this.configListEl.innerHTML = '';
  		this.configs.forEach((cfg, idx) => {
    		const div = document.createElement('div');
    		div.className = 'config-item' + (idx === this.currentConfig ? ' active' : '');
    		div.style.display = 'flex';
    		div.style.alignItems = 'center';
    		div.style.justifyContent = 'space-between';
    		div.style.gap = '0.5rem';

    		const nameContainer = document.createElement('div');
    		nameContainer.style.display = 'flex';
    		nameContainer.style.alignItems = 'center';
    		nameContainer.style.gap = '0.25rem';
    		nameContainer.style.flex = '1';

    		const nameEl = document.createElement('span');
    		nameEl.textContent = cfg.name;
    		nameEl.style.cursor = 'pointer';

    		nameEl.addEventListener('click', () => {
  				// Auto-Save der aktuellen Konfiguration vor dem Wechsel
  				if (this.currentConfig !== null && this.currentConfig !== idx) {
    				this.updateConfig();
  				}
  				
  				// Nur laden wenn es eine andere Konfiguration ist
  				if (this.currentConfig !== idx) {
  					this.loadConfig(idx);
  					this.showToast('Konfiguration geladen', 1000);
  				}
				});

    		const editBtn = document.createElement('button');
    		editBtn.innerHTML = '✎';
    		editBtn.title = 'Namen bearbeiten';
    		Object.assign(editBtn.style, {
      		border: 'none',
      		background: 'none',
      		cursor: 'pointer',
      		fontSize: '1rem',
      		color: '#fff',
      		padding: '0',
      		marginLeft: '0.5rem',
      		lineHeight: '1'
    		});

    		editBtn.addEventListener('click', e => {
      		e.stopPropagation();
      		const input = document.createElement('input');
      		input.type = 'text';
      		input.value = cfg.name;
      		input.style.flex = '1';
      		input.addEventListener('keydown', ev => {
        		if (ev.key === 'Enter') {
          		cfg.name = input.value.trim() || cfg.name;
          		this.renderConfigList();
        		}
      		});
      		input.addEventListener('blur', () => {
        		cfg.name = input.value.trim() || cfg.name;
        		this.renderConfigList();
      		});
      		nameContainer.replaceChild(input, nameEl);
      		input.focus();
    		});

    		// Löschen-Button nur anzeigen wenn mehr als eine Konfiguration existiert
    		let deleteBtn = null;
    		if (this.configs.length > 1) {
    			deleteBtn = document.createElement('button');
    			deleteBtn.innerHTML = '🗑️';
    			deleteBtn.title = 'Konfiguration löschen';
    			Object.assign(deleteBtn.style, {
      			background: 'none',
      			border: 'none',
      			cursor: 'pointer',
      			fontSize: '1rem',
      			color: '#fff',
      			padding: '0',
      			marginLeft: '0.5rem',
      			lineHeight: '1'
    			});
    			deleteBtn.addEventListener('click', (e) => {
      			e.stopPropagation();
      			this.deleteConfig(idx);
    			});
    		}

    		const shareBtn = document.createElement('button');
    		shareBtn.textContent = '🔗';
    		shareBtn.title = 'Später weitermachen - Link kopieren';
    		Object.assign(shareBtn.style, {
      		background: 'none',
      		border: 'none',
      		cursor: 'pointer',
      		color: 'inherit'
    		});
    		shareBtn.addEventListener('click', (e) => {
      		e.stopPropagation();
      		this.generateContinueLink();
    		});

    		nameContainer.appendChild(nameEl);
    		nameContainer.appendChild(editBtn);
    		div.appendChild(nameContainer);
    		if (deleteBtn) div.appendChild(deleteBtn); // Nur hinzufügen wenn vorhanden
    		div.appendChild(shareBtn);
    		this.configListEl.appendChild(div);
  		});
		}

    updateSummaryOnChange() {
      this.renderProductSummary();
    }

    async renderProductSummary() {
  		const incMChecked = this.incM.checked;
  		const mc4Checked = this.mc4.checked;
  		const solarkabelChecked = this.solarkabel.checked;
  		const holzChecked = this.holz.checked;

  		const bundles = this.configs.map((c, idx) => {
  			// Wenn dies die aktuell bearbeitete Konfiguration ist, verwende die aktuellen Checkbox-Werte
  			if (idx === this.currentConfig) {
  				return {
    				selection:   this.selection,
    				orientation: this.orV.checked ? 'vertical' : 'horizontal',
    				incM:        incMChecked,
    				mc4:         mc4Checked,
    				solarkabel:  solarkabelChecked,
    				holz:        holzChecked
  				};
  			} else {
  				return {
    				selection:   c.selection,
    				orientation: c.orientation,
    				incM:        c.incM,
    				mc4:         c.mc4,
    				solarkabel:  c.solarkabel,
    				holz:        c.holz
  				};
  			}
  		});

  		if (this.currentConfig === null) {
  			bundles.push({
    			selection:   this.selection,
    			orientation: this.orV.checked ? 'vertical' : 'horizontal',
    			incM:        incMChecked,
    			mc4:         mc4Checked,
    			holz:        holzChecked
  			});
			}

  		// Speichere aktuelle Werte
  		const currentOrientation = this.orV.checked;
  		const currentSelection = this.selection.map(r => [...r]);
  		
  		const total = {};
  		
  		// Verwende Promise.all für parallele Berechnungen
  		const calculations = bundles.map(async (b) => {
    		// Temporär setzen für Berechnung
    		this.orV.checked = b.orientation === 'vertical';
    		this.orH.checked = !this.orV.checked;
    		this.selection = b.selection;
    		this.updateSize();

    		let parts = await this.calculateParts();
    		if (!b.incM) delete parts.Solarmodul;
    		if (b.mc4) {
    			const panelCount = b.selection.flat().filter(v => v).length;
    			parts.MC4_Stecker = Math.ceil(panelCount / 30); // 1 Packung pro 30 Panele
    		}
    		if (b.solarkabel) parts.Solarkabel = 1; // 1x wenn ausgewählt
    		if (b.holz)  parts.Holzunterleger = (parts['Schiene_240_cm'] || 0) + (parts['Schiene_360_cm'] || 0);

    		return parts;
  		});
  		
  		try {
  			const allParts = await Promise.all(calculations);
  			allParts.forEach(parts => {
  				Object.entries(parts).forEach(([k, v]) => {
      			total[k] = (total[k] || 0) + v;
    			});
  			});
  		} catch (error) {
  			// Fallback: Verwende leeres total
  		}
  		
  		// Stelle ursprüngliche Werte wieder her
  		this.orV.checked = currentOrientation;
  		this.orH.checked = !currentOrientation;
  		this.selection = currentSelection;
  		this.updateSize();

  		const entries = Object.entries(total).filter(([, v]) => v > 0);
  		const itemsPerColumn = 4;
  		const numColumns = Math.ceil(entries.length / itemsPerColumn);

  		let totalPrice = 0;
  		let html = '';

  		for (let i = 0; i < numColumns; i++) {
    		const columnEntries = entries.slice(i * itemsPerColumn, (i + 1) * itemsPerColumn);
    		const columnHtml = columnEntries.map(([k, v]) => {
      		const packs = Math.ceil(v / VE[k]);
      		const price = getPriceFromCache(k);
      		const itemTotal = packs * price;
      		totalPrice += itemTotal;

      		return `<div class="produkt-item">
        		<span>${packs}×</span>
        		<img src="${this.mapImage(k)}" alt="${k}" onerror="this.src='https://via.placeholder.com/32?text=${encodeURIComponent(k)}'">
        		<span>${k.replace(/_/g, ' ')} (${v})</span>
        		<span style="margin-left:auto; font-weight:bold;">${itemTotal.toFixed(2)} €</span>
      		</div>`;
    		}).join('');

    		html += `<div class="summary-column">${columnHtml}</div>`;
  		}

  		html += `<div class="summary-total">Gesamtpreis: ${totalPrice.toFixed(2)} €</div>`;
  		this.summaryList.innerHTML = html;

  		this.summaryHolder.style.display = entries.length ? 'block' : 'none';
  		this.summaryList.style.display = entries.length ? 'flex' : 'none';
		}

    generateContinueLink() {
    	// Auto-Save der aktuellen Konfiguration vor dem Link-Erstellen
    	if (this.currentConfig !== null) {
    		this.updateConfig();
    	}
    	
    	// Erstelle Link mit allen Konfigurationen
    	const allConfigsData = JSON.stringify(this.configs);
			const base64 = btoa(encodeURIComponent(allConfigsData));
			const continueUrl = `${window.location.origin}${window.location.pathname}?configData=${base64}`;
			
			navigator.clipboard.writeText(continueUrl);
			this.showToast('Später-weitermachen Link kopiert ✅', 2000);
    }
    
        generateHiddenCartForms() {
      const webflowForms = document.querySelectorAll('form[data-node-type="commerce-add-to-cart-form"]');
      this.webflowFormMap = {};
      
      webflowForms.forEach((form) => {
        const productId = form.getAttribute('data-commerce-product-id');
        const skuId = form.getAttribute('data-commerce-sku-id');
        
        const productKey = Object.keys(PRODUCT_MAP).find(key => 
          PRODUCT_MAP[key].productId === productId || PRODUCT_MAP[key].variantId === skuId
        );
        
        if (productKey) {
          this.webflowFormMap[productKey] = form;
        }
      });
      
      this.hideWebflowForms();
    }

    hideWebflowForms() {
      Object.values(this.webflowFormMap).forEach(form => {
        if (form && form.style) {
          form.style.cssText = `
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            width: 1px !important;
            height: 1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: hidden !important;
          `;
        }
      });
    }

    addProductToCart(productKey, quantity, isLastItem = false) {
      const product = PRODUCT_MAP[productKey];
      if (!product) return;
      
      const form = this.webflowFormMap[productKey];
      if (!form) return;
      
      const qtyInput = form.querySelector('input[name="commerce-add-to-cart-quantity-input"]');
      if (qtyInput) {
        qtyInput.value = quantity;
      }
      
      const addToCartButton = form.querySelector('input[data-node-type="commerce-add-to-cart-button"]');
      if (addToCartButton) {
        this.clickWebflowButtonSafely(form, addToCartButton, productKey, quantity, isLastItem);
      }
    }

    clickWebflowButtonSafely(form, button, productKey, quantity, isLastItem) {
      const qtyInput = form.querySelector('input[name="commerce-add-to-cart-quantity-input"]');
      if (qtyInput) qtyInput.value = quantity;
      
      if (isLastItem) {
        // Für das letzte Item: Normaler Button-Klick (Cart-Container ist bereits sichtbar)
        button.click();
        return;
      }
      
      // Für alle anderen Items: Versteckter Submit (Cart-Container ist versteckt)
      const iframe = document.createElement('iframe');
      iframe.name = 'safe-cart-' + Date.now() + Math.random();
      iframe.style.cssText = `
        position: absolute;
        left: -10000px;
        top: -10000px;
        width: 1px;
        height: 1px;
        border: none;
        visibility: hidden;
        opacity: 0;
      `;
      
      document.body.appendChild(iframe);
      
      const originalTarget = form.target || '';
      form.target = iframe.name;
      
      let hasLoaded = false;
      iframe.onload = () => {
        if (!hasLoaded) {
          hasLoaded = true;
          form.target = originalTarget;
          
          if (qtyInput) qtyInput.value = 1;
          
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      };
      
      iframe.onerror = () => {
        form.target = originalTarget;
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      };
      
      button.click();
    }

    addPartsListToCart(parts) {
      const entries = Object.entries(parts).filter(([_, qty]) => qty > 0);
      if (!entries.length) {
        return;
      }
      
      // Verstecke Cart-Container temporär
      this.hideCartContainer();
      
      // Füge alle Produkte außer dem letzten sofort hinzu (ohne Delays)
      const allButLast = entries.slice(0, -1);
      const lastEntry = entries[entries.length - 1];
      
      // Alle Produkte außer dem letzten sofort hinzufügen
      allButLast.forEach(([key, qty]) => {
        const packsNeeded = Math.ceil(qty / VE[key]);
        this.addProductToCart(key, packsNeeded, false);
      });
      
      // Das letzte Produkt nach kurzer Verzögerung hinzufügen (zeigt Cart)
      setTimeout(() => {
        this.showCartContainer();
        const [lastKey, lastQty] = lastEntry;
        const packsNeeded = Math.ceil(lastQty / VE[lastKey]);
        this.addProductToCart(lastKey, packsNeeded, true);
      }, 500);
    }

    hideCartContainer() {
      const cartContainer = document.querySelector('.w-commerce-commercecartcontainerwrapper');
      if (cartContainer) {
        cartContainer.style.display = 'none';
      }
    }

    showCartContainer() {
      const cartContainer = document.querySelector('.w-commerce-commercecartcontainerwrapper');
      if (cartContainer) {
        cartContainer.style.display = '';
      }
    }

    async addCurrentToCart() {
      try {
        const parts = await this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.solarkabel.checked, this.holz.checked);
        const itemCount = Object.values(parts).reduce((sum, qty) => sum + qty, 0);
        
        if (itemCount === 0) {
          this.showToast('Keine Produkte ausgewählt ⚠️', 2000);
          return;
        }
        
        // Sende Daten an Webhook
        this.sendCurrentConfigToWebhook().then(success => {
          if (success) {
          } else {
          }
        });
        
        this.addPartsListToCart(parts);
        this.showToast(`${itemCount} Produkte werden zum Warenkorb hinzugefügt...`, 3000);
      } catch (error) {
        this.showToast('Fehler beim Berechnen der Produkte ❌', 2000);
      }
    }

    async addAllToCart() {
      try {
        // Auto-Save der aktuellen Konfiguration vor dem Hinzufügen
        if (this.currentConfig !== null) {
          this.updateConfig();
        }
        
        const allBundles = await Promise.all(this.configs.map(async (cfg, idx) => {
          // Für die aktuell bearbeitete Konfiguration: Verwende aktuelle Werte
          if (idx === this.currentConfig) {
            return await this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.solarkabel.checked, this.holz.checked);
          } else {
            return await this._buildPartsFor(cfg.selection, cfg.incM, cfg.mc4, cfg.solarkabel, cfg.holz);
          }
        }));
        
        // Wenn keine Konfiguration ausgewählt ist (sollte nicht passieren), füge aktuelle Auswahl hinzu
        if (this.currentConfig === null && this.configs.length === 0) {
          const currentParts = await this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.solarkabel.checked, this.holz.checked);
          allBundles.push(currentParts);
        }
        
        const total = {};
        allBundles.forEach(parts => {
          Object.entries(parts).forEach(([k, v]) => {
            total[k] = (total[k] || 0) + v;
          });
        });
        
        const totalItemCount = Object.values(total).reduce((sum, qty) => sum + qty, 0);
        
        if (totalItemCount === 0) {
          this.showToast('Keine Konfigurationen vorhanden ⚠️', 2000);
          return;
        }
        
        // Sende alle Konfigurationen an Webhook
        this.sendAllConfigsToWebhook().then(success => {
          if (success) {
          } else {
          }
        });
        
        this.addPartsListToCart(total);
        this.showToast(`${totalItemCount} Produkte aus allen Konfigurationen werden hinzugefügt...`, 3000);
      } catch (error) {
        this.showToast('Fehler beim Berechnen der Konfigurationen ❌', 2000);
      }
    }

    async _buildPartsFor(sel, incM, mc4, solarkabel, holz) {
      // Speichere aktuelle Auswahl
      const originalSelection = this.selection.map(r => [...r]);
      
      try {
        // Temporär setzen für Berechnung
        this.selection = sel;
        let parts = await this.calculateParts();
        if (!incM) delete parts.Solarmodul;
        if (mc4) {
          const panelCount = sel.flat().filter(v => v).length;
          parts.MC4_Stecker = Math.ceil(panelCount / 30); // 1 Packung pro 30 Panele
        }
        if (solarkabel) parts.Solarkabel = 1; // 1x wenn ausgewählt
        if (holz)  parts.Holzunterleger = (parts['Schiene_240_cm']||0) + (parts['Schiene_360_cm']||0);
        
        return parts;
      } finally {
        // Ursprüngliche Auswahl wiederherstellen
        this.selection = originalSelection;
      }
    }

    _buildCartItems(parts) {
      return Object.entries(parts).map(([k,v]) => {
        const packs = Math.ceil(v / VE[k]), m = PRODUCT_MAP[k];
        return (!m || packs <= 0) ? null : {
          productId: m.productId,
          variantId: m.variantId,
          quantity:  packs
        };
      }).filter(Boolean);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const grid = new SolarGrid();
    grid.generateHiddenCartForms();
    window.solarGrid = grid;
  });

  // Cleanup beim Verlassen der Seite
  window.addEventListener('beforeunload', () => {
    if (calculationManager) {
      calculationManager.destroy();
    }
  });
})();
