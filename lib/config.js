// Every option the showroom exposes lives here, so the UI and the scene read
// from one source.

// `metal` is how metallic the base coat is: solid colours low, metallics high.

export const PAINTS = [
  { id: 'racing-blue', name: 'French Racing Blue', hex: '#0b44c9', metal: 0.65 },
  { id: 'atlantic', name: 'Atlantic Blue', hex: '#07122e', metal: 0.7 },
  { id: 'nocturne', name: 'Nocturne Black', hex: '#060607', metal: 0.55 },
  { id: 'glacier', name: 'Glacier White', hex: '#e9eaec', metal: 0.12 },
  { id: 'argent', name: 'Argent Silver', hex: '#9da2a9', metal: 0.9 },
  { id: 'graphite', name: 'Graphite', hex: '#2b2d31', metal: 0.8 },
  { id: 'rosso', name: 'Italian Red', hex: '#a90d10', metal: 0.35 },
  { id: 'molsheim', name: 'Molsheim Yellow', hex: '#f0b400', metal: 0.18 },
  { id: 'jet-orange', name: 'Jet Orange', hex: '#e2530c', metal: 0.3 },
  { id: 'racing-green', name: 'Racing Green', hex: '#0c3a25', metal: 0.6 },
  { id: 'viola', name: 'Viola', hex: '#3a1466', metal: 0.7 },
  { id: 'turquoise', name: 'Turquoise', hex: '#0aa6a0', metal: 0.5 },
];

// Two-tone presets: the Chiron's C-line splits the body into a front and a rear colour.
export const DUOS = [
  { name: 'Launch', front: 'racing-blue', rear: 'atlantic' },
  { name: 'Noir', front: 'nocturne', rear: 'graphite' },
  { name: 'Blanc', front: 'glacier', rear: 'nocturne' },
  { name: 'Rosso', front: 'rosso', rear: 'nocturne' },
  { name: 'Jaune', front: 'molsheim', rear: 'nocturne' },
  { name: 'Argent', front: 'argent', rear: 'atlantic' },
  { name: 'Jet', front: 'jet-orange', rear: 'graphite' },
  { name: 'Mono', front: 'racing-green', rear: 'racing-green' },
];

export const FINISHES = [
  { id: 'gloss', name: 'Gloss', hint: 'Deep clearcoat' },
  { id: 'satin', name: 'Satin', hint: 'Soft sheen' },
  { id: 'matte', name: 'Matte', hint: 'No clearcoat' },
  { id: 'pearl', name: 'Pearl', hint: 'Iridescent shift' },
  { id: 'chrome', name: 'Chrome', hint: 'Mirror wrap' },
];

export const CALIPERS = [
  { id: 'blue', name: 'Blue', hex: '#0b44c9' },
  { id: 'red', name: 'Red', hex: '#c0100f' },
  { id: 'yellow', name: 'Yellow', hex: '#f0b400' },
  { id: 'orange', name: 'Orange', hex: '#e2530c' },
  { id: 'green', name: 'Acid Green', hex: '#7bd10a' },
  { id: 'silver', name: 'Silver', hex: '#b9bcc0' },
  { id: 'black', name: 'Black', hex: '#0a0a0b' },
  { id: 'white', name: 'White', hex: '#eeeeee' },
];

export const WHEELS = [
  { id: 'duo', name: 'Two-tone', hint: 'Machined face, body-colour spokes' },
  { id: 'silver', name: 'Silver', hint: 'Fully machined' },
  { id: 'black', name: 'Gloss Black', hint: 'Black on black' },
  { id: 'gunmetal', name: 'Gunmetal', hint: 'Dark machined' },
];

export const LIGHT_HUES = [
  { id: 'xenon', name: 'Xenon White', hex: '#e8f1ff' },
  { id: 'ice', name: 'Ice Blue', hex: '#6fc3ff' },
  { id: 'amber', name: 'Amber', hex: '#ffab2e' },
  { id: 'violet', name: 'Violet', hex: '#a06bff' },
  { id: 'lime', name: 'Lime', hex: '#b6ff3d' },
];

export const LIVERIES = [
  { id: 'none', name: 'None' },
  { id: 'twin', name: 'Twin stripe' },
  { id: 'centre', name: 'Centre band' },
  { id: 'offset', name: 'Offset stripe' },
];

export const STRIPE_COLOURS = [
  { id: 'white', name: 'White', hex: '#f1f1f1' },
  { id: 'black', name: 'Black', hex: '#070707' },
  { id: 'silver', name: 'Silver', hex: '#9da2a9' },
  { id: 'red', name: 'Red', hex: '#c0100f' },
  { id: 'yellow', name: 'Yellow', hex: '#f0b400' },
];

export const WING_MODES = [
  { id: 'retracted', name: 'Retracted', hint: 'Flush with the tail' },
  { id: 'deployed', name: 'Handling', hint: 'Raised for downforce' },
  { id: 'airbrake', name: 'Airbrake', hint: 'Tilted to 49°' },
];

export const ENVIRONMENTS = [
  { id: 'dark', name: 'Dark studio' },
  { id: 'light', name: 'Light studio' },
  { id: 'dusk', name: 'Dusk' },
];

export const QUALITIES = [
  { id: 'low', name: 'Low', hint: 'No post-processing' },
  { id: 'medium', name: 'Medium', hint: 'Bloom, sharper reflections' },
  { id: 'high', name: 'High', hint: 'Ambient occlusion, 2× pixels' },
];

// Camera presets. Positions are for a 16:9 frame and are pulled back on
// narrower screens (see Showroom.fit).
export const VIEWS = [
  { id: 'hero', name: 'Hero', pos: [4.0, 1.2, 5.3], target: [0, 0.5, 0] },
  { id: 'front', name: 'Front', pos: [0, 0.85, 7.0], target: [0, 0.55, 0] },
  { id: 'side', name: 'Profile', pos: [7.3, 0.8, 0.15], target: [0, 0.55, 0] },
  { id: 'rear', name: 'Rear', pos: [-3.9, 1.45, -5.9], target: [0, 0.55, 0] },
  { id: 'top', name: 'Top', pos: [0, 9.6, 0.02], target: [0, 0.4, 0] },
  { id: 'wheel', name: 'Wheel', pos: [3.5, 0.62, 3.9], target: [0.75, 0.4, 1.0], close: true },
  { id: 'engine', name: 'Engine', pos: [-1.9, 3.3, -4.9], target: [0, 0.75, -0.95], close: true },
  { id: 'tail', name: 'Tail', pos: [2.0, 1.05, -5.9], target: [0, 0.68, -1.7], close: true },
];

export const SPECS = [
  { value: '1,500', unit: 'PS', label: '8.0 L W16 quad-turbo' },
  { value: '1,600', unit: 'Nm', label: 'Torque' },
  { value: '< 2.5', unit: 's', label: '0 – 100 km/h' },
  { value: '420', unit: 'km/h', label: 'Top speed, limited' },
];

export const DEFAULTS = {
  front: 'racing-blue',
  rear: 'atlantic',
  finish: 'gloss',
  caliper: 'blue',
  wheels: 'duo',
  lights: true,
  lightHue: 'xenon',
  livery: 'none',
  stripe: 'white',
  wing: 'deployed',
  view: 'hero',
  grid: false,
  environment: 'dark',
  quality: 'high',
  sound: false,
  autoRotate: false,
  exposure: 1,
  bloom: 0.45,
  envRotation: 0,
};

export const REPO_URL = 'https://github.com/1337Impact/bugatti-chiron-showroom';
export const MODEL_URL = 'https://blendswap.com/blend/32484';

export const byId = (list, id) => list.find((x) => x.id === id);
