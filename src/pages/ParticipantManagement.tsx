import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, Users, Mail, Trash2 } from "lucide-react";

interface RFQ {
  id: string;
  title: string;
  status: string;
  created_by: string;
}

interface Participant {
  id: string;
  vendor_id: string;
  status: 'invited' | 'accepted' | 'declined' | 'submitted';
  invited_at: string;
  profiles?: {
    full_name: string;
    company_name: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  company_name: string;
}

const ParticipantManagement = () => {
  const { rfqId } = useParams();
  const navigate = useNavigate();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (rfqId) {
      loadRfqAndParticipants();
      loadAvailableVendors();
    }
  }, [rfqId]);

  const loadRfqAndParticipants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Load RFQ details
      const { data: rfqData, error: rfqError } = await supabase
        .from("rfqs")
        .select("*")
        .eq("id", rfqId)
        .eq("created_by", user.id)
        .single();

      if (rfqError) throw rfqError;
      setRfq(rfqData);

      // Load participants
      const { data: participantsData, error: participantsError } = await supabase
        .from("rfq_participants")
        .select("*")
        .eq("rfq_id", rfqId);

      if (participantsError) throw participantsError;
      
      // Load profile data for each participant
      const participantsWithProfiles = await Promise.all(
        (participantsData || []).map(async (participant) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, company_name")
            .eq("id", participant.vendor_id)
            .single();
          
          return {
            ...participant,
            profiles: profileData
          };
        })
      );

      setParticipants(participantsWithProfiles);

    } catch (error) {
      console.error("Error loading RFQ and participants:", error);
      toast({
        title: "Error",
        description: "Failed to load RFQ details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableVendors = async () => {
    try {
      // Load vendor user roles first
      const { data: vendorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vendor");

      if (rolesError) throw rolesError;

      // Load profiles for all vendors
      const vendorIds = vendorRoles?.map(role => role.user_id) || [];
      
      if (vendorIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, company_name")
          .in("id", vendorIds);

        if (profilesError) throw profilesError;
        setVendors(profilesData || []);
      }
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  const inviteVendor = async (vendorId: string) => {
    try {
      const { error } = await supabase
        .from("rfq_participants")
        .insert([{
          rfq_id: rfqId,
          vendor_id: vendorId,
          status: 'invited'
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vendor invited successfully.",
      });

      setInviteDialogOpen(false);
      loadRfqAndParticipants();
    } catch (error) {
      console.error("Error inviting vendor:", error);
      toast({
        title: "Error",
        description: "Failed to invite vendor. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from("rfq_participants")
        .delete()
        .eq("id", participantId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Participant removed successfully.",
      });

      loadRfqAndParticipants();
    } catch (error) {
      console.error("Error removing participant:", error);
      toast({
        title: "Error",
        description: "Failed to remove participant. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'invited': return 'secondary';
      case 'accepted': return 'default';
      case 'declined': return 'destructive';
      case 'submitted': return 'outline';
      default: return 'secondary';
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    const isNotParticipant = !participants.some(p => p.vendor_id === vendor.id);
    const matchesSearch = vendor.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return isNotParticipant && matchesSearch;
  });

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
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">RFQ not found or access denied</p>
            <Button onClick={() => navigate("/rfqs")} className="mt-4">
              Back to RFQs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate(`/rfqs/${rfqId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to RFQ
            </Button>
            <div>
              <h1 className="text-xl font-bold">Manage Participants</h1>
              <p className="text-sm text-muted-foreground">Invite and manage vendors for this RFQ</p>
            </div>
          </div>
          
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite Vendor</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <Input
                  placeholder="Search vendors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {filteredVendors.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {searchTerm ? "No vendors match your search" : "No available vendors to invite"}
                    </p>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <div key={vendor.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{vendor.full_name}</p>
                          {vendor.company_name && (
                            <p className="text-sm text-muted-foreground">{vendor.company_name}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => inviteVendor(vendor.id)}
                        >
                          Invite
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* RFQ Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              {rfq.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant={rfq.status === 'open' ? 'default' : 'secondary'}>
                {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Participants List */}
        <Card>
          <CardHeader>
            <CardTitle>Current Participants</CardTitle>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No participants invited yet</p>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Your First Vendor
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">
                          {participant.profiles?.full_name || "Unknown Vendor"}
                        </p>
                        {participant.profiles?.company_name && (
                          <p className="text-sm text-muted-foreground">
                            {participant.profiles.company_name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Invited: {new Date(participant.invited_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusColor(participant.status)}>
                        {participant.status.charAt(0).toUpperCase() + participant.status.slice(1)}
                      </Badge>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParticipant(participant.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantManagement;