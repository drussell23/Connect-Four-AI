import React, { useState, useEffect } from 'react';
import './AchievementSystem.css';

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    level: number;
    unlocked: boolean;
    unlockedAt?: Date;
    progress?: number;
    maxProgress?: number;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    category: 'progress' | 'skill' | 'special' | 'hidden';
}

interface AchievementNotification {
    achievement: Achievement;
    isVisible: boolean;
    timestamp: number;
}

interface AchievementSystemProps {
    achievements: Achievement[];
    newAchievements: Achievement[];
    onAchievementViewed: (achievementId: string) => void;
    showGallery?: boolean;
    onCloseGallery?: () => void;
}

const AchievementSystem: React.FC<AchievementSystemProps> = ({
    achievements,
    newAchievements,
    onAchievementViewed,
    showGallery = false,
    onCloseGallery
}) => {
    const [notifications, setNotifications] = useState<AchievementNotification[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'date' | 'rarity' | 'name'>('date');

    // Handle new achievements
    useEffect(() => {
        newAchievements.forEach(achievement => {
            const notification: AchievementNotification = {
                achievement,
                isVisible: true,
                timestamp: Date.now()
            };

            setNotifications(prev => [...prev, notification]);

            // Auto-hide after 5 seconds
            setTimeout(() => {
                setNotifications(prev =>
                    prev.map(n => n.achievement.id === achievement.id
                        ? { ...n, isVisible: false }
                        : n
                    )
                );
            }, 5000);

            // Remove after animation
            setTimeout(() => {
                setNotifications(prev =>
                    prev.filter(n => n.achievement.id !== achievement.id)
                );
            }, 5500);
        });
    }, [newAchievements]);

    const getRarityColor = (rarity: Achievement['rarity']): string => {
        switch (rarity) {
            case 'common': return '#10b981';
            case 'rare': return '#3b82f6';
            case 'epic': return '#8b5cf6';
            case 'legendary': return '#f59e0b';
            default: return '#6b7280';
        }
    };

    const getCategoryIcon = (category: Achievement['category']): string => {
        switch (category) {
            case 'progress': return '📈';
            case 'skill': return '🎯';
            case 'special': return '⭐';
            case 'hidden': return '🔒';
            default: return '🏆';
        }
    };

    const filteredAchievements = achievements.filter(achievement => {
        if (selectedCategory === 'all') return true;
        return achievement.category === selectedCategory;
    }).sort((a, b) => {
        switch (sortBy) {
            case 'date':
                if (!a.unlockedAt && !b.unlockedAt) return 0;
                if (!a.unlockedAt) return 1;
                if (!b.unlockedAt) return -1;
                return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
            case 'rarity':
                const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
                return rarityOrder[b.rarity] - rarityOrder[a.rarity];
            case 'name':
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const totalCount = achievements.length;
    const completionRate = (unlockedCount / totalCount) * 100;

    const AchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement }) => (
        <div
            className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'} ${achievement.rarity}`}
            onClick={() => achievement.unlocked && onAchievementViewed(achievement.id)}
        >
            <div className="achievement-icon-container">
                <div className="achievement-icon">
                    {achievement.unlocked ? achievement.icon : '🔒'}
                </div>
                <div className="achievement-rarity-glow" style={{ backgroundColor: getRarityColor(achievement.rarity) }} />
            </div>

            <div className="achievement-content">
                <div className="achievement-header">
                    <h3 className="achievement-name">{achievement.name}</h3>
                    <div className="achievement-category">
                        {getCategoryIcon(achievement.category)}
                    </div>
                </div>

                <p className="achievement-description">
                    {achievement.unlocked ? achievement.description : '???'}
                </p>

                {achievement.progress !== undefined && achievement.maxProgress !== undefined && (
                    <div className="achievement-progress">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{
                                    width: `${(achievement.progress / achievement.maxProgress) * 100}%`,
                                    backgroundColor: getRarityColor(achievement.rarity)
                                }}
                            />
                        </div>
                        <span className="progress-text">
                            {achievement.progress}/{achievement.maxProgress}
                        </span>
                    </div>
                )}

                {achievement.unlockedAt && (
                    <div className="achievement-unlock-date">
                        Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </div>
                )}
            </div>
        </div>
    );

    const AchievementNotificationComponent: React.FC<{ notification: AchievementNotification }> = ({ notification }) => (
        <div className={`achievement-notification ${notification.isVisible ? 'visible' : 'hiding'}`}>
            <div className="notification-header">
                <span className="notification-title">Achievement Unlocked!</span>
                <button
                    className="notification-close"
                    onClick={() => setNotifications(prev =>
                        prev.map(n => n.achievement.id === notification.achievement.id
                            ? { ...n, isVisible: false }
                            : n
                        )
                    )}
                >
                    ×
                </button>
            </div>

            <div className="notification-content">
                <div className="notification-icon">
                    {notification.achievement.icon}
                </div>
                <div className="notification-details">
                    <h4 className="notification-achievement-name">
                        {notification.achievement.name}
                    </h4>
                    <p className="notification-achievement-description">
                        {notification.achievement.description}
                    </p>
                </div>
            </div>

            <div className="notification-effects">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className={`notification-particle particle-${i}`} />
                ))}
            </div>
        </div>
    );

    if (!showGallery) {
        return (
            <div className="achievement-notifications">
                {notifications.map(notification => (
                    <AchievementNotificationComponent
                        key={notification.achievement.id}
                        notification={notification}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="achievement-gallery-overlay">
            <div className="achievement-gallery">
                <div className="gallery-header">
                    <h2 className="gallery-title">Achievement Gallery</h2>
                    <button className="gallery-close" onClick={onCloseGallery}>
                        ×
                    </button>
                </div>

                <div className="gallery-stats">
                    <div className="completion-overview">
                        <div className="completion-circle">
                            <svg viewBox="0 0 36 36" className="completion-svg">
                                <path
                                    className="completion-bg"
                                    d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                    className="completion-fill"
                                    strokeDasharray={`${completionRate}, 100`}
                                    d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                            </svg>
                            <div className="completion-text">
                                <div className="completion-percentage">{Math.round(completionRate)}%</div>
                                <div className="completion-label">Complete</div>
                            </div>
                        </div>

                        <div className="completion-details">
                            <div className="completion-stat">
                                <span className="stat-value">{unlockedCount}</span>
                                <span className="stat-label">Unlocked</span>
                            </div>
                            <div className="completion-stat">
                                <span className="stat-value">{totalCount}</span>
                                <span className="stat-label">Total</span>
                            </div>
                        </div>
                    </div>

                    <div className="rarity-breakdown">
                        {(['common', 'rare', 'epic', 'legendary'] as const).map(rarity => {
                            const count = achievements.filter(a => a.rarity === rarity && a.unlocked).length;
                            const total = achievements.filter(a => a.rarity === rarity).length;

                            return (
                                <div key={rarity} className="rarity-stat">
                                    <div
                                        className="rarity-indicator"
                                        style={{ backgroundColor: getRarityColor(rarity) }}
                                    />
                                    <span className="rarity-name">{rarity}</span>
                                    <span className="rarity-count">{count}/{total}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="gallery-controls">
                    <div className="category-filter">
                        <label htmlFor="category-select">Category:</label>
                        <select
                            id="category-select"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="progress">Progress</option>
                            <option value="skill">Skill</option>
                            <option value="special">Special</option>
                            <option value="hidden">Hidden</option>
                        </select>
                    </div>

                    <div className="sort-filter">
                        <label htmlFor="sort-select">Sort by:</label>
                        <select
                            id="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'date' | 'rarity' | 'name')}
                        >
                            <option value="date">Date Unlocked</option>
                            <option value="rarity">Rarity</option>
                            <option value="name">Name</option>
                        </select>
                    </div>
                </div>

                <div className="achievements-grid">
                    {filteredAchievements.map(achievement => (
                        <AchievementCard key={achievement.id} achievement={achievement} />
                    ))}
                </div>
            </div>

            <div className="achievement-notifications">
                {notifications.map(notification => (
                    <AchievementNotificationComponent
                        key={notification.achievement.id}
                        notification={notification}
                    />
                ))}
            </div>
        </div>
    );
};

export default AchievementSystem; 