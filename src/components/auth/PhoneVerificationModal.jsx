
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Smartphone, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function PhoneVerificationModal({ onVerificationComplete }) {
  const [step, setStep] = useState("phone"); // "phone" | "otp" 
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setError("Please enter a valid 10-digit phone number");
        setIsLoading(false);
        return;
      }

      const formattedPhone = `+1${cleanPhone}`;
      
      // Call your AWS API Gateway endpoint to send the OTP
      const response = await fetch('https://api.figcloud.com/send-otp', { // Replace with your actual API URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: formattedPhone })
      });

      if (!response.ok) {
        throw new Error("Failed to send code.");
      }
      
      sessionStorage.setItem('pendingPhone', formattedPhone);
      setStep("otp");
    } catch (error) {
      setError("Failed to send verification code. Please try again.");
    }
    setIsLoading(false);
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (otpCode.length !== 6) {
        setError("Please enter the 6-digit verification code");
        setIsLoading(false);
        return;
      }

      const pendingPhone = sessionStorage.getItem('pendingPhone');
      
      // Call your AWS API Gateway endpoint to verify the OTP
      const response = await fetch('https://api.figcloud.com/verify-otp', { // Replace with your actual API URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: pendingPhone, otpCode: otpCode })
      });

      const result = await response.json();

      if (response.ok && result.verified) {
        // Update user with verified phone number and default preferences
       /* await User.updateMyUserData({
          phone_number: pendingPhone,
          otp_verified: true,
          last_login: new Date().toISOString(),
          preferences: {
            auto_sync: true,
            notifications: true,
            encryption: true
          }
        }); */

        sessionStorage.removeItem('pendingPhone');
        onVerificationComplete(pendingPhone);
      } else {
        setError("Invalid verification code. Please try again.");
      }
    } catch (error) {
      setError("Verification failed. An error occurred.");
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {step === "phone" ? "Verify Your Phone" : "Enter Verification Code"}
            </CardTitle>
            <p className="text-slate-600 mt-2">
              {step === "phone" 
                ? "Enter your phone number to sync your Fig Phone data securely"
                : `We sent a 6-digit code to ${phoneNumber}`
              }
            </p>
          </CardHeader>

          <CardContent>
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
                      placeholder="(555) 123-4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                      className="pl-12 h-12 text-lg"
                      maxLength={14}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {error}
                  </p>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading || phoneNumber.length < 14}
                >
                  {isLoading ? (
                    "Sending Code..."
                  ) : (
                    <>
                      Send Verification Code
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2 text-xs text-slate-500 mt-4">
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
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl font-mono tracking-widest h-12"
                    maxLength={6}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {error}
                  </p>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading || otpCode.length !== 6}
                >
                  {isLoading ? "Verifying..." : "Verify & Continue"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("phone")}
                  disabled={isLoading}
                >
                  ← Change Phone Number
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
