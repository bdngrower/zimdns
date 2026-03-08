import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Search, Loader2 } from 'lucide-react';

interface DnsLogsProps {
    clientId: string;
}

export function DnsLogs({ clientId }: DnsLogsProps) {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchQuery] = useState('');

    useEffect(() => {
        async function fetchLogs() {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/adguard/logs?clientId=${clientId}`);
                const data = await res.json();
                if (data.success) {
                    console.log("🟢 ZIM DNS Frontend - Logs _debug payload:", data._debug || "No debug payload received.");
                    setLogs(data.logs || []);
                } else {
                    setError(data.message || 'Erro ao carregar logs');
                }
            } catch (err: any) {
                setError(err.message || 'Erro de comunicação');
            } finally {
                setIsLoading(false);
            }
        }
        fetchLogs();
    }, [clientId]);

    const filteredLogs = logs.filter(log =>
        !searchTerm ||
        (log.question && log.question.host.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Consultas DNS em Tempo Real</h3>
                    <p className="text-sm text-slate-500">
                        Últimas requisições mapeadas que vieram da origem de rede atrelada a este cliente.
                    </p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filtrar por domínio..."
                        value={searchTerm}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="py-12 flex justify-center items-center text-slate-500 gap-2">
                    <Loader2 className="animate-spin h-5 w-5" />
                    Coletando logs do ADGuard Serverless...
                </div>
            ) : error ? (
                <div className="p-4 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm">
                    {error}
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <Search className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-900">Nenhum tráfego detectado</p>
                    <p className="text-sm text-slate-500 mt-1">Ainda não recebemos requisições DNS das origens cadastradas deste cliente.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 font-medium text-slate-500 text-left">Horário</th>
                                <th className="px-4 py-3 font-medium text-slate-500 text-left">Tempo</th>
                                <th className="px-4 py-3 font-medium text-slate-500 text-left">Tipo</th>
                                <th className="px-4 py-3 font-medium text-slate-500 text-left">Domínio Consultado</th>
                                <th className="px-4 py-3 font-medium text-slate-500 text-left">Status (Ação)</th>
                                <th className="px-4 py-3 font-medium text-slate-500 text-left">Motivo / Regra Base</th>
                                <th className="px-4 py-3 font-medium text-slate-500 text-left">IP de Origem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.map((log: any, idx) => {
                                const isBlocked = log.reason === 'FilteredBlackList';
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                            {new Date(log.time).toLocaleTimeString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                                            {log.elapsedMs ? `${log.elapsedMs}ms` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                            {log.question?.type || '-'}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            {log.question?.host}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isBlocked ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
                                                    <ShieldAlert className="w-3.5 h-3.5" /> Bloqueado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                                                    <ShieldCheck className="w-3.5 h-3.5" /> Processado
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={log.rule}>
                                            {isBlocked ? log.rule : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {log.client}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
