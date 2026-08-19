const { getDbClient } = require('./config/db');

async function test() {
  console.log('Testing Founder KPI Dashboard aggregation API...');
  
  // 1. Authenticate
  const loginRes = await fetch('http://localhost:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '$uperadmin@futrix.com', password: '$anjana@123man' })
  });

  if (!loginRes.ok) {
    throw new Error('Admin login failed: ' + await loginRes.text());
  }

  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Login successful. Token:', token.substring(0, 15) + '...');

  // 2. Insert mock login session
  const db = getDbClient();
  await db.connect();
  
  const mockUserUuid = '2ae57959-6e7f-4be2-a58d-9db9a01816df';
  await db.query('INSERT INTO public.session_logs (user_id) VALUES ($1)', [mockUserUuid]);
  console.log('Mock session log inserted.');

  // 3. Fetch Founder KPIs
  const kpiRes = await fetch('http://localhost:8000/api/superadmin/kpis', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!kpiRes.ok) {
    throw new Error('Failed to fetch superadmin KPIs: ' + await kpiRes.text());
  }

  const kpis = await kpiRes.json();
  console.log('Founder KPI metrics returned successfully:');
  console.log(JSON.stringify(kpis, null, 2));

  // Assert expected keys
  const expectedKeys = ['dau', 'mau', 'dauMauRatio', 'activeSubscribers', 'projectedMrr', 'costUsd', 'costInr', 'questionPoolSize', 'seriesCount'];
  expectedKeys.forEach(k => {
    if (kpis[k] === undefined) {
      throw new Error(`Assertion failed: expected KPI key '${k}' is missing.`);
    }
  });

  console.log('[✓] KPI Dashboard verification check passed successfully!');
  await db.end();
}

test().catch(err => {
  console.error('[FAILED] Verification check error:', err);
  process.exit(1);
});
