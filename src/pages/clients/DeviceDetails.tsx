import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Device, DeviceInventorySnapshot, DeviceHeartbeat, DeviceTelemetryEvent } from '../../types';
import { 
    ArrowLeft, 
    Cpu, 
    HardDrive, 
    MemoryStick as Ram, 
    Activity, 
    History, 
    Info, 
    Calendar,
    LayoutDashboard,
    Terminal,
    Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function DeviceDetails() {
    const { clientId, deviceId } = useParams();
    const [device, setDevice] = useState<Device | null>(null);
    const [snapshot, setSnapshot] = useState<DeviceInventorySnapshot | null>(null);
    const [heartbeats, setHeartbeats] = useState<DeviceHeartbeat[]>([]);
    const [telemetry, setTelemetry] = useState<DeviceTelemetryEvent[]>([]);
    const [activeTab, setActiveTab] = useState<'inventory' | 'telemetry' | 'heartbeats'>('inventory');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [deviceId]);

    async function loadData() {
        setIsLoading(true);
        
        // 1. Load Device info
        const { data: deviceData } = await supabase
            .from('devices')
            .select('*')
            .eq('id', deviceId)
            .single();
        
        if (deviceData) setDevice(deviceData);

        // 2. Load latest inventory snapshot
        const { data: snapData } = await supabase
            .from('device_inventory_snapshots')
            .select('*')
            .eq('device_id', deviceId)
            .order('snapshot_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (snapData) setSnapshot(snapData);

        // 3. Load recent heartbeats
        const { data: hbData } = await supabase
            .from('device_heartbeats')
            .select('*')
            .eq('device_id', deviceId)
            .order('received_at', { ascending: false })
            .limit(20);
        
        if (hbData) setHeartbeats(hbData);

        // 4. Load recent telemetry
        const { data: telData } = await supabase
            .from('device_telemetry_events')
            .select('*')
            .eq('device_id', deviceId)
            .order('occurred_at', { ascending: false })
            .limit(50);
        
        if (telData) setTelemetry(telData);

        setIsLoading(false);
    }

    if (isLoading) return <div className="p-8 text-center text-slate-500">Carregando detalhes do dispositivo...</div>;
    if (!device) return <div className="p-8 text-center text-red-500">Dispositivo não encontrado.</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <Link to={`/clients/${clientId}`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 mb-6 group">
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Voltar para Cliente
            </Link>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white border rounded-lg shadow-sm">
                            <Shield className="h-6 w-6 text-accent" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{device.hostname}</h1>
                            <p className="text-sm text-slate-500">{device.os_name} {device.os_version} · hardware_id: {device.hardware_id || '—'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-widest border ${device.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {device.status}
                        </span>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Visto por último</p>
                            <p className="text-sm font-medium text-slate-700">
                                {device.last_seen_at ? formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true, locale: ptBR }) : 'Nunca'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-b px-6 overflow-x-auto scrollbar-hide">
                    <nav className="-mb-px flex space-x-8">
                        <button onClick={() => setActiveTab('inventory')} className={`py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === 'inventory' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <LayoutDashboard className="h-4 w-4" /> Inventário
                        </button>
                        <button onClick={() => setActiveTab('telemetry')} className={`py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === 'telemetry' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <History className="h-4 w-4" /> Telemetria
                        </button>
                        <button onClick={() => setActiveTab('heartbeats')} className={`py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeTab === 'heartbeats' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <Activity className="h-4 w-4" /> Sinal de Vida
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'inventory' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <Cpu className="h-5 w-5 text-slate-400" />
                                    <h3 className="font-bold text-slate-900">Processamento</h3>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CPU</p>
                                        <p className="text-sm text-slate-700 truncate">{snapshot?.cpu || 'Não reportado'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arquitetura</p>
                                        <p className="text-sm text-slate-700">{snapshot?.architecture || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <Ram className="h-5 w-5 text-slate-400" />
                                    <h3 className="font-bold text-slate-900">Memória & Swap</h3>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">RAM Total</p>
                                        <p className="text-sm text-slate-700">{snapshot?.ram_total_gb ? `${snapshot.ram_total_gb} GB` : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fabricante</p>
                                        <p className="text-sm text-slate-700">{snapshot?.manufacturer || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <HardDrive className="h-5 w-5 text-slate-400" />
                                    <h3 className="font-bold text-slate-900">Armazenamento</h3>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Capacidade Total</p>
                                        <p className="text-sm text-slate-700">{snapshot?.disk_total_gb ? `${snapshot.disk_total_gb} GB` : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Espaço Livre</p>
                                        <p className="text-sm text-slate-700">{snapshot?.disk_free_gb ? `${snapshot.disk_free_gb} GB` : '—'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'telemetry' && (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                                <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="px-5 py-3">Evento</th>
                                        <th className="px-5 py-3">Gravidade</th>
                                        <th className="px-5 py-3">Mensagem</th>
                                        <th className="px-5 py-3">Data/Hora</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {telemetry.length === 0 ? (
                                        <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400 italic">Nenhum evento registrado</td></tr>
                                    ) : telemetry.map(tel => (
                                        <tr key={tel.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <Terminal className="h-3.5 w-3.5 text-slate-400" />
                                                    {tel.event_type}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    tel.severity === 'error' ? 'bg-red-50 text-red-600' :
                                                    tel.severity === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                    {tel.severity}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-slate-600 max-w-md truncate">{tel.message}</td>
                                            <td className="px-5 py-3 text-slate-400">{new Date(tel.occurred_at).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'heartbeats' && (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                                <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="px-5 py-3">Latência DoH</th>
                                        <th className="px-5 py-3">Stub DNS</th>
                                        <th className="px-5 py-3">Rede / SSID</th>
                                        <th className="px-5 py-3">IP Público</th>
                                        <th className="px-5 py-3">Recebido em</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {heartbeats.length === 0 ? (
                                        <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 italic">Nenhum heartbeat recebido</td></tr>
                                    ) : heartbeats.map(hb => (
                                        <tr key={hb.received_at} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                                    <span className={`h-2 w-2 rounded-full ${hb.doh_ok ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    {hb.doh_latency_ms} ms
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${hb.dns_stub_ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {hb.dns_stub_ok ? 'OK' : 'FAIL'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-xs font-mono">{hb.network_ssid || hb.network_type}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 font-mono text-xs text-slate-500">{hb.public_ip || '—'}</td>
                                            <td className="px-5 py-3 text-slate-400">{new Date(hb.received_at).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-4">
                <Info className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-800 leading-relaxed">
                    <strong>Aviso de v1.1:</strong> Os logs de DNS detalhados para dispositivos individuais ainda estão em implementação. 
                    Nesta versão v1.0, utilize a aba "Consultas DNS" do cliente para visualizar o tráfego filtrado pelo ClientID.
                </p>
            </div>
        </div>
    );
}
