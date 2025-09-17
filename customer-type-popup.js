(function(){
  function isPrivate(){
    return getStoredCustomerType() === 'private';
  }
  function isBusiness(){
    return getStoredCustomerType() === 'business';
  }
  function updateCustomerTypeVisibility(){
    try{
      const privSel = ['#privat','[data-customer-type="privat"]','[data-customer-segment="privat"]','[data-list="privat"]','.collection-list-privat'];
      const gewSel  = ['#gewerbe','[data-customer-type="gewerbe"]','[data-customer-segment="gewerbe"]','[data-list="gewerbe"]','.collection-list-gewerbe'];
      const qAll = sels => sels.flatMap(s=>Array.from(document.querySelectorAll(s)));
      const hideSet = (els, hidden)=>els.forEach(el=>{ if(el&&el.style){ el.style.display = hidden? 'none':''; }});
      const privEls = qAll(privSel);
      const gewEls  = qAll(gewSel);
      hideSet(privEls, !isPrivate());
      hideSet(gewEls, isPrivate());
    }catch(e){}
  }
  function setActiveButtons(){
    try{
      const p = document.getElementById('nav-private');
      const b = document.getElementById('nav-business');
      if(p&&p.classList) p.classList.toggle('stp-btn-active', isPrivate());
      if(b&&b.classList) b.classList.toggle('stp-btn-active', !isPrivate());
    }catch(e){}
  }
  function setCustomerType(type){
    storeCustomerType(type==='business'?'business':'private');
    updateCustomerTypeVisibility();
    setActiveButtons();
    // Preise/Forms aktualisieren falls Solar-Tool aktiv
    try{
      if(window.solarGrid){
        window.solarGrid.updateCurrentTotalPrice && window.solarGrid.updateCurrentTotalPrice();
        window.solarGrid.updateOverviewTotalPrice && window.solarGrid.updateOverviewTotalPrice();
        (window.solarGrid.ensureWebflowFormsMapped || window.solarGrid.generateHiddenCartForms)?.call(window.solarGrid);
      }
    }catch(e){}
  }
  function getStoredCustomerType(){
    try{
      const raw = localStorage.getItem('solarTool_customerType');
      if(!raw) return null;
      const data = JSON.parse(raw);
      if(!data || !data.type) return null;
      if(typeof data.expiresAt === 'number' && Date.now() > data.expiresAt){
        localStorage.removeItem('solarTool_customerType');
        return null;
      }
      return data.type === 'private' ? 'private' : 'business';
    }catch(e){return null}
  }
  function storeCustomerType(type){
    try{
      const expiresAt = Date.now() + 48*60*60*1000;
      localStorage.setItem('solarTool_customerType', JSON.stringify({type, expiresAt}));
    }catch(e){}
  }
  function show(){
    const overlay = document.getElementById('customer-type-overlay');
    if(overlay){overlay.style.display='flex';overlay.setAttribute('aria-hidden','false');}
  }
  function hide(){
    const overlay = document.getElementById('customer-type-overlay');
    if(overlay){overlay.style.display='none';overlay.setAttribute('aria-hidden','true');}
  }
  function init(){
    // Navbar Buttons anbinden
    const nbP = document.getElementById('nav-private');
    const nbB = document.getElementById('nav-business');
    if(nbP) nbP.addEventListener('click', function(){ setCustomerType('private'); });
    if(nbB) nbB.addEventListener('click', function(){ setCustomerType('business'); });

    // Popup-Overlay
    const overlay = document.getElementById('customer-type-overlay');
    if(overlay){
      const already = getStoredCustomerType();
      const btnPrivate = document.getElementById('stp-private');
      const btnBusiness = document.getElementById('stp-business');
      if(btnPrivate) btnPrivate.addEventListener('click', function(){ setCustomerType('private'); hide(); });
      if(btnBusiness) btnBusiness.addEventListener('click', function(){ setCustomerType('business'); hide(); });
      if(!already){ show(); }
    }

    // Initial UI Zustand
    updateCustomerTypeVisibility();
    setActiveButtons();

    // === Warenkorb-Kompatibilitätslogik (global, auf jeder Seite aktiv) ===
    try{
      CartCompatibility.init();
    }catch(e){ /* still silent for robustness */ }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{ init(); }
})();



// === Modularer Block: Cart-Kompatibilitätsprüfung (Privat vs. Gewerbe) ===
(function(){
  var cartCompatTimer = null;
  var idMapsBuilt = false;
  var idToKey = { productIdToKey: {}, variantIdToKey: {} };
  var mapsReady = false;

  // Eingebettete Kopien der Produkt-Mappings aus script.js (leicht umbenannt)
  const POPUP_PRODUCT_MAP_BRUTTO = {
    // Module
    Solarmodul: { productId: '68c7ec7571df9723b8ef5050', variantId: '68c7ec7e71df9723b8ef53cd' }, // Ulica 450 W inkl. MwSt (Einzelprodukt)
    UlicaSolarBlackJadeFlow: { productId: '68c7ef7fbeeaadb13262a062', variantId: '68c7ef7ff397fcf9d6d7571e' }, // Ulica 500 W inkl. MwSt (Einzelprodukt)
    // Neue Paletten (inkl. MwSt)
    SolarmodulPalette: { productId: '68c7ec7471df9723b8ef5008', variantId: '68c7ec7c71df9723b8ef5160' },
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

  const POPUP_PRODUCT_MAP_NETTO = {
    Solarmodul: { productId:'685003af0e41d945fb0198d8', variantId:'685003af4a8e88cb58c89d46' },
    UlicaSolarBlackJadeFlow: { productId:'689455ed543f0cbb26ba54e9', variantId:'689455ed7d7ddfd326d5dbf9' },
    // Paletten (ohne MwSt)
    SolarmodulPalette: { productId: '68b999a74abecff30536dee0', variantId: '68b999a873f9b0df7954ed8b' },
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
    // Optionale/Neue Produkte
    Erdungsklemme: { productId:'6887e8aaa6ca43c15254d224', variantId:'6887e8abb439562cbc88db5d' },
    Quetschkabelschuhe: { productId:'68876153200e1a5e28a1b709', variantId:'6887615388988b2ccda11067' },
    Erdungsband: { productId:'688760e01c9c7973ee287386', variantId:'688760e0835845affc493354' },
    Tellerkopfschraube: { productId:'688760a7124e867cf2b20051', variantId:'688760a7f246d23f70575fb1' },
    // Optimierer (Netto)
    HuaweiOpti: { productId: '68af2934de0a7fe5d316efbc', variantId: '68af2934c230bc1eaa972585' },
    BRCOpti: { productId: '68b1e02629cec71ebfc12f0e', variantId: '68b1e02ca05a6b4aca721dc8' }
  };

  function ensureMapsDefaultedToLocal(){
    try{
      window.PRODUCT_MAP = window.PRODUCT_MAP || POPUP_PRODUCT_MAP_NETTO;
      window.PRODUCT_MAP_BRUTTO = window.PRODUCT_MAP_BRUTTO || POPUP_PRODUCT_MAP_BRUTTO;
    }catch(_){ }
  }

  // (eingebetteter Fallback entfällt, da POPUP_* Maps direkt genutzt werden)

  function tryAssignMaps(obj){
    try{
      if (obj && typeof obj === 'object'){
        if (obj.PRODUCT_MAP && typeof obj.PRODUCT_MAP === 'object' && Object.keys(obj.PRODUCT_MAP).length){
          window.PRODUCT_MAP = window.PRODUCT_MAP || obj.PRODUCT_MAP;
        }
        if (obj.PRODUCT_MAP_BRUTTO && typeof obj.PRODUCT_MAP_BRUTTO === 'object' && Object.keys(obj.PRODUCT_MAP_BRUTTO).length){
          window.PRODUCT_MAP_BRUTTO = window.PRODUCT_MAP_BRUTTO || obj.PRODUCT_MAP_BRUTTO;
        }
      }
    }catch(_){ }
  }

  function fetchJson(url){
    return new Promise(function(resolve){
      try{
        fetch(url, { credentials:'omit', cache:'no-store' }).then(function(r){
          if(!r.ok) return resolve(null);
          r.json().then(function(j){ resolve(j); }).catch(function(){ resolve(null); });
        }).catch(function(){ resolve(null); });
      }catch(_){ resolve(null); }
    });
  }

  function ensureProductMapsAvailable(){
    return new Promise(function(resolve){
      try{
        if (mapsReady) return resolve(true);
        ensureMapsDefaultedToLocal();
        mapsReady = true; resolve(true);
      }catch(_){ mapsReady = true; resolve(true); }
    });
  }

  function buildReverseMaps(){
    try{
      // 1) Aus lokalen POPUP-Maps
      Object.keys(POPUP_PRODUCT_MAP_NETTO || {}).forEach(function(k){
        var info = POPUP_PRODUCT_MAP_NETTO[k];
        if(info&&info.productId) idToKey.productIdToKey[info.productId] = k;
        if(info&&info.variantId) idToKey.variantIdToKey[info.variantId] = k;
      });
      Object.keys(POPUP_PRODUCT_MAP_BRUTTO || {}).forEach(function(k){
        var info = POPUP_PRODUCT_MAP_BRUTTO[k];
        if(info&&info.productId) idToKey.productIdToKey[info.productId] = k;
        if(info&&info.variantId) idToKey.variantIdToKey[info.variantId] = k;
      });
      // 2) Zusätzlich: globale Maps (falls vorhanden)
      if (typeof PRODUCT_MAP === 'object' && PRODUCT_MAP){
        Object.keys(PRODUCT_MAP).forEach(function(k){
          var info = PRODUCT_MAP[k];
          if(info&&info.productId) idToKey.productIdToKey[info.productId] = k;
          if(info&&info.variantId) idToKey.variantIdToKey[info.variantId] = k;
        });
      }
      if (typeof PRODUCT_MAP_BRUTTO === 'object' && PRODUCT_MAP_BRUTTO){
        Object.keys(PRODUCT_MAP_BRUTTO).forEach(function(k){
          var info = PRODUCT_MAP_BRUTTO[k];
          if(info&&info.productId) idToKey.productIdToKey[info.productId] = k;
          if(info&&info.variantId) idToKey.variantIdToKey[info.variantId] = k;
        });
      }
      // 2) Fallback: aus solarGrid-Form-Mapping ableiten
      if (window.solarGrid && typeof window.solarGrid === 'object'){
        try{
          var wgm = window.solarGrid.webflowFormMap || {};
          Object.keys(wgm || {}).forEach(function(k){
            var form = wgm[k];
            if(!form) return;
            var pid = form.getAttribute('data-commerce-product-id');
            var vid = form.getAttribute('data-commerce-sku-id');
            if(pid) idToKey.productIdToKey[pid] = k;
            if(vid) idToKey.variantIdToKey[vid] = k;
          });
        }catch(_){ }
        try{
          var wgb = window.solarGrid.webflowFormMapBrutto || {};
          Object.keys(wgb || {}).forEach(function(k){
            var form = wgb[k];
            if(!form) return;
            var pid = form.getAttribute('data-commerce-product-id');
            var vid = form.getAttribute('data-commerce-sku-id');
            if(pid) idToKey.productIdToKey[pid] = k;
            if(vid) idToKey.variantIdToKey[vid] = k;
          });
        }catch(_){ }
      }
      idMapsBuilt = true;
    }catch(e){ /* keep maps partial */ }
  }

  function getProductKeyFromIds(productId, variantId){
    if(!idMapsBuilt) buildReverseMaps();
    if(variantId && idToKey.variantIdToKey[variantId]) return idToKey.variantIdToKey[variantId];
    if(productId && idToKey.productIdToKey[productId]) return idToKey.productIdToKey[productId];
    return null;
  }

  function extractIdsFromCartItem(itemEl){
    try{
      var idEl = itemEl.querySelector('[data-commerce-sku-id], [data-commerce-product-id]') || itemEl;
      return {
        productId: idEl.getAttribute('data-commerce-product-id') || '',
        variantId: idEl.getAttribute('data-commerce-sku-id') || ''
      };
    }catch(e){ return { productId:'', variantId:'' }; }
  }

  function extractQuantityFromCartItem(itemEl){
    try{
      var qtyEl = itemEl.querySelector('input[type="number"], input[data-node-type*="quantity"], .w-commerce-commercecartquantity input');
      var val = qtyEl ? parseInt(qtyEl.value, 10) : NaN;
      return (isFinite(val) && val>0) ? val : 1;
    }catch(e){ return 1; }
  }

  function getCartList(){
    return document.querySelector('.w-commerce-commercecartlist') || document.querySelector('.w-commerce-commercecartcontainerwrapper');
  }

  function waitForCartAcknowledge(timeoutMs){
    return new Promise(function(resolve){
      var settled = false;
      var list = getCartList();
      var timer = setTimeout(function(){ if(!settled){ settled = true; resolve(); } }, timeoutMs || 1500);
      if(!list){ return; }
      var mo = new MutationObserver(function(){
        if(!settled){ settled = true; clearTimeout(timer); resolve(); }
        try{ mo.disconnect(); }catch(_){ }
      });
      try{ mo.observe(list, {childList:true, subtree:true}); }catch(_){ }
    });
  }

  function findRemoveButton(itemEl){
    var sels = [
      '[data-node-type="commerce-cart-remove-link"]',
      '[data-node-type*="remove"]',
      '.w-commerce-commercecartremovebutton',
      '.w-commerce-commercecartremove',
      'button[aria-label*="Entfernen" i]',
      'button[aria-label*="Remove" i]'
    ];
    for(var i=0;i<sels.length;i++){
      var btn = itemEl.querySelector(sels[i]);
      if(btn) return btn;
    }
    return null;
  }

  function scheduleCartCompatibilityCheck(delayMs){
    try{
      if(cartCompatTimer) clearTimeout(cartCompatTimer);
      cartCompatTimer = setTimeout(ensureCartCompatibility, Math.max(0, delayMs||100));
    }catch(_){ }
  }

  async function removeCartItem(itemEl){
    try{
      var btn = findRemoveButton(itemEl);
      if(!btn) return;
      btn.click();
      await waitForCartAcknowledge(1500);
    }catch(e){ console.warn('Cart: Entfernen fehlgeschlagen', e); }
  }

  async function addByKey(productKey, qty){
    // Bevorzugt via solarGrid, da dort die komplette Add-Queue & Brutto-Logik steckt
    try{
      if(window.solarGrid){
        try{ (window.solarGrid.ensureWebflowFormsMapped || window.solarGrid.generateHiddenCartForms).call(window.solarGrid); }catch(_){ }
        if(typeof window.solarGrid.addSingleItemAndWait === 'function'){
          await window.solarGrid.addSingleItemAndWait(productKey, qty, false);
          return;
        }
        if(typeof window.solarGrid.addProductToCart === 'function'){
          window.solarGrid.addProductToCart(productKey, qty, false);
          await waitForCartAcknowledge(1500);
          return;
        }
      }
    }catch(_){ }
    // Fallback: Ohne solarGrid kein sicherer Add-Fluss → Hinweis
    console.warn('[CartCompat] Konnte kein Add-Flow ohne solarGrid ausführen. Item wird nicht ersetzt.');
  }

  async function ensureCartCompatibility(){
    try{
      var list = getCartList();
      if(!list) return;
      var items = Array.from(list.querySelectorAll('.w-commerce-commercecartitem, [data-node-type="commerce-cart-item"]'));
      if(!items.length) return;

      // Stelle ID-Mapping bereit
      if(!idMapsBuilt) buildReverseMaps();

      for(var i=0;i<items.length;i++){
        var itemEl = items[i];
        var ids = extractIdsFromCartItem(itemEl);
        var key = getProductKeyFromIds(ids.productId, ids.variantId);
        if(!key){
          console.warn('[CartCompat] Unbekanntes Produkt im Warenkorb; wird ignoriert.');
          continue;
        }
        var shouldBeBrutto = isBusiness();
        var isBruttoNow = false;
        try{
          isBruttoNow = Object.keys(POPUP_PRODUCT_MAP_BRUTTO || {}).some(function(k){
            var info = POPUP_PRODUCT_MAP_BRUTTO[k];
            return info && (info.productId === ids.productId || info.variantId === ids.variantId);
          });
        }catch(_){ }

        if(shouldBeBrutto === isBruttoNow){
          continue; // kompatibel
        }

        // Austausch: Menge ermitteln, entfernen, korrektes Pendant hinzufügen
        var qty = extractQuantityFromCartItem(itemEl);
        await removeCartItem(itemEl);
        await addByKey(key, qty);
      }
    }catch(e){
      console.warn('Cart-Kompatibilitätsprüfung fehlgeschlagen:', e);
    }
  }

  function setupObservers(){
    try{
      // Cart-Änderungen beobachten
      var list = getCartList();
      if(list){
        var mo = new MutationObserver(function(){ scheduleCartCompatibilityCheck(50); });
        try{ mo.observe(list, {childList:true, subtree:true}); }catch(_){ }
      }
      // Globale DOM-Änderungen (Forms etc.)
      var bodyMo = new MutationObserver(function(){ scheduleCartCompatibilityCheck(100); });
      try{ bodyMo.observe(document.body, {childList:true, subtree:true}); }catch(_){ }
    }catch(_){ }
  }

  window.CartCompatibility = {
    init: function(){
      try{
        ensureProductMapsAvailable().then(function(){
          // Falls solarGrid existiert: sichergehen, dass Forms gemappt sind
          if(window.solarGrid && (window.solarGrid.generateHiddenCartForms || window.solarGrid.ensureWebflowFormsMapped)){
            try{ (window.solarGrid.ensureWebflowFormsMapped || window.solarGrid.generateHiddenCartForms).call(window.solarGrid); }catch(_){ }
          }
          if(!idMapsBuilt) buildReverseMaps();
          setupObservers();
          scheduleCartCompatibilityCheck(300); // initial verzögert
        });
      }catch(_){ }
    },
    // öffentliche Planungsmethode, damit externe Module (z. B. script.js) triggern können
    schedule: function(delayMs){
      scheduleCartCompatibilityCheck(delayMs);
    }
  };
})();
