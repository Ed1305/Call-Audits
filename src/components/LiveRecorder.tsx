import { Mic, Square, Loader2, Radio } from 'lucide-react';
import { useState, useRef } from 'react';

interface Props {
  onAnalyze: (base64: string, mimeType: string, fileName?: string) => void;
  isAnalyzing: boolean;
}

export function LiveRecorder({ onAnalyze, isAnalyzing }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          onAnalyze(base64String, 'audio/webm');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 flex flex-col items-center">
        
        <div className="mb-8 relative">
          {isRecording && (
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20 scale-150"></div>
          )}
          <div className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
            isRecording ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
          }`}>
            <Mic className="w-10 h-10" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {isRecording ? 'Recording Live Call...' : 'Real-Time Call Audit'}
          </h3>
          <p className="text-gray-500 font-mono text-2xl">
            {formatTime(recordingTime)}
          </p>
        </div>

        <div className="flex gap-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isAnalyzing}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Radio className="w-5 h-5" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-full font-medium transition-colors flex items-center gap-2"
            >
              <Square className="w-5 h-5 fill-current" />
              Stop & Analyze
            </button>
          )}
        </div>

        {isAnalyzing && (
          <div className="mt-6 flex items-center gap-2 text-blue-600 font-medium">
            <Loader2 className="w-5 h-5 animate-spin" />
            Analyzing Call...
          </div>
        )}
      </div>
    </div>
  );
}
