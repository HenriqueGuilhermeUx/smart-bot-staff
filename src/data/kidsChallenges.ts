export type KidsAgeGroup = '3-5' | '6-8' | '9-11' | '12-13'
export type KidsChallengeCategory = 'LOGIC' | 'MATH' | 'LANGUAGE' | 'SCIENCE_NATURE' | 'VISUAL_ATTRIBUTES'
export type KidsQuestionType = 'multiple_choice' | 'true_false' | 'visual_target' | 'riddle'

export type KidsChallengeCard = {
  card_id: string
  category: KidsChallengeCategory
  question_type: KidsQuestionType
  question: string
  options: string[]
  correct_answer: string
  explanation: string
  asset_url: string | null
  audio_narrative: boolean
}

export type KidsChallengeDeck = {
  deck_id: string
  age_group: KidsAgeGroup
  theme: string
  cards: KidsChallengeCard[]
}

export const KIDS_CATEGORY_LABELS: Record<KidsChallengeCategory, string> = {
  LOGIC: 'Lógica',
  MATH: 'Matemática',
  LANGUAGE: 'Português',
  SCIENCE_NATURE: 'Ciências',
  VISUAL_ATTRIBUTES: 'Percepção',
}

export const KIDS_CHALLENGE_DECKS: KidsChallengeDeck[] = [
  {
    deck_id: 'kids_35_primeiras_descobertas',
    age_group: '3-5',
    theme: 'Desafios Kids — Primeiras Descobertas',
    cards: [
      { card_id: '35_001', category: 'VISUAL_ATTRIBUTES', question_type: 'multiple_choice', question: 'Qual destes objetos NÃO pertence à cozinha?', options: ['Panela', 'Colher', 'Escova de dentes', 'Prato'], correct_answer: 'Escova de dentes', explanation: 'A escova de dentes fica no banheiro!', asset_url: null, audio_narrative: true },
      { card_id: '35_002', category: 'LOGIC', question_type: 'multiple_choice', question: 'O sorvete é bem gelado. O que é bem quente?', options: ['Gelo', 'Fogo', 'Suco', 'Neve'], correct_answer: 'Fogo', explanation: 'O fogo queima e é o oposto do gelado!', asset_url: null, audio_narrative: true },
      { card_id: '35_003', category: 'SCIENCE_NATURE', question_type: 'multiple_choice', question: "Quem faz 'Muuu' e nos dá o leite?", options: ['Gato', 'Vaca', 'Patinho', 'Cachorro'], correct_answer: 'Vaca', explanation: 'A vaca mora na fazenda e produz o leite.', asset_url: null, audio_narrative: true },
      { card_id: '35_004', category: 'MATH', question_type: 'multiple_choice', question: 'Se você tem 2 maçãs e ganha mais 1, com quantas fica?', options: ['2', '3', '4', '1'], correct_answer: '3', explanation: '2 mais 1 é igual a 3!', asset_url: null, audio_narrative: true },
      { card_id: '35_005', category: 'LANGUAGE', question_type: 'multiple_choice', question: 'Qual animal tem o nome que começa com a letra A?', options: ['Bola', 'Abelha', 'Cachorro', 'Gato'], correct_answer: 'Abelha', explanation: 'Abelha começa com a vogal A!', asset_url: null, audio_narrative: true },
      { card_id: '35_006', category: 'VISUAL_ATTRIBUTES', question_type: 'multiple_choice', question: 'Qual destas formas geométricas se parece com uma bola de futebol?', options: ['Quadrado', 'Círculo', 'Triângulo', 'Retângulo'], correct_answer: 'Círculo', explanation: 'O círculo é redondo como a bola!', asset_url: null, audio_narrative: true },
      { card_id: '35_007', category: 'LOGIC', question_type: 'multiple_choice', question: 'A tartaruga anda bem devagar. Quem corre muito rápido?', options: ['Caracol', 'Coelho', 'Pedra', 'Minhoca'], correct_answer: 'Coelho', explanation: 'O coelho dá saltos e corre veloz!', asset_url: null, audio_narrative: true },
      { card_id: '35_008', category: 'SCIENCE_NATURE', question_type: 'multiple_choice', question: 'Onde o peixinho vive?', options: ['Na árvore', 'Na água', 'No céu', 'Na terra'], correct_answer: 'Na água', explanation: 'Os peixes precisam da água para respirar e nadar.', asset_url: null, audio_narrative: true },
    ],
  },
  {
    deck_id: 'kids_68_exploradores',
    age_group: '6-8',
    theme: 'Desafios Kids — Exploradores',
    cards: [
      { card_id: '68_001', category: 'LOGIC', question_type: 'riddle', question: 'O que é, o que é: cai em pé e corre deitado?', options: ['O rio', 'A chuva', 'O vento', 'O sabão'], correct_answer: 'A chuva', explanation: 'As gotas caem do céu e a água corre pelo chão!', asset_url: null, audio_narrative: false },
      { card_id: '68_002', category: 'LANGUAGE', question_type: 'multiple_choice', question: "Qual é o plural correto da palavra 'PAPEL'?", options: ['Papels', 'Papéises', 'Papéis', 'Papelões'], correct_answer: 'Papéis', explanation: "O plural de papel é papéis.", asset_url: null, audio_narrative: false },
      { card_id: '68_003', category: 'MATH', question_type: 'multiple_choice', question: 'Um pacote tem 12 biscoitos. Você comeu a metade. Quantos sobraram?', options: ['4', '5', '6', '8'], correct_answer: '6', explanation: 'A metade de 12 é 6 (12 dividido por 2).', asset_url: null, audio_narrative: false },
      { card_id: '68_004', category: 'SCIENCE_NATURE', question_type: 'multiple_choice', question: 'O Sol é considerado o quê no espaço?', options: ['Um planeta', 'Uma estrela', 'Um satélite', 'Um cometa'], correct_answer: 'Uma estrela', explanation: 'O Sol é uma estrela que ilumina e aquece a Terra!', asset_url: null, audio_narrative: false },
      { card_id: '68_005', category: 'LOGIC', question_type: 'riddle', question: 'Se ontem foi terça-feira, que dia será amanhã?', options: ['Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'], correct_answer: 'Quinta-feira', explanation: 'Se ontem foi terça, hoje é quarta. Portanto, amanhã será quinta!', asset_url: null, audio_narrative: false },
      { card_id: '68_006', category: 'LANGUAGE', question_type: 'multiple_choice', question: "Quantas sílabas tem a palavra 'BORBOLETA'?", options: ['3', '4', '5', '2'], correct_answer: '4', explanation: 'Separando: bor-bo-le-ta. São 4 sílabas.', asset_url: null, audio_narrative: false },
      { card_id: '68_007', category: 'SCIENCE_NATURE', question_type: 'multiple_choice', question: 'Qual destes animais transforma-se após sair do casulo?', options: ['Sapo', 'Borboleta', 'Abelha', 'Passarinho'], correct_answer: 'Borboleta', explanation: 'A lagarta passa pela metamorfose no casulo e vira borboleta.', asset_url: null, audio_narrative: false },
    ],
  },
  {
    deck_id: 'kids_911_cultura_desafios',
    age_group: '9-11',
    theme: 'Desafios Kids — Cultura & Raciocínio',
    cards: [
      { card_id: '911_001', category: 'SCIENCE_NATURE', question_type: 'true_false', question: 'Verdadeiro ou Falso: os tubarões não possuem ossos no corpo, apenas cartilagem.', options: ['Verdadeiro', 'Falso'], correct_answer: 'Verdadeiro', explanation: 'O esqueleto dos tubarões é formado por cartilagem.', asset_url: null, audio_narrative: false },
      { card_id: '911_002', category: 'LOGIC', question_type: 'riddle', question: 'O pai de Pedro tem 3 filhos: Um, Dois e... qual é o nome do terceiro?', options: ['Três', 'Pedro', 'João', 'Quatro'], correct_answer: 'Pedro', explanation: "O enunciado começa com 'O pai de Pedro'. Pedro é um dos filhos.", asset_url: null, audio_narrative: false },
      { card_id: '911_003', category: 'MATH', question_type: 'multiple_choice', question: 'Qual é o resultado da expressão: 3 + 5 x 2?', options: ['16', '13', '10', '15'], correct_answer: '13', explanation: 'Resolva a multiplicação primeiro: 5 x 2 = 10; depois some 3.', asset_url: null, audio_narrative: false },
      { card_id: '911_004', category: 'LANGUAGE', question_type: 'multiple_choice', question: "A palavra 'RÁPIDO' é classificada como:", options: ['Oxítona', 'Paroxítona', 'Proparoxítona', 'Monossílaba'], correct_answer: 'Proparoxítona', explanation: 'A sílaba tônica está na antepenúltima sílaba: RÁ-pi-do.', asset_url: null, audio_narrative: false },
      { card_id: '911_005', category: 'SCIENCE_NATURE', question_type: 'multiple_choice', question: 'Qual destes materiais pode ser encontrado na natureza nos estados sólido, líquido e gasoso?', options: ['Ferro', 'Oxigênio', 'Água', 'Mercúrio'], correct_answer: 'Água', explanation: 'A água aparece como gelo, água líquida e vapor.', asset_url: null, audio_narrative: false },
    ],
  },
  {
    deck_id: 'kids_1213_genios',
    age_group: '12-13',
    theme: 'Desafios Kids — Gênios',
    cards: [
      { card_id: '1213_001', category: 'MATH', question_type: 'multiple_choice', question: "Qual é o valor de 'x' na equação: 2x + 4 = 10?", options: ['x = 2', 'x = 3', 'x = 4', 'x = 5'], correct_answer: 'x = 3', explanation: 'Subtraindo 4 dos dois lados: 2x = 6. Dividindo por 2: x = 3.', asset_url: null, audio_narrative: false },
      { card_id: '1213_002', category: 'LOGIC', question_type: 'riddle', question: 'Se 5 máquinas levam 5 minutos para fazer 5 artigos, quanto tempo 100 máquinas levariam para fazer 100 artigos?', options: ['100 minutos', '20 minutos', '5 minutos', '1 minuto'], correct_answer: '5 minutos', explanation: 'Cada máquina leva 5 minutos para fabricar um artigo. 100 máquinas fazem 100 artigos em 5 minutos.', asset_url: null, audio_narrative: false },
      { card_id: '1213_003', category: 'SCIENCE_NATURE', question_type: 'multiple_choice', question: 'Qual organela celular é responsável pela produção de energia na respiração celular?', options: ['Complexo de Golgi', 'Mitocôndria', 'Ribossomo', 'Lisossomo'], correct_answer: 'Mitocôndria', explanation: 'A mitocôndria participa da produção de ATP, usado como energia pela célula.', asset_url: null, audio_narrative: false },
      { card_id: '1213_004', category: 'SCIENCE_NATURE', question_type: 'multiple_choice', question: 'Qual cientista formulou as Três Leis do Movimento e a Lei da Gravitação Universal?', options: ['Albert Einstein', 'Isaac Newton', 'Galileu Galilei', 'Nikola Tesla'], correct_answer: 'Isaac Newton', explanation: 'Isaac Newton publicou essas leis no século XVII.', asset_url: null, audio_narrative: false },
    ],
  },
]

export function deckForAge(ageGroup: KidsAgeGroup) {
  return KIDS_CHALLENGE_DECKS.find((deck) => deck.age_group === ageGroup) || KIDS_CHALLENGE_DECKS[1]
}

export function buildAlternatingChallengeCards(deck: KidsChallengeDeck) {
  const categories: KidsChallengeCategory[] = ['LOGIC', 'MATH', 'LANGUAGE', 'SCIENCE_NATURE', 'VISUAL_ATTRIBUTES']
  const buckets = new Map(categories.map((category) => [category, deck.cards.filter((card) => card.category === category)]))
  const result: KidsChallengeCard[] = []
  let cursor = 0
  while (result.length < deck.cards.length) {
    const category = categories[cursor % categories.length]
    const bucket = buckets.get(category) || []
    if (bucket.length) result.push(bucket.shift() as KidsChallengeCard)
    cursor += 1
    if (cursor > deck.cards.length * categories.length * 2) break
  }
  return result
}
