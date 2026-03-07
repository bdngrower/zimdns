import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
    user: User | null;
    profile: any | null; // Tipar de acordo com o DB depois
    isLoading: boolean;
    setUser: (user: User | null) => void;
    setProfile: (profile: any) => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    profile: null,
    isLoading: true,
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, profile: null });
    },
}));
