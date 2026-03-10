export type EntityStatus = 'active' | 'inactive';
export type UserRole = 'super_admin' | 'tecnico' | 'cliente';
export type OriginType = 'ip' | 'dyndns';
export type OriginStatus = 'active' | 'error' | 'pending';
export type SyncStatus = 'pending' | 'success' | 'error' | 'warning';

export interface Profile {
    id: string;
    full_name: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
}

export interface Client {
    id: string;
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    status: EntityStatus;
    notes?: string;
    technical_id?: string;
    last_sync_at?: string;
    sync_status?: SyncStatus;
    sync_error_message?: string;
    created_at: string;
    updated_at: string;
}

export interface ClientNetwork {
    id: string;
    client_id: string;
    type: OriginType;
    value: string;
    description?: string;
    resolved_ip?: string;
    is_active: boolean;
    last_resolved_at?: string;
    resolution_status?: OriginStatus;
    created_at: string;
    updated_at: string;
}

export interface ClientPolicy {
    id: string;
    client_id: string;
    policy_name: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface GlobalSettings {
    id: string;
    adguard_api_url?: string;
    last_connection_status: OriginStatus;
    last_connection_check_at?: string;
    last_connection_error?: string;
    environment: string;
    updated_at: string;
}

// --- Agent v1 Types ---

export type DeviceStatus = 'active' | 'revoked' | 'inactive';

export type TelemetryEventType =
    | 'dns_status_change'
    | 'doh_status_change'
    | 'network_change'
    | 'bypass_attempt'
    | 'agent_error'
    | 'service_restart'
    | 'policy_applied';

export interface EnrollmentToken {
    id: string;
    client_id: string;
    token_prefix: string;
    label?: string;
    client_policy_id?: string;
    expires_at: string;
    max_uses: number;
    used_count: number;
    status: 'active' | 'consumed' | 'revoked' | 'expired';
    created_by?: string;
    created_at: string;
}

export interface Device {
    id: string;
    client_id: string;
    enrollment_token_id?: string;
    device_token_prefix: string;
    hostname: string;
    hardware_id?: string;
    os_name?: string;
    os_version?: string;
    architecture?: string;
    manufacturer?: string;
    model?: string;
    agent_version?: string;
    client_policy_id?: string;
    status: DeviceStatus;
    last_seen_at?: string;
    enrolled_at: string;
    revoked_at?: string;
    revoked_by?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface DeviceHeartbeat {
    id: string;
    device_id: string;
    client_id: string;
    agent_version?: string;
    dns_stub_ok?: boolean;
    doh_ok?: boolean;
    doh_latency_ms?: number;
    service_status?: string;
    network_type?: string;
    network_ssid?: string;
    public_ip?: string;
    received_at: string;
}

export interface DeviceInventorySnapshot {
    id: string;
    device_id: string;
    client_id: string;
    hostname?: string;
    os_name?: string;
    os_version?: string;
    architecture?: string;
    manufacturer?: string;
    model?: string;
    cpu?: string;
    ram_total_gb?: number;
    disk_total_gb?: number;
    disk_free_gb?: number;
    hardware_id?: string;
    agent_version?: string;
    snapshot_at: string;
}

export interface DeviceTelemetryEvent {
    id: string;
    device_id: string;
    client_id: string;
    event_type: TelemetryEventType;
    severity: 'info' | 'warn' | 'error' | 'critical';
    message?: string;
    details?: any;
    occurred_at: string;
    received_at: string;
}
