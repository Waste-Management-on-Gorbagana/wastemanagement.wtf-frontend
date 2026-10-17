/** Implement this adapter in the wallet layer when recovery goes live.
 * Merely playing a delivery never submits a transaction or changes a balance.
 */
export interface RecoverableTrash {
    id: string; // Stable account/token identity; never an array index.
    kind: "rent" | "token";
    label: string;
}
export interface RecoveryProvider {
    walletId(): string | null;
    list(signal: AbortSignal): Promise<RecoverableTrash[]>;
    /** Must handle explicit token-burn confirmation and await confirmed settlement. */
    recover(item: RecoverableTrash, signal: AbortSignal): Promise<{ confirmed: boolean }>;
}
declare global { interface Window { wmRecoveryProvider?: RecoveryProvider; } }
// Temporary test mode until the live wallet provider is attached. Never submits transactions.
export function recoveryProvider(): RecoveryProvider | undefined {
    if (window.wmRecoveryProvider) return window.wmRecoveryProvider;
    return preview;
}
const consumed = new Set<string>();
let batch = 0;
const preview: RecoveryProvider = {
    walletId: () => "SESSION-PREVIEW",
    list: async () => {
        if (consumed.size === 5) { batch++; consumed.clear(); }
        return Array.from({ length: 5 }, (_, i) => ({ id: `preview-${batch}-${i}`, kind: "rent" as const, label: `Preview empty account ${i + 1}` })).filter(x => !consumed.has(x.id));
    },
    recover: async item => { consumed.add(item.id); return { confirmed: true }; },
};
export function validTrash(items: RecoverableTrash[]): RecoverableTrash[] {
    const seen = new Set<string>();
    return items.filter(x => x && typeof x.id === "string" && x.id.length > 0 && (x.kind === "rent" || x.kind === "token") && !seen.has(x.id) && !!seen.add(x.id))
        .map(x => ({ id: x.id, kind: x.kind, label: String(x.label || x.id) }));
}
