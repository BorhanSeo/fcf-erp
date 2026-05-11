"use client";

import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

interface Props { order: any; settings?: Record<string, string> }

export default function InvoiceView({ order, settings }: Props) {
  const invoice = order.invoices?.[0];
  const storeSettings = useSettingsStore((state) => state.settings);
  const companyName = storeSettings.company_name || settings?.company_name || "FCF Stationery House";
  const companyPhone = storeSettings.company_phone || settings?.company_phone || "";
  const companyAddress = storeSettings.company_address || settings?.company_address || "Wholesale Stationery Dokan, Bangladesh";

  const handlePrint = () => window.print();

  const handleDownloadPDF = () => {
    const element = document.getElementById("invoice-print");
    if (!element) return;

    const opt = {
      margin: 0.5,
      filename: `Invoice-${invoice?.invoice_number || "Draft"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };

    const w = window as any;
    if (w.html2pdf) {
      w.html2pdf().set(opt).from(element).save();
    } else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => {
        w.html2pdf().set(opt).from(element).save();
      };
      document.body.appendChild(script);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Action bar - hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/orders/${order.id}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          ← Back to Order
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Invoice — printable */}
      <div className="fcf-card relative overflow-hidden p-8 print:shadow-none print:border-none" id="invoice-print">
        {/* PAID Watermark */}
        {order.due_amount <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <div className="transform -rotate-[30deg] border-[8px] border-green-500 text-green-500 opacity-10 text-[80px] font-black uppercase tracking-widest px-8 py-2 rounded-2xl select-none">
              PAID
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-900">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="FCF Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{companyName}</h1>
                <p className="text-sm text-slate-500">{companyAddress}</p>
                {companyPhone && <p className="text-sm text-slate-500">{companyPhone}</p>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-blue-600">INVOICE</h2>
            <p className="text-slate-700 font-semibold mt-1">{invoice?.invoice_number || order.order_number}</p>
            <p className="text-sm text-slate-500 mt-1">{formatDate(order.created_at)}</p>
            <div className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
              order.due_amount > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}>
              {order.due_amount > 0 ? "Partially Paid" : "Fully Paid"}
            </div>
          </div>
        </div>

        {/* Bill to */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">BILL TO</p>
          <p className="font-semibold text-slate-900 text-lg">{order.customers?.name}</p>
          <p className="text-slate-600">{order.customers?.phone}</p>
          {order.customers?.area && <p className="text-slate-500">{order.customers.area}</p>}
          {order.customers?.address && <p className="text-slate-500 text-sm">{order.customers.address}</p>}
        </div>

        {/* Items table */}
        <table className="w-full mb-6">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-4 py-3 text-left text-xs font-semibold">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold">Product</th>
              <th className="px-4 py-3 text-left text-xs font-semibold">Subject</th>
              <th className="px-4 py-3 text-right text-xs font-semibold">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold">Price</th>
              <th className="px-4 py-3 text-right text-xs font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item: any, idx: number) => (
              <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">{item.products?.name}</p>
                </td>
                <td className="px-4 py-3 text-sm font-bangla">{item.products?.subject || "—"}</td>
                <td className="px-4 py-3 text-right text-sm">{item.quantity} {item.products?.unit}</td>
                <td className="px-4 py-3 text-right text-sm">{formatCurrency(item.unit_price)}</td>
                <td className="px-4 py-3 text-right font-semibold text-sm">{formatCurrency(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end relative z-10">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t-2 border-slate-900">
              <span>Total</span>
              <span>{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Paid</span>
              <span>{formatCurrency(order.paid_amount)}</span>
            </div>
            {order.due_amount > 0 && (
              <div className="flex justify-between text-sm text-red-600 font-bold">
                <span>Due</span>
                <span>{formatCurrency(order.due_amount)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 text-xs text-slate-500">
              Payment: {order.payment_method === "cash" ? "Cash" : order.payment_method === "due" ? "Due" : "Partial"}
            </div>
          </div>
        </div>

        {order.note && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">Note: {order.note}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-500">Thank you for your business! 🙏</p>
          <p className="text-xs text-slate-400 mt-1">{companyName} — {companyAddress}</p>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          body * { visibility: hidden; }
          
          #invoice-print, #invoice-print * {
            visibility: visible;
          }
          
          #invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
          }
          
          /* Hide sidebar/navbar spaces */
          nav, aside, header { display: none !important; }
        }
      `}</style>
    </div>
  );
}
