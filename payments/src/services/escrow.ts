import { randomUUID } from 'crypto';
import { queries, runInTransaction } from './db.js';
import { payout } from './cdp.js';

export class EscrowError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
    this.name = 'EscrowError';
  }
}

export interface UserRecord {
  user_id: string;
  available_credits: number;
  held_credits: number;
  created_at: number;
}

export interface HoldRecord {
  id: string;
  viewing_id: string;
  user_id: string;
  amount_usdc: number;
  status: 'held' | 'released_to_broker' | 'refunded_to_user';
  broker_wallet_address: string | null;
  broker_label: string | null;
  settle_reason: string | null;
  payout_tx_hash: string | null;
  created_at: number;
  settled_at: number | null;
}

/**
 * Creates a user with initial credits (idempotent).
 * If user exists, returns their current record.
 */
export function createUser(userId: string, initialCreditsUsdc: number = 50): UserRecord {
  return runInTransaction(() => {
    const existing = queries.getUser.get(userId) as unknown as UserRecord | undefined;
    if (existing) {
      return existing;
    }
    
    const now = Date.now();
    queries.createUser.run(userId, initialCreditsUsdc, 0, now);
    return {
      user_id: userId,
      available_credits: initialCreditsUsdc,
      held_credits: 0,
      created_at: now
    };
  });
}

/**
 * Retrieves a user record by ID.
 */
export function getUser(userId: string): UserRecord | undefined {
  return queries.getUser.get(userId) as unknown as UserRecord | undefined;
}

/**
 * Creates a hold on a user's credits (idempotent).
 * If viewingId already exists, returns the existing hold without updating balances.
 */
export function createHold(viewingId: string, userId: string, amountUsdc: number): HoldRecord {
  return runInTransaction(() => {
    // Idempotency: check if hold already exists for this viewingId
    const existing = queries.getHoldByViewingId.get(viewingId) as unknown as HoldRecord | undefined;
    if (existing) {
      return existing;
    }

    // Look up user
    const user = queries.getUser.get(userId) as unknown as UserRecord | undefined;
    if (!user) {
      throw new EscrowError('USER_NOT_FOUND', 404, `User ${userId} not found`);
    }

    // Verify credits
    if (user.available_credits < amountUsdc) {
      throw new EscrowError('INSUFFICIENT_CREDITS', 402, `User ${userId} has insufficient credits. Required: ${amountUsdc}, Available: ${user.available_credits}`);
    }

    // Update user balance (credit accounting)
    const newAvailable = user.available_credits - amountUsdc;
    const newHeld = user.held_credits + amountUsdc;
    queries.updateUserCredits.run(newAvailable, newHeld, userId);

    // Create hold record
    const holdId = randomUUID();
    const now = Date.now();
    queries.createHold.run(holdId, viewingId, userId, amountUsdc, now);

    return {
      id: holdId,
      viewing_id: viewingId,
      user_id: userId,
      amount_usdc: amountUsdc,
      status: 'held',
      broker_wallet_address: null,
      broker_label: null,
      settle_reason: null,
      payout_tx_hash: null,
      created_at: now,
      settled_at: null
    };
  });
}

/**
 * Releases a hold to a broker (performs actual on-chain payout).
 */
export async function releaseHoldToBroker(
  holdId: string, 
  brokerWalletAddress: string, 
  brokerLabel?: string, 
  reason: string = 'no_show'
): Promise<HoldRecord> {
  // 1. Validate hold state (outside transaction for async payout)
  const hold = queries.getHold.get(holdId) as unknown as HoldRecord | undefined;
  if (!hold) {
    throw new EscrowError('HOLD_NOT_FOUND', 404, `Hold ${holdId} not found`);
  }

  if (hold.status !== 'held') {
    throw new EscrowError('INVALID_STATE', 409, `Hold ${holdId} is not in status 'held'`);
  }

  // 2. Perform actual on-chain transaction
  let txHash: string;
  try {
    txHash = await payout(brokerWalletAddress, hold.amount_usdc);
  } catch (err: any) {
    // If payout fails, do NOT modify DB status, so the caller can retry.
    throw new EscrowError('PAYOUT_FAILED', 502, `On-chain payout to broker failed: ${err.message || err}`);
  }

  // 3. Update database state in transaction
  return runInTransaction(() => {
    // Fetch latest user details
    const user = queries.getUser.get(hold.user_id) as unknown as UserRecord | undefined;
    if (!user) {
      throw new EscrowError('USER_NOT_FOUND', 404, `User ${hold.user_id} not found`);
    }

    // Decrement user held credits
    const newHeld = Math.max(0, user.held_credits - hold.amount_usdc);
    queries.updateUserCredits.run(user.available_credits, newHeld, hold.user_id);

    // Update hold details
    const now = Date.now();
    queries.updateHoldStatus.run(
      'released_to_broker',
      brokerWalletAddress,
      brokerLabel || null,
      reason,
      txHash,
      now,
      holdId
    );

    return {
      ...hold,
      status: 'released_to_broker',
      broker_wallet_address: brokerWalletAddress,
      broker_label: brokerLabel || null,
      settle_reason: reason,
      payout_tx_hash: txHash,
      settled_at: now
    };
  });
}

/**
 * Refunds a hold back to the user (credit accounting only).
 */
export function refundHoldToUser(holdId: string, reason: string = 'attended'): HoldRecord {
  return runInTransaction(() => {
    const hold = queries.getHold.get(holdId) as unknown as HoldRecord | undefined;
    if (!hold) {
      throw new EscrowError('HOLD_NOT_FOUND', 404, `Hold ${holdId} not found`);
    }

    if (hold.status !== 'held') {
      throw new EscrowError('INVALID_STATE', 409, `Hold ${holdId} is not in status 'held'`);
    }

    const user = queries.getUser.get(hold.user_id) as unknown as UserRecord | undefined;
    if (!user) {
      throw new EscrowError('USER_NOT_FOUND', 404, `User ${hold.user_id} not found`);
    }

    // Move from held back to available
    const newHeld = Math.max(0, user.held_credits - hold.amount_usdc);
    const newAvailable = user.available_credits + hold.amount_usdc;
    queries.updateUserCredits.run(newAvailable, newHeld, hold.user_id);

    // Update hold status
    const now = Date.now();
    queries.updateHoldStatus.run(
      'refunded_to_user',
      null,
      null,
      reason,
      null,
      now,
      holdId
    );

    return {
      ...hold,
      status: 'refunded_to_user',
      settle_reason: reason,
      settled_at: now
    };
  });
}

/**
 * Retrieves a hold record by ID.
 */
export function getHold(holdId: string): HoldRecord | undefined {
  return queries.getHold.get(holdId) as unknown as HoldRecord | undefined;
}

/**
 * Retrieves all holds associated with a specific user.
 */
export function getHoldsByUserId(userId: string): HoldRecord[] {
  return queries.getHoldsByUserId.all(userId) as unknown as HoldRecord[];
}
