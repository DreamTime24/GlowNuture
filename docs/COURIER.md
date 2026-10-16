# Courier and delivery — বাংলা

এখানে **manual courier workflow** আছে। Pathao/Steadfast/RedX API দিয়ে live parcel booking বা tracking-webhook integration নেই। UI সেই সীমাটি স্পষ্ট করে।

1. Store-এর order ও verified online payment/COD status যাচাই করুন।
2. আপনার approved courier portal/account-এ parcel সত্যিই book করুন।
3. Admin order থেকে Courier record খুলে বাস্তব courier name, tracking/reference ও actual delivery cost লিখুন।
4. সঠিক সময়ে order stages আপডেট করুন: pending → confirmed → processing → packed → shipped → delivered।
5. Shipment record ছাড়া shipped করা যায় না। Online payment verified না হলে fulfillment বন্ধ থাকে।
6. Failed delivery-তে reason দিন; retry shipment অথবা returned করুন। Returned পণ্য নিজে হাতে পরিদর্শন করে restock decision দিন।
7. Delivered COD order-এ courier/bank থেকে প্রকৃত টাকা পাওয়া গেলে exact collected amount ও settlement reference record করুন। শুধু delivered হলেই bank settlement ধরে নেওয়া হয় না।

Customer private tracking page SQL-এর staff-recorded events দেখায়। এটি courier-এর live location বা independent tracking feed দাবি করে না।

Charges .env-এর SHIPPING_DHAKA, SHIPPING_OUTSIDE, FREE_SHIPPING_THRESHOLD দিয়ে server calculate করে। Coverage, time window ও return-to-origin cost owner-এর courier agreement অনুযায়ী published delivery policy-তে দিতে হবে। Homepage-এ বানানো delivery-day promise রাখা হয়নি।

Live integration করতে courier merchant credentials, contract, authenticated webhook signature/specification, duplicate-event strategy, staging sandbox এবং booked parcel/failed-delivery/COD settlement acceptance লাগবে। এগুলো ছাড়া “connected” বলা হবে না।
