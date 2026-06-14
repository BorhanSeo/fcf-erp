"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Customer, Product } from "@/types";
import { toast } from "sonner";
import CustomerSelector from "../../new/CustomerSelector";
import ProductRows from "../../new/ProductRows";
import PaymentSection from "../../new/PaymentSection";

interface Props {
  order: any;
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

export default function EditOrderClient({ order, customers, products, userId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Step 1: Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    customers.find((c) => c.id === order.customer_id) || order.customers || null
  );

  // Step 2: Products
  const [items, setItems] = useState<OrderItem[]>(() => {
    return (order.order_items || []).map((oi: any) => ({
      product_id: oi.product_id,
      product: products.find((p) => p.id === oi.product_id) || oi.products || {
        id: oi.product_id,
        name: oi.products?.name || "Unknown Product",
        product_code: oi.products?.product_code || "",
        stock_quantity: oi.products?.stock_quantity || 0,
        purchase_price: oi.products?.purchase_price || 0,
        selling_price: oi.products?.selling_price || 0,
      },
      quantity: oi.quantity,
      unit_price: Number(oi.unit_price),
      discount: Number(oi.discount),
      line_total: Number(oi.line_total),
    }));
  });

  // Step 3: Payment
  const [orderDiscount, setOrderDiscount] = useState(Number(order.discount_amount) || 0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "due" | "partial">(order.payment_method);
  const [paidAmount, setPaidAmount] = useState(Number(order.paid_amount) || 0);
  const [note, setNote] = useState(order.note || "");

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const totalAmount = Math.max(0, subtotal - orderDiscount);
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  // Sync paidAmount for cash and due payment methods
  // But preserve the initial edit values on mount
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      return;
    }
    if (paymentMethod === "cash") setPaidAmount(totalAmount);
    else if (paymentMethod === "due") setPaidAmount(0);
  }, [paymentMethod, totalAmount, isInitialized]);

  const handleSubmit = async () => {
    if (!selectedCustomer) { toast.error("Please select a customer"); return; }
    if (items.length === 0) { toast.error("Add at least one product"); return; }

    // Stock check
    for (const item of items) {
      const originalItem = (order.order_items || []).find((oi: any) => oi.product_id === item.product_id);
      const originalQty = originalItem ? originalItem.quantity : 0;
      
      const isDelivered = order.status === "delivered";
      // If order was delivered, the stock was already deducted in the DB.
      // So we have that original quantity as "available" buffer for this product.
      const availableStock = isDelivered 
        ? item.product.stock_quantity + originalQty
        : item.product.stock_quantity;

      if (item.quantity > availableStock) {
        toast.error(`${item.product.name} — insufficient stock (available: ${availableStock})`);
        return;
      }
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const isDelivered = order.status === "delivered";

      // 1. If delivered, temporarily mark order as 'confirmed' to let DB triggers revert stock
      if (isDelivered) {
        const { error: statusErr } = await supabase
          .from("orders")
          .update({ status: "confirmed" })
          .eq("id", order.id);
        if (statusErr) throw statusErr;
      }

      // 2. Delete old order items
      const { error: deleteErr } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id);
      if (deleteErr) throw deleteErr;

      // 3. Insert new order items
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
      if (itemsErr) throw itemsErr;

      // 4. Update the order fields
      const finalPaid = paymentMethod === "cash" ? totalAmount : paidAmount;
      const finalDue = paymentMethod === "cash" ? 0 : dueAmount;

      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          customer_id: selectedCustomer.id,
          status: isDelivered ? "delivered" : order.status,
          payment_method: paymentMethod,
          subtotal,
          discount_amount: orderDiscount,
          total_amount: totalAmount,
          paid_amount: finalPaid,
          due_amount: finalDue,
          note: note || null,
        })
        .eq("id", order.id);

      if (orderErr) throw orderErr;

      // 5. Keep invoices table in sync
      await supabase
        .from("invoices")
        .update({
          customer_id: selectedCustomer.id,
          total_amount: totalAmount,
          paid_amount: finalPaid,
          due_amount: finalDue
        })
        .eq("order_id", order.id);

      toast.success("Order updated successfully! 🎉");
      router.push(`/orders/${order.id}`);
      router.refresh();
    } catch (err: any) {
      console.error("Order edit error:", err);
      toast.error(err?.message || "Failed to update order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-bangla">Edit Order: {order.order_number}</h1>
          <p className="text-sm text-slate-500">Modify customer, products, or payment details</p>
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
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            disabled={loading}
            className="px-5 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all font-medium font-bangla"
          >
            Cancel
          </button>
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
                Updating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
