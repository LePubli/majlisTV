// Langues disponibles, sens d'écriture et textes. Ajouter une langue = ajouter une entrée dans les 3 objets.
export const LOCALES = { fr: 'Français', en: 'English', ar: 'العربية' };
export const DIR = { fr: 'ltr', en: 'ltr', ar: 'rtl' };
export const DICT = {
  fr: { tagline: 'Les conférences, à la demande.', login: 'Connexion', register: 'Créer un compte', logout: 'Déconnexion', account: 'Mon compte', email: 'Email', password: 'Mot de passe (8 caractères min.)', name: 'Nom', submit: 'Valider', role: 'Rôle', soon: 'Bientôt', hello: 'Bonjour', errInvalid: 'Identifiants invalides', errExists: 'Email déjà utilisé', errGeneric: 'Une erreur est survenue', browse: 'Le catalogue arrive bientôt.' },
  en: { tagline: 'Conferences, on demand.', login: 'Log in', register: 'Sign up', logout: 'Log out', account: 'My account', email: 'Email', password: 'Password (8 characters min.)', name: 'Name', submit: 'Submit', role: 'Role', soon: 'Soon', hello: 'Hello', errInvalid: 'Invalid credentials', errExists: 'Email already in use', errGeneric: 'Something went wrong', browse: 'The catalog is coming soon.' },
  ar: { tagline: 'المؤتمرات عند الطلب.', login: 'تسجيل الدخول', register: 'إنشاء حساب', logout: 'تسجيل الخروج', account: 'حسابي', email: 'البريد الإلكتروني', password: 'كلمة المرور (8 أحرف على الأقل)', name: 'الاسم', submit: 'تأكيد', role: 'الدور', soon: 'قريبًا', hello: 'مرحبًا', errInvalid: 'بيانات الدخول غير صحيحة', errExists: 'البريد الإلكتروني مستخدم بالفعل', errGeneric: 'حدث خطأ', browse: 'الفهرس قريبًا.' },
};
export const getLocale = (value) => (DICT[value] ? value : 'fr');
