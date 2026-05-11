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
