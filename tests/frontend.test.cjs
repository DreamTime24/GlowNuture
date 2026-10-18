/* DOM checks with fixture HTTP. External providers and browser geometry are not live tests. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const fixture={id:1,sku:'OFFLINE-SKU',slug:'offline-product',name:'Offline product',en:'Offline product',brand:'Fixture',category:'skincare',sub:'serum',short:'Fixture short description',description:'Fixture description',price:120.25,compare:0,stock:5,size:'30 ml',origin:'',image_url:'https://example.com/product.png',active:true,content_verified:true,archived:false,tags:[],ingredients:['Fixture ingredient'],skin:[],images:[],usage:'Follow label',variants:[]};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup({products=[fixture],failCatalog=false,hash='#/',legacy=null,user=null,reference=[],admin={},reduced=true}={}){
  const errors=[],requests=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));vc.on('error',e=>errors.push(e));
  const dom=new JSDOM(fs.readFileSync('frontend/index.html','utf8'),{url:'http://127.0.0.1:8000/'+hash,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLMediaElement.prototype.pause=()=>{};
  w.HTMLMediaElement.prototype.load=()=>{};w.HTMLMediaElement.prototype.play=()=>Promise.resolve();
  w.matchMedia=q=>({matches:q.includes('prefers-reduced-motion')&&reduced,addEventListener(){},removeEventListener(){}});
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
  w.eval(fs.readFileSync('frontend/assets/media-paths.js','utf8'));
  w.eval(fs.readFileSync('frontend/assets/local-catalog.js','utf8'));
  w.GNLocalCatalog=products.map(p=>({...p,id:'p'+String(p.id).padStart(2,'0'),apiId:p.id,source:'api',displayOnly:false}));
  for(const file of ['api-client.js','app.js','glow-motion.js','glow-auth.js','firebase-bridge.js','commerce-ui.js','catalog-console.js','glow-admin.js'])w.eval(fs.readFileSync(path.join('frontend/assets',file),'utf8'));
  await pause(220);
  return {w,dom,errors,requests,close:()=>dom.window.close(),route:async next=>{w.location.hash=next;await pause(140);}};
}
const noErrors=s=>assert.equal(s.errors.length,0,s.errors.map(e=>e.message).join('\n'));
test('empty server catalog does not display demo stock or restore persisted credentials',async()=>{
  const s=await setup({products:[],legacy:{products:[{id:'p01',name:'Fake persisted item'}],user:{name:'Fake admin',role:'super_admin'},orders:[{customer:{phone:'private'}}]}});
  try{assert.equal(s.w.GNStore.store.products().length,0);assert.equal(s.w.GNStore.store.state.user,null);assert.equal(s.w.localStorage.getItem('gn_state_v2'),null);noErrors(s);}finally{s.close();}
});
test('homepage hero uses bundled product photos when the public catalog is empty',async()=>{
  const empty=await setup({products:[]});
  try{
    const hero=empty.w.document.querySelector('.hero-visual .hv-inner');
    const paths=Array.from(hero.querySelectorAll('img'),img=>new URL(img.src).pathname);
    assert.equal(hero.classList.contains('hv-inner--illustrations'),true);
    assert.deepEqual(paths,['/assets/image/cerave-foaming-facial-cleanser.jpg','/assets/image/the-ordinary-niacinamide-10-plus-zinc-1.jpg','/assets/image/skin1004-sun-serum.jpg']);
    for(const source of paths)assert.match(source,/^\/assets\/image\/[a-z0-9-]+\.jpg$/);
    for(const image of hero.querySelectorAll('img')){assert.ok(image.alt.length>0);assert.ok(fs.existsSync(path.join('frontend',new URL(image.src).pathname.slice(1))));}
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
test('homepage cycles through all bundled hero background videos muted',async()=>{
  const s=await setup({products:[],reduced:false});
  try{
    const video=s.w.document.querySelector('[data-hero-background-video]');
    assert.ok(video);
    assert.equal(video.hasAttribute('muted'),true);
    assert.equal(video.hasAttribute('autoplay'),true);
    assert.equal(video.hasAttribute('playsinline'),true);
    const playlist=video.dataset.videoPlaylist.split('|');
    const videoDirectory=path.join('frontend','assets','videos');
    assert.equal(playlist.length,4);
    for(const source of playlist){
      const filename=decodeURIComponent(source.split('/').pop());
      assert.ok(fs.existsSync(path.join(videoDirectory,filename)),`missing background video: ${filename}`);
    }
    assert.equal(video.getAttribute('src'),playlist[0]);
    video.load=()=>{};
    video.play=()=>Promise.resolve();
    for(let index=1;index<=playlist.length;index++){
      video.dispatchEvent(new s.w.Event('ended'));
      assert.equal(video.getAttribute('src'),playlist[index%playlist.length]);
    }
    noErrors(s);
  }finally{s.close();}
});
test('catalog rendering does not request the retired product API',async()=>{
  const s=await setup({failCatalog:true,hash:'#/shop'});
  try{assert.match(s.w.document.getElementById('app').textContent,/Offline product/);assert.equal(s.w.document.querySelector('[data-action=retry-catalog]'),null);assert.equal(s.requests.some(r=>r.url==='/api/products'),false);noErrors(s);}finally{s.close();}
});
test('official social links and product images render',async()=>{
  const s=await setup({hash:'#/shop'});
  try{assert.equal(s.w.document.querySelector('a[aria-label=Facebook]').href,'https://www.facebook.com/glownuturebd');assert.match(s.w.document.querySelector('.pcard img').src,/example.com/);assert.ok(s.w.document.querySelector('.gn-card-ingredients'));noErrors(s);}finally{s.close();}
});
test('products without a photo use the local placeholder instead of random third-party imagery',async()=>{
  const s=await setup({products:[{...fixture,image_url:null,images:[]}],hash:'#/shop'});
  try{assert.match(s.w.document.querySelector('.pcard img').src,/\/assets\/no-image\.svg$/);noErrors(s);}finally{s.close();}
});
test('broken product photos fall back to the local placeholder without inline handlers',async()=>{
  const s=await setup({hash:'#/shop'});
  try{const image=s.w.document.querySelector('.pcard img');image.dispatchEvent(new s.w.Event('error'));assert.match(image.src,/no-image\.svg/);image.dispatchEvent(new s.w.Event('error'));assert.match(image.src,/no-image\.svg/);assert.equal(image.hasAttribute('onerror'),false);noErrors(s);}finally{s.close();}
});
test('untrusted catalog strings stay escaped in Ordinary cards',async()=>{
  const s=await setup({hash:'#/ordinary',reference:[{name:'<img src=x onerror=alert(1)>',description:'<script>alert(1)</script>',ingredients:['"><svg onload=alert(1)>'],price:null,images:[]}]});
  try{assert.equal(s.w.document.querySelector('#app script'),null);assert.equal(s.w.document.querySelector('#app [onload]'),null);assert.equal(s.w.document.querySelector('#app [onerror]'),null);assert.match(s.w.document.getElementById('app').textContent,/<script>alert\(1\)<\/script>/);noErrors(s);}finally{s.close();}
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

test('storefront document and customer-facing routes use English copy',async()=>{
  const s=await setup();
  try{
    assert.equal(s.w.document.documentElement.lang,'en');
    for(const route of ['#/','#/shop','#/cart','#/page/about','#/page/delivery','#/page/contact']){
      await s.route(route);
      assert.doesNotMatch(s.w.document.body.textContent.replace(/৳/g,''),/[\u0980-\u09FF]/,route);
    }
    noErrors(s);
  }finally{s.close();}
});

test('responsive image candidates clear srcset and try an alternate before placeholder',async()=>{
  const p={...fixture,image_url:'/media/assets/qa/main.webp',images:['/media/assets/qa/other.webp'],image_assets:[{url:'/media/assets/qa/main.webp',width:800,height:1000,variants:[{url:'/media/assets/qa/small.webp',width:320,height:400},{url:'/media/assets/qa/medium.webp',width:640,height:800}]}]};
  const s=await setup({products:[p],hash:'#/p/offline-product'});
  try{const image=s.w.document.querySelector('#pdMain img');assert.match(image.srcset,/320w/);assert.equal(image.getAttribute('loading'),'eager');image.dispatchEvent(new s.w.Event('error'));assert.equal(image.hasAttribute('srcset'),false);assert.match(image.src,/other.webp/);image.dispatchEvent(new s.w.Event('error'));assert.match(image.src,/no-image\.svg/);noErrors(s);}finally{s.close();}
});
test('approved commerce fixture prices remain BDT in the Ordinary collection',async()=>{
  const s=await setup({hash:'#/ordinary',reference:[{...fixture,currency:'BDT'}]});
  try{assert.match(s.w.document.getElementById('app').textContent,/৳120.25/);assert.ok(s.w.document.querySelector('a[href="#/p/offline-product"]'));noErrors(s);}finally{s.close();}
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
test('authorized file import accepts XLSX and explains the private draft flow',async()=>{
  const source={id:5,key:'owner-catalog',name:'Owner catalog',kind:'file',enabled:true};
  const s=await setup({hash:'#/admin/imports',user:staff,admin:{'/api/admin/catalog/sources':[source],'/api/admin/catalog/jobs':[],'/api/admin/catalog/duplicates':[]}});
  try{
    const upload=s.w.document.querySelector('[data-catalog-form=feed]');assert.ok(upload);
    assert.match(upload.elements.file.accept,/\.xlsx/);
    assert.match(upload.textContent,/one complete CSV, JSON or XLSX file \(up to 500 rows and 1 MB\)/);
    assert.match(upload.textContent,/private drafts/);
    assert.match(upload.textContent,/separate owner-authorized file source for each dataset/);
    noErrors(s);
  }finally{s.close();}
});
test('only the owner can queue bundled drafts after confirming source reuse review',async()=>{
  const adminData={'/api/admin/catalog/sources':[],'/api/admin/catalog/jobs':[],'/api/admin/catalog/duplicates':[]};
  const s=await setup({hash:'#/admin/imports',user:staff,admin:adminData});
  try{
    const form=s.w.document.querySelector('[data-catalog-form=bundled]');assert.ok(form);
    assert.match(form.textContent,/500 \+ 12 \+ 227 rows/);assert.match(form.textContent,/private drafts/);
    assert.equal(form.elements.owner_authorized.checked,false);assert.equal(form.elements.owner_authorized.required,true);
    form.dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));await pause(25);
    assert.equal(s.requests.some(r=>r.url==='/api/admin/catalog/bundled-imports'),false);
    form.elements.owner_authorized.checked=true;
    form.dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));await pause(160);
    const request=s.requests.find(r=>r.url==='/api/admin/catalog/bundled-imports');assert.ok(request);
    assert.equal(request.method,'POST');assert.equal(request.body.owner_authorized,true);
    assert.match(request.body.request_id,/^[a-f0-9]{32}$/);
    noErrors(s);
  }finally{s.close();}
  const delegated=await setup({hash:'#/admin/imports',user:{...staff,role:'admin'},admin:adminData});
  try{assert.equal(delegated.w.document.querySelector('[data-catalog-form=bundled]'),null);noErrors(delegated);}finally{delegated.close();}
});
test('source image candidates remain unverified and only prefill the permission form',async()=>{
  const url='https://images.example.test/verified-path.jpg';
  const source={id:10,source_id:5,external_id:'sku-one',changes_json:{},snapshot_json:{image_candidates:[{url,reported_license:'<svg onload=alert(1)>'},{url:'javascript:alert(1)'},{url:'http://example.test/insecure.jpg'},{url:'https://user:secret@example.test/private.jpg'}]}};
  const s=await setup({hash:'#/admin/approval?id=1',user:staff,admin:{'/api/admin/products/1/approval':{product:reviewProduct,checks:[],media:[],history:[]},'/api/admin/products/1/sources':[source],'/api/admin/suppliers':[]}});
  try{
    const doc=s.w.document,candidates=doc.querySelectorAll('img[alt^="Unverified source image candidate"]');assert.equal(candidates.length,1);
    assert.equal(candidates[0].getAttribute('referrerpolicy'),'no-referrer');
    assert.equal(doc.querySelector('#gn-admin [onload]'),null);assert.equal(doc.querySelector('#gn-admin script'),null);
    const link=doc.querySelector('a[href="'+url+'"]');assert.ok(link);assert.match(link.rel,/noopener/);assert.match(link.rel,/noreferrer/);assert.equal(link.getAttribute('referrerpolicy'),'no-referrer');
    const remote=doc.querySelector('[data-catalog-form=remote]');assert.ok(remote);assert.equal(remote.elements.url.value,'');
    doc.querySelector('[data-catalog-action=candidate-url]').click();assert.equal(remote.elements.url.value,url);assert.equal(remote.closest('details').open,true);
    assert.equal(s.requests.some(r=>r.url.includes('/api/admin/media/from-url')),false);
    noErrors(s);
  }finally{s.close();}
});
test('inventory staff can submit a draft but never see owner verification controls',async()=>{
  const s=await setup({hash:'#/admin/approval?id=1',user:{...staff,role:'inventory_manager'},admin:{'/api/admin/products/1/approval':{product:reviewProduct,checks:[],media:[],history:[]},'/api/admin/products/1/sources':[], '/api/admin/suppliers':[]}});
  try{assert.ok(s.w.document.querySelector('[data-catalog-action=submit]'));assert.equal(s.w.document.querySelector('[data-catalog-form=verify]'),null);assert.equal(s.w.document.querySelector('[data-catalog-form=publish]'),null);noErrors(s);}finally{s.close();}
});

test('base product remains selectable when a separate variant has stock',async()=>{
  const s=await setup({products:[{...fixture,stock:3,variants:[{id:10,sku:'QA-LARGE',label:'60 ml',price:210.50,stock:2}]}],hash:'#/p/offline-product'});
  try{let select=s.w.document.getElementById('gnVariant');assert.equal(select.value,'0');select.value='10';select.dispatchEvent(new s.w.Event('change'));await pause(30);select=s.w.document.getElementById('gnVariant');select.value='0';select.dispatchEvent(new s.w.Event('change'));await pause(30);assert.equal(s.w.GNStore.store.addToCart('p01',1).ok,true);const line=s.w.GNStore.quoteItems()[0];assert.equal(line.variant_id??null,null);assert.equal(s.w.GNStore.store.cartLines()[0].subtotal,120.25);noErrors(s);}finally{s.close();}
});
