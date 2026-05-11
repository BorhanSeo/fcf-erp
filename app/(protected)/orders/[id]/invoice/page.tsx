import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import InvoiceView from "./InvoiceView";

interface Props { params: { id: string } }

export default async function InvoicePage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      customers(name, phone, address, area),
      order_items(*, products(name, product_code, subject, unit)),
      invoices(invoice_number)
    `)
    .eq("id", params.id)
    .single();

  if (!order) notFound();

  // Auto-create invoice if it doesn't exist (fixes legacy orders)
  if (!order.invoices || order.invoices.length === 0) {
    const year = new Date().getFullYear();
    
    // Use MAX-based numbering to avoid duplicates after deletions
    const { data: lastInvoice } = await supabase
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `INV-${year}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNum = 1;
    if (lastInvoice?.invoice_number) {
      const parts = lastInvoice.invoice_number.split("-");
      const last = parseInt(parts[2], 10);
      if (!isNaN(last)) nextNum = last + 1;
    }
    const invoiceNumber = `INV-${year}-${String(nextNum).padStart(4, "0")}`;

    const { data: newInvoice } = await supabase
      .from("invoices")
      .insert({ 
        invoice_number: invoiceNumber, 
        order_id: order.id,
        customer_id: order.customer_id,
        total_amount: order.total_amount,
        paid_amount: order.paid_amount,
        due_amount: order.due_amount
      })
      .select("invoice_number")
      .single();

    if (newInvoice) {
      order.invoices = [newInvoice];
    }
  }

  const { data: settings } = await supabase.from("settings").select("key, value");
  const settingsMap = Object.fromEntries((settings || []).map((s) => [s.key, s.value]));

  return <InvoiceView order={order} settings={settingsMap} />;
}
