export type RoleCode = 'ADMIN' | 'CBTD' | 'THAM_QUYEN' | 'QUAN_LY';

export type StageCode = 'TIEP_NHAN' | 'THAM_DINH' | 'CAP_TREN' | 'HOAN_TAT';

export type LoanStatus =
  | 'RECEIVED'
  | 'CHECKED'
  | 'SUPPLEMENT_REQUIRED'
  | 'PENDING_APPRAISAL'
  | 'WAITING_HEAD_OFFICE'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED_TIMEOUT';

export type LoanType = 'VAY_VON_LUU_DONG' | 'VAY_DAU_TU_TSCD' | 'THAU_CHI';

export type RiskLevel = 'THAP' | 'TRUNG_BINH' | 'CAO';

export type DocumentType = 'PHAP_LY' | 'TAI_CHINH' | 'PHUONG_AN' | 'TSBD' | 'KHAC';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  branchName: string;
  roles: RoleCode[];
}

export interface Company {
  id: string;
  taxCode: string;
  companyName: string;
  industry: string;
  establishedYear: number;
  annualRevenue: number | string;
  charterCapital: number | string;
  representativeName: string;
  phone: string;
  address: string;
}

export interface DelayPrediction {
  id: string;
  applicationId: string;
  riskLevel: RiskLevel;
  delayProbability: number;
  topReasonsJson?: string;
  topReasons?: string[];
  modelVersion: string;
  predictionTimestamp: string;
}

export interface WorkflowStageHistory {
  id: string;
  stageId: string;
  stage?: {
    stageCode: StageCode;
    stageName: string;
    standardSlaHours: number;
  };
  enteredAt: string;
  exitedAt?: string;
  actualDurationHours?: number;
  pausedAt?: string;
  pausedDurationHours: number;
  netWorkDurationHours?: number;
  slaStandardHours: number;
  isDelayed: boolean;
  notes?: string;
  handler?: {
    fullName: string;
    username: string;
  };
}

export interface DocumentItem {
  id: string;
  documentType: DocumentType;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  uploadedAt: string;
  uploader?: {
    fullName: string;
  };
}

export interface SupplementRequest {
  id: string;
  applicationId: string;
  requestContent: string;
  requestedAt: string;
  deadlineAt?: string;
  resolvedAt?: string;
  status: 'PENDING' | 'RESOLVED' | 'EXPIRED';
  notes?: string;
  requester?: {
    fullName: string;
    username: string;
  };
}

export interface ApplicationAssignment {
  id: string;
  reassignedAt: string;
  reason?: string;
  fromUser?: { fullName: string; username: string };
  toUser: { fullName: string; username: string };
  manager: { fullName: string; username: string };
}

export interface LoanApplication {
  id: string;
  applicationCode: string;
  companyId: string;
  company: Company;
  loanPurpose: string;
  loanType: LoanType;
  proposedAmount: number | string;
  officialAmount?: number | string;
  approvedAmount?: number | string;
  loanTermMonths: number;
  interestRate?: number | string;
  currentStage: StageCode;
  currentStatus: LoanStatus;
  assignedTo?: string;
  assignedUser?: {
    id: string;
    fullName: string;
    username: string;
    email?: string;
    phone?: string;
  };
  rejectionReasonCode?: string;
  rejectionNote?: string;
  isDocumentComplete: boolean;
  supplementCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  stageHistories?: WorkflowStageHistory[];
  documents?: DocumentItem[];
  supplementRequests?: SupplementRequest[];
  assignments?: ApplicationAssignment[];
  delayPredictions?: DelayPrediction[];
}

export interface OverviewStats {
  totalApplications: number;
  activeApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  timeoutApplications: number;
  totalCompletedStages: number;
  delayedStages: number;
  slaOnTimeRate: number;
  highRiskLoans: number;
}

export interface SlaBottleneck {
  stageCode: StageCode;
  stageName: string;
  standardSlaHours: number;
  totalHandled: number;
  delayedCount: number;
  delayRate: number;
  avgNetWorkHours: number;
  isBottleneck: boolean;
}

export interface EarlyWarningItem {
  id: string;
  applicationCode: string;
  companyName: string;
  industry: string;
  loanAmount: number;
  currentStage: StageCode;
  currentStatus: LoanStatus;
  supplementCount: number;
  assignedOfficer: string;
  assignedOfficerId?: string;
  riskLevel: RiskLevel;
  delayProbability: number;
  predictedAt: string | null;
  topReasons: string[];
}

export interface OfficerWorkload {
  id: string;
  fullName: string;
  username: string;
  phone?: string;
  branchName: string;
  roles: RoleCode[];
  activeLoanCount: number;
  highRiskLoanCount: number;
  workloadStatus: 'KHẢ DỤNG' | 'BẬN RỘN' | 'QUÁ TẢI';
}
