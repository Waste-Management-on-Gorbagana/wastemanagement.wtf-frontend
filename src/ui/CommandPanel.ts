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
    private activeFloor: string | null = null;
    private inspectedFloor: string | null = null;
    private toolProcessing = false;
    private selectedTool: string | null = null;
    private recyclerState = { established: false, built: false, recycled: 0, target: 100 };

    constructor(business: BusinessPreview | null = null, private readonly onFloorSelect: (floor: TowerFloor) => void = () => {}, private readonly onAssignTool: (toolId: string) => void = () => {}, private readonly onView: (action: string) => void = () => {}, private readonly onUnassignTool: () => void = () => {}) {
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
                    <div class="wm-locked-levels" aria-label="Future levels locked"><span>3 ▣</span><span>2 ▣</span><span data-locked-two>1 ▣</span></div>
                    <div class="wm-floor-stack"></div>
                    <div class="wm-tower-ground" aria-hidden="true"></div>
                </div>
                <div class="wm-level-details">
                <div class="wm-recycling-meter" hidden><div><strong>ACCOUNTS RECYCLED</strong><span data-recycle-count>0 / 100</span></div><progress data-recycle-meter max="100" value="0" aria-label="Accounts recycled"></progress></div>
                <div class="wm-recycler-controls">
                    <h3 data-slot-title>Select a level</h3>
                    <div class="wm-tool-list" aria-label="Available tools" hidden>
                        <button type="button" class="wm-tool-option" data-select-tool="trash-recycler" aria-pressed="false">
                            <img src="/assets/gameplay/trash-recycler.png" alt="" class="wm-recycler-art">
                            <span><strong>Trash Recycler</strong><small>Reclaim rent from unused accounts</small></span>
                        </button>
                    </div>
                    <div class="wm-installed-tool" hidden><img src="/assets/gameplay/trash-recycler.png" alt="Trash Recycler machine" class="wm-recycler-art"><div><small>ASSIGNED TOOL</small><strong>Trash Recycler</strong><span>Installed in level 1</span></div></div>
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
            if (button.dataset.camera) this.onView(button.dataset.camera);
            if (button.dataset.selectTool && this.canAssignRecycler()) {
                this.selectedTool = button.dataset.selectTool;
                this.renderSlot();
            }
            if (button.hasAttribute("data-assign-tool") && this.selectedTool === "trash-recycler" && this.canAssignRecycler()) {
                this.selectedTool = null;
                this.onAssignTool("trash-recycler");
                this.renderSlot();
            }
            if (button.hasAttribute("data-unassign-tool") && !this.toolProcessing && this.recyclerState.built && this.activeFloor === "slot-1" && this.inspectedFloor === "slot-1") {
                this.selectedTool = null;
                this.onUnassignTool();
                this.renderSlot();
                this.element.querySelector<HTMLButtonElement>("[data-select-tool]")?.focus();
            }
            if (button.hasAttribute("data-open-leaderboard")) this.showView("leaderboard");
            if (button.hasAttribute("data-open-marketplace")) this.showView("marketplace");
            if (button.hasAttribute("data-return-tower")) this.showView("tower");
            if (button.dataset.floor) {
                const floor = this.floors.find(item => item.id === button.dataset.floor);
                if (floor) {
                    if (this.inspectedFloor !== floor.id) this.selectedTool = null;
                    this.inspectedFloor = floor.id;
                    this.setActiveFloor(floor.id);
                    this.onFloorSelect(floor);
                }
            }
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

    setToolProcessing(processing: boolean): void {
        this.toolProcessing = processing;
        const button = this.element.querySelector<HTMLButtonElement>("[data-unassign-tool]")!;
        button.disabled = processing;
        button.textContent = processing ? "Processing… Unassign unavailable" : "Unassign tool";
        button.setAttribute("aria-busy", String(processing));
    }

    private canAssignRecycler(): boolean {
        return this.recyclerState.established && !this.recyclerState.built &&
            this.inspectedFloor === "slot-1" && this.activeFloor === "slot-1";
    }

    private renderSlot(): void {
        const state = this.recyclerState;
        const floor = this.floors.find(f => f.id === this.activeFloor);
        const inspected = !!floor && this.inspectedFloor === floor.id;
        const installed = inspected && floor.id === "slot-1" && state.built;
        const empty = inspected && state.established && floor.level > 0 && !installed;
        const available = this.canAssignRecycler();
        this.element.querySelector<HTMLElement>(".wm-recycling-meter")!.hidden = !installed;
        this.element.querySelector<HTMLElement>(".wm-tool-list")!.hidden = !empty;
        this.element.querySelector<HTMLElement>(".wm-installed-tool")!.hidden = !installed;
        this.element.querySelector<HTMLButtonElement>("[data-unassign-tool]")!.hidden = !installed;
        const option = this.element.querySelector<HTMLButtonElement>("[data-select-tool]")!;
        option.disabled = !available;
        option.setAttribute("aria-pressed", String(available && this.selectedTool === "trash-recycler"));
        option.querySelector("small")!.textContent = available ? "Reclaim rent from unused accounts" : state.built ? "Already assigned to level 1" : "Compatible with level 1 · Dumpster";
        const assign = this.element.querySelector<HTMLButtonElement>("[data-assign-tool]")!;
        assign.hidden = !empty;
        assign.disabled = !available || this.selectedTool !== "trash-recycler";
        this.element.querySelector("[data-slot-title]")!.textContent = inspected
            ? `Level ${floor.level}${floor.level === 1 ? " · Dumpster" : " · Empty level"}` : "Select a level";
        this.element.querySelector("[data-recycler-status]")!.textContent = !state.established
            ? "Establish your business to unlock level 1."
            : !inspected ? "Select a level in the tower to manage its tools."
            : installed ? (state.recycled >= state.target ? "Level 2 unlocked." : "Trash Recycler installed · Drag trash into level 1 to recycle.")
            : available ? "Choose a tool to install in this level. Any recycling progress is kept when a tool is unassigned."
            : "No unassigned tools available for this level yet.";
    }

    setBusiness(business: BusinessPreview): void {
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
        for (const floor of this.floors) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "wm-tower-floor";
            button.dataset.floor = floor.id;
            button.style.bottom = `${Math.max(0, floor.level - 1) * 25 + 4}%`;
            const number = document.createElement("span"); number.className = "wm-floor-number";
            number.textContent = floor.level === 0 ? "G" : String(floor.level).padStart(2, "0");
            const label = document.createElement("strong"); label.textContent = floor.name;
            const windows = document.createElement("span"); windows.className = "wm-floor-windows"; windows.setAttribute("aria-hidden", "true");
            button.append(number, label, windows);
            stack.append(button);
        }
        this.element.querySelector<HTMLElement>("[data-locked-two]")!.hidden = this.floors.some(f => f.level >= 2);
        const count = this.floors.filter(floor => floor.level > 0).length;
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
