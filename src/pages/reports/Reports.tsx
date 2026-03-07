import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Clock, Search } from 'lucide-react';

interface MockLog {
    id: string;
    timestamp: string;
    domain: string;
    client: string;
    action: 'allowed' | 'blocked';
    reason?: string;
}

const mockLogs: MockLog[] = [
    { id: '1', timestamp: '2026-03-07 14:32:11', domain: 'google-analytics.com', client: 'Empresa Alpha Ltda', action: 'blocked', reason: 'Categoria: Rastreadores' },
    { id: '2', timestamp: '2026-03-07 14:32:05', domain: 'api.github.com', client: 'Empresa Alpha Ltda', action: 'allowed' },
    { id: '3', timestamp: '2026-03-07 14:31:59', domain: 'onlyfans.com', client: 'Escola Beta', action: 'blocked', reason: 'Categoria: Conteúdo Adulto' },
    { id: '4', timestamp: '2026-03-07 14:31:50', domain: 'tiktok.com', client: 'Escola Beta', action: 'blocked', reason: 'Serviço: TikTok' },
    { id: '5', timestamp: '2026-03-07 14:30:22', domain: 'mail.google.com', client: 'Empresa Alpha Ltda', action: 'allowed' },
];

export function Reports() {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relatórios de Acesso</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Visualize logs em tempo real das requisições DNS (Aguardando integração live com o DNS Engine).
                </p>
            </div>

            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)]">
                <div className="border-b border-border p-4 flex gap-4 bg-slate-50">
                    <div className="relative flex-1 max-w-md">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6"
                            placeholder="Buscar domínios, clientes ou motivos..."
                        />
                    </div>
                    <select className="rounded-md border-0 py-1.5 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-accent sm:text-sm">
                        <option>Todos os Eventos</option>
                        <option>Apenas Bloqueios</option>
                        <option>Apenas Permitidos</option>
                    </select>
                    <select className="rounded-md border-0 py-1.5 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-accent sm:text-sm">
                        <option>Últimos 15 min</option>
                        <option>Última hora</option>
                        <option>Hoje</option>
                    </select>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> Data/Hora</div></th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Cliente</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Domínio</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Ação</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Detalhe / Regra</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-white">
                            {mockLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm text-slate-500 sm:pl-6">
                                        {log.timestamp}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-900 font-medium">
                                        {log.client}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-500 font-mono">
                                        {log.domain}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 text-sm">
                                        {log.action === 'blocked' ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                                <ShieldAlert className="h-3.5 w-3.5" /> Bloqueado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                                <ShieldCheck className="h-3.5 w-3.5" /> Permitido
                                            </span>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-500">
                                        {log.reason || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
