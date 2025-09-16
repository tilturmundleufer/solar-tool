(function() {
  const ADD_TO_CART_DELAY = 400;
  // Global debug toggle: disable noisy logs in production
  const DEBUG_MODE = false;
  if (!DEBUG_MODE) {
    // In Produktion: laute Debug-Logs stummschalten, Warnungen/Fehler beibehalten
    try {
      const noop = function(){};
      if (typeof console !== 'undefined') {
        console.log = noop;
        console.info = noop;
        console.debug = noop;
      }
    } catch (e) {
      // Ignorieren – falls Konsole nicht überschreibbar ist
    }
  }
  
  // Cache-Manager für 24h Persistierung
  class CacheManager {
    constructor() {
      this.cacheKey = 'solarTool_continueCache';
      this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 Stunden
      this.debounceTimeout = null;
      this.debounceDelay = 500; // 500ms Delay für Performance
    }
    
    // Prüfe ob localStorage verfügbar ist
    isLocalStorageAvailable() {
      try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch (e) {
        console.warn('localStorage nicht verfügbar:', e);
        return false;
      }
    }
    
    // Speichere Daten mit Debouncing
    saveData(data) {
      if (!this.isLocalStorageAvailable()) {
        console.warn('localStorage nicht verfügbar - Cache wird nicht gespeichert');
        return;
      }
      
      // Debounce für Performance
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
      
      this.debounceTimeout = setTimeout(() => {
        try {
          const cacheData = {
            ...data,
            timestamp: Date.now(),
            version: '1.0' // Für zukünftige Kompatibilität
          };
          
          localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
          console.log('Cache gespeichert:', new Date().toLocaleString());
        } catch (error) {
          console.error('Fehler beim Speichern des Caches:', error);
        }
      }, this.debounceDelay);
    }
    
    // Lade Daten aus dem Cache
    loadData() {
      if (!this.isLocalStorageAvailable()) {
        console.warn('localStorage nicht verfügbar - Cache wird nicht geladen');
        return null;
      }
      
      try {
        const cachedData = localStorage.getItem(this.cacheKey);
        if (!cachedData) {
          console.log('Kein Cache gefunden');
          return null;
        }
        
        const data = JSON.parse(cachedData);
        const cacheAge = Date.now() - data.timestamp;
        
        // Prüfe Cache-Alter
        if (cacheAge > this.cacheTimeout) {
          console.log('Cache ist abgelaufen (24h) - wird gelöscht');
          this.clearCache();
          return null;
        }
        
        console.log('Cache geladen:', new Date().toLocaleString());
        return data;
      } catch (error) {
        console.error('Fehler beim Laden des Caches:', error);
        this.clearCache();
        return null;
      }
    }
    
    // Lösche Cache
    clearCache() {
      try {
        localStorage.removeItem(this.cacheKey);
        console.log('Cache gelöscht');
      } catch (error) {
        console.error('Fehler beim Löschen des Caches:', error);
      }
    }
    
    // Prüfe Cache-Alter
    isCacheValid() {
      const data = this.loadData();
      return data !== null;
    }
  }
  
  // Zentrale Produkt-Konfiguration (direkt eingebettet)
  const VE = {
    Endklemmen: 50,
    Schrauben: 100,
    Dachhaken: 20,
    Mittelklemmen: 50,
    Endkappen: 50,
    Schienenverbinder: 50,
    Schiene_240_cm: 1,
    Schiene_360_cm: 1,
    Solarmodul: 1,
    UlicaSolarBlackJadeFlow: 1,
    // Neue 36er-Paletten (VE = 36 Stück pro Palette)
    SolarmodulPalette: 36,
    UlicaSolarBlackJadeFlowPalette: 36,
    MC4_Stecker: 50,
    Solarkabel: 1,
    Holzunterleger: 50,
    // NEUE PRODUKTE (aus Berechnung raus, später hinzufügen)
    Erdungsklemme: 1,
    Quetschkabelschuhe: 1,
    Erdungsband: 1,
    Tellerkopfschraube: 100,
    // Neue Zusatzprodukte (Optimierer)
    HuaweiOpti: 1,
    BRCOpti: 1
  };
  
  const PRICE_MAP = {
    // VK pro VE (Fallbackpreise)
    Solarmodul: 59.70,
    UlicaSolarBlackJadeFlow: 67.90,
    // Paletten-Fallbackpreise (Netto) – falls Collection Price nicht gefunden wird
    SolarmodulPalette: 2394.76, // 450 W Palette
    UlicaSolarBlackJadeFlowPalette: 2694.64, // 500 W Palette
    Endklemmen: 49.50,
    Schrauben: 22.00,
    Dachhaken: 69.00,
    Mittelklemmen: 49.50,
    Endkappen: 7.00,
    Schienenverbinder: 65.00,
    Schiene_240_cm: 11.99,
    Schiene_360_cm: 17.49,
    MC4_Stecker: 39.50,
    Solarkabel: 86.90,
    Holzunterleger: 17.50,
    // NEUE PRODUKTE (aus Berechnung raus, später hinzufügen)
    Erdungsklemme: 25.00,
    Quetschkabelschuhe: 18.50,
    Erdungsband: 8.70,
    Tellerkopfschraube: 26.00,
    // Optimierer (Netto VK pro VE)
    HuaweiOpti: 34.50,
    BRCOpti: 33.50
  };

  // Staffelpreis-Konfiguration: thresholds immer in Stück (benötigte Menge),
  // pricePerPiece = Stückpreis auf dieser Stufe; alternativ packPrice für VE=1/packbasierte Stufen
  const TIER_PRICING = {
    Schiene_240_cm: [
      { minPieces: 40, pricePerPiece: 11.59 },
      { minPieces: 80, pricePerPiece: 11.25 }
    ],
    Schiene_360_cm: [
      { minPieces: 40, pricePerPiece: 16.99 },
      { minPieces: 80, pricePerPiece: 16.49 }
    ],
    Mittelklemmen: [
      { minPieces: 300, pricePerPiece: 0.95 },
      { minPieces: 1200, pricePerPiece: 0.79 }
    ],
    Endklemmen: [
      { minPieces: 300, pricePerPiece: 0.95 },
      { minPieces: 1200, pricePerPiece: 0.79 }
    ],
    Endkappen: [
      { minPieces: 300, pricePerPiece: 0.13 },
      { minPieces: 1200, pricePerPiece: 0.12 }
    ],
    Dachhaken: [
      { minPieces: 100, pricePerPiece: 3.42 },
      { minPieces: 720, pricePerPiece: 3.39 }
    ],
    Schienenverbinder: [
      { minPieces: 200, pricePerPiece: 1.19 },
      { minPieces: 1000, pricePerPiece: 0.99 }
    ],
    Schrauben: [
      { minPieces: 1000, pricePerPiece: 0.19 },
      { minPieces: 5000, pricePerPiece: 0.18 }
    ],
    Tellerkopfschraube: [
      { minPieces: 1000, pricePerPiece: 0.25 },
      { minPieces: 5000, pricePerPiece: 0.24 }
    ],
    Solarmodul: [
      { minPieces: 36, pricePerPiece: 55.90 },
      { minPieces: 360, pricePerPiece: 54.90 }
    ],
    UlicaSolarBlackJadeFlow: [
      { minPieces: 36, pricePerPiece: 62.90 },
      { minPieces: 360, pricePerPiece: 61.90 }
    ],
    // Für Paletten keine Staffel – Shoppreis pro Palette wird gelesen
    MC4_Stecker: [
      { minPieces: 1000, pricePerPiece: 0.69 },
      { minPieces: 3000, pricePerPiece: 0.65 }
    ],
    Solarkabel: [
      { minPieces: 10, pricePerPiece: 83.90 },
      { minPieces: 30, pricePerPiece: 79.90 }
    ],
    Quetschkabelschuhe: [
      // Staffelpreise hier als Packpreise (VE=1) definiert
      { minPieces: 5, packPrice: 17.90 },
      { minPieces: 20, packPrice: 17.50 }
    ],
    Holzunterleger: [
      { minPieces: 500, pricePerPiece: 0.29 },
      { minPieces: 2000, pricePerPiece: 0.28 }
    ]
  };

  // ===== Kundentyp & MwSt (48h Speicherung) =====
  function getStoredCustomerType() {
    try {
      const raw = localStorage.getItem('solarTool_customerType');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.type) return null;
      if (typeof parsed.expiresAt === 'number' && Date.now() > parsed.expiresAt) {
        localStorage.removeItem('solarTool_customerType');
        return null;
      }
      return parsed.type === 'private' ? 'private' : 'business';
    } catch (e) {
      return null;
    }
  }

  function isPrivateCustomer() {
    return getStoredCustomerType() === 'private';
  }

  function applyVatIfBusiness(amount) {
    if (!Number.isFinite(amount)) return amount;
    // Neue Anforderung: Immer Netto anzeigen/berechnen; kein 1,19-Aufschlag mehr
    return amount;
  }

  // Kundentyp-UI (Listen/Buttons) wird zentral in customer-type-popup.js verwaltet

  // Brutto-Produkt-Mapping (Platzhalter) für Zusatzprodukte bei Firmenkunden
  const PRODUCT_MAP_BRUTTO = {
    // Module
    Solarmodul: { productId: '68c7ec7571df9723b8ef5050', variantId: '68c7ec7e71df9723b8ef53cd' }, // Ulica 450 W inkl. MwSt (Einzelprodukt)
    UlicaSolarBlackJadeFlow: { productId: '68c7ef7fbeeaadb13262a062', variantId: '68c7ef7ff397fcf9d6d7571e' }, // Ulica 500 W inkl. MwSt (Einzelprodukt)
    // Neue Paletten (inkl. MwSt) – IDs aus Screenshot/Shop (Handles: ganze Palette inkl MwSt)
    // 450 W Palette inkl. MwSt
    SolarmodulPalette: { productId: '68c7ec7471df9723b8ef5008', variantId: '68c7ec7c71df9723b8ef5160' },
    // 500 W Palette inkl. MwSt
    UlicaSolarBlackJadeFlowPalette: { productId: '68c7ec7471df9723b8ef5006', variantId: '68c7ec7d71df9723b8ef5187' },

    // Zubehör/Komponenten
    Quetschkabelschuhe: { productId: '68c7ec7471df9723b8ef502d', variantId: '68c7ec7c71df9723b8ef514b' },
    Solarkabel: { productId: '68c7ec7471df9723b8ef5031', variantId: '68c7ec7d71df9723b8ef5205' },
    Erdungsband: { productId: '68c7ec7471df9723b8ef5033', variantId: '68c7ec7c71df9723b8ef5159' },
    Endkappen: { productId: '68c7ec7471df9723b8ef5041', variantId: '68c7ec7e71df9723b8ef533e' },
    Mittelklemmen: { productId: '68c7ec7471df9723b8ef5043', variantId: '68c7ec7e71df9723b8ef53e0' },
    Dachhaken: { productId: '68c7ec7471df9723b8ef5045', variantId: '68c7ec7f71df9723b8ef54f9' },
    Schiene_360_cm: { productId: '68c7ec7471df9723b8ef5047', variantId: '68c7ec7e71df9723b8ef53d6' },
    Schienenverbinder: { productId: '68c7ec7471df9723b8ef5049', variantId: '68c7ec7e71df9723b8ef533b' },
    Schiene_240_cm: { productId: '68c7ec7471df9723b8ef504b', variantId: '68c7ec7e71df9723b8ef5387' },
    MC4_Stecker: { productId: '68c7ec7671df9723b8ef506e', variantId: '68c7ec7d71df9723b8ef5230' },
    Tellerkopfschraube: { productId: '68c7ec7671df9723b8ef5072', variantId: '68c7ec7f71df9723b8ef544a' },
    Schrauben: { productId: '68c7ec7771df9723b8ef5085', variantId: '68c7ec7f71df9723b8ef5406' },
    Endklemmen: { productId: '68c7ec7771df9723b8ef5087', variantId: '68c7ec7f71df9723b8ef542a' },
    Holzunterleger: { productId: '68c7f04a8fd58d9f974d6eb6', variantId: '68c7f04bb950895d194203e00' },
    // Optimierer (Brutto)
    HuaweiOpti: { productId: '68c7ec7471df9723b8ef501e', variantId: '68c7ec7e71df9723b8ef5335' },
    BRCOpti: { productId: '68c7ec7471df9723b8ef501a', variantId: '68c7ec7b71df9723b8ef510b' }
  };

  function getCartProductInfo(productKey) {
    // Firmenkunden: Brutto-Produkt bevorzugen, Privatkunden: Standard-Produkt
    if (!isPrivateCustomer() && Object.prototype.hasOwnProperty.call(PRODUCT_MAP_BRUTTO, productKey)) {
      return PRODUCT_MAP_BRUTTO[productKey];
    }
    return PRODUCT_MAP[productKey];
  }


  // Liefert den wirksamen VE-Preis (Packpreis) basierend auf benötigter Stückzahl und Staffelung
  function getPackPriceForQuantity(productKey, requiredPieces) {
    const ve = VE[productKey] || 1;
    const basePackPrice = getPriceFromCache(productKey) || 0;
    // Paletten: Preis immer aus Shop nehmen (basePackPrice), keine Stück-Staffel anwenden
    if (productKey === 'SolarmodulPalette' || productKey === 'UlicaSolarBlackJadeFlowPalette') {
      return applyVatIfBusiness(basePackPrice);
    }
    const tiers = TIER_PRICING[productKey];
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return applyVatIfBusiness(basePackPrice);
    const qty = Number(requiredPieces) || 0;
    let best = null;
    for (const tier of tiers) {
      if (qty >= tier.minPieces) {
        if (!best || tier.minPieces > best.minPieces) best = tier;
      }
    }
    if (!best) return applyVatIfBusiness(basePackPrice);
    if (typeof best.packPrice === 'number') return applyVatIfBusiness(best.packPrice);
    if (typeof best.pricePerPiece === 'number') return applyVatIfBusiness(best.pricePerPiece * ve);
    return applyVatIfBusiness(basePackPrice);
  }
  
  const PRODUCT_MAP = {
    Solarmodul: { productId:'685003af0e41d945fb0198d8', variantId:'685003af4a8e88cb58c89d46' },
    UlicaSolarBlackJadeFlow: { productId:'689455ed543f0cbb26ba54e9', variantId:'689455ed7d7ddfd326d5dbf9' },
    // Neue Paletten (ohne MwSt – für Privatkunden)
    // 450 W ganze Palette
    SolarmodulPalette: { productId: '68b999a74abecff30536dee0', variantId: '68b999a873f9b0df7954ed8b' },
    // 500 W ganze Palette
    UlicaSolarBlackJadeFlowPalette: { productId: '68b99932fb8af7a115bb2680', variantId: '68b999339e25d980ba33928d' },
    Endklemmen: { productId:'6853c34fe99f6e3d878db38b', variantId:'6853c350edab8f13fc18c1b9' },
    Schrauben: { productId:'6853c2782b14f4486dd26f52', variantId:'6853c2798bf6755ddde26a8e' },
    Dachhaken: { productId:'6853c1d0f350bf620389664c', variantId:'6853c1d04d7c01769211b8d6' },
    Mittelklemmen: { productId:'68531088654d1468dca962c', variantId:'6853c1084c04541622ba3e26' },
    Endkappen: { productId:'6853be0895a5a578324f9682', variantId:'6853be0805e96b5a16c705cd' },
    Schienenverbinder: { productId:'6853c2018bf6755ddde216a8', variantId:'6853c202c488ee61eb51a3dc' },
    Schiene_240_cm: { productId:'6853bd882f00db0c9a42d653', variantId:'6853bd88c4173dbe72bab10f' },
    Schiene_360_cm: { productId:'6853bc8f3f6abf360c605142', variantId:'6853bc902f00db0c9a423d97' },
    MC4_Stecker: { productId:'687fcc9f66078f7098826ccc', variantId:'687fcca02c6537b9a9493fa7' },
    Solarkabel: { productId:'687fd60dc599f5e95d783f99', variantId:'687fd60dd3a8ae1f00a6d6d1' },
    Holzunterleger: { productId:'688780821dbbf26153a85117', variantId:'688780ad795c82663cd6e69b' },
    // NEUE PRODUKTE (aus Berechnung raus, später hinzufügen)
    Erdungsklemme: { productId:'6887e8aaa6ca43c15254d224', variantId:'6887e8abb439562cbc88db5d' },
    Quetschkabelschuhe: { productId:'68876153200e1a5e28a1b709', variantId:'6887615388988b2ccda11067' },
    Erdungsband: { productId:'688760e01c9c7973ee287386', variantId:'688760e0835845affc493354' },
    Tellerkopfschraube: { productId:'688760a7124e867cf2b20051', variantId:'688760a7f246d23f70575fb1' },
    // Optimierer (Netto)
    HuaweiOpti: { productId: '68af2934de0a7fe5d316efbc', variantId: '68af2934c230bc1eaa972585' },
    BRCOpti: { productId: '68b1e02629cec71ebfc12f0e', variantId: '68b1e02ca05a6b4aca721dc8' }
  };
  
  const PRODUCT_NAME_MAP = {
    'Solarmodul': 'Ulica Solar Black Jade-Flow 450 W',
    'UlicaSolarBlackJadeFlow': 'Ulica Solar Black Jade-Flow 500 W',
    'SolarmodulPalette': 'Palette (36× Ulica Solar Black Jade-Flow 450 W)',
    'UlicaSolarBlackJadeFlowPalette': 'Palette (36× Ulica Solar Black Jade-Flow 500 W)',
    'Schrauben': 'Schraube M10x25',
    'Solarkabel': 'Solarkabel',
    'Holzunterleger': 'Unterlegholz für Dachhaken',
    // NEUE PRODUKTE (aus Berechnung raus, später hinzufügen)
    'Erdungsklemme': 'Erdungsklemme - ?? Stücl',
    'Quetschkabelschuhe': 'Quetschkabelschuhe',
    'Erdungsband': 'Erdungsband',
    'Tellerkopfschraube': 'Tellerkopfschraube 8x100',
    'HuaweiOpti': 'Huawei Smart PV Optimierer 600W',
    'BRCOpti': 'BRC M600M Optimierer'
  };
  
  const PRODUCT_IMAGES = {
    Solarmodul: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
    UlicaSolarBlackJadeFlow: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
    SolarmodulPalette: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
    UlicaSolarBlackJadeFlowPalette: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
    Endklemmen: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c316b21cb7d04ba2ed22_DSC04815-min.jpg',
    Schrauben: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c2704f5147533229ccde_DSC04796-min.jpg',
    Dachhaken: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c1c8a2835b7879f46811_DSC04760-min.jpg',
    Mittelklemmen: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c0d0c2d922d926976bd4_DSC04810-min.jpg',
    Endkappen: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bdfbe7cffc653f6a4605_DSC04788-min.jpg',
    Schienenverbinder: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c21f0c39e927fce0db3b_DSC04780-min.jpg',
    Schiene_240_cm: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bce018164af4b4a187f1_DSC04825-min.jpg',
    Schiene_360_cm: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bcd5726d1d33d4b86ba4_DSC04824-min.jpg',
    MC4_Stecker: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/687fcdab153f840ea15b5e7b_iStock-2186771695.jpg',
    Solarkabel: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/687fd566bdbb6de2e5f362f0_DSC04851.jpg',
    Holzunterleger: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
    // NEUE PRODUKTE (aus Berechnung raus, später hinzufügen)
    Erdungsklemme: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
    Quetschkabelschuhe: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6887614c64676f0b0c8d5037_Kabelschuh%20Platzhalter.jpg',
    Erdungsband: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
    Tellerkopfschraube: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c2704f5147533229ccde_DSC04796-min.jpg'
  };
  
  // Zentrale Konfiguration ist jetzt direkt eingebettet
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
          
          // Worker Debug-Logs an Haupt-Console weiterleiten
          if (type === 'debug') {
            console.log(...data);
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
      // FALLBACK: Verwende Calculation Worker direkt
      try {
        // Simuliere Worker-Aufruf synchron
        const { selection, rows, cols, cellWidth, cellHeight, orientation, options = {} } = data;
        const parts = {
          Solarmodul: 0, UlicaSolarBlackJadeFlow: 0, Endklemmen: 0, Mittelklemmen: 0,
          Dachhaken: 0, Schrauben: 0, Endkappen: 0,
          Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0, Tellerkopfschraube: 0
        };

        // Verwende die korrekte Schienenlogik (wie im Worker)
        for (let y = 0; y < rows; y++) {
          if (!Array.isArray(selection[y])) continue;
          let run = 0;

          for (let x = 0; x < cols; x++) {
            if (selection[y]?.[x]) run++;
            else if (run) { 
              this.processGroupSync(run, parts, cellWidth, cellHeight, orientation, options); 
              run = 0; 
            }
          }
          if (run) this.processGroupSync(run, parts, cellWidth, cellHeight, orientation, options);
        }

        return parts;
      } catch (error) {
        console.error('calculatePartsSync error:', error);
        return {
          Solarmodul: 0, Endklemmen: 0, Mittelklemmen: 0,
          Dachhaken: 0, Schrauben: 0, Endkappen: 0,
          Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0, Tellerkopfschraube: 0
        };
      }
    }

    processGroupSync(len, parts, cellWidth, cellHeight, orientation, options = {}) {
      // FALLBACK: Kopie der Worker-Berechnung
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
      parts.Endkappen          += 4; // Gleich wie Endklemmen
      parts.Solarmodul         += len;
      // UlicaSolarBlackJadeFlow hinzufügen wenn ulica-module Checkbox aktiviert ist
      if (options.ulicaModule === true) {
        parts.UlicaSolarBlackJadeFlow += len;
      }
      parts.Schrauben          += len > 1 ? len * 3 : 4; // Basierend auf Dachhaken
      parts.Tellerkopfschraube += len > 1 ? (len * 3) * 2 : 8; // Basierend auf Dachhaken * 2
    }

    calculateExtendedPartsSync(data) {
      let parts = this.calculatePartsSync(data);
      const { options } = data;
      
      if (!options.includeModules) {
        delete parts.Solarmodul;
      }
      
      if (options.ulicaModule !== true) {
        delete parts.UlicaSolarBlackJadeFlow;
      }
      
      if (options.mc4Connectors) {
        const panelCount = data.selection.flat().filter(v => v).length;
        parts.MC4_Stecker = Math.ceil(panelCount / 30);
      }
      
      if (options.solarkabel) {
        parts.Solarkabel = 1;
      }
      
      if (options.woodUnderlay) {
        parts.Holzunterleger = 1; // Pauschal 1x zur Gesamtbestellung
      }
      
      if (options.erdungsband) {
        // Erdungsband-Berechnung hier hinzufügen wenn nötig
        // parts.Erdungsband = calculateErdungsband(...);
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

  // Warte, bis alle Bilder in einem Container geladen sind (verhindert leere html2canvas Renders)
  function waitForImages(container) {
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length === 0) return Promise.resolve();
    return Promise.all(images.map(img => new Promise(resolve => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    })));
  }

  // (Fallback entfernt, wir setzen ausschließlich auf html2pdf.js)
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
      
      const allKeys = Array.from(new Set([
        ...Object.keys(PRODUCT_MAP || {}),
        ...Object.keys(PRODUCT_MAP_BRUTTO || {})
      ]));
      const promises = allKeys.map(async (productKey) => {
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
          let price = this.extractPriceFromHTML(productKey);
          // Falls 0 oder nicht gefunden: versuche Brutto-/Netto-Schwestern-Key
          if (!price || price === 0) {
            try {
              // Map zwischen Netto/Brutto-Produktquellen bilden
              const isBrutto = !!(PRODUCT_MAP_BRUTTO && PRODUCT_MAP_BRUTTO[productKey]);
              const altMap = isBrutto ? PRODUCT_MAP : PRODUCT_MAP_BRUTTO;
              if (altMap && altMap[productKey]) {
                price = this.extractPriceFromHTML(productKey);
              }
            } catch (e) {}
          }
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
        // Mehrere mögliche Selektoren/Attribute versuchen
        const selectors = [
          '[data-wf-sku-bindings*="f_price_"]',
          '[data-commerce-sku-price]','[data-commerce-product-price]',
          '.w-commerce-commerceproductprice','.w-commerce-commerceaddtocartprice'
        ];
        for (const sel of selectors) {
          const el = productForm.querySelector(sel);
          if (!el) continue;
          let priceText = (el.getAttribute('data-commerce-sku-price') || el.getAttribute('data-commerce-product-price') || el.textContent || el.innerHTML || '').toString();
          priceText = priceText.replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€');
          const m = priceText.match(/(\d+(?:[.,]\d{1,2})?)/);
          if (m) return parseFloat(m[1].replace(',', '.'));
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

  // Entfernt - wird jetzt über zentrale Konfiguration verwaltet

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
    },
    // NEUE Debug-Funktion für Quetschkabelschuhe
    testQuetschkabelschuhe: () => {
      console.log('Testing Quetschkabelschuhe price...');
      console.log('PRICE_MAP:', PRICE_MAP.Quetschkabelschuhe);
      console.log('Cache value:', priceCache.getPrice('Quetschkabelschuhe'));
      console.log('Direct fallback:', PRICE_MAP['Quetschkabelschuhe'] || 0);
      return {
        priceMap: PRICE_MAP.Quetschkabelschuhe,
        cacheValue: priceCache.getPrice('Quetschkabelschuhe'),
        fallback: PRICE_MAP['Quetschkabelschuhe'] || 0
      };
    },
    // Cache bereinigen und neu laden
    resetAndReload: () => {
      console.log('Resetting price cache...');
      window.debugPriceCache.clearCache();
      priceCache.loadFromStorage();
      priceCache.forceUpdate();
      console.log('Cache reset complete');
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
      this.html2pdf = window.html2pdf; // html2pdf.js (optional, moderner Pfad)
      // Weiße Footer-Logo-Variante (für dunklen Footer-Hintergrund)
      this.companyLogoUrl = 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/688f3fff157b70cefcaa97df_Schneider%20logo.png';
      // Blaues Header-Logo
      this.headerLogoBlueUrl = 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6893249274128869974e58ec_schneider%20logo%20png.png';
    }

    // Prüfe ob PDF-Libraries verfügbar sind
    isAvailable() {
      return !!(this.jsPDF && this.html2canvas);
    }

    // NEU: Stabile PDF-Generation per html2canvas + jsPDF (ohne html2pdf Kette)
    async generatePDFFromSnapshot(snapshot) {
      if (!this.jsPDF || !this.html2canvas) {
        console.error('jsPDF/html2canvas nicht verfügbar');
        this.solarGrid.showToast('PDF-Generierung nicht verfügbar', 3000);
        return;
      }
      if (!snapshot?.configs?.length) {
        this.solarGrid.showToast('Keine Konfiguration zum Exportieren', 3000);
        return;
      }
      try {
        // 1) Template rendern
        await this.renderSnapshotIntoPdfTemplate(snapshot);
        const rootEl = document.getElementById('pdf-root');
        if (!rootEl) throw new Error('#pdf-root nicht gefunden');
        const prevStyle = rootEl.getAttribute('style') || '';

        // 2) Sichtbar aber unsichtbar machen (für zuverlässiges Rendering)
        rootEl.style.position = 'fixed';
        rootEl.style.left = '0';
        rootEl.style.top = '0';
        rootEl.style.opacity = '0.01';
        rootEl.style.pointerEvents = 'none';
        rootEl.style.zIndex = '9999';
        rootEl.style.background = '#ffffff';

        // 3) Sicherstellen, dass alle Bilder fertig sind
        await waitForImages(rootEl);
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 30));

        const pages = Array.from(rootEl.querySelectorAll('.pdf-page'));
        if (pages.length === 0) throw new Error('Keine .pdf-page Elemente');
        console.log('[PDF] capturing pages:', pages.length);

        // 4) PDF initialisieren – Pixel-Format exakt zu unseren CSS-Werten
        const pdf = new this.jsPDF({ unit: 'px', format: [794, 1123], orientation: 'portrait' });

        for (let i = 0; i < pages.length; i++) {
          const pageEl = pages[i];
          // Garantierte Maße pro Seite
          pageEl.style.width = '794px';
          pageEl.style.height = '1123px';
          pageEl.style.boxSizing = 'border-box';

          // Canvas erzeugen
          const canvas = await this.html2canvas(pageEl, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: true
          });
          console.log('[PDF] canvas created', { w: canvas.width, h: canvas.height });
          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, 794, 1123);
        }

        // 5) Speichern und Root zurücksetzen
        const fileName = this.generateFileName(snapshot.configs);
        pdf.save(fileName);
        rootEl.setAttribute('style', prevStyle);
      } catch (err) {
        console.error('PDF-Erstellung fehlgeschlagen:', err);
        this.solarGrid.showToast('PDF-Erstellung fehlgeschlagen', 3000);
      }
    }

    // Rendert den Snapshot in das versteckte A4-HTML-Template (#pdf-root)
    async renderSnapshotIntoPdfTemplate(snapshot) {
      const root = document.getElementById('pdf-root');
      if (!root) return;
      // Leeren
      root.innerHTML = '';
      const dateStr = new Date().toLocaleDateString('de-DE');

      for (let i = 0; i < snapshot.configs.length; i++) {
        const config = snapshot.configs[i];
        // Seite klonen
        const page = document.createElement('div');
        page.className = 'pdf-page';
        page.style.width = '794px';
        page.style.minHeight = '1123px';
        page.style.padding = '48px 48px 64px 48px';
        page.style.boxSizing = 'border-box';
        page.style.position = 'relative';

        page.innerHTML = `
          <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10mm;">
            <div>
              <div style="font-size:18pt; font-weight:700; color:#0e1e34;">${config.name || 'Konfiguration'}</div>
              <div style="font-size:10pt; color:#677; margin-top:2mm;">${dateStr}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; color:#0e1e34; font-size:10pt;"><img src="${this.headerLogoBlueUrl}" alt="Logo" style="height:12mm; width:auto;"/></div>
          </header>
          <section style="border:1px solid #e5e7eb; border-radius:8px; padding:6mm; margin-bottom:8mm;">
            <div style="font-size:12pt; font-weight:700; color:#0e1e34;">Projekt</div>
            <div style="font-size:10pt; color:#111; margin-top:2mm; display:flex; justify-content:space-between; gap:6mm;">
              <div><span style="font-weight:700;">Projekttitel:</span> ${(config.name || 'Unbenannt')}</div>
              <div><span style="font-weight:700;">Datum:</span> ${dateStr}</div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6mm; margin-top:4mm;">
              <div>
                <div style="display:flex; align-items:flex-end; gap:4mm; margin-bottom:3mm;">
                  <div style="width:28mm; color:#0e1e34;">Name:</div>
                  <div style="flex:1; height:6mm; border-bottom:1px solid #e5e7eb;"></div>
                </div>
                <div style="display:flex; align-items:flex-end; gap:4mm; margin-bottom:3mm;">
                  <div style="width:28mm; color:#0e1e34;">Firma:</div>
                  <div style="flex:1; height:6mm; border-bottom:1px solid #e5e7eb;"></div>
                </div>
                <div style="display:flex; align-items:flex-end; gap:4mm; margin-bottom:3mm;">
                  <div style="width:28mm; color:#0e1e34;">Adresse:</div>
                  <div style="flex:1; height:6mm; border-bottom:1px solid #e5e7eb;"></div>
                </div>
                <div style="display:flex; align-items:flex-end; gap:4mm; margin-bottom:3mm;">
                  <div style="width:28mm; color:#0e1e34;">Telefon:</div>
                  <div style="flex:1; height:6mm; border-bottom:1px solid #e5e7eb;"></div>
                </div>
                <div style="display:flex; align-items:flex-end; gap:4mm;">
                  <div style="width:28mm; color:#0e1e34;">E-Mail:</div>
                  <div style="flex:1; height:6mm; border-bottom:1px solid #e5e7eb;"></div>
                </div>
              </div>
              <div>
                <div style="display:flex; align-items:flex-end; gap:4mm; margin-bottom:3mm;">
                  <div style="flex:0 0 auto; font-weight:700; color:#0e1e34;">Weitere Informationen:</div>
                  <div style="flex:1; height:6mm; border-bottom:1px solid #e5e7eb;"></div>
                </div>
                <div style="height:6mm; border-bottom:1px solid #e5e7eb; margin-bottom:3mm;"></div>
                <div style="height:6mm; border-bottom:1px solid #e5e7eb; margin-bottom:3mm;"></div>
                <div style="height:6mm; border-bottom:1px solid #e5e7eb; margin-bottom:3mm;"></div>
                <div style="height:6mm; border-bottom:1px solid #e5e7eb;"></div>
              </div>
            </div>
          </section>
          <section style="margin-bottom:8mm;">
            <div style="font-size:11pt; font-weight:700; color:#0e1e34; margin-bottom:4mm;">Grid-Übersicht</div>
            <div style="font-size:10pt; color:#111; margin-bottom:4mm;">
              Grid: ${config.cols} × ${config.rows} Module (${config.selectedCells} ausgewählt) · Orientierung: ${config.orientation === 'vertical' ? 'Vertikal' : 'Horizontal'}
            </div>
            <img class="pdf-grid-image" alt="Grid" style="width:100%; max-width:100%; border-radius:6px; border:1px solid #e5e7eb; box-shadow:0 2px 8px rgba(0,0,0,0.06);" />
          </section>
        `;

        // Grid-Bild generieren
        try {
          const gridImg = await this.captureGridVisualizationFromSnapshot(config);
          if (gridImg) page.querySelector('.pdf-grid-image').src = gridImg;
        } catch {}

        // Produktliste als eigene Seite (ohne Zusatzprodukte)
        const productsPage = document.createElement('div');
        productsPage.className = 'pdf-page';
        productsPage.style.width = '794px';
        productsPage.style.minHeight = '1123px';
        productsPage.style.padding = '48px 48px 64px 48px';
        productsPage.style.boxSizing = 'border-box';
        productsPage.style.position = 'relative';

        productsPage.innerHTML = `
          <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10mm;">
            <div>
              <div style="font-size:18pt; font-weight:700; color:#0e1e34;">${config.name || 'Konfiguration'}</div>
              <div style="font-size:10pt; color:#677; margin-top:2mm;">${dateStr}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; color:#0e1e34; font-size:10pt;"><img src="${this.headerLogoBlueUrl}" alt="Logo" style="height:12mm; width:auto;"/></div>
          </header>
          <div style="background:#FFB101; color:#000; border-radius:8px; padding:6mm; font-weight:700; margin-bottom:6mm;">PRODUKT-LISTE</div>
          <table style="width:100%; border-collapse:collapse; font-size:10pt;">
            <thead>
              <tr style="background:#0e1e34; color:#fff;">
                <th style="text-align:left; padding:3mm 4mm; border-top-left-radius:6px; width:20mm;">Anzahl</th>
                <th style="text-align:left; padding:3mm 4mm;">Produkt</th>
                <th style="text-align:right; padding:3mm 4mm; width:35mm;">Benötigte Menge</th>
                <th style="text-align:right; padding:3mm 4mm; border-top-right-radius:6px; width:30mm;">Preis</th>
              </tr>
            </thead>
            <tbody class="pdf-table-body"></tbody>
          </table>
          <div class="pdf-total" style="margin-top:8mm; background:#0e1e34; color:#fff; border-radius:8px; padding:6mm; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:700;">GESAMTPREIS</div>
            <div class="pdf-total-price" style="font-size:14pt; font-weight:700;"></div>
          </div>
        `;

        // Produkte rendern (neues Tabellenlayout: Anzahl | Produkt+VE | benötigte Menge | Preis)
        // Zusatzprodukte werden hier explizit ausgeschlossen – sie kommen gesammelt auf eine separate Seite
        const pdfTotalPriceEl = productsPage.querySelector('.pdf-total-price');
        if (pdfTotalPriceEl) {
          // Hinweis nur für Firmenkunden, unter dem Preis anordnen (rechts, Spalte)
          if (!isPrivateCustomer()) {
            const totalContainer = productsPage.querySelector('.pdf-total');
            if (totalContainer && pdfTotalPriceEl.parentElement === totalContainer) {
              const rightCol = document.createElement('div');
              rightCol.style.display = 'flex';
              rightCol.style.flexDirection = 'column';
              rightCol.style.alignItems = 'flex-end';
              // Preis-Element in die rechte Spalte verschieben
              rightCol.appendChild(pdfTotalPriceEl);
              // Hinweis darunter
              const hint = document.createElement('div');
              hint.textContent = '(exkl. MwSt)';
              hint.style.fontSize = '9pt';
              hint.style.fontWeight = '400';
              hint.style.marginTop = '2mm';
              hint.style.opacity = '0.9';
              rightCol.appendChild(hint);
              totalContainer.appendChild(rightCol);
            }
          }
        }

        await this.renderProductsIntoTable(config, productsPage.querySelector('.pdf-table-body'), pdfTotalPriceEl, {
          htmlLayout: true,
          excludeAdditionalProducts: true
        });

        // Safety: falls Tabelle leer ist, füge Platzhalterzeile ein
        const tbody = productsPage.querySelector('.pdf-table-body');
        if (tbody && !tbody.innerHTML.trim()) {
          tbody.innerHTML = '<tr><td style="padding:3mm 4mm;" colspan="4">Keine Produkte ausgewählt</td></tr>';
        }

        // Footer für beide Seiten mit Logo
        const makeFooter = () => {
          const footer = document.createElement('div');
          footer.style.position = 'absolute';
          footer.style.left = '0';
          footer.style.right = '0';
          footer.style.bottom = '0';
          footer.style.height = '18mm';
          footer.style.background = '#0e1e34';
          footer.style.color = '#fff';
          footer.style.display = 'flex';
          footer.style.alignItems = 'center';
          footer.style.justifyContent = 'space-between';
          footer.style.padding = '0 16mm';
          footer.style.boxSizing = 'border-box';
          footer.style.fontSize = '8pt';
          const left = document.createElement('div');
          left.textContent = 'Schneider Unterkonstruktion - Solar Konfigurator';
          const right = document.createElement('img');
          right.src = this.companyLogoUrl;
          right.alt = 'Logo';
          right.style.height = '12mm';
          right.style.width = 'auto';
          footer.appendChild(left);
          footer.appendChild(right);
          return footer;
        };

        page.appendChild(makeFooter());
        productsPage.appendChild(makeFooter());

        root.appendChild(page);
        root.appendChild(productsPage);
      }

      // Nach allen Konfigurationen: optionale Zusatzprodukte-Seite (einmal pro PDF)
      try {
        const additionalParts = this.computeAdditionalProductsForSnapshot(snapshot);
        const additionalKeys = Object.keys(additionalParts).filter(k => additionalParts[k] > 0);
        if (additionalKeys.length > 0) {
          const dateStr2 = new Date().toLocaleDateString('de-DE');
          const additionalPage = document.createElement('div');
          additionalPage.className = 'pdf-page';
          additionalPage.style.width = '794px';
          additionalPage.style.minHeight = '1123px';
          additionalPage.style.padding = '48px 48px 64px 48px';
          additionalPage.style.boxSizing = 'border-box';
          additionalPage.style.position = 'relative';

          additionalPage.innerHTML = `
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10mm;">
              <div>
                <div style="font-size:18pt; font-weight:700; color:#0e1e34;">Für alle Konfigurationen</div>
                <div style="font-size:10pt; color:#677; margin-top:2mm;">${dateStr2}</div>
              </div>
              <div style="display:flex; align-items:center; gap:8px; color:#0e1e34; font-size:10pt;"><img src="${this.headerLogoBlueUrl}" alt="Logo" style="height:12mm; width:auto;"/></div>
            </header>
            <div style="background:#FFB101; color:#000; border-radius:8px; padding:6mm; font-weight:700; margin-bottom:6mm;">ZUSATZPRODUKTE</div>
            <table style="width:100%; border-collapse:collapse; font-size:10pt;">
              <thead>
                <tr style="background:#0e1e34; color:#fff;">
                  <th style="text-align:left; padding:3mm 4mm; border-top-left-radius:6px; width:20mm;">Anzahl</th>
                  <th style="text-align:left; padding:3mm 4mm;">Produkt</th>
                  <th style="text-align:right; padding:3mm 4mm; width:35mm;">Benötigte Menge</th>
                  <th style="text-align:right; padding:3mm 4mm; border-top-right-radius:6px; width:30mm;">Preis</th>
                </tr>
              </thead>
              <tbody class="pdf-additional-table-body"></tbody>
            </table>
            <div class="pdf-total" style="margin-top:8mm; background:#0e1e34; color:#fff; border-radius:8px; padding:6mm; display:flex; justify-content:space-between; align-items:center;">
              <div style="font-weight:700;">GESAMTPREIS</div>
              <div class="pdf-additional-total-price" style="font-size:14pt; font-weight:700;"></div>
            </div>
          `;

          // Render Zusatzprodukte-Tabelle
          const pdfAddTotalEl = additionalPage.querySelector('.pdf-additional-total-price');
          if (pdfAddTotalEl) {
            if (!isPrivateCustomer()) {
              const totalContainer = additionalPage.querySelector('.pdf-total');
              if (totalContainer && pdfAddTotalEl.parentElement === totalContainer) {
                const rightCol = document.createElement('div');
                rightCol.style.display = 'flex';
                rightCol.style.flexDirection = 'column';
                rightCol.style.alignItems = 'flex-end';
                rightCol.appendChild(pdfAddTotalEl);
                const hint = document.createElement('div');
                hint.textContent = '(exkl. MwSt)';
                hint.style.fontSize = '9pt';
                hint.style.fontWeight = '400';
                hint.style.marginTop = '2mm';
                hint.style.opacity = '0.9';
                rightCol.appendChild(hint);
                totalContainer.appendChild(rightCol);
              }
            }
          }
          await this.renderAdditionalProductsIntoTable(snapshot, additionalPage.querySelector('.pdf-additional-table-body'), pdfAddTotalEl);

          // Footer
          const footer = document.createElement('div');
          footer.style.position = 'absolute';
          footer.style.left = '0';
          footer.style.right = '0';
          footer.style.bottom = '0';
          footer.style.height = '18mm';
          footer.style.background = '#0e1e34';
          footer.style.color = '#fff';
          footer.style.display = 'flex';
          footer.style.alignItems = 'center';
          footer.style.justifyContent = 'space-between';
          footer.style.padding = '0 16mm';
          footer.style.boxSizing = 'border-box';
          footer.style.fontSize = '8pt';
          const left = document.createElement('div');
          left.textContent = 'Schneider Unterkonstruktion - Solar Konfigurator';
          const right = document.createElement('img');
          right.src = this.companyLogoUrl;
          right.alt = 'Logo';
          right.style.height = '12mm';
          right.style.width = 'auto';
          footer.appendChild(left);
          footer.appendChild(right);
          additionalPage.appendChild(footer);

          root.appendChild(additionalPage);
        }
      } catch (e) {
        console.warn('Zusatzprodukte-Seite konnte nicht erzeugt werden:', e);
      }
    }

    async renderProductsIntoTable(config, tbodyEl, totalEl, options = {}) {
      const rawParts = await this.calculatePartsFromSnapshot(config);
      const parts = { ...rawParts };
      try {
        const ulicaSelected = config.ulicaModule === true;
        const keyPiece = ulicaSelected ? 'UlicaSolarBlackJadeFlow' : 'Solarmodul';
        const keyPallet = ulicaSelected ? 'UlicaSolarBlackJadeFlowPalette' : 'SolarmodulPalette';
        const count = Number(parts[keyPiece] || 0);
        if (count > 0) {
          const pallets = Math.floor(count / 36);
          const remainder = count % 36;
          if (pallets > 0) {
            parts[keyPallet] = (parts[keyPallet] || 0) + pallets * 36; // Stückbasis, VE=36
          }
          parts[keyPiece] = remainder;
        }
      } catch (e) {}
      let totalPrice = 0;
      const rows = [];
      const ADDITIONAL_KEYS = new Set(['MC4_Stecker', 'Solarkabel', 'Holzunterleger', 'Quetschkabelschuhe']);
      for (const [key, value] of Object.entries(parts || {})) {
        if (value <= 0) continue;
        if (options.excludeAdditionalProducts && ADDITIONAL_KEYS.has(key)) continue;
        const ve = VE[key] || 1;
        const packs = Math.ceil(value / ve);
        const pricePerPack = getPackPriceForQuantity(key, value);
        const rowPrice = packs * pricePerPack;
        totalPrice += rowPrice;
        rows.push({ key, value, ve, packs, rowPrice });
      }
      // Sortiere nach Produktname
      rows.sort((a, b) => a.key.localeCompare(b.key));
      if (options.htmlLayout) {
        tbodyEl.innerHTML = rows.map(r => {
          const productName = PRODUCT_NAME_MAP[r.key] || r.key.replace(/_/g, ' ');
          return `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:3mm 4mm; width:20mm; font-weight:700;">${r.packs}x</td>
              <td style="padding:3mm 4mm;">
                <div style="font-weight:700; font-size:11pt;">${productName}</div>
                <div style="color:#888; font-size:9pt;">${r.ve} Stück</div>
              </td>
              <td style="padding:3mm 4mm; text-align:right; width:35mm;">${r.value}</td>
              <td style="padding:3mm 4mm; text-align:right; width:30mm;">${r.rowPrice.toFixed(2)} €</td>
            </tr>
          `;
        }).join('');
      } else {
        tbodyEl.innerHTML = rows.map(r => `
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:3mm 4mm;">${r.key}</td>
            <td style="padding:3mm 4mm; text-align:right;">${r.value}</td>
            <td style="padding:3mm 4mm; text-align:right;">${r.ve}</td>
            <td style="padding:3mm 4mm; text-align:right;">${r.rowPrice.toFixed(2)} €</td>
          </tr>
        `).join('');
      }
      if (totalEl) totalEl.textContent = `${totalPrice.toFixed(2)} €`;
    }

    // Aggregiert Zusatzprodukte einmalig über alle Konfigurationen im Snapshot
    computeAdditionalProductsForSnapshot(snapshot) {
      try {
        const configs = Array.isArray(snapshot?.configs) ? snapshot.configs : [];
        const anyMc4 = configs.some(c => c.mc4 === true);
        const anyCable = configs.some(c => c.cable === true || c.solarkabel === true);
        const anyWood = configs.some(c => c.wood === true || c.holz === true);
        const anyQuetsch = configs.some(c => c.quetschkabelschuhe === true);

        const totalSelectedCells = configs.reduce((sum, c) => {
          if (typeof c.selectedCells === 'number') return sum + c.selectedCells;
          if (Array.isArray(c.selection)) {
            return sum + c.selection.flat().filter(Boolean).length;
          }
          return sum;
        }, 0);

        const result = {};
        if (anyMc4) {
          result.MC4_Stecker = Math.max(1, Math.ceil((totalSelectedCells || 0) / 30));
        }
        if (anyCable) {
          result.Solarkabel = 1;
        }
        if (anyWood) {
          result.Holzunterleger = 1;
        }
        if (anyQuetsch) {
          result.Quetschkabelschuhe = 1;
        }
        return result;
      } catch (err) {
        console.warn('computeAdditionalProductsForSnapshot failed:', err);
        return {};
      }
    }
    // Rendert Zusatzprodukte in eine Tabelle (HTML-Modus) und zeigt Gesamtpreis
    async renderAdditionalProductsIntoTable(snapshot, tbodyEl, totalEl) {
      const parts = this.computeAdditionalProductsForSnapshot(snapshot);
      let totalPrice = 0;
      const rows = Object.entries(parts).map(([key, value]) => {
        const ve = VE[key] || 1;
        const packs = Math.ceil(value / ve);
        const pricePerPack = getPackPriceForQuantity(key, value);
        const rowPrice = packs * pricePerPack;
        totalPrice += rowPrice;
        return { key, value, ve, packs, rowPrice };
      });
      // Reihenfolge stabil nach Name
      rows.sort((a, b) => a.key.localeCompare(b.key));
      tbodyEl.innerHTML = rows.map(r => {
        const productName = PRODUCT_NAME_MAP[r.key] || r.key.replace(/_/g, ' ');
        return `
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:3mm 4mm; width:20mm; font-weight:700;">${r.packs}x</td>
            <td style="padding:3mm 4mm;">
              <div style="font-weight:700; font-size:11pt;">${productName}</div>
              <div style="color:#888; font-size:9pt;">${r.ve} Stück</div>
            </td>
            <td style="padding:3mm 4mm; text-align:right; width:35mm;">${r.value}</td>
            <td style="padding:3mm 4mm; text-align:right; width:30mm;">${r.rowPrice.toFixed(2)} €</td>
          </tr>
        `;
      }).join('');
      if (totalEl) totalEl.textContent = `${totalPrice.toFixed(2)} €`;
    }

    // Abwärtskompatibler Wrapper: ermöglicht this.pdfGenerator.generatePDF('current'|'all')
    async generatePDF(mode = 'current') {
      if (!this.isAvailable()) {
        console.warn('PDF Libraries nicht verfügbar');
        this.solarGrid?.showToast?.('PDF-Generierung nicht verfügbar', 3000);
        return;
      }
      try {
        // Erzeuge Snapshot über SolarGrid
        const fullSnapshot = this.solarGrid?.createConfigSnapshot
          ? this.solarGrid.createConfigSnapshot()
          : null;
        if (!fullSnapshot || !Array.isArray(fullSnapshot.configs) || fullSnapshot.configs.length === 0) {
          this.solarGrid?.showToast?.('Keine Konfiguration zum Exportieren', 3000);
          return;
        }
        let snapshotToExport = fullSnapshot;
        if (mode === 'current') {
          const idx = typeof fullSnapshot.currentConfigIndex === 'number' ? fullSnapshot.currentConfigIndex : 0;
          const only = fullSnapshot.configs[idx] || fullSnapshot.configs[0];
          snapshotToExport = {
            timestamp: fullSnapshot.timestamp,
            totalConfigs: 1,
            currentConfigIndex: 0,
            configs: [only]
          };
        }
        await this.generatePDFFromSnapshot(snapshotToExport);
      } catch (err) {
        console.error('generatePDF wrapper failed:', err);
        this.solarGrid?.showToast?.('PDF-Erstellung fehlgeschlagen', 3000);
      }
    }

    // Entfernt alte generatePDF-Umleitung: direkte Nutzung von generatePDFFromSnapshot()

    // Entfernt ungenutzte calculateTotalPrice (wir nutzen calculateConfigPrice zentral)

    // Header auf jeder Seite (neues Design)
    addHeader(pdf, pageWidth, config) {
      // NEUES DESIGN: Header minimal, weißer Hintergrund mit Titel in dunkelblau
      pdf.setTextColor(14, 30, 52);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Ihre Konfiguration', 20, 20);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(new Date().toLocaleDateString('de-DE'), pageWidth - 40, 20);
      pdf.setTextColor(0, 0, 0);
      return 28; // Y-Start nach Header
    }

    // Interne Hilfsfunktion: invertiert ein Base64 PNG und cached das Ergebnis
    async getInvertedLogoBase64(originalBase64) {
      if (this._invertedLogoBase64Promise) return this._invertedLogoBase64Promise;
      this._invertedLogoBase64Promise = new Promise((resolve, reject) => {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];       // R
                data[i + 1] = 255 - data[i + 1]; // G
                data[i + 2] = 255 - data[i + 2]; // B
                // Alpha bleibt
              }
              ctx.putImageData(imageData, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = reject;
          img.src = originalBase64;
        } catch (e) {
          reject(e);
        }
      });
      return this._invertedLogoBase64Promise;
    }

    // Footer mit Logo (invertiert) – neues Design
    async addFooter(pdf, pageWidth, pageHeight) {
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
        // Logo von bereitgestellter URL laden und invertieren
        const logoBase64 = await this.loadImageAsBase64(this.companyLogoUrl);
        const invertedLogoBase64 = await this.getInvertedLogoBase64(logoBase64);
        const logoHeight = 15; // Feste Höhe
        const logoWidth = logoHeight * 3.1338028169; // Exaktes Verhältnis 3.1338028169:1
        const logoX = pageWidth - logoWidth - 20; // 20px Abstand vom rechten Rand
        const logoY = footerY + 5; // 5px Abstand vom oberen Footer-Rand

        // Base64 Logo als Bild einbetten (invertiert)
        pdf.addImage(invertedLogoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
      } catch (error) {
        console.warn('Logo konnte nicht geladen werden:', error);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Schneider Unterkonstruktion', pageWidth - 120, footerY + 12);
      }
    }

    // Lädt ein Bild (CORS-fähig) von URL und gibt ein Base64 PNG zurück
    async loadImageAsBase64(url) {
      return new Promise((resolve, reject) => {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = reject;
          img.src = url;
        } catch (e) {
          reject(e);
        }
      });
    }

    // Hilfsmethode für Gesamtpreis-Berechnung aus Snapshot
    async calculateTotalPriceFromSnapshot(config) {
      const parts = await this.calculatePartsFromSnapshot(config);
      
      let totalPrice = 0;
      Object.entries(parts).forEach(([key, value]) => {
        if (value > 0) {
          const packs = Math.ceil(value / (VE[key] || 1));
          const pricePerPack = getPackPriceForQuantity(key, value);
          totalPrice += packs * pricePerPack;
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
      const checkPageBreak = async (neededSpace = 20) => {
        if (positionRef.y + neededSpace > pageHeight - bottomMargin) {
          // Footer auf aktueller Seite hinzufügen
          await this.addFooter(pdf, pageWidth, pageHeight);
          // Neue Seite hinzufügen
          pdf.addPage();
          // Header auf neuer Seite
          this.addHeader(pdf, pageWidth, config);
          positionRef.y = 28;
          return true;
        }
        return false;
      };

      console.log(`PDF-Seite für Konfiguration: ${config.name}`, {
        dimensions: `${config.cols}x${config.rows}`,
        selectedCells: config.selectedCells,
        totalCells: config.totalCells
      });

      // Header zeichnen (auf jeder Seite identisch)
      positionRef.y = this.addHeader(pdf, pageWidth, config);

      // Projekt-Info Sektion: dezenter Container
      await checkPageBreak(20);
      pdf.setDrawColor(229, 231, 235); // #e5e7eb
      pdf.setLineWidth(0.5);
      pdf.rect(15, positionRef.y - 4, pageWidth - 30, 14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(14, 30, 52);
      pdf.text(`Projekt: ${config.name || 'Unbenannt'}`, 20, positionRef.y + 6);
      pdf.setTextColor(0, 0, 0);
      positionRef.y += 22;

      // Grid-Informationen
      await checkPageBreak(20);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Grid: ${config.cols} × ${config.rows} Module (${config.selectedCells} ausgewählt)`, 20, positionRef.y);
      pdf.text(`Orientierung: ${config.orientation === 'vertical' ? 'Vertikal' : 'Horizontal'}`, 20, positionRef.y + 8);
      positionRef.y += 20;

      // Grid-Screenshot hinzufügen (ISOLIERT mit Snapshot-Daten)
      try {
        const gridImage = await this.captureGridVisualizationFromSnapshot(config);
        if (gridImage) {
          // Maximal 70% der A4-Höhe für das Grid-Bild
          const maxHeight = Math.floor(pageHeight * 0.5); // 50% der Seite
          const targetWidth = 170; // mm
          // Berechne proportional die Bildhöhe anhand Zielbreite (Grid-Images werden im Verhältnis ~4:3 erzeugt)
          let computedHeight = Math.round((targetWidth * 3) / 4);
          if (computedHeight > maxHeight) {
            // Skaliere runter, wenn höher als 70% der Seite
            const scale = maxHeight / computedHeight;
            computedHeight = Math.round(computedHeight * scale);
          }

          await checkPageBreak(computedHeight + 15);

          // Zentriert platzieren
          const centerX = (pageWidth - targetWidth) / 2;
          const centerY = positionRef.y;
          pdf.addImage(gridImage, 'PNG', centerX, centerY, targetWidth, computedHeight);
          positionRef.y += computedHeight + 10;
        }
      } catch (error) {
        console.warn('Grid-Screenshot fehlgeschlagen:', error);
        positionRef.y += 10;
      }

      // Produkttabelle auf NEUE SEITE schieben, damit nichts abgeschnitten wird
      await this.addFooter(pdf, pageWidth, pageHeight);
      pdf.addPage();
      this.addHeader(pdf, pageWidth, config);
      positionRef.y = 28;
      // Produkttabelle (ISOLIERT mit Snapshot-Daten)
      await checkPageBreak(60);
      positionRef.y = await this.addProductTableFromSnapshot(pdf, config, positionRef.y, checkPageBreak);

      // Gesamtpreis hervorgehoben
      await checkPageBreak(25);
      const totalPrice = await this.calculateTotalPriceFromSnapshot(config);
      pdf.setFillColor(14, 30, 52);
      pdf.rect(15, positionRef.y - 5, pageWidth - 30, 20, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GESAMTPREIS:', 20, positionRef.y + 8);
      const totalText = `${totalPrice.toFixed(2)} € (exkl. MwSt)`;
      pdf.text(totalText, 170, positionRef.y + 8);
      
      pdf.setTextColor(0, 0, 0);
      positionRef.y += 30;

      // Produkte pro Modul Informationen entfernt - nicht mehr notwendig

      // Footer mit Logo auf der letzten Seite
      await this.addFooter(pdf, pageWidth, pageHeight);
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
        const baseCellSize = 58; // Kompakter und moderner
        const cellWidth = isVertical ? Math.round(baseCellSize * 0.62) : baseCellSize;
        const cellHeight = isVertical ? baseCellSize : Math.round(baseCellSize * 0.62);
        const cellGap = 2; // wie im UI
        
        const gridEl = document.createElement('div');
        gridEl.style.display = 'grid';
        gridEl.style.gap = `${cellGap}px`;
        gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellWidth}px)`;
        gridEl.style.gridTemplateRows = `repeat(${rows}, ${cellHeight}px)`;
        gridEl.style.padding = '16px';
        gridEl.style.backgroundColor = '#f5f7fa';
        gridEl.style.border = '1px solid #e5e7eb';
        gridEl.style.borderRadius = '12px';
        gridEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';

        // Grid-Zellen erstellen
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            const isSelected = selection[y] && selection[y][x] === true;
            
            cell.style.width = `${cellWidth}px`;
            cell.style.height = `${cellHeight}px`;
            cell.style.borderRadius = '6px';
            cell.style.border = '1px solid #d1d5db';
            cell.style.transition = 'all 0.2s ease';
            
            if (isSelected) {
              // Ausgewählte Zelle - modernes Solar-Panel-Design (nah am UI)
              cell.style.backgroundColor = '#0b0b0b';
              cell.style.border = '2px solid #cccccc';
              cell.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.25)';
              
              // Solar-Panel-Pattern hinzufügen
              const pattern = document.createElement('div');
              pattern.style.width = '100%';
              pattern.style.height = '100%';
              pattern.style.background = `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 40%),
                linear-gradient(135deg, #0b0b0b 0%, #111111 50%, #0b0b0b 100%)`;
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
                linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)
              `;
              gridLines.style.backgroundSize = '33% 50%';
              
              pattern.appendChild(gridLines);
              cell.appendChild(pattern);
            } else {
              // Unausgewählte Zelle - neutral (wie UI)
              cell.style.backgroundColor = '#f3f4f6';
              cell.style.border = '1px solid #e5e7eb';
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
              
              // Horizontale Mittellinie
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
        
        // Grid-Rahmen dezent zeichnen (moderner Look)
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
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

    // NEUE ISOLIERTE Grid-Capture im UI-Design (gleiches Layout/Design wie Hauptgrid)
    async captureGridVisualizationFromSnapshot(config) {
      try {
        const selection = config.selection || [];
        const cols = config.cols || 5;
        const rows = config.rows || 5;

        // Zielgröße im PDF
        const maxWidthPx = 698;
        const maxHeightPx = Math.floor(1123 * 0.5);

        // Modulverhältnis aus echten Maßen und Orientierung
        const modW = Number(config.cellWidth || 179);
        const modH = Number(config.cellHeight || 113);
        const orientVertical = config.orientation === 'vertical';
        const unitW = orientVertical ? modH : modW;
        const unitH = orientVertical ? modW : modH;
        const baseGap = 2;
        const wrapperPadding = 16; // wie .canvas

        // Skaliere, um in die Zielbox zu passen (inkl. Padding)
        const rawW = unitW * cols + baseGap * (cols - 1) + wrapperPadding * 2;
        const rawH = unitH * rows + baseGap * (rows - 1) + wrapperPadding * 2;
        const scale = Math.min(maxWidthPx / rawW, maxHeightPx / rawH, 1);
        const cellW = Math.max(1, unitW * scale);
        const cellH = Math.max(1, unitH * scale);
        const gap = Math.max(1, Math.round(baseGap * scale));

        // Offscreen-Container im UI-Stil aufbauen
        const tempRoot = document.createElement('div');
        tempRoot.style.position = 'absolute';
        tempRoot.style.left = '-10000px';
        tempRoot.style.top = '-10000px';
        tempRoot.style.width = `${Math.ceil(cols * cellW + (cols - 1) * gap + wrapperPadding * 2)}px`;
        tempRoot.style.height = `${Math.ceil(rows * cellH + (rows - 1) * gap + wrapperPadding * 2)}px`;

        const canvasLike = document.createElement('div');
        canvasLike.className = 'canvas';
        canvasLike.style.width = '100%';
        canvasLike.style.height = '100%';
        canvasLike.style.padding = `${wrapperPadding}px`;
        canvasLike.style.background = '#d0d0d0';
        canvasLike.style.borderRadius = '6px';
        canvasLike.style.display = 'flex';
        canvasLike.style.alignItems = 'center';
        canvasLike.style.justifyContent = 'center';
        canvasLike.style.boxSizing = 'border-box';

        const overflow = document.createElement('div');
        overflow.style.overflow = 'hidden';
        overflow.style.display = 'flex';
        overflow.style.alignItems = 'center';
        overflow.style.justifyContent = 'center';

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gap = `${gap}px`;
        grid.style.gridTemplateColumns = `repeat(${cols}, ${Math.round(cellW)}px)`;
        grid.style.gridTemplateRows = `repeat(${rows}, ${Math.round(cellH)}px)`;

        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const cell = document.createElement('div');
            cell.style.width = `${Math.round(cellW)}px`;
            cell.style.height = `${Math.round(cellH)}px`;
            cell.style.borderRadius = '6px';
            cell.style.boxSizing = 'border-box';
            const isSelected = !!(selection[y] && selection[y][x]);
            if (isSelected) {
              cell.style.background = '#0b0b0b';
              cell.style.border = '2px solid #cccccc';
            } else {
              cell.style.background = '#f3f4f6';
              cell.style.border = '1px solid #e5e7eb';
            }
            grid.appendChild(cell);
          }
        }

        overflow.appendChild(grid);
        canvasLike.appendChild(overflow);
        tempRoot.appendChild(canvasLike);
        document.body.appendChild(tempRoot);

        // Rendern lassen und Screenshot erstellen
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 50));
        const canvas = await this.html2canvas(tempRoot, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false
        });
        document.body.removeChild(tempRoot);
        return canvas.toDataURL('image/png');
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
        console.log('Parts entries:', Object.entries(parts || {}));
        console.log('UlicaSolarBlackJadeFlow in parts:', parts?.UlicaSolarBlackJadeFlow);
        
        if (!parts || Object.keys(parts).length === 0) {
          console.log('No parts calculated, returning early');
          return yPosition;
        }

        // NEUES DESIGN: Produkttabelle mit Header
        await checkPageBreak(30);
        
        // Header im Stil der Sidebar (Orange, abgerundet)
        pdf.setFillColor(255, 177, 1); // #FFB101
        if (pdf.roundedRect) {
          pdf.roundedRect(15, yPosition - 5, 180, 15, 3, 3, 'F');
        } else {
          pdf.rect(15, yPosition - 5, 180, 15, 'F');
        }
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PRODUKT-LISTE', 20, yPosition + 5);
        
        pdf.setTextColor(0, 0, 0);
        yPosition += 20;

        // Tabellen-Header im Stil der Sidebar-Elemente (Dunkelblau, abgerundet oben)
        await checkPageBreak(15);
        pdf.setFillColor(14, 30, 52); // #0e1e34
        if (pdf.roundedRect) {
          pdf.roundedRect(15, yPosition - 3, 180, 12, 3, 3, 'F');
        } else {
          pdf.rect(15, yPosition - 3, 180, 12, 'F');
        }
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        // Neue Spalten: Anzahl | Produkt (+VE klein) | Benötigte Menge | Preis
        pdf.text('Anzahl', 20, yPosition + 3);
        pdf.text('Produkt', 45, yPosition + 3);
        pdf.text('Benötigte Menge', 120, yPosition + 3);
        pdf.text('Preis', 170, yPosition + 3);
        
        pdf.setTextColor(0, 0, 0);
        yPosition += 15;

        // Tabellen-Inhalt mit alternierenden Zeilen
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        let totalPrice = 0;
        let rowCount = 0;

        for (const [productKey, quantity] of Object.entries(parts)) {
          console.log('Processing product:', productKey, 'quantity:', quantity);
          if (quantity > 0) {
            console.log('Adding to PDF:', productKey, 'quantity:', quantity);
            await checkPageBreak(12);

            // Alternierende Zeilen-Hintergründe
            if (rowCount % 2 === 1) {
              pdf.setFillColor(245, 245, 245); // #f5f5f5 wie Sidebar-Panels
              pdf.rect(15, yPosition - 2, 180, 10, 'F');
            }

            const productName = PRODUCT_NAME_MAP[productKey] || productKey.replace(/_/g, ' ');
            const ve = VE[productKey] || 1;
            const packsNeeded = Math.ceil(quantity / ve);
            const pricePerPack = getPackPriceForQuantity(productKey, quantity);
            const totalForProduct = packsNeeded * pricePerPack;
            totalPrice += totalForProduct;

            // Spalte 1: Anzahl (z.B. 1x, 2x)
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${packsNeeded}x`, 22, yPosition + 2, { align: 'left' });

            // Spalte 2: Produktname + kleine VE darunter (grau)
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text(productName, 45, yPosition + 1);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(128, 128, 128);
            pdf.text(`${ve} Stück`, 45, yPosition + 6);
            pdf.setTextColor(0, 0, 0);

            // Spalte 3: benötigte Menge (wie bisher Menge)
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.text(`${quantity}`, 140, yPosition + 2, { align: 'right' });

            // Spalte 4: Preis (Gesamtpreis für diese Position)
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${totalForProduct.toFixed(2)} €`, 190, yPosition + 2, { align: 'right' });

            yPosition += 12;
            rowCount++;
          }
        }

        // Gesamt-Linie
        await checkPageBreak(15);
        pdf.setDrawColor(233, 236, 239); // #e9ecef Trennlinie wie UI
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
          orientation: config.orientation || 'horizontal',
          options: {
            erdungsband: config.erdungsband || false,
            ulicaModule: config.ulicaModule === true,
            includeModules: config.includeModules === true || config.incM === true
          }
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
        console.log('Config checkbox states:', {
          includeModules: config.includeModules,
          incM: config.incM,
          ulicaModule: config.ulicaModule
        });
        console.log('Config object keys:', Object.keys(config));
        console.log('Config ulicaModule value:', config.ulicaModule, 'type:', typeof config.ulicaModule);
        console.log('CalculationData options:', calculationData.options);

        // Module nur hinzufügen wenn Checkbox aktiviert ist
        if (!config.includeModules && !config.incM) {
          console.log('Deleting Solarmodul - both checkboxes false');
          delete parts.Solarmodul;
        }
        
        if (config.ulicaModule !== true) {
          console.log('Deleting UlicaSolarBlackJadeFlow - ulicaModule is not true');
          delete parts.UlicaSolarBlackJadeFlow;
        } else {
          console.log('Keeping UlicaSolarBlackJadeFlow - ulicaModule is true');
        }

        // Zusatzprodukte basierend auf Checkboxen
        if (!config.mc4) {
          console.log('Deleting MC4 - mc4 checkbox false');
          delete parts.MC4;
        }
        if (!config.cable) {
          console.log('Deleting Solarkabel - cable checkbox false');
          delete parts.Solarkabel;
        }
        if (!config.wood) {
          console.log('Deleting Holzunterleger - wood checkbox false');
          delete parts.Holzunterleger;
        }
        if (!config.quetschkabelschuhe) {
          console.log('Deleting Quetschkabelschuhe - quetschkabelschuhe checkbox false');
          delete parts.Quetschkabelschuhe;
        }

        // Erdungsband hinzufügen wenn aktiviert
        if (config.erdungsband) {
          // Verwende die SolarGrid-Instanz für Erdungsband-Berechnung
          parts.Erdungsband = this.solarGrid.calculateErdungsband();
        } else {
          delete parts.Erdungsband;
        }

        // Palettenlogik nachträglich anwenden, damit nachgelagerte Renderer/Preise profitieren
        try {
          const ulicaSelected = config.ulicaModule === true;
          const pieceKey = ulicaSelected ? 'UlicaSolarBlackJadeFlow' : 'Solarmodul';
          const palletKey = ulicaSelected ? 'UlicaSolarBlackJadeFlowPalette' : 'SolarmodulPalette';
          const count = Number(parts[pieceKey] || 0);
          if (count > 0) {
            const pallets = Math.floor(count / 36);
            const remainder = count % 36;
            if (pallets > 0) {
              parts[palletKey] = (parts[palletKey] || 0) + pallets * 36; // Stückbasis
            }
            parts[pieceKey] = remainder;
          }
        } catch (e) {}

        console.log('Final parts after processing:', parts);
        return parts;

      } catch (error) {
        console.error('Part calculation from snapshot failed:', error);
        return {};
      }
    }
    // Füge Produkttabelle zum PDF hinzu
    async addProductTable(pdf, config, yPosition, checkPageBreak) {
      // NEUES DESIGN: Produkttabelle mit Header – Stil der Sidebar
      await checkPageBreak(30);
      pdf.setFillColor(255, 177, 1); // #FFB101
      if (pdf.roundedRect) {
        pdf.roundedRect(15, yPosition - 5, 180, 15, 3, 3, 'F');
      } else {
        pdf.rect(15, yPosition - 5, 180, 15, 'F');
      }
      
      pdf.setTextColor(14, 30, 52); // Dark Text passend zur Sidebar
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

      // Tabellen-Header im Stil der Sidebar (Dunkelblau, abgerundet)
      await checkPageBreak(15);
      pdf.setFillColor(14, 30, 52); // #0e1e34
      if (pdf.roundedRect) {
        pdf.roundedRect(15, yPosition - 3, 180, 12, 3, 3, 'F');
      } else {
        pdf.rect(15, yPosition - 3, 180, 12, 'F');
      }
      
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

      for (const [productKey, needed] of Object.entries(parts)) {
        if (needed > 0) {
          await checkPageBreak(12);

          // Alternierende Zeilen-Hintergründe – Sidebar-Panel-Farbe
          if (rowCount % 2 === 1) {
            pdf.setFillColor(245, 245, 245); // #f5f5f5
            pdf.rect(15, yPosition - 2, 180, 10, 'F');
          }

          const ve = VE[productKey] || 1;
          const packs = Math.ceil(needed / ve);
          const pricePerPack = getPackPriceForQuantity(productKey, needed);
          const totalProductPrice = packs * pricePerPack;
          totalPrice += totalProductPrice;

          const productName = PRODUCT_NAME_MAP[productKey] || productKey.replace(/_/g, ' ');

          pdf.text(productName, 20, yPosition + 2);
          pdf.text(needed.toString(), 70, yPosition + 2);
          pdf.text(`${packs}×`, 100, yPosition + 2);
          pdf.text(`${pricePerPack.toFixed(2)} €`, 130, yPosition + 2);
          pdf.text(`${totalProductPrice.toFixed(2)} €`, 170, yPosition + 2);

          yPosition += 10;
          rowCount++;
        }
      }

      // Gesamt-Linie – dezente UI-Trennlinie
      await checkPageBreak(15);
      pdf.setDrawColor(233, 236, 239); // #e9ecef
      pdf.setLineWidth(1);
      pdf.line(15, yPosition, 195, yPosition);
      yPosition += 5;

      return yPosition;
    }

    // Füge "Produkte pro Modul" Informationen hinzu


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
        orientation: config.orientation,
        options: {
          erdungsband: config.erdungsband || false,
          ulicaModule: config.ulicaModule === true,
          includeModules: config.includeModules === true || config.incM === true
        }
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
      if (!config.includeModules && !config.incM) {
        console.log('Deleting Solarmodul - both includeModules and incM false');
        delete parts.Solarmodul;
      }
      
      // Entferne Ulica-Module wenn nicht ausgewählt
      if (config.ulicaModule !== true) {
        console.log('Deleting UlicaSolarBlackJadeFlow - ulicaModule is not true');
        delete parts.UlicaSolarBlackJadeFlow;
      } else {
        console.log('Keeping UlicaSolarBlackJadeFlow - ulicaModule is true');
      }
      
      // Füge optionale Komponenten nur hinzu wenn ausgewählt
      if (config.mc4) {
        const moduleCount = config.selection.flat().filter(v => v).length;
        parts.MC4_Stecker = Math.ceil(moduleCount / 30);
        console.log('Added MC4_Stecker:', parts.MC4_Stecker, 'for', moduleCount, 'modules');
      }
      
      if (config.cable) {
        parts.Solarkabel = 1;
        console.log('Added Solarkabel: 1');
      }
      
      if (config.wood) {
        parts.Holzunterleger = 1; // Pauschal 1x zur Gesamtbestellung
        console.log('Added Holzunterleger: 1');
      }

      return parts;
    }

    // Entfernt: processGroup war ungenutzt, alle Berechnungen laufen über Worker/Direct

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
        gridSize: /(\d+)\s*[x×]\s*(\d+)(?!\s*mal)/i,
        // "20 module" → Anzahl Module
        moduleCount: /(\d+)\s*modul[e]?[n]?/i,
        // Alternative Schreibweisen: "modulanzahl 18", "anzahl module 24"
        moduleCountAlt: /(?:modul\s*anzahl|modulanzahl|anzahl\s*modul(?:e|en)?|module\s*anzahl)\s*(\d+)/i,
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
        // "mit quetschkabelschuhe" oder "ohne quetschkabelschuhe"
        quetschkabelschuhe: /(?:mit|ohne)[\s-]*(?:quetschkabelschuhe|kabelschuhe)/i,
        // "3 reihen mit 5 modulen" oder "drei reihen 5 module" oder "20 module in 4 reihen" oder "3 mal 6 module"
        rowPattern: /(?:(\d+|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*(?:reihen?|zeilen?)\s*(?:mit|à|a)?\s*(\d+)\s*modul[e]?[n]?)|(?:(\d+)\s*modul[e]?[n]?\s*(?:in|auf)?\s*(\d+|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*(?:reihen?|zeilen?))|(?:(\d+)\s*mal\s*(\d+)\s*modul[e]?[n]?)/i,
        // Reine Reihenangabe: "reihen 3"
        rowsOnly: /(?:reihen?|zeilen?)\s*(\d+)/i,
        // "mit abstand" | "ohne abstand" | "1 reihe abstand" | "mit doppeltem abstand"
        spacing: /(?:(?:mit|ohne)\s*(?:doppelt\w*\s*)?(?:abstand|lücke))|(?:(\d+)\s*(?:reihen?|zeilen?)\s*(?:abstand|lücke))/i,
        // "kompakt" oder "mit lücken" für Grid-Syntax
        gridCompact: /(?:kompakt|ohne\s*lücken)/i,
        gridSpaced: /(?:mit\s*lücken|mit\s*abstand)/i,
        // Kombinierte Checkbox-Logik mit "und" Verknüpfungen
        checkboxCombination: /(?:^|\s)(?:mit|und)\s+(.+?)(?:\s+und\s+(.+?))*(?:\s*$)/i,
        // NEUE ACTION PATTERNS:
        // "Konfiguration speichern", "config speichern", "speichern", "save"
        saveConfig: /^(?:(?:konfiguration|konfig|config)\s*)?(?:speichern|save)$/i,
        // "Konfiguration löschen", "config löschen" (NICHT nur "löschen" oder "delete")
        deleteConfig: /^(?:(?:konfiguration|konfig|config)\s*)?(?:löschen|delete)$/i,
        // "module löschen" → Module-Auswahl löschen
        deleteModules: /^modul[e]?[n]?\s*löschen$/i,
        // NEU: "Neue Konfiguration" → aktuelle speichern und neue erstellen
        newConfig: /^(?:neu(?:e|en)?[\s-]*(?:konfiguration|konfig|config)(?:[\s-]*(?:erstellen|anlegen))?|(?:konfiguration|konfig|config)[\s-]*neu(?:e|en)?(?:[\s-]*(?:erstellen|anlegen))?|new[\s-]*(?:config|configuration))$/i,
        // NEU: "Alle Konfigurationen löschen" / "von vorne beginnen" → kompletter Reset
        deleteAllConfigs: /^(?:alle[\s-]*(?:konfigurationen|configs?|konfigs?)[\s-]*(?:löschen|entfernen)|(?:alles|alle)[\s-]*(?:löschen|zurücksetzen)|von[\s-]*(?:vorne|vorn)[\s-]*(?:beginnen|anfangen)|neu[\s-]*starten|start[\s-]*over|reset[\s-]*all)$/i,
        // "reset", "zurücksetzen" → Grid zurücksetzen
        resetGrid: /^(?:reset|zurücksetzen|zurücksetzen)$/i,
        // Intelligente Modul-Verteilung ("gleichmäßig" wird deprecated behandelt)
        distributionEqual: /(?:gleich[-\s]*m[aä]ßig|gleichmaessig|gleich|optimal)/i,
        distributionRows: /(?:in\s*reihen|reihenweise)/i,
        distributionColumns: /(?:in\s*spalten|spaltenweise)/i,
        distributionRandom: /(?:zuf[aä]llig|zufaellig|random)/i,
        // Erweiterte Abstand-Logik
        spacingDouble: /(?:doppelter|doppeltem)\s*abstand/i,
        spacingRowsOnly: /(?:nur\s*)?(?:zwischen\s*)?reihen/i,
        spacingColumnsOnly: /(?:nur\s*)?(?:zwischen\s*)?spalten/i,
        // Explizite Reihen-Selektion und Reihen-Lücken (1-basiert)
        selectRowsExplicit: /mit\s*modul\w*\s*in\s*(?:reihe|zeile)n?\s*([0-9\s,–—\-a-z]+)/i,
        gapRowsExplicit: /mit\s*l[üu]cken\s*in\s*(?:reihe|zeile)n?\s*([0-9\s,–—\-a-z]+)/i,
        // Explizite Spalten-Selektion und Spalten-Lücken (1-basiert)
        selectColumnsExplicit: /mit\s*modul\w*\s*in\s*(?:spalte|spalten)\s*([0-9\s,–—\-a-z]+)/i,
        gapColumnsExplicit: /mit\s*l[üu]cken\s*in\s*(?:spalte|spalten)\s*([0-9\s,–—\-a-z]+)/i,
        // Alle Reihen/Spalten außer ... (1-basiert, erlaubt Bereiche)
        allRowsExcept: /alle\s*(?:reihen|zeilen)\s*(?:außer|ausser)\s*([0-9\s,–—\-a-z]+)/i,
        allColumnsExcept: /alle\s*spalten\s*(?:außer|ausser)\s*([0-9\s,–—\-a-z]+)/i,
        // Neue präzise Befehle
        clearTopRow: /\b(?:oberste|oberer)\s*reihe\s*leer\b/i,
        clearBottomRow: /\b(?:unterste|unterer)\s*reihe\s*leer\b/i,
        fillFirstNColumns: /\berst(?:e|en|er)?\s*(\d+|ein|eine|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)?\s*spalten?\s*f[üu]llen\b/i,
        clearFirstNColumns: /\berst(?:e|en|er)?\s*(\d+|ein|eine|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)?\s*spalten?\s*leer\b/i,
        clearLastNColumns: /\bletzte[nr]?\s*(\d+|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)?\s*spalten?\s*leer\b/i,
        // Reihen füllen/leeren (erste/letzte N)
        fillFirstNRows: /\berst(?:e|en|er)?\s*(\d+|ein|eine|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)?\s*reihen?\s*f[üu]llen\b/i,
        clearFirstNRows: /\berst(?:e|en|er)?\s*(\d+|ein|eine|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)?\s*reihen?\s*leer\b/i,
        fillLastNRows: /\bletzte[nr]?\s*(\d+|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)?\s*reihen?\s*f[üu]llen\b/i,
        clearLastNRows: /\bletzte[nr]?\s*(\d+|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)?\s*reihen?\s*leer\b/i,
        fillOnlyFrame: /\bnur\s*rand\s*f[üu]llen\b/i,
        fillBlock: /\bblock\s*(\d+)\s*[x×]\s*(\d+)\s*ab\s*reihe\s*(\d+)\s*,?\s*spalte\s*(\d+)\b/i,
        fillBlockRelative: /\bblock\s*(\d+)\s*[x×]\s*(\d+)\s*ab\s*reihe\s*von\s*unten\s*(\d+)\s*,?\s*spalte\s*von\s*rechts\s*(\d+)\b/i,
        // Kombinierte Checkbox-Syntax
        checkboxAllExcept: /(?:alles\s*außer|alle\s*außer)/i,
        checkboxOnly: /(?:nur|only)/i,
        checkboxWithout: /(?:ohne\s*zubehör|ohne\s*extras)/i,
        checkboxWithAll: /(?:mit\s*allem|alles\s*mit)/i,
        // Einfaches "alles" aktiviert alle Zusatzprodukte und Module
        allSimple: /^(?:alles)$/i,
        // Speichern mit Namen
        saveWithName: /(?:speichern\s*als\s*['"]?([^'"]+)['"]?)/i,
        // Ulica Modul Auswahl (500/450 W) inkl. Synonyme
        ulicaModule: /ulica(?:\s*(500|450)\s*w?)?|black\s*jade(?:[-\s]*flow)?\s*(500|450)?/i,
        // NEU: "hinzufügen"-Befehle
        addModulesWatt: /\b(450|500)\s*(?:watt|w)\s*modul(?:e|en)?\s*hinzuf(?:ügen|uegen)\b/i,
        addComponents: /\b(?:mc4|kabel|holz|quetschkabelschuhe|erdungsband)(?:\s*(?:,|und)\s*(?:mc4|kabel|holz|quetschkabelschuhe|erdungsband))*\s*hinzuf(?:ügen|uegen)\b/i
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
        wood: null,
        quetschkabelschuhe: null
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
        
        // Prüfe auf Quetschkabelschuhe
        if (/\b(?:quetschkabelschuhe|kabelschuhe)\b/.test(trimmedPart)) {
          if (/\bohne[\s-]+(?:quetschkabelschuhe|kabelschuhe)\b/.test(trimmedPart) || /\bohne[\s-]+(?:quetschkabelschuhe|kabelschuhe)\b/.test(input.toLowerCase())) {
            checkboxes.quetschkabelschuhe = false;
          } else {
            checkboxes.quetschkabelschuhe = true;
          }
        }
      }

      return checkboxes;
    }
    parseInput(input) {
      // NEU (Testmodus, Schritt 1): Unterstütze ausschließlich Grid-Größe wie "5x5"
      try {
        const m = input.match(this.patterns.gridSize);
        if (m) {
          const cols = parseInt(m[1], 10);
          const rows = parseInt(m[2], 10);
          return { cols, rows, forceClearSelection: true };
        }
        return {};
      } catch (e) {
        console.error('SmartConfig parseInput error (test step 1):', e);
        return {};
      }
      const config = {};
      
      try {

      // Grid-Größe parsen
      const gridMatch = input.match(this.patterns.gridSize);
      if (gridMatch) {
        config.cols = parseInt(gridMatch[1]);
        config.rows = parseInt(gridMatch[2]);
        
        // Prüfe auf Abstand auch bei Grid-Größen-Angaben
        const spacingMatch = input.match(this.patterns.spacing);
        const spacingDoubleMatch = input.match(this.patterns.spacingDouble);
        let spacingRows = 0;
        
        if (spacingMatch) {
          if (spacingDoubleMatch) {
            spacingRows = 2;
          } else if (spacingMatch[0].toLowerCase().includes('mit') && !spacingMatch[1]) {
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
        
        // Prüfe auf Grid-Syntax-Modifikatoren (kompakt/with lücken)
        const gridCompactMatch = input.match(this.patterns.gridCompact);
        const gridSpacedMatch = input.match(this.patterns.gridSpaced);
        
        if (gridCompactMatch) {
          config.gridCompact = true; // Keine Abstände
        } else if (gridSpacedMatch) {
          config.gridSpaced = true; // Mit Abständen
        }
      }

      // Reihen-Pattern parsen (hat Priorität vor einfacher moduleCount)
      const rowMatch = input.match(this.patterns.rowPattern);
      
      // Separate Abstand-Anpassung nur wenn KEINE anderen Patterns gefunden wurden
      // (z.B. nur "mit abstand" ohne Grid-Größe oder Module-Anzahl)
      const hasOtherPatterns = gridMatch || rowMatch || input.match(this.patterns.moduleCount);
      
      if (!hasOtherPatterns) {
        const spacingOnlyMatch = input.match(this.patterns.spacing);
        const spacingDoubleOnlyMatch = input.match(this.patterns.spacingDouble);
        if (spacingOnlyMatch) {
          let spacingRows = 0;
          
          if (spacingDoubleOnlyMatch) {
            spacingRows = 2; // "mit doppeltem abstand"
          } else if (spacingOnlyMatch[0].toLowerCase().includes('ohne')) {
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
        } else if (rowMatch[5] && rowMatch[6]) {
          // "3 mal 6 module" Format
          numRows = parseInt(rowMatch[5]);
          modulesPerRow = parseInt(rowMatch[6]);
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
      
      // Intelligente Modul-Verteilung parsen
      const distributionEqualMatch = input.match(this.patterns.distributionEqual);
      const distributionRowsMatch = input.match(this.patterns.distributionRows);
      const distributionColumnsMatch = input.match(this.patterns.distributionColumns);
      const distributionRandomMatch = input.match(this.patterns.distributionRandom);
      
      if (distributionEqualMatch) {
        // Deprecatet: "gleichmäßig" führt nicht mehr zu Auto-Verteilung
        // Stattdessen: Nutzerhinweis und Auto-Selection unterdrücken
        config.suppressAutoSelection = true;
        config.deprecatedNotice = 'distributionEqual';
      } else if (distributionRowsMatch) {
        config.distribution = 'rows';
      } else if (distributionColumnsMatch) {
        config.distribution = 'columns';
      } else if (distributionRandomMatch) {
        // Deprecatet: "zufällig" führt nicht mehr zu Auto-Verteilung
        config.suppressAutoSelection = true;
        config.deprecatedNotice = 'distributionRandom';
      }
      
      // Module-Anzahl parsen (nur wenn keine Reihen-Konfiguration)
      if (!rowMatch) {
        let moduleMatch = input.match(this.patterns.moduleCount);
        if (!moduleMatch) {
          const moduleAlt = input.match(this.patterns.moduleCountAlt);
          if (moduleAlt) {
            moduleMatch = [, moduleAlt[1], moduleAlt[1]]; // Dummy to enter branch
            config.moduleCount = parseInt(moduleAlt[1]);
          }
        }
        if (moduleMatch) {
          if (!config.moduleCount) config.moduleCount = parseInt(moduleMatch[1]);
          
          // Prüfe auf Abstand auch bei einfacher Module-Anzahl
          const spacingMatch = input.match(this.patterns.spacing);
          const spacingDoubleMatch = input.match(this.patterns.spacingDouble);
          const spacingRowsOnlyMatch = input.match(this.patterns.spacingRowsOnly);
          const spacingColumnsOnlyMatch = input.match(this.patterns.spacingColumnsOnly);
          let spacingRows = 0;
          
          if (spacingDoubleMatch) {
            spacingRows = 2; // Doppelter Abstand
          } else if (spacingRowsOnlyMatch) {
            spacingRows = 1; // Nur zwischen Reihen
            config.spacingRowsOnly = true;
          } else if (spacingColumnsOnlyMatch) {
            spacingRows = 1; // Nur zwischen Spalten
            config.spacingColumnsOnly = true;
          } else if (spacingMatch) {
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

      // Reine Reihenangabe mit bekannter Modulanzahl → automatische rowConfig
      const rowsOnlyMatch = input.match(this.patterns.rowsOnly);
      if (!config.rowConfig && rowsOnlyMatch && config.moduleCount) {
        const numRows = parseInt(rowsOnlyMatch[1], 10);
        if (Number.isInteger(numRows) && numRows > 0) {
          const modulesPerRow = Math.ceil(config.moduleCount / numRows);
          config.rowConfig = { rows: numRows, modulesPerRow, spacing: 0, totalModules: config.moduleCount };
          config.intelligentDistribution = {
            totalModules: config.moduleCount,
            numRows,
            baseModulesPerRow: Math.floor(config.moduleCount / numRows),
            extraModules: config.moduleCount % numRows
          };
          // Passen Grid-Abmessungen an
          config.rows = numRows;
          config.cols = Math.max(this.solarGrid?.cols || 0, modulesPerRow);
        }
      }

      // Rahmen außen leeren
      if (/\b(?:rahmen|rand)\s*(?:außen|aussen)\s*leer\b/i.test(input)) {
        config.clearFrame = true;
      }

      // Innenbereich: reihen R und spalten S füllen
      const insideAreaMatch = input.match(/\b(?:innen(?:bereich)?)\s*(?:reihe[n]?\s*([0-9\s,–—\-a-z]+))\s*(?:und|,)?\s*spalte[n]?\s*([0-9\s,–—\-a-z]+)/i);
      if (insideAreaMatch) {
        const parseRangeList = (str) => {
          const normalized = (str || '')
            .replace(/[–—]/g, '-')
            .replace(/\bund\b/gi, ',')
            .replace(/\bbis\b/gi, '-');
          const tokens = normalized.split(',').map(s => s.trim()).filter(Boolean);
          const out = [];
          for (const t of tokens) {
            const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
            if (m) {
              let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
              if (Number.isInteger(a) && Number.isInteger(b)) {
                const start = Math.min(a, b), end = Math.max(a, b);
                for (let n = start; n <= end; n++) out.push(n);
              }
            } else {
              const n = parseInt(t, 10);
              if (Number.isInteger(n) && n > 0) out.push(n);
            }
          }
          return Array.from(new Set(out));
        };
        config.selectAreaRows = parseRangeList(insideAreaMatch[1]);
        config.selectAreaCols = parseRangeList(insideAreaMatch[2]);
      }

      // Hälften: linke/rechte Hälfte
      if (/\blink[e]?\s*h[aä]lfte\s*f[üu]llen\b/i.test(input)) {
        config.fillLeftHalf = true;
      }
      if (/\brecht[e]?\s*h[aä]lfte\s*leer\b/i.test(input)) {
        config.clearRightHalf = true;
      }

      // Jede zweite Reihe füllen, optionaler Start
      const everySecondMatch = input.match(/\bjede\s*zweite\s*reihe\s*f[üu]llen(?:.*?start\s*bei\s*(\d+))?/i);
      if (everySecondMatch) {
        const start = parseInt(everySecondMatch[1] || '1', 10);
        config.everySecondRowsStart = Number.isInteger(start) && start > 0 ? start : 1;
      }

      // Orientierung parsen (nur wenn explizit erwähnt)
      const orientationMatch = input.match(this.patterns.orientation);
      if (orientationMatch) {
        config.orientation = orientationMatch[0].toLowerCase().includes('vertikal') || 
                            orientationMatch[0].toLowerCase().includes('vertical') ? 'vertical' : 'horizontal';
      }

      // Erweiterte Checkbox-Syntax parsen
      const checkboxAllExceptMatch = input.match(this.patterns.checkboxAllExcept);
      const checkboxOnlyMatch = input.match(this.patterns.checkboxOnly);
      const checkboxWithoutMatch = input.match(this.patterns.checkboxWithout);
      const checkboxWithAllMatch = input.match(this.patterns.checkboxWithAll);
      
      if (checkboxAllExceptMatch) {
        // "alles außer holz" → Alle außer das spezifische Wort
        const exceptWord = input.toLowerCase().match(/(?:alles\s*außer|alle\s*außer)\s+(\w+)/);
        if (exceptWord) {
          const exceptItem = exceptWord[1];
          config.includeModules = exceptItem !== 'module' && exceptItem !== 'modulen';
          config.mc4 = exceptItem !== 'mc4';
          config.cable = exceptItem !== 'kabel' && exceptItem !== 'solarkabel';
          config.wood = exceptItem !== 'holz' && exceptItem !== 'holzunterleger';
          config.quetschkabelschuhe = exceptItem !== 'quetschkabelschuhe' && exceptItem !== 'kabelschuhe';
        }
      } else if (checkboxOnlyMatch) {
        // "nur module und mc4" → Nur die spezifischen Items
        const onlyItems = input.toLowerCase().match(/(?:nur|only)\s+(.+?)(?:\s+und\s+(.+?))*(?:\s*$)/);
        if (onlyItems) {
          const items = [onlyItems[1], onlyItems[2]].filter(Boolean);
          config.includeModules = items.some(item => item.includes('module'));
          config.mc4 = items.some(item => item.includes('mc4'));
          config.cable = items.some(item => item.includes('kabel') || item.includes('solarkabel'));
          config.wood = items.some(item => item.includes('holz'));
          config.quetschkabelschuhe = items.some(item => item.includes('quetschkabelschuhe') || item.includes('kabelschuhe'));
        }
      } else if (checkboxWithoutMatch) {
        // "ohne zubehör" → Nur Module
        config.includeModules = true;
        config.mc4 = false;
        config.cable = false;
        config.wood = false;
        config.quetschkabelschuhe = false;
      } else if (checkboxWithAllMatch) {
        // "mit allem" → Alle aktivieren
        config.includeModules = true;
        config.mc4 = true;
        config.cable = true;
        config.wood = true;
        config.quetschkabelschuhe = true;
        config.erdungsband = true;
      } else if (input.match(this.patterns.allSimple)) {
        // "alles" → wie "mit allem"
        config.includeModules = true;
        config.mc4 = true;
        config.cable = true;
        config.wood = true;
        config.quetschkabelschuhe = true;
        config.erdungsband = true;
      } else {
        // Checkbox-Kombinationen parsen (hat Priorität vor einzelnen Patterns)
        const checkboxCombinations = this.parseCheckboxCombinations(input);
        let hasCheckboxCombinations = Object.values(checkboxCombinations).some(value => value !== null);

        if (hasCheckboxCombinations) {
          // Setze nur die Werte, die explizit erkannt wurden (nicht null)
          if (checkboxCombinations.modules !== null) config.includeModules = checkboxCombinations.modules;
          if (checkboxCombinations.mc4 !== null) config.mc4 = checkboxCombinations.mc4;
          if (checkboxCombinations.cable !== null) config.cable = checkboxCombinations.cable;
          if (checkboxCombinations.wood !== null) config.wood = checkboxCombinations.wood;
          if (checkboxCombinations.quetschkabelschuhe !== null) config.quetschkabelschuhe = checkboxCombinations.quetschkabelschuhe;
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

          const quetschkabelschuheMatch = input.match(this.patterns.quetschkabelschuhe);
          if (quetschkabelschuheMatch) {
            config.quetschkabelschuhe = quetschkabelschuheMatch[0].toLowerCase().includes('mit');
          }
        }
      }

      // Ulica Modul Parsing (setzt spez. Modul + Checkbox)
      const ulicaMatch = input.match(this.patterns.ulicaModule);
      if (ulicaMatch) {
        config.ulicaModule = true;
        const watt = (ulicaMatch[1] || ulicaMatch[2] || '').toString();
        if (watt === '450') {
          config.selectedModule = 'ulica-450';
        } else if (watt === '500') {
          config.selectedModule = 'ulica-500';
        } else {
          // Default auf 500, wenn nicht eindeutig
          config.selectedModule = 'ulica-500';
        }
        // Ulica schließt allgemeine Module aus
        config.includeModules = false;
      }

      // NEU: "450/500 W module hinzufügen"
      const addModulesWatt = input.match(this.patterns.addModulesWatt);
      if (addModulesWatt) {
        const watt = addModulesWatt[1];
        config.ulicaModule = true;
        config.selectedModule = watt === '450' ? 'ulica-450' : 'ulica-500';
        // Exklusivität: keine allgemeinen Module
        config.includeModules = false;
      }

      // NEU: "mc4 und holz hinzufügen" (Liste erlaubt)
      const addComponents = input.match(this.patterns.addComponents);
      if (addComponents) {
        const list = input
          .toLowerCase()
          .match(/(?:mc4|kabel|holz|quetschkabelschuhe|erdungsband)/g);
        if (list) {
          if (list.includes('mc4')) config.mc4 = true;
          if (list.includes('kabel')) config.cable = true;
          if (list.includes('holz')) config.wood = true;
          if (list.includes('quetschkabelschuhe')) config.quetschkabelschuhe = true;
          if (list.includes('erdungsband')) config.erdungsband = true;
        }
      }

      // NEUE ACTION PATTERNS PRÜFEN (höchste Priorität - vor allen anderen Patterns)
      const saveWithNameMatch = input.match(this.patterns.saveWithName);
      if (saveWithNameMatch) {
        config.action = 'saveConfig';
        config.configName = saveWithNameMatch[1];
        return config;
      }
      
      const saveConfigMatch = input.match(this.patterns.saveConfig);
      if (saveConfigMatch) {
        config.action = 'saveConfig';
        return config;
      }
      
      // NEU: Neue Konfiguration erstellen (aktuelle wird automatisch gespeichert)
      const newConfigMatch = input.match(this.patterns.newConfig);
      if (newConfigMatch) {
        config.action = 'newConfig';
        return config;
      }
      
      // NEU: Alle Konfigurationen löschen / Von vorne beginnen
      const deleteAllConfigsMatch = input.match(this.patterns.deleteAllConfigs);
      if (deleteAllConfigsMatch) {
        config.action = 'resetAllConfigs';
        return config;
      }
      // Alle Reihen/Spalten außer ... → erzeugt vollständige Liste minus Ausnahmen
      const allRowsExceptMatch = input.match(this.patterns.allRowsExcept);
      if (allRowsExceptMatch) {
        const maxRows = this.solarGrid.rows;
        const base = Array.from({ length: maxRows }, (_, i) => i + 1);
        const str = allRowsExceptMatch[1] || '';
        const normalized = str
          .replace(/[–—]/g, '-')
          .replace(/\bund\b/gi, ',')
          .replace(/\bbis\b/gi, '-');
        const tokens = normalized.split(',').map(s => s.trim()).filter(Boolean);
        const except = new Set();
        for (const t of tokens) {
          const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
          if (m) {
            let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
            if (Number.isInteger(a) && Number.isInteger(b)) {
              const start = Math.min(a, b);
              const end = Math.max(a, b);
              for (let n = start; n <= end; n++) except.add(n);
            }
          } else {
            const n = parseInt(t, 10);
            if (Number.isInteger(n) && n > 0) except.add(n);
          }
        }
        const result = base.filter(n => !except.has(n));
        if (result.length > 0) config.selectRows = result;
      }
      const allColumnsExceptMatch = input.match(this.patterns.allColumnsExcept);
      if (allColumnsExceptMatch) {
        const maxCols = this.solarGrid.cols;
        const base = Array.from({ length: maxCols }, (_, i) => i + 1);
        const str = allColumnsExceptMatch[1] || '';
        const normalized = str
          .replace(/[–—]/g, '-')
          .replace(/\bund\b/gi, ',')
          .replace(/\bbis\b/gi, '-');
        const tokens = normalized.split(',').map(s => s.trim()).filter(Boolean);
        const except = new Set();
        for (const t of tokens) {
          const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
          if (m) {
            let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
            if (Number.isInteger(a) && Number.isInteger(b)) {
              const start = Math.min(a, b);
              const end = Math.max(a, b);
              for (let n = start; n <= end; n++) except.add(n);
            }
          } else {
            const n = parseInt(t, 10);
            if (Number.isInteger(n) && n > 0) except.add(n);
          }
        }
        const result = base.filter(n => !except.has(n));
        if (result.length > 0) config.selectColumns = result;
      }
      
      // Explizite Reihen-Selektion / Lücken (1-basiert)
      const selectRowsMatch = input.match(this.patterns.selectRowsExplicit);
      if (selectRowsMatch) {
        const rowsString = selectRowsMatch[1] || '';
        const normalized = rowsString
          .replace(/[–—]/g, '-')
          .replace(/\bund\b/gi, ',')
          .replace(/\bbis\b/gi, '-');
        const tokens = normalized.split(',').map(s => s.trim()).filter(Boolean);
        const numbers = [];
        for (const t of tokens) {
          const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
          if (m) {
            let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
            if (Number.isInteger(a) && Number.isInteger(b)) {
              const start = Math.min(a, b);
              const end = Math.max(a, b);
              for (let n = start; n <= end; n++) numbers.push(n);
            }
          } else {
            const n = parseInt(t, 10);
            if (Number.isInteger(n) && n > 0) numbers.push(n);
          }
        }
        if (numbers.length > 0) {
          config.selectRows = Array.from(new Set(numbers));
        }
      }
      const gapRowsMatch = input.match(this.patterns.gapRowsExplicit);
      if (gapRowsMatch) {
        const rowsString = gapRowsMatch[1] || '';
        const normalized = rowsString
          .replace(/[–—]/g, '-')
          .replace(/\bund\b/gi, ',')
          .replace(/\bbis\b/gi, '-');
        const tokens = normalized.split(',').map(s => s.trim()).filter(Boolean);
        const numbers = [];
        for (const t of tokens) {
          const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
          if (m) {
            let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
            if (Number.isInteger(a) && Number.isInteger(b)) {
              const start = Math.min(a, b);
              const end = Math.max(a, b);
              for (let n = start; n <= end; n++) numbers.push(n);
            }
          } else {
            const n = parseInt(t, 10);
            if (Number.isInteger(n) && n > 0) numbers.push(n);
          }
        }
        if (numbers.length > 0) {
          config.gapRows = Array.from(new Set(numbers));
        }
      }
      // Explizite Spalten-Selektion / Lücken (1-basiert)
      const selectColsMatch = input.match(this.patterns.selectColumnsExplicit);
      if (selectColsMatch) {
        const colsString = selectColsMatch[1] || '';
        const normalized = colsString
          .replace(/[–—]/g, '-')
          .replace(/\bund\b/gi, ',')
          .replace(/\bbis\b/gi, '-');
        const tokens = normalized.split(',').map(s => s.trim()).filter(Boolean);
        const numbers = [];
        for (const t of tokens) {
          const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
          if (m) {
            let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
            if (Number.isInteger(a) && Number.isInteger(b)) {
              const start = Math.min(a, b);
              const end = Math.max(a, b);
              for (let n = start; n <= end; n++) numbers.push(n);
            }
          } else {
            const n = parseInt(t, 10);
            if (Number.isInteger(n) && n > 0) numbers.push(n);
          }
        }
        if (numbers.length > 0) {
          config.selectColumns = Array.from(new Set(numbers));
        }
      }
      const gapColsMatch = input.match(this.patterns.gapColumnsExplicit);
      if (gapColsMatch) {
        const colsString = gapColsMatch[1] || '';
        const normalized = colsString
          .replace(/[–—]/g, '-')
          .replace(/\bund\b/gi, ',')
          .replace(/\bbis\b/gi, '-');
        const tokens = normalized.split(',').map(s => s.trim()).filter(Boolean);
        const numbers = [];
        for (const t of tokens) {
          const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
          if (m) {
            let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
            if (Number.isInteger(a) && Number.isInteger(b)) {
              const start = Math.min(a, b);
              const end = Math.max(a, b);
              for (let n = start; n <= end; n++) numbers.push(n);
            }
          } else {
            const n = parseInt(t, 10);
            if (Number.isInteger(n) && n > 0) numbers.push(n);
          }
        }
        if (numbers.length > 0) {
          config.gapColumns = Array.from(new Set(numbers));
        }
      }
      
      // Neue präzise Befehle parsen
      if (this.patterns.clearTopRow.test(input)) config.clearTopRow = true;
      if (this.patterns.clearBottomRow.test(input)) config.clearBottomRow = true;
      const fillFirstN = input.match(this.patterns.fillFirstNColumns);
      if (fillFirstN) config.fillFirstNColumns = this.parseWordNumber(fillFirstN[1] || '1');
      const clearFirstN = input.match(this.patterns.clearFirstNColumns);
      if (clearFirstN) config.clearFirstNColumns = this.parseWordNumber(clearFirstN[1] || '1');
      const clearLastN = input.match(this.patterns.clearLastNColumns);
      if (clearLastN) config.clearLastNColumns = parseInt(clearLastN[1] || '1', 10);
      if (this.patterns.fillOnlyFrame.test(input)) config.fillOnlyFrame = true;
      const blockMatch = input.match(this.patterns.fillBlock);
      if (blockMatch) {
        config.fillBlock = {
          height: this.parseWordNumber(blockMatch[1]),
          width: this.parseWordNumber(blockMatch[2]),
          startRow: this.parseWordNumber(blockMatch[3]),
          startCol: this.parseWordNumber(blockMatch[4])
        };
      }
      const blockRel = input.match(this.patterns.fillBlockRelative);
      if (blockRel) {
        config.fillBlockRelative = {
          height: this.parseWordNumber(blockRel[1]),
          width: this.parseWordNumber(blockRel[2]),
          fromBottom: this.parseWordNumber(blockRel[3]),
          fromRight: this.parseWordNumber(blockRel[4])
        };
      }
      // Reihen erste/letzte N füllen/leer
      const fillFirstRows = input.match(this.patterns.fillFirstNRows);
      if (fillFirstRows) config.fillFirstNRows = this.parseWordNumber(fillFirstRows[1] || '1');
      const clearFirstRows = input.match(this.patterns.clearFirstNRows);
      if (clearFirstRows) config.clearFirstNRows = this.parseWordNumber(clearFirstRows[1] || '1');
      const fillLastRows = input.match(this.patterns.fillLastNRows);
      if (fillLastRows) config.fillLastNRows = this.parseWordNumber((fillLastRows[1] || '1'));
      const clearLastRows = input.match(this.patterns.clearLastNRows);
      if (clearLastRows) config.clearLastNRows = this.parseWordNumber((clearLastRows[1] || '1'));
      
      // KURZE EINGABEN: Verwende aktuelles Grid als Basis
      const isShortInput = input.length < 20 && !input.match(/\d/);
      if (isShortInput) {
        // Setze aktuelle Grid-Größe als Basis
        config.cols = this.solarGrid.cols;
        config.rows = this.solarGrid.rows;
        config.useCurrentGrid = true;
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
      } catch (error) {
        console.error('Error parsing input:', input, error);
        return {};
      }
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
        // Wenn explizit gefordert: Auswahl vollständig zurücksetzen
        if (config.forceClearSelection === true) {
          this.solarGrid.selection = Array.from({ length: this.solarGrid.rows }, () =>
            Array.from({ length: this.solarGrid.cols }, () => false)
          );
        }
      }

      // Orientierung setzen (nur wenn angegeben)
      if (config.orientation) {
        if (this.solarGrid.orV) this.solarGrid.orV.checked = config.orientation === 'vertical';
        if (this.solarGrid.orH) this.solarGrid.orH.checked = config.orientation === 'horizontal';
        
        // Synchronisiere mit den Orientation Buttons
        const orientHBtn = document.getElementById('orient-h');
        const orientVBtn = document.getElementById('orient-v');
        if (orientHBtn && orientVBtn) {
          orientHBtn.classList.toggle('active', config.orientation === 'horizontal');
          orientVBtn.classList.toggle('active', config.orientation === 'vertical');
        }
      }

      // NEUE ACTION PATTERNS HANDHABEN (höchste Priorität)
      if (config.action) {
        this.handleAction(config.action, config);
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
      if (config.hasOwnProperty('quetschkabelschuhe')) {
        if (this.solarGrid.quetschkabelschuhe) this.solarGrid.quetschkabelschuhe.checked = config.quetschkabelschuhe;
      }
      if (config.hasOwnProperty('ulicaModule')) {
        if (this.solarGrid.ulicaModule) this.solarGrid.ulicaModule.checked = config.ulicaModule === true;
        // Exklusivität sicherstellen: Ulica aktiv => include-modules aus
        if (config.ulicaModule === true && this.solarGrid.incM) {
          this.solarGrid.incM.checked = false;
        }
      }

      // Spezifische Modulauswahl anwenden (z.B. Ulica 500/450)
      if (config.selectedModule && this.solarGrid.moduleSelect) {
        this.solarGrid.moduleSelect.value = config.selectedModule;
        // Triggert Breite/Höhe und Checkbox-Clear gemäß bestehender Logik
        this.solarGrid.handleModuleSelectChange();
      }

      // Checkbox-Änderungen global auf alle Konfigurationen anwenden
      // (sichert konsistentes Verhalten über alle Configs)
      this.solarGrid.updateAllConfigurationsForCheckboxes();

      // INTELLIGENTE Selection-Matrix-Erstellung
      // NUR bei Grid-Größen-Änderung → Selection anpassen/löschen
      // Bei reinen Checkbox-Änderungen → Selection beibehalten
      const gridSizeChanged = (config.cols && config.cols !== oldCols) || 
                             (config.rows && config.rows !== oldRows);
      
      // Prüfe, ob explizite Selektions-Operationen angefragt sind
      const hasExplicitOps = (
        config.selectRows || config.gapRows || config.selectColumns || config.gapColumns ||
        (config.selectAreaRows && config.selectAreaCols) || config.fillOnlyFrame || config.clearFrame ||
        config.fillLeftHalf || config.clearRightHalf || config.everySecondRowsStart ||
        config.clearTopRow || config.clearBottomRow || config.fillFirstNColumns || config.clearFirstNColumns ||
        config.clearLastNColumns || config.fillFirstNRows || config.clearFirstNRows ||
        config.fillLastNRows || config.clearLastNRows || config.fillBlock || config.fillBlockRelative
      );
      
      let newSelection;
      if (gridSizeChanged) {
        // Grid-Größe geändert: Leere Matrix, wenn automatische oder explizite Selektion folgt
        if (config.moduleCount || config.rowConfig || hasExplicitOps) {
          newSelection = Array.from({ length: this.solarGrid.rows }, () =>
            Array.from({ length: this.solarGrid.cols }, () => false)
          );
        } else {
          // Nur Grid-Größe ohne weitere Selektion: Behalte was möglich ist
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
      // Führe Reihen-Konfiguration falls vorhanden zuerst aus
      if (config.rowConfig) {
        this.applyRowConfiguration(config.rowConfig, config.intelligentDistribution);
      }
      // Explizite Reihen-/Spalten-Selektion und Layout-Operationen additiv anwenden
      if (config.selectRows || config.gapRows || config.selectColumns || config.gapColumns || config.clearFrame || (config.selectAreaRows && config.selectAreaCols) || config.fillLeftHalf || config.clearRightHalf || config.everySecondRowsStart || config.clearTopRow || config.clearBottomRow || config.fillFirstNColumns || config.clearFirstNColumns || config.clearLastNColumns || config.fillFirstNRows || config.clearFirstNRows || config.fillLastNRows || config.clearLastNRows || config.fillOnlyFrame || config.fillBlock || config.fillBlockRelative) {
        // Falls Grid zuvor geändert wurde: Auswahl bereits leer bzw. erhalten je nach Logik
        // Wir arbeiten auf aktueller Selection weiter (additiv, außer Grid-Change)
        const maxRows = this.solarGrid.rows;
        const maxCols = this.solarGrid.cols;
        const ensureRow = (y) => {
          if (!this.solarGrid.selection[y]) {
            this.solarGrid.selection[y] = Array.from({ length: maxCols }, () => false);
          }
        };
        // Rahmen außen leeren
        if (config.clearFrame) {
          for (let y = 0; y < maxRows; y++) {
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) {
              if (y === 0 || y === maxRows - 1 || x === 0 || x === maxCols - 1) {
                this.solarGrid.selection[y][x] = false;
              }
            }
          }
        }
        // Selektiere Reihen
        if (Array.isArray(config.selectRows)) {
          for (const row1Based of config.selectRows) {
            const y = row1Based - 1; // 1-basiert → 0-basiert
            if (y < 0 || y >= maxRows) {
              this.solarGrid.showToast(`⚠️ Reihe ${row1Based} existiert nicht (Grid ${maxCols}×${maxRows}).`, 3000);
              continue;
            }
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) {
              this.solarGrid.selection[y][x] = true;
            }
          }
        }
        // Leere Reihen (Lücken)
        if (Array.isArray(config.gapRows)) {
          for (const row1Based of config.gapRows) {
            const y = row1Based - 1;
            if (y < 0 || y >= maxRows) {
              this.solarGrid.showToast(`⚠️ Reihe ${row1Based} existiert nicht (Grid ${maxCols}×${maxRows}).`, 3000);
              continue;
            }
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) {
              this.solarGrid.selection[y][x] = false;
            }
          }
        }
        // Selektiere Spalten
        if (Array.isArray(config.selectColumns)) {
          for (const col1Based of config.selectColumns) {
            const x = col1Based - 1;
            if (x < 0 || x >= maxCols) {
              this.solarGrid.showToast(`⚠️ Spalte ${col1Based} existiert nicht (Grid ${maxCols}×${maxRows}).`, 3000);
              continue;
            }
            for (let y = 0; y < maxRows; y++) {
              ensureRow(y);
              this.solarGrid.selection[y][x] = true;
            }
          }
        }
        // Leere Spalten (Lücken)
        if (Array.isArray(config.gapColumns)) {
          for (const col1Based of config.gapColumns) {
            const x = col1Based - 1;
            if (x < 0 || x >= maxCols) {
              this.solarGrid.showToast(`⚠️ Spalte ${col1Based} existiert nicht (Grid ${maxCols}×${maxRows}).`, 3000);
              continue;
            }
            for (let y = 0; y < maxRows; y++) {
              ensureRow(y);
              this.solarGrid.selection[y][x] = false;
            }
          }
        }
        // Innenbereich füllen (Kreuzprodukt aus angegebenen Reihen und Spalten)
        if (Array.isArray(config.selectAreaRows) && Array.isArray(config.selectAreaCols)) {
          for (const row1Based of config.selectAreaRows) {
            const y = row1Based - 1;
            if (y < 0 || y >= maxRows) continue;
            ensureRow(y);
            for (const col1Based of config.selectAreaCols) {
              const x = col1Based - 1;
              if (x < 0 || x >= maxCols) continue;
              this.solarGrid.selection[y][x] = true;
            }
          }
        }
        // Linke Hälfte füllen
        if (config.fillLeftHalf) {
          const endX = Math.floor(maxCols / 2) - 1;
          for (let y = 0; y < maxRows; y++) {
            ensureRow(y);
            for (let x = 0; x <= endX; x++) this.solarGrid.selection[y][x] = true;
          }
        }
        // Rechte Hälfte leeren
        if (config.clearRightHalf) {
          const startX = Math.ceil(maxCols / 2);
          for (let y = 0; y < maxRows; y++) {
            ensureRow(y);
            for (let x = startX; x < maxCols; x++) this.solarGrid.selection[y][x] = false;
          }
        }
        // Oberste/unterste Reihe leeren
        if (config.clearTopRow) {
          const y = 0; ensureRow(y);
          for (let x = 0; x < maxCols; x++) this.solarGrid.selection[y][x] = false;
        }
        if (config.clearBottomRow) {
          const y = maxRows - 1; ensureRow(y);
          for (let x = 0; x < maxCols; x++) this.solarGrid.selection[y][x] = false;
        }
        // Erste N Spalten füllen
        if (config.fillFirstNColumns && config.fillFirstNColumns > 0) {
          const endX = Math.min(maxCols - 1, config.fillFirstNColumns - 1);
          for (let y = 0; y < maxRows; y++) {
            ensureRow(y);
            for (let x = 0; x <= endX; x++) this.solarGrid.selection[y][x] = true;
          }
        }
        // Erste N Spalten leeren
        if (config.clearFirstNColumns && config.clearFirstNColumns > 0) {
          const endX = Math.min(maxCols - 1, config.clearFirstNColumns - 1);
          for (let y = 0; y < maxRows; y++) {
            ensureRow(y);
            for (let x = 0; x <= endX; x++) this.solarGrid.selection[y][x] = false;
          }
        }
        // Letzte N Spalten leeren (Default 1)
        if (config.clearLastNColumns && config.clearLastNColumns > 0) {
          const startX = Math.max(0, maxCols - config.clearLastNColumns);
          for (let y = 0; y < maxRows; y++) {
            ensureRow(y);
            for (let x = startX; x < maxCols; x++) this.solarGrid.selection[y][x] = false;
          }
        }
        // Erste N Reihen füllen/leer
        if (config.fillFirstNRows && config.fillFirstNRows > 0) {
          const endY = Math.min(maxRows - 1, config.fillFirstNRows - 1);
          for (let y = 0; y <= endY; y++) {
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) this.solarGrid.selection[y][x] = true;
          }
        }
        if (config.clearFirstNRows && config.clearFirstNRows > 0) {
          const endY = Math.min(maxRows - 1, config.clearFirstNRows - 1);
          for (let y = 0; y <= endY; y++) {
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) this.solarGrid.selection[y][x] = false;
          }
        }
        // Letzte N Reihen füllen/leer
        if (config.fillLastNRows && config.fillLastNRows > 0) {
          const startY = Math.max(0, maxRows - config.fillLastNRows);
          for (let y = startY; y < maxRows; y++) {
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) this.solarGrid.selection[y][x] = true;
          }
        }
        if (config.clearLastNRows && config.clearLastNRows > 0) {
          const startY = Math.max(0, maxRows - config.clearLastNRows);
          for (let y = startY; y < maxRows; y++) {
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) this.solarGrid.selection[y][x] = false;
          }
        }
        // Nur Rand füllen (innen leeren)
        if (config.fillOnlyFrame) {
          for (let y = 0; y < maxRows; y++) {
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) {
              const isFrame = y === 0 || y === maxRows - 1 || x === 0 || x === maxCols - 1;
              this.solarGrid.selection[y][x] = isFrame;
            }
          }
        }
        // Block AxB ab Start (R,S)
        if (config.fillBlock) {
          const { height, width, startRow, startCol } = config.fillBlock;
          const y0 = Math.max(1, startRow) - 1;
          const x0 = Math.max(1, startCol) - 1;
          for (let y = y0; y < Math.min(maxRows, y0 + height); y++) {
            ensureRow(y);
            for (let x = x0; x < Math.min(maxCols, x0 + width); x++) {
              this.solarGrid.selection[y][x] = true;
            }
          }
        }
        // Block AxB relativ von unten/rechts
        if (config.fillBlockRelative) {
          const { height, width, fromBottom, fromRight } = config.fillBlockRelative;
          const y0 = Math.max(0, maxRows - fromBottom);
          const x0 = Math.max(0, maxCols - fromRight);
          for (let y = y0; y < Math.min(maxRows, y0 + height); y++) {
            ensureRow(y);
            for (let x = x0; x < Math.min(maxCols, x0 + width); x++) {
              this.solarGrid.selection[y][x] = true;
            }
          }
        }
        // Jede zweite Reihe füllen
        if (config.everySecondRowsStart) {
          const start = Math.max(1, config.everySecondRowsStart);
          for (let row1Based = start; row1Based <= maxRows; row1Based += 2) {
            const y = row1Based - 1;
            ensureRow(y);
            for (let x = 0; x < maxCols; x++) this.solarGrid.selection[y][x] = true;
          }
        }
        // Sonderfall: moduleCount + rowsOnly + Spalten-Lücken → nach dem Leeren wieder bis zur Zielmenge auffüllen (nur auf erlaubten Spalten)
        if (config.moduleCount && config.rowConfig && !config.selectRows && !config.gapRows) {
          const prohibitedCols = new Set();
          if (config.clearFirstNColumns && config.clearFirstNColumns > 0) {
            for (let x = 0; x < Math.min(this.solarGrid.cols, config.clearFirstNColumns); x++) prohibitedCols.add(x);
          }
          if (Array.isArray(config.gapColumns)) {
            for (const col1Based of config.gapColumns) {
              const x = col1Based - 1; if (x >= 0 && x < this.solarGrid.cols) prohibitedCols.add(x);
            }
          }
          // Prüfe Kapazität auf erlaubten Spalten; erweitere ggf. die Spaltenzahl
          const allowedPerRow = this.solarGrid.cols - prohibitedCols.size;
          const rows = this.solarGrid.rows;
          const neededColsIfExpand = Math.ceil((config.moduleCount + prohibitedCols.size) / rows);
          if (allowedPerRow * rows < config.moduleCount) {
            // Erweitere Spaltenzahl so, dass erlaubte Spalten genug Kapazität haben
            this.solarGrid.cols = Math.max(this.solarGrid.cols, neededColsIfExpand);
            // Erweiterte Auswahlmatrix vorbereiten
            for (let y = 0; y < this.solarGrid.rows; y++) {
              if (!this.solarGrid.selection[y]) this.solarGrid.selection[y] = [];
              for (let x = this.solarGrid.selection[y].length; x < this.solarGrid.cols; x++) this.solarGrid.selection[y][x] = false;
            }
          }
          // Neu auffüllen bis moduleCount erreicht – nur erlaubte Spalten
          // Zuerst alles auf erlaubten Spalten leeren, damit keine Lücken bleiben
          for (let y = 0; y < this.solarGrid.rows; y++) {
            for (let x = 0; x < this.solarGrid.cols; x++) {
              if (!prohibitedCols.has(x)) this.solarGrid.selection[y][x] = false;
            }
          }
          let placed = 0;
          outer: for (let y = 0; y < this.solarGrid.rows; y++) {
            for (let x = 0; x < this.solarGrid.cols; x++) {
              if (prohibitedCols.has(x)) continue;
              this.solarGrid.selection[y][x] = true;
              placed++;
              if (placed >= config.moduleCount) break outer;
            }
          }
        }
        this.solarGrid.buildGrid();
        this.solarGrid.buildList();
        this.solarGrid.updateSummaryOnChange();
      }
      // Wenn Module-Anzahl angegeben, automatisch auswählen (nur wenn keine expliziten Selektions-Flags gesetzt wurden)
      if (config.moduleCount && !(config.selectRows || config.gapRows || config.selectColumns || config.gapColumns || config.selectAreaRows || config.selectAreaCols || config.fillBlock || config.fillBlockRelative || config.fillFirstNRows || config.clearFirstNRows || config.fillLastNRows || config.clearLastNRows || config.fillFirstNColumns || config.clearFirstNColumns || config.clearLastNColumns)) {
        if (config.suppressAutoSelection) {
          // "gleichmäßig" ist deprecated → keine Auto-Verteilung/Selektion
          this.solarGrid.showToast('Hinweis: "gleichmäßig" ist nicht mehr verfügbar. Bitte geben Sie Reihen/Spalten oder Module pro Reihe an.', 3500);
          // Nichts weiter tun
        } else if (config.distribution) {
          this.distributeModules(config.moduleCount, config.distribution, config);
        } else {
          this.autoSelectModules(config.moduleCount);
        }
      }

      // Globaler Hinweis, falls "gleichmäßig" erkannt wurde, aber keine Modulanzahl vorhanden war
      if (!config.moduleCount && config.deprecatedNotice === 'distributionEqual') {
        this.solarGrid.showToast('Hinweis: "gleichmäßig" ist nicht mehr verfügbar. Nutzen Sie z. B. "3 Reihen mit 6 Modulen".', 3500);
      }
      if (!config.moduleCount && config.deprecatedNotice === 'distributionRandom') {
        this.solarGrid.showToast('Hinweis: "zufällig" ist nicht mehr verfügbar. Nutzen Sie konkrete Reihen/Spalten-Angaben.', 3500);
      }
      
      // Verstecke Tipps nach erster Nutzung
      this.hideHelpAfterFirstUse();
    }
    
    // Neue Methode: Preview-Grid verstecken und Konfiguration auf Hauptgrid anwenden
    applyPreviewToMainGrid(config) {
      
      
      // Verstecke Preview-Grid und zeige Hauptgrid
      this.solarGrid.hidePreviewGrid();
      this.solarGrid.showMainGrid();
      
      // Wende Konfiguration auf Hauptgrid an
      this.applyConfiguration(config);
    }
    
    // NEUE ACTION HANDLER METHODE
    handleAction(action, config = {}) {
      switch (action) {
        case 'saveConfig':
          if (config.configName) {
            // Name der aktuellen Konfiguration ändern
            this.solarGrid.renameCurrentConfig(config.configName);
            			this.solarGrid.showToast(`Konfiguration umbenannt zu "${config.configName}"`, 2000);
          } else {
            // Normales Speichern
            this.solarGrid.saveNewConfig();
            				this.solarGrid.showToast('Konfiguration gespeichert', 2000);
          }
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
            				this.solarGrid.showToast('Konfiguration gelöscht', 2000);
          }
          break;
          
        case 'deleteModules':
          // Lösche nur die Module-Auswahl, behalte Grid-Größe
          this.clearModuleSelection();
          			this.solarGrid.showToast('Module-Auswahl gelöscht', 2000);
          break;
          
        case 'resetGrid':
          // Gleiches Verhalten wie der UI-Button "Zurücksetzen"
          this.solarGrid.resetGridToDefault();
          this.solarGrid.showToast('⚡ Grid zurückgesetzt', 2000);
          break;
          
        // NEU: Neue Konfiguration erstellen
        case 'newConfig':
          this.solarGrid.saveNewConfig();
          this.solarGrid.showToast('Neue Konfiguration erstellt', 2000);
          break;
        
        // NEU: Alle Konfigurationen löschen (mit Bestätigung, gleiche Funktion wie "von vorne beginnen")
        case 'resetAllConfigs':
          this.solarGrid.resetAllConfigurations();
          // Bestätigungsdialog erfolgt in resetAllConfigurations(); kein zusätzliches Toast hier
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

    // NEU: Verteile Module gemäß gewünschtem Modus
    distributeModules(totalModules, mode, config = {}) {
      // Stelle sicher, dass das Grid groß genug ist
      const capacity = this.solarGrid.cols * this.solarGrid.rows;
      if (capacity < totalModules) {
        this.expandGridForModules(totalModules);
      }

      // Leere Auswahlmatrix aufbauen
      this.solarGrid.selection = Array.from({ length: this.solarGrid.rows }, () =>
        Array.from({ length: this.solarGrid.cols }, () => false)
      );

      const rows = this.solarGrid.rows;
      const cols = this.solarGrid.cols;

      const placeRowWise = (rowCounts) => {
        for (let y = 0; y < rows; y++) {
          let count = rowCounts[y] || 0;
          for (let x = 0; x < cols && count > 0; x++) {
            this.solarGrid.selection[y][x] = true;
            count--;
          }
        }
      };

      if (mode === 'equal') {
        // Verteile möglichst quadratisch
        const numRows = Math.min(rows, Math.ceil(Math.sqrt(totalModules)));
        const base = Math.floor(totalModules / numRows);
        const extra = totalModules % numRows;
        const rowCounts = Array.from({ length: rows }, (_, y) => (y < numRows ? base + (y < extra ? 1 : 0) : 0));
        placeRowWise(rowCounts);
      } else if (mode === 'rows') {
        const base = Math.floor(totalModules / rows);
        const extra = totalModules % rows;
        const rowCounts = Array.from({ length: rows }, (_, y) => base + (y < extra ? 1 : 0));
        placeRowWise(rowCounts);
      } else if (mode === 'columns') {
        // Spaltenweise gleichmäßig
        const base = Math.floor(totalModules / cols);
        const extra = totalModules % cols;
        for (let x = 0; x < cols; x++) {
          let count = base + (x < extra ? 1 : 0);
          for (let y = 0; y < rows && count > 0; y++) {
            this.solarGrid.selection[y][x] = true;
            count--;
          }
        }
      } else if (mode === 'random') {
        let placed = 0;
        const cells = [];
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) cells.push([y, x]);
        }
        // Shuffle
        for (let i = cells.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cells[i], cells[j]] = [cells[j], cells[i]];
        }
        for (const [y, x] of cells) {
          if (placed >= totalModules) break;
          this.solarGrid.selection[y][x] = true;
          placed++;
        }
      } else {
        // Fallback
        this.autoSelectModules(totalModules);
      }

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
      // FEATURE 2: Shift+Klick entfernt - nur noch Drag-and-Drop
      // Keine Keyboard-Listener mehr für Shift-Toggle
      // Bulk-Modus wird nur noch über Drag-and-Drop aktiviert
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
        
        // FEATURE 1: Snap-to-Grid + Touch-Optimierung
        // NEUE: Drag-to-Select Event Listeners mit Touch-Support
        newCell.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Verhindert Textauswahl während Drag
          this.handleDragStart(e, x, y, newCell);
        });
        
        // Touch-Events für Mobile-Optimierung
        newCell.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.handleDragStart(e, x, y, newCell);
        });
        
        newCell.addEventListener('mouseenter', (e) => {
          if (this.mousePressed && this.dragStart) {
            // FEATURE 1: Snap-to-Grid - Live-Preview mit Grid-Snap
            this.isDragging = true;
            this.highlightRange(this.dragStart, { x, y });
          }
        });
        
        // Touch-Move für Mobile
        newCell.addEventListener('touchmove', (e) => {
          if (this.mousePressed && this.dragStart) {
            e.preventDefault();
            this.isDragging = true;
            this.highlightRange(this.dragStart, { x, y });
          }
        });
        
        newCell.addEventListener('mouseup', (e) => {
          if (this.mousePressed && this.dragStart) {
            e.preventDefault();
            this.handleDragEnd(e, x, y);
          }
        });
        
        // Touch-End für Mobile
        newCell.addEventListener('touchend', (e) => {
          if (this.mousePressed && this.dragStart) {
            e.preventDefault();
            this.handleDragEnd(e, x, y);
          }
        });

        // FEATURE 2: Shift+Klick entfernt - nur noch Drag-and-Drop
        // Füge neue Event Listener hinzu
        newCell.addEventListener('click', (e) => {
          // Verhindere Click-Verarbeitung wenn gerade ein Drag beendet wurde
          if (this.isDragging || (this.mousePressed && this.dragStart)) {
            return;
          }
          
          // Normaler Click-Modus (Bulk-Modus entfernt)
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
          
          // Update config-list und overview wenn eine Konfiguration ausgewählt ist
          if (this.solarGrid.currentConfig !== null) {
            // Speichere die Konfiguration automatisch
            this.solarGrid.updateConfig();
            this.solarGrid.updateConfigList();
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
    
    // Ermittelt die dem Zeiger nächstgelegene Zelle; klemmt außerhalb auf Grid-Rand
    getClampedCellFromPointer(event) {
      const gridRect = this.solarGrid.gridEl.getBoundingClientRect();
      // Unterstützt Maus und Touch
      const point = (event && (event.touches && event.touches[0])) || (event && (event.changedTouches && event.changedTouches[0])) || event;
      const clientX = point ? point.clientX : 0;
      const clientY = point ? point.clientY : 0;

      const relativeX = Math.min(Math.max(clientX - gridRect.left, 0), gridRect.width);
      const relativeY = Math.min(Math.max(clientY - gridRect.top, 0), gridRect.height);

      const colWidth = gridRect.width / this.solarGrid.cols;
      const rowHeight = gridRect.height / this.solarGrid.rows;

      // Verhindere Division durch 0
      const x = Math.min(
        this.solarGrid.cols - 1,
        Math.max(0, colWidth > 0 ? Math.floor(relativeX / colWidth) : 0)
      );
      const y = Math.min(
        this.solarGrid.rows - 1,
        Math.max(0, rowHeight > 0 ? Math.floor(relativeY / rowHeight) : 0)
      );

      return { x, y };
    }

    // FEATURE 1: Snap-to-Grid + Touch-Optimierung - Neue Methoden
    handleDragStart(e, x, y, cell) {
      // Erfasse aktuellen Status der Start-Zelle für intelligentes Toggle
      const isCurrentlySelected = this.solarGrid.selection[y]?.[x] || false;
      
      // Starte Drag-to-Select Modus
      this.mousePressed = true;
      this.isDragging = false; // Wird erst bei mousemove aktiviert
      this.dragStart = { x, y, wasSelected: isCurrentlySelected };
      
      // Visuelle Markierung der Start-Zelle
      this.clearHighlight();
      cell.classList.add('drag-start-marker');
      
      // Visueller Hinweis auf Toggle-Modus
      if (isCurrentlySelected) {
        cell.classList.add('drag-deselect-mode');
      } else {
        cell.classList.add('drag-select-mode');
      }
    }
    
    handleDragEnd(e, x, y) {
      if (this.isDragging || (this.dragStart.x === x && this.dragStart.y === y)) {
        // Drag beendet ODER Single-Click (gleiche Zelle)
        this.selectRange(this.dragStart, { x, y });
        
        // KEINE Toast-Nachrichten mehr bei Drag-Operationen
        // Alle Toast-Nachrichten für Drag-Operationen wurden entfernt
      }
      
      // Reset Drag-Zustand
      this.resetDragState();
    }
    
    // FEATURE 1: Snap-to-Grid + Touch-Optimierung - Globale Events
    setupGlobalMouseEvents() {
      // Globaler Mouse-Move: Während Drag immer Range-Preview updaten, auch außerhalb
      document.addEventListener('mousemove', (e) => {
        if (this.mousePressed && this.dragStart) {
          this.isDragging = true;
          const endCell = this.getClampedCellFromPointer(e);
          this.highlightRange(this.dragStart, endCell);
        }
      });

      // Globaler Mouse-Up: Auswahl auch außerhalb committen
      document.addEventListener('mouseup', (e) => {
        if (this.mousePressed && this.dragStart) {
          const endCell = this.getClampedCellFromPointer(e);
          this.handleDragEnd(e, endCell.x, endCell.y);
        }
      });
      
      // Touch-End für Mobile
      document.addEventListener('touchmove', (e) => {
        if (this.mousePressed && this.dragStart) {
          e.preventDefault();
          this.isDragging = true;
          const endCell = this.getClampedCellFromPointer(e);
          this.highlightRange(this.dragStart, endCell);
        }
      }, { passive: false });

      document.addEventListener('touchend', (e) => {
        if (this.mousePressed && this.dragStart) {
          const endCell = this.getClampedCellFromPointer(e);
          this.handleDragEnd(e, endCell.x, endCell.y);
        }
      });
      
      // Grid-Leave: Kein Reset mehr – globale Events übernehmen die Vorschau außerhalb
      this.solarGrid.gridEl.addEventListener('mouseleave', () => {
        // bewusst leer: Drag bleibt aktiv, Vorschau wird global aktualisiert
      });
      
      // Touch-Leave für Mobile: ebenfalls kein Reset
      this.solarGrid.gridEl.addEventListener('touchcancel', () => {
        // bewusst leer
      });
      
      // Verhindere Kontext-Menu während Drag-Operationen
      this.solarGrid.gridEl.addEventListener('contextmenu', (e) => {
        if (this.isDragging || this.mousePressed) {
          e.preventDefault();
        }
      });
      
      // Verhindere Zoom-Gesten während Drag-Operationen
      this.solarGrid.gridEl.addEventListener('touchmove', (e) => {
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
      this.quetschkabelschuhe = document.getElementById('quetschkabelschuhe');
      this.erdungsband   = document.getElementById('erdungsband');
      this.ulicaModule   = document.getElementById('ulica-module');
      

      		this.listHolder    = document.querySelector('.product-section');
      this.prodList      = document.querySelector('.product-section #produktliste');

      this.saveBtn       = document.getElementById('save-config-btn');
      this.addBtn        = document.getElementById('add-to-cart-btn');
      this.summaryBtn    = document.getElementById('summary-add-cart-btn');
      this.configListEl  = document.getElementById('config-list');
      this.resetBtn      = document.getElementById('reset-btn');
      this.continueLaterBtn = document.getElementById('continue-later-btn');
      this.moduleSelect = document.getElementById('module-select');
      
      // Modul-Daten
      this.moduleData = {
        'ulica-500': { name: 'Ulica Black Jade-Flow 500W', width: 195.2, height: 113.4 },
        'ulica-450': { name: 'Ulica Black Jade-Flow 450W', width: 176.2, height: 113.4 },
        'trina-vertex-s-plus': { name: 'Trina Vertex S+', width: 176.2, height: 113.4 },
        'aiko-neostar-3s-plus': { name: 'Aiko Neostar 3S+', width: 176.2, height: 113.4 }
      };
      
      // Modul-Checkbox-Mapping
      this.moduleCheckboxMapping = {
        'include-modules': 'ulica-450',
        'ulica-module': 'ulica-500'
      };

      this.selection     = [];
      this.configs       = [];
      this.currentConfig = null;
      this.default       = { cols:5, rows:5, width:176, height:113 };
      
      // Performance: Debouncing für häufige Updates
      this.updateTimeout = null;
      this.updateDelay = 100; // ms
      
      // Warenkorb-Queue & Observer
      this.isAddingToCart = false;
      this.webflowFormsObserver = null;
      this.cartAckObserver = null;
      this.cartAckResolve = null;
      
      // Performance: Resize Observer für responsive Updates
      this.resizeObserver = null;
      this.resizeTimeout = null;
      
      // FEATURE 8: Pinch-to-Zoom
      this.zoomLevel = 1;
      this.minZoom = 0.5;
      this.maxZoom = 3;
      this.zoomObserver = null;
      
      // FEATURE 5: Performance-Monitoring (entfernbar)
      this.performanceMetrics = {
        gridRenderTime: 0,
        updateTime: 0,
        memoryUsage: 0,
        fps: 0,
        errorCount: 0
      };
      
      // Tracking für Session-Daten
      this.sessionId = this.generateSessionId();
      this.sessionStartTime = Date.now();
      this.firstInteractionTime = null;
      this.lastInteractionTime = Date.now();
      this.interactionCount = 0;
      this.webhookUrl = 'https://hook.eu2.make.com/c7lkudk1v2a2xsr291xbvfs2cb25b84k';

      // PDF Generator initialisieren
      this.pdfGenerator = new SolarPDFGenerator(this);
      
      // Cache Manager für 24h Persistierung
      this.cacheManager = new CacheManager();

      // Loading Overlay Elemente
      this.loadingOverlay = null;
      this.loadingTextEl = null;

      this.init();
    }

    // No-op URL saver to avoid TypeError from old onclick bindings
    saveToUrl() {
      try {
        // Optional: could push state or update query params here
        return;
      } catch (_) {
        return;
      }
    }

    showLoading(message = 'Vorgang läuft… bitte warten') {
      try {
        if (!this.loadingOverlay) this.loadingOverlay = document.getElementById('loading-overlay');
        if (!this.loadingTextEl) this.loadingTextEl = document.getElementById('loading-text');
        if (this.loadingTextEl && typeof message === 'string') {
          this.loadingTextEl.textContent = message;
        }
        if (this.loadingOverlay) {
          this.loadingOverlay.style.display = 'flex';
        }
      } catch (_) {}
    }

    hideLoading() {
      try {
        if (!this.loadingOverlay) this.loadingOverlay = document.getElementById('loading-overlay');
        if (this.loadingOverlay) {
          this.loadingOverlay.style.display = 'none';
        }
      } catch (_) {}
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
        lastInteractionTime: this.lastInteractionTime,
        // FEATURE 5: Performance-Monitoring - Metriken hinzufügen
        performanceMetrics: this.performanceMetrics
      };
    }

    getProductSummary() {
      const parts = this.calculateParts();
      if (!this.incM.checked) delete parts.Solarmodul;
      // Zusatzprodukte werden nicht mehr zu einzelnen Konfigurationen hinzugefügt
      // Sie werden nur noch in der Overview berechnet

      // Palettenlogik für Anzeige anwenden: 36er bündeln je nach Modultyp
      try {
        const ulicaSelected = currentConfig.ulicaModule === true;
        const pieceKey = ulicaSelected ? 'UlicaSolarBlackJadeFlow' : 'Solarmodul';
        const palletKey = ulicaSelected ? 'UlicaSolarBlackJadeFlowPalette' : 'SolarmodulPalette';
        const count = Number(parts[pieceKey] || 0);
        if (count > 0) {
          const pallets = Math.floor(count / 36);
          const remainder = count % 36;
          if (pallets > 0) {
            parts[palletKey] = (parts[palletKey] || 0) + pallets * 36;
          }
          parts[pieceKey] = remainder;
        }
      } catch (e) {}

      const entries = Object.entries(parts).filter(([,v]) => v > 0);
      let totalPrice = 0;
      const productQuantities = {};
      
      // Berechne Preise und sammle Quantities
      entries.forEach(([k,v]) => {
        const packs = Math.ceil(v / VE[k]);
        const price = getPackPriceForQuantity(k, v);
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
        cellWidth: parseFloat(this.wIn.value),
        cellHeight: parseFloat(this.hIn.value),
        orientation: this.orV.checked ? 'vertical' : 'horizontal',
        selection: this.selection,
        incM: this.incM.checked
        // Zusatzprodukte werden nicht mehr zu einzelnen Konfigurationen hinzugefügt
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
        incM: targetConfig.incM
        // Zusatzprodukte werden nicht mehr zu einzelnen Konfigurationen hinzugefügt
      });
      
      const allProductQuantities = {
        Solarmodul: parts.Solarmodul || 0,
        Endklemmen: parts.Endklemmen || 0,
        Schrauben: parts.Schrauben || 0,
        Dachhaken: parts.Dachhaken || 0,
        Mittelklemmen: parts.Mittelklemmen || 0,
        Endkappen: parts.Endkappen || 0,
        Schienenverbinder: parts.Schienenverbinder || 0,
        Schiene240cm: parts.Schiene_240_cm || 0,
        Schiene360cm: parts.Schiene_360_cm || 0
        // Zusatzprodukte werden nicht mehr zu einzelnen Konfigurationen hinzugefügt
      };

      // Kompakte Produktliste: nur Einträge > 0
      const productQuantitiesCompact = Object.fromEntries(
        Object.entries(allProductQuantities).filter(([, v]) => v > 0)
      );

      // Auswahl-Metadaten: gezielte Koordinaten + Anzahl
      const selectedCoords = [];
      for (let y = 0; y < targetConfig.rows; y++) {
        const row = targetConfig.selection[y] || [];
        for (let x = 0; x < targetConfig.cols; x++) {
          if (row[x]) selectedCoords.push([x, y]);
        }
      }
      const selectionMeta = {
        selectedCount: selectedCoords.length,
        selectedCoords
      };
      
      // totalPrice robust aus kompakten Mengen berechnen (VE * Preis je Pack)
      const totalPriceFromCompact = Object.entries(productQuantitiesCompact).reduce((sum, [key, qty]) => {
        const veKey = key === 'Schiene240cm' ? 'Schiene_240_cm' : key === 'Schiene360cm' ? 'Schiene_360_cm' : key;
        const ve = VE[veKey] || 1;
        const packs = Math.ceil(qty / ve);
        const pricePerPack = getPackPriceForQuantity(veKey, qty);
        return sum + packs * pricePerPack;
      }, 0);
      
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
            includeModules: targetConfig.incM
            // Zusatzprodukte werden nicht mehr zu einzelnen Konfigurationen hinzugefügt
          }
        },
        summary: summary,
        productQuantities: allProductQuantities,
        productQuantitiesCompact: productQuantitiesCompact,
        selectionMeta: selectionMeta,
        totalPrice: Number.isFinite(totalPriceFromCompact) ? totalPriceFromCompact : summary.totalPrice,
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
        // Kompakte Payload: nur essentielle Felder senden
        const minimalPayload = {
          sessionId: configData.sessionId,
          timestamp: configData.timestamp,
          config: {
            cols: configData?.config?.cols,
            rows: configData?.config?.rows,
            cellWidth: configData?.config?.cellWidth,
            cellHeight: configData?.config?.cellHeight,
            orientation: configData?.config?.orientation
          },
          // Auswahl-Metadaten sind optional und klein
          selection: configData.selectionMeta || undefined,
          // Nur Produkte mit Menge > 0 übermitteln
          productQuantities: configData.productQuantitiesCompact || configData.productQuantities,
          totalPrice: configData.totalPrice,
          // Sessiondaten nur einmalig (kompakt)
          session: {
            duration: configData.sessionData?.sessionDuration,
            interactions: configData.sessionData?.interactionCount
          }
        };

        // Falls Metadaten von sendAllConfigsToWebhook vorhanden sind, beilegen
        if (typeof configData.configIndex === 'number' || configData.configName || typeof configData.totalConfigsInSession === 'number') {
          minimalPayload.meta = {
            configIndex: configData.configIndex,
            configName: configData.configName,
            totalConfigsInSession: configData.totalConfigsInSession
          };
        }

        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(minimalPayload)
        });

        return response.ok;
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
            cellWidth: parseFloat(this.wIn.value),
            cellHeight: parseFloat(this.hIn.value),
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
            cellWidth: parseFloat(cfg.cellWidth),
            cellHeight: parseFloat(cfg.cellHeight),
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

    // Desktop Intro Overlay (Desktop only; zeigt bei leerem Cache/ohne URL jedes Mal)
    maybeShowIntroOverlay(cacheLoaded, hasUrlConfig) {
      try {
        const overlay = document.getElementById('intro-overlay');
        if (!overlay) return;
        // Desktop-Erkennung: echte Mobile-UserAgents oder Touch+kleine Breite gelten als mobil
        // Auf allen Geräten anzeigen; Layout ist nun responsiv (horizontal/vertikal)
        // Nur anzeigen, wenn KEIN Cache geladen wurde und KEINE URL-Konfiguration vorhanden ist
        if (cacheLoaded || hasUrlConfig) return;
        const closeBtn = document.getElementById('intro-close');
        const okBtn = document.getElementById('intro-ok');
        const close = () => {
          overlay.classList.add('hidden');
          overlay.setAttribute('aria-hidden', 'true');
        };
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        closeBtn?.addEventListener('click', close);
        okBtn?.addEventListener('click', close);
        // Outside-Click schließt Overlay
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        // Delegation: Klick auf "Verstanden – Start" (auch bei verschachtelten Elementen)
        overlay.addEventListener('click', (e) => {
          const t = e.target;
          if (t && (t.id === 'intro-ok' || (t.closest && t.closest('#intro-ok')))) {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        });
        // Tastaturbedienung: ESC zum Schließen, Enter auf Primär-Button
        overlay.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { e.preventDefault(); close(); }
          if (e.key === 'Enter' && document.activeElement && (document.activeElement.id === 'intro-ok')) {
            e.preventDefault();
            close();
          }
        });
      } catch (err) {
        console.warn('Intro Overlay konnte nicht initialisiert werden:', err);
      }
    }

    init() {
      // Mobile Detection und Warning
      this.checkMobileDevice();
      
      // Prüfe zuerst den Cache (höchste Priorität)
      const cacheLoaded = this.loadFromCache();
      
      // Prüfe URL-Parameter als Fallback (nur wenn Cache nicht geladen wurde)
      if (!cacheLoaded) {
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
      		} catch (e) {
      		}
    		}
            }

      // Desktop Intro nur anzeigen, wenn kein Cache/URL
      try {
        const hasUrlConfig = new URLSearchParams(window.location.search).has('configData');
        this.maybeShowIntroOverlay(cacheLoaded, hasUrlConfig);
      } catch (_) {}
 
       // Event-Listener für alle UI-Elemente setzen
 		this.setupAllEventListeners();

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
		// Neue Sidebar Navigation
		this.initSidebarNavigation();

		// Loading Overlay referenzen
		this.loadingOverlay = document.getElementById('loading-overlay');
		this.loadingTextEl = document.getElementById('loading-text');

  		window.addEventListener('resize', () => {
    		this.updateSize();
    		this.buildGrid();
    		this.buildList();
    		this.updateSummaryOnChange();
  		});
      
			// Wenn keine Konfigurationen aus URL/CACHE geladen wurden, erstelle eine Standard-Konfiguration
			if (this.configs.length === 0) {
				this.cols = this.default.cols;
				this.rows = this.default.rows;
				this.setup();

				const defaultConfig = this._makeConfigObject();
				this.configs.push(defaultConfig);
				this.loadConfig(0);

				// Standard-Orientation nur für echte Default-Erstellung setzen
				if (this.orH && this.orV) {
					this.orH.checked = false;
					this.orV.checked = true;
					// Synchronisiere mit den Orientation Buttons
					const orientHBtn = document.getElementById('orient-h');
					const orientVBtn = document.getElementById('orient-v');
					if (orientHBtn && orientVBtn) {
						orientHBtn.classList.remove('active');
						orientVBtn.classList.add('active');
					}
				}
			}
			
			// Performance: Resize Observer für responsive Updates
			this.setupResizeObserver();
			
			// FEATURE 8: Pinch-to-Zoom Setup
			this.setupPinchToZoom();
			
			// Initialisiere Smart Config Features
			this.initSmartConfigFeatures();

			// Loading Overlay referenzen
			this.loadingOverlay = document.getElementById('loading-overlay');
			this.loadingTextEl = document.getElementById('loading-text');
			
			// Initialisiere Auto-Save Indicator
			this.initAutoSaveIndicator();
			
			// Initialisiere Config-Liste
			this.initConfigList();
			
			// Hinweis: Keine erzwungene Standard-Orientation hier setzen, um Cache/URL-Werte nicht zu überschreiben
		}
		initSidebarNavigation() {
			// Navigation zwischen Detail-Ansicht und Übersicht
			const backToOverviewBtn = document.getElementById('back-to-overview');
			const detailView = document.getElementById('config-detail-view');
			const overviewView = document.getElementById('config-overview');
			
			if (backToOverviewBtn) {
				backToOverviewBtn.addEventListener('click', () => {
					this.showOverview();
				});
			}
			
			// Edit Config Name
			const editConfigBtn = document.getElementById('edit-config-name');
			if (editConfigBtn) {
				editConfigBtn.addEventListener('click', () => {
					this.editConfigName();
				});
			}
			
			// Delete Current Config
			const deleteConfigBtn = document.getElementById('delete-current-config');
			if (deleteConfigBtn) {
				deleteConfigBtn.addEventListener('click', () => {
					this.deleteCurrentConfig();
				});
				// Sichtbarkeit abhängig von Anzahl Konfigurationen
				deleteConfigBtn.style.display = this.configs.length >= 2 ? '' : 'none';
			}
			
			// Express Checkout (alter "In den Warenkorb" Button)
			const expressCheckoutBtn = document.getElementById('express-checkout-btn');
			if (expressCheckoutBtn) {
				expressCheckoutBtn.addEventListener('click', () => {
					this.addCurrentToCart();
				});
			}
			
			// Nächste Konfiguration (alter "Konfiguration speichern" Button)
			const nextConfigBtn = document.getElementById('next-config-btn');
			if (nextConfigBtn) {
				nextConfigBtn.addEventListener('click', () => {
					this.saveNewConfig();
				});
			}
			
			// Gesamte Auswahl in Warenkorb
			const addAllToCartBtn = document.getElementById('add-all-to-cart-btn');
			if (addAllToCartBtn) {
				addAllToCartBtn.addEventListener('click', () => {
					this.addAllConfigsToCart();
				});
			}
			
			// Alle Konfigurationen zurücksetzen
			const continueLaterBtn = document.getElementById('continue-later-btn');
			if (continueLaterBtn) {
				continueLaterBtn.addEventListener('click', () => {
					this.resetAllConfigurations();
				});
			}
			
			// Add Config Button
			const addConfigBtn = document.getElementById('add-config-btn');
			if (addConfigBtn) {
				addConfigBtn.addEventListener('click', () => {
					this.saveNewConfig();
				});
			}
		}
		showOverview() {
			// Aktuelle Konfiguration speichern um Progress nicht zu verlieren
			if (this.currentConfig !== null) {
				this.updateConfig();
			}
			
			const detailView = document.getElementById('config-detail-view');
			const overviewView = document.getElementById('config-overview');
			
			if (detailView && overviewView) {
				detailView.classList.remove('active');
				overviewView.classList.add('active');
				
				// Alle Input-Felder entfernen
				this.clearAllInputFields();
				
				// Config-Liste aktualisieren
				this.updateConfigList();
			}
		}
		
		clearAllInputFields() {
			// Entferne alle Input-Felder aus der Detail-Ansicht
			const titleEl = document.getElementById('current-config-title');
			if (titleEl) {
				const existingInputs = titleEl.parentNode.querySelectorAll('.config-title-input');
				existingInputs.forEach(input => input.remove());
				titleEl.style.display = 'block';
			}
			
			// Entferne alle Input-Felder aus der Config-Liste
			const configItems = document.querySelectorAll('.config-item');
			configItems.forEach(item => {
				const nameEl = item.querySelector('.config-item-name');
				if (nameEl) {
					const existingInputs = nameEl.parentNode.querySelectorAll('input[type="text"]');
					existingInputs.forEach(input => input.remove());
					nameEl.style.display = 'block';
				}
			});
		}
		
		// Initialisiere Config-Liste beim Start
		initConfigList() {
			if (document.getElementById('config-overview')?.classList.contains('active')) {
				this.updateConfigList();
			}
			
			// Event-Listener für Zusatzprodukte-Checkboxen
			this.initAdditionalProductsListeners();
		}
		
		showDetailView(configIndex = null) {
			const detailView = document.getElementById('config-detail-view');
			const overviewView = document.getElementById('config-overview');
			
			if (detailView && overviewView) {
				overviewView.classList.remove('active');
				detailView.classList.add('active');
				
				if (configIndex !== null) {
					this.loadConfig(configIndex);
				}
				
				// Detail-Ansicht aktualisieren
				this.updateDetailView();
				// Sichtbarkeit des Delete-Buttons nach dem Rendern aktualisieren
				const deleteConfigBtn = document.getElementById('delete-current-config');
				if (deleteConfigBtn) {
					deleteConfigBtn.style.display = this.configs.length >= 2 ? '' : 'none';
				}
			}
		}
		
				updateDetailView() {
			const currentConfig = this.configs[this.currentConfig];
			if (!currentConfig) return;
			
			// Titel aktualisieren
			const titleEl = document.getElementById('current-config-title');
			if (titleEl) {
				titleEl.textContent = currentConfig.name || `Konfiguration #${this.currentConfig + 1}`;
			}
			
			// Gesamtpreis aktualisieren
			this.updateCurrentTotalPrice();
				// Sichtbarkeit des Delete-Buttons sicherstellen
				const deleteConfigBtn = document.getElementById('delete-current-config');
				if (deleteConfigBtn) {
					deleteConfigBtn.style.display = this.configs.length >= 2 ? '' : 'none';
				}
		}
		
		updateCurrentTotalPrice() {
			const totalPriceEl = document.getElementById('current-total-price');
			if (totalPriceEl) {
				// Verwende die gleiche Berechnungslogik wie calculateConfigPrice
				const currentConfig = {
					selection: this.selection,
					cols: this.cols,
					rows: this.rows,
					cellWidth: parseInt(this.wIn?.value || '179'),
					cellHeight: parseInt(this.hIn?.value || '113'),
					orientation: this.orV?.checked ? 'vertical' : 'horizontal',
					ulicaModule: document.getElementById('ulica-module')?.checked || false
				};
				
				const totalPrice = this.calculateConfigPrice(currentConfig);
				totalPriceEl.textContent = `${totalPrice.toFixed(2).replace('.', ',')} €`;
				// Subtitle: nur für Firmenkunden anzeigen, Text "exkl. MwSt"
				const section = totalPriceEl.closest('.total-section');
				const subtitle = section ? section.querySelector('.total-subtitle') : null;
				if (subtitle) {
					subtitle.style.display = isPrivateCustomer() ? 'none' : '';
					subtitle.textContent = 'exkl. MwSt';
				}
			}
		}
		
    updateConfigList() {
      // Delegiere auf zentrale Render-Methode, um Doppelungen zu vermeiden
      this.renderConfigList();
      this.updateOverviewTotalPrice();
      this.renderAdditionalProducts();
    }
		
		initAutoSaveIndicator() {
			// Auto-Save Indicator Setup
			this.autoSaveTimeout = null;
		}
		showAutoSaveIndicator() {
			const indicator = document.getElementById('auto-save-indicator');
			if (!indicator) return;
			
			// Zeige Indicator
			indicator.classList.remove('hidden');
			
			// Animation neu starten
			const saveIcon = indicator.querySelector('.save-icon');
			if (saveIcon) {
				// Animation zurücksetzen und neu starten
				saveIcon.style.animation = 'none';
				saveIcon.offsetHeight; // Trigger reflow
				saveIcon.style.animation = 'rotate360 0.8s ease-in-out';
			}
			
			// Verstecke nach 1 Sekunde
			if (this.autoSaveTimeout) {
				clearTimeout(this.autoSaveTimeout);
			}
			
			this.autoSaveTimeout = setTimeout(() => {
				indicator.classList.add('hidden');
			}, 1000);
		}
		
		updateOverviewTotalPrice() {
			const totalPriceEl = document.getElementById('overview-total-price');
			if (!totalPriceEl) return;
			
			// Berechne Gesamtpreis aller Konfigurationen
			let totalPrice = 0;
			this.configs.forEach(config => {
				totalPrice += this.calculateConfigPrice(config);
			});
			
			// Füge Zusatzprodukte hinzu
			const additionalProductsPrice = this.calculateAdditionalProductsPrice();
			totalPrice += additionalProductsPrice;
			
			totalPriceEl.textContent = `${totalPrice.toFixed(2).replace('.', ',')} €`;
			// Subtitle: nur für Firmenkunden anzeigen, Text "exkl. MwSt"
			const section = totalPriceEl.closest('.total-section');
			const subtitle = section ? section.querySelector('.total-subtitle') : null;
			if (subtitle) {
				subtitle.style.display = isPrivateCustomer() ? 'none' : '';
				subtitle.textContent = 'exkl. MwSt';
			}
		}
		
		calculateAdditionalProductsPrice() {
			let totalPrice = 0;
			
			// MC4 Stecker
			if (document.getElementById('mc4')?.checked) {
				const moduleCount = this.configs.reduce((total, config) => {
					return total + config.selection.flat().filter(v => v).length;
				}, 0);
				const packagesNeeded = Math.ceil(moduleCount / 30); // 1 Packung pro 30 Module
				const pricePerPackage = getPackPriceForQuantity('MC4_Stecker', moduleCount);
				totalPrice += packagesNeeded * pricePerPackage;
			}
			
			// Solarkabel
			if (document.getElementById('solarkabel')?.checked) {
				const packagesNeeded = 1; // 1x Solarkabel 100M
				const pricePerPackage = getPackPriceForQuantity('Solarkabel', 1);
				totalPrice += packagesNeeded * pricePerPackage;
			}
			
			// Holzunterleger
			if (document.getElementById('holz')?.checked) {
				const packagesNeeded = 1; // 1x Unterlegholz für Dachhaken - 50 Stück
				const pricePerPackage = getPackPriceForQuantity('Holzunterleger', VE['Holzunterleger']);
				totalPrice += packagesNeeded * pricePerPackage;
			}
			
			// Quetschkabelschuhe
			if (document.getElementById('quetschkabelschuhe')?.checked) {
				const packagesNeeded = 1; // 1x Quetschkabelschuhe - 100 Stück
				const pricePerPackage = getPackPriceForQuantity('Quetschkabelschuhe', 1);
				totalPrice += packagesNeeded * pricePerPackage;
			}
			
			// Optimierer (Huawei/BRC)
			const hCb = document.getElementById('huawei-opti');
			const bCb = document.getElementById('brc-opti');
			const qEl = document.getElementById('opti-qty');
			if (hCb && bCb && qEl && (hCb.checked || bCb.checked)) {
				const key = bCb.checked ? 'BRCOpti' : 'HuaweiOpti';
				const qty = Math.max(1, parseInt(qEl.value || '1', 10));
				const pricePer = getPackPriceForQuantity(key, 1);
				totalPrice += qty * pricePer;
			}
			
			return totalPrice;
		}
		
		renderAdditionalProducts() {
			const additionalProductsListEl = document.getElementById('additional-products-list');
			if (!additionalProductsListEl) return;
			
			additionalProductsListEl.innerHTML = '';
			
			// MC4 Stecker
			if (document.getElementById('mc4')?.checked) {
				const moduleCount = this.configs.reduce((total, config) => {
					return total + config.selection.flat().filter(v => v).length;
				}, 0);
				const packagesNeeded = Math.ceil(moduleCount / 30); // 1 Packung pro 30 Module
				const pricePerPackage = getPackPriceForQuantity('MC4_Stecker', moduleCount);
				const totalPrice = packagesNeeded * pricePerPackage;
				
				const item = document.createElement('div');
				item.className = 'additional-product-item produkt-item';
				item.innerHTML = `
					<div class="item-left">
						<span class="item-quantity">${packagesNeeded}×</span>
						<div class="item-info">
							<span class="item-name">MC4 Stecker</span>
							<span class="item-ve">50 Stück</span>
						</div>
					</div>
					<span class="item-price">${totalPrice.toFixed(2).replace('.', ',')} €</span>
				`;
				additionalProductsListEl.appendChild(item);
			}
			
			// Solarkabel
			if (document.getElementById('solarkabel')?.checked) {
				const packagesNeeded = 1;
				const pricePerPackage = getPackPriceForQuantity('Solarkabel', 1);
				const totalPrice = packagesNeeded * pricePerPackage;
				
				const item = document.createElement('div');
				item.className = 'additional-product-item produkt-item';
				item.innerHTML = `
					<div class="item-left">
						<span class="item-quantity">1×</span>
						<div class="item-info">
							<span class="item-name">Solarkabel</span>
							<span class="item-ve">100 m</span>
						</div>
					</div>
					<span class="item-price">${totalPrice.toFixed(2).replace('.', ',')} €</span>
				`;
				additionalProductsListEl.appendChild(item);
			}
			
			// Holzunterleger
			if (document.getElementById('holz')?.checked) {
				const packagesNeeded = 1;
				const pricePerPackage = getPackPriceForQuantity('Holzunterleger', VE['Holzunterleger']);
				const totalPrice = packagesNeeded * pricePerPackage;
				
				const item = document.createElement('div');
				item.className = 'additional-product-item produkt-item';
				item.innerHTML = `
					<div class="item-left">
						<span class="item-quantity">1×</span>
						<div class="item-info">
							<span class="item-name">Unterlegholz für Dachhaken</span>
							<span class="item-ve">50 Stück</span>
						</div>
					</div>
					<span class="item-price">${totalPrice.toFixed(2).replace('.', ',')} €</span>
				`;
				additionalProductsListEl.appendChild(item);
			}
			
			// Quetschkabelschuhe
			if (document.getElementById('quetschkabelschuhe')?.checked) {
				const packagesNeeded = 1;
				const pricePerPackage = getPackPriceForQuantity('Quetschkabelschuhe', 1);
				const totalPrice = packagesNeeded * pricePerPackage;
				
				const item = document.createElement('div');
				item.className = 'additional-product-item produkt-item';
				item.innerHTML = `
					<div class="item-left">
						<span class="item-quantity">1×</span>
						<div class="item-info">
							<span class="item-name">Quetschkabelschuhe</span>
							<span class="item-ve">100 Stück</span>
						</div>
					</div>
					<span class="item-price">${totalPrice.toFixed(2).replace('.', ',')} €</span>
				`;
				additionalProductsListEl.appendChild(item);
			}
			
			// Optimierer (Huawei/BRC) – exklusiv, Menge aus Input
			const hCb = document.getElementById('huawei-opti');
			const bCb = document.getElementById('brc-opti');
			const qEl = document.getElementById('opti-qty');
			if (hCb && bCb && qEl && (hCb.checked || bCb.checked)) {
				const key = bCb.checked ? 'BRCOpti' : 'HuaweiOpti';
				const qty = Math.max(1, parseInt(qEl.value || '1', 10));
				const pricePer = getPackPriceForQuantity(key, 1);
				const total = qty * pricePer;
				const item = document.createElement('div');
				item.className = 'additional-product-item produkt-item';
				item.innerHTML = `
					<div class="item-left">
						<span class="item-quantity">${qty}×</span>
						<div class="item-info">
							<span class="item-name">${PRODUCT_NAME_MAP[key] || key}</span>
							<span class="item-ve">1 Stück</span>
						</div>
					</div>
					<span class="item-price">${total.toFixed(2).replace('.', ',')} €</span>
				`;
				additionalProductsListEl.appendChild(item);
			}
		}
		
		initAdditionalProductsListeners() {
			// Event-Listener für Zusatzprodukte-Checkboxen
			const additionalProductCheckboxes = ['mc4', 'solarkabel', 'holz', 'quetschkabelschuhe', 'huawei-opti', 'brc-opti', 'opti-qty'];
			
			additionalProductCheckboxes.forEach(checkboxId => {
				const checkbox = document.getElementById(checkboxId);
				if (checkbox) {
					checkbox.addEventListener('change', () => {
						// Update Gesamtpreis und Zusatzprodukte-Liste
						this.updateOverviewTotalPrice();
						this.renderAdditionalProducts();
					});
				}
			});
			// Exklusivität der Optis + Mengeingabe Handling (robust, sofortiges UI-Update)
			const hCb = document.getElementById('huawei-opti');
			const bCb = document.getElementById('brc-opti');
			const qEl = document.getElementById('opti-qty');
			const syncDisplayAndUpdate = () => {
				if (!hCb || !bCb || !qEl) return;
				qEl.style.display = (hCb.checked || bCb.checked) ? '' : 'none';
				this.renderAdditionalProducts();
				this.updateOverviewTotalPrice();
			};
			if (hCb) {
				hCb.addEventListener('click', () => {
					if (hCb.checked && bCb) bCb.checked = false;
					syncDisplayAndUpdate();
				});
				hCb.addEventListener('change', syncDisplayAndUpdate);
			}
			if (bCb) {
				bCb.addEventListener('click', () => {
					if (bCb.checked && hCb) hCb.checked = false;
					syncDisplayAndUpdate();
				});
				bCb.addEventListener('change', syncDisplayAndUpdate);
			}
			if (qEl) {
				qEl.addEventListener('input', () => {
					syncDisplayAndUpdate();
				});
			}
			syncDisplayAndUpdate();
		}
		
		editConfigName() {
			const titleEl = document.getElementById('current-config-title');
			if (!titleEl) return;
			
			// Entferne alle existierenden Input-Felder
			const existingInputs = titleEl.parentNode.querySelectorAll('.config-title-input');
			existingInputs.forEach(input => input.remove());
			
			// Stelle sicher, dass der Titel sichtbar ist
			titleEl.style.display = 'block';
			
			// Erstelle Input-Feld
			const input = document.createElement('input');
			input.type = 'text';
			input.value = titleEl.textContent;
			input.className = 'config-title-input';
			input.style.cssText = `
				position: absolute;
				top: 0;
				left: 0;
				font-size: 24px;
				font-weight: bold;
				color: #000000;
				background: white;
				border: 2px solid #FFB101;
				border-radius: 8px;
				padding: 4px 8px;
				width: 200px;
				outline: none;
				z-index: 1000;
			`;
			
			// Füge Input hinzu ohne Titel zu ersetzen
			titleEl.parentNode.appendChild(input);
			input.focus();
			input.select();
			
			// Event-Listener für Enter und Blur
			const saveEdit = function() {
				const newName = input.value.trim();
				if (newName && this.currentConfig !== null) {
					this.configs[this.currentConfig].name = newName;
					titleEl.textContent = newName;
					this.updateConfigList();
					this.updateConfig();
					this.saveToCache();
					this.showAutoSaveIndicator();
				}
				input.remove();
			}.bind(this);
			
			const cancelEdit = function() {
				input.remove();
			}.bind(this);
			
			input.addEventListener('blur', saveEdit);
			input.addEventListener('keydown', function(e) {
				if (e.key === 'Enter') {
					e.preventDefault();
					saveEdit();
				} else if (e.key === 'Escape') {
					e.preventDefault();
					cancelEdit();
				}
			});
		}
		editConfigNameInList(configIndex) {
			const config = this.configs[configIndex];
			if (!config) return;
			
			// Finde das config-item Element
			const configItems = document.querySelectorAll('.config-item');
			const configItem = configItems[configIndex];
			if (!configItem) return;
			
			// Finde das name Element
			const nameEl = configItem.querySelector('.config-item-name');
			if (!nameEl) return;
			
			// Entferne alle existierenden Input-Felder in diesem Item
			const existingInputs = nameEl.parentNode.querySelectorAll('input[type="text"]');
			existingInputs.forEach(input => input.remove());
			
			// Stelle sicher, dass der Name sichtbar ist
			nameEl.style.display = 'block';
			
			// Erstelle Input-Feld
			const input = document.createElement('input');
			input.type = 'text';
			input.value = nameEl.textContent;
			input.className = 'inline-edit-input';
			
			// Input absolut über dem Namen platzieren, ohne Layout zu verschieben
			nameEl.appendChild(input);
			// Interaktionen im Input sollen die Item-Navigation nicht auslösen
			['click','mousedown','pointerdown'].forEach(evt => {
				input.addEventListener(evt, (e) => e.stopPropagation());
			});
			input.focus();
			input.select();
			
			// Event-Listener für Enter und Blur
			const saveEdit = function() {
				const newName = input.value.trim();
				if (newName) {
					config.name = newName;
					nameEl.textContent = newName;
					this.updateConfig();
					this.saveToCache();
					this.showAutoSaveIndicator();
				}
				if (input.parentNode) input.remove();
				this.updateConfigList();
			}.bind(this);
			
			const cancelEdit = function() {
				if (input.parentNode) input.remove();
			}.bind(this);
			
			input.addEventListener('blur', saveEdit);
			input.addEventListener('keydown', function(e) {
				if (e.key === 'Enter') {
					e.preventDefault();
					saveEdit();
				} else if (e.key === 'Escape') {
					e.preventDefault();
					cancelEdit();
				}
			});
		}
		
		deleteCurrentConfig() {
			if (this.configs.length <= 1) {
				alert('Die letzte Konfiguration kann nicht gelöscht werden.');
				return;
			}
			
			const currentConfig = this.configs[this.currentConfig];
			const configName = currentConfig?.name || `Konfiguration #${this.currentConfig + 1}`;
			
			if (confirm(`Möchten Sie "${configName}" wirklich löschen?`)) {
				this.configs.splice(this.currentConfig, 1);
				
				// Aktive Konfiguration anpassen
				if (this.currentConfig >= this.configs.length) {
					this.currentConfig = this.configs.length - 1;
				}
				
				this.loadConfig(this.currentConfig);
				this.saveToUrl();
				
				// Zurück zur Übersicht und Config-Liste updaten
				this.showOverview();
			}
		}
		
		deleteConfigFromList(configIndex) {
			if (this.configs.length <= 1) {
				alert('Die letzte Konfiguration kann nicht gelöscht werden.');
				return;
			}
			
			const config = this.configs[configIndex];
			const configName = config?.name || `Konfiguration #${configIndex + 1}`;
			
			if (confirm(`Möchten Sie "${configName}" wirklich löschen?`)) {
				this.configs.splice(configIndex, 1);
				
				// Aktive Konfiguration anpassen
				if (this.currentConfig >= this.configs.length) {
					this.currentConfig = this.configs.length - 1;
				} else if (this.currentConfig > configIndex) {
					this.currentConfig--;
				}
				
				this.loadConfig(this.currentConfig);
				this.saveToUrl();
				this.updateConfigList();
			}
			
			// Event propagation stoppen
			event.stopPropagation();
		}
		
		calculateConfigPrice(config) {
			// Verwende die ursprüngliche Berechnungslogik
			const parts = {
				Solarmodul: 0, Endklemmen: 0, Mittelklemmen: 0,
				Dachhaken: 0, Schrauben: 0, Endkappen: 0,
				Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0, Tellerkopfschraube: 0,
				UlicaSolarBlackJadeFlow: 0,
				// Palettenzählung wird als Stückbasis 36× gespeichert
				SolarmodulPalette: 0,
				UlicaSolarBlackJadeFlowPalette: 0
			};

			// Berechne Teile für jede Zeile
			for (let y = 0; y < config.rows; y++) {
				if (!Array.isArray(config.selection[y])) continue;
				let run = 0;

				for (let x = 0; x < config.cols; x++) {
					if (config.selection[y]?.[x]) {
						run++;
					}
					else if (run) { 
						this.processGroupDirectly(run, parts, config.cellWidth || 179, config.cellHeight || 113, config.orientation || 'vertical', config.ulicaModule || false); 
						run = 0; 
					}
				}
				if (run) {
					this.processGroupDirectly(run, parts, config.cellWidth || 179, config.cellHeight || 113, config.orientation || 'vertical', config.ulicaModule || false);
				}
			}
			
			// Module nur hinzufügen wenn Checkbox aktiviert ist
			const includeModules = document.getElementById('include-modules')?.checked || false;
			const ulicaModule = document.getElementById('ulica-module')?.checked || false;
			
			if (!includeModules) {
				delete parts.Solarmodul;
			}
			
			if (!ulicaModule) {
				delete parts.UlicaSolarBlackJadeFlow;
			}
			
			// Palettenlogik: 36er bündeln je nach Modultyp
			try {
				const pieceKey = ulicaModule ? 'UlicaSolarBlackJadeFlow' : 'Solarmodul';
				const palletKey = ulicaModule ? 'UlicaSolarBlackJadeFlowPalette' : 'SolarmodulPalette';
				const count = Number(parts[pieceKey] || 0);
				if (count > 0) {
					const pallets = Math.floor(count / 36);
					const remainder = count % 36;
					if (pallets > 0) {
						parts[palletKey] = (parts[palletKey] || 0) + pallets * 36; // Stückbasis
					}
					parts[pieceKey] = remainder;
				}
			} catch (e) {}
			
			let totalPrice = 0;
			Object.entries(parts).forEach(([partName, quantity]) => {
				if (quantity > 0) {
					const packagesNeeded = Math.ceil(quantity / (VE[partName] || 1));
					const pricePerPackage = getPackPriceForQuantity(partName, quantity);
					totalPrice += packagesNeeded * pricePerPackage;
				}
			});
			
			return totalPrice;
		}
		

		
		addAllConfigsToCart() {
			// Verwende die gleiche Logik wie addAllToCart()
			this.addAllToCart();
		}
		
		initSmartConfigFeatures() {
			console.log('Initializing Smart Config Features...');
			this.smartParser = new SmartConfigParser(this);
			this.bulkSelector = new BulkSelector(this);
			this.bulkSelector.initializeBulkSelection();
			
			// Stelle sicher, dass Smart Config und Tipps permanent sichtbar sind
			this.ensurePermanentVisibility();
			
			// Initialisiere Smart Config Close Button
			this.initSmartConfigCloseButton();
			
			// Initialisiere Quick Config Interface mit verbesserter Fehlerbehandlung
			this.initQuickConfigInterface();
			
			console.log('Smart Config Features initialized');
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
			// Verbesserte Initialisierung mit mehreren Versuchen
			const initSmartConfig = () => {
				const quickInput = document.getElementById('quick-config-input');
				
				if (!quickInput) {
					console.warn('Smart Config Input Element nicht gefunden, versuche erneut...');
					setTimeout(initSmartConfig, 100);
					return;
				}
				
				console.log('Smart Config Interface initialisiert (ohne Button)');
				
				// Entferne bestehende Event-Listener (falls vorhanden)
				const newQuickInput = quickInput.cloneNode(true);
				quickInput.parentNode.replaceChild(newQuickInput, quickInput);
				
				// Automatische Anwendung der Konfiguration
				const applyConfiguration = (input) => {
					if (input && input.trim()) {
						try {
							console.log('Smart Config Input:', input);
							
							// Clear preview timeout when applying configuration
							if (this.previewTimeout) {
								clearTimeout(this.previewTimeout);
								this.previewTimeout = null;
							}
							
							const config = this.smartParser.parseInput(input);
							console.log('Parsed config:', config);
							
							if (Object.keys(config).length > 0) {
								this.smartParser.applyPreviewToMainGrid(config);
								newQuickInput.value = ''; // Input leeren
								this.showToast('✅ Konfiguration angewendet', 1500);
							} else {
								this.showToast('⚠️ Keine gültige Konfiguration erkannt', 2000);
							}
						} catch (error) {
							console.error('Smart Config Error:', error);
							this.showToast(`❌ Fehler: ${error.message}`, 3000);
						}
					}
				};
				
				// Enter-Taste Support - automatische Anwendung
				newQuickInput.addEventListener('keypress', (e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						applyConfiguration(newQuickInput.value);
					}
				});
				
				// Feld verlassen (blur) Support - automatische Anwendung
				newQuickInput.addEventListener('blur', () => {
					setTimeout(() => {
						const input = newQuickInput.value.trim();
						if (input) {
							applyConfiguration(input);
						}
					}, 100); // Kurze Verzögerung für bessere UX
				});
				
				// Live-Grid-Preview bei jedem Tastendruck
				newQuickInput.addEventListener('input', (e) => {
					const input = e.target.value.trim();
					
					// Clear previous timeout
					if (this.previewTimeout) {
						clearTimeout(this.previewTimeout);
						this.previewTimeout = null;
					}
					
					// Update input validation status
					this.updateInputValidation(newQuickInput, input);
					
					if (input.length > 0) {
						try {
							const config = this.smartParser.parseInput(input);
							
							// Zeige Preview für gültige Konfigurationen
							if (config.cols || config.rows || config.moduleCount || config.orientation || config.adjustSpacing || config.rowConfig || config.action) {
								this.showConfigPreview(config);
								
								// Automatische Anwendung nach 2 Sekunden Inaktivität
								const self = this;
								this.previewTimeout = setTimeout(() => {
									if (self && self.clearGridPreview) {
										// Automatisch anwenden wenn gültige Konfiguration
										if (Object.keys(config).length > 0) {
											self.smartParser.applyPreviewToMainGrid(config);
											newQuickInput.value = ''; // Input leeren
											self.showToast('✅ Konfiguration automatisch angewendet', 1500);
										}
										self.clearGridPreview();
									}
								}, 2000); // Reduziert von 3 auf 2 Sekunden für bessere UX
							} else {
								// Keine gültige Konfiguration - Preview löschen
								this.clearGridPreview();
							}
						} catch (error) {
							console.error('Smart Config Preview Error:', error);
							// Bei Parsing-Fehler Preview löschen
							this.clearGridPreview();
						}
					} else {
						// Input leer - Preview löschen
						this.clearGridPreview();
					}
				});
				
				// Smart Config Help Dropdown Event-Handler initialisieren
				this.initializeSmartConfigHelp();
			};
			
			// Starte Initialisierung mit mehreren Versuchen
			setTimeout(initSmartConfig, 100);
			setTimeout(initSmartConfig, 500);
			setTimeout(initSmartConfig, 1000);
			
			// Zusätzlicher Versuch nach DOMContentLoaded
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', () => {
					setTimeout(initSmartConfig, 100);
				});
			}
		}
		
		updateInputValidation(inputElement, input) {
			// Entferne alle Validierungs-Klassen
			inputElement.classList.remove('input-valid', 'input-invalid', 'input-loading');
			
			if (input.length === 0) {
				return; // Keine Validierung für leere Eingabe
			}
			
			// Zeige Loading-Status
			inputElement.classList.add('input-loading');
			
			// Kurze Verzögerung für bessere UX
			setTimeout(() => {
				try {
					const config = this.smartParser.parseInput(input);
					console.log('Input validation result:', config);
					
					// Prüfe ob gültige Konfiguration
					if (config.cols || config.rows || config.moduleCount || config.orientation || config.adjustSpacing || config.rowConfig || config.action) {
						inputElement.classList.remove('input-loading');
						inputElement.classList.add('input-valid');
						console.log('Input is valid');
					} else {
						inputElement.classList.remove('input-loading');
						inputElement.classList.add('input-invalid');
						console.log('Input is invalid');
					}
				} catch (error) {
					console.error('Input validation error:', error);
					inputElement.classList.remove('input-loading');
					inputElement.classList.add('input-invalid');
				}
			}, 100);
		}

		showConfigPreview(config) {
			console.log('Showing config preview:', config);
			
			// Grid-Preview für alle Konfigurationen die das Grid beeinflussen
			if (
				config.cols || config.rows || config.moduleCount || config.orientation || config.adjustSpacing || config.rowConfig ||
				config.selectRows || config.gapRows || config.selectColumns || config.gapColumns ||
				config.selectAreaRows || config.selectAreaCols || config.fillOnlyFrame || config.clearFrame ||
				config.fillLeftHalf || config.clearRightHalf || config.everySecondRowsStart ||
				config.clearTopRow || config.clearBottomRow || config.fillFirstNColumns || config.clearFirstNColumns || config.clearLastNColumns ||
				config.fillFirstNRows || config.clearFirstNRows || config.fillLastNRows || config.clearLastNRows ||
				config.fillBlock || config.fillBlockRelative
			) {
				// this ist die SolarGrid Instanz selbst, also können wir direkt auf ihre Methoden zugreifen
				if (this && typeof this.showGridPreview === 'function') {
					try {
						this.showGridPreview(config);
						console.log('Grid preview shown successfully');
					} catch (error) {
						console.error('Error showing grid preview:', error);
					}
				} else {
					console.error('showGridPreview method not available!');
				}
			} else {
				console.log('No grid-affecting config found, skipping preview');
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
			
            // Entfernt: Automatisches Schließen bei Klick außerhalb – Dropdown bleibt offen, bis der Nutzer weg hovert
			
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
						
                        // Dropdown bleibt sichtbar, damit Nutzer weitere Beispiele wählen kann
						
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
  		this.updateSaveButtons();
		}
		
		// Neue Funktion für Grid-Event-Listener

		
		// Neue Funktion für alle Event-Listener
		setupAllEventListeners() {
			// Input-Event-Listener
			const inputs = [this.wIn, this.hIn].filter(el => el);
			inputs.forEach(el => {
				el.removeEventListener('change', this.handleInputChange);
				el.addEventListener('change', this.handleInputChange.bind(this));
			});
			
			// Modul-Auswahl-Event-Listener
			if (this.moduleSelect) {
				this.moduleSelect.removeEventListener('change', this.handleModuleSelectChange);
				this.moduleSelect.addEventListener('change', this.handleModuleSelectChange.bind(this));
			}
			
			// Orientation-Event-Listener
			if (this.orH && this.orV) {
				[this.orH, this.orV].forEach(el => {
					el.removeEventListener('change', this.handleOrientationChange);
					el.addEventListener('change', this.handleOrientationChange.bind(this));
				});
				// Synchronisiere Buttons nach Radio-Button Setup
				setTimeout(() => {
					this.syncOrientationButtons();
				}, 10);
			}
			
					// Checkbox-Event-Listener
		[this.incM, this.mc4, this.solarkabel, this.holz, this.quetschkabelschuhe, this.erdungsband, this.ulicaModule].filter(el => el).forEach(el => {
			el.removeEventListener('change', this.handleCheckboxChange);
			el.addEventListener('change', this.handleCheckboxChange.bind(this));
		});
		
		// Zusätzliche Event-Listener für Modul-Checkboxen im Dropdown
		document.querySelectorAll('#include-modules, #ulica-module').forEach(el => {
			el.removeEventListener('change', this.handleCheckboxChange);
			el.addEventListener('change', this.handleCheckboxChange.bind(this));
		});
			
			// Expansion-Button-Event-Listener mit stabiler Referenz
			if (!this.boundExpansionClick) {
				this.boundExpansionClick = this.handleExpansionClick.bind(this);
			}
			document.querySelectorAll('[data-dir="right"]').forEach(btn => {
				btn.removeEventListener('click', this.boundExpansionClick);
				btn.addEventListener('click', this.boundExpansionClick);
			});
			document.querySelectorAll('[data-dir="left"]').forEach(btn => {
				btn.removeEventListener('click', this.boundExpansionClick);
				btn.addEventListener('click', this.boundExpansionClick);
			});
			document.querySelectorAll('[data-dir="top"]').forEach(btn => {
				btn.removeEventListener('click', this.boundExpansionClick);
				btn.addEventListener('click', this.boundExpansionClick);
			});
			document.querySelectorAll('[data-dir="bottom"]').forEach(btn => {
				btn.removeEventListener('click', this.boundExpansionClick);
				btn.addEventListener('click', this.boundExpansionClick);
			});
			
			// Orientation-Button-Event-Listener
			const orientHBtn = document.getElementById('orient-h');
			const orientVBtn = document.getElementById('orient-v');
			if (orientHBtn && orientVBtn) {
				// Verwende eine gebundene Referenz, damit removeEventListener korrekt funktioniert
				if (!this.boundOrientationClick) {
					this.boundOrientationClick = this.handleOrientationButtonClick.bind(this);
				}
				[orientHBtn, orientVBtn].forEach(btn => {
					btn.removeEventListener('click', this.boundOrientationClick);
					btn.addEventListener('click', this.boundOrientationClick);
				});
				// Sofortige Synchronisation
				this.syncOrientationButtons();
			} else {
				// Fallback: Versuche es später nochmal
				setTimeout(() => {
					const orientHBtn = document.getElementById('orient-h');
					const orientVBtn = document.getElementById('orient-v');
					if (orientHBtn && orientVBtn) {
						if (!this.boundOrientationClick) {
							this.boundOrientationClick = this.handleOrientationButtonClick.bind(this);
						}
						[orientHBtn, orientVBtn].forEach(btn => {
							btn.removeEventListener('click', this.boundOrientationClick);
							btn.addEventListener('click', this.boundOrientationClick);
						});
						// Synchronisiere Orientation Buttons nach dem Setup
						this.syncOrientationButtons();
					}
				}, 50); // Reduzierte Verzögerung
			}
		}
		
		// Event-Handler-Funktionen
		
		// Hilfsfunktion für robuste Orientation-Button-Synchronisation
		ensureOrientationButtonsSync() {
			const orientHBtn = document.getElementById('orient-h');
			const orientVBtn = document.getElementById('orient-v');
			
			if (!orientHBtn || !orientVBtn || !this.orH || !this.orV) return;
			
			// Prüfe ob Buttons korrekt synchronisiert sind
			const isVerticalActive = orientVBtn.classList.contains('active');
			const isHorizontalActive = orientHBtn.classList.contains('active');
			const radioVerticalChecked = this.orV.checked;
			const radioHorizontalChecked = this.orH.checked;
			
			// Wenn Inkonsistenz festgestellt wird, korrigiere sie
			if ((isVerticalActive !== radioVerticalChecked) || (isHorizontalActive !== radioHorizontalChecked)) {
				this.syncOrientationButtons();
			}
		}
		
		handleModuleSelectChange() {
			this.trackInteraction();
			const selectedValue = this.moduleSelect.value;
			
			if (selectedValue === '' || selectedValue === 'custom') {
				// Kein Modul ausgewählt oder Benutzerdefiniert - Inputs freigeben
				this.enableInputs();
				this.updateSize();
				this.buildList();
				this.updateSummaryOnChange();
				// Alle Modul-Checkboxen abwählen
				this.clearModuleCheckboxes();
			} else if (this.moduleData[selectedValue]) {
				// Modul ausgewählt - Werte setzen und Inputs sperren
				const module = this.moduleData[selectedValue];
				this.wIn.value = module.width;
				this.hIn.value = module.height;
				// Aktualisiere auch die aktuelle Konfiguration mit den neuen Zellgrößen
				if (this.currentConfig !== null && this.configs[this.currentConfig]) {
					this.configs[this.currentConfig].cellWidth = module.width;
					this.configs[this.currentConfig].cellHeight = module.height;
				}
				this.disableInputs();
				this.updateSize();
				this.buildList();
				this.updateSummaryOnChange();
				
				// Keine Checkbox-Interaktion mehr - nur Dropdown-Werte setzen
				this.clearModuleCheckboxes();
			}
		}
		
		// Neue Funktionen für Modul-Checkbox-Synchronisation
		handleModuleCheckboxChange(checkboxId) {
			this.trackInteraction();
			
			// Nur eine Modul-Checkbox darf ausgewählt sein
			if (checkboxId === 'include-modules' && this.incM.checked) {
				// include-modules wurde ausgewählt - ulica-module abwählen
				if (this.ulicaModule) {
					this.ulicaModule.checked = false;
				}
				// Dropdown auf ulica-450 setzen und Input-Werte anpassen
				if (this.moduleSelect) {
					this.moduleSelect.value = 'ulica-450';
					// Input-Werte für ulica-450 setzen
					if (this.wIn) this.wIn.value = '176.2';
					if (this.hIn) this.hIn.value = '113.4';
					if (this.currentConfig !== null && this.configs[this.currentConfig]) {
						this.configs[this.currentConfig].cellWidth = 176.2;
						this.configs[this.currentConfig].cellHeight = 113.4;
					}
					this.disableInputs();
				}
			} else if (checkboxId === 'ulica-module' && this.ulicaModule.checked) {
				// ulica-module wurde ausgewählt - include-modules abwählen
				if (this.incM) {
					this.incM.checked = false;
				}
				// Dropdown auf ulica-500 setzen und Input-Werte anpassen
				if (this.moduleSelect) {
					this.moduleSelect.value = 'ulica-500';
					// Input-Werte für ulica-500 setzen
					if (this.wIn) this.wIn.value = '195.2';
					if (this.hIn) this.hIn.value = '113.4';
					if (this.currentConfig !== null && this.configs[this.currentConfig]) {
						this.configs[this.currentConfig].cellWidth = 195.2;
						this.configs[this.currentConfig].cellHeight = 113.4;
					}
					this.disableInputs();
				}
			}
			
			// Grid und Berechnungen aktualisieren
			this.updateSize();
			this.buildGrid();
			this.buildList();
			this.updateSummaryOnChange();
			this.updateConfig();
			// Neu: Modul-Checkboxen gelten global -> auf alle Konfigurationen anwenden
			this.updateAllConfigurationsForCheckboxes();
		}
		
		clearModuleCheckboxes() {
			if (this.incM) this.incM.checked = false;
			if (this.ulicaModule) this.ulicaModule.checked = false;
		}
		
		handleInputChange() {
			this.trackInteraction();
			this.updateSize();
			this.buildList();
			this.updateSummaryOnChange();
		}
		
		handleOrientationChange() {
			this.trackInteraction();
			this.updateSize();
			this.buildGrid();
			this.buildList();
			this.updateSummaryOnChange();
		}
		
		handleCheckboxChange() {
			this.trackInteraction();
			
			// Prüfe ob es sich um eine Modul-Checkbox handelt
			const checkboxId = event.target.id;
			if (checkboxId === 'include-modules' || checkboxId === 'ulica-module') {
				this.handleModuleCheckboxChange(checkboxId);
			} else {
				// Ursprüngliche Funktion: Update aller Konfigurationen für Checkboxen
				this.updateAllConfigurationsForCheckboxes();
			}
		}
		
		handleExpansionClick(e) {
			this.trackInteraction();
			const dir = e.target.dataset.dir;
			const isPlus = e.target.classList.contains('plus-btn');
			
			if (dir === 'right') {
				isPlus ? this.addColumnRight() : this.removeColumnRight();
			} else if (dir === 'left') {
				isPlus ? this.addColumnLeft() : this.removeColumnLeft();
			} else if (dir === 'top') {
				isPlus ? this.addRowTop() : this.removeRowTop();
			} else if (dir === 'bottom') {
				isPlus ? this.addRowBottom() : this.removeRowBottom();
			}
		}
		
		handleOrientationButtonClick(e) {
			const orientHBtn = document.getElementById('orient-h');
			const orientVBtn = document.getElementById('orient-v');
			
			if (!orientHBtn || !orientVBtn) return;
			
			// Verhindere mehrfache Klicks während der Verarbeitung
			if (this.orientationProcessing) return;
			this.orientationProcessing = true;
			
			// Bestimme die neue Orientierung basierend auf dem Button, der den Handler ausgelöst hat
			const clickedBtn = e.currentTarget || e.target;
			const isVertical = clickedBtn === orientVBtn;
			const newOrientation = isVertical ? 'vertical' : 'horizontal';
			
			// Sofortige visuelle Rückmeldung
			orientHBtn.classList.remove('active');
			orientVBtn.classList.remove('active');
			if (clickedBtn && clickedBtn.classList) clickedBtn.classList.add('active');
			
			// Radio-Buttons synchronisieren
			if (this.orV) this.orV.checked = isVertical;
			if (this.orH) this.orH.checked = !isVertical;
			
			this.trackInteraction();
			
			// Sofortige Grid-Updates ohne Verzögerung
			this.updateSize();
			this.buildGrid();
			
			// Verzögerte Updates für Performance
			setTimeout(() => {
				this.buildList();
				this.updateSummaryOnChange();
				this.orientationProcessing = false;
				// Zusätzliche Synchronisation für Robustheit
				this.ensureOrientationButtonsSync();
			}, 10); // Reduzierte Verzögerung für bessere Reaktionszeit
		}
		
		// NEUE FUNKTION: Synchronisiere Orientation Buttons
		syncOrientationButtons() {
			const orientHBtn = document.getElementById('orient-h');
			const orientVBtn = document.getElementById('orient-v');
			
			if (!orientHBtn || !orientVBtn || !this.orH || !this.orV) return;
			
			// Entferne active Klasse von beiden Buttons
			orientHBtn.classList.remove('active');
			orientVBtn.classList.remove('active');
			
			// Setze active Klasse basierend auf Radio-Button Status
			// Priorisiere orV.checked für konsistente Logik
			if (this.orV.checked) {
				orientVBtn.classList.add('active');
			} else if (this.orH.checked) {
				orientHBtn.classList.add('active');
			} else {
				// Fallback: Standard auf vertikal setzen
				this.orV.checked = true;
				this.orH.checked = false;
				orientVBtn.classList.add('active');
			}
		}
		
		// Input-Sperr-Funktionen
		disableInputs() {
			if (this.wIn) {
				this.wIn.disabled = true;
				this.wIn.style.backgroundColor = '#f0f0f0';
				this.wIn.style.cursor = 'not-allowed';
			}
			if (this.hIn) {
				this.hIn.disabled = true;
				this.hIn.style.backgroundColor = '#f0f0f0';
				this.hIn.style.cursor = 'not-allowed';
			}
		}
		
		enableInputs() {
			if (this.wIn) {
				this.wIn.disabled = false;
				this.wIn.style.backgroundColor = '';
				this.wIn.style.cursor = '';
			}
			if (this.hIn) {
				this.hIn.disabled = false;
				this.hIn.style.backgroundColor = '';
				this.hIn.style.cursor = '';
			}
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
		const inputW = parseFloat(this.wIn ? this.wIn.value : '179') || 179;
		const inputH = parseFloat(this.hIn ? this.hIn.value : '113') || 113;
  		
  				// Bei vertikaler Orientierung: Breite und Höhe der Zellen tauschen
		const isVertical = this.orV ? this.orV.checked : false;
  		const originalCellW = isVertical ? inputH : inputW;
  		const originalCellH = isVertical ? inputW : inputH;
  		
  				// Maximale verfügbare Größe
		// 80px Abstand auf allen Seiten: links, rechts, oben, unten
		// Insgesamt 160px für Breite (80px links + 80px rechts) und 160px für Höhe (80px oben + 80px unten)
		const maxWidth = this.wrapper ? this.wrapper.clientWidth - 160 : 800; // grid-wrapper Breite - 160px (80px links + 80px rechts)
		const maxHeight = this.wrapper ? this.wrapper.clientHeight - 160 : 600; // grid-wrapper Höhe - 160px (80px oben + 80px unten)
  		
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
  		
  		// Performance: Verwende DocumentFragment für bessere Performance
  		const fragment = document.createDocumentFragment();
  		
  		// CSS-Variablen setzen
  		document.documentElement.style.setProperty('--cols', this.cols);
  		document.documentElement.style.setProperty('--rows', this.rows);

  		// Batch-Erstellung aller Zellen - optimiert für Orientation Changes
  		for (let y = 0; y < this.rows; y++) {
    		if (!Array.isArray(this.selection[y])) continue;

    		for (let x = 0; x < this.cols; x++) {
      		const cell = document.createElement('div');
      		cell.className = 'grid-cell';
      		if (this.selection[y]?.[x]) cell.classList.add('selected');
      		
      		// FEATURE 6: Screen Reader Support - ARIA-Labels
      		cell.setAttribute('role', 'button');
      		cell.setAttribute('tabindex', '0');
      		cell.setAttribute('aria-label', `Modul ${x + 1}, ${y + 1} - ${this.selection[y]?.[x] ? 'ausgewählt' : 'nicht ausgewählt'}`);
      		cell.setAttribute('aria-pressed', this.selection[y]?.[x] ? 'true' : 'false');

      		// Event-Listener optimiert
      		cell.addEventListener('click', () => {
        		if (!this.selection[y]) this.selection[y] = [];
        		this.selection[y][x] = !this.selection[y][x];
        		cell.classList.toggle('selected');
        		
        		// FEATURE 6: Screen Reader Support - Update ARIA
        		cell.setAttribute('aria-pressed', this.selection[y][x] ? 'true' : 'false');
        		cell.setAttribute('aria-label', `Modul ${x + 1}, ${y + 1} - ${this.selection[y][x] ? 'ausgewählt' : 'nicht ausgewählt'}`);
        		
        		// Performance: Update aktuelle Konfiguration ohne Deep Copy
        		if (this.currentConfig !== null && this.configs[this.currentConfig]) {
        			// Direkte Referenz statt JSON.parse/stringify
        			this.configs[this.currentConfig].selection = this.selection;
        			// Speichere die Konfiguration automatisch
        			this.updateConfig();
        		}
        		
        		this.trackInteraction();
        		// Performance: Sofortige Produktliste Update + Debounced Summary
        		this.buildList();
        		this.updateSummaryOnChange();
        		
        		// Update config-list und overview wenn eine Konfiguration ausgewählt ist
        		if (this.currentConfig !== null) {
        			this.updateConfigList();
        		}
      		});
       
      		// FEATURE 6: Screen Reader Support - Keyboard Navigation
      		cell.addEventListener('keydown', (e) => {
        		if (e.key === 'Enter' || e.key === ' ') {
        			e.preventDefault();
        			cell.click();
        		}
      		});

      		// Animation entfernt für bessere Performance
      		// const dx = x - centerX;
      		// const dy = y - centerY;
      		// const distance = Math.sqrt(dx * dx + dy * dy);
      		// const delay = distance * delayPerUnit;
      		// cell.style.animationDelay = `${delay}ms`;
      		// setTimeout(() => cell.classList.remove('animate-in'), 400);
      		fragment.appendChild(cell);
    		}
  		}
  		
  		// Einmalige DOM-Manipulation
  		this.gridEl.innerHTML = '';
  		this.gridEl.appendChild(fragment);
		}
    
    async buildList() {
      try {
        // Performance: Cached panel count calculation
        const panelCount = this.selection.flat().filter(v => v).length;
        
        // Verwende die gleiche Berechnungslogik wie calculateConfigPrice für Konsistenz
        const currentConfig = {
          selection: this.selection,
          cols: this.cols,
          rows: this.rows,
          cellWidth: parseInt(this.wIn?.value || '179'),
          cellHeight: parseInt(this.hIn?.value || '113'),
          orientation: this.orV?.checked ? 'vertical' : 'horizontal',
          ulicaModule: document.getElementById('ulica-module')?.checked || false
        };
        
        // Verwende calculateConfigPrice Logik für die Teile-Berechnung
        const parts = {
          Solarmodul: 0, Endklemmen: 0, Mittelklemmen: 0,
          Dachhaken: 0, Schrauben: 0, Endkappen: 0,
          Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0, Tellerkopfschraube: 0,
          UlicaSolarBlackJadeFlow: 0
        };

        // Berechne Teile für jede Zeile (gleiche Logik wie calculateConfigPrice)
        for (let y = 0; y < currentConfig.rows; y++) {
          if (!Array.isArray(currentConfig.selection[y])) continue;
          let run = 0;

          for (let x = 0; x < currentConfig.cols; x++) {
            if (currentConfig.selection[y]?.[x]) {
              run++;
            }
            else if (run) { 
              this.processGroupDirectly(run, parts, currentConfig.cellWidth || 179, currentConfig.cellHeight || 113, currentConfig.orientation || 'vertical', currentConfig.ulicaModule || false); 
              run = 0; 
            }
          }
          if (run) {
            this.processGroupDirectly(run, parts, currentConfig.cellWidth || 179, currentConfig.cellHeight || 113, currentConfig.orientation || 'vertical', currentConfig.ulicaModule || false);
          }
        }
        
        // Module nur hinzufügen wenn Checkbox aktiviert ist (gleiche Logik wie calculateConfigPrice)
        const includeModules = document.getElementById('include-modules')?.checked || false;
        const ulicaModule = document.getElementById('ulica-module')?.checked || false;
        
        if (!includeModules) {
          delete parts.Solarmodul;
        }
        
        if (!ulicaModule) {
          delete parts.UlicaSolarBlackJadeFlow;
        }
        
        // Zusatzprodukte: Erdungsband wieder in die Produktliste aufnehmen wenn Checkbox aktiv
        if (this.erdungsband && this.erdungsband.checked) {
          parts.Erdungsband = this.calculateErdungsband();
        } else {
          delete parts.Erdungsband;
        }


      // Palettenlogik für Produktliste (36er-Bündel je nach Modultyp)
      try {
        const pieceKey = ulicaModule ? 'UlicaSolarBlackJadeFlow' : 'Solarmodul';
        const palletKey = ulicaModule ? 'UlicaSolarBlackJadeFlowPalette' : 'SolarmodulPalette';
        const count = Number(parts[pieceKey] || 0);
        if (count > 0) {
          const pallets = Math.floor(count / 36);
          const remainder = count % 36;
          if (pallets > 0) {
            parts[palletKey] = (parts[palletKey] || 0) + pallets * 36; // Stückbasis
          }
          parts[pieceKey] = remainder;
        }
      } catch (e) {}

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
        // Performance: Reduziere DOM-Manipulation
        const fragment = document.createDocumentFragment();
        entries.forEach(([k,v]) => {
          const packs = Math.ceil(v / VE[k]);
          const price = getPackPriceForQuantity(k, v);
          const itemTotal = packs * price;
          const div = document.createElement('div');
          div.className = 'produkt-item';
          
          // Spezielle Behandlung für Erdungsband: Zeige Länge statt Anzahl
          let itemDetails = `(${v})`;
          let itemVE = `${VE[k]} Stück`;
          if (k === 'Erdungsband' && this.erdungsbandtotal) {
            itemDetails = `(${Number(this.erdungsbandtotal).toFixed(2)} cm)`;
            itemVE = `600 cm`;
          }
          // Zusätzliche Formatierungen für bestimmte Zusatzprodukte
          if (k === 'Solarkabel') {
            itemVE = '100 m';
          }
          if (k === 'MC4_Stecker') {
            itemVE = '50 Stück';
          }
          
          div.innerHTML = `
            <div class="item-left">
              <span class="item-quantity">${packs}×</span>
              <div class="item-info">
                <span class="item-name">${PRODUCT_NAME_MAP[k] || k.replace(/_/g,' ')}</span>
                <span class="item-ve">${itemVE}</span>
              </div>
              <span class="item-details">${itemDetails}</span>
            </div>
            <span class="item-price">${itemTotal.toFixed(2).replace('.', ',')} €</span>
          `;
          fragment.appendChild(div);
        });
        this.prodList.innerHTML = '';
        this.prodList.appendChild(fragment);
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

  		// Setze Inputs und interne Werte
  		this.wIn.value = width;
  		this.hIn.value = height;
  		
  		// Setze Orientierung auf Standard (vertikal als Standard)
		const defaultVertical = true; // Vertikal als Standard
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
		if (this.quetschkabelschuhe) this.quetschkabelschuhe.checked = false;
		if (this.erdungsband) this.erdungsband.checked = false;
		if (this.ulicaModule) this.ulicaModule.checked = false;
		
		// Module Dropdown auf Default zurücksetzen
		if (this.moduleSelect) {
			this.moduleSelect.value = '';
			this.enableInputs();
		}

  		this.cols = cols;
  		this.rows = rows;

  		// Leere Auswahl - alle Module abwählen
  		this.selection = Array.from({ length: this.rows }, () =>
    		Array.from({ length: this.cols }, () => false)
  		);

  		// Aktualisiere alles
  		this.setup();
  		this.buildGrid();
  		this.buildList();
  		this.updateSummaryOnChange();
		}
    
    	resetToDefaultGrid() {
		if (this.colsIn) this.colsIn.value = this.default.cols;
		if (this.rowsIn) this.rowsIn.value = this.default.rows;
		if (this.wIn) this.wIn.value = this.default.width;
		if (this.hIn) this.hIn.value = this.default.height;
		if (this.orH) this.orH.checked = false;
		if (this.orV) this.orV.checked = true;

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
      // Verwende immer den Fallback für Tellerkopfschraube-Berechnung
      return this.calculatePartsSync();
    }

    // Fallback synchrone Berechnung (ursprüngliche Methode)
    calculatePartsSync() {
  		const p = {
    		Solarmodul: 0, UlicaSolarBlackJadeFlow: 0, Endklemmen: 0, Mittelklemmen: 0,
    		Dachhaken: 0, Schrauben: 0, Endkappen: 0,
    		Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0, Tellerkopfschraube: 0,
    		Erdungsband: 0
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

  		// Erdungsband-Berechnung nur wenn gewünscht
  		if (this.erdungsband && this.erdungsband.checked) {
  			p.Erdungsband = this.calculateErdungsband();
  		}

  		return p;
		}
    processGroup(len, p) {
      // Verwende die korrekte Schienenlogik (wie im Worker)
      const isVertical = this.orV?.checked;
      const actualCellWidth = isVertical ? parseFloat(this.hIn?.value || '113') : parseFloat(this.wIn?.value || '179');
      
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
      
      p.Schiene_360_cm     += cnt360 * 2;
      p.Schiene_240_cm     += cnt240 * 2;
      p.Schienenverbinder  += (cnt360 + cnt240 - 1) * 4;
      p.Endklemmen         += 4;
      p.Mittelklemmen      += len > 1 ? (len - 1) * 2 : 0;
      p.Dachhaken          += len > 1 ? len * 3 : 4;
      p.Endkappen          += 4; // Gleich wie Endklemmen
      p.Solarmodul         += len;
      if (this.ulicaModule && this.ulicaModule.checked) {
        p.UlicaSolarBlackJadeFlow += len;
      }
      p.Schrauben          += len > 1 ? len * 3 : 4; // Basierend auf Dachhaken
      p.Tellerkopfschraube += len > 1 ? (len * 3) * 2 : 8; // Basierend auf Dachhaken * 2
    }

    mapImage(key) {
      // Verwende zentrale Produkt-Konfiguration oder Fallback
      return PRODUCT_IMAGES[key] || '';
    }

    // Erdungsband-Berechnung
    calculateErdungsband() {
      const isVertical = this.orV?.checked;
      const moduleHeight = isVertical ? parseFloat(this.wIn?.value || '179') : parseFloat(this.hIn?.value || '113');
      const gap = 2; // 2cm Lücke zwischen Modulen
      
      // Kopiere selection Matrix für Erdungsbandlength-Tracking
      const erdungsbandMatrix = this.selection.map(row => [...row]);
      
      let erdungsbandtotal = 0;
      
      // Analysiere Grid von oben nach unten, links nach rechts
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const result = this.analyzeFieldForErdungsband(x, y, erdungsbandMatrix, moduleHeight, gap);
          erdungsbandtotal += result;
        }
      }
      
      // Speichere Erdungsbandtotal für Display
      this.erdungsbandtotal = erdungsbandtotal;
      
      // Berechne Anzahl benötigter Erdungsbänder
      return Math.ceil(erdungsbandtotal / 600);
    }

    // Analysiere ein Feld für Erdungsband
    analyzeFieldForErdungsband(x, y, erdungsbandMatrix, moduleHeight, gap) {
      // Schritt 1: Hat das Feld ein Modul?
      if (!erdungsbandMatrix[y]?.[x]) {
        return 0; // Kein Modul, nächstes Feld
      }
      
      // Schritt 2: Hat das Modul ein weiteres Modul direkt darunter?
      if (y + 1 >= this.rows || !erdungsbandMatrix[y + 1]?.[x]) {
        return 0; // Kein Modul darunter, nächstes Feld
      }
      
      // Schritt 3: Ist links vom aktuellen Feld ein weiteres Feld mit Modul?
      if (x === 0 || !erdungsbandMatrix[y]?.[x - 1]) {
        // Kein Modul links → Erdungsbandlength für aktuelles Feld + Feld darunter
        return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
      }
      
      // Schritt 4: Hat das linke Feld ein Modul darunter?
      if (y + 1 >= this.rows || !erdungsbandMatrix[y + 1]?.[x - 1]) {
        // Kein Modul unter dem linken Feld → Erdungsbandlength für aktuelles Feld + Feld darunter
        return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
      }
      
      // Schritt 5: Haben die beiden linken Felder bereits Erdungsbandlength?
      return this.checkLeftFieldsErdungsband(x, y, erdungsbandMatrix, moduleHeight, gap);
    }

    // Prüfe linke Felder auf Erdungsbandlength
    checkLeftFieldsErdungsband(x, y, erdungsbandMatrix, moduleHeight, gap) {
      const leftUpper = erdungsbandMatrix[y]?.[x - 1];
      const leftLower = erdungsbandMatrix[y + 1]?.[x - 1];
      
      if (leftUpper && leftLower) {
        // Beide haben Module → Prüfe ob sie bereits Erdungsbandlength haben
        if (leftUpper === 'erdungsband' && leftLower === 'erdungsband') {
          // Beide haben Erdungsbandlength → Nichts tun
          return 0;
        } else if (leftUpper === 'erdungsband' && leftLower !== 'erdungsband') {
          // Nur das obere hat Erdungsbandlength → Erdungsbandlength für aktuelles Feld + Feld darunter
          return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
        } else {
          // Keine Erdungsbandlength links → Rekursiv weiter links prüfen
          return this.checkLeftFieldsRecursive(x, y, erdungsbandMatrix, moduleHeight, gap);
        }
      } else if (leftUpper && !leftLower) {
        // Nur oberes Feld hat Modul → Erdungsbandlength für aktuelles Feld + Feld darunter
        return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
      } else {
        // Keine Module links → Erdungsbandlength für aktuelles Feld + Feld darunter
        return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
      }
    }

    // Rekursiv weiter links prüfen
    checkLeftFieldsRecursive(x, y, erdungsbandMatrix, moduleHeight, gap) {
      let checkX = x - 2; // Ein Feld weiter links
      
      while (checkX >= 0) {
        // Schritt 3: Hat das Feld links ein Modul?
        if (!erdungsbandMatrix[y]?.[checkX]) {
          // Kein Modul links → Erdungsbandlength für aktuelles Feld + Feld darunter
          return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
        }
        
        // Schritt 4: Hat das linke Feld ein Modul darunter?
        if (y + 1 >= this.rows || !erdungsbandMatrix[y + 1]?.[checkX]) {
          // Kein Modul unter dem linken Feld → Erdungsbandlength für aktuelles Feld + Feld darunter
          return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
        }
        
        // Schritt 5: Haben die beiden linken Felder bereits Erdungsbandlength?
        const leftUpper = erdungsbandMatrix[y]?.[checkX];
        const leftLower = erdungsbandMatrix[y + 1]?.[checkX];
        
        if (leftUpper === 'erdungsband' && leftLower === 'erdungsband') {
          // Beide haben Erdungsbandlength → Nichts tun
          return 0;
        } else if (leftUpper === 'erdungsband' && leftLower !== 'erdungsband') {
          // Nur das obere hat Erdungsbandlength → Erdungsbandlength für aktuelles Feld + Feld darunter
          return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
        } else {
          // Keine Erdungsbandlength → Weiter nach links
          checkX--;
          continue;
        }
      }
      
      // Keine Module mehr links → Erdungsbandlength für aktuelles Feld + Feld darunter
      return this.assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap);
    }

    // Weise Erdungsbandlength zu
    assignErdungsbandLength(x, y, erdungsbandMatrix, moduleHeight, gap) {
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






    
    		loadConfig(idx) {
			const cfg = this.configs[idx];
			this.currentConfig = idx;

			// Input-Werte setzen
			this.wIn.value = cfg.cellWidth;
			this.hIn.value = cfg.cellHeight;
			this.orV.checked = cfg.orientation === 'vertical';
			this.orH.checked = !this.orV.checked;
			
			// Synchronisiere mit den Orientation Buttons
			this.syncOrientationButtons();
			this.incM.checked = cfg.incM;
			this.mc4.checked = cfg.mc4;
			this.solarkabel.checked = cfg.solarkabel || false; // Fallback für alte Konfigurationen
			this.holz.checked = cfg.holz;
			this.quetschkabelschuhe.checked = cfg.quetschkabelschuhe || false; // Fallback für alte Konfigurationen
			if (this.erdungsband) this.erdungsband.checked = cfg.erdungsband || false; // Fallback für alte Konfigurationen
			if (this.ulicaModule) this.ulicaModule.checked = cfg.ulicaModule || false; // Fallback für alte Konfigurationen

			// STATE Werte setzen - WICHTIG: Vor setup() setzen
			this.cols = cfg.cols;
			this.rows = cfg.rows;
			this.selection = cfg.selection.map(r => [...r]);

			// Setup aufrufen (baut Grid mit korrekter Auswahl auf)
			this.setup();

			// Produktliste und Summary aktualisieren
			this.buildList();
			this.updateSummaryOnChange();

			this.renderConfigList();
			this.updateSaveButtons();
			
			// Detail-Ansicht aktualisieren wenn aktiv
			this.updateDetailView();
		}
		
		// Spezielle Funktion für Cache-Load ohne Orientation-Überschreibung
		loadConfigFromCache(idx) {
			const cfg = this.configs[idx];
			this.currentConfig = idx;

			// Input-Werte setzen (OHNE Orientation)
			this.wIn.value = cfg.cellWidth;
			this.hIn.value = cfg.cellHeight;
			// Orientation wird NICHT gesetzt - bleibt aus dem Cache
			
			this.incM.checked = cfg.incM;
			this.mc4.checked = cfg.mc4;
			this.solarkabel.checked = cfg.solarkabel || false;
			this.holz.checked = cfg.holz;
			this.quetschkabelschuhe.checked = cfg.quetschkabelschuhe || false;
			if (this.erdungsband) this.erdungsband.checked = cfg.erdungsband || false;
			if (this.ulicaModule) this.ulicaModule.checked = cfg.ulicaModule || false;

			// STATE Werte setzen
			this.cols = cfg.cols;
			this.rows = cfg.rows;
			this.selection = cfg.selection.map(r => [...r]);

			// Setup aufrufen
			this.setup();

			// Produktliste und Summary aktualisieren
			this.buildList();
			this.updateSummaryOnChange();

			this.renderConfigList();
			this.updateSaveButtons();
			
			// Detail-Ansicht aktualisieren wenn aktiv
			this.updateDetailView();
		}
		
		// Spezielle Funktion für Cache-Load der ersten Konfiguration mit korrekter Orientation
		loadFirstConfigFromCache() {
			if (this.configs.length === 0) return;
			
			const cfg = this.configs[0];
			this.currentConfig = 0;

			// Input-Werte setzen
			this.wIn.value = cfg.cellWidth;
			this.hIn.value = cfg.cellHeight;
			// Orientation wird NICHT gesetzt - bleibt aus dem Cache
			
			this.incM.checked = cfg.incM;
			this.mc4.checked = cfg.mc4;
			this.solarkabel.checked = cfg.solarkabel || false;
			this.holz.checked = cfg.holz;
			this.quetschkabelschuhe.checked = cfg.quetschkabelschuhe || false;
			if (this.erdungsband) this.erdungsband.checked = cfg.erdungsband || false;
			if (this.ulicaModule) this.ulicaModule.checked = cfg.ulicaModule || false;

			// STATE Werte setzen
			this.cols = cfg.cols;
			this.rows = cfg.rows;
			this.selection = cfg.selection.map(r => [...r]);

			// Setup aufrufen
			this.setup();

			// Produktliste und Summary aktualisieren
			this.buildList();
			this.updateSummaryOnChange();

			this.renderConfigList();
			this.updateSaveButtons();
			
			// Detail-Ansicht aktualisieren wenn aktiv
			this.updateDetailView();
		}
		
		// Funktion um die erste Konfiguration mit der globalen Orientation zu aktualisieren
		updateFirstConfigOrientation(globalOrientation) {
			if (this.configs.length > 0) {
				this.configs[0].orientation = globalOrientation;
			}
		}
    
    		showToast(message = 'Gespeichert', duration = 1500) {
  		const toast = document.getElementById('toast');
  		if (!toast) return;
  		toast.textContent = message;
  		toast.classList.remove('hidden');

  		clearTimeout(this.toastTimeout);
  		this.toastTimeout = setTimeout(() => {
    		toast.classList.add('hidden');
  		}, duration);
		}

    saveNewConfig(customName = null) {
  		// 1. Aktuelle Auswahl in der vorherigen Konfiguration speichern
  		if (this.currentConfig !== null) {
  			this.updateConfig(); // Speichere aktuelle Änderungen in vorheriger Config
  		}
  		
  		// 2. Temporär currentConfig auf null setzen für neue Konfiguration
  		this.currentConfig = null;

			// 2a. Erzwinge Default-Startzustand für neue Konfiguration: 5x5, vertikal
			if (this.default) {
				this.cols = this.default.cols;
				this.rows = this.default.rows;
				if (this.wIn) this.wIn.value = this.default.width;
				if (this.hIn) this.hIn.value = this.default.height;
			}
			if (this.orH && this.orV) {
				this.orH.checked = false;
				this.orV.checked = true;
				this.syncOrientationButtons?.();
			}
  		
  		// 3. Neue Konfiguration mit leerem Grid erstellen
			const emptySelection = Array.from({ length: this.rows }, () =>
  			Array.from({ length: this.cols }, () => false)
  		);
  		
  		// 4. Aktuelle Auswahl temporär speichern und durch leere ersetzen
  		const originalSelection = this.selection;
  		this.selection = emptySelection;
  		
  		const cfg = this._makeConfigObject(customName);
  		this.configs.push(cfg);
  		
    		// 5. Neue Konfiguration auswählen und Grid neu aufbauen
    		this.currentConfig = this.configs.length - 1;
    		this.setup(); // Baut Grid mit leerer Auswahl neu auf

    		// Direkt zur Detail-Ansicht der neuen Konfiguration wechseln
    		this.showDetailView(this.currentConfig);
  		
  				this.renderConfigList();
		this.updateConfigList(); // Config-Liste in Overview updaten
		this.updateSaveButtons();
		
		// 6. Detail-Ansicht aktualisieren wenn aktiv
		this.updateDetailView();
		
		this.showToast(`Neue Konfiguration "${cfg.name}" erstellt`);
		}

    renameCurrentConfig(newName) {
      if (this.currentConfig !== null && this.currentConfig >= 0 && this.currentConfig < this.configs.length) {
        // Aktuelle Konfiguration umbenennen
        this.configs[this.currentConfig].name = newName;
        // Sofort DOM aktualisieren
        const titleEl = document.getElementById('current-config-title');
        if (titleEl) titleEl.textContent = newName;
        if (this.configListEl) {
          const items = this.configListEl.querySelectorAll('.config-item');
          if (items && items[this.currentConfig]) {
            const nameEl = items[this.currentConfig].querySelector('.config-item-name');
            if (nameEl) nameEl.textContent = newName;
          }
        }
        this.renderConfigList();
        this.updateSaveButtons();
        // Neu: Direkt in Cache sichern, damit der Name nach Reload erhalten bleibt
        this.updateConfig();
        this.saveToCache();
        this.showAutoSaveIndicator();
      }
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
			this.resetGridToDefault(); // Setzt 5x5 und vertikal
  		
  		// Neue Konfiguration erstellen und hinzufügen
  		const newConfig = this._makeConfigObject();
  		this.configs.push(newConfig);
  		this.currentConfig = this.configs.length - 1;
  		
  		this.renderConfigList();
  		this.updateSaveButtons();
		}
    _makeConfigObject(customName = null) {
      // Für neue Konfigurationen: Finde die nächste verfügbare Nummer
      let configName;
      if (customName) {
        // Benutzerdefinierter Name
        configName = customName;
      } else if (this.currentConfig !== null) {
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
        // Für neue Konfigurationen immer vertikal als Startzustand speichern
        orientation: this.currentConfig === null ? 'vertical' : (this.orV && this.orV.checked ? 'vertical' : 'horizontal'),
        incM:        this.incM && this.incM.checked,
        mc4:         this.mc4 && this.mc4.checked,
        solarkabel:  this.solarkabel && this.solarkabel.checked,
        holz:        this.holz && this.holz.checked,
        quetschkabelschuhe: this.quetschkabelschuhe && this.quetschkabelschuhe.checked,
        erdungsband: this.erdungsband ? this.erdungsband.checked : false,
        ulicaModule: this.ulicaModule ? this.ulicaModule.checked : false,
        cols:        this.cols,
        rows:        this.rows,
        cellWidth:   parseFloat(this.wIn ? this.wIn.value : '179'),
        cellHeight:  parseFloat(this.hIn ? this.hIn.value : '113')
      };
    }

    renderConfigList() {
      // Verwende das gleiche HTML-Design wie updateConfigList()
      this.configListEl.innerHTML = '';
      
      this.configs.forEach((cfg, idx) => {
        const div = document.createElement('div');
        div.className = 'config-item' + (idx === this.currentConfig ? ' active' : '');
        
        const totalPrice = this.calculateConfigPrice(cfg);
        const canDelete = this.configs.length >= 2;
        
        div.innerHTML = `
          <div class="config-item-info">
            <div class="config-item-name">${cfg.name || `Konfiguration #${idx + 1}`}</div>
            <div class="config-item-price">${totalPrice.toFixed(2).replace('.', ',')} €</div>
          </div>
          <div class="config-item-actions">
            <button class="icon-btn" onclick="solarGrid.editConfigNameInList(${idx})" title="Bearbeiten">
              <img src="https://cdn.prod.website-files.com/68498852db79a6c114f111ef/689369877a18221f25a4b743_Pen.png" alt="Bearbeiten" style="width: 16px; height: 16px;">
            </button>
            ${canDelete ? `
            <button class="icon-btn delete" onclick="solarGrid.deleteConfigFromList(${idx})" title="Löschen">
              <img src="https://cdn.prod.website-files.com/68498852db79a6c114f111ef/68936c5481f2a4db850a01f5_Trashbin.png" alt="Löschen" style="width: 16px; height: 16px;">
            </button>` : ''}
            <div class="config-item-arrow">
              <img src="https://cdn.prod.website-files.com/68498852db79a6c114f111ef/68936986bd441749c46190e8_ChevronRight.png" alt="Pfeil" style="width: 10px; height: 16px;">
            </div>
          </div>
        `;
        
        div.addEventListener('click', (e) => {
          // Verhindere Klick wenn auf Action-Button geklickt wurde
          if (e.target.closest('.config-item-actions')) return;
          
          // Auto-Save der aktuellen Konfiguration vor dem Wechsel
          if (this.currentConfig !== null && this.currentConfig !== idx) {
            this.updateConfig();
          }
          
          // Wechsle immer in die Detail-Ansicht der gewählten Konfiguration
          this.showDetailView(idx);
          this.showToast('Konfiguration geladen', 1000);
        });
        
        this.configListEl.appendChild(div);
      });
    }

    // Performance: Schnellerer Array-Vergleich
    arraysEqual(a, b) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i].length !== b[i].length) return false;
        for (let j = 0; j < a[i].length; j++) {
          if (a[i][j] !== b[i][j]) return false;
        }
      }
      return true;
    }

    updateSummaryOnChange() {
      // Performance: Debounced Updates
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
      }
      
      this.updateTimeout = setTimeout(async () => {
        // FEATURE 5: Performance-Monitoring - Update Time
        const startTime = performance.now();
        
        // Auto-Save Indicator anzeigen
        this.showAutoSaveIndicator();
        
        // Detail-Ansicht aktualisieren falls aktiv
        if (document.getElementById('config-detail-view')?.classList.contains('active')) {
          this.updateDetailView();
        }
        
        // Gesamtpreis aktualisieren
        this.updateCurrentTotalPrice();
        
        // Update config-list und overview wenn eine Konfiguration ausgewählt ist
        if (this.currentConfig !== null) {
          // Speichere die Konfiguration automatisch
          this.updateConfig();
          this.updateConfigList();
        }
        
        // Automatisches Cache-Speichern bei jeder Änderung
        this.saveToCache();
        
        this.performanceMetrics.updateTime = performance.now() - startTime;
        this.updateTimeout = null;
      }, this.updateDelay);
    }



		// ISOLIERTE synchrone Berechnung für Fallback
		calculatePartsDirectly(data) {
			const { selection, rows, cols, cellWidth, cellHeight, orientation, options } = data;
			const ulicaModule = options?.ulicaModule === true;
			const parts = {
				Solarmodul: 0, UlicaSolarBlackJadeFlow: 0, Endklemmen: 0, Mittelklemmen: 0,
				Dachhaken: 0, Schrauben: 0, Endkappen: 0,
				Schienenverbinder: 0, Schiene_240_cm: 0, Schiene_360_cm: 0, Tellerkopfschraube: 0
			};

			for (let y = 0; y < rows; y++) {
				if (!Array.isArray(selection[y])) continue;
				let run = 0;

				for (let x = 0; x < cols; x++) {
					if (selection[y]?.[x]) {
						run++;
					}
					else if (run) { 
						this.processGroupDirectly(run, parts, cellWidth, cellHeight, orientation, ulicaModule); 
						run = 0; 
					}
				}
				if (run) {
					this.processGroupDirectly(run, parts, cellWidth, cellHeight, orientation, ulicaModule);
				}
			}

			return parts;
		}

		// FALLBACK: Kopie der Worker-Berechnung
		processGroupDirectly(len, parts, cellWidth, cellHeight, orientation, ulicaModule = false) {
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
			parts.Endkappen          += 4;  // Gleich wie Endklemmen
			parts.Solarmodul         += len;
			// UlicaSolarBlackJadeFlow hinzufügen wenn ulica-module Checkbox aktiviert ist
			if (ulicaModule) {
				parts.UlicaSolarBlackJadeFlow += len;
			}
			// Schrauben basierend auf Dachhaken berechnen
			parts.Schrauben          += len > 1 ? len * 3 : 4; // Basierend auf Dachhaken
			parts.Tellerkopfschraube += len > 1 ? (len * 3) * 2 : 8; // Basierend auf Dachhaken * 2
		}
    resetAllConfigurations() {
    	// Bestätigungsabfrage
    	if (!confirm('Möchten Sie wirklich alle Konfigurationen löschen und von vorne anfangen?')) {
    		return;
    	}
    	
    	// Cache löschen
    	this.cacheManager.clearCache();
    	
    	// Alle Konfigurationen löschen
    	this.configs = [];
    	this.currentConfig = null;
    	
    	// Grid auf Default zurücksetzen
    	this.cols = this.default.cols;
    	this.rows = this.default.rows;
    	this.selection = Array.from({ length: this.rows }, () =>
    		Array.from({ length: this.cols }, () => false)
    	);
    	
    	// Grid visuell aktualisieren - alle Module abwählen
    	this.buildGrid();
    	
    	// Input-Felder auf Default zurücksetzen
    	if (this.wIn) this.wIn.value = this.default.width;
    	if (this.hIn) this.hIn.value = this.default.height;
    	
    	// Orientation auf Default zurücksetzen
    	if (this.orH && this.orV) {
    		this.orH.checked = true;
    		this.orV.checked = false;
    	}
    	
    	// Orientation-Buttons visuell aktualisieren
    	this.syncOrientationButtons();
    	
    	// Checkboxen auf Default zurücksetzen (ALLE abwählen)
    	if (this.incM) this.incM.checked = false;
    	if (this.mc4) this.mc4.checked = false;
    	if (this.solarkabel) this.solarkabel.checked = false;
    	if (this.holz) this.holz.checked = false;
    	if (this.quetschkabelschuhe) this.quetschkabelschuhe.checked = false;
    	if (this.erdungsband) this.erdungsband.checked = false;
    	if (this.ulicaModule) this.ulicaModule.checked = false;
    	
    	// Module Dropdown auf Default zurücksetzen
    	if (this.moduleSelect) {
    		this.moduleSelect.value = '';
    		this.enableInputs();
    	}
    	
    	// Bestehende Konfigurationserstellung verwenden
    	this.createNewConfig();
    	
    	// Orientation-Buttons nach createNewConfig() aktualisieren
    	this.syncOrientationButtons();
    	
    	// Preise aktualisieren
    	this.updateCurrentTotalPrice();
    	
    	this.showToast('Alle Konfigurationen wurden zurückgesetzt', 2000);
    }
    
    // NEUE FUNKTION: Speichere alle Konfigurationen und Einstellungen im Cache
    saveToCache() {
    	try {
    		const cacheData = {
    			configs: this.configs,
    			currentConfig: this.currentConfig,
    			selection: this.selection, // Aktuelle Grid-Auswahl
    			// Aktuelle Grid-Einstellungen
    			cols: this.cols,
    			rows: this.rows,
    			cellWidth: parseInt(this.wIn ? this.wIn.value : '179', 10),
    			cellHeight: parseInt(this.hIn ? this.hIn.value : '113', 10),
    			orientation: this.orV && this.orV.checked ? 'vertical' : 'horizontal',
    						// Checkbox-Einstellungen
			includeModules: this.incM ? this.incM.checked : false,
			mc4: this.mc4 ? this.mc4.checked : false,
			solarkabel: this.solarkabel ? this.solarkabel.checked : false,
			holz: this.holz ? this.holz.checked : false,
			quetschkabelschuhe: this.quetschkabelschuhe ? this.quetschkabelschuhe.checked : false,
			erdungsband: this.erdungsband ? this.erdungsband.checked : false,
			ulicaModule: this.ulicaModule ? this.ulicaModule.checked : false,
			// Opti-State (global)
			huaweiOpti: (document.getElementById('huawei-opti')?.checked) || false,
			brcOpti: (document.getElementById('brc-opti')?.checked) || false,
			optiQty: parseInt(document.getElementById('opti-qty')?.value || '1', 10),
			// Module Dropdown Auswahl
			moduleSelectValue: this.moduleSelect ? this.moduleSelect.value : '',
    			// Grid-Struktur
    			gridStructure: {
    				cols: this.cols,
    				rows: this.rows,
    				cellWidth: parseInt(this.wIn ? this.wIn.value : '179', 10),
    				cellHeight: parseInt(this.hIn ? this.hIn.value : '113', 10)
    			}
    		};
    		
    		// Verwende CacheManager für bessere Performance und Error Handling
    		this.cacheManager.saveData(cacheData);
    		
    		// Zeige Auto-Save Indicator
    		this.showAutoSaveIndicator();
    	} catch (error) {
    		console.error('Fehler beim Speichern des Caches:', error);
    	}
    }
    
    // NEUE FUNKTION: Lade Konfigurationen aus dem Cache
    loadFromCache() {
    	try {
    		// Verwende CacheManager für bessere Error Handling
    		const data = this.cacheManager.loadData();
    		if (!data) {
    			console.log('Kein Cache gefunden oder Cache abgelaufen');
    			return false;
    		}
    		
    		// Prüfe localStorage Verfügbarkeit
    		if (!this.cacheManager.isLocalStorageAvailable()) {
    			this.showToast('Es wurde nichts im Speicher gefunden', 3000);
    			return false;
    		}
    		
    		// Lade Konfigurationen
    		if (data.configs && Array.isArray(data.configs)) {
    			this.configs = data.configs;
    			this.currentConfig = data.currentConfig;
    			
    			// Lade Grid-Auswahl
    		if (data.selection && Array.isArray(data.selection)) {
    			this.selection = data.selection;
    		}
    			
    			// Lade Grid-Einstellungen
    			if (data.cols && data.rows) {
    				this.cols = data.cols;
    				this.rows = data.rows;
    			}
    			
    			// Lade Checkbox-Einstellungen
    			if (this.incM && typeof data.includeModules === 'boolean') {
    				this.incM.checked = data.includeModules;
    			}
    			if (this.mc4 && typeof data.mc4 === 'boolean') {
    				this.mc4.checked = data.mc4;
    			}
    			if (this.solarkabel && typeof data.solarkabel === 'boolean') {
    				this.solarkabel.checked = data.solarkabel;
    			}
    			if (this.holz && typeof data.holz === 'boolean') {
    				this.holz.checked = data.holz;
    			}
    			if (this.quetschkabelschuhe && typeof data.quetschkabelschuhe === 'boolean') {
    				this.quetschkabelschuhe.checked = data.quetschkabelschuhe;
    			}
    			if (this.erdungsband && typeof data.erdungsband === 'boolean') {
    				this.erdungsband.checked = data.erdungsband;
    			}
						if (this.ulicaModule && typeof data.ulicaModule === 'boolean') {
				this.ulicaModule.checked = data.ulicaModule;
			}
			
			// Opti-State laden (Checkboxen + Menge)
			try {
				const hCb = document.getElementById('huawei-opti');
				const bCb = document.getElementById('brc-opti');
				const qEl = document.getElementById('opti-qty');
				if (hCb && typeof data.huaweiOpti === 'boolean') hCb.checked = data.huaweiOpti;
				if (bCb && typeof data.brcOpti === 'boolean') bCb.checked = data.brcOpti;
				if (qEl && typeof data.optiQty === 'number') qEl.value = String(Math.max(1, data.optiQty));
				if (qEl) qEl.style.display = ((hCb && hCb.checked) || (bCb && bCb.checked)) ? '' : 'none';
			} catch (_) {}
			
			// Lade Module Dropdown Auswahl
			if (this.moduleSelect && typeof data.moduleSelectValue === 'string') {
				this.moduleSelect.value = data.moduleSelectValue;
				// Wenn ein Modul ausgewählt ist, Inputs entsprechend sperren/freigeben
				if (data.moduleSelectValue && data.moduleSelectValue !== 'custom') {
					this.disableInputs();
				} else {
					this.enableInputs();
				}
			}
			
			// Lade Grid-Dimensionen
			if (this.wIn && data.cellWidth) {
				this.wIn.value = data.cellWidth;
			}
			if (this.hIn && data.cellHeight) {
				this.hIn.value = data.cellHeight;
			}
    			
    			// Lade Orientierung VOR dem Laden der Konfiguration
			if (this.orH && this.orV && typeof data.orientation === 'string') {
				this.orH.checked = data.orientation === 'horizontal';
				this.orV.checked = data.orientation === 'vertical';
				
				// Synchronisiere mit den Orientation Buttons (robuster)
				this.syncOrientationButtons();
				
				// Aktualisiere die erste Konfiguration mit der globalen Orientation
				this.updateFirstConfigOrientation(data.orientation);
			}
    			// Lade die erste Konfiguration
    			if (this.configs.length > 0) {
    				this.loadFirstConfigFromCache();
    			}
    			
    			// Grid und UI nach dem Laden wiederherstellen
    			this.setup(); // Grid-Event-Listener wiederherstellen
    			this.buildGrid(); // Grid visuell wiederherstellen
    			this.buildList(); // Produktliste wiederherstellen
    			
    			// Event-Listener für alle UI-Elemente wiederherstellen
    			this.setupAllEventListeners();
    			
    			// Aktualisiere UI nach dem Laden
    			this.updateConfigList();
    			this.updateCurrentTotalPrice();
    			this.updateOverviewTotalPrice();
    			
    			this.showToast('Konfiguration aus Cache geladen', 2000);
    			return true;
    		}
    	} catch (error) {
    		console.error('Fehler beim Laden des Caches:', error);
    		this.cacheManager.clearCache();
    		this.showToast('Datei im Speicher ist beschädigt und konnte nicht geladen werden!', 3000);
    	}
    	
    	return false;
    }
    
        generateHiddenCartForms() {
      const webflowForms = document.querySelectorAll('form[data-node-type="commerce-add-to-cart-form"]');
      this.webflowFormMap = {};
      this.webflowFormMapBrutto = {};
      
      webflowForms.forEach((form) => {
        const productId = form.getAttribute('data-commerce-product-id');
        const skuId = form.getAttribute('data-commerce-sku-id');
        
        const productKey = Object.keys(PRODUCT_MAP).find(key => 
          PRODUCT_MAP[key].productId === productId || PRODUCT_MAP[key].variantId === skuId
        );
        
        if (productKey) {
          this.webflowFormMap[productKey] = form;
        }

        const bruttoKey = Object.keys(PRODUCT_MAP_BRUTTO || {}).find(key => {
          const info = PRODUCT_MAP_BRUTTO[key];
          return info && (info.productId === productId || info.variantId === skuId);
        });
        if (bruttoKey) {
          this.webflowFormMapBrutto[bruttoKey] = form;
        }
      });
      
      this.hideWebflowForms();
    }

    hideWebflowForms() {
      // Immer ALLE Webflow Add-to-Cart Forms verstecken – auch wenn sie nicht im Konfigurator genutzt werden
      const allForms = document.querySelectorAll('form[data-node-type="commerce-add-to-cart-form"]');
      allForms.forEach(form => {
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
          form.setAttribute('aria-hidden', 'true');
          form.setAttribute('tabindex', '-1');
        }
      });
    }

    addProductToCart(productKey, quantity, isLastItem = false) {
      // Firmenkunden: Brutto-Formulare bevorzugen
      const preferBrutto = !isPrivateCustomer() && Object.prototype.hasOwnProperty.call(PRODUCT_MAP_BRUTTO, productKey);
      let form = null;
      if (preferBrutto && this.webflowFormMapBrutto) {
        form = this.webflowFormMapBrutto[productKey] || null;
      }
      if (!form && this.webflowFormMap) {
        form = this.webflowFormMap[productKey] || null;
      }
      if (!form) {
        // Fallback: DOM-Suche anhand IDs
        const info = getCartProductInfo(productKey);
        if (info) {
          form = document.querySelector(`[data-commerce-product-id="${info.productId}"]`) ||
                 document.querySelector(`[data-commerce-sku-id="${info.variantId}"]`);
          if (form) {
            if (preferBrutto) {
              this.webflowFormMapBrutto = this.webflowFormMapBrutto || {};
              this.webflowFormMapBrutto[productKey] = form;
            } else {
              this.webflowFormMap = this.webflowFormMap || {};
              this.webflowFormMap[productKey] = form;
            }
          }
        }
      }
      if (!form) return;
      
      const qtyInput = form.querySelector('input[name="commerce-add-to-cart-quantity-input"]');
      if (qtyInput) {
        qtyInput.value = quantity;
      }
      // Optional-Selects (Webflow Produkt-Optionen) automatisch setzen, falls required
      try {
        form.querySelectorAll('select[required]').forEach(sel => {
          if (!sel.value) {
            const first = sel.querySelector('option[value]:not([value=""])');
            if (first) sel.value = first.value;
          }
        });
      } catch (e) {}
      
      const addToCartButton = form.querySelector('input[data-node-type="commerce-add-to-cart-button"]');
      if (addToCartButton) {
        this.clickWebflowButtonSafely(form, addToCartButton, productKey, quantity, isLastItem);
      }
    }

    clickWebflowButtonSafely(form, button, productKey, quantity, isLastItem) {
      const qtyInput = form.querySelector('input[name="commerce-add-to-cart-quantity-input"]');
      if (qtyInput) qtyInput.value = quantity;
      // Siehe oben: required selects füllen
      try {
        form.querySelectorAll('select[required]').forEach(sel => {
          if (!sel.value) {
            const first = sel.querySelector('option[value]:not([value=""])');
            if (first) sel.value = first.value;
          }
        });
      } catch (e) {}
      
      // Iframe-Workaround entfernt: wir klicken direkt und warten sequenziell über DOM-Änderungen/Timeouts
      button.click();
    }

    addPartsListToCart(parts) {
      const entries = Object.entries(parts).filter(([_, qty]) => qty > 0);
      if (!entries.length) return;
      
      if (this.isAddingToCart) {
        this.showToast('Warenkorb wird bereits befüllt… Bitte warten.', 2000);
        return;
      }
      this.isAddingToCart = true;
      this.showLoading('Warenkorb wird befüllt… bitte warten');
      
      // Overlay verbergen bis der Prozess abgeschlossen ist
      this.hideCartContainer();
      
      const items = entries.map(([key, qty]) => ({ key, qty }));
      const processSequentially = async () => {
        try {
          await this.ensureCartObservers();
          for (let i = 0; i < items.length; i++) {
            const { key, qty } = items[i];
            const packsNeeded = Math.ceil(qty / VE[key]);
            await this.addSingleItemAndWait(key, packsNeeded, i === items.length - 1);
          }
        } finally {
          // Nach Abschluss: Overlay zeigen und Status zurücksetzen
          this.showCartContainer();
          this.hideLoading();
          this.isAddingToCart = false;
        }
      };
      processSequentially();
    }

    async addSingleItemAndWait(productKey, quantity, isLast) {
      // Safeguards
      const preferBrutto = !isPrivateCustomer() && Object.prototype.hasOwnProperty.call(PRODUCT_MAP_BRUTTO, productKey);
      let mappedForm = null;
      if (preferBrutto && this.webflowFormMapBrutto) {
        mappedForm = this.webflowFormMapBrutto[productKey] || null;
      }
      if (!mappedForm && this.webflowFormMap) {
        mappedForm = this.webflowFormMap[productKey] || null;
      }
      if (!mappedForm) {
        // Versuche, Formen neu zu sammeln
        await this.ensureWebflowFormsMapped();
        if (preferBrutto && this.webflowFormMapBrutto) {
          mappedForm = this.webflowFormMapBrutto[productKey] || null;
        }
        if (!mappedForm && this.webflowFormMap) {
          mappedForm = this.webflowFormMap[productKey] || null;
        }
        if (!mappedForm) {
          const info = getCartProductInfo(productKey);
          if (info) {
            mappedForm = document.querySelector(`[data-commerce-product-id="${info.productId}"]`) ||
                         document.querySelector(`[data-commerce-sku-id="${info.variantId}"]`);
          }
        }
      }
      if (!mappedForm) {
        this.showToast(`Produktformular nicht gefunden: ${productKey}`, 2000);
        return;
      }
      const addBtn = mappedForm.querySelector('input[data-node-type="commerce-add-to-cart-button"]');
      if (!addBtn) {
        this.showToast(`Add-to-Cart Button fehlt: ${productKey}`, 2000);
        return;
      }
      
      // Fortschrittsmeldung optional
      // this.showToast(`Füge hinzu: ${productKey} x${quantity}`, 1200);
      
      // DOM-Änderung oder Timeout abwarten
      const waitForAck = this.waitForCartAcknowledge(1500);
      this.clickWebflowButtonSafely(mappedForm, addBtn, productKey, quantity, isLast);
      await waitForAck;
    }

    async ensureCartObservers() {
      // Observer für Cart-Änderungen
      if (!this.cartAckObserver) {
        const list = document.querySelector('.w-commerce-commercecartlist') || document.querySelector('.w-commerce-commercecartcontainerwrapper');
        if (list) {
          this.cartAckObserver = new MutationObserver(() => {
            if (this.cartAckResolve) {
              const r = this.cartAckResolve;
              this.cartAckResolve = null;
              r();
            }
          });
          this.cartAckObserver.observe(list, { childList: true, subtree: true });
        }
      }
      
      // Observer für Webflow-Formulare (für asynchrones Rendering)
      if (!this.webflowFormsObserver) {
        this.webflowFormsObserver = new MutationObserver(() => {
          this.generateHiddenCartForms();
        });
        this.webflowFormsObserver.observe(document.body, { childList: true, subtree: true });
      }
      
      await this.ensureWebflowFormsMapped();
    }

    waitForCartAcknowledge(timeoutMs = 1500) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            if (this.cartAckResolve === resolve) this.cartAckResolve = null;
            resolve();
          }
        }, timeoutMs);
        
        this.cartAckResolve = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        };
      });
    }

    async ensureWebflowFormsMapped() {
      // Falls Mapping leer ist, nochmal scannen
      if (!this.webflowFormMap || Object.keys(this.webflowFormMap).length === 0 || !this.webflowFormMapBrutto) {
        this.generateHiddenCartForms();
        // kurze Wartezeit, falls Webflow synchron nachrendert
        await new Promise(r => setTimeout(r, 50));
      }
    }

    hideCartContainer() {
      const cartContainer = document.querySelector('.w-commerce-commercecartcontainerwrapper');
      if (cartContainer) {
        cartContainer.style.display = 'none';
        // Sicherstellen, dass Cart am Ende wieder geöffnet werden kann
        cartContainer.classList.add('st-cart-hidden');
      }
    }

    showCartContainer() {
      const cartContainer = document.querySelector('.w-commerce-commercecartcontainerwrapper');
      if (cartContainer) {
        cartContainer.style.display = '';
        cartContainer.classList.remove('st-cart-hidden');
        // Falls Webflow einen Toggle-Button hat, löse ggf. ein Open aus
        try {
          const openBtn = document.querySelector('[data-node-type="commerce-cart-open-link"]');
          if (openBtn && typeof openBtn.click === 'function') {
            openBtn.click();
          }
        } catch (e) {}
      }
    }

    async addCurrentToCart() {
      try {
        this.showLoading('PDF wird erstellt und Warenkorb wird befüllt…');
        const parts = await this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.solarkabel.checked, this.holz.checked, this.quetschkabelschuhe.checked, this.erdungsband ? this.erdungsband.checked : false, this.ulicaModule ? this.ulicaModule.checked : false);
      const itemCount = Object.values(parts).reduce((sum, qty) => sum + qty, 0);
      
      if (itemCount === 0) {
        this.showToast('Keine Produkte ausgewählt ⚠️', 2000);
        this.hideLoading();
        return;
      }
      
      // Sende Daten an Webhook
      this.sendCurrentConfigToWebhook().then(success => {
        if (success) {
        } else {
        }
      });
      
      // Opti-Zusatz (einmalig) hinzufügen
      try {
        const hCb = document.getElementById('huawei-opti');
        const bCb = document.getElementById('brc-opti');
        const qEl = document.getElementById('opti-qty');
        if (hCb && bCb && qEl && (hCb.checked || bCb.checked)) {
          const qty = Math.max(1, parseInt(qEl.value || '1', 10));
          if (bCb.checked) parts.BRCOpti = (parts.BRCOpti || 0) + qty; else parts.HuaweiOpti = (parts.HuaweiOpti || 0) + qty;
        }
      } catch (_) {}
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
        this.hideLoading();
      }
    }

    async addAllToCart() {
      try {
      // Kein Auto-Save beim Warenkorb-Button-Klick - Config-Items sollen nicht neu gebaut werden
      this.showLoading('PDF wird erstellt und Warenkorb wird befüllt…');
      
        // SCHRITT 1: Erstelle vollständigen ISOLIERTEN Snapshot aller Konfigurationen
        const configSnapshot = this.createConfigSnapshot();
        
        // SCHRITT 2: PDF ZUERST mit isolierten Daten erstellen
        if (this.pdfGenerator && this.pdfGenerator.isAvailable()) {
          this.showToast('PDF wird erstellt...', 2000);
          await this.pdfGenerator.generatePDFFromSnapshot(configSnapshot);
          			this.showToast('PDF erfolgreich erstellt', 1500);
        }
        
        // SCHRITT 3: Berechne Produkte für Warenkorb (mit Live-Data für aktuellen Zustand)
        const allBundles = await Promise.all(this.configs.map(async (cfg, idx) => {
        // Für die aktuell bearbeitete Konfiguration: Verwende aktuelle Werte
        if (idx === this.currentConfig) {
                      return await this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.solarkabel.checked, this.holz.checked, this.quetschkabelschuhe.checked, this.erdungsband ? this.erdungsband.checked : false, this.ulicaModule ? this.ulicaModule.checked : false);
      } else {
        return await this._buildPartsFor(cfg.selection, cfg.incM, cfg.mc4, cfg.solarkabel, cfg.holz, cfg.quetschkabelschuhe, cfg.erdungsband, cfg.ulicaModule);
        }
        }));
      
      // Wenn keine Konfiguration ausgewählt ist (sollte nicht passieren), füge aktuelle Auswahl hinzu
      if (this.currentConfig === null && this.configs.length === 0) {
            const currentParts = await this._buildPartsFor(this.selection, this.incM.checked, this.mc4.checked, this.solarkabel.checked, this.holz.checked, this.quetschkabelschuhe.checked, this.erdungsband ? this.erdungsband.checked : false, this.ulicaModule ? this.ulicaModule.checked : false);
            allBundles.push(currentParts);
      }
      
      const total = {};
      allBundles.forEach(parts => {
        Object.entries(parts).forEach(([k, v]) => {
          total[k] = (total[k] || 0) + v;
        });
      });
      // Opti-Zusatz aus globaler UI berücksichtigen
      try {
        const hCb = document.getElementById('huawei-opti');
        const bCb = document.getElementById('brc-opti');
        const qEl = document.getElementById('opti-qty');
        if (hCb && bCb && qEl && (hCb.checked || bCb.checked)) {
          const qty = Math.max(1, parseInt(qEl.value || '1', 10));
          if (bCb.checked) total.BRCOpti = (total.BRCOpti || 0) + qty; else total.HuaweiOpti = (total.HuaweiOpti || 0) + qty;
        }
      } catch (_) {}
      
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
        this.hideLoading();
      }
    }

    async _buildPartsFor(sel, incM, mc4, solarkabel, holz, quetschkabelschuhe, erdungsband, ulicaModule) {
      // Speichere aktuelle Auswahl
      const originalSelection = this.selection.map(r => [...r]);
      
      try {
        // Temporär setzen für Berechnung
        this.selection = sel;
        let parts = await this.calculateParts();
        
        // Module nur hinzufügen wenn Checkbox aktiviert ist
        if (!incM) delete parts.Solarmodul;
        if (!ulicaModule) delete parts.UlicaSolarBlackJadeFlow;
        
        // Zusatzprodukte basierend auf Checkboxen (korrekte Keys setzen/löschen)
        const moduleCount = (this.selection || []).flat().filter(Boolean).length;
        if (mc4 && moduleCount > 0) {
          parts.MC4_Stecker = Math.ceil(moduleCount / 30);
        } else {
          delete parts.MC4_Stecker;
        }
        if (solarkabel) {
          parts.Solarkabel = 1;
        } else {
          delete parts.Solarkabel;
        }
        if (holz) {
          parts.Holzunterleger = 1; // pauschal 1 VE
        } else {
          delete parts.Holzunterleger;
        }
        if (quetschkabelschuhe) {
          parts.Quetschkabelschuhe = 1; // pauschal 1 VE
        } else {
          delete parts.Quetschkabelschuhe;
        }
        
        // Erdungsband hinzufügen wenn aktiviert
        if (erdungsband) {
          parts.Erdungsband = this.calculateErdungsband();
        } else {
          delete parts.Erdungsband;
        }
        
        // Palettenlogik anwenden (36er Bündel je Modultyp)
        try {
          const pieceKey = ulicaModule ? 'UlicaSolarBlackJadeFlow' : 'Solarmodul';
          const palletKey = ulicaModule ? 'UlicaSolarBlackJadeFlowPalette' : 'SolarmodulPalette';
          const count = Number(parts[pieceKey] || 0);
          if (count > 0) {
            const pallets = Math.floor(count / 36);
            const remainder = count % 36;
            if (pallets > 0) {
              parts[palletKey] = (parts[palletKey] || 0) + pallets * 36; // Stückbasis
            }
            parts[pieceKey] = remainder;
          }
        } catch (e) {}
        
        return parts;
      } finally {
        // Ursprüngliche Auswahl wiederherstellen
        this.selection = originalSelection;
      }
    }

    _buildCartItems(parts) {
      return Object.entries(parts).map(([k,v]) => {
        const ve = VE[k] || 1;
        const packs = Math.ceil(v / ve);
        const m = (!isPrivateCustomer() && PRODUCT_MAP_BRUTTO[k]) ? PRODUCT_MAP_BRUTTO[k] : PRODUCT_MAP[k];
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
        wood: this.holz.checked,
        quetschkabelschuhe: this.quetschkabelschuhe.checked,
        erdungsband: this.erdungsband ? this.erdungsband.checked : false,
        ulicaModule: this.ulicaModule ? this.ulicaModule.checked : false
      };
    }

    // NEUE METHODE: Globale Checkbox-Logik - aktualisiert alle Konfigurationen
    updateAllConfigurationsForCheckboxes() {
      // Aktualisiere alle gespeicherten Konfigurationen mit aktuellen Checkbox-Werten
      this.configs.forEach((config, index) => {
        config.incM = this.incM.checked;
        config.mc4 = this.mc4.checked;
        config.solarkabel = this.solarkabel.checked;
        config.holz = this.holz.checked;
        config.quetschkabelschuhe = this.quetschkabelschuhe.checked;
        if (this.erdungsband) config.erdungsband = this.erdungsband.checked;
        if (this.ulicaModule) config.ulicaModule = this.ulicaModule.checked;
      });
      
      // Aktualisiere Summary und Produktliste
      this.updateSummaryOnChange();
      
      // Aktualisiere auch die Produktliste in der detailed-overview
      this.buildList();
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
        let targetIncM, targetMc4, targetCable, targetWood, targetQuetschkabelschuhe, targetErdungsband, targetUlicaModule, targetCellWidth, targetCellHeight;
        
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
          targetQuetschkabelschuhe = this.quetschkabelschuhe.checked;
          targetErdungsband = this.erdungsband ? this.erdungsband.checked : false;
          targetUlicaModule = this.ulicaModule ? this.ulicaModule.checked : false;
          console.log('Current ulicaModule checkbox state:', targetUlicaModule);
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
          targetQuetschkabelschuhe = config.quetschkabelschuhe;
          targetErdungsband = config.erdungsband;
          targetUlicaModule = config.ulicaModule;
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
          includeModules: targetIncM === true,
          mc4: targetMc4 || false,
          cable: targetCable || false,
          wood: targetWood || false,
          quetschkabelschuhe: targetQuetschkabelschuhe || false,
          erdungsband: targetErdungsband || false,
          ulicaModule: targetUlicaModule === true,
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
      console.log('showGridPreview called with config:', config);
      
      // Speichere aktuellen Zustand für späteres Zurücksetzen (immer, nicht nur beim ersten Mal)
      this.originalPreviewState = {
        selection: this.selection ? this.selection.map(row => [...row]) : null,
        cols: this.cols,
        rows: this.rows,
        orientation: this.orV ? this.orV.checked : false,
        cellWidth: parseInt(this.wIn ? this.wIn.value : '179', 10),
        cellHeight: parseInt(this.hIn ? this.hIn.value : '113', 10)
      };
      
      console.log('Original state saved:', this.originalPreviewState);
      
      try {
        // Erstelle Preview-Grid
        this.createPreviewGrid(config);
        
        // Smooth Animation: Verstecke Hauptgrid und zeige Preview-Grid
        this.hideMainGrid();
        this.showPreviewGrid();
        
        // Füge Animation-Klassen hinzu
        const mainGrid = document.getElementById('grid');
        const previewGrid = document.getElementById('preview-grid');
        
        if (mainGrid) mainGrid.classList.add('grid-fade-out');
        if (previewGrid) previewGrid.classList.add('grid-fade-in');
        
        console.log('Grid preview shown successfully');
      } catch (error) {
        console.error('Error in showGridPreview:', error);
        // Fallback: Zeige Hauptgrid wieder an
        this.showMainGrid();
      }
    }
    
    createPreviewGrid(config) {
      console.log('createPreviewGrid called with config:', config);
      
      const previewGrid = document.getElementById('preview-grid');
      
      if (!previewGrid) {
        console.error('Preview grid element not found');
        return;
      }
      
      console.log('Preview grid element found, building preview...');
      
      // Starte mit aktuellem Grid als Basis
      let previewCols = this.cols;
      let previewRows = this.rows;
      let previewSelection = this.selection ? this.selection.map(row => [...row]) : 
        Array.from({ length: previewRows }, () => Array.from({ length: previewCols }, () => false));
      
            // Wende Konfiguration auf Preview an
      if (config.useCurrentGrid) {
        // Kurze Eingabe: Verwende aktuelles Grid als Basis
        previewCols = config.cols;
        previewRows = config.rows;
        // Behalte aktuelle Selection
        previewSelection = this.selection ? this.selection.map(row => [...row]) : 
          Array.from({ length: previewRows }, () => Array.from({ length: previewCols }, () => false));
      } else if (config.cols && config.rows) {
        // Neue Grid-Größe
        previewCols = config.cols;
        previewRows = config.rows;
        
        // Erstelle neue Selection basierend auf Modul-Anzahl oder leere Selection
        if (config.moduleCount) {
          previewSelection = this.createModuleSelection(config.moduleCount, previewCols, previewRows);
        } else {
          previewSelection = Array.from({ length: previewRows }, () =>
            Array.from({ length: previewCols }, () => false)
          );
        }
      } else if (config.moduleCount) {
         // Nur Modul-Anzahl geändert - behalte Grid-Größe
         const hasSpacing = config.adjustSpacing === 'withSpacing' || 
                           (config.rowConfig && config.rowConfig.spacing);
         previewSelection = this.createModuleSelection(config.moduleCount, previewCols, previewRows, hasSpacing);
       } else if (config.rowConfig) {
        // Reihen-Konfiguration anwenden
        const { numRows, modulesPerRow, spacing } = config.rowConfig;
        previewRows = numRows + (spacing ? 1 : 0); // +1 für Abstand
        
        // Erstelle Selection mit Abstand
        previewSelection = Array.from({ length: previewRows }, (_, rowIndex) =>
          Array.from({ length: previewCols }, (_, colIndex) => {
            if (spacing && rowIndex === Math.floor(numRows / 2)) {
              return false; // Abstand-Reihe
            }
            return rowIndex < numRows && colIndex < modulesPerRow;
          })
        );
      } else if (config.adjustSpacing) {
        // Abstand-Konfiguration anwenden
        if (config.adjustSpacing === 'withSpacing') {
          // Füge Abstand zwischen Reihen hinzu
          const newRows = previewRows + Math.ceil(previewRows / 2);
          const newSelection = Array.from({ length: newRows }, () =>
            Array.from({ length: previewCols }, () => false)
          );
          
          // Kopiere Module mit Abstand
          let newRowIndex = 0;
          for (let oldRow = 0; oldRow < previewRows; oldRow++) {
            for (let col = 0; col < previewCols; col++) {
              if (previewSelection[oldRow] && previewSelection[oldRow][col]) {
                newSelection[newRowIndex][col] = true;
              }
            }
            newRowIndex += 2; // Überspringe Abstand-Reihe
          }
          
          previewRows = newRows;
          previewSelection = newSelection;
        }
      }
      
      // Baue Preview-Grid
      this.buildPreviewGrid(previewGrid, previewSelection, previewCols, previewRows);
    }
    buildPreviewGrid(previewGrid, selection, cols, rows) {
      
      
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
		// Maximale verfügbare Größe (wie im Hauptgrid)
		const maxWidth = this.wrapper ? this.wrapper.clientWidth - 160 : 800;
		const maxHeight = this.wrapper ? this.wrapper.clientHeight - 160 : 600;
      
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
        mainGrid.style.visibility = 'hidden';
        mainGrid.style.opacity = '0';
      }
    }
    
    showPreviewGrid() {
      const previewGrid = document.getElementById('preview-grid');
      if (previewGrid) {
        previewGrid.style.display = 'grid';
        previewGrid.style.visibility = 'visible';
        previewGrid.style.opacity = '1';
      }
    }
    
    hidePreviewGrid() {
      const previewGrid = document.getElementById('preview-grid');
      if (previewGrid) {
        previewGrid.style.display = 'none';
        previewGrid.style.visibility = 'hidden';
        previewGrid.style.opacity = '0';
      }
    }
    
    showMainGrid() {
      const mainGrid = document.getElementById('grid');
      if (mainGrid) {
        mainGrid.style.display = 'grid';
        mainGrid.style.visibility = 'visible';
        mainGrid.style.opacity = '1';
      }
    }
    
    createModuleSelection(moduleCount, cols, rows, spacing = false) {
      const selection = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => false)
      );
      
      if (spacing) {
        // Mit Abstand: Module in erste und letzte Reihe
        const modulesPerRow = Math.ceil(moduleCount / 2);
        let modulesPlaced = 0;
        
        // Erste Reihe
        for (let col = 0; col < Math.min(modulesPerRow, cols) && modulesPlaced < moduleCount; col++) {
          selection[0][col] = true;
          modulesPlaced++;
        }
        
        // Letzte Reihe (falls noch Module übrig)
        if (modulesPlaced < moduleCount && rows > 2) {
          for (let col = 0; col < Math.min(moduleCount - modulesPlaced, cols); col++) {
            selection[rows - 1][col] = true;
            modulesPlaced++;
          }
        }
      } else {
        // Ohne Abstand: Normale Auswahl von links nach rechts, oben nach unten
        let modulesPlaced = 0;
        for (let row = 0; row < rows && modulesPlaced < moduleCount; row++) {
          for (let col = 0; col < cols && modulesPlaced < moduleCount; col++) {
            selection[row][col] = true;
            modulesPlaced++;
          }
        }
      }
      
      return selection;
    }
    
    clearGridPreview() {
      console.log('Clearing grid preview');
      
      // Smooth Animation: Entferne Animation-Klassen
      const mainGrid = document.getElementById('grid');
      const previewGrid = document.getElementById('preview-grid');
      
      if (mainGrid) mainGrid.classList.remove('grid-fade-out');
      if (previewGrid) previewGrid.classList.remove('grid-fade-in');
      
      // Kurze Verzögerung für Animation
      setTimeout(() => {
        // Verstecke Preview-Grid und zeige Hauptgrid
        this.hidePreviewGrid();
        this.showMainGrid();
        
        // Verwende gespeicherten ursprünglichen Zustand
        if (this.originalPreviewState) {
          this.selection = this.originalPreviewState.selection;
          this.cols = this.originalPreviewState.cols;
          this.rows = this.originalPreviewState.rows;
          
          if (this.orV && this.orH && this.originalPreviewState.orientation !== null) {
            this.orV.checked = this.originalPreviewState.orientation;
            this.orH.checked = !this.originalPreviewState.orientation;
          }
          
          // Zusätzliche Eigenschaften wiederherstellen
          if (this.wIn && this.originalPreviewState.cellWidth) {
            this.wIn.value = this.originalPreviewState.cellWidth;
          }
          if (this.hIn && this.originalPreviewState.cellHeight) {
            this.hIn.value = this.originalPreviewState.cellHeight;
          }
          
          // Grid wiederherstellen
          this.updateSize();
          this.buildGrid();
          
          // Gespeicherten Zustand löschen
          this.originalPreviewState = null;
          console.log('Grid preview cleared and original state restored');
        }
        
        // Sicherheitscheck: Stelle sicher, dass das Grid sichtbar ist
        setTimeout(() => {
          const mainGrid = document.getElementById('grid');
          if (mainGrid && mainGrid.style.display === 'none') {
            this.showMainGrid();
          }
        }, 100);
      }, 150); // Kurze Verzögerung für smooth Animation
    }
    
    setupResizeObserver() {
      // Performance: Resize Observer für responsive Updates
      if (this.wrapper && window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver((entries) => {
          // Debounced resize updates
          if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
          }
          
          this.resizeTimeout = setTimeout(() => {
            this.updateSize();
            this.resizeTimeout = null;
          }, 150); // 150ms debounce
        });
        
        this.resizeObserver.observe(this.wrapper);
      }
    }
    // FEATURE 8: Pinch-to-Zoom Setup
    setupPinchToZoom() {
      if (!this.wrapper) return;
      
      let initialDistance = 0;
      let initialZoom = 1;
      
      this.wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          initialDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
          initialZoom = this.zoomLevel;
        }
      });
      
      this.wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
          const scale = currentDistance / initialDistance;
          const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, initialZoom * scale));
          
          this.setZoom(newZoom);
        }
      });
      
      this.wrapper.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
          initialDistance = 0;
          initialZoom = 1;
        }
      });
    }
    
    getTouchDistance(touch1, touch2) {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    setZoom(zoomLevel) {
      this.zoomLevel = zoomLevel;
      this.wrapper.style.transform = `scale(${zoomLevel})`;
      this.wrapper.style.transformOrigin = 'center center';
    }
    
    cleanup() {
      // Memory-Leak Prävention: Timeouts löschen
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
        this.updateTimeout = null;
      }
      
      if (this.previewTimeout) {
        clearTimeout(this.previewTimeout);
        this.previewTimeout = null;
      }
      
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = null;
      }
      
      // Resize Observer cleanup
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      
      // FEATURE 5: Performance-Monitoring Cleanup
      if (this.performanceMetrics) {
        this.performanceMetrics = null;
      }
      
      // FEATURE 8: Pinch-to-Zoom Cleanup
      if (this.zoomObserver) {
        this.zoomObserver = null;
      }
      
      // Event-Listener entfernen
      if (this.gridEl) {
        this.gridEl.innerHTML = '';
      }
      
      // PDF Generator cleanup
      if (this.pdfGenerator) {
        this.pdfGenerator = null;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Kundentyp-UI (Listen/Buttons) wird global im customer-type-popup.js verwaltet
    const grid = new SolarGrid();
    grid.generateHiddenCartForms();
    window.solarGrid = grid;
  });

  // Cleanup beim Verlassen der Seite
  window.addEventListener('beforeunload', () => {
    if (calculationManager) {
      calculationManager.destroy();
    }
    
    // Memory-Leak Prävention: Event-Listener entfernen
    if (window.solarGrid) {
      window.solarGrid.cleanup();
    }
  });
})();