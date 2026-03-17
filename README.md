# GearItUp — AutoSpace

> B2B2C SaaS platform for India's auto parts retail market.
> Shop owners get a full ERP/POS. Customers browse parts with fitment guarantees and hyperlocal delivery.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL (Supabase) |
| Auth | Firebase (Phone OTP + Google) + JWT sessions |
| Email | Resend |
| ORM | Prisma |

---

## For Team Collaborators (Recommended)

If you're a contributor working with the project owner, ask them to send you two files privately (WhatsApp / Telegram):

- `backend/.env`
- `.env`

Then:

```bash
# 1. Clone
git clone https://github.com/shivakumar-07/GearItUp_Exp.git
cd GearItUp_Exp

# 2. Paste the .env files the project owner sent you
#    → .env          (in root)
#    → backend/.env  (in backend/)

# 3. Install dependencies
npm install
cd backend && npm install && cd ..

# 4. Start
cd backend && npm run dev    # backend → http://localhost:3001
# (new terminal)
npm run dev                  # frontend → http://localhost:5173
```

Done — you're on the same database, same auth, same email setup as the project owner.

---

## Fresh Setup (New Instance / Deployment)

Only needed if you're deploying your own copy or starting from scratch.

### Services to create (all have free tiers)

| Service | Purpose | Link |
|---------|---------|------|
| Supabase | PostgreSQL database | [supabase.com](https://supabase.com) |
| Firebase | Phone OTP + Google login | [console.firebase.google.com](https://console.firebase.google.com) |
| Resend | Transactional email | [resend.com](https://resend.com) |

### Frontend env

```bash
cp .env.example .env
```

Fill in your Firebase Web App config from Firebase Console → Project Settings → Your Apps.

### Backend env

```bash
cp backend/.env.example backend/.env
```

Fill in:
- `DATABASE_URL` — from Supabase → Settings → Database → URI
- `JWT_SECRET` + `JWT_REFRESH_SECRET` — any two random strings (run `openssl rand -hex 32`)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — from Firebase Service Account JSON
- `RESEND_API_KEY` + `RESEND_SENDER_EMAIL` — from Resend dashboard

### Push DB schema

```bash
cd backend
DATABASE_URL="your-supabase-url" npm run db:push
```

---

## Project Structure

```
├── src/                        # React frontend
│   ├── pages/
│   │   ├── LoginPage.jsx       # 4-step auth flow (email / phone / Google)
│   │   ├── ProfilePage.jsx
│   │   ├── SettingsPage.jsx
│   │   └── ResetPasswordPage.jsx
│   ├── components/
│   ├── marketplace/            # B2C storefront
│   ├── store.js                # Global React context + state
│   └── App.jsx                 # Routing + ERP/Marketplace mode switching
│
├── backend/
│   ├── prisma/schema.prisma    # Full DB schema
│   └── src/
│       ├── routes/auth/        # Modular auth routes
│       │   ├── email.js        # Email + password signup/login
│       │   ├── firebase.js     # Google + Firebase phone auth
│       │   ├── password.js     # Forgot / reset password
│       │   ├── session.js      # Refresh token rotation + logout
│       │   ├── profile.js      # Profile, settings, sessions, account delete
│       │   └── providers.js    # Link / unlink OAuth providers
│       └── services/
│           ├── email.js        # Resend transactional emails
│           ├── firebase.js     # Firebase Admin SDK token verification
│           ├── otp.js          # Phone OTP (MSG91 in prod, console log in dev)
│           └── password.js     # bcrypt hashing + strength validation
│
├── .env.example                # Frontend env template
├── backend/.env.example        # Backend env template
└── README.md
```

---

## Auth Flows

| Method | Flow |
|--------|------|
| Email + Password | Register → OTP email via Resend → verify → login |
| Phone OTP | Enter phone → Firebase SMS → verify code |
| Google | One-click OAuth → auto profile creation |
| Forgot Password | Email → reset link via Resend → set new password |

---

## API Reference

All auth routes: `POST/GET/PATCH/DELETE /api/auth/*`

```
POST   /register              Email signup (sends OTP email)
POST   /login                 Email + password login
POST   /firebase              Exchange Firebase token → JWT
POST   /verify-email          Verify email OTP code
POST   /forgot-password       Send password reset email
POST   /reset-password        Set new password via token
POST   /refresh               Rotate refresh token
POST   /logout                Revoke current session
GET    /me                    Get full profile
PATCH  /me                    Update name / email
DELETE /me                    Delete account (soft)
PUT    /me/profile            Update gender / DOB / addresses
GET    /me/settings           Get notification settings
PUT    /me/settings           Update settings
PATCH  /me/shop               Update shop details
POST   /register-shop         Create shop (shop owners)
POST   /change-password       Change password
POST   /logout-all            Revoke all sessions (all devices)
GET    /me/sessions           List active sessions
DELETE /me/sessions/:id       Revoke a specific session
```

---

## Dev Notes

- **Phone OTP in dev**: `NODE_ENV=development` → OTP logged to console, no SMS sent
- **Firebase bypass in dev**: if Firebase Admin keys not set, use `dev:9876543210` as token for phone or `dev-google:you@example.com` for Google
- **DB schema changes**: edit `prisma/schema.prisma` → run `npm run db:push` from `backend/`
- **No test framework** configured — manual testing via UI
