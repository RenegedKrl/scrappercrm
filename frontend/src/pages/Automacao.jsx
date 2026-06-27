import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, Zap, Play, Save, Plus, Trash2, Calendar, Target } from 'lucide-react';

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
const ALL_PRESETS = Object.values(CATEGORIES).flat();

const Automacao = () => {
  const [stages, setStages] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [antiBan, setAntiBan] = useState({ minDelay: 15, maxDelay: 45, dailyLimit: 100 });
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  
  // Dialog State
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    // Carregar Etapas do Kanban
    const savedStages = JSON.parse(localStorage.getItem('scrapper_stages') || '["Novos", "Em Contato", "Reunião Marcada", "Fechados", "Arquivados"]');
    setStages(savedStages);
    
    // Carregar Gatilhos do SZap
    const savedTriggers = JSON.parse(localStorage.getItem('scrapper_triggers') || '[]');
    setTriggers(savedTriggers);

    // Carregar Agendamentos
    const savedSchedules = JSON.parse(localStorage.getItem('scrapper_schedules') || '[]');
    setSchedules(savedSchedules);

    // Carregar Anti-Ban
    const savedAntiBan = JSON.parse(localStorage.getItem('scrapper_antiban') || '{"minDelay": 15, "maxDelay": 45, "dailyLimit": 100}');
    setAntiBan(savedAntiBan);

    // Carregar Categorias
    const savedLeads = JSON.parse(localStorage.getItem('scrapper_leads') || '[]');
    const cats = [...new Set(savedLeads.map(l => l.type))].filter(Boolean);
    const combined = [...new Set([...ALL_PRESETS, ...cats])];
    setAvailableCategories(combined);

    // Relógio para checar execução
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const saveTriggers = (newTriggers) => {
    setTriggers(newTriggers);
    localStorage.setItem('scrapper_triggers', JSON.stringify(newTriggers));
  };

  const saveSchedules = (newSchedules) => {
    setSchedules(newSchedules);
    localStorage.setItem('scrapper_schedules', JSON.stringify(newSchedules));
  };

  const updateAntiBan = (field, value) => {
    const newVal = { ...antiBan, [field]: Number(value) };
    setAntiBan(newVal);
    localStorage.setItem('scrapper_antiban', JSON.stringify(newVal));
  };

  const showAlert = (title, message) => {
    setDialog({ isOpen: true, title, message });
  };

  // Funções de Gatilho (SZap)
  const addTrigger = () => {
    const newTrigger = { id: Date.now().toString(), stage: stages[0], message: '', active: true };
    saveTriggers([...triggers, newTrigger]);
  };

  const updateTrigger = (id, field, value) => {
    const newTriggers = triggers.map(t => t.id === id ? { ...t, [field]: value } : t);
    saveTriggers(newTriggers);
  };

  const removeTrigger = (id) => {
    saveTriggers(triggers.filter(t => t.id !== id));
  };

  // Funções de Agendador (Busca)
  const addSchedule = () => {
    const newSchedule = { 
      id: Date.now().toString(), 
      category: 'Dentista', 
      city: 'São Paulo', 
      frequency: 'daily', // daily, weekly
      time: '08:00',
      active: true 
    };
    saveSchedules([...schedules, newSchedule]);
  };

  const updateSchedule = (id, field, value) => {
    const newSchedules = schedules.map(s => s.id === id ? { ...s, [field]: value } : s);
    saveSchedules(newSchedules);
  };

  const removeSchedule = (id) => {
    saveSchedules(schedules.filter(s => s.id !== id));
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-8 bg-dark-900 text-gray-300 relative">
      
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">{dialog.title}</h3>
            <p className="text-gray-400 text-sm mb-6">{dialog.message}</p>
            <button 
              onClick={() => setDialog({ isOpen: false, title: '', message: '' })}
              className="w-full py-2 rounded-lg text-sm font-bold text-white transition-colors shadow-lg bg-primary-600 hover:bg-primary-500"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center border-b border-dark-700 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400" /> Central de Automação
            </h1>
            <p className="text-gray-400 mt-2">Coloque o seu CRM no Piloto Automático.</p>
          </div>
        </div>

        {/* AGENDADOR DE BUSCAS */}
        <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-dark-900/50 p-6 border-b border-dark-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg"><Clock className="w-5 h-5 text-blue-500" /></div>
              <div>
                <h2 className="text-lg font-bold text-white">Agendador de Buscas Furtivas</h2>
                <p className="text-xs text-gray-500">Programe o robô para varrer a Receita Federal e te dar leads novos enquanto você dorme.</p>
              </div>
            </div>
            <button onClick={addSchedule} className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border border-dark-600 hover:border-gray-500">
              <Plus className="w-4 h-4" /> Novo Agendamento
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            {schedules.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-dark-700 rounded-xl">
                Nenhuma rotina configurada. O robô está parado.
              </div>
            ) : (
              schedules.map(schedule => (
                <div key={schedule.id} className={`flex gap-4 p-5 rounded-xl border ${schedule.active ? 'bg-dark-900 border-dark-700' : 'bg-dark-900/30 border-dark-800 opacity-50'} transition-all`}>
                  
                  <div className="flex-1 grid grid-cols-2 gap-4">
                     <div className="col-span-2 flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-300">Configuração de Busca</span>
                        {schedule.active ? (
                          schedule.time === currentTime ? (
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                              </span>
                              <span className="text-xs font-bold text-blue-400">Em Execução...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              <span className="text-xs font-bold text-green-400">Aguardando Horário ({schedule.time})</span>
                            </div>
                          )
                        ) : (
                          <div className="px-3 py-1 bg-dark-700 rounded-full">
                            <span className="text-xs font-bold text-gray-500">Pausado</span>
                          </div>
                        )}
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Categoria (O que buscar?)</label>
                        <input 
                          type="text" 
                          list="categories-list"
                          value={schedule.category}
                          onChange={(e) => updateSchedule(schedule.id, 'category', e.target.value)}
                          placeholder="Digite ou selecione..."
                          className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                        <datalist id="categories-list">
                           <option value="Todas as Categorias" />
                           {availableCategories.map(c => <option key={c} value={c} />)}
                        </datalist>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Cidade (Onde?)</label>
                        <input 
                          type="text" 
                          value={schedule.city}
                          onChange={(e) => updateSchedule(schedule.id, 'city', e.target.value)}
                          className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Frequência</label>
                        <select 
                          value={schedule.frequency}
                          onChange={(e) => updateSchedule(schedule.id, 'frequency', e.target.value)}
                          className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="daily">Todos os dias</option>
                          <option value="weekly_monday">Toda Segunda-feira</option>
                          <option value="weekly_tuesday">Toda Terça-feira</option>
                          <option value="weekly_wednesday">Toda Quarta-feira</option>
                          <option value="weekly_thursday">Toda Quinta-feira</option>
                          <option value="weekly_friday">Toda Sexta-feira</option>
                          <option value="weekly_saturday">Todo Sábado</option>
                          <option value="weekly_sunday">Todo Domingo</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Horário de Execução</label>
                        <input 
                          type="time" 
                          value={schedule.time}
                          onChange={(e) => updateSchedule(schedule.id, 'time', e.target.value)}
                          className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                     </div>
                  </div>

                  <div className="flex flex-col items-center justify-between border-l border-dark-700 pl-4">
                    <label className="flex items-center cursor-pointer mb-2" title="Ativar/Desativar">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={schedule.active} onChange={(e) => updateSchedule(schedule.id, 'active', e.target.checked)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${schedule.active ? 'bg-blue-500' : 'bg-dark-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${schedule.active ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                    </label>
                    <button onClick={() => removeSchedule(schedule.id)} className="text-gray-500 hover:text-red-400 p-2 transition-colors bg-dark-800 rounded-lg border border-dark-700 hover:border-red-500/30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Automacao;
