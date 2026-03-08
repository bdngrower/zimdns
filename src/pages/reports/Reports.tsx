import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, Search, Activity, DatabaseZap, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

interface DnsEvent {
    id: string;
    timestamp: string;
    client_id: string;
    domain: string;
    query_type: string;
    action: string;
    rule: string;
    source_ip: string;
    clients?: {
        name: string;
    };
}

export function Reports() {
    const [searchTerm, setSearchTerm] = useState('');
    const [events, setEvents] = useState<DnsEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchEvents() {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('dns_events')
                .select(`
                    *,
                    clients:client_id(name)
                `)
                .order('timestamp', { ascending: false })
                .limit(200);

            if (!error && data) {
                setEvents(data);
            }
            setIsLoading(false);
        }

        fetchEvents();
    }, []);

    const filteredEvents = events.filter(e =>
        e.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.source_ip?.includes(searchTerm) ||
        e.clients?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Auditoria de Eventos DNS</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Acompanhe em todo o ecossistema as consultas, permissões e bloqueios gerados pelas políticas ativas.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)]">
                {/* Filtros em Navbar Premium */}
                <div className="border-b border-slate-200 p-5 flex flex-wrap items-center gap-4 bg-white">
                    <div className="relative flex-1 min-w-[280px]">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full rounded-lg border-0 py-2.5 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-accent sm:text-sm sm:leading-6 transition-all"
                            placeholder="Buscar domínios, IPs ou perfis de cliente..."
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <select className="rounded-lg border-0 py-2.5 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 bg-white sm:text-sm hidden sm:block">
                            <option>Todos os Eventos</option>
                        </select>
                        <select className="rounded-lg border-0 py-2.5 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 bg-white sm:text-sm hidden md:block">
                            <option>Últimas 24 horas</option>
                        </select>
                    </div>
                </div>

                {/* Data Grid / Empty State Premium */}
                <div className="flex-1 overflow-auto flex flex-col bg-slate-50/30">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th scope="col" className="py-4 pl-4 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sm:pl-6">
                                    <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> Registo de Tempo</div>
                                </th>
                                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Perfil Origem</th>
                                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Destino (FQDN)</th>
                                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Veredito da Política</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="py-12">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-32 bg-slate-50/30">
                                        <div className="flex flex-col items-center justify-center max-w-lg mx-auto text-center px-4">
                                            <div className="h-16 w-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm mb-6 relative">
                                                <DatabaseZap className="h-8 w-8 text-slate-400" />
                                                <span className="absolute top-[-4px] right-[-4px] flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                                </span>
                                            </div>
                                            <h3 className="text-base font-semibold text-slate-900">Coleta de logs em andamento</h3>
                                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                                O pipeline global de auditoria consolida tráfego apenas quando as políticas resultarem em ações explícitas na borda. No momento, não há tráfego ou interceptação para a sua busca.
                                            </p>
                                            <div className="mt-8 flex items-center justify-center gap-2 rounded-lg bg-emerald-50/50 border border-emerald-200 px-4 py-2 text-xs font-medium text-emerald-700 cursor-default">
                                                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                                                Motor de Ingestão Saudável
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredEvents.map((log) => {
                                    const isBlocked = log.action === 'blocked';
                                    const formattedTime = formatInTimeZone(new Date(log.timestamp), 'America/Sao_Paulo', "dd MMM, HH:mm:ss", { locale: ptBR });

                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-slate-600 sm:pl-6">
                                                {formattedTime}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900">{log.clients?.name || 'Cliente Removido'}</span>
                                                    <span className="text-xs text-slate-400 text-mono">{log.source_ip}</span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600 font-mono">
                                                {log.domain}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    {isBlocked ? (
                                                        <>
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 border border-rose-200/60">
                                                                <ShieldAlert className="h-3.5 w-3.5" /> Bloqueado
                                                            </span>
                                                            <span className="text-xs text-slate-500 max-w-[200px] truncate" title={log.rule}>
                                                                {log.rule || 'Política restritiva'}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60">
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Permitido
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
