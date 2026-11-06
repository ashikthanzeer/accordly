/**
 * PayPal Sandbox Integration Test Runner.
 *
 * Runs real, unmocked API calls against PayPal Sandbox:
 * 1. Authenticate (OAuth 2.0 Client Credentials)
 * 2. Create a test invoice
 * 3. Send the invoice
 * 4. Retrieve the invoice
 * 5. Display the actual response and status
 *
 * Usage:
 *   npx tsx scripts/test-paypal-sandbox.ts
 */

import dotenv from "dotenv";
dotenv.config();

import {
  isPayPalConfigured,
  getPayPalConfig,
  getPayPalAccessToken,
  createDraftInvoice,
  sendInvoice,
  getInvoice,
  PayPalApiError,
} from "../src/lib/paypal";

async function main() {
  console.log("=============================================================");
  console.log("  Accordly — PayPal Sandbox Integration Test Runner");
  console.log("=============================================================\n");

  const envSource = process.env;
  const configured = isPayPalConfigured(envSource);

  if (!configured) {
    console.error("❌ PayPal Sandbox credentials are not configured in .env\n");
    console.error("Current configuration status:");
    console.error(`  PAYPAL_ENV:           ${envSource.PAYPAL_ENV || "(unset, defaults to sandbox)"}`);
    console.error(`  PAYPAL_BASE_URL:      ${envSource.PAYPAL_BASE_URL || "(unset, defaults to https://api-m.sandbox.paypal.com)"}`);
    console.error(`  PAYPAL_CLIENT_ID:     ${envSource.PAYPAL_CLIENT_ID ? "[SET]" : "[MISSING]"}`);
    console.error(`  PAYPAL_CLIENT_SECRET: ${envSource.PAYPAL_CLIENT_SECRET ? "[SET]" : "[MISSING]"}`);
    console.error("\nInstructions to configure PayPal Sandbox credentials:");
    console.error("1. Log in to the PayPal Developer Dashboard: https://developer.paypal.com/dashboard/");
    console.error("2. Go to 'Apps & Credentials' and select the 'Sandbox' tab.");
    console.error("3. Create a new REST API app (or select an existing Sandbox app).");
    console.error("4. Copy the Client ID and Secret.");
    console.error("5. Open .env in your project root and update:");
    console.error("     PAYPAL_ENV=sandbox");
    console.error("     PAYPAL_CLIENT_ID=<your-sandbox-client-id>");
    console.error("     PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>");
    console.error("     PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com");
    console.error("6. Re-run this test: npm run test:paypal\n");
    console.error("Per AI Development Guardrails: Mocks are NOT fabricated as proof of integration.");
    process.exit(1);
  }

  const config = getPayPalConfig(envSource);
  console.log(`Environment: ${config.env.toUpperCase()}`);
  console.log(`Base URL:    ${config.baseUrl}`);
  console.log(`Client ID:   ${config.clientId.slice(0, 8)}...${config.clientId.slice(-4)}\n`);

  try {
    // -------------------------------------------------------------------------
    // Step 1: OAuth Authentication
    // -------------------------------------------------------------------------
    console.log("Step 1: Authenticating with PayPal Sandbox (OAuth 2.0)...");
    const t0 = Date.now();
    const tokenDetails = await (await import("../src/lib/paypal")).getPayPalTokenDetails(config);
    const token = tokenDetails.accessToken;
    const authDuration = Date.now() - t0;
    console.log(`  ✓ Token obtained successfully in ${authDuration}ms`);
    console.log(`  ✓ Token preview: ${token.slice(0, 10)}... (length: ${token.length})`);
    console.log(`  ✓ Granted Scopes: ${tokenDetails.scope || "(none listed)"}\n`);

    // -------------------------------------------------------------------------
    // Step 2: Create Test Invoice
    // -------------------------------------------------------------------------
    const testRecipient =
      process.env.TEST_PAYPAL_BUYER_EMAIL || "accordly-sandbox-buyer@example.com";
    const testAmount = "25.00";
    const testCurrency = "USD";
    const testTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const testInvoiceNumber = `TEST-${Date.now().toString().slice(-6)}`;

    console.log("Step 2: Creating a test invoice...");
    console.log(`  Recipient:   ${testRecipient}`);
    console.log(`  Amount:      ${testCurrency} ${testAmount}`);
    console.log(`  Invoice No:  ${testInvoiceNumber}`);

    const t1 = Date.now();
    const createdInvoice = await createDraftInvoice(
      {
        recipientEmail: testRecipient,
        description: `Accordly Sandbox Test Invoice — Created at ${testTimestamp}`,
        currency: testCurrency,
        amount: testAmount,
        invoiceNumber: testInvoiceNumber,
        note: "This is an automated test invoice for the Accordly platform verification.",
      },
      config
    );
    const createDuration = Date.now() - t1;

    console.log(`  ✓ Invoice created in ${createDuration}ms`);
    console.log(`  ✓ PayPal Invoice ID: ${createdInvoice.id}`);
    console.log(`  ✓ Status (Raw):     ${createdInvoice.rawStatus}`);
    console.log(`  ✓ Status (Norm):    ${createdInvoice.normalizedStatus}\n`);

    // -------------------------------------------------------------------------
    // Step 3: Send the Invoice
    // -------------------------------------------------------------------------
    console.log(`Step 3: Sending invoice ${createdInvoice.id}...`);
    const t2 = Date.now();
    const sendResult = await sendInvoice(
      createdInvoice.id,
      {
        sendToRecipient: true,
        subject: "Accordly Test Invoice Notification",
        note: "Thank you for participating in the Accordly Sandbox verification test.",
      },
      config
    );
    const sendDuration = Date.now() - t2;

    console.log(`  ✓ Invoice sent in ${sendDuration}ms`);
    console.log(`  ✓ Status after send (Raw):  ${sendResult.rawStatus}`);
    console.log(`  ✓ Status after send (Norm): ${sendResult.status}`);
    console.log(
      `  ✓ Hosted Invoice URL:       ${sendResult.recipientViewUrl || "(Not returned in direct send response)"}\n`
    );

    // -------------------------------------------------------------------------
    // Step 4: Retrieve the Invoice
    // -------------------------------------------------------------------------
    console.log(`Step 4: Retrieving invoice ${createdInvoice.id}...`);
    const t3 = Date.now();
    const retrievedInvoice = await getInvoice(createdInvoice.id, config);
    const getDuration = Date.now() - t3;

    console.log(`  ✓ Invoice retrieved in ${getDuration}ms`);
    console.log(`  ✓ PayPal Invoice ID:  ${retrievedInvoice.id}`);
    console.log(`  ✓ Status (Raw):       ${retrievedInvoice.rawStatus}`);
    console.log(`  ✓ Status (Norm):      ${retrievedInvoice.normalizedStatus}`);
    console.log(`  ✓ Total Amount:       ${retrievedInvoice.currency} ${retrievedInvoice.totalAmount}`);
    console.log(`  ✓ Due Amount:         ${retrievedInvoice.dueAmount ? `${retrievedInvoice.currency} ${retrievedInvoice.dueAmount}` : "N/A"}`);
    console.log(`  ✓ Recipient:          ${retrievedInvoice.recipientEmail || testRecipient}`);
    console.log(
      `  ✓ Hosted Invoice URL: ${retrievedInvoice.recipientViewUrl || "(None returned in metadata)"}\n`
    );

    // -------------------------------------------------------------------------
    // Step 5: Verification Summary
    // -------------------------------------------------------------------------
    console.log("=============================================================");
    console.log("  🎉 PayPal Sandbox Integration Test: ALL CHECKS PASSED");
    console.log("=============================================================");
    console.log(`PayPal Invoice ID:   ${retrievedInvoice.id}`);
    console.log(`Final Local Status:  ${retrievedInvoice.normalizedStatus}`);
    console.log(`Final Raw Status:    ${retrievedInvoice.rawStatus}`);
    console.log(`Payment Link:        ${retrievedInvoice.recipientViewUrl || "Viewable in Sandbox merchant/buyer dashboard"}`);
    console.log("=============================================================\n");
  } catch (err: unknown) {
    console.error("\n❌ Integration Test Failed!");
    if (err instanceof PayPalApiError) {
      console.error(`[PayPalApiError] Status: ${err.status} ${err.statusText}`);
      console.error(`Message: ${err.message}`);
      if (err.paypalDebugId) {
        console.error(`PayPal-Debug-Id: ${err.paypalDebugId}`);
      }
      if (err.details) {
        console.error("Details:", JSON.stringify(err.details, null, 2));
      }

      if (err.status === 403 || (typeof err.details === "object" && err.details !== null && "name" in err.details && (err.details as { name: string }).name === "NOT_AUTHORIZED")) {
        console.error("\n💡 How to resolve 'NOT_AUTHORIZED / Insufficient permissions' for Invoicing:");
        console.error("1. Open the PayPal Developer Dashboard: https://developer.paypal.com/dashboard/applications/sandbox");
        console.error("2. Click on the Sandbox App corresponding to your Client ID.");
        console.error("3. Verify that the 'Account' selected is a Sandbox Business Account (not Personal).");
        console.error("4. Scroll down to 'App Feature Options' and check the 'Invoicing' checkbox.");
        console.error("5. Click 'Save Changes' at the bottom.");
        console.error("6. Re-run: npm run test:paypal\n");
      }
    } else if (err instanceof Error) {
      console.error(`[Error] ${err.message}`);
      console.error(err.stack);
    } else {
      console.error("Unknown error:", err);
    }
    process.exit(1);
  }
}

main();

