import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toaster } from '@/components/Toaster';
import { CustomerProvider } from '@/lib/customer';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerProvider>
      <div className="min-h-screen flex flex-col bg-white">
        <Suspense><Header /></Suspense>
        <Toaster />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
      </div>
    </CustomerProvider>
  );
}
