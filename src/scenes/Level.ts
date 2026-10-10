
// You can write more code here

/* START OF COMPILED CODE */

import Phaser from "phaser";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Level extends Phaser.Scene {

	constructor() {
		super("Level");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	editorCreate(): void {

		// wm_login_background_png
		const wm_login_background_png = this.add.image(640, 360, "wm-login-background.png");
		wm_login_background_png.scaleX = 0.766;
		wm_login_background_png.scaleY = 0.766;

		// wm_connect_wallet_button0
		const wm_connect_wallet_button0 = this.add.image(640, 640, "wm-connect-wallet-button", 0);
		wm_connect_wallet_button0.scaleX = 0.2;
		wm_connect_wallet_button0.scaleY = 0.2;

		// wm_powered_by_gorbagana0
		const wm_powered_by_gorbagana0 = this.add.image(1173, 42, "wm-powered-by-gorbagana", 0);
		wm_powered_by_gorbagana0.scaleX = 0.15;
		wm_powered_by_gorbagana0.scaleY = 0.15;

		// wm_wigbeek_button
		const wm_wigbeek_button = this.add.image(34, 34, "wm-wigbeek-button");
		wm_wigbeek_button.scaleX = 0.05;
		wm_wigbeek_button.scaleY = 0.05;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	private introPlaying = false;

	create(): void {
		this.editorCreate();
		this.introPlaying = false;
		this.input.setTopOnly(true);
		// The video contains the music. Remove the old click-anywhere soundtrack.
		this.sound.stopByKey("build_your_empire_of_trash");

		this.bindSheetButton("wm-connect-wallet-button", () => this.showComingSoon());
		this.bindSheetButton("wm-powered-by-gorbagana", () => {
			window.open("https://www.gorbagana.wtf", "_blank", "noopener,noreferrer");
		});
		this.setupWigbeekButton();
	}

	// Sheets use frames 0/1; WIGBEEK uses one face image.
	// Position, origin and normal scale stay controlled by Level.scene.
	private bindSheetButton(
		key: string,
		onClick: () => void,
		isActive: () => boolean = () => false,
		singleImage = false
	): { refresh: () => void; cancel: () => void } | undefined {
		const button = this.children.list.find(
			(object): object is Phaser.GameObjects.Image =>
				object instanceof Phaser.GameObjects.Image && object.texture.key === key
		);
		if (!button || (!singleImage && (!button.texture.has("0") || !button.texture.has("1")))) {
			console.warn(`Check ${key} in Level.scene and asset-pack.json. WIGBEEK needs an Image; other buttons need frames 0 and 1.`);
			return;
		}

		button.setDepth(20);
		if (singleImage) button.setTexture(key);
		else button.setFrame(0);
		const normalX = button.scaleX;
		const normalY = button.scaleY;
		let hovered = false;
		let pressedPointer: number | null = null;
		const blocked = () => !!this.children.getByName("comingSoonModal");
		const refresh = () => {
			if (!singleImage) {
				button.setFrame(isActive() || (!blocked() && (hovered || pressedPointer !== null)) ? 1 : 0);
			}
		};
		const animate = (down: boolean) => {
			this.tweens.killTweensOf(button);
			const size = down ? 0.95 : (singleImage && hovered && !blocked() ? 1.06 : 1);
			this.tweens.add({
				targets: button,
				scaleX: normalX * size,
				scaleY: normalY * size,
				duration: down ? 70 : 170,
				ease: down ? "Quad.Out" : "Back.Out"
			});
		};
		const cancel = () => {
			hovered = false;
			pressedPointer = null;
			refresh();
			animate(false);
		};

		// Use a stable rectangular target, including transparent padding for touch.
		button.setInteractive({ useHandCursor: true });
		button.on("pointerover", (pointer: Phaser.Input.Pointer) => {
			hovered = !pointer.wasTouch;
			refresh();
			if (singleImage) animate(pressedPointer !== null);
		});
		button.on("pointerout", cancel);
		button.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
			if (blocked() || isActive() || pressedPointer !== null) return;
			pressedPointer = pointer.id;
			refresh();
			animate(true);
		});
		button.on("pointerup", (pointer: Phaser.Input.Pointer) => {
			if (pressedPointer !== pointer.id) return;
			pressedPointer = null;
			hovered = !pointer.wasTouch;
			animate(false);
			if (!blocked() && !isActive()) onClick();
			refresh();
		});
		const releaseOutside = (pointer: Phaser.Input.Pointer) => {
			if (pressedPointer === pointer.id) cancel();
		};
		this.input.on("pointerup", releaseOutside);
		this.input.on("pointerupoutside", releaseOutside);
		this.game.events.on("blur", cancel);
		this.events.once("shutdown", () => {
			this.input.off("pointerup", releaseOutside);
			this.input.off("pointerupoutside", releaseOutside);
			this.game.events.off("blur", cancel);
		});
		refresh();
		return { refresh, cancel };
	}

	private setupWigbeekButton(): void {
		const videoKey = "wm-login-intro";
		let video: Phaser.GameObjects.Video | undefined;
		const control = this.bindSheetButton("wm-wigbeek-button", () => {
			if (!video) {
				console.warn(`Load ${videoKey} as a Video in asset-pack.json.`);
				return;
			}
			this.introPlaying = true;
			this.sound.stopByKey("build_your_empire_of_trash");
			try {
				video.setCurrentTime(0);
				video.setMute(false).setVolume(0.5);
				video.play(false);
			} catch (error) {
				console.warn("Welcome video could not start.", error);
				reset();
			}
		}, () => this.introPlaying, true);
		if (!control) return;
		if (!this.cache.video.exists(videoKey)) {
			console.warn(`Missing video asset: ${videoKey}. Button hover still works.`);
			return;
		}

		video = this.add.video(640, 360, videoKey).setDepth(1).setVisible(false);
		video.setMute(false).setVolume(0.5);
		const fitVideo = () => {
			if (!video || video.width <= 0 || video.height <= 0) return;
			video.setPosition(this.scale.width / 2, this.scale.height / 2);
			video.setDisplaySize(this.scale.width, this.scale.height);
		};
		const reset = () => {
			this.introPlaying = false;
			video?.setVisible(false);
			video?.stop();
			control.cancel();
		};
		video.on("play", () => {
			fitVideo();
			video?.setVisible(true);
		});
		video.on("textureready", fitVideo);
		video.on("complete", reset);
		video.on("error", (error: unknown) => {
			console.warn("Welcome video playback failed.", error);
			reset();
		});
		video.on("unsupported", () => {
			console.warn("This browser cannot play the welcome video.");
			reset();
		});
		this.scale.on("resize", fitVideo);
		this.events.once("shutdown", () => {
			this.scale.off("resize", fitVideo);
			video?.stop();
			this.introPlaying = false;
		});
	}

private showComingSoon(): void {
	// Prevent multiple popups.
	if (this.children.getByName("comingSoonModal")) return;

	const { width, height } = this.scale;
	const cx = width / 2;
	const cy = height / 2;

	const modal = this.add.container(0, 0)
		.setName("comingSoonModal")
		.setDepth(1000);

	// Dim the scene and block clicks behind the popup.
	const shade = this.add.rectangle(
		cx, cy, width, height, 0x000000, 0.65
	).setInteractive();

	const panel = this.add.image(cx, cy, "wm-modal-panel");
	panel.setScale(Math.min(
		600 / panel.width,
		380 / panel.height,
		(width - 32) / panel.width,
		(height - 32) / panel.height
	));
	panel.setInteractive();

	const title = this.add.text(cx, cy, "COMING SOON", {
		fontFamily: "Arial",
		fontSize: "38px",
		fontStyle: "bold",
		color: "#F57C16",
		stroke: "#101A14",
		strokeThickness: 3
	}).setOrigin(0.5);


	const close = this.add.image(
		cx,
		cy + panel.displayHeight * 0.36,
		"wm-close-button"
	);

	const closeScale = (panel.displayWidth * 0.22) / close.width;

	close.setScale(closeScale)
		.setInteractive({ useHandCursor: true });

	modal.add([shade, panel, title, close]);

	const dismiss = () => {
		this.input.keyboard?.off("keydown-ESC", dismiss);
		this.events.off("shutdown", cleanup);
		modal.destroy();
	};

	const cleanup = () => {
		this.input.keyboard?.off("keydown-ESC", dismiss);
	};

	close.on("pointerover", () => {
		close.setScale(closeScale * 1.05);
	});

	close.on("pointerout", () => {
		close.setScale(closeScale);
	});

	close.on("pointerup", dismiss);

	this.input.keyboard?.on("keydown-ESC", dismiss);
	this.events.once("shutdown", cleanup);
}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here