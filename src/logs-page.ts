// =====================================================================
// Start-up for logs.html: turns the session log into table rows, and
// shows the steps of the session you click.
//
// The table itself (search, filters, sorting, columns, pages) is in table.ts.
// =====================================================================

import { SESSION_TIMEOUT_MS } from "./phone.js";
import { LOG_KEY, findSession, loadSessions, type SessionLog, type Status } from "./storage.js";
import { openTool, setRows, startTable, type Column, type Row } from "./table.js";

const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  completed: "Completed",
  timedOut: "Timed out",
  cancelled: "Cancelled",
};

/** The table columns. Each key is a field of the rows made by toRow(). */
const COLUMNS: Column[] = [
  { key: "id", label: "Session", type: "text", cell: sessionIdCell },
  { key: "phone", label: "Phone", type: "text" },
  { key: "code", label: "Code", type: "text" },
  { key: "started", label: "Started", type: "date" },
  { key: "duration", label: "Duration (s)", type: "number" },
  { key: "steps", label: "Steps", type: "number" },
  { key: "status", label: "Status", type: "text", cell: statusCell },
];

const stepsPanel = byId("stepsPanel");
let selectedId: string | null = null;

function start(): void {
  startTable(COLUMNS, handleRowClick);
  byId("refresh").addEventListener("click", refresh);
  window.addEventListener("storage", handleStorageChange);
  refresh();
}

/** Reads the log again and gives the table fresh rows. */
function refresh(): void {
  const sessionRows: Row[] = [];
  for (const session of loadSessions().reverse()) sessionRows.push(toRow(session)); // newest first
  setRows(sessionRows);
  if (selectedId !== null) showSteps(selectedId);
}

/** One session as a table row. */
function toRow(session: SessionLog): Row {
  const firstStep = session.steps[0];
  const status = currentStatus(session);
  const seconds = (Date.parse(lastActivity(session)) - Date.parse(session.startedAt)) / 1000;

  return {
    id: session.id,
    phone: session.phoneNumber,
    code: firstStep === undefined ? "" : firstStep.typed,
    started: localDateTime(session.startedAt),
    duration: Math.round(seconds),
    steps: session.steps.length,
    status: STATUS_LABELS[status],
    statusKey: status, // for the badge colour; not a column
  };
}

// ----- How some cells are drawn (used as `cell` in COLUMNS) -----

function sessionIdCell(row: Row): HTMLElement {
  const code = make("code", "session-id", String(row.id));
  code.title = String(row.id);
  return code;
}

function statusCell(row: Row): HTMLElement {
  return statusBadge(String(row.statusKey) as Status);
}

function statusBadge(status: Status): HTMLElement {
  return make("span", "status-badge status-" + status, STATUS_LABELS[status]);
}

// ----- The steps of one session, in the side panel -----

function handleRowClick(id: string): void {
  selectedId = id;
  showSteps(id);
  openTool("steps");
}

function showSteps(id: string): void {
  const session = findSession(loadSessions(), id);
  if (session === null) {
    stepsPanel.replaceChildren(make("p", "side-help", "This session is no longer in the log."));
    return;
  }

  const heading = make("div", "steps-heading", "");
  heading.append(make("code", "session-id", session.id), statusBadge(currentStatus(session)));

  const list = make("ol", "steps", "");
  for (const step of session.steps) {
    const item = make("li", "step", "");
    item.append(
      make("span", "step-time", formatClock(step.time)),
      make("p", "step-typed", "Typed " + step.typed),
      make("p", "step-reply", step.reply),
    );
    list.append(item);
  }

  const ended = session.endedAt === null ? "Not ended" : "Ended " + formatClock(session.endedAt);
  stepsPanel.replaceChildren(heading, list, make("p", "side-help", ended));
}

/** Fires when the phones page (in another tab) writes to the log. */
function handleStorageChange(event: StorageEvent): void {
  if (event.key === LOG_KEY) refresh();
}

// ----- Helpers -----

/**
 * A session whose tab was closed stays "active" in the log forever.
 * Show it as timed out once it has been quiet longer than the timeout.
 */
function currentStatus(session: SessionLog): Status {
  if (session.status !== "active") return session.status;
  return Date.now() - Date.parse(lastActivity(session)) > SESSION_TIMEOUT_MS ? "timedOut" : "active";
}

/** When the session ended, or else its last step, or else when it started. */
function lastActivity(session: SessionLog): string {
  if (session.endedAt !== null) return session.endedAt;
  const lastStep = session.steps[session.steps.length - 1];
  return lastStep === undefined ? session.startedAt : lastStep.time;
}

/**
 * "2026-11-09 08:54:12" in this computer's time zone. The Swedish ("sv-SE")
 * format happens to be exactly this, and it sorts in date order as text.
 */
function localDateTime(isoTime: string): string {
  return new Date(isoTime).toLocaleString("sv-SE");
}

/** "08:54:12" */
function formatClock(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString("en-GB");
}

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

start();
