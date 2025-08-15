import './App.css';
import Pages from "@/pages/index.jsx";
import { Toaster } from "@/components/ui/toaster";

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

function App() {
  return (
    <Authenticator loginMechanisms={['phone_number']}>
      {({ signOut, user }) => (
        <>
          {/* Pass the signOut function as a prop to the Pages component */}
          <Pages signOut={signOut} />
          <Toaster />
        </>
      )}
    </Authenticator>
  );
}

export default App;