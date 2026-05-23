import express from 'express';
import dotenv from 'dotenv';
import { requestLogger } from './lib/logger.js';
import userRouter from './routes/user.js';
import holdRouter from './routes/hold.js';
import platformRouter from './routes/platform.js';
import { ensureEscrowWallet } from './services/cdp.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 8787;

// Configure body-parser & logger middleware
app.use(express.json());
app.use(requestLogger);

// Mount routing components
app.use('/', userRouter);
app.use('/', holdRouter);
app.use('/', platformRouter);

// Basic status check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'payments-harness' });
});

// Generic 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
});

// Startup validation function
async function startServer() {
  console.log("Running payment harness startup validation checks...");
  
  // This will check for ESCROW_WALLET_ID. If missing, it will generate a new
  // wallet, print the address, write the ID to .env and exit(0).
  await ensureEscrowWallet();

  app.listen(port, () => {
    console.log(`========================================================================`);
    console.log(`Payment harness microservice successfully running on http://localhost:${port}`);
    console.log(`========================================================================`);
  });
}

startServer().catch((err) => {
  console.error("Critical error during microservice startup:", err);
  process.exit(1);
});
