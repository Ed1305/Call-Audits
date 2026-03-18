import { useState } from 'react';
import { Header } from './components/Header';
import { AudioUploader } from './components/AudioUploader';
import { LiveRecorder } from './components/LiveRecorder';
import { AnalysisReport } from './components/AnalysisReport';
import { HistoryList } from './components/HistoryList';
import { analyzeCallAudio } from './services/geminiService';
import { saveAnalysis } from './services/storageService';
import { CallAnalysis, SavedAnalysis } from './types';
import { FileAudio, Mic, History } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'live' | 'history'>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CallAnalysis | null>(null);
  const [currentAudio, setCurrentAudio] = useState<{ base64: string; mimeType: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (base64: string, mimeType: string, fileName?: string) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeCallAudio(base64, mimeType, fileName);
      setAnalysisResult(result);
      setCurrentAudio({ base64, mimeType });
      await saveAnalysis(result, base64, mimeType, fileName);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze audio. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleViewHistory = (record: SavedAnalysis) => {
    setAnalysisResult(record.analysis);
    setCurrentAudio({ base64: record.audioBase64, mimeType: record.mimeType });
  };

  const handleStartNew = () => {
    setAnalysisResult(null);
    setCurrentAudio(null);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {!analysisResult && (
          <div className="flex flex-col items-center justify-center mb-8 gap-4">
            <div className="bg-gray-100 p-1 rounded-xl inline-flex">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === 'upload' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileAudio className="w-4 h-4" />
                Upload Audio
              </button>
              <button
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === 'live' 
                    ? 'bg-white text-red-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Mic className="w-4 h-4" />
                Live Record
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === 'history' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <History className="w-4 h-4" />
                History
              </button>
            </div>

            {isAnalyzing && (
              <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-4 py-2 rounded-full font-medium text-sm border border-blue-100 shadow-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                Real-time analysis active...
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {!analysisResult && (
          <div className="transition-all duration-300">
            {activeTab === 'upload' && (
              <AudioUploader onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
            )}
            {activeTab === 'live' && (
              <LiveRecorder onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
            )}
            {activeTab === 'history' && (
              <HistoryList onView={handleViewHistory} />
            )}
          </div>
        )}

        {analysisResult && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center max-w-5xl mx-auto mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Audit Results</h2>
              <button 
                onClick={handleStartNew}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Back to Dashboard
              </button>
            </div>
            
            {currentAudio && (
              <div className="max-w-5xl mx-auto mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Call Audio Recording</p>
                <audio 
                  controls 
                  className="w-full h-10" 
                  src={`data:${currentAudio.mimeType};base64,${currentAudio.base64}`} 
                />
              </div>
            )}

            <AnalysisReport data={analysisResult} />
          </div>
        )}

      </main>
    </div>
  );
}
