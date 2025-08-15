import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  FileText, 
  DollarSign, 
  Users,
  ArrowLeft,
  Calendar,
  Filter
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ReportData {
  totalRfqs: number;
  totalQuotes: number;
  averageQuoteValue: number;
  completionRate: number;
  rfqsByStatus: Record<string, number>;
  quotesOverTime: Array<{ date: string; count: number }>;
  topVendors: Array<{ name: string; quoteCount: number; avgAmount: number }>;
}

const Reports = () => {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Calculate date range
      const endDate = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case 'week':
          startDate = subDays(endDate, 7);
          break;
        case 'quarter':
          startDate = subDays(endDate, 90);
          break;
        default:
          startDate = startOfMonth(endDate);
      }

      // Load RFQ data
      const { data: rfqData, error: rfqError } = await supabase
        .from("rfqs")
        .select("*")
        .eq("created_by", user.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (rfqError) throw rfqError;

      // Load quote data with RFQ info - use simplified query
      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (quoteError) throw quoteError;

      // Filter quotes to only show those for user's RFQs
      const userRfqIds = rfqData?.map(rfq => rfq.id) || [];
      const filteredQuotes = quoteData?.filter(quote => userRfqIds.includes(quote.rfq_id)) || [];
      // Process data
      const totalRfqs = rfqData?.length || 0;
      const totalQuotes = filteredQuotes.length;
      const averageQuoteValue = filteredQuotes.length ? 
        filteredQuotes.reduce((sum, quote) => sum + quote.amount, 0) / filteredQuotes.length : 0;

      const completedRfqs = rfqData?.filter(rfq => 
        ['closed', 'awarded'].includes(rfq.status)
      ).length || 0;
      const completionRate = totalRfqs > 0 ? (completedRfqs / totalRfqs) * 100 : 0;

      // RFQs by status
      const rfqsByStatus = rfqData?.reduce((acc, rfq) => {
        acc[rfq.status] = (acc[rfq.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Quotes over time (last 7 days)
      const quotesOverTime = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(endDate, 6 - i);
        const count = filteredQuotes.filter(quote => 
          format(new Date(quote.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        ).length;
        return {
          date: format(date, 'MMM dd'),
          count
        };
      });

      // Simplified vendor stats using vendor_id
      const vendorStats = filteredQuotes.reduce((acc, quote) => {
        const vendorId = quote.vendor_id;
        if (!acc[vendorId]) {
          acc[vendorId] = { count: 0, totalAmount: 0 };
        }
        acc[vendorId].count++;
        acc[vendorId].totalAmount += quote.amount;
        return acc;
      }, {} as Record<string, { count: number; totalAmount: number }>);

      const topVendors = Object.entries(vendorStats)
        .map(([vendorId, stats]) => ({
          name: `Vendor ${vendorId.slice(0, 8)}`, // Use shortened vendor ID as name
          quoteCount: stats.count,
          avgAmount: stats.totalAmount / stats.count
        }))
        .sort((a, b) => b.quoteCount - a.quoteCount)
        .slice(0, 5);

      setReportData({
        totalRfqs,
        totalQuotes,
        averageQuoteValue,
        completionRate,
        rfqsByStatus,
        quotesOverTime,
        topVendors
      });

    } catch (error) {
      console.error("Error loading report data:", error);
      toast({
        title: "Error",
        description: "Failed to load report data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !reportData) return;

      // Create CSV content
      const csvContent = [
        ['Metric', 'Value'],
        ['Total RFQs', reportData.totalRfqs],
        ['Total Quotes', reportData.totalQuotes],
        ['Average Quote Value', `$${reportData.averageQuoteValue.toFixed(2)}`],
        ['Completion Rate', `${reportData.completionRate.toFixed(1)}%`],
        [''],
        ['RFQ Status Breakdown'],
        ...Object.entries(reportData.rfqsByStatus).map(([status, count]) => [status, count]),
        [''],
        ['Top Vendors'],
        ...reportData.topVendors.map(vendor => [
          vendor.name,
          `${vendor.quoteCount} quotes, $${vendor.avgAmount.toFixed(2)} avg`
        ])
      ].map(row => row.join(',')).join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rfq-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Report exported successfully.",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Error",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Chart data
  const barChartData = {
    labels: reportData?.quotesOverTime.map(item => item.date) || [],
    datasets: [
      {
        label: 'Quotes Received',
        data: reportData?.quotesOverTime.map(item => item.count) || [],
        backgroundColor: 'hsl(var(--primary))',
        borderColor: 'hsl(var(--primary))',
        borderWidth: 1,
      },
    ],
  };

  const doughnutData = {
    labels: Object.keys(reportData?.rfqsByStatus || {}),
    datasets: [
      {
        data: Object.values(reportData?.rfqsByStatus || {}),
        backgroundColor: [
          'hsl(var(--primary))',
          'hsl(var(--secondary))',
          'hsl(var(--accent))',
          'hsl(var(--muted))',
          'hsl(var(--destructive))',
        ],
        borderWidth: 2,
        borderColor: 'hsl(var(--background))',
      },
    ],
  };

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
              <h1 className="text-xl font-bold">Reports & Analytics</h1>
              <p className="text-sm text-muted-foreground">Track your RFQ performance</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 border rounded-md p-1">
              {(['week', 'month', 'quarter'] as const).map((period) => (
                <Button
                  key={period}
                  variant={dateRange === period ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDateRange(period)}
                  className="capitalize"
                >
                  {period}
                </Button>
              ))}
            </div>
            <Button onClick={exportData}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total RFQs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData?.totalRfqs || 0}</div>
              <p className="text-xs text-muted-foreground">
                This {dateRange}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quotes Received</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData?.totalQuotes || 0}</div>
              <p className="text-xs text-muted-foreground">
                Across all RFQs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Quote Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${reportData?.averageQuoteValue.toFixed(0) || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per quote received
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reportData?.completionRate.toFixed(1) || '0'}%
              </div>
              <p className="text-xs text-muted-foreground">
                RFQs closed/awarded
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Quote Activity (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <Bar 
                  data={barChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>RFQ Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {Object.keys(reportData?.rfqsByStatus || {}).length > 0 ? (
                  <Doughnut 
                    data={doughnutData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Vendors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Top Performing Vendors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportData?.topVendors.length ? (
              <div className="space-y-4">
                {reportData.topVendors.map((vendor, index) => (
                  <div key={vendor.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="min-w-[24px] h-6 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{vendor.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {vendor.quoteCount} quote{vendor.quoteCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${vendor.avgAmount.toFixed(0)}</p>
                      <p className="text-sm text-muted-foreground">avg. value</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No vendor data available for this period</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;