import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserTaxRate() {
  const [taxRate, setTaxRate] = useState<number>(20); // default 20%
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

    // If user has an explicit tax_rate stored, clamp it to [0, 100]; otherwise fall back to 20%
    if (data && typeof data.tax_rate === "number") {
      const clamped = Math.min(100, Math.max(0, data.tax_rate));
      setTaxRate(clamped);
    } else {
      setTaxRate(20);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTaxRate();
  }, []);

  return { taxRate, setTaxRate, loading, refetch: fetchTaxRate };
}
