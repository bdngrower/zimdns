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
        return <div className="p-8 text-center text-slate-500">Caregando configurações...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configurações do Sistema</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Gerencie integrações e parâmetros globais do ZIM DNS.
                </p>
            </div>

            <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden mb-8">
                <div className="border-b border-border bg-slate-50/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-accent rounded-lg border border-blue-100">
                            <Server className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Motor de Resolução DNS</h2>
                            <p className="text-sm text-slate-500">Conexão com o nó de inspeção central.</p>
                        </div>
                    </div>
                    {settings?.last_connection_status === 'active' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200">
                            <CheckCircle2 className="h-4 w-4" /> Proteção Ativa
                        </div>
                    ) : settings?.last_connection_status === 'error' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-sm font-medium border border-red-200">
                            <AlertCircle className="h-4 w-4" /> Falha na conexão
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-sm font-medium border border-slate-200">
                            <Activity className="h-4 w-4" /> Status pendente
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">URL do Servidor AdGuard (Protegido)</label>
                            <input
                                type="text"
                                disabled
                                value={settings?.adguard_api_url || 'Configurado via Variáveis de Ambiente'}
                                className="block w-full rounded-md border-0 py-2 px-3 text-slate-500 bg-slate-50 ring-1 ring-inset ring-slate-200 sm:text-sm"
                            />
                            <p className="mt-1.5 text-xs text-slate-500">Por segurança, as credenciais residem apenas no Vercel (Backend).</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente Hospedado</label>
                            <input
                                type="text"
                                disabled
                                value={settings?.environment || 'Produção'}
                                className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 bg-white ring-1 ring-inset ring-slate-300 sm:text-sm"
                            />
                        </div>
                    </div>

                    <div className="border-t border-border pt-6 mt-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-medium text-slate-900">Teste de Conectividade</h4>
                                <p className="text-sm text-slate-500 mt-1 max-w-xl">
                                    O ZIM DNS testará a latência e a validação do Basic Auth da API do AdGuard diretamente via Serverless.
                                </p>
                                {settings?.last_connection_check_at && (
                                    <p className="text-xs text-slate-400 mt-2 block">
                                        Último teste local: {new Date(settings.last_connection_check_at).toLocaleString('pt-BR')}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={testConnection}
                                disabled={isTesting || isSyncingAll}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                            >
                                {isTesting ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Activity className="h-4 w-4 text-accent" />}
                                Testar conexão
                            </button>
                        </div>

                        {testResult && (
                            <div className={`mt-4 p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-start gap-3">
                                    {testResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />}
                                    <div className="flex-1">
                                        <h5 className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                            {testResult.message}
                                        </h5>

                                        {testResult.success && testResult.version && (
                                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-green-700 bg-green-100/50 p-2 rounded">
                                                <span><strong>Versão:</strong> {testResult.version}</span>
                                                <span><strong>Motor Ativo:</strong> {testResult.running ? 'Sim' : 'Não'}</span>
                                            </div>
                                        )}

                                        {testResult.details && (
                                            <pre className="mt-2 text-xs bg-white/50 p-2 rounded border border-black/5 overflow-x-auto text-slate-600">
                                                {testResult.details}
                                            </pre>
                                        )}
                                        {testResult.ms !== undefined && (
                                            <p className="mt-2 text-xs font-mono text-slate-500">Latência Serverless &rarr; Motor DNS: {testResult.ms}ms</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        Modo Serverless <ArrowRight className="h-3 w-3" /> Seguro e Oculto
                    </div>
                </div>
            </div>

            {/* Blockpage Section */}
            <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden mb-8">
                <div className="border-b border-border bg-slate-50/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Gerenciamento da Blockpage</h2>
                            <p className="text-sm text-slate-500">Configuração de redirecionamento para domínios classificados como ameaça ou restritos.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="max-w-2xl">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            IP de Redirecionamento (Custom IP)
                        </label>
                        <p className="text-sm text-slate-500 mb-4">
                            Forneça o IP externo que receberá as requisições bloqueadas. Deixe vazio para o modo padrão (Erro nativo no navegador).
                        </p>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="Ex: 54.232.100.12"
                                value={blockpageIp}
                                onChange={(e) => setBlockpageIp(e.target.value)}
                                className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6"
                            />
                            <button
                                onClick={handleSaveBlockpage}
                                disabled={isSavingBlockpage}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                            >
                                {isSavingBlockpage && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                                Aplicar IP
                            </button>
                        </div>

                        {blockpageResult && (
                            <div className={`mt-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${blockpageResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                {blockpageResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                {blockpageResult.message}
                            </div>
                        )}

                        <details className="mt-8 group border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                            <summary className="px-4 py-3 bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center justify-between">
                                <span className="flex items-center gap-2"><Server className="h-4 w-4 text-slate-400" /> Requisitos de Infraestrutura (Avançado)</span>
                                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="p-4 text-xs text-slate-600 space-y-3 leading-relaxed border-t border-slate-200">
                                <p>
                                    Como o protocolo DNS não suporta redirecionamento de portas (apenas de IPs), o IP acima exige um servidor proxy local para escutar acessos Web interceptados nas portas HTTP padronizadas.
                                </p>
                                <p>
                                    <strong>Servidor Recomendado:</strong> Instalar um proxy reverso (Nginx) na mesma máquina, escutando a porta 80 e transferindo a carga do DNS interno para outra porta isolada (ex: 3000).
                                </p>
                                <p>Consulte as intruções completas no arquivo <code>docs/BLOCKPAGE_SETUP.md</code> para garantir que a proteção responda a nuvem Serverless.</p>
                            </div>
                        </details>
                    </div>
                </div>
            </div>

            {/* Ações Administrativas */}
            <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden mb-8">
                <div className="border-b border-border bg-slate-50/50 p-6">
                    <h2 className="text-base font-semibold text-slate-900">Manutenção da Plataforma</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Ferramentas de sincronização e recalibração.
                    </p>
                </div>
                <div className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-slate-900">Sincronização Forçada de Políticas</h4>
                            <p className="text-sm text-slate-500 mt-1 max-w-xl">
                                Vasculha todos os clientes ativos e força a retransmissão de suas políticas de acesso ao motor central. Indicado apenas após interrupções de rota.
                            </p>
                        </div>
                        <button
                            onClick={handleSyncAll}
                            disabled={isSyncingAll || isTesting}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                        >
                            {isSyncingAll ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : <RefreshCw className="h-4 w-4 text-slate-500" />}
                            Sincronizar Todos
                        </button>
                    </div>

                    {syncResult && (
                        <div className="mt-4 p-4 rounded-lg border bg-slate-50 border-slate-200">
                            <h5 className="text-sm font-semibold text-slate-900 mb-2">Resultado da Sincronização em Lote</h5>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="text-slate-600">Total processados: <span className="font-bold text-slate-900">{syncResult.total}</span></div>
                                <div className="text-green-600">Sucesso: <span className="font-bold">{syncResult.success}</span></div>
                                <div className="text-red-600">Falhas: <span className="font-bold">{syncResult.failed}</span></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
