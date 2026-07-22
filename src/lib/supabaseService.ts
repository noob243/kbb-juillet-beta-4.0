import { supabase } from './supabase';
import { AuditLog } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  table: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

// Table mapping from Firestore collections to Supabase tables
const tableMap: Record<string, string> = {
  'clients': 'clients',
  'cases': 'dossiers',
  'events': 'calendar_events',
  'tasks': 'tasks',
  'invoices': 'factures',
  'avocats': 'profiles',
  'personnels': 'personnel',
  'fournisseurs': 'fournisseurs',
  'auditLogs': 'audit_logs',
  'presences': 'presences',
  'correspondances': 'correspondances'
};

function getTableName(collectionName: string): string {
  return tableMap[collectionName] || collectionName;
}

export async function handleSupabaseError(error: any, operationType: OperationType, table: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  const errInfo: SupabaseErrorInfo = {
    error: error.message || String(error),
    authInfo: {
      userId: user?.id || null,
      email: user?.email || null,
    },
    operationType,
    table
  };
  console.error('Supabase Secure Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function sanitizeForSupabase(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof File) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForSupabase);
  }
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) continue;
    if (val instanceof File) continue;

    // Convert camelCase to snake_case if necessary for specific tables
    // For now, we'll keep it simple and assume the app will handle mapping or PostgreSQL will handle JSONB.
    // However, for top-level columns in the provided schema, we should be careful.
    clean[key] = sanitizeForSupabase(val);
  }
  return clean;
}

export function cleanAndDefaultRecord(collectionName: string, item: any): any {
  if (!item || typeof item !== 'object') return item;
  const cleaned = { ...item };

  if (collectionName === 'clients') {
    cleaned.name = cleaned.name || 'Sans nom';
    cleaned.contact = cleaned.contact || 'Aucun contact';
  } else if (collectionName === 'cases' || collectionName === 'dossiers') {
    cleaned.name = cleaned.name || 'Sans titre';
    cleaned.client = cleaned.client || 'Client inconnu';
    cleaned.status = cleaned.status || 'Nouveau';
  } else if (collectionName === 'events' || collectionName === 'calendar_events') {
    cleaned.name = cleaned.name || 'Sans nom';
    cleaned.type = cleaned.type || 'Autre';
    cleaned.date = cleaned.date || '';
    cleaned.lieu = cleaned.lieu || '';
  } else if (collectionName === 'tasks') {
    cleaned.name = cleaned.name || 'Tâche sans nom';
    cleaned.status = cleaned.status || 'Non effectué';
  } else if (collectionName === 'invoices' || collectionName === 'factures') {
    cleaned.status = cleaned.status || 'Non réglée';
  }

  return cleaned;
}

export async function dbCreateDoc<T extends { id: string | number }>(collectionName: string, id: string | number, data: Omit<T, 'id'>) {
  const table = getTableName(collectionName);
  try {
    const defaulted = cleanAndDefaultRecord(collectionName, { ...data, id });
    const sanitized = sanitizeForSupabase(defaulted);

    const { error } = await supabase.from(table).insert(sanitized);
    if (error) throw error;
    return true;
  } catch (error) {
    handleSupabaseError(error, OperationType.CREATE, table);
  }
}

export async function dbUpdateDoc<T extends { id: string | number }>(collectionName: string, id: string | number, data: Partial<T>) {
  const table = getTableName(collectionName);
  try {
    const sanitized = sanitizeForSupabase(data);
    const { error } = await supabase.from(table).update(sanitized).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    handleSupabaseError(error, OperationType.UPDATE, table);
  }
}

export async function dbDeleteDoc(collectionName: string, id: string | number) {
  const table = getTableName(collectionName);
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    handleSupabaseError(error, OperationType.DELETE, table);
  }
}

export async function seedCollectionIfEmpty<T extends { id: string | number }>(collectionName: string, initialData: T[]) {
  const table = getTableName(collectionName);
  try {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) throw error;

    if (!data || data.length === 0) {
      console.log(`Seeding Supabase table: ${table}`);
      for (const item of initialData) {
        const defaulted = cleanAndDefaultRecord(collectionName, item);
        const sanitized = sanitizeForSupabase(defaulted);
        await supabase.from(table).insert(sanitized);
      }
    }
  } catch (error) {
    console.error(`Failed to seed table ${table}:`, error);
  }
}

export async function syncLocalCollection<T extends { id: string | number }>(
  collectionName: string,
  localItems: T[]
): Promise<void> {
  const table = getTableName(collectionName);
  try {
    const { data: cloudData, error } = await supabase.from(table).select('id');
    if (error) throw error;

    if (!cloudData || cloudData.length === 0) {
      console.log(`Supabase ${table} is empty. Seeding with current local state...`);
      for (const item of localItems) {
        const defaulted = cleanAndDefaultRecord(collectionName, item);
        const sanitized = sanitizeForSupabase(defaulted);
        await supabase.from(table).insert(sanitized);
      }
      return;
    }

    const cloudIds = new Set(cloudData.map((d: any) => String(d.id)));
    let uploadedCount = 0;

    for (const item of localItems) {
      if (!cloudIds.has(String(item.id))) {
        const defaulted = cleanAndDefaultRecord(collectionName, item);
        const sanitized = sanitizeForSupabase(defaulted);
        const { error: insertError } = await supabase.from(table).insert(sanitized);
        if (!insertError) uploadedCount++;
      }
    }

    if (uploadedCount > 0) {
      console.log(`Uploaded ${uploadedCount} missing local records to Supabase for ${table}.`);
    }
  } catch (error) {
    console.error(`Failed to sync local collection ${collectionName} with Supabase:`, error);
  }
}

export async function dbCreateAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog | null> {
  const timestamp = new Date().toISOString();
  const { data: { user } } = await supabase.auth.getUser();

  const fullLog = {
    ...log,
    user_id: user?.id || null,
    timestamp
  };

  try {
    const sanitized = sanitizeForSupabase(fullLog);
    const { data, error } = await supabase.from('audit_logs').insert(sanitized).select().single();
    if (error) throw error;
    return data as AuditLog;
  } catch (error) {
    console.error('Failed to write audit log:', error);
    return null;
  }
}
