import React, { FC, useState, useRef, useEffect } from 'react';
import { Task, Case, Avocat } from '../../types';
import { playAlarmSound, stopAllAlarmSounds } from '../../utils/audio';
import { FormField, FormInput, FormSelect, FormTextarea } from '../common/FormControls';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'>) => void;
  cases: Case[];
  lawyers: string[];
  avocats?: Avocat[];
}

const TaskModal: FC<TaskModalProps> = ({ isOpen, onClose, onSave, cases, lawyers, avocats = [] }) => {
    const today = new Date().toISOString().split('T')[0];
    const initialFormState = {
        name: '',
        caseId: '',
        lawyer: lawyers[0] || '',
        dueDate: today,
        startDate: today,
        endDate: today,
        status: 'Non effectué' as Task['status'],
        notes: '',
        procedureLinkedIds: [] as string[],
        procedureLinked: '',
        associatedLawyers: [] as string[],
        rapport: '',
        reminderEnabled: false,
        reminderDate: today,
        reminderTime: '09:00',
        reminderSound: 'digital' as 'digital' | 'bell' | 'marimba' | 'classic',
        attachments: [] as Array<{ name: string; size: string; content?: string }>,
    };
    const [formData, setFormData] = useState(initialFormState);
    const [selectedProcedureKey, setSelectedProcedureKey] = useState('');
    const [isLawyersDropdownOpen, setIsLawyersDropdownOpen] = useState(false);
    const lawyersDropdownRef = useRef<HTMLDivElement>(null);

    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const stopPreviewRef = useRef<(() => void) | null>(null);

    // Calculate flat list of procedures
    const availProcedures = cases.flatMap(c => {
        const list = [];
        if (c.procedures && c.procedures.length > 0) {
            c.procedures.forEach(p => {
                list.push({
                    key: `${c.id}:::${p.id}`,
                    id: p.id,
                    name: p.name || 'Sans nom',
                    caseId: c.id,
                    caseName: c.name,
                    client: c.client
                });
            });
        }
        
        if (c.procedure && (!c.procedures || !c.procedures.some(p => p.name === c.procedure))) {
            list.push({
                key: `${c.id}:::PRIMARY`,
                id: 'PRIMARY',
                name: c.procedure,
                caseId: c.id,
                caseName: c.name,
                client: c.client
            });
        }

        if ((!c.procedures || c.procedures.length === 0) && !c.procedure) {
            list.push({
                key: `${c.id}:::GENERAL`,
                id: 'GENERAL',
                name: 'Procédure Générale',
                caseId: c.id,
                caseName: c.name,
                client: c.client
            });
        }
        return list;
    });

    useEffect(() => {
        if (isOpen) {
            setFormData(initialFormState);
            setSelectedProcedureKey('');
            setIsPlayingPreview(false);
            stopAllAlarmSounds();
        }
        return () => {
            stopAllAlarmSounds();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
            return;
        }

        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === 'endDate' || name === 'dueDate') {
                next.dueDate = value;
                next.endDate = value;
                next.reminderDate = value;
            }
            return next;
        });
    };

    const handleProcedureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const key = e.target.value;
        setSelectedProcedureKey(key);
        if (key) {
            const [caseId, procId] = key.split(':::');
            const foundProc = availProcedures.find(p => p.key === key);
            setFormData(prev => ({
                ...prev,
                caseId: caseId,
                procedureLinkedIds: [procId],
                procedureLinked: foundProc ? foundProc.name : ''
            }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.caseId) {
            alert("Veuillez sélectionner une procédure.");
            return;
        }

        onSave({
            name: formData.name,
            caseId: formData.caseId,
            lawyer: formData.lawyer,
            dueDate: formData.endDate || formData.dueDate,
            status: formData.status as Task['status'],
            notes: formData.notes,
            procedureLinked: formData.procedureLinked || '',
            procedureLinkedIds: formData.procedureLinkedIds,
            startDate: formData.startDate,
            endDate: formData.endDate,
            associatedLawyers: formData.associatedLawyers,
            rapport: formData.rapport,
            reminderEnabled: formData.reminderEnabled,
            reminderDate: formData.reminderEnabled ? formData.reminderDate : undefined,
            reminderTime: formData.reminderEnabled ? formData.reminderTime : undefined,
            reminderSound: formData.reminderEnabled ? formData.reminderSound : undefined,
            reminderTriggered: false,
            attachments: formData.attachments,
        });

        stopAllAlarmSounds();
        onClose();
    };

    const allLawyersList = avocats.length > 0 ? avocats.map(a => a.fullName) : lawyers;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        Créer une nouvelle tâche
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg cursor-pointer">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Intitulé & Procédure */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <FormField label="Nom de la Tâche" required>
                                <FormInput
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Ex: Assister à l'audience de référé"
                                    required
                                />
                            </FormField>
                        </div>

                        <div className="md:col-span-2">
                            <FormField label="Procédure Associée" required>
                                <FormSelect
                                    name="selectedProcedureKey" 
                                    value={selectedProcedureKey} 
                                    onChange={handleProcedureChange} 
                                    required
                                >
                                    <option value="" disabled>-- Sélectionner une procédure --</option>
                                    {availProcedures.map(p => (
                                        <option key={p.key} value={p.key}>
                                            {p.name} — Dossier: {p.caseName} ({p.client})
                                        </option>
                                    ))}
                                </FormSelect>
                            </FormField>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <FormField label="Date de début">
                            <FormInput type="date" name="startDate" value={formData.startDate} onChange={handleChange} />
                        </FormField>
                        <FormField label="Date de fin">
                            <FormInput type="date" name="endDate" value={formData.endDate} onChange={handleChange} />
                        </FormField>
                    </div>

                    {/* Responsable & Statut */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Responsable principal">
                            <FormSelect name="lawyer" value={formData.lawyer} onChange={handleChange}>
                                <option value="">-- Aucun avocat responsable --</option>
                                {allLawyersList.map(l => <option key={l} value={l}>{l}</option>)}
                            </FormSelect>
                        </FormField>
                        <FormField label="Statut de la Tâche">
                            <FormSelect name="status" value={formData.status} onChange={handleChange}>
                                <option value="Non effectué">Non effectué</option>
                                <option value="Effectué à moitié">Effectué à moitié</option>
                                <option value="Effectué">Effectué</option>
                            </FormSelect>
                        </FormField>
                    </div>

                    {/* Rapport & Compte-rendu */}
                    <FormField label="Rapport & Compte-rendu de la Tâche">
                        <FormTextarea
                            name="rapport"
                            value={formData.rapport}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Rédigez le rapport officiel d'audience, conclusions ou compte-rendu..."
                        />
                    </FormField>

                    {/* Notes */}
                    <FormField label="Notes / Détails supplémentaires">
                        <FormTextarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Ajoutez des détails privés ou précisions..."
                        />
                    </FormField>

                    {/* Boutons d'action */}
                    <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                        <button type="button" onClick={onClose} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-5 text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer">
                            Annuler
                        </button>
                        <button type="submit" className="bg-indigo-600 text-white font-bold py-2.5 px-6 text-xs rounded-xl hover:bg-indigo-700 transition shadow-xs cursor-pointer">
                            Enregistrer la tâche
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskModal;
