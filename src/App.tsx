import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';

// Components
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

// Pages
import { Login } from './pages/Login';
import { Blocked } from './pages/Blocked';
import { Dashboard } from './pages/Dashboard';
import { ClientList } from './pages/clients/ClientList';
import { ClientDetails } from './pages/clients/ClientDetails';
import { ClientForm } from './pages/clients/ClientForm';
import { ServiceCatalog } from './pages/catalog/ServiceCatalog';
import { Reports } from './pages/reports/Reports';
import { Settings } from './pages/Settings';

function App() {
  const { setUser, setProfile, isLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      console.log('[Auth Bootstrap] Started...');
      try {
        // Usa getUser() para ir na API e conferir se a sessão é REALMENTE válida e não apenas um token pendurado no localStorage.
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.warn('[Auth Bootstrap] No valid user found from getUser.', userError?.message || 'Empty user');
          throw new Error('Sessão inválida');
        }

        console.log('[Auth Bootstrap] Valid user found. Fetching profile...', user.id);
        setUser(user);

        // Busca o perfil do usuário
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('[Auth Bootstrap] Profile fetch errored:', profileError);
        }

        setProfile(profile || null);
        console.log('[Auth Bootstrap] Resolved completely. User:', user.email);

      } catch (error) {
        console.warn('[Auth Bootstrap] Fallback to unauthenticated state. Cleaning potentially corrupted storage/state...');
        // Tentativa de limpar cache sujo do supabase e cookies zumbis do cliente
        await supabase.auth.signOut().catch(() => { });
        setUser(null);
        setProfile(null);
      } finally {
        if (mounted) {
          console.log('[Auth Bootstrap] Ending loading state.');
          useAuthStore.setState({ isLoading: false });
        }
      }
    };

    // Fallback absoluto: Nunca deixar o aplicativo em Loading Infinito
    // Se por qualquer razão (rede corrompida, proxy travando chamadas da API Supabase) não resolver:
    const failSafeTimeout = setTimeout(() => {
      const storeState = useAuthStore.getState();
      if (storeState.isLoading && mounted) {
        console.error('[Auth Bootstrap] Failsafe timeout triggered after 8 seconds. Forcing unauthenticated state to prevent infinite loading loop.', {
          reason: 'Timeout'
        });
        useAuthStore.setState({ isLoading: false, user: null, profile: null });
      }
    }, 8000);

    // Initializa o fluxo de verificação segura na montagem do app
    bootstrapAuth();

    // Ouvis os eventos que acontecem PÓS bootstrap (ex: expiração de token durante uso, logout em outra aba)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth Event Detected] ${event}`, session?.user?.email || 'No Session');

      if (event === 'SIGNED_OUT') {
        useAuthStore.setState({ user: null, profile: null, isLoading: false });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user && mounted) {
          useAuthStore.setState({ user: session.user });

          // Profiling refetch for safety on implicit refresh
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
          if (mounted) {
            useAuthStore.setState({ profile: profile || null, isLoading: false });
          }
        }
      } else if (event === 'INITIAL_SESSION') {
        // Omitido de propósito, lidamos com isso no bootstrapAuth focado.
        console.log('[Auth Event Detected] INITIAL_SESSION ignored in favor of explicit getUser() bootstrap.');
      }
    });

    return () => {
      mounted = false;
      clearTimeout(failSafeTimeout);
      subscription.unsubscribe();
    };
  }, [setUser, setProfile]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse text-sm">Carregando ZIM DNS...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/blocked" element={<Blocked />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:id/edit" element={<ClientForm />} />
            <Route path="/clients/:id" element={<ClientDetails />} />
            <Route path="/catalog/services" element={<ServiceCatalog />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
