import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';

import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css'; // Make sure this style import is here

// This configures Amplify with your credentials
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_APP_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_APP_COGNITO_CLIENT_ID
    }
  }
});

// The old Base44 init should NOT be here.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);