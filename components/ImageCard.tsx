
import React, { useState } from 'react';
import { ImageRecord } from '../types';

interface ImageCardProps {
  image: ImageRecord;
  onClick: (image: ImageRecord) => void;
  onRemove: (id: string) => void;
  onLike: (id: string) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, onClick, onRemove, onLike }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(image.id);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(image.id);
  };

  const hasMetadata = !!(image.metadata && image.metadata.positive_prompt);

  return (
    <div 
      onClick={() => onClick(image)}
      className="group relative bg-slate-900/60 rounded-xl overflow-hidden border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer shadow-xl h-full flex flex-col"
    >
      <div className="aspect-square bg-slate-950 flex items-center justify-center overflow-hidden relative">
        {!isLoaded && (
          <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center">
             <svg className="w-8 h-8 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
          </div>
        )}
        <img 
          src={image.previewUrl} 
          alt={image.name}
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
        />
        
        {/* Like Button */}
        <button
          onClick={handleLike}
          className={`absolute bottom-2 left-2 p-2 rounded-lg backdrop-blur-md transition-all z-20 shadow-lg border ${image.isLiked ? 'bg-pink-600 border-pink-500 text-white' : 'bg-black/40 border-white/10 text-white/60 hover:text-white group-hover:bg-black/60'}`}
          title={image.isLiked ? 'Rename export' : 'Like and rename'}
        >
          <svg className={`w-4 h-4 ${image.isLiked ? 'fill-current' : 'fill-none stroke-current'}`} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {!hasMetadata && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-[9px] font-black text-white uppercase tracking-tighter rounded-md shadow-lg z-10 ring-1 ring-red-400/50">
            No Prompt
          </div>
        )}
      </div>
      
      <div className="p-4 flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-bold text-slate-300 truncate mb-1" title={image.name}>
          {image.customName || image.name}
        </h3>
        {image.customName && (
          <p className="text-[9px] text-slate-500 truncate mb-1 italic">
            Original: {image.name}
          </p>
        )}
        
        {hasMetadata ? (
          <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed flex-1 italic">
            {image.metadata?.positive_prompt}
          </p>
        ) : (
          <p className="text-[10px] text-red-900 font-bold uppercase tracking-widest mt-1 flex-1">
            Missing Meta
          </p>
        )}

        <div className="mt-3 flex items-center gap-1.5 flex-wrap overflow-hidden">
          {image.metadata?.model?.name && (
            <span className="px-1.5 py-0.5 bg-blue-500/10 text-[9px] font-bold text-blue-400 rounded border border-blue-500/20 truncate max-w-[120px]">
              {image.metadata.model.name}
            </span>
          )}
          {image.metadata?.steps && (
            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-[9px] font-bold text-emerald-400 rounded border border-emerald-500/20">
              S:{image.metadata.steps}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleRemove}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg shadow-xl z-20"
        title="Remove from list"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/20 pointer-events-none rounded-xl transition-all"></div>
    </div>
  );
};

export default ImageCard;
