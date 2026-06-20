// =============================================================================
// Payment module — PLUGGABLE, sandbox-first.
//
// PCI-DSS POSTURE:
//  - Card numbers are NEVER passed to or stored by this app. In production, the
//    caller enters the PAN/CVV via DTMF on their phone keypad; LiveKit/Telnyx
//    masks those tones from the recording, and the digits are forwarded directly
//    to the payment provider's tokenization endpoint.
//  - This module only ever sees a one-time TOKEN, never the raw card. That keeps
//    the application out of PCI scope.
//
// MODES:
//  - 'sandbox' (current): simulates auth/decline deterministically so the whole
//    call + CRM flow works end-to-end with no bank and no real charges.
//  - 'live': implement against Authorize.net (MOTO account) once a US merchant
//    account + bank exist. The interface below does not change.
// =============================================================================
import { config } from './config.js';

export interface ChargeRequest {
  amountCents: number;
  /** One-time token representing the card (from DTMF capture leg). Never a PAN. */
  cardToken: string;
  descriptor: string;
  orderRef: string;
}

export interface ChargeResult {
  approved: boolean;
  transactionId?: string;
  declineReason?: string;
}

export interface PaymentProvider {
  /** Begin secure DTMF card capture; resolves to a one-time token. */
  captureCardToken(opts: { callId: string }): Promise<{ token: string }>;
  /** Charge using a previously captured token. */
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

// ---- Sandbox provider ------------------------------------------------------
// Deterministic for testing: a token containing 'decline' declines; otherwise
// approves. Lets you exercise both the success and card_declined CRM paths.
class SandboxProvider implements PaymentProvider {
  async captureCardToken({ callId }: { callId: string }): Promise<{ token: string }> {
    // In production this is where we'd bridge the DTMF capture leg. In sandbox we
    // just mint a fake token. To simulate a decline in a test, the agent/tool can
    // request a token with 'decline' in it.
    return { token: `sbx_tok_${callId.slice(0, 8)}` };
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    if (req.cardToken.includes('decline')) {
      return { approved: false, declineReason: 'Card declined (sandbox simulation)' };
    }
    return { approved: true, transactionId: `sbx_txn_${Date.now()}` };
  }
}

// ---- Live provider (stub) --------------------------------------------------
// TODO(payments): implement against Authorize.net MOTO once bank is ready.
// Until then, selecting 'live' without an implementation throws loudly.
class AuthorizeNetProvider implements PaymentProvider {
  async captureCardToken(): Promise<{ token: string }> {
    throw new Error(
      'Live payment provider not implemented yet. Set PAYMENT_MODE=sandbox until your ' +
        'US MOTO merchant account + Authorize.net credentials are ready.'
    );
  }
  async charge(): Promise<ChargeResult> {
    throw new Error('Live payment provider not implemented yet.');
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  provider = config.paymentMode === 'live' ? new AuthorizeNetProvider() : new SandboxProvider();
  return provider;
}

export function isSandbox(): boolean {
  return config.paymentMode !== 'live';
}
