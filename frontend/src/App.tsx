import { useEffect, useState } from 'react';

type Health = {
  status: string;
  services: {
    backend: string;
    database: string;
    prediction: string;
  };
  timestamp: string;
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((response) => {
        if (!response.ok) throw new Error('Backend unavailable');
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch(() => setError(true));
  }, []);

  return (
    <main>
      <section className="card">
        <p className="eyebrow">SME LOAN WORKFLOW</p>
        <h1>Hệ thống đã được triển khai</h1>
        <p className="subtitle">
          Baseline React SPA, NestJS, PostgreSQL và FastAPI đang sẵn sàng để phát triển nghiệp vụ.
        </p>
        <div className="status">
          <span className={error ? 'dot error' : health ? 'dot ready' : 'dot'} />
          {error ? 'Không kết nối được backend' : health ? 'Các dịch vụ đang hoạt động' : 'Đang kiểm tra dịch vụ…'}
        </div>
        {health && (
          <dl>
            <div><dt>Backend</dt><dd>{health.services.backend}</dd></div>
            <div><dt>PostgreSQL</dt><dd>{health.services.database}</dd></div>
            <div><dt>Prediction API</dt><dd>{health.services.prediction}</dd></div>
          </dl>
        )}
      </section>
    </main>
  );
}
