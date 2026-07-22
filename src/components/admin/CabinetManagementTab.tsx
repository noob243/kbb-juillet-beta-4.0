import React, { FC, useState } from 'react';
import { CabinetSettings, UserRole } from '../../types/rbac';

interface CabinetManagementTabProps {
  onAddToast: (type: 'success' | 'error', message: string) => void;
}

export const CabinetManagementTab: FC<CabinetManagementTabProps> = ({ onAddToast }) => {
  const [settings, setSettings] = useState<CabinetSettings>({
    cabinetName: 'Cabinet KBB & Associés',
    cabinetEmail: 'contact@cabinetkbb.com',
    cabinetPhone: '+243 81 555 0000',
    address: 'Avenue de la Justice, N° 14, Kinshasa - Gombe, RDC',
    taxNumber: 'A1234567B',
    rccm: 'CD/KIN/RCCM/20-B-00123',
    mainBar: 'Kinshasa-Gombe',
    secondaryBar: 'Haut-Katanga',
    defaultPermissionsByRole: {
      Admin: ['dashboard', 'ai', 'clients', 'cases', 'procedures', 'agenda', 'events', 'chat', 'correspondance', 'billing', 'avocats', 'personnels', 'suppliers', 'gestion_utilisateurs', 'gestion_cabinet', 'audit'],
      Avocat: ['dashboard', 'ai', 'clients', 'cases', 'procedures', 'agenda', 'events', 'chat', 'correspondance', 'billing', 'avocats', 'personnels', 'suppliers'],
      Personnel: ['dashboard', 'ai', 'clients', 'cases', 'procedures', 'agenda', 'events', 'chat', 'correspondance']
    },
    securityPolicy: {
      requireStrongPasswords: true,
      sessionTimeoutMinutes: 60,
      auditAllActions: true,
      restrictOfficeStaffLogin: true
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onAddToast('success', 'Paramètres d\'organisation du cabinet mis à jour avec succès.');
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="bg-white dark:bg-[#0c111d] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#15447c] dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m3 0h1m-4-8a3 3 0 100-6 3 3 0 000 6zm-5 6a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            Paramètres et Organisation Interne du Cabinet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gérez la raison sociale, les autorisations par défaut et les politiques de sécurité globale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Dénomination Officielle
            </label>
            <input
              type="text"
              value={settings.cabinetName}
              onChange={e => setSettings({ ...settings, cabinetName: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Email Officiel du Cabinet
            </label>
            <input
              type="email"
              value={settings.cabinetEmail}
              onChange={e => setSettings({ ...settings, cabinetEmail: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Barreau Principal d'Attache
            </label>
            <input
              type="text"
              value={settings.mainBar}
              onChange={e => setSettings({ ...settings, mainBar: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Téléphone du Standard
            </label>
            <input
              type="text"
              value={settings.cabinetPhone}
              onChange={e => setSettings({ ...settings, cabinetPhone: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Numéro NIF / Tax ID
            </label>
            <input
              type="text"
              value={settings.taxNumber}
              onChange={e => setSettings({ ...settings, taxNumber: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Numéro RCCM
            </label>
            <input
              type="text"
              value={settings.rccm}
              onChange={e => setSettings({ ...settings, rccm: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold"
            />
          </div>
        </div>

        {/* Security Policies */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Politique de Sécurité et de Confidentialité RBAC
          </h4>

          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.securityPolicy.restrictOfficeStaffLogin}
                onChange={e => setSettings({
                  ...settings,
                  securityPolicy: { ...settings.securityPolicy, restrictOfficeStaffLogin: e.target.checked }
                })}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Restreindre l'accès applicatif au personnel de catégorie [Office]
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.securityPolicy.auditAllActions}
                onChange={e => setSettings({
                  ...settings,
                  securityPolicy: { ...settings.securityPolicy, auditAllActions: e.target.checked }
                })}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Consigner l'intégralité des créations, éditions et suppressions dans le Journal d'Audit
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#15447c] hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition"
          >
            Sauvegarder les paramètres du cabinet
          </button>
        </div>
      </form>
    </div>
  );
};
