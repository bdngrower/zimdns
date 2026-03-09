import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Shield, CheckCircle2, Mail, Lock, ArrowRight, Zap, Globe, Users } from 'lucide-react';

const trustSignals = [
    {
        icon: Shield,
        title: 'Proteção por Políticas',
        desc: 'Controle granular por cliente e categoria',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
    },
    {
        icon: Zap,
        title: 'Motor DNS em Tempo Real',
        desc: 'Filtragem instantânea de ameaças DNS',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
    },
    {
        icon: Globe,
        title: 'Blocklists Inteligentes',
        desc: 'OISD, AdGuard, BlocklistProject e mais',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
    },
    {
        icon: Users,
        title: 'Multi-Tenant Nativo',
        desc: 'Gerencie centenas de clientes com isolamento',
        color: 'text-violet-400',
        bg: 'bg-violet-500/10',
    },
];

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { user, setUser } = useAuthStore();

    // Redirecionamento reativo: se o estado global for populado magicamente (ex: onAuthStateChange)
    // Isso tira a tela da trava 'Autenticando...' num instante.
    useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('[Login] handleLogin started', { email });
        setIsLoading(true);
        setError('');

        try {
            console.log('[Login] Calling signInWithPassword...');
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            console.log('[Login] signInWithPassword returned', { data, error });
            if (error) throw error;
            if (data.user) {
                console.log('[Login] Setting user in store...');
                setUser(data.user);
                console.log('[Login] Navigating to /dashboard...');
                navigate('/dashboard', { replace: true });
                console.log('[Login] Navigation called.');
            }
        } catch (err: any) {
            console.error('[Login] Login error:', err);
            setError(err.message || 'Credenciais inválidas. Verifique e tente novamente.');
        } finally {
            setIsLoading(false);
            console.log('[Login] handleLogin finally block executed.');
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* === Left Panel — Branding + Trust === */}
            <div
                className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 relative overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, #050a18 0%, #0c1631 60%, #0f1e3d 100%)',
                }}
            >
                {/* Noise texture overlay */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                    }}
                />

                {/* Grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(59, 130, 246, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 1) 1px, transparent 1px)`,
                        backgroundSize: '48px 48px',
                    }}
                />

                {/* Glow orbs */}
                <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
                <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />

                {/* Top — Logo */}
                <div className="relative flex items-center gap-3 z-10">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)', boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)' }}>
                        <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <span className="text-xl font-bold text-white tracking-tight">ZIM DNS</span>
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-blue-400/80 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                            Security Platform
                        </span>
                    </div>
                </div>

                {/* Center — Hero */}
                <div className="relative z-10 space-y-8">
                    <div>
                        <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
                            Firewall DNS<br />
                            <span style={{ background: 'linear-gradient(90deg, #60a5fa 0%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                para empresas sérias
                            </span>
                        </h1>
                        <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-md">
                            Proteção multicamadas, políticas granulares por cliente e visibilidade total do tráfego DNS da sua rede.
                        </p>
                    </div>

                    {/* Trust Signals */}
                    <div className="grid grid-cols-1 gap-3 max-w-md">
                        {trustSignals.map((signal) => {
                            const Icon = signal.icon;
                            return (
                                <div
                                    key={signal.title}
                                    className="flex items-center gap-3.5 p-3.5 rounded-xl border"
                                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
                                >
                                    <div className={`flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg ${signal.bg}`}>
                                        <Icon className={`h-4 w-4 ${signal.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white leading-none">{signal.title}</p>
                                        <p className="text-xs text-slate-500 leading-none mt-1">{signal.desc}</p>
                                    </div>
                                    <CheckCircle2 className="ml-auto h-4 w-4 text-slate-600 flex-shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom — Tagline */}
                <div className="relative z-10">
                    <p className="text-[12px] text-slate-600 flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Sistema operacional — Proteção ativa
                    </p>
                </div>
            </div>

            {/* === Right Panel — Auth === */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white lg:px-12">
                <div className="w-full max-w-[380px]">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)' }}>
                            <Shield className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-lg font-bold text-slate-900">ZIM DNS</span>
                    </div>

                    {/* Header */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Bem-vindo de volta
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            Acesse o painel de segurança DNS
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Email corporativo
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                                    <Mail className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all duration-150 outline-none focus:border-blue-400"
                                    style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
                                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12), 0 1px 2px rgba(15,23,42,0.04)'; }}
                                    onBlur={(e) => { e.target.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'; }}
                                    placeholder="voce@empresa.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Senha
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                                    <Lock className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all duration-150 outline-none focus:border-blue-400"
                                    style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
                                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12), 0 1px 2px rgba(15,23,42,0.04)'; }}
                                    onBlur={(e) => { e.target.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'; }}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                                <span className="flex-shrink-0 mt-0.5 h-4 w-4 text-red-400">⚠</span>
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-150 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                                background: isLoading ? '#3b82f6' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                boxShadow: isLoading ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                            }}
                            onMouseEnter={(e) => { if (!isLoading) { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(37, 99, 235, 0.45), inset 0 1px 0 rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; } }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                        >
                            {isLoading ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Autenticando...
                                </>
                            ) : (
                                <>
                                    Acessar Painel
                                    <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer trust */}
                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-4">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Conexão segura
                        </div>
                        <span className="text-slate-200">·</span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Shield className="h-3 w-3" />
                            Protegido por Supabase Auth
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
