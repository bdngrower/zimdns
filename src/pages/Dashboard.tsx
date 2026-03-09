import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Globe, Server, ShieldAlert, Users } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
    const [stats, setStats] = useState({
        clients: 0,
        rules: 0,
        categories: 0,
        services: 0,
        totalQueries24h: 0,
        totalBlocked24h: 0,
        threatsCataloged: 0
    });
    const [topDomains, setTopDomains] = useState<{ domain: string, count: number }[]>([]);
    const [chartSeries, setChartSeries] = useState<{ time: string, queries: number, blocks: number }[]>([]);
    const [suggestedDomains, setSuggestedDomains] = useState<{ domain: string, status: string, detected_at: string }[]>([]);

    const [adguardState, setAdguardState] = useState<{
        status: 'loading' | 'success' | 'error';
        connected?: boolean;
        running?: boolean;
        version?: string;
        dnsAddresses?: string[];
        errorMsg?: string;
    }>({ status: 'loading' });

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);

            // Fetch DB + Global Stats
            let clientsCount = 0;
            let rulesCount = 0;

            try {
                const [clientsRes, rulesRes] = await Promise.all([
                    supabase.from('clients').select('id', { count: 'exact', head: true }),
                    supabase.from('manual_rules').select('id', { count: 'exact', head: true }),
                ]);
                clientsCount = clientsRes.count || 0;
                rulesCount = rulesRes.count || 0;
            } catch (e) { }

            let tQueries = 0;
            let tBlocked = 0;
            let tDomains: any[] = [];
            let tSeries: any[] = [];
            let tSuggested: any[] = [];
            let tThreats = 0;

            try {
                const statsRes = await fetch('/api/adguard/stats_global');
                const statsData = await statsRes.json();

                if (statsData._debug) {
                    console.log("🟢 ZIM DNS Dashboard Global Stats Debug:", statsData._debug);
                }

                if (statsData.success) {
                    tQueries = statsData.stats.totalQueries24h;
                    tBlocked = statsData.stats.totalBlocked24h;
                    tDomains = statsData.stats.topDomains;
                    tSeries = statsData.stats.chartSeries || [];
                    tSuggested = statsData.stats.suggestedDomains || [];
                    tThreats = statsData.stats.threatsCataloged || 0;
                }
            } catch (e) {
                console.error("Dashboard failed to fetch stats_global:", e);
            }


            setStats({
                clients: clientsCount,
                rules: rulesCount,
                categories: 0,
                services: 0,
                totalQueries24h: tQueries,
                totalBlocked24h: tBlocked,
                threatsCataloged: tThreats
            });

            setTopDomains(tDomains);
            setChartSeries(tSeries);
            setSuggestedDomains(tSuggested);
            setIsLoading(false);

            // AdGuard Status Fetch (Independente)
            try {
                const agRes = await fetch('/api/adguard/status');
                const agData = await agRes.json();

                if (agRes.ok && agData.connected) {
                    setAdguardState({
                        status: 'success',
                        connected: true,
                        running: agData.running,
                        version: agData.version,
                        dnsAddresses: agData.dns_addresses
                    });
                } else {
                    setAdguardState({
                        status: 'error',
                        errorMsg: agData.message || 'Falha ao conectar ao servidor DNS'
                    });
                }
            } catch (err: any) {
                setAdguardState({
                    status: 'error',
                    errorMsg: 'Falha de rede ao verificar status DNS'
                });
            }
        }

        loadData();
    }, []);

    const fmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' });
    const blockRate = stats.totalQueries24h > 0
        ? ((stats.totalBlocked24h / stats.totalQueries24h) * 100).toFixed(1)
        : '0.0';

    const metricCards = [
        {
            label: 'Clientes Protegidos',
            value: isLoading ? null : String(stats.clients),
            icon: Users,
            iconClass: 'text-blue-500',
            iconBg: 'bg-blue-50',
            accent: '#3b82f6',
            sub: 'Redes ativas',
        },
        {
            label: 'Consultas DNS',
            value: isLoading ? null : fmt.format(stats.totalQueries24h),
            icon: Activity,
            iconClass: 'text-emerald-500',
            iconBg: 'bg-emerald-50',
            accent: '#10b981',
            sub: 'Últimas 24h',
        },
        {
            label: 'Ameaças Bloqueadas',
            value: isLoading ? null : fmt.format(stats.totalBlocked24h),
            icon: ShieldAlert,
            iconClass: 'text-rose-500',
            iconBg: 'bg-rose-50',
            accent: '#ef4444',
            sub: 'Últimas 24h',
        },
        {
            label: 'Taxa de Bloqueio',
            value: isLoading ? null : `${blockRate}%`,
            icon: Globe,
            iconClass: 'text-violet-500',
            iconBg: 'bg-violet-50',
            accent: '#8b5cf6',
            sub: 'Do total de consultas',
        },
    ];

    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const todayCap = today.charAt(0).toUpperCase() + today.slice(1);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in transition-all">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="page-title">Monitoramento Executivo</h1>
                    <p className="page-subtitle">Telemetria DNS em tempo real &middot; {todayCap}</p>
                </div>
                {/* AdGuard Status Badge */}
                <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border ${adguardState.status === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : adguardState.status === 'error'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                    <div className={`relative flex-shrink-0 h-2 w-2 rounded-full ${adguardState.status === 'success' ? 'bg-emerald-500' :
                        adguardState.status === 'error' ? 'bg-red-500' : 'bg-slate-400'
                        }`}>
                        {adguardState.status === 'success' && (
                            <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-400 animate-ping opacity-60" />
                        )}
                    </div>
                    <Server className="h-4 w-4 opacity-70" />
                    {adguardState.status === 'loading' ? 'Verificando motor DNS...' :
                        adguardState.status === 'success' ? `Motor DNS Ativo — ${adguardState.version ?? ''}` :
                            `Falha: ${adguardState.errorMsg}`}
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {metricCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.label}
                            className="card-premium p-5 transition-all duration-200 hover:translate-y-[ -2px]"
                            style={{ borderLeft: `3px solid ${card.accent}` }}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`h-10 w-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                                    <Icon className={`h-5 w-5 ${card.iconClass}`} />
                                </div>
                            </div>
                            {card.value === null ? (
                                <div className="h-8 w-20 bg-slate-100 rounded-lg animate-pulse mb-1" />
                            ) : (
                                <p className="stat-value">{card.value}</p>
                            )}
                            <p className="text-sm font-semibold text-slate-700 mt-1">{card.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* Charts + Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Area Chart — 3/5 */}
                <div className="lg:col-span-3 card-premium p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Volume de Tráfego DNS</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Consultas e bloqueios nas últimas 24 horas</p>
                        </div>
                        <div className="flex gap-4 text-xs font-medium">
                            <span className="flex items-center gap-1.5 text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-blue-500" /> Consultas
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-rose-500" /> Bloqueios
                            </span>
                        </div>
                    </div>
                    {chartSeries.length > 0 ? (
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradQ" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={30} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,0.08)', fontSize: 12 }}
                                        labelStyle={{ color: '#64748b', fontWeight: 600, marginBottom: 4 }}
                                    />
                                    <Area type="monotone" dataKey="queries" name="Consultas" stroke="#3b82f6" strokeWidth={2} fill="url(#gradQ)" dot={false} />
                                    <Area type="monotone" dataKey="blocks" name="Bloqueios" stroke="#ef4444" strokeWidth={2} fill="url(#gradB)" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-56 flex flex-col items-center justify-center text-center">
                            <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                <Activity className="h-7 w-7 text-slate-300" />
                            </div>
                            <p className="text-sm font-semibold text-slate-600">Aguardando telemetria</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">O gráfico será populado quando clientes iniciarem tráfego.</p>
                        </div>
                    )}
                </div>

                {/* Top Domains — 1/5 */}
                <div className="lg:col-span-1 card-premium p-5 flex flex-col">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-100">
                            <ShieldAlert className="h-4 w-4 text-rose-500" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-900 leading-none">Top Ameaças</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Bloqueios frequentes</p>
                        </div>
                    </div>
                    {topDomains.length > 0 ? (
                        <ul className="space-y-2.5 flex-1">
                            {topDomains.slice(0, 7).map((tp, idx) => (
                                <li key={idx} className="flex items-center gap-2 group">
                                    <span className="text-[10px] font-bold text-slate-300 w-4 flex-shrink-0 group-hover:text-rose-400 transition-colors">{idx + 1}</span>
                                    <span className="text-xs text-slate-600 truncate flex-1 font-medium group-hover:text-slate-900 transition-colors">{tp.domain}</span>
                                    <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 flex-shrink-0">{fmt.format(tp.count)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <ShieldAlert className="h-8 w-8 text-slate-200 mb-2" />
                            <p className="text-xs text-slate-400">Sem bloqueios registrados</p>
                        </div>
                    )}
                </div>

                {/* Auto-Learning — 1/5 */}
                <div className="lg:col-span-1 card-premium p-5 flex flex-col">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center border border-violet-100">
                            <Globe className="h-4 w-4 text-violet-500" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-900 leading-none">Smart Shield</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Descobertas por IA</p>
                        </div>
                    </div>
                    {suggestedDomains.length > 0 ? (
                        <ul className="space-y-2.5 flex-1">
                            {suggestedDomains.slice(0, 7).map((tp, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-600 truncate font-medium">{tp.domain}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <Globe className="h-8 w-8 text-slate-200 mb-2" />
                            <p className="text-xs text-slate-400">Aguardando detecções da IA</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
