"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useLiveQuery } from "dexie-react-hooks";
import { CartModal } from "./CartModal";
import { CartSidebar } from "./CartSidebar";
import { db, type Product } from "./db";
import { LowStockReportModal } from "./LowStockReportModal";
import { WeeklySalesChartModal } from "./WeeklySalesChartModal";
import { DailySalesModal } from "./DailySalesModal";
import { TodaySalesModal } from "./TodaySalesModal";
import { StockCostModal } from "./StockCostModal";
import { ShiftModal } from "./ShiftModal";
import { ProductFormModal } from "./ProductFormModal";
import { ProductList } from "./ProductList";
import { ThermalPrinterModal } from "./ThermalPrinterModal";
import { UsersModal } from "./UsersModal";
import { LocalesModal } from "./LocalesModal";
import { ProductLocalSelectorModal } from "./ProductLocalSelectorModal";
import { useAuth } from "./src/components/AuthGate";
import { importProductsRemote, syncRemoteSnapshot } from "./src/lib/api-client";
import { ToastContainer } from "./Toast";

type ThemeMode = "light" | "dark";

const KIOSK_MODE_STORAGE_KEY = "app:kiosk-mode";
const THEME_STORAGE_KEY = "theme";

function parseKioskModeFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const value = params.get("kioskMode") ?? params.get("kiosk");

  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["0", "false", "off", "no"].includes(normalizedValue)) {
    return false;
  }

  return true;
}

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

async function getOpenShiftForUser(userId: number | null | undefined) {
  if (userId === undefined) {
    return undefined;
  }

  const openShifts = await db.shifts.where("status").equals("open").toArray();

  return openShifts
    .filter((shift) => {
      if (userId === null) {
        return !shift.openedByUserId;
      }

      return shift.openedByUserId === userId;
    })
    .sort((a, b) => b.openedAt - a.openedAt)[0];
}

function CurrentDateTime({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(new Date());
    updateNow();
    const intervalId = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const currentTime = now
    ? now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const currentDate = now
    ? now.toLocaleDateString("es-AR", compact
        ? { day: "2-digit", month: "2-digit", year: "numeric" }
        : {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
    : "--/--/----";

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
          : "w-full px-1 text-center"
      }
    >
      <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-medium capitalize text-slate-500 dark:text-slate-300`}>
        {currentDate}
      </p>
      <p className={`${compact ? "text-base leading-tight" : "text-sm"} font-black tracking-tight text-slate-900 dark:text-slate-50`}>
        {currentTime}
      </p>
    </div>
  );
}

export default function Home() {
  const { signOut, user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLowStockOpen, setIsLowStockOpen] = useState(false);
  const [isWeeklySalesOpen, setIsWeeklySalesOpen] = useState(false);
  const [isDailySalesOpen, setIsDailySalesOpen] = useState(false);
  const [isTodaySalesOpen, setIsTodaySalesOpen] = useState(false);
  const [isStockCostOpen, setIsStockCostOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isLocalesModalOpen, setIsLocalesModalOpen] = useState(false);
  const [isProductLocalSelectorOpen, setIsProductLocalSelectorOpen] = useState(false);
  const [isThermalPrinterOpen, setIsThermalPrinterOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [preferredProductLocalId, setPreferredProductLocalId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [kioskModePreference, setKioskModePreference] = useState(false);
  const [isKioskForcedByQuery, setIsKioskForcedByQuery] = useState(false);
  const [isLargeViewport, setIsLargeViewport] = useState(false);
  const [isTouchViewport, setIsTouchViewport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSyncingRef = useRef(false);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  const cartCount = useLiveQuery(() => db.cart.count()) || 0;
  const availableLocales = useLiveQuery(() => db.locals.orderBy("name").toArray(), []);
  const activeShift = useLiveQuery(() => getOpenShiftForUser(user?.id), [user?.id]);
  const hasCurrentOpenShift =
    activeShift === undefined ? hasOpenShift : Boolean(activeShift);
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    () => navigator.onLine,
    () => true,
  );
  const isOffline = !isOnline;

  const syncPendingOrders = async () => {
    if (isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      await syncRemoteSnapshot();
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const syncAndCheckShift = async () => {
      if (!user) {
        if (!isCancelled) {
          setHasOpenShift(null);
        }
        return;
      }

      try {
        if (isOnline) {
          await syncPendingOrders();
        }
      } finally {
        const currentShift = await getOpenShiftForUser(user.id);
        if (!isCancelled) {
          setHasOpenShift(Boolean(currentShift));
        }
      }
    };

    void syncAndCheckShift();

    return () => {
      isCancelled = true;
    };
  }, [isOnline, user]);

  useEffect(() => {
    if (!user || hasCurrentOpenShift !== false) {
      return;
    }

    const timeoutId = window.setTimeout(() => setIsShiftModalOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [hasCurrentOpenShift, user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      setTheme(storedTheme === "dark" ? "dark" : "light");
      setIsThemeLoaded(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const largeViewportQuery = window.matchMedia("(min-width: 1024px)");
    const touchViewportQuery = window.matchMedia("(pointer: coarse)");

    const syncViewport = () => {
      setIsLargeViewport(largeViewportQuery.matches);
      setIsTouchViewport(touchViewportQuery.matches);
    };

    const syncKioskMode = () => {
      const kioskModeFromQuery = parseKioskModeFromSearch(window.location.search);

      if (kioskModeFromQuery !== null) {
        setKioskModePreference(kioskModeFromQuery);
        setIsKioskForcedByQuery(true);
        return;
      }

      setIsKioskForcedByQuery(false);
      setKioskModePreference(window.localStorage.getItem(KIOSK_MODE_STORAGE_KEY) === "true");
    };

    syncViewport();
    syncKioskMode();

    largeViewportQuery.addEventListener("change", syncViewport);
    touchViewportQuery.addEventListener("change", syncViewport);
    window.addEventListener("popstate", syncKioskMode);

    return () => {
      largeViewportQuery.removeEventListener("change", syncViewport);
      touchViewportQuery.removeEventListener("change", syncViewport);
      window.removeEventListener("popstate", syncKioskMode);
    };
  }, []);

  useEffect(() => {
    if (!isThemeLoaded) {
      return;
    }

    const root = document.documentElement;
    const isDarkMode = theme === "dark";

    root.className = root.className
      .split(" ")
      .filter((className) => className && className !== "dark")
      .join(" ");

    if (isDarkMode) {
      root.classList.add("dark");
    }

    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isThemeLoaded, theme]);

  const isKioskMode = kioskModePreference && isLargeViewport;

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.kioskMode = isKioskMode ? "true" : "false";

    return () => {
      delete root.dataset.kioskMode;
    };
  }, [isKioskMode]);

  useEffect(() => {
    if (!isQuickMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!quickMenuRef.current?.contains(event.target as Node)) {
        setIsQuickMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsQuickMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isQuickMenuOpen]);

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setPreferredProductLocalId(null);
    setIsModalOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setPreferredProductLocalId(null);
    setIsProductLocalSelectorOpen(true);
  };

  const handleMenuAction = (action: () => void) => {
    setIsQuickMenuOpen(false);
    action();
  };

  const handleToggleKioskMode = () => {
    if (isKioskForcedByQuery || typeof window === "undefined") {
      return;
    }

    setKioskModePreference((current) => {
      const nextValue = !current;
      window.localStorage.setItem(KIOSK_MODE_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  };

  const isDarkMode = theme === "dark";
  const showWideCartSidebar = isKioskMode;
  const isTouchOptimized = isTouchViewport || isKioskMode;
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const products: Product[] = JSON.parse(content);

        if (!Array.isArray(products)) {
          alert("El archivo no contiene un formato de catalogo valido.");
          return;
        }

        if (
          confirm(
            `Se importaran ${products.length} productos. Deseas borrar el catalogo actual antes de restaurar?`,
          )
        ) {
          const productsToImport = products.map((product) => {
            const rest = { ...product };
            delete rest.id;
            rest.cost = rest.cost ?? rest.price ?? 0;
            rest.lowStockAlertThreshold = rest.lowStockAlertThreshold ?? 5;
            return rest;
          });
          await importProductsRemote(productsToImport);
          alert("Catalogo restaurado con exito.");
        }
      } catch {
        alert("Error al importar el archivo. Asegurate de que sea un JSON valido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <main
      className={`app-shell min-h-[100dvh] bg-white transition-colors duration-300 print:hidden dark:bg-slate-950 ${
        isKioskMode
          ? "px-2 pb-2 pt-2 sm:px-3 lg:px-4 xl:h-screen xl:overflow-hidden"
          : "h-[100dvh] overflow-hidden px-4 pb-4 pt-4 sm:px-6 lg:px-8 xl:h-screen xl:overflow-hidden"
      }`}
    >
      {isOffline && (
        <div className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-bold text-white shadow-md animate-pulse print:hidden">
          <span className="text-lg">!</span>
          Modo offline: estas trabajando con los datos locales del dispositivo.
        </div>
      )}

      {isSyncing && (
        <div className="fixed bottom-20 right-4 z-[60] flex items-center gap-3 rounded-full bg-blue-600 px-6 py-3 text-white shadow-2xl animate-bounce print:hidden">
          <span className="animate-spin">o</span>
          Sincronizando pedidos...
        </div>
      )}

      <ToastContainer />

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleImport}
      />

      <div className={`print:hidden ${isKioskMode ? "mx-auto max-w-none h-full xl:h-full" : "mx-auto h-full max-w-[1600px] xl:h-full"}`}>
        <div
          className={`grid ${
            isKioskMode
              ? "h-full gap-3 lg:grid-cols-[minmax(0,1fr)_clamp(250px,22vw,290px)] xl:gap-4"
              : "h-full gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-5"
          }`}
        >
          <section
            className={`rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-colors dark:border-slate-800 dark:bg-slate-900/40 ${
              isKioskMode
                ? "p-4 sm:p-5 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden"
                : "flex min-h-0 flex-col overflow-hidden p-4 sm:p-5 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden"
            }`}
          >
            <ProductList
              canManageProducts={user?.role === "admin"}
              onEditProduct={handleEditProduct}
              isKioskMode={isKioskMode}
              isTouchOptimized={isTouchOptimized}
              leadingContent={
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Image
                        src="/logo.png"
                        alt=""
                        width={44}
                        height={44}
                        className="h-10 w-10 shrink-0 object-contain"
                        loading="eager"
                      />
                      <p
                        className={`min-w-0 truncate font-black text-slate-900 dark:text-slate-100 ${
                          isKioskMode ? "text-lg sm:text-xl" : "text-base sm:text-lg"
                        }`}
                      >
                        {user?.fullName ?? user?.username ?? "Sin usuario"}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {user?.localName && (
                        <p className="text-sm font-medium text-slate-500">
                          {user.localName}
                        </p>
                      )}
                      <span
                        className={`text-xs font-semibold ${
                          isOffline ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {isOffline ? "Offline" : "Online"}
                      </span>
                      {isKioskMode && (
                        <CurrentDateTime compact />
                      )}
                    </div>
                </div>
              }
              extraControls={
                <div
                  className={`flex flex-col gap-2 ${
                    isKioskMode
                      ? "lg:w-[140px] lg:items-stretch"
                      : "w-full sm:w-auto sm:flex-row sm:flex-wrap xl:w-[170px] xl:flex-col xl:items-stretch"
                  }`}
                >
                  <button
                    onClick={() => setIsCartOpen(true)}
                    className={`touch-target relative rounded-full border border-blue-200 bg-blue-100 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-200 ${
                      showWideCartSidebar ? "lg:hidden" : "xl:hidden"
                    }`}
                  >
                    Carrito
                    {cartCount > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[10px] font-bold text-white">
                        {cartCount}
                      </span>
                    )}
                  </button>
                  <div className={isKioskMode ? "kiosk-secondary hidden" : "hidden xl:block"}>
                    <CurrentDateTime />
                  </div>
                  <div className="relative" ref={quickMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsQuickMenuOpen((current) => !current)}
                      className={`touch-target flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${
                        isKioskMode ? "text-base" : "text-sm"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                        <path d="M4 7h16v2H4V7Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
                      </svg>
                      Menu
                    </button>

                    {isQuickMenuOpen && (
                      <div className="absolute right-0 top-full z-30 mt-2 max-h-[min(70vh,28rem)] w-56 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.14)] dark:border-slate-600 dark:bg-slate-900">
                        <div className="grid gap-1">
                          <button
                            onClick={() => handleMenuAction(() => setIsShiftModalOpen(true))}
                            className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            Turno
                          </button>
                          <button
                            onClick={() => handleMenuAction(handleToggleKioskMode)}
                            disabled={isKioskForcedByQuery}
                            className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            {isKioskForcedByQuery
                              ? "Modo kiosco fijado por URL"
                              : isKioskMode
                                ? "Desactivar modo kiosco"
                                : "Activar modo kiosco"}
                          </button>
                          {user?.role === "admin" && (
                            <>
                              <button
                                onClick={() => handleMenuAction(() => setIsUsersModalOpen(true))}
                                className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Usuarios
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsLocalesModalOpen(true))}
                                className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Locales
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsDailySalesOpen(true))}
                                className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Resumen del mes
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsWeeklySalesOpen(true))}
                                className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Ventas 7 Dias
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsTodaySalesOpen(true))}
                                className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Ventas hoy
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsStockCostOpen(true))}
                                className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Coste de stock
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsLowStockOpen(true))}
                                className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Reporte stock
                              </button>
                              <button
                                onClick={() => handleMenuAction(handleNewProduct)}
                                className="touch-target rounded-xl bg-blue-600 px-3 py-2 text-left text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                              >
                                + Nuevo Producto
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleMenuAction(() => setIsThermalPrinterOpen(true))}
                            className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            Impresora termica
                          </button>
                          <button
                            onClick={() => handleMenuAction(() => void signOut())}
                            className="touch-target rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            Cerrar sesion
                          </button>
                          {user?.role === "admin" && (
                            <button
                              onClick={() => handleMenuAction(() => setIsDailySalesOpen(true))}
                              className="touch-target rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                            >
                              Reset ventas
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              }
            />
          </section>

          <CartSidebar
            currentUser={user}
            isDarkMode={isDarkMode}
            isKioskMode={isKioskMode}
            showWideLayout={showWideCartSidebar}
            onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          />
        </div>
      </div>

      {isModalOpen && (
        <ProductFormModal
          key={`${editingProduct?.id ?? "new"}-${preferredProductLocalId ?? "no-local"}-${(availableLocales ?? []).length}`}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setPreferredProductLocalId(null);
          }}
          productToEdit={editingProduct}
          currentUser={user}
          preferredLocalId={preferredProductLocalId}
        />
      )}

      {isProductLocalSelectorOpen && (
        <ProductLocalSelectorModal
          isOpen={isProductLocalSelectorOpen}
          onClose={() => setIsProductLocalSelectorOpen(false)}
          onContinue={(localId) => {
            setPreferredProductLocalId(localId);
            setIsProductLocalSelectorOpen(false);
            setIsModalOpen(true);
          }}
          onCreateLocal={() => {
            setIsProductLocalSelectorOpen(false);
            setIsLocalesModalOpen(true);
          }}
        />
      )}

      {isCartOpen && user && (
        <CartModal
          currentUser={user}
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
        />
      )}

      {isLowStockOpen && (
        <LowStockReportModal
          isOpen={isLowStockOpen}
          onClose={() => setIsLowStockOpen(false)}
        />
      )}

      {isStockCostOpen && (
        <StockCostModal
          isOpen={isStockCostOpen}
          onClose={() => setIsStockCostOpen(false)}
        />
      )}

      {isShiftModalOpen && user && (
        <ShiftModal
          currentUser={user}
          isOpen={isShiftModalOpen}
          onClose={() => {
            if (hasCurrentOpenShift === false) {
              return;
            }

            setIsShiftModalOpen(false);
          }}
          requireOpenShift={hasCurrentOpenShift === false}
        />
      )}

      {isWeeklySalesOpen && (
        <WeeklySalesChartModal
          isOpen={isWeeklySalesOpen}
          onClose={() => setIsWeeklySalesOpen(false)}
        />
      )}

      {isUsersModalOpen && (
        <UsersModal
          isOpen={isUsersModalOpen}
          onClose={() => setIsUsersModalOpen(false)}
          currentUsername={user?.username}
        />
      )}

      {isLocalesModalOpen && (
        <LocalesModal
          isOpen={isLocalesModalOpen}
          onClose={() => setIsLocalesModalOpen(false)}
          onLocalCreated={(localId) => {
            if ((availableLocales?.length ?? 0) === 0) {
              setPreferredProductLocalId(localId);
              setIsLocalesModalOpen(false);
              setIsModalOpen(true);
            }
          }}
        />
      )}

      {isThermalPrinterOpen && (
        <ThermalPrinterModal
          isOpen={isThermalPrinterOpen}
          onClose={() => setIsThermalPrinterOpen(false)}
        />
      )}

      {isDailySalesOpen && (
        <DailySalesModal
          isOpen={isDailySalesOpen}
          onClose={() => setIsDailySalesOpen(false)}
        />
      )}

      {isTodaySalesOpen && (
        <TodaySalesModal
          isOpen={isTodaySalesOpen}
          onClose={() => setIsTodaySalesOpen(false)}
        />
      )}
    </main>
  );
}
