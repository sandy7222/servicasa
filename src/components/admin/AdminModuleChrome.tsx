import React from 'react';
import { AdminModuleBottomNav, AdminModuleSubnav } from './AdminModuleBottomNav';
import { AdminModuleSidebar } from './AdminModuleSidebar';

export const AdminModuleChrome: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="md:flex md:items-start md:min-h-0">
    <AdminModuleSidebar />
    <div className="flex-1 min-w-0 pb-20 md:pb-0">
      <AdminModuleSubnav />
      {children}
    </div>
    <AdminModuleBottomNav />
  </div>
);
