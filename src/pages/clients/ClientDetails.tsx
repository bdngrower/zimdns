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
        success: { icon: CheckCircle2, label: 'Sincronizado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
        pending: { icon: Clock, label: 'Pendente', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
        error: { icon: AlertCircle, label: 'Falha no Sync', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
        warning: { icon: AlertCircle, label: 'Parcial', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    } as Record<string, any>;

    const c = config[syncStatus || ''] || config.pending;
    const Icon = c.icon;

    return (
        <div className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider border ${c.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`}></span>
            <Icon className="h-3.5 w-3.5" />
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

        const { data: logsData } = await supabase
            .from('sync_logs')
            .select('*')
            .eq('client_id', id)
            .order('started_at', { ascending: false })
            .limit(5);

        if (logsData) {
            setSyncLogs(logsData);
        }

        setIsLoadingActivity(true);
        fetch(`/api/adguard/activity?clientId=${id}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
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
        return (
            <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Carregando perfil do cliente...</p>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <h3 className="text-red-800 font-bold mb-1">Cliente não encontrado</h3>
                    <p className="text-red-600 text-sm">O cliente solicitado não existe ou foi removido.</p>
                    <Link to="/clients" className="mt-4 inline-block text-sm font-semibold text-red-700 hover:text-red-800 underline transition-colors">Voltar para clientes</Link>
                </div>
            </div>
        );
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
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in transition-all">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <Link to="/clients" className="group inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-4 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Voltar para Clientes
                    </Link>
                    <div className="flex items-center gap-4 flex-wrap">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{client.name}</h1>
                        <div className="flex gap-2 flex-wrap items-center mt-1">
                            <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] uppercase tracking-widest font-semibold border ${client.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${client.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                {client.status === 'active' ? 'Ativa' : 'Inativa'}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] uppercase tracking-widest font-semibold border ${dnsActivity?.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                (dnsActivity && !dnsActivity.isActive) ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-slate-50 text-slate-600 border-slate-200'
                                }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${dnsActivity?.isActive ? 'bg-emerald-500' :
                                    (dnsActivity && !dnsActivity.isActive) ? 'bg-amber-500' :
                                        'bg-slate-400'
                                    }`}></span>
                                {isLoadingActivity ? 'Verificando DNS...' : dnsActivity?.isActive ? 'Tráfego Ativo' : 'Sem Tráfego'}
                            </span>
                            <SyncStatusBadge syncStatus={client.sync_status} />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to={`/clients/${client.id}/edit`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm group"
                    >
                        <Settings className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        Editar Cliente
                    </Link>
                </div>
            </div>

            <div className="mb-8 border-b border-slate-200/80">
                <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
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
                                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                                    'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-semibold transition-all whitespace-nowrap'
                                )}
                                aria-current={isCurrent ? 'page' : undefined}
                            >
                                <Icon
                                    className={cn(
                                        isCurrent ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500',
                                        '-ml-0.5 mr-2.5 h-4 w-4 transition-colors'
                                    )}
                                    aria-hidden="true"
                                />
                                {tab.name}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="card-premium p-6 min-h-[400px]">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Resumo do Perfil */}
                        <div>
                            <h3 className="text-base font-bold text-slate-900 mb-4 tracking-tight">Resumo do Perfil</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Contato Responsável</p>
                                    <p className="text-slate-900 font-medium">{client.contact_name || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">E-mail</p>
                                    <p className="text-slate-900 font-medium">{client.email || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Telefone</p>
                                    <p className="text-slate-900 font-medium">{client.phone || '—'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Telemetria DNS */}
                        <div>
                            <h3 className="text-base font-bold text-slate-900 mb-4 tracking-tight">Telemetria Operacional</h3>
                            {isLoadingActivity ? (
                                <div className="card-premium p-10 flex flex-col items-center justify-center text-slate-500 bg-slate-50/30">
                                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
                                    <span className="text-sm font-medium">Acessando roteadores de borda...</span>
                                </div>
                            ) : dnsActivity?.isActive ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="card-premium p-5 flex flex-col relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 opacity-80" />
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status Operacional</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                            <span className="text-xl font-bold text-slate-900">Online</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-auto pt-4 font-medium">
                                            Visto em: {new Date(dnsActivity.lastSeenAt).toLocaleTimeString('pt-BR')}
                                        </p>
                                    </div>

                                    <div className="card-premium p-5 flex flex-col relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-80" />
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Consultas</p>
                                        <p className="text-3xl font-bold text-slate-900 mt-1">{dnsActivity.queryCount}</p>
                                        <p className="text-[11px] text-slate-400 mt-auto pt-4 font-medium">processadas nas últimas 24h</p>
                                    </div>

                                    <div className="card-premium p-5 flex flex-col relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 opacity-80" />
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bloqueios</p>
                                        <p className="text-3xl font-bold text-slate-900 mt-1">{dnsActivity.blockedCount}</p>
                                        <p className="text-[11px] text-slate-400 mt-auto pt-4 font-medium">ameaças neutralizadas</p>
                                    </div>

                                    <div className="card-premium p-5 flex flex-col relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-80" />
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Identificação Real</p>
                                        <p className="text-base font-bold text-slate-900 truncate mt-1">
                                            {dnsActivity.matchedOrigins?.join(', ') || '—'}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-auto pt-4 font-medium">IP(s) origem detectados ativos</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-amber-200/50 bg-amber-50/50 p-6 rounded-2xl shadow-sm flex gap-4">
                                    <div className="h-10 w-10 shrink-0 rounded-full bg-amber-100/80 flex items-center justify-center">
                                        <AlertCircle className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-amber-900 text-sm mb-1">Aguardando Tráfego de Rede</h4>
                                        <p className="text-sm text-amber-800/80 leading-relaxed max-w-3xl">
                                            O painel central não recebeu requisições DNS originadas a partir dos IPs cadastrados para este cliente. Verifique se os roteadores de borda estão apontando o DNS primário e secundário para os servidores do ZIM DNS.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Status da Sincronização */}
                        <div>
                            <h3 className="text-base font-bold text-slate-900 mb-4 tracking-tight">Status de Sincronização</h3>
                            <div className="card-premium p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <SyncStatusBadge syncStatus={client.sync_status} />
                                        <span className="text-sm font-medium text-slate-500">
                                            {client.last_sync_at
                                                ? `Sincronizado em: ${new Date(client.last_sync_at).toLocaleString('pt-BR')}`
                                                : 'Nenhuma sincronização global ainda'
                                            }
                                        </span>
                                    </div>
                                </div>
                                {client.sync_error_message && (client.sync_status === 'error' || client.sync_status === 'warning') && (
                                    <div className={`mt-4 p-4 text-sm rounded-xl border flex items-start gap-3 ${client.sync_status === 'error' ? 'bg-red-50 text-red-800 border-red-100' : 'bg-amber-50 text-amber-800 border-amber-200/60'}`}>
                                        <AlertCircle className="h-5 w-5 shrink-0" />
                                        <span className="font-medium">{client.sync_error_message}</span>
                                    </div>
                                )}
                                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                                    <p className="text-sm text-blue-800/90 leading-relaxed flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                                        <span className="font-semibold text-blue-900">Sync Automático:</span>
                                        <span>As políticas de bloqueio do catálogo são compiladas e despachadas para o DNS de bateria automaticamente a cada alteração.</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Histórico de Sync */}
                        {syncLogs.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 mb-4 tracking-tight">Histórico de Compilação</h3>
                                <div className="card-premium overflow-hidden">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
                                        <thead className="bg-slate-50/50">
                                            <tr>
                                                <th className="px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Data/Hora</th>
                                                <th className="px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Status</th>
                                                <th className="px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Regras Injetadas</th>
                                                <th className="px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Observação Técnica</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {syncLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-5 py-4 text-slate-900 font-medium whitespace-nowrap">
                                                        {new Date(log.started_at).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-5 py-4 font-medium">
                                                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider border ${log.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            log.status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                'bg-red-50 text-red-700 border-red-200'
                                                            }`}>
                                                            {log.status === 'success' ? 'Sucesso' : log.status === 'warning' ? 'Aviso' : 'Erro API'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-600 font-mono text-xs">
                                                        {log.rules_count ?? '-'} compiladas
                                                    </td>
                                                    <td className="px-5 py-4 text-xs text-slate-500 max-w-[280px] truncate">
                                                        {log.error_message || (log.response_payload?.missing_examples ? `Faltando no motor: ${log.response_payload.missing_examples}` : 'Rollout confirmado e estável')}
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
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <BlockSwitches clientId={client.id} />
                    </div>
                )}

                {activeTab === 'network' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <NetworkOrigins clientId={client.id} />
                    </div>
                )}

                {activeTab === 'dns_logs' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <DnsLogs clientId={client.id} />
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <ManualRules clientId={client.id} />
                    </div>
                )}

                {activeTab === 'blockpage' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <BlockPageSettings clientId={client.id} />
                    </div>
                )}
            </div>
        </div>
    );
}
