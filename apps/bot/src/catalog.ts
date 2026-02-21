// Mock product catalog — temporary data layer
// When real products are stored in DB, replace with API calls

export interface Product {
  id: string;
  title: string;
  shortDesc: string;
  fullDesc: string;
  audience: string;
  contents: string;
  category: string;
}

export interface Category {
  id: string;
  title: string;
}

export const CATEGORIES: Category[] = [
  { id: "author", title: "Авторские курсы" },
  { id: "masterclass", title: "Мастер-классы" },
  { id: "personal", title: "Персональный курс" },
];

export const PRODUCTS: Product[] = [
  {
    id: "watercolor",
    title: "Акварель с нуля",
    shortDesc: "12 уроков для начинающих",
    fullDesc: "Полный курс акварельной живописи от базовых техник до сложных композиций.",
    audience: "Новичкам, которые хотят освоить акварель с нуля",
    contents: "12 видеоуроков, домашние задания, обратная связь",
    category: "author",
  },
  {
    id: "portrait",
    title: "Портретная живопись",
    shortDesc: "10 уроков портрета",
    fullDesc: "Научитесь рисовать реалистичные портреты маслом и акрилом.",
    audience: "Художникам с базовым опытом",
    contents: "10 видеоуроков, разбор пропорций, техника светотени",
    category: "author",
  },
  {
    id: "sketching",
    title: "Городской скетчинг",
    shortDesc: "8 уроков быстрого рисунка",
    fullDesc: "Рисуйте город вокруг себя: архитектура, кафе, люди в движении.",
    audience: "Всем, кто хочет рисовать на ходу",
    contents: "8 видеоуроков, скетчбук-задания",
    category: "masterclass",
  },
  {
    id: "botanical",
    title: "Ботаническая иллюстрация",
    shortDesc: "6 уроков botanical art",
    fullDesc: "Детальная ботаническая иллюстрация акварелью: цветы, листья, плоды.",
    audience: "Любителям природы и детальной графики",
    contents: "6 видеоуроков, референсы, PDF-гайды",
    category: "masterclass",
  },
  {
    id: "individual",
    title: "Индивидуальная программа",
    shortDesc: "Персональный план обучения",
    fullDesc: "Программа составляется под ваши цели и уровень. Личные созвоны с преподавателем.",
    audience: "Тем, кто хочет максимально быстрый прогресс",
    contents: "Персональный план, 4 созвона в месяц, разбор работ",
    category: "personal",
  },
];

// ---- Pricing ----

export interface PlanOption {
  id: string;
  label: string;
  callbackData: string;
  price: number;
  oldPrice?: number;
  badge?: string;
}

const MONTHLY_PRICE = 4990;

export function buildPlanOptions(): PlanOption[] {
  const quarterlyTotal = Math.round((3 * MONTHLY_PRICE * 0.9) / 10) * 10; // 13470
  const yearlyTotal = Math.round((12 * MONTHLY_PRICE * 0.75) / 10) * 10; // 44910

  return [
    {
      id: "monthly",
      label: "Ежемесячно",
      callbackData: "plan:monthly",
      price: MONTHLY_PRICE,
    },
    {
      id: "quarterly",
      label: "Ежеквартально",
      callbackData: "plan:quarterly",
      price: quarterlyTotal,
      oldPrice: 3 * MONTHLY_PRICE,
      badge: "–10%",
    },
    {
      id: "yearly",
      label: "Ежегодно",
      callbackData: "plan:yearly",
      price: yearlyTotal,
      oldPrice: 12 * MONTHLY_PRICE,
      badge: "–25%",
    },
  ];
}

export function money(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount);
}

/** For checkout, quarterly maps to "monthly" since no DB row for quarterly yet */
export function planIdForCheckout(planId: string): "monthly" | "yearly" {
  return planId === "yearly" ? "yearly" : "monthly";
}

export function getProductsByCategory(categoryId: string): Product[] {
  return PRODUCTS.filter((p) => p.category === categoryId);
}

export function getProductById(productId: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === productId);
}
