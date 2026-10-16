/* DOM checks with fixture HTTP. External providers and browser geometry are not live tests. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const fixture={id:1,sku:'OFFLINE-SKU',slug:'offline-product',name:'Offline product',en:'Offline product',brand:'Fixture',category:'skincare',sub:'serum',short:'Fixture short description',description:'Fixture description',price:120.25,compare:0,stock:5,size:'30 ml',origin:'',image_url:'https://example.com/product.png',active:true,content_verified:true,archived:false,tags:[],ingredients:['Fixture ingredient'],skin:[],images:[],usage:'Follow label',variants:[]};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup({products=[fixture],failCatalog=false,hash='#/',legacy=null,user=null,reference=[],admin={}}={}){
  const errors=[],requests=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',e=>errors.push(e));
  const dom=new JSDOM(fs.readFileSync('frontend/index.html','utf8'),{url:'http://127.0.0.1:8000/'+hash,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.matchMedia=q=>({matches:q.includes('prefers-reduced-motion'),addEventListener(){},removeEventListener(){}});
  w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.AbortSignal.timeout=AbortSignal.timeout;w.crypto.randomUUID=require('node:crypto').randomUUID;w.prompt=()=>null;w.confirm=()=>false;w.document.cookie='gn_csrf=offline-fixture';
  if(legacy)w.localStorage.setItem('gn_state_v2',JSON.stringify(legacy));
  w.fetch=async(url,options={})=>{
    const body=options.body&&typeof options.body==='string'?JSON.parse(options.body):null;
    requests.push({url:String(url),method:options.method||'GET',body,headers:options.headers,credentials:options.credentials});
    if(String(url)==='/api/products'&&failCatalog)return new Response(JSON.stringify({detail:'Offline fixture catalog failure'}),{status:503,headers:{'content-type':'application/json'}});
    const cfg={brand:{facebook:'https://www.facebook.com/glownuturebd',instagram:'https://www.instagram.com/glownuture/reels/'},seller:{name:'Offline fixture store',address:'Fixture address',email:'fixture@example.com',phone:'01712345678'},shipping:{dhaka:60,outside:120,freeThreshold:2500},checkoutEnabled:true,payments:{cod:true,online:false,sandbox:true},firebase:{enabled:false,google:false,facebook:false},recaptcha:{enabled:false},analyticsEnabled:false};
    let data={};
    if(url==='/api/config')data=cfg;
    else if(url==='/api/products')data=products;
    else if(url==='/api/auth/me'||url==='/api/profile')data=user;
    else if(url==='/api/auth/csrf')data={authenticated:Boolean(user)};
    else if(url==='/api/customer/state')data={cart:[],wishlist:[],comparison:[]};
    else if(url==='/api/orders/me'||String(url).includes('/reviews')||String(url).startsWith('/api/content/')||url==='/api/notifications')data=[];
    else if(url==='/api/catalog/ordinary')data=reference;
    else if(url==='/api/checkout/quote'){
      const subtotal=(body.items||[]).reduce((sum,item)=>sum+Math.round((products.find(p=>p.id===item.product_id)?.variants?.find(v=>v.id===item.variant_id)?.price||products.find(p=>p.id===item.product_id)?.price||0)*100)*item.qty,0);
      data={subtotal_minor:subtotal,discount_minor:0,delivery_minor:6000,tax_minor:0,total_minor:subtotal+6000,currency:'BDT',items:body.items};
    }else if(url==='/api/orders')data={id:'GN-OFFLINE-FIXTURE',status:'pending',payment:'cod',payment_status:'cod_due',created_at:'2026-10-14T06:00:00Z',total_minor:body.expected_total_minor,total:body.expected_total_minor/100,subtotal:body.expected_total_minor/100-60,discount:0,delivery:60,tax:0,items:body.items.map(i=>({...i,name:'Offline product',sku:'OFFLINE-SKU',price:120.25})),tracking_token:'offline-private-tracking-fixture-token'};
    else if(String(url).startsWith('/api/admin/'))data=admin[String(url)]??[];
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  };
  for(const file of ['api-client.js','app.js','glow-motion.js','glow-auth.js','firebase-bridge.js','commerce-ui.js','catalog-console.js','glow-admin.js'])w.eval(fs.readFileSync(path.join('frontend/assets',file),'utf8'));
  await pause(220);
  return {w,dom,errors,requests,close:()=>dom.window.close(),route:async next=>{w.location.hash=next;await pause(140);}};
}
const noErrors=s=>assert.equal(s.errors.length,0,s.errors.map(e=>e.message).join('\n'));
async function standalone(payload,{file=false,failOnce=false}={}){
  const errors=[],calls=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(fs.readFileSync('frontend/catalog/index.html','utf8'),{url:file?'file:///catalog/index.html':'http://127.0.0.1:8000/ordinary-catalog',runScripts:'outside-only',virtualConsole:vc});
  dom.window.fetch=async url=>{calls.push(url);const fail=failOnce&&calls.length===1;return new Response(JSON.stringify(fail?{detail:'Offline catalog unavailable'}:payload),{status:fail?503:200});};
  dom.window.eval(dom.window.document.querySelector('script').textContent);await pause(25);
  return {w:dom.window,errors,calls,close:()=>dom.window.close()};
}
test('standalone catalog safely accepts both provider data envelopes and image fallbacks',async()=>{
  const product={name:'<img src=x onerror=alert(1)>',description:'<script>alert(1)</script>',price:9.5,currency:'BDT',images:[],image_url:'https://example.com/real.png',key_ingredients:[{name:'Zinc'}]};
  for(const payload of [{data:{products:[product]}},{data:[product]}]){
    const s=await standalone(payload);
    try{
      const article=s.w.document.querySelector('.card');assert.ok(article);assert.equal(article.querySelector('script'),null);assert.equal(article.querySelector('[onerror]'),null);
      assert.match(article.textContent,/৳9.5 BDT/);assert.match(article.textContent,/Zinc/);const image=article.querySelector('img');assert.match(image.src,/example.com/);
      image.dispatchEvent(new s.w.Event('error'));assert.match(image.src,/no-image.svg/);image.dispatchEvent(new s.w.Event('error'));assert.match(image.src,/^data:image\/svg\+xml/);assert.equal(image.onerror,null);noErrors(s);
    }finally{s.close();}
  }
});
test('standalone catalog displays a provider error and recovers with retry',async()=>{
  const s=await standalone({data:[]},{failOnce:true});
  try{assert.match(s.w.document.getElementById('state').textContent,/Offline catalog unavailable/);assert.equal(s.w.document.getElementById('retry').hidden,false);s.w.document.getElementById('retry').click();await pause(25);assert.match(s.w.document.getElementById('state').textContent,/No products found/);assert.equal(s.calls.length,2);noErrors(s);}finally{s.close();}
});
test('standalone catalog opened as a file explains the required server without calling the private provider',async()=>{
  const s=await standalone([],{file:true});
  try{assert.equal(s.calls.length,0);assert.match(s.w.document.getElementById('state').textContent,/backend at \/ordinary-catalog/);noErrors(s);}finally{s.close();}
});
test('empty server catalog does not display demo stock or restore persisted credentials',async()=>{
  const s=await setup({products:[],legacy:{products:[{id:'p01',name:'Fake persisted item'}],user:{name:'Fake admin',role:'super_admin'},orders:[{customer:{phone:'private'}}]}});
  try{assert.equal(s.w.GNStore.store.products().length,0);assert.equal(s.w.GNStore.store.state.user,null);assert.equal(s.w.localStorage.getItem('gn_state_v2'),null);noErrors(s);}finally{s.close();}
});
test('homepage hero uses bundled illustrations only when the public catalog is empty',async()=>{
  const empty=await setup({products:[]});
  try{
    const hero=empty.w.document.querySelector('.hero-visual .hv-inner');
    const paths=Array.from(hero.querySelectorAll('img'),img=>new URL(img.src).pathname);
    assert.equal(hero.classList.contains('hv-inner--illustrations'),true);
    assert.deepEqual(paths,['/media/products/hero-cleanser.svg','/media/products/hero-serum.svg','/media/products/hero-sunscreen.svg']);
    for(const image of hero.querySelectorAll('img')){assert.equal(image.alt,'');assert.ok(fs.existsSync(path.join('frontend',new URL(image.src).pathname.slice(1))));}
    noErrors(empty);
  }finally{empty.close();}
  const populated=await setup();
  try{
    const hero=populated.w.document.querySelector('.hero-visual .hv-inner');
    assert.equal(hero.classList.contains('hv-inner--illustrations'),false);
    assert.match(hero.querySelector('img').src,/example\.com\/product\.png/);
    assert.equal(hero.querySelectorAll('img').length,1);
    noErrors(populated);
  }finally{populated.close();}
});
test('catalog failure shows a retryable error, with no demo inventory',async()=>{
  const s=await setup({failCatalog:true,hash:'#/shop'});
  try{assert.match(s.w.document.getElementById('app').textContent,/Offline fixture catalog failure/);assert.ok(s.w.document.querySelector('[data-action=retry-catalog]'));assert.equal(s.w.GNStore.store.products().length,0);noErrors(s);}finally{s.close();}
});
test('official social links and product images render',async()=>{
  const s=await setup({hash:'#/shop'});
  try{assert.equal(s.w.document.querySelector('a[aria-label=Facebook]').href,'https://www.facebook.com/glownuturebd');assert.match(s.w.document.querySelector('.pcard img').src,/example.com/);assert.ok(s.w.document.querySelector('.gn-card-ingredients'));noErrors(s);}finally{s.close();}
});
test('broken images fall back once without inline event handlers',async()=>{
  const s=await setup({hash:'#/shop'});
  try{const image=s.w.document.querySelector('.pcard img');image.dispatchEvent(new s.w.Event('error'));assert.match(image.src,/no-image.svg/);image.dispatchEvent(new s.w.Event('error'));assert.match(image.src,/no-image.svg/);assert.equal(image.hasAttribute('onerror'),false);noErrors(s);}finally{s.close();}
});
test('untrusted upstream strings stay escaped in reference cards',async()=>{
  const s=await setup({hash:'#/ordinary',reference:[{name:'<img src=x onerror=alert(1)>',description:'<script>alert(1)</script>',ingredients:['"><svg onload=alert(1)>'],price:null,images:[]}]});
  try{assert.equal(s.w.document.querySelector('#app script'),null);assert.equal(s.w.document.querySelector('#app [onload]'),null);assert.equal(s.w.document.querySelector('#app [onerror]'),null);assert.match(s.w.document.getElementById('app').textContent,/Price not provided/);noErrors(s);}finally{s.close();}
});
test('cart limits, comparison and persistence use IDs and quantities only',async()=>{
  const s=await setup({hash:'#/shop'});
  try{
    const store=s.w.GNStore.store;assert.equal(store.addToCart('p01',1).ok,true);assert.equal(store.addToCart('p01',6).ok,false);
    s.w.document.querySelector('[data-extra=compare]').click();await pause(25);await s.route('#/compare');assert.match(s.w.document.getElementById('app').textContent,/Offline product/);
    store.setUser({name:'Private fixture name',phone:'01712345678',role:'customer'});store.createOrder({id:'GN-OFFLINE-PRIVATE',customer:{address:'Private fixture address'},items:[],created_at:'2026-10-14T06:00:00Z'});
    store.persist();const saved=JSON.parse(s.w.localStorage.getItem('gn_state_v3'));assert.deepEqual(Object.keys(saved).sort(),['cart','comparison','recent','wishlist']);assert.equal(JSON.stringify(saved).includes('Private fixture'),false);noErrors(s);
  }finally{s.close();}
});
test('Firebase email form preserves Nuri and disables unconfigured Facebook',async()=>{
  const s=await setup({hash:'#/account'});
  try{assert.ok(s.w.document.querySelector('.nuri'));assert.ok(s.w.document.querySelector('#loginForm[data-firebase] input[name=email]'));assert.equal(s.w.document.querySelector('#loginForm input[name=phone]'),null);assert.equal(s.w.document.querySelector('[data-firebase-action=facebook]').disabled,true);assert.ok(s.w.document.querySelector('form[data-firebase=reset]'));noErrors(s);}finally{s.close();}
});
test('guest checkout submits a server total, numeric IDs, consent and idempotency key',async()=>{
  const s=await setup();
  try{
    s.w.GNStore.store.addToCart('p01',1);await s.route('#/checkout');
    const form=s.w.document.getElementById('checkoutForm'),values={name:'Offline Buyer',phone:'01712345678',division:'ঢাকা',district:'ঢাকা',upazila:'Fixture area',address:'Offline fixture address'};
    for(const [key,value] of Object.entries(values)){
      const input=form.elements.namedItem(key);input.value=value;if(key==='division'){input.dispatchEvent(new s.w.Event('change'));form.elements.namedItem('district').value='ঢাকা';}
    }
    form.elements.namedItem('accept_terms').checked=true;form.dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));await pause(220);
    const order=s.requests.find(r=>r.url==='/api/orders');assert.ok(order,JSON.stringify(s.requests));assert.equal(order.body.items[0].product_id,1);assert.equal(order.body.expected_total_minor,18025);assert.equal(order.body.accept_terms,true);assert.equal(order.headers['Idempotency-Key'].length,36);
    assert.match(s.w.location.hash,/GN-OFFLINE-FIXTURE/);assert.match(s.w.document.getElementById('app').textContent,/offline-private-tracking-fixture-token/);noErrors(s);
  }finally{s.close();}
});
test('variant selection preserves its price and ID through the cart',async()=>{
  const s=await setup({products:[{...fixture,stock:0,variants:[{id:10,sku:'OFFLINE-VARIANT',label:'60 ml',price:210.50,stock:2}]}],hash:'#/p/offline-product'});
  try{assert.ok(s.w.document.getElementById('gnVariant'));assert.equal(s.w.GNStore.store.addToCart('p01',1).ok,true);assert.equal(s.w.GNStore.quoteItems()[0].variant_id,10);assert.equal(s.w.GNStore.store.cartLines()[0].subtotal,210.50);noErrors(s);}finally{s.close();}
});
test('customer admin access shows staff sign-in without a browser admin flag',async()=>{
  const s=await setup({hash:'#/admin',user:{id:1,name:'Offline Customer',phone:'01712345678',role:'customer',preferences:{},addresses:[],email:'fixture@example.com'}});
  try{assert.match(s.w.document.getElementById('app').textContent,/Customer account/);assert.ok(s.w.document.querySelector('[data-admin-signin]'));noErrors(s);}finally{s.close();}
});

test('auth scene listeners stop after navigating to account security',async()=>{
  const s=await setup({hash:'#/account'});
  try{
    s.w.GNStore.store.setUser({id:1,name:'Offline Customer',phone:'01712345678',role:'customer',firebase_uid:'offline-uid',email:'fixture@example.com',email_verified:true,preferences:{},addresses:[]});
    await s.route('#/account/settings');
    const input=s.w.document.querySelector('#gnTotpEnroll input[type=password]');
    assert.ok(input);input.dispatchEvent(new s.w.FocusEvent('focusin',{bubbles:true}));await pause(30);noErrors(s);
  }finally{s.close();}
});
test('core routes remain usable without runtime exceptions',async()=>{
  const s=await setup();
  try{
    for(const route of ['#/shop','#/search?q=Fixture','#/wishlist','#/cart','#/track','#/journal','#/page/about','#/page/privacy','#/page/terms','#/page/delivery','#/page/return','#/page/contact']){
      await s.route(route);assert.ok(s.w.document.getElementById('app').textContent.trim(),route);noErrors(s);
    }
  }finally{s.close();}
});

test('responsive image candidates clear srcset and try an alternate before placeholder',async()=>{
  const p={...fixture,image_url:'/media/assets/qa/main.webp',images:['/media/assets/qa/other.webp'],image_assets:[{url:'/media/assets/qa/main.webp',width:800,height:1000,variants:[{url:'/media/assets/qa/small.webp',width:320,height:400},{url:'/media/assets/qa/medium.webp',width:640,height:800}]}]};
  const s=await setup({products:[p],hash:'#/p/offline-product'});
  try{const image=s.w.document.querySelector('#pdMain img');assert.match(image.srcset,/320w/);assert.equal(image.getAttribute('loading'),'eager');image.dispatchEvent(new s.w.Event('error'));assert.equal(image.hasAttribute('srcset'),false);assert.match(image.src,/other.webp/);image.dispatchEvent(new s.w.Event('error'));assert.match(image.src,/no-image.svg/);noErrors(s);}finally{s.close();}
});
test('approved local collection prices use BDT and safely escapes product metadata',async()=>{
  const s=await setup({hash:'#/ordinary',reference:[{...fixture,currency:'BDT'}]});
  try{assert.match(s.w.document.getElementById('app').textContent,/৳120.25/);assert.ok(s.w.document.querySelector('a[href="#/p/offline-product"]'));noErrors(s);}finally{s.close();}
});
test('standalone collection refuses to relabel a foreign price as BDT',async()=>{
  const s=await standalone({data:[{...fixture,currency:'GBP'}]});
  try{assert.match(s.w.document.querySelector('.price').textContent,/Price unavailable/);assert.doesNotMatch(s.w.document.querySelector('.price').textContent,/120/);noErrors(s);}finally{s.close();}
});
const staff={id:9,name:'Offline staff',role:'super_admin',firebase_uid:'offline-staff',email_verified:true,preferences:{},addresses:[]};
const reviewProduct={...fixture,revision:3,publication_state:'DRAFT',expiry_required:true};
test('admin edits drafts without a publish checkbox and opens a distinct review queue',async()=>{
  const s=await setup({hash:'#/admin/products',user:staff,admin:{'/api/admin/products':[reviewProduct]}});
  try{const b=s.w.document.querySelector('[data-admin-action=product-edit]');assert.ok(b);b.click();assert.equal(s.w.document.querySelector('input[name=active]'),null);assert.equal(s.w.document.querySelector('input[name=content_verified]'),null);assert.equal(s.w.document.querySelector('input[name=revision]').value,'3');assert.ok(s.w.document.querySelector('a[href="#/admin/approval?id=1"]'));noErrors(s);}finally{s.close();}
});
test('approval inspector shows all owner conditions, private previews and posts the saved revision',async()=>{
  const p={...reviewProduct,publication_state:'NEEDS_REVIEW'};
  const s=await setup({hash:'#/admin/approval?id=1',user:staff,admin:{'/api/admin/products/1/approval':{product:p,checks:['Image rights missing'],media:[{id:'qa-asset',url:'/media/assets/qa-asset/main.webp',width:480,height:640,health:'healthy',variants_json:[]}],history:[]},'/api/admin/products/1/sources':[], '/api/admin/suppliers':[{id:2,name:'Offline supplier',active:true}]}});
  try{const f=s.w.document.querySelector('[data-catalog-form=verify]');assert.ok(f);assert.equal(Object.keys(s.w.GNCatalogAdmin.reviewKeys).length,14);assert.match(s.w.document.querySelector('.gc-media img').src,/\/api\/admin\/media\/qa-asset\/preview/);for(const key of Object.keys(s.w.GNCatalogAdmin.reviewKeys))f.elements[key].checked=true;f.elements.evidence.value='Offline inspected supplier evidence';f.dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));await pause(160);const r=s.requests.find(r=>r.method==='POST'&&r.url==='/api/admin/products/1/review');assert.ok(r);assert.equal(r.body.expected_revision,3);assert.equal(r.body.supplier_id,2);assert.equal(r.body.action,'verify');assert.equal(r.body.confirmations.image_rights,true);noErrors(s);}finally{s.close();}
});
test('free source setup never prechecks owner authorization or stores a key in the browser',async()=>{
  const s=await setup({hash:'#/admin/imports',user:staff,admin:{'/api/admin/catalog/sources':[],'/api/admin/catalog/jobs':[],'/api/admin/catalog/duplicates':[]}});
  try{const prefill=s.w.document.querySelector('[data-catalog-action=obf-prefill]');assert.ok(prefill);prefill.click();const f=s.w.document.querySelector('[data-catalog-form=source]');assert.equal(f.elements.kind.value,'openbeautyfacts');assert.equal(f.elements.credential.value,'');assert.equal(f.elements.owner_authorized.checked,false);assert.match(f.elements.license.value,/ODbL/);noErrors(s);}finally{s.close();}
});
test('inventory staff can submit a draft but never see owner verification controls',async()=>{
  const s=await setup({hash:'#/admin/approval?id=1',user:{...staff,role:'inventory_manager'},admin:{'/api/admin/products/1/approval':{product:reviewProduct,checks:[],media:[],history:[]},'/api/admin/products/1/sources':[], '/api/admin/suppliers':[]}});
  try{assert.ok(s.w.document.querySelector('[data-catalog-action=submit]'));assert.equal(s.w.document.querySelector('[data-catalog-form=verify]'),null);assert.equal(s.w.document.querySelector('[data-catalog-form=publish]'),null);noErrors(s);}finally{s.close();}
});

test('base product remains selectable when a separate variant has stock',async()=>{
  const s=await setup({products:[{...fixture,stock:3,variants:[{id:10,sku:'QA-LARGE',label:'60 ml',price:210.50,stock:2}]}],hash:'#/p/offline-product'});
  try{let select=s.w.document.getElementById('gnVariant');assert.equal(select.value,'0');select.value='10';select.dispatchEvent(new s.w.Event('change'));await pause(30);select=s.w.document.getElementById('gnVariant');select.value='0';select.dispatchEvent(new s.w.Event('change'));await pause(30);assert.equal(s.w.GNStore.store.addToCart('p01',1).ok,true);const line=s.w.GNStore.quoteItems()[0];assert.equal(line.variant_id??null,null);assert.equal(s.w.GNStore.store.cartLines()[0].subtotal,120.25);noErrors(s);}finally{s.close();}
});
