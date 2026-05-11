"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Customer, Product } from "@/types";
import { toast } from "sonner";
import CustomerSelector from "./CustomerSelector";
import ProductRows from "./ProductRows";
import PaymentSection from "./PaymentSection";

interface Props {
  customers: Customer[];
  products: (Product & { product_categories: { name: string } | null })[];
  userId: string;
}

export interface OrderItem {
  product_id: string;
  product: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export default function NewOrderClient({ customers, products, userId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Step 1: Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Step 2: Products
  const [items, setItems] = useState<OrderItem[]>([]);

  // Step 3: Payment
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "due" | "partial">("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState("");

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const totalAmount = Math.max(0, subtotal - orderDiscount);
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  useEffect(() => {
    if (paymentMethod === "cash") setPaidAmount(totalAmount);
    else if (paymentMethod === "due") setPaidAmount(0);
  }, [paymentMethod, totalAmount]);

  // Auto-save draft
  useEffect(() => {
    const draft = { selectedCustomer, items, orderDiscount, paymentMethod, note };
    localStorage.setItem("fcf_order_draft", JSON.stringify(draft));
  }, [selectedCustomer, items, orderDiscount, paymentMethod, note]);

  const handleSubmit = async () => {
    if (!selectedCustomer) { toast.error("Please select a customer"); return; }
    if (items.length === 0) { toast.error("Add at least one product"); return; }

    // Stock check
    for (const item of items) {
      if (item.quantity > item.product.stock_quantity) {
        toast.error(`${item.product.name} — insufficient stock (available: ${item.product.stock_quantity})`);
        return;
      }
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();

      // Get next order number safely using max existing number instead of count
      const { data: lastOrder } = await supabase
        .from("orders")
        .select("order_number")
        .like("order_number", `ORD-${year}-%`)
        .order("order_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNum = 1;
      if (lastOrder && lastOrder.order_number) {
        const parts = lastOrder.order_number.split("-");
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }

      const orderNumber = `ORD-${year}-${String(nextNum).padStart(4, "0")}`;

      // Insert order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_id: selectedCustomer.id,
          status: "pending",
          payment_method: paymentMethod,
          subtotal,
          discount_amount: orderDiscount,
          total_amount: totalAmount,
          paid_amount: paymentMethod === "cash" ? totalAmount : paidAmount,
          due_amount: paymentMethod === "cash" ? 0 : dueAmount,
          note: note || null,
          created_by: userId,
        })
        .select()
        .single();

      if (orderErr) {
        console.error("Order insert error:", orderErr);
        throw new Error(orderErr.message || "Order insert failed");
      }

      // Insert order items
      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount,
          line_total: i.line_total,
        }))
      );
      if (itemsErr) {
        console.error("Order items error:", itemsErr);
        throw new Error(itemsErr.message || "Order items insert failed");
      }

      // Note: We DO NOT insert the invoice here from the frontend!
      // The database has an AFTER INSERT trigger (on_order_create_invoice) 
      // which automatically generates and inserts the invoice.

      // Deduct stock & log movements (non-blocking)
      for (const item of items) {
        const newStock = Math.max(0, item.product.stock_quantity - item.quantity);
        await supabase.from("products").update({ stock_quantity: newStock }).eq("id", item.product_id);
        await supabase.from("stock_movements").insert({
          product_id: item.product_id,
          movement_type: "sale_out",
          quantity: item.quantity,
          stock_before: item.product.stock_quantity,
          stock_after: newStock,
          reference_id: order.id,
          reference_type: "order",
          note: `Sale: ${orderNumber}`,
          created_by: userId,
        });
      }

      // Update customer totals (non-blocking) - handled automatically by database trigger sync_customer_totals

      localStorage.removeItem("fcf_order_draft");
      toast.success("Order created successfully! 🎉");
      // Redirect directly to invoice page
      router.push(`/orders/${order.id}/invoice`);
    } catch (err: any) {
      console.error("Order creation error:", err);
      const msg = err?.message || "Failed to create order";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Order</h1>
          <p className="text-sm text-slate-500">Enter customer, products & payment details</p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
          ← Back
        </button>
      </div>

      {/* Step 1 — Customer */}
      <CustomerSelector
        customers={customers}
        selected={selectedCustomer}
        onSelect={setSelectedCustomer}
      />

      {/* Step 2 — Products */}
      <ProductRows
        products={products}
        items={items}
        onChange={setItems}
      />

      {/* Step 3 — Payment */}
      <PaymentSection
        subtotal={subtotal}
        orderDiscount={orderDiscount}
        setOrderDiscount={setOrderDiscount}
        totalAmount={totalAmount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paidAmount={paidAmount}
        setPaidAmount={setPaidAmount}
        dueAmount={dueAmount}
        note={note}
        setNote={setNote}
      />

      {/* Submit */}
      <div className="fcf-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Total Order Value</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
          {dueAmount > 0 && (
            <p className="text-sm text-red-600">Due: {formatCurrency(dueAmount)}</p>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !selectedCustomer || items.length === 0}
          className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 font-bangla flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Order
            </>
          )}
        </button>
      </div>
    </div>
  );
}
