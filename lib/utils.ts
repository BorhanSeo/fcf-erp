import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useSettingsStore } from "@/store/settingsStore";

// Format currency in BDT
export function formatCurrency(amount: number | null | undefined): string {
  const symbol = useSettingsStore.getState().settings.currency_symbol || "৳";
  if (amount === null || amount === undefined) return `${symbol}0.00`;
  return `${symbol}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Format date in DD MMM YYYY style
export function formatDate(
  date: string | Date | null | undefined,
  formatStr: string = "dd MMM yyyy"
): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, formatStr);
  } catch {
    return "—";
  }
}

// Format date in Bangla
export function formatDateBn(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "dd MMM yyyy", { locale: bn });
  } catch {
    return "—";
  }
}

// Generate order number
export function generateOrderNumber(year: number, count: number): string {
  const prefix = useSettingsStore.getState().settings.order_prefix || "ORD";
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}

// Generate invoice number
export function generateInvoiceNumber(year: number, count: number): string {
  const prefix = useSettingsStore.getState().settings.invoice_prefix || "INV";
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}

// Generate purchase number
export function generatePurchaseNumber(year: number, count: number): string {
  const prefix = useSettingsStore.getState().settings.purchase_prefix || "PUR";
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
}

// Generate payment number
export function generatePaymentNumber(year: number, count: number): string {
  return `PAY-${year}-${String(count).padStart(4, "0")}`;
}

// Status badge color
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "badge-pending";
    case "confirmed":
      return "badge-confirmed";
    case "delivered":
      return "badge-delivered";
    case "cancelled":
      return "badge-cancelled";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Status label in English
export function getStatusLabel(status: string): string {
  switch (status) {
    case "pending":   return "Pending";
    case "confirmed": return "Confirmed";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancelled";
    case "received":  return "Received";
    case "returned":  return "Returned";
    case "partial":   return "Partial";
    default: return status;
  }
}

// Payment method label in English
export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case "cash":    return "Cash";
    case "due":     return "Due";
    case "partial": return "Partial";
    case "bkash":   return "bKash";
    case "nagad":   return "Nagad";
    case "bank":    return "Bank";
    default: return method;
  }
}

// Truncate text
export function truncate(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Check if user is admin
export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}

// Number to words in Bangla (simplified)
export function numberToBangla(num: number): string {
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((d) => (isNaN(parseInt(d)) ? d : banglaDigits[parseInt(d)]))
    .join("");
}
