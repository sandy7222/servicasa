import React from 'react';
import { Landmark, LayoutDashboard, Layers, Users } from 'lucide-react';
import {
  destinationForGroupTap,
  destinationsForGroup,
  groupFromPath,
  type AdminNavGroupId,
} from '../../lib/adminNav';
import { NavBadge, useAdminNavController } from './adminModuleNav';

const GROUP_ICONS: Record<AdminNavGroupId, React.ReactNode> = {
  operacion: <LayoutDashboard className="w-5 h-5" />,
  personas: <Users className="w-5 h-5" />,
  catalogo: <Layers className="w-5 h-5" />,
  plataforma: <Landmark className="w-5 h-5" />,
};

export const AdminModuleSubnav: React.FC = () => {
  const { currentPath, current, goTo, badge } = useAdminNavController();
  const activeGroup = groupFromPath(currentPath);
  const siblings = destinationsForGroup(activeGroup);
  if (siblings.length <= 1) return null;

  return (
    <div className="md:hidden sticky top-14 z-30 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 px-3 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {siblings.map((destination) => {
          const active = current?.id === destination.id;
          return (
            <button
              key={destination.id}
              type="button"
              onClick={() => goTo(destination)}
              className={`inline-flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-md text-xs font-bold ${
                active
                  ? 'bg-[#0F172A] text-teal-300 border border-slate-800'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {destination.label}
              <NavBadge count={badge(destination)} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const AdminModuleBottomNav: React.FC = () => {
  const { currentPath, goTo, badge, groups } = useAdminNavController();
  const activeGroup = groupFromPath(currentPath);

  const groupBadge = (groupId: AdminNavGroupId) =>
    destinationsForGroup(groupId).reduce((sum, destination) => sum + badge(destination), 0);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pb-[env(safe-area-inset-bottom)]"
      aria-label="Grupos del administrador"
    >
      <div className="grid grid-cols-4">
        {groups.map((group) => {
          const active = activeGroup === group.id;
          const count = groupBadge(group.id);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                if (active) return;
                goTo(destinationForGroupTap(group.id));
              }}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold ${
                active ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500'
              }`}
            >
              <span className="relative">
                {GROUP_ICONS[group.id]}
                {count > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-3.5 h-3.5 px-0.5 rounded-full bg-amber-600 text-white text-[8px] font-black leading-[14px] text-center">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </span>
              {group.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
