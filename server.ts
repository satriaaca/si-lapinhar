import express from 'express';
import { createServer as createViteServer } from 'vite';
import app, { cleanNomorSurat, BENCHMARK_LAPINHAR, BENCHMARK_PDF_BBM } from './api/index.ts';

const port = parseInt(process.env.PORT || '3000', 10);

// Mount Vite middleware for dev or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SIAP-LAPINHAR Server running at http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { cleanNomorSurat, BENCHMARK_LAPINHAR, BENCHMARK_PDF_BBM };
export default app;
