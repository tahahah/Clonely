import { Groq } from "groq-sdk";
import { z } from "zod";
import { GROQ_SYSTEM_PROMPT } from "./systemPrompt";

const GROQ_API_KEY =
  (import.meta as any).env?.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
  throw new Error(
    'GROQ_API_KEY is not set. Ensure it exists in .env or as a system env variable, or that it is defined in Vite env files.'
  );
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Define a schema with Zod for the expected JSON response
const ActionSchema = z.object({
  actions: z.array(z.string()).default([]),
});

export class GroqHelper {
  private readonly modelName: string;

  constructor(modelName: string = "qwen/qwen3-32b") {
    this.modelName = modelName;
  }

  public async streamQuestions(
    prevQuestions: string[],
    currentTranscript: string,
    onChunk: (chunk: string) => void
  ): Promise<z.infer<typeof ActionSchema>> {
    console.warn('GroqHelper: streamQuestions called with:', { prevQuestions, currentTranscript });
    const systemContent = JSON.stringify({
      role: "system",
      content: GROQ_SYSTEM_PROMPT,
    }); // System message for Groq

    const userContent = `Here are the previous questions you suggested:\n<prev_questions>\n${prevQuestions.join('\n')}\n</prev_questions>\n\nupdated call transcript and list the most urgent, high-value questions I currently need answered:\n<current_transcript>\n${currentTranscript}\n</current_transcript>`; // User message with previous questions and current transcript

    let fullResponseContent = ""; // Accumulator for the full streamed response
    console.warn('GroqHelper: Initializing Groq client and streaming...');

    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemContent }, // System message for the assistant's behavior
        { role: "user", content: userContent }, // User message with context for analysis
      ],
      model: this.modelName, // Model to use for generating completions
      response_format: { type: "json_object" }, // Ensure the response is a JSON object
      stream: true, // Enable streaming for partial message deltas
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''; // Extract content from each chunk
      fullResponseContent += content; // Accumulate content
      onChunk(content); // Call the callback with each chunk
    }

    // Parse and validate JSON after the stream is complete
    try {
      const jsonData = JSON.parse(fullResponseContent);
      const validated = ActionSchema.parse(jsonData);
      return validated; // Return validated data
    } catch (error) {
      console.error("Error parsing or validating Groq response:", error);
      throw error; // Re-throw the error for upstream handling
    }
  }
}
