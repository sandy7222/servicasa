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
import { GuestOrderStatusView } from './views/GuestOrderStatusView';
import { ClientsTable } from './components/admin/ClientsTable';
import { ClientFicha } from './components/admin/ClientFicha';
import { ClaimsTable } from './components/admin/ClaimsTable';
import { ClaimDetail } from './components/common/ClaimDetail';
import { ConversationsPanel } from './components/common/ConversationsPanel';
import { ConversationThread } from './components/common/ConversationThread';
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

  // Keep the current route and the view mounted during background refreshes.
  // Otherwise any write (for example, adding a quote item) unmounts the
  // technician/customer screen and loses its selected tab or detail route.
  if (!authReady || (dataLoading && !currentUser)) {
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
      case '/admin/clientes':
        return (
          <Protected roles={['admin']}>
            <ClientsTable onOpen={(customerId) => window.location.hash = `#/admin/clientes/${customerId}`} />
          </Protected>
        );
      case '/admin/reclamos':
        return (
          <Protected roles={['admin']}>
            <ClaimsTable onOpen={(claimId) => window.location.hash = `#/admin/reclamos/${claimId}`} />
          </Protected>
        );
      case '/admin/conversaciones':
        return (
          <Protected roles={['admin']}>
            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
              <ConversationsPanel
                title="Todas las conversaciones"
                emptyLabel="No hay conversaciones todavía."
                onOpen={(id) => window.location.hash = `#/admin/conversaciones/${id}`}
              />
            </main>
          </Protected>
        );
      case '/technician':
      case '/technician/profile':
      case '/technician/earnings':
      case '/technician/availability':
      case '/technician/history':
      case '/technician/statistics':
      case '/technician/reclamos':
      case '/technician/conversaciones':
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
        if (pathOnly.startsWith('/admin/clientes/')) {
          const customerId = pathOnly.replace('/admin/clientes/', '');
          return (
            <Protected roles={['admin']}>
              <ClientFicha customerId={customerId} onBack={() => window.location.hash = '#/admin/clientes'} />
            </Protected>
          );
        }
        if (pathOnly.startsWith('/admin/reclamos/')) {
          const claimId = pathOnly.replace('/admin/reclamos/', '');
          return (
            <Protected roles={['admin']}>
              <ClaimDetail claimId={claimId} onBack={() => window.location.hash = '#/admin/reclamos'} />
            </Protected>
          );
        }
        if (pathOnly.startsWith('/customer/reclamos/')) {
          const claimId = pathOnly.replace('/customer/reclamos/', '');
          return (
            <Protected roles={['admin', 'customer']}>
              <ClaimDetail claimId={claimId} onBack={() => window.location.hash = '#/customer'} />
            </Protected>
          );
        }
        if (pathOnly.startsWith('/technician/reclamos/')) {
          const claimId = pathOnly.replace('/technician/reclamos/', '');
          return (
            <Protected roles={['admin', 'technician']}>
              <ClaimDetail claimId={claimId} onBack={() => window.location.hash = '#/technician'} />
            </Protected>
          );
        }
        if (pathOnly.startsWith('/admin/conversaciones/')) {
          const conversationId = pathOnly.replace('/admin/conversaciones/', '');
          return (
            <Protected roles={['admin']}>
              <ConversationThread conversationId={conversationId} onBack={() => window.location.hash = '#/admin/conversaciones'} />
            </Protected>
          );
        }
        if (pathOnly.startsWith('/customer/conversaciones/')) {
          const conversationId = pathOnly.replace('/customer/conversaciones/', '');
          return (
            <Protected roles={['admin', 'customer']}>
              <ConversationThread conversationId={conversationId} onBack={() => window.location.hash = '#/customer'} />
            </Protected>
          );
        }
        if (pathOnly.startsWith('/technician/conversaciones/')) {
          const conversationId = pathOnly.replace('/technician/conversaciones/', '');
          return (
            <Protected roles={['admin', 'technician']}>
              <ConversationThread conversationId={conversationId} onBack={() => window.location.hash = '#/technician'} />
            </Protected>
          );
        }
        if (pathOnly.startsWith('/services-category/')) {
          return <ServicesCategoryView />;
        }
        if (pathOnly.startsWith('/pedido/')) {
          return <GuestOrderStatusView token={pathOnly.replace('/pedido/', '')} />;
        }
        return <LandingView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-teal-500 selection:text-white">
      <Header />
      <InlineBusyBar active={remoteBusy} />
      {!authReady ? <FullPageLoader message="Iniciando TecniUrbano…" /> : <div className="flex-1">{renderView()}</div>}
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
