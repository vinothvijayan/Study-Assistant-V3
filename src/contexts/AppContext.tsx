
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AnalysisResult, QuestionResult } from '@/components/StudyAssistant';

interface AppContextType {
  selectedFiles: File[];
  setSelectedFiles: (files: File[]) => void;
  analysisResults: AnalysisResult[];
  setAnalysisResults: (results: AnalysisResult[]) => void;
  questionResult: QuestionResult | null;
  setQuestionResult: (result: QuestionResult | null) => void;
  difficulty: string;
  setDifficulty: (difficulty: string) => void;
  outputLanguage: "english" | "tamil";
  setOutputLanguage: (language: "english" | "tamil") => void;
  clearAppState: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [questionResult, setQuestionResult] = useState<QuestionResult | null>(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [outputLanguage, setOutputLanguage] = useState<"english" | "tamil">("english");

  const clearAppState = () => {
    setSelectedFiles([]);
    setAnalysisResults([]);
    setQuestionResult(null);
    setDifficulty("medium");
    setOutputLanguage("english");
  };

  return (
    <AppContext.Provider value={{
      selectedFiles,
      setSelectedFiles,
      analysisResults,
      setAnalysisResults,
      questionResult,
      setQuestionResult,
      difficulty,
      setDifficulty,
      outputLanguage,
      setOutputLanguage,
      clearAppState
    }}>
      {children}
    </AppContext.Provider>
  );
};
