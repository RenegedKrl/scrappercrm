import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BuscarLeads from './pages/BuscarLeads';
import Leads from './pages/Leads';
import SZap from './pages/SZap';
import Automacao from './pages/Automacao';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';

function App() {
  const { session } = useAuth();

  if (!session) {
    return <Login />;
  }

  return (
    <Router>
      <div className="flex h-screen w-full bg-dark-900 text-gray-300 font-sans selection:bg-primary-500/30">
        <Sidebar />
        <div className="flex-1 h-full overflow-hidden flex flex-col relative">
          <Routes>
            <Route path="/" element={<BuscarLeads />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/automacao" element={<Automacao />} />
            <Route path="/configuracoes" element={<div className="p-8 h-full overflow-y-auto"><h1 className="text-2xl font-semibold text-white">Configurações (Em construção)</h1></div>} />
            <Route path="/szap" element={<SZap />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
