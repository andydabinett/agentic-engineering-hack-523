import { Router, Request, Response } from 'express';
import { createUser, getUser, getHoldsByUserId } from '../services/escrow.js';
import { createUserSchema } from '../lib/validation.js';

const router = Router();

// POST /user
router.post('/user', (req: Request, res: Response) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: "Invalid request body",
      code: "INVALID_REQUEST",
      details: result.error.format()
    });
    return;
  }

  const { userId, initialCreditsUsdc } = result.data;
  const user = createUser(userId, initialCreditsUsdc);

  res.status(200).json({
    userId: user.user_id,
    availableCreditsUsdc: user.available_credits,
    heldCreditsUsdc: user.held_credits
  });
});

// GET /user/:userId
router.get('/user/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = getUser(userId);

  if (!user) {
    res.status(404).json({
      error: `User ${userId} not found`,
      code: "USER_NOT_FOUND"
    });
    return;
  }

  const holds = getHoldsByUserId(userId);

  res.status(200).json({
    userId: user.user_id,
    availableCreditsUsdc: user.available_credits,
    heldCreditsUsdc: user.held_credits,
    createdAt: user.created_at,
    recentHolds: holds.map(h => ({
      holdId: h.id,
      viewingId: h.viewing_id,
      status: h.status,
      amountUsdc: h.amount_usdc,
      settleReason: h.settle_reason,
      payoutTxHash: h.payout_tx_hash,
      createdAt: h.created_at,
      settledAt: h.settled_at
    }))
  });
});

export default router;
