import Phaser from "phaser";
import { RecyclerProgress } from "./RecyclerPreview";
import { RecoverableTrash } from "./RecoverySource";

/** Garbage is interactive artwork, never baked into the courtyard or delivery video. */
export class RecyclerWorld {
    private trash: Phaser.GameObjects.Image[] = [];
    private items: RecoverableTrash[] = [];
    private active = true;
    private paused = false;
    private busy = false;
    private disposed = false;
    private width = 1670;
    private height = 942;
    private brand?: Phaser.GameObjects.Image;
    private brandKey?: string;
    private pendingBrand?: HTMLImageElement;
    private glow: Phaser.GameObjects.Ellipse;
    private ghost?: Phaser.GameObjects.Image;
    get isProcessing(): boolean { return this.busy; }
    constructor(private scene: Phaser.Scene, private state: RecyclerProgress,
        private changed: () => void,
        private recover: (item: RecoverableTrash) => Promise<boolean>,
        private playCycle: () => Promise<boolean>) {
        this.glow = scene.add.ellipse(0, 0, 100, 60, 0x55eaff, .3).setDepth(35).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        scene.input.on("drag", this.drag);
        scene.input.on("dragend", this.drop);
    }
    setPaused(paused: boolean): void { this.paused = paused; this.refresh(); }
    setActive(active: boolean): void { this.active = active; this.refresh(); }
    setItems(items: RecoverableTrash[]): void {
        this.items = items.slice();
        this.trash.forEach(x => x.destroy());
        this.trash = items.map((item, i) => {
            const art = this.scene.add.image(0, 0, ["trash-bag", "trash-can", "trash-carton"][i % 3]).setDepth(32);
            art.setData("item", item).setInteractive({ useHandCursor: true });
            this.scene.input.setDraggable(art);
            return art;
        });
        this.refresh();
    }
    get pendingIds(): Set<string> { return new Set(this.items.map(x => x.id)); }
    setBrand(dataUrl?: string): void {
        if (this.pendingBrand) this.pendingBrand.onload = this.pendingBrand.onerror = null;
        this.brand?.destroy(); this.brand = undefined;
        if (this.brandKey) this.scene.textures.remove(this.brandKey);
        this.brandKey = undefined;
        if (!dataUrl || this.disposed) return;
        const image = new Image(); this.pendingBrand = image;
        image.onload = () => {
            if (this.disposed || this.pendingBrand !== image) return;
            this.brandKey = `level0-brand-${Phaser.Utils.String.UUID()}`;
            this.scene.textures.addImage(this.brandKey, image);
            this.brand = this.scene.add.image(0, 0, this.brandKey).setDepth(31).setAlpha(.94);
            this.pendingBrand = undefined; this.refresh();
        };
        image.onerror = () => { this.pendingBrand = undefined; };
        image.src = dataUrl;
    }
    private drag = (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject, x: number, y: number) => {
        if (!this.active || this.paused || !this.state.built || this.busy || !this.trash.includes(object as Phaser.GameObjects.Image)) return;
        (object as Phaser.GameObjects.Image).setPosition(x, y).setDepth(38);
    };
    private drop = (pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
        if (!this.trash.includes(object as Phaser.GameObjects.Image)) return;
        const p = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const intake = new Phaser.Geom.Rectangle(this.width * .275, this.height * .49, this.width * .08, this.height * .14);
        if (this.active && !this.paused && this.state.built && !this.busy && intake.contains(p.x, p.y)) void this.process(object as Phaser.GameObjects.Image);
        else if (!this.busy) this.refresh();
    };
    private async process(art: Phaser.GameObjects.Image): Promise<void> {
        const item = art.getData("item") as RecoverableTrash;
        this.busy = true;
        this.trash.forEach(x => { if (x.input) x.input.enabled = false; });
        this.changed();
        this.ghost = this.scene.add.image(art.x, art.y, art.texture.key).setScale(art.scale).setDepth(38);
        art.setVisible(false);
        await new Promise<void>(resolve => this.scene.tweens.add({ targets: this.ghost, x: this.width * .315, y: this.height * .54, scale: 0, duration: 300, onComplete: () => resolve() }));
        if (this.disposed) return;
        this.ghost?.destroy(); this.ghost = undefined;
        this.glow.setPosition(this.width * .23, this.height * .54).setVisible(true);
        this.scene.tweens.add({ targets: this.glow, alpha: .65, yoyo: true, repeat: -1, duration: 160 });
        let confirmed = false;
        try { confirmed = await this.recover(item); } catch { confirmed = false; }
        if (this.disposed) return;
        this.scene.tweens.killTweensOf(this.glow); this.glow.setVisible(false);
        if (confirmed) {
            this.items = this.items.filter(x => x.id !== item.id);
            try { await this.playCycle(); } catch { /* Keep confirmed settlement even if media fails. */ }
            if (this.disposed) return;
        }
        this.busy = false;
        this.setItems(this.items); this.changed();
    }
    layout(width: number, height: number): void { this.width = width; this.height = height; this.refresh(); }
    refresh(): void {
        if (this.brand) {
            this.brand.setPosition(this.width * .215, this.height * .66);
            this.brand.setScale(Math.min(this.width * .075 / this.brand.width, this.height * .10 / this.brand.height));
            this.brand.setVisible(this.active && this.state.established);
        }
        if (this.busy) return;
        this.trash.forEach((art, i) => {
            // Compact pile in the collection bay, independent of video pixels.
            art.setPosition(this.width * (.43 + (i % 5) * .055), this.height * (.735 + Math.floor(i / 5) * .025));
            art.setScale(62 / Math.max(art.width, art.height)).setDepth(32 + i * .01);
            art.setVisible(this.active && this.state.built);
            if (art.input) art.input.enabled = art.visible && !this.paused;
        });
    }
    destroy(): void {
        this.disposed = true;
        this.scene.input.off("drag", this.drag); this.scene.input.off("dragend", this.drop);
        this.scene.tweens.killTweensOf(this.glow); this.glow.destroy(); this.ghost?.destroy();
        this.trash.forEach(x => x.destroy()); this.brand?.destroy();
        if (this.brandKey) this.scene.textures.remove(this.brandKey);
        if (this.pendingBrand) this.pendingBrand.onload = this.pendingBrand.onerror = null;
    }
}
