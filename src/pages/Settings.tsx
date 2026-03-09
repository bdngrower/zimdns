import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { GlobalSettings } from '../types';
import { Server, Activity, AlertCircle, CheckCircle2, Loader2, ArrowRight, RefreshCw, ShieldAlert } from 'lucide-react';

export function Settings() {
    const [settings, setSettings] = useState<GlobalSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncResult, setSyncResult] = useState<{ success: number; failed: number; total: number } | null>(null);

    // Blockpage State
    const [blockpageIp, setBlockpageIp] = useState('');
    const [isSavingBlockpage, setIsSavingBlockpage] = useState(false);
    const [blockpageResult, setBlockpageResult] = useState<{ success: boolean; message: string } | null>(null);

    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
        details?: string;
        ms?: number;
        running?: boolean;
        version?: string;
    } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('global_settings')
            .select('*')
            .limit(1)
            .single();

        if (data) {
            setSettings(data);
        } else if (error) {
            console.error("Error loading settings:", error);
        }

        // Ler a blockpage settings inicial invisivelmente do AdGuard
        try {
            const resp = await fetch('/api/adguard/status', { method: 'POST' });
            if (resp.ok) {
                const configData = await resp.json();
                if (configData.blocking_mode === 'custom_ip') {
                    setBlockpageIp(configData.blocking_ipv4 || '');
                } else {
                    setBlockpageIp('');
                }
            }
        } catch (e) {
            // Silencioso, usuário pode simplesmente testar a porta depois
        }

        setIsLoading(false);
    }

    const handleSaveBlockpage = async () => {
        setIsSavingBlockpage(true);
        setBlockpageResult(null);
        try {
            const res = await fetch('/api/adguard/blockpage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blockpageIp })
            });
            const data = await res.json();
            if (data.success) {
                setBlockpageResult({ success: true, message: data.message });
            } else {
                setBlockpageResult({ success: false, message: data.message || 'Erro ao comunicar com AdGuard' });
            }
        } catch (err: any) {
            setBlockpageResult({ success: false, message: err.message });
        } finally {
            setIsSavingBlockpage(false);
            setTimeout(() => setBlockpageResult(null), 5000);
        }
    };

    const testConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const response = await fetch('/api/adguard/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            // Garantir interface consistente caso seja 200 OK porem o status retornou algo inesperado
            if (response.ok && result.connected) {
                setTestResult({
                    ...result,
                    success: true,
                    message: "Conexão OK"
                });

                if (settings) {
                    const now = new Date().toISOString();
                    await supabase.from('global_settings')
                        .update({
                            last_connection_status: 'active',
                            last_connection_check_at: now,
                            last_connection_error: null
                        })
                        .eq('id', settings.id);

                    setSettings(prev => prev ? {
                        ...prev,
                        last_connection_status: 'active',
                        last_connection_check_at: now,
                        last_connection_error: undefined
                    } : null);
                }
            } else {
                setTestResult({
                    success: false,
                    message: "Erro de autenticação / conexão",
                    details: result.message || "Verifique as configurações e variáveis de ambiente.",
                    ms: result.ms
                });

                if (settings) {
                    const now = new Date().toISOString();
                    await supabase.from('global_settings')
                        .update({
                            last_connection_status: 'error',
                            last_connection_check_at: now,
                            last_connection_error: result.message || 'Erro de rede'
                        })
                        .eq('id', settings.id);

                    setSettings(prev => prev ? {
                        ...prev,
                        last_connection_status: 'error',
                        last_connection_check_at: now,
                        last_connection_error: result.message || 'Erro de rede'
                    } : null);
                }
            }

        } catch (error: any) {
            setTestResult({
                success: false,
                message: "Erro de autenticação / conexão",
                details: error.message
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSyncAll = async () => {
        if (!confirm('Deseja forçar a sincronização DNS de TODOS os clientes ativos agora?')) return;
        setIsSyncingAll(true);
        setSyncResult(null);

        try {
            // Pegar clientes ativos
            const { data: clients } = await supabase.from('clients').select('id').eq('status', 'active');
            if (!clients || clients.length === 0) {
                setSyncResult({ success: 0, failed: 0, total: 0 });
                setIsSyncingAll(false);
                return;
            }

            let successCount = 0;
            let failedCount = 0;

            // Fazer chamadas sequenciais para nao derrubar
            for (const client of clients) {
                try {
                    const res = await fetch('/api/adguard/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clientId: client.id })
                    });
                    const result = await res.json();
                    if (result.success) {
                        successCount++;
                    } else {
                        failedCount++;
                    }
                } catch {
                    failedCount++;
                }
            }

            setSyncResult({ success: successCount, failed: failedCount, total: clients.length });
        } catch (error) {
            console.error("Sync all failed:", error);
            alert("Erro catastrófico ao iniciar sincronia.");
        } finally {
            setIsSyncingAll(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Carregando configurações...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto animate-in fade-in transition-all">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configurações do Sistema</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                    Gerencie integrações e parâmetros globais do ZIM DNS.
                </p>
            </div>

            <div className="card-premium overflow-hidden mb-8 shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner flex items-center justify-center">
                            <Server className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Motor de Resolução DNS</h2>
                            <p className="text-sm font-medium text-slate-500">Conexão com o nó de inspeção central.</p>
                        </div>
                    </div>
                    {settings?.last_connection_status === 'active' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 text-xs uppercase tracking-widest font-bold border border-emerald-200 shadow-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Proteção Ativa
                        </div>
                    ) : settings?.last_connection_status === 'error' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-50 text-red-700 text-xs uppercase tracking-widest font-bold border border-red-200 shadow-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            Falha na Conexão
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 text-xs uppercase tracking-widest font-bold border border-slate-200 shadow-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                            Status Pendente
                        </div>
                    )}
                </div>

                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-2">URL do Servidor AdGuard (Protegido)</label>
                            <input
                                type="text"
                                disabled
                                value={settings?.adguard_api_url || 'Configurado via Variáveis de Ambiente'}
                                className="block w-full rounded-xl border border-slate-200/60 bg-slate-50 py-3 px-4 text-slate-500 font-mono text-sm shadow-inner cursor-not-allowed opacity-80"
                            />
                            <p className="mt-2 text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Por segurança, as credenciais residem apenas no Vercel (Backend).
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Ambiente Hospedado</label>
                            <input
                                type="text"
                                disabled
                                value={settings?.environment || 'Produção'}
                                className="block w-full rounded-xl border border-slate-200/60 bg-slate-50 py-3 px-4 text-slate-700 text-sm shadow-inner cursor-not-allowed font-medium opacity-80"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-8 mt-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h4 className="text-base font-bold text-slate-900">Teste de Conectividade</h4>
                                <p className="text-sm font-medium text-slate-500 mt-1 max-w-xl leading-relaxed">
                                    O ZIM DNS testará a latência e a validação do Basic Auth da API do AdGuard diretamente via Serverless.
                                </p>
                                {settings?.last_connection_check_at && (
                                    <p className="text-xs font-medium text-slate-400 mt-3 flex items-center gap-1.5">
                                        <Activity className="h-3.5 w-3.5" />
                                        Último teste local: {new Date(settings.last_connection_check_at).toLocaleString('pt-BR')}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={testConnection}
                                disabled={isTesting || isSyncingAll}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-50"
                            >
                                {isTesting ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <Activity className="h-4 w-4 text-blue-600" />}
                                Testar conexão
                            </button>
                        </div>

                        {testResult && (
                            <div className={`mt-6 p-5 rounded-xl border shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${testResult.success ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                                <div className="flex items-start gap-4">
                                    {testResult.success ? <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5" /> : <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />}
                                    <div className="flex-1">
                                        <h5 className={`text-base font-bold tracking-tight ${testResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                                            {testResult.message}
                                        </h5>

                                        {testResult.success && testResult.version && (
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-emerald-700 bg-emerald-100/50 p-3 rounded-lg border border-emerald-200/50">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-emerald-800/80 text-xs uppercase tracking-wider">Versão</span>
                                                    <span className="font-mono">{testResult.version}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-emerald-800/80 text-xs uppercase tracking-wider">Motor Ativo</span>
                                                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 bg-emerald-500 rounded-full"></span>{testResult.running ? 'Sim' : 'Não'}</span>
                                                </div>
                                            </div>
                                        )}

                                        {testResult.details && (
                                            <pre className="mt-3 text-xs bg-white/60 p-3 rounded-lg border border-slate-200/60 overflow-x-auto text-slate-600 shadow-inner font-mono">
                                                {testResult.details}
                                            </pre>
                                        )}
                                        {testResult.ms !== undefined && (
                                            <p className="mt-3 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                                <span className="inline-block p-1 rounded-md bg-slate-100"><Activity className="h-3 w-3" /></span>
                                                Latência Serverless &rarr; Motor DNS: <span className={testResult.ms < 100 ? 'text-emerald-600' : 'text-amber-600'}>{testResult.ms}ms</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50/50 px-8 py-5 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                        <Server className="h-3.5 w-3.5" />
                        Modo Serverless <ArrowRight className="h-3 w-3 mx-1" /> Seguro e Oculto
                    </div>
                </div>
            </div>

            {/* Blockpage Section */}
            <div className="card-premium overflow-hidden mb-8 shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-orange-50 text-orange-600 rounded-xl border border-orange-100 shadow-inner flex items-center justify-center">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Gerenciamento da Blockpage</h2>
                            <p className="text-sm font-medium text-slate-500">Configuração de redirecionamento para domínios classificados como ameaça ou restritos.</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="max-w-2xl">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                            IP de Redirecionamento da Blockpage (Custom IP)
                        </label>
                        <p className="text-sm font-medium text-slate-500 mb-5 leading-relaxed">
                            Forneça o IP externo (do próprio servidor/VPS onde hospeda este painel via Nginx, por exemplo) para onde as consultas DNS bloqueadas devem ser resolvidas. Deixe <strong>vazio</strong> para retornar erro nativo de bloqueio de conexão no navegador.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                placeholder="Ex: 54.232.100.12"
                                value={blockpageIp}
                                onChange={(e) => setBlockpageIp(e.target.value)}
                                className="block w-full sm:flex-1 rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-4 text-sm text-slate-900 transition-all focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 font-mono tracking-wide placeholder:text-slate-400/70"
                            />
                            <button
                                onClick={handleSaveBlockpage}
                                disabled={isSavingBlockpage}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-md shadow-slate-900/10 hover:bg-black focus:outline-none focus:ring-4 focus:ring-slate-900/10 disabled:opacity-50 transition-all"
                            >
                                {isSavingBlockpage && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                                Salvar Destino IP
                            </button>
                        </div>

                        {blockpageResult && (
                            <div className={`mt-5 p-4 rounded-xl border text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${blockpageResult.success ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' : 'bg-red-50/50 border-red-100 text-red-800'}`}>
                                {blockpageResult.success ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
                                {blockpageResult.message}
                            </div>
                        )}

                        <details className="mt-8 group border border-slate-200 rounded-xl bg-slate-50/30 overflow-hidden shadow-sm transition-all">
                            <summary className="px-5 py-4 bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/80 flex items-center justify-between transition-colors border-b border-transparent group-open:border-slate-200">
                                <span className="flex items-center gap-2.5">
                                    <span className="p-1 rounded-md bg-slate-200/50 text-slate-500"><Server className="h-4 w-4" /></span>
                                    Requisitos de Infraestrutura (Avançado)
                                </span>
                                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="p-5 text-[13px] text-slate-600 space-y-4 leading-relaxed">
                                <p>
                                    Como o protocolo DNS não suporta redirecionamento de portas (apenas de IPs), o IP acima exige um servidor proxy (Ex: Nginx) escutando acessos Web interceptados nas portas HTTP (80) e HTTPS (443) padronizadas.
                                </p>
                                <p>
                                    Este servidor Nginx então realiza o proxy pass de todo o tráfego bloqueado para a porta interna da landing page do ZIM DNS (ex: 3000), injetando certificados MITM caso você ofereça decodificação SSL.
                                </p>
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800">
                                    Consulte as instruções completas no arquivo <code className="bg-white/60 px-1 py-0.5 rounded font-mono text-xs border border-blue-200/50 text-blue-900">docs/BLOCKPAGE_SETUP.md</code> para garantir que a landing page estática responda adequadamente para hosts interceptados.
                                </div>
                            </div>
                        </details>
                    </div>
                </div>
            </div>

            {/* Ações Administrativas */}
            <div className="card-premium overflow-hidden mb-8 shadow-sm border-amber-200/50">
                <div className="border-b border-amber-100 bg-amber-50/30 p-6">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Manutenção e Recalibração de Políticas</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                        Ferramentas avançadas de sincronização em lote de clientes.
                    </p>
                </div>
                <div className="p-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div>
                            <h4 className="text-base font-bold text-slate-900">Sincronização Forçada (Global Sync)</h4>
                            <p className="text-sm font-medium text-slate-500 mt-2 max-w-xl leading-relaxed">
                                Executa retransmissão de todas as políticas de acesso combinando catálogo e blocklists de <strong>TODOS</strong> os clientes para o cluster AdGuard.
                            </p>
                            <span className="inline-block mt-3 text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-100/50 border border-amber-200 px-2.5 py-1 rounded">Cuidado: Impacto de Performance</span>
                        </div>
                        <button
                            onClick={handleSyncAll}
                            disabled={isSyncingAll || isTesting}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white border border-amber-300 px-6 py-3 text-sm font-bold text-amber-900 shadow-sm hover:bg-amber-50 focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all disabled:opacity-50"
                        >
                            {isSyncingAll ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> : <RefreshCw className="h-4 w-4 text-amber-600" />}
                            Forçar Sincronização Geral
                        </button>
                    </div>

                    {syncResult && (
                        <div className="mt-8 p-6 rounded-2xl border bg-slate-50 border-slate-200 animate-in fade-in slide-in-from-top-4">
                            <h5 className="text-sm font-bold tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-blue-600" />
                                Relatório de Processamento em Lote
                            </h5>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Tenants Varredura</div>
                                    <div className="text-2xl font-black text-slate-900">{syncResult.total}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center relative overflow-hidden">
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 opacity-80" />
                                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Sucessos</div>
                                    <div className="text-2xl font-black text-emerald-600">{syncResult.success}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center relative overflow-hidden">
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-red-500 opacity-80" />
                                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Falhas (Hard-Fail)</div>
                                    <div className="text-2xl font-black text-red-600">{syncResult.failed}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
