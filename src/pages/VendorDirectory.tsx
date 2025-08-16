import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Search, 
  Building2, 
  Mail, 
  Star,
  Users,
  TrendingUp
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Vendor {
  id: string;
  full_name: string;
  company_name: string;
  created_at: string;
}

const VendorDirectory = () => {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const { data: vendorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vendor");

      if (rolesError) throw rolesError;

      if (vendorRoles?.length) {
        const vendorIds = vendorRoles.map(role => role.user_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", vendorIds);

        if (profilesError) throw profilesError;

        setVendors(profiles || []);
      }
    } catch (error) {
      console.error("Error loading vendors:", error);
      toast({
        title: "Error",
        description: "Failed to load vendor directory. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-bold">Vendor Directory</h1>
              <p className="text-sm text-muted-foreground">Discover and connect with vendors</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Stats */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors by name or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}</span>
            </Badge>
          </div>
        </div>

        {/* Vendor Grid */}
        {filteredVendors.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No vendors found</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm ? "Try adjusting your search terms." : "No vendors have registered yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.map((vendor) => (
              <Card key={vendor.id} className="hover:shadow-elegant transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{vendor.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {vendor.company_name}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      Vendor
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4 mr-2" />
                      <span>Member since {new Date(vendor.created_at).getFullYear()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4">
                      <div className="flex items-center space-x-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">New Vendor</span>
                      </div>
                      
                      {userRole === 'client' && (
                        <Button size="sm" variant="outline">
                          <Mail className="h-4 w-4 mr-2" />
                          Contact
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

export default VendorDirectory;