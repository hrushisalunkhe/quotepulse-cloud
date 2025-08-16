import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  Plus, 
  FileText, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Bell,
  User,
  LogOut,
  Settings,
  Clock,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import NotificationCenter from "@/components/NotificationCenter";
import { format } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, userRole, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3); // Mock unread count
  const [stats, setStats] = useState({
    activeRfqs: 0,
    pendingQuotes: 0,
    totalVendors: 0,
    completedRfqs: 0
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      if (!user) return;

      // Load RFQ stats
      const { data: rfqData, error: rfqError } = await supabase
        .from("rfqs")
        .select("status")
        .eq("created_by", user.id);

      if (rfqError) throw rfqError;

      const activeRfqs = rfqData?.filter(rfq => rfq.status === 'open').length || 0;
      const completedRfqs = rfqData?.filter(rfq => ['closed', 'awarded'].includes(rfq.status)).length || 0;

      // Load quotes stats
      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .select("status, rfq_id")
        .eq("vendor_id", user.id);

      if (quoteError) throw quoteError;

      const pendingQuotes = quoteData?.filter(quote => quote.status === 'draft').length || 0;

      setStats({
        activeRfqs,
        pendingQuotes,
        totalVendors: 0, // Will implement vendor counting later
        completedRfqs
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">VendorWorld</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back, {user?.email}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative"
                onClick={() => setNotificationOpen(true)}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 text-xs flex items-center justify-center p-0"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
              
              {/* Role Badge */}
              {userRole && (
                <Badge variant={userRole === 'vendor' ? 'default' : 'secondary'}>
                  {userRole === 'vendor' ? 'Vendor' : 'Client'}
                </Badge>
              )}
              
              {/* Profile Settings */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/profile")}
              >
                <User className="h-4 w-4" />
              </Button>
              
              {/* Sign Out */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">
            Welcome back, {user?.email}!
          </h2>
          <p className="text-muted-foreground">
            Here's what's happening with your vendor management today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active RFQs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeRfqs}</div>
              <p className="text-xs text-muted-foreground">
                Currently seeking quotes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Quotes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingQuotes}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting submission
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVendors}</div>
              <p className="text-xs text-muted-foreground">
                In your network
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed RFQs</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedRfqs}</div>
              <p className="text-xs text-muted-foreground">
                Successfully closed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks to get you started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full justify-start" 
                onClick={() => navigate("/rfqs/create")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New RFQ
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/rfqs")}
              >
                <FileText className="mr-2 h-4 w-4" />
                View All RFQs
              </Button>
              {userRole === 'vendor' && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate("/rfqs")}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Browse Available RFQs
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/reports")}
              >
                <FileText className="mr-2 h-4 w-4" />
                View Reports
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/profile")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Profile Settings
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/vendors")}
              >
                <Users className="mr-2 h-4 w-4" />
                Vendor Directory
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates from your RFQs and quotes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                No recent activity to display.
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={notificationOpen} 
        onClose={() => setNotificationOpen(false)} 
      />
    </>
  );
};

export default Dashboard;