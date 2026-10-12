/** Session-only simulation. Never authorizes staking, account closure or rewards. */
export interface ToolDefinition { id: string; name: string; building: string; }
export interface LevelSlot { level: number; unlocked: boolean; toolId: string | null; }
export const STARTER_TOOLS: readonly ToolDefinition[] = [
    { id: "trash-recycler", name: "Trash Recycler", building: "Dumpster" }
];
export class RecyclerProgress {
    readonly slot: LevelSlot = { level: 0, unlocked: false, toolId: null };
    readonly availableTools: readonly ToolDefinition[] = STARTER_TOOLS;
    private sovereignAssigned = false;
    get sovereignBuilt(): boolean { return this.sovereignAssigned; }
    assignSovereign(): boolean {
        if (!this.nextLevelUnlocked || this.sovereignAssigned) return false;
        this.sovereignAssigned = true;
        return true;
    }
    unassignSovereign(): boolean {
        if (!this.sovereignAssigned) return false;
        this.sovereignAssigned = false;
        return true;
    }
    readonly recycled = new Set<number>();
    readonly nextLevelAccountRequirement = 100;
    private level1StakeCompleted = false;
    readonly nextLevelStakeWM = 100_000;
    get nextLevelEligible(): boolean { return this.established && this.recycled.size >= this.nextLevelAccountRequirement; }
    get nextLevelUnlocked(): boolean { return this.level1StakeCompleted; }
    /** Session preview only. Production must unlock from verified transaction settlement. */
    simulateNextLevelStake(): boolean {
        if (!this.nextLevelEligible || this.level1StakeCompleted) return false;
        this.level1StakeCompleted = true;
        return true;
    }
    get established(): boolean { return this.slot.unlocked; }
    get built(): boolean { return this.slot.toolId === "trash-recycler"; }
    establish(): void { this.slot.unlocked = true; }
    assignTool(toolId: string): boolean {
        if (!this.slot.unlocked || this.slot.toolId !== null || !this.availableTools.some(tool => tool.id === toolId)) return false;
        this.slot.toolId = toolId;
        return true;
    }
    unassignTool(): boolean {
        if (this.slot.toolId === null) return false;
        this.slot.toolId = null;
        return true;
    }
    recycle(id: number): boolean {
        if (!this.built || !Number.isInteger(id) || id < 0 || id >= 100 || this.recycled.has(id)) return false;
        this.recycled.add(id);
        return true;
    }
}
