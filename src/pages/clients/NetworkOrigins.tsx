import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { ClientNetwork, OriginType } from '../../types';
import { Network, Plus, Trash2, Globe, Server, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface NetworkOriginsProps {
    clientId: string;
}

export function NetworkOrigins({ clientId }: NetworkOriginsProps) {
    const [origins, setOrigins] = useState<ClientNetwork[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [newType, setNewType] = useState<OriginType>('ip');
    const [newValue, setNewValue] = useState('');
    const [newDesc, setNewDesc] = useState('');

    useEffect(() => {
        loadOrigins();
    }, [clientId]);

    async function loadOrigins() {
        setIsLoading(true);
        const { data } = await supabase
            .from('client_networks')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: true });

        if (data) setOrigins(data);
        setIsLoading(false);
    }

    async function handleAddOrigin(e: React.FormEvent) {
        e.preventDefault();
        if (!newValue) return;
        setIsSaving(true);

        const { error } = await supabase.from('client_networks').insert({
            client_id: clientId,
            type: newType,
            value: newValue,
            description: newDesc,
        });

        if (!error) {
            setNewValue('');
            setNewDesc('');
            loadOrigins();
        } else {
            alert(`Falha de segurança/banco de dados ao salvar rede: ${error.message}`);
        }
        setIsSaving(false);
    }

    async function handleDelete(id: string) {
        const { error } = await supabase.from('client_networks').delete().eq('id', id);
        if (!error) {
            setOrigins(prev => prev.filter(o => o.id !== id));
        } else {
            alert(`Falha de segurança/banco de dados ao excluir rede: ${error.message}`);
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Origens de Rede</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Endereços IP fixos ou domínios DynDNS que identificam o tráfego deste cliente no servidor DNS.
                    </p>
                </div>
            </div>

            <form onSubmit={handleAddOrigin} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-40">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                    <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as OriginType)}
                        className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-accent sm:text-sm sm:leading-6"
                    >
                        <option value="ip">IP Fixo</option>
                        <option value="dyndns">DynDNS</option>
                    </select>
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor (IP ou Hostname)</label>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            {newType === 'ip' ? <Server className="h-4 w-4 text-slate-400" /> : <Globe className="h-4 w-4 text-slate-400" />}
                        </div>
                        <input
                            type="text"
                            required
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            placeholder={newType === 'ip' ? "Ex: 200.200.200.10" : "Ex: matriz.ddns.net"}
                            className="block w-full rounded-md border-0 py-1.5 pl-10 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-accent sm:text-sm sm:leading-6"
                        />
                    </div>
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                    <input
                        type="text"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Ex: Filial Centro, Link Backup..."
                        className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-accent sm:text-sm sm:leading-6"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 w-full md:w-auto h-9"
                >
                    <Plus className="h-4 w-4" />
                    Adicionar
                </button>
            </form>

            {isLoading ? (
                <div className="text-center py-4 text-sm text-slate-500">Carregando origens...</div>
            ) : origins.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <Network className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">Nenhuma origem de rede cadastrada. O cliente não será identificado pelo motor DNS.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {origins.map((origin) => (
                        <div key={origin.id} className="flex items-center justify-between p-4 bg-white border border-border rounded-lg shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-md ${origin.type === 'ip' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                    {origin.type === 'ip' ? <Server className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-900 font-mono">{origin.value}</span>
                                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                            {origin.type.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">{origin.description || 'Sem descrição'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                {origin.type === 'dyndns' && (
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 mb-1">Último IP Resolvido:</p>
                                        <div className="flex items-center gap-1.5 justify-end">
                                            {origin.resolution_status === 'active' ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                            ) : origin.resolution_status === 'error' ? (
                                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                                            ) : (
                                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                            )}
                                            <span className="text-sm font-mono text-slate-700">
                                                {origin.resolved_ip || 'Aguardando...'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => handleDelete(origin.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-2"
                                    title="Remover Origem"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
