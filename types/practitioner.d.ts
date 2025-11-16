/**
 * Practitioner
 * A Practitioner
 */
export interface Practitioner {
  id?: number;
  active?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  email: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  specialization?: string | null;
  updatedAt?: string | null;
}