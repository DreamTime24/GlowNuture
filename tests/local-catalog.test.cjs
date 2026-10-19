/* Local assets and public browsing are exercised without a reachable product API. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL,fileURLToPath}=require('node:url'),os=require('node:os');
const {JSDOM,VirtualConsole}=require('jsdom');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){for(let attempt=0;attempt<40;attempt++){if(predicate())return;await pause(25);}assert.ok(predicate(),'Timed out waiting for DOM enhancement');}
const frontend=path.resolve('frontend');
function manifest(){
  const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(frontend,'assets/local-catalog.js'),'utf8'),context);
  return JSON.parse(JSON.stringify({products:context.window.GNLocalCatalog,videos:context.window.GNLocalVideos}));
}
function assetFile(url){
  const pathname=decodeURIComponent(new URL(url,'http://127.0.0.1:8000').pathname);
  const resolved=path.resolve(frontend,'.'+pathname);
  assert.ok(resolved.startsWith(frontend+path.sep),`asset must stay in frontend: ${url}`);
  return resolved;
}
function sourceFile(source){
  const filename=path.basename(new URL(source,'http://fixture.invalid/').pathname);
  assert.match(filename,/^[a-z0-9-]+\.js$/);return path.join(frontend,'assets',filename);
}
function filePreview(){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'Glow Nuture media ')),directory=path.join(temporary,'Preview Files');
  fs.symlinkSync(frontend,directory,process.platform==='win32'?'junction':'dir');
  return {directory,close(){
    assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
    fs.rmSync(temporary,{recursive:true,force:true});
  }};
}
function renderedURL(canonical,documentURL,standalone=false){
  const prefix=standalone?'../':'./';return new URL(prefix+canonical.slice(1),documentURL).href;
}
function memoryStorage(){
  const values=new Map();return {get length(){return values.size;},key:index=>Array.from(values.keys())[index]??null,getItem:key=>values.get(String(key))??null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),clear:()=>values.clear()};
}
function jpegSize(filename){
  const bytes=fs.readFileSync(filename);assert.equal(bytes.readUInt16BE(0),0xffd8,filename);
  for(let offset=2;offset<bytes.length;){
    if(bytes[offset++]!==0xff)continue;
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xd8||marker===0xd9||marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
    const length=bytes.readUInt16BE(offset);
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {width:bytes.readUInt16BE(offset+5),height:bytes.readUInt16BE(offset+3)};
    offset+=length;
  }
  throw new Error('JPEG dimensions missing: '+filename);
}
function webpSize(filename){
  const bytes=fs.readFileSync(filename);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  for(let offset=12;offset+8<=bytes.length;){
    const kind=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),data=offset+8;
    if(kind==='VP8 ')return {width:bytes.readUInt16LE(data+6)&0x3fff,height:bytes.readUInt16LE(data+8)&0x3fff};
    if(kind==='VP8X')return {width:bytes.readUIntLE(data+4,3)+1,height:bytes.readUIntLE(data+7,3)+1};
    if(kind==='VP8L'){const dimensions=bytes.readUInt32LE(data+1);return {width:(dimensions&0x3fff)+1,height:((dimensions>>>14)&0x3fff)+1};}
    offset=data+length+(length%2);
  }
  throw new Error('WebP dimensions missing: '+filename);
}
async function setup({hash='#/',url='http://127.0.0.1:8000/',api='offline',saved=null,products=null,reduced=false,user=null,wait=180}={}){
  const errors=[],requests=[],scrolls=[],deferred=new Map(),media={loads:0,plays:0,pauses:0},vc=new VirtualConsole();
  vc.on('jsdomError',error=>errors.push(error));vc.on('error',error=>errors.push(error));
  const dom=new JSDOM(fs.readFileSync(path.join(frontend,'index.html'),'utf8'),{url:new URL(hash,url).href,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
  if(w.location.protocol==='file:')Object.defineProperty(w,'localStorage',{value:memoryStorage()});
  w.scrollTo=(...coordinates)=>scrolls.push(coordinates);w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLMediaElement.prototype.load=function(){media.loads++;};
  w.HTMLMediaElement.prototype.play=function(){media.plays++;return Promise.resolve();};
  w.HTMLMediaElement.prototype.pause=function(){media.pauses++;};
  w.matchMedia=query=>({matches:query.includes('prefers-reduced-motion')&&reduced,addEventListener(){},removeEventListener(){}});
  w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.AbortSignal.timeout=AbortSignal.timeout;w.crypto.randomUUID=require('node:crypto').randomUUID;w.prompt=()=>null;w.confirm=()=>false;
  if(saved)w.localStorage.setItem('gn_state_v3',JSON.stringify(saved));
  w.fetch=async(url,options={})=>{
    const body=typeof options.body==='string'?JSON.parse(options.body):null;
    requests.push({url:String(url),method:options.method||'GET',body});
    if(api==='pending')return new Promise(()=>{});
    if(api==='deferred'&&(url==='/api/config'||url==='/api/auth/me'))return new Promise(resolve=>deferred.set(String(url),resolve));
    if(api==='offline')throw new TypeError('Fixture API unavailable');
    let data={};
    if(url==='/api/config')data={brand:{},seller:{},shipping:{},checkoutEnabled:false,payments:{},firebase:{enabled:false},analyticsEnabled:false};
    else if(url==='/api/auth/me')data=user;
    else if(url==='/api/auth/csrf')data={authenticated:Boolean(user)};
    else if(url==='/api/customer/state')data={cart:[],wishlist:[],comparison:[]};
    else if(url==='/api/orders/me'||String(url).includes('/reviews'))data=[];
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  };
  const scripts=Array.from(w.document.querySelectorAll('script[src]'),script=>script.getAttribute('src'));
  for(const source of scripts){
    w.eval(fs.readFileSync(sourceFile(source),'utf8'));
    if(source.endsWith('/local-catalog.js')&&products)w.GNLocalCatalog=products;
  }
  if(wait)await pause(wait);
  return {w,dom,errors,requests,media,scrolls,resolveApi:(url,data)=>{
    assert.ok(deferred.has(url),'No pending request for '+url);
    deferred.get(url)(new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}}));deferred.delete(url);
  },close:()=>dom.window.close(),route:async route=>{w.location.hash=route;await pause(160);}};
}
function noErrors(s){assert.equal(s.errors.length,0,s.errors.map(error=>error.stack||error.message).join('\n'));}
function noCatalogRequest(s){assert.equal(s.requests.some(request=>/^\/api\/(products(?:\/|$)|catalog\/ordinary)/.test(request.url)),false,JSON.stringify(s.requests));}
function cards(s){return Array.from(s.w.document.querySelectorAll('#app .pcard[data-id]'));}
function noPurchase(root){
  assert.equal(root.querySelector('[data-action="add"],[data-action="buy-now"],.price-now,.pcard-stock,.pd-price'),null);
  assert.doesNotMatch(root.textContent,/Out of stock|In stock|Key ingredients|৳0|Add to bag|Buy now/i);
}

test('local manifest has 101 unique JPEGs with real dimensions and four renamed MP4s',()=>{
  const {products,videos}=manifest();assert.equal(products.length,101);assert.equal(videos.length,4);
  assert.equal(new Set(products.map(product=>product.id)).size,101);
  assert.equal(new Set(products.map(product=>product.slug)).size,101);
  assert.equal(new Set(products.map(product=>product.image_url)).size,101);
  assert.equal(new Set(products.map(product=>product.original_filename)).size,101);
  for(const product of products){
    assert.match(product.id,/^local-[a-z0-9-]+$/);assert.equal(product.source,'local');assert.equal(product.displayOnly,true);
    assert.match(product.image_url,/^\/assets\/image\/[a-z0-9-]+\.jpg$/);
    assert.ok(product.name.trim());assert.ok(product.description.trim());assert.equal(product.short,product.description);
    assert.equal(typeof product.original_filename,'string');assert.ok(product.original_filename.length>0);assert.doesNotMatch(product.description,/\.jpg$/i);
    const dimensions=jpegSize(assetFile(product.image_url));
    const asset=product.image_assets.find(asset=>asset.url===product.image_url);assert.ok(asset,product.image_url);
    assert.deepEqual({width:asset.width,height:asset.height},dimensions,product.image_url);
    assert.equal(product.apiId,undefined);
  }
  const extensionless=products.filter(product=>!/\.jpg$/i.test(product.original_filename));assert.equal(extensionless.length,1);assert.ok(extensionless[0].description.length>8);
  for(const product of products.filter(product=>/^\d+\.jpg$/i.test(product.original_filename)))assert.doesNotMatch(product.description,/^\d+$/);
  for(const source of videos){assert.match(source,/^\/assets\/videos\/[a-z0-9-]+\.mp4$/);assert.ok(fs.statSync(assetFile(source)).size>0);}
  assert.equal(new Set(videos).size,4);
  assert.equal(fs.existsSync(path.join(frontend,'assets/apk')),false);
  assert.equal(fs.existsSync(path.join(frontend,'assets/video bg')),false);
});

test('local manifest is loaded before the application and the existing motion engine',()=>{
  const dom=new JSDOM(fs.readFileSync(path.join(frontend,'index.html'),'utf8'));
  try{
    const scripts=Array.from(dom.window.document.querySelectorAll('script[src]'));
    const find=name=>scripts.findIndex(script=>new URL(script.getAttribute('src'),'https://glownuture.example/').pathname.endsWith('/'+name));
    assert.ok(find('media-paths.js')>=0);assert.ok(find('media-paths.js')<find('local-catalog.js'));assert.ok(find('local-catalog.js')<find('app.js'));assert.ok(find('app.js')<find('glow-motion.js'));
    assert.equal(scripts[find('local-catalog.js')].defer,true);
  }finally{dom.window.close();}
});

test('Home and Shop render every local card before indefinitely pending API requests finish',async()=>{
  for(const hash of ['#/','#/shop']){
    const s=await setup({hash,api:'pending',wait:0});
    try{
      const collection=hash==='#/'?Array.from(s.w.document.querySelectorAll('[data-local-collection] .pcard[data-id]')):cards(s);
      assert.equal(collection.length,101,hash);assert.equal(new Set(cards(s).map(card=>card.dataset.id)).size,101);
      assert.equal(s.w.document.querySelector('[data-action="load-more"],[data-action="retry-catalog"]'),null);
      assert.doesNotMatch(s.w.document.getElementById('app').textContent,/Request failed|Try again|Retry catalog|Product catalog loading/i);
      noCatalogRequest(s);noErrors(s);
    }finally{s.close();}
  }
});

test('images, responsive candidates, fallbacks and all videos resolve beside the actual frontend entry point',async()=>{
  const preview=filePreview(),original=manifest();
  try{
    const documents=['http://127.0.0.1:8000/','http://127.0.0.1:8000/project/frontend/index.html',pathToFileURL(path.join(frontend,'index.html')).href,pathToFileURL(path.join(preview.directory,'index.html')).href];
    assert.ok(documents[3].includes('%20'));
    for(const url of documents){
      const s=await setup({url,api:'pending',wait:0});
      try{
        const collection=Array.from(s.w.document.querySelectorAll('[data-local-collection] .pcard[data-id]'));assert.equal(collection.length,101,url);
        for(const card of collection){
          const product=original.products.find(product=>product.id===card.dataset.id),image=card.querySelector('img');assert.equal(image.src,renderedURL(product.image_url,url),url);
          if(url.startsWith('file:'))assert.ok(fs.existsSync(fileURLToPath(image.src)),image.src);
        }
        const [product,alternate]=original.products,asset=product.image_assets[0],second=alternate.image_assets[0],host=s.w.document.createElement('div');
        host.innerHTML=s.w.GNStore.productImage({...product,images:[alternate.image_url],image_assets:[{...asset,variants:[{url:product.image_url,width:asset.width},{url:alternate.image_url,width:second.width}]}]});s.w.document.body.append(host);
        const image=host.querySelector('img'),candidates=image.srcset.split(',').map(candidate=>candidate.trim().split(/\s+/));assert.equal(candidates.length,2);
        for(const [source,width] of candidates){const canonical=Number.parseInt(width,10)===asset.width?product.image_url:alternate.image_url;assert.equal(new URL(source,url).href,renderedURL(canonical,url));}
        image.dispatchEvent(new s.w.Event('error'));assert.equal(image.src,renderedURL(alternate.image_url,url));image.dispatchEvent(new s.w.Event('error'));assert.equal(image.src,renderedURL('/assets/no-image.svg',url));
        if(url.startsWith('file:'))assert.ok(fs.existsSync(fileURLToPath(image.src)),image.src);
        const video=s.w.document.querySelector('[data-hero-background-video]');
        for(let index=0;index<original.videos.length;index++){
          assert.equal(video.src,renderedURL(original.videos[index],url),url);
          if(url.startsWith('file:'))assert.ok(fs.existsSync(fileURLToPath(video.src)),video.src);
          video.dispatchEvent(new s.w.Event('ended'));
        }
        await until(()=>s.w.document.querySelector('.gn-ba-day img')&&s.w.document.querySelectorAll('.gn-story-art img.gn-art').length===3);
        for(const [selector,source] of [['.gn-ba-day img','/assets/image/glownuture_morning.webp'],['.gn-ba-night img','/assets/image/glownuture_night.webp']]){
          const image=s.w.document.querySelector(selector),dimensions=webpSize(assetFile(source));assert.equal(image.src,renderedURL(source,url));assert.equal(image.width,dimensions.width);assert.equal(image.height,dimensions.height);
          if(url.startsWith('file:'))assert.ok(fs.existsSync(fileURLToPath(image.src)),image.src);
        }
        for(const image of s.w.document.querySelectorAll('.gn-story-art img.gn-art')){
          const source=original.products.find(product=>renderedURL(product.image_url,url)===image.src);assert.ok(source,image.src);
          if(url.startsWith('file:'))assert.ok(fs.existsSync(fileURLToPath(image.src)),image.src);
        }
        assert.deepEqual(JSON.parse(JSON.stringify(s.w.GNLocalCatalog)),original.products);assert.deepEqual(Array.from(s.w.GNLocalVideos),original.videos);noCatalogRequest(s);noErrors(s);
      }finally{s.close();}
    }
  }finally{preview.close();}
});

test('category, story and journal artwork use bundled photographs while functional icons remain',async()=>{
  const original=manifest(),s=await setup({api:'pending'});
  try{
    await until(()=>s.w.document.querySelectorAll('.gn-story-art img.gn-art').length===3);
    const categorySlots=Array.from(s.w.document.querySelectorAll('.cat-grid > *'));assert.ok(categorySlots.length>=6);
    for(const slot of categorySlots){assert.ok(slot.querySelector('img.gn-product-image'));assert.equal(slot.querySelector('svg[viewBox="0 0 240 300"]'),null);}
    const story=Array.from(s.w.document.querySelectorAll('.gn-story-art img.gn-art'));
    assert.deepEqual(story.map(image=>new URL(image.src).pathname),['/assets/image/cosrx-low-ph-good-morning-gel-cleanser.jpg','/assets/image/the-ordinary-niacinamide-10-plus-zinc-1.jpg','/assets/image/beauty-of-joseon-relief-sun-spf50-plus-rice-plus-probiotics-sunscreen.jpg']);
    for(const image of story){const dimensions=jpegSize(assetFile(image.getAttribute('src')));assert.equal(image.width,dimensions.width);assert.equal(image.height,dimensions.height);assert.equal(image.getAttribute('loading'),'lazy');}
    assert.ok(s.w.document.querySelector('[data-action="open-cart"] svg'));assert.ok(s.w.document.querySelector('.pcard-wish svg'));
    s.w.GNConfig={...s.w.GNConfig,journalEnabled:true};await s.route('#/journal');
    const journalSlots=Array.from(s.w.document.querySelectorAll('.jcard .jc-art'));assert.ok(journalSlots.length>0);
    for(const slot of journalSlots){const image=slot.querySelector('img');assert.ok(image);assert.match(new URL(image.src).pathname,/^\/assets\/image\/[a-z0-9-]+\.jpg$/);assert.ok(fs.existsSync(assetFile(image.getAttribute('src'))));assert.equal(slot.querySelector('svg'),null);}
    assert.deepEqual(JSON.parse(JSON.stringify(s.w.GNLocalCatalog)),original.products);assert.equal(original.products.length,101);noErrors(s);
  }finally{s.close();}
});

test('morning and night reference photos keep their dimensions and slider keyboard and pointer controls',async()=>{
  const s=await setup({api:'pending'});
  try{
    await until(()=>s.w.document.querySelector('.gn-ba-handle'));
    const comparison=s.w.document.querySelector('.gn-ba'),handle=comparison.querySelector('[role="slider"]'),morning=comparison.querySelector('.gn-ba-day'),night=comparison.querySelector('.gn-ba-night');
    assert.match(morning.textContent,/Morning/);assert.match(night.textContent,/Night/);
    for(const [pane,source] of [[morning,'/assets/image/glownuture_morning.webp'],[night,'/assets/image/glownuture_night.webp']]){
      const dimensions=webpSize(assetFile(source)),image=pane.querySelector('img');assert.deepEqual(dimensions,{width:1200,height:1200});assert.equal(new URL(image.src).pathname,source);assert.equal(image.width,dimensions.width);assert.equal(image.height,dimensions.height);assert.equal(image.getAttribute('loading'),'lazy');
    }
    assert.equal(handle.getAttribute('tabindex'),'0');assert.equal(handle.getAttribute('aria-valuemin'),'0');assert.equal(handle.getAttribute('aria-valuemax'),'100');assert.equal(handle.getAttribute('aria-valuenow'),'50');
    const key=(value,expected)=>{handle.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));assert.equal(handle.getAttribute('aria-valuenow'),String(expected));assert.equal(comparison.style.getPropertyValue('--pos'),expected+'%');};
    key('ArrowRight',55);key('ArrowLeft',50);key('End',100);key('ArrowRight',100);key('Home',0);key('ArrowLeft',0);
    let captured;comparison.setPointerCapture=id=>captured=id;comparison.getBoundingClientRect=()=>({left:100,width:400,right:500,top:0,bottom:300,height:300});
    const pointer=(type,clientX)=>{const event=new s.w.MouseEvent(type,{clientX,bubbles:true});Object.defineProperty(event,'pointerId',{value:7});comparison.dispatchEvent(event);};
    pointer('pointerdown',200);assert.equal(captured,7);assert.equal(handle.getAttribute('aria-valuenow'),'25');pointer('pointermove',440);assert.equal(handle.getAttribute('aria-valuenow'),'85');pointer('pointerup',440);pointer('pointermove',100);assert.equal(handle.getAttribute('aria-valuenow'),'85');
    pointer('pointerdown',600);assert.equal(handle.getAttribute('aria-valuenow'),'100');pointer('pointercancel',600);pointer('pointermove',200);assert.equal(handle.getAttribute('aria-valuenow'),'100');
    assert.equal(s.w.GNStore.store.products().length,101);assert.equal(s.w.GNStore.store.products().some(product=>/glownuture_(morning|night)\.webp$/.test(product.image_url)),false);noErrors(s);
  }finally{s.close();}
});

test('failed APIs cannot erase the local catalog or display catalog retry banners',async()=>{
  const s=await setup({hash:'#/shop'});
  try{
    await s.w.GNStore.syncProducts();s.w.GNStore.render();await pause(90);
    assert.equal(cards(s).length,101);assert.equal(s.w.GNStore.store.products().length,101);
    assert.equal(s.w.document.querySelector('[data-action="retry-catalog"]'),null);
    assert.doesNotMatch(s.w.document.getElementById('app').textContent,/Request failed|Try again|Retry catalog/i);
    noCatalogRequest(s);noErrors(s);
  }finally{s.close();}
});

test('optional API completion preserves Home scroll and the currently playing video',async()=>{
  const s=await setup({api:'deferred'});
  try{
    const video=s.w.document.querySelector('[data-hero-background-video]');assert.ok(video);assert.equal(new Set(cards(s).map(card=>card.dataset.id)).size,101);
    video.dispatchEvent(new s.w.Event('ended'));video.currentTime=7;
    Object.defineProperty(s.w,'scrollY',{value:640,configurable:true});s.w.dispatchEvent(new s.w.Event('scroll'));
    const source=video.getAttribute('src'),scrollCalls=s.scrolls.length,plays=s.media.plays,loads=s.media.loads;
    s.resolveApi('/api/config',{brand:{},seller:{},shipping:{},checkoutEnabled:false,payments:{},firebase:{enabled:false},analyticsEnabled:false});
    s.resolveApi('/api/auth/me',null);await s.w.GNConfigReady;await pause(50);
    assert.equal(s.w.document.querySelector('[data-hero-background-video]'),video);assert.equal(video.getAttribute('src'),source);assert.equal(video.currentTime,7);
    assert.equal(s.scrolls.length,scrollCalls);assert.equal(s.w.scrollY,640);assert.equal(s.media.plays,plays);assert.equal(s.media.loads,loads);
    assert.equal(new Set(cards(s).map(card=>card.dataset.id)).size,101);noCatalogRequest(s);noErrors(s);
  }finally{s.close();}
});

test('the complete Home collection remains vertical and reveals each card independently',async()=>{
  const s=await setup({api:'pending'});
  try{
    await until(()=>Array.from(s.w.document.querySelectorAll('[data-local-collection] .pcard')).every(card=>card.dataset.fx==='stagger'));
    const grid=s.w.document.querySelector('[data-local-collection]');assert.ok(grid);assert.equal(grid.closest('.gn-hs'),null);
    assert.equal(grid.closest('.section').hasAttribute('data-fx'),false);assert.equal(grid.classList.contains('gn-hs-track'),false);noErrors(s);
  }finally{s.close();}
});

test('local cards display filename descriptions and reserve image space without purchase claims',async()=>{
  const s=await setup({hash:'#/shop',api:'pending'});
  try{
    const products=manifest().products;
    await until(()=>cards(s).every(card=>card.dataset.fx==='stagger'));
    for(const card of cards(s)){
      const product=products.find(product=>product.id===card.dataset.id),image=card.querySelector('img');assert.ok(product);
      assert.equal(new URL(image.src).pathname,product.image_url);assert.equal(image.alt,product.description);
      const dimensions=jpegSize(assetFile(product.image_url));assert.equal(image.width,dimensions.width);assert.equal(image.height,dimensions.height);
      assert.equal(image.getAttribute('decoding'),'async');assert.ok(['eager','lazy'].includes(image.getAttribute('loading')));
      assert.ok(card.textContent.includes(product.description));assert.equal(card.dataset.fx,'stagger');noPurchase(card);
      assert.equal(s.w.GNStore.store.addToCart(product.id,1).ok,false);
    }
    assert.ok(s.w.document.querySelectorAll('.pcard img[loading="lazy"]').length>=97);assert.ok(s.w.document.querySelectorAll('.pcard img[loading="eager"]').length<=4);
    assert.equal(s.w.GNStore.store.cartLines().length,0);assert.equal(s.w.GNStore.quoteItems().length,0);noCatalogRequest(s);noErrors(s);
  }finally{s.close();}
});

test('local search, quick view, details and Ordinary collection use the same bundled images',async()=>{
  const products=manifest().products,product=products.find(product=>product.brand==='The Ordinary')||products.find(product=>/ordinary/i.test(product.name));assert.ok(product);
  const s=await setup({hash:'#/search?q='+encodeURIComponent(product.name)});
  try{
    assert.ok(cards(s).some(card=>card.dataset.id===product.id));
    s.w.document.querySelector('[data-action="quick"][data-id="'+product.id+'"]').click();await pause(25);
    const modal=s.w.document.getElementById('modalBox');assert.ok(modal.textContent.includes(product.description));assert.equal(new URL(modal.querySelector('img').src).pathname,product.image_url);noPurchase(modal);
    await s.route('#/p/'+product.slug);
    const app=s.w.document.getElementById('app'),image=app.querySelector('#pdMain img');assert.ok(image);assert.equal(new URL(image.src).pathname,product.image_url);assert.equal(image.getAttribute('loading'),'eager');assert.ok(app.textContent.includes(product.description));noPurchase(app);
    await s.route('#/ordinary');
    const expected=products.filter(product=>/(?:the[\s_-]*)?ordinary/i.test([product.brand,product.name].join(' ')));
    assert.equal(cards(s).length,expected.length);assert.ok(cards(s).some(card=>card.dataset.id===product.id));noPurchase(s.w.document.getElementById('app'));
    noCatalogRequest(s);noErrors(s);
  }finally{s.close();}
});

test('local wishlist, comparison and recently viewed IDs survive reload without entering account writes',async()=>{
  const [product]=manifest().products,saved={cart:[{id:product.id,qty:1}],wishlist:[product.id],comparison:[product.id],recent:[product.id]};
  const user={id:99,name:'Fixture Customer',role:'customer',preferences:{},addresses:[],email:'fixture@example.com'};
  const s=await setup({hash:'#/shop',api:'online',user,saved});let persisted;
  try{
    const store=s.w.GNStore.store;assert.ok(store.state.wishlist.includes(product.id));assert.ok(store.state.comparison.includes(product.id));assert.ok(store.state.recent.includes(product.id));assert.equal(store.cartLines().length,0);
    store.toggleWish(product.id);store.toggleWish(product.id);store.pushRecent(product.id);store.persist();await pause(820);
    persisted=JSON.parse(s.w.localStorage.getItem('gn_state_v3'));
    assert.ok(persisted.wishlist.includes(product.id));assert.ok(persisted.comparison.includes(product.id));assert.ok(persisted.recent.includes(product.id));
    for(const request of s.requests.filter(request=>request.method!=='GET'))assert.equal(JSON.stringify(request.body).includes('local-'),false,request.url);
    assert.equal(s.w.GNStore.quoteItems().length,0);await s.route('#/compare');assert.ok(s.w.document.getElementById('app').textContent.includes(product.description));noPurchase(s.w.document.getElementById('app'));noErrors(s);
  }finally{s.close();}
  const restored=await setup({hash:'#/wishlist',saved:persisted});
  try{assert.ok(cards(restored).some(card=>card.dataset.id===product.id));assert.ok(restored.w.GNStore.store.state.comparison.includes(product.id));assert.ok(restored.w.GNStore.store.state.recent.includes(product.id));noErrors(restored);}finally{restored.close();}
});

test('a missing local image falls back once without an inline event handler',async()=>{
  const s=await setup({hash:'#/shop'});
  try{
    const image=cards(s)[0].querySelector('img');image.dispatchEvent(new s.w.Event('error'));assert.equal(new URL(image.src).pathname,'/assets/no-image.svg');
    image.dispatchEvent(new s.w.Event('error'));assert.equal(new URL(image.src).pathname,'/assets/no-image.svg');assert.equal(image.hasAttribute('onerror'),false);assert.equal(image.hasAttribute('srcset'),false);noErrors(s);
  }finally{s.close();}
});

test('local filename metadata stays escaped and unsafe image URLs cannot execute',async()=>{
  for(const image_url of ['javascript:alert(1)',pathToFileURL(path.join(frontend,'assets/image',path.basename(manifest().products[0].image_url))).href]){
    const product={...manifest().products[0],name:'<img src=x onerror=alert(1)>',description:'<script>alert(1)</script>',short:'<script>alert(1)</script>',image_url,images:[],image_assets:[]};
    const s=await setup({hash:'#/shop',products:[product]});
    try{
      const app=s.w.document.getElementById('app');assert.equal(app.querySelector('script,[onerror],[onload]'),null);assert.ok(app.textContent.includes(product.name));assert.ok(app.textContent.includes(product.description));assert.equal(new URL(app.querySelector('.pcard img').src).pathname,'/assets/no-image.svg');noErrors(s);
    }finally{s.close();}
  }
});

test('hero uses one muted video and cycles through all four local sources',async()=>{
  const s=await setup({api:'pending'});
  try{
    const videos=s.w.document.querySelectorAll('[data-hero-background-video]');assert.equal(videos.length,1);const video=videos[0],playlist=video.dataset.videoPlaylist.split('|');
    assert.deepEqual(playlist,manifest().videos);assert.equal(video.hasAttribute('muted'),true);assert.equal(video.hasAttribute('autoplay'),true);assert.equal(video.hasAttribute('playsinline'),true);assert.equal(video.getAttribute('preload'),'metadata');
    for(let index=1;index<=playlist.length;index++){video.dispatchEvent(new s.w.Event('ended'));assert.equal(video.getAttribute('src'),playlist[index%playlist.length]);}
    assert.equal(s.media.loads,4);noErrors(s);
  }finally{s.close();}
});

test('video errors advance sources but stop retrying after every bundled clip fails',async()=>{
  const s=await setup({api:'pending'});
  try{
    const video=s.w.document.querySelector('[data-hero-background-video]'),sources=new Set([video.getAttribute('src')]);
    for(let index=0;index<4;index++){video.dispatchEvent(new s.w.Event('error'));sources.add(video.getAttribute('src'));}
    assert.equal(sources.size,4);const loads=s.media.loads;
    for(let index=0;index<8;index++)video.dispatchEvent(new s.w.Event('error'));
    assert.equal(s.media.loads,loads);assert.ok(loads<=4);noErrors(s);
  }finally{s.close();}
});

test('reduced motion prevents video rotation and keeps the local collection available',async()=>{
  const s=await setup({api:'pending',reduced:true});
  try{
    const video=s.w.document.querySelector('[data-hero-background-video]');assert.ok(s.media.pauses>0);const source=video.getAttribute('src'),loads=s.media.loads;
    video.dispatchEvent(new s.w.Event('ended'));video.dispatchEvent(new s.w.Event('error'));assert.equal(video.getAttribute('src'),source);assert.equal(s.media.loads,loads);assert.equal(new Set(cards(s).map(card=>card.dataset.id)).size,101);noErrors(s);
  }finally{s.close();}
});

test('standalone Ordinary catalog loads local images without fetching a provider or requiring API credentials',async()=>{
  const products=manifest().products.filter(product=>/(?:the[\s_-]*)?ordinary/i.test([product.brand,product.name].join(' '))),filename=path.join(frontend,'catalog/index.html'),preview=filePreview();
  try{for(const url of ['http://127.0.0.1:8000/ordinary-catalog','http://127.0.0.1:8000/project/frontend/catalog/index.html',pathToFileURL(filename).href,pathToFileURL(path.join(preview.directory,'catalog/index.html')).href]){
    const requests=[],errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));
    const dom=new JSDOM(fs.readFileSync(filename,'utf8'),{url,runScripts:'outside-only',virtualConsole:vc}),w=dom.window;
    try{
      w.fetch=async url=>{requests.push(url);throw new TypeError('API unavailable');};
      for(const script of w.document.querySelectorAll('script')){if(script.src)w.eval(fs.readFileSync(sourceFile(script.getAttribute('src')),'utf8'));else w.eval(script.textContent);}
      await pause(25);const articles=Array.from(w.document.querySelectorAll('#products article'));assert.equal(articles.length,products.length);assert.ok(articles.length>0);assert.equal(requests.length,0);
      for(const product of products){
        const article=articles.find(article=>article.querySelector('.description')?.textContent===product.description),asset=product.image_assets[0];assert.ok(article,product.id);
        const image=article.querySelector('img');assert.equal(image.src,renderedURL(product.image_url,url,true));assert.equal(image.width,asset.width);assert.equal(image.height,asset.height);noPurchase(article);
        if(url.startsWith('file:'))assert.ok(fs.existsSync(fileURLToPath(image.src)),image.src);
      }
      const image=articles[0].querySelector('img');image.dispatchEvent(new w.Event('error'));assert.equal(image.src,renderedURL('/assets/no-image.svg',url,true));image.dispatchEvent(new w.Event('error'));assert.match(image.src,/^data:image\/svg\+xml/);assert.equal(image.onerror,null);
      assert.equal(w.document.querySelector('#retry:not([hidden])'),null);assert.equal(errors.length,0,errors.map(error=>error.message).join('\n'));
    }finally{w.close();}
  }}finally{preview.close();}
});
