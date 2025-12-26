import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Clock,
  AlertTriangle,
  ArrowDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getCurrentUser } from "aws-amplify/auth";

function safeArray(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.Items)) return resp.Items;
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.data?.Items)) return resp.data.Items;
  return [];
}

function nowMs() {
  return Date.now();
}

function normalizeDeviceId(request) {
  return (
    request?.deviceId ||
    request?.device_id ||
    request?.id ||
    request?.endpointArn ||
    request?.endpoint_arn ||
    null
  );
}

function formatDetectedDate(v) {
  try {
    const d = v ? new Date(v) : new Date();
    return format(d, "MMM d, yyyy h:mm a");
  } catch {
    return "";
  }
}

// Map backend status to UI label/badge color
function statusBadge(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING" || s === "STARTING") return { text: "Pending Approval", cls: "bg-amber-100 text-amber-800 border-amber-200" };
  if (s === "REQUESTED") return { text: "Recovery Requested", cls: "bg-blue-100 text-blue-800 border-blue-200" };
  if (s === "SENT") return { text: "Command Sent", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" };
  if (s === "IN_PROGRESS") return { text: "Recovering…", cls: "bg-purple-100 text-purple-800 border-purple-200" };
  if (s === "DONE" || s === "COMPLETED") return { text: "Recovered", cls: "bg-green-100 text-green-800 border-green-200" };
  if (s === "FAILED") return { text: "Failed", cls: "bg-red-100 text-red-800 border-red-200" };
  return { text: status || "Unknown", cls: "bg-slate-100 text-slate-700 border-slate-200" };
}

export default function ReverseSyncPage() {
  const [reverseSyncRequests, setReverseSyncRequests] = useState([]);
  const [availableData, setAvailableData] = useState({ messages: 0, contacts: 0, photos: 0 });

  const [selectedOptions, setSelectedOptions] = useState({
    include_messages: false,
    include_contacts: false,
    include_photos: false,
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keep "in-progress recoveries" visible even if pending list changes
  // activeRecoveries[deviceId] = { status, error, updatedAt, progress }
  const [activeRecoveries, setActiveRecoveries] = useState({});

  // Global error banner
  const [errorMsg, setErrorMsg] = useState("");

  const pollingRef = useRef({}); // deviceId -> intervalId

  const totalSelectedItems =
    (selectedOptions.include_messages ? availableData.messages : 0) +
    (selectedOptions.include_contacts ? availableData.contacts : 0) +
    (selectedOptions.include_photos ? availableData.photos : 0);

  const getSyncDescription = () => {
    const selected = Object.entries(selectedOptions)
      .filter(([, value]) => value)
      .map(([key]) => key.replace("include_", ""));
    if (selected.length === 0) return "No data selected";
    if (selected.length === 3) return "All data (messages, contacts, photos)";
    return selected.join(", ");
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const current = await getCurrentUser();
      const phoneFromAttributes = current?.attributes?.phone_number;
      const phoneFromLoginId = current?.signInDetails?.loginId;

      setCurrentUser({ phone_number: phoneFromAttributes || phoneFromLoginId || "" });

      const [dataCounts, pendingDevices] = await Promise.all([
        api.get("/data-counts"),
        api.get("/fmp/pending-devices"),
      ]);

      setAvailableData({
        messages: dataCounts?.messages?.items || dataCounts?.data?.messages?.items || 0,
        contacts: dataCounts?.contacts?.items || dataCounts?.data?.contacts?.items || 0,
        photos: dataCounts?.photos?.items || dataCounts?.data?.photos?.items || 0,
      });

      const pendingArr = safeArray(pendingDevices)
        .map((d) => ({
          ...d,
          deviceId: normalizeDeviceId(d),
        }))
        .filter((d) => !!d.deviceId);

      setReverseSyncRequests(pendingArr);
    } catch (e) {
      console.error("Failed to load device recovery data:", e);
      setAvailableData({ messages: 0, contacts: 0, photos: 0 });
      setReverseSyncRequests([]);
      setErrorMsg("Failed to load recovery data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    return () => {
      // cleanup polling
      Object.values(pollingRef.current || {}).forEach((id) => clearInterval(id));
      pollingRef.current = {};
    };
  }, []);

  const handleOptionChange = (option, value) => {
    setSelectedOptions((prev) => ({ ...prev, [option]: value }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(selectedOptions).every((v) => v);
    const newValue = !allSelected;
    setSelectedOptions({
      include_messages: newValue,
      include_contacts: newValue,
      include_photos: newValue,
    });
  };

  const startPollingStatus = (deviceId) => {
    if (!deviceId) return;
    if (pollingRef.current[deviceId]) return; // already polling

    const tick = async () => {
      try {
        const resp = await api.get(
          `/fmp/recovery-status?deviceId=${encodeURIComponent(deviceId)}`
        );

        const data = resp?.data || resp;
        const status = data?.status || data?.recoveryStatus || "UNKNOWN";

        setActiveRecoveries((prev) => {
          const existing = prev[deviceId] || {};
          // Simple heuristic progress by status
          const upper = String(status).toUpperCase();
          const progress =
            upper === "REQUESTED" ? 25 :
            upper === "SENT" ? 50 :
            upper === "IN_PROGRESS" ? Math.max(existing.progress || 60, 60) :
            upper === "DONE" || upper === "COMPLETED" ? 100 :
            upper === "FAILED" ? existing.progress || 100 :
            existing.progress || 10;

          return {
            ...prev,
            [deviceId]: {
              ...existing,
              status,
              progress,
              updatedAt: nowMs(),
              error: upper === "FAILED" ? (data?.error || data?.recoveryError || existing.error || "") : existing.error,
            },
          };
        });

        // Stop polling on terminal states
        const terminal = ["DONE", "COMPLETED", "FAILED"];
        if (terminal.includes(String(status).toUpperCase())) {
          clearInterval(pollingRef.current[deviceId]);
          delete pollingRef.current[deviceId];
        }
      } catch (e) {
        // Don’t nuke UI on CORS/404 — just show a soft error and keep polling a bit
        console.warn("[recovery-status] poll failed:", e);
      }
    };

    tick();
    pollingRef.current[deviceId] = setInterval(tick, 3000);
  };

  const handleStartRecovery = async (deviceId) => {
    setErrorMsg("");

    if (!deviceId) {
      setErrorMsg("Missing deviceId.");
      return;
    }

    if (totalSelectedItems === 0) {
      setErrorMsg("Select at least one data type to recover.");
      return;
    }

    // optimistic local state — keep device visible
    setActiveRecoveries((prev) => ({
      ...prev,
      [deviceId]: {
        status: "REQUESTED",
        progress: 15,
        updatedAt: nowMs(),
        error: "",
      },
    }));

    try {
      await api.post("/fmp/request-recovery", {
        deviceId,
        include_messages: selectedOptions.include_messages,
        include_contacts: selectedOptions.include_contacts,
        include_photos: selectedOptions.include_photos,
      });

      // After success, mark as SENT immediately (Lambda should also write status)
      setActiveRecoveries((prev) => ({
        ...prev,
        [deviceId]: {
          ...(prev[deviceId] || {}),
          status: "SENT",
          progress: Math.max(prev[deviceId]?.progress || 30, 50),
          updatedAt: nowMs(),
          error: "",
        },
      }));

      // Start polling status endpoint
      startPollingStatus(deviceId);

      // Refresh pending list, but DO NOT remove activeRecovery card
      loadData();
    } catch (e) {
      console.error("Failed to start recovery:", e);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to start recovery.";

      setActiveRecoveries((prev) => ({
        ...prev,
        [deviceId]: {
          ...(prev[deviceId] || {}),
          status: "FAILED",
          progress: 100,
          updatedAt: nowMs(),
          error: msg,
        },
      }));

      setErrorMsg(String(msg));
    }
  };

  // Merge pending requests + activeRecoveries into one list to render
  const mergedDevices = useMemo(() => {
    const map = new Map();

    // Pending list
    for (const r of reverseSyncRequests || []) {
      const id = normalizeDeviceId(r);
      if (!id) continue;
      map.set(id, {
        ...r,
        deviceId: id,
        source: "pending",
      });
    }

    // Active recoveries (ensure visible even if no longer pending)
    for (const [deviceId, st] of Object.entries(activeRecoveries || {})) {
      if (!deviceId) continue;
      const existing = map.get(deviceId) || {};
      map.set(deviceId, {
        ...existing,
        deviceId,
        source: existing.source || "active",
        recoveryUi: st,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      const ta = new Date(a.updatedAt || a.recoveryUi?.updatedAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.recoveryUi?.updatedAt || 0).getTime();
      return tb - ta;
    });
  }, [reverseSyncRequests, activeRecoveries]);

  const StatCard = ({ icon, label, count, colorClass, isLoading: loading }) => (
    <div className={`flex items-center gap-4 p-4 rounded-lg ${colorClass}`}>
      {icon}
      <div>
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        ) : (
          <p className="font-semibold text-slate-900 text-2xl">
            {Number(count || 0).toLocaleString()}
          </p>
        )}
        <p className="text-sm text-slate-600">{label}</p>
      </div>
    </div>
  );

  const renderDeviceCard = (request) => {
    const deviceId = request.deviceId;
    const ui = request.recoveryUi || {};
    const status = ui.status || request.status || "PENDING";
    const badge = statusBadge(status);
    const progress = typeof ui.progress === "number" ? ui.progress : 0;
    const isWorking = ["REQUESTED", "SENT", "IN_PROGRESS"].includes(String(status).toUpperCase());
    const isTerminal = ["DONE", "COMPLETED", "FAILED"].includes(String(status).toUpperCase());

    return (
      <motion.div
        key={deviceId}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <Card className={`bg-white/90 backdrop-blur-sm border-2 shadow-lg mb-6 ${
          String(status).toUpperCase() === "FAILED" ? "border-red-200" : "border-amber-200"
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                New Device Detected
              </CardTitle>
              <Badge className={badge.cls}>
                <Clock className="w-3 h-3 mr-1" />
                {badge.text}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <Smartphone className="w-10 h-10 text-slate-600" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {request.platform || "android"} • {String(deviceId)}
                </p>
                <p className="text-sm text-slate-500">
                  Detected: {formatDetectedDate(request.updatedAt || request.createdAt || request.detectedAt)}
                </p>
                {request.status ? (
                  <p className="text-xs text-slate-500 mt-1">Status: {request.status}</p>
                ) : null}
              </div>
            </div>

            {/* Options only when not already terminal */}
            {!isWorking && !isTerminal ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-900">Select Data to Recover</h3>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {Object.values(selectedOptions).every((v) => v) ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Messages</p>
                        <p className="text-sm text-slate-500">
                          {availableData.messages.toLocaleString()} messages
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={selectedOptions.include_messages}
                      onCheckedChange={(value) =>
                        handleOptionChange("include_messages", value)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">Contacts</p>
                        <p className="text-sm text-slate-500">
                          {availableData.contacts.toLocaleString()} contacts
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={selectedOptions.include_contacts}
                      onCheckedChange={(value) =>
                        handleOptionChange("include_contacts", value)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Photos</p>
                        <p className="text-sm text-slate-500">
                          {availableData.photos.toLocaleString()} photos
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={selectedOptions.include_photos}
                      onCheckedChange={(value) =>
                        handleOptionChange("include_photos", value)
                      }
                    />
                  </div>
                </div>

                {totalSelectedItems > 0 && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDown className="w-4 h-4 text-blue-600" />
                      <p className="font-medium text-blue-900">Recovery Summary</p>
                    </div>
                    <p className="text-sm text-blue-700">
                      Ready to recover {totalSelectedItems.toLocaleString()} items:{" "}
                      {getSyncDescription()}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => handleStartRecovery(deviceId)}
                    disabled={totalSelectedItems === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Recover ({totalSelectedItems.toLocaleString()} items)
                  </Button>
                </div>
              </div>
            ) : (
              // Working / terminal status UI
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">
                    {String(status).toUpperCase() === "FAILED"
                      ? "Recovery failed"
                      : String(status).toUpperCase() === "DONE" || String(status).toUpperCase() === "COMPLETED"
                      ? "Recovery complete"
                      : "Recovering…"}
                  </p>
                  <p className="text-sm text-slate-600">{Math.round(progress)}%</p>
                </div>

                <Progress value={progress} className="h-2" />

                {ui.error ? (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                    {ui.error}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    We’ll keep checking status automatically.
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      // manually restart polling
                      startPollingStatus(deviceId);
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Status
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Device Recovery</h1>
          <p className="text-slate-600 mt-1">Restore your data to a new device</p>
          {currentUser && (
            <p className="text-sm text-slate-500 mt-1">
              Account: {currentUser.phone_number}
            </p>
          )}
        </div>

        {errorMsg ? (
          <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700">
            {errorMsg}
          </div>
        ) : null}

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              Available Data for Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <StatCard
                icon={<MessageSquare className="w-8 h-8 text-blue-600" />}
                label="Messages"
                count={availableData.messages}
                colorClass="bg-blue-50"
                isLoading={isLoading}
              />
              <StatCard
                icon={<Users className="w-8 h-8 text-green-600" />}
                label="Contacts"
                count={availableData.contacts}
                colorClass="bg-green-50"
                isLoading={isLoading}
              />
              <StatCard
                icon={<Camera className="w-8 h-8 text-purple-600" />}
                label="Photos"
                count={availableData.photos}
                colorClass="bg-purple-50"
                isLoading={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            <AnimatePresence>
              {mergedDevices.map((req) => renderDeviceCard(req))}
            </AnimatePresence>

            {mergedDevices.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="text-center py-12">
                  <Smartphone className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">
                    No New Devices
                  </h3>
                  <p className="text-slate-500 max-w-md mx-auto">
                    When you connect a new device, you'll see it here and can
                    recover your messages, contacts, and photos back to that
                    device.
                  </p>

                  <div className="mt-6">
                    <Button variant="outline" onClick={loadData}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={loadData}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
