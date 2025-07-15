// src/ai/multiagent/agentCommunication.ts
import { Agent, CommunicationMessage, MultiAgentGame } from './multiAgentEnv';
import { CellValue } from '../connect4AI';

export interface CommunicationProtocol {
    name: string;
    version: string;
    messageTypes: string[];
    reliability: number;
    bandwidth: number;
    latency: number;
    authenticate: (sender: Agent, receiver: Agent) => boolean;
    encode: (message: any) => string;
    decode: (encoded: string) => any;
    validate: (message: CommunicationMessage) => boolean;
}

export interface MessageHandler {
    messageType: string;
    handler: (message: CommunicationMessage, agent: Agent) => Promise<void>;
    priority: number;
}

export interface CommunicationNetwork {
    topology: 'fully_connected' | 'star' | 'ring' | 'mesh' | 'hierarchical';
    reliability: number;
    bandwidth: number;
    latency: number;
    dropRate: number;
    encryption: boolean;
    compression: boolean;
}

export interface ConversationContext {
    conversationId: string;
    participants: string[];
    topic: string;
    startTime: number;
    messageHistory: CommunicationMessage[];
    context: { [key: string]: any };
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'active' | 'paused' | 'completed' | 'failed';
}

export interface NegotiationSession {
    sessionId: string;
    participants: string[];
    topic: string;
    proposals: Proposal[];
    currentRound: number;
    maxRounds: number;
    agreement: Agreement | null;
    status: 'initializing' | 'active' | 'completed' | 'failed';
    mediator?: string;
}

export interface Proposal {
    id: string;
    proposer: string;
    content: any;
    timestamp: number;
    votes: { [agentId: string]: 'accept' | 'reject' | 'abstain' };
    confidence: number;
    priority: number;
}

export interface Agreement {
    id: string;
    participants: string[];
    terms: any;
    timestamp: number;
    signatures: { [agentId: string]: boolean };
    validity: number;
    enforcement: 'voluntary' | 'automatic' | 'mediated';
}

export interface KnowledgeBase {
    facts: { [key: string]: any };
    rules: Rule[];
    beliefs: { [key: string]: BeliefState };
    goals: Goal[];
    strategies: Strategy[];
    experiences: SharedExperience[];
}

export interface Rule {
    id: string;
    condition: string;
    action: string;
    confidence: number;
    priority: number;
    creator: string;
    timestamp: number;
}

export interface BeliefState {
    fact: string;
    confidence: number;
    evidence: Evidence[];
    timestamp: number;
    source: string;
}

export interface Evidence {
    type: 'observation' | 'communication' | 'inference';
    content: any;
    reliability: number;
    timestamp: number;
    source: string;
}

export interface Goal {
    id: string;
    description: string;
    priority: number;
    progress: number;
    deadline?: number;
    dependencies: string[];
    status: 'active' | 'completed' | 'failed' | 'abandoned';
}

export interface Strategy {
    id: string;
    name: string;
    description: string;
    conditions: string[];
    actions: string[];
    expectedOutcome: string;
    confidence: number;
    effectiveness: number;
}

export interface SharedExperience {
    id: string;
    situation: string;
    action: string;
    outcome: string;
    lessons: string[];
    applicability: string[];
    sharedBy: string;
    timestamp: number;
    votes: { [agentId: string]: number };
}

export interface CommunicationMetrics {
    messagesSent: number;
    messagesReceived: number;
    messagesDropped: number;
    averageLatency: number;
    bandwidthUsed: number;
    protocolEfficiency: number;
    conversationSuccess: number;
    negotiationSuccess: number;
    knowledgeSharing: number;
    consensusRate: number;
    miscommunications: number;
}

/**
 * Advanced Agent Communication System
 * 
 * Features:
 * - Multi-protocol communication support
 * - Structured conversations and negotiations
 * - Knowledge sharing and collective intelligence
 * - Consensus building and decision making
 * - Secure and reliable message passing
 * - Context-aware communication
 * - Learning from communication patterns
 */
export class AgentCommunicationSystem {
    private protocols: Map<string, CommunicationProtocol> = new Map();
    private messageHandlers: Map<string, MessageHandler[]> = new Map();
    private activeConversations: Map<string, ConversationContext> = new Map();
    private activeNegotiations: Map<string, NegotiationSession> = new Map();
    private knowledgeBase: KnowledgeBase;
    private network: CommunicationNetwork;
    private metrics: CommunicationMetrics;
    private messageQueue: CommunicationMessage[] = [];
    private processingInterval: NodeJS.Timeout | null = null;

    constructor(networkConfig: Partial<CommunicationNetwork> = {}) {
        this.network = {
            topology: 'fully_connected',
            reliability: 0.95,
            bandwidth: 1000,
            latency: 10,
            dropRate: 0.01,
            encryption: true,
            compression: false,
            ...networkConfig
        };

        this.knowledgeBase = this.initializeKnowledgeBase();
        this.metrics = this.initializeMetrics();
        this.initializeProtocols();
        this.startMessageProcessing();
    }

    /**
     * Register a communication protocol
     */
    registerProtocol(protocol: CommunicationProtocol): void {
        this.protocols.set(protocol.name, protocol);
        console.log(`📡 Registered protocol: ${protocol.name} v${protocol.version}`);
    }

    /**
     * Register a message handler
     */
    registerMessageHandler(handler: MessageHandler): void {
        if (!this.messageHandlers.has(handler.messageType)) {
            this.messageHandlers.set(handler.messageType, []);
        }
        this.messageHandlers.get(handler.messageType)!.push(handler);
        this.messageHandlers.get(handler.messageType)!.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Send a message between agents
     */
    async sendMessage(
        sender: Agent,
        receiver: Agent | 'broadcast',
        type: string,
        content: any,
        priority: CommunicationMessage['priority'] = 'medium'
    ): Promise<boolean> {
        const message: CommunicationMessage = {
            from: sender.id,
            to: receiver === 'broadcast' ? 'broadcast' : receiver.id,
            type: type as CommunicationMessage['type'],
            content,
            timestamp: Date.now(),
            priority
        };

        // Validate message
        if (!this.validateMessage(message)) {
            console.warn(`❌ Invalid message from ${sender.id}`);
            return false;
        }

        // Check bandwidth limits
        if (!this.checkBandwidthLimit(sender)) {
            console.warn(`⚠️ Bandwidth limit exceeded for ${sender.id}`);
            return false;
        }

        // Apply network effects
        if (Math.random() < this.network.dropRate) {
            this.metrics.messagesDropped++;
            return false;
        }

        // Add to queue
        this.messageQueue.push(message);
        this.metrics.messagesSent++;

        // Add to sender's history
        sender.communication.messageHistory.push(message);

        console.log(`📨 Message queued: ${sender.id} → ${message.to} [${type}]`);
        return true;
    }

    /**
     * Process incoming messages
     */
    private async processMessages(): Promise<void> {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()!;

            // Simulate network latency
            await this.simulateLatency();

            // Process message
            await this.processMessage(message);
        }
    }

    /**
     * Process a single message
     */
    private async processMessage(message: CommunicationMessage): Promise<void> {
        const handlers = this.messageHandlers.get(message.type) || [];

        if (handlers.length === 0) {
            console.warn(`⚠️ No handlers for message type: ${message.type}`);
            return;
        }

        // Find receiver agent (simplified - would need agent registry)
        const receiver = this.findAgent(message.to);
        if (!receiver && message.to !== 'broadcast') {
            console.warn(`⚠️ Receiver not found: ${message.to}`);
            return;
        }

        this.metrics.messagesReceived++;

        // Process with all handlers
        for (const handler of handlers) {
            try {
                if (receiver) {
                    await handler.handler(message, receiver);
                } else {
                    // Broadcast message
                    await this.processBroadcast(message, handler);
                }
            } catch (error) {
                console.error(`❌ Error processing message:`, error);
            }
        }
    }

    /**
     * Start a structured conversation
     */
    async startConversation(
        initiator: Agent,
        participants: Agent[],
        topic: string,
        context?: any
    ): Promise<string> {
        const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const conversation: ConversationContext = {
            conversationId,
            participants: [initiator.id, ...participants.map(p => p.id)],
            topic,
            startTime: Date.now(),
            messageHistory: [],
            context: context || {},
            priority: 'medium',
            status: 'active'
        };

        this.activeConversations.set(conversationId, conversation);

        // Send conversation invitation
        const invitationMessage = {
            conversationId,
            topic,
            initiator: initiator.id,
            context
        };

        for (const participant of participants) {
            await this.sendMessage(initiator, participant, 'conversation_invite', invitationMessage);
        }

        console.log(`💬 Started conversation: ${topic} with ${participants.length} participants`);
        return conversationId;
    }

    /**
     * Start a negotiation session
     */
    async startNegotiation(
        initiator: Agent,
        participants: Agent[],
        topic: string,
        maxRounds: number = 10,
        mediator?: Agent
    ): Promise<string> {
        const sessionId = `neg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const negotiation: NegotiationSession = {
            sessionId,
            participants: [initiator.id, ...participants.map(p => p.id)],
            topic,
            proposals: [],
            currentRound: 0,
            maxRounds,
            agreement: null,
            status: 'initializing',
            mediator: mediator?.id
        };

        this.activeNegotiations.set(sessionId, negotiation);

        // Send negotiation invitation
        const invitationMessage = {
            sessionId,
            topic,
            initiator: initiator.id,
            maxRounds,
            mediator: mediator?.id
        };

        for (const participant of participants) {
            await this.sendMessage(initiator, participant, 'negotiation_invite', invitationMessage);
        }

        console.log(`🤝 Started negotiation: ${topic} with ${participants.length} participants`);
        return sessionId;
    }

    /**
     * Make a proposal in a negotiation
     */
    async makeProposal(
        agent: Agent,
        sessionId: string,
        proposalContent: any,
        confidence: number = 0.5
    ): Promise<string> {
        const negotiation = this.activeNegotiations.get(sessionId);
        if (!negotiation) {
            throw new Error(`Negotiation ${sessionId} not found`);
        }

        const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const proposal: Proposal = {
            id: proposalId,
            proposer: agent.id,
            content: proposalContent,
            timestamp: Date.now(),
            votes: {},
            confidence,
            priority: 1
        };

        negotiation.proposals.push(proposal);

        // Broadcast proposal to all participants
        const proposalMessage = {
            sessionId,
            proposalId,
            proposer: agent.id,
            content: proposalContent,
            confidence
        };

        for (const participantId of negotiation.participants) {
            if (participantId !== agent.id) {
                const participant = this.findAgent(participantId);
                if (participant) {
                    await this.sendMessage(agent, participant, 'proposal', proposalMessage);
                }
            }
        }

        console.log(`📋 Proposal made in negotiation ${sessionId}: ${proposalId}`);
        return proposalId;
    }

    /**
     * Vote on a proposal
     */
    async voteOnProposal(
        agent: Agent,
        sessionId: string,
        proposalId: string,
        vote: 'accept' | 'reject' | 'abstain'
    ): Promise<void> {
        const negotiation = this.activeNegotiations.get(sessionId);
        if (!negotiation) {
            throw new Error(`Negotiation ${sessionId} not found`);
        }

        const proposal = negotiation.proposals.find(p => p.id === proposalId);
        if (!proposal) {
            throw new Error(`Proposal ${proposalId} not found`);
        }

        proposal.votes[agent.id] = vote;

        // Check if all participants have voted
        const allVoted = negotiation.participants.every(pid => proposal.votes[pid] !== undefined);

        if (allVoted) {
            await this.processProposalVotes(negotiation, proposal);
        }
    }

    /**
     * Share knowledge with other agents
     */
    async shareKnowledge(
        agent: Agent,
        recipients: Agent[],
        knowledge: any,
        knowledgeType: 'fact' | 'rule' | 'strategy' | 'experience'
    ): Promise<void> {
        const knowledgeMessage = {
            type: knowledgeType,
            content: knowledge,
            source: agent.id,
            timestamp: Date.now(),
            confidence: 0.8
        };

        for (const recipient of recipients) {
            await this.sendMessage(agent, recipient, 'knowledge_share', knowledgeMessage);
        }

        // Add to shared knowledge base
        this.updateKnowledgeBase(knowledgeType, knowledge, agent.id);
    }

    /**
     * Build consensus on a decision
     */
    async buildConsensus(
        initiator: Agent,
        participants: Agent[],
        decision: any,
        threshold: number = 0.7
    ): Promise<{ consensus: boolean; votes: any; confidence: number }> {
        const consensusId = `cons_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const consensusMessage = {
            consensusId,
            decision,
            initiator: initiator.id,
            threshold
        };

        // Send consensus request
        for (const participant of participants) {
            await this.sendMessage(initiator, participant, 'consensus_request', consensusMessage);
        }

        // Wait for responses (simplified - would need proper async handling)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Process consensus (placeholder)
        const votes = participants.map(p => ({
            agent: p.id,
            vote: Math.random() > 0.3 ? 'accept' : 'reject',
            confidence: Math.random()
        }));

        const acceptVotes = votes.filter(v => v.vote === 'accept').length;
        const consensus = acceptVotes / votes.length >= threshold;
        const confidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;

        return { consensus, votes, confidence };
    }

    /**
     * Coordinate joint action
     */
    async coordinateAction(
        coordinator: Agent,
        participants: Agent[],
        action: any,
        synchronization: 'immediate' | 'scheduled' | 'conditional' = 'immediate'
    ): Promise<{ success: boolean; responses: any[] }> {
        const coordinationId = `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const coordinationMessage = {
            coordinationId,
            action,
            coordinator: coordinator.id,
            synchronization,
            timestamp: Date.now()
        };

        const responses: any[] = [];

        // Send coordination request
        for (const participant of participants) {
            await this.sendMessage(coordinator, participant, 'coordination_request', coordinationMessage);

            // Simulate response (placeholder)
            responses.push({
                agent: participant.id,
                response: 'acknowledged',
                timestamp: Date.now()
            });
        }

        const success = responses.length === participants.length;
        return { success, responses };
    }

    // Helper methods
    private initializeProtocols(): void {
        // Register basic protocol
        const basicProtocol: CommunicationProtocol = {
            name: 'basic',
            version: '1.0',
            messageTypes: ['coordination', 'meta', 'info'],
            reliability: 0.9,
            bandwidth: 100,
            latency: 5,
            authenticate: () => true,
            encode: (message) => JSON.stringify(message),
            decode: (encoded) => JSON.parse(encoded),
            validate: (message) => !!(message.from && message.to && message.type)
        };

        this.registerProtocol(basicProtocol);

        // Register strategic protocol
        const strategicProtocol: CommunicationProtocol = {
            name: 'strategic',
            version: '1.0',
            messageTypes: ['strategy', 'threat', 'opportunity', 'coordination'],
            reliability: 0.95,
            bandwidth: 200,
            latency: 10,
            authenticate: () => true,
            encode: (message) => JSON.stringify(message),
            decode: (encoded) => JSON.parse(encoded),
            validate: (message) => !!(message.from && message.to && message.type)
        };

        this.registerProtocol(strategicProtocol);
    }

    private initializeKnowledgeBase(): KnowledgeBase {
        return {
            facts: {},
            rules: [],
            beliefs: {},
            goals: [],
            strategies: [],
            experiences: []
        };
    }

    private initializeMetrics(): CommunicationMetrics {
        return {
            messagesSent: 0,
            messagesReceived: 0,
            messagesDropped: 0,
            averageLatency: 0,
            bandwidthUsed: 0,
            protocolEfficiency: 0,
            conversationSuccess: 0,
            negotiationSuccess: 0,
            knowledgeSharing: 0,
            consensusRate: 0,
            miscommunications: 0
        };
    }

    private validateMessage(message: CommunicationMessage): boolean {
        return message.from && message.to && message.type && message.content !== undefined;
    }

    private checkBandwidthLimit(agent: Agent): boolean {
        return agent.communication.bandwidth > 0;
    }

    private async simulateLatency(): Promise<void> {
        const latency = this.network.latency + Math.random() * 5;
        await new Promise(resolve => setTimeout(resolve, latency));
    }

    private findAgent(agentId: string): Agent | null {
        // This would need to be connected to the agent registry
        // For now, return null as placeholder
        return null;
    }

    private async processBroadcast(message: CommunicationMessage, handler: MessageHandler): Promise<void> {
        // Process broadcast message for all agents
        console.log(`📢 Processing broadcast message: ${message.type}`);
    }

    private async processProposalVotes(negotiation: NegotiationSession, proposal: Proposal): Promise<void> {
        const acceptVotes = Object.values(proposal.votes).filter(v => v === 'accept').length;
        const totalVotes = Object.values(proposal.votes).length;
        const acceptanceRate = acceptVotes / totalVotes;

        if (acceptanceRate > 0.5) {
            // Proposal accepted - create agreement
            const agreement: Agreement = {
                id: `agreement_${Date.now()}`,
                participants: negotiation.participants,
                terms: proposal.content,
                timestamp: Date.now(),
                signatures: {},
                validity: 3600000, // 1 hour
                enforcement: 'voluntary'
            };

            negotiation.agreement = agreement;
            negotiation.status = 'completed';

            console.log(`✅ Agreement reached in negotiation ${negotiation.sessionId}`);
        } else {
            // Proposal rejected - continue negotiation
            negotiation.currentRound++;

            if (negotiation.currentRound >= negotiation.maxRounds) {
                negotiation.status = 'failed';
                console.log(`❌ Negotiation failed: ${negotiation.sessionId}`);
            }
        }
    }

    private updateKnowledgeBase(type: string, knowledge: any, source: string): void {
        switch (type) {
            case 'fact':
                this.knowledgeBase.facts[knowledge.id] = knowledge;
                break;
            case 'rule':
                this.knowledgeBase.rules.push({
                    ...knowledge,
                    creator: source,
                    timestamp: Date.now()
                });
                break;
            case 'strategy':
                this.knowledgeBase.strategies.push({
                    ...knowledge,
                    timestamp: Date.now()
                });
                break;
            case 'experience':
                this.knowledgeBase.experiences.push({
                    ...knowledge,
                    sharedBy: source,
                    timestamp: Date.now(),
                    votes: {}
                });
                break;
        }
    }

    private startMessageProcessing(): void {
        this.processingInterval = setInterval(() => {
            this.processMessages();
        }, 100); // Process messages every 100ms
    }

    /**
     * Stop message processing
     */
    stop(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    /**
     * Get communication metrics
     */
    getMetrics(): CommunicationMetrics {
        return this.metrics;
    }

    /**
     * Get knowledge base
     */
    getKnowledgeBase(): KnowledgeBase {
        return this.knowledgeBase;
    }

    /**
     * Get active conversations
     */
    getActiveConversations(): ConversationContext[] {
        return Array.from(this.activeConversations.values());
    }

    /**
     * Get active negotiations
     */
    getActiveNegotiations(): NegotiationSession[] {
        return Array.from(this.activeNegotiations.values());
    }

    /**
     * Export communication data
     */
    exportCommunicationData(): string {
        return JSON.stringify({
            metrics: this.metrics,
            knowledgeBase: this.knowledgeBase,
            activeConversations: Array.from(this.activeConversations.values()),
            activeNegotiations: Array.from(this.activeNegotiations.values())
        }, null, 2);
    }
}

export default AgentCommunicationSystem; 