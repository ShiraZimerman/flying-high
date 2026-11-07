import { useEffect, useRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./DesignPage.module.css";
import dotsImage from "./images/inspiration-dots.webp";
import nasaImage from "./images/inspiration-nasa.webp";
import waveImage from "./images/inspiration-wave.webp";
import phone1 from "./images/phone-1.webp";
import phone2 from "./images/phone-2.webp";
import phone3 from "./images/phone-3.webp";
import amitiPhoto from "./images/team-amiti.webp";
import moranPhoto from "./images/team-moran.webp";
import tamarPhoto from "./images/team-tamar.webp";
import yaelPhoto from "./images/team-yael.webp";

/**
 * "Copy That" - a design presentation built from our designer's Figma frame
 * (Frame 1.pdf, a 440px-wide phone screen). Hebrew, right to left.
 *
 * It is outside <RequireAuth> in client/App.tsx, so it works without logging
 * in - and without a .env file, which is how a designer can run it on their
 * own computer.
 *
 * Wider screens, as agreed with the designer: the two audiences move further
 * apart, the bubble map grows, the palette sits beside the inspirations and
 * the typography beside the logo breakdown. See DesignPage.module.css.
 */
export default function DesignPage() {
  const pageRef = usePageTop();

  return (
    <main ref={pageRef} className={styles.page} dir="rtl" lang="he">
      {/* React 19 moves this into <head>, so the fonts load only on this page.
      The Hebrew font, TheBasics, is in ./fonts/ (see the .module.css). */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Alatsi&family=MuseoModerno:wght@600&display=swap"
        precedence="default"
      />

      <div className={styles.column}>
        <header className={styles.hero}>
          <h1 className={styles.heroLogo}>
            <Logo />
          </h1>
          <p className={styles.tagline}>אפליקציית סרטונים קצרים מהחלל</p>
        </header>

        <Audiences />

        <p className={styles.paragraph}>
          המטרה שלנו היא ליצור חיבור בין שני עולמות, לא רק מקום לצפייה בסרטונים
          אלא דרך תוכן חינוכי וחווייתי קהל העוקבים יכירו את החלל ואת החיים בו
          מקרוב והאסטרונאוטים יוכלו להרגיש קצת מהחיים בכדור הארץ גם מרחוק
        </p>

        <Features />

        <p className={cx(styles.paragraph, styles.paragraphLarge)}>
          המוצר מתבסס על קשר ישיר ודינמי בין קהילת העוקבים לבין האסטרונאוטים –
          התוכן נוצר ומגיע אך ורק מהמשתמשים בשני הכיוונים והתדירות תלויה
          בפעילותם
        </p>

        <section className={cx(styles.section, styles.flow)}>
          <h2 className={styles.heading}>הדמיית פלואו</h2>
          {/* The flow reads left to right, like the phones in the design. */}
          <div className={styles.phones} dir="ltr">
            <img
              src={phone1}
              alt="מסך שאלה: What happens to an egg that breaks in space? מאת Bryan, 17"
            />
            <img src={phone2} alt="מעבר מהשאלה לתשובה של האסטרונאוטית" />
            <img src={phone3} alt="סרטון התשובה של אסטרונאוטית בתחנת החלל" />
          </div>
        </section>

        <p className={styles.paragraph}>
          העיצוב החל ממחשבה על הקונספט של חיבור בין עולמות ושאב השראה
          מהפלואידיות של מיתוג נאס״א הישן
        </p>

        {/* On wide screens, these pairs sit side by side. */}
        <div className={styles.pair}>
          <section className={styles.section}>
            <h2 className={styles.heading}>השראות עיצוביות</h2>
            <div className={styles.inspirations}>
              <img
                src={waveImage}
                alt="קו גלי שמחבר ארבע נקודות, על רקע כחול"
                className={styles.inspirationWave}
              />
              <img
                src={nasaImage}
                alt="הלוגו הישן של נאס״א, בגדלים הולכים וקטנים"
                className={styles.inspirationNasa}
              />
              <img
                src={dotsImage}
                alt="מיתוג Connect the dots: שתי נקודות כתומות שמתחברות"
                className={styles.inspirationDots}
              />
            </div>
          </section>

          <Palette />
        </div>

        <div className={styles.pair}>
          <LogoBreakdown />
          <Typography />
        </div>

        <Team />

        <footer className={styles.footer}>
          <Logo small />
        </footer>
      </div>
    </main>
  );
}

/**
 * Sets --page-top on the page to how far down it starts - the height of the
 * site's header - so the opening screen can fill exactly what is left of the
 * window. The header wraps onto more lines on narrow screens, so this is
 * measured again whenever the layout changes size.
 */
function usePageTop() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const page = ref.current;
    if (!page) return;
    const update = () => {
      const top = page.getBoundingClientRect().top + window.scrollY;
      page.style.setProperty("--page-top", `${top}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/** Two dots - the Earth and a star (or the space station) - and the name. */
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={cx(styles.logo, small && styles.logoSmall)} dir="ltr">
      <svg viewBox="0 0 50 57" className={styles.logoDots} aria-hidden="true">
        <circle cx="17" cy="40" r="16.5" />
        <circle cx="39.5" cy="17" r="9" />
      </svg>
      Copy That
    </span>
  );
}

/** Astronauts on one side, space fans on the other, questions in between. */
function Audiences() {
  return (
    <section className={styles.audiences} aria-label="למי זה מיועד">
      <div className={styles.audienceRow}>
        <span className={styles.avatar}>
          <AstronautIcon />
        </span>
        <div className={styles.betweenGroup}>
          <Chevron points="left" />
          <p className={styles.between}>שאלות ותשובות ביניהם</p>
          <Chevron points="right" />
        </div>
        <span className={styles.avatar}>
          <PersonIcon />
        </span>
      </div>

      <div className={styles.audienceText}>
        <div>
          <h2 className={styles.audienceTitle}>אסטרונאוטים בזמן משימה</h2>
          <p>שיתוף ידע וחוויות מהחלל, קשר לחיים על כדור הארץ</p>
        </div>
        <div>
          <h2 className={styles.audienceTitle}>
            חובבי חלל, תלמידים, משפחה וחברים
          </h2>
          <p>הפיכת סקרנות לחוויה מעשירה וגלילה אינסופית לבעלת ערך</p>
        </div>
      </div>
    </section>
  );
}

/** Points from an avatar toward the middle. Drawn as ">", flipped for "<". */
function Chevron({ points }: { points: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 22 36"
      className={cx(styles.chevron, points === "left" && styles.flipped)}
      aria-hidden="true"
    >
      <path d="M5 5 17 18 5 31" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="15" r="9.5" />
      <path d="M5 44c0-11 8.5-17 19-17s19 6 19 17Z" />
    </svg>
  );
}

function AstronautIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {/* Helmet, with its visor cut out. */}
      <path
        fillRule="evenodd"
        d="M24 3a15 15 0 1 1 0 30 15 15 0 0 1 0-30Zm-8 11a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6Z"
      />
      <rect x="6.5" y="13" width="3" height="10" rx="1.5" />
      <rect x="38.5" y="13" width="3" height="10" rx="1.5" />
      {/* Suit, with a control panel on the chest. */}
      <path
        fillRule="evenodd"
        d="M5 46c0-8 6-12 12-12.5a12 12 0 0 0 14 0C37 34 43 38 43 46Zm15-7v6h8v-6Z"
      />
      <rect x="23" y="41" width="2" height="3" rx="1" />
    </svg>
  );
}

/** The feature "bubble map". Positions are from the 440px-wide design. */
const FEATURES: {
  label: string;
  color: "light" | "violet" | "dark" | "tan" | "white" | "brown";
  x: number;
  y: number;
}[] = [
  { label: "מצב מאוזן", color: "light", x: 83, y: 145 },
  { label: "דואטים", color: "violet", x: 229, y: 186 },
  { label: "מצב חזרה הביתה", color: "dark", x: 152, y: 280 },
  { label: "פיד אישי", color: "tan", x: 334, y: 304 },
  { label: "שליטה קולית", color: "white", x: 61, y: 373 },
  { label: "צילום POV מהקסדה", color: "brown", x: 222, y: 408 },
];

/** Which bubbles are joined by a line, by their index in FEATURES. */
const LINKS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 4],
  [1, 3],
  [2, 5],
  [3, 5],
  [4, 5],
];

function Features() {
  return (
    <section className={styles.features}>
      <h2 className={styles.featuresTitle}>פיצ׳רים מרכזיים</h2>
      <svg
        viewBox="0 0 440 460"
        className={styles.featureLinks}
        aria-hidden="true"
      >
        {LINKS.map(([from, to]) => {
          const a = FEATURES[from]!;
          const b = FEATURES[to]!;
          return (
            <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          );
        })}
      </svg>
      <ul className={styles.featureList}>
        {FEATURES.map((feature) => (
          <li
            key={feature.label}
            className={cx(styles.bubble, styles[feature.color])}
            style={{
              insetInlineStart: `${((440 - feature.x - 46) / 440) * 100}%`,
              insetBlockStart: `${((feature.y - 46) / 460) * 100}%`,
            }}
          >
            {feature.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

const PALETTE = [
  { hex: "#BDE3FF", name: "תכלת" },
  { hex: "#BAA27E", name: "חול" },
  { hex: "#75503C", name: "חום" },
  { hex: "#738B6E", name: "ירוק" },
  { hex: "#F4EBE4", name: "שמנת" },
  { hex: "#04498C", name: "כחול" },
  { hex: "#6F8DF0", name: "סגול-כחול" },
  { hex: "#110A36", name: "כחול לילה" },
];

function Palette() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>פלטה צבעונית</h2>
      <ul className={styles.palette}>
        {PALETTE.map((color) => (
          <li
            key={color.hex}
            className={styles.swatch}
            style={{ backgroundColor: color.hex }}
            title={`${color.name} ${color.hex}`}
          >
            <span className={styles.visuallyHidden}>
              {color.name} {color.hex}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LogoBreakdown() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>פירוק הלוגו</h2>
      <div className={styles.breakdown}>
        <svg viewBox="0 0 440 290" aria-hidden="true">
          <circle cx="262" cy="78" r="24.5" className={styles.breakdownDot} />
          <circle cx="200" cy="142" r="45" className={styles.breakdownDot} />
          <path d="M392 12c0 40-36 60-94 54m8-7-8 7 8 6" />
          <path d="M112 270c40 8 70-12 75-75m-7 8 7-8 6 9" />
        </svg>
        <p className={styles.breakdownStar}>כוכב / תחנת החלל</p>
        <p className={styles.breakdownEarth}>כדור הארץ</p>
      </div>
    </section>
  );
}

function Typography() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>טיפוגרפיה מובילה</h2>
      <div className={styles.type} dir="ltr" lang="en">
        <div className={styles.museo}>
          <p className={styles.typeSample}>Logo</p>
          <p>MuseoModerno- semibold</p>
          <p>abcdefghijklmnopqrstuvwxyz</p>
          <p>1234567890</p>
        </div>
        <div className={styles.alatsi}>
          <p className={styles.typeSample}>Long Headers</p>
          <p>Alatsi- regular</p>
          <p>abcdefghijklmnopqrstuvwxyz?</p>
          <p>1234567890</p>
        </div>
      </div>
    </section>
  );
}

const TEAM = [
  { name: "תמר", role: "Backend", photo: tamarPhoto },
  { name: "אמיתי", role: "Front-end", photo: amitiPhoto },
  { name: "מורן", role: "ניהול פרוייקט ומעצבת", photo: moranPhoto },
  { name: "יעל", role: "מעצבת, כתיבה ושימושיות", photo: yaelPhoto },
];

function Team() {
  return (
    <section className={cx(styles.section, styles.teamSection)}>
      <h2 className={styles.heading}>הצוות</h2>
      <ul className={styles.team}>
        {TEAM.map((member) => (
          <li key={member.name} className={styles.member}>
            <p className={styles.memberText}>
              {member.name}
              <br />
              <span dir="auto">{member.role}</span>
            </p>
            <img src={member.photo} alt={member.name} loading="lazy" />
          </li>
        ))}
      </ul>
    </section>
  );
}
