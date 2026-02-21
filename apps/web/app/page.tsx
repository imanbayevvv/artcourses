"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────

type TgUser = { id: number; username?: string; first_name?: string };

type AccessData = {
  ok: boolean;
  access: boolean;
  status: string;
  until: string | null;
  reason: string;
};

type SubData = {
  ok: boolean;
  status: string;
  current_period_end?: string;
  plan_id?: string;
  plan_title?: string;
};

type LibraryItem = { id: string; title: string; lessons: number };

type PlanItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  period: string;
  badge?: string;
};

type Tab = "library" | "catalog" | "profile";

// ── Mock data ──────────────────────────────────────────────────

interface MockLesson {
  id: string;
  title: string;
  duration: string;
  videoUrl: string;
}

interface MockCourse {
  id: string;
  title: string;
  description: string;
  lessons: MockLesson[];
}

const MOCK_COURSES: MockCourse[] = [
  {
    id: "course_1",
    title: "Watercolor Basics",
    description: "Полный курс акварельной живописи от базовых техник до сложных композиций.",
    lessons: [
      { id: "l1", title: "Материалы и кисти", duration: "12:30", videoUrl: "" },
      { id: "l2", title: "Заливка и градиент", duration: "15:00", videoUrl: "" },
      { id: "l3", title: "Смешивание цветов", duration: "18:20", videoUrl: "" },
      { id: "l4", title: "Мокрая техника", duration: "14:10", videoUrl: "" },
      { id: "l5", title: "Сухая кисть", duration: "11:45", videoUrl: "" },
      { id: "l6", title: "Пейзаж: небо", duration: "20:00", videoUrl: "" },
      { id: "l7", title: "Пейзаж: вода", duration: "22:15", videoUrl: "" },
      { id: "l8", title: "Натюрморт: фрукты", duration: "19:30", videoUrl: "" },
      { id: "l9", title: "Натюрморт: цветы", duration: "21:00", videoUrl: "" },
      { id: "l10", title: "Портрет: основы", duration: "25:00", videoUrl: "" },
      { id: "l11", title: "Композиция", duration: "16:40", videoUrl: "" },
      { id: "l12", title: "Финальный проект", duration: "30:00", videoUrl: "" },
    ],
  },
  {
    id: "course_2",
    title: "Sketching 101",
    description: "Основы быстрого рисунка карандашом и маркерами.",
    lessons: [
      { id: "s1", title: "Линия и штрих", duration: "10:00", videoUrl: "" },
      { id: "s2", title: "Формы и объём", duration: "13:20", videoUrl: "" },
      { id: "s3", title: "Перспектива", duration: "17:00", videoUrl: "" },
      { id: "s4", title: "Скетч людей", duration: "15:30", videoUrl: "" },
      { id: "s5", title: "Городской скетчинг", duration: "20:00", videoUrl: "" },
      { id: "s6", title: "Скетч еды", duration: "12:45", videoUrl: "" },
      { id: "s7", title: "Маркеры: основы", duration: "14:00", videoUrl: "" },
      { id: "s8", title: "Финальный скетч", duration: "22:00", videoUrl: "" },
    ],
  },
];

interface CatalogProduct {
  id: string;
  title: string;
  shortDesc: string;
  category: string;
}

const CATALOG_CATEGORIES = [
  { id: "author", title: "Авторские курсы" },
  { id: "masterclass", title: "Мастер-классы" },
  { id: "personal", title: "Персональный курс" },
];

const CATALOG_PRODUCTS: CatalogProduct[] = [
  { id: "watercolor", title: "Акварель с нуля", shortDesc: "12 уроков для начинающих", category: "author" },
  { id: "portrait", title: "Портретная живопись", shortDesc: "10 уроков портрета", category: "author" },
  { id: "sketching", title: "Городской скетчинг", shortDesc: "8 уроков быстрого рисунка", category: "masterclass" },
  { id: "botanical", title: "Ботаническая иллюстрация", shortDesc: "6 уроков botanical art", category: "masterclass" },
  { id: "individual", title: "Индивидуальная программа", shortDesc: "Персональный план обучения", category: "personal" },
];

// ── Plan computation (quarterly from monthly) ──────────────────

interface DisplayPlan {
  id: string;
  label: string;
  period: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  recommended?: boolean;
  checkoutPlanId: string; // what to send to API
}

function buildDisplayPlans(apiPlans: PlanItem[]): DisplayPlan[] {
  const monthlyPlan = apiPlans.find((p) => p.period === "monthly");
  if (!monthlyPlan) return [];

  const mp = monthlyPlan.price;
  const quarterlyTotal = Math.round((3 * mp * 0.9) / 10) * 10;
  const yearlyTotal = Math.round((12 * mp * 0.75) / 10) * 10;

  return [
    {
      id: "monthly",
      label: "Ежемесячно",
      period: "monthly",
      price: mp,
      checkoutPlanId: "monthly",
    },
    {
      id: "quarterly",
      label: "Ежеквартально",
      period: "quarterly",
      price: quarterlyTotal,
      oldPrice: 3 * mp,
      badge: "–10%",
      recommended: true,
      checkoutPlanId: "monthly",
    },
    {
      id: "yearly",
      label: "Ежегодно",
      period: "yearly",
      price: yearlyTotal,
      oldPrice: 12 * mp,
      badge: "–25%",
      checkoutPlanId: "yearly",
    },
  ];
}

// ── Helpers ─────────────────────────────────────────────────────

function money(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU");
}

const REASON_LABELS: Record<string, string> = {
  active: "Подписка активна",
  past_due_grace: "Ожидается оплата (льготный период)",
  canceled_until_end: "Подписка отменена",
  expired: "Подписка истекла",
  none: "Нет подписки",
};

const PERIOD_LABELS: Record<string, string> = {
  monthly: "в месяц",
  quarterly: "в квартал",
  yearly: "в год",
};

// ── Main Component ──────────────────────────────────────────────

export default function Page() {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Auth state
  const [user, setUser] = useState<TgUser | null>(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  // Data state
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [subData, setSubData] = useState<SubData | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // UI state
  const [tab, setTab] = useState<Tab>("library");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [showManageSub, setShowManageSub] = useState(false);
  const [toast, setToast] = useState("");

  // ── Auto-login on mount ────────────────────────────────────

  useEffect(() => {
    autoLogin();
  }, []);

  async function autoLogin() {
    setAuthLoading(true);
    setAuthError("");

    try {
      // @ts-ignore
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }

      const initData = tg?.initData || "";
      if (!initData) {
        setAuthError("no_init_data");
        return;
      }

      const r = await fetch(`${API}/auth/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const data = await r.json();

      if (!data.ok) {
        setAuthError("auth_failed");
        return;
      }

      setUser(data.tgUser);
      await refreshAll(data.tgUser.id);
    } catch (err) {
      console.error("Auto-login error:", err);
      setAuthError("network_error");
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Data loaders ───────────────────────────────────────────

  const refreshAll = useCallback(
    async (uid: number) => {
      await Promise.all([checkAccess(uid), loadSubscription(uid), loadPlans()]);
    },
    [API]
  );

  async function checkAccess(uid: number) {
    try {
      const r = await fetch(`${API}/me/access?telegram_user_id=${uid}`);
      const data: AccessData = await r.json();
      setAccessData(data);
      if (data.access) {
        await loadLibrary(uid);
      } else {
        setLibrary([]);
      }
    } catch (err) {
      console.error("Access error:", err);
    }
  }

  async function loadSubscription(uid: number) {
    try {
      const r = await fetch(`${API}/me/subscription?telegram_user_id=${uid}`);
      const data: SubData = await r.json();
      setSubData(data);
    } catch (err) {
      console.error("Subscription error:", err);
    }
  }

  async function loadLibrary(uid: number) {
    try {
      const r = await fetch(`${API}/library?telegram_user_id=${uid}`);
      if (r.ok) {
        const data = await r.json();
        setLibrary(data.items ?? []);
      }
    } catch (err) {
      console.error("Library error:", err);
    }
  }

  async function loadPlans() {
    try {
      const r = await fetch(`${API}/plans`);
      if (r.ok) {
        const data = await r.json();
        setPlans(data.items ?? []);
      }
    } catch (err) {
      console.error("Plans error:", err);
    }
  }

  // ── Actions ────────────────────────────────────────────────

  async function handleCheckout(checkoutPlanId: string) {
    if (!user || actionLoading) return;
    setActionLoading(true);

    try {
      const r = await fetch(`${API}/checkout/start?telegram_user_id=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: checkoutPlanId }),
      });
      const data = await r.json();

      if (!data.ok) {
        showToast("Ошибка: " + (data.error ?? "неизвестная ошибка"));
        return;
      }

      // @ts-ignore
      const tg = window.Telegram?.WebApp;
      if (tg?.openLink) {
        tg.openLink(data.checkout_url);
      } else {
        window.location.href = data.checkout_url;
      }
    } catch (err: any) {
      showToast("Ошибка: " + (err?.message ?? err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!user || actionLoading) return;

    const until = subData?.current_period_end ? formatDate(subData.current_period_end) : "";
    const msg = until
      ? `Отменить подписку? Доступ сохранится до ${until}`
      : "Отменить подписку?";

    if (!confirm(msg)) return;

    setActionLoading(true);
    try {
      const r = await fetch(`${API}/subscriptions/cancel?telegram_user_id=${user.id}`, {
        method: "POST",
      });
      const data = await r.json();

      if (!data.ok) {
        showToast("Ошибка отмены: " + (data.error ?? ""));
        return;
      }

      showToast("Подписка отменена");
      setShowManageSub(false);
      await refreshAll(user.id);
    } catch (err: any) {
      showToast("Ошибка: " + (err?.message ?? err));
    } finally {
      setActionLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Derived state ──────────────────────────────────────────

  const hasAccess = accessData?.access === true;
  const displayPlans = buildDisplayPlans(plans);
  const needsPaywall =
    accessData && !accessData.access && accessData.reason !== "active";

  // ── Loading / Error screens ────────────────────────────────

  if (authLoading) {
    return (
      <main className="app-container">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Загрузка...</p>
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="app-container">
        <div className="error-screen">
          <div className="error-icon">⚠️</div>
          {authError === "no_init_data" && (
            <>
              <h2>Откройте через Telegram</h2>
              <p>Приложение работает только внутри Telegram Mini App.</p>
              {process.env.NEXT_PUBLIC_BOT_USERNAME && (
                <a
                  href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`}
                  className="btn btn-primary"
                  style={{ marginTop: 16, display: "inline-block" }}
                >
                  Открыть в Telegram
                </a>
              )}
            </>
          )}
          {authError === "auth_failed" && (
            <>
              <h2>Ошибка авторизации</h2>
              <p>Не удалось подтвердить данные. Попробуйте переоткрыть приложение.</p>
            </>
          )}
          {authError === "network_error" && (
            <>
              <h2>Ошибка сети</h2>
              <p>Проверьте подключение к интернету и попробуйте снова.</p>
              <button className="btn btn-primary" onClick={autoLogin} style={{ marginTop: 16 }}>
                Повторить
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  // ── Lesson player sub-view ─────────────────────────────────

  if (selectedLesson && selectedCourse) {
    const course = MOCK_COURSES.find((c) => c.id === selectedCourse);
    const lessonIdx = course?.lessons.findIndex((l) => l.id === selectedLesson) ?? -1;
    const lesson = course?.lessons[lessonIdx];
    const prevLesson = course?.lessons[lessonIdx - 1];
    const nextLesson = course?.lessons[lessonIdx + 1];

    return (
      <main className="app-container">
        <div className="lesson-player">
          <button className="btn-back" onClick={() => setSelectedLesson(null)}>
            ← Назад к урокам
          </button>

          <h2 className="lesson-title">{lesson?.title ?? "Урок"}</h2>
          <p className="lesson-meta">Урок {lessonIdx + 1} из {course?.lessons.length} · {lesson?.duration}</p>

          <div className="video-placeholder">
            <div className="video-icon">▶</div>
            <p>Видео урока</p>
          </div>

          <div className="lesson-nav">
            <button
              className="btn btn-outline"
              disabled={!prevLesson}
              onClick={() => prevLesson && setSelectedLesson(prevLesson.id)}
            >
              ← Назад
            </button>
            <button
              className="btn btn-primary"
              disabled={!nextLesson}
              onClick={() => nextLesson && setSelectedLesson(nextLesson.id)}
            >
              Следующий →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Course detail sub-view ─────────────────────────────────

  if (selectedCourse) {
    const course = MOCK_COURSES.find((c) => c.id === selectedCourse);

    if (!course) {
      return (
        <main className="app-container">
          <button className="btn-back" onClick={() => setSelectedCourse(null)}>← Назад</button>
          <p>Курс не найден</p>
        </main>
      );
    }

    return (
      <main className="app-container">
        <button className="btn-back" onClick={() => setSelectedCourse(null)}>
          ← Назад
        </button>

        <h2 className="course-title">{course.title}</h2>
        <p className="course-desc">{course.description}</p>

        <div className="lessons-list">
          <h3>Уроки ({course.lessons.length})</h3>
          {course.lessons.map((lesson, idx) => (
            <button
              key={lesson.id}
              className="lesson-card"
              onClick={() => setSelectedLesson(lesson.id)}
            >
              <span className="lesson-num">{idx + 1}</span>
              <span className="lesson-info">
                <span className="lesson-name">{lesson.title}</span>
                <span className="lesson-dur">{lesson.duration}</span>
              </span>
              <span className="lesson-play">▶</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // ── Manage Subscription sub-view ───────────────────────────

  if (showManageSub) {
    return (
      <main className="app-container">
        <button className="btn-back" onClick={() => setShowManageSub(false)}>
          ← Назад
        </button>

        <h2 style={{ margin: "16px 0 8px" }}>Управление подпиской</h2>

        <div className="sub-details-card">
          <div className="sub-row">
            <span className="sub-label">Статус</span>
            <span className={`sub-status sub-status--${subData?.status ?? "none"}`}>
              {REASON_LABELS[accessData?.reason ?? "none"] ?? subData?.status ?? "Нет данных"}
            </span>
          </div>
          {subData?.plan_title && (
            <div className="sub-row">
              <span className="sub-label">План</span>
              <span>{subData.plan_title}</span>
            </div>
          )}
          {subData?.plan_id && (
            <div className="sub-row">
              <span className="sub-label">Период</span>
              <span>{PERIOD_LABELS[subData.plan_id] ?? subData.plan_id}</span>
            </div>
          )}
          {subData?.current_period_end && (
            <div className="sub-row">
              <span className="sub-label">Доступ до</span>
              <span>{formatDate(subData.current_period_end)}</span>
            </div>
          )}
        </div>

        {accessData?.reason === "canceled_until_end" && accessData.until && (
          <div className="info-banner">
            Подписка отменена. Доступ сохранён до {formatDate(accessData.until)}.
          </div>
        )}

        {accessData?.reason === "past_due_grace" && (
          <div className="warning-banner">
            ⚠️ Проблема с оплатой. Обновите способ оплаты, чтобы сохранить доступ.
          </div>
        )}

        {(subData?.status === "active" || subData?.status === "past_due") && (
          <button
            className="btn btn-danger"
            onClick={handleCancel}
            disabled={actionLoading}
            style={{ marginTop: 16 }}
          >
            {actionLoading ? "Отмена..." : "Отменить подписку"}
          </button>
        )}

        {(subData?.status === "expired" || subData?.status === "none" || accessData?.reason === "expired") && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Выберите план</h3>
            <PlanCards plans={displayPlans} onCheckout={handleCheckout} loading={actionLoading} />
          </div>
        )}
      </main>
    );
  }

  // ── Main layout with tabs ──────────────────────────────────

  return (
    <main className="app-container">
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Tab content */}
      <div className="tab-content">
        {tab === "library" && (
          <LibraryTab
            hasAccess={hasAccess}
            accessData={accessData}
            library={library}
            displayPlans={displayPlans}
            onSelectCourse={setSelectedCourse}
            onCheckout={handleCheckout}
            actionLoading={actionLoading}
          />
        )}
        {tab === "catalog" && (
          <CatalogTab
            hasAccess={hasAccess}
            displayPlans={displayPlans}
            onCheckout={handleCheckout}
            actionLoading={actionLoading}
          />
        )}
        {tab === "profile" && (
          <ProfileTab
            user={user}
            accessData={accessData}
            subData={subData}
            onManage={() => setShowManageSub(true)}
          />
        )}
      </div>

      {/* Tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-item ${tab === "library" ? "tab-active" : ""}`}
          onClick={() => setTab("library")}
        >
          <span className="tab-icon">📚</span>
          <span className="tab-label">Библиотека</span>
        </button>
        <button
          className={`tab-item ${tab === "catalog" ? "tab-active" : ""}`}
          onClick={() => setTab("catalog")}
        >
          <span className="tab-icon">🛍</span>
          <span className="tab-label">Каталог</span>
        </button>
        <button
          className={`tab-item ${tab === "profile" ? "tab-active" : ""}`}
          onClick={() => setTab("profile")}
        >
          <span className="tab-icon">👤</span>
          <span className="tab-label">Профиль</span>
        </button>
      </nav>
    </main>
  );
}

// ── Tab: Library ────────────────────────────────────────────────

function LibraryTab({
  hasAccess,
  accessData,
  library,
  displayPlans,
  onSelectCourse,
  onCheckout,
  actionLoading,
}: {
  hasAccess: boolean;
  accessData: AccessData | null;
  library: LibraryItem[];
  displayPlans: DisplayPlan[];
  onSelectCourse: (id: string) => void;
  onCheckout: (planId: string) => void;
  actionLoading: boolean;
}) {
  if (!hasAccess) {
    return (
      <Paywall
        accessData={accessData}
        plans={displayPlans}
        onCheckout={onCheckout}
        loading={actionLoading}
      />
    );
  }

  return (
    <div>
      {/* Canceled banner */}
      {accessData?.reason === "canceled_until_end" && accessData.until && (
        <div className="info-banner" style={{ marginBottom: 16 }}>
          Подписка отменена, доступ до {formatDate(accessData.until)}
        </div>
      )}

      {/* Past due banner */}
      {accessData?.reason === "past_due_grace" && (
        <div className="warning-banner" style={{ marginBottom: 16 }}>
          ⚠️ Проблема с оплатой. Обновите способ оплаты.
        </div>
      )}

      <h2 className="section-title">Мои курсы</h2>

      {library.length === 0 && <p className="muted">Загрузка курсов...</p>}

      {library.map((item) => {
        const mockCourse = MOCK_COURSES.find((c) => c.id === item.id);
        return (
          <button
            key={item.id}
            className="course-card"
            onClick={() => onSelectCourse(item.id)}
          >
            <div className="course-card-info">
              <span className="course-card-title">{item.title}</span>
              <span className="course-card-meta">{item.lessons} уроков</span>
            </div>
            <span className="course-card-arrow">→</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Tab: Catalog ────────────────────────────────────────────────

function CatalogTab({
  hasAccess,
  displayPlans,
  onCheckout,
  actionLoading,
}: {
  hasAccess: boolean;
  displayPlans: DisplayPlan[];
  onCheckout: (planId: string) => void;
  actionLoading: boolean;
}) {
  return (
    <div>
      <h2 className="section-title">Каталог курсов</h2>

      {CATALOG_CATEGORIES.map((cat) => {
        const products = CATALOG_PRODUCTS.filter((p) => p.category === cat.id);
        if (products.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 20 }}>
            <h3 className="category-title">{cat.title}</h3>
            {products.map((product) => (
              <div key={product.id} className="catalog-card">
                <div className="catalog-card-title">{product.title}</div>
                <div className="catalog-card-desc">{product.shortDesc}</div>
              </div>
            ))}
          </div>
        );
      })}

      {!hasAccess && displayPlans.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 className="section-title">Получить доступ</h3>
          <PlanCards plans={displayPlans} onCheckout={onCheckout} loading={actionLoading} />
        </div>
      )}
    </div>
  );
}

// ── Tab: Profile ────────────────────────────────────────────────

function ProfileTab({
  user,
  accessData,
  subData,
  onManage,
}: {
  user: TgUser | null;
  accessData: AccessData | null;
  subData: SubData | null;
  onManage: () => void;
}) {
  return (
    <div>
      <h2 className="section-title">Профиль</h2>

      {user && (
        <div className="profile-card">
          <div className="profile-avatar">
            {(user.first_name?.[0] ?? "U").toUpperCase()}
          </div>
          <div>
            <div className="profile-name">{user.first_name ?? "Пользователь"}</div>
            {user.username && <div className="profile-username">@{user.username}</div>}
          </div>
        </div>
      )}

      <h3 style={{ margin: "20px 0 8px" }}>Подписка</h3>

      <div className="sub-details-card">
        <div className="sub-row">
          <span className="sub-label">Статус</span>
          <span className={`sub-status sub-status--${subData?.status ?? "none"}`}>
            {REASON_LABELS[accessData?.reason ?? "none"] ?? subData?.status ?? "Нет подписки"}
          </span>
        </div>
        {subData?.plan_title && (
          <div className="sub-row">
            <span className="sub-label">План</span>
            <span>{subData.plan_title}</span>
          </div>
        )}
        {subData?.current_period_end && (
          <div className="sub-row">
            <span className="sub-label">Доступ до</span>
            <span>{formatDate(subData.current_period_end)}</span>
          </div>
        )}
      </div>

      {accessData?.reason === "canceled_until_end" && accessData.until && (
        <div className="info-banner" style={{ marginTop: 12 }}>
          Подписка отменена, доступ до {formatDate(accessData.until)}
        </div>
      )}

      {accessData?.reason === "past_due_grace" && (
        <div className="warning-banner" style={{ marginTop: 12 }}>
          ⚠️ Проблема с оплатой
        </div>
      )}

      {subData && subData.status !== "none" && (
        <button className="btn btn-outline" onClick={onManage} style={{ marginTop: 16, width: "100%" }}>
          Управление подпиской
        </button>
      )}
    </div>
  );
}

// ── Paywall ─────────────────────────────────────────────────────

function Paywall({
  accessData,
  plans,
  onCheckout,
  loading,
}: {
  accessData: AccessData | null;
  plans: DisplayPlan[];
  onCheckout: (planId: string) => void;
  loading: boolean;
}) {
  return (
    <div className="paywall">
      <div className="paywall-icon">🎨</div>
      <h2>Получите доступ к курсам</h2>
      <p className="paywall-desc">
        Все курсы, мастер-классы и материалы — в одной подписке.
      </p>

      {accessData?.reason === "expired" && (
        <div className="warning-banner" style={{ marginBottom: 16 }}>
          Ваша подписка истекла. Продлите, чтобы вернуть доступ.
        </div>
      )}

      {accessData?.reason === "past_due_grace" && (
        <div className="warning-banner" style={{ marginBottom: 16 }}>
          ⚠️ Проблема с оплатой. Обновите способ оплаты или выберите новый план.
        </div>
      )}

      <PlanCards plans={plans} onCheckout={onCheckout} loading={loading} />
    </div>
  );
}

// ── Plan Cards ──────────────────────────────────────────────────

function PlanCards({
  plans,
  onCheckout,
  loading,
}: {
  plans: DisplayPlan[];
  onCheckout: (planId: string) => void;
  loading: boolean;
}) {
  return (
    <div className="plans-list">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`plan-card ${plan.recommended ? "plan-card--recommended" : ""}`}
        >
          {plan.badge && <span className="plan-badge">{plan.badge}</span>}
          {plan.recommended && <span className="plan-rec">Рекомендуем</span>}

          <div className="plan-label">{plan.label}</div>

          <div className="plan-price-row">
            {plan.oldPrice && (
              <span className="plan-old-price">{money(plan.oldPrice)} ₸</span>
            )}
            <span className="plan-price">{money(plan.price)} ₸</span>
            <span className="plan-period">{PERIOD_LABELS[plan.period] ?? ""}</span>
          </div>

          <button
            className="btn btn-primary plan-btn"
            onClick={() => onCheckout(plan.checkoutPlanId)}
            disabled={loading}
          >
            {loading ? "Загрузка..." : "Оплатить"}
          </button>
        </div>
      ))}
    </div>
  );
}
