import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  INITIAL_CUSTOMERS,
  INITIAL_MATERIALS,
  INITIAL_ORDERS,
  INITIAL_SERVICES,
  INITIAL_SERVICE_CATEGORIES,
  INITIAL_TECHNICIANS,
} from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  fetchCatalog,
  fetchProfile,
  fetchPublicCatalogCategories,
  fetchPublicCatalogSubcategories,
  fetchPublicServices,
  fetchTechnicianApplications,
  fetchVisitDepositAmount,
  profileToCurrentUser,
  requestPasswordReset,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePasswordForRecoverySession,
} from '../lib/supabaseData';
import {
  requireAdmin,
  requireTechnician,
  validateOrderCreationAccess,
  validateOrderModificationAccess,
  validateCustomerSignatureAccess,
  validateTechnicianOrderAccess,
  validateTechnicianAssignmentAccess,
  validateOrderId,
  requireCustomer,
  SecurityError,
} from '../lib/securityValidations';
import {
  persistAddChecklistItem,
  persistRespondToAssignment,
  persistAddNote,
  persistAddTimeLog,
  persistAddUsedMaterial,
  persistAdminCancelOrder,
  persistAdminExceptionalClose,
  persistAdminIncident,
  persistResolveAdminIncident,
  persistAssignTechnician,
  persistCreateAccountInvite,
  persistCreateCustomer,
  persistCreateCustomerSelf,
  persistCreateMaterial,
  persistCreateOrder,
  persistCreateService,
  persistCreateTechnician,
  persistSelfRegisterTechnician,
  persistDeleteCustomer,
  persistDeleteMaterial,
  persistHideOwnOrder,
  persistDeleteService,
  persistCreateCategory,
  persistUpdateCategory,
  persistDeleteCategory,
  persistMergeCategory,
  persistSwapCategoryOrder,
  persistCreateSubcategory,
  persistUpdateSubcategory,
  persistDeleteSubcategory,
  persistMergeSubcategory,
  persistSwapSubcategoryOrder,
  persistDeleteTechnician,
  persistSignature,
  redeemAccountInvite,
  persistToggleChecklistItem,
  persistUpdateCustomer,
  persistUpdateMaterial,
  persistUpdateMaterialStock,
  persistUpdateOrder,
  persistUpdateOrderStatus,
  persistUpdateService,
  persistUpdateTechnician,
  persistUpdateVisitDepositAmount,
} from '../lib/supabaseMutations';
import { friendlyErrorMessage } from '../components/common/AppStatus';
import { isOrderPaymentSettled, orderRequiresPaymentGate } from '../lib/workTimer';
import {
  CatalogCategory,
  CatalogSubcategory,
  CurrentUserData,
  Customer,
  CustomerRegistrationInput,
  MaterialInventory,
  OrderEventType,
  OrderStatus,
  OrderPriority,
  ServiceItem,
  ServiceCategory,
  ServiceItemInput,
  ServiceOrder,
  ServiceType,
  Technician,
  TechnicianApplication,
  TechnicianRegistrationInput,
  TechnicianInput,
  UserRole,
} from '../types';

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

interface AppContextType {
  orders: ServiceOrder[];
  technicians: Technician[];
  customers: Customer[];
  materials: MaterialInventory[];
  services: ServiceItem[];
  catalogCategories: CatalogCategory[];
  catalogSubcategories: CatalogSubcategory[];
  visitDepositAmount: number;
  updateVisitDepositAmount: (amount: number) => Promise<void>;
  currentUser: CurrentUserData | null;
  authReady: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  dataError: string | null;
  remoteBusy: boolean;
  isAuthenticated: boolean;
  usingRemoteData: boolean;
  currentPath: string;
  toast: ToastNotification | null;
  navigate: (path: string) => void;
  setCurrentUser: (user: CurrentUserData) => void;
  loginAsRole: (role: UserRole, specificId?: string) => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  passwordRecoveryMode: boolean;
  requestPasswordRecovery: (email: string) => Promise<void>;
  completePasswordRecovery: (newPassword: string) => Promise<void>;
  registerWithInvite: (input: { token: string; password: string }) => Promise<void>;
  registerCustomer: (input: CustomerRegistrationInput) => Promise<void>;
  registerTechnician: (input: TechnicianRegistrationInput) => Promise<void>;
  technicianApplications: TechnicianApplication[];
  createAccountInviteLink: (kind: 'technician' | 'customer', targetId: string) => Promise<string>;
  logout: () => Promise<void>;
  refreshRemoteData: () => Promise<void>;
  clearDataError: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string) => void;
  hideToast: () => void;
  
  // Order actions
  createOrder: (order: {
    title: string;
    description: string;
    serviceType: ServiceType;
    priority: OrderPriority;
    clientId: string;
    assignedTechnicianId?: string;
    scheduledDate: string;
    customChecklist?: string[];
  }) => string;
  updateOrder: (
    orderId: string,
    patch: {
      title: string;
      description: string;
      serviceType: ServiceType;
      priority: OrderPriority;
      clientId: string;
      assignedTechnicianId?: string | null;
      scheduledDate: string;
    }
  ) => void;

  deleteCustomerOrder: (orderId: string) => void;
  cancelOrderAsAdmin: (orderId: string, reason: string) => void;
  reportOrderIncident: (orderId: string, reason: string, pauseSettlements: boolean) => void;
  resolveOrderIncident: (orderId: string) => void;
  closeOrderExceptionally: (orderId: string, reason: string) => void;
  
  updateOrderStatus: (
    orderId: string,
    newStatus: OrderStatus,
    reason?: string
  ) => { success: boolean; message: string };
  
  assignTechnician: (orderId: string, technicianId: string) => void;
  toggleChecklistItem: (orderId: string, itemId: string) => void;
  addChecklistItem: (orderId: string, label: string) => void;
  respondToAssignment: (orderId: string, response: 'accepted' | 'rejected') => Promise<void>;
  addTimeLog: (orderId: string, minutes: number, note: string) => void;
  addTechnicalNote: (orderId: string, text: string) => void;
  addUsedMaterial: (
    orderId: string,
    materialId: string,
    quantity: number,
    note?: string
  ) => boolean;
  saveCustomerSignature: (
    orderId: string,
    signature: { signerName: string; signatureDataUrl: string; comments?: string }
  ) => boolean;
  
  // Customer & Material actions
  addCustomer: (customer: Omit<Customer, 'id'>) => string;
  updateCustomer: (customerId: string, patch: Omit<Customer, 'id'>) => void;
  deleteCustomer: (customerId: string) => { success: boolean; message: string };
  addTechnician: (technician: TechnicianInput) => string;
  updateTechnician: (technicianId: string, patch: TechnicianInput) => void;
  deleteTechnician: (technicianId: string) => { success: boolean; message: string };
  updateMaterialStock: (materialId: string, newStock: number) => void;
  addMaterialToInventory: (item: Omit<MaterialInventory, 'id'>) => void;
  updateMaterial: (materialId: string, patch: Omit<MaterialInventory, 'id'>) => void;
  deleteMaterial: (materialId: string) => void;

  // Services CRUD
  addService: (service: ServiceItemInput) => void;
  updateService: (serviceId: string, patch: Partial<ServiceItemInput>) => void;
  deleteService: (serviceId: string) => void;

  // Categorías/subcategorías reales (plan-categorias-subcategorias.md Fase 4)
  createCategory: (input: { name: string; description?: string; icon?: string }) => Promise<void>;
  updateCategory: (id: string, patch: { name?: string; description?: string; icon?: string }) => Promise<void>;
  setCategoryActive: (id: string, isActive: boolean) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  mergeCategory: (sourceId: string, targetId: string) => Promise<void>;
  moveCategory: (id: string, direction: 'up' | 'down') => Promise<void>;
  createSubcategory: (input: { categoryId: string; name: string }) => Promise<CatalogSubcategory | undefined>;
  updateSubcategory: (id: string, patch: { name?: string }) => Promise<void>;
  setSubcategoryActive: (id: string, isActive: boolean) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;
  mergeSubcategory: (sourceId: string, targetId: string) => Promise<void>;
  moveSubcategory: (id: string, direction: 'up' | 'down') => Promise<void>;

  resetDemoData: () => void;
}

// User profiles
export const DEMO_USERS: Record<string, CurrentUserData> = {
  admin: {
    id: 'user-admin',
    name: 'Sebastián Borrego',
    email: 'admin@tecniurbano.com.ar',
    role: 'admin',
    avatarText: 'SB',
  },
  'tech-carlos': {
    id: 'user-tech-carlos',
    name: 'Carlos Méndez',
    email: 'carlos.mendez@tecniurbano.com.ar',
    role: 'technician',
    technicianId: 'tech-carlos',
    avatarText: 'CM',
  },
  'tech-maria': {
    id: 'user-tech-maria',
    name: 'María Rodríguez',
    email: 'maria.rodriguez@tecniurbano.com.ar',
    role: 'technician',
    technicianId: 'tech-maria',
    avatarText: 'MR',
  },
  'cli-julian': {
    id: 'user-cli-julian',
    name: 'Julián Albarracín',
    email: 'julian.albarracin@gmail.com',
    role: 'customer',
    customerId: 'cli-julian',
    avatarText: 'JA',
  },
  'cli-florencia': {
    id: 'user-cli-florencia',
    name: 'Florencia Soria',
    email: 'florencia.soria@hotmail.com',
    role: 'customer',
    customerId: 'cli-florencia',
    avatarText: 'FS',
  },
  'cli-gonzalo': {
    id: 'user-cli-gonzalo',
    name: 'Gonzalo Benítez',
    email: 'gonzalo.benitez@yahoo.com.ar',
    role: 'customer',
    customerId: 'cli-gonzalo',
    avatarText: 'GB',
  },
};

const STORAGE_KEY = 'tecniurbano_app_state_v1';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<ServiceOrder[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_orders`);
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [technicians, setTechnicians] = useState<Technician[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_technicians`);
      return saved ? JSON.parse(saved) : INITIAL_TECHNICIANS;
    } catch {
      return INITIAL_TECHNICIANS;
    }
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_customers`);
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  });

  const [materials, setMaterials] = useState<MaterialInventory[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_materials`);
      return saved ? JSON.parse(saved) : INITIAL_MATERIALS;
    } catch {
      return INITIAL_MATERIALS;
    }
  });

  const [services, setServices] = useState<ServiceItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_services`);
      return saved ? JSON.parse(saved) : INITIAL_SERVICES;
    } catch {
      return INITIAL_SERVICES;
    }
  });

  // Single source of truth for the diagnosis visit deposit (system_settings).
  // 30000 here is only the pre-fetch default, matching the previous hardcoded
  // behavior until the real value loads.
  const [visitDepositAmount, setVisitDepositAmount] = useState(30000);
  const [technicianApplications, setTechnicianApplications] = useState<TechnicianApplication[]>([]);

  // Real Supabase-backed categories/subcategories (plan-categorias-subcategorias.md
  // Fase 4 — replaces the old localStorage-only `serviceCategories`/
  // `addServiceCategory` system). Seeded from the same 8-category mock list as a
  // demo/pre-fetch fallback (mirrors how `services` seeds from INITIAL_SERVICES),
  // then overwritten by the real fetch once Supabase loads. Not persisted to
  // localStorage — comes straight from the DB on every load.
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>(() =>
    INITIAL_SERVICE_CATEGORIES.map((c: ServiceCategory, index) => ({
      id: c.id,
      name: c.name,
      slug: c.id.replace(/^cat-/, ''),
      icon: c.icon,
      description: c.description,
      displayOrder: index + 1,
      active: c.active !== false,
    }))
  );
  const [catalogSubcategories, setCatalogSubcategories] = useState<CatalogSubcategory[]>([]);

  const [currentUser, setCurrentUserState] = useState<CurrentUserData | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authLoading, setAuthLoading] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [remoteBusyCount, setRemoteBusyCount] = useState(0);
  const [usingRemoteData, setUsingRemoteData] = useState(false);

  const [currentPath, setCurrentPath] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || '/';
  });

  const [toast, setToast] = useState<ToastNotification | null>(null);

  const isAuthenticated = Boolean(currentUser);
  const remoteBusy = remoteBusyCount > 0;

  const clearDataError = () => setDataError(null);

  const withRemote = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setRemoteBusyCount((c) => c + 1);
    try {
      return await fn();
    } finally {
      setRemoteBusyCount((c) => Math.max(0, c - 1));
    }
  };

  // Sync demo data to localStorage only when not using remote catalog
  useEffect(() => {
    if (usingRemoteData) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}_orders`, JSON.stringify(orders));
      localStorage.setItem(`${STORAGE_KEY}_technicians`, JSON.stringify(technicians));
      localStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(customers));
      localStorage.setItem(`${STORAGE_KEY}_materials`, JSON.stringify(materials));
      localStorage.setItem(`${STORAGE_KEY}_services`, JSON.stringify(services));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [orders, technicians, customers, materials, services, usingRemoteData]);

  const applyRemoteSession = async (userId: string) => {
    setDataLoading(true);
    setDataError(null);
    try {
      const profile = await fetchProfile(userId);
      if (!profile) {
        throw new Error('No se encontró el perfil en Supabase.');
      }
      const catalog = await fetchCatalog(profile.role === 'admin');
      setTechnicians(catalog.technicians);
      setCustomers(catalog.customers);
      setMaterials(catalog.materials);
      setServices(catalog.services);
      setCatalogCategories(catalog.catalogCategories);
      setCatalogSubcategories(catalog.catalogSubcategories);
      setOrders(catalog.orders);
      setUsingRemoteData(true);
      setCurrentUserState(profileToCurrentUser(profile));
      fetchVisitDepositAmount().then(setVisitDepositAmount).catch(() => {});
      if (profile.role === 'admin') {
        fetchTechnicianApplications().then(setTechnicianApplications).catch(() => {});
      }
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudieron cargar los datos remotos.');
      setDataError(message);
      throw new Error(message);
    } finally {
      setDataLoading(false);
    }
  };

  const clearRemoteSession = () => {
    setCurrentUserState(null);
    setUsingRemoteData(false);
    setDataError(null);
    setDataLoading(false);
    setOrders(INITIAL_ORDERS);
    setTechnicians(INITIAL_TECHNICIANS);
    setCustomers(INITIAL_CUSTOMERS);
    setMaterials(INITIAL_MATERIALS);
    setTechnicianApplications([]);
    void loadPublicServices();
  };

  // Anonymous visitors never authenticate, so they never hit applyRemoteSession
  // below — without this, the Landing / services-category pages would show
  // mockData.ts forever instead of the real Supabase catalog.
  const loadPublicServices = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const publicServices = await fetchPublicServices();
      setServices(publicServices);
    } catch (err) {
      console.warn('[TecniUrbano] No se pudo cargar el catálogo público de servicios', err);
    }
    try {
      const [publicCategories, publicSubcategories] = await Promise.all([
        fetchPublicCatalogCategories(),
        fetchPublicCatalogSubcategories(),
      ]);
      setCatalogCategories(publicCategories);
      setCatalogSubcategories(publicSubcategories);
    } catch (err) {
      console.warn('[TecniUrbano] No se pudo cargar categorías/subcategorías públicas', err);
    }
  };

  const updateVisitDepositAmount = async (amount: number): Promise<void> => {
    if (!usingRemoteData) {
      setVisitDepositAmount(amount);
      showToast('Seña actualizada (modo demo, no persiste en Supabase)', 'info');
      return;
    }
    try {
      await persistUpdateVisitDepositAmount(amount);
      setVisitDepositAmount(amount);
      showToast('Seña de diagnóstico actualizada', 'success', 'Configuración guardada');
    } catch (err) {
      showToast(friendlyErrorMessage(err, 'No se pudo actualizar la seña'), 'error');
      throw err;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      setDataError('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local');
      return;
    }

    let mounted = true;

    void loadPublicServices();

    supabase.auth.getSession().then(async ({ data }) => {
      try {
        if (data.session?.user && mounted) {
          await applyRemoteSession(data.session.user.id);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          // Keep session user-less UI; error banner will show if authenticated path fails
          setCurrentUserState(null);
          setUsingRemoteData(false);
        }
      } finally {
        if (mounted) setAuthReady(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearRemoteSession();
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        // No se llama a applyRemoteSession: esta sesión es solo para elegir
        // una contraseña nueva, no para entrar directo al panel del rol.
        setPasswordRecoveryMode(true);
        return;
      }
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        try {
          await applyRemoteSession(session.user.id);
        } catch (err) {
          console.error(err);
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Refresh operational data immediately when another user changes an order.
  // The database publication is enabled separately in Supabase for these tables.
  useEffect(() => {
    if (!usingRemoteData || !isSupabaseConfigured) return;

    let refreshTimeout: number | undefined;
    const refreshCatalog = () => {
      if (refreshTimeout) window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        void withRemote(async () => {
          const catalog = await fetchCatalog(currentUser?.role === 'admin');
          setTechnicians(catalog.technicians);
          setCustomers(catalog.customers);
          setMaterials(catalog.materials);
          setServices(catalog.services);
          setOrders(catalog.orders);
        }).catch((err) => console.error('[TecniUrbano] Realtime refresh failed', err));
      }, 250);
    };

    const channel = supabase
      .channel('tecniurbano-operational-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_checklist_items' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_time_logs' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_materials_used' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_events' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_signatures' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_quotes' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_quote_items' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_diagnosis_photos' }, refreshCatalog)
      .subscribe();

    return () => {
      if (refreshTimeout) window.clearTimeout(refreshTimeout);
      void supabase.removeChannel(channel);
    };
  }, [usingRemoteData]);

  // Sync with browser hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || '/';
      setCurrentPath(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    // Handle home redirect
    if (path === '/home') {
      if (currentUser?.role === 'admin') path = '/hub';
      else if (currentUser?.role === 'technician') path = '/technician';
      else path = '/customer';
    }
    
    window.location.hash = path;
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    title?: string
  ) => {
    setToast({
      id: Math.random().toString(36).substring(7),
      type,
      title,
      message,
    });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const hideToast = () => setToast(null);

  const refreshRemoteData = async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) {
      setDataError('No hay sesión activa para refrescar.');
      return;
    }
    try {
      await applyRemoteSession(userId);
      showToast('Datos actualizados desde Supabase', 'success', 'Sincronizado');
    } catch (err) {
      showToast(friendlyErrorMessage(err), 'error', 'No se pudo refrescar');
    }
  };

  const setCurrentUser = (user: CurrentUserData) => {
    setCurrentUserState(user);
    showToast(`Sesión cambiada a ${user.name} (${user.role.toUpperCase()})`, 'info', 'Perfil activo');
  };

  const loginAsRole = (role: UserRole, specificId?: string) => {
    let targetUser: CurrentUserData;
    if (role === 'admin') {
      targetUser = DEMO_USERS.admin;
      setCurrentUserState(targetUser);
      setUsingRemoteData(false);
      navigate('/hub');
    } else if (role === 'technician') {
      const key = specificId && DEMO_USERS[specificId] ? specificId : 'tech-carlos';
      targetUser = DEMO_USERS[key];
      setCurrentUserState(targetUser);
      setUsingRemoteData(false);
      navigate('/technician');
    } else {
      const key = specificId && DEMO_USERS[specificId] ? specificId : 'cli-julian';
      targetUser = DEMO_USERS[key];
      setCurrentUserState(targetUser);
      setUsingRemoteData(false);
      navigate('/customer');
    }
    showToast(`Modo demo: ${role}`, 'info', 'Perfil demo');
  };

  const loginWithPassword = async (email: string, password: string) => {
    setAuthLoading(true);
    setDataError(null);
    try {
      const { user } = await signInWithPassword(email.trim().toLowerCase(), password.trim());
      if (!user) throw new Error('No se pudo iniciar sesión.');
      const pendingInvite = sessionStorage.getItem('tecniurbano_pending_invite');
      if (pendingInvite) {
        try {
          await redeemAccountInvite(pendingInvite);
          sessionStorage.removeItem('tecniurbano_pending_invite');
        } catch (inviteErr) {
          console.warn(inviteErr);
        }
      }
      await applyRemoteSession(user.id);
      const profile = await fetchProfile(user.id);
      const role = profile?.role ?? 'customer';
      if (role === 'admin') navigate('/hub');
      else if (role === 'technician') navigate('/technician');
      else navigate('/customer');
      showToast(`Bienvenido/a ${profile?.full_name ?? email}`, 'success', 'Sesión iniciada');
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo iniciar sesión');
      setDataError(message);
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const requestPasswordRecovery = async (email: string) => {
    setAuthLoading(true);
    setDataError(null);
    try {
      await requestPasswordReset(email.trim());
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo enviar el enlace de recuperación');
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const completePasswordRecovery = async (newPassword: string) => {
    setAuthLoading(true);
    setDataError(null);
    try {
      await updatePasswordForRecoverySession(newPassword);
      // Se cierra la sesión de recuperación a propósito: es más simple y más
      // seguro pedirle que inicie sesión de nuevo con la contraseña nueva que
      // intentar reanudar su sesión normal desde acá.
      await signOut();
      setPasswordRecoveryMode(false);
      showToast('Contraseña actualizada. Iniciá sesión con tu nueva contraseña.', 'success');
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo actualizar la contraseña');
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const registerWithInvite = async (input: { token: string; password: string }) => {
    setAuthLoading(true);
    setDataError(null);
    try {
      const { data, error } = await supabase.rpc('get_account_invite', { p_token: input.token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('El enlace de invitación no es válido.');
      if (row.already_used) throw new Error('Esta invitación ya fue utilizada.');
      if (new Date(row.expires_at).getTime() < Date.now()) {
        throw new Error('Esta invitación venció. Pedile una nueva al administrador.');
      }

      const signed = await signUpWithPassword({
        email: String(row.email),
        password: input.password,
        fullName: String(row.full_name),
      });
      const user = signed.user;
      const session = signed.session;
      if (!user) throw new Error('No se pudo crear la cuenta.');

      if (!session) {
        sessionStorage.setItem('tecniurbano_pending_invite', input.token);
        showToast(
          'Revisá tu email para confirmar la cuenta. Después ingresá y se vinculará tu ficha.',
          'info',
          'Confirmá el correo'
        );
        return;
      }

      await redeemAccountInvite(input.token);
      await applyRemoteSession(user.id);
      const profile = await fetchProfile(user.id);
      const role = profile?.role ?? 'customer';
      if (role === 'admin') navigate('/hub');
      else if (role === 'technician') navigate('/technician');
      else navigate('/customer');
      showToast(`Cuenta creada. Bienvenido/a ${profile?.full_name ?? row.full_name}`, 'success', 'Listo');
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo crear la cuenta');
      setDataError(message);
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const registerCustomer = async (input: CustomerRegistrationInput) => {
    setAuthLoading(true);
    setDataError(null);
    try {
      const signed = await signUpWithPassword({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
      });
      const user = signed.user;
      const session = signed.session;
      if (!user) throw new Error('No se pudo crear la cuenta.');

      if (!session) {
        showToast(
          'Revisá tu email para confirmar la cuenta. Después ingresá y completá tu perfil.',
          'info',
          'Confirmá el correo'
        );
        return;
      }

      await persistCreateCustomerSelf(user.id, input);
      await applyRemoteSession(user.id);
      navigate('/customer');
      showToast(`Cuenta creada. Bienvenido/a ${input.fullName}`, 'success', 'Listo');
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo crear la cuenta');
      setDataError(message);
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const registerTechnician = async (input: TechnicianRegistrationInput) => {
    setAuthLoading(true);
    setDataError(null);
    try {
      const signed = await signUpWithPassword({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
      });
      const user = signed.user;
      const session = signed.session;
      if (!user) throw new Error('No se pudo crear la cuenta.');

      if (!session) {
        showToast(
          'Revisá tu email para confirmar la cuenta. Después ingresá y completá tu perfil profesional.',
          'info',
          'Confirmá el correo'
        );
        return;
      }

      await persistSelfRegisterTechnician(input);
      await applyRemoteSession(user.id);
      navigate('/technician');
      showToast(`Cuenta creada. Bienvenido/a ${input.fullName}`, 'success', 'Listo');
    } catch (err) {
      const message = friendlyErrorMessage(err, 'No se pudo crear la cuenta');
      setDataError(message);
      throw new Error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const createAccountInviteLink = async (kind: 'technician' | 'customer', targetId: string) => {
    const record =
      kind === 'technician'
        ? technicians.find((t) => t.id === targetId)
        : customers.find((c) => c.id === targetId);
    if (!record) throw new Error('No se encontró el registro.');
    if (record.profileId) throw new Error('Esta persona ya tiene una cuenta vinculada.');
    if (!record.email.trim()) throw new Error('Completá el email antes de generar el enlace.');

    return withRemote(() =>
      persistCreateAccountInvite({
        kind,
        targetId,
        email: record.email,
        fullName: record.name,
      })
    );
  };

  const logout = async () => {
    setAuthLoading(true);
    try {
      if (isSupabaseConfigured) {
        await signOut();
      }
      clearRemoteSession();
      navigate('/auth');
      showToast('Sesión cerrada', 'info');
    } finally {
      setAuthLoading(false);
    }
  };

  const resetDemoData = () => {
    setOrders(INITIAL_ORDERS);
    setTechnicians(INITIAL_TECHNICIANS);
    setCustomers(INITIAL_CUSTOMERS);
    setMaterials(INITIAL_MATERIALS);
    setServices(INITIAL_SERVICES);
    setCurrentUserState(DEMO_USERS.admin);
    try {
      localStorage.removeItem(`${STORAGE_KEY}_orders`);
      localStorage.removeItem(`${STORAGE_KEY}_technicians`);
      localStorage.removeItem(`${STORAGE_KEY}_customers`);
      localStorage.removeItem(`${STORAGE_KEY}_materials`);
      localStorage.removeItem(`${STORAGE_KEY}_services`);
      localStorage.removeItem(`${STORAGE_KEY}_serviceCategories`);
      localStorage.removeItem(`${STORAGE_KEY}_user`);
    } catch {}
    showToast('Datos demo restablecidos a su estado original.', 'success', 'Reinicio exitoso');
  };

  const formatNow = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  };

  const formatTimeOnly = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // State Transition Engine with Business Rules
  const updateOrderStatus = (
    orderId: string,
    newStatus: OrderStatus,
    reason?: string
  ): { success: boolean; message: string } => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Orden no encontrada.' };
    }

    const currentStatus = order.status;

    // No-op if same status, except legacy in-progress orders that do not yet
    // have the persistent timer start timestamp.
    const needsTimerRecovery =
      currentStatus === 'in_progress' && newStatus === 'in_progress' && !order.workStartedAt;
    if (currentStatus === newStatus && !needsTimerRecovery) {
      return { success: true, message: `La orden ya está en estado ${newStatus}.` };
    }

    // Rules validation:
    // Permitted:
    // - assigned -> in_progress
    // - in_progress -> paused
    // - paused -> in_progress
    // - in_progress -> completed (Strict requirements!)
    // - assigned -> cancelled
    // - in_progress -> cancelled (admin emergency override)

    // Cannot modify completed order
    if (currentStatus === 'completed') {
      const msg = 'Esta orden ya fue completada y cerrada. No se permiten más modificaciones.';
      showToast(msg, 'error', 'Transición bloqueada');
      return { success: false, message: msg };
    }

    if (currentStatus === 'cancelled') {
      const msg = 'La orden se encuentra cancelada y no puede reactivarse directamente.';
      showToast(msg, 'error', 'Transición bloqueada');
      return { success: false, message: msg };
    }

    if (newStatus === 'in_progress' && !isOrderPaymentSettled(order)) {
      const msg = order.workMode === 'diagnosis'
        ? 'El cronómetro se habilita cuando se confirme el pago de la seña.'
        : 'El cronómetro se habilita cuando se confirme el pago completo.';
      showToast(msg, 'warning', 'Pago pendiente');
      return { success: false, message: msg };
    }

    // Validate specific transitions:
    if (currentStatus === 'assigned' && newStatus !== 'in_progress' && newStatus !== 'cancelled') {
      const msg = `Una orden asignada debe iniciarse primero (in_progress) antes de cambiar a ${newStatus}.`;
      showToast(msg, 'warning', 'Paso requerido');
      return { success: false, message: msg };
    }

    if (currentStatus === 'paused' && newStatus !== 'in_progress') {
      const msg = `Una orden pausada debe reanudarse a 'in_progress' antes de finalizarse.`;
      showToast(msg, 'warning', 'Transición inválida');
      return { success: false, message: msg };
    }

    // STRICT COMPLETION REQUIREMENTS
    if (newStatus === 'completed') {
      const runningSeconds = order.workStartedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(order.workStartedAt).getTime()) / 1000))
        : 0;
      const hasTimeLog = order.timeLogs.length > 0 || (order.workElapsedSeconds ?? 0) + runningSeconds > 0;
      const allChecklistDone =
        order.checklist.length > 0 && order.checklist.every((item) => item.completed);
      const hasSignature = !!order.customerSignature?.signatureDataUrl;

      const missing: string[] = [];
      if (!hasTimeLog) missing.push('Al menos un registro de tiempo de trabajo');
      if (!allChecklistDone) missing.push('Completar todos los ítems del checklist');
      if (!hasSignature) missing.push('Firma digital de conformidad del cliente');

      if (missing.length > 0) {
        const msg = `Condiciones obligatorias pendientes:\n• ${missing.join('\n• ')}`;
        showToast(msg, 'error', 'No se puede finalizar el servicio');
        return { success: false, message: msg };
      }
    }

    // Perform transition
    let eventType: OrderEventType = 'started';
    let eventDescription = `Estado cambiado a ${newStatus}`;

    if (newStatus === 'in_progress') {
      if (needsTimerRecovery) {
        eventType = 'started';
        eventDescription = 'Cronómetro de trabajo sincronizado para una orden en curso.';
      } else if (currentStatus === 'paused') {
        eventType = 'resumed';
        eventDescription = 'Trabajo en campo reanudado por el técnico.';
      } else {
        eventType = 'started';
        eventDescription = 'Trabajo en campo iniciado por el técnico.';
      }
    } else if (newStatus === 'paused') {
      eventType = 'paused';
      eventDescription = `Trabajo pausado. Motivo: ${reason || 'En espera de insumos/acceso'}.`;
    } else if (newStatus === 'completed') {
      eventType = 'completed';
      eventDescription = 'Servicio técnico finalizado y cerrado con éxito tras firma de cliente.';
    } else if (newStatus === 'cancelled') {
      eventType = 'cancelled';
      eventDescription = `Orden cancelada. Motivo: ${reason || 'Cancelación solicitada'}.`;
    }

    const newEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: eventType,
      description: eventDescription,
      timestamp: formatNow(),
      author: currentUser?.name ?? 'Sistema',
    };

    const transitionAt = new Date();
    const transitionAtIso = transitionAt.toISOString();
    const elapsedAtTransition = order.workStartedAt
      ? Math.max(0, Math.floor((transitionAt.getTime() - new Date(order.workStartedAt).getTime()) / 1000))
      : 0;
    let nextWorkStartedAt = order.workStartedAt;
    let nextWorkElapsedSeconds = order.workElapsedSeconds ?? 0;

    if (newStatus === 'in_progress') {
      nextWorkStartedAt = transitionAtIso;
    } else if (newStatus === 'paused' || newStatus === 'completed' || newStatus === 'cancelled') {
      nextWorkElapsedSeconds += elapsedAtTransition;
      nextWorkStartedAt = undefined;
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            status: newStatus,
            completedAt: newStatus === 'completed' ? formatNow() : o.completedAt,
            workStartedAt: nextWorkStartedAt,
            workElapsedSeconds: nextWorkElapsedSeconds,
            pauseReason: newStatus === 'paused' ? reason ?? undefined : undefined,
            events: [newEvent, ...o.events],
          };
        }
        return o;
      })
    );

    if (usingRemoteData) {
      void withRemote(() =>
        persistUpdateOrderStatus({
          orderId,
          status: newStatus,
          eventType,
          eventDescription,
          author: currentUser?.name ?? 'Sistema',
          completedAt: newStatus === 'completed' ? transitionAtIso : null,
          workStartedAt: nextWorkStartedAt ?? null,
          workElapsedSeconds: nextWorkElapsedSeconds,
          pauseReason: newStatus === 'paused' ? reason ?? null : null,
        })
      ).catch((err) => {
        showToast(friendlyErrorMessage(err, 'Error al guardar estado'), 'error');
      });
    }

    const successMsg = `Orden ${order.id} actualizada a: ${newStatus.toUpperCase()}`;
    showToast(successMsg, 'success', 'Estado actualizado');
    return { success: true, message: successMsg };
  };

  const assignTechnician = (orderId: string, technicianId: string) => {
    // ✓ SECURITY: Only admin can assign technicians
    try {
      validateTechnicianAssignmentAccess(currentUser);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return;
    }

    const tech = technicians.find((t) => t.id === technicianId);
    if (!tech) return;
    if (usingRemoteData && (tech.validationStatus !== 'approved' || !tech.canReceiveOrders)) {
      showToast('Este técnico todavía no está habilitado para recibir órdenes.', 'warning', 'Validación pendiente');
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (order && orderRequiresPaymentGate(order) && !isOrderPaymentSettled(order)) {
      showToast(
        order.workMode === 'direct'
          ? 'Esta orden es de precio fijo y el cliente todavía no completó el pago. No se puede asignar un técnico hasta que el cobro se confirme.'
          : 'El cliente todavía no pagó la seña de la visita de diagnóstico. No se puede asignar un técnico hasta que el cobro se confirme.',
        'warning',
        order.workMode === 'direct' ? 'Pago pendiente' : 'Seña pendiente'
      );
      return;
    }

    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'reassigned' as OrderEventType,
      description: `Orden reasignada al técnico ${tech.name}.`,
      timestamp: formatNow(),
      author: currentUser?.name ?? 'Sistema',
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            assignedTechnicianId: tech.id,
            assignedTechnicianName: tech.name,
            events: [newEvent, ...o.events],
          };
        }
        return o;
      })
    );

    if (usingRemoteData) {
      void withRemote(() =>
        persistAssignTechnician({
          orderId,
          technicianId: tech.id,
          technicianName: tech.name,
          author: currentUser?.name ?? 'Sistema',
        })
      ).catch((err) => {
        showToast(friendlyErrorMessage(err, 'Error al asignar técnico'), 'error');
      });
    }

    showToast(`Orden ${orderId} asignada a ${tech.name}`, 'success', 'Asignación realizada');
  };

  const toggleChecklistItem = (orderId: string, itemId: string) => {
    // ✓ SECURITY: Validate order access (admin or assigned technician)
    const order = orders.find((o) => o.id === orderId);
    try {
      validateOrderModificationAccess(currentUser, order);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return;
    }

    if (order?.status === 'completed') {
      showToast('No se puede modificar una orden completada.', 'warning');
      return;
    }

    const current = order?.checklist.find((i) => i.id === itemId);
    const nextVal = current ? !current.completed : true;

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updatedChecklist = o.checklist.map((item) => {
            if (item.id === itemId) {
              return {
                ...item,
                completed: nextVal,
                completedAt: nextVal ? formatTimeOnly() : undefined,
              };
            }
            return item;
          });

          return {
            ...o,
            checklist: updatedChecklist,
          };
        }
        return o;
      })
    );

    if (usingRemoteData) {
      void withRemote(() => persistToggleChecklistItem(itemId, nextVal)).catch((err) => {
        showToast(friendlyErrorMessage(err, 'Error al actualizar checklist'), 'error');
      });
    }
  };

  const addChecklistItem = (orderId: string, label: string) => {
    // ✓ SECURITY: Validate order access
    const order = orders.find((o) => o.id === orderId);
    try {
      validateOrderModificationAccess(currentUser, order);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return;
    }

    if (!label.trim()) return;
    const trimmed = label.trim();
    const newItem = {
      id: `chk-${Date.now()}`,
      label: trimmed,
      completed: false,
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            checklist: [...o.checklist, newItem],
          };
        }
        return o;
      })
    );

    if (usingRemoteData) {
      void withRemote(() => persistAddChecklistItem(orderId, trimmed))
        .then((row) => {
          if (!row) return;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    checklist: o.checklist.map((item) =>
                      item.id === newItem.id ? { ...item, id: row.id as string } : item
                    ),
                  }
                : o
            )
          );
        })
        .catch((err) => {
          showToast(friendlyErrorMessage(err, 'Error al agregar ítem'), 'error');
        });
    }
    showToast('Tarea añadida al checklist', 'info');
  };

  /** El técnico acepta o rechaza una asignación ofrecida a su propia cuenta.
   * Un rechazo puede reasignar la orden a otro técnico (o devolverla a la
   * bandeja del admin) del lado del servidor — se refresca todo en vez de
   * intentar predecir el resultado en el estado local. */
  const respondToAssignment = async (orderId: string, response: 'accepted' | 'rejected') => {
    try {
      requireTechnician(currentUser);
    } catch (err) {
      showToast(err instanceof SecurityError ? err.message : 'No autorizado', 'error', 'Seguridad');
      return;
    }
    if (!usingRemoteData) return;
    try {
      await persistRespondToAssignment(orderId, response);
      await refreshRemoteData();
      showToast(
        response === 'accepted' ? 'Asignación aceptada.' : 'Asignación rechazada — se ofrece al siguiente técnico disponible.',
        response === 'accepted' ? 'success' : 'info'
      );
    } catch (err) {
      showToast(friendlyErrorMessage(err, 'No se pudo registrar la respuesta'), 'error');
    }
  };

  const addTimeLog = (orderId: string, minutes: number, note: string) => {
    // ✓ SECURITY: Validate order access
    const order = orders.find((o) => o.id === orderId);
    try {
      validateOrderModificationAccess(currentUser, order);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return;
    }

    if (order?.status === 'completed') {
      showToast('No se pueden cargar tiempos a una orden cerrada.', 'warning');
      return;
    }

    const newLog = {
      id: `time-${Date.now()}`,
      minutes,
      note: note.trim() || 'Trabajo técnico en sitio',
      timestamp: formatTimeOnly(),
      technicianName: currentUser?.name ?? 'Técnico',
    };

    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'time_logged' as OrderEventType,
      description: `Registro de tiempo: ${minutes} minutos (${note || 'Labor en sitio'}).`,
      timestamp: formatNow(),
      author: currentUser?.name ?? 'Sistema',
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            timeLogs: [newLog, ...o.timeLogs],
            events: [newEvent, ...o.events],
          };
        }
        return o;
      })
    );

    if (usingRemoteData) {
      void withRemote(() =>
        persistAddTimeLog({
          orderId,
          minutes,
          note: newLog.note,
          technicianName: newLog.technicianName,
          author: currentUser?.name ?? 'Sistema',
        })
      ).catch((err) => {
        showToast(friendlyErrorMessage(err, 'Error al guardar tiempo'), 'error');
      });
    }

    showToast(`Se registraron ${minutes} minutos de trabajo`, 'success', 'Tiempo guardado');
  };

  const addTechnicalNote = (orderId: string, text: string) => {
    // ✓ SECURITY: Validate order access
    const order = orders.find((o) => o.id === orderId);
    try {
      validateOrderModificationAccess(currentUser, order);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return;
    }

    if (!text.trim()) return;
    if (order?.status === 'completed') {
      showToast('No se pueden añadir notas a una orden cerrada.', 'warning');
      return;
    }

    const newNote = {
      id: `note-${Date.now()}`,
      text: text.trim(),
      author: `${currentUser?.name ?? 'Usuario'} (${currentUser?.role === 'technician' ? 'Técnico' : 'Admin'})`,
      timestamp: formatTimeOnly(),
    };

    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'note_added' as OrderEventType,
      description: `Nota agregada: "${text.substring(0, 45)}${text.length > 45 ? '...' : ''}"`,
      timestamp: formatNow(),
      author: currentUser?.name ?? 'Sistema',
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            technicalNotes: [newNote, ...o.technicalNotes],
            events: [newEvent, ...o.events],
          };
        }
        return o;
      })
    );

    if (usingRemoteData) {
      void withRemote(() =>
        persistAddNote({
          orderId,
          text: newNote.text,
          author: newNote.author,
        })
      ).catch((err) => {
        showToast(friendlyErrorMessage(err, 'Error al guardar nota'), 'error');
      });
    }

    showToast('Nota técnica guardada', 'info');
  };

  const addUsedMaterial = (
    orderId: string,
    materialId: string,
    quantity: number,
    note?: string
  ): boolean => {
    // ✓ SECURITY: Validate order access (admin or assigned technician)
    const order = orders.find((o) => o.id === orderId);
    try {
      validateOrderModificationAccess(currentUser, order);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return false;
    }

    if (order?.status === 'completed') {
      showToast('La orden está cerrada; no se pueden sumar materiales.', 'warning');
      return false;
    }

    const mat = materials.find((m) => m.id === materialId);
    if (!mat) {
      showToast('Material no encontrado en inventario.', 'error');
      return false;
    }

    if (quantity <= 0) {
      showToast('La cantidad debe ser mayor a cero.', 'warning');
      return false;
    }

    const newUsedItem = {
      id: `umat-${Date.now()}`,
      materialId: mat.id,
      materialName: mat.name,
      quantity,
      unit: mat.unit,
      note: note?.trim(),
      addedAt: formatTimeOnly(),
    };

    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'material_added' as OrderEventType,
      description: `Material cargado: ${quantity} ${mat.unit} de ${mat.name}.`,
      timestamp: formatNow(),
      author: currentUser?.name ?? 'Sistema',
    };

    // Deduct from stock if available
    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, stock: Math.max(0, m.stock - quantity) } : m))
    );

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            usedMaterials: [...o.usedMaterials, newUsedItem],
            events: [newEvent, ...o.events],
          };
        }
        return o;
      })
    );

    if (usingRemoteData) {
      void withRemote(() =>
        persistAddUsedMaterial({
          orderId,
          materialId: mat.id,
          materialName: mat.name,
          quantity,
          unit: mat.unit,
          note: note?.trim(),
          author: currentUser?.name ?? 'Sistema',
        })
      )
        .then(() => {
          showToast(`Material registrado: ${quantity} ${mat.unit} de ${mat.name}`, 'success', 'Inventario descontado');
        })
        .catch((err) => {
          // El guardado remoto es la única fuente de verdad del stock — si
          // falla, revertir el descuento optimista para no dejar la pantalla
          // mostrando un número que la base nunca tuvo.
          setMaterials((prev) => prev.map((m) => (m.id === materialId ? { ...m, stock: mat.stock } : m)));
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    usedMaterials: o.usedMaterials.filter((u) => u.id !== newUsedItem.id),
                    events: o.events.filter((e) => e.id !== newEvent.id),
                  }
                : o
            )
          );
          showToast(friendlyErrorMessage(err, 'Error al registrar material'), 'error');
        });
      return true;
    }

    showToast(`Material registrado: ${quantity} ${mat.unit} de ${mat.name}`, 'success', 'Inventario descontado');
    return true;
  };

  const saveCustomerSignature = (
    orderId: string,
    signature: { signerName: string; signatureDataUrl: string; comments?: string }
  ): boolean => {
    // ✓ SECURITY: Validate customer can sign their own orders
    const order = orders.find((o) => o.id === orderId);
    try {
      validateOrderId(orderId);
      validateCustomerSignatureAccess(currentUser, order);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return false;
    }

    if (!signature.signerName.trim() || !signature.signatureDataUrl) {
      showToast('Debe ingresar el nombre del firmante y trazar la firma.', 'warning');
      return false;
    }

    if (order.customerSignature?.signatureDataUrl) {
      showToast('Esta orden ya cuenta con una firma de conformidad registrada.', 'warning');
      return false;
    }

    const signedAt = formatNow();
    const signatureObj = {
      signerName: signature.signerName.trim(),
      signatureDataUrl: signature.signatureDataUrl,
      signedAt,
      comments: signature.comments?.trim(),
    };

    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'signed' as OrderEventType,
      description: `Firma digital capturada y conformidad otorgada por ${signature.signerName}.`,
      timestamp: signedAt,
      author: `${signature.signerName} (Cliente)`,
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            customerSignature: signatureObj,
            events: [newEvent, ...o.events],
          };
        }
        return o;
      })
    );

    if (usingRemoteData) {
      void withRemote(() =>
        persistSignature({
          orderId,
          signerName: signatureObj.signerName,
          signatureDataUrl: signatureObj.signatureDataUrl,
          comments: signatureObj.comments,
          author: signatureObj.signerName,
        })
      ).catch((err) => {
        showToast(friendlyErrorMessage(err, 'Error al guardar firma'), 'error');
      });
    }

    showToast(`Firma de conformidad guardada con éxito`, 'success', 'Firma registrada');
    return true;
  };

  const updateOrder = (
    orderId: string,
    patch: {
      title: string;
      description: string;
      serviceType: ServiceType;
      priority: OrderPriority;
      clientId: string;
      assignedTechnicianId?: string | null;
      scheduledDate: string;
    }
  ) => {
    // ✓ SECURITY: Only admin can update orders
    try {
      validateOrderCreationAccess(currentUser);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return;
    }

    const client = customers.find((c) => c.id === patch.clientId);
    if (!client) {
      showToast('Cliente no encontrado.', 'error');
      return;
    }
    const tech = patch.assignedTechnicianId
      ? technicians.find((t) => t.id === patch.assignedTechnicianId) ?? null
      : null;

    const applyLocal = () => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                title: patch.title,
                description: patch.description,
                serviceType: patch.serviceType,
                priority: patch.priority,
                scheduledDate: patch.scheduledDate,
                clientId: client.id,
                clientName: client.name,
                clientPhone: client.phone,
                clientAddress: client.address,
                clientNeighborhood: client.neighborhood,
                assignedTechnicianId: tech?.id ?? null,
                assignedTechnicianName: tech?.name ?? null,
              }
            : o
        )
      );
    };

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          const updated = await persistUpdateOrder({
            orderId,
            title: patch.title,
            description: patch.description,
            serviceType: patch.serviceType,
            priority: patch.priority,
            scheduledDate: patch.scheduledDate,
            customer: client,
            technician: tech ? { id: tech.id, name: tech.name } : null,
            author: currentUser?.name ?? 'Admin',
          });
          setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
          showToast('Orden actualizada en Supabase', 'success', 'Cambios guardados');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar la orden'), 'error');
        }
      });
      applyLocal();
      return;
    }

    applyLocal();
    showToast('Orden actualizada', 'success');
  };

  /** Customer-facing: lets a customer remove their OWN cancelled orders from
   * "Mis Servicios a Domicilio" — never a real delete. Only sets
   * hidden_from_customer_at (via hide_own_cancelled_order, SECURITY DEFINER)
   * so the row stays fully intact and auditable for admin. The RPC
   * re-validates the same two conditions server-side; these checks are
   * defense in depth. */
  const deleteCustomerOrder = (orderId: string) => {
    try {
      requireCustomer(currentUser);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (!order || order.clientId !== currentUser?.customerId) {
      showToast('No encontramos esa orden en tu cuenta.', 'error');
      return;
    }
    if (order.status !== 'cancelled') {
      showToast('Solo se pueden ocultar órdenes canceladas.', 'warning');
      return;
    }

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          await persistHideOwnOrder(orderId);
          setOrders((prev) => prev.filter((o) => o.id !== orderId));
          showToast('Orden quitada de tu lista', 'success');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo quitar la orden'), 'error');
        }
      });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      return;
    }

    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    showToast('Orden quitada de tu lista', 'success');
  };

  const adminOrderAction = (orderId: string, reason: string, action: 'cancel' | 'incident' | 'resolve_incident' | 'exceptional_close', pauseSettlements = false) => {
    try {
      requireAdmin(currentUser);
      validateOrderId(orderId);
    } catch (err) {
      showToast(err instanceof SecurityError ? err.message : 'No autorizado', 'error', 'Seguridad');
      return;
    }
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    const cleanedReason = reason.trim();
    if (action !== 'resolve_incident' && cleanedReason.length < 8) {
      showToast('Ingresá un motivo de al menos 8 caracteres.', 'warning', 'Motivo requerido');
      return;
    }
    if ((action === 'cancel' || action === 'exceptional_close') && ['completed', 'cancelled'].includes(order.status)) {
      showToast('Esta acción no está disponible para una orden cerrada o cancelada.', 'warning');
      return;
    }
    const now = new Date();
    const elapsed = (order.workElapsedSeconds ?? 0) + (order.workStartedAt ? Math.max(0, Math.floor((now.getTime() - new Date(order.workStartedAt).getTime()) / 1000)) : 0);
    const event = {
      id: `ev-admin-${Date.now()}`,
      type: (action === 'cancel' ? 'cancelled' : action === 'exceptional_close' ? 'completed' : 'note_added') as OrderEventType,
      description: action === 'cancel'
        ? `Cancelación administrativa. Motivo: ${cleanedReason}`
        : action === 'exceptional_close'
          ? `Cierre excepcional realizado por administración. Motivo: ${cleanedReason}`
          : action === 'incident'
            ? `Incidencia abierta por administración${pauseSettlements ? ' y liquidación puesta en revisión' : ''}. Motivo: ${cleanedReason}`
            : 'Incidencia resuelta por administración. Las liquidaciones retenidas requieren revisión administrativa antes de liberarse.',
      timestamp: now.toISOString(), author: currentUser?.name ?? 'Administración',
    };
    setOrders((previous) => previous.map((item) => item.id !== orderId ? item : {
      ...item,
      status: action === 'cancel' ? 'cancelled' : action === 'exceptional_close' ? 'completed' : item.status,
      completedAt: action === 'exceptional_close' ? now.toISOString() : item.completedAt,
      workStartedAt: action === 'cancel' || action === 'exceptional_close' ? undefined : item.workStartedAt,
      workElapsedSeconds: action === 'cancel' || action === 'exceptional_close' ? elapsed : item.workElapsedSeconds,
      cancellationReason: action === 'cancel' ? cleanedReason : item.cancellationReason,
      cancelledAt: action === 'cancel' ? now.toISOString() : item.cancelledAt,
      adminIncidentStatus: action === 'incident' ? 'open' : action === 'resolve_incident' ? 'resolved' : item.adminIncidentStatus,
      adminIncidentReason: action === 'incident' ? cleanedReason : item.adminIncidentReason,
      adminIncidentOpenedAt: action === 'incident' ? now.toISOString() : item.adminIncidentOpenedAt,
      adminIncidentResolvedAt: action === 'resolve_incident' ? now.toISOString() : item.adminIncidentResolvedAt,
      adminExceptionReason: action === 'exceptional_close' ? cleanedReason : item.adminExceptionReason,
      adminExceptionClosedAt: action === 'exceptional_close' ? now.toISOString() : item.adminExceptionClosedAt,
      events: [event, ...item.events],
    }));
    if (usingRemoteData) {
      void withRemote(async () => {
        const common = { orderId, author: currentUser?.name ?? 'Administración', actorProfileId: currentUser?.id };
        if (action === 'cancel') await persistAdminCancelOrder({ ...common, reason: cleanedReason, workElapsedSeconds: elapsed });
        if (action === 'incident') await persistAdminIncident({ ...common, reason: cleanedReason, pauseSettlements });
        if (action === 'resolve_incident') await persistResolveAdminIncident(common);
        if (action === 'exceptional_close') await persistAdminExceptionalClose({ ...common, reason: cleanedReason, workElapsedSeconds: elapsed });
      }).catch((err) => showToast(friendlyErrorMessage(err, 'No se pudo guardar la acción administrativa'), 'error'));
    }
    showToast(
      action === 'cancel' ? 'Orden cancelada y novedad registrada para cliente y técnico.'
        : action === 'incident' ? 'Incidencia registrada. Cliente y técnico la verán en la orden.'
          : action === 'resolve_incident' ? 'Incidencia marcada como resuelta.' : 'Orden cerrada excepcionalmente con motivo registrado.',
      'success', 'Acción administrativa'
    );
  };

  const cancelOrderAsAdmin = (orderId: string, reason: string) => adminOrderAction(orderId, reason, 'cancel');
  const reportOrderIncident = (orderId: string, reason: string, pauseSettlements: boolean) => adminOrderAction(orderId, reason, 'incident', pauseSettlements);
  const resolveOrderIncident = (orderId: string) => adminOrderAction(orderId, '', 'resolve_incident');
  const closeOrderExceptionally = (orderId: string, reason: string) => adminOrderAction(orderId, reason, 'exceptional_close');

  const createOrder = (data: {
    title: string;
    description: string;
    serviceType: ServiceType;
    priority: OrderPriority;
    clientId: string;
    assignedTechnicianId?: string;
    scheduledDate: string;
    customChecklist?: string[];
  }): string => {
    // ✓ SECURITY: Only admin can create orders
    try {
      validateOrderCreationAccess(currentUser);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      throw err;
    }

    const client = customers.find((c) => c.id === data.clientId) || customers[0];
    const tech = technicians.find((t) => t.id === data.assignedTechnicianId);

    // Keep local mode aligned with Supabase, which generates UUID primary keys.
    const newId = crypto.randomUUID();
    const nowStr = formatNow();

    const defaultChecklists: Record<ServiceType, string[]> = {
      Plomería: [
        'Corte preventivo y verificación de presión',
        'Desarme de piezas defectuosas',
        'Colocación de repuestos y sellado',
        'Prueba de estanqueidad bajo presión',
      ],
      Electricidad: [
        'Desconexión segura de tensión en tablero',
        'Inspección y medición con multímetro',
        'Reparación / reemplazo de circuitos o módulos',
        'Prueba de consumo y restablecimiento de carga',
      ],
      'Reparaciones del hogar': [
        'Inspección de estructura y materiales requeridos',
        'Ajuste, fijación y reparación mecánica',
        'Limpieza y terminación prolija',
      ],
      'Mantenimiento general': [
        'Revisión integral según protocolo TecniUrbano',
        'Limpieza, lubricación y reemplazo de juntas/filtros',
        'Comprobación de rendimiento operativo',
      ],
      'Instalación de equipos': [
        'Nivelación y trazado de anclajes',
        'Fijación estructural reforzada',
        'Conexión eléctrica/hidráulica según manual de fabricante',
        'Puesta en marcha y prueba de funcionamiento frente al cliente',
      ],
    };

    const checklistLabels =
      data.customChecklist && data.customChecklist.length > 0
        ? data.customChecklist
        : defaultChecklists[data.serviceType] || ['Inspección inicial', 'Ejecución del trabajo', 'Prueba final'];

    if (usingRemoteData) {
      const tempId = `tmp-${Date.now()}`;
      void withRemote(async () => {
        try {
          const created = await persistCreateOrder({
            title: data.title,
            description: data.description,
            serviceType: data.serviceType,
            priority: data.priority,
            scheduledDate: data.scheduledDate || new Date().toISOString().slice(0, 10),
            customer: client,
            technician: tech ? { id: tech.id, name: tech.name } : null,
            checklistLabels,
            author: currentUser?.name ?? 'Sistema',
          });
          setOrders((prev) => [created, ...prev.filter((o) => o.id !== tempId)]);
          showToast(`Orden creada en Supabase`, 'success', 'Nueva orden');
        } catch (err) {
          const message = friendlyErrorMessage(err, 'No se pudo crear la orden');
          showToast(message, 'error', 'Error al crear orden');
        }
      });
      return tempId;
    }

    const newOrder: ServiceOrder = {
      id: newId,
      title: data.title,
      description: data.description,
      serviceType: data.serviceType,
      priority: data.priority,
      status: 'assigned',
      scheduledDate: data.scheduledDate || 'Hoy, a convenir',
      createdAt: nowStr,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientAddress: client.address,
      clientNeighborhood: client.neighborhood,
      assignedTechnicianId: tech ? tech.id : null,
      assignedTechnicianName: tech ? tech.name : null,
      checklist: checklistLabels.map((lbl, idx) => ({
        id: `chk-init-${idx}`,
        label: lbl,
        completed: false,
      })),
      timeLogs: [],
      technicalNotes: [],
      usedMaterials: [],
      customerSignature: null,
      events: [
        {
          id: `ev-create-${Date.now()}`,
          type: 'assigned',
          description: tech
            ? `Orden creada y asignada a ${tech.name}.`
            : `Orden creada en espera de asignación de técnico.`,
          timestamp: nowStr,
          author: currentUser?.name ?? 'Sistema',
        },
      ],
    };

    setOrders((prev) => [newOrder, ...prev]);
    showToast(`Orden ${newId} generada exitosamente`, 'success', 'Nueva orden creada');
    return newId;
  };

  const addCustomer = (data: Omit<Customer, 'id'>): string => {
    if (usingRemoteData) {
      const tempId = `tmp-cli-${Date.now()}`;
      const tempCustomer: Customer = { id: tempId, ...data };
      setCustomers((prev) => [...prev, tempCustomer]);
      void withRemote(async () => {
        try {
          const created = await persistCreateCustomer(data);
          setCustomers((prev) => [...prev.filter((c) => c.id !== tempId), created]);
          showToast(`Cliente ${data.name} guardado en Supabase`, 'success');
        } catch (err) {
          setCustomers((prev) => prev.filter((c) => c.id !== tempId));
          showToast(friendlyErrorMessage(err, 'Error al crear cliente'), 'error');
        }
      });
      return tempId;
    }

    const newId = `cli-${Math.random().toString(36).substring(2, 7)}`;
    const newCli: Customer = {
      id: newId,
      ...data,
    };
    setCustomers((prev) => [...prev, newCli]);
    showToast(`Cliente ${data.name} registrado en TecniUrbano`, 'success');
    return newId;
  };

  const updateCustomer = (customerId: string, patch: Omit<Customer, 'id'>) => {
    const applyLocal = () => {
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { id: customerId, ...patch } : c))
      );
      setOrders((prev) =>
        prev.map((o) =>
          o.clientId === customerId
            ? {
                ...o,
                clientName: patch.name,
                clientPhone: patch.phone,
                clientAddress: patch.address,
                clientNeighborhood: patch.neighborhood,
              }
            : o
        )
      );
    };

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          const updated = await persistUpdateCustomer(customerId, patch);
          setCustomers((prev) => prev.map((c) => (c.id === customerId ? updated : c)));
          setOrders((prev) =>
            prev.map((o) =>
              o.clientId === customerId
                ? {
                    ...o,
                    clientName: updated.name,
                    clientPhone: updated.phone,
                    clientAddress: updated.address,
                    clientNeighborhood: updated.neighborhood,
                  }
                : o
            )
          );
          showToast('Cliente actualizado en Supabase', 'success', 'Cambios guardados');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar el cliente'), 'error');
        }
      });
      applyLocal();
      return;
    }

    applyLocal();
    showToast('Cliente actualizado', 'success');
  };

  const deleteCustomer = (customerId: string): { success: boolean; message: string } => {
    const linkedOrders = orders.filter((o) => o.clientId === customerId);
    if (linkedOrders.length > 0) {
      const message = `No se puede eliminar: el cliente tiene ${linkedOrders.length} orden${linkedOrders.length > 1 ? 'es' : ''} asociada${linkedOrders.length > 1 ? 's' : ''}.`;
      showToast(message, 'error', 'Eliminación bloqueada');
      return { success: false, message };
    }

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          await persistDeleteCustomer(customerId);
          setCustomers((prev) => prev.filter((c) => c.id !== customerId));
          showToast('Cliente eliminado de Supabase', 'success', 'Eliminado');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo eliminar el cliente'), 'error');
        }
      });
      setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      return { success: true, message: 'Cliente eliminado' };
    }

    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    showToast('Cliente eliminado', 'success');
    return { success: true, message: 'Cliente eliminado' };
  };

  const upsertLocalCustomer = (customer: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.id === customer.id);
      if (exists) return prev.map((c) => (c.id === customer.id ? customer : c));
      const byEmail = prev.findIndex(
        (c) => c.email && customer.email && c.email.toLowerCase() === customer.email.toLowerCase()
      );
      if (byEmail >= 0) {
        const next = [...prev];
        next[byEmail] = customer;
        return next;
      }
      return [...prev, customer];
    });
  };

  const specialtiesForIds = (ids: string[]) =>
    catalogCategories.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, name: c.name }));

  const addTechnician = (data: TechnicianInput): string => {
    const alsoCustomer = Boolean(data.alsoAsCustomer);
    const specialties = specialtiesForIds(data.specialtyIds);
    if (usingRemoteData) {
      const tempId = `tmp-tech-${Date.now()}`;
      const tempTech: Technician = {
        id: tempId,
        name: data.name,
        specialty: specialties.map((s) => s.name).join(', '),
        specialties,
        phone: data.phone,
        email: data.email,
        rating: data.rating ?? 5,
        avatarBg: 'bg-sky-600',
        activeOrdersCount: 0,
        completedOrdersCount: 0,
        zone: data.zone,
        province: data.province,
        address: data.address,
      };
      setTechnicians((prev) => [...prev, tempTech]);
      void withRemote(async () => {
        try {
          const created = await persistCreateTechnician(data);
          setTechnicians((prev) => [...prev.filter((t) => t.id !== tempId), created.technician]);
          if (created.customer) upsertLocalCustomer(created.customer);
          showToast(
            alsoCustomer
              ? `${data.name} guardado como técnico y cliente`
              : `Técnico ${data.name} guardado en Supabase`,
            'success'
          );
        } catch (err) {
          setTechnicians((prev) => prev.filter((t) => t.id !== tempId));
          showToast(friendlyErrorMessage(err, 'Error al crear técnico'), 'error');
        }
      });
      return tempId;
    }

    const newId = `tech-${Math.random().toString(36).substring(2, 7)}`;
    const newTech: Technician = {
      id: newId,
      name: data.name,
      specialty: specialties.map((s) => s.name).join(', '),
      specialties,
      phone: data.phone,
      email: data.email,
      rating: data.rating ?? 5,
      avatarBg: 'bg-sky-600',
      activeOrdersCount: 0,
      completedOrdersCount: 0,
      zone: data.zone,
      province: data.province,
      address: data.address,
    };
    setTechnicians((prev) => [...prev, newTech]);

    if (alsoCustomer) {
      const existing = customers.find(
        (c) => c.email && data.email && c.email.toLowerCase() === data.email.toLowerCase()
      );
      if (existing) {
        setTechnicians((prev) =>
          prev.map((t) => (t.id === newId ? { ...t, customerId: existing.id } : t))
        );
      } else {
        const cliId = `cli-${Math.random().toString(36).substring(2, 7)}`;
        upsertLocalCustomer({
          id: cliId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.customerAddress?.trim() || 'A completar',
          neighborhood: data.customerNeighborhood?.trim() || data.zone || 'CABA',
          notes: data.customerNotes,
        });
        setTechnicians((prev) =>
          prev.map((t) => (t.id === newId ? { ...t, customerId: cliId } : t))
        );
      }
    }

    showToast(`Técnico ${data.name} registrado en TecniUrbano`, 'success');
    return newId;
  };

  const updateTechnician = (technicianId: string, patch: TechnicianInput) => {
    const patchedSpecialties = specialtiesForIds(patch.specialtyIds);
    const applyLocal = () => {
      setTechnicians((prev) =>
        prev.map((t) =>
          t.id === technicianId
            ? {
                ...t,
                name: patch.name,
                specialty: patchedSpecialties.map((s) => s.name).join(', '),
                specialties: patchedSpecialties,
                phone: patch.phone,
                email: patch.email,
                rating: patch.rating ?? t.rating,
                zone: patch.zone,
                province: patch.province,
                address: patch.address,
              }
            : t
        )
      );
      setOrders((prev) =>
        prev.map((o) =>
          o.assignedTechnicianId === technicianId
            ? { ...o, assignedTechnicianName: patch.name }
            : o
        )
      );
    };

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          const updated = await persistUpdateTechnician(technicianId, patch);
          setTechnicians((prev) =>
            prev.map((t) => (t.id === technicianId ? updated.technician : t))
          );
          if (updated.customer) upsertLocalCustomer(updated.customer);
          showToast('Técnico actualizado en Supabase', 'success', 'Cambios guardados');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar el técnico'), 'error');
        }
      });
      applyLocal();
      return;
    }

    applyLocal();
    if (patch.alsoAsCustomer) {
      const existing = customers.find(
        (c) => c.email && patch.email && c.email.toLowerCase() === patch.email.toLowerCase()
      );
      if (existing) {
        updateCustomer(existing.id, {
          name: patch.name,
          phone: patch.phone,
          email: patch.email,
          address: patch.customerAddress?.trim() || existing.address,
          neighborhood: patch.customerNeighborhood?.trim() || existing.neighborhood,
          notes: patch.customerNotes ?? existing.notes,
        });
        setTechnicians((prev) =>
          prev.map((t) => (t.id === technicianId ? { ...t, customerId: existing.id } : t))
        );
      } else {
        const cliId = addCustomer({
          name: patch.name,
          phone: patch.phone,
          email: patch.email,
          address: patch.customerAddress?.trim() || 'A completar',
          neighborhood: patch.customerNeighborhood?.trim() || 'CABA',
          notes: patch.customerNotes,
        });
        setTechnicians((prev) =>
          prev.map((t) => (t.id === technicianId ? { ...t, customerId: cliId } : t))
        );
      }
    }
    showToast('Técnico actualizado', 'success');
  };

  const deleteTechnician = (technicianId: string): { success: boolean; message: string } => {
    const linkedOrders = orders.filter((o) => o.assignedTechnicianId === technicianId);
    if (linkedOrders.length > 0) {
      const message = `No se puede eliminar: el técnico tiene ${linkedOrders.length} orden${linkedOrders.length > 1 ? 'es' : ''} asignada${linkedOrders.length > 1 ? 's' : ''}.`;
      showToast(message, 'error', 'Eliminación bloqueada');
      return { success: false, message };
    }

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          await persistDeleteTechnician(technicianId);
          setTechnicians((prev) => prev.filter((t) => t.id !== technicianId));
          showToast('Técnico eliminado de Supabase', 'success', 'Eliminado');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo eliminar el técnico'), 'error');
        }
      });
      setTechnicians((prev) => prev.filter((t) => t.id !== technicianId));
      return { success: true, message: 'Técnico eliminado' };
    }

    setTechnicians((prev) => prev.filter((t) => t.id !== technicianId));
    showToast('Técnico eliminado', 'success');
    return { success: true, message: 'Técnico eliminado' };
  };

  const updateMaterialStock = (materialId: string, newStock: number) => {
    const stock = Math.max(0, newStock);
    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, stock } : m))
    );
    if (usingRemoteData) {
      void withRemote(() => persistUpdateMaterialStock(materialId, stock)).catch((err) => {
        showToast(friendlyErrorMessage(err, 'Error al actualizar stock'), 'error');
      });
    }
    showToast('Stock actualizado correctamente', 'info');
  };

  const addMaterialToInventory = (item: Omit<MaterialInventory, 'id'>) => {
    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          const created = await persistCreateMaterial(item);
          setMaterials((prev) => [...prev, created]);
          showToast(`Material "${item.name}" guardado en Supabase`, 'success');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'Error al crear material'), 'error');
        }
      });
      return;
    }

    const newId = `mat-${Date.now()}`;
    const newMat: MaterialInventory = {
      id: newId,
      ...item,
    };
    setMaterials((prev) => [...prev, newMat]);
    showToast(`Material "${item.name}" incorporado al inventario`, 'success');
  };

  const updateMaterial = (materialId: string, patch: Omit<MaterialInventory, 'id'>) => {
    const applyLocal = () => {
      setMaterials((prev) => prev.map((m) => (m.id === materialId ? { id: materialId, ...patch } : m)));
    };

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          const updated = await persistUpdateMaterial(materialId, patch);
          setMaterials((prev) => prev.map((m) => (m.id === materialId ? updated : m)));
          showToast('Material actualizado en Supabase', 'success', 'Cambios guardados');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar el material'), 'error');
        }
      });
      applyLocal();
      return;
    }

    applyLocal();
    showToast('Material actualizado', 'success');
  };

  const deleteMaterial = (materialId: string) => {
    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          await persistDeleteMaterial(materialId);
          setMaterials((prev) => prev.filter((m) => m.id !== materialId));
          showToast('Material eliminado de Supabase', 'success', 'Eliminado');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo eliminar el material'), 'error');
        }
      });
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
      return;
    }

    setMaterials((prev) => prev.filter((m) => m.id !== materialId));
    showToast('Material eliminado', 'success');
  };

  const addService = (input: ServiceItemInput): void => {
    const normalized: ServiceItemInput = {
      name: input.name.trim(),
      description: input.description.trim(),
      price: Number(input.price) || 0,
      category: input.category?.trim() || 'General',
      categoryId: input.categoryId ?? null,
      subcategoria: input.subcategoria ?? null,
      subcategoryId: input.subcategoryId ?? null,
      estimatedDurationMinutes: input.estimatedDurationMinutes ? Number(input.estimatedDurationMinutes) : 60,
      features: input.features && input.features.length > 0 ? input.features : ['Garantía de servicio', 'Personal calificado'],
      active: input.active !== undefined ? input.active : true,
    };

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          const created = await persistCreateService(normalized);
          setServices((prev) => [created, ...prev]);
          showToast(`Servicio "${created.name}" guardado en Supabase`, 'success', 'Catálogo de servicios');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'Error al crear servicio'), 'error');
        }
      });
      return;
    }

    const newService: ServiceItem = { id: `srv-${Date.now().toString(36)}`, ...normalized };
    setServices((prev) => [newService, ...prev]);
    showToast(`Servicio "${newService.name}" creado con éxito`, 'success', 'Catálogo de servicios');
  };

  const updateService = (serviceId: string, patch: Partial<ServiceItemInput>) => {
    const applyLocal = () => {
      setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, ...patch } : s)));
    };

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          const updated = await persistUpdateService(serviceId, patch);
          setServices((prev) => prev.map((s) => (s.id === serviceId ? updated : s)));
          showToast('Servicio actualizado en Supabase', 'success', 'Catálogo de servicios');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar el servicio'), 'error');
        }
      });
      applyLocal();
      return;
    }

    applyLocal();
    showToast('Servicio actualizado con éxito', 'success', 'Catálogo de servicios');
  };

  const deleteService = (serviceId: string): void => {
    const target = services.find((s) => s.id === serviceId);
    if (!target) {
      showToast('Servicio no encontrado', 'error');
      return;
    }

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          await persistDeleteService(serviceId);
          setServices((prev) => prev.filter((s) => s.id !== serviceId));
          showToast(`Servicio "${target.name}" eliminado de Supabase`, 'info', 'Catálogo de servicios');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo eliminar el servicio'), 'error');
        }
      });
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      return;
    }

    setServices((prev) => prev.filter((s) => s.id !== serviceId));
    showToast(`Servicio "${target.name}" eliminado`, 'info', 'Catálogo de servicios');
  };

  const createCategory = async (input: { name: string; description?: string; icon?: string }): Promise<void> => {
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          const created = await persistCreateCategory(input);
          setCatalogCategories((prev) => [...prev, created].sort((a, b) => a.displayOrder - b.displayOrder));
          showToast(`Categoría "${created.name}" creada`, 'success', 'Categorías');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo crear la categoría'), 'error');
        }
      });
      return;
    }
    const id = `cat-${Date.now().toString(36)}`;
    const created: CatalogCategory = {
      id,
      name: input.name.trim(),
      slug: id,
      icon: input.icon || 'Sparkles',
      description: input.description?.trim() || '',
      displayOrder: catalogCategories.length + 1,
      active: true,
    };
    setCatalogCategories((prev) => [...prev, created]);
    showToast(`Categoría "${created.name}" creada`, 'success', 'Categorías');
  };

  const updateCategory = async (
    id: string,
    patch: { name?: string; description?: string; icon?: string }
  ): Promise<void> => {
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          const updated = await persistUpdateCategory(id, patch);
          setCatalogCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
          showToast('Categoría actualizada', 'success', 'Categorías');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar la categoría'), 'error');
        }
      });
      return;
    }
    setCatalogCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    showToast('Categoría actualizada', 'success', 'Categorías');
  };

  const setCategoryActive = async (id: string, isActive: boolean): Promise<void> => {
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          const updated = await persistUpdateCategory(id, { isActive });
          setCatalogCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
          showToast(isActive ? 'Categoría publicada' : 'Categoría oculta del portal', 'success', 'Categorías');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar la categoría'), 'error');
        }
      });
      return;
    }
    setCatalogCategories((prev) => prev.map((c) => (c.id === id ? { ...c, active: isActive } : c)));
    showToast(isActive ? 'Categoría publicada' : 'Categoría oculta del portal', 'success', 'Categorías');
  };

  const deleteCategory = async (id: string): Promise<void> => {
    const target = catalogCategories.find((c) => c.id === id);
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          await persistDeleteCategory(id);
          setCatalogCategories((prev) => prev.filter((c) => c.id !== id));
          showToast(`Categoría "${target?.name ?? ''}" eliminada`, 'info', 'Categorías');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo eliminar la categoría'), 'error');
        }
      });
      return;
    }
    setCatalogCategories((prev) => prev.filter((c) => c.id !== id));
    showToast(`Categoría "${target?.name ?? ''}" eliminada`, 'info', 'Categorías');
  };

  const mergeCategory = async (sourceId: string, targetId: string): Promise<void> => {
    if (!usingRemoteData) {
      showToast('Fusionar categorías solo está disponible conectado a Supabase.', 'warning');
      return;
    }
    await withRemote(async () => {
      try {
        await persistMergeCategory(sourceId, targetId);
        await refreshRemoteData();
        showToast('Categoría fusionada correctamente', 'success', 'Categorías');
      } catch (err) {
        showToast(friendlyErrorMessage(err, 'No se pudo fusionar la categoría'), 'error');
      }
    });
  };

  const moveCategory = async (id: string, direction: 'up' | 'down'): Promise<void> => {
    const sorted = [...catalogCategories].sort((a, b) => a.displayOrder - b.displayOrder);
    const index = sorted.findIndex((c) => c.id === id);
    const neighborIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || neighborIndex < 0 || neighborIndex >= sorted.length) return;
    const current = sorted[index];
    const neighbor = sorted[neighborIndex];
    const applyLocalSwap = () =>
      setCatalogCategories((prev) =>
        prev.map((c) => {
          if (c.id === current.id) return { ...c, displayOrder: neighbor.displayOrder };
          if (c.id === neighbor.id) return { ...c, displayOrder: current.displayOrder };
          return c;
        })
      );
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          await persistSwapCategoryOrder(current.id, neighbor.id);
          applyLocalSwap();
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo reordenar'), 'error');
        }
      });
      return;
    }
    applyLocalSwap();
  };

  const createSubcategory = async (input: {
    categoryId: string;
    name: string;
  }): Promise<CatalogSubcategory | undefined> => {
    if (usingRemoteData) {
      return withRemote(async () => {
        try {
          const created = await persistCreateSubcategory(input);
          setCatalogSubcategories((prev) => [...prev, created]);
          showToast(`Subcategoría "${created.name}" creada`, 'success', 'Categorías');
          return created;
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo crear la subcategoría'), 'error');
          return undefined;
        }
      });
    }
    const id = `subcat-${Date.now().toString(36)}`;
    const created: CatalogSubcategory = {
      id,
      categoryId: input.categoryId,
      name: input.name.trim(),
      slug: id,
      displayOrder: catalogSubcategories.filter((s) => s.categoryId === input.categoryId).length + 1,
      active: true,
    };
    setCatalogSubcategories((prev) => [...prev, created]);
    showToast(`Subcategoría "${created.name}" creada`, 'success', 'Categorías');
    return created;
  };

  const updateSubcategory = async (id: string, patch: { name?: string }): Promise<void> => {
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          const updated = await persistUpdateSubcategory(id, patch);
          setCatalogSubcategories((prev) => prev.map((s) => (s.id === id ? updated : s)));
          showToast('Subcategoría actualizada', 'success', 'Categorías');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar la subcategoría'), 'error');
        }
      });
      return;
    }
    setCatalogSubcategories((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    showToast('Subcategoría actualizada', 'success', 'Categorías');
  };

  const setSubcategoryActive = async (id: string, isActive: boolean): Promise<void> => {
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          const updated = await persistUpdateSubcategory(id, { isActive });
          setCatalogSubcategories((prev) => prev.map((s) => (s.id === id ? updated : s)));
          showToast(isActive ? 'Subcategoría publicada' : 'Subcategoría oculta', 'success', 'Categorías');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo actualizar la subcategoría'), 'error');
        }
      });
      return;
    }
    setCatalogSubcategories((prev) => prev.map((s) => (s.id === id ? { ...s, active: isActive } : s)));
    showToast(isActive ? 'Subcategoría publicada' : 'Subcategoría oculta', 'success', 'Categorías');
  };

  const deleteSubcategory = async (id: string): Promise<void> => {
    const target = catalogSubcategories.find((s) => s.id === id);
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          await persistDeleteSubcategory(id);
          setCatalogSubcategories((prev) => prev.filter((s) => s.id !== id));
          showToast(`Subcategoría "${target?.name ?? ''}" eliminada`, 'info', 'Categorías');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo eliminar la subcategoría'), 'error');
        }
      });
      return;
    }
    setCatalogSubcategories((prev) => prev.filter((s) => s.id !== id));
    showToast(`Subcategoría "${target?.name ?? ''}" eliminada`, 'info', 'Categorías');
  };

  const mergeSubcategory = async (sourceId: string, targetId: string): Promise<void> => {
    if (!usingRemoteData) {
      showToast('Fusionar subcategorías solo está disponible conectado a Supabase.', 'warning');
      return;
    }
    await withRemote(async () => {
      try {
        await persistMergeSubcategory(sourceId, targetId);
        await refreshRemoteData();
        showToast('Subcategoría fusionada correctamente', 'success', 'Categorías');
      } catch (err) {
        showToast(friendlyErrorMessage(err, 'No se pudo fusionar la subcategoría'), 'error');
      }
    });
  };

  const moveSubcategory = async (id: string, direction: 'up' | 'down'): Promise<void> => {
    const target = catalogSubcategories.find((s) => s.id === id);
    if (!target) return;
    const siblings = catalogSubcategories
      .filter((s) => s.categoryId === target.categoryId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const index = siblings.findIndex((s) => s.id === id);
    const neighborIndex = direction === 'up' ? index - 1 : index + 1;
    if (neighborIndex < 0 || neighborIndex >= siblings.length) return;
    const current = siblings[index];
    const neighbor = siblings[neighborIndex];
    const applyLocalSwap = () =>
      setCatalogSubcategories((prev) =>
        prev.map((s) => {
          if (s.id === current.id) return { ...s, displayOrder: neighbor.displayOrder };
          if (s.id === neighbor.id) return { ...s, displayOrder: current.displayOrder };
          return s;
        })
      );
    if (usingRemoteData) {
      await withRemote(async () => {
        try {
          await persistSwapSubcategoryOrder(current.id, neighbor.id);
          applyLocalSwap();
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo reordenar'), 'error');
        }
      });
      return;
    }
    applyLocalSwap();
  };

  return (
    <AppContext.Provider
      value={{
        orders,
        technicians,
        customers,
        materials,
        services,
        catalogCategories,
        catalogSubcategories,
        visitDepositAmount,
        updateVisitDepositAmount,
        currentUser,
        authReady,
        authLoading,
        dataLoading,
        dataError,
        remoteBusy,
        isAuthenticated,
        usingRemoteData,
        currentPath,
        toast,
        navigate,
        setCurrentUser,
        loginAsRole,
        loginWithPassword,
        passwordRecoveryMode,
        requestPasswordRecovery,
        completePasswordRecovery,
        registerWithInvite,
        registerCustomer,
        registerTechnician,
        technicianApplications,
        createAccountInviteLink,
        logout,
        refreshRemoteData,
        clearDataError,
        showToast,
        hideToast,
        createOrder,
        updateOrder,
        deleteCustomerOrder,
        cancelOrderAsAdmin,
        reportOrderIncident,
        resolveOrderIncident,
        closeOrderExceptionally,
        updateOrderStatus,
        assignTechnician,
        toggleChecklistItem,
        addChecklistItem,
        respondToAssignment,
        addTimeLog,
        addTechnicalNote,
        addUsedMaterial,
        saveCustomerSignature,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addTechnician,
        updateTechnician,
        deleteTechnician,
        updateMaterialStock,
        addMaterialToInventory,
        updateMaterial,
        deleteMaterial,
        addService,
        updateService,
        deleteService,
        createCategory,
        updateCategory,
        setCategoryActive,
        deleteCategory,
        mergeCategory,
        moveCategory,
        createSubcategory,
        updateSubcategory,
        setSubcategoryActive,
        deleteSubcategory,
        mergeSubcategory,
        moveSubcategory,
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
