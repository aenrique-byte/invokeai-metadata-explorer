
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ImageRecord, FilterState } from './types';
import { extractInvokeAIMetadata, extractTagsFromPrompt } from './services/pngMetadataService';
import FileUploader from './components/FileUploader';
import ImageCard from './components/ImageCard';
import JSZip from 'jszip';

const ITEMS_PER_PAGE = 48;

const App: React.FC = () => {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    selectedTags: [],
    models: [],
    onlyLiked: false,
    dateFrom: null,
    dateTo: null
  });
  const [tagSearch, setTagSearch] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const includeSubfoldersRef = useRef(includeSubfolders);

  // Keep ref in sync with state
  useEffect(() => {
    includeSubfoldersRef.current = includeSubfolders;
  }, [includeSubfolders]);

  const selectedImage = useMemo(() => 
    selectedImageId ? images.find(img => img.id === selectedImageId) || null : null
  , [selectedImageId, images]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [filters]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setIsProcessing(true);

    const shouldIncludeSubfolders = includeSubfoldersRef.current;

    // Filter for PNG files and optionally exclude files from subfolders
    const fileArray = Array.from(files).filter(f => {
      if (!f.name.toLowerCase().endsWith('.png')) return false;

      // Check if file has webkitRelativePath (folder upload)
      const relativePath = (f as any).webkitRelativePath;
      if (relativePath && !shouldIncludeSubfolders) {
        // Only include files directly in the selected folder (no subdirectories)
        // Split by both forward slash and backslash for Windows compatibility
        const pathParts = relativePath.split(/[/\\]/);
        console.log(`Checking: ${relativePath}, parts: ${pathParts.length}`);
        return pathParts.length === 2; // [folderName, fileName]
      }

      // For individual file uploads or when includeSubfolders is true, always include
      return true;
    });

    console.log(`Processing ${fileArray.length} PNG files from ${files.length} total files (subfolders: ${shouldIncludeSubfolders ? 'included' : 'excluded'})`);
    const totalCount = fileArray.length;
    setProgress({ current: 0, total: totalCount });

    const CHUNK_SIZE = 30; 
    const processedImages: ImageRecord[] = [];

    for (let i = 0; i < totalCount; i += CHUNK_SIZE) {
      const chunk = fileArray.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(chunk.map(async (file) => {
        try {
          const metadata = await extractInvokeAIMetadata(file);
          const tags = extractTagsFromPrompt(metadata?.positive_prompt);
          
          return {
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            metadata,
            name: file.name,
            size: file.size,
            tags,
            isLiked: false,
            lastModified: file.lastModified
          } as ImageRecord;
        } catch (err) {
          return null;
        }
      }));

      const validResults = results.filter((r): r is ImageRecord => r !== null);
      processedImages.push(...validResults);
      
      setProgress({ current: Math.min(i + CHUNK_SIZE, totalCount), total: totalCount });
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    setImages(prev => [...prev, ...processedImages]);
    setIsProcessing(false);
  }, []);

  const removeSingleImage = useCallback((id: string) => {
    setImages(prev => {
      const target = prev.find(img => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(img => img.id !== id);
    });
    if (selectedImageId === id) setSelectedImageId(null);
  }, [selectedImageId]);

  const toggleLike = useCallback((id: string) => {
    const targetImage = images.find(img => img.id === id);
    if (!targetImage) return;

    const newIsLiked = !targetImage.isLiked;

    // If we are liking the image, prompt for a name first
    if (newIsLiked) {
      const defaultName = targetImage.customName || targetImage.name.replace(/\.[^/.]+$/, "");
      const inputName = window.prompt('Rename image for export?', defaultName);

      // If user cancelled, don't toggle the like
      if (inputName === null) return;

      const customName = inputName.trim();

      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, isLiked: true, customName } : img
      ));
    } else {
      // Just unlike without prompting
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, isLiked: false } : img
      ));
    }
  }, [images]);

  const metadataLessCount = useMemo(() => 
    images.filter(img => !img.metadata || !img.metadata.positive_prompt).length
  , [images]);

  const removeMetadataLess = () => {
    if (metadataLessCount === 0) return;
    if (confirm(`Remove ${metadataLessCount} images missing InvokeAI metadata from the view?`)) {
      setImages(prev => {
        const toKeep = prev.filter(img => img.metadata && img.metadata.positive_prompt);
        const toRemove = prev.filter(img => !img.metadata || !img.metadata.positive_prompt);
        toRemove.forEach(img => URL.revokeObjectURL(img.previewUrl));
        return toKeep;
      });
    }
  };

  const filteredImages = useMemo(() => {
    const searchLower = filters.search.toLowerCase();
    return images.filter(img => {
      const matchesSearch = !filters.search || 
        img.name.toLowerCase().includes(searchLower) ||
        (img.customName && img.customName.toLowerCase().includes(searchLower)) ||
        (img.metadata?.positive_prompt && img.metadata.positive_prompt.toLowerCase().includes(searchLower));
      
      const matchesTags = filters.selectedTags.length === 0 || 
        filters.selectedTags.every(t => img.tags.includes(t));

      const matchesModel = filters.models.length === 0 ||
        (img.metadata?.model?.name && filters.models.includes(img.metadata.model.name));

      const matchesLiked = !filters.onlyLiked || img.isLiked;

      // Date filtering
      let matchesDate = true;
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && img.lastModified >= fromDate.getTime();
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && img.lastModified <= toDate.getTime();
      }

      return matchesSearch && matchesTags && matchesModel && matchesLiked && matchesDate;
    });
  }, [images, filters]);

  useEffect(() => {
    if (!selectedImageId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = filteredImages.findIndex(img => img.id === selectedImageId);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowRight' && currentIndex < filteredImages.length - 1) {
        setSelectedImageId(filteredImages[currentIndex + 1].id);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setSelectedImageId(filteredImages[currentIndex - 1].id);
      } else if (e.key === 'Escape') {
        setSelectedImageId(null);
      } else if (e.key === 'l' || e.key === 'L') {
        toggleLike(selectedImageId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, filteredImages, toggleLike]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 1200) {
      if (visibleCount < filteredImages.length) {
        setVisibleCount(prev => prev + ITEMS_PER_PAGE);
      }
    }
  };

  const exportLikedAsWebp = async () => {
    const liked = images.filter(img => img.isLiked);
    if (liked.length === 0) {
      alert("No liked images to export!");
      return;
    }

    if (!confirm(`Export ${liked.length} images as WEBPs (Lossy, 85% quality) in a ZIP file?`)) return;

    setIsExporting(true);
    setProgress({ current: 0, total: liked.length });

    const zip = new JSZip();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < liked.length; i++) {
      const imgRec = liked[i];
      setProgress({ current: i + 1, total: liked.length });

      try {
        const blob = await new Promise<Blob | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob((b) => resolve(b), 'image/webp', 0.85);
          };
          img.onerror = () => resolve(null);
          img.src = imgRec.previewUrl;
        });

        if (blob) {
          const finalFileName = imgRec.customName || imgRec.name.replace(/\.[^/.]+$/, "");
          zip.file(`${finalFileName}.webp`, blob);
        }
      } catch (err) {
        console.error("Export failed for", imgRec.name, err);
      }
    }

    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invokeai_export_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    setIsExporting(false);
    alert(`Successfully exported ${liked.length} images as ZIP to Downloads folder!`);
  };

  const exportLikedMarkdown = () => {
    const liked = images.filter(img => img.isLiked);
    if (liked.length === 0) {
      alert("No liked images to export!");
      return;
    }

    const content = `# Liked Images Inventory\nGenerated on: ${new Date().toLocaleString()}\n\n` +
      liked.map(img => (
        `## ${img.customName || img.name}\n- **Original:** ${img.name}\n- **Prompt:** ${img.metadata?.positive_prompt || 'N/A'}\n- **Model:** ${img.metadata?.model?.name || 'N/A'}\n- **Seed:** ${img.metadata?.seed || 'N/A'}\n`
      )).join('\n---\n\n') +
      `\n\n# FILENAME CHECKLIST (FOR DELETION/CLEANUP)\n` +
      liked.map(img => img.name).join('\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_metadata_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allAvailableTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    images.forEach(img => {
      img.tags.forEach(tag => tagMap.set(tag, (tagMap.get(tag) || 0) + 1));
    });
    const allTags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);

    // Filter by tag search if there's a search term
    if (tagSearch.trim()) {
      const searchLower = tagSearch.toLowerCase();
      return allTags.filter(([tag]) => tag.toLowerCase().includes(searchLower));
    }

    return allTags;
  }, [images, tagSearch]);

  const allAvailableModels = useMemo(() => {
    const models = new Set<string>();
    images.forEach(img => {
      if (img.metadata?.model?.name) models.add(img.metadata.model.name);
    });
    return Array.from(models).sort();
  }, [images]);

  const removeFiltered = () => {
    if (filteredImages.length === 0) {
      alert("No images match the current filter.");
      return;
    }
    if (!confirm(`Remove ${filteredImages.length} filtered images from the session?`)) return;

    const filteredIds = new Set(filteredImages.map(img => img.id));
    filteredImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages(prev => prev.filter(img => !filteredIds.has(img.id)));

    // Clear filters after removing
    setFilters({ search: '', selectedTags: [], models: [], onlyLiked: false, dateFrom: null, dateTo: null });
  };

  const clearAll = () => {
    if (!confirm('Clear entire session?')) return;
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setFilters({ search: '', selectedTags: [], models: [], onlyLiked: false, dateFrom: null, dateTo: null });
  };

  // Helper function to set date presets
  const setDatePreset = (preset: string) => {
    const now = new Date();
    let dateFrom: string | null = null;
    let dateTo: string | null = null;

    switch (preset) {
      case 'today':
        dateFrom = now.toISOString().split('T')[0];
        dateTo = dateFrom;
        break;
      case 'last7days':
        dateTo = now.toISOString().split('T')[0];
        const last7 = new Date(now);
        last7.setDate(last7.getDate() - 7);
        dateFrom = last7.toISOString().split('T')[0];
        break;
      case 'last30days':
        dateTo = now.toISOString().split('T')[0];
        const last30 = new Date(now);
        last30.setDate(last30.getDate() - 30);
        dateFrom = last30.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        dateTo = now.toISOString().split('T')[0];
        break;
      case 'thisYear':
        dateFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        dateTo = now.toISOString().split('T')[0];
        break;
      case 'all':
      default:
        dateFrom = null;
        dateTo = null;
        break;
    }

    setFilters(f => ({ ...f, dateFrom, dateTo }));
  };

  // Get currently active preset
  const getActivePreset = (): string | null => {
    if (!filters.dateFrom && !filters.dateTo) return 'all';
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (filters.dateFrom === today && filters.dateTo === today) return 'today';
    
    const last7 = new Date(now);
    last7.setDate(last7.getDate() - 7);
    if (filters.dateFrom === last7.toISOString().split('T')[0] && filters.dateTo === today) return 'last7days';
    
    const last30 = new Date(now);
    last30.setDate(last30.getDate() - 30);
    if (filters.dateFrom === last30.toISOString().split('T')[0] && filters.dateTo === today) return 'last30days';
    
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    if (filters.dateFrom === thisMonthStart && filters.dateTo === today) return 'thisMonth';
    
    const thisYearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    if (filters.dateFrom === thisYearStart && filters.dateTo === today) return 'thisYear';
    
    return null; // Custom range
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <aside className="w-80 flex-shrink-0 border-r border-slate-800 bg-slate-900/40 flex flex-col z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">InvokeAI Lens</h1>
              <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-widest italic">Local Processing</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section>
            <button 
              onClick={() => setFilters(f => ({ ...f, onlyLiked: !f.onlyLiked }))}
              className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${filters.onlyLiked ? 'bg-pink-600/20 border-pink-500/50 text-pink-400' : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
            >
              <div className="flex items-center gap-3">
                <svg className={`w-5 h-5 ${filters.onlyLiked ? 'fill-pink-500' : 'fill-none stroke-current'}`} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                <span className="text-sm font-bold">Only Show Liked</span>
              </div>
              <span className="text-xs font-black">{images.filter(i => i.isLiked).length}</span>
            </button>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><span className="w-1 h-1 bg-blue-500 rounded-full"></span>Prompt Tags</h2>
            <div className="relative mb-3">
              <svg className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Search tags..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-all placeholder-slate-600"
              />
              {tagSearch && (
                <button
                  onClick={() => setTagSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
              {allAvailableTags.map(([tag, count]) => (
                <button key={tag} onClick={() => setFilters(f => ({ ...f, selectedTags: f.selectedTags.includes(tag) ? f.selectedTags.filter(t => t !== tag) : [...f.selectedTags, tag] }))} className={`px-2 py-1 text-[11px] font-medium rounded transition-all border ${filters.selectedTags.includes(tag) ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}`}>{tag} <span className="opacity-40 ml-0.5">{count}</span></button>
              ))}
              {allAvailableTags.length === 0 && tagSearch && (
                <p className="text-xs text-slate-500 italic py-2">No tags match "{tagSearch}"</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span className="w-1 h-1 bg-emerald-500 rounded-full"></span>Models</h2>
            <div className="space-y-1">
              {allAvailableModels.map(model => (
                <label key={model} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"><input type="checkbox" checked={filters.models.includes(model)} onChange={() => setFilters(f => ({ ...f, models: f.models.includes(model) ? f.models.filter(m => m !== model) : [...f.models, model] }))} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600" /><span className="text-xs text-slate-400 truncate">{model}</span></label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span className="w-1 h-1 bg-amber-500 rounded-full"></span>Date Range</h2>
            
            {/* Preset buttons */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'last7days', label: 'Last 7 Days' },
                { key: 'last30days', label: 'Last 30 Days' },
                { key: 'thisMonth', label: 'This Month' },
                { key: 'thisYear', label: 'This Year' },
              ].map(preset => (
                <button
                  key={preset.key}
                  onClick={() => setDatePreset(preset.key)}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-all border ${
                    getActivePreset() === preset.key
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                      : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom date range inputs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[9px] text-slate-500 font-bold uppercase w-10">From</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value || null }))}
                  className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition-all [color-scheme:dark]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[9px] text-slate-500 font-bold uppercase w-10">To</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value || null }))}
                  className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition-all [color-scheme:dark]"
                />
              </div>
              {(filters.dateFrom || filters.dateTo) && (
                <button
                  onClick={() => setFilters(f => ({ ...f, dateFrom: null, dateTo: null }))}
                  className="w-full mt-2 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-300 bg-slate-800/30 border border-slate-700/50 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Clear Dates
                </button>
              )}
            </div>
          </section>

          <section className="pt-8 border-t border-slate-800/50 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl"><p className="text-[9px] text-slate-500 font-bold uppercase">Total</p><p className="text-xl font-bold text-white">{images.length.toLocaleString()}</p></div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl"><p className="text-[9px] text-slate-500 font-bold uppercase">Found</p><p className="text-xl font-bold text-blue-400">{filteredImages.length.toLocaleString()}</p></div>
            </div>

            {images.length > 0 && (
              <div className="space-y-3">
                <button 
                  onClick={exportLikedAsWebp} 
                  className="w-full py-2.5 text-xs font-bold text-pink-400 hover:text-pink-300 bg-pink-500/5 border border-pink-500/20 rounded-xl flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Export Liked as WEBP (85%)
                </button>
                <button onClick={exportLikedMarkdown} className="w-full py-2.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Export Metadata (MD)</button>
                {filteredImages.length > 0 && filteredImages.length < images.length && (
                  <button onClick={removeFiltered} className="w-full py-2.5 text-xs font-bold text-orange-500 hover:text-orange-400 bg-orange-500/5 border border-orange-900/20 rounded-xl flex items-center justify-center gap-2"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Remove {filteredImages.length} Filtered</button>
                )}
                {metadataLessCount > 0 && (
                  <button onClick={removeMetadataLess} className="w-full py-2.5 text-xs font-bold text-red-500 hover:text-red-400 bg-red-500/5 border border-red-900/20 rounded-xl flex items-center justify-center gap-2"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Clean {metadataLessCount} Missing</button>
                )}
                <button onClick={clearAll} className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-white bg-slate-900/50 border border-slate-800 rounded-xl">Clear Entire Session</button>
              </div>
            )}
          </section>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 flex items-center px-8 gap-4 bg-slate-900/20 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex-1 max-w-3xl relative">
            <svg className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search prompts or custom names..." value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all placeholder-slate-600" />
          </div>
          <div className="flex items-center gap-2">
             <label className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl cursor-pointer hover:bg-slate-800 transition-all">
               <input type="checkbox" checked={includeSubfolders} onChange={(e) => setIncludeSubfolders(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-blue-600" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Include Subfolders</span>
             </label>
             <button onClick={() => window.open('https://github.com/aenrique-byte/invokeai-metadata-explorer#readme', '_blank')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg whitespace-nowrap flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>README</button>
             <button onClick={() => document.getElementById('file-upload-header')?.click()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg whitespace-nowrap flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>Add Files</button>
             <button onClick={() => document.getElementById('folder-upload-header')?.click()} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 whitespace-nowrap flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>Select Folder</button>
             <input id="file-upload-header" type="file" multiple accept="image/png" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
             <input id="folder-upload-header" type="file" {...({ webkitdirectory: "", directory: "" } as any)} multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </div>
        </header>

        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
          {(isProcessing || isExporting) && (
            <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
              <div className="w-full max-w-md space-y-6">
                <div className={`w-20 h-20 border-4 ${isExporting ? 'border-pink-500/20 border-t-pink-500' : 'border-blue-500/20 border-t-blue-500'} rounded-full animate-spin mx-auto`}></div>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  {isExporting ? 'Optimizing & Exporting' : 'Analyzing Files'}
                </h3>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div className={`h-full transition-all duration-300 ${isExporting ? 'bg-pink-500' : 'bg-blue-500'}`} style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                </div>
                <p className="text-[10px] font-mono text-slate-500 uppercase">{progress.current} / {progress.total}</p>
              </div>
            </div>
          )}

          {images.length === 0 ? (
            <div className="h-full flex items-center justify-center"><div className="max-w-xl w-full"><FileUploader onFilesSelected={handleFiles} isProcessing={isProcessing} /></div></div>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
                {filteredImages.slice(0, visibleCount).map(img => (
                  <ImageCard key={img.id} image={img} onClick={(i) => setSelectedImageId(i.id)} onRemove={removeSingleImage} onLike={toggleLike} />
                ))}
              </div>
              {visibleCount < filteredImages.length && <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div></div>}
              {filteredImages.length === 0 && <div className="py-40 text-center text-slate-500 italic">No results match your current criteria.</div>}
            </div>
          )}
        </div>
      </main>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-md" onClick={() => setSelectedImageId(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-7xl max-h-[90vh] flex flex-col lg:flex-row overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="lg:w-3/5 bg-black flex items-center justify-center relative min-h-[400px]">
              <img src={selectedImage.previewUrl} alt={selectedImage.name} className="max-w-full max-h-full object-contain" />
              <div className="absolute top-6 left-6 flex gap-2">
                <button onClick={() => setSelectedImageId(null)} className="bg-slate-900/80 backdrop-blur p-3 rounded-2xl text-white hover:bg-slate-800 transition-all shadow-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <button onClick={() => toggleLike(selectedImage.id)} className={`p-3 rounded-2xl shadow-lg transition-all backdrop-blur ${selectedImage.isLiked ? 'bg-pink-600 text-white' : 'bg-slate-900/80 text-white hover:bg-slate-800'}`}><svg className={`w-6 h-6 ${selectedImage.isLiked ? 'fill-current' : 'fill-none stroke-current'}`} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></button>
              </div>
              <button onClick={() => removeSingleImage(selectedImage.id)} className="absolute top-6 right-6 bg-red-600/80 backdrop-blur p-3 rounded-2xl text-white hover:bg-red-500 transition-all flex items-center gap-2 font-bold text-xs"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>Remove from Session</button>
              
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[10px] text-slate-500 font-black uppercase tracking-widest bg-black/40 px-4 py-2 rounded-full backdrop-blur">
                <span>← Prev</span>
                <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                <span>L to Like</span>
                <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                <span>Next →</span>
              </div>
            </div>
            <div className="lg:w-2/5 p-10 overflow-y-auto bg-slate-900/50">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black text-white leading-tight break-all">{selectedImage.customName || selectedImage.name}</h2>
                  {selectedImage.customName && <p className="text-[10px] text-slate-500 font-bold uppercase truncate">Original: {selectedImage.name}</p>}
                </div>
                <span className="shrink-0 px-3 py-1 bg-slate-800 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-700">{(selectedImage.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              
              {selectedImage.isLiked && (
                <button 
                  onClick={() => toggleLike(selectedImage.id)}
                  className="mb-8 text-[10px] font-black text-pink-500 uppercase tracking-widest hover:text-pink-400 transition-colors flex items-center gap-2"
                >
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  Rename Export
                </button>
              )}

              {selectedImage.metadata ? (
                <div className="space-y-10">
                  <section>
                    <div className="flex items-center justify-between mb-4"><h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Prompt</h3><button onClick={() => navigator.clipboard.writeText(selectedImage.metadata?.positive_prompt || '')} className="text-[10px] font-black text-slate-500 hover:text-blue-400 uppercase transition-colors">Copy Prompt</button></div>
                    <div className="bg-slate-950/80 rounded-2xl p-6 border border-slate-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-blue-600/40"></div><p className="text-slate-200 text-sm leading-relaxed font-medium">{selectedImage.metadata.positive_prompt || 'N/A'}</p></div>
                  </section>
                  <div className="grid grid-cols-2 gap-4">
                    {[ { label: 'Sampler', value: selectedImage.metadata.scheduler }, { label: 'Steps', value: selectedImage.metadata.steps }, { label: 'Seed', value: selectedImage.metadata.seed, mono: true }, { label: 'Model', value: selectedImage.metadata.model?.name }].map((item, idx) => (
                      <div key={idx} className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800/50"><p className="text-[9px] text-slate-500 font-bold uppercase mb-1.5">{item.label}</p><p className={`text-xs text-slate-200 font-bold truncate ${item.mono ? 'font-mono text-blue-400' : ''}`}>{item.value || '—'}</p></div>
                    ))}
                  </div>
                </div>
              ) : ( <div className="py-20 text-center opacity-30 italic text-slate-500">No InvokeAI metadata found.</div> )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
