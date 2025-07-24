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
      this.updateBtn     = document.getElementById('update-config-btn');
      this.addBtn        = document.getElementById('add-to-cart-btn');
      this.summaryBtn    = document.getElementById('summary-add-cart-btn');
      this.configListEl  = document.getElementById('config-list');
      this.resetBtn 		 = document.getElementById('reset-btn');
      this.deleteBtn 		 = document.getElementById('delete-config-btn');

      this.selection     = [];
      this.configs       = [];
      this.currentConfig = null;
      this.default       = { cols:5, rows:5, width:176, height:113 };

      this.init();
    }

    init() {
    	this.loadFromLocalStorage();
  		this.attachInputListeners();
      
      const params = new URLSearchParams(window.location.search);
  		const rawData = params.get('configData');
  		if (rawData) {
    		try {
      		const json = decodeURIComponent(atob(rawData));
      		const cfg = JSON.parse(json);
      		this.configs.push(cfg);
      		this.loadConfig(this.configs.length - 1);
      		return; // ✅ direkt abbrechen – nichts anderes mehr laden
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

    			// Swap Inputs
    			const temp = this.wIn.value;
    			this.wIn.value = this.hIn.value;
    			this.hIn.value = temp;

    			// Update Grid
    			this.updateSize();
    			this.buildList();
    			this.updateSummaryOnChange();

    			// Synchronisiere mit CSS-Werten
    			const computedW = getComputedStyle(document.documentElement)
      			.getPropertyValue('--cell-width').trim().replace('px', '');
    			const computedH = getComputedStyle(document.documentElement)
      			.getPropertyValue('--cell-height').trim().replace('px', '');

    			this.wIn.value = Math.round(parseFloat(computedW));
    			this.hIn.value = Math.round(parseFloat(computedH));

    			lastOrientation = currentOrientation;
  			})
			);

  		[this.incM, this.mc4, this.holz].forEach(el =>
    		el.addEventListener('change', () => {
      		this.buildList();
      		this.updateSummaryOnChange();
    		})
  		);
      
      document.getElementById('add-col').addEventListener('click', () => this.addColumn());
			document.getElementById('remove-col').addEventListener('click', () => this.removeColumn());
			document.getElementById('add-row').addEventListener('click', () => this.addRow());
			document.getElementById('remove-row').addEventListener('click', () => this.removeRow());

  		this.saveBtn.addEventListener('click', () => this.saveNewConfig());
  		this.updateBtn.addEventListener('click', () => this.updateConfig());
  		this.deleteBtn.addEventListener('click', () => this.deleteCurrentConfig());
  		this.addBtn.addEventListener('click', () => this.addCurrentToCart());
  		this.summaryBtn.addEventListener('click', () => this.addAllToCart());
  		this.resetBtn.addEventListener('click', () => this.resetGridToDefault());
      document.getElementById('delete-all-configs-btn').addEventListener('click', () => this.deleteAllConfigs());

  		window.addEventListener('resize', () => {
    		this.updateSize();
    		this.buildGrid();
    		this.buildList();
    		this.updateSummaryOnChange();
  		});
      
      // 👉 Erst initiales Grid vorbereiten
  		this.cols = this.default.cols;
  		this.rows = this.default.rows;
  		this.setup();

  		this.loadFromLocalStorage();

			if (!this.configs.length) {
  			// 🔧 Keine gespeicherten Konfigurationen → Erstelle Default
  			this.cols = this.default.cols;
  			this.rows = this.default.rows;
  			this.setup();

  			const defaultConfig = this._makeConfigObject();
  			this.configs.push(defaultConfig);
  			this.loadConfig(0);
			} else {
  			// 🔁 Bereits gespeicherte Konfigurationen → lade passende aus URL oder letzte aktive
  			const params = new URLSearchParams(window.location.search);
  			const configIdx = parseInt(params.get('config'), 10);
  			if (!isNaN(configIdx) && this.configs[configIdx]) {
    		this.loadConfig(configIdx);
  			} else {
    			const fallback = this.currentConfig ?? 0;
    			this.loadConfig(fallback);
  			}
			}
		}
    
    setup() {
    	if (
    		!Array.isArray(this.selection) ||
    		this.selection.length !== this.rows ||
    		this.selection[0]?.length !== this.cols
  		) {
    		this.selection = Array.from({ length: this.rows }, () =>
      		Array.from({ length: this.cols }, () => false)
    		);
  		}
      
  		this.cols = parseInt(this.colsIn.value, 10);
  		this.rows = parseInt(this.rowsIn.value, 10);
  		if (!this.cols || !this.rows) {
    		alert('Spalten und Zeilen > 0 sein');
    		return;
  		}

  		const oldSel = this.selection;
  		this.selection = Array.from({ length: this.rows }, (_, y) =>
    		Array.from({ length: this.cols }, (_, x) => oldSel?.[y]?.[x] || false)
  		);

  		this.wrapper.style.display = 'block';
  		this.listHolder.style.display = 'block';
  		this.updateSize();
  		this.buildGrid();
  		this.buildList();
  		this.renderProductSummary();
  		this.updateSaveButtons();
		}

    updateSaveButtons() {
  		if (this.currentConfig === null) {
    		this.saveBtn.style.display = 'inline-block';
    		this.updateBtn.style.display = 'none';
    		this.deleteBtn.classList.add('hidden');
  		} else {
    		this.saveBtn.style.display = 'none';
    		this.updateBtn.style.display = 'inline-block';
    		this.deleteBtn.classList.remove('hidden');
  		}
      const deleteAllBtn = document.getElementById('delete-all-configs-btn');
			if (deleteAllBtn) {
  			deleteAllBtn.style.display = this.configs.length > 0 ? 'inline-block' : 'none';
			}
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
    
    addColumn() {
  		this.cols += 1;
  		for (let row of this.selection) {
    		row.push(false);
  		}
  		this.colsIn.value = this.cols;
  		this.updateGridAfterStructureChange();
		}

		removeColumn() {
  		if (this.cols <= 1) return;
  		this.cols -= 1;
  		for (let row of this.selection) {
    		row.pop();
  		}
  		this.colsIn.value = this.cols;
  		this.updateGridAfterStructureChange();
		}

		addRow() {
  		this.rows += 1;
  		this.selection.push(Array(this.cols).fill(false));
  		this.rowsIn.value = this.rows;
  		this.updateGridAfterStructureChange();
		}

		removeRow() {
  		if (this.rows <= 1) return;
  		this.rows -= 1;
  		this.selection.pop();
  		this.rowsIn.value = this.rows;
  		this.updateGridAfterStructureChange();
		}

		updateGridAfterStructureChange() {
  		this.updateSize();
  		this.buildGrid();
  		this.buildList();
  		this.updateSummaryOnChange();
		}
    
    saveToLocalStorage() {
  		const data = {
    		configs: this.configs,
    		currentConfig: this.currentConfig
  		};
  		localStorage.setItem('solarConfigs', JSON.stringify(data));
		}
    
    loadFromLocalStorage() {
  		const raw = localStorage.getItem('solarConfigs');
  		if (!raw) return;
  		try {
    		const data = JSON.parse(raw);
    		if (Array.isArray(data.configs)) {
      		this.configs = data.configs;
      		this.currentConfig = data.currentConfig ?? null;
    		}
  		} catch (e) {
    		console.error('Fehler beim Laden der gespeicherten Konfiguration:', e);
  		}
		}
    

    updateSize() {
  		const gap = 2;
  		const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  		const maxWidth = window.innerWidth - remPx * 4;

  		const baseW = parseInt(this.wIn.value, 10);
  		const baseH = parseInt(this.hIn.value, 10);
  		const ratio = baseH / baseW;

  		const defaultTotal = this.cols * baseW + (this.cols - 1) * gap;

  		let w, h;
  		if (
    		window.innerWidth >= 1100 &&
    		this.cols <= 10 &&
    		defaultTotal > maxWidth
  		) {
    		w = (maxWidth - (this.cols - 1) * gap) / this.cols;
    		h = w * ratio;
  		} else {
    		w = baseW;
    		h = baseH;
  		}

  		// CSS Variablen setzen
  		document.documentElement.style.setProperty('--cell-width',  w + 'px');
  		document.documentElement.style.setProperty('--cell-height', h + 'px');

  		this.overflower.style.width  = `calc(${this.cols}*${w}px + ${(this.cols-1)*gap}px)`;
  		this.overflower.style.height = `calc(${this.rows}*${h}px + ${(this.rows-1)*gap}px)`;
      
      // Detect overflow vs. maximal erlaubte Größe
			const wrapperRect = this.wrapper.getBoundingClientRect();
			const maxWidthBut = window.innerWidth - 32; // 2rem ≈ 32px

			const vertGroup = document.querySelector('.button-group-vertical');

			// Prüfe ob die wrapper-Größe die max erlaubte Breite erreicht hat
			const overflowX = wrapperRect.width >= maxWidthBut - 1; // kleiner Spielraum

			// Setze overlay-mode Klassen
			if (overflowX) {
  			vertGroup.classList.add('overlay-mode');
			} else {
  			vertGroup.classList.remove('overlay-mode');
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
    
    deleteAllConfigs() {
  		if (!confirm('Möchtest du wirklich alle Konfigurationen löschen?')) return;

  		this.configs = [];
  		localStorage.removeItem('solarConfigs');
  		this.currentConfig = null;

  		this.resetToDefaultGrid();
  		this.renderConfigList();
  		this.updateSaveButtons();
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
      const totalLen = len * parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--cell-width')
      );
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

  		// STATE Werte setzen
  		this.cols = cfg.cols;
  		this.rows = cfg.rows;
  		this.selection = cfg.selection.map(r => [...r]);

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
  		const cfg = this._makeConfigObject();
  		this.configs.push(cfg);
  		this.renderConfigList();
  		this.updateSaveButtons();

  		this.currentConfig = null;
  		this.resetGridToDefault();

  		this.showToast('Konfiguration gespeichert ✅'); // 🎉
      this.saveToLocalStorage();
		}

    updateConfig() {
      const idx = this.currentConfig;
      this.configs[idx] = this._makeConfigObject();
      this.currentConfig = null;
      this.resetToDefaultGrid();
      this.renderConfigList();
      this.updateSaveButtons();
      this.saveToLocalStorage();
    }
    
    deleteCurrentConfig() {
  		if (this.currentConfig === null) return;
  		if (!confirm('Willst du die Konfiguration wirklich löschen?')) return;

  		this.configs.splice(this.currentConfig, 1);
  		this.saveToLocalStorage();

  		this.currentConfig = null;
  		this.resetGridToDefault();

  		this.renderConfigList();
  		this.updateSaveButtons();
		}

    _makeConfigObject() {
      return {
        name:        this.currentConfig !== null
                       ? this.configs[this.currentConfig].name
                       : `Konfiguration ${this.configs.length+1}`,
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
  				if (this.currentConfig !== null) {
    				const saveIndex = this.currentConfig; // 👈 merke Index VOR reset
    				this.currentConfig = saveIndex;       // 👈 explizit setzen
    				this.updateConfig();
  				}
  				this.loadConfig(idx); // 🔁 gewünschte Konfiguration laden
  				this.updateSaveButtons();
  				this.showToast('Automatisch gespeichert ✅', 1500);
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

    		const shareBtn = document.createElement('button');
    		shareBtn.textContent = '🔗';
    		shareBtn.title = 'Konfiguration teilen';
    		Object.assign(shareBtn.style, {
      		background: 'none',
      		border: 'none',
      		cursor: 'pointer',
      		color: 'inherit'
    		});
    		shareBtn.addEventListener('click', (e) => {
      		e.stopPropagation();
      		const cfgData = JSON.stringify(this.configs[idx]);
					const base64 = btoa(encodeURIComponent(cfgData));
					const shareUrl = `${window.location.origin}${window.location.pathname}?configData=${base64}`;
      		navigator.clipboard.writeText(shareUrl);
      		this.showToast('Link kopiert ✅', 1500);
    		});

    		nameContainer.appendChild(nameEl);
    		nameContainer.appendChild(editBtn);
    		div.appendChild(nameContainer);
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

  		const bundles = this.configs.map(c => ({
    		selection:   c.selection,
    		orientation: c.orientation,
    		incM:        c.incM,
    		mc4:         c.mc4,
    		holz:        c.holz
  		}));

  		if (this.currentConfig === null) {
  			bundles.push({
    			selection:   this.selection,
    			orientation: this.orV.checked ? 'vertical' : 'horizontal',
    			incM:        incMChecked,
    			mc4:         mc4Checked,
    			holz:        holzChecked
  			});
			}

  		const total = {};
  		bundles.forEach(b => {
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
    
    generateHiddenCartForms() {
      // Remove old forms first
      const existingForms = document.getElementById('hidden-cart-forms');
      if (existingForms) {
        existingForms.remove();
      }
      
      // Create container for forms - visible but positioned off-screen to avoid accessibility issues
      const hiddenCartForms = document.createElement('div');
      hiddenCartForms.id = 'hidden-cart-forms';
      hiddenCartForms.style.cssText = `
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
        margin: 0;
        padding: 0;
      `;
      
      Object.entries(PRODUCT_MAP).forEach(([key, val]) => {
        // Create a simple form that mimics Webflow's structure
        const form = document.createElement('form');
        form.setAttribute('data-product-key', key);
        form.setAttribute('data-product-id', val.productId);
        form.setAttribute('aria-hidden', 'true');
        form.setAttribute('tabindex', '-1');
        // Remove action to prevent redirect
        form.setAttribute('method', 'POST');
        form.innerHTML = `
          <input type="hidden" name="product-id" value="${val.productId}" />
          <input type="hidden" name="variant-id" value="${val.variantId}" />
          <input type="number" name="quantity" value="1" min="1" tabindex="-1" aria-hidden="true" />
          <button type="submit" class="w-commerce-commerceaddtocartbutton" tabindex="-1" aria-hidden="true"></button>
        `;
        
        // Prevent form from redirecting by default
        form.addEventListener('submit', (e) => {
          e.preventDefault();
        });
        
        hiddenCartForms.appendChild(form);
      });
      
      document.body.appendChild(hiddenCartForms);
      
      // Add event listeners to the buttons
      this.attachCartButtonListeners();
    }

    attachCartButtonListeners() {
      const buttons = document.querySelectorAll('#hidden-cart-forms .add-to-cart-btn');
      buttons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const productKey = button.getAttribute('data-product-key');
          const form = button.closest('form');
          const quantity = parseInt(form.querySelector('input[name="quantity"]').value) || 1;
          
          this.performActualCartAdd(productKey, quantity);
        });
      });
    }

    addProductToCart(productKey, quantity) {
      const product = PRODUCT_MAP[productKey];
      if (!product) {
        console.warn(`[SolarGrid] Kein Produkt für Schlüssel '${productKey}' im PRODUCT_MAP gefunden.`);
        return;
      }
      
      // Try multiple methods to add to Webflow cart without redirect
      if (this.tryWebflowCartAPI(product, quantity, productKey)) {
        return;
      }
      
      if (this.tryWebflowFormSubmit(product, quantity, productKey)) {
        return;
      }
      
      // Final fallback
      this.fallbackAddToCart(product, quantity, productKey);
    }

    tryWebflowCartAPI(product, quantity, productKey) {
      // Method 1: Try Webflow's commerce API
      if (window.Webflow && window.Webflow.commerce && window.Webflow.commerce.addToCart) {
        try {
          window.Webflow.commerce.addToCart({
            productId: product.productId,
            variantId: product.variantId,
            quantity: quantity
          });
          console.log(`[SolarGrid] ${quantity}x ${productKey} wurde zum Warenkorb hinzugefügt (API).`);
          return true;
        } catch (error) {
          console.warn(`[SolarGrid] Webflow API fehlgeschlagen für ${productKey}:`, error);
        }
      }
      return false;
    }

    tryWebflowFormSubmit(product, quantity, productKey) {
      // Method 2: Try to simulate Webflow's add-to-cart behavior without redirect
      const form = document.querySelector(`form[data-product-id="${product.productId}"]`);
      if (!form) {
        return false;
      }
      
      const qtyInput = form.querySelector('input[name="quantity"]');
      const submitBtn = form.querySelector('button[type="submit"]');
      
      if (!qtyInput || !submitBtn) {
        return false;
      }
      
      try {
        qtyInput.value = quantity;
        
        // Try to use Webflow's internal cart methods
        if (window.Webflow && window.Webflow.commerce) {
          // Look for Webflow's cart instance
          const commerceInstance = window.Webflow.commerce;
          
          // Try different possible method names
          const addMethods = ['addProductToCart', 'addToCart', 'updateCart', 'addItem'];
          
          for (const methodName of addMethods) {
            if (typeof commerceInstance[methodName] === 'function') {
              try {
                commerceInstance[methodName]({
                  productId: product.productId,
                  variantId: product.variantId,
                  quantity: quantity
                });
                console.log(`[SolarGrid] ${quantity}x ${productKey} wurde zum Warenkorb hinzugefügt (${methodName}).`);
                setTimeout(() => { qtyInput.value = 1; }, 100);
                return true;
              } catch (methodError) {
                console.warn(`[SolarGrid] Methode ${methodName} fehlgeschlagen:`, methodError);
                continue;
              }
            }
          }
        }
        
        // Alternative: Try to trigger form submission with AJAX to prevent redirect
        const formData = new FormData(form);
        
        // Prevent default form behavior
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, { once: true });
        
        // Try AJAX submission to Webflow's cart endpoint
        fetch('/cart/add', {
          method: 'POST',
          body: formData,
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        })
        .then(response => {
          if (response.ok) {
            console.log(`[SolarGrid] ${quantity}x ${productKey} wurde zum Warenkorb hinzugefügt (AJAX).`);
            // Update cart UI if possible
            this.updateCartUI();
          } else {
            throw new Error('Cart update failed');
          }
        })
        .catch(error => {
          console.warn(`[SolarGrid] AJAX cart update fehlgeschlagen für ${productKey}:`, error);
        });
        
        setTimeout(() => { qtyInput.value = 1; }, 100);
        return true;
        
      } catch (error) {
        console.warn(`[SolarGrid] Form-Submit fehlgeschlagen für ${productKey}:`, error);
        return false;
      }
    }

    updateCartUI() {
      // Try to refresh cart count and other UI elements
      if (window.Webflow && window.Webflow.commerce && window.Webflow.commerce.refreshCart) {
        window.Webflow.commerce.refreshCart();
      }
      
      // Dispatch custom event for cart update
      const cartUpdateEvent = new CustomEvent('cartUpdated', {
        bubbles: true,
        detail: { source: 'solarGrid' }
      });
      document.dispatchEvent(cartUpdateEvent);
    }

    fallbackAddToCart(product, quantity, productKey) {
      // Method 3: Manual cart management (fallback)
      console.log(`[SolarGrid] Fallback: ${quantity}x ${productKey} wird verarbeitet.`);
      
      // Try to update cart count in UI if possible
      const cartCountElements = document.querySelectorAll('[data-wf-cart-quantity]');
      cartCountElements.forEach(el => {
        const currentCount = parseInt(el.textContent) || 0;
        el.textContent = currentCount + quantity;
      });
      
      // Store in localStorage as backup
      const cartKey = 'webflow-cart-backup';
      let cartBackup = JSON.parse(localStorage.getItem(cartKey) || '{}');
      cartBackup[product.productId] = (cartBackup[product.productId] || 0) + quantity;
      localStorage.setItem(cartKey, JSON.stringify(cartBackup));
      
      console.log(`[SolarGrid] ${quantity}x ${productKey} wurde zum lokalen Warenkorb hinzugefügt.`);
    }

    addPartsListToCart(parts) {
      const entries = Object.entries(parts).filter(([_, qty]) => qty > 0);
      if (!entries.length) {
        console.info('[SolarGrid] Keine Produkte zum Hinzufügen gefunden.');
        return;
      }
      
      console.log('[SolarGrid] Füge folgende Teile zum Warenkorb hinzu:', parts);
      
      entries.forEach(([key, qty], i) => {
        // Calculate packs needed based on VE (Verpackungseinheit)
        const packsNeeded = Math.ceil(qty / VE[key]);
        console.log(`[SolarGrid] ${key}: ${qty} Stück benötigt, ${packsNeeded} Packungen à ${VE[key]} Stück`);
        
        setTimeout(() => this.addProductToCart(key, packsNeeded), i * 800); // 800ms Delay for better reliability
      });
    }

    addCurrentToCart() {
      const parts = this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.holz.checked);
      const itemCount = Object.values(parts).reduce((sum, qty) => sum + qty, 0);
      
      if (itemCount === 0) {
        this.showToast('Keine Produkte ausgewählt ⚠️', 2000);
        return;
      }
      
      this.addPartsListToCart(parts);
      this.showToast('Produkte zum Warenkorb hinzugefügt ✅', 2000);
    }

    addAllToCart() {
      const allBundles = this.configs.map(cfg =>
        this._buildPartsFor(cfg.selection, cfg.incM, cfg.mc4, cfg.holz)
      );
      if (this.currentConfig === null) {
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
      this.showToast('Alle Konfigurationen zum Warenkorb hinzugefügt ✅', 2000);
    }

    _buildPartsFor(sel, incM, mc4, holz) {
      this.selection = sel;
      let parts = this.calculateParts();
      if (!incM) delete parts.Solarmodul;
      if (mc4)   parts.MC4_Stecker   = sel.flat().filter(v => v).length;
      if (holz)  parts.Holzunterleger = (parts['Schiene_240_cm']||0) + (parts['Schiene_360_cm']||0);
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
    
    // Debug function to check cart forms
    window.debugCartForms = () => {
      const forms = document.querySelectorAll('#hidden-cart-forms form');
      console.log(`[Debug] Gefundene Cart-Formulare: ${forms.length}`);
      forms.forEach((form, i) => {
        const productKey = form.getAttribute('data-product-key');
        const productId = form.getAttribute('data-product-id');
        const qtyInput = form.querySelector('input[name="quantity"]');
        const button = form.querySelector('.add-to-cart-btn');
        console.log(`[Debug] Form ${i+1}: ProductKey=${productKey}, ProductID=${productId}, Quantity Input=${!!qtyInput}, Button=${!!button}`);
      });
      return forms;
    };
    
    // Debug function to test single product addition
    window.testAddToCart = (productKey = 'Solarmodul', quantity = 1) => {
      console.log(`[Debug] Teste Hinzufügung: ${quantity}x ${productKey}`);
      grid.addProductToCart(productKey, quantity);
    };
    
    console.log('[SolarGrid] Initialisierung abgeschlossen. Debug-Funktionen verfügbar:');
    console.log('- window.debugCartForms() - Zeigt alle Cart-Formulare');
    console.log('- window.testAddToCart(productKey, quantity) - Testet Hinzufügung eines Produkts');
  });
})();