
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

		// wm_wallet_button
		const wm_wallet_button = this.add.image(640, 650, "wm-wallet-button");
		wm_wallet_button.scaleX = 0.14;
		wm_wallet_button.scaleY = 0.14;

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

create() {
	this.editorCreate();

	const onKey = "wm-wallet-button";
	const offKey = "wm-wallet-button-off";

	this.input.once("pointerdown", () => {

    this.sound.play("build_your_empire_of_trash", {
        loop: true,
        volume: 0.5
    });

});

	const button = this.children.list.find(
		(obj): obj is Phaser.GameObjects.Image =>
			obj instanceof Phaser.GameObjects.Image &&
			obj.texture.key === onKey
	);

	if (!button || !this.textures.exists(offKey)) {
		console.warn("Check the wallet button texture keys in asset-pack.json.");
		return;
	}

	const width = button.displayWidth;
	const height = button.displayHeight;
	let hovered = false;

	const setLight = (lit: boolean) => {
		button.setTexture(lit ? onKey : offKey);
		button.setDisplaySize(width, height);
	};

	// Limit the mouse area to the sign, excluding transparent padding.
	button.setInteractive({
		hitArea: new Phaser.Geom.Rectangle(
			button.width * 0.02,
			button.height * 0.17,
			button.width * 0.96,
			button.height * 0.61
		),
		hitAreaCallback: Phaser.Geom.Rectangle.Contains,
		useHandCursor: true
	});

const scaleX = button.scaleX;
const scaleY = button.scaleY;
let pressed = false;

setLight(false);

const animatePress = (down: boolean) => {
	this.tweens.killTweensOf(button);

	this.tweens.add({
		targets: button,
		scaleX: scaleX * (down ? 0.96 : 1),
		scaleY: scaleY * (down ? 0.96 : 1),
		duration: down ? 70 : 180,
		ease: down ? "Quad.Out" : "Back.Out"
	});
};

button.on("pointerover", () => {
	hovered = true;
	setLight(true);
});

button.on("pointerout", () => {
	hovered = false;
	pressed = false;
	setLight(false);
	animatePress(false);
});

button.on("pointerdown", () => {
	pressed = true;
	setLight(true);
	animatePress(true);
});

button.on("pointerup", () => {
	if (!pressed) return;

	pressed = false;
	setLight(true);
	animatePress(false);

	// Wallet connection will go here.
	this.showComingSoon();
});

button.on("pointerupoutside", () => {
	pressed = false;
	setLight(hovered);
	animatePress(false);
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
