import { Router, Request, Response } from 'express';
import { createHold, releaseHoldToBroker, refundHoldToUser, getHold, getHoldsByUserId, getUser, EscrowError } from '../services/escrow.js';
import { createHoldSchema, releaseHoldSchema, refundHoldSchema } from '../lib/validation.js';
import { getExplorerUrl } from '../lib/explorer.js';

const router = Router();

// Helper to format hold response matching the PRD
function formatHoldResponse(hold: any) {
  const response: any = {
    holdId: hold.id,
    viewingId: hold.viewing_id,
    status: hold.status,
    amountUsdc: hold.amount_usdc,
    userId: hold.user_id,
    createdAt: hold.created_at
  };

  if (hold.status === 'released_to_broker') {
    response.brokerWalletAddress = hold.broker_wallet_address;
    response.brokerLabel = hold.broker_label;
    response.txHash = hold.payout_tx_hash;
    response.explorerUrl = getExplorerUrl(hold.payout_tx_hash);
    response.settledAt = hold.settled_at;
  } else if (hold.status === 'refunded_to_user') {
    response.settledAt = hold.settled_at;
  }

  return response;
}

// POST /hold
router.post('/hold', (req: Request, res: Response) => {
  const result = createHoldSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "Invalid request body",
      code: "INVALID_REQUEST",
      details: result.error.format()
    });
    return;
  }

  const { viewingId, userId, amountUsdc } = result.data;

  try {
    const hold = createHold(viewingId, userId, amountUsdc);
    const user = getUser(userId)!;

    res.status(200).json({
      holdId: hold.id,
      viewingId: hold.viewing_id,
      status: hold.status,
      amountUsdc: hold.amount_usdc,
      userId: hold.user_id,
      userBalanceAfter: {
        available: user.available_credits,
        held: user.held_credits
      },
      createdAt: hold.created_at
    });
  } catch (err: any) {
    if (err instanceof EscrowError) {
      res.status(err.status).json({
        error: err.message,
        code: err.code
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR"
      });
    }
  }
});

// POST /hold/:holdId/release-to-broker
router.post('/hold/:holdId/release-to-broker', async (req: Request, res: Response) => {
  const { holdId } = req.params;
  const result = releaseHoldSchema.safeParse(req.body);
  
  if (!result.success) {
    res.status(400).json({
      error: "Invalid request body",
      code: "INVALID_REQUEST",
      details: result.error.format()
    });
    return;
  }

  const { brokerWalletAddress, reason, brokerLabel } = result.data;

  try {
    const hold = await releaseHoldToBroker(holdId, brokerWalletAddress, brokerLabel, reason);
    res.status(200).json({
      holdId: hold.id,
      status: hold.status,
      brokerWalletAddress: hold.broker_wallet_address,
      brokerLabel: hold.broker_label,
      amountUsdc: hold.amount_usdc,
      txHash: hold.payout_tx_hash,
      explorerUrl: getExplorerUrl(hold.payout_tx_hash!),
      settledAt: hold.settled_at
    });
  } catch (err: any) {
    if (err instanceof EscrowError) {
      res.status(err.status).json({
        error: err.message,
        code: err.code
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: err.message
      });
    }
  }
});

// POST /hold/:holdId/refund-to-user
router.post('/hold/:holdId/refund-to-user', (req: Request, res: Response) => {
  const { holdId } = req.params;
  const result = refundHoldSchema.safeParse(req.body);
  
  if (!result.success) {
    res.status(400).json({
      error: "Invalid request body",
      code: "INVALID_REQUEST",
      details: result.error.format()
    });
    return;
  }

  const { reason } = result.data;

  try {
    const hold = refundHoldToUser(holdId, reason);
    const user = getUser(hold.user_id)!;
    
    res.status(200).json({
      holdId: hold.id,
      status: hold.status,
      userId: hold.user_id,
      userBalanceAfter: {
        available: user.available_credits,
        held: user.held_credits
      },
      settledAt: hold.settled_at
    });
  } catch (err: any) {
    if (err instanceof EscrowError) {
      res.status(err.status).json({
        error: err.message,
        code: err.code
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR"
      });
    }
  }
});

// GET /hold/:holdId
router.get('/hold/:holdId', (req: Request, res: Response) => {
  const { holdId } = req.params;
  const hold = getHold(holdId);

  if (!hold) {
    res.status(404).json({
      error: `Hold ${holdId} not found`,
      code: "HOLD_NOT_FOUND"
    });
    return;
  }

  res.status(200).json(formatHoldResponse(hold));
});

// GET /holds?userId=...
router.get('/holds', (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({
      error: "Missing userId query parameter",
      code: "MISSING_USER_ID"
    });
    return;
  }

  const holds = getHoldsByUserId(userId);
  res.status(200).json(holds.map(formatHoldResponse));
});

export default router;
