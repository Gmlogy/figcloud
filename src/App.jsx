// src/App.jsx
import './App.css';
import Pages from "@/pages/index.jsx";
import { Toaster } from "@/components/ui/toaster";

// Make sure Amplify is configured once, at app start:
// import "@/aws-amplify-config.js";

// Custom gate + modal
import React from "react";
import PhoneVerificationModal from "@/components/auth/PhoneVerificationModal.jsx";
import { getCurrentUser, signOut as amplifySignOut } from "aws-amplify/auth";

function AuthGate({ children }) {
  const [authed, setAuthed] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try { await getCurrentUser(); setAuthed(true); }
      catch { setAuthed(false); }
      finally { setChecking(false); }
    })();
  }, []);

  if (checking) return null; // or a spinner

  return (
    <>
      {!authed && (
        <PhoneVerificationModal
          onVerificationComplete={() => setAuthed(true)}
        />
      )}
      {authed && children}
    </>
  );
}

export default function App() {
  const doSignOut = async () => {
    try { await amplifySignOut(); }
    finally { window.location.href = "/"; }
  };

  return (
    <AuthGate>
      <Pages signOut={doSignOut} />
      <Toaster />
    </AuthGate>
  );
}
