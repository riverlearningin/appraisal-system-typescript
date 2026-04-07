import axios from "axios";
import { clearAccessToken, getAccessToken } from "@/lib/auth/token";

let isRedirectingToLogin = false;

const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
    timeout: 15000,
    withCredentials: true, // Sends HttpOnly cookie on every request
    headers: {
        "Content-Type": "application/json",
    },
});

apiClient.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = getAccessToken();
        if (token) {
            config.headers = config.headers ?? {};
            if (!config.headers.Authorization) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            clearAccessToken();
            const requestUrl: string = error.config?.url ?? "";
            const isAuthMeRequest = requestUrl.includes('/auth/me');

            // /auth/me can legitimately return 401 during app bootstrap for anonymous users.
            // Avoid forcing a hard reload loop on the login page.
            if (!isAuthMeRequest && typeof window !== "undefined") {
                const onLoginPage = window.location.pathname === '/login';
                if (!onLoginPage && !isRedirectingToLogin) {
                    isRedirectingToLogin = true;
                    window.location.replace('/login');
                }
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;