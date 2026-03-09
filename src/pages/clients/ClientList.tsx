import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Client } from '../../types';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Search, Plus, MoreVertical, Edit2, Trash2, Eye } from 'lucide-react';

interface ExtendedClient extends Client {
    client_networks: { id: string; type: string; value: string; resolved_ip?: string }[];
}

export function ClientList() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<ExtendedClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Modal de Exclusão
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<ExtendedClient | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadClients = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('clients')
            .select(`
                *,
                client_networks ( id, type, value, resolved_ip )
            `)
            .order('name');

        if (!error && data) {
            setClients(data as unknown as ExtendedClient[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadClients();
    }, []);

    // Fechar menu ao clicar fora
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const filteredClients = clients.filter(client => {
        const search = searchTerm.toLowerCase();
        return (
            client.name.toLowerCase().includes(search) ||
            (client.email && client.email.toLowerCase().includes(search)) ||
            (client.contact_name && client.contact_name.toLowerCase().includes(search)) ||
            (client.phone && client.phone.toLowerCase().includes(search))
        );
    });

    const getNetworkDisplay = (networks: ExtendedClient['client_networks']) => {
        if (!networks || networks.length === 0) return { label: 'Nenhuma origem cadastrada', subLabel: null, empty: true };

        const first = networks[0];
        let label = first.value;
        let subLabel = null;

        if (first.type === 'dyndns' && first.resolved_ip) {
            subLabel = first.resolved_ip;
        }

        if (networks.length > 1) {
            label = `${label} +${networks.length - 1}`;
        }

        return { label, subLabel, empty: false };
    };

    const handleDeleteClick = (client: ExtendedClient) => {
        setClientToDelete(client);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!clientToDelete) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('clients').delete().eq('id', clientToDelete.id);
            if (error) throw error;

            await loadClients();
            setDeleteModalOpen(false);
            setClientToDelete(null);
        } catch (err) {
            console.error('Erro ao excluir cliente', err);
            alert('Não foi possível excluir o cliente. Verifique o console.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto animate-in transition-all">
            <div className="sm:flex sm:items-center sm:justify-between mb-8">
                <div>
                    <h1 className="page-title">Clientes</h1>
                    <p className="page-subtitle">
                        Gestão da sua base de locatários e instâncias de segurança.
                    </p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <Link
                        to="/clients/new"
                        className="group flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all hover:shadow-md hover:-translate-y-0.5"
                    >
                        <Plus className="h-4 w-4" />
                        Cadastrar Cliente
                    </Link>
                </div>
            </div>

            <div className="card-premium overflow-visible">
                <div className="border-b border-slate-100 p-4 bg-white rounded-t-2xl">
                    <div className="relative flex-1 max-w-md">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                            placeholder="Buscar empresas, e-mails ou responsáveis..."
                        />
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-visible min-h-[400px]">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest w-[35%]">Empresa / Detalhes</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Contato & Status</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Origem de Rede Ativa</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-6">
                                    <span className="sr-only">Ações</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full mb-3" />
                                            <p className="text-sm font-medium text-slate-500">Sincronizando clientes...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : clients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-24 text-center">
                                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                            <div className="h-16 w-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center shadow-sm mb-5">
                                                <Building2 className="h-8 w-8 text-blue-600" />
                                            </div>
                                            <h3 className="text-base font-semibold text-slate-900">Base vazia</h3>
                                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                                Cadastre o seu primeiro cliente corporativo e mapeie as origens de rede para habilitar os serviços.
                                            </p>
                                            <Link
                                                to="/clients/new"
                                                className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Cadastrar Primeiro Cliente
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-sm text-slate-500">
                                        Nenhum cliente foi encontrado para esta pesquisa.
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => {
                                    const netDisplay = getNetworkDisplay(client.client_networks);

                                    return (
                                        <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 group-hover:from-blue-50 group-hover:to-blue-100 flex items-center justify-center border border-slate-200/60 shadow-sm transition-all">
                                                        <Building2 className="h-4 w-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{client.name}</div>
                                                        <div className="text-slate-500 text-xs mt-0.5">{client.email || 'Sem email'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                                                <div className="flex items-center justify-between pr-4">
                                                    <div>
                                                        <div className="font-medium text-slate-700">{client.contact_name || 'Sem contato'}</div>
                                                        <div className="text-slate-400 text-xs mt-0.5">{client.phone || 'Sem telefone'}</div>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] uppercase tracking-wider font-semibold border ${client.status === 'active'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : client.status === 'inactive' ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${client.status === 'active' ? 'bg-emerald-500' : client.status === 'inactive' ? 'bg-slate-400' : 'bg-red-500'}`}></span>
                                                        {client.status === 'active' ? 'Operacional' : client.status === 'inactive' ? 'Inativo' : 'Suspenso'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                                                {netDisplay.empty ? (
                                                    <span className="text-slate-400 text-xs italic">Nenhuma origem</span>
                                                ) : (
                                                    <div>
                                                        <div className="font-mono text-xs font-medium text-slate-700 bg-slate-100/80 inline-block px-2 py-1 rounded-md border border-slate-200/60 shadow-sm">
                                                            {netDisplay.label}
                                                        </div>
                                                        {netDisplay.subLabel && (
                                                            <div className="text-[10px] text-slate-400 mt-1.5 font-mono flex items-center gap-1.5">
                                                                <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full" />
                                                                {netDisplay.subLabel} (Resolvido)
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                                                <div className="relative inline-block text-left">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === client.id ? null : client.id); }}
                                                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors outline-none"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </button>

                                                    {openMenuId === client.id && (
                                                        <div
                                                            className="absolute right-0 z-[50] mt-1 w-48 origin-top-right rounded-xl bg-white shadow-lg border border-slate-100 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="p-1" role="none">
                                                                <button
                                                                    onClick={() => navigate(`/clients/${client.id}`)}
                                                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                                                >
                                                                    <Eye className="h-4 w-4 text-slate-400" />
                                                                    Dashboard
                                                                </button>
                                                                <button
                                                                    onClick={() => navigate(`/clients/${client.id}/edit`)}
                                                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                                                >
                                                                    <Edit2 className="h-4 w-4 text-slate-400" />
                                                                    Editar
                                                                </button>
                                                                <div className="h-px bg-slate-100 my-1 mx-1"></div>
                                                                <button
                                                                    onClick={() => { setOpenMenuId(null); handleDeleteClick(client); }}
                                                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                                    Excluir
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Exclusão */}
            {deleteModalOpen && clientToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100 mb-4">
                            <Trash2 className="h-5 w-5 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-center text-slate-900 mb-2 tracking-tight">Excluir Cliente</h3>
                        <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
                            Deseja remover <strong>{clientToDelete.name}</strong>? Esta ação apagará configurações e regras exclusivas do banco.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 hover:text-slate-900 transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-red-700 shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <div className="h-4 w-4 border-2 border-white/50 border-t-white animate-spin rounded-full" />
                                ) : (
                                    'Excluir'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
