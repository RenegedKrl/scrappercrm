const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const delay = (min, max) => new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1) + min) * 1000));

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

app.post('/api/scrape/receita', async (req, res) => {
  const { categories, city, maxResults = 20 } = req.body;
  console.log(`\n======================================`);
  console.log(`[Receita Scraper] Buscando categorias em ${city} (Max: ${maxResults})`);
  
  // Streaming response for real-time progress
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Transfer-Encoding': 'chunked'
  });

  const sendProgress = (msg) => {
    res.write(JSON.stringify({ type: 'progress', message: msg }) + '\n');
  };

  try {
    sendProgress('Inicializando motor anti-ban (Stealth)... aguardando 5s');
    await delay(5, 5);
    
    const browser = await puppeteer.launch({ 
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-position=-2000,-2000'] 
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    const leads = [];
    const seenCnpjs = new Set();
    
    // Suporta o novo formato de array ou o formato antigo (string única)
    const catsToSearch = Array.isArray(categories) ? categories : (categories ? [categories] : req.body.category ? [req.body.category] : []);
    
    for (const currentCat of catsToSearch) {
      if (leads.length >= maxResults) break;
      
      const searchTerm = `${currentCat} ${city}`;
      const searchUrl = `https://cnpj.biz/procura/${encodeURIComponent(searchTerm)}`;
      
      sendProgress(`Acessando servidor público de CNPJs para: ${currentCat}...`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      
      let hasNextPage = true;
      let pageCount = 0;
      const maxPages = 5; // Limite de 5 paginas por categoria para evitar demora
      
      while (leads.length < maxResults && hasNextPage && pageCount < maxPages) {
         pageCount++;
         sendProgress(`Categoria ${currentCat} | Página ${pageCount}... Delay humano de 10-15s.`);
         await delay(10, 15);
         
         const urls = await page.evaluate(() => {
           const links = Array.from(document.querySelectorAll('a'));
           return links.map(a => a.href).filter(href => href && href.includes('cnpj.biz'));
         });
         
         const cnpjs = [];
         for (const url of urls) {
           const match = url.match(/\/\d{14}$/); // Ex: /12345678000199
           if (match) cnpjs.push(match[0].replace('/', ''));
         }
         
         sendProgress(`Foram encontrados ${cnpjs.length} CNPJs. Validando na base oficial...`);
         
         for (const cnpj of cnpjs) {
           if (leads.length >= maxResults) break;
           if (seenCnpjs.has(cnpj)) continue;
           seenCnpjs.add(cnpj);
           
           try {
              await delay(1, 2); // Delay curto na BrasilAPI
              const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { validateStatus: false });
              
              if (response.status === 200) {
                  const data = response.data;
                  if (data.ddd_telefone_1 || data.ddd_telefone_2) {
                     const rawPhone = data.ddd_telefone_1 || data.ddd_telefone_2;
                     let phone = rawPhone.replace(/\D/g, '');
                     
                     leads.push({
                       id: Date.now().toString() + Math.random().toString(36).substring(7),
                       name: data.nome_fantasia || data.razao_social,
                       type: currentCat,
                       phone: phone,
                       cnpj: cnpj,
                       address: `${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio} - ${data.uf}`,
                       score: 98,
                       source: 'Receita Federal',
                       website: '',
                       instagram: ''
                     });
                     sendProgress(`+ CNPJ Ativo Coletado: ${data.nome_fantasia || data.razao_social}`);
                  }
              }
           } catch(e) {}
         }
         
         if (leads.length >= maxResults) break;
         
         const nextUrl = await page.evaluate(() => {
           const links = Array.from(document.querySelectorAll('a'));
           const next = links.find(a => a.href.includes('?id='));
           return next ? next.href : null;
         });
  
         if (nextUrl) {
           sendProgress(`Avançando para a próxima página de ${currentCat}...`);
           await page.goto(nextUrl, { waitUntil: 'domcontentloaded' });
         } else {
           hasNextPage = false;
         }
      }
    }
    
    await browser.close();
    sendProgress(`Busca Finalizada! ${leads.length} leads qualificados obtidos.`);
    res.write(JSON.stringify({ type: 'done', success: true, leads }) + '\n');
    res.end();
  } catch (error) {
    console.error('[Receita Scraper] Erro:', error);
    res.write(JSON.stringify({ type: 'done', success: false, error: error.message }) + '\n');
    res.end();
  }
});

// ==========================================
// ENDPOINT DE ENRIQUECIMENTO (INSTAGRAM & SITE)
// ==========================================
app.post('/api/enrich', async (req, res) => {
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });

  try {
    const browser = await puppeteer.launch({ 
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-position=-2000,-2000'] 
    });
    const page = await browser.newPage();
    
    // Simplificando o address para pegar só a cidade
    const city = address ? address.split(',')[0] : '';
    const query = `${name} ${city} instagram`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.result__url')).map(a => a.href);
    });
    
    await browser.close();

    // Decodificar links do DuckDuckGo
    const decodedLinks = links.map(href => {
      try {
         const urlObj = new URL(href);
         const uddg = urlObj.searchParams.get('uddg');
         return uddg ? decodeURIComponent(uddg) : href;
      } catch (e) { return href; }
    });

    const igLink = decodedLinks.find(href => href && href.includes('instagram.com') && !href.includes('/p/') && !href.includes('/reel/'));
    const siteLink = decodedLinks.find(href => href && 
      !href.includes('instagram.com') && 
      !href.includes('facebook.com') && 
      !href.includes('linkedin.com') &&
      !href.includes('youtube.com') &&
      !href.includes('duckduckgo.com') &&
      !href.includes('casadosdados.com.br') &&
      !href.includes('cnpj.biz')
    );

    res.json({ success: true, instagram: igLink || '', website: siteLink || '' });
  } catch (error) {
    console.error('[Enrich Scraper] Erro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scrape/map', async (req, res) => {
  const { categories, lat, lng, radius = 5000, maxResults = 100 } = req.body;
  
  console.log(`\n======================================`);
  console.log(`Recebendo busca: ${Array.isArray(categories) ? categories.length : 1} categorias selecionadas`);
  console.log(`Coordenadas: lat:${lat}, lng:${lng} | Raio: ${radius}m`);

  // Dicionário expandido para o Overpass reconhecer TODAS as categorias do seu frontend
  const categoryMap = {
    'Dentista': 'healthcare=dentist',
    'Clínica odontológica': 'healthcare=dentist',
    'Ortodontista': 'healthcare=dentist',
    'Clínica médica': 'healthcare=clinic',
    'Clínica de estética': 'healthcare=clinic',
    'Cirurgião plástico': 'healthcare=doctor',
    'Dermatologista': 'healthcare=doctor',
    'Cardiologista': 'healthcare=doctor',
    'Ortopedista': 'healthcare=doctor',
    'Ginecologista': 'healthcare=doctor',
    'Pediatra': 'healthcare=doctor',
    'Psicólogo': 'healthcare=psychotherapist',
    'Psiquiatra': 'healthcare=psychotherapist',
    'Nutricionista': 'healthcare=nutrition_counselling',
    'Fisioterapeuta': 'healthcare=physiotherapist',
    'Academia': 'leisure=fitness_centre',
    'Pilates': 'leisure=fitness_centre',
    'Studio de yoga': 'leisure=fitness_centre',
    'Crossfit': 'leisure=fitness_centre',
    'Personal trainer': 'leisure=fitness_centre',
    'Spa': 'leisure=fitness_centre',
    'Clínica de depilação': 'shop=beauty',
    'Consultório': 'healthcare=doctor',
    'Podologia': 'healthcare=podiatrist',
    'Estúdio de tatuagem': 'shop=tattoo',
    'Clínica de micropigmentação': 'shop=beauty',
    'Laboratório de análises': 'healthcare=laboratory',
    'Farmácia': 'amenity=pharmacy',
    
    'Pet shop': 'shop=pet',
    'Veterinário': 'amenity=veterinary',
    'Clínica veterinária': 'amenity=veterinary',
    'Pet grooming': 'shop=pet',
    'Hotel para pets': 'amenity=animal_boarding',
    'Adestramento': 'amenity=animal_training',
    
    'Salão de beleza': 'shop=beauty',
    'Barbearia': 'shop=hairdresser',
    'Cabeleireiro': 'shop=hairdresser',
    'Instituto de beleza': 'shop=beauty',
    'Manicure': 'shop=beauty',
    'Design de sobrancelhas': 'shop=beauty',
    'Limpeza de pele': 'shop=beauty',
    'Lash designer': 'shop=beauty',
    
    'Oficina mecânica': 'shop=car_repair',
    'Lava a jato': 'amenity=car_wash',
    'Borracharia': 'shop=tyres',
    'Auto elétrica': 'shop=car_repair',
    'Funilaria e pintura': 'shop=car_repair',
    'Concessionária': 'shop=car',
    'Revenda de veículos': 'shop=car',
    'Som automotivo': 'shop=car_parts',
    'Insulfilm': 'shop=car_parts',
    'Estacionamento': 'amenity=parking',
    'Locadora de veículos': 'amenity=car_rental',
    'Troca de óleo': 'shop=car_repair',
    
    'Restaurante': 'amenity=restaurant',
    'Pizzaria': 'amenity=restaurant',
    'Hamburgueria': 'amenity=fast_food',
    'Churrascaria': 'amenity=restaurant',
    'Comida japonesa': 'amenity=restaurant',
    'Sushi': 'amenity=restaurant',
    'Bar': 'amenity=bar',
    'Padaria': 'shop=bakery',
    'Cafeteria': 'amenity=cafe',
    'Sorveteria': 'amenity=ice_cream',
    'Confeitaria': 'shop=pastry',
    'Lanchonete': 'amenity=fast_food'
  };

  const requestedCategories = Array.isArray(categories) ? categories : [categories];
  
  // Mapeia e remove tags duplicadas para não fazer a mesma busca no mapa duas vezes
  const tags = [...new Set(requestedCategories.map(cat => categoryMap[cat] || 'amenity=hospital'))];

  // Constrói a busca para pegar nós (pontos) e vias (prédios)
  const queryStatements = tags.map(tag => `
      node[${tag}](around:${radius},${lat},${lng});
      way[${tag}](around:${radius},${lat},${lng});
  `).join('');

  const query = `
    [out:json][timeout:25];
    (
      ${queryStatements}
    );
    out body;
    >;
    out skel qt;
  `;

  let elements = [];
  let success = false;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Tentando conectar em: ${endpoint}...`);
      const response = await axios.post(endpoint, 'data=' + encodeURIComponent(query), {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'ScrapperCRM/1.0 (contato@scrappercrm.local)'
        },
        timeout: 15000 // Aumentado para 15s pois buscas múltiplas demoram mais
      });

      if (response.data && response.data.elements) {
        elements = response.data.elements;
        success = true;
        console.log(`Sucesso via ${endpoint} | Encontrados ${elements.length} resultados brutos.`);
        break;
      }
    } catch (error) {
      console.log(`Falha no ${endpoint}: ${error.message}`);
    }
  }

  if (!success) {
    return res.status(500).json({ success: false, error: 'O servidor de mapas demorou a responder ou rejeitou a busca.' });
  }

  const leads = elements
    .filter(e => e.tags && e.tags.name)
    .map(e => {
      // Descobre qual categoria pertence com base na tag
      let assignedCategory = requestedCategories[0]; // fallback
      
      return {
        id: e.id || Math.random().toString(),
        name: e.tags.name,
        type: assignedCategory, 
        phone: e.tags.phone || e.tags['contact:phone'] || null,
        website: e.tags.website || e.tags['contact:website'] || null,
        instagram: e.tags['contact:instagram'] || null,
        address: `${e.tags['addr:street'] || ''} ${e.tags['addr:housenumber'] || ''}`.trim() || 'Endereço não informado',
        city: e.tags['addr:city'] || '',
        status: 'Ativo',
        score: (e.tags.phone ? 30 : 0) + (e.tags.website ? 20 : 0) + (e.tags['contact:instagram'] ? 20 : 0)
      }
    })
    // -------------------------------------------------------------
    // REGRA DE OURO SOLICITADA PELO USUÁRIO:
    // O lead OBRIGATORIAMENTE precisa ter telefone OU site
    // -------------------------------------------------------------
    .filter(lead => lead.phone || lead.website)
    .slice(0, maxResults);

  console.log(`Extração finalizada: ${leads.length} leads aprovados no filtro de qualidade.`);
  res.json({ success: true, count: leads.length, leads });
});

// ==========================================
// MÓDULO S-ZAP (WhatsApp Automation Backend)
// ==========================================

let waClient = null;
let waStatus = 'disconnected'; // 'disconnected' | 'qr' | 'connected'
let waQrDataUrl = null;

app.get('/api/whatsapp/status', (req, res) => {
  res.json({ status: waStatus, qrCodeUrl: waQrDataUrl });
});

app.post('/api/whatsapp/connect', async (req, res) => {
  if (waStatus === 'connected') {
    return res.json({ success: true, message: 'Já está conectado' });
  }

  if (waClient) {
    return res.json({ success: true, message: 'Inicialização já em andamento' });
  }

  console.log('[S-Zap] Iniciando instância do WhatsApp Web...');
  waStatus = 'connecting';
  waQrDataUrl = null;
  
  waClient = new Client({
    authStrategy: new LocalAuth({ clientId: 's-zap-session' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
  });

  waClient.on('qr', async (qr) => {
    console.log('[S-Zap] QR Code recebido, aguardando scan...');
    waStatus = 'qr';
    try {
      waQrDataUrl = await qrcode.toDataURL(qr);
    } catch (err) {
      console.error('[S-Zap] Erro ao gerar QR Base64:', err);
    }
  });

  waClient.on('ready', () => {
    console.log('[S-Zap] WhatsApp Conectado com Sucesso!');
    waStatus = 'connected';
    waQrDataUrl = null;
  });

  waClient.on('authenticated', () => {
    console.log('[S-Zap] Autenticado!');
  });

  waClient.on('auth_failure', msg => {
    console.error('[S-Zap] Falha na Autenticação', msg);
    waStatus = 'disconnected';
    waQrDataUrl = null;
    waClient = null;
  });

  waClient.on('disconnected', (reason) => {
    console.log('[S-Zap] Cliente Desconectado', reason);
    waStatus = 'disconnected';
    waQrDataUrl = null;
    waClient = null;
  });

  waClient.initialize();
  res.json({ success: true, message: 'Iniciando client...' });
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  if (waClient) {
    console.log('[S-Zap] Desconectando e destruindo cliente...');
    try {
      await waClient.logout();
    } catch (e) {
      console.log('Erro ao fazer logout, forçando destroy', e.message);
    }
    
    try {
      await waClient.destroy();
    } catch (e) {
      console.log('Erro ao dar destroy', e.message);
    }
    
    waClient = null;
  }
  waStatus = 'disconnected';
  waQrDataUrl = null;
  res.json({ success: true, message: 'Desconectado' });
});

app.post('/api/whatsapp/send', async (req, res) => {
  const { phone, message, chatId } = req.body;
  
  if (waStatus !== 'connected' || !waClient) {
    return res.status(400).json({ success: false, error: 'WhatsApp não está conectado' });
  }

  if (!message || (!phone && !chatId)) {
    return res.status(400).json({ success: false, error: 'Destinatário e mensagem são obrigatórios' });
  }

  try {
    let finalChatId = chatId;

    if (!finalChatId && phone) {
      let number = phone.replace(/\D/g, '');
      if (number.length === 10 || number.length === 11) {
        number = `55${number}`;
      }
      
      console.log(`[S-Zap] Verificando existência de WhatsApp para: ${number}`);
      
      try {
        const registered = await waClient.getNumberId(number);
        
        if (!registered) {
          // Fallback 1: Retirar o 9º dígito (DD 9XXXX XXXX -> DD XXXX XXXX)
          if (number.length === 13 && number.startsWith('55')) {
            const altNumber = number.slice(0, 4) + number.slice(5);
            const altRegistered = await waClient.getNumberId(altNumber);
            if (altRegistered) {
              finalChatId = altRegistered._serialized;
            } else {
              throw new Error('Número fixo ou inválido. Sem WhatsApp.');
            }
          } else {
            throw new Error('Este número não possui WhatsApp registrado.');
          }
        } else {
          finalChatId = registered._serialized;
        }
      } catch (err) {
        // Fallback 2: Abordagem isRegisteredUser com @c.us
        try {
           const fallbackId = `${number}@c.us`;
           const isReg = await waClient.isRegisteredUser(fallbackId);
           if (isReg) {
              finalChatId = fallbackId;
           } else {
              throw new Error('Não possui WhatsApp.');
           }
        } catch(fallbackErr) {
           return res.status(400).json({ success: false, error: 'O telefone deste Lead não possui WhatsApp (Geralmente é Fixo).' });
        }
      }
    }

    if (!finalChatId) {
      return res.status(400).json({ success: false, error: 'Não foi possível validar o número no WhatsApp.' });
    }

    console.log(`[S-Zap] Disparando para ${finalChatId}...`);
    await waClient.sendMessage(finalChatId, message);
    
    res.json({ success: true, message: 'Mensagem enviada!' });
  } catch (error) {
    console.error(`[S-Zap] Erro ao enviar mensagem para ${phone || chatId}:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ENDPOINTS DE CONVERSAS (CHATS)
// ==========================================

app.get('/api/whatsapp/chats', async (req, res) => {
  if (waStatus !== 'connected' || !waClient) {
    return res.status(400).json({ success: false, error: 'WhatsApp não está conectado' });
  }
  try {
    const chats = await waClient.getChats();
    // Pega as 30 conversas mais recentes para o CRM
    const simplifiedChats = chats.slice(0, 30).map(c => ({
      id: c.id._serialized,
      name: c.name || (c.contact ? c.contact.pushname : c.id.user),
      unreadCount: c.unreadCount,
      timestamp: c.timestamp,
      lastMessage: c.lastMessage ? c.lastMessage.body : ''
    }));
    res.json({ success: true, chats: simplifiedChats });
  } catch (error) {
    console.error('[S-Zap] Erro ao buscar chats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/whatsapp/chats/:chatId/messages', async (req, res) => {
  if (waStatus !== 'connected' || !waClient) {
    return res.status(400).json({ success: false, error: 'WhatsApp não está conectado' });
  }
  try {
    const chat = await waClient.getChatById(req.params.chatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    const simplifiedMessages = messages.map(m => ({
      id: m.id._serialized,
      body: m.body,
      fromMe: m.fromMe,
      timestamp: m.timestamp,
      type: m.type
    }));
    res.json({ success: true, messages: simplifiedMessages });
  } catch (error) {
    console.error('[S-Zap] Erro ao buscar mensagens:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend Kaptar (Clone) rodando na porta ${PORT}`);
});
