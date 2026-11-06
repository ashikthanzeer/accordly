/**
 * Live PayPal Sandbox Proposal-to-Invoice Integration Runner.
 *
 * Verifies that structured proposal line items are converted into a real
 * multi-item invoice in PayPal Sandbox, drafted, sent, and retrieved.
 *
 * Usage:
 *   npx tsx scripts/test-paypal-proposal-invoice.ts
 */

import dotenv from "dotenv";
dotenv.config();

import {
  isPayPalConfigured,
  getPayPalConfig,
  mapProposalToPayPalInvoice,
  createDraftInvoice,
  sendInvoice,
  getInvoice,
} from "../src/lib/paypal";

async function main() {
  console.log("=============================================================");
  console.log("  Accordly — Live Proposal-to-PayPal Invoice Verification");
  console.log("=============================================================\n");

  if (!isPayPalConfigured(process.env)) {
    console.error("❌ PayPal Sandbox credentials are not configured in .env");
    process.exit(1);
  }

  const config = getPayPalConfig(process.env);
  console.log(`Environment: ${config.env.toUpperCase()}`);
  console.log(`Base URL:    ${config.baseUrl}\n`);

  const mockProject = {
    id: "proj_live_test",
    name: "Accordly Invoicing Live Test Project",
    clientName: "Sandbox Client Corporation",
    clientEmail: "accordly-sandbox-buyer@example.com",
  };

  const invoiceNumber = `PROP-${Math.floor(100000 + Math.random() * 900000)}`;

  const mockProposal = {
    id: `prop_${Date.now()}`,
    projectId: "proj_live_test",
    version: 1,
    status: "CLIENT_ACCEPTED",
    amount: "750.00",
    currency: "USD",
    description: "Cloud Architecture Security Review & Audit",
    deliverables: {
      pricing: {
        model: "ITEMIZED",
        currency: "USD",
        total: 750,
        lineItems: [
          {
            id: "li_audit",
            description: "Security Architecture Assessment",
            quantity: 3,
            unitPrice: 150,
            subtotal: 450,
            currency: "USD",
          },
          {
            id: "li_report",
            description: "Remediation Playbook & Executive Report",
            quantity: 2,
            unitPrice: 150,
            subtotal: 300,
            currency: "USD",
          },
        ],
      },
    },
    invoices: [],
  };

  console.log("Step 1: Mapping accepted proposal into PayPal draft payload...");
  const { input, preview } = mapProposalToPayPalInvoice(mockProposal, mockProject, {
    invoiceNumber,
    note: "Thank you for approving this change order. Payment terms: Net 15.",
  });

  console.log(`  ✓ Recipient:      ${input.recipientEmail}`);
  console.log(`  ✓ Currency:       ${input.currency}`);
  console.log(`  ✓ Total Amount:   ${input.amount}`);
  console.log(`  ✓ Line items:     ${input.items?.length} items`);
  input.items?.forEach((item, idx) => {
    console.log(`      [${idx + 1}] ${item.name} (${item.quantity} × ${item.unitAmount})`);
  });

  console.log("\nStep 2: Creating draft invoice on PayPal Sandbox API...");
  const draft = await createDraftInvoice(input, config);
  console.log(`  ✓ PayPal Invoice ID: ${draft.id}`);
  console.log(`  ✓ Status:            ${draft.normalizedStatus} (Raw: ${draft.rawStatus})`);

  console.log(`\nStep 3: Sending invoice ${draft.id} via PayPal Sandbox...`);
  const sent = await sendInvoice(draft.id, { sendToRecipient: true }, config);
  console.log(`  ✓ Status after send: ${sent.status} (Raw: ${sent.rawStatus})`);
  console.log(`  ✓ Recipient URL:     ${sent.recipientViewUrl || "N/A"}`);

  console.log(`\nStep 4: Retrieving authoritative invoice from PayPal Sandbox...`);
  const retrieved = await getInvoice(draft.id, config);
  console.log(`  ✓ Invoice ID:        ${retrieved.id}`);
  console.log(`  ✓ Total Amount:      ${retrieved.currency} ${retrieved.totalAmount}`);
  console.log(`  ✓ Normalized Status: ${retrieved.normalizedStatus}`);
  console.log(`  ✓ Hosted View URL:   ${retrieved.recipientViewUrl}`);

  console.log("\n=============================================================");
  console.log("  🎉 Live Proposal-to-Invoice Workflow Test Passed!");
  console.log("=============================================================");
  console.log(`Live PayPal Invoice ID: ${retrieved.id}`);
  console.log(`Hosted Invoice URL:     ${retrieved.recipientViewUrl}`);
  console.log("=============================================================\n");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

