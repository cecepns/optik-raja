import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  limit = 10,
  limitOptions = [10, 25, 50, 100],
  onPageChange,
  onLimitChange,
  compact = false,
  itemName = "data",
}) {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = compact ? 3 : 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      let end = Math.min(totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalItems);

  const availableLimits = Array.from(
    new Set([...(limitOptions || [10, 25, 50, 100]), limit])
  ).sort((a, b) => a - b);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border-t border-slate-200 text-slate-700 ${
        compact ? "px-4 py-2.5 text-xs" : "px-5 py-4 text-sm"
      }`}
    >
      {/* Limit Selector & Summary */}
      <div className={`flex flex-wrap items-center gap-2.5 ${compact ? "text-xs" : "text-sm"}`}>
        {onLimitChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Tampilkan</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className={`border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition-all shadow-2xs ${
                compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
              }`}
            >
              {availableLimits.map((lim) => (
                <option key={lim} value={lim}>
                  {lim}
                </option>
              ))}
            </select>
            <span className="text-slate-500 font-medium hidden sm:inline">per halaman</span>
          </div>
        )}
        {onLimitChange && <span className="text-slate-300">|</span>}
        <span className="text-slate-600 font-medium">
          Menampilkan <span className="font-bold text-slate-900">{startItem}</span> -{" "}
          <span className="font-bold text-slate-900">{endItem}</span> dari{" "}
          <span className="font-bold text-slate-900">{totalItems}</span> {itemName}
        </span>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`flex items-center gap-1 rounded-lg font-semibold border transition-all ${
            compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
          } ${
            currentPage <= 1
              ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
              : "border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 bg-white shadow-2xs cursor-pointer"
          }`}
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        {getPageNumbers().map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`flex items-center justify-center rounded-lg font-bold border transition-all cursor-pointer ${
              compact ? "min-w-7 h-7 text-xs px-2" : "min-w-9 h-9 text-sm px-2.5"
            } ${
              pageNum === currentPage
                ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                : "border-slate-200 text-slate-700 hover:bg-slate-100 bg-white"
            }`}
          >
            {pageNum}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`flex items-center gap-1 rounded-lg font-semibold border transition-all ${
            compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
          } ${
            currentPage >= totalPages
              ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
              : "border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 bg-white shadow-2xs cursor-pointer"
          }`}
          title="Halaman Selanjutnya"
        >
          <span className="hidden sm:inline">Selanjutnya</span>
          <ChevronRight className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        </button>
      </div>
    </div>
  );
}
