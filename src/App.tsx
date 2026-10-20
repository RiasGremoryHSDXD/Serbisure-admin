import React, { useState } from 'react';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { VerificationsPage } from './pages/VerificationsPage';
import { UsersPage } from './pages/UsersPage';
import { AccountAccessPage } from './pages/AccountAccessPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { useChatViewport } from './hooks/useChatViewport';

const MainLayout: React.FC = () => {
  const { activeNav } = useAdmin();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const chatShell = useChatViewport(activeNav === 'users');

  return (
    <div ref={chatShell} className={`flex bg-[#F6F5F2] ${activeNav === 'users' ? 'chat-app-shell overflow-hidden' : 'min-h-screen relative'}`}>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Responsive drawer on mobile, sticky on desktop) */}
      <Sidebar 
        isSidebarCollapsed={isSidebarCollapsed} 
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${activeNav === 'users' ? 'h-full overflow-hidden' : 'min-h-screen'}`}>
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)} />
        
        <main className={
          activeNav === 'users'
            ? 'flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden'
            : 'flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto'
        }>
          {activeNav === 'dashboard' && <DashboardPage />}
          {activeNav === 'verifications' && <VerificationsPage />}
          {activeNav === 'users' && <UsersPage />}
          {activeNav === 'account-access' && <AccountAccessPage />}
          {activeNav === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAdmin();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <MainLayout />;
};

function App() {
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  );
}

export default App;

