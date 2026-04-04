"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { UsersModal } from "./UsersModal";
import { useAuth } from "./src/components/AuthGate";
import { importProductsRemote, syncRemoteSnapshot } from "./src/lib/api-client";
import { ToastContainer } from "./Toast";

type ThemeMode = "light" | "dark";

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
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSyncingRef = useRef(false);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  const cartCount = useLiveQuery(() => db.cart.count()) || 0;
  const activeShift = useLiveQuery(() => getOpenShiftForUser(user?.id), [user?.id]);
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
    if (activeShift !== undefined) {
      setHasOpenShift(Boolean(activeShift));
    }
  }, [activeShift]);

  useEffect(() => {
    if (user && hasOpenShift === false) {
      setIsShiftModalOpen(true);
    }
  }, [hasOpenShift, user]);

  useEffect(() => {
    setTheme("light");
    window.localStorage.setItem("theme", "light");
  }, []);

  useEffect(() => {
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
    window.localStorage.setItem("theme", theme);
  }, [theme]);

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

  useEffect(() => {
    setNow(new Date());

    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleMenuAction = (action: () => void) => {
    setIsQuickMenuOpen(false);
    action();
  };

  const isDarkMode = theme === "dark";
  const currentTime = now
    ? now.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";
  const currentDate = now
    ? now.toLocaleDateString("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "--/--/----";

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
    <main className="min-h-screen bg-white px-4 pb-[0.5cm] pt-[0.5cm] transition-colors duration-300 print:hidden sm:px-6 lg:px-8 xl:h-screen xl:overflow-hidden dark:bg-slate-950">
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

      <div className="mx-auto max-w-[1600px] print:hidden xl:h-full">
        <div className="grid gap-6 xl:h-full xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-colors xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden dark:border-slate-800 dark:bg-slate-900/40">
            <ProductList
              canManageProducts={user?.role === "admin"}
              onEditProduct={handleEditProduct}
              leadingContent={
                <Image
                  src="/logo.png"
                  alt="Logo La cucha de Hanna"
                  width={152}
                  height={152}
                  className="h-24 w-24 object-contain sm:h-28 sm:w-28"
                  priority
                />
              }
              extraControls={
                <div className="flex flex-col gap-2 xl:w-[170px] xl:items-stretch">
                  <button
                    onClick={() => setIsCartOpen(true)}
                    className="relative rounded-full border border-blue-200 bg-blue-100 px-4 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200 xl:hidden"
                  >
                    Carrito
                    {cartCount > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[10px] font-bold text-white">
                        {cartCount}
                      </span>
                    )}
                  </button>
                  <div className="-mb-2 w-full -translate-y-[0.5cm] px-1 text-center">
                    <p className="text-[10px] font-medium capitalize text-slate-500 dark:text-slate-300">
                      {currentDate}
                    </p>
                    <p className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-50">
                      {currentTime}
                    </p>
                  </div>
                  <div className="relative" ref={quickMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsQuickMenuOpen((current) => !current)}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                        <path d="M4 7h16v2H4V7Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
                      </svg>
                      Menu
                    </button>

                    {isQuickMenuOpen && (
                      <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.14)] dark:border-slate-600 dark:bg-slate-900">
                        <div className="grid gap-1">
                          <button
                            onClick={() => handleMenuAction(() => setIsShiftModalOpen(true))}
                            className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            Turno
                          </button>
                          {user?.role === "admin" && (
                            <>
                              <button
                                onClick={() => handleMenuAction(() => setIsUsersModalOpen(true))}
                                className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Usuarios
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsDailySalesOpen(true))}
                                className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Resumen del mes
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsWeeklySalesOpen(true))}
                                className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Ventas 7 Dias
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsTodaySalesOpen(true))}
                                className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Ventas hoy
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsStockCostOpen(true))}
                                className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Coste de stock
                              </button>
                              <button
                                onClick={() => handleMenuAction(() => setIsLowStockOpen(true))}
                                className="rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Reporte stock
                              </button>
                              <button
                                onClick={() => handleMenuAction(handleNewProduct)}
                                className="rounded-xl bg-blue-600 px-3 py-2 text-left text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                              >
                                + Nuevo Producto
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleMenuAction(() => void signOut())}
                            className="rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            Cerrar sesion
                          </button>
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
            onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          />
        </div>
      </div>

      {isModalOpen && (
        <ProductFormModal
          key={editingProduct?.id ?? "new"}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          productToEdit={editingProduct}
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
            if (hasOpenShift === false) {
              return;
            }

            setIsShiftModalOpen(false);
          }}
          requireOpenShift={hasOpenShift === false}
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
