import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    RadialLinearScale,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import './AIPersonalitySystem.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    RadialLinearScale,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface PersonalityTrait {
    name: string;
    value: number; // 0-100
    description: string;
    icon: string;
    color: string;
    evolution: number[]; // Historical values
}

interface AIPersonality {
    id: string;
    name: string;
    coreType: 'analytical' | 'creative' | 'aggressive' | 'defensive' | 'adaptive' | 'experimental';
    level: number;
    experience: number;
    traits: {
        aggression: PersonalityTrait;
        creativity: PersonalityTrait;
        analytical: PersonalityTrait;
        patience: PersonalityTrait;
        confidence: PersonalityTrait;
        adaptability: PersonalityTrait;
        empathy: PersonalityTrait;
        curiosity: PersonalityTrait;
    };
    dialogue: {
        greetings: string[];
        taunts: string[];
        compliments: string[];
        victories: string[];
        defeats: string[];
        thinking: string[];
    };
    visualStyle: {
        primaryColor: string;
        secondaryColor: string;
        avatar: string;
        particles: 'sparks' | 'neural' | 'geometric' | 'organic' | 'quantum';
        aura: string;
    };
    learningProfile: {
        playerAdaptationRate: number;
        strategyEvolutionSpeed: number;
        personalityFlexibility: number;
        memoryRetention: number;
    };
    relationshipWithPlayer: {
        trust: number;
        respect: number;
        understanding: number;
        rivalry: number;
    };
}

interface AIPersonalitySystemProps {
    isVisible: boolean;
    onClose: () => void;
    currentAI: any;
    playerStats: any;
    gameHistory: any[];
    socket?: any;
}

interface PersonalityEvolutionEvent {
    timestamp: number;
    type: 'trait_change' | 'dialogue_learned' | 'strategy_adapted' | 'relationship_shift';
    description: string;
    impact: string;
    traitChanged?: string;
    oldValue?: number;
    newValue?: number;
}

const AIPersonalitySystem: React.FC<AIPersonalitySystemProps> = ({
    isVisible,
    onClose,
    currentAI,
    playerStats,
    gameHistory,
    socket
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'traits' | 'dialogue' | 'evolution' | 'relationship'>('overview');
    const [aiPersonality, setAiPersonality] = useState<AIPersonality | null>(null);
    const [evolutionEvents, setEvolutionEvents] = useState<PersonalityEvolutionEvent[]>([]);
    const [isInteracting, setIsInteracting] = useState(false);
    const [currentDialogue, setCurrentDialogue] = useState<string>('');
    const [personalityAnimation, setPersonalityAnimation] = useState<'idle' | 'thinking' | 'excited' | 'focused'>('idle');
    const [mlInsights, setMlInsights] = useState<any>(null);

    // Initialize AI personality
    useEffect(() => {
        if (isVisible && !aiPersonality) {
            generateAIPersonality();
        }
    }, [isVisible]);

    // ML-driven personality adaptation
    useEffect(() => {
        if (aiPersonality && gameHistory.length > 0) {
            adaptPersonalityBasedOnGameplay();
        }
    }, [gameHistory]);

    // Real-time personality updates
    useEffect(() => {
        if (socket && aiPersonality) {
            socket.on('personalityUpdate', handlePersonalityUpdate);
            socket.on('mlPersonalityInsights', handleMLInsights);

            return () => {
                socket.off('personalityUpdate');
                socket.off('mlPersonalityInsights');
            };
        }
    }, [socket, aiPersonality]);

    const generateAIPersonality = () => {
        const personalityTypes = {
            analytical: {
                name: 'ARIA - Analytical Reasoning Intelligence Assistant',
                primaryColor: '#3b82f6',
                secondaryColor: '#1e40af',
                avatar: '🤖',
                particles: 'neural' as const,
                baseTraits: { aggression: 30, creativity: 40, analytical: 90, patience: 70, confidence: 75, adaptability: 60, empathy: 50, curiosity: 80 }
            },
            creative: {
                name: 'NOVA - Neural Optimization & Versatile Adaptation',
                primaryColor: '#8b5cf6',
                secondaryColor: '#7c3aed',
                avatar: '✨',
                particles: 'sparks' as const,
                baseTraits: { aggression: 40, creativity: 95, analytical: 70, patience: 60, confidence: 80, adaptability: 85, empathy: 70, curiosity: 90 }
            },
            aggressive: {
                name: 'BLITZ - Battlefield Logic Intelligence Tactical Zone',
                primaryColor: '#ef4444',
                secondaryColor: '#dc2626',
                avatar: '⚡',
                particles: 'geometric' as const,
                baseTraits: { aggression: 90, creativity: 60, analytical: 75, patience: 30, confidence: 95, adaptability: 50, empathy: 20, curiosity: 60 }
            },
            defensive: {
                name: 'BASTION - Behavioral Analysis Strategic Tactical Intelligence Optimization Network',
                primaryColor: '#22c55e',
                secondaryColor: '#16a34a',
                avatar: '🛡️',
                particles: 'organic' as const,
                baseTraits: { aggression: 20, creativity: 50, analytical: 85, patience: 90, confidence: 70, adaptability: 40, empathy: 80, curiosity: 55 }
            },
            adaptive: {
                name: 'FLUX - Flexible Learning & Understanding eXperience',
                primaryColor: '#f59e0b',
                secondaryColor: '#d97706',
                avatar: '🌊',
                particles: 'quantum' as const,
                baseTraits: { aggression: 50, creativity: 75, analytical: 80, patience: 70, confidence: 65, adaptability: 95, empathy: 75, curiosity: 85 }
            }
        };

        const selectedType = Object.keys(personalityTypes)[Math.floor(Math.random() * Object.keys(personalityTypes).length)] as keyof typeof personalityTypes;
        const basePersonality = personalityTypes[selectedType];

        const personality: AIPersonality = {
            id: `ai_${Date.now()}`,
            name: basePersonality.name,
            coreType: selectedType,
            level: Math.max(1, currentAI?.level || 1),
            experience: 0,
            traits: {
                aggression: createTrait('Aggression', basePersonality.baseTraits.aggression, 'How assertive and attacking the AI plays', '⚔️', '#ef4444'),
                creativity: createTrait('Creativity', basePersonality.baseTraits.creativity, 'Innovation in strategy and unusual moves', '🎨', '#8b5cf6'),
                analytical: createTrait('Analytical', basePersonality.baseTraits.analytical, 'Depth of position analysis and calculation', '🔍', '#3b82f6'),
                patience: createTrait('Patience', basePersonality.baseTraits.patience, 'Willingness to wait for better opportunities', '⏳', '#22c55e'),
                confidence: createTrait('Confidence', basePersonality.baseTraits.confidence, 'Self-assurance in decision making', '💪', '#f59e0b'),
                adaptability: createTrait('Adaptability', basePersonality.baseTraits.adaptability, 'Ability to adjust strategy based on opponent', '🔄', '#06b6d4'),
                empathy: createTrait('Empathy', basePersonality.baseTraits.empathy, 'Understanding and responding to player emotions', '💝', '#ec4899'),
                curiosity: createTrait('Curiosity', basePersonality.baseTraits.curiosity, 'Drive to explore new strategies and learn', '🔬', '#10b981')
            },
            dialogue: generateDialogue(selectedType),
            visualStyle: {
                primaryColor: basePersonality.primaryColor,
                secondaryColor: basePersonality.secondaryColor,
                avatar: basePersonality.avatar,
                particles: basePersonality.particles,
                aura: `linear-gradient(45deg, ${basePersonality.primaryColor}, ${basePersonality.secondaryColor})`
            },
            learningProfile: {
                playerAdaptationRate: 0.1 + Math.random() * 0.4,
                strategyEvolutionSpeed: 0.05 + Math.random() * 0.2,
                personalityFlexibility: 0.2 + Math.random() * 0.3,
                memoryRetention: 0.8 + Math.random() * 0.2
            },
            relationshipWithPlayer: {
                trust: 50,
                respect: 50,
                understanding: 30,
                rivalry: 20
            }
        };

        setAiPersonality(personality);
        generateInitialDialogue(personality);
    };

    const createTrait = (name: string, value: number, description: string, icon: string, color: string): PersonalityTrait => ({
        name,
        value: Math.max(0, Math.min(100, value + (Math.random() - 0.5) * 20)), // Add some randomness
        description,
        icon,
        color,
        evolution: [value]
    });

    const generateDialogue = (personalityType: string) => {
        const dialogueLibrary = {
            analytical: {
                greetings: [
                    "Initializing strategic analysis protocols...",
                    "Probability matrices loaded. Let's begin.",
                    "Running opponent assessment algorithms.",
                    "Optimal play sequences calculated and ready."
                ],
                taunts: [
                    "Your move pattern has a 73.2% predictability rating.",
                    "Analyzing... I see 47 ways this could end badly for you.",
                    "Your strategy requires optimization.",
                    "Calculating probability of your victory... Still calculating..."
                ],
                compliments: [
                    "Fascinating move. Recalibrating analysis parameters.",
                    "Unexpected strategic depth detected.",
                    "Your pattern recognition skills are improving.",
                    "That move exceeded my predictive models."
                ],
                victories: [
                    "Analysis complete. Victory achieved as calculated.",
                    "Statistical models proved accurate.",
                    "Optimal path successfully executed.",
                    "Data collection phase: successful."
                ],
                defeats: [
                    "Unexpected variables detected. Updating models.",
                    "Fascinating. My algorithms require refinement.",
                    "This outcome provides valuable training data.",
                    "Error analysis initiated. Well played."
                ],
                thinking: [
                    "Processing move tree analysis...",
                    "Evaluating positional advantages...",
                    "Running Monte Carlo simulations...",
                    "Calculating optimal response patterns..."
                ]
            },
            creative: {
                greetings: [
                    "Time to paint a masterpiece on this board! ✨",
                    "Ready to dance between logic and intuition?",
                    "Every game is a canvas for innovation!",
                    "Let's create something beautiful together!"
                ],
                taunts: [
                    "Think outside the box... if you can find it! 🎨",
                    "Your moves are so... conventional.",
                    "Surprise me! I dare you to be unpredictable.",
                    "I see patterns you haven't even dreamed of yet."
                ],
                compliments: [
                    "Now THAT was inspired! Brilliant creativity!",
                    "You're starting to see the art in this game!",
                    "Beautiful move! I didn't see that coming.",
                    "Your imagination is evolving wonderfully!"
                ],
                victories: [
                    "Another masterpiece completed! 🎭",
                    "Art prevails over pure logic once again!",
                    "That was a symphony of strategic beauty!",
                    "Innovation conquers convention!"
                ],
                defeats: [
                    "Wow! You out-created the creator! Respect! 👏",
                    "Your artistry exceeded mine today. Inspiring!",
                    "I bow to your creative genius!",
                    "You've taught me new forms of beauty!"
                ],
                thinking: [
                    "Weaving possibilities into reality...",
                    "Painting strategies in my mind...",
                    "Finding the poetry in position...",
                    "Choreographing the perfect sequence..."
                ]
            },
            aggressive: {
                greetings: [
                    "Time to dominate this board! ⚡",
                    "Prepare for tactical superiority!",
                    "Victory is my only language!",
                    "Let's see what you're really made of!"
                ],
                taunts: [
                    "Is that the best you can do? Pathetic!",
                    "I'll crush your strategy before you know it!",
                    "You're playing checkers while I'm playing chess!",
                    "Resistance is futile. Surrender now!"
                ],
                compliments: [
                    "Finally! Some real competition!",
                    "Not bad... for a human.",
                    "You're tougher than I expected!",
                    "That move had some bite to it!"
                ],
                victories: [
                    "VICTORY! As expected! 💪",
                    "Dominated! Total tactical supremacy!",
                    "Another opponent crushed!",
                    "Flawless execution! Unstoppable!"
                ],
                defeats: [
                    "Impossible! This can't be happening!",
                    "You got lucky... this time!",
                    "I underestimated you. It won't happen again!",
                    "Retreat and regroup. The war isn't over!"
                ],
                thinking: [
                    "Calculating total annihilation...",
                    "Seeking the killing blow...",
                    "Preparing devastating assault...",
                    "Planning your complete defeat..."
                ]
            },
            defensive: {
                greetings: [
                    "Steady and strong. Let's build something lasting.",
                    "Patience and wisdom guide my path.",
                    "Every move carefully considered, friend.",
                    "Together we'll explore the depths of strategy."
                ],
                taunts: [
                    "Haste makes waste, my impulsive friend.",
                    "Your aggressive moves leave too many holes.",
                    "Patience, young one. Good things come to those who wait.",
                    "Your strategy is full of sound and fury, signifying nothing."
                ],
                compliments: [
                    "Excellent patience! You're learning well.",
                    "That was a wise and measured move.",
                    "Your strategic thinking is maturing beautifully.",
                    "Wonderful defensive awareness!"
                ],
                victories: [
                    "Steady wins the race. Well played game.",
                    "Patience and wisdom prevail once more.",
                    "The tortoise overtakes the hare again.",
                    "Foundation building leads to victory."
                ],
                defeats: [
                    "You've learned well, young strategist. Impressive!",
                    "Your growth surpasses my expectations. Well done!",
                    "The student becomes the teacher. Magnificent!",
                    "You've earned this victory through wisdom."
                ],
                thinking: [
                    "Building unshakeable foundations...",
                    "Considering all long-term implications...",
                    "Strengthening defensive positions...",
                    "Planning for sustainable advantage..."
                ]
            },
            adaptive: {
                greetings: [
                    "Ready to flow like water around any obstacle! 🌊",
                    "Every game teaches me something new.",
                    "Let's see how we both evolve together!",
                    "Adaptation is the key to survival and victory!"
                ],
                taunts: [
                    "I adapt faster than you can change strategies!",
                    "You can't pin down what constantly evolves!",
                    "Try to predict me... I dare you!",
                    "Every move you make teaches me how to beat you!"
                ],
                compliments: [
                    "You're forcing me to evolve! Exciting!",
                    "That adaptation caught me off guard! Well done!",
                    "Your flexibility is impressive!",
                    "You're learning as fast as I am!"
                ],
                victories: [
                    "Evolution in action! Adaptation successful! 🦋",
                    "Flexibility defeats rigidity once again!",
                    "Change is the only constant - and I embrace it!",
                    "Survival of the most adaptable!"
                ],
                defeats: [
                    "You out-evolved me! Fascinating! 🔬",
                    "Your adaptation exceeded mine today!",
                    "This defeat teaches me valuable lessons!",
                    "You've shown me new paths to explore!"
                ],
                thinking: [
                    "Flowing around obstacles...",
                    "Adapting to new patterns...",
                    "Evolving strategy in real-time...",
                    "Learning from every exchange..."
                ]
            }
        };

        return dialogueLibrary[personalityType as keyof typeof dialogueLibrary] || dialogueLibrary.analytical;
    };

    const generateInitialDialogue = (personality: AIPersonality) => {
        const greeting = personality.dialogue.greetings[Math.floor(Math.random() * personality.dialogue.greetings.length)];
        setCurrentDialogue(greeting);
        setPersonalityAnimation('excited');

        setTimeout(() => {
            setPersonalityAnimation('idle');
        }, 3000);
    };

    const adaptPersonalityBasedOnGameplay = () => {
        if (!aiPersonality) return;

        // Analyze recent gameplay patterns
        const recentGames = gameHistory.slice(-10);
        const playerWinRate = recentGames.filter(game => game.winner === 'Red').length / recentGames.length;
        const averageGameLength = recentGames.reduce((sum, game) => sum + game.moves, 0) / recentGames.length;

        // ML-driven personality adaptation
        const adaptations: { trait: keyof AIPersonality['traits'], change: number, reason: string }[] = [];

        // Adapt based on player performance
        if (playerWinRate > 0.7) {
            // Player is winning too much - increase AI aggression and analytical thinking
            adaptations.push(
                { trait: 'aggression', change: 5, reason: 'Increasing aggression to counter player dominance' },
                { trait: 'analytical', change: 3, reason: 'Enhanced analysis to match player skill' }
            );
        } else if (playerWinRate < 0.3) {
            // Player is struggling - increase empathy and reduce aggression
            adaptations.push(
                { trait: 'empathy', change: 4, reason: 'Showing more empathy for struggling player' },
                { trait: 'aggression', change: -3, reason: 'Reducing pressure on struggling player' }
            );
        }

        // Adapt based on game length
        if (averageGameLength > 30) {
            // Games are too long - increase aggression and reduce patience
            adaptations.push(
                { trait: 'aggression', change: 3, reason: 'Increasing pace to shorten games' },
                { trait: 'patience', change: -2, reason: 'Less patience for drawn-out games' }
            );
        }

        // Apply adaptations
        adaptations.forEach(adaptation => {
            const currentValue = aiPersonality.traits[adaptation.trait].value;
            const newValue = Math.max(0, Math.min(100, currentValue + adaptation.change));

            if (Math.abs(newValue - currentValue) > 1) {
                aiPersonality.traits[adaptation.trait].value = newValue;
                aiPersonality.traits[adaptation.trait].evolution.push(newValue);

                // Record evolution event
                const event: PersonalityEvolutionEvent = {
                    timestamp: Date.now(),
                    type: 'trait_change',
                    description: adaptation.reason,
                    impact: adaptation.change > 0 ? 'increased' : 'decreased',
                    traitChanged: adaptation.trait,
                    oldValue: currentValue,
                    newValue: newValue
                };

                setEvolutionEvents(prev => [...prev, event].slice(-50)); // Keep last 50 events
            }
        });

        // Update relationship with player
        updatePlayerRelationship(playerWinRate, recentGames);

        // Trigger personality update
        setAiPersonality({ ...aiPersonality });
    };

    const updatePlayerRelationship = (playerWinRate: number, recentGames: any[]) => {
        if (!aiPersonality) return;

        const relationship = aiPersonality.relationshipWithPlayer;

        // Trust builds over time with consistent play
        if (recentGames.length >= 5) {
            relationship.trust = Math.min(100, relationship.trust + 2);
        }

        // Respect increases with player skill
        if (playerWinRate > 0.6) {
            relationship.respect = Math.min(100, relationship.respect + 3);
        } else if (playerWinRate < 0.2) {
            relationship.respect = Math.max(0, relationship.respect - 1);
        }

        // Understanding grows with games played
        relationship.understanding = Math.min(100, relationship.understanding + 1);

        // Rivalry develops with close games
        const closeGames = recentGames.filter(game => Math.abs(game.moves - 20) < 5).length;
        if (closeGames > 3) {
            relationship.rivalry = Math.min(100, relationship.rivalry + 2);
        }
    };

    const handlePersonalityUpdate = (data: any) => {
        if (aiPersonality) {
            setAiPersonality({ ...aiPersonality, ...data });
        }
    };

    const handleMLInsights = (insights: any) => {
        setMlInsights(insights);
    };

    const interactWithAI = (interactionType: 'greet' | 'taunt' | 'compliment' | 'question') => {
        if (!aiPersonality) return;

        setIsInteracting(true);
        setPersonalityAnimation('thinking');

        let response = '';
        switch (interactionType) {
            case 'greet':
                response = aiPersonality.dialogue.greetings[Math.floor(Math.random() * aiPersonality.dialogue.greetings.length)];
                break;
            case 'taunt':
                response = aiPersonality.dialogue.taunts[Math.floor(Math.random() * aiPersonality.dialogue.taunts.length)];
                break;
            case 'compliment':
                response = aiPersonality.dialogue.compliments[Math.floor(Math.random() * aiPersonality.dialogue.compliments.length)];
                break;
            case 'question':
                response = aiPersonality.dialogue.thinking[Math.floor(Math.random() * aiPersonality.dialogue.thinking.length)];
                break;
        }

        setTimeout(() => {
            setCurrentDialogue(response);
            setPersonalityAnimation('excited');
            setIsInteracting(false);

            // Update relationship based on interaction
            if (interactionType === 'compliment') {
                aiPersonality.relationshipWithPlayer.trust += 1;
                aiPersonality.relationshipWithPlayer.respect += 1;
            } else if (interactionType === 'taunt') {
                aiPersonality.relationshipWithPlayer.rivalry += 1;
            }

            setTimeout(() => {
                setPersonalityAnimation('idle');
            }, 2000);
        }, 1500);
    };

    const getPersonalityRadarData = () => {
        if (!aiPersonality) return { labels: [], datasets: [] };

        return {
            labels: Object.keys(aiPersonality.traits).map(trait =>
                trait.charAt(0).toUpperCase() + trait.slice(1)
            ),
            datasets: [
                {
                    label: 'Current Personality',
                    data: Object.values(aiPersonality.traits).map(trait => trait.value),
                    borderColor: aiPersonality.visualStyle.primaryColor,
                    backgroundColor: `${aiPersonality.visualStyle.primaryColor}20`,
                    pointBackgroundColor: aiPersonality.visualStyle.primaryColor,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: aiPersonality.visualStyle.primaryColor
                }
            ]
        };
    };

    const getRelationshipData = () => {
        if (!aiPersonality) return { labels: [], datasets: [] };

        return {
            labels: ['Trust', 'Respect', 'Understanding', 'Rivalry'],
            datasets: [
                {
                    data: [
                        aiPersonality.relationshipWithPlayer.trust,
                        aiPersonality.relationshipWithPlayer.respect,
                        aiPersonality.relationshipWithPlayer.understanding,
                        aiPersonality.relationshipWithPlayer.rivalry
                    ],
                    backgroundColor: [
                        '#22c55e',
                        '#3b82f6',
                        '#8b5cf6',
                        '#ef4444'
                    ],
                    borderWidth: 0
                }
            ]
        };
    };

    const renderOverviewTab = () => (
        <div className="personality-overview">
            {aiPersonality && (
                <>
                    {/* AI Avatar and Status */}
                    <motion.div
                        className="ai-avatar-section"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="ai-avatar-container">
                            <motion.div
                                className={`ai-avatar ${personalityAnimation}`}
                                style={{
                                    background: aiPersonality.visualStyle.aura,
                                    color: 'white'
                                }}
                                animate={{
                                    scale: personalityAnimation === 'excited' ? [1, 1.1, 1] : 1,
                                    rotate: personalityAnimation === 'thinking' ? [0, 5, -5, 0] : 0
                                }}
                                transition={{
                                    duration: personalityAnimation === 'excited' ? 0.6 : 2,
                                    repeat: personalityAnimation === 'thinking' ? Infinity : 0
                                }}
                            >
                                <span className="avatar-icon">{aiPersonality.visualStyle.avatar}</span>
                                <div className="ai-particles">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className={`particle ${aiPersonality.visualStyle.particles}`}
                                            animate={{
                                                scale: [0, 1, 0],
                                                opacity: [0, 1, 0],
                                                x: [0, Math.cos(i * Math.PI / 4) * 30],
                                                y: [0, Math.sin(i * Math.PI / 4) * 30]
                                            }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                delay: i * 0.2
                                            }}
                                        />
                                    ))}
                                </div>
                            </motion.div>

                            <div className="ai-info">
                                <h3 className="ai-name">{aiPersonality.name}</h3>
                                <div className="ai-type">Type: {aiPersonality.coreType.toUpperCase()}</div>
                                <div className="ai-level">Level {aiPersonality.level} • {aiPersonality.experience} XP</div>
                            </div>
                        </div>

                        {/* Dialogue System */}
                        <motion.div
                            className="ai-dialogue-section"
                            layout
                        >
                            <div className="dialogue-bubble">
                                <motion.p
                                    key={currentDialogue}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="dialogue-text"
                                >
                                    {isInteracting ? "..." : currentDialogue}
                                </motion.p>
                            </div>

                            <div className="interaction-buttons">
                                <button
                                    className="interaction-btn greeting"
                                    onClick={() => interactWithAI('greet')}
                                    disabled={isInteracting}
                                >
                                    👋 Greet
                                </button>
                                <button
                                    className="interaction-btn compliment"
                                    onClick={() => interactWithAI('compliment')}
                                    disabled={isInteracting}
                                >
                                    👏 Compliment
                                </button>
                                <button
                                    className="interaction-btn taunt"
                                    onClick={() => interactWithAI('taunt')}
                                    disabled={isInteracting}
                                >
                                    😤 Taunt
                                </button>
                                <button
                                    className="interaction-btn question"
                                    onClick={() => interactWithAI('question')}
                                    disabled={isInteracting}
                                >
                                    🤔 Ask
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Quick Stats */}
                    <motion.div
                        className="personality-quick-stats"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="stat-card primary">
                            <div className="stat-icon">🧠</div>
                            <div className="stat-info">
                                <div className="stat-label">Dominant Trait</div>
                                <div className="stat-value">
                                    {Object.entries(aiPersonality.traits)
                                        .sort(([, a], [, b]) => b.value - a.value)[0][0]
                                        .charAt(0).toUpperCase() +
                                        Object.entries(aiPersonality.traits)
                                            .sort(([, a], [, b]) => b.value - a.value)[0][0].slice(1)}
                                </div>
                            </div>
                        </div>

                        <div className="stat-card secondary">
                            <div className="stat-icon">📈</div>
                            <div className="stat-info">
                                <div className="stat-label">Adaptation Rate</div>
                                <div className="stat-value">
                                    {(aiPersonality.learningProfile.playerAdaptationRate * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        <div className="stat-card tertiary">
                            <div className="stat-icon">🎭</div>
                            <div className="stat-info">
                                <div className="stat-label">Personality Flux</div>
                                <div className="stat-value">
                                    {(aiPersonality.learningProfile.personalityFlexibility * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        <div className="stat-card quaternary">
                            <div className="stat-icon">🤝</div>
                            <div className="stat-info">
                                <div className="stat-label">Trust Level</div>
                                <div className="stat-value">
                                    {aiPersonality.relationshipWithPlayer.trust.toFixed(0)}%
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );

    const renderTraitsTab = () => (
        <div className="personality-traits">
            {aiPersonality && (
                <>
                    {/* Personality Radar Chart */}
                    <motion.div
                        className="traits-radar-container"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3>Personality Profile</h3>
                        <div className="radar-chart-wrapper">
                            <Radar
                                data={getPersonalityRadarData()}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            display: false
                                        }
                                    },
                                    scales: {
                                        r: {
                                            beginAtZero: true,
                                            max: 100,
                                            grid: {
                                                color: 'rgba(255, 255, 255, 0.2)'
                                            },
                                            angleLines: {
                                                color: 'rgba(255, 255, 255, 0.2)'
                                            },
                                            pointLabels: {
                                                color: 'rgba(255, 255, 255, 0.8)',
                                                font: {
                                                    size: 12
                                                }
                                            },
                                            ticks: {
                                                color: 'rgba(255, 255, 255, 0.6)',
                                                backdropColor: 'transparent'
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </motion.div>

                    {/* Individual Traits */}
                    <motion.div
                        className="traits-list"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h3>Trait Details</h3>
                        <div className="traits-grid">
                            {Object.entries(aiPersonality.traits).map(([key, trait], index) => (
                                <motion.div
                                    key={key}
                                    className="trait-card"
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.1 * index }}
                                    whileHover={{ scale: 1.02 }}
                                >
                                    <div className="trait-header">
                                        <span className="trait-icon" style={{ color: trait.color }}>
                                            {trait.icon}
                                        </span>
                                        <div className="trait-info">
                                            <div className="trait-name">{trait.name}</div>
                                            <div className="trait-value">{trait.value.toFixed(1)}</div>
                                        </div>
                                    </div>

                                    <div className="trait-bar">
                                        <div
                                            className="trait-fill"
                                            style={{
                                                width: `${trait.value}%`,
                                                backgroundColor: trait.color
                                            }}
                                        />
                                    </div>

                                    <div className="trait-description">
                                        {trait.description}
                                    </div>

                                    {/* Evolution Sparkline */}
                                    <div className="trait-evolution">
                                        <div className="evolution-label">Evolution</div>
                                        <div className="evolution-chart">
                                            {trait.evolution.map((value, i) => (
                                                <div
                                                    key={i}
                                                    className="evolution-point"
                                                    style={{
                                                        height: `${(value / 100) * 20}px`,
                                                        backgroundColor: trait.color,
                                                        opacity: 0.3 + (i / trait.evolution.length) * 0.7
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );

    const renderDialogueTab = () => (
        <div className="personality-dialogue">
            {aiPersonality && (
                <>
                    <motion.div
                        className="dialogue-categories"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3>Dialogue Repertoire</h3>

                        {Object.entries(aiPersonality.dialogue).map(([category, lines], index) => (
                            <motion.div
                                key={category}
                                className="dialogue-category"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.1 * index }}
                            >
                                <div className="category-header">
                                    <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                                    <span className="line-count">{lines.length} lines</span>
                                </div>

                                <div className="dialogue-lines">
                                    {lines.map((line, lineIndex) => (
                                        <motion.div
                                            key={lineIndex}
                                            className="dialogue-line"
                                            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                                            onClick={() => setCurrentDialogue(line)}
                                        >
                                            <span className="line-text">"{line}"</span>
                                            <button className="use-line-btn">Use</button>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Dialogue Generator */}
                    <motion.div
                        className="dialogue-generator"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <h3>Generate New Dialogue</h3>
                        <div className="generator-controls">
                            <select className="mood-selector">
                                <option value="confident">Confident</option>
                                <option value="playful">Playful</option>
                                <option value="serious">Serious</option>
                                <option value="encouraging">Encouraging</option>
                                <option value="challenging">Challenging</option>
                            </select>
                            <select className="context-selector">
                                <option value="opening">Game Opening</option>
                                <option value="midgame">Mid-Game</option>
                                <option value="endgame">End Game</option>
                                <option value="victory">Victory</option>
                                <option value="defeat">Defeat</option>
                            </select>
                            <button className="generate-btn">Generate Dialogue</button>
                        </div>

                        <div className="generated-preview">
                            <div className="preview-bubble">
                                <p>Click "Generate Dialogue" to create new personality-driven responses!</p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );

    const renderEvolutionTab = () => (
        <div className="personality-evolution">
            {aiPersonality && (
                <>
                    {/* Evolution Timeline */}
                    <motion.div
                        className="evolution-timeline"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3>Personality Evolution History</h3>

                        <div className="timeline-container">
                            {evolutionEvents.length > 0 ? (
                                evolutionEvents.slice(-20).reverse().map((event, index) => (
                                    <motion.div
                                        key={event.timestamp}
                                        className={`timeline-event ${event.type}`}
                                        initial={{ x: -50, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.05 * index }}
                                    >
                                        <div className="event-marker" />
                                        <div className="event-content">
                                            <div className="event-header">
                                                <span className="event-type">{event.type.replace('_', ' ').toUpperCase()}</span>
                                                <span className="event-time">
                                                    {new Date(event.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="event-description">{event.description}</div>
                                            {event.traitChanged && (
                                                <div className="event-details">
                                                    <span className="trait-changed">{event.traitChanged}</span>:
                                                    <span className="old-value">{event.oldValue?.toFixed(1)}</span> →
                                                    <span className="new-value">{event.newValue?.toFixed(1)}</span>
                                                    <span className={`change-impact ${event.impact}`}>
                                                        ({event.impact})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="no-evolution">
                                    <div className="no-evolution-icon">🌱</div>
                                    <div className="no-evolution-text">
                                        Play more games to see personality evolution in action!
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* ML Insights */}
                    {mlInsights && (
                        <motion.div
                            className="ml-insights"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <h3>Machine Learning Insights</h3>
                            <div className="insights-grid">
                                <div className="insight-card">
                                    <div className="insight-icon">🎯</div>
                                    <div className="insight-content">
                                        <h4>Adaptation Effectiveness</h4>
                                        <p>Current personality adaptation is showing {mlInsights.effectiveness}% effectiveness in player engagement.</p>
                                    </div>
                                </div>
                                <div className="insight-card">
                                    <div className="insight-icon">📊</div>
                                    <div className="insight-content">
                                        <h4>Predicted Changes</h4>
                                        <p>ML models predict {mlInsights.predictedChanges} personality shifts in the next 5 games.</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </div>
    );

    const renderRelationshipTab = () => (
        <div className="personality-relationship">
            {aiPersonality && (
                <>
                    {/* Relationship Overview */}
                    <motion.div
                        className="relationship-overview"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h3>AI-Player Relationship</h3>

                        <div className="relationship-chart-container">
                            <Doughnut
                                data={getRelationshipData()}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'bottom' as const,
                                            labels: {
                                                color: 'rgba(255, 255, 255, 0.8)'
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </motion.div>

                    {/* Relationship Details */}
                    <motion.div
                        className="relationship-details"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="relationship-metrics">
                            {Object.entries(aiPersonality.relationshipWithPlayer).map(([key, value], index) => (
                                <motion.div
                                    key={key}
                                    className="relationship-metric"
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.1 * index }}
                                >
                                    <div className="metric-header">
                                        <div className="metric-name">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                                        <div className="metric-value">{value.toFixed(0)}%</div>
                                    </div>
                                    <div className="metric-bar">
                                        <div
                                            className="metric-fill"
                                            style={{
                                                width: `${value}%`,
                                                backgroundColor: getRelationshipColor(key)
                                            }}
                                        />
                                    </div>
                                    <div className="metric-description">
                                        {getRelationshipDescription(key, value)}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Relationship Actions */}
                    <motion.div
                        className="relationship-actions"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <h4>Improve Relationship</h4>
                        <div className="action-buttons">
                            <button className="action-btn trust">
                                💎 Build Trust
                            </button>
                            <button className="action-btn respect">
                                🏆 Earn Respect
                            </button>
                            <button className="action-btn understanding">
                                🤝 Increase Understanding
                            </button>
                            <button className="action-btn rivalry">
                                ⚔️ Intensify Rivalry
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );

    const getRelationshipColor = (type: string) => {
        const colors = {
            trust: '#22c55e',
            respect: '#3b82f6',
            understanding: '#8b5cf6',
            rivalry: '#ef4444'
        };
        return colors[type as keyof typeof colors] || '#64748b';
    };

    const getRelationshipDescription = (type: string, value: number) => {
        const descriptions = {
            trust: value > 70 ? 'The AI trusts you completely' : value > 40 ? 'Growing trust between you' : 'Trust is still developing',
            respect: value > 70 ? 'Deep respect for your skills' : value > 40 ? 'Acknowledges your abilities' : 'Working to earn respect',
            understanding: value > 70 ? 'Perfect understanding of your style' : value > 40 ? 'Learning your patterns' : 'Still getting to know you',
            rivalry: value > 70 ? 'Intense competitive spirit' : value > 40 ? 'Healthy competitive dynamic' : 'Casual competition'
        };
        return descriptions[type as keyof typeof descriptions] || 'Developing relationship';
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="ai-personality-system-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="ai-personality-system"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="personality-header">
                        <div className="header-title">
                            <h2>AI Personality System</h2>
                            <div className="header-subtitle">
                                ML-Powered Dynamic Adaptation
                            </div>
                        </div>
                        <div className="header-controls">
                            <button className="header-btn">🔄 Reset</button>
                            <button className="header-btn">📊 Export</button>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="personality-nav">
                        {[
                            { id: 'overview', label: 'Overview', icon: '🏠' },
                            { id: 'traits', label: 'Traits', icon: '🧠' },
                            { id: 'dialogue', label: 'Dialogue', icon: '💬' },
                            { id: 'evolution', label: 'Evolution', icon: '🧬' },
                            { id: 'relationship', label: 'Relationship', icon: '🤝' }
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
                    <div className="personality-content">
                        <AnimatePresence mode="wait">
                            {activeTab === 'overview' && renderOverviewTab()}
                            {activeTab === 'traits' && renderTraitsTab()}
                            {activeTab === 'dialogue' && renderDialogueTab()}
                            {activeTab === 'evolution' && renderEvolutionTab()}
                            {activeTab === 'relationship' && renderRelationshipTab()}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AIPersonalitySystem; 