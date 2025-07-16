import React, { useState, useEffect } from 'react';
import './ThreatMeter.css';

interface ThreatMeterProps {
  level: number;
  isAdapting: boolean;
}

const ThreatMeter: React.FC<ThreatMeterProps> = ({ level, isAdapting }) => {
  const maxLevel = 10;
  const percentage = (level / maxLevel) * 100;

  return (
    <div className={`threat-meter-container ${isAdapting ? 'threat-meter-adapting' : ''}`}>
      <h3 className="threat-meter-title">AI Threat Level</h3>
      <div className="threat-meter-bar-background">
        <div
          className="threat-meter-bar-foreground"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="threat-meter-level-text">
        {isAdapting ? 'AI is adapting...' : `Level ${level}`}
      </div>
    </div>
  );
};

export default ThreatMeter;
