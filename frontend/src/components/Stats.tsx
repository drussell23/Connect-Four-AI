import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';

// Register chart components
Chart.register(ArcElement, Tooltip, Legend);

interface StatsData {
  wins: number;
  losses: number;
  draws: number;
}

const Stats: React.FC = () => {
  
  
  const [stats, setStats] = useState<StatsData>({ wins: 0, losses: 0, draws: 0 });
  // Destructure counts for clarity
  const { wins, losses, draws } = stats;

  // Load stats from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('connect4Stats');
    if (stored) {
      setStats(JSON.parse(stored));
    }
  }, []);

  // Listen for stats updates via custom events

  // Summary of stats: wins, losses, draws
  useEffect(() => {
    const handleStatsEvent = (e: CustomEvent<StatsData>) => {
      setStats(e.detail);
    };
    window.addEventListener('statsUpdate', handleStatsEvent as EventListener);
    return () => window.removeEventListener('statsUpdate', handleStatsEvent as EventListener);
  }, []);

  const total = stats.wins + stats.losses + stats.draws;
  const winRate = total > 0 ? (stats.wins / total) * 100 : 0;

  const data = {
    labels: ['Wins', 'Losses', 'Draws'],
    datasets: [
      {
        data: [stats.wins, stats.losses, stats.draws],
        backgroundColor: ['#10B981', '#EF4444', '#FBBF24'],
        hoverBackgroundColor: ['#059669', '#DC2626', '#D97706'],
      },
    ],
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex justify-between w-full mb-2 px-2 text-sm text-white">
        <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span> Wins: {wins}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span> Losses: {losses}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1"></span> Draws: {draws}</span>
      </div>
      <div className="w-full mb-2">
        <Pie data={data} />
      </div>
      <p className="mt-2 text-sm text-white">Win Rate: {winRate.toFixed(1)}%</p>
    </div>
  );
};

export default Stats;
