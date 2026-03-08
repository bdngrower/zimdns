import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, ShieldAlert, Globe, Users, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
    const [stats, setStats] = useState({
        clients: 0,
        rules: 0,
        categories: 0,
        services: 0,
        totalQueries24h: 0,
        totalBlocked24h: 0
    });
    const [topDomains, setTopDomains] = useState<{ domain: string, count: number }[]>([]);
    const [chartSeries, setChartSeries] = useState<{ time: string, queries: number, blocks: number }[]>([]);

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
                totalBlocked24h: tBlocked
            });

            setTopDomains(tDomains);
            setChartSeries(tSeries);
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

    const cards = [
        { name: 'Clientes Protegidos', value: stats.clients, icon: Users, iconColor: 'text-indigo-600', bg: 'bg-indigo-50/80', border: 'border-indigo-100' },
        { name: 'Regras Manuais Ativas', value: stats.rules, icon: ShieldAlert, iconColor: 'text-rose-600', bg: 'bg-rose-50/80', border: 'border-rose-100' },
        { name: 'Consultas DNS (24h)', value: stats.totalQueries24h.toLocaleString(), icon: Activity, iconColor: 'text-emerald-600', bg: 'bg-emerald-50/80', border: 'border-emerald-100' },
        { name: 'Bloqueios Atuados (24h)', value: stats.totalBlocked24h.toLocaleString(), icon: Globe, iconColor: 'text-amber-600', bg: 'bg-amber-50/80', border: 'border-amber-100' },
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monitoramento Executivo</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Visão global de ameaças corporativas, clientes protegidos e telemetria do motor de resolução DNS.
                </p>
            </div>

            {/* ADGUARD INTEGRATION STATUS CARD */}
            <div className="mb-8 bg-white border border-border shadow-sm rounded-xl overflow-hidden p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg border ${adguardState.status === 'success'
                        ? 'bg-green-50 text-green-600 border-green-100'
                        : adguardState.status === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400'
                        }`}>
                        <Server className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Integração com Motor DNS</h2>
                        <p className="text-sm text-slate-500">Autenticação e status operacional do AdGuard via AWS.</p>

                        {adguardState.status === 'success' && adguardState.dnsAddresses && (
                            <p className="text-xs text-slate-500 mt-2 font-mono bg-slate-50 p-1.5 rounded inline-block border">
                                IP do Servidor: {adguardState.dnsAddresses[0] || 'Desconhecido'}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-start md:items-end">
                    {adguardState.status === 'loading' ? (
                        <span className="animate-pulse bg-slate-200 h-6 w-32 rounded"></span>
                    ) : adguardState.status === 'success' ? (
                        <div className="flex flex-col items-end">
                            <div className="inline-flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-green-700">Conectado ao AdGuard</span>
                            </div>
                            <span className="text-xs text-slate-500 mt-1">Servidor DNS AWS - {adguardState.version}</span>
                            <span className="text-xs text-slate-500 mt-0.5">Status: {adguardState.running ? '🚀 Running' : '🔴 Parado'}</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-end">
                            <div className="inline-flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-red-600" />
                                <span className="font-semibold text-red-700">Falha de conexão</span>
                            </div>
                            <span className="text-xs text-red-500 font-medium mt-1">{adguardState.errorMsg}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.name}
                            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] hover:shadow-md transition-shadow"
                        >
                            <dt>
                                <div className={`absolute rounded-xl ${card.bg} border ${card.border} p-3`}>
                                    <Icon className={`h-6 w-6 ${card.iconColor}`} aria-hidden="true" />
                                </div>
                                <p className="ml-16 truncate text-sm font-medium text-slate-500">
                                    {card.name}
                                </p>
                            </dt>
                            <dd className="ml-16 flex items-baseline pb-1 sm:pb-2 mt-1">
                                {isLoading ? (
                                    <p className="text-2xl font-bold text-slate-900 animate-pulse bg-slate-100 h-8 w-16 rounded"></p>
                                ) : (
                                    <p className="text-3xl font-bold tracking-tight text-slate-900">{card.value}</p>
                                )}
                            </dd>
                        </div>
                    );
                })}
            </div>

            {/* Empty State Premium Modificado */}
            {/* Empty State Premium Modificado com Grid */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Atividades Recentes / Threat Feed */}
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-8 flex flex-col justify-center min-h-[300px] shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-slate-900">Volume de Tráfego</h3>
                            <p className="text-sm text-slate-500">Consultas e ameaças mitigadas (últimas 24h)</p>
                        </div>
                        <div className="flex gap-4 text-xs font-medium">
                            <span className="flex items-center gap-1.5 text-slate-600">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Consultas
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-600">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span> Bloqueios
                            </span>
                        </div>
                    </div>

                    {chartSeries.length > 0 ? (
                        <div className="h-64 mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorBlocks" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} minTickGap={30} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                                        labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
                                    />
                                    <Area type="monotone" dataKey="queries" name="Consultas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorQueries)" />
                                    <Area type="monotone" dataKey="blocks" name="Bloqueios" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorBlocks)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-center py-6">
                            <div className="mx-auto h-16 w-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-5">
                                <Activity className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-900">Aguardando telemetria</h3>
                            <p className="text-slate-500 mt-2 text-sm max-w-sm">
                                O gráfico histórico será populado automaticamente assim que clientes iniciarem tráfego no motor.
                            </p>
                        </div>
                    )}
                </div>

                {/* Top Domínios Bloqueados Contexto */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 flex flex-col min-h-[300px] shadow-sm">
                    {topDomains.length > 0 ? (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm">
                                    <ShieldAlert className="h-5 w-5 text-rose-500" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">Ameaças Frequentes</h3>
                                    <p className="text-xs text-slate-500">Top 5 domínios bloqueados (24h)</p>
                                </div>
                            </div>
                            <ul className="space-y-3 flex-1">
                                {topDomains.map((tp, idx) => (
                                    <li key={idx} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="text-xs font-medium text-slate-400 w-4">{idx + 1}.</span>
                                            <span className="text-sm font-medium text-slate-700 truncate">{tp.domain}</span>
                                        </div>
                                        <span className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                                            {tp.count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="mx-auto h-12 w-12 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                <ShieldAlert className="h-5 w-5 text-slate-400" />
                            </div>
                            <h3 className="text-sm font-medium text-slate-900">Métricas de Ameaças</h3>
                            <p className="text-slate-500 mt-2 text-xs max-w-[200px]">
                                Gráficos de domínios restritos e engajamento das regras de parental control e blacklist surgirão aqui assim que ingeridos.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
