import React, { useEffect, useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Plus,
  Search,
  Filter,
  Users,
  Boxes,
  UserCheck,
  Clock,
  AlertTriangle,
  Ban,
  CircleAlert,
  Flame,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  ChevronRight,
  Eye,
  X,
  Package,
  Wrench,
  ArrowUpDown,
  History,
  FileSignature,
  Pencil,
  Trash2,
  Copy,
  Sparkles,
  Zap,
  Hammer,
  Settings,
  ShieldCheck,
  DollarSign,
  Tag,
  Layers,
  Droplets,
  Lightbulb,
  EyeOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PaymentStatusBadge, PriorityBadge, ServiceBadge, StatusBadge } from '../components/common/Badge';
import { Timeline } from '../components/common/Timeline';
import { EntityActionsMenu } from '../components/common/EntityActionsMenu';
import { formatElapsedTime, getOrderElapsedSeconds, isOrderPaymentSettled, orderRequiresPaymentGate } from '../lib/workTimer';
import { TechnicianValidation } from '../components/admin/TechnicianValidation';
import { TechnicianApplications } from '../components/admin/TechnicianApplications';
import { PayoutScheduler } from '../components/admin/PayoutScheduler';
import {
  OrderPriority,
  ServiceItem,
  ServiceItemInput,
  ServiceOrder,
  ServiceType,
  ServiceCategory,
  Customer,
  Technician,
  TechnicianApplication,
  MaterialInventory,
} from '../types';

type MaterialCategory = MaterialInventory['category'];
type OrderQuickFilter = 'all' | 'active' | 'in_progress' | 'paused' | 'urgent' | 'completed';

function toDateInputValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function AccountBadge({ hasAccount }: { hasAccount: boolean }) {
  return hasAccount ? (
    <span className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold text-[10px]">
      Con cuenta
    </span>
  ) : (
    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono font-bold text-[10px]">
      Sin cuenta
    </span>
  );
}

const CATEGORY_VISUALS: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  Wrench: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', label: 'Plomería / Reparaciones' },
  Zap: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', label: 'Electricidad' },
  Hammer: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', label: 'Hogar / Albañilería' },
  Settings: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'Mantenimiento' },
  ShieldCheck: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'Instalación de equipos' },
  Droplets: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', label: 'Agua / Saneamiento' },
  Flame: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', label: 'Gas / Calefacción' },
  Lightbulb: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', label: 'Iluminación' },
  Sparkles: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-600', label: 'General' },
};

const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_VISUALS);

function getCategoryVisual(iconKey?: string) {
  return CATEGORY_VISUALS[iconKey || 'Sparkles'] || CATEGORY_VISUALS.Sparkles;
}

function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const cls = className || 'w-4 h-4';
  switch (name) {
    case 'Wrench':
      return <Wrench className={cls} />;
    case 'Zap':
      return <Zap className={cls} />;
    case 'Hammer':
      return <Hammer className={cls} />;
    case 'Settings':
      return <Settings className={cls} />;
    case 'ShieldCheck':
      return <ShieldCheck className={cls} />;
    case 'Droplets':
      return <Droplets className={cls} />;
    case 'Flame':
      return <Flame className={cls} />;
    case 'Lightbulb':
      return <Lightbulb className={cls} />;
    case 'Sparkles':
    default:
      return <Sparkles className={cls} />;
  }
}

const ARGENTINA_PROVINCES = [
  'CABA',
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
];

export const AdminHubView: React.FC = () => {
  const {
    orders,
    technicians,
    customers,
    materials,
    services,
    serviceCategories,
    createOrder,
    updateOrder,
    cancelOrderAsAdmin,
    reportOrderIncident,
    resolveOrderIncident,
    closeOrderExceptionally,
    assignTechnician,
    updateMaterialStock,
    addMaterialToInventory,
    updateMaterial,
    deleteMaterial,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addTechnician,
    updateTechnician,
    deleteTechnician,
    addService,
    updateService,
    deleteService,
    addServiceCategory,
    updateServiceCategory,
    deleteServiceCategory,
    createAccountInviteLink,
    showToast,
  } = useApp();

  // Navigation tab within hub
  const [activeTab, setActiveTab] = useState<'orders' | 'customers' | 'technicians' | 'inventory' | 'services' | 'categories'>('orders');

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<OrderQuickFilter>('all');
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Modals state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<ServiceOrder | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<ServiceOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [orderForIncident, setOrderForIncident] = useState<ServiceOrder | null>(null);
  const [incidentReason, setIncidentReason] = useState('');
  const [pauseIncidentSettlement, setPauseIncidentSettlement] = useState(true);
  const [orderForExceptionalClose, setOrderForExceptionalClose] = useState<ServiceOrder | null>(null);
  const [exceptionalCloseReason, setExceptionalCloseReason] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [orderToAssign, setOrderToAssign] = useState<ServiceOrder | null>(null);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerPendingDelete, setCustomerPendingDelete] = useState<Customer | null>(null);
  const [isNewTechnicianModalOpen, setIsNewTechnicianModalOpen] = useState(false);
  const [isEditTechnicianModalOpen, setIsEditTechnicianModalOpen] = useState(false);
  const [technicianToEdit, setTechnicianToEdit] = useState<Technician | null>(null);
  const [technicianPendingDelete, setTechnicianPendingDelete] = useState<Technician | null>(null);
  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [isEditMaterialModalOpen, setIsEditMaterialModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<MaterialInventory | null>(null);
  const [materialPendingDelete, setMaterialPendingDelete] = useState<MaterialInventory | null>(null);
  const [inviteLinkModal, setInviteLinkModal] = useState<{
    name: string;
    kind: 'technician' | 'customer';
    url: string;
  } | null>(null);

  // New Order Form state
  const [newOrderTitle, setNewOrderTitle] = useState('');
  const [newOrderDesc, setNewOrderDesc] = useState('');
  const [newOrderService, setNewOrderService] = useState<ServiceType>('Plomería');
  const [newOrderPriority, setNewOrderPriority] = useState<OrderPriority>('alta');
  const [newOrderClientId, setNewOrderClientId] = useState(customers[0]?.id || '');
  const [newOrderTechId, setNewOrderTechId] = useState('');
  const [newOrderDate, setNewOrderDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Edit Order Form state
  const [editOrderTitle, setEditOrderTitle] = useState('');
  const [editOrderDesc, setEditOrderDesc] = useState('');
  const [editOrderService, setEditOrderService] = useState<ServiceType>('Plomería');
  const [editOrderPriority, setEditOrderPriority] = useState<OrderPriority>('alta');
  const [editOrderClientId, setEditOrderClientId] = useState('');
  const [editOrderTechId, setEditOrderTechId] = useState('');
  const [editOrderDate, setEditOrderDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) ?? null : null),
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (selectedOrderId && !orders.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [orders, selectedOrderId]);

  // Handle pre-filled service from landing page
  useEffect(() => {
    const selectedServiceId = localStorage.getItem('tecniurbano_selectedServiceId');
    if (selectedServiceId) {
      const selectedService = services.find((s) => s.id === selectedServiceId);
      if (selectedService) {
        setNewOrderTitle(selectedService.name);
        setNewOrderDesc(selectedService.description);
        setNewOrderService(selectedService.category as ServiceType);
        setIsCreateModalOpen(true);
      }
      localStorage.removeItem('tecniurbano_selectedServiceId');
    }
  }, [services]);

  // New Customer Form state
  const [newCustName, setNewCustName] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustNeighborhood, setNewCustNeighborhood] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');

  // Edit Customer Form state
  const [editCustName, setEditCustName] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustNeighborhood, setEditCustNeighborhood] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustEmail, setEditCustEmail] = useState('');
  const [editCustNotes, setEditCustNotes] = useState('');

  // Technician form state
  const [newTechName, setNewTechName] = useState('');
  const [newTechSpecialty, setNewTechSpecialty] = useState('Plomería');
  const [newTechPhone, setNewTechPhone] = useState('');
  const [newTechEmail, setNewTechEmail] = useState('');
  const [newTechZone, setNewTechZone] = useState('');
  const [newTechProvince, setNewTechProvince] = useState('CABA');
  const [newTechAlsoCustomer, setNewTechAlsoCustomer] = useState(false);
  const [newTechAddress, setNewTechAddress] = useState('');
  const [newTechNeighborhood, setNewTechNeighborhood] = useState('');

  const [editTechName, setEditTechName] = useState('');
  const [editTechSpecialty, setEditTechSpecialty] = useState('Plomería');
  const [editTechPhone, setEditTechPhone] = useState('');
  const [editTechEmail, setEditTechEmail] = useState('');
  const [editTechZone, setEditTechZone] = useState('');
  const [editTechProvince, setEditTechProvince] = useState('CABA');
  const [editTechAlsoCustomer, setEditTechAlsoCustomer] = useState(false);
  const [editTechAddress, setEditTechAddress] = useState('');
  const [editTechNeighborhood, setEditTechNeighborhood] = useState('');

  // New Material Form state
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<MaterialCategory>('Plomería');
  const [newMatStock, setNewMatStock] = useState<number>(20);
  const [newMatUnit, setNewMatUnit] = useState('unidades');
  const [newMatCost, setNewMatCost] = useState<number>(3500);

  const [editMatName, setEditMatName] = useState('');
  const [editMatCategory, setEditMatCategory] = useState<MaterialCategory>('Plomería');
  const [editMatStock, setEditMatStock] = useState<number>(0);
  const [editMatUnit, setEditMatUnit] = useState('unidades');
  const [editMatCost, setEditMatCost] = useState<number>(0);

  // Services state & modals
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('all');
  const [serviceSortBy, setServiceSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'duration'>('price-asc');
  const [isNewServiceModalOpen, setIsNewServiceModalOpen] = useState(false);
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<ServiceItem | null>(null);
  const [servicePendingDelete, setServicePendingDelete] = useState<ServiceItem | null>(null);

  // New Service Form state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<number>(18500);
  const [newServiceCategory, setNewServiceCategory] = useState('Plomería');
  const [newServiceDuration, setNewServiceDuration] = useState<number>(60);
  const [newServiceFeatures, setNewServiceFeatures] = useState('');

  // Edit Service Form state
  const [editServiceName, setEditServiceName] = useState('');
  const [editServiceDesc, setEditServiceDesc] = useState('');
  const [editServicePrice, setEditServicePrice] = useState<number>(18500);
  const [editServiceCategory, setEditServiceCategory] = useState('Plomería');
  const [editServiceDuration, setEditServiceDuration] = useState<number>(60);
  const [editServiceFeatures, setEditServiceFeatures] = useState('');

  // Categories state & modals
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ServiceCategory | null>(null);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<ServiceCategory | null>(null);

  // New Category Form state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('Sparkles');

  // Edit Category Form state
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDesc, setEditCategoryDesc] = useState('');
  const [editCategoryIcon, setEditCategoryIcon] = useState('Sparkles');

  const getServiceCategoryIcon = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('plom') || cat.includes('agua') || cat.includes('cañ')) {
      return <Wrench className="w-4 h-4 text-sky-600" />;
    }
    if (cat.includes('elect') || cat.includes('luz') || cat.includes('tensión')) {
      return <Zap className="w-4 h-4 text-amber-500" />;
    }
    if (cat.includes('repar') || cat.includes('hogar') || cat.includes('cerraj')) {
      return <Hammer className="w-4 h-4 text-rose-500" />;
    }
    if (cat.includes('manten') || cat.includes('prevent') || cat.includes('general')) {
      return <Settings className="w-4 h-4 text-emerald-600" />;
    }
    if (cat.includes('instal') || cat.includes('equipo') || cat.includes('tv') || cat.includes('aire')) {
      return <ShieldCheck className="w-4 h-4 text-teal-600" />;
    }
    return <Sparkles className="w-4 h-4 text-teal-600" />;
  };

  const availableServiceCategories = useMemo(() => {
    const fromCategories = serviceCategories.map((c) => c.name).filter(Boolean);
    const fromServices = services.map((s) => s.category).filter(Boolean);
    return Array.from(new Set([...fromCategories, ...fromServices]));
  }, [serviceCategories, services]);

  // Service metrics
  const serviceMetrics = useMemo(() => {
    const total = services.length;
    const totalCost = services.reduce((acc, s) => acc + (s.price || 0), 0);
    const avgPrice = total > 0 ? Math.round(totalCost / total) : 0;
    const uniqueCats = Array.from(new Set(services.map((s) => s.category || 'General')));
    const avgDuration =
      total > 0
        ? Math.round(
            services.reduce((acc, s) => acc + (s.estimatedDurationMinutes || 60), 0) / total
          )
        : 60;
    return { total, avgPrice, uniqueCategoriesCount: uniqueCats.length, avgDuration };
  }, [services]);

  // Filtered Services
  const filteredServices = useMemo(() => {
    return services
      .filter((srv) => {
        const matchesSearch =
          serviceSearchQuery === '' ||
          srv.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
          srv.description.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
          srv.category.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
          (srv.features &&
            srv.features.some((f) => f.toLowerCase().includes(serviceSearchQuery.toLowerCase())));

        const matchesCategory =
          serviceCategoryFilter === 'all' || srv.category === serviceCategoryFilter;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (serviceSortBy === 'price-asc') return a.price - b.price;
        if (serviceSortBy === 'price-desc') return b.price - a.price;
        if (serviceSortBy === 'duration')
          return (a.estimatedDurationMinutes || 60) - (b.estimatedDurationMinutes || 60);
        return a.name.localeCompare(b.name);
      });
  }, [services, serviceSearchQuery, serviceCategoryFilter, serviceSortBy]);

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = orders.length;
    const active = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;
    const inProgress = orders.filter((o) => o.status === 'in_progress').length;
    const paused = orders.filter((o) => o.status === 'paused').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const urgent = orders.filter(
      (o) => (o.priority === 'urgente' || o.priority === 'alta') && o.status !== 'completed'
    ).length;

    return { total, active, inProgress, paused, completed, urgent };
  }, [orders]);

  const applyQuickFilter = (filter: Exclude<OrderQuickFilter, 'all'>) => {
    const shouldClear = quickFilter === filter;
    setActiveTab('orders');
    setQuickFilter(shouldClear ? 'all' : filter);
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setTechFilter('all');
    setServiceFilter('all');
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search
      const matchesSearch =
        searchQuery === '' ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.clientAddress.toLowerCase().includes(searchQuery.toLowerCase());

      // Status
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      const matchesQuickFilter =
        quickFilter === 'all' ||
        (quickFilter === 'active' && order.status !== 'completed' && order.status !== 'cancelled') ||
        (quickFilter === 'in_progress' && order.status === 'in_progress') ||
        (quickFilter === 'paused' && order.status === 'paused') ||
        (quickFilter === 'urgent' &&
          (order.priority === 'urgente' || order.priority === 'alta') &&
          order.status !== 'completed') ||
        (quickFilter === 'completed' && order.status === 'completed');

      // Priority
      const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;

      // Tech
      const matchesTech =
        techFilter === 'all' ||
        (techFilter === 'unassigned' && !order.assignedTechnicianId) ||
        order.assignedTechnicianId === techFilter;

      // Service
      const matchesService = serviceFilter === 'all' || order.serviceType === serviceFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesQuickFilter &&
        matchesPriority &&
        matchesTech &&
        matchesService
      );
    });
  }, [orders, searchQuery, statusFilter, quickFilter, priorityFilter, techFilter, serviceFilter]);

  const openEditOrder = (order: ServiceOrder) => {
    setOrderToEdit(order);
    setEditOrderTitle(order.title);
    setEditOrderDesc(order.description);
    setEditOrderService(order.serviceType);
    setEditOrderPriority(order.priority);
    setEditOrderClientId(order.clientId);
    setEditOrderTechId(order.assignedTechnicianId ?? '');
    setEditOrderDate(toDateInputValue(order.scheduledDate));
    setIsEditModalOpen(true);
  };

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderTitle.trim() || !newOrderClientId) return;

    createOrder({
      title: newOrderTitle.trim(),
      description: newOrderDesc.trim() || 'Servicio técnico a domicilio',
      serviceType: newOrderService,
      priority: newOrderPriority,
      clientId: newOrderClientId,
      assignedTechnicianId: newOrderTechId || undefined,
      scheduledDate: newOrderDate,
    });

    setIsCreateModalOpen(false);
    setNewOrderTitle('');
    setNewOrderDesc('');
    setNewOrderDate(new Date().toISOString().slice(0, 10));
  };

  const handleEditOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToEdit || !editOrderTitle.trim() || !editOrderClientId) return;

    updateOrder(orderToEdit.id, {
      title: editOrderTitle.trim(),
      description: editOrderDesc.trim() || 'Servicio técnico a domicilio',
      serviceType: editOrderService,
      priority: editOrderPriority,
      clientId: editOrderClientId,
      assignedTechnicianId: editOrderTechId || null,
      scheduledDate: editOrderDate,
    });

    setIsEditModalOpen(false);
    setOrderToEdit(null);
  };

  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustAddress.trim()) return;

    addCustomer({
      name: newCustName.trim(),
      address: newCustAddress.trim(),
      neighborhood: newCustNeighborhood.trim() || 'CABA',
      phone: newCustPhone.trim() || '+54 9 11 0000-0000',
      email: newCustEmail.trim() || 'cliente@ejemplo.com',
      notes: newCustNotes.trim() || undefined,
    });

    setIsNewCustomerModalOpen(false);
    setNewCustName('');
    setNewCustAddress('');
    setNewCustNeighborhood('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustNotes('');
  };

  const openEditCustomer = (customer: Customer) => {
    setCustomerToEdit(customer);
    setEditCustName(customer.name);
    setEditCustAddress(customer.address);
    setEditCustNeighborhood(customer.neighborhood);
    setEditCustPhone(customer.phone);
    setEditCustEmail(customer.email);
    setEditCustNotes(customer.notes ?? '');
    setIsEditCustomerModalOpen(true);
  };

  const handleEditCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToEdit || !editCustName.trim() || !editCustAddress.trim()) return;

    updateCustomer(customerToEdit.id, {
      name: editCustName.trim(),
      address: editCustAddress.trim(),
      neighborhood: editCustNeighborhood.trim() || 'CABA',
      phone: editCustPhone.trim() || '+54 9 11 0000-0000',
      email: editCustEmail.trim() || 'cliente@ejemplo.com',
      notes: editCustNotes.trim() || undefined,
    });

    setIsEditCustomerModalOpen(false);
    setCustomerToEdit(null);
  };

  const handleConfirmDeleteCustomer = () => {
    if (!customerPendingDelete) return;
    const result = deleteCustomer(customerPendingDelete.id);
    if (result.success) setCustomerPendingDelete(null);
    else setCustomerPendingDelete(null);
  };

  const resetNewTechnicianForm = () => {
    setNewTechName('');
    setNewTechSpecialty('Plomería');
    setNewTechPhone('');
    setNewTechEmail('');
    setNewTechZone('');
    setNewTechProvince('CABA');
    setNewTechAlsoCustomer(false);
    setNewTechAddress('');
    setNewTechNeighborhood('');
  };

  const handleApproveApplication = (app: TechnicianApplication) => {
    setNewTechName(app.fullName);
    setNewTechSpecialty(app.specialty);
    setNewTechPhone(app.phone);
    setNewTechEmail(app.email);
    setNewTechZone('');
    setNewTechProvince('CABA');
    setNewTechAlsoCustomer(false);
    setNewTechAddress('');
    setNewTechNeighborhood('');
    setIsNewTechnicianModalOpen(true);
    showToast('Solicitud aprobada. Completá la ficha para darlo de alta.', 'success');
  };

  const handleCreateTechnicianSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTechName.trim() || !newTechEmail.trim()) return;

    addTechnician({
      name: newTechName.trim(),
      specialty: newTechSpecialty.trim() || 'General',
      phone: newTechPhone.trim() || '+54 9 11 0000-0000',
      email: newTechEmail.trim(),
      zone: newTechZone.trim(),
      province: newTechProvince,
      alsoAsCustomer: newTechAlsoCustomer,
      customerAddress: newTechAddress.trim() || undefined,
      customerNeighborhood: newTechNeighborhood.trim() || newTechZone.trim() || undefined,
    });

    setIsNewTechnicianModalOpen(false);
    resetNewTechnicianForm();
  };

  const openEditTechnician = (tech: Technician) => {
    const linkedCustomer =
      (tech.customerId ? customers.find((c) => c.id === tech.customerId) : undefined) ||
      customers.find((c) => c.email && tech.email && c.email.toLowerCase() === tech.email.toLowerCase());

    setTechnicianToEdit(tech);
    setEditTechName(tech.name);
    setEditTechSpecialty(tech.specialty);
    setEditTechPhone(tech.phone);
    setEditTechEmail(tech.email);
    setEditTechZone(tech.zone ?? '');
    setEditTechProvince(tech.province || 'CABA');
    setEditTechAlsoCustomer(Boolean(linkedCustomer || tech.customerId));
    setEditTechAddress(linkedCustomer?.address ?? '');
    setEditTechNeighborhood(linkedCustomer?.neighborhood ?? '');
    setIsEditTechnicianModalOpen(true);
  };

  const handleEditTechnicianSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!technicianToEdit || !editTechName.trim() || !editTechEmail.trim()) return;

    updateTechnician(technicianToEdit.id, {
      name: editTechName.trim(),
      specialty: editTechSpecialty.trim() || 'General',
      phone: editTechPhone.trim() || '+54 9 11 0000-0000',
      email: editTechEmail.trim(),
      zone: editTechZone.trim(),
      province: editTechProvince,
      rating: technicianToEdit.rating,
      alsoAsCustomer: editTechAlsoCustomer,
      customerAddress: editTechAddress.trim() || undefined,
      customerNeighborhood: editTechNeighborhood.trim() || editTechZone.trim() || undefined,
    });

    setIsEditTechnicianModalOpen(false);
    setTechnicianToEdit(null);
  };

  const handleConfirmDeleteTechnician = () => {
    if (!technicianPendingDelete) return;
    deleteTechnician(technicianPendingDelete.id);
    setTechnicianPendingDelete(null);
  };

  const handleGenerateInvite = async (kind: 'technician' | 'customer', id: string, name: string) => {
    try {
      const url = await createAccountInviteLink(kind, id);
      setInviteLinkModal({ kind, name, url });
      try {
        await navigator.clipboard.writeText(url);
        showToast('Enlace copiado al portapapeles', 'success', 'Invitación lista');
      } catch {
        showToast('Enlace generado. Copialo desde el cuadro.', 'info');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo generar el enlace', 'error');
    }
  };

  const handleCreateMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim()) return;

    addMaterialToInventory({
      name: newMatName.trim(),
      category: newMatCategory,
      stock: Number(newMatStock) || 0,
      unit: newMatUnit.trim() || 'unidades',
      costEstimate: Number(newMatCost) || 0,
    });

    setIsNewMaterialModalOpen(false);
    setNewMatName('');
    setNewMatCategory('Plomería');
    setNewMatStock(20);
    setNewMatUnit('unidades');
    setNewMatCost(3500);
  };

  const openEditMaterial = (mat: MaterialInventory) => {
    setMaterialToEdit(mat);
    setEditMatName(mat.name);
    setEditMatCategory(mat.category);
    setEditMatStock(mat.stock);
    setEditMatUnit(mat.unit);
    setEditMatCost(mat.costEstimate);
    setIsEditMaterialModalOpen(true);
  };

  const handleEditMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialToEdit || !editMatName.trim()) return;

    updateMaterial(materialToEdit.id, {
      name: editMatName.trim(),
      category: editMatCategory,
      stock: Number(editMatStock) || 0,
      unit: editMatUnit.trim() || 'unidades',
      costEstimate: Number(editMatCost) || 0,
    });

    setIsEditMaterialModalOpen(false);
    setMaterialToEdit(null);
  };

  const handleConfirmDeleteMaterial = () => {
    if (!materialPendingDelete) return;
    deleteMaterial(materialPendingDelete.id);
    setMaterialPendingDelete(null);
  };

  // Service CRUD handlers
  const handleCreateServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServiceDesc.trim()) return;

    const featuresList = newServiceFeatures
      .split('\n')
      .map((f) => f.trim().replace(/^[•\-\*]\s*/, ''))
      .filter(Boolean);

    addService({
      name: newServiceName.trim(),
      description: newServiceDesc.trim(),
      price: Number(newServicePrice) || 0,
      category: newServiceCategory.trim() || 'General',
      estimatedDurationMinutes: Number(newServiceDuration) || 60,
      features: featuresList.length > 0 ? featuresList : ['Garantía de calidad', 'Personal calificado'],
      active: true,
    });

    setIsNewServiceModalOpen(false);
    setNewServiceName('');
    setNewServiceDesc('');
    setNewServicePrice(18500);
    setNewServiceCategory(availableServiceCategories[0] || 'General');
    setNewServiceDuration(60);
    setNewServiceFeatures('');
  };

  const openEditService = (srv: ServiceItem) => {
    setServiceToEdit(srv);
    setEditServiceName(srv.name);
    setEditServiceDesc(srv.description);
    setEditServicePrice(srv.price);
    setEditServiceCategory(srv.category);
    setEditServiceDuration(srv.estimatedDurationMinutes || 60);
    setEditServiceFeatures((srv.features || []).join('\n'));
    setIsEditServiceModalOpen(true);
  };

  const handleEditServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceToEdit || !editServiceName.trim() || !editServiceDesc.trim()) return;

    const featuresList = editServiceFeatures
      .split('\n')
      .map((f) => f.trim().replace(/^[•\-\*]\s*/, ''))
      .filter(Boolean);

    updateService(serviceToEdit.id, {
      name: editServiceName.trim(),
      description: editServiceDesc.trim(),
      price: Number(editServicePrice) || 0,
      category: editServiceCategory.trim() || 'General',
      estimatedDurationMinutes: Number(editServiceDuration) || 60,
      features: featuresList.length > 0 ? featuresList : ['Garantía escrita'],
    });

    setIsEditServiceModalOpen(false);
    setServiceToEdit(null);
  };

  const handleDuplicateService = (srv: ServiceItem) => {
    addService({
      name: `${srv.name} (Copia)`,
      description: srv.description,
      price: srv.price,
      category: srv.category,
      estimatedDurationMinutes: srv.estimatedDurationMinutes,
      features: [...(srv.features || [])],
      active: true,
    });
  };

  const handleConfirmDeleteService = () => {
    if (!servicePendingDelete) return;
    deleteService(servicePendingDelete.id);
    setServicePendingDelete(null);
  };

  const handleQuickCreateOrderFromService = (srv: ServiceItem) => {
    setNewOrderTitle(srv.name);
    setNewOrderDesc(srv.description);
    setNewOrderService(srv.category as ServiceType);
    setIsCreateModalOpen(true);
  };

  // Category CRUD handlers
  const handleCreateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !newCategoryDesc.trim()) return;

    const visual = getCategoryVisual(newCategoryIcon);
    addServiceCategory({
      name: newCategoryName.trim(),
      description: newCategoryDesc.trim(),
      icon: newCategoryIcon,
      color: `${visual.bg} ${visual.border}`,
      active: true,
    });

    setIsNewCategoryModalOpen(false);
    setNewCategoryName('');
    setNewCategoryDesc('');
    setNewCategoryIcon('Sparkles');
  };

  const openEditCategory = (cat: ServiceCategory) => {
    setCategoryToEdit(cat);
    setEditCategoryName(cat.name);
    setEditCategoryDesc(cat.description);
    setEditCategoryIcon(cat.icon || 'Sparkles');
    setIsEditCategoryModalOpen(true);
  };

  const handleEditCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToEdit || !editCategoryName.trim() || !editCategoryDesc.trim()) return;

    const visual = getCategoryVisual(editCategoryIcon);
    updateServiceCategory(categoryToEdit.id, {
      name: editCategoryName.trim(),
      description: editCategoryDesc.trim(),
      icon: editCategoryIcon,
      color: `${visual.bg} ${visual.border}`,
    });

    setIsEditCategoryModalOpen(false);
    setCategoryToEdit(null);
  };

  const handleToggleCategoryActive = (cat: ServiceCategory) => {
    updateServiceCategory(cat.id, { active: cat.active === false });
  };

  const handleConfirmDeleteCategory = () => {
    if (!categoryPendingDelete) return;
    const result = deleteServiceCategory(categoryPendingDelete.id);
    if (!result.success) {
      showToast(result.message, 'error', 'No se puede eliminar');
    }
    setCategoryPendingDelete(null);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16" id="admin-hub-container">
      {/* Top Banner / Header */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#0F172A] text-teal-400 border border-slate-800 shadow-xs">
                  <LayoutDashboard className="w-4 h-4" />
                </span>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Panel Operativo — Admin Hub
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/10 text-teal-700 border border-teal-500/30">
                  LIVE OPERATIONS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Despacho y monitoreo continuo de órdenes técnicas, inventario y asignación de campo.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-teal-300 hover:text-white text-xs font-bold rounded-lg shadow-xs transition-colors border border-slate-700"
                id="btn-create-order-open"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>Nueva Orden</span>
              </button>
            </div>
          </div>

          {/* Metric Cards Row - High Density compact cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-4">
            {/* Activas */}
            <button
              type="button"
              onClick={() => applyQuickFilter('active')}
              aria-pressed={quickFilter === 'active'}
              title="Filtrar órdenes activas"
              className={`bg-slate-900 text-slate-100 p-3 rounded-lg border shadow-xs flex flex-col justify-between text-left transition-all focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 ${
                quickFilter === 'active'
                  ? 'border-teal-400 ring-2 ring-teal-400/70'
                  : 'border-slate-800 hover:border-teal-400 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-semibold uppercase tracking-wider font-mono">Activas</span>
                <Clock className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-white">{metrics.active}</div>
                <span className="text-[10px] text-teal-400 font-mono font-semibold">Total: {metrics.total}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">En gestión operativa</div>
            </button>

            {/* En curso */}
            <button
              type="button"
              onClick={() => applyQuickFilter('in_progress')}
              aria-pressed={quickFilter === 'in_progress'}
              title="Filtrar órdenes en curso"
              className={`bg-white p-3 rounded-lg border shadow-2xs flex flex-col justify-between text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                quickFilter === 'in_progress'
                  ? 'border-emerald-500 ring-2 ring-emerald-300'
                  : 'border-emerald-300 hover:border-emerald-500 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-emerald-800 mb-1">
                <span className="font-semibold uppercase tracking-wider font-mono">En Curso</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-emerald-900">{metrics.inProgress}</div>
                <span className="text-[10px] text-emerald-600 font-semibold font-mono">En sitio</span>
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5 truncate">Trabajo activo</div>
            </button>

            {/* Pausadas */}
            <button
              type="button"
              onClick={() => applyQuickFilter('paused')}
              aria-pressed={quickFilter === 'paused'}
              title="Filtrar órdenes pausadas"
              className={`bg-white p-3 rounded-lg border shadow-2xs flex flex-col justify-between text-left transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                quickFilter === 'paused'
                  ? 'border-amber-500 ring-2 ring-amber-300'
                  : 'border-amber-300 hover:border-amber-500 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-amber-800 mb-1">
                <span className="font-semibold uppercase tracking-wider font-mono">Pausadas</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-amber-900">{metrics.paused}</div>
                <span className="text-[10px] text-amber-700 font-mono font-semibold">Insumos</span>
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5 truncate">En espera</div>
            </button>

            {/* Urgentes / Altas */}
            <button
              type="button"
              onClick={() => applyQuickFilter('urgent')}
              aria-pressed={quickFilter === 'urgent'}
              title="Filtrar órdenes urgentes y de alta prioridad"
              className={`bg-white p-3 rounded-lg border shadow-2xs flex flex-col justify-between text-left transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 ${
                quickFilter === 'urgent'
                  ? 'border-rose-500 ring-2 ring-rose-300'
                  : 'border-rose-300 hover:border-rose-500 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-rose-800 mb-1">
                <span className="font-semibold uppercase tracking-wider font-mono">Urgentes</span>
                <Flame className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-rose-900">{metrics.urgent}</div>
                <span className="text-[10px] text-rose-600 font-mono font-semibold">Alta prioridad</span>
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5 truncate">Atención prioritaria</div>
            </button>

            {/* Finalizadas */}
            <button
              type="button"
              onClick={() => applyQuickFilter('completed')}
              aria-pressed={quickFilter === 'completed'}
              title="Filtrar órdenes finalizadas"
              className={`bg-white p-3 rounded-lg border shadow-2xs col-span-2 sm:col-span-1 flex flex-col justify-between text-left transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                quickFilter === 'completed'
                  ? 'border-teal-500 ring-2 ring-teal-200'
                  : 'border-slate-200 hover:border-teal-500 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-[#003875] mb-1">
                <span className="font-semibold uppercase tracking-wider font-mono">Finalizadas</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-slate-900">{metrics.completed}</div>
                <span className="text-[10px] text-teal-700 font-mono font-semibold">Cerradas</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">Con firma digital</div>
            </button>
          </div>

          {/* Sub Navigation Tabs - High density */}
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'orders'
                  ? 'bg-[#0F172A] text-teal-300 shadow-xs border border-slate-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Órdenes ({orders.length})</span>
            </button>

            <button
              onClick={() => { window.location.hash = '#/admin/clientes'; }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Abrir planilla completa de clientes"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes · planilla ({customers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('technicians')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'technicians'
                  ? 'bg-[#0F172A] text-teal-300 shadow-xs border border-slate-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Técnicos ({technicians.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-[#0F172A] text-teal-300 shadow-xs border border-slate-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Inventario ({materials.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'services'
                  ? 'bg-[#0F172A] text-teal-300 shadow-xs border border-slate-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              id="tab-btn-services"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Servicios ({services.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'categories'
                  ? 'bg-[#0F172A] text-teal-300 shadow-xs border border-slate-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              id="tab-btn-categories"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Categorías ({serviceCategories.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 pt-4">
        {/* ================= TAB 1: ORDERS ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            {/* Filters Bar - High Density */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {/* Search */}
                <div className="relative lg:col-span-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por ID, cliente, dirección o servicio..."
                    className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-700"
                  >
                    <option value="all">Todos los Estados</option>
                    <option value="assigned">Asignadas</option>
                    <option value="in_progress">En curso</option>
                    <option value="paused">Pausadas</option>
                    <option value="completed">Finalizadas</option>
                    <option value="cancelled">Canceladas</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-700"
                  >
                    <option value="all">Todas las Prioridades</option>
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>

                {/* Technician Filter */}
                <div>
                  <select
                    value={techFilter}
                    onChange={(e) => setTechFilter(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-700"
                  >
                    <option value="all">Todos los Técnicos</option>
                    <option value="tech-carlos">Carlos Méndez</option>
                    <option value="tech-maria">María Rodríguez</option>
                    <option value="unassigned">Sin Asignar</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Orders Table / Cards List */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No se encontraron órdenes</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Probá ajustando los filtros de búsqueda o creá una nueva orden de servicio.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setPriorityFilter('all');
                    setTechFilter('all');
                  }}
                  className="mt-4 text-xs font-bold text-teal-600 hover:text-teal-700"
                >
                  Restablecer filtros
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const completedChecklistCount = order.checklist.filter((c) => c.completed).length;
                    const totalChecklist = order.checklist.length;
                    const hasSignature = !!order.customerSignature;
                    const quoteRejected = order.quotes?.some((quote) => quote.status === 'rejected');

                    return (
                      <div
                        key={order.id}
                        className="p-3 sm:p-3.5 hover:bg-slate-50/90 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                      >
                        {/* Order Core Info */}
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              {order.id}
                            </span>
                            <StatusBadge status={order.status} size="sm" />
                            {quoteRejected && (
                              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                Presupuesto rechazado · seña en revisión
                              </span>
                            )}
                            <PriorityBadge priority={order.priority} />
                            <ServiceBadge service={order.serviceType} size="sm" />
                            <PaymentStatusBadge order={order} size="sm" />
                          </div>

                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                            {order.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <strong className="text-slate-700">{order.clientName}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{order.clientAddress}</span>
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[10px]">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{order.scheduledDate}</span>
                            </span>
                          </div>
                        </div>

                        {/* Middle status: Technician & Progress summary */}
                        <div className="flex flex-wrap lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-1.5 text-xs border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                          {/* Technician badge */}
                          <div className="flex items-center gap-1.5">
                            <Wrench className="w-3 h-3 text-teal-600" />
                            {order.assignedTechnicianName ? (
                              <span className="font-semibold text-slate-800 text-xs">
                                {order.assignedTechnicianName}
                              </span>
                            ) : (
                              <span className="text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[10px] font-bold">
                                Sin asignar
                              </span>
                            )}
                          </div>

                          {/* Progress pills */}
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono ${
                                completedChecklistCount === totalChecklist && totalChecklist > 0
                                  ? 'bg-teal-500/10 text-teal-700 font-bold border border-teal-500/20'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              Checklist: {completedChecklistCount}/{totalChecklist}
                            </span>

                            {hasSignature && (
                              <span className="inline-flex items-center gap-1 bg-[#0F172A] text-teal-300 px-1.5 py-0.2 rounded font-bold font-mono text-[10px]">
                                <FileSignature className="w-2.5 h-2.5" />
                                Firmada
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          <button
                            onClick={() => {
                              setOrderToAssign(order);
                              setIsAssignModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors border border-slate-200"
                            title="Asignar o reasignar técnico"
                          >
                            Asignar
                          </button>

                          <button
                            onClick={() => openEditOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-md transition-colors border border-slate-200"
                            title="Editar orden"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Editar</span>
                          </button>

                          {order.status !== 'completed' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => { setOrderToCancel(order); setCancelReason(''); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold rounded-md transition-colors border border-slate-200"
                              title="Cancelar orden con motivo"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Cancelar</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedOrderId(order.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-teal-300 hover:text-white text-xs font-bold rounded-md shadow-xs transition-colors border border-slate-700"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Detalle</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: CUSTOMERS ================= */}
        {activeTab === 'customers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Directorio de Clientes</h2>
                <p className="text-[11px] text-slate-500">
                  Alta, edición y baja de cuentas para servicios a domicilio.
                </p>
              </div>
              <button
                onClick={() => setIsNewCustomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>Nuevo Cliente</span>
              </button>
            </div>

            {customers.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                <h3 className="text-sm font-bold text-slate-800">No hay clientes cargados</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Creá el primero para poder asignarlo a nuevas órdenes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {customers.map((c) => {
                  const customerOrders = orders.filter((o) => o.clientId === c.id);
                  const activeCount = customerOrders.filter(
                    (o) => o.status !== 'completed' && o.status !== 'cancelled'
                  ).length;

                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-teal-300 flex items-center justify-center font-bold text-xs font-mono border border-slate-800">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <AccountBadge hasAccount={Boolean(c.profileId)} />
                            <EntityActionsMenu
                              items={[
                                {
                                  id: 'edit',
                                  label: 'Editar',
                                  icon: 'edit',
                                  onSelect: () => openEditCustomer(c),
                                },
                                {
                                  id: 'invite',
                                  label: c.profileId ? 'Ya tiene cuenta' : 'Generar enlace de cuenta',
                                  icon: 'invite',
                                  disabled: Boolean(c.profileId) || !c.email,
                                  hint: !c.email
                                    ? 'Completá el email primero'
                                    : c.profileId
                                      ? 'Esta ficha ya está vinculada'
                                      : undefined,
                                  onSelect: () => handleGenerateInvite('customer', c.id, c.name),
                                },
                                {
                                  id: 'delete',
                                  label: 'Eliminar',
                                  icon: 'delete',
                                  onSelect: () => setCustomerPendingDelete(c),
                                },
                              ]}
                            />
                          </div>
                        </div>

                        <h3 className="font-bold text-xs sm:text-sm text-slate-900">{c.name}</h3>

                        <div className="space-y-1 mt-2 text-[11px] text-slate-600">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span>
                              {c.address} ({c.neighborhood})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{c.phone}</span>
                          </div>
                          {c.email && (
                            <div className="text-[10px] text-slate-500 truncate">{c.email}</div>
                          )}
                        </div>

                        {c.notes && (
                          <div className="mt-2 p-2 bg-slate-50 rounded text-[10px] text-slate-500 border border-slate-100 italic">
                            "{c.notes}"
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            Órdenes:{' '}
                            <strong className="font-mono text-slate-800">{customerOrders.length}</strong>
                          </span>
                          {activeCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-[10px]">
                              {activeCount} activa{activeCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            )}
          </div>
        )}

        {/* ================= TAB 3: TECHNICIANS ================= */}
        {activeTab === 'technicians' && (
          <div className="space-y-3">
            <TechnicianApplications onApprove={handleApproveApplication} />
            <TechnicianValidation />
            <PayoutScheduler />
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Cuadrilla de Técnicos</h2>
                <p className="text-[11px] text-slate-500">
                  Fichas operativas. Pueden existir sin cuenta; más adelante se vinculan al registrarse.
                </p>
              </div>
              <button
                onClick={() => setIsNewTechnicianModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>Nuevo Técnico</span>
              </button>
            </div>

            {technicians.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                <h3 className="text-sm font-bold text-slate-800">No hay técnicos cargados</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Creá el primero para poder asignarlo a las órdenes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {technicians.map((t) => {
                  const techOrders = orders.filter((o) => o.assignedTechnicianId === t.id);
                  const activeCount = techOrders.filter(
                    (o) => o.status !== 'completed' && o.status !== 'cancelled'
                  ).length;
                  const alsoCustomer = Boolean(
                    t.customerId ||
                      customers.some(
                        (c) => c.email && t.email && c.email.toLowerCase() === t.email.toLowerCase()
                      )
                  );

                  return (
                    <div
                      key={t.id}
                      className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={`w-8 h-8 rounded-lg ${t.avatarBg} text-white flex items-center justify-center font-bold text-xs font-mono`}
                          >
                            {t.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <AccountBadge hasAccount={Boolean(t.profileId)} />
                            <EntityActionsMenu
                              items={[
                                {
                                  id: 'edit',
                                  label: 'Editar',
                                  icon: 'edit',
                                  onSelect: () => openEditTechnician(t),
                                },
                                {
                                  id: 'invite',
                                  label: t.profileId ? 'Ya tiene cuenta' : 'Generar enlace de cuenta',
                                  icon: 'invite',
                                  disabled: Boolean(t.profileId) || !t.email,
                                  hint: !t.email
                                    ? 'Completá el email primero'
                                    : t.profileId
                                      ? 'Esta ficha ya está vinculada'
                                      : undefined,
                                  onSelect: () => handleGenerateInvite('technician', t.id, t.name),
                                },
                                {
                                  id: 'delete',
                                  label: 'Eliminar',
                                  icon: 'delete',
                                  onSelect: () => setTechnicianPendingDelete(t),
                                },
                              ]}
                            />
                          </div>
                        </div>

                        <h3 className="font-bold text-xs sm:text-sm text-slate-900">{t.name}</h3>
                        <p className="text-[11px] text-teal-700 font-semibold mt-0.5">{t.specialty}</p>

                        <div className="space-y-1 mt-2 text-[11px] text-slate-600">
                          {(t.zone || t.province) && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span>
                                {[t.zone, t.province].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{t.phone}</span>
                          </div>
                          {t.email && (
                            <div className="text-[10px] text-slate-500 truncate">{t.email}</div>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className={`px-1.5 py-0.2 rounded border font-mono font-bold text-[10px] ${t.isAvailable ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {t.isAvailable ? 'Disponible' : 'No disponible'}
                          </span>
                          {alsoCustomer && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-[10px]">
                              También cliente
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded bg-slate-50 text-slate-600 border border-slate-200 font-mono font-bold text-[10px]">
                            Rating {t.rating}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            Órdenes:{' '}
                            <strong className="font-mono text-slate-800">{techOrders.length}</strong>
                          </span>
                          {activeCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-[10px]">
                              {activeCount} activa{activeCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: INVENTORY ================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Inventario de materiales</h2>
                <p className="text-[11px] text-slate-500">
                  Alta, edición y baja de repuestos e insumos técnicos de campo.
                </p>
              </div>
              <button
                onClick={() => setIsNewMaterialModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>Añadir Material</span>
              </button>
            </div>

            {materials.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                <h3 className="text-sm font-bold text-slate-800">No hay materiales cargados</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Creá el primero para controlar stock de campo.
                </p>
              </div>
            ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold font-mono uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">Material / Insumo</th>
                      <th className="py-2.5 px-3.5">Categoría</th>
                      <th className="py-2.5 px-3.5">Stock Disponible</th>
                      <th className="py-2.5 px-3.5">Unidad</th>
                      <th className="py-2.5 px-3.5">Costo Estimado</th>
                      <th className="py-2.5 px-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((mat) => {
                      const isLowStock = mat.stock < 15;
                      return (
                        <tr key={mat.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3.5 font-semibold text-slate-900">{mat.name}</td>
                          <td className="py-2.5 px-3.5">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {mat.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[11px] font-mono font-bold ${
                                isLowStock
                                  ? 'bg-rose-50 text-rose-800 border border-rose-300'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {mat.stock}
                              {isLowStock && <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">{mat.unit}</td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-700 font-semibold">
                            ${mat.costEstimate.toLocaleString('es-AR')}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => updateMaterialStock(mat.id, Math.max(0, mat.stock - 5))}
                                className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded text-xs font-bold transition-colors border border-slate-200"
                                title="Restar 5 unidades"
                              >
                                -5
                              </button>
                              <button
                                onClick={() => updateMaterialStock(mat.id, mat.stock + 10)}
                                className="px-2 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 rounded text-xs font-bold transition-colors border border-slate-200"
                                title="Sumar 10 unidades"
                              >
                                +10
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditMaterial(mat)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded text-xs font-bold transition-colors border border-slate-200"
                                title="Editar material"
                              >
                                <Pencil className="w-3 h-3" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setMaterialPendingDelete(mat)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded text-xs font-bold transition-colors border border-slate-200"
                                title="Eliminar material"
                              >
                                <Trash2 className="w-3 h-3" />
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: SERVICES (ADMIN ONLY) ================= */}
        {activeTab === 'services' && (
          <div className="space-y-4" id="admin-services-tab-content">
            {/* Header & Quick Action */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Catálogo de Servicios Tarifados
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-teal-300">
                    ADMIN EXCLUSIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Configuración de tarifas comerciales, precios base de mano de obra, tiempos estimados y beneficios visibles en la app y el portal público.
                </p>
              </div>

              <button
                onClick={() => {
                  setNewServiceName('');
                  setNewServiceDesc('');
                  setNewServicePrice(18500);
                  setNewServiceCategory(availableServiceCategories[0] || 'General');
                  setNewServiceDuration(60);
                  setNewServiceFeatures('Diagnóstico y evaluación en sitio\nGarantía escrita de mano de obra\nRepuestos de primera calidad');
                  setIsNewServiceModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 shadow-xs shrink-0"
                id="btn-create-service-open"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>Nuevo Servicio</span>
              </button>
            </div>

            {/* Service Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Total Servicios</div>
                <div className="text-xl font-mono font-black text-slate-900 mt-0.5">{serviceMetrics.total}</div>
                <div className="text-[10px] text-teal-600 font-medium mt-0.5">En catálogo activo</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Precio Promedio</div>
                <div className="text-xl font-mono font-black text-teal-800 mt-0.5">
                  ${serviceMetrics.avgPrice.toLocaleString('es-AR')}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Mano de obra base</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Categorías</div>
                <div className="text-xl font-mono font-black text-slate-900 mt-0.5">{serviceMetrics.uniqueCategoriesCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Especialidades activas</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Duración Promedio</div>
                <div className="text-xl font-mono font-black text-slate-900 mt-0.5">{serviceMetrics.avgDuration} min</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tiempo en sitio estimado</div>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="relative sm:col-span-6">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={serviceSearchQuery}
                    onChange={(e) => setServiceSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre de servicio, categoría o descripción..."
                    className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={serviceCategoryFilter}
                    onChange={(e) => setServiceCategoryFilter(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-700"
                  >
                    <option value="all">Todas las Categorías</option>
                    {availableServiceCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={serviceSortBy}
                    onChange={(e) => setServiceSortBy(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-700"
                  >
                    <option value="price-asc">Precio: Menor a Mayor</option>
                    <option value="price-desc">Precio: Mayor a Menor</option>
                    <option value="name">Nombre: A - Z</option>
                    <option value="duration">Duración estimada</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Services Grid */}
            {filteredServices.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No se encontraron servicios</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Ajustá los filtros de búsqueda o creá un nuevo servicio para el catálogo.
                </p>
                <button
                  onClick={() => {
                    setServiceSearchQuery('');
                    setServiceCategoryFilter('all');
                  }}
                  className="mt-3 text-xs font-bold text-teal-600 hover:text-teal-700"
                >
                  Restablecer filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredServices.map((srv) => {
                  return (
                    <div
                      key={srv.id}
                      className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative"
                    >
                      <div className="space-y-3">
                        {/* Card Header: Category + Price Badge */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="p-1 rounded-md bg-slate-100 text-slate-700">
                              {getServiceCategoryIcon(srv.category)}
                            </span>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {srv.category}
                            </span>
                          </div>

                          <div className="text-right">
                            <div className="text-sm sm:text-base font-black font-mono text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              ${srv.price.toLocaleString('es-AR')}
                            </div>
                          </div>
                        </div>

                        {/* Title & Duration */}
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900 leading-snug group-hover:text-teal-700 transition-colors">
                            {srv.name}
                          </h3>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Tiempo estimado: {srv.estimatedDurationMinutes || 60} min</span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                          {srv.description}
                        </p>

                        {/* Features Tags */}
                        {srv.features && srv.features.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                              Beneficios incluidos
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {srv.features.map((f, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                                  <span>{f}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickCreateOrderFromService(srv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 shadow-2xs"
                          title="Generar nueva orden con este servicio"
                        >
                          <Plus className="w-3 h-3 text-teal-400" />
                          <span>Crear Orden</span>
                        </button>

                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateService(srv)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors"
                            title="Duplicar servicio"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditService(srv)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-md transition-colors"
                            title="Editar servicio"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setServicePendingDelete(srv)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-md transition-colors"
                            title="Eliminar servicio"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: CATEGORIES ================= */}
        {activeTab === 'categories' && (
          <div className="space-y-4" id="admin-categories-tab-content">
            {/* Header & Quick Action */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Layers className="w-4 h-4 text-indigo-600" />
                  </span>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Categorías de Servicios
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-teal-300">
                    ADMIN EXCLUSIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Rubros publicados en la landing. Cada categoría agrupa los servicios que el cliente ve al hacer clic.
                </p>
              </div>

              <button
                onClick={() => {
                  setNewCategoryName('');
                  setNewCategoryDesc('');
                  setNewCategoryIcon('Sparkles');
                  setIsNewCategoryModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 shadow-xs shrink-0"
                id="btn-create-category-open"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>Nueva Categoría</span>
              </button>
            </div>

            {/* Categories Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Categorías</div>
                <div className="text-xl font-mono font-black text-slate-900 mt-0.5">{serviceCategories.length}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Rubros publicados</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Activas</div>
                <div className="text-xl font-mono font-black text-teal-800 mt-0.5">
                  {serviceCategories.filter((c) => c.active !== false).length}
                </div>
                <div className="text-[10px] text-teal-600 mt-0.5">Visibles en la landing</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Inactivas</div>
                <div className="text-xl font-mono font-black text-slate-900 mt-0.5">
                  {serviceCategories.filter((c) => c.active === false).length}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Ocultas al público</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Servicios</div>
                <div className="text-xl font-mono font-black text-slate-900 mt-0.5">{services.length}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Repartidos por rubro</div>
              </div>
            </div>

            {/* Categories Grid */}
            {serviceCategories.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Sin categorías publicadas</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Creá tu primer rubro de servicio para que aparezca en la landing page.
                </p>
                <button
                  onClick={() => {
                    setNewCategoryName('');
                    setNewCategoryDesc('');
                    setNewCategoryIcon('Sparkles');
                    setIsNewCategoryModalOpen(true);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear categoría
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {serviceCategories.map((cat) => {
                  const visual = getCategoryVisual(cat.icon);
                  const count = services.filter(
                    (s) => (s.category || '').toLowerCase() === cat.name.toLowerCase()
                  ).length;
                  const isActive = cat.active !== false;

                  return (
                    <div
                      key={cat.id}
                      className={`bg-white rounded-xl p-4 border shadow-xs transition-all flex flex-col justify-between group relative ${
                        isActive ? 'border-slate-200/90 hover:shadow-md' : 'border-slate-200 opacity-70'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className={`p-2.5 rounded-xl ${visual.bg} ${visual.border} border ${visual.text}`}>
                              <CategoryIcon name={cat.icon} className="w-5 h-5" />
                            </span>
                            <div>
                              <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{cat.name}</h3>
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                                  isActive
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                {isActive ? 'Activa' : 'Inactiva'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{cat.description}</p>

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-medium">
                            {count} servicio{count !== 1 ? 's' : ''}
                          </span>
                          <span className="font-mono text-slate-400">{visual.label}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCategoryActive(cat)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                            isActive
                              ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              : 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'
                          }`}
                          title={isActive ? 'Ocultar del portal público' : 'Publicar en el portal público'}
                        >
                          {isActive ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              Ocultar
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              Publicar
                            </>
                          )}
                        </button>

                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditCategory(cat)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-md transition-colors"
                            title="Editar categoría"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryPendingDelete(cat)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-md transition-colors"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ================= MODAL: ORDER DETAILS & TIMELINE ================= */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-black text-[#003875] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {selectedOrder.id}
                  </span>
                  <StatusBadge status={selectedOrder.status} />
                  <PriorityBadge priority={selectedOrder.priority} />
                </div>
                <h2 className="text-lg font-black text-slate-900">{selectedOrder.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedOrder.description}</p>
              </div>
              <button
                onClick={() => setSelectedOrderId(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Cliente & Contacto:</span>
                <span className="font-bold text-slate-800">{selectedOrder.clientName}</span>
                <div className="text-slate-500">{selectedOrder.clientAddress}</div>
                <div className="text-slate-500">{selectedOrder.clientPhone}</div>
              </div>

              <div>
                <span className="text-slate-400 block font-medium">Técnico Asignado:</span>
                <span className="font-bold text-teal-800">
                  {selectedOrder.assignedTechnicianName || 'Sin asignar'}
                </span>
                <div className="text-slate-500">Programada: {selectedOrder.scheduledDate}</div>
              </div>

              <div>
                <span className="text-slate-400 block font-medium">Tipo de Servicio:</span>
                <div className="mt-1">
                  <ServiceBadge service={selectedOrder.serviceType} size="sm" />
                </div>
              </div>

              {orderRequiresPaymentGate(selectedOrder) && (
                <div>
                  <span className="text-slate-400 block font-medium">Estado de Pago:</span>
                  <div className="mt-1">
                    <PaymentStatusBadge order={selectedOrder} />
                  </div>
                </div>
              )}
            </div>

            {selectedOrder.adminIncidentStatus === 'open' && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <div className="font-bold flex items-center gap-1.5"><CircleAlert className="w-4 h-4" /> Incidencia en revisión</div>
                <p className="mt-1">{selectedOrder.adminIncidentReason}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-teal-950">
                <Clock className="w-4 h-4 text-teal-700" />
                <div>
                  <div className="font-bold">Tiempo operativo del servicio</div>
                  <div className="text-[10px] text-teal-800">
                    {selectedOrder.status === 'in_progress' ? 'El técnico está trabajando en este momento.' : 'Tiempo acumulado hasta la última pausa o finalización.'}
                  </div>
                </div>
              </div>
              <span className="font-mono font-black text-teal-900 text-sm">
                {formatElapsedTime(getOrderElapsedSeconds(selectedOrder, clockNow))}
              </span>
            </div>

            {/* Checklist progress */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Checklist Operativo ({selectedOrder.checklist.filter((c) => c.completed).length}/
                {selectedOrder.checklist.length})
              </h4>
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {selectedOrder.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        item.completed ? 'text-teal-600' : 'text-slate-300'
                      }`}
                    />
                    <span
                      className={
                        item.completed ? 'text-slate-800 font-medium' : 'text-slate-500'
                      }
                    >
                      {item.label}
                    </span>
                    {item.completedAt && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({item.completedAt} hs)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Used materials */}
            {selectedOrder.usedMaterials.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Materiales de Inventario Registrados
                </h4>
                <div className="divide-y divide-slate-100 bg-slate-50 rounded-xl border border-slate-200 p-3">
                  {selectedOrder.usedMaterials.map((mat) => (
                    <div key={mat.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{mat.materialName}</span>
                        {mat.note && <span className="text-slate-500 text-[11px] block">{mat.note}</span>}
                      </div>
                      <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                        {mat.quantity} {mat.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Signature info */}
            {selectedOrder.customerSignature && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <FileSignature className="w-4 h-4 text-emerald-600" />
                  <span>Firma de Conformidad del Cliente Capturada</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="bg-white p-2 rounded border border-emerald-200 shrink-0">
                    <img
                      src={selectedOrder.customerSignature.signatureDataUrl}
                      alt="Firma"
                      className="h-14 max-w-[180px] object-contain"
                    />
                  </div>
                  <div className="text-xs text-slate-700 space-y-1">
                    <div>
                      Firmante: <strong>{selectedOrder.customerSignature.signerName}</strong>
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      Fecha y hora: {selectedOrder.customerSignature.signedAt}
                    </div>
                    {selectedOrder.customerSignature.comments && (
                      <div className="italic text-slate-600">
                        "{selectedOrder.customerSignature.comments}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Timeline Stream */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <History className="w-4 h-4 text-[#003875]" />
                <span>Historial de Eventos del Servicio</span>
              </h4>
              <Timeline events={selectedOrder.events} />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditOrder(selectedOrder)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
                {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                  <button type="button" onClick={() => { setOrderToCancel(selectedOrder); setCancelReason(''); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200">
                    <Ban className="w-3.5 h-3.5" /> Cancelar
                  </button>
                )}
                {selectedOrder.adminIncidentStatus === 'open' ? (
                  <button type="button" onClick={() => resolveOrderIncident(selectedOrder.id)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolver incidencia
                  </button>
                ) : (
                  <button type="button" onClick={() => { setOrderForIncident(selectedOrder); setIncidentReason(''); setPauseIncidentSettlement(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200">
                    <CircleAlert className="w-3.5 h-3.5" /> Abrir incidencia
                  </button>
                )}
                {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                  <button type="button" onClick={() => { setOrderForExceptionalClose(selectedOrder); setExceptionalCloseReason(''); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> Cierre excepcional
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE ORDER ================= */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Crear Nueva Orden de Servicio</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título del problema o servicio *
                </label>
                <input
                  type="text"
                  value={newOrderTitle}
                  onChange={(e) => setNewOrderTitle(e.target.value)}
                  placeholder="Ej: Cambio de grifería monocomando en cocina"
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción técnica inicial
                </label>
                <textarea
                  value={newOrderDesc}
                  onChange={(e) => setNewOrderDesc(e.target.value)}
                  placeholder="Detalles sobre el desperfecto, ubicación o materiales..."
                  rows={2}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Servicio
                  </label>
                  <select
                    value={newOrderService}
                    onChange={(e) => setNewOrderService(e.target.value as ServiceType)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    {availableServiceCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prioridad</label>
                  <select
                    value={newOrderPriority}
                    onChange={(e) => setNewOrderPriority(e.target.value as OrderPriority)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cliente solicitante *
                  </label>
                  <select
                    value={newOrderClientId}
                    onChange={(e) => setNewOrderClientId(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-medium"
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.neighborhood})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Asignar Técnico
                  </label>
                  <select
                    value={newOrderTechId}
                    onChange={(e) => setNewOrderTechId(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-medium"
                  >
                    <option value="">Dejar sin asignar</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialty.split(' ')[0]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha programada
                </label>
                <input
                  type="date"
                  value={newOrderDate}
                  onChange={(e) => setNewOrderDate(e.target.value)}
                  required
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Formato fecha (Supabase). Ej: 2026-08-17
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Crear Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT ORDER ================= */}
      {isEditModalOpen && orderToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            setIsEditModalOpen(false);
            setOrderToEdit(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar Orden de Servicio</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{orderToEdit.id}</p>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setOrderToEdit(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditOrderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título del problema o servicio *
                </label>
                <input
                  type="text"
                  value={editOrderTitle}
                  onChange={(e) => setEditOrderTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción técnica
                </label>
                <textarea
                  value={editOrderDesc}
                  onChange={(e) => setEditOrderDesc(e.target.value)}
                  rows={2}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Servicio
                  </label>
                  <select
                    value={editOrderService}
                    onChange={(e) => setEditOrderService(e.target.value as ServiceType)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    {availableServiceCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prioridad</label>
                  <select
                    value={editOrderPriority}
                    onChange={(e) => setEditOrderPriority(e.target.value as OrderPriority)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-bold text-slate-800 mb-1">Estado operativo protegido</div>
                La edición no cambia el estado. Inicio, pausa y finalización se gestionan desde el flujo técnico con tiempo, checklist y firma del cliente. Usá las acciones excepcionales del detalle solo cuando corresponda.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cliente solicitante *
                  </label>
                  <select
                    value={editOrderClientId}
                    onChange={(e) => setEditOrderClientId(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-medium"
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.neighborhood})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Técnico asignado
                  </label>
                  <select
                    value={editOrderTechId}
                    onChange={(e) => setEditOrderTechId(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-medium"
                  >
                    <option value="">Sin asignar</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialty.split(' ')[0]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha programada
                </label>
                <input
                  type="date"
                  value={editOrderDate}
                  onChange={(e) => setEditOrderDate(e.target.value)}
                  required
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setOrderToEdit(null);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {orderToCancel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60" onClick={() => setOrderToCancel(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-3 mb-4"><Ban className="w-6 h-6 text-rose-600 shrink-0" /><div><h3 className="font-bold text-slate-900">Cancelar orden</h3><p className="text-xs text-slate-600 mt-1">Se avisará dentro de la orden al cliente y al técnico. El motivo quedará en el historial y no se podrá reactivar directamente.</p></div></div>
            <textarea autoFocus value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="Motivo de la cancelación *" className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOrderToCancel(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold">Volver</button><button disabled={cancelReason.trim().length < 8} onClick={() => { cancelOrderAsAdmin(orderToCancel.id, cancelReason); setOrderToCancel(null); }} className="px-4 py-2 rounded-lg bg-rose-600 disabled:opacity-50 text-white text-xs font-bold">Confirmar cancelación</button></div>
          </div>
        </div>
      )}

      {orderForIncident && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60" onClick={() => setOrderForIncident(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-3 mb-4"><CircleAlert className="w-6 h-6 text-amber-600 shrink-0" /><div><h3 className="font-bold text-slate-900">Abrir incidencia / reclamo</h3><p className="text-xs text-slate-600 mt-1">El aviso quedará visible para las partes dentro de esta orden.</p></div></div>
            <textarea autoFocus value={incidentReason} onChange={(e) => setIncidentReason(e.target.value)} rows={3} placeholder="Explicá el motivo de la incidencia *" className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
            <label className="mt-3 flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950"><input type="checkbox" checked={pauseIncidentSettlement} onChange={(e) => setPauseIncidentSettlement(e.target.checked)} className="mt-0.5" /><span><strong>Pausar liquidación al técnico.</strong><br />Las liquidaciones no pagadas pasarán a revisión hasta que administración las revise.</span></label>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOrderForIncident(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold">Volver</button><button disabled={incidentReason.trim().length < 8} onClick={() => { reportOrderIncident(orderForIncident.id, incidentReason, pauseIncidentSettlement); setOrderForIncident(null); }} className="px-4 py-2 rounded-lg bg-amber-600 disabled:opacity-50 text-white text-xs font-bold">Registrar incidencia</button></div>
          </div>
        </div>
      )}

      {orderForExceptionalClose && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60" onClick={() => setOrderForExceptionalClose(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-3 mb-4"><AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" /><div><h3 className="font-bold text-slate-900">Cierre excepcional</h3><p className="text-xs text-slate-600 mt-1">Usalo solo ante una intervención administrativa documentada. Saltea el flujo técnico normal y quedará auditado con el motivo.</p></div></div>
            <textarea autoFocus value={exceptionalCloseReason} onChange={(e) => setExceptionalCloseReason(e.target.value)} rows={3} placeholder="Motivo excepcional de cierre *" className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOrderForExceptionalClose(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold">Volver</button><button disabled={exceptionalCloseReason.trim().length < 8} onClick={() => { closeOrderExceptionally(orderForExceptionalClose.id, exceptionalCloseReason); setOrderForExceptionalClose(null); }} className="px-4 py-2 rounded-lg bg-slate-900 disabled:opacity-50 text-white text-xs font-bold">Cerrar excepcionalmente</button></div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ASSIGN TECHNICIAN ================= */}
      {isAssignModalOpen && orderToAssign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsAssignModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Asignar Técnico para {orderToAssign.id}
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Seleccioná el profesional certificado que atenderá el servicio{' '}
              <strong>"{orderToAssign.title}"</strong>.
            </p>

            {orderRequiresPaymentGate(orderToAssign) && !isOrderPaymentSettled(orderToAssign) && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <strong className="block">
                  {orderToAssign.workMode === 'direct' ? 'Pago pendiente' : 'Seña pendiente'}
                </strong>
                {orderToAssign.workMode === 'direct'
                  ? 'Esta orden es de precio fijo y el cliente todavía no completó el pago. No se puede asignar un técnico hasta que Mercado Pago confirme el cobro.'
                  : 'El cliente todavía no pagó la seña de la visita de diagnóstico. No se puede asignar un técnico hasta que Mercado Pago confirme el cobro.'}
              </div>
            )}

            <div className="space-y-2.5">
              {technicians.map((t) => {
                const isCurrent = orderToAssign.assignedTechnicianId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      assignTechnician(orderToAssign.id, t.id);
                      setIsAssignModalOpen(false);
                      setOrderToAssign(null);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                        {t.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{t.name}</div>
                        <div className="text-[11px] text-slate-500">{t.specialty}</div>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-bold text-teal-700">Asignado</span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 hover:text-[#003875]">
                        Asignar →
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: NEW CUSTOMER ================= */}
      {isNewCustomerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsNewCustomerModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Cliente</h3>
              <button
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre y apellido *
                </label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Ej: Lucía Navarro"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dirección del domicilio *
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Ej: Av. Santa Fe 2100, 3ro A"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Barrio / Zona</label>
                  <input
                    type="text"
                    value={newCustNeighborhood}
                    onChange={(e) => setNewCustNeighborhood(e.target.value)}
                    placeholder="Ej: Recoleta, CABA"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="+54 9 11 ..."
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notas</label>
                <textarea
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  rows={2}
                  placeholder="Acceso, referencias, preferencias..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT CUSTOMER ================= */}
      {isEditCustomerModalOpen && customerToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            setIsEditCustomerModalOpen(false);
            setCustomerToEdit(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar Cliente</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{customerToEdit.id}</p>
              </div>
              <button
                onClick={() => {
                  setIsEditCustomerModalOpen(false);
                  setCustomerToEdit(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditCustomerSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre y apellido *
                </label>
                <input
                  type="text"
                  value={editCustName}
                  onChange={(e) => setEditCustName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dirección del domicilio *
                </label>
                <input
                  type="text"
                  value={editCustAddress}
                  onChange={(e) => setEditCustAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Barrio / Zona</label>
                  <input
                    type="text"
                    value={editCustNeighborhood}
                    onChange={(e) => setEditCustNeighborhood(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editCustPhone}
                    onChange={(e) => setEditCustPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editCustEmail}
                  onChange={(e) => setEditCustEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notas</label>
                <textarea
                  value={editCustNotes}
                  onChange={(e) => setEditCustNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditCustomerModalOpen(false);
                    setCustomerToEdit(null);
                  }}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CUSTOMER CONFIRM ================= */}
      {customerPendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setCustomerPendingDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Eliminar cliente</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Vas a eliminar a <strong>{customerPendingDelete.name}</strong>. Si tiene órdenes
                  asociadas, la eliminación se bloqueará.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomerPendingDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCustomer}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: NEW TECHNICIAN ================= */}
      {isNewTechnicianModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsNewTechnicianModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Registrar Técnico</h3>
              <button
                onClick={() => setIsNewTechnicianModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTechnicianSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre y apellido *</label>
                <input
                  type="text"
                  value={newTechName}
                  onChange={(e) => setNewTechName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Especialidad</label>
                <input
                  type="text"
                  value={newTechSpecialty}
                  onChange={(e) => setNewTechSpecialty(e.target.value)}
                  placeholder="Ej: Plomería y mantenimiento"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newTechPhone}
                    onChange={(e) => setNewTechPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={newTechEmail}
                    onChange={(e) => setNewTechEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Zona donde vive
                  </label>
                  <input
                    type="text"
                    value={newTechZone}
                    onChange={(e) => setNewTechZone(e.target.value)}
                    placeholder="Ej: Almagro, Vicente López"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Provincia</label>
                  <select
                    value={newTechProvince}
                    onChange={(e) => setNewTechProvince(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    {ARGENTINA_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={newTechAlsoCustomer}
                  onChange={(e) => setNewTechAlsoCustomer(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  También registrar como cliente (puede solicitar servicios a domicilio).
                </span>
              </label>
              {newTechAlsoCustomer && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newTechAddress}
                    onChange={(e) => setNewTechAddress(e.target.value)}
                    placeholder="Dirección"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                  <input
                    type="text"
                    value={newTechNeighborhood}
                    onChange={(e) => setNewTechNeighborhood(e.target.value)}
                    placeholder="Barrio / zona"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              )}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTechnicianModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold"
                >
                  Guardar Técnico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT TECHNICIAN ================= */}
      {isEditTechnicianModalOpen && technicianToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            setIsEditTechnicianModalOpen(false);
            setTechnicianToEdit(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar Técnico</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{technicianToEdit.id}</p>
              </div>
              <button
                onClick={() => {
                  setIsEditTechnicianModalOpen(false);
                  setTechnicianToEdit(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditTechnicianSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre y apellido *</label>
                <input
                  type="text"
                  value={editTechName}
                  onChange={(e) => setEditTechName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Especialidad</label>
                <input
                  type="text"
                  value={editTechSpecialty}
                  onChange={(e) => setEditTechSpecialty(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editTechPhone}
                    onChange={(e) => setEditTechPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={editTechEmail}
                    onChange={(e) => setEditTechEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Zona donde vive
                  </label>
                  <input
                    type="text"
                    value={editTechZone}
                    onChange={(e) => setEditTechZone(e.target.value)}
                    placeholder="Ej: Almagro, Vicente López"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Provincia</label>
                  <select
                    value={editTechProvince}
                    onChange={(e) => setEditTechProvince(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    {ARGENTINA_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={editTechAlsoCustomer}
                  onChange={(e) => setEditTechAlsoCustomer(e.target.checked)}
                  className="mt-0.5"
                />
                <span>También es cliente (crear o actualizar ficha de cliente).</span>
              </label>
              {editTechAlsoCustomer && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editTechAddress}
                    onChange={(e) => setEditTechAddress(e.target.value)}
                    placeholder="Dirección"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                  <input
                    type="text"
                    value={editTechNeighborhood}
                    onChange={(e) => setEditTechNeighborhood(e.target.value)}
                    placeholder="Barrio / zona"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              )}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditTechnicianModalOpen(false);
                    setTechnicianToEdit(null);
                  }}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE TECHNICIAN CONFIRM ================= */}
      {technicianPendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setTechnicianPendingDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Eliminar técnico</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Vas a eliminar a <strong>{technicianPendingDelete.name}</strong>. Si tiene órdenes
                  asignadas, la eliminación se bloqueará.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTechnicianPendingDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTechnician}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: NEW MATERIAL ================= */}
      {isNewMaterialModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsNewMaterialModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Añadir Insumo al Inventario</h3>
              <button
                onClick={() => setIsNewMaterialModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMaterialSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del material *
                </label>
                <input
                  type="text"
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  placeholder="Ej: Teipe autofundente 19mm"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={newMatCategory}
                    onChange={(e) => setNewMatCategory(e.target.value as MaterialCategory)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    <option value="Plomería">Plomería</option>
                    <option value="Electricidad">Electricidad</option>
                    <option value="Fijaciones">Fijaciones</option>
                    <option value="Ferretería">Ferretería</option>
                    <option value="Insumos">Insumos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    value={newMatStock}
                    onChange={(e) => setNewMatStock(Number(e.target.value))}
                    min={0}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unidad</label>
                  <input
                    type="text"
                    value={newMatUnit}
                    onChange={(e) => setNewMatUnit(e.target.value)}
                    placeholder="unidades, metros, rollos"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Costo estimado ($)
                  </label>
                  <input
                    type="number"
                    value={newMatCost}
                    onChange={(e) => setNewMatCost(Number(e.target.value))}
                    min={0}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewMaterialModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold"
                >
                  Agregar a Inventario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT MATERIAL ================= */}
      {isEditMaterialModalOpen && materialToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            setIsEditMaterialModalOpen(false);
            setMaterialToEdit(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar material</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{materialToEdit.id}</p>
              </div>
              <button
                onClick={() => {
                  setIsEditMaterialModalOpen(false);
                  setMaterialToEdit(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditMaterialSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del material *
                </label>
                <input
                  type="text"
                  value={editMatName}
                  onChange={(e) => setEditMatName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={editMatCategory}
                    onChange={(e) => setEditMatCategory(e.target.value as MaterialCategory)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  >
                    <option value="Plomería">Plomería</option>
                    <option value="Electricidad">Electricidad</option>
                    <option value="Fijaciones">Fijaciones</option>
                    <option value="Ferretería">Ferretería</option>
                    <option value="Insumos">Insumos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stock</label>
                  <input
                    type="number"
                    value={editMatStock}
                    onChange={(e) => setEditMatStock(Number(e.target.value))}
                    min={0}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unidad</label>
                  <input
                    type="text"
                    value={editMatUnit}
                    onChange={(e) => setEditMatUnit(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Costo estimado ($)
                  </label>
                  <input
                    type="number"
                    value={editMatCost}
                    onChange={(e) => setEditMatCost(Number(e.target.value))}
                    min={0}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditMaterialModalOpen(false);
                    setMaterialToEdit(null);
                  }}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE MATERIAL CONFIRM ================= */}
      {materialPendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setMaterialPendingDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Eliminar material</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Vas a eliminar <strong>{materialPendingDelete.name}</strong> del inventario. El
                  historial de órdenes conserva el nombre ya registrado.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMaterialPendingDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMaterial}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteLinkModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setInviteLinkModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Enlace de alta de cuenta</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Enviá este enlace a <strong>{inviteLinkModal.name}</strong> para que cree su
                  contraseña y entre como{' '}
                  {inviteLinkModal.kind === 'technician' ? 'técnico' : 'cliente'}. Vence en 14 días.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteLinkModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLinkModal.url}
                className="flex-1 text-[11px] font-mono px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLinkModal.url);
                    showToast('Enlace copiado', 'success');
                  } catch {
                    showToast('No se pudo copiar. Seleccioná el texto.', 'error');
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-2 bg-[#0F172A] text-teal-300 text-xs font-bold rounded-lg border border-slate-700"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE SERVICE ================= */}
      {isNewServiceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsNewServiceModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Crear Nuevo Servicio</h3>
                <p className="text-xs text-slate-500">Definí el nombre, tarifa base, categoría y características comerciales.</p>
              </div>
              <button
                onClick={() => setIsNewServiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateServiceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Ej: Plomería de Urgencia y Reparación de Pérdidas"
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoría *
                  </label>
                  <select
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                    required
                  >
                    {!availableServiceCategories.includes(newServiceCategory) && (
                      <option value={newServiceCategory}>{newServiceCategory}</option>
                    )}
                    {availableServiceCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Precio Base ($ ARS) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-mono font-bold text-teal-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Duración (min) *
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción Técnica y Comercial *
                </label>
                <textarea
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  placeholder="Detallá los alcances técnicos del servicio, tareas comprendidas y metodología de trabajo..."
                  rows={3}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Beneficios y Características Incluidas (un ítem por línea)
                </label>
                <textarea
                  value={newServiceFeatures}
                  onChange={(e) => setNewServiceFeatures(e.target.value)}
                  placeholder="Diagnóstico en sitio&#10;Garantía escrita de 90 días&#10;Repuestos de primera calidad"
                  rows={3}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Cada línea se mostrará como una etiqueta con tilde de verificación.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewServiceModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Crear Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT SERVICE ================= */}
      {isEditServiceModalOpen && serviceToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            setIsEditServiceModalOpen(false);
            setServiceToEdit(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar Servicio</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{serviceToEdit.id}</p>
              </div>
              <button
                onClick={() => {
                  setIsEditServiceModalOpen(false);
                  setServiceToEdit(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditServiceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  value={editServiceName}
                  onChange={(e) => setEditServiceName(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoría *
                  </label>
                  <select
                    value={editServiceCategory}
                    onChange={(e) => setEditServiceCategory(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                    required
                  >
                    {!availableServiceCategories.includes(editServiceCategory) && (
                      <option value={editServiceCategory}>{editServiceCategory}</option>
                    )}
                    {availableServiceCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Precio Base ($ ARS) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={editServicePrice}
                    onChange={(e) => setEditServicePrice(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-mono font-bold text-teal-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Duración (min) *
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={editServiceDuration}
                    onChange={(e) => setEditServiceDuration(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción Técnica y Comercial *
                </label>
                <textarea
                  value={editServiceDesc}
                  onChange={(e) => setEditServiceDesc(e.target.value)}
                  rows={3}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Beneficios y Características Incluidas (un ítem por línea)
                </label>
                <textarea
                  value={editServiceFeatures}
                  onChange={(e) => setEditServiceFeatures(e.target.value)}
                  rows={3}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditServiceModalOpen(false);
                    setServiceToEdit(null);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE SERVICE CONFIRM ================= */}
      {servicePendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setServicePendingDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Eliminar servicio del catálogo</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Vas a eliminar <strong>{servicePendingDelete.name}</strong> del catálogo tarifado. Las órdenes existentes mantendrán su información histórica.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setServicePendingDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteService}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE CATEGORY ================= */}
      {isNewCategoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsNewCategoryModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Nueva Categoría</h3>
                <p className="text-xs text-slate-500">
                  Definí el rubro que se publicará en la landing y agrupará tus servicios.
                </p>
              </div>
              <button
                onClick={() => setIsNewCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la categoría *
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ej: Plomería"
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción *
                </label>
                <textarea
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  placeholder="Ej: Reparación y mantenimiento de sistemas de agua y desagüe"
                  rows={3}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ícono del rubro
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {CATEGORY_ICON_KEYS.map((key) => {
                    const visual = getCategoryVisual(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewCategoryIcon(key)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                          newCategoryIcon === key
                            ? `${visual.bg} ${visual.border} ring-2 ring-teal-500`
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <CategoryIcon name={key} className="w-5 h-5" />
                        <span className="text-[9px] font-semibold text-slate-600 text-center leading-tight">
                          {visual.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Crear Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT CATEGORY ================= */}
      {isEditCategoryModalOpen && categoryToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            setIsEditCategoryModalOpen(false);
            setCategoryToEdit(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar Categoría</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{categoryToEdit.id}</p>
              </div>
              <button
                onClick={() => {
                  setIsEditCategoryModalOpen(false);
                  setCategoryToEdit(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la categoría *
                </label>
                <input
                  type="text"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción *
                </label>
                <textarea
                  value={editCategoryDesc}
                  onChange={(e) => setEditCategoryDesc(e.target.value)}
                  rows={3}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ícono del rubro
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {CATEGORY_ICON_KEYS.map((key) => {
                    const visual = getCategoryVisual(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditCategoryIcon(key)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                          editCategoryIcon === key
                            ? `${visual.bg} ${visual.border} ring-2 ring-teal-500`
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <CategoryIcon name={key} className="w-5 h-5" />
                        <span className="text-[9px] font-semibold text-slate-600 text-center leading-tight">
                          {visual.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditCategoryModalOpen(false);
                    setCategoryToEdit(null);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003875] hover:bg-[#002855] text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CATEGORY CONFIRM ================= */}
      {categoryPendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setCategoryPendingDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Eliminar categoría</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Vas a eliminar <strong>{categoryPendingDelete.name}</strong>. Solo se permite si no
                  tiene servicios asociados.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryPendingDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
