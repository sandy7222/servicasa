import React from 'react';
import { NavBadge, useAdminNavController } from './adminModuleNav';
import { destinationForGroupTap, groupFromPath } from '../../lib/adminNav';

export const AdminModuleSidebar: React.FC = () => {
  const { currentPath, current, goTo, badge, groups, destinationsForGroup } = useAdminNavController();
  const activeGroup = groupFromPath(currentPath);

  return (
    <aside className="hidden md:block w-56 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <nav className="p-3 space-y-3" aria-label="Módulos del administrador">
        {groups.map((group) => {
          const destinations = destinationsForGroup(group.id);
          const groupActive = activeGroup === group.id;
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => goTo(destinationForGroupTap(group.id))}
                className={`w-full text-left text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                  groupActive ? 'text-teal-700 dark:text-teal-300' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {group.label}
              </button>
              <div className="mt-0.5 space-y-0.5">
                {destinations.map((destination) => {
                  const active = current?.id === destination.id;
                  return (
                    <button
                      key={destination.id}
                      type="button"
                      onClick={() => goTo(destination)}
                      className={`w-full flex items-center justify-between gap-2 text-left px-2 py-1.5 rounded-lg text-xs font-semibold ${
                        active
                          ? 'bg-[#0F172A] text-teal-300 border border-slate-800'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{destination.label}</span>
                      <NavBadge count={badge(destination)} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};
