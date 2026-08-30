/**
 * HeatRoute Backend Server Entrypoint (Local).
 * Starts Express HTTP listener on configured port.
 */

import { CONFIG } from './config';
import { app } from './app';

const PORT = CONFIG.server.port;

app.listen(PORT, () => {
  console.info(`====================================================`);
  console.info(`🚀 HeatRoute Server running on http://localhost:${PORT}`);
  console.info(`🌍 Target Region: United States (Demo: Alabama)`);
  console.info(`🔑 FortyGuard Key: ${process.env.FORTYGUARD_API_KEY ? 'Present (Server-Only)' : 'MISSING'}`);
  console.info(`====================================================`);
});

export default app;
