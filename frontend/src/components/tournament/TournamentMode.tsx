import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Line, Bar, Radar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    RadialLinearScale,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import './TournamentMode.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    RadialLinearScale,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface Tournament {
    id: string;
    name: string;
    type: 'single-elimination' | 'double-elimination' | 'round-robin' | 'swiss' | 'ladder';
    status: 'upcoming' | 'registration' | 'active' | 'completed';
    participants: number;
    maxParticipants: number;
    entryFee: number;
    prizePool: number;
    startTime: number;
    duration: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
    rules: string[];
    description: string;
}

interface Match {
    id: string;
    tournamentId: string;
    player1: Player;
    player2: Player;
    status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
    winner?: string;
    score: string;
    duration: number;
    round: number;
    bracket?: string;
}

interface Player {
    id: string;
    username: string;
    rating: number;
    rank: number;
    avatar: string;
    country: string;
    winRate: number;
    gamesPlayed: number;
    currentStreak: number;
    badges: string[];
    isOnline: boolean;
}

interface Leaderboard {
    global: Player[];
    weekly: Player[];
    monthly: Player[];
    regional: { [region: string]: Player[] };
}

interface CompetitiveStats {
    currentRating: number;
    peakRating: number;
    currentRank: number;
    bestRank: number;
    winRate: number;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    averageGameDuration: number;
    longestWinStreak: number;
    currentStreak: number;
    ratingHistory: { date: string; rating: number }[];
    achievements: Achievement[];
}

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    unlockedAt?: number;
    progress?: number;
    maxProgress?: number;
}

interface TournamentModeProps {
    isVisible: boolean;
    onClose: () => void;
    playerStats: any;
    socket?: any;
}

const TournamentMode: React.FC<TournamentModeProps> = ({
    isVisible,
    onClose,
    playerStats,
    socket
}) => {
    const [activeTab, setActiveTab] = useState<'tournaments' | 'leaderboard' | 'matches' | 'profile' | 'achievements'>('tournaments');
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
    const [competitiveStats, setCompetitiveStats] = useState<CompetitiveStats | null>(null);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [isSearchingMatch, setIsSearchingMatch] = useState(false);
    const [matchSearchTime, setMatchSearchTime] = useState(0);
    const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
    const [leaderboardFilter, setLeaderboardFilter] = useState<'global' | 'weekly' | 'monthly'>('global');

    // Initialize tournament data
    useEffect(() => {
        if (isVisible) {
            loadTournaments();
            loadLeaderboard();
            loadCompetitiveStats();
            loadAchievements();
            loadMatches();
        }
    }, [isVisible]);

    // Real-time updates
    useEffect(() => {
        if (socket) {
            socket.on('tournamentUpdate', handleTournamentUpdate);
            socket.on('matchFound', handleMatchFound);
            socket.on('matchUpdate', handleMatchUpdate);
            socket.on('leaderboardUpdate', handleLeaderboardUpdate);
            socket.on('achievementUnlocked', handleAchievementUnlocked);

            return () => {
                socket.off('tournamentUpdate');
                socket.off('matchFound');
                socket.off('matchUpdate');
                socket.off('leaderboardUpdate');
                socket.off('achievementUnlocked');
            };
        }
    }, [socket]);

    // Match search timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isSearchingMatch) {
            interval = setInterval(() => {
                setMatchSearchTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isSearchingMatch]);

    const loadTournaments = () => {
        const mockTournaments: Tournament[] = [
            {
                id: 'weekend_championship',
                name: 'Weekend Championship',
                type: 'single-elimination',
                status: 'registration',
                participants: 156,
                maxParticipants: 256,
                entryFee: 0,
                prizePool: 1000,
                startTime: Date.now() + 2 * 24 * 60 * 60 * 1000, // 2 days from now
                duration: 4 * 60 * 60 * 1000, // 4 hours
                difficulty: 'intermediate',
                rules: ['Best of 3', 'Standard rules', '10 minute time limit'],
                description: 'Weekly championship tournament open to all skill levels. Compete for glory and prizes!'
            },
            {
                id: 'masters_league',
                name: 'Masters League',
                type: 'swiss',
                status: 'active',
                participants: 32,
                maxParticipants: 32,
                entryFee: 50,
                prizePool: 1500,
                startTime: Date.now() - 60 * 60 * 1000, // 1 hour ago
                duration: 6 * 60 * 60 * 1000, // 6 hours
                difficulty: 'master',
                rules: ['Best of 5', 'Swiss system', '15 minute time limit'],
                description: 'Elite tournament for top-rated players. Prove your mastery!'
            },
            {
                id: 'blitz_tournament',
                name: 'Lightning Blitz',
                type: 'double-elimination',
                status: 'upcoming',
                participants: 0,
                maxParticipants: 128,
                entryFee: 10,
                prizePool: 500,
                startTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
                duration: 3 * 60 * 60 * 1000, // 3 hours
                difficulty: 'advanced',
                rules: ['Best of 1', 'Double elimination', '5 minute time limit'],
                description: 'Fast-paced tournament for quick thinkers. Every second counts!'
            },
            {
                id: 'beginners_cup',
                name: 'Beginners Cup',
                type: 'round-robin',
                status: 'registration',
                participants: 24,
                maxParticipants: 64,
                entryFee: 0,
                prizePool: 200,
                startTime: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days from now
                duration: 2 * 60 * 60 * 1000, // 2 hours
                difficulty: 'beginner',
                rules: ['Best of 1', 'Round robin', '8 minute time limit'],
                description: 'Perfect tournament for new players to gain experience and confidence.'
            }
        ];

        setTournaments(mockTournaments);
    };

    const loadLeaderboard = () => {
        const generatePlayer = (id: number, baseRating: number = 1200): Player => ({
            id: `player_${id}`,
            username: `Player${id}`,
            rating: Math.floor(baseRating + Math.random() * 800),
            rank: id,
            avatar: `🎭`,
            country: ['US', 'UK', 'CA', 'DE', 'FR', 'JP', 'KR', 'BR'][Math.floor(Math.random() * 8)],
            winRate: 50 + Math.random() * 40,
            gamesPlayed: 100 + Math.floor(Math.random() * 500),
            currentStreak: Math.floor(Math.random() * 10),
            badges: ['🏆', '⭐', '🔥'].slice(0, Math.floor(Math.random() * 4)),
            isOnline: Math.random() > 0.3
        });

        const globalPlayers = Array.from({ length: 100 }, (_, i) => generatePlayer(i + 1, 1800 - i * 10));
        const weeklyPlayers = Array.from({ length: 50 }, (_, i) => generatePlayer(i + 101, 1600));
        const monthlyPlayers = Array.from({ length: 75 }, (_, i) => generatePlayer(i + 151, 1500));

        setLeaderboard({
            global: globalPlayers,
            weekly: weeklyPlayers,
            monthly: monthlyPlayers,
            regional: {
                'North America': globalPlayers.slice(0, 20),
                'Europe': globalPlayers.slice(20, 40),
                'Asia': globalPlayers.slice(40, 60)
            }
        });
    };

    const loadCompetitiveStats = () => {
        const ratingHistory = Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            rating: 1200 + Math.sin(i / 5) * 100 + Math.random() * 50
        }));

        const stats: CompetitiveStats = {
            currentRating: Math.floor(1200 + Math.random() * 800),
            peakRating: Math.floor(1500 + Math.random() * 500),
            currentRank: Math.floor(1 + Math.random() * 1000),
            bestRank: Math.floor(1 + Math.random() * 100),
            winRate: 55 + Math.random() * 30,
            gamesPlayed: 150 + Math.floor(Math.random() * 350),
            wins: 0,
            losses: 0,
            draws: 0,
            averageGameDuration: 300 + Math.random() * 600,
            longestWinStreak: 5 + Math.floor(Math.random() * 15),
            currentStreak: Math.floor(Math.random() * 8),
            ratingHistory,
            achievements: []
        };

        stats.wins = Math.floor(stats.gamesPlayed * (stats.winRate / 100));
        stats.losses = Math.floor(stats.gamesPlayed * (1 - stats.winRate / 100) * 0.8);
        stats.draws = stats.gamesPlayed - stats.wins - stats.losses;

        setCompetitiveStats(stats);
    };

    const loadAchievements = () => {
        const mockAchievements: Achievement[] = [
            {
                id: 'first_win',
                name: 'First Victory',
                description: 'Win your first competitive match',
                icon: '🏆',
                rarity: 'common',
                unlockedAt: Date.now() - 30 * 24 * 60 * 60 * 1000
            },
            {
                id: 'win_streak_5',
                name: 'On Fire',
                description: 'Win 5 matches in a row',
                icon: '🔥',
                rarity: 'rare',
                unlockedAt: Date.now() - 15 * 24 * 60 * 60 * 1000
            },
            {
                id: 'tournament_winner',
                name: 'Champion',
                description: 'Win a tournament',
                icon: '👑',
                rarity: 'epic',
                unlockedAt: Date.now() - 7 * 24 * 60 * 60 * 1000
            },
            {
                id: 'rating_master',
                name: 'Master Strategist',
                description: 'Reach 2000+ rating',
                icon: '🧠',
                rarity: 'legendary'
            },
            {
                id: 'speed_demon',
                name: 'Speed Demon',
                description: 'Win 10 blitz matches',
                icon: '⚡',
                rarity: 'rare',
                progress: 7,
                maxProgress: 10
            },
            {
                id: 'perfectionist',
                name: 'Perfectionist',
                description: 'Win 50 matches without losing',
                icon: '💎',
                rarity: 'legendary',
                progress: 23,
                maxProgress: 50
            }
        ];

        setAchievements(mockAchievements);
    };

    const loadMatches = () => {
        const mockMatches: Match[] = [
            {
                id: 'match_1',
                tournamentId: 'weekend_championship',
                player1: { id: 'p1', username: 'AlphaPlayer', rating: 1650, rank: 15, avatar: '🎭', country: 'US', winRate: 75, gamesPlayed: 200, currentStreak: 5, badges: ['🏆'], isOnline: true },
                player2: { id: 'p2', username: 'BetaGamer', rating: 1580, rank: 28, avatar: '🎪', country: 'UK', winRate: 68, gamesPlayed: 180, currentStreak: 2, badges: ['⭐'], isOnline: true },
                status: 'completed',
                winner: 'p1',
                score: '3-1',
                duration: 1800,
                round: 1
            },
            {
                id: 'match_2',
                tournamentId: 'masters_league',
                player1: { id: 'p3', username: 'GammaChamp', rating: 1720, rank: 8, avatar: '🎨', country: 'CA', winRate: 82, gamesPlayed: 150, currentStreak: 8, badges: ['🏆', '🔥'], isOnline: false },
                player2: { id: 'p4', username: 'DeltaForce', rating: 1680, rank: 12, avatar: '🎯', country: 'DE', winRate: 71, gamesPlayed: 220, currentStreak: 1, badges: ['⭐'], isOnline: true },
                status: 'in-progress',
                score: '2-1',
                duration: 2400,
                round: 2
            }
        ];

        setMatches(mockMatches);
    };

    const startMatchmaking = () => {
        setIsSearchingMatch(true);
        setMatchSearchTime(0);

        // Simulate finding a match
        setTimeout(() => {
            const mockMatch: Match = {
                id: 'new_match',
                tournamentId: 'ranked',
                player1: { id: 'current_player', username: 'You', rating: competitiveStats?.currentRating || 1200, rank: competitiveStats?.currentRank || 500, avatar: '👤', country: 'US', winRate: competitiveStats?.winRate || 50, gamesPlayed: competitiveStats?.gamesPlayed || 0, currentStreak: competitiveStats?.currentStreak || 0, badges: [], isOnline: true },
                player2: { id: 'opponent', username: 'Challenger', rating: (competitiveStats?.currentRating || 1200) + Math.floor(Math.random() * 100 - 50), rank: (competitiveStats?.currentRank || 500) + Math.floor(Math.random() * 100 - 50), avatar: '🎮', country: 'UK', winRate: 60 + Math.random() * 30, gamesPlayed: 100 + Math.floor(Math.random() * 200), currentStreak: Math.floor(Math.random() * 5), badges: ['⭐'], isOnline: true },
                status: 'scheduled',
                score: '0-0',
                duration: 0,
                round: 1
            };

            setCurrentMatch(mockMatch);
            setIsSearchingMatch(false);
            setMatchSearchTime(0);
        }, 3000 + Math.random() * 7000); // 3-10 seconds
    };

    const cancelMatchmaking = () => {
        setIsSearchingMatch(false);
        setMatchSearchTime(0);
    };

    const joinTournament = (tournament: Tournament) => {
        if (tournament.participants < tournament.maxParticipants) {
            setTournaments(prev => prev.map(t =>
                t.id === tournament.id
                    ? { ...t, participants: t.participants + 1 }
                    : t
            ));
        }
    };

    const handleTournamentUpdate = (data: any) => {
        setTournaments(prev => prev.map(t =>
            t.id === data.tournamentId ? { ...t, ...data.updates } : t
        ));
    };

    const handleMatchFound = (match: Match) => {
        setCurrentMatch(match);
        setIsSearchingMatch(false);
    };

    const handleMatchUpdate = (data: any) => {
        setMatches(prev => prev.map(m =>
            m.id === data.matchId ? { ...m, ...data.updates } : m
        ));
    };

    const handleLeaderboardUpdate = (data: any) => {
        setLeaderboard(data);
    };

    const handleAchievementUnlocked = (achievement: Achievement) => {
        setAchievements(prev => prev.map(a =>
            a.id === achievement.id ? { ...a, unlockedAt: Date.now() } : a
        ));
    };

    const getRatingColor = (rating: number) => {
        if (rating >= 2200) return '#8b5cf6'; // Legendary (Purple)
        if (rating >= 1900) return '#f59e0b'; // Master (Gold)
        if (rating >= 1600) return '#ef4444'; // Expert (Red)
        if (rating >= 1300) return '#3b82f6'; // Advanced (Blue)
        if (rating >= 1000) return '#22c55e'; // Intermediate (Green)
        return '#6b7280'; // Beginner (Gray)
    };

    const getRatingTitle = (rating: number) => {
        if (rating >= 2200) return 'Legendary';
        if (rating >= 1900) return 'Master';
        if (rating >= 1600) return 'Expert';
        if (rating >= 1300) return 'Advanced';
        if (rating >= 1000) return 'Intermediate';
        return 'Beginner';
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getRatingHistoryData = () => {
        if (!competitiveStats) return { labels: [], datasets: [] };

        return {
            labels: competitiveStats.ratingHistory.map(h => new Date(h.date).toLocaleDateString()),
            datasets: [
                {
                    label: 'Rating',
                    data: competitiveStats.ratingHistory.map(h => h.rating),
                    borderColor: getRatingColor(competitiveStats.currentRating),
                    backgroundColor: `${getRatingColor(competitiveStats.currentRating)}20`,
                    tension: 0.4,
                    fill: true
                }
            ]
        };
    };

    const renderTournamentsTab = () => (
        <div className="tournaments-tab">
            {/* Quick Actions */}
            <motion.div
                className="quick-actions"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <div className="action-card matchmaking">
                    <div className="action-content">
                        <h3>Ranked Matchmaking</h3>
                        <p>Find opponents of similar skill level for ranked matches</p>
                        {isSearchingMatch ? (
                            <div className="searching-match">
                                <div className="search-spinner" />
                                <div className="search-info">
                                    <div className="search-text">Searching for opponent...</div>
                                    <div className="search-time">{formatTime(matchSearchTime)}</div>
                                </div>
                                <button
                                    className="cancel-search-btn"
                                    onClick={cancelMatchmaking}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : currentMatch ? (
                            <div className="match-found">
                                <div className="match-info">
                                    <span className="match-label">Match Found!</span>
                                    <div className="opponent-info">
                                        <span className="opponent-avatar">{currentMatch.player2.avatar}</span>
                                        <span className="opponent-name">{currentMatch.player2.username}</span>
                                        <span className="opponent-rating">({currentMatch.player2.rating})</span>
                                    </div>
                                </div>
                                <div className="match-actions">
                                    <button className="accept-match-btn">Accept</button>
                                    <button className="decline-match-btn">Decline</button>
                                </div>
                            </div>
                        ) : (
                            <button
                                className="start-matchmaking-btn"
                                onClick={startMatchmaking}
                            >
                                Start Matchmaking
                            </button>
                        )}
                    </div>
                </div>

                <div className="action-card quick-play">
                    <div className="action-content">
                        <h3>Quick Play</h3>
                        <p>Jump into a casual game immediately</p>
                        <button className="quick-play-btn">Quick Play</button>
                    </div>
                </div>
            </motion.div>

            {/* Tournaments List */}
            <motion.div
                className="tournaments-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h3>Active Tournaments</h3>
                <div className="tournaments-grid">
                    {tournaments.map((tournament, index) => (
                        <motion.div
                            key={tournament.id}
                            className={`tournament-card ${tournament.status} ${tournament.difficulty}`}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 * index }}
                            onClick={() => setSelectedTournament(tournament)}
                        >
                            <div className="tournament-header">
                                <div className="tournament-title">
                                    <h4>{tournament.name}</h4>
                                    <div className={`status-badge ${tournament.status}`}>
                                        {tournament.status.toUpperCase()}
                                    </div>
                                </div>
                                <div className={`difficulty-badge ${tournament.difficulty}`}>
                                    {tournament.difficulty.toUpperCase()}
                                </div>
                            </div>

                            <div className="tournament-info">
                                <div className="info-row">
                                    <span className="info-label">Type:</span>
                                    <span className="info-value">{tournament.type}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Participants:</span>
                                    <span className="info-value">{tournament.participants}/{tournament.maxParticipants}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Prize Pool:</span>
                                    <span className="info-value prize">${tournament.prizePool}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Entry Fee:</span>
                                    <span className="info-value">${tournament.entryFee}</span>
                                </div>
                            </div>

                            <div className="tournament-time">
                                {tournament.status === 'upcoming' && (
                                    <div className="time-info">
                                        <span className="time-label">Starts in:</span>
                                        <span className="time-value">
                                            {Math.floor((tournament.startTime - Date.now()) / (24 * 60 * 60 * 1000))} days
                                        </span>
                                    </div>
                                )}
                                {tournament.status === 'registration' && (
                                    <div className="time-info">
                                        <span className="time-label">Registration ends:</span>
                                        <span className="time-value">
                                            {Math.floor((tournament.startTime - Date.now()) / (60 * 60 * 1000))} hours
                                        </span>
                                    </div>
                                )}
                                {tournament.status === 'active' && (
                                    <div className="time-info">
                                        <span className="time-label">In progress</span>
                                        <span className="time-value live">LIVE</span>
                                    </div>
                                )}
                            </div>

                            <div className="tournament-progress">
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${(tournament.participants / tournament.maxParticipants) * 100}%` }}
                                    />
                                </div>
                            </div>

                            <div className="tournament-actions">
                                {tournament.status === 'registration' && tournament.participants < tournament.maxParticipants && (
                                    <button
                                        className="join-tournament-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            joinTournament(tournament);
                                        }}
                                    >
                                        Join Tournament
                                    </button>
                                )}
                                {tournament.status === 'active' && (
                                    <button className="watch-tournament-btn">
                                        Watch Live
                                    </button>
                                )}
                                {tournament.status === 'completed' && (
                                    <button className="view-results-btn">
                                        View Results
                                    </button>
                                )}
                                {tournament.status === 'upcoming' && (
                                    <button className="set-reminder-btn">
                                        Set Reminder
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Tournament Details Modal */}
            {selectedTournament && (
                <motion.div
                    className="tournament-modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setSelectedTournament(null)}
                >
                    <motion.div
                        className="tournament-modal"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2>{selectedTournament.name}</h2>
                            <button
                                className="close-modal-btn"
                                onClick={() => setSelectedTournament(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="modal-content">
                            <div className="tournament-description">
                                <p>{selectedTournament.description}</p>
                            </div>

                            <div className="tournament-details">
                                <div className="detail-section">
                                    <h4>Tournament Rules</h4>
                                    <ul>
                                        {selectedTournament.rules.map((rule, index) => (
                                            <li key={index}>{rule}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="detail-section">
                                    <h4>Tournament Information</h4>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="detail-label">Format:</span>
                                            <span className="detail-value">{selectedTournament.type}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Difficulty:</span>
                                            <span className="detail-value">{selectedTournament.difficulty}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Duration:</span>
                                            <span className="detail-value">
                                                {Math.floor(selectedTournament.duration / (60 * 60 * 1000))} hours
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Max Players:</span>
                                            <span className="detail-value">{selectedTournament.maxParticipants}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            {selectedTournament.status === 'registration' && (
                                <button className="join-modal-btn">
                                    Join Tournament (${selectedTournament.entryFee})
                                </button>
                            )}
                            <button className="close-modal-btn-secondary">
                                Close
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    );

    const renderLeaderboardTab = () => (
        <div className="leaderboard-tab">
            {/* Filter Controls */}
            <motion.div
                className="leaderboard-filters"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <div className="filter-group">
                    <label>Time Period:</label>
                    <select
                        value={leaderboardFilter}
                        onChange={(e) => setLeaderboardFilter(e.target.value as any)}
                    >
                        <option value="global">All Time</option>
                        <option value="monthly">This Month</option>
                        <option value="weekly">This Week</option>
                    </select>
                </div>
            </motion.div>

            {/* Leaderboard */}
            <motion.div
                className="leaderboard-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h3>{leaderboardFilter.charAt(0).toUpperCase() + leaderboardFilter.slice(1)} Leaderboard</h3>

                {leaderboard && (
                    <div className="leaderboard-list">
                        {leaderboard[leaderboardFilter].slice(0, 50).map((player, index) => (
                            <motion.div
                                key={player.id}
                                className={`leaderboard-entry ${index < 3 ? 'top-three' : ''}`}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.02 * index }}
                            >
                                <div className="rank-section">
                                    <div className={`rank-number ${index < 3 ? `rank-${index + 1}` : ''}`}>
                                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                                    </div>
                                </div>

                                <div className="player-info">
                                    <div className="player-avatar">{player.avatar}</div>
                                    <div className="player-details">
                                        <div className="player-name">
                                            {player.username}
                                            {player.isOnline && <span className="online-indicator" />}
                                        </div>
                                        <div className="player-country">{player.country}</div>
                                    </div>
                                </div>

                                <div className="player-stats">
                                    <div className="stat-item">
                                        <span className="stat-label">Rating</span>
                                        <span
                                            className="stat-value rating"
                                            style={{ color: getRatingColor(player.rating) }}
                                        >
                                            {player.rating}
                                        </span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Win Rate</span>
                                        <span className="stat-value">{player.winRate.toFixed(1)}%</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Games</span>
                                        <span className="stat-value">{player.gamesPlayed}</span>
                                    </div>
                                </div>

                                <div className="player-badges">
                                    {player.badges.map((badge, badgeIndex) => (
                                        <span key={badgeIndex} className="badge">{badge}</span>
                                    ))}
                                </div>

                                <div className="player-actions">
                                    <button className="challenge-btn">Challenge</button>
                                    <button className="view-profile-btn">View</button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );

    const renderMatchesTab = () => (
        <div className="matches-tab">
            {/* Recent Matches */}
            <motion.div
                className="matches-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <h3>Recent Matches</h3>
                <div className="matches-list">
                    {matches.map((match, index) => (
                        <motion.div
                            key={match.id}
                            className={`match-card ${match.status}`}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 * index }}
                        >
                            <div className="match-header">
                                <div className={`match-status ${match.status}`}>
                                    {match.status.replace('-', ' ').toUpperCase()}
                                </div>
                                <div className="match-round">Round {match.round}</div>
                            </div>

                            <div className="match-players">
                                <div className={`player-section ${match.winner === match.player1.id ? 'winner' : ''}`}>
                                    <div className="player-avatar">{match.player1.avatar}</div>
                                    <div className="player-info">
                                        <div className="player-name">{match.player1.username}</div>
                                        <div
                                            className="player-rating"
                                            style={{ color: getRatingColor(match.player1.rating) }}
                                        >
                                            {match.player1.rating}
                                        </div>
                                    </div>
                                </div>

                                <div className="match-vs">
                                    <div className="vs-text">VS</div>
                                    <div className="match-score">{match.score}</div>
                                </div>

                                <div className={`player-section ${match.winner === match.player2.id ? 'winner' : ''}`}>
                                    <div className="player-avatar">{match.player2.avatar}</div>
                                    <div className="player-info">
                                        <div className="player-name">{match.player2.username}</div>
                                        <div
                                            className="player-rating"
                                            style={{ color: getRatingColor(match.player2.rating) }}
                                        >
                                            {match.player2.rating}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="match-details">
                                <div className="detail-item">
                                    <span className="detail-icon">⏱️</span>
                                    <span className="detail-text">{formatTime(match.duration)}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-icon">🏆</span>
                                    <span className="detail-text">{match.tournamentId}</span>
                                </div>
                            </div>

                            <div className="match-actions">
                                {match.status === 'in-progress' && (
                                    <button className="watch-match-btn">Watch</button>
                                )}
                                {match.status === 'completed' && (
                                    <button className="replay-match-btn">Replay</button>
                                )}
                                <button className="match-details-btn">Details</button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>
    );

    const renderProfileTab = () => (
        <div className="profile-tab">
            {competitiveStats && (
                <>
                    {/* Rating Overview */}
                    <motion.div
                        className="rating-overview"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                    >
                        <div className="rating-card">
                            <div className="rating-main">
                                <div
                                    className="current-rating"
                                    style={{ color: getRatingColor(competitiveStats.currentRating) }}
                                >
                                    {competitiveStats.currentRating}
                                </div>
                                <div className="rating-title">
                                    {getRatingTitle(competitiveStats.currentRating)}
                                </div>
                            </div>
                            <div className="rating-details">
                                <div className="rating-stat">
                                    <span className="stat-label">Peak Rating</span>
                                    <span className="stat-value">{competitiveStats.peakRating}</span>
                                </div>
                                <div className="rating-stat">
                                    <span className="stat-label">Current Rank</span>
                                    <span className="stat-value">#{competitiveStats.currentRank}</span>
                                </div>
                                <div className="rating-stat">
                                    <span className="stat-label">Best Rank</span>
                                    <span className="stat-value">#{competitiveStats.bestRank}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Rating History Chart */}
                    <motion.div
                        className="rating-history-section"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3>Rating History (30 Days)</h3>
                        <div className="rating-chart-container">
                            <Line
                                data={getRatingHistoryData()}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            display: false
                                        }
                                    },
                                    scales: {
                                        y: {
                                            grid: {
                                                color: 'rgba(255, 255, 255, 0.1)'
                                            },
                                            ticks: {
                                                color: 'rgba(255, 255, 255, 0.7)'
                                            }
                                        },
                                        x: {
                                            grid: {
                                                color: 'rgba(255, 255, 255, 0.1)'
                                            },
                                            ticks: {
                                                color: 'rgba(255, 255, 255, 0.7)'
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </motion.div>

                    {/* Competitive Stats */}
                    <motion.div
                        className="competitive-stats-section"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h3>Competitive Statistics</h3>
                        <div className="stats-grid">
                            {[
                                { label: 'Games Played', value: competitiveStats.gamesPlayed, icon: '🎮' },
                                { label: 'Win Rate', value: `${competitiveStats.winRate.toFixed(1)}%`, icon: '📊' },
                                { label: 'Wins', value: competitiveStats.wins, icon: '🏆' },
                                { label: 'Losses', value: competitiveStats.losses, icon: '❌' },
                                { label: 'Draws', value: competitiveStats.draws, icon: '🤝' },
                                { label: 'Current Streak', value: competitiveStats.currentStreak, icon: '🔥' },
                                { label: 'Longest Streak', value: competitiveStats.longestWinStreak, icon: '⚡' },
                                { label: 'Avg Game Time', value: formatTime(competitiveStats.averageGameDuration), icon: '⏱️' }
                            ].map((stat, index) => (
                                <motion.div
                                    key={stat.label}
                                    className="stat-card"
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.05 * index }}
                                >
                                    <div className="stat-icon">{stat.icon}</div>
                                    <div className="stat-content">
                                        <div className="stat-value">{stat.value}</div>
                                        <div className="stat-label">{stat.label}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );

    const renderAchievementsTab = () => (
        <div className="achievements-tab">
            <motion.div
                className="achievements-section"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <h3>Achievements</h3>
                <div className="achievements-grid">
                    {achievements.map((achievement, index) => (
                        <motion.div
                            key={achievement.id}
                            className={`achievement-card ${achievement.rarity} ${achievement.unlockedAt ? 'unlocked' : 'locked'}`}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.05 * index }}
                        >
                            <div className="achievement-icon">
                                {achievement.unlockedAt ? achievement.icon : '🔒'}
                            </div>

                            <div className="achievement-content">
                                <div className="achievement-name">{achievement.name}</div>
                                <div className="achievement-description">{achievement.description}</div>

                                {achievement.progress !== undefined && (
                                    <div className="achievement-progress">
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${(achievement.progress / (achievement.maxProgress || 1)) * 100}%`
                                                }}
                                            />
                                        </div>
                                        <div className="progress-text">
                                            {achievement.progress}/{achievement.maxProgress}
                                        </div>
                                    </div>
                                )}

                                {achievement.unlockedAt && (
                                    <div className="achievement-unlocked">
                                        Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                                    </div>
                                )}
                            </div>

                            <div className={`rarity-indicator ${achievement.rarity}`} />
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </div>
    );

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="tournament-mode-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="tournament-mode"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="tournament-header">
                        <div className="header-title">
                            <h2>Tournament & Competitive Mode</h2>
                            <div className="header-subtitle">
                                Compete against players worldwide
                            </div>
                        </div>
                        <div className="header-controls">
                            <button className="create-tournament-btn">🏆 Create Tournament</button>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="tournament-nav">
                        {[
                            { id: 'tournaments', label: 'Tournaments', icon: '🏆' },
                            { id: 'leaderboard', label: 'Leaderboard', icon: '👑' },
                            { id: 'matches', label: 'Matches', icon: '⚔️' },
                            { id: 'profile', label: 'Profile', icon: '👤' },
                            { id: 'achievements', label: 'Achievements', icon: '🏅' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id as any)}
                            >
                                <span className="tab-icon">{tab.icon}</span>
                                <span className="tab-label">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="tournament-content">
                        <AnimatePresence mode="wait">
                            {activeTab === 'tournaments' && renderTournamentsTab()}
                            {activeTab === 'leaderboard' && renderLeaderboardTab()}
                            {activeTab === 'matches' && renderMatchesTab()}
                            {activeTab === 'profile' && renderProfileTab()}
                            {activeTab === 'achievements' && renderAchievementsTab()}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TournamentMode; 