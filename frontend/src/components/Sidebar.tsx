import React from 'react';
import Stats from './Stats';
import { motion } from 'framer-motion';

interface Move {
  player: string;
  column: number;
}

interface SidebarProps {
  history: Move[];
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ history, onClose }) => (
  <motion.aside
    initial={{ x: 256, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: 256, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    className="fixed top-0 right-0 w-64 h-full bg-gray-900 bg-opacity-75 backdrop-blur-lg p-6 z-50 rounded-l-lg shadow-lg flex flex-col"
  >
    <button onClick={onClose} className="absolute top-2 right-2 text-white text-xl">&times;</button>
    <h2 className="text-lg font-bold mb-4 text-white">Game Stats</h2>
    <Stats />
    <hr className="my-4 border-white opacity-20" />
    <h2 className="text-lg font-bold mb-2 text-white">Move History ({history.length})</h2>
    <div className="flex-1 overflow-y-auto">
      <ul className="space-y-1">
        {history.map((move, idx) => (
          <motion.li
            key={idx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.3 }}
            className="flex items-center p-2 rounded hover:bg-white/10 transition-colors"
          >
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${move.player === 'Red' ? 'bg-red-500' : 'bg-yellow-500'}`} />
            <span className="flex-1 text-white">{idx + 1}. {move.player} → Col {move.column + 1}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  </motion.aside>
);

export default Sidebar;
