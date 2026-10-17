import "./command-panel.css";
import { CorporateTreasury, TreasurySnapshot } from "./CorporateTreasury";
import { BusinessPreview } from "../business/BusinessPreview";
import "./retro-neon.css";
import { MobileCommandPanel } from "./MobileCommandPanel";


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
    private mobile?: MobileCommandPanel;
    private onTrashDelivery: () => void = () => {};
    setTrashDelivery(visible: boolean, busy: boolean, action: () => void, message = ""): void {
        this.onTrashDelivery = action;
        const button = this.element.querySelector<HTMLButtonElement>("[data-trash-delivery]")!;
        button.hidden = !visible;
        button.disabled = busy;
        button.textContent = "Trash Delivery";
        this.element.querySelector<HTMLElement>("[data-delivery-status]")!.textContent = message;
        this.syncMobile();
    }
    private readonly shell = ensureGameShell();
    private readonly element = document.createElement("aside");
    private readonly abort = new AbortController();
    private readonly treasury: CorporateTreasury;
    private floors: TowerFloor[] = [];
    private treasurySnapshot: TreasurySnapshot | null = null;
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
    private recyclerState = { established: false, built: false, recycled: 0, target: 5 };

    constructor(business: BusinessPreview | null = null, private readonly onFloorSelect: (floor: TowerFloor) => void = () => {}, private readonly onAssignTool: (toolId: string) => void = () => {}, private readonly onView: (action: string) => void = () => {}, private readonly onUnassignTool: () => void = () => {}, private readonly onStakeNextLevel: () => void = () => {}) {
        this.element.className = "wm-command";
        this.element.dataset.uiVersion = "retro-neon-v1";
        this.element.setAttribute("aria-label", "Waste Management command panel");
        this.element.innerHTML = `<div class="wm-console-body">
            <header class="wm-brand-header"><img src="/assets/ui/wm-retro-neon/brand-header.png" alt="WM — Institutional Gorbage"></header>
            <header class="wm-company-header">
                <div class="wm-company-logo-frame"><img class="wm-business-logo" alt="Player brand symbol" hidden><span class="wm-logo-placeholder" aria-hidden="true">◇</span></div>
                <strong class="wm-business-name">Establish your business</strong>
            </header>
            <div class="wm-rewards-row"><button type="button" disabled title="Revenue claims are not connected yet">Claim rewards</button><button type="button" data-open-treasury aria-expanded="false">Corporate Treasury</button></div>
            <div class="wm-market-row" aria-label="Corporation balances">
                <div class="wm-market-cell"><span class="wm-data-label">STAKED WM</span><strong data-staked>— WM</strong><small data-stake-mode></small></div>
                <div class="wm-market-cell"><span class="wm-data-label">TREASURY GOR</span><strong data-treasury-gor>— GOR</strong></div>
                <div class="wm-market-cell wm-net-value"><span class="wm-data-label">CORPORATION NET VALUE</span><strong data-net-value>— GOR</strong></div>
            </div>
            <div class="wm-rank-row"><div><span class="wm-data-label">RANK</span><strong data-rank>—</strong></div><nav class="wm-rank-links" aria-label="Business links"><button type="button" class="wm-leaderboard-link" data-open-leaderboard aria-expanded="false">Leaderboard</button><button type="button" class="wm-leaderboard-link" data-open-marketplace aria-expanded="false">Marketplace</button></nav></div>
            <section class="wm-tower" aria-label="Tower floor navigation">
                <div class="wm-tower-heading"><span>YOUR TOWER</span><span data-floor-count>THE ALLEY</span></div>
                <div class="wm-level-expansion">
                    <button type="button" data-stake-next-level disabled aria-describedby="wm-unlock-help">Unlock New Floor</button>
                    <p id="wm-unlock-help" data-unlock-help>Complete the previous floor requirements.</p>
                </div>
                <div class="wm-tower-window">

                    <div class="wm-floor-stack"></div>
                    <div class="wm-tower-ground" aria-hidden="true"></div>
                </div>
                <div class="wm-level-details">
                <div class="wm-recycling-meter" hidden><div><strong>ACCOUNTS RECYCLED</strong><span data-recycle-count>0 / 5</span></div><progress data-recycle-meter max="5" value="0" aria-label="Accounts recycled"></progress></div>
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
                    <button type="button" data-trash-delivery hidden>Trash Delivery</button>
                    <button type="button" data-unassign-tool hidden style="margin-top:12px">Unassign</button>
                    <button type="button" data-assign-tool disabled hidden>Assign</button>
                    <small data-delivery-status role="status" aria-live="polite"></small>
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
        </div>`;
        this.shell.classList.add("wm-in-game");
        this.shell.append(this.element);
        this.treasury = new CorporateTreasury(() => this.closeTreasury());
        this.element.append(this.treasury.element);
        this.mobile = new MobileCommandPanel((action, id) => {
            const click = (selector: string) => this.element.querySelector<HTMLButtonElement>(selector)?.click();
            if (action === "focus") this.onView(this.floorToolId() === "sovereign" ? "focus-sovereign" : "focus-recycler");
            if (action === "restore") this.onView("restore-tool");
            if (action === "treasury") click("[data-open-treasury]");
            if (action === "close-treasury") { delete this.element.dataset.corporateOpen; this.treasury.element.hidden = true; }
            if (action === "delivery") { this.onView("delivery-view"); click("[data-trash-delivery]"); }
            if (action === "unassign") click("[data-unassign-tool]");
            if (action === "assign") { click("[data-select-tool]"); click("[data-assign-tool]"); }
            if (action === "unlock") click("[data-stake-next-level]");
            if (action === "floor" && !this.toolProcessing) {
                const floor = this.floors.find(f => f.id === id);
                if (floor) { this.selectedTool = null; this.setActiveFloor(floor.id); this.onFloorSelect(floor); }
            }
        });
        this.element.append(this.mobile.element);
        if (business) this.setBusiness(business);
        this.element.addEventListener("click", event => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
            if (!button || button.disabled) return;
            if (button.hasAttribute("data-trash-delivery")) this.onTrashDelivery();
            if (button.hasAttribute("data-open-treasury")) {
                this.element.dataset.corporateOpen = "true";
                button.setAttribute("aria-expanded", "true");
                this.treasury.show();
            }
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
        this.treasury.setPreviewStake(established ? this.expansionUnlocked ? "200000" : "100000" : null);
        this.renderBalances();
        this.renderExpansion();
        this.element.querySelector("[data-recycle-count]")!.textContent = `${recycled} / ${target}`;
        const meter = this.element.querySelector<HTMLProgressElement>("[data-recycle-meter]")!;
        meter.max = target; meter.value = recycled;
        this.element.querySelector<HTMLElement>(".wm-tower-window")!.dataset.built = String(built);
        this.renderSlot();
    }

    setExpansion(eligible: boolean, unlocked: boolean): void {
        this.expansionEligible = eligible;
        this.expansionUnlocked = unlocked;
        this.treasury.setPreviewStake(this.recyclerState.established ? unlocked ? "200000" : "100000" : null);
        this.renderBalances();
        this.renderExpansion();
        this.element.querySelector<HTMLButtonElement>("[data-stake-next-level]")!.disabled = this.toolProcessing || !eligible || unlocked;
        this.renderSlot();
    }

    setToolProcessing(processing: boolean): void {
        this.toolProcessing = processing;
        this.element.querySelector<HTMLButtonElement>("[data-stake-next-level]")!.disabled = processing || !this.expansionEligible || this.expansionUnlocked;
        const button = this.element.querySelector<HTMLButtonElement>("[data-unassign-tool]")!;
        button.disabled = processing;
        button.textContent = "Unassign";
        this.renderExpansion();
        this.element.querySelectorAll<HTMLButtonElement>("[data-floor]").forEach(b => b.disabled = processing);
        this.renderSlot();
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
        const toolArt = sovereign ? "/assets/backgrounds/wm-level-1-sovereign.png" : "/assets/gameplay/trash-recycler.png";
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
        const optionArt = option.querySelector<HTMLImageElement>("img")!;
        optionArt.src = toolArt;
        optionArt.alt = `${toolName} machine`;
        option.querySelector("small")!.textContent = sovereign ? "Private single-sided token liquidity" : "Reclaim rent from unused accounts";
        const card = this.element.querySelector<HTMLElement>(".wm-installed-tool")!;
        const art = card.querySelector<HTMLImageElement>("img")!;
        art.src = toolArt; art.alt = `${toolName} machine`;
        for (const image of [optionArt, art]) {
            image.style.objectFit = sovereign ? "cover" : "contain";
            image.style.objectPosition = sovereign ? "72% center" : "center";
        }
        card.querySelector("strong")!.textContent = toolName;
        card.querySelector("span")!.textContent = `Installed in level ${sovereign ? 1 : 0}`;
        const assign = this.element.querySelector<HTMLButtonElement>("[data-assign-tool]")!;
        assign.hidden = !empty;
        assign.disabled = !available || this.selectedTool !== toolId;
        const title = this.element.querySelector<HTMLButtonElement>("[data-slot-title]")!;
        title.textContent = inspected ? this.floorNames[floor.id] || (floor.level === 0 ? "Dumpster" : floor.name) : "Select a level";
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
        this.syncMobile();
    }

    private syncMobile(): void {
        if (!this.mobile) return;
        const text = (selector: string) => this.element.querySelector(selector)?.textContent ?? "";
        const delivery = this.element.querySelector<HTMLButtonElement>("[data-trash-delivery]");
        const sovereign = this.floorToolId() === "sovereign";
        this.mobile.update({
            name: text(".wm-business-name"), logo: this.element.querySelector<HTMLImageElement>(".wm-business-logo")?.getAttribute("src") || "",
            floors: this.floors.filter(f=>f.level>=0).map(f=>({id:f.id,label:`${f.level} · ${this.floorNames[f.id] || (f.level===0 ? "Dumpster" : f.name)}`})),
            activeFloor:this.activeFloor || "", tool:sovereign ? "Sovereign" : "Trash Recycler",
            art:sovereign ? "/assets/backgrounds/wm-level-1-sovereign.png" : "/assets/gameplay/trash-recycler.png",
            installed:this.installedOnActiveFloor(), busy:this.toolProcessing, canAssign:this.canAssignTool(),
            unlock:this.recyclerState.established && this.expansionEligible && !this.expansionUnlocked,
            unlockHelp:text("[data-unlock-help]"), deliveryVisible:!!delivery && !delivery.hidden,
            deliveryBusy:!!delivery?.disabled, deliveryMessage:text("[data-delivery-status]"), status:text("[data-recycler-status]"),
            netValue:text("[data-net-value]"),rank:text("[data-rank]")
        });
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
        this.syncMobile();
    }

    /** Legacy overview remains compatible; wallet balances are never treasury balances. */
    setOverview(data: PanelOverview): void {
        const rank = data.rank;
        this.element.querySelector("[data-rank]")!.textContent = rank !== null && Number.isInteger(rank) && rank > 0 ? `#${rank.toLocaleString("en-US")}` : "—";
        this.syncMobile();
    }

    private renderBalances(): void {
        const format = (value: string | null | undefined, unit: string) => {
            if (value == null || !/^\d+(\.\d+)?$/.test(value)) return `— ${unit}`;
            const [whole, fraction] = value.split(".");
            return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? "." + fraction : "") + ` ${unit}`;
        };
        const snapshot = this.treasurySnapshot;
        const preview = !snapshot && this.recyclerState.established;
        this.element.querySelector("[data-staked]")!.textContent = format(snapshot ? snapshot.stakedWM : preview ? this.expansionUnlocked ? "200000" : "100000" : null, "WM");
        this.element.querySelector("[data-stake-mode]")!.textContent = preview ? "SIMULATED STAKE" : "";
        this.element.querySelector("[data-treasury-gor]")!.textContent = format(snapshot?.assets.find(a => a.id === "GOR")?.corporateBalance, "GOR");
        this.element.querySelector("[data-net-value]")!.textContent = format(snapshot?.netValueGOR, "GOR");
        this.syncMobile();
    }

    private renderExpansion(): void {
        const button = this.element.querySelector<HTMLButtonElement>("[data-stake-next-level]")!;
        button.disabled = this.toolProcessing || !this.recyclerState.established || !this.expansionEligible || this.expansionUnlocked;
        const state = this.recyclerState;
        this.element.querySelector("[data-unlock-help]")!.textContent = this.expansionUnlocked
            ? "Level 1 unlocked. Requirements for the next floor are not available yet."
            : !state.established ? "Establish your business to unlock the Dumpster."
            : this.expansionEligible ? "Requirements met · Stake another 100,000 WM to unlock Level 1. Simulated; no WM moves."
            : `Recycle ${state.target} accounts in the Dumpster to unlock Level 1 (${state.recycled}/${state.target}). Then stake another 100,000 WM in this preview.`;
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
        for (const floor of this.floors.filter(f => f.level >= 0)) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "wm-tower-floor";
            button.disabled = this.toolProcessing;
            button.dataset.floor = floor.id;
            const number = document.createElement("span");
            number.className = "wm-floor-number"; number.textContent = String(floor.level);
            const label = document.createElement("strong");
            label.textContent = this.floorNames[floor.id] || (floor.level === 0 ? "Dumpster" : floor.name);
            button.setAttribute("aria-label", `${label.textContent}, unlocked`);
            button.append(number, label); stack.append(button);
        }
        const count = this.floors.filter(floor => floor.level >= 0).length;
        this.element.querySelector("[data-floor-count]")!.textContent = count ? `${count} FLOOR${count === 1 ? "" : "S"}` : "THE ALLEY";
        this.setActiveFloor(this.floors.some(floor => floor.id === selectedId) ? selectedId! : this.floors[this.floors.length - 1]?.id ?? "");
    }

    setActiveFloor(id: string): void {
        this.activeFloor = id;
        this.inspectedFloor = id;
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

    /** Feed only verified treasury balances; wallet balances stay separate. */
    setTreasury(data: TreasurySnapshot): void {
        this.treasurySnapshot = data;
        this.treasury.setData(data);
        this.renderBalances();
    }

    private closeTreasury(): void {
        if (this.mobile?.active) this.mobile.home();
        delete this.element.dataset.corporateOpen;
        this.treasury.element.hidden = true;
        const button = this.element.querySelector<HTMLButtonElement>("[data-open-treasury]")!;
        button.setAttribute("aria-expanded", "false");
        button.focus();
    }

    destroy(): void {
        this.mobile?.destroy();
        this.treasury.destroy();
        this.abort.abort();
        this.element.remove();
        this.shell.classList.remove("wm-in-game");
    }
}
