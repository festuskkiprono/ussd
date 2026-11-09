// =====================================================================
// Every word the phones show, in each language.
//
// To add a language: copy ENGLISH, translate each line, and add it to
// LANGUAGES at the bottom. The language buttons and the language menu
// both read LANGUAGES, so nothing else changes.
// =====================================================================
const ENGLISH = {
    dialCode: "Dial a USSD code\neg *144#",
    running: "USSD code running...",
    invalidCode: "Invalid USSD code",
    unknownCode: "Unknown USSD code:",
    timedOut: "Session timed out.\nPlease try again.",
    pressToClose: "Press ✖ to close",
    welcome: "Welcome",
    checkBalance: "Check balance",
    withdrawMoney: "Withdraw money",
    miniStatement: "Mini statement",
    changeLanguage: "Language / Lugha",
    localTime: "Local time",
    exit: "Exit",
    back: "Back",
    yourBalanceIs: "Your balance is",
    withdrawMenu: "Withdraw menu",
    myNumber: "My number",
    otherNumber: "Other number",
    enterRecipient: "Enter recipient number",
    enterAmount: "Enter amount",
    youWithdrew: "You have withdrawn",
    toYourNumber: "to your number",
    toNumber: "to",
    lastTransactions: "Last 3 transactions",
    noTransactions: "No transactions yet.",
    chooseLanguage: "Choose language",
    languageChanged: "Language set to English.",
    thankYou: "Thank you.",
    invalidPhoneNumber: "Invalid phone number.",
    invalidAmount: "Invalid amount.",
    invalidChoice: "Invalid choice.",
};
const KISWAHILI = {
    dialCode: "Piga msimbo wa USSD\nmfano *144#",
    running: "Msimbo wa USSD\nunatekelezwa...",
    invalidCode: "Msimbo wa USSD si sahihi",
    unknownCode: "Msimbo wa USSD hautambuliki:",
    timedOut: "Muda umekwisha.\nTafadhali jaribu tena.",
    pressToClose: "Bonyeza ✖ kufunga",
    welcome: "Karibu",
    checkBalance: "Angalia salio",
    withdrawMoney: "Toa pesa",
    miniStatement: "Taarifa fupi",
    changeLanguage: "Lugha / Language",
    localTime: "Saa ya sasa",
    exit: "Ondoka",
    back: "Rudi",
    yourBalanceIs: "Salio lako ni",
    withdrawMenu: "Menyu ya kutoa pesa",
    myNumber: "Nambari yangu",
    otherNumber: "Nambari nyingine",
    enterRecipient: "Weka nambari ya mpokeaji",
    enterAmount: "Weka kiasi",
    youWithdrew: "Umetoa",
    toYourNumber: "kwenye nambari yako",
    toNumber: "kwenda",
    lastTransactions: "Miamala 3 ya mwisho",
    noTransactions: "Hakuna miamala bado.",
    chooseLanguage: "Chagua lugha",
    languageChanged: "Lugha imebadilishwa\nkuwa Kiswahili.",
    thankYou: "Asante.",
    invalidPhoneNumber: "Nambari ya simu si sahihi.",
    invalidAmount: "Kiasi si sahihi.",
    invalidChoice: "Chaguo si sahihi.",
};
const FRENCH = {
    dialCode: "Composez un code USSD\nex. *144#",
    running: "Code USSD en cours...",
    invalidCode: "Code USSD invalide",
    unknownCode: "Code USSD inconnu :",
    timedOut: "Session expirée.\nVeuillez réessayer.",
    pressToClose: "Appuyez sur ✖ pour fermer",
    welcome: "Bienvenue",
    checkBalance: "Consulter le solde",
    withdrawMoney: "Retirer de l'argent",
    miniStatement: "Mini relevé",
    changeLanguage: "Langue / Language",
    localTime: "Heure locale",
    exit: "Quitter",
    back: "Retour",
    yourBalanceIs: "Votre solde est de",
    withdrawMenu: "Menu de retrait",
    myNumber: "Mon numéro",
    otherNumber: "Autre numéro",
    enterRecipient: "Entrez le numéro du destinataire",
    enterAmount: "Entrez le montant",
    youWithdrew: "Vous avez retiré",
    toYourNumber: "sur votre numéro",
    toNumber: "vers",
    lastTransactions: "3 dernières transactions",
    noTransactions: "Aucune transaction.",
    chooseLanguage: "Choisissez une langue",
    languageChanged: "Langue définie\nsur le français.",
    thankYou: "Merci.",
    invalidPhoneNumber: "Numéro de téléphone invalide.",
    invalidAmount: "Montant invalide.",
    invalidChoice: "Choix invalide.",
};
export const LANGUAGES = [
    { code: "en", name: "English", text: ENGLISH },
    { code: "sw", name: "Kiswahili", text: KISWAHILI },
    { code: "fr", name: "Français", text: FRENCH },
];
/** The words for a language code. Unknown codes get English. */
export function getText(languageCode) {
    for (const language of LANGUAGES) {
        if (language.code === languageCode)
            return language.text;
    }
    return ENGLISH;
}
//# sourceMappingURL=text.js.map