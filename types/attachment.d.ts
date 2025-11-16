/**
 * Attachment
 * A Attachment
 */
export interface Attachment {
  id?: number;
  checksum?: string | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  fileSize: number;
  filename: string;
  mimeType: string;
  originalFilename: string;
  reportId: number;
  storagePath: string;
  uploadedAt?: string | null;
  uploadedBy: number;
}