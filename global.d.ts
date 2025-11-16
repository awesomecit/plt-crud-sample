// Global TypeScript type definitions for Platformatic DB project

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      PLT_SERVER_HOSTNAME: string;
      PLT_SERVER_LOGGER_LEVEL: 'debug' | 'info' | 'warn' | 'error';
      DATABASE_URL: string;
      PLT_ADMIN_SECRET?: string;
      PLT_JWT_SECRET?: string;
      AUDIT_ENCRYPTION_KEY?: string;
      TSA_SERVICE_URL?: string;
    }
  }
}

// Platformatic DB Entity types (will be auto-generated)
export interface PlatformaticApp {
  platformatic: {
    entities: {
      report: any;
      reportVersion: any;
      patient: any;
      practitioner: any;
      reportType: any;
      user: any;
      tag: any;
      reportTag: any;
      attachment: any;
    };
    db: any;
    sql: any;
    addEntityHooks: (entityName: string, hooks: EntityHooks) => void;
  };
}

export interface EntityHooks {
  save?: (
    originalSave: Function,
    opts: { input: any; ctx?: any }
  ) => Promise<any>;
  delete?: (
    originalDelete: Function,
    opts: { where: any; ctx?: any }
  ) => Promise<any>;
  find?: (
    originalFind: Function,
    opts: { where?: any; includeDeleted?: boolean }
  ) => Promise<any[]>;
}

export interface AuditLogEntry {
  table_name: string;
  record_id: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'ACCESS';
  user_id?: number;
  user_ip?: string;
  changed_fields?: string; // JSON
  old_values?: string; // JSON
  new_values?: string; // JSON
  created_at?: string;
  checksum?: string;
}

export interface ReportVersion {
  id: number;
  report_id: number;
  version_number: number;
  content?: string;
  status?: string;
  is_current: boolean;
  changed_by?: number;
  change_reason?: string;
  digital_signature?: string;
  signature_algorithm?: string;
  signed_at?: string;
  signed_by?: number;
  created_at?: string;
  updated_at?: string;
}

export {};
