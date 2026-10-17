import './mobile-command.css';

export interface MobilePanelState {
    name: string; logo: string; floorName: string; renameStatus: string; floors: { id: string; label: string }[]; activeFloor: string;
    tool: string; art: string; installed: boolean; busy: boolean; canAssign: boolean;
    unlock: boolean; unlockHelp: string; deliveryVisible: boolean; deliveryBusy: boolean;
    deliveryMessage: string; status: string; netValue: string; rank: string;
}
type Page = 'home' | 'tool' | 'treasury' | 'leaderboard' | 'marketplace' | 'requirements';
const icons: Record<string, string> = {
    treasury: '<path d="M4 9h24v18H4zM10 9V5h12v4M4 16h24M14 14h4v6h-4z"/>',
    leaderboard: '<path d="M10 4h12v10a6 6 0 0 1-12 0zM10 6H5v5a5 5 0 0 0 5 5M22 6h5v5a5 5 0 0 1-5 5M16 20v7M10 28h12"/>',
    marketplace: '<path d="M3 5h4l4 16h13l4-11H8M13 27h.1M23 27h.1"/>'
};
/** Dedicated mobile presentation. All economic actions are delegated to CommandPanel. */
export class MobileCommandPanel {
    readonly element = document.createElement('section');
    private state?: MobilePanelState;
    private page: Page = 'home';
    private abort = new AbortController();
    private media = matchMedia('(max-width:900px), (pointer:coarse) and (max-width:1100px)');
    constructor(private action: (action: string, id?: string) => void) {
        this.element.className = 'wm-mobile';
        this.element.setAttribute('aria-label', 'Mobile command console');
        this.element.innerHTML = `<div class="mm-content"></div><nav class="mm-nav" aria-label="Corporation navigation">${['treasury', 'leaderboard', 'marketplace'].map((key, i) => `<button class="mm-plate mm-nav-${i}" data-mm="${key}" aria-label="${key}"><svg viewBox="0 0 32 32" aria-hidden="true">${icons[key]}</svg><span>${key[0].toUpperCase()+key.slice(1)}</span></button>`).join('')}</nav>`;
        this.element.addEventListener('click', e => {
            const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mm]');
            if (!b || b.disabled) return;
            const a = b.dataset.mm!;
            if (['home', 'tool', 'treasury', 'leaderboard', 'marketplace', 'requirements'].includes(a)) this.navigate(a as Page);
            else this.action(a);
        }, {signal: this.abort.signal});
        this.element.addEventListener('change', e => {
            if ((e.target as HTMLElement).matches('[data-mm-floor]')) {
                this.action('floor', (e.target as HTMLSelectElement).value);
            }
        }, {signal:this.abort.signal});
        this.element.addEventListener('submit', e => {
            if (!(e.target as HTMLElement).matches('[data-mm-rename]')) return;
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.querySelector<HTMLInputElement>('input')!;
            if (this.state?.busy || !form.reportValidity()) return;
            this.action('rename', input.value);
        }, {signal:this.abort.signal});
        for (const type of ['keydown', 'keyup']) this.element.addEventListener(type, e => e.stopPropagation(), {signal:this.abort.signal});
        this.media.addEventListener('change', () => { if (!this.media.matches) this.navigate('home'); }, {signal:this.abort.signal});
    }
    get active(): boolean { return this.media.matches; }
    home(): void { this.navigate('home'); }
    private navigate(next: Page): void {
        if (this.page === 'tool' && next !== 'tool') this.action('restore');
        if (this.page === 'treasury' && next !== 'treasury') this.action('close-treasury');
        const focusTool = next === 'tool' && this.page !== 'tool';
        this.page = next;
        this.render();
        if (focusTool) this.action('focus');
        if (next === 'treasury') this.action('treasury');
        this.element.querySelector<HTMLElement>('.mm-content h2, .mm-content [data-mm="home"]')?.focus();
    }
    update(state: MobilePanelState): void {
        // Avoid replacing focused controls on every recovery poll.
        if (JSON.stringify(state) === JSON.stringify(this.state)) return;
        this.state = state;
        this.render();
    }
    private render(): void {
        const s = this.state;
        if (!s) return;
        const content = this.element.querySelector<HTMLElement>('.mm-content')!;
        const escape = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
        const disabled = (v: boolean) => v ? 'disabled' : '';
        const back = `<button class="mm-back mm-plate" data-mm="home">‹ Back</button>`;
        this.element.dataset.page = this.page;
        this.element.querySelectorAll<HTMLElement>('.mm-nav button').forEach(b => b.setAttribute('aria-current', b.dataset.mm === this.page ? 'page' : 'false'));
        if (this.page === 'home') {
            content.innerHTML = `<header class="mm-identity mm-plate">${s.logo ? `<img src="${escape(s.logo)}" alt="Player brand">` : '<span class="mm-symbol">◇</span>'}<strong>${escape(s.name)}</strong><img class="mm-brand" src="/assets/ui/wm-retro-neon/brand-header.png" alt="WM"></header>
            <div class="mm-floor-row"><label class="mm-floor mm-plate"><span class="mm-sr">Selected floor</span><select data-mm-floor ${disabled(s.busy)}>${s.floors.map(f=>`<option value="${escape(f.id)}" ${f.id===s.activeFloor?'selected':''}>${escape(f.label)}</option>`).join('')}</select></label><button class="mm-unlock mm-plate" data-mm="unlock" ${disabled(!s.unlock || s.busy)}>Unlock Floor</button><button class="mm-info mm-plate" data-mm="requirements" aria-label="Floor unlock requirements">i</button></div>
            <button class="mm-tool mm-plate" data-mm="tool" ${disabled(!s.floors.length)}><img src="${escape(s.art)}" alt=""><span><strong>${escape(s.tool)}</strong><small>${s.busy?'Working…':s.installed?'Assigned':'Available to assign'}</small></span><b aria-hidden="true">›</b></button>
            <button class="mm-primary mm-plate" data-mm="claim" disabled title="Revenue claims are not connected yet">Claim Rewards <small>Not connected</small></button>`;
        } else if (this.page === 'tool') {
            content.innerHTML = `<header class="mm-title">${back}<h2 tabindex="-1">${escape(s.tool)}</h2><span class="mm-status">${s.busy?'Working…':s.installed?'Ready':'Unassigned'}</span></header>
            <div class="mm-description mm-plate"><div class="mm-scroll"><p>${s.tool==='Trash Recycler'?'Recycle eligible accounts and tokens to recover GOR. Drop delivered trash into the right-hand intake.':'Private single-sided token liquidity.'}</p><small role="status">${escape(s.deliveryMessage || s.status)}</small></div></div>
            ${s.deliveryVisible?`<button class="mm-primary mm-plate" data-mm="delivery" ${disabled(s.deliveryBusy || s.busy)}>Trash Delivery</button>`:''}
            <button class="mm-secondary mm-plate" data-mm="${s.installed?'unassign':'assign'}" ${disabled(s.busy || (!s.installed && !s.canAssign))}>${s.installed?'Unassign':'Assign'}</button>`;
        } else if (this.page === 'treasury') {
            content.innerHTML = '';
        } else {
            const titles = {leaderboard:'Leaderboard',marketplace:'Marketplace',requirements:'Floor information'};
            content.innerHTML = `<header class="mm-title">${back}<h2 tabindex="-1">${titles[this.page]}</h2></header><div class="mm-details mm-plate"><div class="mm-scroll">${this.page==='leaderboard'?`<dl><div><dt>Corporation net value</dt><dd>${escape(s.netValue)}</dd></div><div><dt>Your rank</dt><dd>${escape(s.rank)}</dd></div></dl><p>Rankings will appear when the leaderboard service is connected.</p>`:this.page==='marketplace'?'<p>Business listings will appear when the marketplace is connected.</p>':`<form class="mm-rename" data-mm-rename><label for="mm-floor-name">Floor name</label><div><input id="mm-floor-name" name="floorName" maxlength="32" required autocomplete="off" value="${escape(s.floorName)}" ${disabled(s.busy || !s.floors.length)}><button type="submit" class="mm-plate" ${disabled(s.busy || !s.floors.length)}>Save</button></div><small role="status">${escape(s.renameStatus)}</small></form><p>${escape(s.unlockHelp)}</p><button class="mm-primary mm-plate" data-mm="unlock" ${disabled(!s.unlock||s.busy)}>Unlock Floor</button>`}</div></div>`;
        }
    }
    destroy(): void { this.abort.abort(); this.element.remove(); }
}
