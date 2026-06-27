import React, { useState, useEffect } from 'react';
import { Search, Download, Upload, Globe, Phone, Camera, ShieldAlert, MoreVertical, Trash2, KanbanSquare, List, X, Save, Edit3, MessageCircle, MapPin, Plus, Edit2, AlertCircle, HelpCircle, Building, Loader2, Zap } from 'lucide-react';
import { supabase } from '../services/supabase';
import { encryptLead, decryptLead } from '../services/encryption';
import { useAuth } from '../context/AuthContext';

const Leads = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // UI States
  const [viewMode, setViewMode] = useState('kanban'); 
  const [selectedLead, setSelectedLead] = useState(null);
  const [draggingLeadId, setDraggingLeadId] = useState(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [selectedForEnrichment, setSelectedForEnrichment] = useState([]);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  
  // Custom Dialog State
  const [dialog, setDialog] = useState({ isOpen: false, type: 'alert', title: '', message: '', defaultValue: '', onConfirm: null });
  const [dialogInput, setDialogInput] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [presenceFilter, setPresenceFilter] = useState(null);
  const [scoreFilter, setScoreFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  useEffect(() => {
    const loadData = async () => {
      const savedStages = JSON.parse(localStorage.getItem('scrapper_stages') || '["Novos", "Em Contato", "Reunião Marcada", "Fechados", "Arquivados"]');
      setStages(savedStages);

      if (user) {
        const { data, error } = await supabase.from('leads').select('*').eq('user_id', user.id);
        if (data) {
          const decryptedLeads = data.map(l => {
            const dec = decryptLead(l);
            return {
              ...dec,
              stage: savedStages.includes(dec.stage) ? dec.stage : savedStages[0],
              notes: dec.notes || ''
            };
          });
          setLeads(decryptedLeads);
        }
      }
      setLoadingData(false);
    };
    
    loadData();
  }, [user]);

  const saveLeads = async (newLeads) => {
    setLeads(newLeads); // Atualiza UI instantaneamente
    if (user && newLeads.length > 0) {
      const encryptedLeads = newLeads.map(l => ({
        ...encryptLead(l),
        user_id: user.id
      }));
      // Sincroniza em background
      await supabase.from('leads').upsert(encryptedLeads);
    } else if (user && newLeads.length === 0) {
      // Se limpou tudo
      await supabase.from('leads').delete().eq('user_id', user.id);
    }
  };

  const saveStages = (newStages) => {
    setStages(newStages);
    localStorage.setItem('scrapper_stages', JSON.stringify(newStages));
  };

  const closeDialog = () => setDialog({ isOpen: false, type: 'alert', title: '', message: '', defaultValue: '', onConfirm: null });

  const showPrompt = (title, message, defaultValue, onConfirm) => {
    setDialogInput(defaultValue || '');
    setDialog({ isOpen: true, type: 'prompt', title, message, onConfirm });
  };

  const showConfirm = (title, message, onConfirm) => {
    setDialog({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  const showAlert = (title, message) => {
    setDialog({ isOpen: true, type: 'alert', title, message, onConfirm: closeDialog });
  };

  const clearLeads = () => {
    showConfirm('Limpar Todos os Leads', 'Tem certeza que deseja apagar TODOS os leads? Esta ação não pode ser desfeita.', async () => {
      setLeads([]);
      if (user) {
        await supabase.from('leads').delete().eq('user_id', user.id);
      }
      closeDialog();
    });
  };

  const handleExportCSV = () => {
    if (leads.length === 0) {
      showAlert('Atenção', 'Não há leads para exportar.');
      return;
    }
    const headers = ['Nome', 'Categoria', 'Telefone', 'Website', 'Instagram', 'Endereço', 'Etapa', 'Score'];
    const csvContent = [
      headers.join(','),
      ...leads.map(l => [
        `"${l.name || ''}"`, `"${l.type || ''}"`, `"${l.phone || ''}"`, `"${l.website || ''}"`, `"${l.instagram || ''}"`, `"${l.address || ''}"`, `"${l.stage || ''}"`, `"${l.score || 0}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "leads_exportados.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Gerenciamento de Etapas (Kanban)
  const handleAddStage = () => {
    showPrompt('Nova Etapa', 'Qual o nome da nova etapa?', '', (val) => {
      const newStage = val.trim();
      if (newStage !== '') {
        if (!stages.includes(newStage)) {
          saveStages([...stages, newStage]);
          closeDialog();
        } else {
          showAlert('Erro', 'Esta etapa já existe.');
        }
      }
    });
  };

  const handleRenameStage = (oldName) => {
    showPrompt('Renomear Etapa', `Digite o novo nome para a etapa "${oldName}":`, oldName, (val) => {
      const newName = val.trim();
      if (newName !== '' && newName !== oldName) {
        if (stages.includes(newName)) {
          showAlert('Erro', 'Já existe uma etapa com esse nome.');
          return;
        }
        const updatedStages = stages.map(s => s === oldName ? newName : s);
        const updatedLeads = leads.map(l => l.stage === oldName ? { ...l, stage: newName } : l);
        saveStages(updatedStages);
        saveLeads(updatedLeads);
        closeDialog();
      } else {
        closeDialog();
      }
    });
  };

  const handleDeleteStage = (stageName) => {
    if (stages.length <= 1) {
      showAlert('Atenção', 'Você precisa ter pelo menos uma etapa no CRM.');
      return;
    }
    const fallbackStage = stages[0] === stageName ? stages[1] : stages[0];
    
    showConfirm(
      'Excluir Etapa', 
      `Tem certeza que deseja excluir a etapa "${stageName}"?\n\nOs leads que estão nela serão movidos automaticamente para a etapa "${fallbackStage}".`, 
      () => {
        const updatedStages = stages.filter(s => s !== stageName);
        const updatedLeads = leads.map(l => l.stage === stageName ? { ...l, stage: fallbackStage } : l);
        saveStages(updatedStages);
        saveLeads(updatedLeads);
        closeDialog();
      }
    );
  };

  const deleteLead = (id) => {
    showConfirm('Excluir Lead', 'Excluir este lead definitivamente do CRM?', () => {
      saveLeads(leads.filter(l => l.id !== id));
      setSelectedLead(null);
      closeDialog();
    });
  };

  const handleEnrichLead = async () => {
    if (!selectedLead) return;
    setIsEnriching(true);
    try {
      const response = await fetch('http://localhost:3001/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedLead.name, address: selectedLead.address })
      });
      const data = await response.json();
      
      if (data.success) {
        let updatedLead = { ...selectedLead };
        let count = 0;
        if (data.instagram && !selectedLead.instagram) { updatedLead.instagram = data.instagram; count++; }
        if (data.website && !selectedLead.website) { updatedLead.website = data.website; count++; }
        
        if (count > 0) {
          updateLeadDetails(updatedLead);
          showAlert('Caçada Bem-sucedida! 🎯', `Encontramos e injetamos ${count} novo(s) dado(s) oficial(is) desta empresa no CRM.`);
        } else {
          showAlert('Ops', 'O robô vasculhou a web, mas não encontrou o Instagram ou o Site oficial desta empresa.');
        }
      } else {
        showAlert('Erro', data.error);
      }
    } catch (e) {
      showAlert('Erro', 'Falha ao comunicar com o servidor (O backend está rodando?).');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleBulkEnrich = async () => {
    if (selectedForEnrichment.length === 0) return;
    setIsBulkEnriching(true);
    setBulkProgress({ current: 0, total: selectedForEnrichment.length });
    
    let currentLeads = [...leads];
    let updatedCount = 0;
    
    for (let i = 0; i < selectedForEnrichment.length; i++) {
      const id = selectedForEnrichment[i];
      const lead = currentLeads.find(l => l.id === id);
      if (!lead) continue;
      
      try {
        const response = await fetch('http://localhost:3001/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: lead.name, address: lead.address })
        });
        const data = await response.json();
        if (data.success) {
          if ((data.instagram && !lead.instagram) || (data.website && !lead.website)) {
             const updatedLead = { 
               ...lead, 
               instagram: data.instagram || lead.instagram,
               website: data.website || lead.website
             };
             currentLeads = currentLeads.map(l => l.id === id ? updatedLead : l);
             updatedCount++;
          }
        }
      } catch (e) { console.error(e); }
      
      setBulkProgress({ current: i + 1, total: selectedForEnrichment.length });
    }
    
    saveLeads(currentLeads);
    setSelectedForEnrichment([]);
    setIsBulkEnriching(false);
    showAlert('Enriquecimento em Massa Concluído!', `${updatedCount} leads receberam novos dados oficiais (Site/Instagram) de forma automática.`);
  };

  // Categorias Dinâmicas Disponíveis
  const availableCategories = [...new Set(leads.map(l => l.type))].filter(Boolean);

  // Filtros Reais
  const filteredLeads = leads.filter(lead => {
    if (searchTerm && !lead.name.toLowerCase().includes(searchTerm.toLowerCase()) && !(lead.type || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (presenceFilter === 'phone' && !lead.phone) return false;
    if (presenceFilter === 'site' && !lead.website) return false;
    if (presenceFilter === 'instagram' && !lead.instagram) return false;
    if (presenceFilter === 'cnpj' && !lead.cnpj) return false;
    if (presenceFilter === 'none' && (lead.phone || lead.website || lead.instagram || lead.cnpj)) return false;
    if (scoreFilter === 'high' && (lead.score || 0) < 50) return false;
    if (scoreFilter === 'low' && (lead.score || 0) >= 50) return false;
    if (categoryFilter !== 'all' && lead.type !== categoryFilter) return false;
    if (stageFilter !== 'all' && lead.stage !== stageFilter) return false;
    return true;
  });

  const checkAndFireTriggers = async (lead, newStage) => {
    if (lead.stage === newStage) return; // Não mudou de etapa
    
    const triggers = JSON.parse(localStorage.getItem('scrapper_triggers') || '[]');
    const activeTrigger = triggers.find(t => t.active && t.stage === newStage);
    
    if (activeTrigger && lead.phone) {
      // Processando Variáveis Mágicas
      let finalMessage = activeTrigger.message || '';
      finalMessage = finalMessage.replace(/\{\{nome\}\}/g, lead.name || 'Empresa');
      let localidade = (lead.address || '').split('-')[0].split(',')[0].trim();
      finalMessage = finalMessage.replace(/\{\{cidade\}\}/g, localidade || 'sua região');
      finalMessage = finalMessage.replace(/\{\{categoria\}\}/g, lead.type || 'seu segmento');
      finalMessage = finalMessage.replace(/\{\{telefone\}\}/g, lead.phone || '');

      try {
        await fetch('http://localhost:3001/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: lead.phone, message: finalMessage })
        });
        showAlert('Automação S-Zap Disparada! 🚀', `A mensagem foi colocada na fila de envio para ${lead.name} e será disparada em segundo plano respeitando o Anti-Ban.`);
      } catch (e) { console.error('Erro no disparo automático', e); }
    }
  };

  const handleDragStart = (e, id) => {
    setDraggingLeadId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, stage) => {
    e.preventDefault();
    if (!draggingLeadId) return;
    
    const leadToMove = leads.find(l => l.id === draggingLeadId);
    if (leadToMove) {
      checkAndFireTriggers(leadToMove, stage);
      const newLeads = leads.map(l => l.id === draggingLeadId ? { ...l, stage } : l);
      saveLeads(newLeads);
    }
    setDraggingLeadId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const updateLeadDetails = (updatedLead) => {
    const oldLead = leads.find(l => l.id === updatedLead.id);
    if (oldLead && oldLead.stage !== updatedLead.stage) {
      checkAndFireTriggers(oldLead, updatedLead.stage);
    }
    const newLeads = leads.map(l => l.id === updatedLead.id ? updatedLead : l);
    saveLeads(newLeads);
    setSelectedLead(updatedLead);
  };

  const formatInstagramLink = (ig) => {
    if (!ig) return '#';
    if (ig.startsWith('http')) return ig;
    return `https://instagram.com/${ig.replace('@', '')}`;
  };

  const openGoogleMaps = (name, address) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`, '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-dark-900 text-gray-300 relative">
      
      {/* GLOBAL CUSTOM DIALOG */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {dialog.type === 'alert' && <AlertCircle className="w-6 h-6 text-primary-500" />}
                {dialog.type === 'confirm' && <HelpCircle className="w-6 h-6 text-yellow-500" />}
                {dialog.type === 'prompt' && <Edit2 className="w-6 h-6 text-blue-500" />}
                <h3 className="text-xl font-bold text-white">{dialog.title}</h3>
              </div>
              <p className="text-gray-400 text-sm whitespace-pre-wrap mb-5">{dialog.message}</p>
              
              {dialog.type === 'prompt' && (
                <input 
                  type="text" 
                  autoFocus
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') dialog.onConfirm(dialogInput); }}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-sm text-gray-200 focus:border-primary-500 focus:outline-none mb-2"
                />
              )}
            </div>
            
            <div className="p-4 bg-dark-900/50 border-t border-dark-700 flex justify-end gap-3">
              {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
                <button 
                  onClick={closeDialog}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={() => {
                  if (dialog.type === 'prompt') dialog.onConfirm(dialogInput);
                  else dialog.onConfirm();
                }}
                className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition-colors shadow-lg ${
                  dialog.type === 'alert' ? 'bg-primary-600 hover:bg-primary-500' :
                  dialog.type === 'confirm' ? 'bg-red-600 hover:bg-red-500' :
                  'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {dialog.type === 'alert' ? 'OK' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-dark-800">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">CRM (Pipeline)</h1>
          <p className="text-sm text-gray-500">Gerencie seus leads capturados</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-dark-800 rounded-lg p-1 flex mr-4 border border-dark-700">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'list' ? 'bg-primary-500/20 text-primary-500' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <List className="w-4 h-4" /> Lista
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'kanban' ? 'bg-primary-500/20 text-primary-500' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <KanbanSquare className="w-4 h-4" /> Kanban
            </button>
          </div>

          <button onClick={clearLeads} className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors mr-2">
            <Trash2 className="w-4 h-4" /> Limpar Tudo
          </button>
          <button onClick={handleExportCSV} className="bg-dark-800 border border-dark-700 hover:border-gray-500 hover:text-white text-gray-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 flex-1 flex flex-col overflow-hidden">
        
        {/* Search & Global Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar empresa..."
              className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary-500 text-gray-200"
            />
          </div>
          
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500 appearance-none text-gray-300 w-48 cursor-pointer"
          >
            <option value="all">Todas as Categorias</option>
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {viewMode === 'list' && (
            <select 
              value={stageFilter} 
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500 appearance-none text-gray-300 w-48 cursor-pointer"
            >
              <option value="all">Todas as Etapas</option>
              {stages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          )}

          <select 
            value={scoreFilter} 
            onChange={(e) => setScoreFilter(e.target.value)}
            className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500 appearance-none text-gray-300 w-40 cursor-pointer"
          >
            <option value="all">Todos os scores</option>
            <option value="high">Score Alto (≥50)</option>
            <option value="low">Score Baixo (&lt;50)</option>
          </select>
        </div>

        {/* Presence Filters */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Presença:</span>
          
          <button 
            onClick={() => setPresenceFilter(presenceFilter === 'phone' ? null : 'phone')}
            className={`border rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
              presenceFilter === 'phone' ? 'bg-primary-500/20 border-primary-500 text-primary-500' : 'bg-dark-800 border-dark-700 hover:border-gray-500 text-gray-400'
            }`}
          >
            <Phone className="w-3.5 h-3.5" /> Com Telefone
          </button>

          <button 
            onClick={() => setPresenceFilter(presenceFilter === 'site' ? null : 'site')}
             className={`border rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
              presenceFilter === 'site' ? 'bg-primary-500/20 border-primary-500 text-primary-500' : 'bg-dark-800 border-dark-700 hover:border-gray-500 text-gray-400'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Com Site
          </button>

          <button 
             onClick={() => setPresenceFilter(presenceFilter === 'instagram' ? null : 'instagram')}
             className={`border rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
              presenceFilter === 'instagram' ? 'bg-primary-500/20 border-primary-500 text-primary-500' : 'bg-dark-800 border-dark-700 hover:border-gray-500 text-gray-400'
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> Com Instagram
          </button>

          <button 
             onClick={() => setPresenceFilter(presenceFilter === 'cnpj' ? null : 'cnpj')}
             className={`border rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
              presenceFilter === 'cnpj' ? 'bg-primary-500/20 border-primary-500 text-primary-500' : 'bg-dark-800 border-dark-700 hover:border-gray-500 text-gray-400'
            }`}
          >
            <Building className="w-3.5 h-3.5" /> Com CNPJ
          </button>
        </div>

        {/* MODO SELEÇÃO EM MASSA (LISTA) */}
        {viewMode === 'list' && selectedForEnrichment.length > 0 && (
          <div className="bg-primary-500/10 border border-primary-500/30 p-3 rounded-xl mb-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-semibold text-primary-400">
              {selectedForEnrichment.length} leads selecionados para enriquecimento
            </span>
            <button
              onClick={handleBulkEnrich}
              disabled={isBulkEnriching}
              className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
            >
              {isBulkEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {isBulkEnriching ? `Enriquecendo (${bulkProgress.current}/${bulkProgress.total})...` : 'Caçar Redes em Massa'}
            </button>
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === 'list' && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-dark-700 bg-dark-900/50 text-xs font-bold text-gray-500 uppercase tracking-wider items-center">
              <div className="col-span-4 pl-2 flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={filteredLeads.length > 0 && selectedForEnrichment.length === filteredLeads.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedForEnrichment(filteredLeads.map(l => l.id));
                    } else {
                      setSelectedForEnrichment([]);
                    }
                  }}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/30"
                />
                EMPRESA ({filteredLeads.length})
              </div>
              <div className="col-span-2">CATEGORIA</div>
              <div className="col-span-2">CONTATO</div>
              <div className="col-span-2">ETAPA DO FUNIL</div>
              <div className="col-span-1">SCORE</div>
              <div className="col-span-1 text-center">AÇÕES</div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filteredLeads.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <p>Nenhum lead encontrado com esses filtros.</p>
                </div>
              ) : (
                <div className="divide-y divide-dark-700/50">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-dark-700/30 transition-colors cursor-pointer" onClick={() => setSelectedLead(lead)}>
                      <div className="col-span-4 flex items-center gap-3 pl-2">
                        <div onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            checked={selectedForEnrichment.includes(lead.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedForEnrichment(prev => [...prev, lead.id]);
                              else setSelectedForEnrichment(prev => prev.filter(id => id !== lead.id));
                            }}
                            className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/30 cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-200">{lead.name}</div>
                          <div className="text-xs text-gray-500 truncate" title={lead.address}>{lead.address}</div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="bg-dark-900 border border-dark-700 px-2 py-1 rounded-md text-xs text-gray-400">
                          {lead.type}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        {lead.phone ? <span className="text-sm text-gray-300 truncate">{lead.phone}</span> : <span className="text-xs text-gray-600">--</span>}
                      </div>
                      <div className="col-span-2">
                         <span className="bg-primary-500/10 text-primary-500 border border-primary-500/20 px-2 py-1 rounded-full text-xs font-medium">
                          {lead.stage}
                        </span>
                      </div>
                      <div className="col-span-1 text-sm font-bold text-gray-400">
                        {lead.score || 0}%
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button className="text-gray-500 hover:text-white p-1 transition-colors">
                           <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* KANBAN VIEW */}
        {viewMode === 'kanban' && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar flex gap-4 pb-2">
            {stages.map(stage => {
              const columnLeads = filteredLeads.filter(l => l.stage === stage);
              return (
                <div 
                  key={stage} 
                  className="bg-dark-800 border border-dark-700 rounded-xl min-w-[320px] max-w-[320px] flex flex-col shadow-sm"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <div className="p-4 border-b border-dark-700 flex justify-between items-center bg-dark-900/30 rounded-t-xl group">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-200">{stage}</h3>
                      <span className="bg-dark-900 text-gray-400 text-xs py-0.5 px-2 rounded-full border border-dark-700">
                        {columnLeads.length}
                      </span>
                    </div>
                    {/* Botões de renomear e excluir etapa */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleRenameStage(stage)} className="text-gray-500 hover:text-white p-1" title="Renomear Etapa"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteStage(stage)} className="text-gray-500 hover:text-red-400 p-1" title="Excluir Etapa"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3">
                    {columnLeads.map(lead => (
                      <div 
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => setSelectedLead(lead)}
                        className="bg-dark-900 border border-dark-700 p-4 rounded-lg cursor-grab active:cursor-grabbing hover:border-primary-500/50 transition-colors shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-bold text-gray-200 leading-tight">{lead.name}</h4>
                        </div>
                        <span className="inline-block bg-dark-800 text-gray-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider mb-3">
                          {lead.type}
                        </span>
                        
                        <div className="flex items-center justify-between mt-2 pt-3 border-t border-dark-800">
                          <div className="flex gap-2">
                            {lead.phone && <Phone className="w-3.5 h-3.5 text-primary-500" />}
                            {lead.website && <Globe className="w-3.5 h-3.5 text-blue-400" />}
                            {lead.instagram && <Camera className="w-3.5 h-3.5 text-pink-500" />}
                          </div>
                          <span className="text-xs font-bold text-gray-500">Score {lead.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            
            <button 
               onClick={handleAddStage}
               className="min-w-[320px] max-w-[320px] border-2 border-dashed border-dark-700 bg-dark-800/30 rounded-xl flex items-center justify-center text-gray-500 hover:text-blue-500 hover:border-blue-500/50 hover:bg-blue-500/5 cursor-pointer transition-all h-[100px] mt-0 group"
            >
               <div className="flex flex-col items-center gap-2">
                 <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                 <span className="font-medium text-sm">Adicionar Etapa</span>
               </div>
            </button>
          </div>
        )}

      </div>

      {/* LEAD DETAILS MODAL */}
      {selectedLead && (
        <div className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center p-6 border-b border-dark-700">
              <h2 className="text-xl font-bold text-white">Ficha do Lead</h2>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-white transition-colors bg-dark-700 hover:bg-dark-600 rounded-full p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-6 mb-6">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome da Empresa</label>
                    <input 
                      type="text" 
                      value={selectedLead.name}
                      onChange={(e) => updateLeadDetails({...selectedLead, name: e.target.value})}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:border-primary-500 focus:outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                    <input 
                      type="text" 
                      value={selectedLead.type}
                      onChange={(e) => updateLeadDetails({...selectedLead, type: e.target.value})}
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:border-primary-500 focus:outline-none"
                    />
                 </div>
                 <div className="col-span-2 relative">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endereço Completo</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={selectedLead.address}
                        onChange={(e) => updateLeadDetails({...selectedLead, address: e.target.value})}
                        className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:border-primary-500 focus:outline-none"
                      />
                      <button 
                        onClick={() => openGoogleMaps(selectedLead.name, selectedLead.address)}
                        className="bg-dark-900 border border-dark-700 hover:border-gray-500 text-gray-300 px-4 rounded-lg flex items-center justify-center transition-colors"
                        title="Ver no Google Maps"
                      >
                        <MapPin className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                 </div>
              </div>

              <div className="border-t border-dark-700 py-6 grid grid-cols-3 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Phone className="w-3 h-3"/> Telefone</label>
                    <input 
                      type="text" 
                      value={selectedLead.phone || ''}
                      onChange={(e) => updateLeadDetails({...selectedLead, phone: e.target.value})}
                      placeholder="Não possui"
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:border-primary-500 focus:outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3"/> Website</span>
                    </label>
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={selectedLead.website || ''}
                        onChange={(e) => updateLeadDetails({...selectedLead, website: e.target.value})}
                        placeholder="Não possui"
                        className="flex-1 min-w-0 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-sm text-blue-400 focus:border-primary-500 focus:outline-none"
                      />
                      {selectedLead.website && (
                        <a href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`} target="_blank" rel="noreferrer" className="bg-dark-900 border border-dark-700 hover:bg-dark-700 flex items-center justify-center px-3 rounded-lg transition-colors">
                          <Globe className="w-3.5 h-3.5 text-gray-300" />
                        </a>
                      )}
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1"><Camera className="w-3 h-3"/> Instagram</span>
                    </label>
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={selectedLead.instagram || ''}
                        onChange={(e) => updateLeadDetails({...selectedLead, instagram: e.target.value})}
                        placeholder="Não possui"
                        className="flex-1 min-w-0 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-sm text-pink-400 focus:border-primary-500 focus:outline-none"
                      />
                      {selectedLead.instagram && (
                        <a href={formatInstagramLink(selectedLead.instagram)} target="_blank" rel="noreferrer" className="bg-dark-900 border border-dark-700 hover:bg-dark-700 flex items-center justify-center px-3 rounded-lg transition-colors">
                          <Camera className="w-3.5 h-3.5 text-gray-300" />
                        </a>
                      )}
                    </div>
                 </div>
              </div>

              <div className="mb-6">
                 <button 
                   onClick={handleEnrichLead}
                   disabled={isEnriching}
                   className="w-full bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors disabled:opacity-50"
                 >
                   {isEnriching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                   {isEnriching ? 'Vasculhando a internet...' : 'Caçar Redes Sociais e Site (Enriquecimento)'}
                 </button>
              </div>

              <div className="border-t border-dark-700 pt-6">
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Anotações / Contexto da Venda</label>
                 <textarea 
                    value={selectedLead.notes || ''}
                    onChange={(e) => updateLeadDetails({...selectedLead, notes: e.target.value})}
                    placeholder="Ex: Esse cliente é do Tatuapé, liguei ontem, pediu para retornar sexta-feira..."
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-sm text-gray-200 focus:border-primary-500 focus:outline-none min-h-[120px] custom-scrollbar resize-none"
                 ></textarea>
              </div>

              <div className="mt-6 flex items-center gap-4 p-4 bg-dark-900/50 rounded-xl border border-dark-700">
                 <label className="text-xs font-bold text-gray-500 uppercase">Mover lead para etapa:</label>
                 <select 
                    value={selectedLead.stage}
                    onChange={(e) => updateLeadDetails({...selectedLead, stage: e.target.value})}
                    className="bg-dark-800 border border-dark-600 rounded-lg px-4 py-2 text-sm text-primary-500 font-bold focus:border-primary-500 focus:outline-none cursor-pointer"
                 >
                   {stages.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>

            </div>

            <div className="p-6 border-t border-dark-700 bg-dark-900/50 rounded-b-2xl flex justify-between items-center">
              <button 
                onClick={() => deleteLead(selectedLead.id)}
                className="text-red-500 hover:text-white hover:bg-red-500/20 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Excluir Lead
              </button>
              <div className="flex gap-3">
                 {selectedLead.phone && (
                   <a 
                     href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, '')}`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-green-900/20"
                   >
                     <MessageCircle className="w-4 h-4" /> Chamar no Whats
                   </a>
                 )}
                 <button onClick={() => setSelectedLead(null)} className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary-900/20">
                   <Save className="w-4 h-4" /> Salvar & Fechar
                 </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Leads;
