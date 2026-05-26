const state = {
  author: "",
  title: "",
  puzzleTitle: "",
  quote: "",
  columns: 27,
  minLength: 4,
  initials: [],
  clues: [],
  fileHandle: null,
  fileName: "Untitled puzzle",
  poolOrder: [],
  scratchCells: Array(60).fill(null)
};

const elements = {
  form: document.querySelector("#setupForm"),
  author: document.querySelector("#authorInput"),
  title: document.querySelector("#titleInput"),
  puzzleTitle: document.querySelector("#puzzleTitleInput"),
  quote: document.querySelector("#quoteInput"),
  columns: document.querySelector("#columnsInput"),
  minLength: document.querySelector("#minLengthInput"),
  letterCount: document.querySelector("#letterCount"),
  blackCount: document.querySelector("#blackCount"),
  clueCount: document.querySelector("#clueCount"),
  answerLetterCount: document.querySelector("#answerLetterCount"),
  initialsOutput: document.querySelector("#initialsOutput"),
  checks: document.querySelector("#checksList"),
  grid: document.querySelector("#quoteGrid"),
  availablePool: document.querySelector("#availablePool"),
  resetPool: document.querySelector("#resetPool"),
  clueTable: document.querySelector("#clueTable"),
  rowTemplate: document.querySelector("#clueRowTemplate"),
  fileMenuButton: document.querySelector("#fileMenuButton"),
  fileMenu: document.querySelector("#fileMenu"),
  openPuzzle: document.querySelector("#openPuzzle"),
  savePuzzle: document.querySelector("#savePuzzle"),
  saveAsPuzzle: document.querySelector("#saveAsPuzzle"),
  printPreview: document.querySelector("#printPreview"),
  printPuzzle: document.querySelector("#printPuzzle"),
  printPreviewPanel: document.querySelector("#printPreviewPanel"),
  printSheet: document.querySelector("#printSheet"),
  closePrintPreview: document.querySelector("#closePrintPreview"),
  printFromPreview: document.querySelector("#printFromPreview"),
  fillAnswersPrint: document.querySelector("#fillAnswersPrint"),
  fillGridPrint: document.querySelector("#fillGridPrint"),
  currentFileName: document.querySelector("#currentFileName"),
  balanceLengths: document.querySelector("#balanceLengths"),
  clearAnswers: document.querySelector("#clearAnswers"),
  importPuzzle: document.querySelector("#importPuzzle"),
  loadSample: document.querySelector("#loadSample")
};

const samplePuzzle = {
  author: "A.A. Milne",
  title: "Winnie-the-Pooh",
  puzzleTitle: "A Small Acrostic",
  quote: "Some people care too much. I think it's called love.",
  columns: 27,
  minLength: 4,
  clues: [
    { answer: "APPLE", clue: "Fruit often paired with honey", length: 5 },
    { answer: "ACRE", clue: "Measure of land", length: 4 },
    { answer: "MOTH", clue: "Night-flying insect", length: 4 },
    { answer: "IVORY", clue: "Creamy white shade", length: 5 }
  ]
};

function clueLabel(index) {
  let label = "";
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function sourceInitials(author, title) {
  return `${author} ${title}`
    .toUpperCase()
    .match(/[A-Z]/g) || [];
}

function quoteCells(quote) {
  let letterIndex = 0;
  const cells = Array.from(quote).map((char) => {
    if (/[A-Za-z]/.test(char)) {
      letterIndex += 1;
      return {
        type: "letter",
        letter: char.toUpperCase(),
        index: letterIndex
      };
    } else if (char === '-') {
      return {
        type: "dash",
        letter: char
      };
    } else if (char === ' ') {
      return {
        type: "black",
        letter: char
      };
    }
    return {
      type: "skip",
      letter: char
    };
  });
  while (cells.length && ["black", "skip"].includes(cells[cells.length - 1].type)) {
    cells.pop();
  }
  return cells;
}

function answerLetters(answer) {
  return answer.toUpperCase().replace(/[^A-Z]/g, "");
}

function cellLetters() {
  return quoteCells(state.quote).filter((cell) => cell.type === "letter");
}

function readSetup() {
  state.author = elements.author.value.trim();
  state.title = elements.title.value.trim();
  state.puzzleTitle = elements.puzzleTitle.value.trim();
  state.quote = elements.quote.value.trim();
  state.columns = Number(elements.columns.value) || 27;
  state.minLength = Number(elements.minLength.value) || 4;
  state.initials = sourceInitials(state.author, state.title);
}

function ensureClueRows() {
  const existing = new Map(state.clues.map((clue, index) => [index, clue]));
  state.clues = state.initials.map((initial, index) => {
    const previous = existing.get(index) || {};
    return {
      requiredInitial: initial,
      answer: previous.answer || "",
      clue: previous.clue || "",
      length: Number(previous.length) || state.minLength,
      cellNumbers: Array.isArray(previous.cellNumbers) ? previous.cellNumbers : []
    };
  });
}

function renderGrid() {
  const cells = quoteCells(state.quote);
  const assignments = buildAssignments();
  elements.grid.style.setProperty("--columns", state.columns);
  elements.grid.innerHTML = "";

  cells.forEach((cell) => {
    if (cell.type !== "skip") {
      const node = document.createElement("div");
      node.className = cell.type === "black" ? "cell black" : cell.type === "dash" ? "cell dash" : "cell";
      if (cell.type === "letter") {
        const number = document.createElement("span");
        number.className = "cell-number";
        number.textContent = cell.index;

        const clueMarker = document.createElement("span");
        clueMarker.className = "cell-clue";
        clueMarker.textContent = assignments.byCell.get(cell.index)?.label || "";

        const letter = document.createElement("span");
        letter.className = "cell-letter";
        letter.textContent = cell.letter;

        node.append(number, clueMarker, letter);
      } else if (cell.type === "dash") {
        const dash = document.createElement("span");
        dash.className = "cell-letter";
        dash.textContent = cell.letter;
        node.append(dash);
      }
      elements.grid.append(node);
    }
  });
}

function renderClues() {
  elements.clueTable.innerHTML = "";

  state.clues.forEach((clue, index) => {
    const row = elements.rowTemplate.content.firstElementChild.cloneNode(true);
    const cleanAnswer = answerLetters(clue.answer);
    const isInvalid = cleanAnswer && cleanAnswer[0] !== clue.requiredInitial;

    row.dataset.index = String(index);
    row.classList.toggle("invalid", isInvalid);
    row.classList.toggle("missing-assignment", clueHasMissingAssignment(clue));
    row.classList.toggle("unavailable-initial", unavailableInitialIndexes().has(index));
    row.querySelector(".clue-letter").textContent = clueLabel(index);
    row.querySelector(".required-initial").textContent = clue.requiredInitial;

    const answerInput = row.querySelector(".answer-input");
    const clueInput = row.querySelector(".clue-input");
    const lengthOutput = row.querySelector(".length-output");

    answerInput.value = clue.answer;
    answerInput.placeholder = "";
    clueInput.value = clue.clue;
    updateLengthOutput(lengthOutput, clue);
    const missing = missingAssignedLetters(clue);
    answerInput.setCustomValidity(missing.length ? `No available quote cell for: ${missing.join(", ")}` : "");

    answerInput.addEventListener("input", () => {
      clue.answer = answerInput.value;
      rejectUnavailableAnswerLetters(clue, answerInput);
      syncLengthFromAnswer(clue, lengthOutput);
      refreshClueRow(row, clue, index);
      updateLengthOutput(lengthOutput, clue);
      renderStatus();
      refreshClueWarnings();
      renderGrid();
      renderAvailablePoolPanel();
      renderPrintSheet();
    });

    answerInput.addEventListener("blur", () => {
      syncLengthFromAnswer(clue, lengthOutput);
      updateLengthOutput(lengthOutput, clue);
      renderStatus();
      refreshClueWarnings();
      renderGrid();
      renderAvailablePoolPanel();
      renderPrintSheet();
    });

    clueInput.addEventListener("input", () => {
      clue.clue = clueInput.value;
      renderStatus();
      renderPrintSheet();
    });

    elements.clueTable.append(row);
  });
}

function displayedLength(clue) {
  return answerLetters(clue.answer).length || Number(clue.length) || state.minLength;
}

function updateLengthOutput(lengthOutput, clue) {
  const length = displayedLength(clue);
  lengthOutput.value = length;
  lengthOutput.textContent = length;
  lengthOutput.classList.toggle("too-short", length < state.minLength);
}

function syncLengthFromAnswer(clue, lengthOutput) {
  const length = answerLetters(clue.answer).length;
  if (length > 0) {
    clue.length = length;
    lengthOutput.value = length;
    lengthOutput.textContent = length;
  } else {
    lengthOutput.value = clue.length;
    lengthOutput.textContent = clue.length;
  }
}

function letterCounts(letters) {
  return letters.reduce((counts, letter) => {
    counts.set(letter, (counts.get(letter) || 0) + 1);
    return counts;
  }, new Map());
}

function missingSourceInitialLetters() {
  const quoteLetterCounts = letterCounts(cellLetters().map((cell) => cell.letter));
  const requiredCounts = letterCounts(state.initials);
  const missing = [];
  requiredCounts.forEach((needed, letter) => {
    const available = quoteLetterCounts.get(letter) || 0;
    for (let index = available; index < needed; index += 1) {
      missing.push(letter);
    }
  });
  return missing;
}

function unavailableInitialIndexes() {
  const availableCounts = letterCounts(buildAssignments().availablePool.map((cell) => cell.letter));
  const unavailable = new Set();
  state.clues.forEach((clue, index) => {
    if (answerLetters(clue.answer)) return;
    const needed = clue.requiredInitial;
    const available = availableCounts.get(needed) || 0;
    if (available <= 0) {
      unavailable.add(index);
      return;
    }
    availableCounts.set(needed, available - 1);
  });
  return unavailable;
}

function missingAssignedLetters(clue) {
  const letters = answerLetters(clue.answer);
  if (!letters) return [];
  const cellNumbers = Array.isArray(clue.cellNumbers) ? clue.cellNumbers : [];
  return Array.from(letters).filter((letter, index) => !cellNumbers[index]);
}

function clueHasMissingAssignment(clue) {
  return missingAssignedLetters(clue).length > 0;
}

function removeUnassignedAnswerLetters(answer, cellNumbers) {
  let letterIndex = 0;
  return Array.from(answer).filter((char) => {
    if (!/[A-Za-z]/.test(char)) return true;
    const keep = Boolean(cellNumbers[letterIndex]);
    letterIndex += 1;
    return keep;
  }).join("");
}

function rejectUnavailableAnswerLetters(clue, answerInput) {
  syncCellAssignments();
  if (!clueHasMissingAssignment(clue)) return false;
  clue.answer = removeUnassignedAnswerLetters(clue.answer, clue.cellNumbers || []);
  answerInput.value = clue.answer;
  syncCellAssignments();
  return true;
}

function refreshClueRow(row, clue, index) {
  const cleanAnswer = answerLetters(clue.answer);
  row.classList.toggle("invalid", Boolean(cleanAnswer && cleanAnswer[0] !== clue.requiredInitial));
  row.classList.toggle("missing-assignment", clueHasMissingAssignment(clue));
  if (Number.isInteger(index)) {
    row.classList.toggle("unavailable-initial", unavailableInitialIndexes().has(index));
  }
  const answerInput = row.querySelector(".answer-input");
  if (answerInput) {
    const missing = missingAssignedLetters(clue);
    answerInput.setCustomValidity(missing.length ? `No available quote cell for: ${missing.join(", ")}` : "");
  }
}

function refreshClueWarnings() {
  const unavailable = unavailableInitialIndexes();
  elements.clueTable.querySelectorAll(".clue-row").forEach((row) => {
    const index = Number(row.dataset.index);
    row.classList.toggle("unavailable-initial", unavailable.has(index));
    const clue = state.clues[index];
    if (clue) {
      row.classList.toggle("missing-assignment", clueHasMissingAssignment(clue));
      const answerInput = row.querySelector(".answer-input");
      if (answerInput) {
        const missing = missingAssignedLetters(clue);
        answerInput.setCustomValidity(missing.length ? `No available quote cell for: ${missing.join(", ")}` : "");
      }
    }
  });
}

function renderStatus() {
  const cells = quoteCells(state.quote);
  const letterCount = cells.filter((cell) => cell.type === "letter").length;
  const blackCount = cells.length - letterCount;
  const answerLetterCount = state.clues.reduce((sum, clue) => {
    return sum + displayedLength(clue);
  }, 0);
  const checks = buildChecks(letterCount, answerLetterCount);

  elements.letterCount.textContent = letterCount;
  elements.blackCount.textContent = blackCount;
  elements.clueCount.textContent = state.initials.length;
  elements.answerLetterCount.textContent = answerLetterCount;
  elements.initialsOutput.textContent = state.initials.length ? state.initials.join("") : "-";
  elements.checks.innerHTML = "";

  checks.forEach((check) => {
    const item = document.createElement("li");
    item.className = check.type;
    item.textContent = check.message;
    elements.checks.append(item);
  });
}

function buildChecks(letterCount, answerLetterCount) {
  const checks = [];

  if (!state.author || !state.title) {
    checks.push({ type: "warn", message: "Enter an author and title to create source initials." });
  } else {
    checks.push({ type: "", message: "Source initials are ready." });
  }

  if (letterCount === 0) {
    checks.push({ type: "warn", message: "Paste a quote to populate the grid." });
  } else if (missingSourceInitialLetters().length) {
    checks.push({
      type: "error",
      message: `Quote is missing required source initial letters: ${missingSourceInitialLetters().join(", ")}.`
    });
  } else if (letterCount < 120 || letterCount > 230) {
    checks.push({ type: "warn", message: `Quote has ${letterCount} letters; Sunday-style acrostics are often near 180.` });
  } else {
    checks.push({ type: "", message: "Quote length is in a typical construction range." });
  }

  const shortAnswer = state.clues.findIndex((clue) => {
    const length = displayedLength(clue);
    return length < state.minLength;
  });
  if (shortAnswer >= 0) {
    checks.push({ type: "error", message: `${clueLabel(shortAnswer)} is shorter than the minimum answer length.` });
  }

  const unavailableInitials = unavailableInitialIndexes();
  if (unavailableInitials.size) {
    const labels = Array.from(unavailableInitials).map(clueLabel).join(", ");
    checks.push({
      type: "error",
      message: `Available pool lacks required initials for blank answer(s): ${labels}.`
    });
  }

  const missingAssignment = state.clues.findIndex(clueHasMissingAssignment);
  if (missingAssignment >= 0) {
    const missing = missingAssignedLetters(state.clues[missingAssignment]).join(", ");
    checks.push({ type: "error", message: `${clueLabel(missingAssignment)} uses answer letter(s) with no available quote cell: ${missing}.` });
  }

  const badInitial = state.clues.findIndex((clue) => {
    const letters = answerLetters(clue.answer);
    return letters && letters[0] !== clue.requiredInitial;
  });
  if (badInitial >= 0) {
    checks.push({ type: "error", message: `${clueLabel(badInitial)} must start with ${state.clues[badInitial].requiredInitial}.` });
  }

  if (letterCount && answerLetterCount !== letterCount) {
    checks.push({
      type: "warn",
      message: `Answer letters total ${answerLetterCount}; quote letters total ${letterCount}.`
    });
  } else if (letterCount) {
    checks.push({ type: "", message: "Answer-letter total matches the quote." });
  }

  return checks;
}

function update(rebuildClues = true) {
  readSetup();
  if (rebuildClues) {
    ensureClueRows();
  }
  renderGrid();
  renderAvailablePoolPanel();
  renderClues();
  renderStatus();
  renderPrintSheet();
}

function suggestLengths() {
  readSetup();
  const letterCount = quoteCells(state.quote).filter((cell) => cell.type === "letter").length;
  if (!state.clues.length || !letterCount) {
    update(false);
    return;
  }

  const base = Math.max(state.minLength, Math.floor(letterCount / state.clues.length));
  let remaining = letterCount - base * state.clues.length;
  state.clues.forEach((clue) => {
    clue.length = base;
  });

  let index = 0;
  while (remaining > 0) {
    state.clues[index % state.clues.length].length += 1;
    remaining -= 1;
    index += 1;
  }

  while (remaining < 0) {
    const target = state.clues.find((clue) => clue.length > state.minLength);
    if (!target) break;
    target.length -= 1;
    remaining += 1;
  }

  update(false);
}

function puzzlePayload() {
  readSetup();
  const clues = state.clues.map((clue, index) => ({
    label: clueLabel(index),
    requiredInitial: clue.requiredInitial,
    answer: clue.answer,
    clue: clue.clue,
    length: Number(clue.length) || state.minLength,
    cellNumbers: Array.isArray(clue.cellNumbers) ? clue.cellNumbers : []
  }));

  return {
    format: "acrostic-constructor",
    version: 1,
    author: state.author,
    title: state.title,
    puzzleTitle: state.puzzleTitle,
    source: {
      author: state.author,
      title: state.title,
      puzzleTitle: state.puzzleTitle,
      quote: state.quote
    },
    quote: state.quote,
    columns: state.columns,
    minLength: state.minLength,
    initials: state.initials.join(""),
    answers: clues.map((clue) => ({
      label: clue.label,
      requiredInitial: clue.requiredInitial,
      answer: clue.answer,
      length: clue.length
    })),
    clues
  };
}

function downloadPuzzle(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = state.fileName === "Untitled puzzle" ? "acrostic-puzzle.json" : state.fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function writePuzzleToHandle(handle, payload) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

async function openPuzzleFromFileSystem() {
  if (!window.showOpenFilePicker) {
    elements.importPuzzle.click();
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Acrostic puzzle JSON",
          accept: { "application/json": [".json"] }
        }
      ],
      excludeAcceptAllOption: false,
      multiple: false
    });
    const file = await handle.getFile();
    const text = await file.text();
    loadPuzzleFromText(text, { fileHandle: handle, fileName: file.name });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    elements.importPuzzle.click();
  }
}

async function savePuzzle(useExistingHandle = true) {
  const payload = puzzlePayload();

  if (useExistingHandle && state.fileHandle) {
    try {
      await writePuzzleToHandle(state.fileHandle, payload);
      setCurrentFile(state.fileHandle, state.fileName);
      return;
    } catch (error) {
      if (error.name === "AbortError") throw error;
      downloadPuzzle(payload);
      return;
    }
  }

  if (!window.showSaveFilePicker) {
    downloadPuzzle(payload);
    return;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: state.fileName === "Untitled puzzle" ? "acrostic-puzzle.json" : state.fileName,
      types: [
        {
          description: "Acrostic puzzle JSON",
          accept: { "application/json": [".json"] }
        }
      ]
    });
    await writePuzzleToHandle(handle, payload);
    setCurrentFile(handle, handle.name);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    downloadPuzzle(payload);
  }
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return function nextRandom() {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledCells(seedSuffix = "") {
  const cells = cellLetters().map((cell) => ({
    index: cell.index,
    letter: cell.letter
  }));
  const random = seededRandom(`${state.author}|${state.title}|${state.quote}|${state.initials.join("")}|${seedSuffix}`);
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
  }
  return cells;
}

function takeCellFromPool(availablePool, letter = "", preferredKeys = []) {
  const targetLetter = letter.toUpperCase();
  const preferredKey = targetLetter
    ? preferredKeys.find((key) => {
      const [cellLetter] = key.split("-");
      return cellLetter === targetLetter;
    })
    : "";
  const preferredIndex = preferredKey
    ? availablePool.findIndex((cell) => cellKey(cell) === preferredKey)
    : -1;
  const matchIndex = preferredIndex >= 0
    ? preferredIndex
    : targetLetter
      ? availablePool.findIndex((cell) => cell.letter === targetLetter)
      : 0;
  if (matchIndex < 0) return null;
  const cell = availablePool.splice(matchIndex, 1)[0];
  if (cell) {
    const usedKey = cellKey(cell);
    const preferredSlot = preferredKeys.indexOf(usedKey);
    if (preferredSlot >= 0) {
      preferredKeys.splice(preferredSlot, 1);
    }
  }
  return cell || null;
}

function syncCellAssignments() {
  const availablePool = shuffledCells("assignments");
  const cellsByIndex = new Map(availablePool.map((cell) => [cell.index, cell]));
  const availableKeys = new Set(availablePool.map(cellKey));
  const scratchKeys = state.scratchCells.filter((key) => key && availableKeys.has(key));
  const usedNumbers = new Set();

  state.clues.forEach((clue) => {
    const letters = answerLetters(clue.answer);
    const previousNumbers = Array.isArray(clue.cellNumbers) ? clue.cellNumbers : [];
    const nextNumbers = [];

    Array.from(letters).forEach((letter, index) => {
      const previousNumber = Number(previousNumbers[index]);
      const previousCell = cellsByIndex.get(previousNumber);
      if (previousCell && previousCell.letter === letter && !usedNumbers.has(previousNumber)) {
        usedNumbers.add(previousNumber);
        nextNumbers.push(previousNumber);
        return;
      }

      const cell = takeCellFromPool(
        availablePool.filter((candidate) => !usedNumbers.has(candidate.index)),
        letter,
        scratchKeys
      );
      if (cell) {
        usedNumbers.add(cell.index);
        nextNumbers.push(cell.index);
      } else {
        nextNumbers.push("");
      }
    });

    clue.cellNumbers = nextNumbers;
  });

  state.scratchCells = state.scratchCells.map((key) => {
    if (!key || !availableKeys.has(key)) return null;
    const [, indexText] = key.split("-");
    return usedNumbers.has(Number(indexText)) ? null : key;
  });
}

function buildAssignments() {
  syncCellAssignments();
  const usedNumbers = new Set();
  const byCell = new Map();
  const byClue = new Map();

  state.clues.forEach((clue, clueIndex) => {
    const label = clueLabel(clueIndex);
    const letters = answerLetters(clue.answer);
    const length = letters.length || displayedLength(clue);
    const numbers = letters ? clue.cellNumbers.slice(0, length) : Array(length).fill("");
    numbers.forEach((cellNumber, index) => {
      if (cellNumber) {
        usedNumbers.add(Number(cellNumber));
        byCell.set(Number(cellNumber), { label, clueIndex, slotIndex: index });
      }
    });
    byClue.set(clueIndex, numbers);
  });

  const availablePool = shuffledCells("assignments").filter((cell) => !usedNumbers.has(cell.index));
  return { byCell, byClue, availablePool };
}

function renderAvailablePool(availablePool) {
  const pool = document.createElement("section");
  pool.className = "available-pool";
  const heading = document.createElement("h3");
  heading.textContent = "Available Cells";
  pool.append(heading);

  const groups = document.createElement("div");
  groups.className = "available-pool-groups";
  groupedAvailableCells(availablePool).forEach(([, poolCells]) => {
    const group = document.createElement("div");
    group.className = "pool-letter-group";
    const cells = document.createElement("div");
    cells.className = "pool-cells";
    poolCells.forEach((poolCell) => {
      const cell = document.createElement("span");
      cell.className = "pool-cell";
      cell.innerHTML = `<span class="pool-cell-number">${poolCell.index}</span><span class="pool-cell-letter">${poolCell.letter}</span>`;
      cells.append(cell);
    });
    group.append(cells);
    groups.append(group);
  });

  pool.append(groups);
  return pool;
}

function cellKey(cell) {
  return `${cell.letter}-${cell.index}`;
}

function availableCellMap(availablePool) {
  return new Map(availablePool.map((cell) => [cellKey(cell), cell]));
}

function cleanScratchCells(availablePool) {
  const valid = availableCellMap(availablePool);
  state.scratchCells = state.scratchCells.map((key) => (key && valid.has(key) ? key : null));
}

function orderedAvailablePool(availablePool) {
  cleanScratchCells(availablePool);
  const scratchKeys = new Set(state.scratchCells.filter(Boolean));
  const byKey = new Map(
    availablePool
      .filter((cell) => !scratchKeys.has(cellKey(cell)))
      .map((cell) => [cellKey(cell), cell])
  );
  const ordered = [];
  state.poolOrder.forEach((key) => {
    const cell = byKey.get(key);
    if (cell) {
      ordered.push(cell);
      byKey.delete(key);
    }
  });
  const remaining = Array.from(byKey.values()).sort((left, right) => {
    return left.letter.localeCompare(right.letter) || left.index - right.index;
  });
  return ordered.concat(remaining);
}

function groupedAvailableCells(availablePool) {
  const grouped = new Map();
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter) => grouped.set(letter, []));
  orderedAvailablePool(availablePool).forEach((cell) => {
    if (grouped.has(cell.letter)) {
      grouped.get(cell.letter).push(cell);
    }
  });
  return Array.from(grouped.entries()).filter(([, cells]) => cells.length);
}

function createPoolTile(poolCell, source, slotIndex = "") {
  const cell = document.createElement("button");
  cell.className = "live-pool-cell";
  cell.type = "button";
  cell.draggable = true;
  cell.dataset.key = cellKey(poolCell);
  cell.dataset.source = source;
  if (slotIndex !== "") {
    cell.dataset.slot = String(slotIndex);
  }
  cell.innerHTML = `<span class="pool-cell-number">${poolCell.index}</span><span class="pool-cell-letter">${poolCell.letter}</span>`;
  return cell;
}

function renderAvailablePoolPanel() {
  if (!elements.availablePool) return;
  const { availablePool } = buildAssignments();
  const groups = groupedAvailableCells(availablePool);
  const byKey = availableCellMap(availablePool);
  elements.availablePool.innerHTML = "";

  const poolList = document.createElement("div");
  poolList.className = "available-pool-list";
  groups.forEach(([, poolCells]) => {
    const group = document.createElement("div");
    group.className = "live-pool-letter-group";
    const cells = document.createElement("div");
    cells.className = "live-pool-cells";
    poolCells.forEach((poolCell) => {
      cells.append(createPoolTile(poolCell, "pool"));
    });
    group.append(cells);
    poolList.append(group);
  });

  const scratch = document.createElement("div");
  scratch.className = "pool-scratch";
  scratch.setAttribute("aria-label", "Scratch area");
  state.scratchCells.forEach((key, index) => {
    const slot = document.createElement("div");
    slot.className = "scratch-slot";
    slot.dataset.slot = String(index);
    if (key && byKey.has(key)) {
      slot.append(createPoolTile(byKey.get(key), "scratch", index));
    }
    scratch.append(slot);
  });

  elements.availablePool.append(poolList, scratch);
  attachPoolDragHandlers();
}

function removeFromScratch(key) {
  state.scratchCells = state.scratchCells.map((slotKey) => (slotKey === key ? null : slotKey));
}

function placeInScratch(key, slotIndex) {
  if (!key || slotIndex < 0 || slotIndex >= state.scratchCells.length) return;
  removeFromScratch(key);
  state.scratchCells[slotIndex] = key;
}

function returnToPool(key) {
  removeFromScratch(key);
}

function attachPoolDragHandlers() {
  elements.availablePool.querySelectorAll(".live-pool-cell").forEach((cell) => {
    cell.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", cell.dataset.key);
      event.dataTransfer.setData("application/x-source", cell.dataset.source || "pool");
      event.dataTransfer.effectAllowed = "move";
    });
  });

  elements.availablePool.querySelectorAll(".scratch-slot").forEach((slot) => {
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      const key = event.dataTransfer.getData("text/plain");
      const slotIndex = Number(slot.dataset.slot);
      placeInScratch(key, slotIndex);
      renderAvailablePoolPanel();
    });
  });

  const poolList = elements.availablePool.querySelector(".available-pool-list");
  if (poolList) {
    poolList.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    poolList.addEventListener("drop", (event) => {
      event.preventDefault();
      const key = event.dataTransfer.getData("text/plain");
      returnToPool(key);
      renderAvailablePoolPanel();
    });
  }
}

function renderPrintSheet() {
  if (!elements.printSheet) return;
  readSetup();
  const cells = quoteCells(state.quote);
  const assignments = buildAssignments();

  elements.printSheet.innerHTML = "";

  const title = document.createElement("div");
  title.className = "print-title";
  // const headingGroup = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent = state.puzzleTitle || state.title || "Untitled Acrostic";
  // const byline = document.createElement("p");
  // byline.textContent = state.author ? `Source: ${state.author}` : "Source";
  // headingGroup.append(heading, byline);
  // const meta = document.createElement("p");
  // meta.textContent = `${cellLetters().length} letters`;
  // title.append(headingGroup, meta);

  const grid = document.createElement("div");
  grid.className = "print-grid";
  grid.style.setProperty("--columns", state.columns);
  cells.forEach((cell) => {
    if (cell.type !== "skip") {
      const node = document.createElement("div");
      node.className = cell.type === "black" ? "print-cell black" : cell.type === "dash" ? "print-cell dash" : "print-cell";
      if (cell.type === "letter") {
        const number = document.createElement("span");
        number.className = "print-cell-number";
        number.textContent = cell.index;
        const clueMarker = document.createElement("span");
        clueMarker.className = "print-cell-clue";
        clueMarker.textContent = assignments.byCell.get(cell.index)?.label || "";
        const letter = document.createElement("span");
        letter.textContent = elements.fillGridPrint?.checked ? cell.letter : "";
        node.append(number, clueMarker, letter);
      } else if (cell.type === "dash") {
        const dash = document.createElement("span");
        dash.textContent = cell.letter;
        node.append(dash);
      }
      grid.append(node);
    }
  });

  const clues = document.createElement("div");
  clues.className = "print-clues";
  state.clues.forEach((clue, index) => {
    const clueBlock = document.createElement("div");
    clueBlock.className = "print-clue";

    const clueLine = document.createElement("div");
    clueLine.className = "print-clue-line";
    const label = document.createElement("span");
    label.className = "print-clue-label";
    label.textContent = `${clueLabel(index)}.`;

    const clueBody = document.createElement("span");
    clueBody.className = "print-clue-body";
    const clueText = document.createElement("span");
    clueText.className = "print-clue-text";
    clueText.textContent = clue.clue || "";
    const leader = document.createElement("span");
    leader.className = "dot-leader";
    clueBody.append(clueText, leader);

    const blanks = document.createElement("div");
    blanks.className = "answer-blanks";
    const cellNumbers = assignments.byClue.get(index) || [];
    const answer = answerLetters(clue.answer);
    cellNumbers.forEach((cellNumber, slotIndex) => {
      const unit = document.createElement("span");
      unit.className = "answer-unit";
      const line = document.createElement("span");
      line.className = "answer-line";
      line.textContent = elements.fillAnswersPrint?.checked && answer[slotIndex] ? answer[slotIndex] : "___";
      const number = document.createElement("span");
      number.className = "answer-cell-number";
      number.textContent = cellNumber;
      unit.append(line, number);
      blanks.append(unit);
    });

    clueLine.append(label, clueBody, blanks);
    clueBlock.append(clueLine);
    clues.append(clueBlock);
  });

  const body = document.createElement("div");
  body.className = "print-lower-layout";
  body.append(clues, renderAvailablePool(assignments.availablePool));

  elements.printSheet.append(title, grid, body);
}

function showPrintPreview() {
  renderPrintSheet();
  elements.printPreviewPanel.hidden = false;
  elements.printPreviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function printCurrentPuzzle() {
  renderPrintSheet();
  elements.printPreviewPanel.hidden = false;
  window.print();
}

function setCurrentFile(fileHandle, fileName) {
  state.fileHandle = fileHandle;
  state.fileName = fileName || "Untitled puzzle";
  elements.currentFileName.textContent = state.fileName;
}

function firstString(...values) {
  const value = values.find((candidate) => typeof candidate === "string" && candidate.trim());
  return value ? value.trim() : "";
}

function firstNumber(...values) {
  const value = values.find((candidate) => Number.isFinite(Number(candidate)));
  return value === undefined ? undefined : Number(value);
}

function normalizeClues(rawClues) {
  if (!Array.isArray(rawClues)) return [];
  return rawClues.map((clue) => {
    if (typeof clue === "string") {
      return {
        requiredInitial: "",
        answer: "",
        clue,
        length: state.minLength
      };
    }
    if (!clue || typeof clue !== "object") {
      return {
        requiredInitial: "",
        answer: "",
        clue: "",
        length: state.minLength
      };
    }
    return {
      requiredInitial: firstString(clue.requiredInitial, clue.initial, clue.letter),
      answer: firstString(clue.answer, clue.answerText, clue.word, clue.solution),
      clue: firstString(clue.clue, clue.clueText, clue.text, clue.prompt, clue.question),
      length: firstNumber(clue.length, clue.len) || state.minLength,
      cellNumbers: Array.isArray(clue.cellNumbers) ? clue.cellNumbers : []
    };
  });
}

function normalizePuzzleFile(raw) {
  const puzzle = raw?.puzzle || raw?.data || raw?.acrostic || raw;
  if (!puzzle || typeof puzzle !== "object" || Array.isArray(puzzle)) {
    throw new Error("This JSON does not look like an acrostic puzzle file.");
  }

  const source = puzzle.source || {};
  const metadata = puzzle.metadata || {};
  const author = firstString(puzzle.author, puzzle.authorName, source.author, metadata.author, puzzle.byline);
  const title = firstString(puzzle.title, puzzle.bookTitle, puzzle.book, puzzle.work, source.title, source.bookTitle, metadata.title);
  const puzzleTitle = firstString(puzzle.puzzleTitle, puzzle.name, metadata.puzzleTitle, metadata.name);
  const quote = firstString(puzzle.quote, puzzle.quoteText, puzzle.quotation, puzzle.quotationText, puzzle.text, source.quote, metadata.quote);
  const clues = normalizeClues(puzzle.clues || puzzle.answers || puzzle.entries || []);
  const columns = firstNumber(puzzle.columns, puzzle.gridColumns, puzzle.cols) || 27;
  const minLength = firstNumber(puzzle.minLength, puzzle.minimumAnswerLength, puzzle.minAnswerLength) || 4;

  if (!author && !title && !quote && !clues.length) {
    throw new Error("No author, title, quote, or clues were found in this file.");
  }

  return {
    author,
    title,
    puzzleTitle,
    quote,
    columns,
    minLength,
    clues
  };
}

function loadPuzzleFromText(text, fileMeta = {}) {
  const raw = JSON.parse(text);
  const puzzle = normalizePuzzleFile(raw);
  loadPuzzle(puzzle, fileMeta);
}

function loadPuzzle(puzzle, fileMeta = {}) {
  elements.author.value = puzzle.author || "";
  elements.title.value = puzzle.title || "";
  elements.puzzleTitle.value = puzzle.puzzleTitle || "";
  elements.quote.value = puzzle.quote || "";
  elements.columns.value = puzzle.columns || 27;
  elements.minLength.value = puzzle.minLength || 4;
  readSetup();
  state.poolOrder = [];
  state.scratchCells = Array(60).fill(null);
  state.clues = (puzzle.clues || []).map((clue, index) => ({
    requiredInitial: state.initials[index] || clue.requiredInitial || "",
    answer: clue.answer || "",
    clue: clue.clue || "",
    length: Number(clue.length) || state.minLength,
    cellNumbers: Array.isArray(clue.cellNumbers) ? clue.cellNumbers : []
  }));
  ensureClueRows();
  renderGrid();
  renderAvailablePoolPanel();
  renderClues();
  renderStatus();
  renderPrintSheet();
  setCurrentFile(fileMeta.fileHandle || null, fileMeta.fileName || "Untitled puzzle");
}

function setFileMenu(open) {
  elements.fileMenu.hidden = !open;
  elements.fileMenuButton.setAttribute("aria-expanded", String(open));
}

function toggleFileMenu() {
  setFileMenu(elements.fileMenu.hidden);
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  update(true);
});

[elements.author, elements.title, elements.puzzleTitle, elements.quote, elements.columns, elements.minLength].forEach((input) => {
  input.addEventListener("input", () => update(true));
});

elements.balanceLengths.addEventListener("click", suggestLengths);

elements.clearAnswers.addEventListener("click", () => {
  state.clues.forEach((clue) => {
    clue.answer = "";
    clue.clue = "";
    clue.length = state.minLength;
  });
  update(false);
});

elements.fileMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleFileMenu();
});

elements.openPuzzle.addEventListener("click", async () => {
  setFileMenu(false);
  try {
    await openPuzzleFromFileSystem();
  } catch (error) {
    if (error.name !== "AbortError") {
      window.alert(`Could not open puzzle: ${error.message}`);
    }
  }
});

elements.savePuzzle.addEventListener("click", async () => {
  setFileMenu(false);
  try {
    await savePuzzle(true);
  } catch (error) {
    if (error.name !== "AbortError") {
      window.alert(`Could not save puzzle: ${error.message}`);
    }
  }
});

elements.saveAsPuzzle.addEventListener("click", async () => {
  setFileMenu(false);
  try {
    await savePuzzle(false);
  } catch (error) {
    if (error.name !== "AbortError") {
      window.alert(`Could not save puzzle: ${error.message}`);
    }
  }
});

elements.printPreview.addEventListener("click", () => {
  setFileMenu(false);
  showPrintPreview();
});

elements.printPuzzle.addEventListener("click", () => {
  setFileMenu(false);
  printCurrentPuzzle();
});

elements.closePrintPreview.addEventListener("click", () => {
  elements.printPreviewPanel.hidden = true;
});

elements.printFromPreview.addEventListener("click", printCurrentPuzzle);
elements.fillAnswersPrint.addEventListener("change", renderPrintSheet);
elements.fillGridPrint.addEventListener("change", renderPrintSheet);

elements.resetPool.addEventListener("click", () => {
  state.poolOrder = [];
  state.scratchCells = Array(60).fill(null);
  renderAvailablePoolPanel();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".file-menu")) {
    setFileMenu(false);
  }
});

elements.importPuzzle.addEventListener("change", async () => {
  const file = elements.importPuzzle.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    loadPuzzleFromText(text, { fileName: file.name });
  } catch (error) {
    window.alert(`Could not import puzzle: ${error.message}`);
  } finally {
    elements.importPuzzle.value = "";
  }
});

elements.loadSample.addEventListener("click", () => loadPuzzle(samplePuzzle));

update(true);
