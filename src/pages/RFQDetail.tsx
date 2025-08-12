import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, DollarSign, Users, Edit, Trash2, Send, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface RFQ {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled';
  due_date: string | null;
  created_at: string;
  created_by: string;
  quotes: Array<{
    id: string;
    amount: number;
    status: string;
    vendor_id: string;
    message: string | null;
    submitted_at: string | null;
  }>;
  rfq_participants: Array<{
    id: string;
    vendor_id: string;
    status: string;
    invited_at: string;
  }>;
}

const RFQDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadRFQ();
    }
  }, [id]);

  const loadRFQ = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rfqs")
        .select(`
          *,
          quotes(id, amount, status, vendor_id, message, submitted_at),
          rfq_participants(id, vendor_id, status, invited_at)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      setRfq(data);
    } catch (error) {
      console.error("Error loading RFQ:", error);
      toast({
        title: "Error",
        description: "Failed to load RFQ details.",
        variant: "destructive",
      });
      navigate("/rfqs");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled') => {
    if (!rfq || !user) return;

    try {
      const { error } = await supabase
        .from("rfqs")
        .update({ status: newStatus })
        .eq("id", rfq.id);

      if (error) throw error;

      setRfq(prev => prev ? { ...prev, status: newStatus } : null);
      toast({
        title: "Success",
        description: `RFQ status updated to ${newStatus}.`,
      });
    } catch (error) {
      console.error("Error updating RFQ status:", error);
      toast({
        title: "Error",
        description: "Failed to update RFQ status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRFQ = async () => {
    if (!rfq || !user || !confirm("Are you sure you want to delete this RFQ?")) return;

    try {
      const { error } = await supabase
        .from("rfqs")
        .delete()
        .eq("id", rfq.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "RFQ deleted successfully.",
      });
      navigate("/rfqs");
    } catch (error) {
      console.error("Error deleting RFQ:", error);
      toast({
        title: "Error",
        description: "Failed to delete RFQ.",
        variant: "destructive",
      });
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

  const isOwner = user && rfq && rfq.created_by === user.id;
  const canEdit = isOwner && rfq?.status === 'draft';
  const canPublish = isOwner && rfq?.status === 'draft';
  const canClose = isOwner && rfq?.status === 'open';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">RFQ Not Found</h2>
          <p className="text-muted-foreground mb-4">The RFQ you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/rfqs")}>Back to RFQs</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate("/rfqs")}>
              ← Back to RFQs
            </Button>
            <div>
              <h1 className="text-xl font-bold">RFQ Details</h1>
              <p className="text-sm text-muted-foreground">View and manage RFQ</p>
            </div>
          </div>
          
          {isOwner && (
            <div className="flex items-center space-x-2">
              {canEdit && (
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              {canPublish && (
                <Button size="sm" onClick={() => handleStatusUpdate('open')}>
                  <Send className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              )}
              {canClose && (
                <Button variant="outline" size="sm" onClick={() => handleStatusUpdate('closed')}>
                  <Clock className="mr-2 h-4 w-4" />
                  Close RFQ
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={handleDeleteRFQ}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">{rfq.title}</CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <Badge variant={getStatusColor(rfq.status)}>
                        {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
                      </Badge>
                      <span>Created {format(new Date(rfq.created_at), "MMM dd, yyyy")}</span>
                      {rfq.due_date && (
                        <span>Due {format(new Date(rfq.due_date), "MMM dd, yyyy")}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              {rfq.description && (
                <CardContent>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{rfq.description}</p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Quotes Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Quotes ({rfq.quotes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rfq.quotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No quotes received yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rfq.quotes.map((quote) => (
                      <div key={quote.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{quote.status}</Badge>
                            <span className="text-sm text-muted-foreground">
                              Vendor ID: {quote.vendor_id.slice(0, 8)}...
                            </span>
                          </div>
                          <div className="text-lg font-semibold">
                            ${quote.amount.toLocaleString()}
                          </div>
                        </div>
                        {quote.message && (
                          <p className="text-sm text-muted-foreground">{quote.message}</p>
                        )}
                        {quote.submitted_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Submitted {format(new Date(quote.submitted_at), "MMM dd, yyyy")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Participants
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rfq.rfq_participants.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No participants invited yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rfq.rfq_participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">
                            Vendor {participant.vendor_id.slice(0, 8)}...
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Invited {format(new Date(participant.invited_at), "MMM dd")}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {participant.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {isOwner && rfq.status === 'open' && (
                  <div className="mt-4">
                    <Button variant="outline" size="sm" className="w-full">
                      Invite Vendors
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Quotes</span>
                  <span className="font-medium">{rfq.quotes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Participants</span>
                  <span className="font-medium">{rfq.rfq_participants.length}</span>
                </div>
                {rfq.quotes.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Lowest Quote</span>
                      <span className="font-medium">
                        ${Math.min(...rfq.quotes.map(q => q.amount)).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Highest Quote</span>
                      <span className="font-medium">
                        ${Math.max(...rfq.quotes.map(q => q.amount)).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RFQDetail;