import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  User,
  Smartphone, 
  Trash2, 
  LogOut,
  Settings as SettingsIcon,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { api } from '@/lib/api';
import { format } from "date-fns";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get('/settings');
      setSettings(data);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load your settings.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handlePreferenceChange = async (key, value) => {
    if (!settings) return;

    const newPreferences = { ...settings.preferences, [key]: value };
    const optimisticSettings = { ...settings, preferences: newPreferences };
    setSettings(optimisticSettings);
    setIsSaving(true);

    try {
      await api.put('/settings', { preferences: newPreferences });
      toast({
        title: "Success",
        description: "Your preferences have been saved.",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save your preferences. Please try again.",
      });
      fetchSettings(); // Revert to server state on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = () => {
    // Placeholder for disconnect logic
    toast({ title: "Info", description: "Disconnect functionality is not yet implemented." });
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-1">Manage your SMS sync preferences and security</p>
          {settings && (
            <p className="text-sm text-slate-500 mt-1">Phone: {settings.phoneNumber}</p>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
             <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="grid gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Account Information
                  </CardTitle>
                  <CardDescription>This is your account information based on your login.</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                    <div><Label>Phone Number</Label><p className="font-mono">{settings?.phoneNumber}</p></div>
                    <div><Label>User ID</Label><p className="font-mono text-xs break-all">{settings?.userId}</p></div>
                    <div><Label>Member Since</Label><p>{settings?.createdAt ? format(new Date(settings.createdAt), 'PPP') : 'N/A'}</p></div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    Connected Device
                  </CardTitle>
                   <CardDescription>This is the currently active device for sending and receiving sync commands.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                        <div>
                            <p className="font-semibold text-slate-900">{settings?.displayName || 'Fig Phone Device'}</p>
                            <p className="text-xs text-slate-500">Last updated: {settings?.lastUpdated ? format(new Date(settings.lastUpdated), 'Pp') : 'N/A'}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleDisconnect}>
                            <LogOut className="w-4 h-4 mr-2" /> 
                            Disconnect
                        </Button>
                    </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> Sync Preferences</CardTitle>
                        <CardDescription>Choose which data types to sync automatically from your device.</CardDescription>
                    </div>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sync-messages">Sync Messages</Label>
                    <Switch id="sync-messages" checked={settings?.preferences.syncMessages} onCheckedChange={(val) => handlePreferenceChange('syncMessages', val)} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="sync-contacts">Sync Contacts</Label>
                    <Switch id="sync-contacts" checked={settings?.preferences.syncContacts} onCheckedChange={(val) => handlePreferenceChange('syncContacts', val)} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="sync-photos">Sync Photos</Label>
                    <Switch id="sync-photos" checked={settings?.preferences.syncPhotos} onCheckedChange={(val) => handlePreferenceChange('syncPhotos', val)} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg border-red-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <Trash2 className="w-5 h-5" />
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold">Delete All Synced Data</p>
                            <p className="text-sm text-muted-foreground">Permanently remove all your data from FigCloud. This cannot be undone.</p>
                        </div>
                        <Button variant="destructive">Delete Data</Button>
                    </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}