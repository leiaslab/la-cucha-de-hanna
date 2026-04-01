"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { useMemo } from "react";

interface WeeklySalesChartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WeeklySalesChartModal({ isOpen, onClose }: WeeklySalesChartModalProps) {
  // Obtener todas las órdenes para calcular las ventas de los últimos 7 días
  const allOrders = useLiveQuery(() => db.orders.toArray());

  const dailySales = useMemo(() => {
    const salesMap = new Map<string, number>(); // "YYYY-MM-DD" -> total sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Inicializar los últimos 7 días con 0 ventas
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      salesMap.set(d.toISOString().split('T')[0], 0);
    }

    // Sumar las ventas de las órdenes existentes
    allOrders?.forEach(order => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      const dateKey = orderDate.toISOString().split('T')[0];

      if (salesMap.has(dateKey)) {
        salesMap.set(dateKey, salesMap.get(dateKey)! + order.total);
      }
    });

    // Convertir el mapa a un array ordenado por fecha
    return Array.from(salesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date, total }));
  }, [allOrders]);

  const maxSales = useMemo(() => {
    return Math.max(...dailySales.map(d => d.total), 0);
  }, [dailySales]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📈 Ventas de los Últimos 7 Días
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        {allOrders === undefined ? (
          <p className="text-center py-10 text-gray-500">Cargando datos de ventas...</p>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2">
            {dailySales.length === 0 || maxSales === 0 ? (
              <p className="text-center py-10 text-gray-500 italic">No hay datos de ventas para los últimos 7 días.</p>
            ) : (
              <div className="grid grid-cols-7 gap-2 h-64 items-end border-b border-l pb-2 pl-2 mb-4">
                {dailySales.map((day) => (
                  <div key={day.date} className="flex flex-col items-center justify-end h-full group relative">
                    <div
                      className="bg-blue-500 w-full rounded-t-sm transition-all duration-500 hover:bg-blue-600"
                      style={{ height: `${(day.total / maxSales) * 90}%` }} // 90% para dejar espacio para etiquetas
                    ></div>
                    <span className="text-[10px] text-gray-500 mt-1">
                      {new Date(day.date).toLocaleDateString('es-ES', { weekday: 'short' })}
                    </span>
                    <div className="absolute bottom-full mb-2 p-1 px-2 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {new Date(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}: ${day.total.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="font-bold text-gray-700 mb-3 underline">Detalle de Ventas por Día</h3>
            <div className="space-y-3">
              {dailySales.map((day) => (
                <div key={day.date} className="p-3 border rounded-xl bg-gray-50 flex justify-between items-center">
                  <span className="font-bold text-gray-700">
                    {new Date(day.date).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </span>
                  <span className="font-extrabold text-blue-600 text-lg">
                    ${day.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-xl transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
