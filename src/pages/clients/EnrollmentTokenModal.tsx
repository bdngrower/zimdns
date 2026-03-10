import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { EnrollmentToken, ClientPolicy } from '../../types';
import { X, Copy, Check, Info, Shield, Calendar, Hash, Tag, Plus, Loader2 } from 'lucide-react';

interface EnrollmentTokenModalProps {
    clientId: string;
    onClose: () => void;
}

export function EnrollmentTokenModal({ clientId, onClose }: EnrollmentTokenModalProps) {
    const [tokens, setTokens] = useState<EnrollmentToken[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    const [policies, setPolicies] = useState<ClientPolicy[]>([]);
    const [newLabel, setNewLabel] = useState('');
    const [newPolicyId, setNewPolicyId] = useState<string>('');
    const [newExpiryHours, setNewExpiryHours] = useState('24');
    const [newMaxUses, setNewMaxUses] = useState('1');

    const [generatedToken, setGeneratedToken] = useState<{raw: string, command: string} | null>(null);

    useEffect(() => {
        loadTokens();
        loadPolicies();
    }, [clientId]);

    async function loadTokens() {
        const { data } = await supabase
            .from('enrollment_tokens')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (data) setTokens(data as EnrollmentToken[]);
        setIsLoading(false);
    }

    async function loadPolicies() {
        const { data } = await supabase
            .from('client_policies')
            .select('*')
            .eq('client_id', clientId)
            .eq('enabled', true);
        if (data) setPolicies(data);
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsCreating(true);
        setGeneratedToken(null);

        const { data: { session } } = await supabase.auth.getSession();

        try {
            const res = await fetch('/api/agent/enrollment-tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    client_id: clientId,
                    label: newLabel,
                    client_policy_id: newPolicyId || null,
                    expires_in_hours: parseInt(newExpiryHours),
                    max_uses: parseInt(newMaxUses)
                })
            });

            if (res.ok) {
                const data = await res.json();
                setGeneratedToken({
                    raw: data.enrollment_token,
                    command: data.install_command
                });
                loadTokens();
                setNewLabel('');
            } else {
                const err = await res.json();
                alert(`Erro: ${err.error}`);
            }
        } catch (err) {
            alert('Falha ao conectar com o servidor.');
        } finally {
            setIsCreating(false);
        }
    }

    async function handleCopy(text: string, id: string) {
        await navigator.clipboard.writeText(text);
        setCopySuccess(id);
        setTimeout(() => setCopySuccess(null), 2000);
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transition-all overflow-hidden`}>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Plus className="h-5 w-5 text-accent" />
                            Novo Instalador ZimDNS
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
                    {!generatedToken ? (
                        <form onSubmit={handleCreate} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Tag className="h-4 w-4 text-slate-400" />
                                        Identificação (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Deployment Financeiro"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-slate-400" />
                                        Política Base
                                    </label>
                                    <select
                                        value={newPolicyId}
                                        onChange={(e) => setNewPolicyId(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-accent outline-none transition-all"
                                    >
                                        <option value="">Herança do Cliente (Geral)</option>
                                        {policies.map(p => (
                                            <option key={p.id} value={p.id}>{p.policy_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-slate-400" />
                                        Expiração do Link
                                    </label>
                                    <select
                                        value={newExpiryHours}
                                        onChange={(e) => setNewExpiryHours(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-accent outline-none transition-all"
                                    >
                                        <option value="1">1 hora</option>
                                        <option value="24">24 horas</option>
                                        <option value="48">48 horas</option>
                                        <option value="168">7 dias</option>
                                        <option value="720">30 dias</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Hash className="h-4 w-4 text-slate-400" />
                                        Limite de Usos (Máx Devices)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={newMaxUses}
                                        onChange={(e) => setNewMaxUses(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-accent outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full py-3 bg-accent hover:bg-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Gerando Token...
                                    </>
                                ) : (
                                    <>Gerar Link de Instalação</>
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-4">
                                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                    <Check className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-green-900">Token Gerado com Sucesso!</h4>
                                    <p className="text-sm text-green-700 mt-0.5">
                                        Este token será exibido apenas uma vez por motivos de segurança.
                                    </p>
                                </div>
                            </div>

                            {/* Windows Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Windows</div>
                                    <h5 className="text-xs font-bold text-slate-700">Instalação via PowerShell (Recomendado)</h5>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800 group relative">
                                    <code className="text-blue-400 text-xs font-mono break-all flex-1 line-clamp-3">
                                        {`.\\${generatedToken.command}`}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(`.\\${generatedToken.command}`, 'ps')}
                                        className="p-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-all active:scale-95"
                                        title="Copiar comando PowerShell"
                                    >
                                        {copySuccess === 'ps' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 mb-2 mt-4">
                                    <div className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Windows</div>
                                    <h5 className="text-xs font-bold text-slate-700">Instalação via Prompt (CMD)</h5>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800 group relative opacity-80">
                                    <code className="text-blue-400 text-xs font-mono break-all flex-1 line-clamp-2">
                                        {generatedToken.command}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(generatedToken.command, 'cmd')}
                                        className="p-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-all active:scale-95"
                                        title="Copiar comando CMD"
                                    >
                                        {copySuccess === 'cmd' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Linux/Mac Section */}
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                <div className="flex items-center justify-between opacity-50">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Linux / macOS</div>
                                        <span className="text-xs font-semibold text-slate-600">Agente Disponível em versões futuras</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setGeneratedToken(null)}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-all"
                            >
                                Gerar outro
                            </button>
                        </div>
                    )}

                    <div className="mt-10 border-t border-slate-100 pt-8">
                        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <HistoryIcon className="h-4 w-4 text-slate-400" />
                            Tokens Ativos para este Cliente
                        </h4>

                        {isLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="h-6 w-6 text-slate-300 animate-spin" />
                            </div>
                        ) : tokens.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Nenhum token ativo no momento.</p>
                        ) : (
                            <div className="space-y-3">
                                {tokens.filter(t => t.status === 'active').map(token => (
                                    <div key={token.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg group">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-800">{token.label || 'Sem rótulo'}</span>
                                                <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                                    {token.token_prefix}...
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Hash className="h-3 w-3" /> {token.used_count}/{token.max_uses || '∞'} usos
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" /> Expira {new Date(token.expires_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <div className="flex items-start gap-3">
                        <Info className="h-4 w-4 text-slate-400 mt-0.5" />
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            O ZIM DNS Agent se comunicará com o backend para enrollment e receberá dinamicamente a URL do DoH Proxy configurada no ambiente. Não é necessário reinstalar o agente para mudar o endpoint DoH.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HistoryIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
        </svg>
    );
}
