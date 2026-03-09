import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Container } from '../config/container.js';
import { createRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Create and configure the Express application.
 */
export function createServer(container: Container): Express {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Routes
  app.use(createRoutes(container));

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the HTTP server.
 */
export function startServer(
  app: Express,
  port: number
): Promise<ReturnType<Express['listen']>> {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`API Gateway listening on port ${String(port)}`);
      console.log(`Health check: http://localhost:${String(port)}/health`);
      resolve(server);
    });
  });
}
