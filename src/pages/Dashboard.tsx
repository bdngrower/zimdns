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
    const [globalSettings, setGlobalSettings] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            setIsLoading(true);

            const [tenantsRes, rulesRes, catRes, svcRes, settingsRes] = await Promise.all([
                supabase.from('tenants').select('id', { count: 'exact', head: true }),
                supabase.from('manual_rules').select('id', { count: 'exact', head: true }),
                supabase.from('block_categories').select('id', { count: 'exact', head: true }),
                supabase.from('service_catalog').select('id', { count: 'exact', head: true }),
                supabase.from('global_settings').select('*').limit(1).single()
            ]);

            setStats({
                tenants: tenantsRes.count || 0,
                rules: rulesRes.count || 0,
                categories: catRes.count || 0,
                services: svcRes.count || 0
            });

            if (settingsRes.data) {
                setGlobalSettings(settingsRes.data);
            }

            setIsLoading(false);
        }
        loadStats();
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
                    <div className={`p-3 rounded-lg border ${globalSettings?.last_connection_status === 'active'
                            ? 'bg-green-50 text-green-600 border-green-100'
                            : 'bg-red-50 text-red-600 border-red-100'
                        }`}>
                        <Server className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Integração com Motor DNS</h2>
                        <p className="text-sm text-slate-500">Motor de Resolução Primária configurado para operação remota em {globalSettings?.environment || 'AWS'}.</p>
                    </div>
                </div>

                <div className="flex flex-col items-start md:items-end">
                    {isLoading ? (
                        <span className="animate-pulse bg-slate-200 h-6 w-32 rounded"></span>
                    ) : globalSettings?.last_connection_status === 'active' ? (
                        <div className="inline-flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="font-semibold text-green-700">Verificado & Conectado</span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            <span className="font-semibold text-red-700">Falha ou Não Executado</span>
                        </div>
                    )}
                    {globalSettings?.last_connection_check_at && (
                        <p className="text-xs text-slate-400 mt-1">
                            Última verificação: {new Date(globalSettings.last_connection_check_at).toLocaleString()}
                        </p>
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
                    <h3 className="text-lg font-medium text-slate-900">Nenhum Registro de Tráfego</h3>
                    <p className="text-slate-500 mt-2 text-sm">As queries de DNS e os bloqueios em tempo real ainda não foram ingeridos a partir dos clientes. Quando o ambiente estiver em roteamento ativo, os gráficos aparecerão aqui de forma orgânica.</p>
                </div>
            </div>
        </div>
    );
}
