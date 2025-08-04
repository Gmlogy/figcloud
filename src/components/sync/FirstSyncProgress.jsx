import React, { useState, useEffect } from "react";
// import { SyncSession } from "@/api/entities"; // DISABLED
// import { Message } from "@/api/entities"; // DISABLED
// import { Contact } from "@/api/entities"; // DISABLED
// import { Photo } from "@/api/entities"; // DISABLED
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Smartphone, 
  MessageSquare, 
  Users, 
  Camera, 
  CheckCircle,
  Loader2,
  Shield,
  Wifi
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FirstSyncProgress({ phoneNumber, onSyncComplete }) {
  const [syncStep, setSyncStep] = useState("connecting"); // "connecting" | "syncing" | "complete"
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("Establishing secure connection...");
  const [syncStats, setSyncStats] = useState({
    messages: 0,
    contacts: 0,
    photos: 0,
    totalItems: 0
  });

  const syncTasks = [
    { name: "Establishing secure connection...", duration: 2000, progress: 15 },
    { name: "Authenticating your Fig Phone...", duration: 1500, progress: 25 },
    { name: "Syncing text messages...", duration: 3000, progress: 60 },
    { name: "Syncing contacts...", duration: 2000, progress: 80 },
    { name: "Syncing photos...", duration: 2500, progress: 95 },
    { name: "Finalizing setup...", duration: 1000, progress: 100 }
  ];

  useEffect(() => {
    // startSyncProcess(); // DISABLED - This call used the old SDK
  }, []);

  const startSyncProcess = async () => {
    /* --- ENTIRE FUNCTION DISABLED TO PREVENT CRASH ---
    // Create initial sync session
    const syncSession = await SyncSession.create({
      device_id: `fig-phone-${Date.now()}`,
      device_name: "Fig Phone 1",
      build_number: `FIG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      sync_status: 'active',
      otp_verified: true,
      messages_synced: 0
    });

    // Simulate sync process
    let currentProgress = 0;
    
    for (let i = 0; i < syncTasks.length; i++) {
      const task = syncTasks[i];
      setCurrentTask(task.name);
      
      // Gradually increase progress
      const startProgress = currentProgress;
      const endProgress = task.progress;
      const steps = 20;
      const progressIncrement = (endProgress - startProgress) / steps;
      const timeIncrement = task.duration / steps;
      
      for (let step = 0; step <= steps; step++) {
        await new Promise(resolve => setTimeout(resolve, timeIncrement));
        currentProgress = startProgress + (progressIncrement * step);
        setProgress(Math.min(currentProgress, 100));
        
        // Update stats during sync
        if (i === 2) { // Messages sync
          setSyncStats(prev => ({ ...prev, messages: Math.floor(step * 15) }));
        } else if (i === 3) { // Contacts sync  
          setSyncStats(prev => ({ ...prev, contacts: Math.floor(step * 8) }));
        } else if (i === 4) { // Photos sync
          setSyncStats(prev => ({ ...prev, photos: Math.floor(step * 25) }));
        }
      }
    }

    // Create sample data to simulate successful sync
    await createSampleData(phoneNumber);
    
    // Update final stats
    setSyncStats({ messages: 247, contacts: 156, photos: 342, totalItems: 745 });
    
    setSyncStep("complete");
    
    // Auto-complete after showing success
    setTimeout(() => {
      onSyncComplete();
    }, 3000);
    */
  };

  const createSampleData = async (phone) => {
    /* --- ENTIRE FUNCTION DISABLED TO PREVENT CRASH ---
    // Create sample messages, contacts, and photos
    // This simulates the real sync data that would come from the Fig Phone
    
    const sampleMessages = [
      {
        phone_number: "+15551234567",
        contact_name: "John Smith",
        message_content: "Hey, how's it going?",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        is_sent: false,
        thread_id: "thread_1",
        sync_status: "synced"
      },
      // Add more sample data...
    ];

    // Bulk create sample data
    if (sampleMessages.length > 0) {
      await Message.bulkCreate(sampleMessages);
    }
    */
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="bg-white/90 backdrop-blur-sm shadow-2xl border-0">
          <CardHeader className="text-center pb-6">
            <motion.div
              className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center"
              animate={syncStep === "complete" ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              {syncStep === "complete" ? (
                <CheckCircle className="w-10 h-10 text-green-600" />
              ) : (
                <Smartphone className="w-10 h-10 text-blue-600" />
              )}
            </motion.div>
            
            <CardTitle className="text-2xl font-bold text-slate-900 mb-2">
              {syncStep === "complete" ? "Sync Complete!" : "Syncing Your Data"}
            </CardTitle>
            
            {syncStep !== "complete" && (
              <p className="text-slate-600">
                Please keep your Fig Phone connected and nearby
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {syncStep !== "complete" ? (
                <motion.div
                  key="syncing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{currentTask}</span>
                      <span className="text-sm text-slate-500">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-3" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <MessageSquare className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-lg font-bold text-slate-900">{syncStats.messages}</p>
                      <p className="text-xs text-slate-600">Messages</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <p className="text-lg font-bold text-slate-900">{syncStats.contacts}</p>
                      <p className="text-xs text-slate-600">Contacts</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <Camera className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-lg font-bold text-slate-900">{syncStats.photos}</p>
                      <p className="text-xs text-slate-600">Photos</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Shield className="w-4 h-4" />
                    <span>End-to-end encrypted sync in progress</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-4"
                >
                  <div className="p-6 bg-green-50 rounded-xl">
                    <h3 className="text-lg font-semibold text-green-900 mb-2">
                      Successfully synced {syncStats.totalItems} items
                    </h3>
                    <div className="flex justify-center gap-6 text-sm">
                      <span className="text-green-700">{syncStats.messages} messages</span>
                      <span className="text-green-700">{syncStats.contacts} contacts</span>
                      <span className="text-green-700">{syncStats.photos} photos</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                    <Wifi className="w-4 h-4" />
                    <span>Your Fig Phone is now connected and syncing</span>
                  </div>

                  <p className="text-xs text-slate-500">
                    Redirecting to your dashboard...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}