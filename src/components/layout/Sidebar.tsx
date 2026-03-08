import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Settings, Database, Activity, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Clientes', href: '/clients', icon: Users },
    { name: 'Catálogo', href: '/catalog/services', icon: Database },
    { name: 'Relatórios', href: '/reports', icon: Activity },
    { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <div className="flex h-full w-64 flex-col bg-[#0b1121] border-r border-[#1e293b] text-slate-400">
            <div className="flex h-16 shrink-0 items-center px-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-accent bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/50">
                        <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">ZIM DNS</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-4">
                <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Menu Principal</p>
                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? 'bg-blue-600/10 text-blue-400'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                )}
                            >
                                <Icon
                                    className={cn('mr-3 h-5 w-5 shrink-0 transition-colors', isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300')}
                                    aria-hidden="true"
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-white/5 bg-[#080d1a]">
                <div className="flex flex-col gap-1 px-3 py-2">
                    <p className="text-sm font-medium text-slate-300">Painel DNS</p>
                    <p className="text-xs text-slate-500">Versão 1.0.0 &middot; SecOps</p>
                </div>
            </div>
        </div>
    );
}
