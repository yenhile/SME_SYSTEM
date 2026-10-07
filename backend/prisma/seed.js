// backend/prisma/seed.js
const { PrismaClient, RoleCode, LoanType, StageCode, LoanStatus, DocumentType, RiskLevel, SupplementStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- KHỞI ĐỘNG SEED DỮ LIỆU CƠ SỞ CHO SME LOAN WORKFLOW ---');

  // 1. Tạo danh mục Roles
  console.log('1. Khởi tạo danh mục Roles...');
  const rolesData = [
    { code: RoleCode.ADMIN, name: 'Quản trị viên hệ thống', description: 'Toàn quyền cấu hình người dùng, phân quyền và danh mục' },
    { code: RoleCode.CBTD, name: 'Cán bộ tín dụng', description: 'Tiếp nhận, kiểm tra hồ sơ, yêu cầu bổ sung và quản lý hồ sơ phụ trách' },
    { code: RoleCode.THAM_QUYEN, name: 'Cán bộ thẩm quyền', description: 'Thẩm định hồ sơ, đánh giá rủi ro và ra quyết định phê duyệt/từ chối' },
    { code: RoleCode.QUAN_LY, name: 'Quản lý chi nhánh', description: 'Giám sát tiến độ SLA toàn chi nhánh, xem cảnh báo AI và điều chuyển hồ sơ' },
  ];

  const roles = {};
  for (const r of rolesData) {
    roles[r.code] = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: r,
    });
  }

  // 2. Tạo danh mục Workflow Stages (Định mức SLA chuẩn)
  console.log('2. Khởi tạo các công đoạn Workflow & SLA định mức...');
  const stagesData = [
    { stageCode: StageCode.TIEP_NHAN, stageName: 'Tiếp nhận & Kiểm tra hồ sơ', standardSlaHours: 4, orderIndex: 1 },
    { stageCode: StageCode.THAM_DINH, stageName: 'Thẩm định hồ sơ & Năng lực rủi ro', standardSlaHours: 24, orderIndex: 2 },
    { stageCode: StageCode.CAP_TREN, stageName: 'Trình cấp trên phê duyệt (> 10 tỷ)', standardSlaHours: 48, orderIndex: 3 },
    { stageCode: StageCode.HOAN_TAT, stageName: 'Hoàn tất & Phê duyệt giải ngân', standardSlaHours: 8, orderIndex: 4 },
  ];

  const stages = {};
  for (const s of stagesData) {
    stages[s.stageCode] = await prisma.workflowStage.upsert({
      where: { stageCode: s.stageCode },
      update: { stageName: s.stageName, standardSlaHours: s.standardSlaHours, orderIndex: s.orderIndex },
      create: s,
    });
  }

  // 3. Khởi tạo tài khoản người dùng mẫu cho 4 Actor
  console.log('3. Khởi tạo tài khoản mẫu cho 4 Actor...');
  const usersData = [
    {
      username: 'admin',
      password: 'Admin@123',
      fullName: 'Quản trị viên Hệ thống',
      email: 'admin@bank.com.vn',
      phone: '0901000001',
      role: RoleCode.ADMIN,
    },
    {
      username: 'cbtd_nam',
      password: 'Cbtd@123',
      fullName: 'Nguyễn Văn Nam',
      email: 'nam.nv@bank.com.vn',
      phone: '0901000002',
      role: RoleCode.CBTD,
    },
    {
      username: 'cbtd_huong',
      password: 'Cbtd@123',
      fullName: 'Trần Thu Hương',
      email: 'huong.tt@bank.com.vn',
      phone: '0901000003',
      role: RoleCode.CBTD,
    },
    {
      username: 'risk_quang',
      password: 'Risk@123',
      fullName: 'Lê Minh Quang',
      email: 'quang.lm@bank.com.vn',
      phone: '0901000004',
      role: RoleCode.THAM_QUYEN,
    },
    {
      username: 'manager_dung',
      password: 'Manager@123',
      fullName: 'TS. Ngô Hữu Dũng',
      email: 'dung.nh@bank.com.vn',
      phone: '0901000005',
      role: RoleCode.QUAN_LY,
    },
  ];

  const users = {};
  for (const u of usersData) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password, salt);

    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        passwordHash,
      },
      create: {
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        branchName: 'Chi nhánh TP. Hồ Chí Minh',
      },
    });
    users[u.username] = user;

    // Gán Role
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: roles[u.role].id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: roles[u.role].id,
      },
    });
  }

  // 4. Khởi tạo danh mục Doanh nghiệp SME mẫu
  console.log('4. Khởi tạo Doanh nghiệp SME mẫu...');
  const companiesData = [
    {
      taxCode: '0314567890',
      companyName: 'Công ty TNHH Sản Xuất May Mặc An Phú',
      industry: 'Sản xuất dệt may',
      establishedYear: 2018,
      annualRevenue: 28500000000, // 28.5 tỷ
      charterCapital: 10000000000, // 10 tỷ
      representativeName: 'Phạm Văn An',
      phone: '02838123456',
      address: 'Khu công nghiệp Tân Bình, Quận Tân Phú, TP.HCM',
    },
    {
      taxCode: '0317891234',
      companyName: 'Công ty Cổ phần Cơ Khí & Xây Dựng Nam Thành',
      industry: 'Xây dựng công trình',
      establishedYear: 2016,
      annualRevenue: 45000000000, // 45 tỷ
      charterCapital: 18000000000, // 18 tỷ
      representativeName: 'Nguyễn Thành Nam',
      phone: '02837654321',
      address: 'Đường Nguyễn Thị Thập, Quận 7, TP.HCM',
    },
    {
      taxCode: '0319876543',
      companyName: 'Công ty TNHH Nông Sản & Thực Phẩm Xanh',
      industry: 'Chế biến & Xuất khẩu nông sản',
      establishedYear: 2015,
      annualRevenue: 85000000000, // 85 tỷ
      charterCapital: 25000000000, // 25 tỷ
      representativeName: 'Lê Thị Thu Xanh',
      phone: '02839988776',
      address: 'Xã Tân Nhựt, Huyện Bình Chánh, TP.HCM',
    },
    {
      taxCode: '0316543210',
      companyName: 'Công ty TNHH Thương Mại & Vận Tải Đông Á',
      industry: 'Vận tải hàng hóa & Kho bãi',
      establishedYear: 2021,
      annualRevenue: 15200000000, // 15.2 tỷ
      charterCapital: 6000000000,  // 6 tỷ
      representativeName: 'Hoàng Văn Đông',
      phone: '02835556677',
      address: 'Phường Linh Trung, TP. Thủ Đức, TP.HCM',
    },
  ];

  const companies = {};
  for (const c of companiesData) {
    companies[c.taxCode] = await prisma.company.upsert({
      where: { taxCode: c.taxCode },
      update: c,
      create: c,
    });
  }

  // 5. Khởi tạo Hồ sơ Vay mẫu trải đều các trạng thái
  console.log('5. Khởi tạo Hồ sơ Vay mẫu...');

  // Hồ sơ 1: An Phú - Vay 3.5 tỷ (ĐÃ_PHÊ_DUYỆT)
  const app1 = await prisma.loanApplication.upsert({
    where: { applicationCode: 'SME-20260901-0001' },
    update: {},
    create: {
      applicationCode: 'SME-20260901-0001',
      companyId: companies['0314567890'].id,
      loanPurpose: 'Bổ sung vốn lưu động thu mua nguyên phụ liệu may mặc phục vụ đơn hàng quý 4',
      loanType: LoanType.VAY_VON_LUU_DONG,
      proposedAmount: 3500000000,
      officialAmount: 3500000000,
      approvedAmount: 3500000000,
      loanTermMonths: 12,
      interestRate: 8.5,
      currentStage: StageCode.HOAN_TAT,
      currentStatus: LoanStatus.APPROVED,
      assignedTo: users['cbtd_nam'].id,
      isDocumentComplete: true,
      supplementCount: 0,
      createdAt: new Date('2026-09-01T08:30:00Z'),
      completedAt: new Date('2026-09-03T16:00:00Z'),
    },
  });

  // Hồ sơ 2: Nam Thành - Vay 8 tỷ (ĐANG CHỜ THẨM ĐỊNH - CÓ CẢNH BÁO AI NGUY CƠ TRỄ HẠN CAO)
  const app2 = await prisma.loanApplication.upsert({
    where: { applicationCode: 'SME-20260915-0002' },
    update: {},
    create: {
      applicationCode: 'SME-20260915-0002',
      companyId: companies['0317891234'].id,
      loanPurpose: 'Mua sắm dây chuyền máy cắt laser kim loại tấm và xe cẩu công trình',
      loanType: LoanType.VAY_DAU_TU_TSCD,
      proposedAmount: 8000000000,
      officialAmount: 8000000000,
      loanTermMonths: 60,
      currentStage: StageCode.THAM_DINH,
      currentStatus: LoanStatus.PENDING_APPRAISAL,
      assignedTo: users['cbtd_huong'].id,
      isDocumentComplete: true,
      supplementCount: 2, // Đã bổ sung 2 lần
      createdAt: new Date('2026-09-15T09:00:00Z'),
    },
  });

  // Gán cảnh báo AI cho Hồ sơ 2
  await prisma.delayPrediction.create({
    data: {
      applicationId: app2.id,
      riskLevel: RiskLevel.CAO,
      delayProbability: 0.84, // 84% xác suất trễ
      topReasonsJson: JSON.stringify([
        'Hồ sơ đã yêu cầu bổ sung 2 lần (+35% nguy cơ)',
        'Cán bộ thẩm quyền đang phụ trách 12 hồ sơ cùng lúc (+26% quá tải)',
        'Khoản vay đầu tư TSCĐ quy mô lớn thuộc ngành xây dựng (+23% độ phức tạp)',
      ]),
      modelVersion: 'v1.0-rf',
    },
  });

  // Hồ sơ 3: Thực Phẩm Xanh - Vay 15 tỷ (> 10 tỷ: CHỜ PHẢN HỒI TỪ CẤP TRÊN)
  await prisma.loanApplication.upsert({
    where: { applicationCode: 'SME-20260920-0003' },
    update: {},
    create: {
      applicationCode: 'SME-20260920-0003',
      companyId: companies['0319876543'].id,
      loanPurpose: 'Mở rộng nhà máy kho lạnh bảo quản trái cây sấy dẻo xuất khẩu Châu Âu',
      loanType: LoanType.VAY_VON_LUU_DONG,
      proposedAmount: 15000000000, // 15 tỷ > 10 tỷ
      officialAmount: 15000000000,
      loanTermMonths: 24,
      currentStage: StageCode.CAP_TREN,
      currentStatus: LoanStatus.WAITING_HEAD_OFFICE,
      assignedTo: users['cbtd_nam'].id,
      isDocumentComplete: true,
      supplementCount: 1,
      createdAt: new Date('2026-09-20T10:00:00Z'),
    },
  });

  // Hồ sơ 4: Vận Tải Đông Á - Vay 2 tỷ (ĐANG CHỜ DOANH NGHIỆP BỔ SUNG CHỨNG TỪ - TẠM DỪNG SLA)
  const app4 = await prisma.loanApplication.upsert({
    where: { applicationCode: 'SME-20260925-0004' },
    update: {},
    create: {
      applicationCode: 'SME-20260925-0004',
      companyId: companies['0316543210'].id,
      loanPurpose: 'Cấp hạn mức thấu chi tài khoản thanh toán chi trả phí cầu đường & xăng dầu',
      loanType: LoanType.THAU_CHI,
      proposedAmount: 2000000000,
      loanTermMonths: 12,
      currentStage: StageCode.TIEP_NHAN,
      currentStatus: LoanStatus.SUPPLEMENT_REQUIRED,
      assignedTo: users['cbtd_huong'].id,
      isDocumentComplete: false,
      supplementCount: 1,
      createdAt: new Date('2026-09-25T14:30:00Z'),
    },
  });

  // Ghi nhận yêu cầu bổ sung cho Hồ sơ 4
  await prisma.supplementRequest.create({
    data: {
      applicationId: app4.id,
      requestContent: 'Yêu cầu cung cấp Báo cáo tài chính năm 2025 có kiểm toán và Sao kê tài khoản ngân hàng chính 6 tháng gần nhất có mộc ngân hàng.',
      requestedBy: users['cbtd_huong'].id,
      deadlineAt: new Date('2026-10-02T17:00:00Z'),
      status: SupplementStatus.PENDING,
    },
  });

  console.log('--- SEED DỮ LIỆU THÀNH CÔNG VÀ HOÀN TẤT ---');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
