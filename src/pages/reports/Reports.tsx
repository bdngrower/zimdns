import { useState } from 'react';
import { Clock, Search, Activity, DatabaseZap } from 'lucide-react';

export function Reports() {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Histórico de Eventos DNS</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Acompanhe em tempo real as consultas, permissões e bloqueios aplicados pelas políticas de seus clientes.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)]">
                {/* Filters */}
                <div className="border-b border-slate-200 p-4 flex flex-wrap gap-4 bg-slate-50/50">
                    <div className="relative flex-1 min-w-[280px]">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            disabled
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full rounded-md border-0 py-2 pl-10 text-slate-500 ring-1 ring-inset ring-slate-200 bg-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 cursor-not-allowed"
                            placeholder="Domínios, clientes..."
                        />
                    </div>
                    <select disabled className="rounded-md border-0 py-2 pl-3 pr-10 text-slate-500 ring-1 ring-inset ring-slate-200 bg-slate-100 sm:text-sm cursor-not-allowed hidden sm:block">
                        <option>Todos os Eventos</option>
                    </select>
                    <select disabled className="rounded-md border-0 py-2 pl-3 pr-10 text-slate-500 ring-1 ring-inset ring-slate-200 bg-slate-100 sm:text-sm cursor-not-allowed hidden md:block">
                        <option>Hoje</option>
                    </select>
                </div>

                {/* Data Grid / Empty State */}
                <div className="flex-1 overflow-auto flex flex-col">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sm:pl-6">
                                    <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> Data/Hora</div>
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente/Client</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Domínio Explorado</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ação / Desfecho</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-slate-50/30">
                            <tr>
                                <td colSpan={4} className="py-24">
                                    <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center px-4">
                                        <div className="h-20 w-20 bg-blue-50 border border-blue-100 rounded-3xl flex items-center justify-center shadow-sm mb-6 relative">
                                            <DatabaseZap className="h-10 w-10 text-blue-500" />
                                            <span className="absolute top-0 right-0 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-900">Aguardando telemetria DNS</h3>
                                        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                                            Para preservar a performance e focar os recursos no provisionamento, o painel central atualmente armazena logs apenas durante eventos reais validados. Nenhum tráfego ativo gerou ocorrência nos últimos instantes.
                                        </p>
                                        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm cursor-default">
                                            <Activity className="h-4 w-4 text-blue-500" />
                                            Listeners Ativos
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
