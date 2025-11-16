/**
 * User
 * A User
 */
export interface User {
  id?: number;
  active?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  email: string;
  lastLoginAt?: string | null;
  passwordHash: string;
  practitionerId?: number | null;
  role?: string | null;
  updatedAt?: string | null;
  username: string;
}