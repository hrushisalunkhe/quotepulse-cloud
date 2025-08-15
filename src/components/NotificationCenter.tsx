import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Bell, DollarSign, Users, FileText, CheckCircle, AlertCircle, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Notification {
  id: string;
  type: 'quote_received' | 'rfq_awarded' | 'participant_joined' | 'rfq_closed';
  title: string;
  message: string;
  rfq_id?: string;
  rfq_title?: string;
  read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter = ({ isOpen, onClose }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // For now, create mock notifications based on user's RFQs and quotes
      const { data: rfqsData } = await supabase
        .from("rfqs")
        .select("id, title, status, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: quotesData } = await supabase
        .from("quotes")
        .select(`
          id, 
          created_at, 
          status,
          rfqs!inner(id, title, created_by)
        `)
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Create mock notifications
      const mockNotifications: Notification[] = [];

      // Add notifications for received quotes on user's RFQs
      rfqsData?.forEach((rfq, index) => {
        if (index < 3) { // Limit mock notifications
          mockNotifications.push({
            id: `quote-${rfq.id}`,
            type: 'quote_received',
            title: 'New Quote Received',
            message: `You received a new quote for "${rfq.title}"`,
            rfq_id: rfq.id,
            rfq_title: rfq.title,
            read: Math.random() > 0.5,
            created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
          });
        }
      });

      // Add notifications for quote status changes
      quotesData?.forEach((quote, index) => {
        if (index < 2) {
          mockNotifications.push({
            id: `status-${quote.id}`,
            type: quote.status === 'accepted' ? 'rfq_awarded' : 'rfq_closed',
            title: quote.status === 'accepted' ? 'Quote Accepted!' : 'RFQ Status Update',
            message: quote.status === 'accepted' 
              ? `Your quote for "${quote.rfqs.title}" was accepted!`
              : `RFQ "${quote.rfqs.title}" status changed to ${quote.status}`,
            rfq_id: quote.rfqs.id,
            rfq_title: quote.rfqs.title,
            read: Math.random() > 0.7,
            created_at: quote.created_at
          });
        }
      });

      // Sort by date
      mockNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(mockNotifications);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quote_received':
        return <DollarSign className="h-4 w-4 text-primary" />;
      case 'rfq_awarded':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'participant_joined':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'rfq_closed':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-background w-full max-w-md h-full overflow-hidden shadow-lg">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Notifications</h2>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex space-x-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  Mark all read
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                ×
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className={`text-sm font-medium ${
                            !notification.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(notification.created_at), "MMM dd, HH:mm")}
                            </span>
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;