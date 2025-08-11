// src/lib/api.js
import { fetchAuthSession } from 'aws-amplify/auth';

const BASE_URL = import.meta.env.VITE_APP_API_GATEWAY_URL;

async function request(endpoint, method = 'GET', data = null) {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();

    if (!token) {
        throw new Error("User is not authenticated.");
    }

    const config = {
        method: method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API error: ${response.status} - ${errorData}`);
    }
    
    return response.json();
}

export const api = {
    get: (endpoint) => request(endpoint, 'GET'),
    post: (endpoint, data) => request(endpoint, 'POST', data),
};