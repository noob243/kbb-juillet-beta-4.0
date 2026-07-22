import React, { FC, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLocalUsers } from '../services/userService';
import { AppUser } from '../types/rbac';

interface LoginPageProps {
  onLoginSuccess: (email: string, userObj?: AppUser | null) => void;
}

const LoginPage: FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [showRecoveryMsg, setShowRecoveryMsg] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        const cleanEmail = email.trim();
        const lowEmail = cleanEmail.toLowerCase();

        try {
            // Master Admin Bypass for emergency access
            if (lowEmail === 'admin@kbb.cd' && password === 'KBBAdminMaster2025!') {
                onLoginSuccess(cleanEmail, {
                    id: 'master-admin-id',
                    email: lowEmail,
                    fullName: 'Master Admin KBB',
                    role: 'Admin',
                    userType: 'Avocat',
                    hasAppAccess: true,
                    permissions: [], // Will be given all permissions in App.tsx logic
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    status: 'Actif'
                });
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: password,
            });

            if (error) {
                // Check if it's one of the hardcoded admins for first-time setup or mock bypass
                if ((lowEmail === 'jeremieshusu4@gmail.com' || lowEmail === 'hervemich@icloud.com') && password === '123456789') {
                    // In a real migration, we would have already created these users in Supabase
                    // If they don't exist, we should probably tell the user to check Supabase
                    throw new Error("Veuillez vous assurer que ce compte admin est créé dans Supabase.");
                }

                let friendlyMsg = "Identifiants de connexion invalides.";
                if (error.message.includes("Invalid login credentials")) {
                    friendlyMsg = "E-mail ou mot de passe incorrect.";
                } else {
                    friendlyMsg = error.message;
                }
                throw new Error(friendlyMsg);
            }

            if (data.user) {
                // Check local users/RBAC if needed, though App.tsx handles profile sync
                const users = getLocalUsers();
                const foundUser = users.find(u => u.email.toLowerCase() === lowEmail);
                
                if (foundUser?.isDeleted) {
                    await supabase.auth.signOut();
                    throw new Error("Ce compte utilisateur a été archivé.");
                }

                onLoginSuccess(cleanEmail, foundUser || null);
            }
        } catch (err: any) {
            console.error("Login attempt failed:", err);
            setErrorMsg(err.message || "Impossible de se connecter.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setErrorMsg("Veuillez saisir votre adresse e-mail.");
            return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
            setErrorMsg(error.message);
        } else {
            setShowRecoveryMsg(true);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#070b13] flex flex-col justify-center items-center p-4 transition-colors duration-200">
            <div className="max-w-md w-full mx-auto">
                <div className="text-3xl font-bold mb-8 flex items-center justify-center text-[#15447c] dark:text-indigo-400">
                    <svg className="w-10 h-10 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                    </svg>
                    <span>KBB App</span>
                </div>
                <div className="bg-white dark:bg-[#0c111d] p-8 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
                    <h2 className="text-2xl font-extrabold text-center text-gray-800 dark:text-slate-100 mb-1">Bienvenue !</h2>
                    <p className="text-center text-sm text-gray-500 dark:text-slate-400 mb-6">Connectez-vous avec Supabase Auth</p>
                    
                    {errorMsg && (
                        <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-400 rounded-xl text-xs font-semibold animate-fadeIn">
                            ⚠️ {errorMsg}
                        </div>
                    )}

                    {showRecoveryMsg && (
                        <div className="mb-5 p-4 bg-green-50 dark:bg-emerald-950/20 border border-green-200 dark:border-emerald-900 text-green-800 dark:text-emerald-400 rounded-xl flex items-start gap-2.5 animate-fadeIn">
                            <span className="text-lg">📧</span>
                            <div className="text-xs font-semibold">
                                <p className="font-bold">Lien de réinitialisation envoyé</p>
                                <p className="mt-0.5">Vérifiez votre boîte de réception.</p>
                                <button onClick={() => setShowRecoveryMsg(false)} className="text-green-700 dark:text-emerald-300 hover:underline font-bold mt-1.5 block">Fermer</button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Adresse e-mail</label>
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full p-3 border border-gray-300 dark:border-slate-800 rounded-xl shadow-xs text-sm bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/10 focus:border-[#15447c] outline-none transition" 
                                    placeholder="vous@cabinet.com" 
                                    required 
                                    disabled={isLoading}
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Mot de passe</label>
                                    <button 
                                        type="button"
                                        onClick={handleForgotPassword}
                                        className="text-xs text-[#15447c] dark:text-indigo-400 hover:underline font-bold"
                                        disabled={isLoading}
                                    >
                                        Mot de passe oublié ?
                                    </button>
                                </div>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 border border-gray-300 dark:border-slate-800 rounded-xl shadow-xs text-sm bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/10 focus:border-[#15447c] outline-none transition" 
                                    placeholder="********" 
                                    required 
                                    disabled={isLoading}
                                />
                            </div>
                            <div>
                                <button 
                                    type="submit" 
                                    className="w-full bg-[#15447c] text-white font-bold py-3 px-4 rounded-xl hover:bg-[#15447c]/95 active:scale-[0.99] transition duration-150 shadow-md flex items-center justify-center gap-2"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Connexion..." : "Se connecter"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
