# GlowNuture — শুরু থেকে সঠিক Infrastructure (বাংলা)

**এই ফাইল পড়ে শুরু করুন।** এটি একটি full-stack FastAPI e-commerce source project; শুধু `index.html` দিয়ে production দোকান চালানো যায় না। এই ZIP আপনার কম্পিউটারে কপি তৈরি করেছে; এটি কোনো server, DNS, Firebase project বা GitHub repository-তে নিজে থেকে কিছু deploy করেনি।

## 0. ফোল্ডার বিন্যাস

```text
GlowNuture-Commerce/                     <-- এখান থেকেই সব command চালাবেন
├── CHECK_SETUP.bat                       Windows-এর জন্য read-only diagnostics
├── run-local.bat                         Python environment + local API + workers
├── BUILD_PREVIEW.bat                     পৃথক static Firebase PREVIEW build
├── backend/
│   ├── app/                              FastAPI, security, business APIs, jobs
│   ├── migrations/                       Alembic SQL migrations
│   ├── tests/
│   ├── requirements.lock
│   └── .env.example                       template; বাস্তব .env ব্যক্তিগত
├── frontend/
│   ├── index.html                        full-stack application-এর মূল UI
│   ├── assets/                           CSS/JS/images
│   ├── catalog/
│   └── media/
├── scripts/                              startup, backups, diagnostics, preview build
├── tests/                                stdlib-based infrastructure checks
├── firebase.json                         existing rules + generated static preview Hosting target
├── firebase.preview.json                 isolated preview hosting only
├── docker-compose.yml                    local PostgreSQL + API + workers
├── .github/workflows/verify-commerce.yml test/verify; NOT auto-deploy
└── docs/                                 deployment, security, operations instructions
```

**গুরুত্বপূর্ণ:** Screenshot-এ যে outer folder-এ `public` এবং `GlowNuture-Commerce` ছিল, সেই **outer folder-এ আর `firebase init` চালাবেন না**। আসল project root হলো ZIP-এর ভেতরের `GlowNuture-Commerce`। পুরোনো outer `public`-এর কোন ফাইল নতুন project-এ copy করবেন না। যাচাই ছাড়া `firebase deploy` নয়।

## 1. Windows-এ Local Website চালু করা

1. ZIP extract করুন। `GlowNuture-Commerce` folder খুলুন।
2. বিশ্বস্ত উৎস থেকে **Python 3.12 64-bit** ইনস্টল করুন; installation-এ Python launcher (`py`) থাকতে হবে। Windows Terminal থেকে `py -3.12 --version` যাচাই করুন।
3. প্রথমে `CHECK_SETUP.bat` চালাতে পারেন। প্রথমবার `backend/.env` না থাকায় কিছু warning/error **স্বাভাবিক**; এটি কিছু বদলায় না।
4. `run-local.bat` double click করুন। এটি প্রথমে local `.venv` বানায়, pinned requirements install করে, এবং `backend/.env` না থাকলে সুরক্ষিত random keys তৈরি করে। এর জন্য প্রথমবার Internet প্রয়োজন।
5. ভেতরের Alembic migrations চালিয়ে API ও দুটি worker শুরু হবে। CMD বন্ধ রাখবেন না। Browser-এ `http://127.0.0.1:8000` খুলুন।
6. আলাদাভাবে `http://127.0.0.1:8000/api/health` এবং `http://127.0.0.1:8000/api/ready` দেখুন। প্রথমটি API response, দ্বিতীয়টি database connectivity যাচাই করে। **Checkout প্রথমে বন্ধ থাকবে**।
7. কোনো error হলে CMD-এর **শেষ 30–50 লাইন** পাঠান, কিন্তু `.env` বা গোপন API key/DB password পাঠাবেন না।

**ভুল করবেন না:** `backend/.env`, `*.db`, SQLite, backup এবং service-account key GitHub-এ upload করা যাবে না। পুরোনো encryption keys হারিয়ে গেলে existing customer data decrypt করা যাবে না। `scripts/setup_local.py` পুরোনো `.env` overwrite করে না।

### পণ্যের ছবি বা ছবির লিংক যোগ করা

1. Admin → Products-এ পণ্যটি draft হিসেবে save করুন, তারপর **Review / images** খুলুন।
2. নিজের বা ব্যবহারের অনুমতি পাওয়া JPEG/PNG/WebP ছবি **Upload your own / authorized photograph** দিয়ে যোগ করুন। Owner/admin চাইলে **Import a permitted image URL**-এ সরাসরি public HTTPS ছবির লিংক দিতে পারেন। ছবি সর্বোচ্চ 5 MB।
3. দুই ক্ষেত্রেই ছবির স্বত্বাধিকারী, লাইসেন্স/লিখিত অনুমতি, উৎসের প্রমাণ এবং সঠিক পণ্য/variant-এর মিল নিশ্চিত করুন। Gallery-তে main ছবি বেছে **Check stored images** চালান। নতুন ছবি review শেষ না হওয়া পর্যন্ত private থাকে।

এই source-এ থাকা তিনটি SVG শুধু সাজসজ্জার illustration; এগুলো কোনো আসল পণ্যের ছবি নয়। বাস্তব পণ্যের ছবি ও অনুমতি owner-এর কাছ থেকে নিতে হবে। বিস্তারিত [পণ্য অনুমোদনের নির্দেশিকা](PRODUCT_APPROVAL_PLAYBOOK.md) দেখুন।

### দেওয়া CSV/XLSX ক্যাটালগ import

`run-local.bat` দিয়ে API ও catalog worker চালু করুন। Business owner (`super_admin`) হিসেবে sign in করে Admin → Catalog sources → **Import supplied catalogs** খুলুন। Source/metadata ব্যবহারের শর্ত যাচাই করে confirmation-এ টিক দিয়ে submit করলে server `GlowNuture_500_Products_Website.csv`, `The_Ordinary_GlowNuture_BD_Catalog.xlsx` এবং `Shajgoj_BDT_Product_Price_Catalog.csv`-এর জন্য তিনটি পৃথক অনুমোদিত file source তৈরি/পুনর্ব্যবহার করে তিনটি job queue করবে (500 + 12 + 227 row)। Job-এর status/count Admin-এ দেখুন। চাইলে আলাদাভাবে তিনটি source register করে প্রতিটি পুরো ফাইল upload করাও যায়; ফাইলপ্রতি সীমা 1 MB ও 500 product row, এবং 100-row worker page স্বয়ংক্রিয়ভাবে প্রক্রিয়াকৃত হয়। শুধু GitHub-এ ফাইল রাখলে store database-এ import হয় না।

সব নতুন পণ্য private **DRAFT** হিসেবে আসে। Website CSV-তে GlowNuture দাম ও stock ফাঁকা; অন্য দুই ফাইলের দাম প্রতিযোগী দোকানের তথ্য, আপনার বিক্রয়মূল্য নয়। Image URL শুধু যাচাইয়ের candidate। Admin → Product review-এ আসল BDT দাম, বাস্তব stock, ingredient/usage, supplier ও মেয়াদ যাচাই করুন। ছবির স্বত্ব, অনুমতি এবং সঠিক product/variant-এর মিল দেখে অনুমোদিত URL থেকে managed media তৈরি করুন। তারপর আলাদা submit → verify → publish ধাপ শেষ করলে পণ্য দোকানে দেখা যাবে। ফাইলের স্বীকৃত কলাম ও নিয়ম [Product API নির্দেশিকায়](PRODUCT_API.md) আছে।

## 2. Firebase Hosting — ONLY একটি Preview

Firebase Hosting static HTML/CSS/JS serve করতে পারে; আপনার private Python API, relational database এবং worker এখানে নিজে থেকে চলবে না। সেজন্য preview কেবল ডিজাইন/markup/asset পরিদর্শনের জন্য; product, account, cart, admin, stock, checkout-এর live functionality সেখানে কাজ করবে না। Generated preview-এর ওপরের দিকে ইচ্ছাকৃত **PREVIEW ONLY** notice থাকবে।

Project root (`GlowNuture-Commerce`) থেকে:

```powershell
py -3.12 scripts\build_firebase_preview.py
py -3.12 scripts\doctor.py --mode firebase-preview
```

অথবা `BUILD_PREVIEW.bat` double click করুন। কাজ শেষে `build/firebase-preview` তৈরি হবে; মূল `frontend/` অপরিবর্তিত থাকবে।

Firebase CLI না থাকলে আগে অফিসিয়াল npm-এর মাধ্যমে CLI ইনস্টল করুন:

```powershell
npm install -g firebase-tools
firebase login
```

নিজের Firebase account এবং Hosting permissions নিশ্চিত করে **শুধু preview channel-এ** পরীক্ষা করতে পারেন:

```powershell
firebase hosting:channel:deploy glownuture-preview --project glownuture-f157c --config firebase.preview.json
```

Preview link পাওয়া মানে live e-commerce deploy হয়েছে এমন নয়। **এই demo build-এ `--only hosting` দিয়ে live channel deploy করবেন না।** Firebase Console-এ Hosting site তৈরি/enable করার প্রয়োজন হতে পারে; কোনো plan/billing change অনুমান করবেন না।

## 3. GitHub repository সুরক্ষিতভাবে আপডেট

এই `GlowNuture-Commerce` directory-তেই existing Git repository আছে; `origin` হলো `https://github.com/DreamTime24/GlowNuture.git`। নতুন project বা clone বানানোর প্রয়োজন নেই। পরিবর্তন পর্যালোচনা করে শুধু প্রয়োজনীয় source ফাইল stage করুন; local Firebase welcome page, `.agents/`, `.env`, `.venv`, `build/`, DB, credentials ও backups যোগ করবেন না।

```powershell
git status --short
git diff --stat
git diff --check
git add --update
git diff --cached --check
git commit -m "Update GlowNuture storefront"
git push origin main
```

**`git push --force` বা `git reset --hard` ব্যবহার করবেন না।** Branch protection থাকলে existing repository-তে review branch ও Pull Request ব্যবহার করুন। CI automatic tests চালাবে; **production auto-deploy সেট করা হয়নি**, কারণ server, database, domain, billing ও approval এখনো নিশ্চিত নয়।

## 4. Production Full-Stack Architecture

```text
Customer Browser: https://glownuture.com
                     |
             HTTPS / Nginx
                     |
       ┌─────────────┴───────────────────┐
       |                                 |
FastAPI (frontend + /api)       Managed / private media
       |                                 |
       +---- PostgreSQL database         |
       +---- notification worker         |
       +---- catalog import worker ------+
       +---- Firebase Admin identity verification
       +---- approved payment/shipping integrations (only when enabled)
```

বর্তমান `ops/nginx.conf`, `ops/*.service`, `backend/Dockerfile`, `docker-compose.yml` কনফিগারেশনের starting point। **Namecheap Shared Hosting-এ FastAPI/ASGI fully supported ধরে নেবেন না**। যদি VPS/compatible server পাওয়া যায়, পরীক্ষিত production FastAPI + PostgreSQL + workers + HTTPS দিয়ে deploy করা যায়। যদি Shared Hosting হয়, backend ASGI-capable approved host-এ রাখতে হবে; একই-origin proxy/CORS/cookie strategy নতুন করে যাচাই করতে হবে।

Production আগে যা verify করা অপরিহার্য: exact hosting plan, domain/DNS ownership, TLS, secret storage, tested backups/restores, managed PostgreSQL, Firebase Admin credentials + allowed domain, staff MFA, original licensed product photos, real BDT price/stock, payment gateway sandbox reconciliation, courier workflow, mobile QA, security and performance tests।

পরিবেশ ঠিক হলে **read-only checks**:

```powershell
py -3.12 scripts\doctor.py --mode local
py -3.12 scripts\doctor.py --mode production
```

Production doctor **শুধু preliminary offline checks**; passing status মানে live-ready নয়। Root project `.env.example` শুধু template। Configuration নিরাপদে কনফিগার না করে checkout on করবেন না। পূর্বে কোনো private Parse key chat-এ প্রকাশিত হয়ে থাকলে সেটি owner account থেকে rotate করুন।

## 5. QA / diagnostics

```powershell
py -3.12 -m unittest discover -s tests -p "test_infrastructure.py" -v
node scripts/check_frontend.cjs
npm ci --ignore-scripts
npm run test:frontend
cd backend
..\.venv\Scripts\python.exe -m pytest -q
```

Local backend tests isolated DB ব্যবহার করে; আসল production DB-তে test suite চালানো যাবে না। Before migrations/backups on existing production, see `docs/DEPLOY_GLOWNUTURE_NAMECHEAP.md` and `docs/OWNER_ACTION_REQUIRED.md`.

## 6. Where to continue

- **Read this first:** `docs/INFRASTRUCTURE_START_HERE_BN.md`
- Provider/price/approval process: `docs/PRODUCT_APPROVAL_PLAYBOOK.md`
- Admin/staff: `docs/ADMIN_GUIDE.md`
- Security: `docs/SECURITY.md`
- Deployment decision: `docs/DEPLOY_GLOWNUTURE_NAMECHEAP.md`
- Current infrastructure changes and QA: `docs/INFRASTRUCTURE_CHANGELOG.md`
