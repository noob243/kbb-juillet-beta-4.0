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
    seedCollectionIfEmpty,
    syncLocalCollection,
    dbCreateAuditLog
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
                // Profile will be fetched via syncUsersWithFirestore
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
                currentUserInfo.email === 'admin@cabinet.com';

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
    const [activeAlarmTask, setActiveAlarmTask] = useState<Task | null>(null);
    const stopActiveAlarmRef = React.useRef<(() => void) | null>(null);
    
    const [clients, setClients] = usePersistentState<Client[]>('kbb_clients', initialClients);
    const [cases, setCases] = usePersistentState<Case[]>('kbb_cases', initialCases);
    const [events, setEvents] = usePersistentState<Event[]>('kbb_events', initialEvents);
    const [tasks, setTasks] = usePersistentState<Task[]>('kbb_tasks', initialTasks);
    const [invoices, setInvoices] = usePersistentState<Invoice[]>('kbb_invoices', initialInvoices);
    const [avocats, setAvocats] = usePersistentState<Avocat[]>('kbb_avocats', initialAvocats);
    const [personnels, setPersonnels] = usePersistentState<Personnel[]>('kbb_personnels', initialPersonnels);
    const [fournisseurs, setFournisseurs] = usePersistentState<Fournisseur[]>('kbb_fournisseurs', initialFournisseurs);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [correspondances, setCorrespondances] = useState<Correspondance[]>([]);
    const [presences, setPresences] = useState<{ [email: string]: any }>({});

    const [isDbConnected, setIsDbConnected] = useState(true); // Supabase is cloud-native
    const [isSyncComplete, setIsSyncComplete] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDarkMode, setIsDarkMode] = usePersistentState('kbb_darkMode', false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Real-time synchronization using Supabase Channels
    useEffect(() => {
        if (!isAuthenticated) return;

        const syncTable = (table: string, setter: (data: any) => void) => {
            const fetchInitial = async () => {
                const { data, error } = await supabase.from(table).select('*');
                if (!error && data) setter(data);
            };
            fetchInitial();

            return supabase
                .channel(`public:${table}`)
                .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
                    fetchInitial();
                })
                .subscribe();
        };

        const channelClients = syncTable('clients', setClients);
        const channelCases = syncTable('dossiers', setCases);
        const channelEvents = syncTable('calendar_events', setEvents);
        const channelTasks = syncTable('tasks', setTasks);
        const channelInvoices = syncTable('factures', setInvoices);
        const channelAvocats = syncTable('profiles', setAvocats); // Note: mapping logic might be needed
        const channelPersonnels = syncTable('personnel', setPersonnels);
        const channelFournisseurs = syncTable('fournisseurs', setFournisseurs);
        const channelLogs = syncTable('audit_logs', setLogs);
        const channelCorrespondances = syncTable('correspondances', setCorrespondances);
        const channelPresences = syncTable('presences', (data) => {
            const map: any = {};
            data.forEach((p: any) => map[p.profile_id] = p);
            setPresences(map);
        });

        // Sync users for RBAC
        const unsubUsers = syncUsersWithFirestore((users) => {
            // Already handled in userService
        });

        return () => {
            supabase.removeChannel(channelClients);
            supabase.removeChannel(channelCases);
            supabase.removeChannel(channelEvents);
            supabase.removeChannel(channelTasks);
            supabase.removeChannel(channelInvoices);
            supabase.removeChannel(channelAvocats);
            supabase.removeChannel(channelPersonnels);
            supabase.removeChannel(channelFournisseurs);
            supabase.removeChannel(channelLogs);
            supabase.removeChannel(channelCorrespondances);
            supabase.removeChannel(channelPresences);
            unsubUsers.then(unsub => unsub());
        };
    }, [isAuthenticated]);

    const [toasts, setToasts] = useState<{ id: string, type: 'success' | 'error', text: string }[]>([]);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    const [emailConfig, setEmailConfig] = useState<{
        isOpen: boolean;
        to: string;
        subject: string;
        body: string;
        recipientName?: string;
        attachmentName?: string;
    }>({
        isOpen: false,
        to: '',
        subject: '',
        body: '',
        recipientName: '',
        attachmentName: ''
    });

    const triggerEmail = (to: string, subject: string, body: string, recipientName?: string, attachmentName?: string) => {
        setEmailConfig({
            isOpen: true,
            to,
            subject,
            body,
            recipientName,
            attachmentName
        });
    };

    const triggerToast = (type: 'success' | 'error', text: string) => {
        const id = Math.random().toString();
        setToasts(prev => [...prev, { id, type, text }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    // Data Sync logic on startup
    useEffect(() => {
        if (!isAuthenticated) return;
        const performDataSync = async () => {
            setIsSyncing(true);
            try {
                const alreadyCleared = localStorage.getItem('kbb_mock_data_cleared');
                if (alreadyCleared !== 'true') {
                    console.log("Cabinet startup: Initializing clean Supabase environment...");
                    localStorage.setItem('kbb_mock_data_cleared', 'true');
                }

                await syncLocalCollection('clients', clients);
                await syncLocalCollection('cases', cases);
                await syncLocalCollection('events', events);
                await syncLocalCollection('tasks', tasks);
                await syncLocalCollection('invoices', invoices);
                await syncLocalCollection('avocats', avocats);
                await syncLocalCollection('personnels', personnels);
                await syncLocalCollection('fournisseurs', fournisseurs);
                
                triggerToast('success', 'Synchronisation avec Supabase réussie !');
                setIsSyncComplete(true);
            } catch (err) {
                console.error("Local records database synchronization failed on startup:", err);
                setIsSyncComplete(true);
            } finally {
                setIsSyncing(false);
            }
        };
        performDataSync();
    }, [isAuthenticated]);

    // Task reminder logic
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }

        const interval = setInterval(() => {
            if (activeAlarmTask) return;

            const now = new Date();
            const currentLocalDateString = now.toISOString().split('T')[0];
            const currentLocalTimeString = now.toTimeString().slice(0, 5);

            const pendingReminder = tasks.find(t => {
                if (!t.reminderEnabled || t.reminderTriggered || t.status === 'Effectué') {
                    return false;
                }
                
                const scheduledDate = t.reminderDate || '';
                const scheduledTime = t.reminderTime || '';

                if (!scheduledDate || !scheduledTime) return false;

                if (scheduledDate < currentLocalDateString) {
                    return true;
                } else if (scheduledDate === currentLocalDateString) {
                    return scheduledTime <= currentLocalTimeString;
                }

                return false;
            });

            if (pendingReminder) {
                setActiveAlarmTask(pendingReminder);
                const soundType = pendingReminder.reminderSound || 'digital';
                const stopSoundFn = playAlarmSound(soundType, 0.7);
                stopActiveAlarmRef.current = stopSoundFn;

                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification(`Rappel de Tâche: ${pendingReminder.name}`, {
                        body: `Échéance à ${pendingReminder.reminderTime || 'l\'instant'}`,
                        icon: '/favicon.ico',
                        requireInteraction: true
                    });
                }
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [tasks, activeAlarmTask]);

    const handleDismissAlarm = async () => {
        if (!activeAlarmTask) return;
        if (stopActiveAlarmRef.current) stopActiveAlarmRef.current();
        stopAllAlarmSounds();

        const updated = { ...activeAlarmTask, reminderTriggered: true };
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        try {
            await dbUpdateDoc('tasks', updated.id, { reminderTriggered: true });
        } catch (err) {
            console.error("Failed to dismiss alarm in DB:", err);
        }
        setActiveAlarmTask(null);
        triggerToast('success', "Rappel acquitté.");
    };

    const handleSnoozeAlarm = async () => {
        if (!activeAlarmTask) return;
        if (stopActiveAlarmRef.current) stopActiveAlarmRef.current();
        stopAllAlarmSounds();

        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        const snoozedDate = now.toISOString().split('T')[0];
        const snoozedTime = now.toTimeString().slice(0, 5);

        const updated = {
            ...activeAlarmTask,
            reminderDate: snoozedDate,
            reminderTime: snoozedTime,
            reminderTriggered: false
        };

        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        try {
            await dbUpdateDoc('tasks', updated.id, {
                reminderDate: snoozedDate,
                reminderTime: snoozedTime,
                reminderTriggered: false
            });
        } catch (err) {
            console.error("Failed to snooze alarm in DB:", err);
        }
        setActiveAlarmTask(null);
        triggerToast('success', `Régler à nouveau pour ${snoozedTime}`);
    };

    const handleUpdateTask = async (updatedTask: Task) => {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        try {
            const { id, ...cleanTask } = updatedTask;
            await dbUpdateDoc('tasks', id, cleanTask);
            triggerToast('success', `Tâche "${updatedTask.name}" mise à jour !`);
        } catch (err) {
            triggerToast('error', "Échec de modification de la tâche.");
        }
    };

    const lawyerNames = avocats.map((a) => a.fullName);

    const handleLoginSuccess = (email: string) => {
        // Handled by supabase.auth.onAuthStateChange
        triggerToast('success', `Connexion réussie !`);
    };

    const handleLogout = async () => {
        if (currentUserInfo) {
            await dbCreateAuditLog({
                userEmail: currentUserInfo.email,
                userName: currentUserInfo.name,
                actionType: 'Autre',
                module: 'Authentification',
                description: `Déconnexion de ${currentUserInfo.name}`
            });
            await supabase.from('presences').update({ status: 'offline', last_active: new Date().toISOString() }).eq('profile_id', currentUserInfo.id);
        }
        await supabase.auth.signOut();
    };

    const logActivity = async (
        actionType: 'Ajout' | 'Modification' | 'Suppression' | 'Connexion' | 'Autre',
        module: string,
        description: string,
        details?: any
    ) => {
        try {
            await dbCreateAuditLog({
                userEmail: currentUserInfo?.email || 'anonyme@kbb.cd',
                userName: currentUserInfo?.name || 'Utilisateur Anonyme',
                actionType,
                module,
                description,
                details: details ? JSON.parse(JSON.stringify(details)) : null
            });
        } catch (e) {
            console.error("Failed to log activity:", e);
        }
    };

    // CRUD Handlers
    const handleAddClient = async (newClient: Omit<Client, 'id'> & { id?: string | number }) => {
        try {
            const nextId = newClient.id || crypto.randomUUID();
            const { id, ...cleanClient } = newClient;
            await dbCreateDoc('clients', nextId, cleanClient);
            triggerToast('success', `Client "${newClient.name}" créé avec succès !`);
            logActivity('Ajout', 'Clients', `Création du client "${newClient.name}"`, cleanClient);
        } catch (err) {
            triggerToast('error', "Échec de l'enregistrement du client.");
        }
    };

    const handleAddCase = async (newCase: Case, tasksToAdd?: Omit<Task, 'id'>[]) => {
        try {
            const caseId = newCase.id || crypto.randomUUID();
            const { id, ...cleanCase } = newCase;
            await dbCreateDoc('cases', caseId, cleanCase);
            
            if (tasksToAdd) {
                for (const t of tasksToAdd) {
                    const taskId = crypto.randomUUID();
                    await dbCreateDoc('tasks', taskId, { ...t, dossier_id: caseId });
                }
            }
            triggerToast('success', `Dossier "${newCase.name}" enregistré !`);
        } catch (err) {
            triggerToast('error', "Échec de l'écriture du dossier.");
        }
    };

    const handleAddEvent = async (newEvent: Event) => {
        try {
            const id = newEvent.id || crypto.randomUUID();
            const { id: _, ...cleanEvent } = newEvent;
            await dbCreateDoc('events', id, cleanEvent);
            triggerToast('success', `Événement "${newEvent.name}" planifié !`);
        } catch (err) {
            triggerToast('error', "Échec de l'enregistrement de l'événement.");
        }
    };

    const handleUpdateEvent = async (updatedEvent: Event) => {
        try {
            const { id, ...cleanEvent } = updatedEvent;
            await dbUpdateDoc('events', id, cleanEvent);
            triggerToast('success', `Événement "${updatedEvent.name}" mis à jour !`);
        } catch (err) {
            triggerToast('error', "Échec de la mise à jour de l'événement.");
        }
    };

    const handleAddTask = async (newTask: Omit<Task, 'id'>) => {
        try {
            const id = crypto.randomUUID();
            await dbCreateDoc('tasks', id, newTask);
            triggerToast('success', `Tâche "${newTask.name}" programmée.`);
        } catch (err) {
            triggerToast('error', "Impossible d'enregistrer la tâche.");
        }
    };

    const handleUpdateTaskStatus = async (id: number | string, status: string) => {
        try {
            await dbUpdateDoc('tasks', id, { status });
            triggerToast('success', `Statut de la tâche mis à jour !`);
        } catch (err) {
            triggerToast('error', "Échec de modification.");
        }
    };

    const handleAddInvoice = async (newInvoice: Invoice) => {
        try {
            const id = newInvoice.id || crypto.randomUUID();
            const { id: _, ...cleanInvoice } = newInvoice;
            await dbCreateDoc('invoices', id, cleanInvoice);
            triggerToast('success', `Facture émise !`);
        } catch (err) {
            triggerToast('error', "Échec de l'émission.");
        }
    };

    // Navigation and Page Rendering
    const isAssocietOrAdmin = () => {
        const role = currentUserObj?.role?.toLowerCase() || '';
        return role.includes('admin') || role.includes('directeur') || role.includes('associé');
    };

    const renderPage = () => {
        const pageProps = {
            clients, cases, events, tasks, invoices, avocats, lawyerNames, personnels, fournisseurs,
            onAddClient: handleAddClient, onAddCase: handleAddCase, onAddEvent: handleAddEvent,
            onAddTask: handleAddTask, onAddInvoice: handleAddInvoice,
            onDeleteClient: (id: any) => dbDeleteDoc('clients', id),
            onDeleteCase: (id: any) => dbDeleteDoc('cases', id),
            onUpdateClient: (u: any) => dbUpdateDoc('clients', u.id, u),
            onUpdateCase: (u: any) => dbUpdateDoc('cases', u.id, u),
            onSendEmail: triggerEmail,
        };

        switch (currentPage) {
            case 'Dashboard': return <DashboardPage {...pageProps} onUpdateTaskStatus={handleUpdateTaskStatus} />;
            case 'Clients': return <ClientsPage {...pageProps} />;
            case 'Dossiers': return <CasesPage {...pageProps} onNavigate={setCurrentPage} />;
            case 'Procedures': return <ProceduresPage cases={cases} onUpdateCase={handleUpdateCase} />;
            case 'Agenda': return <AgendaPage {...pageProps} onUpdateTask={handleUpdateTask} />;
            case 'Evenements': return <EventsPage {...pageProps} onUpdateEvent={handleUpdateEvent} />;
            case 'Chat': return <ChatPage {...pageProps} currentUserInfo={currentUserInfo} presences={presences} />;
            case 'Correspondance': return <CorrespondancePage {...pageProps} currentUserInfo={currentUserInfo} />;
            case 'Facturation': return isAssocietOrAdmin() ? <BillingPage {...pageProps} /> : <div className="p-10 text-center">Accès restreint</div>;
            case 'Avocats': return <AvocatsPage {...pageProps} />;
            case 'Personnels': return <PersonnelsPage {...pageProps} />;
            case 'Fournisseurs': return <FournisseursPage {...pageProps} />;
            case 'Gestion': return isAssocietOrAdmin() ? <GestionPage {...pageProps} currentUser={currentUserObj} /> : <div className="p-10 text-center">Accès restreint</div>;
            case 'AuditLogs': return isAssocietOrAdmin() ? <AuditLogsPage logs={logs} /> : <div className="p-10 text-center">Accès restreint</div>;
            default: return <DashboardPage {...pageProps} onUpdateTaskStatus={handleUpdateTaskStatus} />;
        }
    };

    if (!isAuthenticated) {
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;
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
            {/* Toasts and Alarms would go here, similar to previous version */}
        </div>
    );
}

export default App;
