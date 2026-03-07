import { useAuthStore } from '../../store/useAuthStore';
import { LogOut, User as UserIcon, Building } from 'lucide-react';

export function Header() {
    const { user, signOut } = useAuthStore();

    return (
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-surface px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-between items-center">
                {/* Tenant Switcher Mock */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background cursor-pointer hover:bg-slate-50 transition-colors">
                    <Building className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Visão Geral (Todos os Clientes)</span>
                </div>

                <div className="flex items-center gap-x-4 lg:gap-x-6">
                    <div className="flex items-center gap-3 border-l border-border pl-4 lg:pl-6">
                        <span className="hidden lg:flex lg:items-center">
                            <span className="flex flex-col items-end">
                                <span className="text-sm font-medium text-slate-900" aria-hidden="true">
                                    {user?.email || 'Admin User'}
                                </span>
                                <span className="text-xs text-slate-500" aria-hidden="true">Super Admin</span>
                            </span>
                        </span>
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <UserIcon className="h-5 w-5" />
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Sair"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
