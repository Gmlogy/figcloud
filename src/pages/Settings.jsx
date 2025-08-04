
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Smartphone, 
  Bell, 
  Download, 
  Trash2, 
  LogOut,
  Settings as SettingsIcon,
  Lock,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState({
    autoSync: true, // Ensuring this defaults to true
    notifications: true,
    encryption: true
  });

  useEffect(() => {
   // loadUserAndDevice();
  }, []);

  
  
 

  const handlePreferenceChange = async (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    if (currentUser) {
      await User.updateMyUserData({
        preferences: {
          auto_sync: newPreferences.autoSync,
          notifications: newPreferences.notifications,
          encryption: newPreferences.encryption
        }
      });
    }
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-1">Manage your SMS sync preferences and security</p>
          {currentUser && (
            <p className="text-sm text-slate-500 mt-1">Phone: {currentUser.phone_number}</p>
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
                    <SettingsIcon className="w-5 h-5" />
                    Account & Device
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {activeSession ? (
                    <>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={currentUser?.phone_number || ''}
                            disabled
                            className="bg-slate-100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="device">Active Device</Label>
                          <Input
                            id="device"
                            value={activeSession.device_name}
                            disabled
                            className="bg-slate-100"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-semibold text-slate-900">OTP Verification</p>
                            <p className="text-sm text-slate-500">Phone number verified</p>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          Verified
                        </Badge>
                      </div>

                      <Button variant="outline" onClick={handleDisconnect} className="w-full">
                        <LogOut className="w-4 h-4 mr-2" /> 
                        Disconnect {activeSession.device_name}
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">No active device connected</p>
                      <p className="text-sm text-slate-400 mt-1">Please connect a device to manage settings.</p>
                      {currentUser && (
                        <p className="text-xs text-slate-400 mt-2">Account: {currentUser.phone_number}</p>
                      )}
                    </div>
                  )}
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
                    Sync Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">Auto Sync</p>
                      <p className="text-sm text-slate-500">Automatically sync new messages in real-time</p>
                    </div>
                    <Switch
                      checked={preferences.autoSync}
                      onCheckedChange={(value) => handlePreferenceChange('autoSync', value)}
                      disabled={!activeSession}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">Push Notifications</p>
                      <p className="text-sm text-slate-500">Get notified of new messages</p>
                    </div>
                    <Switch
                      checked={preferences.notifications}
                      onCheckedChange={(value) => handlePreferenceChange('notifications', value)}
                      disabled={!activeSession}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">End-to-End Encryption</p>
                      <p className="text-sm text-slate-500">Encrypt all message data</p>
                    </div>
                    <Switch
                      checked={preferences.encryption}
                      onCheckedChange={(value) => handlePreferenceChange('encryption', value)}
                      disabled
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Data Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Button variant="outline" className="justify-start gap-2">
                      <Download className="w-4 h-4" />
                      Export All Data
                    </Button>
                    <Button variant="outline" className="justify-start gap-2">
                      <Lock className="w-4 h-4" />
                      Backup Data
                    </Button>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3 mb-3">
                      <Trash2 className="w-5 h-5 text-red-600" />
                      <p className="font-semibold text-red-900">Danger Zone</p>
                    </div>
                    <p className="text-sm text-red-700 mb-4">
                      These actions cannot be undone. Please be careful.
                    </p>
                      <Button variant="destructive" size="sm" className="w-full md:w-auto">
                        Delete All Synced Data
                      </Button>
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
