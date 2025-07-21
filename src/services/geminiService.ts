import { AnalysisResult, QuestionResult } from "@/components/StudyAssistant";
import { extractTextFromPdfPage } from "@/utils/pdfReader";

// ===================================================================================
// CRITICAL SECURITY WARNING
// ===================================================================================
// Do NOT expose your API key on the client-side like this in a production application.
// Any key prefixed with `VITE_` is visible to anyone visiting your website.
// A malicious user could steal your key and use it, leading to a large bill.
//
// SOLUTION: Create a secure backend proxy (e.g., using a Cloud Function, Vercel/Netlify
// serverless function). Your website should call YOUR backend, and YOUR backend will
// securely add the API key and call the Gemini API.
// ===================================================================================
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyCnwEpdvM7GnG_Af28iFULVgINlbhweFss";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

// ===================================================================================
// Reusable Helper Functions
// ===================================================================================

/**
 * A robust fetch wrapper with retry logic for transient server errors (5xx)
 * and network issues. Implements exponential backoff.
 * @param url The URL to fetch.
 * @param options The request options.
 * @param retries The number of times to retry on failure.
 * @param delay The initial delay between retries in milliseconds.
 * @returns A Promise that resolves with the Response object.
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1000
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      if (response.status >= 500 && response.status < 600) {
        console.warn(
          `Server error (${response.status}). Retrying in ${delay / 1000}s... (${i + 1}/${retries})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      console.error(`Client error (${response.status}). Aborting retries.`);
      throw new Error(`HTTP error! status: ${response.status}`);

    } catch (error) {
      console.warn(
        `Network or fetch error. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`, error
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error(`Failed to fetch from ${url} after ${retries} attempts.`);
};

/**
 * Safely parses a JSON string from the API, removing markdown and handling errors.
 * @param text The raw text response from the API.
 * @returns The parsed JSON object.
 */
const safeParseJson = (text: string): any => {
  const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Failed to parse JSON from Gemini API.", { rawContent: text });
    throw new Error("Invalid JSON response from API. The response could not be parsed.");
  }
};

/**
 * Converts a File object to a base64 encoded string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};


// ===================================================================================
// Refactored API Service Functions
// ===================================================================================

export const analyzeImage = async (file: File, outputLanguage: "english" | "tamil" = "english"): Promise<AnalysisResult> => {
  try {
    const base64Image = await convertToBase64(file);
    const languageInstruction = outputLanguage === "tamil" ? "Please provide all responses in Tamil language." : "Please provide all responses in English language.";
    const prompt = `You are an expert TNPSC examiner... [Original prompt text] ...something a TNPSC aspirant would find in their textbook.`; // Prompt kept for context

    const response = await fetchWithRetry(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: file.type, data: base64Image.split(',')[1] } }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4000 }
      })
    });

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) throw new Error('No content received from Gemini API');

    console.log('Raw Gemini response for analyzeImage:', content);
    const result = safeParseJson(content);
    
    return {
      keyPoints: result.keyPoints || [],
      summary: result.summary || '',
      tnpscRelevance: result.tnpscRelevance || '',
      studyPoints: result.studyPoints || [],
      tnpscCategories: result.tnpscCategories || []
    };
  } catch (error) {
    console.error('Error in analyzeImage:', error);
    throw error;
  }
};

export const generateQuestions = async (analysisResults: AnalysisResult[], difficulty = "medium", outputLanguage: "english" | "tamil" = "english"): Promise<QuestionResult> => {
  try {
    // ... (logic for combining content is the same)
    const combinedContent = analysisResults.map(result => ({
        keyPoints: result.keyPoints.join('\n'),
        summary: result.summary,
        tnpscRelevance: result.tnpscRelevance
      }));
    const languageInstruction = outputLanguage === "tamil" ? "Please provide all questions and answers in Tamil language." : "Please provide all questions and answers in English language.";
    const prompt = `You are an expert TNPSC question paper setter... [Original prompt text] ...Maintain TNPSC exam standards and patterns.`;

    const response = await fetchWithRetry(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 5000 }
      })
    });

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) throw new Error('No content received from Gemini API');

    console.log('Raw questions response:', content);
    const questions = safeParseJson(content);
    
    const formattedQuestions = Array.isArray(questions) ? questions.map((q: any) => ({
      ...q,
      type: q.type || "mcq",
      options: Array.isArray(q.options) ? q.options : ["A", "B", "C", "D"],
      answer: q.answer || "A",
      matchingPairs: q.matchingPairs || null
    })) : [];

    return {
      questions: formattedQuestions,
      summary: combinedContent.map(c => c.summary).join(' '),
      keyPoints: analysisResults.flatMap(r => r.keyPoints),
      difficulty,
      totalQuestions: formattedQuestions.length
    };
  } catch (error) {
    console.error('Error in generateQuestions:', error);
    throw error;
  }
};

export const generatePageAnalysis = async (file: File, pageNumber: number, outputLanguage: "english" | "tamil" = "english"): Promise<any> => {
  try {
    const textContent = await extractTextFromPdfPage(file, pageNumber);
    if (!textContent.trim()) throw new Error('No text content found on this page');
    
    const languageInstruction = outputLanguage === "tamil" ? "Please provide all responses in Tamil language." : "Please provide all responses in English language.";
    const prompt = `You are an expert TNPSC educator analyzing PDF content... [Original prompt text] ...Every extracted point should be textbook-worthy.`;

    const response = await fetchWithRetry(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
      })
    });

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) throw new Error('No content received from Gemini API');

    const analysis = safeParseJson(content);
    
    return {
      page: pageNumber,
      keyPoints: analysis.keyPoints || [],
      summary: analysis.summary || '',
      importance: analysis.importance || 'medium',
      tnpscRelevance: analysis.tnpscRelevance || ''
    };
  } catch (error) {
    console.error('Error in generatePageAnalysis:', error);
    throw error;
  }
};

export const analyzePdfContent = async (textContent: string, outputLanguage: "english" | "tamil" = "english"): Promise<AnalysisResult> => {
  try {
    const languageInstruction = outputLanguage === "tamil" ? "Please provide all responses in Tamil language." : "Please provide all responses in English language.";
    const prompt = `You are an expert TNPSC examiner and academic content analyst... [Original prompt text] ...directly applicable to exam questions.`;

    const response = await fetchWithRetry(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4000 }
      })
    });

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) throw new Error('No content received from Gemini API');

    console.log('Raw PDF analysis response:', content);
    const result = safeParseJson(content);
    
    return {
      keyPoints: result.keyPoints || [],
      summary: result.summary || '',
      tnpscRelevance: result.tnpscRelevance || '',
      studyPoints: result.studyPoints || [],
      tnpscCategories: result.tnpscCategories || []
    };
  } catch (error) {
    console.error('Error in analyzePdfContent:', error);
    throw error;
  }
};

export const analyzeIndividualPage = async (textContent: string, pageNumber: number, outputLanguage: "english" | "tamil" = "english"): Promise<any> => {
  try {
    const languageInstruction = outputLanguage === "tamil" ? "Please provide all responses in Tamil language." : "Please provide all responses in English language.";
    const prompt = `You are an expert TNPSC content analyst... [Original prompt text] ...directly convertible into high-scoring exam answers.`;

    const response = await fetchWithRetry(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 5000 }
      })
    });

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) throw new Error('No content received from Gemini API');
    
    const analysis = safeParseJson(content);
    
    return {
      pageNumber,
      keyPoints: analysis.keyPoints || [],
      studyPoints: analysis.studyPoints || [],
      summary: analysis.summary || '',
      tnpscRelevance: analysis.tnpscRelevance || ''
    };
  } catch (error) {
    console.error(`Error analyzing page ${pageNumber}:`, error);
    throw error;
  }
};

export const analyzeMultipleImages = async (files: File[], difficulty = "medium", outputLanguage: "english" | "tamil" = "english"): Promise<QuestionResult> => {
  try {
    const analysisResults: AnalysisResult[] = [];
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const result = await analyzeImage(file, outputLanguage); // Calls robust version
        analysisResults.push(result);
      }
    }
    
    if (analysisResults.length === 0) {
      throw new Error('No valid images found for analysis');
    }
    
    return await generateQuestions(analysisResults, difficulty, outputLanguage); // Calls robust version
  } catch (error) {
    console.error('Error in analyzeMultipleImages:', error);
    throw error;
  }
};

// This function was not in the original prompt, but is included here for completeness
// as it was mentioned in the previous turn. It also uses the robust helpers.
export const analyzePdfContentComprehensive = async (textContent: string, outputLanguage: "english" | "tamil" = "english"): Promise<any> => {
    try {
        const pageAnalyses = [];
        const allKeyPoints: string[] = [];
        const allCategories: string[] = [];

        const pageRegex = /==Start of OCR for page (\d+)==([\s\S]*?)==End of OCR for page \1==/g;
        const pageMatches = Array.from(textContent.matchAll(pageRegex));

        console.log(`Found ${pageMatches.length} pages to analyze comprehensively`);

        for (const match of pageMatches) {
            const pageNumber = parseInt(match[1], 10);
            const pageContent = match[2].trim();

            if (pageContent.length < 50) continue; // Skip sparse pages

            try {
                // This now calls the robust, refactored version of analyzeIndividualPage
                const analysis = await analyzeIndividualPage(pageContent, pageNumber, outputLanguage);
                pageAnalyses.push({ pageNumber, ...analysis });
                allKeyPoints.push(...(analysis.keyPoints || []));
                if (analysis.tnpscCategories) {
                  allCategories.push(...(analysis.tnpscCategories || []));
                }
            } catch (error) {
                console.error(`Error processing comprehensive analysis for page ${pageNumber}:`, error);
                // Continue to the next page even if one fails
            }

            // Small delay to be kind to the API
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return {
            pageAnalyses,
            overallSummary: `Comprehensive analysis of ${pageAnalyses.length} pages with ${allKeyPoints.length} total key points.`,
            totalKeyPoints: allKeyPoints,
            tnpscCategories: [...new Set(allCategories)]
        };
    } catch (error) {
        console.error('Error in comprehensive PDF analysis:', error);
        throw error;
    }
};