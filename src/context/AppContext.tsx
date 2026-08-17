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
  profileToCurrentUser,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from '../lib/supabaseData';
import {
  requireAdmin,
  requireTechnician,
  validateOrderCreationAccess,
  validateOrderModificationAccess,
  validateCustomerOrderAccess,
  validateTechnicianOrderAccess,
  validateTechnicianAssignmentAccess,
  validateOrderId,
  SecurityError,
} from '../lib/securityValidations';
import {
  persistAddChecklistItem,
  persistAddNote,
  persistAddTimeLog,
  persistAddUsedMaterial,
  persistAssignTechnician,
  persistCreateAccountInvite,
  persistCreateCustomer,
  persistCreateMaterial,
  persistCreateOrder,
  persistCreateTechnician,
  persistDeleteCustomer,
  persistDeleteMaterial,
  persistDeleteOrder,
  persistDeleteTechnician,
  persistSignature,
  redeemAccountInvite,
  persistToggleChecklistItem,
  persistUpdateCustomer,
  persistUpdateMaterial,
  persistUpdateMaterialStock,
  persistUpdateOrder,
  persistUpdateOrderStatus,
  persistUpdateTechnician,
} from '../lib/supabaseMutations';
import { friendlyErrorMessage } from '../components/common/AppStatus';
import {
  CurrentUserData,
  Customer,
  MaterialInventory,
  OrderEventType,
  OrderStatus,
  OrderPriority,
  ServiceItem,
  ServiceCategory,
  ServiceCategoryInput,
  ServiceItemInput,
  ServiceOrder,
  ServiceType,
  Technician,
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
  serviceCategories: ServiceCategory[];
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
  registerWithInvite: (input: { token: string; password: string }) => Promise<void>;
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
      status: OrderStatus;
      clientId: string;
      assignedTechnicianId?: string | null;
      scheduledDate: string;
    }
  ) => void;

  deleteOrder: (orderId: string) => void;
  
  updateOrderStatus: (
    orderId: string,
    newStatus: OrderStatus,
    reason?: string
  ) => { success: boolean; message: string };
  
  assignTechnician: (orderId: string, technicianId: string) => void;
  toggleChecklistItem: (orderId: string, itemId: string) => void;
  addChecklistItem: (orderId: string, label: string) => void;
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
  addService: (service: ServiceItemInput) => string;
  updateService: (serviceId: string, patch: Partial<ServiceItemInput>) => void;
  deleteService: (serviceId: string) => { success: boolean; message: string };

  // Service Categories CRUD
  addServiceCategory: (category: ServiceCategoryInput) => string;
  updateServiceCategory: (categoryId: string, patch: Partial<ServiceCategoryInput>) => void;
  deleteServiceCategory: (categoryId: string) => { success: boolean; message: string };

  resetDemoData: () => void;
}

// User profiles
export const DEMO_USERS: Record<string, CurrentUserData> = {
  admin: {
    id: 'user-admin',
    name: 'Sebastián Borrego',
    email: 'admin@servicasa.com.ar',
    role: 'admin',
    avatarText: 'SB',
  },
  'tech-carlos': {
    id: 'user-tech-carlos',
    name: 'Carlos Méndez',
    email: 'carlos.mendez@servicasa.com.ar',
    role: 'technician',
    technicianId: 'tech-carlos',
    avatarText: 'CM',
  },
  'tech-maria': {
    id: 'user-tech-maria',
    name: 'María Rodríguez',
    email: 'maria.rodriguez@servicasa.com.ar',
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

const STORAGE_KEY = 'servicasa_app_state_v1';

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

  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_serviceCategories`);
      return saved ? JSON.parse(saved) : INITIAL_SERVICE_CATEGORIES;
    } catch {
      return INITIAL_SERVICE_CATEGORIES;
    }
  });

  const [currentUser, setCurrentUserState] = useState<CurrentUserData | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authLoading, setAuthLoading] = useState(false);
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
      localStorage.setItem(`${STORAGE_KEY}_serviceCategories`, JSON.stringify(serviceCategories));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [orders, technicians, customers, materials, services, serviceCategories, usingRemoteData]);

  const applyRemoteSession = async (userId: string) => {
    setDataLoading(true);
    setDataError(null);
    try {
      const profile = await fetchProfile(userId);
      if (!profile) {
        throw new Error('No se encontró el perfil en Supabase.');
      }
      const catalog = await fetchCatalog();
      setTechnicians(catalog.technicians);
      setCustomers(catalog.customers);
      setMaterials(catalog.materials);
      setOrders(catalog.orders);
      setUsingRemoteData(true);
      setCurrentUserState(profileToCurrentUser(profile));
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
    setServices(INITIAL_SERVICES);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      setDataError('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local');
      return;
    }

    let mounted = true;

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
          const catalog = await fetchCatalog();
          setTechnicians(catalog.technicians);
          setCustomers(catalog.customers);
          setMaterials(catalog.materials);
          setOrders(catalog.orders);
        }).catch((err) => console.error('[ServiCasa] Realtime refresh failed', err));
      }, 250);
    };

    const channel = supabase
      .channel('servicasa-operational-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_checklist_items' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_time_logs' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_materials_used' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_events' }, refreshCatalog)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_signatures' }, refreshCatalog)
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
      const { user } = await signInWithPassword(email.trim(), password);
      if (!user) throw new Error('No se pudo iniciar sesión.');
      const pendingInvite = sessionStorage.getItem('servicasa_pending_invite');
      if (pendingInvite) {
        try {
          await redeemAccountInvite(pendingInvite);
          sessionStorage.removeItem('servicasa_pending_invite');
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
        sessionStorage.setItem('servicasa_pending_invite', input.token);
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
    setServiceCategories(INITIAL_SERVICE_CATEGORIES);
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
      void withRemote(async () => {
        await persistAddUsedMaterial({
          orderId,
          materialId: mat.id,
          materialName: mat.name,
          quantity,
          unit: mat.unit,
          note: note?.trim(),
          author: currentUser?.name ?? 'Sistema',
        });
        const nextStock = Math.max(0, mat.stock - quantity);
        await persistUpdateMaterialStock(mat.id, nextStock);
      }).catch((err) => {
        showToast(friendlyErrorMessage(err, 'Error al registrar material'), 'error');
      });
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
      validateCustomerOrderAccess(currentUser, order);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return false;
    }

    if (!signature.signerName.trim() || !signature.signatureDataUrl) {
      showToast('Debe ingresar el nombre del firmante y trazar la firma.', 'warning');
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
      status: OrderStatus;
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
                status: patch.status,
                scheduledDate: patch.scheduledDate,
                clientId: client.id,
                clientName: client.name,
                clientPhone: client.phone,
                clientAddress: client.address,
                clientNeighborhood: client.neighborhood,
                assignedTechnicianId: tech?.id ?? null,
                assignedTechnicianName: tech?.name ?? null,
                completedAt: patch.status === 'completed' ? o.completedAt || formatNow() : undefined,
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
            status: patch.status,
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

  const deleteOrder = (orderId: string) => {
    // ✓ SECURITY: Only admin can delete orders
    try {
      requireAdmin(currentUser);
      validateOrderId(orderId);
    } catch (err) {
      const msg = err instanceof SecurityError ? err.message : 'No autorizado';
      showToast(msg, 'error', 'Seguridad');
      return;
    }

    if (usingRemoteData) {
      void withRemote(async () => {
        try {
          await persistDeleteOrder(orderId);
          setOrders((prev) => prev.filter((o) => o.id !== orderId));
          showToast('Orden eliminada de Supabase', 'success', 'Eliminada');
        } catch (err) {
          showToast(friendlyErrorMessage(err, 'No se pudo eliminar la orden'), 'error');
        }
      });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      return;
    }

    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    showToast('Orden eliminada', 'success');
  };

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
        'Revisión integral según protocolo ServiCasa',
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
    showToast(`Cliente ${data.name} registrado en ServiCasa`, 'success');
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

  const addTechnician = (data: TechnicianInput): string => {
    const alsoCustomer = Boolean(data.alsoAsCustomer);
    if (usingRemoteData) {
      const tempId = `tmp-tech-${Date.now()}`;
      const tempTech: Technician = {
        id: tempId,
        name: data.name,
        specialty: data.specialty,
        phone: data.phone,
        email: data.email,
        rating: data.rating ?? 5,
        avatarBg: 'bg-sky-600',
        activeOrdersCount: 0,
        completedOrdersCount: 0,
        zone: data.zone,
        province: data.province,
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
      specialty: data.specialty,
      phone: data.phone,
      email: data.email,
      rating: data.rating ?? 5,
      avatarBg: 'bg-sky-600',
      activeOrdersCount: 0,
      completedOrdersCount: 0,
      zone: data.zone,
      province: data.province,
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

    showToast(`Técnico ${data.name} registrado en ServiCasa`, 'success');
    return newId;
  };

  const updateTechnician = (technicianId: string, patch: TechnicianInput) => {
    const applyLocal = () => {
      setTechnicians((prev) =>
        prev.map((t) =>
          t.id === technicianId
            ? {
                ...t,
                name: patch.name,
                specialty: patch.specialty,
                phone: patch.phone,
                email: patch.email,
                rating: patch.rating ?? t.rating,
                zone: patch.zone,
                province: patch.province,
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

  const addService = (input: ServiceItemInput): string => {
    const id = `srv-${Date.now().toString(36)}`;
    const newService: ServiceItem = {
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      price: Number(input.price) || 0,
      category: input.category?.trim() || 'General',
      estimatedDurationMinutes: input.estimatedDurationMinutes ? Number(input.estimatedDurationMinutes) : 60,
      features: input.features && input.features.length > 0 ? input.features : ['Garantía de servicio', 'Personal calificado'],
      active: input.active !== undefined ? input.active : true,
    };
    setServices((prev) => [newService, ...prev]);
    showToast(`Servicio "${newService.name}" creado con éxito`, 'success', 'Catálogo de servicios');
    return id;
  };

  const updateService = (serviceId: string, patch: Partial<ServiceItemInput>) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, ...patch } : s))
    );
    showToast('Servicio actualizado con éxito', 'success', 'Catálogo de servicios');
  };

  const deleteService = (serviceId: string): { success: boolean; message: string } => {
    const target = services.find((s) => s.id === serviceId);
    if (!target) return { success: false, message: 'Servicio no encontrado' };

    setServices((prev) => prev.filter((s) => s.id !== serviceId));
    showToast(`Servicio "${target.name}" eliminado`, 'info', 'Catálogo de servicios');
    return { success: true, message: 'Servicio eliminado correctamente' };
  };

  const addServiceCategory = (input: ServiceCategoryInput): string => {
    const id = `cat-${Date.now().toString(36)}`;
    const newCategory: ServiceCategory = {
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      icon: input.icon || 'Sparkles',
      color: input.color || 'bg-teal-50 border-teal-200',
      active: input.active !== undefined ? input.active : true,
    };
    setServiceCategories((prev) => [newCategory, ...prev]);
    showToast(`Categoría "${newCategory.name}" creada con éxito`, 'success', 'Categorías');
    return id;
  };

  const updateServiceCategory = (categoryId: string, patch: Partial<ServiceCategoryInput>) => {
    setServiceCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, ...patch } : c))
    );
    showToast('Categoría actualizada con éxito', 'success', 'Categorías');
  };

  const deleteServiceCategory = (categoryId: string): { success: boolean; message: string } => {
    const target = serviceCategories.find((c) => c.id === categoryId);
    if (!target) return { success: false, message: 'Categoría no encontrada' };

    const linkedServices = services.filter(
      (s) => (s.category || '').trim().toLowerCase() === target.name.trim().toLowerCase()
    );
    if (linkedServices.length > 0) {
      return {
        success: false,
        message: `No se puede eliminar: ${linkedServices.length} servicio(s) usan esta categoría. Reasignalos primero.`,
      };
    }

    setServiceCategories((prev) => prev.filter((c) => c.id !== categoryId));
    showToast(`Categoría "${target.name}" eliminada`, 'info', 'Categorías');
    return { success: true, message: 'Categoría eliminada correctamente' };
  };

  return (
    <AppContext.Provider
      value={{
        orders,
        technicians,
        customers,
        materials,
        services,
        serviceCategories,
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
        registerWithInvite,
        createAccountInviteLink,
        logout,
        refreshRemoteData,
        clearDataError,
        showToast,
        hideToast,
        createOrder,
        updateOrder,
        deleteOrder,
        updateOrderStatus,
        assignTechnician,
        toggleChecklistItem,
        addChecklistItem,
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
        addServiceCategory,
        updateServiceCategory,
        deleteServiceCategory,
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
