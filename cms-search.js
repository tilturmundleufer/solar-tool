// cms-search.js - Eigenständige CMS-Suche ohne Kundentyp-Abhängigkeiten
// Funktioniert komplett unabhängig von customer-type-popup.js

(function(){
  var cmsSearchInitialized = false;
  
  // === Hilfsfunktionen ===
  function normalizeSearchText(text){
    try{
      return (text||'').toString().toLowerCase().replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
    }catch(_){ return ''; }
  }
  
  function getListRootForInput(input){
    try{
      // Suche nach dem search-cms-wrapper in der Nähe des Inputs
      var p = input;
      for(var i=0;i<6 && p; i++){
        var r = p.querySelector && p.querySelector('.search-cms-wrapper-2, .search-cms-wrapper');
        if(r) return r;
        p = p.parentElement;
      }
      // Fallback: Suche global
      var any = document.querySelector('.search-cms-wrapper-2, .search-cms-wrapper');
      if(any) return any;
    }catch(_){ }
    return null;
  }
  
  // === Hauptfunktion: Such-Input verarbeiten ===
  function handleSearchInput(input){
    try{
      var attr = (input.getAttribute('data-input')||'').toString();
      var m = attr.match(/^search-(.+)$/);
      if(!m) return;
      
      var key = m[1];
      var root = getListRootForInput(input) || document;
      var term = normalizeSearchText((input.value||''));
      
      // Alle Such-Items für diesen Key finden
      var itemsAll = Array.prototype.slice.call(root.querySelectorAll('[data-search="cms-item-'+key+'"], [data-search="cms_item_'+key+'"], .search-cms-item-2, .search-cms-item'));
      
      console.log('[CMS-SEARCH] handle input', {key, term, items: itemsAll.length});
      
      // Debug: Zeige alle gefundenen Items
      if(itemsAll.length > 0){
        console.log('[CMS-SEARCH] Found items:', itemsAll.map(function(item){
          var nameEl = item.querySelector('.search-name');
          return nameEl ? nameEl.textContent : 'No name element';
        }));
      }
      
      // Sonderfall: leerer Begriff → nichts anzeigen
      if(term === ''){
        for(var s=0;s<itemsAll.length;s++){ 
          itemsAll[s].style.display = 'none'; 
        }
        var nr0 = root.querySelector('[data-div="noResult-'+key+'"]');
        if(nr0) nr0.style.display='none';
        
        // URL-Parameter entfernen
        var pf0 = ((input.getAttribute('data-url')||'').toString().toLowerCase() === 'true');
        if(pf0){ 
          try{ 
            var u0=new URL(window.location.href); 
            u0.searchParams.delete('search-'+key); 
            window.history.pushState({},'',u0);
          }catch(_){}
        }
        
        // Wrapper verstecken
        try{ 
          var wrap0 = root.querySelector('.search-cms-wrapper-2, .search-cms-wrapper, [role="list"]'); 
          if(wrap0) wrap0.style.display='none';
          var list0 = root.querySelector('[role="list"], .search-cms-list, .w-dyn-items'); 
          if(list0) list0.style.display='none';
        }catch(_){ }
        return;
      }
      
      // Vereinfachte Suche: Direkt über Produktnamen
      var anyVisible = 0;
      
      for(var i=0;i<itemsAll.length;i++){
        var item = itemsAll[i];
        
        // Suche über .search-name Element (Produktname)
        var nameEl = item.querySelector('.search-name');
        var nameText = nameEl ? normalizeSearchText(nameEl.textContent||'') : '';
        
        // Fallback: Suche über gesamten Item-Text
        if(!nameText){
          nameText = normalizeSearchText(item.textContent||'');
        }
        
        var match = nameText.indexOf(term) !== -1;
        
        if(match){
          item.style.display = '';
          anyVisible++;
          console.log('[CMS-SEARCH] Match found:', nameText, 'for term:', term);
        }else{
          item.style.display = 'none';
        }
      }
      
      // No-Results anzeigen/verstecken
      var total = itemsAll.length, hidden = 0;
      for(var j=0;j<itemsAll.length;j++){ 
        if(getComputedStyle(itemsAll[j]).display === 'none') hidden++; 
      }
      var noRes = root.querySelector('[data-div="noResult-'+key+'"], [data-div="noResult_'+key+'"]');
      if(noRes){ 
        noRes.style.display = (total>0 && hidden===total) ? '' : 'none'; 
      }
      
      // Wrapper-Sichtbarkeit steuern
      try{
        var wrapper = root.querySelector('.search-cms-wrapper-2, .search-cms-wrapper, [role="list"]');
        if(wrapper){
          if(anyVisible>0 && term){ 
            wrapper.style.display = 'block'; 
          }else { 
            wrapper.style.display = 'none'; 
          }
        }
        var listEl = root.querySelector('[role="list"], .search-cms-list, .w-dyn-items');
        if(listEl){
          if(anyVisible>0 && term){ 
            listEl.style.display = 'block'; 
          }else { 
            listEl.style.display = 'none'; 
          }
        }
      }catch(_){ }
      
      // URL-Parameter setzen
      var paramFlag = ((input.getAttribute('data-url')||'').toString().toLowerCase() === 'true');
      if(paramFlag){
        try{
          var url = new URL(window.location.href);
          url.searchParams.set('search-'+key, input.value);
          window.history.pushState({}, '', url);
        }catch(_){ }
      }
    }catch(e){ 
      console.error('[CMS-SEARCH] Error:', e);
    }
  }
  
  // === Event-Listener Setup ===
  function initCmsSearch(){
    try{
      if(cmsSearchInitialized) return;
      cmsSearchInitialized = true;
      
      console.log('[CMS-SEARCH] init binding events');
      
      // Input-Events
      document.addEventListener('input', function(e){
        var t = e.target;
        try{ 
          if(!t || !t.matches || !t.matches('[data-input^="search-"]')) return; 
        }catch(_){ return; }
        console.log('[CMS-SEARCH] input event fired');
        handleSearchInput(t);
      }, true);
      
      document.addEventListener('keyup', function(e){
        var t = e.target;
        try{ 
          if(!t || !t.matches || !t.matches('[data-input^="search-"]')) return; 
        }catch(_){ return; }
        console.log('[CMS-SEARCH] keyup event fired');
        handleSearchInput(t);
      }, true);
      
      // Focus-Events: Ergebnisse zeigen/verbergen
      document.addEventListener('focusin', function(e){
        var t = e.target; 
        try{ 
          if(!t || !t.matches || !t.matches('[data-input^="search-"]')) return; 
        }catch(_){ return; }
        
        var attr = (t.getAttribute('data-input')||'').toString();
        var m = attr.match(/^search-(.+)$/);
        if(!m) return;
        
        var key = m[1];
        var root = getListRootForInput(t) || document;
        var items = root.querySelectorAll('[data-search="cms-item-'+key+'"], [data-search="cms_item_'+key+'"]');
        var term = normalizeSearchText((t.value||''));
        
        if(term){
          for(var i=0;i<items.length;i++){
            var item = items[i];
            var nameEl = item.querySelector('.search-name');
            var nameText = nameEl ? normalizeSearchText(nameEl.textContent||'') : normalizeSearchText(item.textContent||'');
            var match = nameText.indexOf(term) !== -1;
            item.style.display = match ? '' : 'none';
          }
          var wrapper = root.querySelector('.search-cms-wrapper-2, .search-cms-wrapper, [role="list"]');
          if(wrapper) wrapper.style.display = 'block';
        }
      }, true);
      
      document.addEventListener('focusout', function(e){
        var t = e.target; 
        try{ 
          if(!t || !t.matches || !t.matches('[data-input^="search-"]')) return; 
        }catch(_){ return; }
        
        var attr = (t.getAttribute('data-input')||'').toString();
        var m = attr.match(/^search-(.+)$/);
        if(!m) return;
        
        var key = m[1];
        var root = getListRootForInput(t) || document;
        var wrapper = root.querySelector('.search-cms-wrapper-2, .search-cms-wrapper, [role="list"]');
        if(wrapper) wrapper.style.display = 'none';
      }, true);
      
      // Initialzustand + URL-Vorbelegung
      var inputs = document.querySelectorAll('[data-input^="search-"]');
      for(var i=0;i<inputs.length;i++){
        var inp = inputs[i];
        var attr = inp.getAttribute('data-input')||'';
        var m = attr.match(/^search-(.+)$/); 
        if(!m) continue; 
        
        var key = m[1];
        var root = getListRootForInput(inp) || document;
        var noRes = root.querySelector('[data-div="noResult-'+key+'"], [data-div="noResult_'+key+'"]'); 
        if(noRes) noRes.style.display='none';
        
        // URL-Parameter vorbelegen
        try{
          var paramFlag = ((inp.getAttribute('data-url')||'').toString().toLowerCase() === 'true');
          if(paramFlag){
            var sp = new URLSearchParams(window.location.search);
            var preset = sp.get('search-'+key);
            if(preset){ 
              inp.value = preset; 
              handleSearchInput(inp); 
            }
          }
        }catch(_){ }
        
        // Initial einmal triggern für Logs
        try{ handleSearchInput(inp); }catch(_){ }
      }
    }catch(_){ }
  }
  
  // === Globale API ===
  window.CmsSearch = {
    init: initCmsSearch,
    handleInput: handleSearchInput,
    normalizeText: normalizeSearchText
  };
  
  // === Auto-Initialisierung ===
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initCmsSearch);
  }else{ 
    initCmsSearch(); 
  }
})();
