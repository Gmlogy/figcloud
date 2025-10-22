import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';

import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';

// Single, authoritative Amplify config
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_APP_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_APP_COGNITO_CLIENT_ID,
      loginWith: { username: false, email: false, phone: true },
      signUpVerificationMethod: 'code',
      // IMPORTANT: keep the whole app on CUSTOM_AUTH
      authenticationFlowType: 'CUSTOM_WITHOUT_SRP',
    }
  }
});
const cfg = Amplify.getConfig?.() || {};
console.log('[Amplify Auth cfg]', cfg?.Auth?.Cognito);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
