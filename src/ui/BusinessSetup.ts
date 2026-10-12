import {
    BusinessPreview, readBrandImage, loadBusinessDraft,
    nameError, normalizeName, saveBusinessDraft, saveBusinessPreview
} from "../business/BusinessPreview";
import "./business-setup.css";
import { BUSINESS_STAKE_LABEL } from "../business/BusinessRules";

/** Native modal: keyboard focus stays inside; the scene owner gates Phaser input. */
export class BusinessSetup {
    private readonly dialog = document.createElement("dialog");
    private readonly abort = new AbortController();
    private readonly previousFocus = document.activeElement as HTMLElement | null;
    private draft: BusinessPreview;
    private step = 0;
    private readonly editing: boolean;
    private destroyed = false;
    private imageLoading = false;
    private imageRequest = 0;

    constructor(
        host: HTMLElement,
        initial: BusinessPreview | null,
        private readonly complete: (business: BusinessPreview) => void,
        private readonly cancel: () => void
    ) {
        this.editing = initial !== null;
        this.draft = { ...(initial ?? loadBusinessDraft()) };
        this.dialog.className = "wm-setup";
        this.dialog.setAttribute("aria-labelledby", "wm-setup-title");
        this.dialog.setAttribute("aria-describedby", "wm-setup-notice");
        host.append(this.dialog);
        this.dialog.addEventListener("cancel", event => {
            event.preventDefault();
            this.leave();
        }, { signal: this.abort.signal });
        this.dialog.addEventListener("click", event => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
            if (!button) return;
            if (button.dataset.action === "cancel") this.leave();
            if (button.dataset.action === "back") {
                this.step = Math.max(0, this.step - 1);
                this.render();
            }
        }, { signal: this.abort.signal });
        this.dialog.addEventListener("input", event => {
            const input = event.target as HTMLInputElement;
            if (input.name === "business-name") this.draft.name = input.value;
            if (input.name !== "business-name") return;
            saveBusinessDraft(this.draft);
            this.updatePreview();
            this.setError("");
        }, { signal: this.abort.signal });
        this.dialog.addEventListener("change", event => {
            const input = event.target as HTMLInputElement;
            if (input.name === "brand-image" && input.files?.[0]) void this.selectImage(input.files[0]);
        }, { signal: this.abort.signal });
        this.dialog.addEventListener("submit", event => {
            event.preventDefault();
            if (this.imageLoading) return;
            const error = nameError(this.draft.name);
            if (error) {
                if (this.step !== 0) { this.step = 0; this.render(); }
                this.setError(error);
                this.dialog.querySelector<HTMLInputElement>('[name="business-name"]')?.focus();
                return;
            }
            if (this.step >= 1 && !this.draft.logoDataUrl) {
                if (this.step !== 1) { this.step = 1; this.render(); }
                this.setError("Upload your brand image to continue.");
                return;
            }
            this.draft.name = normalizeName(this.draft.name);
            saveBusinessDraft(this.draft);
            if (this.step < 2) { this.step++; this.render(); return; }
            try {
                const saved = saveBusinessPreview(this.draft);
                this.destroy();
                this.complete(saved);
            } catch (error) {
                this.setError(error instanceof Error ? error.message : "Could not save. Please try again.");
            }
        }, { signal: this.abort.signal });
        // Prevent Phaser keyboard shortcuts from receiving typing/navigation keys.
        this.dialog.addEventListener("keydown", event => event.stopPropagation(), { signal: this.abort.signal });
        this.render();
        this.dialog.showModal();
        this.focusStep();
    }

    private render(): void {
        const titles = ["Give your trash a name.", "Trash brand.", this.editing ? "Review your setup." : "Review & stake."];
        this.dialog.dataset.step = String(this.step);
        const descriptions = [
            "",
            "Upload the image for your company and business NFT.",
            this.editing ? "Check your changes before saving." : ""
        ];
        this.dialog.innerHTML = `
            <form novalidate>
                <div class="wm-setup-top"><span>WM / REGISTRATION</span><button type="button" data-action="cancel" aria-label="Close business setup">×</button></div>
                <ol class="wm-setup-steps" aria-label="Registration progress">
                    ${["NAME", "SETUP", this.editing ? "REVIEW" : "REVIEW & STAKE"].map((label, i) => `<li ${i === this.step ? 'aria-current="step"' : ""}><span>${i + 1}</span>${label}</li>`).join("")}
                </ol>
                <div class="wm-setup-heading"><h1 id="wm-setup-title" tabindex="-1">${titles[this.step]}</h1>${descriptions[this.step] ? `<p>${descriptions[this.step]}</p>` : ""}</div>
                <div class="wm-setup-body">
                    <div class="wm-setup-fields">
                        ${this.step === 0 ? `
                            <label class="wm-field-label wm-visually-hidden" for="wm-business-name">Business name</label>
                            <input id="wm-business-name" name="business-name" type="text" maxlength="64" autocomplete="organization" placeholder="Your business name" aria-describedby="wm-name-hint wm-setup-error">
                            <p id="wm-name-hint" class="wm-field-hint">2–32 characters.</p>
                        ` : ""}
                        ${this.step === 1 ? `
                            
                            <label class="wm-field-label" for="wm-brand-image">Brand image</label>
                            <input id="wm-brand-image" name="brand-image" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="wm-image-hint wm-setup-error">
                            <p id="wm-image-hint" class="wm-field-hint">PNG, JPG or WebP · Up to 2 MB · Maximum 4096 × 4096.</p>
                            <p class="wm-upload-status" data-upload-status role="status"></p>
                            
                        ` : ""}
                        ${this.step === 2 ? `
                            <div class="wm-stake-summary"><span class="wm-field-label">${this.editing ? "EXISTING BUSINESS STAKE" : "REQUIRED STAKE"}</span><strong>${BUSINESS_STAKE_LABEL}</strong><p>${this.editing ? "No additional stake required." : "Unlocks Level 0."}</p></div>
                            <details class="wm-stake-terms"><summary>How the stake works</summary><p>The stake stays with the business. Selling its NFT transfers the business and stake to the buyer.</p><p>Withdrawing returns the stake, burns the business NFT and closes the business.</p></details>

                        ` : ""}
                    </div>
                    <div class="wm-sign-preview" ${this.step !== 2 ? "hidden" : ""}><span class="wm-sign-caption">NFT preview</span><div class="wm-company-sign"><img class="wm-company-logo" alt="Uploaded business brand" hidden><span class="wm-logo-empty">YOUR BRAND IMAGE</span><strong class="wm-company-name"></strong></div></div>
                </div>
                <p id="wm-setup-error" class="wm-setup-error" role="alert"></p>
                <div id="wm-setup-notice" class="wm-setup-notice"><strong>PREVIEW MODE</strong> Saved in this browser only. No WM moves and no NFT is minted.</div>
                <div class="wm-setup-actions"><button type="button" class="wm-setup-back" data-action="${this.step === 0 ? "cancel" : "back"}">${this.step === 0 ? "Back to welcome" : "← Back"}</button><button type="submit" class="wm-setup-next">${this.step === 2 ? (this.editing ? "Save preview changes →" : `<span class="wm-simulated-label">SIMULATED · NO WM MOVES</span>Incorporate`) : "Continue →"}</button></div>
            </form>
        `;
        const nameInput = this.dialog.querySelector<HTMLInputElement>('[name="business-name"]');
        if (nameInput) nameInput.value = this.draft.name;
        this.dialog.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled = this.imageLoading;
        this.updatePreview();
        if (this.dialog.open) this.focusStep();
    }

    private updatePreview(): void {
        const image = this.dialog.querySelector<HTMLImageElement>(".wm-company-logo")!;
        image.hidden = !this.draft.logoDataUrl;
        if (this.draft.logoDataUrl) image.src = this.draft.logoDataUrl;
        else image.removeAttribute("src");
        this.dialog.querySelector<HTMLElement>(".wm-logo-empty")!.hidden = !!this.draft.logoDataUrl;
        const status = this.dialog.querySelector("[data-upload-status]");
        if (status) status.textContent = this.imageLoading ? "Reading image…" : this.draft.logoFileName || "No image selected.";
        this.dialog.querySelector(".wm-company-name")!.textContent = normalizeName(this.draft.name) || "YOUR BUSINESS";
        const name = this.dialog.querySelector("[data-review-name]");
        if (name) name.textContent = normalizeName(this.draft.name);
        const imageName = this.dialog.querySelector("[data-review-image]");
        if (imageName) imageName.textContent = this.draft.logoFileName || "Brand image";
    }

    private async selectImage(file: File): Promise<void> {
        const request = ++this.imageRequest;
        this.imageLoading = true;
        this.dialog.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled = true;
        this.setError("");
        this.updatePreview();
        try {
            const uploaded = await readBrandImage(file);
            if (this.destroyed || request !== this.imageRequest) return;
            this.draft.logoDataUrl = uploaded.dataUrl;
            this.draft.logoFileName = uploaded.fileName;
            saveBusinessDraft(this.draft);
        } catch (error) {
            if (!this.destroyed && request === this.imageRequest) this.setError(error instanceof Error ? error.message : "Could not read image.");
        } finally {
            if (!this.destroyed && request === this.imageRequest) {
                this.imageLoading = false;
                this.dialog.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled = false;
                this.updatePreview();
            }
        }
    }

    private focusStep(): void {
        const target = this.step === 0
            ? this.dialog.querySelector<HTMLElement>('[name="business-name"]')
            : this.dialog.querySelector<HTMLElement>("#wm-setup-title");
        target?.focus();
    }
    private setError(message: string): void {
        this.dialog.querySelector("#wm-setup-error")!.textContent = message;
        this.dialog.querySelector('[name="business-name"]')?.setAttribute("aria-invalid", String(!!message));
    }
    private leave(): void {
        saveBusinessDraft(this.draft);
        this.destroy();
        this.cancel();
    }
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.abort.abort();
        this.dialog.close();
        this.dialog.remove();
        if (this.previousFocus?.isConnected) this.previousFocus.focus();
    }
}
