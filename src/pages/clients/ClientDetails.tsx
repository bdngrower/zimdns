import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Client } from '../../types';
import { ArrowLeft, Settings, ShieldAlert, List, Paintbrush, Network, Loader2, AlertCircle, CheckCircle2, Clock, Activity, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BlockSwitches } from './BlockSwitches';
import { ManualRules } from './ManualRules';
import { BlockPageSettings } from './BlockPageSettings';
import { NetworkOrigins } from './NetworkOrigins';
import { DnsLogs } from './DnsLogs';

function SyncStatusBadge({ syncStatus }: { syncStatus?: string }) {
    const config = {
        success: { icon: CheckCircle2, label: 'Sincronizado com DNS', color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
        pending: { icon: Clock, label: 'Alterações pendentes', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
        error: { icon: AlertCircle, label: 'Falha na sincronização', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
        warning: { icon: AlertCircle, label: 'Sincronização parcial', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    } as Record<string, any>;

    const c = config[syncStatus || ''] || config.pending;
    const Icon = c.icon;

    return (
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${c.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`}></span>
            <Icon className="h-3 w-3" />
            {c.label}
        </div>
    );
}

export function ClientDetails() {
    const { id } = useParams();
    const [client, setClient] = useState<Client | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isLoading, setIsLoading] = useState(true);
    const [syncLogs, setSyncLogs] = useState<any[]>([]);
    const [dnsActivity, setDnsActivity] = useState<any>(null);
    const [isLoadingActivity, setIsLoadingActivity] = useState(true);

    async function loadClient() {
        if (!id) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            setClient(data);
        }

        // Puxar logs de sincronia
        const { data: logsData } = await supabase
            .from('sync_logs')
            .select('*')
            .eq('client_id', id)
            .order('started_at', { ascending: false })
            .limit(5);

        if (logsData) {
            setSyncLogs(logsData);
        }

        // Verificar atividade dns
        setIsLoadingActivity(true);
        fetch(`/api/adguard/activity?clientId=${id}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                console.log("🟠 ZIM DNS Frontend - Raw Activity Response:", data);
                if (data._debug) {
                    console.log("🟢 ZIM DNS Frontend - Activity _debug payload:", data._debug);
                }
                if (data.success && data.data) {
                    setDnsActivity(data.data);
                } else {
                    setDnsActivity({ isActive: false });
                }
            })
            .catch(() => {
                setDnsActivity({ isActive: false });
            })
            .finally(() => setIsLoadingActivity(false));

        setIsLoading(false);
    }

    useEffect(() => {
        loadClient();
    }, [id]);

    if (isLoading && !client) {
        return <div className="p-8 text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Recuperando cliente...</div>;
    }

    if (!client) {
        return <div className="p-8 text-red-500">Cliente não encontrado.</div>;
    }

    const tabs = [
        { id: 'dashboard', name: 'Visão Geral', icon: Zap },
        { id: 'blocks', name: 'Políticas de Bloqueio', icon: ShieldAlert },
        { id: 'network', name: 'Origens de Rede', icon: Network },
        { id: 'dns_logs', name: 'Consultas DNS', icon: Activity },
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
                        <div className="flex gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${client.status === 'active'
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                Conta: {client.status === 'active' ? 'Ativa' : 'Inativa'}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${dnsActivity?.isActive ? 'bg-green-50 text-green-700 border-green-200' :
                                (dnsActivity && !dnsActivity.isActive) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                    'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${dnsActivity?.isActive ? 'bg-green-600' :
                                    (dnsActivity && !dnsActivity.isActive) ? 'bg-yellow-500' :
                                        'bg-slate-400'
                                    }`}></span>
                                {isLoadingActivity ? 'Verificando DNS...' : dnsActivity?.isActive ? 'Tráfego DNS Ativo' : 'Sem tráfego detectado'}
                            </span>
                            <SyncStatusBadge syncStatus={client.sync_status} />
                        </div>
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
                        {/* Resumo do Perfil */}
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

                        {/* Telemetria DNS */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Telemetria Operacional</h3>
                            {isLoadingActivity ? (
                                <div className="border border-slate-200 bg-white p-8 rounded-xl shadow-sm flex flex-col items-center justify-center text-slate-500">
                                    <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                    <span className="text-sm">Acessando roteadores de borda...</span>
                                </div>
                            ) : dnsActivity?.isActive ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-sm font-medium text-slate-500 mb-1">Status Operacional</p>
                                        <div className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                                            <span className="text-lg font-semibold text-slate-900">Online</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">
                                            Último acesso: {new Date(dnsActivity.lastSeenAt).toLocaleTimeString('pt-BR')}
                                        </p>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-sm font-medium text-slate-500 mb-1">Consultas</p>
                                        <p className="text-2xl font-bold text-slate-900">{dnsActivity.queryCount}</p>
                                        <p className="text-xs text-slate-400 mt-1">resolvidas recentemente</p>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-sm font-medium text-slate-500 mb-1">Bloqueios</p>
                                        <p className="text-2xl font-bold text-red-600">{dnsActivity.blockedCount}</p>
                                        <p className="text-xs text-slate-400 mt-1">ameaças neutralizadas</p>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                        <p className="text-sm font-medium text-slate-500 mb-1">Identificação Real</p>
                                        <p className="text-sm font-bold text-slate-900 truncate">
                                            {dnsActivity.matchedOrigins?.join(', ') || '-'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">IP(s) origem detectados</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-yellow-200 bg-yellow-50/50 p-6 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                                        <h4 className="font-semibold text-yellow-800">Aguardando Tráfego</h4>
                                    </div>
                                    <p className="text-sm text-yellow-700/80 ml-8">
                                        O painel central ainda não recebeu requisições DNS originadas a partir dos IPs cadastrados para este cliente. Certifique-se de que os roteadores do cliente estão apontando para o endereço IP do ZIM DNS.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Status da Sincronização - compacto */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Status de Sincronização</h3>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <SyncStatusBadge syncStatus={client.sync_status} />
                                        <span className="text-sm text-slate-500">
                                            {client.last_sync_at
                                                ? `Última sincronização: ${new Date(client.last_sync_at).toLocaleString('pt-BR')}`
                                                : 'Nenhuma sincronização registrada'
                                            }
                                        </span>
                                    </div>
                                </div>
                                {client.sync_error_message && (client.sync_status === 'error' || client.sync_status === 'warning') && (
                                    <div className={`mt-3 p-3 text-xs rounded-lg border flex items-start gap-2 ${client.sync_status === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>{client.sync_error_message}</span>
                                    </div>
                                )}
                                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
                                    <p className="text-xs text-blue-800/80 leading-relaxed">
                                        <span className="font-semibold text-blue-900">Sync automático:</span> As políticas de bloqueio são aplicadas automaticamente no motor DNS ao ativar ou desativar switches na aba "Políticas de Bloqueio".
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Histórico de Sync - colapsado */}
                        {syncLogs.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 mb-3 ml-1">Histórico Recente de Sincronização</h3>
                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-slate-500">Data/Hora</th>
                                                <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                                                <th className="px-4 py-3 font-medium text-slate-500">Regras Injetadas</th>
                                                <th className="px-4 py-3 font-medium text-slate-500">Observação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {syncLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                        {new Date(log.started_at).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium">
                                                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${log.status === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                                                            log.status === 'warning' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                'bg-red-50 text-red-700 border-red-200'
                                                            }`}>
                                                            {log.status === 'success' ? 'Sucesso' : log.status === 'warning' ? 'Aviso' : 'Erro API'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600">
                                                        {log.rules_count ?? '-'} rotas compiladas
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[280px] truncate">
                                                        {log.error_message || (log.response_payload?.missing_examples ? `Faltando no motor: ${log.response_payload.missing_examples}` : 'Tudo certo')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'blocks' && (
                    <BlockSwitches clientId={client.id} />
                )}

                {activeTab === 'network' && (
                    <NetworkOrigins clientId={client.id} />
                )}

                {activeTab === 'dns_logs' && (
                    <DnsLogs clientId={client.id} />
                )}

                {activeTab === 'rules' && (
                    <ManualRules clientId={client.id} />
                )}

                {activeTab === 'blockpage' && (
                    <BlockPageSettings clientId={client.id} />
                )}
            </div>
        </div>
    );
}
