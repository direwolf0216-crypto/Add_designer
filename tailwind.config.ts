import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Channel tokens live in globals.css (`--name: r g b`) so opacity modifiers like bg-brand/10 work.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  // Hover styles only on devices that can hover, so taps on phones never leave a stuck hover state.
  future: { hoverOnlyWhenSupported: true },
  // Scan all of src: class names also live in src/features and in lib modules (e.g. category themes).
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // `short:` targets viewports under 800px tall (1366x768 laptops, phones in landscape), where
      // hero pages must shrink to fit without scrolling.
      screens: {
        short: { raw: "(max-height: 800px)" },
      },
      // base-ui marks state with bare data attributes (data-open, data-closed, …).
      data: {
        open: "open",
        closed: "closed",
        disabled: "disabled",
        placeholder: "placeholder",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '14%': { transform: 'scale(1.2)', opacity: '0.8' },
          '28%': { transform: 'scale(1)', opacity: '1' },
          '42%': { transform: 'scale(1.2)', opacity: '0.8' },
          '70%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        heartbeat: 'heartbeat 1.5s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
        // Dialogs grow out of the button that opened them and shrink back (keyframes in globals.css).
        'dialog-pop': 'dialog-pop 0.22s cubic-bezier(0.2, 0.9, 0.25, 1) both',
        'dialog-unpop': 'dialog-unpop 0.15s cubic-bezier(0.4, 0, 1, 1) both',
      },
      borderRadius: {
        card: "20px",
        control: "12px",
        chip: "8px",
      },
      colors: {
        // Surfaces and lines (light theme, accent-ladder style).
        ground: token("ground"),
        surface: token("surface"),
        raised: token("raised"),
        active: token("active"),
        line: token("line"),
        rule: token("rule"),
        control: token("control"),

        // Text tiers; every one reaches 4.5:1 on ground and surface.
        ink: token("ink"),
        subtle: token("subtle"),
        faint: token("faint"),

        // The one hue (the brand's orange): full strength on small marks only, tints on areas.
        brand: {
          DEFAULT: token("brand"),
          mark: token("brand-mark"),
          soft: token("brand-soft"),
          track: token("brand-track"),
          ink: token("brand-ink"),
        },

        // Status: text colours and the pale pill pairs.
        positive: { DEFAULT: token("positive"), soft: token("positive-soft"), ink: token("positive-ink") },
        negative: { DEFAULT: token("negative"), soft: token("negative-soft"), ink: token("negative-ink") },
        warning: { DEFAULT: token("warning"), soft: token("warning-soft"), ink: token("warning-ink"), line: token("warning-line") },

        // shadcn / base-ui semantic names, mapped onto the tokens above.
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        success: token("success"),
        info: token("info"),
      },
    },
  },
  plugins: [animate],
};
export default config;
