import React from "react";
import { Inbox } from "lucide-react";

export default function EmptyState({
  icon: Icon = Inbox,
  title = "Tidak ada data ditemukan",
  description = "Coba ubah kata kunci pencarian atau tambahkan data baru.",
  actionButton,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      <p className="text-xs text-gray-500 max-w-sm mt-1">{description}</p>
      {actionButton && <div className="mt-4">{actionButton}</div>}
    </div>
  );
}
