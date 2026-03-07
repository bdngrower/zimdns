import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Tenant } from '../../types';
import { ArrowLeft, Settings, ShieldAlert, List, Paintbrush, Network, Server, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BlockSwitches } from './BlockSwitches';
import { ManualRules } from './ManualRules';
import { BlockPageSettings } from './BlockPageSettings';
import { NetworkOrigins } from './NetworkOrigins';

export function ClientDetails() {
    const { id } = useParams();
    const [client, setClient] = useState<Tenant | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadClient() {
            if (!id) return;
            setIsLoading(true);
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && data) {
                setClient(data);
            }
            setIsLoading(false);
        }
        loadClient();
    }, [id]);

    if (isLoading) {
        return <div className="p-8 text-slate-500">Recuperando cliente...</div>;
    }

    if (!client) {
        return <div className="p-8 text-red-500">Cliente não encontrado.</div>;
    }

    const tabs = [
        { id: 'dashboard', name: 'Visão Geral e Sync', icon: Settings },
        { id: 'network', name: 'Origens de Rede', icon: Network },
        { id: 'blocks', name: 'Bloqueios (Switches)', icon: ShieldAlert },
        { id: 'rules', name: 'Regras Manuais', icon: List },
        { id: 'blockpage', name: 'Página de Bloqueio', icon: Paintbrush },
    ];

    return (
        <div className="p-8">
            <div className="mb-6">
                <Link to="/clients" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-4 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para Clientes
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{client.name}</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            {client.primary_dns_ip ? `DNS Primário: ${client.primary_dns_ip}` : 'Ambiente aguardando configuração de IP DNS'}
                        </p>
                    </div>
                    <span className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium ring-1 ring-inset ${client.status === 'active'
                        ? 'bg-green-50 text-green-700 ring-green-600/20'
                        : 'bg-red-50 text-red-700 ring-red-600/10'
                        }`}>
                        {client.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
            </div>

            <div className="mb-8 border-b border-border">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isCurrent = activeTab === tab.id;
                        return (
                            <button
                                key={tab.name}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    isCurrent
                                        ? 'border-accent text-accent'
                                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
                                    'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors'
                                )}
                                aria-current={isCurrent ? 'page' : undefined}
                            >
                                <Icon
                                    className={cn(
                                        isCurrent ? 'text-accent' : 'text-slate-400 group-hover:text-slate-500',
                                        '-ml-0.5 mr-2 h-5 w-5'
                                    )}
                                    aria-hidden="true"
                                />
                                {tab.name}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm min-h-[400px]">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-medium text-slate-900 mb-4">Informações do Cliente</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-lg border border-slate-100">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Contato Responsável</p>
                                    <p className="mt-1 text-slate-900 font-medium">{client.contact_name || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Email</p>
                                    <p className="mt-1 text-slate-900 font-medium">{client.email || '-'}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-slate-900 mb-4">Status do Motor DNS (AdGuard)</h3>
                            <div className="flex flex-col md:flex-row items-center justify-between bg-white p-5 rounded-lg border border-border shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${client.sync_status === 'success' ? 'bg-green-50 text-green-600' : client.sync_status === 'error' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                        <Server className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">Status da Sincronização</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-semibold text-slate-900">
                                                {client.sync_status === 'success' ? 'Sincronizado' : client.sync_status === 'error' ? 'Falha na Sincronização' : 'Pendente / Desatualizado'}
                                            </span>
                                            {client.sync_status === 'error' && (
                                                <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 ml-2">
                                                    {client.sync_error_message || 'Erro desconhecido'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Última Sincronização: {client.last_sync_at ? new Date(client.last_sync_at).toLocaleString('pt-BR') : 'Nunca sincronizado'}
                                        </p>
                                    </div>
                                </div>
                                <button className="mt-4 md:mt-0 flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                                    <RefreshCw className="h-4 w-4" />
                                    Sincronizar DNS Agora
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                                O processo de sync envia todas as políticas do tenant listadas neste painel (switches e regras) em formato compatível para os filtros do DNS remoto.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'network' && (
                    <NetworkOrigins tenantId={client.id} />
                )}

                {activeTab === 'blocks' && (
                    <BlockSwitches tenantId={client.id} />
                )}

                {activeTab === 'rules' && (
                    <ManualRules tenantId={client.id} />
                )}

                {activeTab === 'blockpage' && (
                    <BlockPageSettings tenantId={client.id} />
                )}
            </div>
        </div>
    );
}
