'use client';
import { useEffect } from 'react';
import styles from '../styles/ChatbotButton.module.css';

export default function ChatbotButton() {
  const handleClick = () => {
    const chatSection = document.getElementById('chat');
    if (chatSection) {
      chatSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button onClick={handleClick} className={styles.askAiButton}>
      🤖 Ask AI
    </button>
  );
}
