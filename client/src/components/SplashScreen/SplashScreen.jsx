import React, { useEffect } from 'react';
import barangayLogo from '../../assets/Barangay_Logo.png';
import './SplashScreen.css';

function SplashScreen({ onComplete }) {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let secondFrame = 0;
    let timeout = 0;
    // Start the fallback after the first paint so initial rendering cannot cut the fade short.
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        timeout = window.setTimeout(onComplete, reducedMotion ? 550 : 2000);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timeout);
    };
  }, [onComplete]);

  const handleAnimationEnd = (event) => {
    if (event.target === event.currentTarget && event.animationName === 'splashFadeOut') {
      onComplete();
    }
  };

  return (
    <div
      className="splash-screen"
      role="status"
      aria-live="polite"
      aria-label="Welcome to Barangay Baclaran"
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="splash-screen__content">
        <img className="splash-screen__logo" src={barangayLogo} alt="" width="176" height="176" />
        <p className="splash-screen__barangay">Barangay Baclaran</p>
        <p className="splash-screen__system">Incident &amp; Hazard Reporting System</p>
      </div>
    </div>
  );
}

export default SplashScreen;
