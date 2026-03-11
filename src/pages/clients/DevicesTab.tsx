import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Device, UserRole } from '../../types';
import { 
    Laptop, 
    Smartphone, 
    Monitor, 
    XOctagon, 
    RefreshCw, 
    Download, 
    Shield, 
    HardDrive, 
    Activity,
    Wifi,
    Globe,
    ShieldAlert,
    Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DevicesTabProps {
    clientId: string;
}

export function DevicesTab({ clientId }: DevicesTabProps) {
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRevoking, setIsRevoking] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<UserRole>('cliente');

    useEffect(() => {
        loadUserRole();
        loadDevices();
        
        // Polling para status online em tempo real
        const interval = setInterval(loadDevices, 30000);
        return () => clearInterval(interval);
    }, [clientId]);

    async function loadUserRole() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            if (profile) setUserRole(profile.role);
        }
    }

    async function loadDevices() {
        const { data, error } = await supabase
            .from('devices')
            .select(`
                *,
                device_heartbeats (
                    network_type,
                    network_ssid,
                    public_ip,
                    received_at
                )
            `)
            .eq('client_id', clientId)
            .neq('status', 'revoked')
            .order('last_seen_at', { ascending: false })
            .order('received_at', { foreignTable: 'device_heartbeats', ascending: false })
            .limit(1, { foreignTable: 'device_heartbeats' });

        if (error) {
            console.error('[DevicesTab] loadDevices error:', error);
        } else if (data) {
            setDevices(data as Device[]);
        }
        setIsLoading(false);
    }

    async function handleRevoke(deviceId: string) {
        if (!confirm('Deseja realmente revogar este dispositivo? O agente deixará de funcionar imediatamente.')) return;
        
        setIsRevoking(deviceId);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        try {
            const res = await fetch('/api/agent/revoke', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ device_id: deviceId })
            });
            
            if (res.ok) {
                loadDevices();
            } else {
                const err = await res.json();
                alert(`Erro ao revogar: ${err.error}`);
            }
        } catch (err) {
            alert('Erro de conexão ao revogar device.');
        } finally {
            setIsRevoking(null);
        }
    }

    const isOnline = (lastSeenAt: string | undefined) => {
        if (!lastSeenAt) return false;
        // Garante a conversão para UTC caso o Supabase retorne sem Z
        const dateStr = lastSeenAt.endsWith('Z') 
            ? lastSeenAt 
            : `${lastSeenAt.replace(' ', 'T')}${lastSeenAt.includes('T') ? '' : 'Z'}`;
        // Para ser ainda mais seguro caso venha '2024-10-10T10:00:00' sem Z:
        const finalStr = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('-') 
            ? dateStr 
            : `${dateStr}Z`;
            
        const lastSeen = new Date(finalStr);
        const diff = (new Date().getTime() - lastSeen.getTime()) / 1000;
        return diff < 120; // 2 minutos
    };

    const getDeviceIcon = (os: string | undefined) => {
        const name = os?.toLowerCase() || '';
        if (name.includes('windows')) return <Monitor className="h-5 w-5" />;
        if (name.includes('android') || name.includes('ios')) return <Smartphone className="h-5 w-5" />;
        return <Laptop className="h-5 w-5" />;
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-medium text-slate-900">Agentes e Dispositivos</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Gerencie dispositivos com o ZIM DNS Agent v1 instalado. Proteção ativa fora da rede corporativa.
                    </p>
                </div>
                <button 
                   className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"
                   onClick={() => window.dispatchEvent(new CustomEvent('open-enrollment-modal'))}
                >
                    <Download className="h-4 w-4" />
                    Novo Instalador
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-4" />
                    <p className="text-sm text-slate-500">Carregando dispositivos...</p>
                </div>
            ) : devices.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                    <Laptop className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-sm font-semibold text-slate-900">Nenhum dispositivo encontrado</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                        Gere um link de instalação para começar a proteger notebooks e desktops deste cliente.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {devices.map((device) => {
                        const online = isOnline(device.last_seen_at);
                        const isRevoked = device.status === 'revoked';
                        
                        return (
                            <div key={device.id} className={`bg-white border rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden relative group hover:border-accent transition-all ${isRevoked ? 'opacity-60 bg-slate-50' : ''}`}>
                                {/* Link to details (whole area except actions) */}
                                {!isRevoked && (
                                    <Link 
                                        to={`/clients/${clientId}/devices/${device.id}`}
                                        className="absolute inset-0 z-0"
                                    />
                                )}
                                
                                <div className="flex items-start gap-4 p-4 relative z-10 pointer-events-none">
                                    <div className={`p-3 rounded-full ${isRevoked ? 'bg-slate-200 text-slate-500' : online ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {getDeviceIcon(device.os_name)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-900">{device.hostname}</span>
                                            {isRevoked ? (
                                                <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                                    Revogado
                                                </span>
                                            ) : online ? (
                                                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                                    Online
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                    Offline
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">
                                            {device.os_name || 'Desconhecido'} {device.os_version} · v{device.agent_version || '1.0.0'}
                                        </p>
                                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                                <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                                                {device.model || device.manufacturer || 'Genérico'}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                                <Shield className="h-3.5 w-3.5 text-slate-400" />
                                                ID: {device.device_token_prefix}...
                                            </div>
                                            {device.last_seen_at && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                                                    Visto há {formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: false, locale: ptBR })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 p-4 pt-0 md:pt-4 relative z-10">
                                    {!isRevoked && (
                                        <div className="flex items-center gap-2">
                                            <Link 
                                                to={`/clients/${clientId}/devices/${device.id}`}
                                                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-accent bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors"
                                            >
                                                <Info className="h-3.5 w-3.5" />
                                                Mais Detalhes
                                            </Link>
                                            <button
                                                onClick={() => handleRevoke(device.id)}
                                                disabled={isRevoking === device.id}
                                                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors"
                                            >
                                                {isRevoking === device.id ? (
                                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <XOctagon className="h-3 w-3" />
                                                )}
                                                Revogar
                                            </button>
                                        </div>
                                    )}

                                    {/* Tier 3: Dados Sensíveis (Super Admin / Técnico) */}
                                    {(userRole === 'super_admin' || userRole === 'tecnico') && online && (
                                        <div className="flex items-center gap-3 mt-1 px-3 py-1 bg-amber-50 rounded-md border border-amber-100 text-amber-900">
                                            <div className="flex items-center gap-1 text-[10px] text-amber-700 uppercase font-extrabold">
                                                <ShieldAlert className="h-3 w-3" /> Admin
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px]">
                                                <Wifi className="h-3 w-3 text-amber-500" /> <span className="font-mono">{device.device_heartbeats?.[0]?.network_ssid || 'Desconhecida'}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px]">
                                                <Globe className="h-3 w-3 text-amber-500" /> <span className="font-mono">{device.device_heartbeats?.[0]?.public_ip || 'Desconhecido'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
