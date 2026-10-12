
// You can write more code here

/* START OF COMPILED CODE */

import Phaser from "phaser";
/* START-USER-IMPORTS */
import { CommandPanel, ensureGameShell } from "../ui/CommandPanel";
import { BusinessSetup } from "../ui/BusinessSetup";
import { RecyclerProgress } from "../gameplay/RecyclerPreview";
import { RecyclerWorld } from "../gameplay/RecyclerWorld";
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
        const background = this.add.image(0, 0, "wm-starting-alley-branded", "__BASE");
        // Fixed world coordinates keep props anchored to the artwork during zoom/resize.
        const worldWidth = 1670, worldHeight = 942;
        background?.setOrigin(0).setPosition(0, 0).setDisplaySize(worldWidth, worldHeight);
        const camera = this.cameras.main;
        camera.setBackgroundColor("#101815");
        let zoomFactor = 1;
        let fitWholeAlley = false;
        let centreX = worldWidth / 2, centreY = worldHeight / 2;
        const applyCamera = () => {
            const base = (fitWholeAlley ? Math.min : Math.max)(this.scale.width / worldWidth, this.scale.height / worldHeight);
            const zoom = base * zoomFactor;
            camera.setZoom(zoom);
            const halfW = this.scale.width / (2 * zoom), halfH = this.scale.height / (2 * zoom);
            const x = halfW >= worldWidth / 2 ? worldWidth / 2 : Phaser.Math.Clamp(centreX, halfW, worldWidth - halfW);
            const y = halfH >= worldHeight / 2 ? worldHeight / 2 : Phaser.Math.Clamp(centreY, halfH, worldHeight - halfH);
            camera.centerOn(x, y);
            panel.setCameraZoom(zoomFactor);
        };
        const changeView = (action: string) => {
            if (action === "all") { fitWholeAlley = true; zoomFactor = 1; centreX = worldWidth / 2; centreY = worldHeight / 2; }
            if (action === "recycler") { fitWholeAlley = false; zoomFactor = 1.3; centreX = worldWidth * .40; centreY = worldHeight * .70; }
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
            const backgroundKey = selectedLevel === 1 ? (progress.sovereignBuilt ? "wm-level-1-sovereign" : "wm-level-1-workshop") : progress.built ? "wm-alley-recycler-upgraded" : progress.established ? "wm-alley-recycler-installed" : "wm-starting-alley-branded";
            if (background && this.textures.exists(backgroundKey)) {
                background.setTexture(backgroundKey, "__BASE").setDisplaySize(worldWidth, worldHeight);
            }
            recycler?.setActive(selectedLevel === 0);
            panel.setSovereign(progress.sovereignBuilt);
            panel.setToolProcessing(recycler?.isProcessing ?? false);
            panel.setExpansion(progress.nextLevelEligible, progress.nextLevelUnlocked);
            panel.setRecycler(progress.established, progress.built, progress.recycled.size, progress.nextLevelAccountRequirement);
            const floors = [{ id: progress.established ? "slot-1" : "alley", name: progress.established ? "Level 0" : "The Alley", level: progress.established ? 0 : -1, x: worldWidth * .30, y: worldHeight * .72 }];
            if (progress.nextLevelUnlocked) floors.push({ id: "slot-2", name: "Level 1", level: 1, x: worldWidth * .5, y: worldHeight * .3 });
            panel.setFloors(floors);
            recycler?.refresh();
        };
        const panel = new CommandPanel(business, floor => {
            if (recycler?.isProcessing) return;
            selectedLevel = floor.level === 1 ? 1 : 0;
            zoomFactor = 1; centreX = worldWidth / 2; centreY = worldHeight / 2;
            fitWholeAlley = false;
            updateRecycler(); applyCamera();
        }, toolId => {
            if (recycler?.isProcessing) return;
            const assigned = selectedLevel === 1 && toolId === "sovereign"
                ? progress.assignSovereign()
                : selectedLevel === 0 && toolId === "trash-recycler" && progress.assignTool(toolId);
            if (assigned) { updateRecycler(); applyCamera(); }
        }, changeView, () => {
            if (recycler?.isProcessing) return;
            const removed = selectedLevel === 1 ? progress.unassignSovereign() : progress.unassignTool();
            if (removed) updateRecycler();
        }, () => {
            if (recycler?.isProcessing) return;
            if (progress.simulateNextLevelStake()) updateRecycler();
        });
        recycler = new RecyclerWorld(this, progress, updateRecycler);
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

        const host = ensureGameShell().querySelector<HTMLElement>("#game-container")!;
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
        fit();

        const wheel = (pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
            if (!pointer.isDown && dy !== 0) changeView(dy > 0 ? "out" : "in");
        };
        this.input.on("wheel", wheel);

        // Editor-generated objects stay in editorCreate; runtime layout stays here.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.off("wheel", wheel);
            observer.disconnect();
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
