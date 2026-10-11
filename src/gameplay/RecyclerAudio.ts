import Phaser from "phaser";

/** Authored WAV assets; starts are driven by animation callbacks. */
export class RecyclerAudio {
    private current?: Phaser.Sound.BaseSound;
    constructor(private readonly scene: Phaser.Scene) {}
    private play(key: string, volume: number): void {
        this.stop();
        if (!this.scene.cache.audio.exists(key)) return;
        const sound = this.scene.sound.add(key, { volume });
        this.current = sound;
        sound.once("complete", () => {
            if (this.current === sound) this.current = undefined;
            sound.destroy();
        });
        sound.play();
    }
    intake(): void { this.play("recycler-intake", .55); }
    grind(): void { this.play("recycler-grind", .45); }
    finish(): void { this.play("recycler-finish", .5); }
    stop(): void {
        const sound = this.current;
        this.current = undefined;
        if (sound) { sound.stop(); sound.destroy(); }
    }
}
