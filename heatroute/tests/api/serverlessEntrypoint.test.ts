import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import serverlessApp from '../../api/index';

describe('Vercel Serverless Entrypoint (api/index.ts)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer(serverlessApp);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('exports a valid Express application instance', () => {
    expect(serverlessApp).toBeDefined();
    expect(typeof serverlessApp).toBe('function');
  });

  it('serves GET /api/health with 200 OK and diagnostics', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('HeatRoute API');
    expect(typeof data.fortyguardConfigured).toBe('boolean');
  });

  it('serves GET /api/geocode with validation and suggestions', async () => {
    const res = await fetch(`${baseUrl}/api/geocode?q=Mobile`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('lat');
      expect(data[0]).toHaveProperty('lng');
    }
  });

  it('rejects POST /api/analyze with 422 on invalid payload without crashing', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: { lat: 1000, lng: -2000 } }),
    });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe(true);
  });
});
