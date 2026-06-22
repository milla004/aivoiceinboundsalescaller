// =============================================================================
// Inbound voice sales agent — LiveKit + Gemini Live (speech-to-speech).
//
// Run:  npm run dev   (console mode for local mic testing)
//       npm start     (connects to LiveKit to take real Telnyx calls)
// =============================================================================
import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  voice,
  llm,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { EndSensitivity, StartSensitivity } from '@google/genai';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { buildSystemPrompt } from './prompt.js';
import { checkClaim } from './compliance.js';
import { getPaymentProvider, isSandbox } from './payment.js';
import * as db from './db.js';

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log('[agent] connected to room', ctx.room.name);

    // -- Figure out who called and which campaign/profile applies --------------
    // For SIP inbound, the dialed (tracking) number arrives in room metadata or
    // the SIP participant attributes. We read it best-effort; fall back to default.
    const participant = await ctx.waitForParticipant();
    const attrs = participant.attributes ?? {};
    const dialedNumber =
      attrs['sip.trunkPhoneNumber'] || attrs['sip.toNumber'] || attrs['sip.to'] || '';
    const callerNumber =
      attrs['sip.phoneNumber'] || attrs['sip.fromNumber'] || attrs['sip.from'] || null;
    const isTest = ctx.room.name?.includes('test') ?? false;

    const tracking = dialedNumber ? await db.resolveTrackingNumber(dialedNumber) : null;
    const campaign = (tracking?.campaigns as Record<string, unknown> | undefined) ?? null;
    const campaignId = (campaign?.id as string) ?? null;
    const profileId = (campaign?.agent_profile_id as string) ?? null;

    const profile = await db.loadAgentProfile(profileId);

    // -- Create the call + contact rows ---------------------------------------
    const callId = await db.createCall({
      livekitRoom: ctx.room.name ?? 'unknown',
      campaignId,
      agentProfileId: profile?.id ?? null,
      trackingNumberId: (tracking?.id as string) ?? null,
      isTest,
    });

    const contactId = await db.upsertContact({
      phoneE164: callerNumber,
      campaignId,
      isTest,
    });
    if (callId && contactId) await db.linkCallContact(callId, contactId);

    // -- Build the system prompt ----------------------------------------------
    const systemPrompt = buildSystemPrompt({
      personaPrompt: profile?.system_prompt ?? 'You are a warm, professional inbound sales agent named Sarah.',
      productName: (campaign?.product_name as string) || profile?.name || 'our wellness product',
      discountCode: (campaign?.discount_code as string) ?? null,
      faq: Array.isArray(profile?.faq) ? profile.faq : [],
    });

    const greeting =
      profile?.greeting ||
      'Thanks for calling. This call may be recorded for quality, and you are speaking with an automated assistant. Who do I have the pleasure of speaking with today?';

    const voiceName = profile?.voice || 'Puck';

    // -- Track which Caleb step we've reached (for funnel analytics) ----------
    let reachedStep = 1;
    const touchStep = (s: number) => {
      if (s > reachedStep) {
        reachedStep = s;
        void db.updateCall(callId, { reached_step: reachedStep });
      }
    };

    // -- Define the tools the model can call ----------------------------------
    const tools: llm.ToolContext = {
      save_contact_details: llm.tool({
        description:
          'Save the caller\'s contact details as soon as you have collected them (Step 1). ' +
          'Call this even for callers who may not buy.',
        parameters: z.object({
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          email: z.string().optional(),
          address_line1: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          postal_code: z.string().optional(),
          discount_code: z.string().optional(),
        }),
        execute: async (args) => {
          touchStep(1);
          if (contactId) {
            await db.updateContact(contactId, {
              first_name: args.first_name,
              last_name: args.last_name,
              email: args.email,
              address_line1: args.address_line1,
              city: args.city,
              state: args.state,
              postal_code: args.postal_code,
            });
          }
          if (args.discount_code) await db.updateCall(callId, { discount_code: args.discount_code });
          return 'Contact details saved.';
        },
      }),

      save_probed_fear: llm.tool({
        description:
          'Record the specific health concern that made the caller phone in (Step 2). ' +
          'Used later to handle objections.',
        parameters: z.object({ concern: z.string() }),
        execute: async ({ concern }) => {
          touchStep(2);
          if (contactId) await db.updateContact(contactId, { probed_fear: concern });
          return 'Concern noted.';
        },
      }),

      begin_secure_payment: llm.tool({
        description:
          'Begin secure card capture when the caller agrees to buy (Step 8). The caller will ' +
          'enter their card on their phone keypad — you never hear or collect the number. ' +
          'Provide the chosen tier, whether they took the Plus upsell, and the total in dollars.',
        parameters: z.object({
          tier: z.enum(['platinum', 'gold', 'silver', 'bronze']),
          total_usd: z.number(),
          plus_upsell: z.boolean().default(false),
          plus_total_usd: z.number().optional(),
        }),
        execute: async (args) => {
          touchStep(8);
          const provider = getPaymentProvider();
          const descriptor = ((campaign?.product_name as string) || 'WELLNESS')
            .toUpperCase()
            .slice(0, 15);

          // 1) Capture a one-time token (DTMF leg in prod; simulated in sandbox).
          const { token } = await provider.captureCardToken({ callId: callId ?? 'local' });

          // 2) Charge the front-end order.
          const amountCents = Math.round(args.total_usd * 100);
          const orderId = await db.createOrder({
            contactId, callId, campaignId,
            kind: 'front_end', tier: args.tier, status: 'pending',
            amountCents, descriptor, isTest,
          });
          const result = await provider.charge({
            amountCents, cardToken: token, descriptor, orderRef: orderId ?? 'local',
          });

          if (!result.approved) {
            await db.updateCall(callId, {}); // no-op keepalive
            if (orderId) {
              await db.createOrder({
                contactId, callId, campaignId, kind: 'front_end', tier: args.tier,
                status: 'declined', amountCents, descriptor,
                declineReason: result.declineReason, isTest,
              });
            }
            await db.setContactFlag(contactId, 'card_declined', true);
            await db.emitEvent({
              contactId, callId, orderId, type: 'card_declined',
              payload: { reason: result.declineReason, amount_cents: amountCents },
            });
            return `The card was declined: ${result.declineReason}. Politely ask if they have a different card you can try.`;
          }

          // Approved — mark paid, promote to client, emit completion event.
          await db.createOrder({
            contactId, callId, campaignId, kind: 'front_end', tier: args.tier,
            status: 'paid', amountCents, descriptor, paymentToken: result.transactionId, isTest,
          });
          await db.setContactFlag(contactId, 'card_declined', false);
          await db.markClient(contactId);
          await db.emitEvent({
            contactId, callId, type: 'order_completed',
            payload: { kind: 'front_end', tier: args.tier, amount_cents: amountCents },
          });

          // Back-end (Plus upsell) as a separate order if taken.
          if (args.plus_upsell && args.plus_total_usd) {
            const plusCents = Math.round(args.plus_total_usd * 100);
            const plusOrder = await db.createOrder({
              contactId, callId, campaignId, kind: 'back_end', tier: args.tier,
              status: 'paid', amountCents: plusCents, descriptor,
              paymentToken: result.transactionId, isTest,
            });
            await db.emitEvent({
              contactId, callId, orderId: plusOrder, type: 'order_completed',
              payload: { kind: 'back_end', amount_cents: plusCents },
            });
          }

          await db.updateCall(callId, { outcome: 'sale' });
          touchStep(9);
          return `Payment approved. The statement descriptor is "${descriptor}". Now do Step 9: summarize the order and ask the caller to write down that descriptor so they recognize the charge.`;
        },
      }),

      transfer_to_human: llm.tool({
        description:
          'Transfer the caller to a human if they are confused, upset, repeatedly ask for a ' +
          'person, or have a medical question you cannot answer compliantly.',
        parameters: z.object({ reason: z.string() }),
        execute: async ({ reason }) => {
          await db.updateCall(callId, { outcome: 'transferred_human' });
          await db.emitEvent({ contactId, callId, type: 'transfer_requested', payload: { reason } });
          // NOTE: actual SIP transfer is wired in deployment (Phase 5). For now we
          // acknowledge and the agent should let the caller know.
          return 'Let the caller know you are connecting them to a team member who can help.';
        },
      }),
    };

    // -- Create the Gemini Live realtime model --------------------------------
    // Long-call stability config (adapted from production outbound setups):
    //  - contextWindowCompression: sliding window so 8-12 min Caleb-style calls
    //    don't hit the token ceiling and freeze mid-conversation.
    //  - realtimeInputConfig with LOW end-of-speech sensitivity + 2s silence: the
    //    agent won't cut off an older caller who pauses to think.
    //  (Session resumption is handled automatically by the Node plugin.)
    const model = new google.beta.realtime.RealtimeModel({
      apiKey: config.googleApiKey,
      model: config.geminiModel,
      voice: voiceName,
      instructions: systemPrompt,
      contextWindowCompression: {
        triggerTokens: '25600',
        slidingWindow: { targetTokens: '12800' },
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
          prefixPaddingMs: 200,
          silenceDurationMs: 2000,
        },
      },
    });

    const agent = new voice.Agent({
      instructions: systemPrompt,
      tools,
      llm: model,
    });

    const session = new voice.AgentSession({ llm: model });

    // Guardrail: log any compliance violation in agent speech for auditing.
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev: unknown) => {
      try {
        const item = ev as { item?: { role?: string; textContent?: string } };
        if (item?.item?.role === 'assistant' && item.item.textContent) {
          const check = checkClaim(item.item.textContent);
          if (!check.ok) {
            console.warn('[compliance] possible violation in agent speech:', check.violations);
            void db.emitEvent({
              contactId, callId, type: 'compliance_flag',
              payload: { violations: check.violations, text: item.item.textContent.slice(0, 200) },
            });
          }
        }
      } catch { /* best effort */ }
    });

    // -- Start the session ----------------------------------------------------
    await session.start({ agent, room: ctx.room });
    console.log(`[agent] session started (voice=${voiceName}, sandbox=${isSandbox()})`);

    // Greet the caller. With a speech-to-speech RealtimeModel there is no TTS
    // engine, so session.say() (text->TTS) is unavailable. Instead we ask the
    // realtime model to generate the greeting itself. The greeting carries a
    // compliance disclosure, so we instruct it to speak the wording verbatim.
    await session.generateReply({
      instructions: `Begin the call by saying the following greeting exactly, word for word, then stop and wait for the caller to respond:\n\n"${greeting}"`,
    });

    // -- On shutdown, finalize the call row -----------------------------------
    ctx.addShutdownCallback(async () => {
      await db.updateCall(callId, { ended_at: new Date().toISOString() });
      console.log('[agent] call ended', callId);
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
