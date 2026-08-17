import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Toast } from './components/common/Toast';
import {
  DataErrorBanner,
  FullPageLoader,
  InlineBusyBar,
} from './components/common/AppStatus';
import { LandingView } from './views/LandingView';
import { AuthView } from './views/AuthView';
import { AdminHubView } from './views/AdminHubView';
import { TechnicianView } from './views/TechnicianView';
import { CustomerView } from './views/CustomerView';
import { SettingsView } from './views/SettingsView';
import { ServicesCategoryView } from './views/ServicesCategoryView';
import type { UserRole } from './types';

const Protected: React.FC<{ children: React.ReactNode; roles?: UserRole[] }> = ({
  children,
  roles,
}) => {
  const {
    isAuthenticated,
    authReady,
    dataLoading,
    dataError,
    navigate,
    currentUser,
    refreshRemoteData,
  } = useApp();
  const [retrying, setRetrying] = React.useState(false);

  React.useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (roles && currentUser && !roles.includes(currentUser.role)) {
      if (currentUser.role === 'admin') navigate('/hub');
      else if (currentUser.role === 'technician') navigate('/technician');
      else navigate('/customer');
    }
  }, [authReady, isAuthenticated, navigate, roles, currentUser]);

  if (!authReady || dataLoading) {
    return (
      <FullPageLoader
        message={!authReady ? 'Conectando con Supabase…' : 'Cargando datos del proyecto…'}
      />
    );
  }

  if (!isAuthenticated) return null;
  if (roles && currentUser && !roles.includes(currentUser.role)) return null;

  return (
    <>
      {dataError && (
        <DataErrorBanner
          message={dataError}
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            void refreshRemoteData().finally(() => setRetrying(false));
          }}
        />
      )}
      {children}
    </>
  );
};

const AppContent: React.FC = () => {
  const { currentPath, currentUser, remoteBusy, authReady } = useApp();

  const pathOnly = currentPath.split('?')[0];

  const renderView = () => {
    switch (pathOnly) {
      case '/':
        return <LandingView />;
      case '/auth':
        return <AuthView />;
      case '/home':
        return (
          <Protected>
            {currentUser?.role === 'admin' ? (
              <AdminHubView />
            ) : currentUser?.role === 'technician' ? (
              <TechnicianView />
            ) : (
              <CustomerView />
            )}
          </Protected>
        );
      case '/hub':
        return (
          <Protected roles={['admin']}>
            <AdminHubView />
          </Protected>
        );
      case '/technician':
        return (
          <Protected roles={['admin', 'technician']}>
            <TechnicianView />
          </Protected>
        );
      case '/customer':
        return (
          <Protected roles={['admin', 'customer']}>
            <CustomerView />
          </Protected>
        );
      case '/settings':
        return (
          <Protected>
            <SettingsView />
          </Protected>
        );
      default:
        if (pathOnly.startsWith('/customer/orders/')) {
          return (
            <Protected roles={['admin', 'customer']}>
              <CustomerView />
            </Protected>
          );
        }
        if (pathOnly.startsWith('/services-category/')) {
          return <ServicesCategoryView />;
        }
        return <LandingView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-teal-500 selection:text-white">
      <Header />
      <InlineBusyBar active={remoteBusy} />
      {!authReady ? <FullPageLoader message="Iniciando ServiCasa…" /> : <div className="flex-1">{renderView()}</div>}
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
