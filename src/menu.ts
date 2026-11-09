// =====================================================================
// The menus. This file plays the part of the USSD server.
//
//   SCREENS   what each screen shows and where each choice goes
//   SERVICES  which screen each USSD code opens
//   dial()    the first screen for a dialled code
//   answer()  what happens when the user replies to the current screen
//
// To add a screen: add it to SCREENS and point an option's `next` at it.
// =====================================================================

import { LANGUAGES, getText, type Text } from "./text.js";
import { lastWithdrawals, saveWithdrawal } from "./storage.js";

const BALANCE = 12_500;

/** One USSD session: where the user is in the menu, and what they've entered. */
export interface Session {
  id: string;
  phoneNumber: string;
  language: string;         // the language menu can change this
  screen: string;           // the screen showing now: "main", "withdraw", ...
  recipient: string | null; // null = withdraw to own number
}

/** What the phone should show next. */
export interface Reply {
  text: string;
  sessionEnds: boolean;
}

// ----- The screens -----

interface Option {
  label: keyof Text; // the words, looked up in text.ts: "checkBalance"
  next: string;      // a screen name, or "exit" to end with "Thank you"
}

interface Screen {
  title: keyof Text;
  /** A line under the title that changes, e.g. the balance. */
  details?: (session: Session, t: Text) => string;
  /** Show one numbered choice per language before the options. */
  listLanguages?: boolean;
  options: Option[]; // numbered 1, 2, 3... in this order
  back?: string;     // where "0. Back" goes; no back = no "0. Back"
}

const EXIT: Option = { label: "exit", next: "exit" };

const SCREENS: Record<string, Screen> = {
  main: {
    title: "welcome",
    options: [
      { label: "checkBalance", next: "balance" },
      { label: "withdrawMoney", next: "withdraw" },
      { label: "miniStatement", next: "statement" },
      { label: "changeLanguage", next: "language" },
      { label: "localTime", next: "time" },
      EXIT,
    ],
  },

  balance: {
    title: "yourBalanceIs",
    details: balanceText,
    options: [EXIT],
    back: "main",
  },

  statement: {
    title: "lastTransactions",
    details: statementText,
    options: [EXIT],
    back: "main",
  },

  time: {
    title: "localTime",
    details: timeText,
    options: [EXIT],
    back: "main",
  },

  withdraw: {
    title: "withdrawMenu",
    options: [
      { label: "myNumber", next: "amount" },
      { label: "otherNumber", next: "recipient" },
      EXIT,
    ],
    back: "main",
  },

  // The user types a value on these two; see enterRecipient() and enterAmount().
  recipient: {
    title: "enterRecipient",
    options: [],
    back: "withdraw",
  },

  amount: {
    title: "enterAmount",
    options: [],
    back: "withdraw",
  },

  language: {
    title: "chooseLanguage",
    listLanguages: true,
    options: [EXIT],
    back: "main",
  },
};

/** Which screen each USSD code opens. Add a line to add a code. */
const SERVICES: Record<string, string> = {
  "*144#": "main",
  "*100#": "language",
  "*101#": "time",
};

// ----- The first screen -----

export function dial(session: Session, code: string): Reply {
  const screen = SERVICES[code];
  if (screen === undefined) {
    return end(getText(session.language).unknownCode + "\n" + code);
  }
  return goTo(session, screen);
}

// ----- The user's reply -----

export function answer(session: Session, input: string): Reply {
  const t = getText(session.language);
  const screen = getScreen(session.screen);

  if (input === "0" && screen.back !== undefined) return goTo(session, screen.back);

  // Screens where the user types a value instead of picking an option
  if (session.screen === "recipient") return enterRecipient(session, input);
  if (session.screen === "amount") return enterAmount(session, input);

  if (session.screen === "language") {
    const reply = pickLanguage(session, input);
    if (reply !== null) return reply;
  }

  // Any choice on the withdraw menu starts a new withdrawal.
  // "Other number" then fills in the recipient on the next screen.
  if (session.screen === "withdraw") session.recipient = null;

  const option = pickOption(screen, input);
  if (option === null) return end(t.invalidChoice);
  if (option.next === "exit") return end(t.thankYou);
  return goTo(session, option.next);
}

function enterRecipient(session: Session, input: string): Reply {
  if (!isPhoneNumber(input)) return end(getText(session.language).invalidPhoneNumber);
  session.recipient = input;
  return goTo(session, "amount");
}

function enterAmount(session: Session, input: string): Reply {
  if (!isAmount(input)) return end(getText(session.language).invalidAmount);
  return withdraw(session, Number(input));
}

function withdraw(session: Session, amount: number): Reply {
  const t = getText(session.language);
  saveWithdrawal(session.phoneNumber, amount, session.recipient);

  const where = session.recipient === null ? t.toYourNumber : t.toNumber + " " + session.recipient;
  return end(t.youWithdrew + " " + formatKes(amount) + "\n" + where);
}

/** "1" = the first language, "2" = the second... Anything else → null. */
function pickLanguage(session: Session, input: string): Reply | null {
  let number = 1;
  for (const language of LANGUAGES) {
    if (input === String(number)) {
      session.language = language.code;
      return end(language.text.languageChanged);
    }
    number++;
  }
  return null;
}

/** The option the user's number points at, counted the same way screenText() numbers them. */
function pickOption(screen: Screen, input: string): Option | null {
  let number = screen.listLanguages === true ? LANGUAGES.length + 1 : 1;
  for (const option of screen.options) {
    if (input === String(number)) return option;
    number++;
  }
  return null;
}

// ----- Building the screen text -----

/**
 *   Title
 *   details (if any)
 *   1. English        ← only on the language screen
 *   2. Exit           ← the options
 *   0. Back           ← only if the screen has `back`
 */
function screenText(session: Session): string {
  const t = getText(session.language);
  const screen = getScreen(session.screen);
  const result = [t[screen.title]];

  if (screen.details !== undefined) result.push(screen.details(session, t));

  let number = 1;
  if (screen.listLanguages === true) {
    for (const language of LANGUAGES) {
      result.push(number + ". " + language.name);
      number++;
    }
  }
  for (const option of screen.options) {
    result.push(number + ". " + t[option.label]);
    number++;
  }

  if (screen.back !== undefined) result.push("0. " + t.back);
  return result.join("\n");
}

// ----- The changing lines (used as `details` in SCREENS) -----

function balanceText(session: Session, t: Text): string {
  return formatKes(BALANCE);
}

function timeText(session: Session, t: Text): string {
  return formatDate(new Date().toISOString(), session.language);
}

function statementText(session: Session, t: Text): string {
  const withdrawals = lastWithdrawals(session.phoneNumber, 3);
  if (withdrawals.length === 0) return t.noTransactions;

  const result: string[] = [];
  for (const withdrawal of withdrawals) {
    const where = withdrawal.recipient === null ? t.toYourNumber : t.toNumber + " " + withdrawal.recipient;
    result.push(formatDate(withdrawal.time, session.language) + " " + formatKes(withdrawal.amount));
    result.push("  " + where);
  }
  return result.join("\n");
}

// ----- Small helpers -----

function goTo(session: Session, screen: string): Reply {
  session.screen = screen;
  return { text: screenText(session), sessionEnds: false };
}

function end(text: string): Reply {
  return { text, sessionEnds: true };
}

function getScreen(name: string): Screen {
  const screen = SCREENS[name];
  if (screen === undefined) throw new Error("No screen called " + name + " in SCREENS");
  return screen;
}

/** 07xxxxxxxx or 01xxxxxxxx */
function isPhoneNumber(input: string): boolean {
  return /^0[17]\d{8}$/.test(input);
}

/** A whole number above zero. */
function isAmount(input: string): boolean {
  return /^\d+$/.test(input) && Number(input) > 0;
}

/** 12500 → "KES 12,500.00" */
function formatKes(amount: number): string {
  return "KES " + amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "05 Nov, 16:09" in Nairobi time, in the phone's language. */
function formatDate(isoTime: string, language: string): string {
  return new Date(isoTime).toLocaleString(language, {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
