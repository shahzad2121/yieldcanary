import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserTaxRate() {
  const [taxRate, setTaxRate] = useState<number>(15); // default 15%
  const [loading, setLoading] = useState(true);

  const fetchTaxRate = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("users")
      .select("tax_rate")
      .eq("email", session.user.email)
      .single();
    if (data && typeof data.tax_rate === "number") {
      setTaxRate(data.tax_rate);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTaxRate();
  }, []);

  return { taxRate, setTaxRate, loading, refetch: fetchTaxRate };
}
