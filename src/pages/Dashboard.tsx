import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, ShieldAlert, Globe, Users, Server, CheckCircle2, AlertCircle } from 'lucide-react';

export function Dashboard() {
    const [stats, setStats] = useState({
        tenants: 0,
        rules: 0,
        categories: 0,
        services: 0
    });
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

            // Fetch BD
            const [tenantsRes, rulesRes, catRes, svcRes] = await Promise.all([
                supabase.from('tenants').select('id', { count: 'exact', head: true }),
                supabase.from('manual_rules').select('id', { count: 'exact', head: true }),
                supabase.from('block_categories').select('id', { count: 'exact', head: true }),
                supabase.from('service_catalog').select('id', { count: 'exact', head: true })
            ]);

            setStats({
                tenants: tenantsRes.count || 0,
                rules: rulesRes.count || 0,
                categories: catRes.count || 0,
                services: svcRes.count || 0
            });

            setIsLoading(false);

            // AdGuard Fetch (Independente)
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
        { name: 'Clientes Ativos', value: stats.tenants, icon: Users, change: 'Total', changeType: 'neutral' },
        { name: 'Regras Manuais Cadastradas', value: stats.rules, icon: ShieldAlert, change: 'Geral', changeType: 'neutral' },
        { name: 'Categorias de Bloqueio', value: stats.categories, icon: Activity, change: 'Sistema', changeType: 'neutral' },
        { name: 'Serviços Restritos mapeados', value: stats.services, icon: Globe, change: 'Catálogo', changeType: 'neutral' },
    ];

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Geral</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Visão global dos tenants, regras aplicadas e do motor de resolução DNS.
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

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.name}
                            className="relative overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-sm"
                        >
                            <dt>
                                <div className="absolute rounded-md bg-accent/10 p-3">
                                    <Icon className="h-6 w-6 text-accent" aria-hidden="true" />
                                </div>
                                <p className="ml-16 truncate text-sm font-medium text-slate-500">
                                    {card.name}
                                </p>
                            </dt>
                            <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
                                {isLoading ? (
                                    <p className="text-2xl font-semibold text-slate-900 animate-pulse bg-slate-200 h-8 w-16 rounded"></p>
                                ) : (
                                    <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
                                )}
                            </dd>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm min-h-[300px] flex items-center justify-center">
                <div className="text-center max-w-sm">
                    <Activity className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">Aguardando tráfego DNS dos clientes.</h3>
                    <p className="text-slate-500 mt-2 text-sm">A integração com o Log Engine e a captura de gráficos para as requisições geradas pelos clientes acontecerão aqui uma vez que as implantações de rede ganhem volume.</p>
                </div>
            </div>
        </div>
    );
}
