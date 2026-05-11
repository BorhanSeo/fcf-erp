"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden; }
    #printable-statement, #printable-statement * { visibility: visible; }
    #printable-statement {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 0;
      margin: 0;
      box-shadow: none !important;
      border: none !important;
    }
    .no-print { display: none !important; }
    @page { size: A4; margin: 1cm; }
    .fcf-card { border: none !important; }
    .bg-slate-900 { background-color: #f1f5f9 !important; color: #0f172a !important; }
    .text-slate-400 { color: #64748b !important; }
  }
`;

type Tab = "daily" | "monthly" | "yearly" | "products" | "financial";
interface OrderRow { total_amount: number; paid_amount: number; due_amount: number; status: string; created_at: string; }
interface OrderItemRow { quantity: number; line_total: number; created_at: string; products: { purchase_price: number } | null; }
interface PaymentRow { amount: number; payment_date: string; created_at: string; note?: string; }
interface Props { todayOrders: OrderRow[]; monthOrders: OrderRow[]; yearOrders: OrderRow[]; monthOrderItems: OrderItemRow[]; yearOrderItems: OrderItemRow[]; todayPayments: PaymentRow[]; monthPayments: PaymentRow[]; yearPayments: PaymentRow[]; currentYear: number; currentMonth: number; }

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function StatCard({ label, value, sub, color = "text-slate-900" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="fcf-card p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ReportsClient({ todayOrders, monthOrders, yearOrders, monthOrderItems, yearOrderItems, todayPayments, monthPayments, yearPayments, currentYear, currentMonth }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [dateOrders, setDateOrders] = useState<OrderRow[]>(todayOrders);
  const [datePayments, setDatePayments] = useState<PaymentRow[]>(todayPayments);
  const [productReport, setProductReport] = useState<any[]>([]);
  const [prodDateFrom, setProdDateFrom] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [prodDateTo, setProdDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  // Financial Statement state
  const [finDateFrom, setFinDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [finDateTo, setFinDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [finData, setFinData] = useState<any>(null);
  const [finLoading, setFinLoading] = useState(false);

  const calcSales = (o: OrderRow[]) => o.reduce((s, x) => s + x.total_amount, 0);
  const calcOrderCollected = (o: OrderRow[]) => o.reduce((s, x) => s + x.paid_amount, 0);
  const calcPayments = (p: PaymentRow[]) => p.reduce((s, x) => s + x.amount, 0);
  const calcCollected = (o: OrderRow[], p: PaymentRow[]) => calcOrderCollected(o) + calcPayments(p);
  const calcDue = (o: OrderRow[]) => o.reduce((s, x) => s + x.due_amount, 0);
  // COGS = order items qty × product buy price (dynamic from order data)
  const calcCOGS = (items: OrderItemRow[]) => items.reduce((s, item) => s + (item.quantity * (item.products?.purchase_price || 0)), 0);

  const monthRevenue = calcSales(monthOrders);
  const monthCost = calcCOGS(monthOrderItems);
  const monthProfit = monthRevenue - monthCost;
  const monthMargin = monthRevenue > 0 ? ((monthProfit / monthRevenue) * 100).toFixed(1) : "0";

  const yearRevenue = calcSales(yearOrders);
  const yearCost = calcCOGS(yearOrderItems);
  const yearProfit = yearRevenue - yearCost;

  const dailyChartData = (() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayOrders = monthOrders.filter(o => o.created_at.startsWith(dayStr));
      return { day: `${day}`, Sales: calcSales(dayOrders), Collected: calcOrderCollected(dayOrders) };
    }).filter(d => d.Sales > 0 || d.Collected > 0);
  })();

  const yearlyChartData = MONTHS_SHORT.map((m, i) => {
    const mStr = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
    const mOrders = yearOrders.filter(o => o.created_at.startsWith(mStr));
    const mItems = yearOrderItems.filter(item => item.created_at.startsWith(mStr));
    const rev = calcSales(mOrders);
    const cost = calcCOGS(mItems);
    return { Month: m, Sales: rev, COGS: cost, Profit: Math.max(0, rev - cost), Collected: calcOrderCollected(mOrders) };
  });

  const fetchDateOrders = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [ { data: oData }, { data: pData } ] = await Promise.all([
        supabase.from("orders").select("total_amount, paid_amount, due_amount, status, created_at")
          .gte("created_at", selectedDate).lt("created_at", selectedDate + "T23:59:59").neq("status", "cancelled"),
        supabase.from("payments").select("amount, payment_date, created_at, note")
          .gte("created_at", selectedDate).lt("created_at", selectedDate + "T23:59:59")
      ]);
      setDateOrders(oData || []);
      setDatePayments(pData || []);
    } finally { setLoading(false); }
  };

  const fetchProductReport = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: items } = await supabase.from("order_items")
        .select("quantity, unit_price, line_total, products(id, name, product_code, subject, purchase_price)")
        .gte("created_at", prodDateFrom).lte("created_at", prodDateTo + "T23:59:59");
      const map: Record<string, any> = {};
      (items || []).forEach((item: any) => {
        const pid = item.products?.id; if (!pid) return;
        if (!map[pid]) map[pid] = { ...item.products, units: 0, revenue: 0, cost: 0 };
        map[pid].units += item.quantity;
        map[pid].revenue += item.line_total;
        map[pid].cost += item.quantity * (item.products?.purchase_price || 0);
      });
      const result = Object.values(map).map((p: any) => ({
        ...p, profit: p.revenue - p.cost,
        margin: p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : "0",
      })).sort((a: any, b: any) => b.profit - a.profit);
      setProductReport(result);
    } finally { setLoading(false); }
  };

  const fetchFinancialStatement = async () => {
    setFinLoading(true);
    try {
      const supabase = createClient();
      const fromTs = finDateFrom;
      const toTs = finDateTo + "T23:59:59";

      const [{ data: orders }, { data: orderItems }, { data: payments }, { data: expensesData }] = await Promise.all([
        supabase.from("orders")
          .select("total_amount, paid_amount, due_amount, status, created_at")
          .gte("created_at", fromTs).lte("created_at", toTs)
          .neq("status", "cancelled"),
        supabase.from("order_items")
          .select("quantity, line_total, products(purchase_price)")
          .gte("created_at", fromTs).lte("created_at", toTs),
        supabase.from("payments")
          .select("amount")
          .gte("created_at", fromTs).lte("created_at", toTs),
        supabase.from("expenses")
          .select("category, amount")
          .gte("expense_date", finDateFrom).lte("expense_date", finDateTo),
      ]);

      const totalRevenue = (orders || []).reduce((s: number, o: any) => s + o.total_amount, 0);
      const totalOrderCollected = (orders || []).reduce((s: number, o: any) => s + o.paid_amount, 0);
      const totalOtherPayments = (payments || []).reduce((s: number, p: any) => s + p.amount, 0);
      const totalCollected = totalOrderCollected + totalOtherPayments;
      const totalDue = (orders || []).reduce((s: number, o: any) => s + o.due_amount, 0);
      const cogs = (orderItems || []).reduce((s: number, item: any) => {
        return s + (item.quantity * (item.products?.purchase_price || 0));
      }, 0);
      const grossProfit = totalRevenue - cogs;
      const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : "0";

      // Operating expenses breakdown
      const expensesByCategory: Record<string, number> = {};
      (expensesData || []).forEach((e: any) => {
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
      });
      const totalOpex = (expensesData || []).reduce((s: number, e: any) => s + e.amount, 0);
      const netProfit = grossProfit - totalOpex;
      const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0";

      const orderCount = (orders || []).length;
      const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;

      setFinData({ totalRevenue, totalCollected, totalDue, cogs, grossProfit, grossMargin, totalOpex, expensesByCategory, netProfit, netMargin, orderCount, avgOrder });
    } finally {
      setFinLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!finData) return;
    const rows = [
      ["Income Statement", "FCF Stationery House"],
      ["Period", `${finDateFrom} to ${finDateTo}`],
      [""],
      ["REVENUE"],
      ["Sales Revenue", finData.totalRevenue],
      ["Net Revenue", finData.totalRevenue],
      [""],
      ["COST OF GOODS SOLD"],
      ["Purchase cost of items sold", finData.cogs],
      ["Gross Profit", finData.grossProfit],
      ["Gross Profit Margin (%)", finData.grossMargin],
      [""],
      ["OPERATING EXPENSES"],
      ...Object.entries(finData.expensesByCategory).map(([cat, amt]) => [cat, amt]),
      ["Total Operating Cost", finData.totalOpex],
      ["Net Profit", finData.netProfit],
      ["Net Profit Margin (%)", finData.netMargin],
      [""],
      ["CASH FLOW"],
      ["Cash Collected", finData.totalCollected],
      ["Outstanding Receivables", finData.totalDue],
      ["Collection Rate (%)", (finData.totalRevenue > 0 ? ((finData.totalCollected / finData.totalRevenue) * 100).toFixed(1) : "0")],
      [""],
      ["SUMMARY"],
      ["Total Orders", finData.orderCount],
      ["Avg Order Value", finData.avgOrder.toFixed(2)],
    ];
    const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `financial_statement_${finDateFrom}_to_${finDateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
    { key: "products", label: "By Product" },
    { key: "financial", label: "📊 Financial Statement" },
  ];

  return (
    <div className="space-y-5">
      <style>{PRINT_STYLES}</style>
      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-900">Profit & Loss Report</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overall business financial analysis</p>
      </div>

      <div className="border-b border-slate-200 no-print">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Daily */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          <div className="fcf-card p-4 flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Select Date:</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <button onClick={fetchDateOrders} disabled={loading}
              className="h-9 px-4 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? "..." : "View"}
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Sales" value={formatCurrency(calcSales(dateOrders))} sub={`${dateOrders.length} orders`} color="text-blue-600" />
            <StatCard label="Collected (Orders)" value={formatCurrency(calcOrderCollected(dateOrders))} color="text-green-600" />
            <StatCard label="Due Added" value={formatCurrency(calcDue(dateOrders))} color="text-red-600" />
            <StatCard label="Order Count" value={String(dateOrders.length)} sub="orders" color="text-slate-800" />
          </div>
          <div className="fcf-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Orders of the Day</h3>
            </div>
            <table className="fcf-table">
              <thead><tr><th>Time</th><th className="text-right">Sales</th><th className="text-right">Collected</th><th className="text-right">Due</th></tr></thead>
              <tbody>
                {dateOrders.length === 0
                  ? <tr><td colSpan={4} className="text-center py-8 text-slate-400">No orders on this date</td></tr>
                  : dateOrders.map((o, i) => (
                    <tr key={i}>
                      <td className="text-sm">{new Date(o.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="text-right text-sm font-semibold">{formatCurrency(o.total_amount)}</td>
                      <td className="text-right text-sm text-green-700">{formatCurrency(o.paid_amount)}</td>
                      <td className="text-right text-sm text-red-600">{o.due_amount > 0 ? formatCurrency(o.due_amount) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
              {dateOrders.length > 0 && (
                <tfoot><tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2 text-sm">Total</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(calcSales(dateOrders))}</td>
                  <td className="px-4 py-2 text-right text-green-700">{formatCurrency(calcOrderCollected(dateOrders))}</td>
                  <td className="px-4 py-2 text-right text-red-600">{formatCurrency(calcDue(dateOrders))}</td>
                </tr></tfoot>
              )}
            </table>
          </div>

          <div className="fcf-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Payments Received (Dues/General)</h3>
              <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg font-bold">Total: {formatCurrency(calcPayments(datePayments))}</span>
            </div>
            <table className="fcf-table">
              <thead><tr><th>Time</th><th>Note</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {datePayments.length === 0
                  ? <tr><td colSpan={3} className="text-center py-8 text-slate-400">No general payments on this date</td></tr>
                  : datePayments.map((p, i) => (
                    <tr key={i}>
                      <td className="text-sm">{new Date(p.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="text-sm text-slate-500 italic">{p.note || "General payment"}</td>
                      <td className="text-right text-sm font-bold text-green-700">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
              </tbody>
              {datePayments.length > 0 && (
                <tfoot><tr className="bg-slate-50 font-semibold">
                  <td colSpan={2} className="px-4 py-2 text-sm text-right">Total Payments</td>
                  <td className="px-4 py-2 text-right text-green-700">{formatCurrency(calcPayments(datePayments))}</td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Monthly */}
      {activeTab === "monthly" && (
        <div className="space-y-4">
          <div className="fcf-card p-4 flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-slate-700">Month:</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
              className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none">
              {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Sales" value={formatCurrency(monthRevenue)} color="text-blue-600" sub={`${monthOrders.length} orders`} />
            <StatCard label="Cost of Goods Sold" value={formatCurrency(monthCost)} color="text-orange-600" sub="qty sold × buy price" />
            <StatCard label="Gross Profit" value={formatCurrency(monthProfit)} color={monthProfit >= 0 ? "text-green-600" : "text-red-600"} />
            <StatCard label="Profit Margin" value={`${monthMargin}%`} color={Number(monthMargin) >= 20 ? "text-green-600" : "text-amber-600"} />
          </div>
          {dailyChartData.length > 0 && (
            <div className="fcf-card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Daily Sales Chart</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Yearly */}
      {activeTab === "yearly" && (
        <div className="space-y-4">
          <div className="fcf-card p-4 flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Year:</label>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none">
              {[currentYear - 2, currentYear - 1, currentYear].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Annual Sales" value={formatCurrency(yearRevenue)} color="text-blue-600" sub={`${yearOrders.length} orders`} />
            <StatCard label="Annual COGS" value={formatCurrency(yearCost)} color="text-orange-600" sub="qty sold × buy price" />
            <StatCard label="Annual Gross Profit" value={formatCurrency(yearProfit)} color={yearProfit >= 0 ? "text-green-600" : "text-red-600"} />
          </div>
          <div className="fcf-card p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Monthly Analysis Chart</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={yearlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="Month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="COGS" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="fcf-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Monthly Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="fcf-table">
                <thead><tr><th className="text-left">Month</th><th className="text-right">Sales</th><th className="text-right">Collected</th><th className="text-right">COGS</th><th className="text-right">Gross Profit</th><th className="text-right">Margin</th></tr></thead>
                <tbody>
                  {yearlyChartData.map((row, i) => {
                    const margin = row.Sales > 0 ? ((row.Profit / row.Sales) * 100).toFixed(1) : "0";
                    return (
                      <tr key={i} className={row.Sales === 0 ? "opacity-40" : ""}>
                        <td className="text-sm text-left">{MONTHS[i]}</td>
                        <td className="text-right text-sm font-semibold">{formatCurrency(row.Sales)}</td>
                        <td className="text-right text-sm text-green-600">{formatCurrency(row.Collected)}</td>
                        <td className="text-right text-sm text-orange-600">{formatCurrency(row.COGS)}</td>
                        <td className={`text-right text-sm font-bold ${row.Profit >= 0 ? "text-green-700" : "text-red-600"}`}>{formatCurrency(row.Profit)}</td>
                        <td className={`text-right text-sm font-semibold ${Number(margin) >= 20 ? "text-green-600" : "text-amber-600"}`}>{margin}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="fcf-card p-4 flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-slate-700">Date Range:</label>
            <input type="date" value={prodDateFrom} onChange={e => setProdDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none" />
            <span className="text-slate-400">—</span>
            <input type="date" value={prodDateTo} onChange={e => setProdDateTo(e.target.value)}
              className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none" />
            <button onClick={fetchProductReport} disabled={loading}
              className="h-9 px-4 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? "..." : "View Report"}
            </button>
          </div>
          {productReport.length > 0 && (
            <div className="fcf-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Product-wise Profit (Highest First)</h3>
                <span className="text-sm text-slate-500">{productReport.length} products</span>
              </div>
              <div className="overflow-x-auto">
                <table className="fcf-table">
                  <thead><tr>
                    <th>#</th><th>Product</th><th>Subject</th>
                    <th className="text-right">Sold</th><th className="text-right">Revenue</th>
                    <th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th>
                  </tr></thead>
                  <tbody>
                    {productReport.map((p, i) => (
                      <tr key={p.id}>
                        <td className="text-slate-400 text-sm">{i + 1}</td>
                        <td><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-slate-400">{p.product_code}</p></td>
                        <td className="text-sm text-slate-500">{p.subject || "—"}</td>
                        <td className="text-right text-sm font-semibold">{p.units}</td>
                        <td className="text-right text-sm font-semibold">{formatCurrency(p.revenue)}</td>
                        <td className="text-right text-sm text-orange-600">{formatCurrency(p.cost)}</td>
                        <td className={`text-right text-sm font-bold ${p.profit >= 0 ? "text-green-700" : "text-red-600"}`}>{formatCurrency(p.profit)}</td>
                        <td className={`text-right text-sm font-semibold ${Number(p.margin) >= 20 ? "text-green-600" : "text-amber-600"}`}>{p.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {productReport.length === 0 && (
            <div className="fcf-card p-12 text-center">
              <p className="text-slate-400">Select a date range and click &quot;View Report&quot;</p>
            </div>
          )}
        </div>
      )}
      {/* Financial Statement */}
      {activeTab === "financial" && (
        <div className="space-y-4">
          {/* Date Range */}
          <div className="fcf-card p-4 flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-slate-700">Period:</label>
            <input type="date" value={finDateFrom} onChange={e => setFinDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none" />
            <span className="text-slate-400">—</span>
            <input type="date" value={finDateTo} onChange={e => setFinDateTo(e.target.value)}
              className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none" />
            <button onClick={fetchFinancialStatement} disabled={finLoading}
              className="h-9 px-5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {finLoading ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating...</> : "Generate"}
            </button>
            {finData && (
              <div className="flex gap-2 ml-auto no-print">
                <button onClick={exportToExcel} className="h-9 px-4 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-semibold hover:bg-green-100 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export
                </button>
                <button onClick={handlePrint} className="h-9 px-4 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print
                </button>
              </div>
            )}
          </div>

          {!finData && !finLoading && (
            <div className="fcf-card p-16 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">Select a period and click Generate</p>
              <p className="text-slate-400 text-sm mt-1">Financial statement will be calculated from real order & stock data</p>
            </div>
          )}

          {finData && (
            <div className="space-y-4">
              {/* Income Statement */}
              <div id="printable-statement" className="fcf-card overflow-hidden print:shadow-none print:border-none">
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:bg-slate-100 print:text-slate-900 print:border-b-2 print:border-slate-300">
                  <div>
                    <h2 className="text-lg font-bold">Income Statement</h2>
                    <p className="text-slate-400 text-xs mt-0.5">{finDateFrom} to {finDateTo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">FCF Stationery House</p>
                    <p className="text-xs text-slate-500">Financial Report</p>
                  </div>
                </div>

                <div className="p-6 space-y-0">
                  {/* Revenue Section */}
                  <div className="border-b border-slate-100 pb-4 mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Revenue</p>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-sm text-slate-600">Sales Revenue ({finData.orderCount} orders)</span>
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(finData.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 bg-blue-50 px-3 rounded-lg mt-2">
                      <span className="text-sm font-bold text-blue-800">Net Revenue</span>
                      <span className="text-base font-bold text-blue-700">{formatCurrency(finData.totalRevenue)}</span>
                    </div>
                  </div>

                  {/* COGS Section */}
                  <div className="border-b border-slate-100 pb-4 mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Cost of Goods Sold</p>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-sm text-slate-600">Purchase cost of items sold</span>
                      <span className="text-sm font-semibold text-orange-600">({formatCurrency(finData.cogs)})</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 pl-1">Calculated: qty sold × product buy price</p>
                    <div className="flex justify-between items-center py-1.5 bg-green-50 px-3 rounded-lg mt-3">
                      <span className="text-sm font-bold text-green-800">Gross Profit</span>
                      <span className={`text-base font-bold ${finData.grossProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatCurrency(finData.grossProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 mt-1">
                      <span className="text-sm text-slate-500">Gross Profit Margin</span>
                      <span className={`text-sm font-bold px-3 py-0.5 rounded-full ${
                        Number(finData.grossMargin) >= 30 ? "bg-green-100 text-green-700" :
                        Number(finData.grossMargin) >= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      }`}>{finData.grossMargin}%</span>
                    </div>
                  </div>

                  {/* Operating Expenses Section */}
                  <div className="border-b border-slate-100 pb-4 mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Operating Expenses</p>
                    {Object.keys(finData.expensesByCategory).length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No expenses recorded for this period</p>
                    ) : (
                      Object.entries(finData.expensesByCategory).map(([cat, amt]: [string, any]) => (
                        <div key={cat} className="flex justify-between items-center py-1">
                          <span className="text-sm text-slate-600 capitalize">{cat}</span>
                          <span className="text-sm font-semibold text-red-500">({formatCurrency(amt)})</span>
                        </div>
                      ))
                    )}
                    <div className="flex justify-between items-center py-1.5 bg-red-50 px-3 rounded-lg mt-2">
                      <span className="text-sm font-bold text-red-800">Total Operating Cost</span>
                      <span className="text-sm font-bold text-red-700">({formatCurrency(finData.totalOpex)})</span>
                    </div>
                    <div className={`flex justify-between items-center py-2 px-3 rounded-lg mt-2 ${finData.netProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                      <span className={`text-base font-bold ${finData.netProfit >= 0 ? "text-emerald-800" : "text-red-800"}`}>Net Profit</span>
                      <span className={`text-base font-bold ${finData.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {formatCurrency(finData.netProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 mt-1">
                      <span className="text-sm text-slate-500">Net Profit Margin</span>
                      <span className={`text-sm font-bold px-3 py-0.5 rounded-full ${
                        Number(finData.netMargin) >= 20 ? "bg-green-100 text-green-700" :
                        Number(finData.netMargin) >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      }`}>{finData.netMargin}%</span>
                    </div>
                  </div>

                  {/* Cash Flow Section */}
                  <div className="border-b border-slate-100 pb-4 mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Cash Flow</p>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-sm text-slate-600">Cash Collected</span>
                      <span className="text-sm font-semibold text-green-700">{formatCurrency(finData.totalCollected)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-sm text-slate-600">Outstanding Receivables</span>
                      <span className="text-sm font-semibold text-red-600">{formatCurrency(finData.totalDue)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 bg-slate-50 px-3 rounded-lg mt-2">
                      <span className="text-sm font-bold text-slate-700">Collection Rate</span>
                      <span className="text-sm font-bold text-slate-800">
                        {finData.totalRevenue > 0 ? ((finData.totalCollected / finData.totalRevenue) * 100).toFixed(1) : "0"}%
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Summary</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-500">Total Orders</p>
                        <p className="text-xl font-bold text-slate-800">{finData.orderCount}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-500">Avg Order Value</p>
                        <p className="text-xl font-bold text-slate-800">{formatCurrency(finData.avgOrder)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Gross Revenue" value={formatCurrency(finData.totalRevenue)} color="text-blue-600" />
                <StatCard label="COGS" value={formatCurrency(finData.cogs)} color="text-orange-600" sub="buy price × qty sold" />
                <StatCard label="Operating Expenses" value={formatCurrency(finData.totalOpex)} color="text-red-500" />
                <StatCard label="Net Profit" value={formatCurrency(finData.netProfit)} color={finData.netProfit >= 0 ? "text-emerald-600" : "text-red-600"} sub={`${finData.netMargin}% margin`} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
