import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

async function run() {
  try {
    console.log("Connecting to Base Sepolia...");
    const blockNumber = await provider.getBlockNumber();
    console.log(`Current block number: ${blockNumber}`);

    const contract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const decimals = await contract.decimals();
    const symbol = await contract.symbol();
    console.log(`Token: ${symbol}, Decimals: ${decimals}`);

    // Query balance of a random address
    const randomAddress = '0x0000000000000000000000000000000000000000';
    const balance = await contract.balanceOf(randomAddress);
    console.log(`Balance of ${randomAddress}: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
  } catch (err) {
    console.error("Error connecting to Base Sepolia:", err);
  }
}

run();
