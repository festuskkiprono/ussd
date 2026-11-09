# ussd-simple

A USSD phone simulator in the browser. Two phones, a keypad, menus in
English, Kiswahili and French, and a page that shows every session.

## Run it

```bash
npx tsc --watch
```

Then open `index.html` with VS Code Live Server. (Browsers won't load
modules from a double-clicked file.)

Only edit files in `src/`. `dist/` is generated.

## The files

| File | What it does |
|---|---|
| `src/text.ts` | Every word the phones show, in each language |
| `src/menu.ts` | The menus: the `SCREENS` table, the USSD codes, and what each answer does |
| `src/phone.ts` | One phone: its buttons and what they do |
| `src/main.ts` | Makes the phones; sends clicks and keys to the right one |
| `src/storage.ts` | Saves the session log and withdrawals in the browser |
| `src/logs-page.ts` | The logs page: turns the log into table rows; shows a session's steps |
| `src/table.ts` | The logs table: search, filters, sorting, show/hide columns, chips, pages |

## How a session works

1. You type `*144#` and press Call.
2. `phone.ts` calls `dial()` in `menu.ts`, which looks up `*144#` in `SERVICES`, sets `session.screen = "main"` and returns the menu text built from `SCREENS.main`.
3. You type `2` and press Call. `phone.ts` calls `answer()`, which finds option 2 of `SCREENS.main` and moves to its `next`: `"withdraw"`.
4. Each step is written to the log with `logStep()`. When a reply says `sessionEnds`, the phone shows it as a final message.

## USSD codes

| Code | Opens |
|---|---|
| `*144#` | Main menu |
| `*100#` | Language menu |
| `*101#` | Local time |

## Adding things

| To add… | Do this |
|---|---|
| A language | Copy `ENGLISH` in `text.ts`, translate it, add it to `LANGUAGES` |
| A screen | Add it to `SCREENS` in `menu.ts` and point an option's `next` at it |
| A USSD code | A line in `SERVICES` in `menu.ts` |
| A phone | A line in the `phones` list in `main.ts` |
