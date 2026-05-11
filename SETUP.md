# FCF ERP — Setup Instructions

## ধাপ ১: PowerShell খুলুন এবং প্রজেক্ট ফোল্ডারে যান

```powershell
cd "d:\Claude Code\FCF ERP"
```

## ধাপ ২: Dependencies Install করুন

```powershell
npm install
```

(প্রায় ২-৩ মিনিট লাগবে)

## ধাপ ৩: Development Server চালু করুন

```powershell
npm run dev
```

## ধাপ ৪: Browser এ খুলুন

http://localhost:3000

---

## Supabase Setup (যদি এখনো না হয়)

Supabase এ `profiles` table এ একটি admin user তৈরি করুন:

1. Supabase Dashboard > Authentication > Users > Create User
2. Email: admin@fcf.com, Password: আপনার পছন্দ মতো
3. তারপর `profiles` table এ insert করুন:

```sql
INSERT INTO profiles (id, email, full_name, role, is_active)
VALUES (
  'auth-user-id-here',  -- Authentication থেকে কপি করুন
  'admin@fcf.com',
  'FCF Admin',
  'admin',
  true
);
```
