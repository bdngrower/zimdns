import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Database, Activity, Settings, Shield, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/useAuthStore';

const navMain = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Clientes', href: '/clients', icon: Users },
];

const navSecurity = [
    { name: 'Catálogo', href: '/catalog/services', icon: Database },
    { name: 'Relatórios', href: '/reports', icon: Activity },
];

const navSystem = [
    { name: 'Configurações', href: '/settings', icon: Settings },
];

function NavSection({ items, label }: { items: typeof navMain; label?: string }) {
    const location = useLocation();
    return (
        <div>
            {label && (
                <p className="px-4 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500/70 select-none">
                    {label}
                </p>
            )}
            <nav className="space-y-0.5">
                {items.map((item) => {
                    const isActive = location.pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                'group relative flex items-center gap-3 rounded-lg pl-4 pr-3 py-2.5 text-sm font-medium transition-all duration-150',
                                isActive
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                            )}
                        >
                            {/* Active indicator bar */}
                            {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />
                            )}
                            <Icon
                                className={cn(
                                    'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
                                    isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                                )}
                            />
                            <span className="truncate">{item.name}</span>
                            {isActive && (
                                <ChevronRight className="ml-auto h-3.5 w-3.5 text-blue-500/60" />
                            )}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

export function Sidebar() {
    const { profile } = useAuthStore();

    return (
        <div className="flex h-full w-[220px] flex-col flex-shrink-0" style={{ backgroundColor: 'var(--color-sidebar-bg)', borderRight: '1px solid var(--color-sidebar-border)' }}>
            {/* Logo */}
            <div className="flex h-16 shrink-0 items-center px-5" style={{ borderBottom: '1px solid var(--color-sidebar-border)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)' }}>
                        <Shield className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <span className="text-[15px] font-bold tracking-tight text-white leading-none block">ZIM DNS</span>
                        <span className="text-[10px] font-medium text-slate-500 tracking-wide uppercase leading-none block mt-0.5">Security Platform</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-5 px-3 space-y-5">
                <NavSection items={navMain} label="Principal" />
                <NavSection items={navSecurity} label="Segurança" />
                <NavSection items={navSystem} label="Sistema" />
            </div>

            {/* Footer — status DNS e usuário */}
            <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--color-sidebar-border)' }}>
                {/* DNS Status */}
                <div className="flex items-center gap-2.5 px-3 py-2 mb-2 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.07)' }}>
                    <div className="relative flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                        <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-400 animate-ping opacity-40" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-emerald-400 leading-none truncate">Motor DNS Ativo</p>
                        <p className="text-[10px] text-slate-500 leading-none mt-0.5 truncate">Proteção em tempo real</p>
                    </div>
                </div>

                {/* User */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}>
                        {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-300 leading-none truncate">{profile?.full_name ?? 'Administrador'}</p>
                        <p className="text-[10px] text-slate-500 leading-none mt-0.5 capitalize truncate">{profile?.role?.replace('_', ' ') ?? 'Super Admin'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
