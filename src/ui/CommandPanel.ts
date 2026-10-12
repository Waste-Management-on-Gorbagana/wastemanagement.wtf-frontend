import "./command-panel.css";
import "./console-art.css";
import { BusinessPreview } from "../business/BusinessPreview";


/** One DOM host shared by the welcome scene and game scene. */
export function ensureGameShell(): HTMLElement {
    let shell = document.getElementById("wm-shell");
    if (!shell) {
        shell = document.createElement("main");
        shell.id = "wm-shell";
        shell.className = "wm-shell";
        document.body.append(shell);
    }
    let host = document.getElementById("game-container");
    if (!host) {
        host = document.createElement("div");
        host.id = "game-container";
    }
    if (host.parentElement !== shell) shell.prepend(host);
    return shell;
}

/** Compatibility with existing startup imports; entry is now through Connect Wallet. */
export function mountAlleyPreview(_onEnter: () => void): () => void {
    return () => {};
}

export interface PanelOverview {
    priceUsd: number | null;
    change24hPercent: number | null;
    walletBalanceWM: string | null;
    walletConnected: boolean;
    rank: number | null;
}
export interface TowerFloor {
    id: string;
    name: string;
    level: number;
    /** Centre of the actual rendered floor in Phaser world coordinates. */
    x: number;
    y: number;
}

export class CommandPanel {
    private readonly shell = ensureGameShell();
    private readonly element = document.createElement("aside");
    private readonly abort = new AbortController();
    private floors: TowerFloor[] = [];
    private floorNames: Record<string, string> = {};
    private floorNamesKey = "";
    private editingFloorId: string | null = null;
    private activeFloor: string | null = null;
    private inspectedFloor: string | null = null;
    private toolProcessing = false;
    private expansionEligible = false;
    private expansionUnlocked = false;
    private sovereignBuilt = false;
    private selectedTool: string | null = null;
    private recyclerState = { established: false, built: false, recycled: 0, target: 100 };

    constructor(business: BusinessPreview | null = null, private readonly onFloorSelect: (floor: TowerFloor) => void = () => {}, private readonly onAssignTool: (toolId: string) => void = () => {}, private readonly onView: (action: string) => void = () => {}, private readonly onUnassignTool: () => void = () => {}, private readonly onStakeNextLevel: () => void = () => {}) {
        this.element.className = "wm-command";
        this.element.dataset.uiVersion = "recycler-unassign-v18";
        this.element.setAttribute("aria-label", "Waste Management command panel");
        this.element.innerHTML = `
            <header class="wm-company-header">
                <div><span class="wm-company-kicker">YOUR BUSINESS</span><strong class="wm-business-name">Establish your business</strong></div>
                <div class="wm-company-logo-frame"><img class="wm-business-logo" alt="Company logo" hidden><span class="wm-logo-placeholder" aria-hidden="true">—</span></div>
            </header>
            <div class="wm-rewards-row"><div><span class="wm-data-label">STAKING REWARDS</span><strong>—</strong></div><button type="button" disabled title="Revenue claims are not connected yet">Claim rewards</button><small>Game revenue shared with WM stakers · Claims not connected</small></div>
            <div class="wm-market-row" aria-label="WM market and wallet">
                <div class="wm-market-cell"><span class="wm-data-label">WM PRICE</span><strong data-price>—</strong><small class="wm-market-change" data-change>24H —</small></div>
                <div class="wm-market-cell"><span class="wm-data-label">WM BALANCE</span><strong data-wallet>—</strong><small data-wallet-status>Wallet not connected</small></div>
            </div>
            <div class="wm-rank-row"><div><span class="wm-data-label">RANK</span><strong data-rank>—</strong></div><nav class="wm-rank-links" aria-label="Business links"><button type="button" class="wm-leaderboard-link" data-open-leaderboard aria-expanded="false">Leaderboard</button><button type="button" class="wm-leaderboard-link" data-open-marketplace aria-expanded="false">Marketplace</button></nav></div>
            <section class="wm-tower" aria-label="Tower floor navigation">
                <div class="wm-tower-heading"><span>YOUR TOWER</span><span data-floor-count>THE ALLEY</span></div>
                <div class="wm-tower-window">

                    <div class="wm-floor-stack"></div>
                    <div class="wm-tower-ground" aria-hidden="true"></div>
                </div>
                <div class="wm-level-expansion" hidden>
                    <strong>Level 1 available</strong>
                    <p>100 accounts recycled. Stake another 100,000 WM to unlock Level 1.</p>
                    <button type="button" data-stake-next-level>Stake 100,000 WM &amp; unlock Level 1</button>
                    <small>SIMULATED · No WM moves. Total required stake: 200,000 WM.</small>
                </div>
                <div class="wm-level-details">
                <div class="wm-recycling-meter" hidden><div><strong>ACCOUNTS RECYCLED</strong><span data-recycle-count>0 / 100</span></div><progress data-recycle-meter max="100" value="0" aria-label="Accounts recycled"></progress></div>
                <div class="wm-recycler-controls">
                    <h3 class="wm-editable-level-title"><button type="button" data-slot-title disabled>Select a level</button><input data-level-name-edit aria-label="Level name" maxlength="32" autocomplete="off" hidden></h3>
                    <span class="wm-name-announcement" data-floor-name-status aria-live="polite"></span>
                    <div class="wm-tool-list" aria-label="Available tools" hidden>
                        <button type="button" class="wm-tool-option" data-select-tool="trash-recycler" aria-pressed="false">
                            <img src="/assets/gameplay/trash-recycler.png" alt="" class="wm-recycler-art">
                            <span><strong>Trash Recycler</strong><small>Reclaim rent from unused accounts</small></span>
                        </button>
                    </div>
                    <div class="wm-installed-tool" hidden><img src="/assets/gameplay/trash-recycler.png" alt="Trash Recycler machine" class="wm-recycler-art"><div><small>ASSIGNED TOOL</small><strong>Trash Recycler</strong><span>Installed in level 0</span></div></div>
                    <button type="button" data-unassign-tool hidden>Unassign tool</button>
                    <button type="button" data-assign-tool disabled hidden>Assign to level</button>
                    <p data-recycler-status aria-live="polite">Establish your business to unlock the first level.</p>
                    <small>SESSION PREVIEW · No WM moves or rent is reclaimed.</small>
                </div>
                </div>
                <p class="wm-tower-hint" aria-live="polite">Select a level to bring it into view.</p>
            </section>
            <section class="wm-marketplace-view" aria-label="Marketplace" hidden>
                <button type="button" class="wm-back-to-tower" data-return-tower>← Back to tower</button>
                <h2>Marketplace</h2>
                <p>Business listings will appear here when the marketplace is connected.</p>
                <p>Buying a business NFT transfers its tower, assets, progress, locked WM stake and withdrawal rights to the buyer.</p>
            </section>
            <section class="wm-leaderboard-view" aria-label="Leaderboard" hidden>
                <button type="button" class="wm-back-to-tower" data-return-tower>← Back to tower</button>
                <h2>Business leaderboard</h2>
                <p>Rankings will appear here when the leaderboard service is connected.</p>
            </section>
        `;
        this.shell.classList.add("wm-in-game");
        this.shell.append(this.element);
        if (business) this.setBusiness(business);
        this.element.addEventListener("click", event => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
            if (!button || button.disabled) return;
            if (button.hasAttribute("data-stake-next-level") && this.expansionEligible && !this.expansionUnlocked && !this.toolProcessing) this.onStakeNextLevel();
            if (button.dataset.camera) this.onView(button.dataset.camera);
            if (button.dataset.selectTool && this.canAssignTool()) {
                this.selectedTool = button.dataset.selectTool;
                this.renderSlot();
            }
            if (button.hasAttribute("data-assign-tool") && this.selectedTool === this.floorToolId() && this.canAssignTool()) {
                const tool = this.selectedTool;
                this.selectedTool = null;
                this.onAssignTool(tool);
                this.renderSlot();
            }
            if (button.hasAttribute("data-unassign-tool") && !this.toolProcessing && this.installedOnActiveFloor() && this.inspectedFloor === this.activeFloor) {
                this.selectedTool = null;
                this.onUnassignTool();
                this.renderSlot();
                this.element.querySelector<HTMLButtonElement>("[data-select-tool]")?.focus();
            }
            if (button.hasAttribute("data-open-leaderboard")) this.showView("leaderboard");
            if (button.hasAttribute("data-open-marketplace")) this.showView("marketplace");
            if (button.hasAttribute("data-return-tower")) this.showView("tower");
            if (button.dataset.floor && !this.toolProcessing) {
                const floor = this.floors.find(item => item.id === button.dataset.floor);
                if (floor) {
                    if (this.inspectedFloor !== floor.id) this.selectedTool = null;
                    this.inspectedFloor = floor.id;
                    this.setActiveFloor(floor.id);
                    this.onFloorSelect(floor);
                }
            }
        }, { signal: this.abort.signal });
        this.element.querySelector("[data-slot-title]")!.addEventListener("click", () => {
            const floor = this.floors.find(f => f.id === this.activeFloor);
            if (!floor || floor.level < 0 || !this.recyclerState.established || this.inspectedFloor !== floor.id) return;
            this.editingFloorId = floor.id;
            const input = this.element.querySelector<HTMLInputElement>("[data-level-name-edit]")!;
            input.value = this.floorNames[floor.id] ?? `Level ${floor.level}`;
            input.hidden = false;
            this.element.querySelector<HTMLElement>("[data-slot-title]")!.hidden = true;
            input.focus(); input.select();
        }, { signal: this.abort.signal });
        const editor = this.element.querySelector<HTMLInputElement>("[data-level-name-edit]")!;
        editor.addEventListener("blur", () => this.finishFloorName(true), { signal: this.abort.signal });
        editor.addEventListener("keydown", event => {
            event.stopPropagation();
            if (event.key === "Enter") { event.preventDefault(); this.finishFloorName(true); }
            if (event.key === "Escape") { event.preventDefault(); this.finishFloorName(false); }
        }, { signal: this.abort.signal });
        // UI pointer/wheel events must not reach world input handlers.
        for (const name of ["pointerdown", "pointerup", "pointermove", "wheel"]) {
            this.element.addEventListener(name, event => event.stopPropagation(), { signal: this.abort.signal });
        }
    }

    // Camera zoom remains available through the scene's mouse-wheel handler.
    setCameraZoom(_factor: number): void {}

    setRecycler(established: boolean, built: boolean, recycled: number, target: number): void {
        this.recyclerState = { established, built, recycled, target };
        this.element.querySelector("[data-recycle-count]")!.textContent = `${recycled} / ${target}`;
        const meter = this.element.querySelector<HTMLProgressElement>("[data-recycle-meter]")!;
        meter.max = target; meter.value = recycled;
        this.element.querySelector<HTMLElement>(".wm-tower-window")!.dataset.built = String(built);
        this.renderSlot();
    }

    setExpansion(eligible: boolean, unlocked: boolean): void {
        this.expansionEligible = eligible;
        this.expansionUnlocked = unlocked;
        this.element.querySelector<HTMLElement>(".wm-level-expansion")!.hidden = !eligible || unlocked;
        this.element.querySelector<HTMLButtonElement>("[data-stake-next-level]")!.disabled = this.toolProcessing || !eligible || unlocked;
        this.renderSlot();
    }

    setToolProcessing(processing: boolean): void {
        this.toolProcessing = processing;
        this.element.querySelector<HTMLButtonElement>("[data-stake-next-level]")!.disabled = processing || !this.expansionEligible || this.expansionUnlocked;
        const button = this.element.querySelector<HTMLButtonElement>("[data-unassign-tool]")!;
        button.disabled = processing;
        button.textContent = processing ? "Processing… Unassign unavailable" : "Unassign tool";
        button.setAttribute("aria-busy", String(processing));
    }

    setSovereign(built: boolean): void {
        this.sovereignBuilt = built;
        this.renderSlot();
    }
    private floorToolId(): string { return this.activeFloor === "slot-2" ? "sovereign" : "trash-recycler"; }
    private installedOnActiveFloor(): boolean {
        return this.activeFloor === "slot-1" ? this.recyclerState.built : this.activeFloor === "slot-2" && this.sovereignBuilt;
    }
    private canAssignTool(): boolean {
        return !this.toolProcessing && this.recyclerState.established && this.inspectedFloor === this.activeFloor &&
            ((this.activeFloor === "slot-1" && !this.recyclerState.built) ||
             (this.activeFloor === "slot-2" && this.expansionUnlocked && !this.sovereignBuilt));
    }

    private renderSlot(): void {
        const state = this.recyclerState;
        const floor = this.floors.find(f => f.id === this.activeFloor);
        const inspected = !!floor && this.inspectedFloor === floor.id;
        const sovereign = floor?.id === "slot-2";
        const installed = inspected && this.installedOnActiveFloor();
        const toolId = sovereign ? "sovereign" : "trash-recycler";
        const toolName = sovereign ? "Sovereign" : "Trash Recycler";
        const empty = inspected && state.established && floor.level >= 0 && !installed;
        const available = this.canAssignTool();
        this.element.querySelector<HTMLElement>(".wm-recycling-meter")!.hidden = !installed || sovereign;
        this.element.querySelector<HTMLElement>(".wm-tool-list")!.hidden = !empty;
        this.element.querySelector<HTMLElement>(".wm-installed-tool")!.hidden = !installed;
        this.element.querySelector<HTMLButtonElement>("[data-unassign-tool]")!.hidden = !installed;
        const option = this.element.querySelector<HTMLButtonElement>("[data-select-tool]")!;
        option.dataset.selectTool = toolId;
        option.disabled = !available;
        option.setAttribute("aria-pressed", String(available && this.selectedTool === toolId));
        option.querySelector("strong")!.textContent = toolName;
        option.querySelector<HTMLImageElement>("img")!.src = `/assets/gameplay/${toolId}.png`;
        option.querySelector("small")!.textContent = sovereign ? "Single-sided token liquidity" : "Reclaim rent from unused accounts";
        const card = this.element.querySelector<HTMLElement>(".wm-installed-tool")!;
        const art = card.querySelector<HTMLImageElement>("img")!;
        art.src = `/assets/gameplay/${toolId}.png`; art.alt = `${toolName} machine`;
        card.querySelector("strong")!.textContent = toolName;
        card.querySelector("span")!.textContent = `Installed in level ${sovereign ? 1 : 0}`;
        const assign = this.element.querySelector<HTMLButtonElement>("[data-assign-tool]")!;
        assign.hidden = !empty;
        assign.disabled = !available || this.selectedTool !== toolId;
        const title = this.element.querySelector<HTMLButtonElement>("[data-slot-title]")!;
        title.textContent = inspected ? this.floorNames[floor.id] || `Level ${floor.level}` : "Select a level";
        title.disabled = !inspected || !state.established || floor.level < 0;
        title.title = title.disabled ? "" : "Click to rename this level";
        title.setAttribute("aria-label", title.disabled ? "Select a level" : `${title.textContent}. Click to rename.`);
        this.element.querySelector("[data-recycler-status]")!.textContent = !state.established
            ? "Establish your business to unlock level 0."
            : !inspected ? "Select a level in the tower to manage its tools."
            : installed && sovereign ? "Sovereign assigned · Trading-floor preview. Pool controls are not connected yet."
            : installed ? (state.recycled >= state.target ? (this.expansionUnlocked ? "Level 1 unlocked." : "Recycling target reached · Stake to unlock Level 1.") : "Trash Recycler installed · Drag trash into level 0 to recycle.")
            : available ? (sovereign ? "Choose Sovereign, then assign it to this level." : "Choose a tool to install in this level. Any recycling progress is kept when a tool is unassigned.")
            : "No unassigned tools available for this level yet.";
    }

    private finishFloorName(save: boolean): void {
        const id = this.editingFloorId;
        if (!id) return;
        this.editingFloorId = null;
        const input = this.element.querySelector<HTMLInputElement>("[data-level-name-edit]")!;
        const floor = this.floors.find(f => f.id === id);
        if (save && floor) {
            const name = input.value.trim().replace(/\s+/g, " ").slice(0, 32);
            if (name && name !== `Level ${floor.level}`) this.floorNames[id] = name;
            else delete this.floorNames[id];
            let status = "Level name saved.";
            try { localStorage.setItem(this.floorNamesKey, JSON.stringify(this.floorNames)); }
            catch { status = "Name applied for this session; browser storage is unavailable."; }
            this.element.querySelector("[data-floor-name-status]")!.textContent = status;
        }
        input.hidden = true;
        const title = this.element.querySelector<HTMLButtonElement>("[data-slot-title]")!;
        title.hidden = false;
        this.setFloors(this.floors);
        // Preserve mouse focus on blur; keyboard commits return focus to the title.
        if (document.activeElement === input) title.focus();
    }

    setBusiness(business: BusinessPreview): void {
        const key = "wm-floor-names-v1:" + business.name;
        if (key !== this.floorNamesKey) {
            this.floorNamesKey = key;
            this.floorNames = {};
            try {
                const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
                if (stored && typeof stored === "object" && !Array.isArray(stored)) {
                    for (const [id, value] of Object.entries(stored)) {
                        if (/^slot-\d+$/.test(id) && typeof value === "string") this.floorNames[id] = value.slice(0, 32);
                    }
                }
            } catch { /* Names can still be edited in memory. */ }
        }
        this.element.querySelector(".wm-business-name")!.textContent = business.name;
        const logo = this.element.querySelector<HTMLImageElement>(".wm-business-logo")!;
        logo.hidden = !business.logoDataUrl;
        if (business.logoDataUrl) logo.src = business.logoDataUrl;
        else logo.removeAttribute("src");
        this.element.querySelector<HTMLElement>(".wm-logo-placeholder")!.hidden = !!business.logoDataUrl;
    }

    /** Data comes from the wallet/market/ranking adapters. Never substitute the stake for wallet balance. */
    setOverview(data: PanelOverview): void {
        const price = data.priceUsd;
        this.element.querySelector("[data-price]")!.textContent = price !== null && Number.isFinite(price) && price >= 0
            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 10 }).format(price) : "—";
        const change = this.element.querySelector<HTMLElement>("[data-change]")!;
        const percent = data.change24hPercent;
        const validChange = percent !== null && Number.isFinite(percent);
        change.textContent = validChange ? `${percent > 0 ? "+" : ""}${percent.toFixed(2)}% · 24H` : "24H —";
        change.dataset.direction = validChange ? (percent > 0 ? "up" : percent < 0 ? "down" : "flat") : "unknown";
        const balance = data.walletBalanceWM;
        const validBalance = data.walletConnected && balance !== null && /^\d+(\.\d+)?$/.test(balance);
        this.element.querySelector("[data-wallet]")!.textContent = validBalance
            ? balance.split(".").map((part, index) => index === 0 ? part.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : part).join(".") : "—";
        this.element.querySelector("[data-wallet-status]")!.textContent = data.walletConnected
            ? validBalance ? "Available in wallet" : "Balance unavailable" : "Wallet not connected";
        const rank = data.rank;
        this.element.querySelector("[data-rank]")!.textContent = rank !== null && Number.isInteger(rank) && rank > 0 ? `#${rank.toLocaleString("en-US")}` : "—";
    }

    /** Supply unlocked slots only; this navigator does not invent or unlock floors. */
    setFloors(floors: TowerFloor[], selectedId = this.activeFloor): void {
        const seen = new Set<string>();
        this.floors = floors.filter(floor => {
            if (!floor.id || seen.has(floor.id) || ![floor.x, floor.y, floor.level].every(Number.isFinite)) return false;
            seen.add(floor.id); return true;
        }).sort((a, b) => b.level - a.level);
        const stack = this.element.querySelector<HTMLElement>(".wm-floor-stack")!;
        stack.replaceChildren();
        for (let level = 9; level >= 0; level--) {
            const floor = this.floors.find(f => f.level === level);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "wm-tower-floor";
            button.disabled = !floor || this.toolProcessing;
            if (floor) button.dataset.floor = floor.id;
            const number = document.createElement("span");
            number.className = "wm-floor-number"; number.textContent = String(level);
            const label = document.createElement("strong");
            label.textContent = floor && this.floorNames[floor.id] ? this.floorNames[floor.id] : `Level ${level}`;
            const state = document.createElement("span");
            state.className = "wm-floor-lock"; state.textContent = floor ? "" : "Locked";
            button.setAttribute("aria-label", `Level ${level}${floor ? this.floorNames[floor.id] ? ": " + this.floorNames[floor.id] : ", unlocked" : ", locked"}`);
            button.append(number, label, state); stack.append(button);
        }
        const count = this.floors.filter(floor => floor.level >= 0).length;
        this.element.querySelector("[data-floor-count]")!.textContent = count ? `${count} FLOOR${count === 1 ? "" : "S"}` : "THE ALLEY";
        this.setActiveFloor(this.floors.some(floor => floor.id === selectedId) ? selectedId! : this.floors[this.floors.length - 1]?.id ?? "");
    }

    setActiveFloor(id: string): void {
        this.activeFloor = id;
        this.element.querySelectorAll<HTMLButtonElement>("[data-floor]").forEach(button => {
            button.setAttribute("aria-pressed", String(button.dataset.floor === id));
        });
        const floor = this.floors.find(item => item.id === id);
        if (floor) this.element.querySelector(".wm-tower-hint")!.textContent = `Viewing ${floor.name} · Select a level to change floors.`;
        this.renderSlot();
    }

    private lastView: "leaderboard" | "marketplace" = "leaderboard";

    private showView(view: "tower" | "leaderboard" | "marketplace"): void {
        this.element.querySelector<HTMLElement>(".wm-tower")!.hidden = view !== "tower";
        for (const name of ["leaderboard", "marketplace"] as const) {
            const section = this.element.querySelector<HTMLElement>(`.wm-${name}-view`)!;
            section.hidden = view !== name;
            this.element.querySelector<HTMLButtonElement>(`[data-open-${name}]`)!.setAttribute("aria-expanded", String(view === name));
        }
        if (view === "tower") {
            this.element.querySelector<HTMLButtonElement>(`[data-open-${this.lastView}]`)!.focus();
        } else {
            this.lastView = view;
            this.element.querySelector<HTMLButtonElement>(`.wm-${view}-view [data-return-tower]`)!.focus();
        }
    }

    destroy(): void {
        this.abort.abort();
        this.element.remove();
        this.shell.classList.remove("wm-in-game");
    }
}
