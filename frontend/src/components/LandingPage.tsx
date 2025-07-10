import React from 'react';
import './LandingPage.css';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="landing-container">
      <div className="title-animation">
        <h1 className="text-6xl font-extrabold title-gradient hover-wiggle title-float">Connect Four AI</h1>
        <div className="disc-row bounce">
          <div className="disc red disc-animation"></div>
          <div className="disc yellow disc-animation delay-200"></div>
          <div className="disc red disc-animation delay-400"></div>
        </div>
      </div>
      <button className="start-button" onClick={onStart}>
        Play Now
      </button>
    </div>
  );
};

export default LandingPage;
