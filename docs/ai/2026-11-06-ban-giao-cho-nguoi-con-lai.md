# Bàn giao cho người còn lại: mô hình dự báo trễ SLA v4, SLA PA1 và dữ liệu demo

Ngày 06/11/2026. Viết cho người pull code về chạy tiếp. Mọi thay đổi dưới đây đã làm trên máy của người phụ trách, đã kiểm thử local, **chưa có ai push**. Đọc xong mục 1 và 2 là chạy được.

## 1. Chạy lại trên máy của bạn (theo thứ tự)

Tại thư mục `backend`:

```powershell
npm install
npm run prisma:generate
npm run prisma:push        # tạo/cập nhật schema (DB mới hoặc DB cũ chưa có bảng PA1)
npm run prisma:seed        # công đoạn, 4 tài khoản test, bật PA1, đặt định mức 112/40
npm run build
npm run seed:demo          # 13 tài khoản mô phỏng + 194 hồ sơ quá khứ + dự báo (cần ml-service đang chạy)
```

Sau khi pull phải **build lại hai container**: `docker compose up -d --build backend ml-service`.

- `seed:demo` chạy lặp an toàn (thấy dữ liệu demo rồi thì bỏ qua). Dựng lại: `npm run seed:demo -- --reset`.
- Tài khoản mô phỏng: từ 09/11/2026 còn 7 tài khoản, mật khẩu lấy từ biến `DEMO_PASSWORD` (xem SME_MASTER, điểm bàn giao 09/11/2026). Chỉ dùng demo local.
- DB cũ đã có dữ liệu thật: **đừng** chạy `prisma:seed`/`db push` khi chưa đọc `docs/SME_KY_THUAT.md` mục 4 (xác định đúng DB, sao lưu trước). Nếu DB còn công đoạn Cấp trên, áp `backend/prisma/remove-cap-tren.sql` trước (script tự dừng nếu còn hồ sơ phụ thuộc).
- Tài khoản mô phỏng: `khoa.tran` (Admin), `nhung.nguyen`, `duc.pham` (Quản lý), `ha.le`, `huy.vu`, `lan.dang` (Thẩm quyền), `nam.hoang`, `mai.bui`, `thanh.ngo`, `hanh.do`, `bao.phan`, `oanh.trinh` (CBTD), `dat.nguyen` (CBTD + Thẩm quyền, để thử chặn Maker-Checker). Bốn tài khoản `test_*` cũ giữ nguyên.

## 2. Những gì đã thay đổi

| Phần | Thay đổi |
|---|---|
| `ml-service` | Mô hình **v4** thay v1: hai mô hình (Tiếp nhận, Thẩm định), nhận biết SLA theo giờ làm việc, xác suất đã hiệu chỉnh, hai mức cảnh báo (Chú ý ≥ 0,35, Khẩn ≥ 0,60, Quá hạn khi đã vượt SLA), giải thích nguyên nhân. **Hợp đồng `POST /predict` đổi** (vào: `stage`, `sla_hours`, `elapsed_hours`, đặc trưng theo công đoạn; ra thêm `alert_level`, `remaining_hours`). SLA ngoài dải đã học trả HTTP 422. |
| `backend/src/modules/prediction` | `prediction.service.ts` viết lại: lấy **giờ làm việc đã dùng** của công đoạn đang mở (trừ thời gian chờ doanh nghiệp) và SLA hiện hành rồi gọi ML. Chỉ dự báo khi công đoạn tính theo **PA1**; công đoạn tính cách cũ (24/7) trả "chưa có dự báo" kèm lý do. Thêm `prediction-features.ts` (dựng đặc trưng) và `prediction-scheduler.service.ts` (chấm lại mọi hồ sơ đang mở **08:00 mỗi ngày làm việc**, bỏ cuối tuần/ngày lễ/hồ sơ đang chờ doanh nghiệp; tắt bằng `PREDICTION_SCAN_ENABLED=false`, đổi giờ bằng `PREDICTION_SCAN_HOUR`). Không đổi lược đồ DB. |
| Trạng thái dự báo | `INCOMPATIBLE_PA1` không còn được phát (giữ trong kiểu dữ liệu giao diện); kết quả phân công trả `UNAVAILABLE` thay. Bỏ truy vấn thừa `firstStagePolicies` ở dashboard/danh sách hồ sơ. |
| Giao diện | Gần như không đổi: chỉ dòng thông báo dự phòng ở `AppraisalWorkspace.tsx` và `LoanDetailModal.tsx`. Mức nguy cơ Cao/Trung bình/Thấp tương ứng Khẩn+Quá hạn / Chú ý / Bình thường. |
| `backend/prisma/seed.js` | Bỏ hai hồ sơ mẫu thiếu lịch sử công đoạn (`SME-20260915-0002`, `SME-20260925-0004`) và dự báo v1 của chúng. Hồ sơ mẫu `SME-20260901-0001` giữ nguyên. |
| Dữ liệu demo | Thêm `backend/scripts/seed-demo.cjs` và `backend/prisma/demo-cases.json` (script `npm run seed:demo`). |
| Test | Thêm `prediction-features.test.cjs`, `prediction-scheduler.test.cjs`; sửa `sla-pa1-display.test.cjs`, `assignment-coordination-guards.test.cjs`, `scripts/check-sla-pa1.cjs`. **398 test backend đạt**, `check-sla-pa1.cjs` đạt 118/118. |
| Tài liệu | `docs/SME_MASTER.md` mục 5 và `docs/SME_KY_THUAT.md` mục 3 và 7 đã cập nhật. Các tệp trong `docs/ai/` là nhật ký làm việc (không thuộc bộ tài liệu chính). |

Tệp lớn **không push** (đã `.gitignore`): dữ liệu CSV và mô hình thử nghiệm trong `ml-service/experiments/v3` (khoảng 45 MB, tái tạo được từ seed). **Phải push** hai tệp mô hình đang chạy `ml-service/app/model/v4_tiep_nhan.joblib` và `v4_tham_dinh.joblib`.

## 3. Mô hình hiện đạt đến đâu (đọc kỹ trước khi báo cáo)

- Huấn luyện trên **dữ liệu giả lập** (20.000 hồ sơ, hình dạng thời gian chờ hiệu chỉnh theo BPI Challenge 2012). Mức thời gian là tham số demo, **chưa phải dữ liệu ngân hàng thật**. Kết quả chỉ chứng minh quy trình và cách mô hình hoạt động.
- Cấu hình SLA hiện hành: Tiếp nhận 112 giờ, Thẩm định 40 giờ làm việc. Trên tập test: ROC-AUC 0,82 (Tiếp nhận) và 0,72 (Thẩm định), đường cơ sở chỉ biết giờ đã dùng 0,80 và 0,69. **Mức hơn đường cơ sở nhỏ.** Giá trị chính là xác suất chuẩn, chấm định kỳ theo ngày và giải thích nguyên nhân. Ở 112 giờ chỉ có 38 hồ sơ trễ trong tập test nên số liệu Tiếp nhận nhiễu.
- Mức Chú ý báo nhầm khoảng 1% hồ sơ đúng hạn (Tiếp nhận) và 30% (Thẩm định); mức Khẩn báo nhầm 0,3% và 14%. Đừng trình bày như "đoán đúng hầu hết hồ sơ trễ": nhiều cảnh báo đến gần hạn.
- 194 hồ sơ demo là dữ liệu mô phỏng cho demo, **không dùng huấn luyện lại** mô hình (huấn luyện trên dữ liệu do chính mô phỏng sinh ra là vòng tròn).
- Chi tiết, kịch bản SLA khác (80/40, 54/44) và số liệu từng thời điểm: `ml-service/app/model/model_metadata.json`, mục 5 của Master. Tái lập: `ml-service/experiments/v3/README.md` (chạy trong container `smesystem-ml-service`).

## 4. Việc còn lại / cần quyết định

1. **CodeGraph**: lỗi do thư mục `SME SYSTEM` có dấu cách (thư viện giải mã sai `%20`). Sau khi đổi tên thành `SME_SYSTEM`, `npm run graph:build` và `graph:check` đạt (213 file). Máy nào còn thư mục có dấu cách thì đổi tên hoặc clone sang đường dẫn không có dấu cách. **Lưu ý Docker:** tên project Compose lấy từ tên thư mục; đổi tên thì Compose dùng volume Postgres mới (rỗng). Máy có dữ liệu cũ cần đặt `COMPOSE_PROJECT_NAME=<tên cũ>` trong `.env` cục bộ (máy của người phụ trách đã đặt `smesystem`), hoặc chạy lại `prisma:push`, `prisma:seed`, `seed:demo` trên volume mới.
2. **SLA 112/40 là giá trị trong `seed.js` của nhóm**, PO cần xác nhận lần cuối. Đổi định mức trong khoảng Tiếp nhận 24–128 giờ, Thẩm định 16–80 giờ thì mô hình dùng ngay; ngoài khoảng thì phải huấn luyện lại.
3. **Lịch 2026 kết thúc 31/12/2026**: sau ngày đó cần thêm lịch mới (`working-time.ts`, `sla-policy.ts`) và kích hoạt lại.
4. Bảng `delay_predictions` tăng theo số hồ sơ mở nhân số ngày (chấm định kỳ mỗi ngày); chưa có cơ chế dọn.
5. Chưa chạy kiểm thử giao diện thủ công trên trình duyệt cho các màn có dự báo; mới có test tự động và kiểm tra qua API.
6. Số tài liệu bổ sung chờ kiểm tra ở Tiếp nhận hiện xấp xỉ 0/1 (hệ thống chưa lưu số tài liệu).

## 5. Quay lui

- Mô hình/dịch vụ: khôi phục `ml-service/app` và `backend/src/modules/prediction` từ git; mô hình v1 `delay_model.joblib` vẫn còn trong repo.
- Dữ liệu demo: `DELETE FROM loan_applications WHERE company_id IN (SELECT id FROM companies WHERE tax_code LIKE 'DEMO%'); DELETE FROM companies WHERE tax_code LIKE 'DEMO%';` (tài khoản mô phỏng tắt/xóa trong màn quản trị).
- PA1/định mức: xóa dòng ở `sla_policy_activations` và đặt lại `workflow_stages.standard_sla_hours` nếu cần quay về cách tính cũ (công đoạn đang mở giữ cách tính đã chốt khi mở).

## 6. Kết quả kiểm tra cuối ngày 06/11/2026 (máy người phụ trách)

Kiểm tra lại toàn hệ thống sau khi đổi tên thư mục thành `SME_SYSTEM` và bật lại Docker:

| Hạng mục | Kết quả |
|---|---|
| Container (`backend`, `ml-service`, `frontend`, `db`, `mailpit`) | Chạy, đúng project `smesystem`, dữ liệu cũ còn nguyên |
| Schema DB so với `schema.prisma` | Khớp (so sánh rỗng) |
| API đa vai trò (đăng nhập 17 tài khoản, dashboard, danh sách/chi tiết hồ sơ, chạy lại dự báo, phân quyền 403) | 35/35 đạt |
| Dịch vụ mô hình (đơn điệu theo giờ đã dùng, quá hạn, SLA ngoài dải, thiếu trường, tối đa 3 lý do, health, metadata) | 17/17 đạt |
| Test backend | 398/398 đạt |
| `scripts/check-sla-pa1.cjs` (schema riêng, gọi ml-service thật) | 118/118 đạt |
| Test giao diện (20 bộ `npm run test:*`) | Đạt, trừ `test:role-recovery` (xem lưu ý 4) |
| `npx tsc -b` giao diện, build backend | Sạch lỗi |
| CodeGraph `graph:build`/`graph:check` | Đạt (213 file) |
| Bản sao chỉ gồm tệp sẽ push, DB trống: `db push` → `seed` → `build` → `seed:demo` | Đạt: 17 tài khoản, 195 hồ sơ, 14 dự báo |

Chưa kiểm tra: thao tác thủ công trên trình duyệt (mới có test tự động và gọi API; frontend trả HTTP 200).

## 7. Lưu ý để pull về chạy được

1. **Build lại container** sau khi pull: `docker compose up -d --build backend ml-service frontend`. Container cũ chạy mã cũ (ml-service cũ không có `/predict` mới).
2. **Tên thư mục quyết định tên project Docker.** Máy đổi tên thư mục (hoặc clone sang tên khác) sẽ có volume Postgres mới, rỗng, và phải chạy lại `prisma:push`, `prisma:seed`, `seed:demo`. Muốn giữ dữ liệu cũ: đặt `COMPOSE_PROJECT_NAME=<tên project cũ>` trong `.env` cục bộ (file này không push).
3. **Thư mục không được có dấu cách** nếu muốn dùng CodeGraph (`SME SYSTEM` lỗi, `SME_SYSTEM` chạy được).
4. **`test:role-recovery` có 2 ca lỗi từ trước** (Ca 2 và Ca 3 trong `frontend/scripts/check-delayed-session-recovery.mjs`). Đã chạy cùng test trên bản `HEAD` nguyên trạng (commit `fd09dbe`) và lỗi y hệt, nên không do đợt này. Chưa tìm nguyên nhân (ngoài phạm vi); cần xử lý riêng.
5. **`seed:demo` cần `npm run build` trước** (script đọc từ `backend/dist`) và cần PA1 đã được bật bởi `prisma:seed`; thiếu thì script dừng và nói rõ. Cần `ml-service` đang chạy để có dự báo; nếu không, hồ sơ vẫn được tạo và dự báo sẽ có ở lượt chấm 08:00 kế tiếp hoặc khi bấm chạy lại.
6. **Windows/Git Bash:** lệnh `docker cp`/`exec` với đường dẫn bắt đầu bằng `/` cần `MSYS_NO_PATHCONV=1`. Máy không có Python: huấn luyện/chạy thử mô hình dùng container `smesystem-ml-service` (xem `ml-service/experiments/v3/README.md`).
7. **Bảng `delay_predictions` tăng mỗi ngày làm việc** (chấm định kỳ). Tắt bằng `PREDICTION_SCAN_ENABLED=false` nếu không muốn khi phát triển.
8. **Lịch 2026 hết hạn 31/12/2026.** Sau ngày đó `seed:demo` và dự báo báo "ngoài kỳ bao phủ của lịch" cho đến khi thêm lịch mới.
9. **Dữ liệu và kết quả mô hình chỉ là mô phỏng.** Khi báo cáo, dùng đúng mục 3 ở trên; đừng gọi là "độ chính xác thực tế".
10. **Phần giải thích nguyên nhân** chỉ nêu các yếu tố vận hành (giờ đã dùng, thời gian không thao tác, bổ sung, tải cán bộ, hàng chờ, làm rõ...). Doanh thu, số năm hoạt động và thời hạn vay vẫn là đầu vào của mô hình nhưng bị loại khỏi lý do, vì trong dữ liệu mô phỏng chúng không làm chậm xử lý và chỉ là nhiễu.

## 8. Cập nhật giao diện và dữ liệu demo (cuối ngày 06/11/2026)

- **CBTD xem cảnh báo hồ sơ của mình:** thêm `GET /dashboard/my-warnings` (chỉ vai trò CBTD, máy chủ lọc theo người đăng nhập, chỉ đọc) và khối "Hồ sơ của tôi cần ưu tiên" ở đầu danh sách hồ sơ của CBTD (hồ sơ ở mức Chú ý, Khẩn, Quá hạn, xếp theo xác suất). Đây là **quyết định phân quyền mới**, đã ghi vào ma trận `backend/test/role-routes.test.cjs`; PO cần xác nhận.
- **Hiển thị mô hình rõ hơn, bố cục giữ nguyên:** nhãn Bình thường / Chú ý / Khẩn / Quá hạn thay mã Cao-Trung bình-Thấp; dòng "còn … giờ làm việc"; dòng nguồn "Mô hình dự báo trễ SLA v4.0 · cập nhật …" ở bảng cảnh báo sớm (Quản lý, Thẩm quyền), chi tiết hồ sơ, màn Thẩm định và màn làm việc CBTD. Danh sách hồ sơ có thêm chip "Dự báo: Chú ý/Khẩn" khi có cảnh báo. Hàm dùng chung: `frontend/src/slaDisplay.ts` (`alertDisplay`, `predictionHeadline`, `predictionModelNote`, `slaLeftText`). Test: `npm run test:prediction-ui`, `test:sla-display`.
- **Vì sao tài khoản CBTD từng thấy nhiều chức năng bị khóa:** hồ sơ demo bản đầu thiếu phiên bản chính sách nghiệp vụ (`businessPolicyVersion`) và thiếu tờ trình, nên giao diện coi là "hồ sơ quy trình cũ", đồng thời hồ sơ được giao ngẫu nhiên cho CBTD khác (CBTD chỉ sửa được hồ sơ của mình). Đã sửa trong `seed-demo.cjs`: mọi hồ sơ có `businessPolicyVersion`; hồ sơ Thẩm định có tờ trình đã trình (một hồ sơ đang chờ làm rõ); mỗi CBTD (kể cả `test_cbtd`) có một hồ sơ Tiếp nhận đang mở và gần như đều có một hồ sơ Thẩm định. Nút bị khóa **có chủ đích** khi: hồ sơ đang chờ doanh nghiệp bổ sung (`dat.nguyen`, `bao.phan`, `test_cbtd` có hồ sơ loại này), hồ sơ đã trình lên Thẩm định (CBTD chỉ xem), hoặc hồ sơ không phải của mình.
- **Hồ sơ demo hiện có 15 hồ sơ đang mở** (8 Tiếp nhận gồm 2 chờ doanh nghiệp, 7 Thẩm định). Thử nhanh: đăng nhập `nam.hoang` (Demo@2026) thấy hồ sơ Tiếp nhận và Thẩm định mức Khẩn; `nhung.nguyen` hoặc `ha.le` xem bảng cảnh báo sớm; `ha.le` mở hồ sơ Thẩm định để xem tờ trình và quyết định.
- **Backend:** `getEarlyWarningList` trả thêm `slaRemainingHours`, `slaOverdue`, `slaWaiting`, `modelVersion`. 401 test backend đạt.

## 9. Chỉnh giao diện theo phản hồi và hoàn thiện menu tài khoản (cuối ngày 06/11/2026)

- **Bỏ giải thích mô hình trên màn hình:** các dòng "Mô hình dự báo trễ SLA v4.0 · cập nhật…" và đoạn giải thích ở dashboard đã bỏ; khối "Hồ sơ của tôi cần ưu tiên" chỉ còn danh sách hồ sơ. Phần giải thích mức cảnh báo chuyển vào menu **Trợ giúp**.
- **Thứ tự cảnh báo:** Quá hạn, Khẩn, Chú ý (cùng mức thì xác suất cao trước) ở bảng cảnh báo sớm và khối ưu tiên của CBTD (`compareAlerts` trong `slaDisplay.ts`). Nhãn trong danh sách hồ sơ rút gọn còn "Khẩn" / "Chú ý" (rê chuột để xem xác suất).
- **Ô "Cảnh báo Khẩn" ở dashboard** (trước là "Cảnh báo Đỏ (> 70%)"): sửa chữ cho khớp ngưỡng thật và đếm theo **dự báo mới nhất** của hồ sơ đang xử lý. Trước đó đếm hồ sơ có *bất kỳ* dự báo cao nào, sẽ đếm thừa khi chấm định kỳ mỗi ngày. Lưu ý: con số này tính cả hồ sơ ở Tiếp nhận nên có thể lớn hơn số hồ sơ mức Khẩn trong bảng của Thẩm quyền (Thẩm quyền chỉ thấy từ Thẩm định trở đi).
- **Menu tài khoản (trước đây 5 mục bị khóa cứng):** `Hồ sơ` (xem thông tin tài khoản, chỉ đọc), `Cài đặt` (cỡ chữ Vừa/Lớn/Rất lớn, lưu trên trình duyệt), `Ngôn ngữ` (chỉ có Tiếng Việt; English ghi rõ chưa có bản dịch, chưa dịch giao diện), `Trợ giúp` (việc của từng vai trò, SLA và mức cảnh báo, vì sao nút bị khóa), `Quyền riêng tư` (dữ liệu lưu, ai xem được gì, mô hình dự báo). Mã: `frontend/src/components/AccountDialogs.tsx`, `frontend/src/userPreferences.ts`. Test: `npm run test:preferences`, `test:prediction-ui`.
- **Chưa làm (ngoài phạm vi lượt này):** menu "Quản lý vấn đề hồ sơ" và "Lịch sử hoạt động" vẫn ghi "Chưa triển khai" (backlog cũ của nhóm); giao diện chưa có bản tiếng Anh.
- **Dữ liệu demo:** thời gian trình tờ trình nay khớp lịch sử công đoạn (trước đó ghi thời điểm chạy script).

## 10. Kiểm tra toàn bộ giao diện và nghiệp vụ (cuối ngày 06/11/2026)

**Cách kiểm tra giao diện:** `ml-service/experiments/v3/tools/ui_audit.cjs` điều khiển Chrome headless qua giao thức DevTools (không cài thêm gì; cần Chrome, đặt đường dẫn bằng biến `CHROME` nếu khác mặc định). Với từng tài khoản: đăng nhập bằng form, mở từng mục menu, mở một hồ sơ, mở 5 mục menu tài khoản, đổi và trả lại cỡ chữ; ghi lỗi console, ngoại lệ, lời gọi API lỗi (HTTP 4xx/5xx), chữ rác (undefined, NaN, [object, Invalid Date), banner lỗi, nút bị khóa và chụp ảnh từng màn. Chỉ đọc dữ liệu. Chạy cho **17 tài khoản** (13 mô phỏng + 4 test cũ): không có lỗi console, ngoại lệ, API lỗi, chữ rác hay banner lỗi; tất cả mục menu theo quyền mở được; cỡ chữ đổi và trả lại đúng. Ví dụ: `node ui_audit.cjs <thư mục ảnh> nam.hoang:Demo@2026 ha.le:Demo@2026`.

**Kiểm tra nghiệp vụ trên dữ liệu:** 26 truy vấn tìm bất thường (công đoạn mở đúng một và khớp `current_stage`; trạng thái hợp lệ với công đoạn; thời gian vào/ra không hở không chồng; `is_delayed` khớp giờ ròng so với định mức; giờ tạm dừng = giờ thực − giờ ròng; hồ sơ duyệt/từ chối đủ số tiền, lãi suất, mã lý do; số tiền không vượt 10 tỷ; khoảng chờ doanh nghiệp khớp trạng thái và yêu cầu bổ sung; hồ sơ Thẩm định có tờ trình; hồ sơ mở có dự báo; người phụ trách là CBTD; người quyết định khác người phụ trách) đều **bằng 0**.

**Lỗi tìm thấy và đã sửa:**
1. Ô "Tỷ lệ đúng hạn SLA" ở dashboard hiện **100%** ("0/0 lượt, cách cũ") trong khi giờ làm việc thực tế 93,9%: số chính nay là giờ làm việc (PA1), cách cũ chỉ là dòng phụ.
2. Bảng "Phân tích điểm nghẽn" hiện 0 giờ, 0 lượt, 0% và "Ổn định" cho cả Thẩm định dù trễ 17,3% (đọc nhầm số liệu cách cũ): nay hiện số liệu PA1 làm chính và gắn cờ điểm nghẽn đúng.
3. Màn Điều chuyển & phân công **tự điền số điện thoại giả `0901234567`** cho cán bộ chưa có số: nay hiện "—". Cột "Hồ sơ cảnh báo đỏ (AI)" đổi thành "Hồ sơ cảnh báo Khẩn".
4. Ô "Cảnh báo Đỏ (> 70%)" ghi sai ngưỡng và đếm cả dự báo cũ: đã sửa (xem mục 9).
5. Thời gian trình tờ trình của hồ sơ demo ghi thời điểm chạy script: đã sửa (mục 9).
Các bộ test `test:prediction-ui` giữ các lỗi này không quay lại.

**Phát hiện chưa sửa (cần PO quyết định hoặc ngoài phạm vi):**
- **Xác nhận "đủ chứng từ" không kiểm tra có tệp nào được tải lên** (`LoanApplicationsService.checkDocuments` chỉ đổi trạng thái; hồ sơ demo có 0 tệp vẫn bấm được và có thể trình tờ trình với căn cứ trống). Đây là luật nghiệp vụ, không tự đổi; đề xuất bắt buộc có tối thiểu một chứng từ hoặc checklist đã duyệt trước khi xác nhận.
- Bảng điểm nghẽn ở dashboard rộng hơn khung ở màn 1440 px: cột "Đánh giá" phải cuộn ngang trong thẻ.
- Số "Cảnh báo Khẩn" ở dashboard tính cả hồ sơ Tiếp nhận nên có thể lớn hơn số hồ sơ Khẩn trong bảng của Thẩm quyền (chỉ thấy từ Thẩm định).
- Menu "Quản lý vấn đề hồ sơ", "Lịch sử hoạt động" vẫn "Chưa triển khai"; tên mục "Liên hệ cá nhân" (thực chất là quản lý người dùng) và các nhãn tiếng Anh xen tiếng Việt ("Bottleneck Analysis", "AI Early Warning Rankings") giữ nguyên.
- `test:role-recovery` 2 ca lỗi từ trước (xem mục 7).

**Menu tài khoản:** `Hồ sơ`, `Cài đặt`, `Trợ giúp`, `Quyền riêng tư` nay là **trang riêng** (nút "Quay lại"); `Ngôn ngữ` giữ dạng hộp thoại. Mã: `frontend/src/components/AccountPage.tsx`.

## 11. Rà soát danh sách chức năng theo actor (đề xuất, chờ người còn lại và PO xem xét)

**Kết quả đối chiếu với hệ thống (route backend và giao diện):** danh sách chức năng của đề tài đủ 30/31 mục; riêng "Xem báo cáo thống kê" của Quản lý chỉ đủ một phần (dashboard KPI, điểm nghẽn SLA, phân bố công đoạn; chưa có báo cáo theo khoảng thời gian, chưa lọc theo cán bộ/loại vay, chưa xuất file). "Duyệt báo xung đột lợi ích" là một lý do (`CONFLICT_OF_INTEREST`) của đề nghị điều phối, ưu tiên xếp đầu, không có màn riêng. "Khóa/mở khóa tài khoản" là ô "Tài khoản hoạt động" trong form sửa người dùng.

**Màn "Liên hệ doanh nghiệp" (menu của CBTD, Thẩm quyền, Quản lý):** không phải chức năng chính; chỉ là danh sách chỉ đọc 5 cột, không bấm vào xem được gì, CBTD chỉ thấy doanh nghiệp có hồ sơ của mình, trùng với bộ lọc "Doanh nghiệp, MST" của Danh sách hồ sơ; tên menu sai nghĩa. Phần hữu ích (kiểm tra mã số thuế) nằm trong form tạo hồ sơ và bước đối soát công ty. **Đề xuất:** (A) bỏ menu và gom vào "Danh sách hồ sơ" (khuyến nghị), hoặc (B) giữ, đổi tên "Doanh nghiệp", thêm cột số hồ sơ và cho bấm vào xem các hồ sơ của doanh nghiệp. Chưa sửa mã; chờ quyết định.

**Danh sách chức năng đề xuất sau khi gom (để vẽ use case):**

1. **Doanh nghiệp (Portal)**
   - Đăng ký và đăng nhập tài khoản (xác thực email, quên mật khẩu)
   - Lập đề nghị vay (lưu nháp, tải chứng từ, gửi)
   - Theo dõi đề nghị vay
   - Phản hồi yêu cầu của ngân hàng: sửa đề nghị bị trả lại; bổ sung chứng từ

2. **Cán bộ tín dụng**
   - Tiếp nhận hồ sơ vay: kiểm tra checklist; trả sửa đề nghị; đối soát công ty; tiếp nhận đề nghị; **tạo hồ sơ tại quầy** (thiếu trong danh sách cũ)
   - Hoàn thiện hồ sơ (gom "Quản lý chứng từ" và "Xác định hạn mức"): quản lý chứng từ; yêu cầu bổ sung; giải quyết bổ sung; xác nhận đủ hồ sơ; xác định hạn mức
   - Lập tờ trình: lưu nháp; trình; chỉnh sửa khi được yêu cầu làm rõ
   - Tra cứu hồ sơ vay (gồm tìm theo doanh nghiệp, mã số thuế)
   - Xem cảnh báo trễ SLA của hồ sơ mình phụ trách (mới)
   - **Gửi đề nghị điều phối** (nghỉ phép, quá tải, báo xung đột lợi ích): có trong hệ thống, thiếu trong danh sách cũ

3. **Cán bộ thẩm quyền**
   - Thẩm định hồ sơ vay: xem xét tờ trình; yêu cầu làm rõ
   - Quyết định tín dụng: phê duyệt; từ chối
   - Tra cứu hồ sơ và xem cảnh báo trễ SLA (từ công đoạn Thẩm định)

4. **Quản lý chi nhánh**
   - Phân công hồ sơ: phân công cán bộ tín dụng cho đề nghị Portal; điều chuyển hồ sơ
   - Xử lý đề nghị điều phối: duyệt, từ chối (gồm báo xung đột lợi ích; không tách thành chức năng riêng)
   - Duyệt đối soát công ty
   - Theo dõi hồ sơ: xem cảnh báo xử lý chậm; xem báo cáo thống kê (hiện chỉ là dashboard)
   - Đóng hồ sơ quá hạn

5. **Quản trị viên**
   - Quản lý người dùng: thêm; sửa; khóa và mở khóa
   - Cấu hình SLA

6. **Dùng chung (không vẽ riêng theo actor):** đăng nhập, đổi mật khẩu, thông báo nội bộ, trang thông tin cá nhân (Hồ sơ, Cài đặt, Trợ giúp, Quyền riêng tư, Ngôn ngữ).

**Việc còn mở:** báo cáo thống kê theo thời gian cho Quản lý (chưa làm); xác nhận "đủ chứng từ" chưa kiểm tra có tệp tải lên (mục 10); đổi tên menu "Liên hệ cá nhân" thành "Quản lý người dùng"; quyết định phương án A/B cho màn doanh nghiệp.

## 12. Báo cáo thống kê theo thời gian cho Quản lý (làm xong, 06/11/2026)

- **Chức năng:** khối "Báo cáo thống kê" ở cuối Dashboard tổng quan, **chỉ vai trò Quản lý chi nhánh**. Chọn nhanh 7 ngày, 30 ngày, tháng này, quý này, năm nay hoặc nhập khoảng ngày (tối đa 366 ngày, không vượt hôm nay). Hiển thị: hồ sơ tạo mới, hoàn tất, phê duyệt, từ chối, đóng quá hạn, tỷ lệ phê duyệt, tiền phê duyệt; bảng theo công đoạn (số lượt, lượt trễ, tỷ lệ trễ, giờ ròng trung bình, tính theo giờ làm việc PA1); bảng theo cán bộ tín dụng; theo loại vay; biểu đồ theo tháng; nút **Tải CSV** (mở được bằng Excel).
- **API:** `GET /dashboard/report?from=YYYY-MM-DD&to=YYYY-MM-DD` (mặc định 30 ngày gần nhất), chỉ Quản lý (403 với vai trò khác, 400 với ngày sai hoặc ở tương lai); ranh giới ngày theo giờ Việt Nam. Mã: `backend/src/modules/dashboard/dashboard-report.ts`; giao diện `frontend/src/components/PeriodReport.tsx`, `frontend/src/periodReport.ts`.
- **Quy ước tính:** hồ sơ mới theo ngày tạo, hoàn tất theo ngày hoàn tất; công đoạn tính theo công đoạn **kết thúc** trong kỳ và chỉ công đoạn PA1; bảng theo cán bộ gồm hồ sơ do cán bộ phụ trách. Đối chiếu: cả năm 195 hồ sơ mới khớp số hồ sơ trong DB.
- **Kiểm chứng:** 406/406 test backend (thêm 5 test báo cáo, ma trận quyền), `npm run test:period-report` (4 test), kiểm tra giao diện tài khoản Quản lý không lỗi. Chưa thử tải file CSV bằng trình duyệt thật.
- **Đặc tả C.14 "Xem báo cáo thống kê"** nên cập nhật: thêm bước chọn khoảng thời gian, xem các bảng thống kê và tải CSV; luồng ngoại lệ: ngày không hợp lệ, khoảng quá 366 ngày.
