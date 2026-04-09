/**
 * FILE HEADER: ScribeFlow Main Application Component
 * 
 * This file is the "heart" of the ScribeFlow application. It manages the user interface (UI),
 * handles user messages, and coordinates the "team" of AI agents (Project Manager, Writer, etc.)
 * to work together on writing a letter.
 * 
 * For non-coders: Think of this file as the conductor of an orchestra. It tells the different
 * instruments (AI agents) when to play and makes sure the audience (the user) can see and
 * interact with the performance.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Settings, 
  User, 
  Bot, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Edit3,
  Search, 
  PenTool, 
  ShieldCheck, 
  Layout, 
  X,
  RefreshCcw,
  ChevronRight,
  MessageSquare,
  History,
  FlaskConical,
  Play,
  Plus,
  Trash2,
  Network,
  Activity,
  Users,
  ScanEye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { AgentSettings, Message, ProjectState, AgentId, TestCase, TestResult } from './types';
import { DEFAULT_AGENTS, DEFAULT_TEST_CASES } from './constants';
import { 
  callAgent, 
  generateProjectBrief, 
  performResearch, 
  writeLetter, 
  editLetter, 
  reviewEthics, 
  designLetter 
} from './services/geminiService';
import SystemDiagram from './components/SystemDiagram';

/**
 * A helper function to combine CSS class names safely.
 * 
 * @param inputs - A list of class names or conditional class objects.
 * @returns A single string of combined class names.
 */
function cn(...inputs: ClassValue[]) {
  // This function helps us manage the "look" of elements by combining different
  // styling instructions into one, making sure they don't clash.
  return twMerge(clsx(inputs));
}

/**
 * The main component that renders the entire ScribeFlow application.
 * 
 * This component holds all the "state" (the data that changes over time, like messages
 * and project progress) and defines how the user interacts with the AI team.
 */
export default function App() {
  // --- STATE MANAGEMENT (The App's Memory) ---

  // 'messages' stores the history of the conversation between the user and the AI.
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      agentId: 'pm',
      content: "Hello! I'm your Project Manager. I'll help you coordinate our team to write the perfect letter. What can we write for you today?",
      timestamp: Date.now()
    }
  ]);

  // 'input' stores what the user is currently typing in the chat box.
  const [input, setInput] = useState('');

  // 'agents' stores the settings (like instructions and AI models) for each team member.
  // It tries to load saved settings from the browser's memory first.
  const [agents, setAgents] = useState<AgentSettings[]>(() => {
    const saved = localStorage.getItem('scribe_agents');
    return saved ? JSON.parse(saved) : DEFAULT_AGENTS;
  });

  // 'project' tracks the overall progress of the letter-writing task.
  const [project, setProject] = useState<ProjectState>({
    brief: '',
    revisionCount: 0,
    currentStep: 'idle'
  });

  // These states control whether certain UI elements (like modals or loading spinners) are visible.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAgentInspectorOpen, setIsAgentInspectorOpen] = useState(false);
  const [isAgentResetConfirmOpen, setIsAgentResetConfirmOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'agents' | 'diagram'>('agents');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [editableBrief, setEditableBrief] = useState('');
  const [activeTab, setActiveTab] = useState<AgentId>('pm');

  // 'testCases' stores the list of scenarios for testing agents.
  const [testCases, setTestCases] = useState<TestCase[]>(() => {
    const saved = localStorage.getItem('scribe_test_cases');
    return saved ? JSON.parse(saved) : DEFAULT_TEST_CASES;
  });

  // 'agentLogs' stores the most recent input and output for each agent.
  const [agentLogs, setAgentLogs] = useState<Record<AgentId, { input: string, output: string }>>({
    pm: { input: 'Initial greeting', output: 'Hello! I\'m your Project Manager...' },
    researcher: { input: 'N/A', output: 'N/A' },
    writer: { input: 'N/A', output: 'N/A' },
    editor: { input: 'N/A', output: 'N/A' },
    ethics: { input: 'N/A', output: 'N/A' },
    designer: { input: 'N/A', output: 'N/A' }
  });

  // 'messagesEndRef' helps us automatically scroll the chat to the bottom when new messages arrive.
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- EFFECTS (Automatic Actions) ---

  // Save agent settings to the browser's memory whenever they change.
  const agentsString = JSON.stringify(agents);
  useEffect(() => {
    localStorage.setItem('scribe_agents', agentsString);
  }, [agentsString]);

  // Save test cases to the browser's memory whenever they change.
  const testCasesString = JSON.stringify(testCases);
  useEffect(() => {
    localStorage.setItem('scribe_test_cases', testCasesString);
  }, [testCasesString]);

  // Scroll to the bottom of the chat whenever the list of messages changes.
  const messagesLength = messages.length;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesLength]);

  // Update editable brief when project brief changes
  useEffect(() => {
    if (project.brief) {
      // Clean up the brief for human legibility (remove asterisks and ensure spacing)
      const cleaned = project.brief.replace(/\*\*/g, '').split('\n').filter(l => l.trim()).join('\n\n');
      setEditableBrief(cleaned);
    }
  }, [project.brief]);

  // --- HELPER FUNCTIONS (The App's Tools) ---

  /**
   * Adds a new message to the chat history.
   * 
   * @param message - The message details (who sent it and what it says).
   * @returns The newly created message object with a unique ID and timestamp.
   */
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Math.random().toString(36).substring(7), // Generate a random unique ID
      timestamp: Date.now() // Record the current time
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  /**
   * Updates the current state of the project.
   * 
   * @param updates - An object containing the changes to apply to the project state.
   */
  const updateProject = (updates: Partial<ProjectState>) => {
    setProject(prev => ({ ...prev, ...updates }));
  };

  /**
   * Updates the logs for a specific agent.
   * 
   * @param id - The ID of the agent.
   * @param input - The input sent to the agent.
   * @param output - The output received from the agent.
   */
  const updateAgentLog = (id: AgentId, input: string, output: string) => {
    setAgentLogs(prev => ({
      ...prev,
      [id]: { input, output }
    }));
  };

  /**
   * Handles the action of sending a message (either by the user typing or clicking a button).
   * 
   * @param e - The form event (if triggered by a form submission).
   * @param overrideInput - An optional message to send instead of the current text box content.
   */
  const handleSend = async (e?: React.FormEvent, overrideInput?: string) => {
    e?.preventDefault(); // Prevent the page from refreshing
    const userMessage = overrideInput || input.trim();
    
    // Don't do anything if the message is empty or we're already busy.
    if (!userMessage || isProcessing) return;

    // Clear the text box and show the user's message in the chat.
    if (!overrideInput) setInput('');
    addMessage({ role: 'user', content: userMessage });
    setIsProcessing(true); // Show the "thinking" animation

    try {
      // Find the Project Manager's settings.
      const pm = agents.find(a => a.id === 'pm')!;
      
      // Check if we are still in the "getting to know you" phase (briefing).
      if (project.currentStep === 'idle' || project.currentStep === 'briefing') {
        updateProject({ currentStep: 'briefing' });
        
        // Ask the AI Project Manager to analyze the conversation so far.
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        const pmInput = `Conversation History: ${JSON.stringify(history)}\n\nNew Message: ${userMessage}`;
        const { brief, questions } = await generateProjectBrief(pm, [...history, { role: 'user', content: userMessage }]);
        updateAgentLog('pm', pmInput, brief ? `Brief: ${brief}` : `Questions: ${questions}`);
        
        if (brief) {
          // If the PM has enough info to create a "brief" (a plan), start the work!
          updateProject({ brief, currentStep: 'researching' });
          addMessage({ 
            role: 'assistant', 
            agentId: 'pm', 
            content: "I've gathered all the necessary information for your project brief. I'll now coordinate with the research team to gather insights." 
          });
          
          // Start the automated "factory line" of AI agents.
          await runWorkflow(brief);
        } else {
          // If the PM still needs more info, show the questions to the user.
          addMessage({ role: 'assistant', agentId: 'pm', content: questions || "Could you tell me more about the letter you want to write?" });
        }
      } else {
        // If the workflow is already running, just have the PM respond normally.
        const pmInput = `User Message: ${userMessage}\n\nContext: ${messages.length} messages in history`;
        const response = await callAgent(pm, userMessage, messages.map(m => ({ role: m.role, content: m.content })));
        updateAgentLog('pm', pmInput, response);
        addMessage({ role: 'assistant', agentId: 'pm', content: response });
      }
    } catch (error) {
      // If something goes wrong, let the user know.
      addMessage({ role: 'assistant', agentId: 'pm', content: "I'm sorry, I encountered an error processing your request. Please try again." });
    } finally {
      setIsProcessing(false); // Hide the "thinking" animation
    }
  };

  /**
   * Orchestrates the multi-agent workflow: Research -> Writing -> Editing -> Designing.
   * 
   * @param brief - The detailed plan for the letter.
   */
  const runWorkflow = async (brief: string) => {
    try {
      // STEP 1: RESEARCH
      updateProject({ currentStep: 'researching' });
      const researcher = agents.find(a => a.id === 'researcher')!;
      const insights = await performResearch(researcher, brief);
      updateAgentLog('researcher', `Project Brief: ${brief}`, insights);
      updateProject({ researchInsights: insights });

      // STEP 2: WRITING (and the subsequent editing cycle)
      await runWritingCycle(brief, insights);

    } catch (error) {
      console.error("Workflow error:", error);
      addMessage({ role: 'assistant', agentId: 'pm', content: "The team hit a snag. I'll need to pause and check in." });
    }
  };

  /**
   * Manages the cycle of writing a draft and getting it reviewed by the Editor and Ethics Reviewer.
   * 
   * @param brief - The project plan.
   * @param insights - The research findings.
   * @param feedback - Any feedback from previous revision cycles.
   */
  const runWritingCycle = async (brief: string, insights: string, feedback?: string) => {
    // STEP 2: WRITING
    updateProject({ currentStep: 'writing' });
    const writer = agents.find(a => a.id === 'writer')!;
    const draft = await writeLetter(writer, brief, insights, feedback);
    updateAgentLog('writer', `Brief: ${brief}\nInsights: ${insights}\nFeedback: ${feedback || 'None'}`, draft);
    updateProject({ draft });

    // STEP 3: EDITING & ETHICS REVIEW
    updateProject({ currentStep: 'editing' });
    const editor = agents.find(a => a.id === 'editor')!;
    const ethics = agents.find(a => a.id === 'ethics')!;

    // Run the Editor and Ethics Reviewer at the same time to save time.
    const [editResult, ethicsResult] = await Promise.all([
      editLetter(editor, brief, draft),
      reviewEthics(ethics, brief, draft)
    ]);

    updateAgentLog('editor', `Brief: ${brief}\nDraft: ${draft}`, `Feedback: ${editResult.feedback}\nReady: ${editResult.ready}`);
    updateAgentLog('ethics', `Brief: ${brief}\nDraft: ${draft}`, `Pass: ${ethicsResult.pass}\nReport: ${ethicsResult.report}`);

    updateProject({ editorFeedback: editResult.feedback, ethicsReport: ethicsResult });

    // Check if both the Editor and Ethics Reviewer are happy.
    if (editResult.ready && ethicsResult.pass) {
      // STEP 4: DESIGNING (Formatting)
      updateProject({ currentStep: 'designing' });
      const designer = agents.find(a => a.id === 'designer')!;
      const options = await designLetter(designer, draft);
      updateAgentLog('designer', `Draft: ${draft}`, JSON.stringify(options));
      updateProject({ designOptions: options });
      
      // Final message from the Project Manager.
      addMessage({ 
        role: 'assistant', 
        agentId: 'pm', 
        content: `Your letter is ready! I've had it reviewed for quality and ethics, and our designer has prepared two distinct visual options for you. Which one would you like to use?` 
      });
    } else {
      // If they aren't happy, we need a revision.
      // But we limit how many times we try automatically to avoid infinite loops.
      if (project.revisionCount >= 2) {
        updateProject({ currentStep: 'idle' }); // Stop and ask the user for help
        addMessage({ 
          role: 'assistant', 
          agentId: 'pm', 
          content: "We've gone through a few revision cycles and haven't quite nailed it yet. Here's where we are:\n\n" + 
          (editResult.feedback ? `Editor Notes: ${editResult.feedback}\n` : "") +
          (!ethicsResult.pass ? `Ethics Concerns: ${ethicsResult.report}\n` : "") +
          "\nHow would you like to proceed?"
        });
      } else {
        // Try again with the feedback provided.
        updateProject({ revisionCount: project.revisionCount + 1 });
        const combinedFeedback = `${editResult.feedback || ""} ${!ethicsResult.pass ? ethicsResult.report : ""}`.trim();
        await runWritingCycle(brief, insights, combinedFeedback);
      }
    }
  };

  /**
   * Resets the entire application to its starting state.
   */
  const resetProject = () => {
    setProject({ brief: '', revisionCount: 0, currentStep: 'idle', designOptions: undefined, selectedDesignIndex: undefined });
    setIsEditingBrief(false);
    setEditableBrief('');
    setAgentLogs({
      pm: { input: 'Initial greeting', output: 'Hello! I\'m your Project Manager...' },
      researcher: { input: 'N/A', output: 'N/A' },
      writer: { input: 'N/A', output: 'N/A' },
      editor: { input: 'N/A', output: 'N/A' },
      ethics: { input: 'N/A', output: 'N/A' },
      designer: { input: 'N/A', output: 'N/A' }
    });
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        agentId: 'pm',
        content: "Hello! I'm your Project Manager. I'll help you coordinate our team to write the perfect letter. What can we write for you today?",
        timestamp: Date.now()
      }
    ]);
  };

  /**
   * Finalizes the project with a selected design option.
   * 
   * @param index - The index of the selected design.
   */
  const selectDesign = (index: number) => {
    if (!project.designOptions) return;
    const selected = project.designOptions[index];
    updateProject({ 
      formattedLetter: selected.content, 
      selectedDesignIndex: index,
      currentStep: 'completed' 
    });
    addMessage({ 
      role: 'assistant', 
      agentId: 'pm', 
      content: `Excellent choice! I've finalized your letter with the "${selected.name}" design.\n\n${selected.content}` 
    });
  };

  /**
   * Saves the edited project brief.
   */
  const saveBrief = () => {
    updateProject({ brief: editableBrief });
    setIsEditingBrief(false);
    addMessage({ 
      role: 'system', 
      content: "The project brief has been manually updated. The team will use this new information for subsequent steps." 
    });
  };

  /**
   * Executes a specific test case against its target agent.
   * 
   * @param testCaseId - The ID of the test case to run.
   */
  const runTestCase = async (testCaseId: string) => {
    const testCase = testCases.find(tc => tc.id === testCaseId);
    if (!testCase) return;

    // Set status to pending
    setTestCases(prev => prev.map(tc => tc.id === testCaseId ? {
      ...tc,
      lastResult: { status: 'pending', actualOutput: 'Running...', timestamp: Date.now() }
    } : tc));

    const startTime = Date.now();
    try {
      const agent = agents.find(a => a.id === testCase.agentId)!;
      const response = await callAgent(agent, testCase.input, []);
      const duration = Date.now() - startTime;

      setTestCases(prev => prev.map(tc => tc.id === testCaseId ? {
        ...tc,
        lastResult: { 
          status: 'passed', // We mark as passed if we get a response, user can manually verify
          actualOutput: response, 
          timestamp: Date.now(),
          duration
        }
      } : tc));
    } catch (error) {
      setTestCases(prev => prev.map(tc => tc.id === testCaseId ? {
        ...tc,
        lastResult: { 
          status: 'error', 
          actualOutput: 'Error occurred during execution.', 
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error)
        }
      } : tc));
    }
  };

  /**
   * Runs a quick, ad-hoc test case without saving it to the permanent list.
   * 
   * @param agentId - The ID of the agent to test.
   * @param input - The text to send to the agent.
   * @returns The result of the test run.
   */
  const runQuickTest = async (agentId: AgentId, input: string): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const agent = agents.find(a => a.id === agentId)!;
      const response = await callAgent(agent, input, []);
      const duration = Date.now() - startTime;
      return {
        status: 'passed',
        actualOutput: response,
        timestamp: Date.now(),
        duration
      };
    } catch (error) {
      return {
        status: 'error',
        actualOutput: 'Error occurred during execution.',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // --- UI RENDERING (What the user sees) ---

  return (
    <div className="flex flex-col h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans">
      {/* Header: The top bar with the app name and settings button */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-[#E5E5E5] bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">ScribeFlow</h1>
            <p className="text-xs text-[#666] uppercase tracking-widest font-medium">Multi-Agent Letter Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Settings Button */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-[#F5F5F5] rounded-xl transition-all text-[#666] hover:text-[#1A1A1A]"
            title="Agent Settings"
          >
            <Users className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Team</span>
          </button>

          {/* Agent Inspector Button */}
          <button 
            onClick={() => setIsAgentInspectorOpen(true)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 rounded-xl transition-all text-blue-500"
            title="Agent Inspector"
          >
            <ScanEye className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Inspector</span>
          </button>

          <div className="w-px h-6 bg-[#E5E5E5] mx-2" />

          {/* Reset Button */}
          <button 
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded-xl transition-all text-red-500"
            title="Reset Project"
          >
            <RefreshCcw className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Reset</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar: Shows the current brief */}
        <aside className="hidden lg:flex w-80 border-r border-[#E5E5E5] flex-col bg-white">
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Active Brief</h2>
              {project.brief && !isEditingBrief && (
                <button 
                  onClick={() => setIsEditingBrief(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-600 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
              )}
            </div>

            {project.brief ? (
              isEditingBrief ? (
                <div className="space-y-4">
                  <textarea
                    value={editableBrief}
                    onChange={(e) => setEditableBrief(e.target.value)}
                    className="w-full h-[400px] p-4 bg-[#F9F9F9] border border-[#E5E5E5] rounded-2xl text-xs leading-relaxed focus:ring-2 focus:ring-[#1A1A1A] outline-none resize-none font-mono"
                    placeholder="Refine the project brief..."
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={saveBrief}
                      className="flex-1 py-2 bg-[#1A1A1A] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-all"
                    >
                      Save Changes
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingBrief(false);
                        setEditableBrief(project.brief);
                      }}
                      className="px-4 py-2 bg-[#F5F5F5] text-[#666] rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#EEE] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#444] leading-relaxed whitespace-pre-wrap">
                  {project.brief.replace(/\*\*/g, '').split('\n').filter(l => l.trim()).join('\n\n')}
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <FileText className="w-12 h-12 text-[#EEE] mb-4" />
                <p className="text-sm text-[#CCC] italic">No brief established yet. Start a conversation with the Project Manager to build one.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Chat Area: Where the messages are displayed */}
        <section className="flex-1 flex flex-col relative bg-[#FDFCFB]">
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-4xl",
                    message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  {/* Avatar (User or Bot icon) */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    message.role === 'user' ? "bg-[#1A1A1A] text-white" : "bg-[#F5F5F5] border border-[#E5E5E5]"
                  )}>
                    {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>
                  {/* Message Content */}
                  <div className={cn(
                    "space-y-2",
                    message.role === 'user' ? "text-right" : ""
                  )}>
                    {message.agentId && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#999]">
                        {agents.find(a => a.id === message.agentId)?.name}
                      </span>
                    )}
                    <div className={cn(
                      "p-5 rounded-2xl text-sm leading-relaxed shadow-sm",
                      message.role === 'user' 
                        ? "bg-[#1A1A1A] text-white rounded-tr-none" 
                        : "bg-white border border-[#E5E5E5] rounded-tl-none text-[#333]"
                    )}>
                      <div className={cn(
                        "markdown-body prose prose-sm max-w-none",
                        message.role === 'user' ? "prose-invert" : ""
                      )}>
                        {/* Special handling for the Project Manager's fillable forms */}
                        {message.agentId === 'pm' && message.content.includes('**') && project.currentStep !== 'completed' ? (
                          <InteractiveForm 
                            content={message.content} 
                            onSubmit={(data) => handleSend(undefined, data)}
                            isProcessing={isProcessing}
                          />
                        ) : (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {/* Loading Spinner for when the AI is "typing" */}
            {isProcessing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-4 max-w-3xl"
              >
                <div className="w-10 h-10 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#999]" />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#999]">
                    {project.currentStep === 'briefing' ? 'Project Manager' : 
                     project.currentStep === 'researching' ? 'Researcher' :
                     project.currentStep === 'writing' ? 'Writer' :
                     project.currentStep === 'editing' ? 'Editor' :
                     project.currentStep === 'designing' ? 'Designer' : 'Processing'}
                  </span>
                  <div className="p-5 bg-white border border-[#E5E5E5] rounded-2xl rounded-tl-none shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-[#CCC] rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-[#CCC] rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-[#CCC] rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {/* Design Selection UI: Shown when the designer has provided options */}
            {project.currentStep === 'designing' && project.designOptions && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-6xl mx-auto mt-8 p-8 bg-white border border-[#E5E5E5] rounded-3xl shadow-xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                    <Layout className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Select a Design</h3>
                    <p className="text-xs text-[#999] uppercase tracking-widest font-bold">Choose the look that best fits your message</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {project.designOptions.map((option, idx) => (
                    <div 
                      key={option.id}
                      className="flex flex-col border border-[#E5E5E5] rounded-2xl overflow-hidden hover:border-[#1A1A1A] transition-all group"
                    >
                      <div className="p-6 bg-[#F9F9F9] border-b border-[#E5E5E5]">
                        <h4 className="font-bold text-[#1A1A1A] mb-1">{option.name}</h4>
                        <p className="text-xs text-[#666] leading-relaxed">{option.description}</p>
                      </div>
                      <div className="flex-1 p-6 max-h-96 overflow-y-auto bg-white text-[10px] text-[#999] font-mono leading-tight">
                        <ReactMarkdown>{option.content}</ReactMarkdown>
                      </div>
                      <button
                        onClick={() => selectDesign(idx)}
                        className="w-full py-4 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-all"
                      >
                        Select This Design
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area: The text box at the bottom */}
          <div className="p-8 bg-white border-t border-[#E5E5E5]">
            <form onSubmit={handleSend} className="max-w-[500px] mx-auto relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={project.currentStep === 'idle' ? "Describe the letter you need..." : "Reply to Project Manager..."}
                disabled={isProcessing}
                className="w-full pl-6 pr-16 py-4 bg-[#F9F9F9] border border-[#E5E5E5] rounded-full focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent transition-all text-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="absolute right-2 top-2 bottom-2 px-4 bg-[#1A1A1A] text-white rounded-full hover:bg-[#333] disabled:bg-[#CCC] transition-all flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-center mt-4 text-[#999] uppercase tracking-widest font-medium">
              ScribeFlow uses multiple AI agents to craft your message.
            </p>
          </div>
        </section>
      </main>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Reset Workspace?</h2>
              <p className="text-[#666] mb-8 leading-relaxed">
                This will clear all messages, project progress, and agent logs. This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-[#666] bg-[#F5F5F5] hover:bg-[#EEE] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    resetProject();
                    setIsResetConfirmOpen(false);
                  }}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 transition-all"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal: The popup window for customizing AI agents */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-8 py-6 border-b border-[#F0F0F0]">
                <div>
                  <h2 className="text-xl font-bold">Agent Configuration</h2>
                  <p className="text-xs text-[#999] uppercase tracking-widest font-bold mt-1">Customize the team's behavior</p>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-[#F5F5F5] rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Sidebar for selecting which agent to configure */}
                <div className="w-64 border-r border-[#F0F0F0] bg-[#F9F9F9] p-4 space-y-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setActiveTab(agent.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        activeTab === agent.id 
                          ? "bg-white shadow-sm text-[#1A1A1A] border border-[#E5E5E5]" 
                          : "text-[#999] hover:text-[#666] hover:bg-white/50"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        activeTab === agent.id ? "bg-[#1A1A1A]" : "bg-[#DDD]"
                      )} />
                      {agent.name}
                    </button>
                  ))}
                </div>

                {/* The actual settings form for the selected agent */}
                <div className="flex-1 p-8 overflow-y-auto">
                  {agents.map((agent) => agent.id === activeTab && (
                    <div key={agent.id} className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Model Selection */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Model</label>
                          <select 
                            value={agent.model}
                            onChange={(e) => {
                              const newAgents = agents.map(a => a.id === agent.id ? { ...a, model: e.target.value } : a);
                              setAgents(newAgents);
                            }}
                            className="w-full p-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
                          >
                            <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                            <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
                          </select>
                        </div>
                        {/* Temperature (Creativity) Slider */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Temperature ({agent.temperature})</label>
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.1"
                            value={agent.temperature}
                            onChange={(e) => {
                              const newAgents = agents.map(a => a.id === agent.id ? { ...a, temperature: parseFloat(e.target.value) } : a);
                              setAgents(newAgents);
                            }}
                            className="w-full h-2 bg-[#F0F0F0] rounded-lg appearance-none cursor-pointer accent-[#1A1A1A]"
                          />
                        </div>
                      </div>

                      {/* System Instructions Editor */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">System Instructions</label>
                        <textarea 
                          value={agent.instructions}
                          onChange={(e) => {
                            const newAgents = agents.map(a => a.id === agent.id ? { ...a, instructions: e.target.value } : a);
                            setAgents(newAgents);
                          }}
                          rows={12}
                          className="w-full p-4 bg-[#F9F9F9] border border-[#E5E5E5] rounded-2xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom bar of the settings modal */}
              <div className="p-6 border-t border-[#F0F0F0] bg-[#F9F9F9] flex justify-between items-center">
                <button 
                  onClick={() => setIsAgentResetConfirmOpen(true)}
                  className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                >
                  Reset to Defaults
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-8 py-3 bg-[#1A1A1A] text-white rounded-full font-medium hover:bg-[#333] transition-all shadow-lg"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Agent Inspector Modal: Shows detailed logs and configuration for each agent */}
      <AnimatePresence>
        {isAgentInspectorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-8 py-6 border-b border-[#F0F0F0]">
                <div className="flex items-center gap-8">
                  <div>
                    <h2 className="text-xl font-bold">Agent Inspector</h2>
                    <p className="text-xs text-[#999] uppercase tracking-widest font-bold mt-1">Real-time agent monitoring</p>
                  </div>
                  
                  {/* Tab Switcher */}
                  <div className="flex bg-[#F5F5F5] p-1 rounded-xl">
                    <button
                      onClick={() => setInspectorTab('agents')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                        inspectorTab === 'agents' ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#999] hover:text-[#666]"
                      )}
                    >
                      <Activity className="w-3 h-3" />
                      Agents
                    </button>
                    <button
                      onClick={() => setInspectorTab('diagram')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                        inspectorTab === 'diagram' ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#999] hover:text-[#666]"
                      )}
                    >
                      <Network className="w-3 h-3" />
                      System Diagram
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAgentInspectorOpen(false)}
                  className="p-2 hover:bg-[#F5F5F5] rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {inspectorTab === 'agents' ? (
                  <>
                    {/* Sidebar for selecting which agent to inspect */}
                    <div className="w-64 border-r border-[#F0F0F0] bg-[#F9F9F9] p-4 space-y-2">
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => setActiveTab(agent.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                            activeTab === agent.id 
                              ? "bg-white shadow-sm text-[#1A1A1A] border border-[#E5E5E5]" 
                              : "text-[#999] hover:text-[#666] hover:bg-white/50"
                          )}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            activeTab === agent.id ? "bg-blue-500" : "bg-[#DDD]"
                          )} />
                          {agent.name}
                        </button>
                      ))}
                    </div>

                    {/* The inspector details for the selected agent */}
                    <div className="flex-1 p-8 overflow-y-auto bg-white">
                      {agents.map((agent) => agent.id === activeTab && (
                        <div key={agent.id} className="space-y-8">
                          {/* Basic Info Grid */}
                          <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Model</label>
                              <p className="text-sm font-mono bg-[#F5F5F5] p-2 rounded-lg border border-[#E5E5E5]">{agent.model}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Temperature</label>
                              <p className="text-sm font-mono bg-[#F5F5F5] p-2 rounded-lg border border-[#E5E5E5]">{agent.temperature}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Knowledge Base</label>
                              <p className="text-sm font-medium bg-blue-50 text-blue-700 p-2 rounded-lg border border-blue-100">{agent.knowledgeBase || 'None'}</p>
                            </div>
                          </div>

                          {/* System Instructions */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">System Instructions</label>
                            <div className="p-4 bg-[#F9F9F9] border border-[#E5E5E5] rounded-2xl text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {agent.instructions}
                            </div>
                          </div>

                          {/* Input/Output Logs */}
                          <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Last Agent Input</label>
                              <div className="p-4 bg-[#FDFCFB] border border-[#E5E5E5] rounded-2xl text-xs leading-relaxed font-mono whitespace-pre-wrap min-h-[200px] max-h-[400px] overflow-y-auto shadow-inner">
                                {agentLogs[agent.id].input}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Last Agent Output</label>
                              <div className="p-4 bg-[#FDFCFB] border border-[#E5E5E5] rounded-2xl text-xs leading-relaxed font-mono whitespace-pre-wrap min-h-[200px] max-h-[400px] overflow-y-auto shadow-inner">
                                {agentLogs[agent.id].output}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 p-8 bg-[#F9F9F9]">
                    <SystemDiagram />
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-[#F0F0F0] bg-[#F9F9F9] flex justify-end">
                <button 
                  onClick={() => setIsAgentInspectorOpen(false)}
                  className="px-8 py-3 bg-[#1A1A1A] text-white rounded-full font-medium hover:bg-[#333] transition-all shadow-lg"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Agent Reset Confirmation Modal */}
      <AnimatePresence>
        {isAgentResetConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCcw className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Reset Agents?</h2>
              <p className="text-[#666] mb-8 leading-relaxed">
                This will reset all agents to their default instructions and models. Your current customizations will be lost.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsAgentResetConfirmOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-[#666] bg-[#F5F5F5] hover:bg-[#EEE] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setAgents(DEFAULT_AGENTS);
                    setIsAgentResetConfirmOpen(false);
                  }}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 transition-all"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

/**
 * A component that turns a text-based list of questions into a fillable form.
 * 
 * @param content - The text content containing the questions (formatted with **Bold Labels**).
 * @param onSubmit - The function to call when the user submits the form.
 * @param isProcessing - Whether the AI is currently busy.
 */
function InteractiveForm({ content, onSubmit, isProcessing }: { content: string, onSubmit: (data: string) => void, isProcessing: boolean }) {
  // 'values' stores the text typed into each form field.
  const [values, setValues] = useState<Record<string, string>>({});
  // 'submitted' tracks if the user has already clicked the submit button.
  const [submitted, setSubmitted] = useState(false);
  
  // Parse the text content to find lines that look like questions/fields.
  const fields = content.split('\n').filter(line => line.trim()).map(line => {
    // We look for text inside double asterisks like **Name**
    const match = line.match(/\*\*(.*?)\*\*(.*)/);
    return match ? { label: match[1], initialValue: match[2].replace(/^[:\s]+/, '').trim() } : null;
  }).filter(Boolean) as { label: string, initialValue: string }[];

  // If we didn't find any fields, just show the text normally.
  if (fields.length === 0) return <ReactMarkdown>{content}</ReactMarkdown>;

  /**
   * Handles the form submission.
   * 
   * @param e - The form event.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing || submitted) return;
    
    // Combine the labels and the user's answers back into a single text string.
    const formattedData = fields.map(f => `**${f.label}**: ${values[f.label] || f.initialValue || 'Not provided'}`).join('\n');
    setSubmitted(true);
    onSubmit(formattedData); // Send the data back to the main app
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2 w-full max-w-[500px]">
      {fields.map((field, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#999]">{field.label}</label>
          <input
            type="text"
            placeholder={field.initialValue || "Enter details..."}
            value={values[field.label] || ''}
            onChange={(e) => setValues(prev => ({ ...prev, [field.label]: e.target.value }))}
            disabled={isProcessing || submitted}
            className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] transition-all disabled:opacity-50"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={isProcessing || submitted}
        className="w-full py-3 bg-[#1A1A1A] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-all disabled:bg-[#CCC] shadow-sm active:scale-[0.98]"
      >
        {submitted ? 'Information Submitted' : 'Submit Form'}
      </button>
    </form>
  );
}
