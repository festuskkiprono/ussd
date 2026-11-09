// =====================================================================
// One phone: its buttons on the page and what each button does.
//
// A phone is always in one of four states:
//   home     typing a USSD code
//   waiting  the "server" is answering; keys do nothing
//   menu     a menu is showing; the session times out if nobody answers
//   message  the session is over; Call or ✖ goes back home
// =====================================================================

import { LANGUAGES, getText } from "./text.js";
import { answer, dial, type Reply, type Session } from "./menu.js";
import { logEnd, logStart, logStep } from "./storage.js";

export const SESSION_TIMEOUT_MS = 100_000; // how long a menu waits for an answer
const NETWORK_DELAY_MS = 400;              // pretend the server takes a moment
const MAX_INPUT_LENGTH = 30;
const USSD_CODE = /^\*[\d*]+#$/;           // *144#, *144*1#, ...

const KEYPAD = [
  { key: "1", letters: "" },
  { key: "2", letters: "abc" },
  { key: "3", letters: "def" },
  { key: "4", letters: "ghi" },
  { key: "5", letters: "jkl" },
  { key: "6", letters: "mno" },
  { key: "7", letters: "pqrs" },
  { key: "8", letters: "tuv" },
  { key: "9", letters: "wxyz" },
  { key: "*", letters: "" },
  { key: "0", letters: "+" },
  { key: "#", letters: "" },
];

export interface Phone {
  phoneNumber: string;
  language: string;
  state: "home" | "waiting" | "menu" | "message";
  input: string;
  session: Session | null;
  timer: number; // the one pending timer (reply, timeout); 0 = none

  // The parts of the page this phone changes
  root: HTMLElement;
  screenText: HTMLElement;
  inputText: HTMLElement;
  languageButtons: HTMLButtonElement[];
}

// ----- Buttons -----

export function pressKey(phone: Phone, key: string): void {
  if (phone.state !== "home" && phone.state !== "menu") return;
  if (phone.input.length >= MAX_INPUT_LENGTH) return;
  phone.input += key;
  phone.inputText.textContent = phone.input;
}

export function pressClear(phone: Phone): void {
  if (phone.state !== "home" && phone.state !== "menu") return;
  phone.input = phone.input.slice(0, -1);
  phone.inputText.textContent = phone.input;
}

export function pressCall(phone: Phone): void {
  if (phone.state === "home") startSession(phone);
  else if (phone.state === "menu") sendAnswer(phone);
  else if (phone.state === "message") showHome(phone);
}

export function pressEnd(phone: Phone): void {
  if (phone.session !== null) logEnd(phone.session.id, "cancelled");
  showHome(phone); // also cancels a reply that is still on its way
}

/** The language buttons under the phone. */
export function setLanguage(phone: Phone, code: string): void {
  phone.language = code;
  if (phone.session !== null) phone.session.language = code;
  if (phone.state === "home") phone.screenText.textContent = getText(code).dialCode;
  markLanguageButton(phone);
}

// ----- The session -----

function startSession(phone: Phone): void {
  const code = phone.input;
  if (code === "") return;
  if (!USSD_CODE.test(code)) {
    showMessage(phone, getText(phone.language).invalidCode);
    return;
  }

  const session: Session = {
    id: phone.phoneNumber.replace("+", "") + "-" + Date.now(),
    phoneNumber: phone.phoneNumber,
    language: phone.language,
    screen: "",
    recipient: null,
  };
  phone.session = session;
  logStart(session.id, phone.phoneNumber);

  showWaiting(phone);
  phone.timer = window.setTimeout(receiveDialReply, NETWORK_DELAY_MS, phone, code);
}

function receiveDialReply(phone: Phone, code: string): void {
  if (phone.session === null) return;
  showReply(phone, code, dial(phone.session, code));
}

function sendAnswer(phone: Phone): void {
  const typed = phone.input;
  if (typed === "") return;

  showWaiting(phone);
  phone.timer = window.setTimeout(receiveAnswerReply, NETWORK_DELAY_MS, phone, typed);
}

function receiveAnswerReply(phone: Phone, typed: string): void {
  if (phone.session === null) return;
  showReply(phone, typed, answer(phone.session, typed));
}

function showReply(phone: Phone, typed: string, reply: Reply): void {
  const session = phone.session;
  if (session === null) return;

  logStep(session.id, typed, reply.text);

  // The language menu may have changed the language.
  if (session.language !== phone.language) setLanguage(phone, session.language);

  if (reply.sessionEnds) {
    logEnd(session.id, "completed");
    showMessage(phone, reply.text);
  } else {
    showMenu(phone, reply.text);
  }
}

function timeOut(phone: Phone): void {
  if (phone.session !== null) logEnd(phone.session.id, "timedOut");
  showMessage(phone, getText(phone.language).timedOut);
}

// ----- What the screen shows -----

function showHome(phone: Phone): void {
  show(phone, "home", getText(phone.language).dialCode);
  phone.session = null;
}

function showWaiting(phone: Phone): void {
  show(phone, "waiting", getText(phone.language).running);
}

function showMenu(phone: Phone, text: string): void {
  show(phone, "menu", text);
  phone.timer = window.setTimeout(timeOut, SESSION_TIMEOUT_MS, phone);
}

function showMessage(phone: Phone, text: string): void {
  show(phone, "message", text + "\n\n" + getText(phone.language).pressToClose);
  phone.session = null;
}

/** Changes state: stops any pending timer and clears what was typed. */
function show(phone: Phone, state: Phone["state"], text: string): void {
  window.clearTimeout(phone.timer);
  phone.timer = 0;
  phone.state = state;
  phone.input = "";
  phone.inputText.textContent = "";
  phone.screenText.textContent = text;
}

function markLanguageButton(phone: Phone): void {
  for (const button of phone.languageButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.language === phone.language));
  }
}

// ----- Building the phone on the page -----

/**
 * Buttons get data attributes that main.ts reads on click:
 *   data-key="5"   data-action="call|clear|end"   data-language="sw"
 */
export function createPhone(label: string, phoneNumber: string, language: string): Phone {
  const screenText = make("div", "screen-message", "");
  screenText.setAttribute("aria-live", "polite");
  const inputText = make("div", "screen-input", "");
  const screen = make("div", "screen", "");
  screen.append(screenText, inputText);

  const speaker = make("div", "speaker", "");
  for (let dot = 0; dot < 5; dot++) speaker.append(make("span", "", ""));

  const controls = make("div", "controls", "");
  controls.append(
    makeButton("call", "✆", "action", "call", "Call (Enter)"),
    makeButton("clear", "C", "action", "clear", "Clear (Backspace)"),
    makeButton("end", "✖", "action", "end", "End (Esc)"),
  );

  const keypad = make("div", "keypad", "");
  for (const item of KEYPAD) {
    const button = makeButton("key", item.key, "key", item.key, item.key);
    button.append(make("small", "", item.letters));
    keypad.append(button);
  }

  const body = make("div", "phone", "");
  body.append(speaker, make("div", "brand", "G PHONE"), screen, controls, keypad);

  const languageSwitch = make("div", "lang-switch", "");
  const languageButtons: HTMLButtonElement[] = [];
  for (const choice of LANGUAGES) {
    const button = makeButton("", choice.name, "language", choice.code, choice.name);
    languageButtons.push(button);
    languageSwitch.append(button);
  }

  const root = make("section", "device", "");
  root.append(make("p", "device-label", label + " · " + phoneNumber), body, languageSwitch);

  const phone: Phone = {
    phoneNumber,
    language,
    state: "home",
    input: "",
    session: null,
    timer: 0,
    root,
    screenText,
    inputText,
    languageButtons,
  };
  markLanguageButton(phone);
  showHome(phone);
  return phone;
}

function make(tag: string, className: string, text: string): HTMLElement {
  const element = document.createElement(tag);
  if (className !== "") element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function makeButton(className: string, text: string, dataName: string, dataValue: string, title: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.title = title;
  button.dataset[dataName] = dataValue;
  return button;
}
