# THE BRIDGE - Mission Control v2.0

🚀 **DEPLOYMENT READY** - 2026-03-04

## Dashboard: dashboard.projectgalaxyai.com

This app is intended to run at **https://dashboard.projectgalaxyai.com**, behind Auth0 (Okta). Repo: [github.com/projectgalaxyai/mission_control](https://github.com/projectgalaxyai/mission_control).

### 1. Auth0 (Okta) setup

1. In [Auth0 Dashboard](https://manage.auth0.com) → Applications → Create Application → **Regular Web Application**.
2. Settings:
   - **Allowed Callback URLs**:  
     `https://dashboard.projectgalaxyai.com/auth/callback`  
     (local: `http://localhost:3000/auth/callback`)
   - **Allowed Logout URLs**:  
     `https://dashboard.projectgalaxyai.com`  
     (local: `http://localhost:3000`)
3. Copy **Domain**, **Client ID**, **Client Secret**.

### 2. Environment variables

Copy `.env.example` to `.env.local` (see repo root). (local) or set in Vercel:

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Auth0 tenant domain (e.g. `your-tenant.us.auth0.com`) |
| `AUTH0_CLIENT_ID` | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | Auth0 application client secret |
| `AUTH0_SECRET` | 32-byte hex (run `openssl rand -hex 32`) |
| `APP_BASE_URL` | Production: `https://dashboard.projectgalaxyai.com` (optional; SDK can infer on Vercel) |
| `NEXT_PUBLIC_WS_URL` | Optional: Mission Control WebSocket URL if using separate server |

### 3. Vercel deploy

1. Import repo: [github.com/projectgalaxyai/mission_control](https://github.com/projectgalaxyai/mission_control).
2. **Root Directory**: leave default.
3. **Framework**: Next.js (auto-detected).
4. **Environment Variables**: add all `AUTH0_*` and `APP_BASE_URL` (and `NEXT_PUBLIC_WS_URL` if needed).
5. **Domains**: add `dashboard.projectgalaxyai.com` and point it to this project.

Build command: `npm run build` (default). No need to run the WebSocket server on Vercel unless you host it separately.

### 4. Local quick start

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# Edit .env.local with your Auth0 values and APP_BASE_URL=http://localhost:3000

# Terminal 1 - WebSocket server (optional for full Bridge features)
npm run server

# Terminal 2 - Next.js (auth + UI)
npm run dev
```

Open http://localhost:3000 → redirects to Auth0 login → then dashboard.

## Endpoints

- **Production**: https://dashboard.projectgalaxyai.com (Auth0-protected)
- **Local**: http://localhost:3000 (Auth0 login)
- **WebSocket** (if used): ws://localhost:3001/ws or your `NEXT_PUBLIC_WS_URL`

## Features

✅ Auth0 (Okta) login – dashboard behind auth  
✅ Draggable agent chat windows  
✅ Real-time WebSocket messaging  
✅ Group broadcast channel  
✅ Agent presence/heartbeat  
✅ Dark futuristic UI (cyberpunk aesthetic)

## Architecture

- Next.js 15 + React 19 + TypeScript
- Auth0 Next.js SDK (v4) – middleware + Auth0Client
- Express + WebSocket (ws) backend (optional; for agent list/messaging)
- Context-based state management
