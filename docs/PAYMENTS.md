# Payments and refunds — বাংলা

## কোন পদ্ধতি আছে

COD আলাদা enable flag-এ আছে। Online checkout **SSLCommerz hosted payment page** ব্যবহার করে; application কার্ড নম্বর, PIN বা CVV নেয় না। bKash/Nagad/card channel merchant-এর approved gateway account-এ available হলে hosted page-এ থাকবে। আলাদা direct bKash/Nagad API adapter যোগ করা হয়নি।

Debit card number settlement account configuration নয়। টাকা কোন bank/merchant account-এ জমা হবে তা approved gateway merchant agreement ও bank verification দিয়ে ঠিক করতে হবে। কোনো card data source-এ রাখা হয়নি।

## Sandbox আগে

SSLCOMMERZ_STORE_ID ও SSLCOMMERZ_STORE_PASSWORD server secret হিসেবে দিন। SSLCOMMERZ_LIVE=false রাখুন। Seller/contact, published policies, origin ও checkout configuration আগে ঠিক করুন।

Hosted session তৈরি হয় POST /api/payments/{order_id}/initiate-এ; order ID ও private tracking token লাগে। Callback endpoints:

- POST /api/payments/ipn
- POST /api/payments/return

Public HTTPS callback origin ও provider dashboard configuration মালিককে যাচাই করতে হবে। Return redirect-এর screenshot বা browser success message payment proof নয়।

Server signed callback-এর fields যাচাই করে, merchant validation API দিয়ে transaction ID, amount, currency, validation/bank reference ও risk level মিলিয়ে দেখে। Valid duplicate আবার stock বা ledger বদলায় না। Unpaid failure/cancellation server-verified হলে stock ফেরে। Expired/cancelled order-এর late capture automatic fulfillment করে না; payment review লাগে।

একবার initiation request পাঠানোর পরে timeout হলে পুনরায় নতুন session বানানো হয় না। Provider dashboard ও order/payment record দেখে staff reconciliation করবে; প্রয়োজনে verified refund ও নতুন order। কোনো mock success production response হিসেবে নেই।

## Live activation

Approved merchant credentials, sandbox success/fail/cancel/IPN/duplicate/amount mismatch tests, real small payment, settlement reconciliation ও refund acceptance-এর পরে owner SSLCOMMERZ_LIVE=true এবং SSLCOMMERZ_LIVE_VERIFIED=true দেবেন। দ্বিতীয় flag ছাড়া live configuration startup reject হয়। এই কাজ এখানে সম্পন্ন হয়নি।

## Refund

Return request → staff decision → actual received-goods inspection → correct restock/status decision। Refund আলাদা financial step; return approval নিজে টাকা ফেরত দেয় না।

Accounting permission-সহ staff refund request record করে। Gateway/bank/COD-এর authorised process-এ **বাস্তবে টাকা ফেরত দেওয়ার পরে** exact amount, unique provider reference ও operator confirmation দিয়ে record করে। এই route টাকা transfer বা gateway refund initiate করে না।

Requested এবং refunded sums order total ছাড়াতে পারে না। Verified record idempotent; payment state partially_refunded/refunded হয়। Ledger refund cash entry আলাদা, recognized sales/delivery/tax reductions আলাদা; each paisa reconciles. Delivered return-এ inspected restock দিলে cost reversal হয়। Product cost/processing fees incomplete হলে profit report amount অনুমান করে না।

এটি operational ledger/report, পূর্ণ double-entry accounting বা statutory tax filing system নয়। হিসাব ও ব্যবসার প্রযোজ্য tax/refund policy owner-এর accountant দিয়ে review করুন।

Official integration reference: https://developer.sslcommerz.com/doc/v4/
