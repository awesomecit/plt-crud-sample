/**
 * ReportTag
 * A ReportTag
 */
export interface ReportTag {
  id?: number;
  deletedAt?: string | null;
  deletedBy?: number | null;
  reportId: number;
  tagId: number;
  taggedAt?: string | null;
  taggedBy: number;
}