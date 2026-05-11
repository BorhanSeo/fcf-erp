"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "send" | "templates" | "history";

interface Template { id: string; type: string; name: string; body: string; is_active: boolean; }
interface LogRow { id: string; recipient_phone: string; recipient_name?: string; type: string; status: string; message: string; created_at: string; customers: { name: string } | null; }
interface Customer { id: string; name: string; phone: string; }

interface Props {
  templates: Template[];
  logs: LogRow[];
  customers: Customer[];
  settings: Record<string, string>;
  userId: string;
}

const VARIABLES = ["{{customer_name}}", "{{order_number}}", "{{total_amount}}", "{{due_amount}}", "{{product_name}}", "{{stock_quantity}}"];
const STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
};

export default function NotificationsClient({ templates, logs, customers, settings, userId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("send");

  // Send tab state
  const [recipientType, setRecipientType] = useState<"customer" | "custom">("customer");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [customPhone, setCustomPhone] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  // Templates tab state
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // History tab state
  const [statusFilter, setStatusFilter] = useState("");
  const [historyLogs, setHistoryLogs] = useState(logs);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)
  ).slice(0, 6);

  const resolveMessage = (template: Template, customer?: Customer | null) => {
    let msg = template.body;
    if (customer) {
      msg = msg.replace(/{{customer_name}}/g, customer.name);
      msg = msg.replace(/{{phone}}/g, customer.phone);
    }
    return msg;
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setMessageBody(resolveMessage(template, selectedCustomer));
  };

  const handleCustomerSelect = (c: Customer) => {
    setSelectedCustomer(c);
    setShowCustomerDrop(false);
    setCustomerSearch("");
    if (selectedTemplate) setMessageBody(resolveMessage(selectedTemplate, c));
  };

  const handleSend = async () => {
    const phone = recipientType === "customer" ? selectedCustomer?.phone : customPhone;
    if (!phone) { toast.error("Enter recipient phone number"); return; }
    if (!messageBody.trim()) { toast.error("Write a message"); return; }

    setSending(true);
    try {
      const supabase = createClient();
      const waEnabled = settings.whatsapp_enabled === "true";
      let status = "pending";

      if (waEnabled && settings.whatsapp_api_key) {
        // Call WhatsApp API (placeholder — replace with actual API)
        try {
          const res = await fetch(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(messageBody)}`, { method: "GET" });
          status = "sent";
        } catch {
          status = "failed";
        }
      } else {
        // Simulate send (no API configured)
        status = "sent";
      }

      // Log the notification
      await supabase.from("notification_logs").insert({
        customer_id: recipientType === "customer" ? selectedCustomer?.id : null,
        recipient_phone: phone,
        recipient_name: recipientType === "customer" ? selectedCustomer?.name : "Custom",
        type: selectedTemplate?.type || "custom",
        channel: "whatsapp",
        status,
        message: messageBody,
        created_by: userId,
      });

      if (status === "sent") {
        // Open WhatsApp in browser
        window.open(`https://wa.me/${phone.replace(/^0/, "880")}?text=${encodeURIComponent(messageBody)}`, "_blank");
        toast.success("Message sent!");
      } else {
        toast.error("Failed to send message");
      }

      setMessageBody("");
      setSelectedTemplate(null);
      router.refresh();
    } catch {
      toast.error("Message could not be sent");
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("notification_templates").update({ body: editBody }).eq("id", editingTemplate.id);
      if (error) throw error;
      toast.success("Template updated");
      setEditingTemplate(null);
      router.refresh();
    } catch {
      toast.error("Failed to update template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const filteredLogs = statusFilter ? historyLogs.filter(l => l.status === statusFilter) : historyLogs;

  const TABS: { key: Tab; label: string }[] = [
    { key: "send", label: "Send Message" },
    { key: "templates", label: `Templates (${templates.length})` },
    { key: "history", label: `History (${logs.length})` },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notification Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Send WhatsApp messages and view history</p>
      </div>

      {/* WhatsApp not configured warning */}
      {settings.whatsapp_enabled !== "true" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800">WhatsApp API not configured</p>
            <p className="text-sm text-amber-700 mt-0.5">Add a WhatsApp API Key from <a href="/settings" className="underline">Settings</a> to send messages. Currently running in simulation mode.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-medium font-bangla border-b-2 transition-colors ${
                activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* SEND TAB */}
      {activeTab === "send" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Compose */}
          <div className="space-y-4">
            {/* Recipient type */}
            <div className="fcf-card p-5 space-y-4">
              <h3 className="font-semibold text-slate-800">Select Recipient</h3>
              <div className="grid grid-cols-2 gap-2">
                {[["customer", "Customer"], ["custom", "Custom Number"]].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => { setRecipientType(val as any); setSelectedCustomer(null); setCustomPhone(""); }}
                    className={`h-10 rounded-xl text-sm font-semibold font-bangla border-2 transition-all ${
                      recipientType === val ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"
                    }`}>{label}</button>
                ))}
              </div>

              {recipientType === "customer" ? (
                <div>
                  {selectedCustomer ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold font-bangla text-slate-900">{selectedCustomer.name}</p>
                        <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                      </div>
                      <button onClick={() => setSelectedCustomer(null)} className="text-xs text-slate-400 hover:text-red-500">Change</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input type="text" placeholder="Search customer..." value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                        onFocus={() => setShowCustomerDrop(true)}
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla" />
                      {showCustomerDrop && customerSearch && (
                        <div className="absolute top-11 left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                          {filteredCustomers.length === 0
                            ? <div className="p-3 text-sm text-slate-400 text-center">Not found</div>
                            : filteredCustomers.map(c => (
                              <button key={c.id} onClick={() => handleCustomerSelect(c)}
                                className="w-full px-3 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                <p className="font-medium text-sm font-bangla">{c.name}</p>
                                <p className="text-xs text-slate-400">{c.phone}</p>
                              </button>
                            ))}
                        </div>
                      )}
                      {showCustomerDrop && <div className="fixed inset-0 z-10" onClick={() => setShowCustomerDrop(false)} />}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Phone Number</label>
                  <input type="tel" placeholder="01XXXXXXXXX" value={customPhone}
                    onChange={e => setCustomPhone(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
              )}
            </div>

            {/* Template selection */}
            <div className="fcf-card p-5 space-y-3">
              <h3 className="font-semibold text-slate-800">Template (Optional)</h3>
              <div className="grid gap-2">
                {templates.filter(t => t.is_active).map(t => (
                  <button key={t.id} onClick={() => handleTemplateSelect(t)}
                    className={`p-3 text-left rounded-xl border-2 transition-all ${
                      selectedTemplate?.id === t.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                    }`}>
                    <p className="font-medium text-sm font-bangla">{t.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 font-bangla">{t.body.slice(0, 60)}...</p>
                  </button>
                ))}
                {templates.length === 0 && (
                  <p className="text-sm text-slate-400">No templates. Add from the Templates tab.</p>
                )}
              </div>
            </div>

            {/* Message */}
            <div className="fcf-card p-5 space-y-3">
              <h3 className="font-semibold text-slate-800">Message</h3>
              <textarea value={messageBody} onChange={e => setMessageBody(e.target.value)}
                placeholder="Write a message or select a template..."
                rows={5}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              <div className="flex flex-wrap gap-1">
                {VARIABLES.map(v => (
                  <button key={v} onClick={() => setMessageBody(m => m + v)}
                    className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-mono transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Preview + Send */}
          <div className="space-y-4">
            <div className="fcf-card p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Message Preview</h3>
              <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-none p-4 max-w-sm shadow-sm">
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {messageBody || "Message will appear here..."}
                </p>
                <p className="text-xs text-slate-500 text-right mt-2">
                  {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} ✓✓
                </p>
              </div>
              {(selectedCustomer || customPhone) && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
                  <span className="font-medium">Recipient:</span>{" "}
                  {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.phone})` : customPhone}
                </div>
              )}
            </div>

            <button onClick={handleSend} disabled={sending || !messageBody.trim() || (!selectedCustomer && !customPhone)}
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 font-bangla flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
              {sending ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending...</>
              ) : (
                <><svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 21.6l4.579-.982A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                </svg>Send via WhatsApp</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TEMPLATES TAB */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="fcf-card p-12 text-center">
              <p className="text-slate-400">No templates. Add data to the `notification_templates` table in Supabase.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700 font-medium mb-2">Available Variables:</p>
                <div className="flex flex-wrap gap-2">
                  {VARIABLES.map(v => (
                    <code key={v} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded">{v}</code>
                  ))}
                </div>
              </div>

              {templates.map(t => (
                <div key={t.id} className="fcf-card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800">{t.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${t.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {t.type}
                        </span>
                      </div>
                       {!t.is_active && <p className="text-xs text-slate-400 mt-0.5">Inactive</p>}
                    </div>
                    <button onClick={() => { setEditingTemplate(t); setEditBody(t.body); }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  {editingTemplate?.id === t.id ? (
                    <div className="space-y-3">
                      <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={5}
                        className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingTemplate(null)} className="flex-1 h-9 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
                         <button onClick={handleSaveTemplate} disabled={savingTemplate}
                          className="flex-1 h-9 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                          {savingTemplate ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {t.body}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="fcf-card p-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Status:</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none">
                <option value="">All</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
              <span className="text-sm text-slate-500">{filteredLogs.length} records</span>
            </div>
          </div>

          <div className="fcf-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="fcf-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Recipient</th>
                    <th>Type</th>
                    <th>Message Preview</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">No logs found</td></tr>
                  ) : filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td className="text-sm">{formatDate(log.created_at)}</td>
                      <td>
                        <p className="font-medium text-sm">{log.customers?.name || log.recipient_name || "—"}</p>
                        <p className="text-xs text-slate-400">{log.recipient_phone}</p>
                      </td>
                      <td>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">{log.type}</span>
                      </td>
                      <td className="max-w-[200px]">
                        <p className="text-xs text-slate-500 truncate">{log.message.slice(0, 50)}...</p>
                      </td>
                      <td>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[log.status] || "bg-slate-50 text-slate-600"}`}>
                          {log.status === "sent" ? "Sent" : log.status === "failed" ? "Failed" : "Pending"}
                        </span>
                      </td>
                      <td>
                        {log.status === "failed" && (
                          <button
                            onClick={() => window.open(`https://wa.me/${log.recipient_phone.replace(/^0/, "880")}?text=${encodeURIComponent(log.message)}`, "_blank")}
                            className="text-xs text-blue-600 hover:underline">
                             Retry
                           </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
