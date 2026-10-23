import type { CSSProperties, ReactNode } from "react";
import { SkeletonExit } from "./PageReveal";
import { DRIPS, POOLS, type Ink } from "./printerLoaderArt";
import s from "./PrinterLoader.module.css";

// A large-format flex printer in CSS 3D: the head sweeps behind the glass, the banner feeds out of
// the slot and its wet edge drips ink that splashes and pools on the floor. Pure markup and CSS
// (transform/opacity animations), so it renders on the server and appears the moment a route starts
// loading. Coordinates are px around the stage centre; +y is down and +z is towards the viewer.

const FLOOR_Y = 84;
const FLOOR_W = 560;
const FLOOR_D = 320;

type FaceName = "front" | "back" | "left" | "right" | "top" | "bottom";

/** A box of w × h × d centred at x, y, z, with optional content for each face. */
function Box({ w, h, d, x = 0, y = 0, z = 0, className, faces = {} }: { w: number; h: number; d: number; x?: number; y?: number; z?: number; className: string; faces?: Partial<Record<FaceName, ReactNode>> }) {
  const face = (name: FaceName, fw: number, fh: number, transform: string) => (
    <div className={`${s.face} ${s[name]}`} style={{ width: fw, height: fh, left: (w - fw) / 2, top: (h - fh) / 2, transform }}>
      {faces[name]}
    </div>
  );
  return (
    <div className={`${s.box} ${className}`} style={{ width: w, height: h, left: -w / 2, top: -h / 2, transform: `translate3d(${x}px, ${y}px, ${z}px)` }}>
      {face("front", w, h, `translateZ(${d / 2}px)`)}
      {face("back", w, h, `rotateY(180deg) translateZ(${d / 2}px)`)}
      {face("right", d, h, `rotateY(90deg) translateZ(${w / 2}px)`)}
      {face("left", d, h, `rotateY(-90deg) translateZ(${w / 2}px)`)}
      {face("top", w, d, `rotateX(90deg) translateZ(${h / 2}px)`)}
      {face("bottom", w, d, `rotateX(-90deg) translateZ(${h / 2}px)`)}
    </div>
  );
}

/** A flat plane lying on the floor (its top edge is the back, its bottom edge the front). */
function FloorPlane({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`${s.plane} ${className}`} style={{ width: FLOOR_W, height: FLOOR_D, left: -FLOOR_W / 2, top: -FLOOR_D / 2, transform: `translate3d(0, ${FLOOR_Y}px, 0) rotateX(90deg)` }}>
      <svg width={FLOOR_W} height={FLOOR_D} viewBox={`${-FLOOR_W / 2} ${-FLOOR_D / 2} ${FLOOR_W} ${FLOOR_D}`} aria-hidden="true">
        {children}
      </svg>
    </div>
  );
}

const INK_STOPS: Record<Ink, [string, string, string]> = {
  c: ["#5FD3F5", "#00A6D6", "#00759A"],
  m: ["#FF5CB3", "#E5007E", "#A3005A"],
  y: ["#FFF07A", "#FFD400", "#D9A400"],
  k: ["#5A5F66", "#1E1E1E", "#050505"],
};

/** One tile of the banner artwork (repeated so the feed loops seamlessly). */
function BannerTile() {
  return (
    <div className={s.tile}>
      <div className={s.tileBars}>
        <i style={{ background: "#00A6D6" }} />
        <i style={{ background: "#E5007E" }} />
        <i style={{ background: "#FFD400" }} />
        <i style={{ background: "#1E1E1E" }} />
      </div>
      <div className={s.tileHero}>
        <span className={s.sun} />
        <span className={s.hill} />
      </div>
      <div className={s.tileLine} style={{ width: "78%" }} />
      <div className={s.tileLine} style={{ width: "54%", background: "#E5007E" }} />
      <div className={s.tileDots}>
        <i style={{ background: "#00A6D6" }} />
        <i style={{ background: "#FFD400" }} />
        <i style={{ background: "#E5007E" }} />
      </div>
    </div>
  );
}

export default function PrinterLoader({ label = "Printing your page", immediate = false }: { label?: string; /** Skip the short wait before appearing (the caller already waited). */ immediate?: boolean }) {
  return (
    <SkeletonExit>
      <div className={`${s.root} ${immediate ? s.immediate : ""}`} data-printer-loader role="status" aria-live="polite" aria-label={`${label}…`}>
        <div className={s.scene} aria-hidden="true">
          <div className={s.stage}>
            {/* Soft contact shadow (static, so its blur is painted once). */}
            <FloorPlane className={s.shadowPlane}>
              <defs>
                <radialGradient id="pl-floor" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#E9EDF2" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#EEF1F5" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#F4F6F8" stopOpacity="0" />
                </radialGradient>
                <filter id="pl-blur" x="-30%" y="-60%" width="160%" height="220%">
                  <feGaussianBlur stdDeviation="9" />
                </filter>
              </defs>
              <ellipse cx="0" cy="10" rx="270" ry="150" fill="url(#pl-floor)" />
              <ellipse cx="0" cy="-6" rx="168" ry="62" fill="#0F172A" opacity="0.22" filter="url(#pl-blur)" />
              <ellipse cx="-131" cy="0" rx="24" ry="42" fill="#0F172A" opacity="0.18" filter="url(#pl-blur)" />
              <ellipse cx="131" cy="0" rx="24" ry="42" fill="#0F172A" opacity="0.18" filter="url(#pl-blur)" />
            </FloorPlane>

            {/* Ink on the floor: spreading pools and the splats from each drip. */}
            <FloorPlane className={s.inkPlane}>
              <defs>
                {(Object.keys(INK_STOPS) as Ink[]).map((k) => (
                  <radialGradient key={k} id={`pl-ink-${k}`} cx="42%" cy="40%" r="65%">
                    <stop offset="0%" stopColor={INK_STOPS[k][0]} />
                    <stop offset="55%" stopColor={INK_STOPS[k][1]} />
                    <stop offset="100%" stopColor={INK_STOPS[k][2]} />
                  </radialGradient>
                ))}
              </defs>
              <g className={s.inkLayer}>
                {POOLS.map((p, i) => (
                  <g key={`p${i}`} transform={`translate(${p.x} ${p.z})`}>
                    <g className={s.pool} style={{ animationDelay: `${p.delay}s` } as CSSProperties}>
                      <path d={p.d} fill={`url(#pl-ink-${p.ink})`} />
                      <ellipse cx="-8" cy="-6" rx="10" ry="4" fill="#fff" opacity="0.35" />
                    </g>
                  </g>
                ))}
                {DRIPS.map((d, i) => (
                  <g key={`s${i}`} transform={`translate(${d.x} ${d.landZ})`}>
                    <g className={s.splat} style={{ animationDelay: `${d.delay}s` } as CSSProperties}>
                      <path d={d.splat.body} fill={`url(#pl-ink-${d.ink})`} />
                      {d.splat.drops.map((c, j) => (
                        <circle key={j} cx={c.cx} cy={c.cy} r={c.r} fill={INK_STOPS[d.ink][1]} />
                      ))}
                      <ellipse cx="-4" cy="-4" rx="5" ry="2" fill="#fff" opacity="0.45" />
                    </g>
                  </g>
                ))}
              </g>
            </FloorPlane>

            {/* Stand: a leg under each end cap, clear of the banner and roller */}
            {[-131, 131].map((x) => (
              <div key={x}>
                <Box className={s.leg} w={12} h={128} d={14} x={x} y={12} z={0} />
                <Box className={s.foot} w={24} h={8} d={78} x={x} y={80} z={0} />
              </div>
            ))}

            {/* Carriage rail and the print head, seen through the glass */}
            <Box className={s.rail} w={236} h={4} d={4} x={0} y={-76} z={26} />
            <div className={s.headTrack}>
              <Box
                className={s.head}
                w={34}
                h={24}
                d={24}
                x={0}
                y={-88}
                z={20}
                faces={{
                  front: (
                    <div className={s.carts}>
                      <i style={{ background: "#00A6D6" }} />
                      <i style={{ background: "#E5007E" }} />
                      <i style={{ background: "#FFD400" }} />
                      <i style={{ background: "#3A3F46" }} />
                    </div>
                  ),
                }}
              />
            </div>

            {/* Body: centre section with its glass window, and the two end caps */}
            <Box
              className={s.body}
              w={240}
              h={64}
              d={96}
              x={0}
              y={-84}
              z={0}
              faces={{
                front: (
                  <>
                    <div className={s.glass} />
                    <div className={s.slot} />
                  </>
                ),
                top: <div className={s.vents} />,
              }}
            />
            <Box
              className={s.cap}
              w={22}
              h={70}
              d={100}
              x={-131}
              y={-85}
              z={0}
              faces={{
                front: (
                  <div className={s.capStripe}>
                    <i style={{ background: "#00A6D6" }} />
                    <i style={{ background: "#E5007E" }} />
                    <i style={{ background: "#FFD400" }} />
                    <i style={{ background: "#1E1E1E" }} />
                  </div>
                ),
              }}
            />
            <Box
              className={s.cap}
              w={22}
              h={70}
              d={100}
              x={131}
              y={-85}
              z={0}
              faces={{
                front: (
                  <>
                    <div className={s.screen} />
                    <div className={s.led} />
                  </>
                ),
              }}
            />

            {/* Banner feeding out of the slot, down to the take-up roller */}
            <div className={s.banner}>
              <div className={s.print}>
                <BannerTile />
                <BannerTile />
              </div>
              <div className={s.bannerShade} />
              <div className={s.wetEdge} />
            </div>
            <Box className={s.roller} w={200} h={10} d={10} x={0} y={30} z={69} />

            {/* Drips leaving the wet edge */}
            {DRIPS.map((d, i) => (
              <div key={i} className={s.dripAnchor} style={{ transform: `translate3d(${d.x}px, 36px, 69px)` }}>
                <div className={`${s.drip} ${s[`ink_${d.ink}`]}`} style={{ animationDelay: `${d.delay}s` }} />
              </div>
            ))}
          </div>
        </div>
        <p className={s.label}>
          {label}
          <span className={s.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
      </div>
    </SkeletonExit>
  );
}
