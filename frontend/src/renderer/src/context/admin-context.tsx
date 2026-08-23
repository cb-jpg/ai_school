/**
 * Admin Panel Context
 * Manages the state for the knowledge base admin panel
 */

import { createContext, useContext, useState, ReactNode } from 'react';

interface AdminContextType {
  isAdminOpen: boolean;
  openAdmin: () => void;
  closeAdmin: () => void;
  toggleAdmin: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const openAdmin = () => setIsAdminOpen(true);
  const closeAdmin = () => setIsAdminOpen(false);
  const toggleAdmin = () => setIsAdminOpen(prev => !prev);

  return (
    <AdminContext.Provider value={{ isAdminOpen, openAdmin, closeAdmin, toggleAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
