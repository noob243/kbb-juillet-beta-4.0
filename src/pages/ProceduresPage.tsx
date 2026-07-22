import React, { FC, useState } from 'react';
import { Case, CaseProcedure } from '../types';
import { 
  ScaleIcon,
  SearchIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  EditIcon,
  TrashIcon,
  AlertIcon,
  CheckIcon,
  UserIcon,
  PlusIcon,
  ClockIcon
} from '../components/Icons';
import { supabase } from '../lib/supabase';

// Fallbacks for specific icons not in library
const FilterIcon = () => <span>🔍</span>;

interface ProceduresPageProps {
  cases: Case[];
  onUpdateCase: (updatedCase: Case) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

const ProceduresPage: FC<ProceduresPageProps> = ({ cases = [], onUpdateCase, searchQuery: parentSearchQuery, setSearchQuery: parentSetSearchQuery }) => {
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = parentSearchQuery !== undefined ? (parentSearchQuery || '') : localSearchQuery;
  const setSearchQuery = parentSetSearchQuery !== undefined ? parentSetSearchQuery : setLocalSearchQuery;
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<CaseProcedure | null>(null);
  const [oldCaseId, setOldCaseId] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    instance: '',
    objet: '',
    dateDebut: new Date().toISOString().split('T')[0],
    dateFin: '',
    status: 'En cours',
    associatedCaseId: ''
  });

  const allProcedures = Array.isArray(cases) ? cases.flatMap(c => {
    if (!c) return [];
    return (c.procedures || []).map(p => ({
      ...p,
      caseId: c.id,
      caseName: c.name,
      clientName: c.client
    }));
  }) : [];

  const filteredProcedures = allProcedures.filter(proc => {
    if (!proc) return false;
    const name = proc.name || '';
    const instance = proc.instance || '';
    const objet = proc.objet || '';
    const caseName = proc.caseName || '';
    const clientName = proc.clientName || '';
    const sQuery = (searchQuery || '').toLowerCase();

    const matchesSearch =
      name.toLowerCase().includes(sQuery) ||
      instance.toLowerCase().includes(sQuery) ||
      objet.toLowerCase().includes(sQuery) ||
      caseName.toLowerCase().includes(sQuery) ||
      clientName.toLowerCase().includes(sQuery);
      
    const matchesStatus = statusFilter === 'All' || proc.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalCount = allProcedures.length;
  const activeCount = allProcedures.filter(p => p.status === 'En cours').length;
  const pendingCount = allProcedures.filter(p => p.status?.includes('attente') || p.status?.includes('Suspendu')).length;
  const closedCount = allProcedures.filter(p => p.status?.includes('Clôturé') || p.status?.includes('Terminé')).length;

  const handleOpenAddModal = () => {
    setEditingProcedure(null);
    setOldCaseId('');
    setFormData({
      name: '',
      instance: '',
      objet: '',
      dateDebut: new Date().toISOString().split('T')[0],
      dateFin: '',
      status: 'En cours',
      associatedCaseId: (Array.isArray(cases) && cases[0]?.id) ? cases[0].id : ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (proc: any) => {
    setEditingProcedure(proc);
    setOldCaseId(proc.caseId);
    setFormData({
      name: proc.name,
      instance: proc.instance || '',
      objet: proc.objet || '',
      dateDebut: proc.dateDebut || '',
      dateFin: proc.dateFin || '',
      status: proc.status || 'En cours',
      associatedCaseId: proc.caseId
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.associatedCaseId) {
      alert("Veuillez sélectionner un dossier.");
      return;
    }

    const procedureId = editingProcedure ? editingProcedure.id : crypto.randomUUID();
    const payload = {
      id: procedureId,
      dossier_id: formData.associatedCaseId,
      name: formData.name,
      instance: formData.instance,
      objet: formData.objet,
      date_debut: formData.dateDebut,
      date_fin: formData.dateFin,
      status: formData.status
    };

    try {
        const { error } = await (editingProcedure
            ? supabase.from('procedures').update(payload).eq('id', procedureId)
            : supabase.from('procedures').insert(payload));

        if (error) throw error;
        setIsModalOpen(false);
    } catch (err) {
        console.error("Save procedure error:", err);
    }
  };

  const handleDelete = async (procId: string) => {
    if (window.confirm("Supprimer cette procédure ?")) {
        await supabase.from('procedures').delete().eq('id', procId);
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    const s = status || 'En cours';
    if (s.includes('Clôturé') || s.includes('Terminé')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-150">
          <CheckIcon className="w-3.5 h-3.5" /> Clôturé
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-150">
        <AlertIcon className="w-3.5 h-3.5" /> En cours
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0e1726] p-5 rounded-2xl border border-gray-150 dark:border-slate-800/60 shadow-xs flex items-center space-x-4">
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[#15447c] dark:text-indigo-400">
            <ScaleIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-3xs font-black uppercase tracking-wider text-slate-400">Total Procédures</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{totalCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0e1726] p-5 rounded-2xl border border-gray-150 dark:border-slate-800/60 shadow-xs flex items-center space-x-4">
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-650 dark:text-indigo-400">
            <ClockIcon />
          </div>
          <div>
            <p className="text-3xs font-black uppercase tracking-wider text-slate-400">Actives</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{activeCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-[#0e1726] border border-gray-150 dark:border-slate-800/60 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 font-bold" />
          <input 
            type="text" 
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200"
          />
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1.5 bg-[#15447c] hover:bg-[#15447c]/90 text-white font-black text-xs uppercase tracking-wider py-2 px-4 rounded-xl transition shadow-sm"
        >
          <PlusIcon /> Nouvelle Procédure
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredProcedures.map((proc) => (
            <div 
              key={proc.id} 
              className="bg-white dark:bg-[#0e1726] border border-gray-150 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 shadow-xs transition duration-300 relative flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <span className="text-[10px] font-black tracking-widest text-[#15447c] uppercase font-mono">{proc.id}</span>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5 leading-snug">{proc.name}</h3>
                  </div>
                  {getStatusBadge(proc.status)}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800/50 pt-3 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <BuildingIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Instance : <strong className="text-slate-800 dark:text-slate-200">{proc.instance || 'Non spécifiée'}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-50 dark:border-slate-800/30 pt-3.5 mt-4">
                <button onClick={() => handleOpenEditModal(proc)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#15447c] rounded-lg text-xs font-extrabold transition">
                  <EditIcon className="w-3.5 h-3.5" /> Modifier
                </button>
                <button onClick={() => handleDelete(proc.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-extrabold transition">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0e1726] rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-150 dark:border-slate-800">
            <form onSubmit={handleSave} className="space-y-4">
              <h2 className="text-lg font-black">{editingProcedure ? 'Modifier' : 'Nouveau'}</h2>
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nom..." className="w-full p-2 border rounded" required />
              <select value={formData.associatedCaseId} onChange={e => setFormData({ ...formData, associatedCaseId: e.target.value })} className="w-full p-2 border rounded" required>
                <option value="">Sélectionner Dossier</option>
                {Array.isArray(cases) && cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="submit" className="w-full bg-[#15447c] text-white p-2 rounded">Enregistrer</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full bg-gray-200 p-2 rounded">Annuler</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProceduresPage;
