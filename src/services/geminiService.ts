/**
 * FILE HEADER: AI Communication Service
 * 
 * This file handles all the talking between our app and the Google Gemini AI.
 * It contains functions that send instructions to the AI agents and get their responses back.
 * Think of it like a telephone exchange that connects our app to the AI "brains."
 */

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AgentSettings, AgentId } from "../types";

/**
 * Initialize the AI connection using your secret API key.
 * The API key is like a password that lets us use the Gemini AI service.
 */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * Sends a prompt (instruction) to a specific AI agent and gets their text response.
 * 
 * @param agent - The settings for the agent we want to talk to (instructions, model, etc.)
 * @param prompt - The specific question or task we want the agent to do right now.
 * @param history - A list of previous messages so the AI remembers what we've already talked about.
 * @returns A promise that resolves to the AI's text response.
 */
export async function callAgent(
  agent: AgentSettings,
  prompt: string,
  history: { role: string; content: string }[] = []
): Promise<string> {
  try {
    // We prepare the conversation history in a format the AI understands.
    const contents = [
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      { role: 'user', parts: [{ text: prompt }] }
    ];

    // We ask the AI to generate a response based on the agent's instructions and our prompt.
    const response = await ai.models.generateContent({
      model: agent.model,
      contents: contents as any,
      config: {
        systemInstruction: agent.instructions,
        temperature: agent.temperature,
      },
    });

    // We return the text the AI wrote, or a default message if it didn't write anything.
    return response.text || "No response generated.";
  } catch (error) {
    // If something goes wrong (like a bad internet connection), we log the error.
    console.error(`Error calling agent ${agent.name}:`, error);
    throw error;
  }
}

/**
 * Asks the Project Manager to decide if we have enough info to start, or if we need more questions.
 * 
 * @param pm - The Project Manager's settings.
 * @param userHistory - The conversation so far between the user and the PM.
 * @returns A promise with either a completed "brief" or a list of "questions."
 */
export async function generateProjectBrief(
  pm: AgentSettings,
  userHistory: { role: string; content: string }[]
): Promise<{ brief?: string; questions?: string }> {
  const prompt = `Based on our conversation, have we gathered enough information to create a complete project brief? 
  If YES, output the brief in a structured format starting with "BRIEF:".
  If NO, output the questions needed to complete the brief. 
  IMPORTANT: Format your questions as a plain, structured form (a simple list of fields with bold labels). Do not include any conversational filler or introductory text.`;

  const response = await callAgent(pm, prompt, userHistory);
  
  // If the AI started its response with "BRIEF:", we know it's finished gathering info.
  if (response.includes("BRIEF:")) {
    return { brief: response.split("BRIEF:")[1].trim() };
  } else {
    // Otherwise, it's still asking questions.
    return { questions: response };
  }
}

/**
 * Asks the Researcher agent to find information based on the project brief.
 * 
 * @param researcher - The Researcher's settings.
 * @param brief - The summary of the letter project.
 * @returns A promise with the research findings.
 */
export async function performResearch(
  researcher: AgentSettings,
  brief: string
): Promise<string> {
  const prompt = `Research the following project brief and provide structured findings:
  ${brief}`;
  return await callAgent(researcher, prompt);
}

/**
 * Asks the Writer agent to create a draft of the letter.
 * 
 * @param writer - The Writer's settings.
 * @param brief - The project summary.
 * @param insights - The research findings.
 * @param feedback - Optional feedback from the Editor to help with revisions.
 * @returns A promise with the letter draft.
 */
export async function writeLetter(
  writer: AgentSettings,
  brief: string,
  insights: string,
  feedback?: string
): Promise<string> {
  const prompt = feedback 
    ? `Revise the letter based on this feedback: ${feedback}\n\nOriginal Brief: ${brief}\nResearch Insights: ${insights}`
    : `Write a letter based on the following:\nBrief: ${brief}\nResearch Insights: ${insights}`;
  return await callAgent(writer, prompt);
}

/**
 * Asks the Editor agent to review the letter draft.
 * 
 * @param editor - The Editor's settings.
 * @param brief - The original project summary.
 * @param draft - The current version of the letter.
 * @returns A promise indicating if it's "ready" or needs more "feedback."
 */
export async function editLetter(
  editor: AgentSettings,
  brief: string,
  draft: string
): Promise<{ ready: boolean; feedback?: string }> {
  const prompt = `Evaluate this letter draft against the brief.
  Brief: ${brief}
  Draft: ${draft}
  
  If the letter is ready, output "READY".
  If it needs revisions, provide structured revision notes.`;

  const response = await callAgent(editor, prompt);
  // If the Editor says "READY", we move to the next step.
  if (response.trim().toUpperCase().includes("READY")) {
    return { ready: true };
  }
  // Otherwise, we send the Editor's notes back to the Writer.
  return { ready: false, feedback: response };
}

/**
 * Asks the Ethics Reviewer to check the letter for safety and fairness.
 * 
 * @param ethics - The Ethics Reviewer's settings.
 * @param brief - The project summary.
 * @param draft - The letter draft.
 * @returns A promise with a "pass" status and a detailed "report."
 */
export async function reviewEthics(
  ethics: AgentSettings,
  brief: string,
  draft: string
): Promise<{ pass: boolean; report: string }> {
  const prompt = `Perform an ethics review on this letter draft.
  Brief: ${brief}
  Draft: ${draft}
  
  Output a pass/fail signal and a structured report. Start with "SIGNAL: PASS" or "SIGNAL: FAIL".`;

  const response = await callAgent(ethics, prompt);
  const pass = response.includes("SIGNAL: PASS");
  return { pass, report: response };
}

/**
 * Asks the Graphic Designer to format the final letter into two distinct design options.
 * 
 * @param designer - The Graphic Designer's settings.
 * @param letter - The approved text of the letter.
 * @returns A promise with two distinct design options.
 */
export async function designLetter(
  designer: AgentSettings,
  letter: string
): Promise<{ id: string; name: string; description: string; content: string }[]> {
  const prompt = `Create two distinct visual design options for the following letter. 
  Follow the required output format exactly.
  
  Letter: ${letter}`;
  
  const response = await callAgent(designer, prompt);
  
  // Parsing the two options from the AI response
  const options: { id: string; name: string; description: string; content: string }[] = [];
  
  try {
    // Try a more flexible regex-based approach first
    const option1Match = response.match(/OPTION_1_NAME:\s*(.*?)\s*OPTION_1_DESCRIPTION:\s*(.*?)\s*OPTION_1_CONTENT:\s*([\s\S]*?)(?=OPTION_2_NAME:|$)/i);
    const option2Match = response.match(/OPTION_2_NAME:\s*(.*?)\s*OPTION_2_DESCRIPTION:\s*(.*?)\s*OPTION_2_CONTENT:\s*([\s\S]*?)$/i);

    if (option1Match) {
      options.push({
        id: `opt-1-${Date.now()}`,
        name: option1Match[1].trim() || "Option 1",
        description: option1Match[2].trim() || "A creative design direction.",
        content: option1Match[3].trim()
      });
    }

    if (option2Match) {
      options.push({
        id: `opt-2-${Date.now()}`,
        name: option2Match[1].trim() || "Option 2",
        description: option2Match[2].trim() || "A creative design direction.",
        content: option2Match[3].trim()
      });
    }

    // If regex failed but we have a response, try the split method as backup
    if (options.length === 0) {
      for (let i = 1; i <= 2; i++) {
        const part = response.split(`OPTION_${i}_NAME:`)[1]?.split(`OPTION_${i+1}_NAME:`)[0] || "";
        if (!part) continue;
        
        const name = part.split(`OPTION_${i}_DESCRIPTION:`)[0]?.trim() || `Option ${i}`;
        const descriptionPart = part.split(`OPTION_${i}_DESCRIPTION:`)[1] || "";
        const description = descriptionPart.split(`OPTION_${i}_CONTENT:`)[0]?.trim() || "A professional design option.";
        const content = descriptionPart.split(`OPTION_${i}_CONTENT:`)[1]?.trim() || "";
        
        if (content) {
          options.push({
            id: `opt-${i}-${Date.now()}`,
            name,
            description,
            content
          });
        }
      }
    }
  } catch (error) {
    console.error("Error parsing design options:", error);
  }

  // Final fallback: If still empty, provide the original letter as a standard option
  if (options.length === 0) {
    options.push({
      id: `fallback-1-${Date.now()}`,
      name: "Standard Design",
      description: "A clean, professional layout.",
      content: letter
    });
    options.push({
      id: `fallback-2-${Date.now()}`,
      name: "Modern Design",
      description: "A contemporary approach to your letter.",
      content: letter
    });
  }
  
  return options;
}
