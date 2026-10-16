# Local setup — বাংলা

## প্রয়োজন

Python 3.12, internet এবং extract করা project folder। Node 24 শুধু frontend test-এর জন্য। PostgreSQL production-এর জন্য; local development-এ SQLite। ZIP-এ private .env, database, installed dependencies বা service-account key নেই।

Windows: project root থেকে run-local.bat চালান। এটি Python launcher-এর py -3.12 ব্যবহার করে। অন্য Python version-এর compatibility এখানে পরীক্ষা করা হয়নি। Dependency installation ব্যর্থ হলে terminal-এর প্রথম error দেখুন; launcher migration ব্যর্থ হলে server শুরু করে না।

Linux/macOS: README-এর exact commands অনুসরণ করুন। scripts/run_local.py migration-এর পরে API, notification worker ও catalog worker একসঙ্গে চালায়। একই origin **http://127.0.0.1:8000** ব্যবহার করুন; localhost:8000 বা port 5500 মিশিয়ে ব্যবহার করলে Origin/cookie verification ব্যর্থ হবে। File Explorer থেকে index.html খুলে checkout করবেন না।

## প্রথম চালুর ফল

scripts/setup_local.py নতুন backend/.env-এ random Fernet ও HMAC keys তৈরি করে, screen-এ key দেখায় না এবং পুরোনো file overwrite করে না। এই keys হারালে encrypted customer records উদ্ধার করা যাবে না। আলাদা নিরাপদ backup রাখুন। Root .env.example ও backend/.env.example templates; application backend directory থেকে backend/.env পড়ে।

alembic upgrade head নতুন schema তৈরি করে। পুরোনো database থাকলে আগে backup ও schema review করুন। create_all, stamp head বা database delete করে পুরোনো তথ্যের migration এড়াবেন না।

Server root / storefront পরিবেশন করে। /docs development API reference, /api/health liveness, /api/ready actual database readiness, /ordinary-catalog approved BDT collection। /api/admin routes sign-in, role ও MFA ছাড়া ব্যবহার করা যায় না।

নতুন shop খালি থাকবে। Checkout বন্ধ, Facebook provider বন্ধ, catalog reference বন্ধ, reCAPTCHA/App Check enforcement বন্ধ, analytics ও journal বন্ধ। Approval ছাড়া কোনো imaginary product/order/payment দেখানো হয় না।

## Firebase login

[Firebase setup](FIREBASE_SETUP.md) করুন। আগে দেওয়া public web config-টি .env.example-এর FIREBASE_* fields-এ বসিয়ে FIREBASE_ENABLED=true করুন; source-এ API key hardcoded নেই। Admin SDK-এর ADC/workload identity-ও লাগবে। শুধু service account email বা auth handler URL দিয়ে backend authenticate করতে পারে না। Credential ছাড়া sign-in-এ স্পষ্ট unavailable message আসবে।

অ্যাকাউন্ট তৈরি/লগইন → email verify → refresh verification। প্রথম sign-in-এর পরে owner server CLI থেকে exact UID-তে role দিতে পারবেন। Staff account-এ TOTP enrol করে sign out/in করে dashboard খুলুন।

Local test auth endpoints আলাদা opt-in development aid; production-এ নিষিদ্ধ। Default visible login Firebase-ভিত্তিক। কোনো demo password বা hardcoded owner account নেই।

## Checkout খোলা

backend/.env-এ SELLER_LEGAL_NAME, SELLER_ADDRESS, SUPPORT_EMAIL, SUPPORT_PHONE সঠিকভাবে দিন। Admin থেকে terms/privacy/return/delivery policies প্রকাশ করুন, delivery charges ও applicable tax review করুন। তারপর CHECKOUT_ENABLED=true দিন ও server/worker restart করুন। COD_ENABLED আলাদা switch।

Products-এ আসল BDT price, stock, expiry ও verified তথ্য দিন। Product review-এ ছবি/rights upload, supplier evidence ও ১৪টি owner confirmation দিয়ে Verify → Publish করুন। Free Open Beauty Facts, supplier API ও file imports সব draft; source price/stock কখনও actual price/stock বদলায় না। [Approval playbook](PRODUCT_APPROVAL_PLAYBOOK.md) অনুসরণ করুন।

যে configuration বদলাবেন, API ও দুই worker restart করুন। settings process-এ cached থাকে। /api/config কেবল public flags/configuration দেখায়।

## Worker, diagnostics, backup

backend directory থেকে:

~~~bash
../.venv/bin/python -m app.worker --once
../.venv/bin/python -m app.catalog_worker --once
../.venv/bin/python -m app.manage doctor
../.venv/bin/python -m app.manage expire-reservations
../.venv/bin/python -m app.manage retry-notifications
../.venv/bin/python ../scripts/backup_database.py /absolute/private/glownuture-backup.db
~~~

Windows-এ interpreter path হবে ..\.venv\Scripts\python.exe। Live worker-এর জন্য --once বাদ দিন। Unconfigured email/push jobs provider setup-এর আগে sent দেখাবে না। Backup local file তৈরি করে; automatic offsite backup schedule তৈরি করে না।
