import React, { useEffect, useState } from 'react';
import { SavedAnalysis } from '../types';
import { getAllAnalyses, deleteAnalysis, purgeAnalyses } from '../services/storageService';
import { Trash2, Eye, Calendar, User, Activity, Clock, AlertOctagon, X } from 'lucide-react';

interface Props {
  onView: (analysis: SavedAnalysis) => void;
}

export function HistoryList({ onView }: Props) {
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getAllAnalyses();
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteAnalysis(deleteId);
      setDeleteId(null);
      await loadHistory();
    }
  };

  const confirmPurge = async () => {
    await purgeAnalyses();
    setShowPurgeConfirm(false);
    await loadHistory();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No history yet</h3>
        <p className="text-gray-500 mt-1">Processed audio analyses will appear here.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 relative">
      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Record</h3>
              <button onClick={() => setDeleteId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this record? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertOctagon className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Purge All History</h3>
              </div>
              <button onClick={() => setShowPurgeConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">WARNING: Are you sure you want to purge ALL history? This will permanently delete all saved analyses and cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowPurgeConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmPurge}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Purge All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Analysis History</h3>
          <button
            onClick={() => setShowPurgeConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
          >
            <AlertOctagon className="w-4 h-4" />
            Purge All
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {history.map((record) => (
            <div 
              key={record.id} 
              className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onView(record)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-base font-semibold text-gray-900 truncate">
                    {record.fileName}
                  </h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    record.analysis.overallScore >= 80 ? 'bg-green-100 text-green-800 border-green-200' :
                    record.analysis.overallScore >= 60 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                    'bg-red-100 text-red-800 border-red-200'
                  }`}>
                    Score: {record.analysis.overallScore}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(record.timestamp).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    {record.analysis.agentName || 'Unknown'} ({record.analysis.employeeCode || 'N/A'})
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    {record.analysis.disposition}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(record);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View Details"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(record.id);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Record"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
