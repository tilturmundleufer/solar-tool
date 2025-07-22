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
  	Holzunterleger: 0.5
	};

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
    MC4_Stecker:       { productId:'xxx-mc4', variantId:'xxx-mc4-v' },
    Holzunterleger:    { productId:'xxx-holz', variantId:'xxx-holz-v' }
  };

  class SolarGrid {
    constructor() {
      this.gridEl        = document.getElementById('grid');
      this.wrapper       = document.querySelector('.grid-wrapper');
      this.overflower    = document.querySelector('.grid-overflow');
      this.colsIn        = document.getElementById('cols-input');
      this.rowsIn        = document.getElementById('rows-input');
      this.wIn           = document.getElementById('width-input');
      this.hIn           = document.getElementById('height-input');
      this.orH           = document.getElementById('orient-h');
      this.orV           = document.getElementById('orient-v');
      this.incM          = document.getElementById('include-modules');
      this.mc4           = document.getElementById('mc4');
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

      this.init();
    }

    init() {
  		this.attachInputListeners();
      
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
      		console.warn('Ungültige Konfigurationsdaten in URL:', e);
    		}
  		}

  		[this.wIn, this.hIn].forEach(el =>
    		el.addEventListener('change', () => {
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
    			this.updateSize();
    			this.buildList();
    			this.updateSummaryOnChange();

    			lastOrientation = currentOrientation;
  			})
			);

  		[this.incM, this.mc4, this.holz].forEach(el =>
    		el.addEventListener('change', () => {
      		this.buildList();
      		this.updateSummaryOnChange();
      		this.renderProductSummary(); // Aktualisiere auch die Summary aller Konfigurationen
    		})
  		);
      
      // Event-Listener für die Grid-Expansion-Buttons
			// Spalten-Buttons - rechts (fügt am Ende hinzu)
			document.querySelectorAll('.btn-add-col-right').forEach(btn => {
				btn.addEventListener('click', () => this.addColumnRight());
			});
			document.querySelectorAll('.btn-remove-col-right').forEach(btn => {
				btn.addEventListener('click', () => this.removeColumnRight());
			});
			
			// Spalten-Buttons - links (fügt am Anfang hinzu)
			document.querySelectorAll('.btn-add-col-left').forEach(btn => {
				btn.addEventListener('click', () => this.addColumnLeft());
			});
			document.querySelectorAll('.btn-remove-col-left').forEach(btn => {
				btn.addEventListener('click', () => this.removeColumnLeft());
			});
			
			// Zeilen-Buttons - unten (fügt am Ende hinzu)
			document.querySelectorAll('.btn-add-row-bottom').forEach(btn => {
				btn.addEventListener('click', () => this.addRowBottom());
			});
			document.querySelectorAll('.btn-remove-row-bottom').forEach(btn => {
				btn.addEventListener('click', () => this.removeRowBottom());
			});
			
			// Zeilen-Buttons - oben (fügt am Anfang hinzu)
			document.querySelectorAll('.btn-add-row-top').forEach(btn => {
				btn.addEventListener('click', () => this.addRowTop());
			});
			document.querySelectorAll('.btn-remove-row-top').forEach(btn => {
				btn.addEventListener('click', () => this.removeRowTop());
			});

  		this.saveBtn.addEventListener('click', () => this.saveNewConfig());
  		this.addBtn.addEventListener('click', () => this.addCurrentToCart());
  		this.summaryBtn.addEventListener('click', () => this.addAllToCart());
  		this.resetBtn.addEventListener('click', () => this.resetGridToDefault());
  		this.continueLaterBtn.addEventListener('click', () => this.generateContinueLink());

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
		}
    
    setup() {
  		// Nur aus Input lesen wenn nicht bereits durch loadConfig gesetzt
  		if (!this.cols || !this.rows) {
  			this.cols = parseInt(this.colsIn.value, 10);
  			this.rows = parseInt(this.rowsIn.value, 10);
  		}
  		if (!this.cols || !this.rows) {
    		alert('Spalten und Zeilen > 0 sein');
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
    
    attachInputListeners() {
  		this._colsRowsHandler = () => {
    		// Nutze aktuelle Input-Werte
    		this.cols = parseInt(this.colsIn.value, 10);
    		this.rows = parseInt(this.rowsIn.value, 10);
    		this.setup();
    		this.updateSummaryOnChange();
  		};
  		this.colsIn.addEventListener('input', this._colsRowsHandler);
  		this.rowsIn.addEventListener('input', this._colsRowsHandler);
		}
    
    // Spalten-Methoden - Rechts (am Ende)
    addColumnRight() {
  		this.cols += 1;
  		for (let row of this.selection) {
    		row.push(false);
  		}
  		this.colsIn.value = this.cols;
  		this.updateGridAfterStructureChange();
		}

		removeColumnRight() {
  		if (this.cols <= 1) return;
  		this.cols -= 1;
  		for (let row of this.selection) {
    		row.pop();
  		}
  		this.colsIn.value = this.cols;
  		this.updateGridAfterStructureChange();
		}

		// Spalten-Methoden - Links (am Anfang)
		addColumnLeft() {
  		this.cols += 1;
  		for (let row of this.selection) {
    		row.unshift(false);
  		}
  		this.colsIn.value = this.cols;
  		this.updateGridAfterStructureChange();
		}

		removeColumnLeft() {
  		if (this.cols <= 1) return;
  		this.cols -= 1;
  		for (let row of this.selection) {
    		row.shift();
  		}
  		this.colsIn.value = this.cols;
  		this.updateGridAfterStructureChange();
		}

		// Zeilen-Methoden - Unten (am Ende)
		addRowBottom() {
  		this.rows += 1;
  		this.selection.push(Array(this.cols).fill(false));
  		this.rowsIn.value = this.rows;
  		this.updateGridAfterStructureChange();
		}

		removeRowBottom() {
  		if (this.rows <= 1) return;
  		this.rows -= 1;
  		this.selection.pop();
  		this.rowsIn.value = this.rows;
  		this.updateGridAfterStructureChange();
		}

		// Zeilen-Methoden - Oben (am Anfang)
		addRowTop() {
  		this.rows += 1;
  		this.selection.unshift(Array(this.cols).fill(false));
  		this.rowsIn.value = this.rows;
  		this.updateGridAfterStructureChange();
		}

		removeRowTop() {
  		if (this.rows <= 1) return;
  		this.rows -= 1;
  		this.selection.shift();
  		this.rowsIn.value = this.rows;
  		this.updateGridAfterStructureChange();
		}

		updateGridAfterStructureChange() {
  		this.updateSize();
  		this.buildGrid();
  		this.buildList();
  		this.updateSummaryOnChange();
		}
    

    

    updateSize() {
  		const gap = 2;
  		const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);

  		// Original Zellengrößen aus Input - bei Orientierung entsprechend anwenden
  		const inputW = parseInt(this.wIn.value, 10) || 120;
  		const inputH = parseInt(this.hIn.value, 10) || 80;
  		
  		// Bei vertikaler Orientierung: Breite und Höhe der Zellen tauschen
  		const isVertical = this.orV.checked;
  		const originalCellW = isVertical ? inputH : inputW;
  		const originalCellH = isVertical ? inputW : inputH;
  		
  		// Maximale verfügbare Größe
  		const maxWidth = window.innerWidth - remPx * 4; // 100vw - 4rem
  		const maxHeight = window.innerHeight * 0.7; // 70vh
  		
  		// Berechne benötigte Gesamtgröße mit Original-Zellgrößen (inklusive Gaps)
  		const totalWidthWithGaps = this.cols * originalCellW + (this.cols - 1) * gap;
  		const totalHeightWithGaps = this.rows * originalCellH + (this.rows - 1) * gap;
  		
  		// Berechne Skalierungsfaktoren für beide Dimensionen
  		const scaleX = totalWidthWithGaps > maxWidth ? maxWidth / totalWidthWithGaps : 1;
  		const scaleY = totalHeightWithGaps > maxHeight ? maxHeight / totalHeightWithGaps : 1;
  		
  		// Verwende den kleineren Skalierungsfaktor, um Proportionen zu erhalten
  		// Das bedeutet: Wenn Höhe das Problem ist, wird nach Höhe skaliert (und umgekehrt)
  		const scale = Math.min(scaleX, scaleY);
  		
  		// Berechne finale Zellgrößen
  		const w = originalCellW * scale;
  		const h = originalCellH * scale;

  		// CSS Variablen setzen
  		document.documentElement.style.setProperty('--cell-width',  w + 'px');
  		document.documentElement.style.setProperty('--cell-height', h + 'px');

  		this.overflower.style.width  = `calc(${this.cols}*${w}px + ${(this.cols-1)*gap}px)`;
  		this.overflower.style.height = `calc(${this.rows}*${h}px + ${(this.rows-1)*gap}px)`;
      
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
    
    buildList() {
      const parts = this.calculateParts();
      if (!this.incM.checked) delete parts.Solarmodul;
      if (this.mc4.checked)   parts.MC4_Stecker   = this.selection.flat().filter(v => v).length;
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
  		this.colsIn.value = cols;
  		this.rowsIn.value = rows;
  		this.wIn.value = width;
  		this.hIn.value = height;
  		this.orH.checked = true;
  		this.orV.checked = false;

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
    


    calculateParts() {
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
        parseInt(this.hIn.value, 10) || 80 : 
        parseInt(this.wIn.value, 10) || 120;
      
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
        MC4_Stecker:       'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
        Holzunterleger:    'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png'
      };
      return imgs[key] || '';
    }
    
    loadConfig(idx) {
  		const cfg = this.configs[idx];
  		this.currentConfig = idx;

  		// Input-Werte setzen
  		this.colsIn.value = cfg.cols;
  		this.rowsIn.value = cfg.rows;
  		this.wIn.value    = cfg.cellWidth;
  		this.hIn.value    = cfg.cellHeight;
  		this.orV.checked  = cfg.orientation === 'vertical';
  		this.orH.checked  = !this.orV.checked;
  		this.incM.checked = cfg.incM;
  		this.mc4.checked  = cfg.mc4;
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
  		// Temporär currentConfig auf null setzen für neue Konfiguration
  		const originalCurrentConfig = this.currentConfig;
  		this.currentConfig = null;
  		
  		const cfg = this._makeConfigObject();
  		this.configs.push(cfg);
  		
  		// Neue Konfiguration direkt auswählen
  		this.currentConfig = this.configs.length - 1;
  		
  		this.renderConfigList();
  		this.updateSaveButtons();
  		this.showToast(`Konfiguration "${cfg.name}" gespeichert und ausgewählt ✅`);
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
        holz:        this.holz.checked,
        cols:        parseInt(this.colsIn.value, 10),
        rows:        parseInt(this.rowsIn.value, 10),
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

    		const deleteBtn = document.createElement('button');
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
    		div.appendChild(deleteBtn);
    		div.appendChild(shareBtn);
    		this.configListEl.appendChild(div);
  		});
		}

    updateSummaryOnChange() {
      this.renderProductSummary();
    }

    renderProductSummary() {
  		const incMChecked = this.incM.checked;
  		const mc4Checked = this.mc4.checked;
  		const holzChecked = this.holz.checked;

  		const bundles = this.configs.map((c, idx) => {
  			// Wenn dies die aktuell bearbeitete Konfiguration ist, verwende die aktuellen Checkbox-Werte
  			if (idx === this.currentConfig) {
  				return {
    				selection:   this.selection,
    				orientation: this.orV.checked ? 'vertical' : 'horizontal',
    				incM:        incMChecked,
    				mc4:         mc4Checked,
    				holz:        holzChecked
  				};
  			} else {
  				return {
    				selection:   c.selection,
    				orientation: c.orientation,
    				incM:        c.incM,
    				mc4:         c.mc4,
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
  		bundles.forEach(b => {
    		// Temporär setzen für Berechnung
    		this.orV.checked = b.orientation === 'vertical';
    		this.orH.checked = !this.orV.checked;
    		this.selection = b.selection;
    		this.updateSize();

    		let parts = this.calculateParts();
    		if (!b.incM) delete parts.Solarmodul;
    		if (b.mc4)   parts.MC4_Stecker = b.selection.flat().filter(v => v).length;
    		if (b.holz)  parts.Holzunterleger = (parts['Schiene_240_cm'] || 0) + (parts['Schiene_360_cm'] || 0);

    		Object.entries(parts).forEach(([k, v]) => {
      		total[k] = (total[k] || 0) + v;
    		});
  		});
  		
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
      		const price = PRICE_MAP[k] || 0;
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
      console.log('[SolarGrid] Webflow Formulare versteckt');
    }

    addProductToCart(productKey, quantity, isLastItem = false) {
      const product = PRODUCT_MAP[productKey];
      if (!product) return;
      
      const form = this.webflowFormMap[productKey];
      if (!form) return;
      
      const qtyInput = form.querySelector('input[name="commerce-add-to-cart-quantity-input"]');
      if (qtyInput) {
        console.log(`[SolarGrid] Setze Menge auf ${quantity} für ${productKey}`);
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

    addCurrentToCart() {
      const parts = this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.holz.checked);
      const itemCount = Object.values(parts).reduce((sum, qty) => sum + qty, 0);
      
      if (itemCount === 0) {
        this.showToast('Keine Produkte ausgewählt ⚠️', 2000);
        return;
      }
      
      this.addPartsListToCart(parts);
      this.showToast(`${itemCount} Produkte werden zum Warenkorb hinzugefügt...`, 3000);
    }

    addAllToCart() {
      // Auto-Save der aktuellen Konfiguration vor dem Hinzufügen
      if (this.currentConfig !== null) {
        this.updateConfig();
      }
      
      const allBundles = this.configs.map((cfg, idx) => {
        // Für die aktuell bearbeitete Konfiguration: Verwende aktuelle Werte
        if (idx === this.currentConfig) {
          return this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.holz.checked);
        } else {
          return this._buildPartsFor(cfg.selection, cfg.incM, cfg.mc4, cfg.holz);
        }
      });
      
      // Wenn keine Konfiguration ausgewählt ist (sollte nicht passieren), füge aktuelle Auswahl hinzu
      if (this.currentConfig === null && this.configs.length === 0) {
        allBundles.push(this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.holz.checked));
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
      
      this.addPartsListToCart(total);
      this.showToast(`${totalItemCount} Produkte aus allen Konfigurationen werden hinzugefügt...`, 3000);
    }

    _buildPartsFor(sel, incM, mc4, holz) {
      // Speichere aktuelle Auswahl
      const originalSelection = this.selection.map(r => [...r]);
      
      // Temporär setzen für Berechnung
      this.selection = sel;
      let parts = this.calculateParts();
      if (!incM) delete parts.Solarmodul;
      if (mc4)   parts.MC4_Stecker   = sel.flat().filter(v => v).length;
      if (holz)  parts.Holzunterleger = (parts['Schiene_240_cm']||0) + (parts['Schiene_360_cm']||0);
      
      // Ursprüngliche Auswahl wiederherstellen
      this.selection = originalSelection;
      
      return parts;
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
})();
