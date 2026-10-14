import React from "react";

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="w-full bg-white divide-y divide-slate-100 animate-pulse">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center px-5 py-4 space-x-4">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div
              key={cIdx}
              className="h-5 bg-slate-200 rounded-md flex-1"
              style={{ maxWidth: cIdx === 0 ? "60px" : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Table({
  headers = [],
  children,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  emptyAction,
}) {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      <div className="overflow-x-auto min-w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className={`px-5 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap select-none ${
                    h.align === "right"
                      ? "text-right"
                      : h.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${h.className || ""}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={headers.length} className="p-0">
                  <TableSkeleton rows={5} cols={headers.length} />
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td colSpan={headers.length} className="py-14 text-center text-slate-500">
                  <div className="text-base font-semibold text-slate-700">{emptyMessage || "Data tidak ditemukan"}</div>
                  {emptyAction && <div className="mt-4">{emptyAction}</div>}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
