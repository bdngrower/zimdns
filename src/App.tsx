import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';

// Components
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

// Pages (Basic implementations)
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ClientList } from './pages/clients/ClientList';
import { ClientDetails } from './pages/clients/ClientDetails';
import { ServiceCatalog } from './pages/catalog/ServiceCatalog';
import { Reports } from './pages/reports/Reports';

function App() {
  const { setUser, isLoading } = useAuthStore();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      // Fakes the loading state to stop after first check
      useAuthStore.setState({ isLoading: false });
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-background">Carregando...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes inside AppShell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/:id" element={<ClientDetails />} />
            <Route path="/catalog/services" element={<ServiceCatalog />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<div className="p-8">Configurações</div>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
