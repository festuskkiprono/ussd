// =====================================================================
// Start-up for index.html: makes the phones and passes clicks and
// keyboard presses to the right one.
// =====================================================================
import { createPhone, pressCall, pressClear, pressEnd, pressKey, setLanguage } from "./phone.js";
// To add a phone, add a line here.
const phones = [
    createPhone("Phone 1", "+254700000001", "en"),
    createPhone("Phone 2", "+254700000002", "sw"),
];
/** The phone the keyboard types into: the one clicked last. */
let activePhone = null;
function start() {
    const list = document.getElementById("phones");
    if (list === null)
        throw new Error('index.html needs <main id="phones">');
    for (const phone of phones)
        list.append(phone.root);
    makeActive(phones[0] ?? null);
    document.addEventListener("click", handleClick);
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("keydown", handleKeyDown);
}
function handleClick(event) {
    if (!(event.target instanceof Element))
        return;
    const phone = phoneContaining(event.target);
    if (phone === null)
        return;
    makeActive(phone);
    const button = event.target.closest("button");
    if (button === null)
        return;
    const key = button.dataset.key;
    const action = button.dataset.action;
    const language = button.dataset.language;
    if (key !== undefined)
        pressKey(phone, key);
    else if (action === "call")
        pressCall(phone);
    else if (action === "clear")
        pressClear(phone);
    else if (action === "end")
        pressEnd(phone);
    else if (language !== undefined)
        setLanguage(phone, language);
}
/** Tabbing into a phone also makes it the active one. */
function handleFocus(event) {
    if (!(event.target instanceof Element))
        return;
    const phone = phoneContaining(event.target);
    if (phone !== null)
        makeActive(phone);
}
/** Digits, * and # type. Enter = Call, Backspace = Clear, Escape = End. */
function handleKeyDown(event) {
    if (activePhone === null || event.ctrlKey || event.metaKey || event.altKey)
        return;
    if (/^[0-9*#]$/.test(event.key))
        pressKey(activePhone, event.key);
    else if (event.key === "Enter")
        pressCall(activePhone);
    else if (event.key === "Backspace")
        pressClear(activePhone);
    else if (event.key === "Escape")
        pressEnd(activePhone);
    else
        return;
    event.preventDefault(); // stops Enter from also clicking a focused button
}
function phoneContaining(element) {
    for (const phone of phones) {
        if (phone.root.contains(element))
            return phone;
    }
    return null;
}
function makeActive(active) {
    activePhone = active;
    for (const phone of phones) {
        phone.root.dataset.active = String(phone === active);
    }
}
start();
//# sourceMappingURL=main.js.map