(function(){
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
    const overlay = document.getElementById('customer-type-overlay');
    if(!overlay) return;
    const already = getStoredCustomerType();
    const btnPrivate = document.getElementById('stp-private');
    const btnBusiness = document.getElementById('stp-business');
    if(btnPrivate) btnPrivate.addEventListener('click', function(){
      storeCustomerType('private'); hide();
      if(window.setCustomerType){ window.setCustomerType('private'); }
      else { try{ location.reload(); }catch(e){} }
    });
    if(btnBusiness) btnBusiness.addEventListener('click', function(){
      storeCustomerType('business'); hide();
      if(window.setCustomerType){ window.setCustomerType('business'); }
      else { try{ location.reload(); }catch(e){} }
    });
    if(!already){ show(); }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{ init(); }
})();


