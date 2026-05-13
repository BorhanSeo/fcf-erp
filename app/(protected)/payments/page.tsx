import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import PaymentsClient from "./PaymentsClient";

export const metadata = { title: "Payments & Due Tracking — FCF ERP" };

export default async function PaymentsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const supabase = await createClient();
  const [
    profile,
    { data: activeOrders },
    { data: suppliersWithDue },
    { data: recentSupplierPayments },
    { data: customerPayments },
  ] = await Promise.all([
    getProfile(user.id),
    supabase.from("orders").select("id, order_number, paid_amount, due_amount, payment_method, note, created_at, customer_id, customers(name, phone, area)").neq("status", "cancelled").order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id, name, company, phone, total_due").gt("total_due", 0).order("total_due", { ascending: false }),
    supabase.from("supplier_payments").select("*, suppliers(name)").order("payment_date", { ascending: false }).limit(10),
    supabase.from("payments").select("*, customers(name, phone)").order("created_at", { ascending: false }).limit(20),
  ]);

  if (!profile) redirect("/login");

  // Compute totals
  const todayTotal = (activeOrders || [])
    .filter(o => o.created_at.startsWith(today))
    .reduce((s, o) => s + o.paid_amount, 0)
    + (customerPayments || [])
    .filter(p => p.created_at.startsWith(today))
    .reduce((s, p) => s + p.amount, 0);
  
  const monthTotal = (activeOrders || [])
    .filter(o => o.created_at.startsWith(monthStart.substring(0, 7)))
    .reduce((s, o) => s + o.paid_amount, 0)
    + (customerPayments || [])
    .filter(p => p.created_at.startsWith(monthStart.substring(0, 7)))
    .reduce((s, p) => s + p.amount, 0);

  const customerDuesMap = new Map<string, any>();
  (activeOrders || []).forEach(o => {
    if (o.due_amount > 0 && o.customers) {
      if (!customerDuesMap.has(o.customer_id)) {
        const c = o.customers as any;
        customerDuesMap.set(o.customer_id, {
          id: o.customer_id,
          name: c.name || (Array.isArray(c) ? c[0]?.name : ""),
          phone: c.phone || (Array.isArray(c) ? c[0]?.phone : ""),
          area: c.area || (Array.isArray(c) ? c[0]?.area : ""),
          total_due: 0
        });
      }
      customerDuesMap.get(o.customer_id).total_due += o.due_amount;
    }
  });
  const customersWithDue = Array.from(customerDuesMap.values()).sort((a, b) => b.total_due - a.total_due);
  const totalCustomerDue = customersWithDue.reduce((s, c) => s + c.total_due, 0);

  const unifiedCustomerPayments = [
    ...(activeOrders || [])
      .filter(o => o.paid_amount > 0)
      .map(o => ({
        id: o.id,
        amount: o.paid_amount,
        payment_method: o.payment_method,
        payment_date: o.created_at,
        note: o.order_number + (o.note ? ` - ${o.note}` : ""),
        customers: o.customers,
        isOrder: true,
        orderNumber: o.order_number,
      })),
    ...(customerPayments || []).map(p => ({
      id: p.id,
      amount: p.amount,
      payment_method: p.payment_method,
      payment_date: p.payment_date,
      note: p.note,
      customers: p.customers,
      isOrder: false,
    }))
  ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
   .slice(0, 20);

  const totalSupplierDue = (suppliersWithDue || []).reduce((s, s2) => s + s2.total_due, 0);

  return (
    <PaymentsClient
      customersWithDue={customersWithDue}
      suppliersWithDue={suppliersWithDue || []}
      recentCustomerPayments={unifiedCustomerPayments}
      recentSupplierPayments={recentSupplierPayments || []}
      totalCustomerDue={totalCustomerDue}
      totalSupplierDue={totalSupplierDue}
      todayTotal={todayTotal}
      monthTotal={monthTotal}
      profile={profile}
    />
  );
}
