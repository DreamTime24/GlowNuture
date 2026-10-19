/* ============================================================================
 * GLOW NUTURE — Application
 * ---------------------------------------------------------------------------
 * Structure (mirrors the intended production folder layout):
 *   1. DATA          → data/products.js, data/categories.js, data/content.js
 *   2. STORE         → lib/store.js        (state + persistence)
 *   3. UTIL          → lib/utils.js
 *   4. PHOTOS        → components/ProductArt.js  (local product photos)
 *   5. COMPONENTS    → components/*
 *   6. VIEWS         → app/pages/*.js
 *   7. ROUTER        → lib/router.js
 *   8. EVENTS        → app/handlers.js
 * ========================================================================== */
(function () {
'use strict';

/* ==========================================================================
 * 1. DATA
 * ======================================================================== */

const BRAND = { nameEn:'Glow Nuture' };

const CATEGORIES = [
  { slug:'skincare',  name:'Skin Care',    desc:'Serums • Cleansers • Sunscreen • Moisturizers', art:{t:'dropper', c:'#D9C8AF', d:'#8A7457'} },
  { slug:'haircare',  name:'Hair Care',    desc:'Shampoo • Conditioner • Hair Serums',        art:{t:'pump',    c:'#C7CFC0', d:'#5F6E58'} },
  { slug:'bodycare',  name:'Body Care',      desc:'Body Wash • Lotion • Hand Care',          art:{t:'bottle',  c:'#E0CFC4', d:'#8D6F60'} },
  { slug:'cosmetics', name:'Cosmetics',       desc:'Lip Care • Makeup • Beauty Essentials',     art:{t:'lipstick',c:'#C98D92', d:'#8E5A60'} },
  { slug:'daily',     name:'Daily Care',  desc:'Everyday personal care and accessories',    art:{t:'pouch',   c:'#D6D2C6', d:'#7C776A'} },
  { slug:'gift',      name:'Gifts & Sets',    desc:'Curated sets for gifting',              art:{t:'combo',   c:'#E3D6C6', d:'#94795F'} }
];

/* Sub-category key → English label */
const SUBS = {
  serum:'Serum', sunscreen:'Sunscreen', facewash:'Face Wash', moisturizer:'Moisturizer',
  cleanser:'Cleanser', toner:'Toner', mask:'Mask',
  shampoo:'Shampoo', conditioner:'Conditioner', hairserum:'Hair Serum',
  bodywash:'Body Wash', lotion:'Body Lotion', handcare:'Hand Care',
  lip:'Lip Care', makeup:'Makeup', facemakeup:'Face Makeup',
  personal:'Personal Care', accessories:'Accessories', combo:'Gift Set'
};

const SKIN_TYPES = { oily:'Oily', dry:'Dry', combination:'Combination', sensitive:'Sensitive', all:'All skin types' };
const CONCERNS = {
  acne:'Acne', oiliness:'Excess oil', dryness:'Dryness', dullness:'Dullness',
  texture:'Uneven texture', sunprotection:'Sun protection', pigmentation:'Dark spots',
  hairfall:'Hair loss', dandruff:'Dandruff', hydration:'Hydration'
};

/* Helper factory — keeps product objects uniform */
function P(o){
  const p=Object.assign({id:'',sku:'',slug:'',name:'',en:'',brand:BRAND.nameEn,category:'skincare',sub:'',short:'',description:'',price:0,compare:0,stock:0,size:'',origin:'',skin:[],concerns:[],ingredients:[],usage:'',tags:[],rating:0,reviews:0,demo:false,variants:[],art:{t:'dropper',c:'#D9C8AF',d:'#8A7457'}},o);
  p._baseStock=p.stock;p._basePrice=p.price;p._baseSKU=p.sku;p._baseSize=p.size;
  const variant=p.variants.find(v=>v.id===p.selectedVariantId)||(p.stock>0?null:p.variants.find(v=>v.stock>0)||p.variants[0]);
  if(variant){p.selectedVariantId=variant.id;p.price=variant.price;p.stock=variant.stock;p.sku=variant.sku;p.size=variant.label;}else p.selectedVariantId=null;
  return p;
}
const PRODUCTS=[];const COUPONS=[];
const LOCAL_PRODUCTS=Array.isArray(window.GNLocalCatalog)?window.GNLocalCatalog:[];
const LOCAL_MODE=LOCAL_PRODUCTS.every(p=>p.displayOnly);

const DIVISIONS = {
  'ঢাকা':['ঢাকা','গাজীপুর','নারায়ণগঞ্জ','টাঙ্গাইল','কিশোরগঞ্জ','মানিকগঞ্জ','মুন্সিগঞ্জ','নরসিংদী','ফরিদপুর','গোপালগঞ্জ','মাদারীপুর','রাজবাড়ী','শরীয়তপুর'],
  'চট্টগ্রাম':['চট্টগ্রাম','কক্সবাজার','কুমিল্লা','ব্রাহ্মণবাড়িয়া','চাঁদপুর','ফেনী','লক্ষ্মীপুর','নোয়াখালী','বান্দরবান','খাগড়াছড়ি','রাঙ্গামাটি'],
  'রাজশাহী':['রাজশাহী','বগুড়া','পাবনা','সিরাজগঞ্জ','নাটোর','নওগাঁ','চাঁপাইনবাবগঞ্জ','জয়পুরহাট'],
  'খুলনা':['খুলনা','যশোর','সাতক্ষীরা','বাগেরহাট','কুষ্টিয়া','ঝিনাইদহ','মাগুরা','নড়াইল','চুয়াডাঙ্গা','মেহেরপুর'],
  'বরিশাল':['বরিশাল','পটুয়াখালী','ভোলা','পিরোজপুর','বরগুনা','ঝালকাঠি'],
  'সিলেট':['সিলেট','মৌলভীবাজার','হবিগঞ্জ','সুনামগঞ্জ'],
  'রংপুর':['রংপুর','দিনাজপুর','কুড়িগ্রাম','গাইবান্ধা','লালমনিরহাট','নীলফামারী','পঞ্চগড়','ঠাকুরগাঁও'],
  'ময়মনসিংহ':['ময়মনসিংহ','জামালপুর','নেত্রকোণা','শেরপুর']
};
const LOCATION_LABELS = {
  'ঢাকা':'Dhaka','গাজীপুর':'Gazipur','নারায়ণগঞ্জ':'Narayanganj','টাঙ্গাইল':'Tangail','কিশোরগঞ্জ':'Kishoreganj','মানিকগঞ্জ':'Manikganj','মুন্সিগঞ্জ':'Munshiganj','নরসিংদী':'Narsingdi','ফরিদপুর':'Faridpur','গোপালগঞ্জ':'Gopalganj','মাদারীপুর':'Madaripur','রাজবাড়ী':'Rajbari','শরীয়তপুর':'Shariatpur',
  'চট্টগ্রাম':'Chattogram','কক্সবাজার':'Cox’s Bazar','কুমিল্লা':'Cumilla','ব্রাহ্মণবাড়িয়া':'Brahmanbaria','চাঁদপুর':'Chandpur','ফেনী':'Feni','লক্ষ্মীপুর':'Lakshmipur','নোয়াখালী':'Noakhali','বান্দরবান':'Bandarban','খাগড়াছড়ি':'Khagrachhari','রাঙ্গামাটি':'Rangamati',
  'রাজশাহী':'Rajshahi','বগুড়া':'Bogura','পাবনা':'Pabna','সিরাজগঞ্জ':'Sirajganj','নাটোর':'Natore','নওগাঁ':'Naogaon','চাঁপাইনবাবগঞ্জ':'Chapainawabganj','জয়পুরহাট':'Joypurhat',
  'খুলনা':'Khulna','যশোর':'Jashore','সাতক্ষীরা':'Satkhira','বাগেরহাট':'Bagerhat','কুষ্টিয়া':'Kushtia','ঝিনাইদহ':'Jhenaidah','মাগুরা':'Magura','নড়াইল':'Narail','চুয়াডাঙ্গা':'Chuadanga','মেহেরপুর':'Meherpur',
  'বরিশাল':'Barishal','পটুয়াখালী':'Patuakhali','ভোলা':'Bhola','পিরোজপুর':'Pirojpur','বরগুনা':'Barguna','ঝালকাঠি':'Jhalokati',
  'সিলেট':'Sylhet','মৌলভীবাজার':'Moulvibazar','হবিগঞ্জ':'Habiganj','সুনামগঞ্জ':'Sunamganj',
  'রংপুর':'Rangpur','দিনাজপুর':'Dinajpur','কুড়িগ্রাম':'Kurigram','গাইবান্ধা':'Gaibandha','লালমনিরহাট':'Lalmonirhat','নীলফামারী':'Nilphamari','পঞ্চগড়':'Panchagarh','ঠাকুরগাঁও':'Thakurgaon',
  'ময়মনসিংহ':'Mymensingh','জামালপুর':'Jamalpur','নেত্রকোণা':'Netrokona','শেরপুর':'Sherpur'
};
const locationLabel = value => LOCATION_LABELS[value] || value;

/* ---------- Journal ---------- */
const ARTICLES = [
  {
    slug:'why-sunscreen', cat:'Skin care basics', read:'4 min',
    title:'Why you should wear sunscreen every day',
    excerpt:'UVA and UVB rays affect your skin throughout the year. Learn how to choose the right sunscreen.',
    art:{ t:'tube', c:'#F2E4C9', d:'#C79A4E' },
    body:[
      ['p','Sunscreen is not just for hot days or trips to the beach. UVA rays can pass through glass, reach your skin on cloudy days and affect it all year round.'],
      ['h2','What do SPF and PA+++ mean?'],
      ['p','SPF indicates protection from UVB rays. The PA rating indicates UVA protection, from PA+ to PA++++. In places with a high UV index, an SPF 50 and PA++++ combination is often a practical choice.'],
      ['h2','How much should you apply?'],
      ['p','Many people apply much less sunscreen than recommended. A common guideline is about two finger lengths for the face and neck.'],
      ['note','Reapply every 2–3 hours when spending extended time outdoors, and after sweating or washing your face.'],
      ['h2','How to choose'],
      ['ul',['A gel or fluid texture for oily skin','A cream or moisturizing formula for dry skin','Mineral or gentle filters for sensitive skin','A lightweight, non-cast formula to wear under makeup']]
    ]
  },
  {
    slug:'how-to-choose-serum', cat:'Ingredient guide', read:'5 min',
    title:'How to choose a serum',
    excerpt:'Niacinamide, vitamin C, hyaluronic acid — which ingredient is right for you?',
    art:{ t:'dropper', c:'#DCC9AE', d:'#8A7457' },
    body:[
      ['p','A serum is a lightweight product with a concentrated ingredient designed to target a specific concern. Choosing one starts with understanding what you want to address.'],
      ['h2','Common ingredients and what they do'],
      ['ul',['Niacinamide may help manage excess oil and support the skin barrier','Vitamin C may support a brighter appearance and provide antioxidant benefits','Hyaluronic acid helps attract and retain moisture','Retinol may improve the appearance of texture and fine lines','AHA/BHA exfoliants help remove dead skin cells and smooth the look of texture']],
      ['h2','How many should you use at once?'],
      ['p','Start with one or two active ingredients. Adding many new products at once can irritate your skin and make it difficult to tell what is working.'],
      ['note','It is generally best not to use retinol and exfoliating acids on the same night. Start a new product once or twice a week and increase gradually if tolerated.']
    ]
  },
  {
    slug:'know-your-skin-type', cat:'Basics', read:'4 min',
    title:'How to identify your skin type',
    excerpt:'Oily, dry, combination or sensitive? Try this simple check.',
    art:{ t:'jar', c:'#F1EAD9', d:'#B79A6A' },
    body:[
      ['p','Knowing your skin type is a helpful first step when choosing products. You can try a simple check at home.'],
      ['h2','A simple check'],
      ['p','Cleanse your face and leave it bare for about an hour. Then look in the mirror:'],
      ['ul',['Shiny or greasy all over → oily','Tight or flaky all over → dry','Oil mainly in the T-zone (forehead, nose and chin) → combination','Redness, stinging or itching → possibly sensitive']],
      ['h2','Skin can change with the seasons'],
      ['p','Your skin may respond differently to changes in weather and environment. For example, skin that feels dry in winter may feel more combination in hot weather. Adjusting your routine with the seasons is normal.'],
      ['note','For persistent skin concerns, sudden breakouts or unusual changes, consider consulting a dermatologist.']
    ]
  },
  {
    slug:'face-wash-frequency', cat:'Routine', read:'3 min',
    title:'How often should you wash your face?',
    excerpt:'Is washing your face more often better? Learn the basics.',
    art:{ t:'pump', c:'#EDF0E8', d:'#7C8F76' },
    body:[
      ['p','Washing your face more often does not necessarily make it cleaner. Over-cleansing can disrupt the skin’s natural oils.'],
      ['h2','A general guideline'],
      ['p','For many people, washing twice a day — morning and evening — is enough. Evening cleansing helps remove the day’s sunscreen, oil and buildup.'],
      ['h2','When you may need an extra cleanse'],
      ['ul',['After working in a very sweaty environment','After wearing heavy makeup','After spending a long time outdoors']],
      ['note','Applying moisturizer soon after cleansing can help retain moisture.']
    ]
  },
  {
    slug:'skincare-routine-steps', cat:'Basics', read:'5 min',
    title:'The basics of a skin care routine',
    excerpt:'Learn the order for applying products in the morning and evening.',
    art:{ t:'combo', c:'#E7DCCB', d:'#8A7457' },
    body:[
      ['p','A simple routine does not require many products. Knowing the order can help you build an effective routine with fewer steps.'],
      ['h2','Morning routine'],
      ['ul',['Face wash','Toner (optional)','Serum','Moisturizer','Sunscreen (essential)']],
      ['h2','Evening routine'],
      ['ul',['Cleanser / micellar water','Face wash','Toner (optional)','Treatment serum','Moisturizer']],
      ['note','A general rule: apply lighter textures before richer ones. Sunscreen is the final step in your morning routine.']
    ]
  },
  {
    slug:'beauty-myths', cat:'Know the facts', read:'4 min',
    title:'Common beauty myths, explained',
    excerpt:'Understand the difference between marketing claims and reality.',
    art:{ t:'bottle', c:'#EAF0E7', d:'#7C8F76' },
    body:[
      ['p','Beauty product marketing can make many claims, but not all of them are equally reliable. Here are a few common myths to keep in mind.'],
      ['h2','“Change your skin tone in days”'],
      ['p','Your natural skin tone is influenced by genetics. No safe product can change your underlying skin tone in a few days. Some ingredients may help improve the appearance of dark spots over time.'],
      ['h2','“More products mean better results”'],
      ['p','The opposite may be true. Too many products can weaken the skin barrier. A consistent routine with only the products you need is often more helpful.'],
      ['h2','“Oily skin does not need moisturizer”'],
      ['p','Oily skin still needs hydration. Choose a lightweight, oil-free or gel formula if that suits your skin.'],
      ['note','Patch test new products on a small area first. Stop using a product if irritation occurs and seek medical advice when needed.']
    ]
  }
];

/* ---------- Static pages ---------- */
const PAGES = {
  about:{ title:'About us', body:`
    <p>Glow Nuture is a Bangladesh-based beauty and personal care store. Our goal is simple: bring skin, hair and everyday care essentials together with clear product information and a convenient shopping experience.</p>
    <h2>What we do</h2>
    <p>We provide clear information about ingredients, directions, suitability and cautions so you can make informed choices.</p>
    <h2>What we don’t do</h2>
    <ul>
      <li>Make exaggerated or unverified beauty claims</li>
      <li>Show fake reviews or inflated sales numbers</li>
      <li>Encourage you to buy products you don’t need</li>
    </ul>
    <div class="note-box">This website is currently running with a demo catalog. Real products, prices and stock information will be added later.</div>
  `},
  contact:{ title:'Contact', body:`
    <p>Get in touch with us if you have a question or need help with an order.</p>
    <h2>Support hours</h2>
    <p>Daily, 10 AM–8 PM (closed Fridays)</p>
    <h2>Contact options</h2>
    <ul>
      <li>Mobile / WhatsApp: <span class="en" data-support-phone>See contact details</span></li>
      <li>Email: <span class="en" data-support-email>See contact details</span></li>
      <li>Facebook: <span class="en">/glownuture</span></li>
    </ul>
    <div class="note-box">Contact details in the demo version are examples. Replace them with the business’s real phone number and email address.</div>
  `},
  delivery:{ title:'Delivery policy', body:`
    <h2>Delivery fees</h2>
    <ul>
      <li>Inside Dhaka: ৳60</li>
      <li>Outside Dhaka (nationwide): ৳120</li>
      <li>Free delivery on orders of ৳2,500 or more</li>
    </ul>
    <h2>Delivery times</h2>
    <ul>
      <li>Dhaka: usually 1–2 business days</li>
      <li>Outside Dhaka: usually 2–4 business days</li>
      <li>Remote areas may take up to 5 business days</li>
    </ul>
    <h2>Order processing</h2>
    <p>After you place an order, our team may call or message you to verify it. Once verified, your order is handed to the courier.</p>
    <div class="note-box">We’ll let you know about any delivery changes when confirming your order.</div>
  `},
  return:{ title:'Returns and refunds', body:`
    <h2>Return conditions</h2>
    <ul>
      <li>Report the issue within 24 hours of delivery</li>
      <li>The product must be unused and the seal intact</li>
      <li>Keep the packaging, labels and invoice</li>
      <li>We take responsibility for incorrect or damaged items</li>
    </ul>
    <h2>Items that cannot be returned</h2>
    <ul>
      <li>Used products or products with a broken seal</li>
      <li>Opened products returned for personal reasons, such as a change of preference</li>
      <li>Issues reported more than 24 hours after delivery</li>
    </ul>
    <h2>Refunds</h2>
    <p>Approved refunds are usually processed within 3–7 business days. Cash-on-delivery refunds are sent to your bKash or Nagad number.</p>
    <div class="note-box">For hygiene reasons, opened or used beauty products cannot be resold.</div>
  `},
  privacy:{ title:'Privacy policy', body:`
    <p>Glow Nuture takes the privacy of your personal information seriously.</p>
    <h2>Information we collect</h2>
    <ul>
      <li>Name, mobile number and email address</li>
      <li>Delivery address (division, district, upazila and street address)</li>
      <li>Order information</li>
    </ul>
    <h2>How we use your information</h2>
    <ul>
      <li>To process and deliver your order</li>
      <li>To provide customer support</li>
      <li>To send updates about your order</li>
    </ul>
    <h2>Sharing information</h2>
    <p>We share only the information needed with our courier partners to deliver your order. We do not sell your information to third parties.</p>
  `},
  terms:{ title:'Terms and conditions', body:`
    <h2>General terms</h2>
    <ul>
      <li>Prices are shown in Bangladeshi taka and may change</li>
      <li>We may cancel an order if an item is out of stock and will notify you</li>
      <li>We reserve the right to cancel orders with demo or incorrect prices</li>
      <li>Fraudulent or abusive orders will be cancelled</li>
    </ul>
    <h2>Product information</h2>
    <p>Product pages list ingredients, directions and cautions. Check the ingredient list before use if you have a known allergy.</p>
    <div class="note-box">Consult a dermatologist about ongoing skin concerns. We do not provide medical advice.</div>
  `},
  faq:{ title:'Frequently asked questions', faqs:[
    ['How can I track my order?','Use your order ID and the private tracking code provided with your order. Keep the code confidential.'],
    ['How is my total calculated?','At checkout, the server calculates the product total, discount, delivery fee and any applicable taxes based on your address and coupon.'],
    ['Where can I find the return policy?','Read the published returns and refunds policy. Contact support if you have questions.'],
    ['Can I order without an account?','If guest checkout is enabled, you can place an order without an account. Keep your receipt and private tracking code.'],
    ['How can I check product availability?','See the local price and stock on an approved product page. External reference catalogs do not represent store inventory.'],
    ['How should I share personal information?','Share only the information needed through our contact form. Never send your card number, PIN, CVV or password.']
  ]}
};

/* ==========================================================================
 * 2. UTIL
 * ======================================================================== */
const bn   = s => String(s);
const bnEn = s => String(s);
const money = n => '৳' + Number(n || 0).toLocaleString('en-BD');
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function bnDate(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  }catch(e){ return ''; }
}
function timeAgo(iso){
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff/60) + ' minutes ago';
  if (diff < 86400) return Math.floor(diff/3600) + ' hours ago';
  return bnDate(iso);
}
function starsHtml(rating){
  let h = '<span class="stars" aria-hidden="true">';
  for (let i = 1; i <= 5; i++){
    h += `<svg width="13" height="13" viewBox="0 0 24 24" fill="${i <= Math.round(rating) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>`;
  }
  return h + '</span>';
}
function discountPct(p){
  if (!p.compare || p.compare <= p.price) return 0;
  return Math.round((1 - p.price / p.compare) * 100);
}

/* ==========================================================================
 * 3. STORE
 * ======================================================================== */
const LS_KEY = 'gn_state_v3';

const Store = (function(){
  let state = {
    cart: [],           // [{id, qty}]
    wishlist: [],       // [productId]
    comparison: [],
    catalogError: '',
    catalogLoading: true,
    orders: [],
    reviews: {},        // { productId: [{name, rating, text, date}] }
    user: null,         // {name, phone, email, addresses:[]}
    products: [],       // mutable copy (admin)
    coupons: [],
    banners: [
      { id:'b1', title:'Everyday care, made simple.', sub:'Essentials for skin, hair and daily care — all in one place.', active:true }
    ],
    recent: [],
    lastOrder: null
  };

  const subs = [];
  const emit = () => subs.forEach(fn => { try{ fn(state); }catch(e){} });
  const persist=()=>{
    try{
      localStorage.removeItem('gn_state_v2');
      localStorage.setItem(LS_KEY,JSON.stringify({cart:state.cart,wishlist:state.wishlist,comparison:state.comparison,recent:state.recent}));
    }catch(_){}
  };
  function load(){
    state.products=[];state.coupons=[];state.user=null;state.orders=[];state.reviews={};
    try{
      const saved=JSON.parse(localStorage.getItem(LS_KEY)||'{}');
      const ids=v=>Array.isArray(v)?v.filter(id=>typeof id==='string'&&(/^(p[0-9]+|local-[a-z0-9-]+)$/.test(id))).slice(0,200):[];
      state.cart=Array.isArray(saved.cart)?saved.cart.filter(row=>/^p[0-9]+$/.test(row?.id)&&Number.isInteger(row.qty)&&row.qty>0&&row.qty<=20&&(!row.variant_id||(Number.isInteger(row.variant_id)&&row.variant_id>0))).slice(0,30).map(row=>({...row,variant_id:row.variant_id||null})):[];
      state.wishlist=ids(saved.wishlist);state.comparison=ids(saved.comparison).slice(0,4);state.recent=ids(saved.recent).slice(0,12);
    }catch(_){}
    persist();
  }

  return {
    load, persist, emit, subscribe:fn => subs.push(fn),
    get state(){ return state; },
    /* ---- products ---- */
    product(idOrSlug){ return state.products.find(p => p.id === idOrSlug || p.slug === idOrSlug); },
    products(){ return state.products; },
    saveProduct(p){
      const i = state.products.findIndex(x => x.id === p.id);
      if (i >= 0) state.products[i] = { ...state.products[i], ...p };
      else state.products.unshift({ ...p, id:p.id || uid() });
      persist(); emit();
    },
    deleteProduct(id){
      state.products = state.products.filter(p => p.id !== id);
      state.cart = state.cart.filter(c => c.id !== id);
      persist(); emit();
    },
    /* ---- cart ---- */
    cartLines(){
      return state.cart.map(line=>{
        const base=this.product(line.id);if(!base||base.displayOnly)return null;
        const variant=line.variant_id?base.variants.find(v=>v.id===line.variant_id):null;
        if(line.variant_id&&!variant)return null;
        const p=variant?{...base,price:variant.price,stock:variant.stock,sku:variant.sku,size:variant.label}:{...base,price:base._basePrice,stock:base._baseStock,sku:base._baseSKU};
        return {...line,product:p,subtotal:p.price*line.qty};
      }).filter(Boolean);
    },
    cartCount(){return state.cart.reduce((n,row)=>n+row.qty,0);},
    addToCart(id,qty,variantId){
      qty=Math.max(1,Math.min(20,parseInt(qty||1,10)||1));
      const p=this.product(id);if(!p)return {ok:false,msg:'Product not found.'};
      if(p.displayOnly)return {ok:false,msg:'Browse this item in the collection.'};
      variantId=variantId||p.selectedVariantId||null;
      const variant=variantId?p.variants.find(v=>v.id===variantId):null,stock=variant?variant.stock:p._baseStock;
      if(stock<=0)return {ok:false,msg:'This option is out of stock.'};
      const line=state.cart.find(row=>row.id===id);
      if(line&&line.variant_id!==variantId)return {ok:false,msg:'Remove the previous option from your bag before adding a different one.'};
      const next=(line?.qty||0)+qty;
      if(next>stock||next>20)return {ok:false,msg:'The stock or per-order quantity limit has been exceeded.'};
      if(line)line.qty=next;else state.cart.push({id,qty,variant_id:variantId});
      persist();emit();return {ok:true,msg:'Added to your bag.'};
    },
    setQty(id,qty){
      const line=state.cart.find(row=>row.id===id),display=this.cartLines().find(row=>row.id===id);
      if(!line||!display)return;
      line.qty=clamp(parseInt(qty||1,10)||1,1,Math.min(20,display.product.stock||1));persist();emit();
    },
    removeFromCart(id){
      state.cart = state.cart.filter(l => l.id !== id);
      persist(); emit();
    },
    clearCart(){ state.cart = []; persist(); emit(); },
    /* ---- wishlist ---- */
    inWishlist(id){ return state.wishlist.includes(id); },
    toggleWish(id){
      const i = state.wishlist.indexOf(id);
      if (i >= 0) state.wishlist.splice(i, 1); else state.wishlist.push(id);
      persist(); emit();
      return i < 0;
    },
    /* ---- recently viewed ---- */
    pushRecent(id){
      state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 12);
      persist();
    },
    /* ---- reviews ---- */
    reviewsFor(id){ return state.reviews[id] || []; },
    ratingFor(id){
      const rs = this.reviewsFor(id);
      if (!rs.length) return { rating:0, count:0 };
      return { rating: rs.reduce((s, r) => s + r.rating, 0) / rs.length, count: rs.length };
    },
    addReview(id, review){
      if (!state.reviews[id]) state.reviews[id] = [];
      state.reviews[id].unshift(review);
      persist(); emit();
    },
    /* ---- orders ---- */
    createOrder(payload){
      if(!payload?.id?.startsWith('GN-'))throw new Error('Server order number missing.');
      const o={...payload,createdAt:payload.created_at||payload.createdAt,customer:payload.customer||{}};
      const index=state.orders.findIndex(row=>row.id===o.id);
      if(index>=0)state.orders[index]=o;else state.orders.unshift(o);
      state.lastOrder=o;emit();return o;
    },
    order(id){ return state.orders.find(o => o.id === id); },
    setOrderStatus(id, status){
      const o = this.order(id);
      if (o){ o.status = status; persist(); emit(); }
    },
    /* ---- user ---- */
    setUser(u){ state.user = u; persist(); emit(); },
    logout(){state.user=null;state.orders=[];state.lastOrder=null;state.reviews={};emit();},
    /* ---- coupons ---- */
    coupon(code){
      return state.coupons.find(c => c.code.toUpperCase() === String(code || '').toUpperCase().trim());
    },
    saveCoupon(c){
      const i = state.coupons.findIndex(x => x.code === c.code);
      if (i >= 0) state.coupons[i] = c; else state.coupons.push(c);
      persist(); emit();
    },
    deleteCoupon(code){
      state.coupons = state.coupons.filter(c => c.code !== code);
      persist(); emit();
    },
    /* ---- reset ---- */
    resetAll(){
      localStorage.removeItem(LS_KEY);
      location.reload();
    }
  };
})();

/* ==========================================================================
 * 4. PRODUCT PHOTOS
 * ======================================================================== */
const mediaURL=url=>window.GNMediaURL?window.GNMediaURL(url):url;
function productImage(p,options={}){
  const safe=url=>typeof url==='string'&&(/^(https:\/\/|\/media\/)/.test(url)||/^\/assets\/image\/[a-z0-9-]+\.jpg$/.test(url));
  const candidates=[...new Set([p?.image_url,...(Array.isArray(p?.images)?p.images:[])].map(v=>typeof v==='string'?v:v?.url||v?.src).filter(safe))];
  const url=candidates.shift()||'/assets/no-image.svg',asset=p?.image_assets?.find(v=>v.url===url);
  const variants=(asset?.variants||[]).filter(v=>safe(v.url)&&Number(v.width)>0).sort((a,b)=>a.width-b.width);
  const widths=new Map();variants.forEach(v=>widths.set(Number(v.width),v.url));
  const srcset=[...widths].map(([w,url])=>esc(mediaURL(url))+' '+w+'w').join(', ');
  return '<img class="gn-product-image" src="'+esc(mediaURL(url))+'" '+(srcset?'srcset="'+srcset+'" sizes="'+esc(options.sizes||'(max-width: 540px) 46vw, (max-width: 980px) 30vw, 300px')+'" ':'')+'alt="'+esc((p?.displayOnly?p.description:[p?.brand,p?.name,p?.size].filter(Boolean).join(' · '))||'Product image unavailable')+'" width="'+(asset?.width||300)+'" height="'+(asset?.height||300)+'" loading="'+(options.eager?'eager':'lazy')+'" '+(options.eager?'fetchpriority="high" ':'')+'decoding="async" data-image-candidates="'+esc(JSON.stringify(candidates.map(mediaURL)))+'" data-product-image>';
}
document.addEventListener('error',event=>{
  const image=event.target;
  if(!image?.matches?.('[data-product-image]')||image.dataset.failed)return;
  image.removeAttribute('srcset');image.removeAttribute('sizes');
  let candidates=[];try{candidates=JSON.parse(image.dataset.imageCandidates||'[]');}catch(_){}
  const next=candidates.shift();image.dataset.imageCandidates=JSON.stringify(candidates);
  if(next){image.src=next;return;}
  image.dataset.failed='1';image.src=mediaURL('/assets/no-image.svg');
},true);

// Bundled photos remain available when the product catalog is empty or unavailable.
const PHOTO_FALLBACKS = Object.fromEntries([
  ['cleanser','cerave-foaming-facial-cleanser','CeraVe Foaming Facial Cleanser',454,625],
  ['serum','the-ordinary-niacinamide-10-plus-zinc-1','The Ordinary Niacinamide 10% + Zinc 1%',736,736],
  ['sunscreen','skin1004-sun-serum','SKIN1004 Sun Serum',736,736]
].map(([key,slug,name,width,height])=>{
  const url='/assets/image/'+slug+'.jpg';
  return [key,{slug,name,description:name,displayOnly:true,image_url:url,images:[url],image_assets:[{url,width,height}]}];
}));
const LOCAL_PHOTOS=LOCAL_PRODUCTS.filter(p=>/^\/assets\/image\/[a-z0-9-]+\.jpg$/.test(p?.image_url||''));
function localPhoto(slug,match,fallback='cleanser'){
  return LOCAL_PHOTOS.find(p=>p.slug===slug)||(match&&LOCAL_PHOTOS.find(match))||PHOTO_FALLBACKS[fallback];
}
function categoryPhoto(category){
  const slug=category?.slug||CATEGORIES.find(c=>c.name===category?.name)?.slug;
  const preferred={
    skincare:'cerave-foaming-facial-cleanser',
    haircare:'loreal-paris-fresh-hyaluron-moisture-72hr-moisture-sealing-conditioner-frizz',
    bodycare:'cerave-body-wash-with-salicylic-acid',
    cosmetics:'maybelline-new-york-super-stay-teddy-tint-liquid-lipstick-90-ribbon-tied-5-m',
    daily:'cerave-foaming-facial-cleanser',
    gift:'the-ordinary-skin-care-pack'
  };
  return localPhoto(preferred[slug],p=>p.category===slug);
}
function journalPhoto(article){
  const choices={
    'why-sunscreen':['skin1004-sun-serum','sunscreen','sunscreen'],
    'how-to-choose-serum':['the-ordinary-niacinamide-10-plus-zinc-1','serum','serum'],
    'know-your-skin-type':['neutrogena-hydro-boost-water-gel','moisturizer','cleanser'],
    'face-wash-frequency':['cerave-foaming-facial-cleanser','cleanser','cleanser'],
    'skincare-routine-steps':['the-ordinary-skin-care-pack','combo','cleanser'],
    'beauty-myths':['neutrogena-hydro-boost-water-gel','moisturizer','cleanser']
  };
  const [slug,sub,fallback]=choices[article.slug]||choices['how-to-choose-serum'];
  return localPhoto(slug,p=>p.sub===sub,fallback);
}
function artSVG(p,options={}){
  return productImage(p?.id||p?.sku||p?.apiId||p?.image_url?p:categoryPhoto(p),options);
}
function artMini(p){return artSVG(p);}

/* ==========================================================================
 * 5. ICONS
 * ======================================================================== */
const ICON = {
  cart:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.4 11.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H5"/></svg>',
  heart:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.9z"/></svg>',
  eye:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  trash:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  chevron:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  arrowRight:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  truck:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.2"/><circle cx="18.5" cy="18.5" r="2.2"/></svg>',
  shield:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v7c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V5z"/><path d="m9 12 2 2 4-4"/></svg>',
  leaf:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-6 7-11 16-11 0 9-5 16-11 16z"/><path d="M4 21c3-5 7-8 12-10"/></svg>',
  info:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  plus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  close:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  user:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  box:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>',
  pin:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  ticket:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v2M13 11v2M13 16v2"/></svg>',
  cog:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.7H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9.3a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  logout:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>',
  chart:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/></svg>',
  home:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  grid:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></svg>',
  search:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  filter:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>',
  phone:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/></svg>',
  mail:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
  fb:'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7h-2.5V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
  ig:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>',
  wa:'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.4-2 1.4-.5.1-1.1.1-1.8-.1a13 13 0 0 1-6.6-5.8c-.5-.9-.8-1.9-.5-2.9.2-.6.9-1.5 1.4-1.6.3-.1.7 0 .9.4l.8 1.4c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4-.1.6.5.9 1.6 2 2.6 2.5.2.1.4.1.6-.1l.6-.6c.2-.2.4-.2.7-.1l1.4.7c.3.2.5.5.4.9z"/></svg>'
};

/* ==========================================================================
 * 6. CART CALC
 * ======================================================================== */
function deliveryCharge(division,district,subtotal){
  const cfg=window.GNConfig?.shipping||{dhaka:60,outside:120,freeThreshold:2500};
  if(cfg.freeThreshold&&subtotal>=cfg.freeThreshold)return 0;
  return division==='ঢাকা'&&district==='ঢাকা'?cfg.dhaka:cfg.outside;
}
function quoteItems(){return Store.cartLines().filter(row=>!row.product.displayOnly&&Number.isInteger(row.product.apiId)&&row.product.apiId>0).map(row=>({product_id:row.product.apiId,qty:row.qty,...(row.variant_id?{variant_id:row.variant_id}:{})}));}
function quoteKey(division,district){return JSON.stringify({items:quoteItems(),coupon:Checkout.couponCode||null,division:division||'ঢাকা',district:district||'ঢাকা'});}
async function requestQuote(division,district){
  const key=quoteKey(division,district),quote=await GNApi.post('/api/checkout/quote',JSON.parse(key));
  if(key===quoteKey(division,district)){Checkout.quote=quote;Checkout.quoteKey=key;}
  return quote;
}
function calcTotals(opts={}){
  const lines=Store.cartLines(),subtotal=lines.reduce((sum,row)=>sum+row.subtotal,0);
  const q=Checkout.quote;
  if(q&&Checkout.quoteKey===quoteKey(opts.division,opts.district))return {lines,subtotal:q.subtotal_minor/100,discount:q.discount_minor/100,delivery:q.delivery_minor/100,tax:q.tax_minor/100,total:q.total_minor/100,couponMsg:'',shipFree:q.delivery_minor===0};
  const delivery=deliveryCharge(opts.division,opts.district,subtotal);
  return {lines,subtotal,discount:0,delivery,tax:0,total:subtotal+delivery,couponMsg:'Final price is verified by the server.',shipFree:delivery===0};
}

/* ==========================================================================
 * 7. TOASTS / MODAL / DRAWERS
 * ======================================================================== */
function toast(msg, type){
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.innerHTML = (type === 'ok' ? ICON.check : type === 'err' ? ICON.info : ICON.info) + '<span>' + esc(msg) + '</span>';
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 2800);
}

function openModal(html){
  $('#modalBox').innerHTML =
    '<button class="modal-close" data-action="close-modal" aria-label="Close">' + ICON.close + '</button>' + html;
  $('#modalScrim').classList.add('open');
  document.body.classList.add('no-scroll');
}
function closeModal(){
  $('#modalScrim').classList.remove('open');
  document.body.classList.remove('no-scroll');
}
function openDrawer(id){
  if (id === 'cart') renderCartDrawer();
  $('#' + id).classList.add('open');
  $('#' + id).setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('open');
  document.body.classList.add('no-scroll');
}
function closeOverlays(){
  ['menuDrawer','cartDrawer'].forEach(id => {
    const el = $('#' + id);
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
  });
  const f = $('#filtersPanel');
  if (f) f.classList.remove('open');
  $('#scrim').classList.remove('open');
  const adm = $('#adminSide');
  if (adm) adm.classList.remove('open');
  document.body.classList.remove('no-scroll');
  closeModal();
}

/* ==========================================================================
 * 8. COMPONENTS
 * ======================================================================== */
const Nav = {
  items: [
    { href:'#/',            label:'Home',            match:[''] },
    { href:'#/c/skincare',  label:'Skin Care',    match:['c/skincare'] },
    { href:'#/c/haircare',  label:'Hair Care',    match:['c/haircare'] },
    { href:'#/c/bodycare',  label:'Body Care',      match:['c/bodycare'] },
    { href:'#/c/cosmetics', label:'Cosmetics',       match:['c/cosmetics'] },
    { href:'#/c/daily',     label:'Daily Care',  match:['c/daily'] },
    { href:'#/shop?sort=new', label:'New Arrivals',     match:['shop?sort=new'] },
    { href:'#/shop?deal=1', label:'Offers',           match:['shop?deal=1'] }
  ],
  render(route){
    const nav = $('#navDesktop');
    nav.innerHTML = this.items.map(it => {
      const active = it.href === '#/' ? route.path.length === 0 : route.raw.includes(it.match[0]);
      return `<a href="${it.href}" class="${active ? 'active' : ''}">${esc(it.label)}</a>`;
    }).join('');

    $('#drawerNav').innerHTML = this.items.map(it =>
      `<a href="${it.href}" data-action="close-overlays">${esc(it.label)}</a>`
    ).join('') +
    `<a href="#/journal" data-action="close-overlays">Glow Journal</a>
     <a href="#/track" data-action="close-overlays">Track Order</a>
     <a href="#/page/faq" data-action="close-overlays">FAQs</a>`;

    const mnav = [
      { href:'#/', label:'Home', icon:ICON.home, match:r => r.path.length === 0 },
      { href:'#/shop', label:'Shop', icon:ICON.grid, match:r => r.path[0] === 'shop' || r.path[0] === 'c' },
      { href:'#/search', label:'Search', icon:ICON.search, match:r => r.path[0] === 'search' },
      { href:'#/cart', label:'Bag', icon:ICON.cart, match:r => r.path[0] === 'cart', badge:true },
      { href:'#/account', label:'Account', icon:ICON.user, match:r => r.path[0] === 'account' || r.path[0] === 'wishlist' }
    ];
    $('#mobileNav').innerHTML = '<ul>' + mnav.map(m => `
      <li><a href="${m.href}" class="${m.match(route) ? 'active' : ''}">
        ${m.icon}<span>${m.label}</span>
        ${m.badge ? `<span class="badge" id="mCartBadge" ${Store.cartCount() ? '' : 'hidden'}>${bn(Store.cartCount())}</span>` : ''}
      </a></li>`).join('') + '</ul>';
  }
};

function productCard(p, opts){
  opts = opts || {};
  if(p.displayOnly)return `
  <article class="pcard pcard-local" data-id="${esc(p.id)}">
    <div class="pcard-media">
      <a href="#/p/${esc(p.slug)}" aria-label="${esc(p.name)}">${productImage(p,opts)}</a>
      <button class="pcard-wish ${Store.inWishlist(p.id)?'on':''}" data-action="wish" data-id="${esc(p.id)}" aria-label="Add to wishlist" title="Add to wishlist">${ICON.heart}</button>
      <button class="pcard-quick" data-action="quick" data-id="${esc(p.id)}">Quick view</button>
    </div>
    <div class="pcard-body">
      ${p.brand?`<span class="pcard-brand">${esc(p.brand)}</span>`:''}
      <h3 class="pcard-name"><a href="#/p/${esc(p.slug)}">${esc(p.name)}</a></h3>
      <p class="pcard-short">${esc(p.description)}</p>
      <div class="pcard-actions"><a class="btn btn-primary btn-sm" href="#/p/${esc(p.slug)}">View details</a></div>
    </div>
  </article>`;
  const off = discountPct(p);
  const out = p.stock <= 0;
  const r = Store.ratingFor(p.id);
  const rating = r.count ? r.rating : 0;

  let badges = '';
  if (out) badges += '<span class="chip out">Out of stock</span>';
  else if (off >= 15) badges += `<span class="chip sale">${bn(off)}% off</span>`;
  else if (p.compare && p.compare > p.price) badges += `<span class="chip sale">On sale</span>`;
  if (p.tags && p.tags.includes('combo')) badges += '<span class="chip new">Gift set</span>';
  if (p.demo) badges += '<span class="chip demo">Demo product</span>';

  const stockLine = out
    ? '<span class="stock-out"><span class="dot-i"></span>Out of stock</span>'
    : p.stock <= 10
      ? `<span class="stock-low"><span class="dot-i"></span>In stock (${bn(p.stock)} left)</span>`
      : '<span class="stock-in"><span class="dot-i"></span>In stock</span>';

  const ratingLine = r.count
    ? `${starsHtml(rating)} <span>${bn(rating.toFixed(1))} (${bn(r.count)})</span>`
    : '<span class="pill-demo">New product — no reviews yet</span>';

  return `
  <article class="pcard" data-id="${p.id}">
    <div class="pcard-media">
      <a href="#/p/${p.slug}" aria-label="${esc(p.name)}">${artSVG(p)}</a>
      <div class="pcard-badges">${badges}</div>
      <button class="pcard-wish ${Store.inWishlist(p.id) ? 'on' : ''}" data-action="wish" data-id="${p.id}"
              aria-label="Add to wishlist" title="Add to wishlist">${ICON.heart}</button>
      <button class="pcard-quick" data-action="quick" data-id="${p.id}">Quick view</button>
    </div>
    <div class="pcard-body">
      <span class="pcard-brand">${esc(p.brand)}</span>
      <h3 class="pcard-name"><a href="#/p/${p.slug}">${esc(p.name)}</a></h3>
      <p class="pcard-short">${esc(p.short || p.description)}</p>
      <div class="pcard-rating">${ratingLine}</div>
      <div class="pcard-price">
        <span class="price-now">${money(p.price)}</span>
        ${p.compare > p.price ? `<span class="price-old">${money(p.compare)}</span>` : ''}
      </div>
      <div class="pcard-stock">${stockLine}</div>
      <div class="gn-card-ingredients"><small>Key ingredients</small><span>${esc((p.ingredients||[]).slice(0,4).join(' · ')||'Not provided')}</span></div>
      <div class="pcard-actions">
        <button class="btn btn-primary btn-sm" data-action="add" data-id="${p.id}" ${out ? 'disabled' : ''}>
          ${out ? 'Out of stock' : 'Add to bag'}
        </button>
      </div>
    </div>
  </article>`;
}

function productGrid(list, opts){
  if(Store.state.catalogLoading)return skeletonGrid(8);
  if (!list.length) return emptyState('search');
  return '<div class="prod-grid"'+(opts?.collection?' data-local-collection':'')+'>' + list.map((p,i) => productCard(p,{eager:!!opts?.eager&&i<4})).join('') + '</div>';
}

function skeletonGrid(n){
  let h = '<div class="prod-grid">';
  for (let i = 0; i < (n || 8); i++){
    h += `<div class="sk-card"><div class="sk sk-media"></div><div class="sk-body">
      <div class="sk sk-line" style="width:38%"></div>
      <div class="sk sk-line" style="width:88%"></div>
      <div class="sk sk-line" style="width:64%"></div>
      <div class="sk sk-line" style="width:46%;height:16px;margin-top:14px"></div>
    </div></div>`;
  }
  return h + '</div>';
}

function emptyState(type, extra){
  const map = {
    cart:{ icon:ICON.cart, title:'Your bag is empty.', text:'Add your favorite products to your bag to get started.', btn:'Start shopping', href:'#/shop' },
    wishlist:{ icon:ICON.heart, title:'Your wishlist is empty.', text:'Save products you love here and find them easily later.', btn:'Browse products', href:'#/shop' },
    search:{ icon:ICON.search, title:'No products found.', text:'Try searching by a different name, brand or ingredient.', btn:'Browse all products', href:'#/shop' },
    orders:{ icon:ICON.box, title:'You have no orders yet.', text:'Your orders will appear here once you place one.', btn:'Start shopping', href:'#/shop' },
    generic:{ icon:ICON.info, title:'Nothing to show here.', text:'Try another page or return to the home page.', btn:'Back to home', href:'#/' }
  };
  const m = map[type] || map.generic;
  return `<div class="empty">
    <div class="e-icon">${m.icon}</div>
    <h3>${esc(m.title)}</h3>
    <p>${esc(m.text)}</p>
    ${extra || `<a href="${m.href}" class="btn btn-primary">${esc(m.btn)}</a>`}
  </div>`;
}

/* ---------- Cart drawer ---------- */
function renderCartDrawer(){
  const totals = calcTotals({});
  const body = $('#cartDrawerBody');
  const foot = $('#cartDrawerFoot');

  if (!totals.lines.length){
    body.innerHTML = `<div class="empty" style="padding:50px 10px">
      <div class="e-icon">${ICON.cart}</div>
      <h3>Your bag is empty.</h3>
      <p>Add products you love and start shopping.</p>
      <a href="#/shop" class="btn btn-primary" data-action="close-overlays">Start shopping</a>
    </div>`;
    foot.innerHTML = '';
    return;
  }

  body.innerHTML = totals.lines.map(l => `
    <div class="co-line">
      <div class="co-line-img">${artMini(l.product)}</div>
      <div class="co-line-info">
        <b>${esc(l.product.name)}</b>
        <span>${money(l.product.price)} × ${bn(l.qty)}</span>
        <div class="qty" style="margin-top:8px;height:34px">
          <button data-action="qty" data-id="${l.id}" data-delta="-1" aria-label="Decrease quantity" style="width:34px;height:34px">${ICON.minus}</button>
          <input type="text" value="${bn(l.qty)}" readonly aria-label="Quantity" style="width:40px;height:34px">
          <button data-action="qty" data-id="${l.id}" data-delta="1" aria-label="Increase quantity" style="width:34px;height:34px">${ICON.plus}</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
        <span class="co-line-price">${money(l.subtotal)}</span>
        <button class="cart-remove" data-action="remove" data-id="${l.id}" aria-label="Remove item">${ICON.trash}</button>
      </div>
    </div>`).join('');

  foot.innerHTML = `
    <div class="sum-row" style="padding-top:0"><span>Subtotal</span><span class="v">${money(totals.subtotal)}</span></div>
    <div class="sum-row"><span>Delivery</span><span class="v">${totals.subtotal >= 2500 ? 'Free' : 'Calculated at checkout'}</span></div>
    <div class="sum-total"><span>Estimated total</span><span class="v">${money(totals.subtotal)}</span></div>
    <a href="#/checkout" class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-action="close-overlays">Proceed to checkout</a>
    <a href="#/cart" class="btn btn-outline btn-block" style="margin-top:9px" data-action="close-overlays">View bag</a>
    <p class="tiny muted center" style="margin:12px 0 0">Delivery fees are added at checkout.</p>`;
}

/* ---------- Header badges ---------- */
function updateBadges(bump){
  const c = Store.cartCount(), w = Store.state.wishlist.length;
  const cb = $('#cartBadge'), wb = $('#wishBadge'), mb = $('#mCartBadge');
  if (cb){ cb.hidden = !c; cb.textContent = bn(c); if (bump) { cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump'); } }
  if (wb){ wb.hidden = !w; wb.textContent = bn(w); }
  if (mb){ mb.hidden = !c; mb.textContent = bn(c); }
}

/* ==========================================================================
 * 9. VIEWS
 * ======================================================================== */

/* ---------- Home ---------- */
function viewHome(){
  const all = Store.products();
  const offers = LOCAL_MODE?all:all.filter(p => p.compare > p.price).slice(0, 8);
  const newArrivals = all.slice(0, 4);
  const deals = all.filter(p => discountPct(p) >= 10).slice(0, 4);
  const recent = Store.state.recent.map(id => Store.product(id)).filter(Boolean).slice(0, 4);
  const b = Store.state.banners.find(x => x.active) || Store.state.banners[0] || {};

  const heroProducts = all.slice(0, 3);
  const heroVideos=(window.GNLocalVideos||[]).map(mediaURL);
  const heroPhotos=[PHOTO_FALLBACKS.cleanser,PHOTO_FALLBACKS.serum,PHOTO_FALLBACKS.sunscreen].map((fallback,index)=>heroProducts[index]||fallback);


  return `
  <section class="hero">
    <div class="hero-background" aria-hidden="true">
      <video data-hero-background-video autoplay muted playsinline preload="metadata" tabindex="-1" src="${esc(heroVideos[0]||'')}" data-video-playlist="${esc(heroVideos.join('|'))}"></video>
    </div>
    <div class="wrap hero-grid">
      <div class="reveal">
        <span class="hero-eyebrow">${ICON.leaf} Beauty and care, made for Bangladesh</span>
        <h1>${esc(b.title || 'Everyday care, made simple.')}</h1>
        <p class="hero-sub">${esc(b.sub || 'Skin, hair and daily care essentials — all in one place.')}</p>
        <div class="hero-cta">
          <a href="#/shop" class="btn btn-primary btn-lg">Start shopping ${ICON.arrowRight}</a>
          <a href="#/shop?sort=new" class="btn btn-outline btn-lg">Explore new arrivals</a>
        </div>
        <div class="hero-meta">
          <div><strong>Curated catalog</strong><span>Check delivery coverage at checkout</span></div>
          <div><strong>Cash on delivery</strong><span>Pay when your order arrives</span></div>
          <div><strong>Delivery quote</strong><span>Verified at checkout</span></div>
        </div>
      </div>
      <div class="hero-visual reveal">
        <div class="hv-inner hero-links">
          ${heroPhotos.map(p => `<div class="hero-link-card"><div class="hero-link-photo">${productImage(p,{eager:true})}</div></div>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <!-- Trust strip -->
  <section class="trust">
    <div class="wrap">
      <div class="trust-grid">
        <div class="trust-item">${ICON.leaf}<div><b>Thoughtfully selected</b><span>Clear information about ingredients and product origin</span></div></div>
        <div class="trust-item">${ICON.info}<div><b>Product details you can trust</b><span>Directions, suitability and cautions — without exaggerated claims</span></div></div>
        <div class="trust-item">${ICON.truck}<div><b>Delivery across Bangladesh</b><span>Check delivery fees and coverage for your address</span></div></div>
        <div class="trust-item">${ICON.shield}<div><b>Secure ordering</b><span>Cash on delivery and order verification</span></div></div>
      </div>
    </div>
  </section>

  <!-- Categories -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>Find the right care for you</h2>
          <p class="sub">Start with the products that fit your routine.</p>
        </div>
        <a href="#/shop" class="sec-link">Browse all products ${ICON.arrowRight}</a>
      </div>
      <div class="cat-grid reveal">
        ${CATEGORIES.slice(0, 4).map(c => {
          const count = Store.products().filter(p => p.category === c.slug).length;
          return `<a class="cat-card" href="#/c/${c.slug}">
            <div class="cc-art">${artSVG(categoryPhoto(c))}</div>
            <div class="cc-body">
              <b>${esc(c.name)}</b>
              <span>${esc(c.desc)}</span>
              <span style="margin-top:6px;color:var(--sage-deep);font-weight:600">${bn(count)} products</span>
            </div>
          </a>`;
        }).join('')}
      </div>
      <div class="cat-grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
        ${CATEGORIES.slice(4).map(c => {
          const count = Store.products().filter(p => p.category === c.slug).length;
          return `<a class="cat-card" href="#/c/${c.slug}" style="display:grid;grid-template-columns:132px 1fr;align-items:center">
            <div class="cc-art" style="aspect-ratio:1/1">${artSVG(categoryPhoto(c))}</div>
            <div class="cc-body">
              <b>${esc(c.name)}</b>
              <span>${esc(c.desc)}</span>
              <span style="margin-top:6px;color:var(--sage-deep);font-weight:600">${bn(count)} products</span>
            </div>
          </a>`;
        }).join('')}
      </div>
    </div>
  </section>

  <!-- Bestsellers -->
  <section class="section section-alt">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>${LOCAL_MODE?'Our collection':'Featured offers'}</h2>
          <p class="sub">${LOCAL_MODE?'Explore every image in our beauty and care collection.':'A thoughtful selection of products on sale.'}</p>
        </div>
        <a href="#/shop" class="sec-link">Browse all products ${ICON.arrowRight}</a>
      </div>
      <div${LOCAL_MODE?'':' class="reveal"'}>${productGrid(offers,{collection:LOCAL_MODE})}</div>
    </div>
  </section>

  <!-- New arrivals -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>Just arrived</h2>
          <p class="sub">The latest additions to our catalog.</p>
        </div>
        <a href="#/shop?sort=new" class="sec-link">View new arrivals ${ICON.arrowRight}</a>
      </div>
      <div class="reveal">${productGrid(newArrivals)}</div>
    </div>
  </section>

  <!-- Skincare collection -->
  <section class="section section-alt">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>Skin care collection</h2>
          <p class="sub">Cleanse → hydrate → protect — the essentials of a daily routine.</p>
        </div>
        <a href="#/c/skincare" class="sec-link">Explore the collection ${ICON.arrowRight}</a>
      </div>
      <div class="reveal">${productGrid(Store.products().filter(p => p.category === 'skincare').slice(0, 4))}</div>
    </div>
  </section>

  <!-- Daily care + Essentials -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>Daily care and beauty essentials</h2>
          <p class="sub">Everyday products for your routine.</p>
        </div>
        <a href="#/shop" class="sec-link">Explore all ${ICON.arrowRight}</a>
      </div>
      <div class="reveal">${productGrid(Store.products().filter(p => ['daily','bodycare','cosmetics'].includes(p.category)).slice(0, 4))}</div>
    </div>
  </section>

  <!-- Promotional collection -->
  <section class="section tight">
    <div class="wrap">
      <div style="background:var(--rose-soft);border-radius:var(--r-lg);padding:clamp(26px,4vw,44px);display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center" class="reveal">
        <div>
          <span class="chip sale" style="margin-bottom:12px;display:inline-block">Featured today</span>
          <h2 style="margin-bottom:8px">Save with gift sets</h2>
          <p class="muted" style="margin:0;max-width:56ch">Everyday routine essentials, together in one easy set.</p>
        </div>
        <a href="#/c/gift" class="btn btn-primary btn-lg">Explore gift sets</a>
      </div>
    </div>
  </section>

  <!-- Recently viewed -->
  ${recent.length ? `
  <section class="section tight">
    <div class="wrap">
      <div class="sec-head"><div><h2>Recently viewed</h2></div></div>
      <div>${productGrid(recent)}</div>
    </div>
  </section>` : ''}

  <!-- Journal -->
  <section class="section section-alt">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>Glow Journal</h2>
          <p class="sub">Practical information about skin, hair and everyday care.</p>
        </div>
        <a href="#/journal" class="sec-link">Read all articles ${ICON.arrowRight}</a>
      </div>
      <div class="journal-grid reveal">
        ${window.GNConfig?.journalEnabled ? ARTICLES.slice(0,3).map(a=>journalCard(a)).join('') : '<p class="muted">New articles will be published after editorial review.</p>'}
      </div>
    </div>
  </section>

  <!-- Brand section -->
  <section class="section">
    <div class="wrap">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,56px);align-items:center" class="reveal">
        <div>
          <span class="hero-eyebrow" style="background:var(--rose-soft);color:#8E5A60">${ICON.heart} Our promise</span>
          <h2>Why Glow Nuture</h2>
          <p class="muted" style="line-height:1.95">We believe beauty is about care, not promises. We share clear information about ingredients, directions and suitability for every product — without exaggerated or unverified claims.</p>
          <ul style="margin-top:18px" class="stack-8">
            <li style="display:flex;gap:10px;align-items:flex-start;color:var(--muted)">${ICON.check}<span>Full ingredient lists for every product</span></li>
            <li style="display:flex;gap:10px;align-items:flex-start;color:var(--muted)">${ICON.check}<span>Clear suitability and caution information</span></li>
            <li style="display:flex;gap:10px;align-items:flex-start;color:var(--muted)">${ICON.check}<span>No fake reviews or inflated sales numbers</span></li>
          </ul>
        </div>
        <div class="cat-grid" style="grid-template-columns:1fr 1fr;gap:12px">
          ${CATEGORIES.slice(0,4).map(c => `<div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden">
            <div class="promise-art" style="aspect-ratio:1/.9">${artSVG(categoryPhoto(c))}</div>
            <div style="padding:12px 14px"><b style="font-size:.9rem">${esc(c.name)}</b></div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="section section-alt">
    <div class="wrap" style="max-width:860px">
      <div class="sec-head" style="justify-content:center;text-align:center;flex-direction:column;align-items:center">
        <h2>Frequently asked questions</h2>
        <p class="sub" style="text-align:center">Find answers to common questions.</p>
      </div>
      <div class="acc" id="faqAcc">
        ${PAGES.faq.faqs.slice(0,6).map(([q,a], i) => `
          <div class="acc-item ${i === 0 ? 'open' : ''}">
            <button class="acc-head" data-action="acc" aria-expanded="${i===0}">${esc(q)} ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">${esc(a)}</div></div>
          </div>`).join('')}
      </div>
      <div class="center" style="margin-top:24px"><a href="#/page/faq" class="btn btn-outline">View all FAQs</a></div>
    </div>
  </section>

  <!-- Newsletter -->
  <section class="section">
    <div class="wrap">
      <div class="newsletter reveal">
        <div>
          <h2>Want updates on new products and offers?</h2>
          <p>We’ll occasionally send useful updates. No spam.</p>
        </div>
        <form class="nl-form" data-form="newsletter">
          <input type="email" class="input" placeholder="Your email address" required aria-label="Email address" />
          <button class="btn btn-primary" type="submit">Subscribe</button>
        </form>
      </div>
    </div>
  </section>`;
}

function journalCard(a){
  return `<a class="jcard" href="#/journal/${a.slug}">
    <div class="jc-art">${artSVG(journalPhoto(a))}</div>
    <div class="jcard-body">
      <span class="cat">${esc(a.cat)}</span>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.excerpt)}</p>
      <span class="jmeta">${esc(a.read)} read</span>
    </div>
  </a>`;
}

/* ---------- Shop / category ---------- */
function viewShop(route){
  const q = route.query;
  const isCategory = route.path[0] === 'c';
  const catSlug = isCategory ? route.path[1] : null;
  const cat = catSlug ? CATEGORIES.find(c => c.slug === catSlug) : null;

  const filters = {
    cat: q.cat ? q.cat.split(',') : (catSlug ? [catSlug] : []),
    sub: q.sub ? q.sub.split(',') : [],
    brand: q.brand ? q.brand.split(',') : [],
    skin: q.skin ? q.skin.split(',') : [],
    concern: q.concern ? q.concern.split(',') : [],
    min: q.min ? +q.min : null,
    max: q.max ? +q.max : null,
    inStock: q.stock === '1',
    deal: q.deal === '1',
    sort: q.sort || 'popular',
    page: +(q.page || 1)
  };
  if(LOCAL_MODE){filters.skin=[];filters.concern=[];filters.min=null;filters.max=null;filters.inStock=false;filters.deal=false;if(!['popular','new','name'].includes(filters.sort))filters.sort='popular';}

  let list = Store.products().slice();
  if (filters.cat.length) list = list.filter(p => filters.cat.includes(p.category));
  if (filters.sub.length) list = list.filter(p => filters.sub.includes(p.sub));
  if (filters.brand.length) list = list.filter(p => filters.brand.includes(p.brand));
  if (filters.skin.length) list = list.filter(p => p.skin.some(s => filters.skin.includes(s)));
  if (filters.concern.length) list = list.filter(p => p.concerns.some(c => filters.concern.includes(c)));
  if (filters.min != null) list = list.filter(p => p.price >= filters.min);
  if (filters.max != null) list = list.filter(p => p.price <= filters.max);
  if (filters.inStock) list = list.filter(p => p.stock > 0);
  if (filters.deal) list = list.filter(p => p.compare > p.price);

  const sorters = {
    name:(a,b)=>a.name.localeCompare(b.name),
    popular:(a,b) => (b.reviews - a.reviews) || (discountPct(b) - discountPct(a)),
    new:(a,b) => (b.id > a.id ? 1 : -1),
    'price-asc':(a,b) => a.price - b.price,
    'price-desc':(a,b) => b.price - a.price,
    rating:(a,b) => Store.ratingFor(b.id).rating - Store.ratingFor(a.id).rating
  };
  list.sort(sorters[filters.sort] || sorters.popular);

  const PER = 12;
  const shown = LOCAL_MODE?list:list.slice(0, PER * filters.page);
  const hasMore = shown.length < list.length;

  const title = cat ? cat.name : (filters.deal ? 'Offers' : 'All Products');
  const sub = cat ? cat.desc : 'Find products that fit your needs using the filters.';

  return `
  <div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb">
      <a href="#/">Home</a><span class="sep">/</span>
      ${cat ? `<a href="#/shop">All Products</a><span class="sep">/</span><span>${esc(cat.name)}</span>`
            : `<span>${esc(title)}</span>`}
    </nav>

    <div class="section tight" style="padding-top:14px">
      <div class="sec-head">
        <div>
          <h1 style="font-size:clamp(1.5rem,3vw,2.1rem)">${esc(title)}</h1>
          <p class="sub">${esc(sub)}</p>
        </div>
      </div>

      <div class="shop-layout">
        <aside class="filters" id="filtersPanel" aria-label="Filters">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <h3 style="font-size:1rem">Filters</h3>
            <button class="btn btn-ghost btn-sm" data-action="clear-filters">Reset</button>
          </div>
          ${filterGroup('Category', 'cat', CATEGORIES.map(c => ({ v:c.slug, l:c.name, n:Store.products().filter(p => p.category === c.slug).length })), filters.cat)}
          ${filterGroup('Product type', 'sub', Object.keys(SUBS).map(k => ({ v:k, l:SUBS[k], n:Store.products().filter(p => p.sub === k).length })).filter(x => x.n), filters.sub)}
          ${filterGroup('Brand', 'brand', [...new Set(Store.products().map(p => p.brand))].map(b => ({ v:b, l:b, n:Store.products().filter(p => p.brand === b).length })), filters.brand)}
          ${filterGroup('Skin type', 'skin', Object.keys(SKIN_TYPES).map(k => ({ v:k, l:SKIN_TYPES[k], n:Store.products().filter(p => p.skin.includes(k)).length })).filter(x => x.n), filters.skin)}
          ${filterGroup('Concern', 'concern', Object.keys(CONCERNS).map(k => ({ v:k, l:CONCERNS[k], n:Store.products().filter(p => p.concerns.includes(k)).length })).filter(x => x.n), filters.concern)}

          ${LOCAL_MODE?'':`<div class="fgroup">
            <h4 data-action="toggle-fgroup">Price (৳) ${ICON.chevron}</h4>
            <div class="fbody">
              <div class="price-inputs">
                <input type="number" id="fMin" placeholder="Minimum" value="${filters.min != null ? filters.min : ''}" />
                <span class="muted">—</span>
                <input type="number" id="fMax" placeholder="Maximum" value="${filters.max != null ? filters.max : ''}" />
              </div>
              <button class="btn btn-outline btn-sm btn-block" style="margin-top:10px" data-action="apply-price">Apply price</button>
            </div>
          </div>`}

          ${LOCAL_MODE?'':`<div class="fgroup">
            <h4 data-action="toggle-fgroup">More filters ${ICON.chevron}</h4>
            <div class="fbody">
              <label class="check"><input type="checkbox" data-filter="stock" ${filters.inStock ? 'checked' : ''}/> In-stock products only</label>
              <label class="check"><input type="checkbox" data-filter="deal" ${filters.deal ? 'checked' : ''}/> On-sale products only</label>
            </div>
          </div>`}

          <button class="btn btn-primary btn-block" style="margin-top:16px;display:none" data-action="close-overlays" id="mobileFilterApply">Show results</button>
        </aside>

        <div>
          <div class="shop-toolbar">
            <span class="shop-count"><b>${bn(list.length)}</b> products found</span>
            <div class="toolbar-right">
              <button class="btn btn-outline btn-sm filter-btn" data-action="open-filters">${ICON.filter} Filters</button>
              <select class="select" id="sortSelect" aria-label="Sort products">
                <option value="popular" ${filters.sort === 'popular' ? 'selected' : ''}>${LOCAL_MODE?'Collection order':'Most popular'}</option>
                <option value="new" ${filters.sort === 'new' ? 'selected' : ''}>Newest</option>
                ${LOCAL_MODE?`<option value="name" ${filters.sort==='name'?'selected':''}>Name: A to Z</option>`:`<option value="price-asc" ${filters.sort === 'price-asc' ? 'selected' : ''}>Price: low to high</option>
                <option value="price-desc" ${filters.sort === 'price-desc' ? 'selected' : ''}>Price: high to low</option>
                <option value="rating" ${filters.sort === 'rating' ? 'selected' : ''}>Top rated</option>`}
              </select>
            </div>
          </div>

          ${activeFilterChips(filters)}

          ${list.length ? productGrid(shown,{eager:true}) + (hasMore ? `
            <div class="center" style="margin-top:32px">
              <button class="btn btn-outline btn-lg" data-action="load-more">Load more products</button>
            </div>` : '') : emptyState('search')}
        </div>
      </div>
    </div>
  </div>`;
}

function filterGroup(title, key, items, selected){
  if (!items.length) return '';
  return `<div class="fgroup">
    <h4 data-action="toggle-fgroup">${esc(title)} ${ICON.chevron}</h4>
    <div class="fbody">
      ${items.map(it => `<label class="check">
        <input type="checkbox" data-filter="${key}" value="${esc(it.v)}" ${selected.includes(String(it.v)) ? 'checked' : ''}/>
        <span>${esc(it.l)}</span><span class="cnt">${bn(it.n)}</span>
      </label>`).join('')}
    </div>
  </div>`;
}

function activeFilterChips(f){
  const chips = [];
  const push = (label, key, val) => chips.push(
    `<span class="af-chip">${esc(label)}<button data-action="rm-filter" data-key="${key}" data-val="${esc(val)}" aria-label="Remove filter">${ICON.close}</button></span>`);
  f.cat.forEach(v => { const c = CATEGORIES.find(x => x.slug === v); push(c ? c.name : v, 'cat', v); });
  f.sub.forEach(v => push(SUBS[v] || v, 'sub', v));
  f.brand.forEach(v => push(v, 'brand', v));
  f.skin.forEach(v => push(SKIN_TYPES[v] || v, 'skin', v));
  f.concern.forEach(v => push(CONCERNS[v] || v, 'concern', v));
  if (f.min != null) push('Minimum ' + money(f.min), 'min', f.min);
  if (f.max != null) push('Maximum ' + money(f.max), 'max', f.max);
  if (f.inStock) push('In stock', 'stock', '1');
  if (f.deal) push('On sale', 'deal', '1');
  if (!chips.length) return '';
  return `<div class="active-filters">${chips.join('')}
    <button class="af-chip" data-action="clear-filters" style="border-style:dashed">Clear all</button></div>`;
}

/* ---------- Search ---------- */
function viewSearch(route){
  const q = (route.query.q || '').trim();
  if (!q) return `<div class="wrap section">${emptyState('search')}</div>`;

  const term = q.toLowerCase();
  const list = Store.products().filter(p =>
    p.name.toLowerCase().includes(term) ||
    p.en.toLowerCase().includes(term) ||
    p.brand.toLowerCase().includes(term) ||
    p.short.toLowerCase().includes(term) ||
    p.tags.some(t => t.toLowerCase().includes(term)) ||
    p.ingredients.some(i => i.toLowerCase().includes(term)) ||
    (SUBS[p.sub] || '').includes(q)
  );

  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Search</span></nav>
    <div class="section tight">
      <div class="sec-head">
        <div><h1 style="font-size:clamp(1.4rem,2.6vw,1.9rem)">Results for “${esc(q)}”</h1>
        <p class="sub">${bn(list.length)} products found.</p></div>
      </div>
      ${list.length ? productGrid(list) : emptyState('search')}
    </div>
  </div>`;
}

/* ---------- Product detail ---------- */
function viewProduct(route){
  const p = Store.product(route.path[1]);
  if (!p) return `<div class="wrap section">${emptyState('generic')}</div>`;

  Store.pushRecent(p.id);
  if(p.displayOnly){
    const related=Store.products().filter(item=>item.id!==p.id&&item.category===p.category).slice(0,4);
    return `<div class="wrap">
      <nav class="crumb" aria-label="Breadcrumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/shop">All Products</a><span class="sep">/</span><span>${esc(p.name)}</span></nav>
      <div class="pd-layout pd-local">
        <div class="pd-gallery"><div class="pd-main" id="pdMain">${productImage(p,{eager:true,sizes:'(max-width: 800px) 90vw, 50vw'})}</div></div>
        <div>
          ${p.brand?`<span class="pd-brand">${esc(p.brand)}</span>`:''}
          <h1 class="pd-title">${esc(p.name)}</h1>
          <p class="pd-short">${esc(p.description)}</p>
          <div class="pd-wishline"><button data-action="wish" data-id="${esc(p.id)}" class="${Store.inWishlist(p.id)?'on':''}">${ICON.heart} ${Store.inWishlist(p.id)?'Saved to wishlist':'Add to wishlist'}</button></div>
          <div class="gn-button-row"><button class="btn btn-outline" data-extra="compare" data-id="${esc(p.id)}">${Store.state.comparison.includes(p.id)?'Compared · remove':'Compare'}</button><a href="#/shop" class="btn btn-primary">Explore collection</a></div>
        </div>
      </div>
      ${related.length?`<section class="section"><div class="sec-head"><h2>Explore more</h2></div>${productGrid(related)}</section>`:''}
    </div>`;
  }

  const off = discountPct(p);
  const r = Store.ratingFor(p.id);
  const reviews = Store.reviewsFor(p.id);
  const out = p.stock <= 0;
  const related = Store.products().filter(x => x.id !== p.id && (x.category === p.category || x.sub === p.sub)).slice(0, 4);

  const gallery=[...new Set([p.image_url,...(p.images||[])].filter(Boolean))];
  const thumbs=gallery.map((url,i)=>`<button class="pd-thumb ${i===0?'active':''}" data-action="thumb" data-i="${i}" aria-pressed="${i===0}" aria-label="Image ${bn(i+1)}">${artMini({...p,image_url:url})}</button>`).join('');

  return `<div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb">
      <a href="#/">Home</a><span class="sep">/</span>
      <a href="#/shop">All Products</a><span class="sep">/</span>
      <a href="#/c/${p.category}">${esc((CATEGORIES.find(c => c.slug === p.category) || {}).name || '')}</a>
      <span class="sep">/</span><span>${esc(p.name)}</span>
    </nav>

    <div class="pd-layout">
      <div class="pd-gallery">
        <div class="pd-main" id="pdMain">${productImage(p,{eager:true,sizes:'(max-width: 800px) 90vw, 50vw'})}</div>
        <div class="pd-thumbs">${thumbs}</div>

      </div>

      <div>
        <span class="pd-brand">${esc(p.brand)}</span>
        <h1 class="pd-title">${esc(p.name)}</h1>
        <p class="pd-en">${esc(p.en)}</p>

        <div class="pd-rating">
          ${r.count ? `${starsHtml(r.rating)} <b style="color:var(--charcoal)">${bn(r.rating.toFixed(1))}</b> <span>(${bn(r.count)} reviews)</span>`
                    : `<span class="pill-demo">No reviews yet</span>`}
          ${p.demo ? '<span class="pill-demo">Demo product</span>' : ''}
        </div>

        <div class="pd-price">
          <span class="price-now">${money(p.price)}</span>
          ${p.compare > p.price ? `<span class="price-old">${money(p.compare)}</span><span class="price-off">${bn(off)}% off</span>` : ''}
        </div>

        <p class="pd-short">${esc(p.short)}</p>



        <div class="pd-specs">
          <div><span class="k">Availability</span><span class="v">${out ? '<span style="color:var(--muted)">Out of stock</span>' : '<span style="color:var(--success)">In stock</span>'}</span></div>
          <div><span class="k">Size</span><span class="v">${esc(p.size)}</span></div>
          <div><span class="k">SKU</span><span class="v en">${esc(p.sku)}</span></div>
          <div><span class="k">Origin</span><span class="v">${esc(p.origin)}</span></div>
          <div><span class="k">Skin type</span><span class="v">${p.skin.map(s => esc(SKIN_TYPES[s] || s)).join(', ') || '—'}</span></div>
          <div><span class="k">When to use</span><span class="v">${p.tags.includes('night care') ? 'Evening' : p.tags.includes('sunscreen') ? 'Morning' : 'Morning and evening'}</span></div>
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
          <div class="qty">
            <button data-action="pd-qty" data-delta="-1" aria-label="Decrease quantity">${ICON.minus}</button>
            <input type="text" id="pdQty" value="1" aria-label="Quantity" />
            <button data-action="pd-qty" data-delta="1" aria-label="Increase quantity">${ICON.plus}</button>
          </div>
          <span class="tiny muted">${out ? '' : `Maximum ${bn(p.stock)} per order`}</span>
        </div>

        <div class="pd-buy">
          <button class="btn btn-primary btn-lg" data-action="buy-now" data-id="${p.id}" ${out ? 'disabled' : ''}>Buy now</button>
          <button class="btn btn-outline btn-lg" data-action="add" data-id="${p.id}" data-qty-source="pdQty" ${out ? 'disabled' : ''}>
            ${ICON.cart} Add to bag
          </button>
        </div>

        <div class="pd-wishline">
          <button data-action="wish" data-id="${p.id}" class="${Store.inWishlist(p.id) ? 'on' : ''}">
            ${ICON.heart} ${Store.inWishlist(p.id) ? 'Saved to wishlist' : 'Add to wishlist'}
          </button>
        </div>

        <div class="pd-assure">
          <div>${ICON.truck}<span>Delivery across Bangladesh. 1–2 business days in Dhaka.</span></div>
          <div>${ICON.shield}<span>Cash on delivery is available.</span></div>
          <div>${ICON.box}<span>Report any issue within 24 hours of delivery.</span></div>
          <div>${ICON.phone}<span>Our team may call to verify your order.</span></div>
        </div>

        <div class="acc" style="margin-top:24px">
          <div class="acc-item open">
            <button class="acc-head" data-action="acc" aria-expanded="true">About this product ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner"><p style="margin:0">${esc(p.description)}</p></div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">How to use ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner"><p style="margin:0">${esc(p.usage)}</p></div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">Key ingredients ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              ${p.ingredients.length ? `<ul>${p.ingredients.map(i => `<li class="en" style="font-family:'Inter',sans-serif">${esc(i)}</li>`).join('')}</ul>` : '<p>Please check the packaging for the full ingredient list.</p>'}
            </div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">Who it’s for ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              <p><b>Skin type:</b> ${p.skin.map(s => esc(SKIN_TYPES[s] || s)).join(', ') || '—'}</p>
              <p style="margin:0"><b>Concerns:</b> ${p.concerns.map(c => CONCERNS[c] || c).join(', ') || 'Everyday care'}</p>
              <div class="tag-row">${p.tags.map(t => `<span class="tag en">${esc(t)}</span>`).join('')}</div>
            </div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">Origin and brand ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              <p style="margin:0"><b>Brand:</b> ${esc(p.brand)}<br/><b>Origin:</b> ${esc(p.origin)}<br/><b>Size:</b> ${esc(p.size)}<br/><b>SKU:</b> <span class="en">${esc(p.sku)}</span></p>
            </div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">Cautions ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              <ul>
                <li>For external use only.</li>
                <li>Avoid contact with eyes. Rinse with clean water if contact occurs.</li>
                <li>Check the ingredient list before use if you have a known allergy.</li>
                <li>Patch test on a small area, such as your arm or behind your ear, before use.</li>
                <li>Store in a cool, dry place away from direct sunlight.</li>
                <li>Stop use if irritation occurs and consult a healthcare professional.</li>
              </ul>
            </div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">Delivery information ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              <ul>
                <li>Dhaka delivery fee: ${money(window.GNConfig?.shipping?.dhaka||0)}. Confirm coverage at checkout.</li>
                <li>Delivery fee outside Dhaka: ${money(window.GNConfig?.shipping?.outside||0)}.</li>
                <li>Free-delivery threshold: ${money(window.GNConfig?.shipping?.freeThreshold||0)}. The final fee is shown in the server quote.</li>
                <li>Cash on delivery is available.</li>
              </ul>
            </div></div>
          </div>
        </div>

        <!-- Reviews -->
        <div style="margin-top:34px" id="reviews">
          <h3 style="margin-bottom:6px">Reviews (${bn(reviews.length)})</h3>
          <p class="tiny muted" style="margin-bottom:18px">Only verified customer feedback is shown here. We do not create fake reviews.</p>

          ${reviews.length ? reviews.map(rv => `
            <div class="review">
              <div class="review-top">
                <span class="review-name">${esc(rv.name)}</span>
                <span class="review-date">${esc(timeAgo(rv.date))}</span>
              </div>
              <div style="margin-bottom:6px">${starsHtml(rv.rating)}</div>
              <p class="review-text">${esc(rv.text)}</p>
            </div>`).join('') : '<p class="muted" style="font-size:.9rem">No reviews yet. You can be the first to review this product.</p>'}

          <form data-form="review" data-id="${p.id}" style="margin-top:22px;background:var(--surface-2);padding:20px;border-radius:var(--r)">
            <h4 style="font-size:.98rem;margin-bottom:12px">Write a review</h4>
            <div class="form-row">
              <label class="field"><span class="lbl">Your name <span class="req">*</span></span>
                <input class="input" name="name" required placeholder="Your name" value="${Store.state.user ? esc(Store.state.user.name) : ''}"/></label>
              <div class="field">
                <span class="lbl">Rating <span class="req">*</span></span>
                <div class="stars-input" data-stars>
                  ${[1,2,3,4,5].map(i => `<button type="button" data-action="star" data-v="${i}" aria-label="${bn(i)} stars">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>
                  </button>`).join('')}
                  <input type="hidden" name="rating" value="0"/>
                </div>
              </div>
            </div>
            <label class="field"><span class="lbl">Your experience <span class="req">*</span></span>
              <textarea class="textarea" name="text" required placeholder="Tell us briefly about your experience with this product…"></textarea></label>
            <button class="btn btn-primary" type="submit">Submit review</button>
          </form>
        </div>
      </div>
    </div>

    ${related.length ? `
    <section class="section">
      <div class="sec-head"><div><h2>Related products</h2></div><a href="#/c/${p.category}" class="sec-link">View more ${ICON.arrowRight}</a></div>
      ${productGrid(related)}
    </section>` : ''}
  </div>`;
}

/* ---------- Cart page ---------- */
function viewCart(){
  const totals = calcTotals({});
  if (!totals.lines.length){
    return `<div class="wrap section">${emptyState('cart')}</div>`;
  }
  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Bag</span></nav>
    <div class="section tight">
      <h1 style="font-size:clamp(1.5rem,3vw,2rem);margin-bottom:22px">Your bag</h1>
      <div class="cart-layout">
        <div>
          <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:0 20px">
            ${totals.lines.map(l => `
              <div class="cart-line">
                <a href="#/p/${l.product.slug}" class="cart-thumb">${artMini(l.product)}</a>
                <div>
                  <div class="cart-name"><a href="#/p/${l.product.slug}">${esc(l.product.name)}</a></div>
                  <div class="cart-meta">${esc(l.product.brand)} • ${esc(l.product.size)} • <span class="en">${esc(l.product.sku)}</span></div>
                  <div class="cart-line-actions">
                    <div class="qty">
                      <button data-action="qty" data-id="${l.id}" data-delta="-1" aria-label="Decrease quantity">${ICON.minus}</button>
                      <input type="text" value="${bn(l.qty)}" readonly aria-label="Quantity" />
                      <button data-action="qty" data-id="${l.id}" data-delta="1" aria-label="Increase quantity" ${l.qty >= l.product.stock ? 'disabled' : ''}>${ICON.plus}</button>
                    </div>
                    <button class="cart-remove" data-action="remove" data-id="${l.id}">${ICON.trash} Remove</button>
                  </div>
                </div>
                <div class="cart-line-total">
                  ${money(l.subtotal)}
                  <div class="tiny muted" style="font-weight:400">${money(l.product.price)} × ${bn(l.qty)}</div>
                </div>
              </div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-top:16px;flex-wrap:wrap">
            <a href="#/shop" class="btn btn-outline">Continue shopping</a>
            <button class="btn btn-ghost" data-action="clear-cart" style="color:var(--danger)">${ICON.trash} Clear bag</button>
          </div>
        </div>

        <aside class="summary">
          <h3>Order summary</h3>
          <div class="sum-row"><span>Subtotal</span><span class="v">${money(totals.subtotal)}</span></div>
          <div class="sum-row"><span>Delivery</span><span class="v">${totals.subtotal >= 2500 ? 'Free' : 'Calculated at checkout'}</span></div>
          <div class="sum-total"><span>Total (before delivery)</span><span class="v">${money(totals.subtotal)}</span></div>

          <div class="coupon-box">
            <input class="input" id="couponInput" placeholder="Enter a coupon code" aria-label="Coupon code" />
            <button class="btn btn-outline" data-action="apply-coupon">Apply</button>
          </div>
          <span class="coupon-msg" id="couponMsg"></span>

          ${window.GNConfig?.shipping?.freeThreshold && totals.subtotal < window.GNConfig.shipping.freeThreshold ? `<div class="ship-note">${ICON.info}<span>Free delivery starts at ${money(window.GNConfig.shipping.freeThreshold)}. Confirm your final delivery fee at checkout.</span></div>` : ''}

          <a href="#/checkout" class="btn btn-primary btn-block btn-lg" style="margin-top:18px">Proceed to checkout</a>
          <p class="tiny muted center" style="margin:12px 0 0">Delivery fees and payment options are confirmed at checkout.</p>
        </aside>
      </div>
    </div>
  </div>`;
}

/* ---------- Checkout ---------- */
function viewCheckout(){
  if(!window.GNConfig?.checkoutEnabled)return '<div class="wrap section"><div class="co-card"><h1>Checkout setup pending</h1><p>Orders will be accepted once the seller information and business setup are approved.</p><a class="btn btn-primary" href="#/page/contact">Support</a></div></div>';
  const totals = calcTotals({});
  if (!totals.lines.length) return `<div class="wrap section">${emptyState('cart')}</div>`;

  const u = Store.state.user || {};
  const savedAddr = (u.addresses && u.addresses[0]) || {};

  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/cart">Bag</a><span class="sep">/</span><span>Checkout</span></nav>
    <div class="section tight">
      <h1 style="font-size:clamp(1.5rem,3vw,2rem);margin-bottom:6px">Checkout</h1>
      <p class="muted" style="margin-bottom:26px">Enter your details so our team can verify and deliver your order.</p>

      <form id="checkoutForm">
        <div class="co-layout">
          <div>
            <!-- Contact -->
            <div class="co-card">
              <h3><span class="co-step">1</span> Contact information</h3>
              <p class="hint">We’ll use these details to verify and deliver your order.</p>
              <div class="form-row">
                <label class="field"><span class="lbl">Name <span class="req">*</span></span>
                  <input class="input" name="name" required value="${esc(u.name || '')}" placeholder="Your full name" autocomplete="name"/></label>
                <label class="field"><span class="lbl">Mobile number <span class="req">*</span></span>
                  <input class="input en" name="phone" required value="${esc(u.phone || '')}" placeholder="01XXXXXXXXX" inputmode="numeric" maxlength="11" autocomplete="tel"/></label>
              </div>
              <label class="field"><span class="lbl">Alternate mobile number</span>
                <input class="input en" name="phone2" placeholder="Optional" inputmode="numeric" maxlength="11"/></label>
              <label class="field"><span class="lbl">Email (optional)</span>
                <input class="input en" name="email" type="email" value="${esc(u.email || '')}" placeholder="e.g. name@email.com" autocomplete="email"/></label>
            </div>

            <!-- Address -->
            <div class="co-card">
              <h3><span class="co-step">2</span> Delivery address</h3>
              <p class="hint">A complete address helps us deliver your order faster.</p>
              <div class="form-row">
                <label class="field"><span class="lbl">Division <span class="req">*</span></span>
                  <select class="select" name="division" id="divisionSel" required>
                    <option value="">Select a division</option>
                    ${Object.keys(DIVISIONS).map(d => `<option value="${esc(d)}" ${savedAddr.division === d ? 'selected' : ''}>${esc(locationLabel(d))}</option>`).join('')}
                  </select></label>
                <label class="field"><span class="lbl">District <span class="req">*</span></span>
                  <select class="select" name="district" id="districtSel" required>
                    <option value="">Select a division first</option>
                  </select></label>
              </div>
              <div class="form-row">
                <label class="field"><span class="lbl">Upazila / police station <span class="req">*</span></span>
                  <input class="input" name="upazila" required value="${esc(savedAddr.upazila || '')}" placeholder="e.g. Savar"/></label>
                <label class="field"><span class="lbl">Area / post office</span>
                  <input class="input" name="area" value="${esc(savedAddr.area || '')}" placeholder="e.g. Ashulia"/></label>
              </div>
              <label class="field"><span class="lbl">House / road / full address <span class="req">*</span></span>
                <textarea class="textarea" name="address" required placeholder="House number, road, landmark…">${esc(savedAddr.address || '')}</textarea></label>
              <label class="field" style="margin-bottom:0"><span class="lbl">Delivery instructions</span>
                <input class="input" name="note" placeholder="Optional — e.g. call after 4 PM"/></label>
            </div>

            <div class="co-card"><h3><span class="co-step">3</span> Delivery</h3><p class="hint">The server calculates the delivery fee by district. Support will confirm the estimated delivery time.</p></div>
            <div class="co-card"><h3><span class="co-step">4</span> Payment</h3>
              ${window.GNConfig?.payments?.cod?'<label class="pay-option sel"><input type="radio" name="payment" value="cod" checked><div><b>Cash on delivery</b><span>Pay the courier when your order arrives.</span></div></label>':''}
              <label class="pay-option ${window.GNConfig?.payments?.online?'':'dis'}"><input type="radio" name="payment" value="online" ${window.GNConfig?.payments?.online?(!window.GNConfig?.payments?.cod?'checked':''):'disabled'}><div><b>SSLCommerz · Card / bKash / Nagad</b><span>${window.GNConfig?.payments?.online?(window.GNConfig.payments.sandbox?'SANDBOX TEST · no real payment will be taken':'Choose from the payment methods available in the provider’s hosted checkout'):'Online payment is unavailable until merchant setup is complete'}</span></div></label>
              <p class="tiny muted">This site never collects your card number, CVV or PIN. Payments are confirmed by the provider.</p>
            </div>
          </div>

          <!-- Order summary -->
          <aside class="summary">
            <h3>Your order</h3>
            ${totals.lines.map(l => `
              <div class="co-line">
                <div class="co-line-img">${artMini(l.product)}</div>
                <div class="co-line-info">
                  <b>${esc(l.product.name)}</b>
                  <span>${money(l.product.price)} × ${bn(l.qty)}</span>
                </div>
                <span class="co-line-price">${money(l.subtotal)}</span>
              </div>`).join('')}

            <div style="margin-top:16px">
              <div class="coupon-box">
                <input class="input" id="couponInput" placeholder="Coupon code" aria-label="Coupon code" value="${esc(Checkout.couponCode || '')}" />
                <button class="btn btn-outline" type="button" data-action="apply-coupon">Apply</button>
              </div>
              <span class="coupon-msg" id="couponMsg"></span>
            </div>

            <div class="sum-row" style="margin-top:10px"><span>Subtotal</span><span class="v">${money(totals.subtotal)}</span></div>
            ${totals.discount ? `<div class="sum-row discount"><span>Discount</span><span class="v">− ${money(totals.discount)}</span></div>` : ''}
            <div class="sum-row"><span>Delivery</span><span class="v">${money(totals.delivery)}</span></div>
            <div class="sum-total"><span>Total</span><span class="v">${money(totals.total)}</span></div>

            <div style="margin-top:16px;display:flex;gap:9px;align-items:flex-start;font-size:.82rem;color:var(--muted);line-height:1.7">
              ${ICON.shield}<span>Your information is used only to process your order.</span>
            </div>

            <label class="gn-checkbox"><input type="checkbox" name="accept_terms" required><span>I have read the <a href="#/page/terms">terms</a> and <a href="#/page/privacy">privacy policy</a>.</span></label><div data-recaptcha="checkout"></div><div id="quoteState" class="tiny muted" role="status">Verifying delivery quote…</div>
            <button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" type="submit" id="placeOrderBtn">Place order</button>
          </aside>
        </div>
      </form>
    </div>
  </div>`;
}

/* Checkout scratch state (not persisted) */
const Checkout={couponCode:'',coupon:null,quote:null,quoteKey:'',placing:false,attempt:null,shipping:{division:'',district:''}};

/* Server order numbers, payment states and totals only. */
function viewOrderSuccess(route){return orderView(Store.order(route.path[1])||Store.state.lastOrder,true);}
function viewOrder(route){return orderView(Store.order(route.path[1]),false);}
function orderView(o,success){
  if(!o)return '<div class="wrap section"><p>Use your order ID and private tracking code, or open your account orders.</p><a href="#/track" class="btn btn-primary">Track order</a></div>';
  const labels={pending:'Pending',confirmed:'Confirmed',processing:'Processing',packed:'Packed',shipped:'Shipped',delivered:'Delivered',failed_delivery:'Delivery failed',cancelled:'Cancelled',returned:'Returned',refunded:'Refunded'};
  const c=o.customer||{},flow=['pending','confirmed','processing','packed','shipped','delivered'],cur=flow.indexOf(o.status);
  return '<div class="wrap section" style="max-width:860px">'+(success?'<div class="success-hero"><div class="success-icon">'+ICON.check+'</div><h1>Order received</h1><p class="muted">An order confirmation does not mean an online payment succeeded. Check the payment status.</p></div>':'<h1>Your order</h1>')+
    '<div class="order-box"><div class="order-meta"><div><span>Order ID</span><b class="en">'+esc(o.id)+'</b></div><div><span>Date</span><b>'+bnDate(o.createdAt||o.created_at)+'</b></div><div><span>Status</span><b>'+esc(labels[o.status]||o.status)+'</b></div><div><span>Payment</span><b>'+esc(o.payment_status)+' · '+esc(o.payment)+'</b></div>'+(c.name?'<div><span>Customer</span><b>'+esc(c.name)+'</b></div>':'')+(c.address?'<div><span>Address</span><b>'+esc(c.address+', '+(c.district||''))+'</b></div>':'')+'</div>'+
    o.items.map(it=>'<div class="co-line"><div class="co-line-info"><b>'+esc(it.name)+'</b><span>'+esc(it.label||'')+' · '+money(it.price)+' × '+bn(it.qty)+'</span></div><span class="co-line-price">'+money(it.price*it.qty)+'</span></div>').join('')+
    [['Subtotal',o.subtotal],['Discount',-o.discount],['Delivery',o.delivery],['Tax',o.tax||0]].map(([label,value])=>'<div class="sum-row"><span>'+label+'</span><span class="v">'+money(value)+'</span></div>').join('')+
    '<div class="sum-total"><span>Total</span><span class="v">'+money(o.total)+'</span></div>'+
    (o.tracking_token?'<div class="note-box"><b>Private tracking code — save this code</b><code class="gn-private-code">'+esc(o.tracking_token)+'</code><p class="tiny">You’ll need both this code and your order ID to view a guest order. The code is also on your invoice.</p><button class="btn btn-outline btn-sm" data-extra="copy-track" data-id="'+esc(o.id)+'">Copy code</button></div>':'')+
    '<div class="gn-button-row"><button class="btn btn-primary" data-extra="invoice" data-id="'+esc(o.id)+'">Invoice / receipt</button>'+
    (Store.state.user&&['delivered','failed_delivery'].includes(o.status)?'<button class="btn btn-outline" data-extra="return" data-id="'+esc(o.id)+'">Return request</button>':'')+
    (o.payment==='online'&&o.payment_status==='pending'&&o.tracking_token?'<button class="btn btn-outline" data-extra="pay" data-id="'+esc(o.id)+'">Secure payment</button>':'')+
    '<a href="#/shop" class="btn btn-ghost">Shop</a></div></div>'+
    (cur>=0?'<div class="order-box" style="margin-top:20px"><div class="track-steps">'+flow.map((stage,i)=>'<div class="tstep '+(i<=cur?'done':'')+' '+(i===cur?'current':'')+'"><div class="tdot">'+bn(i+1)+'</div><div class="tstep-info"><b>'+esc(labels[stage])+'</b></div></div>').join('')+'</div></div>':'')+
    (o.shipment?'<div class="order-box" style="margin-top:20px"><h3>Courier</h3><p>'+esc(o.shipment.provider)+' · '+esc(o.shipment.tracking_number)+' · '+esc(o.shipment.status)+'</p></div>':'')+'</div>';
}

function viewTrack(){
  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Track order</span></nav>
    <div class="section tight" style="max-width:600px;margin-inline:auto">
      <h1 style="font-size:clamp(1.4rem,3vw,1.9rem);text-align:center;margin-bottom:8px">Track your order</h1>
      <p class="muted center" style="margin-bottom:26px">Enter your order ID and the private tracking code from your invoice.</p>
      <form data-form="track" class="co-card">
        <label class="field"><span class="lbl">Order ID <span class="req">*</span></span>
          <input class="input en" name="orderId" required placeholder="GN-…" /></label>
        <label class="field"><span class="lbl">Private tracking code <span class="req">*</span></span><input class="input en" name="token" required minlength="20" maxlength="100" autocomplete="off"></label>
        <button class="btn btn-primary btn-block btn-lg" type="submit">Find order</button>
      </form>
      <div id="trackResult" style="margin-top:20px"></div>
    </div>
  </div>`;
}

/* ---------- Wishlist ---------- */
function viewWishlist(){
  const list = Store.state.wishlist.map(id => Store.product(id)).filter(Boolean);
  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Wishlist</span></nav>
    <div class="section tight">
      <div class="sec-head"><div><h1 style="font-size:clamp(1.4rem,3vw,1.9rem)">Wishlist</h1>
      <p class="sub">${bn(list.length)} saved products.</p></div></div>
      ${list.length ? productGrid(list) : emptyState('wishlist')}
    </div>
  </div>`;
}

/* ---------- Account ---------- */
function viewAccount(route){
  const sub = route.path[1] || 'profile';
  const u = Store.state.user;

  if (!u) return viewAuth(route);

  const tabs = [
    { k:'profile',  href:'#/account',            label:'Profile',        icon:ICON.user },
    { k:'orders',   href:'#/account/orders',     label:'My orders',     icon:ICON.box },
    { k:'wishlist', href:'#/wishlist',           label:'Wishlist',  icon:ICON.heart },
    { k:'address',  href:'#/account/address',    label:'Addresses',          icon:ICON.pin },
    { k:'coupons',  href:'#/account/coupons',    label:'Coupons',            icon:ICON.ticket },
    { k:'settings', href:'#/account/settings',   label:'Account settings', icon:ICON.cog },
    {k:'notifications',href:'#/account/notifications',label:'Notifications',icon:ICON.info}
  ];

  let panel = '';
  if (sub === 'profile') panel = acctProfile(u);
  else if (sub === 'orders') panel = acctOrders(u);
  else if (sub === 'address') panel = acctAddress(u);
  else if (sub === 'coupons') panel = acctCoupons();
  else if(sub==='settings')panel=window.GNExtra?.settings(u)||acctSettings(u);
  else if(sub==='notifications')panel=window.GNExtra?.notifications()||'';
  else panel = acctProfile(u);

  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>My account</span></nav>
    <div class="section tight">
      <div class="acct-layout">
        <aside class="acct-nav">
          ${tabs.map(t => `<a href="${t.href}" class="${(sub === t.k || (t.k === 'profile' && !route.path[1])) ? 'active' : ''}">${t.icon}<span>${esc(t.label)}</span></a>`).join('')}
          <a href="#" data-action="logout" class="danger">${ICON.logout}<span>Sign out</span></a>
        </aside>
        <div class="acct-panel">${panel}</div>
      </div>
    </div>
  </div>`;
}

function acctProfile(u){
  const orders = Store.state.orders;
  return `<h2>My account</h2>
  <p class="muted" style="margin-bottom:22px">Welcome, ${esc(u.name)}.</p>
  <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:22px">
    <div class="stat-card"><span>Total orders</span><b>${bn(orders.length)}</b></div>
    <div class="stat-card"><span>Wishlist items</span><b>${bn(Store.state.wishlist.length)}</b></div>
    <div class="stat-card"><span>Saved addresses</span><b>${bn((u.addresses || []).length)}</b></div>
  </div>
  <h3 style="font-size:1rem;margin-bottom:12px">Personal information</h3>
  <div class="order-meta" style="grid-template-columns:1fr 1fr;border:none;padding:0;margin:0">
    <div><span>Name</span><b>${esc(u.name)}</b></div>
    <div><span>Mobile</span><b class="en">${esc(u.phone)}</b></div>
    <div><span>Email</span><b class="en">${esc(u.email || '—')}</b></div>
    <div><span>Joined</span><b>${u.created_at?bnDate(u.created_at):'—'}</b></div>
  </div>
  <a href="#/account/settings" class="btn btn-outline" style="margin-top:18px">Edit information</a>`;
}

function acctOrders(){
  const u = Store.state.user;
  const orders = Store.state.orders;
  if (!orders.length) return `<h2>My orders</h2>${emptyState('orders')}`;
  const labels = { pending:'Pending', confirmed:'Confirmed', processing:'Processing', shipped:'Shipped', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned' };
  return `<h2>My orders</h2>
  <p class="muted" style="margin-bottom:20px">${bn(orders.length)} orders found.</p>
  ${orders.map(o => `
    <div class="order-card">
      <div class="oc-top">
        <div>
          <span class="oc-id en">${esc(o.id)}</span>
          <span class="oc-date"> • ${bnDate(o.createdAt)}</span>
        </div>
        <span class="status st-${esc(o.status)}">${esc(labels[o.status] || o.status)}</span>
      </div>
      <div class="tiny muted" style="margin-bottom:10px">${o.items.length} items • ${money(o.total)} • ${o.payment === 'cod' ? 'Cash on delivery' : esc(o.payment)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a href="#/order/${o.id}" class="btn btn-outline btn-sm">View details</a>
        ${o.status === 'delivered' ? `<button class="btn btn-ghost btn-sm" data-action="reorder" data-id="${esc(o.id)}">Order again</button>` : ''}
      </div>
    </div>`).join('')}`;
}

function acctAddress(u){
  const addrs = u.addresses || [];
  return `<h2>Saved addresses</h2>
  <p class="muted" style="margin-bottom:20px">These details will be filled in automatically at checkout.</p>
  ${addrs.length ? addrs.map((a, i) => `
    <div class="order-card">
      <div class="oc-top">
        <b style="font-size:.92rem">${esc(a.label || 'Address ' + bn(i+1))}</b>
        <button class="icon-mini danger" data-action="del-address" data-i="${i}" aria-label="Delete address">${ICON.trash}</button>
      </div>
      <p class="tiny muted" style="margin:0;line-height:1.8">${esc(a.address)}, ${esc(a.upazila || '')}, ${esc(locationLabel(a.district))}, ${esc(locationLabel(a.division))}</p>
    </div>`).join('') : '<p class="muted" style="font-size:.9rem">No saved addresses yet.</p>'}

  <form data-form="address" style="margin-top:24px">
    <h3 style="font-size:1rem;margin-bottom:14px">Add a new address</h3>
    <div class="form-row">
      <label class="field"><span class="lbl">Division <span class="req">*</span></span>
        <select class="select" name="division" required>
          <option value="">Select a division</option>
          ${Object.keys(DIVISIONS).map(d => `<option value="${esc(d)}">${esc(locationLabel(d))}</option>`).join('')}
        </select></label>
      <label class="field"><span class="lbl">District <span class="req">*</span></span>
        <input class="input" name="district" required placeholder="District name"/></label>
    </div>
    <div class="form-row">
      <label class="field"><span class="lbl">Upazila / police station <span class="req">*</span></span>
        <input class="input" name="upazila" required /></label>
      <label class="field"><span class="lbl">Area</span><input class="input" name="area" /></label>
    </div>
    <label class="field"><span class="lbl">Full address <span class="req">*</span></span>
      <textarea class="textarea" name="address" required></textarea></label>
    <button class="btn btn-primary" type="submit">Save address</button>
  </form>`;
}

function acctCoupons(){
  return '<h2>Coupons</h2><p class="muted">Enter a published promotional code at checkout. The server will verify its validity, usage limits and discount.</p>';
}

function acctSettings(){
  return '<h2>Account settings</h2><p class="muted" role="status">Loading account settings. Reopen this page if needed.</p>';
}

function viewAuth(){
  return `<div class="wrap section" style="max-width:520px"><h1>Account</h1>
    <div class="co-card"><form id="loginForm" data-firebase="login">
      <label class="field"><span class="lbl">Email</span><input class="input" name="email" type="email" autocomplete="email" required></label>
      <label class="field"><span class="lbl">Password</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
      <div data-recaptcha="login"></div><button class="btn btn-primary" type="submit">Sign in</button></form>
    <p class="muted" style="margin-top:16px">Sign in with your Firebase account.</p></div></div>`;
}

/* ---------- Journal ---------- */
function viewJournal(){
  if(!window.GNConfig?.journalEnabled)return '<div class="wrap section"><h1>Glow Journal</h1><p class="muted">Articles will be published after editorial review.</p></div>';
  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Glow Journal</span></nav>
    <div class="section tight">
      <div class="sec-head">
        <div><h1 style="font-size:clamp(1.5rem,3vw,2.1rem)">Glow Journal</h1>
        <p class="sub">Helpful information about skin, hair and everyday care. We do not provide medical advice.</p></div>
      </div>
      <div class="journal-grid">${ARTICLES.map(a => journalCard(a)).join('')}</div>
    </div>
  </div>`;
}

function viewArticle(route){
  if(!window.GNConfig?.journalEnabled)return viewJournal();
  const a = ARTICLES.find(x => x.slug === route.path[1]);
  if (!a) return `<div class="wrap section">${emptyState('generic')}</div>`;
  const related = ARTICLES.filter(x => x.slug !== a.slug).slice(0, 3);

  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/journal">Glow Journal</a><span class="sep">/</span><span>${esc(a.title)}</span></nav>
    <article class="section tight article">
      <span class="jmeta">${esc(a.cat)} • ${esc(a.read)} read</span>
      <h1 style="margin:10px 0 14px">${esc(a.title)}</h1>
      <p class="lead">${esc(a.excerpt)}</p>
      ${a.body.map(([type, content]) => {
        if (type === 'h2') return `<h2>${esc(content)}</h2>`;
        if (type === 'p') return `<p>${esc(content)}</p>`;
        if (type === 'note') return `<div class="note-box">${esc(content)}</div>`;
        if (type === 'ul') return `<ul>${content.map(li => `<li>${esc(li)}</li>`).join('')}</ul>`;
        return '';
      }).join('')}
      <div class="note-box" style="background:var(--surface-2);border-color:var(--line-strong);color:var(--muted)">
        This article is for general information only, not medical advice. Consult a dermatologist about ongoing skin concerns.
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:26px">
        <a href="#/journal" class="btn btn-outline">All articles</a>
        <a href="#/c/skincare" class="btn btn-primary">Shop skin care</a>
      </div>
    </article>

    <section class="section">
      <div class="sec-head"><div><h2>Read more</h2></div></div>
      <div class="journal-grid">${related.map(x => journalCard(x)).join('')}</div>
    </section>
  </div>`;
}

/* ---------- Static pages ---------- */
function viewPage(route){
  const slug=route.path[1]||'about';
  if(window.GNExtra)return window.GNExtra.page(slug);

  if (slug === 'faq'){
    return `<div class="wrap">
      <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>FAQs</span></nav>
      <div class="section tight" style="max-width:820px;margin-inline:auto">
        <h1 style="margin-bottom:10px">Frequently asked questions</h1>
        <p class="muted" style="margin-bottom:26px">Answers to the questions we hear most often.</p>
        <div class="acc">
          ${PAGES.faq.faqs.map(([q, a2], i) => `
            <div class="acc-item ${i === 0 ? 'open' : ''}">
              <button class="acc-head" data-action="acc" aria-expanded="${i === 0}">${esc(q)} ${ICON.chevron}</button>
              <div class="acc-body"><div class="acc-inner">${esc(a2)}</div></div>
            </div>`).join('')}
        </div>
        <div class="co-card" style="margin-top:30px;text-align:center">
          <h3 style="font-size:1.05rem;margin-bottom:6px">Still need help?</h3>
          <p class="muted" style="margin-bottom:16px">Contact our support team.</p>
          <a href="#/page/contact" class="btn btn-primary">Contact us</a>
        </div>
      </div>
    </div>`;
  }

  const page = PAGES[slug];
  if (!page) return `<div class="wrap section">${emptyState('generic')}</div>`;

  return `<div class="wrap">
    <nav class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>${esc(page.title)}</span></nav>
    <article class="section tight article">
      <h1>${esc(page.title)}</h1>
      <div style="margin-top:22px">${page.body}</div>
    </article>
  </div>`;
}

/* ==========================================================================
 * 10. ROUTER
 * ======================================================================== */
function parseHash(){
  const raw=(location.hash||'#/').replace(/^#/,'')||'/',[pathStr,queryStr]=raw.split('?');
  const decode=value=>{try{return decodeURIComponent(value);}catch(_){return '';}};
  const path=pathStr.split('/').filter(Boolean).map(decode).filter(Boolean);
  const query=Object.fromEntries(new URLSearchParams(queryStr||''));
  return {path,query,raw};
}

function render(){
  const route = parseHash();
  const app = $('#app');

  /* Admin route — full-bleed layout */
  if (route.path[0] === 'admin'){
    if(!$('#gn-admin'))app.innerHTML='<div id="gn-admin"><p class="wrap section">Staff dashboard loading…</p></div>';
    document.dispatchEvent(new CustomEvent('gn-admin-route'));
    window.scrollTo(0, 0);
    const mb = $('#adminMenuBtn');
    if (mb && window.innerWidth <= 920) mb.style.display = 'grid';
    Nav.render(route);
    updateBadges(false);
    return;
  }

  let html = '';
  switch (route.path[0]) {
    case undefined:  html = viewHome(); break;
    case 'shop':     html = viewShop(route); break;
    case 'c':        html = viewShop(route); break;
    case 'p':        html = viewProduct(route); break;
    case 'search':   html = viewSearch(route); break;
    case 'cart':     html = viewCart(); break;
    case 'checkout': html = viewCheckout(); break;
    case 'order':    html = viewOrder(route); break;
    case 'order-success': html = viewOrderSuccess(route); break;
    case 'track':    html = viewTrack(); break;
    case 'wishlist': html = viewWishlist(); break;
    case 'compare': html = window.GNExtra?.comparison()||''; break;
    case 'ordinary': html = window.GNExtra?.ordinary()||''; break;
    case 'account':  html = viewAccount(route); break;
    case 'journal':  html = route.path[1] ? viewArticle(route) : viewJournal(); break;
    case 'page':     html = viewPage(route); break;
    default:         html = viewHome();
  }

  app.querySelectorAll('video').forEach(video=>video.pause());
  app.innerHTML=html;
  const heroBackgroundVideo=app.querySelector('[data-hero-background-video]');
  if(heroBackgroundVideo){
    const playlist=heroBackgroundVideo.dataset.videoPlaylist.split('|').filter(Boolean);
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let currentIndex=playlist.indexOf(heroBackgroundVideo.getAttribute('src'));
    const failed=new Set();
    const play=()=>{
      const playback=heroBackgroundVideo.play();
      if(playback)playback.then(()=>{if(failed.size<playlist.length&&!motion.matches)heroBackgroundVideo.classList.remove('is-unavailable');}).catch(()=>heroBackgroundVideo.classList.add('is-unavailable'));
    };
    const advance=()=>{
      if(motion.matches||!playlist.length||failed.size>=playlist.length){heroBackgroundVideo.pause();heroBackgroundVideo.classList.add('is-unavailable');return;}
      do{
      currentIndex=(currentIndex+1)%playlist.length;
      }while(failed.has(currentIndex));
      heroBackgroundVideo.src=playlist[currentIndex];
      heroBackgroundVideo.load();
      play();
    };
    heroBackgroundVideo.muted=true;
    heroBackgroundVideo.addEventListener('ended',advance);
    heroBackgroundVideo.addEventListener('error',()=>{failed.add(currentIndex);advance();});
    if(motion.matches){heroBackgroundVideo.pause();heroBackgroundVideo.removeAttribute('autoplay');heroBackgroundVideo.preload='none';}
    else if(playlist.length)play();
  }
  document.dispatchEvent(new CustomEvent('gn-render',{detail:{route}}));
  window.scrollTo(0, 0);

  Nav.render(route);
  updateBadges(false);
  bindRoute(route);
  observeReveal();

  /* Prefill district dropdown on checkout */
  if (route.path[0] === 'checkout') initCheckoutForm();
}

function bindRoute(route){
  /* District dropdown */
  const div = $('#divisionSel');
  if (div) fillDistricts(div.value);

  /* Shop sort select */
  const sortSel = $('#sortSelect');
  if (sortSel){
    sortSel.addEventListener('change', () => {
      const r = parseHash();
      r.query.sort = sortSel.value;
      r.query.page = 1;
      navigate(route.path[0] === 'c' ? 'c/' + route.path[1] : 'shop', r.query);
    });
  }

  /* Filter checkboxes */
  $$('[data-filter]').forEach(cb => {
    cb.addEventListener('change', () => {
      const key = cb.dataset.filter;
      const r = parseHash();
      let vals = (r.query[key] || '').split(',').filter(Boolean);
      if (cb.type === 'checkbox' && cb.value){
        if (cb.checked) vals.push(cb.value); else vals = vals.filter(v => v !== cb.value);
      } else {
        vals = cb.checked ? ['1'] : [];
      }
      if (vals.length) r.query[key] = vals.join(','); else delete r.query[key];
      r.query.page = 1;
      navigate(route.path[0] === 'c' ? 'c/' + route.path[1] : 'shop', r.query);
    });
  });

  /* Stars input */
  $$('[data-stars]').forEach(box => {
    const hidden = box.querySelector('input[name="rating"]');
    box.querySelectorAll('button[data-action="star"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = +btn.dataset.v;
        hidden.value = v;
        box.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v <= v));
      });
    });
  });

  /* Search input on shop page */
  if (route.path[0] === 'search'){
    const si = $('#searchInput');
    if (si) si.value = route.query.q || '';
  }
}

function navigate(path, query){
  let h = '#/' + path;
  if (query && Object.keys(query).length){
    const qs = Object.keys(query)
      .filter(k => query[k] !== '' && query[k] != null)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(query[k]))
      .join('&');
    if (qs) h += '?' + qs;
  }
  if (location.hash === h) render(); else location.hash = h;
}

function observeReveal(){
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window)){
    els.forEach(e => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting){
        setTimeout(() => en.target.classList.add('in'), Math.min(i * 55, 260));
        io.unobserve(en.target);
      }
    });
  }, { rootMargin:'0px 0px -8% 0px', threshold:.05 });
  els.forEach(e => io.observe(e));
}

/* ==========================================================================
 * 11. CHECKOUT HELPERS
 * ======================================================================== */
function fillDistricts(division){
  const sel = $('#districtSel');
  if (!sel) return;
  const list = DIVISIONS[division] || [];
  sel.innerHTML = list.length
    ? '<option value="">Select a district</option>' + list.map(d => `<option value="${esc(d)}">${esc(locationLabel(d))}</option>`).join('')
    : '<option value="">Select a division first</option>';
}

function initCheckoutForm(){
  const div = $('#divisionSel');
  const dist = $('#districtSel');
  const saved = (Store.state.user && Store.state.user.addresses && Store.state.user.addresses[0]) || {};

  if (div && saved.division) fillDistricts(saved.division);
  if (dist && saved.district){
    const opt = Array.from(dist.options).find(o => o.value === saved.district);
    if (opt) dist.value = saved.district;
  }

  if (div){
    div.addEventListener('change', () => {
      fillDistricts(div.value);
      Checkout.shipping.division = div.value;
      updateCheckoutSummary();
    });
  }
  if (dist){
    dist.addEventListener('change', () => {
      Checkout.shipping.district = dist.value;
      updateCheckoutSummary();
    });
  }

  $$('input[name="deliveryType"]').forEach(r => {
    r.addEventListener('change', () => {
      $$('#delivDhaka, #delivOutside').forEach(l => l.classList.remove('sel'));
      r.closest('.pay-option').classList.add('sel');
      updateCheckoutSummary();
    });
  });

  $$('input[name="payment"]').forEach(r => {
    r.addEventListener('change', () => {
      $$('.pay-option[data-pay]').forEach(l => l.classList.remove('sel'));
      r.closest('.pay-option').classList.add('sel');
    });
  });

  /* Coupon prefill */
  const ci = $('#couponInput');
  if (ci && Checkout.couponCode) ci.value = Checkout.couponCode;
  renderCouponMsg();
  updateCheckoutSummary();
}

async function updateCheckoutSummary(){
  if(!['checkout','cart'].includes(parseHash().path[0]))return;
  const division=$('#divisionSel')?.value||Checkout.shipping.division||'ঢাকা',district=$('#districtSel')?.value||Checkout.shipping.district||'ঢাকা';
  Checkout.shipping={division,district};
  const status=$('#quoteState');if(status)status.textContent='Checking delivery quote…';
  try{
    const q=await requestQuote(division,district),sum=$('.summary');if(!sum)return;
    let total=sum.querySelector('.sum-total .v');if(total)total.textContent=money(q.total_minor/100);
    const rows=[['Subtotal',q.subtotal_minor],['Discount',-q.discount_minor],['Delivery',q.delivery_minor],['Tax',q.tax_minor]];
    sum.querySelectorAll('.sum-row').forEach(row=>row.remove());
    const totals=sum.querySelector('.sum-total');
    rows.forEach(([label,value])=>{const el=document.createElement('div');el.className='sum-row';el.innerHTML='<span>'+label+'</span><span class="v">'+money(value/100)+'</span>';totals?.before(el);});
    if(status)status.textContent='Server verified · BDT '+(q.total_minor/100).toFixed(2);
    renderCouponMsg();
  }catch(error){Checkout.quote=null;if(status)status.textContent=error.message;toast(error.message,'err');}
}

function renderCouponMsg(){
  const el = $('#couponMsg');
  if (!el) return;
  if (Checkout.coupon){
    el.className = 'coupon-msg ok';
    el.textContent = 'Coupon applied: ' + Checkout.coupon.code + ' — ' + Checkout.coupon.desc;
  } else if (Checkout.couponError){
    el.className = 'coupon-msg no';
    el.textContent = Checkout.couponError;
  } else {
    el.className = 'coupon-msg';
    el.textContent = '';
  }
}

/* ==========================================================================
 * 12. EVENTS
 * ======================================================================== */
document.addEventListener('click', async function(e){
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  const route = parseHash();

  switch (action){

    /* ---------- Overlays ---------- */
    case 'open-menu':  openDrawer('menuDrawer'); break;
    case 'open-cart':  openDrawer('cartDrawer'); break;
    case 'close-overlays': closeOverlays(); break;
    case 'close-modal': if (e.target.id === 'modalScrim' || el.classList.contains('modal-close')) closeModal(); break;
    case 'open-filters':
      $('#filtersPanel').classList.add('open');
      $('#scrim').classList.add('open');
      document.body.classList.add('no-scroll');
      break;
    case 'open-admin-side': { const s = $('#adminSide'); if (s) s.classList.toggle('open'); break; }

    /* ---------- Accordion ---------- */
    case 'acc': {
      const item = el.closest('.acc-item');
      const open = item.classList.toggle('open');
      el.setAttribute('aria-expanded', open ? 'true' : 'false');
      break;
    }
    case 'toggle-fgroup': {
      el.closest('.fgroup').classList.toggle('collapsed');
      break;
    }

    /* ---------- Product ---------- */
    case 'add': {
      const qtyEl = el.dataset.qtySource ? $('#' + el.dataset.qtySource) : null;
      const qty = qtyEl ? parseInt(bnEn(qtyEl.value) || '1', 10) : 1;
      const res = Store.addToCart(id, qty);
      toast(res.msg, res.ok ? 'ok' : 'err');
      if (res.ok){ updateBadges(true); renderCartDrawer(); }
      break;
    }
    case 'buy-now': {
      const qtyEl = $('#pdQty');
      const qty = qtyEl ? parseInt(bnEn(qtyEl.value) || '1', 10) : 1;
      const res = Store.addToCart(id, qty);
      if (res.ok){ updateBadges(true); navigate('checkout'); }
      else toast(res.msg, 'err');
      break;
    }
    case 'wish': {
      const on = Store.toggleWish(id);
      toast(on ? 'Added to your wishlist.' : 'Removed from your wishlist.', 'ok');
      updateBadges(false);
      if (route.path[0] === 'wishlist' || route.path[0] === 'p') render();
      else {
        $$(`.pcard-wish[data-id="${id}"]`).forEach(b => b.classList.toggle('on', on));
        const pb = document.querySelector('.pd-wishline button');
        if (pb){
          pb.classList.toggle('on', on);
          pb.innerHTML = ICON.heart + ' ' + (on ? 'Saved to wishlist' : 'Add to wishlist');
        }
      }
      break;
    }
    case 'quick': {
      const p = Store.product(id);
      if (!p) break;
      if(p.displayOnly){
        openModal(`<div class="qv-grid"><div class="qv-media">${productImage(p,{eager:true})}</div><div class="qv-body">${p.brand?`<span class="pd-brand">${esc(p.brand)}</span>`:''}<h2 class="pd-title">${esc(p.name)}</h2><p class="pd-short">${esc(p.description)}</p><a href="#/p/${esc(p.slug)}" class="btn btn-primary" data-action="close-modal">View details</a></div></div>`);
        break;
      }
      const r = Store.ratingFor(p.id);
      const out = p.stock <= 0;
      openModal(`
        <div class="qv-grid">
          <div class="qv-media">${artSVG(p)}</div>
          <div class="qv-body">
            <span class="pd-brand">${esc(p.brand)}</span>
            <h2 style="font-size:1.25rem;margin:8px 0 6px">${esc(p.name)}</h2>
            <p class="pd-en" style="margin-bottom:12px">${esc(p.en)}</p>
            <div class="pd-rating" style="margin-bottom:12px">
              ${r.count ? `${starsHtml(r.rating)} <span>${bn(r.rating.toFixed(1))} (${bn(r.count)})</span>` : '<span class="pill-demo">No reviews yet</span>'}
            </div>
            <div class="pd-price" style="margin-bottom:14px;padding-bottom:14px">
              <span class="price-now" style="font-size:1.35rem">${money(p.price)}</span>
              ${p.compare > p.price ? `<span class="price-old">${money(p.compare)}</span><span class="price-off">${bn(discountPct(p))}% off</span>` : ''}
            </div>
            <p class="muted" style="font-size:.9rem;line-height:1.85">${esc(p.short)}</p>
            <div style="margin:14px 0;font-size:.85rem;color:${out ? 'var(--muted)' : 'var(--success)'}">
              ${out ? 'Out of stock' : 'In stock'}
            </div>
            <div class="pd-specs" style="margin-bottom:16px">
              <div><span class="k">Size</span><span class="v">${esc(p.size)}</span></div>
              <div><span class="k">Skin type</span><span class="v">${p.skin.map(s => esc(SKIN_TYPES[s] || s)).join(', ') || '—'}</span></div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-primary" data-action="add" data-id="${p.id}" ${out ? 'disabled' : ''}>Add to bag</button>
              <a href="#/p/${p.slug}" class="btn btn-outline" data-action="close-modal">View details</a>
            </div>
          </div>
        </div>`);
      break;
    }
    case 'thumb': {
      const p = Store.product(route.path[1]);
      if (!p) break;
      const i = +el.dataset.i;
      $('.pd-thumb').forEach(t=>{t.classList.remove('active');t.setAttribute('aria-pressed','false');});
      el.classList.add('active');el.setAttribute('aria-pressed','true');
      const main = $('#pdMain');
      if (main){
        const variants=[...new Set([p.image_url,...(p.images||[])].filter(Boolean))].map(url=>productImage({...p,image_url:url},{eager:true,sizes:'(max-width: 800px) 90vw, 50vw'}));
        main.innerHTML = variants[i] || variants[0];
      }
      break;
    }
    case 'pd-qty': {
      const input = $('#pdQty');
      if (!input) break;
      const p = Store.product(route.path[1]);
      let v = parseInt(bnEn(input.value) || '1', 10) + (+el.dataset.delta);
      v = clamp(v, 1, p ? Math.max(1, p.stock) : 99);
      input.value = bn(v);
      break;
    }

    /* ---------- Cart ---------- */
    case 'qty': {
      const line = Store.state.cart.find(l => l.id === id);
      if (!line) break;
      Store.setQty(id, line.qty + (+el.dataset.delta));
      renderCartDrawer();
      if (route.path[0] === 'cart' || route.path[0] === 'checkout') render();
      break;
    }
    case 'remove': {
      Store.removeFromCart(id);
      toast('Item removed from your bag.', 'ok');
      renderCartDrawer();
      if (route.path[0] === 'cart' || route.path[0] === 'checkout') render();
      updateBadges(false);
      break;
    }
    case 'clear-cart': {
      if (confirm('Remove all items from your bag?')){
        Store.clearCart();
        renderCartDrawer();
        render();
      }
      break;
    }
    case 'retry-catalog':{await syncProductsFromAPI();render();break;}
    case 'apply-coupon':{
      const code=($('#couponInput')?.value||'').trim().toUpperCase();Checkout.couponCode=code;Checkout.couponError='';
      if(!code){Checkout.coupon=null;Checkout.quote=null;toast('Enter a coupon code.','err');break;}
      try{const q=await requestQuote($('#divisionSel')?.value,$('#districtSel')?.value);Checkout.coupon={code,desc:money(q.discount_minor/100)+' discount'};await updateCheckoutSummary();toast('Coupon server verified.','ok');}
      catch(error){Checkout.coupon=null;Checkout.couponCode='';Checkout.quote=null;Checkout.couponError=error.message;renderCouponMsg();}
      break;
    }

    /* ---------- Filters ---------- */
    case 'clear-filters':
      navigate(route.path[0] === 'c' ? 'c/' + route.path[1] : 'shop', {});
      break;
    case 'rm-filter': {
      const key = el.dataset.key;
      const val = el.dataset.val;
      const r = parseHash();
      if (['min','max','stock','deal'].includes(key)) delete r.query[key];
      else {
        let vals = (r.query[key] || '').split(',').filter(Boolean).filter(v => v !== val);
        if (vals.length) r.query[key] = vals.join(','); else delete r.query[key];
      }
      r.query.page = 1;
      navigate(route.path[0] === 'c' ? 'c/' + route.path[1] : 'shop', r.query);
      break;
    }
    case 'apply-price': {
      const r = parseHash();
      const mn = $('#fMin').value, mx = $('#fMax').value;
      if (mn) r.query.min = mn; else delete r.query.min;
      if (mx) r.query.max = mx; else delete r.query.max;
      r.query.page = 1;
      navigate(route.path[0] === 'c' ? 'c/' + route.path[1] : 'shop', r.query);
      break;
    }
    case 'load-more': {
      const r = parseHash();
      r.query.page = (+(r.query.page || 1)) + 1;
      navigate(route.path[0] === 'c' ? 'c/' + route.path[1] : 'shop', r.query);
      break;
    }

    /* ---------- Account ---------- */
    case 'auth-tab': {
      const tab = el.dataset.tab;
      $$('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      $$('.auth-tab').forEach(b => {
        b.style.background = b.dataset.tab === tab ? '#fff' : 'transparent';
        b.style.boxShadow = b.dataset.tab === tab ? 'var(--sh-xs)' : 'none';
      });
      $('#loginForm').style.display = tab === 'login' ? '' : 'none';
      $('#registerForm').style.display = tab === 'register' ? '' : 'none';
      break;
    }
    case 'logout':{
      e.preventDefault();
      try{await window.GNAuth.logout();Store.logout();toast('Signed out.','ok');navigate('');}catch(error){toast(error.message,'err');}
      break;
    }
    case 'del-address':{
      const address=Store.state.user?.addresses?.[Number(el.dataset.i)];if(!address)break;
      try{await GNApi.delete('/api/addresses/'+address.id);Store.setUser(await GNApi.get('/api/profile'));render();}catch(error){toast(error.message,'err');}break;
    }
    case 'reset-data': {
      if (confirm('Delete all demo data (bag, orders and account)?')) Store.resetAll();
      break;
    }
    case 'reorder': {
      const o = Store.order(el.dataset.id);
      if (!o) break;
      let added = 0;
      o.items.forEach(it => {
        const res = Store.addToCart(it.productId||'p'+String(it.product_id).padStart(2,'0'),it.qty,it.variant_id);
        if (res.ok) added++;
      });
      toast(added ? 'Items added to your bag.' : 'These products are currently out of stock.', added ? 'ok' : 'warn');
      updateBadges(true);
      navigate('cart');
      break;
    }

  }
});

/* ---------- Form submissions ---------- */
document.addEventListener('submit', async function(e){
  const form = e.target;
  const kind=form.dataset.form||(form.id==='checkoutForm'?'checkout':null);
  if(!kind||form.hasAttribute('data-firebase'))return;
  e.preventDefault();

  const fd = new FormData(form);
  const val = k => (fd.get(k) || '').toString().trim();

  if(kind==='newsletter'){
    try{await GNApi.post('/api/newsletter',{email:val('email'),consent:fd.get('consent')==='on'});toast('Subscription saved.','ok');form.reset();}catch(error){toast(error.message,'err');}return;
  }
  if(kind==='review'){
    const p=Store.product(form.dataset.id),u=Store.state.user;
    if(!u){toast('Sign in to the account used for the delivered purchase to submit a review.','err');return;}
    const o=Store.state.orders.find(o=>o.status==='delivered'&&o.items.some(i=>i.product_id===p.apiId));
    if(!o){toast('No delivered purchase was found for this product.','err');return;}
    try{await GNApi.post('/api/products/'+p.apiId+'/reviews',{order_id:o.id,rating:Number(val('rating')),text:val('text')});toast('Review submitted for moderation.','ok');form.reset();}catch(error){toast(error.message,'err');}return;
  }

  if(kind==='profile'){
    try{await GNApi.patch('/api/profile',{name:val('name'),phone:val('phone')||null,email:val('email')||null});Store.setUser(await GNApi.get('/api/profile'));toast('Profile saved.','ok');render();}catch(error){toast(error.message,'err');}return;
  }
  if(kind==='address'){
    const u=Store.state.user;if(!u)return;
    try{await GNApi.post('/api/addresses',{name:u.name,phone:u.phone,email:u.email||null,division:val('division'),district:val('district'),upazila:val('upazila'),area:val('area')||null,address:val('address')});Store.setUser(await GNApi.get('/api/profile'));toast('Address saved.','ok');render();}catch(error){toast(error.message,'err');}return;
  }
  if(kind==='track'){
    const box=$('#trackResult');if(!box)return;box.innerHTML='<p role="status">Verifying order…</p>';
    try{const o=await GNApi.post('/api/orders/track',{order_id:val('orderId').toUpperCase(),token:val('token')});o.tracking_token=val('token');Store.createOrder(o);box.innerHTML=orderView(o,false);}catch(error){box.innerHTML='<div class="co-card" role="alert">'+esc(error.message)+'</div>';}return;
  }

  /* ---- Checkout ---- */
  if (kind === 'checkout' || form.id === 'checkoutForm'){
    placeOrder(form);
    return;
  }
});

/* ---------- Place order ---------- */
async function placeOrder(form){
  if(Checkout.placing||!form.reportValidity())return;
  const fd=new FormData(form),val=k=>String(fd.get(k)||'').trim();
  if(!fd.get('accept_terms')){toast('Terms consent required.','err');return;}
  Checkout.placing=true;const btn=$('#placeOrderBtn');if(btn){btn.disabled=true;btn.textContent='Checking stock and order…';}
  try{
    const division=val('division'),district=val('district'),items=quoteItems();
    if(!items.length)throw new Error('Bag is empty.');
    const previous=Checkout.quoteKey===quoteKey(division,district)?Checkout.quote?.total_minor:null;
    const q=await requestQuote(division,district);
    if(previous!==null&&previous!==q.total_minor){await updateCheckoutSummary();throw new Error('The price or delivery fee changed. Review the updated total and confirm again.');}
    const payload={items,customer:{name:val('name'),phone:val('phone'),phone2:val('phone2')||null,email:val('email')||null,division,district,upazila:val('upazila'),area:val('area')||null,address:val('address'),note:val('note')||null},coupon:Checkout.couponCode||null,payment:val('payment')||'cod',expected_total_minor:q.total_minor,accept_terms:true};
    const identity=JSON.stringify(payload);
    if(!Checkout.attempt||Checkout.attempt.identity!==identity)Checkout.attempt={identity,key:crypto.randomUUID()};
    payload.recaptcha_token=window.GNAuth?await GNAuth.captcha('checkout',form):null;
    const o=await GNApi.post('/api/orders',payload,{headers:{'Idempotency-Key':Checkout.attempt.key}});
    Store.createOrder({...o,customer:payload.customer});Store.clearCart();Checkout.coupon=null;Checkout.couponCode='';Checkout.quote=null;Checkout.attempt=null;
    await syncProductsFromAPI();navigate('order-success/'+o.id);toast('Order '+o.id+' received.','ok');
    if(o.payment==='online'){
      try{const result=await GNApi.post('/api/payments/'+o.id+'/initiate',{order_id:o.id,token:o.tracking_token});const url=new URL(result.payment_url);if(url.protocol!=='https:'||!['sandbox.sslcommerz.com','securepay.sslcommerz.com'].includes(url.hostname))throw new Error('Unsafe payment URL');location.assign(url.href);}
      catch(error){toast('Order saved. Payment: '+error.message,'err');}
    }
  }catch(error){Checkout.quote=null;toast(error.message,'err');if(btn){btn.disabled=false;btn.textContent='Place order';}}
  finally{Checkout.placing=false;}
}

/* ==========================================================================
 * 13. SEARCH SUGGESTIONS
 * ======================================================================== */
(function initSearch(){
  const input = $('#searchInput');
  const box = $('#suggestBox');
  if (!input || !box) return;

  const popular = ['serum', 'sunscreen', 'face wash', 'niacinamide', 'SPF 50', 'moisturizer'];

  function closeSuggest(){ box.innerHTML = ''; }

  function renderSuggest(q){
    const term = (q || '').trim().toLowerCase();
    if (!term){
      box.innerHTML = `<div class="suggest">
        <div class="sg-head">Popular searches</div>
        <div class="sg-chips">${popular.map(p => `<button class="sg-chip" data-action="sg-term" data-term="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      </div>`;
      return;
    }
    const matches = Store.products().filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.en.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.tags.some(t => t.toLowerCase().includes(term)) ||
      p.ingredients.some(i => i.toLowerCase().includes(term))
    ).slice(0, 6);

    if (!matches.length){
      box.innerHTML = `<div class="suggest"><div class="sg-empty">
        <div style="margin-bottom:6px">No products found for “${esc(q)}”.</div>
        <span class="tiny">Try another name or brand.</span>
      </div></div>`;
      return;
    }
    box.innerHTML = `<div class="suggest">
      <div class="sg-head">Products</div>
      ${matches.map(p => `<a href="#/p/${p.slug}" data-action="sg-go">
        <div class="sg-img">${artMini(p)}</div>
        <div style="flex:1;min-width:0">
          <div class="sg-name">${esc(p.name)}</div>
          <div class="sg-meta">${esc(p.brand)} • ${esc(SUBS[p.sub] || '')}</div>
        </div>
        ${p.displayOnly?'':`<span class="sg-price">${money(p.price)}</span>`}
      </a>`).join('')}
      <a href="#/search?q=${encodeURIComponent(q)}" data-action="sg-go" style="border-top:1px solid var(--line);justify-content:center;font-size:.85rem;font-weight:600;color:var(--sage-deep)">
        View all results for “${esc(q)}”
      </a>
    </div>`;
  }

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => renderSuggest(input.value), 140);
  });
  input.addEventListener('focus', () => renderSuggest(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter'){
      e.preventDefault();
      const q = input.value.trim();
      closeSuggest();
      input.blur();
      if (q) navigate('search', { q });
    }
    if (e.key === 'Escape') closeSuggest();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#searchWrap')) closeSuggest();
    const sg = e.target.closest('[data-action="sg-term"]');
    if (sg){
      input.value = sg.dataset.term;
      renderSuggest(sg.dataset.term);
      input.focus();
    }
    if (e.target.closest('[data-action="sg-go"]')) closeSuggest();
  });
})();

/* ---------- Server product hydration ---------- */
async function syncProductsFromAPI(){
  Store.state.products=LOCAL_PRODUCTS.map(row=>P({...row,demo:false}));
  Store.state.cart=Store.state.cart.filter(row=>Store.product(row.id)&&!Store.product(row.id).displayOnly);
  Store.state.catalogError='';Store.state.catalogLoading=false;Store.persist();Store.emit();
}
async function loadCustomer(){
  try{
    const user=await GNApi.get('/api/auth/me');if(!user)return;
    Store.setUser(user);await GNApi.get('/api/auth/csrf');
    const orders=await GNApi.get('/api/orders/me');Store.state.orders=orders.map(o=>({...o,createdAt:o.created_at,customer:{phone:user.phone}}));
    if(LOCAL_MODE){Store.persist();return;}
    const saved=await GNApi.get('/api/customer/state');
    if(saved.cart?.length)Store.state.cart=saved.cart.map(row=>({id:'p'+String(row.product_id).padStart(2,'0'),qty:row.qty,variant_id:row.variant_id||null}));
    if(saved.wishlist?.length)Store.state.wishlist=saved.wishlist.map(id=>'p'+String(id).padStart(2,'0'));
    if(saved.comparison?.length)Store.state.comparison=saved.comparison.map(id=>'p'+String(id).padStart(2,'0'));
    Store.persist();
  }catch(error){Store.logout();}
}

/* ==========================================================================
 * 15. BOOT
 * ======================================================================== */
Store.load();
window.GNStore={store:Store,render,navigate,toast,esc,productImage,productCard,loadCustomer,syncProducts:syncProductsFromAPI,quoteItems,requestQuote,Checkout};
syncProductsFromAPI();
render();
Promise.all([window.GNConfigReady,loadCustomer()]).then(()=>{
  const route=parseHash();
  if(['account','checkout','order','order-success','admin'].includes(route.path[0]))render();
  else{Nav.render(route);updateBadges(false);}
});
Store.subscribe(()=>document.dispatchEvent(new CustomEvent('gn-state')));
let customerTimer;
Store.subscribe(()=>{
  clearTimeout(customerTimer);if(!Store.state.user||LOCAL_MODE)return;
  const serverIds=ids=>ids.map(id=>Store.product(id)).filter(p=>p&&!p.displayOnly&&Number.isInteger(p.apiId)&&p.apiId>0).map(p=>p.apiId);
  customerTimer=setTimeout(()=>GNApi.put('/api/customer/state',{cart:quoteItems(),wishlist:serverIds(Store.state.wishlist),comparison:serverIds(Store.state.comparison)}).catch(()=>console.info('Account list sync is unavailable.')),750);
});

/* Header shadow on scroll */
let lastY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  const h = $('#siteHeader');
  if (h) h.classList.toggle('scrolled', y > 6);
  lastY = y;
}, { passive:true });

/* Footer (rendered once) */
$('#siteFooter').innerHTML = `
  <div class="wrap">
    <div class="footer-grid">
      <div class="f-brand">
        <span class="en">Glow Nuture</span>
        <p>Skin, hair and everyday care essentials in one place. Clear information and easy shopping.</p>
        <div class="socials">
          <a href="https://www.facebook.com/glownuturebd" target="_blank" rel="noopener noreferrer" aria-label="Facebook">${ICON.fb}</a>
          <a href="https://www.instagram.com/glownuture/reels/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${ICON.ig}</a>
          <a href="#/page/contact" aria-label="WhatsApp">${ICON.wa}</a>
        </div>
      </div>
      <div>
        <h4>Shop</h4>
        <ul class="f-list">
          ${CATEGORIES.map(c => `<li><a href="#/c/${c.slug}">${esc(c.name)}</a></li>`).join('')}
          <li><a href="#/shop?sort=new">New arrivals</a></li>
          <li><a href="#/shop?deal=1">Offers</a></li><li><a href="#/ordinary">The Ordinary catalog</a></li><li><a href="#/compare">Compare products</a></li>
        </ul>
      </div>
      <div>
        <h4>Help</h4>
        <ul class="f-list">
          <li><a href="#/page/about">About us</a></li>
          <li><a href="#/page/contact">Contact</a></li>
          <li><a href="#/page/delivery">Delivery policy</a></li>
          <li><a href="#/page/return">Returns and refunds</a></li>
          <li><a href="#/page/privacy">Privacy policy</a></li>
          <li><a href="#/page/terms">Terms and conditions</a></li>
          <li><a href="#/page/faq">FAQs</a></li>
          <li><a href="#/track">Track order</a></li>
        </ul>
      </div>
      <div class="f-contact-col">
        <h4>Customer support</h4>
        <ul class="f-contact">
          <li>${ICON.phone}<span>Mobile / WhatsApp<br/><span class="en">+880 1XXX-XXXXXX</span></span></li>
          <li>${ICON.mail}<span>Email<br/><span class="en">support@glownuture.com</span></span></li>
          <li>${ICON.pin}<a href="#/page/contact">Send a support message</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} Glow Nuture. All rights reserved.</span>
      <div class="pay-note">
        <span>${ICON.shield} Secure ordering</span>
        <span>${ICON.truck} Nationwide delivery</span>
        <span>Cash on delivery</span>
      </div>
    </div>
  </div>`;

window.addEventListener('hashchange', render);

/* Escape closes overlays */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeOverlays();
});

})();
