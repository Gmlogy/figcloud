import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { getCurrentUser, signOut as amplifySignOut } from "aws-amplify/auth";
// ❌ DO NOT import any file that calls Amplify.configure here
// import "../aws-amplify-config";

import { AuthContext } from "../context/AuthContext";

import Layout from "./Layout.jsx";
import Dashboard from "./Dashboard";
import SyncStatus from "./SyncStatus";
import Settings from "./Settings";
import Photos from "./Photos";
import Contacts from "./Contacts";
import ReverseSync from "./ReverseSync";
import FindPhone from "./FindPhone";
import PhoneVerificationModal from "../components/auth/PhoneVerificationModal";

const PAGES = {
  Dashboard,
  SyncStatus,
  Settings,
  Photos,
  Contacts,
  ReverseSync,
  FindPhone,
};

function _getCurrentPage(url) {
  if (url.endsWith("/")) url = url.slice(0, -1);
  let urlLastPart = url.split("/").pop();
  if (urlLastPart.includes("?")) urlLastPart = urlLastPart.split("?")[0];
  const pageName = Object.keys(PAGES).find(
    (page) => page.toLowerCase() === urlLastPart.toLowerCase()
  );
  return pageName || Object.keys(PAGES)[0];
}

function AuthGate({ children }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser({ sub: currentUser.userId, ...currentUser.attributes });
        setAuthed(true);
      } catch {
        setAuthed(false);
        setUser(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) return null;

  return (
    <AuthContext.Provider value={{ user }}>
      {!authed && (
        <PhoneVerificationModal
          onVerificationComplete={() => window.location.reload()}
        />
      )}
      {authed && children}
    </AuthContext.Provider>
  );
}

function PagesContent({ signOut }) {
  const location = useLocation();
  const currentPage = _getCurrentPage(location.pathname);

  return (
    <Layout currentPageName={currentPage} signOut={signOut}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/SyncStatus" element={<SyncStatus />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/Photos" element={<Photos />} />
        <Route path="/Contacts" element={<Contacts />} />
        <Route path="/ReverseSync" element={<ReverseSync />} />
        <Route path="/FindPhone" element={<FindPhone />} />
      </Routes>
    </Layout>
  );
}

export default function Pages() {
  const doSignOut = async () => {
    try {
      await amplifySignOut();
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <Router>
      <AuthGate>
        <PagesContent signOut={doSignOut} />
      </AuthGate>
    </Router>
  );
}
