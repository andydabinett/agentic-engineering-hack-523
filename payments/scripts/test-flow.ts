import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 8787;
const baseUrl = `http://localhost:${port}`;

// Helper to make API requests using global fetch
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse JSON response from ${endpoint}: ${text}`);
  }

  if (!response.ok) {
    const err = new Error(json.error || `HTTP Error ${response.status}`);
    (err as any).status = response.status;
    (err as any).code = json.code;
    (err as any).details = json;
    throw err;
  }

  return json;
}

// Assert helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function run() {
  console.log(`Starting payment harness E2E test flow against ${baseUrl}...\n`);

  // Verify server is running
  try {
    await fetch(`${baseUrl}/health`);
  } catch (err) {
    console.error(`❌ Error: Payment harness service is not running on ${baseUrl}.`);
    console.error(`Please run 'npm run dev' in another terminal first to start the service.`);
    process.exit(1);
  }

  // 1. GET /platform/balance — print escrow address + balance
  console.log("Step 1: Fetching platform escrow balance...");
  const balanceInfo = await apiRequest('/platform/balance');
  console.log(`- Escrow Wallet Address: ${balanceInfo.escrowAddress}`);
  console.log(`- Current USDC Balance: ${balanceInfo.balanceUsdc} USDC`);
  console.log(`- Network: ${balanceInfo.network}\n`);

  // 2. If balance < 50 USDC, print faucet instructions and exit
  if (balanceInfo.balanceUsdc < 50) {
    console.warn("⚠️  WARNING: Escrow wallet balance is less than 50 USDC.");
    console.warn("To run the complete test flow (needs 50 USDC total), please fund the address:");
    console.warn(`👉 Address: ${balanceInfo.escrowAddress}`);
    console.warn("👉 Circle Faucet: https://faucet.circle.com/ (Select Base Sepolia, paste address)");
    console.warn("Please fund it with at least 50-100 USDC and try again.");
    process.exit(1);
  }

  const transactionsList: any[] = [];

  // 3. POST /user { userId: 'demo-user-1', initialCreditsUsdc: 50 }
  console.log("Step 3: Creating demo-user-1 with 50 credits...");
  const user1 = await apiRequest('/user', {
    method: 'POST',
    body: JSON.stringify({ userId: 'demo-user-1', initialCreditsUsdc: 50 })
  });
  console.log(`- Response: Available = ${user1.availableCreditsUsdc}, Held = ${user1.heldCreditsUsdc}\n`);
  assert(user1.availableCreditsUsdc === 50, "demo-user-1 available credits should be 50");
  assert(user1.heldCreditsUsdc === 0, "demo-user-1 held credits should be 0");

  // 4. POST /hold { viewingId: 'vw-1', userId: 'demo-user-1', amountUsdc: 25 }
  console.log("Step 4: Placing a 25 USDC hold for demo-user-1 (booking viewing vw-1)...");
  const hold1 = await apiRequest('/hold', {
    method: 'POST',
    body: JSON.stringify({ viewingId: 'vw-1', userId: 'demo-user-1', amountUsdc: 25 })
  });
  console.log(`- Hold Created: ID = ${hold1.holdId}, Status = ${hold1.status}`);
  console.log(`- Balance After: Available = ${hold1.userBalanceAfter.available}, Held = ${hold1.userBalanceAfter.held}\n`);
  assert(hold1.status === 'held', "Hold status should be 'held'");
  assert(hold1.userBalanceAfter.available === 25, "Available credits should decrease to 25");
  assert(hold1.userBalanceAfter.held === 25, "Held credits should increase to 25");

  // 5. POST /hold/<holdId>/release-to-broker with a test broker address.
  const brokerAddress = process.env.DEMO_BROKER_ADDRESS || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  console.log(`Step 5: Releasing hold ${hold1.holdId} to broker...`);
  console.log(`- Using Broker Address: ${brokerAddress}`);
  if (!process.env.DEMO_BROKER_ADDRESS) {
    console.log("  (Note: You can override this broker address by setting DEMO_BROKER_ADDRESS env variable)");
  }

  const releaseRes = await apiRequest(`/hold/${hold1.holdId}/release-to-broker`, {
    method: 'POST',
    body: JSON.stringify({
      brokerWalletAddress: brokerAddress,
      reason: 'no_show',
      brokerLabel: 'Broker Mike (Brooklyn Concierge)'
    })
  });
  console.log(`- Payout Tx Hash: ${releaseRes.txHash}`);
  console.log(`- Explorer URL: ${releaseRes.explorerUrl}`);
  console.log(`- Status: ${releaseRes.status}\n`);
  assert(releaseRes.status === 'released_to_broker', "Hold status should be released_to_broker");

  transactionsList.push({
    holdId: hold1.holdId,
    viewingId: 'vw-1',
    user: 'demo-user-1',
    action: 'Released to Broker',
    amount: 25,
    txHash: releaseRes.txHash,
    explorerUrl: releaseRes.explorerUrl
  });

  // Verify demo-user-1 balances have been updated
  const user1Check = await apiRequest(`/user/demo-user-1`);
  console.log(`- User-1 Balance Check: Available = ${user1Check.availableCreditsUsdc}, Held = ${user1Check.heldCreditsUsdc}\n`);
  assert(user1Check.availableCreditsUsdc === 25, "Available credits should remain 25");
  assert(user1Check.heldCreditsUsdc === 0, "Held credits should decrease to 0");

  // 6. POST /user { userId: 'demo-user-2', initialCreditsUsdc: 50 }
  console.log("Step 6: Creating demo-user-2 with 50 credits...");
  const user2 = await apiRequest('/user', {
    method: 'POST',
    body: JSON.stringify({ userId: 'demo-user-2', initialCreditsUsdc: 50 })
  });
  console.log(`- Response: Available = ${user2.availableCreditsUsdc}, Held = ${user2.heldCreditsUsdc}\n`);

  // 7. POST /hold { viewingId: 'vw-2', userId: 'demo-user-2', amountUsdc: 25 }
  console.log("Step 7: Placing a 25 USDC hold for demo-user-2 (booking viewing vw-2)...");
  const hold2 = await apiRequest('/hold', {
    method: 'POST',
    body: JSON.stringify({ viewingId: 'vw-2', userId: 'demo-user-2', amountUsdc: 25 })
  });
  console.log(`- Hold Created: ID = ${hold2.holdId}, Status = ${hold2.status}`);
  console.log(`- Balance After: Available = ${hold2.userBalanceAfter.available}, Held = ${hold2.userBalanceAfter.held}\n`);

  // 8. POST /hold/<holdId>/refund-to-user
  console.log(`Step 8: Refunding hold ${hold2.holdId} back to demo-user-2 (attended viewing)...`);
  const refundRes = await apiRequest(`/hold/${hold2.holdId}/refund-to-user`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'attended' })
  });
  console.log(`- Status: ${refundRes.status}`);
  console.log(`- Balance After: Available = ${refundRes.userBalanceAfter.available}, Held = ${refundRes.userBalanceAfter.held}\n`);
  assert(refundRes.status === 'refunded_to_user', "Hold status should be refunded_to_user");
  assert(refundRes.userBalanceAfter.available === 50, "Available credits should restore to 50");
  assert(refundRes.userBalanceAfter.held === 0, "Held credits should decrease to 0");

  transactionsList.push({
    holdId: hold2.holdId,
    viewingId: 'vw-2',
    user: 'demo-user-2',
    action: 'Refunded to User',
    amount: 25,
    txHash: 'N/A (Off-chain transaction)',
    explorerUrl: 'N/A'
  });

  // 9. Print summary table of all txs with explorer links
  console.log("====================================================================================================");
  console.log("                                        TRANSACTIONS SUMMARY");
  console.log("====================================================================================================");
  console.log(String("Viewing ID").padEnd(12) + " | " + 
              String("User ID").padEnd(13) + " | " + 
              String("Action").padEnd(20) + " | " + 
              String("Amount").padEnd(8) + " | " + 
              String("Explorer Link / Tx Hash"));
  console.log("----------------------------------------------------------------------------------------------------");
  for (const tx of transactionsList) {
    const txInfo = tx.explorerUrl !== 'N/A' ? tx.explorerUrl : tx.txHash;
    console.log(String(tx.viewingId).padEnd(12) + " | " + 
                String(tx.user).padEnd(13) + " | " + 
                String(tx.action).padEnd(20) + " | " + 
                String(`${tx.amount} USDC`).padEnd(8) + " | " + 
                txInfo);
  }
  console.log("====================================================================================================\n");

  console.log("🎉 All E2E test-flow assertions passed successfully!");
}

run().catch((err) => {
  console.error("❌ E2E Test Flow Failed:", err.message);
  if (err.details) {
    console.error("Details:", JSON.stringify(err.details, null, 2));
  }
  process.exit(1);
});
