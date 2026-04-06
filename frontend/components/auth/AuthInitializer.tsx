'use client';

import { useAuthStore } from "@/store/auth.store";
import { useEffect } from "react";

// Runs once on app boot - calls /auth/me to rehydrate user from cookie
export function AuthInitializer() {
    const initialize = useAuthStore((s) => s.initialize);

    useEffect(() => {
        initialize();
    }, [initialize]);

    return null;
}