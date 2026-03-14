import { Router } from 'express';
import type { Container } from '../../config/container.js';
import { AuthController } from '../controllers/AuthController.js';
import { createAuthMiddleware } from '../middleware/AuthMiddleware.js';

/**
 * Create auth and user profile routes.
 */
export function createAuthRoutes(container: Container): Router {
  const router = Router();
  const controller = new AuthController(container);
  const authMiddleware = createAuthMiddleware(container.jwtService);

  /**
   * @openapi
   * /auth/register:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Register a new user
   *     description: Creates a new user account with email and password.
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - name
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *               name:
   *                 type: string
   *                 minLength: 2
   *                 example: Jane Doe
   *               password:
   *                 type: string
   *                 format: password
   *                 minLength: 8
   *                 example: secret1234
   *     responses:
   *       '201':
   *         description: User created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/AuthTokens'
   *       '400':
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationErrorResponse'
   *       '409':
   *         description: Email already registered
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // POST /api/v1/auth/register
  router.post('/auth/register', (req, res, next) => {
    controller.register(req, res, next).catch(next);
  });

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Log in and obtain a JWT token
   *     description: Authenticates user credentials and returns a JWT access token.
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *               password:
   *                 type: string
   *                 format: password
   *                 example: secret1234
   *     responses:
   *       '200':
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/AuthTokens'
   *       '400':
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationErrorResponse'
   *       '401':
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // POST /api/v1/auth/login
  router.post('/auth/login', (req, res, next) => {
    controller.login(req, res, next).catch(next);
  });

  /**
   * @openapi
   * /users/me:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get the current authenticated user's profile
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: User profile returned successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       '401':
   *         description: Missing or invalid JWT token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '404':
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // GET /api/v1/users/me — requires auth
  router.get('/users/me', authMiddleware, (req, res, next) => {
    controller.getMe(req, res, next).catch(next);
  });

  /**
   * @openapi
   * /users/me:
   *   patch:
   *     tags:
   *       - Users
   *     summary: Update the current authenticated user's profile
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 2
   *                 example: Jane Updated
   *               email:
   *                 type: string
   *                 format: email
   *                 example: newemail@example.com
   *     responses:
   *       '200':
   *         description: User profile updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       '400':
   *         description: Validation error — at least one field required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationErrorResponse'
   *       '401':
   *         description: Missing or invalid JWT token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // PATCH /api/v1/users/me — requires auth
  router.patch('/users/me', authMiddleware, (req, res, next) => {
    controller.updateMe(req, res, next).catch(next);
  });

  return router;
}
