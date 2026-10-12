WM RETRO NEON UI — asset pack v1

Use assets/panel-master.png for the closest composition to the approved design.
The fixed WM branding is baked in; player metadata, statistics and labels are separate.
Use assets/panel-shell.png for modular assembly. Its entire middle is solid-backed.
Individual rectangular component crops have fully opaque interiors including screens.
Only the outer silhouette of master/shell is transparent. Components intentionally
include a small opaque local backing at their corners to avoid holes and seams.
Generated sources have their own texture differences; this is a faithful reconstruction,
not a pixel-exact lossless extraction of the original screenshot.

CONTENTS
- Complete clean master and complete solid-backed shell
- 18 component PNGs: brand header, nameplates, buttons, displays, floor/tool sections
- Isolated recycler illustration
- 8 simple interface symbols in editable SVG
- layout.json: exact source-pixel placement and component dimensions (769 x 2045)
- text-layout.json: sample labels to replace with live application data
- preview.html: assembled local visual preview over a checkerboard background
- phaser-assets.js: loader and minimal unlocked-floor filtering helper
- reference/approved-design.png: supplied design for comparison

Button states: orange and steel normal surfaces plus grey unlock-disabled and muted
assignment-disabled surfaces are supplied. For hover use a small brightness increase;
for pressed use a 1-2 px inset movement. No separate painted hover/pressed animation
frames are included. Selected floor row uses cyan trim. For an unselected row, use a
black-glass display surface. Use the orange button surface for eligible unlock action.

Player brand image on LEFT, metadata name on RIGHT. No Empire Name label.
Stats: Staked WM (WM), Treasury GOR (GOR), Corporation Net Value (GOR).
Show only unlocked floors. Keep unlock control disabled until previous floor meets
real game requirements; do not derive eligibility from artwork or placeholder values.
Use Assign/Unassign as the tool control label. All game/transaction logic stays external.

Do not stretch the entire master to arbitrary aspect ratios. Scale uniformly, scroll
inside the right dock, or construct a shorter layout with the modular assets.
No production game code has been modified. Preview is a visual assembly, not DeFi UI.
