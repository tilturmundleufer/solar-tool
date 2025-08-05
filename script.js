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
	Solarmodul: 59.00,
	Endklemmen: 20.00,
	Schrauben: 5.00,
	Dachhaken: 15.00,
	Mittelklemmen: 18.00,
	Endkappen: 9.99,
	Schienenverbinder: 9.99,
	Schiene_240_cm: 8.99,
	Schiene_360_cm: 40.00,
	MC4_Stecker: 99.00,
  	Solarkabel: 29.99,
	Holzunterleger: 0.50
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

  // ===== PDF GENERATOR =====
  class SolarPDFGenerator {
    constructor(solarGrid) {
      this.solarGrid = solarGrid;
      this.jsPDF = window.jspdf?.jsPDF;
      this.html2canvas = window.html2canvas;
    }

    // Prüfe ob PDF-Libraries verfügbar sind
    isAvailable() {
      return !!(this.jsPDF && this.html2canvas);
    }

    // NEUE ISOLIERTE PDF-Generation mit Snapshot (KEINE Grid-Interaktion!)
    async generatePDFFromSnapshot(snapshot) {
      if (!this.isAvailable()) {
        console.warn('PDF Libraries nicht verfügbar');
        this.solarGrid.showToast('PDF-Generierung nicht verfügbar', 3000);
        return;
      }

      try {
        console.log('PDF-Generation startet mit Snapshot:', {
          totalConfigs: snapshot.totalConfigs,
          timestamp: snapshot.timestamp,
          configs: snapshot.configs.map(c => ({
            name: c.name,
            dimensions: `${c.cols}x${c.rows}`,
            selectedCells: c.selectedCells,
            totalCells: c.totalCells
          }))
        });
        
        if (!snapshot.configs || snapshot.configs.length === 0) {
          this.solarGrid.showToast('Keine Konfiguration zum Exportieren', 3000);
          return;
        }

        const pdf = new this.jsPDF('p', 'mm', 'a4');
        let isFirstPage = true;

        // Generiere PDF für jede Konfiguration aus dem Snapshot
        for (const config of snapshot.configs) {
          if (!isFirstPage) {
            pdf.addPage();
          }
          await this.addConfigurationToPDFFromSnapshot(pdf, config, isFirstPage);
          isFirstPage = false;
        }

        // Generiere Dateinamen
        const fileName = this.generateFileName(snapshot.configs);
        
        // PDF herunterladen
        pdf.save(fileName);
        
        console.log('PDF erfolgreich generiert:', fileName);

      } catch (error) {
        console.error('PDF-Generierung fehlgeschlagen:', error);
        this.solarGrid.showToast('PDF-Erstellung fehlgeschlagen', 3000);
        throw error; // Re-throw für debugging
      }
    }

    // DEPRECATED: Alte PDF-Generation für Backward Compatibility
    async generatePDF(type = 'current') {
      // Für alle Configs verwende neuen Snapshot-Approach
      const snapshot = this.solarGrid.createConfigSnapshot();
      await this.generatePDFFromSnapshot(snapshot);
    }

    // Hilfsmethode für Gesamtpreis-Berechnung
    async calculateTotalPrice(config) {
      const parts = this.solarGrid.calculatePartsDirectly({
        selection: config.selection,
        cols: config.cols,
        rows: config.rows,
        cellWidth: config.cellWidth,
        cellHeight: config.cellHeight,
        orientation: config.orientation,
        incM: config.incM,
        mc4: config.mc4,
        solarkabel: config.solarkabel,
        holz: config.holz
      });

      let totalPrice = 0;
      Object.entries(parts).forEach(([key, value]) => {
        if (value > 0) {
          const packs = Math.ceil(value / VE[key]);
          const price = getPriceFromCache(key);
          totalPrice += packs * price;
        }
      });

      return totalPrice;
    }

    // Footer mit Logo
    addFooter(pdf, pageWidth, pageHeight) {
      const footerY = pageHeight - 25;
      
      // Footer Hintergrund
      pdf.setFillColor(14, 30, 52);
      pdf.rect(0, footerY, pageWidth, 25, 'F');
      
      // Footer Text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Schneider Unterkonstruktion - Solar Konfigurator', 20, footerY + 8);
      pdf.text('unterkonstruktion.de', 20, footerY + 15);
      
      // Logo rechts - neues PNG Logo
      try {
        // Logo von der neuen URL laden
        const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAb0AAACOCAYAAAClt9bzAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAExWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZTpuczptZXRhLyc+CjxyZGY6UkRGIHhtbG5zOnJkZj0naHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyc+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczpBdHRyaWI9J2h0dHA6Ly9ucy5hdHRyaWJ1dGlvbi5jb20vYWRzLzEuMC8nPgogIDxBdHRyaWI6QWRzPgogICA8cmRmOlNlcT4KICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0nUmVzb3VyY2UnPgogICAgIDxBdHRyaWI6Q3JlYXRlZD4yMDI1LTA4LTAzPC9BdHRyaWI6Q3JlYXRlZD4KICAgICA8QXR0cmliOkV4dElkPmJlZjYxZjQ1LTc4ZDEtNGYxMi1iNjdlLWJkYjlhMmNlNjVjMTwvQXR0cmliOkV4dElkPgogICAgIDxBdHRyaWI6RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5TY2huZWlkZXIgbG9nbyAtIDE8L3JkZjpsaT4KICAgPC9yZGY6QWx0PgogIDwvZGM6dGl0bGU+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9u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';
        
        // Logo als Bild hinzufügen - proportional skaliert
        const logoHeight = 15; // Feste Höhe
        const logoWidth = logoHeight * 3.1338028169; // Exaktes Verhältnis 3.1338028169:1
        const logoX = pageWidth - logoWidth - 20; // 20px Abstand vom rechten Rand
        const logoY = footerY + 5; // 5px Abstand vom oberen Footer-Rand

        // Base64 Logo als Bild einbetten
        pdf.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
      } catch (error) {
        console.warn('Logo konnte nicht geladen werden:', error);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Schneider Unterkonstruktion', pageWidth - 120, footerY + 12);
      }
    }

    // Hilfsmethode für Gesamtpreis-Berechnung aus Snapshot
    async calculateTotalPriceFromSnapshot(config) {
      const parts = await this.calculatePartsFromSnapshot(config);
      
      let totalPrice = 0;
      Object.entries(parts).forEach(([key, value]) => {
        if (value > 0) {
          const packs = Math.ceil(value / (VE[key] || 1));
          const price = getPriceFromCache(key);
          totalPrice += packs * price;
        }
      });

      return totalPrice;
    }

    // NEUE ISOLIERTE Konfiguration zu PDF hinzufügen (aus Snapshot)
    async addConfigurationToPDFFromSnapshot(pdf, config, isFirstPage) {
      const pageWidth = 210; // A4 Breite in mm
      const pageHeight = 297; // A4 Höhe in mm
      const bottomMargin = 30; // Erhöhter Rand für Footer
      
      // Verwende Objekt für yPosition damit es von checkPageBreak geändert werden kann
      const positionRef = { y: 25 };

      // Hilfsfunktion für Seitenumbruch-Prüfung mit mehr Platz
      const checkPageBreak = (neededSpace = 20) => {
        if (positionRef.y + neededSpace > pageHeight - bottomMargin) {
          // Footer auf aktueller Seite hinzufügen
          this.addFooter(pdf, pageWidth, pageHeight);
          
          // Neue Seite hinzufügen
          pdf.addPage();
          positionRef.y = 25;
          return true;
        }
        return false;
      };

      console.log(`PDF-Seite für Konfiguration: ${config.name}`, {
        dimensions: `${config.cols}x${config.rows}`,
        selectedCells: config.selectedCells,
        totalCells: config.totalCells
      });

      // NEUES DESIGN: Header mit dunkelblauem Hintergrund
      pdf.setFillColor(14, 30, 52); // #0e1e34
      pdf.rect(0, 0, pageWidth, 35, 'F');
      
      // Header Text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Ihre Konfiguration', 20, 22);
      
      // Datum rechts
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(new Date().toLocaleDateString('de-DE'), pageWidth - 40, 22);
      
      // Zurück zu schwarzem Text
      pdf.setTextColor(0, 0, 0);
      positionRef.y = 45;

      // Projekt-Info Sektion
      checkPageBreak(25);
      pdf.setFillColor(245, 166, 35); // #f5a623
      pdf.rect(15, positionRef.y - 5, pageWidth - 30, 20, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Projekt: ${config.name || 'Unbenannt'}`, 20, positionRef.y + 10);
      
      pdf.setTextColor(0, 0, 0);
      positionRef.y += 30;

      // Grid-Informationen
      checkPageBreak(20);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Grid: ${config.cols} × ${config.rows} Module (${config.selectedCells} ausgewählt)`, 20, positionRef.y);
      pdf.text(`Orientierung: ${config.orientation === 'vertical' ? 'Vertikal' : 'Horizontal'}`, 20, positionRef.y + 8);
      positionRef.y += 20;

      // Grid-Screenshot hinzufügen (ISOLIERT mit Snapshot-Daten)
      try {
        const gridImage = await this.captureGridVisualizationFromSnapshot(config);
        if (gridImage) {
          const imgWidth = 140;  // Größeres Bild
          const imgHeight = 105;
          
          checkPageBreak(imgHeight + 15);
          
          // Rahmen um das Bild - zentriert mit gleichem Abstand
          pdf.setDrawColor(14, 30, 52);
          pdf.setLineWidth(2);
          const centerX = (pageWidth - imgWidth) / 2;
          const centerY = positionRef.y;
          pdf.rect(centerX - 2, centerY - 2, imgWidth + 4, imgHeight + 4);
          
          pdf.addImage(gridImage, 'PNG', centerX, centerY, imgWidth, imgHeight);
          positionRef.y += imgHeight + 10;
        }
      } catch (error) {
        console.warn('Grid-Screenshot fehlgeschlagen:', error);
        positionRef.y += 10;
      }

      // Produkttabelle (ISOLIERT mit Snapshot-Daten)
      checkPageBreak(60);
      positionRef.y = await this.addProductTableFromSnapshot(pdf, config, positionRef.y, checkPageBreak);

      // Gesamtpreis hervorgehoben
      checkPageBreak(25);
      const totalPrice = await this.calculateTotalPriceFromSnapshot(config);
      pdf.setFillColor(14, 30, 52);
      pdf.rect(15, positionRef.y - 5, pageWidth - 30, 20, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GESAMTPREIS:', 20, positionRef.y + 8);
      pdf.text(`${totalPrice.toFixed(2)} €`, 170, positionRef.y + 8);
      
      pdf.setTextColor(0, 0, 0);
      positionRef.y += 30;

      // Produkte pro Modul Informationen
      checkPageBreak(80);
      positionRef.y = this.addProductPerModuleInfo(pdf, positionRef.y, checkPageBreak);

      // Footer mit Logo auf der letzten Seite
      this.addFooter(pdf, pageWidth, pageHeight);
    }

    // Erfasse Grid-Visualisierung als Bild
    async captureGridVisualization(config) {
      // Alternative Methode: Erstelle temporäres Grid-Element für Screenshot
      try {
        const selection = config.selection || [];
        const cols = config.cols || 5;
        const rows = config.rows || 5;
        
        // Erstelle temporäres Container Element
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-10000px';
        tempContainer.style.top = '-10000px';
        tempContainer.style.padding = '20px';
        tempContainer.style.backgroundColor = '#ffffff';
        document.body.appendChild(tempContainer);

        // Erstelle Grid HTML mit kompaktem Design
        const cellSize = 50; // Zellgröße beibehalten
        const cellGap = 2; // Maximal 2px Abstand
        
        const gridEl = document.createElement('div');
        gridEl.style.display = 'grid';
        gridEl.style.gap = `${cellGap}px`;
        gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
        gridEl.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
        gridEl.style.padding = '2px'; // Kompakter äußerer Abstand
        gridEl.style.backgroundColor = '#ffffff';
        gridEl.style.border = '1px solid #000000'; // 1px schwarze Border
        gridEl.style.borderRadius = '1rem'; // 1rem border-radius

        // Normalisiere Selection-Array für die gewünschten Dimensionen
        const normalizedSelection = Array.from({ length: rows }, (_, y) =>
          Array.from({ length: cols }, (_, x) => {
            // Prüfe ob die gespeicherte Selection diese Position abdeckt
            if (selection[y] && Array.isArray(selection[y]) && x < selection[y].length) {
              return selection[y][x] === true;
            }
            // Falls außerhalb der gespeicherten Dimensionen: false (nicht ausgewählt)
            return false;
          })
        );

        // Debug: Log der normalisierten Konfiguration
        console.log('Grid Debug - Normalized:', {
          originalRows: selection.length,
          originalCols: selection[0] ? selection[0].length : 0,
          targetRows: rows,
          targetCols: cols,
          normalizedSelection: normalizedSelection
        });

        // Erstelle alle Grid-Zellen
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            
            // Verwende die normalisierte Selection
            const isSelected = normalizedSelection[y][x];
            
            // Debug: Log für problematische Bereiche
            if (y >= rows - 2 || x >= cols - 2) { 
              console.log(`Cell [${y}][${x}]: isSelected =`, isSelected);
            }
            
            // Basis-Styles für alle Zellen
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            cell.style.borderRadius = '1rem'; // 1rem border-radius
            cell.style.border = '1px solid #000000'; // 1px schwarze Border
            
            if (isSelected) {
              // Ausgewählte Zelle - Dunkelblaue Farbe
              cell.style.backgroundColor = '#072544';
            } else {
              // Nicht-ausgewählte Zelle - hell-grau
              cell.style.backgroundColor = '#f3f4f6';
            }
            
            gridEl.appendChild(cell);
          }
        }
        
        tempContainer.appendChild(gridEl);

        // Warte auf Rendering
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 100)); // Kurze Wartezeit, kein Bild-Download nötig

        // Screenshot von temporärem Element
        const canvas = await this.html2canvas(tempContainer, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          width: tempContainer.offsetWidth,
          height: tempContainer.offsetHeight
        });

        // Aufräumen
        document.body.removeChild(tempContainer);
        
        return canvas.toDataURL('image/png');

      } catch (error) {
        console.warn('Grid-Screenshot fehlgeschlagen:', error);
        return null;
      }
    }

    // NEUE METHODE: Grid-Bild für Webhook generieren
    async captureGridImageForWebhook(configData) {
      try {
        const selection = configData.selection || [];
        const cols = configData.cols || 5;
        const rows = configData.rows || 5;
        
        // Erstelle temporäres Container Element
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-10000px';
        tempContainer.style.top = '-10000px';
        tempContainer.style.padding = '20px';
        tempContainer.style.backgroundColor = '#ffffff';
        document.body.appendChild(tempContainer);

        // Grid-Eigenschaften für Webhook-optimierte Darstellung
        const isVertical = configData.orientation === 'vertical';
        const baseCellSize = 60; // Größere Zellen für bessere Sichtbarkeit
        const cellWidth = isVertical ? baseCellSize * 0.6 : baseCellSize;
        const cellHeight = isVertical ? baseCellSize : baseCellSize * 0.6;
        const cellGap = 2;
        
        const gridEl = document.createElement('div');
        gridEl.style.display = 'grid';
        gridEl.style.gap = `${cellGap}px`;
        gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellWidth}px)`;
        gridEl.style.gridTemplateRows = `repeat(${rows}, ${cellHeight}px)`;
        gridEl.style.padding = '20px';
        gridEl.style.backgroundColor = '#ffffff';
        gridEl.style.border = '2px solid #072544';
        gridEl.style.borderRadius = '12px';
        gridEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';

        // Grid-Zellen erstellen
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            const isSelected = selection[y] && selection[y][x] === true;
            
            cell.style.width = `${cellWidth}px`;
            cell.style.height = `${cellHeight}px`;
            cell.style.borderRadius = '6px';
            cell.style.border = '1px solid #ddd';
            cell.style.transition = 'all 0.2s ease';
            
            if (isSelected) {
              // Ausgewählte Zelle - Solar-Panel-Design
              cell.style.backgroundColor = '#072544';
              cell.style.border = '2px solid #0a4d75';
              cell.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
              
              // Solar-Panel-Pattern hinzufügen
              const pattern = document.createElement('div');
              pattern.style.width = '100%';
              pattern.style.height = '100%';
              pattern.style.background = `linear-gradient(135deg, 
                #072544 0%, #0a4d75 50%, #072544 100%)`;
              pattern.style.borderRadius = '4px';
              pattern.style.position = 'relative';
              
              // Grid-Linien für Solarpanel-Look
              const gridLines = document.createElement('div');
              gridLines.style.position = 'absolute';
              gridLines.style.top = '2px';
              gridLines.style.left = '2px';
              gridLines.style.right = '2px';
              gridLines.style.bottom = '2px';
              gridLines.style.backgroundImage = `
                linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
              `;
              gridLines.style.backgroundSize = '33% 50%';
              
              pattern.appendChild(gridLines);
              cell.appendChild(pattern);
            } else {
              // Unausgewählte Zelle - Neutral grau
              cell.style.backgroundColor = '#f8f9fa';
              cell.style.border = '1px solid #e9ecef';
            }
            
            gridEl.appendChild(cell);
          }
        }
        
        tempContainer.appendChild(gridEl);
        
        // Warte auf Rendering
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 150));

        // Canvas für Screenshot erstellen
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Canvas-Größe berechnen
        const totalWidth = cols * cellWidth + (cols - 1) * cellGap + 40; // +40 für padding
        const totalHeight = rows * cellHeight + (rows - 1) * cellGap + 40;
        
        canvas.width = totalWidth;
        canvas.height = totalHeight;
        
        // Weißer Hintergrund
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Grid manuell auf Canvas zeichnen
        const startX = 20; // Padding
        const startY = 20; // Padding
        
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const cellX = startX + x * (cellWidth + cellGap);
            const cellY = startY + y * (cellHeight + cellGap);
            const isSelected = selection[y] && selection[y][x] === true;
            
            if (isSelected) {
              // Ausgewählte Zelle - Dunkelblau
              ctx.fillStyle = '#072544';
              ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
              
              // Border
              ctx.strokeStyle = '#0a4d75';
              ctx.lineWidth = 2;
              ctx.strokeRect(cellX, cellY, cellWidth, cellHeight);
              
              // Solar-Panel-Grid
              ctx.strokeStyle = 'rgba(255,255,255,0.2)';
              ctx.lineWidth = 1;
              
              // Vertikale Linien
              for (let i = 1; i < 3; i++) {
                const lineX = cellX + (cellWidth / 3) * i;
                ctx.beginPath();
                ctx.moveTo(lineX, cellY + 2);
                ctx.lineTo(lineX, cellY + cellHeight - 2);
                ctx.stroke();
              }
              
              // Horizontale Linie
              const lineY = cellY + cellHeight / 2;
              ctx.beginPath();
              ctx.moveTo(cellX + 2, lineY);
              ctx.lineTo(cellX + cellWidth - 2, lineY);
              ctx.stroke();
            } else {
              // Unausgewählte Zelle - Hell grau
              ctx.fillStyle = '#f8f9fa';
              ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
              
              // Border
              ctx.strokeStyle = '#e9ecef';
              ctx.lineWidth = 1;
              ctx.strokeRect(cellX, cellY, cellWidth, cellHeight);
            }
          }
        }
        
        // Grid-Rahmen zeichnen
        ctx.strokeStyle = '#072544';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, totalWidth - 20, totalHeight - 20);
        
        // Canvas zu Base64 konvertieren
        const base64Image = canvas.toDataURL('image/png');
        
        console.log('Canvas generated:', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          dataURLLength: base64Image.length,
          dataURLStart: base64Image.substring(0, 50) + '...'
        });
        
        // Cleanup
        document.body.removeChild(tempContainer);
        
        return base64Image;
        
      } catch (error) {
        console.error('Grid-Bild-Generierung fehlgeschlagen:', error);
        return null;
      }
    }

    // NEUE ISOLIERTE Grid-Capture aus Snapshot (KEINE Live-Grid-Interaktion!)
    async captureGridVisualizationFromSnapshot(config) {
      try {
        console.log(`Grid-Capture für ${config.name}:`, {
          dimensions: `${config.cols}x${config.rows}`,
          selectedCells: config.selectedCells,
          selection: config.selection.slice(0, 3).map(row => row.slice(0, 5)) // Log first 3 rows, 5 cols
        });
        
        const selection = config.selection || [];
        const cols = config.cols || 5;
        const rows = config.rows || 5;
        
        // Erstelle temporäres Container Element (komplett isoliert)
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-10000px';
        tempContainer.style.top = '-10000px';
        tempContainer.style.padding = '20px';
        tempContainer.style.backgroundColor = '#ffffff';
        tempContainer.style.zIndex = '-1000'; // Sicherstellen dass es nicht sichtbar wird
        document.body.appendChild(tempContainer);

        // Erstelle Grid HTML mit verbesserter Orientation-Darstellung
        const isVertical = config.orientation === 'vertical';
        
        // Verwende Zellen-Größenverhältnis um Orientation zu zeigen
        const baseCellSize = 40; // Reduzierte Grundgröße
        const cellWidth = isVertical ? baseCellSize * 0.6 : baseCellSize; // Schmalere Zellen für vertikal
        const cellHeight = isVertical ? baseCellSize : baseCellSize * 0.6; // Niedrigere Zellen für horizontal
        const cellGap = 1; // Minimaler Abstand
        
        // Berechne PDF-konforme Größe (max 170mm breit für PDF mit 20mm padding)
        const maxPDFWidth = 170; // mm
        const totalGridWidth = cols * cellWidth + (cols - 1) * cellGap + 4; // +4 für padding
        const scaleFactor = totalGridWidth > (maxPDFWidth * 3.78) ? (maxPDFWidth * 3.78) / totalGridWidth : 1; // 3.78 px per mm
        
        const finalCellWidth = cellWidth * scaleFactor;
        const finalCellHeight = cellHeight * scaleFactor;
        const finalGap = cellGap * scaleFactor;
        
        const gridEl = document.createElement('div');
        gridEl.style.display = 'grid';
        gridEl.style.gap = `${finalGap}px`;
        gridEl.style.gridTemplateColumns = `repeat(${cols}, ${finalCellWidth}px)`;
        gridEl.style.gridTemplateRows = `repeat(${rows}, ${finalCellHeight}px)`;
        gridEl.style.padding = '2px';
        gridEl.style.backgroundColor = '#ffffff';
        gridEl.style.border = '1px solid #000000';
        gridEl.style.borderRadius = '3px';
        // CSS für scharfe Linien und pixelgenaue Darstellung
        gridEl.style.imageRendering = 'crisp-edges';
        gridEl.style.imageRendering = '-webkit-optimize-contrast';
        gridEl.style.transform = 'translateZ(0)';
        gridEl.style.backfaceVisibility = 'hidden';

        // Erstelle alle Grid-Zellen direkt aus Snapshot-Selection
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            
            // Verwende direkt die Snapshot-Selection (bereits normalisiert)
            const isSelected = selection[y] && selection[y][x] === true;
            
            // Basis-Styles für alle Zellen mit ultra-scharfen Linien
            cell.style.width = `${finalCellWidth}px`;
            cell.style.height = `${finalCellHeight}px`;
            cell.style.borderRadius = '2px';
            cell.style.border = '1px solid #000000'; // Stärkere Border für schärfere Linien
            cell.style.imageRendering = 'crisp-edges';
            cell.style.imageRendering = '-webkit-optimize-contrast';
            cell.style.transform = 'translateZ(0)';
            cell.style.backfaceVisibility = 'hidden';
            
            if (isSelected) {
              // Ausgewählte Zelle - Dunkelblaue Farbe
              cell.style.backgroundColor = '#072544';
            } else {
              // Nicht-ausgewählte Zelle - hell-grau
              cell.style.backgroundColor = '#f3f4f6';
            }
            
            gridEl.appendChild(cell);
          }
        }
        
        tempContainer.appendChild(gridEl);

        // Warte auf Rendering
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 100));

        // Screenshot von temporärem Element (isoliert) mit großzügigem Padding
        const paddingX = 20; // Großzügiges horizontales Padding
        const paddingY = 20; // Großzügiges vertikales Padding
        const actualGridWidth = Math.ceil(cols * finalCellWidth + (cols - 1) * finalGap + paddingX);
        const actualGridHeight = Math.ceil(rows * finalCellHeight + (rows - 1) * finalGap + paddingY);
        
        console.log('Grid Screenshot Debug:', {
          cols, rows, finalCellWidth, finalCellHeight, finalGap,
          calculatedWidth: actualGridWidth,
          calculatedHeight: actualGridHeight,
          paddingX, paddingY
        });
        
        const canvas = await this.html2canvas(gridEl, {
          backgroundColor: '#ffffff',
          width: actualGridWidth,
          height: actualGridHeight,
          scale: 4, // Ultra-hohe Scale für kristallscharfe Linien
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: false,
          removeContainer: false,
          pixelRatio: window.devicePixelRatio || 1, // Nutze native Pixeldichte
          imageTimeout: 15000, // Längere Timeout für bessere Qualität
          onclone: (clonedDoc) => {
            // CSS-Optimierungen für schärfere Darstellung
            const style = clonedDoc.createElement('style');
            style.textContent = `
              * {
                image-rendering: -webkit-optimize-contrast !important;
                image-rendering: crisp-edges !important;
                image-rendering: pixelated !important;
                text-rendering: optimizeLegibility !important;
                -webkit-font-smoothing: antialiased !important;
                -moz-osx-font-smoothing: grayscale !important;
              }
            `;
            clonedDoc.head.appendChild(style);
          }
        });

        // Cleanup - Element sofort entfernen
        document.body.removeChild(tempContainer);

        // Canvas zu optimiertem Data URL konvertieren - JPEG für kleinere Datei bei guter Qualität
        return canvas.toDataURL('image/jpeg', 0.95); // 95% Qualität = scharf aber kompakt

      } catch (error) {
        console.error('Grid-Screenshot fehlgeschlagen:', error);
        return null;
      }
    }

    // NEUE ISOLIERTE Produkttabelle aus Snapshot
    async addProductTableFromSnapshot(pdf, config, yPosition, checkPageBreak) {
      try {
        console.log('addProductTableFromSnapshot called for:', config.name);
        
        // Berechne Produkte aus Snapshot-Daten (isoliert)
        const parts = await this.calculatePartsFromSnapshot(config);
        
        console.log('Received parts:', parts, 'Keys count:', Object.keys(parts || {}).length);
        
        if (!parts || Object.keys(parts).length === 0) {
          console.log('No parts calculated, returning early');
          return yPosition;
        }

        // NEUES DESIGN: Produkttabelle mit Header
        checkPageBreak(30);
        
        // Header mit orange Hintergrund
        pdf.setFillColor(245, 166, 35);
        pdf.rect(15, yPosition - 5, 180, 15, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PRODUKT-LISTE', 20, yPosition + 5);
        
        pdf.setTextColor(0, 0, 0);
        yPosition += 20;

        // Tabellen-Header mit dunkelblauem Hintergrund
        checkPageBreak(15);
        pdf.setFillColor(14, 30, 52);
        pdf.rect(15, yPosition - 3, 180, 12, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Produkt', 20, yPosition + 3);
        pdf.text('Menge', 70, yPosition + 3);
        pdf.text('Pack', 100, yPosition + 3);
        pdf.text('Preis/Pack', 130, yPosition + 3);
        pdf.text('Gesamt', 170, yPosition + 3);
        
        pdf.setTextColor(0, 0, 0);
        yPosition += 15;

        // Tabellen-Inhalt mit alternierenden Zeilen
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        let totalPrice = 0;
        let rowCount = 0;

        Object.entries(parts).forEach(([productKey, quantity]) => {
          if (quantity > 0) {
            checkPageBreak(12);
            
            // Alternierende Zeilen-Hintergründe
            if (rowCount % 2 === 1) {
              pdf.setFillColor(248, 249, 250);
              pdf.rect(15, yPosition - 2, 180, 10, 'F');
            }
            
            const productName = productKey.replace(/_/g, ' ');
            const packsNeeded = Math.ceil(quantity / (VE[productKey] || 1));
            const pricePerPack = getPriceFromCache(productKey);
            const totalForProduct = packsNeeded * pricePerPack;
            totalPrice += totalForProduct;

            pdf.text(productName, 20, yPosition + 2);
            pdf.text(quantity.toString(), 70, yPosition + 2);
            pdf.text(`${packsNeeded}x`, 100, yPosition + 2);
            pdf.text(`${pricePerPack.toFixed(2)} €`, 130, yPosition + 2);
            pdf.text(`${totalForProduct.toFixed(2)} €`, 170, yPosition + 2);
            
            yPosition += 10;
            rowCount++;
          }
        });

        // Gesamt-Linie
        checkPageBreak(15);
        pdf.setDrawColor(14, 30, 52);
        pdf.setLineWidth(1);
        pdf.line(15, yPosition, 195, yPosition);
        yPosition += 5;

        return yPosition;

      } catch (error) {
        console.error('Produkttabelle fehlgeschlagen:', error);
        return yPosition;
      }
    }

    // Isolierte Produktberechnung aus Snapshot
    async calculatePartsFromSnapshot(config) {
      try {
        console.log('Calculating parts for config:', config.name, {
          selectedCells: config.selectedCells,
          rows: config.rows,
          cols: config.cols,
          includeModules: config.includeModules
        });

        // Erstelle isolierte Calculation-Data aus Snapshot
        const calculationData = {
          selection: config.selection.map(row => [...row]), // Deep copy
          rows: config.rows,
          cols: config.cols,
          cellWidth: config.cellWidth || 179,
          cellHeight: config.cellHeight || 113,
          orientation: config.orientation || 'horizontal'
        };

        let parts;
        try {
          // Versuche Web Worker calculation
          parts = await calculationManager.calculate('calculateParts', calculationData);
        } catch (error) {
          console.warn('calculationManager failed, using fallback:', error);
          // Fallback zu direkter Berechnung
          parts = this.calculatePartsDirectly(calculationData);
        }

        console.log('Parts calculated:', parts);

        // Entferne Module wenn nicht ausgewählt
        if (!config.includeModules) {
          delete parts.Solarmodul;
        }

        // Füge optionale Komponenten hinzu wenn ausgewählt
        if (config.mc4) {
          const moduleCount = config.selectedCells;
          parts.MC4_Stecker = Math.ceil(moduleCount / 30);
        }

        if (config.cable) {
          parts.Solarkabel = 1;
        }

        if (config.wood) {
          parts.Holzunterleger = (parts.Schiene_240_cm || 0) + (parts.Schiene_360_cm || 0);
        }

        console.log('Final parts after processing:', parts);
        return parts;

      } catch (error) {
        console.error('Part calculation from snapshot failed:', error);
        return {};
      }
    }

    // Füge Produkttabelle zum PDF hinzu
    async addProductTable(pdf, config, yPosition, checkPageBreak) {
      // NEUES DESIGN: Produkttabelle mit Header
      checkPageBreak(30);
      
              // Header mit orange Hintergrund
        pdf.setFillColor(245, 166, 35);
        pdf.rect(15, yPosition - 5, 180, 15, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PRODUKT-LISTE', 20, yPosition + 5);
      
      pdf.setTextColor(0, 0, 0);
      yPosition += 20;

      // Berechne Teile für diese Konfiguration
      const parts = await this.calculateConfigParts(config);
      
      if (!parts || Object.keys(parts).length === 0) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.text('Keine Produkte berechnet.', 20, yPosition);
        return yPosition + 10;
      }

      // Tabellen-Header mit dunkelblauem Hintergrund
      checkPageBreak(15);
      pdf.setFillColor(14, 30, 52);
      pdf.rect(15, yPosition - 3, 180, 12, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Produkt', 20, yPosition + 3);
      pdf.text('Menge', 70, yPosition + 3);
      pdf.text('Pack', 100, yPosition + 3);
      pdf.text('Preis/Pack', 130, yPosition + 3);
      pdf.text('Gesamt', 170, yPosition + 3);
      
      pdf.setTextColor(0, 0, 0);
      yPosition += 15;

      // Tabellen-Inhalt mit alternierenden Zeilen
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      let totalPrice = 0;
      let rowCount = 0;

      Object.entries(parts).forEach(([productKey, needed]) => {
        if (needed > 0) {
          checkPageBreak(12);
          
          // Alternierende Zeilen-Hintergründe
          if (rowCount % 2 === 1) {
            pdf.setFillColor(248, 249, 250);
            pdf.rect(15, yPosition - 2, 180, 10, 'F');
          }
          
          const ve = VE[productKey] || 1;
          const packs = Math.ceil(needed / ve);
          const pricePerPack = getPriceFromCache(productKey);
          const totalProductPrice = packs * pricePerPack;
          totalPrice += totalProductPrice;

          const productName = productKey.replace(/_/g, ' ');
          
          pdf.text(productName, 20, yPosition + 2);
          pdf.text(needed.toString(), 70, yPosition + 2);
          pdf.text(`${packs}×`, 100, yPosition + 2);
          pdf.text(`${pricePerPack.toFixed(2)} €`, 130, yPosition + 2);
          pdf.text(`${totalProductPrice.toFixed(2)} €`, 170, yPosition + 2);
          
          yPosition += 10;
          rowCount++;
        }
      });

      // Gesamt-Linie
      checkPageBreak(15);
      pdf.setDrawColor(14, 30, 52);
      pdf.setLineWidth(1);
      pdf.line(15, yPosition, 195, yPosition);
      yPosition += 5;

      return yPosition;
    }

    // Füge "Produkte pro Modul" Informationen hinzu
    addProductPerModuleInfo(pdf, yPosition, checkPageBreak) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Produkte pro Modul (Richtwerte):', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const perModuleInfo = [
        'Endklemmen: 2 Stück (je Modulreihe)',
        'Mittelklemmen: 1 Stück (zwischen Modulen)',
        'Dachhaken: 1-2 Stück (je nach Dachtyp)',
        'Schrauben: 4-6 Stück (je Dachhaken)',
        'MC4-Stecker: 1 Packung pro 30 Module',
        'Solarkabel: 1 Rolle pro Anlage',
        'Holzunterleger: 1 Stück pro Schienenmeter'
      ];

      perModuleInfo.forEach(info => {
        // Prüfe ob noch Platz für eine weitere Zeile vorhanden ist
        if (checkPageBreak && checkPageBreak(8)) {
          // Nach Seitenumbruch den Titel wiederholen
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Produkte pro Modul (Richtwerte) - Fortsetzung:', 20, yPosition);
          yPosition += 10;
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
        }
        
        pdf.text(`• ${info}`, 25, yPosition);
        yPosition += 6;
      });

      // Prüfe ob noch Platz für Hinweis vorhanden ist
      if (checkPageBreak && checkPageBreak(15)) {
        // Kein Titel nötig nach Seitenumbruch für Hinweis
      }

      yPosition += 10;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Hinweis: Genaue Mengen hängen von der spezifischen Dachkonfiguration ab.', 20, yPosition);

      return yPosition + 10;
    }

    // Berechne Teile für eine spezifische Konfiguration - VOLLSTÄNDIG ISOLIERT
    async calculateConfigParts(config) {
      if (!config.selection || !config.cols || !config.rows) {
        return {};
      }

      // ISOLIERTE Berechnung ohne Grid-Eigenschaften zu berühren!
      const calculationData = {
        selection: config.selection.map(row => [...row]), // Deep copy
        rows: config.rows,
        cols: config.cols,
        cellWidth: config.cellWidth || 179,
        cellHeight: config.cellHeight || 113,
        orientation: config.orientation
      };

      let parts;
      try {
        // Direkte Berechnung mit calculationManager - KEINE Grid-Modification!
        parts = await calculationManager.calculate('calculateParts', calculationData);
      } catch (error) {
        console.warn('calculationManager failed, using fallback:', error);
        // Fallback zu isolierter Berechnung
        parts = this.calculatePartsDirectly(calculationData);
      }
      
      // Entferne Module wenn nicht ausgewählt
      if (!config.includeModules) {
        delete parts.Solarmodul;
      }
      
      // Füge optionale Komponenten nur hinzu wenn ausgewählt
      if (config.mc4) {
        const moduleCount = config.selection.flat().filter(v => v).length;
        parts.MC4_Stecker = Math.ceil(moduleCount / 30);
      }
      
      if (config.cable) {
        parts.Solarkabel = 1;
      }
      
      if (config.wood) {
        parts.Holzunterleger = (parts.Schiene_240_cm || 0) + (parts.Schiene_360_cm || 0);
      }

      return parts;
    }

    // Hilfsfunktion für Gruppenverarbeitung (aus CalculationManager übernommen)
    processGroup(len, parts, cellWidth, cellHeight, orientation) {
      const isVertical = orientation === 'vertical';
      const actualCellWidth = isVertical ? cellHeight : cellWidth;
      
      const totalLen = len * actualCellWidth;
      const floor360 = Math.floor(totalLen / 360);
      const rem360 = totalLen - floor360 * 360;
      const floor240 = Math.ceil(rem360 / 240);
      const pure360 = Math.ceil(totalLen / 360);
      const pure240 = Math.ceil(totalLen / 240);
      
      const mixed = floor360 + floor240;
      const pure = Math.min(pure360, pure240);
      
      if (mixed <= pure) {
        parts.Schiene_360_cm += floor360;
        parts.Schiene_240_cm += floor240;
      } else {
        if (pure360 <= pure240) {
          parts.Schiene_360_cm += pure360;
        } else {
          parts.Schiene_240_cm += pure240;
        }
      }
      
      parts.Solarmodul += len;
      parts.Endklemmen += 2;
      parts.Mittelklemmen += Math.max(0, len - 1);
      parts.Dachhaken += len;
      parts.Schrauben += len * 4;
      parts.Endkappen += 2;
      
      const totalSchienen = (parts.Schiene_240_cm || 0) + (parts.Schiene_360_cm || 0);
      if (totalSchienen > 1) {
        parts.Schienenverbinder += Math.max(0, totalSchienen - len);
      }
    }

    // Generiere Dateinamen basierend auf Konfiguration(en)
    generateFileName(configs) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '-'); // HH-MM
      
      let configName = 'Solar-Konfiguration';
      
      if (configs.length === 1) {
        configName = configs[0].name || 'Konfiguration';
      } else if (configs.length > 1) {
        configName = `${configs.length}-Konfigurationen`;
      }
      
      // Bereinige Dateinamen von ungültigen Zeichen
      configName = configName.replace(/[<>:"/\\|?*]/g, '-');
      
      return `${configName}_${dateStr}_${timeStr}.pdf`;
    }
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
        checkboxCombination: /(?:^|\s)(?:mit|und)\s+(.+?)(?:\s+und\s+(.+?))*(?:\s*$)/i,
        // NEUE ACTION PATTERNS:
        // "Konfiguration speichern", "config speichern", "speichern", "save"
        saveConfig: /^(?:(?:konfiguration|konfig|config)\s*)?(?:speichern|save)$/i,
        // "Konfiguration löschen", "config löschen" (NICHT nur "löschen" oder "delete")
        deleteConfig: /^(?:konfiguration|konfig|config)\s*(?:löschen|delete)$/i,
        // "module löschen" → Module-Auswahl löschen
        deleteModules: /^modul[e]?[n]?\s*löschen$/i,
        // "reset", "zurücksetzen" → Grid zurücksetzen
        resetGrid: /^(?:reset|zurücksetzen|zurücksetzen)$/i
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
        
        // Prüfe auf Abstand auch bei Grid-Größen-Angaben
        const spacingMatch = input.match(this.patterns.spacing);
        let spacingRows = 0;
        
        if (spacingMatch) {
          if (spacingMatch[0].toLowerCase().includes('mit') && !spacingMatch[1]) {
            spacingRows = 1; // Standard-Abstand
          } else if (spacingMatch[1]) {
            spacingRows = parseInt(spacingMatch[1]);
          }
          
          // Wenn Abstand bei Grid-Größe, prüfe ob bereits Module vorhanden sind
          if (spacingRows >= 0) { // >= 0 um auch "ohne abstand" zu unterstützen
            // Überprüfe ob bereits eine Auswahl existiert (dynamische Anpassung)
            const hasExistingSelection = this.solarGrid.selection && 
              this.solarGrid.selection.some(row => row && row.some(cell => cell === true));
            
            if (hasExistingSelection) {
              // Dynamische Abstand-Anpassung auf bestehendes Grid
              config.adjustSpacing = {
                spacing: spacingRows,
                targetCols: config.cols,
                targetRows: config.rows
              };
            } else {
              // Neue Grid-Erstellung mit Abstand (wie bisher)
              const actualRows = Math.ceil(config.rows / (1 + Math.max(spacingRows, 1)));
              const totalCells = config.cols * actualRows;
              
              config.rowConfig = {
                rows: actualRows,
                modulesPerRow: config.cols,
                spacing: spacingRows,
                totalModules: totalCells
              };
            }
          }
        }
      }

      // NEUE: Separate Abstand-Anpassung ohne Grid-Größe (z.B. nur "mit abstand")
      if (!gridMatch) { // Nur wenn keine Grid-Größe angegeben wurde
        const spacingOnlyMatch = input.match(this.patterns.spacing);
        if (spacingOnlyMatch) {
          let spacingRows = 0;
          
          if (spacingOnlyMatch[0].toLowerCase().includes('ohne')) {
            spacingRows = 0; // "ohne abstand"
          } else if (spacingOnlyMatch[0].toLowerCase().includes('mit') && !spacingOnlyMatch[1]) {
            spacingRows = 1; // "mit abstand" (Standard)
          } else if (spacingOnlyMatch[1]) {
            spacingRows = parseInt(spacingOnlyMatch[1]); // "mit X reihen abstand"
          }
          
          // Prüfe ob bereits Module vorhanden sind
          const hasExistingSelection = this.solarGrid.selection && 
            this.solarGrid.selection.some(row => row && row.some(cell => cell === true));
          
          if (hasExistingSelection) {
            // Dynamische Abstand-Anpassung auf bestehendes Grid
            config.adjustSpacing = {
              spacing: spacingRows,
              targetCols: null, // Keine spezifische Ziel-Spalten-Anzahl
              targetRows: null  // Keine spezifische Ziel-Reihen-Anzahl
            };
            
            // Früher Return, da dies die Hauptfunktion ist
            return config;
          } else {
            // Keine Module vorhanden - Fehlermeldung
            this.solarGrid.showToast(`⚠️ Keine Module vorhanden - erst Module auswählen, dann Abstand anpassen`, 3000);
            return {};
          }
        }
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
          
          // Prüfe auf Abstand auch bei einfacher Module-Anzahl
          const spacingMatch = input.match(this.patterns.spacing);
          let spacingRows = 0;
          
          if (spacingMatch) {
            if (spacingMatch[0].toLowerCase().includes('mit') && !spacingMatch[1]) {
              spacingRows = 1; // Standard-Abstand
            } else if (spacingMatch[1]) {
              spacingRows = parseInt(spacingMatch[1]);
            }
          }
          
          // Automatisch optimale Grid-Größe berechnen
          const gridSize = this.calculateOptimalGrid(config.moduleCount);
          config.cols = gridSize.cols;
          config.rows = gridSize.rows;
          
          // Wenn Abstand gewünscht, erstelle rowConfig für gleichmäßige Verteilung
          if (spacingRows > 0) {
            const optimalRows = Math.ceil(Math.sqrt(config.moduleCount / gridSize.cols));
            const modulesPerRow = Math.ceil(config.moduleCount / optimalRows);
            
            config.rowConfig = {
              rows: optimalRows,
              modulesPerRow: modulesPerRow,
              spacing: spacingRows,
              totalModules: config.moduleCount
            };
            
            // Angepasste Grid-Größe mit Abstand
            config.rows = optimalRows + (optimalRows - 1) * spacingRows;
            config.cols = Math.max(config.cols, modulesPerRow);
          }
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

      // NEUE ACTION PATTERNS PRÜFEN (höchste Priorität - vor allen anderen Patterns)
      const saveConfigMatch = input.match(this.patterns.saveConfig);
      if (saveConfigMatch) {
        config.action = 'saveConfig';
        return config;
      }

      const deleteConfigMatch = input.match(this.patterns.deleteConfig);
      if (deleteConfigMatch) {
        config.action = 'deleteConfig';
        return config;
      }

      const deleteModulesMatch = input.match(this.patterns.deleteModules);
      if (deleteModulesMatch) {
        config.action = 'deleteModules';
        return config;
      }

      const resetGridMatch = input.match(this.patterns.resetGrid);
      if (resetGridMatch) {
        config.action = 'resetGrid';
        return config;
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
        if (this.solarGrid.orV) this.solarGrid.orV.checked = config.orientation === 'vertical';
        if (this.solarGrid.orH) this.solarGrid.orH.checked = config.orientation === 'horizontal';
      }

      // NEUE ACTION PATTERNS HANDHABEN (höchste Priorität)
      if (config.action) {
        this.handleAction(config.action);
        return; // Keine weitere Konfiguration anwenden
      }

      // Optionen setzen (nur die angegebenen)
      if (config.hasOwnProperty('includeModules')) {
        if (this.solarGrid.incM) this.solarGrid.incM.checked = config.includeModules;
      }
      if (config.hasOwnProperty('mc4')) {
        if (this.solarGrid.mc4) this.solarGrid.mc4.checked = config.mc4;
      }
      if (config.hasOwnProperty('cable')) {
        if (this.solarGrid.solarkabel) this.solarGrid.solarkabel.checked = config.cable;
      }
      if (config.hasOwnProperty('wood')) {
        if (this.solarGrid.holz) this.solarGrid.holz.checked = config.wood;
      }

      // INTELLIGENTE Selection-Matrix-Erstellung
      // NUR bei Grid-Größen-Änderung → Selection anpassen/löschen
      // Bei reinen Checkbox-Änderungen → Selection beibehalten
      const gridSizeChanged = (config.cols && config.cols !== oldCols) || 
                             (config.rows && config.rows !== oldRows);
      
      let newSelection;
      if (gridSizeChanged) {
        // Grid-Größe geändert: Verhalten hängt davon ab ob moduleCount/rowConfig folgt
        if (config.moduleCount || config.rowConfig) {
          // Wenn moduleCount oder rowConfig folgt: LEERE Matrix (autoSelect übernimmt)
          newSelection = Array.from({ length: this.solarGrid.rows }, () =>
            Array.from({ length: this.solarGrid.cols }, () => false)
          );
        } else {
          // Nur Grid-Größe ohne Auto-Selection: Behalte was möglich ist
          newSelection = Array.from({ length: this.solarGrid.rows }, (_, y) =>
            Array.from({ length: this.solarGrid.cols }, (_, x) => {
              if (oldSelection && y < oldSelection.length && x < oldSelection[y].length) {
                return oldSelection[y][x];
              }
              return false;
            })
          );
        }
      } else {
        // Keine Grid-Änderung: Behalte bestehende Selection komplett
        newSelection = oldSelection || Array.from({ length: this.solarGrid.rows }, () =>
          Array.from({ length: this.solarGrid.cols }, () => false)
        );
      }
      
      this.solarGrid.selection = newSelection;

      // Grid mit neuen Dimensionen neu aufbauen
      this.solarGrid.updateSize();
      this.solarGrid.buildGrid();
      this.solarGrid.buildList();
      this.solarGrid.updateSummaryOnChange();

      // NEUE: Dynamische Abstand-Anpassung auf bestehendes Grid
      if (config.adjustSpacing) {
        this.adjustGridSpacing(config.adjustSpacing);
      }
      // Wenn Reihen-Konfiguration angegeben, verwende spezielle Selektion
      else if (config.rowConfig) {
        this.applyRowConfiguration(config.rowConfig, config.intelligentDistribution);
      }
      // Wenn Module-Anzahl angegeben, automatisch auswählen
      else if (config.moduleCount) {
        this.autoSelectModules(config.moduleCount);
      }
      
      // Verstecke Tipps nach erster Nutzung
      this.hideHelpAfterFirstUse();
    }
    
    // Neue Methode: Preview-Grid verstecken und Konfiguration auf Hauptgrid anwenden
    applyPreviewToMainGrid(config) {
      console.log('Applying preview configuration to main grid:', config); // Debug
      
      // Verstecke Preview-Grid und zeige Hauptgrid
      this.solarGrid.hidePreviewGrid();
      this.solarGrid.showMainGrid();
      
      // Wende Konfiguration auf Hauptgrid an
      this.applyConfiguration(config);
    }
    
    // NEUE ACTION HANDLER METHODE
    handleAction(action) {
      switch (action) {
        case 'saveConfig':
          this.solarGrid.saveNewConfig();
          this.solarGrid.showToast('💾 Konfiguration gespeichert', 2000);
          break;
          
        case 'deleteConfig':
          // Prüfe ob mindestens 2 Konfigurationen vorhanden sind
          if (this.solarGrid.configs.length <= 1) {
            this.solarGrid.showToast('⚠️ Kann letzte Konfiguration nicht löschen', 3000);
            return;
          }
          // Lösche aktuelle Konfiguration
          if (this.solarGrid.currentConfig !== null) {
            this.solarGrid.deleteConfig(this.solarGrid.currentConfig);
            this.solarGrid.showToast('🗑️ Konfiguration gelöscht', 2000);
          }
          break;
          
        case 'deleteModules':
          // Lösche nur die Module-Auswahl, behalte Grid-Größe
          this.clearModuleSelection();
          this.solarGrid.showToast('🔄 Module-Auswahl gelöscht', 2000);
          break;
          
        case 'resetGrid':
          this.solarGrid.resetGridToDefault();
          this.solarGrid.showToast('⚡ Grid zurückgesetzt', 2000);
          break;
          
        default:
          console.warn('Unbekannte Action:', action);
      }
    }

    // Hilfsmethode: Lösche nur Module-Auswahl (nicht Grid-Größe)
    clearModuleSelection() {
      // Setze alle Zellen auf false, behalte aber Grid-Dimensionen
      for (let y = 0; y < this.solarGrid.rows; y++) {
        for (let x = 0; x < this.solarGrid.cols; x++) {
          if (this.solarGrid.selection[y]) {
            this.solarGrid.selection[y][x] = false;
          }
        }
      }
      
      // Grid und Liste neu aufbauen
      this.solarGrid.buildGrid();
      this.solarGrid.buildList();
      this.solarGrid.updateSummaryOnChange();
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
      
      // ROBUST: Initialisiere das komplette Selection-Array für alle Dimensionen
      this.solarGrid.selection = Array.from({ length: this.solarGrid.rows }, () =>
        Array.from({ length: this.solarGrid.cols }, () => false)
      );
      
      // Selektiere Module von links nach rechts, oben nach unten
      let selected = 0;
      for (let y = 0; y < this.solarGrid.rows && selected < count; y++) {
        for (let x = 0; x < this.solarGrid.cols && selected < count; x++) {
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
    
    // NEUE METHODE: Dynamische Abstand-Anpassung für bestehende Grids
    adjustGridSpacing(spacingConfig) {
      const { spacing, targetCols, targetRows } = spacingConfig;
      
      // 1. Identifiziere alle belegten Reihen im aktuellen Grid
      const occupiedRows = [];
      for (let y = 0; y < this.solarGrid.rows; y++) {
        if (this.solarGrid.selection[y] && this.solarGrid.selection[y].some(cell => cell === true)) {
          // Sammle alle Module in dieser Reihe
          const modules = [];
          for (let x = 0; x < this.solarGrid.cols; x++) {
            if (this.solarGrid.selection[y][x] === true) {
              modules.push(x);
            }
          }
          occupiedRows.push({ originalRow: y, modules: modules });
        }
      }
      
      if (occupiedRows.length === 0) return; // Keine Module vorhanden
      
      // 2. Berechne neue Grid-Größe basierend auf gewünschtem Abstand
      let newRows;
      if (spacing === 0) {
        // "ohne abstand" - nur die belegten Reihen
        newRows = occupiedRows.length;
      } else {
        // "mit X reihen abstand" - belegte Reihen + Abstände dazwischen
        newRows = occupiedRows.length + (occupiedRows.length - 1) * spacing;
      }
      
      // Berechne benötigte Spalten (mindestens so viele wie das breiteste Modul braucht)
      const maxModuleX = Math.max(...occupiedRows.map(row => 
        row.modules.length > 0 ? Math.max(...row.modules) : 0
      ));
      const newCols = Math.max(
        targetCols || this.solarGrid.cols, // Ziel-Spalten oder aktuelle Spalten
        maxModuleX + 1                     // Mindestens so breit wie das breiteste Modul
      );
      
      // 3. Passe Grid-Größe an
      this.solarGrid.cols = newCols;
      this.solarGrid.rows = newRows;
      
      // 4. Erstelle neue Selection-Matrix
      const newSelection = Array.from({ length: newRows }, () =>
        Array.from({ length: newCols }, () => false)
      );
      
      // 5. Platziere Module an neuen Positionen mit korrektem Abstand
      let currentTargetRow = 0;
      for (let i = 0; i < occupiedRows.length; i++) {
        const occupiedRow = occupiedRows[i];
        
        // Platziere alle Module dieser Reihe
        for (const moduleX of occupiedRow.modules) {
          if (moduleX < newCols) {
            newSelection[currentTargetRow][moduleX] = true;
          }
        }
        
        // Springe zum nächsten verfügbaren Slot (mit Abstand)
        if (i < occupiedRows.length - 1) { // Nicht beim letzten Element
          currentTargetRow += 1 + spacing;
        }
      }
      
      // 6. Aktualisiere Selection und Grid
      this.solarGrid.selection = newSelection;
      this.solarGrid.updateSize();
      this.solarGrid.buildGrid();
      this.solarGrid.buildList();
      this.solarGrid.updateSummaryOnChange();
      
      // 7. Erfolgsmeldung
      if (spacing === 0) {
        this.solarGrid.showToast(`🔧 Abstände entfernt - ${occupiedRows.length} Reihen kompakt`, 2000);
      } else {
        this.solarGrid.showToast(`📏 ${spacing} Reihen Abstand hinzugefügt - ${newRows} Reihen total`, 2000);
      }
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
      
      // ROBUSTE Selection-Array-Initialisierung für ALLE Dimensionen
      // Stelle sicher, dass selection[][] für die aktuellen Dimensionen existiert
      for (let y = 0; y < this.solarGrid.rows; y++) {
        if (!this.solarGrid.selection[y]) {
          this.solarGrid.selection[y] = [];
        }
        // Stelle sicher, dass alle X-Positionen existieren
        for (let x = 0; x < this.solarGrid.cols; x++) {
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
        
        // Selektiere Module in dieser Reihe - VERWENDE AKTUELLE GRID-DIMENSIONEN
        for (let x = 0; x < modulesInThisRow && x < this.solarGrid.cols; x++) {
          if (currentRow < this.solarGrid.rows) {
            // Stelle sicher, dass die Position existiert
            if (!this.solarGrid.selection[currentRow]) {
              this.solarGrid.selection[currentRow] = [];
            }
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
      
      // NEUE: Drag-to-Select Properties
      this.isDragging = false;
      this.dragStart = null;
      this.mousePressed = false;
      
      this.setupKeyListener();
      this.setupGlobalMouseEvents();
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
        if (document.head) {
          document.head.appendChild(style);
        }
        if (document.body) {
          document.body.appendChild(indicator);
        }
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
        
        // NEUE: Drag-to-Select Event Listeners
        newCell.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Verhindert Textauswahl während Drag
          
          // Erfasse aktuellen Status der Start-Zelle für intelligentes Toggle
          const isCurrentlySelected = this.solarGrid.selection[y]?.[x] || false;
          
          // Starte Drag-to-Select Modus
          this.mousePressed = true;
          this.isDragging = false; // Wird erst bei mousemove aktiviert
          this.dragStart = { x, y, wasSelected: isCurrentlySelected };
          
          // Visuelle Markierung der Start-Zelle
          this.clearHighlight();
          newCell.classList.add('drag-start-marker');
          
          // Visueller Hinweis auf Toggle-Modus
          if (isCurrentlySelected) {
            newCell.classList.add('drag-deselect-mode');
          } else {
            newCell.classList.add('drag-select-mode');
          }
        });
        
        newCell.addEventListener('mouseenter', (e) => {
          if (this.mousePressed && this.dragStart) {
            // Drag-to-Select: Live-Preview des Bereichs mit intelligenter Vorschau
            this.isDragging = true;
            this.highlightRange(this.dragStart, { x, y });
          } else if (this.bulkMode && this.firstClick) {
            // Alter Bulk-Modus: Hover-Preview zwischen Clicks
            this.highlightRange(this.firstClick, { x, y });
          }
        });
        
        newCell.addEventListener('mouseup', (e) => {
          if (this.mousePressed && this.dragStart) {
            e.preventDefault();
            
            if (this.isDragging || (this.dragStart.x === x && this.dragStart.y === y)) {
              // Drag beendet ODER Single-Click (gleiche Zelle)
              this.selectRange(this.dragStart, { x, y });
              
              // Toast-Nachricht mit intelligenter Beschreibung
              const selectedCount = this.calculateRangeSize(this.dragStart, { x, y });
              const action = this.dragStart.wasSelected ? "abgewählt" : "ausgewählt";
              const emoji = this.dragStart.wasSelected ? "❌" : "✅";
              this.solarGrid.showToast(`${emoji} Drag-${action}: ${selectedCount} Zellen`, 1500);
            }
            
            // Reset Drag-Zustand
            this.resetDragState();
          }
        });

        // Füge neue Event Listener hinzu
        newCell.addEventListener('click', (e) => {
          // Verhindere Click-Verarbeitung wenn gerade ein Drag beendet wurde
          if (this.isDragging || (this.mousePressed && this.dragStart)) {
            return;
          }
          
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

        newCell.addEventListener('mouseleave', () => {
          // Nur Highlight löschen wenn nicht gerade gedraggt wird
          if (!this.mousePressed) {
            this.clearHighlight();
          }
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
      
      // Ermittle ob wir im Auswahl- oder Abwahl-Modus sind
      const isSelectMode = start.wasSelected !== undefined ? !start.wasSelected : true;
      
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const index = y * this.solarGrid.cols + x;
          if (cells[index]) {
            // Basis-Highlight (gelber Rahmen)
            cells[index].classList.add('bulk-highlight');
            
            // Intelligente Preview je nach Modus
            if (isSelectMode) {
              // Auswahl-Modus: Zeige Solarpanel-Preview mit 30% Opacity
              cells[index].classList.add('drag-preview-select');
            } else {
              // Abwahl-Modus: Zeige Unselected-Preview mit 30% Opacity
              cells[index].classList.add('drag-preview-deselect');
            }
          }
        }
      }
    }

    clearHighlight() {
      // Entferne alle Highlight- und Preview-Klassen
      const highlighted = this.solarGrid.gridEl.querySelectorAll('.bulk-highlight, .drag-preview-select, .drag-preview-deselect');
      highlighted.forEach(cell => {
        cell.classList.remove('bulk-highlight', 'drag-preview-select', 'drag-preview-deselect');
      });
      
      // Entferne auch alle Drag-Marker
      const dragMarkers = this.solarGrid.gridEl.querySelectorAll('.drag-start-marker, .drag-select-mode, .drag-deselect-mode');
      dragMarkers.forEach(cell => {
        cell.classList.remove('drag-start-marker', 'drag-select-mode', 'drag-deselect-mode');
      });
    }
    
    // NEUE METHODEN für Drag-to-Select
    resetDragState() {
      this.mousePressed = false;
      this.isDragging = false;
      this.dragStart = null;
      this.clearHighlight();
    }
    
    calculateRangeSize(start, end) {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);  
      const maxY = Math.max(start.y, end.y);
      
      return (maxX - minX + 1) * (maxY - minY + 1);
    }

    clearFirstClickMarker() {
      const cells = this.solarGrid.gridEl.querySelectorAll('.grid-cell');
      cells.forEach(cell => cell.classList.remove('first-click-marker'));
    }
    
    // NEUE METHODE: Globale Mouse-Events für Drag-to-Select
    setupGlobalMouseEvents() {
      // Globaler Mouse-Up Event um Drag-Operations außerhalb des Grids zu beenden
      document.addEventListener('mouseup', (e) => {
        if (this.mousePressed) {
          // Drag wurde außerhalb des Grids beendet - ohne Auswahl
          this.resetDragState();
        }
      });
      
      // Grid-Leave Event um Drag-Preview zu stoppen
      this.solarGrid.gridEl.addEventListener('mouseleave', () => {
        if (this.mousePressed && !this.isDragging) {
          // Mouse verlässt Grid während Drag-Start - Reset ohne Auswahl
          this.resetDragState();
        }
      });
      
      // Verhindere Kontext-Menu während Drag-Operationen
      this.solarGrid.gridEl.addEventListener('contextmenu', (e) => {
        if (this.isDragging || this.mousePressed) {
          e.preventDefault();
        }
      });
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
      this.listHolder    = document.querySelector('.product-section');
      this.prodList      = document.getElementById('produktliste');
      this.summaryHolder = document.getElementById('summary-list-holder');
      this.summaryList   = document.getElementById('summary-list');
      this.saveBtn       = document.getElementById('save-config-btn');
      this.addBtn        = document.getElementById('add-to-cart-btn');
      this.summaryBtn    = document.getElementById('summary-add-cart-btn');
      this.configListEl  = document.getElementById('config-list');
      this.resetBtn      = document.getElementById('reset-btn');
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

      // PDF Generator initialisieren
      this.pdfGenerator = new SolarPDFGenerator(this);

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
      
      // Berechne Produkt-Quantitäten für Webhook - ALLE Produkte, auch mit 0
      const parts = this.calculatePartsDirectly({
        selection: targetConfig.selection,
        cols: targetConfig.cols,
        rows: targetConfig.rows,
        cellWidth: targetConfig.cellWidth,
        cellHeight: targetConfig.cellHeight,
        orientation: targetConfig.orientation,
        incM: targetConfig.incM,
        mc4: targetConfig.mc4,
        solarkabel: targetConfig.solarkabel,
        holz: targetConfig.holz
      });

      // Stelle sicher, dass alle 12 Produkte übertragen werden, auch mit 0
      // Zusätzliche Berechnungen basierend auf Checkbox-Einstellungen
      if (targetConfig.mc4) parts.MC4_Stecker = targetConfig.selection.flat().filter(v => v).length;
      if (targetConfig.solarkabel) parts.Solarkabel = 1; // 1x wenn ausgewählt
      if (targetConfig.holz) parts.Holzunterleger = (parts.Schiene_240_cm || 0) + (parts.Schiene_360_cm || 0);
      
      const allProductQuantities = {
        Solarmodul: parts.Solarmodul || 0,
        Endklemmen: parts.Endklemmen || 0,
        Schrauben: parts.Schrauben || 0,
        Dachhaken: parts.Dachhaken || 0,
        Mittelklemmen: parts.Mittelklemmen || 0,
        Endkappen: parts.Endkappen || 0,
        Schienenverbinder: parts.Schienenverbinder || 0,
        Schiene240cm: parts.Schiene_240_cm || 0,
        Schiene360cm: parts.Schiene_360_cm || 0,
        MC4Stecker: parts.MC4_Stecker || 0,
        Solarkabel: parts.Solarkabel || 0,
        Holzunterleger: parts.Holzunterleger || 0
      };
      
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
        productQuantities: allProductQuantities,
        totalPrice: summary.totalPrice, // Verwende den korrekten Gesamtpreis aus getProductSummary
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
        // NEUE: Füge Grid-Bild zu Webhook-Daten hinzu
        const gridImage = await this.pdfGenerator.captureGridImageForWebhook(configData);
        if (gridImage) {
          // Berechne die tatsächlichen Canvas-Dimensionen
          const cols = configData.cols || 5;
          const rows = configData.rows || 5;
          const cellWidth = 60;
          const cellHeight = 60;
          const cellGap = 2;
          const padding = 40;
          
          const width = cols * cellWidth + (cols - 1) * cellGap + padding;
          const height = rows * cellHeight + (rows - 1) * cellGap + padding;
          
          console.log('Grid Image Dimensions:', { cols, rows, width, height });
          
          // Erstelle sowohl Data-URL als auch reinen Base64-String für Kompatibilität
          const base64Only = gridImage.split(',')[1];
          
          configData.gridImage = {
            data: gridImage, // Vollständiger Data-URL: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...
            base64: base64Only, // Reiner Base64-String für Fallback
            format: 'data-url',
            mimeType: 'image/png',
            width: width,
            height: height
          };
        }

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
        console.error('Webhook send error:', error);
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
        const originalOrientation = this.orV ? this.orV.checked : false;
        const originalSolarkabel = this.solarkabel ? this.solarkabel.checked : false;
        const originalIncM = this.incM ? this.incM.checked : false;
        const originalMc4 = this.mc4 ? this.mc4.checked : false;
        const originalHolz = this.holz ? this.holz.checked : false;
        
        this.selection = currentConfig.selection;
        if (this.orV) this.orV.checked = currentConfig.orientation === 'vertical';
        if (this.orH) this.orH.checked = !(currentConfig.orientation === 'vertical');
        if (this.solarkabel) this.solarkabel.checked = currentConfig.solarkabel;
        if (this.incM) this.incM.checked = currentConfig.incM;
        if (this.mc4) this.mc4.checked = currentConfig.mc4;
        if (this.holz) this.holz.checked = currentConfig.holz;

        // Erstelle individuelle Konfigurationsdaten mit getConfigData
        const configData = this.getConfigData(currentConfig);
        
        // Füge zusätzliche Metadaten hinzu
        configData.configIndex = idx;
        configData.configName = cfg.name;
        configData.totalConfigsInSession = this.configs.length;

        // Ursprüngliche Werte wiederherstellen
        this.selection = originalSelection;
        if (this.orV) this.orV.checked = originalOrientation;
        if (this.orH) this.orH.checked = !originalOrientation;
        if (this.solarkabel) this.solarkabel.checked = originalSolarkabel;
        if (this.incM) this.incM.checked = originalIncM;
        if (this.mc4) this.mc4.checked = originalMc4;
        if (this.holz) this.holz.checked = originalHolz;

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

  				// Prüfe ob Input-Elemente existieren bevor Event-Listener hinzugefügt werden
		const inputs = [this.wIn, this.hIn].filter(el => el);
		inputs.forEach(el =>
			el.addEventListener('change', () => {
				this.trackInteraction();
				this.updateSize();
				this.buildList();
				this.updateSummaryOnChange();
			})
		);
      
            // Prüfe ob Radio-Buttons existieren bevor auf sie zugegriffen wird
      if (this.orH && this.orV) {
        let lastOrientation = this.orH.checked ? 'horizontal' : 'vertical';

        [this.orH, this.orV].forEach(el =>
          el.addEventListener('change', () => {

            if (!el.checked) return;

            const currentOrientation = el === this.orH ? 'horizontal' : 'vertical';

            if (currentOrientation === lastOrientation) return;

            // Synchronisiere mit Setup-Container Radio-Buttons
            const orientHSetup = document.getElementById('orient-h-setup');
            const orientVSetup = document.getElementById('orient-v-setup');
            if (orientHSetup && orientVSetup) {
              orientHSetup.checked = el === this.orH;
              orientVSetup.checked = el === this.orV;
            }

            // Vollständige Grid-Neuinitialisierung wie bei Smart Config
            this.trackInteraction();
            this.updateSize();
            this.buildGrid(); // Vollständige Grid-Neuinitialisierung für Animation
            this.buildList();
            this.updateSummaryOnChange();

            lastOrientation = currentOrientation;
          })
        );
      }

  		// Prüfe ob Checkboxen existieren bevor Event-Listener hinzugefügt werden
		const checkboxes = [this.incM, this.mc4, this.solarkabel, this.holz].filter(el => el);
		checkboxes.forEach(el =>
			el.addEventListener('change', () => {
				this.trackInteraction();
				this.buildList();
				this.updateSummaryOnChange();
				this.renderProductSummary(); // Aktualisiere auch die Summary aller Konfigurationen
			})
		);
		
		// Event-Listener für Setup-Container Radio-Buttons
		const orientHSetup = document.getElementById('orient-h-setup');
		const orientVSetup = document.getElementById('orient-v-setup');
		
		if (orientHSetup && orientVSetup) {
			[orientHSetup, orientVSetup].forEach(el =>
				el.addEventListener('change', () => {
					if (!el.checked) return;
					
					// Synchronisiere mit den Haupt-Radio-Buttons
					const isVertical = el === orientVSetup;
					if (this.orV) this.orV.checked = isVertical;
					if (this.orH) this.orH.checked = !isVertical;
					
					// Vollständige Grid-Neuinitialisierung wie bei Smart Config
					this.trackInteraction();
					this.updateSize();
					this.buildGrid(); // Vollständige Grid-Neuinitialisierung für Animation
					this.buildList();
					this.updateSummaryOnChange();
				})
			);
		}
      
      // Event-Listener für die Grid-Expansion-Buttons (neue Struktur)
			// Spalten-Buttons - rechts (fügt am Ende hinzu)
			document.querySelectorAll('[data-dir="right"]').forEach(btn => {
				if (btn.classList.contains('plus-btn')) {
					btn.addEventListener('click', () => {
						this.trackInteraction();
						this.addColumnRight();
					});
				} else if (btn.classList.contains('minus-btn')) {
					btn.addEventListener('click', () => {
						this.trackInteraction();
						this.removeColumnRight();
					});
				}
			});
			
			// Spalten-Buttons - links (fügt am Anfang hinzu)
			document.querySelectorAll('[data-dir="left"]').forEach(btn => {
				if (btn.classList.contains('plus-btn')) {
					btn.addEventListener('click', () => {
						this.trackInteraction();
						this.addColumnLeft();
					});
				} else if (btn.classList.contains('minus-btn')) {
					btn.addEventListener('click', () => {
						this.trackInteraction();
						this.removeColumnLeft();
					});
				}
			});
			
			// Zeilen-Buttons - unten (fügt am Ende hinzu)
			document.querySelectorAll('[data-dir="bottom"]').forEach(btn => {
				if (btn.classList.contains('plus-btn')) {
					btn.addEventListener('click', () => {
						this.trackInteraction();
						this.addRowBottom();
					});
				} else if (btn.classList.contains('minus-btn')) {
					btn.addEventListener('click', () => {
						this.trackInteraction();
						this.removeRowBottom();
					});
				}
			});
			
			// Zeilen-Buttons - oben (fügt am Anfang hinzu)
			document.querySelectorAll('[data-dir="top"]').forEach(btn => {
				if (btn.classList.contains('plus-btn')) {
					btn.addEventListener('click', () => {
						this.trackInteraction();
						this.addRowTop();
					});
				} else if (btn.classList.contains('minus-btn')) {
					btn.addEventListener('click', () => {
						this.trackInteraction();
						this.removeRowTop();
					});
				}
			});

  		// Prüfe ob Buttons existieren bevor Event-Listener hinzugefügt werden
  		if (this.saveBtn) {
  			this.saveBtn.addEventListener('click', () => {
  				this.trackInteraction();
  				this.saveNewConfig();
  			});
  		}
  		if (this.addBtn) {
  			this.addBtn.addEventListener('click', () => {
  				this.trackInteraction();
  				this.addCurrentToCart();
  			});
  		}
  		if (this.summaryBtn) {
  			this.summaryBtn.addEventListener('click', () => {
  				this.trackInteraction();
  				this.addAllToCart();
  			});
  		}
  		if (this.resetBtn) {
  			this.resetBtn.addEventListener('click', () => {
  				this.trackInteraction();
  				this.resetGridToDefault();
  			});
  		}
  		if (this.continueLaterBtn) {
  			this.continueLaterBtn.addEventListener('click', () => {
				this.trackInteraction();
				this.generateContinueLink();
			});
		}

		// Sidebar Toggle Funktionalität
		const sidebarToggle = document.getElementById('sidebar-toggle');
		const configSidebar = document.getElementById('config-sidebar');

		if (sidebarToggle && configSidebar) {
			// Sidebar standardmäßig öffnen
			configSidebar.classList.add('open');
			
			// Initiale Position setzen
			requestAnimationFrame(() => {
				configSidebar.style.right = '0';
			});

			sidebarToggle.addEventListener('click', () => {
				this.trackInteraction();
				configSidebar.classList.toggle('open');
				
				// Dynamische Position berechnen
				if (!configSidebar.classList.contains('open')) {
					const sidebarWidth = configSidebar.offsetWidth;
					const visibleWidth = 30; // 30px sichtbar
					const hiddenWidth = sidebarWidth - visibleWidth;
					configSidebar.style.right = `-${hiddenWidth}px`;
				} else {
					configSidebar.style.right = '0';
				}
			});
		}

		// Side-Section Toggle Funktionalität
		const sideToggle = document.getElementById('side-toggle');
		const sideSection = document.querySelector('.side-section');

		if (sideToggle && sideSection) {
			sideToggle.addEventListener('click', () => {
				this.trackInteraction();
				sideSection.classList.toggle('collapsed');
				const toggleIcon = sideToggle.querySelector('.toggle-icon');
				if (toggleIcon) {
					toggleIcon.textContent = sideSection.classList.contains('collapsed') ? '▶' : '◀';
				}
			});
		}

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
					container.style.display = 'flex';
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
								this.smartParser.applyPreviewToMainGrid(config);
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
					
					// Live-Grid-Preview beim Tippen
					quickInput.addEventListener('input', (e) => {
						const input = e.target.value.trim();
						
						console.log('Input changed:', input); // Debug
						
						// Clear previous timeout
						if (this.previewTimeout) {
							clearTimeout(this.previewTimeout);
						}
						
						if (input.length > 0) {
							try {
								const config = this.smartParser.parseInput(input);
								console.log('Parsed config:', config); // Debug
								
								// Prüfe ob die Konfiguration gültig ist (mindestens eine Änderung)
								if (config.cols || config.rows || config.moduleCount || config.orientation || config.adjustSpacing || config.rowConfig) {
									this.showConfigPreview(config);
								} else {
									console.log('No valid config changes, clearing preview'); // Debug
									// Keine gültigen Änderungen, Preview löschen
									if (this.solarGrid && this.solarGrid.clearGridPreview) {
										this.solarGrid.clearGridPreview();
									}
								}
							} catch (error) {
								console.log('Parsing error, clearing preview:', error.message); // Debug
								// Bei Parsing-Fehler Preview löschen
								if (this.solarGrid && this.solarGrid.clearGridPreview) {
									this.solarGrid.clearGridPreview();
								}
							}
						} else {
							console.log('Input empty, clearing preview'); // Debug
							// Clear preview if input is empty
							if (this.solarGrid && this.solarGrid.clearGridPreview) {
								this.solarGrid.clearGridPreview();
							}
						}
					});
					
				} else {
				}
				
				// Smart Config Help Dropdown Event-Handler initialisieren
				this.initializeSmartConfigHelp();
			}, 500);
		}
		
		showConfigPreview(config) {
			// Grid-Preview für alle Konfigurationen die das Grid beeinflussen
			if (config.cols || config.rows || config.moduleCount || config.orientation || config.adjustSpacing || config.rowConfig) {
				console.log('Preview config:', config); // Debug
				console.log('this:', this); // Debug - this ist die SolarGrid Instanz
				// this ist die SolarGrid Instanz selbst, also können wir direkt auf ihre Methoden zugreifen
				if (this && typeof this.showGridPreview === 'function') {
					console.log('Calling showGridPreview...'); // Debug
					this.showGridPreview(config);
				} else {
					console.error('showGridPreview not available!'); // Debug
					console.log('this type:', typeof this); // Debug
					console.log('this methods:', Object.getOwnPropertyNames(this || {})); // Debug
					console.log('showGridPreview exists:', this && typeof this.showGridPreview); // Debug
				}
			} else {
				console.log('No preview conditions met for config:', config); // Debug
			}
		}
		
		// Smart Config Help Dropdown Initialisierung
		initializeSmartConfigHelp() {
			// Trigger wird auch in setupSmartConfig aufgerufen
			const trigger = document.getElementById('smart-help-trigger');
			const dropdown = document.getElementById('smart-help-dropdown');
			
			if (!trigger || !dropdown) return; // Falls die Elemente nicht existieren
			
			let isHovered = false;
			let hoverTimeout = null;
			
			// JavaScript-basierte Hover-Funktionalität (überschreibt CSS)
			const showDropdown = () => {
				dropdown.style.opacity = '1';
				dropdown.style.visibility = 'visible';
				dropdown.style.transform = 'translateY(0)';
			};
			
			const hideDropdown = () => {
				dropdown.style.opacity = '0';
				dropdown.style.visibility = 'hidden';
				dropdown.style.transform = 'translateY(-10px)';
			};
			
			// Hover Events für Trigger
			trigger.addEventListener('mouseenter', () => {
				isHovered = true;
				if (hoverTimeout) clearTimeout(hoverTimeout);
				showDropdown();
			});
			
			trigger.addEventListener('mouseleave', () => {
				isHovered = false;
				hoverTimeout = setTimeout(() => {
					if (!isHovered) hideDropdown();
				}, 100); // Kleine Verzögerung für sanfteren Übergang
			});
			
			// Hover Events für Dropdown selbst
			dropdown.addEventListener('mouseenter', () => {
				isHovered = true;
				if (hoverTimeout) clearTimeout(hoverTimeout);
			});
			
			dropdown.addEventListener('mouseleave', () => {
				isHovered = false;
				hoverTimeout = setTimeout(() => {
					if (!isHovered) hideDropdown();
				}, 100);
			});
			
			// Verhindere dass Dropdown schließt wenn darauf geklickt wird
			dropdown.addEventListener('click', (e) => {
				e.stopPropagation();
			});
			
			// Schließe Dropdown bei Klick außerhalb
			document.addEventListener('click', (e) => {
				if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
					isHovered = false;
					hideDropdown();
				}
			});
			
			// Beispiel-Click Handler für sofortige Anwendung (ohne Ctrl+Click Tipp)
			document.querySelectorAll('.example').forEach(example => {
				example.addEventListener('click', (e) => {
					e.stopPropagation(); // Verhindere Click-Outside-Handler
					
					const quickInput = document.getElementById('quick-config-input');
					if (quickInput) {
						// Entferne Anführungszeichen und setze Wert
						quickInput.value = example.textContent.replace(/"/g, '');
						quickInput.focus();
						
						// Zeige Vorschau
						if (quickInput.value.length > 3) {
							try {
								const config = this.smartParser.parseInput(quickInput.value);
								this.showConfigPreview(config);
							} catch (error) {
								// Ignoriere Parsing-Fehler
							}
						}
						
						// Schließe Dropdown nach Beispiel-Auswahl
						isHovered = false;
						hideDropdown();
						
						// Optional: Scroll zur Smart Config Section
						setTimeout(() => {
							quickInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
						}, 100);
					}
				});
			});
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

  		if (this.listHolder) {
  			this.listHolder.style.display = 'block';
  		}
  		this.updateSize();
  		this.buildGrid();
  		this.buildList();
  		this.renderProductSummary();
  		this.updateSaveButtons();
		}

    updateSaveButtons() {
  		// Immer den "Neue Konfiguration speichern" Button anzeigen
  		if (this.saveBtn) {
  			this.saveBtn.style.display = 'inline-block';
  		}
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
		const inputW = parseInt(this.wIn ? this.wIn.value : '179', 10) || 179;
		const inputH = parseInt(this.hIn ? this.hIn.value : '113', 10) || 113;
  		
  				// Bei vertikaler Orientierung: Breite und Höhe der Zellen tauschen
		const isVertical = this.orV ? this.orV.checked : false;
  		const originalCellW = isVertical ? inputH : inputW;
  		const originalCellH = isVertical ? inputW : inputH;
  		
  				// Maximale verfügbare Größe
		// 50px Abstand auf allen Seiten: links, rechts, oben, unten
		// Insgesamt 100px für Breite (50px links + 50px rechts) und 100px für Höhe (50px oben + 50px unten)
		const maxWidth = this.wrapper ? this.wrapper.clientWidth - 100 : 800; // grid-wrapper Breite - 100px (50px links + 50px rechts)
		const maxHeight = this.wrapper ? this.wrapper.clientHeight - 100 : 600; // grid-wrapper Höhe - 100px (50px oben + 50px unten)
  		
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
  		
  				if (this.gridEl) {
			this.gridEl.style.width = finalWidth + 'px';
			this.gridEl.style.height = finalHeight + 'px';
		}
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
      if (this.incM && !this.incM.checked) delete parts.Solarmodul;
      if (this.mc4 && this.mc4.checked) {
        const panelCount = this.selection.flat().filter(v => v).length;
        parts.MC4_Stecker = Math.ceil(panelCount / 30); // 1 Packung pro 30 Panele
      }
      if (this.solarkabel && this.solarkabel.checked) parts.Solarkabel = 1; // 1x wenn ausgewählt
      if (this.holz && this.holz.checked)  parts.Holzunterleger = (parts['Schiene_240_cm'] || 0) + (parts['Schiene_360_cm'] || 0);

      const entries = Object.entries(parts).filter(([,v]) => v > 0);
      if (!entries.length) {
        if (this.listHolder) {
          this.listHolder.style.display = 'none';
        }
        return;
      }
      if (this.listHolder) {
        this.listHolder.style.display = 'block';
      }
      if (this.prodList) {
        this.prodList.innerHTML = entries.map(([k,v]) => {
          const packs = Math.ceil(v / VE[k]);
          return `<div class="produkt-item">
            <span>${packs}×</span>
            <img src="${this.mapImage(k)}" alt="${k}" onerror="this.src='https://via.placeholder.com/32?text=${encodeURIComponent(k)}'">
            <span>${k.replace(/_/g,' ')} (${v})</span>
          </div>`;
        }).join('');
        this.prodList.style.display = 'block';
      }
      } catch (error) {
        // Fallback: Verstecke Liste bei Fehler
        if (this.listHolder) {
          this.listHolder.style.display = 'none';
        }
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
		const defaultVertical = document.getElementById('orient-v') ? document.getElementById('orient-v').hasAttribute('checked') : false;
		if (this.orH) this.orH.checked = !defaultVertical;
		if (this.orV) this.orV.checked = defaultVertical;
		
		// Synchronisiere Setup-Container Radio-Buttons
		const orientHSetup = document.getElementById('orient-h-setup');
		const orientVSetup = document.getElementById('orient-v-setup');
		if (orientHSetup && orientVSetup) {
			orientHSetup.checked = !defaultVertical;
			orientVSetup.checked = defaultVertical;
		}

		// Setze alle Checkboxen zurück für neue Konfiguration
		if (this.incM) this.incM.checked = false;
		if (this.mc4) this.mc4.checked = false;
		if (this.solarkabel) this.solarkabel.checked = false;
		if (this.holz) this.holz.checked = false;

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
		if (this.colsIn) this.colsIn.value = this.default.cols;
		if (this.rowsIn) this.rowsIn.value = this.default.rows;
		if (this.wIn) this.wIn.value = this.default.width;
		if (this.hIn) this.hIn.value = this.default.height;
		if (this.orH) this.orH.checked = true;
		if (this.orV) this.orV.checked = false;

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
		this.wIn.value = cfg.cellWidth;
		this.hIn.value = cfg.cellHeight;
		this.orV.checked = cfg.orientation === 'vertical';
		this.orH.checked = !this.orV.checked;
		this.incM.checked = cfg.incM;
		this.mc4.checked = cfg.mc4;
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
        orientation: this.orV && this.orV.checked ? 'vertical' : 'horizontal',
        incM:        this.incM && this.incM.checked,
        mc4:         this.mc4 && this.mc4.checked,
        solarkabel:  this.solarkabel && this.solarkabel.checked,
        holz:        this.holz && this.holz.checked,
        cols:        this.cols,
        rows:        this.rows,
        cellWidth:   parseInt(this.wIn ? this.wIn.value : '179', 10),
        cellHeight:  parseInt(this.hIn ? this.hIn.value : '113', 10)
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
      // VOLLSTÄNDIG ISOLIERTE Berechnung - NIEMALS Grid-Eigenschaften berühren!
      const bundles = this.configs.map((c, idx) => {
        // Wenn dies die aktuell bearbeitete Konfiguration ist, verwende die aktuellen Checkbox-Werte
        if (idx === this.currentConfig) {
          return {
            selection:   this.selection.map(row => [...row]), // Deep copy
            rows:        this.rows,
            cols:        this.cols,
            cellWidth:   parseInt(this.wIn ? this.wIn.value : '179', 10),
            cellHeight:  parseInt(this.hIn ? this.hIn.value : '113', 10),
            orientation: this.orV && this.orV.checked ? 'vertical' : 'horizontal',
            incM:        this.incM && this.incM.checked,
            mc4:         this.mc4 && this.mc4.checked,
            solarkabel:  this.solarkabel && this.solarkabel.checked,
            holz:        this.holz && this.holz.checked
          };
        } else {
  				return {
    				selection:   c.selection.map(row => [...row]), // Deep copy
    				rows:        c.rows,
    				cols:        c.cols,
    				cellWidth:   c.cellWidth,
    				cellHeight:  c.cellHeight,
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
    			selection:   this.selection.map(row => [...row]), // Deep copy
    			rows:        this.rows,
    			cols:        this.cols,
    			cellWidth:   parseInt(this.wIn ? this.wIn.value : '179', 10),
    			cellHeight:  parseInt(this.hIn ? this.hIn.value : '113', 10),
    			orientation: this.orV && this.orV.checked ? 'vertical' : 'horizontal',
    			incM:        this.incM && this.incM.checked,
    			mc4:         this.mc4 && this.mc4.checked,
    			solarkabel:  this.solarkabel && this.solarkabel.checked,
    			holz:        this.holz && this.holz.checked
  			});
			}
  		
  		const total = {};
  		
  		// ISOLIERTE Berechnungen mit calculationManager - KEINE Grid-Eigenschaften berühren!
  		try {
  			const allParts = await Promise.all(bundles.map(async (b) => {
  				// Direkte Berechnung mit calculationManager ohne Grid-Modification
  				const calculationData = {
  					selection: b.selection,
  					rows: b.rows,
  					cols: b.cols,
  					cellWidth: b.cellWidth,
  					cellHeight: b.cellHeight,
  					orientation: b.orientation
  				};

  				let parts;
  				try {
  					parts = await calculationManager.calculate('calculateParts', calculationData);
  				} catch (error) {
  					// Fallback zu synchroner Berechnung
  					parts = this.calculatePartsDirectly(calculationData);
  				}

  				// Checkbox-basierte Modifikationen
    		if (!b.incM) delete parts.Solarmodul;
    		if (b.mc4) {
    			const panelCount = b.selection.flat().filter(v => v).length;
  					parts.MC4_Stecker = Math.ceil(panelCount / 30);
    		}
  				if (b.solarkabel) parts.Solarkabel = 1;
  				if (b.holz) parts.Holzunterleger = (parts['Schiene_240_cm'] || 0) + (parts['Schiene_360_cm'] || 0);

  				return parts;
  			}));

  			// Summiere alle Parts
  			allParts.forEach(parts => {
    		Object.entries(parts).forEach(([k, v]) => {
      		total[k] = (total[k] || 0) + v;
    		});
  		});
  		} catch (error) {
  			console.error('Error in renderProductSummary:', error);
  			// Fallback: Verwende leeres total
  		}

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

		// ISOLIERTE synchrone Berechnung für Fallback
		calculatePartsDirectly(data) {
			const { selection, rows, cols, cellWidth, cellHeight, orientation } = data;
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
						this.processGroupDirectly(run, parts, cellWidth, cellHeight, orientation); 
						run = 0; 
					}
				}
				if (run) this.processGroupDirectly(run, parts, cellWidth, cellHeight, orientation);
			}

			return parts;
		}

		// ISOLIERTE processGroup für Fallback
		processGroupDirectly(len, parts, cellWidth, cellHeight, orientation) {
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
        
        // PDF für aktuelle Konfiguration generieren
        if (this.pdfGenerator && this.pdfGenerator.isAvailable()) {
          setTimeout(() => {
            this.pdfGenerator.generatePDF('current');
          }, 500); // Kurze Verzögerung damit Warenkorb-Toast zuerst angezeigt wird
        }
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
      
        // SCHRITT 1: Erstelle vollständigen ISOLIERTEN Snapshot aller Konfigurationen
        const configSnapshot = this.createConfigSnapshot();
        
        // SCHRITT 2: PDF ZUERST mit isolierten Daten erstellen
        if (this.pdfGenerator && this.pdfGenerator.isAvailable()) {
          this.showToast('PDF wird erstellt...', 2000);
          await this.pdfGenerator.generatePDFFromSnapshot(configSnapshot);
          this.showToast('PDF erfolgreich erstellt ✅', 1500);
        }
        
        // SCHRITT 3: Berechne Produkte für Warenkorb (mit Live-Data für aktuellen Zustand)
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
      
        // SCHRITT 4: Sende alle Konfigurationen an Webhook (NACH PDF)
        const webhookSuccess = await this.sendAllConfigsToWebhook();
        if (webhookSuccess) {
          // Success handling if needed
        } else {
          // Error handling if needed  
        }
      
        // SCHRITT 5: Füge zum Warenkorb hinzu
      this.addPartsListToCart(total);
      this.showToast(`${totalItemCount} Produkte aus allen Konfigurationen werden hinzugefügt...`, 3000);
        
      } catch (error) {
        console.error('Fehler in addAllToCart:', error);
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

    // ===== PDF HELPER METHODS =====
    
    // Hole aktuelle Konfigurationsdaten für PDF
    getCurrentConfigData() {
      return {
        name: this.currentConfig !== null && this.configs[this.currentConfig] ? 
              this.configs[this.currentConfig].name : 'Aktuelle Konfiguration',
        cols: this.cols,
        rows: this.rows,
        selection: this.selection.map(row => [...row]), // Deep copy
        orientation: this.orV.checked ? 'vertical' : 'horizontal',
        includeModules: this.incM.checked,
        mc4: this.mc4.checked,
        cable: this.solarkabel.checked,
        wood: this.holz.checked
      };
    }

    // NEUE METHODE: Erstelle vollständigen isolierten Config-Snapshot für PDF
    createConfigSnapshot() {
      // Auto-Save der aktuellen Konfiguration falls nötig
      if (this.currentConfig !== null) {
        this.updateConfig();
      }
      
      // Erstelle KOMPLETT ISOLIERTE Kopie aller Konfigurationsdaten
      const snapshot = {
        timestamp: new Date().toISOString(),
        totalConfigs: this.configs.length,
        currentConfigIndex: this.currentConfig,
        configs: []
      };
      
      // Durchlaufe alle Konfigurationen und erstelle Deep Copies
      for (let index = 0; index < this.configs.length; index++) {
        const config = this.configs[index];
        
        // Hole Daten - für aktuelle Config verwende Live-Daten
        let targetSelection, targetCols, targetRows, targetOrientation;
        let targetIncM, targetMc4, targetCable, targetWood, targetCellWidth, targetCellHeight;
        
        if (index === this.currentConfig) {
          // Aktuelle Konfiguration: MOMENTAUFNAHME der Live-Daten
          targetSelection = this.selection ? this.selection.map(row => [...row]) : [];
          targetCols = this.cols;
          targetRows = this.rows;
          targetOrientation = this.orV.checked ? 'vertical' : 'horizontal';
          targetIncM = this.incM.checked;
          targetMc4 = this.mc4.checked;
          targetCable = this.solarkabel.checked;
          targetWood = this.holz.checked;
          targetCellWidth = parseInt(this.wIn.value, 10);
          targetCellHeight = parseInt(this.hIn.value, 10);
        } else {
          // Andere Konfigurationen: Deep Copy der gespeicherten Daten
          targetSelection = config.selection ? config.selection.map(row => [...row]) : [];
          targetCols = config.cols;
          targetRows = config.rows;
          targetOrientation = config.orientation;
          targetIncM = config.incM;
          targetMc4 = config.mc4;
          targetCable = config.solarkabel;
          targetWood = config.holz;
          targetCellWidth = config.cellWidth;
          targetCellHeight = config.cellHeight;
        }
        
        // Normalisiere Selection für die Zieldimensionen
        const normalizedSelection = Array.from({ length: targetRows || 5 }, (_, y) =>
          Array.from({ length: targetCols || 5 }, (_, x) => {
            if (targetSelection[y] && Array.isArray(targetSelection[y]) && x < targetSelection[y].length) {
              return targetSelection[y][x] === true;
            }
            return false;
          })
        );
        
        // Erstelle isolierte Config-Kopie
        const isolatedConfig = {
          name: config.name || `Konfiguration ${index + 1}`,
          index: index,
          cols: targetCols || 5,
          rows: targetRows || 5,
          selection: normalizedSelection,
          cellWidth: targetCellWidth || 179,
          cellHeight: targetCellHeight || 113,
          orientation: targetOrientation || 'horizontal',
          includeModules: targetIncM !== false,
          mc4: targetMc4 || false,
          cable: targetCable || false,
          wood: targetWood || false,
          // Zusätzliche Metadaten für Debugging
          selectedCells: normalizedSelection.flat().filter(v => v).length,
          totalCells: (targetCols || 5) * (targetRows || 5)
        };
        
        snapshot.configs.push(isolatedConfig);
      }
      
      return snapshot;
    }

    // DEPRECATED: Alte Methode für Backward Compatibility
    getAllConfigsData() {
      const snapshot = this.createConfigSnapshot();
      return snapshot.configs;
    }
    
    // ===== GRID PREVIEW METHODS =====
    
    showGridPreview(config) {
      console.log('showGridPreview called with:', config); // Debug
      
      // Speichere aktuellen Zustand für späteres Zurücksetzen
      this.originalPreviewState = {
        selection: this.selection ? this.selection.map(row => [...row]) : null,
        cols: this.cols,
        rows: this.rows,
        orientation: this.orV ? this.orV.checked : false
      };
      
      console.log('Saved original state:', this.originalPreviewState); // Debug
      
      // Erstelle Preview-Grid
      this.createPreviewGrid(config);
      
      // Verstecke Hauptgrid und zeige Preview-Grid
      this.hideMainGrid();
      this.showPreviewGrid();
    }
    
    createPreviewGrid(config) {
      console.log('Creating preview grid with config:', config); // Debug
      
      const previewGrid = document.getElementById('preview-grid');
      
      if (!previewGrid) {
        console.error('Preview grid element not found');
        return;
      }
      
      // Berechne Preview-Grid-Größe
      let previewCols = this.cols;
      let previewRows = this.rows;
      
      if (config.cols && config.rows) {
        previewCols = config.cols;
        previewRows = config.rows;
      }
      
      // Erstelle Preview-Selection
      let previewSelection;
      if (config.moduleCount) {
        console.log('Creating module selection for', config.moduleCount, 'modules');
        previewSelection = this.createModuleSelection(config.moduleCount, previewCols, previewRows);
      } else {
        console.log('Creating empty selection for preview');
        previewSelection = Array.from({ length: previewRows }, () =>
          Array.from({ length: previewCols }, () => false)
        );
      }
      
      // Baue Preview-Grid
      this.buildPreviewGrid(previewGrid, previewSelection, previewCols, previewRows);
    }
    
    buildPreviewGrid(previewGrid, selection, cols, rows) {
      console.log('Building preview grid:', cols, 'x', rows); // Debug
      
      // Verwende die gleiche Berechnungslogik wie das Hauptgrid
      const RAIL_GAP = 2;
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      
      // Original Zellengrößen aus Input - bei Orientierung entsprechend anwenden
      const inputW = parseInt(this.wIn ? this.wIn.value : '179', 10) || 179;
      const inputH = parseInt(this.hIn ? this.hIn.value : '113', 10) || 113;
      
      // Bei vertikaler Orientierung: Breite und Höhe der Zellen tauschen
      const isVertical = this.orV ? this.orV.checked : false;
      const originalCellW = isVertical ? inputH : inputW;
      const originalCellH = isVertical ? inputW : inputH;
      
      console.log('Orientation:', isVertical ? 'vertical' : 'horizontal'); // Debug
      console.log('Original cell size:', originalCellW, 'x', originalCellH); // Debug
      
      // Maximale verfügbare Größe (wie im Hauptgrid)
      const maxWidth = this.wrapper ? this.wrapper.clientWidth - 100 : 800;
      const maxHeight = this.wrapper ? this.wrapper.clientHeight - 100 : 600;
      
      // Berechne benötigte Gesamtgröße mit Original-Zellgrößen (inklusive Gaps für Schienen)
      const totalWidthWithRailGaps = cols * originalCellW + (cols - 1) * RAIL_GAP;
      const totalHeightWithRailGaps = rows * originalCellH + (rows - 1) * RAIL_GAP;
      
      // Berechne Skalierungsfaktoren für beide Dimensionen
      const scaleX = maxWidth / totalWidthWithRailGaps;
      const scaleY = maxHeight / totalHeightWithRailGaps;
      
      // Verwende den kleineren Skalierungsfaktor, um Proportionen zu erhalten
      const scale = Math.min(scaleX, scaleY, 1);
      
      // Berechne finale Zellgrößen
      const w = originalCellW * scale;
      const h = originalCellH * scale;
      
      console.log('Final cell size:', w, 'x', h); // Debug
      
      // Bestimme visuelle Gap: 0 wenn viele Spalten/Zeilen, sonst RAIL_GAP * scale
      const shouldHideGap = cols >= 15 || rows >= 10;
      const visualGap = shouldHideGap ? 0 : RAIL_GAP * scale;
      
      // Grid-Styling setzen
      previewGrid.style.gridTemplateColumns = `repeat(${cols}, ${w}px)`;
      previewGrid.style.gridTemplateRows = `repeat(${rows}, ${h}px)`;
      previewGrid.style.gap = `${visualGap}px`;
      
      // Grid leeren
      previewGrid.innerHTML = '';
      
      // Zellen erstellen
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cell = document.createElement('div');
          cell.className = 'preview-grid-cell';
          cell.dataset.row = row;
          cell.dataset.col = col;
          
          // Selection anwenden
          if (selection && selection[row] && selection[row][col]) {
            cell.classList.add('selected');
          }
          
          previewGrid.appendChild(cell);
        }
      }
    }
    
    hideMainGrid() {
      const mainGrid = document.getElementById('grid');
      if (mainGrid) {
        mainGrid.style.display = 'none';
      }
    }
    
    showPreviewGrid() {
      const previewGrid = document.getElementById('preview-grid');
      if (previewGrid) {
        previewGrid.style.display = 'grid';
      }
    }
    
    hidePreviewGrid() {
      const previewGrid = document.getElementById('preview-grid');
      if (previewGrid) {
        previewGrid.style.display = 'none';
      }
    }
    
    showMainGrid() {
      const mainGrid = document.getElementById('grid');
      if (mainGrid) {
        mainGrid.style.display = 'grid';
      }
    }
    
    createModuleSelection(moduleCount, cols, rows) {
      const selection = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => false)
      );
      
      // Automatische Modul-Auswahl (von links nach rechts, oben nach unten)
      let modulesPlaced = 0;
      for (let row = 0; row < rows && modulesPlaced < moduleCount; row++) {
        for (let col = 0; col < cols && modulesPlaced < moduleCount; col++) {
          selection[row][col] = true;
          modulesPlaced++;
        }
      }
      
      return selection;
    }
    
    clearGridPreview() {
      console.log('clearGridPreview called'); // Debug
      
      // Verstecke Preview-Grid und zeige Hauptgrid
      this.hidePreviewGrid();
      this.showMainGrid();
      
      // Verwende gespeicherten ursprünglichen Zustand
      if (this.originalPreviewState) {
        console.log('Restoring original state from saved state:', this.originalPreviewState); // Debug
        this.selection = this.originalPreviewState.selection;
        this.cols = this.originalPreviewState.cols;
        this.rows = this.originalPreviewState.rows;
        
        if (this.orV && this.orH && this.originalPreviewState.orientation !== null) {
          this.orV.checked = this.originalPreviewState.orientation;
          this.orH.checked = !this.originalPreviewState.orientation;
        }
        
        // Grid wiederherstellen
        this.updateSize();
        this.buildGrid();
        console.log('Original state restored'); // Debug
        
        // Gespeicherten Zustand löschen
        this.originalPreviewState = null;
      } else {
        console.log('No saved original state found'); // Debug
      }
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
