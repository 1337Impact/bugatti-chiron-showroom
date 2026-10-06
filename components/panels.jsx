import {
  PAINTS, DUOS, FINISHES, CALIPERS, WHEELS, LIGHT_HUES, LIVERIES, STRIPE_COLOURS,
  WING_MODES, ENVIRONMENTS, QUALITIES, VIEWS, byId,
} from '@/lib/config';
import { PanelHead, Label, Swatches, Chips, ToggleRow, SliderRow, ColourRow } from './ui';

export const paintName = (id) => byId(PAINTS, id)?.name ?? 'Custom';
const hexOf = (list, value) => byId(list, value)?.hex ?? value;

/**
 * The body of one popover.
 *   cfg     snapshot of the showroom state
 *   apply   (fn) => run fn(showroom) with a click sound, then re-sync cfg
 *   live    same without the sound, for sliders and colour pickers
 */
export function PanelBody({ id, cfg, apply, live, fly, servo, tick, onReset, paintZone, setPaintZone }) {
  switch (id) {
    case 'paint':
      return (
        <>
          <PanelHead title="Paint" value={paintName(cfg[paintZone])} />
          <div className="segmented" role="group" aria-label="Body section">
            {['front', 'rear'].map((zone) => (
              <button key={zone} type="button" aria-pressed={paintZone === zone} onClick={() => { tick(); setPaintZone(zone); }}>
                {zone}
              </button>
            ))}
          </div>
          <Label>{paintZone === 'front' ? 'Front section' : 'Rear section'}</Label>
          <Swatches options={PAINTS} value={cfg[paintZone]} onPick={(v) => apply((s) => s.setPaint(paintZone, v))} />
          <Label>Two-tone presets</Label>
          <div className="swatches">
            {DUOS.map((d) => (
              <button
                key={d.name}
                type="button"
                className="swatch duo"
                title={d.name}
                aria-label={`${d.name}: ${paintName(d.front)} and ${paintName(d.rear)}`}
                aria-pressed={cfg.front === d.front && cfg.rear === d.rear}
                style={{ '--c': byId(PAINTS, d.front).hex, '--c2': byId(PAINTS, d.rear).hex }}
                onClick={() => apply((s) => { s.setPaint('front', d.front); s.setPaint('rear', d.rear); })}
              />
            ))}
          </div>
        </>
      );

    case 'finish':
      return (
        <>
          <PanelHead title="Finish" value={byId(FINISHES, cfg.finish).name} />
          <Chips options={FINISHES} value={cfg.finish} columns="five" onPick={(v) => apply((s) => s.setFinish(v))} />
        </>
      );

    case 'brakes':
      return (
        <>
          <PanelHead title="Brake calipers" value={byId(CALIPERS, cfg.caliper)?.name ?? 'Custom'} />
          <Swatches options={CALIPERS} value={cfg.caliper} onPick={(v) => apply((s) => s.setCaliper(v))} />
        </>
      );

    case 'wheels':
      return (
        <>
          <PanelHead title="Wheels" value={byId(WHEELS, cfg.wheels).name} />
          <Chips options={WHEELS} value={cfg.wheels} onPick={(v) => apply((s) => s.setWheels(v))} />
        </>
      );

    case 'lights':
      return (
        <>
          <PanelHead title="Lights" value={cfg.lights ? 'On' : 'Off'} />
          <ToggleRow label="Headlights and tail light" on={cfg.lights} onChange={(on) => apply((s) => s.setLights(on))} />
          <Label>Headlight hue</Label>
          <Swatches
            options={LIGHT_HUES}
            value={cfg.lightHue}
            onPick={(v) => apply((s) => { s.setLightHue(v); if (!s.state.lights) s.setLights(true); })}
          />
        </>
      );

    case 'livery':
      return (
        <>
          <PanelHead title="Livery" value={byId(LIVERIES, cfg.livery).name} />
          <Chips options={LIVERIES} value={cfg.livery} columns="four" onPick={(v) => apply((s) => s.setLivery(v))} />
          <Label>Stripe colour</Label>
          <Swatches
            options={STRIPE_COLOURS}
            value={cfg.stripe}
            onPick={(v) => apply((s) => { s.setStripe(v); if (s.state.livery === 'none') s.setLivery('twin'); })}
          />
        </>
      );

    case 'wing':
      return (
        <>
          <PanelHead title="Rear wing" value={byId(WING_MODES, cfg.wing).name} />
          <Chips
            options={WING_MODES}
            value={cfg.wing}
            onPick={(v) => {
              if (v === cfg.wing) return;
              apply((s) => s.setWing(v));
              servo();
              if (cfg.view !== 'rear' && cfg.view !== 'tail') fly('rear');
            }}
          />
        </>
      );

    case 'views':
      return (
        <>
          <PanelHead title="Camera" value={byId(VIEWS, cfg.view)?.name ?? 'Free'} />
          <Chips options={VIEWS} value={cfg.view} columns="four" onPick={(v) => { tick(1.15); fly(v); }} />
        </>
      );

    case 'background':
      return (
        <>
          <PanelHead title="Environment" value={byId(ENVIRONMENTS, cfg.environment).name} />
          <Chips options={ENVIRONMENTS} value={cfg.environment} onPick={(v) => apply((s) => s.setEnvironment(v))} />
        </>
      );

    case 'quality':
      return (
        <>
          <PanelHead title="Graphics quality" value={byId(QUALITIES, cfg.quality).name} />
          <Chips options={QUALITIES} value={cfg.quality} onPick={(v) => apply((s) => s.setQuality(v))} />
        </>
      );

    case 'settings':
      return (
        <>
          <PanelHead title="Settings" />
          <ToggleRow label="Auto-rotate" on={cfg.autoRotate} onChange={(on) => apply((s) => s.setAutoRotate(on))} />
          <SliderRow label="Exposure" min={0.5} max={1.8} value={cfg.exposure} onChange={(v) => live((s) => s.setExposure(v))} />
          <SliderRow label="Bloom" min={0} max={1.5} value={cfg.bloom} onChange={(v) => live((s) => s.setBloom(v))} />
          <SliderRow label="Rotate lighting" min={0} max={6.283} value={cfg.envRotation} onChange={(v) => live((s) => s.setEnvironmentRotation(v))} />
          <Label>Custom colours</Label>
          <ColourRow label="Front section" value={hexOf(PAINTS, cfg.front)} onChange={(v) => live((s) => s.setPaint('front', v))} />
          <ColourRow label="Rear section" value={hexOf(PAINTS, cfg.rear)} onChange={(v) => live((s) => s.setPaint('rear', v))} />
          <ColourRow label="Brake calipers" value={hexOf(CALIPERS, cfg.caliper)} onChange={(v) => live((s) => s.setCaliper(v))} />
          <div className="pop-foot">
            <button type="button" className="button" onClick={onReset}>Reset configuration</button>
          </div>
        </>
      );

    default:
      return null;
  }
}
