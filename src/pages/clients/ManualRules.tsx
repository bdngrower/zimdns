import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Globe, ShieldAlert, ShieldCheck } from 'lucide-react';

interface ManualRulesProps {
    clientId: string;
}

export function ManualRules({ clientId }: ManualRulesProps) {
    const [rules, setRules] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
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

    async function handleAddRule(e: React.FormEvent) {
        e.preventDefault();
        if (!newDomain) return;
        setIsSaving(true);
        const { error } = await supabase.from('manual_rules').insert({
            client_id: clientId,
            domain: newDomain,
            action: newAction,
            notes: newNotes,
        });

        if (!error) {
            setNewDomain('');
            setNewNotes('');
            loadRules();
        }
        setIsSaving(false);
    }

    async function handleDelete(id: string) {
        const { error } = await supabase.from('manual_rules').delete().eq('id', id);
        if (!error) {
            setRules(prev => prev.filter(r => r.id !== id));
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Regras Manuais de Domínio</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Exceções avulsas que se sobrepõem aos bloqueios de categorias.
                    </p>
                </div>
            </div>

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
                            className="block w-full rounded-md border-0 py-1.5 pl-10 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6"
                        />
                    </div>
                </div>
                <div className="w-full md:w-32">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ação</label>
                    <select
                        value={newAction}
                        onChange={(e) => setNewAction(e.target.value as 'allow' | 'block')}
                        className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6"
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
                        className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent w-full md:w-auto h-9"
                >
                    <Plus className="h-4 w-4" />
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
                                        {rule.action === 'block' ? (
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
                                        <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:text-red-700 transition-colors p-1" title="Excluir">
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
