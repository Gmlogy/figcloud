import React, { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { ringDevice, stopRingDevice, locateStart, locatePoll } from "../../api/findMyPhone";
import { useAuth } from "../../hooks/useAuth"; // Import the hook we created

// A simple map component using an iframe
const LocationMap = ({ latitude, longitude }) => {
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01},${latitude - 0.01},${longitude + 0.01},${latitude + 0.01}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <div className="mt-4 rounded-lg overflow-hidden border aspect-video">
      <iframe
        width="100%"
        height="100%"
        frameBorder="0"
        src={mapUrl}
        title="Device Location"
      ></iframe>
    </div>
  );
};

export default function FindMyPhonePanel() {
  // Get the user object dynamically from the context
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");
  const [duration, setDuration] = useState(120);
  const [sound, setSound] = useState("default");
  const [requestId, setRequestId] = useState("");
  const [coords, setCoords] = useState(null);
  const pollTimer = useRef(null);

  useEffect(() => () => pollTimer.current && clearInterval(pollTimer.current), []);

  const doRing = async () => {
    if (!user || !user.sub) {
        setErr("User ID not found. Please log in again.");
        return;
    }
    setBusy(true); setErr(""); setInfo("");
    try {
      await ringDevice({ userId: user.sub, durationSec: Number(duration), sound });
      setInfo("Ring command sent.");
      setIsRinging(true);
    } catch (e) {
      setErr(e?.message || "Failed to send ring command.");
    } finally {
      setBusy(false);
    }
  };
  
  const doStopRing = async () => {
    if (!user || !user.sub) {
        setErr("User ID not found. Please log in again.");
        return;
    }
    setBusy(true); setErr(""); setInfo("");
    try {
      await stopRingDevice({ userId: user.sub });
      setInfo("Stop ring command sent.");
      setIsRinging(false);
    } catch (e) {
      setErr(e?.message || "Failed to send stop command.");
    } finally {
      setBusy(false);
    }
  };

  const doLocate = async () => {
    if (!user || !user.sub) {
        setErr("User ID not found. Please log in again.");
        return;
    }
    setBusy(true); setErr(""); setInfo(""); setCoords(null);
    try {
      const { requestId } = await locateStart(user.sub);
      setRequestId(requestId);
      setInfo("Locate request sent. Waiting for device…");

      let tries = 0;
      pollTimer.current = setInterval(async () => {
        tries++;
        try {
          const pollResponse = await locatePoll(requestId);
          if (pollResponse?.status === "FOUND") {
            setCoords({
              lat: pollResponse.latitude,
              lon: pollResponse.longitude,
              time: new Date(pollResponse.timestamp).toLocaleString()
            });
            setInfo("Location received.");
            clearInterval(pollTimer.current);
            setBusy(false);
          } else if (pollResponse?.status === "ERROR" || tries > 20) {
            setErr("Locate request expired or timed out.");
            clearInterval(pollTimer.current);
            setBusy(false);
          }
        } catch (e) {
          setErr("Error polling for location.");
          clearInterval(pollTimer.current);
          setBusy(false);
        }
      }, 3000);
    } catch (e) {
      setErr(e?.message || "Failed to start locate.");
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Find My Phone</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="number" min={10} max={600} value={duration} onChange={e => setDuration(e.target.value)} className="w-28" disabled={isRinging} />
          <span className="text-sm text-slate-600">seconds</span>
          <Input placeholder="sound id (optional)" value={sound} onChange={e => setSound(e.target.value)} className="w-48" disabled={isRinging} />
          {!isRinging ? (
            <Button onClick={doRing} disabled={busy}>Ring Device</Button>
          ) : (
            <Button onClick={doStopRing} disabled={busy} variant="destructive">Stop Ringing</Button>
          )}
          <Button variant="secondary" onClick={doLocate} disabled={busy || isRinging}>Locate Device</Button>
        </div>
        {info && <p className="text-green-700 text-sm">{info}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
        {coords && (
          <div>
            <div className="text-sm mb-2"><b>Last known location:</b> {coords.time}</div>
            <LocationMap latitude={coords.lat} longitude={coords.lon} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
