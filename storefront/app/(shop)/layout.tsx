import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toaster } from '@/components/Toaster';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <Toaster />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
