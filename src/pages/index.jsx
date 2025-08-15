import Layout from "./Layout.jsx";
import Dashboard from "./Dashboard";
import SyncStatus from "./SyncStatus";
import Settings from "./Settings";
import Photos from "./Photos";
import Contacts from "./Contacts";
import ReverseSync from "./ReverseSync";
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    Dashboard: Dashboard,
    SyncStatus: SyncStatus,
    Settings: Settings,
    Photos: Photos,
    Contacts: Contacts,
    ReverseSync: ReverseSync,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }
    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Accept signOut as a prop
function PagesContent({ signOut }) {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        // Pass signOut down to the Layout component
        <Layout currentPageName={currentPage} signOut={signOut}>
            <Routes>            
                <Route path="/" element={<Dashboard />} />
                <Route path="/Dashboard" element={<Dashboard />} />
                <Route path="/SyncStatus" element={<SyncStatus />} />
                <Route path="/Settings" element={<Settings />} />
                <Route path="/Photos" element={<Photos />} />
                <Route path="/Contacts" element={<Contacts />} />
                <Route path="/ReverseSync" element={<ReverseSync />} />
            </Routes>
        </Layout>
    );
}

// Accept signOut as a prop
export default function Pages({ signOut }) {
    return (
        <Router>
            {/* Pass signOut to the content */}
            <PagesContent signOut={signOut} />
        </Router>
    );
}