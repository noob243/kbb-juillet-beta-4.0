import React, { useState, useEffect, useMemo } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import CasesPage from './pages/CasesPage';
import ProceduresPage from './pages/ProceduresPage';
import EventsPage from './pages/EventsPage';
import AgendaPage from './pages/AgendaPage';
import ChatPage from './pages/ChatPage';
import BillingPage from './pages/BillingPage';
import AvocatsPage from './pages/AvocatsPage';
import PersonnelsPage from './pages/PersonnelsPage';
import FournisseursPage from './pages/FournisseursPage';
import GestionPage from './pages/GestionPage';
import AuditLogsPage from './pages/AuditLogsPage';
import { Client, Case, Event, Task, Invoice, Avocat, Personnel, Fournisseur, AuditLog, Correspondance } from './types';
import { supabase } from './lib/supabase';
import { 
    dbCreateDoc, 
    dbUpdateDoc, 
    dbDeleteDoc, 
    mappers
} from './lib/supabaseService';
import { motion, AnimatePresence } from 'motion/react';
import { getLocalUsers, syncUsersWithFirestore } from './services/userService';
import { AppUser } from './types/rbac';
import { ALL_MODULE_PERMISSIONS } from './services/rbacService';

function App() {
    const [isAuthenticated, setIsAuthenticated] = usePersistentState('kbb_auth', false);
    const [currentUserInfo, setCurrentUserInfo] = usePersistentState<{ name: string; role: string; email: string; id?: string } | null>('kbb_currentUserInfo', null);
    const [currentUserObj, setCurrentUserObj] = usePersistentState<AppUser | null>('kbb_currentUserObj', null);
    const [currentPage, setCurrentPage] = useState('Dashboard');

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                setIsAuthenticated(true);
            } else if (event === 'SIGNED_OUT') {
                setIsAuthenticated(false);
                setCurrentUserInfo(null);
                setCurrentUserObj(null);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (currentUserInfo?.email) {
            const users = getLocalUsers();
            const found = users.find(u => u.email.toLowerCase() === currentUserInfo.email.toLowerCase());
            const roleLower = (currentUserInfo.role || '').toLowerCase();
            const isAdminOrDirecteur = currentUserInfo.role === 'Admin' ||
                roleLower.includes('admin') ||
                roleLower.includes('directeur') ||
                roleLower.includes('associé') ||
                roleLower.includes('partner') ||
                currentUserInfo.email === 'admin@kbb.cd';

            if (found) {
                setCurrentUserObj(isAdminOrDirecteur ? { ...found, role: 'Admin', permissions: ALL_MODULE_PERMISSIONS.map(m => m.key) } : found);
            } else if (isAdminOrDirecteur) {
                setCurrentUserObj({
                    id: currentUserInfo.id || 'admin-default',
                    email: currentUserInfo.email,
                    fullName: currentUserInfo.name,
                    role: 'Admin',
                    userType: 'Avocat',
                    hasAppAccess: true,
                    permissions: ALL_MODULE_PERMISSIONS.map(m => m.key),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    status: 'Actif'
                });
            }
        }
    }, [currentUserInfo]);

    const [searchQuery, setSearchQuery] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const [cases, setCases] = useState<Case[]>([]);
    const [procedures, setProcedures] = useState<any[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [avocats, setAvocats] = useState<Avocat[]>([]);
    const [personnels, setPersonnels] = useState<Personnel[]>([]);
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
    const [logs, setLogs] = useState<AuditLog[]>([]);

    const combinedCases = useMemo(() => {
        return cases.map(c => ({
            ...c,
            procedures: procedures.filter(p => p.dossier_id === c.id)
        }));
    }, [cases, procedures]);

    const lawyerNames = useMemo(() => avocats.map(a => a.fullName), [avocats]);

    useEffect(() => {
        if (!isAuthenticated) return;

        const sync = (table: string, mapper: (d: any) => any, setter: (data: any) => void) => {
            const fetch = async () => {
                let query = supabase.from(table).select('*');
                if (table === 'dossiers') query = supabase.from(table).select('*, clients(*)');
                if (table === 'tasks') query = supabase.from(table).select('*, profiles(*)');

                const { data, error } = await query;
                if (!error && data) setter(data.map(mapper));
            };
            fetch();
            return supabase.channel(`public:${table}`).on('postgres_changes', { event: '*', schema: 'public', table }, fetch).subscribe();
        };

        sync('clients', mappers.client, setClients);
        sync('dossiers', mappers.case, setCases);
        sync('procedures', mappers.procedure, setProcedures);
        sync('calendar_events', mappers.event, setEvents);
        sync('tasks', mappers.task, setTasks);
        sync('factures', mappers.invoice, setInvoices);
        // Profiles/Avocats sync (can be improved with proper mapper)
        const fetchAvocats = async () => {
            const { data } = await supabase.from('profiles').select('*');
            if (data) setAvocats(data.map(p => ({
                id: p.id,
                fullName: `${p.first_name} ${p.last_name}`,
                emails: [p.email],
                phone: p.phone || '',
                cabinetStatus: 'Junior',
                serviceStatus: p.is_active ? 'Actif' : 'Inactif',
                photoUrl: p.avatar_url,
                serviceStartDate: p.created_at
            } as any)));
        };
        fetchAvocats();

        return () => { supabase.removeAllChannels(); };
    }, [isAuthenticated]);

    const [toasts, setToasts] = useState<{ id: string, type: 'success' | 'error', text: string }[]>([]);
    const triggerToast = (type: 'success' | 'error', text: string) => {
        const id = Math.random().toString();
        setToasts(prev => [...prev, { id, type, text }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };

    const handleUpdateTaskStatus = async (id: any, status: string) => {
        try {
            await dbUpdateDoc('tasks', id, { status });
            triggerToast('success', 'Statut mis à jour.');
        } catch (err) { triggerToast('error', 'Échec.'); }
    };

    const handleUpdateCase = async (updated: Case) => {
        try {
            const { id, procedures: _, ...cleanData } = updated as any;
            await dbUpdateDoc('cases', id, cleanData);
            triggerToast('success', 'Dossier mis à jour.');
        } catch (err) { triggerToast('error', 'Échec.'); }
    };

    const renderPage = () => {
        const pageProps = {
            clients, cases: combinedCases, events, tasks, invoices, avocats, personnels, fournisseurs,
            lawyers: lawyerNames,
            onAddTask: async (t: any) => { await dbCreateDoc('tasks', '', t); triggerToast('success', 'Tâche ajoutée'); },
            onUpdateTask: async (t: any) => { await dbUpdateDoc('tasks', t.id, t); triggerToast('success', 'Tâche modifiée'); },
            onUpdateCase: handleUpdateCase,
            onUpdateTaskStatus: handleUpdateTaskStatus,
            onSendEmail: () => {}
        };

        switch (currentPage) {
            case 'Dashboard': return <DashboardPage {...pageProps} />;
            case 'Clients': return <ClientsPage {...pageProps} onAddClient={() => {}} onExport={() => {}} />;
            case 'Dossiers': return <CasesPage {...pageProps} onAddCase={() => {}} onExport={() => {}} />;
            case 'Procedures': return <ProceduresPage cases={combinedCases} onUpdateCase={handleUpdateCase} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />;
            case 'Agenda': return <AgendaPage {...pageProps} />;
            case 'Evenements': return <EventsPage {...pageProps} onAddEvent={() => {}} onUpdateEvent={() => {}} />;
            case 'Chat': return <ChatPage {...pageProps} currentUserInfo={currentUserInfo} presences={{}} />;
            case 'Correspondance': return <CorrespondancePage {...pageProps} currentUserInfo={currentUserInfo} />;
            case 'Facturation': return <BillingPage {...pageProps} onAddInvoice={() => {}} />;
            case 'Avocats': return <AvocatsPage {...pageProps} onAddAvocat={() => {}} />;
            case 'Personnels': return <PersonnelsPage {...pageProps} onAddPersonnel={() => {}} onDeletePersonnel={() => {}} />;
            case 'Fournisseurs': return <FournisseursPage {...pageProps} onAddFournisseur={() => {}} onDeleteFournisseur={() => {}} />;
            case 'Gestion': return <GestionPage {...pageProps} onAddToast={triggerToast} />;
            case 'AuditLogs': return <AuditLogsPage logs={logs} />;
            default: return <DashboardPage {...pageProps} />;
        }
    };

    if (!isAuthenticated) {
        return <LoginPage onLoginSuccess={(email, obj) => {
            setIsAuthenticated(true);
            setCurrentUserInfo({ email, name: obj?.fullName || 'Admin', role: obj?.role || 'Admin', id: obj?.id });
            setCurrentUserObj(obj as AppUser);
        }} />;
    }

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-[#070b13] font-sans overflow-hidden">
            <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={() => supabase.auth.signOut()} currentUserInfo={currentUserInfo} currentUser={currentUserObj} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} clients={clients} cases={combinedCases} events={events} setCurrentPage={setCurrentPage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} currentUserInfo={currentUserInfo} onLogout={() => supabase.auth.signOut()} onMenuToggle={() => setIsSidebarOpen(true)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
                    {renderPage()}
                </main>
            </div>
            <div className="fixed bottom-5 right-5 space-y-3 z-50 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} key={t.id} className={`p-4 rounded-xl shadow-lg text-white pointer-events-auto ${t.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                            {t.text}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default App;
