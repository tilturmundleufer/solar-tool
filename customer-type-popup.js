  function normalizeSearchText(str){
    try{
      return (str||'').toString().toLowerCase().replace(/\s+/g,' ').trim();
    }catch(_){ return ''; }
  }
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
      // Sliding Indicator Container-Klassen setzen
      const container = document.querySelector('.customer-type-switch');
      if(container && container.classList){
        container.classList.toggle('is-private', isPrivate());
        container.classList.toggle('is-business', !isPrivate());
      }
    }catch(e){}
  }

  // === Segmentierte CMS-Suche (scoped auf Privat/Gewerbe-Bereiche) ===
  var cmsSearchInitialized = false;
  function getSegmentRootForElement(el){
    try{
      const privSel = ['#privat','[data-customer-type="privat"]','[data-customer-segment="privat"]','[data-list="privat"]','.collection-list-privat'];
      const gewSel  = ['#gewerbe','[data-customer-type="gewerbe"]','[data-customer-segment="gewerbe"]','[data-list="gewerbe"]','.collection-list-gewerbe'];
      const sels = privSel.concat(gewSel);
      var node = el;
      while(node && node !== document){
        for(var i=0;i<sels.length;i++){
          try{ if(node.matches && node.matches(sels[i])) return node; }catch(_){ }
        }
        node = node.parentElement;
      }
      return null;
    }catch(_){ return null; }
  }

  function getVisibleSegmentRoot(){
    try{
      const privSel = ['#privat','[data-customer-type="privat"]','[data-customer-segment="privat"]','[data-list="privat"]','.collection-list-privat'];
      const gewSel  = ['#gewerbe','[data-customer-type="gewerbe"]','[data-customer-segment="gewerbe"]','[data-list="gewerbe"]','.collection-list-gewerbe'];
      const sels = isPrivate() ? privSel : gewSel;
      for(var i=0;i<sels.length;i++){
        var node = document.querySelector(sels[i]);
        if(node){ try{ var cs = window.getComputedStyle(node); if(cs.display !== 'none' && cs.visibility !== 'hidden') return node; }catch(_){ return node; } }
      }
      return null;
    }catch(_){ return null; }
  }

  // Heuristische Klassifikation der Such-Items in Brutto/Netto
  function classifyItemGrossNet(item){
    try{
      // Explizite Flags bevorzugen
      var t = (item.getAttribute('data-price-type')||'').toLowerCase();
      if(t === 'brutto') return 'brutto';
      if(t === 'netto')  return 'netto';
      var ct = (item.getAttribute('data-customer-type')||'').toLowerCase();
      if(ct === 'gewerbe') return 'brutto';
      if(ct === 'privat')  return 'netto';
      var bruttoAttr = (item.getAttribute('data-brutto')||'').toLowerCase();
      if(bruttoAttr === 'true' || bruttoAttr === '1') return 'brutto';

      // Anchor/Text-Heuristiken
      var a = item.querySelector('a[href]');
      var hay = ((a && (a.textContent + ' ' + a.getAttribute('href'))) || item.textContent || '').toLowerCase();
      if(/inkl\.?\s*mwst|brutto/.test(hay)) return 'brutto';
      if(/exkl\.?\s*mwst|ohne\s*mwst|netto/.test(hay)) return 'netto';
      if(/-inkl-mwst/.test(hay)) return 'brutto';
      if(/-exkl-mwst/.test(hay)) return 'netto';
    }catch(_){ }
    return null; // unbekannt
  }

  function itemMatchesCurrentCustomerType(item){
    try{
      var preferBrutto = isBusiness();
      // 1) Bereits ermittelte Klassifizierung nutzen
      var resolved = (item.getAttribute('data-price-resolved')||'').toLowerCase();
      if(resolved === 'brutto') return preferBrutto === true;
      if(resolved === 'netto')  return preferBrutto === false;
      // 2) Versuche sofortige ID-basierte Auflösung (synchron)
      var sync = extractIdsFromCmsItemSync(item);
      if(sync.variantId){
        var t = resolvePriceTypeFromVariantId(sync.variantId);
        if(t){ item.setAttribute('data-price-resolved', t); return preferBrutto ? t==='brutto' : t==='netto'; }
      }
      // 3) Heuristik (Fallback)
      var cls = classifyItemGrossNet(item);
      if(cls){ item.setAttribute('data-price-resolved', cls); return preferBrutto ? cls==='brutto' : cls==='netto'; }
      // 4) Unbekannt → bei Firmenkunden strikt ausblenden, bei Privatkunden toleranter anzeigen
      return preferBrutto ? false : true;
    }catch(_){ return true; }
  }

  // Caches für ID-Auflösung
  var _urlToIdsCache = Object.create(null);
  var _idTypeCache = Object.create(null); // variantId/productId -> 'brutto'|'netto'

  function resolvePriceTypeFromIds(productId, variantId){
    try{
      if(!idMapsBuilt) buildReverseMaps();
    }catch(_){ }
    if(variantId && _idTypeCache[variantId]) return _idTypeCache[variantId];
    if(productId && _idTypeCache[productId]) return _idTypeCache[productId];
    var type = null;
    try{
      // 1) Exakte ID-Matches bevorzugen (Variant vor Product)
      if(variantId){
        if(Object.keys(POPUP_PRODUCT_MAP_BRUTTO||{}).some(function(k){ var v=POPUP_PRODUCT_MAP_BRUTTO[k]; return v&&v.variantId===variantId; })) type='brutto';
        if(!type && Object.keys(POPUP_PRODUCT_MAP_NETTO||{}).some(function(k){ var v=POPUP_PRODUCT_MAP_NETTO[k]; return v&&v.variantId===variantId; })) type='netto';
      }
      if(!type && productId){
        if(Object.keys(POPUP_PRODUCT_MAP_BRUTTO||{}).some(function(k){ var v=POPUP_PRODUCT_MAP_BRUTTO[k]; return v&&v.productId===productId; })) type='brutto';
        if(!type && Object.keys(POPUP_PRODUCT_MAP_NETTO||{}).some(function(k){ var v=POPUP_PRODUCT_MAP_NETTO[k]; return v&&v.productId===productId; })) type='netto';
      }
      // 2) Wenn immer noch unbekannt, versuche Key-Auflösung und vergleiche ID gegen Map-Eintrag
      if(!type){
        var keyByVar = variantId && idToKey.variantIdToKey[variantId];
        var keyByProd = productId && idToKey.productIdToKey[productId];
        var key = keyByVar || keyByProd || null;
        if(key){
          var b = (POPUP_PRODUCT_MAP_BRUTTO && POPUP_PRODUCT_MAP_BRUTTO[key]) || (typeof PRODUCT_MAP_BRUTTO==='object' && PRODUCT_MAP_BRUTTO && PRODUCT_MAP_BRUTTO[key]);
          var n = (POPUP_PRODUCT_MAP_NETTO && POPUP_PRODUCT_MAP_NETTO[key]) || (typeof PRODUCT_MAP==='object' && PRODUCT_MAP && PRODUCT_MAP[key]);
          if(b && (b.variantId===variantId || b.productId===productId)) type='brutto';
          else if(n && (n.variantId===variantId || n.productId===productId)) type='netto';
        }
      }
    }catch(_){ }
    if(variantId && type) _idTypeCache[variantId] = type;
    if(productId && type) _idTypeCache[productId] = type;
    return type;
  }

  function extractIdsFromCmsItemSync(item){
    try{
      var el = item.querySelector('[data-commerce-sku-id], [data-commerce-product-id]') || item;
      var pid = el.getAttribute('data-commerce-product-id') || '';
      var vid = el.getAttribute('data-commerce-sku-id') || '';
      // Falls nicht direkt am Item: versuche im Link Daten-Attribute
      if(!vid){
        var a = item.querySelector('a[data-commerce-sku-id], a[data-commerce-product-id]');
        if(a){
          pid = pid || a.getAttribute('data-commerce-product-id') || '';
          vid = a.getAttribute('data-commerce-sku-id') || '';
        }
      }
      return { productId: pid, variantId: vid };
    }catch(_){ return { productId:'', variantId:'' }; }
  }

  async function extractIdsFromCmsItemAsync(item){
    try{
      var ids = extractIdsFromCmsItemSync(item);
      if(ids.productId || ids.variantId) return ids;
      var a = item.querySelector('a[href]');
      if(!a) return ids;
      var href = a.getAttribute('href');
      if(!href) return ids;
      if(_urlToIdsCache[href]) return _urlToIdsCache[href];
      // Seite anfragen und IDs aus erstem Add-to-Cart-Formular lesen
      var res = await fetch(href, { credentials:'omit', cache:'force-cache' }).catch(function(){ return null; });
      if(!res || !res.ok){ _urlToIdsCache[href] = ids; return ids; }
      var html = await res.text().catch(function(){ return ''; });
      var doc = null;
      try{ doc = new DOMParser().parseFromString(html, 'text/html'); }catch(_){ doc = null; }
      if(doc){
        var form = doc.querySelector('form[data-node-type="commerce-add-to-cart-form"]');
        if(form){
          ids.productId = form.getAttribute('data-commerce-product-id') || '';
          ids.variantId = form.getAttribute('data-commerce-sku-id') || '';
        }
      }
      _urlToIdsCache[href] = ids;
      return ids;
    }catch(_){ return { productId:'', variantId:'' }; }
  }

  async function refineCmsListByIds(root, key, term){
    try{
      var preferBrutto = isBusiness();
      var items = root.querySelectorAll('[data-search="cms-item-'+key+'"], [data-search="cms_item_'+key+'"]');
      var changed = false;
      var DBG = false; try{ DBG = localStorage && localStorage.getItem('CMS_SEARCH_DEBUG')==='1'; }catch(_){ }
      for(var i=0;i<items.length;i++){
        var it = items[i];
        // Neu: bereits klassifizierte Items behalten, aber Anzeige strikt am aktuellen Kundentyp ausrichten
        var already = it.getAttribute('data-price-resolved');
        var finalType = already;
        // 1) Versuche zuerst lokale IDs (ohne Fetch)
        if(!finalType){
          var localIds = extractIdsFromCmsItemSync(it);
          var localType = resolvePriceTypeFromIds(localIds.productId, localIds.variantId) || null;
          if(localType){ finalType = localType; it.setAttribute('data-price-resolved', finalType); changed = true; }
          // 2) Private: Wenn keine lokalen IDs vorhanden → NICHT per Fetch klassifizieren (vermeidet falsche Brutto-Matches)
          if(!finalType && isPrivate()){
            if(DBG){ console.warn('[CMS-SEARCH] skip fetch for private; no local ids', localIds); }
          }else if(!finalType){
            // 3) Business oder lokale IDs vorhanden → Fetch erlaubt
            var ids = await extractIdsFromCmsItemAsync(it);
            finalType = resolvePriceTypeFromIds(ids.productId, ids.variantId) || null;
            if(finalType){ it.setAttribute('data-price-resolved', finalType); changed = true; }
          }
        }
        // Wenn aktuell sichtbar, aber Kundentyp nicht passt → verstecken; umgekehrt sichtbar machen, wenn Suchterm passt
        var raw = (it.textContent||'').toString().toLowerCase();
        var matchesTerm = term ? (raw.indexOf(term) !== -1) : true;
        var shouldShow = matchesTerm && (!finalType || (preferBrutto ? finalType==='brutto' : finalType==='netto'));
        it.style.display = shouldShow ? '' : 'none';
        if(shouldShow){
          try{ if(getComputedStyle(it).display === 'none'){ it.style.display = 'block'; } }catch(_){ }
        }
        if(DBG){ try{ var dbgIds = extractIdsFromCmsItemSync(it); console.log('[CMS-SEARCH] refine item', {finalType, preferBrutto, shouldShow, vid:dbgIds.variantId, pid:dbgIds.productId}); }catch(_){ } }
      }
      if(changed){
        // No-Result neu berechnen
        var total = items.length, hidden = 0;
        for(var j=0;j<items.length;j++){ if(getComputedStyle(items[j]).display === 'none') hidden++; }
        var noRes = root.querySelector('[data-div="noResult-'+key+'"], [data-div="noResult_'+key+'"]');
        if(noRes){ noRes.style.display = (total>0 && hidden===total && term!=='') ? '' : 'none'; }
        // Wrapper sichtbar halten
        try{
          var wrapper = root.querySelector('.search-cms-wrapper, [role="list"]') || (items[0] && items[0].parentElement);
          if(wrapper){ wrapper.style.display = ''; if(getComputedStyle(wrapper).display === 'none'){ wrapper.style.display = 'block'; } }
        }catch(_){ }
      }
    }catch(_){ }
  }

  function handleSearchInput(input){
    try{
      var DBG = false; try{ DBG = localStorage && localStorage.getItem('CMS_SEARCH_DEBUG')==='1'; }catch(_){ }
      var attr = (input.getAttribute('data-input')||'').toString();
      var m = attr.match(/^search-(.+)$/);
      if(!m) return;
      var key = m[1];
      var root = getSegmentRootForElement(input) || getVisibleSegmentRoot() || document;
      var term = normalizeSearchText((input.value||''));
      var items = root.querySelectorAll('[data-search="cms-item-'+key+'"], [data-search="cms_item_'+key+'"]');
      try{ console.warn('[CMS-SEARCH] handle input', {type: isBusiness()?'business':'private', key, term, items: items.length}); }catch(_){ }

      // Sonderfall: leerer Begriff → alle Items zeigen, No-Result ausblenden
      if(term === ''){
        for(var s=0;s<items.length;s++){ items[s].style.display = itemMatchesCurrentCustomerType(items[s]) ? '' : 'none'; }
        var nr0 = root.querySelector('[data-div="noResult-'+key+'"]');
        if(nr0) nr0.style.display='none';
        var pf0 = ((input.getAttribute('data-url')||'').toString().toLowerCase() === 'true');
        if(pf0){ try{ var u0=new URL(window.location.href); u0.searchParams.delete('search-'+key); window.history.pushState({},'',u0);}catch(_){}}
        try{ refineCmsListByIds(root, key, ''); }catch(_){ }
        return;
      }

      // Für jedes Item Suchtext bestimmen: bevorzugt data-text innerhalb des Items, sonst gesamter Item-Text
      var anyVisible = 0;
      for(var i=0;i<items.length;i++){
        var it = items[i];
        // Sammle alle definierten Suchtexte im Item
        var nodes = it.querySelectorAll('[data-text="search-'+key+'"], [data-text="search_'+key+'"]');
        var rawAgg = '';
        if(nodes && nodes.length){
          for(var n=0;n<nodes.length;n++){ rawAgg += ' ' + (nodes[n].textContent||''); }
        }
        if(!rawAgg){
          var a = it.querySelector('a');
          if(a) rawAgg = (a.textContent||'');
          else rawAgg = (it.textContent||'');
        }
        var txt = normalizeSearchText(rawAgg);
        var match = txt.indexOf(term) !== -1 && itemMatchesCurrentCustomerType(it);
        if(match){
          it.style.display = '';
          // Falls CSS standardmäßig versteckt, explizit sichtbar machen
          try{ if(getComputedStyle(it).display === 'none'){ it.style.display = 'block'; } }catch(_){ }
          anyVisible++;
        }else{
          it.style.display = 'none';
        }
        try{ var ids=extractIdsFromCmsItemSync(it); console.log('[CMS-SEARCH] item', {vid:ids.variantId,pid:ids.productId,match, textLen: txt.length}); }catch(_){ }
      }

      var total = items.length, hidden = 0;
      for(var j=0;j<items.length;j++){ if(getComputedStyle(items[j]).display === 'none') hidden++; }
      var noRes = root.querySelector('[data-div="noResult-'+key+'"], [data-div="noResult_'+key+'"]');
      if(noRes){ noRes.style.display = (total>0 && hidden===total) ? '' : 'none'; }
      // Ergebnisse-Wrapper sichtbar halten
      try{
        var wrapper = root.querySelector('.search-cms-wrapper, [role="list"]') || (items[0] && items[0].parentElement);
        if(wrapper){ wrapper.style.display = ''; if(getComputedStyle(wrapper).display === 'none'){ wrapper.style.display = 'block'; } }
      }catch(_){ }
      var paramFlag = ((input.getAttribute('data-url')||'').toString().toLowerCase() === 'true');
      if(paramFlag){
        try{
          var url = new URL(window.location.href);
          url.searchParams.set('search-'+key, input.value);
          window.history.pushState({}, '', url);
        }catch(_){ }
      }
      // Asynchron IDs verfeinern (zeigt nur passende Items für aktuellen Kundentyp)
      try{ console.warn('[CMS-SEARCH] refine async');
        // Debounce Refinement, um Log-Spam und Flackern zu reduzieren
        clearTimeout(handleSearchInput._rto);
        handleSearchInput._rto = setTimeout(function(){
          // Falls inzwischen ein anderer Kundentyp aktiv ist, verwende aktuellen
          try{ var currentRoot = getVisibleSegmentRoot() || root; refineCmsListByIds(currentRoot, key, term); }catch(_){ refineCmsListByIds(root, key, term); }
        }, 250);
      }catch(_){ }
    }catch(_){ }
  }

  function initSegmentedCmsSearch(){
    try{
      if(cmsSearchInitialized) return;
      cmsSearchInitialized = true;
      // Delegiertes Event-Handling (jQuery-unabhängig)
      try{ console.warn('[CMS-SEARCH] init binding events'); }catch(_){ }
      var DBG = false; try{ DBG = localStorage && localStorage.getItem('CMS_SEARCH_DEBUG')==='1'; }catch(_){ }
      document.addEventListener('input', function(e){
        var t = e.target;
        try{ if(!t || !t.matches || !t.matches('[data-input^="search-"]')) return; }catch(_){ return; }
        try{ console.warn('[CMS-SEARCH] input event fired'); }catch(_){ }
        handleSearchInput(t);
      }, true);
      document.addEventListener('keyup', function(e){
        var t = e.target;
        try{ if(!t || !t.matches || !t.matches('[data-input^="search-"]')) return; }catch(_){ return; }
        try{ console.warn('[CMS-SEARCH] keyup event fired'); }catch(_){ }
        handleSearchInput(t);
      }, true);
      // Initialzustand + URL-Vorbelegung je Input
      var inputs = document.querySelectorAll('[data-input^="search-"]');
      for(var i=0;i<inputs.length;i++){
        var inp = inputs[i];
        var attr = inp.getAttribute('data-input')||'';
        var m = attr.match(/^search-(.+)$/); if(!m) continue; var key = m[1];
        var root = getSegmentRootForElement(inp) || document;
        var noRes = root.querySelector('[data-div="noResult-'+key+'"], [data-div="noResult_'+key+'"]'); if(noRes) noRes.style.display='none';
        try{
          var paramFlag = ((inp.getAttribute('data-url')||'').toString().toLowerCase() === 'true');
          if(paramFlag){
            var sp = new URLSearchParams(window.location.search);
            var preset = sp.get('search-'+key);
            if(preset){ inp.value = preset; handleSearchInput(inp); }
          }
        }catch(_){ }
        // Initial einmal triggern, auch ohne URL-Param, damit Logs erscheinen
        try{ handleSearchInput(inp); }catch(_){ }
        // IDs asynchron auflösen, damit Brutto/Netto-Klassifizierung greift
        try{ console.warn('[CMS-SEARCH] init refine for', {key}); refineCmsListByIds(root, key, (inp.value||'').toString().toLowerCase()); }catch(_){ }
      }
    }catch(_){ }
  }

  function refilterSegmentedCmsSearchForCurrentCustomerType(){
    try{
      var inputs = document.querySelectorAll('[data-input^="search-"]');
      for(var i=0;i<inputs.length;i++){
        var inp = inputs[i];
        var val = (inp.value||'');
        var attr = inp.getAttribute('data-input')||'';
        var m = attr.match(/^search-(.+)$/); if(!m) continue; var key = m[1];
        var root = getSegmentRootForElement(inp) || document;
        // Vor dem Refilter evtl. alte Klassifizierungen entfernen (Wechsel Firma ↔ Privat)
        try{
          var allItems = root.querySelectorAll('[data-search="cms-item-'+key+'"], [data-search="cms_item_'+key+'"]');
          for(var r=0;r<allItems.length;r++){
            allItems[r].removeAttribute('data-price-resolved');
          }
        }catch(_){ }
        if(val !== ''){ handleSearchInput(inp); }
        else{
          // Leeres Feld: Zeige alle Items, die zum Kundentyp passen
          var items = root.querySelectorAll('[data-search="cms-item-'+key+'"], [data-search="cms_item_'+key+'"]');
          for(var k=0;k<items.length;k++){
            var it = items[k];
            var ok = itemMatchesCurrentCustomerType(it);
            it.style.display = ok ? '' : 'none';
          }
          var noRes = root.querySelector('[data-div="noResult-'+key+'"], [data-div="noResult_'+key+'"]'); if(noRes) noRes.style.display='none';
          // Ergebnis-Wrapper sichtbar machen
          try{
            var wrapper = root.querySelector('.search-cms-wrapper, [role="list"]') || (items[0] && items[0].parentElement);
            if(wrapper){ wrapper.style.display = ''; if(getComputedStyle(wrapper).display === 'none'){ wrapper.style.display = 'block'; } }
          }catch(_){ }
          // IDs verfeinern, um unbekannte Elemente korrekt zuzuordnen
          try{ refineCmsListByIds(root, key, ''); }catch(_){ }
        }
      }
    }catch(_){ }
  }
  function setCustomerType(type){
    storeCustomerType(type==='business'?'business':'private');
    updateCustomerTypeVisibility();
    setActiveButtons();
    // Segmentierte CMS-Suche neu anwenden
    try{ refilterSegmentedCmsSearchForCurrentCustomerType(); }catch(_){ }
    // Preise/Forms aktualisieren falls Solar-Tool aktiv
    try{
      if(window.solarGrid){
        window.solarGrid.updateCurrentTotalPrice && window.solarGrid.updateCurrentTotalPrice();
        window.solarGrid.updateOverviewTotalPrice && window.solarGrid.updateOverviewTotalPrice();
        (window.solarGrid.ensureWebflowFormsMapped || window.solarGrid.generateHiddenCartForms)?.call(window.solarGrid);
      }
    }catch(e){}
    // Direkt nach Wechsel: Warenkorb-Kompatibilität anstoßen (ohne Cart zu öffnen)
    try{ if (window.CartCompatibility && typeof window.CartCompatibility.schedule==='function'){ window.CartCompatibility.schedule(150); } }catch(_){ }
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
    // CMS-Suche (segmentiert) initialisieren
    try{ initSegmentedCmsSearch(); }catch(_){ }

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
  var compatRunning = false;
  var lastCompatRun = 0;
  var MIN_COMPAT_INTERVAL_MS = 2000; // Entschärfung gegen Flickern
  var compatRequestCounter = 0; // zählt manuelle/observer-Requests

  // Lokale Helpers, da dieses IIFE keinen Zugriff auf die obigen UI-Helfer hat
  function getStoredCustomerTypeLocal(){
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
    }catch(_){ return null; }
  }
  function isBusiness(){ return getStoredCustomerTypeLocal() === 'business'; }
  function isPrivate(){ return getStoredCustomerTypeLocal() === 'private'; }

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
      // 3) DOM-Formulare direkt durchsuchen (ohne script.js)
      try{
        var allForms = Array.from(document.querySelectorAll('form[data-node-type="commerce-add-to-cart-form"]'));
        allForms.forEach(function(form){
          var pid = form.getAttribute('data-commerce-product-id');
          var vid = form.getAttribute('data-commerce-sku-id');
          if(pid && !idToKey.productIdToKey[pid]){
            // Versuche Key aus bekannten Maps zu ermitteln
            var k = null;
            Object.keys(POPUP_PRODUCT_MAP_NETTO||{}).some(function(key){ var v = POPUP_PRODUCT_MAP_NETTO[key]; if(v&&v.productId===pid){ k=key; return true;} return false; });
            if(!k) Object.keys(POPUP_PRODUCT_MAP_BRUTTO||{}).some(function(key){ var v = POPUP_PRODUCT_MAP_BRUTTO[key]; if(v&&v.productId===pid){ k=key; return true;} return false; });
            if(!k && typeof PRODUCT_MAP==='object') Object.keys(PRODUCT_MAP).some(function(key){ var v = PRODUCT_MAP[key]; if(v&&v.productId===pid){ k=key; return true;} return false; });
            if(!k && typeof PRODUCT_MAP_BRUTTO==='object') Object.keys(PRODUCT_MAP_BRUTTO).some(function(key){ var v = PRODUCT_MAP_BRUTTO[key]; if(v&&v.productId===pid){ k=key; return true;} return false; });
            if(k) idToKey.productIdToKey[pid] = k;
          }
          if(vid && !idToKey.variantIdToKey[vid]){
            var k2 = null;
            Object.keys(POPUP_PRODUCT_MAP_NETTO||{}).some(function(key){ var v = POPUP_PRODUCT_MAP_NETTO[key]; if(v&&v.variantId===vid){ k2=key; return true;} return false; });
            if(!k2) Object.keys(POPUP_PRODUCT_MAP_BRUTTO||{}).some(function(key){ var v = POPUP_PRODUCT_MAP_BRUTTO[key]; if(v&&v.variantId===vid){ k2=key; return true;} return false; });
            if(!k2 && typeof PRODUCT_MAP==='object') Object.keys(PRODUCT_MAP).some(function(key){ var v = PRODUCT_MAP[key]; if(v&&v.variantId===vid){ k2=key; return true;} return false; });
            if(!k2 && typeof PRODUCT_MAP_BRUTTO==='object') Object.keys(PRODUCT_MAP_BRUTTO).some(function(key){ var v = PRODUCT_MAP_BRUTTO[key]; if(v&&v.variantId===vid){ k2=key; return true;} return false; });
            if(k2) idToKey.variantIdToKey[vid] = k2;
          }
        });
      }catch(_){ }
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
      var qtyEl = itemEl.querySelector('input[type="number"], input[data-node-type*="quantity"], .w-commerce-commercecartquantity input, input[name*="quantity" i]');
      var val = qtyEl ? parseInt(qtyEl.value, 10) : NaN;
      return (isFinite(val) && val > 0) ? val : 1; // nur Inputs vertrauen, sonst 1
    }catch(e){ return 1; }
  }

  function getCartList(){
    return document.querySelector('.w-commerce-commercecartlist') || document.querySelector('.w-commerce-commercecartcontainerwrapper');
  }

  function findCartItemByIds(productId, variantId){
    try{
      var list = getCartList();
      if(!list) return null;
      var all = Array.from(list.querySelectorAll('.w-commerce-commercecartitem, [data-node-type="commerce-cart-item"]'));
      for(var i=0;i<all.length;i++){
        var el = all[i];
        var pid = el.getAttribute('data-commerce-product-id') || (el.querySelector('[data-commerce-product-id]') && el.querySelector('[data-commerce-product-id]').getAttribute('data-commerce-product-id')) || '';
        var vid = el.getAttribute('data-commerce-sku-id') || (el.querySelector('[data-commerce-sku-id]') && el.querySelector('[data-commerce-sku-id]').getAttribute('data-commerce-sku-id')) || '';
        if ((productId && pid === productId) || (variantId && vid === variantId)) return el;
      }
      return null;
    }catch(_){ return null; }
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
    // Klassen dürfen keine Rolle spielen → breite Attribut-/Textsuche
    var sels = [
      '[data-wf-cart-action="remove-item"]',
      '[data-wf-cart-action*="remove" i]',
      '[data-node-type="commerce-cart-remove-link"]',
      '[data-node-type*="remove" i]',
      'a[role="button"][aria-label*="remove" i]',
      'button[aria-label*="remove" i]',
      '.w-commerce-commercecartremovebutton',
      '.w-commerce-commercecartremove'
    ];
    for(var i=0;i<sels.length;i++){
      var cand = itemEl.querySelector(sels[i]);
      if(cand) return cand;
    }
    // Fallback: Element mit Text "Entfernen"/"Remove"
    try{
      var textCandidates = Array.from(itemEl.querySelectorAll('a,button,div,span')).filter(function(n){
        var t = (n.textContent||'').trim().toLowerCase();
        return t === 'entfernen' || t === 'remove' || t.indexOf('entfernen')>=0 || t.indexOf('remove')>=0;
      });
      if(textCandidates.length) return textCandidates[0];
    }catch(_){ }
    return null;
  }

  function scheduleCartCompatibilityCheck(delayMs){
    try{
      if(cartCompatTimer) clearTimeout(cartCompatTimer);
      var myReqId = ++compatRequestCounter;
      var startIn = Math.max(0, delayMs||250);
      var attempt = function(){
        // Wenn ein neueres Request existiert, diesen Versuch überspringen und warten
        if (myReqId < compatRequestCounter) { return; }
        // Wenn gerade ein Lauf aktiv ist, später erneut versuchen
        if (compatRunning) { cartCompatTimer = setTimeout(attempt, 200); return; }
        var now = Date.now();
        var remaining = Math.max(0, MIN_COMPAT_INTERVAL_MS - (now - lastCompatRun));
        if (remaining > 0) { cartCompatTimer = setTimeout(attempt, remaining); return; }
        ensureCartCompatibility();
      };
      cartCompatTimer = setTimeout(attempt, startIn);
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
    // Fallback: Eigenständiger Add-Flow (ohne script.js)
    try{
      // Silent Mode: Cart geschlossen halten
      var wrapper = document.querySelector('.w-commerce-commercecartcontainerwrapper');
      var initiallyVisible = false;
      try{ if(wrapper){ var cs0 = window.getComputedStyle(wrapper); initiallyVisible = (cs0.display !== 'none' && cs0.visibility !== 'hidden'); wrapper.style.display='none'; } }catch(_){ }
      var preferBrutto = isBusiness();
      var info = (preferBrutto ? (POPUP_PRODUCT_MAP_BRUTTO[productKey] || (typeof PRODUCT_MAP_BRUTTO==='object'&&PRODUCT_MAP_BRUTTO[productKey]))
                               : (POPUP_PRODUCT_MAP_NETTO[productKey]  || (typeof PRODUCT_MAP==='object'&&PRODUCT_MAP[productKey])) ) || null;
      var form = null;
      if(info){
        form = document.querySelector('form[data-node-type="commerce-add-to-cart-form"][data-commerce-product-id="'+info.productId+'"]') ||
               document.querySelector('form[data-node-type="commerce-add-to-cart-form"][data-commerce-sku-id="'+info.variantId+'"]');
      }
      if(!form){
        // Versuche generisch anhand Reverse-Map → finde irgendein passendes Formular
        var allForms = Array.from(document.querySelectorAll('form[data-node-type="commerce-add-to-cart-form"]'));
        for(var i=0;i<allForms.length;i++){
          var f = allForms[i];
          var pid = f.getAttribute('data-commerce-product-id');
          var vid = f.getAttribute('data-commerce-sku-id');
          var key = getProductKeyFromIds(pid, vid);
          if(key === productKey){ form = f; break; }
        }
      }
      if(!form) { console.warn('[CartCompat] Add-Form für', productKey, 'nicht gefunden.'); return; }
      // Menge setzen
      try{ var qEl = form.querySelector('input[name="commerce-add-to-cart-quantity-input"]'); if(qEl){ qEl.value = qty; } }catch(_){ }
      // required selects bestücken
      try{ Array.from(form.querySelectorAll('select[required]')).forEach(function(sel){ if(!sel.value){ var opt = sel.querySelector('option[value]:not([value=""])'); if(opt) sel.value = opt.value; } }); }catch(_){ }
      // Add-Button robust finden
      var addBtn = form.querySelector('input[data-node-type="commerce-add-to-cart-button"], [data-wf-cart-action="add-item"], [data-wf-cart-action*="add" i], input[type="submit"], button[type="submit"]');
      if(!addBtn){ console.warn('[CartCompat] Add-Button nicht gefunden für', productKey); return; }
      var ack = waitForCartAcknowledge(1500);
      addBtn.click();
      await ack;
      // Sichtbarkeit wiederherstellen, aber ohne Open-Klasse
      try{ if(wrapper){ wrapper.style.display = initiallyVisible ? '' : 'none'; } if(document.body && document.body.classList){ document.body.classList.remove('w-commerce-commercecartopen','wf-commerce-cart-open'); } }catch(_){ }
    }catch(e){
      console.warn('[CartCompat] Eigenständiger Add-Flow fehlgeschlagen:', e);
    }
  }

  async function ensureCartCompatibility(){
    try{
      // Reentrancy/Throttling: vermeidet Dauerschleifen und Flackern
      if (compatRunning) return;
      var now = Date.now();
      if (now - lastCompatRun < MIN_COMPAT_INTERVAL_MS) return;
      if (document.hidden) return; // Seite nicht aktiv → warten
      // Nicht während der Add-Queue des Konfigurators eingreifen
      try{ if (window.solarGrid && window.solarGrid.isAddingToCart) return; }catch(_){ }
      // Wenn der Cart sichtbar/offen ist, Eingriff aufschieben (vermeidet Open-Toggles)
      try{
        var wrapper = document.querySelector('.w-commerce-commercecartcontainerwrapper');
        if (wrapper){
          var cs = window.getComputedStyle(wrapper);
          var openCls = document.body && document.body.classList && (document.body.classList.contains('w-commerce-commercecartopen') || document.body.classList.contains('wf-commerce-cart-open'));
          var dialog = wrapper.querySelector('[role="dialog"], .w-commerce-commercecartcontainer');
          var dialogVisible = dialog ? (function(){ var dcs = window.getComputedStyle(dialog); return dcs.display !== 'none' && dcs.visibility !== 'hidden'; })() : false;
          if ((cs.display !== 'none' && cs.visibility !== 'hidden') && (openCls || dialogVisible)){
            return; // Cart aktuell offen → nicht manipulieren
          }
        }
      }catch(_){ }

      compatRunning = true;
      var list = getCartList();
      if(!list) return;
      var items = Array.from(list.querySelectorAll('.w-commerce-commercecartitem, [data-node-type="commerce-cart-item"]'));
      if(!items.length) return;
      // Snapshot: IDs, Key und Menge sichern (keine DOM-Referenzen, um Stale-Nodes zu vermeiden)
      var queue = items.map(function(el){
        var ids = extractIdsFromCartItem(el);
        var key = getProductKeyFromIds(ids.productId, ids.variantId);
        var qty = extractQuantityFromCartItem(el);
        return { productId: ids.productId, variantId: ids.variantId, key: key, qty: qty };
      });

      // Stelle ID-Mapping bereit
      if(!idMapsBuilt) buildReverseMaps();

      // Während Austausch Cart visuell verstecken, damit Webflow kein Auto-Open zeigt
      try{ if (window.solarGrid && typeof window.solarGrid.hideCartContainer === 'function') window.solarGrid.hideCartContainer(); }catch(_){ }

      // Produkte sequenziell verarbeiten: altes entfernen → neues mit gleicher Menge hinzufügen
      for(var i=0;i<queue.length;i++){
        var snap = queue[i];
        var key = snap.key;
        var itemEl = findCartItemByIds(snap.productId, snap.variantId);
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

        // Austausch: Menge aus Snapshot verwenden, dann entfernen und Pendant hinzufügen
        var qty = Math.max(1, parseInt(snap.qty||'1',10));
        if(itemEl) await removeCartItem(itemEl);
        await addByKey(key, qty);
        // Kurze Pause, damit Webflow den Eintrag stabil anlegt
        await new Promise(function(res){ setTimeout(res, 120); });
      }
      // Cart sichtbar lassen, aber niemals öffnen
      try{ var w = document.querySelector('.w-commerce-commercecartcontainerwrapper'); if(w){ var csf = window.getComputedStyle(w); if(csf.display === 'none'){ /* nichts */ } else { w.style.display=''; } } if(document.body && document.body.classList){ document.body.classList.remove('w-commerce-commercecartopen','wf-commerce-cart-open'); } }catch(_){ }
    }catch(e){
      console.warn('Cart-Kompatibilitätsprüfung fehlgeschlagen:', e);
    }finally{
      compatRunning = false;
      lastCompatRun = Date.now();
    }
  }

  function setupObservers(){
    try{
      // Cart-Änderungen beobachten
      var list = getCartList();
      if(list){
        var mo = new MutationObserver(function(){ scheduleCartCompatibilityCheck(500); });
        try{ mo.observe(list, {childList:true, subtree:true}); }catch(_){ }
      }
      // Globale DOM-Änderungen (Forms etc.)
      var bodyMo = new MutationObserver(function(){ scheduleCartCompatibilityCheck(800); });
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
      // Beim manuellen Trigger: Cart nicht öffnen → nur still austauschen
      try{ if (window.solarGrid && typeof window.solarGrid.hideCartContainer==='function') window.solarGrid.hideCartContainer(); }catch(_){ }
      scheduleCartCompatibilityCheck(delayMs);
    }
  };
})();
