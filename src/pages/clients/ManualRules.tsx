import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Globe, ShieldAlert, ShieldCheck, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ManualRulesProps {
    clientId: string;
}

export function ManualRules({ clientId }: ManualRulesProps) {
    const [rules, setRules] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error' | 'syncing'; text: string } | null>(null);

    const [newDomain, setNewDomain] = useState('');
    const [newAction, setNewAction] = useState<'allow' | 'block'>('block');
    const [newNotes, setNewNotes] = useState('');

    useEffect(() => {
        loadRules();
    }, [clientId]);

    async function loadRules() {
        setIsLoading(true);
        const { data } = await supabase
            .from('manual_rules')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (data) setRules(data);
        setIsLoading(false);
    }

    async function triggerSync() {
        setIsSyncing(true);
        setSyncFeedback({ type: 'syncing', text: 'Sincronizando políticas com o motor DNS...' });

        try {
            const response = await fetch('/api/adguard/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId })
            });
            const result = await response.json();

            if (result.success && !result.warning) {
                setSyncFeedback({ type: 'success', text: 'Regra salva e sincronizada com o DNS.' });
            } else if (result.success && result.warning) {
                setSyncFeedback({ type: 'success', text: result.message || 'Regras enviadas com aviso parcial.' });
            } else {
                setSyncFeedback({ type: 'error', text: result.message || 'Falha ao sincronizar com o AdGuard.' });
            }
        } catch (err: any) {
            setSyncFeedback({ type: 'error', text: `Erro de rede: ${err.message}` });
        } finally {
            setIsSyncing(false);
            // Limpar mensagem de sucesso após 5s
            setTimeout(() => setSyncFeedback(prev => prev?.type === 'success' ? null : prev), 5000);
        }
    }

    async function handleAddRule(e: React.FormEvent) {
        e.preventDefault();
        if (!newDomain || isSyncing) return;
        setIsSaving(true);
        setSyncFeedback(null);

        const { error } = await supabase.from('manual_rules').insert({
            client_id: clientId,
            domain: newDomain,
            type: newAction,
            notes: newNotes,
            is_active: true
        });

        if (!error) {
            setNewDomain('');
            setNewNotes('');
            await loadRules();
            setIsSaving(false);
            await triggerSync();
        } else {
            setSyncFeedback({ type: 'error', text: 'Erro ao salvar no banco local.' });
            setIsSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (isSyncing) return;
        setSyncFeedback(null);

        const { error } = await supabase.from('manual_rules').delete().eq('id', id);
        if (!error) {
            setRules(prev => prev.filter(r => r.id !== id));
            await triggerSync();
        } else {
            setSyncFeedback({ type: 'error', text: 'Erro ao excluir no banco local.' });
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Regras Manuais de Domínio</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Exceções avulsas que se sobrepõem aos bloqueios de categorias. Sincronizadas automaticamente.
                    </p>
                </div>
            </div>

            {/* Feedback de Sincronização */}
            {syncFeedback && (
                <div className={cn(
                    "mb-6 px-4 py-3 rounded-xl border flex items-center gap-3 text-sm transition-all",
                    syncFeedback.type === 'success' && 'bg-green-50/50 border-green-200 text-green-800',
                    syncFeedback.type === 'error' && 'bg-red-50/50 border-red-200 text-red-800',
                    syncFeedback.type === 'syncing' && 'bg-blue-50/50 border-blue-200 text-blue-800',
                )}>
                    {syncFeedback.type === 'syncing' && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                    {syncFeedback.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {syncFeedback.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span className="leading-relaxed">{syncFeedback.text}</span>
                    {syncFeedback.type === 'error' && (
                        <button
                            onClick={triggerSync}
                            disabled={isSyncing}
                            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 transition-colors"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Tentar novamente
                        </button>
                    )}
                </div>
            )}

            <form onSubmit={handleAddRule} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Domínio</label>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Globe className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            required
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="ex: youtube.com"
                            disabled={isSaving || isSyncing}
                            className="block w-full rounded-md border-0 py-1.5 pl-10 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6 disabled:opacity-50"
                        />
                    </div>
                </div>
                <div className="w-full md:w-32">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ação</label>
                    <select
                        value={newAction}
                        onChange={(e) => setNewAction(e.target.value as 'allow' | 'block')}
                        disabled={isSaving || isSyncing}
                        className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6 disabled:opacity-50"
                    >
                        <option value="block">Bloquear</option>
                        <option value="allow">Permitir</option>
                    </select>
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Observação (Opcional)</label>
                    <input
                        type="text"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Motivo da regra..."
                        disabled={isSaving || isSyncing}
                        className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6 disabled:opacity-50"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isSaving || isSyncing}
                    className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent w-full md:w-auto h-9 disabled:opacity-50"
                >
                    {(isSaving || isSyncing) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Adicionar
                </button>
            </form>

            {isLoading ? (
                <div className="text-center py-4 text-sm text-slate-500">Carregando regras...</div>
            ) : rules.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <Globe className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">Nenhuma regra manual configurada para este cliente.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Domínio</th>
                                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Ação</th>
                                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Origem / Obs</th>
                                <th scope="col" className="relative px-4 py-3"><span className="sr-only">Remover</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-white">
                            {rules.map((rule) => (
                                <tr key={rule.id}>
                                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{rule.domain}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {rule.type === 'block' ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                                <ShieldAlert className="h-3.5 w-3.5" /> Bloquear
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                                <ShieldCheck className="h-3.5 w-3.5" /> Permitir
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-500">{rule.notes || '-'}</td>
                                    <td className="px-4 py-3 text-right text-sm font-medium">
                                        <button onClick={() => handleDelete(rule.id)} disabled={isSyncing} className="text-red-500 hover:text-red-700 transition-colors p-1 disabled:opacity-50" title="Excluir">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
