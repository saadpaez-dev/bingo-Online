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

// Validar cartón de 75 bolas
export const validateBingo75 = (card, calledNumbers) => {
  const calledSet = new Set(calledNumbers);
  calledSet.add('FREE');

  // Para 75 bolas, asumimos cartón lleno para ganar por defecto
  let allMarked = true;
  Object.values(card).forEach(col => {
    col.forEach(num => {
      if (!calledSet.has(num)) {
        allMarked = false;
      }
    });
  });

  return allMarked;
};

// Validar cartón de 90 bolas (array plano de 15 números sin nulls)
export const validateBingo90 = (flatGrid, calledNumbers) => {
  const calledSet = new Set(calledNumbers);
  return flatGrid.every(num => calledSet.has(num));
};
