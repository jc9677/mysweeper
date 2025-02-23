// main.js

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

let board = [];
let rows, cols, bombs;
let gameActive = false; // Track game state

function createBoard(r, c, b) {
  rows = r;
  cols = c;
  bombs = b;
  gameActive = true; // start game
  document.getElementById('status').textContent = ""; // clear status

  board = Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => ({
    bomb: false,
    revealed: false,
    flagged: false,
    adjacent: 0,
    row: i,
    col: j
  })));

  // Place bombs
  let bombsPlaced = 0;
  while (bombsPlaced < b) {
    const randRow = Math.floor(Math.random() * r);
    const randCol = Math.floor(Math.random() * c);
    if (!board[randRow][randCol].bomb) {
      board[randRow][randCol].bomb = true;
      bombsPlaced++;
    }
  }

  // Calculate adjacent bombs
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (board[i][j].bomb) continue;
      let count = 0;
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          if (x === 0 && y === 0) continue;
          const newRow = i + x;
          const newCol = j + y;
          if (newRow >= 0 && newRow < r && newCol >= 0 && newCol < c) {
            if (board[newRow][newCol].bomb) count++;
          }
        }
      }
      board[i][j].adjacent = count;
    }
  }
  renderBoard();
  saveGameState();
}

function renderBoard() {
  gameBoard.innerHTML = '';
  gameBoard.style.gridTemplateColumns = `repeat(${cols}, 30px)`;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = i;
      cell.dataset.col = j;
      
      if (board[i][j].revealed) {
        cell.classList.add('revealed');
        if (board[i][j].bomb) {
          cell.textContent = '💣';
        } else if (board[i][j].adjacent > 0) {
          cell.textContent = board[i][j].adjacent;
        }
      } else if (board[i][j].flagged) {
        cell.textContent = '🚩';
      }

      // Click handler for revealing cells
      cell.addEventListener('click', (e) => {
        if (gameActive && !board[i][j].flagged) {
          revealCell(i, j);
        }
      });

      // Right click handler for desktop
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (gameActive && !board[i][j].revealed) {
          board[i][j].flagged = !board[i][j].flagged;
          renderBoard();
          saveGameState();
        }
      });

      // Long press handler for mobile
      let longPressTimer;
      cell.addEventListener('touchstart', (e) => {
        if (!gameActive || board[i][j].revealed) return;
        longPressTimer = setTimeout(() => {
          board[i][j].flagged = !board[i][j].flagged;
          renderBoard();
          saveGameState();
        }, 500);
      });

      cell.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
      });

      cell.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
      });

      gameBoard.appendChild(cell);
    }
  }
}

function revealCell(i, j) {
  // Avoid out-of-bound, already revealed, or flagged cells
  if (i < 0 || i >= rows || j < 0 || j >= cols) return;
  if (board[i][j].revealed || board[i][j].flagged) return;
  
  board[i][j].revealed = true;

  // If bomb, lose immediately
  if (board[i][j].bomb) {
    gameActive = false;
    renderBoard();
    saveGameState();
    showOverlay('Game Over! You hit a bomb!');
    return;
  }
  
  // If cell is empty and has no adjacent bombs, reveal surrounding cells
  if (board[i][j].adjacent === 0) {
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
  // Win if all non-bomb cells are revealed
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (!board[i][j].bomb && !board[i][j].revealed) {
        return;
      }
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
    board
  };
  localStorage.setItem('minesweeperState', JSON.stringify(state));
}

function loadGameState() {
  if (savedState) {
    const state = JSON.parse(savedState);
    rows = state.rows;
    cols = state.cols;
    bombs = state.bombs;
    board = state.board;
    // Update inputs
    rowsInput.value = rows;
    colsInput.value = cols;
    bombsInput.value = bombs;
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
