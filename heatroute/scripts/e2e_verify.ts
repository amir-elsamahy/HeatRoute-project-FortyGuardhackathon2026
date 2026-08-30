import http from 'http';
import serverlessApp from '../api/index';

async function main() {
  console.log('🚀 Starting test server from api/index.ts...');
  const server = http.createServer(serverlessApp);
  
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`📡 Server listening on ${baseUrl}`);

  try {
    // 1. Health Check
    console.log('\n--- 1. Testing GET /api/health ---');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    console.log(`Status: ${healthRes.status}`, healthData);
    if (healthRes.status !== 200) throw new Error('Health check failed');

    // 2. Geocode Check
    console.log('\n--- 2. Testing GET /api/geocode?q=Mobile ---');
    const geocodeRes = await fetch(`${baseUrl}/api/geocode?q=Mobile`);
    const geocodeData = await geocodeRes.json();
    console.log(`Status: ${geocodeRes.status}, Results count: ${geocodeData.length}`);
    if (geocodeRes.status !== 200 || geocodeData.length === 0) throw new Error('Geocode check failed');

    // 3. Multi-Route Real FortyGuard Analysis: Mobile -> Spring Hill
    console.log('\n--- 3. Testing POST /api/analyze (Mobile -> Spring Hill) ---');
    const mobileStart = { lat: 30.6954, lng: -88.0399 };
    const springHillDest = { lat: 30.6944, lng: -88.1367 };
    const startMs = Date.now();

    const multiRes = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: mobileStart,
        destination: springHillDest,
      }),
    });
    const multiData = await multiRes.json();
    console.log(`Status: ${multiRes.status}, Elapsed: ${Date.now() - startMs}ms`);
    if (multiRes.status !== 200) {
      console.error('Multi-route analysis failed:', multiData);
      throw new Error(`Multi-route analysis failed with status ${multiRes.status}`);
    }
    console.log(`Candidate Routes: ${multiData.routes?.length}`);
    console.log(`Comparison Available: ${multiData.recommendation?.comparisonAvailable}`);
    console.log(`Recommendation: ${multiData.recommendation?.routeName} - ${multiData.recommendation?.summary}`);
    multiData.routes.forEach((r: any) => {
      console.log(`  - [${r.name}] Avg Temp: ${r.avgTemperatureCelsius}°C, Max Temp: ${r.maxTemperatureCelsius}°C, Heat Score: ${r.heatScore}`);
    });

    // 4. Single-Route Real FortyGuard Analysis: Birmingham -> Homewood
    console.log('\n--- 4. Testing POST /api/analyze (Birmingham -> Homewood) ---');
    const bhamStart = { lat: 33.5186, lng: -86.8104 };
    const homewoodDest = { lat: 33.4798, lng: -86.8000 };
    const startMs2 = Date.now();

    const singleRes = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: bhamStart,
        destination: homewoodDest,
      }),
    });
    const singleData = await singleRes.json();
    console.log(`Status: ${singleRes.status}, Elapsed: ${Date.now() - startMs2}ms`);
    if (singleRes.status !== 200) {
      console.error('Single-route analysis failed:', singleData);
      throw new Error(`Single-route analysis failed with status ${singleRes.status}`);
    }
    console.log(`Candidate Routes: ${singleData.routes?.length}`);
    console.log(`Comparison Available: ${singleData.recommendation?.comparisonAvailable}`);
    console.log(`Recommendation: ${singleData.recommendation?.routeName} - ${singleData.recommendation?.summary}`);
    singleData.routes.forEach((r: any) => {
      console.log(`  - [${r.name}] Avg Temp: ${r.avgTemperatureCelsius}°C, Max Temp: ${r.maxTemperatureCelsius}°C, Heat Score: ${r.heatScore}`);
    });

    console.log('\n🎉 ALL LIVE E2E API VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
