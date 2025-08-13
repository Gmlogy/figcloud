import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Smartphone, 
  Wifi, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Activity,
  MessageSquare,
  PowerOff,
  BadgeCheck,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { api } from '@/lib/api'; // Import your API helper

export default function SyncStatusPage() {
  const [syncSessions, setSyncSessions] = useState([]);
  const [allowedBuildPrefixes, setAllowedBuildPrefixes] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!isRefreshing) setIsLoading(true);
    try {
      const response = await api.get('/sync-status');
      setSyncSessions(response.syncSessions || []);
      setAllowedBuildPrefixes(new Set(response.allowedBuildPrefixes || []));
      setMessages(response.messages || []);
    } catch (error) {
      console.error("Failed to load sync status:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const isDeviceAllowed = (buildNumber) => {
    if (!buildNumber) return false;
    for (const prefix of allowedBuildPrefixes) {
      if (buildNumber.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  const activeSession = syncSessions.find(s => s.sync_status === 'active' && isDeviceAllowed(s.build_number));
  const unsupportedSessions = syncSessions.filter(s => !isDeviceAllowed(s.build_number));
  const inactiveSessions = syncSessions.filter(s => s.sync_status !== 'active' && isDeviceAllowed(s.build_number));

  const getStatusColor = (status, isAllowed) => {
    if (!isAllowed) return 'bg-red-100 text-red-800 border-red-200';
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status, isAllowed) => {
    if (!isAllowed) return <XCircle className="w-4 h-4" />;
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'paused': return <PowerOff className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };
  
  const totalMessages = messages.length;
  const todayMessages = messages.filter(m => 
    new Date(m.timestamp).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sync Status</h1>
            <p className="text-slate-600 mt-1">Monitor your Fig Phone synchronization</p>
          </div>
          <Button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Active Fig Phone</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{activeSession ? 1 : 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Messages</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{totalMessages.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Today's Messages</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{todayMessages}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Security</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">Hardware Verified</p>
                  </div>
                   <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <BadgeCheck className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                    <Wifi className="w-5 h-5" />
                    Currently Active Fig Phone
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? <p>Loading...</p> : activeSession ? (
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-4">
                            <Smartphone className="w-10 h-10 text-blue-600" />
                            <div>
                                <p className="font-bold text-lg text-slate-900">{activeSession.device_name}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-slate-500">
                                      Last synced: {activeSession.last_sync ? format(new Date(activeSession.last_sync), 'MMM d, h:mm a') : 'Never'}
                                  </p>
                                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <BadgeCheck className="w-3 h-3 mr-1"/>
                                    Verified Fig Phone
                                  </Badge>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mt-4 md:mt-0">
                           <div className="text-right">
                             <p className="text-sm font-semibold text-slate-700">{activeSession.messages_synced?.toLocaleString() || 0}</p>
                             <p className="text-xs text-slate-500">messages synced</p>
                           </div>
                           <Badge className={getStatusColor(activeSession.sync_status, true)}>
                            {getStatusIcon(activeSession.sync_status, true)}
                            <span className="ml-1 capitalize">{activeSession.sync_status}</span>
                           </Badge>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No active Fig Phone connected</p>
                        <p className="text-sm text-slate-400 mt-1">Open the mobile app on your Fig Phone to start syncing.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}