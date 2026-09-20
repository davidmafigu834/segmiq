import {
  buildWaveField,
  WAVE_VIEWBOX,
  type AtmosphereTone,
} from "@/components/marketing/landing/atmosphere/wave-field";

export type { AtmosphereTone };

/**
 * Section-local atmosphere: topographic dot-waves, glow, reflection, trails.
 * Must be the first child of a `.marketing-halo` section. Does not affect layout.
 */
export default function SegmiQSectionAtmosphere({ tone }: { tone: AtmosphereTone }) {
  const field = buildWaveField(tone);

  return (
    <div className={`segmiq-section-atmosphere segmiq-section-atmosphere--${tone}`} aria-hidden>
      {field.glow !== "none" ? (
        <div className={`segmiq-glow-layer segmiq-glow-layer--${field.glow}`} />
      ) : null}
      {field.reflect !== "none" ? (
        <div className={`segmiq-reflection segmiq-reflection--${field.reflect}`} />
      ) : null}

      {field.trails.length ? (
        <svg className="segmiq-light-trails" viewBox={WAVE_VIEWBOX} fill="none" preserveAspectRatio="xMidYMid slice">
          {field.trails.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      ) : null}

      <svg className="segmiq-dot-field" viewBox={WAVE_VIEWBOX} preserveAspectRatio="xMidYMid slice">
        {field.dots.map((dot, i) => (
          <circle
            key={`${tone}-${i}`}
            className={`segmiq-dot${dot.fine ? " segmiq-dot--fine" : ""}${dot.lime ? " segmiq-dot--lime" : ""}`}
            cx={dot.cx.toFixed(1)}
            cy={dot.cy.toFixed(1)}
            r={dot.r.toFixed(2)}
            opacity={dot.o.toFixed(3)}
          />
        ))}
      </svg>
    </div>
  );
}
