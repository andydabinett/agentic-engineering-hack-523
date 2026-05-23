# Payment Harness Microservice

A discrete, local-first payment harness microservice designed for an apartment-hunting AI agent (such as Javier, the NYC Rent Concierge). It enables credit-accounting holds for apartment viewings and handles on-chain payouts of USDC to brokers on Base Sepolia using Coinbase Developer Platform (CDP) Developer-Custodied Wallets.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Orchestrating AI Agent    |
                      +--------------+--------------+
                                     |
                                     | (API Calls)
                                     ▼
                      +-----------------------------+
                      |  Payment Harness Service    |
                      +--------------+--------------+
                                     |
                +--------------------+--------------------+
                | (Credit Accounting)                     | (On-chain Tx)
                ▼                                         ▼
      +-------------------+                     +--------------------+
      | SQLite DB         |                     | Coinbase CDP       |
      | (users & holds)   |                     | Escrow Wallet      |
      +-------------------+                     +--------------------+
                                                          |
                                                          | (USDC Transfer)
                                                          ▼
                                                +--------------------+
                                                |   Broker Wallet    |
                                                +--------------------+
```

- **Off-chain Credit Accounting:** User balances (available and held credits) are tracked locally in SQLite (`./payments.db`). No on-chain wallet is created per user.
- **Single Escrow Wallet:** A single developer-custodied wallet (CDP Server Wallet) custodies all platform-held funds.
- **On-chain Payouts:** Real on-chain transactions are only executed when a broker claims a payout for a user no-show.
- **Broker Onboarding Bypass:** Brokers do not need to onboard beforehand; they simply supply an EVM address when they claim a no-show payout (e.g. via SMS reply), minimizing onboarding friction.

---

## Hold State Machine Diagram

```
       +--------------------------------------------+
       |                   held                     |
       +-------+----------------------------+-------+
               |                            |
               | (release-to-broker)        | (refund-to-user)
               |                            |
               ▼                            ▼
  +--------------------------+    +--------------------+
  |    released_to_broker    |    |  refunded_to_user  |
  |    (terminal state)      |    |  (terminal state)  |
  +--------------------------+    +--------------------+
```

---

## Orchestrating Agent Contract (Sequence of Calls)

An orchestrating agent interacts with this microservice in the following sequence:

1. **`POST /user`** (once per user, idempotent): Registers the user and pre-funds their platform credits (default 50 USDC).
2. **`POST /hold`** (at booking time): Locks 25 USDC when the user schedules a viewing.
3. **Outcome A: User Attends**
   - **`POST /hold/:holdId/refund-to-user`**: Releases the 25 USDC back to the user's available balance (off-chain credit accounting, no on-chain tx fees).
4. **Outcome B: User No-shows**
   - **`POST /hold/:holdId/release-to-broker`**: Triggered when the broker claims a no-show payout. The agent requests the broker's wallet address (e.g., via SMS) and sends it as part of this request, executing a gasless on-chain transfer from the escrow wallet to the broker.

---

## One-Command Setup & Run

### Prerequisites
- Node.js v20 or higher.
- A Coinbase Developer Platform API key. If you don't have one, get it here: [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com/).

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create and configure your `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
3. Set your CDP credentials in `.env`:
   ```env
   CDP_API_KEY_NAME="your_api_key_name"
   CDP_API_KEY_PRIVATE_KEY="your_api_key_private_key"
   ```

### First Run & Escrow Wallet Funding
1. Run the dev server to trigger the startup validation:
   ```bash
   npm run dev
   ```
2. If `ESCROW_WALLET_ID` is missing in `.env`, the startup process will automatically generate a new developer-custodied wallet on Base Sepolia, print its address to `stdout`, write its ID to `.env`, and exit.
3. **Fund the Escrow Wallet:**
   - Copy the printed wallet address from stdout.
   - Go to [faucet.circle.com](https://faucet.circle.com/).
   - Select **Base** network and **Sepolia** testnet.
   - Paste the wallet address and request at least **100 USDC**.
4. Restart the server to resume normal operation:
   ```bash
   npm run dev
   ```

---

## API Reference

### User Endpoints

#### Create User (Idempotent)
Creates a new user record. If the user already exists, returns the existing record.
- **URL:** `/user`
- **Method:** `POST`
- **Payload:**
  ```json
  {
    "userId": "demo-user-1",
    "initialCreditsUsdc": 50
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "userId": "demo-user-1",
    "availableCreditsUsdc": 50,
    "heldCreditsUsdc": 0
  }
  ```

#### Get User Profile
Retrieves user record and their recent holds.
- **URL:** `/user/:userId`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "userId": "demo-user-1",
    "availableCreditsUsdc": 25,
    "heldCreditsUsdc": 25,
    "createdAt": 1716493120000,
    "recentHolds": [
      {
        "holdId": "b18bfa9a-589f-4318-8798-251f938b812a",
        "viewingId": "vw-1",
        "status": "held",
        "amountUsdc": 25,
        "settleReason": null,
        "payoutTxHash": null,
        "createdAt": 1716493200000,
        "settledAt": null
      }
    ]
  }
  ```

---

### Platform Endpoints

#### Get Escrow Wallet Balance
Returns the actual on-chain balance of the platform escrow wallet.
- **URL:** `/platform/balance`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "escrowAddress": "0x401247d4F436b7F0335eE16B70591fba38dCE573",
    "balanceUsdc": 100,
    "network": "base-sepolia"
  }
  ```

---

### Hold & Lifecycle Endpoints

#### Create Hold (Idempotent)
Moves credits from `available` to `held`.
- **URL:** `/hold`
- **Method:** `POST`
- **Payload:**
  ```json
  {
    "viewingId": "vw-1",
    "userId": "demo-user-1",
    "amountUsdc": 25
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "holdId": "b18bfa9a-589f-4318-8798-251f938b812a",
    "viewingId": "vw-1",
    "status": "held",
    "amountUsdc": 25,
    "userId": "demo-user-1",
    "userBalanceAfter": {
      "available": 25,
      "held": 25
    },
    "createdAt": 1716493200000
  }
  ```

#### Release Hold to Broker (No-Show Outcome)
Executes an on-chain transfer of USDC from the escrow wallet to the broker.
- **URL:** `/hold/:holdId/release-to-broker`
- **Method:** `POST`
- **Payload:**
  ```json
  {
    "brokerWalletAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "reason": "no_show",
    "brokerLabel": "Broker Mike"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "holdId": "b18bfa9a-589f-4318-8798-251f938b812a",
    "status": "released_to_broker",
    "brokerWalletAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "brokerLabel": "Broker Mike",
    "amountUsdc": 25,
    "txHash": "0xe2b7b5c8...",
    "explorerUrl": "https://sepolia.basescan.org/tx/0xe2b7b5c8...",
    "settledAt": 1716493250000
  }
  ```

#### Refund Hold to User (Attended Outcome)
Releases credits back to user available balance. No on-chain transaction.
- **URL:** `/hold/:holdId/refund-to-user`
- **Method:** `POST`
- **Payload:**
  ```json
  {
    "reason": "attended"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "holdId": "b18bfa9a-589f-4318-8798-251f938b812a",
    "status": "refunded_to_user",
    "userId": "demo-user-1",
    "userBalanceAfter": {
      "available": 50,
      "held": 0
    },
    "settledAt": 1716493290000
  }
  ```

#### Get Hold Details
- **URL:** `/hold/:holdId`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "holdId": "b18bfa9a-589f-4318-8798-251f938b812a",
    "viewingId": "vw-1",
    "status": "refunded_to_user",
    "amountUsdc": 25,
    "userId": "demo-user-1",
    "createdAt": 1716493200000,
    "settledAt": 1716493290000
  }
  ```

#### List Holds for User
- **URL:** `/holds?userId=demo-user-1`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  [
    {
      "holdId": "b18bfa9a-589f-4318-8798-251f938b812a",
      "viewingId": "vw-1",
      "status": "refunded_to_user",
      "amountUsdc": 25,
      "userId": "demo-user-1",
      "createdAt": 1716493200000,
      "settledAt": 1716493290000
    }
  ]
  ```

---

## Error Handling

Standard error payload format:
```json
{
  "error": "Error description message",
  "code": "ERROR_CODE_STRING",
  "details": {}
}
```

### Standard Error Codes
| Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `USER_NOT_FOUND` | 404 | User does not exist in SQLite database |
| `HOLD_NOT_FOUND` | 404 | Hold ID does not exist in SQLite database |
| `INSUFFICIENT_CREDITS` | 402 | User available credits are less than requested hold |
| `INVALID_ADDRESS` | 400 | Provided broker wallet address is not a valid EVM address |
| `INVALID_STATE` | 409 | Operation not allowed (e.g. hold is already settled) |
| `PAYOUT_FAILED` | 502 | Coinbase CDP payout failed after retry |

---

## Running the E2E Test Suite

To run the full end-to-end flow:
1. Make sure your server is running in one terminal (`npm run dev`).
2. Run the test suite:
   ```bash
   npm run test-flow
   ```
   *(Note: You can override the destination broker address by exporting `DEMO_BROKER_ADDRESS` in your shell).*
