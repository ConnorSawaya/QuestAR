const QUESTION_BANKS = {
  chemistry: [
    ['What does pH measure?', ['Acidity', 'Mass', 'Temperature'], 0],
    ['Which particle has a negative charge?', ['Proton', 'Electron', 'Neutron'], 1],
    ['What is H2O?', ['Water', 'Salt', 'Oxygen'], 0],
    ['A catalyst does what?', ['Speeds a reaction', 'Deletes atoms', 'Stops all heat'], 0],
    ['Which bond shares electrons?', ['Ionic', 'Covalent', 'Metallic only'], 1],
    ['What is the center of an atom called?', ['Nucleus', 'Shell', 'Ion'], 0],
  ],
  math: [
    ['What is 12 x 8?', ['96', '86', '108'], 0],
    ['What does slope measure?', ['Steepness', 'Area', 'Volume'], 0],
    ['What is the square root of 81?', ['7', '9', '11'], 1],
    ['A prime number has how many positive factors?', ['2', '3', '4'], 0],
    ['What is 3/4 as a decimal?', ['0.34', '0.75', '1.25'], 1],
    ['What shape has 8 sides?', ['Hexagon', 'Octagon', 'Decagon'], 1],
  ],
  geology: [
    ['What type of rock forms from cooled lava?', ['Igneous', 'Sedimentary', 'Metamorphic'], 0],
    ['What scale is commonly used to report earthquake magnitude?', ['Moment magnitude', 'Celsius', 'Beaufort'], 0],
    ['What is magma called after it reaches the surface?', ['Lava', 'Quartz', 'Clay'], 0],
    ['What process breaks rocks into smaller pieces?', ['Weathering', 'Orbiting', 'Condensing'], 0],
    ['Which mineral is common in granite?', ['Quartz', 'Ice', 'Coal'], 0],
    ['Sedimentary rocks often form in what?', ['Layers', 'Clouds', 'Stars'], 0],
  ],
  'computer-science': [
    ['What does CPU stand for?', ['Central Processing Unit', 'Code Power Utility', 'Computer Pixel Unit'], 0],
    ['Which value is boolean?', ['True', '42.5', 'Paragraph'], 0],
    ['What stores key-value pairs?', ['Map', 'Loop', 'Pixel'], 0],
    ['What does an algorithm describe?', ['Steps to solve a problem', 'A screen color', 'A network cable'], 0],
    ['Which structure is first-in, first-out?', ['Queue', 'Stack', 'Tree root'], 0],
    ['What does HTML structure?', ['Web content', 'Database indexes', 'Battery voltage'], 0],
  ],
  biology: [
    ['What do plants use for photosynthesis?', ['Sunlight', 'Plastic', 'Sound'], 0],
    ['DNA stores what?', ['Genetic instructions', 'Blood pressure', 'Heat only'], 0],
    ['What organ pumps blood?', ['Heart', 'Lung', 'Stomach'], 0],
    ['Cells are surrounded by what?', ['Membrane', 'Circuit', 'Crust'], 0],
    ['What gas do humans need for cellular respiration?', ['Oxygen', 'Helium', 'Methane'], 0],
    ['What is an ecosystem?', ['Living and nonliving interactions', 'One single bone', 'A math equation'], 0],
  ],
};

const CATEGORY_RULES = [
  ['chemistry', /chem|atom|molecule|reaction|flask|acid|base/],
  ['math', /math|algebra|geometry|calculus|number|equation|fraction/],
  ['geology', /geo|rock|earth|volcano|mineral|fossil|earthquake/],
  ['computer-science', /computer|code|program|software|algorithm|javascript|html|data/],
  ['biology', /bio|cell|plant|life|dna|ecosystem|human/],
];

const ORB_NAMES = {
  chemistry: ['Flask Orb', 'Atom Orb', 'Reaction Orb', 'Molecule Orb', 'pH Orb', 'Catalyst Orb'],
  math: ['Plus Orb', 'Graph Orb', 'Prime Orb', 'Fraction Orb', 'Geometry Orb', 'Algebra Orb'],
  geology: ['Granite Orb', 'Fossil Orb', 'Volcano Orb', 'Quartz Orb', 'Fault Orb', 'Layer Orb'],
  'computer-science': ['Code Orb', 'Laptop Orb', 'Binary Orb', 'Network Orb', 'Array Orb', 'Algorithm Orb'],
  biology: ['Cell Orb', 'DNA Orb', 'Leaf Orb', 'Heart Orb', 'Ecosystem Orb', 'Neuron Orb'],
  general: ['Focus Orb', 'Question Orb', 'Pattern Orb', 'Practice Orb', 'Review Orb', 'Insight Orb'],
};

const CATEGORY_STYLE = {
  chemistry: { accent: '#79f0c2', trait: 'Lab Signal' },
  math: { accent: '#8ad7ff', trait: 'Pattern Signal' },
  geology: { accent: '#d6a86f', trait: 'Earth Signal' },
  'computer-science': { accent: '#9fb7ff', trait: 'Code Signal' },
  biology: { accent: '#8ef7a2', trait: 'Life Signal' },
  general: { accent: '#c6a4ff', trait: 'Topic Signal' },
};

const GENERIC_QUESTIONS = [
  ['What is a useful first step when learning about {topic}?', ['Identify the key ideas', 'Ignore the evidence', 'Choose a random answer'], 0],
  ['How can you check a claim about {topic}?', ['Compare it with reliable evidence', 'Repeat it without checking', 'Avoid asking questions'], 0],
  ['What helps build understanding of {topic}?', ['Practice and feedback', 'Skipping every example', 'Memorizing unrelated words'], 0],
];

/** GitHub Pages can opt in with `--mode pages`; the host check also covers normal Pages builds. */
export function isPagesDemoMode(mode, hostname = '') {
  const host = String(hostname).toLowerCase().split(':')[0];
  return mode === 'pages' || host === 'github.io' || host.endsWith('.github.io');
}

/** Generate a predictable, API-free set of six playable orbs for the static demo. */
export function generateLocalTopic({ topic, difficulty = 'Easy', count = 6, wave = 0 } = {}) {
  const cleanTopic = String(topic || '').trim().slice(0, 80);
  if (!cleanTopic) throw new Error('Enter a topic to generate a local quest.');

  const category = CATEGORY_RULES.find(([, pattern]) => pattern.test(cleanTopic.toLowerCase()))?.[0] || 'general';
  const templates = QUESTION_BANKS[category] || GENERIC_QUESTIONS.map(([prompt, options, answer]) => [
    prompt.replaceAll('{topic}', cleanTopic), options, answer,
  ]);
  const style = CATEGORY_STYLE[category];
  const level = ['Easy', 'Medium', 'Hard', 'Expert'].includes(difficulty) ? difficulty : 'Easy';
  const orbCount = Math.max(1, Math.min(Number.isInteger(count) ? count : 6, 6));
  const questions = Array.from({ length: orbCount * 3 }, (_, index) => {
    const [prompt, options, answer] = templates[index % templates.length];
    const qualifier = level === 'Expert' ? ' Choose the most precise answer.' : level === 'Hard' ? ' Think carefully.' : '';
    return { prompt: `${prompt}${qualifier}`, options: [...options], answer };
  });
  const slug = cleanTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'topic';
  const orbs = Array.from({ length: orbCount }, (_, index) => ({
    id: `local-${slug}-wave-${Math.max(0, Number(wave) || 0)}-${index}`,
    title: ORB_NAMES[category][index] || `${cleanTopic} Orb ${index + 1}`,
    category,
    accent: style.accent,
    rarity: level === 'Expert' ? 'Master Signal' : level === 'Hard' ? 'Expert Signal' : level === 'Medium' ? 'Focused Signal' : 'Starter Signal',
    trait: style.trait,
    journalNote: `You practiced a ${cleanTopic} idea with ${ORB_NAMES[category][index] || `orb ${index + 1}`}.`,
    questions: questions.slice(index * 3, index * 3 + 3),
  }));

  return {
    topic: cleanTopic,
    difficulty: level,
    summary: category === 'general'
      ? `Local practice quest for ${cleanTopic}. Custom topics use general study questions in this offline demo.`
      : `Built-in ${category} question pack for ${cleanTopic}; no AI or server is required.`,
    orbs,
  };
}
