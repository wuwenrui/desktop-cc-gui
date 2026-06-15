import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getClientStoreSync, writeClientStoreValue } from "../services/clientStorage";

type SupportedLanguage = "zh" | "en";

const supportedLanguages = new Set<SupportedLanguage>(["zh", "en"]);

const localeLoaders: Record<SupportedLanguage, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import("./locales/en"),
  zh: () => import("./locales/zh"),
};

const loadedLanguages = new Set<SupportedLanguage>();
const loadedResources: Partial<Record<SupportedLanguage, Record<string, unknown>>> = {};

function normalizeLanguage(lang: string | undefined): SupportedLanguage {
  return supportedLanguages.has(lang as SupportedLanguage) ? (lang as SupportedLanguage) : "zh";
}

const getStoredLanguage = (): string => {
  const stored = getClientStoreSync<string>("app", "language");
  if (stored && (stored === "zh" || stored === "en")) {
    return stored;
  }
  return "zh"; // Default to Chinese
};

export const saveLanguage = (lang: string): void => {
  writeClientStoreValue("app", "language", lang);
};

if (initReactI18next && typeof initReactI18next === "object") {
  i18n.use(initReactI18next);
}

const i18nInstance = i18n;

async function loadLanguageResource(lang: string | undefined): Promise<SupportedLanguage> {
  const normalized = normalizeLanguage(lang);
  if (loadedLanguages.has(normalized)) {
    return normalized;
  }
  const resource = await localeLoaders[normalized]();
  loadedResources[normalized] = resource.default;
  if (i18nInstance.isInitialized && typeof i18nInstance.addResourceBundle === "function") {
    i18nInstance.addResourceBundle(normalized, "translation", resource.default, true, true);
  }
  loadedLanguages.add(normalized);
  return normalized;
}

const originalChangeLanguage = i18nInstance.changeLanguage.bind(i18nInstance);

i18nInstance.changeLanguage = (async (
  lang?: string,
  callback?: Parameters<typeof i18nInstance.changeLanguage>[1],
) => {
  const normalized = await loadLanguageResource(lang ?? getStoredLanguage());
  return originalChangeLanguage(normalized, callback);
}) as typeof i18nInstance.changeLanguage;

export const i18nReady = (async () => {
  const initialLanguage = await loadLanguageResource(getStoredLanguage());
  await i18nInstance.init({
    resources: {
      [initialLanguage]: {
        translation: loadedResources[initialLanguage] ?? {},
      },
    },
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
  return i18nInstance;
})();

export default i18n;
