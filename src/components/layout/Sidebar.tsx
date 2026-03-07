import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Settings, Database, Activity } from 'lucide-react';
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
        <div className="flex h-full w-64 flex-col bg-primary text-slate-300">
            <div className="flex h-16 shrink-0 items-center px-6">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-accent flex items-center justify-center font-bold text-white">Z</div>
                    <span className="text-xl font-bold tracking-tight text-white">ZIM DNS</span>
                </div>
            </div>
            <nav className="flex-1 space-y-1 px-4 py-4">
                {navItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                'group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-slate-800 text-white'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            )}
                        >
                            <Icon
                                className={cn('mr-3 h-5 w-5 shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-white')}
                                aria-hidden="true"
                            />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4">
                <div className="rounded-lg bg-slate-800 p-4 text-xs">
                    <p className="font-semibold text-white mb-1">ZIM DNS Admin</p>
                    <p className="text-slate-400">Versão 1.0.0</p>
                </div>
            </div>
        </div>
    );
}
