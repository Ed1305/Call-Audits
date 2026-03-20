import React from 'react';
import { CallAnalysis } from '../types';
import { CheckCircle2, AlertTriangle, User, Hash, PhoneCall, Target, TrendingUp, MessageSquare, HelpCircle, Activity } from 'lucide-react';

interface Props {
  data: CallAnalysis;
}

export function AnalysisReport({ data }: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getDispositionColor = (disp: string) => {
    switch (disp) {
      case 'SALE': return 'bg-green-100 text-green-800 border-green-200';
      case 'CALLBK': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DNC':
      case 'DNQ': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 space-y-6 pb-12">
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Agent Name</p>
            <p className="text-lg font-semibold text-gray-900">{data.agentName || 'Unknown'}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
          <div className="bg-purple-50 p-3 rounded-lg text-purple-600 mt-1">
            <Hash className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500 font-medium">Employee Code</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-gray-900">{data.employeeCode || 'N/A'}</p>
              {data.employeeCodeValid ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className={`text-xs mt-1 ${data.employeeCodeValid ? 'text-green-600' : 'text-red-600'}`}>
              {data.employeeCodeFeedback}
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-start gap-4">
          <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 mt-1">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500 font-medium">Disposition</p>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-semibold border mt-1 ${getDispositionColor(data.disposition)}`}>
              {data.disposition}
            </span>
            {data.dispositionFeedback && data.dispositionFeedback !== "Valid disposition." && (
              <p className="text-xs mt-2 text-yellow-600 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{data.dispositionFeedback}</span>
              </p>
            )}
          </div>
        </div>

        <div className={`border rounded-xl p-5 shadow-sm flex items-center gap-4 ${getScoreColor(data.overallScore)}`}>
          <div className="bg-white/50 p-3 rounded-lg mix-blend-multiply">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium opacity-80">Overall Score</p>
            <p className="text-3xl font-bold">{data.overallScore}<span className="text-lg opacity-60">/100</span></p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          Call Summary
        </h3>
        <p className="text-gray-700 leading-relaxed">{data.summary}</p>
      </div>

      {/* Feedback Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            What Went Wrong
          </h3>
          <p className="text-red-800 leading-relaxed">{data.whatWentWrong}</p>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            What Could Have Been Done
          </h3>
          <p className="text-green-800 leading-relaxed">{data.whatCouldHaveBeenDone}</p>
        </div>
      </div>

      {/* Deep Analysis */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Deep Analysis</h3>
        </div>
        <div className="divide-y divide-gray-100">
          
          <AnalysisRow 
            title="Pitch" 
            icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
            content={data.analysis.pitch} 
          />
          <AnalysisRow 
            title="Attitude" 
            icon={<User className="w-5 h-5 text-purple-500" />}
            content={data.analysis.attitude} 
          />
          <AnalysisRow 
            title="Need Creating" 
            icon={<Target className="w-5 h-5 text-orange-500" />}
            content={data.analysis.needCreating} 
          />
          <AnalysisRow 
            title="Discovery Questions" 
            icon={<HelpCircle className="w-5 h-5 text-teal-500" />}
            content={data.analysis.discoveryQuestions} 
          />
          <AnalysisRow 
            title="Qualifying Questions" 
            icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
            content={data.analysis.qualifyingQuestions} 
          />

          {data.toneAnalysis && (
            <>
              <AnalysisRow 
                title="Overall Tone" 
                icon={<MessageSquare className="w-5 h-5 text-indigo-500" />}
                content={data.toneAnalysis.overallTone} 
              />
              <AnalysisRow 
                title="Energy & Pacing" 
                icon={<Activity className="w-5 h-5 text-pink-500" />}
                content={`Energy: ${data.toneAnalysis.energyLevel} | Pacing: ${data.toneAnalysis.pacing}`} 
              />
              <AnalysisRow 
                title="Empathy & Coaching" 
                icon={<Target className="w-5 h-5 text-rose-500" />}
                content={
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">Empathy Score: {data.toneAnalysis.empathyScore}/100</span>
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-rose-500 h-2 rounded-full" 
                          style={{ width: `${data.toneAnalysis.empathyScore}%` }}
                        ></div>
                      </div>
                    </div>
                    <p>{data.toneAnalysis.coachingFeedback}</p>
                  </div>
                } 
              />
            </>
          )}

        </div>
      </div>

      {/* Conversation Flow (Transcript) */}
      {data.transcript && data.transcript.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Conversation Flow
            </h3>
          </div>
          <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
            {data.transcript.map((turn, index) => {
              const isAgent = turn.speaker.toLowerCase().includes('agent');
              return (
                <div key={index} className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                  <span className={`text-xs font-semibold mb-1 px-1 ${isAgent ? 'text-blue-600' : 'text-gray-500'}`}>
                    {turn.speaker}
                  </span>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    isAgent 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    <p className="text-sm leading-relaxed">{turn.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

function AnalysisRow({ title, icon, content }: { title: string, icon: React.ReactNode, content: React.ReactNode }) {
  return (
    <div className="p-6 flex flex-col sm:flex-row gap-4 hover:bg-gray-50 transition-colors">
      <div className="sm:w-1/4 flex items-center gap-3 font-medium text-gray-900">
        {icon}
        {title}
      </div>
      <div className="sm:w-3/4 text-gray-700 leading-relaxed">
        {content}
      </div>
    </div>
  );
}
