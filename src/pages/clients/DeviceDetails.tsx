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
    Info,
    LayoutDashboard,
    Terminal,
    Shield,
    ShieldCheck,
    ShieldAlert,
    ShieldOff,
    Wifi,
    Globe,
    Clock,
    CheckCircle,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Server,
    Bug,
    Package,
    List,
    Filter,
    DatabaseZap,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── tipos de tab ─────────────────────────────────────────────────────────────
type ActiveTab = 'overview' | 'dns-activity' | 'inventory' | 'diagnostics';
type DnsFilter = 'all' | 'blocked' | 'allowed';

interface DnsEvent {
    id: string;
    timestamp: string;
    client_id: string;
    domain: string;
    query_type?: string;
    action: string;
    rule?: string;
    source_ip?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function parseSupabaseDate(dateStr: string): Date {
    const str = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    return new Date(str.endsWith('Z') || str.includes('+') || /\d{2}-\d{2}$/.test(str) ? str : `${str}Z`);
}

function secondsSince(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    return (Date.now() - parseSupabaseDate(dateStr).getTime()) / 1000;
}

type OnlineStatus = 'online' | 'inactive' | 'offline';

function getOnlineStatus(lastSeenAt?: string | null): OnlineStatus {
    const secs = secondsSince(lastSeenAt);
    if (secs === null) return 'offline';
    if (secs < 120) return 'online';
    if (secs < 600) return 'inactive';   // até 10 min → "Inativo"
    return 'offline';
}

// ── componentes pequenos ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OnlineStatus }) {
    const map = {
        online: {
            label: 'Online',
            dot: 'bg-emerald-500 animate-pulse',
            wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
        },
        inactive: {
            label: 'Inativo',
            dot: 'bg-amber-400 animate-pulse',
            wrap: 'bg-amber-50 text-amber-700 ring-amber-500/20',
        },
        offline: {
            label: 'Offline',
            dot: 'bg-slate-400',
            wrap: 'bg-slate-100 text-slate-600 ring-slate-500/10',
        },
    }[status];

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${map.wrap}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
            {map.label}
        </span>
    );
}

function EnforcementBadge({ active }: { active: boolean }) {
    if (active) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                Enforcement Ativo
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-400/20">
            <ShieldOff className="h-3.5 w-3.5" />
            Sem Enforcement
        </span>
    );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {children}
        </p>
    );
}

function MetaField({ label, value }: { label: string; value: string | React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5">
            <MiniLabel>{label}</MiniLabel>
            <div className="text-sm font-medium text-slate-800">{value}</div>
        </div>
    );
}

function Divider() {
    return <div className="w-px h-8 bg-slate-200 hidden md:block self-center" />;
}

// ── Card de saúde no topo ─────────────────────────────────────────────────────

interface HealthCardProps {
    icon: React.ReactNode;
    title: string;
    value: string | React.ReactNode;
    sub?: string;
    status?: 'ok' | 'warn' | 'error' | 'neutral';
}

function HealthCard({ icon, title, value, sub, status = 'neutral' }: HealthCardProps) {
    const statusRing = {
        ok: 'ring-emerald-200 bg-emerald-50/50',
        warn: 'ring-amber-200 bg-amber-50/50',
        error: 'ring-red-200 bg-red-50/50',
        neutral: 'ring-slate-200 bg-white',
    }[status];

    const iconColor = {
        ok: 'text-emerald-500',
        warn: 'text-amber-500',
        error: 'text-red-500',
        neutral: 'text-slate-400',
    }[status];

    return (
        <div className={`rounded-xl border ring-1 p-4 flex items-start gap-3 ${statusRing}`}>
            <div className={`p-2 rounded-lg bg-white border shadow-sm shrink-0 ${iconColor}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{title}</p>
                <div className="text-sm font-semibold text-slate-900 leading-snug">{value}</div>
                {sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>}
            </div>
        </div>
    );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="p-4 rounded-full bg-slate-100 text-slate-400 mb-4">
                {icon}
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">{message}</p>
        </div>
    );
}

// ── Componente Principal ──────────────────────────────────────────────────────

export function DeviceDetails() {
    const { clientId, deviceId } = useParams();
    const [device, setDevice] = useState<Device | null>(null);
    const [snapshot, setSnapshot] = useState<DeviceInventorySnapshot | null>(null);
    const [heartbeats, setHeartbeats] = useState<DeviceHeartbeat[]>([]);
    const [telemetry, setTelemetry] = useState<DeviceTelemetryEvent[]>([]);
    const [dnsEvents, setDnsEvents] = useState<DnsEvent[]>([]);
    const [dnsFilter, setDnsFilter] = useState<DnsFilter>('all');
    const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [deviceId]);

    async function loadData() {
        setIsLoading(true);

        const { data: deviceData } = await supabase
            .from('devices')
            .select(`
                *,
                client_policy:client_policy_id (
                    policy_name
                )
            `)
            .eq('id', deviceId)
            .single();

        if (deviceData) setDevice(deviceData);

        const { data: snapData } = await supabase
            .from('device_inventory_snapshots')
            .select('*')
            .eq('device_id', deviceId)
            .order('snapshot_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (snapData) setSnapshot(snapData);

        const { data: hbData } = await supabase
            .from('device_heartbeats')
            .select('*')
            .eq('device_id', deviceId)
            .order('received_at', { ascending: false })
            .limit(30);

        if (hbData) setHeartbeats(hbData);

        const { data: telData } = await supabase
            .from('device_telemetry_events')
            .select('*')
            .eq('device_id', deviceId)
            .order('occurred_at', { ascending: false })
            .limit(50);

        if (telData) setTelemetry(telData);

        // ── DNS events (filtrados por device_id) ────────────────────────────
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: dnsData } = await supabase
            .from('dns_events')
            .select('id, timestamp, client_id, domain, query_type, action, rule, source_ip, device_id')
            .eq('device_id', deviceId)
            .gte('timestamp', since24h)
            .order('timestamp', { ascending: false })
            .limit(200);

        if (dnsData) setDnsEvents(dnsData);

        setIsLoading(false);
    }

    if (isLoading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-500 min-h-[50vh]">
                <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin" />
                <span className="text-sm">Carregando detalhes do dispositivo...</span>
            </div>
        );
    }
    if (!device) {
        return (
            <div className="p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-red-400 mx-auto mb-3" />
                <p className="text-red-600 font-semibold">Dispositivo não encontrado.</p>
            </div>
        );
    }

    // ── dados derivados ───────────────────────────────────────────────────────
    const latestHB = heartbeats[0] ?? null;
    const onlineStatus = getOnlineStatus(device.last_seen_at);
    const isOnline = onlineStatus === 'online';
    const isEnforcementActive = isOnline && latestHB?.dns_stub_ok === true;
    const policyName = (device as any).client_policy?.policy_name || 'Política Padrão';

    const dohStatus: 'ok' | 'warn' | 'error' | 'neutral' = latestHB?.doh_ok === true ? 'ok' : latestHB?.doh_ok === false ? 'error' : 'neutral';
    const stubStatus: 'ok' | 'warn' | 'error' | 'neutral' = latestHB?.dns_stub_ok === true ? 'ok' : latestHB?.dns_stub_ok === false ? 'error' : 'neutral';

    const lastSeenLabel = device.last_seen_at
        ? formatDistanceToNow(parseSupabaseDate(device.last_seen_at), { addSuffix: true, locale: ptBR })
        : 'Nunca';

    // ── tabs ─────────────────────────────────────────────────────────────────
    // ── derivados de DNS ──────────────────────────────────────────────────────
    const dnsBlocked = dnsEvents.filter(e => e.action === 'blocked');
    const dnsAllowed = dnsEvents.filter(e => e.action !== 'blocked');
    const dnsFiltered = dnsFilter === 'blocked' ? dnsBlocked : dnsFilter === 'allowed' ? dnsAllowed : dnsEvents;
    const lastDnsActivity = dnsEvents[0]?.timestamp ?? null;
    const lastBlock = dnsBlocked[0]?.timestamp ?? null;

    const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Visão Geral', icon: <LayoutDashboard className="h-4 w-4" /> },
        { id: 'dns-activity', label: 'Atividade DNS', icon: <Activity className="h-4 w-4" /> },
        { id: 'inventory', label: 'Inventário', icon: <Package className="h-4 w-4" /> },
        { id: 'diagnostics', label: 'Diagnóstico', icon: <Bug className="h-4 w-4" /> },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">

            {/* ── Back link ── */}
            <Link
                to={`/clients/${clientId}`}
                className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 group transition-colors"
            >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Voltar para Cliente
            </Link>

            {/* ═══════════════════════════════════════════════════════════════
                HEADER DO DISPOSITIVO
            ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">

                {/* top bar colorida conforme status */}
                <div className={`h-1.5 w-full ${
                    onlineStatus === 'online' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                    onlineStatus === 'inactive' ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                    'bg-slate-200'
                }`} />

                <div className="p-6 flex flex-col md:flex-row md:items-start gap-6">

                    {/* ícone + identidade */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`p-4 rounded-2xl border shadow-sm shrink-0 ${
                            isEnforcementActive
                                ? 'bg-gradient-to-br from-blue-50 to-slate-50 border-blue-100'
                                : 'bg-slate-50 border-slate-100'
                        }`}>
                            {isEnforcementActive
                                ? <ShieldCheck className="h-9 w-9 text-blue-500" />
                                : <Shield className="h-9 w-9 text-slate-400" />
                            }
                        </div>

                        <div className="min-w-0">
                            {/* hostname + badges */}
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h1 className="text-2xl font-bold text-slate-900 truncate">{device.hostname}</h1>
                                <StatusBadge status={onlineStatus} />
                                <EnforcementBadge active={isEnforcementActive} />
                            </div>

                            <p className="text-sm text-slate-500 mb-4">
                                {device.os_name} {device.os_version}
                                {device.architecture ? ` · ${device.architecture}` : ''}
                                {device.hardware_id ? (
                                    <> · <span className="font-mono text-slate-700">{device.hardware_id}</span></>
                                ) : null}
                            </p>

                            {/* meta fields */}
                            <div className="flex flex-wrap gap-x-6 gap-y-4 items-center">
                                <MetaField
                                    label="Política Aplicada"
                                    value={
                                        <span className="flex items-center gap-1.5 text-blue-700">
                                            <LayoutDashboard className="h-3.5 w-3.5" />
                                            {policyName}
                                        </span>
                                    }
                                />
                                <Divider />
                                <MetaField label="Versão do Agente" value={`v${device.agent_version || '1.0.0'}`} />
                                {latestHB?.public_ip && (
                                    <>
                                        <Divider />
                                        <MetaField
                                            label="IP Público"
                                            value={<span className="font-mono text-slate-700">{latestHB.public_ip}</span>}
                                        />
                                    </>
                                )}
                                {(latestHB?.network_ssid || latestHB?.network_type) && (
                                    <>
                                        <Divider />
                                        <MetaField
                                            label="Rede Atual"
                                            value={
                                                <span className="flex items-center gap-1.5">
                                                    <Wifi className="h-3.5 w-3.5 text-slate-400" />
                                                    {latestHB.network_ssid || latestHB.network_type}
                                                </span>
                                            }
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* último heartbeat (canto direito) */}
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                        <MiniLabel>Último Heartbeat</MiniLabel>
                        <p className={`text-sm font-semibold ${
                            onlineStatus === 'online' ? 'text-emerald-600' :
                            onlineStatus === 'inactive' ? 'text-amber-600' :
                            'text-slate-500'
                        }`}>
                            {lastSeenLabel}
                        </p>
                        {device.last_seen_at && (
                            <p className="text-[11px] text-slate-400">
                                {format(parseSupabaseDate(device.last_seen_at), "dd/MM/yyyy · HH:mm", { locale: ptBR })}
                            </p>
                        )}

                        {/* tooltip legenda */}
                        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border text-left text-[10px] text-slate-500 leading-relaxed space-y-0.5 w-52">
                            <p className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /> Online — heartbeat &lt; 2 min</p>
                            <p className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" /> Inativo — heartbeat &lt; 10 min</p>
                            <p className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" /> Offline — sem sinais</p>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    CARDS DE SAÚDE
                ═══════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pb-5">
                    <HealthCard
                        icon={<Activity className="h-4 w-4" />}
                        title="Stub DNS Local"
                        value={latestHB ? (latestHB.dns_stub_ok ? 'Operacional' : 'Falhou') : 'Sem dados'}
                        sub={latestHB ? '127.0.53.1:53' : undefined}
                        status={stubStatus}
                    />
                    <HealthCard
                        icon={<Globe className="h-4 w-4" />}
                        title="Proxy DoH"
                        value={
                            latestHB
                                ? latestHB.doh_ok
                                    ? `${latestHB.doh_latency_ms ?? '—'} ms`
                                    : 'Inacessível'
                                : 'Sem dados'
                        }
                        sub={latestHB?.doh_ok ? 'Latência de resposta' : undefined}
                        status={dohStatus}
                    />
                    <HealthCard
                        icon={<Shield className="h-4 w-4" />}
                        title="Proteção DNS"
                        value={isEnforcementActive ? 'Ativa' : isOnline ? 'Parcial' : 'Inativa'}
                        sub={isEnforcementActive ? `Política: ${policyName}` : 'Verifique o agente'}
                        status={isEnforcementActive ? 'ok' : isOnline ? 'warn' : 'error'}
                    />
                    <HealthCard
                        icon={<Clock className="h-4 w-4" />}
                        title="Última Atividade"
                        value={lastSeenLabel}
                        sub={device.enrolled_at ? `Cadastrado ${formatDistanceToNow(parseSupabaseDate(device.enrolled_at), { addSuffix: true, locale: ptBR })}` : undefined}
                        status={onlineStatus === 'online' ? 'ok' : onlineStatus === 'inactive' ? 'warn' : 'neutral'}
                    />
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    TABS
                ═══════════════════════════════════════════════════════════ */}
                <div className="border-t px-6 overflow-x-auto scrollbar-hide">
                    <nav className="-mb-px flex gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-3.5 px-4 border-b-2 font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.id === 'diagnostics' && telemetry.length > 0 && (
                                    <span className="ml-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5">
                                        {telemetry.length}
                                    </span>
                                )}
                                {tab.id === 'dns-activity' && dnsBlocked.length > 0 && (
                                    <span className="ml-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5">
                                        {dnsBlocked.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    CONTEÚDO DAS TABS
                ═══════════════════════════════════════════════════════════ */}
                <div className="p-6">

                    {/* ── Visão Geral ── */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* resumo de proteção */}
                            <div>
                                <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                                    Estado de Proteção
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                        {
                                            label: 'Enforcement DNS',
                                            icon: isEnforcementActive ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />,
                                            value: isEnforcementActive ? 'Ativo' : 'Inativo',
                                            valueClass: isEnforcementActive ? 'text-emerald-600' : 'text-red-500',
                                        },
                                        {
                                            label: 'Stub DNS Local',
                                            icon: latestHB?.dns_stub_ok ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />,
                                            value: latestHB?.dns_stub_ok ? 'Operacional' : (latestHB ? 'Falhou' : '—'),
                                            valueClass: latestHB?.dns_stub_ok ? 'text-emerald-600' : 'text-red-500',
                                        },
                                        {
                                            label: 'Proxy DoH',
                                            icon: latestHB?.doh_ok ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />,
                                            value: latestHB?.doh_ok ? `${latestHB.doh_latency_ms} ms` : (latestHB ? 'Inacessível' : '—'),
                                            valueClass: latestHB?.doh_ok ? 'text-emerald-600' : 'text-red-500',
                                        },
                                        {
                                            label: 'Política Aplicada',
                                            icon: <LayoutDashboard className="h-4 w-4 text-blue-400" />,
                                            value: policyName,
                                            valueClass: 'text-blue-700',
                                        },
                                        {
                                            label: 'IP Público',
                                            icon: <Globe className="h-4 w-4 text-slate-400" />,
                                            value: latestHB?.public_ip || '—',
                                            valueClass: 'text-slate-700 font-mono',
                                        },
                                        {
                                            label: 'Rede',
                                            icon: <Wifi className="h-4 w-4 text-slate-400" />,
                                            value: latestHB?.network_ssid || latestHB?.network_type || '—',
                                            valueClass: 'text-slate-700',
                                        },
                                    ].map(row => (
                                        <div key={row.label} className="flex items-center gap-3 p-3.5 rounded-xl border bg-slate-50/60">
                                            {row.icon}
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{row.label}</p>
                                                <p className={`text-sm font-semibold ${row.valueClass}`}>{row.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* info de atividade */}
                            <div className="flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-800 leading-relaxed">
                                    <strong>Atividade DNS:</strong> Exibindo consultas realizadas especificamente por este dispositivo nas últimas 24 horas.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Atividade DNS ── */}
                    {activeTab === 'dns-activity' && (
                        <div className="space-y-5">

                            {/* mini-cards de resumo */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="p-4 rounded-xl border bg-slate-50 space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Última Atividade</p>
                                    <p className="text-sm font-semibold text-slate-800">
                                        {lastDnsActivity
                                            ? formatDistanceToNow(new Date(lastDnsActivity), { addSuffix: true, locale: ptBR })
                                            : '—'}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50 space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Consultas (24h)</p>
                                    <p className="text-sm font-semibold text-slate-800">{dnsEvents.length}</p>
                                </div>
                                <div className="p-4 rounded-xl border bg-red-50 border-red-100 space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Bloqueios (24h)</p>
                                    <p className="text-sm font-semibold text-red-700">{dnsBlocked.length}</p>
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50 space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Último Bloqueio</p>
                                    <p className="text-sm font-semibold text-slate-800">
                                        {lastBlock
                                            ? formatDistanceToNow(new Date(lastBlock), { addSuffix: true, locale: ptBR })
                                            : '—'}
                                    </p>
                                </div>
                            </div>

                            {/* filtros */}
                            <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                {(['all', 'blocked', 'allowed'] as DnsFilter[]).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setDnsFilter(f)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                            dnsFilter === f
                                                ? f === 'blocked'
                                                    ? 'bg-red-100 text-red-700'
                                                    : f === 'allowed'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                    >
                                        {f === 'all' ? 'Todos' : f === 'blocked' ? 'Bloqueados' : 'Permitidos'}
                                        <span className="ml-1 opacity-60">
                                            ({f === 'all' ? dnsEvents.length : f === 'blocked' ? dnsBlocked.length : dnsAllowed.length})
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* tabela ou empty state */}
                            {dnsEvents.length === 0 ? (
                                <EmptyState
                                    icon={<DatabaseZap className="h-8 w-8" />}
                                    title="Nenhuma atividade DNS recente"
                                    message="Apenas o tráfego em 'Agent Mode' é correlacionado a este endpoint. Se o dispositivo estiver em 'Network Mode' ou for um registro legado, os logs não aparecerão nesta aba específica."
                                />
                            ) : dnsFiltered.length === 0 ? (
                                <EmptyState
                                    icon={<List className="h-8 w-8" />}
                                    title="Nenhum registro neste filtro"
                                    message="Não há eventos correspondentes ao filtro selecionado no período de 24 horas."
                                />
                            ) : (
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {['Horário', 'Domínio', 'Ação', 'Motivo'].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {dnsFiltered.map((ev, i) => {
                                                const isBlocked = ev.action === 'blocked';
                                                return (
                                                    <tr key={ev.id ?? i} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                            <div>{format(new Date(ev.timestamp), "dd/MM · HH:mm:ss", { locale: ptBR })}</div>
                                                            <div className="text-slate-400">{formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true, locale: ptBR })}</div>
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs text-slate-800 max-w-[220px]">
                                                            <span className="truncate block" title={ev.domain}>{ev.domain}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {isBlocked ? (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200/60">
                                                                    <ShieldAlert className="h-3 w-3" /> Bloqueado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                                                                    <CheckCircle2 className="h-3 w-3" /> Permitido
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px]">
                                                            {ev.rule ? (
                                                                <span className="truncate block" title={ev.rule}>{ev.rule}</span>
                                                            ) : (
                                                                <span className="text-slate-300">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* nota de correlação */}
                            <div className="flex gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    <strong className="text-slate-600">Precisão de Logs:</strong>{' '}
                                    Esta visão utiliza o identificador único do agente (DeviceID) para garantir que apenas o tráfego deste dispositivo seja exibido.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Inventário ── */}
                    {activeTab === 'inventory' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Package className="h-4 w-4 text-blue-500" />
                                    Inventário de Hardware
                                </h2>
                                {snapshot?.snapshot_at && (
                                    <span className="text-xs text-slate-400">
                                        Último snapshot: {formatDistanceToNow(parseSupabaseDate(snapshot.snapshot_at), { addSuffix: true, locale: ptBR })}
                                    </span>
                                )}
                            </div>

                            {!snapshot ? (
                                <EmptyState
                                    icon={<Server className="h-8 w-8" />}
                                    title="Inventário ainda não disponível"
                                    message="O agente ainda não enviou um snapshot de inventário de hardware. Aguarde o próximo ciclo de inventário (enviado periodicamente pelo agente)."
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Processamento */}
                                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Cpu className="h-4 w-4 text-slate-400" />
                                            <h3 className="font-bold text-sm">Processamento</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <MiniLabel>Processador</MiniLabel>
                                                <p className="text-sm text-slate-700 truncate">{snapshot.cpu || '—'}</p>
                                            </div>
                                            <div>
                                                <MiniLabel>Arquitetura</MiniLabel>
                                                <p className="text-sm text-slate-700 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded w-fit">{snapshot.architecture || '—'}</p>
                                            </div>
                                            <div>
                                                <MiniLabel>Sistema Operacional</MiniLabel>
                                                <p className="text-sm text-slate-700">
                                                    {(snapshot.os_name || device.os_name) || '—'} {(snapshot.os_version || device.os_version) || ''}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Memória */}
                                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Ram className="h-4 w-4 text-slate-400" />
                                            <h3 className="font-bold text-sm">Memória & Sistema</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <MiniLabel>RAM Total</MiniLabel>
                                                <p className="text-sm text-slate-700">
                                                    {snapshot.ram_total_gb ? `${snapshot.ram_total_gb} GB` : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <MiniLabel>Hardware</MiniLabel>
                                                <p className="text-sm text-slate-700">
                                                    {snapshot.manufacturer || '—'} · {snapshot.model || '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <MiniLabel>ID do Hardware</MiniLabel>
                                                <p className="text-[10px] font-mono text-slate-500 break-all">{snapshot.hardware_id || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Armazenamento */}
                                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <HardDrive className="h-4 w-4 text-slate-400" />
                                            <h3 className="font-bold text-sm">Armazenamento</h3>
                                        </div>
                                        {(snapshot.disk_total_gb != null && snapshot.disk_free_gb != null) ? (() => {
                                            const used = snapshot.disk_total_gb - snapshot.disk_free_gb;
                                            const pct = (used / snapshot.disk_total_gb) * 100;
                                            const barColor = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-400' : 'bg-emerald-500';
                                            return (
                                                <div className="space-y-3">
                                                    <div>
                                                        <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
                                                            <span>{used.toFixed(1)} GB usado</span>
                                                            <span>{snapshot.disk_total_gb} GB total</span>
                                                        </div>
                                                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                                                style={{ width: `${Math.min(100, pct)}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 mt-1 text-right">{pct.toFixed(0)}% ocupado</p>
                                                    </div>
                                                    <div>
                                                        <MiniLabel>Espaço Livre</MiniLabel>
                                                        <p className={`text-sm font-semibold ${pct > 85 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {snapshot.disk_free_gb} GB
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            <p className="text-sm text-slate-400">Dados não disponíveis</p>
                                        )}
                                    </div>

                                    {/* Rede & Agente */}
                                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Globe className="h-4 w-4 text-slate-400" />
                                            <h3 className="font-bold text-sm">Rede & Agente</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <MiniLabel>IP Público</MiniLabel>
                                                <p className="text-sm font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit">
                                                    {heartbeats[0]?.public_ip || '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <MiniLabel>Versão do Agente</MiniLabel>
                                                <p className="text-sm text-slate-700">
                                                    {snapshot?.agent_version || device.agent_version || '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <MiniLabel>Hostname</MiniLabel>
                                                <p className="text-sm text-slate-700 truncate">{snapshot?.hostname || device.hostname || '—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Diagnóstico ── */}
                    {activeTab === 'diagnostics' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Bug className="h-4 w-4 text-blue-500" />
                                    Eventos de Diagnóstico
                                </h2>
                                {telemetry.length > 0 && (
                                    <span className="text-xs text-slate-400">{telemetry.length} eventos</span>
                                )}
                            </div>

                            {telemetry.length === 0 ? (
                                <EmptyState
                                    icon={<ShieldCheck className="h-8 w-8 text-emerald-400" />}
                                    title="Nenhuma falha registrada"
                                    message="O agente está operando normalmente. Eventos de diagnóstico aparecem aqui apenas quando ocorrem erros ou anomalias (falha no stub DNS, falha de DoH, tentativa de bypass, etc.)."
                                />
                            ) : (
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {['Evento', 'Gravidade', 'Mensagem', 'Data/Hora'].map(h => (
                                                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {telemetry.map(tel => {
                                                const severityMap = {
                                                    critical: { cls: 'bg-red-100 text-red-700', icon: <ShieldAlert className="h-3 w-3" /> },
                                                    error: { cls: 'bg-red-50 text-red-600', icon: <XCircle className="h-3 w-3" /> },
                                                    warn: { cls: 'bg-amber-50 text-amber-600', icon: <AlertTriangle className="h-3 w-3" /> },
                                                    info: { cls: 'bg-blue-50 text-blue-600', icon: <Info className="h-3 w-3" /> },
                                                }[tel.severity] ?? { cls: 'bg-slate-100 text-slate-600', icon: <Terminal className="h-3 w-3" /> };

                                                return (
                                                    <tr key={tel.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2 font-medium text-slate-800">
                                                                <Terminal className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                                <span className="text-xs font-mono">{tel.event_type}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${severityMap.cls}`}>
                                                                {severityMap.icon}
                                                                {tel.severity}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 max-w-xs">
                                                            <p className="truncate text-xs">{tel.message || '—'}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-slate-500">
                                                            <div>{format(parseSupabaseDate(tel.occurred_at), "dd/MM · HH:mm:ss", { locale: ptBR })}</div>
                                                            <div className="text-slate-400">{formatDistanceToNow(parseSupabaseDate(tel.occurred_at), { addSuffix: true, locale: ptBR })}</div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* nota contextual sobre logs DNS */}
                            <div className="mt-4 flex gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Esta área exibe apenas eventos operacionais críticos do agente (falhas, anomalias, reinicializações).
                                    Os logs de consultas DNS individuais por dispositivo estarão disponíveis na v1.1, correlacionados ao ClientID.
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
