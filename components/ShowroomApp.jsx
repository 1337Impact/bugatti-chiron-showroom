'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULTS, FINISHES, SPECS, REPO_URL, MODEL_URL, byId } from '@/lib/config';
import { Icon } from './ui';
import { PanelBody, paintName } from './panels';

// `panel: true` opens a popover; the others act immediately.
const CONTROLS = [
  { id: 'paint', label: 'Paint', icon: 'paint', panel: true, active: (c) => c.front !== DEFAULTS.front || c.rear !== DEFAULTS.rear },
  { id: 'finish', label: 'Finish', icon: 'finish', panel: true, active: (c) => c.finish !== DEFAULTS.finish },
  { id: 'brakes', label: 'Brake calipers', icon: 'brakes', panel: true, active: (c) => c.caliper !== DEFAULTS.caliper },
  { id: 'wheels', label: 'Wheels', icon: 'wheels', panel: true, active: (c) => c.wheels !== DEFAULTS.wheels },
  { id: 'lights', label: 'Lights', icon: 'lights', panel: true, active: (c) => c.lights },
  { id: 'livery', label: 'Livery', icon: 'livery', panel: true, active: (c) => c.livery !== 'none' },
  { id: 'wing', label: 'Rear wing', icon: 'wing', panel: true, active: (c) => c.wing !== DEFAULTS.wing },
  { id: 'views', label: 'Camera', icon: 'views', panel: true, active: (c) => c.view !== DEFAULTS.view },
  { id: 'grid', label: 'Floor grid', icon: 'grid', toggle: true, active: (c) => c.grid },
  { id: 'background', label: 'Environment', icon: 'background', panel: true, active: (c) => c.environment !== DEFAULTS.environment },
  { id: 'quality', label: 'Graphics quality', icon: 'quality', panel: true, active: (c) => c.quality !== DEFAULTS.quality },
  { id: 'sound', label: 'Sound', icon: (c) => (c.sound ? 'soundOn' : 'soundOff'), toggle: true, active: (c) => c.sound },
  { id: 'settings', label: 'Settings', icon: 'settings', panel: true, active: (c) => c.autoRotate },
  { id: 'photo', label: 'Take picture', icon: 'photo', active: () => false },
];

/** Eases a 0–1 progress value so the loader counts up instead of jumping. */
function useSmoothed(target) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf;
    const step = () => {
      setShown((v) => {
        const next = v + (target - v) * 0.12;
        return target - next < 0.004 ? target : next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

export default function ShowroomApp() {
  const mount = useRef(null);
  const showroom = useRef(null);
  const sound = useRef(null);
  const buttons = useRef({});
  const toastTimer = useRef(null);

  const [cfg, setCfg] = useState(DEFAULTS);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('loading'); // loading → intro → entered, or failed
  const [ui, setUi] = useState('dark');
  const [introShown, setIntroShown] = useState(false);
  const [introPage, setIntroPage] = useState(1);
  const [legalOpen, setLegalOpen] = useState(false);
  const [open, setOpen] = useState(null);
  const [lastOpen, setLastOpen] = useState('paint'); // keeps the content while the popover fades out
  const [paintZone, setPaintZone] = useState('front');
  const [toast, setToast] = useState({ text: '', shown: false });
  const [flash, setFlash] = useState(0);
  const percent = Math.round(useSmoothed(progress) * 100);

  const sync = useCallback(() => showroom.current && setCfg({ ...showroom.current.state }), []);
  const tick = useCallback((pitch) => sound.current?.tick(pitch), []);
  const apply = useCallback((fn) => {
    if (!showroom.current) return;
    tick(1.15);
    fn(showroom.current);
    sync();
  }, [sync, tick]);
  const live = useCallback((fn) => {
    if (!showroom.current) return;
    fn(showroom.current);
    sync();
  }, [sync]);
  const fly = useCallback((view) => {
    showroom.current?.flyTo(view);
    sound.current?.whoosh();
    sync();
  }, [sync]);
  const notify = useCallback((text) => {
    setToast({ text, shown: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, shown: false })), 2600);
  }, []);

  // ------------------------------------------------------------------- boot
  useEffect(() => {
    let cancelled = false;
    let instance;
    const timers = [];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    (async () => {
      // three.js and the scene are only ever needed in the browser
      const [{ Showroom }, { Sound }] = await Promise.all([import('@/lib/showroom'), import('@/lib/audio')]);
      if (cancelled) return;
      instance = showroom.current = new Showroom(mount.current);
      sound.current = new Sound();
      instance.onEnvironment = setUi;
      instance.onInteract = () => {
        if (instance.state.view !== 'free') {
          instance.state.view = 'free';
          setCfg({ ...instance.state });
        }
      };
      if (process.env.NODE_ENV !== 'production') window.showroom = instance;

      const loaded = await instance.load((p) => !cancelled && setProgress(p));
      if (cancelled || !loaded) return;
      setCfg({ ...instance.state });
      timers.push(
        setTimeout(() => {
          setPhase('intro');
          if (reducedMotion) instance.moveCar(0);
          instance.playIntro();
          timers.push(setTimeout(() => setIntroShown(true), reducedMotion ? 300 : 1700));
        }, 500)
      );
    })().catch((err) => {
      console.error(err);
      if (!cancelled) setPhase('failed');
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      clearTimeout(toastTimer.current);
      instance?.dispose();
      showroom.current = null;
    };
  }, []);

  // Step the quality down once if the device cannot hold ~30 fps.
  useEffect(() => {
    if (phase !== 'entered') return;
    let raf;
    let timer;
    const measure = () => {
      const s = showroom.current;
      if (!s || s.state.quality === 'low') return;
      let frames = 0;
      const start = performance.now();
      const count = () => {
        frames++;
        const elapsed = performance.now() - start;
        if (elapsed < 2500) return void (raf = requestAnimationFrame(count));
        const fps = (frames * 1000) / elapsed;
        // below ~5 fps the tab is being throttled in the background, which says nothing about the GPU
        if (fps > 5 && fps < 30 && showroom.current) {
          const next = s.state.quality === 'high' ? 'medium' : 'low';
          s.setQuality(next);
          sync();
          notify(`Graphics set to ${next} for a smoother frame rate`);
          timer = setTimeout(measure, 1500);
        }
      };
      raf = requestAnimationFrame(count);
    };
    timer = setTimeout(measure, 3000);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [phase, sync, notify]);

  // ---------------------------------------------------------------- actions
  const closePanel = useCallback(() => setOpen(null), []);

  const enter = useCallback(() => {
    if (!showroom.current) return;
    setIntroShown(false);
    setPhase('entered');
    showroom.current.enter();
    sound.current?.whoosh(1.6);
    sync();
  }, [sync]);

  const takePicture = () => {
    const url = showroom.current.capture();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const name = `chiron-${stamp}.png`;
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    sound.current?.shutter();
    setFlash((n) => n + 1);
    notify(`Saved ${name}`);
  };

  const toggleSound = async () => {
    const s = showroom.current;
    s.state.sound = !s.state.sound;
    sync();
    await sound.current.setEnabled(s.state.sound);
    if (s.state.sound) sound.current.tick();
  };

  const reset = () =>
    apply((s) => {
      Object.assign(s.state, { ...DEFAULTS, sound: s.state.sound, quality: s.state.quality });
      s.applyAll();
      s.setLights(true);
      s.setWing(DEFAULTS.wing);
      s.setAutoRotate(false);
      s.setEnvironmentRotation(0);
      s.flyTo(DEFAULTS.view);
      sound.current?.whoosh();
    });

  const onControl = (c) => {
    if (!showroom.current) return;
    tick();
    if (c.panel) {
      if (open === c.id) return closePanel();
      setLastOpen(c.id);
      return setOpen(c.id);
    }
    closePanel();
    if (c.id === 'grid') live((s) => s.setGrid(!s.state.grid));
    else if (c.id === 'sound') toggleSound();
    else if (c.id === 'photo') takePicture();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (legalOpen) setLegalOpen(false);
      else if (open) {
        buttons.current[open]?.focus();
        setOpen(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, legalOpen]);

  // ----------------------------------------------------------------- render
  const ready = phase === 'intro' || phase === 'entered';
  const entered = phase === 'entered';
  const body = cfg.front === cfg.rear ? paintName(cfg.front) : `${paintName(cfg.front)} · ${paintName(cfg.rear)}`;
  const appClass = ['app', ready && 'ready', entered && 'entered', open && 'panel-open'].filter(Boolean).join(' ');
  const shownPanel = byId(CONTROLS, open ?? lastOpen);

  return (
    <div className={appClass} data-ui={ui}>
      <div className="webgl" ref={mount} aria-label="Interactive 3D view of the car" onPointerDown={closePanel} />

      <header className="brand">
        <span className="brand-mark">Chiron</span>
        <span className="brand-tag">Showroom</span>
      </header>
      <p className="caption reveal" aria-live="polite">{`${body} — ${byId(FINISHES, cfg.finish).name}`}</p>

      <aside className="specs reveal" aria-label="Key figures">
        {SPECS.map((s) => (
          <div key={s.label}>
            <div className="spec-value">{s.value}<small>{s.unit}</small></div>
            <div className="spec-label">{s.label}</div>
          </div>
        ))}
      </aside>

      <div className={`loader${ready ? ' done' : ''}`} role="status" aria-label="Loading">
        <div className="rings"><i /><i /></div>
        {phase === 'failed' ? (
          <p className="loader-error">The showroom could not start. It needs a browser with WebGL 2.</p>
        ) : (
          <span className="loader-pct">{percent}</span>
        )}
      </div>

      <section className={`overlay${introShown ? ' show' : ''}`} id="intro" aria-labelledby="intro-title" inert={!introShown}>
        <div className="card glass">
          {introPage === 1 ? (
            <div className="page">
              <h1 id="intro-title">Virtual Showroom</h1>
              <p>
                A real-time, in-browser study of the <em>Bugatti Chiron</em>: sixteen cylinders, four turbochargers and
                1,500 PS, rebuilt from a Blender model and lit entirely with procedural studio lights.
              </p>
              <p>
                Repaint the two-tone body, change the finish, calipers and wheels, strike the lights, raise the rear wing
                into its airbrake position, then walk around it in three environments.
              </p>
              <p className="fine">Nothing here is pre-rendered. Every frame is drawn on your device.</p>
              <div className="card-actions">
                <button type="button" className="button" onClick={() => setIntroPage(2)}>Next</button>
              </div>
            </div>
          ) : (
            <div className="page">
              <h1 id="intro-title">Finding your way</h1>
              <ul className="hints">
                <li><b>Drag</b><span>Orbit around the car</span></li>
                <li><b>Scroll / pinch</b><span>Move closer or further away</span></li>
                <li>
                  <b>Bottom bar</b>
                  <span>Paint, finish, brakes, wheels, lights, livery, wing, camera, floor, environment, quality, sound, settings and photo</span>
                </li>
                <li><b>Esc</b><span>Close the open panel</span></li>
              </ul>
              <div className="card-actions">
                <button type="button" className="button" autoFocus onClick={enter}>Enter showroom</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section
        className={`overlay${legalOpen ? ' show' : ''}`}
        id="legal"
        aria-labelledby="legal-title"
        inert={!legalOpen}
        onClick={(e) => e.target === e.currentTarget && setLegalOpen(false)}
      >
        <div className="card glass">
          <h1 id="legal-title">Licences</h1>
          <p className="fine">
            This is an independent, non-commercial technical demonstration. It is not affiliated with, endorsed by or
            licensed by Bugatti Automobiles S.A.S. or any other manufacturer; names are used only to describe the subject.
          </p>
          <h2>3D model</h2>
          <p className="fine">
            <strong>Bugatti Chiron 2017</strong> from{' '}
            <a href={MODEL_URL} target="_blank" rel="noopener noreferrer">Blend Swap</a>, shared there by apexmesh under
            CC-BY-NC; the file credits Bob Kimani (Kimz Auto) as its modeller. It was cleaned up, re-materialed and
            exported to glTF for this page, and stays non-commercial.
          </p>
          <h2>Code</h2>
          <p className="fine">
            Open source under the MIT licence on{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>. Built with <strong>Next.js</strong>,{' '}
            <strong>three.js</strong> and <strong>N8AO</strong>; the contact shadow was baked in Blender Cycles and the
            icons were drawn for this project.
          </p>
          <h2>Inspiration</h2>
          <p className="fine">
            Layout and feature set are inspired by the{' '}
            <a href="https://labs.otherlife.xyz/virtual-car-showroom" target="_blank" rel="noopener noreferrer">
              Otherlife Labs Virtual Car Showroom
            </a>.
          </p>
          <div className="card-actions">
            <button type="button" className="button" onClick={() => setLegalOpen(false)}>Close</button>
          </div>
        </div>
      </section>

      <div className={`popover glass${open ? ' open' : ''}`} role="dialog" aria-label={shownPanel.label} inert={!open}>
        <PanelBody
          id={shownPanel.id}
          cfg={cfg}
          apply={apply}
          live={live}
          fly={fly}
          tick={tick}
          servo={() => sound.current?.servo()}
          onReset={reset}
          paintZone={paintZone}
          setPaintZone={setPaintZone}
        />
      </div>

      <nav className="control-panel glass reveal" aria-label="Configurator" inert={!entered}>
        {CONTROLS.map((c) => (
          <button
            key={c.id}
            ref={(node) => { buttons.current[c.id] = node; }}
            type="button"
            className={`ctl${c.active(cfg) ? ' on' : ''}`}
            aria-label={c.label}
            data-label={c.label}
            aria-haspopup={c.panel ? 'dialog' : undefined}
            aria-expanded={c.panel ? open === c.id : undefined}
            aria-pressed={c.toggle ? c.active(cfg) : undefined}
            onClick={() => onControl(c)}
          >
            <Icon name={typeof c.icon === 'function' ? c.icon(cfg) : c.icon} />
            <span className="dot" />
          </button>
        ))}
      </nav>

      <button type="button" className="button chrome skip" onClick={enter} inert={phase !== 'intro'}>Skip intro</button>
      <div className="corner-links reveal" inert={!entered}>
        <button type="button" className="button chrome" onClick={() => { closePanel(); setLegalOpen(true); }}>Legal</button>
        <a className="button chrome" href={REPO_URL} target="_blank" rel="noopener noreferrer">Source</a>
      </div>
      <p className="disclaimer reveal">Independent demo. Not affiliated with any car manufacturer.</p>

      <div className={`toast${toast.shown ? ' show' : ''}`} role="status">{toast.text}</div>
      {flash ? <div key={flash} className="flash go" /> : null}
    </div>
  );
}
