// =====================================================================
// Everything kept in the browser (localStorage):
//   - the session log, read by the logs page
//   - the withdrawals, read by the mini statement
// =====================================================================

export type Status = "active" | "completed" | "timedOut" | "cancelled";

/** One thing the user typed and what the phone showed back. */
export interface Step {
  time: string;  // ISO time
  typed: string; // "*144#", "2", "0711222333"
  reply: string; // the screen text that came back
}

export interface SessionLog {
  id: string;
  phoneNumber: string;
  status: Status;
  startedAt: string;
  endedAt: string | null;
  steps: Step[];
}

export interface Withdrawal {
  phoneNumber: string;
  amount: number;
  recipient: string | null; // null = to the user's own number
  time: string;
}

/** The logs page listens for changes to this key to refresh itself. */
export const LOG_KEY = "ussd-simple:log";
const WITHDRAWALS_KEY = "ussd-simple:withdrawals";
const MAX_SESSIONS = 200; // older sessions are dropped

// ----- Reading and writing a list -----

function readList<T>(key: string): T[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(list) ? (list as T[]) : [];
  } catch {
    return []; // the saved text was broken; start again
  }
}

function writeList(key: string, list: unknown[]): void {
  localStorage.setItem(key, JSON.stringify(list));
}

function now(): string {
  return new Date().toISOString();
}

// ----- Session log -----

/** All sessions, oldest first. */
export function loadSessions(): SessionLog[] {
  return readList<SessionLog>(LOG_KEY);
}

export function findSession(sessions: SessionLog[], id: string): SessionLog | null {
  for (const session of sessions) {
    if (session.id === id) return session;
  }
  return null;
}

export function logStart(id: string, phoneNumber: string): void {
  const sessions = loadSessions();
  sessions.push({ id, phoneNumber, status: "active", startedAt: now(), endedAt: null, steps: [] });
  while (sessions.length > MAX_SESSIONS) sessions.shift();
  writeList(LOG_KEY, sessions);
}

export function logStep(id: string, typed: string, reply: string): void {
  const sessions = loadSessions();
  const session = findSession(sessions, id);
  if (session === null) return;

  session.steps.push({ time: now(), typed, reply });
  writeList(LOG_KEY, sessions);
}

/** Records how a session ended. A session that already ended is left alone. */
export function logEnd(id: string, status: Status): void {
  const sessions = loadSessions();
  const session = findSession(sessions, id);
  if (session === null || session.status !== "active") return;

  session.status = status;
  session.endedAt = now();
  writeList(LOG_KEY, sessions);
}

// ----- Withdrawals -----

export function saveWithdrawal(phoneNumber: string, amount: number, recipient: string | null): void {
  const withdrawals = readList<Withdrawal>(WITHDRAWALS_KEY);
  withdrawals.push({ phoneNumber, amount, recipient, time: now() });
  writeList(WITHDRAWALS_KEY, withdrawals);
}

/** This phone's newest withdrawals, newest first. */
export function lastWithdrawals(phoneNumber: string, count: number): Withdrawal[] {
  const mine: Withdrawal[] = [];
  for (const withdrawal of readList<Withdrawal>(WITHDRAWALS_KEY)) {
    if (withdrawal.phoneNumber === phoneNumber) mine.push(withdrawal);
  }
  return mine.reverse().slice(0, count);
}
