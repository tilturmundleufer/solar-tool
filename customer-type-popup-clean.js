// customer-type-popup.js - Kundentyp-Management und UI-Updates
// CMS-Suche wurde nach script.js migriert

(function(){
  // === Kundentyp-Management ===
  function updateCustomerTypeVisibility(){
    try{
      const isPrivateCustomer = isPrivate();
      const containers = document.querySelectorAll('[data-customer-type="privat"], [data-customer-type="gewerbe"], .customer-type-container');
      containers.forEach(container => {
        if (container) {
          container.classList.toggle('is-private', isPrivateCustomer);
          container.classList.toggle('is-business', !isPrivateCustomer);
        }
      });
    }catch(e){}
  }

  // CMS-Suche entfernt - migriert nach script.js

  // === Kundentyp-Funktionen ===
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
    }catch(_){ return null; }
  }

  function storeCustomerType(type){
    try{
      const data = { type: type, expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) };
      localStorage.setItem('solarTool_customerType', JSON.stringify(data));
    }catch(_){ }
  }

  function isPrivate(){ return getStoredCustomerType() === 'private'; }
  function isBusiness(){ return getStoredCustomerType() === 'business'; }

  function setCustomerType(type){
    try{
      storeCustomerType(type);
      updateCustomerTypeVisibility();
      setActiveButtons();
      
      // Solar-Grid aktualisieren
      if(window.solarGrid){
        window.solarGrid.updateCurrentTotalPrice && window.solarGrid.updateCurrentTotalPrice();
        window.solarGrid.updateOverviewTotalPrice && window.solarGrid.updateOverviewTotalPrice();
        (window.solarGrid.ensureWebflowFormsMapped || window.solarGrid.generateHiddenCartForms)?.call(window.solarGrid);
      }
    }catch(e){}
    // CartCompatibility-Check entfernt - nicht mehr benötigt mit Foxy.io
  }

  function setActiveButtons(){
    try{
      const isPrivateCustomer = isPrivate();
      const privateBtns = document.querySelectorAll('[data-customer-type="privat"], .customer-type-private');
      const businessBtns = document.querySelectorAll('[data-customer-type="gewerbe"], .customer-type-business');
      
      privateBtns.forEach(btn => {
        if(btn) btn.classList.toggle('active', isPrivateCustomer);
      });
      businessBtns.forEach(btn => {
        if(btn) btn.classList.toggle('active', !isPrivateCustomer);
      });
    }catch(_){ }
  }

  // === Event-Listener für Kundentyp-Buttons ===
  function setupCustomerTypeButtons(){
    try{
      document.addEventListener('click', function(e){
        const target = e.target.closest('[data-customer-type]');
        if(!target) return;
        
        const type = target.getAttribute('data-customer-type');
        if(type === 'privat' || type === 'private'){
          setCustomerType('private');
        }else if(type === 'gewerbe' || type === 'business'){
          setCustomerType('business');
        }
      });
    }catch(_){ }
  }

  // === Domain-Übertragung Kundentyp (unterkonstruktion.de ↔ foxycart.com) ===
  (function(){
    function getType(){
      try{
        const raw = localStorage.getItem('solarTool_customerType');
        if(!raw) return null;
        const data = JSON.parse(raw);
        if(!data || !data.type) return null;
        if(typeof data.expiresAt === 'number' && Date.now() > data.expiresAt){
          localStorage.removeItem('solarTool_customerType');
          return null;
        }
        return data.type;
      }catch(_){ return null; }
    }
    function setType(type){
      try{
        const data = { type: type, expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) };
        localStorage.setItem('solarTool_customerType', JSON.stringify(data));
      }catch(_){ }
    }
    function syncFromUrl(){
      try{
        const url = new URL(window.location.href);
        const type = url.searchParams.get('customer-type');
        if(type === 'private' || type === 'business'){
          setType(type);
          updateCustomerTypeVisibility();
          setActiveButtons();
        }
      }catch(_){ }
    }
    function syncToUrl(){
      try{
        const type = getType();
        if(!type) return;
        const url = new URL(window.location.href);
        if(url.searchParams.get('customer-type') !== type){
          url.searchParams.set('customer-type', type);
          window.history.replaceState({}, '', url);
        }
      }catch(_){ }
    }
    
    // Initial sync
    syncFromUrl();
    syncToUrl();
    
    // Listen for changes
    window.addEventListener('storage', function(e){
      if(e.key === 'solarTool_customerType'){
        updateCustomerTypeVisibility();
        setActiveButtons();
        syncToUrl();
      }
    });
    
    // Listen for customer type changes
    const originalSetCustomerType = window.setCustomerType;
    window.setCustomerType = function(type){
      if(originalSetCustomerType) originalSetCustomerType(type);
      setType(type);
      syncToUrl();
    };
  })();

  // === Foxy Forms Auto-Fill ===
  (function(){
    function fillFoxyForms(){
      try{
        const customerType = getStoredCustomerType();
        if(!customerType) return;
        
        const forms = document.querySelectorAll('form[action*="foxycart.com"]');
        forms.forEach(form => {
          const customerTypeInput = form.querySelector('input[name="customer_type"], input[name="customer-type"]');
          if(customerTypeInput){
            customerTypeInput.value = customerType;
          }
        });
      }catch(_){ }
    }
    
    // Fill on load
    fillFoxyForms();
    
    // Fill on customer type change
    window.addEventListener('storage', function(e){
      if(e.key === 'solarTool_customerType'){
        fillFoxyForms();
      }
    });
  })();

  // === Initialisierung ===
  function init(){
    try{
      // Kundentyp-Buttons einrichten
      setupCustomerTypeButtons();
      
      // Initial UI Zustand
      updateCustomerTypeVisibility();
      setActiveButtons();
      // CMS-Suche entfernt - migriert nach script.js

      // Checkout-Übersetzungen entfernt

      // CartCompatibility-Init entfernt - nicht mehr benötigt mit Foxy.io
    }catch(_){ }
  }
  
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{ init(); }
})();
