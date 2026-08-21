import { create } from "zustand";

export const SETTING_DEFAULTS: Record<string, string> = {
  company_name: "FCF Stationery House",
  company_phone: "",
  company_address: "Wholesale Stationery Dokan, Bangladesh",
  company_email: "",
  order_prefix: "ORD",
  invoice_prefix: "INV",
  purchase_prefix: "PUR",
  low_stock_threshold: "10",
  whatsapp_enabled: "false",
  whatsapp_api_key: "",
  whatsapp_from_number: "",
  currency_symbol: "৳",
  // Staff Role Module Permissions
  perm_staff_dashboard: "true",
  perm_staff_orders: "true",
  perm_staff_stock: "true",
  perm_staff_customers: "true",
  perm_staff_payments: "false",
  perm_staff_reports: "false",
  perm_staff_expenses: "false",
  perm_staff_price_list: "true",
  perm_staff_purchases: "false",
  perm_staff_suppliers: "false",
  perm_staff_notifications: "false",
  // Staff Privacy / Action Switches
  perm_staff_view_buy_price: "false",
  perm_staff_delete_orders: "false",
};

interface SettingsState {
  settings: Record<string, string>;
  setSettings: (settings: Record<string, string>) => void;
  updateSetting: (key: string, value: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: SETTING_DEFAULTS,
  setSettings: (settings) => set({ settings: { ...SETTING_DEFAULTS, ...settings } }),
  updateSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),
}));
