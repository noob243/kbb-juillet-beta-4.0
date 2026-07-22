import React, { FC, useState } from 'react';
import { Case, CaseProcedure } from '../types';
import { 
  ScaleIcon,
  PlusIcon,
  SearchIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  FileTextIcon,
  EditIcon,
  TrashIcon,
  FilterIcon,
  CheckIcon,
  AlertIcon,
  ClockIcon,
  UserIcon
} from '../components/Icons';
import { supabase } from '../lib/supabase';

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
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<CaseProcedure | null>(null);
  const [oldCaseId, setOldCaseId] = useState<string>(''); // To track if we changed the associated Case

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    instance: '',
    objet: '',
    dateDebut: new Date().toISOString().split('T')[0],
    dateFin: '',
    status: 'En cours',
    associatedCaseId: ''
  });

  // Flatmap all procedures from cases & supplement them with case context
  const allProcedures = Array.isArray(cases) ? cases.flatMap(c => {
    if (!c) return [];
    return (c.procedures || []).map(p => ({
      ...p,
      caseId: c.id,
      caseName: c.name,
      clientName: c.client
    }));
  }) : [];

  // Filter procedures
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

  // Stats calculate
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

    // Preparation of the payload for PostgreSQL (Supabase)
    const payload = {
      id: procedureId,
      dossier_id: formData.associatedCaseId,
      name: formData.name,
      instance: formData.instance,
      objet: formData.objet,
      date_debut: formData.dateDebut || null,
      date_fin: formData.dateFin || null,
      status: formData.status
    };

    try {
        const { error } = await (editingProcedure
            ? supabase.from('procedures').update(payload).eq('id', procedureId)
            : supabase.from('procedures').insert(payload));

        if (error) throw error;

        // Note: Real-time channel in App.tsx will handle UI update by re-fetching
        setIsModalOpen(false);
    } catch (err) {
        console.error("Save procedure error:", err);
        alert("Erreur lors de la sauvegarde de la procédure.");
    }
  };

  const handleDelete = async (procId: string, caseId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette procédure ? Cela ne supprimera pas le dossier rattaché.")) {
      try {
        const { error } = await supabase.from('procedures').delete().eq('id', procId);
        if (error) throw error;
      } catch (err) {
        console.error("Delete procedure error:", err);
        alert("Erreur lors de la suppression.");
      }
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
    if (s.includes('attente') || s.includes('Suspendu')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-150">
          <ClockIcon className="w-3.5 h-3.5 animate-pulse" /> Suspendu
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
            <ClockIcon className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-3xs font-black uppercase tracking-wider text-slate-400">Procédures Actives</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0e1726] p-5 rounded-2xl border border-gray-150 dark:border-slate-800/60 shadow-xs flex items-center space-x-4">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-650 dark:text-amber-400">
            <AlertIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-3xs font-black uppercase tracking-wider text-slate-400">En Suspens</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0e1726] p-5 rounded-2xl border border-gray-150 dark:border-slate-800/60 shadow-xs flex items-center space-x-4">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-650 dark:text-emerald-400">
            <CheckIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-3xs font-black uppercase tracking-wider text-slate-400">Terminées / Clôturées</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{closedCount}</p>
          </div>
        </div>
      </div>

      {/* Control Actions / Search Bar */}
      <div className="bg-white dark:bg-[#0e1726] border border-gray-150 dark:border-slate-800/60 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 font-bold" />
          <input 
            type="text" 
            placeholder="Rechercher une procédure, tribunal, dossier, client..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-200"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 py-1.5 px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              <option value="All">Tous les Statuts</option>
              <option value="En cours">En cours</option>
              <option value="En attente / Suspendu">En attente / Suspendu</option>
              <option value="Clôturé / Terminé">Clôturé / Terminé</option>
            </select>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 bg-[#15447c] hover:bg-[#15447c]/90 text-white font-black text-xs uppercase tracking-wider py-2 px-4 rounded-xl transition duration-350 shadow-sm"
          >
            <PlusIcon className="w-4 h-4" /> Nouvelle Procédure
          </button>
        </div>
      </div>

      {/* Procedures Listing Grid */}
      {filteredProcedures.length === 0 ? (
        <div className="bg-white dark:bg-[#0e1726] border border-gray-150 dark:border-slate-800/60 rounded-2xl p-12 text-center shadow-xs">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-350 mb-4 border border-dashed border-gray-250">
            <ScaleIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-black text-slate-700 dark:text-slate-300">Aucune procédure trouvée</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Créez votre première procédure juridique ou ajustez vos critères de filtrage de recherche.</p>
        </div>
      ) : (
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

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <FileTextIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Objet : <strong className="text-slate-800 dark:text-slate-200">{proc.objet || 'Non spécifié'}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <CalendarIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Période : <strong className="text-slate-800 dark:text-slate-200">
                      {(() => {
                        try {
                          return proc.dateDebut ? new Date(proc.dateDebut).toLocaleDateString('fr-FR') : 'N/A';
                        } catch (e) {
                          return 'N/A';
                        }
                      })()} — {(() => {
                        try {
                          return proc.dateFin ? new Date(proc.dateFin).toLocaleDateString('fr-FR') : 'En cours';
                        } catch (e) {
                          return 'En cours';
                        }
                      })()}
                    </strong></span>
                  </div>
                </div>

                {/* Attached Dossier Cardlet */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dossier Rattaché</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{proc.caseName}</p>
                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                      <UserIcon className="w-3 h-3 text-slate-400" /> Client: {proc.clientName}
                    </p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-lg text-slate-400">
                    <BriefcaseIcon className="w-4 h-4 text-indigo-500" />
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-2 border-t border-slate-50 dark:border-slate-800/30 pt-3.5 mt-4">
                <button
                  onClick={() => handleOpenEditModal(proc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#15447c] rounded-lg text-xs font-extrabold transition cursor-pointer"
                  title="Modifier la procédure"
                >
                  <EditIcon className="w-3.5 h-3.5" /> Modifier
                </button>
                <button
                  onClick={() => handleDelete(proc.id, proc.caseId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-extrabold transition cursor-pointer"
                  title="Supprimer la procédure"
                >
                  <TrashIcon className="w-3.5 h-3.5" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation & Edition Sidebar Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#0e1726] rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-150 dark:border-slate-800">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                {editingProcedure ? "Modifier la Procédure" : "Nouvelle Procédure"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Name field */}
              <div>
                <label className="block text-2xs font-black uppercase tracking-wider text-[#15447c] mb-1">Nom de la procédure <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Ex: Référé-provision, Divorce contentieux..."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-150 outline-hidden"
                  required
                />
              </div>

              {/* Instance field */}
              <div>
                <label className="block text-2xs font-black uppercase tracking-wider text-slate-400 mb-1">Instance (Tribunal)</label>
                <input
                  type="text"
                  placeholder="Ex: Tribunal de Commerce de Kinshasa"
                  value={formData.instance}
                  onChange={e => setFormData({ ...formData, instance: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-150 outline-hidden"
                />
              </div>

              {/* Objet field */}
              <div>
                <label className="block text-2xs font-black uppercase tracking-wider text-slate-400 mb-1">Objet de la Procédure</label>
                <input
                  type="text"
                  placeholder="Ex: Recouvrement forcé de créance"
                  value={formData.objet}
                  onChange={e => setFormData({ ...formData, objet: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-150 outline-hidden"
                />
              </div>

              {/* Date fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-black uppercase tracking-wider text-slate-400 mb-1">Date début</label>
                  <input
                    type="date"
                    value={formData.dateDebut}
                    onChange={e => setFormData({ ...formData, dateDebut: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-150 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-black uppercase tracking-wider text-slate-400 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={formData.dateFin}
                    onChange={e => setFormData({ ...formData, dateFin: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-150 outline-hidden"
                  />
                </div>
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-2xs font-black uppercase tracking-wider text-slate-400 mb-1 font-semibold">Statut de la Procédure</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-150 outline-hidden"
                >
                  <option value="En cours">En cours</option>
                  <option value="En attente / Suspendu">En attente / Suspendu</option>
                  <option value="Clôturé / Terminé">Clôturé / Terminé</option>
                </select>
              </div>

              {/* Associated Case Select */}
              <div>
                <label className="block text-2xs font-black uppercase tracking-wider text-[#15447c] mb-1">Dossier Rattaché <span className="text-red-500">*</span></label>
                <select
                  value={formData.associatedCaseId}
                  onChange={e => setFormData({ ...formData, associatedCaseId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-150 bg-white dark:bg-slate-900 outline-hidden"
                  required
                >
                  <option value="" disabled>-- Sélectionner un dossier --</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.id} - {c.name} ({c.client})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dialog control buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition duration-200 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-[#15447c] hover:bg-[#15447c]/90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition duration-200 cursor-pointer shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProceduresPage;
