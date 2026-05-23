import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const apiKeyName = process.env.CDP_API_KEY_NAME;
const apiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;

if (!apiKeyName || !apiKeyPrivateKey) {
  console.error("Missing CDP_API_KEY_NAME or CDP_API_KEY_PRIVATE_KEY in environment.");
  process.exit(1);
}

Coinbase.configure({
  apiKeyName,
  privateKey: apiKeyPrivateKey,
});

async function run() {
  try {
    console.log("Listing wallets...");
    const response = await Wallet.listWallets();
    console.log("Response data:", response.data);
    
    for (const wallet of response.data) {
      console.log("-----------------------------------------");
      console.log(`Wallet ID: ${wallet.id}`);
      console.log(`Network ID: ${wallet.networkId}`);
      try {
        const address = await wallet.getDefaultAddress();
        console.log(`Address: ${address.toString()}`);
      } catch (err) {
        console.log(`Could not fetch address for wallet ${wallet.id}:`, err);
      }
    }
  } catch (err) {
    console.error("Error listing wallets:", err);
  }
}

run();
