import { PRIORITY_STYLES, getPriorityLabel } from "../utils";
import type { PriorityLevel } from "../types";
import { StatusPill } from "./StatusPill";

type PriorityPillProps = {
    priority: PriorityLevel;
    compact?: boolean;
};

export function PriorityPill({ priority, compact = false }: PriorityPillProps) {
    const styles = PRIORITY_STYLES[priority];

    return (
        <StatusPill
            label={getPriorityLabel(priority)}
            compact={compact}
            bg={styles.bg}
            borderColor={styles.borderColor}
            color={styles.color}
        />
    );
}
