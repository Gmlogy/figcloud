// src/components/PhoneVerificationModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeCanvas as QRCode } from "qrcode.react";
import { Label } from "@/components/ui/label";
import BrandLogo from "@/assets/FIGlogoai.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield,
  Smartphone,
  Lock,
  ArrowRight,
  MessageSquareText,
  CheckCircle,
  QrCode,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// IMPORTANT: configure Amplify ONCE (e.g., in main.jsx). Do NOT import another config here.
import {
  signIn,
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
  signUp,
} from "aws-amplify/auth";

// --- API for QR flow ---
const API_BASE_URL = "https://jt1d4gvhah.execute-api.us-east-1.amazonaws.com";
const API_KEY = import.meta.env.VITE_QR_API_KEY; // optional if you later protect routes with an API key

async function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  try {
    const sess = await fetchAuthSession();
    const id = sess?.tokens?.idToken?.toString();
    if (id) headers["Authorization"] = id;
  } catch {}
  return headers;
}

const api = {
  startQrSignIn: async () => {
    const res = await fetch(`${API_BASE_URL}/qr-signin/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}", // keep it a POST
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Failed to start QR sign-in (${res.status}). ${body || ""}`.trim()
      );
    }
    return res.json(); // { requestId, ttl }
  },

  pollQrStatus: async (requestId) => {
    const res = await fetch(
      `${API_BASE_URL}/qr-signin/poll?requestId=${encodeURIComponent(requestId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Failed to poll for QR status (${res.status}). ${body || ""}`.trim()
      );
    }
    return res.json(); // expected: { status, phoneNumber? | username? }
  },
};

// ===== Helpers (silent sign-up like Android) =====
function strongRandomPassword() {
  // 24+ chars, mixed classes to satisfy typical pool policies
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const nums = "0123456789";
  const spec = "!@#$%^&*()-_=+[]{}";
  const all = upper + lower + nums + spec;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let out = pick(upper) + pick(lower) + pick(nums) + pick(spec);
  for (let i = 0; i < 24; i++) out += pick(all);
  return out;
}

async function silentSignupIfNeeded(usernameOrPhoneE164) {
  try {
    // Use phone as username & attribute. Your PreSignUp trigger auto-confirms.
    await signUp({
      username: usernameOrPhoneE164,
      password: strongRandomPassword(),
      options: { userAttributes: { phone_number: usernameOrPhoneE164 } },
    });
    // If created, great; if it already exists, the catch below will ignore.
  } catch (e) {
    const msg = (e?.name || e?.message || "").toString();
    if (!/usernameexists/i.test(msg)) throw e; // rethrow unexpected errors
  }
}

// Dev helper to simulate “phone scanned & approved”
const MobileScannerSimulator = ({ requestId }) => {
  const [scanned, setScanned] = useState(false);
  useEffect(() => {
    setScanned(false);
    sessionStorage.removeItem("qr_scanned");
  }, [requestId]);
  if (!requestId) return null;

  return (
    <div hidden className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-xl text-sm w-64 z-50">
      <h4 className="font-bold mb-2">Android App Simulator</h4>
      {scanned ? (
        <div className="text-green-400 font-semibold text-center py-2 flex items-center justify-center flex-col">
          <CheckCircle className="w-8 h-8 mb-2" />
          <p>Scan Confirmed!</p>
          <p className="text-xs text-gray-300 mt-1">
            Web page will now sign in.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs mb-3">
            Simulates the app calling your <code>/confirm</code> Lambda.
          </p>
          <Button
            size="sm"
            className="w-full bg-green-500 hover:bg-green-600"
            onClick={() => {
              sessionStorage.setItem("qr_scanned", requestId);
              setScanned(true);
            }}
          >
            Simulate Scan & Approve
          </Button>
        </>
      )}
    </div>
  );
};

export default function PhoneVerificationModal({ onVerificationComplete }) {
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [signInMethod, setSignInMethod] = useState("sms"); // 'sms' | 'qr'
  const [qrData, setQrData] = useState(null);
  const [qrStatusMessage, setQrStatusMessage] = useState(
    "Generating secure QR code..."
  );
  const pollRef = useRef(null);

  // If already signed, close immediately
  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        onVerificationComplete("");
      } catch {}
    })();
  }, [onVerificationComplete]);

  // ---------- Helpers ----------
  const formatPhoneInput = (value) => {
    if (!value) return "";
    const v = value.replace(/[^\d+]/g, "");
    return v[0] === "+"
      ? "+" + v.slice(1).replace(/\+/g, "")
      : v.replace(/\+/g, "");
  };
  const toE164 = (input) => {
    const v = (input || "").trim();
    if (v.startsWith("+")) return v.replace(/\s+/g, "");
    const digits = v.replace(/\D/g, "");
    return digits.length >= 6 ? `+1${digits}` : v; // adjust default for your audience
  };

  const startSigninThenSelectSms = async (e164) => {
    // Your existing SMS path
    const out = await signIn({
      username: e164,
      options: { authFlowType: "USER_AUTH" },
    });
    const sess = await fetchAuthSession();
    if (sess?.tokens) return { done: true };

    const stepName = out?.nextStep?.signInStep || "";
    const challenge = out?.nextStep?.challengeName || "";

    if (stepName === "CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION") {
      await confirmSignIn({ challengeResponse: "SMS_OTP" });
      return { done: false, selectedSms: true };
    }
    if (challenge === "SMS_OTP" || String(stepName).includes("SMS")) {
      return { done: false, selectedSms: true };
    }
    throw new Error(`Unsupported next step: ${stepName || challenge}`);
  };

  // ---------- SMS handlers ----------
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInfo("");
    const e164 = toE164(phoneNumber);

    try {
      if (!e164.startsWith("+"))
        throw new Error("Please enter a valid E.164 phone (e.g., +2126...)");
      const res = await startSigninThenSelectSms(e164);
      if (res.done) {
        onVerificationComplete(e164);
        return;
      }
      setStep("otp");
      setInfo("We sent you a sign-in code by SMS.");
    } catch (err) {
      const name = err?.name || err?.__type || "";
      if (name.includes("UserNotFound"))
        setError(
          "No account found for this phone number. Please create your account from the mobile app first."
        );
      else if (name.includes("UserNotConfirmed"))
        setError(
          "This account isn’t confirmed. Please complete setup from the mobile app."
        );
      else if (name.includes("NotAuthorized"))
        setError(
          "Sign-in failed. Make sure this phone number matches an existing account."
        );
      else setError(err?.message || "Failed to start sign-in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInfo("");
    try {
      await confirmSignIn({ challengeResponse: otpCode });
      const sess = await fetchAuthSession();
      if (sess?.tokens) onVerificationComplete(toE164(phoneNumber));
      else setError("Could not complete sign-in. Resend and try again.");
    } catch (e4) {
      setError(e4?.message || "Invalid/expired code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    setError("");
    setInfo("");
    try {
      const e164 = toE164(phoneNumber);
      const res = await startSigninThenSelectSms(e164);
      if (res.done) {
        onVerificationComplete(e164);
        return;
      }
      setInfo("Code re-sent.");
    } catch (e) {
      setError(e?.message || "Unable to resend code.");
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- QR flow ----------
  useEffect(() => {
  let stop = () => {};
  const begin = async () => {
    setIsLoading(true);
    setError("");
    setInfo("");
    setQrData(null);
    setQrStatusMessage("Generating secure QR code...");

    try {
      const data = await api.startQrSignIn();
      setQrData(data);
      setQrStatusMessage("Scan this code with your logged-in mobile app.");
      const expiry = Date.now() + (data.ttl || 120) * 1000;

      const timer = setInterval(async () => {
        try {
          if (Date.now() > expiry) {
            clearInterval(timer);
            setQrData(null);
            setQrStatusMessage("QR code expired. Please generate a new one.");
            setError("QR expired.");
            return;
          }

          const res = await api.pollQrStatus(data.requestId);
          console.debug("[QR] poll:", res);

          if (res?.status === "CONFIRMED") {
            const userForSignin = res.phoneNumber || res.username;
            if (!userForSignin) {
              clearInterval(timer);
              setError("Poll returned CONFIRMED but missing username/phone.");
              return;
            }
            console.debug("[QR] proceeding with username:", userForSignin);
            clearInterval(timer);
            await completeQrSignIn(userForSignin, data.requestId);
          }
        } catch (e) {
          clearInterval(timer);
          setError(e?.message || "Polling error.");
        }
      }, 2500);

      stop = () => clearInterval(timer);
    } catch (err) {
      setError(err?.message || "Could not start QR sign-in.");
      setQrStatusMessage("Error generating QR code. Refresh or try SMS.");
    } finally {
      setIsLoading(false);
    }
  };

  if (signInMethod === "qr") begin();
  else stop();
  return stop;
}, [signInMethod]);


  // After phone approves, finish on web with CUSTOM_AUTH (passwordless) + silent sign-up fallback
  const normalizeUsername = (u) => {
  if (!u) return u;
  const s = String(u).trim();
  return /^\+?\d+$/.test(s) ? (s.startsWith("+") ? s : `+${s}`) : s;
};

const completeQrSignIn = async (rawUsername, requestId) => {
  // normalize: if it's digits, ensure leading +
  const normalize = (u) => {
    if (!u) return u;
    const s = String(u).trim();
    return /^\+?\d+$/.test(s) ? (s.startsWith("+") ? s : `+${s}`) : s;
  };

  const username = normalize(rawUsername);

  try {
    console.log("[QR] Initiate CUSTOM_AUTH for", username);

    // IMPORTANT: v6 uses CUSTOM_WITHOUT_SRP for passwordless custom auth
    const out = await signIn({
      username,
      options: {
        authFlowType: "CUSTOM_WITHOUT_SRP",
        clientMetadata: { mode: "qr" },
      },
    });

    // Expect the custom challenge; answer with the requestId you stored
    if (out?.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE") {
      await confirmSignIn({ challengeResponse: requestId });
    }

    const sess = await fetchAuthSession();
    if (sess?.tokens) {
      setInfo("Signed in successfully.");
      setError("");
      onVerificationComplete(username);
    } else {
      setError("Could not complete QR sign-in after approval.");
    }
  } catch (err) {
    console.error("[QR] InitiateAuth/Confirm failed", err);
    setError(err?.message || "Failed to complete QR sign-in.");
  }
};



  // ---------- UI ----------
  const renderSmsFlow = () => (
    <>
      {step === "phone" ? (
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
              Phone Number
            </Label>
            <div className="relative mt-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Smartphone className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="(e.g. +1415...)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneInput(e.target.value))}
                className="pl-12 h-12 text-lg"
                maxLength={18}
                required
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
              {info}
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-12"
            style={{ backgroundColor: "#20194B" }}
            disabled={isLoading}
          >
            {isLoading ? (
              "Sending Code..."
            ) : (
              <>
                Send Verification Code <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
          <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
            <Lock className="w-4 h-4" />
            <span>Your phone number is encrypted and never shared</span>
          </div>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div>
            <Label htmlFor="otp" className="text-sm font-medium text-slate-700">
              Verification Code
            </Label>
            <Input
              id="otp"
              type="text"
              placeholder="123456 or 12345678"
              value={otpCode}
              onChange={(e) =>
                setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              className="text-center text-2xl font-mono tracking-widest h-12"
              maxLength={8}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
              {info}
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-12"
            style={{ backgroundColor: "#20194B" }}
            disabled={isLoading || otpCode.length < 4}
          >
            {isLoading ? "Verifying..." : "Verify & Sign in"}
          </Button>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              className="mt-2"
              onClick={() => {
                setStep("phone");
                setOtpCode("");
                setInfo("");
                setError("");
              }}
              disabled={isLoading}
            >
              ← Change Phone
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-2"
              onClick={handleResend}
              disabled={isLoading}
            >
              Resend code
            </Button>
          </div>
        </form>
      )}
    </>
  );

  const renderQrFlow = () => (
    <div className="flex flex-col items-center justify-center space-y-4 min-h-[260px]">
      {qrData?.requestId ? (
        <div className="p-4 bg-white rounded-lg border">
          {/* Encode only requestId; Android maps it to the user and confirms in DynamoDB */}
          <QRCode value={qrData.requestId} size={200} level="H" includeMargin />
        </div>
      ) : (
        <div className="w-[220px] h-[220px] flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
        </div>
      )}
      <p className="text-slate-600 text-center text-sm px-4 h-10">
        {qrStatusMessage}
      </p>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="bg-white/100 backdrop-blur-sm shadow-2xl border-0">
            <CardHeader className="text-center pb-4">
              <div
  style={{ width: 98, height: 98 }}
  className="mx-auto mb-4 rounded-full overflow-hidden ring-1 ring-black/5 bg-white"
>
  <img src={BrandLogo} alt="App logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
</div>
              <CardTitle className="text-2xl font-bold text-slate-800">
                Fig Cloud Secure Sign-in
              </CardTitle>
              <p className="text-slate-600 mt-2 text-sm">
                {signInMethod === "sms" && step === "otp"
                  ? `We sent a code to ${phoneNumber}`
                  : "Sign in securely using your mobile device."}
              </p>
            </CardHeader>
            <CardContent>
              <>
                <div className="grid grid-cols-2 gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                  <Button
                    variant={signInMethod === "sms" ? "default" : "ghost"}
                    onClick={() => setSignInMethod("sms")}
                    className={`h-10 transition-all ${
                      signInMethod === "sms"
                        ? "bg-white text-gray-900 shadow"
                        : "text-gray-600"
                    }`}
                  >
                    <MessageSquareText className="w-4 h-4 mr-2" /> Use SMS
                  </Button>
                  <Button
                    variant={signInMethod === "qr" ? "default" : "ghost"}
                    onClick={() => setSignInMethod("qr")}
                    className={`h-10 transition-all ${
                      signInMethod === "qr"
                        ? "bg-white text-gray-900 shadow"
                        : "text-gray-600"
                    }`}
                  >
                    <QrCode className="w-4 h-4 mr-2" /> Use QR Code
                  </Button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={signInMethod}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {error && (
                      <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">
                        {error}
                      </p>
                    )}
                    {info && (
                      <p className="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                        {info}
                      </p>
                    )}
                    {signInMethod === "sms" ? renderSmsFlow() : renderQrFlow()}
                  </motion.div>
                </AnimatePresence>
              </>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <MobileScannerSimulator requestId={qrData?.requestId} />
    </>
  );
}
