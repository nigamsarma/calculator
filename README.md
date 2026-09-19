# Scientific Calculator PWA with Hidden E2EE 1-to-1 Chat

A real, fully working Progressive Web App (PWA) scientific calculator that conceals a private, zero-knowledge end-to-end encrypted (E2EE) 1-to-1 chat, unlocked by a hidden gesture. Designed for consenting adults, device-agnostic across Android Chrome, iOS Safari ("Add to Home Screen"), and Desktop.

---

## Features

### 1. Flawless Calculator Disguise
- Installed name "Calculator", short name "Calc", dark calculator theme.
- Header title "Scientific Calculator" and `noindex, nofollow` metadata.
- Full scientific functions: `+`, `−`, `×`, `÷`, `%`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `log`, `ln`, `√`, `x²`, `xʸ`, `n!`, `π`, `e`, memory (`M+`, `M-`, `MR`, `MC`), `DEG`/`RAD` toggle, visual calculation history.
- Tested math engine powered by Shunting-Yard algorithm & AST evaluator.

### 2. Hidden Unlock System
- Double-tap the "Scientific Calculator" header title within 500 ms to arm unlock mode.
- Enter your numeric passcode PIN on the keypad and press `=`.
- A correct PIN unlocks the private encrypted chat.
- An incorrect PIN or pressing `=` without arming executes normal mathematical calculations with zero hint or visual clue.
- First-time arming prompts for a 6+ digit PIN setup (stored as a PBKDF2-HMAC-SHA256 hash). Escalating lockout delays on failed attempts (1s, 2s, 4s, 8s, 16s...).

### 3. Safety & Stealth Mechanics
- **Panic Exit**: Rapid device shake gesture (> 22 m/s²) or top-left triple-tap corner gesture instantly locks the app and reverts DOM state to the calculator.
- **Auto-Lock**: Listens for tab switch, device lock, or background blur events to auto-lock immediately and cover the screen in the mobile app switcher.
- **Emergency Wipe**: Settings button to permanently wipe all local IndexedDB messages, stored keys, and PIN hashes.

### 4. End-to-End Cryptography (Web Crypto API)
- Local ECDH P-256 keypair generation on device.
- HKDF-SHA256 shared secret derivation to establish 256-bit AES-GCM session keys.
- Random 12-byte IV for every message payload. Server / Worker sees only encrypted ciphertext.
- Short 6-digit numeric "Safety Code" derived for in-person visual peer verification.

### 5. Messaging Capabilities
- Text messaging, client-side compressed image sharing (canvas compressed to max 800px / JPEG 0.7 before encryption).
- Delivery (`✓`) and read (`✓✓`) status ticks.
- Real-time typing indicators.
- Remote message deletion ("Delete for both").
- Disappearing message timers (Off, 1 hour, 1 day, 1 week).

### 6. Disguised Push Notifications (VAPID)
- Worker sends Web Push payload containing ZERO sensitive message details when app is closed.
- Service Worker displays generic notification (e.g. Title "Calculator", body randomly chosen from configurable list: *"Unit conversion rates updated"*, *"New calculator tip available"*, *"Calculator update ready"*).
- Notification options: `silent: true`, `vibrate: []`, `badge: undefined`, auto-closes after 8 seconds. Tapping notification opens root calculator (`/`) so PIN gate applies.

### 7. Google Drive Encrypted Cloud Backup
- Saves backup file to Google Drive `appDataFolder` (hidden from standard Drive UI).
- Client-side passphrase encryption using PBKDF2 (600,000 iterations, SHA-256) + AES-256-GCM.

---

## Technical Stack

- **Frontend**: Vite + TypeScript, Vanilla CSS (sleek dark mode), Web Crypto API, IndexedDB, Service Worker PWA.
- **Backend**: Cloudflare Worker + Durable Objects (SQLite-backed) for WebSocket relay and VAPID push notifications.
- **Hosting & CI/CD**: Cloudflare Pages (Frontend) + Cloudflare Worker (Backend) with GitHub Actions workflow.

---

## Quick Setup & Deployment Guide

### Prerequisites
- Node.js v20+ & npm
- Cloudflare Account (Pages + Workers with Durable Objects enabled)
- Google Cloud Console Project (with Google Identity Services & Google Drive API enabled)

### Step 1: Clone & Run Local Development
```bash
# Clone repository
git clone https://github.com/nigamsarma/calculator.git
cd calculator

# Run unit tests natively
node --test src/math/parser.test.ts
node --test src/crypto/crypto.test.ts
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in root, and `backend/.dev.vars.example` to `backend/.dev.vars`:
```bash
# Frontend .env
VITE_BACKEND_URL="http://localhost:8787"
VITE_GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"

# Backend .dev.vars
JWT_SECRET="your-super-secret-jwt-signing-key-minimum-32-chars"
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
ALLOWED_ORIGINS="http://localhost:5173,https://calculator.pages.dev"
VAPID_PUBLIC_KEY="YOUR_VAPID_PUBLIC_KEY"
VAPID_PRIVATE_KEY="YOUR_VAPID_PRIVATE_KEY"
VAPID_SUBJECT="mailto:admin@calculator-app.com"
```

### Step 3: Deploy to Cloudflare
1. **Deploy Cloudflare Worker Backend**:
   ```bash
   cd backend
   npx wrangler deploy
   ```
2. **Deploy Cloudflare Pages Frontend**:
   Set up repository secrets in GitHub (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_BACKEND_URL`, `VITE_GOOGLE_CLIENT_ID`) and push to `main` branch.

---

## Known Limitations & Considerations
- **iOS Safari PWA Push Requirement**: Apple Web Push requires users on iPhone to tap "Add to Home Screen" for push notifications to function.
- **Chrome Notification Visibility**: Chrome enforces that every received push event displays a visible notification; hence the generic calculator updates disguise is used.
