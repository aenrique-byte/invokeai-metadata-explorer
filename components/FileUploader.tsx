
import React, { useRef } from 'react';

interface FileUploaderProps {
  onFilesSelected: (files: FileList | File[]) => void;
  isProcessing: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    if (e.dataTransfer.files) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer
          ${isProcessing ? 'border-gray-600 opacity-50 cursor-not-allowed' : 'border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/5'}
        `}
      >
        <input
          type="file"
          multiple
          accept="image/png"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => e.target.files && onFilesSelected(e.target.files)}
          disabled={isProcessing}
        />
        {/* Fix: use object spread with any cast to satisfy TypeScript for non-standard folder upload attributes */}
        <input
          type="file"
          {...({ webkitdirectory: "", directory: "" } as any)}
          className="hidden"
          ref={folderInputRef}
          onChange={(e) => e.target.files && onFilesSelected(e.target.files)}
          disabled={isProcessing}
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-blue-500/20 rounded-full">
            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-slate-100">
              {isProcessing ? 'Analyzing Library...' : 'Access Your Local Collection'}
            </p>
            <p className="text-slate-400 mt-2 max-w-xs">
              Select a folder to analyze thousands of images instantly. All processing happens <b>locally</b> in your browser.
            </p>
          </div>

          {!isProcessing && (
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-900/40 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
                Select Folder
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-all border border-slate-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/></svg>
                Select Files
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
        <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L10 .155 17.834 4.9a2 2 0 011.166 1.81V13.5a2 2 0 01-1.166 1.81L10 20.134l-7.834-4.824a2 2 0 01-1.166-1.81V6.71a2 2 0 011.166-1.81zM10 2.31L4 5.99v7.926l6 3.696 6-3.696V5.99l-6-3.68z" clipRule="evenodd"/></svg>
        Private • 100% Client-Side Extraction
      </div>
    </div>
  );
};

export default FileUploader;
