// Constants 
const CELL_REVEALED = 0b1;
const CELL_BOMB = 0b10;
const CELL_FLAGGED = 0b100;

// Game state variables (not DOM-dependent)
let boardState;
let adjacentCounts;
let previousBoardState;
let scale = 1;
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;
let rows, cols, bombs;
let gameActive = false;
let isFirstMove = true;

// DOM-dependent code inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const gameBoard = document.getElementById('game-board');
  const gameContainer = document.getElementById('game-container');
  const startButton = document.getElementById('start');
  const rowsInput = document.getElementById('rows');
  const colsInput = document.getElementById('cols');
  const bombsInput = document.getElementById('bombs');
  const overlay = document.getElementById('overlay');
  const overlayMessage = document.getElementById('message');
  const closeOverlay = document.getElementById('closeOverlay');
  const debugElement = document.getElementById('debug');
  const settingsButton = document.getElementById('settings');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettings = document.getElementById('closeSettings');
  const showDebugCheckbox = document.getElementById('show-debug');

  // Check if there's a saved game state
  const savedState = localStorage.getItem('minesweeperState');

  // Load debug preference from localStorage
  let showDebug = localStorage.getItem('showDebug') === 'true';
  showDebugCheckbox.checked = showDebug;
  debugElement.classList.toggle('visible', showDebug);

  // Handle settings button click
  settingsButton.addEventListener('click', () => {
    settingsOverlay.classList.remove('hidden');
  });

  // Handle settings close button
  closeSettings.addEventListener('click', () => {
    settingsOverlay.classList.add('hidden');
  });

  // Handle debug checkbox changes
  showDebugCheckbox.addEventListener('change', (e) => {
    showDebug = e.target.checked;
    localStorage.setItem('showDebug', showDebug);
    debugElement.classList.toggle('visible', showDebug);
  });

  // Close settings overlay on escape or clicking outside
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) {
      settingsOverlay.classList.add('hidden');
    }
  });

  // Add reset button functionality to clear local storage and reload the game
  const resetButton = document.getElementById('reset');
  resetButton.addEventListener('click', () => {
    localStorage.removeItem('minesweeperState');
    location.reload();
  });

  // Add event listeners for zoom and pan
  gameContainer.addEventListener('wheel', handleWheel, { passive: false });
  gameContainer.addEventListener('mousedown', handleDragStart);
  gameContainer.addEventListener('mousemove', handleDragMove);
  gameContainer.addEventListener('mouseup', handleDragEnd);
  gameContainer.addEventListener('mouseleave', handleDragEnd);

  // Touch events for mobile zoom and pan
  gameContainer.addEventListener('touchstart', handleTouchStartZoom, { passive: true });
  gameContainer.addEventListener('touchmove', handleTouchMoveZoom, { passive: false });
  gameContainer.addEventListener('touchend', handleTouchEndZoom, { passive: true });
  gameContainer.addEventListener('touchcancel', handleTouchCancelZoom, { passive: true });

  // Start button event listener
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

  function handleWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY;
      const scaleChange = -delta / 500;
      updateScale(scale * (1 + scaleChange), e);
    }
  }

  function updateScale(newScale, e) {
    newScale = Math.min(Math.max(newScale, 0.5), 3);
    if (newScale === scale) return;

    scale = newScale;
    gameBoard.style.transform = `scale(${scale})`;
  }

  function handleDragStart(e) {
    if (e.button !== 0) return; // Only handle left mouse button
    isDragging = true;
    gameContainer.style.cursor = 'grabbing';
    startX = e.pageX - gameContainer.offsetLeft;
    startY = e.pageY - gameContainer.offsetTop;
    scrollLeft = gameContainer.scrollLeft;
    scrollTop = gameContainer.scrollTop;
  }

  function handleDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - gameContainer.offsetLeft;
    const y = e.pageY - gameContainer.offsetTop;
    const walkX = (x - startX);
    const walkY = (y - startY);
    gameContainer.scrollLeft = scrollLeft - walkX;
    gameContainer.scrollTop = scrollTop - walkY;
  }

  function handleDragEnd() {
    isDragging = false;
    gameContainer.style.cursor = 'default';
  }

  let initialDistance = null;
  let initialScale = 1;
  let lastTouchX = null;
  let lastTouchY = null;
  let isPanning = false;

  function handleTouchStartZoom(e) {
    if (e.touches.length === 2) {
      // Zoom gesture
      initialDistance = getDistance(e.touches);
      initialScale = scale;
      isPanning = false;
    } else if (e.touches.length === 1) {
      // Pan gesture
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      isPanning = true;
    }
  }

  function handleTouchMoveZoom(e) {
    if (e.touches.length === 2) {
      // Handle zoom
      e.preventDefault();
      const distance = getDistance(e.touches);
      if (initialDistance === null) {
        initialDistance = distance;
      }
      const scaleFactor = distance / initialDistance;
      updateScale(initialScale * scaleFactor, e);
      isPanning = false;
    } else if (e.touches.length === 1 && isPanning) {
      // Handle pan
      e.preventDefault();
      const deltaX = e.touches[0].clientX - lastTouchX;
      const deltaY = e.touches[0].clientY - lastTouchY;
      
      gameContainer.scrollLeft -= deltaX;
      gameContainer.scrollTop -= deltaY;
      
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  }

  function handleTouchEndZoom() {
    initialDistance = null;
    lastTouchX = null;
    lastTouchY = null;
    isPanning = false;
  }

  function handleTouchCancelZoom() {
    initialDistance = null;
    lastTouchX = null;
    lastTouchY = null;
    isPanning = false;
  }

  function getDistance(touches) {
    const x1 = touches[0].clientX;
    const y1 = touches[0].clientY;
    const x2 = touches[1].clientX;
    const y2 = touches[1].clientY;
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  function createBoard(r, c, b) {
    rows = r;
    cols = c;
    bombs = b;
    gameActive = true; // start game
    isFirstMove = true; // reset first move flag
    document.getElementById('status').textContent = ""; // clear status

    // Use Uint8Array for efficient storage
    boardState = new Uint8Array(r * c);
    adjacentCounts = new Uint8Array(r * c);
    previousBoardState = new Uint8Array(r * c);

    // We'll place bombs after first click
    // No need to calculate adjacent bombs yet either

    setupBoard();
    renderBoard();
    saveGameState();
  }

  function setupBoard() {
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
    gameBoard.style.transform = 'scale(1)';  // Reset transform

    // Create cells once
    for (let i = 0; i < rows * cols; i++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.index = i;
      gameBoard.appendChild(cell);
    }

    // Calculate initial scale after cells are created
    requestAnimationFrame(() => {
      const container = document.getElementById('game-container');
      const containerWidth = container.clientWidth - 40;
      const containerHeight = container.clientHeight - 40;
      const boardWidth = cols * 30;
      const boardHeight = rows * 30;

      scale = Math.min(
        containerWidth / boardWidth,
        containerHeight / boardHeight,
        1
      );

      gameBoard.style.transform = `scale(${scale})`;
    });

    // Use event delegation with passive: false for all touch events
    gameBoard.addEventListener('click', handleCellClick);
    gameBoard.addEventListener('contextmenu', handleCellRightClick);
    gameBoard.addEventListener('touchstart', handleTouchStart, { passive: false });
    gameBoard.addEventListener('touchend', handleTouchEnd, { passive: false });
    gameBoard.addEventListener('touchmove', handleTouchMove, { passive: false });
    gameBoard.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    // Prevent default touch events on the container to avoid conflicts
    gameContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) return; // Allow multi-finger gestures for zoom
      e.stopPropagation();
    }, { passive: false });
    gameContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) return; // Allow multi-finger gestures for zoom
      e.stopPropagation();
    }, { passive: false });
    gameContainer.addEventListener('touchend', (e) => {
      if (e.touches.length > 1) return; // Allow multi-finger gestures for zoom
      e.stopPropagation();
    });
    gameContainer.addEventListener('touchcancel', (e) => {
      e.stopPropagation();
    });
  }

  function handleCellClick(e) {
    const cell = e.target.closest('.cell');
    if (!cell || !gameActive) return;

    const index = parseInt(cell.dataset.index);
    const i = Math.floor(index / cols);
    const j = index % cols;

    if (!(boardState[index] & CELL_FLAGGED)) {
      revealCell(i, j, false);
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

  let touchStartTime;
  let touchStartX;
  let touchStartY;
  let touchCell;
  const LONG_PRESS_DURATION = 300; // Reduced from 500ms
  const TOUCH_MOVE_THRESHOLD = 40; // Increased to 40px to be much less sensitive
  let longPressTimeout;
  let isLongPressDetected = false;

  function debug(message) {
    if (debugElement && showDebug) {
      debugElement.textContent = message + '\n' + debugElement.textContent;
      // Keep only last 10 lines
      debugElement.textContent = debugElement.textContent.split('\n').slice(0, 10).join('\n');
    }
  }

  function handleTouchStart(e) {
    e.preventDefault(); // Prevent default touch behaviors
    const cell = e.target.closest('.cell');
    if (!cell || !gameActive) return;

    const index = parseInt(cell.dataset.index);
    if (boardState[index] & CELL_REVEALED) return;

    touchCell = cell;
    touchStartTime = Date.now();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isLongPressDetected = false;

    cell.classList.add('pressing');
    debug('Touch start, waiting for long press...');

    // Short vibration to indicate touch start
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    // Set timeout for long press
    longPressTimeout = setTimeout(() => {
      debug('Long press detected!');
      if (touchCell && !(boardState[index] & CELL_REVEALED)) {
        isLongPressDetected = true;
        if (navigator.vibrate) {
          navigator.vibrate([50, 50, 50]);
        }
      }
    }, LONG_PRESS_DURATION);
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    if (!touchCell || !gameActive) return;

    clearTimeout(longPressTimeout);
    touchCell.classList.remove('pressing');
    debug('Touch end, isLongPress: ' + isLongPressDetected);

    const index = parseInt(touchCell.dataset.index);

    // Calculate if there was significant movement
    const touchX = e.changedTouches[0].clientX;
    const touchY = e.changedTouches[0].clientY;
    const moveDistance = Math.sqrt(
      Math.pow(touchX - touchStartX, 2) +
      Math.pow(touchY - touchStartY, 2)
    );

    debug('Move distance: ' + moveDistance.toFixed(2));

    if (moveDistance < TOUCH_MOVE_THRESHOLD) {
      if (isLongPressDetected) {
        debug('Placing flag');
        // Long press - toggle flag
        if (!(boardState[index] & CELL_REVEALED)) {
          boardState[index] ^= CELL_FLAGGED;
          renderBoard();
          saveGameState();
        }
      } else {
        debug('Revealing cell');
        // Short press - reveal cell with short vibration
        if (!(boardState[index] & CELL_FLAGGED)) {
          if (navigator.vibrate) {
            navigator.vibrate(20);
          }
          const i = Math.floor(index / cols);
          const j = index % cols;
          revealCell(i, j, false);
        }
      }
    }

    touchCell = null;
    touchStartTime = null;
    isLongPressDetected = false;
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (!touchCell) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const moveDistance = Math.sqrt(
      Math.pow(touchX - touchStartX, 2) +
      Math.pow(touchY - touchStartY, 2)
    );

    debug('Touch move, distance: ' + moveDistance.toFixed(2));

    // Only clear timeout if movement exceeds threshold
    if (moveDistance > TOUCH_MOVE_THRESHOLD) {
      clearTimeout(longPressTimeout);
      touchCell.classList.remove('pressing');
      touchCell = null;
      touchStartTime = null;
      isLongPressDetected = false;
    }
  }

  function handleTouchCancel() {
    if (touchCell) {
      clearTimeout(longPressTimeout);
      touchCell.classList.remove('pressing');
      touchCell = null;
      touchStartTime = null;
      isLongPressDetected = false;
    }
  }

  function renderBoard() {
    const cells = gameBoard.children;
    for (let i = 0; i < rows * cols; i++) {
      // Only update cells that changed state
      if (boardState[i] !== previousBoardState[i]) {
        const cell = cells[i];
        cell.className = 'cell';
        cell.textContent = '';

        if (boardState[i] & CELL_REVEALED) {
          cell.classList.add('revealed');
          if (boardState[i] & CELL_BOMB) {
            cell.textContent = '💣';
          } else if (adjacentCounts[i] > 0) {
            cell.textContent = adjacentCounts[i];
            cell.classList.add(`number-${adjacentCounts[i]}`);
          }
        } else if (boardState[i] & CELL_FLAGGED) {
          cell.textContent = '🚩';
        }

        previousBoardState[i] = boardState[i];
      }
    }
  }

  function revealCell(i, j, isRecursive = false) {
    const index = i * cols + j;
    if (i < 0 || i >= rows || j < 0 || j >= cols) return;
    if (boardState[index] & (CELL_REVEALED | CELL_FLAGGED)) return;

    // Handle first move safety
    if (isFirstMove && !isRecursive) {
      isFirstMove = false;
      placeBombsSafely(i, j);
      calculateAdjacentCounts();
    }

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
          revealCell(i + x, j + y, true);
        }
      }
    }

    // Only render and save if this is the initial reveal call
    if (!isRecursive) {
      renderBoard();
      saveGameState();
      checkWinCondition();
    }
  }

  // Function to place bombs safely after first click
  function placeBombsSafely(clickedRow, clickedCol) {
    // Create a list of safe cells - the clicked cell and its neighbors
    const safeCells = new Set();
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        const newRow = clickedRow + x;
        const newCol = clickedCol + y;
        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
          safeCells.add(newRow * cols + newCol);
        }
      }
    }

    // Create a list of all possible cells
    const availableCells = [];
    for (let i = 0; i < rows * cols; i++) {
      if (!safeCells.has(i)) {
        availableCells.push(i);
      }
    }

    // Check if we have enough cells for bombs
    if (bombs >= availableCells.length) {
      bombs = Math.max(1, availableCells.length - 1);
    }

    // Place bombs randomly in available cells
    let bombsPlaced = 0;
    while (bombsPlaced < bombs) {
      if (availableCells.length === 0) break; // Safety check

      // Select a random index from available cells
      const randomIndex = Math.floor(Math.random() * availableCells.length);
      const cellIndex = availableCells[randomIndex];

      // Place bomb and remove from available cells
      boardState[cellIndex] |= CELL_BOMB;
      availableCells.splice(randomIndex, 1);
      bombsPlaced++;
    }
  }

  // Calculate adjacent bombs - extracted to a separate function
  function calculateAdjacentCounts() {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const index = i * cols + j;
        if (boardState[index] & CELL_BOMB) continue;
        let count = 0;
        for (let x = -1; x <= 1; x++) {
          for (let y = -1; y <= 1; y++) {
            if (x === 0 && y === 0) continue;
            const newRow = i + x;
            const newCol = j + y;
            if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
              if (boardState[newRow * cols + newCol] & CELL_BOMB) count++;
            }
          }
        }
        adjacentCounts[index] = count;
      }
    }
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
      adjacentCounts: Array.from(adjacentCounts),
      isFirstMove
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
      previousBoardState = new Uint8Array(state.boardState);
      isFirstMove = state.isFirstMove !== undefined ? state.isFirstMove : false;
      rowsInput.value = rows;
      colsInput.value = cols;
      bombsInput.value = bombs;
      setupBoard();
      renderBoard();
    }
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
});
