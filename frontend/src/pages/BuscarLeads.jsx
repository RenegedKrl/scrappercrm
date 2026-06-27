import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, useMapEvents, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Info, Play, Loader2, CheckSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { encryptLead } from '../services/encryption';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = {
  'Saúde & Bem-Estar': [
    'Dentista', 'Clínica odontológica', 'Ortodontista', 'Clínica médica', 
    'Clínica de estética', 'Cirurgião plástico', 'Dermatologista', 'Cardiologista',
    'Ortopedista', 'Ginecologista', 'Pediatra', 'Psicólogo', 'Psiquiatra',
    'Nutricionista', 'Fisioterapeuta', 'Academia', 'Pilates', 'Studio de yoga',
    'Crossfit', 'Personal trainer', 'Spa', 'Clínica de depilação', 'Consultório',
    'Podologia', 'Estúdio de tatuagem', 'Clínica de micropigmentação', 'Laboratório de análises', 'Farmácia'
  ],
  'Pet & Veterinária': [
    'Pet shop', 'Veterinário', 'Clínica veterinária', 'Pet grooming', 'Hotel para pets', 'Adestramento'
  ],
  'Beleza & Estética': [
    'Salão de beleza', 'Barbearia', 'Cabeleireiro', 'Instituto de beleza', 'Manicure',
    'Design de sobrancelhas', 'Limpeza de pele', 'Lash designer'
  ],
  'Automotivo': [
    'Oficina mecânica', 'Lava a jato', 'Borracharia', 'Auto elétrica', 'Funilaria e pintura',
    'Concessionária', 'Revenda de veículos', 'Som automotivo', 'Insulfilm',
    'Estacionamento', 'Locadora de veículos', 'Troca de óleo'
  ],
  'Alimentação': [
    'Restaurante', 'Pizzaria', 'Hamburgueria', 'Churrascaria', 'Comida japonesa',
    'Sushi', 'Bar', 'Padaria', 'Cafeteria', 'Sorveteria', 'Confeitaria', 'Lanchonete'
  ]
};

function MapTracker({ setMapCenter }) {
  const map = useMapEvents({
    moveend: () => {
      setMapCenter(map.getCenter());
    },
  });
  return null;
}

const BuscarLeads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchMode, setSearchMode] = useState('mapa'); // 'mapa' ou 'receita'
  const [targetCity, setTargetCity] = useState('São Paulo, SP');
  const [scrapingStatus, setScrapingStatus] = useState('');
  
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [maxResults, setMaxResults] = useState(30);
  const [radius, setRadius] = useState(5000); // Raio em metros
  const [mapCenter, setMapCenter] = useState({ lat: -23.5505, lng: -46.6333 });
  const [isLoading, setIsLoading] = useState(false);
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const showAlert = (title, message, onConfirm = () => setDialog({ isOpen: false, title: '', message: '', onConfirm: null })) => {
    setDialog({ isOpen: true, title, message, onConfirm });
  };

  const toggleCategory = (item) => {
    setSelectedCategories(prev => {
      if (prev.includes(item)) return prev.filter(c => c !== item);
      if (searchMode === 'mapa' && prev.length >= 5) {
        showAlert("Limite de Categorias no Mapa", "Para manter a estabilidade do servidor Antibloqueio do Google Maps, selecione no máximo 5 categorias por busca. \n\nSe quiser buscar todas de uma vez, mude para o modo 'Receita Federal'.");
        return prev;
      }
      return [...prev, item];
    });
  };

  const selectAllCategories = () => {
    if (searchMode === 'mapa') {
      showAlert("Atenção", "A busca massiva ('Todas as Categorias') está desativada no Modo Mapa para evitar Timeout. \n\nMude para o modo 'Receita Federal' se quiser buscar todas as categorias de uma vez na cidade.");
    } else {
      const all = Object.values(CATEGORIES).flat();
      if (selectedCategories.length === all.length) {
        setSelectedCategories([]);
      } else {
        setSelectedCategories(all);
      }
    }
  };

  const handleSearch = async () => {
    if (selectedCategories.length === 0) {
      showAlert("Atenção", "Selecione pelo menos uma categoria antes de buscar!");
      return;
    }

    setIsLoading(true);
    setScrapingStatus('');
    try {
      if (searchMode === 'mapa') {
        const response = await fetch('http://localhost:3001/api/scrape/map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories: selectedCategories,
            lat: mapCenter.lat,
            lng: mapCenter.lng,
            radius: Number(radius),
            maxResults: Number(maxResults)
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          const { data: existingLeads } = await supabase.from('leads').select('name').eq('user_id', user.id);
          const existingNames = new Set((existingLeads || []).map(l => l.name));
          const newUniqueLeads = data.leads.filter(l => !existingNames.has(l.name));
          
          if (newUniqueLeads.length > 0) {
            const encryptedLeads = newUniqueLeads.map(l => ({
              ...encryptLead(l),
              user_id: user.id
            }));
            await supabase.from('leads').upsert(encryptedLeads);
          }
          
          showAlert('Sucesso!', `${newUniqueLeads.length} novos leads SALVOS na Nuvem.\n\nNota: Apenas empresas com Telefone ou Site foram mantidas.`, () => {
            setDialog({ isOpen: false });
            navigate('/leads');
          });
        } else {
          showAlert("Erro", "Erro na busca: " + data.error);
        }
      } else {
        // MODO RECEITA FEDERAL (STREAMING DE LOGS)
        const response = await fetch('http://localhost:3001/api/scrape/receita', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories: selectedCategories, // Agora envia o array completo
            city: targetCity,
            maxResults: Number(maxResults)
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'progress') {
                setScrapingStatus(parsed.message);
              } else if (parsed.type === 'done') {
                if (parsed.success) {
                  const leadsScraped = parsed.leads;
                  const { data: existingLeads } = await supabase.from('leads').select('name').eq('user_id', user.id);
                  const existingNames = new Set((existingLeads || []).map(l => l.name));
                  const newUniqueLeads = leadsScraped.filter(l => !existingNames.has(l.name));
                  
                  if (newUniqueLeads.length > 0) {
                    const encryptedLeads = newUniqueLeads.map(l => ({
                      ...encryptLead(l),
                      user_id: user.id
                    }));
                    await supabase.from('leads').upsert(encryptedLeads);
                  }
                  
                  showAlert('Busca Furtiva Concluída!', `${newUniqueLeads.length} novos leads injetados e criptografados no CRM.`, () => {
                    setDialog({ isOpen: false });
                    navigate('/leads');
                  });
                } else {
                  showAlert("Erro", "Erro no servidor: " + parsed.error);
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      showAlert("Erro de Conexão", "Erro ao conectar com o Servidor Local (Backend está rodando?).");
      console.error(err);
    } finally {
      setIsLoading(false);
      setScrapingStatus('');
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 bg-dark-900 text-gray-300 relative">
      
      {/* GLOBAL CUSTOM DIALOG */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-primary-500" />
                <h3 className="text-xl font-bold text-white">{dialog.title}</h3>
              </div>
              <p className="text-gray-400 text-sm whitespace-pre-wrap mb-5">{dialog.message}</p>
            </div>
            
            <div className="p-4 bg-dark-900/50 border-t border-dark-700 flex justify-end gap-3">
              <button 
                onClick={dialog.onConfirm}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors shadow-lg bg-primary-600 hover:bg-primary-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">Buscar Leads</h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
           <label className="flex items-center gap-2 cursor-pointer">
             <input type="checkbox" className="rounded bg-dark-800 border-dark-700 accent-primary-500" checked readOnly />
             Salvo no navegador
           </label>
        </div>
      </div>

      <div className="flex bg-dark-800 p-1 rounded-xl w-max mb-6 border border-dark-700">
        <button 
          onClick={() => setSearchMode('mapa')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'mapa' ? 'bg-primary-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          Mapa (Negócios Estabelecidos)
        </button>
        <button 
          onClick={() => setSearchMode('receita')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${searchMode === 'receita' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          Receita Federal (CNPJs Recentes)
        </button>
      </div>

      {/* Area Superior (Mapa ou Input Cidade) */}
      {searchMode === 'mapa' ? (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-1 mb-6 shadow-sm animate-in fade-in zoom-in-95 duration-300">
          <div className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between">
            <span>Localização — Mova o mapa para a região alvo</span>
            <span className="text-gray-500">Lat: {mapCenter.lat.toFixed(4)} Lng: {mapCenter.lng.toFixed(4)}</span>
          </div>
          <div className="h-[350px] w-full rounded-b-lg overflow-hidden relative z-0">
            <MapContainer center={[-23.5505, -46.6333]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapTracker setMapCenter={setMapCenter} />
              <Circle 
                center={[mapCenter.lat, mapCenter.lng]} 
                radius={radius} 
                pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1, weight: 2 }} 
              />
            </MapContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
              <div className="w-2 h-2 bg-primary-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-dark-800/50 border-2 border-blue-500/20 rounded-xl p-6 mb-6 shadow-sm animate-in fade-in zoom-in-95 duration-300">
          <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Info className="w-4 h-4"/> Robô Furtivo Anti-Ban (Stealth)
          </div>
          <p className="text-sm text-gray-300 mb-6 max-w-2xl">
            Este método busca as aberturas de CNPJs mais recentes varrendo diretórios públicos em tempo real usando um navegador invisível. Ele simula o comportamento humano (com demoras de 15 a 25 segundos) para não tomar block.
          </p>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Cidade e Estado Alvo:</label>
            <input 
              type="text" 
              value={targetCity}
              onChange={(e) => setTargetCity(e.target.value)}
              className="w-full max-w-sm bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              placeholder="Ex: São Paulo, SP"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Categories */}
        <div className="lg:col-span-2 bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Categorias / Segmentos
            </div>
            <button 
              onClick={selectAllCategories}
              className="text-xs font-medium text-primary-500 hover:text-primary-400 flex items-center gap-1.5 transition-colors"
            >
              <CheckSquare className="w-4 h-4" />
              Selecionar Todas ({selectedCategories.length})
            </button>
          </div>
          
          <div className="space-y-8">
            {Object.entries(CATEGORIES).map(([group, items]) => (
              <div key={group}>
                <div className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2">
                   <span>{group}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map(item => {
                    const isSelected = selectedCategories.includes(item);
                    return (
                      <button 
                        key={item}
                        onClick={() => toggleCategory(item)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          isSelected 
                          ? 'bg-primary-500/20 border-primary-500 text-primary-500' 
                          : 'bg-dark-900 border-dark-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Configs */}
        <div className="space-y-6">
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-sm">
             <div className="text-xs font-semibold text-primary-500 uppercase tracking-wider mb-2 flex items-center gap-2">
               <Info className="w-4 h-4" /> Filtro de Qualidade Ativo
            </div>
            <p className="text-xs text-gray-400">
              O robô só salvará leads que possuam <b>Telefone</b> OU <b>Site</b>. Empresas sem nenhum contato serão descartadas automaticamente.
            </p>
          </div>

          {searchMode === 'mapa' && (
            <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-sm">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
                Raio de Busca no Mapa: {radius / 1000} km
              </div>
              <input 
                type="range" 
                min="1000" max="50000" step="1000"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full h-1.5 bg-dark-700 rounded-lg appearance-none cursor-pointer mb-6 accent-primary-500"
              />
            </div>
          )}

          <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-sm">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
              Máx. Resultados (Leads): {maxResults}
            </div>
            <input 
              type="range" 
              min="10" max="100" step="10"
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              className="w-full h-1.5 bg-dark-700 rounded-lg appearance-none cursor-pointer mb-2 accent-primary-500"
            />
          </div>
          {isLoading && searchMode === 'receita' && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 text-blue-400 text-sm font-semibold mb-2">
                 <Loader2 className="w-4 h-4 animate-spin" /> Processo em andamento...
              </div>
              <div className="text-xs text-gray-400 bg-dark-900 p-3 rounded border border-dark-700 font-mono">
                 &gt; {scrapingStatus || 'Inicializando cluster...'}
              </div>
            </div>
          )}

          <button 
            onClick={handleSearch}
            disabled={isLoading}
            className={`w-full font-medium py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm ${
              isLoading 
              ? 'bg-dark-700 text-gray-500 cursor-not-allowed' 
              : searchMode === 'receita' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.02]' 
                : 'bg-primary-600 hover:bg-primary-500 text-white hover:scale-[1.02]'
            }`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {isLoading ? 'Executando Extração...' : 'Iniciar Busca Profunda'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuscarLeads;
