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
  perm_staff_dashboard: "true", perm_staff_orders: "true", perm_staff_stock: "true",
  perm_staff_customers: "true", perm_staff_payments: "false", perm_staff_reports: "false",
  perm_staff_expenses: "false", perm_staff_price_list: "true", perm_staff_purchases: "false",
  perm_staff_suppliers: "false", perm_staff_notifications: "false",
  perm_staff_view_buy_price: "false", perm_staff_delete_orders: "false",
};

type Section = "business" | "permissions" | "invoice" | "stock" | "whatsapp" | "currency" | "backup";

export default function SettingsClient({ initialSettings, userId }: Props) {
  const [settings, setSettings] = useState({ ...SETTING_DEFAULTS, ...initialSettings });
  const [saving, setSaving] = useState<Section | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("business");
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<any>(null);
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

  // Full Database Export function
  const handleFullBackup = async () => {
    setExporting(true);
    try {
      const supabase = createClient();
      const tables = ["products", "customers", "orders", "order_items", "payments", "expenses", "suppliers", "purchases", "purchase_items", "settings"];
      
      const backupData: Record<string, any[]> = {};
      
      await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await supabase.from(table).select("*");
          if (!error && data) {
            backupData[table] = data;
          } else {
            backupData[table] = [];
          }
        })
      );

      const payload = {
        app: "FCF_ERP",
        version: "1.0",
        timestamp: new Date().toISOString(),
        exported_at: new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" }),
        counts: Object.fromEntries(Object.entries(backupData).map(([k, v]) => [k, v.length])),
        data: backupData,
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split("T")[0];
      const link = document.createElement("a");
      link.href = url;
      link.download = `FCF_ERP_Backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Full database backup downloaded successfully! 💾");
    } catch (err: any) {
      toast.error("Failed to generate backup: " + (err?.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  // Handle backup file selection for restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.app !== "FCF_ERP" || !parsed.data) {
          toast.error("Invalid backup file format!");
          setBackupPreview(null);
          return;
        }
        setBackupPreview(parsed);
      } catch {
        toast.error("Could not parse JSON file!");
        setBackupPreview(null);
      }
    };
    reader.readAsText(file);
  };

  // Restore backup function
  const handleRestoreBackup = async () => {
    if (!backupPreview || !backupPreview.data) {
      toast.error("No valid backup file loaded");
      return;
    }

    if (!confirm("⚠️ Are you sure you want to restore this backup? This will update existing database records.")) {
      return;
    }

    setRestoring(true);
    try {
      const supabase = createClient();
      const { data: bData } = backupPreview;

      // Restore tables in dependency order
      const restoreOrder = ["products", "customers", "suppliers", "orders", "purchases", "order_items", "purchase_items", "payments", "expenses", "settings"];

      let restoredTablesCount = 0;
      for (const table of restoreOrder) {
        const rows = bData[table];
        if (Array.isArray(rows) && rows.length > 0) {
          // Upsert in chunks of 50
          const chunkSize = 50;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const { error } = await supabase.from(table).upsert(chunk);
            if (error) {
              console.error(`Error restoring ${table}:`, error);
            }
          }
          restoredTablesCount++;
        }
      }

      toast.success(`Database restored successfully! (${restoredTablesCount} tables updated) 🎉`);
      setBackupFile(null);
      setBackupPreview(null);
    } catch (err: any) {
      toast.error("Restore failed: " + (err?.message || "Unknown error"));
    } finally {
      setRestoring(false);
    }
  };

  const SECTIONS = [
    { key: "business" as Section, label: "Business Info", icon: "🏢" },
    { key: "permissions" as Section, label: "Role Permissions", icon: "🛡️" },
    { key: "invoice" as Section, label: "Invoice Settings", icon: "📄" },
    { key: "stock" as Section, label: "Stock Settings", icon: "📦" },
    { key: "whatsapp" as Section, label: "WhatsApp", icon: "💬" },
    { key: "currency" as Section, label: "Currency", icon: "💱" },
    { key: "backup" as Section, label: "Database Backup", icon: "💾" },
  ];

  const InputField = ({ label, settingKey, type = "text", placeholder = "" }: { label: string; settingKey: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-sm font-medium text-slate-700 mb-1 block">{label}</label>
      <input type={type} placeholder={placeholder} value={settings[settingKey] || ""}
        onChange={e => updateSetting(settingKey, e.target.value)}
        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
  );

  const PermissionToggle = ({ label, description, settingKey }: { label: string; description?: string; settingKey: string }) => {
    const enabled = settings[settingKey] === "true";
    return (
      <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <p className="font-medium text-sm text-slate-800">{label}</p>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        <button type="button" onClick={() => updateSetting(settingKey, enabled ? "false" : "true")}
          className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? "bg-blue-600" : "bg-slate-300"}`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${enabled ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
      </div>
    );
  };

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

          {activeSection === "permissions" && (
            <div className="fcf-card p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-slate-800 text-lg">Role &amp; Feature Permissions</h3>
                <p className="text-sm text-slate-500 mt-0.5">Control which pages and features Staff users can view and access.</p>
              </div>

              {/* Staff Module Permissions */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Staff Page Visibility</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <PermissionToggle label="Dashboard" description="Overview stats &amp; charts" settingKey="perm_staff_dashboard" />
                  <PermissionToggle label="Orders" description="Create &amp; view sales orders" settingKey="perm_staff_orders" />
                  <PermissionToggle label="Stock" description="Inventory &amp; product list" settingKey="perm_staff_stock" />
                  <PermissionToggle label="Customers" description="Customer list &amp; history" settingKey="perm_staff_customers" />
                  <PermissionToggle label="Payments &amp; Due" description="Payment history &amp; due list" settingKey="perm_staff_payments" />
                  <PermissionToggle label="Reports" description="Profit &amp; loss calculations" settingKey="perm_staff_reports" />
                  <PermissionToggle label="Expenses" description="Expense tracking &amp; categories" settingKey="perm_staff_expenses" />
                  <PermissionToggle label="Price List" description="Printable catalog &amp; prices" settingKey="perm_staff_price_list" />
                  <PermissionToggle label="Purchases" description="Supplier purchase orders" settingKey="perm_staff_purchases" />
                  <PermissionToggle label="Suppliers" description="Vendor profiles &amp; dues" settingKey="perm_staff_suppliers" />
                  <PermissionToggle label="Notifications" description="System alerts &amp; stock warnings" settingKey="perm_staff_notifications" />
                </div>
              </div>

              {/* Staff Action / Privacy Switches */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Staff Privacy &amp; Action Controls</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <PermissionToggle label="👁️ View Purchase / Buy Price" description="Allow staff to see product cost/purchase prices" settingKey="perm_staff_view_buy_price" />
                  <PermissionToggle label="🗑️ Allow Order Deletion" description="Allow staff to delete orders" settingKey="perm_staff_delete_orders" />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-slate-400">* Admin users automatically have full access to all features.</span>
                <SaveButton section="permissions" keys={[
                  "perm_staff_dashboard", "perm_staff_orders", "perm_staff_stock", "perm_staff_customers",
                  "perm_staff_payments", "perm_staff_reports", "perm_staff_expenses", "perm_staff_price_list",
                  "perm_staff_purchases", "perm_staff_suppliers", "perm_staff_notifications",
                  "perm_staff_view_buy_price", "perm_staff_delete_orders"
                ]} />
              </div>
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

          {activeSection === "backup" && (
            <div className="space-y-5">
              {/* Export Card */}
              <div className="fcf-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                      <span>💾</span> Full Database Backup (1-Click)
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Download a complete backup of all products, customers, orders, payments, purchases &amp; expenses.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">💡 Why daily backup?</p>
                  <p className="text-xs text-blue-700">
                    Downloading a JSON backup file every day keeps your business data safe. You can restore it anytime if needed.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleFullBackup}
                    disabled={exporting}
                    className="h-11 px-6 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {exporting ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Exporting Database...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Full Backup (JSON)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Restore Card */}
              <div className="fcf-card p-6 space-y-4">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                    <span>🔄</span> Restore Database from Backup
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Select a previously downloaded <code>FCF_ERP_Backup_*.json</code> file to restore data.
                  </p>
                </div>

                <div className="space-y-3">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />

                  {backupPreview && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <p className="font-semibold text-sm text-slate-800">
                        📦 Backup Summary ({backupPreview.exported_at || backupPreview.timestamp})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                        {Object.entries(backupPreview.counts || {}).map(([table, count]) => (
                          <div key={table} className="bg-white p-2 rounded border border-slate-100">
                            <span className="capitalize font-medium">{table}:</span> <strong className="text-slate-800">{String(count)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={handleRestoreBackup}
                          disabled={restoring}
                          className="h-10 px-5 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          {restoring ? "Restoring Data..." : "⚠️ Confirm & Restore Database"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
