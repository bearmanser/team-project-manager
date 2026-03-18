type IconProps = {
    size?: number;
    strokeWidth?: number;
};

export function PlusIcon({ size = 18, strokeWidth = 1.8 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
        </svg>
    );
}

export function CloseIcon({ size = 18, strokeWidth = 1.8 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
        </svg>
    );
}

export function InviteIcon({ size = 18, strokeWidth = 1.7 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M15 18.5a4.5 4.5 0 0 0-9 0"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            <circle cx="10.5" cy="8.5" r="3.5" stroke="currentColor" strokeWidth={strokeWidth} />
            <path
                d="M18 8v6M15 11h6"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
        </svg>
    );
}

export function MoreIcon({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="17.5" cy="12" r="1.5" fill="currentColor" />
        </svg>
    );
}

export function SunIcon({ size = 18, strokeWidth = 1.8 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
    );
}

export function MoonIcon({ size = 18, strokeWidth = 1.8 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M19.25 14.5A7.25 7.25 0 0 1 9.5 4.75a7.25 7.25 0 1 0 9.75 9.75Z"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
