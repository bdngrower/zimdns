import { useAuthStore } from '../../store/useAuthStore';
import { LogOut, User as UserIcon, Building, Bell } from 'lucide-react';

export function Header() {
    const { user, signOut } = useAuthStore();

    return (
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
            <div className="flex items-center">
                {/* Client Switcher Mock */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all">
                    <Building className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Visão Geral (Todos os Clientes)</span>
                </div>
            </div>

            <div className="flex items-center gap-x-4 lg:gap-x-6">
                <button className="text-slate-400 hover:text-slate-600 transition-colors hidden sm:block p-2 rounded-full hover:bg-slate-50">
                    <Bell className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-4 border-l border-slate-200 pl-4 lg:pl-6">
                    <div className="hidden lg:flex lg:flex-col lg:items-end">
                        <span className="text-sm font-semibold text-slate-900" aria-hidden="true">
                            {user?.email || 'Admin User'}
                        </span>
                        <span className="text-xs font-medium text-slate-500" aria-hidden="true">Super Admin</span>
                    </div>

                    <div className="h-9 w-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        <UserIcon className="h-5 w-5" />
                    </div>

                    <button
                        onClick={() => signOut()}
                        className="ml-1 p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-full transition-all"
                        title="Sair"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}
