import { useAuthStore } from '../../store/useAuthStore';
import { LogOut, Bell, ChevronDown, Shield } from 'lucide-react';

export function Header() {
    const { user, profile, signOut } = useAuthStore();

    const initials = (profile?.full_name ?? user?.email ?? 'U')
        .split(' ')
        .map((w: string) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const roleLabel = (profile?.role ?? 'admin')
        .replace('_', ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

    return (
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur-sm px-6 gap-4"
            style={{ boxShadow: '0 1px 0 0 rgba(15, 23, 42, 0.04)' }}>
            {/* Left: Context / Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 cursor-default select-none">
                    <div className="h-2 w-2 rounded-full flex-shrink-0 bg-emerald-400" />
                    <span className="text-sm font-semibold text-slate-700 truncate">Visão Geral</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                </div>
            </div>

            {/* Right: Actions + User */}
            <div className="flex items-center gap-3">
                {/* Notifications */}
                <button
                    className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150"
                    aria-label="Notificações"
                >
                    <Bell className="h-[18px] w-[18px]" />
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-blue-500 rounded-full" />
                </button>

                {/* Divider */}
                <div className="h-6 w-px bg-slate-200" />

                {/* User block */}
                <div className="flex items-center gap-2.5 pl-1">
                    <div className="hidden sm:flex sm:flex-col sm:items-end">
                        <span className="text-[13px] font-semibold text-slate-800 leading-none">{profile?.full_name ?? user?.email}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                            <Shield className="h-2.5 w-2.5 text-blue-500" />
                            <span className="text-[11px] font-medium text-slate-400">{roleLabel}</span>
                        </div>
                    </div>

                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 select-none"
                        style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
                        {initials}
                    </div>

                    {/* Logout */}
                    <button
                        onClick={() => signOut()}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                        title="Sair"
                        aria-label="Sair"
                    >
                        <LogOut className="h-[16px] w-[16px]" />
                    </button>
                </div>
            </div>
        </header>
    );
}
