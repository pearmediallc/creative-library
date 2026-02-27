import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { FAQSection } from '../components/FAQSection';
import { useAuth } from '../contexts/AuthContext';

export function FAQPage() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <FAQSection userRole={user?.role} />
      </div>
    </DashboardLayout>
  );
}
