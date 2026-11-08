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

/**
 * Scope Drift Radar Models
 */
export interface ScopeDriftGlobalMetrics {
  activeEngagementsCount: number;
  totalChangeRequestsCount: number;
  inScopeCount: number;
  outOfScopeCount: number;
  ambiguousCount: number;
  pendingProposalsCount: number;
  providerApprovedProposalsCount: number;
  clientAcceptedProposalsCount: number;
}

export interface CurrencyCommercialPipeline {
  currency: string;
  additionalProposedValue: number;
  formattedAdditionalProposedValue: string;
  providerApprovedValue: number;
  formattedProviderApprovedValue: string;
  clientAcceptedValue: number;
  formattedClientAcceptedValue: string;
  additionalInvoicedValue: number;
  formattedAdditionalInvoicedValue: string;
  additionalRevenueCollected: number;
  formattedAdditionalRevenueCollected: string;
  outstandingAdditionalPayments: number;
  formattedOutstandingAdditionalPayments: string;
}

export interface ProjectScopeIntelligence {
  projectId: string;
  projectName: string;
  clientName: string;
  currency: string;
  status: string;
  hasConfirmedBaseline: boolean;
  baselineDeliverablesCount: number;
  totalChangeRequests: number;
  classificationDistribution: {
    inScope: number;
    outOfScope: number;
    ambiguous: number;
  };
  unresolvedRequestsCount: number;
  pendingProposalsCount: number;
  acceptedChangesCount: number;
  additionalProposedValue: number;
  formattedAdditionalProposedValue: string;
  providerApprovedValue: number;
  formattedProviderApprovedValue: string;
  additionalAcceptedValue: number;
  formattedAdditionalAcceptedValue: string;
  additionalInvoicedValue: number;
  formattedAdditionalInvoicedValue: string;
  additionalCollectedValue: number;
  formattedAdditionalCollectedValue: string;
  outstandingPayments: number;
  formattedOutstandingPayments: string;
  lastActivityAt: string;
}

export type ScopeDriftAlertType =
  | "OUT_OF_SCOPE_WITHOUT_PROPOSAL"
  | "AMBIGUOUS_REQUIRING_REVIEW"
  | "PROPOSAL_AWAITING_CLIENT_ACCEPTANCE"
  | "ACCEPTED_PROPOSAL_WITHOUT_INVOICE"
  | "UNPAID_OR_OVERDUE_INVOICE"
  | "MULTIPLE_UNRESOLVED_CHANGE_REQUESTS";

export interface ScopeDriftAlert {
  id: string;
  type: ScopeDriftAlertType;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  rationale: string;
  projectId: string;
  projectName: string;
  resourceId?: string;
  href: string;
}

export interface ScopeDriftFilterInput {
  projectId?: string;
  dateRange?: "ALL" | "7D" | "30D" | "90D";
  classification?: "ALL" | "IN_SCOPE" | "OUT_OF_SCOPE" | "AMBIGUOUS";
  proposalStatus?: string;
  invoiceStatus?: string;
}

export interface ScopeDriftRadarData {
  globalMetrics: ScopeDriftGlobalMetrics;
  pipelineByCurrency: Record<string, CurrencyCommercialPipeline>;
  currencies: string[];
  projectIntelligence: ProjectScopeIntelligence[];
  driftAlerts: ScopeDriftAlert[];
}

export interface DashboardOverviewResponse {
  kpis: DashboardKpis;
  financialSummaries: Record<string, CurrencyFinancialSummary>;
  currencies: string[];
  actionRequiredItems: ActionRequiredItem[];
  recentProjects: ProjectCardSummary[];
  recentActivity: RecentActivityItem[];
  scopeDriftRadar?: ScopeDriftRadarData;
}
