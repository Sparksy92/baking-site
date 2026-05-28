import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'

const Home = lazy(() => import('./pages/Home'))
const CollectionPage = lazy(() => import('./pages/Collection'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Confirmation = lazy(() => import('./pages/Confirmation'))
const OrderLookup = lazy(() => import('./pages/OrderLookup'))
const SearchPage = lazy(() => import('./pages/Search'))

// Admin pages
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const AdminLogin = lazy(() => import('./admin/pages/Login'))
const AdminDashboard = lazy(() => import('./admin/pages/Dashboard'))
const AdminOrders = lazy(() => import('./admin/pages/Orders'))
const AdminProducts = lazy(() => import('./admin/pages/Products'))
const AdminProductForm = lazy(() => import('./admin/pages/ProductForm'))
const AdminCollections = lazy(() => import('./admin/pages/Collections'))
const AdminSettings = lazy(() => import('./admin/pages/Settings'))

function Loading() {
  return <div className="py-12 text-center text-gray-400">Loading...</div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Storefront */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/collections/:slug" element={<CollectionPage />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/confirmation/:orderNumber" element={<Confirmation />} />
            <Route path="/order-lookup" element={<OrderLookup />} />
            <Route path="/search" element={<SearchPage />} />
          </Route>

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/products/new" element={<AdminProductForm />} />
            <Route path="/admin/products/:id" element={<AdminProductForm />} />
            <Route path="/admin/collections" element={<AdminCollections />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
