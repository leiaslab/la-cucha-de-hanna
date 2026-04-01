"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

interface LowStockReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LowStockReportModal({ isOpen, onClose }: LowStockReportModalProps) {
  // Consultamos productos con stock < 5 usando el índice que creamos
  const lowStockProducts = useLiveQuery(() => db.products.where("stock").below(5).toArray());

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50 p-4 print:bg-white print:static print:p-0">
      <div className="bg-white p-6 rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col print:shadow-none print:max-h-none print:w-full print:p-0">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            ⚠️ Reporte de Stock Bajo
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl print:hidden">×</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 print:overflow-visible">
          {lowStockProducts === undefined ? (
            <p className="text-center py-10 text-gray-500">Cargando reporte...</p>
          ) : lowStockProducts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500 text-lg font-medium">✅ ¡Inventario saludable!</p>
              <p className="text-sm text-gray-400">No hay productos con menos de 5 unidades.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="p-3 border-b font-semibold">Producto</th>
                    <th className="p-3 border-b font-semibold text-center">Stock</th>
                    <th className="p-3 border-b font-semibold text-right">Categoría</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 border-b font-medium">{product.name}</td>
                      <td className="p-3 border-b text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          product.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="p-3 border-b text-right text-gray-500 text-sm">
                        {product.category}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 print:hidden">
          <button 
            onClick={handlePrint}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-xl transition-all shadow-sm border border-gray-200"
          >
            🖨️ Imprimir
          </button>
          <button 
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-sm"
          >
            Cerrar Reporte
          </button>
        </div>
      </div>
    </div>
  );
}