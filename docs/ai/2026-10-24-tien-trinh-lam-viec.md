# Nhật ký tiến trình làm việc — Nhóm A và Nhóm B (24–25/10/2026)

> **Cập nhật 30/10/2026 — đọc trước:** công việc hiện tại là **SLA PA1** (HANDOVER_v2.1.md, mục C.9). Trạng thái, kiểm chứng, giới hạn và cách mở phiên nghiệm thu nằm ở **C.9.8** trong HANDOVER; bản nhật ký này chỉ còn giá trị lịch sử. Mục 10 bên dưới (phương án B của Thẩm quyền) **đã được làm xong và nằm trong `main`**, không còn là việc đang dở. Báo cáo lỗi nghiệp vụ gửi PO ở `docs/ai/2026-10-30-bao-cao-loi-nghiep-vu-cho-PO.md`. Nhánh `YenTrang` đã trùng `origin/main` (`206fa39`); các thay đổi SLA PA1 vẫn **chưa commit**.

Ghi lại những gì đã làm trong phiên làm việc với AI trên nhánh `YenTrang`, để người tiếp nhận sau (hoặc phiên AI mới) nắm được hiện trạng mà không phải đọc lại hội thoại. Nguồn kế hoạch: [HANDOVER_v2.1.md](../handover/HANDOVER_v2.1.md). Không chứa mật khẩu hay secret.

## 1. Trạng thái nhanh

| Task | Trạng thái | Commit | Ghi chú |
|---|---|---|---|
| TK-01 CodeGraph | Xong | (không có) | `graph:check` exit 0 |
| TK-02 Menu Cấu hình SLA | Xong, PO xác nhận trên giao diện | `08631b4` | |
| TK-09 Mailpit trong Docker | Xong, PO xác nhận | `24b4d20` | |
| TK-10 Đổi mật khẩu | Xong, PO xác nhận | `0e5b749` | |
| Sửa lỗi hai tab tự đăng xuất | Xong (ngoài danh sách) | `f642e35` | |
| Docker ML: timeout pip | Xong | `bddbd68` | thay đổi cũ của PO |
| TK-03 Ma trận phân quyền | Xong; ma trận đã cập nhật theo quyết định PO (mục 4, 11) | chưa commit | `docs/Ma_tran_AC_phan_quyen_1_chi_nhanh.md`; `/companies` đã giới hạn cho CBTD (mục 16) |
| TK-04 Kiểm thử phân quyền | Xong (mục 11) | chưa commit | `backend/test/loan-access.test.cjs` |
| Thu hẹp quyền xem của Thẩm quyền (phương án B) | Xong, đã build, test và chạy thật (mục 11) | chưa commit | |
| TK-12 Báo cáo ML | **Đã viết, chờ PO đọc** | chưa commit | `docs/Bao_cao_Mo_hinh_Machine_Learning.md` + `ml-service/scripts/evaluate_model.py` |
| TK-06 Theo dõi tiến độ cho doanh nghiệp | Xong (mục 14); PO giao tự chọn danh mục trạng thái | chưa commit | |
| TK-07 Nhắc ngày 5 / quá hạn ngày 10 | Xong (mục 12) | chưa commit | đã đổi DB local |
| TK-08 Quản lý đóng hồ sơ quá hạn | Xong (mục 13) | chưa commit | |
| TK-05, 11 | Chưa làm, chờ quyết định PO | | xem mục 5 |

## 2. Git

- Nhánh `YenTrang`. Đã push `fd9c16e..24b4d20` lên `origin/YenTrang` (push thường, không force).
- Commit `c4d790e` (cập nhật backlog trong handover) **chưa push**, nằm trên máy.
- Chưa commit (cập nhật 25/10/2026): `docs/Ma_tran_AC_phan_quyen_1_chi_nhanh.md`, `docs/Bao_cao_Mo_hinh_Machine_Learning.md`, `ml-service/scripts/evaluate_model.py`, file nhật ký này (PO không muốn commit), và 6 file code đã sửa cho phương án B: `loan-access.guard.ts`, `loan-applications.service.ts`, `dashboard.service.ts`, `dashboard.controller.ts`, `portal.controller.ts`, `LoanList.tsx` (chi tiết ở mục 10).
- `frontend/tsconfig.app.tsbuildinfo` là file build đang bị git theo dõi, đổi sau mỗi lần build; cố ý không commit. Nên bỏ khỏi git và thêm vào `.gitignore` (chưa làm, cần PO quyết).
- `origin/main` chưa có các commit trên; muốn vào `main` cần mở PR.

## 3. Việc đã làm, ngắn gọn

- **TK-01:** `npm ci` ở root cần Visual Studio Build Tools (C++) để biên dịch `better-sqlite3` (đã cài bằng winget). CodeGraph lỗi với đường dẫn có dấu cách (`T:\SME SYSTEM`), nên build/query qua ổ ảo: `subst S: "T:\SME SYSTEM"` rồi chạy từ `S:\`. Ổ ảo mất sau khi khởi động lại máy.
- **TK-02:** chỉ sửa `navigation.ts` là chưa đủ; còn thiếu nhánh render `AdminView section="settings"` trong `App.tsx`. Test `check-navigation.mjs` trước đó khẳng định *không có* mục SLA, đã cập nhật.
- **TK-10:** form đổi mật khẩu theo backend: mật khẩu mới tối thiểu **8 ký tự** (handover ghi 6). Test `test:password`.
- **Lỗi hai tab:** listener `storage` trong `AuthContext.tsx` đăng xuất mỗi khi `sme_token` đổi, kể cả khi tab khác vừa đăng nhập. Nay chỉ đăng xuất khi token bị xóa. Test `test:auth-sync`.
- **TK-09:** thêm service `mailpit` (SMTP 1025, web 8025). Backend dùng `DOCKER_SMTP_HOST` (mặc định `mailpit`) vì `.env` gốc có `SMTP_HOST=127.0.0.1` sẽ ghi đè và không tới được Mailpit trong container.
- **TK-12:** chạy script đánh giá trong container ML (scikit-learn 1.9.1). Kết quả khớp metadata đã lưu. Báo cáo nêu rõ giới hạn (xem mục 6).

## 4. TK-03 và TK-04 (cần PO)

Backend **đã** chặn truy cập chéo hồ sơ: `LoanAccessGuard` cho mọi route có ID hồ sơ, bộ lọc danh sách cho CBTD, kiểm tra phân công khi chuyển bước, hàng đợi Portal cũng lọc cho CBTD. Phần "siết `assignedTo`" của TK-04 vì vậy không cần sửa code. Còn thiếu: test tự động cho 403 chéo. Chưa kiểm chứng chạy thật vì dữ liệu hiện chỉ có 1 CBTD sở hữu cả 4 hồ sơ.

**Quyết định của PO (đã có):**
1. **Thẩm quyền: chọn phương án B**, chỉ xem hồ sơ từ công đoạn Thẩm định trở đi (Thẩm định, Cấp trên, Hoàn tất); không xem hồ sơ còn ở Tiếp nhận. Đây là thay đổi hành vi, đã bắt đầu triển khai (mục 10).
2. **Quản lý: giữ nguyên** (phân công, điều chuyển, theo dõi; chỉ xem chứng từ/bổ sung, không thao tác).
3. **CBTD và dự báo ML:** CBTD chỉ xem kết quả để nắm hồ sơ nào sắp trễ. Đúng với hiện trạng (hệ thống tự tính khi hồ sơ vào Thẩm định/Cấp trên; nút tính lại thủ công chỉ dành cho Thẩm quyền và Quản lý), không cần sửa. Với Thẩm quyền, dự báo chỉ giúp sắp xếp ưu tiên, giữ nguyên.
4. **TK-04 đổi phạm vi:** không sửa logic chặn truy cập chéo (đã có sẵn), chỉ viết kiểm thử tự động.
5. Báo cáo ML chỉ phục vụ thuyết minh đồ án/hội đồng, không nằm trong quy trình xử lý hồ sơ.

**Đã quyết 26/10/2026:** CBTD chỉ xem doanh nghiệp có hồ sơ gán cho mình (mục 16). Việc ghi dữ liệu doanh nghiệp còn chờ PO.

**Giải thích nghiệp vụ đã trao đổi với PO:** "chặn truy cập chéo" = CBTD A không mở được hồ sơ của CBTD B dù biết link; hệ thống từ chối "Bạn chỉ được truy cập hồ sơ được phân công".

## 5. Việc chờ quyết định PO

- **TK-05:** nghiệm thu 6 tiêu chí chính sách để mở nộp Portal V2 (`portal.readiness.ts`).
- **Gia hạn nộp chứng từ:** chưa làm (PO chọn không gia hạn trong TK-07; thiết kế để thêm sau chỉ cần đổi `deadlineAt`).
- **TK-11:** giờ làm việc hay 24/7 cho SLA, có tạm dừng khi chờ bổ sung không.

## 6. Điểm lệch và rủi ro đã phát hiện

- Handover ghi nhánh `LeThiYenNhi` và working tree chưa sạch; thực tế đã sang `YenTrang` và các file đó đã commit (`36ce540`, PR #5).
- Công đoạn `HOAN_TAT` trong DB tên "Hoàn tất & Phê duyệt giải ngân" dù hệ thống không có giải ngân (dữ liệu seed, chưa đổi).
- Menu nội bộ không lọc theo vai trò: mọi mục hiện cho cả 4 vai trò, backend trả 403 khi vào sai (hành vi sẵn có). Admin và CBTD vào Dashboard sẽ thấy "Quyền truy cập bị từ chối".
- Báo cáo ML: nhãn "trễ" được sinh bằng công thức từ chính đặc trưng nên chỉ số cao không phản ánh hiệu năng thật; Random Forest không vượt Logistic Regression; mô hình gần như chỉ dựa vào `supplement_count` (bỏ nó thì ROC-AUC 0,993 tụt còn 0,659).
- Backend tính `debt_to_equity` khác định nghĩa trong dữ liệu huấn luyện; lý do hiển thị trong dự báo là câu chữ cố định, không do mô hình tính.
- CORS backend đang mở cho mọi nguồn (`origin: true`); cần siết nếu công khai.

## 7. Sự cố trong phiên và cách xử lý

- Khi kiểm thử TK-02, lệnh `curl` trên Git Bash gửi tên công đoạn tiếng Việt sai mã hóa, làm tên `TIEP_NHAN` thành `Ti?p nh?n...` trong DB. Đã khôi phục bằng script Node UTF-8. Quy ước: gọi API có tiếng Việt bằng Node, không dùng curl.
- Khi kiểm thử TK-10, tài khoản `test_cbtd` bị đổi mật khẩu rồi được khôi phục đúng băm gốc (và sau lần PO thử giao diện, khôi phục lại lần nữa). Mật khẩu tài khoản test không thể đặt lại về giá trị 6 ký tự qua giao diện đổi mật khẩu; chỉ khôi phục được bằng cách ghi lại băm cũ.
- Lần commit đầu tách `package.json` sai (đường dẫn `/tmp`); đã làm lại 3 commit cuối trước khi push.

## 8. Môi trường chạy local (Docker)

| Cổng | Dịch vụ |
|---|---|
| 5173 | Frontend (nhân viên `/`, doanh nghiệp `/portal`) |
| 3001 | Backend API |
| 8000 | ML service |
| 5432 | PostgreSQL |
| 1025 / 8025 | Mailpit (SMTP / giao diện hộp thư) |

- Chốt dùng **5173** để kiểm thử giao diện. Sau mỗi thay đổi frontend: `docker compose up -d --build --no-deps frontend`, rồi `Ctrl+Shift+R` trên trình duyệt.
- Không chạy `npm run mail:dev` cùng lúc với Docker (trùng cổng 1025/8025).
- Không chạy `prisma push`, `prisma seed`, `start-local.ps1` hay các script `check-*` trên DB đang có dữ liệu.
- Trong Git Bash trên Windows, đường dẫn bắt đầu bằng `/tmp` bị đổi thành đường dẫn Windows; đặt `MSYS_NO_PATHCONV=1` khi chạy `docker exec`/`docker cp`.

## 9. Bước tiếp theo đề xuất

1. Hoàn tất phần đang làm dở ở mục 10 (build, viết test, chạy thật, cập nhật tài liệu).
2. PO đọc báo cáo ML.
3. Commit các file mới/sửa (chỉ add từng file, không `git add .`; **không commit** file nhật ký này theo yêu cầu PO, và không commit `frontend/tsconfig.app.tsbuildinfo`), rồi quyết định push `c4d790e` và các commit mới.
4. Sau khi PO chốt quy tắc: TK-07 → TK-08, TK-06, TK-05, TK-11.

## 10. Việc đã làm dở ở phiên trước (ĐÃ HOÀN TẤT, xem mục 11; giữ lại làm lịch sử)

**Mục tiêu:** triển khai phương án B (Thẩm quyền chỉ thấy hồ sơ từ Thẩm định trở đi) và TK-04 (kiểm thử phân quyền).

**Căn cứ thiết kế:** workflow chỉ đi tiến (Tiếp nhận → Thẩm định → Cấp trên → Hoàn tất, không có bước quay lại), nên quy tắc theo công đoạn ổn định.

**Đã sửa code (chưa commit, chưa build, chưa test):**
| File | Thay đổi |
|---|---|
| `backend/src/common/guards/loan-access.guard.ts` | Thẩm quyền mở hồ sơ đang ở `TIEP_NHAN` thì trả 403 "Thẩm quyền chỉ truy cập hồ sơ từ công đoạn Thẩm định trở đi." (áp cho chi tiết, chứng từ, bổ sung, lịch sử, dự báo) |
| `backend/src/modules/loan-applications/loan-applications.service.ts` | `findAll`: với Thẩm quyền, lọc `currentStage` khác `TIEP_NHAN` (kết hợp được với tham số `stage`) |
| `backend/src/modules/dashboard/dashboard.service.ts` + `dashboard.controller.ts` | `getEarlyWarningList(user)`: Thẩm quyền không thấy hồ sơ Tiếp nhận trong danh sách cảnh báo. Các số tổng hợp (overview, bottleneck, phân bổ công đoạn) giữ nguyên vì chỉ là số đếm |
| `backend/src/modules/portal/portal.controller.ts` | Bỏ `THAM_QUYEN` khỏi `@Roles` của `PortalIntakesController` (hàng đợi tiếp nhận Portal chỉ còn CBTD và Quản lý) |
| `frontend/src/components/LoanList.tsx` | Ẩn tab "Chờ tiếp nhận" khi vai trò đang dùng là `THAM_QUYEN` |

Đã kiểm tra không xung đột với test hiện có: `portal-assignment.test.cjs` (Thẩm quyền vẫn bị chặn ở `assign`/`officers`) và `frontend/scripts/check-intake-ui.mjs` (chỉ kiểm tra giao diện chỉ-đọc).
Đã chạy `npm ci` trong `backend/` (trước đó máy chưa có `node_modules` của backend).

**Còn phải làm, theo thứ tự:**
1. `npm --prefix backend run build` (backend test chạy trên thư mục `dist`, cần build trước).
2. Viết `backend/test/loan-access.test.cjs` (theo kiểu các test `.cjs` hiện có: `node:test`, mock Prisma, `require('../dist/...')`):
   - `LoanAccessGuard`: CBTD mở hồ sơ của mình được; CBTD mở hồ sơ người khác bị 403 (chi tiết, chứng từ, bổ sung, tải chứng từ, bổ sung theo `supplementId`); Quản lý mở hồ sơ bất kỳ được; Thẩm quyền mở hồ sơ ở Thẩm định, Cấp trên, Hoàn tất được nhưng ở Tiếp nhận bị 403; ghi vào hồ sơ đã Hoàn tất bị 403; vai trò sai công đoạn khi thao tác chứng từ bị 403; hồ sơ không tồn tại trả 404; route không có ID cho qua.
   - `LoanApplicationsService.findAll`: điều kiện `where` đúng cho CBTD, Thẩm quyền (kể cả khi truyền `stage=TIEP_NHAN`), Quản lý.
   - `DashboardService.getEarlyWarningList`: điều kiện lọc cho Thẩm quyền và Quản lý.
   - Quyền `PortalIntakesController` (dùng `RolesGuard` + `Reflector` như `portal-assignment.test.cjs`): `list` cho CBTD/Quản lý, chặn Thẩm quyền.
3. Chạy các test backend liên quan và test frontend (`test:intake`, `test:navigation`, `test:api`, `test:password`, `test:auth-sync`), rồi `npm --prefix frontend run build`.
4. Build lại container: `docker compose up -d --build --no-deps backend frontend` (không đụng DB). Sau đó `Ctrl+Shift+R`.
5. Kiểm chứng chạy thật bằng thao tác **chỉ đọc**: dùng `test_tham_quyen` và `test_quan_ly`, so sánh danh sách hồ sơ và thử mở hồ sơ đang ở Tiếp nhận (nếu dữ liệu hiện có hồ sơ ở Tiếp nhận; nếu không thì ghi rõ là chưa kiểm chứng được trên dữ liệu thật). Không tạo dữ liệu mới nếu chưa được PO cho phép.
6. Cập nhật `docs/Ma_tran_AC_phan_quyen_1_chi_nhanh.md`: sửa các dòng Thẩm quyền (danh sách, chi tiết, chứng từ, bổ sung, lịch sử, hàng đợi Portal), thêm AC cho Thẩm quyền ở Tiếp nhận, ghi quyết định đã duyệt của PO (mục 4 ở trên), và đổi mô tả phạm vi kiểm chứng.
7. Cập nhật bảng trạng thái TK-03/TK-04 trong `docs/handover/HANDOVER_v2.1.md` (kèm mã commit khi đã commit).

**Lưu ý khi làm tiếp:**
- Lệnh `graph:check` phải chạy từ ổ ảo `S:` (xem mục 3); sau khi sửa source cần `graph:build`.
- Gọi API có tiếng Việt bằng Node, không dùng `curl` (xem mục 7). Với `docker exec`/`docker cp` trong Git Bash, đặt `MSYS_NO_PATHCONV=1`.
- Tài khoản test dùng mật khẩu trong README; không ghi mật khẩu vào tài liệu này.

## 11. Kết quả hoàn tất mục 10 (25/10/2026)

- Đã chạy `prisma generate` (máy chưa có client) rồi `npm --prefix backend run build`: qua.
- Đã viết `backend/test/loan-access.test.cjs` (13 test) và script `test:access`; toàn bộ 92 test backend `.cjs` pass. Test frontend `api`, `navigation`, `auth-sync`, `password`, `intake`, `supplements`, `portal` và `build` đều pass.
- Đã build lại container backend/frontend (`--no-deps`, không đụng DB). Kiểm chứng đọc bằng Node: Thẩm quyền không thấy hồ sơ Tiếp nhận (danh sách, `stage=TIEP_NHAN`, cảnh báo sớm), mở chi tiết hồ sơ Tiếp nhận bị 403, `/portal-intakes` 403; Quản lý và CBTD không đổi.
- Đã cập nhật ma trận AC (thêm AC-11..13) và bảng TK-03/TK-04 trong handover. `graph:build`/`graph:check` OK (123 file).
- **Chưa làm:** quan sát giao diện trên trình duyệt (tab "Chờ tiếp nhận" ẩn với Thẩm quyền); commit; PO xác nhận `/companies`.

## 12. TK-07 (26/10/2026)

- **Quyết định PO:** ngày lịch (giờ Việt Nam, lùi qua cuối tuần), chưa gia hạn, nhắc doanh nghiệp bằng email, thông báo cho cả hồ sơ không qua Portal (nới `InternalNotification.requestId`).
- **DB local đã đổi (26/10/2026):** áp bằng SQL trong một transaction (4 cột mới, `request_id` bỏ NOT NULL, khóa ngoại `application_id`), có sao lưu trước. Bản sao lưu nằm ở thư mục tạm của phiên làm việc, không nằm trong repo. `schema.prisma` đã đổi tương ứng; DB khác cần áp lại thay đổi này.
- **Kiểm chứng:** 112 test backend, 8 bộ test frontend, build đều pass. Chạy thật trên Docker: hồ sơ `SME-20260925-0004` (hạn 02/10 đã qua) được bộ quét đánh dấu quá hạn và tạo 1 thông báo cho CBTD; khởi động lại backend không tạo thêm; hồ sơ vẫn `SUPPLEMENT_REQUIRED`; Quản lý 200, Thẩm quyền và CBTD 403 với API quá hạn.
- **Chưa kiểm chứng:** email nhắc ngày 5 (chưa có hồ sơ qua Portal đang chờ bổ sung); giao diện trên trình duyệt (chuông mở hồ sơ, khối đỏ Dashboard, cờ trong danh sách); test hồi quy Portal chạy thật (các script `check-*` ghi DB nên không chạy).
- **Việc ngoài phạm vi, chờ PO:** CBTD có thể nhập `deadlineAt` ở quá khứ làm hồ sơ quá hạn ngay.

## 13. TK-08 (26/10/2026)

- **Làm:** Quản lý đóng thủ công hồ sơ quá hạn bổ sung (xem handover, bảng trạng thái). Không có đường đóng tự động. Không đổi schema DB.
- **Quyết định nhỏ cần PO biết:** (1) lý do đóng lưu `rejectionReasonCode='TC05'` ("Quá hạn thời gian bổ sung chứng từ", đã có trong form từ chối) và `rejectionNote`; (2) yêu cầu bổ sung đang chờ chuyển `EXPIRED` để không còn xuất hiện như đang chờ; (3) công đoạn đang mở được đóng với thời gian tạm dừng tính nốt, nên không bị coi là trễ SLA vì thời gian chờ doanh nghiệp.
- **Kiểm chứng:** 123 test backend, 9 bộ test frontend pass. Chạy thật trên Docker với hồ sơ thử `TEST-TK08-0001` (đã xóa): CBTD và Thẩm quyền 403, lý do trống 400, hồ sơ không chờ bổ sung 400, Quản lý đóng thành công qua giao diện Chrome, DB ghi đúng trạng thái, lịch sử và yêu cầu bổ sung.
- **Chưa kiểm chứng/để ý:** hồ sơ đã đóng vẫn hiển thị đủ 4 bước "hoàn thành" trong thanh tiến trình (logic có sẵn coi HOAN_TAT là xong); cột "Thực tế" trong bảng tiến trình hiển thị số thập phân dài (có sẵn từ trước, không do TK-08). Chưa kiểm tra màn hình hẹp.

## 14. TK-06: Theo dõi tiến độ hồ sơ cho doanh nghiệp (26/10/2026)

**Nghiệp vụ.** Doanh nghiệp đăng nhập Portal, mở một đề nghị đã gửi và thấy tiến độ xử lý ở đầu trang chi tiết: 4 mốc công khai *Tiếp nhận → Thẩm định → Phê duyệt → Hoàn tất*, một trạng thái hiện tại kèm câu giải thích, và nếu bị từ chối thì lý do chung. Doanh nghiệp chỉ xem đề nghị của chính tài khoản mình.

**Danh mục trạng thái công khai (PO giao tôi chọn; ghi đây để PO duyệt lại nếu cần):**

| Mã | Hiển thị cho doanh nghiệp | Khi nào |
|---|---|---|
| DRAFT | Bản nháp | chưa gửi |
| SUBMITTED | Đã gửi, chờ phân công | đã gửi, chưa phân công |
| ASSIGNED | Chờ ngân hàng tiếp nhận | đã phân công, chưa tiếp nhận |
| RECEIVED | Đang kiểm tra hồ sơ | hồ sơ ở Tiếp nhận (mới nhận hoặc đã đủ chứng từ) |
| SUPPLEMENT_REQUIRED | Cần bổ sung chứng từ | chờ bổ sung; hướng dẫn mở mục "Bổ sung hồ sơ sau tiếp nhận" |
| APPRAISAL | Đang thẩm định | công đoạn Thẩm định |
| HEAD_OFFICE | Đang chờ cấp có thẩm quyền xét duyệt | công đoạn Cấp trên |
| APPROVED | Đã được phê duyệt | phê duyệt |
| REJECTED | Không được chấp thuận + lý do chung | bị từ chối |
| CLOSED | Đã đóng do quá hạn bổ sung | Quản lý đóng thủ công (TK-08) |

**Quy tắc ẩn thông tin (cứng):** không trả ghi chú nội bộ (`rejectionNote`, lý do Quản lý nhập khi đóng), tên hay ID cán bộ, điểm/dự báo ML, số tiền duyệt, nội dung hồ sơ. Lý do từ chối chỉ lấy tên theo mã danh mục TC01–TC05 (`PUBLIC_REJECTION_REASONS` trong `portal.tracking.ts`); mã lạ hoặc thiếu thì hiện "Hồ sơ không được chấp thuận". Truy vấn chỉ `select` các trường công khai và lọc theo `accountId`, đề nghị của tài khoản khác trả 404.

**Thanh tiến độ:** hồ sơ đang xử lý: các mốc trước mốc hiện tại "hoàn thành", mốc hiện tại "đang xử lý", còn lại "chưa tới". Công đoạn Cấp trên tương ứng mốc "Phê duyệt". Hồ sơ được phê duyệt: cả 4 mốc hoàn thành. Hồ sơ bị từ chối hoặc đóng: các công đoạn đã đi qua (theo lịch sử công đoạn) hoàn thành, mốc "Hoàn tất" hiện dấu dừng.

**Đã làm:** `GET /portal/requests/:id/status` (`PortalService.tracking`, hàm thuần `buildTracking` trong `backend/src/modules/portal/portal.tracking.ts`); component `frontend/src/portal/PortalApplicationTracking.tsx` gắn vào đầu trang chi tiết đề nghị đã gửi trong `PortalApp.tsx`; CSS thẻ tiến độ trong `portal.css`. Hai nhánh danh sách/chi tiết của `PortalApp` được đặt `key` riêng để thẻ tiến độ không còn sót khi quay lại danh sách (lỗi tôi gây ra rồi sửa trong lúc kiểm thử).

**Kiểm chứng:** 130 test backend (7 test mới `portal-tracking.test.cjs`), 10 bộ test frontend (4 test mới), build qua. Chạy thật trên Docker bằng tài khoản test và dữ liệu thử riêng (đã xóa): API trả đúng trạng thái và các bước cho đề nghị mới gửi, đang thẩm định, bị từ chối, đã đóng; không lộ ghi chú nội bộ; đề nghị của tài khoản khác 404; không token 401. Quan sát giao diện Chrome thật cho cả 4 trường hợp.

**Chưa làm / giới hạn:** danh sách đề nghị chưa hiện trạng thái công khai trên từng dòng (chỉ có ở trang chi tiết; thêm cần API gộp, ngoài spec); thẻ tiến độ chỉ tải khi mở, không tự làm mới; chưa kiểm tra màn hình hẹp; chưa gửi thông báo cho doanh nghiệp khi trạng thái đổi (ngoài email nhắc bổ sung của TK-07).

## 15. Tóm tắt nghiệp vụ TK-07 và TK-08 (để người tiếp nhận không phải đọc code)

**TK-07 (DEC-02): nhắc và đánh dấu quá hạn bổ sung chứng từ.** Mốc tính từ lúc CBTD tạo yêu cầu bổ sung: **ngày 5** nhắc, **ngày 10** quá hạn. Tính theo ngày lịch, giờ Việt Nam, mốc rơi Thứ Bảy/Chủ nhật lùi sang Thứ Hai cùng giờ (chưa có lịch ngày lễ). Nếu CBTD nhập hạn (`deadlineAt`) thì hạn đó là mốc quá hạn (không lùi), và bỏ nhắc ngày 5 nếu hạn đến trước. Bộ quét chạy mỗi giờ (`SupplementRemindersService`, tắt bằng `SUPPLEMENT_SCAN_INTERVAL_MS=0`). Ngày 5: thông báo cho CBTD phụ trách (chuông) và gửi email cho doanh nghiệp nếu hồ sơ qua Portal; email lỗi sẽ thử lại lần quét sau mà không nhắc CBTD lần nữa. Quá hạn: đánh dấu `overdueAt`, thông báo CBTD, hiện khối đỏ trên Dashboard Quản lý và cờ vàng/đỏ trong danh sách, Kanban, chi tiết hồ sơ. **Không tự đóng hồ sơ**, không đổi trạng thái; chưa có gia hạn. Thay đổi DB: 3 cột trên `supplement_requests`, `internal_notifications.request_id` tuỳ chọn + `application_id`.

**TK-08: Quản lý đóng thủ công hồ sơ quá hạn.** Chỉ vai trò Quản lý; bắt buộc lý do; chỉ khi hồ sơ đang chờ bổ sung và có yêu cầu đã đến hạn (backend tự tính lại). Kết quả: `HOAN_TAT` + `CLOSED_TIMEOUT`, mã `TC05`, lý do lưu vào `rejectionNote` và ghi chú lịch sử công đoạn cùng người đóng và thời điểm; yêu cầu bổ sung chuyển `EXPIRED`; thời gian tạm dừng SLA được tính nốt nên không bị coi là trễ vì chờ doanh nghiệp. Hồ sơ đã đóng bị khóa mọi thao tác.

## 16. Giới hạn xem doanh nghiệp cho CBTD (26/10/2026)

**Nghiệp vụ.** PO quyết CBTD không được xem toàn bộ doanh nghiệp. Danh sách "Liên hệ doanh nghiệp" của CBTD chỉ gồm doanh nghiệp có ít nhất một hồ sơ gán cho CBTD đó. Khi tạo hồ sơ và tra mã số thuế: nếu doanh nghiệp thuộc hồ sơ của mình thì hiện đủ thông tin và tối đa 3 hồ sơ gần nhất *của chính mình*; nếu doanh nghiệp đã tồn tại nhưng thuộc cán bộ khác thì chỉ báo "đã tồn tại" (không điền sẵn thông tin, không lộ hồ sơ), form hiện cảnh báo và khuyên liên hệ Quản lý; nếu chưa có thì là doanh nghiệp mới. Quản lý và Thẩm quyền không đổi.

**Phát hiện thêm trong lúc phân tích:** trước đây tra MST trả cả 3 hồ sơ gần nhất của *mọi* cán bộ (mã hồ sơ, số tiền, trạng thái); đã chặn. `POST /loan-applications` và `POST /companies` dùng upsert theo MST nên CBTD từng có thể ghi đè thông tin doanh nghiệp của cán bộ khác. PO quyết "của ai người nấy làm, không ai làm dùm ai", nên đã chặn bằng `assertOfficerMayWriteCompany` (`backend/src/modules/companies/company-access.ts`): CBTD chỉ tạo/cập nhật doanh nghiệp mới hoặc doanh nghiệp có hồ sơ của mình, còn lại 403; form tạo hồ sơ vô hiệu hóa nút gửi khi tra MST ra doanh nghiệp bị hạn chế. **Hệ quả:** một khách đã có hồ sơ ở cán bộ A thì cán bộ B không tự mở hồ sơ mới cho khách đó; muốn đổi người phụ trách phải qua Quản lý (điều chuyển). Đây là diễn giải của tôi về câu trả lời của PO; nếu PO muốn cho phép tạo hồ sơ mới mà không ghi đè thì đổi lại. Thẩm quyền (phương án B) vẫn thấy toàn bộ danh sách doanh nghiệp, kể cả doanh nghiệp chỉ có hồ sơ ở Tiếp nhận, chưa được PO nêu nên không đổi.

**Đã làm:** `CompaniesService.findAll/checkTaxCode/upsert` nhận người dùng; `LoanApplicationsService.create` kiểm tra quyền ghi doanh nghiệp; `CompaniesController` truyền `@CurrentUser()`; `frontend/src/components/taxCheck.ts` (`describeTaxCheck`) và `CreateLoanModal.tsx` xử lý kết quả "restricted". **Kiểm chứng:** 143 test backend, test frontend (`test:tax-check`), build qua; chạy thật trên Docker bằng một CBTD thử thứ hai (đã xóa): danh sách rỗng, tra MST "restricted", ghi vào doanh nghiệp người khác 403 và không đổi dữ liệu; xem giao diện Chrome thật.

## 17. Việc tồn đọng đã ghi nhận (PO đồng ý để sau, 26/10/2026)

| # | Việc | Tình trạng |
|---|---|---|
| 1 | CBTD nhập `deadlineAt` ở quá khứ khi tạo yêu cầu bổ sung làm hồ sơ quá hạn ngay (backend không chặn, ngoài phạm vi TK-07) | **Chưa làm, PO muốn ghi lại để xử lý sau.** Đề xuất: chặn hạn trong quá khứ khi tạo yêu cầu bổ sung |
| 2 | Báo cáo mô hình ML (TK-12) | PO sẽ đọc sau |
| 3 | Danh mục trạng thái công khai cho doanh nghiệp (TK-06, mục 14) | PO chấp nhận tạm, "hợp lý là được" |
| 4 | Áp thay đổi schema cho môi trường khác: 3 cột `supplement_requests` (`reminder_sent_at`, `reminder_email_sent_at`, `overdue_at`), `internal_notifications.request_id` bỏ NOT NULL, thêm `application_id` + khóa ngoại. Repo không có thư mục migration (dùng `prisma db push`) | Mới áp trên DB local của PO ngày 26/10/2026 |
| 5 | Bộ quét nhắc bổ sung chạy trong tiến trình backend; chạy nhiều bản backend cùng lúc có thể gửi trùng | Hiện chỉ một container |
| 6 | Chưa có lịch ngày lễ cho mốc ngày 5/10 | Chỉ lùi qua cuối tuần |
| 7 | Danh sách đề nghị trên Portal chưa hiện trạng thái công khai trên từng dòng; thẻ tiến độ không tự làm mới | Ngoài spec TK-06 |
| 8 | Giao diện nhân viên: hồ sơ đã đóng vẫn tích xanh đủ 4 bước; cột "Thực tế" hiện số thập phân dài | Có từ trước |
| 9 | Script `check-*` Portal thật (ghi DB) chưa chạy; màn hình hẹp chưa xem | Chưa kiểm chứng |
| 10 | Tồn đọng cũ: menu nội bộ chưa lọc theo vai trò, CORS mở, tên công đoạn "giải ngân", giới hạn mô hình ML | Xem mục 6 |
| 11 | TK-05 và TK-11 | Chờ PO quyết nghiệp vụ |
| 12 | Commit: chưa; không commit file nhật ký và hai file `tsbuildinfo` | Chờ PO ra lệnh |

## 18. Nhóm B đã commit và push; nhóm C chờ quyết định (26/10/2026)

- **Git:** đã commit 4 commit (backend, frontend, tài liệu nghiệp vụ, báo cáo ML) rồi push thường lên `origin/YenTrang` (`24b4d20..d1bfefb`, gồm cả `c4d790e` còn tồn). Commit theo lớp chứ không theo task vì nhiều file dùng chung giữa các task. Không commit file nhật ký này và hai file `tsbuildinfo`.
- **Tài liệu mô tả nghiệp vụ cho PO:** `docs/Mo_ta_nghiep_vu_cac_task_nhom_A_B.md`.
- **TK-05 (điểm lệch):** handover liệt kê "6 tiêu chí" là BCTC, checklist chứng từ, định dạng số liệu, ràng buộc người đại diện, điều kiện khoản vay, chính sách bổ sung. Trong code (`portal.readiness.ts`, `mvpPolicy.decisions`) 6 quyết định thật là: `company-data`, `no-annual-data`, `supplement` (PO đã xác nhận) và `finance-components`, `representative`, `alternatives` (còn `PENDING`). Phiên bản chính sách: `...-draft1`, phạm vi ghi "Mô phỏng khóa luận; không phải chính sách tín dụng ngân hàng". Cờ `canSubmit=false` và `PORTAL_V2_SUBMIT_ENABLED=false` giữ nguyên cho đến khi PO chốt 3 quyết định còn chờ.
- **TK-11:** chờ PO chọn PA1 (giờ làm việc) hoặc PA2 (giữ 24/7). Chưa đổi gì.

## 19. Quyết định nhóm C (26/10/2026)

- **TK-11:** ban đầu chọn PA2 (giữ 24/7, không đổi code), sau đó PO yêu cầu **làm theo handover (PA1)**; đã làm, xem mục 20.
- **TK-05: PO yêu cầu tôi đề xuất bộ quy tắc đơn giản cho đồ án** (đã trình, chờ PO duyệt). **Phát hiện phạm vi thực lớn hơn handover:** nộp hồ sơ V2 không chỉ cần đổi cờ. `PortalService.submit/accept` lấy chính sách qua `resolveTestPolicy`, hàm này chỉ cho chạy khi `NODE_ENV=test`, `PORTAL_V2_SUBMIT_ENABLED=true` và DB cách ly (schema `portal_v2_it_*`); ghi chú trong code: "Environment flags alone never activate V2. There is no approved production registry." Vì vậy cần thêm một nguồn chính sách chính thức (bản đã duyệt) thay thế đường test-only, nối vào submit/accept/cấu hình, rồi kiểm thử đầu cuối. Việc này thay đổi hành vi của một tính năng cố ý bị khóa nên cần PO đồng ý rõ. Luồng V1 (cũ, mỗi nhóm A–F ít nhất một tệp) vẫn nộp được bình thường.

## 20. TK-11: SLA tính giờ làm việc (PA1) (26/10/2026)

**Nghiệp vụ.** SLA của mỗi công đoạn nay tính theo **giờ làm việc**, không còn tính giờ liên tục 24/7:
- Ngày làm việc: Thứ Hai đến Thứ Sáu, **08:00-12:00 và 13:00-17:00** giờ Việt Nam (8 giờ/ngày, nghỉ trưa 1 giờ). *Giả định của tôi, handover chỉ ghi "8h/ngày"; cần PO xác nhận.* Chọn 08:00 làm giờ mở cửa vì tiêu chí handover "nộp 17h thứ Sáu, xử lý 9h thứ Hai chỉ tính 1 giờ" chỉ đúng khi ngày làm việc bắt đầu 08:00 và kết thúc 17:00.
- Trừ Thứ Bảy, Chủ nhật và ngày lễ. Ngày lễ cố định theo dương lịch có sẵn: 1/1, 30/4, 1/5, 2/9. **Tết Nguyên đán, Giỗ Tổ và ngày nghỉ bù thay đổi theo năm nên chưa có sẵn:** khai báo bằng biến môi trường `SLA_EXTRA_HOLIDAYS` (danh sách `YYYY-MM-DD`, ngăn cách bằng dấu phẩy; đã thêm vào `.env.example` và `docker-compose.yml`). Tôi không tự điền lịch lễ vì không có nguồn chính thức.
- Khi hồ sơ chờ doanh nghiệp bổ sung, đồng hồ SLA tạm dừng; thời gian tạm dừng nay cũng được cộng dồn theo giờ làm việc, rồi trừ vào thời gian tính SLA.
- "Thực tế" trong bảng tiến trình vẫn là giờ liên tục (thời gian trôi qua); "Tạm dừng SLA", "Thời gian tính SLA" và "SLA chuẩn" là giờ làm việc. Nhãn cột đã ghi rõ đơn vị.
- Số giờ SLA chuẩn đã cấu hình (4, 24, 48, 8 giờ) nay hiểu là **giờ làm việc**: ví dụ Thẩm định 24 giờ = 3 ngày làm việc. PO nên xem lại các giá trị này ở màn Cấu hình SLA.

**Đã làm.** `backend/src/common/sla/working-hours.ts` (`workingHoursBetween`); dùng ở chuyển bước (`workflow.service`), hoàn tất bổ sung (`supplements.service`), đóng hồ sơ quá hạn (TK-08) và đặc trưng `previous_stage_duration_hours` gửi mô hình dự báo (`prediction.service`, khi chưa có thời gian tính sẵn). Nhãn đơn vị ở Dashboard, bảng tiến trình, Kanban và màn Cấu hình SLA.

**Ảnh hưởng cần biết.**
- Dữ liệu lịch sử công đoạn cũ giữ nguyên (đã tính giờ liên tục); chỉ các công đoạn đóng từ nay mới tính giờ làm việc. Dashboard (điểm nghẽn, tỷ lệ đúng hạn) sẽ trộn hai cách tính cho tới khi dữ liệu cũ được thay dần.
- Mô hình dự báo **không được huấn luyện lại** (ngoài phạm vi). Đặc trưng thời gian công đoạn trước nay là giờ làm việc, nhỏ hơn giờ liên tục; mô hình vẫn chạy nhưng độ phù hợp với phân phối mới chưa được đánh giá.
- Hạn ngày 5 và ngày 10 của TK-07 vẫn tính theo ngày lịch (PO đã chốt), không đổi.

**Kiểm chứng.** 156 test backend pass (9 test thuật toán `working-hours`: 17h thứ Sáu đến 9h thứ Hai = 1 giờ, nghỉ trưa, cuối tuần, ngày lễ, giờ Việt Nam; 4 test tích hợp `sla-working-hours`; test đóng hồ sơ quá hạn cập nhật). Frontend 11 bộ test pass, build qua. Chạy thật trên Docker: hồ sơ thử bắt đầu 9h thứ Sáu, chuyển bước lúc 20h56 thứ Hai (thực tế 83,9 giờ liên tục) ghi 15 giờ làm việc (7 giờ thứ Sáu + 8 giờ thứ Hai), đúng với tính tay; Dashboard điểm nghẽn trả 200; đã xóa dữ liệu thử.

## 21. Chốt phạm vi: chỉ giữ nhóm A và B (26/10/2026)

- **Phạm vi của phiên này:** chỉ nhóm A và B. Nhóm C (TK-05, TK-11 và việc bỏ công đoạn Cấp trên) do người khác làm; người này đã pull bản đã push (`d1bfefb`). PO sẽ pull phần nhóm C về sau.
- **Phần TK-11 tôi đã làm dở (mục 19 và 20) được cất bằng `git stash`, không commit, không push:** `stash@{0}` tên "TK-11 SLA gio lam viec (nhom C, chua commit)". Gồm `backend/src/common/sla/working-hours.ts`, các sửa ở `workflow.service`, `supplements.service`, `prediction.service`, test `working-hours`, `sla-working-hours`, `close-overdue`, nhãn giao diện, `.env.example`, `docker-compose.yml` và hai tài liệu. Muốn lấy lại: `git stash list` rồi `git stash pop` (hoặc `git stash show -p stash@{0}`). **Mục 19 và 20 phía trên mô tả phần đã cất này, không còn nằm trong mã nguồn hiện tại.**
- **Thư mục làm việc đã về đúng bản đã push**; đã build lại, backend 143 test và frontend 11 bộ test pass, container Docker backend và frontend đã build lại từ bản này.
- **Việc cần báo người làm nhóm C:** bản đã push có thay đổi cấu trúc DB (xem mục 17, dòng 4); họ phải chạy `prisma db push` trên DB máy họ.
- **Điểm PO vừa nêu cho nhóm C (chưa làm):** bỏ công đoạn 3 (Cấp trên); chi nhánh chỉ cho vay dưới 10 tỷ, trên 10 tỷ liên hệ cơ sở chính. Kèm các câu hỏi chờ trả lời: ngưỡng đúng 10 tỷ, chặn ở form tạo hồ sơ hay cả Portal, xử lý hồ sơ 15 tỷ đang ở Cấp trên, cách bỏ công đoạn. Bảng áp dụng dự báo ML sau khi bỏ Cấp trên: Tiếp nhận và Thẩm định có dự báo, hồ sơ Hoàn tất thì ẩn; hồ sơ chưa tính hiện "Chưa đánh giá".

## 22. Từ 27/10 đến 31/10/2026: SLA PA1, chặn quyền, sửa lỗi, push (tổng hợp)

**SLA PA1 (nhóm C, TK-11).** Làm lại theo phương án PA1 với 3 mốc: (1) lõi tính giờ làm việc (T2-T6, 08:00-12:00 và 13:00-17:00 giờ VN), lịch theo phiên bản (SIM-20261026-20261108-v1, 30/10 là ngày lễ mô phỏng), mốc kích hoạt T0, `sla_policy` theo từng công đoạn (null = cũ 24/7, 'PA1'), bảng khoảng tạm dừng có chỉ mục duy nhất một khoảng mở mỗi công đoạn; (2) tạm dừng/tiếp tục khi chờ doanh nghiệp, `waitingOn()` ENTERPRISE/BANK, nhắc và đóng quá hạn chỉ với yêu cầu còn chờ doanh nghiệp; (3) hiển thị, Dashboard tách cũ/PA1, không dự báo giả; ML bỏ qua khi công đoạn Tiếp nhận là PA1 (`predictionStatus`). Đã nâng cấp hệ thống thật (Docker, DB `public`) **nhưng chưa bật PA1** (không có T0). Bản sao lưu pg_dump đã kiểm SHA-256 trước khi nâng cấp.
- Kiểm chứng: `check-sla-pa1.cjs` 119 điểm trên PostgreSQL thật (schema thử riêng, đã xóa), `portal-intake-cycle` 90/90, phiên nghiệm thu `sla-pa1-session.cjs` (8 hồ sơ mẫu, cổng 5173).
- Việc PO còn phải chốt: lịch ngày lễ thật và T0 (chưa bật).

**Một cổng web duy nhất 5173.** Tôi từng mở cổng 5174 để thử, bạn phản đối; đã dừng, dọn schema và file thử, sửa script phiên nghiệm thu dùng 5173 (dừng frontend Docker trước), lưu vào bộ nhớ làm quy tắc.

**Chặn quyền theo vai trò (30/10).** Menu/trang theo vai trò (ADMIN: người dùng + cấu hình; CBTD: doanh nghiệp + hồ sơ; QUAN_LY: dashboard, doanh nghiệp, hồ sơ, thẩm định, điều chuyển; THAM_QUYEN: dashboard, doanh nghiệp, hồ sơ, thẩm định); Quản lý bị gỡ `GET /users`. PO chốt: CBTD vẫn xem (chỉ xem) hồ sơ của mình sau khi chuyển Thẩm định (AC-19, AC-20).

**Rà soát nghiệp vụ gửi PO.** Báo cáo `docs/ai/2026-10-30-bao-cao-loi-nghiep-vu-cho-PO.md` (8 điểm + các luồng chồng chéo), có đoạn cập nhật 31/10 ghi mục đã sửa/còn chờ.

**Sửa 4 lỗi không cần PO (31/10).**
1. Khóa ký đăng nhập: bỏ chuỗi mặc định công khai, `JWT_SECRET` bắt buộc ở production, Docker truyền từ `.env` (trước đó container chạy bằng khóa công khai). Token cũ mất hiệu lực, mọi người đăng nhập lại. `JWT_SECRET` hiện 28 ký tự, nên đổi sang 32 ký tự ngẫu nhiên trở lên.
2. Giới hạn đăng nhập nhân viên: 5 lần sai trong 15 phút theo tên đăng nhập thì khóa 15 phút (ngưỡng tôi chọn, bộ đếm trong bộ nhớ).
3. Đổi chứng từ sau khi "xác nhận đủ" thì tự hủy xác nhận.
4. Điều chuyển CBTD trong một giao dịch có khóa hồ sơ.
Kiểm chứng thật trên cổng 3001: token giả ký khóa cũ bị 401; 7 lần sai thì 5 lần 401 rồi 429.

**Thực hiện đề xuất xử lý (31/10).** Người làm khác người duyệt (CBTD phụ trách không tự duyệt; Quản lý không tự đóng quá hạn hay tự giao hồ sơ cho mình; AC-21); Admin không tự khóa mình, không khóa/bỏ vai trò CBTD còn hồ sơ mở (AC-22); nhãn "Tạo tại quầy" cho hồ sơ không qua Portal. Test: `maker-checker.test.cjs` 8 test; backend 239/239, frontend 42 test đạt và build đạt. **Chưa dựng lại Docker với các thay đổi này và chưa kiểm trên PostgreSQL thật.**

**Commit và push.** 4 commit trên nhánh YenTrang: `3437fc1` (bảo mật), `ad3b5f8` (chặn quyền), `6b0a467` (SLA PA1 + tài liệu), `5ce1c4e` (người làm khác người duyệt). File này và hai file `tsbuildinfo` không commit.

**Còn chờ PO.** Tờ trình thẩm định (cần thêm cột/bảng vào dữ liệu dùng chung); bật PA1 (lịch ngày lễ thật + T0); xác nhận cách hiểu "kiểm chứng từ hai lần". Chưa xử lý: người phụ trách cũ sau điều chuyển vẫn thẩm định được hồ sơ đó (cần tra lịch sử công đoạn).
