import { Router, Request, Response } from 'express';
import { getEscrowBalance } from '../services/cdp.js';

const router = Router();

// GET /platform/balance
router.get('/platform/balance', async (req: Request, res: Response) => {
  try {
    const escrowInfo = await getEscrowBalance();
    res.status(200).json(escrowInfo);
  } catch (err: any) {
    res.status(500).json({
      error: `Failed to fetch escrow wallet balance: ${err.message || err}`,
      code: "CDP_API_ERROR"
    });
  }
});

export default router;
