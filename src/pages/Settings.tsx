import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { GlobalSettings } from '../types';
import { Server, Activity, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export function Settings() {
    const [settings, setSettings] = useState<GlobalSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string; ms?: number } | null>(null);

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
        setIsLoading(false);
    }

    const testConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            // Emulando a chamada para o nosso backend real (Vercel Serverless API)
            // Em dev, o Vite Proxy enviará isso para o Serverless Dev, em prod cai na Vercel Route
            const response = await fetch('/api/adguard/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            setTestResult(result);

            // Atualiza global_settings
            if (settings) {
                const newStatus = result.success ? 'active' : 'error';
                const now = new Date().toISOString();

                await supabase.from('global_settings')
                    .update({
                        last_connection_status: newStatus,
                        last_connection_check_at: now,
                        last_connection_error: result.success ? null : result.message
                    })
                    .eq('id', settings.id);

                setSettings(prev => prev ? {
                    ...prev,
                    last_connection_status: newStatus,
                    last_connection_check_at: now,
                    last_connection_error: result.success ? undefined : result.message
                } : null);
            }

        } catch (error: any) {
            setTestResult({
                success: false,
                message: "Falha de rede ao contatar a API Serverless.",
                details: error.message
            });
        } finally {
            setIsTesting(false);
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

            <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden">
                <div className="border-b border-border bg-slate-50/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-accent rounded-lg border border-blue-100">
                            <Server className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Integração com Motor DNS</h2>
                            <p className="text-sm text-slate-500">Serviço de resolução central (AdGuard Home).</p>
                        </div>
                    </div>
                    {settings?.last_connection_status === 'active' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-medium border border-green-200">
                            <CheckCircle2 className="h-4 w-4" /> Conectado ao AdGuard
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
                                        Último teste local: {new Date(settings.last_connection_check_at).toLocaleString()}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={testConnection}
                                disabled={isTesting}
                                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                            >
                                {isTesting ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Activity className="h-4 w-4 text-accent" />}
                                Testar conexão
                            </button>
                        </div>

                        {testResult && (
                            <div className={`mt-4 p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-start gap-3">
                                    {testResult.success ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />}
                                    <div>
                                        <h5 className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                            {testResult.success ? 'Conexão bem sucedida' : 'Erro de Conectividade'}
                                        </h5>
                                        <p className={`mt-1 text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                                            {testResult.message}
                                        </p>
                                        {testResult.details && (
                                            <pre className="mt-2 text-xs bg-white/50 p-2 rounded border border-black/5 overflow-x-auto text-slate-600">
                                                {testResult.details}
                                            </pre>
                                        )}
                                        {testResult.ms && (
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
                    <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-accent">
                        Salvar Configuração
                    </button>
                </div>
            </div>
        </div>
    );
}
