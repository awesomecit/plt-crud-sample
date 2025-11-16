/**
 * Tag
 * A Tag
 */
export interface Tag {
  id?: number;
  category?: string | null;
  code: string;
  color?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: number | null;
  description?: string | null;
  name: string;
  updatedAt?: string | null;
}