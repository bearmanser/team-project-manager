import { useCallback, useRef } from "react";

import { completeGitHubOauth } from "../api";

export function useGitHubOauthCallback() {
    const requestKeyRef = useRef<string | null>(null);
    const requestPromiseRef = useRef<ReturnType<typeof completeGitHubOauth> | null>(
        null,
    );

    return useCallback((code: string, state: string) => {
        const requestKey = `${code}:${state}`;
        if (
            requestKeyRef.current !== requestKey ||
            !requestPromiseRef.current
        ) {
            requestKeyRef.current = requestKey;
            requestPromiseRef.current = completeGitHubOauth({
                code,
                state,
            });
        }

        return requestPromiseRef.current;
    }, []);
}
