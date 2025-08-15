import { fetchAuthSession } from 'aws-amplify/auth';

// IMPORTANT: Make sure this environment variable is set in your .env file
const API_BASE_URL = import.meta.env.VITE_APP_API_GATEWAY_URL;

/**
 * A robust, authenticated request function for your API.
 * @param {string} method - The HTTP method (e.g., 'GET', 'POST').
 * @param {string} path - The API path (e.g., '/messages').
 * @param {Object} [body] - The request body for POST/PUT requests.
 * @returns {Promise<any>} The JSON response from the API or true on success with no body.
 */
async function request(method, path, body) {
  if (!API_BASE_URL) {
    console.error("VITE_APP_API_GATEWAY_URL is not set. Please check your .env file.");
    throw new Error("API URL is not configured.");
  }

  try {
    const { idToken } = (await fetchAuthSession()).tokens ?? {};
    if (!idToken) {
      throw new Error('User is not authenticated. No ID token found.');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': idToken.toString()
    };
    
    const url = `${API_BASE_URL}${path}`;

    const options = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    // --- THIS IS THE CORRECTED LOGIC ---
    // Try to parse the response as JSON. If the body is empty (like on a successful POST),
    // the .json() call will fail, and we'll fall into the catch block.
    try {
      return await response.json();
    } catch (e) {
      // This is expected for successful requests with no response body (e.g., 201 Created).
      return true; 
    }
    // --- END OF CORRECTED LOGIC ---

  } catch (error) {
    console.error(`API request to ${method} ${path} failed:`, error);
    throw error;
  }
}

// Export a clean, easy-to-use 'api' object
export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
};