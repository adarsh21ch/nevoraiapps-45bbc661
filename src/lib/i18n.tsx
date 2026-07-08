import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

const STORAGE_KEY = "acadaos.lang";

type Dict = Record<string, string>;

const en: Dict = {};

const hi: Dict = {
  // Nav
  "Home": "होम",
  "Fees": "फ़ीस",
  "Students": "छात्र",
  "Registrations": "रजिस्ट्रेशन",
  "Leads": "लीड्स",
  "Attendance": "हाज़िरी",
  "Reminders": "रिमाइंडर",
  "Reports": "रिपोर्ट",
  "Batches": "बैच",
  "Fee plans": "फ़ीस प्लान",
  "Profile": "प्रोफ़ाइल",
  "Dashboard": "डैशबोर्ड",
  "Sign out": "साइन आउट",
  "View site": "वेबसाइट देखें",
  "Language": "भाषा",

  // Home / KPIs
  "Welcome back": "वापसी पर स्वागत है",
  "at a glance": "एक नज़र में",
  "This month": "इस महीने",
  "Active students": "चालू छात्र",
  "Active": "चालू",
  "Paused": "रुका",
  "Left": "छोड़ा",
  "All": "सभी",
  "Collected this month": "इस महीने जमा",
  "Collected": "जमा",
  "Pending this month": "इस महीने बाकी",
  "Pending": "बाकी",
  "New registrations": "नए रजिस्ट्रेशन",
  "This week": "इस हफ़्ते",
  "View": "देखें",
  "collected of": "जमा, कुल",
  "expected": "अपेक्षित",
  "paid": "भुगतान हुआ",
  "pending": "बाकी",
  "of": "में से",
  "Students to follow up": "जिनसे फ़ीस लेनी है",
  "Open register": "रजिस्टर खोलें",
  "All caught up": "सब पूरा",
  "All fees collected for": "पूरी फ़ीस जमा हो गई —",
  "No students yet": "अभी कोई छात्र नहीं",
  "Add your first student": "पहला छात्र जोड़ें",
  "overdue": "देर",
  "days overdue": "दिन की देर",
  "due": "देय",
  "Call": "कॉल करें",
  "WhatsApp": "व्हाट्सएप",

  // Fees
  "Collect": "फ़ीस लें",
  "Confirm payment": "भुगतान पक्का करें",
  "Cash": "कैश",
  "UPI": "UPI",
  "Amount": "रकम",
  "Method": "तरीका",
  "Paid": "भुगतान हुआ",
  "Save": "सेव करें",
  "Send reminders": "रिमाइंडर भेजें",
  "Manage fees": "फ़ीस देखें",
  "Download receipt": "रसीद डाउनलोड करें",
  "Download report card": "रिपोर्ट कार्ड डाउनलोड करें",
  "Search": "खोजें",

  // Students
  "Add student": "छात्र जोड़ें",
  "Student profile": "छात्र प्रोफ़ाइल",
  "Mark left": "छोड़ा हुआ लिखें",
  "Reactivate": "फिर से चालू करें",
  "Custom fee": "अलग फ़ीस",
  "Phone": "फ़ोन",
  "Address": "पता",
  "Batch": "बैच",
  "Fee plan": "फ़ीस प्लान",
  "Joined": "जुड़ने की तारीख़",
  "Status": "स्थिति",

  // Registrations
  "Accept": "स्वीकार करें",
  "New": "नया",
  "Accept as student": "छात्र बनाएँ",
  "Reject": "अस्वीकार",
  "No registrations yet": "अभी कोई रजिस्ट्रेशन नहीं",

  // Common
  "Loading…": "लोड हो रहा है…",
  "Cancel": "रद्द करें",
  "Close": "बंद करें",
  "Saving…": "सेव हो रहा है…",
};

const dicts: Record<Lang, Dict> = { en, hi };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored === "en" || stored === "hi") setLangState(stored);
    } catch { /* ignore */ }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (key: string) => dicts[lang][key] ?? key,
    }),
    [lang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) return { lang: "en" as Lang, setLang: (_: Lang) => {}, t: (k: string) => k };
  return ctx;
}
