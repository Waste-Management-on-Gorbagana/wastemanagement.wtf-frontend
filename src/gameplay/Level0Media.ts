import Phaser from "phaser";

export type TimeOfDay = "day" | "night";
export const LEVEL0 = {
    width: 1670, height: 942,
    // Shared worldwide schedule. These hours are UTC, never browser-local time.
    sunriseUTC: 6, sunsetUTC: 18,
    assetRoot: "assets/level0/",
};
export function utcPhase(now = new Date()): TimeOfDay {
    const h = now.getUTCHours();
    return h >= LEVEL0.sunriseUTC && h < LEVEL0.sunsetUTC ? "day" : "night";
}
export function level0Key(installed: boolean, phase: TimeOfDay): string {
    return `${installed ? "recycler" : "bare"}-${phase}`;
}
/** Uses the same world camera as the still, so zoom, fullscreen and mobile stay aligned. */
export class Level0Media {
    private video?: Phaser.GameObjects.Video;
    private finish?: (success: boolean) => void;
    private timer?: ReturnType<typeof setTimeout>;
    private disposed = false;
    get busy(): boolean { return !!this.finish; }
    constructor(private scene: Phaser.Scene) {}
    play(file: string, sound = false): Promise<boolean> {
        if (this.busy || this.disposed) return Promise.resolve(false);
        return new Promise(resolve => {
            const video = this.scene.add.video(0, 0).setOrigin(0).setDepth(20).setVisible(false);
            this.video = video;
            this.finish = (success: boolean) => {
                if (!this.finish) return;
                this.finish = undefined;
                clearTimeout(this.timer);
                video.removeAllListeners(); video.stop(); video.destroy();
                this.video = undefined;
                resolve(success);
            };
            const fit = () => video.setDisplaySize(LEVEL0.width, LEVEL0.height);
            video.on("textureready", () => { fit(); video.setVisible(true); });
            video.on("play", fit);
            video.once("complete", () => this.finish?.(true));
            video.once("error", () => this.finish?.(false));
            video.once("unsupported", () => this.finish?.(false));
            // Mobile browsers may block audio if loading outlasts a user gesture.
            video.once("locked", () => { video.setMute(true); video.play(false); });
            this.timer = setTimeout(() => this.finish?.(false), 45000);
            try {
                video.loadURL(LEVEL0.assetRoot + file, !sound);
                video.setMute(!sound).setVolume(.55).play(false);
            } catch { this.finish?.(false); }
        });
    }
    cancel(): void { this.finish?.(false); }
    destroy(): void { this.disposed = true; this.cancel(); this.video?.destroy(); }
}
