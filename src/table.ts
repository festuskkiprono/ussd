// =====================================================================
// The sessions table on the logs page: search, filters, sorting,
// show/hide columns, chips under the table, and pages.
//
// logs-page.ts calls startTable() once with the columns, then setRows()
// every time the log changes. What the user has picked is kept in the
// variables below, and render() redraws the table from them.
// =====================================================================

export type ColumnType = "text" | "number" | "date";

/** One table row. Every row has an "id"; the other keys match the column keys. */
export type Row = Record<string, string | number>;

export interface Column {
  key: string;
  label: string;
  type: ColumnType;
  /** How to draw the cell. Leave it out to show the value as it is. */
  cell?: (row: Row) => string | HTMLElement;
}

/** An entry in a dropdown: the value the code uses, and the words shown. */
interface Choice {
  value: string;
  label: string;
}

/** The comparisons offered for each column type. */
const RELATIONS: Record<ColumnType, Choice[]> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "startsWith", label: "starts with" },
    { value: "endsWith", label: "ends with" },
    { value: "equals", label: "equals" },
    { value: "notContains", label: "does not contain" },
  ],
  number: [
    { value: "eq", label: "equal to" },
    { value: "gt", label: "more than" },
    { value: "lt", label: "less than" },
    { value: "gte", label: "at least" },
    { value: "lte", label: "at most" },
  ],
  date: [
    { value: "on", label: "on" },
    { value: "before", label: "before" },
    { value: "after", label: "after" },
  ],
};

const SORT_ORDERS: Choice[] = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

/** The heading of the side panel for each tool. */
const TOOL_TITLES: Record<string, string> = {
  search: "Search",
  filter: "Filters",
  sort: "Sorting",
  columns: "Columns",
  steps: "Session steps",
};

const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>';
const ICON_BIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
const ICON_ARROWS = '<svg class="up" viewBox="0 0 10 6"><path d="M5 0 10 6H0z"/></svg><svg class="down" viewBox="0 0 10 6"><path d="M0 0h10L5 6z"/></svg>';

// ----- What the user has picked -----

/** A condition every row must match. Made by the search form or a filter row. */
interface Filter {
  id: number;
  col: string;
  rel: string;
  value: string;
  source: "search" | "filter";
}

/** A card in the Filters panel. filterId is set once + is pressed. */
interface FilterRow {
  id: number;
  col: string;
  rel: string;
  value: string;
  filterId: number | null;
  error: string;
}

/** A card in the Sorting panel. Applied cards, top to bottom, are the sort order. */
interface SortRow {
  id: number;
  col: string;
  dir: string; // "asc" or "desc"
  applied: boolean;
  error: string;
}

let columns: Column[] = [];
let rows: Row[] = [];
let filters: Filter[] = [];
let filterRows: FilterRow[] = [];
let sortRows: SortRow[] = [];
const hiddenColumns = new Set<string>();
let tool: string | null = null; // the open side panel, or null
let page = 1;
let pageSize = 10;
let lastPage = 1;
let selectedId = "";
let nextId = 1;
let rowClickHandler: ((id: string) => void) | null = null;

// ----- The parts of logs.html this file changes -----

const colSelect = byId("colSelect") as HTMLSelectElement;
const relSelect = byId("relSelect") as HTMLSelectElement;
const valInput = byId("valInput") as HTMLInputElement;
const searchHint = byId("hint");
const filterBox = byId("filterRows");
const sortBox = byId("sortRows");
const headRow = byId("headRow");
const tbody = byId("tbody");
const statusText = byId("status");
const chips = byId("chips");
const colChecks = byId("colChecks");
const pageLabel = byId("pageLabel");
const pageSizeSelect = byId("pageSize") as HTMLSelectElement;
const firstButton = byId("firstBtn") as HTMLButtonElement;
const prevButton = byId("prevBtn") as HTMLButtonElement;
const nextButton = byId("nextBtn") as HTMLButtonElement;
const lastButton = byId("lastBtn") as HTMLButtonElement;

// ----- Used by logs-page.ts -----

export function startTable(tableColumns: Column[], onRowClick: (id: string) => void): void {
  columns = tableColumns;
  rowClickHandler = onRowClick;

  fillSelect(colSelect, columnChoices(), columns[0].key);
  syncSearchRelations();
  filterRows.push(newFilterRow());
  sortRows.push(newSortRow());

  colSelect.addEventListener("change", syncSearchRelations);
  byId("searchForm").addEventListener("submit", handleSearchSubmit);
  filterBox.addEventListener("input", handleFilterInput);
  filterBox.addEventListener("change", handleFilterChange);
  filterBox.addEventListener("keydown", handleFilterKeyDown);
  filterBox.addEventListener("click", handleFilterClick);
  sortBox.addEventListener("change", handleSortChange);
  sortBox.addEventListener("click", handleSortClick);
  headRow.addEventListener("click", handleHeaderClick);
  tbody.addEventListener("click", handleBodyClick);
  chips.addEventListener("click", handleChipClick);
  colChecks.addEventListener("change", handleColumnToggle);
  byId("showAllCols").addEventListener("click", showAllColumns);
  byId("tools").addEventListener("click", handleToolClick);
  byId("closeSide").addEventListener("click", closeTool);
  document.addEventListener("keydown", handleEscape);
  firstButton.addEventListener("click", goToFirstPage);
  prevButton.addEventListener("click", goToPreviousPage);
  nextButton.addEventListener("click", goToNextPage);
  lastButton.addEventListener("click", goToLastPage);
  pageSizeSelect.addEventListener("change", changePageSize);

  renderFilterRows();
  renderSortRows();
  applyTool();
  render();
}

/** New rows from the log. What the user picked (filters, sorting, page) stays. */
export function setRows(newRows: Row[]): void {
  rows = newRows;
  render();
}

/** Opens a side panel by name, e.g. "steps". */
export function openTool(name: string): void {
  tool = name;
  applyTool();
}

// ----- Search panel -----

/** The Column dropdown changed: offer that column type's relations. */
function syncSearchRelations(): void {
  const col = columnOf(colSelect.value);
  fillSelect(relSelect, RELATIONS[col.type], "");
  valInput.value = "";
  valInput.type = col.type === "date" ? "date" : "text";
  valInput.placeholder = placeholderFor(col);
  hideSearchHint();
}

function handleSearchSubmit(event: Event): void {
  event.preventDefault();
  const col = columnOf(colSelect.value);
  const raw = valInput.value.trim();

  const error = checkValue(col, raw);
  if (error !== "") {
    showSearchHint(error);
    return;
  }

  hideSearchHint();
  filters.push({ id: nextId++, col: col.key, rel: relSelect.value, value: raw, source: "search" });
  valInput.value = "";
  page = 1;
  render();
}

function showSearchHint(message: string): void {
  searchHint.textContent = message;
  searchHint.hidden = false;
  valInput.setAttribute("aria-invalid", "true");
  valInput.focus();
}

function hideSearchHint(): void {
  searchHint.hidden = true;
  valInput.removeAttribute("aria-invalid");
}

// ----- Filters panel -----

function renderFilterRows(): void {
  filterBox.replaceChildren();
  for (const row of filterRows) filterBox.append(makeFilterCard(row));
}

function makeFilterCard(row: FilterRow): HTMLElement {
  const col = columnOf(row.col);
  const applied = row.filterId !== null;

  const value = document.createElement("input");
  value.id = "fval-" + row.id;
  value.dataset.field = "value";
  value.type = col.type === "date" ? "date" : "text";
  value.placeholder = placeholderFor(col);
  value.value = row.value;
  value.autocomplete = "off";
  value.disabled = applied;
  if (row.error !== "") value.setAttribute("aria-invalid", "true");

  const card = make("div", applied ? "filter-row applied" : "filter-row", "");
  card.dataset.row = String(row.id);
  card.append(
    field("f-col", "Column", makeSelect("fcol-" + row.id, "col", columnChoices(), row.col, applied)),
    field("f-rel", "Rel", makeSelect("frel-" + row.id, "rel", RELATIONS[col.type], row.rel, applied)),
    field("f-val", "Value", value),
    rowButtons(applied, "filter"),
  );
  if (row.error !== "") card.append(make("p", "hint row-hint", row.error));
  return card;
}

/** Typing in a value box: keep it in the row so re-drawing never loses it. */
function handleFilterInput(event: Event): void {
  const row = findFilterRow(event.target);
  const input = event.target as HTMLInputElement;
  if (row === null || input.dataset.field !== "value") return;

  row.value = input.value;
  if (row.error !== "") {
    row.error = "";
    input.removeAttribute("aria-invalid");
    const hint = input.closest("[data-row]")?.querySelector(".row-hint");
    hint?.remove();
  }
}

/** A new column resets Rel and Value to fit that column's type. */
function handleFilterChange(event: Event): void {
  const row = findFilterRow(event.target);
  const select = event.target as HTMLSelectElement;
  if (row === null) return;

  if (select.dataset.field === "col") {
    row.col = select.value;
    row.rel = firstRelation(columnOf(row.col).type);
    row.value = "";
    row.error = "";
    renderFilterRows();
    focusById("fval-" + row.id);
  } else if (select.dataset.field === "rel") {
    row.rel = select.value;
  }
}

/** Enter in a value box works like the + button. */
function handleFilterKeyDown(event: KeyboardEvent): void {
  const row = findFilterRow(event.target);
  const input = event.target as HTMLElement;
  if (row === null || event.key !== "Enter" || input.dataset.field !== "value") return;
  event.preventDefault();
  addFilter(row);
}

function handleFilterClick(event: Event): void {
  const button = findActionButton(event.target);
  const row = findFilterRow(event.target);
  if (button === null || row === null) return;

  if (button.dataset.action === "add") addFilter(row);
  if (button.dataset.action === "delete") {
    removeFilterRow(row);
    page = 1;
    renderFilterRows();
    render();
  }
}

function addFilter(row: FilterRow): void {
  const raw = row.value.trim();
  const error = checkValue(columnOf(row.col), raw);
  if (error !== "") {
    row.error = error;
    renderFilterRows();
    focusById("fval-" + row.id);
    return;
  }

  const filter: Filter = { id: nextId++, col: row.col, rel: row.rel, value: raw, source: "filter" };
  filters.push(filter);
  row.value = raw;
  row.filterId = filter.id;
  row.error = "";

  const fresh = newFilterRow(); // an empty card for the next condition
  filterRows.push(fresh);
  page = 1;
  renderFilterRows();
  render();
  focusById("fval-" + fresh.id);
}

/** Removes a card and its filter. The last empty card is cleared instead, so there is always one to type in. */
function removeFilterRow(row: FilterRow): void {
  if (row.filterId !== null) removeFilter(row.filterId);

  if (row.filterId === null && countEmptyFilterRows() === 1) {
    row.col = columns[0].key;
    row.rel = firstRelation(columns[0].type);
    row.value = "";
    row.error = "";
    return;
  }

  filterRows = withoutItem(filterRows, row);
  if (countEmptyFilterRows() === 0) filterRows.push(newFilterRow());
}

function findFilterRow(target: EventTarget | null): FilterRow | null {
  if (!(target instanceof Element)) return null;
  const card = target.closest<HTMLElement>("[data-row]");
  if (card === null) return null;
  for (const row of filterRows) {
    if (String(row.id) === card.dataset.row) return row;
  }
  return null;
}

function newFilterRow(): FilterRow {
  return { id: nextId++, col: columns[0].key, rel: firstRelation(columns[0].type), value: "", filterId: null, error: "" };
}

function countEmptyFilterRows(): number {
  let count = 0;
  for (const row of filterRows) {
    if (row.filterId === null) count++;
  }
  return count;
}

function removeFilter(id: number): void {
  const kept: Filter[] = [];
  for (const filter of filters) {
    if (filter.id !== id) kept.push(filter);
  }
  filters = kept;
}

// ----- Sorting panel -----

function renderSortRows(): void {
  sortBox.replaceChildren();
  let appliedSoFar = 0;
  for (const row of sortRows) {
    sortBox.append(makeSortCard(row, appliedSoFar === 0 ? "Sort by" : "Then by"));
    if (row.applied) appliedSoFar++;
  }
}

function makeSortCard(row: SortRow, lead: string): HTMLElement {
  const order = makeSelect("sdir-" + row.id, "dir", SORT_ORDERS, row.dir, row.applied);
  if (row.error !== "") order.setAttribute("aria-invalid", "true");

  const card = make("div", row.applied ? "filter-row sort-row applied" : "filter-row sort-row", "");
  card.dataset.sortrow = String(row.id);
  card.append(
    make("span", "sort-lead", lead),
    field("f-col", "Column", makeSelect("scol-" + row.id, "col", columnChoices(), row.col, row.applied)),
    field("f-dir", "Order", order),
    rowButtons(row.applied, "sort"),
  );
  if (row.error !== "") card.append(make("p", "hint row-hint", row.error));
  return card;
}

function handleSortChange(event: Event): void {
  const row = findSortRow(event.target);
  const select = event.target as HTMLSelectElement;
  if (row === null) return;

  if (select.dataset.field === "col") row.col = select.value;
  if (select.dataset.field === "dir") row.dir = select.value;
  if (row.error !== "") {
    row.error = "";
    renderSortRows();
  }
}

function handleSortClick(event: Event): void {
  const button = findActionButton(event.target);
  const row = findSortRow(event.target);
  if (button === null || row === null) return;

  if (button.dataset.action === "add") addSort(row);
  if (button.dataset.action === "delete") {
    removeSortRow(row);
    renderSortRows();
    render();
  }
}

function addSort(row: SortRow): void {
  // A column can only be sorted once; a second sort on it would never be used.
  if (findSortRule(row.col) !== null) {
    row.error = "Already sorting by " + columnOf(row.col).label + ". Pick another column, or remove that sort first.";
    renderSortRows();
    return;
  }
  row.applied = true;
  row.error = "";
  sortRows.push(newSortRow());
  renderSortRows();
  render();
}

/** Removes a card. The last empty card is cleared instead. */
function removeSortRow(row: SortRow): void {
  if (!row.applied && countEmptySortRows() === 1) {
    row.col = columns[0].key;
    row.dir = "asc";
    row.error = "";
    return;
  }
  sortRows = withoutItem(sortRows, row);
  if (countEmptySortRows() === 0) sortRows.push(newSortRow());
}

function findSortRow(target: EventTarget | null): SortRow | null {
  if (!(target instanceof Element)) return null;
  const card = target.closest<HTMLElement>("[data-sortrow]");
  if (card === null) return null;
  for (const row of sortRows) {
    if (String(row.id) === card.dataset.sortrow) return row;
  }
  return null;
}

function newSortRow(): SortRow {
  return { id: nextId++, col: columns[0].key, dir: "asc", applied: false, error: "" };
}

function countEmptySortRows(): number {
  let count = 0;
  for (const row of sortRows) {
    if (!row.applied) count++;
  }
  return count;
}

/** The applied sort cards, in order. The header arrows and the Sorting panel both use these. */
function sortRules(): SortRow[] {
  const rules: SortRow[] = [];
  for (const row of sortRows) {
    if (row.applied) rules.push(row);
  }
  return rules;
}

function findSortRule(key: string): SortRow | null {
  for (const rule of sortRules()) {
    if (rule.col === key) return rule;
  }
  return null;
}

/** A header click: flip a column that is already sorted, or sort by just this column. */
function handleHeaderClick(event: Event): void {
  if (!(event.target instanceof Element)) return;
  const key = event.target.closest<HTMLElement>(".sort-btn")?.dataset.key;
  if (key === undefined) return;

  const existing = findSortRule(key);
  if (existing !== null) {
    existing.dir = existing.dir === "asc" ? "desc" : "asc";
  } else {
    sortRows = [{ id: nextId++, col: key, dir: "asc", applied: true, error: "" }, newSortRow()];
  }
  renderSortRows();
  render();
}

// ----- Which rows pass, and in what order -----

function passesFilters(row: Row): boolean {
  for (const filter of filters) {
    if (!passes(row, filter)) return false;
  }
  return true;
}

function passes(row: Row, filter: Filter): boolean {
  const col = columnOf(filter.col);
  const value = row[filter.col];

  if (col.type === "number") return compareNumber(filter.rel, Number(value), toNumber(filter.value));
  if (col.type === "date") return compareDate(filter.rel, String(value).slice(0, 10), filter.value);
  return compareText(filter.rel, String(value).toLowerCase(), filter.value.toLowerCase());
}

function compareText(rel: string, value: string, query: string): boolean {
  switch (rel) {
    case "contains": return value.includes(query);
    case "notContains": return !value.includes(query);
    case "startsWith": return value.startsWith(query);
    case "endsWith": return value.endsWith(query);
    case "equals": return value === query;
  }
  return false;
}

function compareNumber(rel: string, value: number, query: number): boolean {
  switch (rel) {
    case "eq": return value === query;
    case "gt": return value > query;
    case "lt": return value < query;
    case "gte": return value >= query;
    case "lte": return value <= query;
  }
  return false;
}

/** Dates are compared as "2026-11-09" text, which sorts the same as the dates do. */
function compareDate(rel: string, day: string, query: string): boolean {
  switch (rel) {
    case "on": return day === query;
    case "before": return day < query;
    case "after": return day > query;
  }
  return false;
}

/** Used by Array.sort. The first rule decides; later rules break ties. */
function compareRows(a: Row, b: Row): number {
  for (const rule of sortRules()) {
    const result = compareValues(a[rule.col], b[rule.col]);
    if (result !== 0) return rule.dir === "asc" ? result : -result;
  }
  return 0;
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

// ----- Drawing the table -----

function render(): void {
  const matching = rows.filter(passesFilters);
  const sorted = matching.slice().sort(compareRows);

  lastPage = Math.max(1, Math.ceil(sorted.length / pageSize));
  page = Math.min(page, lastPage);
  const start = (page - 1) * pageSize;

  renderHead();
  renderBody(sorted.slice(start, start + pageSize));
  renderStatus(sorted.length);
  renderChips();
  renderPager();
  renderBadges();
  renderColumnChecks();
}

function renderHead(): void {
  headRow.replaceChildren();
  const rules = sortRules();

  for (const col of visibleColumns()) {
    const rule = findSortRule(col.key);
    const level = rule === null ? -1 : rules.indexOf(rule);

    const th = make("th", col.type === "number" ? "num" : "", "");
    th.setAttribute("aria-sort", rule === null ? "none" : rule.dir === "asc" ? "ascending" : "descending");

    const button = makeButton("sort-btn", col.label);
    button.dataset.key = col.key;
    if (level !== -1 && rules.length > 1) button.append(make("span", "sort-priority", String(level + 1)));
    const arrows = make("span", "arrows", "");
    arrows.innerHTML = ICON_ARROWS;
    button.append(arrows);

    th.append(button);
    headRow.append(th);
  }
}

function renderBody(pageRows: Row[]): void {
  tbody.replaceChildren();
  const shown = visibleColumns();

  if (pageRows.length === 0) {
    const message = rows.length === 0
      ? "No sessions yet. Dial *144# on a phone to create one."
      : "No sessions match these filters. Remove a filter to see more.";
    const cell = make("td", "", message);
    cell.setAttribute("colspan", String(shown.length));
    const tr = make("tr", "empty", "");
    tr.append(cell);
    tbody.append(tr);
    return;
  }

  for (const row of pageRows) {
    const tr = make("tr", "", "");
    tr.dataset.id = String(row.id);
    tr.setAttribute("aria-selected", String(String(row.id) === selectedId));
    for (const col of shown) {
      const cell = make("td", col.type === "number" ? "num" : "", "");
      cell.append(col.cell === undefined ? String(row[col.key]) : col.cell(row));
      tr.append(cell);
    }
    tbody.append(tr);
  }
}

/** Clicking a session row selects it and tells logs-page.ts. */
function handleBodyClick(event: Event): void {
  if (!(event.target instanceof Element)) return;
  const id = event.target.closest<HTMLElement>("tr[data-id]")?.dataset.id;
  if (id === undefined) return;

  selectedId = id;
  render();
  if (rowClickHandler !== null) rowClickHandler(id);
}

function renderStatus(matchCount: number): void {
  let text = filters.length === 0
    ? "Showing all " + rows.length + " sessions."
    : "Showing " + matchCount + " of " + rows.length + " sessions matching " + (filters.length === 1 ? "this filter." : "all " + filters.length + " filters.");

  const rules = sortRules();
  if (rules.length > 0) {
    const words: string[] = [];
    for (const rule of rules) {
      words.push(columnOf(rule.col).label + " (" + (rule.dir === "asc" ? "ascending" : "descending") + ")");
    }
    text += " Sorted by " + words.join(", then ") + ".";
  }
  statusText.textContent = text;
}

// ----- Chips under the table: each × removes what it shows -----

function renderChips(): void {
  chips.replaceChildren();
  for (const filter of filters) chips.append(makeFilterChip(filter));
  for (const rule of sortRules()) chips.append(makeSortChip(rule));
  for (const col of columns) {
    if (hiddenColumns.has(col.key)) chips.append(makeHiddenChip(col));
  }

  if (filters.length + sortRules().length + hiddenColumns.size > 1) {
    const clear = makeButton("clear-all", "Clear all");
    clear.dataset.clear = "true";
    chips.append(clear);
  }
}

function makeFilterChip(filter: Filter): HTMLElement {
  const col = columnOf(filter.col);
  const id = String(filter.id);
  const chip = make("span", "chip", "");
  chip.append(
    make("span", "chip-tag", filter.source === "search" ? "Search" : "Filter"),
    chipPart("Column", col.label, "remove", id),
    chipPart("Relationship", relationLabel(col.type, filter.rel), "remove", id),
    chipPart("Value", filter.value, "remove", id),
  );
  return chip;
}

function makeSortChip(rule: SortRow): HTMLElement {
  const id = String(rule.id);
  const chip = make("span", "chip", "");
  chip.append(
    make("span", "chip-tag", "Sort"),
    chipPart("Column", columnOf(rule.col).label, "removeSort", id),
    chipPart("Order", rule.dir === "asc" ? "Ascending" : "Descending", "removeSort", id),
  );
  return chip;
}

function makeHiddenChip(col: Column): HTMLElement {
  const chip = make("span", "chip", "");
  chip.append(make("span", "chip-tag", "Hidden"), chipPart("Column", col.label, "showCol", col.key));
  return chip;
}

/** One clickable part of a chip: "COLUMN Phone ×". The data attribute says what clicking removes. */
function chipPart(key: string, value: string, dataName: string, dataValue: string): HTMLButtonElement {
  const button = makeButton("", "");
  button.dataset[dataName] = dataValue;
  button.title = "Remove";
  const cross = make("span", "x", "×");
  cross.setAttribute("aria-hidden", "true");
  button.append(make("span", "k", key), value, cross);
  return button;
}

function handleChipClick(event: Event): void {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>("button");
  if (button === null) return;

  const data = button.dataset;
  if (data.remove !== undefined) removeFilterById(Number(data.remove));
  else if (data.removeSort !== undefined) removeSortById(Number(data.removeSort));
  else if (data.showCol !== undefined) hiddenColumns.delete(data.showCol);
  else if (data.clear !== undefined) clearAll();

  page = 1;
  renderFilterRows();
  renderSortRows();
  render();
}

/** A filter chip came from a filter card: remove the card too. A search chip has no card. */
function removeFilterById(id: number): void {
  for (const row of filterRows) {
    if (row.filterId === id) {
      removeFilterRow(row);
      return;
    }
  }
  removeFilter(id);
}

function removeSortById(id: number): void {
  for (const row of sortRows) {
    if (row.id === id) {
      removeSortRow(row);
      return;
    }
  }
}

function clearAll(): void {
  filters = [];
  filterRows = [newFilterRow()];
  sortRows = [newSortRow()];
  hiddenColumns.clear();
}

// ----- Pages -----

function renderPager(): void {
  pageLabel.textContent = "Page " + page + " of " + lastPage;
  firstButton.disabled = page === 1;
  prevButton.disabled = page === 1;
  nextButton.disabled = page === lastPage;
  lastButton.disabled = page === lastPage;
}

function goToFirstPage(): void {
  page = 1;
  render();
}

function goToPreviousPage(): void {
  page--;
  render();
}

function goToNextPage(): void {
  page++;
  render();
}

function goToLastPage(): void {
  page = lastPage;
  render();
}

function changePageSize(): void {
  pageSize = Number(pageSizeSelect.value);
  page = 1;
  render();
}

// ----- Columns panel -----

function visibleColumns(): Column[] {
  const shown: Column[] = [];
  for (const col of columns) {
    if (!hiddenColumns.has(col.key)) shown.push(col);
  }
  return shown;
}

function renderColumnChecks(): void {
  const shownCount = visibleColumns().length;
  byId("colCount").textContent = shownCount + "/" + columns.length;

  colChecks.replaceChildren();
  for (const col of columns) {
    const visible = !hiddenColumns.has(col.key);
    const isLast = visible && shownCount === 1; // at least one column stays on screen

    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = "colvis-" + col.key;
    box.dataset.col = col.key;
    box.checked = visible;
    box.disabled = isLast;

    const label = make("label", isLast ? "col-check locked" : "col-check", "");
    if (isLast) label.title = "At least one column must stay visible";
    label.append(box, col.label);
    colChecks.append(label);
  }
  byId("showAllCols").hidden = hiddenColumns.size === 0;
}

function handleColumnToggle(event: Event): void {
  const box = event.target as HTMLInputElement;
  const key = box.dataset.col;
  if (key === undefined) return;

  if (box.checked) hiddenColumns.delete(key);
  else hiddenColumns.add(key);
  render();
  focusById("colvis-" + key); // keep focus in the list after it is re-drawn
}

function showAllColumns(): void {
  hiddenColumns.clear();
  render();
}

// ----- Tool buttons and the side panel -----

function applyTool(): void {
  byId("sidePanel").hidden = tool === null;
  byId("workspace").classList.toggle("has-side", tool !== null);

  for (const button of document.querySelectorAll<HTMLElement>(".tool-btn")) {
    button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
  }
  for (const panel of document.querySelectorAll<HTMLElement>("[data-tool-panel]")) {
    panel.hidden = panel.dataset.toolPanel !== tool;
  }
  if (tool !== null) byId("sideTitle").textContent = TOOL_TITLES[tool] ?? tool;
}

/** Clicking a tool opens its panel; clicking the open tool again closes it. */
function handleToolClick(event: Event): void {
  if (!(event.target instanceof Element)) return;
  const name = event.target.closest<HTMLElement>(".tool-btn")?.dataset.tool;
  if (name === undefined) return;

  tool = tool === name ? null : name;
  applyTool();

  const panel = document.querySelector<HTMLElement>('[data-tool-panel="' + tool + '"]');
  panel?.querySelector<HTMLElement>("input, select, button")?.focus();
}

function closeTool(): void {
  const wasOpen = tool;
  tool = null;
  applyTool();
  document.querySelector<HTMLElement>('.tool-btn[data-tool="' + wasOpen + '"]')?.focus();
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key === "Escape" && tool !== null) closeTool();
}

/** The counts on the tool buttons, so active conditions show even with the panel closed. */
function renderBadges(): void {
  let searches = 0;
  for (const filter of filters) {
    if (filter.source === "search") searches++;
  }
  setBadge("badgeSearch", searches);
  setBadge("badgeFilter", filters.length - searches);
  setBadge("badgeSort", sortRules().length);
}

function setBadge(id: string, count: number): void {
  const badge = byId(id);
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

// ----- Small helpers -----

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) throw new Error("logs.html needs an element with id=" + id);
  return element;
}

function make(tag: string, className: string, text: string): HTMLElement {
  const element = document.createElement(tag);
  if (className !== "") element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function makeButton(className: string, text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  if (className !== "") button.className = className;
  if (text !== "") button.textContent = text;
  return button;
}

function makeSelect(id: string, fieldName: string, choices: Choice[], selected: string, disabled: boolean): HTMLSelectElement {
  const select = document.createElement("select");
  select.id = id;
  select.dataset.field = fieldName;
  select.disabled = disabled;
  fillSelect(select, choices, selected);
  return select;
}

function fillSelect(select: HTMLSelectElement, choices: Choice[], selected: string): void {
  select.replaceChildren();
  for (const choice of choices) {
    select.append(new Option(choice.label, choice.value, false, choice.value === selected));
  }
}

/** A small label above a dropdown or input. */
function field(className: string, labelText: string, control: HTMLElement): HTMLElement {
  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = labelText;
  const box = make("div", "field " + className, "");
  box.append(label, control);
  return box;
}

/** The + (or ✓ once applied) and bin buttons on a filter or sort card. */
function rowButtons(applied: boolean, noun: string): HTMLElement {
  const add = makeButton("icon-btn add", "");
  add.dataset.action = "add";
  add.disabled = applied;
  add.innerHTML = applied ? ICON_TICK : ICON_PLUS;
  add.title = applied ? "Applied" : "Add " + noun;
  add.setAttribute("aria-label", add.title);

  const bin = makeButton("icon-btn bin", "");
  bin.dataset.action = "delete";
  bin.innerHTML = ICON_BIN;
  bin.title = "Remove " + noun;
  bin.setAttribute("aria-label", bin.title);

  const box = make("div", "row-actions", "");
  box.append(add, bin);
  return box;
}

function findActionButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[data-action]");
}

function columnOf(key: string): Column {
  for (const col of columns) {
    if (col.key === key) return col;
  }
  throw new Error("No column called " + key);
}

function columnChoices(): Choice[] {
  const choices: Choice[] = [];
  for (const col of columns) choices.push({ value: col.key, label: col.label });
  return choices;
}

function firstRelation(type: ColumnType): string {
  return RELATIONS[type][0].value;
}

function relationLabel(type: ColumnType, rel: string): string {
  for (const choice of RELATIONS[type]) {
    if (choice.value === rel) return choice.label;
  }
  return rel;
}

function placeholderFor(col: Column): string {
  if (col.type === "number") return "e.g. 30";
  if (col.type === "text") return "e.g. " + col.label.toLowerCase();
  return "";
}

/** An error message for a value, or "" when it is fine. */
function checkValue(col: Column, raw: string): string {
  if (raw === "") return "Enter a value.";
  if (col.type === "number" && isNaN(toNumber(raw))) return col.label + " needs a number, like 30.";
  return "";
}

/** "1,500" → 1500 */
function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function withoutItem<T>(list: T[], item: T): T[] {
  const kept: T[] = [];
  for (const entry of list) {
    if (entry !== item) kept.push(entry);
  }
  return kept;
}

function focusById(id: string): void {
  document.getElementById(id)?.focus();
}
