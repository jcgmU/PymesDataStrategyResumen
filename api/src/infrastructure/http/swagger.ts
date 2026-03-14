import { createRequire } from 'module';
import type { SwaggerUiOptions } from 'swagger-ui-express';

// swagger-jsdoc ships as CJS with `export =` — use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const swaggerJSDoc: (options: object) => object = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'PymesDataStrategy API',
    version: '1.0.0',
    description:
      'API Gateway para la plataforma ETL con IA y Human-in-the-Loop para PYMES',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from POST /api/v1/auth/login',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Resource not found' },
            },
          },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              field: { type: 'string' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', description: 'JWT access token' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      Dataset: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'READY', 'ERROR', 'TRANSFORMED'],
          },
          originalFileName: { type: 'string' },
          storageKey: { type: 'string' },
          fileSizeBytes: { type: 'integer' },
          mimeType: { type: 'string' },
          schema: { type: 'object', nullable: true },
          metadata: { type: 'object', nullable: true },
          statistics: { type: 'object', nullable: true },
          userId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DatasetListItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'READY', 'ERROR', 'TRANSFORMED'],
          },
          originalFileName: { type: 'string' },
          fileSizeBytes: { type: 'integer' },
          mimeType: { type: 'string' },
          userId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      JobStatus: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['waiting', 'active', 'processing', 'completed', 'failed'],
          },
        },
      },
      Anomaly: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          datasetId: { type: 'string', format: 'uuid' },
          type: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          field: { type: 'string' },
          rowIndex: { type: 'integer' },
          originalValue: {},
          suggestedValue: {},
          status: {
            type: 'string',
            enum: ['PENDING', 'APPROVED', 'CORRECTED', 'DISCARDED'],
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  definition: swaggerDefinition,
  apis: [
    'src/infrastructure/http/routes/**/*.ts',
    'src/infrastructure/http/controllers/**/*.ts',
  ],
};

export const swaggerSpec = swaggerJSDoc(options);

export const swaggerUiOptions: SwaggerUiOptions = {
  customSiteTitle: 'PymesDataStrategy API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};
