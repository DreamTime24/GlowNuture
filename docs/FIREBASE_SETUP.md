# Firebase setup — বাংলা

আপনার দেওয়া glownuture-f157c project-এর public web configuration পরিবেশে সেট করুন: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID, FIREBASE_DATABASE_URL ও FIREBASE_VAPID_KEY; তারপর FIREBASE_ENABLED=true। .env.example-এ fields আছে, API key source-এ নেই। Web API key, app ID, sender ID, VAPID public key এবং reCAPTCHA site key frontend-এ থাকা স্বাভাবিক; এগুলো Admin credential নয়। Service account email বা “No keys” status দিয়ে Admin SDK চালু হয় না।

## Authentication

1. Firebase Console → Authentication → sign-in providers-এ Email/Password enable করুন। Password policy/abuse settings review করুন।
2. Google provider-এর support email ও consent configuration সম্পন্ন করুন।
3. Authentication → Settings → authorized domains-এ approved production domain এবং প্রয়োজনীয় local/test domains যোগ করুন। Exact domain/origin যাচাই করুন।
4. Email templates/action URLs দিয়ে verification/reset নিজের account-এ পরীক্ষা করুন।
5. Facebook চাইলে Meta app-এর approved app ID/secret provider settings-এ দিন এবং Firebase প্রদত্ত OAuth redirect URL Meta dashboard-এ অনুমোদন করুন। তারপর FIREBASE_FACEBOOK_ENABLED=true। Default বন্ধ।
6. https://glownuture-f157c.firebaseapp.com/__/auth/handler হলো OAuth redirect handler; customer login API endpoint নয়।

## Server Admin SDK / ADC

Production-এ approved runtime-এর workload identity/Application Default Credentials ব্যবহার করুন। Existing service account-এ প্রয়োজনীয় Firebase Auth/FCM এবং notification database operations-এর সীমিত access দিন; অকারণে project Owner role দেবেন না।

যদি আগে থেকেই অনুমোদিত credential file ব্যবহার করেন, repo-এর বাইরে private path-এ রাখুন এবং launching terminal/process-এ GOOGLE_APPLICATION_CREDENTIALS export করুন। backend/.env comment-এ path লিখলে সেটি OS environment-এ স্বয়ংক্রিয়ভাবে export হয় না। Credential JSON chat বা GitHub-এ পাঠাবেন না। এখানে নতুন service-account key তৈরি করা হয়নি।

API token signature/expiry/project/revocation যাচাই করে; client role field দিয়ে admin হয় না। First login-এর পরে exact UID দিয়ে server CLI grant-role করুন।

## Staff TOTP MFA

Firebase TOTP-এর জন্য Authentication with Identity Platform দরকার। Existing project support/plan/cost owner review করবেন; এই কাজে billing/plan upgrade করা হয়নি। Supported provider ও TOTP enable, verified staff email, enrollment ও fresh multi-factor sign-in পরীক্ষা করুন।

Account settings-এর built-in enrollment UI password-provider reauthentication করে। Google/Facebook-only staff account-এর ক্ষেত্রে supported password provider link করার owner-managed process অথবা separate audited enrollment flow লাগবে। Production-এ MFA enforcement বন্ধ করে admin চালাবেন না।

## reCAPTCHA এবং App Check

দেওয়া reCAPTCHA site key-এর type/allowed domain এই session-এ যাচাই করা যায়নি। Console-এ v2/v3 নিশ্চিত করে RECAPTCHA_MODE, RECAPTCHA_SECRET ও RECAPTCHA_SITE_KEY ঠিক করুন; শেষে RECAPTCHA_ENABLED=true। v3-এ login/checkout action ও score/hostname server যাচাই করে।

App Check আলাদা configuration: approved web provider/site key দিয়ে APP_CHECK_SITE_KEY দিন, staging-এ token flow পরীক্ষা করে APP_CHECK_ENFORCE=true করুন। সাধারণ reCAPTCHA key-কে না বুঝে App Check key হিসেবে বসাবেন না।

## FCM, RTDB, Storage

দেওয়া VAPID public key ও sender/project configuration environment-এ সেট করুন। FCM API availability, permitted runtime identity, HTTPS origin, /firebase-messaging-sw.js এবং নিজের device-এর opt-in flow পরীক্ষা করুন। Browser permission কেবল user click-এ চাওয়া হয়। Push token encrypted SQL-এ থাকে; opt-out invalidates active subscription।

Worker SQL notifications server-side RTDB notifications/{uid}-তে mirror করে। Prepared database rules কেবল সেই UID-কে নিজের projection পড়তে দেয়; client writes denied। Storage rules default সব client access deny করে; current product media upload FastAPI দিয়ে হয়।

Existing Firebase rules না পড়ে replacement deploy করবেন না। এখানে rules deploy, browser OAuth, email delivery, FCM delivery বা RTDB write live test করা হয়নি।

Official docs:

- https://firebase.google.com/docs/admin/setup
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/auth/web/facebook-login
- https://firebase.google.com/docs/auth/web/totp-mfa
- https://firebase.google.com/docs/cloud-messaging/js/client
- https://firebase.google.com/docs/app-check/web/recaptcha-provider
