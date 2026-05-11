"use client";

import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { formatCurrency, formatDate, getStatusLabel, isAdmin } from "@/lib/utils";
import { Profile, TodaySummary, LowStockItem, Order, MonthlyPL } from "@/types";
import { Badge } from "@/components/ui/badge";

interface DashboardClientProps {
  profile: Profile;
  todaySummary: TodaySummary | null;
  lowStockItems: LowStockItem[];
  recentOrders: (Order & { customers: { name: string; phone: string } | null })[];
  monthlyPL: MonthlyPL[];
  totalDue: number;
}

const MONTH_NAMES: Record<string, string> = {
  "1": "Jan", "2": "Feb", "3": "Mar", "4": "Apr",
  "5": "May", "6": "Jun", "7": "Jul", "8": "Aug",
  "9": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

export default function DashboardClient({
  profile, todaySummary, lowStockItems, recentOrders, monthlyPL, totalDue,
}: DashboardClientProps) {
  const admin = isAdmin(profile.role);

  const chartData = [...(monthlyPL || [])].reverse().map((m) => ({
    name: MONTH_NAMES[String(m.month)] || m.month,
    Revenue: m.revenue || 0,
    Purchase: m.purchase_cost || 0,
    Profit: m.gross_profit || 0,
  }));

  const getOrderStatusVariant = (status: string) => {
    switch (status) {
      case "pending": return "pending";
      case "confirmed": return "confirmed";
      case "delivered": return "delivered";
      case "cancelled": return "cancelled";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome, {profile.full_name}! Here&apos;s today&apos;s summary.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Order
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={`grid gap-4 ${admin ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>

        {/* Today Sales */}
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">Today</span>
          </div>
          <div className="mt-3">
            <p className="stat-card-value">{formatCurrency(todaySummary?.today_sales || 0)}</p>
            <p className="stat-card-label">Today&apos;s Sales</p>
          </div>
        </div>

        {/* Today Orders */}
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Today</span>
          </div>
          <div className="mt-3">
            <p className="stat-card-value">{todaySummary?.today_orders || 0}</p>
            <p className="stat-card-label">Today&apos;s Orders</p>
          </div>
        </div>

        {/* Total Due - Admin only */}
        {admin && (
          <div className="stat-card border-amber-100">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Total</span>
            </div>
            <div className="mt-3">
              <p className="stat-card-value text-amber-700">{formatCurrency(totalDue)}</p>
              <p className="stat-card-label">Total Outstanding Due</p>
            </div>
          </div>
        )}

        {/* Low Stock */}
        <div className="stat-card border-red-100">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            {lowStockItems.length > 0 && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-semibold">{lowStockItems.length}</span>
            )}
          </div>
          <div className="mt-3">
            <p className="stat-card-value text-red-600">{lowStockItems.length}</p>
            <p className="stat-card-label">Low Stock Products</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/orders/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Order
        </Link>
        {admin && (
          <Link href="/purchases/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            New Purchase
          </Link>
        )}
        <Link href="/stock" className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          View Stock
        </Link>
      </div>

      {/* Charts — Admin only */}
      {admin && chartData.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="fcf-card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Revenue vs Purchase Cost (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), ""]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Revenue" fill="#1A56DB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Purchase" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="fcf-card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Profit Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), ""]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="Profit" stroke="#16A34A" strokeWidth={2.5} dot={{ fill: "#16A34A", r: 4 }} />
                <Line type="monotone" dataKey="Revenue" stroke="#1A56DB" strokeWidth={2} dot={{ fill: "#1A56DB", r: 3 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Recent Orders */}
        <div className="fcf-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Orders</h3>
            <Link href="/orders" className="text-xs text-blue-600 hover:text-blue-800 transition-colors">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="fcf-table">
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-400 py-8">No orders yet</td>
                  </tr>
                ) : recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline font-medium text-xs">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="text-xs">{order.customers?.name || "—"}</td>
                    <td className="font-medium text-xs">{formatCurrency(order.total_amount)}</td>
                    <td>
                      <Badge variant={getOrderStatusVariant(order.status) as any}>
                        {getStatusLabel(order.status)}
                      </Badge>
                    </td>
                    <td className="text-slate-500 text-xs">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="fcf-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Low Stock Alert</h3>
            <Link href="/stock" className="text-xs text-blue-600 hover:text-blue-800 transition-colors">View stock →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="fcf-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Subject</th>
                  <th>Stock</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-green-600 py-8">
                      ✓ All products have sufficient stock
                    </td>
                  </tr>
                ) : lowStockItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div>
                        <p className="font-medium text-xs">{item.name}</p>
                        <p className="text-slate-400 text-xs">{item.product_code}</p>
                      </div>
                    </td>
                    <td className="text-xs">{item.subject || "—"}</td>
                    <td>
                      <span className={`font-bold text-sm ${item.stock_quantity <= 0 ? "text-red-600" : "text-amber-600"}`}>
                        {item.stock_quantity}
                      </span>
                      <span className="text-slate-400 text-xs ml-1">/ {item.low_stock_threshold}</span>
                    </td>
                    <td className="text-xs text-slate-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
