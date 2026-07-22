import React, { FC, useState } from 'react';
import PageContainer from '../components/PageContainer';
import TaskModal from '../components/modals/TaskModal';
import { CalendarIcon, CheckSquareIcon, FolderIcon, EditIcon, ChartIcon, BellIcon, MapPinIcon } from '../components/Icons';
import { Task, Case, Avocat, Event } from '../types';
import { playAlarmSound, stopAllAlarmSounds } from '../utils/audio';

interface AgendaPageProps {
  tasks: Task[];
  cases: Case[];
  lawyers: string[];
  avocats?: Avocat[];
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onUpdateTask?: (task: Task) => void;
  events?: Event[];
}

const FRENCH_MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const AgendaPage: FC<AgendaPageProps> = ({ tasks = [], cases = [], lawyers = [], avocats = [], onAddTask, onUpdateTask, events = [] }) => {
    const today = new Date().toISOString().split('T')[0];

    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeEvents = Array.isArray(events) ? events : [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
    const [activeView, setActiveView] = useState<'calendar' | 'list'>('calendar');
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedFilterDate, setSelectedFilterDate] = useState<string | null>(null);

    const isOverdue = (task: Task) => {
        return task.status !== 'Effectué' && task.dueDate < today;
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'Effectué': return 'bg-green-100 text-green-800';
            case 'Non effectué': return 'bg-red-100 text-red-800';
            case 'Effectué à moitié': return 'bg-yellow-101 text-yellow-801';
            default: return 'bg-gray-101 text-gray-801';
        }
    };

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => {
        const day = new Date(y, m, 1).getDay();
        return day === 0 ? 6 : day - 1;
    };

    const daysInCurrMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    const cells: { dateStr: string; day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        const m = month === 0 ? 11 : month - 1;
        const y = month === 0 ? year - 1 : year;
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr, day: d, isCurrentMonth: false, isToday: dateStr === today });
    }
    for (let d = 1; d <= daysInCurrMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ dateStr, day: d, isCurrentMonth: true, isToday: dateStr === today });
    }
    const remainingCount = 42 - cells.length;
    for (let n = 1; n <= remainingCount; n++) {
        const m = month === 11 ? 0 : month + 1;
        const y = month === 11 ? year + 1 : year;
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
        cells.push({ dateStr, day: n, isCurrentMonth: false, isToday: dateStr === today });
    }

    const isTaskActiveOnDate = (task: Task, dateStr: string) => {
        const start = task.startDate || task.dueDate;
        const end = task.endDate || task.dueDate;
        return dateStr >= start && dateStr <= end;
    };

    const filteredTasks = (selectedFilterDate
        ? safeTasks.filter(task => isTaskActiveOnDate(task, selectedFilterDate))
        : showOnlyOverdue ? safeTasks.filter(isOverdue) : safeTasks);

    const filteredEvents = selectedFilterDate
        ? safeEvents.filter(event => event.date === selectedFilterDate)
        : safeEvents;

    const formatDate = (dateStr: string) => {
        try {
            if (!dateStr) return 'N/A';
            return new Date(dateStr).toLocaleDateString('fr-FR');
        } catch (e) { return 'N/A'; }
    };

    return (
        <div className="space-y-6">
            <PageContainer title="Agenda" buttonLabel="Ajouter Tâche" onButtonClick={() => setIsModalOpen(true)}>
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit mb-4">
                    <button onClick={() => setActiveView('calendar')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeView === 'calendar' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Calendrier</button>
                    <button onClick={() => setActiveView('list')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeView === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Liste</button>
                </div>

                {activeView === 'calendar' ? (
                    <div className="bg-white rounded-2xl border overflow-hidden shadow-xs">
                        <div className="p-4 flex justify-between items-center bg-slate-50 border-b">
                            <h3 className="font-bold">{FRENCH_MONTHS[month]} {year}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setCalendarDate(new Date(year, month - 1, 1))} className="p-1 border rounded">←</button>
                                <button onClick={() => setCalendarDate(new Date(year, month + 1, 1))} className="p-1 border rounded">→</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-gray-200">
                            {cells.map(cell => (
                                <div key={cell.dateStr} onClick={() => { setSelectedFilterDate(cell.dateStr); setActiveView('list'); }} className={`min-h-[100px] p-2 bg-white hover:bg-indigo-50 cursor-pointer ${!cell.isCurrentMonth ? 'text-gray-300' : ''}`}>
                                    <span className={`text-xs font-bold ${cell.isToday ? 'bg-indigo-600 text-white p-1 rounded-full' : ''}`}>{cell.day}</span>
                                    <div className="mt-1 space-y-1">
                                        {safeTasks.filter(t => isTaskActiveOnDate(t, cell.dateStr)).slice(0, 2).map(t => (
                                            <div key={t.id} className="text-[9px] bg-indigo-50 text-indigo-700 px-1 rounded truncate">{t.name}</div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b">
                                <tr className="text-xs font-bold text-gray-500 uppercase">
                                    <th className="p-4">Tâche</th>
                                    <th className="p-4">Dossier</th>
                                    <th className="p-4">Échéance</th>
                                    <th className="p-4">Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.map(task => (
                                    <tr key={task.id} className="border-b hover:bg-slate-50">
                                        <td className="p-4 font-semibold text-sm">{task.name}</td>
                                        <td className="p-4 text-xs text-gray-500">{task.caseId}</td>
                                        <td className="p-4 text-xs">{formatDate(task.dueDate)}</td>
                                        <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusClass(task.status)}`}>{task.status}</span></td>
                                    </tr>
                                ))}
                                {filteredEvents.map(ev => (
                                    <tr key={ev.id} className="bg-purple-50/20 border-b">
                                        <td className="p-4 font-semibold text-sm text-purple-700">📅 {ev.name}</td>
                                        <td className="p-4 text-xs text-gray-400">Événement</td>
                                        <td className="p-4 text-xs">{formatDate(ev.date)}</td>
                                        <td className="p-4"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">Programmé</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </PageContainer>
            <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={onAddTask} cases={cases} lawyers={lawyers} avocats={avocats} />
        </div>
    );
};

export default AgendaPage;
