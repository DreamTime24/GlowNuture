/* Role-scoped, persistent ERP. All rows and totals come from authenticated server APIs. */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css = document.createElement("style");
css.textContent = `
body.gn-admin-route .site-header,body.gn-admin-route .announce,body.gn-admin-route .site-footer,body.gn-admin-route .mobile-nav,body.gn-admin-route .gn-cursor-glow{display:none}
#gn-admin{display:grid;grid-template-columns:230px 1fr;min-height:100vh;background:var(--ivory)}
#gn-admin aside{background:var(--charcoal);color:#cfc8bd;padding:22px 14px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:4px}
#gn-admin aside .logo{color:#fff;font:700 1.2rem 'Inter',sans-serif;padding:4px 12px 18px}#gn-admin aside .logo small{display:block;font-size:.66rem;letter-spacing:.2em;color:#8F877C;font-weight:500;margin-top:3px}
#gn-admin aside a{padding:10px 12px;border-radius:10px;color:inherit;font-weight:600;font-size:.92rem;cursor:pointer}#gn-admin aside a.on,#gn-admin aside a:hover{background:rgba(255,255,255,.09);color:#fff}
#gn-admin main{padding:clamp(16px,3vw,34px);min-width:0}
.ga-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px;flex-wrap:wrap}.ga-top h1{font-size:1.6rem}
.ga-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:99px;font-size:.78rem;font-weight:700;background:var(--sage-soft);color:var(--sage-deep)}
.ga-pill::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;animation:gnPulse 1.6s infinite}.ga-pill[data-s=reconnecting],.ga-pill[data-s=connecting]{background:var(--warning-soft);color:var(--warning)}
.ga-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:18px}
.ga-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:var(--sh-xs)}
.ga-card span{color:var(--muted);font-size:.84rem}.ga-card b{display:block;font:700 1.9rem/1.2 'Inter',sans-serif;margin-top:6px;font-variant-numeric:tabular-nums}
.ga-two{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}@media(max-width:980px){#gn-admin{grid-template-columns:1fr}#gn-admin aside{position:static;height:auto;flex-direction:row;overflow-x:auto}.ga-two{grid-template-columns:1fr}}
.ga-card h3{font-size:1rem;margin-bottom:12px}
.ga-bar{display:grid;grid-template-columns:96px 1fr 34px;gap:10px;align-items:center;font-size:.84rem;margin:8px 0}.ga-bar i{display:block;height:8px;border-radius:9px;background:var(--sage);width:0;transition:width 1s var(--ease)}
.ga-feed{list-style:none;margin:0;padding:0;max-height:300px;overflow:auto}.ga-feed li{padding:9px 0;border-bottom:1px solid var(--line);font-size:.88rem;animation:gaIn .5s var(--ease)}.ga-feed time{color:var(--muted);font-size:.76rem;margin-left:8px}
@keyframes gaIn{from{opacity:0;translate:0 -8px;background:var(--sage-soft)}}
.ga-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.ga-tools button,.ga-tools input{border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:8px 14px;font:600 .84rem 'Inter',sans-serif;cursor:pointer}.ga-tools button.on{background:var(--sage-deep);color:#fff;border-color:var(--sage-deep)}
.ga-table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;font-size:.88rem}
.ga-table th,.ga-table td{padding:11px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}.ga-table th{background:var(--surface-2);font-size:.78rem;color:var(--muted)}
.ga-wrap{overflow-x:auto}.ga-table select,.ga-table input{border:1px solid var(--line-strong);border-radius:8px;padding:6px 8px;font:inherit;background:#fff;width:100%;max-width:130px}
.ga-new{animation:gaIn 1.6s var(--ease)}.ga-empty{padding:30px;text-align:center;color:var(--muted)}
.ga-login{min-height:100vh;display:grid;place-items:center;padding:20px}.ga-login form{width:min(400px,100%);background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:30px;box-shadow:var(--sh)}
.ga-err{color:var(--danger);font-size:.86rem;min-height:1.3em;margin-top:10px}`;
document.head.append(css);


const permissions={super_admin:['dashboard','inventory','orders','support','accounting','marketing','staff'],admin:['dashboard','inventory','orders','support','accounting','marketing'],operations_manager:['dashboard','orders'],inventory_manager:['dashboard','inventory'],customer_support:['dashboard','support']};
const tabs={dashboard:['Dashboard','dashboard'],products:['Products','inventory'],approval:['Product review','inventory'],imports:['Catalog sources','inventory'],operations:['Operations health','dashboard'],inventory:['Stock & expiry','inventory'],suppliers:['Suppliers','inventory'],purchases:['Purchases','inventory'],orders:['Orders & courier','orders'],returns:['Returns','orders'],customers:['Customers','support'],support:['Support','support'],reviews:['Review moderation','support'],coupons:['Coupons','marketing'],content:['Policies & marketing','marketing'],accounting:['Accounting & refunds','accounting'],settings:['Integration status','marketing'],staff:['Staff','staff'],audit:['Audit','staff']};
const S={user:null,tab:'dashboard',data:{},loading:false},money=v=>'৳'+Number(v||0).toLocaleString('en-BD',{maximumFractionDigits:2});
let serial=0,es;
const view=()=>$('#gn-admin'),tab=()=>location.hash.split('/')[2]?.split('?')[0]||'dashboard',toast=(m,t)=>GNStore.toast(m,t);
const field=(name,label,value='',type='text',extra='')=>'<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const text=(name,label,value='')=>'<label>'+esc(label)+'<textarea name="'+name+'">'+esc(value)+'</textarea></label>';
const check=(name,label,on=false)=>'<label class="gn-checkbox"><input type="checkbox" name="'+name+'" '+(on?'checked':'')+'><span>'+esc(label)+'</span></label>';
const select=(name,label,values)=>'<label>'+esc(label)+'<select name="'+name+'">'+values.map(v=>'<option value="'+esc(Array.isArray(v)?v[0]:v)+'">'+esc(Array.isArray(v)?v[1]:v)+'</option>').join('')+'</select></label>';
const form=(kind,title,body,id='')=>'<form class="ga-form" data-admin-form="'+kind+'" data-id="'+esc(id)+'"><h3>'+esc(title)+'</h3><div class="gn-grid-form">'+body+'</div><button type="submit" class="btn btn-primary" style="margin-top:16px">Save / submit</button><p class="ga-err" role="alert"></p></form>';
const button=(action,id,label)=>'<button class="btn btn-outline btn-sm" data-admin-action="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
const table=(rows,columns)=>'<div class="ga-wrap"><table class="ga-table"><thead><tr>'+columns.map(([label])=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+columns.map(([,value])=>'<td>'+value(r)+'</td>').join('')+'</tr>').join('')+(rows.length?'':'<tr><td colspan="'+columns.length+'" class="ga-empty">No records yet.</td></tr>')+'</tbody></table></div>';
const generic=(rows,keys)=>table(rows,keys.map(key=>[key,r=>esc(typeof r[key]==='object'?JSON.stringify(r[key]):r[key])]));
function login(message=''){
  const v=view();if(!v)return;v.className='ga-login';v.innerHTML='<div class="co-card"><h1>Glow Nuture staff</h1><p>Firebase sign-in, a server-assigned role and staff MFA are required.</p><p class="ga-err">'+esc(message)+'</p><a class="btn btn-primary" data-admin-signin href="#/account">Sign in / account security</a><a class="btn btn-ghost" href="#/">View shop</a></div>';
}
async function load(current){
  if(window.GNCatalogAdmin?.tabs.has(current))return GNCatalogAdmin.load(current);
  const get=path=>GNApi.get('/api/admin/'+path);
  if(current==='dashboard')return {dashboard:await get('dashboard')};
  if(current==='inventory'){const [inventory,batches]=await Promise.all([get('inventory'),get('batches')]);return {inventory,batches};}
  if(current==='purchases'){const [purchases,suppliers,products]=await Promise.all([get('purchases'),get('suppliers'),get('products')]);return {purchases,suppliers,products};}
  if(current==='accounting'){const [reports,ledger,refunds]=await Promise.all([get('reports'),get('ledger'),get('refunds')]);return {reports,ledger,refunds};}
  if(current==='support'){const [support,orders]=await Promise.all([get('support'),get('support/orders')]);return {support,orders};}
  if(current==='content'){const kinds=['policy','faq','banner','category','brand'],results=await Promise.all(kinds.map(kind=>get('content/'+kind)));return {content:Object.fromEntries(kinds.map((kind,i)=>[kind,results[i]]))};}
  return {[current]:await get(current)};
}
async function refresh(){
  const n=++serial,current=tab();if(!view()||!location.hash.startsWith('#/admin'))return;
  if(!S.user)return boot();
  if(!tabs[current]||!permissions[S.user.role]?.includes(tabs[current][1]))return login('You do not have permission to access this section.');
  S.tab=current;paint('<div class="gn-spinner"></div><p class="center">Server records loading…</p>');
  try{const data=await load(current);if(n!==serial)return;S.data=data;paint();}
  catch(e){if(n===serial)paint('<div class="co-card" role="alert">'+esc(e.message)+'<div class="gn-button-row"><a class="btn btn-outline" href="#/account/settings">MFA / account settings</a>'+button('refresh','','Retry')+'</div></div>');}
}
function productForm(p={}){
  const body=field('sku','SKU',p.sku||'','text','required maxlength="80"')+field('slug','URL slug',p.slug||'','text','required pattern="[a-z0-9]+(-[a-z0-9]+)*"')+field('name','Product title',p.name||'','text','required')+
    ['en','brand','category','sub','size','origin','gtin'].map(k=>field(k,k,p[k]||'')).join('')+
    field('revision','Saved revision',p.revision||1,'number','readonly')+
    field('price','Actual selling price · BDT',p.price||0,'number','min="0" step="0.01" required')+field('compare','Genuine compare price · BDT',p.compare||0,'number','min="0" step="0.01"')+
    field('stock','Unreserved physical stock',p.stock||0,'number','min="0" step="1" required')+field('acquisition_cost','Unit acquisition cost · BDT',p.acquisition_cost||0,'number','min="0" step="0.01"')+
    '<label>Condition<select name="condition"><option value="new" '+(p.condition==='new'?'selected':'')+'>New</option><option value="sealed" '+(p.condition==='sealed'?'selected':'')+'>Sealed</option></select></label>'+
    check('expiry_required','Expiry information required',p.expiry_required!==false)+field('unbatched_expires_at','Verified expiry for unbatched stock',p.unbatched_expires_at?.slice(0,10)||'','date')+
    ['short','description','usage','warnings'].map(k=>text(k,k,p[k]||'')).join('')+text('ingredients','Ingredients / INCI (one per line)',(p.ingredients||[]).join('\n'))+
    field('tags','Tags, comma-separated',(p.tags||[]).join(', '))+field('skin','Skin types, comma-separated',(p.skin||[]).join(', '))+
    '<p class="ga-note">Save as a draft. Upload photographs and complete the owner checklist in Product review. Changes to approved content require a fresh review.</p>'+
    (p.id?'<a class="btn btn-outline" href="#/admin/approval?id='+p.id+'">Images & owner approval →</a>':'');
  return form('product',p.id?'Edit #'+p.id+' · '+(p.publication_state||'DRAFT'):'Create draft product',body,p.id);
}
function orders(rows=S.data.orders||[],readOnly=false){
  const stages={pending:['confirmed','cancelled'],confirmed:['processing','cancelled'],processing:['packed','cancelled'],packed:['shipped','cancelled'],shipped:['delivered','failed_delivery'],failed_delivery:['shipped','returned'],delivered:['returned']};
  return '<p class="ga-note">Courier entries record separately booked shipments. They do not claim API booking. Paid status is verified server-side.</p>'+table(rows,[
    ['Order',r=>'<b>'+esc(r.id)+'</b><br>'+esc(new Date(r.created_at).toLocaleString())],['Customer',r=>esc(r.customer?.name)+'<br>'+esc(r.customer?.phone)+'<br>'+esc(r.customer?.address)],['Items',r=>(r.items||[]).map(i=>esc(i.qty+' × '+i.name)).join('<br>')],['Total / payment',r=>money(r.total)+'<br>'+esc(r.payment_status)+' · '+esc(r.payment)],
    ['Status',r=>readOnly?esc(r.status):'<select data-order-status="'+esc(r.id)+'"><option value="">'+esc(r.status)+'</option>'+(stages[r.status]||[]).map(stage=>'<option>'+stage+'</option>').join('')+'</select>'],
    ['Actions',r=>'<div class="ga-action">'+button('invoice',r.id,'Invoice')+(readOnly?'':button('shipment',r.id,'Courier record')+(r.payment==='cod'&&r.status==='delivered'?button('cod',r.id,'Record COD collection'):''))+'</div>']
  ])+'<div id="gaEditor"></div>';
}
const pages={
  dashboard(){
    const d=S.data.dashboard||{},stat=(label,v)=>'<div class="ga-card"><span>'+label+'</span><b>'+esc(v)+'</b></div>';
    return '<div class="ga-grid">'+stat('Orders today',d.orders_today||0)+stat('Open orders',d.pending_orders||0)+stat('Delivered gross order value',money(d.revenue))+stat('All orders',d.total_orders||0)+stat('Connected browsers',d.viewers||0)+'</div><p class="ga-note">Delivered order value is not bank settlement or profit. Accounting uses recorded costs/refunds/fees/expenses.</p><div class="ga-two"><div class="ga-card"><h3>Order stages</h3>'+Object.entries(d.by_status||{}).map(([stage,n])=>'<p>'+esc(stage)+' · '+n+'</p>').join('')+'</div><div class="ga-card"><h3>Low stock</h3>'+(d.low_stock||[]).map(r=>'<p>'+esc(r.name)+' · '+r.stock+'</p>').join('')+'</div></div>';
  },
  products:()=>'<div class="ga-tools">'+button('product-new','','New product')+'<a href="#/admin/imports" class="btn btn-outline btn-sm">Catalog sources</a>'+button('export-products','','CSV export')+'</div>'+table(S.data.products||[],[['Product',r=>esc(r.name)+'<br>'+esc(r.brand)],['SKU',r=>esc(r.sku)],['BDT',r=>money(r.price)],['Stock',r=>esc(r.stock)],['State',r=>esc(r.publication_state||'DRAFT')+(r.legacy_approved?' · existing live':'')],['Actions',r=>button('product-edit',r.id,'Edit')+' '+button('variants',r.id,'Variants')+' <a class="btn btn-outline btn-sm" href="#/admin/approval?id='+r.id+'">Upload / manage images</a>']])+'<div id="gaEditor"></div>',
  orders:()=>orders(),
  imports:()=>form('import','Import one page of 12 as drafts','<p class="ga-note">Rotate/configure the private Parse key on the server first. Verified local price, stock and content stay intact.</p>'+field('start','Offset: 0,12,24,…',0,'number','min="0" max="480" step="12"'))+generic(S.data.imports||[],['created_at','status','counts_json','message']),
  inventory:()=>'<h3>Batch / expiry</h3>'+table(S.data.batches||[],[['Batch',r=>esc(r.code)],['Product / variant',r=>esc(r.product_id)+' / '+esc(r.variant_id||'base')],['Remaining',r=>esc(r.remaining)],['Expiry',r=>esc(r.expires_at||'not recorded')+(r.expired?'<b class="ga-err"> EXPIRED · checkout blocked</b>':r.expiry_warning?' · under 90 days':'')],['Action',r=>r.remaining?button('quarantine',r.id,'Quarantine'):'']])+'<h3 style="margin-top:24px">Stock movements</h3>'+generic(S.data.inventory||[],['created_at','product_id','variant_id','delta','reason','order_id']),
  suppliers:()=>form('supplier','Add supplier',field('name','Supplier name','','text','required')+text('contact','Private sourcing / contact notes'))+generic(S.data.suppliers||[],['id','name','contact','active']),
  purchases:()=>form('purchase','Create supplier purchase',
    select('supplier_id','Supplier',(S.data.suppliers||[]).map(r=>[r.id,r.name]))+field('reference','Supplier invoice reference','','text','required')+select('product_id','Product',(S.data.products||[]).map(r=>[r.id,r.sku+' · '+r.name]))+
    field('variant_id','Variant ID (optional)','','number','min="1"')+field('quantity','Quantity',1,'number','min="1" max="10000" required')+field('unit_cost','Unit cost BDT','','number','min="0.01" step="0.01" required')+field('batch_code','Batch code','','text','required')+field('expires_at','Expiry date','','date'))+
    table(S.data.purchases||[],[['ID / reference',r=>r.id+' · '+esc(r.reference)],['Supplier',r=>r.supplier_id],['Total',r=>money(r.total)],['Status',r=>esc(r.status)],['Items',r=>esc(JSON.stringify(r.items))],['Receive',r=>r.status==='draft'?button('receive',r.id,'Inspect & receive'):'Received once']]),
  returns:()=>table(S.data.returns||[],[['ID / order',r=>r.id+' / '+esc(r.order_id)],['Reason',r=>esc(r.reason)],['Status',r=>esc(r.status)],['Decision',r=>r.status==='requested'?button('return-approved',r.id,'Approve')+' '+button('return-rejected',r.id,'Reject'):r.status==='approved'?button('return-received',r.id,'Physically received'):'']]),
  customers:()=>generic(S.data.customers||[],['id','name','email','phone','role','addresses']),
  support:()=>'<h3>Support messages</h3>'+generic(S.data.support||[],['id','created_at','name','email','message'])+'<h3 style="margin-top:24px">Read-only orders</h3>'+orders(S.data.orders||[],true),
  reviews:()=>table(S.data.reviews||[],[['Product / order',r=>r.product_id+' · '+esc(r.order_id)],['Rating',r=>r.rating],['Text',r=>esc(r.text)],['Moderation',r=>r.approved?'Approved':button('review-approve',r.id,'Approve verified review')]]),
  coupons:()=>form('coupon','Create/update coupon',field('code','Code','','text','required')+select('kind','Type',['percent','fixed'])+field('value','Value',10,'number','min="0.01" step="0.01" required')+field('minimum','Minimum BDT',0,'number','min="0"')+field('maximum_discount','Maximum BDT discount (optional)','','number','min="0" step="0.01"')+field('usage_limit','Usage limit (optional)','','number','min="1"')+field('starts_at','Starts at','','datetime-local')+field('expires_at','Expires at','','datetime-local')+check('active','Active',true))+generic(S.data.coupons||[],['code','kind','value','minimum','used','usage_limit','active']),
  content:()=>form('content','Publish approved content',select('kind','Kind',['policy','faq','banner','category','brand'])+field('key','Key: terms,privacy,return,delivery,about,…','','text','required pattern="[a-z0-9_-]{1,80}"')+field('title','Title','','text','required')+text('body','Plain text; no executable HTML')+field('image_url','Banner image (optional)')+field('link','Store link (optional, begins #/)')+check('active','Approved and public'))+Object.entries(S.data.content||{}).map(([kind,rows])=>'<h3>'+kind+'</h3>'+generic(rows,['key','title','body','active'])).join(''),
  accounting(){
    const r=S.data.reports||{},stat=(label,value)=>'<div class="ga-card"><span>'+label+'</span><b>'+esc(value)+'</b></div>';
    return '<div class="ga-grid">'+stat('Net sales',money(r.net_sales))+stat('Gross profit',r.gross_profit===null?'Costs missing':money(r.gross_profit))+stat('Net profit',r.net_profit===null?'Costs missing':money(r.net_profit))+'</div><p class="ga-note">Management report, not tax certification. Profit uses recorded unit cost, shipping, fees and refunds. Missing costs are shown explicitly.</p>'+
    form('expense','Record actual expense',field('amount','Amount BDT','','number','required min="0.01" step="0.01"')+field('reference','Unique reference','','text','required')+field('description','Description','','text','required'))+
    form('refund-request','Request refund review; this does not transfer money',field('order_id','Order ID','','text','required')+field('amount','Amount BDT','','number','required min="0.01" step="0.01"')+text('reason','Reason'))+
    '<h3>Refund records</h3>'+table(S.data.refunds||[],[['ID / order',r=>r.id+' / '+esc(r.order_id)],['Amount',r=>money(r.amount)],['Status',r=>esc(r.status)],['Reason',r=>esc(r.reason)],['Action',r=>r.status==='requested'?button('refund-record',r.id,'Record externally completed refund'):esc(r.provider_reference)]])+'<div id="gaEditor"></div><h3 style="margin-top:24px">Ledger</h3>'+button('export-ledger','','CSV export')+generic(S.data.ledger||[],['created_at','kind','amount','reference','description']);
  },
  settings:()=>'<p class="ga-note">No secret values are returned. Environment, approved merchant and Firebase Console setup are owner actions.</p>'+generic(Object.entries(S.data.settings||{}).map(([key,value])=>({key,value})),['key','value']),
  staff:()=>'<p class="ga-note">Only super_admin assigns staff. First owner is granted server-side by exact Firebase UID. Role changes revoke sessions; staff MFA is enforced.</p>'+form('staff','Change an exact existing account role',field('user_id','Exact account ID','','number','required min="1"')+select('role','Role',['customer','customer_support','inventory_manager','operations_manager','admin','super_admin'])+check('is_active','Account active',true)+check('confirm','I verified the account ID and authorize this change'))+generic(S.data.staff||[],['id','name','email','firebase_uid','role']),
  audit:()=>generic(S.data.audit||[],['created_at','actor_user_id','action','entity','entity_id','metadata_json'])
};
function paint(body){
  const v=view();if(!v)return;v.className='';
  const allowed=permissions[S.user?.role]||[];
  v.innerHTML='<aside><div class="logo">Glow Nuture<small>'+esc(S.user?.role||'STAFF')+'</small></div>'+Object.entries(tabs).filter(([,spec])=>allowed.includes(spec[1])).map(([key,spec])=>'<a href="#/admin/'+key+'" class="'+(S.tab===key?'on':'')+'">'+spec[0]+'</a>').join('')+'<a href="#/" style="margin-top:auto">View shop</a><a href="#/account/settings">Account security</a><a href="#" data-admin-action="logout">Sign out</a></aside><main><div class="ga-top"><h1>'+esc(tabs[S.tab]?.[0]||'Admin')+'</h1><span class="ga-pill">Server data</span></div>'+(body??(window.GNCatalogAdmin?.tabs.has(S.tab)?GNCatalogAdmin.render(S.tab,S.data,S.user):pages[S.tab]?.())??'')+'</main>';
  if(body===undefined&&window.GNCatalogAdmin?.tabs.has(S.tab))GNCatalogAdmin.afterPaint();
}
document.addEventListener('submit',async event=>{
  const f=event.target;if(!f.dataset.adminForm)return;event.preventDefault();
  if(f.dataset.busy||!f.reportValidity())return;
  const fd=new FormData(f),get=k=>String(fd.get(k)||'').trim(),num=k=>Number(get(k)),kind=f.dataset.adminForm,error=$('.ga-err',f),submit=$('[type=submit]',f);
  f.dataset.busy='1';if(submit)submit.disabled=true;if(error)error.textContent='';
  try{
    if(kind==='product'){
      const data={};['sku','slug','name','en','brand','category','sub','size','origin','gtin','short','description','usage','warnings','condition'].forEach(k=>data[k]=get(k));
      Object.assign(data,{price:num('price'),compare:num('compare'),stock:num('stock'),acquisition_cost:num('acquisition_cost'),ingredients_json:get('ingredients').split('\n').map(v=>v.trim()).filter(Boolean),tags_json:get('tags').split(',').map(v=>v.trim()).filter(Boolean),skin_json:get('skin').split(',').map(v=>v.trim()).filter(Boolean),expiry_required:fd.has('expiry_required')});
      if(f.dataset.id)data.revision=num('revision');
      if(get('unbatched_expires_at'))data.unbatched_expires_at=new Date(get('unbatched_expires_at')+'T23:59:59+06:00').toISOString();
      if(f.dataset.id)await GNApi.patch('/api/admin/products/'+f.dataset.id,data);else await GNApi.post('/api/admin/products',data);
    }else if(kind==='import')throw new Error('Use Catalog sources to queue an authorized import.');
    else if(kind==='supplier')await GNApi.post('/api/admin/suppliers',{name:get('name'),contact:get('contact'),active:true});
    else if(kind==='purchase')await GNApi.post('/api/admin/purchases',{supplier_id:num('supplier_id'),reference:get('reference'),items:[{product_id:num('product_id'),variant_id:get('variant_id')?num('variant_id'):null,quantity:num('quantity'),unit_cost:num('unit_cost'),batch_code:get('batch_code'),expires_at:get('expires_at')?new Date(get('expires_at')+'T23:59:59').toISOString():null}]});
    else if(kind==='coupon')await GNApi.post('/api/admin/coupons',{code:get('code'),kind:get('kind'),value:num('value'),minimum:num('minimum'),maximum_discount:get('maximum_discount')?num('maximum_discount'):null,usage_limit:get('usage_limit')?num('usage_limit'):null,starts_at:get('starts_at')?new Date(get('starts_at')).toISOString():null,expires_at:get('expires_at')?new Date(get('expires_at')).toISOString():null,active:fd.has('active')});
    else if(kind==='content')await GNApi.put('/api/admin/content/'+get('kind')+'/'+get('key'),{title:get('title'),body:get('body'),image_url:get('image_url'),link:get('link'),active:fd.has('active')});
    else if(kind==='expense')await GNApi.post('/api/admin/expenses',{amount:num('amount'),reference:get('reference'),description:get('description')});
    else if(kind==='refund-request')await GNApi.post('/api/admin/orders/'+encodeURIComponent(get('order_id'))+'/refunds',{amount:num('amount'),reason:get('reason')});
    else if(kind==='refund-record')await GNApi.post('/api/admin/refunds/'+f.dataset.id+'/record',{provider_reference:get('provider_reference'),confirmed_amount:num('confirmed_amount'),operator_confirmed:fd.has('operator_confirmed')});
    else if(kind==='staff')await GNApi.patch('/api/admin/staff/'+num('user_id'),{role:get('role'),is_active:fd.has('is_active'),confirm:fd.has('confirm')});
    else if(kind==='shipment')await GNApi.post('/api/admin/orders/'+f.dataset.id+'/shipment',{provider:get('provider'),tracking_number:get('tracking_number'),shipping_cost:num('shipping_cost')});
    else if(kind==='cod')await GNApi.post('/api/admin/orders/'+f.dataset.id+'/cod',{amount:num('amount'),reference:get('reference')});
    else if(kind==='variant')await GNApi.post('/api/admin/products/'+f.dataset.id+'/variants',{sku:get('sku'),label:get('label'),price:num('price'),stock:num('stock'),active:fd.has('active')});
    toast('Server record saved.','ok');window.dispatchEvent(new Event('gn-catalog-saved'));await refresh();GNStore.syncProducts();
  }catch(e){if(error)error.textContent=e.message;toast(e.message,'err');}finally{delete f.dataset.busy;if(submit)submit.disabled=false;}
});
document.addEventListener('change',async event=>{
  const s=event.target.closest('[data-order-status]');if(!s||!s.value)return;
  const status=s.value,reason=['cancelled','returned','failed_delivery'].includes(status)?prompt('Record reason:')||'':'';
  const restock=status==='returned'&&confirm('Physically received, inspected and safe for resale? Only then restock.');
  try{await GNApi.patch('/api/admin/orders/'+s.dataset.orderStatus+'/status',{status,reason,restock});toast('Order status saved.','ok');await refresh();}catch(e){toast(e.message,'err');await refresh();}
});
document.addEventListener('click',async event=>{
  if(event.target.closest('[data-admin-signin]'))sessionStorage.setItem('gn_return_to','admin');
  const b=event.target.closest('[data-admin-action]');if(!b||!view()?.contains(b))return;
  event.preventDefault();const action=b.dataset.adminAction,id=b.dataset.id,box=$('#gaEditor',view());
  try{
    if(action==='refresh')await refresh();
    else if(action==='logout'){await GNAuth.logout();S.user=null;es?.close();es=null;location.hash='#/';}
    else if(action==='product-new'||action==='product-edit'){const p=action==='product-edit'?S.data.products.find(p=>String(p.id)===id):{};box.innerHTML=productForm(p);box.scrollIntoView({block:'start'});}
    else if(action==='variants'){
      const rows=await GNApi.get('/api/admin/products/'+id+'/variants');
      box.innerHTML=generic(rows,['id','sku','label','price','stock'])+form('variant','Add option',field('sku','SKU','','text','required')+field('label','Size / label','','text','required')+field('price','BDT price','','number','required min="0.01" step="0.01"')+field('stock','Stock',0,'number','min="0"')+check('active','Active',true),id);
    }else if(action==='shipment')box.innerHTML=form('shipment','Record separately booked courier shipment','<p class="ga-note">This does not book a courier API shipment.</p>'+select('provider','Courier',['manual','pathao','steadfast','redx'])+field('tracking_number','Real tracking reference','','text','required')+field('shipping_cost','Actual BDT shipping cost',0,'number','min="0" step="0.01"'),id);
    else if(action==='cod')box.innerHTML=form('cod','Record actual COD collection / settlement',field('amount','Full collected amount BDT','','number','required min="0.01" step="0.01"')+field('reference','Courier / bank settlement reference','','text','required'),id);
    else if(action==='invoice')await GNApi.download('/api/admin/orders/'+id+'/invoice',id+'.pdf');
    else if(action==='receive'){if(!confirm('Authenticity, count, batch and expiry inspected? Receiving adds stock once.'))return;await GNApi.post('/api/admin/purchases/'+id+'/receive',{inspected:true});await refresh();}
    else if(action==='quarantine'){const reason=prompt('Reason for quarantining all remaining units:');if(reason){await GNApi.post('/api/admin/batches/'+id+'/quarantine',{reason});await refresh();}}
    else if(action.startsWith('return-')){const reason=prompt('Staff decision / inspection note:');if(reason){await GNApi.patch('/api/admin/returns/'+id,{status:action.slice(7),reason});await refresh();}}
    else if(action==='review-approve'){await GNApi.post('/api/admin/reviews/'+id+'/approve',{});await refresh();}
    else if(action==='refund-record'){const r=S.data.refunds.find(r=>String(r.id)===id);box.innerHTML=form('refund-record','Record externally completed refund; does not send money',field('provider_reference','Actual provider refund reference','','text','required')+field('confirmed_amount','Confirmed BDT amount',r.amount,'number','required min="0.01" step="0.01"')+check('operator_confirmed','I checked the completed provider/bank refund'),id);}
    else if(action==='export-products')await GNApi.download('/api/admin/exports/products','products.csv');
    else if(action==='export-ledger')await GNApi.download('/api/admin/exports/ledger','ledger.csv');
  }catch(e){toast(e.message,'err');}
});
async function boot(){
  if(S.loading||!location.hash.startsWith('#/admin'))return;S.loading=true;
  try{
    const user=await GNApi.get('/api/auth/me');S.user=user;
    if(!user||!permissions[user.role])return login(user?'Customer account; owner must grant a staff role server-side.':'');
    await refresh();
    if(!es&&window.GNRealtime)es=GNRealtime.connect('/api/realtime/admin',{'order.created':()=>{if(S.tab==='dashboard'||S.tab==='orders')refresh();},'order.status':()=>{if(S.tab==='dashboard'||S.tab==='orders')refresh();}});
  }catch(e){login(e.message);}finally{S.loading=false;}
}
function mount(){
  const on=location.hash.startsWith('#/admin');document.body.classList.toggle('gn-admin-route',on);
  if(!on){es?.close();es=null;return;}if(!view())$('#app').innerHTML='<div id="gn-admin"></div>';
  if(S.user&&permissions[S.user.role])refresh();else boot();
}
document.addEventListener('gn-admin-route',mount);addEventListener('hashchange',()=>setTimeout(mount,10));document.addEventListener('DOMContentLoaded',mount);if(document.readyState!=='loading')mount();
})();
