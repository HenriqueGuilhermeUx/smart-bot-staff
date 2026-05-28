// Constants file - all content for Smart Bot Staff
// PWA is enabled via vite.config.ts with vite-plugin-pwa

// Free plan - no pricing
export const STAFF_PRICE = 0
export const STAFF_PRICE_FORMATTED = 'GRÁTIS'

// Feature categories
export const FEATURES = [
  {
    id: 'finances',
    icon: '💰',
    title: 'Gestão Financeira',
    color: 'purple',
    items: [
      'OCR de boletos (lê código de barras)',
      'Lembretes proativos de contas',
      'Registro automático de gastos',
      'Controle de despesas mensais',
      'Organização de comprovantes',
      'Relatórios por categoria'
    ]
  },
  {
    id: 'vehicles',
    icon: '🚗',
    title: 'Veículos & Documentação',
    color: 'blue',
    items: [
      'Registro de placas de carros',
      'Lembretes de IPVA e seguro',
      'Controle de multas e pontos',
      'Histórico de manutenções',
      'Alerta de troca de óleo',
      'Controle de documentos'
    ]
  },
  {
    id: 'home',
    icon: '🏠',
    title: 'Casa & Família',
    color: 'green',
    items: [
      'Lista de compras inteligente',
      'Cardápios personalizados',
      'Lembretes de manutenção',
      'Controle de contas',
      'Agenda de tarefas domésticas',
      'Controle de garantias'
    ]
  },
  {
    id: 'kids',
    icon: '👨‍👩‍👧',
    title: 'Filhos & Educação',
    color: 'yellow',
    items: [
      'Agenda escolar completa',
      'Lembretes de materiais',
      'Resumo de comunicados',
      'Controle de notas',
      'Atividades extracurriculares',
      'Controle de mensalidades'
    ]
  },
  {
    id: 'health',
    icon: '💊',
    title: 'Saúde & Bem-estar',
    color: 'red',
    items: [
      'Agenda de consultas',
      'Lembretes de medicamentos',
      'Controle de exames',
      'Histórico de vacinas',
      'Alerta de check-ups',
      'Registro de condições'
    ]
  },
  {
    id: 'work',
    icon: '💼',
    title: 'Profissional & Produtividade',
    color: 'indigo',
    items: [
      'Resumo da agenda diária',
      'Triagem de prioridades',
      'Transcrição de ideias',
      'Lembretes de reuniões',
      'Organização de tarefas',
      'Integração com Google'
    ]
  },
  {
    id: 'events',
    icon: '🎁',
    title: 'Eventos & Datas',
    color: 'pink',
    items: [
      'Aniversários automáticos',
      'Datas comemorativas',
      'Sugestões de presentes',
      'Planejamento de eventos',
      'Lembretes de reservas',
      'Controle de convidados'
    ]
  },
  {
    id: 'investments',
    icon: '📈',
    title: 'Investimentos',
    color: 'emerald',
    items: [
      'Alertas de Bitcoin e dólar',
      'Notícias do mercado',
      'Lembretes de aportes',
      'Controle de carteira',
      'Alertas de metas',
      'Resumo semanal'
    ]
  },
  {
    id: 'security',
    icon: '🔒',
    title: 'Segurança & Privacidade',
    color: 'slate',
    items: [
      'Controle de senhas',
      'Lembretes de assinaturas',
      'Backup automático',
      'Modo Privacidade Total',
      'Criptografia de ponta',
      'Você é dono dos dados'
    ]
  }
]

// How it works steps
export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: 'Cadastro Rápido',
    description: 'Nome e e-mail. Leva 30 segundos.',
    icon: '📝'
  },
  {
    step: 2,
    title: 'Ative o Chat',
    description: 'Comece a conversar com seu Staff.',
    icon: '💬'
  },
  {
    step: 3,
    title: 'Organize sua Vida',
    description: 'O Staff te ajuda com tudo.',
    icon: '✨'
  },
  {
    step: 4,
    title: '100% Gratuito',
    description: 'Sem limites, sem cobranças.',
    icon: '🎉'
  }
]

// Example conversations
export const EXAMPLE_CONVERSATIONS = [
  {
    user: 'Me lembra de pagar a conta de luz amanhã',
    staff: '✅ Anotado! Vou te lembrar amanhã às 9h.'
  },
  {
    user: 'Quando é a prova de matemática do João?',
    staff: '📚 A prova de matemática do João é na próxima sexta.'
  },
  {
    user: 'Me avisa quando o Bitcoin chegar em R$ 500 mil',
    staff: '🚀 Alerta criado! Vou te avisar quando atingir.'
  },
  {
    user: 'Preciso comprar itens para o mercado',
    staff: '🛒 Vou criar uma lista! O que você precisa?'
  }
]

// Benefits
export const BENEFITS = [
  {
    icon: '🧠',
    title: 'IA de Verdade',
    description: 'Não é um chatbot burro. O Staff entende contexto, aprende com você e age proativamente.'
  },
  {
    icon: '🇧🇷',
    title: 'Feito para o Brasil',
    description: 'Entende boletos, IPVA, escola brasileira, mercado financeiro local. Não é tradução de gringo.'
  },
  {
    icon: '🔒',
    title: 'Seus Dados São Seus',
    description: 'Modo "Privacidade Total". Seus dados nunca são compartilhados ou vendidos.'
  }
]

// FAQ
export const FAQ = [
  {
    question: 'O Staff é realmente gratuito?',
    answer: 'Sim! O Staff é 100% gratuito, sem limites de mensagens ou funcionalidades.'
  },
  {
    question: 'Como funciona o Staff?',
    answer: 'O Staff é um assistente pessoal de IA que funciona via chat. Você conversa naturalmente com ele e ele te ajuda a organizar sua vida: finanças, família, saúde, trabalho, etc.'
  },
  {
    question: 'Preciso instalar algum aplicativo?',
    answer: 'Não! O Staff funciona diretamente no navegador como um app PWA. Você pode instalar no celular e usar como um aplicativo normal.'
  },
  {
    question: 'Meus dados estão seguros?',
    answer: 'Sim! Utilizamos criptografia de ponta a ponta e nunca compartilhamos seus dados com terceiros. Você é o dono das suas informações.'
  },
  {
    question: 'Posso acessar de qualquer dispositivo?',
    answer: 'Sim! O Staff funciona em qualquer navegador, no celular ou no computador. E como PWA, você pode instalar no seu celular para acesso offline.'
  }
]

// Reminder categories
export const REMINDER_CATEGORIES = [
  { id: 'financas', name: '💰 Finanças', color: 'green' },
  { id: 'veiculos', name: '🚗 Veículos', color: 'blue' },
  { id: 'casa', name: '🏠 Casa', color: 'yellow' },
  { id: 'filhos', name: '👨‍👩‍👧 Filhos', color: 'purple' },
  { id: 'saude', name: '❤️ Saúde', color: 'red' },
  { id: 'trabalho', name: '💼 Trabalho', color: 'cyan' },
  { id: 'eventos', name: '🎉 Eventos', color: 'pink' },
  { id: 'investimentos', name: '📈 Investimentos', color: 'emerald' },
  { id: 'seguranca', name: '🔒 Segurança', color: 'indigo' },
]

// Trust badges
export const TRUST_BADGES = [
  '🔒 Dados 100% seguros',
  '⚡ Ative em 5 minutos',
  '📱 Funciona como App',
  '💯 100% Gratuito',
  '🔔 Lembretes Automáticos'
]