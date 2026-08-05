import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function run() {
  try {
    const { count: pCount } = await supabaseAdmin.from("payments").select("*", { count: "exact", head: true });
    const { count: bpCount } = await supabaseAdmin.from("billing_payments").select("*", { count: "exact", head: true });
    console.log(JSON.stringify({ payments: pCount, billing_payments: bpCount }));
  } catch (e) {
    console.error(e);
  }
}
run();
