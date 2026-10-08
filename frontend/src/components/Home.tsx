'use client';

import { useEffect, useState } from 'react';
import styles from '../styles/landing.module.css';
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { HiOutlineMail } from "react-icons/hi";
// import { getFeaturedProjects } from '@/lib/getFeaturedProjects';

import { useChat } from './site/ChatProvider';
import { usePalette } from './site/CommandPalette';
import BootSequence from './BootSequence';
import GitLogTimeline from './GitLogTimeline';
import Link from 'next/link';
// add this import with your other icons
import { HiOutlineDocumentText, HiOutlineSearch } from "react-icons/hi";


export default function Home() {
  const name = 'Naitik Gupta';
  const quote = 'Decode the world to build it better.';

  const [scrollY, setScrollY] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [nameIndex, setNameIndex] = useState(0);
  const [showQuote, setShowQuote] = useState(false);
  const { open: chatOpen, toggle: toggleChat } = useChat();
  const { openPalette } = usePalette();
  const [booted, setBooted] = useState(false); // name types only after the boot intro
  const [showScrollHint, setShowScrollHint] = useState(false);

  // After 5s on the landing screen, start nudging the name up to reveal a scroll hint
  useEffect(() => {
    if (!booted) return;
    const timeout = setTimeout(() => setShowScrollHint(true), 5000);
    return () => clearTimeout(timeout);
  }, [booted]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!booted) return;
    if (nameIndex < name.length) {
      const timeout = setTimeout(() => setNameIndex(nameIndex + 1), 150);
      return () => clearTimeout(timeout);
    } else if (!showQuote) {
      const quoteTimeout = setTimeout(() => setShowQuote(true), 400);
      return () => clearTimeout(quoteTimeout);
    }
  }, [nameIndex, booted]);

  return (
    <div className={styles.pageWrapper}>
      <div
        className={styles.parallaxBackground}
        style={{ transform: `translateY(${scrollY * 0.5}px)` }}
      />

      {!scrolled && booted && (
        <div className={styles.floatingImageWrapper}>
          <img
            src="/profile.jpg"
            alt="Profile"
            className={styles.floatingImage}
          />
        </div>
      )}

      <div className={styles.container}>
        <BootSequence onDone={() => setBooted(true)} />
        {scrolled && (
          <div className={styles.navbar} data-site-nav>
            <div className={styles.navTitle} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href="/" className="font-mono text-[1.05rem] font-normal" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <span className="text-[#00ff88]">naitik</span>
                <span className="text-neutral-500">@gupta:~$</span>
                <span className="ml-1 inline-block h-[1.05em] w-[0.55em] animate-pulse bg-[#00ff88] align-[-0.15em]" />
              </Link>
              <a href="https://github.com/naitikg2305" target="_blank" rel="noopener noreferrer" style={{ color: '#fff' }} aria-label="GitHub">
                <FaGithub />
              </a>
              <a href="https://linkedin.com/in/naitikg2305" target="_blank" rel="noopener noreferrer" style={{ color: '#0077b5' }} aria-label="LinkedIn">
                <FaLinkedin />
              </a>
              <a href="mailto:naitikg2305@gmail.com" style={{ color: '#00ff00' }} aria-label="Email">
                <HiOutlineMail />
              </a>
              <a href="/resume.pdf" target="_blank" rel="noopener noreferrer" aria-label="Resume (PDF)" title="Resume (PDF)" style={{ color: '#e5e7eb' }}>
                <HiOutlineDocumentText />
              </a>
              <button onClick={openPalette} aria-label="Search the site" title="Search (Ctrl K or /)" className="text-neutral-300 transition hover:text-[#00ff88]">
                <HiOutlineSearch />
              </button>
              <button
                onClick={toggleChat}
                aria-expanded={chatOpen}
                className="flex items-center gap-1.5 rounded-md border border-[#00ff88]/50 px-2.5 py-0.5 font-mono text-[13px] font-normal text-[#00ff88] transition hover:bg-[#00ff88]/10"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff88]" /> ask ai {chatOpen ? '▴' : '▾'}
              </button>
            </div>

            <div className={styles.navLinks}>
              <Link href="#">Home</Link>
              <Link href="/experience">Experience</Link>
              <Link href="/education/UMD">Education</Link>
              <Link href="/projects">Projects</Link>
              <Link href="/builds">Builds</Link>
              <Link href="/knowledge">Knowledge</Link>
              <Link href="/interests">Interests</Link>
            </div>
          </div>
        )}

        <div className={`${styles.nameContainer} ${scrolled ? styles.shrunk : ''}`}>
          <div className={showScrollHint && !scrolled ? styles.heroNudge : ''}>
            <span className={styles.name}>{name.slice(0, nameIndex)}</span>
            {showQuote && !scrolled && (
              <div className={styles.quote}>{quote}</div>
            )}
          </div>
          {showScrollHint && !scrolled && (
            <button
              className={styles.scrollHint}
              onClick={() => window.scrollTo({ top: window.innerHeight * 0.9, behavior: 'smooth' })}
              aria-label="Scroll down"
            >
              scroll ⌄
            </button>
          )}
        </div>

        <div className={styles.contentContainer} id="about">
          <GitLogTimeline />
        </div>
      </div>
    </div>
  );
}
