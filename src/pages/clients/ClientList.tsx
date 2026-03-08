import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Client } from '../../types';
import { Link } from 'react-router-dom';
import { Building2, Search, Plus, MoreVertical } from 'lucide-react';

export function ClientList() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadClients() {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('name');

            if (!error && data) {
                setClients(data);
            }
            setIsLoading(false);
        }
        loadClients();
    }, []);

    return (
        <div className="p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clientes</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Gerencie os ambientes e configurações de DNS dos seus clientes.
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

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 p-4 flex gap-4 bg-slate-50/50">
                    <div className="relative flex-1 max-w-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-md border-0 py-2 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all"
                            placeholder="Buscar empresas, e-mails ou contatos..."
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sm:pl-6">Empresa / Detalhes</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contato & Telefone</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Operacional</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">IPs de DNS Associados</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Ações</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full mb-3" />
                                            <p className="text-sm font-medium text-slate-500">Buscando repositório de clientes...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : clients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center">
                                        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                                            <div className="h-16 w-16 bg-blue-50/50 border border-blue-100 rounded-3xl flex items-center justify-center shadow-sm mb-5">
                                                <Building2 className="h-8 w-8 text-blue-600" />
                                            </div>
                                            <h3 className="text-base font-semibold text-slate-900">Nenhum cliente cadastrado</h3>
                                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                                Seu painel ZIM DNS está pronto, porém você ainda não possui um client ativo. Cadastre seu primeiro cliente para iniciar a gestão de políticas.
                                            </p>
                                            <button
                                                type="button"
                                                className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Cadastrar o primeiro cliente
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                clients.map((client) => (
                                    <tr key={client.id} className="hover:bg-slate-50/80 cursor-pointer transition-colors group">
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 group-hover:bg-white flex items-center justify-center border border-slate-200 shadow-sm transition-colors">
                                                    <Building2 className="h-5 w-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{client.name}</div>
                                                    <div className="text-slate-500 text-xs mt-0.5">{client.email || '—'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                            <div className="font-medium text-slate-900">{client.contact_name || '—'}</div>
                                            <div className="text-slate-500 text-xs mt-0.5">{client.phone || '—'}</div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${client.status === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${client.status === 'active' ? 'bg-green-600' : 'bg-slate-400'}`}></span>
                                                {client.status === 'active' ? 'Operacional' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                            <div className="font-mono text-xs text-slate-600 bg-slate-100/50 inline-block px-2 py-1 rounded border border-slate-200/50">
                                                {client.primary_dns_ip || 'Origem Pendente'}
                                            </div>
                                        </td>
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <button className="text-slate-400 hover:text-slate-900 transition-colors">
                                                <MoreVertical className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
