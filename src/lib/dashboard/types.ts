/**
 * Dashboard & Financial Aggregation domain models.
 */

export interface CurrencyFinancialSummary {
  currency: string;
  totalInvoiced: number;
  formattedTotalInvoiced: string;
  totalCollected: number;
  formattedTotalCollected: string;
  outstandingBalance: number;
  formattedOutstandingBalance: string;
  invoiceCount: number;
  paidCount: number;
  partiallyPaidCount: number;
  sentCount: number;
}

export interface DashboardKpis {
  activeProjectsCount: number;
  pendingApprovalsCount: number;
  outstandingInvoicesCount: number;
  totalProjectsCount: number;
}

export type ActionItemType =
  | "UNCONFIRMED_BASELINE"
  | "PENDING_REQUEST_REVIEW"
  | "UNSHARED_PROPOSAL"
  | "AWAITING_CLIENT_DECISION"
  | "UNINVOICED_ACCEPTED_PROPOSAL"
  | "INVOICE_AWAITING_PAYMENT";

export interface ActionRequiredItem {
  id: string;
  type: ActionItemType;
  title: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  projectId: string;
  projectName: string;
  entityId?: string;
  href: string;
  createdAt?: string | Date;
}

export interface RecentActivityItem {
  id: string;
  projectId: string;
  projectName: string;
  actorType: "PROVIDER" | "CLIENT" | "SYSTEM" | "PAYPAL" | string;
  eventType: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
  formattedTime: string;
}

export interface ProjectCardSummary {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  status: string;
  hasConfirmedBaseline: boolean;
  requestsCount: number;
  proposalsCount: number;
  activeInvoice?: {
    paypalInvoiceId: string;
    status: string;
    amount: string;
    currency: string;
  } | null;
  lastActivityAt: string;
}

export interface DashboardOverviewResponse {
  kpis: DashboardKpis;
  financialSummaries: Record<string, CurrencyFinancialSummary>;
  currencies: string[];
  actionRequiredItems: ActionRequiredItem[];
  recentProjects: ProjectCardSummary[];
  recentActivity: RecentActivityItem[];
}

