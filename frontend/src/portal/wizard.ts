import type { PortalData } from './model';

export interface WizardIssue { path: string; step: number; message: string; severity: 'error' | 'warning' }

export function sameDraft(a: PortalData, b: PortalData): boolean {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y)).map(([key, item]) => [key, canonical(item)]));
    return value;
  }
  return JSON.stringify(canonical(normalizeV2(a))) === JSON.stringify(canonical(normalizeV2(b)));
}

/** Preserve partial rows and explicit zero/false. This never mutates editor state. */
export function normalizeV2(data: PortalData): PortalData {
  function clean(value: unknown): unknown {
    if (typeof value === 'string') return value.trim() || undefined;
    if (Array.isArray(value)) return value.map(clean).filter(item => item !== undefined);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]).filter(([, item]) => item !== undefined));
    return value;
  }
  return clean(data) as PortalData;
}

export function capitalTotals(data: PortalData): { totalCosts: number; ownFunds: number; otherFunds: number; bankAmount: number; totalSources: number; difference: number } {
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const plan = data.capitalPlan;
  const totalCosts = Array.isArray(plan?.costs) ? plan.costs.reduce((sum, cost) => sum + finite(cost?.amount), 0) : 0;
  const ownFunds = finite(plan?.ownFunds), otherFunds = finite(plan?.otherFunds), bankAmount = finite(data.proposedAmount);
  const totalSources = ownFunds + otherFunds + bankAmount;
  return { totalCosts, ownFunds, otherFunds, bankAmount, totalSources, difference: totalCosts - totalSources };
}

/** Draft validation is structural; review suggestions never activate pending policy. */
export function validateV2(input: PortalData, review = false): WizardIssue[] {
  const issues: WizardIssue[] = [];
  const add = (path: string, step: number, message: string, severity: WizardIssue['severity'] = 'error') => issues.push({ path, step, message, severity });
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  if (!object(input)) { add('data', 1, 'Biểu mẫu không hợp lệ.'); return issues; }
  const shape = (value: unknown, allowed: string[], path: string, step: number) => {
    if (!object(value)) { add(path, step, 'Cấu trúc dữ liệu không hợp lệ.'); return; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) add(path ? `${path}.${key}` : key, step, 'Trường dữ liệu không hỗ trợ.');
  };
  shape(input, ['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address','loanPurpose','loanType','proposedAmount','loanTermMonths','companyType','establishedDate','contactName','contactPosition','contactPhone','contactEmail','revenuePeriod','annualRevenueBasis','neededAt','preferredBranch','hasExistingDebt','collateral','capitalPlan'], '', 1);
  if(input.annualRevenueBasis!==undefined){shape(input.annualRevenueBasis,['documentId','fullYearCompleted'],'annualRevenueBasis',4);const basis=input.annualRevenueBasis;if(object(basis)){if(basis.documentId!==undefined&&(typeof basis.documentId!=='string'||!basis.documentId.trim()||basis.documentId.length>4000))add('annualRevenueBasis.documentId',4,'Chọn tài liệu nguồn hợp lệ.');if(basis.fullYearCompleted!==undefined&&typeof basis.fullYearCompleted!=='boolean')add('annualRevenueBasis.fullYearCompleted',4,'Xác nhận kỳ hoàn thành phải là có/không.');}}
  if (input.collateral !== undefined) shape(input.collateral, ['mode','description'], 'collateral', 2);
  if (input.capitalPlan !== undefined) {
    shape(input.capitalPlan, ['businessActivity','costs','ownFunds','otherFunds','otherFundsSource','useFrom','useTo','repaymentSource','recoveryDate'], 'capitalPlan', 3);
    const rawPlan = input.capitalPlan;
    if (object(rawPlan) && Array.isArray(rawPlan.costs)) rawPlan.costs.forEach((cost, index) => shape(cost, ['name','amount','plannedAt'], `capitalPlan.costs.${index}`, 3));
  }
  const data = normalizeV2(input);
  const supplied = (value: unknown) => value !== undefined;
  const text = (value: unknown, path: string, step: number) => { if (supplied(value) && (typeof value !== 'string' || !value.trim() || value.length > 4000)) add(path, step, 'Vui lòng nhập văn bản hợp lệ (tối đa 4.000 ký tự).'); };
  const date = (value: unknown, path: string, step: number): boolean => {
    if (!supplied(value)) return false;
    const parsed = typeof value === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(NaN);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) { add(path, step, 'Ngày không hợp lệ (YYYY-MM-DD).'); return false; }
    return true;
  };
  const money = (value: unknown, path: string, step: number, min = 0, max = 1e16, integer = false) => {
    if (supplied(value) && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value >= max || (integer && !Number.isInteger(value)))) add(path, step, 'Giá trị số không hợp lệ.');
  };
  for (const key of ['taxCode','companyName','companyType','industry','representativeName','address','contactName','contactPosition','contactPhone','contactEmail','phone'] as const) text(data[key], key, 1);
  for (const key of ['loanPurpose','loanType','preferredBranch'] as const) text(data[key], key, 2);
  money(data.establishedYear, 'establishedYear', 1, 1950, new Date().getFullYear() + 1, true);
  money(data.annualRevenue, 'annualRevenue', 1, 0, Number.MAX_SAFE_INTEGER + 1);
  money(data.charterCapital, 'charterCapital', 1, 0, Number.MAX_SAFE_INTEGER + 1);
  money(data.proposedAmount, 'proposedAmount', 2, 10000000, Number.MAX_SAFE_INTEGER + 1);
  money(data.loanTermMonths, 'loanTermMonths', 2, 1, 121, true);
  if (data.taxCode !== undefined && (typeof data.taxCode !== 'string' || !/^(\d{10}|\d{13})$/.test(data.taxCode))) add('taxCode', 1, 'Mã số thuế phải gồm 10 hoặc 13 chữ số.');
  for (const key of ['phone','contactPhone'] as const) if (data[key] !== undefined && (typeof data[key] !== 'string' || !/^[+\d][\d\s().-]{7,19}$/.test(data[key]))) add(key, 1, 'Số điện thoại không hợp lệ.');
  if (data.contactEmail !== undefined && (typeof data.contactEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail))) add('contactEmail', 1, 'Email không hợp lệ.');
  if (data.loanType !== undefined && !['VAY_VON_LUU_DONG','VAY_DAU_TU_TSCD','THAU_CHI'].includes(data.loanType)) add('loanType', 2, 'Vui lòng chọn loại vay hợp lệ.');
  if (data.revenuePeriod !== undefined && (typeof data.revenuePeriod !== 'string' || !/^(?!0000)\d{4}(?:-(?:0[1-9]|1[0-2]|Q[1-4]))?$/.test(data.revenuePeriod))) add('revenuePeriod', 1, 'Kỳ doanh thu dùng YYYY, YYYY-MM hoặc YYYY-Q1 đến Q4.');
  if (date(data.establishedDate, 'establishedDate', 1) && data.establishedYear !== undefined && Number(data.establishedDate!.slice(0, 4)) !== data.establishedYear) add('establishedYear', 1, 'Năm và ngày thành lập chưa khớp nhau.');
  date(data.neededAt, 'neededAt', 2);
  if (data.hasExistingDebt !== undefined && typeof data.hasExistingDebt !== 'boolean') add('hasExistingDebt', 2, 'Vui lòng chọn thông tin dư nợ hợp lệ.');
  if (data.collateral !== undefined) {
    if (!object(data.collateral)) add('collateral', 2, 'Thông tin bảo đảm không hợp lệ.');
    else {
      if (data.collateral.mode !== undefined && !['PROPOSED','NONE_REQUESTED','UNDECIDED'].includes(data.collateral.mode)) add('collateral.mode', 2, 'Lựa chọn bảo đảm không hợp lệ.');
      text(data.collateral.description, 'collateral.description', 2);
    }
  }
  if (data.capitalPlan !== undefined) {
    const plan = data.capitalPlan;
    if (!object(plan)) add('capitalPlan', 3, 'Kế hoạch vốn không hợp lệ.');
    else {
      for (const key of ['businessActivity','otherFundsSource','repaymentSource'] as const) text(plan[key], `capitalPlan.${key}`, 3);
      for (const key of ['ownFunds','otherFunds'] as const) money(plan[key], `capitalPlan.${key}`, 3);
      const fromValid = date(plan.useFrom, 'capitalPlan.useFrom', 3), toValid = date(plan.useTo, 'capitalPlan.useTo', 3);
      date(plan.recoveryDate, 'capitalPlan.recoveryDate', 3);
      if (fromValid && toValid && plan.useFrom! > plan.useTo!) add('capitalPlan.useTo', 3, 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu sử dụng vốn.');
      if (plan.costs !== undefined) {
        if (!Array.isArray(plan.costs) || plan.costs.length > 100) add('capitalPlan.costs', 3, 'Bảng chi phí phải có tối đa 100 dòng.');
        else plan.costs.forEach((cost, index) => {
          const path = `capitalPlan.costs.${index}`;
          if (!object(cost)) { add(path, 3, 'Dòng chi phí không hợp lệ.'); return; }
          text(cost.name, `${path}.name`, 3); money(cost.amount, `${path}.amount`, 3); date(cost.plannedAt, `${path}.plannedAt`, 3);
        });
      }
      const totals = capitalTotals(data);
      if (totals.difference !== 0) add('capitalPlan', 3, 'Tổng chi phí và tổng nguồn vốn chưa cân đối. Có thể lưu nháp để bổ sung.', 'warning');
    }
  }
  if (review) {
    for (const [key, step, label] of [['companyName',1,'tên doanh nghiệp'],['taxCode',1,'mã số thuế'],['contactName',1,'người liên hệ'],['contactPhone',1,'điện thoại liên hệ'],['contactEmail',1,'email liên hệ'],['loanPurpose',2,'mục đích vay'],['proposedAmount',2,'số tiền đề nghị vay'],['loanTermMonths',2,'thời hạn vay']] as const) {
      if (data[key] === undefined) add(key, step, `Gợi ý bổ sung ${label}; đây chưa phải yêu cầu bắt buộc đã được duyệt.`, 'warning');
    }
  }
  return issues;
}
