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
