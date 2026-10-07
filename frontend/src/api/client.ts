import {
  INITIAL_MOCK_LOANS,
  DEMO_USERS,
  DEMO_STATS,
  DEMO_BOTTLENECKS,
  DEMO_WORKLOADS,
} from '../mockData';
import { LoanApplication, User } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Lưu trữ mock loans trong memory để người dùng có thể test các thao tác thêm/sửa/chuyển trạng thái
let localLoans: LoanApplication[] = [...INITIAL_MOCK_LOANS];

export function getAuthToken(): string | null {
  return localStorage.getItem('sme_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('sme_token', token);
  } else {
    localStorage.removeItem('sme_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout để fallback mượt mà

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      return (await response.json()) as Promise<T>;
    }
  } catch {
    // Không kết nối được Backend -> Tự động kích hoạt Local Mock Fallback
  }

  // ==========================================
  // SMART LOCAL MOCK FALLBACK CHO DEMO
  // ==========================================
  console.log(`[Demo Fallback] Đang xử lý nội bộ cho endpoint: ${endpoint}`);

  // 1. Auth endpoints
  if (endpoint.includes('/auth/login')) {
    const body = options.body ? JSON.parse(options.body as string) : {};
    const u = DEMO_USERS[body.username] || DEMO_USERS['cbtd_nam'];
    return {
      accessToken: 'demo_jwt_token_123',
      user: u,
    } as any;
  }

  if (endpoint.includes('/auth/me')) {
    const savedUser = localStorage.getItem('sme_current_user');
    const u = savedUser ? JSON.parse(savedUser) : DEMO_USERS['cbtd_nam'];
    return u as any;
  }

  // 2. Loan applications
  if (endpoint.startsWith('/loan-applications')) {
    if (options.method === 'POST') {
      const body = options.body ? JSON.parse(options.body as string) : {};
      const newLoan: LoanApplication = {
        id: `loan-mock-${Date.now()}`,
        applicationCode: `SME-20260928-${String(localLoans.length + 1).padStart(4, '0')}`,
        companyId: `comp-${Date.now()}`,
        company: {
          id: `comp-${Date.now()}`,
          taxCode: body.taxCode,
          companyName: body.companyName,
          industry: body.industry,
          establishedYear: body.establishedYear,
          annualRevenue: body.annualRevenue,
          charterCapital: body.charterCapital,
          representativeName: body.representativeName,
          phone: body.phone,
          address: body.address,
        },
        loanPurpose: body.loanPurpose,
        loanType: body.loanType,
        proposedAmount: body.proposedAmount,
        officialAmount: body.proposedAmount,
        loanTermMonths: body.loanTermMonths,
        currentStage: 'TIEP_NHAN',
        currentStatus: 'CHECKED',
        assignedTo: 'user-cbtd-1',
        assignedUser: { id: 'user-cbtd-1', fullName: 'Nguyễn Văn Nam', username: 'cbtd_nam' },
        isDocumentComplete: false,
        supplementCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stageHistories: [
          {
            id: `hist-${Date.now()}`,
            stageId: 's1',
            enteredAt: new Date().toISOString(),
            actualDurationHours: 0.1,
            pausedDurationHours: 0,
            netWorkDurationHours: 0.1,
            slaStandardHours: 4,
            isDelayed: false,
            notes: 'Mới tiếp nhận hồ sơ',
            stage: { stageCode: 'TIEP_NHAN', stageName: 'Tiếp nhận hồ sơ', standardSlaHours: 4 },
          },
        ],
        documents: [],
        delayPredictions: [
          {
            id: `pred-${Date.now()}`,
            applicationId: `loan-mock-${Date.now()}`,
            riskLevel: body.proposedAmount > 10000000000 ? 'TRUNG_BINH' : 'THAP',
            delayProbability: body.proposedAmount > 10000000000 ? 0.45 : 0.08,
            topReasonsJson: JSON.stringify(['Hồ sơ mới khởi tạo trên hệ thống']),
            modelVersion: 'RandomForest-v1.0',
            predictionTimestamp: new Date().toISOString(),
          },
        ],
      };
      localLoans = [newLoan, ...localLoans];
      return newLoan as any;
    }

    // GET /loan-applications/:id
    const parts = endpoint.split('/');
    if (parts.length === 3 && parts[2]) {
      const found = localLoans.find((l) => l.id === parts[2]);
      if (found) return found as any;
    }

    return localLoans as any;
  }

  // 3. Workflow transitions
  if (endpoint.includes('/workflow/') && endpoint.includes('/transition')) {
    const parts = endpoint.split('/');
    const loanId = parts[2];
    const body = options.body ? JSON.parse(options.body as string) : {};
    const loan = localLoans.find((l) => l.id === loanId);
    if (loan) {
      loan.currentStage = body.targetStage;
      loan.currentStatus = body.targetStatus;
      if (body.approvedAmount) loan.approvedAmount = body.approvedAmount;
      if (body.interestRate) loan.interestRate = body.interestRate;
      if (body.rejectionReasonCode) loan.rejectionReasonCode = body.rejectionReasonCode;
      if (body.rejectionNote) loan.rejectionNote = body.rejectionNote;
      return loan as any;
    }
  }

  // 4. Supplements
  if (endpoint.startsWith('/supplements')) {
    if (options.method === 'POST') {
      const parts = endpoint.split('/');
      const loanId = parts[2];
      const body = options.body ? JSON.parse(options.body as string) : {};
      const loan = localLoans.find((l) => l.id === loanId);
      if (loan) {
        loan.supplementCount += 1;
        loan.currentStatus = 'SUPPLEMENT_REQUIRED';
        // Tăng xác suất rủi ro AI
        if (loan.delayPredictions && loan.delayPredictions.length > 0) {
          loan.delayPredictions[0].riskLevel = 'CAO';
          loan.delayPredictions[0].delayProbability = 0.85;
          loan.delayPredictions[0].topReasonsJson = JSON.stringify([
            `Hồ sơ đã yêu cầu bổ sung ${loan.supplementCount} lần (+35% nguy cơ)`,
            'Thời gian chờ hoàn thiện chứng từ kéo dài',
          ]);
        }
        return { message: 'Đã tạo yêu cầu bổ sung' } as any;
      }
    }
  }

  // 5. Dashboard
  if (endpoint.includes('/dashboard/overview')) {
    return DEMO_STATS as any;
  }
  if (endpoint.includes('/dashboard/sla-bottlenecks')) {
    return DEMO_BOTTLENECKS as any;
  }
  if (endpoint.includes('/dashboard/early-warnings')) {
    return localLoans.map((l) => ({
      id: l.id,
      applicationCode: l.applicationCode,
      companyName: l.company.companyName,
      industry: l.company.industry,
      loanAmount: Number(l.officialAmount || l.proposedAmount),
      currentStage: l.currentStage,
      currentStatus: l.currentStatus,
      supplementCount: l.supplementCount,
      assignedOfficer: l.assignedUser?.fullName || 'Chưa gán',
      assignedOfficerId: l.assignedTo,
      riskLevel: l.delayPredictions?.[0]?.riskLevel || 'THAP',
      delayProbability: l.delayPredictions?.[0]?.delayProbability || 0.05,
      predictedAt: l.delayPredictions?.[0]?.predictionTimestamp || null,
      topReasons: l.delayPredictions?.[0]?.topReasonsJson
        ? JSON.parse(l.delayPredictions[0].topReasonsJson)
        : ['Hồ sơ hoạt động ổn định'],
    })) as any;
  }

  // 6. Assignments
  if (endpoint.includes('/assignments/officer-workloads')) {
    return DEMO_WORKLOADS as any;
  }

  return [] as any;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
