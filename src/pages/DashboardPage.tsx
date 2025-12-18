import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate('/auth');
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/auth');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Dashboard - YieldCanary | Income ETF Health Monitor</title>
        <meta 
          name="description" 
          content="Monitor your income ETFs. See true yield, death clock, and canary status for all high-yield funds." 
        />
      </Helmet>
      {/* Sidebar layout temporarily disabled */}
      {/* <DashboardLayout> */}
      <Dashboard />
      {/* </DashboardLayout> */}
    </>
  );
};

export default DashboardPage;
