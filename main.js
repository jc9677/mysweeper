// main.js

const CELL_REVEALED = 0b1;
const CELL_BOMB = 0b10;
const CELL_FLAGGED = 0b100;

let boardState;
let adjacentCounts;

// Check if there's a saved game state
const savedState = localStorage.getItem('minesweeperState');

const gameBoard = document.getElementById('game-board');
const startButton = document.getElementById('start');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('cols');
const bombsInput = document.getElementById('bombs');
const overlay = document.getElementById('overlay');
const overlayMessage = document.getElementById('message');
const closeOverlay = document.getElementById('closeOverlay');

// Add reset button functionality to clear local storage and reload the game
const resetButton = document.getElementById('reset');
resetButton.addEventListener('click', () => {
  localStorage.removeItem('minesweeperState');
  location.reload();
});

let rows, cols, bombs;
let gameActive = false; // Track game state

function createBoard(r, c, b) {
  rows = r;
  cols = c;
  bombs = b;
  gameActive = true; // start game
  document.getElementById('status').textContent = ""; // clear status

  // Use Uint8Array for efficient storage
  boardState = new Uint8Array(r * c);
  adjacentCounts = new Uint8Array(r * c);

  // Place bombs
  let bombsPlaced = 0;
  while (bombsPlaced < b) {
    const idx = Math.floor(Math.random() * (r * c));
    if (!(boardState[idx] & CELL_BOMB)) {
      boardState[idx] |= CELL_BOMB;
      bombsPlaced++;
    }
  }

  // Calculate adjacent bombs
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (boardState[i * c + j] & CELL_BOMB) continue;
      let count = 0;
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          if (x === 0 && y === 0) continue;
          const newRow = i + x;
          const newCol = j + y;
          if (newRow >= 0 && newRow < r && newCol >= 0 && newCol < c) {
            if (boardState[newRow * c + newCol] & CELL_BOMB) count++;
          }
        }
      }
      adjacentCounts[i * c + j] = count;
    }
  }

  setupBoard();
  renderBoard();
  saveGameState();
}

function setupBoard() {
  gameBoard.innerHTML = '';
  gameBoard.style.gridTemplateColumns = `repeat(${cols}, 30px)`;

  // Create cells once
  for (let i = 0; i < rows * cols; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.dataset.index = i;
    gameBoard.appendChild(cell);
  }

  // Use event delegation
  gameBoard.addEventListener('click', handleCellClick);
  gameBoard.addEventListener('contextmenu', handleCellRightClick);
  gameBoard.addEventListener('touchstart', handleTouchStart);
  gameBoard.addEventListener('touchend', handleTouchEnd);
  gameBoard.addEventListener('touchmove', handleTouchMove);
}

function handleCellClick(e) {
  const cell = e.target.closest('.cell');
  if (!cell || !gameActive) return;
  
  const index = parseInt(cell.dataset.index);
  const i = Math.floor(index / cols);
  const j = index % cols;
  
  if (!(boardState[index] & CELL_FLAGGED)) {
    revealCell(i, j);
  }
}

function handleCellRightClick(e) {
  e.preventDefault();
  const cell = e.target.closest('.cell');
  if (!cell || !gameActive) return;
  
  const index = parseInt(cell.dataset.index);
  if (!(boardState[index] & CELL_REVEALED)) {
    boardState[index] ^= CELL_FLAGGED;
    renderBoard();
    saveGameState();
  }
}

let longPressTimer;
function handleTouchStart(e) {
  const cell = e.target.closest('.cell');
  if (!cell || !gameActive) return;
  
  const index = parseInt(cell.dataset.index);
  if (boardState[index] & CELL_REVEALED) return;
  
  longPressTimer = setTimeout(() => {
    boardState[index] ^= CELL_FLAGGED;
    renderBoard();
    saveGameState();
  }, 500);
}

function handleTouchEnd() {
  clearTimeout(longPressTimer);
}

function handleTouchMove() {
  clearTimeout(longPressTimer);
}

function renderBoard() {
  const cells = gameBoard.children;
  for (let i = 0; i < rows * cols; i++) {
    const cell = cells[i];
    cell.className = 'cell';
    cell.textContent = '';
    
    if (boardState[i] & CELL_REVEALED) {
      cell.classList.add('revealed');
      if (boardState[i] & CELL_BOMB) {
        cell.textContent = '💣';
      } else if (adjacentCounts[i] > 0) {
        cell.textContent = adjacentCounts[i];
      }
    } else if (boardState[i] & CELL_FLAGGED) {
      cell.textContent = '🚩';
    }
  }
}

function revealCell(i, j) {
  const index = i * cols + j;
  if (i < 0 || i >= rows || j < 0 || j >= cols) return;
  if (boardState[index] & (CELL_REVEALED | CELL_FLAGGED)) return;
  
  boardState[index] |= CELL_REVEALED;

  if (boardState[index] & CELL_BOMB) {
    gameActive = false;
    // Reveal all cells
    for (let idx = 0; idx < rows * cols; idx++) {
      boardState[idx] |= CELL_REVEALED;
    }
    renderBoard();
    saveGameState();
    showOverlay('Game Over! You hit a bomb!');
    return;
  }
  
  if (adjacentCounts[index] === 0) {
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        if (x === 0 && y === 0) continue;
        revealCell(i + x, j + y);
      }
    }
  }
  
  renderBoard();
  saveGameState();
  checkWinCondition();
}

function checkWinCondition() {
  for (let i = 0; i < rows * cols; i++) {
    if (!(boardState[i] & CELL_BOMB) && !(boardState[i] & CELL_REVEALED)) {
      return;
    }
  }
  gameActive = false;
  saveGameState();
  showOverlay('Congratulations! You win!');
}

function saveGameState() {
  const state = {
    rows,
    cols,
    bombs,
    boardState: Array.from(boardState),
    adjacentCounts: Array.from(adjacentCounts)
  };
  localStorage.setItem('minesweeperState', JSON.stringify(state));
}

function loadGameState() {
  if (savedState) {
    const state = JSON.parse(savedState);
    rows = state.rows;
    cols = state.cols;
    bombs = state.bombs;
    boardState = new Uint8Array(state.boardState);
    adjacentCounts = new Uint8Array(state.adjacentCounts);
    rowsInput.value = rows;
    colsInput.value = cols;
    bombsInput.value = bombs;
    setupBoard();
    renderBoard();
  }
}

startButton.addEventListener('click', () => {
  rows = parseInt(rowsInput.value);
  cols = parseInt(colsInput.value);
  bombs = parseInt(bombsInput.value);
  // Validate bombs count
  if (bombs >= rows * cols) {
    showOverlay('Number of bombs must be less than rows x columns');
    return;
  }
  createBoard(rows, cols, bombs);
});

// Initialize game from saved state if available
if (savedState) {
  loadGameState();
} else {
  // Create default game with 10 rows, 10 cols, and 15 bombs
  createBoard(10, 10, 15);
}

function showOverlay(text) {
  overlayMessage.textContent = text;
  overlay.classList.remove('hidden');
}

// Add event listeners to dismiss the overlay
overlay.addEventListener('click', (e) => {
  if (e.target === overlay || e.target.id === 'closeOverlay') {
    overlay.classList.add('hidden');
  }
});

// Add event listener to dismiss overlay when Esc is pressed
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    overlay.classList.add('hidden');
  }
});
