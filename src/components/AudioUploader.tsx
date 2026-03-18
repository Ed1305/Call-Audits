import { UploadCloud, FileAudio, Loader2 } from 'lucide-react';
import React, { useState, useRef } from 'react';

interface Props {
  onAnalyze: (base64: string, mimeType: string, fileName?: string) => void;
  isAnalyzing: boolean;
}

export function AudioUploader({ onAnalyze, isAnalyzing }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
    } else {
      alert("Please upload an audio file.");
    }
  };

  const submitAnalysis = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      onAnalyze(base64String, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <div 
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
          dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={handleChange}
          className="hidden"
        />
        
        {file ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-blue-100 p-4 rounded-full">
              <FileAudio className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-gray-100 p-4 rounded-full">
              <UploadCloud className="w-8 h-8 text-gray-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Click to upload or drag and drop</p>
              <p className="text-sm text-gray-500">MP3, WAV, M4A up to 50MB</p>
            </div>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={submitAnalysis}
            disabled={isAnalyzing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Call...
              </>
            ) : (
              'Run Deep Analysis'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
