import React, { useState, useEffect } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import { initialClients, initialCases, initialEvents, initialTasks, initialInvoices, initialAvocats, initialPersonnels, initialFournisseurs } from './data/mockData';

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
import AllInterfacesPage from './pages/AllInterfacesPage';
import AIAssistantPage from './pages/AIAssistantPage';
import AuditLogsPage from './pages/AuditLogsPage';
import CorrespondancePage from './pages/CorrespondancePage';
import { Client, Case, Event, Task, Invoice, Avocat, Personnel, Fournisseur, AuditLog, Correspondance } from './types';
import { playAlarmSound, stopAllAlarmSounds } from './utils/audio';

// Supabase configuration
import { supabase } from './lib/supabase';
import { 
    dbCreateDoc, 
    dbUpdateDoc, 
    dbDeleteDoc, 
    dbCreateAuditLog,
    mappers
} from './lib/supabaseService';

import { motion, AnimatePresence } from 'motion/react';
import EmailComposerModal from './components/modals/EmailComposerModal';
import { ProtectedGuard } from './components/auth/ProtectedGuard';
import { getLocalUsers, syncUsersWithFirestore } from './services/userService';
import { AppUser, ModuleKey } from './types/rbac';
import { ALL_MODULE_PERMISSIONS } from './services/rbacService';

declare const jspdf: any;

function App() {
    const [isAuthenticated, setIsAuthenticated] = usePersistentState('kbb_auth', false);
    const [currentUserInfo, setCurrentUserInfo] = usePersistentState<{ name: string; role: string; email: string; id?: string } | null>('kbb_currentUserInfo', null);
    const [currentUserObj, setCurrentUserObj] = usePersistentState<AppUser | null>('kbb_currentUserObj', null);
    const [currentPage, setCurrentPage] = useState('Dashboard');

    // Handle Auth state change
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
                roleLower.includes('associet') ||
                currentUserInfo.email === 'jeremieshusu4@gmail.com' ||
                currentUserInfo.email === 'hervemich@icloud.com' ||
                currentUserInfo.email === 'admin@cabinet.com' ||
                currentUserInfo.email === 'admin@kbb.cd';

            if (found) {
                if (isAdminOrDirecteur) {
                    setCurrentUserObj({
                        ...found,
                        role: 'Admin',
                        permissions: ALL_MODULE_PERMISSIONS.map(m => m.key)
                    });
                } else {
                    setCurrentUserObj(found);
                }
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
    const [events, setEvents] = useState<Event[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [avocats, setAvocats] = useState<Avocat[]>([]);
    const [personnels, setPersonnels] = useState<Personnel[]>([]);
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [correspondances, setCorrespondances] = useState<Correspondance[]>([]);
    const [presences, setPresences] = useState<{ [email: string]: any }>({});

    const [isDarkMode, setIsDarkMode] = usePersistentState('kbb_darkMode', false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Real-time synchronization using Supabase Channels with Mappers
    useEffect(() => {
        if (!isAuthenticated) return;

        const syncTable = (table: string, mapper: (d: any) => any, setter: (data: any) => void) => {
            const fetchInitial = async () => {
                const { data, error } = await supabase.from(table).select(table === 'dossiers' ? '*, clients(*)' : table === 'tasks' ? '*, profiles(*)' : '*');
                if (!error && data) setter(data.map(mapper));
            };
            fetchInitial();

            return supabase
                .channel(`public:${table}`)
                .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
                    fetchInitial();
                })
                .subscribe();
        };

        const channelClients = syncTable('clients', mappers.client, setClients);
        const channelCases = syncTable('dossiers', mappers.case, setCases);
        const channelEvents = syncTable('calendar_events', mappers.event, setEvents);
        const channelTasks = syncTable('tasks', mappers.task, setTasks);
        const channelInvoices = syncTable('factures', mappers.invoice, setInvoices);
        // Profiles, Personnel etc. can be added here...

        return () => {
            supabase.removeChannel(channelClients);
            supabase.removeChannel(channelCases);
            supabase.removeChannel(channelEvents);
            supabase.removeChannel(channelTasks);
            supabase.removeChannel(channelInvoices);
        };
    }, [isAuthenticated]);

    const [toasts, setToasts] = useState<{ id: string, type: 'success' | 'error', text: string }[]>([]);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const triggerToast = (type: 'success' | 'error', text: string) => {
        const id = Math.random().toString();
        setToasts(prev => [...prev, { id, type, text }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };

    const handleUpdateTaskStatus = async (id: number | string, status: string) => {
        try {
            await dbUpdateDoc('tasks', id, { status });
            triggerToast('success', 'Statut mis à jour.');
        } catch (err) {
            triggerToast('error', 'Échec.');
        }
    };

    const handleUpdateCase = async (updated: Case) => {
        try {
            await dbUpdateDoc('cases', updated.id, updated);
            triggerToast('success', 'Dossier mis à jour.');
        } catch (err) {
            triggerToast('error', 'Échec.');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const renderPage = () => {
        const pageProps = {
            clients, cases, events, tasks, invoices, avocats, personnels, fournisseurs,
            onAddClient: () => {}, onAddCase: () => {}, onAddEvent: () => {},
            onAddTask: () => {}, onAddInvoice: () => {},
            onUpdateCase: handleUpdateCase,
            onSendEmail: () => {},
        };

        switch (currentPage) {
            case 'Dashboard': return <DashboardPage {...pageProps} onUpdateTaskStatus={handleUpdateTaskStatus} />;
            case 'Clients': return <ClientsPage {...pageProps} />;
            case 'Dossiers': return <CasesPage {...pageProps} />;
            case 'Procedures': return <ProceduresPage cases={cases} onUpdateCase={handleUpdateCase} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />;
            case 'Agenda': return <AgendaPage {...pageProps} />;
            case 'Evenements': return <EventsPage {...pageProps} />;
            case 'Chat': return <ChatPage {...pageProps} currentUserInfo={currentUserInfo} presences={presences} />;
            case 'Correspondance': return <CorrespondancePage {...pageProps} currentUserInfo={currentUserInfo} />;
            case 'Facturation': return <BillingPage {...pageProps} />;
            case 'Avocats': return <AvocatsPage {...pageProps} />;
            case 'Personnels': return <PersonnelsPage {...pageProps} />;
            case 'Fournisseurs': return <FournisseursPage {...pageProps} />;
            case 'Gestion': return <GestionPage {...pageProps} currentUser={currentUserObj} onAddToast={triggerToast} />;
            case 'AuditLogs': return <AuditLogsPage logs={logs} />;
            default: return <DashboardPage {...pageProps} onUpdateTaskStatus={handleUpdateTaskStatus} />;
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
        <div className="flex h-screen bg-gray-100 dark:bg-[#070b13] font-sans overflow-hidden transition-colors duration-300">
            <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={handleLogout} currentUserInfo={currentUserInfo} currentUser={currentUserObj} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} clients={clients} cases={cases} events={events} setCurrentPage={setCurrentPage} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} currentUserInfo={currentUserInfo} onLogout={handleLogout} onMenuToggle={() => setIsSidebarOpen(true)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar relative">
                    {renderPage()}
                </main>
            </div>
            {/* Toasts */}
            <div className="fixed bottom-5 right-5 space-y-3 z-50">
                {toasts.map(t => (
                    <div key={t.id} className={`p-4 rounded-xl shadow-lg text-white ${t.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                        {t.text}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default App;
