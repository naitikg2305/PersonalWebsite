'use client';

import { useEffect, useState } from 'react';
import styles from './landing.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Home() {
  const [nameIndex, setNameIndex] = useState(0);
  const [showQuote, setShowQuote] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [aboutContent, setAboutContent] = useState('');

  const name = 'Naitik Gupta';
  const quote = 'Decode the world to build it better.';

  useEffect(() => {
    if (nameIndex < name.length) {
      const timeout = setTimeout(() => {
        setNameIndex(nameIndex + 1);
      }, 150);
      return () => clearTimeout(timeout);
    } else {
      setTimeout(() => setShowQuote(true), 400);
    }
  }, [nameIndex]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/content/about/about.md')
      .then((res) => res.text())
      .then((text) => setAboutContent(text));
  }, []);

  return (
    <div className={styles.container}>
      {/* ✅ Show navbar only after scroll */}
      {scrolled && (
        <div className={styles.navbar}>
          <div className={styles.navTitle}>Naitik Gupta</div>
          <div className={styles.navLinks}>
            <a href="#" className={styles.navLink}>Home</a>
            <a href="#projects" className={styles.navLink}>Projects</a>
            <a href="#builds" className={styles.navLink}>Builds</a>
            <a href="#knowledge" className={styles.navLink}>Knowledge</a>
            <a href="#interests" className={styles.navLink}>Interests</a>
          </div>
        </div>
      )}

      <div className={`${styles.nameContainer} ${scrolled ? styles.shrunk : ''}`}>
        <span className={styles.name}>{name.slice(0, nameIndex)}</span>
        {showQuote && !scrolled && (
          <div className={styles.quote}>{quote}</div>
        )}
      </div>

      <div className={styles.contentContainer} id="about">
        <div className={styles.terminal}>
          <div className={styles.terminalHeader}></div>
          <div className={styles.terminalBody}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {aboutContent}
            </ReactMarkdown>
            <span className={styles.cursor}>█</span>
          </div>
        </div>
      </div>
    </div>
  );
}
