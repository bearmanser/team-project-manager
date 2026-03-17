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

