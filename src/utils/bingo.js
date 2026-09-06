// Genera números aleatorios únicos en un rango
function getRandomNumbers(min, max, count) {
  const nums = new Set();
  while (nums.size < count) {
    nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return Array.from(nums).sort((a, b) => a - b);
}

// Generar cartón de 75 bolas
export const generateCard75 = () => {
  const card = {
    B: getRandomNumbers(1, 15, 5),
    I: getRandomNumbers(16, 30, 5),
    N: getRandomNumbers(31, 45, 5),
    G: getRandomNumbers(46, 60, 5),
    O: getRandomNumbers(61, 75, 5),
  };
  // El centro es libre
  card.N[2] = 'FREE';
  return card;
};

// Generar cartón compacto de 90 bolas
// Retorna un array PLANO de 15 números únicos del 1-90, ordenados de menor a mayor
// Se mostrará como cuadrícula 5 columnas x 3 filas — sin espacios en blanco
export const generateCard90 = () => {
  // Dividimos el rango 1-90 en 5 grupos de 18 números
  // y sacamos 3 números de cada grupo para mantener distribución equilibrada
  const groups = [
    getRandomNumbers(1,  18, 3),
    getRandomNumbers(19, 36, 3),
    getRandomNumbers(37, 54, 3),
    getRandomNumbers(55, 72, 3),
    getRandomNumbers(73, 90, 3),
  ];

  // Construir cuadrícula 5x3: columna por columna, fila por fila
  // Cada columna tiene 3 números del mismo grupo (ya ordenados)
  // Resultado: array plano de 15 elementos leido fila a fila
  const grid = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      grid.push(groups[col][row]);
    }
  }

  return grid; // 15 elementos, sin nulls
};

// Patrones de Victoria centrados exclusivamente en las letras de la palabra B - I - N - G - O y Cartón Lleno
export const BINGO_PATTERNS = {
  full: {
    id: 'full',
    name: 'Cartón Lleno',
    shortName: 'Pleno',
    letter: '★',
    description: 'Completar todas las casillas del cartón',
    matrix: [
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1]
    ]
  },
  letter_b: {
    id: 'letter_b',
    name: 'Letra "B"',
    shortName: 'Letra B',
    letter: 'B',
    description: 'Completar la silueta de la letra B',
    matrix: [
      [1, 1, 1, 1, 0],
      [1, 0, 0, 1, 0],
      [1, 1, 1, 1, 0],
      [1, 0, 0, 1, 0],
      [1, 1, 1, 1, 0]
    ]
  },
  letter_i: {
    id: 'letter_i',
    name: 'Letra "I"',
    shortName: 'Letra I',
    letter: 'I',
    description: 'Completar la silueta de la letra I romana',
    matrix: [
      [1, 1, 1, 1, 1],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [1, 1, 1, 1, 1]
    ]
  },
  letter_n: {
    id: 'letter_n',
    name: 'Letra "N"',
    shortName: 'Letra N',
    letter: 'N',
    description: 'Completar la silueta de la letra N con diagonal',
    matrix: [
      [1, 0, 0, 0, 1],
      [1, 1, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 1, 1],
      [1, 0, 0, 0, 1]
    ]
  },
  letter_g: {
    id: 'letter_g',
    name: 'Letra "G"',
    shortName: 'Letra G',
    letter: 'G',
    description: 'Completar la silueta de la letra G',
    matrix: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0],
      [1, 0, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1]
    ]
  },
  letter_o: {
    id: 'letter_o',
    name: 'Letra "O"',
    shortName: 'Letra O',
    letter: 'O',
    description: 'Completar todo el marco exterior del cartón',
    matrix: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1]
    ]
  }
};

const COLS_75 = ['B', 'I', 'N', 'G', 'O'];

// Obtener patrón por ID (fallback a 'full')
export const getPattern = (patternId) => {
  return BINGO_PATTERNS[patternId] || BINGO_PATTERNS.full;
};

// Comprobar si una casilla (fila, columna) pertenece al patrón activo
export const isCellInPattern = (patternId, row, col) => {
  const p = getPattern(patternId);
  return !!(p.matrix && p.matrix[row] && p.matrix[row][col] === 1);
};

// Extraer lista de números requeridos para ganar con un cartón y patrón dados
export const getPatternRequiredNumbers = (card, patternId = 'full') => {
  if (!card) return [];
  const p = getPattern(patternId);
  const required = [];

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (p.matrix[r][c] === 1) {
        const colLetter = COLS_75[c];
        const val = card[colLetter]?.[r];
        if (val && val !== 'FREE') {
          required.push(val);
        }
      }
    }
  }
  return required;
};

// Validar cartón de 75 bolas según la dinámica/patrón activo
export const validateBingo75 = (card, calledNumbers, patternId = 'full') => {
  if (!card) return false;
  const calledSet = new Set(calledNumbers);
  calledSet.add('FREE');

  const requiredNumbers = getPatternRequiredNumbers(card, patternId);
  if (requiredNumbers.length === 0) return false;

  return requiredNumbers.every(num => calledSet.has(num));
};

// Validar cartón de 90 bolas (array plano de 15 números sin nulls)
export const validateBingo90 = (flatGrid, calledNumbers, patternId = 'full') => {
  if (!flatGrid || flatGrid.length < 15) return false;
  const calledSet = new Set(calledNumbers);

  // Si es una línea (cualquier fila de 5)
  if (patternId === 'one_line') {
    for (let row = 0; row < 3; row++) {
      const line = flatGrid.slice(row * 5, row * 5 + 5);
      if (line.every(n => calledSet.has(n))) return true;
    }
    return false;
  }

  // Si son dos líneas
  if (patternId === 'two_lines') {
    let completedLines = 0;
    for (let row = 0; row < 3; row++) {
      const line = flatGrid.slice(row * 5, row * 5 + 5);
      if (line.every(n => calledSet.has(n))) completedLines++;
    }
    return completedLines >= 2;
  }

  // Cartón lleno por defecto
  return flatGrid.every(num => calledSet.has(num));
};

// Calcular progreso exacto del cartón hacia el Bingo (porcentaje y bolas faltantes)
export const calculateCardProgress = (card, mode, calledNumbers = [], patternId = 'full') => {
  if (!card) return { matched: 0, total: mode === 75 ? 24 : 15, missing: mode === 75 ? 24 : 15, percentage: 0 };
  const calledSet = new Set(calledNumbers);

  if (mode === 75) {
    const required = getPatternRequiredNumbers(card, patternId);
    const total = required.length || 24;
    let matched = 0;

    required.forEach(num => {
      if (calledSet.has(num)) {
        matched++;
      }
    });

    const percentage = total > 0 ? Math.round((matched / total) * 100) : 0;
    return { matched, total, missing: Math.max(0, total - matched), percentage };
  } else {
    // 90 bolas: array plano de 15 números
    if (patternId === 'one_line') {
      // Mejor progreso de cualquiera de las 3 filas
      let maxMatched = 0;
      for (let row = 0; row < 3; row++) {
        const line = card.slice(row * 5, row * 5 + 5);
        const m = line.filter(n => calledSet.has(n)).length;
        if (m > maxMatched) maxMatched = m;
      }
      return { matched: maxMatched, total: 5, missing: Math.max(0, 5 - maxMatched), percentage: Math.round((maxMatched / 5) * 100) };
    }

    const total = 15;
    let matched = 0;
    if (Array.isArray(card)) {
      card.forEach(num => {
        if (calledSet.has(num)) matched++;
      });
    }
    const percentage = Math.round((matched / total) * 100);
    return { matched, total, missing: Math.max(0, total - matched), percentage };
  }
};

