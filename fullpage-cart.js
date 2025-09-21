(function(){
  // Utility: format euro
  function fmtEuro(n){ try{ return (n||0).toFixed(2).replace('.', ',') + ' €'; }catch(_){ return '0,00 €'; } }
  function isBusiness(){ try{ return (localStorage.getItem('solarTool_customerType') && JSON.parse(localStorage.getItem('solarTool_customerType')).type) === 'business'; }catch(_){ return false; } }
  function isPrivate(){ try{ return !isBusiness(); }catch(_){ return true; } }

  // Resolve price type via maps from popup if available
  var idToKey = { productIdToKey:{}, variantIdToKey:{} };
  function buildReverseMaps(){
    try{
      var NET = (window.PRODUCT_MAP)|| (window.POPUP_PRODUCT_MAP_NETTO) || {};
      var GROSS = (window.PRODUCT_MAP_BRUTTO)|| (window.POPUP_PRODUCT_MAP_BRUTTO) || {};
      [NET, GROSS].forEach(function(M){
        Object.keys(M||{}).forEach(function(k){
          var v = M[k]; if(!v) return;
          if(v.productId) idToKey.productIdToKey[v.productId] = k;
          if(v.variantId) idToKey.variantIdToKey[v.variantId] = k;
        });
      });
    }catch(_){ }
  }
  function getKeyFromIds(pid, vid){ return (vid && idToKey.variantIdToKey[vid]) || (pid && idToKey.productIdToKey[pid]) || null; }

  // Webflow cart accessors
  function getCartList(){ return document.querySelector('.w-commerce-commercecartlist') || document.querySelector('.w-commerce-commercecartcontainerwrapper'); }
  function getCartItems(){
    var list = getCartList();
    if(!list) return [];
    var nodes = Array.from(list.querySelectorAll('.w-commerce-commercecartitem, [data-node-type="commerce-cart-item"]'));
    return nodes.map(function(el){
      var pid = el.getAttribute('data-commerce-product-id') || (el.querySelector('[data-commerce-product-id]') && el.querySelector('[data-commerce-product-id]').getAttribute('data-commerce-product-id')) || '';
      var vid = el.getAttribute('data-commerce-sku-id') || (el.querySelector('[data-commerce-sku-id]') && el.querySelector('[data-commerce-sku-id]').getAttribute('data-commerce-sku-id')) || '';
      var qtyEl = el.querySelector('input[type="number"], input[data-node-type*="quantity"], .w-commerce-commercecartquantity input, input[name*="quantity" i]');
      var qty = 1; try{ var v = parseInt(qtyEl && qtyEl.value, 10); qty = (isFinite(v)&&v>0)?v:1; }catch(_){ }
      var name = ''; var nameSel = ['.w-commerce-commercecartproductname','[data-node-type*="product" i]','.text-block-18','.text-block-5','h1,h2,h3,h4,div,span'];
      for (var i=0;i<nameSel.length;i++){ var ne = el.querySelector(nameSel[i]); if(ne && (ne.textContent||'').trim()){ name = (ne.textContent||'').trim(); break; } }
      var img = ''; var imgel = el.querySelector('img'); if(imgel){ img = imgel.getAttribute('src') || imgel.getAttribute('data-src') || ''; }
      var key = getKeyFromIds(pid, vid);
      return { el, productId: pid, variantId: vid, quantity: qty, name, img, key };
    });
  }

  // Actions against Webflow forms (self-contained, no script.js dep)
  function findAddFormByIds(pid, vid){
    var f = document.querySelector('form[data-node-type="commerce-add-to-cart-form"][data-commerce-product-id="'+pid+'"]') ||
            document.querySelector('form[data-node-type="commerce-add-to-cart-form"][data-commerce-sku-id="'+vid+'"]');
    return f;
  }
  function waitAck(timeoutMs){ return new Promise(function(res){ var settled=false; var list=getCartList(); var to=setTimeout(function(){ if(!settled){ settled=true; res(); } }, timeoutMs||1500); if(!list) return;
    var mo=new MutationObserver(function(){ if(!settled){ settled=true; clearTimeout(to); try{ mo.disconnect(); }catch(_){ } res(); } });
    try{ mo.observe(list,{childList:true,subtree:true}); }catch(_){ }
  }); }
  function clickAddForm(form, quantity){
    try{ var q=form.querySelector('input[name="commerce-add-to-cart-quantity-input"]'); if(q){ q.value = quantity; } }catch(_){ }
    try{ form.querySelectorAll('select[required]').forEach(function(sel){ if(!sel.value){ var first=sel.querySelector('option[value]:not([value=""])'); if(first) sel.value = first.value; } }); }catch(_){ }
    var btn = form.querySelector('input[data-node-type="commerce-add-to-cart-button"], [data-wf-cart-action="add-item"], [data-wf-cart-action*="add" i], input[type="submit"], button[type="submit"]');
    if(btn){ btn.click(); }
  }
  async function setItemQuantityByDelta(item, delta){
    // Strategy: If delta>0, re-add product delta times; if delta<0, click remove or reduce input.
    if(delta===0) return;
    if(delta>0){
      var form = findAddFormByIds(item.productId, item.variantId);
      if(!form) return; // no-op
      var ack = waitAck(1500);
      clickAddForm(form, delta); // add delta pieces
      await ack;
      return;
    }
    // delta<0 → try to reduce via input where possible, else remove and re-add
    var qtyEl = item.el.querySelector('input[type="number"], input[data-node-type*="quantity"], .w-commerce-commercecartquantity input, input[name*="quantity" i]');
    if(qtyEl){
      var current = parseInt(qtyEl.value,10) || 1;
      var target = Math.max(0, current + delta);
      qtyEl.value = target;
      // Trigger change
      try{ qtyEl.dispatchEvent(new Event('change', { bubbles:true })); }catch(_){ }
      await waitAck(1500);
      return;
    }
    // fallback: click remove and re-add target remainder
    var removeBtn = findRemoveButton(item.el);
    if(removeBtn){ removeBtn.click(); await waitAck(1500); if(item.quantity + delta > 0){ var form2=findAddFormByIds(item.productId, item.variantId); if(form2){ var ack2=waitAck(1500); clickAddForm(form2, item.quantity+delta); await ack2; } } }
  }
  function findRemoveButton(itemEl){
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
    for(var i=0;i<sels.length;i++){ var cand=itemEl.querySelector(sels[i]); if(cand) return cand; }
    try{
      var textCandidates = Array.from(itemEl.querySelectorAll('a,button,div,span')).filter(function(n){
        var t = (n.textContent||'').trim().toLowerCase();
        return t === 'entfernen' || t === 'remove' || t.indexOf('entfernen')>=0 || t.indexOf('remove')>=0;
      });
      if(textCandidates.length) return textCandidates[0];
    }catch(_){ }
    return null;
  }

  function computeSubtotalNet(items){
    // We only display net subtotal. Try to read per-item totals; if not feasible, show placeholder.
    var sum = 0; var found = false;
    items.forEach(function(it){
      var priceNode = it.el.querySelector('.w-commerce-commercecartitemprice, [data-node-type*="price" i]');
      if(priceNode){
        var raw = (priceNode.textContent||'').toLowerCase();
        // Strip currency and thousands, try parse in EU style
        var num = parseFloat(raw.replace(/[^0-9,\.]/g,'').replace('.', '').replace(',', '.'));
        if(isFinite(num)){ sum += num; found = true; }
      }
    });
    return { subtotal: sum, reliable: found };
  }

  function render(){
    // Summary + Items rendern + Proxy-Slots auffüllen
    var items = getCartItems();
    var root = document.getElementById('fp-cart-items');
    if(root){
      root.innerHTML = '';
      if(!items.length){ root.innerHTML = '<div class="fp-empty">Ihr Warenkorb ist leer.</div>'; }
      items.forEach(function(it){
        var row = document.createElement('div'); row.className='fp-cart-item';
        var img = document.createElement('img'); img.src=it.img||''; img.alt=it.name||'';
        var info=document.createElement('div');
        var title=document.createElement('div'); title.className='title'; title.textContent=it.name||'Produkt';
        var meta=document.createElement('div'); meta.className='meta'; meta.textContent=it.key || it.variantId || it.productId || '';
        info.appendChild(title); info.appendChild(meta);
        var right=document.createElement('div'); right.style.display='flex'; right.style.alignItems='center'; right.style.gap='8px';
        var qty=document.createElement('div'); qty.className='qty';
        var minus=document.createElement('button'); minus.className='btn outline'; minus.style.width='36px'; minus.textContent='−';
        var input=document.createElement('input'); input.type='number'; input.min='0'; input.value=String(it.quantity);
        var plus=document.createElement('button'); plus.className='btn outline'; plus.style.width='36px'; plus.textContent='+';
        var remove=document.createElement('button'); remove.className='btn outline'; remove.textContent='Entfernen';
        qty.appendChild(minus); qty.appendChild(input); qty.appendChild(plus);
        right.appendChild(qty); right.appendChild(remove);
        row.appendChild(img); row.appendChild(info); row.appendChild(right);
        minus.addEventListener('click', async function(){ var c=parseInt(input.value,10)||0; if(c>0){ input.value=String(c-1); await setItemQuantityByDelta(it,-1); }});
        plus.addEventListener('click', async function(){ input.value=String((parseInt(input.value,10)||0)+1); await setItemQuantityByDelta(it, +1); });
        input.addEventListener('change', async function(){ var v=parseInt(input.value,10); if(!isFinite(v)||v<0){ input.value=String(it.quantity); return; } var d=v-it.quantity; if(d!==0){ await setItemQuantityByDelta(it,d); }});
        remove.addEventListener('click', async function(){ var btn=findRemoveButton(it.el); if(btn){ btn.click(); await waitAck(1500); }});
        root.appendChild(row);
      });
    }
    var st = computeSubtotalNet(items); updateSummary(st.subtotal); fillProxySlots();
  }

  function updateSummary(subtotal){
    var net = subtotal||0;
    // Falls Firmenkunde und Preise im Cart brutto sind, Netto approximieren (÷1.19)
    try{ if(isBusiness()){ net = net/1.19; } }catch(_){ }
    try{ document.getElementById('fp-subtotal').textContent = fmtEuro(net); }catch(_){ }
    var note = document.getElementById('fp-summary-note'); if(!note) return;
    if(isPrivate()){
      note.textContent = 'Bei den angebeben Preisen handelt es sich um Nettobeträge. Privatkunden profitieren von 0% MwSt Gemäß §12 Abs. 3 UstG';
    }else{
      note.textContent = 'Firmenkunden wird die MwSt im Bestellprozess berechnet.';
    }
  }

  function init(){
    buildReverseMaps();
    // Initial notice in header
    var notice = document.getElementById('fp-cart-notice');
    if(notice){ notice.textContent = 'Preise netto angezeigt; Kundentyp-Steuerung aktiv.'; }
    // Buttons
    var clearAll = document.getElementById('fp-clear-all');
    if(clearAll){ clearAll.addEventListener('click', async function(){
      // Entfernen robust: solange Items existieren, entfernen und auf Ack warten
      var guard=0;
      while(true){
        var items = getCartItems();
        if(!items.length || guard++>50) break;
        var btn = findRemoveButton(items[0].el);
        if(btn){ btn.click(); await waitAck(1500); }
        else { break; }
      }
    }); }
    var checkout = document.getElementById('fp-checkout');
    if(checkout){ checkout.addEventListener('click', function(){ clickNativeCheckout(); }); }
    // Mutations → rerender
    var list = getCartList();
    if(list){ try{ var mo = new MutationObserver(function(){ render(); }); mo.observe(list,{childList:true,subtree:true}); }catch(_){ } }
    // Customer type changes from popup
    try{ if(window.CartCompatibility && typeof window.CartCompatibility.schedule==='function'){ window.CartCompatibility.schedule(200); } }catch(_){ }
    render();
  }

  function fillProxySlots(){
    try{
      var checkoutBtn = document.querySelector('.w-commerce-commercecartcheckoutbutton, [data-node-type="cart-checkout-button"], [data-node-type*="checkout" i]');
      var checkoutSlot = document.getElementById('fp-checkout-slot');
      if(checkoutBtn && checkoutSlot && checkoutBtn !== checkoutSlot && !checkoutSlot.contains(checkoutBtn)){
        // Klonen statt verschieben (um Webflow Event-Bindings zu behalten, vermeiden wir Parent-Containment)
        var clone = checkoutBtn.cloneNode(true);
        clone.addEventListener('click', function(e){ e.preventDefault(); clickNativeCheckout(); });
        checkoutSlot.innerHTML = ''; checkoutSlot.appendChild(clone);
      }
    }catch(_){ }
    try{
      var quick = document.querySelector('[data-node-type="commerce-cart-quick-checkout-button"], .w-commerce-commercecartquickcheckoutbutton');
      var quickSlot = document.getElementById('fp-quick-slot');
      if(quick && quickSlot && quick !== quickSlot && !quickSlot.contains(quick)){
        var q = quick.cloneNode(true);
        q.addEventListener('click', function(e){ e.preventDefault(); try{ quick.click(); }catch(_){ } });
        quickSlot.innerHTML=''; quickSlot.appendChild(q);
      }
    }catch(_){ }
    try{
      var paypalContainer = document.querySelector('[data-wf-paypal-button], [data-node-type="commerce-cart-quick-checkout-actions"] + div[id^="zoid-paypal-buttons"], [data-node-type="commerce-cart-quick-checkout-actions"] .paypal-buttons');
      var paypalSlot = document.getElementById('fp-paypal-slot');
      if(paypalContainer && paypalSlot){
        // Statt verschieben: Einen transparenteren Proxy-Button einfügen, der das Original klickt.
        paypalSlot.innerHTML='';
        var payBtn = document.createElement('button'); payBtn.className='btn primary'; payBtn.textContent='Pay with PayPal';
        payBtn.addEventListener('click', function(e){ e.preventDefault(); try{ var iframe=document.querySelector('.paypal-buttons iframe.component-frame'); if(iframe){ iframe.contentWindow.postMessage({event:'click'}, '*'); } else { paypalContainer.querySelector('iframe,button,a')?.click(); } }catch(_){ } });
        paypalSlot.appendChild(payBtn);
      }
    }catch(_){ }
  }

  function clickNativeCheckout(){
    var sels = ['[data-node-type*="checkout" i]', '.w-commerce-commercecartcheckoutbutton', 'a[href*="checkout" i]'];
    for(var i=0;i<sels.length;i++){ var b=document.querySelector(sels[i]); if(b){ try{ b.click(); return; }catch(_){ } } }
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();


