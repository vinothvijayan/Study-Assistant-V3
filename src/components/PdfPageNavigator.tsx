import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Zap, BookOpen, Download, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { generateQuestions } from '../services/geminiService';
import { downloadPDF } from '../utils/pdfUtils';

interface PdfPageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  analysisResults?: any;
  pdfFile?: File;
  onStartQuiz?: (questions: any[], startPage: number, endPage: number, difficulty: string) => void;
}

export const PdfPageNavigator: React.FC<PdfPageNavigatorProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  analysisResults,
  pdfFile,
  onStartQuiz
}) => {
  const [quizStartPage, setQuizStartPage] = useState<number | string>(1);
  const [quizEndPage, setQuizEndPage] = useState<number | string>(totalPages);
  const [difficulty, setDifficulty] = useState('medium');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setQuizEndPage(totalPages);
  }, [totalPages]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageInputChange = (value: string) => {
    const pageNum = parseInt(value);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    }
  };

  const handleQuizStartPageChange = (value: string) => {
    if (value === '') {
      setQuizStartPage('');
    } else {
      const pageNum = parseInt(value);
      if (!isNaN(pageNum)) {
        setQuizStartPage(Math.max(1, Math.min(pageNum, totalPages)));
      }
    }
  };

  const handleQuizEndPageChange = (value: string) => {
    if (value === '') {
      setQuizEndPage('');
    } else {
      const pageNum = parseInt(value);
      if (!isNaN(pageNum)) {
        setQuizEndPage(Math.max(1, Math.min(pageNum, totalPages)));
      }
    }
  };

  const handleGenerateQuiz = async () => {
    if (!analysisResults || !onStartQuiz) return;

    const startPage = typeof quizStartPage === 'string' ? 1 : quizStartPage;
    const endPage = typeof quizEndPage === 'string' ? totalPages : quizEndPage;

    if (startPage > endPage) {
      alert('Start page cannot be greater than end page');
      return;
    }

    setIsGeneratingQuiz(true);
    try {
      const questions = await generateQuestions(analysisResults, difficulty, 5);
      onStartQuiz(questions, startPage, endPage, difficulty);
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Failed to generate quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!analysisResults) return;

    setIsDownloading(true);
    try {
      await downloadPDF(analysisResults, pdfFile?.name || 'analysis');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const getPageRangeText = () => {
    const startPage = typeof quizStartPage === 'string' ? 1 : quizStartPage;
    const endPage = typeof quizEndPage === 'string' ? totalPages : quizEndPage;
    const pageCount = Math.max(0, endPage - startPage + 1);
    return `${pageCount} Page${pageCount !== 1 ? 's' : ''}`;
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Page</span>
              <Input
                type="number"
                value={currentPage}
                onChange={(e) => handlePageInputChange(e.target.value)}
                className="w-16 text-center"
                min={1}
                max={totalPages}
              />
              <span className="text-sm text-gray-600">of {totalPages}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Actions */}
      {analysisResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quiz Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Zap className="w-5 h-5 mr-2 text-blue-600" />
                Generate Practice Quiz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    From Page
                  </label>
                  <Input
                    type="number"
                    value={quizStartPage}
                    onChange={(e) => handleQuizStartPageChange(e.target.value)}
                    min={1}
                    max={totalPages}
                    className="text-center"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    To Page
                  </label>
                  <Input
                    type="number"
                    value={quizEndPage}
                    onChange={(e) => handleQuizEndPageChange(e.target.value)}
                    min={1}
                    max={totalPages}
                    className="text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Difficulty
                </label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                        Easy
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                        Medium
                      </div>
                    </SelectItem>
                    <SelectItem value="hard">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                        Hard
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <div className="text-center">
                  <div className="font-semibold text-blue-600 text-lg">
                    {getPageRangeText().split(' ')[0]}
                  </div>
                  <div>Pages</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600 text-lg">5</div>
                  <div>Questions</div>
                </div>
                <div className="text-center">
                  <Badge className={getDifficultyColor(difficulty)}>
                    {difficulty.toUpperCase()}
                  </Badge>
                  <div className="mt-1">Level</div>
                </div>
              </div>

              <Button
                onClick={handleGenerateQuiz}
                disabled={isGeneratingQuiz}
                className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
              >
                {isGeneratingQuiz ? (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                    Generating Quiz...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Start Quiz ({getPageRangeText().split(' ')[0]}-{typeof quizEndPage === 'string' ? totalPages : quizEndPage})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Download PDF */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <BookOpen className="w-5 h-5 mr-2 text-green-600" />
                Study Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                Download your analysis results as a formatted PDF for offline study.
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="font-semibold text-blue-600">
                      {analysisResults.keyPoints?.length || 0}
                    </div>
                    <div className="text-gray-600">Key Points</div>
                  </div>
                  <div>
                    <div className="font-semibold text-green-600">
                      {analysisResults.studyPoints?.length || 0}
                    </div>
                    <div className="text-gray-600">Study Points</div>
                  </div>
                  <div>
                    <div className="font-semibold text-purple-600">PDF</div>
                    <div className="text-gray-600">Format</div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                variant="outline"
                className="w-full border-green-200 hover:bg-green-50"
              >
                {isDownloading ? (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                    Preparing PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Study PDF
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};