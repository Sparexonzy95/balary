import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { AnnouncementBar } from "./AnnouncementBar";

const LANDING_LOGO = "https://res.cloudinary.com/dsbmr3xin/image/upload/v1786656190/bi_scp3ev.png";

/* ---------------------------
   DATA
---------------------------- */
const RESOURCES = [
  { label: "Workflow", href: "#how-section" },
  { label: "Security", href: "#security" },
];

const NAV_LINKS = [
  { label: "Institution", href: "#employers" },
  { label: "Employee Claims", href: "#employees" },
];

const ANNOUNCEMENT_MESSAGE = "COSTON2 USD₮0 PAYROLL IS LIVE ON TESTNET";

/* ---------------------------
   ANIMATION
---------------------------- */
const mobileMenuContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, duration: 0.2 },
  },
  exit: { opacity: 0 },
};

const mobileItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

function BrandMark() {
  return <img src={LANDING_LOGO} alt="Balary" className="balary-landing-wordmark" aria-label="Balary" />;
}

/* ---------------------------
   NAVBAR
---------------------------- */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);

  /* LOCK SCROLL */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  /* CLOSE DROPDOWN OUTSIDE CLICK */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setResourcesOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <header
      className={`zl-navbar fixed top-0 z-50 w-full ${
        announcementVisible ? "zl-navbar-with-announcement" : "zl-navbar-no-announcement"
      }`}
    >
      {/* ---------------- ANNOUNCEMENT BAR (desktop) ---------------- */}
      <AnimatePresence>
        {announcementVisible && (
          <AnnouncementBar
            message={ANNOUNCEMENT_MESSAGE}
            onClose={() => setAnnouncementVisible(false)}
          />
        )}
      </AnimatePresence>

      {/* ---------------- NAVBAR ---------------- */}
      <div className="relative border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <nav className="zl-navbar-row mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 md:px-12">
          {/* LOGO */}
          <Link to="/" aria-label="Go to Balary home">
            <BrandMark />
          </Link>

          {/* DESKTOP NAV */}
          <div className="hidden items-center gap-6 text-white/70 lg:flex">
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setResourcesOpen((value) => !value)}
                className="transition hover:text-white"
              >
                Resources
              </button>

              {resourcesOpen && (
                <div className="absolute top-full mt-3 w-48 rounded-xl border border-white/10 bg-black/80 p-2 backdrop-blur-xl">
                  {RESOURCES.map((resource) => (
                    <a
                      key={resource.label}
                      href={resource.href}
                      className="block px-3 py-2 transition hover:text-white"
                      onClick={() => setResourcesOpen(false)}
                    >
                      {resource.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* DESKTOP CTA */}
          <Link
            to="/app"
            className="decrypt-hover-btn hidden bg-[#FE9E15] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#FE9E15]/90 md:block"
          >
            Launch App
          </Link>

          {/* ---------------- MOBILE TOGGLE ---------------- */}
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="relative z-50 flex h-10 w-10 items-center justify-center lg:hidden"
            aria-label="menu toggle"
            aria-expanded={mobileOpen}
          >
            <div className="relative flex h-6 w-6 items-center justify-center">
              {/* TOP */}
              <motion.span
                className="absolute h-[2px] w-6 bg-white"
                animate={{
                  rotate: mobileOpen ? 45 : 0,
                  y: mobileOpen ? 0 : -6,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />

              {/* MIDDLE */}
              <motion.span
                className="absolute h-[2px] w-6 bg-white"
                animate={{
                  opacity: mobileOpen ? 0 : 1,
                  scaleX: mobileOpen ? 0 : 1,
                }}
              />

              {/* BOTTOM */}
              <motion.span
                className="absolute h-[2px] w-6 bg-white"
                animate={{
                  rotate: mobileOpen ? -45 : 0,
                  y: mobileOpen ? 0 : 6,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
            </div>
          </button>
        </nav>
      </div>

      {/* ---------------- MOBILE MENU ---------------- */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            variants={mobileMenuContainer}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-0 z-40 flex flex-col bg-black/80 backdrop-blur-xl"
          >
            {/* ANNOUNCEMENT BAR (mobile) */}
            {announcementVisible && (
              <AnnouncementBar
                message={ANNOUNCEMENT_MESSAGE}
                onClose={() => setAnnouncementVisible(false)}
              />
            )}

            {/* TOP BAR */}
            <div className="flex items-center justify-between px-6 py-5">
              {/* LOGO */}
              <Link to="/" onClick={closeMobileMenu} aria-label="Go to Balary home">
                <BrandMark />
              </Link>

              {/* CLOSE ICON */}
              <button
                type="button"
                onClick={closeMobileMenu}
                className="relative z-50 flex h-10 w-10 items-center justify-center"
                aria-label="Close menu"
              >
                <div className="relative flex h-6 w-6 items-center justify-center">
                  <span className="absolute h-[2px] w-6 rotate-45 bg-white" />
                  <span className="absolute h-[2px] w-6 -rotate-45 bg-white" />
                </div>
              </button>
            </div>

            {/* LINKS */}
            <motion.div className="flex flex-1 flex-col justify-center px-6">
              {[...RESOURCES, ...NAV_LINKS].map((item) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  onClick={closeMobileMenu}
                  variants={mobileItem}
                  className="py-4 text-lg text-white/70 transition hover:text-white"
                >
                  {item.label}
                </motion.a>
              ))}
            </motion.div>

            {/* MOBILE CTA */}
            <motion.div variants={mobileItem} className="px-6 pb-8">
              <Link
                to="/app"
                onClick={closeMobileMenu}
                className="decrypt-hover-btn block w-full rounded-lg bg-[#FE9E15] py-3 text-center text-sm font-semibold text-black transition hover:bg-[#FE9E15]/90"
              >
                Launch App
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
