/** Session-only simulation. Never authorizes staking, account closure or rewards. */
export interface ToolDefinition { id: string; name: string; building: string; }
export interface LevelSlot { level: number; unlocked: boolean; toolId: string | null; }
export const STARTER_TOOLS: readonly ToolDefinition[] = [
    { id: "trash-recycler", name: "Trash Recycler", building: "Dumpster" }
];
export class RecyclerProgress {
    readonly slot: LevelSlot = { level: 1, unlocked: false, toolId: null };
    readonly availableTools: readonly ToolDefinition[] = STARTER_TOOLS;
    readonly recycled = new Set<number>();
    readonly nextLevelAccountRequirement = 100;
    get nextLevelUnlocked(): boolean { return this.recycled.size >= this.nextLevelAccountRequirement; }
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
