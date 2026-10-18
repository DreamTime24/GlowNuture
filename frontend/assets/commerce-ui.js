/* Real account/content/catalog flows use the existing theme and reusable cards. */
(() => {
'use strict';
const store=()=>GNStore.store,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'৳'+Number(n||0).toLocaleString('en-BD',{maximumFractionDigits:2});
const wrap=(title,body)=>'<div class="wrap section"><h1>'+esc(title)+'</h1>'+body+'</div>';
const message=text=>'<div class="co-card" role="status">'+esc(text)+'</div>';
const localProduct=p=>p?.displayOnly===true||p?.source==='local';
const ordinaryProduct=p=>/(?:the[\s_-]*)?ordinary/i.test([p?.brand,p?.name].filter(Boolean).join(' '));
const catalog={rows:[],loading:false,loaded:false,error:''},notices={rows:[],loaded:false,loading:false,error:''},content={policies:[],faqs:[],loaded:false,loading:false,error:''};
const reviewsLoaded=new Set(),detailsLoaded=new Set();
function comparison(){
  const products=store().state.comparison.map(id=>store().product(id)).filter(Boolean);
  if(!products.length)return wrap('Compare products',message('Use Compare on product cards to add up to four products.')+'<a class="btn btn-primary" href="#/shop">Shop</a>');
  const fields=products.every(localProduct)
    ?[['Brand',p=>p.brand||'—'],['Description',p=>p.description||p.short]]
    :[['Price',p=>localProduct(p)?'—':money(p.price)],['Brand',p=>p.brand||'—'],['Size',p=>p.size||'—'],['Stock',p=>localProduct(p)?'—':p.stock],['Ingredients',p=>localProduct(p)?'—':(p.ingredients||[]).join(' · ')||'Not provided'],['Description',p=>p.description||p.short],['Usage',p=>localProduct(p)?'—':p.usage||'Follow product instructions']];
  return wrap('Compare products','<div class="gn-compare"><table><thead><tr><th>Compare</th>'+products.map(p=>'<th>'+GNStore.productImage(p)+'<a href="#/p/'+esc(p.slug)+'">'+esc(p.name)+'</a><button class="btn btn-ghost btn-sm" data-extra="compare" data-id="'+p.id+'">Remove</button></th>').join('')+'</tr></thead><tbody>'+fields.map(([label,value])=>'<tr><th>'+label+'</th>'+products.map(p=>'<td>'+esc(value(p))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');
}
function ordinary(){
  const localRows=store().products().filter(localProduct);
  if(localRows.length){
    const rows=localRows.filter(ordinaryProduct);
    const body=rows.length?'<div class="prod-grid">'+rows.map(p=>GNStore.productCard(p)).join('')+'</div>':message('No images in this collection yet.');
    return wrap('The Ordinary catalog','<p class="muted">Explore The Ordinary collection.</p>'+body);
  }
  if(!catalog.loaded&&!catalog.loading){
    catalog.loading=true;GNApi.get('/api/catalog/ordinary').then(rows=>{catalog.rows=Array.isArray(rows)?rows:[];catalog.error='';}).catch(error=>catalog.error=error.message).finally(()=>{catalog.loaded=true;catalog.loading=false;if(location.hash.startsWith('#/ordinary'))GNStore.render();});
  }
  const body=catalog.loading?'<div class="gn-spinner"></div><p class="center" role="status">The Ordinary catalog loading…</p>':catalog.error?message(catalog.error)+'<button class="btn btn-outline" data-extra="catalog-retry">Retry</button>':!catalog.rows.length?message('No verified products are published in this collection yet.'): '<div class="prod-grid">'+catalog.rows.slice(0,12).map(p=>{
    const raw=p.price,value=raw&&typeof raw==='object'?(raw.amount??raw.value??raw.price??null):raw;
    return '<article class="pcard"><div class="pcard-media">'+GNStore.productImage({...p,image_url:p.image_url||p.images?.[0]})+'</div><div class="pcard-body"><span class="pcard-brand">The Ordinary</span><h2 class="pcard-name"><a href="#/p/'+esc(p.slug)+'">'+esc(p.name||'Untitled product')+'</a></h2><div class="pcard-price"><span class="price-now">'+esc(value===undefined||value===null?'Price not provided':money(value))+'</span></div><p class="pcard-short">'+esc(p.description||'Description not provided')+'</p><div class="gn-card-ingredients"><small>Key ingredients</small><span>'+esc((p.ingredients||[]).join(' · ')||'Not provided')+'</span></div><p class="tiny muted">Owner-verified collection · Prices shown in Bangladeshi taka</p></div></article>';
  }).join('')+'</div>';
  return wrap('The Ordinary catalog','<p class="muted">Browse verified products, ingredient information and actual BDT prices. To order, visit the <a href="#/shop">approved shop</a>.</p>'+body);
}
async function loadNotices(){
  notices.loading=true;try{notices.rows=await GNApi.get('/api/notifications');notices.error='';}catch(e){notices.error=e.message;}
  finally{notices.loading=false;notices.loaded=true;if(location.hash.includes('/notifications'))GNStore.render();}
}
function notifications(){
  if(!notices.loaded&&!notices.loading)loadNotices();
  return '<h2>Notifications</h2>'+ (notices.loading?'<div class="gn-spinner"></div>':notices.error?message(notices.error):notices.rows.map(r=>'<div class="order-card"><b>'+esc(r.title)+'</b><p>'+esc(r.body)+'</p><small>'+esc(new Date(r.created_at).toLocaleString())+'</small>'+(!r.read?'<button class="btn btn-ghost btn-sm" data-extra="read" data-id="'+r.id+'">Mark read</button>':'')+'</div>').join('')||message('No notifications yet.'))+'<button class="btn btn-outline" data-extra="notices-refresh">Refresh</button>';
}
function settings(u){
  const prefs=u.preferences||{};
  return '<h2>Account settings</h2><form data-form="profile"><div class="gn-grid-form"><label class="field"><span class="lbl">Name</span><input class="input" name="name" required minlength="2" maxlength="120" value="'+esc(u.name)+'"></label><label class="field"><span class="lbl">Bangladesh mobile</span><input class="input en" name="phone" pattern="01[3-9][0-9]{8}" maxlength="11" value="'+esc(u.phone||'')+'"></label><label class="field"><span class="lbl">Sign-in email</span><input class="input en" type="email" name="email" value="'+esc(u.email||'')+'" '+(u.firebase_uid?'readonly':'')+'></label></div><button class="btn btn-primary" type="submit">Save profile</button></form><hr style="margin:26px 0"><h3>Privacy & notifications</h3><form data-extra-form="preferences">'+[['email','Email order updates'],['push','Push order updates'],['marketing','Optional marketing consent']].map(([key,label])=>'<label class="gn-checkbox"><input type="checkbox" name="'+key+'" '+(prefs[key]?'checked':'')+'><span>'+label+'</span></label>').join('')+'<button class="btn btn-primary" type="submit">Save preferences</button></form><div class="gn-button-row"><button class="btn btn-outline" data-extra="push-enable">Enable device push</button><button class="btn btn-ghost" data-extra="push-disable">Disable account push</button><button class="btn btn-ghost" data-extra="analytics-preferences">Analytics consent</button></div>'+
  (u.firebase_uid?'<hr style="margin:26px 0"><h3>Sign-in security</h3><p>Email '+(u.email_verified?'verified':'not verified')+'</p><div class="gn-button-row"><button class="btn btn-outline" data-firebase-action="verify">Verification email</button><button class="btn btn-ghost" data-firebase-action="refresh-identity">Refresh verification</button></div><form data-firebase="reset"><label class="field"><span class="lbl">Account email</span><input class="input en" name="email" type="email" required value="'+esc(u.email||'')+'"></label><button class="btn btn-outline" type="submit">Password reset</button></form><details style="margin-top:20px"><summary>TOTP multi-factor authentication</summary><p class="tiny muted">Firebase Authentication with Identity Platform and a TOTP provider must be configured. Billing and plans are not changed here. Enrollment for email/password accounts:</p><div id="gnTotpEnroll"><form data-firebase="totp-start"><label class="field"><span class="lbl">Current password</span><input class="input en" name="password" type="password" required autocomplete="current-password"></label><button class="btn btn-outline" type="submit">Start MFA enrollment</button></form></div></details><div data-recaptcha="login"></div>':'')+
  '<hr style="margin:26px 0"><h3>Delete account</h3><p class="tiny muted">Sign out and sign in again before deleting your account. Your profile, addresses and device tokens will be deleted. Order records required for legal or accounting purposes may be retained under the seller’s retention policy. Staff accounts require owner review.</p><button class="btn btn-outline danger" data-extra="delete-account">Delete account</button>';
}
function loadContent(){
  content.loading=true;Promise.all([GNApi.get('/api/content/policy'),GNApi.get('/api/content/faq')]).then(([policies,faqs])=>{content.policies=policies;content.faqs=faqs;content.error='';}).catch(e=>content.error=e.message).finally(()=>{content.loading=false;content.loaded=true;if(location.hash.startsWith('#/page/'))GNStore.render();});
}
function page(slug){
  if(!content.loaded&&!content.loading)loadContent();
  const cfg=window.GNConfig||{},seller=cfg.seller||{};
  if(slug==='contact')return wrap('Contact','<p class="muted">Never include your card number, CVV or PIN in a support message.</p><div class="gn-button-row"><a class="btn btn-outline" href="'+esc(cfg.brand?.facebook||'https://www.facebook.com/glownuturebd')+'" target="_blank" rel="noopener noreferrer">Facebook</a><a class="btn btn-outline" href="'+esc(cfg.brand?.instagram||'https://www.instagram.com/glownuture/reels/')+'" target="_blank" rel="noopener noreferrer">Instagram</a></div>'+
    (seller.name?'<div class="co-card"><b>'+esc(seller.name)+'</b><p>'+esc(seller.address)+'</p><p>'+esc(seller.email)+' · '+esc(seller.phone)+'</p></div>':'')+
    '<form class="co-card" data-extra-form="contact" style="max-width:700px"><div class="gn-grid-form"><label class="field"><span class="lbl">Name</span><input class="input" name="name" required minlength="2" maxlength="120"></label><label class="field"><span class="lbl">Email</span><input class="input en" name="email" type="email" required></label></div><label class="field"><span class="lbl">Message</span><textarea class="textarea" name="message" required minlength="10" maxlength="4000"></textarea></label><input name="website" tabindex="-1" style="position:absolute;left:-10000px" aria-hidden="true"><label class="gn-checkbox"><input type="checkbox" name="consent" required><span>I agree to the use of this information to respond to my support request.</span></label><button class="btn btn-primary" type="submit">Send message</button></form>');
  if(content.loading)return wrap('Store information','<div class="gn-spinner"></div>');
  if(content.error)return wrap('Store information',message(content.error));
  const policy=content.policies.find(r=>r.key===slug);if(policy)return wrap(policy.title,'<div class="co-card gn-policy-text">'+esc(policy.body)+'</div>');
  if(slug==='faq'&&content.faqs.length)return wrap('FAQ',content.faqs.map(r=>'<details class="co-card"><summary>'+esc(r.title)+'</summary><p class="gn-policy-text">'+esc(r.body)+'</p></details>').join(''));
  const drafts={
    about:['Glow Nuture','A beauty and skin care catalog for products approved by the seller. The seller is responsible for verifying product authenticity and sourcing.'],
    privacy:['Privacy policy · approval pending','Firebase sign-in and encrypted server profiles and delivery information are used. This site does not collect card numbers, CVVs or PINs. Optional analytics, email and push notifications require consent. The seller must approve and publish the full data retention, deletion and third-party processing policy.'],
    terms:['Terms · approval pending','Full terms covering seller identity, authenticity, payments, order acceptance, complaints and customer rights are awaiting owner approval. Publish approved terms before enabling checkout.'],
    return:['Returns & refunds · approval pending','Return requests may be submitted for eligible delivered account orders. The seller must publish the approved return window, hygiene restrictions, evidence requirements for incorrect or damaged items and refund timing.'],
    delivery:['Delivery information','The server calculates delivery charges by district at checkout. The seller is responsible for confirming courier coverage and estimated delivery times.'],
    faq:['FAQ','Track orders with your order ID and private tracking code. Check approved product pages for ingredient and usage information. Consult a qualified clinician about medical concerns.']
  },draft=drafts[slug]||['Page not found','This content has not been published.'];
  return wrap(draft[0],message(draft[1])+'<a class="btn btn-outline" href="#/page/contact">Support</a>');
}
async function pay(o){
  const r=await GNApi.post('/api/payments/'+o.id+'/initiate',{order_id:o.id,token:o.tracking_token}),url=new URL(r.payment_url);
  if(url.protocol!=='https:'||!['sandbox.sslcommerz.com','securepay.sslcommerz.com'].includes(url.hostname))throw new Error('Unexpected payment destination.');
  location.assign(url.href);
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-extra]');if(!b||b.disabled)return;event.preventDefault();
  const action=b.dataset.extra,id=b.dataset.id;
  try{
    if(action==='compare'){
      const state=store().state,i=state.comparison.indexOf(id);
      if(i>=0)state.comparison.splice(i,1);else{if(state.comparison.length>=4)throw new Error('Maximum four products.');if(!store().product(id))throw new Error('Product not found.');state.comparison.push(id);}
      store().persist();store().emit();if(location.hash.startsWith('#/compare'))GNStore.render();else b.textContent=state.comparison.includes(id)?'Compared · remove':'Compare';
    }else if(action==='catalog-retry'){catalog.loaded=false;GNStore.render();}
    else if(action==='invoice'){
      const o=store().order(id);if(!o)throw new Error('Order not found.');
      await GNApi.download(o.tracking_token?'/api/invoices/guest':'/api/orders/'+id+'/invoice',id+'.pdf',o.tracking_token?{order_id:id,token:o.tracking_token}:undefined);
    }else if(action==='copy-track'){const o=store().order(id);await navigator.clipboard.writeText(o.tracking_token);GNStore.toast('Private tracking code copied.','ok');}
    else if(action==='pay'){const o=store().order(id);if(o)await pay(o);}
    else if(action==='return'){const reason=prompt('Return request reason (5+ characters):');if(reason){await GNApi.post('/api/orders/'+id+'/returns',{reason});GNStore.toast('Return request saved for staff review.','ok');}}
    else if(action==='read'){await GNApi.patch('/api/notifications/'+id,{});await loadNotices();}
    else if(action==='notices-refresh')await loadNotices();
    else if(action==='push-enable'){await GNAuth.enablePush();await GNApi.patch('/api/profile/preferences',{...store().state.user.preferences,push:true});store().setUser(await GNApi.get('/api/profile'));GNStore.toast('Device push enabled.','ok');}
    else if(action==='push-disable'){await GNApi.delete('/api/push/subscriptions');await GNApi.patch('/api/profile/preferences',{...store().state.user.preferences,push:false});store().setUser(await GNApi.get('/api/profile'));GNStore.toast('Push disabled.','ok');}
    else if(action==='delete-account'){if(prompt('Type DELETE to confirm account deletion.')!=='DELETE')return;await GNApi.delete('/api/account');await GNAuth.logout();location.hash='#/';GNStore.toast('Account deleted.','ok');}
    else if(action==='analytics-preferences')showConsent(true);
    else if(action==='consent-accept'||action==='consent-deny'){const enabled=action==='consent-accept';localStorage.setItem('gn_analytics_consent',enabled?'yes':'no');await GNAuth.consentAnalytics(enabled);document.querySelector('.gn-consent')?.remove();}
  }catch(error){GNStore.toast(error.message,'err');}
});
document.addEventListener('submit',async event=>{
  const f=event.target;if(!f.dataset.extraForm)return;event.preventDefault();
  if(f.dataset.busy||!f.reportValidity())return;
  const fd=new FormData(f),get=k=>String(fd.get(k)||'').trim(),button=f.querySelector('[type=submit]');f.dataset.busy='1';if(button)button.disabled=true;
  try{
    if(f.dataset.extraForm==='contact'){await GNApi.post('/api/contact',{name:get('name'),email:get('email'),message:get('message'),website:get('website'),consent:fd.get('consent')==='on'});GNStore.toast('Support message saved.','ok');f.reset();}
    else if(f.dataset.extraForm==='preferences'){await GNApi.patch('/api/profile/preferences',{marketing:fd.has('marketing'),email:fd.has('email'),push:fd.has('push')});store().setUser(await GNApi.get('/api/profile'));GNStore.toast('Preferences saved.','ok');}
  }catch(e){GNStore.toast(e.message,'err');}finally{delete f.dataset.busy;if(button)button.disabled=false;}
});
function showConsent(force=false){
  if(!window.GNConfig?.analyticsEnabled||(!force&&localStorage.getItem('gn_analytics_consent')))return;
  document.querySelector('.gn-consent')?.remove();const box=document.createElement('aside');box.className='gn-consent';
  box.innerHTML='<p>Optional Firebase/Google Analytics usage data will be processed. Analytics is not required for shopping.</p><button class="btn btn-primary btn-sm" data-extra="consent-accept">Allow analytics</button> <button class="btn btn-outline btn-sm" data-extra="consent-deny">No thanks</button>';document.body.append(box);
}
function enhance(){
  if(!window.GNStore)return;
  document.querySelectorAll('.pcard[data-id]').forEach(card=>{
    if(card.querySelector('[data-extra=compare]'))return;const b=document.createElement('button');b.className='btn btn-ghost btn-sm';b.dataset.extra='compare';b.dataset.id=card.dataset.id;b.textContent=store().state.comparison.includes(card.dataset.id)?'Compared · remove':'Compare';card.querySelector('.pcard-actions')?.append(b);
  });
  document.querySelectorAll('form[data-form=newsletter]').forEach(form=>{
    if(form.querySelector('[name=consent]'))return;const label=document.createElement('label');label.className='gn-checkbox';label.innerHTML='<input type="checkbox" name="consent" required><span>Optional product-news email consent.</span>';form.append(label);
  });
  const slug=location.hash.match(/^#\/p\/([^?]+)/)?.[1],p=slug&&store().product(slug);
  if(p&&!localProduct(p)&&p.apiId&&!reviewsLoaded.has(p.apiId)){
    reviewsLoaded.add(p.apiId);GNApi.get('/api/products/'+p.apiId+'/reviews').then(rows=>{store().state.reviews[p.id]=rows;if(location.hash.includes(slug))GNStore.render();}).catch(()=>reviewsLoaded.delete(p.apiId));
  }
  const oid=location.hash.match(/^#\/order\/([^?]+)/)?.[1];
  if(oid&&store().state.user&&!detailsLoaded.has(oid)){
    detailsLoaded.add(oid);GNApi.get('/api/orders/'+encodeURIComponent(oid)).then(o=>{store().createOrder(o);if(location.hash.includes(oid))GNStore.render();}).catch(e=>{detailsLoaded.delete(oid);GNStore.toast(e.message,'err');});
  }
  if(p&&!localProduct(p)&&p.apiId&&p.variants?.length&&!document.getElementById('gnVariant')){
    const select=document.createElement('select');select.className='select';select.id='gnVariant';select.setAttribute('aria-label','Product size / option');
    select.innerHTML='<option value="0" '+(!p.selectedVariantId?'selected':'')+'>'+esc(p._baseSize||'Base product')+' · '+money(p._basePrice)+' · '+p._baseStock+' available</option>'+p.variants.map(v=>'<option value="'+v.id+'" '+(p.selectedVariantId===v.id?'selected':'')+'>'+esc(v.label)+' · '+money(v.price)+' · '+v.stock+' available</option>').join('');
    const label=document.createElement('label');label.className='field';label.innerHTML='<span class="lbl">Size / option</span>';label.append(select);document.querySelector('.pd-price')?.after(label);
    select.addEventListener('change',()=>{
      const v=p.variants.find(v=>v.id===Number(select.value));if(!v){Object.assign(p,{selectedVariantId:null,price:p._basePrice,stock:p._baseStock,sku:p._baseSKU,size:p._baseSize});GNStore.render();return;}
      Object.assign(p,{selectedVariantId:v.id,price:v.price,stock:v.stock,sku:v.sku,size:v.label});GNStore.render();
    });
  }
}
document.addEventListener('gn-render',()=>setTimeout(enhance,0));document.addEventListener('gn-state',()=>{if(!store().state.user){notices.loaded=false;notices.rows=[];detailsLoaded.clear();}});
window.GNExtra={comparison,ordinary,notifications,settings,page};
if(/^#\/(ordinary|compare)(?:[/?]|$)/.test(location.hash))GNStore.render();
enhance();
GNConfigReady.then(cfg=>{
  document.querySelectorAll('[data-support-email]').forEach(e=>e.textContent=cfg.seller?.email||'See contact details');document.querySelectorAll('[data-support-phone]').forEach(e=>e.textContent=cfg.seller?.phone||'See contact details');
  const announcement=document.querySelector('#announce .wrap>span');if(announcement)announcement.textContent=cfg.checkoutEnabled?'Glow Nuture · Local BDT catalog · Confirm delivery at checkout':'Glow Nuture · Catalog browsing open · Checkout setup pending';
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=location.origin+'/';document.head.append(canonical);
  const ld=document.createElement('script');ld.type='application/ld+json';ld.textContent=JSON.stringify({'@context':'https://schema.org','@type':'Organization',name:'Glow Nuture',url:location.origin+'/',sameAs:[cfg.brand?.facebook,cfg.brand?.instagram].filter(Boolean)});document.head.append(ld);
  showConsent();if(cfg.analyticsEnabled&&localStorage.getItem('gn_analytics_consent')==='yes')GNAuth.consentAnalytics(true).catch(()=>{});
  GNApi.get('/api/content/banner').then(rows=>{if(rows.length){store().state.banners=rows.map(r=>({id:r.key,title:r.title,sub:r.body,active:r.active}));if(location.hash==='#/'||!location.hash)GNStore.render();}}).catch(()=>{});
});
})();
