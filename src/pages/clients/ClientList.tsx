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
        <div className="p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clientes</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Sua base de locatários e gestão de instâncias de segurança de rede.
                    </p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <Link
                        to="/clients/new"
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Cadastrar Cliente
                    </Link>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-visible">
                <div className="border-b border-slate-200 p-4 flex gap-4 bg-slate-50/50">
                    <div className="relative flex-1 max-w-md">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full rounded-md border-0 py-2 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Buscar empresas, e-mails ou responsáveis..."
                        />
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-visible min-h-[400px]">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sm:pl-6 w-[35%]">Empresa / Detalhes</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contato & Status</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Origem de Rede Ativa</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Ações</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full mb-3" />
                                            <p className="text-sm font-medium text-slate-500">Sincronizando clientes com o banco...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : clients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center">
                                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                            <div className="h-16 w-16 bg-blue-50/50 border border-blue-100 rounded-3xl flex items-center justify-center shadow-sm mb-5">
                                                <Building2 className="h-8 w-8 text-blue-600" />
                                            </div>
                                            <h3 className="text-base font-semibold text-slate-900">Nenhum cliente cadastrado ainda</h3>
                                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                                A base de dados ZIM DNS está vazia. Cadastre o seu primeiro cliente corporativo e mapeie as origens de rede para iniciar os serviços de filtragem em minutos.
                                            </p>
                                            <Link
                                                to="/clients/new"
                                                className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Cadastrar Primeiro Cliente
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-sm text-slate-500">
                                        Nenhum cliente foi encontrado para esta pesquisa.
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => {
                                    const netDisplay = getNetworkDisplay(client.client_networks);

                                    return (
                                        <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6 w-[35%] cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                                                <div className="flex items-center gap-4">
                                                    <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-50 group-hover:bg-white flex items-center justify-center border border-slate-200 shadow-sm transition-colors">
                                                        <Building2 className="h-5 w-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{client.name}</div>
                                                        <div className="text-slate-500 text-xs mt-0.5">{client.email || 'Sem email'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                                                <div className="flex items-center justify-between pr-4">
                                                    <div>
                                                        <div className="font-medium text-slate-900">{client.contact_name || 'Sem contato'}</div>
                                                        <div className="text-slate-500 text-xs mt-0.5">{client.phone || 'Sem telefone'}</div>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${client.status === 'active'
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : client.status === 'inactive' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${client.status === 'active' ? 'bg-green-600' : client.status === 'inactive' ? 'bg-slate-400' : 'bg-red-600'}`}></span>
                                                        {client.status === 'active' ? 'Operacional' : client.status === 'inactive' ? 'Inativo' : 'Suspenso'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                                                {netDisplay.empty ? (
                                                    <span className="text-slate-400 text-xs italic">Nenhuma origem cadastrada</span>
                                                ) : (
                                                    <div>
                                                        <div className="font-mono text-xs text-slate-700 bg-slate-100 inline-block px-2 py-1 rounded border border-slate-200">
                                                            {netDisplay.label}
                                                        </div>
                                                        {netDisplay.subLabel && (
                                                            <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center gap-1">
                                                                <div className="h-1 w-1 bg-green-500 rounded-full" />
                                                                {netDisplay.subLabel} (Resolvido)
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                <div className="relative inline-block text-left">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === client.id ? null : client.id); }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <MoreVertical className="h-5 w-5" />
                                                    </button>

                                                    {openMenuId === client.id && (
                                                        <div
                                                            className="absolute right-0 z-[50] mt-1 w-48 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="py-1 p-1" role="none">
                                                                <button
                                                                    onClick={() => navigate(`/clients/${client.id}`)}
                                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <Eye className="h-4 w-4 text-slate-400" />
                                                                    Ver Dashboard
                                                                </button>
                                                                <button
                                                                    onClick={() => navigate(`/clients/${client.id}/edit`)}
                                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    <Edit2 className="h-4 w-4 text-slate-400" />
                                                                    Editar Cliente
                                                                </button>
                                                                <div className="h-px bg-slate-100 my-1 mx-1"></div>
                                                                <button
                                                                    onClick={() => { setOpenMenuId(null); handleDeleteClick(client); }}
                                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 outline-none transition-colors"
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                                    Excluir Cliente
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-100 transform transition-all">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                            <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-center text-slate-900 mb-2">Excluir Base de Cliente</h3>
                        <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
                            Você tem certeza que deseja excluir os registros de <strong>{clientToDelete.name}</strong>? Esta ação removerá a conta, origens de redes, e as regras exclusivas do seu Supabase.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-semibold text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isDeleting && <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full" />}
                                Sim, excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
