'use client';

import { useEffect, useState } from 'react';
import styles from '../styles/landing.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import WorkExperienceSection from './WorkExperienceSection';

type Experience = {
  title: string;
  company: string;
  dates: string;
  location: string;
  slug: string;
  summaryPoints: string[];
};

interface HomeProps {
  workExperiences: Experience[];
}

export default function Home({ workExperiences }: HomeProps) {
  const name = 'Naitik Gupta';
  const quote = 'Decode the world to build it better.';

  const [scrollY, setScrollY] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [nameIndex, setNameIndex] = useState(0);
  const [showQuote, setShowQuote] = useState(false);
  const [aboutContent, setAboutContent] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
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

  useEffect(() => {
    if (nameIndex < name.length) {
      const timeout = setTimeout(() => setNameIndex(nameIndex + 1), 150);
      return () => clearTimeout(timeout);
    } else if (!showQuote) {
      const quoteTimeout = setTimeout(() => setShowQuote(true), 400);
      return () => clearTimeout(quoteTimeout);
    }
  }, [nameIndex]);

  return (
    <div className={styles.pageWrapper}>
      <div
        className={styles.parallaxBackground}
        style={{ transform: `translateY(${scrollY * 0.5}px)` }}
      />

      <div className={styles.container}>
        {scrolled && (
          <div className={styles.navbar}>
            <div className={styles.navTitle}>Naitik Gupta</div>
            <div className={styles.navLinks}>
              <a href="#">Home</a>
              <a href="/projects">Projects</a>
              <a href="/builds">Builds</a>
              <a href="/knowledge">Knowledge</a>
              <a href="/interests">Interests</a>
              <a href="#experience">Experience</a>
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
            <div className={styles.terminalHeader}>about.md</div>
            <div className={styles.terminalBody}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {aboutContent}
              </ReactMarkdown>
              <span className={styles.cursor}>█</span>
            </div>
          </div>
        </div>

        <WorkExperienceSection experiences={workExperiences} />
      </div>
    </div>
  );
}
