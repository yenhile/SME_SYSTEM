# Tóm tắt dự án SME Loan Workflow (dành cho AI/người mới đọc)

Cập nhật 01/11/2026. Mọi số liệu lấy từ kiểm chứng đã thực hiện trong repo; chỗ nào là ước lượng hoặc chưa kiểm chứng đều ghi rõ.

## 1. Dự án là gì

Hệ thống quản lý quy trình vay vốn doanh nghiệp nhỏ và vừa (SME) tại **một chi nhánh ngân hàng**. Ba việc chính:
1. Số hóa hồ sơ vay từ lúc doanh nghiệp nộp đến lúc có kết quả.
2. Đo thời gian xử lý (SLA) từng công đoạn.
3. Dùng mô hình học máy **cảnh báo sớm hồ sơ có nguy cơ trễ SLA**. Mô hình **không** quyết định tín dụng, không dự báo nợ xấu hay khả năng trả nợ.

Đây là đồ án có người duyệt nghiệp vụ gọi là **PO**. Mọi thay đổi về quy trình vay, quyền vai trò, ngưỡng tiền, SLA hoặc ý nghĩa ML phải do PO duyệt. Giảng viên (thầy) đánh giá đồ án.

## 2. Công nghệ

| Phần | Công nghệ |
|---|---|
| Backend | NestJS, Prisma 6, PostgreSQL 16 |
| Giao diện | React 18, Vite, TypeScript |
| Dịch vụ ML | FastAPI, scikit-learn |
| Chạy | Docker Compose: backend 3001, web 5173, ML 8000, DB 5432, Mailpit (hộp thư thử) 1025/8025 |

Quy ước: **chỉ dùng một cổng web 5173**. Repo: thư mục `backend/`, `frontend/`, `ml-service/`, `docs/`. Nhánh làm việc: `YenTrang`.

## 3. Quy trình vay

```
Doanh nghiệp nộp hồ sơ (Portal) → Quản lý giao hồ sơ cho CBTD
→ [TIẾP NHẬN] CBTD kiểm chứng từ
     thiếu/sai → yêu cầu bổ sung (SLA tạm dừng, có email) → doanh nghiệp bổ sung → kiểm lại
     ngày 5 chưa bổ sung → email nhắc tự động; ngày 10 quá hạn → Quản lý đóng hồ sơ
     đủ → CBTD xác nhận đủ chứng từ
→ [THẨM ĐỊNH] Thẩm quyền xem hồ sơ + dự báo ML → từ chối / phê duyệt (dưới 10 tỷ) / trình cấp trên
→ [CẤP TRÊN] (khoản trên 10 tỷ)
→ [HOÀN TẤT] Đã phê duyệt / Bị từ chối / Đóng do quá hạn bổ sung
```

Hồ sơ đi một chiều. Vòng lặp duy nhất là bổ sung chứng từ ở Tiếp nhận. Hạn ngày 5 và ngày 10 tính theo **ngày lịch**.

## 4. Actor và phạm vi

| Actor | Làm được | Bị chặn |
|---|---|---|
| Doanh nghiệp (Portal) | Đăng ký (xác minh email bằng mã 6 số), nộp hồ sơ, theo dõi, bổ sung | Xem hồ sơ khác, vào hệ thống nội bộ |
| CBTD (cán bộ tín dụng) | Xử lý hồ sơ **được giao** ở Tiếp nhận; sau khi chuyển Thẩm định chỉ **xem** hồ sơ của mình | Xem hồ sơ CBTD khác; tự thẩm định/phê duyệt hồ sơ mình phụ trách |
| Quản lý | Dashboard, doanh nghiệp, hồ sơ, Thẩm định (xem), điều chuyển CBTD, đóng hồ sơ quá hạn bổ sung | Tự giao hồ sơ cho mình; đóng hồ sơ mình phụ trách; xem danh sách người dùng |
| Thẩm quyền | Thẩm định, trình cấp trên, từ chối (có lý do), phê duyệt | Công đoạn Tiếp nhận |
| Admin | Quản lý tài khoản, cấu hình SLA | Xem hồ sơ vay; tự khóa mình/tự bỏ quyền Admin; khóa hoặc bỏ vai trò CBTD khi người đó còn hồ sơ chưa hoàn tất |

Tài khoản thử (chỉ môi trường local): `test_admin`, `test_cbtd`, `test_quan_ly`, `test_tham_quyen`, mật khẩu `123456`; Portal `doanhnghiep.test@example.test` / `Test123456`. Mật khẩu thử, phải đổi trước khi dùng thật. Vai trò được kiểm tra lại từ DB ở mỗi request.

## 5. SLA

- **Cách cũ (đang chạy):** giờ liên tục 24/7. Không thực tế vì tính cả đêm, cuối tuần.
- **PA1 (đã xây, đã nâng cấp vào hệ thống nhưng CHƯA BẬT):** tính theo giờ làm việc T2–T6, 08:00–12:00 và 13:00–17:00 (giờ Việt Nam), loại ngày lễ theo lịch có phiên bản, trừ thời gian chờ doanh nghiệp bổ sung. Mỗi công đoạn chốt cách tính lúc được mở, nên hai cách chạy song song. Bật PA1 cần **lịch ngày lễ thật** và **mốc T0** do PO chốt; hiện chỉ có lịch mô phỏng.
- Hàm chính: `workingHoursBetween`, `resolveStageSla`, `openStagePause`/`closeStagePause`, `computeStageClosing` trong `backend/src/modules/workflow/sla/`.
- SLA **không có đồng hồ chạy ngầm**: hệ thống ghi mốc thời gian và tính khi có thao tác hoặc khi mở hồ sơ.
- Bộ nhắc quá hạn bổ sung (email ngày 5, đánh dấu quá hạn ngày 10) là phần duy nhất tự chạy: **mỗi ngày một lần lúc 08:00 giờ Việt Nam**, cộng một lần quét bù 30 giây sau khi backend khởi động. Chỉ nhắc và đánh dấu, không tự đóng hồ sơ.

## 6. Mô hình ML (phần thầy đang chê)

- **Bài toán:** phân loại nhị phân "hồ sơ có trễ SLA không", trả xác suất và mức nguy cơ: Thấp (<40%), Trung bình (40–70%), Cao (≥70%).
- **Đầu vào (10 đặc trưng, hệ thống tự lấy):** số tiền vay, thời hạn, loại vay, ngành, số năm hoạt động, doanh thu, tỷ lệ nợ/vốn, số lần bổ sung, số hồ sơ cán bộ đang xử lý, thời gian ở công đoạn Tiếp nhận.
- **Dữ liệu:** `ml-service/data/synthetic_loan_delay_dataset.csv`, 3.000 hồ sơ **tự sinh** bằng `generate_synthetic_data.py` (hạt giống 42), 11,1% trễ. Nhãn "trễ" sinh từ **công thức do nhóm tự đặt** cộng nhiễu. **Chưa có dữ liệu thật nào.**
- **Huấn luyện:** đã chạy một lần (23/10/2026) bằng `train_and_compare.py`. Mô hình dùng: Random Forest (150 cây, độ sâu 8), so với Logistic Regression. Lưu ở `ml-service/app/model/delay_model.joblib` và `model_metadata.json`. Không có quá trình huấn luyện nào chạy liên tục.
- **Kết quả (tập kiểm thử 600 mẫu):** Random Forest accuracy 0,97, precision 0,83, recall 0,93, F1 0,87, ROC-AUC 0,99. Chi tiết: `docs/Bao_cao_Mo_hinh_Machine_Learning.md`.
- **Hạn chế cần hiểu đúng:**
  - Chỉ số cao chỉ cho thấy mô hình học lại công thức tự đặt, **không** chứng minh dự báo đúng hồ sơ thật.
  - `supplement_count` chi phối kết quả: bỏ nó thì ROC-AUC tụt từ 0,99 xuống 0,66.
  - Random Forest không hơn Logistic Regression trên dữ liệu này.
  - `debt_to_equity` hiện là số tạm tính (số tiền vay chia vốn điều lệ, mặc định 1,5), không phải dữ liệu nợ thật.
  - Ngưỡng cảnh báo chưa được PO chốt.
  - Khi công đoạn Tiếp nhận tính theo PA1, dự báo bị **ẩn** (trạng thái "không áp dụng") vì mô hình chưa huấn luyện lại cho giờ làm việc; hệ thống không hiển thị số giả.
- **Dữ liệu huấn luyện không nằm trong DB hệ thống.** Giao diện chỉ có hồ sơ trong PostgreSQL (hiện 4 hồ sơ thử), không thấy 3.000 dòng của CSV. Kết quả dự báo từng hồ sơ lưu ở bảng `delay_predictions`.
- **Việc đang chờ:** thầy yêu cầu tìm nguồn dữ liệu (dataset) để huấn luyện. Dữ liệu ngân hàng Việt Nam rất khó xin. Người dùng sẽ hỏi chuyên gia nhóm data về dữ liệu thật/công khai hay giả lập có cơ sở. Ý tưởng chưa kiểm chứng: bộ BPI Challenge 2017 (nhật ký quy trình vay), cần người có chuyên môn xác nhận có phù hợp không.

## 7. Quản lý dữ liệu

- Dữ liệu nghiệp vụ: PostgreSQL qua Prisma, khoảng 20 bảng (`backend/prisma/schema.prisma`). Lịch sử công đoạn ở `application_stage_history` là nguồn dữ liệu thật để huấn luyện lại về sau.
- Chứng từ: tệp trên đĩa, thông tin ở bảng `documents`/`portal_documents`.
- Chưa có: pipeline xuất dữ liệu từ DB để huấn luyện lại, quản lý phiên bản dữ liệu/mô hình riêng, sao lưu định kỳ tự động (chỉ có `pg_dump` thủ công khi nâng cấp).

## 8. Đã làm được

- Luồng vay 4 công đoạn đầy đủ; cổng Portal với xác minh email (thư gửi qua Mailpit, `http://localhost:8025`); bổ sung chứng từ, nhắc và đóng quá hạn.
- Phân quyền theo vai trò ở cả giao diện (menu, trang mặc định) và backend; người làm khác người duyệt; bảo vệ tài khoản quản trị.
- Bảo mật: `JWT_SECRET` bắt buộc (không còn khóa mặc định công khai), khóa đăng nhập 5 lần sai trong 15 phút (bộ đếm trong bộ nhớ), chứng từ đổi thì tự hủy "xác nhận đủ", điều chuyển CBTD trong một giao dịch có khóa hồ sơ.
- SLA PA1 đầy đủ 3 mốc (code + nâng cấp DB thật, chưa bật), Dashboard tách cũ/PA1.
- Nhãn "Tạo tại quầy" cho hồ sơ không đi qua Portal.
- Kiểm thử: backend 243/243 test đạt; 42 test giao diện đạt và build đạt; kịch bản tích hợp trên PostgreSQL thật (schema thử riêng) 119 điểm cho SLA PA1.
- Tài liệu: `docs/handover/HANDOVER_v2.1.md`, `docs/Ma_tran_AC_phan_quyen_1_chi_nhanh.md`, báo cáo ML, báo cáo rà soát gửi PO.
- Code đã push lên nhánh `YenTrang` (trừ commit `581ab76` về lịch quét hằng ngày, **chưa push**).

## 9. Chưa làm / đang chờ PO

| Việc | Tình trạng |
|---|---|
| Bật SLA PA1 | Chờ lịch ngày lễ thật và T0 từ PO |
| Tờ trình thẩm định (CBTD ghi ý kiến trước khi chuyển Thẩm quyền) | Có trong mô tả nghiệp vụ nhưng chưa có trong sản phẩm; cần thêm cột/bảng vào DB dùng chung nên chờ PO xác nhận |
| Kiêm nhiệm nhiều vai trò | Mới chặn trường hợp CBTD phụ trách tự duyệt; chưa có chính sách đầy đủ. Người phụ trách cũ sau điều chuyển vẫn thẩm định được hồ sơ đó (chưa tra lịch sử) |
| Hai đường tạo hồ sơ (trực tiếp tại quầy và Portal) | Đang giữ cả hai, chờ PO xác nhận |
| "Kiểm chứng từ hai lần" | Chỉ ghi cách hiểu vào tài liệu, chờ PO xác nhận |
| Công đoạn Cấp trên | PO từng nêu ý định bỏ nhưng chưa chốt; vẫn còn trong hệ thống |
| Ngưỡng cảnh báo ML | Chờ PO chốt |

## 10. Cần làm tiếp

1. **Mô hình:** có nguồn dữ liệu (thật, công khai, hoặc giả lập có cơ sở) → ánh xạ sang 10 đặc trưng → huấn luyện lại (gồm cả theo giờ làm việc của PA1) → đánh giá trung thực, tách rõ "khôi phục luật giả lập" và "dự báo thực tế" → PO chốt ngưỡng. Viết bước xuất dữ liệu từ `application_stage_history` để tích lũy dữ liệu thật.
2. Quyết định của PO ở mục 9, rồi bật PA1 theo quy trình trong handover (mục C.9.9 có cả cách quay lại).
3. Việc kỹ thuật: đổi `JWT_SECRET` (hiện 28 ký tự, nên từ 32 ký tự ngẫu nhiên trở lên) và mật khẩu thử; dọn dữ liệu mẫu giao diện không dùng và hai API liệt kê cán bộ trùng; sao lưu định kỳ.
4. Chạy thử toàn bộ luồng demo sau các thay đổi cuối và chuẩn bị kịch bản cho thầy.

## 11. Quy tắc làm việc với repo này

Theo `AGENTS.md`: đọc `Project.md` và chính sách trước khi làm; dùng CodeGraph (`npm run graph:check`, `graph:build`) khi sửa code; không tự đổi quy trình vay, quyền vai trò, ngưỡng tiền, SLA hay ý nghĩa ML; nếu yêu cầu bất hợp lý thì báo bằng chứng và đề xuất để PO duyệt; chỉ kết luận những kiểm chứng đã thực hiện; không tự push hoặc commit khi chưa được yêu cầu; không in bí mật. File `docs/ai/2026-10-24-tien-trinh-lam-viec.md` là nhật ký riêng của người dùng, không commit.
