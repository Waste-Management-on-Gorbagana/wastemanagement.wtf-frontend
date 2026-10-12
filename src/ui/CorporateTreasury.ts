import './corporate-treasury.css';

/** Balances are decimal strings from the future master-program/wallet adapter, never floats. */
export interface TreasuryAsset {
    id: string; symbol: string; decimals: number;
    corporateBalance: string | null; walletBalance: string | null;
    /** Optional actual metadata artwork. */
    imageUrl?: string;
    /** Maximum deposit after fee/rent reserves, computed by the wallet adapter. */
    maxDeposit?: string | null;
}
export interface TreasurySnapshot {
    assets: TreasuryAsset[];
    stakedWM: string | null;
    nftLabel?: string;
    /** Verified aggregate valuation in GOR, supplied by the valuation adapter. */
    netValueGOR?: string | null;
}
export function toUnits(value: string, decimals: number): bigint | null {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^\d+(?:\.\d+)?$/.test(value) || value.length > 100) return null;
    const [whole, fraction = ''] = value.split('.');
    if (fraction.length > decimals) return null;
    return BigInt(whole + fraction.padEnd(decimals, '0'));
}
function fromUnits(value: bigint, decimals: number): string {
    const s = value.toString().padStart(decimals + 1, '0');
    return decimals ? s.slice(0, -decimals) + '.' + s.slice(-decimals) : s;
}
function format(value: string | null): string {
    if (value === null || !/^\d+(\.\d+)?$/.test(value)) return '—';
    const [a,b] = value.split('.');
    return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : '');
}
const initial = (): TreasurySnapshot => ({ assets: [
    { id: 'WM', symbol: 'WM', decimals: 9, corporateBalance: null, walletBalance: null },
    { id: 'GOR', symbol: 'GOR', decimals: 9, corporateBalance: null, walletBalance: null }
], stakedWM: null });

/** Navigation and review only. No transaction is fabricated or sent by this component. */
export class CorporateTreasury {
    readonly element = document.createElement('section');
    private snapshot = initial();
    private previewStake: string | null = null;
    private assetId = 'GOR';
    private page: 'treasury' | 'deposit' = 'treasury';
    private readonly abort = new AbortController();
    constructor(private readonly onGame: () => void) {
        this.element.className = 'wm-corporate';
        this.element.hidden = true;
        this.element.setAttribute('aria-label', 'Corporate treasury');
        this.element.innerHTML = `
            <button type="button" class="ct-back" data-ct-back>← Game</button>
            <h2 tabindex="-1">Corporate Treasury</h2>
            <p class="ct-nft" data-ct-nft>Corporate NFT · Not connected</p>
            <div data-ct-treasury>
                <div class="ct-balances" data-ct-balances></div>
                <div class="ct-stake"><span>STAKED WM</span><strong data-ct-staked>—</strong></div>
                <div class="ct-actions"><button type="button" class="ct-primary" data-ct-deposit>Deposit</button><button type="button" class="ct-secondary" disabled title="Withdrawals require the master-program connection">Withdraw</button></div>
                <h3>Other tokens</h3><div class="ct-token-list" data-ct-tokens></div>
                <p class="ct-note">Corporate balances will appear when the master program is connected.</p>
            </div>
            <form data-ct-deposit-form hidden novalidate>
                <div class="ct-transfer"><span>CONNECTED<br>WALLET</span><b aria-hidden="true">→</b><span>CORPORATE<br>TREASURY</span></div>
                <label for="ct-asset">Asset</label><select id="ct-asset" name="asset"></select>
                <p class="ct-wallet">Wallet available: <strong data-ct-wallet>—</strong></p>
                <label for="ct-amount">Amount to deposit</label><div class="ct-amount"><input id="ct-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-describedby="ct-validation"><button type="button" data-ct-max>MAX</button></div>
                <div class="ct-review"><div><span>Corporate balance now</span><strong data-ct-current>—</strong></div><div><span>After deposit</span><strong data-ct-after>—</strong></div></div>
                <p id="ct-validation" class="ct-note" aria-live="polite"></p>
                <p class="ct-note">Keep GOR in your wallet for network fees.</p>
                <button type="submit" class="ct-primary ct-submit" disabled>Review deposit</button>
                <div class="ct-confirm" data-ct-confirm hidden tabindex="-1"><h3>Deposit review</h3><p data-ct-summary></p><button type="button" class="ct-primary" disabled>Wallet approval unavailable</button><p>Deposits are not connected yet. No assets have moved.</p></div>
                <p class="ct-connection">Master program not connected · Deposits unavailable</p>
            </form>`;
        this.element.querySelector('[data-ct-back]')!.addEventListener('click', () => {
            if (this.page === 'deposit') this.show('treasury'); else this.onGame();
        }, { signal: this.abort.signal });
        this.element.querySelector('[data-ct-deposit]')!.addEventListener('click', () => this.show('deposit'), { signal: this.abort.signal });
        this.select.addEventListener('change', () => { this.assetId = this.select.value; this.amount.value = ''; this.updateAmount(); }, { signal: this.abort.signal });
        this.amount.addEventListener('input', () => this.updateAmount(), { signal: this.abort.signal });
        this.element.querySelector('[data-ct-max]')!.addEventListener('click', () => {
            const a = this.asset(); if (a?.maxDeposit != null) this.amount.value = a.maxDeposit;
            this.updateAmount();
        }, { signal: this.abort.signal });
        this.element.querySelector('form')!.addEventListener('submit', event => {
            event.preventDefault(); this.updateAmount();
            if (this.element.querySelector<HTMLButtonElement>('.ct-submit')!.disabled) return;
            const a = this.asset()!;
            this.element.querySelector('[data-ct-summary]')!.textContent = `${format(this.amount.value)} ${a.symbol} from your connected wallet to the Corporate Treasury.`;
            const box = this.element.querySelector<HTMLElement>('[data-ct-confirm]')!; box.hidden = false; box.focus();
        }, { signal: this.abort.signal });
        // Prevent Phaser keyboard shortcuts from firing while entering an amount.
        for (const type of ['keydown', 'keyup']) this.element.addEventListener(type, e => e.stopPropagation(), { signal: this.abort.signal });
        this.render();
    }
    private get select(): HTMLSelectElement { return this.element.querySelector('select')!; }
    private get amount(): HTMLInputElement { return this.element.querySelector('input')!; }
    private asset(): TreasuryAsset | undefined { return this.snapshot.assets.find(a => a.id === this.assetId); }
    setPreviewStake(value: string | null): void {
        this.previewStake = value; this.render();
    }
    setData(data: TreasurySnapshot): void {
        this.snapshot = { ...data, assets: data.assets.map(a => ({...a})) };
        if (!this.asset()) this.assetId = data.assets[0]?.id ?? '';
        this.render();
    }
    show(page: 'treasury' | 'deposit' = 'treasury'): void {
        this.page = page; this.element.hidden = false;
        this.element.querySelector<HTMLElement>('[data-ct-treasury]')!.hidden = page !== 'treasury';
        this.element.querySelector<HTMLElement>('form')!.hidden = page !== 'deposit';
        this.element.querySelector('[data-ct-back]')!.textContent = page === 'treasury' ? '← Game' : '← Treasury';
        this.element.querySelector('h2')!.textContent = page === 'treasury' ? 'Corporate Treasury' : 'Deposit Assets';
        this.updateAmount(); this.element.querySelector('h2')!.focus();
    }
    private tokenRow(a: TreasuryAsset): HTMLElement {
        const row = document.createElement('div'); row.className = 'ct-token';
        const icon = document.createElement('span'); icon.className = 'ct-token-icon'; icon.textContent = a.symbol.slice(0, 3);
        if (a.imageUrl && /^(https:\/\/|\/assets\/)/.test(a.imageUrl)) {
            const img = document.createElement('img'); img.src = a.imageUrl; img.alt = '';
            img.addEventListener('error', () => img.remove(), { once: true }); icon.append(img);
        }
        const name = document.createElement('span'); name.textContent = a.symbol;
        const balance = document.createElement('strong'); balance.textContent = format(a.corporateBalance);
        row.append(icon, name, balance); return row;
    }
    private render(): void {
        const balances = this.element.querySelector('[data-ct-balances]')!;
        balances.replaceChildren(...['WM', 'GOR'].map(id => this.tokenRow(this.snapshot.assets.find(a => a.id === id) ?? { id, symbol:id, decimals:9, walletBalance:null, corporateBalance:null })));
        this.element.querySelector('[data-ct-staked]')!.textContent = this.snapshot.stakedWM !== null ? format(this.snapshot.stakedWM) + ' WM' : this.previewStake !== null ? format(this.previewStake) + ' WM (preview)' : '—';
        this.element.querySelector('[data-ct-nft]')!.textContent = this.snapshot.nftLabel || 'Corporate NFT · Not connected';
        const tokens = this.element.querySelector('[data-ct-tokens]')!;
        tokens.replaceChildren(...this.snapshot.assets.filter(a => a.id !== 'WM' && a.id !== 'GOR').map(a => this.tokenRow(a)));
        if (!tokens.childElementCount) { const p = document.createElement('p'); p.className = 'ct-empty'; p.textContent = 'No token balances available'; tokens.append(p); }
        this.select.replaceChildren(...this.snapshot.assets.map(a => { const option = document.createElement('option'); option.value = a.id; option.textContent = a.symbol; return option; }));
        this.select.value = this.assetId; this.updateAmount();
    }
    private updateAmount(): void {
        const a = this.asset();
        const current = a?.corporateBalance == null ? null : toUnits(a.corporateBalance, a.decimals);
        const wallet = a?.walletBalance == null ? null : toUnits(a.walletBalance, a.decimals);
        const amount = a ? toUnits(this.amount.value.trim(), a.decimals) : null;
        const maximum = a?.maxDeposit == null ? null : toUnits(a.maxDeposit, a.decimals);
        const valid = current !== null && wallet !== null && amount !== null && amount > 0n && amount <= wallet && (maximum === null || amount <= maximum);
        this.element.querySelector('[data-ct-wallet]')!.textContent = format(a?.walletBalance ?? null) + (a ? ' ' + a.symbol : '');
        this.element.querySelector('[data-ct-current]')!.textContent = format(a?.corporateBalance ?? null) + (a ? ' ' + a.symbol : '');
        this.element.querySelector('[data-ct-after]')!.textContent = valid ? format(fromUnits(current! + amount!, a!.decimals)) + ' ' + a!.symbol : '—';
        this.element.querySelector<HTMLButtonElement>('[data-ct-max]')!.disabled = maximum === null || wallet === null || maximum > wallet;
        this.element.querySelector<HTMLButtonElement>('.ct-submit')!.disabled = !valid;
        this.element.querySelector('#ct-validation')!.textContent = wallet === null || current === null ? 'Connect the treasury and wallet balance sources to review a deposit.' : !this.amount.value ? 'Enter an amount.' : !valid ? 'Enter a positive amount within the available balance and token precision.' : 'Ready to review.';
        this.element.querySelector<HTMLElement>('[data-ct-confirm]')!.hidden = true;
    }
    destroy(): void { this.abort.abort(); this.element.remove(); }
}
