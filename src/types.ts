/**
 * FILE HEADER: Data Structure Definitions (Types)
 * 
 * This file defines the "shapes" of information our application uses. 
 * Think of it like a blueprint or a set of rules for how data should be organized.
 * By defining these shapes, we make sure the computer always knows what to expect.
 */

/**
 * AgentId represents the unique "nickname" for each AI agent in our team.
 * Each nickname tells us which specific job that agent is responsible for.
 */
export type AgentId = 'pm' | 'researcher' | 'writer' | 'editor' | 'ethics' | 'designer';

/**
 * AgentSettings defines the "personality" and "brain" of an AI agent.
 * It includes their instructions (what they should do), their model (which AI brain they use),
 * and their temperature (how creative or focused they should be).
 */
export interface AgentSettings {
  /** The unique nickname for the agent (e.g., 'pm') */
  id: AgentId;
  /** The human-friendly name of the agent (e.g., 'Project Manager') */
  name: string;
  /** The detailed instructions that tell the agent how to behave */
  instructions: string;
  /** The specific version of the AI "brain" being used (e.g., 'gemini-3.1-pro-preview') */
  model: string;
  /** A number from 0 to 1 that controls how creative (1) or focused (0) the agent is */
  temperature: number;
  /** The source of truth or extra information the agent has access to */
  knowledgeBase?: string;
}

/**
 * Message represents a single piece of conversation in the chat.
 * It tracks who said it, what they said, and when they said it.
 */
export interface Message {
  /** A unique ID for this specific message so we can keep track of it */
  id: string;
  /** Who sent the message: the 'user' (you) or the 'assistant' (the AI) */
  role: 'user' | 'assistant' | 'system';
  /** The actual text content of the message */
  content: string;
  /** If an AI sent it, this tells us which specific agent (like the Project Manager) said it */
  agentId?: AgentId;
  /** The exact time the message was sent, measured in milliseconds */
  timestamp: number;
  /** Whether the message is still being written ('pending'), finished ('completed'), or failed ('error') */
  status?: 'pending' | 'completed' | 'error';
}

/**
 * ProjectState tracks the overall progress of your letter-writing project.
 * It's like a digital folder that stores the brief, research, drafts, and feedback.
 */
export interface ProjectState {
  /** The summary of what the letter needs to be about */
  brief: string;
  /** The information found by the Researcher agent */
  researchInsights?: string;
  /** The first version of the letter written by the Writer agent */
  draft?: string;
  /** The suggestions and corrections provided by the Editor agent */
  editorFeedback?: string;
  /** The safety and fairness report from the Ethics Reviewer agent */
  ethicsReport?: {
    /** Whether the letter passed the ethics check (true) or failed (false) */
    pass: boolean;
    /** The detailed explanation of the ethics review */
    report: string;
  };
  /** The final, approved text of the letter */
  finalLetter?: string;
  /** The letter after the Graphic Designer has formatted it to look professional */
  formattedLetter?: string;
  /** Multiple design options provided by the Graphic Designer */
  designOptions?: {
    id: string;
    name: string;
    description: string;
    content: string;
  }[];
  /** The index of the design option selected by the user */
  selectedDesignIndex?: number;
  /** How many times the Writer has tried to fix the letter based on feedback */
  revisionCount: number;
  /** The current stage of the project (e.g., 'writing', 'editing', or 'completed') */
  currentStep: 'idle' | 'briefing' | 'researching' | 'writing' | 'editing' | 'reviewing' | 'designing' | 'completed';
}

/**
 * TestResult represents the outcome of a single test case execution.
 */
export interface TestResult {
  /** Whether the test passed, failed, is still running, or hit an error */
  status: 'passed' | 'failed' | 'pending' | 'error';
  /** The raw text output from the agent during the test */
  actualOutput: string;
  /** When the test was executed */
  timestamp: number;
  /** How long the test took to complete (in milliseconds) */
  duration?: number;
  /** Any error message if the status is 'error' */
  error?: string;
}

/**
 * TestCase defines a specific scenario to test an agent's behavior.
 */
export interface TestCase {
  /** A unique ID for the test case */
  id: string;
  /** A short, descriptive name for the test */
  name: string;
  /** Which agent this test is targeting */
  agentId: AgentId;
  /** The input prompt to send to the agent */
  input: string;
  /** Optional: What we expect the agent to say (for automated validation) */
  expectedOutput?: string;
  /** The result of the most recent time this test was run */
  lastResult?: TestResult;
}
