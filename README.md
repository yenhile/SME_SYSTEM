# SME Loan Workflow

Baseline triển khai theo tài liệu kiến trúc V0.1:

- `frontend`: React + TypeScript + Vite
- `backend`: Node.js + NestJS + Prisma
- `ml-service`: Python + FastAPI
- `db`: PostgreSQL

## Khởi chạy bằng Docker Compose

```bash
docker compose up --build -d
```

Các địa chỉ kiểm tra:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3001/api/health
- ML service health: http://localhost:8000/health
- PostgreSQL: `localhost:5432`

Tắt hệ thống:

```bash
docker compose down
```

Không dùng `docker compose down -v` nếu muốn giữ dữ liệu PostgreSQL.

Đây là 1 hệ thống quản lý vay nợ cho doanh nghiệp vừa & nhỏ.

nội dung àinsidbfuhnfdj