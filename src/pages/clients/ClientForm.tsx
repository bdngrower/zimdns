import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Building2, Save, ArrowLeft, Loader2, Globe, ShieldCheck, LayoutTemplate } from 'lucide-react';
import type { Client, EntityStatus, OriginType } from '../../types';

// Arrays de Toggles baseados na especificação do UX de onboarding
const DEFAULT_POLICIES = [
    { name: 'IA', description: 'ChatGPT, OpenAI, Claude, Gemini, Perplexity', enabled: true },
    { name: 'Streaming', description: 'YouTube, Netflix, Twitch', enabled: false },
    { name: 'Redes sociais', description: 'Facebook, Instagram, X (Twitter), TikTok', enabled: false },
    { name: 'Fóruns e comunidades', description: 'Reddit, Discord', enabled: false },
    { name: 'Outros bloqueios', description: 'VPN, Proxies, Adult Content, Malware', enabled: true },
];

export function ClientForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    const [isLoading, setIsLoading] = useState(isEditing);
    const [isSaving, setIsSaving] = useState(false);

    // Seção 1
    const [formData, setFormData] = useState<Partial<Client>>({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        status: 'active' as EntityStatus,
        notes: '',
    });

    // Seção 2
    const [networkType, setNetworkType] = useState<OriginType>('ip');
    const [networkValue, setNetworkValue] = useState('');
    const [networkDesc, setNetworkDesc] = useState('');

    // Seção 3
    const [policies, setPolicies] = useState(DEFAULT_POLICIES);

    // Seção 4
    const [blockMessage, setBlockMessage] = useState('Este site foi bloqueado pela política de segurança da sua empresa. Caso precise de acesso, contate o administrador.');

    useEffect(() => {
        if (isEditing) {
            loadClient();
        }
    }, [id]);

    async function loadClient() {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (data) setFormData(data);

            // Carregando rede primária
            const { data: networks } = await supabase
                .from('client_networks')
                .select('*')
                .eq('client_id', id)
                .limit(1);

            if (networks && networks.length > 0) {
                setNetworkType(networks[0].type);
                setNetworkValue(networks[0].value);
                setNetworkDesc(networks[0].description || '');
            }

            // Carregando blocks
            const { data: bPage } = await supabase
                .from('block_pages')
                .select('*')
                .eq('client_id', id)
                .single();
            if (bPage && bPage.description) setBlockMessage(bPage.description);

            // Carregando políticas
            const { data: pData } = await supabase
                .from('client_policies')
                .select('*')
                .eq('client_id', id);

            if (pData && pData.length > 0) {
                setPolicies(prev => prev.map(p => {
                    const loaded = pData.find(db => db.policy_name === p.name);
                    if (loaded) return { ...p, enabled: loaded.enabled };
                    return p;
                }));
            }

        } catch (error) {
            console.error('Erro ao carregar cliente:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const togglePolicy = (index: number) => {
        setPolicies(prev => {
            const newP = [...prev];
            newP[index].enabled = !newP[index].enabled;
            return newP;
        });
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validação da Rede
        if (!networkValue || networkValue.trim() === '') {
            alert('Você deve preencher a Origem da Rede (IP ou DynDNS) obrigatoriamente.');
            return;
        }

        if (networkType === 'ip') {
            const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
            if (!ipRegex.test(networkValue)) {
                alert('Formato de IP inválido. Utilize o formato X.X.X.X.');
                return;
            }
        } else {
            if (!networkValue.includes('.')) {
                alert('Hostname DynDNS inválido. Exemplo correto: empresa.ddns.net');
                return;
            }
        }

        setIsSaving(true);
        try {
            let workingId = id;

            if (isEditing) {
                const { error } = await supabase
                    .from('clients')
                    .update(formData)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error, data } = await supabase
                    .from('clients')
                    .insert([formData])
                    .select()
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Criação de client falhou');
                workingId = data.id;
            }

            if (!workingId) throw new Error("ID do cliente não encontrado.");

            // 2. Salvar Identificação de Rede
            if (!isEditing) {
                const { error: netErr } = await supabase.from('client_networks').insert({
                    client_id: workingId,
                    type: networkType,
                    value: networkValue,
                    description: networkDesc || 'Rede Principal - ' + formData.name
                });
                if (netErr) throw netErr;
            } else {
                // Em edição, procurar a principal para fazer upsert amigável ou update geral 
                const { data: net, error: findNetErr } = await supabase.from('client_networks').select('id').eq('client_id', workingId).limit(1);
                if (findNetErr) throw findNetErr;

                if (net && net.length > 0) {
                    const { error: updNetErr } = await supabase.from('client_networks').update({
                        type: networkType,
                        value: networkValue,
                        description: networkDesc || 'Rede Principal'
                    }).eq('id', net[0].id);
                    if (updNetErr) throw updNetErr;
                } else {
                    const { error: insNetErr } = await supabase.from('client_networks').insert({
                        client_id: workingId,
                        type: networkType,
                        value: networkValue,
                        description: networkDesc || 'Rede Principal'
                    });
                    if (insNetErr) throw insNetErr;
                }
            }

            // 3. Salvar Políticas
            const policyInserts = policies.map(p => ({
                client_id: workingId,
                policy_name: p.name,
                enabled: p.enabled
            }));

            if (isEditing) {
                const { error: delPolErr } = await supabase.from('client_policies').delete().eq('client_id', workingId);
                if (delPolErr) throw delPolErr;
            }

            const { error: insPolErr } = await supabase.from('client_policies').insert(policyInserts);
            if (insPolErr) throw insPolErr;

            // 4. Salvar Block Page
            if (isEditing) {
                const { data: pageResult, error: findBpErr } = await supabase.from('block_pages').select('id').eq('client_id', workingId).limit(1);
                if (findBpErr) throw findBpErr;

                if (pageResult && pageResult.length > 0) {
                    const { error: updBpErr } = await supabase.from('block_pages').update({
                        description: blockMessage,
                    }).eq('id', pageResult[0].id);
                    if (updBpErr) throw updBpErr;
                } else {
                    const { error: insBpErr } = await supabase.from('block_pages').insert({
                        client_id: workingId,
                        description: blockMessage,
                        title: 'Acesso Bloqueado',
                    });
                    if (insBpErr) throw insBpErr;
                }
            } else {
                const { error: insBpErr2 } = await supabase.from('block_pages').insert({
                    client_id: workingId,
                    description: blockMessage,
                    title: 'Acesso Bloqueado',
                });
                if (insBpErr2) throw insBpErr2;
            }
            try {
                await fetch('/api/adguard/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientId: workingId })
                });
            } catch (e) {
                console.error("Falha ao comunicar com API do Adguard", e);
            }

            navigate('/clients');
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            alert('Ocorreu um erro ao salvar o cliente. Verifique o console.');
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in transition-all">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/clients')}
                        className="group p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                    >
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            {isEditing ? 'Editar Perfil do Cliente' : 'Cadastrar Novo Cliente'}
                        </h1>
                        <p className="text-sm text-slate-500 mt-1 font-medium">
                            {isEditing ? 'Gerencie as propriedades técnicas e contratuais do ambiente gerido.' : 'Siga as quatro seções para provisionar o sistema de proteção DNS.'}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* Seção 1: Dados da Empresa */}
                <div className="card-premium p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-inner">
                            <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">1. Informações da Empresa</h2>
                            <p className="text-sm font-medium text-slate-500">Dados cadastrais básicos de identificação e contato corporativo.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6 pl-0 sm:pl-16">
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Nome da Empresa <span className="text-red-500">*</span></label>
                            <input
                                type="text" required value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-4 text-sm text-slate-900 transition-all focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                                placeholder="Ex: Acme Corp"
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Status Operacional</label>
                            <select
                                value={formData.status || 'active'}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as EntityStatus })}
                                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-4 text-sm text-slate-900 transition-all focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            >
                                <option value="active">Ativo (Políticas aplicadas)</option>
                                <option value="inactive">Inativo (Bypass geral)</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Nome do Responsável</label>
                            <input
                                type="text" value={formData.contact_name || ''}
                                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-4 text-sm text-slate-900 transition-all focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                                placeholder="João Silva"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Email Profissional</label>
                            <input
                                type="email" value={formData.email || ''}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-4 text-sm text-slate-900 transition-all focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                                placeholder="joao@acme.com"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Telefone</label>
                            <input
                                type="text" value={formData.phone || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-4 text-sm text-slate-900 transition-all focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                        <div className="sm:col-span-6">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Observações Internas (Opcional)</label>
                            <textarea
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={3}
                                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-4 text-sm text-slate-900 transition-all focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                                placeholder="Detalhes específicos do contrato ou arquitetura do cliente..."
                            />
                        </div>
                    </div>
                </div>

                {/* Seção 2: Identificação de Rede */}
                <div className="card-premium p-8 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center border border-teal-100 shadow-inner">
                            <Globe className="h-6 w-6 text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                2. Identificação de Rede
                                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-md bg-red-50 text-red-600 border border-red-100">Essencial</span>
                            </h2>
                            <p className="text-sm font-medium text-slate-500">Parâmetros chave que atrelam este cliente ao motor de bloqueios DNS.</p>
                        </div>
                    </div>

                    <div className="pl-0 sm:pl-16">
                        <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6 bg-slate-50/80 p-6 rounded-2xl border border-slate-200/60 shadow-sm inner-shadow-sm">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold text-slate-900 mb-2">Método de Origem</label>
                                <select
                                    value={networkType}
                                    onChange={(e) => setNetworkType(e.target.value as OriginType)}
                                    className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                                >
                                    <option value="ip">IP Estático Público</option>
                                    <option value="dyndns">Hostname / DynDNS</option>
                                </select>
                            </div>
                            <div className="sm:col-span-4">
                                <label className="block text-sm font-semibold text-slate-900 mb-2">
                                    {networkType === 'ip' ? 'IP da Borda (Público)' : 'Domínio DynDNS'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text" required value={networkValue}
                                    onChange={(e) => setNetworkValue(e.target.value)}
                                    className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 font-mono tracking-wide placeholder:text-slate-300"
                                    placeholder={networkType === 'ip' ? 'Ex: 177.12.30.90' : 'empresa.ddns.net'}
                                />
                            </div>
                            <div className="sm:col-span-6 border-t border-slate-200/60 pt-6">
                                <label className="block text-sm font-semibold text-slate-900 mb-2">Descrição da Conexão (Opcional)</label>
                                <input
                                    type="text" value={networkDesc}
                                    onChange={(e) => setNetworkDesc(e.target.value)}
                                    className="block w-full md:w-2/3 rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 placeholder:text-slate-400"
                                    placeholder="Ex: Matriz Corporate / Filial / Concentrador VPN"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seção 3: Políticas de Bloqueio Rápido */}
                <div className="card-premium p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-inner">
                            <ShieldCheck className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">3. Políticas de Setup Rápido</h2>
                            <p className="text-sm font-medium text-slate-500">Pré-configure os grupos de filtro. Você poderá refinar domínios específicos no painel depois.</p>
                        </div>
                    </div>

                    <div className="pl-0 sm:pl-16 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {policies.map((p, idx) => (
                            <div key={p.name} onClick={() => togglePolicy(idx)} className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-start gap-4 ${p.enabled ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'}`}>
                                <div className="flex-1 mt-0.5">
                                    <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                                    <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{p.description}</p>
                                </div>
                                <div
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${p.enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <span className="sr-only">Habilitar {p.name}</span>
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${p.enabled ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Seção 4: Block Page */}
                <div className="card-premium p-8 shadow-sm mb-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100 shadow-inner">
                            <LayoutTemplate className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">4. Experiência de Bloqueio</h2>
                            <p className="text-sm font-medium text-slate-500">Personalize a página estática exibida quando interceptamos o acesso.</p>
                        </div>
                    </div>

                    <div className="pl-0 sm:pl-16">
                        <label className="block text-sm font-semibold text-slate-900 mb-3">Mensagem Exibida ao Usuário</label>
                        <textarea
                            value={blockMessage}
                            onChange={(e) => setBlockMessage(e.target.value)}
                            rows={3}
                            className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-4 text-sm text-slate-900 transition-all focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                            placeholder="Este conteúdo foi bloqueado..."
                        />
                        <div className="mt-4 flex items-start gap-2 text-xs font-medium text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-amber-600">💡</span>
                            Nota: Suporte a Block Pages via interceptação HTTPS requer instalação do Certificado de Autoridade (CA) raiz nos dispositivos da rede local do cliente (MITM proxying).
                        </div>
                    </div>
                </div>

                {/* Submit Row */}
                <div className="pt-6 pb-12 flex items-center justify-end gap-x-4 border-t border-slate-200/60 mt-8">
                    <button
                        type="button"
                        onClick={() => navigate('/clients')}
                        className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors px-4 py-3"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-xl bg-slate-900 px-8 py-3 text-sm font-bold text-white hover:bg-black focus:outline-none focus:ring-4 focus:ring-slate-900/10 disabled:opacity-50 inline-flex items-center gap-2 transition-all shadow-md shadow-slate-900/10"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Save className="h-4 w-4" />}
                        {isEditing ? 'Atualizar Cliente' : 'Finalizar Provisionamento'}
                    </button>
                </div>
            </form>
        </div>
    );
}
