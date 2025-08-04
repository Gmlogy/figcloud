import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { 
  Smartphone, 
  Download, 
  MessageSquare, 
  Users, 
  Camera, 
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowDown
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function ReverseSyncPage() {
  const [reverseSyncRequests, setReverseSyncRequests] = useState([]);
  const [availableData, setAvailableData] = useState({
    messages: 0,
    contacts: 0,
    photos: 0
  });
  const [selectedOptions, setSelectedOptions] = useState({
    include_messages: false,
    include_contacts: false,
    include_photos: false
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
   // loadData();
  }, []);

 

  const handleOptionChange = (option, value) => {
    setSelectedOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(selectedOptions).every(v => v);
    const newValue = !allSelected;
    setSelectedOptions({
      include_messages: newValue,
      include_contacts: newValue,
      include_photos: newValue
    });
  };


  const handleCancelSync = async (requestId) => {
    await ReverseSync.update(requestId, { status: 'cancelled' });
    await loadData();
  };

  const getSyncDescription = () => {
    const selected = Object.entries(selectedOptions)
      .filter(([key, value]) => value)
      .map(([key]) => key.replace('include_', ''));
    
    if (selected.length === 0) return "No data selected";
    if (selected.length === 3) return "All data (messages, contacts, photos)";
    return selected.join(", ");
  };

  const totalSelectedItems = 
    (selectedOptions.include_messages ? availableData.messages : 0) +
    (selectedOptions.include_contacts ? availableData.contacts : 0) +
    (selectedOptions.include_photos ? availableData.photos : 0);

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Device Recovery</h1>
          <p className="text-slate-600 mt-1">Restore your data to a new device</p>
          {currentUser && (
            <p className="text-sm text-slate-500 mt-1">Account: {currentUser.phone_number}</p>
          )}
        </div>

        {/* Available Data Overview */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Available Data for Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <MessageSquare className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="font-semibold text-slate-900">{availableData.messages.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Messages</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                <Users className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-semibold text-slate-900">{availableData.contacts.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Contacts</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
                <Camera className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="font-semibold text-slate-900">{availableData.photos.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Photos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Sync Requests */}
        <AnimatePresence>
          {reverseSyncRequests.map((request) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-white/90 backdrop-blur-sm border-2 border-amber-200 shadow-lg mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      New Device Detected
                    </CardTitle>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                      <Clock className="w-3 h-3 mr-1" />
                      Pending Approval
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <Smartphone className="w-10 h-10 text-slate-600" />
                    <div>
                      <p className="font-semibold text-slate-900">{request.device_name}</p>
                      <p className="text-sm text-slate-500">
                        Requested: {format(new Date(request.requested_date), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-slate-900">Select Data to Sync</h3>
                      <Button variant="outline" size="sm" onClick={handleSelectAll}>
                        {Object.values(selectedOptions).every(v => v) ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium">Messages</p>
                            <p className="text-sm text-slate-500">{availableData.messages.toLocaleString()} messages</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedOptions.include_messages}
                          onCheckedChange={(value) => handleOptionChange('include_messages', value)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium">Contacts</p>
                            <p className="text-sm text-slate-500">{availableData.contacts.toLocaleString()} contacts</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedOptions.include_contacts}
                          onCheckedChange={(value) => handleOptionChange('include_contacts', value)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Camera className="w-5 h-5 text-purple-600" />
                          <div>
                            <p className="font-medium">Photos</p>
                            <p className="text-sm text-slate-500">{availableData.photos.toLocaleString()} photos</p>
                          </div>
                        </div>
                        <Switch
                          checked={selectedOptions.include_photos}
                          onCheckedChange={(value) => handleOptionChange('include_photos', value)}
                        />
                      </div>
                    </div>

                    {totalSelectedItems > 0 && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowDown className="w-4 h-4 text-blue-600" />
                          <p className="font-medium text-blue-900">Sync Summary</p>
                        </div>
                        <p className="text-sm text-blue-700">
                          Ready to sync {totalSelectedItems.toLocaleString()} items: {getSyncDescription()}
                        </p>
                      </div>
                    )}

                    {isProcessing && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-900">Syncing to device...</p>
                          <p className="text-sm text-slate-600">{Math.round(syncProgress)}%</p>
                        </div>
                        <Progress value={syncProgress} className="h-2" />
                        <p className="text-xs text-slate-500">This may take a few minutes depending on the amount of data.</p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={() => handleStartSync(request.id)}
                        disabled={totalSelectedItems === 0 || isProcessing}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {isProcessing ? 'Syncing...' : `Start Sync (${totalSelectedItems.toLocaleString()} items)`}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleCancelSync(request.id)}
                        disabled={isProcessing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {reverseSyncRequests.length === 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="text-center py-12">
              <Smartphone className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No New Devices</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                When you connect a new device, you'll see options here to restore your messages, contacts, and photos.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}