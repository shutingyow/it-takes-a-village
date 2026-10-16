"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translations as en, type Language, type TranslationKey } from "./en";
import { zh } from "./zh";

const LANGUAGE_KEY = "appLanguage";

const allTranslations = { en, zh };

type InterpolationValues = Record<string, string | number>;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, values?: InterpolationValues) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function interpolate(
  template: string,
  values?: InterpolationValues
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] !== undefined ? String(values[key]) : `{${key}}`
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored === "en" || stored === "zh") {
      setLanguageState(stored);
    }
    setHydrated(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
    document.documentElement.lang = lang === "zh" ? "zh" : "en";
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "zh" : "en");
  }, [language, setLanguage]);

  useEffect(() => {
    if (hydrated) {
      document.documentElement.lang = language === "zh" ? "zh" : "en";
    }
  }, [hydrated, language]);

  const t = useCallback(
    (key: TranslationKey, values?: InterpolationValues) => {
      const dict = allTranslations[language];
      return interpolate(dict[key] ?? en[key], values);
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}

export type { Language, TranslationKey };
