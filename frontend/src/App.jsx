import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SpecificationView from './views/SpecificationView';
import UnderstandingView from './views/UnderstandingView';
import ManipulationView from './views/ManipulationView';
import SystemStatusModal from './components/SystemStatusModal';
import { fetchSystemStatus } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('understanding');
  const [activeEngine, setActiveEngine] = useState('qwopus-9b');
  const [systemStatus, setSystemStatus] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => {
    fetchSystemStatus()
      .then(setSystemStatus)
      .catch((err) => console.warn('Backend status check:', err));
  }, []);

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeEngine={activeEngine}
        setActiveEngine={setActiveEngine}
        systemStatus={systemStatus}
        onOpenStatusModal={() => setIsStatusModalOpen(true)}
      />

      <main className="main-content">
        {activeTab === 'specs' && (
          <SpecificationView
            activeEngine={activeEngine}
            systemStatus={systemStatus}
          />
        )}

        {activeTab === 'understanding' && (
          <UnderstandingView activeEngine={activeEngine} />
        )}

        {activeTab === 'manipulation' && (
          <ManipulationView activeEngine={activeEngine} />
        )}
      </main>

      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        systemStatus={systemStatus}
      />
    </div>
  );
}
