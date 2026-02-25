import { chromium } from '@playwright/test';

const BACKEND_HEALTH  = 'https://restrosync-backend.onrender.com/api/v1/health';
const BACKEND_LOGIN   = 'https://restrosync-backend.onrender.com/api/v1/auth/login';
const FRONTEND_URL    = 'https://restrosync-frontend.onrender.com';
const MAX_WAIT_MS     = 120_000;
const POLL_INTERVAL   = 5_000;

// Warm-up user — just to prime the DB connection; won't count against production throttle
// because we only try once (or a few times) here.
const WARMUP_EMAIL    = 'kitchen@counter.demo';
const WARMUP_PASSWORD = 'Demo@1234';

async function waitForBackend(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const res = await fetch(BACKEND_HEALTH, { signal: AbortSignal.timeout(15_000) });
      if (res.ok || res.status < 500) {
        console.log(`  ✅ Backend health OK (attempt ${attempt})`);
        return;
      }
      console.log(`  ⏳ Backend not ready (attempt ${attempt}, status ${res.status})…`);
    } catch {
      console.log(`  ⏳ Backend unreachable (attempt ${attempt})…`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`Backend did not become ready within ${MAX_WAIT_MS / 1000}s`);
}

async function warmAuthAndDb(): Promise<void> {
  // Make a real login request to warm up the DB connection pool + bcrypt.
  // If it fails (wrong creds, etc.) that's fine — we just want the DB to wake up.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BACKEND_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: WARMUP_EMAIL, password: WARMUP_PASSWORD }),
        signal: AbortSignal.timeout(30_000),
      });
      // Any response (including 401/429) means the DB pipeline is ready
      if (res.status < 500) {
        console.log(`  ✅ Auth+DB warmed (status ${res.status})`);
        return;
      }
      console.log(`  ⏳ Auth endpoint returned ${res.status}, retrying…`);
    } catch {
      console.log('  ⏳ Auth endpoint not yet ready, retrying…');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  console.log('  ⚠️  Auth warmup timed out — continuing anyway');
}

async function waitForFrontend(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(FRONTEND_URL, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        console.log('  ✅ Frontend reachable');
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 3_000));
  }
  console.log('  ⚠️  Frontend warmup timed out — continuing anyway');
}

export default async function globalSetup() {
  console.log('\n🔄 Warming up Render services…');
  await waitForFrontend();
  await waitForBackend();
  await warmAuthAndDb();
  console.log('🚀 All services ready — starting tests\n');
}
