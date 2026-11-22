import React from 'react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastProvider } from './components/ui/Overlays';
import { RouterProvider, useRouter } from './router/RouterContext';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { StoreProvider } from './context/StoreContext';
import { MainHeader } from './components/layout/MainHeader';
import { Footer } from './components/layout/Footer';
import { GlobalStoreOverlays } from './components/layout/GlobalStoreOverlays';
import { HomePage } from './components/pages/HomePage';
import { CollectionPage } from './components/pages/CollectionPage';
import { ProductDetailsPage } from './components/pages/ProductDetailsPage';
import {
  AccountPage,
  CartPage,
  HelpPage,
  TrackOrderPage,
  WishlistPage,
} from './components/pages/UtilityPages';
import { CheckoutPage } from './components/pages/CheckoutPage';
import { OrderConfirmationPage } from './components/pages/OrderConfirmationPage';
import { OrdersPage } from './components/pages/OrdersPage';
import { ShowroomPage } from './pages/ShowroomPage';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { DesignSystemView } from './components/design-system/DesignSystemView';

const AppRoutes: React.FC = () => {
  const { pathname, navigate } = useRouter();

  // Admin Dashboard keeps its full-viewport sidebar chrome from Phase 1 + Phase 4 Catalog Management
  if (pathname === '/admin') {
    return <AdminDashboardView onSwitchToStorefront={() => navigate('/')} />;
  }

  // Interactive 3D Virtual Showroom renders full-viewport with its dedicated HUD overlay
  if (pathname === '/showroom') {
    return (
      <>
        <ShowroomPage />
        <GlobalStoreOverlays />
      </>
    );
  }

  const renderPage = () => {
    if (pathname.startsWith('/product/')) {
      const idOrSlug = decodeURIComponent(pathname.replace('/product/', '').trim());
      return <ProductDetailsPage idOrSlug={idOrSlug} />;
    }

    if (pathname.startsWith('/order-confirmation/')) {
      const orderId = decodeURIComponent(pathname.replace('/order-confirmation/', '').trim());
      return <OrderConfirmationPage orderId={orderId} />;
    }

    if (pathname.startsWith('/orders/')) {
      const orderId = decodeURIComponent(pathname.replace('/orders/', '').trim());
      return <OrdersPage orderId={orderId} />;
    }

    switch (pathname) {
      case '/':
        return <HomePage />;
      case '/products':
        return <CollectionPage kind="search" />;
      case '/men':
        return <CollectionPage kind="men" />;
      case '/women':
        return <CollectionPage kind="women" />;
      case '/kids':
        return <CollectionPage kind="kids" />;
      case '/traditional':
        return <CollectionPage kind="traditional" />;
      case '/new-arrivals':
        return <CollectionPage kind="new-arrivals" />;
      case '/offers':
        return <CollectionPage kind="offers" />;
      case '/search':
        return <CollectionPage kind="search" />;
      case '/wishlist':
        return <WishlistPage />;
      case '/cart':
        return <CartPage />;
      case '/checkout':
        return <CheckoutPage />;
      case '/orders':
        return <OrdersPage />;
      case '/account':
        return <AccountPage />;
      case '/track-order':
        return <TrackOrderPage />;
      case '/help':
        return <HelpPage />;
      case '/design-system':
        return <DesignSystemView />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF8EF] text-[#1F1D2B]">
      <MainHeader />
      <div className="flex-1" key={pathname}>
        {renderPage()}
      </div>
      <Footer />
      <GlobalStoreOverlays />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <RouterProvider>
          <AuthProvider>
            <CatalogProvider>
              <StoreProvider>
                <AppRoutes />
              </StoreProvider>
            </CatalogProvider>
          </AuthProvider>
        </RouterProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
