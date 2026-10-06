import { icons } from './icons';

export function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icons[name] }}
    />
  );
}

export function PanelHead({ title, value }) {
  return (
    <div className="pop-head">
      <h2 className="pop-title">{title}</h2>
      {value ? <span className="pop-value">{value}</span> : null}
    </div>
  );
}

export const Label = ({ children }) => <p className="pop-label">{children}</p>;

export function Swatches({ options, value, onPick }) {
  return (
    <div className="swatches">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="swatch"
          title={o.name}
          aria-label={o.name}
          aria-pressed={o.id === value}
          style={{ '--c': o.hex }}
          onClick={() => onPick(o.id)}
        />
      ))}
    </div>
  );
}

export function Chips({ options, value, onPick, columns }) {
  return (
    <div className={`chips${columns ? ` ${columns}` : ''}`}>
      {options.map((o) => (
        <button key={o.id} type="button" className="chip" aria-pressed={o.id === value} onClick={() => onPick(o.id)}>
          <b>{o.name}</b>
          {o.hint ? <span>{o.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function ToggleRow({ label, on, onChange }) {
  return (
    <div className="row">
      <label>{label}</label>
      <button type="button" className="switch" role="switch" aria-label={label} aria-checked={on} onClick={() => onChange(!on)} />
    </div>
  );
}

export function SliderRow({ label, min, max, step = 0.01, value, onChange }) {
  return (
    <div className="row">
      <label>{label}</label>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

export function ColourRow({ label, value, onChange }) {
  return (
    <div className="row">
      <label>{label}</label>
      <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
