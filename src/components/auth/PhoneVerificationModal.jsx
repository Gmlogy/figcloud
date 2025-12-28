import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeCanvas as QRCode } from "qrcode.react";
import { Label } from "@/components/ui/label";
import BrandLogo from "@/assets/figlogo.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Smartphone,
  Lock,
  ArrowRight,
  MessageSquareText,
  CheckCircle,
  QrCode,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { getCountries, getCountryCallingCode } from "react-phone-number-input";
import countryLabels from "react-phone-number-input/locale/en.json";

import {
  signIn,
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
  signUp,
  signOut,
} from "aws-amplify/auth";

const API_BASE_URL = "https://jt1d4gvhah.execute-api.us-east-1.amazonaws.com";
const API_KEY = import.meta.env.VITE_QR_API_KEY;

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

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
      body: "{}",
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
      `${API_BASE_URL}/qr-signin/poll?requestId=${encodeURIComponent(
        requestId
      )}`,
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
    console.log("silentSignupIfNeeded -> signUp", usernameOrPhoneE164);

    await signUp({
      username: usernameOrPhoneE164,
      password: strongRandomPassword(),
      options: {
        userAttributes: {
          phone_number: usernameOrPhoneE164,
        },
      },
    });

    console.log("silentSignupIfNeeded -> user created");
  } catch (e) {
    const name = (e?.name || e?.__type || "").toString();
    console.error("silentSignupIfNeeded error:", e);

    if (/UsernameExistsException/i.test(name) || /UsernameExists/i.test(name)) {
      console.log("silentSignupIfNeeded -> user already exists");
      return;
    }
    throw e;
  }
}

async function ensureSignedOutIfNeeded() {
  try {
    const sess = await fetchAuthSession();
    if (sess?.tokens) {
      console.log("[web] ensureSignedOutIfNeeded: signing out existing session");
      await signOut();
    }
  } catch (e) {
    console.warn("[web] ensureSignedOutIfNeeded: fetchAuthSession failed", e);
  }
}

async function startCustomSmsSignIn(e164) {
  console.log("[web] startCustomSmsSignIn for", e164);

  await ensureSignedOutIfNeeded();

  const out = await signIn({
    username: e164,
    options: {
      authFlowType: "CUSTOM_WITHOUT_SRP",
      clientMetadata: { mode: "sms" },
    },
  });

  const stepName = out?.nextStep?.signInStep || "";
  console.log("[web] startCustomSmsSignIn nextStep:", stepName);

  if (out.isSignedIn) return { done: true };

  if (stepName === "CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE") {
    return { done: false };
  }

  throw new Error(`Unsupported next step for CUSTOM_AUTH SMS: ${stepName}`);
}

// Try sign-in first; if missing user, sign them up silently then retry sign-in.
async function startSmsFlowForPhone(e164) {
  try {
    return await startCustomSmsSignIn(e164);
  } catch (err) {
    const name = (err?.name || err?.__type || "").toString();
    const msg = (err?.message || "").toString().toLowerCase();

    const isUserNotFound =
      /UserNotFoundException/i.test(name) ||
      msg.includes("user does not exist") ||
      msg.includes("usernotfound");

    if (!isUserNotFound) throw err;

    console.log(
      "[web] startSmsFlowForPhone: user not found, doing silent signUp"
    );
    await silentSignupIfNeeded(e164);
    return await startCustomSmsSignIn(e164);
  }
}

// ==========================
// Flags (REAL SVG, not emoji)
// ==========================
function flagUrl(code) {
  const c = String(code || "").toLowerCase();
  // Some "countries" from lib are territories like AC/TA that won't exist on flagcdn.
  // We'll fallback to letters when SVG 404s.
  return c ? `https://flagcdn.com/${c}.svg` : "";
}

function FlagIcon({ code, className }) {
  const [failed, setFailed] = useState(false);
  const cc = String(code || "").toUpperCase();
  const src = flagUrl(cc);

  if (!src || failed) {
    // fallback: show 2-letter code
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center h-5 w-7 rounded-sm bg-slate-100 text-[11px] font-semibold text-slate-700",
          className
        )}
      >
        {cc || "??"}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={cc}
      loading="lazy"
      className={cn("h-5 w-7 rounded-sm object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}

// ===== Country picker (flags + top list US/GB/IL) =====
const PRIORITY_COUNTRIES = ["US", "GB", "IL"];

const COUNTRY_ITEMS = (() => {
  const all = getCountries(); // ["AC", "AD", ...]
  const items = all
    .map((c) => {
      const label = countryLabels?.[c] || c;
      let callingCode = "";
      try {
        callingCode = getCountryCallingCode(c);
      } catch {
        callingCode = "";
      }
      return {
        code: c,
        label,
        callingCode,
      };
    })
    .filter((x) => x && x.code && x.label);

  const byCode = new Map(items.map((x) => [x.code, x]));

  const pinned = PRIORITY_COUNTRIES.map((c) => byCode.get(c)).filter(Boolean);

  const rest = items
    .filter((x) => !PRIORITY_COUNTRIES.includes(x.code))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Ensure no duplicates
  const seen = new Set();
  const out = [];
  for (const x of [...pinned, ...rest]) {
    if (seen.has(x.code)) continue;
    seen.add(x.code);
    out.push(x);
  }
  return out;
})();

function CountryPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    return COUNTRY_ITEMS.find((c) => c.code === value) || COUNTRY_ITEMS[0];
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-12 w-[72px] px-2 rounded-lg flex items-center justify-center gap-2",
            "border-slate-200 bg-white hover:bg-slate-50"
          )}
          aria-label="Select country"
        >
          <FlagIcon code={selected?.code} />
          <ChevronsUpDown className="w-4 h-4 text-slate-500" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[360px]" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRY_ITEMS.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.label} ${c.code} +${c.callingCode}`}
                  onSelect={() => {
                    onChange?.(c.code); // ✅ keep ISO code in state
                    setOpen(false);
                  }}
                  className="flex items-center gap-3"
                >
                  <FlagIcon code={c.code} />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="text-slate-500 tabular-nums">
                    +{c.callingCode}
                  </span>
                  {c.code === value ? <Check className="w-4 h-4 ml-2" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ===== QR simulator =====
const MobileScannerSimulator = ({ requestId }) => {
  const [scanned, setScanned] = useState(false);
  useEffect(() => {
    setScanned(false);
    sessionStorage.removeItem("qr_scanned");
  }, [requestId]);
  if (!requestId) return null;

  return (
    <div
      hidden
      className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-xl text-sm w-64 z-50"
    >
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
  const [country, setCountry] = useState("US");
  const [phoneNumber, setPhoneNumber] = useState(""); // NATIONAL digits only
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [signInMethod, setSignInMethod] = useState("sms"); // 'sms' | 'qr'
  const [qrData, setQrData] = useState(null);
  const [qrStatusMessage, setQrStatusMessage] = useState(
    "Generating secure QR code..."
  );

  // checkbox state
  const [otpConsent, setOtpConsent] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        onVerificationComplete("");
      } catch {}
    })();
  }, [onVerificationComplete]);

  const callingCode = useMemo(() => {
    try {
      return getCountryCallingCode(country);
    } catch {
      return "";
    }
  }, [country]);

  const formatNationalDigits = (value) => {
    if (!value) return "";
    return String(value).replace(/\D/g, "").slice(0, 20);
  };

  const toE164 = (cc, nationalDigits) => {
    const digits = String(nationalDigits || "").replace(/\D/g, "");
    const code = String(cc || "").trim();
    if (!code || !digits) return "";
    return `+${code}${digits}`;
  };

  const e164Preview = useMemo(() => {
    return toE164(callingCode, phoneNumber);
  }, [callingCode, phoneNumber]);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInfo("");

    const e164 = e164Preview;

    try {
      if (!e164 || !e164.startsWith("+") || e164.length < 7) {
        throw new Error("Please enter a valid phone number.");
      }

      const res = await startSmsFlowForPhone(e164);

      if (res.done) {
        onVerificationComplete(e164);
        return;
      }

      setStep("otp");
      setInfo("We sent you a sign-in code by SMS.");
    } catch (err) {
      console.error("handlePhoneSubmit error:", err);

      const name = (err?.name || err?.__type || "").toString();

      if (/UserNotConfirmed/i.test(name)) {
        setError(
          "This account isn’t confirmed. Please complete setup from the mobile app."
        );
      } else if (/NotAuthorized/i.test(name)) {
        setError(
          "Sign-up / sign-in not allowed for this app client or user pool. Check Cognito app client settings."
        );
      } else if (/SignUpNotAllowed/i.test(name)) {
        setError(
          "Self sign-up is disabled for this user pool / app client. Enable sign-up in Cognito or create users from the app backend."
        );
      } else {
        setError(err?.message || "Failed to start sign-in.");
      }
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
      if (sess?.tokens) onVerificationComplete(e164Preview);
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
      const e164 = e164Preview;
      const res = await startCustomSmsSignIn(e164);
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

  const completeQrSignIn = async (rawUsername, requestId) => {
    const normalize = (u) => {
      if (!u) return u;
      const s = String(u).trim();
      return /^\+?\d+$/.test(s) ? (s.startsWith("+") ? s : `+${s}`) : s;
    };

    const username = normalize(rawUsername);

    try {
      const out = await signIn({
        username,
        options: {
          authFlowType: "CUSTOM_WITHOUT_SRP",
          clientMetadata: { mode: "qr" },
        },
      });

      if (
        out?.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE"
      ) {
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

  const renderSmsFlow = () => (
    <>
      {step === "phone" ? (
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          <div>
            <Label
              htmlFor="phone"
              className="text-sm font-medium text-slate-700"
            >
              Phone Number
            </Label>

            {/* Country + prefix + number (small like your example) */}
            <div className="mt-1 flex items-stretch gap-2">
              <CountryPicker
                value={country}
                onChange={setCountry}
                disabled={isLoading}
              />

              <Input
                value={callingCode ? `+${callingCode}` : "+"}
                readOnly
                className="h-12 w-[92px] text-center font-medium tabular-nums bg-slate-50"
              />

              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Smartphone className="h-5 w-5 text-slate-400" />
                </div>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone number"
                  value={phoneNumber}
                  onChange={(e) =>
                    setPhoneNumber(formatNationalDigits(e.target.value))
                  }
                  className="pl-12 h-12 text-lg"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="text-xs text-slate-500 mt-2">
              Will be used as:{" "}
              <span className="font-medium">{e164Preview || "—"}</span>
            </div>
          </div>

          {/* Consent + Terms */}
          <div className="space-y-2 text-xs text-slate-600">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={otpConsent}
                onChange={(e) => setOtpConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                I consent to receive One-Time Passwords (OTPs) for verification
                purposes.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                I accept the{" "}
                <a
                  href="https://figkosher.com/62184063161/policies/27542618297.html?locale=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-slate-800"
                >
                  Terms of Service
                </a>{" "}
                &amp{" "}
                <a
                  href="https://figkosher.com/62184063161/policies/27542585529.html?locale=en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-slate-800"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
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
            disabled={isLoading || !otpConsent || !tosAccepted || !e164Preview}
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
              placeholder="123456"
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
                <img
                  src={BrandLogo}
                  alt="App logo"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: 8,
                  }}
                />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">
                Fig Cloud Secure Sign-in
              </CardTitle>
              <p className="text-slate-600 mt-2 text-sm">
                {signInMethod === "sms" && step === "otp"
                  ? `We sent a code to ${e164Preview || ""}`
                  : "Sign in securely using your mobile device."}
              </p>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-2 gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                <Button
                  variant={signInMethod === "sms" ? "default" : "ghost"}
                  onClick={() => setSignInMethod("sms")}
                  className={cn(
                    "h-10 transition-all",
                    signInMethod === "sms"
                      ? "bg-white text-gray-900 shadow"
                      : "text-gray-600"
                  )}
                >
                  <MessageSquareText className="w-4 h-4 mr-2" /> Use SMS
                </Button>
                <Button
                  variant={signInMethod === "qr" ? "default" : "ghost"}
                  onClick={() => setSignInMethod("qr")}
                  className={cn(
                    "h-10 transition-all",
                    signInMethod === "qr"
                      ? "bg-white text-gray-900 shadow"
                      : "text-gray-600"
                  )}
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
                  {signInMethod === "sms" ? renderSmsFlow() : renderQrFlow()}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <MobileScannerSimulator requestId={qrData?.requestId} />
    </>
  );
}
