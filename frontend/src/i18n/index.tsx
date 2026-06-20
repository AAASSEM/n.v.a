import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { en } from './en';
import { ar } from './ar';

type Language = 'en' | 'ar';

type Translations = Record<string, string>;

interface I18nContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: (key: string, fallback?: string) => string;
    n: (val: number | string | null | undefined, options?: Intl.NumberFormatOptions) => string;
}

const translations: Record<Language, Translations> = {
    en,
    ar,
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [lang, setLangState] = useState<Language>(() => {
        const storedLang = localStorage.getItem('lang');
        return (storedLang === 'en' || storedLang === 'ar') ? storedLang : 'en';
    });

    const setLang = (newLang: Language) => {
        setLangState(newLang);
        localStorage.setItem('lang', newLang);
    };

    useEffect(() => {
        // Handle RTL when language changes
        if (lang === 'ar') {
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'ar';
        } else {
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
        }
    }, [lang]);

    const t = (key: string, fallback?: string): string => {
        if (!key) return '';
        const normalizedKey = key.replace(/â€“/g, '–').replace(/â\x80\x93/g, '–');
        const dictionary = translations[lang];
        return dictionary[normalizedKey] || fallback || normalizedKey; // fallback to normalized key if missing
    };

    const n = (val: number | string | null | undefined, options?: Intl.NumberFormatOptions): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') {
            const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
            return new Intl.NumberFormat(locale, options).format(val);
        }
        if (typeof val === 'string') {
            if (lang === 'ar') {
                const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                let res = val.replace(/[0-9]/g, (w) => arabicDigits[+w]);
                res = res.replace(/,/g, '٬');
                res = res.replace(/\./g, '٫');
                return res;
            }
            return val;
        }
        return String(val);
    };

    return (
        <I18nContext.Provider value={{ lang, setLang, t, n }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useTranslation = (): I18nContextType => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};

export function translateUnitStr(u: string | null | undefined, t: (key: string) => string): string {
    if (!u) return '';
    const clean = u.trim().toLowerCase();
    if (clean === 'kwh') return t('unit.kwh');
    if (clean === 'm³' || clean === 'm3' || clean === 'mâ³' || clean === 'mâ³') return t('unit.m3');
    if (clean === 'kg') return t('unit.kg');
    if (clean === 'l' || clean === 'liters' || clean === 'litres') return t('unit.l');
    if (clean === 'tco2e' || clean === 't co2e' || clean === 'tco₂e' || clean === 'tco2e') return t('unit.tco2e');
    if (clean === 'rth' || clean === 'rt-h' || clean === 'rt_h') return t('unit.rth');
    if (clean === 'people') return t('unit.people');
    if (clean === 'hours') return t('unit.hours');
    if (clean === 'status' || clean === 'boolean') return t('unit.status');
    if (clean === 'l/min') return t('unit.l_min');
    if (clean === 'count') return t('unit.count');
    if (clean === 'hours/employee') return t('unit.hours_employee');
    if (clean === 'ltis per 1,000,000 hours') return t('unit.ltifr');
    if (clean === 'aed') return t('unit.aed');
    if (clean === '%') return '%';
    return u;
}

export function translateMeterName(name: string, t: (key: string) => string): string {
    if (!name) return '';
    const mainMatch = name.match(/^Main\s+(.+)\s+Meter$/i);
    if (mainMatch) {
        const innerName = mainMatch[1].trim();
        const translatedInner = t(innerName);
        return t('meters.mainMeterPattern').replace('{{name}}', translatedInner);
    }
    const subMatch = name.match(/^Sub-Meter\s+Wing\s+(.+)$/i);
    if (subMatch) {
        const wing = subMatch[1].trim();
        const translatedWing = t(wing);
        return t('meters.subMeterPattern').replace('{{wing}}', translatedWing);
    }
    return t(name);
}
