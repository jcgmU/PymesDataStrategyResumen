import { z } from 'zod';

/**
 * Schema for user registration.
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type RegisterDto = z.infer<typeof registerSchema>;

/**
 * Schema for user login.
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof loginSchema>;

/**
 * Schema for updating user profile.
 */
export const updateUserSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'At least one field (name or email) must be provided',
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
