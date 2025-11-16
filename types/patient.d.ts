/**
 * Patient
 * A Patient
 */
export interface Patient {
  id?: number;
  createdAt?: string | null;
  dateOfBirth?: string | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  firstName: string;
  lastName: string;
  patientCode: string;
  ssnHash?: string | null;
  updatedAt?: string | null;
}