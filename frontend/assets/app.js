/* ============================================================================
 * GLOW NUTURE — Application
 * ---------------------------------------------------------------------------
 * Structure (mirrors the intended production folder layout):
 *   1. DATA          → data/products.js, data/categories.js, data/content.js
 *   2. STORE         → lib/store.js        (state + persistence)
 *   3. UTIL          → lib/utils.js
 *   4. ART           → components/ProductArt.js  (SVG product renders)
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

const BRAND = { nameBn:'গ্লো ন্যাচার', nameEn:'Glow Nuture' };

const CATEGORIES = [
  { slug:'skincare',  name:'স্কিন কেয়ার',    desc:'সিরাম • ক্লিনজার • সানস্ক্রিন • ময়েশ্চারাইজার', art:{t:'dropper', c:'#D9C8AF', d:'#8A7457'} },
  { slug:'haircare',  name:'হেয়ার কেয়ার',    desc:'শ্যাম্পু • কন্ডিশনার • হেয়ার সিরাম',        art:{t:'pump',    c:'#C7CFC0', d:'#5F6E58'} },
  { slug:'bodycare',  name:'বডি কেয়ার',      desc:'বডি ওয়াশ • লোশন • হ্যান্ড কেয়ার',          art:{t:'bottle',  c:'#E0CFC4', d:'#8D6F60'} },
  { slug:'cosmetics', name:'কসমেটিকস',        desc:'লিপ কেয়ার • মেকআপ • বিউটি এসেনশিয়ালস',     art:{t:'lipstick',c:'#C98D92', d:'#8E5A60'} },
  { slug:'daily',     name:'দৈনন্দিন যত্ন',   desc:'প্রতিদিনের ব্যক্তিগত যত্ন ও অ্যাকসেসরিজ',    art:{t:'pouch',   c:'#D6D2C6', d:'#7C776A'} },
  { slug:'gift',      name:'গিফট ও কম্বো',    desc:'উপহারের জন্য বাছাই করা প্যাকেজ',              art:{t:'combo',   c:'#E3D6C6', d:'#94795F'} }
];

/* Sub-category key → Bengali label */
const SUBS = {
  serum:'সিরাম', sunscreen:'সানস্ক্রিন', facewash:'ফেস ওয়াশ', moisturizer:'ময়েশ্চারাইজার',
  cleanser:'ক্লিনজার', toner:'টোনার', mask:'মাস্ক',
  shampoo:'শ্যাম্পু', conditioner:'কন্ডিশনার', hairserum:'হেয়ার সিরাম',
  bodywash:'বডি ওয়াশ', lotion:'বডি লোশন', handcare:'হ্যান্ড কেয়ার',
  lip:'লিপ কেয়ার', makeup:'মেকআপ', facemakeup:'ফেস মেকআপ',
  personal:'ব্যক্তিগত যত্ন', accessories:'অ্যাকসেসরিজ', combo:'কম্বো প্যাক'
};

const SKIN_TYPES = { oily:'তৈলাক্ত', dry:'শুষ্ক', combination:'মিশ্র', sensitive:'সংবেদনশীল', all:'সব ধরনের' };
const CONCERNS = {
  acne:'ব্রণ', oiliness:'অতিরিক্ত তৈলাক্ততা', dryness:'শুষ্কতা', dullness:'নীরবতা/উজ্জ্বলতা',
  texture:'অসমান টেক্সচার', sunprotection:'সূর্যের ক্ষতি', pigmentation:'দাগ',
  hairfall:'চুল পড়া', dandruff:'খুশকি', hydration:'আর্দ্রতা'
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

/* ---------- জার্নাল ---------- */
const ARTICLES = [
  {
    slug:'why-sunscreen', cat:'স্কিন কেয়ার বেসিক', read:'৪ মিনিট',
    title:'সানস্ক্রিন কেন প্রতিদিন ব্যবহার করা উচিত',
    excerpt:'সূর্যের UVA ও UVB রশ্মি সারাবছর ত্বকে প্রভাব ফেলে। জেনে নিন কীভাবে সঠিক সানস্ক্রিন বেছে নেবেন।',
    art:{ t:'tube', c:'#F2E4C9', d:'#C79A4E' },
    body:[
      ['p','অনেকের ধারণা শুধু গরমের দিনে বা সমুদ্র সৈকতে গেলেই সানস্ক্রিন দরকার। আসলে UVA রশ্মি কাচ ভেদ করে, মেঘলা দিনেও থাকে এবং সারা বছরই ত্বকে প্রভাব ফেলে।'],
      ['h2','SPF আর PA+++ মানে কী?'],
      ['p','SPF মূলত UVB রশ্মি থেকে সুরক্ষার মাত্রা বোঝায়। PA রেটিং বোঝায় UVA সুরক্ষা—PA+ থেকে PA++++ পর্যন্ত। বাংলাদেশের মতো উচ্চ UV ইনডেক্সের দেশে SPF 50 ও PA++++ সমন্বয় সাধারণত বেশি উপযোগী।'],
      ['h2','কতটুকু লাগাবেন?'],
      ['p','বেশিরভাগ মানুষ প্রয়োজনীয় পরিমাণের চেয়ে অনেক কম সানস্ক্রিন ব্যবহার করেন। মুখ ও গলার জন্য সাধারণত দুই আঙুলের ডগা পরিমাণ লাগানো হয়।'],
      ['note','বাইরে দীর্ঘ সময় থাকলে ২–৩ ঘণ্টা পর পর সানস্ক্রিন পুনরায় প্রয়োগ করা ভালো। ঘামলে বা মুখ ধুলে পুনরায় লাগাতে হবে।'],
      ['h2','কীভাবে বেছে নেবেন'],
      ['ul',['তৈলাক্ত ত্বকের জন্য জেল বা ফ্লুইড টেক্সচার','শুষ্ক ত্বকের জন্য ক্রিম বা ময়েশ্চারাইজিং ফর্মুলা','সংবেদনশীল ত্বকের জন্য মিনারেল বা কোমল ফিল্টার','মেকআপের নিচে ব্যবহারের জন্য হালকা, সাদা দাগ ছাড়া ফর্মুলা']]
    ]
  },
  {
    slug:'how-to-choose-serum', cat:'ইঙ্গ্রেডিয়েন্ট গাইড', read:'৫ মিনিট',
    title:'সিরাম কীভাবে বেছে নেবেন',
    excerpt:'নিয়াসিনামাইড, ভিটামিন সি, হায়ালুরোনিক অ্যাসিড—কোনটির জন্য কে?',
    art:{ t:'dropper', c:'#DCC9AE', d:'#8A7457' },
    body:[
      ['p','সিরাম হলো ঘনত্ব বেশি কিন্তু টেক্সচার হালকা এমন একটি প্রোডাক্ট, যা নির্দিষ্ট একটি উপাদানকে লক্ষ্য করে তৈরি হয়। তাই কোন সমস্যার জন্য কোন উপাদান, সেটি জানা জরুরি।'],
      ['h2','সাধারণ উপাদান ও তাদের কাজ'],
      ['ul',['নিয়াসিনামাইড — অতিরিক্ত তৈলাক্তভাব নিয়ন্ত্রণ ও ত্বকের বাধা শক্তিশালী করতে সহায়তা করে','ভিটামিন সি — উজ্জ্বলতা ও অ্যান্টি-অক্সিডেন্ট সুরক্ষায় সহায়তা করে','হায়ালুরোনিক অ্যাসিড — আর্দ্রতা ধরে রাখতে সহায়তা করে','রেটিনল — টেক্সচার ও সূক্ষ্ম রেখার Appearance উন্নত করতে সহায়তা করে','AHA/BHA — মৃত কোষ দূর করে টেক্সচার মসৃণ করতে সহায়তা করে']],
      ['h2','একসাথে কতটি ব্যবহার করবেন'],
      ['p','শুরুতে একটি বা দুটি সক্রিয় উপাদান দিয়ে শুরু করা ভালো। একসাথে অনেক নতুন প্রোডাক্ট যোগ করলে ত্বক বিরক্ত হতে পারে এবং কোনটি কাজ করছে তা বোঝা যায় না।'],
      ['note','রেটিনল ও এক্সফলিয়েটিং অ্যাসিড একই রাতে ব্যবহার না করাই নিরাপদ। নতুন প্রোডাক্ট শুরু করলে সপ্তাহে ১–২ দিন দিয়ে শুরু করুন।']
    ]
  },
  {
    slug:'know-your-skin-type', cat:'বেসিক', read:'৪ মিনিট',
    title:'নিজের ত্বকের ধরন কীভাবে বুঝবেন',
    excerpt:'তৈলাক্ত, শুষ্ক, মিশ্র নাকি সংবেদনশীল? একটি সহজ পরীক্ষা।',
    art:{ t:'jar', c:'#F1EAD9', d:'#B79A6A' },
    body:[
      ['p','সঠিক প্রোডাক্ট বেছে নেওয়ার প্রথম ধাপ হলো নিজের ত্বকের ধরন জানা। একটি সহজ পরীক্ষা আপনি ঘরেই করতে পারেন।'],
      ['h2','সহজ পরীক্ষা'],
      ['p','মুখ পরিষ্কার করে কিছুক্ষণ কিছুই লাগাবেন না। এক ঘণ্টা পর আয়নায় দেখুন—'],
      ['ul',['সারা মুখ চিটচিটে ও চকচকে → তৈলাক্ত','সারা মুখ টানটান ও খসখসে → শুষ্ক','শুধু টি-জোন (কপাল, নাক, চিবুক) তৈলাক্ত → মিশ্র','লালচে ভাব, জ্বালা বা চুলকানি → সংবেদনশীল']],
      ['h2','ঋতু অনুযায়ী বদলায়'],
      ['p','ত্বকের ধরন ঋতু ও পরিবেশ অনুযায়ী বদলাতে পারে। শীতে যিনি শুষ্ক ত্বক পান, গরমে তিনি মিশ্র ত্বক অনুভব করতে পারেন। তাই রুটিনও ঋতু অনুযায়ী সামান্য বদলানো স্বাভাবিক।'],
      ['note','ত্বকে দীর্ঘদিনের সমস্যা, হঠাৎ ব্রণ বা অস্বাভাবিক পরিবর্তন হলে চর্মরোগ বিশেষজ্ঞের পরামর্শ নেওয়াই ভালো।']
    ]
  },
  {
    slug:'face-wash-frequency', cat:'রুটিন', read:'৩ মিনিট',
    title:'ফেস ওয়াশ দিনে কতবার ব্যবহার করা উচিত',
    excerpt:'বারবার মুখ ধোয়া কি ভালো? জেনে নিন সঠিক নিয়ম।',
    art:{ t:'pump', c:'#EDF0E8', d:'#7C8F76' },
    body:[
      ['p','অনেকে মনে করেন মুখ যত বেশি ধোয়া হবে, ত্বক তত পরিষ্কার থাকবে। কিন্তু অতিরিক্ত পরিষ্কার ত্বকের প্রাকৃতিক তেলের ভারসাম্য নষ্ট করতে পারে।'],
      ['h2','সাধারণ নিয়ম'],
      ['p','বেশিরভাগ মানুষের জন্য দিনে দুইবার—সকালে এবং রাতে—ফেস ওয়াশ যথেষ্ট। রাতে ঘুমানোর আগের পরিষ্কার সবচেয়ে গুরুত্বপূর্ণ, কারণ সারা দিনের ধুলো, তেল ও সানস্ক্রিন তখনই সঠিকভাবে দূর হয়।'],
      ['h2','কখন বাড়াতে পারেন'],
      ['ul',['খুব ঘাম হয় এমন পরিবেশে কাজ করলে','ভারী মেকআপ ব্যবহার করলে','বাইরে দীর্ঘ সময় কাটালে']],
      ['note','মুখ ধোয়ার পরপরই ময়েশ্চারাইজার লাগানো ভালো, যাতে আর্দ্রতা ধরে রাখা যায়।']
    ]
  },
  {
    slug:'skincare-routine-steps', cat:'বেসিক', read:'৫ মিনিট',
    title:'স্কিন কেয়ার রুটিনের মৌলিক ধাপ',
    excerpt:'সকাল ও রাতে কোন ক্রমে প্রোডাক্ট লাগাবেন।',
    art:{ t:'combo', c:'#E7DCCB', d:'#8A7457' },
    body:[
      ['p','একটি সাধারণ রুটিনের জন্য অনেক প্রোডাক্ট দরকার নেই। ক্রম জানা থাকলে অল্প প্রোডাক্টেই ভালো ফল পাওয়া যায়।'],
      ['h2','সকালের রুটিন'],
      ['ul',['ফেস ওয়াশ','টোনার (ঐচ্ছিক)','সিরাম','ময়েশ্চারাইজার','সানস্ক্রিন (সবচেয়ে গুরুত্বপূর্ণ)']],
      ['h2','রাতের রুটিন'],
      ['ul',['ক্লিনজার / মাইসেলার ওয়াটার','ফেস ওয়াশ','টোনার (ঐচ্ছিক)','ট্রিটমেন্ট সিরাম','ময়েশ্চারাইজার']],
      ['note','সাধারণ নিয়ম—হালকা টেক্সচার আগে, ভারী টেক্সচার পরে। সানস্ক্রিন সবসময় সকালের রুটিনের শেষ ধাপ।']
    ]
  },
  {
    slug:'beauty-myths', cat:'সচেতনতা', read:'৪ মিনিট',
    title:'সৌন্দর্য নিয়ে কিছু প্রচলিত ভুল ধারণা',
    excerpt:'বাজারজাত দাবি ও বাস্তবতার পার্থক্য।',
    art:{ t:'bottle', c:'#EAF0E7', d:'#7C8F76' },
    body:[
      ['p','সৌন্দর্য পণ্যের বিজ্ঞাপনে অনেক দাবি দেখা যায়। সব দাবি সমানভাবে বিশ্বাসযোগ্য নয়। কিছু প্রচলিত ধারণা এখানে পরিষ্কার করা হলো।'],
      ['h2','“কয়েক দিনে ত্বকের রঙ বদলে যাবে”'],
      ['p','ত্বকের প্রাকৃতিক রঙ জিনগত। কোনো নিরাপদ প্রোডাক্ট কয়েক দিনে ত্বকের মৌলিক রঙ পরিবর্তন করে না। কিছু উপাদান দাগ হালকা দেখাতে সহায়তা করতে পারে, তবে সময় লাগে এবং ধৈর্য দরকার।'],
      ['h2','“যত বেশি প্রোডাক্ট, তত ভালো”'],
      ['p','বরং উল্টোটা। অতিরিক্ত প্রোডাক্ট ত্বকের বাধা দুর্বল করতে পারে। প্রয়োজন অনুযায়ী অল্প ও নিয়মিত রুটিন সাধারণত বেশি কার্যকর।'],
      ['h2','“তৈলাক্ত ত্বকে ময়েশ্চারাইজার লাগবে না”'],
      ['p','তৈলাক্ত ত্বকেও আর্দ্রতা দরকার। শুধু হালকা, অয়েল-ফ্রি বা জেল ভিত্তিক ফর্মুলা বেছে নিতে হয়।'],
      ['note','যেকোনো নতুন প্রোডাক্ট ব্যবহারের আগে ছোট অংশে প্যাচ টেস্ট করা ভালো। সমস্যা হলে ব্যবহার বন্ধ করুন এবং প্রয়োজনে চিকিৎসকের পরামর্শ নিন।']
    ]
  }
];

/* ---------- সাধারণ পৃষ্ঠা ---------- */
const PAGES = {
  about:{ title:'আমাদের সম্পর্কে', body:`
    <p>গ্লো ন্যাচার একটি বাংলাদেশ-কেন্দ্রিক অনলাইন বিউটি ও পার্সোনাল কেয়ার ব্র্যান্ড। আমাদের লক্ষ্য সহজ—ত্বক, চুল ও দৈনন্দিন যত্নের প্রয়োজনীয় পণ্যগুলো এক জায়গায়, পরিষ্কার তথ্য ও সহজ কেনাকাটার সুবিধাসহ উপস্থাপন করা।</p>
    <h2>আমরা কী করি</h2>
    <p>আমরা প্রতিটি পণ্যের উপাদান, ব্যবহারের নিয়ম, উপযোগী ত্বকের ধরন এবং সতর্কতা স্পষ্টভাবে উল্লেখ করি। যাতে আপনি নিজের প্রয়োজন বুঝে সিদ্ধান্ত নিতে পারেন।</p>
    <h2>আমরা কী করি না</h2>
    <ul>
      <li>অতিরঞ্জিত বা প্রমাণহীন সৌন্দর্য দাবি করি না</li>
      <li>কৃত্রিম রিভিউ বা ভুয়া বিক্রয় সংখ্যা দেখাই না</li>
      <li>প্রয়োজন নেই এমন পণ্য কিনতে উৎসাহিত করি না</li>
    </ul>
    <div class="note-box">বর্তমানে এই ওয়েবসাইটটি একটি ডেমো ক্যাটালগে চলছে। প্রকৃত পণ্য, মূল্য ও স্টক তথ্য পরবর্তীতে যুক্ত করা হবে।</div>
  `},
  contact:{ title:'যোগাযোগ', body:`
    <p>যেকোনো প্রশ্ন, অর্ডার সংক্রান্ত সহায়তা বা পরামর্শের জন্য আমাদের সাথে যোগাযোগ করুন।</p>
    <h2>সাপোর্ট সময়</h2>
    <p>প্রতিদিন সকাল ১০টা — রাত ৮টা (শুক্রবার বন্ধ)</p>
    <h2>যোগাযোগের মাধ্যম</h2>
    <ul>
      <li>মোবাইল / হোয়াটসঅ্যাপ: <span class="en" data-support-phone>Contact page দেখুন</span></li>
      <li>ইমেইল: <span class="en" data-support-email>Contact page দেখুন</span></li>
      <li>ফেসবুক পেজ: <span class="en">/glownuture</span></li>
    </ul>
    <div class="note-box">ডেমো সংস্করণে যোগাযোগের তথ্যগুলো নমুনা হিসেবে দেওয়া হয়েছে। প্রকৃত নম্বর ও ইমেইল ব্যবসার নিজস্ব তথ্য দিয়ে প্রতিস্থাপন করতে হবে।</div>
  `},
  delivery:{ title:'ডেলিভারি নীতি', body:`
    <h2>ডেলিভারি চার্জ</h2>
    <ul>
      <li>ঢাকা শহরের ভিতরে: ৳৬০</li>
      <li>ঢাকার বাইরে (সারা বাংলাদেশ): ৳১২০</li>
      <li>৳২,৫০০ বা তার বেশি অর্ডারে ডেলিভারি ফ্রি</li>
    </ul>
    <h2>ডেলিভারি সময়</h2>
    <ul>
      <li>ঢাকা শহরে: সাধারণত ১–২ কার্যদিবস</li>
      <li>ঢাকার বাইরে: সাধারণত ২–৪ কার্যদিবস</li>
      <li>দূরবর্তী অঞ্চলে ৫ কার্যদিবস পর্যন্ত লাগতে পারে</li>
    </ul>
    <h2>অর্ডার প্রক্রিয়া</h2>
    <p>অর্ডার নিশ্চিত করার পর আমাদের টিম আপনার মোবাইল নম্বরে ফোন বা মেসেজ দিয়ে অর্ডার যাচাই করে। যাচাই সম্পন্ন হলে পণ্য কুরিয়ারে পাঠানো হয়।</p>
    <div class="note-box">ডেলিভারি সংক্রান্ত যেকোনো পরিবর্তন অর্ডার কনফার্মেশনের সময় জানিয়ে দেওয়া হবে।</div>
  `},
  return:{ title:'রিটার্ন ও রিফান্ড নীতি', body:`
    <h2>রিটার্নের শর্ত</h2>
    <ul>
      <li>পণ্য পাওয়ার ২৪ ঘণ্টার মধ্যে জানাতে হবে</li>
      <li>পণ্য অব্যবহৃত ও সিল অক্ষত থাকতে হবে</li>
      <li>প্যাকেজিং, লেবেল ও ইনভয়েস থাকতে হবে</li>
      <li>ভুল বা ক্ষতিগ্রস্ত পণ্য পাঠানো হলে সম্পূর্ণ দায়িত্ব আমাদের</li>
    </ul>
    <h2>যেসব ক্ষেত্রে রিটার্ন গ্রহণযোগ্য নয়</h2>
    <ul>
      <li>ব্যবহৃত বা খোলা সিলের পণ্য</li>
      <li>ব্যক্তিগত কারণভিত্তিক (পছন্দ হয়নি) ক্ষেত্রে সিল খোলা থাকলে</li>
      <li>২৪ ঘণ্টা পর জানানো হলে</li>
    </ul>
    <h2>রিফান্ড</h2>
    <p>রিটার্ন অনুমোদিত হলে ৩–৭ কার্যদিবসের মধ্যে মূল্য ফেরত দেওয়া হয়। ক্যাশ অন ডেলিভারিতে কেনা হলে বিকাশ/নগদ নম্বরে ফেরত পাঠানো হয়।</p>
    <div class="note-box">স্বাস্থ্যসম্মত কারণে খোলা বা ব্যবহৃত বিউটি পণ্য পুনরায় বিক্রয় করা হয় না।</div>
  `},
  privacy:{ title:'গোপনীয়তা নীতি', body:`
    <p>গ্লো ন্যাচার আপনার ব্যক্তিগত তথ্যের গোপনীয়তাকে গুরুত্ব দেয়।</p>
    <h2>আমরা কী তথ্য সংগ্রহ করি</h2>
    <ul>
      <li>নাম, মোবাইল নম্বর, ইমেইল</li>
      <li>ডেলিভারির ঠিকানা (বিভাগ, জেলা, উপজেলা, বিস্তারিত ঠিকানা)</li>
      <li>অর্ডার সংক্রান্ত তথ্য</li>
    </ul>
    <h2>তথ্য কীভাবে ব্যবহার করা হয়</h2>
    <ul>
      <li>অর্ডার প্রক্রিয়া ও ডেলিভারির জন্য</li>
      <li>গ্রাহক সহায়তা প্রদানের জন্য</li>
      <li>অর্ডার সংক্রান্ত আপডেট জানানোর জন্য</li>
    </ul>
    <h2>তথ্য শেয়ার</h2>
    <p>ডেলিভারির প্রয়োজনে কুরিয়ার পার্টনারের সাথে শুধু প্রয়োজনীয় তথ্য শেয়ার করা হয়। অন্য কোনো তৃতীয় পক্ষের কাছে তথ্য বিক্রয় করা হয় না।</p>
  `},
  terms:{ title:'শর্তাবলি', body:`
    <h2>সাধারণ শর্ত</h2>
    <ul>
      <li>ওয়েবসাইটে উল্লিখিত মূল্য বাংলাদেশি টাকায় এবং পরিবর্তনযোগ্য</li>
      <li>স্টক শেষ হলে অর্ডার বাতিল হতে পারে, সেক্ষেত্রে পূর্বে জানানো হবে</li>
      <li>ডেমো/ভুল মূল্য উল্লেখ থাকলে অর্ডার বাতিলের অধিকার সংরক্ষিত</li>
      <li>ভুয়া বা অসদুদ্দেশ্যপূর্ণ অর্ডার বাতিল করা হবে</li>
    </ul>
    <h2>পণ্যের তথ্য</h2>
    <p>প্রতিটি পণ্যের উপাদান, ব্যবহারবিধি ও সতর্কতা উল্লেখ করা হয়। তবুও কোনো নির্দিষ্ট উপাদানে অ্যালার্জি থাকলে ব্যবহারের আগে তালিকা পরীক্ষা করুন।</p>
    <div class="note-box">ত্বকের দীর্ঘমেয়াদি সমস্যা থাকলে চর্মরোগ বিশেষজ্ঞের পরামর্শ নেওয়া উচিত। আমরা চিকিৎসা পরামর্শ প্রদান করি না।</div>
  `},
  faq:{ title:'সাধারণ প্রশ্ন', faqs:[
    ['অর্ডার ট্র্যাক করব কীভাবে?','অর্ডার আইডি ও অর্ডারের সময় পাওয়া private tracking code দিয়ে tracking পেজে দেখুন। কোডটি গোপন রাখুন।'],
    ['মোট মূল্য কীভাবে জানব?','চেকআউটে ঠিকানা ও কুপন দিলে সার্ভার পণ্যের মূল্য, ছাড়, ডেলিভারি ও প্রযোজ্য কর হিসাব করে দেখায়।'],
    ['রিটার্নের নিয়ম কোথায় পাব?','দোকানের প্রকাশিত রিটার্ন ও রিফান্ড নীতি পড়ুন। প্রশ্ন থাকলে যোগাযোগ পেজ থেকে সহায়তা নিন।'],
    ['অ্যাকাউন্ট ছাড়া অর্ডার করা যাবে?','দোকান checkout চালু রাখলে guest checkout ব্যবহার করতে পারবেন। অর্ডারের রসিদ ও private tracking code সংরক্ষণ করুন।'],
    ['পণ্য পাওয়া যাচ্ছে কি না জানব কীভাবে?','অনুমোদিত shop-এর product page-এ স্থানীয় মূল্য ও stock দেখুন। বাইরের reference catalog দোকানের stock নয়।'],
    ['ব্যক্তিগত তথ্য কীভাবে পাঠাব?','যোগাযোগ ফর্মে শুধু প্রয়োজনীয় তথ্য দিন। কার্ড নম্বর, PIN, CVV বা পাসওয়ার্ড পাঠাবেন না।']
  ]}
};

/* ==========================================================================
 * 2. UTIL
 * ======================================================================== */
const BN_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
const bn   = s => String(s).replace(/\d/g, d => BN_DIGITS[+d]);
const bnEn = s => String(s).replace(/[০-৯]/g, d => BN_DIGITS.indexOf(d));
const money = n => '৳' + bn(Number(n || 0).toLocaleString('en-IN'));
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
    const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    return bn(d.getDate()) + ' ' + months[d.getMonth()] + ' ' + bn(d.getFullYear());
  }catch(e){ return ''; }
}
function timeAgo(iso){
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'এখন';
  if (diff < 3600) return bn(Math.floor(diff/60)) + ' মিনিট আগে';
  if (diff < 86400) return bn(Math.floor(diff/3600)) + ' ঘণ্টা আগে';
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
      { id:'b1', title:'প্রতিদিনের যত্ন, আরও সহজভাবে।', sub:'ত্বক, চুল ও দৈনন্দিন যত্নের প্রয়োজনীয় পণ্য এক জায়গায়।', active:true }
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
      const ids=v=>Array.isArray(v)?v.filter(id=>typeof id==='string'&&/^p[0-9]+$/.test(id)).slice(0,200):[];
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
        const base=this.product(line.id);if(!base)return null;
        const variant=line.variant_id?base.variants.find(v=>v.id===line.variant_id):null;
        if(line.variant_id&&!variant)return null;
        const p=variant?{...base,price:variant.price,stock:variant.stock,sku:variant.sku,size:variant.label}:{...base,price:base._basePrice,stock:base._baseStock,sku:base._baseSKU};
        return {...line,product:p,subtotal:p.price*line.qty};
      }).filter(Boolean);
    },
    cartCount(){return state.cart.reduce((n,row)=>n+row.qty,0);},
    addToCart(id,qty,variantId){
      qty=Math.max(1,Math.min(20,parseInt(qty||1,10)||1));
      const p=this.product(id);if(!p)return {ok:false,msg:'Product পাওয়া যায়নি।'};
      variantId=variantId||p.selectedVariantId||null;
      const variant=variantId?p.variants.find(v=>v.id===variantId):null,stock=variant?variant.stock:p._baseStock;
      if(stock<=0)return {ok:false,msg:'এই option এখন মজুত নেই।'};
      const line=state.cart.find(row=>row.id===id);
      if(line&&line.variant_id!==variantId)return {ok:false,msg:'অন্য option যোগ করতে আগে bag থেকে আগের option সরান।'};
      const next=(line?.qty||0)+qty;
      if(next>stock||next>20)return {ok:false,msg:'Stock বা প্রতি order quantity limit অতিক্রম করেছে।'};
      if(line)line.qty=next;else state.cart.push({id,qty,variant_id:variantId});
      persist();emit();return {ok:true,msg:'ঝুড়িতে যোগ হয়েছে।'};
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
 * 4. PRODUCT ART (SVG)
 * ======================================================================== */
let __artSeq=0;
function productImage(p,options={}){
  const safe=url=>typeof url==='string'&&/^(https:\/\/|\/media\/)/.test(url);
  const candidates=[...new Set([p?.image_url,...(Array.isArray(p?.images)?p.images:[])].map(v=>typeof v==='string'?v:v?.url||v?.src).filter(safe))];
  const url=candidates.shift()||'/assets/no-image.svg',asset=p?.image_assets?.find(v=>v.url===url);
  const variants=(asset?.variants||[]).filter(v=>safe(v.url)&&Number(v.width)>0).sort((a,b)=>a.width-b.width);
  const widths=new Map();variants.forEach(v=>widths.set(Number(v.width),v.url));
  const srcset=[...widths].map(([w,url])=>esc(url)+' '+w+'w').join(', ');
  return '<img class="gn-product-image" src="'+esc(url)+'" '+(srcset?'srcset="'+srcset+'" sizes="'+esc(options.sizes||'(max-width: 540px) 46vw, (max-width: 980px) 30vw, 300px')+'" ':'')+'alt="'+esc([p?.brand,p?.name,p?.size].filter(Boolean).join(' · ')||'Product image unavailable')+'" width="'+(asset?.width||300)+'" height="'+(asset?.height||300)+'" loading="'+(options.eager?'eager':'lazy')+'" '+(options.eager?'fetchpriority="high" ':'')+'decoding="async" data-image-candidates="'+esc(JSON.stringify(candidates))+'" data-product-image>';
}
document.addEventListener('error',event=>{
  const image=event.target;
  if(!image?.matches?.('[data-product-image]')||image.dataset.failed)return;
  image.removeAttribute('srcset');image.removeAttribute('sizes');
  let candidates=[];try{candidates=JSON.parse(image.dataset.imageCandidates||'[]');}catch(_){}
  const next=candidates.shift();image.dataset.imageCandidates=JSON.stringify(candidates);
  if(next){image.src=next;return;}
  image.dataset.failed='1';image.src='/assets/no-image.svg';
},true);

const ART_SHAPES = {
  dropper: (c, d) => `
    <rect x="104" y="46" width="32" height="30" rx="7" fill="${d}"/>
    <rect x="113" y="76" width="14" height="18" fill="${d}" opacity=".75"/>
    <rect x="78" y="94" width="84" height="152" rx="16" fill="${c}"/>
    <rect x="88" y="126" width="64" height="76" rx="7" fill="#fff" opacity=".93"/>
    <rect x="97" y="142" width="46" height="6" rx="3" fill="${d}" opacity=".6"/>
    <rect x="97" y="156" width="32" height="5" rx="2.5" fill="${d}" opacity=".35"/>
    <rect x="97" y="169" width="40" height="5" rx="2.5" fill="${d}" opacity=".22"/>
    <rect x="88" y="110" width="9" height="118" rx="4.5" fill="#fff" opacity=".22"/>`,

  pump: (c, d) => `
    <rect x="114" y="36" width="9" height="20" rx="4.5" fill="${d}"/>
    <rect x="106" y="54" width="34" height="11" rx="5.5" fill="${d}"/>
    <rect x="110" y="65" width="20" height="28" fill="${d}" opacity=".9"/>
    <rect x="78" y="93" width="84" height="153" rx="14" fill="${c}"/>
    <rect x="88" y="128" width="64" height="70" rx="7" fill="#fff" opacity=".93"/>
    <rect x="97" y="143" width="46" height="6" rx="3" fill="${d}" opacity=".6"/>
    <rect x="97" y="157" width="30" height="5" rx="2.5" fill="${d}" opacity=".32"/>
    <rect x="88" y="108" width="9" height="120" rx="4.5" fill="#fff" opacity=".2"/>`,

  tube: (c, d) => `
    <rect x="96" y="40" width="48" height="28" rx="7" fill="${d}"/>
    <path d="M86 68 h68 v152 q0 30 -34 30 q-34 0 -34 -30 z" fill="${c}"/>
    <rect x="94" y="122" width="52" height="78" rx="7" fill="#fff" opacity=".93"/>
    <rect x="102" y="138" width="36" height="6" rx="3" fill="${d}" opacity=".6"/>
    <rect x="102" y="152" width="26" height="5" rx="2.5" fill="${d}" opacity=".32"/>
    <path d="M96 76 v150" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".2"/>`,

  jar: (c, d) => `
    <rect x="62" y="104" width="116" height="36" rx="13" fill="${d}"/>
    <rect x="68" y="136" width="104" height="106" rx="18" fill="${c}"/>
    <rect x="80" y="164" width="80" height="52" rx="7" fill="#fff" opacity=".9"/>
    <rect x="92" y="180" width="56" height="6" rx="3" fill="${d}" opacity=".55"/>
    <rect x="92" y="194" width="38" height="5" rx="2.5" fill="${d}" opacity=".3"/>
    <rect x="78" y="150" width="9" height="80" rx="4.5" fill="#fff" opacity=".2"/>`,

  bottle: (c, d) => `
    <rect x="102" y="40" width="36" height="22" rx="8" fill="${d}"/>
    <rect x="112" y="60" width="16" height="26" fill="${d}" opacity=".85"/>
    <rect x="76" y="84" width="88" height="162" rx="18" fill="${c}"/>
    <rect x="88" y="124" width="64" height="76" rx="8" fill="#fff" opacity=".93"/>
    <rect x="97" y="140" width="46" height="6" rx="3" fill="${d}" opacity=".6"/>
    <rect x="97" y="154" width="30" height="5" rx="2.5" fill="${d}" opacity=".32"/>
    <rect x="97" y="167" width="38" height="5" rx="2.5" fill="${d}" opacity=".22"/>
    <rect x="86" y="100" width="10" height="128" rx="5" fill="#fff" opacity=".2"/>`,

  lipstick: (c, d) => `
    <path d="M100 44 h40 v58 h-40 z" fill="${d}"/>
    <path d="M100 44 l40 -10 v10 z" fill="${d}" opacity=".75"/>
    <rect x="96" y="102" width="48" height="24" fill="#CFC7BA"/>
    <rect x="98" y="126" width="44" height="112" rx="7" fill="${c}"/>
    <rect x="98" y="126" width="12" height="112" fill="#fff" opacity=".16"/>`,

  compact: (c, d) => `
    <rect x="56" y="104" width="128" height="112" rx="18" fill="${c}"/>
    <circle cx="120" cy="160" r="36" fill="#fff" opacity=".55"/>
    <circle cx="120" cy="160" r="36" fill="none" stroke="${d}" stroke-width="3" opacity=".55"/>
    <rect x="56" y="104" width="128" height="20" rx="10" fill="${d}" opacity=".55"/>`,

  pouch: (c, d) => `
    <rect x="70" y="86" width="100" height="152" rx="12" fill="${c}"/>
    <rect x="70" y="86" width="100" height="26" rx="12" fill="${d}"/>
    <rect x="84" y="140" width="72" height="60" rx="8" fill="#fff" opacity=".85"/>
    <rect x="94" y="156" width="52" height="6" rx="3" fill="${d}" opacity=".55"/>
    <rect x="94" y="170" width="34" height="5" rx="2.5" fill="${d}" opacity=".3"/>`,

  brush: (c, d) => `
    <rect x="112" y="52" width="16" height="150" rx="8" fill="${d}"/>
    <ellipse cx="120" cy="220" rx="38" ry="46" fill="${c}"/>
    <ellipse cx="120" cy="220" rx="38" ry="46" fill="none" stroke="${d}" stroke-width="2" opacity=".25"/>
    <rect x="112" y="52" width="6" height="150" rx="3" fill="#fff" opacity=".16"/>`,

  combo: (c, d) => `
    <rect x="58" y="128" width="48" height="112" rx="12" fill="${c}"/>
    <rect x="70" y="108" width="24" height="22" rx="6" fill="${d}"/>
    <rect x="134" y="128" width="48" height="112" rx="12" fill="${c}" opacity=".85"/>
    <rect x="146" y="108" width="24" height="22" rx="6" fill="${d}" opacity=".85"/>
    <rect x="96" y="86" width="48" height="154" rx="12" fill="${d}" opacity=".92"/>
    <rect x="108" y="66" width="24" height="22" rx="6" fill="${c}"/>
    <rect x="70" y="160" width="24" height="42" rx="5" fill="#fff" opacity=".75"/>
    <rect x="108" y="130" width="24" height="46" rx="5" fill="#fff" opacity=".7"/>
    <rect x="146" y="160" width="24" height="42" rx="5" fill="#fff" opacity=".75"/>`
};

function artSVG(p, opts){
  if(p?.sku||p?.apiId||p?.image_url)return productImage(p);
  opts = opts || {};
  const a = (p && p.art) || { t:'dropper', c:'#D9C8AF', d:'#8A7457' };
  const id = 'ag' + (++__artSeq);
  const bgA = opts.bgA || '#F6F2EB';
  const bgB = opts.bgB || '#EAE4D9';
  const shape = (ART_SHAPES[a.t] || ART_SHAPES.dropper)(a.c, a.d);
  return `<svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc((p && p.name) || 'পণ্যের ছবি')}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/>
    </linearGradient></defs>
    <rect width="240" height="300" fill="url(#${id})"/>
    <circle cx="120" cy="152" r="88" fill="#fff" opacity=".5"/>
    <ellipse cx="120" cy="256" rx="60" ry="9" fill="#000" opacity=".07"/>
    ${shape}
  </svg>`;
}
/* small inline art for tables/lists */
function artMini(p){
  if(p?.sku||p?.apiId||p?.image_url)return productImage(p);
  const a = (p && p.art) || { t:'dropper', c:'#D9C8AF', d:'#8A7457' };
  const shape = (ART_SHAPES[a.t] || ART_SHAPES.dropper)(a.c, a.d);
  return `<svg viewBox="20 20 200 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="20" y="20" width="200" height="250" fill="#F6F2EB"/>
    ${shape}</svg>`;
}

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
function quoteItems(){return Store.cartLines().map(row=>({product_id:Number(row.product.apiId),qty:row.qty,...(row.variant_id?{variant_id:row.variant_id}:{})}));}
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
    '<button class="modal-close" data-action="close-modal" aria-label="বন্ধ করুন">' + ICON.close + '</button>' + html;
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
    { href:'#/',            label:'হোম',            match:[''] },
    { href:'#/c/skincare',  label:'স্কিন কেয়ার',    match:['c/skincare'] },
    { href:'#/c/haircare',  label:'হেয়ার কেয়ার',    match:['c/haircare'] },
    { href:'#/c/bodycare',  label:'বডি কেয়ার',      match:['c/bodycare'] },
    { href:'#/c/cosmetics', label:'কসমেটিকস',       match:['c/cosmetics'] },
    { href:'#/c/daily',     label:'দৈনন্দিন যত্ন',  match:['c/daily'] },
    { href:'#/shop?sort=new', label:'নতুন পণ্য',     match:['shop?sort=new'] },
    { href:'#/shop?deal=1', label:'অফার',           match:['shop?deal=1'] }
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
     <a href="#/track" data-action="close-overlays">অর্ডার ট্র্যাক</a>
     <a href="#/page/faq" data-action="close-overlays">সাধারণ প্রশ্ন</a>`;

    const mnav = [
      { href:'#/', label:'হোম', icon:ICON.home, match:r => r.path.length === 0 },
      { href:'#/shop', label:'কেনাকাটা', icon:ICON.grid, match:r => r.path[0] === 'shop' || r.path[0] === 'c' },
      { href:'#/search', label:'খুঁজুন', icon:ICON.search, match:r => r.path[0] === 'search' },
      { href:'#/cart', label:'ঝুড়ি', icon:ICON.cart, match:r => r.path[0] === 'cart', badge:true },
      { href:'#/account', label:'অ্যাকাউন্ট', icon:ICON.user, match:r => r.path[0] === 'account' || r.path[0] === 'wishlist' }
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
  const off = discountPct(p);
  const out = p.stock <= 0;
  const r = Store.ratingFor(p.id);
  const rating = r.count ? r.rating : 0;

  let badges = '';
  if (out) badges += '<span class="chip out">এই মুহূর্তে মজুত নেই</span>';
  else if (off >= 15) badges += `<span class="chip sale">${bn(off)}% ছাড়</span>`;
  else if (p.compare && p.compare > p.price) badges += `<span class="chip sale">ছাড় চলছে</span>`;
  if (p.tags && p.tags.includes('combo')) badges += '<span class="chip new">কম্বো</span>';
  if (p.demo) badges += '<span class="chip demo">ডেমো পণ্য</span>';

  const stockLine = out
    ? '<span class="stock-out"><span class="dot-i"></span>এই মুহূর্তে মজুত নেই</span>'
    : p.stock <= 10
      ? `<span class="stock-low"><span class="dot-i"></span>মজুত আছে (${bn(p.stock)}টি বাকি)</span>`
      : '<span class="stock-in"><span class="dot-i"></span>মজুত আছে</span>';

  const ratingLine = r.count
    ? `${starsHtml(rating)} <span>${bn(rating.toFixed(1))} (${bn(r.count)})</span>`
    : '<span class="pill-demo">নতুন পণ্য — এখনো রিভিউ নেই</span>';

  return `
  <article class="pcard" data-id="${p.id}">
    <div class="pcard-media">
      <a href="#/p/${p.slug}" aria-label="${esc(p.name)}">${artSVG(p)}</a>
      <div class="pcard-badges">${badges}</div>
      <button class="pcard-wish ${Store.inWishlist(p.id) ? 'on' : ''}" data-action="wish" data-id="${p.id}"
              aria-label="পছন্দের তালিকায় রাখুন" title="পছন্দের তালিকায় রাখুন">${ICON.heart}</button>
      <button class="pcard-quick" data-action="quick" data-id="${p.id}">দ্রুত দেখুন</button>
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
          ${out ? 'মজুত নেই' : 'ঝুড়িতে যোগ করুন'}
        </button>
      </div>
    </div>
  </article>`;
}

function productGrid(list, opts){
  if(Store.state.catalogLoading)return skeletonGrid(8);
  if(Store.state.catalogError)return '<div class="co-card" role="alert">'+esc(Store.state.catalogError)+'<button class="btn btn-outline" data-action="retry-catalog">Retry</button></div>';
  if (!list.length) return emptyState('search');
  return '<div class="prod-grid">' + list.map(p => productCard(p)).join('') + '</div>';
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
    cart:{ icon:ICON.cart, title:'আপনার ঝুড়ি এখনো খালি।', text:'পছন্দের পণ্য ঝুড়িতে যোগ করে অর্ডার সম্পন্ন করুন।', btn:'কেনাকাটা শুরু করুন', href:'#/shop' },
    wishlist:{ icon:ICON.heart, title:'আপনার পছন্দের তালিকা খালি।', text:'আপনার পছন্দের পণ্যগুলো এখানে জমা থাকবে, পরে সহজে খুঁজে পাবেন।', btn:'পণ্য দেখুন', href:'#/shop' },
    search:{ icon:ICON.search, title:'আপনার খোঁজা পণ্যটি পাওয়া যায়নি।', text:'অন্য কোনো নাম, ব্র্যান্ড বা উপাদান দিয়ে খুঁজে দেখুন।', btn:'সব পণ্য দেখুন', href:'#/shop' },
    orders:{ icon:ICON.box, title:'আপনার এখনো কোনো অর্ডার নেই।', text:'অর্ডার সম্পন্ন করলে সেগুলো এখানে দেখা যাবে এবং ট্র্যাক করা যাবে।', btn:'কেনাকাটা শুরু করুন', href:'#/shop' },
    generic:{ icon:ICON.info, title:'এখানে দেখানোর মতো কিছু নেই।', text:'অন্য কোথাও দেখুন বা হোমপেজে ফিরে যান।', btn:'হোমে ফিরুন', href:'#/' }
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
      <h3>আপনার ঝুড়ি এখনো খালি।</h3>
      <p>পছন্দের পণ্য যোগ করে কেনাকাটা শুরু করুন।</p>
      <a href="#/shop" class="btn btn-primary" data-action="close-overlays">কেনাকাটা শুরু করুন</a>
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
          <button data-action="qty" data-id="${l.id}" data-delta="-1" aria-label="কমান" style="width:34px;height:34px">${ICON.minus}</button>
          <input type="text" value="${bn(l.qty)}" readonly aria-label="পরিমাণ" style="width:40px;height:34px">
          <button data-action="qty" data-id="${l.id}" data-delta="1" aria-label="বাড়ান" style="width:34px;height:34px">${ICON.plus}</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
        <span class="co-line-price">${money(l.subtotal)}</span>
        <button class="cart-remove" data-action="remove" data-id="${l.id}" aria-label="সরিয়ে ফেলুন">${ICON.trash}</button>
      </div>
    </div>`).join('');

  foot.innerHTML = `
    <div class="sum-row" style="padding-top:0"><span>পণ্যের মোট মূল্য</span><span class="v">${money(totals.subtotal)}</span></div>
    <div class="sum-row"><span>ডেলিভারি চার্জ</span><span class="v">${totals.subtotal >= 2500 ? 'ফ্রি' : 'চেকআউটে নির্ধারিত'}</span></div>
    <div class="sum-total"><span>সর্বমোট (আনুমানিক)</span><span class="v">${money(totals.subtotal)}</span></div>
    <a href="#/checkout" class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-action="close-overlays">অর্ডার সম্পন্ন করুন</a>
    <a href="#/cart" class="btn btn-outline btn-block" style="margin-top:9px" data-action="close-overlays">ঝুড়ি দেখুন</a>
    <p class="tiny muted center" style="margin:12px 0 0">ডেলিভারি চার্জ চেকআউটে যোগ হবে।</p>`;
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
  const offers = all.filter(p => p.compare > p.price).slice(0, 8);
  const newArrivals = all.slice(0, 4);
  const deals = all.filter(p => discountPct(p) >= 10).slice(0, 4);
  const recent = Store.state.recent.map(id => Store.product(id)).filter(Boolean).slice(0, 4);
  const b = Store.state.banners.find(x => x.active) || Store.state.banners[0] || {};

  const heroProducts = all.slice(0, 3);
  const heroIllustrations = [
    '/media/products/hero-cleanser.svg',
    '/media/products/hero-serum.svg',
    '/media/products/hero-sunscreen.svg'
  ];

  return `
  <section class="hero">
    <div class="wrap hero-grid">
      <div class="reveal">
        <span class="hero-eyebrow">${ICON.leaf} বাংলাদেশের জন্য তৈরি বিউটি স্টোর</span>
        <h1>${esc(b.title || 'প্রতিদিনের যত্ন, আরও সহজভাবে।')}</h1>
        <p class="hero-sub">${esc(b.sub || 'ত্বক, চুল ও দৈনন্দিন ব্যক্তিগত যত্নের প্রয়োজনীয় পণ্য—এক জায়গায়।')}</p>
        <div class="hero-cta">
          <a href="#/shop" class="btn btn-primary btn-lg">কেনাকাটা শুরু করুন ${ICON.arrowRight}</a>
          <a href="#/shop?sort=new" class="btn btn-outline btn-lg">নতুন পণ্য দেখুন</a>
        </div>
        <div class="hero-meta">
          <div><strong>Local catalog</strong><span>Checkout-এ coverage নিশ্চিত করুন</span></div>
          <div><strong>ক্যাশ অন ডেলিভারি</strong><span>পণ্য হাতে পেয়ে পেমেন্ট</span></div>
          <div><strong>Delivery quote</strong><span>Server-verified charge</span></div>
        </div>
      </div>
      <div class="hero-visual reveal">
        <div class="hv-inner${heroProducts.length ? '' : ' hv-inner--illustrations'}">
          ${heroProducts.length
            ? heroProducts.map(p => `<div>${artMini(p)}</div>`).join('')
            : heroIllustrations.map(src => `<div><img src="${src}" alt="" width="800" height="800" decoding="async"></div>`).join('')}
        </div>
        <div class="hero-badge">
          <b>${esc(CATEGORIES[0].name)}</b>
          <span>সিরাম • সানস্ক্রিন • ক্লিনজার • ময়েশ্চারাইজার</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Trust strip -->
  <section class="trust">
    <div class="wrap">
      <div class="trust-grid">
        <div class="trust-item">${ICON.leaf}<div><b>যত্নে বাছাই করা পণ্য</b><span>প্রতিটি পণ্যের উপাদান ও উৎপত্তি তথ্য স্পষ্টভাবে উল্লেখ করা</span></div></div>
        <div class="trust-item">${ICON.info}<div><b>স্বচ্ছ পণ্যের তথ্য</b><span>ব্যবহারবিধি, উপযোগী ত্বক ও সতর্কতা—কোনো অতিরঞ্জিত দাবি নয়</span></div></div>
        <div class="trust-item">${ICON.truck}<div><b>সারা বাংলাদেশে ডেলিভারি</b><span>ঠিকানা অনুযায়ী চার্জ ও কুরিয়ার coverage নিশ্চিত করুন</span></div></div>
        <div class="trust-item">${ICON.shield}<div><b>নিরাপদ অর্ডার ব্যবস্থা</b><span>ক্যাশ অন ডেলিভারি সুবিধা ও অর্ডার যাচাই</span></div></div>
      </div>
    </div>
  </section>

  <!-- Categories -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>আপনার যত্নের জন্য বাছাই করা</h2>
          <p class="sub">যে ধরনের পণ্য খুঁজছেন, সেখান থেকেই শুরু করুন।</p>
        </div>
        <a href="#/shop" class="sec-link">সব পণ্য দেখুন ${ICON.arrowRight}</a>
      </div>
      <div class="cat-grid reveal">
        ${CATEGORIES.slice(0, 4).map(c => {
          const count = Store.products().filter(p => p.category === c.slug).length;
          return `<a class="cat-card" href="#/c/${c.slug}">
            <div class="cc-art">${artSVG({ name:c.name, art:c.art })}</div>
            <div class="cc-body">
              <b>${esc(c.name)}</b>
              <span>${esc(c.desc)}</span>
              <span style="margin-top:6px;color:var(--sage-deep);font-weight:600">${bn(count)}টি পণ্য</span>
            </div>
          </a>`;
        }).join('')}
      </div>
      <div class="cat-grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
        ${CATEGORIES.slice(4).map(c => {
          const count = Store.products().filter(p => p.category === c.slug).length;
          return `<a class="cat-card" href="#/c/${c.slug}" style="display:grid;grid-template-columns:132px 1fr;align-items:center">
            <div class="cc-art" style="aspect-ratio:1/1">${artSVG({ name:c.name, art:c.art })}</div>
            <div class="cc-body">
              <b>${esc(c.name)}</b>
              <span>${esc(c.desc)}</span>
              <span style="margin-top:6px;color:var(--sage-deep);font-weight:600">${bn(count)}টি পণ্য</span>
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
          <h2>এখনকার নির্বাচিত অফার</h2>
          <p class="sub">ছাড় চলছে এমন বাছাই করা পণ্য।</p>
        </div>
        <a href="#/shop?deal=1" class="sec-link">সব অফার দেখুন ${ICON.arrowRight}</a>
      </div>
      <div class="reveal">${productGrid(offers)}</div>
    </div>
  </section>

  <!-- New arrivals -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>নতুন এসেছে</h2>
          <p class="sub">সাম্প্রতিক যোগ হওয়া পণ্য।</p>
        </div>
        <a href="#/shop?sort=new" class="sec-link">সব নতুন পণ্য ${ICON.arrowRight}</a>
      </div>
      <div class="reveal">${productGrid(newArrivals)}</div>
    </div>
  </section>

  <!-- Skincare collection -->
  <section class="section section-alt">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>স্কিন কেয়ার কালেকশন</h2>
          <p class="sub">পরিষ্কার → আর্দ্রতা → সুরক্ষা — দৈনন্দিন রুটিনের মৌলিক ধাপ।</p>
        </div>
        <a href="#/c/skincare" class="sec-link">পুরো কালেকশন ${ICON.arrowRight}</a>
      </div>
      <div class="reveal">${productGrid(Store.products().filter(p => p.category === 'skincare').slice(0, 4))}</div>
    </div>
  </section>

  <!-- Daily care + Essentials -->
  <section class="section">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>দৈনন্দিন যত্ন ও বিউটি এসেনশিয়ালস</h2>
          <p class="sub">প্রতিদিন কাজে লাগে এমন পণ্য।</p>
        </div>
        <a href="#/shop" class="sec-link">সব দেখুন ${ICON.arrowRight}</a>
      </div>
      <div class="reveal">${productGrid(Store.products().filter(p => ['daily','bodycare','cosmetics'].includes(p.category)).slice(0, 4))}</div>
    </div>
  </section>

  <!-- Promotional collection -->
  <section class="section tight">
    <div class="wrap">
      <div style="background:var(--rose-soft);border-radius:var(--r-lg);padding:clamp(26px,4vw,44px);display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center" class="reveal">
        <div>
          <span class="chip sale" style="margin-bottom:12px;display:inline-block">আজকের নির্বাচিত অফার</span>
          <h2 style="margin-bottom:8px">কম্বো প্যাকেজে সাশ্রয়</h2>
          <p class="muted" style="margin:0;max-width:56ch">দৈনন্দিন রুটিনের মৌলিক ধাপগুলো একসাথে—কম দামে, কম ঝামেলায়।</p>
        </div>
        <a href="#/c/gift" class="btn btn-primary btn-lg">কম্বো দেখুন</a>
      </div>
    </div>
  </section>

  <!-- Recently viewed -->
  ${recent.length ? `
  <section class="section tight">
    <div class="wrap">
      <div class="sec-head"><div><h2>সম্প্রতি দেখা পণ্য</h2></div></div>
      <div>${productGrid(recent)}</div>
    </div>
  </section>` : ''}

  <!-- Journal -->
  <section class="section section-alt">
    <div class="wrap">
      <div class="sec-head reveal">
        <div>
          <h2>Glow Journal</h2>
          <p class="sub">ত্বক, চুল ও যত্ন নিয়ে সহজ ভাষায় প্রয়োজনীয় তথ্য।</p>
        </div>
        <a href="#/journal" class="sec-link">সব লেখা পড়ুন ${ICON.arrowRight}</a>
      </div>
      <div class="journal-grid reveal">
        ${window.GNConfig?.journalEnabled ? ARTICLES.slice(0,3).map(a=>journalCard(a)).join('') : '<p class="muted">সম্পাদকীয় পর্যালোচনার পর নতুন লেখা প্রকাশ করা হবে।</p>'}
      </div>
    </div>
  </section>

  <!-- Brand section -->
  <section class="section">
    <div class="wrap">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,56px);align-items:center" class="reveal">
        <div>
          <span class="hero-eyebrow" style="background:var(--rose-soft);color:#8E5A60">${ICON.heart} আমাদের প্রতিশ্রুতি</span>
          <h2>কেন গ্লো ন্যাচার</h2>
          <p class="muted" style="line-height:1.95">আমরা বিশ্বাস করি সৌন্দর্য যত্নের বিষয়, প্রতিশ্রুতির নয়। তাই প্রতিটি পণ্যের উপাদান, ব্যবহারের নিয়ম এবং কার জন্য উপযোগী—সব তথ্য পরিষ্কারভাবে দেওয়া হয়। কোনো অতিরঞ্জিত দাবি বা প্রমাণহীন প্রতিশ্রুতি আমরা করি না।</p>
          <ul style="margin-top:18px" class="stack-8">
            <li style="display:flex;gap:10px;align-items:flex-start;color:var(--muted)">${ICON.check}<span>প্রতিটি পণ্যের পূর্ণ উপাদান তালিকা</span></li>
            <li style="display:flex;gap:10px;align-items:flex-start;color:var(--muted)">${ICON.check}<span>উপযোগী ত্বকের ধরন ও সতর্কতা স্পষ্টভাবে উল্লেখ</span></li>
            <li style="display:flex;gap:10px;align-items:flex-start;color:var(--muted)">${ICON.check}<span>কোনো ভুয়া রিভিউ বা কৃত্রিম বিক্রয় সংখ্যা নেই</span></li>
          </ul>
        </div>
        <div class="cat-grid" style="grid-template-columns:1fr 1fr;gap:12px">
          ${CATEGORIES.slice(0,4).map(c => `<div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden">
            <div style="aspect-ratio:1/.9;background:var(--surface-2)">${artSVG({name:c.name, art:c.art})}</div>
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
        <h2>সাধারণ প্রশ্ন</h2>
        <p class="sub" style="text-align:center">যা জানতে চান, হয়তো এখানেই আছে।</p>
      </div>
      <div class="acc" id="faqAcc">
        ${PAGES.faq.faqs.slice(0,6).map(([q,a], i) => `
          <div class="acc-item ${i === 0 ? 'open' : ''}">
            <button class="acc-head" data-action="acc" aria-expanded="${i===0}">${esc(q)} ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">${esc(a)}</div></div>
          </div>`).join('')}
      </div>
      <div class="center" style="margin-top:24px"><a href="#/page/faq" class="btn btn-outline">সব প্রশ্ন দেখুন</a></div>
    </div>
  </section>

  <!-- Newsletter -->
  <section class="section">
    <div class="wrap">
      <div class="newsletter reveal">
        <div>
          <h2>নতুন পণ্য ও অফারের খবর পেতে চান?</h2>
          <p>মাঝে মাঝে গুরুত্বপূর্ণ আপডেট ও অফারের তথ্য পাঠাব। স্প্যাম নয়।</p>
        </div>
        <form class="nl-form" data-form="newsletter">
          <input type="email" class="input" placeholder="আপনার ইমেইল ঠিকানা" required aria-label="ইমেইল" />
          <button class="btn btn-primary" type="submit">সাবস্ক্রাইব</button>
        </form>
      </div>
    </div>
  </section>`;
}

function journalCard(a){
  return `<a class="jcard" href="#/journal/${a.slug}">
    <div class="jc-art">${artSVG({ name:a.title, art:a.art })}</div>
    <div class="jcard-body">
      <span class="cat">${esc(a.cat)}</span>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.excerpt)}</p>
      <span class="jmeta">পড়তে সময় লাগবে ${esc(a.read)}</span>
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
    popular:(a,b) => (b.reviews - a.reviews) || (discountPct(b) - discountPct(a)),
    new:(a,b) => (b.id > a.id ? 1 : -1),
    'price-asc':(a,b) => a.price - b.price,
    'price-desc':(a,b) => b.price - a.price,
    rating:(a,b) => Store.ratingFor(b.id).rating - Store.ratingFor(a.id).rating
  };
  list.sort(sorters[filters.sort] || sorters.popular);

  const PER = 12;
  const shown = list.slice(0, PER * filters.page);
  const hasMore = shown.length < list.length;

  const title = cat ? cat.name : (filters.deal ? 'অফার' : 'সব পণ্য');
  const sub = cat ? cat.desc : 'আপনার প্রয়োজন অনুযায়ী ফিল্টার করে পণ্য খুঁজুন।';

  return `
  <div class="wrap">
    <nav class="crumb" aria-label="ব্রেডক্রাম্ব">
      <a href="#/">হোম</a><span class="sep">/</span>
      ${cat ? `<a href="#/shop">সব পণ্য</a><span class="sep">/</span><span>${esc(cat.name)}</span>`
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
        <aside class="filters" id="filtersPanel" aria-label="ফিল্টার">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <h3 style="font-size:1rem">ফিল্টার</h3>
            <button class="btn btn-ghost btn-sm" data-action="clear-filters">রিসেট</button>
          </div>
          ${filterGroup('ক্যাটাগরি', 'cat', CATEGORIES.map(c => ({ v:c.slug, l:c.name, n:Store.products().filter(p => p.category === c.slug).length })), filters.cat)}
          ${filterGroup('পণ্যের ধরন', 'sub', Object.keys(SUBS).map(k => ({ v:k, l:SUBS[k], n:Store.products().filter(p => p.sub === k).length })).filter(x => x.n), filters.sub)}
          ${filterGroup('ব্র্যান্ড', 'brand', [...new Set(Store.products().map(p => p.brand))].map(b => ({ v:b, l:b, n:Store.products().filter(p => p.brand === b).length })), filters.brand)}
          ${filterGroup('ত্বকের ধরন', 'skin', Object.keys(SKIN_TYPES).map(k => ({ v:k, l:SKIN_TYPES[k], n:Store.products().filter(p => p.skin.includes(k)).length })).filter(x => x.n), filters.skin)}
          ${filterGroup('সমস্যা', 'concern', Object.keys(CONCERNS).map(k => ({ v:k, l:CONCERNS[k], n:Store.products().filter(p => p.concerns.includes(k)).length })).filter(x => x.n), filters.concern)}

          <div class="fgroup">
            <h4 data-action="toggle-fgroup">দাম (৳) ${ICON.chevron}</h4>
            <div class="fbody">
              <div class="price-inputs">
                <input type="number" id="fMin" placeholder="সর্বনিম্ন" value="${filters.min != null ? filters.min : ''}" />
                <span class="muted">—</span>
                <input type="number" id="fMax" placeholder="সর্বোচ্চ" value="${filters.max != null ? filters.max : ''}" />
              </div>
              <button class="btn btn-outline btn-sm btn-block" style="margin-top:10px" data-action="apply-price">দাম প্রয়োগ করুন</button>
            </div>
          </div>

          <div class="fgroup">
            <h4 data-action="toggle-fgroup">অন্যান্য ${ICON.chevron}</h4>
            <div class="fbody">
              <label class="check"><input type="checkbox" data-filter="stock" ${filters.inStock ? 'checked' : ''}/> শুধু মজুত থাকা পণ্য</label>
              <label class="check"><input type="checkbox" data-filter="deal" ${filters.deal ? 'checked' : ''}/> শুধু ছাড় চলছে</label>
            </div>
          </div>

          <button class="btn btn-primary btn-block" style="margin-top:16px;display:none" data-action="close-overlays" id="mobileFilterApply">ফলাফল দেখুন</button>
        </aside>

        <div>
          <div class="shop-toolbar">
            <span class="shop-count"><b>${bn(list.length)}</b>টি পণ্য পাওয়া গেছে</span>
            <div class="toolbar-right">
              <button class="btn btn-outline btn-sm filter-btn" data-action="open-filters">${ICON.filter} ফিল্টার</button>
              <select class="select" id="sortSelect" aria-label="সাজান">
                <option value="popular" ${filters.sort === 'popular' ? 'selected' : ''}>জনপ্রিয়</option>
                <option value="new" ${filters.sort === 'new' ? 'selected' : ''}>নতুন</option>
                <option value="price-asc" ${filters.sort === 'price-asc' ? 'selected' : ''}>কম দাম আগে</option>
                <option value="price-desc" ${filters.sort === 'price-desc' ? 'selected' : ''}>বেশি দাম আগে</option>
                <option value="rating" ${filters.sort === 'rating' ? 'selected' : ''}>সর্বাধিক রিভিউ</option>
              </select>
            </div>
          </div>

          ${activeFilterChips(filters)}

          ${list.length ? productGrid(shown) + (hasMore ? `
            <div class="center" style="margin-top:32px">
              <button class="btn btn-outline btn-lg" data-action="load-more">আরও পণ্য দেখুন</button>
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
    `<span class="af-chip">${esc(label)}<button data-action="rm-filter" data-key="${key}" data-val="${esc(val)}" aria-label="সরান">${ICON.close}</button></span>`);
  f.cat.forEach(v => { const c = CATEGORIES.find(x => x.slug === v); push(c ? c.name : v, 'cat', v); });
  f.sub.forEach(v => push(SUBS[v] || v, 'sub', v));
  f.brand.forEach(v => push(v, 'brand', v));
  f.skin.forEach(v => push(SKIN_TYPES[v] || v, 'skin', v));
  f.concern.forEach(v => push(CONCERNS[v] || v, 'concern', v));
  if (f.min != null) push('সর্বনিম্ন ' + money(f.min), 'min', f.min);
  if (f.max != null) push('সর্বোচ্চ ' + money(f.max), 'max', f.max);
  if (f.inStock) push('মজুত আছে', 'stock', '1');
  if (f.deal) push('ছাড় চলছে', 'deal', '1');
  if (!chips.length) return '';
  return `<div class="active-filters">${chips.join('')}
    <button class="af-chip" data-action="clear-filters" style="border-style:dashed">সব মুছুন</button></div>`;
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
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><span>খোঁজ</span></nav>
    <div class="section tight">
      <div class="sec-head">
        <div><h1 style="font-size:clamp(1.4rem,2.6vw,1.9rem)">“${esc(q)}” এর ফলাফল</h1>
        <p class="sub">${bn(list.length)}টি পণ্য পাওয়া গেছে।</p></div>
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

  const off = discountPct(p);
  const r = Store.ratingFor(p.id);
  const reviews = Store.reviewsFor(p.id);
  const out = p.stock <= 0;
  const related = Store.products().filter(x => x.id !== p.id && (x.category === p.category || x.sub === p.sub)).slice(0, 4);

  const gallery=[...new Set([p.image_url,...(p.images||[])].filter(Boolean))];
  const thumbs=gallery.map((url,i)=>`<button class="pd-thumb ${i===0?'active':''}" data-action="thumb" data-i="${i}" aria-pressed="${i===0}" aria-label="ছবি ${bn(i+1)}">${artMini({...p,image_url:url})}</button>`).join('');

  return `<div class="wrap">
    <nav class="crumb" aria-label="ব্রেডক্রাম্ব">
      <a href="#/">হোম</a><span class="sep">/</span>
      <a href="#/shop">সব পণ্য</a><span class="sep">/</span>
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
          ${r.count ? `${starsHtml(r.rating)} <b style="color:var(--charcoal)">${bn(r.rating.toFixed(1))}</b> <span>(${bn(r.count)}টি রিভিউ)</span>`
                    : `<span class="pill-demo">এখনো কোনো রিভিউ নেই</span>`}
          ${p.demo ? '<span class="pill-demo">ডেমো পণ্য</span>' : ''}
        </div>

        <div class="pd-price">
          <span class="price-now">${money(p.price)}</span>
          ${p.compare > p.price ? `<span class="price-old">${money(p.compare)}</span><span class="price-off">${bn(off)}% ছাড়</span>` : ''}
        </div>

        <p class="pd-short">${esc(p.short)}</p>



        <div class="pd-specs">
          <div><span class="k">মজুত অবস্থা</span><span class="v">${out ? '<span style="color:var(--muted)">এই মুহূর্তে মজুত নেই</span>' : '<span style="color:var(--success)">মজুত আছে</span>'}</span></div>
          <div><span class="k">পরিমাণ</span><span class="v">${esc(p.size)}</span></div>
          <div><span class="k">SKU</span><span class="v en">${esc(p.sku)}</span></div>
          <div><span class="k">উৎপত্তি</span><span class="v">${esc(p.origin)}</span></div>
          <div><span class="k">ত্বকের ধরন</span><span class="v">${p.skin.map(s => esc(SKIN_TYPES[s] || s)).join(', ') || '—'}</span></div>
          <div><span class="k">ব্যবহারের সময়</span><span class="v">${p.tags.includes('night care') ? 'রাত' : p.tags.includes('sunscreen') ? 'সকাল' : 'সকাল ও রাত'}</span></div>
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
          <div class="qty">
            <button data-action="pd-qty" data-delta="-1" aria-label="কমান">${ICON.minus}</button>
            <input type="text" id="pdQty" value="১" aria-label="পরিমাণ" />
            <button data-action="pd-qty" data-delta="1" aria-label="বাড়ান">${ICON.plus}</button>
          </div>
          <span class="tiny muted">${out ? '' : `সর্বোচ্চ ${bn(p.stock)}টি অর্ডার করা যাবে`}</span>
        </div>

        <div class="pd-buy">
          <button class="btn btn-primary btn-lg" data-action="buy-now" data-id="${p.id}" ${out ? 'disabled' : ''}>এখনই কিনুন</button>
          <button class="btn btn-outline btn-lg" data-action="add" data-id="${p.id}" data-qty-source="pdQty" ${out ? 'disabled' : ''}>
            ${ICON.cart} ঝুড়িতে যোগ করুন
          </button>
        </div>

        <div class="pd-wishline">
          <button data-action="wish" data-id="${p.id}" class="${Store.inWishlist(p.id) ? 'on' : ''}">
            ${ICON.heart} ${Store.inWishlist(p.id) ? 'পছন্দের তালিকায় আছে' : 'পছন্দের তালিকায় রাখুন'}
          </button>
        </div>

        <div class="pd-assure">
          <div>${ICON.truck}<span>সারা বাংলাদেশে ডেলিভারি। ঢাকায় ১–২ কার্যদিবস।</span></div>
          <div>${ICON.shield}<span>ক্যাশ অন ডেলিভারি সুবিধা উপলব্ধ।</span></div>
          <div>${ICON.box}<span>পণ্য পাওয়ার ২৪ ঘণ্টার মধ্যে সমস্যা জানাতে পারবেন।</span></div>
          <div>${ICON.phone}<span>অর্ডার যাচাইয়ের জন্য আমাদের টিম ফোন করবে।</span></div>
        </div>

        <div class="acc" style="margin-top:24px">
          <div class="acc-item open">
            <button class="acc-head" data-action="acc" aria-expanded="true">পণ্য সম্পর্কে ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner"><p style="margin:0">${esc(p.description)}</p></div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">কীভাবে ব্যবহার করবেন ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner"><p style="margin:0">${esc(p.usage)}</p></div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">মূল উপাদান ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              ${p.ingredients.length ? `<ul>${p.ingredients.map(i => `<li class="en" style="font-family:'Inter',sans-serif">${esc(i)}</li>`).join('')}</ul>` : '<p>উপাদানের পূর্ণ তালিকা প্যাকেজিংয়ে উল্লেখ করা আছে।</p>'}
            </div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">কার জন্য উপযোগী ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              <p><b>ত্বকের ধরন:</b> ${p.skin.map(s => esc(SKIN_TYPES[s] || s)).join(', ') || '—'}</p>
              <p style="margin:0"><b>লক্ষ্য:</b> ${p.concerns.map(c => CONCERNS[c] || c).join(', ') || 'সাধারণ যত্ন'}</p>
              <div class="tag-row">${p.tags.map(t => `<span class="tag en">${esc(t)}</span>`).join('')}</div>
            </div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">উৎপত্তি ও ব্র্যান্ড তথ্য ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              <p style="margin:0"><b>ব্র্যান্ড:</b> ${esc(p.brand)}<br/><b>উৎপত্তি:</b> ${esc(p.origin)}<br/><b>পরিমাণ:</b> ${esc(p.size)}<br/><b>SKU:</b> <span class="en">${esc(p.sku)}</span></p>
            </div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">সতর্কতা ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              <ul>
                <li>শুধু বাহ্যিক ব্যবহারের জন্য।</li>
                <li>চোখের সংস্পর্শ এড়িয়ে চলুন। সংস্পর্শে এলে পরিষ্কার পানিতে ধুয়ে ফেলুন।</li>
                <li>কোনো উপাদানে অ্যালার্জি থাকলে ব্যবহারের আগে উপাদান তালিকা দেখে নিন।</li>
                <li>নতুন পণ্য ব্যবহারের আগে হাত বা কানের পেছনের ছোট অংশে প্যাচ টেস্ট করুন।</li>
                <li>ঠান্ডা ও শুষ্ক স্থানে, সরাসরি সূর্যালোক থেকে দূরে রাখুন।</li>
                <li>সমস্যা দেখা দিলে ব্যবহার বন্ধ করে চিকিৎসকের পরামর্শ নিন।</li>
              </ul>
            </div></div>
          </div>
          <div class="acc-item">
            <button class="acc-head" data-action="acc" aria-expanded="false">ডেলিভারি তথ্য ${ICON.chevron}</button>
            <div class="acc-body"><div class="acc-inner">
              <ul>
                <li>ঢাকা জেলার charge: ${money(window.GNConfig?.shipping?.dhaka||0)}। Coverage checkout-এ নিশ্চিত করুন।</li>
                <li>অন্যান্য জেলার charge: ${money(window.GNConfig?.shipping?.outside||0)}।</li>
                <li>প্রযোজ্য free-shipping threshold: ${money(window.GNConfig?.shipping?.freeThreshold||0)}। Final charge server quote-এ দেখাবে।</li>
                <li>ক্যাশ অন ডেলিভারি সুবিধা উপলব্ধ।</li>
              </ul>
            </div></div>
          </div>
        </div>

        <!-- Reviews -->
        <div style="margin-top:34px" id="reviews">
          <h3 style="margin-bottom:6px">রিভিউ (${bn(reviews.length)})</h3>
          <p class="tiny muted" style="margin-bottom:18px">শুধু প্রকৃত ক্রেতাদের মতামত এখানে দেখানো হয়। আমরা কৃত্রিম রিভিউ তৈরি করি না।</p>

          ${reviews.length ? reviews.map(rv => `
            <div class="review">
              <div class="review-top">
                <span class="review-name">${esc(rv.name)}</span>
                <span class="review-date">${esc(timeAgo(rv.date))}</span>
              </div>
              <div style="margin-bottom:6px">${starsHtml(rv.rating)}</div>
              <p class="review-text">${esc(rv.text)}</p>
            </div>`).join('') : '<p class="muted" style="font-size:.9rem">এই পণ্যটির জন্য এখনো কোনো রিভিউ নেই। আপনি প্রথম রিভিউ দিতে পারেন।</p>'}

          <form data-form="review" data-id="${p.id}" style="margin-top:22px;background:var(--surface-2);padding:20px;border-radius:var(--r)">
            <h4 style="font-size:.98rem;margin-bottom:12px">আপনার মতামত জানান</h4>
            <div class="form-row">
              <label class="field"><span class="lbl">আপনার নাম <span class="req">*</span></span>
                <input class="input" name="name" required placeholder="যেমন: রুমানা আক্তার" value="${Store.state.user ? esc(Store.state.user.name) : ''}"/></label>
              <div class="field">
                <span class="lbl">রেটিং <span class="req">*</span></span>
                <div class="stars-input" data-stars>
                  ${[1,2,3,4,5].map(i => `<button type="button" data-action="star" data-v="${i}" aria-label="${bn(i)} তারা">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>
                  </button>`).join('')}
                  <input type="hidden" name="rating" value="0"/>
                </div>
              </div>
            </div>
            <label class="field"><span class="lbl">আপনার অভিজ্ঞতা <span class="req">*</span></span>
              <textarea class="textarea" name="text" required placeholder="পণ্যটি ব্যবহারের অভিজ্ঞতা সংক্ষেপে লিখুন…"></textarea></label>
            <button class="btn btn-primary" type="submit">রিভিউ জমা দিন</button>
          </form>
        </div>
      </div>
    </div>

    ${related.length ? `
    <section class="section">
      <div class="sec-head"><div><h2>সম্পর্কিত পণ্য</h2></div><a href="#/c/${p.category}" class="sec-link">আরও দেখুন ${ICON.arrowRight}</a></div>
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
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><span>ঝুড়ি</span></nav>
    <div class="section tight">
      <h1 style="font-size:clamp(1.5rem,3vw,2rem);margin-bottom:22px">আপনার ঝুড়ি</h1>
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
                      <button data-action="qty" data-id="${l.id}" data-delta="-1" aria-label="কমান">${ICON.minus}</button>
                      <input type="text" value="${bn(l.qty)}" readonly aria-label="পরিমাণ" />
                      <button data-action="qty" data-id="${l.id}" data-delta="1" aria-label="বাড়ান" ${l.qty >= l.product.stock ? 'disabled' : ''}>${ICON.plus}</button>
                    </div>
                    <button class="cart-remove" data-action="remove" data-id="${l.id}">${ICON.trash} সরিয়ে ফেলুন</button>
                  </div>
                </div>
                <div class="cart-line-total">
                  ${money(l.subtotal)}
                  <div class="tiny muted" style="font-weight:400">${money(l.product.price)} × ${bn(l.qty)}</div>
                </div>
              </div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-top:16px;flex-wrap:wrap">
            <a href="#/shop" class="btn btn-outline">আরও কেনাকাটা করুন</a>
            <button class="btn btn-ghost" data-action="clear-cart" style="color:var(--danger)">${ICON.trash} ঝুড়ি খালি করুন</button>
          </div>
        </div>

        <aside class="summary">
          <h3>অর্ডার সারসংক্ষেপ</h3>
          <div class="sum-row"><span>পণ্যের মোট মূল্য</span><span class="v">${money(totals.subtotal)}</span></div>
          <div class="sum-row"><span>ডেলিভারি চার্জ</span><span class="v">${totals.subtotal >= 2500 ? 'ফ্রি' : 'চেকআউটে নির্ধারিত'}</span></div>
          <div class="sum-total"><span>সর্বমোট (ডেলিভারি ছাড়া)</span><span class="v">${money(totals.subtotal)}</span></div>

          <div class="coupon-box">
            <input class="input" id="couponInput" placeholder="কুপন কোড থাকলে এখানে লিখুন" aria-label="কুপন কোড" />
            <button class="btn btn-outline" data-action="apply-coupon">প্রয়োগ</button>
          </div>
          <span class="coupon-msg" id="couponMsg"></span>

          ${window.GNConfig?.shipping?.freeThreshold && totals.subtotal < window.GNConfig.shipping.freeThreshold ? `<div class="ship-note">${ICON.info}<span>বর্তমান free shipping threshold ${money(window.GNConfig.shipping.freeThreshold)}; final charge checkout quote-এ নিশ্চিত করুন।</span></div>` : ''}

          <a href="#/checkout" class="btn btn-primary btn-block btn-lg" style="margin-top:18px">অর্ডার সম্পন্ন করুন</a>
          <p class="tiny muted center" style="margin:12px 0 0">চেকআউটে ডেলিভারি চার্জ ও পেমেন্ট পদ্ধতি নিশ্চিত করা হবে।</p>
        </aside>
      </div>
    </div>
  </div>`;
}

/* ---------- Checkout ---------- */
function viewCheckout(){
  if(!window.GNConfig?.checkoutEnabled)return '<div class="wrap section"><div class="co-card"><h1>Checkout setup pending</h1><p>Seller তথ্য ও business setup অনুমোদনের পর order নেওয়া শুরু হবে।</p><a class="btn btn-primary" href="#/page/contact">Support</a></div></div>';
  const totals = calcTotals({});
  if (!totals.lines.length) return `<div class="wrap section">${emptyState('cart')}</div>`;

  const u = Store.state.user || {};
  const savedAddr = (u.addresses && u.addresses[0]) || {};

  return `<div class="wrap">
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><a href="#/cart">ঝুড়ি</a><span class="sep">/</span><span>অর্ডার সম্পন্ন করুন</span></nav>
    <div class="section tight">
      <h1 style="font-size:clamp(1.5rem,3vw,2rem);margin-bottom:6px">অর্ডার সম্পন্ন করুন</h1>
      <p class="muted" style="margin-bottom:26px">নিচের তথ্যগুলো পূরণ করলে আমাদের টিম আপনার সাথে যোগাযোগ করে অর্ডার যাচাই করবে।</p>

      <form id="checkoutForm">
        <div class="co-layout">
          <div>
            <!-- Contact -->
            <div class="co-card">
              <h3><span class="co-step">১</span> যোগাযোগের তথ্য</h3>
              <p class="hint">অর্ডার যাচাই ও ডেলিভারির জন্য এই তথ্য ব্যবহার করা হবে।</p>
              <div class="form-row">
                <label class="field"><span class="lbl">নাম <span class="req">*</span></span>
                  <input class="input" name="name" required value="${esc(u.name || '')}" placeholder="আপনার পূর্ণ নাম" autocomplete="name"/></label>
                <label class="field"><span class="lbl">মোবাইল নম্বর <span class="req">*</span></span>
                  <input class="input en" name="phone" required value="${esc(u.phone || '')}" placeholder="01XXXXXXXXX" inputmode="numeric" maxlength="11" autocomplete="tel"/></label>
              </div>
              <label class="field"><span class="lbl">বিকল্প মোবাইল নম্বর</span>
                <input class="input en" name="phone2" placeholder="ঐচ্ছিক" inputmode="numeric" maxlength="11"/></label>
              <label class="field"><span class="lbl">ইমেইল (ঐচ্ছিক)</span>
                <input class="input en" name="email" type="email" value="${esc(u.email || '')}" placeholder="যেমন: name@email.com" autocomplete="email"/></label>
            </div>

            <!-- Address -->
            <div class="co-card">
              <h3><span class="co-step">২</span> ডেলিভারির ঠিকানা</h3>
              <p class="hint">সঠিক ঠিকানা দিলে ডেলিভারি দ্রুত হয়।</p>
              <div class="form-row">
                <label class="field"><span class="lbl">বিভাগ <span class="req">*</span></span>
                  <select class="select" name="division" id="divisionSel" required>
                    <option value="">বিভাগ নির্বাচন করুন</option>
                    ${Object.keys(DIVISIONS).map(d => `<option ${savedAddr.division === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
                  </select></label>
                <label class="field"><span class="lbl">জেলা <span class="req">*</span></span>
                  <select class="select" name="district" id="districtSel" required>
                    <option value="">প্রথমে বিভাগ নির্বাচন করুন</option>
                  </select></label>
              </div>
              <div class="form-row">
                <label class="field"><span class="lbl">উপজেলা / থানা <span class="req">*</span></span>
                  <input class="input" name="upazila" required value="${esc(savedAddr.upazila || '')}" placeholder="যেমন: সাভার"/></label>
                <label class="field"><span class="lbl">এলাকা / পোস্ট অফিস</span>
                  <input class="input" name="area" value="${esc(savedAddr.area || '')}" placeholder="যেমন: আশুলিয়া"/></label>
              </div>
              <label class="field"><span class="lbl">বাসা / রোড / বিস্তারিত ঠিকানা <span class="req">*</span></span>
                <textarea class="textarea" name="address" required placeholder="বাসা নম্বর, রোড, ল্যান্ডমার্ক…">${esc(savedAddr.address || '')}</textarea></label>
              <label class="field" style="margin-bottom:0"><span class="lbl">ডেলিভারির জন্য অতিরিক্ত নির্দেশনা</span>
                <input class="input" name="note" placeholder="ঐচ্ছিক — যেমন: বিকেলের পরে কল করুন"/></label>
            </div>

            <div class="co-card"><h3><span class="co-step">৩</span> Delivery</h3><p class="hint">জেলা অনুযায়ী server delivery charge যাচাই করে। Confirmed delivery সময় support জানাবে।</p></div>
            <div class="co-card"><h3><span class="co-step">৪</span> Payment</h3>
              ${window.GNConfig?.payments?.cod?'<label class="pay-option sel"><input type="radio" name="payment" value="cod" checked><div><b>Cash on delivery</b><span>পণ্য হাতে পেয়ে courier-কে টাকা দিন।</span></div></label>':''}
              <label class="pay-option ${window.GNConfig?.payments?.online?'':'dis'}"><input type="radio" name="payment" value="online" ${window.GNConfig?.payments?.online?(!window.GNConfig?.payments?.cod?'checked':''):'disabled'}><div><b>SSLCommerz · Card / bKash / Nagad</b><span>${window.GNConfig?.payments?.online?(window.GNConfig.payments.sandbox?'SANDBOX TEST · real টাকা নয়':'Provider-এর hosted checkout-এ উপলব্ধ method দেখুন'):'Merchant setup ছাড়া online payment বন্ধ'}</span></div></label>
              <p class="tiny muted">এই site card number, CVV বা PIN নেয় না। Provider verification ছাড়া paid দেখায় না।</p>
            </div>
          </div>

          <!-- Order summary -->
          <aside class="summary">
            <h3>আপনার অর্ডার</h3>
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
                <input class="input" id="couponInput" placeholder="কুপন কোড" aria-label="কুপন কোড" value="${esc(Checkout.couponCode || '')}" />
                <button class="btn btn-outline" type="button" data-action="apply-coupon">প্রয়োগ</button>
              </div>
              <span class="coupon-msg" id="couponMsg"></span>
            </div>

            <div class="sum-row" style="margin-top:10px"><span>পণ্যের মোট মূল্য</span><span class="v">${money(totals.subtotal)}</span></div>
            ${totals.discount ? `<div class="sum-row discount"><span>ছাড়</span><span class="v">− ${money(totals.discount)}</span></div>` : ''}
            <div class="sum-row"><span>ডেলিভারি চার্জ</span><span class="v">${money(totals.delivery)}</span></div>
            <div class="sum-total"><span>সর্বমোট</span><span class="v">${money(totals.total)}</span></div>

            <div style="margin-top:16px;display:flex;gap:9px;align-items:flex-start;font-size:.82rem;color:var(--muted);line-height:1.7">
              ${ICON.shield}<span>আপনার তথ্য শুধু অর্ডার প্রক্রিয়ার জন্য ব্যবহৃত হবে।</span>
            </div>

            <label class="gn-checkbox"><input type="checkbox" name="accept_terms" required><span>আমি <a href="#/page/terms">terms</a> ও <a href="#/page/privacy">privacy policy</a> পড়েছি।</span></label><div data-recaptcha="checkout"></div><div id="quoteState" class="tiny muted" role="status">Server quote যাচাই হচ্ছে…</div>
            <button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" type="submit" id="placeOrderBtn">অর্ডার নিশ্চিত করুন</button>
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
  if(!o)return '<div class="wrap section"><p>Order ID ও private tracking code দিয়ে দেখুন, অথবা account orders খুলুন।</p><a href="#/track" class="btn btn-primary">Track order</a></div>';
  const labels={pending:'অপেক্ষমাণ',confirmed:'নিশ্চিত',processing:'প্রস্তুত হচ্ছে',packed:'প্যাক হয়েছে',shipped:'পাঠানো হয়েছে',delivered:'Delivered',failed_delivery:'Delivery failed',cancelled:'Cancelled',returned:'Returned',refunded:'Refunded'};
  const c=o.customer||{},flow=['pending','confirmed','processing','packed','shipped','delivered'],cur=flow.indexOf(o.status);
  return '<div class="wrap section" style="max-width:860px">'+(success?'<div class="success-hero"><div class="success-icon">'+ICON.check+'</div><h1>অর্ডার গ্রহণ করা হয়েছে</h1><p class="muted">Order গ্রহণ মানেই online payment সফল নয়; payment status দেখুন।</p></div>':'<h1>Your order</h1>')+
    '<div class="order-box"><div class="order-meta"><div><span>Order ID</span><b class="en">'+esc(o.id)+'</b></div><div><span>Date</span><b>'+bnDate(o.createdAt||o.created_at)+'</b></div><div><span>Status</span><b>'+esc(labels[o.status]||o.status)+'</b></div><div><span>Payment</span><b>'+esc(o.payment_status)+' · '+esc(o.payment)+'</b></div>'+(c.name?'<div><span>Customer</span><b>'+esc(c.name)+'</b></div>':'')+(c.address?'<div><span>Address</span><b>'+esc(c.address+', '+(c.district||''))+'</b></div>':'')+'</div>'+
    o.items.map(it=>'<div class="co-line"><div class="co-line-info"><b>'+esc(it.name)+'</b><span>'+esc(it.label||'')+' · '+money(it.price)+' × '+bn(it.qty)+'</span></div><span class="co-line-price">'+money(it.price*it.qty)+'</span></div>').join('')+
    [['Subtotal',o.subtotal],['Discount',-o.discount],['Delivery',o.delivery],['Tax',o.tax||0]].map(([label,value])=>'<div class="sum-row"><span>'+label+'</span><span class="v">'+money(value)+'</span></div>').join('')+
    '<div class="sum-total"><span>Total</span><span class="v">'+money(o.total)+'</span></div>'+
    (o.tracking_token?'<div class="note-box"><b>Private tracking code — সংরক্ষণ করুন</b><code class="gn-private-code">'+esc(o.tracking_token)+'</code><p class="tiny">Guest order দেখতে ID ও এই code দুটোই লাগবে। Code invoice-এও থাকবে।</p><button class="btn btn-outline btn-sm" data-extra="copy-track" data-id="'+esc(o.id)+'">Copy code</button></div>':'')+
    '<div class="gn-button-row"><button class="btn btn-primary" data-extra="invoice" data-id="'+esc(o.id)+'">Invoice / receipt</button>'+
    (Store.state.user&&['delivered','failed_delivery'].includes(o.status)?'<button class="btn btn-outline" data-extra="return" data-id="'+esc(o.id)+'">Return request</button>':'')+
    (o.payment==='online'&&o.payment_status==='pending'&&o.tracking_token?'<button class="btn btn-outline" data-extra="pay" data-id="'+esc(o.id)+'">Secure payment</button>':'')+
    '<a href="#/shop" class="btn btn-ghost">Shop</a></div></div>'+
    (cur>=0?'<div class="order-box" style="margin-top:20px"><div class="track-steps">'+flow.map((stage,i)=>'<div class="tstep '+(i<=cur?'done':'')+' '+(i===cur?'current':'')+'"><div class="tdot">'+bn(i+1)+'</div><div class="tstep-info"><b>'+esc(labels[stage])+'</b></div></div>').join('')+'</div></div>':'')+
    (o.shipment?'<div class="order-box" style="margin-top:20px"><h3>Courier</h3><p>'+esc(o.shipment.provider)+' · '+esc(o.shipment.tracking_number)+' · '+esc(o.shipment.status)+'</p></div>':'')+'</div>';
}

function viewTrack(){
  return `<div class="wrap">
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><span>অর্ডার ট্র্যাক</span></nav>
    <div class="section tight" style="max-width:600px;margin-inline:auto">
      <h1 style="font-size:clamp(1.4rem,3vw,1.9rem);text-align:center;margin-bottom:8px">অর্ডার ট্র্যাক করুন</h1>
      <p class="muted center" style="margin-bottom:26px">Order ID ও invoice-এ থাকা private tracking code দিয়ে দেখুন।</p>
      <form data-form="track" class="co-card">
        <label class="field"><span class="lbl">অর্ডার আইডি <span class="req">*</span></span>
          <input class="input en" name="orderId" required placeholder="GN-…" /></label>
        <label class="field"><span class="lbl">Private tracking code <span class="req">*</span></span><input class="input en" name="token" required minlength="20" maxlength="100" autocomplete="off"></label>
        <button class="btn btn-primary btn-block btn-lg" type="submit">অর্ডার খুঁজুন</button>
      </form>
      <div id="trackResult" style="margin-top:20px"></div>
    </div>
  </div>`;
}

/* ---------- Wishlist ---------- */
function viewWishlist(){
  const list = Store.state.wishlist.map(id => Store.product(id)).filter(Boolean);
  return `<div class="wrap">
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><span>পছন্দের তালিকা</span></nav>
    <div class="section tight">
      <div class="sec-head"><div><h1 style="font-size:clamp(1.4rem,3vw,1.9rem)">পছন্দের তালিকা</h1>
      <p class="sub">${bn(list.length)}টি পণ্য সংরক্ষিত আছে।</p></div></div>
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
    { k:'profile',  href:'#/account',            label:'প্রোফাইল',        icon:ICON.user },
    { k:'orders',   href:'#/account/orders',     label:'আমার অর্ডার',     icon:ICON.box },
    { k:'wishlist', href:'#/wishlist',           label:'পছন্দের তালিকা',  icon:ICON.heart },
    { k:'address',  href:'#/account/address',    label:'ঠিকানা',          icon:ICON.pin },
    { k:'coupons',  href:'#/account/coupons',    label:'কুপন',            icon:ICON.ticket },
    { k:'settings', href:'#/account/settings',   label:'অ্যাকাউন্ট সেটিংস', icon:ICON.cog },
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
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><span>আমার অ্যাকাউন্ট</span></nav>
    <div class="section tight">
      <div class="acct-layout">
        <aside class="acct-nav">
          ${tabs.map(t => `<a href="${t.href}" class="${(sub === t.k || (t.k === 'profile' && !route.path[1])) ? 'active' : ''}">${t.icon}<span>${esc(t.label)}</span></a>`).join('')}
          <a href="#" data-action="logout" class="danger">${ICON.logout}<span>লগআউট</span></a>
        </aside>
        <div class="acct-panel">${panel}</div>
      </div>
    </div>
  </div>`;
}

function acctProfile(u){
  const orders = Store.state.orders;
  return `<h2>আমার অ্যাকাউন্ট</h2>
  <p class="muted" style="margin-bottom:22px">স্বাগতম, ${esc(u.name)}।</p>
  <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:22px">
    <div class="stat-card"><span>মোট অর্ডার</span><b>${bn(orders.length)}</b></div>
    <div class="stat-card"><span>পছন্দের তালিকা</span><b>${bn(Store.state.wishlist.length)}</b></div>
    <div class="stat-card"><span>সংরক্ষিত ঠিকানা</span><b>${bn((u.addresses || []).length)}</b></div>
  </div>
  <h3 style="font-size:1rem;margin-bottom:12px">ব্যক্তিগত তথ্য</h3>
  <div class="order-meta" style="grid-template-columns:1fr 1fr;border:none;padding:0;margin:0">
    <div><span>নাম</span><b>${esc(u.name)}</b></div>
    <div><span>মোবাইল</span><b class="en">${esc(u.phone)}</b></div>
    <div><span>ইমেইল</span><b class="en">${esc(u.email || '—')}</b></div>
    <div><span>অ্যাকাউন্ট তৈরি</span><b>${u.created_at?bnDate(u.created_at):'—'}</b></div>
  </div>
  <a href="#/account/settings" class="btn btn-outline" style="margin-top:18px">তথ্য সম্পাদনা করুন</a>`;
}

function acctOrders(){
  const u = Store.state.user;
  const orders = Store.state.orders;
  if (!orders.length) return `<h2>আমার অর্ডার</h2>${emptyState('orders')}`;
  const labels = { pending:'অপেক্ষমাণ', confirmed:'নিশ্চিত', processing:'প্রস্তুত হচ্ছে', shipped:'পাঠানো হয়েছে', delivered:'ডেলিভারি সম্পন্ন', cancelled:'বাতিল', returned:'ফেরত' };
  return `<h2>আমার অর্ডার</h2>
  <p class="muted" style="margin-bottom:20px">${bn(orders.length)}টি অর্ডার পাওয়া গেছে।</p>
  ${orders.map(o => `
    <div class="order-card">
      <div class="oc-top">
        <div>
          <span class="oc-id en">${esc(o.id)}</span>
          <span class="oc-date"> • ${bnDate(o.createdAt)}</span>
        </div>
        <span class="status st-${esc(o.status)}">${esc(labels[o.status] || o.status)}</span>
      </div>
      <div class="tiny muted" style="margin-bottom:10px">${o.items.length}টি পণ্য • ${money(o.total)} • ${o.payment === 'cod' ? 'ক্যাশ অন ডেলিভারি' : esc(o.payment)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a href="#/order/${o.id}" class="btn btn-outline btn-sm">বিস্তারিত দেখুন</a>
        ${o.status === 'delivered' ? `<button class="btn btn-ghost btn-sm" data-action="reorder" data-id="${esc(o.id)}">আবার অর্ডার করুন</button>` : ''}
      </div>
    </div>`).join('')}`;
}

function acctAddress(u){
  const addrs = u.addresses || [];
  return `<h2>সংরক্ষিত ঠিকানা</h2>
  <p class="muted" style="margin-bottom:20px">চেকআউটের সময় এই ঠিকানা স্বয়ংক্রিয়ভাবে পূরণ হবে।</p>
  ${addrs.length ? addrs.map((a, i) => `
    <div class="order-card">
      <div class="oc-top">
        <b style="font-size:.92rem">${esc(a.label || 'ঠিকানা ' + bn(i+1))}</b>
        <button class="icon-mini danger" data-action="del-address" data-i="${i}" aria-label="মুছুন">${ICON.trash}</button>
      </div>
      <p class="tiny muted" style="margin:0;line-height:1.8">${esc(a.address)}, ${esc(a.upazila || '')}, ${esc(a.district)}, ${esc(a.division)}</p>
    </div>`).join('') : '<p class="muted" style="font-size:.9rem">এখনো কোনো ঠিকানা সংরক্ষণ করা হয়নি।</p>'}

  <form data-form="address" style="margin-top:24px">
    <h3 style="font-size:1rem;margin-bottom:14px">নতুন ঠিকানা যোগ করুন</h3>
    <div class="form-row">
      <label class="field"><span class="lbl">বিভাগ <span class="req">*</span></span>
        <select class="select" name="division" required>
          <option value="">নির্বাচন করুন</option>
          ${Object.keys(DIVISIONS).map(d => `<option>${esc(d)}</option>`).join('')}
        </select></label>
      <label class="field"><span class="lbl">জেলা <span class="req">*</span></span>
        <input class="input" name="district" required placeholder="জেলার নাম"/></label>
    </div>
    <div class="form-row">
      <label class="field"><span class="lbl">উপজেলা / থানা <span class="req">*</span></span>
        <input class="input" name="upazila" required /></label>
      <label class="field"><span class="lbl">এলাকা</span><input class="input" name="area" /></label>
    </div>
    <label class="field"><span class="lbl">বিস্তারিত ঠিকানা <span class="req">*</span></span>
      <textarea class="textarea" name="address" required></textarea></label>
    <button class="btn btn-primary" type="submit">ঠিকানা সংরক্ষণ করুন</button>
  </form>`;
}

function acctCoupons(){
  return '<h2>কুপন</h2><p class="muted">স্টোরের প্রকাশিত প্রচারণার কোড থাকলে চেকআউটে দিন। মেয়াদ, ব্যবহারসীমা ও মোট ছাড় সার্ভার যাচাই করবে।</p>';
}

function acctSettings(){
  return '<h2>অ্যাকাউন্ট সেটিংস</h2><p class="muted" role="status">Account settings লোড হচ্ছে। প্রয়োজনে পেজটি আবার খুলুন।</p>';
}

function viewAuth(){
  return `<div class="wrap section" style="max-width:520px"><h1>অ্যাকাউন্ট</h1>
    <div class="co-card"><form id="loginForm" data-firebase="login">
      <label class="field"><span class="lbl">ইমেইল</span><input class="input" name="email" type="email" autocomplete="email" required></label>
      <label class="field"><span class="lbl">পাসওয়ার্ড</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
      <div data-recaptcha="login"></div><button class="btn btn-primary" type="submit">Sign in</button></form>
    <p class="muted" style="margin-top:16px">Firebase account দিয়ে প্রবেশ করুন।</p></div></div>`;
}

/* ---------- Journal ---------- */
function viewJournal(){
  if(!window.GNConfig?.journalEnabled)return '<div class="wrap section"><h1>Glow Journal</h1><p class="muted">সম্পাদকীয় পর্যালোচনার পর লেখা প্রকাশ করা হবে।</p></div>';
  return `<div class="wrap">
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><span>Glow Journal</span></nav>
    <div class="section tight">
      <div class="sec-head">
        <div><h1 style="font-size:clamp(1.5rem,3vw,2.1rem)">Glow Journal</h1>
        <p class="sub">ত্বক, চুল ও দৈনন্দিন যত্ন নিয়ে সহজ ভাষায় প্রয়োজনীয় তথ্য। আমরা চিকিৎসা পরামর্শ দিই না।</p></div>
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
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><a href="#/journal">Glow Journal</a><span class="sep">/</span><span>${esc(a.title)}</span></nav>
    <article class="section tight article">
      <span class="jmeta">${esc(a.cat)} • পড়তে সময় লাগবে ${esc(a.read)}</span>
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
        এই লেখাটি সাধারণ তথ্যের জন্য, চিকিৎসা পরামর্শ নয়। ত্বকের সমস্যা দীর্ঘস্থায়ী হলে চর্মরোগ বিশেষজ্ঞের পরামর্শ নিন।
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:26px">
        <a href="#/journal" class="btn btn-outline">সব লেখা</a>
        <a href="#/c/skincare" class="btn btn-primary">স্কিন কেয়ার পণ্য দেখুন</a>
      </div>
    </article>

    <section class="section">
      <div class="sec-head"><div><h2>আরও পড়ুন</h2></div></div>
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
      <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><span>সাধারণ প্রশ্ন</span></nav>
      <div class="section tight" style="max-width:820px;margin-inline:auto">
        <h1 style="margin-bottom:10px">সাধারণ প্রশ্ন</h1>
        <p class="muted" style="margin-bottom:26px">আমাদের কাছে যেসব প্রশ্ন সবচেয়ে বেশি আসে।</p>
        <div class="acc">
          ${PAGES.faq.faqs.map(([q, a2], i) => `
            <div class="acc-item ${i === 0 ? 'open' : ''}">
              <button class="acc-head" data-action="acc" aria-expanded="${i === 0}">${esc(q)} ${ICON.chevron}</button>
              <div class="acc-body"><div class="acc-inner">${esc(a2)}</div></div>
            </div>`).join('')}
        </div>
        <div class="co-card" style="margin-top:30px;text-align:center">
          <h3 style="font-size:1.05rem;margin-bottom:6px">উত্তর পাননি?</h3>
          <p class="muted" style="margin-bottom:16px">আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।</p>
          <a href="#/page/contact" class="btn btn-primary">যোগাযোগ করুন</a>
        </div>
      </div>
    </div>`;
  }

  const page = PAGES[slug];
  if (!page) return `<div class="wrap section">${emptyState('generic')}</div>`;

  return `<div class="wrap">
    <nav class="crumb"><a href="#/">হোম</a><span class="sep">/</span><span>${esc(page.title)}</span></nav>
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

  if(Store.state.catalogError&&['','shop','c','p','search'].includes(route.path[0]||''))html='<div class="wrap" style="padding-top:20px"><div class="co-card" role="alert">'+esc(Store.state.catalogError)+' <button class="btn btn-outline btn-sm" data-action="retry-catalog">Retry catalog</button></div></div>'+html;
  app.innerHTML=html;
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
    ? '<option value="">জেলা নির্বাচন করুন</option>' + list.map(d => `<option>${esc(d)}</option>`).join('')
    : '<option value="">প্রথমে বিভাগ নির্বাচন করুন</option>';
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
  const status=$('#quoteState');if(status)status.textContent='Server quote যাচাই হচ্ছে…';
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
    el.textContent = 'কুপন প্রয়োগ হয়েছে: ' + Checkout.coupon.code + ' — ' + Checkout.coupon.desc;
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
      toast(on ? 'পছন্দের তালিকায় যোগ করা হয়েছে।' : 'পছন্দের তালিকা থেকে সরানো হয়েছে।', 'ok');
      updateBadges(false);
      if (route.path[0] === 'wishlist' || route.path[0] === 'p') render();
      else {
        $$(`.pcard-wish[data-id="${id}"]`).forEach(b => b.classList.toggle('on', on));
        const pb = document.querySelector('.pd-wishline button');
        if (pb){
          pb.classList.toggle('on', on);
          pb.innerHTML = ICON.heart + ' ' + (on ? 'পছন্দের তালিকায় আছে' : 'পছন্দের তালিকায় রাখুন');
        }
      }
      break;
    }
    case 'quick': {
      const p = Store.product(id);
      if (!p) break;
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
              ${r.count ? `${starsHtml(r.rating)} <span>${bn(r.rating.toFixed(1))} (${bn(r.count)})</span>` : '<span class="pill-demo">এখনো কোনো রিভিউ নেই</span>'}
            </div>
            <div class="pd-price" style="margin-bottom:14px;padding-bottom:14px">
              <span class="price-now" style="font-size:1.35rem">${money(p.price)}</span>
              ${p.compare > p.price ? `<span class="price-old">${money(p.compare)}</span><span class="price-off">${bn(discountPct(p))}% ছাড়</span>` : ''}
            </div>
            <p class="muted" style="font-size:.9rem;line-height:1.85">${esc(p.short)}</p>
            <div style="margin:14px 0;font-size:.85rem;color:${out ? 'var(--muted)' : 'var(--success)'}">
              ${out ? 'এই মুহূর্তে মজুত নেই' : 'মজুত আছে'}
            </div>
            <div class="pd-specs" style="margin-bottom:16px">
              <div><span class="k">পরিমাণ</span><span class="v">${esc(p.size)}</span></div>
              <div><span class="k">ত্বকের ধরন</span><span class="v">${p.skin.map(s => esc(SKIN_TYPES[s] || s)).join(', ') || '—'}</span></div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-primary" data-action="add" data-id="${p.id}" ${out ? 'disabled' : ''}>ঝুড়িতে যোগ করুন</button>
              <a href="#/p/${p.slug}" class="btn btn-outline" data-action="close-modal">বিস্তারিত দেখুন</a>
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
      toast('পণ্যটি ঝুড়ি থেকে সরানো হয়েছে।', 'ok');
      renderCartDrawer();
      if (route.path[0] === 'cart' || route.path[0] === 'checkout') render();
      updateBadges(false);
      break;
    }
    case 'clear-cart': {
      if (confirm('ঝুড়ির সব পণ্য সরিয়ে ফেলতে চান?')){
        Store.clearCart();
        renderCartDrawer();
        render();
      }
      break;
    }
    case 'retry-catalog':{await syncProductsFromAPI();render();break;}
    case 'apply-coupon':{
      const code=($('#couponInput')?.value||'').trim().toUpperCase();Checkout.couponCode=code;Checkout.couponError='';
      if(!code){Checkout.coupon=null;Checkout.quote=null;toast('Coupon code লিখুন।','err');break;}
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
      if (confirm('সব ডেমো ডেটা (ঝুড়ি, অর্ডার, অ্যাকাউন্ট) মুছে ফেলতে চান?')) Store.resetAll();
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
      toast(added ? 'পণ্যগুলো ঝুড়িতে যোগ করা হয়েছে।' : 'পণ্যগুলো এই মুহূর্তে মজুত নেই।', added ? 'ok' : 'warn');
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
    if(!u){toast('Delivered purchase-এর signed-in account থেকে review দিন।','err');return;}
    const o=Store.state.orders.find(o=>o.status==='delivered'&&o.items.some(i=>i.product_id===p.apiId));
    if(!o){toast('Delivered purchase পাওয়া যায়নি।','err');return;}
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
    const box=$('#trackResult');if(!box)return;box.innerHTML='<p role="status">Order যাচাই হচ্ছে…</p>';
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
  Checkout.placing=true;const btn=$('#placeOrderBtn');if(btn){btn.disabled=true;btn.textContent='Stock ও order যাচাই হচ্ছে…';}
  try{
    const division=val('division'),district=val('district'),items=quoteItems();
    if(!items.length)throw new Error('Bag is empty.');
    const previous=Checkout.quoteKey===quoteKey(division,district)?Checkout.quote?.total_minor:null;
    const q=await requestQuote(division,district);
    if(previous!==null&&previous!==q.total_minor){await updateCheckoutSummary();throw new Error('Price বা shipping বদলেছে। নতুন total দেখে আবার confirm করুন।');}
    const payload={items,customer:{name:val('name'),phone:val('phone'),phone2:val('phone2')||null,email:val('email')||null,division,district,upazila:val('upazila'),area:val('area')||null,address:val('address'),note:val('note')||null},coupon:Checkout.couponCode||null,payment:val('payment')||'cod',expected_total_minor:q.total_minor,accept_terms:true};
    const identity=JSON.stringify(payload);
    if(!Checkout.attempt||Checkout.attempt.identity!==identity)Checkout.attempt={identity,key:crypto.randomUUID()};
    payload.recaptcha_token=window.GNAuth?await GNAuth.captcha('checkout',form):null;
    const o=await GNApi.post('/api/orders',payload,{headers:{'Idempotency-Key':Checkout.attempt.key}});
    Store.createOrder({...o,customer:payload.customer});Store.clearCart();Checkout.coupon=null;Checkout.couponCode='';Checkout.quote=null;Checkout.attempt=null;
    await syncProductsFromAPI();navigate('order-success/'+o.id);toast('Order '+o.id+' গ্রহণ হয়েছে।','ok');
    if(o.payment==='online'){
      try{const result=await GNApi.post('/api/payments/'+o.id+'/initiate',{order_id:o.id,token:o.tracking_token});const url=new URL(result.payment_url);if(url.protocol!=='https:'||!['sandbox.sslcommerz.com','securepay.sslcommerz.com'].includes(url.hostname))throw new Error('Unsafe payment URL');location.assign(url.href);}
      catch(error){toast('Order saved. Payment: '+error.message,'err');}
    }
  }catch(error){Checkout.quote=null;toast(error.message,'err');if(btn){btn.disabled=false;btn.textContent='অর্ডার নিশ্চিত করুন';}}
  finally{Checkout.placing=false;}
}

/* ==========================================================================
 * 13. SEARCH SUGGESTIONS
 * ======================================================================== */
(function initSearch(){
  const input = $('#searchInput');
  const box = $('#suggestBox');
  if (!input || !box) return;

  const popular = ['serum', 'sunscreen', 'face wash', 'নিয়াসিনামাইড', 'SPF 50', 'ময়েশ্চারাইজার'];

  function closeSuggest(){ box.innerHTML = ''; }

  function renderSuggest(q){
    const term = (q || '').trim().toLowerCase();
    if (!term){
      box.innerHTML = `<div class="suggest">
        <div class="sg-head">জনপ্রিয় খোঁজ</div>
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
        <div style="margin-bottom:6px">“${esc(q)}” নামে কোনো পণ্য পাওয়া যায়নি।</div>
        <span class="tiny">অন্য কোনো নাম বা ব্র্যান্ড দিয়ে খুঁজে দেখুন।</span>
      </div></div>`;
      return;
    }
    box.innerHTML = `<div class="suggest">
      <div class="sg-head">পণ্য</div>
      ${matches.map(p => `<a href="#/p/${p.slug}" data-action="sg-go">
        <div class="sg-img">${artMini(p)}</div>
        <div style="flex:1;min-width:0">
          <div class="sg-name">${esc(p.name)}</div>
          <div class="sg-meta">${esc(p.brand)} • ${esc(SUBS[p.sub] || '')}</div>
        </div>
        <span class="sg-price">${money(p.price)}</span>
      </a>`).join('')}
      <a href="#/search?q=${encodeURIComponent(q)}" data-action="sg-go" style="border-top:1px solid var(--line);justify-content:center;font-size:.85rem;font-weight:600;color:var(--sage-deep)">
        “${esc(q)}” এর সব ফলাফল দেখুন
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
  Store.state.catalogLoading=true;
  try{
    const rows=await GNApi.get('/api/products');if(!Array.isArray(rows))throw new Error('Invalid catalog response.');
    Store.state.products=rows.map(row=>P({...row,id:'p'+String(row.id).padStart(2,'0'),apiId:row.id,price:Number(row.price),stock:Number(row.stock),demo:false}));
    Store.state.catalogError='';
  }catch(error){Store.state.products=[];Store.state.catalogError=error.message;}
  finally{Store.state.catalogLoading=false;Store.emit();}
}
async function loadCustomer(){
  try{
    const user=await GNApi.get('/api/auth/me');if(!user)return;
    Store.setUser(user);await GNApi.get('/api/auth/csrf');
    const orders=await GNApi.get('/api/orders/me');Store.state.orders=orders.map(o=>({...o,createdAt:o.created_at,customer:{phone:user.phone}}));
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
$('#app').innerHTML='<div class="wrap section" role="status"><div class="gn-spinner"></div><p class="center">Product catalog loading…</p></div>';
Promise.all([window.GNConfigReady,syncProductsFromAPI(),loadCustomer()]).then(()=>render());
window.GNStore={store:Store,render,navigate,toast,esc,productImage,loadCustomer,syncProducts:syncProductsFromAPI,quoteItems,requestQuote,Checkout};
Store.subscribe(()=>document.dispatchEvent(new CustomEvent('gn-state')));
let customerTimer;
Store.subscribe(()=>{
  clearTimeout(customerTimer);if(!Store.state.user)return;
  customerTimer=setTimeout(()=>GNApi.put('/api/customer/state',{cart:quoteItems(),wishlist:Store.state.wishlist.map(id=>Number(id.slice(1))),comparison:Store.state.comparison.map(id=>Number(id.slice(1)))}).catch(()=>console.info('Account list sync is unavailable.')),750);
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
        <span class="bn">গ্লো ন্যাচার</span><br/><span class="en">Glow Nuture</span>
        <p>ত্বক, চুল ও দৈনন্দিন যত্নের প্রয়োজনীয় পণ্য—এক জায়গায়। পরিষ্কার তথ্য, সহজ কেনাকাটা।</p>
        <div class="socials">
          <a href="https://www.facebook.com/glownuturebd" target="_blank" rel="noopener noreferrer" aria-label="Facebook">${ICON.fb}</a>
          <a href="https://www.instagram.com/glownuture/reels/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${ICON.ig}</a>
          <a href="#/page/contact" aria-label="WhatsApp">${ICON.wa}</a>
        </div>
      </div>
      <div>
        <h4>কেনাকাটা</h4>
        <ul class="f-list">
          ${CATEGORIES.map(c => `<li><a href="#/c/${c.slug}">${esc(c.name)}</a></li>`).join('')}
          <li><a href="#/shop?sort=new">নতুন পণ্য</a></li>
          <li><a href="#/shop?deal=1">অফার</a></li><li><a href="#/ordinary">The Ordinary catalog</a></li><li><a href="#/compare">Compare products</a></li>
        </ul>
      </div>
      <div>
        <h4>সহায়তা</h4>
        <ul class="f-list">
          <li><a href="#/page/about">আমাদের সম্পর্কে</a></li>
          <li><a href="#/page/contact">যোগাযোগ</a></li>
          <li><a href="#/page/delivery">ডেলিভারি নীতি</a></li>
          <li><a href="#/page/return">রিটার্ন নীতি</a></li>
          <li><a href="#/page/privacy">গোপনীয়তা নীতি</a></li>
          <li><a href="#/page/terms">শর্তাবলি</a></li>
          <li><a href="#/page/faq">সাধারণ প্রশ্ন</a></li>
          <li><a href="#/track">অর্ডার ট্র্যাক</a></li>
        </ul>
      </div>
      <div class="f-contact-col">
        <h4>গ্রাহক সহায়তা</h4>
        <ul class="f-contact">
          <li>${ICON.phone}<span>মোবাইল / হোয়াটসঅ্যাপ<br/><span class="en">+৮৮০ ১XXX-XXXXXX</span></span></li>
          <li>${ICON.mail}<span>ইমেইল<br/><span class="en">support@glownuture.com</span></span></li>
          <li>${ICON.pin}<a href="#/page/contact">Support message পাঠান</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${bn(new Date().getFullYear())} গ্লো ন্যাচার। সর্বস্বত্ব সংরক্ষিত।</span>
      <div class="pay-note">
        <span>${ICON.shield} নিরাপদ অর্ডার</span>
        <span>${ICON.truck} সারা দেশে ডেলিভারি</span>
        <span>ক্যাশ অন ডেলিভারি</span>
      </div>
    </div>
  </div>`;

window.addEventListener('hashchange', render);

/* Escape closes overlays */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeOverlays();
});

})();
