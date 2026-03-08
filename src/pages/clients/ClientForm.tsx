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
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/clients')}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            {isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {isEditing ? 'Gerencie as propriedades do ambiente gerido.' : 'Siga as quatro seções para provisionar o sistema DNS para a empresa.'}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">

                {/* Seção 1: Dados da Empresa */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                            <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">1. Informações da Empresa</h2>
                            <p className="text-sm text-slate-500">Dados cadastrais básicos de identificação e contato corporativo.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6 pl-12">
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium leading-6 text-slate-900">Nome da Empresa (obrigatório)</label>
                            <input
                                type="text" required value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                placeholder="Acme Corp"
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium leading-6 text-slate-900">Status Operacional</label>
                            <select
                                value={formData.status || 'active'}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as EntityStatus })}
                                className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                            >
                                <option value="active">Ativo (Politicas aplicadas)</option>
                                <option value="inactive">Inativo (Bypass geral)</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium leading-6 text-slate-900">Nome do Responsável</label>
                            <input
                                type="text" value={formData.contact_name || ''}
                                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium leading-6 text-slate-900">Email Profissional</label>
                            <input
                                type="email" value={formData.email || ''}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium leading-6 text-slate-900">Telefone / WhatsApp</label>
                            <input
                                type="text" value={formData.phone || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                            />
                        </div>
                        <div className="sm:col-span-6">
                            <label className="block text-sm font-medium leading-6 text-slate-900">Observações Internas</label>
                            <textarea
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={2}
                                className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                placeholder="Detalhes opcionais do contrato..."
                            />
                        </div>
                    </div>
                </div>

                {/* Seção 2: Identificação de Rede */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center border border-teal-100">
                            <Globe className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">2. Identificação de Rede <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-600">Essencial</span></h2>
                            <p className="text-sm text-slate-500">Parâmetros chave que atrelam este cliente ao motor de bloqueios DNS.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6 pl-12 bg-slate-50 p-6 rounded-lg border border-slate-100">
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium leading-6 text-slate-900">Tipo de Origem da Rede</label>
                            <select
                                value={networkType}
                                onChange={(e) => setNetworkType(e.target.value as OriginType)}
                                className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                            >
                                <option value="ip">IP Estático Público</option>
                                <option value="dyndns">Hostname / DynDNS</option>
                            </select>
                        </div>
                        <div className="sm:col-span-4">
                            <label className="block text-sm font-medium leading-6 text-slate-900">
                                {networkType === 'ip' ? 'IP Público do Cliente' : 'Endereço Hostname / DynDNS'}
                            </label>
                            <input
                                type="text" required value={networkValue}
                                onChange={(e) => setNetworkValue(e.target.value)}
                                className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 font-mono"
                                placeholder={networkType === 'ip' ? '180.12.30.90' : 'empresa.ddns.net'}
                            />
                        </div>
                        <div className="sm:col-span-6 border-t border-slate-200 pt-5">
                            <label className="block text-sm font-medium leading-6 text-slate-900 mb-1">Descrição do Link de Autenticação</label>
                            <input
                                type="text" value={networkDesc}
                                onChange={(e) => setNetworkDesc(e.target.value)}
                                className="mt-2 block w-full md:w-1/2 rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                placeholder="Ex: Matriz Corporate / Filial / Home Office"
                            />
                        </div>
                    </div>
                </div>

                {/* Seção 3: Políticas de Bloqueio Rápido */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                            <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">3. Políticas de Bloqueio Rápido</h2>
                            <p className="text-sm text-slate-500">Defina o comportamento inicial de tráfego. (Você poderá refinar em catálogo posteriormente).</p>
                        </div>
                    </div>

                    <div className="pl-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {policies.map((p, idx) => (
                            <div key={p.name} className={`p-4 rounded-xl border border-slate-200 transition-colors flex items-center justify-between gap-4 ${p.enabled ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white'}`}>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">{p.name}</h3>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2" title={p.description}>{p.description}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => togglePolicy(idx)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${p.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                                >
                                    <span className="sr-only">Habilitar {p.name}</span>
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${p.enabled ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Seção 4: Block Page */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-100">
                            <LayoutTemplate className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">4. Página de Bloqueio Personalizada</h2>
                            <p className="text-sm text-slate-500">A mensagem apresentada nos navegadores do cliente ao interceptarmos tráfego contido nas políticas.</p>
                        </div>
                    </div>

                    <div className="pl-12">
                        <label className="block text-sm font-medium leading-6 text-slate-900 mb-2">Mensagem de Bloqueio</label>
                        <textarea
                            value={blockMessage}
                            onChange={(e) => setBlockMessage(e.target.value)}
                            rows={3}
                            className="block w-full rounded-md border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                            placeholder="Este site foi bloqueado pela política de segurança da sua empresa..."
                        />
                        <p className="mt-3 text-xs text-slate-500">
                            Futuramente este campo será expansível para um portal HTML completo, adicionando logotipo da sua consultoria cibernética.
                        </p>
                    </div>
                </div>

                {/* Submit Row */}
                <div className="pt-6 pb-12 flex items-center justify-end gap-x-4">
                    <button
                        type="button"
                        onClick={() => navigate('/clients')}
                        className="text-sm font-semibold leading-6 text-slate-700 hover:text-slate-900 transition-colors"
                    >
                        Cancelar e Voltar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-lg bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Save className="h-4 w-4" />}
                        {isEditing ? 'Atualizar Identificação' : 'Criar Cliente e Integrar Regras DNS'}
                    </button>
                </div>
            </form>
        </div>
    );
}
