export type EntityStatus = 'active' | 'inactive';
export type UserRole = 'super_admin' | 'tecnico' | 'cliente';
export type OriginType = 'ip' | 'dyndns';
export type OriginStatus = 'active' | 'error' | 'pending';
export type SyncStatus = 'pending' | 'success' | 'error';

export interface Profile {
    id: string;
    full_name: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
}

export interface Tenant {
    id: string;
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    status: EntityStatus;
    primary_dns_ip?: string;
    secondary_dns_ip?: string;
    notes?: string;
    technical_id?: string;
    last_sync_at?: string;
    sync_status?: SyncStatus;
    sync_error_message?: string;
    created_at: string;
    updated_at: string;
}

export interface TenantNetworkOrigin {
    id: string;
    tenant_id: string;
    type: OriginType;
    value: string;
    resolved_ip?: string;
    description?: string;
    is_active: boolean;
    last_resolved_at?: string;
    resolution_status?: OriginStatus;
    notes?: string;
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
