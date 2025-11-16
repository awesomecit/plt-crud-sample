/**
 * ReportVersion
 * A ReportVersion
 */
export interface ReportVersion {
  id?: number;
  changeReason?: string | null;
  changedBy: number;
  content: string;
  createdAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  diagnosis?: string | null;
  findings?: string | null;
  isCurrent?: string | null;
  reportId: number;
  title: string;
  versionNumber: number;
}