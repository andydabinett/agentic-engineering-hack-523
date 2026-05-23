import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const apiKeyName = process.env.CDP_API_KEY_NAME;
const apiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;

if (!apiKeyName || !apiKeyPrivateKey) {
  console.error("Missing CDP_API_KEY_NAME or CDP_API_KEY_PRIVATE_KEY in environment.");
  process.exit(1);
}

// Configure Coinbase
Coinbase.configure({
  apiKeyName,
  privateKey: apiKeyPrivateKey,
});

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function transfer(address recipient, uint256 amount) external returns (bool)'
];
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

let activeWallet: Wallet | null = null;
let activeEthersWallet: ethers.Wallet | null = null;
let isLocalMode = false;

/**
 * Writes key-value pairs to the local .env file.
 */
function writeToEnv(vars: Record<string, string>) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  for (const [key, value] of Object.entries(vars)) {
    if (envContent.includes(`${key}=`)) {
      const regex = new RegExp(`${key}=.*`);
      envContent = envContent.replace(regex, `${key}="${value}"`);
    } else {
      envContent += `\n${key}="${value}"\n`;
    }
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
}

/**
 * Ensures the escrow wallet is initialized.
 * Supports both CDP server-custodied wallet and local Ethers wallet fallback.
 */
export async function ensureEscrowWallet(): Promise<Wallet | ethers.Wallet> {
  if (activeWallet) {
    return activeWallet;
  }
  if (activeEthersWallet) {
    return activeEthersWallet;
  }

  // 1. Check if we already have a local private key configured (fallback mode)
  const localPrivateKey = process.env.ESCROW_PRIVATE_KEY;
  if (localPrivateKey) {
    isLocalMode = true;
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    activeEthersWallet = new ethers.Wallet(localPrivateKey, provider);
    console.log(`========================================================================`);
    console.log(`INITIALIZED IN LOCAL ETHERS ESCROW MODE`);
    console.log(`Address: ${activeEthersWallet.address}`);
    console.log(`========================================================================`);
    return activeEthersWallet;
  }

  // 2. Check if we have a CDP wallet ID configured
  const escrowWalletId = process.env.ESCROW_WALLET_ID;
  if (!escrowWalletId) {
    console.log("ESCROW_WALLET_ID is missing from environment. Attempting to create a new CDP wallet on Base Sepolia...");
    try {
      const wallet = await Wallet.create({ networkId: Coinbase.networks.BaseSepolia });
      const address = await wallet.getDefaultAddress();
      const walletId = wallet.getId();
      const addressStr = address.toString();

      console.log("Wallet created successfully via CDP!");
      writeToEnv({ ESCROW_WALLET_ID: walletId });

      console.log("\n========================================================================");
      console.log("NEW ESCROW WALLET GENERATED!");
      console.log(`Wallet ID: ${walletId}`);
      console.log(`Address: ${addressStr}`);
      console.log("========================================================================");
      console.log(`Please fund this address with at least 100 USDC on Base Sepolia from the faucet:`);
      console.log(`https://faucet.circle.com/`);
      console.log(`Or Base Sepolia bridge. Then restart the server.`);
      console.log("========================================================================\n");
      
      process.exit(0);
    } catch (error: any) {
      console.warn("\n========================================================================");
      console.warn("COINBASE WALLET CREATION RATE LIMIT EXCEEDED OR FAILED");
      console.warn(`Reason: ${error.apiMessage || error.message || error}`);
      console.warn("Falling back to generating a local Ethers-managed wallet instead...");
      console.warn("========================================================================\n");

      // Generate a new random local Ethers wallet
      const localWallet = ethers.Wallet.createRandom();
      const addressStr = localWallet.address;
      const privateKeyStr = localWallet.privateKey;

      writeToEnv({
        ESCROW_PRIVATE_KEY: privateKeyStr,
        ESCROW_WALLET_ADDRESS: addressStr
      });

      console.log("========================================================================");
      console.log("NEW LOCAL ESCROW WALLET GENERATED (CDP FALLBACK)!");
      console.log(`Address: ${addressStr}`);
      console.log("========================================================================");
      console.log(`Please fund this address on Base Sepolia with:`);
      console.log(`1. Base Sepolia ETH (for gas fees) from a faucet, e.g.:`);
      console.log(`   - https://faucet.quicknode.com/base/sepolia`);
      console.log(`   - https://www.bwarelabs.com/faucet/base-sepolia`);
      console.log(`2. USDC on Base Sepolia from:`);
      console.log(`   - https://faucet.circle.com/`);
      console.log(`Then restart the server.`);
      console.log("========================================================================\n");

      process.exit(0);
    }
  }

  // Fetch the existing CDP wallet by ID
  try {
    activeWallet = await Wallet.fetch(escrowWalletId);
    return activeWallet;
  } catch (error: any) {
    console.error(`Failed to fetch wallet with ID ${escrowWalletId}:`, error.message || error);
    process.exit(1);
  }
}

/**
 * Retrieves the current balance of USDC on Base Sepolia in the escrow wallet.
 */
export async function getEscrowBalance(): Promise<{ escrowAddress: string; balanceUsdc: number; network: string }> {
  const wallet = await ensureEscrowWallet();
  if (isLocalMode || wallet instanceof ethers.Wallet) {
    const localWallet = wallet as ethers.Wallet;
    const contract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, localWallet.provider);
    const balanceRaw = await contract.balanceOf(localWallet.address);
    // USDC is 6 decimals
    const balanceUsdc = Number(ethers.formatUnits(balanceRaw, 6));
    return {
      escrowAddress: localWallet.address,
      balanceUsdc,
      network: 'base-sepolia',
    };
  } else {
    const cdpWallet = wallet as Wallet;
    const address = await cdpWallet.getDefaultAddress();
    const balanceDec = await cdpWallet.getBalance(Coinbase.assets.Usdc);
    return {
      escrowAddress: address.toString(),
      balanceUsdc: balanceDec.toNumber(),
      network: 'base-sepolia',
    };
  }
}

/**
 * Executes an on-chain transfer of USDC from the escrow wallet to the broker.
 * Retries once with a 1-second backoff on failure.
 */
export async function payout(toAddress: string, amountUsdc: number): Promise<string> {
  const wallet = await ensureEscrowWallet();
  
  const executeTransfer = async () => {
    if (isLocalMode || wallet instanceof ethers.Wallet) {
      const localWallet = wallet as ethers.Wallet;
      const contract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, localWallet);
      const amountUnits = ethers.parseUnits(amountUsdc.toString(), 6);
      
      const tx = await contract.transfer(toAddress, amountUnits);
      await tx.wait(1);
      const txHash = tx.hash;
      if (!txHash) {
        throw new Error("Transaction hash was not returned");
      }
      return txHash;
    } else {
      const cdpWallet = wallet as Wallet;
      const transfer = await cdpWallet.createTransfer({
        amount: amountUsdc,
        assetId: Coinbase.assets.Usdc,
        destination: toAddress,
        gasless: true,
      });
      await transfer.wait();
      const txHash = transfer.getTransactionHash();
      if (!txHash) {
        throw new Error("Transaction hash was not returned");
      }
      return txHash;
    }
  };

  try {
    return await executeTransfer();
  } catch (err: any) {
    console.warn(`First payout attempt failed: ${err.message || err}. Retrying in 1s...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      return await executeTransfer();
    } catch (retryErr: any) {
      console.error(`Second payout attempt failed: ${retryErr.message || retryErr}`);
      throw retryErr;
    }
  }
}
