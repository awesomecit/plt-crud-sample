/**
 * Report
 * A Report
 */
export interface Report {
  id?: number;
  content: string;
  createdAt?: string | null;
  currentVersionId?: number | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  diagnosis?: string | null;
  findings?: string | null;
  lastModifiedBy?: number | null;
  patientId: number;
  practitionerId: number;
  reportDate: string;
  reportNumber: string;
  reportTypeId: number;
  signatureHash?: string | null;
  signedAt?: string | null;
  status?: string | null;
  title: string;
  updatedAt?: string | null;
}