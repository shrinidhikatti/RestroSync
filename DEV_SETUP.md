# RestroSync — Local Dev Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| Docker Desktop | latest | https://docker.com |
| Flutter SDK | 3.27+ | https://flutter.dev |
| Git | any | https://git-scm.com |

---

## 1. Start Infrastructure (PostgreSQL + Redis)

```bash
# From project root
docker compose up -d
```

Check containers are running:
```bash
docker ps
```

Stop containers:
```bash
docker compose down
```

---

## 2. Backend (NestJS — port 3000)

### First-time setup
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed          # seeds Super Admin + demo data
```

### Run dev server
```bash
cd backend
npm run start:dev
```

- API base URL: `http://localhost:3000/api/v1`
- Swagger docs: `http://localhost:3000/api/docs`
- Health check: `http://localhost:3000/api/v1/health`

### Other useful backend commands
```bash
npm run test               # run unit tests
npm run test:cov           # test with coverage
npm run prisma:studio      # open Prisma Studio (DB GUI) at localhost:5555
npm run prisma:migrate     # create + apply a new migration
npm run build              # production build → dist/
```

### Backend `.env` (already configured for local dev)
```
DATABASE_URL="postgresql://restrosync:restrosync_dev@localhost:5433/restrosync?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev-secret-change-in-production
PORT=3000
NODE_ENV=development
```

---

## 3. Frontend (React — port 5173)

### First-time setup
```bash
cd frontend
npm install
```

### Run dev server
```bash
cd frontend
npm run dev
```

- URL: `http://localhost:5173`
- Login with Super Admin: `admin@restrosync.com` / `Admin@123`

### Other frontend commands
```bash
npm run build              # production build → dist/
npm run preview            # preview production build locally
npx tsc --noEmit           # TypeScript type check
```

### Frontend `.env` (create if needed)
```bash
# frontend/.env
VITE_API_URL=http://localhost:3000
```
> Note: defaults to `http://localhost:3000` if not set.

---

## 4. Flutter Mobile App (APK)

### First-time setup
```bash
cd mobile
flutter pub get
```

### Run on emulator / connected device
```bash
cd mobile
flutter run
```

### Build debug APK
```bash
cd mobile
flutter build apk --debug
```
APK output: `mobile/build/app/outputs/flutter-apk/app-debug.apk`

### Build release APK
```bash
cd mobile
flutter build apk --release
```
APK output: `mobile/build/app/outputs/flutter-apk/app-release.apk`

### Other Flutter commands
```bash
flutter devices            # list connected devices/emulators
flutter doctor             # check Flutter setup
flutter clean              # clean build cache
flutter pub upgrade        # upgrade dependencies
```

> The mobile app points to `http://10.0.2.2:3000` (Android emulator localhost alias).
> For a physical device, update the API base URL in `mobile/lib/core/constants/api_constants.dart` to your machine's local IP (e.g. `http://192.168.x.x:3000`).

---

## 5. Full Local Stack — Quick Start (all at once)

Open 3 terminal tabs and run:

```bash
# Tab 1 — Infrastructure
docker compose up -d

# Tab 2 — Backend
cd backend && npm run start:dev

# Tab 3 — Frontend
cd frontend && npm run dev
```

---

## 6. Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@restrosync.com | Admin@123 |
| Demo Owner | owner@demo.com | Owner@123 |

---

## 7. Ports Reference

| Service | Port | Open in browser? |
|---------|------|-----------------|
| Frontend (React) | 5173 | ✅ Yes — `http://localhost:5173` |
| Backend API | 3000 | ✅ Docs only — `http://localhost:3000/api/docs` |
| Backend Health | 3000 | ✅ Check — `http://localhost:3000/api/v1/health` |
| PostgreSQL | 5433 (Docker) | ❌ No — database port, not a web server |
| Redis | 6379 | ❌ No — cache port, not a web server |
| Prisma Studio | 5555 | ✅ Yes — `http://localhost:5555` (run `npm run prisma:studio`) |

> `localhost:5433` and `localhost:6379` will always show `ERR_EMPTY_RESPONSE` in a browser — that is normal. They are TCP services, not HTTP servers.

---

## 8. Reset Database (fresh start)

```bash
cd backend
npx prisma migrate reset   # drops DB, re-applies all migrations, re-seeds
```
