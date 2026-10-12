import Phaser from "phaser";
import { RecyclerAudio } from "./RecyclerAudio";
import { RecyclerProgress } from "./RecyclerPreview";

/** Disposable illustrated objects; real rent-account discovery and transactions come later. */
export class RecyclerWorld {
    private readonly audio: RecyclerAudio;
    private readonly machine: Phaser.GameObjects.Image;
    private readonly shadow: Phaser.GameObjects.Ellipse;
    private readonly glow: Phaser.GameObjects.Ellipse;
    private readonly sparks: Phaser.GameObjects.Arc[] = [];
    private ghost?: Phaser.GameObjects.Image;
    private busy = false;
    private active = true;
    setActive(active: boolean): void {
        this.active = active;
        this.refresh();
    }
    get isProcessing(): boolean { return this.busy; }
    private machineX = 0;
    private machineY = 0;
    private readonly bin: Phaser.GameObjects.Zone;
    private readonly trash: Phaser.GameObjects.Image[] = [];
    private readonly nextSlot: Phaser.GameObjects.Rectangle;
    private readonly nextLabel: Phaser.GameObjects.Text;
    private brand?: Phaser.GameObjects.Image;
    private flagBrand?: Phaser.GameObjects.Image;
    private brandKey?: string;
    private pendingBrand?: HTMLImageElement;
    private disposed = false;
    private width = 1;
    private height = 1;
    constructor(private scene: Phaser.Scene, private state: RecyclerProgress, private changed: () => void) {
        this.audio = new RecyclerAudio(scene);
        this.nextSlot = scene.add.rectangle(0, 0, 180, 70, 0x17251b, .9).setStrokeStyle(2, 0xb2e63a).setDepth(30);
        this.nextLabel = scene.add.text(0, 0, "LEVEL 1 UNLOCKED\nEmpty tool slot", { fontSize: "14px", align: "center", color: "#e8e9da" }).setOrigin(.5).setDepth(31);
        // Keep the background texture intact. Processing effects use world coordinates.
        this.shadow = scene.add.ellipse(0, 0, 1, 1, 0x130c06, .55).setDepth(33);
        this.machine = scene.add.image(0, 0, "trash-recycler", "__BASE").setOrigin(.5).setDepth(34).setVisible(false);
        this.glow = scene.add.ellipse(0, 0, 1, 1, 0xffb33f, .22).setDepth(35).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        for (let i = 0; i < 9; i++) {
            this.sparks.push(scene.add.circle(0, 0, 2, 0xffce74).setDepth(37).setVisible(false));
        }
        this.bin = scene.add.zone(0, 0, 1, 1); // Intake anchored to the Recycler hopper.
        for (let id = 0; id < 5; id++) {
            const item = scene.add.image(0, 0, ["trash-bag", "trash-can", "trash-carton"][id % 3]).setDepth(32);
            item.setData("trashId", id);
            item.setInteractive({ useHandCursor: true });
            scene.input.setDraggable(item);
            this.trash.push(item);
        }
        scene.input.on("drag", this.drag);
        scene.input.on("dragend", this.drop);
        this.refresh();
    }
    setBrand(dataUrl?: string): void {
        if (this.pendingBrand) { this.pendingBrand.onload = null; this.pendingBrand.onerror = null; }
        this.brand?.destroy(); this.flagBrand?.destroy();
        this.brand = undefined; this.flagBrand = undefined;
        if (this.brandKey) this.scene.textures.remove(this.brandKey);
        this.brandKey = undefined;
        if (!dataUrl || this.disposed) return;
        const image = new Image();
        this.pendingBrand = image;
        image.onload = () => {
            if (this.disposed || this.pendingBrand !== image) return;
            const key = `business-brand-${Phaser.Utils.String.UUID()}`;
            this.scene.textures.addImage(key, image);
            this.brandKey = key;
            this.brand = this.scene.add.image(0, 0, key).setDepth(31).setAlpha(.94);
            this.flagBrand = this.scene.add.image(0, 0, key).setDepth(2).setAngle(9).setAlpha(.86);
            image.onload = null; image.onerror = null; this.pendingBrand = undefined;
            this.layoutBrand();
        };
        image.onerror = () => { image.onload = null; image.onerror = null; this.pendingBrand = undefined; };
        image.src = dataUrl;
    }
    private layoutBrand(): void {
        if (this.brand) {
            this.brand.setPosition(this.width * .333, this.height * .72);
            this.brand.setScale(Math.min(this.width * .084 / this.brand.width, this.height * .116 / this.brand.height));
            this.brand.setVisible(this.active && this.state.established);
        }
        if (this.flagBrand) {
            this.flagBrand.setPosition(this.width * .211, this.height * .228);
            this.flagBrand.setScale(Math.min(this.width * .047 / this.flagBrand.width, this.height * .08 / this.flagBrand.height));
            this.flagBrand.setVisible(this.active && this.state.established);
        }
    }
    private drag = (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject, x: number, y: number) => {
        if (!this.active || !this.state.built || this.busy || !this.trash.includes(object as Phaser.GameObjects.Image)) return;
        (object as Phaser.GameObjects.Image).setPosition(x, y).setDepth(38);
    };
    private drop = (pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
        if (!this.trash.includes(object as Phaser.GameObjects.Image)) return;
        const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        if (this.active && !this.busy && this.state.built && this.bin.getBounds().contains(world.x, world.y)) {
            const item = object as Phaser.GameObjects.Image;
            const id = item.getData("trashId") as number;
            if (id < 100 && !this.state.recycled.has(id)) {
                this.process(item, id);
                return;
            }
        }
        if (!this.busy) this.refresh();
    };
    private process(item: Phaser.GameObjects.Image, id: number): void {
        this.busy = true;
        this.audio.intake();
        this.changed();
        this.trash.forEach(trash => { if (trash.input) trash.input.enabled = false; });
        this.ghost = this.scene.add.image(item.x, item.y, item.texture.key)
            .setScale(item.scaleX, item.scaleY).setDepth(36);
        item.setVisible(false);
        // Pull the released scrap into the hopper, then run a short processing cycle.
        this.scene.tweens.add({
            targets: this.ghost, x: this.bin.x, y: this.bin.y + 12,
            scaleX: 0, scaleY: 0, angle: 110, alpha: 0, duration: 320, ease: "Cubic.In",
            onComplete: () => {
                this.ghost?.destroy(); this.ghost = undefined;
                if (!this.state.built || this.disposed) { this.stopProcessing(); return; }
                this.audio.grind();
                this.machine.setVisible(false); // Invisible cycle timer target; never draw a rectangular crop.
                this.glow.setVisible(true).setAlpha(.18);
                this.scene.tweens.add({ targets: this.glow, alpha: .65, duration: 110, yoyo: true, repeat: 4 });
                this.sparks.forEach((spark, i) => {
                    spark.setPosition(this.width * .505, this.height * .735)
                        .setAlpha(1).setVisible(true);
                    this.scene.tweens.add({
                        targets: spark, x: spark.x + (i - 4) * 13, y: spark.y - 22 - (i % 3) * 13,
                        alpha: 0, duration: 400, delay: i * 45, ease: "Quad.Out"
                    });
                });
                this.scene.tweens.add({
                    targets: this.machine, x: this.machineX + 1, angle: .15,
                    duration: 55, yoyo: true, repeat: 8,
                    onComplete: () => {
                        // Preview completion only; real transaction settlement must live outside the animation.
                        const accepted = this.state.built && this.state.recycle(id);
                        this.stopProcessing();
                        if (accepted) { this.audio.finish(); this.changed(); }
                        this.refresh();
                    }
                });
            }
        });
    }
    private stopProcessing(): void {
        this.audio.stop();
        const targets = [this.machine, this.glow, ...this.sparks];
        if (this.ghost) targets.push(this.ghost as typeof this.machine);
        this.scene.tweens.killTweensOf(targets);
        this.ghost?.destroy(); this.ghost = undefined;
        this.busy = false;
        this.machine.setPosition(this.machineX, this.machineY).setAngle(0).setVisible(false);
        this.glow.setVisible(false);
        this.sparks.forEach(spark => spark.setVisible(false));
    }
    layout(width: number, height: number): void {
        if (this.busy) return; // The world dimensions are fixed; resize must not interrupt processing.
        this.width = width; this.height = height;
        this.machineX = width * (.457 + .105 / 2);
        this.machineY = height * (.589 + .137 / 2);
        this.machine.setPosition(this.machineX, this.machineY).setDisplaySize(width * .105, height * .137);
        this.bin.setPosition(width * .47, height * .454).setSize(width * .17, height * .065);
        this.glow.setPosition(width * .605, height * .641).setSize(width * .028, height * .054);
        this.trash.forEach(item => item.setScale(Math.max(48, Math.min(86, width * .10, height * .15)) / Math.max(item.width, item.height)));
        this.nextSlot.setPosition(width * .5, height * .3);
        this.nextLabel.setPosition(this.nextSlot.x, this.nextSlot.y);
        this.refresh();
    }
    refresh(): void {
        if (!this.state.built && this.busy) this.stopProcessing();
        this.machine.setVisible(false);
        this.shadow.setVisible(false); // Grounding shadows are painted into the upgraded scene.
        this.bin.setVisible(this.active && this.state.built);
        this.layoutBrand();
        this.nextSlot.setVisible(false);
        this.nextLabel.setVisible(false);
        if (this.busy) return;
        // Refill each of the five visual positions with its next distinct mock account.
        this.trash.forEach((item, id) => {
            let accountId = id;
            while (accountId < 100 && this.state.recycled.has(accountId)) accountId += 5;
            item.setDepth(32);
            item.setData("trashId", accountId);
            item.setVisible(this.active && this.state.built && accountId < 100);
            if (item.input) item.input.enabled = item.visible;
            item.setPosition(this.width * [ .12, .23, .36, .44, .51 ][id], this.height * [ .93, .91, .94, .87, .93 ][id]);
        });
    }
    destroy(): void {
        this.disposed = true;
        this.stopProcessing();
        this.machine.destroy(); this.shadow.destroy(); this.glow.destroy();
        this.sparks.forEach(spark => spark.destroy());
        if (this.pendingBrand) { this.pendingBrand.onload = null; this.pendingBrand.onerror = null; }
        this.brand?.destroy(); this.flagBrand?.destroy();
        if (this.brandKey) this.scene.textures.remove(this.brandKey);
        this.scene.input.off("drag", this.drag);
        this.scene.input.off("dragend", this.drop);
        this.nextSlot.destroy(); this.nextLabel.destroy();
        this.bin.destroy(); this.trash.forEach(item => item.destroy());
    }
}
