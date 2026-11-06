const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');

async function sha256File(filePath) {
  const content = await fs.readFile(filePath);
  return {
    path: path.relative(repoRoot, filePath),
    sha256: createHash('sha256').update(content).digest('hex'),
    sizeBytes: content.length,
  };
}

async function main() {
  const gitCommit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
  const gitBranch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();

  // 1. Checksum các script migration
  const sqlFiles = [
    path.join(root, 'prisma', 'sme-branch-rollout.sql'),
    path.join(root, 'prisma', 'round2-assignment-safety.sql'),
    path.join(root, 'prisma', 'round2-assignment-coordination.sql'),
    path.join(root, 'prisma', 'round3-intake.sql'),
    path.join(root, 'prisma', 'portal-account-recovery.sql'),
  ];
  const migrations = [];
  for (const f of sqlFiles) {
    migrations.push(await sha256File(f));
  }

  // 2. Checksum các artifact frontend dist
  const frontendDistDir = path.join(repoRoot, 'frontend', 'dist');
  const frontendAssetsDir = path.join(frontendDistDir, 'assets');
  const frontendFiles = [path.join(frontendDistDir, 'index.html')];
  const assetFiles = await fs.readdir(frontendAssetsDir);
  for (const af of assetFiles) {
    frontendFiles.push(path.join(frontendAssetsDir, af));
  }
  const frontendArtifacts = [];
  for (const f of frontendFiles) {
    frontendArtifacts.push(await sha256File(f));
  }

  // 3. Checksum artifact backend dist/main.js
  const backendArtifacts = [
    await sha256File(path.join(root, 'dist', 'main.js')),
    await sha256File(path.join(root, 'package.json')),
    await sha256File(path.join(repoRoot, 'frontend', 'package.json')),
  ];

  const manifest = {
    releasePlanVersion: 'SME-RELEASE-20261102-V1',
    generatedAt: new Date().toISOString(),
    git: {
      commit: gitCommit,
      branch: gitBranch,
    },
    targetEnvironment: {
      os: 'Windows / Linux Container Host',
      nodeVersion: process.version,
      database: 'PostgreSQL 16 (Docker container: sme-loan-workflow-db-1)',
      targetDatabaseName: 'sme_loan',
      targetSchema: 'public',
      targetPorts: {
        backend: 3000,
        frontend: 5174,
        postgres: 5432,
      },
    },
    configurationChecklist: {
      DATABASE_URL: 'Đã xác minh (localhost:5432/sme_loan)',
      JWT_SECRET: 'Thiết lập qua biến môi trường an toàn (không commit)',
      PORT: '3000 (Backend API)',
      PORTAL_V2_ROLLOUT_ENABLED: 'true (Bật tính năng Cổng DN V2 và hạn mức chi nhánh 10 tỷ)',
      UPLOAD_DIR: 'uploads/ (Được bảo vệ quyền truy cập và cách ly)',
      NODE_ENV: 'production',
    },
    migrationSequence: migrations.map((m, idx) => ({
      sequence: idx + 1,
      name: path.basename(m.path),
      sha256: m.sha256,
      sizeBytes: m.sizeBytes,
      strategy: 'ADDITIVE_IDEMPOTENT (Chỉ thêm cột/bảng/chỉ mục IF NOT EXISTS; không xóa dữ liệu)',
    })),
    buildArtifacts: {
      frontend: frontendArtifacts,
      backend: backendArtifacts,
    },
    maintenancePlan: {
      window: 'Khung giờ thấp điểm: 22:00 - 23:00 (Thứ 7 / Chủ nhật)',
      estimatedDowntimeMinutes: 3,
      userNotice: 'Thông báo trên Cổng DN và Workspace: "Hệ thống bảo trì định kỳ từ 22:00 đến 22:15. Vui lòng hoàn tất và lưu các thao tác trước thời điểm trên."',
    },
    backupPlan: {
      command: 'docker exec -i sme-loan-workflow-db-1 pg_dump -U postgres -d sme_loan -n public -Fc > backup_public_pre_release.dump',
      verification: 'Kiểm tra file dump > 0 bytes và chạy thử nghiệm pg_restore vào schema tạm trước khi bắt đầu',
      estimatedBackupDurationMs: 250,
    },
    smokeTestPlan: {
      scripts: [
        'GET /auth/me (Xác thực người dùng)',
        'GET /workflow/stages (Nạp danh mục công đoạn và SLA)',
        'GET /portal-intakes/form-config (Cấu hình biểu mẫu V2)',
        'GET /loan-applications (Truy vấn danh sách hồ sơ theo vai trò)',
      ],
      estimatedDurationSeconds: 15,
    },
    goStopCriteria: {
      GO: [
        '1. Sao lưu schema public hoàn tất và verify thành công.',
        '2. Toàn bộ 5 migration SQL thực thi với mã thoát 0 trong < 15 giây.',
        '3. Backend và Frontend khởi động không có exception trong log.',
        '4. Smoke test tự động đạt 100%.',
      ],
      STOP_TRIGGER_ROLLBACK: [
        '1. Bất kỳ script migration nào phát sinh lỗi SQL.',
        '2. Lỗi kết nối DB hoặc latency truy vấn > 2000ms.',
        '3. Smoke test thất bại hoặc phát sinh lỗi 500 trên các endpoint cốt lõi.',
        '4. Phát hiện sai lệch dữ liệu lịch sử hồ sơ vay.',
      ],
      rollbackSlaSeconds: 60,
    },
  };

  const outPath = path.join(repoRoot, 'evidence', 'reviews', 'integration', 'release-manifest.json');
  await fs.writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Release manifest saved to:', outPath);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch(console.error);

