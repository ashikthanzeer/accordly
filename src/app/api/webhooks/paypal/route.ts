import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  extractPayPalWebhookHeaders,
  extractWebhookInvoiceId,
  verifyWebhookSignature,
} from "@/lib/paypal/webhooks";
import { reconcileInvoiceFromWebhook } from "@/lib/paypal/reconciliation";

/**
 * POST /api/webhooks/paypal
 * Secure endpoint for receiving and verifying PayPal webhook events.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Extract and validate required transmission headers
    const headerResult = extractPayPalWebhookHeaders(req.headers);
    if (!headerResult.valid || !headerResult.headers) {
      return NextResponse.json(
        { error: headerResult.error || "Missing required PayPal transmission headers." },
        { status: 400 }
      );
    }

    // 2. Read and parse raw body
    const rawBody = await req.text();
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON webhook payload." },
        { status: 400 }
      );
    }

    const paypalEventId = event?.id?.trim();
    const eventType = event?.event_type?.trim();

    if (!paypalEventId || !eventType) {
      return NextResponse.json(
        { error: "Payload missing required event id or event_type." },
        { status: 400 }
      );
    }

    // 3. Idempotency Check: Prevent duplicate event processing
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { paypalEventId },
    });

    if (existingEvent) {
      return NextResponse.json(
        {
          status: "duplicate",
          message: "Event has already been recorded and processed.",
          eventId: paypalEventId,
        },
        { status: 200 }
      );
    }

    // 4. Cryptographic Signature Verification with PayPal
    let verification;
    try {
      verification = await verifyWebhookSignature(headerResult.headers, event);
    } catch (err: unknown) {
      console.error("PayPal webhook verification exception:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Verification error" },
        { status: 500 }
      );
    }

    const resourceId = extractWebhookInvoiceId(event);

    if (!verification.verified) {
      // Record failed verification attempt for security audit
      await prisma.webhookEvent.create({
        data: {
          paypalEventId,
          eventType,
          resourceId,
          verificationStatus: "INVALID",
          processingStatus: "FAILED",
          safePayload: {
            id: event.id,
            event_type: event.event_type,
            summary: event.summary,
            verificationError: verification.error,
          },
        },
      }).catch(() => null);

      return NextResponse.json(
        { error: "Webhook signature verification failed." },
        { status: 400 }
      );
    }

    // 5. Persist verified event
    const savedEvent = await prisma.webhookEvent.create({
      data: {
        paypalEventId,
        eventType,
        resourceId,
        verificationStatus: "VERIFIED",
        processingStatus: "PROCESSING",
        safePayload: event,
      },
    });

    // 6. Trigger Authoritative Reconciliation against PayPal API
    const reconciliation = await reconcileInvoiceFromWebhook(event, savedEvent.id);

    return NextResponse.json(
      {
        status: "success",
        eventId: paypalEventId,
        reconciled: reconciliation.success,
        reconciledStatus: reconciliation.reconciledStatus,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Unhandled error in PayPal webhook handler:", error);
    return NextResponse.json(
      { error: "Internal server error processing webhook." },
      { status: 500 }
    );
  }
}

