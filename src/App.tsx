import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RFQs from "./pages/RFQs";
import CreateRFQ from "./pages/CreateRFQ";
import RFQDetail from "./pages/RFQDetail";
import QuoteSubmission from "./pages/QuoteSubmission";
import ParticipantManagement from "./pages/ParticipantManagement";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/rfqs" element={
            <ProtectedRoute>
              <RFQs />
            </ProtectedRoute>
          } />
          <Route path="/rfqs/create" element={
            <ProtectedRoute>
              <CreateRFQ />
            </ProtectedRoute>
          } />
          <Route path="/rfqs/:id" element={
            <ProtectedRoute>
              <RFQDetail />
            </ProtectedRoute>
          } />
          <Route path="/rfqs/:id/quote" element={
            <ProtectedRoute>
              <QuoteSubmission />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          } />
          <Route path="/rfqs/:id/participants" element={
            <ProtectedRoute>
              <ParticipantManagement />
            </ProtectedRoute>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
