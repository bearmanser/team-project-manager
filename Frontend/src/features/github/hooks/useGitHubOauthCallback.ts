import { useCallback, useRef } from "react";

import { completeGitHubOauth } from "../api";

export function useGitHubOauthCallback() {
    const requestKeyRef = useRef<string | null>(null);
    const requestPromiseRef = useRef<ReturnType<typeof completeGitHubOauth> | null>(
        null,
    );

    return useCallback((sessionToken: string, code: string, state: string) => {
        const requestKey = `${sessionToken}:${code}:${state}`;
        if (
            requestKeyRef.current !== requestKey ||
            !requestPromiseRef.current
        ) {
            requestKeyRef.current = requestKey;
            requestPromiseRef.current = completeGitHubOauth(sessionToken, {
                code,
                state,
            });
        }

        return requestPromiseRef.current;
    }, []);
}
