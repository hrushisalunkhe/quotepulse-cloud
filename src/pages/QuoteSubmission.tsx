import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface RFQ {
  id: string;
  title: string;
  description: string;
  status: string;
  due_date: string;
  created_at: string;
}

interface Quote {
  id: string;
  amount: number;
  currency: string;
  message: string;
  status: string;
  submitted_at: string;
}

const QuoteSubmission = () => {
  const { rfqId } = useParams();
  const navigate = useNavigate();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [existingQuote, setExistingQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (rfqId) {
      loadRfqAndQuote();
    }
  }, [rfqId]);

  const loadRfqAndQuote = async () => {
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
        .single();

      if (rfqError) throw rfqError;
      setRfq(rfqData);

      // Check if user already has a quote for this RFQ
      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .eq("rfq_id", rfqId)
        .eq("vendor_id", user.id)
        .maybeSingle();

      if (quoteError && quoteError.code !== 'PGRST116') throw quoteError;
      
      if (quoteData) {
        setExistingQuote(quoteData);
        setAmount(quoteData.amount.toString());
        setCurrency(quoteData.currency);
        setMessage(quoteData.message || "");
      }

    } catch (error) {
      console.error("Error loading RFQ:", error);
      toast({
        title: "Error",
        description: "Failed to load RFQ details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfq || !amount) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const quoteData = {
        rfq_id: rfq.id,
        vendor_id: user.id,
        amount: parseFloat(amount),
        currency,
        message,
        status: 'submitted' as const,
        submitted_at: new Date().toISOString(),
      };

      if (existingQuote) {
        // Update existing quote
        const { error } = await supabase
          .from("quotes")
          .update(quoteData)
          .eq("id", existingQuote.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Your quote has been updated successfully.",
        });
      } else {
        // Create new quote
        const { error } = await supabase
          .from("quotes")
          .insert(quoteData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Your quote has been submitted successfully.",
        });
      }

      navigate(`/rfqs/${rfqId}`);
    } catch (error) {
      console.error("Error submitting quote:", error);
      toast({
        title: "Error",
        description: "Failed to submit quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

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
            <p className="text-muted-foreground">RFQ not found</p>
            <Button onClick={() => navigate("/rfqs")} className="mt-4">
              Back to RFQs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRfqClosed = rfq.status === 'closed' || rfq.status === 'awarded' || rfq.status === 'cancelled';

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
              <h1 className="text-xl font-bold">
                {existingQuote ? "Update Quote" : "Submit Quote"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {existingQuote ? "Modify your existing quote" : "Submit your quotation for this RFQ"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* RFQ Details */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{rfq.title}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={rfq.status === 'open' ? 'default' : 'secondary'}>
                    {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
                  </Badge>
                  {rfq.due_date && (
                    <span className="text-sm text-muted-foreground">
                      Due: {format(new Date(rfq.due_date), "MMM dd, yyyy")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{rfq.description}</p>
          </CardContent>
        </Card>

        {/* Quote Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="mr-2 h-5 w-5" />
              {existingQuote ? "Update Your Quote" : "Submit Your Quote"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isRfqClosed ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  This RFQ is no longer accepting quotes.
                </p>
                <Button variant="outline" onClick={() => navigate(`/rfqs/${rfqId}`)}>
                  View RFQ Details
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Amount and Currency */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="amount">Quote Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="Enter your quote amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <Label htmlFor="message">Additional Message (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Add any additional information about your quote..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="mt-1"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-between pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(`/rfqs/${rfqId}`)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={submitting || !amount}
                    className="min-w-[120px]"
                  >
                    {submitting ? "Submitting..." : existingQuote ? "Update Quote" : "Submit Quote"}
                  </Button>
                </div>
              </form>
            )}

            {/* Existing Quote Info */}
            {existingQuote && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Current Quote Status</h4>
                <div className="text-sm text-muted-foreground">
                  <p>Status: <Badge variant="outline">{existingQuote.status}</Badge></p>
                  {existingQuote.submitted_at && (
                    <p>Submitted: {format(new Date(existingQuote.submitted_at), "MMM dd, yyyy 'at' HH:mm")}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuoteSubmission;
