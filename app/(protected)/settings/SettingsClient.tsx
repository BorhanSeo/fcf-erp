"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useSettingsStore } from "@/store/settingsStore";

interface Props { initialSettings: Record<string, string>; userId: string; }

const SETTING_DEFAULTS: Record<string, string> = {
  company_name: "FCF Stationery House",
  company_phone: "", company_address: "Wholesale Stationery Dokan, Bangladesh",
  company_email: "", order_prefix: "ORD", invoice_prefix: "INV",
  purchase_prefix: "PUR", low_stock_threshold: "10",
  whatsapp_enabled: "false", whatsapp_api_key: "", whatsapp_from_number: "", currency_symbol: "৳",
};

type Section = "business" | "invoice" | "stock" | "whatsapp" | "currency";

export default function SettingsClient({ initialSettings, userId }: Props) {
  const [settings, setSettings] = useState({ ...SETTING_DEFAULTS, ...initialSettings });
  const [saving, setSaving] = useState<Section | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("business");
  const updateGlobalSetting = useSettingsStore((state) => state.updateSetting);

  const updateSetting = (key: string, value: string) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const saveSection = async (section: Section, keys: string[]) => {
    setSaving(section);
    try {
      const supabase = createClient();
      const upserts = keys.map(key => ({ key, value: settings[key] || "", updated_by: userId }));
      const { error } = await supabase.from("settings").upsert(upserts, { onConflict: "key" });
      if (error) throw error;
      
      // Update global store so UI updates immediately
      keys.forEach((key) => updateGlobalSetting(key, settings[key] || ""));
      
      toast.success("Settings saved ✓");
    } catch { toast.error("Failed to save settings"); }
    finally { setSaving(null); }
  };

  const SECTIONS = [
    { key: "business" as Section, label: "Business Info", icon: "🏢" },
    { key: "invoice" as Section, label: "Invoice Settings", icon: "📄" },
    { key: "stock" as Section, label: "Stock Settings", icon: "📦" },
    { key: "whatsapp" as Section, label: "WhatsApp", icon: "💬" },
    { key: "currency" as Section, label: "Currency", icon: "💱" },
  ];

  const InputField = ({ label, settingKey, type = "text", placeholder = "" }: { label: string; settingKey: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-sm font-medium text-slate-700 mb-1 block">{label}</label>
      <input type={type} placeholder={placeholder} value={settings[settingKey] || ""}
        onChange={e => updateSetting(settingKey, e.target.value)}
        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
  );

  const SaveButton = ({ section, keys }: { section: Section; keys: string[] }) => (
    <button onClick={() => saveSection(section, keys)} disabled={saving === section}
      className="h-10 px-6 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
      {saving === section ? (
        <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
      ) : (
        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Save</>
      )}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">ERP system configuration</p>
        </div>
        <Link href="/settings/users"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          User Management
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-1">
          <nav className="fcf-card p-2 space-y-1">
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                  activeSection === s.key ? "bg-blue-600 text-white font-semibold" : "text-slate-600 hover:bg-slate-100"
                }`}>
                <span>{s.icon}</span><span>{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3">
          {activeSection === "business" && (
            <div className="fcf-card p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 text-lg">Business Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Company Name" settingKey="company_name" placeholder="FCF Stationery House" />
                <InputField label="Phone Number" settingKey="company_phone" placeholder="01XXXXXXXXX" />
                <InputField label="Email" settingKey="company_email" type="email" placeholder="info@fcf.com" />
              </div>
              <InputField label="Address" settingKey="company_address" placeholder="Full business address" />
              <div className="pt-2 flex justify-end"><SaveButton section="business" keys={["company_name","company_phone","company_address","company_email"]} /></div>
            </div>
          )}

          {activeSection === "invoice" && (
            <div className="fcf-card p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 text-lg">Invoice Settings</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700"><strong>Example:</strong> Prefix = &quot;ORD&quot;, Format = <code>ORD-2025-0001</code></p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Order Prefix</label>
                  <input value={settings.order_prefix} onChange={e => updateSetting("order_prefix", e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Invoice Prefix</label>
                  <input value={settings.invoice_prefix} onChange={e => updateSetting("invoice_prefix", e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">Purchase Prefix</label>
                  <input value={settings.purchase_prefix} onChange={e => updateSetting("purchase_prefix", e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono" /></div>
              </div>
              <div className="pt-2 flex justify-end"><SaveButton section="invoice" keys={["order_prefix","invoice_prefix","purchase_prefix"]} /></div>
            </div>
          )}

          {activeSection === "stock" && (
            <div className="fcf-card p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 text-lg">Stock Settings</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-700">When stock falls below this number, a &quot;Low Stock&quot; alert will appear.</p>
              </div>
              <div className="max-w-xs">
                <label className="text-sm font-medium text-slate-700 mb-1 block">Default Low Stock Threshold</label>
                <div className="flex items-center gap-3">
                  <input type="number" min={1} value={settings.low_stock_threshold}
                    onChange={e => updateSetting("low_stock_threshold", e.target.value)}
                    className="flex h-10 w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm text-center" />
                  <span className="text-sm text-slate-500">units</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">* Individual thresholds can be changed per product from the Stock page.</p>
              <div className="pt-2 flex justify-end"><SaveButton section="stock" keys={["low_stock_threshold"]} /></div>
            </div>
          )}

          {activeSection === "whatsapp" && (
            <div className="fcf-card p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 text-lg">WhatsApp Notifications</h3>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="font-medium text-slate-800">Enable WhatsApp</p>
                  <p className="text-sm text-slate-500 mt-0.5">Send WhatsApp messages via API</p>
                </div>
                <button onClick={() => updateSetting("whatsapp_enabled", settings.whatsapp_enabled === "true" ? "false" : "true")}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.whatsapp_enabled === "true" ? "bg-green-500" : "bg-slate-300"}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${settings.whatsapp_enabled === "true" ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              <InputField label="WhatsApp API Key" settingKey="whatsapp_api_key" placeholder="Your API Key here" />
              <InputField label="WhatsApp From Number" settingKey="whatsapp_from_number" placeholder="+8801XXXXXXXXX" />
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                <p className="font-semibold mb-1">Supported APIs:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>WhatsApp Business API (Meta)</li>
                  <li>Twilio WhatsApp</li>
                  <li>WA.me redirect (Free — opens in browser)</li>
                </ul>
              </div>
              <div className="pt-2 flex justify-end"><SaveButton section="whatsapp" keys={["whatsapp_enabled","whatsapp_api_key","whatsapp_from_number"]} /></div>
            </div>
          )}

          {activeSection === "currency" && (
            <div className="fcf-card p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 text-lg">Currency Settings</h3>
              <div className="max-w-xs space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Currency Symbol</label>
                  <div className="flex items-center gap-3">
                    {["৳", "BDT", "Tk"].map(sym => (
                      <button key={sym} onClick={() => updateSetting("currency_symbol", sym)}
                        className={`h-10 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                          settings.currency_symbol === sym ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}>{sym}</button>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Preview: <strong>{settings.currency_symbol}1,234.56</strong></p>
                </div>
              </div>
              <div className="pt-2 flex justify-end"><SaveButton section="currency" keys={["currency_symbol"]} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
