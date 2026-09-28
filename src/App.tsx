import React from 'react';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { VerificationsPage } from './pages/VerificationsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

const MainLayout: React.FC = () => {
  const { activeNav } = useAdmin();

  return (
    <div className={`flex bg-[#F6F5F2] ${activeNav === 'users' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Fixed/Sticky Sidebar matching mockups */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        
        <main className={
          activeNav === 'users'
            ? 'flex-1 flex flex-col min-w-0 overflow-hidden'
            : 'flex-1 p-8 max-w-7xl w-full mx-auto'
        }>
          {activeNav === 'dashboard' && <DashboardPage />}
          {activeNav === 'verifications' && <VerificationsPage />}
          {activeNav === 'users' && <UsersPage />}
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

