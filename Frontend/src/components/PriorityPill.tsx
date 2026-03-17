import { PRIORITY_STYLES, getPriorityLabel } from "../utils";
import type { PriorityLevel } from "../types";
import { StatusPill } from "./StatusPill";

type PriorityPillProps = {
    priority: PriorityLevel;
};

export function PriorityPill({ priority }: PriorityPillProps) {
    const styles = PRIORITY_STYLES[priority];

    return (
        <StatusPill
            label={getPriorityLabel(priority)}
            bg={styles.bg}
            borderColor={styles.borderColor}
            color={styles.color}
        />
    );
}
