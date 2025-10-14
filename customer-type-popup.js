(function(){
  function normalizeSearchText(str){
    try{
      return (str||'').toString().toLowerCase().replace(/\s+/g,' ').trim();
    }catch(_){ return ''; }
  }
// Entfernt: Country Tax Text-Bearbeitung (auf Wunsch deaktiviert)
  function isPrivate(){
    return getStoredCustomerType() === 'private';
  }
  function isBusiness(){
    return getStoredCustomerType() === 'business';
  }
  function updateCustomerTypeVisibility(){
    // Deaktiviert: CMS-Collections werden nicht mehr kundentyp-basiert ein-/ausgeblendet
    try{ /* no-op */ }catch(_){ }
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

  // Bevorzugt den List-Container in der Nähe des Inputs
  function getListRootForInput(input){
    try{
      var p = input;
      for(var i=0;i<6 && p; i++){
        var r = p.querySelector && p.querySelector('.search-cms-wrapper');
        if(r) return r;
        p = p.parentElement;
      }
      var any = document.querySelector('.search-cms-wrapper');
      if(any) return any;
    }catch(_){ }
    return null;
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
    // Deaktiviert: keine kundentyp-basierte Filterung mehr in der CMS-Suche
    try{ return true; }catch(_){ return true; }
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
      var segmentRoot = getSegmentRootForElement(input) || getVisibleSegmentRoot() || document;
      // Liste an der tatsächlichen Ergebnis-Box ausrichten, nicht am Kundensegment
      var root = getListRootForInput(input) || segmentRoot || document;
      var term = normalizeSearchText((input.value||''));
      // Innerhalb des Listen-Containers für den aktuellen Key suchen
      var scope = root || document;
      var itemsAll = Array.prototype.slice.call(scope.querySelectorAll('[data-search="cms-item-'+key+'"], [data-search="cms_item_'+key+'"], .search-cms-item, .w-dyn-item'));
      var nodesForKey = Array.prototype.slice.call(scope.querySelectorAll('[data-text="search-'+key+'"], [data-text="search_'+key+'"], [data-text*="search"]'));
      try{ console.warn('[CMS-SEARCH] handle input', {type: isBusiness()?'business':'private', key, term, items: itemsAll.length, nodesForKey: nodesForKey.length}); }catch(_){ }

      // Sonderfall: leerer Begriff → nichts anzeigen
      if(term === ''){
        for(var s=0;s<itemsAll.length;s++){ itemsAll[s].style.display = 'none'; }
        var nr0 = root.querySelector('[data-div="noResult-'+key+'"]');
        if(nr0) nr0.style.display='none';
        var pf0 = ((input.getAttribute('data-url')||'').toString().toLowerCase() === 'true');
        if(pf0){ try{ var u0=new URL(window.location.href); u0.searchParams.delete('search-'+key); window.history.pushState({},'',u0);}catch(_){}}
        try{ 
          var wrap0 = root.querySelector('.search-cms-wrapper, [role="list"]'); if(wrap0) wrap0.style.display='none';
          var list0 = root.querySelector('[role="list"], .search-cms-list, .w-dyn-items'); if(list0) list0.style.display='none';
        }catch(_){ }
        return;
      }

      // Suche primär über die Knoten für den Key; mappe zu Items per closest
      var considered = new WeakSet();
      var anyVisible = 0;
      if(nodesForKey.length){
        for(var i=0;i<nodesForKey.length;i++){
          var tn = nodesForKey[i];
          var it = tn.closest('[data-search^="cms-item-"], [data-search^="cms_item_"]');
          if(!it) continue;
          considered.add(it);
          var txt = normalizeSearchText(tn.textContent||'');
          if(!txt){ txt = normalizeSearchText(it.textContent||''); }
          var match = txt.indexOf(term) !== -1 && itemMatchesCurrentCustomerType(it);
          it.style.display = match ? '' : 'none';
          if(match){ try{ if(getComputedStyle(it).display === 'none'){ it.style.display = 'block'; } }catch(_){ } anyVisible++; }
        }
        // Alle übrigen Items verstecken
        for(var j=0;j<itemsAll.length;j++){
          var it2 = itemsAll[j]; if(considered.has(it2)) continue; it2.style.display = 'none';
        }
      }else{
        // Fallback: keine passenden data-text-Knoten gefunden → gesamte Item-Texte durchsuchen
        for(var k=0;k<itemsAll.length;k++){
          var it3 = itemsAll[k];
          var txt3 = normalizeSearchText(it3.textContent||'');
          var match3 = txt3.indexOf(term) !== -1 && itemMatchesCurrentCustomerType(it3);
          it3.style.display = match3 ? '' : 'none';
          if(match3){ try{ if(getComputedStyle(it3).display === 'none'){ it3.style.display = 'block'; } }catch(_){ } anyVisible++; }
        }
      }

      var total = itemsAll.length, hidden = 0;
      for(var j2=0;j2<itemsAll.length;j2++){ if(getComputedStyle(itemsAll[j2]).display === 'none') hidden++; }
      var noRes = (root.querySelector('[data-div="noResult-'+key+'"], [data-div="noResult_'+key+'"]') || segmentRoot.querySelector?.('[data-div="noResult-'+key+'"], [data-div="noResult_'+key+'"]'));
      if(noRes){ noRes.style.display = (total>0 && hidden===total) ? '' : 'none'; }
      // Ergebnisse-Wrapper Sichtbarkeit gemäß Zustand steuern
      try{
        var wrapper = (root.classList && root.classList.contains('search-cms-wrapper')) ? root : (root.querySelector('.search-cms-wrapper, [role="list"]') || (itemsAll[0] && itemsAll[0].parentElement));
        if(wrapper){
          if(anyVisible>0 && term){ wrapper.style.display = 'block'; }
          else { wrapper.style.display = 'none'; }
        }
        var listEl = root.querySelector('[role="list"], .search-cms-list, .w-dyn-items');
        if(listEl){
          if(anyVisible>0 && term){ listEl.style.display = 'block'; }
          else { listEl.style.display = 'none'; }
        }
      }catch(_){ }
      var paramFlag = ((input.getAttribute('data-url')||'').toString().toLowerCase() === 'true');
      if(paramFlag){
        try{
          var url = new URL(window.location.href);
          url.searchParams.set('search-'+key, input.value);
          window.history.pushState({}, '', url);
        }catch(_){ }
      }
      // Kein asynchrones Refinement mehr – Anzeige bleibt stabil bis zur nächsten Eingabe oder Blur
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
      // Fokus/Blur: Ergebnisse zeigen/verbergen
      document.addEventListener('focusin', function(e){
        var t = e.target; try{ if(!t || !t.matches || !t.matches('[data-input^="search-"]')) return; }catch(_){ return; }
        try{ handleSearchInput(t); }catch(_){ }
      }, true);
      document.addEventListener('focusout', function(e){
        var t = e.target; try{ if(!t || !t.matches || !t.matches('[data-input^="search-"]')) return; }catch(_){ return; }
        try{
          var attr = (t.getAttribute('data-input')||'').toString();
          var m = attr.match(/^search-(.+)$/); if(!m) return; var key = m[1];
          var root = getListRootForInput(t) || getSegmentRootForElement(t) || getVisibleSegmentRoot() || document;
          var wrapper = root.querySelector('.search-cms-wrapper, [role="list"]');
          if(wrapper) wrapper.style.display = 'none';
        }catch(_){ }
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
        // Kein initiales Refinement erforderlich
      }
    }catch(_){ }
  }

  function refilterSegmentedCmsSearchForCurrentCustomerType(){
    // Deaktiviert: kein Re-Filter basierend auf Kundentyp notwendig
    try{ /* no-op */ }catch(_){ }
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
    // CartCompatibility-Check entfernt - nicht mehr benötigt mit Foxy.io
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

    // Checkout-Übersetzungen entfernt

    // CartCompatibility-Init entfernt - nicht mehr benötigt mit Foxy.io
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{ init(); }
})();



// CartCompatibility-Modul entfernt - nicht mehr benötigt mit Foxy.io

// === Domain-Übertragung Kundentyp (unterkonstruktion.de ↔ foxycart.com) ===
(function(){
  function getType(){
    try{
      var m = document.cookie.match(/(?:^|; )ukc_customer_type=([^;]+)/);
      if(m) return decodeURIComponent(m[1]);
      try{ var ls = window.localStorage.getItem('ukc_customer_type'); if(ls) return ls; }catch(_){ }
      // Fallback: auf vorhandenen Solar-Tool Speicher (48h JSON)
      try{
        var raw = window.localStorage.getItem('solarTool_customerType');
        if(raw){ var data = JSON.parse(raw); if(data && data.type){ return data.type === 'business' ? 'business' : 'private'; } }
      }catch(_){ }
      return 'private';
    }catch(_){ return 'private'; }
  }

  function setType(val){
    try{
      document.cookie = 'ukc_customer_type='+encodeURIComponent(val)+';path=/;max-age=31536000;SameSite=Lax';
      localStorage.setItem('ukc_customer_type', val);
    }catch(_){}
  }

  try{
    var host = (location && location.hostname) || '';
    // 1) Unterkonstruktion.de → Links zur Foxy-Domain anreichern
    if(host.endsWith('unterkonstruktion.de')){
      var type = getType();
      try{ setType(type); }catch(_){}
      document.addEventListener('click', function(e){
        var a = e && e.target && e.target.closest && e.target.closest('a[href]');
        if(!a) return;
        var href = a.getAttribute('href') || '';
        if(!href) return;
        var url = new URL(href, location.href);
        if(url.hostname && url.hostname.endsWith('foxycart.com')){
          url.searchParams.set('customer_type', type);
          a.setAttribute('href', url.toString());
        }
      }, true);
    }
    // 2) Foxy-Domain → Param in Domain-Cookie persistieren
    else if(host.endsWith('foxycart.com')){
      var urlType = null;
      try{ urlType = new URL(location.href).searchParams.get('customer_type'); }catch(_){ urlType = null; }
      if(urlType){ setType(urlType); }
    }
  }catch(_){ }
})();

// === Auto-Fill: customer_type Hidden-Feld in Foxy-Forms ===
(function(){
  function getType(){
    try{
      var m = document.cookie.match(/(?:^|; )ukc_customer_type=([^;]+)/);
      if(m) return decodeURIComponent(m[1]);
      var ls = localStorage.getItem('ukc_customer_type');
      if(ls) return ls;
      try{
        var raw = localStorage.getItem('solarTool_customerType');
        if(raw){ var d = JSON.parse(raw); if(d && d.type){ return d.type==='business'?'business':'private'; } }
      }catch(_){ }
    }catch(_){ }
    return 'private';
  }
  function setFormType(form){
    try{
      var input = form && form.querySelector && form.querySelector('input[name="customer_type"]');
      if(input){ input.value = getType(); }
    }catch(_){ }
  }
  function isFoxyForm(form){
    try{ var a = (form && form.getAttribute && form.getAttribute('action')) || ''; return /foxycart\.com\/cart/i.test(a||''); }catch(_){ return false; }
  }
  function init(){
    try{
      var forms = Array.prototype.slice.call(document.querySelectorAll('form'));
      for(var i=0;i<forms.length;i++){
        var f = forms[i];
        if(!isFoxyForm(f)) continue;
        setFormType(f);
        try{ f.addEventListener('submit', function(ev){ setFormType(ev.currentTarget||f); }, true); }catch(_){ }
      }
    }catch(_){ }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{ init(); }
})();
