import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HomeView from './views/HomeView';
import DocumentLibraryView from './views/DocumentLibraryView';
import UnderstandingView from './views/UnderstandingView';
import SpecificationView from './views/SpecificationView';
import ManipulationView from './views/ManipulationView';
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import ProfileView from './views/ProfileView';
import SystemStatusModal from './components/SystemStatusModal';
import AuthModal from './components/AuthModal';
import { AuthProvider } from './context/AuthContext';
import { fetchSystemStatus } from './api/client';

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [activeEngine, setActiveEngine] = useState('qwopus-9b');
  const [systemStatus, setSystemStatus] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    fetchSystemStatus()
      .then(setSystemStatus)
      .catch((err) => console.warn('Backend status check:', err));
  }, []);

  const handleSelectDocument = (doc) => {
    setSelectedDocument(doc);
    setActiveTab('understanding');
  };

  const handleBackToLibrary = () => {
    setActiveTab('library');
  };

  const handleNavigate = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAuthPage = activeTab === 'login' || activeTab === 'register';

  return (
    <div className="app-container">
      {/* Show header on home & workspace pages, omit on standalone auth pages */}
      {!isAuthPage && (
        <Header
          activeTab={activeTab}
          setActiveTab={handleNavigate}
          activeEngine={activeEngine}
          setActiveEngine={setActiveEngine}
          systemStatus={systemStatus}
          onOpenStatusModal={() => setIsStatusModalOpen(true)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          selectedDocument={selectedDocument}
        />
      )}

      <main className="main-content">
        {activeTab === 'home' && (
          <HomeView
            onNavigate={handleNavigate}
            systemStatus={systemStatus}
          />
        )}

        {activeTab === 'library' && (
          <DocumentLibraryView onSelectDocument={handleSelectDocument} />
        )}

        {activeTab === 'understanding' && (
          <UnderstandingView
            activeEngine={activeEngine}
            selectedDocument={selectedDocument}
            onBackToLibrary={handleBackToLibrary}
          />
        )}

        {activeTab === 'specs' && (
          <SpecificationView
            activeEngine={activeEngine}
            systemStatus={systemStatus}
          />
        )}

        {activeTab === 'manipulation' && (
          <ManipulationView activeEngine={activeEngine} />
        )}

        {activeTab === 'login' && (
          <LoginView onNavigate={handleNavigate} />
        )}

        {activeTab === 'register' && (
          <RegisterView onNavigate={handleNavigate} />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            onNavigate={handleNavigate}
            onSelectDocument={handleSelectDocument}
          />
        )}
      </main>

      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        systemStatus={systemStatus}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
