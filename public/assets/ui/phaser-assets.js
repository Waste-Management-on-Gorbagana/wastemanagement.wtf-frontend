// Copy assets/ into your public asset directory. No Phaser version-specific plugin required.
export async function preloadWM(scene, base = '/assets/wm-ui/') {
  const files = ["tool-section.png", "panel-shell.png", "display-net-value.png", "button-assign-disabled.png", "player-nameplate.png", "trash-recycler.png", "panel-master.png", "floor-row-selected.png", "floor-section.png", "button-steel.png", "button-orange.png", "button-unlock-disabled.png", "display-treasury.png", "display-staked.png", "footer-grille.png", "button-navigation.png", "button-marketplace.png", "tool-card.png", "section-nameplate.png", "brand-header.png", "panel-shell-tmp.png", "display-rank.png"];
  for (const file of files) scene.load.image('wm-ui-' + file.slice(0, -4), base + file);
}
// Use panel-master for closest reference layout; add live text/images using text-layout.json.
// Use panel-shell plus individual pieces for a dynamic layout.
// Keep aspect ratio. Rendering the 2045px-tall design in a short viewport requires scrolling.
export function floorView(floors, requirementsMet) {
  const unlocked = floors.filter(f => f.unlocked);
  const previous = unlocked[unlocked.length - 1];
  return { floors: unlocked, canUnlock: !!previous && !!requirementsMet(previous) };
}
// The caller must supply real progression requirements and authoritative unlock handling.
