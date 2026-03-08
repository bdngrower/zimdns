import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, AlertOctagon, Info } from 'lucide-react';

export function Blocked() {
    const [searchParams] = useSearchParams();
    const domain = searchParams.get('domain') || 'Desconhecido';
    const policy = searchParams.get('policy') || 'Acesso Restrito';

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                <div className="bg-red-600 p-8 text-center relative overflow-hidden">
                    {/* Elementos decorativos */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 flex items-center justify-center">
                        <ShieldAlert className="w-64 h-64" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="bg-white/20 p-4 rounded-full mb-4 ring-8 ring-white/10">
                            <ShieldAlert className="w-12 h-12 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Acesso Bloqueado</h1>
                    </div>
                </div>

                <div className="p-8">
                    <p className="text-slate-600 text-center mb-6 leading-relaxed">
                        Este site foi bloqueado porque viola as diretrizes de uso seguro da sua rede ou empresa.
                    </p>

                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Destino Bloqueado</p>
                            <p className="text-slate-900 font-medium break-all flex items-center gap-2">
                                <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
                                {domain}
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Motivo do Bloqueio</p>
                            <p className="text-slate-700 text-sm flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                                {policy}
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Timestamp</p>
                            <p className="text-slate-500 text-sm">
                                {new Date().toLocaleString('pt-BR')}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-slate-400">
                            Filtro Cloud operado por <span className="font-semibold text-slate-500">ZIM DNS</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
