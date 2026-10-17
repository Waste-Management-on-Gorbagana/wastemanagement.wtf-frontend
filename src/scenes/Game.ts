
// You can write more code here

/* START OF COMPILED CODE */

import Phaser from "phaser";
/* START-USER-IMPORTS */
import { CommandPanel, ensureGameShell } from "../ui/CommandPanel";
import { BusinessSetup } from "../ui/BusinessSetup";
import { RecyclerProgress } from "../gameplay/RecyclerPreview";
import { RecyclerWorld } from "../gameplay/RecyclerWorld";
import { LEVEL0, Level0Media, level0Key, utcPhase, TimeOfDay } from "../gameplay/Level0Media";
import { recoveryProvider, validTrash, RecoverableTrash } from "../gameplay/RecoverySource";
import { loadBusinessPreview } from "../business/BusinessPreview";
/* END-USER-IMPORTS */

export default class Game extends Phaser.Scene {

	constructor() {
		super("Game");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// World artwork is created at runtime after preload.

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

    preload(): void {
        for (const installed of [false, true]) for (const phase of ["day", "night"] as TimeOfDay[]) {
            const key = level0Key(installed, phase);
            if (!this.textures.exists(key)) this.load.image(key, LEVEL0.assetRoot + key + ".png");
        }
        for (const key of ["wm-level-1-workshop", "wm-level-1-sovereign"]) {
            if (!this.textures.exists(key)) this.load.image(key, `assets/backgrounds/${key}.png`);
        }
        for (const key of ["recycler-intake", "recycler-grind", "recycler-finish"]) {
            if (!this.cache.audio.exists(key)) this.load.audio(key, "assets/audio/" + key + ".wav");
        }
        if (!this.textures.exists("wm-alley-recycler-upgraded")) {
            this.load.image("wm-alley-recycler-upgraded", "assets/backgrounds/wm-alley-recycler-upgraded.png");
        }
        if (!this.textures.exists("wm-alley-recycler-installed")) {
            this.load.image("wm-alley-recycler-installed", "assets/backgrounds/wm-alley-recycler-installed.png");
        }
        for (const key of ["trash-bag", "trash-can", "trash-carton", "trash-recycler"]) {
            if (!this.textures.exists(key)) this.load.image(key, `assets/gameplay/${key}.png`);
        }
        if (!this.textures.exists("wm-starting-alley-branded")) {
            this.load.image("wm-starting-alley-branded", "assets/backgrounds/wm-starting-alley-branded.png");
        }
    }

    create(): void {
        this.editorCreate();
        const previewPhase = new URLSearchParams(location.search).get("wmTime");
        const nowPhase = () => previewPhase === "day" || previewPhase === "night" ? previewPhase : utcPhase();
        let phase: TimeOfDay = nowPhase();
        const media = new Level0Media(this);
        let disposed = false;
        let deliveryBusy = false;
        let installationBusy = false;
        let recoveryBusy = false;
        let refreshing = false;
        let wallet: string | null = null;
        let eligible: RecoverableTrash[] = [];
        let deliveryMessage = "";
        let request = new AbortController();
        const background = this.add.image(0, 0, level0Key(false, phase), "__BASE");
        // Fixed world coordinates keep props anchored to the artwork during zoom/resize.
        const worldWidth = 1670, worldHeight = 942;
        background?.setOrigin(0).setPosition(0, 0).setDisplaySize(worldWidth, worldHeight);
        const camera = this.cameras.main;
        camera.setBackgroundColor("#101815");
        let zoomFactor = 1;
        // Decorative underlay is separate from the interactive world camera.
        const host = ensureGameShell().querySelector<HTMLElement>("#game-container")!;
        const backdrop = document.createElement("div");
        backdrop.setAttribute("aria-hidden", "true");
        Object.assign(backdrop.style, {
            position: "absolute", inset: "-12px", pointerEvents: "none",
            backgroundPosition: "center", backgroundSize: "cover",
            filter: "blur(8px) brightness(0.6)", zIndex: "0"
        });
        host.prepend(backdrop);
        const deliveryBacking = document.createElement("div");
        deliveryBacking.setAttribute("aria-hidden", "true");
        Object.assign(deliveryBacking.style, {
            position:"absolute", inset:"0", pointerEvents:"none", zIndex:"0", display:"none",
            background:"repeating-linear-gradient(0deg,transparent 0 3px,#d2b17a09 3px 4px), repeating-linear-gradient(117deg,transparent 0 9px,#bd86521a 9px 10px,transparent 10px 19px), linear-gradient(110deg,#4d4433,#1e352c 24%,#30463a 55%,#21372e 82%,#54432e)"
        });
        backdrop.after(deliveryBacking);
        const deliveryFrame = { amount: 0 };
        let framingMode: "delivery" | "processing" = "delivery";
        const canvas = this.game.canvas;
        const originalClip = canvas.style.clipPath;
        const originalPosition = canvas.style.position;
        const originalZ = canvas.style.zIndex;
        canvas.style.position = "relative";
        canvas.style.zIndex = "1";
        let centreX = worldWidth / 2, centreY = worldHeight / 2;
        const applyCamera = () => {
            const hostRect = host.getBoundingClientRect();
            const panelRect = ensureGameShell().querySelector<HTMLElement>(".wm-command")?.getBoundingClientRect();
            const cssWidth = Math.max(1, hostRect.width);
            // Continue the crisp scene under the opaque inner frame, past the
            // PNG's transparent left gutter, so no blurred seam sits beside it.
            const brandRect = ensureGameShell().querySelector<HTMLElement>(".wm-brand-header")?.getBoundingClientRect();
            const solidEdge = brandRect && brandRect.width > 0 ? brandRect.left : undefined;
            const stacked = getComputedStyle(host).getPropertyValue("--wm-stacked-layout").trim() == "1";
            const rightEdge = !stacked && panelRect
                ? (solidEdge ?? panelRect.left + panelRect.width * 0.16) + 8
                : hostRect.right;
            const clearWidth = Math.max(1, Math.min(cssWidth, rightEdge - hostRect.left));
            const availableWidth = this.scale.width * clearWidth / cssWidth;
            const base = Math.max(availableWidth / worldWidth, this.scale.height / worldHeight);
            const viewWidth = availableWidth;
            const viewHeight = this.scale.height;
            const viewX = 0;
            const viewY = 0;
            camera.setViewport(viewX, viewY, viewWidth, viewHeight);
            // Hide the renderer's empty margins, revealing the decorative underlay.
            canvas.style.clipPath = `inset(${viewY / this.scale.height * 100}% ${(this.scale.width - viewX - viewWidth) / this.scale.width * 100}% ${(this.scale.height - viewY - viewHeight) / this.scale.height * 100}% ${viewX / this.scale.width * 100}%)`;
            const amount = stacked ? deliveryFrame.amount : 0;
            deliveryBacking.style.display = amount > 0 ? "block" : "none";
            const contain = framingMode === "processing"
                ? Math.min(viewWidth / (worldWidth * .43), viewHeight / (worldHeight * .69))
                : Math.min(viewWidth / worldWidth, viewHeight / worldHeight);
            const zoom = Phaser.Math.Linear(base * zoomFactor, contain, amount);
            camera.setZoom(zoom);
            const halfW = viewWidth / (2 * zoom), halfH = viewHeight / (2 * zoom);
            const x = halfW >= worldWidth / 2 ? worldWidth / 2 : Phaser.Math.Clamp(centreX, halfW, worldWidth - halfW);
            const y = halfH >= worldHeight / 2 ? worldHeight / 2 : Phaser.Math.Clamp(centreY, halfH, worldHeight - halfH);
            const targetHalfW = viewWidth / (2 * contain), targetHalfH = viewHeight / (2 * contain);
            const targetX = framingMode === "processing" ? worldWidth * .215 : worldWidth / 2;
            const targetY = framingMode === "processing" ? worldHeight * .575 : worldHeight / 2;
            const safeX = targetHalfW >= worldWidth / 2 ? worldWidth / 2 : Phaser.Math.Clamp(targetX, targetHalfW, worldWidth - targetHalfW);
            const safeY = targetHalfH >= worldHeight / 2 ? worldHeight / 2 : Phaser.Math.Clamp(targetY, targetHalfH, worldHeight - targetHalfH);
            const actualX = Phaser.Math.Linear(x, safeX, amount);
            const actualY = Phaser.Math.Linear(y, safeY, amount);
            camera.centerOn(actualX, actualY);
            if (amount > 0) {
                // Project the actual world edges; expose metal wherever the shot
                // is smaller than the viewing area, including during the tween.
                const left = Math.max(viewX, viewX + viewWidth / 2 - actualX * zoom);
                const top = Math.max(viewY, viewY + viewHeight / 2 - actualY * zoom);
                const right = Math.min(viewX + viewWidth, viewX + viewWidth / 2 + (worldWidth - actualX) * zoom);
                const bottom = Math.min(viewY + viewHeight, viewY + viewHeight / 2 + (worldHeight - actualY) * zoom);
                canvas.style.clipPath = `inset(${top / this.scale.height * 100}% ${(this.scale.width - right) / this.scale.width * 100}% ${(this.scale.height - bottom) / this.scale.height * 100}% ${left / this.scale.width * 100}%)`;
            }
            panel.setCameraZoom(zoomFactor);
        };
        let savedToolView: { zoom: number; x: number; y: number } | undefined;
        let focusTween: Phaser.Tweens.Tween | undefined;
        const frameDelivery = (amount: number, mode: "delivery" | "processing" = framingMode): Promise<void> => {
            framingMode = mode;
            focusTween?.stop();
            if (getComputedStyle(host).getPropertyValue("--wm-stacked-layout").trim() !== "1") {
                deliveryFrame.amount = amount; applyCamera(); return Promise.resolve();
            }
            return new Promise(resolve => {
                this.tweens.add({ targets: deliveryFrame, amount,
                    duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
                    ease:'Sine.easeInOut', onUpdate:applyCamera,
                    onComplete:() => { applyCamera(); resolve(); }, onStop:() => resolve()
                });
            });
        };
        const changeView = (action: string) => {
            // Keep the complete delivery shot visible even if a tab or wheel is used.
            if (deliveryFrame.amount > 0) return;
            if (action.startsWith("focus-") || action === "restore-tool") {
                focusTween?.stop();
                if (action.startsWith("focus-") && !savedToolView) savedToolView = { zoom: zoomFactor, x: centreX, y: centreY };
                const target = action === "restore-tool" ? savedToolView : action === "focus-sovereign"
                    ? { zoom: 1.25, x: worldWidth * .68, y: worldHeight * .60 }
                    : { zoom: 1.15, x: worldWidth * .30, y: worldHeight * .65 };
                if (action === "restore-tool") savedToolView = undefined;
                if (!target) return;
                const start = { zoom: zoomFactor, x: centreX, y: centreY };
                focusTween = this.tweens.add({ targets: start, ...target,
                    duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
                    ease: 'Sine.easeInOut', onUpdate: () => {
                        zoomFactor = start.zoom; centreX = start.x; centreY = start.y; applyCamera();
                    }
                });
                return;
            }
            focusTween?.stop();
            if (action === "delivery-view") { zoomFactor = 1; centreX = worldWidth * .44; centreY = worldHeight / 2; }
            if (action === "all") { zoomFactor = 1; centreX = worldWidth / 2; centreY = worldHeight / 2; }
            if (action === "recycler") { zoomFactor = 1.3; centreX = worldWidth * .40; centreY = worldHeight * .70; }
            if (action === "in") zoomFactor = Math.min(3, zoomFactor + .2);
            if (action === "out") zoomFactor = Math.max(1, zoomFactor - .2);
            applyCamera();
        };
        // Preview lookup only: no claim of wallet ownership is made here.
        let business = loadBusinessPreview();
        let setup: BusinessSetup | undefined;
        let restoreSetupInput = () => {};
        const progress = new RecyclerProgress();
        if (business?.logoDataUrl) progress.establish();
        let recycler: RecyclerWorld | undefined;
        let selectedLevel = 0;
        const updateRecycler = () => {
            const backgroundKey = selectedLevel === 1 ? (progress.sovereignBuilt ? "wm-level-1-sovereign" : "wm-level-1-workshop") : level0Key(progress.built, phase);
            backdrop.style.backgroundImage = `url("${selectedLevel === 0 ? LEVEL0.assetRoot : "assets/backgrounds/"}${backgroundKey}.png")`;
            if (background && this.textures.exists(backgroundKey)) {
                background.setTexture(backgroundKey, "__BASE").setDisplaySize(worldWidth, worldHeight);
            }
            recycler?.setPaused(media.busy || installationBusy || deliveryBusy);
            recycler?.setActive(selectedLevel === 0 && !installationBusy && !deliveryBusy);
            panel.setSovereign(progress.sovereignBuilt);
            panel.setToolProcessing(!!recycler?.isProcessing || media.busy || installationBusy || deliveryBusy || recoveryBusy);
            panel.setTrashDelivery(selectedLevel === 0 && progress.built,
                media.busy || installationBusy || deliveryBusy || recoveryBusy || !!recycler?.isProcessing,
                () => { void deliver(); }, deliveryMessage || (wallet === "SESSION-PREVIEW" ? "Test mode · No tokens move or rent is recovered." : ""));
            panel.setExpansion(progress.nextLevelEligible, progress.nextLevelUnlocked);
            panel.setRecycler(progress.established, progress.built, progress.recycled.size, progress.nextLevelAccountRequirement);
            const floors = [{ id: progress.established ? "slot-1" : "alley", name: progress.established ? "Level 0" : "The Alley", level: progress.established ? 0 : -1, x: worldWidth * .30, y: worldHeight * .72 }];
            if (progress.nextLevelUnlocked) floors.push({ id: "slot-2", name: "Level 1", level: 1, x: worldWidth * .5, y: worldHeight * .3 });
            panel.setFloors(floors);
            recycler?.refresh();
        };
        const installRecycler = async (): Promise<void> => {
            if (disposed || installationBusy || media.busy || deliveryBusy || recoveryBusy || recycler?.isProcessing || selectedLevel !== 0 || !progress.established || progress.built) return;
            installationBusy = true;
            deliveryMessage = "Gorweld is installing the Trash Recycler…";
            // Do not assign yet: retain the plain dumpster beneath the video.
            const playing = media.play(`install-${phase}.mp4`, true);
            updateRecycler();
            const completed = await playing;
            if (disposed) return;
            installationBusy = false;
            if (completed && selectedLevel === 0 && progress.assignTool("trash-recycler")) {
                deliveryMessage = "Trash Recycler installed. Ready for Trash Delivery.";
            } else {
                deliveryMessage = "Installation interrupted. Press Assign to try again.";
            }
            updateRecycler(); applyCamera();
        };
        const panel = new CommandPanel(business, floor => {
            if (recycler?.isProcessing || media.busy || installationBusy || deliveryBusy || recoveryBusy) return;
            focusTween?.stop(); savedToolView = undefined;
            selectedLevel = floor.level === 1 ? 1 : 0;
            zoomFactor = 1; centreX = worldWidth / 2; centreY = worldHeight / 2;
            updateRecycler(); applyCamera();
        }, toolId => {
            if (recycler?.isProcessing || media.busy || installationBusy || deliveryBusy || recoveryBusy) return;
            if (selectedLevel === 0 && toolId === "trash-recycler") {
                void installRecycler();
                return;
            }
            if (selectedLevel === 1 && toolId === "sovereign" && progress.assignSovereign()) {
                updateRecycler(); applyCamera();
            }
        }, changeView, () => {
            if (recycler?.isProcessing || media.busy || installationBusy || deliveryBusy || recoveryBusy) return;
            const removed = selectedLevel === 1 ? progress.unassignSovereign() : progress.unassignTool();
            if (removed) updateRecycler();
        }, () => {
            if (recycler?.isProcessing || media.busy || installationBusy || deliveryBusy || recoveryBusy) return;
            if (progress.simulateNextLevelStake()) updateRecycler();
        });
        const refreshRecovery = async (): Promise<void> => {
            if (refreshing || disposed) return;
            refreshing = true;
            const provider = recoveryProvider();
            const identity = provider?.walletId() ?? null;
            if (wallet !== identity) {
                request.abort(); request = new AbortController();
                wallet = identity; eligible = []; recycler?.setItems([]); media.cancel();
                deliveryMessage = "";
            }
            try {
                const items = identity && provider ? await provider.list(request.signal) : [];
                if (disposed || provider !== recoveryProvider() || identity !== provider?.walletId()) return;
                eligible = validTrash(items);
                if (!recycler?.isProcessing) {
                    const delivered = recycler?.pendingIds ?? new Set<string>();
                    recycler?.setItems(eligible.filter(x => delivered.has(x.id)));
                }
            } catch {
                eligible = [];
                if (!disposed) deliveryMessage = "Could not check recoverable assets. Try again shortly.";
            } finally {
                refreshing = false;
                if (!disposed) updateRecycler();
            }
        };
        const deliver = async (): Promise<void> => {
            if (deliveryBusy || recoveryBusy || media.busy || recycler?.isProcessing || selectedLevel !== 0 || !progress.built) return;
            deliveryBusy = true; deliveryMessage = "Checking delivery…"; updateRecycler();
            await refreshRecovery();
            if (disposed) return;
            const identity = wallet;
            const pending = recycler?.pendingIds ?? new Set<string>();
            const newItems = eligible.filter(x => !pending.has(x.id));
            const batch = (newItems.length || identity !== "SESSION-PREVIEW" ? newItems : eligible).slice(0, 10);
            if (!batch.length || !identity) { deliveryBusy = false; deliveryMessage = "No recoverable trash available."; updateRecycler(); return; }
            deliveryMessage = "Trash delivery arriving…";
            updateRecycler();
            await frameDelivery(1, "delivery");
            if (disposed) return;
            const playing = media.play(`delivery-${phase}.mp4`, true);
            updateRecycler();
            const success = await playing;
            if (disposed) return;
            // Return to the collection view only after the complete clip has ended.
            zoomFactor = 1; centreX = worldWidth * .44; centreY = worldHeight / 2;
            await frameDelivery(0);
            if (disposed) return;
            deliveryBusy = false;
            if (success && recoveryProvider()?.walletId() === identity && progress.built) {
                // Current full-frame clips have no alpha matte. Reveal after the clip;
                // a future truck matte can reveal these same sprites during departure.
                const delivered = new Set([...pending, ...batch.map(x => x.id)]);
                recycler?.setItems(eligible.filter(x => delivered.has(x.id)));
                deliveryMessage = "Drag the delivered trash into the right-hand intake.";
            } else deliveryMessage = "Delivery could not finish. Press Trash Delivery to retry.";
            updateRecycler();
        };
        recycler = new RecyclerWorld(this, progress, updateRecycler, async item => {
            const provider = recoveryProvider(); const identity = provider?.walletId();
            if (!provider || !identity || identity !== wallet) return false;
            recoveryBusy = true; updateRecycler();
            try {
                const result = await provider.recover(item, request.signal);
                if (disposed || provider !== recoveryProvider() || provider.walletId() !== identity || !result.confirmed) return false;
                eligible = eligible.filter(x => x.id !== item.id);
                // Existing progression is session-only; never treats this as staking.
                progress.recycle(progress.recycled.size);
                deliveryMessage = identity === "SESSION-PREVIEW" ? "Preview recycled. No assets moved." : "Recovery confirmed.";
                return true;
            } catch {
                deliveryMessage = "Recovery cancelled or failed. The trash has been restored.";
                return false;
            } finally { recoveryBusy = false; if (!disposed) updateRecycler(); }
        }, async () => {
            if (disposed || !progress.built || selectedLevel !== 0) return false;
            await frameDelivery(1, "processing");
            if (disposed) return false;
            const playing = media.play(`processing-${phase}.mp4`, true);
            updateRecycler();
            const played = await playing;
            if (!disposed) {
                zoomFactor = 1; centreX = worldWidth * .44; centreY = worldHeight / 2;
                await frameDelivery(0);
                if (disposed) return played;
                if (!played) deliveryMessage = "Recovery completed, but the animation could not play.";
                updateRecycler();
            }
            return played;
        });
        void refreshRecovery();
        const recoveryTimer = window.setInterval(() => { void refreshRecovery(); }, 30000);
        const recoveryChanged = () => { void refreshRecovery(); };
        window.addEventListener("wm:recovery-changed", recoveryChanged);
        let lastTick = Date.now();
        const clockTimer = window.setInterval(() => {
            const target = nowPhase(); const elapsed = Date.now() - lastTick; lastTick = Date.now();
            if (document.hidden || disposed || target === phase || media.busy || installationBusy || deliveryBusy || recycler?.isProcessing) return;
            // On load / after a suspended tab use the correct still immediately.
            if (selectedLevel !== 0 || elapsed > 60000) { phase = target; updateRecycler(); return; }
            const file = `${progress.built ? "recycler" : "bare"}-${target === "night" ? "dusk" : "dawn"}.mp4`;
            const playing = media.play(file);
            updateRecycler();
            void playing.then(() => { if (!disposed) { phase = nowPhase(); updateRecycler(); } });
        }, 1000);
        recycler.setBrand(business?.logoDataUrl);
        updateRecycler();
        panel.setOverview({ priceUsd: null, change24hPercent: null, walletBalanceWM: null, walletConnected: false, rank: null });

        const showSetup = () => {
            if (setup) return;
            const inputWasEnabled = this.input.enabled;
            const keyboard = this.input.keyboard;
            const keyboardWasEnabled = keyboard?.enabled;
            this.input.enabled = false;
            if (keyboard) keyboard.enabled = false;
            const restoreInput = () => {
                this.input.enabled = inputWasEnabled;
                if (keyboard && keyboardWasEnabled !== undefined) keyboard.enabled = keyboardWasEnabled;
            };
            restoreSetupInput = restoreInput;
            setup = new BusinessSetup(ensureGameShell(), business, saved => {
                business = saved;
                panel.setBusiness(saved);
                recycler?.setBrand(saved.logoDataUrl);
                progress.establish();
                updateRecycler();
                setup = undefined;
                restoreInput();
            }, () => {
                setup = undefined;
                restoreInput();
                this.scene.start("Level");
            });
        };


        let pendingFrame = 0;
        const fit = () => {
            const width = Math.max(1, Math.floor(host.clientWidth));
            const height = Math.max(1, Math.floor(host.clientHeight));
            // FIT is retained for the welcome scene. In Game, use the available
            // playfield dimensions as the logical canvas dimensions.
            this.scale.setGameSize(width, height);
            this.scale.refresh();
            recycler?.layout(worldWidth, worldHeight);
            updateRecycler();
            applyCamera();
        };
        const scheduleFit = () => {
            cancelAnimationFrame(pendingFrame);
            pendingFrame = requestAnimationFrame(fit);
        };
        const observer = new ResizeObserver(scheduleFit);
        observer.observe(host);
        document.addEventListener("fullscreenchange", scheduleFit);
        window.addEventListener("resize", scheduleFit);
        const panelElement = ensureGameShell().querySelector<HTMLElement>(".wm-command");
        if (panelElement) observer.observe(panelElement);
        fit();

        const wheel = (pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
            if (!pointer.isDown && dy !== 0) changeView(dy > 0 ? "out" : "in");
        };
        this.input.on("wheel", wheel);
        let pan: { id:number; x:number; y:number } | undefined;
        const canPan = () => !disposed && !setup && !media.busy && !installationBusy && !deliveryBusy &&
            !recoveryBusy && !recycler?.isProcessing && deliveryFrame.amount === 0 &&
            getComputedStyle(host).getPropertyValue("--wm-stacked-layout").trim() === "1";
        const panStart = (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
            // Interactive trash keeps Phaser's normal drag/drop gesture.
            if (pan || !canPan() || objects.length || !pointer.isDown) { pan = undefined; return; }
            focusTween?.stop();
            centreX = camera.scrollX + camera.width / 2;
            centreY = camera.scrollY + camera.height / 2;
            pan = { id:pointer.id, x:pointer.x, y:pointer.y };
        };
        const panMove = (pointer: Phaser.Input.Pointer) => {
            if (!pan || pan.id !== pointer.id) return;
            if (!canPan() || !pointer.isDown) { pan = undefined; return; }
            const halfW = camera.width / (2 * camera.zoom), halfH = camera.height / (2 * camera.zoom);
            const x = centreX - (pointer.x - pan.x) / camera.zoom;
            const y = centreY - (pointer.y - pan.y) / camera.zoom;
            centreX = halfW >= worldWidth / 2 ? worldWidth / 2 : Phaser.Math.Clamp(x, halfW, worldWidth - halfW);
            centreY = halfH >= worldHeight / 2 ? worldHeight / 2 : Phaser.Math.Clamp(y, halfH, worldHeight - halfH);
            pan.x = pointer.x; pan.y = pointer.y; applyCamera();
        };
        const panEnd = () => { pan = undefined; };
        this.input.on("pointerdown", panStart);
        this.input.on("pointermove", panMove);
        this.input.on("pointerup", panEnd);
        this.input.on("pointerupoutside", panEnd);
        this.input.on("gameout", panEnd);

        // Editor-generated objects stay in editorCreate; runtime layout stays here.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            disposed = true; request.abort(); media.destroy();
            clearInterval(clockTimer); clearInterval(recoveryTimer);
            window.removeEventListener("wm:recovery-changed", recoveryChanged);
            this.input.off("wheel", wheel);
            this.input.off("pointerdown", panStart);
            this.input.off("pointermove", panMove);
            this.input.off("pointerup", panEnd);
            this.input.off("pointerupoutside", panEnd);
            this.input.off("gameout", panEnd);
            observer.disconnect();
            document.removeEventListener("fullscreenchange", scheduleFit);
            window.removeEventListener("resize", scheduleFit);
            backdrop.remove(); deliveryBacking.remove();
            canvas.style.clipPath = originalClip;
            canvas.style.position = originalPosition;
            canvas.style.zIndex = originalZ;
            camera.setViewport(0, 0, this.scale.width, this.scale.height);
            cancelAnimationFrame(pendingFrame);
            setup?.destroy();
            restoreSetupInput();
            setup = undefined;
            recycler?.destroy();
            panel.destroy();
            this.scale.setGameSize(1280, 720);
            this.scale.refresh();
        });
        if (!business?.logoDataUrl) showSetup();
    }

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
