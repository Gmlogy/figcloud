import './App.css';
import Pages from "@/pages/index.jsx";
import { Toaster } from "@/components/ui/toaster";

import { Authenticator } from '@aws-amplify/ui-react';
// The ui-react styles are now in main.jsx, but having them here too doesn't hurt.
import '@aws-amplify/ui-react/styles.css';

function App() {
  return (
    // The Authenticator is the top-level component
    <Authenticator loginMechanisms={['phone_number']}>
      {({ signOut, user }) => (
        <>
          <Pages />
          <Toaster />
        </>
      )}
    </Authenticator>
  );
}

export default App;