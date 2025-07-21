import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowLeft, Settings } from "lucide-react";

interface PageRangeQuizSelectorProps {
  totalPages: number;
  onGenerateQuiz: (startPage: number, endPage: number, difficulty: string) => void;
  onBack: () => void;
  isGeneratingQuestions: boolean;
  fileName: string;
}

const PageRangeQuizSelector = ({
  totalPages,
  onGenerateQuiz,
  onBack,
  isGeneratingQuestions,
  fileName
}: PageRangeQuizSelectorProps) => {
  const [selectedRange, setSelectedRange] = useState({ start: 1, end: Math.min(5, totalPages) });
  const [difficulty, setDifficulty] = useState<string>("medium");

  const handleGenerateQuiz = () => {
    onGenerateQuiz(selectedRange.start, selectedRange.end, difficulty);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6 relative z-10">
          <Card className="glass-card p-6 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-6">
              <Button
                onClick={onBack}
                variant="ghost"
                className="text-gray-600 hover:text-gray-800 p-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>

            <div className="text-center mb-8">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full w-fit mx-auto mb-4">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold gradient-text mb-2">
                Generate Practice Quiz
              </h1>
              <p className="text-gray-600">
                Select page range and difficulty for your quiz
              </p>
              <Badge className="badge-elegant badge-success mt-2">
                {fileName}
              </Badge>
            </div>

            <div className="space-y-6">
              {/* Page Range Selection */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  📖 Page Range Selection
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Page
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={selectedRange.start}
                      onChange={(e) => setSelectedRange(prev => ({ 
                        ...prev, 
                        start: Math.max(1, Math.min(parseInt(e.target.value) || 1, totalPages)) 
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      To Page
                    </label>
                    <input
                      type="number"
                      min={selectedRange.start}
                      max={totalPages}
                      value={selectedRange.end}
                      onChange={(e) => setSelectedRange(prev => ({ 
                        ...prev, 
                        end: Math.max(prev.start, Math.min(parseInt(e.target.value) || prev.start, totalPages)) 
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Selected: {selectedRange.end - selectedRange.start + 1} pages (Total available: {totalPages})
                </p>
              </div>

              {/* Difficulty Selection */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-purple-600" />
                  Difficulty Level
                </h3>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="easy">🟢 Easy - Basic concepts and facts</option>
                  <option value="medium">🟡 Medium - Standard TNPSC level</option>
                  <option value="hard">🔴 Hard - Advanced analysis</option>
                  <option value="very-hard">⚫ Very Hard - Expert level</option>
                </select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateQuiz}
                disabled={isGeneratingQuestions}
                className="w-full btn-primary py-4 text-lg font-bold"
              >
                {isGeneratingQuestions ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Generating Quiz Questions...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-3" />
                    Generate Quiz ({selectedRange.end - selectedRange.start + 1} pages)
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PageRangeQuizSelector;