import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Tenant } from '../../types';
import { ArrowLeft, Settings, ShieldAlert, List, Paintbrush, Network, Server, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

    useEffect(() => {
        loadClient();
    }, [id]);

    const handleSync = async () => {
        if (!client) return;
        setIsSyncing(true);
        setSyncMessage(null);

        try {
            const response = await fetch('/api/adguard/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: client.id })
            });

            const result = await response.json();

            if (result.success) {
                setSyncMessage({ type: 'success', text: 'Sincronização concluída com sucesso!' });
                await loadClient(); // Recarrega os dados para pegar o novo status do banco
            } else {
                setSyncMessage({ type: 'error', text: result.message || 'Falha ao sincronizar' });
                await loadClient(); // Recarrega para ver a msg de erro do banco se houver
            }
        } catch (error: any) {
            setSyncMessage({ type: 'error', text: `Erro de rede: ${error.message}` });
        } finally {
            setIsSyncing(false);
        }
    };

    if (isLoading && !client) {
        return <div className="p-8 text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Recuperando cliente...</div>;
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
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <Link to="/clients" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-4 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para Clientes
                    </Link>
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{client.name}</h1>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${client.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${client.status === 'active' ? 'bg-green-600' : 'bg-slate-400'}`}></span>
                            {client.status === 'active' ? 'Operacional' : 'Inativo'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to={`/clients/${client.id}/edit`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Settings className="h-4 w-4 text-slate-500" />
                        Editar Perfil
                    </Link>
                </div>
            </div>

            <div className="mb-8 border-b border-slate-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isCurrent = activeTab === tab.id;
                        return (
                            <button
                                key={tab.name}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    isCurrent
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
                                    'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors whitespace-nowrap'
                                )}
                                aria-current={isCurrent ? 'page' : undefined}
                            >
                                <Icon
                                    className={cn(
                                        isCurrent ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500',
                                        '-ml-0.5 mr-2 h-5 w-5 transition-colors'
                                    )}
                                    aria-hidden="true"
                                />
                                {tab.name}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm min-h-[400px]">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumo do Perfil</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-xl border border-slate-200">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contato Responsável</p>
                                    <p className="mt-2 text-slate-900 font-medium">{client.contact_name || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</p>
                                    <p className="mt-2 text-slate-900 font-medium">{client.email || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Telefone</p>
                                    <p className="mt-2 text-slate-900 font-medium">{client.phone || '—'}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Integração AdGuard</h3>
                            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-6">
                                <div className="flex items-start gap-5">
                                    <div className={`p-4 rounded-xl shrink-0 ${client.sync_status === 'success' ? 'bg-green-50/80 border border-green-100 text-green-600' : client.sync_status === 'error' ? 'bg-red-50/80 border border-red-100 text-red-600' : 'bg-slate-50 border border-slate-200 text-slate-500'}`}>
                                        <Server className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Estado da Transmissão de Regras</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${client.sync_status === 'success' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                                    client.sync_status === 'error' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                                                        'bg-slate-50 text-slate-600 ring-slate-500/10'
                                                }`}>
                                                {client.sync_status === 'success' ? 'Sincronizado' : client.sync_status === 'error' ? 'Falha Operacional' : 'Aguardando Sincronia'}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-sm text-slate-500">
                                            Último evento processado: {client.last_sync_at ? new Date(client.last_sync_at).toLocaleString('pt-BR') : 'Sem registros'}
                                        </div>

                                        {(client.sync_status === 'error' && client.sync_error_message) && (
                                            <div className="mt-3 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex items-start gap-2">
                                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                                <span>{client.sync_error_message}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    <button
                                        onClick={handleSync}
                                        disabled={isSyncing}
                                        className="w-full md:w-auto flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
                                    >
                                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin text-slate-300" /> : <RefreshCw className="h-4 w-4 text-slate-300" />}
                                        {isSyncing ? 'Sincronizando Políticas...' : 'Forçar Sincronia de DNS'}
                                    </button>
                                </div>
                            </div>

                            {syncMessage && (
                                <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 text-sm border ${syncMessage.type === 'success' ? 'bg-green-50/50 border-green-200 text-green-800' : 'bg-red-50/50 border-red-200 text-red-800'
                                    }`}>
                                    {syncMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /> : <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />}
                                    <span className="leading-relaxed">{syncMessage.text}</span>
                                </div>
                            )}

                            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                                <p className="text-sm text-blue-800/80 leading-relaxed">
                                    <span className="font-semibold text-blue-900">Como funciona:</span> O processo de "Forçar Sincronia" empacota as origens de rede deste tenant e suas configurações de bloqueio (Services, Categories, Block Page) enviando-as diretamente para a infraestrutura do AdGuard Serverless em poucos segundos.
                                </p>
                            </div>
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
