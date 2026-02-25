import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DashboardContentSkeleton } from '@/components/dashboard/DashboardContentSkeleton';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';

const DashboardPage = () => {
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate('/auth');
        }
        setAuthLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/auth');
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <>
      <Helmet>
        <title>Dashboard - YieldCanary | Income ETF Health Monitor</title>
        <meta 
          name="description" 
          content="Monitor your income ETFs. See true yield, death clock, and canary status for all high-yield funds." 
        />
      </Helmet>
      <DashboardLayout>
        {authLoading ? <DashboardContentSkeleton /> : <Dashboard />}
      </DashboardLayout>
    </>
  );
};

export default DashboardPage;
