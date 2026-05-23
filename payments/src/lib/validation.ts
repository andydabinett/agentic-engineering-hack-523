import { z } from 'zod';

export const createUserSchema = z.object({
  userId: z.string().trim().min(1, { message: "userId must not be empty" }),
  initialCreditsUsdc: z.number().nonnegative().optional()
});

export const createHoldSchema = z.object({
  viewingId: z.string().trim().min(1, { message: "viewingId must not be empty" }),
  userId: z.string().trim().min(1, { message: "userId must not be empty" }),
  amountUsdc: z.number().positive({ message: "amountUsdc must be greater than zero" })
});

export const releaseHoldSchema = z.object({
  brokerWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
    message: "brokerWalletAddress must be a valid EVM address (e.g. 0x... with 40 hex characters)"
  }),
  reason: z.string().trim().min(1, { message: "reason must not be empty" }),
  brokerLabel: z.string().trim().optional()
});

export const refundHoldSchema = z.object({
  reason: z.string().trim().min(1, { message: "reason must not be empty" })
});
