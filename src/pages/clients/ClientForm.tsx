import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Building2, Save, ArrowLeft, Loader2, Globe, User } from 'lucide-react';
import type { Tenant, EntityStatus } from '../../types';

interface ClientFormState extends Partial<Tenant> {
    block_page_message?: string;
}

export function ClientForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    const [isLoading, setIsLoading] = useState(isEditing);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<ClientFormState>({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        status: 'active' as EntityStatus,
        primary_dns_ip: '',
        block_page_message: 'Ops! O acesso a este site foi boqueado.',
    });

    useEffect(() => {
        if (isEditing) {
            loadClient();
        }
    }, [id]);

    async function loadClient() {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (data) setFormData(data);
        } catch (error) {
            console.error('Erro ao carregar cliente:', error);
            // Mostrar toast de erro num app real
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);

        try {
            if (isEditing) {
                const { error } = await supabase
                    .from('tenants')
                    .update(formData)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error, data } = await supabase
                    .from('tenants')
                    .insert([formData])
                    .select()
                    .single();

                if (error) throw error;
                if (data) {
                    navigate(`/clients/${data.id}`);
                    return;
                }
            }
            navigate('/clients');
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
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
                            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {isEditing ? 'Gerencie as informações do tenant.' : 'Cadastre um novo ambiente isolado para gestão de políticas.'}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* Seção 1: Dados da Empresa */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50/50 p-5 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">Informações da Empresa</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-4">
                            <label htmlFor="name" className="block text-sm font-medium leading-6 text-slate-900">Razão Social / Nome</label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    name="name"
                                    id="name"
                                    required
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                    placeholder="Ex: Acme Corp Ltda"
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label htmlFor="status" className="block text-sm font-medium leading-6 text-slate-900">Status Operacional</label>
                            <div className="mt-2">
                                <select
                                    id="status"
                                    name="status"
                                    className="block w-full rounded-md border-0 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:max-w-xs sm:text-sm sm:leading-6"
                                    value={formData.status || 'active'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as EntityStatus })}
                                >
                                    <option value="active">Ativo (Políticas aplicadas)</option>
                                    <option value="inactive">Inativo (Sem filtro)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seção 2: Contato & Responsável */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50/50 p-5 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-orange-600" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">Contato Operacional</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-2">
                            <label htmlFor="contact_name" className="block text-sm font-medium leading-6 text-slate-900">Nome do Responsável</label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    name="contact_name"
                                    id="contact_name"
                                    value={formData.contact_name || ''}
                                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                    className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label htmlFor="email" className="block text-sm font-medium leading-6 text-slate-900">E-mail Profissional</label>
                            <div className="mt-2">
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    value={formData.email || ''}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label htmlFor="phone" className="block text-sm font-medium leading-6 text-slate-900">Telefone / WhatsApp</label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    name="phone"
                                    id="phone"
                                    value={formData.phone || ''}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seção 3: Rede & Redirecionamento (Basics) */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50/50 p-5 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-teal-600" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">Redirecionamento Padrão</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-6">
                            <p className="text-sm text-slate-500 mb-4">
                                Preencha a mensagem inicial que deverá aparecer quando um acesso for interceptado por este tenant. Origens de rede (IP Fixo/DynDNS) são cadastradas após o painel ser criado.
                            </p>
                        </div>
                        <div className="col-span-full">
                            <label htmlFor="block_page" className="block text-sm font-medium leading-6 text-slate-900">Mensagem na Block Page</label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    name="block_page"
                                    id="block_page"
                                    value={formData.block_page_message || ''}
                                    onChange={(e) => setFormData({ ...formData, block_page_message: e.target.value })}
                                    className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                    placeholder="Ex: Acesso restrito pela Política de Segurança."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-5 flex items-center justify-end gap-x-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={() => navigate('/clients')}
                        className="text-sm font-semibold leading-6 text-slate-700 hover:text-slate-900 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isEditing ? 'Atualizar Perfil' : 'Criar Cliente e Aplicar'}
                    </button>
                </div>
            </form>
        </div>
    );
}
