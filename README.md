# BD Task Hub

এটি একটি **স্বচ্ছ task/reward platform-এর frontend starter**। আপনার দেওয়া স্ক্রিনশটের ধারণা অনুসরণ করে Dashboard, Tasks, Referral এবং Withdraw UI রাখা হয়েছে।

## গুরুত্বপূর্ণ
GitHub Pages/শুধু HTML দিয়ে বাস্তব টাকা, নিরাপদ login, database বা withdrawal processing করা যায় না। এই প্যাকেজে `localStorage` শুধু demo-এর জন্য ব্যবহার করা হয়েছে।

বাস্তব ও বৈধ production service চালাতে প্রয়োজন:
- HTTPS ও server-side authentication
- Database
- Admin panel ও audit logs
- Server-side task verification
- স্পষ্ট Terms of Service, Privacy Policy ও Refund/Payment policy
- বৈধ business/payment setup এবং প্রযোজ্য আইন মেনে চলা
- ব্যবহারকারীর টাকা/পেমেন্ট তথ্য নিরাপদে সংরক্ষণ ও প্রক্রিয়াকরণ
- বাস্তব payment gateway বা bank integration

## GitHub Pages-এ demo চালানো
1. GitHub-এ একটি repository তৈরি করুন।
2. এই ZIP-এর ভেতরের `index.html`, `style.css`, `app.js` upload করুন।
3. Settings → Pages → Deploy from branch নির্বাচন করুন।
4. Branch হিসেবে `main` এবং folder `/root` নির্বাচন করে Save করুন।
5. কিছুক্ষণ পর GitHub Pages URL পাওয়া যাবে।

## বাস্তব সাইটে যা করবেন না
- ভুয়া earnings/balance দেখাবেন না।
- withdrawal নিশ্চিত না হয়েও "guaranteed payment" লিখবেন না।
- সদস্যকে টাকা জমা দিতে বাধ্য করে রিওয়ার্ড দেওয়ার প্রতিশ্রুতি দেবেন না।
- অন্যের bKash/Nagad/Bank তথ্য ব্যবহার করতে বলবেন না।
- task completion যাচাই না করে balance credit করবেন না।
