import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, DollarSign, Users, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface RFQ {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled';
  due_date: string;
  created_at: string;
  created_by: string;
  quotes?: Array<{
    id: string;
    amount: number;
    status: string;
  }>;
  participants?: Array<{
    id: string;
    status: string;
  }>;
}

const RFQs = () => {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    if (user && userRole) {
      loadRFQs();
    } else if (user === null) {
      navigate("/auth");
    }
  }, [user, userRole]);

  const checkAuthAndLoadRFQs = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    await loadRFQs();
  };

  const loadRFQs = async () => {
    try {
      if (!user || !userRole) return;

      let query = supabase
        .from("rfqs")
        .select(`
          *,
          quotes(id, amount, status, vendor_id),
          rfq_participants(id, status, vendor_id),
          profiles!rfqs_created_by_fkey(id, full_name, company_name)
        `);

      // Different queries based on user role
      if (userRole === 'client') {
        // Clients see their own RFQs
        query = query.eq("created_by", user.id);
      } else if (userRole === 'vendor') {
        // Vendors see all open RFQs (RLS policy ensures they can only see open ones)
        // No additional filter needed as RLS handles access control
      }

      const { data: rfqData, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      setRfqs(rfqData || []);
    } catch (error) {
      console.error("Error loading RFQs:", error);
      toast({
        title: "Error",
        description: "Failed to load RFQs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'open': return 'default';
      case 'closed': return 'outline';
      case 'awarded': return 'destructive';
      case 'cancelled': return 'secondary';
      default: return 'default';
    }
  };

  const filteredRFQs = rfqs.filter(rfq => {
    const matchesSearch = rfq.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rfq.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === "all" || rfq.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              ← Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                {userRole === 'client' ? 'My RFQs' : 'Available RFQs'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {userRole === 'client' 
                  ? 'Manage your requests for quotation' 
                  : 'Browse and respond to available RFQs'
                }
              </p>
            </div>
          </div>
          
          {userRole === 'client' && (
            <Button onClick={() => navigate("/rfqs/create")}>
              <Plus className="mr-2 h-4 w-4" />
              Create RFQ
            </Button>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search RFQs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="awarded">Awarded</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* RFQ Grid */}
        {filteredRFQs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-muted-foreground mb-4">
                {searchTerm || selectedStatus !== "all" ? "No RFQs match your filters" : 
                 userRole === 'client' ? "No RFQs found" : "No available RFQs to bid on"}
              </div>
              {userRole === 'client' && (
                <Button onClick={() => navigate("/rfqs/create")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First RFQ
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRFQs.map((rfq) => (
              <Card key={rfq.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2 line-clamp-2">{rfq.title}</CardTitle>
                      <Badge variant={getStatusColor(rfq.status)} className="mb-2">
                        {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {rfq.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3">
                    {rfq.due_date && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="mr-2 h-4 w-4" />
                        Due: {format(new Date(rfq.due_date), "MMM dd, yyyy")}
                      </div>
                    )}
                    
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="mr-2 h-4 w-4" />
                      {rfq.participants?.length || 0} participants
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground">
                      <DollarSign className="mr-2 h-4 w-4" />
                      {rfq.quotes?.length || 0} quotes received
                    </div>
                    
                    <div className="pt-2 space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => navigate(`/rfqs/${rfq.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                      {userRole === 'vendor' && rfq.status === 'open' && (
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => navigate(`/rfqs/${rfq.id}/quote`)}
                        >
                          Submit Quote
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RFQs;