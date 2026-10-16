# Admin guide — বাংলা

## প্রথম owner access

আগে Firebase Console-এ যাচাই করা account দিয়ে storefront-এ sign in করুন। Server-এ backend directory থেকে exact Firebase UID ব্যবহার করুন:

~~~bash
../.venv/bin/python -m app.manage grant-role --firebase-uid REPLACE_WITH_VERIFIED_UID --role super_admin --confirm
~~~

User আগে SQL-এ তৈরি না হলে command ব্যর্থ হবে। নতুন account default customer। Role grant-এর পরে পুরোনো sessions revoke হয়; আবার sign in করতে হবে। Account settings থেকে TOTP enroll করে multi-factor sign-in করুন। তারপর /#/admin খুলুন। Browser storage edit করে staff access পাওয়া যায় না।

## Permissions

| Role | Access |
| --- | --- |
| super_admin | Dashboard, inventory, orders, support, accounting, marketing, staff/audit |
| admin | সব operational module; staff/audit privilege assignment নয় |
| operations_manager | Dashboard, orders/courier/returns |
| inventory_manager | Dashboard, products/imports/purchases/batches |
| customer_support | Dashboard, read-only support order details, customers, review moderation |
| customer | নিজের profile/orders/lists; admin নয় |

Staff user identity/status change-এ exact account যাচাই ও explicit form confirmation লাগে; নিজেকে staff page থেকে promote/demote করা যায় না। Server CLI authorised owner recovery path।

## পণ্য ও stock

Products → Create draft → SKU/slug, actual BDT price/cost/stock, ingredients/usage/warnings/expiry → Product review-এ private image upload/rights ও supplier evidence → Submit → owner/delegated-admin Verify → পৃথক Publish। কোনো publish checkbox নেই। Material edit revision বাড়ায় এবং approval বাতিল করে। [Approval playbook](PRODUCT_APPROVAL_PLAYBOOK.md) দেখুন। Archive করলে order history থাকে। Image upload accepts bounded JPEG/PNG/WebP, re-encodes WebP and removes metadata; SVG upload rejects।

Variants-এ actual SKU/size/price/stock দিন। Import প্রথমে draft; বাইরের source price local selling price নয়। Suppliers → purchase with unique reference → quantity/unit cost/batch/expiry → physically inspect → Receive। Receive পুনরায় চাপলে stock দ্বিগুণ হয় না। Expired/quarantined stock checkout-এ বিক্রি হয় না।

Catalog sources-এ owner-authorized supplier/file/free Open Beauty Facts sources ও actual job progress দেখুন। Free read API-তে key লাগে না। কোনো source financial/inventory field বদলায় না; image candidates permission/match যাচাই ছাড়া copy/publish হয় না। Approved/local edits survive re-import। Operations health-এ দুই worker heartbeat, failed jobs ও media issues দেখা যায়। Inventory movements ও audit review করুন।

## অর্ডার

Order details/receipt, actual courier record, permitted stage changes, reasoned failed-delivery/returns এবং delivered COD settlement ব্যবহার করুন। Stock manually adjusting করার আগে reserved orders/batches reconcile করুন। Product stock field হলো unreserved count; batch allocations সংশ্লিষ্ট purchase-line cost নেয়; unbatched units configured acquisition cost নেয়। Historical order snapshots পরে product cost বদলালে বদলায় না।

Refund form হলো actual external refund-এর reconciliation record। Record করার আগে approved channel-এ refund সম্পন্ন করুন। Reference না বানিয়ে provider/courier/bank evidence রাখুন।

## Content, customers, reports

Content module-এ policy keys terms, privacy, return, delivery এবং প্রয়োজনে about ব্যবহার করুন। FAQ/banner/category/brand plain text records publish করা যায়। Unapproved policy-তে readiness copy দেখায়; owner legal terms বানানো নেই।

Customer profiles/support records privileged route-এ; customer_support order access read-only। Review কেবল delivered purchase-এর account দিতে পারে, moderation ছাড়া public নয়।

Reports sale/shipping/tax/cost/refund/fees/expenses আলাদা করে। Missing acquisition cost বা missing payment fee থাকলে profit incomplete থাকে। CSV export সূত্র-ইনজেকশন প্রতিরোধ করে। PDF হলো private order receipt; full financial PDF/chart module এখন নেই।

Settings কেবল connection/status flags দেখায়; private credentials editing/public display করে না। Configuration environment-এ বদলে API/worker restart করুন। Audit log privilege/sensitive changes records করে, immutable external audit storage নয়।
