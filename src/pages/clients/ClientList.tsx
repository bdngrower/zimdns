import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Tenant } from '../../types';
import { Building2, Search, Plus, MoreVertical } from 'lucide-react';

export function ClientList() {
    const [clients, setClients] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadClients() {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('tenants')
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
                    <button
                        type="button"
                        className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Cliente
                    </button>
                </div>
            </div>

            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="border-b border-border p-4 flex gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-md border-0 py-1.5 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6"
                            placeholder="Buscar clientes..."
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Empresa</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Contato</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Status</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">IPs DNS</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Ações</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                                        Carregando clientes...
                                    </td>
                                </tr>
                            ) : clients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                                        Nenhum cliente cadastrado.
                                    </td>
                                </tr>
                            ) : (
                                clients.map((client) => (
                                    <tr key={client.id} className="hover:bg-slate-50 cursor-pointer transition-colors">
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                                                    <Building2 className="h-5 w-5 text-slate-500" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="font-medium text-slate-900">{client.name}</div>
                                                    <div className="text-slate-500">{client.email || '-'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                            <div className="text-slate-900">{client.contact_name || '-'}</div>
                                            <div className="text-slate-500">{client.phone || '-'}</div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${client.status === 'active'
                                                ? 'bg-green-50 text-green-700 ring-green-600/20'
                                                : 'bg-red-50 text-red-700 ring-red-600/10'
                                                }`}>
                                                {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                            <div className="font-mono text-xs">{client.primary_dns_ip || 'Não configurado'}</div>
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
