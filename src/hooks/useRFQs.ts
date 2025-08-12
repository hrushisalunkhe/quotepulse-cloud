import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface RFQ {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled';
  due_date: string | null;
  created_at: string;
  created_by: string;
  quotes?: Array<{
    id: string;
    amount: number;
    status: string;
    vendor_id: string;
  }>;
  rfq_participants?: Array<{
    id: string;
    vendor_id: string;
    status: string;
  }>;
}

export const useRFQs = () => {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRFQs = async (userId?: string) => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Load RFQs where user is either creator or participant
      const { data, error } = await supabase
        .from("rfqs")
        .select(`
          *,
          quotes(id, amount, status, vendor_id),
          rfq_participants(id, vendor_id, status)
        `)
        .or(`created_by.eq.${userId},rfq_participants.vendor_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRfqs(data || []);
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

  const createRFQ = async (rfqData: {
    title: string;
    description?: string;
    due_date?: string;
    status: 'draft' | 'open';
  }, userId: string) => {
    try {
      const { data, error } = await supabase
        .from("rfqs")
        .insert({
          ...rfqData,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      setRfqs(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error("Error creating RFQ:", error);
      throw error;
    }
  };

  const updateRFQ = async (id: string, updates: Partial<RFQ>) => {
    try {
      const { data, error } = await supabase
        .from("rfqs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      setRfqs(prev => prev.map(rfq => rfq.id === id ? { ...rfq, ...data } : rfq));
      return data;
    } catch (error) {
      console.error("Error updating RFQ:", error);
      throw error;
    }
  };

  const deleteRFQ = async (id: string) => {
    try {
      const { error } = await supabase
        .from("rfqs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRfqs(prev => prev.filter(rfq => rfq.id !== id));
    } catch (error) {
      console.error("Error deleting RFQ:", error);
      throw error;
    }
  };

  return {
    rfqs,
    loading,
    loadRFQs,
    createRFQ,
    updateRFQ,
    deleteRFQ,
  };
};

export const useRFQ = (id: string) => {
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRFQ();
  }, [id]);

  return {
    rfq,
    loading,
    refetch: loadRFQ,
  };
};