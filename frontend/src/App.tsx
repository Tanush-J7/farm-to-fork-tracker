import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { DashboardLayout } from "./components/layout/DashboardLayout"
import { PublicLayout } from "./components/layout/PublicLayout"
import { LandingPage } from "./pages/LandingPage"
import { LoginPage } from "./pages/LoginPage"
import { RegisterPage } from "./pages/RegisterPage"
import { Dashboard } from "./pages/Dashboard"
import { FarmerDashboard } from "./pages/FarmerDashboard"
import { MyProductsPage } from "./pages/MyProductsPage"
import { ProcessorDashboard } from "./pages/ProcessorDashboard"
import { DistributorDashboard } from "./pages/DistributorDashboard"
import { RetailerDashboard } from "./pages/RetailerDashboard"
import { AnalyticsDashboard } from "./pages/AnalyticsDashboard"
import { Tracker } from "./pages/Tracker"
import { AdminUsers } from "./pages/admin/AdminUsers"
import { AdminUserDetails } from "./pages/admin/AdminUserDetails"
import { AdminProducts } from "./pages/admin/AdminProducts"
import { AdminProductDetails } from "./pages/admin/AdminProductDetails"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes wrapped in PublicLayout */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/track" element={<Tracker />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/verify" element={<Tracker />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected dashboard routes */}
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetails />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/:id" element={<AdminProductDetails />} />
          </Route>

          <Route path="/farmer" element={<DashboardLayout />}>
            <Route index element={<FarmerDashboard />} />
            <Route path="products" element={<MyProductsPage />} />
          </Route>

          <Route path="/processor" element={<DashboardLayout />}>
            <Route index element={<ProcessorDashboard />} />
          </Route>

          <Route path="/distributor" element={<DashboardLayout />}>
            <Route index element={<DistributorDashboard />} />
          </Route>

          <Route path="/retailer" element={<DashboardLayout />}>
            <Route index element={<RetailerDashboard />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={
            <div className="flex min-h-screen items-center justify-center flex-col gap-4">
              <h1 className="text-6xl font-bold text-primary">404</h1>
              <p className="text-muted-foreground">Page not found.</p>
              <a href="/" className="text-primary hover:underline">Go Home</a>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
