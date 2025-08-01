// frontend/src/components/ai-insights/MoveAnalysis.tsx
import React, { useEffect, useState } from 'react';
import { MoveExplanation, StrategicInsights } from '../../api/ai-insights';
import { analyzeCurrentPosition } from '../../services/moveAnalysisService';
import './MoveAnalysis.css';

interface MoveAnalysisProps {
    boardState: string[][];
    currentPlayer: 'player' | 'ai';
    aiLevel: number;
    gameId?: string;
    isVisible: boolean;
    onClose: () => void;
}

const MoveAnalysis: React.FC<MoveAnalysisProps> = ({
    boardState, // Board state
    currentPlayer, // Current player
    aiLevel, // AI level
    gameId, // Game ID
    isVisible, // Show move analysis
    onClose // Close move analysis
}) => {
    const [analysis, setAnalysis] = useState<{
        explanation: MoveExplanation;
        insights: StrategicInsights;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'explanation' | 'insights' | 'recommendations'>('explanation');

    useEffect(() => {
        if (isVisible && boardState) {
            loadAnalysis();
        }
    }, [isVisible, boardState, currentPlayer, aiLevel, gameId]); // Dependencies

    const loadAnalysis = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await analyzeCurrentPosition(boardState, currentPlayer, aiLevel, gameId); // Analyze current position
            setAnalysis(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load move analysis');
            console.error('Error loading move analysis:', err);
        } finally {
            setLoading(false);
        }
    };

    const getQualityColor = (quality: string) => {
        switch (quality) {
            case 'excellent': return '#2ecc71';
            case 'good': return '#3498db';
            case 'average': return '#f39c12';
            case 'poor': return '#e67e22';
            case 'blunder': return '#e74c3c';
            default: return '#95a5a6';
        }
    };

    const getQualityIcon = (quality: string) => {
        switch (quality) {
            case 'excellent': return '⭐';
            case 'good': return '👍';
            case 'average': return '➖';
            case 'poor': return '👎';
            case 'blunder': return '💥';
            default: return '❓';
        }
    };

    const renderBoard = (boardState: string[][], highlights: number[] = []) => {
        return (
            <div className="board-visualization">
                {boardState.map((row, rowIndex) => (
                    <div key={rowIndex} className="board-row">
                        {row.map((cell, colIndex) => {
                            const isHighlighted = highlights.includes(colIndex);
                            return (
                                <div
                                    key={colIndex}
                                    className={`board-cell ${cell.toLowerCase()} ${isHighlighted ? 'highlighted' : ''}`}
                                >
                                    {cell !== 'Empty' && (
                                        <div className={`disc ${cell.toLowerCase()}`}></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    if (!isVisible) return null;

    return (
        <div className="move-analysis-overlay">
            <div className="move-analysis-modal">
                <div className="move-analysis-header">
                    <h2>Move Analysis</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                {loading && (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Analyzing move...</p>
                    </div>
                )}

                {error && (
                    <div className="error-container">
                        <p className="error-message">⚠️ {error}</p>
                        <button onClick={loadAnalysis} className="retry-btn">Retry</button>
                    </div>
                )}

                {analysis && !loading && (
                    <div className="move-analysis-content">
                        {/* Tab Navigation */}
                        <div className="tab-navigation">
                            <button
                                className={`tab-btn ${activeTab === 'explanation' ? 'active' : ''}`}
                                onClick={() => setActiveTab('explanation')}
                            >
                                📊 Move Explanation
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
                                onClick={() => setActiveTab('insights')}
                            >
                                🧠 Strategic Insights
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'recommendations' ? 'active' : ''}`}
                                onClick={() => setActiveTab('recommendations')}
                            >
                                💡 Recommendations
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="tab-content">
                            {activeTab === 'explanation' && (
                                <div className="explanation-tab">
                                    {/* Move Overview */}
                                    <div className="move-overview">
                                        <div className="move-info">
                                            <span className="move-number">Move {analysis.explanation.metadata.moveNumber}</span>
                                            <span className={`player-badge ${currentPlayer}`}>
                                                {currentPlayer === 'ai' ? '🤖 AI' : '👤 Player'}
                                            </span>
                                            <span className="move-phase">{analysis.explanation.metadata.gamePhase}</span>
                                        </div>

                                        <div className="move-quality">
                                            <span
                                                className="quality-badge"
                                                style={{ backgroundColor: getQualityColor(analysis.explanation.analysis.quality) }}
                                            >
                                                {getQualityIcon(analysis.explanation.analysis.quality)} {analysis.explanation.analysis.quality}
                                            </span>
                                            <span className="confidence-score">
                                                Confidence: {analysis.explanation.analysis.confidence.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Board Visualization */}
                                    <div className="board-section">
                                        <h3>Board State</h3>
                                        <div className="board-comparison">
                                            <div className="board-state">
                                                <h4>Before Move</h4>
                                                {renderBoard(analysis.explanation.boardState.before)}
                                            </div>
                                            <div className="board-state">
                                                <h4>After Move</h4>
                                                {renderBoard(analysis.explanation.boardState.after, analysis.explanation.boardState.highlights)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Move Explanation */}
                                    <div className="explanation-section">
                                        <h3>Move Explanation</h3>
                                        <div className="explanation-content">
                                            <div className="primary-explanation">
                                                <h4>Primary Reasoning</h4>
                                                <p>{analysis.explanation.explanation.primary}</p>
                                            </div>

                                            <div className="secondary-explanations">
                                                <h4>Additional Insights</h4>
                                                <ul>
                                                    {analysis.explanation.explanation.secondary.map((insight, index) => (
                                                        <li key={index}>{insight}</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="strategic-tactical">
                                                <div className="strategic">
                                                    <h4>Strategic Context</h4>
                                                    <p>{analysis.explanation.explanation.strategic}</p>
                                                </div>
                                                <div className="tactical">
                                                    <h4>Tactical Elements</h4>
                                                    <p>{analysis.explanation.explanation.tactical}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'insights' && (
                                <div className="insights-tab">
                                    <div className="position-evaluation">
                                        <h3>Position Evaluation</h3>
                                        <div className="evaluation-grid">
                                            <div className="eval-item">
                                                <span className="eval-label">Position:</span>
                                                <span className={`eval-value ${analysis.insights.evaluation.position}`}>
                                                    {analysis.insights.evaluation.position.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="eval-item">
                                                <span className="eval-label">Score:</span>
                                                <span className="eval-value">{analysis.insights.evaluation.score.toFixed(2)}</span>
                                            </div>
                                            <div className="eval-item">
                                                <span className="eval-label">Confidence:</span>
                                                <span className="eval-value">{(analysis.insights.evaluation.confidence * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="eval-item">
                                                <span className="eval-label">Complexity:</span>
                                                <span className="eval-value">{analysis.insights.evaluation.complexity}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="strategic-insights">
                                        <h3>Strategic Insights</h3>
                                        <div className="insights-grid">
                                            <div className="insight-section">
                                                <h4>Control</h4>
                                                <ul>
                                                    {analysis.insights.insights.strategic.control.map((item, index) => (
                                                        <li key={index}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="insight-section">
                                                <h4>Patterns</h4>
                                                <ul>
                                                    {analysis.insights.insights.strategic.patterns.map((item, index) => (
                                                        <li key={index}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="insight-section">
                                                <h4>Strengths</h4>
                                                <ul>
                                                    {analysis.insights.insights.strategic.strengths.map((item, index) => (
                                                        <li key={index}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="insight-section">
                                                <h4>Weaknesses</h4>
                                                <ul>
                                                    {analysis.insights.insights.strategic.weaknesses.map((item, index) => (
                                                        <li key={index}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="tactical-insights">
                                        <h3>Tactical Elements</h3>
                                        <div className="tactical-grid">
                                            <div className="tactical-section">
                                                <h4>Combinations</h4>
                                                <ul>
                                                    {analysis.insights.insights.tactical.combinations.map((item, index) => (
                                                        <li key={index}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="tactical-section">
                                                <h4>Traps</h4>
                                                <ul>
                                                    {analysis.insights.insights.tactical.traps.map((item, index) => (
                                                        <li key={index}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="tactical-section">
                                                <h4>Counters</h4>
                                                <ul>
                                                    {analysis.insights.insights.tactical.counters.map((item, index) => (
                                                        <li key={index}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'recommendations' && (
                                <div className="recommendations-tab">
                                    <div className="best-moves">
                                        <h3>Recommended Moves</h3>
                                        <div className="moves-grid">
                                            {analysis.insights.recommendations.bestMoves.map((move, index) => (
                                                <div key={index} className="move-recommendation">
                                                    <div className="move-header">
                                                        <span className="move-column">Column {move.column + 1}</span>
                                                        <span className={`risk-badge ${move.risk}`}>{move.risk}</span>
                                                    </div>
                                                    <div className="move-score">Score: {move.score.toFixed(2)}</div>
                                                    <div className="move-reasoning">{move.reasoning}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="avoid-moves">
                                        <h3>Moves to Avoid</h3>
                                        <div className="avoid-grid">
                                            {analysis.insights.recommendations.avoidMoves.map((move, index) => (
                                                <div key={index} className="avoid-move">
                                                    <div className="avoid-header">
                                                        <span className="avoid-column">Column {move.column + 1}</span>
                                                        <span className="risk-badge high">HIGH RISK</span>
                                                    </div>
                                                    <div className="avoid-reason">{move.reason}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="immediate-threats">
                                        <h3>Immediate Analysis</h3>
                                        <div className="threats-grid">
                                            <div className="threat-section">
                                                <h4>Threats</h4>
                                                <ul>
                                                    {analysis.insights.insights.immediate.threats.map((threat, index) => (
                                                        <li key={index}>Column {threat + 1}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="threat-section">
                                                <h4>Opportunities</h4>
                                                <ul>
                                                    {analysis.insights.insights.immediate.opportunities.map((opp, index) => (
                                                        <li key={index}>Column {opp + 1}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MoveAnalysis; 