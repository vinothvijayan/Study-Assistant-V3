import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Brain, 
  Zap, 
  Download, 
  ArrowLeft,
  BookOpen,
  Target,
  Lightbulb,
  Clock,
  CheckCircle,
  Award
} from "lucide-react";
import { analyzeIndividualPage } from "@/services/geminiService";
import { extractPageRangeFromOcr } from "@/utils/pdfReader";
import { downloadPDF } from "@/utils/pdfUtils";
import { toast } from "sonner";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/config/firebase";
import { saveStudyHistory, updateStudyHistory } from "@/services/studyHistoryService";

interface PageAnalysis {
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
  isAnalyzed: boolean;
}

interface PdfPageNavigatorProps {
  file: File;
  totalPages: number;
  fullText: string;
  outputLanguage: "english" | "tamil";
  onReset: () => void;
  onStartQuiz: (pageRange: { start: number; end: number }, difficulty: string) => void;
  initialPageAnalyses?: Map<number, PageAnalysis>;
  initialStudyHistoryId?: string;
}

const PdfPageNavigator = ({ 
  file, 
  totalPages, 
  fullText, 
  outputLanguage, 
  onReset,
  onStartQuiz,
  initialPageAnalyses,
  initialStudyHistoryId
}: PdfPageNavigatorProps) => {
  const [user] = useAuthState(auth);
  const [currentPage, setCurrentPage] = useState(() => {
    if (initialPageAnalyses && initialPageAnalyses.size > 0) {
      const analyzedPages = Array.from(initialPageAnalyses.keys()).sort((a, b) => a - b);
      const lastAnalyzedPage = analyzedPages[analyzedPages.length - 1];
      return Math.min(lastAnalyzedPage + 1, totalPages);
    }
    return 1;
  });
  const [pageAnalyses, setPageAnalyses] = useState<Map<number, PageAnalysis>>(
    initialPageAnalyses || new Map()
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [quizStartPage, setQuizStartPage] = useState(1);
  const [quizEndPage, setQuizEndPage] = useState<number | string>(Math.min(5, totalPages));
  const [difficulty, setDifficulty] = useState("medium");
  
  // Enhanced study history ID management with session storage backup
  const [studyHistoryId, setStudyHistoryId] = useState<string | null>(() => {
    // First check if we have an initial ID from props
    if (initialStudyHistoryId) {
      console.log("Using initial study history ID from props:", initialStudyHistoryId);
      return initialStudyHistoryId;
    }
    
    // Fallback to session storage for persistence during the session
    const sessionKey = `studyHistoryId_${file.name}_${file.size}`;
    const sessionId = sessionStorage.getItem(sessionKey);
    if (sessionId) {
      console.log("Using study history ID from session storage:", sessionId);
      return sessionId;
    }
    
    console.log("No existing study history ID found, will create new one");
    return null;
  });

  const currentAnalysis = pageAnalyses.get(currentPage);
  const analyzedPages = Array.from(pageAnalyses.values()).filter(p => p.isAnalyzed).length;
  const progressPercentage = (analyzedPages / totalPages) * 100;

  // Enhanced logging and session storage management
  useEffect(() => {
    console.log("=== Study History ID State Change ===");
    console.log("Current studyHistoryId:", studyHistoryId);
    console.log("Initial Study History ID prop:", initialStudyHistoryId);
    console.log("File name:", file.name);
    console.log("File size:", file.size);
    
    // Save to session storage whenever studyHistoryId changes
    if (studyHistoryId) {
      const sessionKey = `studyHistoryId_${file.name}_${file.size}`;
      sessionStorage.setItem(sessionKey, studyHistoryId);
      console.log("Saved study history ID to session storage:", studyHistoryId);
    }
  }, [studyHistoryId, initialStudyHistoryId, file.name, file.size]);

  // Enhanced consolidated history save function with better error handling
  const saveConsolidatedHistoryForPage = async (currentPageNum: number, currentPageAnalysis: PageAnalysis) => {
    if (!user) {
      console.log("No user found, skipping study history save");
      return;
    }

    try {
      console.log(`=== Saving Study History for Page ${currentPageNum} ===`);
      console.log("Current studyHistoryId before save:", studyHistoryId);
      
      // Get current page analyses including the newly analyzed page
      const currentPageAnalyses = new Map(pageAnalyses);
      currentPageAnalyses.set(currentPageNum, currentPageAnalysis);
      
      const analyzedPagesList = Array.from(currentPageAnalyses.values()).filter(p => p.isAnalyzed);
      
      if (analyzedPagesList.length === 0) {
        console.log("No analyzed pages found, skipping save");
        return;
      }

      const allKeyPoints = analyzedPagesList.flatMap(page => page.keyPoints);
      const allStudyPoints = analyzedPagesList.flatMap(page => page.studyPoints);

      const combinedSummary = analyzedPagesList
        .map(page => `Page ${page.pageNumber}: ${page.summary}`)
        .join('\n\n');

      const combinedTnpscRelevance = analyzedPagesList
        .map(page => `Page ${page.pageNumber}: ${page.tnpscRelevance}`)
        .join('\n\n');

      const analysisResult = {
        keyPoints: allKeyPoints,
        summary: combinedSummary,
        tnpscRelevance: combinedTnpscRelevance,
        studyPoints: allStudyPoints,
        tnpscCategories: [`PDF Analysis - ${analyzedPagesList.length} pages`],
        mainTopic: `${file.name} - Pages ${analyzedPagesList.map(p => p.pageNumber).sort((a, b) => a - b).join(', ')}`
      };

      const pageAnalysesMapForFirestore: Record<string, any> = {};
      currentPageAnalyses.forEach((analysis, pageNumber) => {
        if (analysis.isAnalyzed) {
          pageAnalysesMapForFirestore[pageNumber.toString()] = analysis;
        }
      });

      if (studyHistoryId) {
        console.log(`Updating existing study history: ${studyHistoryId} for page ${currentPageNum}`);
        await updateStudyHistory(studyHistoryId, analysisResult, pageAnalysesMapForFirestore);
        console.log(`Successfully updated study history: ${studyHistoryId}`);
      } else {
        console.log(`Creating new study history for page ${currentPageNum}`);
        const newId = await saveStudyHistory(
          user.uid,
          "analysis",
          [analysisResult],
          {
            fileName: file.name,
            difficulty: "medium",
            language: outputLanguage,
            pageAnalysesMap: pageAnalysesMapForFirestore,
            files: [file] // Pass the file for hash generation
          }
        );
        
        console.log(`Created new study history with ID: ${newId}`);
        setStudyHistoryId(newId);
        
        // Also save to session storage immediately
        const sessionKey = `studyHistoryId_${file.name}_${file.size}`;
        sessionStorage.setItem(sessionKey, newId);
        console.log("Saved new study history ID to session storage:", newId);
      }
    } catch (error) {
      console.error("Failed to save study history for page:", error);
      toast.error("Failed to save study progress");
    }
  };

  const saveConsolidatedHistory = async () => {
    if (!user) return;

    try {
      const analyzedPagesList = Array.from(pageAnalyses.values()).filter(p => p.isAnalyzed);
      if (analyzedPagesList.length === 0) return;

      const allKeyPoints = analyzedPagesList.flatMap(page => 
        page.keyPoints.map(point => `Page ${page.pageNumber}: ${point}`)
      );
      
      const allStudyPoints = analyzedPagesList.flatMap(page => 
        page.studyPoints.map(point => ({
          ...point,
          title: `Page ${page.pageNumber}: ${point.title}`
        }))
      );

      const combinedSummary = analyzedPagesList
        .map(page => `Page ${page.pageNumber}: ${page.summary}`)
        .join('\n\n');

      const combinedTnpscRelevance = analyzedPagesList
        .map(page => `Page ${page.pageNumber}: ${page.tnpscRelevance}`)
        .join('\n\n');

      const analysisResult = {
        keyPoints: allKeyPoints,
        summary: combinedSummary,
        tnpscRelevance: combinedTnpscRelevance,
        studyPoints: allStudyPoints,
        tnpscCategories: [`PDF Analysis - ${analyzedPagesList.length} pages`],
        mainTopic: `${file.name} - Pages ${analyzedPagesList.map(p => p.pageNumber).sort((a, b) => a - b).join(', ')}`
      };

      const pageAnalysesMapForFirestore: Record<string, any> = {};
      pageAnalyses.forEach((analysis, pageNumber) => {
        if (analysis.isAnalyzed) {
          pageAnalysesMapForFirestore[pageNumber.toString()] = analysis;
        }
      });

      if (studyHistoryId) {
        await updateStudyHistory(studyHistoryId, analysisResult, pageAnalysesMapForFirestore);
      } else {
        const newId = await saveStudyHistory(
          user.uid,
          "analysis",
          [analysisResult],
          {
            fileName: file.name,
            difficulty: "medium",
            language: outputLanguage,
            pageAnalysesMap: pageAnalysesMapForFirestore,
            files: [file] // Pass the file for hash generation
          }
        );
        setStudyHistoryId(newId);
      }
    } catch (error) {
      console.error("Failed to save consolidated study history:", error);
    }
  };
  
  // Enhanced retry logic for API calls to handle 429 errors
  const analyzePage = async (pageNumber: number) => {
    if (pageAnalyses.has(pageNumber) && pageAnalyses.get(pageNumber)?.isAnalyzed) {
      console.log(`Page ${pageNumber} already analyzed, skipping`);
      return;
    }

    console.log(`=== Starting Analysis for Page ${pageNumber} ===`);
    console.log("Current studyHistoryId:", studyHistoryId);
    
    setIsAnalyzing(true);
    
    const maxRetries = 3;
    let delay = 2000; // Start with a 2-second delay

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const pageContent = extractPageRangeFromOcr(fullText, pageNumber, pageNumber);
        
        if (!pageContent.trim()) {
          toast.warning(`Skipping page ${pageNumber} as it has no text content.`);
          // Set a blank analysis to prevent re-analyzing
          const emptyAnalysis: PageAnalysis = {
            pageNumber: pageNumber,
            keyPoints: [],
            studyPoints: [],
            summary: "No text content found on this page.",
            tnpscRelevance: "Not applicable for this page.",
            isAnalyzed: true
          };
          setPageAnalyses(prev => new Map(prev.set(pageNumber, emptyAnalysis)));
          setIsAnalyzing(false);
          return;
        }

        const analysis = await analyzeIndividualPage(pageContent, pageNumber, outputLanguage);
        
        const pageAnalysis: PageAnalysis = { ...analysis, isAnalyzed: true };
        setPageAnalyses(prev => new Map(prev.set(pageNumber, pageAnalysis)));
        
        console.log(`Page ${pageNumber} analysis completed, saving to study history...`);
        
        // Immediately save to study history after each page analysis
        await saveConsolidatedHistoryForPage(pageNumber, pageAnalysis);
        
        toast.success(`Page ${pageNumber} analyzed successfully!`);
        setIsAnalyzing(false);
        return; // Success, exit function
        
      } catch (error: any) {
        console.error(`Attempt ${attempt + 1}: Error analyzing page ${pageNumber}:`, error);

        // Check for 429 status code and if retries are left
        if (error.message && error.message.includes("429") && attempt < maxRetries - 1) {
          toast.info(`Rate limit reached. Retrying page ${pageNumber} in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponentially increase delay
        } else {
          // If it's not a 429 error or we've run out of retries, fail permanently
          toast.error(`Failed to analyze page ${pageNumber} after ${attempt + 1} attempts.`);
          setIsAnalyzing(false);
          throw error; // Propagate the error to be caught by the caller
        }
      }
    }
  };

  useEffect(() => {
    const analyzedCount = Array.from(pageAnalyses.values()).filter(p => p.isAnalyzed).length;
    if (analyzedCount > 0) {
      saveConsolidatedHistory();
    }
  }, [pageAnalyses]);

  const navigateToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      if (!pageAnalyses.has(pageNumber) || !pageAnalyses.get(pageNumber)?.isAnalyzed) {
        analyzePage(pageNumber).catch(err => {
            console.error("Failed to analyze page on navigation:", err);
            // The error toast is already shown inside analyzePage
        });
      }
    }
  };
  
  // Enhanced "Analyze All" function with better error handling
  const analyzeAllPages = async () => {
    console.log("=== Starting Analyze All Pages ===");
    console.log("Current studyHistoryId:", studyHistoryId);
    
    setIsAnalyzing(true);
    let analysisSucceeded = true;
    for (let i = 1; i <= totalPages; i++) {
      if (!pageAnalyses.has(i) || !pageAnalyses.get(i)?.isAnalyzed) {
        try {
          await analyzePage(i);
          // Add a polite delay between successful requests to avoid hitting the limit
          if (i < totalPages) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Permanent failure for page ${i}. Stopping 'Analyze All'.`, error);
          toast.error(`Analysis stopped due to a persistent error on page ${i}. Please try again later.`);
          analysisSucceeded = false;
          break; // Exit the loop on a permanent failure
        }
      }
    }
    
    if (analysisSucceeded) {
        const finalAnalyzedCount = Array.from(pageAnalyses.values()).filter(p => p.isAnalyzed).length;
        if (finalAnalyzedCount === totalPages) {
            toast.success("All pages analyzed successfully!");
        }
    }
    
    setIsAnalyzing(false);
  };

  const handleDownloadPage = async () => {
    if (!currentAnalysis) {
      toast.error("No analysis available for this page");
      return;
    }
    try {
      await downloadPDF({
        title: `Page ${currentPage} Analysis - ${file.name}`,
        content: [currentAnalysis],
        type: 'analysis'
      });
      toast.success("Page analysis downloaded!");
    } catch (error) {
      toast.error("Failed to download analysis");
    }
  };

  const handleStartQuiz = () => {
    const startPage = typeof quizStartPage === 'string' ? 1 : quizStartPage;
    const endPage = typeof quizEndPage === 'string' ? totalPages : quizEndPage;
    onStartQuiz({ start: startPage, end: endPage }, difficulty);
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // Auto-analyze current page on load
  useEffect(() => {
    if (!pageAnalyses.has(currentPage) || !pageAnalyses.get(currentPage)?.isAnalyzed) {
      console.log(`Auto-analyzing current page ${currentPage} on component load`);
      analyzePage(currentPage).catch(err => {
        console.error("Failed to auto-analyze initial page:", err);
      });
    }
  }, []);

  // Clean up session storage when component unmounts
  useEffect(() => {
    return () => {
      // Optional: Clean up session storage on unmount if needed
      // const sessionKey = `studyHistoryId_${file.name}_${file.size}`;
      // sessionStorage.removeItem(sessionKey);
    };
  }, [file.name, file.size]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-3 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <Card className="p-4 bg-white/90 backdrop-blur-sm shadow-xl border-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  onClick={onReset}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-800">
                      {file.name.length > 20 ? file.name.substring(0, 20) + "..." : file.name}
                    </div>
                    <div className="text-xs text-gray-600">{totalPages} pages</div>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Analysis Progress</span>
                  <span>{analyzedPages}/{totalPages} pages</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={analyzeAllPages}
                  disabled={isAnalyzing}
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-xs"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-3 w-3 mr-2" />
                      Analyze All
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleDownloadPage}
                  variant="outline"
                  size="sm"
                  disabled={!currentAnalysis}
                  className="text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </Card>

          {/* Page Navigation */}
          <Card className="p-4 bg-white/90 backdrop-blur-sm shadow-lg border-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  Page {currentPage}
                </h3>
                
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => navigateToPage(currentPage - 1)}
                    disabled={currentPage === 1 || isAnalyzing}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="px-3 py-1 bg-gray-100 rounded text-sm font-medium min-w-[60px] text-center">
                    {currentPage}/{totalPages}
                  </div>
                  
                  <Button
                    onClick={() => navigateToPage(currentPage + 1)}
                    disabled={currentPage === totalPages || isAnalyzing}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Page Jump */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Jump to:</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={quizEndPage}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setQuizEndPage('');
                    } else {
                      const startPageNum = typeof quizStartPage === 'string' ? 1 : quizStartPage;
                      setQuizEndPage(Math.max(startPageNum, Math.min(totalPages, parseInt(value) || startPageNum)));
                    }
                  }}
                    const value = e.target.value;
                    if (value === '') {
                      setQuizStartPage('');
                    } else {
                      setQuizStartPage(Math.max(1, Math.min(totalPages, parseInt(value) || 1)));
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigateToPage(parseInt(e.currentTarget.value) || 1) }}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                />
                <Button
                  onClick={() => analyzePage(currentPage).catch(() => {})}
                  disabled={isAnalyzing || (currentAnalysis?.isAnalyzed)}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  {currentAnalysis?.isAnalyzed ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                      Done
                    </>
                  ) : (
                    <>
                      <Brain className="h-3 w-3 mr-1" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* Page Analysis Results */}
          {currentAnalysis && currentAnalysis.isAnalyzed ? (
            <div className="space-y-4">
              {/* Summary */}
              <Card className="p-4 bg-white/90 backdrop-blur-sm shadow-lg border-0">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-600" />
                    Page Summary
                  </h4>
                  <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 p-3 rounded-lg">
                    {currentAnalysis.summary}
                  </p>
                </div>
              </Card>

              {/* TNPSC Relevance */}
              <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 shadow-lg border-0">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Award className="h-4 w-4 text-purple-600" />
                    TNPSC Relevance
                  </h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {currentAnalysis.tnpscRelevance}
                  </p>
                </div>
              </Card>

              {/* Key Points */}
              <Card className="p-4 bg-white/90 backdrop-blur-sm shadow-lg border-0">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                    Key Points ({currentAnalysis.keyPoints.length})
                  </h4>
                  <div className="space-y-2">
                    {currentAnalysis.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg">
                        <div className="w-5 h-5 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Study Points */}
              {currentAnalysis.studyPoints.length > 0 && (
                <Card className="p-4 bg-white/90 backdrop-blur-sm shadow-lg border-0">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      Detailed Study Points ({currentAnalysis.studyPoints.length})
                    </h4>
                    <div className="space-y-3">
                      {currentAnalysis.studyPoints.map((point, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-gray-800 text-sm">{point.title}</h5>
                            <Badge className={`${getImportanceColor(point.importance)} border text-xs`}>
                              {point.importance}
                            </Badge>
                          </div>
                          <p className="text-gray-600 text-sm mb-2 leading-relaxed">{point.description}</p>
                          {point.tnpscRelevance && (
                            <div className="bg-blue-50 p-2 rounded border-l-2 border-blue-400">
                              <p className="text-xs text-blue-700 font-medium mb-1">TNPSC Context:</p>
                              <p className="text-xs text-blue-600 leading-relaxed">{point.tnpscRelevance}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <Card className="p-8 bg-white/90 backdrop-blur-sm shadow-lg border-0">
              <div className="text-center">
                {isAnalyzing ? (
                  <div className="space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600">Analyzing page {currentPage}...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Brain className="h-12 w-12 text-gray-400 mx-auto" />
                    <p className="text-gray-600">Click "Analyze" to get insights for this page</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Quiz Generation */}
          <Card className="p-4 bg-gradient-to-r from-green-50 to-blue-50 shadow-lg border-0">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-600" />
                Generate Practice Quiz
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Page</label>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={quizStartPage}
                    onChange={(e) => setQuizStartPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Page</label>
                  <input
                    type="number"
                    min={quizStartPage}
                    max={totalPages}
                    value={quizEndPage}
                    onChange={(e) => setQuizEndPage(Math.max(quizStartPage, Math.min(totalPages, parseInt(e.target.value) || quizStartPage)))}
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                  <option value="very-hard">⚫ Very Hard</option>
                </select>
              </div>

              <div className="bg-white/70 p-3 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center text-sm mb-3">
                  <div>
                    <div className="text-lg font-bold text-blue-600">{quizEndPage - quizStartPage + 1}</div>
                    <div className="text-gray-600">Pages</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{Math.max(5, (quizEndPage - quizStartPage + 1) * 2)}</div>
                    <div className="text-gray-600">Questions</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-purple-600">{difficulty.toUpperCase()}</div>
                    <div className="text-gray-600">Level</div>
                  </div>
                </div>
                
                <Button
                  onClick={handleStartQuiz}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Start Quiz (Pages {quizStartPage}-{quizEndPage})
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PdfPageNavigator;
