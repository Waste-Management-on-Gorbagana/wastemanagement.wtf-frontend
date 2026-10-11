/** Device-local UI preview only. Never use this store to authorize NFT actions. */
export interface BusinessPreview {
    version: 1;
    mode: "local-preview";
    name: string;
    logoDataUrl: string;
    logoFileName: string;
}
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const BUSINESS_KEY = "wm.business-preview.v1";
const DRAFT_KEY = "wm.business-draft.v1";
export const DEFAULT_BRAND: BusinessPreview = {
    version: 1, mode: "local-preview", name: "", logoDataUrl: "", logoFileName: ""
};
export function normalizeName(name: string): string { return name.trim().replace(/\s+/gu, " "); }
export function nameError(name: string): string {
    const normalized = normalizeName(name);
    const length = Array.from(normalized).length;
    if (length < 2) return "Enter a business name with at least 2 characters.";
    if (length > 32) return "Keep your business name to 32 characters or fewer.";
    if (/[\u0000-\u001f\u007f]/u.test(normalized)) return "Remove control characters from the name.";
    return "";
}
export function isLogoDataUrl(value: unknown): value is string {
    return typeof value === "string" && value.length <= Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 64
        && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
function validated(value: unknown, allowDraft = false): BusinessPreview | null {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (item.version !== 1 || item.mode !== "local-preview" || typeof item.name !== "string") return null;
    if (!allowDraft && nameError(item.name)) return null;
    if (Array.from(item.name).length > 64) return null;
    // Old colour/emblem previews keep their name, and are prompted to upload a logo.
    const logo = item.logoDataUrl ?? "";
    if (logo !== "" && !isLogoDataUrl(logo)) return null;
    return { version: 1, mode: "local-preview", name: item.name,
        logoDataUrl: logo as string,
        logoFileName: typeof item.logoFileName === "string" ? item.logoFileName.slice(0, 200) : "" };
}
function read(key: string, draft = false): BusinessPreview | null {
    try { return validated(JSON.parse(localStorage.getItem(key) || "null"), draft); }
    catch { return null; }
}
export function loadBusinessPreview(): BusinessPreview | null { return read(BUSINESS_KEY); }
export function loadBusinessDraft(): BusinessPreview { return read(DRAFT_KEY, true) ?? { ...DEFAULT_BRAND }; }
export function saveBusinessDraft(value: BusinessPreview): void {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); } catch { /* In-memory draft remains usable. */ }
}
export function saveBusinessPreview(value: BusinessPreview): BusinessPreview {
    const valid = validated({ ...value, name: normalizeName(value.name) });
    if (!valid || !valid.logoDataUrl) throw new Error("Enter your business name and upload a brand image.");
    try { localStorage.setItem(BUSINESS_KEY, JSON.stringify(valid)); }
    catch { throw new Error("This browser could not save the preview. Try a smaller image or enable site storage. Your choices are still here."); }
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* Completed preview is already saved. */ }
    return valid;
}

/** Future mint integration: upload original image, then put its durable URI in JSON metadata.
 * No local data URL or browser-storage identifier may be used as a minted image URI.
 */
export function buildBusinessMetadata(business: BusinessPreview, uploadedImageUri: string) {
    if (nameError(business.name) || !/^(https:\/\/|ipfs:\/\/|ar:\/\/)\S+$/i.test(uploadedImageUri)) {
        throw new Error("A valid name and uploaded image URI are required for NFT metadata.");
    }
    return { name: normalizeName(business.name), description: "A Waste Management business on Gorbagana.", image: uploadedImageUri };
}

/** Validate the selected image without cropping, recolouring, or re-encoding its bytes. */
export async function readBrandImage(file: File): Promise<{ dataUrl: string; fileName: string }> {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPG or WebP image.");
    if (!file.size || file.size > MAX_LOGO_BYTES) throw new Error("Choose an image up to 2 MB.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("The image could not be read. Please try another file."));
        reader.readAsDataURL(file);
    });
    if (!isLogoDataUrl(dataUrl)) throw new Error("The image format could not be read.");
    await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 4096 || image.naturalHeight > 4096) {
                reject(new Error("Use an image no larger than 4096 × 4096 pixels."));
            } else resolve();
        };
        image.onerror = () => reject(new Error("This file is not a readable image. Choose another PNG, JPG or WebP."));
        image.src = dataUrl;
    });
    return { dataUrl, fileName: file.name.slice(0, 200) };
}
