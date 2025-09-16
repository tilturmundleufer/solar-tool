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

  function buildReverseMaps(){
    try{
      // 1) Aus globalen Maps (falls vorhanden)
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
          if (typeof PRODUCT_MAP_BRUTTO === 'object' && PRODUCT_MAP_BRUTTO){
            isBruttoNow = Object.keys(PRODUCT_MAP_BRUTTO).some(function(k){
              var info = PRODUCT_MAP_BRUTTO[k];
              return info && (info.productId === ids.productId || info.variantId === ids.variantId);
            });
          }
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
        // Falls solarGrid existiert: sichergehen, dass Forms gemappt sind
        if(window.solarGrid && (window.solarGrid.generateHiddenCartForms || window.solarGrid.ensureWebflowFormsMapped)){
          try{ (window.solarGrid.ensureWebflowFormsMapped || window.solarGrid.generateHiddenCartForms).call(window.solarGrid); }catch(_){ }
        }
        setupObservers();
        scheduleCartCompatibilityCheck(300); // initial verzögert
      }catch(_){ }
    }
  };
})();
