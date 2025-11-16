/**
 * ReportType
 * A ReportType
 */
export interface ReportType {
  id?: number;
  code: string;
  createdAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  description?: string | null;
  name: string;
  retentionYears?: number | null;
  updatedAt?: string | null;
}