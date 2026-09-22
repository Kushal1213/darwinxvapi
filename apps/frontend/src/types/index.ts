export type NavigationTab = 
  | 'dashboard'
  | 'voice-studio'
  | 'knowledge-hub'
  | 'languages'
  | 'insights'
  | 'analytics'
  | 'evaluation'
  | 'settings';

export interface RAGSource {
  source: string;
  title: string;
  page?: number;
  score: number;
  category?: string;
}

export interface RAGChunk {
  record_id: string;
  chunk_id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  page?: number;
  pii: boolean;
  market: string;
  char_count: number;
}

export interface TurnMessage {
  id: string;
  sender: 'user' | 'agent';
  agentName?: string;
  text: string;
  timestamp: string;
  ragData?: {
    sources: RAGSource[];
    chunks: RAGChunk[];
    latency: number;
    model: string;
    matchScore: string;
  };
}

export interface CallSignalState {
  intent: string;
  topic: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  buyingSignal: boolean;
  buyingReason?: string;
  frustrationLevel: number;
  complianceRisk: boolean;
  complianceReason?: string;
  confidence: number;
}
