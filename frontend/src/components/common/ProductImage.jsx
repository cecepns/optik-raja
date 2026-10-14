import React, { useState } from "react";
import { ImageOff } from "lucide-react";
import { getUploadUrl } from "@/utils/endpoints";

/**
 * Helper to compute initial based on user specification:
 * - 1 kata (misal "Kacamata") -> "KC" (huruf ke-1 dan ke-3)
 * - 2+ kata (misal "Frame Rayban") -> 1 huruf kata pertama + 2 huruf kata ke-2 -> "FRA"
 */
export function getProductInitial(name) {
  if (!name || typeof name !== "string") return "PR";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const clean = words[0].replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length >= 3) {
      return (clean[0] + clean[2]).toUpperCase(); // Contoh: "Kacamata" -> "KC"
    }
    return clean.slice(0, 2).toUpperCase() || "PR";
  }
  // 2 atau lebih kata: 1 huruf pertama kata ke-1 + 2 huruf kata ke-2
  const w1 = words[0].replace(/[^a-zA-Z0-9]/g, "");
  const w2 = words[1].replace(/[^a-zA-Z0-9]/g, "");
  const part1 = w1 ? w1[0] : "";
  const part2 = w2 ? w2.slice(0, 2) : "";
  return (part1 + part2).toUpperCase() || "PR";
}

/**
 * ProductImage component with fallback to Lucide ImageOff icon + initials
 */
export default function ProductImage({
  src,
  alt = "",
  name = "",
  category = "Frame",
  className = "w-16 h-16 rounded-xl",
  iconSize = 16,
}) {
  const [hasError, setHasError] = useState(false);
  const initials = getProductInitial(name || alt);

  // Reset error state if src changes
  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  const resolvedSrc = src ? getUploadUrl(src) : "";

  // Category specific accent background for placeholder
  const getCategoryTheme = (cat) => {
    switch (cat) {
      case "Frame":
        return "bg-gradient-to-br from-indigo-50 to-indigo-100/80 text-indigo-700 border-indigo-200/80";
      case "Lensa":
        return "bg-gradient-to-br from-cyan-50 to-cyan-100/80 text-cyan-700 border-cyan-200/80";
      case "Aksesori":
        return "bg-gradient-to-br from-emerald-50 to-emerald-100/80 text-emerald-700 border-emerald-200/80";
      default:
        return "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 border-slate-200/80";
    }
  };

  if (resolvedSrc && !hasError) {
    return (
      <img
        src={resolvedSrc}
        alt={alt || name}
        onError={() => setHasError(true)}
        className={`object-cover border border-slate-200/80 shadow-2xs shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center border font-mono select-none shadow-2xs shrink-0 relative overflow-hidden ${getCategoryTheme(
        category
      )} ${className}`}
      title={name || alt}
    >
      <ImageOff size={iconSize} className="opacity-70 mb-0.5" />
      <span className="font-extrabold text-[11px] sm:text-xs tracking-wider leading-none">
        {initials}
      </span>
    </div>
  );
}
