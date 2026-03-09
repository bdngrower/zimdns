import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
    const { user, isLoading } = useAuthStore();

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-500 font-medium animate-pulse text-sm">Verificando sessão segura...</p>
            </div>
        );
    }

    if (!user) {
        console.warn('[ProtectedRoute] Acesso negado: Usuário não autenticado. Redirecionando para /login');
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
