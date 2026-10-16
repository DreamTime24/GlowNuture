/* Owner review, persistent media and supplier jobs extend the existing GlowNuture admin. */
(() => {
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'৳'+Number(v||0).toLocaleString('en-BD',{maximumFractionDigits:2});
const field=(n,l,v='',type='text',attrs='')=>'<label>'+esc(l)+'<input name="'+n+'" type="'+type+'" value="'+esc(v)+'" '+attrs+'></label>';
const area=(n,l,v='',attrs='')=>'<label>'+esc(l)+'<textarea name="'+n+'" '+attrs+'>'+esc(v)+'</textarea></label>';
const check=(n,l,on=false)=>'<label class="gn-checkbox"><input name="'+n+'" type="checkbox" '+(on?'checked':'')+'><span>'+esc(l)+'</span></label>';
const select=(n,l,rows,value='')=>'<label>'+esc(l)+'<select name="'+n+'">'+rows.map(r=>'<option value="'+esc(r[0])+'" '+(String(value)===String(r[0])?'selected':'')+'>'+esc(r[1])+'</option>').join('')+'</select></label>';
const btn=(action,label,id='',extra='')=>'<button type="button" class="btn btn-outline btn-sm" data-catalog-action="'+action+'" data-id="'+esc(id)+'" '+extra+'>'+esc(label)+'</button>';
const status=s=>'<span class="gc-status" data-state="'+esc(s)+'">'+esc(String(s||'DRAFT').replaceAll('_',' '))+'</span>';
const note=s=>'<p class="ga-note">'+esc(s)+'</p>';
const form=(kind,title,body,id='')=>'<form class="ga-form gc-form" data-catalog-form="'+kind+'" data-id="'+esc(id)+'"><h3>'+esc(title)+'</h3><div class="gn-grid-form">'+body+'</div><button class="btn btn-primary" type="submit">Save / submit</button><div class="ga-err" role="alert"></div></form>';
const table=(head,rows)=>'<div class="ga-wrap"><table class="ga-table"><thead><tr>'+head.map(v=>'<th scope="col">'+v+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+(rows.length?'':'<tr><td colspan="'+head.length+'">No records in this view.</td></tr>')+'</tbody></table></div>';
const reviewKeys={authenticity:'Genuine product inspected',supplier:'Supplier and purchase evidence checked',source_rights:'Catalog source reuse terms checked',identity:'Name, brand, size and variant match',image_match:'Every image matches this physical product',image_rights:'Image reuse rights and attribution recorded',description:'Description and claims checked',ingredients:'Ingredients / INCI checked against label',instructions_warnings:'Instructions and warnings checked',condition:'Condition inspected: new or sealed',expiry:'Expiry / batches inspected',inventory:'Actual physical stock confirmed',bdt_price:'Actual BDT selling price confirmed',sku_category:'SKU, category and required information checked'};
const state={tab:'',data:{},user:null,dirty:false,poll:null};
const get=path=>GNApi.get('/api/admin/'+path);
const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
const owner=()=>['super_admin','admin'].includes(state.user?.role);
const uuid=()=>{const b=new Uint8Array(16);crypto.getRandomValues(b);return Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');};
async function load(tab){
  clearTimeout(state.poll);state.tab=tab;
  if(tab==='approval'){
    const p=params(),id=Number(p.get('id'));
    if(id>0){const [detail,suppliers,sources]=await Promise.all([get('products/'+id+'/approval'),get('suppliers'),get('products/'+id+'/sources')]);return {detail,suppliers,sources};}
    const query=new URLSearchParams({state:p.get('state')||'',q:p.get('q')||'',offset:p.get('offset')||'0'});
    return {queue:await get('approval-queue?'+query)};
  }
  if(tab==='operations')return {operations:await get('operations')};
  const [sources,jobs,duplicates]=await Promise.all([get('catalog/sources'),get('catalog/jobs'),get('catalog/duplicates')]);return {sources,jobs,duplicates};
}
function queue(data){
  const p=params(),rows=data.queue?.items||[];
  return '<div class="gc-intro"><span class="gc-eyebrow">CATALOG STUDIO</span><h2>Every detail, thoughtfully verified.</h2><p>Draft → Needs review → Verified → Published. The server checks the saved revision at every step.</p></div>'+
    form('filter','Find products',field('q','Name or SKU',p.get('q')||'')+select('state','State',[['','All states'],...['DRAFT','NEEDS_REVIEW','VERIFIED','PUBLISHED','REJECTED','ARCHIVED'].map(v=>[v,v.replaceAll('_',' ')])],p.get('state')||''))+
    table(['Product','BDT / stock','State','Review'],rows.map(r=>['<strong>'+esc(r.name)+'</strong><small class="gc-sub">'+esc(r.sku)+' · '+esc(r.brand)+'</small>',money(r.price)+'<small class="gc-sub">'+esc(r.stock)+' units</small>',status(r.publication_state)+(r.legacy_approved?'<small class="gc-sub">Existing live record · review recommended</small>':''),'<a class="btn btn-outline btn-sm" href="#/admin/approval?id='+r.id+'">Inspect #'+r.id+'</a>']))+
    '<div class="ga-tools"><a class="btn btn-outline" href="#/admin/products">Product editor</a>'+(Number(p.get('offset'))>0?'<a class="btn btn-outline" href="#/admin/approval?'+new URLSearchParams({state:p.get('state')||'',q:p.get('q')||'',offset:Math.max(0,Number(p.get('offset'))-40)})+'">Previous</a>':'')+(data.queue?.next_offset!==null?'<a class="btn btn-outline" href="#/admin/approval?'+new URLSearchParams({state:p.get('state')||'',q:p.get('q')||'',offset:data.queue.next_offset})+'">Next page</a>':'')+'</div>';
}
function rightsFields(asset={}){
  return field('rights_holder','Photographer / rights holder',asset.rights_holder||'','text','required maxlength="200"')+field('license','License or written permission',asset.license||'','text','required maxlength="200"')+area('evidence','Permission evidence / attribution / source page',asset.evidence||'','required minlength="10" maxlength="2000"')+check('redistribution_allowed','I verified permission to store, resize and display this image',asset.redistribution_allowed);
}
function detail(data){
  const d=data.detail,p=d.product,id=p.id,reviewer=owner(),canSubmit=['DRAFT','REJECTED'].includes(p.publication_state);
  const assets=d.media||[];
  const summary='<div class="gc-intro"><a href="#/admin/approval">← Review queue</a><h2>'+esc(p.name)+'</h2><div class="ga-tools">'+status(p.publication_state)+'<span>Revision '+p.revision+' · '+esc(p.sku)+'</span></div><p>'+esc(p.brand)+' · '+esc(p.size)+' · '+money(p.price)+' · '+p.stock+' unreserved units</p></div>';
  const checks='<section class="ga-card"><h3>Publication readiness</h3>'+(d.checks.length?'<ul class="gc-checks">'+d.checks.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':'<p>Technical checks passed for this saved revision. The owner still verifies authenticity, accuracy and rights.</p>')+btn('health','Check stored images',id)+' <a class="btn btn-outline btn-sm" href="#/admin/products">Edit product information</a><pre id="gcHealth" class="gc-json" role="status"></pre></section>';
  const preview='<section class="ga-card"><h3>Private image gallery</h3>'+note('Draft photographs are visible only to authorized staff. Choose a main image and gallery below; each photograph requires rights evidence.')+'<div class="gc-media">'+assets.map(a=>'<figure><img src="/api/admin/media/'+esc(a.id)+'/preview?size=small" width="320" height="320" loading="lazy" alt="Staff preview: '+esc(p.name)+'"><figcaption>'+esc(a.health)+' · '+a.width+' × '+a.height+'<small class="gc-sub">'+esc(a.rights_holder||'Rights not recorded')+'</small></figcaption></figure>').join('')+'</div>'+
    (assets.length?form('gallery','Choose displayed photographs',select('image_url','Main photograph',assets.map(a=>[a.url,a.id+' · '+a.width+'px']),p.image_url)+assets.map(a=>check('gallery_'+a.id,'Include '+a.id+' in gallery',(p.images||[]).includes(a.url))).join(''),id):'')+'</section>';
  const upload=form('upload','Upload your own / authorized photograph',field('file','JPEG, PNG or WebP · up to 5 MB','','file','accept="image/jpeg,image/png,image/webp" required')+rightsFields()+check('matches_product','This photograph matches the product and variant'),id);
  const remote=reviewer?'<details class="ga-card"><summary>Import a permitted image URL</summary>'+note('Copy only an image you are allowed to redistribute. External URLs are checked for unsafe networks and redirects; photos remain private until review.')+form('remote','Copy into managed media',field('url','Public HTTPS image URL','','url','required')+rightsFields()+check('matches_product','I checked that the image matches this product / variant'),id)+'</details>':'';
  const rights=reviewer&&assets.length?'<details class="ga-card"><summary>Correct image rights records</summary>'+assets.map(a=>form('rights','Rights for '+a.id,rightsFields(a),a.id)).join('')+'</details>':'';
  let workflow=canSubmit?btn('submit','Submit for owner review',id):'';
  if(reviewer&&p.publication_state==='NEEDS_REVIEW')workflow+=form('verify','Owner verification',select('supplier_id','Authorized supplier',data.suppliers.filter(v=>v.active).map(v=>[v.id,v.name]))+area('evidence','Inspection / supplier invoice evidence','','required minlength="10" maxlength="3000"')+Object.entries(reviewKeys).map(([k,v])=>check(k,v)).join(''),id);
  if(reviewer&&p.publication_state==='VERIFIED')workflow+=form('publish','Publish this verified revision',check('confirm_publish','As business owner / delegated admin, I authorize publication of revision '+p.revision),id);
  if(reviewer&&['NEEDS_REVIEW','VERIFIED'].includes(p.publication_state))workflow+=form('reject','Reject with a clear reason',area('reason','Reason','','required minlength="8"'),id);
  if(reviewer&&p.publication_state==='PUBLISHED')workflow+=form('unpublish','Withdraw from public catalog',area('reason','Reason','','required minlength="5"'),id);
  if(reviewer&&p.publication_state!=='ARCHIVED')workflow+='<details><summary>Archive this product</summary>'+form('archive','Archive and retain history',area('reason','Reason','','required minlength="5"'),id)+'</details>';
  if(reviewer&&p.publication_state==='ARCHIVED')workflow+=form('restore','Restore as draft',area('reason','Reason','','required minlength="5"'),id);
  const sources=(data.sources||[]).map(item=>'<details class="ga-card"><summary>Source #'+item.source_id+' · '+esc(item.external_id)+'</summary>'+note('External data is a candidate. Local BDT prices, stock, photos and verification are preserved.')+'<pre class="gc-json">'+esc(JSON.stringify(item.changes_json,null,2))+'</pre>'+form('apply','Apply selected metadata and restart review',Object.keys({name:1,en:1,brand:1,size:1,category:1,description:1,short:1,ingredients:1,usage:1,warnings:1,origin:1,gtin:1}).map(k=>check('copy_'+k,k)).join('')+area('reason','Reason','','required minlength="8"'),item.id)+'<h4>Source record / permitted image candidates</h4><pre class="gc-json">'+esc(JSON.stringify(item.snapshot_json,null,2))+'</pre></details>').join('');
  return summary+'<div class="gc-review-layout"><div>'+checks+preview+upload+remote+rights+sources+'</div><div class="gc-review-side"><section class="ga-card"><h3>Owner approval</h3>'+note('Saving product or variant content restarts review. Supplier data never sets your BDT price or inventory.')+workflow+'<div class="ga-err" id="gcActionError" role="alert"></div></section><section class="ga-card"><h3>Review history</h3><ol class="gc-history">'+d.history.map(e=>'<li><strong>'+esc(e.action)+'</strong> · r'+e.revision+'<small>'+esc(e.created_at)+' · staff #'+e.actor_user_id+'</small><p>'+esc(e.reason||e.evidence)+'</p></li>').join('')+'</ol></section></div></div>';
}
function sourcesView(data){
  const sources=data.sources||[];
  let sourceForm='';
  if(owner()){
    const selected=sources.find(v=>v.id===Number(params().get('source')))||{};
    sourceForm='<details class="ga-card" '+(selected.id?'open':'')+'><summary>'+ (selected.id?'Edit source #'+selected.id:'Register an authorized source')+'</summary>'+form('source','Source authorization',
      field('key','Unique source key',selected.key||'','text','required pattern="[a-z][a-z0-9-]{1,59}" '+(selected.id?'readonly':''))+field('name','Display name',selected.name||'','text','required')+
      select('kind','Type',[['file','Owner CSV / JSON'],['supplier_api','Authorized supplier API'],['ordinary','The Ordinary / Parse (rotated server key)'],['openbeautyfacts','Free Open Beauty Facts metadata']],selected.kind||'file')+
      field('endpoint','Supplier API HTTPS endpoint (supplier only)',selected.endpoint||'','url')+select('method','Supplier request method',[['GET','GET'],['POST','POST']],selected.method||'GET')+select('auth_header','Private credential header',[['X-API-Key','X-API-Key'],['Authorization','Authorization']],selected.auth_header||'X-API-Key')+
      field('credential',selected.credential_configured?'Credential configured · blank preserves it':'Supplier credential (optional)', '', 'password','autocomplete="new-password"')+field('license','Metadata license / reuse permission',selected.license||'')+area('attribution','Attribution / supplier permission reference',selected.attribution||'')+check('enabled','Source enabled',selected.enabled!==false)+check('owner_authorized','I authorize this source and have reviewed its metadata and image reuse terms'),selected.id||'')+btn('obf-prefill','Prefill free Open Beauty Facts terms')+note('Open Beauty Facts is community reference data, not proof of supply or BDT selling prices. Image reuse has separate attribution and share-alike terms. No API key is required for read requests.')+'<a href="https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/" target="_blank" rel="noopener noreferrer">Read upstream licenses</a></details>';
  }
  const sourceRows=table(['Source','Type / status','Credential','Action'],sources.map(s=>[esc(s.name)+'<small class="gc-sub">'+esc(s.key)+'</small>',esc(s.kind)+' · '+(s.enabled?'Enabled':'Disabled'),s.credential_configured?'Encrypted credential configured':s.kind==='ordinary'?'Server-side rotated key':s.kind==='openbeautyfacts'?'Free read API · no key':'No credential',owner()?'<a class="btn btn-outline btn-sm" href="#/admin/imports?source='+s.id+'">Edit</a>':'Owner managed']));
  const upload=sources.some(v=>v.kind==='file'&&v.enabled)?form('feed','Upload a catalog feed',select('source_id','Authorized file source',sources.filter(v=>v.kind==='file'&&v.enabled).map(v=>[v.id,v.name]))+field('file','UTF-8 CSV / JSON · 1 MB · 500 rows maximum','','file','accept=".csv,.json,text/csv,application/json" required')):note('Register an authorized file source before uploading CSV / JSON.');
  const api=sources.some(v=>v.kind!=='file'&&v.enabled)?form('job','Queue a paginated API import',select('source_id','Authorized API source',sources.filter(v=>v.kind!=='file'&&v.enabled).map(v=>[v.id,v.name]))+field('start','Offset (multiples of 12)',0,'number','min="0" max="10000" step="12" required')+field('pages','Pages (12 items per page)',1,'number','min="1" max="5" required')):'';
  return '<div class="gc-intro"><span class="gc-eyebrow">CONNECTED, WITH CARE</span><h2>Real sources. Local prices.</h2><p>Free reference data and authorized suppliers feed a private draft queue. Your actual stock and ৳ BDT prices stay under your control.</p></div>'+sourceRows+sourceForm+'<div class="ga-two">'+upload+api+'</div><section class="ga-card"><div class="ga-top"><h3>Import jobs</h3>'+btn('jobs-refresh','Refresh progress')+'</div><div id="gcJobs">'+jobsTable(data.jobs||[])+'</div><div id="gcJobsStatus" role="status"></div></section><details class="ga-card"><summary>Possible duplicate GTINs ('+(data.duplicates||[]).length+')</summary>'+note('Review the exact product and variant. Linking changes only the source mapping; it does not merge stock, delete products or rewrite orders.')+(data.duplicates||[]).map(d=>form('link','Source item #'+d.source_item_id+' · GTIN '+d.gtin,select('target','Target product',d.candidates.map(p=>[p.id+':'+p.revision,p.sku+' · '+p.name]))+area('reason','Why these records refer to the same product','','required minlength="10"')+check('confirmed','I checked the target identity; retain all existing records'),d.source_item_id)).join('')+'</details>';
}
function jobsTable(jobs){
  return table(['Job / source','Status','Progress','Counts / action'],jobs.map(j=>['<code>'+esc(j.id)+'</code><small class="gc-sub">Source #'+j.source_id+' · '+esc(j.created_at)+'</small>',status(j.status)+(j.error?'<p class="ga-err">'+esc(j.error)+'</p>':''),j.pages_done+' / '+j.pages+' pages · next offset '+j.cursor,Object.entries(j.counts_json||{}).map(([k,v])=>esc(k)+': '+v).join(' · ')+(j.status==='failed'?btn('retry','Retry failed job',j.id):'')]));
}
function operations(data){
  const o=data.operations,now=Date.now(),heartbeats=o.heartbeats||[];
  return '<div class="gc-intro"><span class="gc-eyebrow">STORE OPERATIONS</span><h2>Know what is actually running.</h2><p>Database-backed worker heartbeats and recorded failures. Missing / old workers need attention.</p></div><div class="ga-grid">'+[['Checkout',o.checkout_enabled?'Enabled':'Disabled'],['Failed imports',o.failed_import_jobs],['Notification issues',o.failed_notifications],['Media issues',o.broken_media]].map(([k,v])=>'<div class="ga-card"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join('')+'</div>'+table(['Worker','Last heartbeat','Health'],['catalog-worker','notification-worker'].map(key=>{const h=heartbeats.find(v=>v.key===key),stamp=h?Date.parse(h.checked_at+(/Z|[+-]\d\d:\d\d$/.test(h.checked_at)?'':'Z')):0;return [esc(key),h?esc(h.checked_at):'No heartbeat recorded',h&&now-stamp<180000?'Recent heartbeat':'Missing / stale · check service logs'];}))+btn('refresh','Refresh operations');
}
function render(tab,data,user){
  state.tab=tab;state.data=data;state.user=user;state.dirty=false;
  return '<div class="gc-studio">'+(tab==='approval'?(data.detail?detail(data):queue(data)):tab==='operations'?operations(data):sourcesView(data))+'</div>';
}
function dirty(event){if(event.target.closest('[data-catalog-form], [data-admin-form="product"]'))state.dirty=true;}
document.addEventListener('input',dirty);
addEventListener('gn-catalog-saved',()=>state.dirty=false);
addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('click',e=>{const a=e.target.closest('#gn-admin a[href^="#"]');if(a&&state.dirty&&a.hash!==location.hash&&!confirm('Discard unsaved catalog changes?')){e.preventDefault();e.stopImmediatePropagation();}},true);
function reload(){state.dirty=false;document.dispatchEvent(new Event('gn-admin-route'));}
function showError(el,error){if(el){el.replaceChildren();const p=document.createElement('p');p.textContent=error.message;el.append(p);if(error.checks?.length){const ul=document.createElement('ul');for(const item of error.checks){const li=document.createElement('li');li.textContent=item;ul.append(li);}el.append(ul);}}}
async function progress(){
  const box=document.getElementById('gcJobs');if(!box||!location.hash.startsWith('#/admin/imports'))return;
  try{const jobs=await get('catalog/jobs');box.innerHTML=jobsTable(jobs);state.data.jobs=jobs;const statusBox=document.getElementById('gcJobsStatus');if(statusBox)statusBox.textContent='Progress checked at '+new Date().toLocaleTimeString();if(jobs.some(j=>['queued','running'].includes(j.status)))state.poll=setTimeout(progress,6000);}
  catch(error){const box=document.getElementById('gcJobsStatus');if(box)box.textContent=error.message+' · use Refresh progress to retry.';}
}
function afterPaint(){if(state.tab==='imports'&&(state.data.jobs||[]).some(j=>['queued','running'].includes(j.status)))state.poll=setTimeout(progress,6000);}
document.addEventListener('submit',async event=>{
  const f=event.target;if(!f.dataset.catalogForm)return;event.preventDefault();
  if(f.dataset.busy||!f.reportValidity())return;
  const fd=new FormData(f),get=k=>String(fd.get(k)||'').trim(),num=k=>Number(get(k)),kind=f.dataset.catalogForm,id=Number(f.dataset.id),p=state.data.detail?.product;
  const submit=f.querySelector('[type=submit]'),error=f.querySelector('.ga-err');f.dataset.busy='1';submit.disabled=true;
  try{
    if(kind==='filter'){state.dirty=false;location.hash='#/admin/approval?'+new URLSearchParams({q:get('q'),state:get('state')});return;}
    if(kind==='source'){
      const payload={key:get('key'),name:get('name'),kind:get('kind'),endpoint:get('endpoint'),method:get('method'),auth_header:get('auth_header'),credential:get('credential'),license:get('license'),attribution:get('attribution'),owner_authorized:fd.has('owner_authorized'),enabled:fd.has('enabled')};
      if(id)await GNApi.put('/api/admin/catalog/sources/'+id,payload);else await GNApi.post('/api/admin/catalog/sources',payload);
    }else if(kind==='feed'){
      const data=new FormData();data.append('source_id',get('source_id'));data.append('request_id',f.dataset.requestId||(f.dataset.requestId=uuid()));data.append('file',fd.get('file'));await GNApi.request('/api/admin/catalog/uploads',{method:'POST',body:data});
    }else if(kind==='job')await GNApi.post('/api/admin/catalog/jobs',{source_id:num('source_id'),request_id:f.dataset.requestId||(f.dataset.requestId=uuid()),start:num('start'),pages:num('pages')});
    else if(['verify','publish','reject','unpublish','archive','restore'].includes(kind)){
      if(kind==='publish'&&!fd.has('confirm_publish'))throw new Error('Explicit publication authorization is required.');
      const confirmations=kind==='verify'?Object.fromEntries(Object.keys(reviewKeys).map(k=>[k,fd.has(k)])):{};
      await GNApi.post('/api/admin/products/'+p.id+'/review',{action:kind,expected_revision:p.revision,...(kind==='verify'?{supplier_id:num('supplier_id'),confirmations,evidence:get('evidence')}:{reason:get('reason')})});
    }else if(kind==='gallery'){
      const urls=(state.data.detail.media||[]).filter(a=>fd.has('gallery_'+a.id)).map(a=>a.url);
      await GNApi.patch('/api/admin/products/'+p.id,{revision:p.revision,image_url:get('image_url'),images_json:urls});
    }else if(['upload','remote'].includes(kind)){
      if(!fd.has('matches_product')||!fd.has('redistribution_allowed'))throw new Error('Confirm product match and permitted redistribution first.');
      let asset;
      if(kind==='upload'){
        const data=new FormData();for(const k of ['file','rights_holder','license','evidence'])data.append(k,fd.get(k));data.append('product_id',p.id);data.append('redistribution_allowed','true');
        asset=await GNApi.request('/api/admin/media',{method:'POST',body:data});
      }else asset=await GNApi.post('/api/admin/media/from-url',{product_id:p.id,url:get('url'),rights_holder:get('rights_holder'),license:get('license'),evidence:get('evidence'),redistribution_allowed:true,matches_product:true});
      await GNApi.patch('/api/admin/products/'+p.id,{revision:p.revision,image_url:p.image_url||asset.url,images_json:[...new Set([...(p.images||[]),asset.url])]});
    }else if(kind==='rights')await GNApi.patch('/api/admin/media/'+f.dataset.id+'/rights',{rights_holder:get('rights_holder'),license:get('license'),evidence:get('evidence'),redistribution_allowed:fd.has('redistribution_allowed')});
    else if(kind==='apply'){
      const fields=Array.from(fd.keys()).filter(k=>k.startsWith('copy_')).map(k=>k.slice(5));if(!fields.length)throw new Error('Choose metadata fields to apply.');
      await GNApi.post('/api/admin/catalog/items/'+id+'/apply',{fields,expected_revision:p.revision,reason:get('reason')});
    }else if(kind==='link'){const [target,revision]=get('target').split(':').map(Number);await GNApi.post('/api/admin/catalog/items/'+id+'/link',{product_id:target,expected_revision:revision,confirmed:fd.has('confirmed'),reason:get('reason')});}
    GNStore.toast(['feed','job'].includes(kind)?'Import queued. Follow actual job progress below.':'Server record saved.','ok');reload();GNStore.syncProducts();
  }catch(e){showError(error,e);}finally{delete f.dataset.busy;submit.disabled=false;}
});
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-catalog-action]');if(!b)return;event.preventDefault();const action=b.dataset.catalogAction,p=state.data.detail?.product;
  if(action==='obf-prefill'){const f=b.closest('details').querySelector('form');for(const [k,v] of Object.entries({key:'open-beauty-facts',name:'Open Beauty Facts reference',kind:'openbeautyfacts',license:'ODbL 1.0 / DbCL 1.0 (metadata); image rights reviewed individually',attribution:'Open Beauty Facts contributors · https://world.openbeautyfacts.org · metadata licensed under ODbL / DbCL'}))f.elements[k].value=v;f.elements.owner_authorized.checked=false;state.dirty=true;return;}
  b.disabled=true;
  try{
    if(action==='submit'){await GNApi.post('/api/admin/products/'+p.id+'/review',{action:'submit',expected_revision:p.revision});reload();}
    else if(action==='health'){const result=await GNApi.post('/api/admin/products/'+p.id+'/image-health',{});document.getElementById('gcHealth').textContent=JSON.stringify(result.checks,null,2);}
    else if(action==='retry'){await GNApi.post('/api/admin/catalog/jobs/'+b.dataset.id+'/retry',{});await progress();}
    else if(action==='jobs-refresh')await progress();
    else if(action==='refresh')reload();
  }catch(e){showError(document.getElementById('gcActionError'),e);GNStore.toast(e.message,'err');}finally{b.disabled=false;}
});
window.GNCatalogAdmin={load,render,afterPaint,tabs:new Set(['approval','imports','operations']),reviewKeys};
})();
