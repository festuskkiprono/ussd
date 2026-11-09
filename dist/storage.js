// =====================================================================
// Everything kept in the browser (localStorage):
//   - the session log, read by the logs page
//   - the withdrawals, read by the mini statement
// =====================================================================
/** The logs page listens for changes to this key to refresh itself. */
export const LOG_KEY = "ussd-simple:log";
const WITHDRAWALS_KEY = "ussd-simple:withdrawals";
const MAX_SESSIONS = 200; // older sessions are dropped
// ----- Reading and writing a list -----
function readList(key) {
    try {
        const list = JSON.parse(localStorage.getItem(key) ?? "[]");
        return Array.isArray(list) ? list : [];
    }
    catch {
        return []; // the saved text was broken; start again
    }
}
function writeList(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
}
function now() {
    return new Date().toISOString();
}
// ----- Session log -----
/** All sessions, oldest first. */
export function loadSessions() {
    return readList(LOG_KEY);
}
export function findSession(sessions, id) {
    for (const session of sessions) {
        if (session.id === id)
            return session;
    }
    return null;
}
export function logStart(id, phoneNumber) {
    const sessions = loadSessions();
    sessions.push({ id, phoneNumber, status: "active", startedAt: now(), endedAt: null, steps: [] });
    while (sessions.length > MAX_SESSIONS)
        sessions.shift();
    writeList(LOG_KEY, sessions);
}
export function logStep(id, typed, reply) {
    const sessions = loadSessions();
    const session = findSession(sessions, id);
    if (session === null)
        return;
    session.steps.push({ time: now(), typed, reply });
    writeList(LOG_KEY, sessions);
}
/** Records how a session ended. A session that already ended is left alone. */
export function logEnd(id, status) {
    const sessions = loadSessions();
    const session = findSession(sessions, id);
    if (session === null || session.status !== "active")
        return;
    session.status = status;
    session.endedAt = now();
    writeList(LOG_KEY, sessions);
}
// ----- Withdrawals -----
export function saveWithdrawal(phoneNumber, amount, recipient) {
    const withdrawals = readList(WITHDRAWALS_KEY);
    withdrawals.push({ phoneNumber, amount, recipient, time: now() });
    writeList(WITHDRAWALS_KEY, withdrawals);
}
/** This phone's newest withdrawals, newest first. */
export function lastWithdrawals(phoneNumber, count) {
    const mine = [];
    for (const withdrawal of readList(WITHDRAWALS_KEY)) {
        if (withdrawal.phoneNumber === phoneNumber)
            mine.push(withdrawal);
    }
    return mine.reverse().slice(0, count);
}
//# sourceMappingURL=storage.js.map