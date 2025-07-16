// src/components/EnhancedAIInsights.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './EnhancedAIInsights.css';

interface EnhancedAIInsightsProps {
    isVisible: boolean;
    onClose: () => void;
    aiExplanation: string;
    confidence: number;
    safetyScore: number;
    thinkingTime: number;
    adaptationInfo?: any;
    curriculumInfo?: any;
    debateResult?: any;
    gameMetrics?: any;
    onRequestExplanation: (moveIndex?: number) => void;
    onSubmitFeedback: (feedback: any) => void;
}

const EnhancedAIInsights: React.FC<EnhancedAIInsightsProps> = ({
    isVisible,
    onClose,
    aiExplanation,
    confidence,
    safetyScore,
    thinkingTime,
    adaptationInfo,
    curriculumInfo,
    debateResult,
    gameMetrics,
    onRequestExplanation,
    onSubmitFeedback
}) => {
    const [activeTab, setActiveTab] = useState<'explanation' | 'metrics' | 'adaptation' | 'curriculum' | 'debate'>('explanation');
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);
    const [feedbackData, setFeedbackData] = useState({
        rating: 7,
        satisfaction: 7,
        aiPerformance: 7,
        explanation: '',
        suggestions: ''
    });

    const formatTime = (ms: number): string => {
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatPercentage = (value: number): string => {
        return `${(value * 100).toFixed(1)}%`;
    };

    const getConfidenceColor = (confidence: number): string => {
        if (confidence >= 0.8) return '#10b981';
        if (confidence >= 0.6) return '#f59e0b';
        if (confidence >= 0.4) return '#ef4444';
        return '#6b7280';
    };

    const getSafetyColor = (safety: number): string => {
        if (safety >= 0.9) return '#10b981';
        if (safety >= 0.7) return '#84cc16';
        if (safety >= 0.5) return '#f59e0b';
        return '#ef4444';
    };

    const handleSubmitFeedback = () => {
        onSubmitFeedback(feedbackData);
        setShowFeedbackForm(false);
        setFeedbackData({
            rating: 7,
            satisfaction: 7,
            aiPerformance: 7,
            explanation: '',
            suggestions: ''
        });
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="enhanced-ai-insights-overlay"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="enhanced-ai-insights-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="insights-header">
                        <h2>🧠 AI Insights & Analysis</h2>
                        <button className="close-button" onClick={onClose}>✕</button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="insights-tabs">
                        <button
                            className={`tab ${activeTab === 'explanation' ? 'active' : ''}`}
                            onClick={() => setActiveTab('explanation')}
                        >
                            💭 Explanation
                        </button>
                        <button
                            className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
                            onClick={() => setActiveTab('metrics')}
                        >
                            📊 Metrics
                        </button>
                        {adaptationInfo && (
                            <button
                                className={`tab ${activeTab === 'adaptation' ? 'active' : ''}`}
                                onClick={() => setActiveTab('adaptation')}
                            >
                                🎯 Adaptation
                            </button>
                        )}
                        {curriculumInfo && (
                            <button
                                className={`tab ${activeTab === 'curriculum' ? 'active' : ''}`}
                                onClick={() => setActiveTab('curriculum')}
                            >
                                📚 Learning
                            </button>
                        )}
                        {debateResult && (
                            <button
                                className={`tab ${activeTab === 'debate' ? 'active' : ''}`}
                                onClick={() => setActiveTab('debate')}
                            >
                                🗣️ Debate
                            </button>
                        )}
                    </div>

                    {/* Tab Content */}
                    <div className="insights-content">
                        {activeTab === 'explanation' && (
                            <div className="explanation-tab">
                                <div className="explanation-text">
                                    <h3>AI Decision Reasoning</h3>
                                    <p>{aiExplanation || 'No explanation available for this move.'}</p>
                                </div>

                                <div className="quick-metrics">
                                    <div className="metric-card">
                                        <span className="metric-label">Confidence</span>
                                        <span
                                            className="metric-value"
                                            style={{ color: getConfidenceColor(confidence) }}
                                        >
                                            {formatPercentage(confidence)}
                                        </span>
                                    </div>
                                    <div className="metric-card">
                                        <span className="metric-label">Safety</span>
                                        <span
                                            className="metric-value"
                                            style={{ color: getSafetyColor(safetyScore) }}
                                        >
                                            {formatPercentage(safetyScore)}
                                        </span>
                                    </div>
                                    <div className="metric-card">
                                        <span className="metric-label">Think Time</span>
                                        <span className="metric-value">{formatTime(thinkingTime)}</span>
                                    </div>
                                </div>

                                <div className="explanation-actions">
                                    <button
                                        className="action-button"
                                        onClick={() => onRequestExplanation()}
                                    >
                                        🔄 Get Latest Explanation
                                    </button>
                                    <button
                                        className="action-button secondary"
                                        onClick={() => setShowFeedbackForm(true)}
                                    >
                                        📝 Provide Feedback
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'metrics' && gameMetrics && (
                            <div className="metrics-tab">
                                <h3>Game Performance Metrics</h3>
                                <div className="metrics-grid">
                                    <div className="metric-item">
                                        <label>Average Confidence</label>
                                        <div className="metric-bar">
                                            <div
                                                className="metric-fill"
                                                style={{
                                                    width: formatPercentage(gameMetrics.averageConfidence),
                                                    backgroundColor: getConfidenceColor(gameMetrics.averageConfidence)
                                                }}
                                            />
                                        </div>
                                        <span>{formatPercentage(gameMetrics.averageConfidence)}</span>
                                    </div>

                                    <div className="metric-item">
                                        <label>Safety Score</label>
                                        <div className="metric-bar">
                                            <div
                                                className="metric-fill"
                                                style={{
                                                    width: formatPercentage(gameMetrics.safetyScore),
                                                    backgroundColor: getSafetyColor(gameMetrics.safetyScore)
                                                }}
                                            />
                                        </div>
                                        <span>{formatPercentage(gameMetrics.safetyScore)}</span>
                                    </div>

                                    <div className="metric-item">
                                        <label>Adaptation Score</label>
                                        <div className="metric-bar">
                                            <div
                                                className="metric-fill"
                                                style={{
                                                    width: formatPercentage(gameMetrics.adaptationScore),
                                                    backgroundColor: '#3b82f6'
                                                }}
                                            />
                                        </div>
                                        <span>{formatPercentage(gameMetrics.adaptationScore)}</span>
                                    </div>

                                    <div className="metric-item">
                                        <label>Explainability</label>
                                        <div className="metric-bar">
                                            <div
                                                className="metric-fill"
                                                style={{
                                                    width: formatPercentage(gameMetrics.explainabilityScore),
                                                    backgroundColor: '#8b5cf6'
                                                }}
                                            />
                                        </div>
                                        <span>{formatPercentage(gameMetrics.explainabilityScore)}</span>
                                    </div>
                                </div>

                                <div className="total-thinking-time">
                                    <strong>Total AI Thinking Time: {formatTime(gameMetrics.totalThinkingTime || 0)}</strong>
                                </div>
                            </div>
                        )}

                        {activeTab === 'adaptation' && adaptationInfo && (
                            <div className="adaptation-tab">
                                <h3>Real-time Adaptation Analysis</h3>
                                <div className="adaptation-info">
                                    <div className="adaptation-item">
                                        <label>Style Adaptation</label>
                                        <span>{formatPercentage(adaptationInfo.styleAdaptation || 0)}</span>
                                    </div>
                                    <div className="adaptation-item">
                                        <label>Difficulty Level</label>
                                        <span>{formatPercentage(adaptationInfo.difficultyLevel || 0.5)}</span>
                                    </div>
                                    <div className="adaptation-item">
                                        <label>Emotional State Match</label>
                                        <span>{formatPercentage(adaptationInfo.emotionalStateMatch || 0.5)}</span>
                                    </div>
                                    <div className="adaptation-item">
                                        <label>Player Model Confidence</label>
                                        <span>{formatPercentage(adaptationInfo.playerModelConfidence || 0.5)}</span>
                                    </div>
                                </div>
                                <div className="adaptation-description">
                                    <p>The AI is continuously adapting to your playing style and preferences to provide the optimal challenge level and engagement.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'curriculum' && curriculumInfo && (
                            <div className="curriculum-tab">
                                <h3>Learning Progress & Curriculum</h3>
                                <div className="curriculum-stage">
                                    <h4>Current Stage: {curriculumInfo.currentStage}</h4>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: formatPercentage(curriculumInfo.progressScore || 0) }}
                                        />
                                    </div>
                                    <span>{formatPercentage(curriculumInfo.progressScore || 0)} Complete</span>
                                </div>

                                {curriculumInfo.nextObjectives && (
                                    <div className="next-objectives">
                                        <h4>Next Learning Objectives:</h4>
                                        <ul>
                                            {curriculumInfo.nextObjectives.map((objective: string, index: number) => (
                                                <li key={index}>{objective}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {curriculumInfo.difficultyAdjustment !== 0 && (
                                    <div className="difficulty-adjustment">
                                        <p>
                                            Difficulty {curriculumInfo.difficultyAdjustment > 0 ? 'increased' : 'decreased'}
                                            by {Math.abs(curriculumInfo.difficultyAdjustment * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'debate' && debateResult && (
                            <div className="debate-tab">
                                <h3>Multi-Agent AI Debate</h3>
                                <div className="debate-consensus">
                                    <label>Consensus Level:</label>
                                    <span>{formatPercentage(debateResult.consensus)}</span>
                                </div>

                                <div className="agent-votes">
                                    <h4>Agent Votes:</h4>
                                    {Object.entries(debateResult.agentVotes).map(([agent, vote]: [string, any]) => (
                                        <div key={agent} className="agent-vote">
                                            <span className="agent-name">{agent.replace('_', ' ')}</span>
                                            <span className="vote-column">Column {vote}</span>
                                        </div>
                                    ))}
                                </div>

                                {debateResult.dissenting && debateResult.dissenting.length > 0 && (
                                    <div className="dissenting-opinions">
                                        <h4>Dissenting Opinions:</h4>
                                        {debateResult.dissenting.map((opinion: string, index: number) => (
                                            <p key={index} className="dissenting-opinion">{opinion}</p>
                                        ))}
                                    </div>
                                )}

                                <div className="final-confidence">
                                    <strong>Final Consensus Confidence: {formatPercentage(debateResult.finalConfidence)}</strong>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Feedback Form Modal */}
                    {showFeedbackForm && (
                        <div className="feedback-overlay">
                            <div className="feedback-form">
                                <h3>Provide AI Feedback</h3>

                                <div className="feedback-field">
                                    <label>Overall Rating (1-10):</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={feedbackData.rating}
                                        onChange={(e) => setFeedbackData({ ...feedbackData, rating: parseInt(e.target.value) })}
                                    />
                                    <span>{feedbackData.rating}/10</span>
                                </div>

                                <div className="feedback-field">
                                    <label>Satisfaction (1-10):</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={feedbackData.satisfaction}
                                        onChange={(e) => setFeedbackData({ ...feedbackData, satisfaction: parseInt(e.target.value) })}
                                    />
                                    <span>{feedbackData.satisfaction}/10</span>
                                </div>

                                <div className="feedback-field">
                                    <label>AI Performance (1-10):</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={feedbackData.aiPerformance}
                                        onChange={(e) => setFeedbackData({ ...feedbackData, aiPerformance: parseInt(e.target.value) })}
                                    />
                                    <span>{feedbackData.aiPerformance}/10</span>
                                </div>

                                <div className="feedback-field">
                                    <label>Comments:</label>
                                    <textarea
                                        value={feedbackData.explanation}
                                        onChange={(e) => setFeedbackData({ ...feedbackData, explanation: e.target.value })}
                                        placeholder="Share your thoughts about the AI's performance..."
                                    />
                                </div>

                                <div className="feedback-field">
                                    <label>Suggestions:</label>
                                    <textarea
                                        value={feedbackData.suggestions}
                                        onChange={(e) => setFeedbackData({ ...feedbackData, suggestions: e.target.value })}
                                        placeholder="Any suggestions for improvement..."
                                    />
                                </div>

                                <div className="feedback-actions">
                                    <button onClick={handleSubmitFeedback} className="submit-feedback">
                                        Submit Feedback
                                    </button>
                                    <button
                                        onClick={() => setShowFeedbackForm(false)}
                                        className="cancel-feedback"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default EnhancedAIInsights; 