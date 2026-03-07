import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, ShieldAlert, Globe, Users } from 'lucide-react';

export function Dashboard() {
    const [stats, setStats] = useState({
        tenants: 0,
        rules: 0,
        categories: 0,
        services: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            setIsLoading(true);

            const [tenantsRes, rulesRes, catRes, svcRes] = await Promise.all([
                supabase.from('tenants').select('id', { count: 'exact', head: true }),
                supabase.from('manual_rules').select('id', { count: 'exact', head: true }),
                supabase.from('block_categories').select('id', { count: 'exact', head: true }),
                supabase.from('service_catalog').select('id', { count: 'exact', head: true }),
            ]);

            setStats({
                tenants: tenantsRes.count || 0,
                rules: rulesRes.count || 0,
                categories: catRes.count || 0,
                services: svcRes.count || 0
            });

            setIsLoading(false);
        }
        loadStats();
    }, []);

    const cards = [
        { name: 'Clientes Ativos', value: stats.tenants, icon: Users, change: '+2', changeType: 'positive' },
        { name: 'Regras Personalizadas', value: stats.rules, icon: ShieldAlert, change: '+12%', changeType: 'positive' },
        { name: 'Categorias Monitoradas', value: stats.categories, icon: Activity, change: '-', changeType: 'neutral' },
        { name: 'Serviços no Catálogo', value: stats.services, icon: Globe, change: '-', changeType: 'neutral' },
    ];

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Geral</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Visão geral do sistema e status global dos tenants.
                </p>
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
                                <p
                                    className={`ml-2 flex items-baseline text-sm font-semibold ${card.changeType === 'positive' ? 'text-green-600' : 'text-slate-500'
                                        }`}
                                >
                                    {card.change}
                                </p>
                            </dd>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm min-h-[400px] flex items-center justify-center">
                <div className="text-center max-w-sm">
                    <Activity className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">Gráfico de Tráfego</h3>
                    <p className="text-slate-500 mt-2 text-sm">Integração com DNS Tracker Engine pendente. Aqui será exibido o volume de requisições DNS processadas e bloqueadas em tempo real.</p>
                </div>
            </div>
        </div>
    );
}
