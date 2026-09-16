import {
  Wrench,
  ShieldAlert,
  ShieldCheck,
  FileText,
  ClipboardList,
  ClipboardCheck,
  MessageCircle,
  Phone,
  Headphones,
  Calendar,
  Package,
  Home,
  Wallet,
  CreditCard,
  Star,
  HelpCircle,
  LifeBuoy,
  Settings,
  Bell,
  MapPin,
  Camera,
  Zap,
  Droplet,
  Hammer,
  Paintbrush,
  Lock,
  Users,
  CheckCircle2,
  AlertCircle,
  Truck,
  Megaphone,
  Gift,
  Percent,
  Snowflake,
  type LucideIcon,
} from 'lucide-react';

/** Grilla curada de íconos que el admin puede elegir para las tarjetas del
 * panel del cliente (ver src/components/admin/HomePageEditor.tsx) —
 * respuesta a la pregunta de Sandy del 16/9 sobre cómo elegir el símbolo
 * adecuado sin tener que escribir código. Cada tarjeta guarda solo el
 * `name` (string) en la base; el componente lo resuelve a un ícono real
 * tanto en el editor de admin como en el panel del cliente
 * (CustomerHomeCards.tsx) con getHomeIcon(). */
export const HOME_ICON_OPTIONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'Wrench', Icon: Wrench },
  { name: 'ShieldAlert', Icon: ShieldAlert },
  { name: 'ShieldCheck', Icon: ShieldCheck },
  { name: 'FileText', Icon: FileText },
  { name: 'ClipboardList', Icon: ClipboardList },
  { name: 'ClipboardCheck', Icon: ClipboardCheck },
  { name: 'MessageCircle', Icon: MessageCircle },
  { name: 'Phone', Icon: Phone },
  { name: 'Headphones', Icon: Headphones },
  { name: 'Calendar', Icon: Calendar },
  { name: 'Package', Icon: Package },
  { name: 'Home', Icon: Home },
  { name: 'Wallet', Icon: Wallet },
  { name: 'CreditCard', Icon: CreditCard },
  { name: 'Star', Icon: Star },
  { name: 'HelpCircle', Icon: HelpCircle },
  { name: 'LifeBuoy', Icon: LifeBuoy },
  { name: 'Settings', Icon: Settings },
  { name: 'Bell', Icon: Bell },
  { name: 'MapPin', Icon: MapPin },
  { name: 'Camera', Icon: Camera },
  { name: 'Zap', Icon: Zap },
  { name: 'Droplet', Icon: Droplet },
  { name: 'Hammer', Icon: Hammer },
  { name: 'Paintbrush', Icon: Paintbrush },
  { name: 'Lock', Icon: Lock },
  { name: 'Users', Icon: Users },
  { name: 'CheckCircle2', Icon: CheckCircle2 },
  { name: 'AlertCircle', Icon: AlertCircle },
  { name: 'Truck', Icon: Truck },
  { name: 'Megaphone', Icon: Megaphone },
  { name: 'Gift', Icon: Gift },
  { name: 'Percent', Icon: Percent },
  { name: 'Snowflake', Icon: Snowflake },
];

const HOME_ICON_MAP: Record<string, LucideIcon> = HOME_ICON_OPTIONS.reduce(
  (acc, { name, Icon }) => ({ ...acc, [name]: Icon }),
  {} as Record<string, LucideIcon>
);

/** Resuelve el nombre de ícono guardado en la tarjeta a un componente real.
 * Si el admin (o una migración vieja) guardó un nombre que no está en la
 * grilla curada, cae a HelpCircle en vez de romper el render. */
export function getHomeIcon(name: string): LucideIcon {
  return HOME_ICON_MAP[name] || HelpCircle;
}
