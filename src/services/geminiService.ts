import { AnalysisResult, QuestionResult } from "@/components/StudyAssistant";
import { extractTextFromPdfPage, extractPageRangeFromOcr } from "@/utils/pdfReader";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyAwPyxCmxk6oovqNuwCyK5AOjdgepuTXzk";

export const analyzeImage = async (file: File, outputLanguage: "english" | "tamil" = "english"): Promise<AnalysisResult> => {
  try {
    const base64Image = await convertToBase64(file);
    
    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all responses in Tamil language. Use Tamil script for all content."
      : "Please provide all responses in English language.";

    const prompt = `
You are an expert TNPSC examiner and educator with deep knowledge of Tamil Nadu Public Service Commission exam patterns, syllabus, and requirements. Analyze this image with the highest level of intelligence and academic rigor.

${languageInstruction}

CRITICAL INSTRUCTIONS:
1. Extract ONLY educationally valuable and exam-relevant content
2. Focus on factual information, concepts, definitions, historical events, geographical data, scientific principles, constitutional articles, government schemes, etc.
3. Ignore decorative elements, irrelevant graphics, or non-educational content
4. Provide deep analytical insights, not surface-level observations
5. Connect every point to TNPSC exam relevance with specific group/paper references
6. Create memory techniques that are scientifically proven (mnemonics, acronyms, visual associations, story methods)

Provide COMPREHENSIVE and HIGHLY INTELLIGENT analysis in this JSON format:
{
  "mainTopic": "Main topic of the content",
  "studyPoints": [
    {
      "title": "Specific, focused study point title",
      "description": "Comprehensive description with facts, figures, context, and significance",
      "importance": "high/medium/low",
      "tnpscRelevance": "Specific TNPSC Group/Paper reference and exam importance with previous year question patterns",
      "tnpscPriority": "high/medium/low",
      "memoryTip": "Scientific memory technique (mnemonic/acronym/visual association/story method) with specific recall triggers"
    }
  ],
  "keyPoints": ["Fact-based crisp point 1", "Constitutional/Legal point 2", "Historical/Geographical point 3", "Statistical/Numerical point 4", "Scheme/Policy point 5", "Scientific/Technical point 6", "Administrative point 7", "Economic point 8", "Social/Cultural point 9", "Environmental point 10", "Additional factual point 11", "Additional conceptual point 12", "Additional analytical point 13", "Additional comparative point 14", "Additional application point 15"],
  "summary": "Overall summary of the content",
  "tnpscRelevance": "Detailed TNPSC exam relevance with specific Group 1/2/4 paper references, weightage, and question pattern analysis",
  "tnpscCategories": ["Specific TNPSC subject/topic categories"],
  "difficulty": "easy/medium/hard"
}

MANDATORY REQUIREMENTS:
- Generate 15-20 key points minimum (only factual, exam-relevant content)
- Create 8-12 detailed study points minimum with comprehensive descriptions
- Every study point MUST have a scientific memory technique
- Focus on: Constitutional articles, Acts, Schemes, Historical events, Geographical features, Economic data, Administrative structures, Scientific principles, Environmental policies, Cultural heritage
- Provide specific TNPSC Group/Paper references for each point
- Include numerical data, dates, names, places, percentages, statistics wherever visible
- Connect concepts to current affairs and government initiatives
- Ensure each memory tip uses proven recall techniques (acronyms, visual imagery, story method, rhymes, associations)

QUALITY CHECK: Every point should be something a TNPSC aspirant would find in their textbook or previous year questions.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: file.type,
                  data: base64Image.split(',')[1]
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    console.log('Raw Gemini response:', content);

    // Clean and parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);
    
    return {
      keyPoints: result.keyPoints || [],
      summary: result.summary || '',
      tnpscRelevance: result.tnpscRelevance || '',
      studyPoints: result.studyPoints || [],
      tnpscCategories: result.tnpscCategories || []
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
};

export const generateQuestions = async (
  analysisResults: AnalysisResult[],
  difficulty: string = "medium",
  outputLanguage: "english" | "tamil" = "english"
): Promise<QuestionResult> => {
  try {
    const combinedContent = analysisResults.map(result => ({
      keyPoints: result.keyPoints.join('\n'),
      summary: result.summary,
      tnpscRelevance: result.tnpscRelevance
    }));

    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all questions and answers in Tamil language."
      : "Please provide all questions and answers in English language.";

    const prompt = `
You are an expert TNPSC question paper setter with deep knowledge of exam patterns. Generate 20-25 high-quality questions based on the following content:

Content Analysis:
${combinedContent.map((content, index) => `
Analysis ${index + 1}:
Key Points: ${content.keyPoints}
Summary: ${content.summary}
TNPSC Relevance: ${content.tnpscRelevance}
`).join('\n')}

Difficulty Level: ${difficulty}
${languageInstruction}

Generate these types of questions in exact proportions:
- Regular Multiple Choice Questions (4 options) - 50%
- Assertion-Reason Questions - 25%
- Match the Following Questions - 25%

For Regular MCQ questions:
- Provide 4 clear, distinct options (A, B, C, D)
- Make distractors plausible but clearly wrong
IMPORTANT: The "answer" field should contain ONLY the option letter (A, B, C, or D), not the full option text.

For Assertion-Reason questions:
Format: "Assertion (A): [statement] Reason (R): [statement]"
Options:
(A) Both A and R are true and R is the correct explanation of A
(B) Both A and R are true but R is not the correct explanation of A  
(C) A is true but R is false
(D) A is false but R is true

For Match the Following questions:
Format: "Match the following:"
Column I: [4 items labeled (a), (b), (c), (d)]
Column II: [4 items labeled 1, 2, 3, 4]
Options:
(A) (a)-2, (b)-3, (c)-1, (d)-4
(B) (a)-4, (b)-2, (c)-3, (d)-1
(C) (a)-3, (b)-1, (c)-4, (d)-2
(D) (a)-1, (b)-4, (c)-2, (d)-3

Return as a JSON array:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"], // For MCQ and Assertion-Reason
    "matchingPairs": { // Only for Match the Following questions
      "columnI": ["Item (a)", "Item (b)", "Item (c)", "Item (d)"],
      "columnII": ["Item 1", "Item 2", "Item 3", "Item 4"]
    },
    "answer": "A",
    "type": "mcq" | "assertion_reason" | "match_following",
    "difficulty": "${difficulty}",
    "tnpscGroup": "Group 1" | "Group 2" | "Group 4",
    "explanation": "Detailed explanation with TNPSC context and learning points"
  }
]

QUALITY REQUIREMENTS:
- Questions must be TNPSC standard with proper difficulty progression
- Test factual recall, conceptual understanding, analytical thinking, and application
- Include questions on: Constitutional provisions, Government schemes, Historical events, Geographical features, Economic policies, Administrative structures, Current affairs connections
- Ensure questions are exam-worthy and not generic
- Each question should have clear learning objectives
- Explanations should provide additional learning value

CRITICAL: 
- Answer field contains only the letter (A, B, C, or D)
- For Match the Following, provide the correct matching combination
- Ensure all questions are directly based on the analyzed content
- Maintain TNPSC exam standards and patterns
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 5000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    console.log('Raw questions response:', content);

    // Clean and parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const questions = JSON.parse(cleanedContent);
    
    // Ensure all questions have the correct type format and proper options
    const formattedQuestions = questions.map((q: any) => ({
      ...q,
      type: q.type || "mcq",
      options: Array.isArray(q.options) ? q.options : ["Option A", "Option B", "Option C", "Option D"],
      answer: q.answer || "A",
      matchingPairs: q.matchingPairs || null
    }));

    const result: QuestionResult = {
      questions: formattedQuestions,
      summary: combinedContent.map(c => c.summary).join(' '),
      keyPoints: analysisResults.flatMap(r => r.keyPoints),
      difficulty,
      totalQuestions: formattedQuestions.length
    };

    return result;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw error;
  }
};

export const generatePageAnalysis = async (
  file: File,
  pageNumber: number,
  outputLanguage: "english" | "tamil" = "english"
): Promise<{
  page: number;
  keyPoints: string[];
  summary: string;
  importance: "high" | "medium" | "low";
  tnpscRelevance: string;
}> => {
  try {
    const textContent = await extractTextFromPdfPage(file, pageNumber);
    
    if (!textContent.trim()) {
      throw new Error('No text content found on this page');
    }

    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all responses in Tamil language."
      : "Please provide all responses in English language.";

    const prompt = `
You are an expert TNPSC educator analyzing PDF content. Apply highest academic standards and intelligence.

${languageInstruction}

Content: ${textContent}

CRITICAL ANALYSIS REQUIREMENTS:
1. Extract ONLY academically valuable, exam-relevant content
2. Focus on factual data, concepts, definitions, schemes, policies, historical events, geographical features
3. Ignore irrelevant or decorative content
4. Provide deep insights with TNPSC-specific relevance
5. Create scientific memory techniques for better retention

Provide INTELLIGENT analysis in JSON format:
{
  "keyPoints": ["Factual point with data", "Constitutional/Legal provision", "Historical event/date", "Geographical feature/location", "Government scheme/policy", "Economic indicator/statistic", "Administrative structure", "Scientific principle/fact", "Environmental policy/data", "Cultural/Social aspect", "Additional factual point", "Additional analytical point", "Additional comparative point", "Additional application point", "Additional conceptual point"],
  "studyPoints": [
    {
      "title": "Specific, focused academic title",
      "description": "Comprehensive description with context, significance, facts, figures, and implications",
      "importance": "high/medium/low",
      "tnpscRelevance": "Specific TNPSC Group/Paper reference with exam weightage and question pattern analysis",
      "memoryTip": "Scientific memory technique (acronym/mnemonic/visual association/story method) with specific recall triggers"
    }
  ],
  "summary": "Comprehensive academic summary highlighting key educational concepts and their significance",
  "importance": "high/medium/low",
  "tnpscRelevance": "Detailed TNPSC exam relevance with specific references to syllabus topics, previous year questions, and exam importance"
}

MANDATORY FOCUS AREAS:
- Generate 15-20 key points minimum (only high-value educational content)
- Create 10-15 detailed study points minimum
- Every study point MUST have scientific memory technique
- Extract: Constitutional articles, Government schemes, Historical events, Geographical data, Economic policies, Administrative details, Scientific facts, Environmental policies, Statistical data
- Provide specific TNPSC syllabus connections
- Include numerical data, percentages, dates, names, places wherever present
- Connect to current government initiatives and policies
- Ensure memory tips use proven psychological recall methods

QUALITY STANDARD: Every extracted point should be textbook-worthy and exam-relevant for TNPSC preparation.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const analysis = JSON.parse(cleanedContent);
    
    return {
      page: pageNumber,
      keyPoints: analysis.keyPoints || [],
      summary: analysis.summary || '',
      importance: analysis.importance || 'medium',
      tnpscRelevance: analysis.tnpscRelevance || ''
    };
  } catch (error) {
    console.error('Error analyzing page:', error);
    throw error;
  }
};

export const analyzePdfContentComprehensive = async (
  textContent: string,
  outputLanguage: "english" | "tamil" = "english"
): Promise<{
  pageAnalyses: Array<{
    pageNumber: number;
    keyPoints: string[];
    studyPoints: Array<{
      title: string;
      description: string;
      importance: "high" | "medium" | "low";
      tnpscRelevance: string;
    }>;
    summary: string;
    tnpscRelevance: string;
  }>;
  overallSummary: string;
  totalKeyPoints: string[];
  tnpscCategories: string[];
}> => {
  try {
    const pageAnalyses = [];
    const allKeyPoints: string[] = [];
    const allCategories: string[] = [];
    
    // Extract individual pages from the OCR text
    const pageRegex = /==Start of OCR for page (\d+)==([\s\S]*?)==End of OCR for page \1==/g;
    const pageMatches = Array.from(textContent.matchAll(pageRegex));
    
    console.log(`Found ${pageMatches.length} pages to analyze`);
    
    // Process pages in batches to avoid API limits
    const batchSize = 5;
    for (let i = 0; i < pageMatches.length; i += batchSize) {
      const batch = pageMatches.slice(i, i + batchSize);
      
      for (const match of batch) {
        const pageNumber = parseInt(match[1], 10);
        const pageContent = match[2].trim();
        
        if (pageContent.length < 50) continue; // Skip pages with minimal content
        
        const languageInstruction = outputLanguage === "tamil" 
          ? "Please provide all responses in Tamil language."
          : "Please provide all responses in English language.";

        const prompt = `
Analyze this PDF page content for TNPSC exam preparation:

${languageInstruction}

Page ${pageNumber} Content: ${pageContent.substring(0, 4000)}

Please provide analysis in JSON format:
{
  "keyPoints": ["Short crisp key point 1", "Short crisp key point 2", "Short crisp key point 3", "Short crisp key point 4", "Short crisp key point 5", "Short crisp key point 6", "Short crisp key point 7", "Short crisp key point 8", "Short crisp key point 9", "Short crisp key point 10", "Short crisp key point 11", "Short crisp key point 12"],
  "studyPoints": [
    {
      "title": "Study point title",
      "description": "Detailed description",
      "importance": "high/medium/low",
      "tnpscRelevance": "TNPSC relevance explanation",
      "memoryTip": "Easy memory tip for students"
    }
  ],
  "summary": "Brief summary of the page content",
  "tnpscRelevance": "How this content relates to TNPSC exams",
  "tnpscCategories": ["Category1", "Category2"]
}

Focus on:
- Extract COMPREHENSIVE key points from the page (aim for 12+ key points minimum)
- Create detailed study points with comprehensive descriptions
- MANDATORY: Provide memory tips for EVERY study point to help students remember better
- TNPSC exam relevance
- Important facts and concepts
- Key information for study
- Extract ALL important information from the page content
- Don't miss any detail that could be relevant for TNPSC preparation
- Make memory tips creative, using mnemonics, associations, or simple tricks
`;

        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
              }
            })
          });

          if (!response.ok) {
            console.error(`Failed to analyze page ${pageNumber}`);
            continue;
          }

          const data = await response.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!content) {
            console.error(`No content received for page ${pageNumber}`);
            continue;
          }

          const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
          const analysis = JSON.parse(cleanedContent);
          
          pageAnalyses.push({
            pageNumber,
            keyPoints: analysis.keyPoints || [],
            studyPoints: analysis.studyPoints || [],
            summary: analysis.summary || '',
            tnpscRelevance: analysis.tnpscRelevance || ''
          });
          
          allKeyPoints.push(...(analysis.keyPoints || []));
          allCategories.push(...(analysis.tnpscCategories || []));
          
        } catch (error) {
          console.error(`Error analyzing page ${pageNumber}:`, error);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Generate overall summary
    const overallSummary = `Comprehensive analysis of ${pageAnalyses.length} pages with ${allKeyPoints.length} total key points identified.`;
    
    return {
      pageAnalyses,
      overallSummary,
      totalKeyPoints: allKeyPoints,
      tnpscCategories: [...new Set(allCategories)]
    };
  } catch (error) {
    console.error('Error in comprehensive PDF analysis:', error);
    throw error;
  }
};

export const analyzePdfContent = async (
  textContent: string,
  outputLanguage: "english" | "tamil" = "english"
): Promise<AnalysisResult> => {
  try {
    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all responses in Tamil language. Use Tamil script for all content."
      : "Please provide all responses in English language.";

    const prompt = `
You are an expert TNPSC examiner and academic content analyst. Analyze this PDF content with the highest level of intelligence and academic rigor.

${languageInstruction}

Content: ${textContent.substring(0, 8000)}

CRITICAL INTELLIGENCE REQUIREMENTS:
1. Extract ONLY high-value educational content relevant to TNPSC exams
2. Focus on factual information, concepts, policies, schemes, historical data, geographical features, constitutional provisions
3. Ignore decorative or irrelevant content
4. Provide deep analytical insights with specific TNPSC connections
5. Create scientifically-proven memory techniques for optimal retention

Provide HIGHLY INTELLIGENT and COMPREHENSIVE analysis in JSON format:
{
  "mainTopic": "Main topic of the content",
  "studyPoints": [
    {
      "title": "Specific, academically focused title",
      "description": "Comprehensive description with facts, context, significance, implications, and detailed analysis",
      "importance": "high/medium/low",
      "tnpscRelevance": "Specific TNPSC Group/Paper reference, syllabus topic, exam weightage, and previous year question patterns",
      "tnpscPriority": "high/medium/low",
      "memoryTip": "Scientific memory technique using proven psychological methods (acronyms, mnemonics, visual associations, story method, chunking) with specific recall triggers"
    }
  ],
  "keyPoints": ["Constitutional/Legal fact", "Historical event with date", "Geographical feature/data", "Government scheme/policy", "Economic indicator/statistic", "Administrative structure/detail", "Scientific principle/fact", "Environmental policy/data", "Cultural/Social fact", "Statistical/Numerical data", "Important name/personality", "Significant date/year", "Policy/Act detail", "Comparative fact", "Application-based point", "Additional factual point", "Additional analytical point", "Additional conceptual point"],
  "summary": "Overall summary of the content",
  "tnpscRelevance": "Detailed TNPSC exam relevance with specific Group 1/2/4 paper references, syllabus alignment, weightage analysis, and connection to previous year questions",
  "tnpscCategories": ["Category1", "Category2", ...],
  "difficulty": "easy/medium/hard"
}

MANDATORY EXTRACTION REQUIREMENTS:
- Generate 18-25 key points minimum (only high-value, exam-relevant content)
- Create 12-18 detailed study points minimum with comprehensive analysis
- Every study point MUST have a scientific memory technique
- Focus on: Constitutional articles/amendments, Government schemes/policies, Historical events/personalities, Geographical features/data, Economic indicators/policies, Administrative structures/reforms, Scientific principles/discoveries, Environmental policies/acts, Statistical data/census figures, Cultural heritage/monuments
- Provide specific TNPSC Group/Paper/Subject references
- Include all numerical data, percentages, dates, names, places, statistics
- Connect to current affairs, government initiatives, and policy developments
- Ensure memory tips use proven cognitive science methods (spaced repetition triggers, visual imagery, semantic encoding, elaborative rehearsal)

ACADEMIC EXCELLENCE STANDARD: Every point should be worthy of inclusion in a TNPSC preparation textbook and directly applicable to exam questions.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    console.log('Raw PDF analysis response:', content);

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);
    
    return {
      keyPoints: result.keyPoints || [],
      summary: result.summary || '',
      tnpscRelevance: result.tnpscRelevance || '',
      studyPoints: result.studyPoints || [],
      tnpscCategories: result.tnpscCategories || []
    };
  } catch (error) {
    console.error('Error analyzing PDF content:', error);
    throw error;
  }
};

export const analyzeIndividualPage = async (
  textContent: string,
  pageNumber: number,
  outputLanguage: "english" | "tamil" = "english"
): Promise<{
  pageNumber: number;
  keyPoints: string[];
  studyPoints: Array<{
    title: string;
    description: string;
    importance: "high" | "medium" | "low";
    tnpscRelevance: string;
  }>;
  summary: string;
  tnpscRelevance: string;
}> => {
  try {
    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all responses in Tamil language."
      : "Please provide all responses in English language.";

    const prompt = `
You are an expert TNPSC content analyst with deep academic expertise. Analyze this individual PDF page with maximum intelligence and educational rigor.

${languageInstruction}

Page ${pageNumber} Content: ${textContent.substring(0, 4000)}

CRITICAL INTELLIGENCE STANDARDS:
1. Extract ONLY academically valuable, exam-relevant educational content
2. Focus on factual information, concepts, policies, schemes, historical data, geographical features, constitutional provisions
3. Ignore decorative, irrelevant, or non-educational content  
4. Provide deep analytical insights with specific TNPSC exam connections
5. Create advanced memory techniques using proven cognitive science methods

Provide HIGHLY INTELLIGENT and COMPREHENSIVE analysis in JSON format:
{
  "keyPoints": ["Constitutional article/provision with number", "Historical event with specific date/year", "Geographical feature with precise location", "Government scheme with launch details", "Economic policy with statistical data", "Administrative structure with hierarchy", "Scientific principle with practical application", "Environmental act with implementation details", "Cultural monument with historical significance", "Statistical figure with data source", "Important personality with major contribution", "Significant law/act with key provisions", "Policy reform with implementation timeline", "Comparative data with analysis", "Current affairs connection", "Additional constitutional fact", "Additional historical detail", "Additional geographical data", "Additional economic indicator", "Additional administrative detail", "Additional scientific fact", "Additional environmental policy", "Additional cultural aspect", "Additional statistical information", "Additional exam-relevant fact"],
  "studyPoints": [
    {
      "title": "Academically precise and specific title",
      "description": "Comprehensive description with detailed context, significance, facts, figures, implications, historical background, current relevance, and analytical insights for thorough understanding",
      "importance": "high/medium/low",
      "tnpscRelevance": "Specific TNPSC Group/Paper/Subject reference with detailed syllabus alignment, exam weightage analysis, previous year question patterns, and strategic preparation guidance",
      "memoryTip": "Advanced memory technique using cognitive science principles (acronyms, mnemonics, visual imagery, story method, chunking, semantic encoding, method of loci) with specific recall triggers, practice methods, and retention strategies"
    }
  ],
  "summary": "Comprehensive academic summary highlighting key educational concepts, their interconnections, significance, and learning outcomes for TNPSC preparation",
  "tnpscRelevance": "Detailed TNPSC exam relevance with specific syllabus topic connections, exam pattern alignment, weightage analysis, and strategic study recommendations"
}

MANDATORY EXTRACTION EXCELLENCE:
- Generate 25-30 key points minimum (only premium educational content)
- Create 18-25 detailed study points minimum with comprehensive analysis
- Every study point MUST have an advanced, scientifically-proven memory technique
- Extract with precision: Constitutional articles/amendments/schedules, Government schemes/policies/initiatives, Historical events/dates/personalities/movements, Geographical features/states/districts/rivers/mountains, Economic policies/indicators/data/statistics, Administrative structures/reforms/commissions, Scientific principles/discoveries/applications, Environmental acts/policies/targets/data, Statistical information/census/surveys, Cultural heritage/monuments/traditions/festivals
- Provide specific TNPSC Group 1/2/4 paper references with exact syllabus topic mapping
- Include ALL numerical data, percentages, dates, names, places, statistics, years, figures
- Connect to current government initiatives, recent policy developments, and contemporary relevance
- Cross-reference with TNPSC previous year questions, exam trends, and scoring patterns
- Ensure memory tips incorporate multiple cognitive pathways (visual, auditory, kinesthetic, semantic)

PREMIUM QUALITY BENCHMARK: Every extracted point should exceed the standard of top TNPSC coaching institutes and be directly convertible into high-scoring exam answers.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 5000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const analysis = JSON.parse(cleanedContent);
    
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

const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const analyzeMultipleImages = async (
  files: File[],
  difficulty: string = "medium",
  outputLanguage: "english" | "tamil" = "english"
): Promise<QuestionResult> => {
  try {
    const analysisResults: AnalysisResult[] = [];
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const result = await analyzeImage(file, outputLanguage);
        analysisResults.push(result);
      }
    }
    
    if (analysisResults.length === 0) {
      throw new Error('No valid images found for analysis');
    }
    
    const questionResult = await generateQuestions(analysisResults, difficulty, outputLanguage);
    return questionResult;
  } catch (error) {
    console.error('Error in analyzeMultipleImages:', error);
    throw error;
  }
};