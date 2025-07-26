'use client';

import { useEffect, useState } from 'react';
import styles from '../styles/landing.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { HiOutlineMail } from "react-icons/hi";

import WorkExperienceSection from './WorkExperienceSection';
import EducationSection from './EducationSection'; // new
import ChatbotButton from './ChatbotButton';
import ChatSection from './ChatSection';
import Link from 'next/link';

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
  educations: Experience[];
}

export default function Home({ workExperiences, educations }: HomeProps) {
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
      .then(setAboutContent);
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

      {!scrolled && (
        <div className={styles.floatingImageWrapper}>
          <img
            src="/profile.jpg"
            alt="Profile"
            className={styles.floatingImage}
          />
        </div>
      )}

      <div className={styles.container}>
        {scrolled && (
          <div className={styles.navbar}>
            <div className={styles.navTitle} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span>Naitik Gupta</span>
              <a href="https://github.com/naitikg2305" target="_blank" rel="noopener noreferrer" style={{ color: '#fff' }}>
                <FaGithub />
              </a>
              <a href="https://linkedin.com/in/naitikg2305" target="_blank" rel="noopener noreferrer" style={{ color: '#0077b5' }}>
                <FaLinkedin />
              </a>
              <a href="mailto:naitikg2305@gmail.com" style={{ color: '#00ff00' }}>
                <HiOutlineMail />
              </a>
              <ChatbotButton />
            </div>

            <div className={styles.navLinks}>
              <Link href="#">Home</Link>
              <Link href="#experience">Experience</Link>
              <Link href="#education">Education</Link> {/* NEW */}
              <Link href="/projects">Projects</Link>
              <Link href="/builds">Builds</Link>
              <Link href="/knowledge">Knowledge</Link>
              <Link href="/interests">Interests</Link>
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
        <EducationSection educations={educations} /> {/* NEW */}

        <div id="chat">
          <ChatSection />
        </div>
      </div>
    </div>
  );
}
