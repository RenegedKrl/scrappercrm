import React from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Users, Bot, Settings, MessageSquare, HeadphonesIcon } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { name: 'Buscar Leads', path: '/', icon: Search },
    { name: 'Leads', path: '/leads', icon: Users },
    { name: 'Automação', path: '/automacao', icon: Bot },
    { name: 'Configurações', path: '/configuracoes', icon: Settings },
  ];

  return (
    <div className="w-64 h-screen bg-dark-950 border-r border-dark-800 flex flex-col justify-between flex-shrink-0 z-10">
      <div>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-500 flex items-center justify-center">
            <Search className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-wider">SCRAPPER</span>
        </div>
        
        <nav className="px-3 mt-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-dark-800 text-primary-500'
                    : 'text-gray-400 hover:bg-dark-800/50 hover:text-gray-200'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
          
          <div className="pt-4 mt-4 mb-2 border-t border-dark-800 mx-3"></div>
          
          <NavLink
            to="/szap"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-dark-800 text-primary-500'
                  : 'text-gray-400 hover:bg-dark-800/50 hover:text-gray-200'
              }`
            }
          >
            <MessageSquare className="w-5 h-5 text-green-500" />
            S-zap
          </NavLink>
        </nav>
      </div>

      <div className="p-4">
        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors w-full px-3 py-2 rounded-lg hover:bg-dark-800/50">
          <HeadphonesIcon className="w-4 h-4" />
          Contato e suporte
        </button>
        <div className="mt-4 px-3 text-xs text-gray-600">
          v1.0.0
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
