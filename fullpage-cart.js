(function(){
  // Utility: format euro
  function fmtEuro(n){ try{ return (n||0).toFixed(2).replace('.', ',') + ' €'; }catch(_){ return '0,00 €'; } }
  function isBusiness(){ try{ return (localStorage.getItem('solarTool_customerType') && JSON.parse(localStorage.getItem('solarTool_customerType')).type) === 'business'; }catch(_){ return false; } }
  function isPrivate(){ try{ return !isBusiness(); }catch(_){ return true; } }
  function flashNotice(message){
    try{
      var n = document.getElementById('fp-cart-notice');
      if(!n) return;
      var old = n.getAttribute('data-old') || n.textContent || '';
      if(!n.getAttribute('data-old')) n.setAttribute('data-old', old);
      n.textContent = message;
      setTimeout(function(){ try{ n.textContent = n.getAttribute('data-old') || old; }catch(_){ } }, 3000);
    }catch(_){ }
  }

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
      var pid = el.getAttribute('data-commerce-product-id') || '';
      var vid = el.getAttribute('data-commerce-sku-id') || '';
      if(!pid){ var pidEl = el.querySelector('[data-commerce-product-id]'); if(pidEl){ pid = pidEl.getAttribute('data-commerce-product-id') || ''; } }
      if(!vid){
        var vidEl = el.querySelector('[data-commerce-sku-id]');
        if(vidEl){ vid = vidEl.getAttribute('data-commerce-sku-id') || ''; }
        if(!vid){ var rem = el.querySelector('[data-wf-cart-action="remove-item"]'); if(rem){ vid = rem.getAttribute('data-commerce-sku-id') || ''; } }
      }
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

  // Ensure hidden native nodes can be clicked: temporarily reveal ancestors
  function withTemporarilyShown(targetNode, action){
    try{
      var modified = [];
      var n = targetNode;
      while(n && n !== document.documentElement){
        var cs=null; try{ cs = window.getComputedStyle(n); }catch(_){ }
        if(cs && (cs.display === 'none' || cs.visibility === 'hidden')){
          modified.push({ node:n, old:n.getAttribute('style') });
          n.style.display = 'block';
          n.style.visibility = 'hidden';
          n.style.opacity = '0';
          n.style.position = 'fixed';
          n.style.left = '-9999px';
          n.style.top = '-9999px';
          n.style.width = '1px';
          n.style.height = '1px';
        }
        n = n.parentElement;
      }
      try { action && action(); } finally {
        setTimeout(function(){
          modified.forEach(function(m){
            if(m.old == null){ m.node.removeAttribute('style'); }
            else { m.node.setAttribute('style', m.old); }
          });
        }, 50);
      }
    }catch(_){ try{ action && action(); }catch(__){} }
  }

  function triggerSyntheticClick(el){
    try{ el.dispatchEvent(new MouseEvent('pointerdown', { bubbles:true, cancelable:true })); }catch(_){ }
    try{ el.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true })); }catch(_){ }
    try{ el.dispatchEvent(new MouseEvent('mouseup', { bubbles:true, cancelable:true })); }catch(_){ }
    try{ el.dispatchEvent(new MouseEvent('pointerup', { bubbles:true, cancelable:true })); }catch(_){ }
    try{ el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true })); }catch(_){ try{ el.click(); }catch(__){} }
    try{ el.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', code:'Enter', bubbles:true, cancelable:true })); }catch(_){ }
    try{ el.dispatchEvent(new KeyboardEvent('keyup', { key:'Enter', code:'Enter', bubbles:true, cancelable:true })); }catch(_){ }
  }

  function findPayPalDomButton(funding){
    var q = [
      'div.paypal-button[data-funding-source="'+funding+'"]',
      'div[role="link"][data-funding-source="'+funding+'"]',
      '[data-wf-paypal-button] [data-funding-source="'+funding+'"]',
      '.paypal-buttons [data-funding-source="'+funding+'"]'
    ];
    for(var i=0;i<q.length;i++){ var el = document.querySelector(q[i]); if(el) return el; }
    return null;
  }

  function waitForFundingButton(funding, timeoutMs){
    return new Promise(function(resolve){
      var started = Date.now();
      (function poll(){
        try{
          var el = findPayPalDomButton(funding) || document.querySelector('div.paypal-button[role="link"][data-funding-source="'+funding+'"]');
          if(el) return resolve(el);
          var iframe=document.querySelector('[data-wf-paypal-button] iframe.component-frame, .paypal-buttons iframe.component-frame');
          if(iframe) return resolve(iframe);
        }catch(_){ }
        if(Date.now() - started >= (timeoutMs||8000)) return resolve(null);
        setTimeout(poll, 200);
      })();
    });
  }
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

  function parsePriceEU(str){
    var s=(str||'').toString().trim();
    s=s.replace(/\u00a0/g,' ').replace(/[^0-9,\.]/g,'');
    if(/,\d{2}$/.test(s)){ s=s.replace(/\./g,'').replace(',', '.'); }
    var n=parseFloat(s); return isFinite(n)?n:0;
  }
  function computeSubtotalNet(items){
    var totalNode = document.querySelector('.w-commerce-commercecartordervalue, [data-node-type*="ordervalue" i]');
    var total = 0;
    if(totalNode){ total = parsePriceEU(totalNode.textContent||''); }
    if(total>0) return { subtotal: total, reliable: true };
    var sum = 0; var found = false;
    items.forEach(function(it){
      var priceNode = it.el.querySelector('.w-commerce-commercecartitemprice, [data-node-type*="price" i], .text-block-5');
      if(priceNode){ var val=parsePriceEU(priceNode.textContent||''); if(val>0){ sum+=val; found=true; } }
    });
    return { subtotal: sum, reliable: found };
  }

  function render(){
    // Summary + Items rendern + Proxy-Slots auffüllen
    var items = getCartItems();
    var root = document.getElementById('fp-cart-items');
    if(root){
      root.innerHTML = '';
      if(!items.length){
        root.innerHTML = '<div class="fp-empty">Ihr Warenkorb ist leer.</div>';
        try{ var pbox=document.getElementById('fp-payments-box'); if(pbox){ pbox.style.display='none'; } }catch(_){ }
      } else {
        try{ var pbox2=document.getElementById('fp-payments-box'); if(pbox2){ pbox2.style.display='block'; } }catch(_){ }
      }
      items.forEach(function(it){
        var row = document.createElement('div'); row.className='fp-cart-item';
        var img = document.createElement('img'); img.src=it.img||''; img.alt=it.name||'';
        var info=document.createElement('div');
        var title=document.createElement('div'); title.className='title'; title.textContent=it.name||'Produkt';
        var meta=document.createElement('div'); meta.className='meta';
        try{
          var keyGuess = it.key || getKeyFromIds(it.productId, it.variantId) || '';
          var veMap = (window.VE) || (window.VE_VALUES);
          if(veMap && keyGuess && veMap[keyGuess]){ meta.textContent = 'VE: ' + veMap[keyGuess]; }
          else { meta.textContent = ''; }
        }catch(_){ meta.textContent=''; }
        info.appendChild(title); info.appendChild(meta);
        var right=document.createElement('div'); right.className='fp-right-cell'; right.style.display='flex'; right.style.alignItems='center'; right.style.gap='12px';
        var qty=document.createElement('div'); qty.className='qty';
        var minus=document.createElement('button'); minus.className='btn outline'; minus.style.width='36px'; minus.textContent='−';
        var input=document.createElement('input'); input.type='number'; input.min='0'; input.value=String(it.quantity);
        var plus=document.createElement('button'); plus.className='btn outline'; plus.style.width='36px'; plus.textContent='+';
        // Preis pro Item × Menge anzeigen
        var priceNode = it.el.querySelector('.w-commerce-commercecartitemprice, [data-node-type*="price" i], .text-block-5');
        var single = parsePriceEU(priceNode ? priceNode.textContent : '0');
        var total = single * (it.quantity||1);
        var priceTotal = document.createElement('div'); priceTotal.className='item-price'; priceTotal.textContent = fmtEuro(total);
        var remove=document.createElement('button'); remove.className='btn outline remove-btn'; remove.textContent='Entfernen';
        qty.appendChild(minus); qty.appendChild(input); qty.appendChild(plus);
        right.appendChild(qty); right.appendChild(priceTotal); right.appendChild(remove);
        row.appendChild(img); row.appendChild(info); row.appendChild(right);
        function setNativeQuantity(target){
          try{ var qEl = it.el.querySelector('input[type="number"], input[data-node-type*="quantity"], .w-commerce-commercecartquantity input, input[name*="quantity" i]'); if(qEl){ qEl.value = target; qEl.dispatchEvent(new Event('change', { bubbles:true })); } }catch(_){ }
        }
        minus.addEventListener('click', async function(){ var c=parseInt(input.value,10)||0; var next=Math.max(0,c-1); input.value=String(next); setNativeQuantity(next); await waitAck(1500); });
        plus.addEventListener('click', async function(){ var c=parseInt(input.value,10)||0; var next=c+1; input.value=String(next); setNativeQuantity(next); await waitAck(1500); });
        input.addEventListener('change', async function(){ var v=parseInt(input.value,10); if(!isFinite(v)||v<0){ input.value=String(it.quantity); return; } var d=v-it.quantity; if(d!==0){ await setItemQuantityByDelta(it,d); }});
        remove.addEventListener('click', async function(){ var btn=findRemoveButton(it.el); if(btn){ btn.click(); await waitAck(1500); }});
        root.appendChild(row);
      });
    }
    var st = computeSubtotalNet(items); updateSummary(st.subtotal); fillProxySlots();
  }

  function updateSummary(subtotal){
    var net = subtotal||0;
    var note = document.getElementById('fp-summary-note');
    var vatLine = document.getElementById('fp-vat-line');
    if(isPrivate()){
      try{ document.getElementById('fp-subtotal').textContent = fmtEuro(net); }catch(_){ }
      if(note) note.textContent = 'Bei den angebeben Preisen handelt es sich um Nettobeträge. Privatkunden profitieren von 0% MwSt Gemäß §12 Abs. 3 UstG';
      if(vatLine) vatLine.textContent = '';
    }else{
      var vat = net * 0.19;
      var gross = net + vat;
      try{ document.getElementById('fp-subtotal').textContent = fmtEuro(net); }catch(_){ }
      if(note) note.textContent = 'Firmenkunden wird die MwSt im Bestellprozess berechnet.';
      if(vatLine) vatLine.textContent = 'zzgl. 19% MwSt: ' + fmtEuro(vat) + ' • Brutto: ' + fmtEuro(gross);
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
      var checkoutSlot = document.getElementById('fp-checkout-slot');
      if(checkoutSlot){
        checkoutSlot.innerHTML='';
        var btn=document.createElement('button'); btn.className='btn primary'; btn.textContent='Weiter zur Kasse';
        btn.addEventListener('click', function(){ clickNativeCheckout(); });
        checkoutSlot.appendChild(btn);
      }
    }catch(_){ }
    try{
      var quickSlot = document.getElementById('fp-quick-slot');
      if(quickSlot){
        quickSlot.innerHTML='';
        var qb=document.createElement('button'); qb.className='btn pay-dark';
        var icon=document.createElement('span'); icon.className='pay-icon';
        // Browser Detection → Icon/Text
        var ua=(navigator.userAgent||'').toLowerCase(); var label='Pay with browser.';
        if(/safari/.test(ua) && !/chrome|android/.test(ua)){ label='Pay with Apple Pay'; icon.innerHTML=''; icon.style.fontFamily='-apple-system'; icon.style.fontSize='18px'; }
        else if(/android|chrome|crios/.test(ua)){ label='Pay with Google Pay'; icon.innerHTML=''; icon.style.background='url(https://www.gstatic.com/instantbuy/svg/dark_gpay.svg) no-repeat center/contain'; }
        else { icon.style.background='url(https://www.gstatic.com/instantbuy/svg/dark_gpay.svg) no-repeat center/contain'; }
        qb.appendChild(icon); var span=document.createElement('span'); span.textContent=label; qb.appendChild(span);
        qb.addEventListener('click', function(){
          try{ var quick = document.querySelector('[data-node-type="commerce-cart-quick-checkout-button"], .w-commerce-commercecartquickcheckoutbutton'); if(quick){ quick.click(); } }catch(_){ }
        });
        quickSlot.appendChild(qb);
      }
    }catch(_){ }
    try{
      var paypalSlot = document.getElementById('fp-paypal-slot');
      if(paypalSlot){
        paypalSlot.innerHTML='';
        function makeBtn(label, cls, iconSrc){
          var b=document.createElement('button'); b.className='btn '+cls;
          var i=document.createElement('img'); i.className='pay-icon'; i.alt=''; i.src=iconSrc; b.appendChild(i);
          var s=document.createElement('span'); s.textContent=label; b.appendChild(s); return b;
        }
        var ppIcon='https://www.paypalobjects.com/webstatic/icon/pp258.png';
        var sepaIcon='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjMyIiB2aWV3Qm94PSIwIDAgMTAwIDMyIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWluWU1pbiBtZWV0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGZpbGw9IiMwMDVEQTAiIGQ9Ik0gMzkuODcxIDE4Ljc3MiBDIDM3Ljc4IDE4Ljc3MiAzNS44NDMgMTguMjc4IDM0LjI3MiAxNy40MjUgTCAzNC44MSAxMy45MzUgQyAzNi40MDkgMTQuNzY5IDM4LjA1MSAxNS4yNjMgMzkuODI2IDE1LjI2MyBDIDQxLjgwOSAxNS4yNjMgNDIuNjYxIDE0LjU0NCA0Mi42NjEgMTMuMjg0IEMgNDIuNjYxIDEwLjQ1IDM0LjM0IDExLjY0MSAzNC4zNCA1LjU5IEMgMzQuMzQgMi41MyAzNi4zMTkgMC4wNTUgNDAuODg1IDAuMDU1IEMgNDIuNjM5IDAuMDU1IDQ0LjU0OSAwLjQxNiA0NS45NDYgMC45OTkgTCA0NS40NzQgNC4zOTUgQyA0My45ODkgMy45MjYgNDIuNDgxIDMuNjMzIDQxLjEwOCAzLjYzMyBDIDM4Ljg2IDMuNjMzIDM4LjI3NSA0LjM5NSAzOC4yNzUgNS4zNjQgQyAzOC4yNzUgOC4xNzUgNDYuNTk4IDYuODk1IDQ2LjU5OCAxMy4wMTMgQyA0Ni41NzYgMTYuNTY5IDQ0LjEwMSAxOC43NzIgMzkuODcxIDE4Ljc3MiBaIj48L3BhdGg+PC9zdmc+';
        var cardIcon='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjRweCIgaGVpZ2h0PSIxOHB4IiB2aWV3Qm94PSIwIDAgMjQgMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTguMjc1IDEyLjUxMkMyLjcuLiIvPjwvc3ZnPg==';
        // Hinweis: verkürzte Icons; in Produktion die vollständigen base64 aus dem Webflow verwenden

        var btnPP=makeBtn('Pay with PayPal','paypal-blue',ppIcon);
        btnPP.addEventListener('click', async function(){
          try{
            btnPP.disabled = true;
            var b = findPayPalDomButton('paypal') || document.querySelector('div.paypal-button.paypal-button-number-0[role="link"][data-funding-source="paypal"]');
            if(!b){ b = await waitForFundingButton('paypal', 10000); }
            if(!b){ flashNotice('PayPal ist noch nicht bereit. Bitte erneut versuchen.'); return; }
            if(b.tagName && b.tagName.toLowerCase()==='iframe'){ try{ b.contentWindow && b.contentWindow.postMessage({event:'click'}, '*'); return; }catch(_){ } }
            withTemporarilyShown(b, function(){ triggerSyntheticClick(b); });
          }catch(_){ } finally { try{ btnPP.disabled=false; }catch(__){} }
        });
        paypalSlot.appendChild(btnPP);

        var sepaSlot=document.getElementById('fp-paypal-sepa');
        if(sepaSlot){
          sepaSlot.innerHTML='';
          var btnSEPA=makeBtn('Pay with SEPA','sepa',sepaIcon);
          btnSEPA.addEventListener('click', async function(){
            try{
              btnSEPA.disabled = true;
              var b = findPayPalDomButton('sepa') || document.querySelector('div.paypal-button[role="link"][data-funding-source="sepa"], [aria-label*="SEPA" i], [aria-label="sepa" i]');
              if(!b){ b = await waitForFundingButton('sepa', 10000); }
              if(!b){ flashNotice('SEPA ist noch nicht bereit. Bitte erneut versuchen.'); return; }
              if(b.tagName && b.tagName.toLowerCase()==='iframe'){ try{ b.contentWindow && b.contentWindow.postMessage({event:'click'}, '*'); return; }catch(_){ } }
              withTemporarilyShown(b, function(){ triggerSyntheticClick(b); });
            }catch(_){ } finally { try{ btnSEPA.disabled=false; }catch(__){} }
          });
          sepaSlot.appendChild(btnSEPA);
        }
        var cardSlot=document.getElementById('fp-paypal-card');
        if(cardSlot){
          cardSlot.innerHTML='';
          var btnCARD=makeBtn('Debit or Credit Card','card',cardIcon);
          btnCARD.addEventListener('click', async function(){
            try{
              btnCARD.disabled = true;
              var b = findPayPalDomButton('card') || document.querySelector('div.paypal-button[role="link"][data-funding-source="card"], [aria-label*="Credit Card" i], [aria-label*="Kreditkarte" i]');
              if(!b){ b = await waitForFundingButton('card', 10000); }
              if(!b){ flashNotice('Kartenzahlung ist noch nicht bereit. Bitte erneut versuchen.'); return; }
              if(b.tagName && b.tagName.toLowerCase()==='iframe'){ try{ b.contentWindow && b.contentWindow.postMessage({event:'click'}, '*'); return; }catch(_){ } }
              withTemporarilyShown(b, function(){ triggerSyntheticClick(b); });
            }catch(_){ } finally { try{ btnCARD.disabled=false; }catch(__){} }
          });
          cardSlot.appendChild(btnCARD);
        }
      }
    }catch(_){ }
  }

  function clickNativeCheckout(){
    var sels = ['[data-node-type*="checkout" i]', '.w-commerce-commercecartcheckoutbutton', 'a[href*="checkout" i]'];
    for(var i=0;i<sels.length;i++){ var b=document.querySelector(sels[i]); if(b){ try{ b.click(); return; }catch(_){ } } }
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();


