# Arabic Translation Plan — ESGravity

## Architecture: How It Will Work

### i18n Setup
1. Create `frontend/src/i18n/en.ts` and `frontend/src/i18n/ar.ts` with all strings
2. Create `frontend/src/i18n/index.ts` — a `useTranslation()` hook + `LanguageProvider`
3. Store the selected language in `localStorage` as `lang: 'en' | 'ar'`
4. Add a language toggle button (🌐 EN / AR) to the navbar

### RTL Support
- When `lang === 'ar'`, set `document.documentElement.dir = 'rtl'` and `lang = 'ar'`
- Add CSS: `[dir="rtl"] .nav-links { flex-direction: row-reverse; }` etc.
- Swap `margin-left` ↔ `margin-right`, `text-align: left` ↔ `right` via logical properties

### Files to Modify
Every `.tsx` file with hardcoded strings will import `useTranslation()` and replace inline text with `t('key')`.

---

## Full Translation Dictionary

> Every English string below is extracted from the actual codebase. Nothing is skipped.

---

### 1. Navigation & Layout ([AppLayout.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/components/layout/AppLayout.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `nav.dashboard` | Dashboard | لوحة التحكم |
| `nav.sites` | Sites | المواقع |
| `nav.onboarding` | Onboarding | الإعداد الأولي |
| `nav.checklist` | Checklist | قائمة المهام |
| `nav.meters` | Meters | العدادات |
| `nav.dataEntry` | Data Entry | إدخال البيانات |
| `nav.users` | Users | المستخدمون |
| `nav.reports` | Reports | التقارير |
| `nav.settings` | Settings | الإعدادات |
| `nav.helpCenter` | Help Center | مركز المساعدة |
| `nav.signOut` | Sign out | تسجيل الخروج |
| `nav.logoText` | ESGravity | ESGravity |
| `nav.trialExpired` | Your free trial has expired. Your account is now in Read-Only mode. Please contact support to upgrade. | انتهت فترة التجربة المجانية. حسابك الآن في وضع القراءة فقط. يرجى التواصل مع الدعم للترقية. |

### 2. Site Switcher ([SiteSwitcher.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/components/layout/SiteSwitcher.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `sites.allSites` | All Sites | جميع المواقع |
| `sites.switchSite` | Switch Site | تبديل الموقع |

### 3. Landing Page ([LandingPage.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/pages/Landing/LandingPage.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `landing.logoName` | ESGRAVITY | ESGRAVITY |
| `landing.logoSub` | Sustainability Intelligence | ذكاء الاستدامة |
| `landing.navFeatures` | Features | المميزات |
| `landing.navHow` | How It Works | كيف يعمل |
| `landing.navFrameworks` | Frameworks | الأطر التنظيمية |
| `landing.navSecurity` | Security | الأمان |
| `landing.login` | Login | تسجيل الدخول |
| `landing.startFree` | Start Free → | ابدأ مجاناً ← |
| `landing.dashboard` | Dashboard → | لوحة التحكم ← |
| `landing.eyebrow` | Now Compliant with GRI 2024 Standards | متوافق الآن مع معايير GRI 2024 |
| `landing.h1Line1` | Measure | قِس |
| `landing.h1Line2` | what | ما |
| `landing.h1Really` | really | يهم |
| `landing.h1Line3` | matters. | حقاً. |
| `landing.heroSub` | The command center for corporate sustainability. Track emissions, automate disclosures, and transform ESG data into a genuine competitive edge. | مركز القيادة للاستدامة المؤسسية. تتبع الانبعاثات، أتمتة الإفصاحات، وحوّل بيانات ESG إلى ميزة تنافسية حقيقية. |
| `landing.startTrial` | Start Free Trial | ابدأ التجربة المجانية |
| `landing.watchDemo` | Watch Demo | شاهد العرض التجريبي |
| `landing.efficiencyGain` | Efficiency Gain | تحسين الكفاءة |
| `landing.metricsTracked` | Metrics Tracked | مقاييس متتبعة |
| `landing.enterprises` | Enterprises | مؤسسات |
| `landing.ticker.carbonOffset` | Carbon Offset | تعويض الكربون |
| `landing.ticker.griScore` | GRI Score | درجة GRI |
| `landing.ticker.scope1` | Scope 1 | النطاق 1 |
| `landing.ticker.socialIndex` | Social Index | المؤشر الاجتماعي |
| `landing.ticker.governance` | Governance | الحوكمة |
| `landing.ticker.stable` | STABLE | مستقر |
| `landing.ticker.energyUse` | Energy Use | استهلاك الطاقة |
| `landing.ticker.water` | Water | المياه |
| `landing.ticker.wasteRecycled` | Waste Recycled | النفايات المعاد تدويرها |
| `landing.dash.carbonScore` | Carbon Score | درجة الكربون |
| `landing.dash.scope1tco2` | Scope 1 (tCO₂) | النطاق 1 (طن CO₂) |
| `landing.dash.dataCompleteness` | Data Completeness | اكتمال البيانات |
| `landing.dash.emissionsTrend` | Emissions Trend — 12 Months | اتجاه الانبعاثات — 12 شهراً |
| `landing.dash.live` | ● LIVE | ● مباشر |
| `landing.dash.scopeBreakdown` | Scope Breakdown | تفصيل النطاقات |
| `landing.dash.esgScore` | ESG Score | درجة ESG |
| `landing.dash.url` | esgravity.io/dashboard | esgravity.io/dashboard |
| `landing.feat.sectionLabel` | Platform Capabilities | قدرات المنصة |
| `landing.feat.h2` | Everything you need to lead on sustainability. | كل ما تحتاجه لقيادة الاستدامة. |
| `landing.feat.carbonTitle` | Carbon Intelligence | ذكاء الكربون |
| `landing.feat.carbonBody` | Automate Scope 1, 2, and 3 emissions tracking with real-time telemetry. Connect data sources directly to your carbon footprint dashboard. | أتمتة تتبع انبعاثات النطاق 1 و2 و3 مع القياس الآني. اربط مصادر البيانات مباشرة بلوحة البصمة الكربونية. |
| `landing.feat.socialTitle` | Social Metrics Engine | محرك المقاييس الاجتماعية |
| `landing.feat.socialBody` | Monitor health & safety KPIs, DEI benchmarks, and community impact scores — backed by cryptographically signed evidence chains. | راقب مؤشرات الصحة والسلامة، معايير التنوع والشمول، ودرجات الأثر المجتمعي — مدعومة بسلاسل أدلة موقعة رقمياً. |
| `landing.feat.govTitle` | Governance Command | قيادة الحوكمة |
| `landing.feat.govBody` | Centralize compliance, board-level risk assessments, and disclosure reporting in a single auditable source of truth. | مركزة الامتثال وتقييمات المخاطر على مستوى مجلس الإدارة وتقارير الإفصاح في مصدر موحد قابل للتدقيق. |
| `landing.feat.discTitle` | Automated Disclosures | الإفصاحات الآلية |
| `landing.feat.discBody` | Generate GRI, SASB, TCFD, and CSRD reports at one click. Export audit-ready packages for any regulatory framework. | أنشئ تقارير GRI وSASB وTCFD وCSRD بنقرة واحدة. صدّر حزم جاهزة للتدقيق لأي إطار تنظيمي. |
| `landing.stats.efficiencyGains` | Efficiency Gains | تحسينات الكفاءة |
| `landing.stats.nativeFramework` | Native Framework Support | دعم الأطر الأصلية |
| `landing.stats.enterpriseClients` | Enterprise Clients | عملاء المؤسسات |
| `landing.how.sectionLabel` | Process | العملية |
| `landing.how.h2` | From raw data to certified reports. | من البيانات الخام إلى التقارير المعتمدة. |
| `landing.how.step` | STEP | الخطوة |
| `landing.how.step1Title` | Connect Sources | اربط المصادر |
| `landing.how.step1Body` | Link ERP, IoT sensors, HR systems, and third-party data via 200+ native connectors. | اربط أنظمة ERP وأجهزة إنترنت الأشياء وأنظمة الموارد البشرية وبيانات الجهات الخارجية عبر أكثر من 200 موصل أصلي. |
| `landing.how.step2Title` | AI Normalizes Data | الذكاء الاصطناعي يوحّد البيانات |
| `landing.how.step2Body` | Our engine cleanses, classifies, and enriches raw data against global ESG taxonomies. | محركنا ينظف ويصنف ويثري البيانات الخام وفقاً لتصنيفات ESG العالمية. |
| `landing.how.step3Title` | Publish & Comply | انشر والتزم |
| `landing.how.step3Body` | Generate certified reports, share live dashboards with stakeholders, and file with regulators. | أنشئ تقارير معتمدة، شارك لوحات بيانات حية مع أصحاب المصلحة، وقدّم للجهات الرقابية. |
| `landing.cta.eyebrow` | Get Started Today | ابدأ اليوم |
| `landing.cta.h2` | Your sustainability journey starts now. | رحلة الاستدامة تبدأ الآن. |
| `landing.cta.sub` | Join 340+ enterprises already using ESGravity to turn compliance into competitive advantage. | انضم لأكثر من 340 مؤسسة تستخدم ESGravity لتحويل الامتثال إلى ميزة تنافسية. |
| `landing.cta.btn` | Start Free — No Card Required | ابدأ مجاناً — بدون بطاقة |
| `landing.footer.desc` | The command center for corporate sustainability intelligence. | مركز القيادة لذكاء الاستدامة المؤسسية. |
| `landing.footer.product` | Product | المنتج |
| `landing.footer.features` | Features | المميزات |
| `landing.footer.frameworks` | Frameworks | الأطر |
| `landing.footer.security` | Security | الأمان |
| `landing.footer.changelog` | Changelog | سجل التحديثات |
| `landing.footer.company` | Company | الشركة |
| `landing.footer.about` | About | عن الشركة |
| `landing.footer.careers` | Careers | الوظائف |
| `landing.footer.blog` | Blog | المدونة |
| `landing.footer.press` | Press | الصحافة |
| `landing.footer.legal` | Legal | القانونية |
| `landing.footer.privacy` | Privacy | الخصوصية |
| `landing.footer.terms` | Terms | الشروط |
| `landing.footer.cookies` | Cookies | ملفات تعريف الارتباط |
| `landing.footer.copy` | © 2024 ESGRAVITY GLOBAL SYSTEMS — ALL RIGHTS RESERVED | © 2024 ESGRAVITY GLOBAL SYSTEMS — جميع الحقوق محفوظة |

### 4. Demo Modal ([DemoModal.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/components/ui/DemoModal.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `demo.title` | Explore ESGravity Demo | استكشف عرض ESGravity التجريبي |
| `demo.sub` | Apex Hospitality — Realistic 4-Star Hotel Sustainability Model | Apex Hospitality — نموذج استدامة واقعي لفندق 4 نجوم |
| `demo.tabRoles` | Select Persona | اختر الشخصية |
| `demo.tabData` | Data Sandbox Overview | نظرة عامة على بيئة البيانات |
| `demo.samName` | Sam Super (super@apex.demo) | سام سوبر (super@apex.demo) |
| `demo.samBadge` | Super Admin | مدير عام |
| `demo.samDesc` | Full access to company-wide analytics, settings, audit trails, and developer controls. | وصول كامل للتحليلات على مستوى الشركة والإعدادات وسجلات التدقيق وأدوات المطورين. |
| `demo.monaName` | Mona Marina (manager.a@apex.demo) | منى مارينا (manager.a@apex.demo) |
| `demo.monaBadge` | Site Manager | مدير موقع |
| `demo.monaDesc` | Manages Dubai Marina Resort. Review dashboards, update meters, and sign off data submissions. | تدير منتجع دبي مارينا. مراجعة لوحات التحكم وتحديث العدادات واعتماد إدخالات البيانات. |
| `demo.usamaName` | Usama Upload (uploader.a1@apex.demo) | أسامة أبلود (uploader.a1@apex.demo) |
| `demo.usamaBadge` | Data Entry | إدخال بيانات |
| `demo.usamaDesc` | Assigned to Dubai Marina Resort. Restricted access to enter and upload monthly ESG telemetry metrics. | مخصص لمنتجع دبي مارينا. وصول محدود لإدخال وتحميل مقاييس ESG الشهرية. |
| `demo.histTitle` | Historical Depth (Jan 2019 – Jun 2026) | العمق التاريخي (يناير 2019 – يونيو 2026) |
| `demo.histBody` | The database is pre-loaded with over 7 years of realistic hospitality telemetry. It models historical trends, including 2020-2021 COVID occupancy drops, subsequent recovery, and annual efficiency improvements. | قاعدة البيانات محملة مسبقاً بأكثر من 7 سنوات من بيانات الضيافة الواقعية. تحاكي الاتجاهات التاريخية بما في ذلك انخفاض الإشغال بسبب كوفيد 2020-2021 والتعافي اللاحق والتحسينات السنوية في الكفاءة. |
| `demo.portfolioTitle` | Property Portfolio | محفظة العقارات |
| `demo.marina` | Dubai Marina Resort: | منتجع دبي مارينا: |
| `demo.marinaDesc` | 300 rooms, full reporting suite. | 300 غرفة، مجموعة تقارير كاملة. |
| `demo.abuDhabi` | Abu Dhabi Downtown Hotel: | فندق أبوظبي داون تاون: |
| `demo.abuDhabiDesc` | 240 rooms, ~80% scale of the primary site. | 240 غرفة، ~80% من حجم الموقع الرئيسي. |
| `demo.benchTitle` | Modeled Benchmarks & Frameworks | المعايير والأطر المحاكاة |
| `demo.benchBody` | Data aligns with real UAE benchmarks (e.g., 45 kWh electricity / 280 L water per occupied room). Seasonality (summer AC load spikes) is accurately synthesized. Fully maps to ESG, Dubai Sustainable Tourism (DST), and Green Key standards. | البيانات متوافقة مع المعايير الإماراتية الحقيقية (مثلاً 45 كيلوواط ساعة كهرباء / 280 لتر مياه لكل غرفة مشغولة). الموسمية (ارتفاع حمل التكييف صيفاً) محاكاة بدقة. متوافق بالكامل مع معايير ESG وسياحة دبي المستدامة (DST) ومعايير المفتاح الأخضر. |

### 5. Login Page ([Login.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/pages/Authentication/Login.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `login.title` | ESGravity | ESGravity |
| `login.checkEmail` | Check your email | تحقق من بريدك الإلكتروني |
| `login.magicLinkSent` | We sent a secure magic link to | أرسلنا رابط دخول آمن إلى |
| `login.clickLink` | Click the link in the email to log in instantly. | انقر على الرابط في البريد لتسجيل الدخول فوراً. |
| `login.backToSignIn` | Back to sign in | العودة لتسجيل الدخول |
| `login.emailLabel` | Email Address | البريد الإلكتروني |
| `login.emailPlaceholder` | you@company.com | you@company.com |
| `login.sendingLink` | Sending link... | جاري إرسال الرابط... |
| `login.sendMagicLink` | Send Magic Link | إرسال رابط الدخول |
| `login.noAccount` | Don't have an account? | ليس لديك حساب؟ |
| `login.signUpHere` | Sign up here | سجّل هنا |

### 6. Signup Page ([Signup.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/pages/Authentication/Signup.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `signup.title` | Create Account | إنشاء حساب |
| `signup.checkEmail` | Check your email | تحقق من بريدك الإلكتروني |
| `signup.magicLinkSent` | We've sent a magic link to | أرسلنا رابطاً سحرياً إلى |
| `signup.clickToVerify` | Please click the link to verify your account and continue. | يرجى النقر على الرابط للتحقق من حسابك والمتابعة. |
| `signup.returnToSignIn` | Return to Sign In | العودة لتسجيل الدخول |
| `signup.firstName` | First Name | الاسم الأول |
| `signup.lastName` | Last Name | اسم العائلة |
| `signup.emailLabel` | Email Address | البريد الإلكتروني |
| `signup.creating` | Creating account... | جاري إنشاء الحساب... |
| `signup.createBtn` | Create Account | إنشاء حساب |
| `signup.viewDemo` | View Demo | عرض تجريبي |
| `signup.hasAccount` | Already have an account? | لديك حساب بالفعل؟ |
| `signup.signIn` | Sign in | تسجيل الدخول |

### 7. Magic Link & Reset Password

| Key | English | Arabic |
|-----|---------|--------|
| `magic.verifying` | Verifying security link... | جاري التحقق من رابط الأمان... |
| `magic.success` | Success! | تم بنجاح! |
| `magic.launching` | Authentication complete. Launching platform... | اكتمل التحقق. جاري تشغيل المنصة... |
| `magic.failed` | Verification Failed | فشل التحقق |
| `magic.backupCode` | Have a Backup Code? | هل لديك رمز احتياطي؟ |
| `magic.checkEmail` | Check your email for the backup access code. | تحقق من بريدك الإلكتروني للحصول على رمز الوصول الاحتياطي. |
| `reset.success` | Password Reset Successful! | تم إعادة تعيين كلمة المرور بنجاح! |
| `reset.redirecting` | Logging in and redirecting to dashboard... | جاري تسجيل الدخول والتوجيه للوحة التحكم... |
| `reset.newPassword` | New Password | كلمة المرور الجديدة |
| `reset.confirmPassword` | Confirm New Password | تأكيد كلمة المرور الجديدة |
| `reset.confirmPwSetup` | Confirm Password | تأكيد كلمة المرور |

### 8. Access Denied ([AccessDenied.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/components/ui/AccessDenied.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `access.title` | Access Restricted | الوصول مقيّد |
| `access.message` | You don't have the necessary permissions to view this page. If you believe this is an error, please contact your administrator. | ليس لديك الصلاحيات اللازمة لعرض هذه الصفحة. إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع المسؤول. |
| `access.goBack` | Go Back | العودة |

### 9. Confirm Modal ([ConfirmModal.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/components/ui/ConfirmModal.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `confirm.confirm` | Confirm | تأكيد |
| `confirm.cancel` | Cancel | إلغاء |

### 10. App-Level ([App.tsx](file:///c:/Users/20100/thefinal/n.v.a/frontend/src/App.tsx))

| Key | English | Arabic |
|-----|---------|--------|
| `app.loading` | Loading... | جاري التحميل... |
| `app.loadingProfile` | Loading profile... | جاري تحميل الملف الشخصي... |
| `app.notFound` | 404 - Not Found | 404 - الصفحة غير موجودة |

---

> [!IMPORTANT]
> **The remaining pages (Dashboard, Portfolio, Onboarding, Checklist, Meters, Data Entry, Users, Sites, Settings, Reports, Help, Developer Admin) contain 500+ additional strings.** Due to the massive size, I'll create Part 2 as a separate file. Should I continue with Part 2?

---

## Implementation Steps

1. **Create `src/i18n/en.ts`** — Export all keys above as a nested object
2. **Create `src/i18n/ar.ts`** — Mirror with Arabic values
3. **Create `src/i18n/index.ts`** — `useTranslation()` hook that reads from `localStorage`
4. **Add language toggle** to AppLayout navbar
5. **Replace all hardcoded strings** in each `.tsx` file with `t('key')`
6. **Add RTL CSS** — logical properties (`margin-inline-start` etc.)
7. **Test every page** in both EN and AR

> [!NOTE]
> The brand name **ESGravity** stays in English in both languages. Technical acronyms (GRI, SASB, ESG, TCFD, CSRD, CO₂, kWh, etc.) also remain in English per industry convention.
