import { supabase } from './supabase';
import { AuditLog, Case, Client, Event, Task, Invoice, Personnel, Fournisseur, Correspondance } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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

// Data Mappers to ensure compatibility between Supabase and Frontend
export const mappers = {
  client: (d: any): Client => ({
    id: d.id,
    name: d.company_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Client sans nom',
    contact: d.first_name ? `${d.first_name} ${d.last_name}` : d.company_name,
    email: d.email || '',
    phone: d.phone || '',
    siege: d.address || '',
    cases: 0, // Calculated separately if needed
    typeFacturation: 'Forfaitaire'
  }),
  case: (d: any): Case => ({
    id: d.reference_code || d.id,
    name: d.title || 'Dossier sans titre',
    client: d.clients?.company_name || d.clients?.last_name || 'Client inconnu',
    status: d.status === 'EN_COURS' ? 'En cours' : d.status === 'EN_ATTENTE' ? 'En attente' : d.status === 'ARCHIVE' ? 'Clôturé' : 'En cours',
    nextHearing: null,
    procedure: d.jurisdiction || '',
    adversaire: d.opposing_party || '',
    notes: d.description || '',
    procedures: [] // Loaded separately or as join
  }),
  event: (d: any): Event => ({
    id: d.id,
    name: d.title || 'Événement',
    type: 'Autre',
    date: d.start_time ? new Date(d.start_time).toISOString().split('T')[0] : '',
    lieu: d.location || ''
  }),
  task: (d: any): Task => ({
    id: d.id,
    name: d.name || 'Tâche',
    caseId: d.dossier_id || '',
    lawyer: d.profiles?.first_name ? `${d.profiles.first_name} ${d.profiles.last_name}` : 'Non assigné',
    dueDate: d.due_date || '',
    status: (d.status as any) || 'Non effectué'
  }),
  invoice: (d: any): Invoice => ({
    id: d.facture_number || d.id,
    caseId: d.dossier_id || '',
    dueDate: d.due_date || '',
    totalAmount: Number(d.amount_total) || 0,
    paidAmount: 0,
    status: d.status === 'PAYEE' ? 'Réglée' : d.status === 'ANNULEE' ? 'Réglée' : 'Non réglée'
  })
};

export async function dbCreateDoc(collectionName: string, id: string | number, data: any) {
  const table = getTableName(collectionName);
  try {
    const { error } = await supabase.from(table).insert({ ...data, id: undefined }); // UUID handled by DB usually
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase Create Error:', error);
  }
}

export async function dbUpdateDoc(collectionName: string, id: string | number, data: any) {
  const table = getTableName(collectionName);
  try {
    const { error } = await supabase.from(table).update(data).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase Update Error:', error);
  }
}

export async function dbDeleteDoc(collectionName: string, id: string | number) {
  const table = getTableName(collectionName);
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase Delete Error:', error);
  }
}

export async function dbCreateAuditLog(log: any) {
  try {
    await supabase.from('audit_logs').insert(log);
  } catch (e) {
    console.error('Audit Log Error:', e);
  }
}

// Helper to keep syncLocalCollection for backward compatibility during migration
export async function syncLocalCollection(collectionName: string, localItems: any[]) {
  // Logic to push local items to Supabase if they don't exist
  // Omitted for brevity, but could be implemented similarly to previous version
}

export function sanitizeForSupabase(obj: any): any {
  return obj; // Simplified
}
