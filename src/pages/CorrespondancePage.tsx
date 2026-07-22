import React, { FC, useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
    dbCreateDoc, 
    dbUpdateDoc, 
    dbDeleteDoc, 
    dbCreateAuditLog
} from '../lib/supabaseService';
import { Client, Case, Avocat, Correspondance } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface CorrespondancePageProps {
    clients: Client[];
    cases: Case[];
    avocats: Avocat[];
    onSendEmail: (to: string, subject: string, body: string, recipientName?: string, attachmentName?: string) => void;
    currentUserInfo?: { name: string; role: string; email: string; id?: string } | null;
}

export const CorrespondancePage: FC<CorrespondancePageProps> = ({ 
    clients, 
    cases, 
    avocats, 
    onSendEmail, 
    currentUserInfo 
}) => {
    const [correspondances, setCorrespondances] = useState<Correspondance[]>([]);
    const [selectedCorr, setSelectedCorr] = useState<Correspondance | null>(null);
    const [isWriting, setIsWriting] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAvocatId, setFilterAvocatId] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<string>('All');

    const [formType, setFormType] = useState<'Lettre' | 'E-mail' | 'Mise en demeure' | 'Autre'>('Lettre');
    const [recipientName, setRecipientName] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [destinataire, setDestinataire] = useState('');
    const [avocatSignataireId, setAvocatSignataireId] = useState('');
    const [dateEmission, setDateEmission] = useState('');
    const [dateReception, setDateReception] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<'Brouillon' | 'Envoyé' | 'Reçu'>('Brouillon');
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [selectedProcedureId, setSelectedProcedureId] = useState('');
    const [customId, setCustomId] = useState('');
    const [piecesJointes, setPiecesJointes] = useState<Array<{ name: string; size: string; content?: string }>>([]);

    useEffect(() => {
        if (isWriting && !selectedCorr) {
            const year = new Date().getFullYear();
            const rand = Math.floor(100 + Math.random() * 900);
            setCustomId(`KBB-LET-GEN-${year}-${rand}`);
        }
    }, [isWriting, selectedCorr]);

    useEffect(() => {
        const fetchCorrespondances = async () => {
            const { data, error } = await supabase
                .from('correspondances')
                .select('*')
                .order('date', { ascending: false });

            if (!error && data) {
                setCorrespondances(data);
            }
        };

        fetchCorrespondances();

        const channel = supabase
            .channel('public:correspondances')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'correspondances' }, () => {
                fetchInitial();
            })
            .subscribe();

        const fetchInitial = fetchCorrespondances;

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredCorrespondances = useMemo(() => {
        return correspondances.filter(c => {
            const matchesSearch = 
                c.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.content.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesAvocat = filterAvocatId === 'All' || c.avocatSignataireId === filterAvocatId;
            const matchesStatus = filterStatus === 'All' || c.status === filterStatus;

            return matchesSearch && matchesAvocat && matchesStatus;
        });
    }, [correspondances, searchTerm, filterAvocatId, filterStatus]);

    const handleSaveCorrespondence = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        const isEditing = !!selectedCorr;
        const id = selectedCorr ? selectedCorr.id : crypto.randomUUID();

        const data: any = {
            id,
            date: selectedCorr ? selectedCorr.date : new Date().toISOString(),
            type: formType,
            recipient_name: recipientName,
            recipient_email: recipientEmail,
            subject,
            content,
            status,
            author_id: currentUserInfo?.id || null,
            dossier_id: selectedCaseId || null,
        };

        try {
            if (isEditing) {
                await dbUpdateDoc('correspondances', id, data);
            } else {
                await dbCreateDoc('correspondances', id, data);
            }
            setIsWriting(false);
            setSelectedCorr(data);
        } catch (err) {
            console.error("Save correspondence error:", err);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#070b13] overflow-hidden p-6">
            <h1 className="text-2xl font-bold">Correspondance (Supabase)</h1>
            {/* Minimal UI for now to verify data flow */}
            <div className="mt-4 flex gap-4">
                <div className="w-1/3 border-r pr-4">
                    <button onClick={() => setIsWriting(true)} className="bg-indigo-600 text-white p-2 rounded mb-4">Nouveau</button>
                    {filteredCorrespondances.map(c => (
                        <div key={c.id} onClick={() => { setSelectedCorr(c); setIsWriting(false); }} className="p-2 border-b cursor-pointer hover:bg-gray-100">
                            {c.subject} - {c.recipient_name}
                        </div>
                    ))}
                </div>
                <div className="flex-1 p-4">
                    {isWriting ? (
                        <form onSubmit={handleSaveCorrespondence} className="space-y-4">
                            <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Destinataire" className="block w-full border p-2" />
                            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet" className="block w-full border p-2" />
                            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Contenu" className="block w-full border p-2 h-64" />
                            <button type="submit" className="bg-green-600 text-white p-2 rounded">Enregistrer</button>
                        </form>
                    ) : selectedCorr ? (
                        <div>
                            <h2 className="text-xl font-bold">{selectedCorr.subject}</h2>
                            <p className="mt-2 whitespace-pre-wrap">{selectedCorr.content}</p>
                        </div>
                    ) : (
                        <p>Sélectionnez une correspondance.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CorrespondancePage;
