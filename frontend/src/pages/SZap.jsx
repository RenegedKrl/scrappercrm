import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Smartphone, Send, MessageSquare, Zap, FileText, Download, 
  Users, Trash2, AlertTriangle, Shield, Play, StopCircle, RefreshCw, 
  CheckCircle2, Clock, MapPin, Search, ChevronRight, Settings, Image as ImageIcon, Video, File, Loader2, QrCode, Server
} from 'lucide-react';

const SZap = () => {
  const [activeTab, setActiveTab] = useState('painel');
  
  // Real Backend State
  const [waStatus, setWaStatus] = useState('disconnected'); // disconnected, connecting, qr, connected
  const [waQrCode, setWaQrCode] = useState(null);

  // States - Scripts
  const [scripts, setScripts] = useState([]);
  const [newScript, setNewScript] = useState({ name: '', type: 'texto', message: '' });

  // States - Campanhas
  const [campaignConfig, setCampaignConfig] = useState({
    type: 'Todos',
    segmento: '', // agora será selecionado pelo select
    bairro: '',
    cidade: '',
    limit: 0,
    name: '',
    message: '',
    interval: 30,
    varyInterval: true
  });
  
  const [leads, setLeads] = useState([]);
  const [targetCount, setTargetCount] = useState(0);

  // Status de disparo
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // States - Conversas
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // States - Custom Modal
  const [dialog, setDialog] = useState(null);

  // 1. Polling de status do servidor Node
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/whatsapp/status');
        const data = await res.json();
        setWaStatus(data.status);
        setWaQrCode(data.qrCodeUrl);
      } catch (err) {
        setWaStatus('disconnected');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // 2. Carregamento de dados locais
  useEffect(() => {
    const savedScripts = JSON.parse(localStorage.getItem('scrapper_scripts') || '[]');
    setScripts(savedScripts);
    const savedLeads = JSON.parse(localStorage.getItem('scrapper_leads') || '[]');
    setLeads(savedLeads);
  }, []);

  // 3. Cálculo de audiência da campanha
  useEffect(() => {
    let filtered = leads.filter(l => l.phone);
    if (campaignConfig.type !== 'Todos') filtered = filtered.filter(l => l.stage === campaignConfig.type);
    if (campaignConfig.segmento) filtered = filtered.filter(l => l.type === campaignConfig.segmento);
    if (campaignConfig.cidade) filtered = filtered.filter(l => (l.city || l.address || '').toLowerCase().includes(campaignConfig.cidade.toLowerCase()));
    if (campaignConfig.limit > 0) filtered = filtered.slice(0, campaignConfig.limit);
    setTargetCount(filtered.length);
  }, [campaignConfig, leads]);

  // Função para pegar categorias únicas
  const categoriasUnicas = [...new Set(leads.filter(l => l.type).map(l => l.type))].sort();

  const saveScript = () => {
    if (!newScript.name || !newScript.message) return setDialog({ title: 'Atenção', message: 'Preencha o nome e a mensagem.', type: 'error' });
    const updated = [...scripts, { id: Date.now().toString(), ...newScript }];
    setScripts(updated);
    localStorage.setItem('scrapper_scripts', JSON.stringify(updated));
    setNewScript({ name: '', type: 'texto', message: '' });
  };

  // Funções de Conexão com Servidor Backend
  const handleConnect = async () => {
    setWaStatus('connecting');
    try {
      await fetch('http://localhost:3001/api/whatsapp/connect', { method: 'POST' });
    } catch (err) {
      console.error(err);
      setWaStatus('disconnected');
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('http://localhost:3001/api/whatsapp/disconnect', { method: 'POST' });
      setWaStatus('disconnected');
    } catch (err) {}
  };

  const updateLeadStage = (leadId, newStage) => {
    setLeads(prevLeads => {
      const updatedLeads = [...prevLeads];
      const idx = updatedLeads.findIndex(l => l.id === leadId);
      if (idx !== -1) {
        updatedLeads[idx] = { ...updatedLeads[idx], stage: newStage };
        localStorage.setItem('scrapper_leads', JSON.stringify(updatedLeads));
      }
      return updatedLeads;
    });

    // Garante que a etapa exista no CRM
    const savedStages = JSON.parse(localStorage.getItem('scrapper_stages') || '["Novos", "Em Contato", "Reunião Marcada", "Fechados", "Arquivados"]');
    if (!savedStages.includes(newStage)) {
      savedStages.push(newStage);
      localStorage.setItem('scrapper_stages', JSON.stringify(savedStages));
    }
  };

  // Função Principal de Disparo
  const dispararCampanha = async () => {
    if (waStatus !== 'connected') return setDialog({ title: 'Desconectado', message: 'O WhatsApp não está conectado! Conecte-o antes de disparar.', type: 'error' });
    if (!campaignConfig.message) return setDialog({ title: 'Mensagem Vazia', message: 'Você precisa digitar uma mensagem para disparar.', type: 'error' });
    if (isSendingRef.current) return; // BLOQUEIA MULTIPLOS CLIQUES IMEDIATAMENTE (SÍNCRONO)!

    let filtered = leads.filter(l => l.phone);
    if (campaignConfig.type !== 'Todos') filtered = filtered.filter(l => l.stage === campaignConfig.type);
    if (campaignConfig.segmento) filtered = filtered.filter(l => l.type === campaignConfig.segmento);
    if (campaignConfig.cidade) filtered = filtered.filter(l => (l.city || l.address || '').toLowerCase().includes(campaignConfig.cidade.toLowerCase()));
    
    // FATIA O ARRAY PARA NÃO PASSAR DO LIMITE EM HIPÓTESE ALGUMA
    if (campaignConfig.limit > 0) filtered = filtered.slice(0, campaignConfig.limit);

    if (filtered.length === 0) return setDialog({ title: 'Sem Contatos', message: 'Nenhum lead com telefone encontrado para os filtros selecionados.', type: 'info' });

    isSendingRef.current = true;
    setIsSending(true);
    isSendingRef.current = true;
    setFailedCount(0);
    setActiveTab('painel'); // Vai pro dashboard ver os stats

    let enviadasNessaRodada = 0;
    let falhasNessaRodada = 0;

    for (let i = 0; i < filtered.length; i++) {
      if (!isSendingRef.current) break; // Usuário abortou o envio
      
      const lead = filtered[i];
      let msg = campaignConfig.message
        .replace(/{{nome}}/g, lead.name || '')
        .replace(/{{cidade}}/g, lead.city || '')
        .replace(/{{categoria}}/g, lead.type || '')
        .replace(/{{telefone}}/g, lead.phone || '');

      try {
        const res = await fetch('http://localhost:3001/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: lead.phone, message: msg })
        });
        const data = await res.json();
        
        if (data.success) {
           enviadasNessaRodada++;
           setSentCount(enviadasNessaRodada);
           
           // AUTO-UPDATE KANBAN STAGE SUCCESS
           if (lead.stage === 'Novos') {
             updateLeadStage(lead.id, 'Em Contato');
           }
        } else {
           falhasNessaRodada++;
           setFailedCount(falhasNessaRodada);
           
           // AUTO-UPDATE KANBAN STAGE ERROR
           updateLeadStage(lead.id, 'Erro');
           
           console.log(`[Erro] Lead ${lead.name} (${lead.phone}):`, data.error);
        }
      } catch (err) {
        falhasNessaRodada++;
        setFailedCount(falhasNessaRodada);
        
        // AUTO-UPDATE KANBAN STAGE ERROR
        updateLeadStage(lead.id, 'Erro');
        
        console.error('Erro ao enviar para', lead.phone);
      }

      // Delay Anti-ban
      if (i < filtered.length - 1 && isSendingRef.current) {
        let delay = campaignConfig.interval;
        if (campaignConfig.varyInterval) {
           // Varia o delay em +- 30% do configurado para parecer um humano digitando
           const variance = delay * 0.3;
           delay = Math.floor(Math.random() * (variance * 2)) + (delay - variance);
        }
        await new Promise(res => setTimeout(res, Math.max(5, delay) * 1000));
      }
    }
    
    setIsSending(false);
    isSendingRef.current = false;
    setIsSending(false);
    isSendingRef.current = false;
    setDialog({ 
      title: 'Campanha Concluída!', 
      message: `✅ ${enviadasNessaRodada} Enviadas com sucesso.\n❌ ${falhasNessaRodada} Falharam (Fixo ou Sem WhatsApp).`, 
      type: 'success' 
    });
  };

  const pararCampanha = () => {
    isSendingRef.current = false;
    setIsSending(false);
  };

  // Funções das Conversas
  const loadChats = async () => {
    if (waStatus !== 'connected') return;
    setLoadingChats(true);
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/chats');
      const data = await res.json();
      if (data.success) setChats(data.chats);
    } catch (err) {
      console.error(err);
    }
    setLoadingChats(false);
  };

  const selectChat = async (chat) => {
    setSelectedChat(chat);
    setLoadingMessages(true);
    try {
      const res = await fetch(`http://localhost:3001/api/whatsapp/chats/${encodeURIComponent(chat.id)}/messages`);
      const data = await res.json();
      if (data.success) {
        // As mensagens geralmente vêm na ordem (antiga p/ nova), vamos garantir:
        setChatMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingMessages(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    // Adiciona mock visual temporário na tela
    const fakeMessage = { id: Date.now().toString(), body: newMessage, fromMe: true, timestamp: Date.now()/1000 };
    setChatMessages([...chatMessages, fakeMessage]);
    const messageToSend = newMessage;
    setNewMessage('');

    try {
      await fetch('http://localhost:3001/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChat.id, message: messageToSend })
      });
    } catch (err) {
      console.error('Erro ao enviar resposta', err);
    }
  };

  const isConnected = waStatus === 'connected';

  return (
    <div className="h-full flex flex-col bg-[#121212] text-gray-300">
      
      {/* HEADER PRINCIPAL */}
      <div className="px-8 pt-6 pb-4 border-b border-white/5 bg-[#121212]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-[#25D366]/20' : 'bg-gray-800'}`}>
              <MessageCircle className={`w-6 h-6 ${isConnected ? 'text-[#25D366]' : 'text-gray-500'}`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">S-zap</h1>
              <p className="text-[11px] text-gray-500 font-medium">Motor de Automação Oficial</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs font-semibold text-gray-400">
            <div className="flex items-center gap-1.5 bg-dark-800 px-3 py-1.5 rounded-full border border-dark-700">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#25D366]' : waStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
              {isConnected ? <span className="text-[#25D366]">Conectado</span> : 
               waStatus === 'connecting' ? <span className="text-yellow-500">Inicializando...</span> :
               waStatus === 'qr' ? <span className="text-blue-500">Aguardando QR Code</span> :
               <span>Desconectado</span>}
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO HORIZONTAL */}
        <div className="flex items-center gap-8">
          {[
            { id: 'painel', label: 'Painel', icon: Zap },
            { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
            { id: 'campanhas', label: 'Campanhas', icon: Send },
            { id: 'conversas', label: 'Conversas', icon: MessageSquare },
            { id: 'scripts', label: 'Scripts', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'conversas') loadChats();
              }}
              className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === tab.id 
                ? 'text-[#25D366] border-[#25D366]' 
                : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0f0f0f] p-8">
        
        {/* ABA: PAINEL */}
        {activeTab === 'painel' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {!isConnected && (
              <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-[#222] transition-colors" onClick={() => setActiveTab('whatsapp')}>
                <div className="flex items-center gap-4">
                  <div className="bg-dark-800 p-2.5 rounded-full"><Smartphone className="w-5 h-5 text-gray-500" /></div>
                  <div>
                    <h3 className="text-white font-bold text-sm">WhatsApp não conectado</h3>
                    <p className="text-gray-500 text-xs mt-0.5">Clique para escanear o QR Code no servidor interno</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-5 flex items-center gap-4">
                <div className="bg-blue-500/10 p-3 rounded-lg"><Users className="w-5 h-5 text-blue-500" /></div>
                <div>
                  <div className="text-2xl font-bold text-white">{leads.filter(l => l.phone).length}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Leads com Telefone</div>
                </div>
              </div>
              <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-5 flex items-center gap-4">
                <div className="bg-purple-500/10 p-3 rounded-lg"><Send className="w-5 h-5 text-purple-500" /></div>
                <div>
                  <div className="text-2xl font-bold text-white">{sentCount}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Mensagens Enviadas (Sessão)</div>
                </div>
              </div>
              <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-5 flex items-center gap-4">
                <div className="bg-green-500/10 p-3 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-500" /></div>
                <div>
                  <div className="text-2xl font-bold text-white">{isConnected ? 'Online' : 'Offline'}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Status da API</div>
                </div>
              </div>
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-16 flex flex-col items-center justify-center text-center">
              {isSending ? (
                <>
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#25D366]/20 flex items-center justify-center animate-pulse">
                      <Send className="w-8 h-8 text-[#25D366] translate-x-1" />
                    </div>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">Campanha em Andamento!</h3>
                  <p className="text-[#25D366] font-bold text-xl mb-1">{sentCount} de {targetCount} enviados com sucesso</p>
                  {failedCount > 0 && <p className="text-red-500 font-bold text-sm mb-6">{failedCount} pularam (Eram Telefone Fixo)</p>}
                  
                  <button 
                    onClick={pararCampanha}
                    className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-red-900/20"
                  >
                    <StopCircle className="w-5 h-5" /> Abortar Campanha
                  </button>
                </>
              ) : (
                <>
                  <Send className="w-10 h-10 text-gray-600 mb-4" />
                  <h3 className="text-white font-bold text-sm mb-1">{sentCount > 0 ? 'Campanha finalizada' : 'Nenhuma campanha rodando'}</h3>
                  <p className="text-gray-500 text-xs mb-6">Vá na aba Campanhas para configurar seu disparo e aquecer seus leads.</p>
                  <button onClick={() => setActiveTab('campanhas')} className="bg-dark-800 border border-dark-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-dark-700 transition-colors">Configurar Disparo</button>
                </>
              )}
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="bg-green-500/10 p-2.5 rounded-lg"><Server className="w-5 h-5 text-[#25D366]" /></div>
                <div>
                  <h3 className="text-white font-bold text-sm">Nó Central: API Whatsapp Web.js rodando</h3>
                  <p className="text-gray-500 text-xs mt-0.5">O sistema resolve os números sem o 9º dígito automaticamente para evitar erros (No LID for user).</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: WHATSAPP */}
        {activeTab === 'whatsapp' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-16 flex flex-col items-center justify-center text-center">
              
              {waStatus === 'disconnected' && (
                <>
                  <div className="bg-dark-800 p-4 rounded-full mb-6">
                    <MessageCircle className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">WhatsApp Desconectado</h3>
                  <p className="text-gray-500 text-sm mb-6">Clique no botão abaixo para instanciar o Chromium no servidor Node.</p>
                  <button 
                    onClick={handleConnect}
                    className="bg-[#25D366] hover:bg-[#1ebc59] text-black px-6 py-2.5 rounded-full text-sm font-bold transition-colors shadow-lg shadow-[#25D366]/20"
                  >
                    Ativar Robô S-zap
                  </button>
                </>
              )}

              {waStatus === 'connecting' && (
                <>
                  <div className="mb-6"><Loader2 className="w-12 h-12 text-[#25D366] animate-spin" /></div>
                  <h3 className="text-white font-bold text-lg mb-2">Iniciando Servidor Interno...</h3>
                  <p className="text-gray-500 text-sm mb-6">Estamos abrindo o WhatsApp no servidor (pode demorar alguns segundos na primeira vez).</p>
                </>
              )}

              {waStatus === 'qr' && (
                <>
                  <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2"><QrCode className="w-6 h-6 text-blue-500"/> Escaneie o QR Code</h3>
                  <p className="text-gray-400 text-sm mb-6">Abra o WhatsApp no seu celular, vá em "Aparelhos Conectados" e aponte para a imagem abaixo.</p>
                  
                  {waQrCode ? (
                    <div className="bg-white p-4 rounded-xl shadow-2xl mb-6 border-4 border-[#25D366]">
                      <img src={waQrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                    </div>
                  ) : (
                    <div className="w-64 h-64 bg-dark-800 rounded-xl mb-6 flex items-center justify-center border-2 border-dashed border-dark-600">
                      <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
                    </div>
                  )}
                  <p className="text-xs text-gray-500">O código muda automaticamente a cada 20 segundos.</p>
                </>
              )}

              {waStatus === 'connected' && (
                <>
                  <div className="bg-[#25D366]/20 p-4 rounded-full mb-6 relative">
                     <MessageCircle className="w-12 h-12 text-[#25D366]" />
                     <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 border-2 border-[#1c1c1c] rounded-full"></div>
                  </div>
                  <h3 className="text-white font-bold text-2xl mb-2">Conexão Estabelecida!</h3>
                  <p className="text-green-500 font-bold text-sm mb-8">Seu dispositivo está logado com segurança através da biblioteca whatsapp-web.js</p>
                  <button 
                    onClick={handleDisconnect}
                    className="bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 px-8 py-2.5 rounded-full text-sm font-bold transition-colors"
                  >
                    Desconectar Número
                  </button>
                </>
              )}
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4 flex gap-4 items-start">
              <Shield className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-white font-bold text-sm mb-1">Arquitetura de Segurança</h4>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Diferente de sistemas web comuns, a automação S-zap roda dentro do processo Node.js nativo da sua máquina (via Puppeteer). 
                  Isso evita bloqueios instantâneos, pois não compartilha IPs sujos ou infraestruturas de terceiros. Seu computador é o servidor hospedeiro.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ABA: CAMPANHAS */}
        {activeTab === 'campanhas' && (
          <div className="max-w-[1400px] mx-auto h-full flex gap-6">
            
            {/* Esquerda: Filtros e Logs */}
            <div className="flex-1 flex flex-col gap-4">
              {!isConnected && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <div>
                      <h4 className="text-white font-bold text-sm">WhatsApp não conectado</h4>
                      <p className="text-yellow-500/70 text-xs">Vá para a aba WhatsApp e abra o seu QR Code para ativar o robô.</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('whatsapp')} className="bg-dark-800 text-white px-4 py-1.5 rounded-lg text-xs font-bold border border-dark-600 hover:bg-dark-700">Conectar</button>
                </div>
              )}

              <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-6">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">Etapa do Pipeline CRM</div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {['Todos', 'Novos', 'Em Contato', 'Reunião Marcada', 'Fechados', 'Arquivados'].map(type => (
                    <button 
                      key={type}
                      onClick={() => setCampaignConfig({...campaignConfig, type})}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${campaignConfig.type === type ? 'bg-dark-700 text-white border-dark-500' : 'bg-dark-900/50 text-gray-500 border-dark-800 hover:border-dark-600'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">Filtragem Direcionada</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1.5">Segmento (Categoria)</label>
                    <select 
                      value={campaignConfig.segmento} 
                      onChange={e => setCampaignConfig({...campaignConfig, segmento: e.target.value})}
                      className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#25D366]"
                    >
                      <option value="">Todas as Categorias</option>
                      {categoriasUnicas.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1.5">Cidade (ou Estado)</label>
                    <input type="text" placeholder="ex: São Paulo" value={campaignConfig.cidade} onChange={e => setCampaignConfig({...campaignConfig, cidade: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#25D366]" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1.5">Limite Máx de Disparos</label>
                    <input type="number" value={campaignConfig.limit} onChange={e => setCampaignConfig({...campaignConfig, limit: Number(e.target.value)})} className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#25D366]" />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 bg-[#1c1c1c] border border-white/5 rounded-xl p-3 flex justify-center items-center gap-2">
                  <Send className="w-4 h-4 text-gray-500" /> <span className="text-xs font-bold text-gray-400">Leads mapeados para disparo ( {targetCount} )</span>
                </div>
              </div>

              <div className="flex-1 bg-[#1c1c1c] border border-white/5 rounded-xl flex flex-col items-center justify-center p-8 min-h-[200px]">
                {targetCount === 0 ? (
                  <>
                    <Users className="w-8 h-8 text-gray-700 mb-3" />
                    <h4 className="text-sm font-bold text-gray-400">Nenhum lead compatível.</h4>
                    <p className="text-xs text-gray-600 mt-1">Busque leads primeiro usando a ferramenta Crawler na tela inicial, lembre-se que apenas os que tem telefone aparecem aqui.</p>
                  </>
                ) : (
                  <>
                    <Zap className="w-12 h-12 text-[#25D366] mb-4 drop-shadow-[0_0_15px_rgba(37,211,102,0.3)]" />
                    <h4 className="text-lg font-bold text-[#25D366] mb-1">Público Isolado!</h4>
                    <p className="text-sm font-medium text-gray-400 text-center">
                      Configuramos a rota de {targetCount} pacotes de disparo para serem distribuídos com segurança.<br/>
                      Configure a mensagem ao lado e aperte Disparar.
                    </p>
                  </>
                )}
              </div>

            </div>

            {/* Direita: Editor de Mensagem */}
            <div className="w-[450px] flex flex-col gap-4">
              <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2"><Settings className="w-4 h-4 text-[#25D366]" /> Criação do Script</h3>
                  <div className="flex bg-dark-900 rounded-lg p-1 border border-dark-700">
                    <button className="px-3 py-1 rounded text-xs font-bold bg-dark-700 text-white">Texto</button>
                    <select 
                       className="bg-transparent text-xs font-bold text-gray-400 focus:outline-none pl-2 pr-1"
                       onChange={(e) => {
                          const s = scripts.find(sc => sc.id === e.target.value);
                          if (s) setCampaignConfig({...campaignConfig, message: s.message});
                       }}
                    >
                       <option value="">Carregar Salvo...</option>
                       {scripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1.5">Variáveis Mágicas (Auto-Preenchimento)</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['{{nome}}', '{{cidade}}', '{{categoria}}', '{{telefone}}'].map(v => (
                    <button 
                      key={v} 
                      onClick={() => setCampaignConfig({...campaignConfig, message: campaignConfig.message + ' ' + v})}
                      className="bg-[#121212] hover:bg-[#222] border border-white/10 text-[#25D366] font-mono font-bold text-[11px] px-2 py-1 rounded transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1.5">Conteúdo da Mensagem</label>
                <textarea 
                  value={campaignConfig.message}
                  onChange={e => setCampaignConfig({...campaignConfig, message: e.target.value})}
                  placeholder="Fala chefe, vi que sua clínica de {{categoria}} está na região de {{cidade}}, você tem um minuto?"
                  className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#25D366] min-h-[150px] resize-none mb-3"
                ></textarea>
              </div>

              <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-yellow-500 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Radar Anti-Ban (Atraso)
                  </h3>
                  <div className="text-sm font-bold text-white bg-[#121212] px-3 py-1 rounded-lg border border-white/10">
                    {campaignConfig.interval} seg
                  </div>
                </div>

                <input 
                  type="range" min="5" max="120" 
                  value={campaignConfig.interval}
                  onChange={e => setCampaignConfig({...campaignConfig, interval: Number(e.target.value)})}
                  className="w-full accent-yellow-500 mb-3" 
                />
                
                <div className="flex justify-between items-center mb-6">
                  <div className="text-[10px] text-gray-500">Min: 5s • Máx: 120s</div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={campaignConfig.varyInterval} onChange={e => setCampaignConfig({...campaignConfig, varyInterval: e.target.checked})} className="rounded text-yellow-500" />
                    <span className="text-[10px] text-yellow-500 font-bold">Flutuação Aleatória</span>
                  </label>
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={dispararCampanha}
                    disabled={isSending || targetCount === 0}
                    className={`flex-1 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg ${isSending || targetCount === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-[#25D366] hover:bg-[#1ebc59] text-black shadow-[#25D366]/20'}`}
                  >
                    <Zap className="w-5 h-5 fill-current" /> {isSending ? 'Disparo em Andamento...' : 'ATACAR! (Disparar)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: CONVERSAS */}
        {activeTab === 'conversas' && (
          <div className="max-w-[1400px] mx-auto h-[600px] flex bg-[#1c1c1c] border border-white/5 rounded-xl overflow-hidden">
            
            {/* Lista de Chats (Esquerda) */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-[#121212]">
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-white font-bold text-sm">Mensagens Recentes</h3>
                <button onClick={loadChats} className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${loadingChats ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loadingChats ? (
                  <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 text-[#25D366] animate-spin" /></div>
                ) : chats.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">Nenhuma conversa encontrada. Dispare campanhas primeiro!</div>
                ) : (
                  chats.map(chat => (
                    <div 
                      key={chat.id} 
                      onClick={() => selectChat(chat)}
                      className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${selectedChat?.id === chat.id ? 'bg-[#25D366]/10 border-l-2 border-l-[#25D366]' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-white font-bold text-sm truncate pr-2">{chat.name}</h4>
                        {chat.unreadCount > 0 && <span className="bg-[#25D366] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{chat.unreadCount}</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{chat.lastMessage}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* View de Mensagens (Direita) */}
            <div className="flex-1 flex flex-col bg-[#0a0a0a]">
              {selectedChat ? (
                <>
                  <div className="p-4 border-b border-white/5 bg-[#121212] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-sm">{selectedChat.name}</h3>
                        <p className="text-[10px] text-gray-500 font-mono">{selectedChat.id.replace('@c.us', '')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {loadingMessages ? (
                      <div className="flex justify-center mt-10"><Loader2 className="w-8 h-8 text-[#25D366] animate-spin" /></div>
                    ) : chatMessages.length === 0 ? (
                      <div className="text-center text-xs text-gray-500 mt-10">Carregando histórico...</div>
                    ) : (
                      chatMessages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.fromMe ? 'bg-[#25D366] text-black rounded-tr-sm' : 'bg-[#1c1c1c] border border-white/5 text-gray-200 rounded-tl-sm'}`}>
                            {msg.body}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-4 bg-[#121212] border-t border-white/5 flex gap-3 items-center">
                    <input 
                      type="text" 
                      placeholder="Digite sua mensagem..." 
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 bg-[#1c1c1c] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#25D366]"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-[#25D366] hover:bg-[#1ebc59] text-black p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm font-bold">Selecione uma conversa ao lado para visualizar.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ABA: SCRIPTS */}
        {activeTab === 'scripts' && (
          <div className="max-w-7xl mx-auto flex gap-6">
            
            <div className="w-[600px] flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-white font-bold text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-[#25D366]" /> Repositório de Textos</h2>
              </div>
              
              <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-4">Salvar Novo Texto para Uso Rápido</h3>
                
                <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1.5">Nome de Identificação</label>
                <input type="text" placeholder="Ex: Quebra de Gelo 01" value={newScript.name} onChange={e => setNewScript({...newScript, name: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#25D366] mb-5" />

                <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1.5">Estrutura (Pode usar as variáveis {'{{nome}}, {{cidade}}...'})</label>
                <textarea 
                  value={newScript.message}
                  onChange={e => setNewScript({...newScript, message: e.target.value})}
                  placeholder="Digite aqui sua cópia persuasiva..."
                  className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#25D366] min-h-[150px] resize-none mb-5"
                ></textarea>

                <button onClick={saveScript} className="w-full bg-dark-700 hover:bg-dark-600 border border-dark-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                  Salvar no Repositório Local
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <h3 className="text-xs font-bold text-gray-400 mb-3 mt-4">Cópias Salvas ({scripts.length})</h3>
              
              {scripts.length === 0 ? (
                <div className="bg-[#1c1c1c] border border-white/5 rounded-xl flex flex-col items-center justify-center p-12">
                  <FileText className="w-8 h-8 text-gray-700 mb-3" />
                  <h4 className="text-sm font-bold text-gray-500">Seu repositório está vazio</h4>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {scripts.map(script => (
                    <div key={script.id} className="bg-[#1c1c1c] border border-white/5 rounded-xl p-5 relative group">
                      <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        {script.name}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-4 mt-2">{script.message}</p>
                      <button 
                        onClick={() => {
                          const updated = scripts.filter(s => s.id !== script.id);
                          setScripts(updated);
                          localStorage.setItem('scrapper_scripts', JSON.stringify(updated));
                        }}
                        className="absolute top-4 right-4 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* MODAL CUSTOMIZADO (SUBSTITUTO DO ALERT) */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-black">
            <div className="flex items-center gap-3 mb-4">
              {dialog.type === 'success' && <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-500"/></div>}
              {dialog.type === 'error' && <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500"/></div>}
              {dialog.type === 'info' && <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-blue-500"/></div>}
              <h3 className="text-lg font-bold text-white">{dialog.title}</h3>
            </div>
            <div className="text-sm text-gray-400 mb-6 whitespace-pre-wrap">{dialog.message}</div>
            <div className="flex justify-end">
              <button 
                onClick={() => setDialog(null)}
                className="bg-dark-700 hover:bg-dark-600 border border-dark-500 text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default function AppSZapWrapper() {
  return <SZap />;
}
